import { NextResponse } from "next/server";

import { authGuardResponse, requireOwnedProfile } from "@/server/auth/auth-guard";
import { apiLogger } from "@/server/logging/logger";
import { marketDataRepository } from "@/server/repositories/market-data-repository";

const log = apiLogger("AssetHistoryAPI");

export async function GET(
  request: Request,
  { params }: { params: Promise<{ isin: string }> }
) {
  try {
    const isin = (await params).isin;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId")?.trim();
    const currency = searchParams.get("currency") || "EUR";

    if (!userId) {
      return NextResponse.json({ error: "Profile id is required." }, { status: 400 });
    }

    await requireOwnedProfile(request, userId);

    const profileHasAsset = await marketDataRepository.profileHasMarketKey(userId, isin);
    if (!profileHasAsset) {
      return NextResponse.json({ error: "Asset history not found." }, { status: 404 });
    }

    log.info(`Fetching asset history for ${isin} (currency: ${currency}, profile: ${userId})`);

    const history = await marketDataRepository.listAssetHistorySeries(isin, currency);

    return NextResponse.json({
      isin,
      currency,
      count: history.length,
      series: history
    });
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) return response;

    log.error("GET", `/api/assets/[isin]/history`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
