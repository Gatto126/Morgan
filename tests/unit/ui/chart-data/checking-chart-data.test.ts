import { describe, expect, it } from "vitest";

import { buildCheckingChartData, getCheckingXAxisTicks } from "@/components/checking-dashboard/chart-data";
import type { CheckingData } from "@/components/checking-dashboard/types";

const checkingData: CheckingData = {
  monthlyData: [],
  dailyData: [
    {
      month: "2026-03",
      date: "2026-03-04",
      total: 250000,
      providers: { bbva: 250000 },
      providerIncome: { bbva: 250000 },
      providerExpenses: {}
    },
    {
      month: "2026-03",
      date: "2026-03-08",
      total: 241350,
      providers: { bbva: 241350 },
      providerIncome: {},
      providerExpenses: { bbva: 8650 }
    },
    {
      month: "2026-04",
      date: "2026-04-01",
      total: 241475,
      providers: { bbva: 241475 },
      providerIncome: { bbva: 125 },
      providerExpenses: {}
    }
  ],
  providers: [{
    sourceInstitution: "bbva",
    total: 241475,
    income: 250125,
    expenses: 8650,
    interest: 0,
    cashback: 125,
    tax: 0,
    transactions: []
  }]
};

describe("checking chart data", () => {
  it("builds heritage and provider series for the aggregate tab", () => {
    const points = buildCheckingChartData({
      data: checkingData,
      activeTab: "ALL",
      timeRange: "ALL"
    });

    expect(points[0].heritage).toBe(250000);
    expect(points[0].bbva).toBe(250000);
    expect(points[1].heritage).toBe(241350);
    expect(points[1].bbva).toBe(241350);
  });

  it("builds balance, income and expenses series for the active provider", () => {
    const points = buildCheckingChartData({
      data: checkingData,
      activeTab: "bbva",
      timeRange: "ALL"
    });

    expect(points[0].balance).toBe(250000);
    expect(points[0].income).toBe(250000);
    expect(points[0].expenses).toBe(0);
    expect(points[1].balance).toBe(241350);
    expect(points[1].income).toBe(0);
    expect(points[1].expenses).toBe(8650);
  });

  it("uses monthly buckets for long ALL ranges", () => {
    const points = buildCheckingChartData({
      data: {
        ...checkingData,
        monthlyData: [
          {
            month: "2026-03",
            total: 241350,
            providers: { bbva: 241350 },
            providerIncome: { bbva: 250000 },
            providerExpenses: { bbva: 8650 }
          },
          {
            month: "2026-04",
            total: 241475,
            providers: { bbva: 241475 },
            providerIncome: { bbva: 125 },
            providerExpenses: {}
          }
        ]
      },
      activeTab: "ALL",
      timeRange: "ALL"
    });

    expect(points.map((point) => point.rawMonth)).toEqual(["2026-03", "2026-04"]);
  });

  it("uses the first visible point for each month as x-axis tick", () => {
    const points = buildCheckingChartData({
      data: checkingData,
      activeTab: "ALL",
      timeRange: "ALL"
    });

    expect(getCheckingXAxisTicks(points)).toEqual(["2026-03-04", "2026-04-01"]);
  });
});
