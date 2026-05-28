import { describe, expect, it } from "vitest";

import { getVisibleDashboardStageKeys } from "@/components/finance-shell/dashboard-stage-items";
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

describe("finance shell dashboard stage items", () => {
  it("does not render dashboard stages before a profile is selected", () => {
    expect(getVisibleDashboardStageKeys(null)).toEqual([]);
  });

  it("always renders the overview dashboard for an active profile", () => {
    expect(getVisibleDashboardStageKeys(user())).toEqual(["dashboard"]);
  });

  it("renders data-specific dashboards only when the profile supports them", () => {
    expect(getVisibleDashboardStageKeys(user({
      checkingCount: 4,
      investmentCount: 2,
      cryptoCount: 1,
      hasBinanceCredentials: true
    }))).toEqual(["dashboard", "checking", "investment", "crypto", "binance"]);
  });
});
