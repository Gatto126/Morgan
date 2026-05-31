import { afterEach, describe, expect, it, vi } from "vitest";

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
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reuses fresh data for the same user, stage and version", async () => {
    const payload = { providerSummaries: [] };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(payload));
    vi.stubGlobal("fetch", fetchMock);

    const cache = await loadCacheModule();

    await expect(cache.fetchDashboardStageData("dashboard", "user-1", { version: 4 })).resolves.toEqual(payload);
    await expect(cache.fetchDashboardStageData("dashboard", "user-1", { version: 4 })).resolves.toEqual(payload);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/transactions/dashboard?userId=user-1&v=4",
      expect.objectContaining({ cache: "default" })
    );
    expect(cache.readDashboardStageDataCache("dashboard", "user-1", 4)).toEqual(payload);
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

    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolveFetch(jsonResponse(payload));

    await expect(firstRequest).resolves.toEqual(payload);
    await expect(secondRequest).resolves.toEqual(payload);
  });

  it("force refresh bypasses cached data", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ providers: [{ sourceInstitution: "A" }] }))
      .mockResolvedValueOnce(jsonResponse({ providers: [{ sourceInstitution: "B" }] }));
    vi.stubGlobal("fetch", fetchMock);

    const cache = await loadCacheModule();

    await expect(cache.fetchDashboardStageData("investment", "user-1", { version: 2 })).resolves.toEqual({
      providers: [{ sourceInstitution: "A" }]
    });
    await expect(cache.fetchDashboardStageData("investment", "user-1", { force: true, version: 2 })).resolves.toEqual({
      providers: [{ sourceInstitution: "B" }]
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/transactions/investment?userId=user-1&v=2",
      expect.objectContaining({ cache: "reload" })
    );
  });

  it("hydrates stale-but-usable data from private session storage after a reload", async () => {
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
    expect(cache.isDashboardStageDataCacheFresh("checking", "user-1", 4)).toBe(false);
  });

  it("clears failed requests so the next call can retry", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "Database offline." }, { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ providers: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const cache = await loadCacheModule();

    await expect(cache.fetchDashboardStageData("crypto", "user-1", { version: 1 })).rejects.toThrow("Database offline.");
    await expect(cache.fetchDashboardStageData("crypto", "user-1", { version: 1 })).resolves.toEqual({ providers: [] });

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

    await expect(cache.fetchDashboardStageData("checking", "user-1", { version: 3 })).resolves.toEqual(previousPayload);
    await expect(cache.fetchDashboardStageData("checking", "user-1", { force: true, version: 3 })).rejects.toThrow("Database offline.");

    expect(cache.readDashboardStageDataCache("checking", "user-1", 3)).toEqual(previousPayload);
    await expect(cache.fetchDashboardStageData("checking", "user-1", { version: 3 })).resolves.toEqual(previousPayload);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
