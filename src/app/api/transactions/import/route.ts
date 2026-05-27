import { NextResponse } from "next/server";
import { z } from "zod";

import { authGuardResponse, requireOwnedProfile } from "@/lib/auth-guard";
import { assertUserExists, importPreviewTransactions, previewTransactionSchema } from "@/lib/transaction-import";
import { apiLogger } from "@/lib/logger";
import {
  requestSecurityResponse,
  requireSameOriginMutation
} from "@/lib/request-security";

const log = apiLogger("Import");

const importTransactionsSchema = z.object({
  userId: z.string().min(1),
  statementFileName: z.string().trim().min(1).max(255).optional(),
  transactions: z.array(previewTransactionSchema).min(1)
});

export async function POST(request: Request) {
  try {
    requireSameOriginMutation(request);
    const payload = importTransactionsSchema.parse(await request.json());

    log.request("POST", "/api/transactions/import", {
      userId: payload.userId,
      statementFileName: payload.statementFileName ?? "(nessuno)",
      transactionCount: payload.transactions.length
    });

    await requireOwnedProfile(request, payload.userId);
    await assertUserExists(payload.userId);

    const result = await importPreviewTransactions(payload.userId, payload.transactions, payload.statementFileName);

    log.info(`Importate ${result.insertedCount} transazioni, ${result.skippedCount} duplicate saltate`);
    log.response("POST", "/api/transactions/import", 201, {
      inserted: result.insertedCount,
      skipped: result.skippedCount
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) return response;

    const securityResponse = requestSecurityResponse(error);
    if (securityResponse) return securityResponse;

    if (error instanceof z.ZodError) {
      log.response("POST", "/api/transactions/import", 400, { validation: error.issues[0]?.message });
      return NextResponse.json({ error: error.issues[0]?.message ?? "Payload non valido." }, { status: 400 });
    }

    log.error("POST", "/api/transactions/import", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Errore durante il salvataggio delle transazioni." },
      { status: 400 }
    );
  }
}
