import { NextResponse } from "next/server";
import crypto from "crypto";
import { authGuardResponse, requireOwnedProfile } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { apiLogger } from "@/lib/logger";
import { decryptBinanceCredentials } from "@/lib/secrets";

const log = apiLogger("BinanceSync");

const TOKEN_NAMES: Record<string, string> = {
  BTC: "Bitcoin",
  ETH: "Ethereum",
  BNB: "BNB",
  USDT: "Tether",
  USDC: "USD Coin",
  BUSD: "Binance USD",
  XRP: "XRP",
  SOL: "Solana",
  ADA: "Cardano",
  DOGE: "Dogecoin",
  DOT: "Polkadot",
  MATIC: "Polygon",
  SHIB: "Shiba Inu",
  LTC: "Litecoin",
  AVAX: "Avalanche",
  LINK: "Chainlink",
  UNI: "Uniswap",
  ATOM: "Cosmos",
  XLM: "Stellar",
  TRX: "TRON",
  DAI: "Dai",
  FTM: "Fantom",
  NEAR: "NEAR Protocol",
  ALGO: "Algorand",
  VET: "VeChain",
  SAND: "The Sandbox",
  MANA: "Decentraland",
  AAVE: "Aave",
  ETC: "Ethereum Classic",
  BCH: "Bitcoin Cash",
  TON: "Toncoin",
  OP: "Optimism",
  ARB: "Arbitrum",
  SUI: "Sui",
  APT: "Aptos",
  INJ: "Injective",
  PEPE: "Pepe",
};

const EUR_STABLES = new Set(["EURL", "EURS", "SEUR", "EURC", "EURI"]);
const USD_STABLES = new Set(["USDT", "USDC", "BUSD", "DAI", "TUSD", "USDP", "GUSD"]);

function makeSignedQuery(secret: string, params: Record<string, string | number>): string {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString();
  const sig = crypto.createHmac("sha256", secret).update(qs).digest("hex");
  return `${qs}&signature=${sig}`;
}

async function getEurPrice(symbol: string): Promise<number> {
  if (EUR_STABLES.has(symbol)) return 1;
  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}EUR`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.price) return parseFloat(data.price);
    }
  } catch {}
  if (USD_STABLES.has(symbol)) {
    try {
      const res = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=EURUSDT", {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.price) return 1 / parseFloat(data.price);
      }
    } catch {}
    return 1 / 1.08;
  }
  try {
    const [tokenRes, eurRes] = await Promise.all([
      fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}USDT`, {
        signal: AbortSignal.timeout(5000),
      }),
      fetch("https://api.binance.com/api/v3/ticker/price?symbol=EURUSDT", {
        signal: AbortSignal.timeout(5000),
      }),
    ]);
    if (tokenRes.ok && eurRes.ok) {
      const tokenData = await tokenRes.json();
      const eurData = await eurRes.json();
      if (tokenData?.price && eurData?.price) {
        return parseFloat(tokenData.price) / parseFloat(eurData.price);
      }
    }
  } catch {}
  return 0;
}

type TokenBalance = { free: number; locked: number };

// POST /sapi/v3/asset/getUserAsset — weight: 5 (UID)
async function fetchSpot(apiKey: string, secret: string): Promise<Map<string, TokenBalance>> {
  const qs = makeSignedQuery(secret, { timestamp: Date.now() });
  const res = await fetch(`https://api.binance.com/sapi/v3/asset/getUserAsset?${qs}`, {
    method: "POST",
    headers: { "X-MBX-APIKEY": apiKey },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { msg?: string }).msg ?? `Spot API error ${res.status}`);
  }
  const data = (await res.json()) as Array<{
    asset: string;
    free: string;
    locked: string;
    freeze: string;
    withdrawing: string;
  }>;
  const map = new Map<string, TokenBalance>();
  for (const item of data) {
    const free =
      parseFloat(item.free || "0") +
      parseFloat(item.freeze || "0") +
      parseFloat(item.withdrawing || "0");
    const locked = parseFloat(item.locked || "0");
    if (free > 0 || locked > 0) map.set(item.asset, { free, locked });
  }
  return map;
}

// POST /sapi/v1/asset/get-funding-asset — weight: 1 (UID)
async function fetchFunding(apiKey: string, secret: string): Promise<Map<string, TokenBalance>> {
  const qs = makeSignedQuery(secret, { timestamp: Date.now() });
  const res = await fetch(`https://api.binance.com/sapi/v1/asset/get-funding-asset?${qs}`, {
    method: "POST",
    headers: { "X-MBX-APIKEY": apiKey },
    signal: AbortSignal.timeout(10000),
  });
  const map = new Map<string, TokenBalance>();
  if (!res.ok) return map;
  const data = await res.json();
  const items = Array.isArray(data) ? data : [];
  for (const item of items as Array<{ asset: string; free: string; locked: string; freeze?: string }>) {
    const free = parseFloat(item.free || "0") + parseFloat(item.freeze || "0");
    const locked = parseFloat(item.locked || "0");
    if (free > 0 || locked > 0) map.set(item.asset, { free, locked });
  }
  return map;
}

// GET /sapi/v1/simple-earn/flexible/position — weight: 150 per page (UID)
// Flexible earn is treated as free (instantly redeemable)
// Weight budget: 150 × pages. At 180k UID/min limit, even 10 pages = 1500 — well within limits.
async function fetchFlexibleEarn(apiKey: string, secret: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  let page = 1;
  while (true) {
    const qs = makeSignedQuery(secret, { timestamp: Date.now(), current: page, size: 100 });
    const res = await fetch(
      `https://api.binance.com/sapi/v1/simple-earn/flexible/position?${qs}`,
      { headers: { "X-MBX-APIKEY": apiKey }, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) break;
    const data = await res.json();
    const rows = (data.rows || []) as Array<{ asset: string; totalAmount: string }>;
    for (const row of rows) {
      const amt = parseFloat(row.totalAmount || "0");
      if (amt > 0) map.set(row.asset, (map.get(row.asset) || 0) + amt);
    }
    if (rows.length < 100 || page >= 5) break;
    page++;
  }
  return map;
}

// GET /sapi/v1/simple-earn/locked/position — weight: 150 per page (UID)
// Locked earn is treated as locked (cannot redeem before maturity)
async function fetchLockedEarn(apiKey: string, secret: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  let page = 1;
  while (true) {
    const qs = makeSignedQuery(secret, { timestamp: Date.now(), current: page, size: 10 });
    const res = await fetch(
      `https://api.binance.com/sapi/v1/simple-earn/locked/position?${qs}`,
      { headers: { "X-MBX-APIKEY": apiKey }, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) break;
    const data = await res.json();
    const rows = (data.rows || []) as Array<{ asset: string; amount: string }>;
    for (const row of rows) {
      const amt = parseFloat(row.amount || "0");
      if (amt > 0) map.set(row.asset, (map.get(row.asset) || 0) + amt);
    }
    if (rows.length < 10 || page >= 10) break;
    page++;
  }
  return map;
}

export async function POST(request: Request) {
  let userId: string | undefined;
  try {
    const body = await request.json();
    userId = body.userId;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  log.request("POST", "/api/binance/sync", { userId });

  try {
    await requireOwnedProfile(request, userId);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const credentials = decryptBinanceCredentials(user);
    if (!credentials) {
      return NextResponse.json({ error: "API key non configurata." }, { status: 400 });
    }

    const { apiKey, secret } = credentials;

    // All 4 endpoints in parallel — total weight: 5+1+150+150 = 306.
    // SAPI limits: 12000/min per IP, 180000/min per UID. No delay needed.
    const [spotMap, fundingMap, flexibleMap, lockedMap] = await Promise.all([
      fetchSpot(apiKey, secret),
      fetchFunding(apiKey, secret),
      fetchFlexibleEarn(apiKey, secret),
      fetchLockedEarn(apiKey, secret),
    ]);

    // Merge all sources into a unified per-symbol map
    const tokenMap = new Map<string, TokenBalance>();
    const add = (symbol: string, free: number, locked: number) => {
      const cur = tokenMap.get(symbol) ?? { free: 0, locked: 0 };
      tokenMap.set(symbol, { free: cur.free + free, locked: cur.locked + locked });
    };
    for (const [sym, bal] of spotMap) add(sym, bal.free, bal.locked);
    for (const [sym, bal] of fundingMap) add(sym, bal.free, bal.locked);
    for (const [sym, amt] of flexibleMap) add(sym, amt, 0);
    for (const [sym, amt] of lockedMap) add(sym, 0, amt);

    const nonZero = [...tokenMap.entries()].filter(([, b]) => b.free + b.locked > 0);

    // Fetch EUR prices in parallel (batched price lookups reuse EURUSDT fetch internally)
    const priceMap: Record<string, number> = {};
    await Promise.all(
      nonZero.map(async ([sym]) => {
        priceMap[sym] = await getEurPrice(sym);
      })
    );

    // Upsert each token
    for (const [sym, bal] of nonZero) {
      const total = bal.free + bal.locked;
      const eurValue = total * (priceMap[sym] ?? 0);
      await prisma.binanceBalance.upsert({
        where: { userId_tokenSymbol: { userId, tokenSymbol: sym } },
        update: {
          tokenName: TOKEN_NAMES[sym] ?? null,
          freeAmount: bal.free,
          lockedAmount: bal.locked,
          eurValue,
        },
        create: {
          userId,
          tokenSymbol: sym,
          tokenName: TOKEN_NAMES[sym] ?? null,
          freeAmount: bal.free,
          lockedAmount: bal.locked,
          eurValue,
        },
      });
    }

    // Remove tokens no longer held anywhere
    const activeSymbols = nonZero.map(([s]) => s);
    await prisma.binanceBalance.deleteMany({
      where: {
        userId,
        ...(activeSymbols.length > 0 ? { tokenSymbol: { notIn: activeSymbols } } : {}),
      },
    });

    // Record sync timestamp so the balances endpoint can report staleness
    const syncedAt = new Date();
    await prisma.priceCache.upsert({
      where: { key: `binance_sync_${userId}` },
      update: { timestamp: syncedAt },
      create: { key: `binance_sync_${userId}`, timestamp: syncedAt },
    });

    const balances = await prisma.binanceBalance.findMany({
      where: { userId },
      orderBy: { eurValue: "desc" },
    });

    log.response("POST", "/api/binance/sync", 200, { tokensFound: balances.length });
    return NextResponse.json({ success: true, balances, syncedAt: syncedAt.toISOString() });
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) return response;

    log.error("POST", "/api/binance/sync", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Errore di sincronizzazione Binance." },
      { status: 500 }
    );
  }
}
