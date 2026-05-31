import { NextRequest, NextResponse } from "next/server";
import { privateJson } from "@/server/api/cache-control";
import { authGuardResponse, requireOwnedProfile } from "@/server/auth/auth-guard";
import { apiLogger } from "@/server/logging/logger";
import {
  createPerformanceTrace,
  getJsonSizeBytesIfTracing,
  measurePerformanceStep
} from "@/server/logging/performance";
import { getCachedProfileData, makeProfileStageCacheKey } from "@/server/services/profile-data-cache";
import { getBinanceBalancesStatus } from "@/server/services/binance-sync";

const log = apiLogger("BinanceBalances");
const endpoint = "/api/binance/balances";

export async function GET(request: NextRequest) {
  const trace = createPerformanceTrace("api.endpoint", { endpoint, method: "GET", stage: "binance" });
  const userId = request.nextUrl.searchParams.get("userId");

  if (!userId) {
    trace.finish(log, { status: 400 });
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  log.request("GET", endpoint, { userId });

  try {
    await measurePerformanceStep(trace, "auth.requireOwnedProfile", () => requireOwnedProfile(request, userId));

    const version = request.nextUrl.searchParams.get("v");
    const payload = await getCachedProfileData(
      makeProfileStageCacheKey("binance", userId, version),
      () => getBinanceBalancesStatus(userId, { trace }),
      {
        onMetric: (metric) => trace.addStep("profile.cache", metric.durationMs ?? 0, metric),
        ttlMs: 30_000
      }
    );
    const { balances, syncedAt, isStale, hasApiKey } = payload;

    log.response("GET", endpoint, 200, {
      count: balances.length,
      isStale,
      hasApiKey,
    });
    trace.finish(log, {
      balances: balances.length,
      isStale,
      payloadBytes: getJsonSizeBytesIfTracing(trace, payload),
      status: 200
    });

    return privateJson({
      balances,
      syncedAt: syncedAt?.toISOString() ?? null,
      isStale,
      hasApiKey,
    }, { maxAgeSeconds: 30, staleWhileRevalidateSeconds: 120 });
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) {
      trace.finish(log, { status: response.status });
      return response;
    }

    log.error("GET", endpoint, error);
    trace.finish(log, { failed: true, status: 500 });
    return NextResponse.json({ error: "Errore nel recupero dei saldi." }, { status: 500 });
  }
}
