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

  it("falls back to USDT crypto pairs and converts them to EUR", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("BTCEUR")) {
        return { ok: false };
      }
      if (url.includes("BTCUSDT")) {
        return { ok: true, json: async () => ({ price: "66000" }) };
      }
      if (url.includes("EURUSDT")) {
        return { ok: true, json: async () => ({ price: "1.10" }) };
      }
      return { ok: false };
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
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.binance.com/api/v3/ticker/price?symbol=BTCEUR",
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT",
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.binance.com/api/v3/ticker/price?symbol=EURUSDT",
      expect.any(Object)
    );
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
