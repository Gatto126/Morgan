import type { Prisma } from "@prisma/client";

import type { PortfolioTransaction } from "@/domain/finance/portfolio-timeseries";
import { normalizeCryptoSymbol } from "@/domain/pricing/crypto-symbols";
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

type TransactionRowsPageOptions = {
  sourceInstitution: string;
  limit: number;
  offset: number;
};

type TransactionRowsPage<TTransaction> = {
  transactions: TTransaction[];
  total: number;
};

export type TransactionReadRepository = {
  listCheckingTransactions(userId: string): Promise<CheckingTransactionRecord[]>;
  listInvestmentTransactions(userId: string): Promise<InvestmentPortfolioTransactionRecord[]>;
  listTradeRepublicCryptoTransactions(userId: string): Promise<CryptoTransactionRecord[]>;
  listCheckingTransactionRows(
    userId: string,
    options: TransactionRowsPageOptions
  ): Promise<TransactionRowsPage<CheckingTransactionRecord>>;
  listInvestmentTransactionRows(
    userId: string,
    options: TransactionRowsPageOptions
  ): Promise<TransactionRowsPage<InvestmentPortfolioTransactionRecord>>;
  listTradeRepublicCryptoTransactionRows(
    userId: string,
    options: TransactionRowsPageOptions
  ): Promise<TransactionRowsPage<CryptoTransactionRecord>>;
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
  },

  async listCheckingTransactionRows(userId, { limit, offset, sourceInstitution }) {
    const where = { userId, sourceInstitution };
    const [transactions, total] = await Promise.all([
      prisma.checkingTransaction.findMany({
        where,
        orderBy: [
          { bookingDate: "desc" },
          { id: "desc" }
        ],
        skip: offset,
        take: limit,
        select: checkingSelect
      }),
      prisma.checkingTransaction.count({ where })
    ]);

    return { total, transactions };
  },

  async listInvestmentTransactionRows(userId, { limit, offset, sourceInstitution }) {
    const where = { userId, sourceInstitution };
    const [transactions, total] = await Promise.all([
      prisma.investmentTransaction.findMany({
        where,
        orderBy: [
          { bookingDate: "desc" },
          { id: "desc" }
        ],
        skip: offset,
        take: limit,
        select: portfolioTransactionSelect
      }),
      prisma.investmentTransaction.count({ where })
    ]);

    return { total, transactions };
  },

  async listTradeRepublicCryptoTransactionRows(userId, { limit, offset, sourceInstitution }) {
    const where = { userId, sourceInstitution };
    const [transactions, total] = await Promise.all([
      prisma.cryptoTransaction.findMany({
        where,
        orderBy: [
          { bookingDate: "desc" },
          { id: "desc" }
        ],
        skip: offset,
        take: limit,
        select: cryptoTransactionSelect
      }),
      prisma.cryptoTransaction.count({ where })
    ]);

    return { total, transactions };
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
    isin: normalizeCryptoSymbol(transaction.tokenSymbol),
    quantityUnits: transaction.quantityUnits
  };
}
