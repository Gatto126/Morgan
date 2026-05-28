export const TRADE_REPUBLIC_CSV_HEADERS = [
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

export type TradeRepublicCsvRow = Record<(typeof TRADE_REPUBLIC_CSV_HEADERS)[number], string>;

export function buildTradeRepublicCsv(rows: Partial<TradeRepublicCsvRow>[]) {
  return [
    TRADE_REPUBLIC_CSV_HEADERS.join(","),
    ...rows.map((row) =>
      TRADE_REPUBLIC_CSV_HEADERS.map((header) => JSON.stringify(row[header] ?? "")).join(",")
    )
  ].join("\n");
}

export function buildTradeRepublicCsvFile(rows: Partial<TradeRepublicCsvRow>[]) {
  return new File([buildTradeRepublicCsv(rows)], "trade-republic.csv", { type: "text/csv" });
}
