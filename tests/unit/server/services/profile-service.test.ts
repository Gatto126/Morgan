import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindMany: vi.fn(),
  userFindFirst: vi.fn(),
  userCreate: vi.fn(),
  userDelete: vi.fn(),
  userUpdate: vi.fn(),
  investmentFindMany: vi.fn(),
  cryptoFindMany: vi.fn(),
  binanceBalanceFindMany: vi.fn(),
  binanceBalanceDeleteMany: vi.fn(),
  assetHistoryDeleteMany: vi.fn(),
  assetDeleteMany: vi.fn(),
  cryptoAssetDeleteMany: vi.fn(),
  priceCacheDeleteMany: vi.fn(),
  encryptSecret: vi.fn((value: string | null | undefined) => value ? `encrypted:${value.trim()}` : null),
  makeBinanceApiKeyPreview: vi.fn((value: string | null | undefined) => value ? `${value.trim().slice(0, 8)}...` : null)
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    user: {
      findMany: mocks.userFindMany,
      findFirst: mocks.userFindFirst,
      create: mocks.userCreate,
      delete: mocks.userDelete,
      update: mocks.userUpdate
    },
    investmentTransaction: {
      findMany: mocks.investmentFindMany
    },
    cryptoTransaction: {
      findMany: mocks.cryptoFindMany
    },
    binanceBalance: {
      findMany: mocks.binanceBalanceFindMany,
      deleteMany: mocks.binanceBalanceDeleteMany
    },
    assetHistory: {
      deleteMany: mocks.assetHistoryDeleteMany
    },
    asset: {
      deleteMany: mocks.assetDeleteMany
    },
    cryptoAsset: {
      deleteMany: mocks.cryptoAssetDeleteMany
    },
    priceCache: {
      deleteMany: mocks.priceCacheDeleteMany
    }
  }
}));

vi.mock("@/server/security/secrets", () => ({
  encryptSecret: mocks.encryptSecret,
  makeBinanceApiKeyPreview: mocks.makeBinanceApiKeyPreview,
  hasBinanceCredentials: (user: { binanceApiKeyEncrypted?: string | null; binanceApiSecretEncrypted?: string | null }) =>
    !!(user.binanceApiKeyEncrypted && user.binanceApiSecretEncrypted),
  getBinanceApiKeyPreview: (user: { binanceApiKeyPreview?: string | null }) => user.binanceApiKeyPreview ?? null
}));

import {
  createProfile,
  deleteProfile,
  getProfile,
  listProfiles,
  ProfileBadRequestError,
  ProfileConflictError,
  ProfileNotFoundError,
  updateProfileBinanceSettings
} from "@/server/services/profile-service";

const profile = {
  id: "profile-1",
  ownerId: "owner-1",
  name: "Main",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  binanceApiKeyEncrypted: null,
  binanceApiSecretEncrypted: null,
  binanceApiKeyPreview: null
};

describe("profile service", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockClear();
    }

    mocks.userFindMany.mockResolvedValue([]);
    mocks.userFindFirst.mockResolvedValue(null);
    mocks.userCreate.mockResolvedValue(profile);
    mocks.userDelete.mockResolvedValue(profile);
    mocks.userUpdate.mockResolvedValue(profile);
    mocks.investmentFindMany.mockResolvedValue([]);
    mocks.cryptoFindMany.mockResolvedValue([]);
    mocks.binanceBalanceFindMany.mockResolvedValue([]);
    mocks.binanceBalanceDeleteMany.mockResolvedValue({ count: 0 });
    mocks.assetHistoryDeleteMany.mockResolvedValue({ count: 0 });
    mocks.assetDeleteMany.mockResolvedValue({ count: 0 });
    mocks.cryptoAssetDeleteMany.mockResolvedValue({ count: 0 });
    mocks.priceCacheDeleteMany.mockResolvedValue({ count: 0 });
  });

  it("lists owned profiles with transaction counts", async () => {
    mocks.userFindMany.mockResolvedValueOnce([
      {
        ...profile,
        _count: {
          checkingTransactions: 2,
          investmentTransactions: 3,
          cryptoTransactions: 5
        }
      }
    ]);

    const users = await listProfiles("owner-1");

    expect(users).toEqual([
      expect.objectContaining({
        id: "profile-1",
        name: "Main",
        transactionCount: 10,
        checkingCount: 2,
        investmentCount: 3,
        cryptoCount: 5
      })
    ]);
    expect(mocks.userFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { ownerId: "owner-1" },
      orderBy: { createdAt: "asc" }
    }));
  });

  it("creates a profile and returns the refreshed list", async () => {
    mocks.userFindMany.mockResolvedValueOnce([
      {
        ...profile,
        _count: {
          checkingTransactions: 0,
          investmentTransactions: 0,
          cryptoTransactions: 0
        }
      }
    ]);

    const result = await createProfile("owner-1", { name: " Main " });

    expect(mocks.userFindFirst).toHaveBeenCalledWith({
      where: {
        ownerId: "owner-1",
        name: "Main"
      }
    });
    expect(mocks.userCreate).toHaveBeenCalledWith({
      data: {
        ownerId: "owner-1",
        name: "Main"
      }
    });
    expect(result.user).toMatchObject({
      id: "profile-1",
      transactionCount: 0
    });
    expect(result.users).toHaveLength(1);
  });

  it("rejects duplicate profile names", async () => {
    mocks.userFindFirst.mockResolvedValueOnce(profile);

    await expect(createProfile("owner-1", { name: "Main" })).rejects.toBeInstanceOf(ProfileConflictError);
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });

  it("returns a safe owned profile or not found", async () => {
    mocks.userFindFirst.mockResolvedValueOnce({
      ...profile,
      binanceApiKeyEncrypted: "encrypted-key",
      binanceApiSecretEncrypted: "encrypted-secret",
      binanceApiKeyPreview: "apikey12..."
    });

    await expect(getProfile("owner-1", "profile-1")).resolves.toMatchObject({
      id: "profile-1",
      hasBinanceCredentials: true,
      binanceApiKeyPreview: "apikey12..."
    });

    mocks.userFindFirst.mockResolvedValueOnce(null);
    await expect(getProfile("owner-1", "missing")).rejects.toBeInstanceOf(ProfileNotFoundError);
  });

  it("updates Binance credentials only when key and secret are provided together", async () => {
    await expect(updateProfileBinanceSettings("profile-1", { apiKey: "only-key" }))
      .rejects.toBeInstanceOf(ProfileBadRequestError);
    expect(mocks.userUpdate).not.toHaveBeenCalled();

    await updateProfileBinanceSettings("profile-1", {
      apiKey: "abcdefgh123",
      apiSecret: "secret-value"
    });

    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "profile-1" },
      data: {
        binanceApiKeyEncrypted: "encrypted:abcdefgh123",
        binanceApiSecretEncrypted: "encrypted:secret-value",
        binanceApiKeyPreview: "abcdefgh..."
      }
    });
  });

  it("clears Binance credentials and optional cached balances", async () => {
    await updateProfileBinanceSettings("profile-1", {
      apiKey: null,
      apiSecret: null,
      deleteBalances: true
    });

    expect(mocks.binanceBalanceDeleteMany).toHaveBeenCalledWith({ where: { userId: "profile-1" } });
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "profile-1" },
      data: {
        binanceApiKeyEncrypted: null,
        binanceApiSecretEncrypted: null,
        binanceApiKeyPreview: null
      }
    });
  });

  it("deletes a profile and removes only unshared asset metadata", async () => {
    mocks.investmentFindMany
      .mockResolvedValueOnce([{ isin: "ETF1" }, { isin: "ETF2" }, { isin: null }])
      .mockResolvedValueOnce([{ isin: "ETF2" }]);
    mocks.cryptoFindMany
      .mockResolvedValueOnce([{ tokenSymbol: "BTC" }, { tokenSymbol: "ETH" }])
      .mockResolvedValueOnce([{ tokenSymbol: "ETH" }]);
    mocks.binanceBalanceFindMany
      .mockResolvedValueOnce([{ tokenSymbol: "BNB" }])
      .mockResolvedValueOnce([]);

    const result = await deleteProfile("profile-1");

    expect(mocks.assetHistoryDeleteMany).toHaveBeenNthCalledWith(1, {
      where: { isin: { in: ["ETF1"] } }
    });
    expect(mocks.assetDeleteMany).toHaveBeenCalledWith({
      where: { isin: { in: ["ETF1"] } }
    });
    expect(mocks.assetHistoryDeleteMany).toHaveBeenNthCalledWith(2, {
      where: { isin: { in: ["BTC", "BNB"] } }
    });
    expect(mocks.cryptoAssetDeleteMany).toHaveBeenCalledWith({
      where: { tokenSymbol: { in: ["BTC", "BNB"] } }
    });
    expect(mocks.priceCacheDeleteMany).toHaveBeenCalledWith({
      where: { key: { in: ["ETF1", "BTC", "BNB", "binance_sync_profile-1"] } }
    });
    expect(mocks.userDelete).toHaveBeenCalledWith({ where: { id: "profile-1" } });
    expect(result).toEqual({
      isinsToDelete: ["ETF1"],
      tokensToDelete: ["BTC", "BNB"],
      priceCacheKeysToDelete: ["ETF1", "BTC", "BNB", "binance_sync_profile-1"]
    });
  });
});
