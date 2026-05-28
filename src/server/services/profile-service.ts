import { z } from "zod";

import { toSafeUser, toSafeUserSummary } from "@/server/auth/user-response";
import { prisma } from "@/server/db/prisma";
import { encryptSecret, makeBinanceApiKeyPreview } from "@/server/security/secrets";

export class ProfileConflictError extends Error {
  constructor(message = "This profile already exists.") {
    super(message);
    this.name = "ProfileConflictError";
  }
}

export class ProfileNotFoundError extends Error {
  constructor(message = "Profile not found.") {
    super(message);
    this.name = "ProfileNotFoundError";
  }
}

export class ProfileBadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfileBadRequestError";
  }
}

const profileSummaryInclude = {
  _count: {
    select: {
      checkingTransactions: true,
      investmentTransactions: true,
      cryptoTransactions: true
    }
  }
} as const;

export const createProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Profile name is required.")
    .max(24, "Profile name must be 24 characters or fewer.")
});

export const patchProfileSchema = z.object({
  apiKey: z.string().trim().min(1).max(512).nullable().optional(),
  apiSecret: z.string().trim().min(1).max(512).nullable().optional(),
  deleteBalances: z.boolean().optional()
});

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0)));
}

export async function listProfiles(ownerId: string) {
  const users = await prisma.user.findMany({
    where: {
      ownerId
    },
    include: profileSummaryInclude,
    orderBy: {
      createdAt: "asc"
    }
  });

  return users.map(toSafeUserSummary);
}

export async function createProfile(ownerId: string, input: unknown) {
  const { name } = createProfileSchema.parse(input);

  const existingUser = await prisma.user.findFirst({
    where: {
      ownerId,
      name
    }
  });

  if (existingUser) {
    throw new ProfileConflictError();
  }

  const user = await prisma.user.create({
    data: {
      ownerId,
      name
    }
  });

  const users = await listProfiles(ownerId);

  return {
    user: {
      ...toSafeUser(user),
      transactionCount: 0,
      checkingCount: 0,
      investmentCount: 0,
      cryptoCount: 0
    },
    users
  };
}

export async function getProfile(ownerId: string, id: string) {
  const user = await prisma.user.findFirst({
    where: {
      id,
      ownerId
    }
  });

  if (!user) {
    throw new ProfileNotFoundError();
  }

  return toSafeUser(user);
}

export async function deleteProfile(id: string) {
  const userInvestments = await prisma.investmentTransaction.findMany({
    where: { userId: id },
    select: { isin: true }
  });
  const userIsins = uniqueStrings(userInvestments.map((transaction) => transaction.isin));

  let isinsToDelete: string[] = [];
  if (userIsins.length > 0) {
    const otherTransactions = await prisma.investmentTransaction.findMany({
      where: {
        userId: { not: id },
        isin: { in: userIsins }
      },
      select: { isin: true }
    });
    const otherIsins = new Set(uniqueStrings(otherTransactions.map((transaction) => transaction.isin)));
    isinsToDelete = userIsins.filter((isin) => !otherIsins.has(isin));
  }

  if (isinsToDelete.length > 0) {
    await prisma.assetHistory.deleteMany({
      where: {
        isin: { in: isinsToDelete }
      }
    });

    await prisma.asset.deleteMany({
      where: {
        isin: { in: isinsToDelete }
      }
    });
  }

  const userCryptos = await prisma.cryptoTransaction.findMany({
    where: { userId: id },
    select: { tokenSymbol: true }
  });
  const userBinanceBalances = await prisma.binanceBalance.findMany({
    where: { userId: id },
    select: { tokenSymbol: true }
  });
  const userTokens = uniqueStrings([
    ...userCryptos.map((transaction) => transaction.tokenSymbol),
    ...userBinanceBalances.map((balance) => balance.tokenSymbol)
  ]);

  let tokensToDelete: string[] = [];
  if (userTokens.length > 0) {
    const [otherCryptoTransactions, otherBinanceBalances] = await Promise.all([
      prisma.cryptoTransaction.findMany({
        where: {
          userId: { not: id },
          tokenSymbol: { in: userTokens }
        },
        select: { tokenSymbol: true }
      }),
      prisma.binanceBalance.findMany({
        where: {
          userId: { not: id },
          tokenSymbol: { in: userTokens }
        },
        select: { tokenSymbol: true }
      })
    ]);
    const otherTokens = new Set(uniqueStrings([
      ...otherCryptoTransactions.map((transaction) => transaction.tokenSymbol),
      ...otherBinanceBalances.map((balance) => balance.tokenSymbol)
    ]));
    tokensToDelete = userTokens.filter((token) => !otherTokens.has(token));
  }

  if (tokensToDelete.length > 0) {
    await prisma.assetHistory.deleteMany({
      where: {
        isin: { in: tokensToDelete }
      }
    });

    await prisma.cryptoAsset.deleteMany({
      where: {
        tokenSymbol: { in: tokensToDelete }
      }
    });
  }

  const priceCacheKeysToDelete = uniqueStrings([
    ...isinsToDelete,
    ...tokensToDelete,
    `binance_sync_${id}`
  ]);

  if (priceCacheKeysToDelete.length > 0) {
    await prisma.priceCache.deleteMany({
      where: {
        key: { in: priceCacheKeysToDelete }
      }
    });
  }

  await prisma.user.delete({
    where: { id }
  });

  return {
    isinsToDelete,
    tokensToDelete,
    priceCacheKeysToDelete
  };
}

export async function updateProfileBinanceSettings(id: string, input: unknown) {
  const json = patchProfileSchema.parse(input);
  const hasApiKeyField = json.apiKey !== undefined;
  const hasApiSecretField = json.apiSecret !== undefined;
  const apiKey = json.apiKey;
  const apiSecret = json.apiSecret;

  if (hasApiKeyField !== hasApiSecretField) {
    throw new ProfileBadRequestError("API key and secret must be updated together.");
  }

  const data: {
    binanceApiKeyEncrypted?: string | null;
    binanceApiSecretEncrypted?: string | null;
    binanceApiKeyPreview?: string | null;
  } = {};

  if (hasApiKeyField && hasApiSecretField) {
    if (apiKey === null && apiSecret === null) {
      data.binanceApiKeyEncrypted = null;
      data.binanceApiSecretEncrypted = null;
      data.binanceApiKeyPreview = null;
    } else if (typeof apiKey === "string" && typeof apiSecret === "string") {
      data.binanceApiKeyEncrypted = encryptSecret(apiKey);
      data.binanceApiSecretEncrypted = encryptSecret(apiSecret);
      data.binanceApiKeyPreview = makeBinanceApiKeyPreview(apiKey);
    } else {
      throw new ProfileBadRequestError("API key and secret must both be provided.");
    }
  }

  if (apiKey === null && apiSecret === null && json.deleteBalances === true) {
    await prisma.binanceBalance.deleteMany({ where: { userId: id } });
  }

  const user = await prisma.user.update({
    where: { id },
    data
  });

  return toSafeUser(user);
}
