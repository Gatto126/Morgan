import { formatProviderLabel, getMonthLabel } from "./formatters";

export const DASHBOARD_TOOLTIP_EXCLUDED_KEYS = ["referenceLineValue"] as const;
export const DASHBOARD_TOOLTIP_PRIORITY_NAMES = ["heritage", "checking", "investment", "crypto", "value"] as const;

export function formatDashboardTooltipLabel(label?: string) {
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

export function formatDashboardTooltipSeriesLabel(name: string) {
  if (name === "value") return "TOTAL";
  if (["heritage", "checking", "investment", "crypto"].includes(name)) return name.toUpperCase();
  return formatProviderLabel(name);
}
