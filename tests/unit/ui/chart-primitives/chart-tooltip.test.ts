import { describe, expect, it } from "vitest";

import {
  getFilteredTooltipPayload,
  getSortedTooltipPayload
} from "@/components/chart-primitives/chart-tooltip-model";
import {
  DASHBOARD_TOOLTIP_EXCLUDED_KEYS,
  DASHBOARD_TOOLTIP_PRIORITY_NAMES,
  formatDashboardTooltipLabel,
  formatDashboardTooltipSeriesLabel
} from "@/components/dashboard/dashboard-chart-tooltip-model";
import type { DashboardChartPoint } from "@/components/dashboard/dashboard-chart-types";
import type { ChartTooltipPayload } from "@/types/chart";

type TooltipPoint = {
  rawMonth: string;
} & Record<string, unknown>;

const tooltipPoint: TooltipPoint = { rawMonth: "2026-01-03" };

describe("chart tooltip model", () => {
  it("filters excluded payload entries and keeps priority series first", () => {
    const payload: ChartTooltipPayload<TooltipPoint>[] = [
      { dataKey: "bbva", name: "bbva", value: 2000, payload: tooltipPoint },
      { dataKey: "referenceLineValue", name: "referenceLineValue", value: 99999, payload: tooltipPoint },
      { dataKey: "heritage", name: "heritage", value: 1000, payload: tooltipPoint },
      { dataKey: "cash", name: "cash", value: 5000, payload: tooltipPoint }
    ];

    const filtered = getFilteredTooltipPayload(payload, {
      excludeDataKeys: ["referenceLineValue"],
      excludeNames: ["referenceLineValue"]
    });
    const sorted = getSortedTooltipPayload(filtered, ["heritage", "value"]);

    expect(filtered.map((item) => item.name)).toEqual(["bbva", "heritage", "cash"]);
    expect(sorted.map((item) => item.name)).toEqual(["heritage", "cash", "bbva"]);
  });

  it("returns an empty payload when every entry is excluded", () => {
    expect(getFilteredTooltipPayload([
      { dataKey: "referenceLineValue", name: "referenceLineValue", value: 1000, payload: tooltipPoint }
    ], {
      excludeDataKeys: ["referenceLineValue"],
      excludeNames: ["referenceLineValue"]
    })).toEqual([]);
  });
});

describe("dashboard chart tooltip model", () => {
  it("formats dashboard labels and series names", () => {
    expect(formatDashboardTooltipLabel("2026-01-03")).toBe("03 Jan 26");
    expect(formatDashboardTooltipLabel("2026-01")).toBe("Jan 26");
    expect(formatDashboardTooltipSeriesLabel("value")).toBe("TOTAL");
    expect(formatDashboardTooltipSeriesLabel("checking")).toBe("CHECKING");
    expect(formatDashboardTooltipSeriesLabel("trade_republic")).toBe("TRADE REPUBLIC");
  });

  it("excludes reference line values and prioritizes dashboard totals", () => {
    const point: DashboardChartPoint = {
      rawMonth: "2026-01-03",
      value: 123456,
      bbva: 10000,
      referenceLineValue: 999999
    };
    const payload: ChartTooltipPayload<DashboardChartPoint>[] = [
      { dataKey: "bbva", name: "bbva", value: 10000, payload: point },
      { dataKey: "referenceLineValue", name: "referenceLineValue", value: 999999, payload: point },
      { dataKey: "value", name: "value", value: 123456, payload: point }
    ];

    const filtered = getFilteredTooltipPayload(payload, {
      excludeDataKeys: DASHBOARD_TOOLTIP_EXCLUDED_KEYS,
      excludeNames: DASHBOARD_TOOLTIP_EXCLUDED_KEYS
    });

    expect(filtered.map((item) => item.name)).toEqual(["bbva", "value"]);
    expect(getSortedTooltipPayload(filtered, DASHBOARD_TOOLTIP_PRIORITY_NAMES).map((item) => item.name)).toEqual([
      "value",
      "bbva"
    ]);
  });
});
