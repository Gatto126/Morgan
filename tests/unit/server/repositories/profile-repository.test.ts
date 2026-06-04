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
  binanceDailySnapshotDeleteMany: vi.fn(),
  assetHistoryDeleteMany: vi.fn(),
  assetDeleteMany: vi.fn(),
  cryptoAssetDeleteMany: vi.fn(),
  priceCacheDeleteMany: vi.fn()
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
    investmentTransaction: { findMany: mocks.investmentFindMany },
    cryptoTransaction: { findMany: mocks.cryptoFindMany },
    binanceBalance: {
      findMany: mocks.binanceBalanceFindMany,
      deleteMany: mocks.binanceBalanceDeleteMany
    },
    binanceDailySnapshot: {
      deleteMany: mocks.binanceDailySnapshotDeleteMany
    },
    assetHistory: { deleteMany: mocks.assetHistoryDeleteMany },
    asset: { deleteMany: mocks.assetDeleteMany },
    cryptoAsset: { deleteMany: mocks.cryptoAssetDeleteMany },
    priceCache: { deleteMany: mocks.priceCacheDeleteMany }
  }
}));

import { profileRepository } from "@/server/repositories/profile-repository";

describe("profile repository", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
  });

  it("lists profiles by owner with transaction counts", async () => {
    await profileRepository.listByOwner("owner-1");

    expect(mocks.userFindMany).toHaveBeenCalledWith({
      where: { ownerId: "owner-1" },
      include: {
        _count: {
          select: {
            checkingTransactions: true,
            investmentTransactions: true,
            cryptoTransactions: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });
  });

  it("deduplicates token and ISIN lists", async () => {
    mocks.investmentFindMany.mockResolvedValueOnce([
      { isin: "ETF1" },
      { isin: "ETF1" },
      { isin: null }
    ]);
    mocks.cryptoFindMany.mockResolvedValueOnce([
      { tokenSymbol: "BTC" },
      { tokenSymbol: "BTC" },
      { tokenSymbol: null }
    ]);

    await expect(profileRepository.listInvestmentIsins("profile-1")).resolves.toEqual(["ETF1"]);
    await expect(profileRepository.listCryptoTokens("profile-1")).resolves.toEqual(["BTC"]);
  });

  it("skips empty deleteMany calls for scoped cleanup helpers", async () => {
    await profileRepository.deleteAssetHistory([]);
    await profileRepository.deleteAssets([]);
    await profileRepository.deleteCryptoAssets([]);
    await profileRepository.deletePriceCache([]);

    expect(mocks.assetHistoryDeleteMany).not.toHaveBeenCalled();
    expect(mocks.assetDeleteMany).not.toHaveBeenCalled();
    expect(mocks.cryptoAssetDeleteMany).not.toHaveBeenCalled();
    expect(mocks.priceCacheDeleteMany).not.toHaveBeenCalled();
  });

  it("updates Binance credential fields on a profile", async () => {
    await profileRepository.updateBinanceCredentials("profile-1", {
      binanceApiKeyEncrypted: "key",
      binanceApiSecretEncrypted: "secret",
      binanceApiKeyPreview: "apikey12..."
    });

    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "profile-1" },
      data: {
        binanceApiKeyEncrypted: "key",
        binanceApiSecretEncrypted: "secret",
        binanceApiKeyPreview: "apikey12..."
      }
    });
  });

  it("deletes Binance daily snapshots by profile", async () => {
    await profileRepository.deleteBinanceDailySnapshots("profile-1");

    expect(mocks.binanceDailySnapshotDeleteMany).toHaveBeenCalledWith({
      where: { userId: "profile-1" }
    });
  });
});
