import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authAccountFindFirst: vi.fn(),
  userFindMany: vi.fn(),
  investmentFindMany: vi.fn(),
  cryptoFindMany: vi.fn(),
  binanceBalanceFindMany: vi.fn(),
  transaction: vi.fn(),
  tx: {
    checkingTransaction: { deleteMany: vi.fn() },
    investmentTransaction: { deleteMany: vi.fn() },
    cryptoTransaction: { deleteMany: vi.fn() },
    binanceBalance: { deleteMany: vi.fn() },
    user: { deleteMany: vi.fn(), count: vi.fn() },
    authSession: { deleteMany: vi.fn() },
    authAccount: { deleteMany: vi.fn() },
    authUser: { deleteMany: vi.fn() },
    assetHistory: { deleteMany: vi.fn() },
    asset: { deleteMany: vi.fn() },
    cryptoAsset: { deleteMany: vi.fn() },
    priceCache: { deleteMany: vi.fn() }
  }
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    authAccount: { findFirst: mocks.authAccountFindFirst },
    user: { findMany: mocks.userFindMany },
    investmentTransaction: { findMany: mocks.investmentFindMany },
    cryptoTransaction: { findMany: mocks.cryptoFindMany },
    binanceBalance: { findMany: mocks.binanceBalanceFindMany },
    $transaction: mocks.transaction
  }
}));

import { accountDeletionRepository } from "@/server/repositories/account-deletion-repository";

function resetTxMocks() {
  for (const model of Object.values(mocks.tx)) {
    for (const fn of Object.values(model)) {
      fn.mockReset();
    }
  }
}

describe("account deletion repository", () => {
  beforeEach(() => {
    mocks.authAccountFindFirst.mockReset();
    mocks.userFindMany.mockReset();
    mocks.investmentFindMany.mockReset();
    mocks.cryptoFindMany.mockReset();
    mocks.binanceBalanceFindMany.mockReset();
    mocks.transaction.mockReset();
    resetTxMocks();

    mocks.transaction.mockImplementation(async (callback) => callback(mocks.tx));

    for (const model of Object.values(mocks.tx)) {
      for (const fn of Object.values(model)) {
        fn.mockResolvedValue({ count: 0 });
      }
    }
  });

  it("loads credential password hash only", async () => {
    mocks.authAccountFindFirst.mockResolvedValueOnce({ password: "hashed-password" });

    await expect(accountDeletionRepository.getCredentialPassword("owner-1")).resolves.toBe("hashed-password");
    expect(mocks.authAccountFindFirst).toHaveBeenCalledWith({
      where: {
        userId: "owner-1",
        providerId: "credential",
        password: { not: null }
      },
      select: { password: true }
    });
  });

  it("deduplicates profile asset keys before returning them", async () => {
    mocks.investmentFindMany.mockResolvedValueOnce([{ isin: "ETF1" }, { isin: "ETF1" }, { isin: null }]);
    mocks.cryptoFindMany.mockResolvedValueOnce([{ tokenSymbol: "BTC" }, { tokenSymbol: "BTC" }, { tokenSymbol: null }]);
    mocks.binanceBalanceFindMany.mockResolvedValueOnce([{ tokenSymbol: "BNB" }, { tokenSymbol: "BNB" }]);

    await expect(accountDeletionRepository.listInvestmentIsins(["profile-1"])).resolves.toEqual(["ETF1"]);
    await expect(accountDeletionRepository.listCryptoTokens(["profile-1"])).resolves.toEqual(["BTC"]);
    await expect(accountDeletionRepository.listBinanceTokens(["profile-1"])).resolves.toEqual(["BNB"]);
  });

  it("runs scoped account cleanup in a transaction", async () => {
    mocks.tx.user.count.mockResolvedValueOnce(1);
    mocks.tx.assetHistory.deleteMany.mockResolvedValueOnce({ count: 2 });
    mocks.tx.asset.deleteMany.mockResolvedValueOnce({ count: 1 });
    mocks.tx.cryptoAsset.deleteMany.mockResolvedValueOnce({ count: 1 });
    mocks.tx.priceCache.deleteMany.mockResolvedValueOnce({ count: 3 });

    const result = await accountDeletionRepository.deleteAccountData("owner-1", {
      profileIds: ["profile-1"],
      isinsToDelete: ["ETF1"],
      tokensToDelete: ["BTC"],
      scopedPriceCacheKeys: ["ETF1", "BTC", "binance_sync_profile-1"]
    });

    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.tx.user.deleteMany).toHaveBeenCalledWith({ where: { ownerId: "owner-1" } });
    expect(mocks.tx.authUser.deleteMany).toHaveBeenCalledWith({ where: { id: "owner-1" } });
    expect(mocks.tx.assetHistory.deleteMany).toHaveBeenCalledWith({
      where: { isin: { in: ["ETF1", "BTC"] } }
    });
    expect(mocks.tx.priceCache.deleteMany).toHaveBeenCalledWith({
      where: { key: { in: ["ETF1", "BTC", "binance_sync_profile-1"] } }
    });
    expect(result).toEqual({
      cleanupMode: "scoped",
      deletedHistory: 2,
      deletedAssets: 1,
      deletedCryptoAssets: 1,
      deletedPriceCache: 3
    });
  });
});
