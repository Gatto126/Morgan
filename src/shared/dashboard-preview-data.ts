import type { BinanceHistoricalPoint } from "@/types/binance-history";

type DashboardPreviewBucket = {
  checking: number;
  crypto: number;
  date?: string;
  heritage: number;
  investment: number;
  month: string;
};

type DashboardPreviewLike = {
  accountTotals: unknown;
  binanceHistoricalPoints?: BinanceHistoricalPoint[];
  dailyData: DashboardPreviewBucket[];
  monthlyData: DashboardPreviewBucket[];
  providerSummaries: unknown;
};

function toPreviewMonthlyBucket(bucket: DashboardPreviewBucket): DashboardPreviewBucket {
  return {
    checking: bucket.checking,
    crypto: bucket.crypto,
    heritage: bucket.heritage,
    investment: bucket.investment,
    month: bucket.month
  };
}

function toPreviewDailyBucket(bucket: DashboardPreviewBucket): DashboardPreviewBucket {
  return {
    ...toPreviewMonthlyBucket(bucket),
    date: bucket.date
  };
}

export function toDashboardPreviewData<TData extends DashboardPreviewLike>(data: TData): TData {
  return {
    accountTotals: data.accountTotals,
    binanceHistoricalPoints: data.binanceHistoricalPoints ?? [],
    dailyData: data.dailyData.map(toPreviewDailyBucket),
    monthlyData: data.monthlyData.map(toPreviewMonthlyBucket),
    providerSummaries: data.providerSummaries
  } as TData;
}
