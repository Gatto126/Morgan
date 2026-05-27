import { NextResponse } from "next/server";
import { verifyPassword } from "better-auth/crypto";

import { authGuardResponse, requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { hasLocalPasswordInput } from "@/lib/local-auth";
import { apiLogger } from "@/lib/logger";
import {
  requestSecurityResponse,
  requireSameOriginMutation
} from "@/lib/request-security";

const log = apiLogger("Account");
const DELETE_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DELETE_RATE_LIMIT_MAX_FAILURES = 5;
const deleteFailureBuckets = new Map<string, number[]>();

class AccountDeleteValidationError extends Error {
  constructor(
    public status: 400 | 422,
    message: string
  ) {
    super(message);
    this.name = "AccountDeleteValidationError";
  }
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0)));
}

async function parseAccountDeletePassword(request: Request) {
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

async function verifyAccountDeletePassword(ownerId: string, password: string) {
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

function getAccountDeleteRetryAfterMs(userId: string) {
  const now = Date.now();
  const bucket = (deleteFailureBuckets.get(userId) ?? []).filter(
    (timestamp) => now - timestamp < DELETE_RATE_LIMIT_WINDOW_MS
  );

  if (bucket.length >= DELETE_RATE_LIMIT_MAX_FAILURES) {
    deleteFailureBuckets.set(userId, bucket);
    return DELETE_RATE_LIMIT_WINDOW_MS - (now - bucket[0]);
  }

  bucket.push(now);
  deleteFailureBuckets.set(userId, bucket);
  return null;
}

function clearAccountDeleteFailures(userId: string) {
  deleteFailureBuckets.delete(userId);
}

function validationResponse(error: AccountDeleteValidationError, ownerId: string) {
  const retryAfterMs = getAccountDeleteRetryAfterMs(ownerId);
  if (retryAfterMs !== null) {
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
    return NextResponse.json(
      { error: "Too many failed account deletion attempts." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSeconds) }
      }
    );
  }

  return NextResponse.json({ error: error.message }, { status: error.status });
}

export async function DELETE(request: Request) {
  log.request("DELETE", "/api/account");

  try {
    const session = await requireAuth(request);
    const ownerId = session.user.id;
    requireSameOriginMutation(request);

    try {
      const password = await parseAccountDeletePassword(request);
      const isPasswordValid = await verifyAccountDeletePassword(ownerId, password);
      if (!isPasswordValid) {
        throw new AccountDeleteValidationError(422, "Password confirmation is invalid.");
      }
    } catch (error) {
      if (error instanceof AccountDeleteValidationError) {
        return validationResponse(error, ownerId);
      }

      throw error;
    }

    clearAccountDeleteFailures(ownerId);

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

    log.response("DELETE", "/api/account", 200, {
      success: true,
      deletedProfiles: profileIds.length,
      cleanupMode: result.cleanupMode
    });

    return NextResponse.json({
      success: true,
      deletedProfiles: profileIds.length,
      ...result
    });
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) return response;

    const securityResponse = requestSecurityResponse(error);
    if (securityResponse) return securityResponse;

    log.error("DELETE", "/api/account", error);
    return NextResponse.json({ error: "Errore durante l'eliminazione dell'account." }, { status: 500 });
  }
}
