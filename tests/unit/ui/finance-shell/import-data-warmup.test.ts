import { afterEach, describe, expect, it, vi } from "vitest";

import { getCurrentValuationSnapshot } from "@/components/finance-shell/current-valuations-store";
import {
  applyImportedTransactionCountsToUser,
  getImportedProfileWarmupStages,
  warmImportedProfileData
} from "@/components/finance-shell/import-data-warmup";
import { resetFinanceSessionOrchestrator } from "@/components/finance-shell/finance-session-orchestrator";
import type { UserRecord } from "@/components/finance-shell/types";
import type { ImportedTransactionCounts } from "@/components/finance-shell/use-transaction-import";
import {
  globalLivePricesCache,
  globalLivePricesCacheUpdatedAt,
  globalLiveQuotesCache
} from "@/shared/live-prices";

const baseUser: UserRecord = {
  id: "profile-1",
  name: "Main",
  transactionCount: 10,
  checkingCount: 2,
  investmentCount: 3,
  cryptoCount: 0,
  hasBinanceCredentials: false
};

describe("import data warmup", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetFinanceSessionOrchestrator();
    for (const key of Object.keys(globalLivePricesCache)) {
      delete globalLivePricesCache[key];
    }
    for (const key of Object.keys(globalLivePricesCacheUpdatedAt)) {
      delete globalLivePricesCacheUpdatedAt[key];
    }
    for (const key of Object.keys(globalLiveQuotesCache)) {
      delete globalLiveQuotesCache[key];
    }
  });

  it("builds the post-import profile counts used for cache versions", () => {
    const counts: ImportedTransactionCounts = {
      insertedCount: 4,
      addedChecking: 1,
      addedInvestment: 2,
      addedCrypto: 1
    };

    expect(applyImportedTransactionCountsToUser(baseUser, counts)).toEqual({
      ...baseUser,
      checkingCount: 3,
      cryptoCount: 1,
      investmentCount: 5,
      transactionCount: 14
    });
  });

  it("warms the dashboard and only the sections touched by the import", () => {
    expect(getImportedProfileWarmupStages(baseUser, {
      insertedCount: 2,
      addedChecking: 0,
      addedInvestment: 2,
      addedCrypto: 0
    })).toEqual(["dashboard", "investment"]);

    expect(getImportedProfileWarmupStages(baseUser, {
      insertedCount: 1,
      addedChecking: 0,
      addedInvestment: 0,
      addedCrypto: 1
    })).toEqual(["dashboard", "crypto"]);
  });

  it("includes Binance balances when the imported profile has API credentials", () => {
    expect(getImportedProfileWarmupStages({
      ...baseUser,
      hasBinanceCredentials: true
    }, {
      insertedCount: 1,
      addedChecking: 1,
      addedInvestment: 0,
      addedCrypto: 0
    })).toEqual(["dashboard", "checking", "binance"]);
  });

  it("waits for a post-import current valuation snapshot", async () => {
    const counts: ImportedTransactionCounts = {
      addedChecking: 0,
      addedCrypto: 0,
      addedInvestment: 1,
      insertedCount: 1
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("/api/transactions/dashboard?")) {
        return {
          ok: true,
          json: async () => ({
            accountTotals: { checking: 0, crypto: 0, heritage: 0, investment: 0 },
            dailyData: [],
            monthlyData: [],
            providerSummaries: [{
              checking: { cashback: 0, expenses: 0, income: 0, interest: 0, tax: 0, total: 0 },
              cryptoTokens: [],
              investmentProducts: [{
                cashback: 0,
                investedValue: 0,
                isin: "IE00B4L5Y983",
                productName: "Core ETF",
                quantity: 2
              }],
              sourceInstitution: "trade_republic",
              total: 0
            }]
          })
        };
      }

      if (url.startsWith("/api/transactions/investment?")) {
        return {
          ok: true,
          json: async () => ({
            dailyData: [{ date: "2026-06-01", month: "2026-06", providers: { trade_republic: 20_000 }, total: 20_000 }],
            monthlyData: [],
            providers: [{
              cashback: 0,
              expenses: 0,
              income: 0,
              interest: 0,
              products: [{
                cashback: 0,
                investedValue: 0,
                isin: "IE00B4L5Y983",
                productName: "Core ETF",
                quantity: 2
              }],
              sourceInstitution: "trade_republic",
              tax: 0,
              total: 20_000,
              transactionCount: 1
            }]
          })
        };
      }

      if (url.startsWith("/api/prices?")) {
        return {
          ok: true,
          json: async () => ({ IE00B4L5Y983: 100 })
        };
      }

      throw new Error(`Unexpected request ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const nextUser = await warmImportedProfileData(baseUser, counts);
    const snapshot = getCurrentValuationSnapshot(nextUser.id);

    expect(nextUser).toMatchObject({
      investmentCount: 4,
      transactionCount: 11
    });
    expect(snapshot?.status).toBe("ready");
    expect(snapshot?.version).toMatchObject({
      investmentCount: 4,
      transactionCount: 11
    });
    expect(snapshot?.totals.investment.cents).toBe(20_000);
  });
});
