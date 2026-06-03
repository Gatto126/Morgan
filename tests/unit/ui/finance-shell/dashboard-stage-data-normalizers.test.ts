import { describe, expect, it } from "vitest";

import {
  normalizeCheckingData,
  normalizeDashboardData,
  normalizeDashboardStageData,
  normalizePortfolioData
} from "@/components/finance-shell/dashboard-stage-data-normalizers";

describe("dashboard stage data normalizers", () => {
  it("normalizes malformed portfolio payloads before consumers call map", () => {
    const data = normalizePortfolioData({
      binanceHistoricalPoints: [{ dateKey: "2026-06-03", valueCents: 234_500 }],
      dailyData: [{ month: "2026-06", providers: undefined, providerProducts: undefined }],
      monthlyData: undefined,
      providers: undefined
    });

    expect(data.providers).toEqual([]);
    expect(data.monthlyData).toEqual([]);
    expect(data.dailyData).toEqual([{
      date: undefined,
      month: "2026-06",
      providerProducts: {},
      providers: {},
      total: 0
    }]);
    expect(data.binanceHistoricalPoints).toEqual([{ dateKey: "2026-06-03", valueCents: 234_500 }]);
  });

  it("normalizes dashboard provider arrays and nested holdings", () => {
    const data = normalizeDashboardData({
      binanceHistoricalPoints: [{ dateKey: "2026-06-03", valueCents: 234_500 }],
      providerSummaries: [{
        checking: undefined,
        cryptoTokens: undefined,
        investmentProducts: undefined,
        sourceInstitution: "TRADE_REPUBLIC"
      }]
    });

    expect(data.providerSummaries).toEqual([{
      checking: {
        cashback: 0,
        expenses: 0,
        income: 0,
        interest: 0,
        tax: 0,
        total: 0
      },
      cryptoTokens: [],
      investmentProducts: [],
      sourceInstitution: "TRADE_REPUBLIC",
      total: 0
    }]);
    expect(data.binanceHistoricalPoints).toEqual([{ dateKey: "2026-06-03", valueCents: 234_500 }]);
  });

  it("normalizes malformed checking payloads", () => {
    const data = normalizeCheckingData({
      dailyData: [{ month: "2026-06" }],
      providers: undefined
    });

    expect(data.providers).toEqual([]);
    expect(data.dailyData[0]?.providers).toEqual({});
    expect(data.dailyData[0]?.providerIncome).toEqual({});
    expect(data.dailyData[0]?.providerExpenses).toEqual({});
  });

  it("dispatches normalizers by stage", () => {
    expect(normalizeDashboardStageData("investment", { providers: undefined })).toMatchObject({
      providers: []
    });
    expect(normalizeDashboardStageData("binance", { balances: undefined })).toMatchObject({
      balances: []
    });
  });
});
