import { prisma } from "@/server/db/prisma";

export type AccountDeletionCleanupInput = {
  profileIds: string[];
  isinsToDelete: string[];
  tokensToDelete: string[];
  scopedPriceCacheKeys: string[];
};

export type AccountDeletionCleanupResult = {
  cleanupMode: "full" | "scoped";
  deletedHistory: number;
  deletedAssets: number;
  deletedCryptoAssets: number;
  deletedPriceCache: number;
};

export type AccountDeletionRepository = {
  getCredentialPassword(ownerId: string): Promise<string | null>;
  listProfileIds(ownerId: string): Promise<string[]>;
  listInvestmentIsins(profileIds: string[]): Promise<string[]>;
  listCryptoTokens(profileIds: string[]): Promise<string[]>;
  listBinanceTokens(profileIds: string[]): Promise<string[]>;
  listOtherInvestmentIsins(profileIds: string[], isins: string[]): Promise<string[]>;
  listOtherCryptoTokens(profileIds: string[], tokens: string[]): Promise<string[]>;
  listOtherBinanceTokens(profileIds: string[], tokens: string[]): Promise<string[]>;
  deleteAccountData(ownerId: string, input: AccountDeletionCleanupInput): Promise<AccountDeletionCleanupResult>;
};

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0)));
}

export const accountDeletionRepository: AccountDeletionRepository = {
  async getCredentialPassword(ownerId) {
    const credentialAccount = await prisma.authAccount.findFirst({
      where: {
        userId: ownerId,
        providerId: "credential",
        password: { not: null }
      },
      select: { password: true }
    });

    return credentialAccount?.password ?? null;
  },

  async listProfileIds(ownerId) {
    const profiles = await prisma.user.findMany({
      where: { ownerId },
      select: { id: true }
    });

    return profiles.map((profile) => profile.id);
  },

  async listInvestmentIsins(profileIds) {
    if (profileIds.length === 0) return [];

    const rows = await prisma.investmentTransaction.findMany({
      where: { userId: { in: profileIds } },
      select: { isin: true }
    });

    return uniqueStrings(rows.map((transaction) => transaction.isin));
  },

  async listCryptoTokens(profileIds) {
    if (profileIds.length === 0) return [];

    const rows = await prisma.cryptoTransaction.findMany({
      where: { userId: { in: profileIds } },
      select: { tokenSymbol: true }
    });

    return uniqueStrings(rows.map((transaction) => transaction.tokenSymbol));
  },

  async listBinanceTokens(profileIds) {
    if (profileIds.length === 0) return [];

    const rows = await prisma.binanceBalance.findMany({
      where: { userId: { in: profileIds } },
      select: { tokenSymbol: true }
    });

    return uniqueStrings(rows.map((balance) => balance.tokenSymbol));
  },

  async listOtherInvestmentIsins(profileIds, isins) {
    if (profileIds.length === 0 || isins.length === 0) return [];

    const rows = await prisma.investmentTransaction.findMany({
      where: {
        userId: { notIn: profileIds },
        isin: { in: isins }
      },
      select: { isin: true }
    });

    return uniqueStrings(rows.map((transaction) => transaction.isin));
  },

  async listOtherCryptoTokens(profileIds, tokens) {
    if (profileIds.length === 0 || tokens.length === 0) return [];

    const rows = await prisma.cryptoTransaction.findMany({
      where: {
        userId: { notIn: profileIds },
        tokenSymbol: { in: tokens }
      },
      select: { tokenSymbol: true }
    });

    return uniqueStrings(rows.map((transaction) => transaction.tokenSymbol));
  },

  async listOtherBinanceTokens(profileIds, tokens) {
    if (profileIds.length === 0 || tokens.length === 0) return [];

    const rows = await prisma.binanceBalance.findMany({
      where: {
        userId: { notIn: profileIds },
        tokenSymbol: { in: tokens }
      },
      select: { tokenSymbol: true }
    });

    return uniqueStrings(rows.map((balance) => balance.tokenSymbol));
  },

  async deleteAccountData(ownerId, input) {
    const { profileIds, isinsToDelete, tokensToDelete, scopedPriceCacheKeys } = input;

    return prisma.$transaction(async (tx) => {
      if (profileIds.length > 0) {
        await tx.checkingTransaction.deleteMany({ where: { userId: { in: profileIds } } });
        await tx.investmentTransaction.deleteMany({ where: { userId: { in: profileIds } } });
        await tx.cryptoTransaction.deleteMany({ where: { userId: { in: profileIds } } });
        await tx.binanceBalance.deleteMany({ where: { userId: { in: profileIds } } });
        await tx.user.deleteMany({ where: { ownerId } });
      }

      await tx.authSession.deleteMany({ where: { userId: ownerId } });
      await tx.authAccount.deleteMany({ where: { userId: ownerId } });
      await tx.authUser.deleteMany({ where: { id: ownerId } });

      const remainingProfiles = await tx.user.count();

      if (remainingProfiles === 0) {
        const deletedHistory = await tx.assetHistory.deleteMany({});
        const deletedAssets = await tx.asset.deleteMany({});
        const deletedCryptoAssets = await tx.cryptoAsset.deleteMany({});
        const deletedPriceCache = await tx.priceCache.deleteMany({});

        return {
          cleanupMode: "full" as const,
          deletedHistory: deletedHistory.count,
          deletedAssets: deletedAssets.count,
          deletedCryptoAssets: deletedCryptoAssets.count,
          deletedPriceCache: deletedPriceCache.count
        };
      }

      const assetHistoryKeys = uniqueStrings([...isinsToDelete, ...tokensToDelete]);
      const deletedHistory =
        assetHistoryKeys.length > 0
          ? await tx.assetHistory.deleteMany({ where: { isin: { in: assetHistoryKeys } } })
          : { count: 0 };
      const deletedAssets =
        isinsToDelete.length > 0
          ? await tx.asset.deleteMany({ where: { isin: { in: isinsToDelete } } })
          : { count: 0 };
      const deletedCryptoAssets =
        tokensToDelete.length > 0
          ? await tx.cryptoAsset.deleteMany({ where: { tokenSymbol: { in: tokensToDelete } } })
          : { count: 0 };
      const deletedPriceCache =
        scopedPriceCacheKeys.length > 0
          ? await tx.priceCache.deleteMany({ where: { key: { in: scopedPriceCacheKeys } } })
          : { count: 0 };

      return {
        cleanupMode: "scoped" as const,
        deletedHistory: deletedHistory.count,
        deletedAssets: deletedAssets.count,
        deletedCryptoAssets: deletedCryptoAssets.count,
        deletedPriceCache: deletedPriceCache.count
      };
    });
  }
};
