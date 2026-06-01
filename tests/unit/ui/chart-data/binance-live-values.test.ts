import { describe, expect, it } from "vitest";

import {
  applyLiveBinanceBalanceValues,
  getBinanceBalancesTotalCents,
  getBinanceLivePriceKeys
} from "@/components/dashboard/binance-live-values";
import type { BinanceBalanceRow } from "@/components/dashboard/types";

const balances: BinanceBalanceRow[] = [
  {
    eurValue: 600,
    freeAmount: 0.01,
    lockedAmount: 0.002,
    tokenName: "Bitcoin",
    tokenSymbol: "BTC"
  },
  {
    eurValue: 100,
    freeAmount: 100,
    lockedAmount: 0,
    tokenName: "USD Coin",
    tokenSymbol: "USDC"
  },
  {
    eurValue: 0.25,
    freeAmount: 10,
    lockedAmount: 0,
    tokenName: "Dust",
    tokenSymbol: "DOGE"
  },
  {
    eurValue: 0,
    freeAmount: 42,
    lockedAmount: 0,
    tokenName: "Unpriced",
    tokenSymbol: "UNPRICED"
  },
  {
    eurValue: 12,
    freeAmount: 0,
    lockedAmount: 0,
    tokenName: "Empty",
    tokenSymbol: "EMPTY"
  }
];

describe("Binance live values", () => {
  it("collects live price keys only for meaningful priced balances", () => {
    expect(getBinanceLivePriceKeys(balances)).toEqual(["BTC", "USDC"]);
  });

  it("revalues Binance balances with live prices while preserving fallback values", () => {
    const liveBalances = applyLiveBinanceBalanceValues(balances, {
      BTC: 51_000,
      USDC: null
    });

    expect(liveBalances[0].eurValue).toBe(612);
    expect(liveBalances[1].eurValue).toBe(100);
    expect(getBinanceBalancesTotalCents(liveBalances)).toBe(72_425);
  });
});
