import { afterEach, describe, expect, it, vi } from "vitest";

import {
  collectStageLivePriceKeys,
  ensureFinanceCurrentValuation,
  ensureFinanceProfilesCurrentValuations,
  ensureFinanceStageReady,
  getFinanceStageRequestKey,
  getFinanceSessionDiagnostics,
  getPrioritizedProfileStageWarmupOrder,
  resetFinanceSessionOrchestrator
} from "@/components/finance-shell/finance-session-orchestrator";
import { getCurrentValuationSnapshot } from "@/components/finance-shell/current-valuations-store";
import type { UserRecord } from "@/components/finance-shell/types";
import {
  globalLivePricesCache,
  globalLivePricesCacheUpdatedAt,
  globalLiveQuotesCache,
  saveLivePricesToCache
} from "@/shared/live-prices";

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
  afterEach(() => {
    vi.useRealTimers();
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

  it("records diagnostics for stage data and live quotes", async () => {
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
              cryptoTokens: [{ investedValue: 0, quantity: 0.1, tokenName: "Bitcoin", tokenSymbol: "BTC" }],
              investmentProducts: [],
              sourceInstitution: "trade_republic",
              total: 0
            }]
          })
        };
      }

      if (url === "/api/prices?cryptos=BTC") {
        return {
          ok: true,
          json: async () => ({ BTC: 62000 })
        };
      }

      throw new Error(`Unexpected request ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await ensureFinanceStageReady({
      event: "dashboard-change",
      priority: "user",
      stage: "dashboard",
      user
    });

    expect(getFinanceSessionDiagnostics()).toEqual([
      expect.objectContaining({
        event: "dashboard-change",
        livePriceStatus: "ready",
        missingKeys: [],
        priority: "user",
        quoteCount: 1,
        requestedLiveKeys: ["BTC"],
        stage: "dashboard",
        status: "ready",
        userId: user.id,
        version: user.transactionCount
      })
    ]);
  });

  it("publishes a profile current valuation snapshot with dashboard and Binance data", async () => {
    const valuationUser: UserRecord = {
      ...user,
      id: "profile-current-valuation"
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("/api/transactions/dashboard?")) {
        return {
          ok: true,
          json: async () => ({
            accountTotals: { checking: 10_000, crypto: 0, heritage: 10_000, investment: 0 },
            dailyData: [],
            monthlyData: [],
            providerSummaries: [{
              checking: { cashback: 0, expenses: 0, income: 0, interest: 0, tax: 0, total: 10_000 },
              cryptoTokens: [{ investedValue: 0, quantity: 0.1, tokenName: "Bitcoin", tokenSymbol: "BTC" }],
              investmentProducts: [{ cashback: 0, investedValue: 0, isin: "IE00B4L5Y983", productName: "ETF", quantity: 2 }],
              sourceInstitution: "trade_republic",
              total: 10_000
            }]
          })
        };
      }

      if (url.startsWith("/api/binance/balances?")) {
        return {
          ok: true,
          json: async () => ({
            balances: [
              { eurValue: 1_000, freeAmount: 1, lockedAmount: 0, tokenName: "Ethereum", tokenSymbol: "ETH" }
            ],
            hasApiKey: true,
            isStale: false,
            syncedAt: "2026-06-01T08:00:00.000Z"
          })
        };
      }

      if (url.startsWith("/api/prices?")) {
        return {
          ok: true,
          json: async () => ({
            BTC: 60_000,
            ETH: 2_000,
            IE00B4L5Y983: 100
          })
        };
      }

      throw new Error(`Unexpected request ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await ensureFinanceCurrentValuation({
      binanceRefreshKey: 5,
      event: "login",
      priority: "user",
      user: valuationUser
    });

    expect(result.snapshot.status).toBe("ready");
    expect(result.snapshot.version).toMatchObject({
      binanceRefreshKey: 5,
      transactionCount: valuationUser.transactionCount
    });
    expect(result.snapshot.totals).toMatchObject({
      binance: { cents: 200_000 },
      checking: { cents: 10_000 },
      crypto: { cents: 800_000 },
      heritage: { cents: 830_000 },
      investment: { cents: 20_000 }
    });
    expect(getCurrentValuationSnapshot(valuationUser.id)).toBe(result.snapshot);
  });

  it("refreshes Trade Republic crypto valuation without Binance credentials", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T08:00:00.000Z"));

    const valuationUser: UserRecord = {
      ...user,
      checkingCount: 0,
      cryptoCount: 1,
      hasBinanceCredentials: false,
      id: "profile-current-valuation-no-binance",
      investmentCount: 0,
      transactionCount: 1
    };
    let btcPrice = 60_000;
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
              cryptoTokens: [{ investedValue: 0, quantity: 0.1, tokenName: "Bitcoin", tokenSymbol: "BTC" }],
              investmentProducts: [],
              sourceInstitution: "trade_republic",
              total: 0
            }]
          })
        };
      }

      if (url === "/api/prices?cryptos=BTC") {
        return {
          ok: true,
          json: async () => ({ BTC: btcPrice })
        };
      }

      throw new Error(`Unexpected request ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = await ensureFinanceCurrentValuation({
      event: "login",
      livePriceMaxAgeMs: 0,
      priority: "user",
      user: valuationUser
    });

    expect(first.snapshot.totals).toMatchObject({
      binance: { cents: 0 },
      crypto: { cents: 600_000 },
      heritage: { cents: 600_000 }
    });

    vi.setSystemTime(new Date("2026-06-01T08:00:05.000Z"));
    btcPrice = 61_000;

    const second = await ensureFinanceCurrentValuation({
      event: "dashboard-change",
      livePriceMaxAgeMs: 0,
      priority: "user",
      user: valuationUser
    });

    expect(second.snapshot.totals.crypto.cents).toBe(610_000);
    expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith("/api/binance/"))).toBe(false);
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/prices?cryptos=BTC")).toHaveLength(2);
  });

  it("warms current valuation snapshots for active and inactive profiles", async () => {
    const activeProfile: UserRecord = {
      ...user,
      checkingCount: 1,
      cryptoCount: 0,
      hasBinanceCredentials: false,
      id: "profile-active-valuation",
      investmentCount: 1,
      transactionCount: 2
    };
    const inactiveProfile: UserRecord = {
      ...user,
      checkingCount: 0,
      cryptoCount: 1,
      hasBinanceCredentials: false,
      id: "profile-inactive-valuation",
      investmentCount: 0,
      transactionCount: 1
    };
    const fetchMock = vi.fn(async (url: string) => {
      if (url.startsWith("/api/transactions/dashboard?")) {
        const userId = new URL(url, "https://morgan.test").searchParams.get("userId");

        if (userId === activeProfile.id) {
          return {
            ok: true,
            json: async () => ({
              accountTotals: { checking: 10_000, crypto: 0, heritage: 10_000, investment: 0 },
              dailyData: [],
              monthlyData: [],
              providerSummaries: [{
                checking: { cashback: 0, expenses: 0, income: 0, interest: 0, tax: 0, total: 10_000 },
                cryptoTokens: [],
                investmentProducts: [{
                  cashback: 0,
                  investedValue: 0,
                  isin: "IE00B4L5Y983",
                  productName: "ETF",
                  quantity: 3
                }],
                sourceInstitution: "trade_republic",
                total: 10_000
              }]
            })
          };
        }

        if (userId === inactiveProfile.id) {
          return {
            ok: true,
            json: async () => ({
              accountTotals: { checking: 0, crypto: 0, heritage: 0, investment: 0 },
              dailyData: [],
              monthlyData: [],
              providerSummaries: [{
                checking: { cashback: 0, expenses: 0, income: 0, interest: 0, tax: 0, total: 0 },
                cryptoTokens: [{ investedValue: 0, quantity: 2, tokenName: "Ethereum", tokenSymbol: "ETH" }],
                investmentProducts: [],
                sourceInstitution: "trade_republic",
                total: 0
              }]
            })
          };
        }
      }

      if (url.startsWith("/api/prices?")) {
        return {
          ok: true,
          json: async () => ({
            ETH: 2_000,
            IE00B4L5Y983: 50
          })
        };
      }

      throw new Error(`Unexpected request ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await ensureFinanceProfilesCurrentValuations({
      activeUserId: activeProfile.id,
      event: "tab-focus",
      livePriceMaxAgeMs: 0,
      priority: "user",
      users: [inactiveProfile, activeProfile, inactiveProfile]
    });

    expect(result.userIds).toEqual([activeProfile.id, inactiveProfile.id]);
    expect(getCurrentValuationSnapshot(activeProfile.id)?.totals).toMatchObject({
      checking: { cents: 10_000 },
      crypto: { cents: 0 },
      heritage: { cents: 25_000 },
      investment: { cents: 15_000 }
    });
    expect(getCurrentValuationSnapshot(inactiveProfile.id)?.totals).toMatchObject({
      checking: { cents: 0 },
      crypto: { cents: 400_000 },
      heritage: { cents: 400_000 },
      investment: { cents: 0 }
    });
    expect(fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/transactions/dashboard?"))).toHaveLength(2);
  });

  it("reports refreshed live quote diagnostics after a later price update", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T08:00:00.000Z"));
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
              cryptoTokens: [{ investedValue: 0, quantity: 0.1, tokenName: "Bitcoin", tokenSymbol: "BTC" }],
              investmentProducts: [],
              sourceInstitution: "trade_republic",
              total: 0
            }]
          })
        };
      }

      if (url === "/api/prices?cryptos=BTC") {
        return {
          ok: true,
          json: async () => ({ BTC: 62000 })
        };
      }

      throw new Error(`Unexpected request ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await ensureFinanceStageReady({
      event: "dashboard-change",
      priority: "user",
      stage: "dashboard",
      user
    });

    vi.setSystemTime(new Date("2026-06-01T08:00:15.000Z"));
    saveLivePricesToCache({ BTC: 63000 });

    expect(getFinanceSessionDiagnostics()).toEqual([
      expect.objectContaining({
        lastFetchAt: new Date("2026-06-01T08:00:15.000Z").getTime(),
        maxQuoteAgeMs: 0,
        livePriceDiagnostics: expect.objectContaining({
          quotes: [
            expect.objectContaining({
              key: "BTC",
              value: 63000
            })
          ]
        }),
        stage: "dashboard"
      })
    ]);
  });
});
