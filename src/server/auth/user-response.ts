import "server-only";

import type { User } from "@prisma/client";

import { getBinanceApiKeyPreview, hasBinanceCredentials } from "@/server/security/secrets";

type TransactionCounts = {
  _count: {
    checkingTransactions: number;
    investmentTransactions: number;
    cryptoTransactions: number;
    binanceBalances?: number;
    binanceDailySnapshots?: number;
  };
};

type BinanceDataCounts = {
  _count?: {
    binanceBalances?: number;
    binanceDailySnapshots?: number;
  };
};

function hasBinanceData(user: BinanceDataCounts) {
  const balanceCount = user._count?.binanceBalances ?? 0;
  const snapshotCount = user._count?.binanceDailySnapshots ?? 0;

  return balanceCount > 0 || snapshotCount > 0;
}

export function toSafeUser(user: User & BinanceDataCounts) {
  return {
    id: user.id,
    name: user.name,
    hasBinanceCredentials: hasBinanceCredentials(user),
    hasBinanceData: hasBinanceData(user),
    binanceApiKeyPreview: getBinanceApiKeyPreview(user),
  };
}

export function toSafeUserSummary(user: User & TransactionCounts) {
  const transactionCount =
    user._count.checkingTransactions +
    user._count.investmentTransactions +
    user._count.cryptoTransactions;

  return {
    ...toSafeUser(user),
    transactionCount,
    checkingCount: user._count.checkingTransactions,
    investmentCount: user._count.investmentTransactions,
    cryptoCount: user._count.cryptoTransactions,
  };
}
