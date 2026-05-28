import { verifyPassword } from "better-auth/crypto";

import { hasLocalPasswordInput } from "@/domain/auth/local-auth";
import { prisma } from "@/server/db/prisma";

export class AccountDeleteValidationError extends Error {
  constructor(
    public status: 400 | 422,
    message: string
  ) {
    super(message);
    this.name = "AccountDeleteValidationError";
  }
}

export type AccountDeletionResult = {
  deletedProfiles: number;
  cleanupMode: "full" | "scoped";
  deletedHistory: number;
  deletedAssets: number;
  deletedCryptoAssets: number;
  deletedPriceCache: number;
};

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0)));
}

export async function parseAccountDeletePassword(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AccountDeleteValidationError(400, "Invalid request body.");
  }

  if (!body || typeof body !== "object") {
    throw new AccountDeleteValidationError(400, "Password is required.");
  }

  const password = (body as { password?: unknown }).password;
  if (typeof password !== "string" || !hasLocalPasswordInput(password)) {
    throw new AccountDeleteValidationError(400, "Password is required.");
  }

  return password;
}

export async function verifyAccountDeletePassword(ownerId: string, password: string) {
  const credentialAccount = await prisma.authAccount.findFirst({
    where: {
      userId: ownerId,
      providerId: "credential",
      password: { not: null }
    },
    select: { password: true }
  });

  if (!credentialAccount?.password) {
    return false;
  }

  return verifyPassword({
    hash: credentialAccount.password,
    password
  });
}

export async function deleteAccount(ownerId: string): Promise<AccountDeletionResult> {
  const profiles = await prisma.user.findMany({
    where: { ownerId },
    select: { id: true }
  });
  const profileIds = profiles.map((profile) => profile.id);
  const binanceSyncKeys = profileIds.map((profileId) => `binance_sync_${profileId}`);

  let isinsToDelete: string[] = [];
  let tokensToDelete: string[] = [];

  if (profileIds.length > 0) {
    const [investmentRows, cryptoRows, binanceRows] = await Promise.all([
      prisma.investmentTransaction.findMany({
        where: { userId: { in: profileIds } },
        select: { isin: true }
      }),
      prisma.cryptoTransaction.findMany({
        where: { userId: { in: profileIds } },
        select: { tokenSymbol: true }
      }),
      prisma.binanceBalance.findMany({
        where: { userId: { in: profileIds } },
        select: { tokenSymbol: true }
      })
    ]);

    const userIsins = uniqueStrings(investmentRows.map((transaction) => transaction.isin));
    const userTokens = uniqueStrings([
      ...cryptoRows.map((transaction) => transaction.tokenSymbol),
      ...binanceRows.map((balance) => balance.tokenSymbol)
    ]);

    if (userIsins.length > 0) {
      const otherInvestmentRows = await prisma.investmentTransaction.findMany({
        where: {
          userId: { notIn: profileIds },
          isin: { in: userIsins }
        },
        select: { isin: true }
      });
      const otherIsins = new Set(uniqueStrings(otherInvestmentRows.map((transaction) => transaction.isin)));
      isinsToDelete = userIsins.filter((isin) => !otherIsins.has(isin));
    }

    if (userTokens.length > 0) {
      const [otherCryptoRows, otherBinanceRows] = await Promise.all([
        prisma.cryptoTransaction.findMany({
          where: {
            userId: { notIn: profileIds },
            tokenSymbol: { in: userTokens }
          },
          select: { tokenSymbol: true }
        }),
        prisma.binanceBalance.findMany({
          where: {
            userId: { notIn: profileIds },
            tokenSymbol: { in: userTokens }
          },
          select: { tokenSymbol: true }
        })
      ]);
      const otherTokens = new Set(uniqueStrings([
        ...otherCryptoRows.map((transaction) => transaction.tokenSymbol),
        ...otherBinanceRows.map((balance) => balance.tokenSymbol)
      ]));
      tokensToDelete = userTokens.filter((token) => !otherTokens.has(token));
    }
  }

  const scopedPriceCacheKeys = uniqueStrings([
    ...isinsToDelete,
    ...tokensToDelete,
    ...binanceSyncKeys
  ]);

  const result = await prisma.$transaction(async (tx) => {
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

  return {
    deletedProfiles: profileIds.length,
    ...result
  };
}
