import { afterEach, describe, expect, it, vi } from "vitest";

import { normalizeDashboardStageData } from "@/components/finance-shell/dashboard-stage-data-normalizers";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
    ...init
  });
}

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

async function loadCacheModule() {
  vi.resetModules();
  return import("@/components/finance-shell/dashboard-stage-data-cache");
}

describe("dashboard stage data cache", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reuses fresh data for the same user, stage and version", async () => {
    const payload = { providerSummaries: [] };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(payload));
    vi.stubGlobal("fetch", fetchMock);

    const cache = await loadCacheModule();
    const normalizedPayload = normalizeDashboardStageData("dashboard", payload);

    await expect(cache.fetchDashboardStageData("dashboard", "user-1", { version: 4 })).resolves.toEqual(normalizedPayload);
    await expect(cache.fetchDashboardStageData("dashboard", "user-1", { version: 4 })).resolves.toEqual(normalizedPayload);

    const dateKey = cache.getDashboardStageCacheDateKey("dashboard");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/transactions/dashboard?userId=user-1&v=4&d=${dateKey}`,
      expect.objectContaining({ cache: "default" })
    );
    expect(cache.readDashboardStageDataCache("dashboard", "user-1", 4)).toEqual(normalizedPayload);
  });

  it("shares an in-flight request between callers", async () => {
    const payload = { providers: [] };
    let resolveFetch: (response: Response) => void = () => undefined;
    const fetchMock = vi.fn().mockReturnValue(new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    }));
    vi.stubGlobal("fetch", fetchMock);

    const cache = await loadCacheModule();
    const firstRequest = cache.fetchDashboardStageData("checking", "user-1", { version: 7 });
    const secondRequest = cache.fetchDashboardStageData("checking", "user-1", { version: 7 });
    const normalizedPayload = normalizeDashboardStageData("checking", payload);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch(jsonResponse(payload));

    await expect(firstRequest).resolves.toEqual(normalizedPayload);
    await expect(secondRequest).resolves.toEqual(normalizedPayload);
  });

  it("shares an in-flight force refresh for the same cache key", async () => {
    const payload = { providers: [{ sourceInstitution: "Imported" }] };
    let resolveFetch: (response: Response) => void = () => undefined;
    const fetchMock = vi.fn().mockReturnValue(new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    }));
    vi.stubGlobal("fetch", fetchMock);

    const cache = await loadCacheModule();
    const firstRequest = cache.fetchDashboardStageData("investment", "user-1", { force: true, version: 8 });
    const secondRequest = cache.fetchDashboardStageData("investment", "user-1", { force: true, version: 8 });
    const normalizedPayload = normalizeDashboardStageData("investment", payload);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch(jsonResponse(payload));

    await expect(firstRequest).resolves.toEqual(normalizedPayload);
    await expect(secondRequest).resolves.toEqual(normalizedPayload);
  });

  it("does not reuse a normal in-flight request for a force refresh", async () => {
    const normalPayload = { balances: [{ eurValue: 0, tokenSymbol: "BTC" }] };
    const forcePayload = { balances: [{ eurValue: 100, tokenSymbol: "BTC" }] };
    let resolveNormalFetch: (response: Response) => void = () => undefined;
    let resolveForceFetch: (response: Response) => void = () => undefined;
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(new Promise<Response>((resolve) => {
        resolveNormalFetch = resolve;
      }))
      .mockReturnValueOnce(new Promise<Response>((resolve) => {
        resolveForceFetch = resolve;
      }));
    vi.stubGlobal("fetch", fetchMock);

    const cache = await loadCacheModule();
    const normalRequest = cache.fetchDashboardStageData("binance", "user-1", { version: 3 });
    const forceRequest = cache.fetchDashboardStageData("binance", "user-1", { force: true, version: 3 });
    const normalizedNormalPayload = normalizeDashboardStageData("binance", normalPayload);
    const normalizedForcePayload = normalizeDashboardStageData("binance", forcePayload);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    resolveForceFetch(jsonResponse(forcePayload));
    resolveNormalFetch(jsonResponse(normalPayload));

    await expect(forceRequest).resolves.toEqual(normalizedForcePayload);
    await expect(normalRequest).resolves.toEqual(normalizedNormalPayload);
    expect(cache.readDashboardStageDataCache("binance", "user-1", 3)).toEqual(normalizedForcePayload);
  });

  it("force refresh bypasses cached data", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ providers: [{ sourceInstitution: "A" }] }))
      .mockResolvedValueOnce(jsonResponse({ providers: [{ sourceInstitution: "B" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const cache = await loadCacheModule();

    await expect(cache.fetchDashboardStageData("investment", "user-1", { version: 2 })).resolves.toEqual(normalizeDashboardStageData("investment", {
      providers: [{ sourceInstitution: "A" }]
    }));
    await expect(cache.fetchDashboardStageData("investment", "user-1", { force: true, version: 2 })).resolves.toEqual(normalizeDashboardStageData("investment", {
      providers: [{ sourceInstitution: "B" }]
    }));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const dateKey = cache.getDashboardStageCacheDateKey("investment");
    expect(fetchMock).toHaveBeenLastCalledWith(
      `/api/transactions/investment?userId=user-1&v=2&d=${dateKey}`,
      expect.objectContaining({ cache: "reload" })
    );
  });

  it("hydrates same-day historical data from private session storage after a reload", async () => {
    const storage = createMemoryStorage();
    vi.stubGlobal("window", { sessionStorage: storage });
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const payload = {
      dailyData: [],
      monthlyData: [],
      providers: [{
        cashback: 0,
        expenses: 0,
        income: 0,
        interest: 0,
        sourceInstitution: "BBVA",
        tax: 0,
        total: 0,
        transactionCount: 0
      }]
    };

    let cache = await loadCacheModule();
    cache.seedDashboardStageDataCache("checking", "user-1", 4, payload);

    vi.resetModules();
    nowSpy.mockReturnValue(62_000);
    cache = await import("@/components/finance-shell/dashboard-stage-data-cache");

    expect(cache.readDashboardStageDataCache("checking", "user-1", 4)).toEqual(payload);
    expect(cache.isDashboardStageDataCacheFresh("checking", "user-1", 4)).toBe(true);
  });

  it("does not hydrate previous-day historical data for the same transaction version", async () => {
    vi.useFakeTimers();
    const storage = createMemoryStorage();
    vi.stubGlobal("window", { sessionStorage: storage });
    vi.setSystemTime(new Date("2026-06-01T12:00:00.000Z"));
    const payload = {
      dailyData: [],
      monthlyData: [],
      providers: [{
        cashback: 0,
        expenses: 0,
        income: 0,
        interest: 0,
        products: [],
        sourceInstitution: "Cached",
        tax: 0,
        total: 0,
        transactionCount: 0
      }]
    };

    let cache = await loadCacheModule();
    cache.seedDashboardStageDataCache("investment", "user-1", 4, payload);

    vi.resetModules();
    vi.setSystemTime(new Date("2026-06-02T00:01:00.000Z"));
    cache = await import("@/components/finance-shell/dashboard-stage-data-cache");

    expect(cache.readDashboardStageDataCache("investment", "user-1", 4)).toBeNull();
  });

  it("lets visible UI reject stale persisted data while keeping it available as backup cache", async () => {
    const storage = createMemoryStorage();
    vi.stubGlobal("window", { sessionStorage: storage });
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(1_000);
    const payload = {
      dailyData: [],
      monthlyData: [],
      providers: [{
        cashback: 0,
        expenses: 0,
        income: 0,
        interest: 0,
        sourceInstitution: "BBVA",
        tax: 0,
        total: 1_00,
        transactionCount: 1
      }]
    };

    let cache = await loadCacheModule();
    cache.seedDashboardStageDataCache("checking", "user-1", 4, payload);

    vi.resetModules();
    nowSpy.mockReturnValue(62_000);
    cache = await import("@/components/finance-shell/dashboard-stage-data-cache");

    expect(
      cache.readDashboardStageDataCache("checking", "user-1", 4, {
        maxAgeMs: cache.dashboardStageDataFreshTtlMs
      })
    ).toBeNull();
    expect(cache.readDashboardStageDataCache("checking", "user-1", 4)).toEqual(payload);
  });

  it("clears failed requests so the next call can retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "Database offline." }, { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ providers: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const cache = await loadCacheModule();

    await expect(cache.fetchDashboardStageData("crypto", "user-1", { version: 1 })).rejects.toThrow("Database offline.");
    await expect(cache.fetchDashboardStageData("crypto", "user-1", { version: 1 })).resolves.toEqual(
      normalizeDashboardStageData("crypto", { providers: [] })
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps existing data visible when a force refresh fails", async () => {
    const previousPayload = { providers: [{ sourceInstitution: "Cached" }] };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(previousPayload))
      .mockResolvedValueOnce(jsonResponse({ error: "Database offline." }, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);

    const cache = await loadCacheModule();
    const normalizedPreviousPayload = normalizeDashboardStageData("checking", previousPayload);

    await expect(cache.fetchDashboardStageData("checking", "user-1", { version: 3 })).resolves.toEqual(normalizedPreviousPayload);
    await expect(cache.fetchDashboardStageData("checking", "user-1", { force: true, version: 3 })).rejects.toThrow("Database offline.");

    expect(cache.readDashboardStageDataCache("checking", "user-1", 3)).toEqual(normalizedPreviousPayload);
    await expect(cache.fetchDashboardStageData("checking", "user-1", { version: 3 })).resolves.toEqual(normalizedPreviousPayload);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
