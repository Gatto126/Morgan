import { NextRequest, NextResponse } from "next/server";

import { authGuardResponse, requireOwnedProfile } from "@/server/auth/auth-guard";
import { internalServerErrorResponse } from "@/server/api/error-response";
import { apiLogger } from "@/server/logging/logger";
import { getTradeRepublicCryptoPortfolioSummaryData } from "@/server/services/portfolio-data";

const log = apiLogger("CryptoTransactions");

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    log.request("GET", "/api/transactions/crypto", { userId });

    if (!userId) {
      log.response("GET", "/api/transactions/crypto", 400, { error: "userId mancante" });
      return NextResponse.json({ error: "userId richiesto." }, { status: 400 });
    }

    await requireOwnedProfile(request, userId);

    const { result, transactionCount } = await getTradeRepublicCryptoPortfolioSummaryData(userId);

    log.response("GET", "/api/transactions/crypto", 200, {
      providers: result.providers.length,
      transactions: transactionCount,
      products: result.providers.reduce((acc, provider) => acc + provider.products.length, 0),
      monthlyPoints: result.monthlyData.length,
      dailyPoints: result.dailyData.length
    });

    return NextResponse.json(result);
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) return response;

    log.error("GET", "/api/transactions/crypto", error);
    return internalServerErrorResponse("Errore durante il caricamento.");
  }
}
