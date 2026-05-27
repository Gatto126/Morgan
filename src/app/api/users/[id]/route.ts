import { NextResponse } from "next/server";

import { authGuardResponse, requireAuth, requireOwnedProfile } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { apiLogger } from "@/lib/logger";
import {
  requestSecurityResponse,
  requireSameOriginMutation
} from "@/lib/request-security";
import { encryptSecret, makeBinanceApiKeyPreview } from "@/lib/secrets";
import { toSafeUser } from "@/lib/user-response";
import { z } from "zod";

const log = apiLogger("Users");

const patchUserSchema = z.object({
  apiKey: z.string().trim().min(1).max(512).nullable().optional(),
  apiSecret: z.string().trim().min(1).max(512).nullable().optional(),
  deleteBalances: z.boolean().optional()
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  log.request("GET", `/api/users/${id}`);

  try {
    const session = await requireAuth(_request);
    const user = await prisma.user.findFirst({
      where: {
        id,
        ownerId: session.user.id
      }
    });

    if (!user) {
      log.response("GET", `/api/users/${id}`, 404, { error: "Profile not found" });
      return NextResponse.json({ error: "Profile not found." }, { status: 404 });
    }

    log.response("GET", `/api/users/${id}`, 200, { name: user.name });

    return NextResponse.json({ user: toSafeUser(user) });
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) return response;
    log.error("GET", `/api/users/${id}`, error);
    return NextResponse.json({ error: "Error while loading profile." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  log.request("DELETE", `/api/users/${id}`);

  try {
    requireSameOriginMutation(_request);
    await requireOwnedProfile(_request, id);

    // Clean global ETF/stock assets when no other profile still holds them.
    const userInvestments = await prisma.investmentTransaction.findMany({
      where: { userId: id },
      select: { isin: true }
    });
    const userIsins = Array.from(
      new Set(userInvestments.map((tx) => tx.isin).filter((isin): isin is string => !!isin))
    );

    const isinsToDelete: string[] = [];
    if (userIsins.length > 0) {
      const otherTransactions = await prisma.investmentTransaction.findMany({
        where: {
          userId: { not: id },
          isin: { in: userIsins }
        },
        select: { isin: true }
      });
      const otherIsins = new Set(otherTransactions.map((tx) => tx.isin));
      for (const isin of userIsins) {
        if (!otherIsins.has(isin)) {
          isinsToDelete.push(isin);
        }
      }
    }

    if (isinsToDelete.length > 0) {
      const deletedHistory = await prisma.assetHistory.deleteMany({
        where: {
          isin: { in: isinsToDelete }
        }
      });
      log.info(`Deleted ${deletedHistory.count} price history records`);

      const deletedAssets = await prisma.asset.deleteMany({
        where: {
          isin: { in: isinsToDelete }
        }
      });
      log.info(`Deleted ${deletedAssets.count} linked assets`);
    }

    // Clean global crypto assets when no other profile still holds them.
    const userCryptos = await prisma.cryptoTransaction.findMany({
      where: { userId: id },
      select: { tokenSymbol: true }
    });
    const userBinanceBalances = await prisma.binanceBalance.findMany({
      where: { userId: id },
      select: { tokenSymbol: true }
    });
    const userTokens = Array.from(
      new Set([
        ...userCryptos.map((tx) => tx.tokenSymbol),
        ...userBinanceBalances.map((balance) => balance.tokenSymbol)
      ].filter((token): token is string => !!token))
    );

    const tokensToDelete: string[] = [];
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
      const otherTokens = new Set([
        ...otherCryptoTransactions.map((tx) => tx.tokenSymbol),
        ...otherBinanceBalances.map((balance) => balance.tokenSymbol)
      ]);
      for (const token of userTokens) {
        if (!otherTokens.has(token)) {
          tokensToDelete.push(token);
        }
      }
    }

    if (tokensToDelete.length > 0) {
      const deletedCryptoHistory = await prisma.assetHistory.deleteMany({
        where: {
          isin: { in: tokensToDelete }
        }
      });
      log.info(`Deleted ${deletedCryptoHistory.count} crypto price history records`);

      const deletedCryptoAssets = await prisma.cryptoAsset.deleteMany({
        where: {
          tokenSymbol: { in: tokensToDelete }
        }
      });
      log.info(`Deleted ${deletedCryptoAssets.count} linked crypto assets`);
    }

    const priceCacheKeysToDelete = Array.from(new Set([
      ...isinsToDelete,
      ...tokensToDelete,
      `binance_sync_${id}`
    ]));

    if (priceCacheKeysToDelete.length > 0) {
      const deletedPriceCache = await prisma.priceCache.deleteMany({
        where: {
          key: { in: priceCacheKeysToDelete }
        }
      });
      log.info(`Deleted ${deletedPriceCache.count} linked price cache rows`);
    }

    // Delete the profile; related checking, investment, crypto and Binance rows cascade.
    await prisma.user.delete({
      where: { id }
    });

    log.response("DELETE", `/api/users/${id}`, 200, { success: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) return response;

    const securityResponse = requestSecurityResponse(error);
    if (securityResponse) return securityResponse;

    log.error("DELETE", `/api/users/${id}`, error);
    return NextResponse.json({ error: "Error while deleting profile." }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  log.request("PATCH", `/api/users/${id}`);

  try {
    requireSameOriginMutation(request);
    await requireOwnedProfile(request, id);
    const json = patchUserSchema.parse(await request.json());
    const hasApiKeyField = json.apiKey !== undefined;
    const hasApiSecretField = json.apiSecret !== undefined;
    const apiKey = json.apiKey;
    const apiSecret = json.apiSecret;
    const { deleteBalances } = json;

    if (hasApiKeyField !== hasApiSecretField) {
      return NextResponse.json({ error: "API key and secret must be updated together." }, { status: 400 });
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
        return NextResponse.json({ error: "API key and secret must both be provided." }, { status: 400 });
      }
    }

    // Only wipe cached balances when the caller explicitly requests it
    if (apiKey === null && apiSecret === null && deleteBalances === true) {
      await prisma.binanceBalance.deleteMany({ where: { userId: id } });
    }

    const user = await prisma.user.update({
      where: { id },
      data,
    });

    log.info(`Profile updated: "${user.name}" (id=${user.id})`);
    log.response("PATCH", `/api/users/${id}`, 200, { success: true });

    return NextResponse.json({
      user: toSafeUser(user)
    });
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) return response;

    const securityResponse = requestSecurityResponse(error);
    if (securityResponse) return securityResponse;

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
    }

    log.error("PATCH", `/api/users/${id}`, error);
    return NextResponse.json({ error: "Error while updating profile." }, { status: 500 });
  }
}
