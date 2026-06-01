import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchAndCacheLivePrices,
  globalLivePricesCache
} from "@/shared/live-prices";
import { areLivePriceKeysSettled } from "@/shared/live-price-readiness";
import { normalizeCryptoSymbol } from "@/domain/pricing/crypto-symbols";

import type { PortfolioDashboardConfig, PortfolioProviderSummary } from "./types";

type UsePortfolioLivePricesOptions = {
  providers: PortfolioProviderSummary[] | undefined;
  priceQueryParam: PortfolioDashboardConfig["priceQueryParam"];
  isActive: boolean;
  shouldLoad: boolean;
};

const livePriceValueMaxAgeMs = 10_000;
const livePriceRefreshIntervalMs = 15_000;

function normalizePriceKey(
  value: string | null | undefined,
  priceQueryParam: PortfolioDashboardConfig["priceQueryParam"]
) {
  return priceQueryParam === "cryptos" ? normalizeCryptoSymbol(value) : value;
}

function getRequiredPriceKeys(
  providers: PortfolioProviderSummary[] | undefined,
  priceQueryParam: PortfolioDashboardConfig["priceQueryParam"]
) {
  if (!providers) {
    return [];
  }

  return [
    ...new Set(
      providers
        .flatMap((provider) => provider.products)
        .map((product) => ({
          key: normalizePriceKey(product.isin, priceQueryParam),
          quantity: product.quantity
        }))
        .filter((product): product is { key: string; quantity: number } =>
          !!product.key && product.quantity > 0.000001
        )
        .map((product) => product.key)
    )
  ].sort();
}

function getPriceRequestKey(
  providers: PortfolioProviderSummary[] | undefined,
  priceQueryParam: PortfolioDashboardConfig["priceQueryParam"]
) {
  const keys = getRequiredPriceKeys(providers, priceQueryParam);

  return keys.length > 0 ? `${priceQueryParam}:${keys.join(",")}` : "";
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
    const priceKeys = new Set<string>();
    for (const provider of currentProviders) {
      for (const product of provider.products) {
        const priceKey = normalizePriceKey(product.isin, priceQueryParam);
        if (priceKey && product.quantity > 0.000001) priceKeys.add(priceKey);
      }
    }
    if (priceKeys.size === 0) return;

    const prices = await fetchAndCacheLivePrices({
      [priceQueryParam]: [...priceKeys]
    }, { maxAgeMs: livePriceValueMaxAgeMs });
    const requiredKeys = getRequiredPriceKeys(currentProviders, priceQueryParam);
    const requestKey = getPriceRequestKey(currentProviders, priceQueryParam);

    setLivePrices(prev => ({ ...prev, ...prices }));
    if (areLivePriceKeysSettled(requiredKeys, prices)) {
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
      .map((product) => ({
        key: normalizePriceKey(product.isin, priceQueryParam),
        quantity: product.quantity
      }))
      .filter((product) => product.key && product.quantity > 0.000001)
      .map((product) => product.key)
      .sort()
      .join(",");

    if (!requestKey || lastPreloadKeyRef.current === requestKey) {
      return;
    }

    lastPreloadKeyRef.current = requestKey;
    void fetchLivePrices(providers);
  }, [providers, fetchLivePrices, priceQueryParam, shouldLoad]);

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
  const requiredKeys = getRequiredPriceKeys(providers, priceQueryParam);
  const cachedPricesReady = areLivePriceKeysSettled(requiredKeys, livePrices);

  return {
    livePrices,
    pricesReady: requestKey === "" || cachedPricesReady || (pricesReady && readyRequestKey === requestKey)
  };
}
