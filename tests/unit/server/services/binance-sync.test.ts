import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchBalances: vi.fn(),
  priceBalances: vi.fn(),
  decryptBinanceCredentials: vi.fn(),
  hasBinanceCredentials: vi.fn((user: { binanceApiKeyEncrypted?: string | null; binanceApiSecretEncrypted?: string | null } | null) =>
    !!(user?.binanceApiKeyEncrypted && user?.binanceApiSecretEncrypted)
  )
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {}
}));

vi.mock("@/integrations/binance/binance-service", () => ({
  fetchBalances: mocks.fetchBalances,
  priceBalances: mocks.priceBalances
}));

vi.mock("@/server/security/secrets", () => ({
  decryptBinanceCredentials: mocks.decryptBinanceCredentials,
  hasBinanceCredentials: mocks.hasBinanceCredentials
}));

import {
  BinanceMissingCredentialsError,
  getBinanceBalancesStatus,
  persistBalances,
  syncBinanceProfile,
  type BinanceSyncStore,
  type PersistedBinanceBalance
} from "@/server/services/binance-sync";

function makeStoreMock(persistedBalances: PersistedBinanceBalance[] = []) {
  const upsert = vi.fn(async () => undefined);
  const deleteMany = vi.fn(async () => ({ count: 0 }));
  const findMany = vi.fn<(...args: unknown[]) => Promise<unknown[]>>(async () => persistedBalances);
  const findUnique = vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => null);
  const priceCacheFindUnique = vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => null);
  const priceCacheUpsert = vi.fn(async () => undefined);

  const store = {
    user: { findUnique },
    binanceBalance: { upsert, deleteMany, findMany },
    priceCache: {
      findUnique: priceCacheFindUnique,
      upsert: priceCacheUpsert
    }
  } as unknown as BinanceSyncStore;

  return {
    store,
    upsert,
    deleteMany,
    findMany,
    findUnique,
    priceCacheFindUnique,
    priceCacheUpsert
  };
}

describe("binance sync service", () => {
  beforeEach(() => {
    mocks.fetchBalances.mockReset();
    mocks.priceBalances.mockReset();
    mocks.decryptBinanceCredentials.mockReset();
    mocks.hasBinanceCredentials.mockClear();
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
      updatedAt: syncedAt
    };
    const { store, upsert, deleteMany, findMany, priceCacheUpsert } = makeStoreMock([
      persistedBalance
    ]);

    const result = await persistBalances(
      "user-1",
      [
        {
          tokenSymbol: "BTC",
          tokenName: "Bitcoin",
          freeAmount: 1,
          lockedAmount: 0.5,
          eurValue: 45_000
        }
      ],
      { store, now: () => syncedAt }
    );

    expect(upsert).toHaveBeenCalledWith({
      where: { userId_tokenSymbol: { userId: "user-1", tokenSymbol: "BTC" } },
      update: {
        tokenName: "Bitcoin",
        freeAmount: 1,
        lockedAmount: 0.5,
        eurValue: 45_000
      },
      create: {
        userId: "user-1",
        tokenSymbol: "BTC",
        tokenName: "Bitcoin",
        freeAmount: 1,
        lockedAmount: 0.5,
        eurValue: 45_000
      }
    });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1", tokenSymbol: { notIn: ["BTC"] } }
    });
    expect(priceCacheUpsert).toHaveBeenCalledWith({
      where: { key: "binance_sync_user-1" },
      update: { timestamp: syncedAt },
      create: { key: "binance_sync_user-1", timestamp: syncedAt }
    });
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { eurValue: "desc" }
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
      create: { key: "binance_sync_user-1", timestamp: syncedAt }
    });
  });

  it("loads credentials, prices balances and persists a profile sync", async () => {
    const syncedAt = new Date("2026-01-04T00:00:00.000Z");
    const persistedBalance: PersistedBinanceBalance = {
      id: "balance-1",
      userId: "user-1",
      tokenSymbol: "ETH",
      tokenName: "Ethereum",
      freeAmount: 2,
      lockedAmount: 0,
      eurValue: 4_000,
      updatedAt: syncedAt
    };
    const { store, findUnique } = makeStoreMock([persistedBalance]);
    const credentials = { apiKey: "api-key", secret: "secret" };
    const rawBalances = new Map([["ETH", { free: 2, locked: 0 }]]);
    const pricedBalances = [{
      tokenSymbol: "ETH",
      tokenName: "Ethereum",
      freeAmount: 2,
      lockedAmount: 0,
      eurValue: 4_000
    }];

    findUnique.mockResolvedValueOnce({ id: "user-1" });
    mocks.decryptBinanceCredentials.mockReturnValueOnce(credentials);
    mocks.fetchBalances.mockResolvedValueOnce(rawBalances);
    mocks.priceBalances.mockResolvedValueOnce(pricedBalances);

    const result = await syncBinanceProfile("user-1", { store, now: () => syncedAt });

    expect(findUnique).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(mocks.decryptBinanceCredentials).toHaveBeenCalledWith({ id: "user-1" });
    expect(mocks.fetchBalances).toHaveBeenCalledWith(credentials, {
      store,
      now: expect.any(Function)
    });
    expect(mocks.priceBalances).toHaveBeenCalledWith(rawBalances, {
      store,
      now: expect.any(Function)
    });
    expect(result).toEqual({ balances: [persistedBalance], syncedAt });
  });

  it("rejects profile sync when credentials are missing", async () => {
    const { store, findUnique } = makeStoreMock();
    findUnique.mockResolvedValueOnce({ id: "user-1" });
    mocks.decryptBinanceCredentials.mockReturnValueOnce(null);

    await expect(syncBinanceProfile("user-1", { store }))
      .rejects.toBeInstanceOf(BinanceMissingCredentialsError);
    expect(mocks.fetchBalances).not.toHaveBeenCalled();
  });

  it("returns cached balances status and stale state", async () => {
    const syncedAt = new Date("2026-01-01T00:00:00.000Z");
    const { store, findMany, findUnique, priceCacheFindUnique } = makeStoreMock();
    findMany.mockResolvedValueOnce([{ tokenSymbol: "BTC", eurValue: 30_000 }]);
    priceCacheFindUnique.mockResolvedValueOnce({ timestamp: syncedAt });
    findUnique.mockResolvedValueOnce({
      binanceApiKeyEncrypted: "key",
      binanceApiSecretEncrypted: "secret"
    });

    const result = await getBinanceBalancesStatus("user-1", {
      store,
      now: () => new Date("2026-01-01T00:09:59.000Z")
    });

    expect(result).toEqual({
      balances: [{ tokenSymbol: "BTC", eurValue: 30_000 }],
      syncedAt,
      isStale: false,
      hasApiKey: true
    });
    expect(findMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      orderBy: { eurValue: "desc" }
    });
    expect(priceCacheFindUnique).toHaveBeenCalledWith({
      where: { key: "binance_sync_user-1" }
    });
  });
});
