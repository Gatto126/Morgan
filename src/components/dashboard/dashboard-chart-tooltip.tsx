import { ChartTooltip } from "@/components/chart-primitives/chart-tooltip";
import type { ChartTooltipPayload } from "@/types/chart";

import { formatEuroCents, formatProviderLabel, getMonthLabel } from "./formatters";
import type { DashboardChartPoint } from "./dashboard-chart-types";

type DashboardChartTooltipProps = {
  active?: boolean;
  payload?: ChartTooltipPayload<DashboardChartPoint>[];
  label?: string;
  setActivePoint: (point: DashboardChartPoint | null) => void;
};

const DASHBOARD_TOOLTIP_EXCLUDED_KEYS = ["referenceLineValue"];
const DASHBOARD_TOOLTIP_PRIORITY_NAMES = ["heritage", "checking", "investment", "crypto", "value"];

function formatTooltipLabel(label?: string) {
  let formattedLabel = label || "";
  if (formattedLabel.length === 10) {
    const [year, month, day] = formattedLabel.split("-");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const shortYear = year.slice(2);
    formattedLabel = `${day} ${monthNames[Number.parseInt(month, 10) - 1]} ${shortYear}`;
  } else if (formattedLabel.length === 7) {
    formattedLabel = getMonthLabel(formattedLabel);
  }

  return formattedLabel;
}

function formatTooltipSeriesLabel(name: string) {
  if (name === "value") return "TOTAL";
  if (["heritage", "checking", "investment", "crypto"].includes(name)) return name.toUpperCase();
  return formatProviderLabel(name);
}

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
      formatLabel={formatTooltipLabel}
      formatSeriesLabel={formatTooltipSeriesLabel}
      formatValue={formatEuroCents}
      label={label}
      payload={payload}
      priorityNames={DASHBOARD_TOOLTIP_PRIORITY_NAMES}
      setActivePoint={setActivePoint}
    />
  );
}
