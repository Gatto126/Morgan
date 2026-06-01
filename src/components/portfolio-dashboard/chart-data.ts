import type { ChartPoint } from "@/types/chart";
import { normalizeCryptoSymbol } from "@/domain/pricing/crypto-symbols";

import type { MonthBucket, PortfolioBucket, PortfolioData, PortfolioProviderSummary, TimeRange } from "./types";

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
  livePrices?: Record<string, number | null>;
  todayKey?: string;
};

export function buildPortfolioChartData({
  data,
  activeTab,
  timeRange,
  activeProvider,
  applyLiveToday = true,
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

  return todayKey && applyLiveToday
    ? applyLiveTodayPoint(chartPoints, {
        activeProvider,
        activeTab,
        data,
        livePrices,
        todayKey
      })
    : chartPoints;
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
  const providerTotals = new Map<string, number>();
  let allTotal = 0;

  data.providers.forEach((provider) => {
    const total = getProviderLiveTotal(provider, livePrices);
    providerTotals.set(provider.sourceInstitution, total);
    allTotal += total;
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
    todayPoint.balance = providerTotals.get(activeTab) ?? 0;

    activeProvider?.products.forEach((product) => {
      const productValue = getProductLiveValue(product, livePrices);
      if (productValue !== null) {
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

function getProviderLiveTotal(
  provider: PortfolioProviderSummary,
  livePrices: Record<string, number | null>
) {
  let liveTotal = 0;
  let hasHoldings = false;

  provider.products.forEach((product) => {
    const productValue = getProductLiveValue(product, livePrices);
    if (productValue === null) {
      return;
    }

    hasHoldings = true;
    liveTotal += productValue;
  });

  return hasHoldings ? liveTotal : provider.total;
}

function getProductLiveValue(
  product: PortfolioProviderSummary["products"][number],
  livePrices: Record<string, number | null>
) {
  if (Math.abs(product.quantity) <= 0.000001) {
    return null;
  }

  const priceKey = normalizeCryptoSymbol(product.isin);
  const livePrice = priceKey ? livePrices[priceKey] : null;

  return livePrice != null
    ? Math.round(product.quantity * livePrice * 100)
    : product.investedValue;
}
