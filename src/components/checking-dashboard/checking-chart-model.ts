import type { ChartLegendItem } from "@/components/chart-primitives/chart-legend";

import { GRAYSCALE_PALETTE } from "./constants";
import { formatProviderLabel, getMonthLabel } from "./formatters";
import type { CheckingProviderSummary } from "./types";

const checkingAxisFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0
});

export function formatCheckingTooltipLabel(label?: string) {
  let formattedLabel = label || "";
  if (formattedLabel.length === 10) {
    const [year, month, day] = formattedLabel.split("-");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    formattedLabel = `${day} ${monthNames[Number.parseInt(month, 10) - 1]} ${year.slice(2)}`;
  } else if (formattedLabel.length === 7) {
    formattedLabel = getMonthLabel(formattedLabel);
  }

  return formattedLabel;
}

export function formatCheckingTooltipSeriesLabel(name: string) {
  if (name === "value") return "TOTAL";
  if (name === "heritage") return "HERITAGE";
  if (name === "balance") return "BALANCE";
  if (name === "income") return "INCOME";
  if (name === "expenses") return "EXPENSES";
  return formatProviderLabel(name);
}

export function formatCheckingXAxisTick(value: string) {
  if (!value) return "";
  if (value.length === 7) return getMonthLabel(value);
  const [year, month] = value.split("-");
  return getMonthLabel(`${year}-${month}`);
}

export function formatCheckingYAxisTick(value: number, isMobile: boolean) {
  if (isMobile && value >= 100000) {
    return `${Math.round(value / 100000)}k`;
  }

  return checkingAxisFormatter.format(value / 100);
}

export function getCheckingAllLegendItems(providers: CheckingProviderSummary[]): ChartLegendItem[] {
  return ["heritage", ...providers.map((provider) => provider.sourceInstitution)].map((key, index) => ({
    key,
    label: key === "heritage" ? "HERITAGE" : formatProviderLabel(key),
    color: key === "heritage" ? "#ffffff" : GRAYSCALE_PALETTE[(index - 1) % GRAYSCALE_PALETTE.length]
  }));
}

export function getCheckingMetricLegendItems(): ChartLegendItem[] {
  return [
    { key: "balance", label: "balance", color: "#ffffff" },
    { key: "income", label: "income", color: "#8f8f8f" },
    { key: "expenses", label: "expenses", color: "#404040" }
  ];
}
