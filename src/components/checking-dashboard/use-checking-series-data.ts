"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { CheckingBucket, CheckingData, MonthBucket } from "./types";

type CheckingProviderSeriesData = {
  provider: string;
  monthlyData: MonthBucket[];
  dailyData: CheckingBucket[];
};

type UseCheckingSeriesDataParams = {
  activeProviderKey: string;
  data: CheckingData | null;
  shouldLoad: boolean;
  userId: string;
};

const checkingSeriesCache = new Map<string, CheckingProviderSeriesData>();
const inFlightCheckingSeries = new Map<string, Promise<CheckingProviderSeriesData>>();

function getSeriesCacheKey(userId: string, dataVersion: string, provider: string) {
  return `${userId}:${dataVersion}:${provider}`;
}

async function fetchCheckingSeries(userId: string, dataVersion: string, provider: string) {
  const cacheKey = getSeriesCacheKey(userId, dataVersion, provider);
  const cached = checkingSeriesCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const inFlight = inFlightCheckingSeries.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const query = new URLSearchParams({ provider, userId });
  const request = fetch(`/api/transactions/checking/series?${query.toString()}`, { cache: "no-store" })
    .then(async (response) => {
      const payload = await response.json() as CheckingProviderSeriesData & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Errore durante il caricamento delle serie.");
      }

      checkingSeriesCache.set(cacheKey, payload);
      return payload;
    })
    .finally(() => {
      inFlightCheckingSeries.delete(cacheKey);
    });

  inFlightCheckingSeries.set(cacheKey, request);
  return request;
}

function mergeProviderFlows<TBucket extends MonthBucket | CheckingBucket>(
  bucket: TBucket,
  detailBucket: TBucket | undefined
) {
  if (!detailBucket?.providerIncome && !detailBucket?.providerExpenses) {
    return bucket;
  }

  return {
    ...bucket,
    providerExpenses: {
      ...(bucket.providerExpenses ?? {}),
      ...(detailBucket.providerExpenses ?? {})
    },
    providerIncome: {
      ...(bucket.providerIncome ?? {}),
      ...(detailBucket.providerIncome ?? {})
    }
  };
}

function mergeSeriesDetails(data: CheckingData, seriesByProvider: Record<string, CheckingProviderSeriesData | undefined>) {
  const detailSeries = Object.values(seriesByProvider).filter((series): series is CheckingProviderSeriesData => !!series);
  if (detailSeries.length === 0) {
    return data;
  }

  const monthlyDetailsByProvider = new Map(
    detailSeries.map((series) => [
      series.provider,
      new Map(series.monthlyData.map((bucket) => [bucket.month, bucket]))
    ])
  );
  const dailyDetailsByProvider = new Map(
    detailSeries.map((series) => [
      series.provider,
      new Map(series.dailyData.map((bucket) => [bucket.date, bucket]))
    ])
  );

  return {
    ...data,
    monthlyData: data.monthlyData.map((bucket) => {
      let mergedBucket = bucket;
      for (const details of monthlyDetailsByProvider.values()) {
        mergedBucket = mergeProviderFlows(mergedBucket, details.get(bucket.month));
      }
      return mergedBucket;
    }),
    dailyData: data.dailyData.map((bucket) => {
      let mergedBucket = bucket;
      for (const details of dailyDetailsByProvider.values()) {
        mergedBucket = mergeProviderFlows(mergedBucket, details.get(bucket.date));
      }
      return mergedBucket;
    })
  };
}

function getCheckingDataVersion(data: CheckingData | null) {
  if (!data) {
    return "empty";
  }

  const lastDailyBucket = data.dailyData.at(-1);
  const providerSignature = data.providers
    .map((provider) => `${provider.sourceInstitution}:${provider.total}:${provider.transactionCount}`)
    .join("|");

  return [
    data.dailyData.length,
    data.monthlyData.length,
    lastDailyBucket?.date ?? "",
    providerSignature
  ].join(":");
}

export function useCheckingSeriesData({
  activeProviderKey,
  data,
  shouldLoad,
  userId
}: UseCheckingSeriesDataParams) {
  const dataVersion = useMemo(() => getCheckingDataVersion(data), [data]);
  const providerKeys = useMemo(
    () => data?.providers.map((provider) => provider.sourceInstitution) ?? [],
    [data]
  );
  const [loadedSeries, setLoadedSeries] = useState<Record<string, CheckingProviderSeriesData>>({});

  const seriesByProvider = useMemo(() => {
    const nextSeriesByProvider: Record<string, CheckingProviderSeriesData | undefined> = {};
    for (const provider of providerKeys) {
      const cacheKey = getSeriesCacheKey(userId, dataVersion, provider);
      const loaded = loadedSeries[cacheKey] ?? checkingSeriesCache.get(cacheKey);
      if (loaded) {
        nextSeriesByProvider[provider] = loaded;
      }
    }
    return nextSeriesByProvider;
  }, [dataVersion, loadedSeries, providerKeys, userId]);

  const loadSeries = useCallback(async (provider: string) => {
    if (!shouldLoad || !data || !provider || provider === "ALL") {
      return;
    }

    const cacheKey = getSeriesCacheKey(userId, dataVersion, provider);
    if (seriesByProvider[provider] || checkingSeriesCache.has(cacheKey)) {
      const cached = checkingSeriesCache.get(cacheKey);
      if (cached && !seriesByProvider[provider]) {
        setLoadedSeries((current) => ({ ...current, [cacheKey]: cached }));
      }
      return;
    }

    try {
      const payload = await fetchCheckingSeries(userId, dataVersion, provider);
      setLoadedSeries((current) => ({ ...current, [cacheKey]: payload }));
    } catch {
      // Keep the checking chart usable; provider flow details can be retried on the next interaction.
    }
  }, [data, dataVersion, seriesByProvider, shouldLoad, userId]);

  useEffect(() => {
    if (activeProviderKey === "ALL") {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadSeries(activeProviderKey);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [activeProviderKey, loadSeries]);

  return useMemo(() => {
    if (!data) {
      return null;
    }

    return mergeSeriesDetails(data, seriesByProvider);
  }, [data, seriesByProvider]);
}
