import { describe, expect, it } from "vitest";

import {
  formatCheckingTooltipLabel,
  formatCheckingTooltipSeriesLabel,
  formatCheckingXAxisTick,
  formatCheckingYAxisTick,
  getCheckingAllLegendItems,
  getCheckingMetricLegendItems
} from "@/components/checking-dashboard/checking-chart-model";
import type { CheckingProviderSummary } from "@/components/checking-dashboard/types";

const provider: CheckingProviderSummary = {
  sourceInstitution: "bbva",
  total: 241475,
  income: 250125,
  expenses: 8650,
  interest: 0,
  cashback: 125,
  tax: 0,
  transactions: []
};

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

describe("checking chart model", () => {
  it("formats tooltip labels, series labels and axis ticks", () => {
    expect(formatCheckingTooltipLabel("2026-03-08")).toBe("08 Mar 26");
    expect(formatCheckingTooltipLabel("2026-03")).toBe("Mar 26");
    expect(formatCheckingTooltipSeriesLabel("value")).toBe("TOTAL");
    expect(formatCheckingTooltipSeriesLabel("balance")).toBe("BALANCE");
    expect(formatCheckingTooltipSeriesLabel("income")).toBe("INCOME");
    expect(formatCheckingTooltipSeriesLabel("expenses")).toBe("EXPENSES");
    expect(formatCheckingTooltipSeriesLabel("bbva")).toBe("BBVA");
    expect(formatCheckingXAxisTick("2026-04-01")).toBe("Apr 26");
  });

  it("formats the y-axis for desktop and compact mobile labels", () => {
    expect(digitsOnly(formatCheckingYAxisTick(241475, false))).toBe("2415");
    expect(formatCheckingYAxisTick(250000, true)).toBe("3k");
  });

  it("builds aggregate and provider metric legend items", () => {
    expect(getCheckingAllLegendItems([provider]).map((item) => item.label)).toEqual([
      "HERITAGE",
      "BBVA"
    ]);
    expect(getCheckingMetricLegendItems().map((item) => item.key)).toEqual([
      "balance",
      "income",
      "expenses"
    ]);
  });
});
