import { describe, expect, it } from "vitest";

import { normalizeCryptoSymbol } from "@/domain/pricing/crypto-symbols";

describe("crypto symbol normalization", () => {
  it("keeps ordinary ticker symbols uppercase", () => {
    expect(normalizeCryptoSymbol("btc")).toBe("BTC");
    expect(normalizeCryptoSymbol("ETH")).toBe("ETH");
  });

  it("maps Trade Republic crypto pseudo identifiers to Binance tickers", () => {
    expect(normalizeCryptoSymbol("XF000BTC0017")).toBe("BTC");
    expect(normalizeCryptoSymbol("XF000ETH0019")).toBe("ETH");
  });

  it("maps common token names to tickers", () => {
    expect(normalizeCryptoSymbol("Bitcoin")).toBe("BTC");
    expect(normalizeCryptoSymbol("Ethereum")).toBe("ETH");
  });
});
