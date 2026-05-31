import { afterEach, describe, expect, it, vi } from "vitest";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status: 200,
    ...init
  });
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
});
