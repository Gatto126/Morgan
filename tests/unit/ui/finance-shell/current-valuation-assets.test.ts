import { describe, expect, it } from "vitest";

import { getCurrentValuationAssetValueCents } from "@/components/finance-shell/current-valuation-assets";
import type { CurrentValuationSnapshot, ValuationValue } from "@/components/finance-shell/current-valuations-store";

function value(cents: number | null): ValuationValue {
  return {
    cents,
    fetchedAt: 1_000,
    source: "live-quote",
    status: cents === null ? "missing-live-quote" : "ready"
  };
}

const snapshot = {
  assets: {
    "investment:Core MSCI World USD (ACC)": {
      category: "investment",
      chartKey: "Core MSCI World USD (ACC)",
      id: "investment:Core MSCI World USD (ACC)",
      label: "Core MSCI World USD (ACC)",
      priceKey: "IE00B4L5Y983",
      providerIds: ["trade_republic"],
      providerValues: {
        trade_republic: value(180_123)
      },
      quantity: 14.5,
      value: value(180_123)
    },
    "crypto:Bitcoin": {
      category: "crypto",
      chartKey: "Bitcoin",
      id: "crypto:Bitcoin",
      label: "Bitcoin",
      priceKey: "BTC",
      providerIds: ["trade_republic"],
      providerValues: {
        trade_republic: value(1_799)
      },
      quantity: 0.000294,
      value: value(1_799)
    }
  }
} satisfies Pick<CurrentValuationSnapshot, "assets">;

describe("current valuation asset lookup", () => {
  it("finds provider asset values by price key before chart label", () => {
    expect(getCurrentValuationAssetValueCents(snapshot, {
      category: "investment",
      chartKey: "Old import label",
      priceKey: "IE00B4L5Y983",
      providerId: "trade_republic"
    })).toBe(180_123);
  });

  it("finds crypto asset values by normalized price key", () => {
    expect(getCurrentValuationAssetValueCents(snapshot, {
      category: "crypto",
      chartKey: "BTC visual label",
      priceKey: "btc",
      providerId: "trade_republic"
    })).toBe(1_799);
  });

  it("returns undefined when no committed valuation asset matches", () => {
    expect(getCurrentValuationAssetValueCents(snapshot, {
      category: "crypto",
      chartKey: "Solana",
      priceKey: "SOL",
      providerId: "trade_republic"
    })).toBeUndefined();
  });
});
