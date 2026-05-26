import crypto from "node:crypto";
// @ts-expect-error - xlsx/xlsx.mjs is not recognized by TS but works at runtime
import { read, set_fs, utils } from "xlsx/xlsx.mjs";
import * as fs from "node:fs";
import { BBVA_INSTITUTION } from "@/lib/institutions";

set_fs(fs);

export type ParsedBbvaTransaction = {
  fingerprint: string;
  sourceInstitution: typeof BBVA_INSTITUTION;
  pageNumber: number; // Row number in Excel
  bookingDate: string;
  rawDateLabel: string;
  typeLabel: string;
  description: string;
  direction: "IN" | "OUT";
  amountCents: number;
  balanceCents: number;
  currency: "EUR";
};

export type ParsedBbvaDocument = {
  sourceInstitution: typeof BBVA_INSTITUTION;
  fileName: string;
  transactions: ParsedBbvaTransaction[];
};

function parseItalianDate(dateStr: string): string {
  const parts = dateStr.split("/");
  if (parts.length !== 3) {
    throw new Error(`Formato data non riconosciuto: ${dateStr}`);
  }
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  return new Date(Date.UTC(year, month, day)).toISOString();
}

function buildFingerprint(transaction: Omit<ParsedBbvaTransaction, "fingerprint">) {
  const normalizedDescription = transaction.description.toLowerCase().replace(/\s+/g, " ").trim();

  return crypto
    .createHash("sha256")
    .update(
      [
        transaction.sourceInstitution,
        transaction.bookingDate,
        transaction.typeLabel.toLowerCase(),
        normalizedDescription,
        transaction.direction,
        String(transaction.amountCents),
        String(transaction.balanceCents),
        transaction.currency
      ].join("|")
    )
    .digest("hex");
}

export async function parseBbvaXlsxStatement(file: File): Promise<ParsedBbvaDocument> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = read(buffer); // Use read() for Buffers
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

  const transactions: ParsedBbvaTransaction[] = [];

  // Data rows start from index 5
  for (let i = 5; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 9 || !row[1]) continue;

    const bookingDateStr = String(row[1]);
    const typeLabel = String(row[2] || "");
    const amount = Number(row[4]);
    const balance = Number(row[6]);
    const description = String(row[8] || "");

    if (isNaN(amount) || isNaN(balance)) continue;

    const bookingDate = parseItalianDate(bookingDateStr);
    const amountCents = Math.round(Math.abs(amount) * 100);
    const balanceCents = Math.round(balance * 100);
    const direction = (amount >= 0 ? "IN" : "OUT") as "IN" | "OUT";

    const transactionWithoutFingerprint = {
      sourceInstitution: BBVA_INSTITUTION,
      pageNumber: i + 1,
      bookingDate,
      rawDateLabel: bookingDateStr,
      typeLabel,
      description,
      direction,
      amountCents,
      balanceCents,
      currency: "EUR" as const
    };

    transactions.push({
      ...transactionWithoutFingerprint,
      fingerprint: buildFingerprint(transactionWithoutFingerprint)
    });
  }

  return {
    sourceInstitution: BBVA_INSTITUTION,
    fileName: file.name,
    transactions
  };
}
