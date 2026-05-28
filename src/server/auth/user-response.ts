import "server-only";

import type { User } from "@prisma/client";

import { getBinanceApiKeyPreview, hasBinanceCredentials } from "@/server/security/secrets";

type TransactionCounts = {
  _count: {
    checkingTransactions: number;
    investmentTransactions: number;
    cryptoTransactions: number;
  };
};

export function toSafeUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    hasBinanceCredentials: hasBinanceCredentials(user),
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
