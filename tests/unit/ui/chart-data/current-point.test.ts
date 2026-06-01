import { describe, expect, it } from "vitest";

import {
  getDashboardPointValue,
  isDashboardPointValueReady
} from "@/components/dashboard/dashboard-current-point";
import { getPortfolioPointValue } from "@/components/portfolio-dashboard/portfolio-current-point";

describe("current chart point values", () => {
  it("reads dashboard topbar values from the shared chart point", () => {
    const point = {
      binance: 25,
      checking: 100,
      crypto: 75,
      heritage: 300,
      investment: 125,
      rawMonth: "2026-06-01"
    };

    expect(getDashboardPointValue(point, "heritage")).toBe(300);
    expect(getDashboardPointValue(point, "investment")).toBe(125);
    expect(getDashboardPointValue(point, "crypto")).toBe(75);
    expect(getDashboardPointValue({ binance: 25, rawMonth: "2026-06-01" }, "crypto")).toBe(25);
    expect(getDashboardPointValue({ binance: 0, rawMonth: "2026-06-01" }, "crypto")).toBeNull();
  });

  it("keeps live dashboard values pending until their market prices are ready", () => {
    expect(isDashboardPointValueReady({
      cryptoValuesKnown: false,
      investmentValuesKnown: true,
      isTooltipActive: false,
      tabKey: "heritage",
      valuesKnown: true
    })).toBe(false);

    expect(isDashboardPointValueReady({
      cryptoValuesKnown: false,
      investmentValuesKnown: true,
      isTooltipActive: true,
      tabKey: "heritage",
      valuesKnown: true
    })).toBe(true);
  });

  it("reads portfolio topbar values from the shared chart point", () => {
    const point = {
      heritage: 42000,
      rawMonth: "2026-06-01",
      trade_republic: 31000
    };

    expect(getPortfolioPointValue(point, "ALL")).toBe(42000);
    expect(getPortfolioPointValue(point, "trade_republic")).toBe(31000);
    expect(getPortfolioPointValue(point, "missing")).toBeNull();
  });
});
