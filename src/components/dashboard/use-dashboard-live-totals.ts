"use client";

import { useCallback } from "react";

import type { BinanceBalanceRow, DashboardData, ProviderSummary } from "./types";

type UseDashboardLiveTotalsParams = {
  binanceBalances: BinanceBalanceRow[];
  data: DashboardData | null;
  livePrices: Record<string, number | null>;
};

export function useDashboardLiveTotals({
  binanceBalances,
  data,
  livePrices
}: UseDashboardLiveTotalsParams) {
  const getProviderInvestmentLiveTotal = useCallback((provider: ProviderSummary) => {
    let liveTotal = 0;
    let hasHoldings = false;
    for (const product of provider.investmentProducts) {
      if (Math.abs(product.quantity) > 0.000001) {
        hasHoldings = true;
        const livePrice = product.isin ? livePrices[product.isin] : null;
        if (livePrice != null) {
          liveTotal += Math.round(product.quantity * livePrice * 100);
        } else {
          liveTotal += product.investedValue;
        }
      }
    }
    return hasHoldings ? liveTotal : 0;
  }, [livePrices]);

  const getGlobalInvestmentLiveTotal = useCallback(() => {
    return data?.providerSummaries.reduce((sum, provider) => sum + getProviderInvestmentLiveTotal(provider), 0) ?? 0;
  }, [data?.providerSummaries, getProviderInvestmentLiveTotal]);

  const getProviderCryptoLiveTotal = useCallback((provider: ProviderSummary) => {
    let liveTotal = 0;
    let hasHoldings = false;
    for (const token of provider.cryptoTokens) {
      if (Math.abs(token.quantity) > 0.000001) {
        hasHoldings = true;
        const livePrice = token.tokenSymbol ? livePrices[token.tokenSymbol] : null;
        if (livePrice != null) {
          liveTotal += Math.round(token.quantity * livePrice * 100);
        } else {
          liveTotal += token.investedValue;
        }
      }
    }
    return hasHoldings ? liveTotal : 0;
  }, [livePrices]);

  const getGlobalCryptoLiveTotal = useCallback(() => {
    const txCrypto = data?.providerSummaries.reduce((sum, provider) => sum + getProviderCryptoLiveTotal(provider), 0) ?? 0;
    const binanceCents = Math.round(binanceBalances.reduce((sum, balance) => sum + balance.eurValue, 0) * 100);
    return txCrypto + binanceCents;
  }, [binanceBalances, data?.providerSummaries, getProviderCryptoLiveTotal]);

  return {
    getGlobalCryptoLiveTotal,
    getGlobalInvestmentLiveTotal,
    getProviderCryptoLiveTotal,
    getProviderInvestmentLiveTotal
  };
}
