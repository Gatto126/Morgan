import { apiLogger } from "@/server/logging/logger";
import {
  measurePerformanceStep,
  type PerformanceTrace
} from "@/server/logging/performance";
import {
  marketDataRepository,
  type MarketDataRepository
} from "@/server/repositories/market-data-repository";
import { consumeScopedRateLimit } from "@/server/services/rate-limit";

const log = apiLogger("Prices");

const BINANCE_TIMEOUT_MS = 5_000;
const BINANCE_TICKER_PRICE_URL = "https://api.binance.com/api/v3/ticker/price";
const DEFAULT_BINANCE_TICKER_CACHE_MS = 5_000;
const DEFAULT_ISIN_PRICE_CONCURRENCY = 5;
const DEFAULT_CRYPTO_PRICE_CONCURRENCY = 10;
const DEFAULT_HISTORICAL_FALLBACK_GRACE_MS = 1_200;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 90;

type PriceKind = "isin" | "crypto";

type PriceFetchResult = {
  key: string;
  price: number | null;
};

type PriceFetcher = (key: string) => Promise<number | null>;
type CryptoBatchFetcher = (keys: string[]) => Promise<Record<string, number | null>>;
type PriceLogger = Pick<ReturnType<typeof apiLogger>, "error" | "info">;
type BinanceTickerPriceMap = Map<string, number>;

export type PriceRefreshRequest = {
  isins: string[];
  cryptos: string[];
};

type FetchPricesOptions = {
  includeHistoricalFallback?: boolean;
  trace?: PerformanceTrace;
};

export type PriceRefreshRepository = Pick<MarketDataRepository, "listLatestHistoricalPrices">;

export type PriceRateLimiter = {
  getRetryAfterMs(key: string): number | null | Promise<number | null>;
};

export class InMemoryPriceRateLimiter implements PriceRateLimiter {
  private buckets = new Map<string, number[]>();

  constructor(
    private readonly options: {
      windowMs?: number;
      maxRequests?: number;
      now?: () => number;
    } = {}
  ) {}

  getRetryAfterMs(key: string) {
    const windowMs = this.options.windowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS;
    const maxRequests = this.options.maxRequests ?? DEFAULT_RATE_LIMIT_MAX_REQUESTS;
    const now = this.options.now?.() ?? Date.now();
    const bucket = (this.buckets.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);

    if (bucket.length >= maxRequests) {
      this.buckets.set(key, bucket);
      return windowMs - (now - bucket[0]);
    }

    bucket.push(now);
    this.buckets.set(key, bucket);
    return null;
  }

  clear() {
    this.buckets.clear();
  }
}

export class PersistentPriceRateLimiter implements PriceRateLimiter {
  constructor(
    private readonly options: {
      namespace?: string;
      windowMs?: number;
      maxRequests?: number;
    } = {}
  ) {}

  getRetryAfterMs(key: string) {
    return consumeScopedRateLimit({
      namespace: this.options.namespace ?? "price-refresh",
      subject: key,
      windowMs: this.options.windowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS,
      maxAttempts: this.options.maxRequests ?? DEFAULT_RATE_LIMIT_MAX_REQUESTS
    });
  }
}

type CreatePriceRefreshServiceOptions = {
  binanceTickerCacheMs?: number;
  repository?: PriceRefreshRepository;
  rateLimiter?: PriceRateLimiter;
  isinFetcher?: PriceFetcher;
  cryptoFetcher?: PriceFetcher;
  cryptoBatchFetcher?: CryptoBatchFetcher | null;
  isinConcurrency?: number;
  cryptoConcurrency?: number;
  historicalFallbackGraceMs?: number;
  inFlightIsinPrices?: Map<string, Promise<number | null>>;
  inFlightCryptoPrices?: Map<string, Promise<number | null>>;
  logger?: PriceLogger;
};

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(items[currentIndex]);
      }
    })
  );

  return results;
}

function fetchInFlightDeduped(
  map: Map<string, Promise<number | null>>,
  key: string,
  fetcher: () => Promise<number | null>
) {
  const existingRequest = map.get(key);
  if (existingRequest) {
    return existingRequest;
  }

  const request = fetcher().finally(() => {
    map.delete(key);
  });
  map.set(key, request);
  return request;
}

async function resolveWithHistoricalFallbackDeadline(
  livePrice: Promise<number | null>,
  key: string,
  historicalPrices: Map<string, number>,
  graceMs: number,
  logger: PriceLogger
) {
  if (!historicalPrices.has(key)) {
    return livePrice;
  }

  let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      livePrice,
      new Promise<null>((resolve) => {
        fallbackTimer = setTimeout(() => {
          fallbackTimer = undefined;
          logger.info(`[${key}] Falling back to asset history after ${graceMs}ms.`);
          resolve(null);
        }, graceMs);
      })
    ]);
  } finally {
    if (fallbackTimer) {
      clearTimeout(fallbackTimer);
    }
  }
}

function fetchLivePrice(isin: string, timeoutMs = 6_000, logger: PriceLogger = log): Promise<number | null> {
  return new Promise((resolve) => {
    const url = `wss://api.mobile.stock-data-subscriptions.justetf.com/?subscription=trend&parameters=isins:${isin}/currency:EUR/language:it`;

    let ws: WebSocket | undefined;
    let resolved = false;
    const done = (value: number | null) => {
      if (resolved) return;
      resolved = true;
      try {
        ws?.close();
      } catch {
        // The socket may already be closing.
      }
      resolve(value);
    };

    const timer = setTimeout(() => {
      logger.info(`[${isin}] WebSocket timeout after ${timeoutMs}ms`);
      done(null);
    }, timeoutMs);

    try {
      ws = new WebSocket(url);
    } catch (error) {
      clearTimeout(timer);
      logger.info(`[${isin}] WebSocket creation error: ${error}`);
      resolve(null);
      return;
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data));
        if (data?.mid?.raw != null) {
          clearTimeout(timer);
          logger.info(`[${isin}] Received live price from JustETF.`);
          done(Number(data.mid.raw));
        }
      } catch {
        // Ignore non-JSON frames.
      }
    };

    ws.onerror = (error) => {
      clearTimeout(timer);
      logger.info(`[${isin}] WebSocket error: ${error}`);
      done(null);
    };

    ws.onclose = () => {
      clearTimeout(timer);
      done(null);
    };
  });
}

async function fetchBinanceTickerPrice(binanceSymbol: string, timeoutMs: number) {
  const response = await fetch(`${BINANCE_TICKER_PRICE_URL}?symbol=${binanceSymbol}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data?.price != null ? Number(data.price) : null;
}

async function fetchBinancePrice(symbol: string, timeoutMs = BINANCE_TIMEOUT_MS, logger: PriceLogger = log) {
  try {
    const uppercaseSymbol = symbol.toUpperCase();
    const eurPrice = await fetchBinanceTickerPrice(`${uppercaseSymbol}EUR`, timeoutMs);
    if (eurPrice != null) {
      logger.info(`[${symbol}] Received EUR live price from Binance.`);
      return eurPrice;
    }

    const [usdtPrice, eurUsdtRate] = await Promise.all([
      fetchBinanceTickerPrice(`${uppercaseSymbol}USDT`, timeoutMs),
      fetchBinanceTickerPrice("EURUSDT", timeoutMs)
    ]);

    if (usdtPrice != null && eurUsdtRate != null && eurUsdtRate > 0) {
      logger.info(`[${symbol}] Received USDT live price from Binance and converted to EUR.`);
      return usdtPrice / eurUsdtRate;
    }

    logger.info(`[${symbol}] Binance returned no usable EUR or USDT live price.`);
    return null;
  } catch (error) {
    logger.info(`[${symbol}] Binance fetch error: ${error}`);
    return null;
  }
}

async function fetchAllBinanceTickerPrices(timeoutMs: number): Promise<BinanceTickerPriceMap> {
  const response = await fetch(BINANCE_TICKER_PRICE_URL, {
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    return new Map();
  }

  const data = await response.json();
  const rows = Array.isArray(data) ? data : [data];
  const prices: BinanceTickerPriceMap = new Map();

  for (const row of rows) {
    const symbol = typeof row?.symbol === "string" ? row.symbol.toUpperCase() : null;
    const price = row?.price != null ? Number(row.price) : null;
    if (symbol && typeof price === "number" && Number.isFinite(price) && price > 0) {
      prices.set(symbol, price);
    }
  }

  return prices;
}

function getTickerMapPrice(prices: BinanceTickerPriceMap, symbol: string) {
  const price = prices.get(symbol.toUpperCase());
  return typeof price === "number" && Number.isFinite(price) && price > 0 ? price : null;
}

function getUsdtToEurRate(prices: BinanceTickerPriceMap) {
  const usdtEur = getTickerMapPrice(prices, "USDTEUR");
  if (usdtEur !== null) {
    return usdtEur;
  }

  const eurUsdt = getTickerMapPrice(prices, "EURUSDT");
  return eurUsdt !== null ? 1 / eurUsdt : null;
}

function getUsdcToEurRate(prices: BinanceTickerPriceMap) {
  const usdcEur = getTickerMapPrice(prices, "USDCEUR");
  if (usdcEur !== null) {
    return usdcEur;
  }

  const eurUsdc = getTickerMapPrice(prices, "EURUSDC");
  if (eurUsdc !== null) {
    return 1 / eurUsdc;
  }

  const usdtToEur = getUsdtToEurRate(prices);
  if (usdtToEur === null) {
    return null;
  }

  const usdcUsdt = getTickerMapPrice(prices, "USDCUSDT");
  if (usdcUsdt !== null) {
    return usdcUsdt * usdtToEur;
  }

  const usdtUsdc = getTickerMapPrice(prices, "USDTUSDC");
  return usdtUsdc !== null ? usdtToEur / usdtUsdc : null;
}

function resolveBinanceTickerMapCryptoPrice(symbol: string, prices: BinanceTickerPriceMap) {
  const uppercaseSymbol = symbol.toUpperCase();

  if (uppercaseSymbol === "EUR") {
    return 1;
  }

  if (uppercaseSymbol === "USDT") {
    return getUsdtToEurRate(prices);
  }

  if (uppercaseSymbol === "USDC") {
    return getUsdcToEurRate(prices);
  }

  const usdtPrice = getTickerMapPrice(prices, `${uppercaseSymbol}USDT`);
  const usdtToEur = getUsdtToEurRate(prices);
  if (usdtPrice !== null && usdtToEur !== null) {
    return usdtPrice * usdtToEur;
  }

  const eurPrice = getTickerMapPrice(prices, `${uppercaseSymbol}EUR`);
  if (eurPrice !== null) {
    return eurPrice;
  }

  const usdcPrice = getTickerMapPrice(prices, `${uppercaseSymbol}USDC`);
  const usdcToEur = getUsdcToEurRate(prices);
  if (usdcPrice !== null && usdcToEur !== null) {
    return usdcPrice * usdcToEur;
  }

  return null;
}

function createBinanceBatchCryptoFetcher({
  cacheMs,
  logger,
  timeoutMs
}: {
  cacheMs: number;
  logger: PriceLogger;
  timeoutMs: number;
}): CryptoBatchFetcher {
  let cachedAt = 0;
  let cachedPrices: BinanceTickerPriceMap | null = null;
  let inFlightPrices: Promise<BinanceTickerPriceMap> | null = null;

  async function getTickerPrices() {
    const now = Date.now();
    if (cachedPrices && now - cachedAt <= cacheMs) {
      return cachedPrices;
    }

    inFlightPrices ??= fetchAllBinanceTickerPrices(timeoutMs)
      .then((prices) => {
        cachedAt = Date.now();
        cachedPrices = prices;
        logger.info(`[binance] Received ${prices.size} ticker prices from batch endpoint.`);
        return prices;
      })
      .catch((error) => {
        logger.info(`[binance] Batch ticker price fetch error: ${error}`);
        return new Map();
      })
      .finally(() => {
        inFlightPrices = null;
      });

    return inFlightPrices;
  }

  return async (keys: string[]) => {
    const tickerPrices = await getTickerPrices();
    const prices: Record<string, number | null> = {};

    for (const key of keys) {
      prices[key] = resolveBinanceTickerMapCryptoPrice(key, tickerPrices);
    }

    return prices;
  };
}

async function fetchPriceResults(
  kind: PriceKind,
  keys: string[],
  concurrency: number,
  fetcher: PriceFetcher,
  inFlightPrices: Map<string, Promise<number | null>>,
  historicalPrices: Map<string, number>,
  historicalFallbackGraceMs: number,
  logger: PriceLogger
) {
  const safeConcurrency = Math.max(1, concurrency);
  const liveAttemptLimit = safeConcurrency;
  const liveKeys = keys.filter((key, index) => !historicalPrices.has(key) || index < liveAttemptLimit);
  const historicalOnlyKeys = keys.filter((key, index) => historicalPrices.has(key) && index >= liveAttemptLimit);

  const liveResults = await mapWithConcurrency(liveKeys, safeConcurrency, async (key): Promise<PriceFetchResult> => {
    try {
      logger.info(`[${key}] Fetching ${kind} live price.`);
      const livePrice = fetchInFlightDeduped(inFlightPrices, key, () => fetcher(key));
      const price = await resolveWithHistoricalFallbackDeadline(
        livePrice,
        key,
        historicalPrices,
        historicalFallbackGraceMs,
        logger
      );
      return { key, price };
    } catch (error) {
      logger.error("GET", `/api/prices?${kind}=${key}`, error);
      return { key, price: null };
    }
  });

  for (const key of historicalOnlyKeys) {
    logger.info(`[${key}] Using queued historical fallback without live fetch.`);
  }

  const resultByKey = new Map([
    ...liveResults.map((result) => [result.key, result] as const),
    ...historicalOnlyKeys.map((key) => [key, { key, price: null }] as const)
  ]);

  return keys.map((key) => resultByKey.get(key) ?? { key, price: null });
}

async function fetchBatchCryptoPriceResults(
  keys: string[],
  fetcher: CryptoBatchFetcher,
  logger: PriceLogger
) {
  if (keys.length === 0) {
    return [];
  }

  try {
    logger.info(`[crypto] Fetching ${keys.length} live prices from Binance batch.`);
    const prices = await fetcher(keys);
    return keys.map((key): PriceFetchResult => ({
      key,
      price: prices[key] ?? null
    }));
  } catch (error) {
    logger.error("GET", "/api/prices?cryptos=batch", error);
    return keys.map((key): PriceFetchResult => ({ key, price: null }));
  }
}

export function createPriceRefreshService({
  binanceTickerCacheMs = DEFAULT_BINANCE_TICKER_CACHE_MS,
  repository = marketDataRepository,
  rateLimiter = new InMemoryPriceRateLimiter(),
  isinFetcher,
  cryptoFetcher,
  cryptoBatchFetcher,
  isinConcurrency = DEFAULT_ISIN_PRICE_CONCURRENCY,
  cryptoConcurrency = DEFAULT_CRYPTO_PRICE_CONCURRENCY,
  historicalFallbackGraceMs = DEFAULT_HISTORICAL_FALLBACK_GRACE_MS,
  inFlightIsinPrices = new Map<string, Promise<number | null>>(),
  inFlightCryptoPrices = new Map<string, Promise<number | null>>(),
  logger = log
}: CreatePriceRefreshServiceOptions = {}) {
  const fetchIsinPrice: PriceFetcher = isinFetcher ?? ((isin) => fetchLivePrice(isin, 6_000, logger));
  const fetchCryptoPrice: PriceFetcher = cryptoFetcher ?? ((symbol) => fetchBinancePrice(symbol, BINANCE_TIMEOUT_MS, logger));
  const fetchCryptoBatchPrices: CryptoBatchFetcher | null | undefined = cryptoBatchFetcher === undefined
    ? cryptoFetcher
      ? null
      : createBinanceBatchCryptoFetcher({
          cacheMs: binanceTickerCacheMs,
          logger,
          timeoutMs: BINANCE_TIMEOUT_MS
        })
    : cryptoBatchFetcher;

  return {
    async getRetryAfterMs(userId: string) {
      return rateLimiter.getRetryAfterMs(userId);
    },

    async fetchPrices(
      { isins, cryptos }: PriceRefreshRequest,
      { includeHistoricalFallback = true, trace }: FetchPricesOptions = {}
    ) {
      const requestKeys = [...isins, ...cryptos];
      const historicalPrices = includeHistoricalFallback
        ? await measurePerformanceStep(
            trace,
            "prices.repository.listLatestHistoricalPrices",
            () => repository.listLatestHistoricalPrices(requestKeys),
            (rows) => ({ requestKeys: requestKeys.length, rows: rows.size })
          )
        : new Map<string, number>();
      const [isinResults, cryptoResults] = await measurePerformanceStep(
        trace,
        "prices.external.fetchLivePrices",
        () => Promise.all([
          fetchPriceResults(
            "isin",
            isins,
            isinConcurrency,
            fetchIsinPrice,
            inFlightIsinPrices,
            historicalPrices,
            historicalFallbackGraceMs,
            logger
          ),
          fetchCryptoBatchPrices
            ? fetchBatchCryptoPriceResults(
                cryptos,
                fetchCryptoBatchPrices,
                logger
              )
            : fetchPriceResults(
                "crypto",
                cryptos,
                cryptoConcurrency,
                fetchCryptoPrice,
                inFlightCryptoPrices,
                historicalPrices,
                historicalFallbackGraceMs,
                logger
              )
        ]),
        ([isinRows, cryptoRows]) => ({
          cryptoKeys: cryptos.length,
          cryptoResults: cryptoRows.length,
          isinKeys: isins.length,
          isinResults: isinRows.length
        })
      );

      const fetchResults = [...isinResults, ...cryptoResults];
      const prices: Record<string, number | null> = {};

      for (const result of fetchResults) {
        let finalPrice = result.price;

        if (finalPrice === null && includeHistoricalFallback) {
          const historicalPrice = historicalPrices.get(result.key);
          if (historicalPrice !== undefined) {
            finalPrice = historicalPrice;
            logger.info(`[${result.key}] Using fallback asset history price.`);
          } else {
            logger.info(`[${result.key}] No fallback asset history price available.`);
          }
        }

        prices[result.key] = finalPrice;
      }

      return prices;
    }
  };
}

export const priceRefreshRateLimiter = new PersistentPriceRateLimiter();
export const priceRefreshService = createPriceRefreshService({
  rateLimiter: priceRefreshRateLimiter
});
