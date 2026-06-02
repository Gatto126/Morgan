import { describe, expect, it } from "vitest";

import {
  isPortfolioValuationSnapshotCurrent,
  selectPortfolioCurrentValuationPoint
} from "@/components/portfolio-dashboard/portfolio-current-valuation";
import type { CurrentValuationSnapshot, ValuationValue } from "@/components/finance-shell/current-valuations-store";

function value(cents: number | null): ValuationValue {
  return {
    cents,
    fetchedAt: 1_000,
    source: "derived",
    status: cents === null ? "missing-live-quote" : "ready"
  };
}

function snapshot(overrides: Partial<CurrentValuationSnapshot["version"]> = {}): CurrentValuationSnapshot {
  return {
    assets: {
      "investment:trade_republic:core": {
        category: "investment",
        chartKey: "Core ETF",
        id: "investment:trade_republic:core",
        label: "Core ETF",
        priceKey: "IE00B4L5Y983",
        providerIds: ["trade_republic"],
        providerValues: {
          trade_republic: value(20_000)
        },
        quantity: 2,
        value: value(20_000)
      }
    },
    diagnostics: {
      lastFetchAt: 1_000,
      maxQuoteAgeMs: 0,
      missingKeys: [],
      unavailableKeys: []
    },
    profileId: "profile-1",
    providers: {
      trade_republic: {
        hasBinance: false,
        hasChecking: false,
        hasCrypto: true,
        hasInvestment: true,
        id: "trade_republic",
        label: "Trade Republic",
        totals: {
          binance: value(0),
          checking: value(0),
          crypto: value(30_000),
          investment: value(20_000),
          total: value(50_000)
        },
        transactionCount: 4
      }
    },
    quoteKeys: {
      cryptos: ["BTC"],
      isins: ["IE00B4L5Y983"]
    },
    status: "ready",
    totals: {
      binance: value(0),
      checking: value(0),
      crypto: value(30_000),
      heritage: value(50_000),
      investment: value(20_000)
    },
    updatedAt: 1_000,
    version: {
      binanceRefreshKey: 3,
      checkingCount: 1,
      cryptoCount: 2,
      dateKey: "2026-06-02",
      investmentCount: 4,
      transactionCount: 6,
      ...overrides
    }
  };
}

describe("portfolio current valuation selection", () => {
  it("selects valuation current points only for the current portfolio version", () => {
    const currentSnapshot = snapshot();

    expect(isPortfolioValuationSnapshotCurrent(currentSnapshot, {
      binanceRefreshKey: 3,
      dateKey: "2026-06-02",
      stage: "investment",
      transactionCount: 4
    })).toBe(true);

    expect(selectPortfolioCurrentValuationPoint(currentSnapshot, {
      activeTab: "trade_republic",
      binanceRefreshKey: 3,
      dataFresh: true,
      dateKey: "2026-06-02",
      stage: "investment",
      transactionCount: 4
    })).toMatchObject({
      "Core ETF": 20_000,
      balance: 20_000,
      heritage: 20_000,
      trade_republic: 20_000
    });
  });

  it("rejects stale dates, stale stage versions and stale Binance refresh keys", () => {
    const currentSnapshot = snapshot();

    expect(selectPortfolioCurrentValuationPoint(currentSnapshot, {
      activeTab: "ALL",
      binanceRefreshKey: 3,
      dataFresh: true,
      dateKey: "2026-06-03",
      stage: "investment",
      transactionCount: 4
    })).toBeNull();

    expect(selectPortfolioCurrentValuationPoint(currentSnapshot, {
      activeTab: "ALL",
      binanceRefreshKey: 3,
      dataFresh: true,
      dateKey: "2026-06-02",
      stage: "investment",
      transactionCount: 5
    })).toBeNull();

    expect(selectPortfolioCurrentValuationPoint(currentSnapshot, {
      activeTab: "ALL",
      binanceRefreshKey: 4,
      dataFresh: true,
      dateKey: "2026-06-02",
      stage: "crypto",
      transactionCount: 2
    })).toBeNull();
  });

  it("keeps pending valuation points instead of falling back to local totals", () => {
    const pendingSnapshot = snapshot();
    pendingSnapshot.totals.investment = value(null);
    pendingSnapshot.providers.trade_republic.totals.investment = value(null);
    pendingSnapshot.assets["investment:trade_republic:core"].value = value(null);
    pendingSnapshot.assets["investment:trade_republic:core"].providerValues.trade_republic = value(null);

    expect(selectPortfolioCurrentValuationPoint(pendingSnapshot, {
      activeTab: "trade_republic",
      binanceRefreshKey: 3,
      dataFresh: true,
      dateKey: "2026-06-02",
      stage: "investment",
      transactionCount: 4
    })).toMatchObject({
      "Core ETF": null,
      balance: null,
      heritage: null,
      trade_republic: null
    });
  });
});
