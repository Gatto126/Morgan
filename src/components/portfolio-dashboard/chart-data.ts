import type { ChartPoint } from "@/types/chart";
import { normalizeCryptoSymbol } from "@/domain/pricing/crypto-symbols";

import type { MonthBucket, PortfolioBucket, PortfolioData, PortfolioProviderSummary, TimeRange } from "./types";

const OPEN_HOLDING_THRESHOLD = 0.000001;
const BINANCE_PROVIDER_KEY = "BINANCE";

export function filterData(data: { monthly: MonthBucket[], daily: PortfolioBucket[] }, range: TimeRange): PortfolioBucket[] {
  if (range === "ALL") {
    return data.daily.length > 0 ? data.daily : data.monthly;
  }

  const cutoff = new Date();

  if (range === "1W") {
    cutoff.setDate(cutoff.getDate() - 7);
  } else if (range === "1M") {
    cutoff.setDate(cutoff.getDate() - 30);
  } else if (range === "3M") {
    cutoff.setMonth(cutoff.getMonth() - 3);
  } else if (range === "6M") {
    cutoff.setMonth(cutoff.getMonth() - 6);
  } else if (range === "1Y") {
    cutoff.setFullYear(cutoff.getFullYear() - 1);
  } else {
    return data.daily;
  }

  const cutoffKey = cutoff.toISOString().split("T")[0];
  return data.daily.filter(bucket => (bucket.date ?? "") >= cutoffKey);
}

type BuildPortfolioChartDataOptions = {
  data: PortfolioData;
  activeTab: string;
  timeRange: TimeRange;
  activeProvider: PortfolioProviderSummary | null;
  applyLiveToday?: boolean;
  currentValuationPoint?: ChartPoint | null;
  livePrices?: Record<string, number | null>;
  todayKey?: string;
};

export type PortfolioProviderHistoricalPoint = {
  dateKey: string;
  valueCents: number;
};

export function mergePortfolioDataWithProviderHistory(
  data: PortfolioData,
  providerKey: string,
  historicalPoints: PortfolioProviderHistoricalPoint[]
): PortfolioData {
  if (historicalPoints.length === 0) {
    return data;
  }

  const bucketsByDate = new Map<string, PortfolioBucket>();

  for (const bucket of data.dailyData) {
    const dateKey = bucket.date || bucket.month;
    bucketsByDate.set(dateKey, {
      ...bucket,
      providerProducts: { ...bucket.providerProducts },
      providers: { ...bucket.providers }
    });
  }

  for (const point of historicalPoints) {
    const existing = bucketsByDate.get(point.dateKey);
    if (existing) {
      const previousValue = existing.providers[providerKey] ?? 0;
      const nextProviders = {
        ...existing.providers,
        [providerKey]: point.valueCents
      };
      bucketsByDate.set(point.dateKey, {
        ...existing,
        date: point.dateKey,
        month: point.dateKey.slice(0, 7),
        providers: nextProviders,
        total: existing.total - previousValue + point.valueCents
      });
      continue;
    }

    bucketsByDate.set(point.dateKey, {
      date: point.dateKey,
      month: point.dateKey.slice(0, 7),
      providerProducts: {},
      providers: { [providerKey]: point.valueCents },
      total: point.valueCents
    });
  }

  return {
    ...data,
    dailyData: [...bucketsByDate.values()].sort((first, second) => {
      const firstKey = first.date || first.month;
      const secondKey = second.date || second.month;
      return firstKey.localeCompare(secondKey);
    })
  };
}

export function buildPortfolioChartData({
  data,
  activeTab,
  timeRange,
  activeProvider,
  applyLiveToday = true,
  currentValuationPoint,
  livePrices = {},
  todayKey
}: BuildPortfolioChartDataOptions) {
  const firstProductAcquisition = new Map<string, string>();
  const firstProviderAcquisition = new Map<string, string>();

  data.dailyData.forEach((bucket) => {
    const bucketDate = bucket.date || bucket.month || "";
    if (activeTab !== "ALL") {
      const prodData = bucket.providerProducts?.[activeTab] || {};
      Object.keys(prodData).forEach((productName) => {
        const value = prodData[productName];
        if (value && Math.abs(value) > 0.000001 && !firstProductAcquisition.has(productName)) {
          firstProductAcquisition.set(productName, bucketDate);
        }
      });
    }

    if (bucket.providers) {
      Object.keys(bucket.providers).forEach((providerKey) => {
        const value = bucket.providers[providerKey];
        if (value && Math.abs(value) > 0.000001 && !firstProviderAcquisition.has(providerKey)) {
          firstProviderAcquisition.set(providerKey, bucketDate);
        }
      });
    }
  });

  const filtered = filterData({ monthly: data.monthlyData, daily: data.dailyData }, timeRange);

  const chartPoints = filtered.map((bucket) => {
    const rawKey = bucket.date || bucket.month;
    const bucketDate = bucket.date || bucket.month || "";
    const point: ChartPoint = { month: rawKey, rawMonth: rawKey };

    if (activeTab === "ALL") {
      point.heritage = Math.abs(bucket.total);
      data.providers.forEach(provider => {
        const providerKey = provider.sourceInstitution;
        const value = bucket.providers[providerKey];
        const firstDate = firstProviderAcquisition.get(providerKey);
        const hasBeenAcquired = firstDate && bucketDate >= firstDate;

        if (value && Math.abs(value) > 0.000001) {
          point[providerKey] = Math.abs(value);
        } else if (hasBeenAcquired) {
          point[providerKey] = 0;
        } else {
          point[providerKey] = null;
        }
      });
    } else {
      point.heritage = Math.abs(bucket.total);
      data.providers.forEach(provider => {
        const providerKey = provider.sourceInstitution;
        const value = bucket.providers[providerKey];
        const firstDate = firstProviderAcquisition.get(providerKey);
        const hasBeenAcquired = firstDate && bucketDate >= firstDate;

        if (value && Math.abs(value) > 0.000001) {
          point[providerKey] = Math.abs(value);
        } else if (hasBeenAcquired) {
          point[providerKey] = 0;
        } else {
          point[providerKey] = null;
        }
      });

      point.balance = Math.abs(bucket.providers[activeTab] || 0);
      const prodData = bucket.providerProducts[activeTab] || {};

      activeProvider?.products.forEach(product => {
        const productName = product.productName;
        const value = prodData[productName];
        const firstDate = firstProductAcquisition.get(productName);
        const hasBeenAcquired = firstDate && bucketDate >= firstDate;

        if (value && Math.abs(value) > 0.000001) {
          point[productName] = Math.abs(value);
        } else if (hasBeenAcquired) {
          point[productName] = 0;
        } else {
          point[productName] = null;
        }
      });
    }
    return point;
  });

  if (!todayKey) {
    return chartPoints;
  }

  if (currentValuationPoint) {
    return applyCurrentValuationTodayPoint(chartPoints, {
      activeTab,
      currentValuationPoint,
      todayKey
    });
  }

  const chartDataWithToday = applyLiveToday
    ? applyLiveTodayPoint(chartPoints, {
        activeProvider,
        activeTab,
        data,
        livePrices,
        todayKey
      })
    : applyPendingTodayPoint(chartPoints, {
        activeProvider,
        activeTab,
        data,
        todayKey
      });

  return chartDataWithToday;
}

function applyCurrentValuationTodayPoint(
  chartPoints: ChartPoint[],
  {
    activeTab,
    currentValuationPoint,
    todayKey
  }: {
    activeTab: string;
    currentValuationPoint: ChartPoint;
    todayKey: string;
  }
) {
  const todayIndex = chartPoints.findIndex((point) => point.rawMonth === todayKey);
  const basePoint = todayIndex >= 0
    ? chartPoints[todayIndex]
    : chartPoints[chartPoints.length - 1] ?? { rawMonth: todayKey };
  const todayPoint: ChartPoint = {
    ...basePoint,
    ...currentValuationPoint,
    date: todayKey,
    month: todayKey,
    rawMonth: todayKey
  };

  if (activeTab !== "ALL") {
    todayPoint.balance = currentValuationPoint.balance ?? currentValuationPoint[activeTab] ?? null;
  }

  if (todayIndex >= 0) {
    const nextPoints = [...chartPoints];
    nextPoints[todayIndex] = todayPoint;
    return nextPoints;
  }

  return [...chartPoints, todayPoint];
}

export function getPortfolioXAxisTicks(chartData: ChartPoint[]) {
  const ticks: string[] = [];
  const seenMonths = new Set<string>();
  chartData.forEach((point) => {
    const rawMonth = point.rawMonth as string;
    if (!rawMonth) return;
    const monthKey = rawMonth.substring(0, 7);
    if (!seenMonths.has(monthKey)) {
      seenMonths.add(monthKey);
      ticks.push(rawMonth);
    }
  });
  return ticks;
}

function applyLiveTodayPoint(
  chartPoints: ChartPoint[],
  {
    activeProvider,
    activeTab,
    data,
    livePrices,
    todayKey
  }: {
    activeProvider: PortfolioProviderSummary | null;
    activeTab: string;
    data: PortfolioData;
    livePrices: Record<string, number | null>;
    todayKey: string;
  }
) {
  const todayIndex = chartPoints.findIndex((point) => point.rawMonth === todayKey);
  const basePoint = todayIndex >= 0
    ? chartPoints[todayIndex]
    : chartPoints[chartPoints.length - 1] ?? { rawMonth: todayKey };
  const providerTotals = new Map<string, number | null>();
  let allTotal: number | null = 0;

  data.providers.forEach((provider) => {
    const total = getProviderLiveTotal(provider, livePrices);
    providerTotals.set(provider.sourceInstitution, total);
    if (total === null) {
      allTotal = null;
    } else if (allTotal !== null) {
      allTotal += total;
    }
  });

  const todayPoint: ChartPoint = {
    ...basePoint,
    date: todayKey,
    heritage: allTotal,
    month: todayKey,
    rawMonth: todayKey
  };

  providerTotals.forEach((value, providerKey) => {
    todayPoint[providerKey] = value;
  });

  if (activeTab !== "ALL") {
    todayPoint.balance = providerTotals.get(activeTab) ?? null;

    activeProvider?.products.forEach((product) => {
      const productValue = getProductLiveValue(product, livePrices, {
        allowInvestedValueFallback: activeProvider.sourceInstitution === BINANCE_PROVIDER_KEY
      });
      if (Math.abs(product.quantity) > OPEN_HOLDING_THRESHOLD) {
        todayPoint[product.productName] = productValue;
      }
    });
  }

  if (todayIndex >= 0) {
    const nextPoints = [...chartPoints];
    nextPoints[todayIndex] = todayPoint;
    return nextPoints;
  }

  return [...chartPoints, todayPoint];
}

function applyPendingTodayPoint(
  chartPoints: ChartPoint[],
  {
    activeProvider,
    activeTab,
    data,
    todayKey
  }: {
    activeProvider: PortfolioProviderSummary | null;
    activeTab: string;
    data: PortfolioData;
    todayKey: string;
  }
) {
  const todayIndex = chartPoints.findIndex((point) => point.rawMonth === todayKey);
  const basePoint = todayIndex >= 0
    ? chartPoints[todayIndex]
    : chartPoints[chartPoints.length - 1] ?? { rawMonth: todayKey };
  const todayPoint: ChartPoint = {
    ...basePoint,
    date: todayKey,
    heritage: null,
    month: todayKey,
    rawMonth: todayKey
  };

  data.providers.forEach((provider) => {
    todayPoint[provider.sourceInstitution] = hasOpenProviderHoldings(provider) ? null : 0;
  });

  if (activeTab !== "ALL") {
    todayPoint.balance = null;
    activeProvider?.products.forEach((product) => {
      if (Math.abs(product.quantity) > 0.000001) {
        todayPoint[product.productName] = null;
      }
    });
  }

  if (todayIndex >= 0) {
    const nextPoints = [...chartPoints];
    nextPoints[todayIndex] = todayPoint;
    return nextPoints;
  }

  return [...chartPoints, todayPoint];
}

function hasOpenProviderHoldings(provider: PortfolioProviderSummary) {
  return provider.products.some((product) => Math.abs(product.quantity) > OPEN_HOLDING_THRESHOLD);
}

function getProviderLiveTotal(
  provider: PortfolioProviderSummary,
  livePrices: Record<string, number | null>
) {
  let liveTotal = 0;
  let hasHoldings = false;
  let hasPendingPrice = false;

  provider.products.forEach((product) => {
    if (Math.abs(product.quantity) <= OPEN_HOLDING_THRESHOLD) {
      return;
    }

    const productValue = getProductLiveValue(product, livePrices, {
      allowInvestedValueFallback: provider.sourceInstitution === BINANCE_PROVIDER_KEY
    });
    if (productValue === null) {
      hasHoldings = true;
      hasPendingPrice = true;
      return;
    }

    hasHoldings = true;
    liveTotal += productValue;
  });

  if (hasPendingPrice) {
    return null;
  }

  return hasHoldings ? liveTotal : 0;
}

function getProductLiveValue(
  product: PortfolioProviderSummary["products"][number],
  livePrices: Record<string, number | null>,
  { allowInvestedValueFallback = false }: { allowInvestedValueFallback?: boolean } = {}
) {
  if (Math.abs(product.quantity) <= OPEN_HOLDING_THRESHOLD) {
    return null;
  }

  const priceKey = normalizeCryptoSymbol(product.isin);
  const livePrice = priceKey ? livePrices[priceKey] : null;

  return typeof livePrice === "number" && Number.isFinite(livePrice) && livePrice > 0
    ? Math.round(product.quantity * livePrice * 100)
    : allowInvestedValueFallback && product.investedValue > 0
      ? product.investedValue
      : null;
}
