import {
  fetchBalances,
  priceBalances,
  type BinanceFetch,
  type PricedBinanceBalance
} from "@/integrations/binance/binance-service";
import {
  binanceRepository,
  type BinanceRepository,
  type PersistedBinanceBalance
} from "@/server/repositories/binance-repository";
import {
  decryptBinanceCredentials,
  hasBinanceCredentials,
  type BinanceCredentials
} from "@/server/security/secrets";

const STALE_MS = 10 * 60 * 1000;

export type BinanceSyncDependencies = {
  fetcher?: BinanceFetch;
  now?: () => Date;
  repository?: BinanceRepository;
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
  const repository = dependencies.repository ?? binanceRepository;
  const syncedAt = dependencies.now?.() ?? new Date();

  for (const balance of balances) {
    await repository.upsertBalance(userId, balance);
  }

  const activeSymbols = balances.map((balance) => balance.tokenSymbol);
  await repository.deleteInactiveBalances(userId, activeSymbols);
  await repository.upsertSyncTimestamp(userId, syncedAt);

  const persistedBalances = await repository.listBalances(userId);

  return { balances: persistedBalances, syncedAt };
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
  const repository = dependencies.repository ?? binanceRepository;
  const credentialRecord = await repository.getCredentialRecord(userId);
  const credentials = decryptBinanceCredentials(credentialRecord);

  if (!credentials) {
    throw new BinanceMissingCredentialsError();
  }

  return syncBinanceBalances(userId, credentials, dependencies);
}

export async function getBinanceBalancesStatus(
  userId: string,
  dependencies: BinanceSyncDependencies = {}
) {
  const repository = dependencies.repository ?? binanceRepository;
  const now = dependencies.now?.() ?? new Date();
  const { balances, syncTimestamp, credentialRecord } =
    await repository.getBalanceStatusRecords(userId);

  return {
    balances,
    syncedAt: syncTimestamp,
    isStale: !syncTimestamp || now.getTime() - syncTimestamp.getTime() > STALE_MS,
    hasApiKey: hasBinanceCredentials(credentialRecord)
  };
}

export type { PersistedBinanceBalance };
