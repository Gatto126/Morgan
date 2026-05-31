import { describe, expect, it } from "vitest";

import { hasDashboardStageTopbarData } from "@/components/finance-shell/dashboard-topbar-visibility";
import type { UserRecord } from "@/components/finance-shell/types";

const emptyUser: UserRecord = {
  id: "user-1",
  name: "Empty",
  transactionCount: 0,
  checkingCount: 0,
  investmentCount: 0,
  cryptoCount: 0,
  hasBinanceCredentials: false
};

describe("dashboard topbar shell", () => {
  it("hides the heritage topbar when the profile has no transactions or Binance portfolio", () => {
    expect(hasDashboardStageTopbarData(emptyUser, "dashboard")).toBe(false);
  });

  it("keeps the heritage topbar for imported data or Binance data", () => {
    expect(hasDashboardStageTopbarData({
      ...emptyUser,
      transactionCount: 1
    }, "dashboard")).toBe(true);
    expect(hasDashboardStageTopbarData({
      ...emptyUser,
      hasBinanceCredentials: true
    }, "dashboard")).toBe(true);
  });
});
