import crypto from "node:crypto";

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
const SIGNED_REQUEST_RECV_WINDOW_MS = 60_000;
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

export type BinanceFetch = typeof fetch;

export type BinanceCredentials = {
  apiKey: string;
  secret: string;
};

export type BinanceServiceDependencies = {
  fetcher?: BinanceFetch;
  now?: () => Date;
  serverTime?: () => Promise<number>;
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

type BinanceTickerPrice = {
  symbol?: string;
  price?: string;
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
  const timestamp = await resolveSignedRequestTimestamp(fetcher, dependencies);

  // All 4 endpoints in parallel. Total regular-case weight: 5 + 1 + 150 + 150.
  const [spotMap, fundingMap, flexibleMap, lockedMap] = await Promise.all([
    fetchSpot(fetcher, apiKey, secret, timestamp),
    fetchFunding(fetcher, apiKey, secret, timestamp),
    fetchFlexibleEarn(fetcher, apiKey, secret, timestamp),
    fetchLockedEarn(fetcher, apiKey, secret, timestamp),
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

  const directEurPrice = await fetchTickerPrice(fetcher, `${normalizedSymbol}EUR`);
  if (directEurPrice !== null) return directEurPrice;

  if (USD_STABLES.has(normalizedSymbol)) {
    const eurUsdtPrice = await fetchTickerPrice(fetcher, "EURUSDT");
    if (eurUsdtPrice !== null) return 1 / eurUsdtPrice;

    return 1 / 1.08;
  }

  const [tokenPrice, eurUsdtPrice] = await Promise.all([
    fetchTickerPrice(fetcher, `${normalizedSymbol}USDT`),
    fetchTickerPrice(fetcher, "EURUSDT"),
  ]);
  if (tokenPrice !== null && eurUsdtPrice !== null) {
    return tokenPrice / eurUsdtPrice;
  }

  return 0;
}

export async function priceBalances(
  balances: Map<string, TokenBalance>,
  dependencies: BinanceServiceDependencies = {}
) {
  const fetcher = dependencies.fetcher ?? fetch;
  const entries = [...balances.entries()].filter(([, balance]) => balance.free + balance.locked > 0);
  const prices = new Map<string, number>();
  const tickerPrices = await fetchAllTickerPrices(fetcher);

  if (tickerPrices) {
    for (const [symbol] of entries) {
      prices.set(symbol, getEurPriceFromTickerMap(symbol, tickerPrices));
    }
  } else {
    await Promise.all(
      entries.map(async ([symbol]) => {
        prices.set(symbol, await getEurPrice(symbol, dependencies));
      })
    );
  }

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

function currentTimestamp(dependencies: BinanceServiceDependencies) {
  return (dependencies.now?.() ?? new Date()).getTime();
}

async function resolveSignedRequestTimestamp(
  fetcher: BinanceFetch,
  dependencies: BinanceServiceDependencies
) {
  if (dependencies.now) {
    return currentTimestamp(dependencies);
  }

  if (dependencies.serverTime) {
    const serverTime = await dependencies.serverTime();
    if (Number.isFinite(serverTime)) {
      return serverTime;
    }
  }

  try {
    const response = await fetcher(`${BINANCE_BASE_URL}/api/v3/time`, {
      signal: AbortSignal.timeout(PRICE_TIMEOUT_MS)
    });
    if (!response.ok) {
      return currentTimestamp(dependencies);
    }

    const data = (await response.json()) as { serverTime?: number };
    return Number.isFinite(data.serverTime) ? Number(data.serverTime) : currentTimestamp(dependencies);
  } catch {
    return currentTimestamp(dependencies);
  }
}

async function fetchSpot(
  fetcher: BinanceFetch,
  apiKey: string,
  secret: string,
  timestamp: number
) {
  const queryString = makeSignedQuery(secret, {
    timestamp,
    recvWindow: SIGNED_REQUEST_RECV_WINDOW_MS
  });
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
  timestamp: number
) {
  const queryString = makeSignedQuery(secret, {
    timestamp,
    recvWindow: SIGNED_REQUEST_RECV_WINDOW_MS
  });
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
  timestamp: number
) {
  const map = new Map<string, number>();
  let page = 1;

  while (true) {
    const queryString = makeSignedQuery(secret, {
      timestamp,
      recvWindow: SIGNED_REQUEST_RECV_WINDOW_MS,
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
  timestamp: number
) {
  const map = new Map<string, number>();
  let page = 1;

  while (true) {
    const queryString = makeSignedQuery(secret, {
      timestamp,
      recvWindow: SIGNED_REQUEST_RECV_WINDOW_MS,
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

async function fetchTickerPrice(fetcher: BinanceFetch, pairSymbol: string) {
  try {
    const response = await fetcher(
      `${BINANCE_BASE_URL}/api/v3/ticker/price?symbol=${pairSymbol}`,
      { signal: AbortSignal.timeout(PRICE_TIMEOUT_MS) }
    );
    if (!response.ok) return null;

    const data = (await response.json()) as { price?: string };
    return parsePositiveNumber(data.price);
  } catch {
    return null;
  }
}

async function fetchAllTickerPrices(fetcher: BinanceFetch) {
  try {
    const response = await fetcher(`${BINANCE_BASE_URL}/api/v3/ticker/price`, {
      signal: AbortSignal.timeout(PRICE_TIMEOUT_MS)
    });
    if (!response.ok) return null;

    const data = await response.json();
    if (!Array.isArray(data)) return null;

    const prices = new Map<string, number>();
    for (const item of data as BinanceTickerPrice[]) {
      if (!item.symbol) continue;

      const price = parsePositiveNumber(item.price);
      if (price !== null) {
        prices.set(item.symbol.toUpperCase(), price);
      }
    }

    return prices.size > 0 ? prices : null;
  } catch {
    return null;
  }
}

function getEurPriceFromTickerMap(symbol: string, prices: Map<string, number>) {
  const normalizedSymbol = symbol.toUpperCase();

  if (EUR_STABLES.has(normalizedSymbol)) return 1;

  const directEurPrice = prices.get(`${normalizedSymbol}EUR`);
  if (directEurPrice !== undefined) return directEurPrice;

  const eurUsdtPrice = prices.get("EURUSDT");
  if (USD_STABLES.has(normalizedSymbol)) {
    return eurUsdtPrice ? 1 / eurUsdtPrice : 1 / 1.08;
  }

  const tokenUsdtPrice = prices.get(`${normalizedSymbol}USDT`);
  if (tokenUsdtPrice !== undefined && eurUsdtPrice) {
    return tokenUsdtPrice / eurUsdtPrice;
  }

  return 0;
}

function parseNumber(value: string | null | undefined) {
  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePositiveNumber(value: string | null | undefined) {
  const parsed = parseNumber(value);
  return parsed > 0 ? parsed : null;
}
