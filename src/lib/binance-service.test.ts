import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import {
  fetchBalances,
  getEurPrice,
  makeSignedQuery,
  mergeBalances,
  persistBalances,
  priceBalances,
  type BinanceFetch,
  type BinanceServiceStore,
  type PersistedBinanceBalance,
} from "@/lib/binance-service";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function makeStoreMock(persistedBalances: PersistedBinanceBalance[] = []) {
  const upsert = vi.fn(async () => undefined);
  const deleteMany = vi.fn(async () => ({ count: 0 }));
  const findMany = vi.fn(async () => persistedBalances);
  const priceCacheUpsert = vi.fn(async () => undefined);

  const store = {
    binanceBalance: { upsert, deleteMany, findMany },
    priceCache: { upsert: priceCacheUpsert },
  } as unknown as BinanceServiceStore;

  return { store, upsert, deleteMany, findMany, priceCacheUpsert };
}

describe("binance service", () => {
  it("creates signed Binance query strings", () => {
    expect(makeSignedQuery("secret", { timestamp: 123, current: 1 })).toMatch(
      /^timestamp=123&current=1&signature=[a-f0-9]{64}$/
    );
  });

  it("merges balances by token and drops zero rows", () => {
    const result = mergeBalances([
      new Map([
        ["btc", { free: 1, locked: 0.5 }],
        ["ZERO", { free: 0, locked: 0 }],
      ]),
      new Map([
        ["BTC", { free: 0.25, locked: 0 }],
        ["ETH", { free: 2, locked: 1 }],
      ]),
    ]);

    expect(result).toEqual(
      new Map([
        ["BTC", { free: 1.25, locked: 0.5 }],
        ["ETH", { free: 2, locked: 1 }],
      ])
    );
  });

  it("fetches and merges spot, funding, flexible earn and locked earn balances", async () => {
    const fetcher = (async (input) => {
      const url = String(input);

      if (url.includes("/sapi/v3/asset/getUserAsset")) {
        return jsonResponse([
          { asset: "BTC", free: "1", locked: "0.5", freeze: "0.1", withdrawing: "0.2" },
          { asset: "ZERO", free: "0", locked: "0", freeze: "0", withdrawing: "0" },
        ]);
      }

      if (url.includes("/sapi/v1/asset/get-funding-asset")) {
        return jsonResponse([
          { asset: "BTC", free: "0.25", locked: "0", freeze: "0.05" },
          { asset: "ETH", free: "2", locked: "0.5" },
        ]);
      }

      if (url.includes("/sapi/v1/simple-earn/flexible/position")) {
        return jsonResponse({
          rows: [
            { asset: "ETH", totalAmount: "1.5" },
            { asset: "ADA", totalAmount: "10" },
          ],
        });
      }

      if (url.includes("/sapi/v1/simple-earn/locked/position")) {
        return jsonResponse({
          rows: [
            { asset: "ADA", amount: "5" },
            { asset: "SOL", amount: "3" },
          ],
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    }) as BinanceFetch;

    const balances = await fetchBalances(
      { apiKey: "api-key", secret: "secret" },
      { fetcher, now: () => new Date("2026-01-01T00:00:00.000Z") }
    );

    expect(balances).toEqual(
      new Map([
        ["BTC", { free: 1.6, locked: 0.5 }],
        ["ETH", { free: 3.5, locked: 0.5 }],
        ["ADA", { free: 10, locked: 5 }],
        ["SOL", { free: 0, locked: 3 }],
      ])
    );
  });

  it("prices balances in EUR using stablecoins, direct pairs and USDT fallback pairs", async () => {
    const fetcher = (async (input) => {
      const url = String(input);

      if (url.endsWith("BTCEUR")) return jsonResponse({ price: "30000" });
      if (url.endsWith("EURUSDT")) return jsonResponse({ price: "1.2" });
      if (url.endsWith("ADAUSDT")) return jsonResponse({ price: "0.6" });
      if (url.endsWith("ADAEUR") || url.endsWith("UNKNOWNEUR")) return jsonResponse({}, 404);
      if (url.endsWith("UNKNOWNUSDT")) return jsonResponse({}, 404);

      throw new Error(`Unexpected URL: ${url}`);
    }) as BinanceFetch;

    const priced = await priceBalances(
      new Map([
        ["EURI", { free: 2, locked: 0 }],
        ["USDT", { free: 12, locked: 0 }],
        ["BTC", { free: 0.1, locked: 0 }],
        ["ADA", { free: 100, locked: 50 }],
        ["UNKNOWN", { free: 1, locked: 0 }],
      ]),
      { fetcher }
    );

    const bySymbol = Object.fromEntries(priced.map((balance) => [balance.tokenSymbol, balance]));

    expect(bySymbol.EURI.eurValue).toBe(2);
    expect(bySymbol.USDT.eurValue).toBe(10);
    expect(bySymbol.BTC.eurValue).toBe(3_000);
    expect(bySymbol.ADA.eurValue).toBe(75);
    expect(bySymbol.UNKNOWN.eurValue).toBe(0);
  });

  it("falls back to USDT pricing when the direct EUR ticker request fails", async () => {
    const fetcher = (async (input) => {
      const url = String(input);

      if (url.endsWith("SOLEUR")) throw new Error("direct pair unavailable");
      if (url.endsWith("SOLUSDT")) return jsonResponse({ price: "120" });
      if (url.endsWith("EURUSDT")) return jsonResponse({ price: "1.2" });

      throw new Error(`Unexpected URL: ${url}`);
    }) as BinanceFetch;

    await expect(getEurPrice("SOL", { fetcher })).resolves.toBe(100);
  });

  it("persists balances, removes inactive tokens and records the sync timestamp", async () => {
    const syncedAt = new Date("2026-01-02T03:04:05.000Z");
    const persistedBalance: PersistedBinanceBalance = {
      id: "balance-1",
      userId: "user-1",
      tokenSymbol: "BTC",
      tokenName: "Bitcoin",
      freeAmount: 1,
      lockedAmount: 0.5,
      eurValue: 45_000,
      updatedAt: syncedAt,
    };
    const { store, upsert, deleteMany, findMany, priceCacheUpsert } = makeStoreMock([
      persistedBalance,
    ]);

    const result = await persistBalances(
      "user-1",
      [
        {
          tokenSymbol: "BTC",
          tokenName: "Bitcoin",
          freeAmount: 1,
          lockedAmount: 0.5,
          eurValue: 45_000,
        },
      ],
      { store, now: () => syncedAt }
    );

    expect(upsert).toHaveBeenCalledWith({
      where: { userId_tokenSymbol: { userId: "user-1", tokenSymbol: "BTC" } },
      update: {
        tokenName: "Bitcoin",
        freeAmount: 1,
        lockedAmount: 0.5,
        eurValue: 45_000,
      },
      create: {
        userId: "user-1",
        tokenSymbol: "BTC",
        tokenName: "Bitcoin",
        freeAmount: 1,
        lockedAmount: 0.5,
        eurValue: 45_000,
      },
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", tokenSymbol: { notIn: ["BTC"] } },
    });
    expect(priceCacheUpsert).toHaveBeenCalledWith({
      where: { key: "binance_sync_user-1" },
      update: { timestamp: syncedAt },
      create: { key: "binance_sync_user-1", timestamp: syncedAt },
    });
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { eurValue: "desc" },
    });
    expect(result).toEqual({ balances: [persistedBalance], syncedAt });
  });

  it("clears all user Binance balances and still records sync time for empty wallets", async () => {
    const syncedAt = new Date("2026-01-03T00:00:00.000Z");
    const { store, upsert, deleteMany, priceCacheUpsert } = makeStoreMock();

    await persistBalances("user-1", [], { store, now: () => syncedAt });

    expect(upsert).not.toHaveBeenCalled();
    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(priceCacheUpsert).toHaveBeenCalledWith({
      where: { key: "binance_sync_user-1" },
      update: { timestamp: syncedAt },
      create: { key: "binance_sync_user-1", timestamp: syncedAt },
    });
  });
});
