import { describe, expect, it } from "vitest";

import { hasUsablePortfolioStageData } from "@/components/portfolio-dashboard/portfolio-stage-data-readiness";
import type { PortfolioData } from "@/components/portfolio-dashboard/types";

const emptyPortfolioData: PortfolioData = {
  dailyData: [],
  monthlyData: [],
  providers: []
};

describe("portfolio stage data readiness", () => {
  it("allows empty portfolio data only when the profile has no transactions for that stage", () => {
    expect(hasUsablePortfolioStageData(emptyPortfolioData, 0)).toBe(true);
    expect(hasUsablePortfolioStageData(emptyPortfolioData, 1)).toBe(false);
  });

  it("accepts stage data with providers and a timeline", () => {
    expect(hasUsablePortfolioStageData({
      dailyData: [{
        date: "2026-06-01",
        month: "2026-06",
        providerProducts: {},
        providers: { trade_republic: 0 },
        total: 0
      }],
      monthlyData: [],
      providers: [{
        cashback: 0,
        expenses: 0,
        income: 0,
        interest: 0,
        products: [],
        sourceInstitution: "trade_republic",
        tax: 0,
        total: 0,
        transactionCount: 1
      }]
    }, 1)).toBe(true);
  });

  it("accepts historical timeline data even when there are no currently open provider products", () => {
    expect(hasUsablePortfolioStageData({
      dailyData: [{
        date: "2026-06-01",
        month: "2026-06",
        providerProducts: {
          trade_republic: {
            "Sold ETF": 12000
          }
        },
        providers: {},
        total: 12000
      }],
      monthlyData: [],
      providers: []
    }, 1)).toBe(true);
  });
});
