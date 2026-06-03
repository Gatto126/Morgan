import { describe, expect, it } from "vitest";

import { getBinanceConnectNotice } from "@/components/finance-shell/use-finance-binance-actions";
import type {
  CurrentValuationSnapshot,
  ValuationValue
} from "@/components/finance-shell/current-valuations-store";

const readyValue = (cents: number): ValuationValue => ({
  cents,
  fetchedAt: 1_000,
  source: "live-quote",
  status: "ready"
});

const loadingValue: ValuationValue = {
  cents: null,
  fetchedAt: null,
  source: "live-quote",
  status: "loading"
};

function createSnapshot({
  binanceCents,
  binanceRefreshKey = 2,
  hasBinanceProvider = false,
  status = "ready",
  value = readyValue(binanceCents ?? 0)
}: {
  binanceCents?: number;
  binanceRefreshKey?: number;
  hasBinanceProvider?: boolean;
  status?: CurrentValuationSnapshot["status"];
  value?: ValuationValue;
} = {}): CurrentValuationSnapshot {
  const zero = readyValue(0);

  return {
    assets: {},
    diagnostics: {
      lastFetchAt: 1_000,
      maxQuoteAgeMs: 0,
      missingKeys: [],
      unavailableKeys: []
    },
    profileId: "profile-1",
    providers: hasBinanceProvider
      ? {
          BINANCE: {
            hasBinance: true,
            hasChecking: false,
            hasCrypto: true,
            hasInvestment: false,
            id: "BINANCE",
            label: "BINANCE",
            totals: {
              binance: value,
              checking: zero,
              crypto: value,
              investment: zero,
              total: value
            },
            transactionCount: 0
          }
        }
      : {},
    quoteKeys: {
      cryptos: ["BTC"],
      isins: []
    },
    status,
    totals: {
      binance: value,
      checking: zero,
      crypto: value,
      heritage: value,
      investment: zero
    },
    updatedAt: 1_000,
    version: {
      binanceRefreshKey,
      checkingCount: 0,
      cryptoCount: 0,
      dateKey: "2026-06-03",
      investmentCount: 0,
      transactionCount: 0
    }
  };
}

describe("getBinanceConnectNotice", () => {
  it("reports no material balances when the current sync found none", () => {
    expect(getBinanceConnectNotice({
      binanceRefreshKey: 2,
      tokenCount: 0,
      valuationSnapshot: createSnapshot()
    })).toBe("Connected! No material balance above EUR 0.49.");
  });

  it("keeps the final connected notice for a committed Binance valuation", () => {
    expect(getBinanceConnectNotice({
      binanceRefreshKey: 2,
      tokenCount: 3,
      valuationSnapshot: createSnapshot({
        binanceCents: 12_345,
        hasBinanceProvider: true
      })
    })).toBe("Connected! 3 tokens found.");
  });

  it("stays explicit when the valuation snapshot is not ready for the new refresh key", () => {
    expect(getBinanceConnectNotice({
      binanceRefreshKey: 2,
      tokenCount: 3,
      valuationSnapshot: createSnapshot({
        binanceCents: 12_345,
        binanceRefreshKey: 1,
        hasBinanceProvider: true
      })
    })).toBe("Connected! 3 tokens found. Values are still preparing.");
  });

  it("does not imply a priced current value when synced balances cannot be valued", () => {
    expect(getBinanceConnectNotice({
      binanceRefreshKey: 2,
      tokenCount: 3,
      valuationSnapshot: createSnapshot({
        binanceCents: 0
      })
    })).toBe("Connected! 3 tokens found. Current value unavailable.");
  });

  it("uses a transitory message while the current valuation is still loading", () => {
    expect(getBinanceConnectNotice({
      binanceRefreshKey: 2,
      tokenCount: 3,
      valuationSnapshot: createSnapshot({
        status: "loading",
        value: loadingValue
      })
    })).toBe("Connected! 3 tokens found. Values are still preparing.");
  });
});
