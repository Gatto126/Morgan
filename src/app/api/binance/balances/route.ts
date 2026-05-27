import { NextRequest, NextResponse } from "next/server";
import { authGuardResponse, requireOwnedProfile } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { apiLogger } from "@/lib/logger";
import { hasBinanceCredentials } from "@/lib/secrets";

const log = apiLogger("BinanceBalances");

const STALE_MS = 10 * 60 * 1000; // 10 minutes

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  log.request("GET", "/api/binance/balances", { userId });

  try {
    await requireOwnedProfile(request, userId);

    const [balances, syncCache, user] = await Promise.all([
      prisma.binanceBalance.findMany({
        where: { userId },
        orderBy: { eurValue: "desc" },
      }),
      prisma.priceCache.findUnique({ where: { key: `binance_sync_${userId}` } }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          binanceApiKeyEncrypted: true,
          binanceApiSecretEncrypted: true,
        },
      }),
    ]);

    const hasApiKey = hasBinanceCredentials(user);
    const syncedAt = syncCache?.timestamp ?? null;
    const isStale = !syncedAt || Date.now() - syncedAt.getTime() > STALE_MS;

    log.response("GET", "/api/binance/balances", 200, {
      count: balances.length,
      isStale,
      hasApiKey,
    });

    return NextResponse.json({
      balances,
      syncedAt: syncedAt?.toISOString() ?? null,
      isStale,
      hasApiKey,
    });
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) return response;

    log.error("GET", "/api/binance/balances", error);
    return NextResponse.json({ error: "Errore nel recupero dei saldi." }, { status: 500 });
  }
}
