import type { BinanceBalanceRow, DashboardData } from "@/components/dashboard/types";
import type { CheckingData } from "@/components/checking-dashboard/types";
import type { PortfolioData } from "@/components/portfolio-dashboard/types";

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

type FetchDashboardStageDataOptions = {
  fallbackErrorMessage?: string;
  force?: boolean;
  signal?: AbortSignal;
  version?: number;
};

const dashboardStageEndpoints = {
  binance: "/api/binance/balances",
  checking: "/api/transactions/checking",
  crypto: "/api/transactions/crypto",
  dashboard: "/api/transactions/dashboard",
  investment: "/api/transactions/investment"
} satisfies Record<DashboardStageKey, string>;

const cacheTtlMs = 60_000;
const dashboardStageDataCache = new Map<string, DashboardStageDataEntry<unknown>>();

function getDashboardStageCacheKey(stage: DashboardStageKey, userId: string, version = 0) {
  return `${userId}:${stage}:${version}`;
}

function isFresh(entry: DashboardStageDataEntry<unknown> | undefined) {
  return !!entry?.data && Date.now() - entry.fetchedAt < cacheTtlMs;
}

export function isDashboardStageDataCacheFresh(
  stage: DashboardStageKey,
  userId: string,
  version = 0,
  maxAgeMs = cacheTtlMs
) {
  const entry = dashboardStageDataCache.get(getDashboardStageCacheKey(stage, userId, version));

  return !!entry?.data && Date.now() - entry.fetchedAt < maxAgeMs;
}

export function readDashboardStageDataCache<TStage extends DashboardStageKey>(
  stage: TStage,
  userId: string,
  version = 0
): DashboardStageDataMap[TStage] | null {
  const entry = dashboardStageDataCache.get(getDashboardStageCacheKey(stage, userId, version));

  if (!entry || !isFresh(entry) || entry.data === undefined) {
    return null;
  }

  return entry.data as DashboardStageDataMap[TStage];
}

export function seedDashboardStageDataCache<TStage extends DashboardStageKey>(
  stage: TStage,
  userId: string,
  version: number,
  data: DashboardStageDataMap[TStage],
  fetchedAt = Date.now()
) {
  dashboardStageDataCache.set(getDashboardStageCacheKey(stage, userId, version), {
    data,
    fetchedAt
  });
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
    if (existingEntry && isFresh(existingEntry) && existingEntry.data !== undefined) {
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
  const promise = fetch(`${endpoint}?${params.toString()}`, {
    cache: force ? "reload" : "default",
    signal
  })
    .then(async (response) => {
      const payload = await response.json().catch(() => ({})) as DashboardStageDataMap[TStage] & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? fallbackErrorMessage);
      }

      dashboardStageDataCache.set(cacheKey, {
        data: payload,
        fetchedAt: Date.now()
      });

      return payload;
    })
    .catch((error: unknown) => {
      dashboardStageDataCache.delete(cacheKey);
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
