import { NextRequest, NextResponse } from "next/server";
import { authGuardResponse, requireAuth } from "@/server/auth/auth-guard";
import { privateNoStoreJson } from "@/server/api/cache-control";
import { internalServerErrorResponse } from "@/server/api/error-response";
import { apiLogger } from "@/server/logging/logger";
import {
  createPerformanceTrace,
  getJsonSizeBytesIfTracing,
  measurePerformanceStep
} from "@/server/logging/performance";
import { parsePriceRequestParams, PriceRequestValidationError } from "@/domain/pricing/price-request";
import { priceRefreshService } from "@/server/services/price-refresh";

const log = apiLogger("Prices");
const endpoint = "/api/prices";

export async function GET(request: NextRequest) {
  const trace = createPerformanceTrace("api.endpoint", { endpoint, method: "GET", stage: "prices" });

  try {
    const session = await measurePerformanceStep(trace, "auth.requireAuth", () => requireAuth(request));
    const retryAfterMs = await measurePerformanceStep(
      trace,
      "prices.rateLimit.getRetryAfterMs",
      () => priceRefreshService.getRetryAfterMs(session.user.id)
    );
    if (retryAfterMs !== null) {
      log.response("GET", endpoint, 429, { retryAfterMs });
      trace.finish(log, { retryAfterMs, status: 429 });
      return NextResponse.json(
        { error: "Too many price refresh requests. Please wait before retrying." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000)))
          }
        }
      );
    }

    const { isins, cryptos } = parsePriceRequestParams(request.nextUrl.searchParams);
    log.request("GET", endpoint, { isinCount: isins.length, cryptoCount: cryptos.length });
    const prices = await priceRefreshService.fetchPrices(
      { isins, cryptos },
      { includeHistoricalFallback: false, trace }
    );

    log.response("GET", endpoint, 200, { keyCount: Object.keys(prices).length });
    trace.finish(log, {
      cryptoCount: cryptos.length,
      isinCount: isins.length,
      keyCount: Object.keys(prices).length,
      payloadBytes: getJsonSizeBytesIfTracing(trace, prices),
      status: 200
    });
    return privateNoStoreJson(prices);
  } catch (error) {
    if (error instanceof PriceRequestValidationError) {
      log.response("GET", endpoint, error.status, { error: error.message });
      trace.finish(log, { status: error.status });
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const response = authGuardResponse(error);
    if (response) {
      trace.finish(log, { status: response.status });
      return response;
    }

    log.error("GET", endpoint, error);
    trace.finish(log, { failed: true, status: 500 });
    return internalServerErrorResponse("Error fetching prices.");
  }
}
