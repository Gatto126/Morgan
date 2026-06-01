import { afterEach, describe, expect, it, vi } from "vitest";

import type { DashboardData } from "@/components/dashboard/types";
import type { UserRecord } from "@/components/finance-shell/types";

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

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
    ...init
  });
}

const baseUser: UserRecord = {
  binanceApiKeyPreview: null,
  checkingCount: 2,
  cryptoCount: 0,
  hasBinanceCredentials: false,
  id: "profile-1",
  investmentCount: 0,
  name: "Profile",
  transactionCount: 2
};

const dashboardData: DashboardData = {
  accountTotals: {
    checking: 100_00,
    crypto: 0,
    heritage: 100_00,
    investment: 0
  },
  dailyData: [{
    checking: 100_00,
    crypto: 0,
    date: "2026-01-01",
    heritage: 100_00,
    investment: 0,
    month: "2026-01"
  }],
  monthlyData: [{
    checking: 100_00,
    crypto: 0,
    heritage: 100_00,
    investment: 0,
    month: "2026-01"
  }],
  providerSummaries: []
};

async function loadModules() {
  vi.resetModules();

  const cache = await import("@/components/finance-shell/dashboard-stage-data-cache");
  const preview = await import("@/components/finance-shell/use-account-portfolio-preview-data");

  return { cache, preview };
}

describe("account portfolio preview cache", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("hydrates preview records from the shared private dashboard cache", async () => {
    vi.stubGlobal("window", { sessionStorage: createMemoryStorage() });

    const { cache, preview } = await loadModules();
    cache.seedDashboardStageDataCache("dashboard", baseUser.id, baseUser.transactionCount, dashboardData);
    cache.seedDashboardStageDataCache("binance", baseUser.id, 0, {
      balances: [{
        eurValue: 42,
        freeAmount: 1,
        lockedAmount: 0,
        tokenName: "Bitcoin",
        tokenSymbol: "BTC"
      }]
    });

    const records = preview.readAccountPortfolioPreviewCache([
      {
        ...baseUser,
        hasBinanceCredentials: true
      }
    ]);

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      binanceBalances: [{ tokenSymbol: "BTC" }],
      data: dashboardData,
      user: expect.objectContaining({ id: baseUser.id })
    });
  });

  it("fetches and caches the lightweight dashboard preview payload", async () => {
    vi.stubGlobal("window", { sessionStorage: createMemoryStorage() });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(dashboardData));
    vi.stubGlobal("fetch", fetchMock);

    const { preview } = await loadModules();
    await expect(preview.fetchDashboardPreviewData(baseUser)).resolves.toEqual(dashboardData);
    await expect(preview.fetchDashboardPreviewData(baseUser)).resolves.toEqual(dashboardData);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/transactions/dashboard/preview?"),
      expect.objectContaining({ cache: "default" })
    );
    expect(preview.readAccountPortfolioPreviewCache([baseUser])[0].data).toEqual(dashboardData);
  });

  it("does not build a partial aggregate when a profile version is missing from cache", async () => {
    vi.stubGlobal("window", { sessionStorage: createMemoryStorage() });

    const { cache, preview } = await loadModules();
    cache.seedDashboardStageDataCache("dashboard", baseUser.id, baseUser.transactionCount, dashboardData);

    expect(preview.readAccountPortfolioPreviewCache([
      baseUser,
      {
        ...baseUser,
        id: "profile-2",
        transactionCount: 7
      }
    ])).toEqual([]);
  });
});
