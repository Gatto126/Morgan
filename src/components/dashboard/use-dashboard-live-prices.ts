import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchAndCacheLivePrices,
  globalLivePricesCache
} from "@/shared/live-prices";
import type { ProviderSummary } from "./types";

type UseDashboardLivePricesOptions = {
  isActive: boolean;
  shouldLoad: boolean;
};

const livePriceValueMaxAgeMs = 15_000;

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

function getRequiredPriceKeys(summaries: ProviderSummary[] | undefined) {
  if (!summaries) {
    return [];
  }

  const keys = new Set<string>();

  for (const provider of summaries) {
    for (const product of provider.investmentProducts) {
      if (product.isin && Math.abs(product.quantity) > 0.000001) {
        keys.add(product.isin);
      }
    }
    for (const token of provider.cryptoTokens) {
      if (token.tokenSymbol && Math.abs(token.quantity) > 0.000001) {
        keys.add(token.tokenSymbol);
      }
    }
  }

  return [...keys].sort();
}

function areLivePricesReady(keys: string[], livePrices: Record<string, number | null>) {
  if (keys.length === 0) {
    return true;
  }

  return keys.every((key) => livePrices[key] != null);
}

export function useDashboardLivePrices(
  providerSummaries: ProviderSummary[] | undefined,
  { isActive, shouldLoad }: UseDashboardLivePricesOptions
) {
  const [livePrices, setLivePrices] = useState<Record<string, number | null>>(globalLivePricesCache);
  const [readyRequestKey, setReadyRequestKey] = useState("");
  const [pricesReady, setPricesReady] = useState(false);
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

    const prices = await fetchAndCacheLivePrices({
      cryptos: [...allCryptos],
      isins: [...allIsins]
    }, { maxAgeMs: livePriceValueMaxAgeMs });
    const requiredKeys = getRequiredPriceKeys(summaries);
    const requestKey = getPriceRequestKey(summaries);

    setLivePrices((previousPrices) => ({ ...previousPrices, ...prices }));
    if (areLivePricesReady(requiredKeys, prices)) {
      setReadyRequestKey(requestKey);
      setPricesReady(true);
    } else {
      setReadyRequestKey("");
      setPricesReady(false);
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

  const requestKey = getPriceRequestKey(providerSummaries);

  return {
    livePrices,
    pricesReady: requestKey === "" || (pricesReady && readyRequestKey === requestKey)
  };
}
