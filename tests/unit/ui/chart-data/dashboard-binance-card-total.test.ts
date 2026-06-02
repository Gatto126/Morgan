import { describe, expect, it } from "vitest";

import {
  getBinanceCardAssetValueCentsByKey,
  getBinanceCardBalanceValueLabel,
  getBinanceCardTotalLabel
} from "@/components/dashboard/dashboard-binance-card-total";
import { euroFormatter, formatEuroCents } from "@/components/dashboard/formatters";
import type { BinanceBalanceRow } from "@/components/dashboard/types";
import type { CurrentValuationSnapshot, ValuationValue } from "@/components/finance-shell/current-valuations-store";

function value(cents: number): ValuationValue {
  return {
    cents,
    fetchedAt: 1_000,
    source: "live-quote",
    status: "ready"
  };
}

describe("Binance card total", () => {
  it("uses the valuation total when local balance rounding differs", () => {
    const localBalances: BinanceBalanceRow[] = [
      {
        eurValue: 1_000.004,
        freeAmount: 1,
        lockedAmount: 0,
        tokenName: "USD Coin",
        tokenSymbol: "USDC"
      },
      {
        eurValue: 1_433.666,
        freeAmount: 1,
        lockedAmount: 0,
        tokenName: "Ethereum",
        tokenSymbol: "ETH"
      }
    ];
    const localTotalLabel = euroFormatter.format(
      localBalances.reduce((sum, balance) => sum + balance.eurValue, 0)
    );
    const valuationTotalLabel = formatEuroCents(243_368);

    expect(localTotalLabel).not.toBe(valuationTotalLabel);
    expect(getBinanceCardTotalLabel(243_368)).toBe(valuationTotalLabel);
  });

  it("uses valuation asset values for individual Binance balances when available", () => {
    const balance: BinanceBalanceRow = {
      eurValue: 1_000.004,
      freeAmount: 1,
      lockedAmount: 0,
      tokenName: "USD Coin",
      tokenSymbol: "USDC"
    };
    const snapshot: Pick<CurrentValuationSnapshot, "assets"> = {
      assets: {
        "binance:USDC": {
          category: "binance",
          chartKey: "USD Coin (USDC)",
          id: "binance:USDC",
          label: "USD Coin (USDC)",
          priceKey: "USDC",
          providerIds: ["BINANCE"],
          providerValues: {
            BINANCE: value(100_001)
          },
          quantity: 1,
          value: value(100_001)
        }
      }
    };
    const assetValues = getBinanceCardAssetValueCentsByKey(snapshot);

    expect(euroFormatter.format(balance.eurValue)).not.toBe(formatEuroCents(100_001));
    expect(getBinanceCardBalanceValueLabel(balance, assetValues)).toBe(formatEuroCents(100_001));
  });

  it("keeps Binance current values pending instead of falling back to synced EUR values", () => {
    const balance: BinanceBalanceRow = {
      eurValue: 1_000.004,
      freeAmount: 1,
      lockedAmount: 0,
      tokenName: "USD Coin",
      tokenSymbol: "USDC"
    };

    expect(getBinanceCardTotalLabel(null)).toBeNull();
    expect(getBinanceCardBalanceValueLabel(balance, undefined)).toBeNull();
  });
});
