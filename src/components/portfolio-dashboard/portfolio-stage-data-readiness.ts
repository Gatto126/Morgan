import type { PortfolioData } from "./types";

export function hasUsablePortfolioStageData(data: PortfolioData, transactionCount: number) {
  if (transactionCount <= 0) {
    return true;
  }

  const timeline = [...data.dailyData, ...data.monthlyData];
  const hasTimeline = timeline.length > 0;
  const hasTimelineValues = timeline.some((bucket) =>
    Math.abs(bucket.total) > 0.000001
    || Object.keys(bucket.providers).length > 0
    || Object.keys(bucket.providerProducts).length > 0
  );

  return hasTimeline && (data.providers.length > 0 || hasTimelineValues);
}
