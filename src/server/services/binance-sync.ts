import {
  fetchBalances,
  priceBalances,
  type BinanceFetch,
  type PricedBinanceBalance
} from "@/integrations/binance/binance-service";
import { isMaterialBinanceEurValue } from "@/domain/binance/materiality";
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
import {
  measurePerformanceStep,
  type PerformanceTrace
} from "@/server/logging/performance";

const STALE_MS = 10 * 60 * 1000;

export type BinanceSyncDependencies = {
  fetcher?: BinanceFetch;
  now?: () => Date;
  repository?: BinanceRepository;
  trace?: PerformanceTrace;
};

export type SyncBinanceBalancesResult = {
  balances: PersistedBinanceBalance[];
  syncedAt: Date;
};

function filterMaterialBalances<TBalance extends { eurValue: number }>(balances: TBalance[]) {
  return balances.filter((balance) => isMaterialBinanceEurValue(balance.eurValue));
}

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
  const materialBalances = filterMaterialBalances(balances);

  await measurePerformanceStep(
    dependencies.trace,
    "binance.repository.upsertBalances",
    async () => {
      for (const balance of materialBalances) {
        await repository.upsertBalance(userId, balance);
      }
    },
    { rows: materialBalances.length }
  );

  const activeSymbols = materialBalances.map((balance) => balance.tokenSymbol);
  await measurePerformanceStep(
    dependencies.trace,
    "binance.repository.deleteInactiveBalances",
    () => repository.deleteInactiveBalances(userId, activeSymbols),
    { activeSymbols: activeSymbols.length }
  );
  await measurePerformanceStep(
    dependencies.trace,
    "binance.repository.upsertSyncTimestamp",
    () => repository.upsertSyncTimestamp(userId, syncedAt)
  );

  const persistedBalances = await measurePerformanceStep(
    dependencies.trace,
    "binance.repository.listBalances",
    () => repository.listBalances(userId),
    (rows) => ({ rows: rows.length })
  );

  return { balances: persistedBalances, syncedAt };
}

export async function syncBinanceBalances(
  userId: string,
  credentials: BinanceCredentials,
  dependencies: BinanceSyncDependencies = {}
) {
  const balances = await measurePerformanceStep(
    dependencies.trace,
    "binance.external.fetchBalances",
    () => fetchBalances(credentials, dependencies),
    (rows) => ({ tokens: rows.size })
  );
  const pricedBalances = await measurePerformanceStep(
    dependencies.trace,
    "binance.external.priceBalances",
    () => priceBalances(balances, dependencies),
    (rows) => ({ tokens: rows.length })
  );

  return persistBalances(userId, pricedBalances, dependencies);
}

export async function syncBinanceProfile(
  userId: string,
  dependencies: BinanceSyncDependencies = {}
) {
  const repository = dependencies.repository ?? binanceRepository;
  const credentialRecord = await measurePerformanceStep(
    dependencies.trace,
    "binance.repository.getCredentialRecord",
    () => repository.getCredentialRecord(userId)
  );
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
    await measurePerformanceStep(
      dependencies.trace,
      "binance.repository.getBalanceStatusRecords",
      () => repository.getBalanceStatusRecords(userId),
      (result) => ({ balances: result.balances.length })
    );

  return {
    balances: filterMaterialBalances(balances),
    syncedAt: syncTimestamp,
    isStale: !syncTimestamp || now.getTime() - syncTimestamp.getTime() > STALE_MS,
    hasApiKey: hasBinanceCredentials(credentialRecord)
  };
}

export type { PersistedBinanceBalance };
