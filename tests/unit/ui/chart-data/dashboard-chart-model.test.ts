import { describe, expect, it } from "vitest";

import {
  buildDashboardChartData,
  collectCheckingProviders,
  collectCryptoInstitutions,
  collectCryptoTokens,
  collectInvestmentProducts
} from "@/components/dashboard/dashboard-chart-data-model";
import {
  addReferenceLineValue,
  buildDashboardChartConfig,
  getSelectedChartValue,
  getVisibleDashboardTabs,
  getXAxisTicks,
  hasRenderableDashboardChartData
} from "@/components/dashboard/dashboard-chart-display-model";
import type { DashboardChartConfig, DashboardChartPoint } from "@/components/dashboard/dashboard-chart-types";
import type { DashboardData, ProviderSummary } from "@/components/dashboard/types";

const providerSummaries: ProviderSummary[] = [
  {
    sourceInstitution: "bbva",
    total: 10000,
    checking: {
      income: 0,
      expenses: 0,
      interest: 0,
      cashback: 0,
      tax: 0,
      total: 10000
    },
    investmentProducts: [],
    cryptoTokens: []
  },
  {
    sourceInstitution: "trade_republic",
    total: 30000,
    checking: {
      income: 0,
      expenses: 0,
      interest: 0,
      cashback: 0,
      tax: 0,
      total: 0
    },
    investmentProducts: [
      {
        productName: "Core ETF",
        quantity: 4,
        investedValue: 25000,
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
    ],
    cryptoTokens: [
      {
        tokenName: "Bitcoin",
        quantity: 0.1,
        investedValue: 5000,
        tokenSymbol: "BTC"
      }
    ]
  }
];

const dashboardData: DashboardData = {
  accountTotals: {
    heritage: 40000,
    checking: 10000,
    investment: 25000,
    crypto: 5000
  },
  monthlyData: [
    {
      month: "2026-01",
      checking: 10000,
      investment: 25000,
      crypto: 5000,
      heritage: 40000,
      providerChecking: { bbva: 10000 },
      providerProducts: {
        "Core ETF": 25000,
        "Sold Fund": 0
      },
      providerCryptoTokens: { Bitcoin: 5000 }
    }
  ],
  dailyData: [
    {
      month: "2026-01",
      date: "2026-01-01",
      checking: 0,
      investment: 0,
      crypto: 0,
      heritage: 0,
      providerChecking: {},
      providerProducts: {},
      providerCryptoTokens: {}
    },
    {
      month: "2026-01",
      date: "2026-01-02",
      checking: 10000,
      investment: 0,
      crypto: 0,
      heritage: 10000,
      providerChecking: { bbva: 10000 },
      providerProducts: {},
      providerCryptoTokens: {}
    },
    {
      month: "2026-01",
      date: "2026-01-03",
      checking: 10000,
      investment: 25000,
      crypto: 5000,
      heritage: 40000,
      providerChecking: { bbva: 10000 },
      providerProducts: { "Core ETF": 25000 },
      providerCryptoTokens: { Bitcoin: 5000 }
    },
    {
      month: "2026-01",
      date: "2026-01-04",
      checking: 0,
      investment: 0,
      crypto: 0,
      heritage: 0,
      providerChecking: { bbva: 0 },
      providerProducts: { "Core ETF": 0 },
      providerCryptoTokens: { Bitcoin: 0 }
    }
  ],
  providerSummaries
};

function buildHeritageData() {
  return buildDashboardChartData({
    activeTab: "heritage",
    binanceTotalCents: 2000,
    checkingProviders: collectCheckingProviders(dashboardData),
    cryptoInstitutions: collectCryptoInstitutions(dashboardData),
    cryptoTokens: collectCryptoTokens(dashboardData),
    data: dashboardData,
    hasBinancePortfolio: true,
    investmentProducts: collectInvestmentProducts(dashboardData),
    timeRange: "ALL"
  });
}

function buildChartDataFor(activeTab: "heritage" | "checking" | "investment" | "crypto") {
  return buildDashboardChartData({
    activeTab,
    binanceTotalCents: 2000,
    checkingProviders: collectCheckingProviders(dashboardData),
    cryptoInstitutions: collectCryptoInstitutions(dashboardData),
    cryptoTokens: collectCryptoTokens(dashboardData),
    data: dashboardData,
    hasBinancePortfolio: true,
    investmentProducts: collectInvestmentProducts(dashboardData),
    timeRange: "ALL"
  });
}

describe("dashboard chart data model", () => {
  it("collects provider, product, token and crypto institution series from dashboard data", () => {
    expect(collectCheckingProviders(dashboardData)).toEqual(["bbva"]);
    expect(collectInvestmentProducts(dashboardData)).toEqual(["Core ETF", "Sold Fund"]);
    expect(collectCryptoTokens(dashboardData)).toEqual(["Bitcoin"]);
    expect(collectCryptoInstitutions(dashboardData)).toEqual(["trade_republic"]);
  });

  it("keeps provider series null before acquisition and zero after acquisition", () => {
    const points = buildHeritageData();

    expect(points[0].bbva).toBeNull();
    expect(points[1].bbva).toBe(10000);
    expect(points[0]["Core ETF"]).toBeNull();
    expect(points[2]["Core ETF"]).toBe(25000);
    expect(points[3].bbva).toBe(0);
    expect(points[3]["Core ETF"]).toBe(0);
    expect(points[3].Bitcoin).toBe(0);
  });

  it("uses daily buckets for ALL ranges even when monthly buckets are available", () => {
    const points = buildDashboardChartData({
      activeTab: "heritage",
      binanceTotalCents: 0,
      checkingProviders: ["bbva"],
      cryptoInstitutions: [],
      cryptoTokens: [],
      data: {
        ...dashboardData,
        monthlyData: [
          {
            month: "2026-01",
            checking: 10000,
            investment: 0,
            crypto: 0,
            heritage: 10000,
            providerChecking: { bbva: 10000 },
            providerProducts: {},
            providerCryptoTokens: {}
          },
          {
            month: "2026-02",
            checking: 15000,
            investment: 0,
            crypto: 0,
            heritage: 15000,
            providerChecking: { bbva: 15000 },
            providerProducts: {},
            providerCryptoTokens: {}
          }
        ]
      },
      hasBinancePortfolio: false,
      investmentProducts: [],
      timeRange: "ALL"
    });

    expect(points.map((point) => point.rawMonth)).toEqual(["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"]);
  });

  it("adds Binance to heritage, crypto and the dedicated Binance series", () => {
    const points = buildHeritageData();

    expect(points[0]).toMatchObject({
      value: 2000,
      heritage: 2000,
      crypto: 2000,
      binance: 2000
    });
    expect(points[1]).toMatchObject({
      value: 12000,
      heritage: 12000,
      checking: 10000,
      crypto: 2000,
      binance: 2000
    });
    expect(points[2]).toMatchObject({
      value: 42000,
      heritage: 42000,
      investment: 25000,
      crypto: 7000,
      binance: 2000
    });
  });

  it("keeps Binance out of checking and investment tab values", () => {
    const checkingPoints = buildChartDataFor("checking");
    const investmentPoints = buildChartDataFor("investment");
    const cryptoPoints = buildChartDataFor("crypto");

    expect(checkingPoints[0].value).toBeNull();
    expect(checkingPoints[1].value).toBe(10000);
    expect(investmentPoints[2].value).toBe(25000);
    expect(cryptoPoints[0].value).toBe(2000);
    expect(cryptoPoints[2].value).toBe(7000);
  });

  it("treats missing provider values as zero after the first acquisition", () => {
    const points = buildDashboardChartData({
      activeTab: "checking",
      binanceTotalCents: 0,
      checkingProviders: ["bbva"],
      cryptoInstitutions: [],
      cryptoTokens: [],
      data: {
        ...dashboardData,
        monthlyData: [
          {
            month: "2026-01",
            checking: 10000,
            investment: 0,
            crypto: 0,
            heritage: 10000,
            providerChecking: { bbva: 10000 },
            providerProducts: {},
            providerCryptoTokens: {}
          }
        ],
        dailyData: [
          {
            month: "2026-01",
            date: "2026-01-01",
            checking: 10000,
            investment: 0,
            crypto: 0,
            heritage: 10000,
            providerChecking: { bbva: 10000 },
            providerProducts: {},
            providerCryptoTokens: {}
          },
          {
            month: "2026-01",
            date: "2026-01-02",
            checking: 10000,
            investment: 0,
            crypto: 0,
            heritage: 10000,
            providerChecking: {},
            providerProducts: {},
            providerCryptoTokens: {}
          }
        ]
      },
      hasBinancePortfolio: false,
      investmentProducts: [],
      timeRange: "ALL"
    });

    expect(points[0].bbva).toBe(10000);
    expect(points[1].bbva).toBe(0);
  });

  it("returns an empty chart when dashboard data is missing", () => {
    expect(buildDashboardChartData({
      activeTab: "heritage",
      binanceTotalCents: 0,
      checkingProviders: [],
      cryptoInstitutions: [],
      cryptoTokens: [],
      data: null,
      hasBinancePortfolio: false,
      investmentProducts: [],
      timeRange: "ALL"
    })).toEqual([]);
  });
});

describe("dashboard chart display model", () => {
  it("shows only tabs backed by available data", () => {
    expect(getVisibleDashboardTabs({
      checkingCount: 0,
      cryptoCount: 0,
      hasBinancePortfolio: true,
      investmentCount: 0,
      transactionCount: 0
    }).map((tab) => tab.key)).toEqual(["heritage"]);

    expect(getVisibleDashboardTabs({
      checkingCount: 1,
      cryptoCount: 1,
      hasBinancePortfolio: true,
      investmentCount: 1,
      transactionCount: 1
    }).map((tab) => tab.key)).toEqual(["heritage", "checking", "investment", "crypto"]);
  });

  it("builds heritage and crypto chart legends, including Binance", () => {
    const heritageConfig = buildDashboardChartConfig({
      activeTab: "heritage",
      binanceBalanceCount: 2,
      checkingCount: 1,
      checkingProviders: ["bbva"],
      cryptoCount: 1,
      cryptoInstitutions: ["trade_republic"],
      investmentCount: 1,
      investmentProducts: ["Core ETF"],
      providerSummaries,
      showSoldAssets: false
    });
    expect(heritageConfig.subLines.map((line) => line.key)).toEqual(["checking", "investment", "crypto"]);

    const cryptoConfig = buildDashboardChartConfig({
      activeTab: "crypto",
      binanceBalanceCount: 2,
      checkingCount: 1,
      checkingProviders: ["bbva"],
      cryptoCount: 1,
      cryptoInstitutions: ["trade_republic"],
      investmentCount: 1,
      investmentProducts: ["Core ETF"],
      providerSummaries,
      showSoldAssets: false
    });
    expect(cryptoConfig.subLines.map((line) => line.key)).toEqual(["crypto_inst_trade_republic", "binance"]);
    expect(cryptoConfig.subLines.map((line) => line.label)).toEqual(["TRADE REPUBLIC", "BINANCE"]);
  });

  it("hides sold investment products until requested", () => {
    const hiddenSoldConfig = buildDashboardChartConfig({
      activeTab: "investment",
      binanceBalanceCount: 0,
      checkingCount: 0,
      checkingProviders: [],
      cryptoCount: 0,
      cryptoInstitutions: [],
      investmentCount: 1,
      investmentProducts: ["Core ETF", "Sold Fund"],
      providerSummaries,
      showSoldAssets: false
    });
    expect(hiddenSoldConfig.subLines.map((line) => line.key)).toEqual(["Core ETF"]);

    const visibleSoldConfig = buildDashboardChartConfig({
      activeTab: "investment",
      binanceBalanceCount: 0,
      checkingCount: 0,
      checkingProviders: [],
      cryptoCount: 0,
      cryptoInstitutions: [],
      investmentCount: 1,
      investmentProducts: ["Core ETF", "Sold Fund"],
      providerSummaries,
      showSoldAssets: true
    });
    expect(visibleSoldConfig.subLines.map((line) => line.key)).toEqual(["Core ETF", "Sold Fund"]);
  });

  it("builds ticks, selected values, reference values and renderability", () => {
    const points: DashboardChartPoint[] = [
      { rawMonth: "2026-01-02", value: 100, bbva: 25 },
      { rawMonth: "2026-01-12", value: 150, bbva: 50 },
      { rawMonth: "2026-02-01", value: null, bbva: 0 }
    ];
    const config: DashboardChartConfig = {
      mainKey: "heritage",
      mainLabel: "HERITAGE",
      subLines: [{ key: "bbva", label: "BBVA", stroke: "#a3a3a3" }]
    };

    expect(getXAxisTicks(points)).toEqual(["2026-01-02", "2026-02-01"]);
    expect(getSelectedChartValue(points, "2026-01-12", null)).toBe(150);
    expect(getSelectedChartValue(points, "2026-01-12", "bbva")).toBe(50);
    expect(addReferenceLineValue(points, null)).toBe(points);
    expect(addReferenceLineValue(points, 150)[0].referenceLineValue).toBe(150);
    expect(hasRenderableDashboardChartData(points, config)).toBe(true);
    expect(hasRenderableDashboardChartData([{ rawMonth: "2026-03-01", value: null, bbva: null }], config)).toBe(false);
  });
});
