import { NextRequest, NextResponse } from "next/server";

import { authGuardResponse, requireOwnedProfile } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { apiLogger } from "@/lib/logger";
import { buildPortfolioTimeSeries, getPortfolioPriceKeys, type PortfolioTransaction } from "@/lib/portfolio-timeseries";

const log = apiLogger("CryptoTransactions");

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("userId");
    log.request("GET", "/api/transactions/crypto", { userId });

    if (!userId) {
      log.response("GET", "/api/transactions/crypto", 400, { error: "userId mancante" });
      return NextResponse.json({ error: "userId richiesto." }, { status: 400 });
    }

    await requireOwnedProfile(request, userId);

    const dbTransactions = await prisma.cryptoTransaction.findMany({
      where: {
        userId,
        sourceInstitution: "trade_republic"
      },
      orderBy: { bookingDate: "desc" }
    });
    const transactions: PortfolioTransaction[] = dbTransactions.map((transaction) => ({
      id: transaction.id,
      sourceInstitution: transaction.sourceInstitution,
      bookingDate: transaction.bookingDate,
      typeLabel: transaction.typeLabel,
      description: transaction.description,
      direction: transaction.direction,
      amountCents: transaction.amountCents,
      tradeType: transaction.typeLabel === "BUY" || transaction.typeLabel === "SELL"
        ? (transaction.description.toLowerCase().includes("savings plan") ? "savings_plan" : "buy_trade")
        : null,
      productName: transaction.tokenName,
      isin: transaction.tokenSymbol,
      quantityUnits: transaction.quantityUnits
    }));
    const priceKeys = getPortfolioPriceKeys(transactions);
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

    log.response("GET", "/api/transactions/crypto", 200, {
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

    log.error("GET", "/api/transactions/crypto", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Errore durante il caricamento." },
      { status: 500 }
    );
  }
}
