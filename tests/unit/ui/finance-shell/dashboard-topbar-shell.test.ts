import { describe, expect, it } from "vitest";

import { seedDashboardStageDataCache } from "@/components/finance-shell/dashboard-stage-data-cache";
import { getCachedStageTopbarItems } from "@/components/finance-shell/dashboard-topbar-cache";
import { getHydratedTopbarItemsForStage } from "@/components/finance-shell/dashboard-topbar-hydration";
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

  it("ignores cached stage payloads without providers", () => {
    const user: UserRecord = {
      ...emptyUser,
      id: "malformed-stage-cache",
      checkingCount: 1,
      cryptoCount: 1,
      investmentCount: 1,
      transactionCount: 3
    };

    seedDashboardStageDataCache("checking", user.id, user.checkingCount, {} as never);
    seedDashboardStageDataCache("investment", user.id, user.investmentCount, { dailyData: [], monthlyData: [] } as never);
    seedDashboardStageDataCache("crypto", user.id, user.cryptoCount, { dailyData: [], monthlyData: [] } as never);

    expect(getCachedStageTopbarItems(user, "checking")).toEqual([]);
    expect(getCachedStageTopbarItems(user, "investment")).toEqual([]);
    expect(getCachedStageTopbarItems(user, "crypto")).toEqual([]);
  });

  it("does not reuse hydrated topbar items from another dashboard stage", () => {
    const dashboardItems = [{
      active: true,
      id: "heritage",
      value: ""
    }];

    expect(getHydratedTopbarItemsForStage({
      items: dashboardItems,
      key: "user-1:dashboard"
    }, "user-1:investment")).toEqual([]);

    expect(getHydratedTopbarItemsForStage({
      items: dashboardItems,
      key: "user-1:dashboard"
    }, "user-1:dashboard")).toBe(dashboardItems);
  });
});
