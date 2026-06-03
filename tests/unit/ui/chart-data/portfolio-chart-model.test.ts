import { describe, expect, it } from "vitest";

import {
  formatPortfolioTooltipLabel,
  formatPortfolioTooltipSeriesLabel,
  formatPortfolioXAxisTick,
  getPortfolioAllLegendItems,
  getPortfolioProviderLegendItems,
  hasRenderablePortfolioLineSeries,
  hasStandalonePortfolioPointSeries,
  shouldRenderStandalonePortfolioPointSeries
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
    expect(formatPortfolioTooltipSeriesLabel("heritage", "CRYPTO")).toBe("CRYPTO");
    expect(formatPortfolioTooltipSeriesLabel("trade_republic")).toBe("TRADE REPUBLIC");
    expect(formatPortfolioXAxisTick("2026-04-01")).toBe("Apr 26");
  });

  it("builds aggregate and provider legend items", () => {
    expect(getPortfolioAllLegendItems([provider]).map((item) => item.label)).toEqual([
      "HERITAGE",
      "TRADE REPUBLIC"
    ]);
    expect(getPortfolioAllLegendItems([provider], "CRYPTO").map((item) => item.label)).toEqual([
      "CRYPTO",
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

  it("classifies standalone provider points separately from lines", () => {
    const points = [
      { rawMonth: "2026-06-01", heritage: 30, trade_republic: 30, BINANCE: null },
      { rawMonth: "2026-06-02", heritage: 31, trade_republic: 31, BINANCE: null },
      { rawMonth: "2026-06-03", heritage: 2331, trade_republic: 31, BINANCE: 2300 }
    ];

    expect(hasRenderablePortfolioLineSeries(points, "BINANCE")).toBe(false);
    expect(hasStandalonePortfolioPointSeries(points, "BINANCE")).toBe(true);
    expect(shouldRenderStandalonePortfolioPointSeries(points, "BINANCE")).toBe(true);
    expect(hasRenderablePortfolioLineSeries(points, "trade_republic")).toBe(true);
    expect(hasStandalonePortfolioPointSeries(points, "trade_republic")).toBe(false);
    expect(hasRenderablePortfolioLineSeries(points, "heritage")).toBe(true);
  });
});
