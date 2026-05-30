import { NextRequest, NextResponse } from "next/server";
import { authGuardResponse, requireOwnedProfile } from "@/server/auth/auth-guard";
import { internalServerErrorResponse } from "@/server/api/error-response";
import { apiLogger } from "@/server/logging/logger";
import { getCheckingSummaryData } from "@/server/services/checking-data";

const log = apiLogger("Checking");

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    log.request("GET", "/api/transactions/checking", { userId });

    if (!userId) {
      log.response("GET", "/api/transactions/checking", 400, { error: "userId mancante" });
      return NextResponse.json({ error: "userId richiesto." }, { status: 400 });
    }

    await requireOwnedProfile(request, userId);

    const checkingData = await getCheckingSummaryData(userId);

    log.response("GET", "/api/transactions/checking", 200, {
      providers: checkingData.providers.length,
      transactions: checkingData.providers.reduce((count, provider) => count + provider.transactionCount, 0),
      monthlyPoints: checkingData.monthlyData.length,
      dailyPoints: checkingData.dailyData.length
    });

    return NextResponse.json(checkingData);
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) return response;

    log.error("GET", "/api/transactions/checking", error);
    return internalServerErrorResponse("Errore durante il caricamento.");
  }
}
