import type { DashboardChartPoint } from "./dashboard-chart-types";
import type { AccountTab } from "./types";

export function getDashboardPointValue(point: DashboardChartPoint | null, tabKey: AccountTab) {
  if (!point) {
    return null;
  }

  if (tabKey === "crypto") {
    if (typeof point.topbar_crypto === "number") {
      return point.topbar_crypto;
    }
    return typeof point.crypto === "number" ? point.crypto : null;
  }

  if (tabKey === "heritage") {
    if (typeof point.topbar_heritage === "number") {
      return point.topbar_heritage;
    }
    return typeof point.heritage === "number" ? point.heritage : null;
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
