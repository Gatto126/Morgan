import { describe, expect, it } from "vitest";

import {
  areLivePriceKeysSettled,
  areLivePriceKeysValued
} from "@/shared/live-price-readiness";

describe("live price readiness", () => {
  it("treats null prices as settled responses", () => {
    expect(areLivePriceKeysSettled(["BTC", "HOME"], {
      BTC: 63_000,
      HOME: null
    })).toBe(true);
  });

  it("keeps a price group pending when a requested key is missing", () => {
    expect(areLivePriceKeysSettled(["BTC", "HOME"], {
      BTC: 63_000
    })).toBe(false);
  });

  it("requires numeric values before publishing current totals", () => {
    expect(areLivePriceKeysValued(["BTC", "HOME"], {
      BTC: 63_000,
      HOME: null
    })).toBe(false);
    expect(areLivePriceKeysValued(["BTC"], {
      BTC: 63_000,
      HOME: null
    })).toBe(true);
  });

  it("does not treat zero as a usable live market price", () => {
    expect(areLivePriceKeysValued(["BTC"], {
      BTC: 0
    })).toBe(false);
  });
});
