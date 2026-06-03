import { describe, expect, it } from "vitest";

import { isDashboardVisualReady, shouldStartDashboardVisualStateVisible } from "@/components/dashboard/use-dashboard-visual-state";
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
  it("does not show SSR stage data before required current dependencies are ready", () => {
    expect(shouldStartDashboardVisualStateVisible({
      data,
      dataDependenciesReady: false,
      loading: false
    })).toBe(false);
  });

  it("shows immediately only when stage data and dependencies are ready", () => {
    expect(shouldStartDashboardVisualStateVisible({
      data,
      dataDependenciesReady: true,
      loading: false
    })).toBe(true);
  });

  it("shows the empty profile state without waiting for chart measurement", () => {
    expect(isDashboardVisualReady({
      chartReady: false,
      data,
      dataDependenciesReady: true,
      loading: false,
      shouldShowUploadPanel: false,
      transactionCount: 0
    })).toBe(true);
  });

  it("shows a blocking upload panel without waiting for chart measurement", () => {
    expect(isDashboardVisualReady({
      chartReady: false,
      data,
      dataDependenciesReady: true,
      loading: false,
      shouldShowUploadPanel: true,
      transactionCount: 4
    })).toBe(true);
  });

  it("waits for a renderable chart during import refresh when transactions exist", () => {
    expect(isDashboardVisualReady({
      chartReady: true,
      data,
      dataDependenciesReady: true,
      hasRenderableChartData: false,
      loading: false,
      requireRenderableChartData: true,
      shouldShowUploadPanel: false,
      transactionCount: 4
    })).toBe(false);
  });
});
