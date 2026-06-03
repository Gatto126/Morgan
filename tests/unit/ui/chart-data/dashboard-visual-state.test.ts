import { describe, expect, it } from "vitest";

import { shouldStartDashboardVisualStateVisible } from "@/components/dashboard/use-dashboard-visual-state";
import type { DashboardData } from "@/components/dashboard/types";

const data = {
  accountTotals: {
    checking: 0,
    crypto: 0,
    heritage: 0,
    investment: 0
  },
  dailyData: [],
  monthlyData: [],
  providerSummaries: []
} satisfies DashboardData;

describe("dashboard visual state", () => {
  it("does not reveal SSR stage data before required current dependencies are ready", () => {
    expect(shouldStartDashboardVisualStateVisible({
      data,
      dataDependenciesReady: false,
      loading: false
    })).toBe(false);
  });

  it("reveals immediately only when stage data and dependencies are ready", () => {
    expect(shouldStartDashboardVisualStateVisible({
      data,
      dataDependenciesReady: true,
      loading: false
    })).toBe(true);
  });
});
