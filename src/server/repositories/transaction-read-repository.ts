import type { Prisma } from "@prisma/client";

import type { PortfolioTransaction } from "@/domain/finance/portfolio-timeseries";
import { prisma } from "@/server/db/prisma";

const checkingSelect = {
  id: true,
  sourceInstitution: true,
  bookingDate: true,
  typeLabel: true,
  description: true,
  direction: true,
  amountCents: true,
  balanceCents: true
} as const;

const portfolioTransactionSelect = {
  id: true,
  sourceInstitution: true,
  bookingDate: true,
  typeLabel: true,
  description: true,
  direction: true,
  amountCents: true,
  tradeType: true,
  productName: true,
  isin: true,
  quantityUnits: true
} as const;

const cryptoTransactionSelect = {
  id: true,
  sourceInstitution: true,
  bookingDate: true,
  typeLabel: true,
  description: true,
  direction: true,
  amountCents: true,
  tokenName: true,
  tokenSymbol: true,
  quantityUnits: true
} as const;

export type CheckingTransactionRecord = Prisma.CheckingTransactionGetPayload<{
  select: typeof checkingSelect;
}>;

export type InvestmentPortfolioTransactionRecord = Prisma.InvestmentTransactionGetPayload<{
  select: typeof portfolioTransactionSelect;
}>;

export type CryptoTransactionRecord = Prisma.CryptoTransactionGetPayload<{
  select: typeof cryptoTransactionSelect;
}>;

export type TransactionReadRepository = {
  listCheckingTransactions(userId: string): Promise<CheckingTransactionRecord[]>;
  listInvestmentTransactions(userId: string): Promise<InvestmentPortfolioTransactionRecord[]>;
  listTradeRepublicCryptoTransactions(userId: string): Promise<CryptoTransactionRecord[]>;
};

export const transactionReadRepository: TransactionReadRepository = {
  async listCheckingTransactions(userId) {
    return prisma.checkingTransaction.findMany({
      where: { userId },
      orderBy: { bookingDate: "desc" },
      select: checkingSelect
    });
  },

  async listInvestmentTransactions(userId) {
    return prisma.investmentTransaction.findMany({
      where: { userId },
      orderBy: { bookingDate: "desc" },
      select: portfolioTransactionSelect
    });
  },

  async listTradeRepublicCryptoTransactions(userId) {
    return prisma.cryptoTransaction.findMany({
      where: {
        userId,
        sourceInstitution: "trade_republic"
      },
      orderBy: { bookingDate: "desc" },
      select: cryptoTransactionSelect
    });
  }
};

export function toCryptoPortfolioTransaction(transaction: CryptoTransactionRecord): PortfolioTransaction {
  return {
    id: transaction.id,
    sourceInstitution: transaction.sourceInstitution,
    bookingDate: transaction.bookingDate,
    typeLabel: transaction.typeLabel,
    description: transaction.description,
    direction: transaction.direction,
    amountCents: transaction.amountCents,
    tradeType: transaction.typeLabel === "BUY" || transaction.typeLabel === "SELL"
      ? (transaction.description.toLowerCase().includes("savings plan") ? "savings_plan" : "buy_trade")
      : null,
    productName: transaction.tokenName,
    isin: transaction.tokenSymbol,
    quantityUnits: transaction.quantityUnits
  };
}
