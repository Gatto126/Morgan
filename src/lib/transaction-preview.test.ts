import { describe, expect, it } from "vitest";

import { BBVA_INSTITUTION, TRADE_REPUBLIC_INSTITUTION } from "@/lib/institutions";
import { markPreviewTransactions, previewTransactionSchema } from "@/lib/transaction-preview";

describe("transaction preview helpers", () => {
  it("marks existing fingerprints without mutating transaction payloads", () => {
    const transactions = [
      {
        fingerprint: "new-fingerprint",
        sourceInstitution: TRADE_REPUBLIC_INSTITUTION,
        pageNumber: 1,
        bookingDate: "2024-01-01T00:00:00.000Z",
        rawDateLabel: "2024-01-01",
        typeLabel: "TRANSFER",
        description: "Salary",
        direction: "IN" as const,
        amountCents: 100_00,
        balanceCents: 100_00,
        currency: "EUR" as const,
        accountType: "checking" as const,
        productName: null,
        isin: null,
        quantityUnits: null,
        tradeType: null
      },
      {
        fingerprint: "existing-fingerprint",
        sourceInstitution: BBVA_INSTITUTION,
        pageNumber: 2,
        bookingDate: "2024-01-02T00:00:00.000Z",
        rawDateLabel: "02/01/2024",
        typeLabel: "Card payment",
        description: "Groceries",
        direction: "OUT" as const,
        amountCents: 25_50,
        balanceCents: 74_50,
        currency: "EUR" as const
      }
    ];

    const markedTransactions = markPreviewTransactions(
      transactions,
      new Set(["existing-fingerprint"])
    );

    expect(markedTransactions.map((transaction) => transaction.status)).toEqual(["new", "existing"]);
    expect(transactions).not.toHaveProperty("status");
  });

  it("validates preview transactions accepted by the import endpoint", () => {
    const payload = {
      fingerprint: "fingerprint",
      sourceInstitution: TRADE_REPUBLIC_INSTITUTION,
      pageNumber: 3,
      bookingDate: "2024-03-15T00:00:00.000Z",
      rawDateLabel: "2024-03-15",
      typeLabel: "BUY",
      description: "Core MSCI World",
      direction: "OUT",
      amountCents: 50_00,
      balanceCents: 150_00,
      currency: "EUR",
      accountType: "investment",
      productName: "Core MSCI World",
      isin: "IE00B4L5Y983",
      quantityUnits: 0.5,
      tradeType: "buy_trade"
    };

    expect(previewTransactionSchema.parse(payload)).toMatchObject(payload);
  });
});
