"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { AccountTab, DashboardData, DailyBucket, MonthlyBucket } from "./types";

type DashboardSeriesTab = Exclude<AccountTab, "heritage">;

type DashboardSeriesData = {
  series: DashboardSeriesTab;
  monthlyData: MonthlyBucket[];
  dailyData: DailyBucket[];
};

type UseDashboardSeriesDataParams = {
  activeTab: AccountTab;
  data: DashboardData | null;
  shouldLoad: boolean;
  userId: string;
};

const dashboardSeriesCache = new Map<string, DashboardSeriesData>();
const inFlightDashboardSeries = new Map<string, Promise<DashboardSeriesData>>();
const seriesTabs: DashboardSeriesTab[] = ["checking", "investment", "crypto"];

function getSeriesCacheKey(userId: string, dataVersion: string, series: DashboardSeriesTab) {
  return `${userId}:${dataVersion}:${series}`;
}

async function fetchDashboardSeries(userId: string, dataVersion: string, series: DashboardSeriesTab) {
  const cacheKey = getSeriesCacheKey(userId, dataVersion, series);
  const cached = dashboardSeriesCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const inFlight = inFlightDashboardSeries.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const request = fetch(`/api/transactions/dashboard/series?userId=${userId}&series=${series}`, {
    cache: "no-store"
  })
    .then(async (response) => {
      const payload = await response.json() as DashboardSeriesData & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Errore durante il caricamento delle serie.");
      }

      dashboardSeriesCache.set(cacheKey, payload);
      return payload;
    })
    .finally(() => {
      inFlightDashboardSeries.delete(cacheKey);
    });

  inFlightDashboardSeries.set(cacheKey, request);
  return request;
}

function mergeBucketDetails<TBucket extends MonthlyBucket | DailyBucket>(
  bucket: TBucket,
  detailBuckets: Array<TBucket | undefined>
) {
  const mergedBucket = { ...bucket };

  for (const detailBucket of detailBuckets) {
    if (!detailBucket) {
      continue;
    }

    if (detailBucket.providerChecking) {
      mergedBucket.providerChecking = detailBucket.providerChecking;
    }
    if (detailBucket.providerProducts) {
      mergedBucket.providerProducts = detailBucket.providerProducts;
    }
    if (detailBucket.providerCryptoTokens) {
      mergedBucket.providerCryptoTokens = detailBucket.providerCryptoTokens;
    }
  }

  return mergedBucket;
}

function mergeSeriesDetails(data: DashboardData, seriesByTab: Partial<Record<DashboardSeriesTab, DashboardSeriesData>>) {
  const detailSeries = seriesTabs
    .map((series) => seriesByTab[series])
    .filter((seriesData): seriesData is DashboardSeriesData => !!seriesData);

  if (detailSeries.length === 0) {
    return data;
  }

  const monthlyDetailsByKey = detailSeries.map((seriesData) =>
    new Map(seriesData.monthlyData.map((bucket) => [bucket.month, bucket]))
  );
  const dailyDetailsByKey = detailSeries.map((seriesData) =>
    new Map(seriesData.dailyData.map((bucket) => [bucket.date, bucket]))
  );

  return {
    ...data,
    monthlyData: data.monthlyData.map((bucket) =>
      mergeBucketDetails(bucket, monthlyDetailsByKey.map((details) => details.get(bucket.month)))
    ),
    dailyData: data.dailyData.map((bucket) =>
      mergeBucketDetails(bucket, dailyDetailsByKey.map((details) => details.get(bucket.date)))
    )
  };
}

function getDashboardDataVersion(data: DashboardData | null) {
  if (!data) {
    return "empty";
  }

  const lastDailyBucket = data.dailyData.at(-1);
  return [
    data.dailyData.length,
    data.monthlyData.length,
    lastDailyBucket?.date ?? "",
    data.accountTotals.heritage,
    data.providerSummaries.length
  ].join(":");
}

export function useDashboardSeriesData({
  activeTab,
  data,
  shouldLoad,
  userId
}: UseDashboardSeriesDataParams) {
  const dataVersion = useMemo(() => getDashboardDataVersion(data), [data]);
  const [loadedSeries, setLoadedSeries] = useState<Record<string, DashboardSeriesData>>({});
  const seriesByTab = useMemo(() => {
    const nextSeriesByTab: Partial<Record<DashboardSeriesTab, DashboardSeriesData>> = {};
    for (const series of seriesTabs) {
      const cacheKey = getSeriesCacheKey(userId, dataVersion, series);
      const loaded = loadedSeries[cacheKey] ?? dashboardSeriesCache.get(cacheKey);
      if (loaded) {
        nextSeriesByTab[series] = loaded;
      }
    }
    return nextSeriesByTab;
  }, [dataVersion, loadedSeries, userId]);

  const loadSeries = useCallback(async (series: DashboardSeriesTab) => {
    if (!shouldLoad || !data) {
      return;
    }

    const cacheKey = getSeriesCacheKey(userId, dataVersion, series);
    if (seriesByTab[series] || dashboardSeriesCache.has(cacheKey)) {
      const cached = dashboardSeriesCache.get(cacheKey);
      if (cached && !seriesByTab[series]) {
        setLoadedSeries((current) => ({ ...current, [cacheKey]: cached }));
      }
      return;
    }

    try {
      const payload = await fetchDashboardSeries(userId, dataVersion, series);
      setLoadedSeries((current) => ({ ...current, [cacheKey]: payload }));
    } catch {
      // Keep the primary dashboard chart usable; details can be fetched again later.
    }
  }, [data, dataVersion, seriesByTab, shouldLoad, userId]);

  useEffect(() => {
    if (activeTab === "heritage") {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadSeries(activeTab);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeTab, loadSeries]);

  return useMemo(() => {
    if (!data) {
      return null;
    }

    return mergeSeriesDetails(data, seriesByTab);
  }, [data, seriesByTab]);
}
