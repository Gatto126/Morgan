import { useCallback, useEffect, useRef, useState } from "react";
import { globalLivePricesCache, saveLivePricesToCache } from "@/shared/live-prices";
import type { ProviderSummary } from "./types";

type UseDashboardLivePricesOptions = {
  isActive: boolean;
  shouldLoad: boolean;
};

function getPriceRequestKey(summaries: ProviderSummary[] | undefined) {
  if (!summaries) {
    return "";
  }

  const isins = new Set<string>();
  const cryptos = new Set<string>();

  for (const provider of summaries) {
    for (const product of provider.investmentProducts) {
      if (product.isin && Math.abs(product.quantity) > 0.000001) {
        isins.add(product.isin);
      }
    }
    for (const token of provider.cryptoTokens) {
      if (token.tokenSymbol && Math.abs(token.quantity) > 0.000001) {
        cryptos.add(token.tokenSymbol);
      }
    }
  }

  return `${[...isins].sort().join(",")}|${[...cryptos].sort().join(",")}`;
}

export function useDashboardLivePrices(
  providerSummaries: ProviderSummary[] | undefined,
  { isActive, shouldLoad }: UseDashboardLivePricesOptions
) {
  const [livePrices, setLivePrices] = useState<Record<string, number | null>>(globalLivePricesCache);
  const lastPreloadKeyRef = useRef("");

  const fetchLivePrices = useCallback(async (summaries: ProviderSummary[]) => {
    const allIsins = new Set<string>();
    const allCryptos = new Set<string>();

    for (const provider of summaries) {
      for (const product of provider.investmentProducts) {
        if (product.isin && Math.abs(product.quantity) > 0.000001) {
          allIsins.add(product.isin);
        }
      }
      for (const token of provider.cryptoTokens) {
        if (token.tokenSymbol && Math.abs(token.quantity) > 0.000001) {
          allCryptos.add(token.tokenSymbol);
        }
      }
    }

    if (allIsins.size === 0 && allCryptos.size === 0) {
      return;
    }

    try {
      const params = new URLSearchParams();
      if (allIsins.size > 0) {
        params.set("isins", [...allIsins].join(","));
      }
      if (allCryptos.size > 0) {
        params.set("cryptos", [...allCryptos].join(","));
      }

      const response = await fetch(`/api/prices?${params.toString()}`);
      if (response.ok) {
        const prices = await response.json() as Record<string, number | null>;
        saveLivePricesToCache(prices);
        setLivePrices((previousPrices) => ({ ...previousPrices, ...prices }));
      }
    } catch {
      // Price updates are opportunistic; cached/dashboard values remain usable.
    }
  }, []);

  useEffect(() => {
    if (!shouldLoad || !providerSummaries) {
      return;
    }

    const requestKey = getPriceRequestKey(providerSummaries);
    if (!requestKey || lastPreloadKeyRef.current === requestKey) {
      return;
    }

    lastPreloadKeyRef.current = requestKey;
    void fetchLivePrices(providerSummaries);
  }, [providerSummaries, fetchLivePrices, shouldLoad]);

  useEffect(() => {
    if (!isActive || !providerSummaries) {
      return;
    }

    const initialLoad = window.setTimeout(() => {
      void fetchLivePrices(providerSummaries);
    }, 0);
    const interval = window.setInterval(() => {
      void fetchLivePrices(providerSummaries);
    }, 60_000);
    const handleFocus = () => {
      void fetchLivePrices(providerSummaries);
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [providerSummaries, fetchLivePrices, isActive]);

  return livePrices;
}
