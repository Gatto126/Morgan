import { privateNoStoreJson } from "@/server/api/cache-control";
import { apiLogger } from "@/server/logging/logger";
import {
  createPerformanceTrace,
  getJsonSizeBytesIfTracing
} from "@/server/logging/performance";
import { createBinanceDailySnapshotsForAllProfiles } from "@/server/services/binance-daily-snapshot";

const log = apiLogger("BinanceDailySnapshotCron");

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return "missing-secret" as const;
  }

  return request.headers.get("authorization") === `Bearer ${cronSecret}`
    ? "authorized"
    : "unauthorized";
}

export async function GET(request: Request) {
  const endpoint = "/api/cron/binance-daily-snapshot";
  const trace = createPerformanceTrace("api.endpoint", {
    endpoint,
    method: "GET",
    stage: "binance-daily-snapshot"
  });
  const authorization = isAuthorized(request);

  if (authorization === "missing-secret") {
    trace.finish(log, { status: 503 });
    return privateNoStoreJson(
      { error: "CRON_SECRET is not configured." },
      { status: 503 }
    );
  }

  if (authorization === "unauthorized") {
    trace.finish(log, { status: 401 });
    return privateNoStoreJson(
      { error: "Unauthorized." },
      { status: 401 }
    );
  }

  log.request("GET", endpoint);

  try {
    const result = await createBinanceDailySnapshotsForAllProfiles({ trace });
    const payload = {
      ok: result.failed === 0,
      ...result
    };

    log.response("GET", endpoint, 200, {
      created: result.created,
      failed: result.failed,
      profiles: result.totalProfiles,
      skippedExisting: result.skippedExisting
    });
    trace.finish(log, {
      created: result.created,
      failed: result.failed,
      payloadBytes: getJsonSizeBytesIfTracing(trace, payload),
      profiles: result.totalProfiles,
      status: 200
    });

    return privateNoStoreJson(payload);
  } catch (error) {
    log.error("GET", endpoint, error);
    trace.finish(log, { failed: true, status: 500 });

    return privateNoStoreJson(
      { error: "Errore durante lo snapshot giornaliero Binance." },
      { status: 500 }
    );
  }
}
