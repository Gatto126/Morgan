import { normalizeCryptoSymbol } from "@/domain/pricing/crypto-symbols";
import type { ChartPoint } from "@/types/chart";

import { BINANCE_PORTFOLIO_PROVIDER_KEY } from "./binance-portfolio-provider";
import type { PortfolioDashboardConfig, PortfolioData, PortfolioProviderSummary } from "./types";

const OPEN_HOLDING_THRESHOLD = 0.000001;

type PortfolioCurrentSnapshotOptions = {
  activeProvider: PortfolioProviderSummary | null;
  activeTab: string;
  blockRootTotal?: boolean;
  data: PortfolioData | null;
  livePrices: Record<string, number | null>;
  priceQueryParam: PortfolioDashboardConfig["priceQueryParam"];
  pricesReady: boolean;
};

export function buildPortfolioCurrentSnapshot({
  activeProvider,
  activeTab,
  blockRootTotal = false,
  data,
  livePrices,
  priceQueryParam,
  pricesReady
}: PortfolioCurrentSnapshotOptions): ChartPoint | null {
  if (!data) {
    return null;
  }

  const point: ChartPoint = {
    rawMonth: getTodayKey()
  };
  let total: number | null = 0;

  for (const provider of data.providers) {
    const providerTotal = getProviderCurrentValue(provider, livePrices, priceQueryParam, pricesReady);
    point[provider.sourceInstitution] = providerTotal;

    if (providerTotal === null) {
      total = null;
    } else if (total !== null) {
      total += providerTotal;
    }
  }

  point.heritage = blockRootTotal ? null : total;

  if (activeTab !== "ALL") {
    point.balance = getPointNumber(point[activeTab]);

    activeProvider?.products.forEach((product) => {
      if (Math.abs(product.quantity) <= OPEN_HOLDING_THRESHOLD) {
        return;
      }

      point[product.productName] = getProductCurrentValue(
        product,
        livePrices,
        priceQueryParam,
        pricesReady,
        activeProvider.sourceInstitution === BINANCE_PORTFOLIO_PROVIDER_KEY
      );
    });
  }

  return point;
}

function getProviderCurrentValue(
  provider: PortfolioProviderSummary,
  livePrices: Record<string, number | null>,
  priceQueryParam: PortfolioDashboardConfig["priceQueryParam"],
  pricesReady: boolean
) {
  let hasOpenHoldings = false;
  let total: number | null = 0;
  const isBinanceProvider = provider.sourceInstitution === BINANCE_PORTFOLIO_PROVIDER_KEY;

  for (const product of provider.products) {
    if (Math.abs(product.quantity) <= OPEN_HOLDING_THRESHOLD) {
      continue;
    }

    hasOpenHoldings = true;
    const value = getProductCurrentValue(product, livePrices, priceQueryParam, pricesReady, isBinanceProvider);

    if (value === null) {
      total = null;
    } else if (total !== null) {
      total += value;
    }
  }

  return hasOpenHoldings ? total : 0;
}

function getProductCurrentValue(
  product: PortfolioProviderSummary["products"][number],
  livePrices: Record<string, number | null>,
  priceQueryParam: PortfolioDashboardConfig["priceQueryParam"],
  pricesReady: boolean,
  allowSyncedValueFallback = false
) {
  const priceKey = priceQueryParam === "cryptos" ? normalizeCryptoSymbol(product.isin) : product.isin;

  if (!priceKey) {
    return product.investedValue;
  }

  if (!pricesReady && !allowSyncedValueFallback) {
    return null;
  }

  const price = livePrices[priceKey];
  return typeof price === "number" && Number.isFinite(price) && price > 0
    ? Math.round(product.quantity * price * 100)
    : allowSyncedValueFallback && product.investedValue > 0
      ? product.investedValue
      : null;
}

function getPointNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
