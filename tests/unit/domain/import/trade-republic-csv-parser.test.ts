import { describe, expect, it } from "vitest";

import { TRADE_REPUBLIC_INSTITUTION } from "@/shared/institutions";
import { parseTradeRepublicCsv } from "@/domain/imports/trade-republic-csv-parser";
import { buildTradeRepublicCsvFile } from "../../../fixtures/imports/trade-republic";

describe("parseTradeRepublicCsv", () => {
  it("parses checking and investment transactions with reconstructed cash balance", async () => {
    const document = await parseTradeRepublicCsv(
      buildTradeRepublicCsvFile([
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
        buildTradeRepublicCsvFile([
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

  it("normalizes Trade Republic crypto identifiers to exchange tickers", async () => {
    const document = await parseTradeRepublicCsv(
      buildTradeRepublicCsvFile([
        {
          datetime: "2024-01-01T10:00:00.000Z",
          date: "2024-01-01",
          account_type: "CASH",
          category: "CASH",
          type: "TRANSFER",
          amount: "100.00",
          fee: "0",
          tax: "0",
          currency: "EUR",
          description: "Funding",
          transaction_id: "cash-crypto-1"
        },
        {
          datetime: "2024-01-02T10:00:00.000Z",
          date: "2024-01-02",
          account_type: "CRYPTO",
          category: "TRADING",
          type: "BUY",
          asset_class: "CRYPTO",
          name: "Bitcoin",
          symbol: "XF000BTC0017",
          shares: "0.001",
          price: "50000.00",
          amount: "-50.00",
          fee: "0",
          tax: "0",
          currency: "EUR",
          description: "Savings plan execution",
          transaction_id: "crypto-buy-1"
        }
      ])
    );

    expect(document.transactions[1]).toMatchObject({
      accountType: "crypto",
      productName: "Bitcoin",
      isin: "BTC",
      quantityUnits: 0.001
    });
  });
});
