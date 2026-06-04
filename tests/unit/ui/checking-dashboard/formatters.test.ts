import { describe, expect, it } from "vitest";

import {
  formatCheckingTransactionDescription,
  formatCheckingTransactionSort
} from "@/components/checking-dashboard/formatters";

describe("checking dashboard formatters", () => {
  it("hides internal Trade Republic cash settlement prefixes from transaction descriptions", () => {
    expect(formatCheckingTransactionDescription(
      "Regolamento liquidità: Core MSCI Europe EUR (Acc) - Savings plan execution"
    )).toBe("Core MSCI Europe EUR (Acc) - Savings plan execution");

    expect(formatCheckingTransactionDescription(
      "Regolamento liquidità crypto: Ethereum - FREE_RECEIPT ETH"
    )).toBe("Ethereum - FREE_RECEIPT ETH");

    expect(formatCheckingTransactionDescription(
      "Regolamento liquiditÃ : Core MSCI World USD (Acc) - Savings plan execution"
    )).toBe("Core MSCI World USD (Acc) - Savings plan execution");
  });

  it("hides redundant transfer wording from Trade Republic descriptions", () => {
    expect(formatCheckingTransactionDescription(" Incoming transfer from LUCA ANSALDI ")).toBe(
      "LUCA ANSALDI"
    );
    expect(formatCheckingTransactionDescription("Outgoing transfer for SERPE MATTEO")).toBe("SERPE MATTEO");
  });

  it("keeps regular descriptions unchanged apart from surrounding whitespace", () => {
    expect(formatCheckingTransactionDescription("Interest payment for payout collection")).toBe(
      "Interest payment for payout collection"
    );
  });

  it("shows compact inbound and outbound sort labels for transfer rows", () => {
    expect(formatCheckingTransactionSort("TRANSFER_INBOUND")).toBe("INBOUND");
    expect(formatCheckingTransactionSort("TRANSFER_INSTANT_OUTBOUND")).toBe("OUTBOUND");
    expect(formatCheckingTransactionSort("BUY")).toBe("BUY");
  });
});
