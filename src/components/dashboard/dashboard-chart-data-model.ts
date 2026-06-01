import { normalizeCryptoSymbol } from "@/domain/pricing/crypto-symbols";

import type { DashboardChartPoint } from "./dashboard-chart-types";
import { filterData } from "./formatters";
import type { AccountTab, DashboardData, MonthlyBucket, ProviderSummary, TimeRange } from "./types";

const NON_ZERO_THRESHOLD = 0.000001;

type BuildDashboardChartDataParams = {
  activeTab: AccountTab;
  binanceTotalCents: number;
  checkingProviders: string[];
  cryptoInstitutions: string[];
  cryptoTokens: string[];
  data: DashboardData | null;
  hasBinancePortfolio: boolean;
  investmentProducts: string[];
  livePriceReadiness?: {
    crypto?: boolean;
    investment?: boolean;
  };
  livePrices?: Record<string, number | null>;
  todayKey?: string;
  timeRange: TimeRange;
};

type DashboardChartBucket = MonthlyBucket & { date?: string };

export function collectCheckingProviders(data: DashboardData | null) {
  return collectMonthlyKeys(data, "providerChecking");
}

export function collectInvestmentProducts(data: DashboardData | null) {
  return collectUniqueKeys([
    ...collectMonthlyKeys(data, "providerProducts"),
    ...(data?.providerSummaries.flatMap((provider) =>
      provider.investmentProducts.map((product) => product.productName)
    ) ?? [])
  ]);
}

export function collectCryptoTokens(data: DashboardData | null) {
  return collectUniqueKeys([
    ...collectMonthlyKeys(data, "providerCryptoTokens"),
    ...(data?.providerSummaries.flatMap((provider) =>
      provider.cryptoTokens.map((token) => token.tokenName)
    ) ?? [])
  ]);
}

export function collectCryptoInstitutions(data: DashboardData | null) {
  if (!data) return [];

  return data.providerSummaries
    .filter((provider) => provider.cryptoTokens.some((token) => Math.abs(token.quantity) > NON_ZERO_THRESHOLD))
    .map((provider) => provider.sourceInstitution);
}

export function buildDashboardChartData({
  activeTab,
  binanceTotalCents,
  checkingProviders,
  cryptoInstitutions,
  cryptoTokens,
  data,
  hasBinancePortfolio,
  investmentProducts,
  livePriceReadiness,
  livePrices = {},
  todayKey,
  timeRange
}: BuildDashboardChartDataParams): DashboardChartPoint[] {
  if (!data) {
    return [];
  }

  const firstAcquisitionDates = getFirstAcquisitionDates({
    activeTab,
    cryptoInstitutions,
    data
  });
  const filtered = timeRange === "ALL"
    ? (data.dailyData.length > 0 ? data.dailyData : data.monthlyData) as DashboardChartBucket[]
    : filterData({ monthly: data.monthlyData, daily: data.dailyData }, timeRange) as DashboardChartBucket[];

  const chartPoints = filtered.map((bucket) => {
    const rawMonth = bucket.date || bucket.month;
    const bucketDate = bucket.date || bucket.month || "";
    const resolveValue = createValueResolver(firstAcquisitionDates, bucketDate);

    const checkingVal = resolveValue("checking", bucket.checking);
    const investmentVal = resolveValue("investment", bucket.investment);
    const cryptoVal = resolveValue("crypto", bucket.crypto);
    const cryptoWithBinance = cryptoVal !== null
      ? cryptoVal + binanceTotalCents
      : hasBinancePortfolio
        ? binanceTotalCents
        : null;
    const rawValue = resolveValue("value", bucket[activeTab]);
    const valueWithBinance = getTabValueWithBinance({
      activeTab,
      binanceTotalCents,
      hasBinancePortfolio,
      rawValue
    });

    const entry: DashboardChartPoint = {
      month: rawMonth,
      rawMonth,
      value: valueWithBinance,
      checking: checkingVal,
      investment: investmentVal,
      crypto: cryptoWithBinance,
      heritage: getHeritageValue({
        checkingVal,
        cryptoWithBinance,
        hasBinancePortfolio,
        investmentVal,
        binanceTotalCents
      })
    };

    checkingProviders.forEach((provider) => {
      entry[provider] = resolveValue(provider, bucket.providerChecking?.[provider]);
    });

    investmentProducts.forEach((product) => {
      entry[product] = resolveValue(product, bucket.providerProducts?.[product]);
    });

    cryptoTokens.forEach((token) => {
      entry[token] = resolveValue(token, bucket.providerCryptoTokens?.[token]);
    });

    cryptoInstitutions.forEach((institution) => {
      const institutionKey = `crypto_inst_${institution}`;
      const rawSum = cryptoTokens.reduce((sum, token) => {
        const value = bucket.providerCryptoTokens?.[token];
        return sum + (isMeaningfulValue(value) ? Math.abs(value) : 0);
      }, 0);
      entry[institutionKey] = resolveValue(institutionKey, rawSum > 0 ? rawSum : undefined);
    });

    entry.binance = hasBinancePortfolio ? binanceTotalCents : null;

    return entry;
  });

  return todayKey
    ? applyLiveTodayPoint(chartPoints, {
        activeTab,
        binanceTotalCents,
        data,
        hasBinancePortfolio,
        livePriceReadiness: {
          crypto: livePriceReadiness?.crypto ?? true,
          investment: livePriceReadiness?.investment ?? true
        },
        livePrices,
        todayKey
      })
    : chartPoints;
}

function collectMonthlyKeys(
  data: DashboardData | null,
  field: "providerChecking" | "providerProducts" | "providerCryptoTokens"
) {
  if (!data) return [];

  const keys = new Set<string>();
  data.monthlyData.forEach((bucket) => {
    const values = bucket[field];
    if (values) {
      Object.keys(values).forEach((key) => keys.add(key));
    }
  });
  return Array.from(keys);
}

function collectUniqueKeys(keys: string[]) {
  return [...new Set(keys.filter(Boolean))];
}

function getFirstAcquisitionDates({
  activeTab,
  cryptoInstitutions,
  data
}: {
  activeTab: AccountTab;
  cryptoInstitutions: string[];
  data: DashboardData;
}) {
  const firstAcquisitionDates = new Map<string, string>();

  data.dailyData.forEach((bucket) => {
    const bucketDate = bucket.date || bucket.month || "";

    setFirstDate(firstAcquisitionDates, "checking", bucket.checking, bucketDate);
    setFirstDate(firstAcquisitionDates, "investment", bucket.investment, bucketDate);
    setFirstDate(firstAcquisitionDates, "crypto", bucket.crypto, bucketDate);
    setFirstDate(firstAcquisitionDates, "value", bucket[activeTab], bucketDate);

    Object.entries(bucket.providerChecking ?? {}).forEach(([provider, value]) => {
      setFirstDate(firstAcquisitionDates, provider, value, bucketDate);
    });

    Object.entries(bucket.providerProducts ?? {}).forEach(([product, value]) => {
      setFirstDate(firstAcquisitionDates, product, value, bucketDate);
    });

    Object.entries(bucket.providerCryptoTokens ?? {}).forEach(([token, value]) => {
      setFirstDate(firstAcquisitionDates, token, value, bucketDate);
    });

    if (isMeaningfulValue(bucket.crypto)) {
      cryptoInstitutions.forEach((institution) => {
        const key = `crypto_inst_${institution}`;
        if (!firstAcquisitionDates.has(key)) {
          firstAcquisitionDates.set(key, bucketDate);
        }
      });
    }
  });

  return firstAcquisitionDates;
}

function setFirstDate(firstAcquisitionDates: Map<string, string>, key: string, value: number | undefined, bucketDate: string) {
  if (isMeaningfulValue(value) && !firstAcquisitionDates.has(key)) {
    firstAcquisitionDates.set(key, bucketDate);
  }
}

function createValueResolver(firstAcquisitionDates: Map<string, string>, bucketDate: string) {
  return (key: string, rawValue: number | undefined) => {
    const firstDate = firstAcquisitionDates.get(key);
    const hasBeenAcquired = firstDate && bucketDate >= firstDate;

    if (isMeaningfulValue(rawValue)) {
      return rawValue;
    }
    if (hasBeenAcquired) {
      return 0;
    }
    return null;
  };
}

function getTabValueWithBinance({
  activeTab,
  binanceTotalCents,
  hasBinancePortfolio,
  rawValue
}: {
  activeTab: AccountTab;
  binanceTotalCents: number;
  hasBinancePortfolio: boolean;
  rawValue: number | null;
}) {
  if (rawValue !== null) {
    return activeTab === "heritage" || activeTab === "crypto" ? rawValue + binanceTotalCents : rawValue;
  }

  return hasBinancePortfolio && (activeTab === "heritage" || activeTab === "crypto")
    ? binanceTotalCents
    : rawValue;
}

function getHeritageValue({
  checkingVal,
  cryptoWithBinance,
  hasBinancePortfolio,
  investmentVal,
  binanceTotalCents
}: {
  checkingVal: number | null;
  cryptoWithBinance: number | null;
  hasBinancePortfolio: boolean;
  investmentVal: number | null;
  binanceTotalCents: number;
}) {
  if (checkingVal === null && investmentVal === null && cryptoWithBinance === null) {
    return hasBinancePortfolio ? binanceTotalCents : null;
  }

  return (checkingVal || 0) + (investmentVal || 0) + (cryptoWithBinance || 0);
}

function isMeaningfulValue(value: number | undefined): value is number {
  return value !== undefined && Math.abs(value) > NON_ZERO_THRESHOLD;
}

function applyLiveTodayPoint(
  chartPoints: DashboardChartPoint[],
  {
    activeTab,
    binanceTotalCents,
    data,
    hasBinancePortfolio,
    livePriceReadiness,
    livePrices,
    todayKey
  }: {
    activeTab: AccountTab;
    binanceTotalCents: number;
    data: DashboardData;
    hasBinancePortfolio: boolean;
    livePriceReadiness: {
      crypto: boolean;
      investment: boolean;
    };
    livePrices: Record<string, number | null>;
    todayKey: string;
  }
) {
  const todayIndex = chartPoints.findIndex((point) => point.rawMonth === todayKey);
  const basePoint = todayIndex >= 0 ? chartPoints[todayIndex] : chartPoints[chartPoints.length - 1];
  const resolvedBasePoint = basePoint ?? { rawMonth: todayKey };
  const liveValues = buildLiveTodayValues({
    basePoint: resolvedBasePoint,
    binanceTotalCents,
    data,
    hasBinancePortfolio,
    livePriceReadiness,
    livePrices
  });
  const todayPoint: DashboardChartPoint = {
    ...resolvedBasePoint,
    ...liveValues,
    date: todayKey,
    month: todayKey,
    rawMonth: todayKey,
    value: getLiveTabValue(activeTab, liveValues)
  };
  const nextPoints = [...chartPoints];

  if (todayIndex >= 0) {
    nextPoints[todayIndex] = todayPoint;
    return nextPoints;
  }

  return [...nextPoints, todayPoint];
}

function buildLiveTodayValues({
  basePoint,
  binanceTotalCents,
  data,
  hasBinancePortfolio,
  livePriceReadiness,
  livePrices
}: {
  basePoint: DashboardChartPoint;
  binanceTotalCents: number;
  data: DashboardData;
  hasBinancePortfolio: boolean;
  livePriceReadiness: {
    crypto: boolean;
    investment: boolean;
  };
  livePrices: Record<string, number | null>;
}) {
  const checkingVal = typeof basePoint.checking === "number"
    ? basePoint.checking
    : data.accountTotals.checking;
  const investment = livePriceReadiness.investment
    ? getLiveInvestmentValues(data.providerSummaries, livePrices)
    : getPendingInvestmentValues(data.providerSummaries);
  const crypto = livePriceReadiness.crypto
    ? getLiveCryptoValues(data.providerSummaries, livePrices)
    : getPendingCryptoValues(data.providerSummaries);
  const investmentTotal = livePriceReadiness.investment ? investment.total : null;
  const cryptoWithBinance = livePriceReadiness.crypto
    ? crypto.total + (hasBinancePortfolio ? binanceTotalCents : 0)
    : null;
  const heritage = investmentTotal !== null && cryptoWithBinance !== null
    ? checkingVal + investmentTotal + cryptoWithBinance
    : null;
  const liveValues: DashboardChartPoint = {
    checking: checkingVal,
    investment: investmentTotal,
    crypto: cryptoWithBinance,
    heritage,
    binance: livePriceReadiness.crypto && hasBinancePortfolio ? binanceTotalCents : null
  };

  for (const [productName, value] of investment.products) {
    liveValues[productName] = value;
  }

  for (const [tokenName, value] of crypto.tokens) {
    liveValues[tokenName] = value;
  }

  for (const [institution, value] of crypto.institutions) {
    liveValues[`crypto_inst_${institution}`] = value;
  }

  return liveValues;
}

function getLiveInvestmentValues(
  providerSummaries: ProviderSummary[],
  livePrices: Record<string, number | null>
) {
  const products = new Map<string, number | null>();
  let total = 0;

  providerSummaries.forEach((provider) => {
    provider.investmentProducts.forEach((product) => {
      if (Math.abs(product.quantity) <= NON_ZERO_THRESHOLD) {
        return;
      }

      const livePrice = product.isin ? livePrices[product.isin] : null;
      const value = livePrice != null
        ? Math.round(product.quantity * livePrice * 100)
        : product.investedValue;

      total += value;
      products.set(product.productName, (products.get(product.productName) ?? 0) + value);
    });
  });

  return { products, total };
}

function getPendingInvestmentValues(providerSummaries: ProviderSummary[]) {
  const products = new Map<string, number | null>();
  providerSummaries.forEach((provider) => {
    provider.investmentProducts.forEach((product) => {
      if (Math.abs(product.quantity) > NON_ZERO_THRESHOLD) {
        products.set(product.productName, null);
      }
    });
  });

  return { products, total: 0 };
}

function getLiveCryptoValues(
  providerSummaries: ProviderSummary[],
  livePrices: Record<string, number | null>
) {
  const institutions = new Map<string, number | null>();
  const tokens = new Map<string, number | null>();
  let total = 0;

  providerSummaries.forEach((provider) => {
    let providerTotal = 0;

    provider.cryptoTokens.forEach((token) => {
      if (Math.abs(token.quantity) <= NON_ZERO_THRESHOLD) {
        return;
      }

      const tokenSymbol = normalizeCryptoSymbol(token.tokenSymbol);
      const livePrice = tokenSymbol ? livePrices[tokenSymbol] : null;
      const value = livePrice != null
        ? Math.round(token.quantity * livePrice * 100)
        : token.investedValue;

      providerTotal += value;
      total += value;
      tokens.set(token.tokenName, (tokens.get(token.tokenName) ?? 0) + value);
    });

    if (providerTotal > 0) {
      institutions.set(provider.sourceInstitution, providerTotal);
    }
  });

  return { institutions, tokens, total };
}

function getPendingCryptoValues(providerSummaries: ProviderSummary[]) {
  const institutions = new Map<string, number | null>();
  const tokens = new Map<string, number | null>();
  providerSummaries.forEach((provider) => {
    let hasProviderHoldings = false;
    provider.cryptoTokens.forEach((token) => {
      if (Math.abs(token.quantity) > NON_ZERO_THRESHOLD) {
        hasProviderHoldings = true;
        tokens.set(token.tokenName, null);
      }
    });

    if (hasProviderHoldings) {
      institutions.set(provider.sourceInstitution, null);
    }
  });

  return { institutions, tokens, total: 0 };
}

function getLiveTabValue(activeTab: AccountTab, liveValues: DashboardChartPoint) {
  const value = liveValues[activeTab];

  return typeof value === "number" ? value : null;
}
