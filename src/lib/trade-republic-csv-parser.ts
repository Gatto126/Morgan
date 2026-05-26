import crypto from "node:crypto";

import { TRADE_REPUBLIC_INSTITUTION } from "@/lib/institutions";

export { TRADE_REPUBLIC_INSTITUTION };

const REQUIRED_HEADERS = [
  "datetime",
  "date",
  "account_type",
  "category",
  "type",
  "asset_class",
  "name",
  "symbol",
  "shares",
  "price",
  "amount",
  "fee",
  "tax",
  "currency",
  "original_amount",
  "original_currency",
  "fx_rate",
  "description",
  "transaction_id",
  "counterparty_name",
  "counterparty_iban",
  "payment_reference",
  "mcc_code"
] as const;

type RequiredHeader = (typeof REQUIRED_HEADERS)[number];

type CsvRecord = Record<RequiredHeader, string> & {
  rowNumber: number;
};

type AccountType = "checking" | "investment" | "crypto";

export type ParsedTradeRepublicCsvTransaction = {
  fingerprint: string;
  sourceInstitution: typeof TRADE_REPUBLIC_INSTITUTION;
  pageNumber: number;
  bookingDate: string;
  rawDateLabel: string;
  typeLabel: string;
  description: string;
  direction: "IN" | "OUT";
  amountCents: number;
  balanceCents: number;
  currency: "EUR";
  accountType: AccountType;
  productName: string | null;
  isin: string | null;
  quantityUnits: number | null;
  tradeType: "buy_trade" | "savings_plan" | null;
};

export type ParsedTradeRepublicCsvDocument = {
  sourceInstitution: typeof TRADE_REPUBLIC_INSTITUTION;
  fileName: string;
  transactions: ParsedTradeRepublicCsvTransaction[];
  skippedRows: number;
};

function normalizeCell(value: string) {
  return value.replace(/^\uFEFF/, "").trim();
}

function normalizeText(value: string) {
  return normalizeCell(value).replace(/\s+/g, " ");
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let quotedField = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (inQuotes) {
      if (char === "\"" && nextChar === "\"") {
        field += "\"";
        index++;
        continue;
      }

      if (char === "\"") {
        inQuotes = false;
        continue;
      }

      field += char;
      continue;
    }

    if (char === "\"") {
      if (field.length > 0) {
        throw new Error("CSV non valido: virgolette non escapate dentro un campo.");
      }

      inQuotes = true;
      quotedField = true;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      quotedField = false;
      continue;
    }

    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      quotedField = false;
      continue;
    }

    if (char === "\r") {
      continue;
    }

    if (quotedField && char.trim().length > 0) {
      throw new Error("CSV non valido: testo trovato dopo la chiusura di un campo quotato.");
    }

    field += char;
  }

  if (inQuotes) {
    throw new Error("CSV non valido: campo quotato non chiuso.");
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((csvRow) => csvRow.some((cell) => cell.trim().length > 0));
}

function parseRows(text: string): CsvRecord[] {
  const rows = parseCsv(text);

  if (rows.length < 2) {
    throw new Error("CSV Trade Republic vuoto o senza righe transazione.");
  }

  const headers = rows[0].map(normalizeCell);
  const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index);

  if (duplicateHeaders.length > 0) {
    throw new Error(`CSV non valido: colonne duplicate (${duplicateHeaders.join(", ")}).`);
  }

  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headers.includes(header));

  if (missingHeaders.length > 0) {
    throw new Error(`CSV Trade Republic non supportato: mancano colonne ${missingHeaders.join(", ")}.`);
  }

  return rows.slice(1).map((row, rowIndex) => {
    const rowNumber = rowIndex + 2;

    if (row.length !== headers.length) {
      throw new Error(
        `CSV non valido alla riga ${rowNumber}: attese ${headers.length} colonne, trovate ${row.length}.`
      );
    }

    const record = Object.fromEntries(headers.map((header, columnIndex) => [header, row[columnIndex] ?? ""])) as Record<
      RequiredHeader,
      string
    >;

    return {
      ...record,
      rowNumber
    };
  });
}

function parseMoneyToCents(value: string, rowNumber: number, column: string) {
  const normalized = normalizeCell(value);

  if (!normalized) {
    return 0;
  }

  const match = normalized.match(/^([+-]?)(\d+)(?:\.(\d+))?$/);

  if (!match) {
    throw new Error(`Importo non valido alla riga ${rowNumber}, colonna ${column}: ${value}.`);
  }

  const [, signText, wholeText, fractionText = ""] = match;
  const centText = `${fractionText}00`.slice(0, 2);
  const beyondCents = fractionText.slice(2);

  if (/[^0]/.test(beyondCents)) {
    throw new Error(
      `Importo non rappresentabile al centesimo alla riga ${rowNumber}, colonna ${column}: ${value}.`
    );
  }

  const cents = BigInt(wholeText) * BigInt(100) + BigInt(centText);
  const signedCents = signText === "-" ? -cents : cents;

  if (signedCents > BigInt(Number.MAX_SAFE_INTEGER) || signedCents < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new Error(`Importo troppo grande alla riga ${rowNumber}, colonna ${column}: ${value}.`);
  }

  return Number(signedCents);
}

function parseDecimal(value: string, rowNumber: number, column: string) {
  const normalized = normalizeCell(value);

  if (!normalized) {
    return null;
  }

  if (!/^[+-]?\d+(?:\.\d+)?$/.test(normalized)) {
    throw new Error(`Numero non valido alla riga ${rowNumber}, colonna ${column}: ${value}.`);
  }

  const parsed = Number.parseFloat(normalized);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Numero non valido alla riga ${rowNumber}, colonna ${column}: ${value}.`);
  }

  return parsed;
}

function parseBookingDate(record: CsvRecord) {
  const dateText = normalizeCell(record.date);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
    throw new Error(`Data non valida alla riga ${record.rowNumber}: ${record.date}.`);
  }

  const date = new Date(`${dateText}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateText) {
    throw new Error(`Data non valida alla riga ${record.rowNumber}: ${record.date}.`);
  }

  const datetime = new Date(normalizeCell(record.datetime));

  if (Number.isNaN(datetime.getTime())) {
    throw new Error(`Datetime non valido alla riga ${record.rowNumber}: ${record.datetime}.`);
  }

  return date.toISOString();
}

function buildFingerprint(record: CsvRecord) {
  return crypto
    .createHash("sha256")
    .update([TRADE_REPUBLIC_INSTITUTION, "csv", normalizeCell(record.transaction_id)].join("|"))
    .digest("hex");
}

function buildDescription(record: CsvRecord) {
  const name = normalizeText(record.name);
  const description = normalizeText(record.description);

  if (name && description && !description.toLowerCase().includes(name.toLowerCase())) {
    return `${name} - ${description}`;
  }

  return description || name || normalizeText(record.type);
}

function inferAccountType(record: CsvRecord): AccountType {
  const combined = `${record.category} ${record.asset_class} ${record.name} ${record.symbol} ${record.description}`.toLowerCase();

  if (
    combined.includes("crypto") ||
    combined.includes("bitcoin") ||
    combined.includes("ethereum") ||
    combined.includes("xf000btc") ||
    combined.includes("xf000eth")
  ) {
    return "crypto";
  }

  if (normalizeCell(record.category) === "TRADING" || normalizeCell(record.category) === "DELIVERY") {
    return "investment";
  }

  return "checking";
}

function inferTradeType(record: CsvRecord): "buy_trade" | "savings_plan" | null {
  const type = normalizeCell(record.type);

  if (type !== "BUY" && type !== "SELL") {
    return null;
  }

  return record.description.toLowerCase().includes("savings plan") ? "savings_plan" : "buy_trade";
}

function isTechnicalMigration(record: CsvRecord) {
  return normalizeCell(record.category) === "DELIVERY" && normalizeCell(record.type) === "MIGRATION";
}

function isFreeAssetReceipt(record: CsvRecord) {
  return normalizeCell(record.category) === "DELIVERY" && normalizeCell(record.type) === "FREE_RECEIPT";
}

function assertTradeDirection(record: CsvRecord, netCashCents: number) {
  const type = normalizeCell(record.type);

  if (type === "BUY" && netCashCents >= 0) {
    throw new Error(`Direzione BUY incoerente alla riga ${record.rowNumber}.`);
  }

  if (type === "SELL" && netCashCents <= 0) {
    throw new Error(`Direzione SELL incoerente alla riga ${record.rowNumber}.`);
  }
}

function assertTradingFields(record: CsvRecord, accountType: AccountType) {
  const type = normalizeCell(record.type);

  if (accountType !== "investment" && accountType !== "crypto") {
    return;
  }

  if (type !== "BUY" && type !== "SELL" && !isFreeAssetReceipt(record)) {
    return;
  }

  const shares = parseDecimal(record.shares, record.rowNumber, "shares");
  const price = parseDecimal(record.price, record.rowNumber, "price");
  const symbol = normalizeText(record.symbol);

  if (!symbol) {
    throw new Error(`Strumento mancante alla riga ${record.rowNumber}.`);
  }

  if (shares === null || shares === 0) {
    throw new Error(`Quantita' mancante o nulla alla riga ${record.rowNumber}.`);
  }

  if ((type === "BUY" || type === "SELL") && (price === null || price <= 0)) {
    throw new Error(`Prezzo mancante o non positivo alla riga ${record.rowNumber}.`);
  }
}

function toParsedTransaction(record: CsvRecord, netCashCents: number, runningCashBalanceCents: number) {
  const accountType = inferAccountType(record);
  const shares = parseDecimal(record.shares, record.rowNumber, "shares");
  const symbol = normalizeText(record.symbol);

  assertTradeDirection(record, netCashCents);
  assertTradingFields(record, accountType);

  return {
    fingerprint: buildFingerprint(record),
    sourceInstitution: TRADE_REPUBLIC_INSTITUTION,
    pageNumber: record.rowNumber,
    bookingDate: parseBookingDate(record),
    rawDateLabel: normalizeCell(record.date),
    typeLabel: normalizeCell(record.type),
    description: buildDescription(record),
    direction: netCashCents > 0 ? "IN" : "OUT",
    amountCents: Math.abs(netCashCents),
    balanceCents: runningCashBalanceCents,
    currency: "EUR" as const,
    accountType,
    productName: normalizeText(record.name) || null,
    isin: symbol || null,
    quantityUnits: accountType === "investment" || accountType === "crypto" ? Math.abs(shares ?? 0) || null : null,
    tradeType: inferTradeType(record)
  } satisfies ParsedTradeRepublicCsvTransaction;
}

export async function parseTradeRepublicCsv(file: File) {
  const text = await file.text();
  const records = parseRows(text);
  const seenTransactionIds = new Set<string>();
  const sortedRecords = [...records].sort((left, right) => {
    const leftTime = Date.parse(normalizeCell(left.datetime));
    const rightTime = Date.parse(normalizeCell(right.datetime));

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return left.rowNumber - right.rowNumber;
  });
  const transactions: ParsedTradeRepublicCsvTransaction[] = [];
  let runningCashBalanceCents = 0;
  let skippedRows = 0;

  for (const record of sortedRecords) {
    const transactionId = normalizeCell(record.transaction_id);

    if (!transactionId) {
      throw new Error(`transaction_id mancante alla riga ${record.rowNumber}.`);
    }

    if (seenTransactionIds.has(transactionId)) {
      throw new Error(`transaction_id duplicato nel CSV: ${transactionId}.`);
    }

    seenTransactionIds.add(transactionId);

    if (normalizeCell(record.currency) !== "EUR") {
      throw new Error(`Valuta non supportata alla riga ${record.rowNumber}: ${record.currency}.`);
    }

    parseBookingDate(record);
    parseDecimal(record.original_amount, record.rowNumber, "original_amount");
    parseDecimal(record.fx_rate, record.rowNumber, "fx_rate");

    const amountCents = parseMoneyToCents(record.amount, record.rowNumber, "amount");
    const feeCents = parseMoneyToCents(record.fee, record.rowNumber, "fee");
    const taxCents = parseMoneyToCents(record.tax, record.rowNumber, "tax");
    const netCashCents = amountCents + feeCents + taxCents;
    if (netCashCents === 0) {
      if (isTechnicalMigration(record)) {
        skippedRows++;
        continue;
      }

      if (!isFreeAssetReceipt(record)) {
        throw new Error(`Movimento a saldo zero non supportato alla riga ${record.rowNumber}.`);
      }
    }

    runningCashBalanceCents += netCashCents;

    if (runningCashBalanceCents < 0) {
      throw new Error(
        `Saldo ricostruito negativo alla riga ${record.rowNumber}: il CSV sembra incompleto o non ordinabile.`
      );
    }

    transactions.push(toParsedTransaction(record, netCashCents, runningCashBalanceCents));
  }

  if (transactions.length === 0) {
    throw new Error("Il CSV Trade Republic non contiene transazioni importabili.");
  }

  return {
    sourceInstitution: TRADE_REPUBLIC_INSTITUTION,
    fileName: file.name,
    transactions,
    skippedRows
  } satisfies ParsedTradeRepublicCsvDocument;
}
