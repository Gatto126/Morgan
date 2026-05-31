import { NextRequest, NextResponse } from "next/server";

import { authGuardResponse, requireOwnedProfile } from "@/server/auth/auth-guard";
import { privateJson } from "@/server/api/cache-control";
import { internalServerErrorResponse } from "@/server/api/error-response";
import { apiLogger } from "@/server/logging/logger";
import {
  createPerformanceTrace,
  getJsonSizeBytesIfTracing,
  measurePerformanceStep
} from "@/server/logging/performance";
import { getCachedProfileData, makeProfileStageCacheKey } from "@/server/services/profile-data-cache";
import { getDashboardData } from "@/server/services/dashboard-data";

const log = apiLogger("Dashboard");
const endpoint = "/api/transactions/dashboard";

export async function GET(request: NextRequest) {
  const trace = createPerformanceTrace("api.endpoint", { endpoint, method: "GET", stage: "dashboard" });

  try {
    const userId = request.nextUrl.searchParams.get("userId");
    log.request("GET", endpoint, { userId });

    if (!userId) {
      log.response("GET", endpoint, 400, { error: "userId mancante" });
      trace.finish(log, { status: 400 });
      return NextResponse.json({ error: "userId richiesto." }, { status: 400 });
    }

    await measurePerformanceStep(trace, "auth.requireOwnedProfile", () => requireOwnedProfile(request, userId));

    const version = request.nextUrl.searchParams.get("v");
    const dashboardData = await getCachedProfileData(
      makeProfileStageCacheKey("dashboard", userId, version),
      () => getDashboardData(userId, undefined, new Date(), trace),
      {
        onMetric: (metric) => trace.addStep("profile.cache", metric.durationMs ?? 0, metric)
      }
    );

    log.response("GET", endpoint, 200, {
      providers: dashboardData.providerSummaries.length,
      monthlyPoints: dashboardData.monthlyData.length,
      dailyPoints: dashboardData.dailyData.length
    });
    trace.finish(log, {
      dailyPoints: dashboardData.dailyData.length,
      monthlyPoints: dashboardData.monthlyData.length,
      payloadBytes: getJsonSizeBytesIfTracing(trace, dashboardData),
      providers: dashboardData.providerSummaries.length,
      status: 200
    });

    return privateJson(dashboardData, { maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300 });
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) {
      trace.finish(log, { status: response.status });
      return response;
    }

    log.error("GET", endpoint, error);
    trace.finish(log, { failed: true, status: 500 });
    return internalServerErrorResponse("Errore durante il caricamento.");
  }
}
