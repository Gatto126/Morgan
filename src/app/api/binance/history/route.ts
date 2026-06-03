import { NextRequest, NextResponse } from "next/server";

import { privateJson } from "@/server/api/cache-control";
import { authGuardResponse, requireOwnedProfile } from "@/server/auth/auth-guard";
import { apiLogger } from "@/server/logging/logger";
import {
  createPerformanceTrace,
  getJsonSizeBytesIfTracing,
  measurePerformanceStep
} from "@/server/logging/performance";
import { getBinanceDailySnapshotHistory } from "@/server/services/binance-daily-snapshot";

const log = apiLogger("BinanceHistory");
const endpoint = "/api/binance/history";

export async function GET(request: NextRequest) {
  const trace = createPerformanceTrace("api.endpoint", { endpoint, method: "GET", stage: "binance-history" });
  const userId = request.nextUrl.searchParams.get("userId");

  if (!userId) {
    trace.finish(log, { status: 400 });
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  log.request("GET", endpoint, { userId });

  try {
    await measurePerformanceStep(trace, "auth.requireOwnedProfile", () => requireOwnedProfile(request, userId));

    const snapshots = await getBinanceDailySnapshotHistory(userId, { trace });
    const payload = {
      count: snapshots.length,
      snapshots
    };

    log.response("GET", endpoint, 200, { snapshots: snapshots.length });
    trace.finish(log, {
      payloadBytes: getJsonSizeBytesIfTracing(trace, payload),
      snapshots: snapshots.length,
      status: 200
    });

    return privateJson(payload, { maxAgeSeconds: 300, staleWhileRevalidateSeconds: 900 });
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) {
      trace.finish(log, { status: response.status });
      return response;
    }

    log.error("GET", endpoint, error);
    trace.finish(log, { failed: true, status: 500 });

    return NextResponse.json(
      { error: "Errore nel recupero dello storico Binance." },
      { status: 500 }
    );
  }
}
