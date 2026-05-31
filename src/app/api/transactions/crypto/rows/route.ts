import { NextRequest } from "next/server";

import { internalServerErrorResponse } from "@/server/api/error-response";
import { parseTransactionRowsQuery, transactionRowsJson } from "@/server/api/transaction-rows";
import { authGuardResponse, requireOwnedProfile } from "@/server/auth/auth-guard";
import { apiLogger } from "@/server/logging/logger";
import {
  createPerformanceTrace,
  getJsonSizeBytesIfTracing,
  measurePerformanceStep
} from "@/server/logging/performance";
import { getTradeRepublicCryptoPortfolioTransactionRows } from "@/server/services/portfolio-data";

const log = apiLogger("CryptoRows");
const endpoint = "/api/transactions/crypto/rows";

export async function GET(request: NextRequest) {
  const trace = createPerformanceTrace("api.endpoint", { endpoint, method: "GET", stage: "crypto-rows" });

  try {
    const query = parseTransactionRowsQuery(request);
    if (!query.ok) {
      trace.finish(log, { status: query.response.status });
      return query.response;
    }
    const { query: rowsQuery } = query;

    log.request("GET", endpoint, {
      limit: rowsQuery.limit,
      offset: rowsQuery.offset,
      provider: rowsQuery.sourceInstitution,
      userId: rowsQuery.userId
    });

    await measurePerformanceStep(trace, "auth.requireOwnedProfile", () => requireOwnedProfile(request, rowsQuery.userId));

    const { total, transactions } = await measurePerformanceStep(
      trace,
      "crypto.repository.listTransactionRows",
      () => getTradeRepublicCryptoPortfolioTransactionRows(
        rowsQuery.userId,
        rowsQuery.sourceInstitution,
        rowsQuery
      ),
      (result) => ({ returned: result.transactions.length, total: result.total })
    );

    log.response("GET", endpoint, 200, {
      returned: transactions.length,
      total
    });
    trace.finish(log, {
      limit: rowsQuery.limit,
      offset: rowsQuery.offset,
      payloadBytes: getJsonSizeBytesIfTracing(trace, { total, transactions }),
      returned: transactions.length,
      status: 200,
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
    if (response) {
      trace.finish(log, { status: response.status });
      return response;
    }

    log.error("GET", endpoint, error);
    trace.finish(log, { failed: true, status: 500 });
    return internalServerErrorResponse("Errore durante il caricamento delle transazioni.");
  }
}
