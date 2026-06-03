import {
  fetchBalances,
  priceBalances,
  type BinanceFetch,
  type BinanceServiceDependencies,
  type PricedBinanceBalance
} from "@/integrations/binance/binance-service";
import {
  binanceDailySnapshotRepository,
  type BinanceDailySnapshotProfile,
  type BinanceDailySnapshotRepository,
  type BinanceDailySnapshotSummary,
  type BinanceDailySnapshotTokenInput
} from "@/server/repositories/binance-daily-snapshot-repository";
import { decryptBinanceCredentials } from "@/server/security/secrets";
import {
  measurePerformanceStep,
  type PerformanceTrace
} from "@/server/logging/performance";

export const BINANCE_DAILY_SNAPSHOT_TIME_ZONE = "Europe/Rome";

export type BinanceDailySnapshotStatus =
  | "created"
  | "failed"
  | "skipped-existing"
  | "skipped-missing-credentials";

export type BinanceDailySnapshotProfileResult = {
  dateKey: string;
  error?: string;
  profileName: string;
  snapshotId?: string;
  status: BinanceDailySnapshotStatus;
  tokenCount: number;
  totalEurValue: number;
  userId: string;
};

export type BinanceDailySnapshotBatchResult = {
  created: number;
  dateKey: string;
  failed: number;
  results: BinanceDailySnapshotProfileResult[];
  skippedExisting: number;
  skippedMissingCredentials: number;
  snapshotAt: string;
  totalProfiles: number;
};

export type BinanceDailySnapshotDependencies = BinanceServiceDependencies & {
  fetcher?: BinanceFetch;
  now?: () => Date;
  repository?: BinanceDailySnapshotRepository;
  trace?: PerformanceTrace;
};

type CreateProfileSnapshotOptions = BinanceDailySnapshotDependencies & {
  dateKey?: string;
  snapshotAt?: Date;
};

export function getBinanceDailySnapshotDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: BINANCE_DAILY_SNAPSHOT_TIME_ZONE,
    year: "numeric"
  }).formatToParts(now);
  const byType = new Map(parts.map((part) => [part.type, part.value]));

  return `${byType.get("year")}-${byType.get("month")}-${byType.get("day")}`;
}

function toSnapshotToken(balance: PricedBinanceBalance): BinanceDailySnapshotTokenInput {
  const totalAmount = balance.freeAmount + balance.lockedAmount;

  return {
    eurPrice: totalAmount > 0 ? balance.eurValue / totalAmount : 0,
    eurValue: balance.eurValue,
    freeAmount: balance.freeAmount,
    lockedAmount: balance.lockedAmount,
    tokenName: balance.tokenName,
    tokenSymbol: balance.tokenSymbol,
    totalAmount
  };
}

function summarizeExistingSnapshot(
  profile: BinanceDailySnapshotProfile,
  snapshot: BinanceDailySnapshotSummary
): BinanceDailySnapshotProfileResult {
  return {
    dateKey: snapshot.dateKey,
    profileName: profile.name,
    snapshotId: snapshot.id,
    status: "skipped-existing",
    tokenCount: snapshot.tokenCount,
    totalEurValue: snapshot.totalEurValue,
    userId: profile.id
  };
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Errore sconosciuto.";
}

function countStatus(results: BinanceDailySnapshotProfileResult[], status: BinanceDailySnapshotStatus) {
  return results.filter((result) => result.status === status).length;
}

export async function createBinanceDailySnapshotForProfile(
  profile: BinanceDailySnapshotProfile,
  options: CreateProfileSnapshotOptions = {}
): Promise<BinanceDailySnapshotProfileResult> {
  const repository = options.repository ?? binanceDailySnapshotRepository;
  const snapshotAt = options.snapshotAt ?? options.now?.() ?? new Date();
  const dateKey = options.dateKey ?? getBinanceDailySnapshotDateKey(snapshotAt);

  const existing = await measurePerformanceStep(
    options.trace,
    "binanceDailySnapshot.repository.findSnapshot",
    () => repository.findSnapshot(profile.id, dateKey)
  );
  if (existing) {
    return summarizeExistingSnapshot(profile, existing);
  }

  const credentials = decryptBinanceCredentials(profile);
  if (!credentials) {
    return {
      dateKey,
      profileName: profile.name,
      status: "skipped-missing-credentials",
      tokenCount: 0,
      totalEurValue: 0,
      userId: profile.id
    };
  }

  const rawBalances = await measurePerformanceStep(
    options.trace,
    "binanceDailySnapshot.external.fetchBalances",
    () => fetchBalances(credentials, options),
    (balances) => ({ tokens: balances.size })
  );
  const pricedBalances = await measurePerformanceStep(
    options.trace,
    "binanceDailySnapshot.external.priceBalances",
    () => priceBalances(rawBalances, options),
    (balances) => ({ tokens: balances.length })
  );

  const tokens = pricedBalances
    .map(toSnapshotToken)
    .sort((first, second) => {
      const valueDelta = second.eurValue - first.eurValue;
      return valueDelta !== 0 ? valueDelta : first.tokenSymbol.localeCompare(second.tokenSymbol);
    });
  const totalEurValue = tokens.reduce((total, token) => total + token.eurValue, 0);

  const snapshot = await measurePerformanceStep(
    options.trace,
    "binanceDailySnapshot.repository.createSnapshot",
    () => repository.createSnapshot({
      dateKey,
      snapshotAt,
      tokens,
      totalEurValue,
      userId: profile.id
    }),
    (result) => ({ created: result.created, tokens: result.tokenCount })
  );

  return {
    dateKey: snapshot.dateKey,
    profileName: profile.name,
    snapshotId: snapshot.id,
    status: snapshot.created ? "created" : "skipped-existing",
    tokenCount: snapshot.tokenCount,
    totalEurValue: snapshot.totalEurValue,
    userId: snapshot.userId
  };
}

export async function createBinanceDailySnapshotsForAllProfiles(
  dependencies: BinanceDailySnapshotDependencies = {}
): Promise<BinanceDailySnapshotBatchResult> {
  const repository = dependencies.repository ?? binanceDailySnapshotRepository;
  const snapshotAt = dependencies.now?.() ?? new Date();
  const dateKey = getBinanceDailySnapshotDateKey(snapshotAt);
  const profiles = await measurePerformanceStep(
    dependencies.trace,
    "binanceDailySnapshot.repository.listProfilesWithBinanceCredentials",
    () => repository.listProfilesWithBinanceCredentials(),
    (rows) => ({ profiles: rows.length })
  );
  const results: BinanceDailySnapshotProfileResult[] = [];

  for (const profile of profiles) {
    try {
      const result = await createBinanceDailySnapshotForProfile(profile, {
        ...dependencies,
        dateKey,
        snapshotAt,
        repository
      });
      results.push(result);
    } catch (error) {
      results.push({
        dateKey,
        error: toErrorMessage(error),
        profileName: profile.name,
        status: "failed",
        tokenCount: 0,
        totalEurValue: 0,
        userId: profile.id
      });
    }
  }

  return {
    created: countStatus(results, "created"),
    dateKey,
    failed: countStatus(results, "failed"),
    results,
    skippedExisting: countStatus(results, "skipped-existing"),
    skippedMissingCredentials: countStatus(results, "skipped-missing-credentials"),
    snapshotAt: snapshotAt.toISOString(),
    totalProfiles: profiles.length
  };
}
