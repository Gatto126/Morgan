import { describe, expect, it } from "vitest";

import {
  formatPortfolioTooltipLabel,
  formatPortfolioTooltipSeriesLabel,
  formatPortfolioXAxisTick,
  getPortfolioAllLegendItems,
  getPortfolioProviderLegendItems
} from "@/components/portfolio-dashboard/portfolio-chart-model";
import type { PortfolioProviderSummary } from "@/components/portfolio-dashboard/types";

const provider: PortfolioProviderSummary = {
  sourceInstitution: "trade_republic",
  total: 0,
  income: 0,
  expenses: 0,
  interest: 0,
  cashback: 0,
  tax: 0,
  transactionCount: 0,
  products: [
    {
      productName: "Core ETF",
      quantity: 3.5,
      investedValue: 35000,
      cashback: 0,
      isin: "IE00B4L5Y983"
    },
    {
      productName: "Sold Fund",
      quantity: 0,
      investedValue: 0,
      cashback: 0,
      isin: "IE00SOLD0000"
    }
  ]
};

describe("portfolio chart model", () => {
  it("formats tooltip labels, series labels and x-axis ticks", () => {
    expect(formatPortfolioTooltipLabel("2026-03-15")).toBe("15 Mar 26");
    expect(formatPortfolioTooltipLabel("2026-03")).toBe("Mar 26");
    expect(formatPortfolioTooltipSeriesLabel("balance")).toBe("BALANCE");
    expect(formatPortfolioTooltipSeriesLabel("heritage")).toBe("HERITAGE");
    expect(formatPortfolioTooltipSeriesLabel("trade_republic")).toBe("TRADE REPUBLIC");
    expect(formatPortfolioXAxisTick("2026-04-01")).toBe("Apr 26");
  });

  it("builds aggregate and provider legend items", () => {
    expect(getPortfolioAllLegendItems([provider]).map((item) => item.label)).toEqual([
      "HERITAGE",
      "TRADE REPUBLIC"
    ]);

    expect(getPortfolioProviderLegendItems(provider, false).map((item) => item.label)).toEqual([
      "BALANCE",
      "Core ETF"
    ]);
    expect(getPortfolioProviderLegendItems(provider, true).map((item) => item.label)).toEqual([
      "BALANCE",
      "Core ETF",
      "Sold Fund"
    ]);
  });
});
