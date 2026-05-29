import { apiLogger } from "@/server/logging/logger";
import {
  marketDataRepository,
  type MarketDataRepository
} from "@/server/repositories/market-data-repository";
import { consumeScopedRateLimit } from "@/server/services/rate-limit";

const log = apiLogger("Prices");

const BINANCE_TIMEOUT_MS = 5_000;
const DEFAULT_ISIN_PRICE_CONCURRENCY = 5;
const DEFAULT_CRYPTO_PRICE_CONCURRENCY = 10;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 12;

type PriceKind = "isin" | "crypto";

type PriceFetchResult = {
  key: string;
  price: number | null;
};

type PriceFetcher = (key: string) => Promise<number | null>;

type PriceLogger = Pick<ReturnType<typeof apiLogger>, "error" | "info">;

export type PriceRefreshRequest = {
  isins: string[];
  cryptos: string[];
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
  repository?: PriceRefreshRepository;
  rateLimiter?: PriceRateLimiter;
  isinFetcher?: PriceFetcher;
  cryptoFetcher?: PriceFetcher;
  isinConcurrency?: number;
  cryptoConcurrency?: number;
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

async function fetchBinancePrice(symbol: string, timeoutMs = BINANCE_TIMEOUT_MS, logger: PriceLogger = log) {
  try {
    const uppercaseSymbol = symbol.toUpperCase();
    const binanceSymbol = `${uppercaseSymbol}EUR`;
    const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`, {
      signal: AbortSignal.timeout(timeoutMs)
    });

    if (!response.ok) {
      logger.info(`[${symbol}] Binance returned status ${response.status}`);
      return null;
    }

    const data = await response.json();
    if (data?.price != null) {
      logger.info(`[${symbol}] Received live price from Binance.`);
      return Number(data.price);
    }

    return null;
  } catch (error) {
    logger.info(`[${symbol}] Binance fetch error: ${error}`);
    return null;
  }
}

async function fetchPriceResults(
  kind: PriceKind,
  keys: string[],
  concurrency: number,
  fetcher: PriceFetcher,
  inFlightPrices: Map<string, Promise<number | null>>,
  logger: PriceLogger
) {
  return mapWithConcurrency(keys, concurrency, async (key): Promise<PriceFetchResult> => {
    try {
      logger.info(`[${key}] Fetching ${kind} live price.`);
      const price = await fetchInFlightDeduped(inFlightPrices, key, () => fetcher(key));
      return { key, price };
    } catch (error) {
      logger.error("GET", `/api/prices?${kind}=${key}`, error);
      return { key, price: null };
    }
  });
}

export function createPriceRefreshService({
  repository = marketDataRepository,
  rateLimiter = new InMemoryPriceRateLimiter(),
  isinFetcher,
  cryptoFetcher,
  isinConcurrency = DEFAULT_ISIN_PRICE_CONCURRENCY,
  cryptoConcurrency = DEFAULT_CRYPTO_PRICE_CONCURRENCY,
  inFlightIsinPrices = new Map<string, Promise<number | null>>(),
  inFlightCryptoPrices = new Map<string, Promise<number | null>>(),
  logger = log
}: CreatePriceRefreshServiceOptions = {}) {
  const fetchIsinPrice: PriceFetcher = isinFetcher ?? ((isin) => fetchLivePrice(isin, 6_000, logger));
  const fetchCryptoPrice: PriceFetcher = cryptoFetcher ?? ((symbol) => fetchBinancePrice(symbol, BINANCE_TIMEOUT_MS, logger));

  return {
    async getRetryAfterMs(userId: string) {
      return rateLimiter.getRetryAfterMs(userId);
    },

    async fetchPrices({ isins, cryptos }: PriceRefreshRequest) {
      const [isinResults, cryptoResults] = await Promise.all([
        fetchPriceResults("isin", isins, isinConcurrency, fetchIsinPrice, inFlightIsinPrices, logger),
        fetchPriceResults("crypto", cryptos, cryptoConcurrency, fetchCryptoPrice, inFlightCryptoPrices, logger)
      ]);

      const fetchResults = [...isinResults, ...cryptoResults];
      const missingLiveKeys = fetchResults
        .filter((result) => result.price === null)
        .map((result) => result.key);
      const historicalPrices = await repository.listLatestHistoricalPrices(missingLiveKeys);
      const prices: Record<string, number | null> = {};

      for (const result of fetchResults) {
        let finalPrice = result.price;

        if (finalPrice === null) {
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
