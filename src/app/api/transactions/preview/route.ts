import { NextResponse } from "next/server";

import { authGuardResponse, requireAuth, requireOwnedProfile } from "@/server/auth/auth-guard";
import {
  assertUserExists,
  getExistingFingerprints,
  markPreviewTransactions
} from "@/server/services/transaction-import";
import { parseTradeRepublicCsv } from "@/domain/imports/trade-republic-csv-parser";
import { BbvaXlsxParseError, parseBbvaXlsxStatement } from "@/domain/imports/bbva-xlsx-parser";
import { apiLogger } from "@/server/logging/logger";
import {
  requestSecurityResponse,
  requireSameOriginMutation
} from "@/server/security/request-security";

const log = apiLogger("Preview");
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = [".csv", ".xlsx", ".excel"] as const;

export const runtime = "nodejs";

function getSupportedExtension(fileName: string) {
  const normalizedFileName = fileName.toLowerCase();
  return SUPPORTED_EXTENSIONS.find((extension) => normalizedFileName.endsWith(extension)) ?? null;
}

export async function POST(request: Request) {
  try {
    requireSameOriginMutation(request);
    await requireAuth(request);

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

    const fileExtension = getSupportedExtension(file.name);
    if (!fileExtension) {
      log.response("POST", "/api/transactions/preview", 400, { error: "Formato non supportato", fileName: file.name });
      return NextResponse.json(
        { error: "Formato file non supportato. Carica un CSV Trade Republic o un XLSX/EXCEL BBVA." },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      log.response("POST", "/api/transactions/preview", 400, { error: "File vuoto", fileName: file.name });
      return NextResponse.json({ error: "Il file caricato e' vuoto." }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      log.response("POST", "/api/transactions/preview", 413, {
        error: "File troppo grande",
        fileName: file.name,
        fileSize: file.size
      });
      return NextResponse.json(
        { error: "File troppo grande. Carica un documento fino a 8 MB." },
        { status: 413 }
      );
    }

    await requireOwnedProfile(request, userId);
    await assertUserExists(userId);

    let parsedDocument;

    if (fileExtension === ".csv") {
      log.info(`Parsing CSV Trade Republic: "${file.name}"`);
      parsedDocument = await parseTradeRepublicCsv(file);
    } else {
      log.info(`Parsing XLSX BBVA: "${file.name}"`);
      parsedDocument = await parseBbvaXlsxStatement(file);
    }

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

    const securityResponse = requestSecurityResponse(error);
    if (securityResponse) return securityResponse;

    if (error instanceof BbvaXlsxParseError) {
      log.response("POST", "/api/transactions/preview", 400, { error: error.message });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    log.error("POST", "/api/transactions/preview", error);
    return NextResponse.json(
      {
        error: "Documento non leggibile o formato non supportato."
      },
      { status: 400 }
    );
  }
}
