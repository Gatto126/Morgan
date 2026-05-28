import {
  fetchBalances,
  priceBalances,
  type BinanceFetch,
  type PricedBinanceBalance
} from "@/integrations/binance/binance-service";
import { prisma } from "@/server/db/prisma";
import {
  decryptBinanceCredentials,
  hasBinanceCredentials,
  type BinanceCredentials
} from "@/server/security/secrets";

const STALE_MS = 10 * 60 * 1000;

export type PersistedBinanceBalance = PricedBinanceBalance & {
  id: string;
  userId: string;
  updatedAt: Date;
};

export type BinanceSyncStore = Pick<typeof prisma, "binanceBalance" | "priceCache" | "user">;

export type BinanceSyncDependencies = {
  fetcher?: BinanceFetch;
  now?: () => Date;
  store?: BinanceSyncStore;
};

export type SyncBinanceBalancesResult = {
  balances: PersistedBinanceBalance[];
  syncedAt: Date;
};

export class BinanceMissingCredentialsError extends Error {
  constructor(message = "API key non configurata.") {
    super(message);
    this.name = "BinanceMissingCredentialsError";
  }
}

export async function persistBalances(
  userId: string,
  balances: PricedBinanceBalance[],
  dependencies: BinanceSyncDependencies = {}
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

  return { balances: persistedBalances as PersistedBinanceBalance[], syncedAt };
}

export async function syncBinanceBalances(
  userId: string,
  credentials: BinanceCredentials,
  dependencies: BinanceSyncDependencies = {}
) {
  const balances = await fetchBalances(credentials, dependencies);
  const pricedBalances = await priceBalances(balances, dependencies);

  return persistBalances(userId, pricedBalances, dependencies);
}

export async function syncBinanceProfile(
  userId: string,
  dependencies: BinanceSyncDependencies = {}
) {
  const store = dependencies.store ?? prisma;
  const user = await store.user.findUnique({ where: { id: userId } });
  const credentials = decryptBinanceCredentials(user);

  if (!credentials) {
    throw new BinanceMissingCredentialsError();
  }

  return syncBinanceBalances(userId, credentials, dependencies);
}

export async function getBinanceBalancesStatus(
  userId: string,
  dependencies: BinanceSyncDependencies = {}
) {
  const store = dependencies.store ?? prisma;
  const now = dependencies.now?.() ?? new Date();
  const [balances, syncCache, user] = await Promise.all([
    store.binanceBalance.findMany({
      where: { userId },
      orderBy: { eurValue: "desc" },
    }),
    store.priceCache.findUnique({ where: { key: `binance_sync_${userId}` } }),
    store.user.findUnique({
      where: { id: userId },
      select: {
        binanceApiKeyEncrypted: true,
        binanceApiSecretEncrypted: true,
      },
    }),
  ]);

  const syncedAt = syncCache?.timestamp ?? null;

  return {
    balances: balances as PersistedBinanceBalance[],
    syncedAt,
    isStale: !syncedAt || now.getTime() - syncedAt.getTime() > STALE_MS,
    hasApiKey: hasBinanceCredentials(user)
  };
}
