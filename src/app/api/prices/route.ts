import { NextRequest, NextResponse } from "next/server";
import { authGuardResponse, requireAuth } from "@/lib/auth-guard";
import { apiLogger } from "@/lib/logger";
import { prisma } from "@/lib/db";

const log = apiLogger("Prices");

const CACHE_TTL_MS = 45_000; // 45 seconds (allows 60s client polling to always get fresh prices)

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
async function fetchBinancePrice(symbol: string): Promise<number | null> {
  try {
    const uppercaseSymbol = symbol.toUpperCase();
    const binanceSymbol = `${uppercaseSymbol}EUR`;
    const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`);
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

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);
    const isinsParam = request.nextUrl.searchParams.get("isins");
    const cryptosParam = request.nextUrl.searchParams.get("cryptos");
    log.request("GET", "/api/prices", { isins: isinsParam, cryptos: cryptosParam });

    const rawIsins = isinsParam
      ? [...new Set(isinsParam.split(",").map(s => s.trim()).filter(Boolean))]
      : [];

    const rawCryptos = cryptosParam
      ? [...new Set(cryptosParam.split(",").map(s => s.trim()).filter(Boolean))]
      : [];

    const isins: string[] = [];
    const cryptos: string[] = [...rawCryptos];

    for (const item of rawIsins) {
      if (item.length === 12) {
        isins.push(item);
      } else {
        log.info(`[route.ts] Moving non-ISIN key "${item}" from isins to cryptos`);
        if (!cryptos.includes(item)) {
          cryptos.push(item);
        }
      }
    }

    if (isins.length === 0 && cryptos.length === 0) {
      log.response("GET", "/api/prices", 400, { error: "isins or cryptos param missing" });
      return NextResponse.json({ error: "Either isins or cryptos parameter is required." }, { status: 400 });
    }

    const now = Date.now();
    const prices: Record<string, number | null> = {};

    // Query SQLite cache table for these keys
    const keysToQuery = [...isins, ...cryptos];
    const cachedRecords = keysToQuery.length > 0
      ? await prisma.priceCache.findMany({
          where: { key: { in: keysToQuery } }
        })
      : [];

    const dbCacheMap = new Map<string, { price: number | null, timestamp: number }>();
    for (const record of cachedRecords) {
      dbCacheMap.set(record.key, {
        price: record.price,
        timestamp: record.timestamp.getTime()
      });
    }
    
    // Process ISINs
    const isinsToFetch: string[] = [];
    for (const isin of isins) {
      const cached = dbCacheMap.get(isin);
      if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        prices[isin] = cached.price;
        log.info(`[${isin}] Serving price from SQLite cache: ${cached.price}`);
      } else {
        isinsToFetch.push(isin);
      }
    }

    // Process Cryptos
    const cryptosToFetch: string[] = [];
    for (const crypto of cryptos) {
      const cached = dbCacheMap.get(crypto);
      if (cached && now - cached.timestamp < CACHE_TTL_MS) {
        prices[crypto] = cached.price;
        log.info(`[${crypto}] Serving price from SQLite cache: ${cached.price}`);
      } else {
        cryptosToFetch.push(crypto);
      }
    }

    // Fetch cache misses in parallel to avoid slow sequential blockages
    const isinPromises = isinsToFetch.map(async (isin) => {
      try {
        log.info(`[${isin}] Cache miss. Fetching live price via WebSocket...`);
        const price = await fetchLivePrice(isin);
        return { key: isin, price };
      } catch (err) {
        log.error("GET", `/api/prices?isin=${isin}`, err);
        return { key: isin, price: null };
      }
    });

    const cryptoPromises = cryptosToFetch.map(async (crypto) => {
      try {
        log.info(`[${crypto}] Cache miss. Fetching live price via Binance REST API...`);
        const price = await fetchBinancePrice(crypto);
        return { key: crypto, price };
      } catch (err) {
        log.error("GET", `/api/prices?crypto=${crypto}`, err);
        return { key: crypto, price: null };
      }
    });

    const fetchResults = await Promise.all([...isinPromises, ...cryptoPromises]);

    for (const result of fetchResults) {
      let finalPrice = result.price;
      const key = result.key;

      if (finalPrice === null) {
        // Fallback 1: Keep existing non-null price in cache map if it exists
        const cached = dbCacheMap.get(key);
        if (cached && cached.price !== null) {
          finalPrice = cached.price;
          log.info(`[${key}] Live price fetch failed. Falling back to cached price: ${finalPrice}`);
        } else {
          // Fallback 2: Query historical prices from AssetHistory
          const historyPoint = await prisma.assetHistory.findFirst({
            where: { isin: key },
            orderBy: { date: "desc" }
          });
          if (historyPoint) {
            finalPrice = historyPoint.value;
            log.info(`[${key}] Live price fetch failed. Falling back to asset history price: ${finalPrice}`);
          } else {
            log.info(`[${key}] Live price fetch failed. No cached or history price available.`);
          }
        }
      }

      prices[key] = finalPrice;

      // Update SQLite cache
      await prisma.priceCache.upsert({
        where: { key },
        update: { price: finalPrice, timestamp: new Date() },
        create: { key, price: finalPrice, timestamp: new Date() }
      });
    }

    log.response("GET", "/api/prices", 200, prices);
    return NextResponse.json(prices);
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) return response;

    log.error("GET", "/api/prices", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error fetching prices." },
      { status: 500 }
    );
  }
}
