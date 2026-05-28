import { describe, expect, it } from "vitest";

import {
  getActionNavigationKeys,
  getPrimaryNavigationKeys
} from "@/components/finance-shell/sidebar-navigation-items";
import type { UserRecord } from "@/components/finance-shell/types";

function user(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: "profile-1",
    name: "Main",
    transactionCount: 0,
    checkingCount: 0,
    investmentCount: 0,
    cryptoCount: 0,
    hasBinanceCredentials: false,
    binanceApiKeyPreview: null,
    ...overrides
  };
}

describe("finance shell sidebar navigation", () => {
  it("shows only profile-neutral actions before a profile is selected", () => {
    expect(getPrimaryNavigationKeys(null)).toEqual(["home"]);
    expect(getActionNavigationKeys({ activeUser: null, binanceFading: false, hasUsers: true })).toEqual([
      "home",
      "profile"
    ]);
  });

  it("shows account sections only when the active profile has matching data", () => {
    const activeUser = user({
      checkingCount: 3,
      investmentCount: 2,
      cryptoCount: 1,
      hasBinanceCredentials: true
    });

    expect(getPrimaryNavigationKeys(activeUser)).toEqual([
      "home",
      "dashboard",
      "checking",
      "investment",
      "crypto"
    ]);
    expect(getActionNavigationKeys({ activeUser, binanceFading: false, hasUsers: true })).toEqual([
      "home",
      "dashboard",
      "checking",
      "investment",
      "crypto",
      "binance",
      "settings",
      "profile"
    ]);
  });

  it("keeps the Binance action mounted during its fade-out state", () => {
    expect(getActionNavigationKeys({
      activeUser: user({ hasBinanceCredentials: false }),
      binanceFading: true,
      hasUsers: true
    })).toContain("binance");
  });
});
