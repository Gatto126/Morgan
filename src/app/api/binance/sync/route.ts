import { NextResponse } from "next/server";

import { authGuardResponse, requireOwnedProfile } from "@/lib/auth-guard";
import { BinanceApiError, syncBinanceBalances } from "@/lib/binance-service";
import { prisma } from "@/lib/db";
import { apiLogger } from "@/lib/logger";
import { decryptBinanceCredentials } from "@/lib/secrets";

const log = apiLogger("BinanceSync");

export async function POST(request: Request) {
  let userId: string | undefined;
  try {
    const body = (await request.json()) as { userId?: string };
    userId = body.userId;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  log.request("POST", "/api/binance/sync", { userId });

  try {
    await requireOwnedProfile(request, userId);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const credentials = decryptBinanceCredentials(user);
    if (!credentials) {
      return NextResponse.json({ error: "API key non configurata." }, { status: 400 });
    }

    const { balances, syncedAt } = await syncBinanceBalances(userId, credentials);

    log.response("POST", "/api/binance/sync", 200, { tokensFound: balances.length });
    return NextResponse.json({
      success: true,
      balances,
      syncedAt: syncedAt.toISOString(),
    });
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) return response;

    if (error instanceof BinanceApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    log.error("POST", "/api/binance/sync", error);
    return NextResponse.json(
      { error: "Errore di sincronizzazione Binance." },
      { status: 500 }
    );
  }
}
