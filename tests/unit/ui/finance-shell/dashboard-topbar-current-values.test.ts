import { afterEach, describe, expect, it, vi } from "vitest";

import { seedDashboardStageDataCache } from "@/components/finance-shell/dashboard-stage-data-cache";
import { seedCurrentDashboardStageTopbars } from "@/components/finance-shell/dashboard-topbar-current-values";
import { readDashboardTopbarItems } from "@/components/finance-shell/dashboard-topbar-store";
import type { UserRecord } from "@/components/finance-shell/types";
import {
  globalLivePricesCache,
  globalLivePricesCacheUpdatedAt,
  globalLiveQuotesCache,
  saveLivePricesToCache
} from "@/shared/live-prices";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    }
  };
}

const user: UserRecord = {
  checkingCount: 1,
  cryptoCount: 1,
  hasBinanceCredentials: false,
  id: "live-topbar-profile",
  investmentCount: 1,
  name: "Main",
  transactionCount: 3
};

describe("dashboard topbar current values", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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

  it("refreshes crypto and investment stage topbars from shared live prices without visiting those dashboards", () => {
    vi.stubGlobal("window", {
      dispatchEvent: vi.fn(),
      sessionStorage: createMemoryStorage()
    });
    seedDashboardStageDataCache("dashboard", user.id, user.transactionCount, {
      accountTotals: {
        checking: 100_000,
        crypto: 0,
        heritage: 100_000,
        investment: 0
      },
      dailyData: [],
      monthlyData: [],
      providerSummaries: [{
        checking: {
          cashback: 0,
          expenses: 0,
          income: 0,
          interest: 0,
          tax: 0,
          total: 100_000
        },
        cryptoTokens: [{
          investedValue: 0,
          quantity: 0.1,
          tokenName: "Bitcoin",
          tokenSymbol: "BTC"
        }],
        investmentProducts: [{
          cashback: 0,
          investedValue: 0,
          isin: "IE00B4L5Y983",
          productName: "Core ETF",
          quantity: 2
        }],
        sourceInstitution: "trade_republic",
        total: 100_000
      }]
    });

    saveLivePricesToCache({
      BTC: 60_000,
      IE00B4L5Y983: 100
    });
    seedCurrentDashboardStageTopbars(user);

    expect(readDashboardTopbarItems("crypto", user.id).map((item) => item.value)).toEqual([
      "6000,00 \u20ac",
      "6000,00 \u20ac"
    ]);
    expect(readDashboardTopbarItems("investment", user.id).map((item) => item.value)).toEqual([
      "200,00 \u20ac",
      "200,00 \u20ac"
    ]);

    saveLivePricesToCache({
      BTC: 61_000,
      IE00B4L5Y983: 101
    });
    seedCurrentDashboardStageTopbars(user);

    expect(readDashboardTopbarItems("crypto", user.id).map((item) => item.value)).toEqual([
      "6100,00 \u20ac",
      "6100,00 \u20ac"
    ]);
    expect(readDashboardTopbarItems("investment", user.id).map((item) => item.value)).toEqual([
      "202,00 \u20ac",
      "202,00 \u20ac"
    ]);
  });
});
