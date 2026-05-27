import crypto from "node:crypto";

import { prisma } from "@/lib/db";
import type { BinanceCredentials } from "@/lib/secrets";

export const TOKEN_NAMES: Record<string, string> = {
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

const BINANCE_BASE_URL = "https://api.binance.com";
const PRICE_TIMEOUT_MS = 5_000;
const ACCOUNT_TIMEOUT_MS = 10_000;
const EUR_STABLES = new Set(["EURL", "EURS", "SEUR", "EURC", "EURI"]);
const USD_STABLES = new Set(["USDT", "USDC", "BUSD", "DAI", "TUSD", "USDP", "GUSD"]);

export type TokenBalance = {
  free: number;
  locked: number;
};

export type PricedBinanceBalance = {
  tokenSymbol: string;
  tokenName: string | null;
  freeAmount: number;
  lockedAmount: number;
  eurValue: number;
};

export type PersistedBinanceBalance = PricedBinanceBalance & {
  id: string;
  userId: string;
  updatedAt: Date;
};

export type BinanceFetch = typeof fetch;
export type BinanceServiceStore = Pick<typeof prisma, "binanceBalance" | "priceCache">;

export type BinanceServiceDependencies = {
  fetcher?: BinanceFetch;
  now?: () => Date;
  store?: BinanceServiceStore;
};

export type SyncBinanceBalancesResult = {
  balances: PersistedBinanceBalance[];
  syncedAt: Date;
};

type SpotAsset = {
  asset: string;
  free?: string;
  locked?: string;
  freeze?: string;
  withdrawing?: string;
};

type EarnPage<T> = {
  rows?: T[];
};

export class BinanceApiError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
    this.name = "BinanceApiError";
  }
}

export function makeSignedQuery(secret: string, params: Record<string, string | number>) {
  const queryString = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)])
  ).toString();
  const signature = crypto.createHmac("sha256", secret).update(queryString).digest("hex");

  return `${queryString}&signature=${signature}`;
}

export function mergeBalances(sources: Array<Map<string, TokenBalance>>) {
  const tokenMap = new Map<string, TokenBalance>();

  const add = (symbol: string, free: number, locked: number) => {
    if (free + locked <= 0) return;

    const normalizedSymbol = symbol.toUpperCase();
    const current = tokenMap.get(normalizedSymbol) ?? { free: 0, locked: 0 };
    tokenMap.set(normalizedSymbol, {
      free: current.free + free,
      locked: current.locked + locked,
    });
  };

  for (const source of sources) {
    for (const [symbol, balance] of source) {
      add(symbol, balance.free, balance.locked);
    }
  }

  return tokenMap;
}

export async function fetchBalances(
  credentials: BinanceCredentials,
  dependencies: BinanceServiceDependencies = {}
) {
  const fetcher = dependencies.fetcher ?? fetch;
  const { apiKey, secret } = credentials;

  // All 4 endpoints in parallel. Total regular-case weight: 5 + 1 + 150 + 150.
  const [spotMap, fundingMap, flexibleMap, lockedMap] = await Promise.all([
    fetchSpot(fetcher, apiKey, secret, dependencies),
    fetchFunding(fetcher, apiKey, secret, dependencies),
    fetchFlexibleEarn(fetcher, apiKey, secret, dependencies),
    fetchLockedEarn(fetcher, apiKey, secret, dependencies),
  ]);

  const flexibleBalances = new Map<string, TokenBalance>();
  for (const [symbol, amount] of flexibleMap) {
    flexibleBalances.set(symbol, { free: amount, locked: 0 });
  }

  const lockedBalances = new Map<string, TokenBalance>();
  for (const [symbol, amount] of lockedMap) {
    lockedBalances.set(symbol, { free: 0, locked: amount });
  }

  return mergeBalances([spotMap, fundingMap, flexibleBalances, lockedBalances]);
}

export async function getEurPrice(
  symbol: string,
  dependencies: BinanceServiceDependencies = {}
): Promise<number> {
  const fetcher = dependencies.fetcher ?? fetch;
  const normalizedSymbol = symbol.toUpperCase();

  if (EUR_STABLES.has(normalizedSymbol)) return 1;

  try {
    const eurPairRes = await fetcher(
      `${BINANCE_BASE_URL}/api/v3/ticker/price?symbol=${normalizedSymbol}EUR`,
      { signal: AbortSignal.timeout(PRICE_TIMEOUT_MS) }
    );
    if (eurPairRes.ok) {
      const data = (await eurPairRes.json()) as { price?: string };
      const price = parsePositiveNumber(data.price);
      if (price !== null) return price;
    }
  } catch {}

  if (USD_STABLES.has(normalizedSymbol)) {
    try {
      const res = await fetcher(`${BINANCE_BASE_URL}/api/v3/ticker/price?symbol=EURUSDT`, {
        signal: AbortSignal.timeout(PRICE_TIMEOUT_MS),
      });
      if (res.ok) {
        const data = (await res.json()) as { price?: string };
        const eurUsdtPrice = parsePositiveNumber(data.price);
        if (eurUsdtPrice !== null) return 1 / eurUsdtPrice;
      }
    } catch {}

    return 1 / 1.08;
  }

  try {
    const [tokenRes, eurRes] = await Promise.all([
      fetcher(`${BINANCE_BASE_URL}/api/v3/ticker/price?symbol=${normalizedSymbol}USDT`, {
        signal: AbortSignal.timeout(PRICE_TIMEOUT_MS),
      }),
      fetcher(`${BINANCE_BASE_URL}/api/v3/ticker/price?symbol=EURUSDT`, {
        signal: AbortSignal.timeout(PRICE_TIMEOUT_MS),
      }),
    ]);
    if (tokenRes.ok && eurRes.ok) {
      const tokenData = (await tokenRes.json()) as { price?: string };
      const eurData = (await eurRes.json()) as { price?: string };
      const tokenPrice = parsePositiveNumber(tokenData.price);
      const eurUsdtPrice = parsePositiveNumber(eurData.price);
      if (tokenPrice !== null && eurUsdtPrice !== null) {
        return tokenPrice / eurUsdtPrice;
      }
    }
  } catch {}

  return 0;
}

export async function priceBalances(
  balances: Map<string, TokenBalance>,
  dependencies: BinanceServiceDependencies = {}
) {
  const entries = [...balances.entries()].filter(([, balance]) => balance.free + balance.locked > 0);
  const prices = new Map<string, number>();

  await Promise.all(
    entries.map(async ([symbol]) => {
      prices.set(symbol, await getEurPrice(symbol, dependencies));
    })
  );

  return entries.map(([symbol, balance]) => {
    const total = balance.free + balance.locked;

    return {
      tokenSymbol: symbol,
      tokenName: TOKEN_NAMES[symbol] ?? null,
      freeAmount: balance.free,
      lockedAmount: balance.locked,
      eurValue: total * (prices.get(symbol) ?? 0),
    };
  });
}

export async function persistBalances(
  userId: string,
  balances: PricedBinanceBalance[],
  dependencies: BinanceServiceDependencies = {}
): Promise<SyncBinanceBalancesResult> {
  const store = dependencies.store ?? prisma;
  const syncedAt = dependencies.now?.() ?? new Date();

  for (const balance of balances) {
    await store.binanceBalance.upsert({
      where: { userId_tokenSymbol: { userId, tokenSymbol: balance.tokenSymbol } },
      update: {
        tokenName: balance.tokenName,
        freeAmount: balance.freeAmount,
        lockedAmount: balance.lockedAmount,
        eurValue: balance.eurValue,
      },
      create: {
        userId,
        tokenSymbol: balance.tokenSymbol,
        tokenName: balance.tokenName,
        freeAmount: balance.freeAmount,
        lockedAmount: balance.lockedAmount,
        eurValue: balance.eurValue,
      },
    });
  }

  const activeSymbols = balances.map((balance) => balance.tokenSymbol);
  await store.binanceBalance.deleteMany({
    where: activeSymbols.length > 0
      ? { userId, tokenSymbol: { notIn: activeSymbols } }
      : { userId },
  });

  const syncKey = `binance_sync_${userId}`;
  await store.priceCache.upsert({
    where: { key: syncKey },
    update: { timestamp: syncedAt },
    create: { key: syncKey, timestamp: syncedAt },
  });

  const persistedBalances = await store.binanceBalance.findMany({
    where: { userId },
    orderBy: { eurValue: "desc" },
  });

  return { balances: persistedBalances, syncedAt };
}

export async function syncBinanceBalances(
  userId: string,
  credentials: BinanceCredentials,
  dependencies: BinanceServiceDependencies = {}
) {
  const balances = await fetchBalances(credentials, dependencies);
  const pricedBalances = await priceBalances(balances, dependencies);

  return persistBalances(userId, pricedBalances, dependencies);
}

function currentTimestamp(dependencies: BinanceServiceDependencies) {
  return (dependencies.now?.() ?? new Date()).getTime();
}

async function fetchSpot(
  fetcher: BinanceFetch,
  apiKey: string,
  secret: string,
  dependencies: BinanceServiceDependencies
) {
  const queryString = makeSignedQuery(secret, { timestamp: currentTimestamp(dependencies) });
  const res = await fetcher(`${BINANCE_BASE_URL}/sapi/v3/asset/getUserAsset?${queryString}`, {
    method: "POST",
    headers: { "X-MBX-APIKEY": apiKey },
    signal: AbortSignal.timeout(ACCOUNT_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new BinanceApiError(await readBinanceError(res, `Spot API error ${res.status}`));
  }

  const data = (await res.json()) as SpotAsset[];
  const map = new Map<string, TokenBalance>();

  for (const item of data) {
    const free =
      parseNumber(item.free) + parseNumber(item.freeze) + parseNumber(item.withdrawing);
    const locked = parseNumber(item.locked);
    if (free > 0 || locked > 0) map.set(item.asset, { free, locked });
  }

  return map;
}

async function fetchFunding(
  fetcher: BinanceFetch,
  apiKey: string,
  secret: string,
  dependencies: BinanceServiceDependencies
) {
  const queryString = makeSignedQuery(secret, { timestamp: currentTimestamp(dependencies) });
  const res = await fetcher(
    `${BINANCE_BASE_URL}/sapi/v1/asset/get-funding-asset?${queryString}`,
    {
      method: "POST",
      headers: { "X-MBX-APIKEY": apiKey },
      signal: AbortSignal.timeout(ACCOUNT_TIMEOUT_MS),
    }
  );

  const map = new Map<string, TokenBalance>();
  if (!res.ok) return map;

  const data = await res.json();
  const items = Array.isArray(data) ? (data as SpotAsset[]) : [];

  for (const item of items) {
    const free = parseNumber(item.free) + parseNumber(item.freeze);
    const locked = parseNumber(item.locked);
    if (free > 0 || locked > 0) map.set(item.asset, { free, locked });
  }

  return map;
}

async function fetchFlexibleEarn(
  fetcher: BinanceFetch,
  apiKey: string,
  secret: string,
  dependencies: BinanceServiceDependencies
) {
  const map = new Map<string, number>();
  let page = 1;

  while (true) {
    const queryString = makeSignedQuery(secret, {
      timestamp: currentTimestamp(dependencies),
      current: page,
      size: 100,
    });
    const res = await fetcher(
      `${BINANCE_BASE_URL}/sapi/v1/simple-earn/flexible/position?${queryString}`,
      {
        headers: { "X-MBX-APIKEY": apiKey },
        signal: AbortSignal.timeout(ACCOUNT_TIMEOUT_MS),
      }
    );

    if (!res.ok) break;

    const data = (await res.json()) as EarnPage<{ asset: string; totalAmount?: string }>;
    const rows = data.rows ?? [];
    for (const row of rows) {
      const amount = parseNumber(row.totalAmount);
      if (amount > 0) map.set(row.asset, (map.get(row.asset) ?? 0) + amount);
    }

    if (rows.length < 100 || page >= 5) break;
    page++;
  }

  return map;
}

async function fetchLockedEarn(
  fetcher: BinanceFetch,
  apiKey: string,
  secret: string,
  dependencies: BinanceServiceDependencies
) {
  const map = new Map<string, number>();
  let page = 1;

  while (true) {
    const queryString = makeSignedQuery(secret, {
      timestamp: currentTimestamp(dependencies),
      current: page,
      size: 10,
    });
    const res = await fetcher(
      `${BINANCE_BASE_URL}/sapi/v1/simple-earn/locked/position?${queryString}`,
      {
        headers: { "X-MBX-APIKEY": apiKey },
        signal: AbortSignal.timeout(ACCOUNT_TIMEOUT_MS),
      }
    );

    if (!res.ok) break;

    const data = (await res.json()) as EarnPage<{ asset: string; amount?: string }>;
    const rows = data.rows ?? [];
    for (const row of rows) {
      const amount = parseNumber(row.amount);
      if (amount > 0) map.set(row.asset, (map.get(row.asset) ?? 0) + amount);
    }

    if (rows.length < 10 || page >= 10) break;
    page++;
  }

  return map;
}

async function readBinanceError(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { msg?: string };
    return data.msg ?? fallback;
  } catch {
    return fallback;
  }
}

function parseNumber(value: string | null | undefined) {
  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePositiveNumber(value: string | null | undefined) {
  const parsed = parseNumber(value);
  return parsed > 0 ? parsed : null;
}
