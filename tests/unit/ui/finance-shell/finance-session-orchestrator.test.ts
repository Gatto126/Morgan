import { describe, expect, it } from "vitest";

import {
  collectStageLivePriceKeys,
  getFinanceStageRequestKey,
  getPrioritizedProfileStageWarmupOrder
} from "@/components/finance-shell/finance-session-orchestrator";
import type { UserRecord } from "@/components/finance-shell/types";

const user: UserRecord = {
  id: "profile-1",
  name: "Main",
  transactionCount: 10,
  checkingCount: 2,
  investmentCount: 4,
  cryptoCount: 1,
  hasBinanceCredentials: true
};

describe("finance session orchestrator", () => {
  it("keys stage requests by profile, stage, version and date", () => {
    expect(getFinanceStageRequestKey({
      dateKey: "2026-06-01",
      stage: "dashboard",
      user
    })).toBe("profile-1:dashboard:10:2026-06-01");

    expect(getFinanceStageRequestKey({
      binanceRefreshKey: 3,
      dateKey: "live",
      stage: "binance",
      user
    })).toBe("profile-1:binance:3:live");
  });

  it("prioritizes the active stage without dropping the rest of the profile", () => {
    expect(getPrioritizedProfileStageWarmupOrder(user, "crypto")).toEqual([
      "crypto",
      "dashboard",
      "checking",
      "investment",
      "binance"
    ]);
  });

  it("falls back to dashboard when a requested active stage is not visible", () => {
    expect(getPrioritizedProfileStageWarmupOrder({
      ...user,
      hasBinanceCredentials: false
    }, "binance")).toEqual([
      "dashboard",
      "checking",
      "investment",
      "crypto"
    ]);
  });

  it("collects live keys for dashboard, portfolio and Binance payloads", () => {
    expect(collectStageLivePriceKeys("dashboard", {
      providerSummaries: [{
        checking: { cashback: 0, expenses: 0, income: 0, interest: 0, tax: 0, total: 0 },
        cryptoTokens: [{ investedValue: 0, quantity: 0.1, tokenName: "Bitcoin", tokenSymbol: "BTC" }],
        investmentProducts: [{ cashback: 0, investedValue: 0, isin: "IE00B4L5Y983", productName: "ETF", quantity: 2 }],
        sourceInstitution: "trade_republic",
        total: 0
      }]
    })).toEqual({
      cryptos: ["BTC"],
      isins: ["IE00B4L5Y983"]
    });

    expect(collectStageLivePriceKeys("crypto", {
      dailyData: [],
      monthlyData: [],
      providers: [{
        cashback: 0,
        expenses: 0,
        income: 0,
        interest: 0,
        products: [{ cashback: 0, investedValue: 0, isin: "ETH", productName: "Ethereum", quantity: 1 }],
        sourceInstitution: "trade_republic",
        tax: 0,
        total: 0,
        transactionCount: 1
      }]
    })).toEqual({
      cryptos: ["ETH"],
      isins: []
    });

    expect(collectStageLivePriceKeys("binance", {
      balances: [
        { eurValue: 10, freeAmount: 0.01, lockedAmount: 0, tokenName: "Bitcoin", tokenSymbol: "BTC" }
      ]
    })).toEqual({
      cryptos: ["BTC"],
      isins: []
    });
  });
});
