import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPriceRefreshService,
  InMemoryPriceRateLimiter
} from "@/server/services/price-refresh";

const silentLogger = {
  info: vi.fn(),
  error: vi.fn()
};

describe("price refresh service", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("applies a deterministic in-memory rate limit", () => {
    let now = 0;
    const limiter = new InMemoryPriceRateLimiter({
      windowMs: 1000,
      maxRequests: 2,
      now: () => now
    });

    expect(limiter.getRetryAfterMs("user-1")).toBeNull();
    expect(limiter.getRetryAfterMs("user-1")).toBeNull();
    expect(limiter.getRetryAfterMs("user-1")).toBe(1000);

    now = 1001;
    expect(limiter.getRetryAfterMs("user-1")).toBeNull();
  });

  it("allows the default login and dashboard warmup burst", () => {
    let now = 0;
    const limiter = new InMemoryPriceRateLimiter({ now: () => now });

    for (let index = 0; index < 30; index += 1) {
      expect(limiter.getRetryAfterMs("user-1")).toBeNull();
      now += 250;
    }
  });

  it("combines live prices with historical fallbacks", async () => {
    const repository = {
      listLatestHistoricalPrices: vi.fn(async () => new Map([
        ["IE00B4L5Y983", 12345],
        ["ETH", 250000]
      ]))
    };
    const service = createPriceRefreshService({
      repository,
      rateLimiter: { getRetryAfterMs: () => null },
      isinFetcher: vi.fn(async () => null),
      cryptoFetcher: vi.fn(async (symbol) => symbol === "BTC" ? 6200000 : null),
      logger: silentLogger
    });

    await expect(service.fetchPrices({
      isins: ["IE00B4L5Y983"],
      cryptos: ["BTC", "ETH"]
    })).resolves.toEqual({
      IE00B4L5Y983: 12345,
      BTC: 6200000,
      ETH: 250000
    });
    expect(repository.listLatestHistoricalPrices).toHaveBeenCalledWith(["IE00B4L5Y983", "BTC", "ETH"]);
  });

  it("uses crypto live fetchers for normalized Trade Republic crypto identifiers", async () => {
    const cryptoFetcher = vi.fn(async (symbol: string) => symbol === "BTC" ? 6200000 : null);
    const service = createPriceRefreshService({
      repository: { listLatestHistoricalPrices: vi.fn(async () => new Map()) },
      rateLimiter: { getRetryAfterMs: () => null },
      isinFetcher: vi.fn(async () => null),
      cryptoFetcher,
      logger: silentLogger
    });

    await expect(service.fetchPrices({
      isins: [],
      cryptos: ["BTC"]
    })).resolves.toEqual({
      BTC: 6200000
    });
    expect(cryptoFetcher).toHaveBeenCalledWith("BTC");
  });

  it("uses the Binance ticker batch with USDT-first EUR conversion", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "https://api.binance.com/api/v3/ticker/price") {
        return {
          ok: true,
          json: async () => [
            { symbol: "BTCEUR", price: "61000" },
            { symbol: "BTCUSDT", price: "66000" },
            { symbol: "EURUSDT", price: "1.10" }
          ]
        };
      }
      return { ok: false, json: async () => [] };
    });
    vi.stubGlobal("fetch", fetchMock);

    const service = createPriceRefreshService({
      repository: { listLatestHistoricalPrices: vi.fn(async () => new Map()) },
      rateLimiter: { getRetryAfterMs: () => null },
      isinFetcher: vi.fn(async () => null),
      logger: silentLogger
    });

    const prices = await service.fetchPrices({
      isins: [],
      cryptos: ["BTC"]
    });
    expect(prices.BTC).toBeCloseTo(60000);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.binance.com/api/v3/ticker/price",
      expect.any(Object)
    );
  });

  it("falls back to EUR and USDC pairs from the Binance ticker batch", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "https://api.binance.com/api/v3/ticker/price") {
        return {
          ok: true,
          json: async () => [
            { symbol: "ADAEUR", price: "0.50" },
            { symbol: "SOLUSDC", price: "180" },
            { symbol: "USDCUSDT", price: "1.00" },
            { symbol: "EURUSDT", price: "1.20" }
          ]
        };
      }
      return { ok: false, json: async () => [] };
    });
    vi.stubGlobal("fetch", fetchMock);

    const service = createPriceRefreshService({
      repository: { listLatestHistoricalPrices: vi.fn(async () => new Map()) },
      rateLimiter: { getRetryAfterMs: () => null },
      isinFetcher: vi.fn(async () => null),
      logger: silentLogger
    });

    const prices = await service.fetchPrices({
      isins: [],
      cryptos: ["ADA", "SOL"]
    });
    expect(prices.ADA).toBeCloseTo(0.5);
    expect(prices.SOL).toBeCloseTo(150);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("deduplicates Binance ticker batch requests inside the five second cache window", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "https://api.binance.com/api/v3/ticker/price") {
        return {
          ok: true,
          json: async () => [
            { symbol: "BTCUSDT", price: "66000" },
            { symbol: "ETHUSDT", price: "3300" },
            { symbol: "EURUSDT", price: "1.10" }
          ]
        };
      }
      return { ok: false, json: async () => [] };
    });
    vi.stubGlobal("fetch", fetchMock);

    const service = createPriceRefreshService({
      repository: { listLatestHistoricalPrices: vi.fn(async () => new Map()) },
      rateLimiter: { getRetryAfterMs: () => null },
      isinFetcher: vi.fn(async () => null),
      logger: silentLogger
    });

    await expect(service.fetchPrices({ isins: [], cryptos: ["BTC"] })).resolves.toEqual({
      BTC: 60000
    });
    await expect(service.fetchPrices({ isins: [], cryptos: ["ETH"] })).resolves.toEqual({
      ETH: 3000
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("uses historical fallback quickly when a live price is slow", async () => {
    vi.useFakeTimers();
    try {
      const repository = {
        listLatestHistoricalPrices: vi.fn(async () => new Map([
          ["IE00B4L5Y983", 12345]
        ]))
      };
      const service = createPriceRefreshService({
        repository,
        rateLimiter: { getRetryAfterMs: () => null },
        isinFetcher: vi.fn(() => new Promise<number | null>(() => {})),
        cryptoFetcher: vi.fn(async () => null),
        historicalFallbackGraceMs: 25,
        logger: silentLogger
      });

      const request = service.fetchPrices({ isins: ["IE00B4L5Y983"], cryptos: [] });
      await vi.advanceTimersByTimeAsync(25);

      await expect(request).resolves.toEqual({
        IE00B4L5Y983: 12345
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("can return only actual live prices without historical fallback", async () => {
    const repository = {
      listLatestHistoricalPrices: vi.fn(async () => new Map([
        ["IE00B4L5Y983", 12345]
      ]))
    };
    const service = createPriceRefreshService({
      repository,
      rateLimiter: { getRetryAfterMs: () => null },
      isinFetcher: vi.fn(async () => null),
      cryptoFetcher: vi.fn(async () => null),
      logger: silentLogger
    });

    await expect(service.fetchPrices(
      { isins: ["IE00B4L5Y983"], cryptos: [] },
      { includeHistoricalFallback: false }
    )).resolves.toEqual({
      IE00B4L5Y983: null
    });
    expect(repository.listLatestHistoricalPrices).not.toHaveBeenCalled();
  });

  it("does not serially wait on every historical key beyond the live concurrency window", async () => {
    vi.useFakeTimers();
    try {
      const keys = ["IE00B4L5Y983", "IE00BKM4GZ66", "IE00B3XXRP09"];
      const repository = {
        listLatestHistoricalPrices: vi.fn(async () => new Map(keys.map((key, index) => [key, 100 + index])))
      };
      const isinFetcher = vi.fn(() => new Promise<number | null>(() => {}));
      const service = createPriceRefreshService({
        repository,
        rateLimiter: { getRetryAfterMs: () => null },
        isinFetcher,
        cryptoFetcher: vi.fn(async () => null),
        isinConcurrency: 1,
        historicalFallbackGraceMs: 25,
        logger: silentLogger
      });

      const request = service.fetchPrices({ isins: keys, cryptos: [] });
      await vi.advanceTimersByTimeAsync(25);

      await expect(request).resolves.toEqual({
        IE00B4L5Y983: 100,
        IE00BKM4GZ66: 101,
        IE00B3XXRP09: 102
      });
      expect(isinFetcher).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("deduplicates concurrent live fetches for the same key", async () => {
    let resolvePrice: (price: number | null) => void = () => {};
    const pendingPrice = new Promise<number | null>((resolve) => {
      resolvePrice = resolve;
    });
    const isinFetcher = vi.fn(() => pendingPrice);
    const service = createPriceRefreshService({
      repository: { listLatestHistoricalPrices: vi.fn(async () => new Map()) },
      rateLimiter: { getRetryAfterMs: () => null },
      isinFetcher,
      cryptoFetcher: vi.fn(async () => null),
      logger: silentLogger
    });

    const firstRequest = service.fetchPrices({ isins: ["IE00B4L5Y983"], cryptos: [] });
    const secondRequest = service.fetchPrices({ isins: ["IE00B4L5Y983"], cryptos: [] });

    await Promise.resolve();
    expect(isinFetcher).toHaveBeenCalledOnce();

    resolvePrice(12345);
    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
      { IE00B4L5Y983: 12345 },
      { IE00B4L5Y983: 12345 }
    ]);
  });
});
