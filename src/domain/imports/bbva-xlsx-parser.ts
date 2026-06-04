import crypto from "node:crypto";
import { readSheet } from "read-excel-file/universal";

import { getCanonicalCheckingMovementLabel } from "@/domain/finance/checking-duplicates";
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

type BbvaStatementColumnKey = "bookingDate" | "typeLabel" | "amount" | "balance" | "description";
type BbvaMovementOnlyColumnKey = "bookingDate" | "causale" | "movement" | "beneficiary" | "amount";
type BbvaStatementColumnMap = Record<BbvaStatementColumnKey, number>;
type BbvaMovementOnlyColumnMap = Record<BbvaMovementOnlyColumnKey, number>;
type BbvaHeader =
  | { rowIndex: number; layout: "statement"; columns: BbvaStatementColumnMap }
  | { rowIndex: number; layout: "movement-only"; columns: BbvaMovementOnlyColumnMap };

type ParsedBbvaTransactionDraft = Omit<ParsedBbvaTransaction, "fingerprint" | "balanceCents"> & {
  balanceCents?: number;
};

export class BbvaXlsxParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BbvaXlsxParseError";
  }
}

const REQUIRED_STATEMENT_COLUMN_KEYS: BbvaStatementColumnKey[] = [
  "bookingDate",
  "typeLabel",
  "amount",
  "balance",
  "description"
];
const REQUIRED_MOVEMENT_ONLY_COLUMN_KEYS: BbvaMovementOnlyColumnKey[] = [
  "bookingDate",
  "causale",
  "movement",
  "beneficiary",
  "amount"
];

function formatItalianDateLabel(date: Date) {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

function parseItalianDate(dateStr: string): string {
  const match = dateStr.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    throw new BbvaXlsxParseError(`Formato data BBVA non riconosciuto: ${dateStr}`);
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new BbvaXlsxParseError(`Data BBVA non valida: ${dateStr}`);
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

  const rawValue = stringifyCell(cell).replace(/\s/g, "").replace(/[^\d,.\-+]/g, "");
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
    const statementColumns: Partial<BbvaStatementColumnMap> = {};
    const movementOnlyColumns: Partial<BbvaMovementOnlyColumnMap> = {};

    rows[rowIndex].forEach((cell, columnIndex) => {
      const header = normalizeHeader(cell);

      if (header === "data") {
        statementColumns.bookingDate ??= columnIndex;
        movementOnlyColumns.bookingDate ??= columnIndex;
      }
      if (header === "parola chiave") statementColumns.typeLabel ??= columnIndex;
      if (header === "importo") {
        statementColumns.amount ??= columnIndex;
        movementOnlyColumns.amount ??= columnIndex;
      }
      if (header === "disponibile") statementColumns.balance ??= columnIndex;
      if (header === "osservazioni") statementColumns.description ??= columnIndex;
      if (header === "causale") movementOnlyColumns.causale ??= columnIndex;
      if (header === "movimento") movementOnlyColumns.movement ??= columnIndex;
      if (header === "beneficiario") movementOnlyColumns.beneficiary ??= columnIndex;
    });

    if (REQUIRED_STATEMENT_COLUMN_KEYS.every((key) => statementColumns[key] !== undefined)) {
      return { rowIndex, layout: "statement", columns: statementColumns as BbvaStatementColumnMap } satisfies BbvaHeader;
    }

    if (REQUIRED_MOVEMENT_ONLY_COLUMN_KEYS.every((key) => movementOnlyColumns[key] !== undefined)) {
      return {
        rowIndex,
        layout: "movement-only",
        columns: movementOnlyColumns as BbvaMovementOnlyColumnMap
      } satisfies BbvaHeader;
    }
  }

  throw new BbvaXlsxParseError("Il file BBVA non contiene le colonne attese per le transazioni.");
}

function isEmptyRow(row: SheetRow) {
  return row.every((cell) => stringifyCell(cell) === "");
}

function buildFingerprint(transaction: Omit<ParsedBbvaTransaction, "fingerprint">, duplicateOrdinal: number) {
  return crypto
    .createHash("sha256")
    .update(
      [
        transaction.sourceInstitution,
        transaction.bookingDate,
        getCanonicalCheckingMovementLabel(transaction),
        transaction.direction,
        String(transaction.amountCents),
        String(duplicateOrdinal),
        transaction.currency
      ].join("|")
    )
    .digest("hex");
}

function cleanMovementOnlyBeneficiary(cell: SheetCell) {
  const value = stringifyCell(cell)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && line !== "-")
    .join(" ");

  return value === "-" ? "" : value;
}

function getMovementOnlyLabels(row: SheetRow, columns: BbvaMovementOnlyColumnMap) {
  const causale = stringifyCell(row[columns.causale]);
  const movement = stringifyCell(row[columns.movement]);
  const beneficiary = cleanMovementOnlyBeneficiary(row[columns.beneficiary]);
  const descriptionParts = [
    movement,
    beneficiary
  ].filter((part) => part && normalizeHeader(part) !== "altro");
  const description = descriptionParts.join(" - ") || causale || movement;

  return {
    description,
    typeLabel: causale
  };
}

function signedAmountCents(transaction: Pick<ParsedBbvaTransactionDraft, "amountCents" | "direction">) {
  return transaction.direction === "IN" ? transaction.amountCents : -transaction.amountCents;
}

function compareMovementOnlyAscending(
  left: ParsedBbvaTransactionDraft,
  right: ParsedBbvaTransactionDraft
) {
  const dateDelta = new Date(left.bookingDate).getTime() - new Date(right.bookingDate).getTime();
  if (dateDelta !== 0) return dateDelta;

  return right.pageNumber - left.pageNumber;
}

function applyMovementOnlyBootstrapBalances(transactions: ParsedBbvaTransactionDraft[]) {
  const sortedTransactions = [...transactions].sort(compareMovementOnlyAscending);
  const firstIncomingIndex = sortedTransactions.findIndex((transaction) => transaction.direction === "IN");

  if (firstIncomingIndex === -1) {
    let runningBalanceCents = 0;

    for (const transaction of sortedTransactions) {
      runningBalanceCents += signedAmountCents(transaction);
      transaction.balanceCents = runningBalanceCents;
    }

    return;
  }

  let runningBalanceCents = sortedTransactions[firstIncomingIndex].amountCents;
  sortedTransactions[firstIncomingIndex].balanceCents = runningBalanceCents;

  for (let i = firstIncomingIndex - 1; i >= 0; i -= 1) {
    runningBalanceCents -= signedAmountCents(sortedTransactions[i + 1]);
    sortedTransactions[i].balanceCents = runningBalanceCents;
  }

  runningBalanceCents = sortedTransactions[firstIncomingIndex].balanceCents;
  for (let i = firstIncomingIndex + 1; i < sortedTransactions.length; i += 1) {
    runningBalanceCents += signedAmountCents(sortedTransactions[i]);
    sortedTransactions[i].balanceCents = runningBalanceCents;
  }
}

function compareTransactionDraftsForFingerprint(
  left: ParsedBbvaTransactionDraft,
  right: ParsedBbvaTransactionDraft
) {
  const dateDelta = new Date(left.bookingDate).getTime() - new Date(right.bookingDate).getTime();
  if (dateDelta !== 0) return dateDelta;

  return right.pageNumber - left.pageNumber;
}

function getFingerprintDuplicateKey(transaction: ParsedBbvaTransactionDraft) {
  return [
    transaction.sourceInstitution,
    transaction.bookingDate,
    getCanonicalCheckingMovementLabel(transaction),
    transaction.direction,
    transaction.amountCents,
    transaction.currency
  ].join("|");
}

function buildParsedTransaction(
  transaction: ParsedBbvaTransactionDraft,
  duplicateOrdinal: number
): ParsedBbvaTransaction {
  if (transaction.balanceCents === undefined) {
    throw new BbvaXlsxParseError("Saldo BBVA non risolto per una transazione importabile.");
  }

  const transactionWithoutFingerprint = {
    ...transaction,
    balanceCents: transaction.balanceCents
  };

  return {
    ...transactionWithoutFingerprint,
    fingerprint: buildFingerprint(transactionWithoutFingerprint, duplicateOrdinal)
  };
}

function buildParsedTransactions(transactions: ParsedBbvaTransactionDraft[]) {
  const duplicateOrdinals = new Map<ParsedBbvaTransactionDraft, number>();
  const duplicateCounts = new Map<string, number>();

  for (const transaction of [...transactions].sort(compareTransactionDraftsForFingerprint)) {
    const key = getFingerprintDuplicateKey(transaction);
    const nextCount = (duplicateCounts.get(key) ?? 0) + 1;
    duplicateCounts.set(key, nextCount);
    duplicateOrdinals.set(transaction, nextCount);
  }

  return transactions.map((transaction) => buildParsedTransaction(
    transaction,
    duplicateOrdinals.get(transaction) ?? 1
  ));
}

export async function parseBbvaXlsxStatement(file: File): Promise<ParsedBbvaDocument> {
  const rows = (await readSheet(await file.arrayBuffer())) as SheetRow[];
  const header = mapHeaderColumns(rows);

  const transactionDrafts: ParsedBbvaTransactionDraft[] = [];

  for (let i = header.rowIndex + 1; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row || isEmptyRow(row)) continue;

    const bookingDateColumn =
      header.layout === "statement"
        ? header.columns.bookingDate
        : header.columns.bookingDate;
    if (!stringifyCell(row[bookingDateColumn])) continue;

    const { bookingDate, rawDateLabel } = parseItalianDateCell(row[bookingDateColumn]);
    const amount = parseNumberCell(row[header.columns.amount]);
    const balance =
      header.layout === "statement"
        ? parseNumberCell(row[header.columns.balance])
        : NaN;
    const labels =
      header.layout === "statement"
        ? {
            typeLabel: stringifyCell(row[header.columns.typeLabel]),
            description: stringifyCell(row[header.columns.description])
          }
        : getMovementOnlyLabels(row, header.columns);

    if (!Number.isFinite(amount) || (header.layout === "statement" && !Number.isFinite(balance))) continue;

    const amountCents = Math.round(Math.abs(amount) * 100);
    const direction = (amount >= 0 ? "IN" : "OUT") as "IN" | "OUT";

    transactionDrafts.push({
      sourceInstitution: BBVA_INSTITUTION,
      pageNumber: i + 1,
      bookingDate,
      rawDateLabel,
      typeLabel: labels.typeLabel,
      description: labels.description,
      direction,
      amountCents,
      ...(header.layout === "statement" ? { balanceCents: Math.round(balance * 100) } : {}),
      currency: "EUR" as const
    });
  }

  if (transactionDrafts.length === 0) {
    throw new BbvaXlsxParseError("Il file BBVA non contiene transazioni importabili.");
  }

  if (header.layout === "movement-only") {
    applyMovementOnlyBootstrapBalances(transactionDrafts);
  }

  const transactions = buildParsedTransactions(transactionDrafts);

  return {
    sourceInstitution: BBVA_INSTITUTION,
    fileName: file.name,
    transactions
  };
}
