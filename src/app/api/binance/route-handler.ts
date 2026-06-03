import { NextResponse } from "next/server";

import { authGuardResponse, requireOwnedProfile } from "@/server/auth/auth-guard";
import { BinanceApiError } from "@/integrations/binance/binance-service";
import type { apiLogger } from "@/server/logging/logger";
import {
  createPerformanceTrace,
  getJsonSizeBytesIfTracing,
  measurePerformanceStep
} from "@/server/logging/performance";
import {
  requestSecurityResponse,
  requireSameOriginMutation
} from "@/server/security/request-security";
import {
  BinanceMissingCredentialsError,
  syncBinanceProfile
} from "@/server/services/binance-sync";
import { invalidateProfileDataCache } from "@/server/services/profile-data-cache";

type BinanceRouteLogger = ReturnType<typeof apiLogger>;

type BinanceSyncRouteOptions = {
  endpoint: "/api/binance/connect" | "/api/binance/sync";
  genericError: string;
  log: BinanceRouteLogger;
  logBinanceApiError?: boolean;
};

export async function handleBinanceSyncRoute(
  request: Request,
  options: BinanceSyncRouteOptions
) {
  const { endpoint, genericError, log, logBinanceApiError = false } = options;
  const trace = createPerformanceTrace("api.endpoint", { endpoint, method: "POST", stage: "binance-sync" });
  let userId: string | undefined;

  try {
    requireSameOriginMutation(request);
  } catch (error) {
    const securityResponse = requestSecurityResponse(error);
    if (securityResponse) {
      trace.finish(log, { status: securityResponse.status });
      return securityResponse;
    }
    throw error;
  }

  try {
    const body = (await request.json()) as { userId?: string };
    userId = body.userId;
  } catch {
    trace.finish(log, { status: 400 });
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!userId) {
    trace.finish(log, { status: 400 });
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  log.request("POST", endpoint, { userId });

  try {
    await measurePerformanceStep(trace, "auth.requireOwnedProfile", () => requireOwnedProfile(request, userId));

    const { balances, syncedAt } = await syncBinanceProfile(userId, { trace });
    invalidateProfileDataCache(userId);

    log.response("POST", endpoint, 200, { tokensFound: balances.length });
    const responsePayload = {
      success: true,
      balances,
      syncedAt: syncedAt.toISOString(),
    };
    trace.finish(log, {
      payloadBytes: getJsonSizeBytesIfTracing(trace, responsePayload),
      status: 200,
      tokensFound: balances.length
    });

    return NextResponse.json(responsePayload);
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) {
      trace.finish(log, { status: response.status });
      return response;
    }

    const securityResponse = requestSecurityResponse(error);
    if (securityResponse) {
      trace.finish(log, { status: securityResponse.status });
      return securityResponse;
    }

    if (error instanceof BinanceMissingCredentialsError) {
      trace.finish(log, { status: 400 });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof BinanceApiError) {
      if (logBinanceApiError) {
        log.info(`Binance account fetch failed: ${error.message}`);
      }
      trace.finish(log, { failed: true, status: error.status });
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    log.error("POST", endpoint, error);
    trace.finish(log, { failed: true, status: 500 });
    return NextResponse.json({ error: genericError }, { status: 500 });
  }
}
