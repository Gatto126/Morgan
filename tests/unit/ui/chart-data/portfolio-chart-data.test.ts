import { describe, expect, it } from "vitest";

import { mergePortfolioDataWithBinance } from "@/components/portfolio-dashboard/binance-portfolio-provider";
import { buildPortfolioChartData, getPortfolioXAxisTicks } from "@/components/portfolio-dashboard/chart-data";
import type { PortfolioData, PortfolioProviderSummary } from "@/components/portfolio-dashboard/types";

const provider: PortfolioProviderSummary = {
  sourceInstitution: "trade_republic",
  total: 0,
  income: 0,
  expenses: 0,
  interest: 0,
  cashback: 0,
  tax: 0,
  transactionCount: 0,
  products: [{
    productName: "iShares Core MSCI World UCITS ETF USD (Acc)",
    quantity: 3.5,
    investedValue: 35000,
    cashback: 0,
    isin: "IE00B4L5Y983"
  }]
};

const portfolioData: PortfolioData = {
  monthlyData: [],
  dailyData: [
    {
      month: "2026-03",
      date: "2026-03-14",
      total: 0,
      providers: {},
      providerProducts: {}
    },
    {
      month: "2026-03",
      date: "2026-03-15",
      total: 35000,
      providers: { trade_republic: 35000 },
      providerProducts: {
        trade_republic: {
          "iShares Core MSCI World UCITS ETF USD (Acc)": 35000
        }
      }
    },
    {
      month: "2026-04",
      date: "2026-04-01",
      total: 0,
      providers: { trade_republic: 0 },
      providerProducts: {
        trade_republic: {
          "iShares Core MSCI World UCITS ETF USD (Acc)": 0
        }
      }
    }
  ],
  providers: [provider]
};

describe("portfolio chart data", () => {
  it("keeps provider series null before first acquisition and zero after acquisition", () => {
    const points = buildPortfolioChartData({
      data: portfolioData,
      activeTab: "ALL",
      timeRange: "ALL",
      activeProvider: null
    });

    expect(points[0].trade_republic).toBeNull();
    expect(points[1].trade_republic).toBe(35000);
    expect(points[2].trade_republic).toBe(0);
  });

  it("builds product and balance series for the active provider", () => {
    const points = buildPortfolioChartData({
      data: portfolioData,
      activeTab: "trade_republic",
      timeRange: "ALL",
      activeProvider: provider
    });

    expect(points[0]["iShares Core MSCI World UCITS ETF USD (Acc)"]).toBeNull();
    expect(points[1].balance).toBe(35000);
    expect(points[1]["iShares Core MSCI World UCITS ETF USD (Acc)"]).toBe(35000);
    expect(points[2].balance).toBe(0);
    expect(points[2]["iShares Core MSCI World UCITS ETF USD (Acc)"]).toBe(0);
  });

  it("patches the current provider point with live market prices", () => {
    const points = buildPortfolioChartData({
      data: portfolioData,
      activeTab: "trade_republic",
      timeRange: "ALL",
      activeProvider: provider,
      livePrices: {
        IE00B4L5Y983: 120
      },
      todayKey: "2026-03-15"
    });
    const todayPoint = points.find((point) => point.rawMonth === "2026-03-15");

    expect(todayPoint).toMatchObject({
      "iShares Core MSCI World UCITS ETF USD (Acc)": 42000,
      balance: 42000,
      heritage: 42000,
      trade_republic: 42000
    });
  });

  it("adds Binance balances to the crypto current point and provider series", () => {
    const dataWithBinance = mergePortfolioDataWithBinance(portfolioData, [{
      eurValue: 250.25,
      freeAmount: 0.003,
      lockedAmount: 0.001,
      tokenName: "Bitcoin",
      tokenSymbol: "BTC"
    }]);
    const binanceProvider = dataWithBinance.providers.find((item) => item.sourceInstitution === "BINANCE");
    const points = buildPortfolioChartData({
      activeProvider: binanceProvider ?? null,
      activeTab: "BINANCE",
      data: dataWithBinance,
      livePrices: {
        BTC: 70000,
        IE00B4L5Y983: 120
      },
      timeRange: "ALL",
      todayKey: "2026-03-15"
    });
    const todayPoint = points.find((point) => point.rawMonth === "2026-03-15");

    expect(binanceProvider?.total).toBe(25025);
    expect(todayPoint).toMatchObject({
      "Bitcoin (BTC)": 28000,
      balance: 28000,
      BINANCE: 28000,
      heritage: 70000,
      trade_republic: 42000
    });
  });

  it("keeps the current provider point pending until live prices are ready", () => {
    const points = buildPortfolioChartData({
      data: portfolioData,
      activeTab: "trade_republic",
      timeRange: "ALL",
      activeProvider: provider,
      applyLiveToday: false,
      livePrices: {
        IE00B4L5Y983: 120
      },
      todayKey: "2026-03-15"
    });
    const todayPoint = points.find((point) => point.rawMonth === "2026-03-15");

    expect(todayPoint).toMatchObject({
      "iShares Core MSCI World UCITS ETF USD (Acc)": null,
      balance: null,
      heritage: null,
      trade_republic: null
    });
  });

  it("uses daily buckets for ALL ranges even when monthly buckets are available", () => {
    const points = buildPortfolioChartData({
      data: {
        ...portfolioData,
        monthlyData: [
          {
            month: "2026-03",
            total: 35000,
            providers: { trade_republic: 35000 },
            providerProducts: {
              trade_republic: {
                "iShares Core MSCI World UCITS ETF USD (Acc)": 35000
              }
            }
          },
          {
            month: "2026-04",
            total: 0,
            providers: { trade_republic: 0 },
            providerProducts: {
              trade_republic: {
                "iShares Core MSCI World UCITS ETF USD (Acc)": 0
              }
            }
          }
        ]
      },
      activeTab: "ALL",
      timeRange: "ALL",
      activeProvider: null
    });

    expect(points.map((point) => point.rawMonth)).toEqual(["2026-03-14", "2026-03-15", "2026-04-01"]);
  });

  it("uses the first visible point for each month as x-axis tick", () => {
    const points = buildPortfolioChartData({
      data: portfolioData,
      activeTab: "ALL",
      timeRange: "ALL",
      activeProvider: null
    });

    expect(getPortfolioXAxisTicks(points)).toEqual(["2026-03-14", "2026-04-01"]);
  });
});
