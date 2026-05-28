import { NextRequest, NextResponse } from "next/server";

import { authGuardResponse, requireOwnedProfile } from "@/server/auth/auth-guard";
import { apiLogger } from "@/server/logging/logger";
import { getDashboardData } from "@/server/services/dashboard-data";

const log = apiLogger("Dashboard");

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    log.request("GET", "/api/transactions/dashboard", { userId });

    if (!userId) {
      log.response("GET", "/api/transactions/dashboard", 400, { error: "userId mancante" });
      return NextResponse.json({ error: "userId richiesto." }, { status: 400 });
    }

    await requireOwnedProfile(request, userId);

    const dashboardData = await getDashboardData(userId);

    log.response("GET", "/api/transactions/dashboard", 200, {
      providers: dashboardData.providerSummaries.length,
      monthlyPoints: dashboardData.monthlyData.length,
      dailyPoints: dashboardData.dailyData.length
    });

    return NextResponse.json(dashboardData);
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) return response;

    log.error("GET", "/api/transactions/dashboard", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Errore durante il caricamento." },
      { status: 500 }
    );
  }
}
