import { normalizeCryptoSymbol } from "@/domain/pricing/crypto-symbols";

import type { DashboardChartPoint } from "./dashboard-chart-types";
import { filterData } from "./formatters";
import type { AccountTab, DashboardData, MonthlyBucket, ProviderSummary, TimeRange } from "./types";

const NON_ZERO_THRESHOLD = 0.000001;

type BuildDashboardChartDataParams = {
  applyLiveToday?: boolean;
  activeTab: AccountTab;
  binanceHistoricalPoints?: DashboardBinanceHistoricalPoint[];
  binanceTotalCents: number;
  checkingProviders: string[];
  currentValuationPoint?: DashboardChartPoint | null;
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

export type DashboardBinanceHistoricalPoint = {
  dateKey: string;
  valueCents: number;
};

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

function collectInvestmentInstitutions(data: DashboardData | null) {
  if (!data) return [];

  return data.providerSummaries
    .filter((provider) => provider.investmentProducts.length > 0)
    .map((provider) => provider.sourceInstitution);
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

function collectAllCryptoInstitutions(data: DashboardData | null) {
  if (!data) return [];

  return data.providerSummaries
    .filter((provider) => provider.cryptoTokens.length > 0)
    .map((provider) => provider.sourceInstitution);
}

export function buildDashboardChartData({
  applyLiveToday = true,
  activeTab,
  binanceHistoricalPoints = [],
  binanceTotalCents,
  checkingProviders,
  currentValuationPoint,
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

  const investmentInstitutions = collectInvestmentInstitutions(data);
  const allCryptoInstitutions = collectAllCryptoInstitutions(data);
  const binanceHistoryByDate = new Map(
    binanceHistoricalPoints.map((point) => [point.dateKey, point.valueCents])
  );
  const firstAcquisitionDates = getFirstAcquisitionDates({
    activeTab,
    investmentInstitutions,
    allCryptoInstitutions,
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
    const historicalBinanceValue = binanceHistoryByDate.has(bucketDate)
      ? binanceHistoryByDate.get(bucketDate) ?? null
      : null;

    const checkingVal = resolveValue("checking", bucket.checking);
    const investmentVal = resolveValue("investment", bucket.investment);
    const cryptoVal = resolveValue("crypto", bucket.crypto);
    const cryptoChartVal = historicalBinanceValue !== null
      ? (cryptoVal ?? 0) + historicalBinanceValue
      : cryptoVal;
    const rawValue = resolveValue("value", bucket[activeTab]);
    const heritage = getHeritageValue({
      checkingVal,
      cryptoChartVal,
      investmentVal
    });

    const entry: DashboardChartPoint = {
      month: rawMonth,
      rawMonth,
      value: getHistoricalTabValue(activeTab, {
        checkingVal,
        cryptoChartVal,
        heritage,
        investmentVal,
        rawValue
      }),
      checking: checkingVal,
      investment: investmentVal,
      crypto: cryptoChartVal,
      heritage
    };

    checkingProviders.forEach((provider) => {
      entry[provider] = resolveValue(provider, bucket.providerChecking?.[provider]);
    });

    investmentProducts.forEach((product) => {
      entry[product] = resolveValue(product, bucket.providerProducts?.[product]);
    });

    investmentInstitutions.forEach((institution) => {
      const institutionKey = `investment_inst_${institution}`;
      entry[institutionKey] = resolveValue(
        institutionKey,
        getProviderInvestmentBucketValue(bucket, data.providerSummaries, institution)
      );
    });

    cryptoTokens.forEach((token) => {
      entry[token] = resolveValue(token, bucket.providerCryptoTokens?.[token]);
    });

    allCryptoInstitutions.forEach((institution) => {
      const institutionKey = `crypto_inst_${institution}`;
      entry[institutionKey] = resolveValue(
        institutionKey,
        getProviderCryptoBucketValue(bucket, data.providerSummaries, institution)
      );
    });

    entry.binance = historicalBinanceValue;

    return entry;
  });

  if (!todayKey) {
    return trimDashboardChartDataToActiveWindow(removeStandaloneBinanceFromMainCryptoTabAggregate(chartPoints, activeTab), {
      activeTab,
      allCryptoInstitutions,
      cryptoTokens
    });
  }

  if (currentValuationPoint) {
    return trimDashboardChartDataToActiveWindow(removeStandaloneBinanceFromMainCryptoTabAggregate(applyCurrentValuationTodayPoint(chartPoints, {
      activeTab,
      currentValuationPoint,
      todayKey
    }), activeTab), {
      activeTab,
      allCryptoInstitutions,
      cryptoTokens
    });
  }

  const chartDataWithToday = applyLiveToday
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

  return trimDashboardChartDataToActiveWindow(removeStandaloneBinanceFromMainCryptoTabAggregate(chartDataWithToday, activeTab), {
    activeTab,
    allCryptoInstitutions,
    cryptoTokens
  });
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
  investmentInstitutions,
  allCryptoInstitutions,
  cryptoInstitutions,
  data
}: {
  activeTab: AccountTab;
  investmentInstitutions: string[];
  allCryptoInstitutions: string[];
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

    investmentInstitutions.forEach((institution) => {
      setFirstDate(
        firstAcquisitionDates,
        `investment_inst_${institution}`,
        getProviderInvestmentBucketValue(bucket, data.providerSummaries, institution),
        bucketDate
      );
    });

    Object.entries(bucket.providerCryptoTokens ?? {}).forEach(([token, value]) => {
      setFirstDate(firstAcquisitionDates, token, value, bucketDate);
    });

    allCryptoInstitutions.forEach((institution) => {
      setFirstDate(
        firstAcquisitionDates,
        `crypto_inst_${institution}`,
        getProviderCryptoBucketValue(bucket, data.providerSummaries, institution),
        bucketDate
      );
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

function getProviderInvestmentBucketValue(
  bucket: DashboardChartBucket,
  providerSummaries: ProviderSummary[],
  sourceInstitution: string
) {
  const providerValue = bucket.providerInvestment?.[sourceInstitution];
  if (providerValue !== undefined) {
    return providerValue;
  }

  const provider = providerSummaries.find((summary) => summary.sourceInstitution === sourceInstitution);
  if (!provider) {
    return undefined;
  }

  let hasKnownProduct = false;
  const total = provider.investmentProducts.reduce((sum, product) => {
    const value = bucket.providerProducts?.[product.productName];
    if (value === undefined) {
      return sum;
    }
    hasKnownProduct = true;
    return sum + value;
  }, 0);

  return hasKnownProduct ? total : undefined;
}

function getProviderCryptoBucketValue(
  bucket: DashboardChartBucket,
  providerSummaries: ProviderSummary[],
  sourceInstitution: string
) {
  const providerValue = bucket.providerCrypto?.[sourceInstitution];
  if (providerValue !== undefined) {
    return providerValue;
  }

  const provider = providerSummaries.find((summary) => summary.sourceInstitution === sourceInstitution);
  if (!provider) {
    return undefined;
  }

  let hasKnownToken = false;
  const total = provider.cryptoTokens.reduce((sum, token) => {
    const value = bucket.providerCryptoTokens?.[token.tokenName];
    if (value === undefined) {
      return sum;
    }
    hasKnownToken = true;
    return sum + value;
  }, 0);

  return hasKnownToken ? total : undefined;
}

function getHeritageValue({
  checkingVal,
  cryptoChartVal,
  investmentVal
}: {
  checkingVal: number | null;
  cryptoChartVal: number | null;
  investmentVal: number | null;
}) {
  if (checkingVal === null && investmentVal === null && cryptoChartVal === null) {
    return null;
  }

  return (checkingVal || 0) + (investmentVal || 0) + (cryptoChartVal || 0);
}

function getHistoricalTabValue(
  activeTab: AccountTab,
  {
    checkingVal,
    cryptoChartVal,
    heritage,
    investmentVal,
    rawValue
  }: {
    checkingVal: number | null;
    cryptoChartVal: number | null;
    heritage: number | null;
    investmentVal: number | null;
    rawValue: number | null;
  }
) {
  if (activeTab === "heritage") {
    return heritage;
  }
  if (activeTab === "crypto") {
    return cryptoChartVal;
  }
  if (activeTab === "checking") {
    return checkingVal ?? rawValue;
  }
  if (activeTab === "investment") {
    return investmentVal ?? rawValue;
  }

  return rawValue;
}

function isMeaningfulValue(value: number | undefined): value is number {
  return value !== undefined && Math.abs(value) > NON_ZERO_THRESHOLD;
}

function isMeaningfulPointValue(value: DashboardChartPoint[string]) {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) > NON_ZERO_THRESHOLD;
}

function isFinitePointValue(value: DashboardChartPoint[string]): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function removeStandaloneBinanceFromMainCryptoTabAggregate(chartPoints: DashboardChartPoint[], activeTab: AccountTab) {
  if (activeTab !== "crypto") {
    return chartPoints;
  }

  const binancePointCount = chartPoints.reduce((count, point) =>
    isFinitePointValue(point.binance) ? count + 1 : count
  , 0);

  if (binancePointCount !== 1) {
    return chartPoints;
  }

  const aggregateKeys = ["crypto", "heritage", "value"];

  return chartPoints.map((point) => {
    const binanceValue = point.binance;

    if (!isFinitePointValue(binanceValue)) {
      return point;
    }

    const nextPoint: DashboardChartPoint = { ...point };
    const cryptoValue = nextPoint.crypto;
    const heritageValue = nextPoint.heritage;

    if (isFinitePointValue(cryptoValue)) {
      nextPoint.topbar_crypto = cryptoValue;
    }
    if (isFinitePointValue(heritageValue)) {
      nextPoint.topbar_heritage = heritageValue;
    }

    aggregateKeys.forEach((key) => {
      const value = nextPoint[key];
      if (isFinitePointValue(value)) {
        nextPoint[key] = value - binanceValue;
      }
    });

    return nextPoint;
  });
}

function trimDashboardChartDataToActiveWindow(
  chartPoints: DashboardChartPoint[],
  {
    activeTab,
    allCryptoInstitutions,
    cryptoTokens
  }: {
    activeTab: AccountTab;
    allCryptoInstitutions: string[];
    cryptoTokens: string[];
  }
) {
  if (activeTab !== "crypto") {
    return chartPoints;
  }

  const activeSeriesKeys = [
    "value",
    "crypto",
    "binance",
    ...allCryptoInstitutions.map((institution) => `crypto_inst_${institution}`),
    ...cryptoTokens
  ];
  const firstActiveIndex = chartPoints.findIndex((point) =>
    activeSeriesKeys.some((key) => isMeaningfulPointValue(point[key]))
  );

  if (firstActiveIndex <= 0) {
    return chartPoints;
  }

  return chartPoints.slice(firstActiveIndex);
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

function applyCurrentValuationTodayPoint(
  chartPoints: DashboardChartPoint[],
  {
    activeTab,
    currentValuationPoint,
    todayKey
  }: {
    activeTab: AccountTab;
    currentValuationPoint: DashboardChartPoint;
    todayKey: string;
  }
) {
  const todayIndex = chartPoints.findIndex((point) => point.rawMonth === todayKey);
  const basePoint = todayIndex >= 0 ? chartPoints[todayIndex] : chartPoints[chartPoints.length - 1];
  const resolvedBasePoint = basePoint ?? { rawMonth: todayKey };
  const todayPoint: DashboardChartPoint = {
    ...resolvedBasePoint,
    ...currentValuationPoint,
    date: todayKey,
    month: todayKey,
    rawMonth: todayKey,
    value: getLiveTabValue(activeTab, currentValuationPoint)
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
    ? crypto.total !== null
      ? crypto.total + (hasBinancePortfolio ? binanceTotalCents : 0)
      : null
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

  for (const [institution, value] of investment.institutions) {
    liveValues[`investment_inst_${institution}`] = value;
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
  const institutions = new Map<string, number | null>();
  const products = new Map<string, number | null>();
  let total: number | null = 0;

  providerSummaries.forEach((provider) => {
    let providerTotal = 0;
    let hasOpenHoldings = false;
    let providerPending = false;

    provider.investmentProducts.forEach((product) => {
      if (Math.abs(product.quantity) <= NON_ZERO_THRESHOLD) {
        return;
      }

      hasOpenHoldings = true;
      const livePrice = product.isin ? livePrices[product.isin] : null;
      const value = isUsableLivePrice(livePrice)
        ? Math.round(product.quantity * livePrice * 100)
        : null;

      if (value === null) {
        providerPending = true;
        total = null;
        addNullableAmount(products, product.productName, null);
        return;
      }

      providerTotal += value;
      if (total !== null) {
        total += value;
      }
      addNullableAmount(products, product.productName, value);
    });

    if (provider.investmentProducts.length > 0) {
      institutions.set(provider.sourceInstitution, providerPending ? null : hasOpenHoldings ? providerTotal : 0);
    }
  });

  return { institutions, products, total };
}

function getPendingInvestmentValues(providerSummaries: ProviderSummary[]) {
  const institutions = new Map<string, number | null>();
  const products = new Map<string, number | null>();
  providerSummaries.forEach((provider) => {
    let hasProviderHoldings = false;

    provider.investmentProducts.forEach((product) => {
      if (Math.abs(product.quantity) > NON_ZERO_THRESHOLD) {
        hasProviderHoldings = true;
        products.set(product.productName, null);
      }
    });

    if (hasProviderHoldings) {
      institutions.set(provider.sourceInstitution, null);
    }
  });

  return { institutions, products, total: 0 };
}

function getLiveCryptoValues(
  providerSummaries: ProviderSummary[],
  livePrices: Record<string, number | null>
) {
  const institutions = new Map<string, number | null>();
  const tokens = new Map<string, number | null>();
  let total: number | null = 0;

  providerSummaries.forEach((provider) => {
    let providerTotal = 0;
    let hasOpenHoldings = false;
    let providerPending = false;

    provider.cryptoTokens.forEach((token) => {
      if (Math.abs(token.quantity) <= NON_ZERO_THRESHOLD) {
        return;
      }

      hasOpenHoldings = true;
      const tokenSymbol = normalizeCryptoSymbol(token.tokenSymbol);
      const livePrice = tokenSymbol ? livePrices[tokenSymbol] : null;
      const value = isUsableLivePrice(livePrice)
        ? Math.round(token.quantity * livePrice * 100)
        : null;

      if (value === null) {
        providerPending = true;
        total = null;
        addNullableAmount(tokens, token.tokenName, null);
        return;
      }

      providerTotal += value;
      if (total !== null) {
        total += value;
      }
      addNullableAmount(tokens, token.tokenName, value);
    });

    if (provider.cryptoTokens.length > 0) {
      institutions.set(provider.sourceInstitution, providerPending ? null : hasOpenHoldings ? providerTotal : 0);
    }
  });

  return { institutions, tokens, total };
}

function isUsableLivePrice(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function addNullableAmount(map: Map<string, number | null>, key: string, value: number | null) {
  const currentValue = map.get(key);
  if (currentValue === null || value === null) {
    map.set(key, null);
    return;
  }

  map.set(key, (currentValue ?? 0) + value);
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
