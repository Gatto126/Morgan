import { describe, expect, it } from "vitest";

import { classifyTransaction } from "@/domain/imports/transaction-classifier";

describe("classifyTransaction", () => {
  it("extracts Binance crypto tickers from Trade Republic pseudo identifiers", () => {
    expect(
      classifyTransaction(
        "BUY",
        "Buy trade XF000BTC0017 Bitcoin, quantity: 0.000294"
      )
    ).toMatchObject({
      accountType: "crypto",
      productName: "Bitcoin",
      isin: "BTC",
      quantityUnits: 0.000294
    });
  });
});
