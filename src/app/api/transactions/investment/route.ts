import { NextRequest, NextResponse } from "next/server";

import { authGuardResponse, requireOwnedProfile } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { apiLogger } from "@/lib/logger";
import { buildPortfolioTimeSeries, getPortfolioPriceKeys } from "@/lib/portfolio-timeseries";

const log = apiLogger("Investment");

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    log.request("GET", "/api/transactions/investment", { userId });

    if (!userId) {
      log.response("GET", "/api/transactions/investment", 400, { error: "userId mancante" });
      return NextResponse.json({ error: "userId richiesto." }, { status: 400 });
    }

    await requireOwnedProfile(request, userId);

    const transactions = await prisma.investmentTransaction.findMany({
      where: { userId },
      orderBy: { bookingDate: "desc" },
      select: {
        id: true,
        sourceInstitution: true,
        bookingDate: true,
        typeLabel: true,
        description: true,
        direction: true,
        amountCents: true,
        currency: true,
        tradeType: true,
        productName: true,
        isin: true,
        quantityUnits: true
      }
    });
    const priceKeys = getPortfolioPriceKeys(transactions, (isin) => isin.length === 12);
    const historyPrices = priceKeys.length > 0
      ? await prisma.assetHistory.findMany({
          where: {
            isin: { in: priceKeys },
            currency: "EUR"
          },
          select: {
            isin: true,
            date: true,
            value: true
          },
          orderBy: { date: "asc" }
        })
      : [];

    const result = buildPortfolioTimeSeries({
      transactions,
      historyPrices,
      priceKeys
    });

    log.response("GET", "/api/transactions/investment", 200, {
      providers: result.providers.length,
      transactions: transactions.length,
      products: result.providers.reduce((acc, provider) => acc + provider.products.length, 0),
      monthlyPoints: result.monthlyData.length,
      dailyPoints: result.dailyData.length
    });

    return NextResponse.json(result);
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) return response;

    log.error("GET", "/api/transactions/investment", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Errore durante il caricamento." },
      { status: 500 }
    );
  }
}
