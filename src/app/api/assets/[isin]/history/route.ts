import { NextResponse } from "next/server";
import { authGuardResponse, requireAuth } from "@/server/auth/auth-guard";
import { prisma } from "@/server/db/prisma";
import { apiLogger } from "@/server/logging/logger";

const log = apiLogger("AssetHistoryAPI");

export async function GET(
  request: Request,
  { params }: { params: Promise<{ isin: string }> }
) {
  try {
    await requireAuth(request);
    const isin = (await params).isin;
    const { searchParams } = new URL(request.url);
    const currency = searchParams.get("currency") || "EUR";

    log.info(`Fetching asset history for ${isin} (currency: ${currency})`);

    const history = await prisma.assetHistory.findMany({
      where: {
        isin,
        currency,
      },
      orderBy: {
        date: "asc",
      },
      select: {
        date: true,
        value: true,
      },
    });

    return NextResponse.json({
      isin,
      currency,
      count: history.length,
      series: history,
    });
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) return response;

    log.error("GET", `/api/assets/[isin]/history`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
