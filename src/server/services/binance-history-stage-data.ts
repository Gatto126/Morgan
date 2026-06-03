import type { PerformanceTrace } from "@/server/logging/performance";
import type { BinanceHistoricalPoint } from "@/types/binance-history";

import { getBinanceDailySnapshotHistory } from "./binance-daily-snapshot";

type BinanceHistoryStageOptions = {
  trace?: PerformanceTrace;
};

export async function getBinanceHistoricalPointsForStage(
  userId: string,
  { trace }: BinanceHistoryStageOptions = {}
): Promise<BinanceHistoricalPoint[]> {
  const snapshots = await getBinanceDailySnapshotHistory(userId, { trace });

  return snapshots.map((snapshot) => ({
    dateKey: snapshot.dateKey,
    valueCents: Math.round(snapshot.totalEurValue * 100)
  }));
}

export async function withBinanceHistoryForDashboardStage<TData extends object>(
  data: TData,
  userId: string,
  options: BinanceHistoryStageOptions = {}
): Promise<TData & { binanceHistoricalPoints: BinanceHistoricalPoint[] }> {
  return {
    ...data,
    binanceHistoricalPoints: await getBinanceHistoricalPointsForStage(userId, options)
  };
}
