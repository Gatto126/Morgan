import { NextRequest } from "next/server";

import { internalServerErrorResponse } from "@/server/api/error-response";
import { parseTransactionRowsQuery, transactionRowsJson } from "@/server/api/transaction-rows";
import { authGuardResponse, requireOwnedProfile } from "@/server/auth/auth-guard";
import { apiLogger } from "@/server/logging/logger";
import { getTradeRepublicCryptoPortfolioTransactionRows } from "@/server/services/portfolio-data";

const log = apiLogger("CryptoRows");

export async function GET(request: NextRequest) {
  try {
    const query = parseTransactionRowsQuery(request);
    if (!query.ok) {
      return query.response;
    }
    const { query: rowsQuery } = query;

    log.request("GET", "/api/transactions/crypto/rows", {
      limit: rowsQuery.limit,
      offset: rowsQuery.offset,
      provider: rowsQuery.sourceInstitution,
      userId: rowsQuery.userId
    });

    await requireOwnedProfile(request, rowsQuery.userId);

    const { total, transactions } = await getTradeRepublicCryptoPortfolioTransactionRows(
      rowsQuery.userId,
      rowsQuery.sourceInstitution,
      rowsQuery
    );

    log.response("GET", "/api/transactions/crypto/rows", 200, {
      returned: transactions.length,
      total
    });

    return transactionRowsJson({
      limit: rowsQuery.limit,
      offset: rowsQuery.offset,
      total,
      transactions
    });
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) return response;

    log.error("GET", "/api/transactions/crypto/rows", error);
    return internalServerErrorResponse("Errore durante il caricamento delle transazioni.");
  }
}
