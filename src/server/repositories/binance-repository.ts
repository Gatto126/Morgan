import type { PricedBinanceBalance } from "@/integrations/binance/binance-service";
import { prisma } from "@/server/db/prisma";

export type BinanceCredentialRecord = {
  binanceApiKeyEncrypted?: string | null;
  binanceApiSecretEncrypted?: string | null;
  binanceApiKeyPreview?: string | null;
} | null;

export type PersistedBinanceBalance = PricedBinanceBalance & {
  id: string;
  userId: string;
  updatedAt: Date;
};

export type BinanceBalanceStatusRecords = {
  balances: PersistedBinanceBalance[];
  syncTimestamp: Date | null;
  credentialRecord: BinanceCredentialRecord;
};

export type BinanceRepository = {
  getCredentialRecord(userId: string): Promise<BinanceCredentialRecord>;
  listBalances(userId: string): Promise<PersistedBinanceBalance[]>;
  upsertBalance(userId: string, balance: PricedBinanceBalance): Promise<void>;
  deleteInactiveBalances(userId: string, activeSymbols: string[]): Promise<void>;
  upsertSyncTimestamp(userId: string, syncedAt: Date): Promise<void>;
  getBalanceStatusRecords(userId: string): Promise<BinanceBalanceStatusRecords>;
};

async function getCredentialRecord(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      binanceApiKeyEncrypted: true,
      binanceApiSecretEncrypted: true,
      binanceApiKeyPreview: true
    }
  });
}

async function listBalances(userId: string) {
  return prisma.binanceBalance.findMany({
    where: { userId },
    orderBy: { eurValue: "desc" }
  });
}

async function upsertBalance(userId: string, balance: PricedBinanceBalance) {
  await prisma.binanceBalance.upsert({
    where: { userId_tokenSymbol: { userId, tokenSymbol: balance.tokenSymbol } },
    update: {
      tokenName: balance.tokenName,
      freeAmount: balance.freeAmount,
      lockedAmount: balance.lockedAmount,
      eurValue: balance.eurValue
    },
    create: {
      userId,
      tokenSymbol: balance.tokenSymbol,
      tokenName: balance.tokenName,
      freeAmount: balance.freeAmount,
      lockedAmount: balance.lockedAmount,
      eurValue: balance.eurValue
    }
  });
}

async function deleteInactiveBalances(userId: string, activeSymbols: string[]) {
  await prisma.binanceBalance.deleteMany({
    where: activeSymbols.length > 0
      ? { userId, tokenSymbol: { notIn: activeSymbols } }
      : { userId }
  });
}

async function upsertSyncTimestamp(userId: string, syncedAt: Date) {
  await prisma.priceCache.upsert({
    where: { key: `binance_sync_${userId}` },
    update: { timestamp: syncedAt },
    create: { key: `binance_sync_${userId}`, timestamp: syncedAt }
  });
}

async function getBalanceStatusRecords(userId: string) {
  const [balances, syncCache, credentialRecord] = await Promise.all([
    listBalances(userId),
    prisma.priceCache.findUnique({ where: { key: `binance_sync_${userId}` } }),
    getCredentialRecord(userId)
  ]);

  return {
    balances,
    syncTimestamp: syncCache?.timestamp ?? null,
    credentialRecord
  };
}

export const binanceRepository: BinanceRepository = {
  getCredentialRecord,
  listBalances,
  upsertBalance,
  deleteInactiveBalances,
  upsertSyncTimestamp,
  getBalanceStatusRecords
};
