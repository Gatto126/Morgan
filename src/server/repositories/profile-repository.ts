import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db/prisma";

const profileSummaryInclude = {
  _count: {
    select: {
      checkingTransactions: true,
      investmentTransactions: true,
      cryptoTransactions: true
    }
  }
} as const;

export type ProfileSummaryRecord = Prisma.UserGetPayload<{
  include: typeof profileSummaryInclude;
}>;

export type ProfileRecord = Prisma.UserGetPayload<Record<string, never>>;

export type BinanceCredentialUpdate = {
  binanceApiKeyEncrypted?: string | null;
  binanceApiSecretEncrypted?: string | null;
  binanceApiKeyPreview?: string | null;
};

export type ProfileRepository = {
  listByOwner(ownerId: string): Promise<ProfileSummaryRecord[]>;
  findByOwner(ownerId: string, id: string): Promise<ProfileRecord | null>;
  findByOwnerAndName(ownerId: string, name: string): Promise<ProfileRecord | null>;
  create(ownerId: string, name: string): Promise<ProfileRecord>;
  listInvestmentIsins(userId: string): Promise<string[]>;
  listOtherInvestmentIsins(userId: string, isins: string[]): Promise<string[]>;
  listCryptoTokens(userId: string): Promise<string[]>;
  listBinanceTokens(userId: string): Promise<string[]>;
  listOtherCryptoTokens(userId: string, tokens: string[]): Promise<string[]>;
  listOtherBinanceTokens(userId: string, tokens: string[]): Promise<string[]>;
  deleteAssetHistory(keys: string[]): Promise<void>;
  deleteAssets(isins: string[]): Promise<void>;
  deleteCryptoAssets(tokens: string[]): Promise<void>;
  deletePriceCache(keys: string[]): Promise<void>;
  deleteBinanceBalances(userId: string): Promise<void>;
  deleteBinanceDailySnapshots(userId: string): Promise<void>;
  deleteProfile(userId: string): Promise<void>;
  updateBinanceCredentials(userId: string, data: BinanceCredentialUpdate): Promise<ProfileRecord>;
};

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0)));
}

export const profileRepository: ProfileRepository = {
  async listByOwner(ownerId) {
    return prisma.user.findMany({
      where: {
        ownerId
      },
      include: profileSummaryInclude,
      orderBy: {
        createdAt: "asc"
      }
    });
  },

  async findByOwner(ownerId, id) {
    return prisma.user.findFirst({
      where: {
        id,
        ownerId
      }
    });
  },

  async findByOwnerAndName(ownerId, name) {
    return prisma.user.findFirst({
      where: {
        ownerId,
        name
      }
    });
  },

  async create(ownerId, name) {
    return prisma.user.create({
      data: {
        ownerId,
        name
      }
    });
  },

  async listInvestmentIsins(userId) {
    const rows = await prisma.investmentTransaction.findMany({
      where: { userId },
      select: { isin: true }
    });

    return uniqueStrings(rows.map((transaction) => transaction.isin));
  },

  async listOtherInvestmentIsins(userId, isins) {
    if (isins.length === 0) return [];

    const rows = await prisma.investmentTransaction.findMany({
      where: {
        userId: { not: userId },
        isin: { in: isins }
      },
      select: { isin: true }
    });

    return uniqueStrings(rows.map((transaction) => transaction.isin));
  },

  async listCryptoTokens(userId) {
    const rows = await prisma.cryptoTransaction.findMany({
      where: { userId },
      select: { tokenSymbol: true }
    });

    return uniqueStrings(rows.map((transaction) => transaction.tokenSymbol));
  },

  async listBinanceTokens(userId) {
    const rows = await prisma.binanceBalance.findMany({
      where: { userId },
      select: { tokenSymbol: true }
    });

    return uniqueStrings(rows.map((balance) => balance.tokenSymbol));
  },

  async listOtherCryptoTokens(userId, tokens) {
    if (tokens.length === 0) return [];

    const rows = await prisma.cryptoTransaction.findMany({
      where: {
        userId: { not: userId },
        tokenSymbol: { in: tokens }
      },
      select: { tokenSymbol: true }
    });

    return uniqueStrings(rows.map((transaction) => transaction.tokenSymbol));
  },

  async listOtherBinanceTokens(userId, tokens) {
    if (tokens.length === 0) return [];

    const rows = await prisma.binanceBalance.findMany({
      where: {
        userId: { not: userId },
        tokenSymbol: { in: tokens }
      },
      select: { tokenSymbol: true }
    });

    return uniqueStrings(rows.map((balance) => balance.tokenSymbol));
  },

  async deleteAssetHistory(keys) {
    if (keys.length === 0) return;

    await prisma.assetHistory.deleteMany({
      where: {
        isin: { in: keys }
      }
    });
  },

  async deleteAssets(isins) {
    if (isins.length === 0) return;

    await prisma.asset.deleteMany({
      where: {
        isin: { in: isins }
      }
    });
  },

  async deleteCryptoAssets(tokens) {
    if (tokens.length === 0) return;

    await prisma.cryptoAsset.deleteMany({
      where: {
        tokenSymbol: { in: tokens }
      }
    });
  },

  async deletePriceCache(keys) {
    if (keys.length === 0) return;

    await prisma.priceCache.deleteMany({
      where: {
        key: { in: keys }
      }
    });
  },

  async deleteBinanceBalances(userId) {
    await prisma.binanceBalance.deleteMany({ where: { userId } });
  },

  async deleteBinanceDailySnapshots(userId) {
    await prisma.binanceDailySnapshot.deleteMany({ where: { userId } });
  },

  async deleteProfile(userId) {
    await prisma.user.delete({
      where: { id: userId }
    });
  },

  async updateBinanceCredentials(userId, data) {
    return prisma.user.update({
      where: { id: userId },
      data
    });
  }
};
