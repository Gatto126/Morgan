import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  balanceFindMany: vi.fn(),
  balanceUpsert: vi.fn(),
  balanceDeleteMany: vi.fn(),
  priceCacheFindUnique: vi.fn(),
  priceCacheUpsert: vi.fn()
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    binanceBalance: {
      findMany: mocks.balanceFindMany,
      upsert: mocks.balanceUpsert,
      deleteMany: mocks.balanceDeleteMany
    },
    priceCache: {
      findUnique: mocks.priceCacheFindUnique,
      upsert: mocks.priceCacheUpsert
    }
  }
}));

import { binanceRepository } from "@/server/repositories/binance-repository";

describe("binance repository", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) {
      mock.mockReset();
    }
  });

  it("loads credential fields only", async () => {
    await binanceRepository.getCredentialRecord("profile-1");

    expect(mocks.userFindUnique).toHaveBeenCalledWith({
      where: { id: "profile-1" },
      select: {
        binanceApiKeyEncrypted: true,
        binanceApiSecretEncrypted: true,
        binanceApiKeyPreview: true
      }
    });
  });

  it("upserts balances and deletes inactive symbols", async () => {
    await binanceRepository.upsertBalance("profile-1", {
      tokenSymbol: "BTC",
      tokenName: "Bitcoin",
      freeAmount: 1,
      lockedAmount: 0.5,
      eurValue: 45_000
    });
    await binanceRepository.deleteInactiveBalances("profile-1", ["BTC"]);

    expect(mocks.balanceUpsert).toHaveBeenCalledWith({
      where: { userId_tokenSymbol: { userId: "profile-1", tokenSymbol: "BTC" } },
      update: {
        tokenName: "Bitcoin",
        freeAmount: 1,
        lockedAmount: 0.5,
        eurValue: 45_000
      },
      create: {
        userId: "profile-1",
        tokenSymbol: "BTC",
        tokenName: "Bitcoin",
        freeAmount: 1,
        lockedAmount: 0.5,
        eurValue: 45_000
      }
    });
    expect(mocks.balanceDeleteMany).toHaveBeenCalledWith({
      where: { userId: "profile-1", tokenSymbol: { notIn: ["BTC"] } }
    });
  });

  it("deletes all balances for a profile when no symbols remain active", async () => {
    await binanceRepository.deleteInactiveBalances("profile-1", []);

    expect(mocks.balanceDeleteMany).toHaveBeenCalledWith({
      where: { userId: "profile-1" }
    });
  });

  it("loads balance status records together", async () => {
    const syncedAt = new Date("2026-01-01T00:00:00.000Z");
    mocks.balanceFindMany.mockResolvedValueOnce([{ tokenSymbol: "BTC" }]);
    mocks.priceCacheFindUnique.mockResolvedValueOnce({ timestamp: syncedAt });
    mocks.userFindUnique.mockResolvedValueOnce({ binanceApiKeyEncrypted: "key" });

    const result = await binanceRepository.getBalanceStatusRecords("profile-1");

    expect(result).toEqual({
      balances: [{ tokenSymbol: "BTC" }],
      syncTimestamp: syncedAt,
      credentialRecord: { binanceApiKeyEncrypted: "key" }
    });
  });
});
