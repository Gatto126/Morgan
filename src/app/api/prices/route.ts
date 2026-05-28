import { NextRequest, NextResponse } from "next/server";
import { authGuardResponse, requireAuth } from "@/server/auth/auth-guard";
import { apiLogger } from "@/server/logging/logger";
import { parsePriceRequestParams, PriceRequestValidationError } from "@/domain/pricing/price-request";
import { priceRefreshService } from "@/server/services/price-refresh";

const log = apiLogger("Prices");

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth(request);
    const retryAfterMs = priceRefreshService.getRetryAfterMs(session.user.id);
    if (retryAfterMs !== null) {
      log.response("GET", "/api/prices", 429, { retryAfterMs });
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
    log.request("GET", "/api/prices", { isinCount: isins.length, cryptoCount: cryptos.length });
    const prices = await priceRefreshService.fetchPrices({ isins, cryptos });

    log.response("GET", "/api/prices", 200, { keyCount: Object.keys(prices).length });
    return NextResponse.json(prices);
  } catch (error) {
    if (error instanceof PriceRequestValidationError) {
      log.response("GET", "/api/prices", error.status, { error: error.message });
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const response = authGuardResponse(error);
    if (response) return response;

    log.error("GET", "/api/prices", error);
    return NextResponse.json(
      { error: "Error fetching prices." },
      { status: 500 }
    );
  }
}
