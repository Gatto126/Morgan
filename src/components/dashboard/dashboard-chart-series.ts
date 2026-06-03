import type { DashboardChartPoint } from "./dashboard-chart-types";

export function getRenderableSeriesPointCount(chartData: DashboardChartPoint[], seriesKey: string) {
  return chartData.reduce((count, point) => {
    const value = point[seriesKey];
    return typeof value === "number" && Number.isFinite(value) ? count + 1 : count;
  }, 0);
}
