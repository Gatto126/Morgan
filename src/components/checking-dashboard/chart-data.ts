import type { ChartPoint } from "@/types/chart";

import type { CheckingBucket, CheckingData, MonthBucket, TimeRange } from "./types";

export function filterCheckingData(
  data: { monthly: MonthBucket[], daily: CheckingBucket[] },
  range: TimeRange
): CheckingBucket[] {
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

type BuildCheckingChartDataOptions = {
  data: CheckingData;
  activeTab: string;
  timeRange: TimeRange;
};

export function buildCheckingChartData({
  data,
  activeTab,
  timeRange
}: BuildCheckingChartDataOptions): ChartPoint[] {
  const filtered = filterCheckingData({ monthly: data.monthlyData, daily: data.dailyData }, timeRange);

  return filtered.map((bucket) => {
    const rawKey = bucket.date || bucket.month;
    const point: ChartPoint = {
      month: rawKey,
      rawMonth: rawKey
    };

    if (activeTab === "ALL") {
      point.heritage = Math.abs(bucket.total);

      data.providers.forEach(provider => {
        const providerKey = provider.sourceInstitution;
        const value = bucket.providers[providerKey];
        point[providerKey] = value !== undefined ? Math.abs(value) : null;
      });

      return point;
    }

    const balance = bucket.providers[activeTab];
    const income = bucket.providerIncome[activeTab];
    const expenses = bucket.providerExpenses[activeTab];
    const hasBalance = balance !== undefined;

    point.balance = hasBalance ? Math.abs(balance) : null;
    point.income = hasBalance ? Math.abs(income || 0) : null;
    point.expenses = hasBalance ? Math.abs(expenses || 0) : null;
    point.heritage = Math.abs(bucket.total);

    data.providers.forEach(provider => {
      const providerKey = provider.sourceInstitution;
      const value = bucket.providers[providerKey];
      point[providerKey] = value !== undefined ? Math.abs(value) : null;
    });

    return point;
  });
}

export function getCheckingXAxisTicks(chartData: ChartPoint[]) {
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
