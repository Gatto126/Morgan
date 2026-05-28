import { NextRequest, NextResponse } from "next/server";
import { authGuardResponse, requireOwnedProfile } from "@/server/auth/auth-guard";
import { apiLogger } from "@/server/logging/logger";
import { getBinanceBalancesStatus } from "@/server/services/binance-sync";

const log = apiLogger("BinanceBalances");

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  log.request("GET", "/api/binance/balances", { userId });

  try {
    await requireOwnedProfile(request, userId);

    const { balances, syncedAt, isStale, hasApiKey } = await getBinanceBalancesStatus(userId);

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
