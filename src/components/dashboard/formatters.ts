import type { DailyBucket, MonthlyBucket, TimeRange } from "./types";

export const euroFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2
});

export function formatEuroCents(cents: number) {
  const { number, symbol } = formatEuroParts(cents);
  return `${number} ${symbol}`;
}

export function formatEuroParts(cents: number): { number: string; symbol: string } {
  const parts = euroFormatter.formatToParts(cents / 100);
  const symbol = parts.find((p) => p.type === "currency")?.value ?? "EUR";
  const number = parts.filter((p) => p.type !== "currency" && p.type !== "literal").map((p) => p.value).join("").trim();
  return { number, symbol };
}

export function formatProviderLabel(source: string) {
  return source.replace(/_/g, " ").toUpperCase();
}

export function getMonthLabel(month: string) {
  const [year, m] = month.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const shortYear = year.slice(2);
  return `${monthNames[Number.parseInt(m, 10) - 1]} ${shortYear}`;
}

export function filterData(data: { monthly: MonthlyBucket[]; daily: DailyBucket[] }, range: TimeRange): (MonthlyBucket & { date?: string })[] {
  if (range === "ALL") {
    return data.daily;
  }

  const cutoff = new Date();

  if (range === "1W") {
    cutoff.setDate(cutoff.getDate() - 7);
  } else if (range === "1M") {
    cutoff.setDate(cutoff.getDate() - 30);
  } else if (range === "3M") {
    cutoff.setMonth(cutoff.getMonth() - 3);
  } else if (range === "6M") {
    cutoff.setMonth(cutoff.getMonth() - 6);
  } else if (range === "1Y") {
    cutoff.setFullYear(cutoff.getFullYear() - 1);
  } else {
    return data.daily;
  }

  const cutoffKey = cutoff.toISOString().split("T")[0];
  return data.daily.filter((d) => d.date >= cutoffKey);
}
