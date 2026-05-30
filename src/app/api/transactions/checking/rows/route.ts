import { NextRequest } from "next/server";

import { internalServerErrorResponse } from "@/server/api/error-response";
import { parseTransactionRowsQuery, transactionRowsJson } from "@/server/api/transaction-rows";
import { authGuardResponse, requireOwnedProfile } from "@/server/auth/auth-guard";
import { apiLogger } from "@/server/logging/logger";
import { getCheckingTransactionRows } from "@/server/services/checking-data";

const log = apiLogger("CheckingRows");

export async function GET(request: NextRequest) {
  try {
    const query = parseTransactionRowsQuery(request);
    if (!query.ok) {
      return query.response;
    }
    const { query: rowsQuery } = query;

    log.request("GET", "/api/transactions/checking/rows", {
      limit: rowsQuery.limit,
      offset: rowsQuery.offset,
      provider: rowsQuery.sourceInstitution,
      userId: rowsQuery.userId
    });

    await requireOwnedProfile(request, rowsQuery.userId);

    const { total, transactions } = await getCheckingTransactionRows(
      rowsQuery.userId,
      rowsQuery.sourceInstitution,
      rowsQuery
    );

    log.response("GET", "/api/transactions/checking/rows", 200, {
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

    log.error("GET", "/api/transactions/checking/rows", error);
    return internalServerErrorResponse("Errore durante il caricamento delle transazioni.");
  }
}
