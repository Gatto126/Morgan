import { describe, expect, it } from "vitest";

import { TRADE_REPUBLIC_INSTITUTION } from "@/lib/institutions";
import { parseTradeRepublicCsv } from "@/lib/trade-republic-csv-parser";

const HEADERS = [
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

type CsvRow = Record<(typeof HEADERS)[number], string>;

function buildCsv(rows: Partial<CsvRow>[]) {
  return [
    HEADERS.join(","),
    ...rows.map((row) => HEADERS.map((header) => JSON.stringify(row[header] ?? "")).join(","))
  ].join("\n");
}

function buildFile(rows: Partial<CsvRow>[]) {
  return new File([buildCsv(rows)], "trade-republic.csv", { type: "text/csv" });
}

describe("parseTradeRepublicCsv", () => {
  it("parses checking and investment transactions with reconstructed cash balance", async () => {
    const document = await parseTradeRepublicCsv(
      buildFile([
        {
          datetime: "2024-01-01T10:00:00.000Z",
          date: "2024-01-01",
          account_type: "CASH",
          category: "CASH",
          type: "TRANSFER",
          name: "Salary",
          amount: "100.00",
          fee: "0",
          tax: "0",
          currency: "EUR",
          description: "Salary payment",
          transaction_id: "cash-1"
        },
        {
          datetime: "2024-01-02T10:00:00.000Z",
          date: "2024-01-02",
          account_type: "SECURITIES",
          category: "TRADING",
          type: "BUY",
          asset_class: "ETF",
          name: "Core MSCI World",
          symbol: "IE00B4L5Y983",
          shares: "0.5",
          price: "100.00",
          amount: "-50.00",
          fee: "0",
          tax: "0",
          currency: "EUR",
          description: "Order executed",
          transaction_id: "buy-1"
        }
      ])
    );

    expect(document.sourceInstitution).toBe(TRADE_REPUBLIC_INSTITUTION);
    expect(document.transactions).toHaveLength(2);
    expect(document.transactions[0]).toMatchObject({
      typeLabel: "TRANSFER",
      direction: "IN",
      amountCents: 100_00,
      balanceCents: 100_00,
      accountType: "checking"
    });
    expect(document.transactions[1]).toMatchObject({
      typeLabel: "BUY",
      direction: "OUT",
      amountCents: 50_00,
      balanceCents: 50_00,
      accountType: "investment",
      productName: "Core MSCI World",
      isin: "IE00B4L5Y983",
      quantityUnits: 0.5,
      tradeType: "buy_trade"
    });
  });

  it("rejects duplicate transaction ids", async () => {
    await expect(
      parseTradeRepublicCsv(
        buildFile([
          {
            datetime: "2024-01-01T10:00:00.000Z",
            date: "2024-01-01",
            account_type: "CASH",
            category: "CASH",
            type: "TRANSFER",
            amount: "10.00",
            fee: "0",
            tax: "0",
            currency: "EUR",
            description: "First",
            transaction_id: "duplicate-id"
          },
          {
            datetime: "2024-01-02T10:00:00.000Z",
            date: "2024-01-02",
            account_type: "CASH",
            category: "CASH",
            type: "TRANSFER",
            amount: "5.00",
            fee: "0",
            tax: "0",
            currency: "EUR",
            description: "Second",
            transaction_id: "duplicate-id"
          }
        ])
      )
    ).rejects.toThrow("transaction_id duplicato");
  });
});
