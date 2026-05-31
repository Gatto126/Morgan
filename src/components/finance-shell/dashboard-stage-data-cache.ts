import type { BinanceBalanceRow, DashboardData } from "@/components/dashboard/types";
import type { CheckingData } from "@/components/checking-dashboard/types";
import type { PortfolioData } from "@/components/portfolio-dashboard/types";
import { getMillisecondsUntilNextUtcDate, getUtcDateKey } from "@/shared/date-keys";

import type { DashboardStageKey } from "./dashboard-stage-items";

type DashboardStageDataMap = {
  binance: { balances?: BinanceBalanceRow[]; hasApiKey?: boolean; isStale?: boolean; syncedAt?: string | null };
  checking: CheckingData;
  crypto: PortfolioData;
  dashboard: DashboardData;
  investment: PortfolioData;
};

type DashboardStageDataEntry<TData> = {
  data?: TData;
  fetchedAt: number;
  promise?: Promise<TData>;
};

type StoredDashboardStageDataEntry = {
  cacheVersion: 1;
  data: unknown;
  fetchedAt: number;
  stage: DashboardStageKey;
  userId: string;
  version: number;
};

type FetchDashboardStageDataOptions = {
  fallbackErrorMessage?: string;
  force?: boolean;
  signal?: AbortSignal;
  version?: number;
};

type ReadDashboardStageDataCacheOptions = {
  maxAgeMs?: number;
};

const dashboardStageEndpoints = {
  binance: "/api/binance/balances",
  checking: "/api/transactions/checking",
  crypto: "/api/transactions/crypto",
  dashboard: "/api/transactions/dashboard",
  investment: "/api/transactions/investment"
} satisfies Record<DashboardStageKey, string>;

const cacheTtlMs = 60_000;
const historicalStageFreshTtlBufferMs = 5 * 60_000;
const staleCacheTtlMs = 6 * 60 * 60 * 1_000;
const storageCachePrefix = "morgan:dashboard-stage-data:v1:";
const dashboardStageDataCache = new Map<string, DashboardStageDataEntry<unknown>>();

export const dashboardStageDataFreshTtlMs = cacheTtlMs;

export function getDashboardStageCacheDateKey(stage: DashboardStageKey, date = new Date()) {
  return stage === "binance" ? "live" : getUtcDateKey(date);
}

function getDashboardStageFreshTtlMs(stage: DashboardStageKey) {
  if (stage === "binance") {
    return cacheTtlMs;
  }

  return Math.max(
    cacheTtlMs,
    getMillisecondsUntilNextUtcDate() + historicalStageFreshTtlBufferMs
  );
}

function getDashboardStageCacheKey(stage: DashboardStageKey, userId: string, version = 0) {
  return `${userId}:${stage}:${version}:${getDashboardStageCacheDateKey(stage)}`;
}

function isFresh(entry: DashboardStageDataEntry<unknown> | undefined, stage: DashboardStageKey) {
  return !!entry?.data && Date.now() - entry.fetchedAt < getDashboardStageFreshTtlMs(stage);
}

function isUsableEntry(entry: DashboardStageDataEntry<unknown> | undefined, maxAgeMs = staleCacheTtlMs) {
  return !!entry?.data && Date.now() - entry.fetchedAt < maxAgeMs;
}

function getSessionStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function readStoredDashboardStageData(
  cacheKey: string,
  maxAgeMs = staleCacheTtlMs
): DashboardStageDataEntry<unknown> | null {
  const storage = getSessionStorage();
  if (!storage) {
    return null;
  }

  const storageKey = `${storageCachePrefix}${cacheKey}`;
  const rawEntry = storage.getItem(storageKey);
  if (!rawEntry) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawEntry) as Partial<StoredDashboardStageDataEntry>;
    const fetchedAt = parsed.fetchedAt;
    const isSameEntry = parsed.cacheVersion === 1
      && typeof fetchedAt === "number"
      && parsed.data !== undefined;

    if (!isSameEntry || Date.now() - fetchedAt >= staleCacheTtlMs) {
      storage.removeItem(storageKey);
      return null;
    }

    if (Date.now() - fetchedAt >= maxAgeMs) {
      return null;
    }

    return {
      data: parsed.data,
      fetchedAt
    };
  } catch {
    storage.removeItem(storageKey);
    return null;
  }
}

function writeStoredDashboardStageData(
  cacheKey: string,
  stage: DashboardStageKey,
  userId: string,
  version: number,
  data: unknown,
  fetchedAt: number
) {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  try {
    const entry: StoredDashboardStageDataEntry = {
      cacheVersion: 1,
      data,
      fetchedAt,
      stage,
      userId,
      version
    };
    storage.setItem(`${storageCachePrefix}${cacheKey}`, JSON.stringify(entry));
  } catch {
    // Private cache persistence is best-effort; memory cache still covers same-page navigation.
  }
}

export function isDashboardStageDataCacheFresh(
  stage: DashboardStageKey,
  userId: string,
  version = 0,
  maxAgeMs?: number
) {
  const entry = dashboardStageDataCache.get(getDashboardStageCacheKey(stage, userId, version));

  return !!entry?.data && Date.now() - entry.fetchedAt < (maxAgeMs ?? getDashboardStageFreshTtlMs(stage));
}

export function readDashboardStageDataCache<TStage extends DashboardStageKey>(
  stage: TStage,
  userId: string,
  version = 0,
  { maxAgeMs = staleCacheTtlMs }: ReadDashboardStageDataCacheOptions = {}
): DashboardStageDataMap[TStage] | null {
  const cacheKey = getDashboardStageCacheKey(stage, userId, version);
  const entry = dashboardStageDataCache.get(cacheKey);

  if (isUsableEntry(entry, maxAgeMs) && entry?.data !== undefined) {
    return entry.data as DashboardStageDataMap[TStage];
  }

  const storedEntry = readStoredDashboardStageData(cacheKey, maxAgeMs);
  if (storedEntry?.data !== undefined) {
    dashboardStageDataCache.set(cacheKey, storedEntry);
    return storedEntry.data as DashboardStageDataMap[TStage];
  }

  return null;
}

export function seedDashboardStageDataCache<TStage extends DashboardStageKey>(
  stage: TStage,
  userId: string,
  version: number,
  data: DashboardStageDataMap[TStage],
  fetchedAt = Date.now()
) {
  const cacheKey = getDashboardStageCacheKey(stage, userId, version);

  dashboardStageDataCache.set(cacheKey, {
    data,
    fetchedAt
  });
  writeStoredDashboardStageData(cacheKey, stage, userId, version, data, fetchedAt);
}

export async function fetchDashboardStageData<TStage extends DashboardStageKey>(
  stage: TStage,
  userId: string,
  {
    fallbackErrorMessage = "Could not load dashboard data.",
    force = false,
    signal,
    version = 0
  }: FetchDashboardStageDataOptions = {}
): Promise<DashboardStageDataMap[TStage]> {
  const cacheKey = getDashboardStageCacheKey(stage, userId, version);
  const existingEntry = dashboardStageDataCache.get(cacheKey);

  if (!force) {
    if (existingEntry && isFresh(existingEntry, stage) && existingEntry.data !== undefined) {
      return existingEntry.data as DashboardStageDataMap[TStage];
    }

    if (existingEntry?.promise) {
      const { promise } = existingEntry;
      return promise as Promise<DashboardStageDataMap[TStage]>;
    }
  }

  const endpoint = dashboardStageEndpoints[stage];
  const params = new URLSearchParams({
    userId,
    v: String(version)
  });
  const cacheDateKey = getDashboardStageCacheDateKey(stage);
  if (cacheDateKey !== "live") {
    params.set("d", cacheDateKey);
  }
  const promise = fetch(`${endpoint}?${params.toString()}`, {
    cache: force ? "reload" : "default",
    signal
  })
    .then(async (response) => {
      const payload = await response.json().catch(() => ({})) as DashboardStageDataMap[TStage] & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? fallbackErrorMessage);
      }

      const fetchedAt = Date.now();
      dashboardStageDataCache.set(cacheKey, {
        data: payload,
        fetchedAt
      });
      writeStoredDashboardStageData(cacheKey, stage, userId, version, payload, fetchedAt);

      return payload;
    })
    .catch((error: unknown) => {
      if (existingEntry?.data !== undefined) {
        dashboardStageDataCache.set(cacheKey, {
          data: existingEntry.data,
          fetchedAt: existingEntry.fetchedAt
        });
      } else {
        dashboardStageDataCache.delete(cacheKey);
      }
      throw error;
    });

  dashboardStageDataCache.set(cacheKey, {
    data: force ? undefined : existingEntry?.data,
    fetchedAt: existingEntry?.fetchedAt ?? 0,
    promise
  });

  return promise;
}

export function prefetchDashboardStageData<TStage extends DashboardStageKey>(
  stage: TStage,
  userId: string,
  options: Omit<FetchDashboardStageDataOptions, "force" | "signal"> = {}
) {
  void fetchDashboardStageData(stage, userId, options).catch(() => {
    // Prefetch is opportunistic. The active view will surface errors if it needs the data.
  });
}
