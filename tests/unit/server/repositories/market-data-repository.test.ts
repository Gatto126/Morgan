import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assetHistoryFindMany: vi.fn()
}));

vi.mock("@/server/db/prisma", () => ({
  prisma: {
    assetHistory: {
      findMany: mocks.assetHistoryFindMany
    }
  }
}));

import { marketDataRepository } from "@/server/repositories/market-data-repository";

describe("market data repository", () => {
  beforeEach(() => {
    mocks.assetHistoryFindMany.mockReset();
    mocks.assetHistoryFindMany.mockResolvedValue([]);
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

  it("deduplicates latest prices by first sorted history row", async () => {
    mocks.assetHistoryFindMany.mockResolvedValueOnce([
      { isin: "BTC", value: 60_000 },
      { isin: "BTC", value: 55_000 },
      { isin: "ETH", value: 2_400 }
    ]);

    const prices = await marketDataRepository.listLatestHistoricalPrices(["BTC", "ETH"]);

    expect(prices).toEqual(new Map([
      ["BTC", 60_000],
      ["ETH", 2_400]
    ]));
  });

  it("loads a public asset history series", async () => {
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
