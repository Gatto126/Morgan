import type { DashboardChartPoint } from "./dashboard-chart-types";

export function hasRenderableLineSeries(chartData: DashboardChartPoint[], seriesKey: string) {
  const pointCount = chartData.reduce((count, point) => {
    const value = point[seriesKey];
    return typeof value === "number" && Number.isFinite(value) ? count + 1 : count;
  }, 0);

  return pointCount >= 2;
}
