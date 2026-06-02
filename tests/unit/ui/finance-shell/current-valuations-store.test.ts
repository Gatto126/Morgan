import { afterEach, describe, expect, it, vi } from "vitest";

import type { DashboardData, ProviderSummary } from "@/components/dashboard/types";
import {
  buildCurrentValuationSnapshot,
  getCurrentValuationSnapshot,
  getCurrentValuationState,
  invalidateCurrentValuation,
  refreshCurrentValuationFromCaches,
  resetCurrentValuationsStore,
  selectCurrentValuationHeritageAggregate,
  selectCurrentValuationChartPoint,
  selectCurrentPortfolioValuationChartPoint,
  selectCurrentValuationTopbar,
  subscribeCurrentValuation
} from "@/components/finance-shell/current-valuations-store";
import { seedDashboardStageDataCache } from "@/components/finance-shell/dashboard-stage-data-cache";
import type { UserRecord } from "@/components/finance-shell/types";
import {
  globalLivePricesCache,
  globalLivePricesCacheUpdatedAt,
  globalLiveQuotesCache,
  saveLivePricesToCache
} from "@/shared/live-prices";

const profile: UserRecord = {
  checkingCount: 1,
  cryptoCount: 1,
  hasBinanceCredentials: false,
  id: "valuation-profile",
  investmentCount: 1,
  name: "Main",
  transactionCount: 3
};

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

function clearLivePriceCaches() {
  for (const key of Object.keys(globalLivePricesCache)) {
    delete globalLivePricesCache[key];
  }
  for (const key of Object.keys(globalLivePricesCacheUpdatedAt)) {
    delete globalLivePricesCacheUpdatedAt[key];
  }
  for (const key of Object.keys(globalLiveQuotesCache)) {
    delete globalLiveQuotesCache[key];
  }
}

describe("current valuations store", () => {
  afterEach(() => {
    vi.useRealTimers();
    resetCurrentValuationsStore();
    clearLivePriceCaches();
  });

  it("builds one coherent current snapshot for topbar, cards and chart selectors", () => {
    const now = 1_000;
    const snapshot = buildCurrentValuationSnapshot({
      binancePayload: {
        balances: [{
          eurValue: 2_000,
          freeAmount: 1,
          lockedAmount: 0,
          tokenName: "Ethereum",
          tokenSymbol: "ETH"
        }]
      },
      binanceRefreshKey: 2,
      dashboardData,
      dateKey: "2026-06-01",
      livePrices: {
        BTC: 20_000,
        ETH: 2_000,
        IE00B4L5Y983: 100
      },
      liveQuotes: {
        BTC: {
          attemptedAt: now,
          fetchedAt: now,
          source: "api/prices",
          status: "available",
          value: 20_000
        },
        ETH: {
          attemptedAt: now,
          fetchedAt: now,
          source: "api/prices",
          status: "available",
          value: 2_000
        },
        IE00B4L5Y983: {
          attemptedAt: now,
          fetchedAt: now,
          source: "api/prices",
          status: "available",
          value: 100
        }
      },
      now,
      profile: {
        ...profile,
        hasBinanceCredentials: true
      }
    });

    expect(snapshot.status).toBe("ready");
    expect(snapshot.quoteKeys).toEqual({
      cryptos: ["BTC", "ETH"],
      isins: ["IE00B4L5Y983"]
    });
    expect(snapshot.totals).toMatchObject({
      binance: { cents: 200_000, status: "ready" },
      checking: { cents: 10_000, status: "ready" },
      crypto: { cents: 1_200_000, status: "ready" },
      heritage: { cents: 1_230_000, status: "ready" },
      investment: { cents: 20_000, status: "ready" }
    });
    expect(snapshot.providers.trade_republic.totals).toMatchObject({
      crypto: { cents: 1_000_000 },
      investment: { cents: 20_000 }
    });
    expect(selectCurrentValuationTopbar(snapshot, "crypto").map((item) => [item.id, item.value.cents])).toEqual([
      ["crypto", 1_200_000],
      ["crypto:trade_republic", 1_000_000],
      ["crypto:BINANCE", 200_000]
    ]);
    expect(selectCurrentValuationChartPoint(snapshot)).toMatchObject({
      Bitcoin: 1_000_000,
      "Core ETF": 20_000,
      binance: 200_000,
      crypto: 1_200_000,
      heritage: 1_230_000,
      investment: 20_000,
      rawMonth: "2026-06-01"
    });
    expect(selectCurrentPortfolioValuationChartPoint(snapshot, "investment", "trade_republic")).toMatchObject({
      "Core ETF": 20_000,
      balance: 20_000,
      heritage: 20_000,
      rawMonth: "2026-06-01",
      trade_republic: 20_000
    });
    expect(selectCurrentPortfolioValuationChartPoint(snapshot, "crypto", "BINANCE")).toMatchObject({
      "Ethereum (ETH)": 200_000,
      balance: 200_000,
      BINANCE: 200_000,
      heritage: 1_200_000,
      rawMonth: "2026-06-01",
      trade_republic: 1_000_000
    });
  });

  it("values Trade Republic crypto without requiring Binance credentials", () => {
    const now = 1_000;
    const snapshot = buildCurrentValuationSnapshot({
      dashboardData,
      dateKey: "2026-06-01",
      livePrices: {
        BTC: 20_000,
        IE00B4L5Y983: 100
      },
      liveQuotes: {
        BTC: {
          attemptedAt: now,
          fetchedAt: now,
          source: "api/prices",
          status: "available",
          value: 20_000
        },
        IE00B4L5Y983: {
          attemptedAt: now,
          fetchedAt: now,
          source: "api/prices",
          status: "available",
          value: 100
        }
      },
      now,
      profile: {
        ...profile,
        hasBinanceCredentials: false
      }
    });

    expect(snapshot.status).toBe("ready");
    expect(snapshot.totals).toMatchObject({
      binance: { cents: 0, status: "ready" },
      checking: { cents: 10_000, status: "ready" },
      crypto: { cents: 1_000_000, status: "ready" },
      heritage: { cents: 1_030_000, status: "ready" },
      investment: { cents: 20_000, status: "ready" }
    });
    expect(selectCurrentValuationTopbar(snapshot, "crypto").map((item) => item.id)).toEqual([
      "crypto",
      "crypto:trade_republic"
    ]);
  });

  it("aggregates home Heritage from per-profile current valuation snapshots", () => {
    const now = 1_000;
    const firstProfileSnapshot = buildCurrentValuationSnapshot({
      dashboardData,
      dateKey: "2026-06-01",
      livePrices: {
        BTC: 20_000,
        IE00B4L5Y983: 100
      },
      liveQuotes: {
        BTC: {
          attemptedAt: now,
          fetchedAt: now,
          source: "api/prices",
          status: "available",
          value: 20_000
        },
        IE00B4L5Y983: {
          attemptedAt: now,
          fetchedAt: now,
          source: "api/prices",
          status: "available",
          value: 100
        }
      },
      now,
      profile
    });
    const secondProfile: UserRecord = {
      ...profile,
      id: "valuation-profile-2"
    };
    const secondProfileSnapshot = buildCurrentValuationSnapshot({
      dashboardData: {
        ...dashboardData,
        accountTotals: {
          checking: 25_000,
          crypto: 0,
          heritage: 25_000,
          investment: 0
        },
        providerSummaries: [{
          checking: {
            cashback: 0,
            expenses: 0,
            income: 0,
            interest: 0,
            tax: 0,
            total: 25_000
          },
          cryptoTokens: [],
          investmentProducts: [],
          sourceInstitution: "bbva",
          total: 25_000
        }]
      },
      dateKey: "2026-06-01",
      livePrices: {},
      liveQuotes: {},
      now,
      profile: secondProfile
    });

    const aggregate = selectCurrentValuationHeritageAggregate(
      [profile, secondProfile],
      {
        [profile.id]: firstProfileSnapshot,
        [secondProfile.id]: secondProfileSnapshot
      },
      { dateKey: "2026-06-01" }
    );

    expect(aggregate.status).toBe("ready");
    expect(aggregate.value.cents).toBe(1_055_000);
    expect(aggregate.point).toMatchObject({
      checking: 35_000,
      crypto: 1_000_000,
      heritage: 1_055_000,
      investment: 20_000,
      rawMonth: "2026-06-01",
      value: 1_055_000
    });
  });

  it("does not publish a complete home Heritage aggregate when a profile snapshot is missing", () => {
    const now = 1_000;
    const snapshot = buildCurrentValuationSnapshot({
      dashboardData,
      dateKey: "2026-06-01",
      livePrices: {
        BTC: 20_000,
        IE00B4L5Y983: 100
      },
      liveQuotes: {
        BTC: {
          attemptedAt: now,
          fetchedAt: now,
          source: "api/prices",
          status: "available",
          value: 20_000
        },
        IE00B4L5Y983: {
          attemptedAt: now,
          fetchedAt: now,
          source: "api/prices",
          status: "available",
          value: 100
        }
      },
      now,
      profile
    });
    const pendingProfile: UserRecord = {
      ...profile,
      id: "valuation-profile-pending"
    };

    const aggregate = selectCurrentValuationHeritageAggregate(
      [profile, pendingProfile],
      {
        [profile.id]: snapshot
      },
      { dateKey: "2026-06-01" }
    );

    expect(aggregate.status).toBe("loading");
    expect(aggregate.value.cents).toBeNull();
    expect(aggregate.point).toBeNull();
    expect(aggregate.diagnostics.pendingProfileIds).toEqual([pendingProfile.id]);
  });

  it("keeps aggregate values pending when a required live quote is missing", () => {
    const snapshot = buildCurrentValuationSnapshot({
      dashboardData,
      dateKey: "2026-06-01",
      livePrices: {
        IE00B4L5Y983: 100
      },
      liveQuotes: {
        IE00B4L5Y983: {
          attemptedAt: 1_000,
          fetchedAt: 1_000,
          source: "api/prices",
          status: "available",
          value: 100
        }
      },
      now: 2_000,
      profile
    });

    expect(snapshot.status).toBe("partial");
    expect(snapshot.totals).toMatchObject({
      crypto: { cents: null, status: "missing-live-quote" },
      heritage: { cents: null, status: "missing-live-quote" },
      investment: { cents: 20_000, status: "ready" }
    });
    expect(snapshot.diagnostics).toMatchObject({
      missingKeys: ["BTC"],
      unavailableKeys: []
    });
    expect(selectCurrentValuationTopbar(snapshot, "crypto")).toEqual([]);
    expect(selectCurrentValuationTopbar(snapshot, "investment").map((item) => item.value.cents)).toEqual([
      20_000,
      20_000
    ]);
  });

  it("keeps a cache valuation draft pending when no committed snapshot exists", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:00:00.000Z"));
    seedDashboardStageDataCache("dashboard", profile.id, profile.transactionCount, dashboardData);
    saveLivePricesToCache({
      IE00B4L5Y983: 100
    });

    const snapshot = refreshCurrentValuationFromCaches(profile, { dateKey: "2026-06-01" });
    const state = getCurrentValuationState(profile.id);

    expect(snapshot).toBeNull();
    expect(getCurrentValuationSnapshot(profile.id)).toBeNull();
    expect(state.committedSnapshot).toBeNull();
    expect(state.draftSnapshot?.status).toBe("partial");
    expect(state.draftSnapshot?.totals.crypto).toMatchObject({
      cents: null,
      status: "missing-live-quote"
    });
  });

  it("keeps the committed snapshot visible while a cache refresh is partial, then swaps atomically", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:00:00.000Z"));
    seedDashboardStageDataCache("dashboard", profile.id, profile.transactionCount, dashboardData);
    saveLivePricesToCache({
      BTC: 20_000,
      IE00B4L5Y983: 100
    });

    const firstSnapshot = refreshCurrentValuationFromCaches(profile, { dateKey: "2026-06-01" });
    expect(firstSnapshot?.status).toBe("ready");
    expect(firstSnapshot?.totals.crypto.cents).toBe(1_000_000);

    clearLivePriceCaches();
    saveLivePricesToCache({
      IE00B4L5Y983: 100
    });

    const partialRefresh = refreshCurrentValuationFromCaches(profile, { dateKey: "2026-06-01" });
    let state = getCurrentValuationState(profile.id);

    expect(partialRefresh).toBe(firstSnapshot);
    expect(getCurrentValuationSnapshot(profile.id)).toBe(firstSnapshot);
    expect(state.committedSnapshot).toBe(firstSnapshot);
    expect(state.draftSnapshot?.status).toBe("partial");
    expect(state.draftSnapshot?.totals.crypto).toMatchObject({
      cents: null,
      status: "missing-live-quote"
    });
    expect(selectCurrentValuationChartPoint(getCurrentValuationSnapshot(profile.id))?.crypto).toBe(1_000_000);

    clearLivePriceCaches();
    saveLivePricesToCache({
      BTC: 21_000,
      IE00B4L5Y983: 100
    });

    const secondSnapshot = refreshCurrentValuationFromCaches(profile, { dateKey: "2026-06-01" });
    state = getCurrentValuationState(profile.id);

    expect(secondSnapshot?.status).toBe("ready");
    expect(secondSnapshot).not.toBe(firstSnapshot);
    expect(getCurrentValuationSnapshot(profile.id)).toBe(secondSnapshot);
    expect(state.committedSnapshot).toBe(secondSnapshot);
    expect(state.draftSnapshot).toBeNull();
    expect(selectCurrentValuationChartPoint(secondSnapshot)?.crypto).toBe(1_050_000);
  });

  it("rejects zero live quotes instead of publishing fake zero totals", () => {
    const snapshot = buildCurrentValuationSnapshot({
      dashboardData,
      dateKey: "2026-06-01",
      livePrices: {
        BTC: 0,
        IE00B4L5Y983: 100
      },
      liveQuotes: {
        BTC: {
          attemptedAt: 1_000,
          fetchedAt: 1_000,
          source: "api/prices",
          status: "available",
          value: 0
        },
        IE00B4L5Y983: {
          attemptedAt: 1_000,
          fetchedAt: 1_000,
          source: "api/prices",
          status: "available",
          value: 100
        }
      },
      now: 2_000,
      profile
    });

    expect(snapshot.status).toBe("partial");
    expect(snapshot.totals.crypto).toMatchObject({
      cents: null,
      status: "unavailable"
    });
    expect(snapshot.diagnostics).toMatchObject({
      missingKeys: [],
      unavailableKeys: ["BTC"]
    });
  });

  it("excludes Binance balances from current valuation when Binance live quotes are missing", () => {
    const now = 1_000;
    const snapshot = buildCurrentValuationSnapshot({
      binancePayload: {
        balances: [{
          eurValue: 12.34,
          freeAmount: 3,
          lockedAmount: 0,
          tokenName: "Polygon",
          tokenSymbol: "MATIC"
        }]
      },
      dashboardData,
      dateKey: "2026-06-01",
      livePrices: {
        BTC: 20_000,
        IE00B4L5Y983: 100
      },
      liveQuotes: {
        BTC: {
          attemptedAt: now,
          fetchedAt: now,
          source: "api/prices",
          status: "available",
          value: 20_000
        },
        IE00B4L5Y983: {
          attemptedAt: now,
          fetchedAt: now,
          source: "api/prices",
          status: "available",
          value: 100
        }
      },
      now,
      profile: {
        ...profile,
        hasBinanceCredentials: true
      }
    });

    expect(snapshot.status).toBe("ready");
    expect(snapshot.totals).toMatchObject({
      binance: { cents: 0, source: "live-quote", status: "ready" },
      crypto: { cents: 1_000_000, status: "ready" },
      heritage: { cents: 1_030_000, status: "ready" }
    });
    expect(snapshot.diagnostics.missingKeys).toEqual(["MATIC"]);
    expect(snapshot.providers.BINANCE).toBeUndefined();
    expect(Object.values(snapshot.assets).filter((asset) => asset.category === "binance")).toEqual([]);
    expect(selectCurrentValuationChartPoint(snapshot)).toMatchObject({
      binance: null,
      crypto: 1_000_000,
      heritage: 1_030_000,
      rawMonth: "2026-06-01"
    });
  });

  it("values Binance open balances from live quotes even when synced EUR value is zero", () => {
    const now = 1_000;
    const snapshot = buildCurrentValuationSnapshot({
      binancePayload: {
        balances: [{
          eurValue: 0,
          freeAmount: 2,
          lockedAmount: 0,
          tokenName: "Solana",
          tokenSymbol: "SOL"
        }]
      },
      dashboardData,
      dateKey: "2026-06-01",
      livePrices: {
        BTC: 20_000,
        IE00B4L5Y983: 100,
        SOL: 150
      },
      liveQuotes: {
        BTC: {
          attemptedAt: now,
          fetchedAt: now,
          source: "api/prices",
          status: "available",
          value: 20_000
        },
        IE00B4L5Y983: {
          attemptedAt: now,
          fetchedAt: now,
          source: "api/prices",
          status: "available",
          value: 100
        },
        SOL: {
          attemptedAt: now,
          fetchedAt: now,
          source: "api/prices",
          status: "available",
          value: 150
        }
      },
      now,
      profile: {
        ...profile,
        hasBinanceCredentials: true
      }
    });

    expect(snapshot.status).toBe("ready");
    expect(snapshot.quoteKeys.cryptos).toEqual(["BTC", "SOL"]);
    expect(snapshot.totals).toMatchObject({
      binance: { cents: 30_000, status: "ready" },
      crypto: { cents: 1_030_000, status: "ready" },
      heritage: { cents: 1_060_000, status: "ready" }
    });
    expect(snapshot.providers.BINANCE?.hasBinance).toBe(true);
    expect(selectCurrentValuationTopbar(snapshot, "crypto").map((item) => [item.id, item.value.cents])).toContainEqual([
      "crypto:BINANCE",
      30_000
    ]);
  });

  it("publishes cached snapshots to subscribers and invalidates by profile", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T12:00:00.000Z"));
    seedDashboardStageDataCache("dashboard", profile.id, profile.transactionCount, dashboardData);
    saveLivePricesToCache({
      BTC: 20_000,
      IE00B4L5Y983: 100
    });

    const listener = vi.fn();
    const unsubscribe = subscribeCurrentValuation(profile.id, listener);
    const snapshot = refreshCurrentValuationFromCaches(profile);

    expect(snapshot?.status).toBe("ready");
    expect(getCurrentValuationSnapshot(profile.id)).toBe(snapshot);
    expect(listener).toHaveBeenCalledWith(snapshot);

    invalidateCurrentValuation(profile.id);

    expect(getCurrentValuationSnapshot(profile.id)).toBeNull();
    expect(listener).toHaveBeenLastCalledWith(null);

    unsubscribe();
  });
});
