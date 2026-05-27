import { useCallback, useEffect, useState } from "react";

import { globalLivePricesCache, saveLivePricesToCache } from "@/lib/live-prices";

import type { PortfolioDashboardConfig, PortfolioProviderSummary } from "./types";

type UsePortfolioLivePricesOptions = {
  providers: PortfolioProviderSummary[] | undefined;
  priceQueryParam: PortfolioDashboardConfig["priceQueryParam"];
  isActive: boolean;
};

export function usePortfolioLivePrices({
  providers,
  priceQueryParam,
  isActive
}: UsePortfolioLivePricesOptions) {
  const [livePrices, setLivePrices] = useState<Record<string, number | null>>(globalLivePricesCache);

  const fetchLivePrices = useCallback(async (currentProviders: PortfolioProviderSummary[]) => {
    const allIsins = new Set<string>();
    for (const provider of currentProviders) {
      for (const product of provider.products) {
        if (product.isin && product.quantity > 0.000001) allIsins.add(product.isin);
      }
    }
    if (allIsins.size === 0) return;

    try {
      const response = await fetch(`/api/prices?${priceQueryParam}=${[...allIsins].join(",")}`);
      if (response.ok) {
        const prices = await response.json();
        saveLivePricesToCache(prices);
        setLivePrices(prev => ({ ...prev, ...prices }));
      }
    } catch {
      // Live prices are opportunistic; cached or invested values remain visible on failure.
    }
  }, [priceQueryParam]);

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
