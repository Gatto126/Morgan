import { NextResponse } from "next/server";

import { authGuardResponse, requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { apiLogger } from "@/lib/logger";

const log = apiLogger("Account");

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0)));
}

export async function DELETE(request: Request) {
  log.request("DELETE", "/api/account");

  try {
    const session = await requireAuth(request);
    const ownerId = session.user.id;
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

    log.error("DELETE", "/api/account", error);
    return NextResponse.json({ error: "Errore durante l'eliminazione dell'account." }, { status: 500 });
  }
}
