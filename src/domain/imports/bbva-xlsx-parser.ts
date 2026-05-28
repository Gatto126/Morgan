import crypto from "node:crypto";
import { readSheet } from "read-excel-file/universal";

import { BBVA_INSTITUTION } from "@/shared/institutions";

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

type SheetCell = string | number | boolean | Date | null | undefined;
type SheetRow = SheetCell[];

type BbvaColumnKey = "bookingDate" | "typeLabel" | "amount" | "balance" | "description";
type BbvaColumnMap = Record<BbvaColumnKey, number>;

const REQUIRED_COLUMN_KEYS: BbvaColumnKey[] = ["bookingDate", "typeLabel", "amount", "balance", "description"];

function formatItalianDateLabel(date: Date) {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function parseItalianDate(dateStr: string): string {
  const match = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    throw new Error(`Formato data BBVA non riconosciuto: ${dateStr}`);
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`Data BBVA non valida: ${dateStr}`);
  }

  return date.toISOString();
}

function parseItalianDateCell(cell: SheetCell) {
  if (cell instanceof Date) {
    return {
      rawDateLabel: formatItalianDateLabel(cell),
      bookingDate: new Date(Date.UTC(cell.getUTCFullYear(), cell.getUTCMonth(), cell.getUTCDate())).toISOString()
    };
  }

  const rawDateLabel = stringifyCell(cell);
  return {
    rawDateLabel,
    bookingDate: parseItalianDate(rawDateLabel)
  };
}

function stringifyCell(cell: SheetCell) {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) return formatItalianDateLabel(cell);
  return String(cell).trim();
}

function normalizeHeader(cell: SheetCell) {
  return stringifyCell(cell)
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function parseNumberCell(cell: SheetCell) {
  if (typeof cell === "number") return cell;

  const rawValue = stringifyCell(cell).replace(/\s/g, "");
  if (!rawValue) return NaN;

  const lastComma = rawValue.lastIndexOf(",");
  const lastDot = rawValue.lastIndexOf(".");
  let normalizedValue = rawValue;

  if (lastComma >= 0 && lastDot >= 0) {
    normalizedValue =
      lastComma > lastDot ? rawValue.replace(/\./g, "").replace(",", ".") : rawValue.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalizedValue = rawValue.replace(",", ".");
  }

  return Number(normalizedValue);
}

function mapHeaderColumns(rows: SheetRow[]) {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const columns: Partial<BbvaColumnMap> = {};

    rows[rowIndex].forEach((cell, columnIndex) => {
      const header = normalizeHeader(cell);

      if (header === "data") columns.bookingDate ??= columnIndex;
      if (header === "parola chiave") columns.typeLabel ??= columnIndex;
      if (header === "importo") columns.amount ??= columnIndex;
      if (header === "disponibile") columns.balance ??= columnIndex;
      if (header === "osservazioni") columns.description ??= columnIndex;
    });

    if (REQUIRED_COLUMN_KEYS.every((key) => columns[key] !== undefined)) {
      return { rowIndex, columns: columns as BbvaColumnMap };
    }
  }

  throw new Error("Il file BBVA non contiene le colonne attese per le transazioni.");
}

function isEmptyRow(row: SheetRow) {
  return row.every((cell) => stringifyCell(cell) === "");
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
  const rows = (await readSheet(await file.arrayBuffer())) as SheetRow[];
  const header = mapHeaderColumns(rows);

  const transactions: ParsedBbvaTransaction[] = [];

  for (let i = header.rowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || isEmptyRow(row) || !stringifyCell(row[header.columns.bookingDate])) continue;

    const { bookingDate, rawDateLabel } = parseItalianDateCell(row[header.columns.bookingDate]);
    const typeLabel = stringifyCell(row[header.columns.typeLabel]);
    const amount = parseNumberCell(row[header.columns.amount]);
    const balance = parseNumberCell(row[header.columns.balance]);
    const description = stringifyCell(row[header.columns.description]);

    if (!Number.isFinite(amount) || !Number.isFinite(balance)) continue;

    const amountCents = Math.round(Math.abs(amount) * 100);
    const balanceCents = Math.round(balance * 100);
    const direction = (amount >= 0 ? "IN" : "OUT") as "IN" | "OUT";

    const transactionWithoutFingerprint = {
      sourceInstitution: BBVA_INSTITUTION,
      pageNumber: i + 1,
      bookingDate,
      rawDateLabel,
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

  if (transactions.length === 0) {
    throw new Error("Il file BBVA non contiene transazioni importabili.");
  }

  return {
    sourceInstitution: BBVA_INSTITUTION,
    fileName: file.name,
    transactions
  };
}
