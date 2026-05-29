import { useEffect, useMemo } from "react";

import type { ChartPoint, ChartTooltipPayload } from "@/types/chart";

type ChartTooltipProps<TPoint extends Record<string, unknown>> = {
  active?: boolean;
  excludeDataKeys?: string[];
  excludeNames?: string[];
  formatLabel: (label?: string) => string;
  formatSeriesLabel: (name: string) => string;
  formatValue: (value: number) => string;
  label?: string;
  labelClassName?: string;
  payload?: ChartTooltipPayload<TPoint>[];
  priorityNames?: string[];
  setActivePoint: (point: TPoint | null) => void;
};

const EMPTY_EXCLUDES: string[] = [];

export function ChartTooltip<TPoint extends Record<string, unknown> = ChartPoint>({
  active,
  excludeDataKeys = EMPTY_EXCLUDES,
  excludeNames = EMPTY_EXCLUDES,
  formatLabel,
  formatSeriesLabel,
  formatValue,
  label,
  labelClassName,
  payload,
  priorityNames = ["heritage", "value"],
  setActivePoint
}: ChartTooltipProps<TPoint>) {
  const filteredPayload = useMemo(() => payload?.filter((item) => {
    const name = String(item.name ?? "");
    const dataKey = String(item.dataKey ?? "");
    return !excludeNames.includes(name) && !excludeDataKeys.includes(dataKey);
  }) ?? [], [excludeDataKeys, excludeNames, payload]);

  useEffect(() => {
    if (active && filteredPayload.length > 0) {
      setActivePoint(filteredPayload[0].payload ?? null);
    } else {
      setActivePoint(null);
    }
  }, [active, filteredPayload, setActivePoint]);

  if (!active || filteredPayload.length === 0) return null;

  const prioritySet = new Set(priorityNames);
  const formattedLabel = formatLabel(label);

  return (
    <div className="rounded-xl border border-[rgba(154,154,154,0.4)] bg-[rgba(35,35,35,0.96)] p-2 px-3.5 text-[13px] text-[#f5f5f5]">
      <div className="mb-1.5 font-bold">{formattedLabel}</div>
      <div className="flex flex-col gap-1">
        {[...filteredPayload]
          .sort((left, right) => {
            const leftName = String(left.name ?? "");
            const rightName = String(right.name ?? "");
            if (prioritySet.has(leftName) && !prioritySet.has(rightName)) return -1;
            if (prioritySet.has(rightName) && !prioritySet.has(leftName)) return 1;
            return (right.value || 0) - (left.value || 0);
          })
          .map((payloadItem, index) => {
            const name = String(payloadItem.name ?? "");

            return (
              <div key={index} className="flex items-center justify-between gap-6">
                <span className={`text-[10px] font-bold uppercase text-white ${labelClassName ?? ""}`}>
                  {formatSeriesLabel(name)}
                </span>
                <span className="font-semibold">{formatValue(payloadItem.value)}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
