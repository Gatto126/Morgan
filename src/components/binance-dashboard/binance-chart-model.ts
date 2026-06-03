import type { ChartPoint } from "@/types/chart";

export type BinanceTimeRange = "ALL" | "1Y" | "6M" | "3M" | "1M" | "1W";

export const BINANCE_TIME_RANGES = ["ALL", "1Y", "6M", "3M", "1M", "1W"] as const;
export const BINANCE_TOOLTIP_PRIORITY_NAMES = ["balance"] as const;
export const BINANCE_CHART_LEGEND_ITEMS = [{ key: "balance", label: "BALANCE", color: "#ffffff" }] as const;

export type BinanceHistoricalSnapshotPoint = {
  dateKey: string;
  totalEurValue: number;
};

const euroFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2
});

export function formatBinanceEuroCents(cents: number) {
  return euroFormatter.format(cents / 100);
}

export function formatBinanceEuro(value: number) {
  return euroFormatter.format(value);
}

export function getBinanceMonthLabel(month: string) {
  const [year, m] = month.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const shortYear = year.slice(2);
  return `${monthNames[Number.parseInt(m, 10) - 1]} ${shortYear}`;
}

export function formatBinanceTooltipLabel(label?: string) {
  let formattedLabel = label || "";
  if (formattedLabel.length === 10) {
    const [year, month, day] = formattedLabel.split("-");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const shortYear = year.slice(2);
    formattedLabel = `${day} ${monthNames[Number.parseInt(month, 10) - 1]} ${shortYear}`;
  } else if (formattedLabel.length === 7) {
    formattedLabel = getBinanceMonthLabel(formattedLabel);
  }

  return formattedLabel;
}

export function formatBinanceTooltipSeriesLabel() {
  return "BINANCE";
}

function toDateKey(date: Date) {
  return date.toISOString().split("T")[0];
}

function toChartPoint(dateKey: string, valueEur: number): ChartPoint {
  return {
    date: dateKey,
    rawMonth: dateKey,
    balance: Math.round(valueEur * 100)
  };
}

export function buildBinanceDailyChartData(
  totalEur: number,
  historicalSnapshots: BinanceHistoricalSnapshotPoint[] = [],
  today = new Date()
): ChartPoint[] {
  const pointsByDate = new Map<string, ChartPoint>();

  for (const snapshot of historicalSnapshots) {
    pointsByDate.set(snapshot.dateKey, toChartPoint(snapshot.dateKey, snapshot.totalEurValue));
  }

  if (totalEur > 0) {
    const todayKey = toDateKey(today);
    pointsByDate.set(todayKey, toChartPoint(todayKey, totalEur));
  }

  return [...pointsByDate.values()].sort((first, second) => first.rawMonth.localeCompare(second.rawMonth));
}

export function filterBinanceChartData(
  daily: ChartPoint[],
  range: BinanceTimeRange,
  today = new Date()
) {
  if (range === "ALL") return daily;

  const cutoff = new Date(today);
  if (range === "1W") cutoff.setDate(cutoff.getDate() - 7);
  else if (range === "1M") cutoff.setDate(cutoff.getDate() - 30);
  else if (range === "3M") cutoff.setMonth(cutoff.getMonth() - 3);
  else if (range === "6M") cutoff.setMonth(cutoff.getMonth() - 6);
  else if (range === "1Y") cutoff.setFullYear(cutoff.getFullYear() - 1);

  const cutoffKey = cutoff.toISOString().split("T")[0];
  return daily.filter((point) => (point.date ?? "") >= cutoffKey);
}

export function getBinanceXAxisTicks(chartData: ChartPoint[]) {
  const ticks: string[] = [];
  const seenMonths = new Set<string>();

  chartData.forEach((point) => {
    const rawMonth = point.rawMonth;
    if (!rawMonth) return;

    const monthKey = rawMonth.substring(0, 7);
    if (!seenMonths.has(monthKey)) {
      seenMonths.add(monthKey);
      ticks.push(rawMonth);
    }
  });

  return ticks;
}

export function formatBinanceXAxisTick(value: string) {
  if (!value) return "";
  if (value.length === 7) return getBinanceMonthLabel(value);
  const [year, month] = value.split("-");
  return getBinanceMonthLabel(`${year}-${month}`);
}
