import { describe, expect, it } from "vitest";

import { formatCheckingTransactionDescription } from "@/components/checking-dashboard/formatters";

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

  it("keeps regular descriptions unchanged apart from surrounding whitespace", () => {
    expect(formatCheckingTransactionDescription(" Incoming transfer from LUCA ANSALDI ")).toBe(
      "Incoming transfer from LUCA ANSALDI"
    );
  });
});
