import { useEffect, useMemo, useRef } from "react";

import type { ChartPoint, ChartTooltipPayload } from "@/types/chart";

import {
  DEFAULT_TOOLTIP_PRIORITY_NAMES,
  getFilteredTooltipPayload,
  getSortedTooltipPayload
} from "./chart-tooltip-model";

type ChartTooltipProps<TPoint extends Record<string, unknown>> = {
  active?: boolean;
  excludeDataKeys?: readonly string[];
  excludeNames?: readonly string[];
  formatLabel: (label?: string) => string;
  formatSeriesLabel: (name: string) => string;
  formatValue: (value: number) => string;
  label?: string;
  labelClassName?: string;
  payload?: ChartTooltipPayload<TPoint>[];
  priorityNames?: readonly string[];
  setActivePoint: (point: TPoint | null) => void;
};

export function ChartTooltip<TPoint extends Record<string, unknown> = ChartPoint>({
  active,
  excludeDataKeys,
  excludeNames,
  formatLabel,
  formatSeriesLabel,
  formatValue,
  label,
  labelClassName,
  payload,
  priorityNames = DEFAULT_TOOLTIP_PRIORITY_NAMES,
  setActivePoint
}: ChartTooltipProps<TPoint>) {
  const filteredPayload = useMemo(
    () => getFilteredTooltipPayload(payload, { excludeDataKeys, excludeNames }),
    [excludeDataKeys, excludeNames, payload]
  );
  const sortedPayload = useMemo(
    () => getSortedTooltipPayload(filteredPayload, priorityNames),
    [filteredPayload, priorityNames]
  );
  const activePointMarker = useMemo(() => {
    if (!active || filteredPayload.length === 0) {
      return "inactive";
    }

    const payloadMarker = filteredPayload
      .map((item) => `${String(item.dataKey ?? item.name ?? "")}:${String(item.value)}`)
      .join("|");

    return `${String(label ?? "")}:${payloadMarker}`;
  }, [active, filteredPayload, label]);
  const lastActivePointMarkerRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastActivePointMarkerRef.current === activePointMarker) {
      return;
    }

    lastActivePointMarkerRef.current = activePointMarker;

    if (activePointMarker !== "inactive" && filteredPayload.length > 0) {
      setActivePoint(filteredPayload[0].payload ?? null);
    } else {
      setActivePoint(null);
    }
  }, [activePointMarker, filteredPayload, setActivePoint]);

  if (!active || filteredPayload.length === 0) return null;

  const formattedLabel = formatLabel(label);

  return (
    <div className="rounded-xl border border-[rgba(154,154,154,0.4)] bg-[rgba(35,35,35,0.96)] p-2 px-3.5 text-[13px] text-[#f5f5f5]">
      <div className="mb-1.5 font-bold">{formattedLabel}</div>
      <div className="flex flex-col gap-1">
        {sortedPayload.map((payloadItem, index) => {
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
