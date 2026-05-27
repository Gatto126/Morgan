import type { ChartPoint } from "@/types/chart";

import type { MonthBucket, PortfolioBucket, PortfolioData, PortfolioProviderSummary, TimeRange } from "./types";

export function filterData(data: { monthly: MonthBucket[], daily: PortfolioBucket[] }, range: TimeRange): PortfolioBucket[] {
  if (range === "ALL") {
    return data.daily;
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
};

export function buildPortfolioChartData({
  data,
  activeTab,
  timeRange,
  activeProvider
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

  return filtered.map((bucket) => {
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
