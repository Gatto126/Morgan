import { NextRequest, NextResponse } from "next/server";

import { authGuardResponse, requireOwnedProfile } from "@/server/auth/auth-guard";
import { apiLogger } from "@/server/logging/logger";
import { buildPortfolioTimeSeries, getPortfolioPriceKeys } from "@/domain/finance/portfolio-timeseries";
import { marketDataRepository } from "@/server/repositories/market-data-repository";
import {
  toCryptoPortfolioTransaction,
  transactionReadRepository
} from "@/server/repositories/transaction-read-repository";

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

    const dbTransactions = await transactionReadRepository.listTradeRepublicCryptoTransactions(userId);
    const transactions = dbTransactions.map(toCryptoPortfolioTransaction);
    const priceKeys = getPortfolioPriceKeys(transactions);
    const historyPrices = await marketDataRepository.listPortfolioHistory(priceKeys);

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
