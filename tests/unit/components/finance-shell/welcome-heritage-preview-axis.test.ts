import { describe, expect, it } from "vitest";

import type { DashboardChartPoint } from "@/components/dashboard/dashboard-chart-types";
import {
  formatWelcomeXAxisTick,
  getWelcomeXAxisTicks
} from "@/components/finance-shell/welcome-heritage-preview-axis";

function point(rawMonth: string): DashboardChartPoint {
  return {
    heritage: 100,
    rawMonth,
    value: 100
  };
}

describe("welcome heritage preview axis", () => {
  it("keeps the first and last real data ticks when compacting a long timeline", () => {
    const chartData = [
      point("2025-02-18"),
      point("2025-03-01"),
      point("2025-04-01"),
      point("2025-05-01"),
      point("2025-06-01"),
      point("2025-07-01"),
      point("2025-08-01"),
      point("2025-09-01"),
      point("2025-10-01"),
      point("2025-11-01"),
      point("2025-12-01"),
      point("2026-01-01"),
      point("2026-02-01"),
      point("2026-03-01"),
      point("2026-04-01"),
      point("2026-05-30")
    ];

    const ticks = getWelcomeXAxisTicks(chartData);
    const labels = ticks.map(formatWelcomeXAxisTick);

    expect(ticks[0]).toBe("2025-02-18");
    expect(ticks[ticks.length - 1]).toBe("2026-05-30");
    expect(labels[0]).toBe("Feb 25");
    expect(labels[labels.length - 1]).toBe("May 26");
    expect(ticks.length).toBeLessThanOrEqual(7);
  });

  it("uses the first real point inside each month instead of generated month starts", () => {
    const ticks = getWelcomeXAxisTicks([
      point("2026-01-18"),
      point("2026-01-25"),
      point("2026-02-09"),
      point("2026-02-22"),
      point("2026-03-14"),
      point("2026-03-30")
    ]);

    expect(ticks).toEqual(["2026-01-18", "2026-02-09", "2026-03-30"]);
    expect(ticks.map(formatWelcomeXAxisTick)).toEqual(["Jan 26", "Feb 26", "Mar 26"]);
  });
});
