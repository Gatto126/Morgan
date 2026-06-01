import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchAndCacheLivePrices,
  globalLivePricesCache,
  globalLiveQuotesCache,
  LIVE_PRICES_UPDATED_EVENT,
  type LivePricesUpdatedEventDetail,
  type LiveQuote
} from "@/shared/live-prices";
import { areLivePriceKeysValued } from "@/shared/live-price-readiness";
import { normalizeCryptoSymbol } from "@/domain/pricing/crypto-symbols";
import { getBinanceLivePriceKeys } from "@/components/dashboard/binance-live-values";
import type { BinanceBalanceRow } from "@/components/dashboard/types";

import { BINANCE_PORTFOLIO_PROVIDER_KEY } from "./binance-portfolio-provider";
import type { PortfolioDashboardConfig, PortfolioProviderSummary } from "./types";

type UsePortfolioLivePricesOptions = {
  providers: PortfolioProviderSummary[] | undefined;
  binanceBalances?: BinanceBalanceRow[];
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
  const keys = new Set<string>();

  for (const provider of providers ?? []) {
    if (provider.sourceInstitution === BINANCE_PORTFOLIO_PROVIDER_KEY) {
      continue;
    }

    for (const product of provider.products) {
      const key = normalizePriceKey(product.isin, priceQueryParam);
      if (key && product.quantity > 0.000001) keys.add(key);
    }
  }

  return [...keys].sort();
}

function getRequestedPriceKeys(
  providers: PortfolioProviderSummary[] | undefined,
  priceQueryParam: PortfolioDashboardConfig["priceQueryParam"],
  binanceBalances: BinanceBalanceRow[] | undefined
) {
  const keys = new Set(getRequiredPriceKeys(providers, priceQueryParam));

  if (priceQueryParam === "cryptos") {
    for (const key of getBinanceLivePriceKeys(binanceBalances)) {
      keys.add(key);
    }
  }

  return [...keys].sort();
}

function getPriceRequestKey(
  providers: PortfolioProviderSummary[] | undefined,
  priceQueryParam: PortfolioDashboardConfig["priceQueryParam"],
  binanceBalances: BinanceBalanceRow[] | undefined
) {
  const keys = getRequestedPriceKeys(providers, priceQueryParam, binanceBalances);

  return keys.length > 0 ? `${priceQueryParam}:${keys.join(",")}` : "";
}

export function usePortfolioLivePrices({
  providers,
  binanceBalances,
  priceQueryParam,
  isActive,
  shouldLoad
}: UsePortfolioLivePricesOptions) {
  const [livePrices, setLivePrices] = useState<Record<string, number | null>>(globalLivePricesCache);
  const [liveQuotes, setLiveQuotes] = useState<Record<string, LiveQuote>>(globalLiveQuotesCache);
  const [readyRequestKey, setReadyRequestKey] = useState("");
  const [pricesReady, setPricesReady] = useState(false);
  const lastPreloadKeyRef = useRef("");

  const fetchLivePrices = useCallback(async (
    currentProviders: PortfolioProviderSummary[],
    currentBinanceBalances: BinanceBalanceRow[] | undefined
  ) => {
    const priceKeys = getRequestedPriceKeys(currentProviders, priceQueryParam, currentBinanceBalances);
    if (priceKeys.length === 0) return;

    const prices = await fetchAndCacheLivePrices({
      [priceQueryParam]: priceKeys
    }, { maxAgeMs: livePriceValueMaxAgeMs });
    const requiredKeys = getRequiredPriceKeys(currentProviders, priceQueryParam);
    const requestKey = getPriceRequestKey(currentProviders, priceQueryParam, currentBinanceBalances);

    setLivePrices(prev => ({ ...prev, ...prices }));
    setLiveQuotes({ ...globalLiveQuotesCache });
    if (areLivePriceKeysValued(requiredKeys, prices)) {
      setReadyRequestKey(requestKey);
      setPricesReady(true);
    } else {
      setReadyRequestKey("");
      setPricesReady(false);
    }
  }, [priceQueryParam]);

  useEffect(() => {
    const handleLivePricesUpdated = (event: Event) => {
      const updatedKeys = (event as CustomEvent<LivePricesUpdatedEventDetail>).detail?.keys ?? [];
      if (updatedKeys.length === 0) {
        return;
      }

      setLivePrices({ ...globalLivePricesCache });
      setLiveQuotes({ ...globalLiveQuotesCache });
    };

    window.addEventListener(LIVE_PRICES_UPDATED_EVENT, handleLivePricesUpdated);
    return () => window.removeEventListener(LIVE_PRICES_UPDATED_EVENT, handleLivePricesUpdated);
  }, []);

  useEffect(() => {
    if (!shouldLoad || !providers) return;

    const requestKey = getPriceRequestKey(providers, priceQueryParam, binanceBalances);

    if (!requestKey || lastPreloadKeyRef.current === requestKey) {
      return;
    }

    lastPreloadKeyRef.current = requestKey;
    void fetchLivePrices(providers, binanceBalances);
  }, [binanceBalances, providers, fetchLivePrices, priceQueryParam, shouldLoad]);

  useEffect(() => {
    if (!isActive || !providers) return;

    const initialLoad = window.setTimeout(() => {
      void fetchLivePrices(providers, binanceBalances);
    }, 0);

    const interval = window.setInterval(() => {
      void fetchLivePrices(providers, binanceBalances);
    }, livePriceRefreshIntervalMs);

    const handleFocus = () => {
      void fetchLivePrices(providers, binanceBalances);
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [binanceBalances, providers, fetchLivePrices, isActive]);

  const requestKey = getPriceRequestKey(providers, priceQueryParam, binanceBalances);
  const requiredKeys = getRequiredPriceKeys(providers, priceQueryParam);
  const cachedPricesReady = areLivePriceKeysValued(requiredKeys, livePrices);

  return {
    liveQuotes,
    livePrices,
    pricesReady: requestKey === "" || cachedPricesReady || (pricesReady && readyRequestKey === requestKey)
  };
}
