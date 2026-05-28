import { describe, expect, it, vi } from "vitest";

import {
  createPriceRefreshService,
  InMemoryPriceRateLimiter
} from "@/server/services/price-refresh";

const silentLogger = {
  info: vi.fn(),
  error: vi.fn()
};

describe("price refresh service", () => {
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
    expect(repository.listLatestHistoricalPrices).toHaveBeenCalledWith(["IE00B4L5Y983", "ETH"]);
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
