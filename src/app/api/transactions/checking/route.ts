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
import {
  getProfileStageSnapshot,
  parseProfileStageSnapshotVersion
} from "@/server/services/profile-stage-snapshot";
import { getCheckingSummaryData } from "@/server/services/checking-data";

const log = apiLogger("Checking");
const endpoint = "/api/transactions/checking";

export async function GET(request: NextRequest) {
  const trace = createPerformanceTrace("api.endpoint", { endpoint, method: "GET", stage: "checking" });

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
    const checkingData = await getCachedProfileData(
      makeProfileStageCacheKey("checking", userId, version),
      () => getProfileStageSnapshot(
        "checking",
        userId,
        snapshotVersion,
        () => getCheckingSummaryData(userId, undefined, new Date(), trace),
        { dateKey, trace }
      ),
      {
        onMetric: (metric) => trace.addStep("profile.cache", metric.durationMs ?? 0, metric)
      }
    );

    const transactionCount = checkingData.providers.reduce((count, provider) => count + provider.transactionCount, 0);

    log.response("GET", endpoint, 200, {
      providers: checkingData.providers.length,
      transactions: transactionCount,
      monthlyPoints: checkingData.monthlyData.length,
      dailyPoints: checkingData.dailyData.length
    });
    trace.finish(log, {
      dailyPoints: checkingData.dailyData.length,
      monthlyPoints: checkingData.monthlyData.length,
      payloadBytes: getJsonSizeBytesIfTracing(trace, checkingData),
      providers: checkingData.providers.length,
      status: 200,
      transactions: transactionCount
    });

    return privateJson(checkingData, { maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300 });
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
