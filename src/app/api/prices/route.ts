import { NextRequest, NextResponse } from "next/server";
import { authGuardResponse, requireAuth } from "@/server/auth/auth-guard";
import { apiLogger } from "@/server/logging/logger";
import { prisma } from "@/server/db/prisma";
import { parsePriceRequestParams, PriceRequestValidationError } from "@/domain/pricing/price-request";

const log = apiLogger("Prices");

const BINANCE_TIMEOUT_MS = 5_000;
const ISIN_PRICE_CONCURRENCY = 5;
const CRYPTO_PRICE_CONCURRENCY = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 12;

const priceRateLimitBuckets = new Map<string, number[]>();
const inFlightIsinPrices = new Map<string, Promise<number | null>>();
const inFlightCryptoPrices = new Map<string, Promise<number | null>>();

function getRateLimitRetryAfterMs(userId: string) {
  const now = Date.now();
  const bucket = (priceRateLimitBuckets.get(userId) ?? []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
  );

  if (bucket.length >= RATE_LIMIT_MAX_REQUESTS) {
    priceRateLimitBuckets.set(userId, bucket);
    return RATE_LIMIT_WINDOW_MS - (now - bucket[0]);
  }

  bucket.push(now);
  priceRateLimitBuckets.set(userId, bucket);
  return null;
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

/**
 * Fetch a single ISIN's live mid-price from JustETF WebSocket.
 * Opens a WS connection, waits for the first message with mid.raw, then closes.
 */
function fetchLivePrice(isin: string, timeoutMs = 6000): Promise<number | null> {
  return new Promise((resolve) => {
    const url = `wss://api.mobile.stock-data-subscriptions.justetf.com/?subscription=trend&parameters=isins:${isin}/currency:EUR/language:it`;

    let resolved = false;
    const done = (value: number | null) => {
      if (resolved) return;
      resolved = true;
      try { ws.close(); } catch {}
      resolve(value);
    };

    const timer = setTimeout(() => {
      log.info(`[${isin}] WebSocket timeout after ${timeoutMs}ms`);
      done(null);
    }, timeoutMs);

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      clearTimeout(timer);
      log.info(`[${isin}] WebSocket creation error: ${err}`);
      resolve(null);
      return;
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(String(event.data));
        if (data?.mid?.raw != null) {
          clearTimeout(timer);
          const price = Number(data.mid.raw);
          log.info(`[${isin}] Got live price: ${price}`);
          done(price);
        }
      } catch {
        // Ignore non-JSON frames
      }
    };

    ws.onerror = (err) => {
      clearTimeout(timer);
      log.info(`[${isin}] WebSocket error: ${err}`);
      done(null);
    };

    ws.onclose = () => {
      clearTimeout(timer);
      done(null);
    };
  });
}

/**
 * Fetch a single crypto token's live price from Binance API in EUR (e.g. BTCEUR, ETHEUR).
 */
async function fetchBinancePrice(symbol: string, timeoutMs = BINANCE_TIMEOUT_MS): Promise<number | null> {
  try {
    const uppercaseSymbol = symbol.toUpperCase();
    const binanceSymbol = `${uppercaseSymbol}EUR`;
    const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`, {
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!res.ok) {
      log.info(`[${symbol}] Binance returned status ${res.status}`);
      return null;
    }
    const data = await res.json();
    if (data?.price != null) {
      const price = Number(data.price);
      log.info(`[${symbol}] Got Binance price: ${price}`);
      return price;
    }
    return null;
  } catch (err) {
    log.info(`[${symbol}] Binance fetch error: ${err}`);
    return null;
  }
}

async function getLatestHistoricalPrices(keys: string[]) {
  if (keys.length === 0) {
    return new Map<string, number>();
  }

  const historyPoints = await prisma.assetHistory.findMany({
    where: {
      isin: { in: keys },
      currency: "EUR"
    },
    select: {
      isin: true,
      value: true
    },
    orderBy: [
      { isin: "asc" },
      { date: "desc" }
    ]
  });

  const prices = new Map<string, number>();
  for (const point of historyPoints) {
    if (!prices.has(point.isin)) {
      prices.set(point.isin, point.value);
    }
  }

  return prices;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const retryAfterMs = getRateLimitRetryAfterMs(session.user.id);
    if (retryAfterMs !== null) {
      log.response("GET", "/api/prices", 429, { retryAfterMs });
      return NextResponse.json(
        { error: "Too many price refresh requests. Please wait before retrying." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000)))
          }
        }
      );
    }

    const { isins, cryptos } = parsePriceRequestParams(request.nextUrl.searchParams);
    log.request("GET", "/api/prices", { isins: isins.join(","), cryptos: cryptos.join(",") });
    const prices: Record<string, number | null> = {};

    const isinResults = await mapWithConcurrency(isins, ISIN_PRICE_CONCURRENCY, async (isin) => {
      try {
        log.info(`[${isin}] Fetching live price via WebSocket...`);
        const price = await fetchInFlightDeduped(
          inFlightIsinPrices,
          isin,
          () => fetchLivePrice(isin)
        );
        return { key: isin, price };
      } catch (err) {
        log.error("GET", `/api/prices?isin=${isin}`, err);
        return { key: isin, price: null };
      }
    });

    const cryptoResults = await mapWithConcurrency(cryptos, CRYPTO_PRICE_CONCURRENCY, async (crypto) => {
      try {
        log.info(`[${crypto}] Fetching live price via Binance REST API...`);
        const price = await fetchInFlightDeduped(
          inFlightCryptoPrices,
          crypto,
          () => fetchBinancePrice(crypto)
        );
        return { key: crypto, price };
      } catch (err) {
        log.error("GET", `/api/prices?crypto=${crypto}`, err);
        return { key: crypto, price: null };
      }
    });

    const fetchResults = [...isinResults, ...cryptoResults];
    const missingLiveKeys = fetchResults
      .filter((result) => result.price === null)
      .map((result) => result.key);
    const historicalPrices = await getLatestHistoricalPrices(missingLiveKeys);

    for (const result of fetchResults) {
      let finalPrice = result.price;
      const key = result.key;

      if (finalPrice === null) {
        const historicalPrice = historicalPrices.get(key);
        if (historicalPrice !== undefined) {
          finalPrice = historicalPrice;
          log.info(`[${key}] Live price fetch failed. Falling back to asset history price: ${finalPrice}`);
        } else {
          log.info(`[${key}] Live price fetch failed. No history price available.`);
        }
      }

      prices[key] = finalPrice;
    }

    log.response("GET", "/api/prices", 200, prices);
    return NextResponse.json(prices);
  } catch (error) {
    if (error instanceof PriceRequestValidationError) {
      log.response("GET", "/api/prices", error.status, { error: error.message });
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const response = authGuardResponse(error);
    if (response) return response;

    log.error("GET", "/api/prices", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error fetching prices." },
      { status: 500 }
    );
  }
}
