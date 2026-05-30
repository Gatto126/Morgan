import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchAndCacheLivePrices,
  getLivePriceRequestKey,
  globalLivePricesCache,
  globalLivePricesCacheUpdatedAt,
  saveLivePricesToCache
} from "@/shared/live-prices";

function clearLivePriceCache() {
  for (const key of Object.keys(globalLivePricesCache)) {
    delete globalLivePricesCache[key];
  }
  for (const key of Object.keys(globalLivePricesCacheUpdatedAt)) {
    delete globalLivePricesCacheUpdatedAt[key];
  }
}

describe("live price client cache", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    clearLivePriceCache();
  });

  it("normalizes request keys", () => {
    expect(getLivePriceRequestKey({
      cryptos: ["ETH", "BTC", "BTC", "XF000ETH0019"],
      isins: ["IE00B4L5Y983", "IE00B4L5Y983"]
    })).toBe("isins=IE00B4L5Y983|cryptos=BTC,ETH");
  });

  it("caches successful price responses", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        BTC: 62000,
        IE00B4L5Y983: 123
      })
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAndCacheLivePrices({
      cryptos: ["BTC"],
      isins: ["IE00B4L5Y983"]
    })).resolves.toEqual({
      BTC: 62000,
      IE00B4L5Y983: 123
    });

    expect(globalLivePricesCache.BTC).toBe(62000);
    expect(fetchMock).toHaveBeenCalledWith("/api/prices?isins=IE00B4L5Y983&cryptos=BTC");
  });

  it("reuses fresh cached prices without another request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    saveLivePricesToCache({ BTC: 62000 });

    await expect(fetchAndCacheLivePrices({ cryptos: ["BTC"] })).resolves.toEqual({
      BTC: 62000
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("only requests stale or missing prices when cache has partial coverage", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-30T10:00:00.000Z"));
    saveLivePricesToCache({
      BTC: 62000,
      ETH: 3200
    });
    globalLivePricesCacheUpdatedAt.ETH = Date.now() - 61_000;

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ETH: 3300 })
    }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAndCacheLivePrices({ cryptos: ["BTC", "ETH"] })).resolves.toEqual({
      BTC: 62000,
      ETH: 3300
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/api/prices?cryptos=ETH");
    vi.useRealTimers();
  });

  it("deduplicates concurrent identical requests", async () => {
    let resolveJson: (prices: Record<string, number | null>) => void = () => {};
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: () => new Promise<Record<string, number | null>>((resolve) => {
        resolveJson = resolve;
      })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const firstRequest = fetchAndCacheLivePrices({ isins: ["IE00B4L5Y983"] });
    const secondRequest = fetchAndCacheLivePrices({ isins: ["IE00B4L5Y983"] });

    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledOnce();

    resolveJson({ IE00B4L5Y983: 123 });
    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
      { IE00B4L5Y983: 123 },
      { IE00B4L5Y983: 123 }
    ]);
  });

  it("deduplicates overlapping requests while a broader refresh is in flight", async () => {
    let resolveJson: (prices: Record<string, number | null>) => void = () => {};
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: () => new Promise<Record<string, number | null>>((resolve) => {
        resolveJson = resolve;
      })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const dashboardRequest = fetchAndCacheLivePrices({
      cryptos: ["BTC", "ETH"],
      isins: ["IE00B4L5Y983"]
    });
    const cryptoRequest = fetchAndCacheLivePrices({ cryptos: ["BTC"] });
    const investmentRequest = fetchAndCacheLivePrices({ isins: ["IE00B4L5Y983"] });

    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/api/prices?isins=IE00B4L5Y983&cryptos=BTC%2CETH");

    resolveJson({
      BTC: 62000,
      ETH: 3300,
      IE00B4L5Y983: 123
    });

    await expect(Promise.all([dashboardRequest, cryptoRequest, investmentRequest])).resolves.toEqual([
      {
        BTC: 62000,
        ETH: 3300,
        IE00B4L5Y983: 123
      },
      {
        BTC: 62000,
        ETH: 3300,
        IE00B4L5Y983: 123
      },
      {
        BTC: 62000,
        ETH: 3300,
        IE00B4L5Y983: 123
      }
    ]);
  });
});
