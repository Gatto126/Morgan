import { NextRequest, NextResponse } from "next/server";

import { authGuardResponse, requireOwnedProfile } from "@/server/auth/auth-guard";
import { apiLogger } from "@/server/logging/logger";
import { buildPortfolioTimeSeries, getPortfolioPriceKeys } from "@/domain/finance/portfolio-timeseries";
import { marketDataRepository } from "@/server/repositories/market-data-repository";
import { transactionReadRepository } from "@/server/repositories/transaction-read-repository";

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

    const transactions = await transactionReadRepository.listInvestmentTransactions(userId);
    const priceKeys = getPortfolioPriceKeys(transactions, (isin) => isin.length === 12);
    const historyPrices = await marketDataRepository.listPortfolioHistory(priceKeys);

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
