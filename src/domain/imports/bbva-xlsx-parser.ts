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

export type BbvaMovementOnlyBalanceAnchor =
  | { kind: "before-start"; balanceCents: number }
  | { kind: "after-end"; balanceCents: number };

export type BbvaMovementOnlyBalanceRange = {
  earliestBookingDate: string;
  latestBookingDate: string;
};

export type ParseBbvaXlsxStatementOptions = {
  resolveMovementOnlyBalanceAnchor?: (
    range: BbvaMovementOnlyBalanceRange
  ) => BbvaMovementOnlyBalanceAnchor | null | Promise<BbvaMovementOnlyBalanceAnchor | null>;
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
  const normalizedMovement = normalizeHeader(movement);
  const typeLabel =
    normalizedMovement && normalizedMovement !== "altro"
      ? movement
      : causale;
  const descriptionParts = [
    typeLabel === causale ? "" : causale,
    beneficiary
  ].filter(Boolean);
  const description = descriptionParts.join(" - ") || causale || movement;

  return {
    description,
    typeLabel
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

function compareMovementOnlyDescending(
  left: ParsedBbvaTransactionDraft,
  right: ParsedBbvaTransactionDraft
) {
  const dateDelta = new Date(right.bookingDate).getTime() - new Date(left.bookingDate).getTime();
  if (dateDelta !== 0) return dateDelta;

  return left.pageNumber - right.pageNumber;
}

function movementOnlyDateRange(transactions: ParsedBbvaTransactionDraft[]): BbvaMovementOnlyBalanceRange {
  const sorted = [...transactions].sort(compareMovementOnlyAscending);

  return {
    earliestBookingDate: sorted[0].bookingDate,
    latestBookingDate: sorted[sorted.length - 1].bookingDate
  };
}

function applyMovementOnlyBalances(
  transactions: ParsedBbvaTransactionDraft[],
  anchor: BbvaMovementOnlyBalanceAnchor
) {
  if (anchor.kind === "before-start") {
    let runningBalanceCents = anchor.balanceCents;

    for (const transaction of [...transactions].sort(compareMovementOnlyAscending)) {
      runningBalanceCents += signedAmountCents(transaction);
      transaction.balanceCents = runningBalanceCents;
    }

    return;
  }

  let runningBalanceCents = anchor.balanceCents;

  for (const transaction of [...transactions].sort(compareMovementOnlyDescending)) {
    transaction.balanceCents = runningBalanceCents;
    runningBalanceCents -= signedAmountCents(transaction);
  }
}

async function resolveMovementOnlyBalances(
  transactions: ParsedBbvaTransactionDraft[],
  options: ParseBbvaXlsxStatementOptions
) {
  const resolveAnchor = options.resolveMovementOnlyBalanceAnchor;
  if (!resolveAnchor) {
    throw new BbvaXlsxParseError(
      "Il file BBVA contiene movimenti senza colonna Disponibile. Serve un import BBVA precedente con saldo, oppure esporta il formato BBVA con la colonna Disponibile."
    );
  }

  const anchor = await resolveAnchor(movementOnlyDateRange(transactions));
  if (!anchor) {
    throw new BbvaXlsxParseError(
      "Il file BBVA contiene movimenti senza colonna Disponibile, ma Morgan non ha trovato un saldo BBVA gia importato a cui agganciarli."
    );
  }

  applyMovementOnlyBalances(transactions, anchor);
}

function buildParsedTransaction(transaction: ParsedBbvaTransactionDraft): ParsedBbvaTransaction {
  if (transaction.balanceCents === undefined) {
    throw new BbvaXlsxParseError("Saldo BBVA non risolto per una transazione importabile.");
  }

  const transactionWithoutFingerprint = {
    ...transaction,
    balanceCents: transaction.balanceCents
  };

  return {
    ...transactionWithoutFingerprint,
    fingerprint: buildFingerprint(transactionWithoutFingerprint)
  };
}

export async function parseBbvaXlsxStatement(
  file: File,
  options: ParseBbvaXlsxStatementOptions = {}
): Promise<ParsedBbvaDocument> {
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
    await resolveMovementOnlyBalances(transactionDrafts, options);
  }

  const transactions = transactionDrafts.map(buildParsedTransaction);

  return {
    sourceInstitution: BBVA_INSTITUTION,
    fileName: file.name,
    transactions
  };
}
