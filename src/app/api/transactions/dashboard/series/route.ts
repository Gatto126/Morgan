import { NextRequest, NextResponse } from "next/server";

import { internalServerErrorResponse } from "@/server/api/error-response";
import { authGuardResponse, requireOwnedProfile } from "@/server/auth/auth-guard";
import { apiLogger } from "@/server/logging/logger";
import { getDashboardSeriesData, type DashboardSeriesTab } from "@/server/services/dashboard-data";

const log = apiLogger("DashboardSeries");
const seriesTabs = new Set<DashboardSeriesTab>(["checking", "investment", "crypto"]);

function parseSeriesTab(value: string | null): DashboardSeriesTab | null {
  if (!value || !seriesTabs.has(value as DashboardSeriesTab)) {
    return null;
  }

  return value as DashboardSeriesTab;
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    const series = parseSeriesTab(request.nextUrl.searchParams.get("series"));

    log.request("GET", "/api/transactions/dashboard/series", { series, userId });

    if (!userId) {
      log.response("GET", "/api/transactions/dashboard/series", 400, { error: "userId mancante" });
      return NextResponse.json({ error: "userId richiesto." }, { status: 400 });
    }

    if (!series) {
      log.response("GET", "/api/transactions/dashboard/series", 400, { error: "series non valida" });
      return NextResponse.json({ error: "series richiesta." }, { status: 400 });
    }

    await requireOwnedProfile(request, userId);

    const seriesData = await getDashboardSeriesData(userId, series);

    log.response("GET", "/api/transactions/dashboard/series", 200, {
      dailyPoints: seriesData.dailyData.length,
      monthlyPoints: seriesData.monthlyData.length,
      series
    });

    return NextResponse.json(seriesData);
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) return response;

    log.error("GET", "/api/transactions/dashboard/series", error);
    return internalServerErrorResponse("Errore durante il caricamento delle serie.");
  }
}
