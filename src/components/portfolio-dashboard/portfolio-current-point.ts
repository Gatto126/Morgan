import type { ChartPoint } from "@/types/chart";

export function getPortfolioPointValue(point: ChartPoint | null, tabKey: string) {
  if (!point) {
    return null;
  }

  const value = tabKey === "ALL" ? point.heritage : point[tabKey];
  return typeof value === "number" ? value : null;
}
