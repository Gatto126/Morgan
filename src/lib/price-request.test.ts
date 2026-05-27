import { describe, expect, it } from "vitest";

import {
  PRICE_REQUEST_LIMITS,
  PriceRequestValidationError,
  parsePriceRequestParams
} from "@/lib/price-request";

function params(query: string) {
  return new URLSearchParams(query);
}

function expectValidationStatus(query: string, status: PriceRequestValidationError["status"]) {
  expect(() => parsePriceRequestParams(params(query))).toThrow(PriceRequestValidationError);

  try {
    parsePriceRequestParams(params(query));
  } catch (error) {
    expect(error).toBeInstanceOf(PriceRequestValidationError);
    expect((error as PriceRequestValidationError).status).toBe(status);
  }
}

describe("price request validation", () => {
  it("normalizes and deduplicates ISINs and crypto symbols", () => {
    expect(
      parsePriceRequestParams(
        params("isins=ie00b4l5y983, IE00B4L5Y983&cryptos=btc,BTC,eth")
      )
    ).toEqual({
      isins: ["IE00B4L5Y983"],
      cryptos: ["BTC", "ETH"],
      keys: ["IE00B4L5Y983", "BTC", "ETH"]
    });
  });

  it("rejects malformed ISINs instead of treating them as crypto symbols", () => {
    expectValidationStatus("isins=BTC", 422);
  });

  it("rejects malformed crypto symbols", () => {
    expectValidationStatus("cryptos=btc-eur", 422);
  });

  it("requires at least one price key", () => {
    expectValidationStatus("", 400);
  });

  it("enforces per-kind cardinality limits", () => {
    const tooManyCryptos = Array.from(
      { length: PRICE_REQUEST_LIMITS.maxCryptos + 1 },
      (_, index) => `C${index.toString().padStart(2, "0")}`
    ).join(",");

    expectValidationStatus(`cryptos=${tooManyCryptos}`, 413);
  });

  it("enforces total cardinality limits", () => {
    const isins = Array.from(
      { length: PRICE_REQUEST_LIMITS.maxIsins },
      (_, index) => `US${index.toString(36).toUpperCase().padStart(9, "0")}0`
    ).join(",");
    const cryptos = Array.from(
      { length: PRICE_REQUEST_LIMITS.maxTotalKeys - PRICE_REQUEST_LIMITS.maxIsins + 1 },
      (_, index) => `T${index.toString().padStart(2, "0")}`
    ).join(",");

    expectValidationStatus(`isins=${isins}&cryptos=${cryptos}`, 413);
  });
});
