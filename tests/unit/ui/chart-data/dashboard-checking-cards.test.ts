import { describe, expect, it } from "vitest";

import { getCheckingMetrics } from "@/components/dashboard/dashboard-checking-card-metrics";
import type { DashboardData, ProviderSummary } from "@/components/dashboard/types";

const today = new Date();
const todayKey = today.toISOString().slice(0, 10);
const todayMonthKey = todayKey.slice(0, 7);

const bbvaProvider: ProviderSummary = {
  sourceInstitution: "bbva",
  total: 339674,
  checking: {
    cashback: 54,
    expenses: 358,
    income: 123456,
    interest: 2303,
    tax: 0,
    total: 339674
  },
  cryptoTokens: [],
  investmentProducts: []
};

const dashboardData: DashboardData = {
  accountTotals: {
    checking: 339674,
    crypto: 0,
    heritage: 339674,
    investment: 0
  },
  monthlyData: [
    {
      checking: 100000,
      crypto: 0,
      heritage: 100000,
      investment: 0,
      month: "2026-01",
      providerChecking: { bbva: 100000 },
      providerExpenses: { bbva: 0 },
      providerIncome: { bbva: 0 }
    },
    {
      checking: 339674,
      crypto: 0,
      heritage: 339674,
      investment: 0,
      month: todayMonthKey,
      providerChecking: { bbva: 339674 },
      providerExpenses: { bbva: 0 },
      providerIncome: { bbva: 0 }
    }
  ],
  dailyData: [
    {
      checking: 339674,
      crypto: 0,
      date: todayKey,
      heritage: 339674,
      investment: 0,
      month: todayMonthKey,
      providerChecking: { bbva: 339674 },
      providerExpenses: { bbva: 200 },
      providerIncome: { bbva: 300 }
    }
  ],
  providerSummaries: [bbvaProvider]
};

describe("dashboard checking cards", () => {
  it("uses provider-level totals for ALL income and spending", () => {
    const metrics = getCheckingMetrics(bbvaProvider, dashboardData, "ALL");

    expect(metrics.providerIncomePeriod).toBe(123456);
    expect(metrics.providerExpensesPeriod).toBe(358);
  });

  it("uses filtered buckets for bounded timeframe income and spending", () => {
    const metrics = getCheckingMetrics(bbvaProvider, dashboardData, "1W");

    expect(metrics.providerIncomePeriod).toBe(300);
    expect(metrics.providerExpensesPeriod).toBe(200);
  });
});
