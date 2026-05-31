import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db/prisma";

const checkingTransactionSelect = {
  amountCents: true,
  balanceCents: true,
  bookingDate: true,
  description: true,
  direction: true,
  sourceInstitution: true,
  typeLabel: true
} as const;

const investmentTransactionSelect = {
  amountCents: true,
  bookingDate: true,
  description: true,
  direction: true,
  isin: true,
  productName: true,
  quantityUnits: true,
  sourceInstitution: true,
  tradeType: true,
  typeLabel: true
} as const;

const cryptoTransactionSelect = {
  amountCents: true,
  bookingDate: true,
  description: true,
  direction: true,
  quantityUnits: true,
  sourceInstitution: true,
  tokenName: true,
  tokenSymbol: true,
  typeLabel: true
} as const;

const assetHistorySelect = {
  isin: true,
  date: true,
  value: true
} as const;

export type DashboardCheckingTransaction = Prisma.CheckingTransactionGetPayload<{
  select: typeof checkingTransactionSelect;
}>;
export type DashboardInvestmentTransaction = Prisma.InvestmentTransactionGetPayload<{
  select: typeof investmentTransactionSelect;
}>;
export type DashboardCryptoTransaction = Prisma.CryptoTransactionGetPayload<{
  select: typeof cryptoTransactionSelect;
}>;
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
  listAssetHistory(symbols: string[], options?: { fromDate?: string }): Promise<DashboardAssetHistory[]>;
};

export const dashboardRepository: DashboardRepository = {
  async listTransactions(userId) {
    const [checkingTxs, investmentTxs, cryptoTxs] = await Promise.all([
      prisma.checkingTransaction.findMany({
        where: { userId },
        select: checkingTransactionSelect,
        orderBy: { bookingDate: "asc" }
      }),
      prisma.investmentTransaction.findMany({
        where: { userId },
        select: investmentTransactionSelect,
        orderBy: { bookingDate: "asc" }
      }),
      prisma.cryptoTransaction.findMany({
        where: { userId },
        select: cryptoTransactionSelect,
        orderBy: { bookingDate: "asc" }
      })
    ]);

    return {
      checkingTxs,
      investmentTxs,
      cryptoTxs
    };
  },

  async listAssetHistory(symbols, { fromDate }: { fromDate?: string } = {}) {
    if (symbols.length === 0) return [];

    return prisma.assetHistory.findMany({
      where: {
        isin: { in: symbols },
        currency: "EUR",
        ...(fromDate ? { date: { gte: fromDate } } : {})
      },
      select: assetHistorySelect,
      orderBy: { date: "asc" }
    });
  }
};
