import { ChartTooltip } from "@/components/chart-primitives/chart-tooltip";
import type { ChartTooltipPayload } from "@/types/chart";

import {
  DASHBOARD_TOOLTIP_EXCLUDED_KEYS,
  DASHBOARD_TOOLTIP_PRIORITY_NAMES,
  formatDashboardTooltipLabel,
  formatDashboardTooltipSeriesLabel
} from "./dashboard-chart-tooltip-model";
import { formatEuroCents } from "./formatters";
import type { DashboardChartPoint } from "./dashboard-chart-types";

type DashboardChartTooltipProps = {
  active?: boolean;
  payload?: ChartTooltipPayload<DashboardChartPoint>[];
  label?: string;
  setActivePoint: (point: DashboardChartPoint | null) => void;
};

export function DashboardChartTooltip({
  active,
  payload,
  label,
  setActivePoint
}: DashboardChartTooltipProps) {
  return (
    <ChartTooltip
      active={active}
      excludeDataKeys={DASHBOARD_TOOLTIP_EXCLUDED_KEYS}
      excludeNames={DASHBOARD_TOOLTIP_EXCLUDED_KEYS}
      formatLabel={formatDashboardTooltipLabel}
      formatSeriesLabel={formatDashboardTooltipSeriesLabel}
      formatValue={formatEuroCents}
      label={label}
      payload={payload}
      priorityNames={DASHBOARD_TOOLTIP_PRIORITY_NAMES}
      setActivePoint={setActivePoint}
    />
  );
}
