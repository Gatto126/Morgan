"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { MonthBucket, PortfolioBucket, PortfolioData } from "./types";

type PortfolioSeriesData = {
  provider: string;
  monthlyData: MonthBucket[];
  dailyData: PortfolioBucket[];
};

type UsePortfolioSeriesDataParams = {
  activeProviderKey: string;
  data: PortfolioData | null;
  endpoint: string;
  shouldLoad: boolean;
  userId: string;
};

const portfolioSeriesCache = new Map<string, PortfolioSeriesData>();
const inFlightPortfolioSeries = new Map<string, Promise<PortfolioSeriesData>>();

function getSeriesCacheKey(endpoint: string, userId: string, dataVersion: string, provider: string) {
  return `${endpoint}:${userId}:${dataVersion}:${provider}`;
}

async function fetchPortfolioSeries({
  dataVersion,
  endpoint,
  provider,
  userId
}: {
  dataVersion: string;
  endpoint: string;
  provider: string;
  userId: string;
}) {
  const cacheKey = getSeriesCacheKey(endpoint, userId, dataVersion, provider);
  const cached = portfolioSeriesCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const inFlight = inFlightPortfolioSeries.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const query = new URLSearchParams({ provider, userId });
  const request = fetch(`${endpoint}/series?${query.toString()}`, { cache: "no-store" })
    .then(async (response) => {
      const payload = await response.json() as PortfolioSeriesData & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Errore durante il caricamento delle serie.");
      }

      portfolioSeriesCache.set(cacheKey, payload);
      return payload;
    })
    .finally(() => {
      inFlightPortfolioSeries.delete(cacheKey);
    });

  inFlightPortfolioSeries.set(cacheKey, request);
  return request;
}

function mergeProviderProducts<TBucket extends MonthBucket | PortfolioBucket>(
  bucket: TBucket,
  detailBucket: TBucket | undefined
) {
  if (!detailBucket?.providerProducts) {
    return bucket;
  }

  return {
    ...bucket,
    providerProducts: {
      ...(bucket.providerProducts ?? {}),
      ...detailBucket.providerProducts
    }
  };
}

function mergeSeriesDetails(data: PortfolioData, seriesByProvider: Record<string, PortfolioSeriesData | undefined>) {
  const detailSeries = Object.values(seriesByProvider).filter((series): series is PortfolioSeriesData => !!series);
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
        mergedBucket = mergeProviderProducts(mergedBucket, details.get(bucket.month));
      }
      return mergedBucket;
    }),
    dailyData: data.dailyData.map((bucket) => {
      let mergedBucket = bucket;
      for (const details of dailyDetailsByProvider.values()) {
        mergedBucket = mergeProviderProducts(mergedBucket, details.get(bucket.date));
      }
      return mergedBucket;
    })
  };
}

function getPortfolioDataVersion(data: PortfolioData | null) {
  if (!data) {
    return "empty";
  }

  const lastDailyBucket = data.dailyData.at(-1);
  const providerSignature = data.providers
    .map((provider) => `${provider.sourceInstitution}:${provider.total}:${provider.products.length}`)
    .join("|");

  return [
    data.dailyData.length,
    data.monthlyData.length,
    lastDailyBucket?.date ?? "",
    providerSignature
  ].join(":");
}

export function usePortfolioSeriesData({
  activeProviderKey,
  data,
  endpoint,
  shouldLoad,
  userId
}: UsePortfolioSeriesDataParams) {
  const dataVersion = useMemo(() => getPortfolioDataVersion(data), [data]);
  const providerKeys = useMemo(
    () => data?.providers.map((provider) => provider.sourceInstitution) ?? [],
    [data]
  );
  const [loadedSeries, setLoadedSeries] = useState<Record<string, PortfolioSeriesData>>({});

  const seriesByProvider = useMemo(() => {
    const nextSeriesByProvider: Record<string, PortfolioSeriesData | undefined> = {};
    for (const provider of providerKeys) {
      const cacheKey = getSeriesCacheKey(endpoint, userId, dataVersion, provider);
      const loaded = loadedSeries[cacheKey] ?? portfolioSeriesCache.get(cacheKey);
      if (loaded) {
        nextSeriesByProvider[provider] = loaded;
      }
    }
    return nextSeriesByProvider;
  }, [dataVersion, endpoint, loadedSeries, providerKeys, userId]);

  const loadSeries = useCallback(async (provider: string) => {
    if (!shouldLoad || !data || !provider || provider === "ALL") {
      return;
    }

    const cacheKey = getSeriesCacheKey(endpoint, userId, dataVersion, provider);
    if (seriesByProvider[provider] || portfolioSeriesCache.has(cacheKey)) {
      const cached = portfolioSeriesCache.get(cacheKey);
      if (cached && !seriesByProvider[provider]) {
        setLoadedSeries((current) => ({ ...current, [cacheKey]: cached }));
      }
      return;
    }

    try {
      const payload = await fetchPortfolioSeries({ dataVersion, endpoint, provider, userId });
      setLoadedSeries((current) => ({ ...current, [cacheKey]: payload }));
    } catch {
      // Keep the portfolio usable; the active-provider details can be fetched again on the next tab change.
    }
  }, [data, dataVersion, endpoint, seriesByProvider, shouldLoad, userId]);

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
