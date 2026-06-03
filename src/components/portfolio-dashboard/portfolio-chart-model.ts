import type { ChartLegendItem } from "@/components/chart-primitives/chart-legend";

import { GRAYSCALE_PALETTE } from "./constants";
import { formatProviderLabel, getMonthLabel } from "./formatters";
import type { PortfolioProviderSummary } from "./types";
import type { ChartPoint } from "@/types/chart";

export const PORTFOLIO_TOOLTIP_PRIORITY_NAMES = ["heritage", "value", "balance"] as const;

export function formatPortfolioTooltipLabel(label?: string) {
  let formattedLabel = label || "";
  if (formattedLabel.length === 10) {
    const [year, month, day] = formattedLabel.split("-");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const shortYear = year.slice(2);
    formattedLabel = `${day} ${monthNames[Number.parseInt(month, 10) - 1]} ${shortYear}`;
  } else if (formattedLabel.length === 7) {
    formattedLabel = getMonthLabel(formattedLabel);
  }

  return formattedLabel;
}

export function formatPortfolioTooltipSeriesLabel(name: string, aggregateLabel = "HERITAGE") {
  if (name === "value" || name === "balance") return "BALANCE";
  if (name === "heritage") return aggregateLabel;
  return formatProviderLabel(name);
}

export function formatPortfolioXAxisTick(value: string) {
  if (!value) return "";
  if (value.length === 7) return getMonthLabel(value);
  const [year, month] = value.split("-");
  return getMonthLabel(`${year}-${month}`);
}

export function getPortfolioAllLegendItems(
  providers: PortfolioProviderSummary[],
  aggregateLabel = "HERITAGE"
): ChartLegendItem[] {
  return ["heritage", ...providers.map((provider) => provider.sourceInstitution)].map((key, index) => ({
    key,
    label: key === "heritage" ? aggregateLabel : formatProviderLabel(key),
    color: key === "heritage" ? "#ffffff" : GRAYSCALE_PALETTE[(index - 1) % GRAYSCALE_PALETTE.length]
  }));
}

export function getPortfolioProviderLegendItems(
  activeProvider: PortfolioProviderSummary | null,
  showSoldAssets: boolean
): ChartLegendItem[] {
  const productNames = activeProvider?.products
    .filter((product) => showSoldAssets || Math.abs(product.quantity) > 0.000001)
    .map((product) => product.productName) ?? [];

  return ["balance", ...productNames].map((key, index) => {
    const isBalance = key === "balance";
    return {
      key,
      label: isBalance ? "BALANCE" : key,
      color: isBalance ? "#ffffff" : GRAYSCALE_PALETTE[(index - 1) % GRAYSCALE_PALETTE.length],
      labelClassName: "truncate"
    };
  });
}

export function getPortfolioNumericSeriesPointCount(chartData: ChartPoint[], seriesKey: string) {
  return chartData.reduce((count, point) => {
    const value = point[seriesKey];
    return typeof value === "number" && Number.isFinite(value) ? count + 1 : count;
  }, 0);
}

export function hasRenderablePortfolioLineSeries(chartData: ChartPoint[], seriesKey: string) {
  return getPortfolioNumericSeriesPointCount(chartData, seriesKey) >= 2;
}

export function hasStandalonePortfolioPointSeries(chartData: ChartPoint[], seriesKey: string) {
  return getPortfolioNumericSeriesPointCount(chartData, seriesKey) === 1;
}

export function shouldRenderStandalonePortfolioPointSeries(
  chartData: ChartPoint[],
  seriesKey: string,
  isAggregateVisible: boolean
) {
  return !isAggregateVisible && hasStandalonePortfolioPointSeries(chartData, seriesKey);
}
