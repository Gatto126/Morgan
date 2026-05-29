import type { ChartTooltipPayload } from "@/types/chart";

export const DEFAULT_TOOLTIP_PRIORITY_NAMES = ["heritage", "value"] as const;
export const EMPTY_TOOLTIP_EXCLUDES: readonly string[] = [];

type TooltipFilterOptions = {
  excludeDataKeys?: readonly string[];
  excludeNames?: readonly string[];
};

export function getFilteredTooltipPayload<TPoint extends Record<string, unknown>>(
  payload: ChartTooltipPayload<TPoint>[] | undefined,
  {
    excludeDataKeys = EMPTY_TOOLTIP_EXCLUDES,
    excludeNames = EMPTY_TOOLTIP_EXCLUDES
  }: TooltipFilterOptions = {}
) {
  return payload?.filter((item) => {
    const name = String(item.name ?? "");
    const dataKey = String(item.dataKey ?? "");
    return !excludeNames.includes(name) && !excludeDataKeys.includes(dataKey);
  }) ?? [];
}

export function getSortedTooltipPayload<TPoint extends Record<string, unknown>>(
  payload: ChartTooltipPayload<TPoint>[],
  priorityNames: readonly string[] = DEFAULT_TOOLTIP_PRIORITY_NAMES
) {
  const prioritySet = new Set(priorityNames);

  return [...payload].sort((left, right) => {
    const leftName = String(left.name ?? "");
    const rightName = String(right.name ?? "");
    if (prioritySet.has(leftName) && !prioritySet.has(rightName)) return -1;
    if (prioritySet.has(rightName) && !prioritySet.has(leftName)) return 1;
    return (right.value || 0) - (left.value || 0);
  });
}
