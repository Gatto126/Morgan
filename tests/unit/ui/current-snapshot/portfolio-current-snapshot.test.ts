import { describe, expect, it } from "vitest";

import { buildPortfolioCurrentSnapshot } from "@/components/portfolio-dashboard/portfolio-current-snapshot";
import type { PortfolioData, PortfolioProviderSummary } from "@/components/portfolio-dashboard/types";

const tradeRepublicProvider: PortfolioProviderSummary = {
  cashback: 0,
  expenses: 0,
  income: 0,
  interest: 0,
  products: [{
    cashback: 0,
    investedValue: 35_000,
    isin: "IE00B4L5Y983",
    productName: "Core ETF",
    quantity: 3.5
  }],
  sourceInstitution: "trade_republic",
  tax: 0,
  total: 35_000,
  transactionCount: 1
};

const tradeRepublicCryptoProvider: PortfolioProviderSummary = {
  ...tradeRepublicProvider,
  products: [{
    cashback: 0,
    investedValue: 2_500,
    isin: "ETH",
    productName: "Ethereum",
    quantity: 0.021
  }],
  total: 2_500
};

const binanceProvider: PortfolioProviderSummary = {
  cashback: 0,
  expenses: 0,
  income: 0,
  interest: 0,
  products: [{
    cashback: 0,
    investedValue: 25_025,
    isin: "BTC",
    productName: "Bitcoin (BTC)",
    quantity: 0.004
  }],
  sourceInstitution: "BINANCE",
  tax: 0,
  total: 25_025,
  transactionCount: 0
};

const portfolioData: PortfolioData = {
  dailyData: [],
  monthlyData: [],
  providers: [tradeRepublicCryptoProvider, binanceProvider]
};

describe("portfolio current snapshot", () => {
  it("sums current provider values for the resting portfolio topbar", () => {
    const point = buildPortfolioCurrentSnapshot({
      activeProvider: null,
      activeTab: "ALL",
      data: portfolioData,
      livePrices: {
        BTC: 70_000,
        ETH: 2_000
      },
      priceQueryParam: "cryptos",
      pricesReady: true
    });

    expect(point).toMatchObject({
      BINANCE: 28_000,
      heritage: 32_200,
      trade_republic: 4_200
    });
  });

  it("uses synced Binance values when a Binance token has no live ticker", () => {
    const point = buildPortfolioCurrentSnapshot({
      activeProvider: binanceProvider,
      activeTab: "BINANCE",
      data: portfolioData,
      livePrices: {
        ETH: 2_000
      },
      priceQueryParam: "cryptos",
      pricesReady: true
    });

    expect(point).toMatchObject({
      "Bitcoin (BTC)": 25_025,
      balance: 25_025,
      BINANCE: 25_025,
      heritage: 29_225,
      trade_republic: 4_200
    });
  });

  it("keeps the root total pending without hiding provider values when Binance is still loading", () => {
    const point = buildPortfolioCurrentSnapshot({
      activeProvider: null,
      activeTab: "ALL",
      blockRootTotal: true,
      data: {
        ...portfolioData,
        providers: [tradeRepublicProvider]
      },
      livePrices: {
        IE00B4L5Y983: 120
      },
      priceQueryParam: "isins",
      pricesReady: true
    });

    expect(point).toMatchObject({
      heritage: null,
      trade_republic: 42_000
    });
  });
});
