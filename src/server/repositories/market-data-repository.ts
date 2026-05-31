import { Prisma } from "@prisma/client";

import type { PortfolioHistoryPrice } from "@/domain/finance/portfolio-timeseries";
import { prisma } from "@/server/db/prisma";

const portfolioHistorySelect = {
  isin: true,
  date: true,
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
  listPortfolioHistory(priceKeys: string[], options?: { fromDate?: string }): Promise<PortfolioHistoryPrice[]>;
  listLatestHistoricalPrices(keys: string[]): Promise<Map<string, number>>;
  profileHasMarketKey(userId: string, key: string): Promise<boolean>;
  listAssetHistorySeries(isin: string, currency: string): Promise<AssetHistorySeriesPoint[]>;
};

export const marketDataRepository: MarketDataRepository = {
  async listPortfolioHistory(priceKeys, { fromDate }: { fromDate?: string } = {}) {
    if (priceKeys.length === 0) return [];

    return prisma.assetHistory.findMany({
      where: {
        isin: { in: priceKeys },
        currency: "EUR",
        ...(fromDate ? { date: { gte: fromDate } } : {})
      },
      select: portfolioHistorySelect,
      orderBy: { date: "asc" }
    });
  },

  async listLatestHistoricalPrices(keys) {
    if (keys.length === 0) {
      return new Map<string, number>();
    }

    const historyPoints = await prisma.$queryRaw<Array<{ isin: string; value: number }>>`
      SELECT DISTINCT ON ("isin") "isin", "value"
      FROM "AssetHistory"
      WHERE "currency" = 'EUR'
        AND "isin" IN (${Prisma.join(keys)})
      ORDER BY "isin" ASC, "date" DESC
    `;

    const prices = new Map<string, number>();
    for (const point of historyPoints) {
      if (!prices.has(point.isin)) {
        prices.set(point.isin, point.value);
      }
    }

    return prices;
  },

  async profileHasMarketKey(userId, key) {
    const [investmentCount, cryptoCount] = await Promise.all([
      prisma.investmentTransaction.count({
        where: {
          userId,
          isin: key
        }
      }),
      prisma.cryptoTransaction.count({
        where: {
          userId,
          tokenSymbol: key
        }
      })
    ]);

    return investmentCount > 0 || cryptoCount > 0;
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
