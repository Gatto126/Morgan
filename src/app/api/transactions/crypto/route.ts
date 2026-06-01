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
import { getTradeRepublicCryptoPortfolioSummaryData } from "@/server/services/portfolio-data";

const log = apiLogger("CryptoTransactions");
const endpoint = "/api/transactions/crypto";

export async function GET(request: NextRequest) {
  const trace = createPerformanceTrace("api.endpoint", { endpoint, method: "GET", stage: "crypto" });

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
    const { result, transactionCount } = await getCachedProfileData(
      makeProfileStageCacheKey("crypto", userId, version),
      () => getProfileStageSnapshot(
        "crypto",
        userId,
        snapshotVersion,
        () => getTradeRepublicCryptoPortfolioSummaryData(userId, { trace }),
        { dateKey, trace }
      ),
      {
        onMetric: (metric) => trace.addStep("profile.cache", metric.durationMs ?? 0, metric)
      }
    );
    const productCount = result.providers.reduce((acc, provider) => acc + provider.products.length, 0);

    log.response("GET", endpoint, 200, {
      providers: result.providers.length,
      transactions: transactionCount,
      products: productCount,
      monthlyPoints: result.monthlyData.length,
      dailyPoints: result.dailyData.length
    });
    trace.finish(log, {
      dailyPoints: result.dailyData.length,
      monthlyPoints: result.monthlyData.length,
      payloadBytes: getJsonSizeBytesIfTracing(trace, result),
      products: productCount,
      providers: result.providers.length,
      status: 200,
      transactions: transactionCount
    });

    return privateJson(result, { maxAgeSeconds: 60, staleWhileRevalidateSeconds: 300 });
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
