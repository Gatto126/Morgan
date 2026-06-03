import type { DashboardChartPoint } from "./dashboard-chart-types";

export function getNumericSeriesPointCount(chartData: DashboardChartPoint[], seriesKey: string) {
  return chartData.reduce((count, point) => {
    const value = point[seriesKey];
    return typeof value === "number" && Number.isFinite(value) ? count + 1 : count;
  }, 0);
}

export function hasRenderableLineSeries(chartData: DashboardChartPoint[], seriesKey: string) {
  return getNumericSeriesPointCount(chartData, seriesKey) >= 2;
}

export function hasStandalonePointSeries(chartData: DashboardChartPoint[], seriesKey: string) {
  return getNumericSeriesPointCount(chartData, seriesKey) === 1;
}

export function shouldRenderStandalonePointSeries(
  chartData: DashboardChartPoint[],
  seriesKey: string
) {
  return hasStandalonePointSeries(chartData, seriesKey);
}
