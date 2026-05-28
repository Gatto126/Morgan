import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db/prisma";

const assetHistorySelect = {
  isin: true,
  date: true,
  value: true
} as const;

export type DashboardCheckingTransaction = Prisma.CheckingTransactionGetPayload<Record<string, never>>;
export type DashboardInvestmentTransaction = Prisma.InvestmentTransactionGetPayload<Record<string, never>>;
export type DashboardCryptoTransaction = Prisma.CryptoTransactionGetPayload<Record<string, never>>;
export type DashboardAssetHistory = Prisma.AssetHistoryGetPayload<{
  select: typeof assetHistorySelect;
}>;

export type DashboardTransactions = {
  checkingTxs: DashboardCheckingTransaction[];
  investmentTxs: DashboardInvestmentTransaction[];
  cryptoTxs: DashboardCryptoTransaction[];
};

export type DashboardRepository = {
  listTransactions(userId: string): Promise<DashboardTransactions>;
  listAssetHistory(symbols: string[]): Promise<DashboardAssetHistory[]>;
};

export const dashboardRepository: DashboardRepository = {
  async listTransactions(userId) {
    const [checkingTxs, investmentTxs, cryptoTxs] = await Promise.all([
      prisma.checkingTransaction.findMany({
        where: { userId },
        orderBy: { bookingDate: "asc" }
      }),
      prisma.investmentTransaction.findMany({
        where: { userId },
        orderBy: { bookingDate: "asc" }
      }),
      prisma.cryptoTransaction.findMany({
        where: { userId },
        orderBy: { bookingDate: "asc" }
      })
    ]);

    return {
      checkingTxs,
      investmentTxs,
      cryptoTxs
    };
  },

  async listAssetHistory(symbols) {
    if (symbols.length === 0) return [];

    return prisma.assetHistory.findMany({
      where: {
        isin: { in: symbols },
        currency: "EUR"
      },
      select: assetHistorySelect,
      orderBy: { date: "asc" }
    });
  }
};
