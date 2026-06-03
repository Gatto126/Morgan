import { describe, expect, it } from "vitest";

import {
  buildBinanceDailyChartData,
  filterBinanceChartData,
  formatBinanceEuro,
  formatBinanceEuroCents,
  formatBinanceTooltipLabel,
  formatBinanceTooltipSeriesLabel,
  formatBinanceXAxisTick,
  getBinanceXAxisTicks
} from "@/components/binance-dashboard/binance-chart-model";
import type { ChartPoint } from "@/types/chart";

function normalizeCurrency(value: string) {
  return value.replace(/\s/g, " ");
}

describe("binance chart model", () => {
  it("builds a daily balance series from historical snapshots and the current total", () => {
    const today = new Date(Date.UTC(2026, 4, 29, 12));
    const points = buildBinanceDailyChartData(
      5525.53,
      [
        { dateKey: "2026-05-28", totalEurValue: 5000 },
        { dateKey: "2026-05-27", totalEurValue: 4900 }
      ],
      today
    );

    expect(points).toEqual([
      {
        date: "2026-05-27",
        rawMonth: "2026-05-27",
        balance: 490000
      },
      {
        date: "2026-05-28",
        rawMonth: "2026-05-28",
        balance: 500000
      },
      {
        date: "2026-05-29",
        rawMonth: "2026-05-29",
        balance: 552553
      }
    ]);
  });

  it("uses the committed current value for today's point instead of stale history", () => {
    const today = new Date(Date.UTC(2026, 4, 29, 12));
    const points = buildBinanceDailyChartData(
      5525.53,
      [{ dateKey: "2026-05-29", totalEurValue: 5000 }],
      today
    );

    expect(points).toEqual([{
      date: "2026-05-29",
      rawMonth: "2026-05-29",
      balance: 552553
    }]);
  });

  it("does not invent historical points before the first daily snapshot", () => {
    const today = new Date(Date.UTC(2026, 4, 29, 12));

    expect(buildBinanceDailyChartData(0, [], today)).toEqual([]);
    expect(buildBinanceDailyChartData(5525.53, [], today)).toEqual([{
      date: "2026-05-29",
      rawMonth: "2026-05-29",
      balance: 552553
    }]);
  });

  it("filters daily points by the selected time range", () => {
    const today = new Date(Date.UTC(2026, 4, 29, 12));
    const points: ChartPoint[] = [
      { date: "2026-05-20", rawMonth: "2026-05-20", balance: 100 },
      { date: "2026-05-22", rawMonth: "2026-05-22", balance: 200 },
      { date: "2026-05-29", rawMonth: "2026-05-29", balance: 300 }
    ];

    expect(filterBinanceChartData(points, "ALL", today)).toEqual(points);
    expect(filterBinanceChartData(points, "1W", today).map((point) => point.rawMonth)).toEqual([
      "2026-05-22",
      "2026-05-29"
    ]);
  });

  it("deduplicates x-axis ticks by month and formats labels", () => {
    const points: ChartPoint[] = [
      { date: "2026-01-01", rawMonth: "2026-01-01", balance: 100 },
      { date: "2026-01-15", rawMonth: "2026-01-15", balance: 100 },
      { date: "2026-02-01", rawMonth: "2026-02-01", balance: 100 }
    ];

    expect(getBinanceXAxisTicks(points)).toEqual(["2026-01-01", "2026-02-01"]);
    expect(formatBinanceXAxisTick("2026-01")).toBe("Jan 26");
    expect(formatBinanceXAxisTick("2026-02-01")).toBe("Feb 26");
  });

  it("formats Binance tooltip labels, series labels and money", () => {
    expect(formatBinanceTooltipLabel("2026-02-01")).toBe("01 Feb 26");
    expect(formatBinanceTooltipLabel("2026-02")).toBe("Feb 26");
    expect(formatBinanceTooltipSeriesLabel()).toBe("BINANCE");
    expect(normalizeCurrency(formatBinanceEuroCents(552553))).toContain("5525,53");
    expect(normalizeCurrency(formatBinanceEuro(5525.53))).toContain("5525,53");
  });
});
