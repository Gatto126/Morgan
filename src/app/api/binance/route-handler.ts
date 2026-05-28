import { NextResponse } from "next/server";

import { authGuardResponse, requireOwnedProfile } from "@/server/auth/auth-guard";
import { BinanceApiError } from "@/integrations/binance/binance-service";
import type { apiLogger } from "@/server/logging/logger";
import {
  requestSecurityResponse,
  requireSameOriginMutation
} from "@/server/security/request-security";
import {
  BinanceMissingCredentialsError,
  syncBinanceProfile
} from "@/server/services/binance-sync";

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
  let userId: string | undefined;

  try {
    requireSameOriginMutation(request);
  } catch (error) {
    const securityResponse = requestSecurityResponse(error);
    if (securityResponse) return securityResponse;
    throw error;
  }

  try {
    const body = (await request.json()) as { userId?: string };
    userId = body.userId;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  log.request("POST", endpoint, { userId });

  try {
    await requireOwnedProfile(request, userId);

    const { balances, syncedAt } = await syncBinanceProfile(userId);

    log.response("POST", endpoint, 200, { tokensFound: balances.length });

    return NextResponse.json({
      success: true,
      balances,
      syncedAt: syncedAt.toISOString(),
    });
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) return response;

    const securityResponse = requestSecurityResponse(error);
    if (securityResponse) return securityResponse;

    if (error instanceof BinanceMissingCredentialsError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof BinanceApiError) {
      if (logBinanceApiError) {
        log.info(`Binance account fetch failed: ${error.message}`);
      }
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    log.error("POST", endpoint, error);
    return NextResponse.json({ error: genericError }, { status: 500 });
  }
}
