import { describe, expect, it } from "vitest";

import {
  countImportedTransactionsByAccountType
} from "@/components/finance-shell/use-transaction-import";
import type { PreviewTransaction } from "@/components/finance-shell/types";

const basePreviewTransaction: PreviewTransaction = {
  amountCents: 100,
  balanceCents: 1_000,
  bookingDate: "2026-01-01",
  currency: "EUR",
  description: "Preview transaction",
  direction: "IN",
  fingerprint: "base",
  pageNumber: 1,
  rawDateLabel: "01/01/2026",
  sourceInstitution: "trade_republic",
  status: "new",
  typeLabel: "Transfer"
};

function makePreviewTransaction(transaction: Partial<PreviewTransaction>): PreviewTransaction {
  return {
    ...basePreviewTransaction,
    ...transaction
  };
}

describe("transaction import count helpers", () => {
  it("counts BBVA preview rows without an account type as checking transactions", () => {
    const transactions = [
      makePreviewTransaction({
        fingerprint: "bbva-1",
        sourceInstitution: "bbva"
      }),
      makePreviewTransaction({
        accountType: "investment",
        fingerprint: "tr-investment"
      }),
      makePreviewTransaction({
        accountType: "crypto",
        fingerprint: "tr-crypto"
      }),
      makePreviewTransaction({
        accountType: "checking",
        fingerprint: "tr-checking"
      }),
      makePreviewTransaction({
        fingerprint: "skipped",
        sourceInstitution: "bbva"
      })
    ];

    expect(countImportedTransactionsByAccountType(
      transactions,
      new Set(["bbva-1", "tr-investment", "tr-crypto", "tr-checking"])
    )).toEqual({
      addedChecking: 2,
      addedCrypto: 1,
      addedInvestment: 1
    });
  });
});
