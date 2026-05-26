import { NextResponse } from "next/server";

import { authGuardResponse, requireOwnedProfile } from "@/lib/auth-guard";
import { assertUserExists, getExistingFingerprints, markPreviewTransactions } from "@/lib/transaction-import";
import { parseTradeRepublicCsv } from "@/lib/trade-republic-csv-parser";
import { parseBbvaXlsxStatement } from "@/lib/bbva-xlsx-parser";
import { apiLogger } from "@/lib/logger";

const log = apiLogger("Preview");

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const userId = formData.get("userId");
    const file = formData.get("file");

    log.request("POST", "/api/transactions/preview", {
      userId,
      fileName: file instanceof File ? file.name : null,
      fileSize: file instanceof File ? `${(file.size / 1024).toFixed(1)} KB` : null
    });

    if (typeof userId !== "string" || !userId) {
      log.response("POST", "/api/transactions/preview", 400, { error: "Utente non valido" });
      return NextResponse.json({ error: "Utente non valido." }, { status: 400 });
    }

    if (!(file instanceof File)) {
      log.response("POST", "/api/transactions/preview", 400, { error: "File mancante" });
      return NextResponse.json({ error: "File mancante." }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    let parsedDocument;

    if (fileName.endsWith(".csv")) {
      log.info(`Parsing CSV Trade Republic: "${file.name}"`);
      parsedDocument = await parseTradeRepublicCsv(file);
    } else if (fileName.endsWith(".xlsx")) {
      log.info(`Parsing XLSX BBVA: "${file.name}"`);
      parsedDocument = await parseBbvaXlsxStatement(file);
    } else {
      log.response("POST", "/api/transactions/preview", 400, { error: "Formato non supportato", fileName: file.name });
      return NextResponse.json({ error: "Formato file non supportato. Carica un CSV Trade Republic o un XLSX BBVA." }, { status: 400 });
    }

    await requireOwnedProfile(request, userId);
    await assertUserExists(userId);
    const existingFingerprints = await getExistingFingerprints(
      userId,
      parsedDocument.transactions.map((transaction) => transaction.fingerprint)
    );
    const transactions = markPreviewTransactions(parsedDocument.transactions, existingFingerprints);
    const newTransactions = transactions.filter((transaction) => transaction.status === "new").length;

    log.info(`Parsed ${transactions.length} transazioni (${newTransactions} nuove, ${transactions.length - newTransactions} esistenti)`);
    log.response("POST", "/api/transactions/preview", 200, {
      institution: parsedDocument.sourceInstitution,
      total: transactions.length,
      new: newTransactions,
      existing: transactions.length - newTransactions
    });

    return NextResponse.json({
      summary: {
        fileName: parsedDocument.fileName,
        sourceInstitution: parsedDocument.sourceInstitution,
        totalTransactions: transactions.length,
        newTransactions,
        existingTransactions: transactions.length - newTransactions
      },
      transactions
    });
  } catch (error) {
    const response = authGuardResponse(error);
    if (response) return response;

    log.error("POST", "/api/transactions/preview", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Errore durante il parsing del CSV."
      },
      { status: 400 }
    );
  }
}
