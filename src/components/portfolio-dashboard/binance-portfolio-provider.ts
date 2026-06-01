import {
  getBinanceBalanceQuantity,
  getBinanceBalanceLivePriceKey
} from "@/components/dashboard/binance-live-values";
import type { BinanceBalanceRow } from "@/components/dashboard/types";

import type { PortfolioData, PortfolioProviderSummary } from "./types";

export const BINANCE_PORTFOLIO_PROVIDER_KEY = "BINANCE";

const NON_ZERO_THRESHOLD = 0.000001;

export function buildBinancePortfolioProvider(
  balances: BinanceBalanceRow[]
): PortfolioProviderSummary | null {
  const products = balances
    .map((balance) => {
      const quantity = getBinanceBalanceQuantity(balance);
      const priceKey = getBinanceBalanceLivePriceKey(balance);

      return {
        cashback: 0,
        investedValue: Math.round(balance.eurValue * 100),
        isin: priceKey ?? balance.tokenSymbol,
        productName: balance.tokenName
          ? `${balance.tokenName} (${balance.tokenSymbol})`
          : balance.tokenSymbol,
        quantity
      };
    })
    .filter((product) =>
      Math.abs(product.quantity) > NON_ZERO_THRESHOLD &&
      product.investedValue > 0
    );

  if (products.length === 0) {
    return null;
  }

  const total = products.reduce((sum, product) => sum + product.investedValue, 0);

  return {
    cashback: 0,
    expenses: 0,
    income: 0,
    interest: 0,
    products,
    sourceInstitution: BINANCE_PORTFOLIO_PROVIDER_KEY,
    tax: 0,
    total,
    transactionCount: 0
  };
}

export function mergePortfolioDataWithBinance(
  data: PortfolioData,
  balances: BinanceBalanceRow[]
): PortfolioData {
  const binanceProvider = buildBinancePortfolioProvider(balances);
  const providers = data.providers.filter(
    (provider) => provider.sourceInstitution !== BINANCE_PORTFOLIO_PROVIDER_KEY
  );

  return {
    ...data,
    providers: binanceProvider ? [...providers, binanceProvider] : providers
  };
}
