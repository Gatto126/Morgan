import type { DashboardChartPoint } from "./dashboard-chart-types";
import type { AccountTab } from "./types";

export function getDashboardPointValue(point: DashboardChartPoint | null, tabKey: AccountTab) {
  if (!point) {
    return null;
  }

  const binancePoint = typeof point.binance === "number" ? point.binance : 0;

  if (tabKey === "crypto") {
    return typeof point.crypto === "number" ? point.crypto : binancePoint;
  }

  if (tabKey === "heritage") {
    return typeof point.heritage === "number" ? point.heritage : binancePoint;
  }

  const value = point[tabKey];
  return typeof value === "number" ? value : null;
}

export function isDashboardPointValueReady({
  cryptoValuesKnown,
  investmentValuesKnown,
  isTooltipActive,
  tabKey,
  valuesKnown
}: {
  cryptoValuesKnown: boolean;
  investmentValuesKnown: boolean;
  isTooltipActive: boolean;
  tabKey: AccountTab;
  valuesKnown: boolean;
}) {
  if (!valuesKnown) {
    return false;
  }

  if (isTooltipActive || tabKey === "checking") {
    return true;
  }

  if (tabKey === "investment") {
    return investmentValuesKnown;
  }

  if (tabKey === "crypto") {
    return cryptoValuesKnown;
  }

  return investmentValuesKnown && cryptoValuesKnown;
}
