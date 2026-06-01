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
import { getBinanceLivePriceKeys } from "./binance-live-values";
import type { BinanceBalanceRow, ProviderSummary } from "./types";

type UseDashboardLivePricesOptions = {
  binanceBalances?: BinanceBalanceRow[];
  isActive: boolean;
  shouldLoad: boolean;
};

const livePriceValueMaxAgeMs = 10_000;
const livePriceRefreshIntervalMs = 15_000;

function getPriceRequestKey(
  summaries: ProviderSummary[] | undefined,
  binanceBalances: BinanceBalanceRow[] | undefined
) {
  const isins = new Set<string>();
  const cryptos = new Set(getBinanceLivePriceKeys(binanceBalances));

  for (const provider of summaries ?? []) {
    for (const product of provider.investmentProducts) {
      if (product.isin && Math.abs(product.quantity) > 0.000001) {
        isins.add(product.isin);
      }
    }
    for (const token of provider.cryptoTokens) {
      const tokenSymbol = normalizeCryptoSymbol(token.tokenSymbol);
      if (tokenSymbol && Math.abs(token.quantity) > 0.000001) {
        cryptos.add(tokenSymbol);
      }
    }
  }

  const sortedIsins = [...isins].sort();
  const sortedCryptos = [...cryptos].sort();

  return sortedIsins.length > 0 || sortedCryptos.length > 0
    ? `${sortedIsins.join(",")}|${sortedCryptos.join(",")}`
    : "";
}

function getRequiredPriceKeys(summaries: ProviderSummary[] | undefined) {
  return [
    ...getRequiredInvestmentPriceKeys(summaries),
    ...getRequiredCryptoPriceKeys(summaries)
  ];
}

function getRequiredInvestmentPriceKeys(summaries: ProviderSummary[] | undefined) {
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
  }

  return [...keys].sort();
}

function getRequiredCryptoPriceKeys(summaries: ProviderSummary[] | undefined) {
  const keys = new Set<string>();

  for (const provider of summaries ?? []) {
    for (const token of provider.cryptoTokens) {
      const tokenSymbol = normalizeCryptoSymbol(token.tokenSymbol);
      if (tokenSymbol && Math.abs(token.quantity) > 0.000001) {
        keys.add(tokenSymbol);
      }
    }
  }

  return [...keys].sort();
}

export function useDashboardLivePrices(
  providerSummaries: ProviderSummary[] | undefined,
  { binanceBalances = [], isActive, shouldLoad }: UseDashboardLivePricesOptions
) {
  const [livePrices, setLivePrices] = useState<Record<string, number | null>>(globalLivePricesCache);
  const [liveQuotes, setLiveQuotes] = useState<Record<string, LiveQuote>>(globalLiveQuotesCache);
  const [readyRequestKey, setReadyRequestKey] = useState("");
  const [investmentPricesReady, setInvestmentPricesReady] = useState(false);
  const [cryptoPricesReady, setCryptoPricesReady] = useState(false);
  const [pricesReady, setPricesReady] = useState(false);
  const lastPreloadKeyRef = useRef("");

  const fetchLivePrices = useCallback(async (
    summaries: ProviderSummary[] | undefined,
    balances: BinanceBalanceRow[]
  ) => {
    const allIsins = new Set<string>();
    const allCryptos = new Set(getBinanceLivePriceKeys(balances));

    for (const provider of summaries ?? []) {
      for (const product of provider.investmentProducts) {
        if (product.isin && Math.abs(product.quantity) > 0.000001) {
          allIsins.add(product.isin);
        }
      }
      for (const token of provider.cryptoTokens) {
        const tokenSymbol = normalizeCryptoSymbol(token.tokenSymbol);
        if (tokenSymbol && Math.abs(token.quantity) > 0.000001) {
          allCryptos.add(tokenSymbol);
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
    const investmentKeys = getRequiredInvestmentPriceKeys(summaries);
    const cryptoKeys = getRequiredCryptoPriceKeys(summaries);
    const requiredKeys = getRequiredPriceKeys(summaries);
    const requestKey = getPriceRequestKey(summaries, balances);
    const investmentReady = areLivePriceKeysValued(investmentKeys, prices);
    const cryptoReady = areLivePriceKeysValued(cryptoKeys, prices);
    const allReady = areLivePriceKeysValued(requiredKeys, prices);

    setLivePrices((previousPrices) => ({ ...previousPrices, ...prices }));
    setLiveQuotes({ ...globalLiveQuotesCache });
    setReadyRequestKey(requestKey);
    setInvestmentPricesReady(investmentReady);
    setCryptoPricesReady(cryptoReady);
    setPricesReady(allReady);
  }, []);

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
    if (!shouldLoad) {
      return;
    }

    const requestKey = getPriceRequestKey(providerSummaries, binanceBalances);
    if (!requestKey || lastPreloadKeyRef.current === requestKey) {
      return;
    }

    lastPreloadKeyRef.current = requestKey;
    void fetchLivePrices(providerSummaries, binanceBalances);
  }, [binanceBalances, providerSummaries, fetchLivePrices, shouldLoad]);

  useEffect(() => {
    if (!isActive && !shouldLoad) {
      return;
    }

    const requestKey = getPriceRequestKey(providerSummaries, binanceBalances);
    if (!requestKey) {
      return;
    }

    const initialLoad = window.setTimeout(() => {
      void fetchLivePrices(providerSummaries, binanceBalances);
    }, 0);
    const interval = window.setInterval(() => {
      void fetchLivePrices(providerSummaries, binanceBalances);
    }, livePriceRefreshIntervalMs);
    const handleFocus = () => {
      void fetchLivePrices(providerSummaries, binanceBalances);
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [binanceBalances, providerSummaries, fetchLivePrices, isActive, shouldLoad]);

  const requestKey = getPriceRequestKey(providerSummaries, binanceBalances);
  const investmentKeys = getRequiredInvestmentPriceKeys(providerSummaries);
  const cryptoKeys = getRequiredCryptoPriceKeys(providerSummaries);
  const requiredKeys = getRequiredPriceKeys(providerSummaries);
  const readyForRequest = requestKey === "" || readyRequestKey === requestKey;
  const cachedInvestmentReady = areLivePriceKeysValued(investmentKeys, livePrices);
  const cachedCryptoReady = areLivePriceKeysValued(cryptoKeys, livePrices);
  const cachedPricesReady = areLivePriceKeysValued(requiredKeys, livePrices);

  return {
    cryptoPricesReady: requestKey === "" || cachedCryptoReady || (readyForRequest && cryptoPricesReady),
    investmentPricesReady: requestKey === "" || cachedInvestmentReady || (readyForRequest && investmentPricesReady),
    liveQuotes,
    livePrices,
    pricesReady: requestKey === "" || cachedPricesReady || (readyForRequest && pricesReady)
  };
}
