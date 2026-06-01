import { describe, expect, it } from "vitest";

import { buildDashboardCurrentSnapshot } from "@/components/dashboard/dashboard-current-snapshot";
import type { DashboardData, ProviderSummary } from "@/components/dashboard/types";

const providerSummaries: ProviderSummary[] = [
  {
    checking: {
      cashback: 0,
      expenses: 0,
      income: 0,
      interest: 0,
      tax: 0,
      total: 10_000
    },
    cryptoTokens: [],
    investmentProducts: [],
    sourceInstitution: "bbva",
    total: 10_000
  },
  {
    checking: {
      cashback: 0,
      expenses: 0,
      income: 0,
      interest: 0,
      tax: 0,
      total: 0
    },
    cryptoTokens: [{
      investedValue: 500_000,
      quantity: 0.5,
      tokenName: "Bitcoin",
      tokenSymbol: "BTC"
    }],
    investmentProducts: [{
      cashback: 0,
      investedValue: 15_000,
      isin: "IE00B4L5Y983",
      productName: "Core ETF",
      quantity: 2
    }],
    sourceInstitution: "trade_republic",
    total: 515_000
  }
];

const dashboardData: DashboardData = {
  accountTotals: {
    checking: 10_000,
    crypto: 500_000,
    heritage: 525_000,
    investment: 15_000
  },
  dailyData: [],
  monthlyData: [],
  providerSummaries
};

describe("dashboard current snapshot", () => {
  it("builds the resting topbar values from current checking, live holdings and Binance", () => {
    const point = buildDashboardCurrentSnapshot({
      binanceBalancesKnown: true,
      binanceTotalCents: 2_500,
      cryptoPricesReady: true,
      data: dashboardData,
      hasBinancePortfolio: true,
      investmentPricesReady: true,
      livePrices: {
        BTC: 20_000,
        IE00B4L5Y983: 100
      }
    });

    expect(point).toMatchObject({
      bbva: 10_000,
      "Core ETF": 20_000,
      Bitcoin: 1_000_000,
      binance: 2_500,
      checking: 10_000,
      crypto: 1_002_500,
      crypto_inst_trade_republic: 1_000_000,
      heritage: 1_032_500,
      investment: 20_000,
      investment_inst_trade_republic: 20_000
    });
  });

  it("keeps crypto and heritage pending when a required live price is zero", () => {
    const point = buildDashboardCurrentSnapshot({
      binanceBalancesKnown: true,
      binanceTotalCents: 2_500,
      cryptoPricesReady: true,
      data: dashboardData,
      hasBinancePortfolio: true,
      investmentPricesReady: true,
      livePrices: {
        BTC: 0,
        IE00B4L5Y983: 100
      }
    });

    expect(point).toMatchObject({
      checking: 10_000,
      crypto: null,
      crypto_inst_trade_republic: null,
      heritage: null,
      investment: 20_000
    });
  });

  it("does not publish an incomplete crypto total while Binance balances are still loading", () => {
    const point = buildDashboardCurrentSnapshot({
      binanceBalancesKnown: false,
      binanceTotalCents: 0,
      cryptoPricesReady: true,
      data: dashboardData,
      hasBinancePortfolio: true,
      investmentPricesReady: true,
      livePrices: {
        BTC: 20_000,
        IE00B4L5Y983: 100
      }
    });

    expect(point).toMatchObject({
      checking: 10_000,
      crypto: null,
      heritage: null,
      investment: 20_000
    });
  });
});
