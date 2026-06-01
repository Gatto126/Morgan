import { normalizeCryptoSymbol } from "@/domain/pricing/crypto-symbols";

import type { DashboardChartPoint } from "./dashboard-chart-types";
import type { DashboardData, ProviderSummary } from "./types";

const OPEN_HOLDING_THRESHOLD = 0.000001;

type DashboardCurrentSnapshotOptions = {
  binanceBalancesKnown: boolean;
  binanceTotalCents: number;
  cryptoPricesReady: boolean;
  data: DashboardData | null;
  hasBinancePortfolio: boolean;
  investmentPricesReady: boolean;
  livePrices: Record<string, number | null>;
};

export function buildDashboardCurrentSnapshot({
  binanceBalancesKnown,
  binanceTotalCents,
  cryptoPricesReady,
  data,
  hasBinancePortfolio,
  investmentPricesReady,
  livePrices
}: DashboardCurrentSnapshotOptions): DashboardChartPoint | null {
  if (!data) {
    return null;
  }

  const point: DashboardChartPoint = {
    checking: data.accountTotals.checking,
    rawMonth: getTodayKey(),
    value: null
  };

  for (const provider of data.providerSummaries) {
    if (provider.checking.total !== 0) {
      point[provider.sourceInstitution] = provider.checking.total;
    }
  }

  const investment = getInvestmentCurrentValues(data.providerSummaries, livePrices, investmentPricesReady);
  const crypto = getCryptoCurrentValues(data.providerSummaries, livePrices, cryptoPricesReady);
  const binanceValue = hasBinancePortfolio && binanceBalancesKnown ? binanceTotalCents : null;
  const cryptoTotal = crypto.total !== null && binanceValue !== null
    ? crypto.total + binanceValue
    : crypto.total !== null && !hasBinancePortfolio
      ? crypto.total
      : null;
  const heritage = investment.total !== null && cryptoTotal !== null
    ? data.accountTotals.checking + investment.total + cryptoTotal
    : null;

  point.investment = investment.total;
  point.crypto = cryptoTotal;
  point.heritage = heritage;
  point.binance = binanceValue;

  for (const [productName, value] of investment.products) {
    point[productName] = value;
  }

  for (const [institution, value] of investment.institutions) {
    point[`investment_inst_${institution}`] = value;
  }

  for (const [tokenName, value] of crypto.tokens) {
    point[tokenName] = value;
  }

  for (const [institution, value] of crypto.institutions) {
    point[`crypto_inst_${institution}`] = value;
  }

  return point;
}

function getInvestmentCurrentValues(
  providerSummaries: ProviderSummary[],
  livePrices: Record<string, number | null>,
  pricesReady: boolean
) {
  const institutions = new Map<string, number | null>();
  const products = new Map<string, number | null>();
  let total: number | null = 0;

  for (const provider of providerSummaries) {
    if (provider.investmentProducts.length === 0) {
      continue;
    }

    const providerTotal = getProviderInvestmentCurrentValue(provider, livePrices, pricesReady, products);
    institutions.set(provider.sourceInstitution, providerTotal);

    if (providerTotal === null) {
      total = null;
    } else if (total !== null) {
      total += providerTotal;
    }
  }

  return { institutions, products, total };
}

function getProviderInvestmentCurrentValue(
  provider: ProviderSummary,
  livePrices: Record<string, number | null>,
  pricesReady: boolean,
  products: Map<string, number | null>
) {
  let hasOpenHoldings = false;
  let total: number | null = 0;

  for (const product of provider.investmentProducts) {
    if (Math.abs(product.quantity) <= OPEN_HOLDING_THRESHOLD) {
      continue;
    }

    hasOpenHoldings = true;
    const value = pricesReady ? getPricedHoldingValue(product.quantity, product.isin, product.investedValue, livePrices) : null;
    addNullableAmount(products, product.productName, value);

    if (value === null) {
      total = null;
    } else if (total !== null) {
      total += value;
    }
  }

  return hasOpenHoldings ? total : 0;
}

function getCryptoCurrentValues(
  providerSummaries: ProviderSummary[],
  livePrices: Record<string, number | null>,
  pricesReady: boolean
) {
  const institutions = new Map<string, number | null>();
  const tokens = new Map<string, number | null>();
  let total: number | null = 0;

  for (const provider of providerSummaries) {
    if (provider.cryptoTokens.length === 0) {
      continue;
    }

    const providerTotal = getProviderCryptoCurrentValue(provider, livePrices, pricesReady, tokens);
    institutions.set(provider.sourceInstitution, providerTotal);

    if (providerTotal === null) {
      total = null;
    } else if (total !== null) {
      total += providerTotal;
    }
  }

  return { institutions, tokens, total };
}

function getProviderCryptoCurrentValue(
  provider: ProviderSummary,
  livePrices: Record<string, number | null>,
  pricesReady: boolean,
  tokens: Map<string, number | null>
) {
  let hasOpenHoldings = false;
  let total: number | null = 0;

  for (const token of provider.cryptoTokens) {
    if (Math.abs(token.quantity) <= OPEN_HOLDING_THRESHOLD) {
      continue;
    }

    hasOpenHoldings = true;
    const priceKey = normalizeCryptoSymbol(token.tokenSymbol);
    const value = pricesReady ? getPricedHoldingValue(token.quantity, priceKey, token.investedValue, livePrices) : null;
    addNullableAmount(tokens, token.tokenName, value);

    if (value === null) {
      total = null;
    } else if (total !== null) {
      total += value;
    }
  }

  return hasOpenHoldings ? total : 0;
}

function getPricedHoldingValue(
  quantity: number,
  priceKey: string | null | undefined,
  investedValue: number,
  livePrices: Record<string, number | null>
) {
  if (!priceKey) {
    return investedValue;
  }

  const price = livePrices[priceKey];
  return typeof price === "number" && Number.isFinite(price) && price > 0
    ? Math.round(quantity * price * 100)
    : null;
}

function addNullableAmount(map: Map<string, number | null>, key: string, value: number | null) {
  const currentValue = map.get(key);
  if (currentValue === null || value === null) {
    map.set(key, null);
    return;
  }

  map.set(key, (currentValue ?? 0) + value);
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
