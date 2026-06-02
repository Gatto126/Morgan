import {
  selectCurrentPortfolioValuationChartPoint,
  type CurrentValuationSnapshot
} from "@/components/finance-shell/current-valuations-store";
import { getUtcDateKey } from "@/shared/date-keys";
import type { ChartPoint } from "@/types/chart";

type PortfolioValuationStage = "investment" | "crypto";

type PortfolioValuationVersionParams = {
  binanceRefreshKey: number;
  dateKey?: string;
  stage: PortfolioValuationStage;
  transactionCount: number;
};

type SelectPortfolioCurrentValuationPointParams = PortfolioValuationVersionParams & {
  activeTab: string;
  dataFresh: boolean;
};

export function isPortfolioValuationSnapshotCurrent(
  snapshot: CurrentValuationSnapshot | null,
  {
    binanceRefreshKey,
    dateKey = getUtcDateKey(),
    stage,
    transactionCount
  }: PortfolioValuationVersionParams
): snapshot is CurrentValuationSnapshot {
  if (!snapshot || snapshot.version.dateKey !== dateKey) {
    return false;
  }

  if (stage === "investment") {
    return snapshot.version.investmentCount === transactionCount;
  }

  return snapshot.version.cryptoCount === transactionCount
    && snapshot.version.binanceRefreshKey === binanceRefreshKey;
}

export function selectPortfolioCurrentValuationPoint(
  snapshot: CurrentValuationSnapshot | null,
  {
    activeTab,
    dataFresh,
    ...versionParams
  }: SelectPortfolioCurrentValuationPointParams
): ChartPoint | null {
  if (!dataFresh || !isPortfolioValuationSnapshotCurrent(snapshot, versionParams)) {
    return null;
  }

  return selectCurrentPortfolioValuationChartPoint(snapshot, versionParams.stage, activeTab);
}
