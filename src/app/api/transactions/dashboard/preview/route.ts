import { NextRequest, NextResponse } from "next/server";

import { privateJson } from "@/server/api/cache-control";
import { internalServerErrorResponse } from "@/server/api/error-response";
import { authGuardResponse, requireOwnedProfile } from "@/server/auth/auth-guard";
import { apiLogger } from "@/server/logging/logger";
import {
  createPerformanceTrace,
  getJsonSizeBytesIfTracing,
  measurePerformanceStep
} from "@/server/logging/performance";
import { getDashboardData } from "@/server/services/dashboard-data";
import { getCachedProfileData, makeProfileStageCacheKey } from "@/server/services/profile-data-cache";
import {
  getProfileStageSnapshot,
  parseProfileStageSnapshotVersion
} from "@/server/services/profile-stage-snapshot";
import { toDashboardPreviewData } from "@/shared/dashboard-preview-data";

const log = apiLogger("DashboardPreview");
const endpoint = "/api/transactions/dashboard/preview";

export async function GET(request: NextRequest) {
  const trace = createPerformanceTrace("api.endpoint", { endpoint, method: "GET", stage: "dashboard-preview" });

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
    const snapshotVersion = parseProfileStageSnapshotVersion(version);
    const dateKey = request.nextUrl.searchParams.get("d") ?? undefined;
    const previewData = await getCachedProfileData(
      makeProfileStageCacheKey("dashboard-preview", userId, version),
      async () => {
        const dashboardData = await getProfileStageSnapshot(
          "dashboard",
          userId,
          snapshotVersion,
          () => getDashboardData(userId, undefined, new Date(), trace),
          { dateKey, trace }
        );

        return toDashboardPreviewData(dashboardData);
      },
      {
        onMetric: (metric) => trace.addStep("profile.cache", metric.durationMs ?? 0, metric)
      }
    );

    log.response("GET", endpoint, 200, {
      providers: previewData.providerSummaries.length,
      monthlyPoints: previewData.monthlyData.length,
      dailyPoints: previewData.dailyData.length
    });
    trace.finish(log, {
      dailyPoints: previewData.dailyData.length,
      monthlyPoints: previewData.monthlyData.length,
      payloadBytes: getJsonSizeBytesIfTracing(trace, previewData),
      providers: previewData.providerSummaries.length,
      status: 200
    });

    return privateJson(previewData, { maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300 });
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) {
      trace.finish(log, { status: response.status });
      return response;
    }

    log.error("GET", endpoint, error);
    trace.finish(log, { failed: true, status: 500 });
    return internalServerErrorResponse("Errore durante il caricamento della preview.");
  }
}
