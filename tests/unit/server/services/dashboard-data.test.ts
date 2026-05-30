import { describe, expect, it } from "vitest";

import {
  selectDashboardSeriesData,
  stripDashboardSeriesDetails
} from "@/server/services/dashboard-data";

describe("dashboard data service", () => {
  const fullDashboardData = {
    accountTotals: {
      checking: 100,
      crypto: 300,
      heritage: 600,
      investment: 200
    },
    monthlyData: [
      {
        month: "2026-01",
        checking: 100,
        investment: 200,
        crypto: 300,
        heritage: 600,
        providerChecking: { bbva: 100 },
        providerProducts: { ETF: 200 },
        providerCryptoTokens: { Bitcoin: 300 },
        providerIncome: { bbva: 120 },
        providerExpenses: { bbva: 20 },
        providerInterest: {},
        providerCashback: {},
        providerTax: {}
      }
    ],
    dailyData: [
      {
        date: "2026-01-01",
        month: "2026-01",
        checking: 100,
        investment: 200,
        crypto: 300,
        heritage: 600,
        providerChecking: { bbva: 100 },
        providerProducts: { ETF: 200 },
        providerCryptoTokens: { Bitcoin: 300 },
        providerIncome: { bbva: 120 },
        providerExpenses: { bbva: 20 },
        providerInterest: {},
        providerCashback: {},
        providerTax: {}
      }
    ],
    providerSummaries: []
  };

  it("strips deep dashboard series from the initial payload", () => {
    const result = stripDashboardSeriesDetails(fullDashboardData);

    expect(result.monthlyData[0]).toEqual({
      month: "2026-01",
      checking: 100,
      investment: 200,
      crypto: 300,
      heritage: 600
    });
    expect(result.dailyData[0]).toEqual({
      date: "2026-01-01",
      month: "2026-01",
      checking: 100,
      investment: 200,
      crypto: 300,
      heritage: 600
    });
  });

  it("returns only the requested dashboard detail series", () => {
    const investment = selectDashboardSeriesData(fullDashboardData, "investment");
    const crypto = selectDashboardSeriesData(fullDashboardData, "crypto");
    const checking = selectDashboardSeriesData(fullDashboardData, "checking");

    expect(investment.dailyData[0]).toMatchObject({
      providerProducts: { ETF: 200 }
    });
    expect(investment.dailyData[0]).not.toHaveProperty("providerChecking");
    expect(crypto.dailyData[0]).toMatchObject({
      providerCryptoTokens: { Bitcoin: 300 }
    });
    expect(crypto.dailyData[0]).not.toHaveProperty("providerProducts");
    expect(checking.dailyData[0]).toMatchObject({
      providerChecking: { bbva: 100 }
    });
    expect(checking.dailyData[0]).not.toHaveProperty("providerCryptoTokens");
  });
});
