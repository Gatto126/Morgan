import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assetHistoryFindMany: vi.fn(),
  queryRaw: vi.fn(),
  investmentCount: vi.fn(),
  cryptoCount: vi.fn()
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    $queryRaw: mocks.queryRaw,
    assetHistory: {
      findMany: mocks.assetHistoryFindMany
    },
    investmentTransaction: {
      count: mocks.investmentCount
    },
    cryptoTransaction: {
      count: mocks.cryptoCount
    }
  }
}));

import { marketDataRepository } from "@/server/repositories/market-data-repository";

describe("market data repository", () => {
  beforeEach(() => {
    mocks.assetHistoryFindMany.mockReset();
    mocks.queryRaw.mockReset();
    mocks.investmentCount.mockReset();
    mocks.cryptoCount.mockReset();
    mocks.assetHistoryFindMany.mockResolvedValue([]);
    mocks.queryRaw.mockResolvedValue([]);
    mocks.investmentCount.mockResolvedValue(0);
    mocks.cryptoCount.mockResolvedValue(0);
  });

  it("loads portfolio EUR history for price keys", async () => {
    await marketDataRepository.listPortfolioHistory(["BTC", "IE00B4L5Y983"]);

    expect(mocks.assetHistoryFindMany).toHaveBeenCalledWith({
      where: {
        isin: { in: ["BTC", "IE00B4L5Y983"] },
        currency: "EUR"
      },
      select: {
        isin: true,
        date: true,
        value: true
      },
      orderBy: { date: "asc" }
    });
  });

  it("can limit portfolio history to the profile transaction window", async () => {
    await marketDataRepository.listPortfolioHistory(["BTC"], { fromDate: "2026-01-01" });

    expect(mocks.assetHistoryFindMany).toHaveBeenCalledWith({
      where: {
        isin: { in: ["BTC"] },
        currency: "EUR",
        date: { gte: "2026-01-01" }
      },
      select: {
        isin: true,
        date: true,
        value: true
      },
      orderBy: { date: "asc" }
    });
  });

  it("deduplicates latest prices by first sorted history row", async () => {
    mocks.queryRaw.mockResolvedValueOnce([
      { isin: "BTC", value: 60_000 },
      { isin: "ETH", value: 2_400 }
    ]);

    const prices = await marketDataRepository.listLatestHistoricalPrices(["BTC", "ETH"]);

    expect(prices).toEqual(new Map([
      ["BTC", 60_000],
      ["ETH", 2_400]
    ]));
    expect(mocks.queryRaw).toHaveBeenCalledTimes(1);
  });

  it("checks whether a market key belongs to a profile portfolio", async () => {
    mocks.investmentCount.mockResolvedValueOnce(0);
    mocks.cryptoCount.mockResolvedValueOnce(1);

    const result = await marketDataRepository.profileHasMarketKey("profile-1", "BTC");

    expect(result).toBe(true);
    expect(mocks.investmentCount).toHaveBeenCalledWith({
      where: {
        userId: "profile-1",
        isin: "BTC"
      }
    });
    expect(mocks.cryptoCount).toHaveBeenCalledWith({
      where: {
        userId: "profile-1",
        tokenSymbol: "BTC"
      }
    });
  });

  it("loads a profile-scoped asset history series after route authorization", async () => {
    await marketDataRepository.listAssetHistorySeries("IE00B4L5Y983", "EUR");

    expect(mocks.assetHistoryFindMany).toHaveBeenCalledWith({
      where: {
        isin: "IE00B4L5Y983",
        currency: "EUR"
      },
      orderBy: { date: "asc" },
      select: {
        date: true,
        value: true
      }
    });
  });
});
