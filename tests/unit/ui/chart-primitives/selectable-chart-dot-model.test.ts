import { describe, expect, it } from "vitest";

import { getSelectableChartDotPoint } from "@/components/chart-primitives/selectable-chart-dot-model";

describe("selectable chart dot model", () => {
  it("builds a selected point from the requested series", () => {
    expect(getSelectableChartDotPoint({
      rawMonth: "2026-05-29",
      balance: 552553
    }, "balance")).toEqual({
      month: "2026-05-29",
      seriesKey: "balance",
      value: 552553
    });
  });

  it("can select a display series from a separate value key", () => {
    expect(getSelectableChartDotPoint({
      rawMonth: "2026-05-29",
      value: 42000
    }, "heritage", "value")).toEqual({
      month: "2026-05-29",
      seriesKey: "heritage",
      value: 42000
    });
  });

  it("ignores missing month, empty values and non-numeric values", () => {
    expect(getSelectableChartDotPoint({ balance: 100 }, "balance")).toBeNull();
    expect(getSelectableChartDotPoint({ rawMonth: "2026-05-29", balance: null }, "balance")).toBeNull();
    expect(getSelectableChartDotPoint({ rawMonth: "2026-05-29", balance: "nope" }, "balance")).toBeNull();
  });
});
