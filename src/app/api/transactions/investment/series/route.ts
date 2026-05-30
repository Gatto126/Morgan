import { NextRequest, NextResponse } from "next/server";

import { internalServerErrorResponse } from "@/server/api/error-response";
import { authGuardResponse, requireOwnedProfile } from "@/server/auth/auth-guard";
import { apiLogger } from "@/server/logging/logger";
import { getInvestmentPortfolioSeriesData } from "@/server/services/portfolio-data";

const log = apiLogger("InvestmentSeries");

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    const provider = request.nextUrl.searchParams.get("provider");
    log.request("GET", "/api/transactions/investment/series", { provider, userId });

    if (!userId) {
      return NextResponse.json({ error: "userId richiesto." }, { status: 400 });
    }

    if (!provider) {
      return NextResponse.json({ error: "provider richiesto." }, { status: 400 });
    }

    await requireOwnedProfile(request, userId);

    const seriesData = await getInvestmentPortfolioSeriesData(userId, provider);

    log.response("GET", "/api/transactions/investment/series", 200, {
      dailyPoints: seriesData.dailyData.length,
      monthlyPoints: seriesData.monthlyData.length,
      provider
    });

    return NextResponse.json(seriesData);
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) return response;

    log.error("GET", "/api/transactions/investment/series", error);
    return internalServerErrorResponse("Errore durante il caricamento delle serie.");
  }
}
