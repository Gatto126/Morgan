import { useCallback, useEffect, useRef, useState } from "react";

import { fetchAndCacheLivePrices, globalLivePricesCache } from "@/shared/live-prices";

import type { PortfolioDashboardConfig, PortfolioProviderSummary } from "./types";

type UsePortfolioLivePricesOptions = {
  providers: PortfolioProviderSummary[] | undefined;
  priceQueryParam: PortfolioDashboardConfig["priceQueryParam"];
  isActive: boolean;
  shouldLoad: boolean;
};

export function usePortfolioLivePrices({
  providers,
  priceQueryParam,
  isActive,
  shouldLoad
}: UsePortfolioLivePricesOptions) {
  const [livePrices, setLivePrices] = useState<Record<string, number | null>>(globalLivePricesCache);
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
    });
    setLivePrices(prev => ({ ...prev, ...prices }));
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
    }, 60_000);

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

  return livePrices;
}
