import type { Prisma } from "@prisma/client";

import type { PortfolioHistoryPrice } from "@/domain/finance/portfolio-timeseries";
import { prisma } from "@/server/db/prisma";

const portfolioHistorySelect = {
  isin: true,
  date: true,
  value: true
} as const;

const latestPriceSelect = {
  isin: true,
  value: true
} as const;

const assetHistorySeriesSelect = {
  date: true,
  value: true
} as const;

export type AssetHistorySeriesPoint = Prisma.AssetHistoryGetPayload<{
  select: typeof assetHistorySeriesSelect;
}>;

export type MarketDataRepository = {
  listPortfolioHistory(priceKeys: string[]): Promise<PortfolioHistoryPrice[]>;
  listLatestHistoricalPrices(keys: string[]): Promise<Map<string, number>>;
  listAssetHistorySeries(isin: string, currency: string): Promise<AssetHistorySeriesPoint[]>;
};

export const marketDataRepository: MarketDataRepository = {
  async listPortfolioHistory(priceKeys) {
    if (priceKeys.length === 0) return [];

    return prisma.assetHistory.findMany({
      where: {
        isin: { in: priceKeys },
        currency: "EUR"
      },
      select: portfolioHistorySelect,
      orderBy: { date: "asc" }
    });
  },

  async listLatestHistoricalPrices(keys) {
    if (keys.length === 0) {
      return new Map<string, number>();
    }

    const historyPoints = await prisma.assetHistory.findMany({
      where: {
        isin: { in: keys },
        currency: "EUR"
      },
      select: latestPriceSelect,
      orderBy: [
        { isin: "asc" },
        { date: "desc" }
      ]
    });

    const prices = new Map<string, number>();
    for (const point of historyPoints) {
      if (!prices.has(point.isin)) {
        prices.set(point.isin, point.value);
      }
    }

    return prices;
  },

  async listAssetHistorySeries(isin, currency) {
    return prisma.assetHistory.findMany({
      where: {
        isin,
        currency
      },
      orderBy: {
        date: "asc"
      },
      select: assetHistorySeriesSelect
    });
  }
};
