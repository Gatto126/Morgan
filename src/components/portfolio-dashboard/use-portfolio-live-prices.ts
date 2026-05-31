import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchAndCacheLivePrices,
  globalLivePricesCache
} from "@/shared/live-prices";

import type { PortfolioDashboardConfig, PortfolioProviderSummary } from "./types";

type UsePortfolioLivePricesOptions = {
  providers: PortfolioProviderSummary[] | undefined;
  priceQueryParam: PortfolioDashboardConfig["priceQueryParam"];
  isActive: boolean;
  shouldLoad: boolean;
};

const livePriceValueMaxAgeMs = 10_000;
const livePriceRefreshIntervalMs = 15_000;

function getRequiredPriceKeys(providers: PortfolioProviderSummary[] | undefined) {
  if (!providers) {
    return [];
  }

  return [
    ...new Set(
      providers
        .flatMap((provider) => provider.products)
        .filter((product) => product.isin && product.quantity > 0.000001)
        .map((product) => product.isin as string)
    )
  ].sort();
}

function getPriceRequestKey(
  providers: PortfolioProviderSummary[] | undefined,
  priceQueryParam: PortfolioDashboardConfig["priceQueryParam"]
) {
  const keys = getRequiredPriceKeys(providers);

  return keys.length > 0 ? `${priceQueryParam}:${keys.join(",")}` : "";
}

function areLivePricesReady(keys: string[], livePrices: Record<string, number | null>) {
  if (keys.length === 0) {
    return true;
  }

  return keys.every((key) => livePrices[key] != null);
}

export function usePortfolioLivePrices({
  providers,
  priceQueryParam,
  isActive,
  shouldLoad
}: UsePortfolioLivePricesOptions) {
  const [livePrices, setLivePrices] = useState<Record<string, number | null>>(globalLivePricesCache);
  const [readyRequestKey, setReadyRequestKey] = useState("");
  const [pricesReady, setPricesReady] = useState(false);
  const lastPreloadKeyRef = useRef("");

  const fetchLivePrices = useCallback(async (currentProviders: PortfolioProviderSummary[]) => {
    const allIsins = new Set<string>();
    for (const provider of currentProviders) {
      for (const product of provider.products) {
        if (product.isin && product.quantity > 0.000001) allIsins.add(product.isin);
      }
    }
    if (allIsins.size === 0) return;

    const prices = await fetchAndCacheLivePrices({
      [priceQueryParam]: [...allIsins]
    }, { maxAgeMs: livePriceValueMaxAgeMs });
    const requiredKeys = getRequiredPriceKeys(currentProviders);
    const requestKey = getPriceRequestKey(currentProviders, priceQueryParam);

    setLivePrices(prev => ({ ...prev, ...prices }));
    if (areLivePricesReady(requiredKeys, prices)) {
      setReadyRequestKey(requestKey);
      setPricesReady(true);
    } else {
      setReadyRequestKey("");
      setPricesReady(false);
    }
  }, [priceQueryParam]);

  useEffect(() => {
    if (!shouldLoad || !providers) return;

    const requestKey = providers
      .flatMap((provider) => provider.products)
      .filter((product) => product.isin && product.quantity > 0.000001)
      .map((product) => product.isin)
      .sort()
      .join(",");

    if (!requestKey || lastPreloadKeyRef.current === requestKey) {
      return;
    }

    lastPreloadKeyRef.current = requestKey;
    void fetchLivePrices(providers);
  }, [providers, fetchLivePrices, shouldLoad]);

  useEffect(() => {
    if (!isActive || !providers) return;

    const initialLoad = window.setTimeout(() => {
      void fetchLivePrices(providers);
    }, 0);

    const interval = window.setInterval(() => {
      void fetchLivePrices(providers);
    }, livePriceRefreshIntervalMs);

    const handleFocus = () => {
      void fetchLivePrices(providers);
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [providers, fetchLivePrices, isActive]);

  const requestKey = getPriceRequestKey(providers, priceQueryParam);

  return {
    livePrices,
    pricesReady: requestKey === "" || (pricesReady && readyRequestKey === requestKey)
  };
}
