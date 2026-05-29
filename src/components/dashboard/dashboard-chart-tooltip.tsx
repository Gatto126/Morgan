import { useEffect } from "react";

import { formatEuroCents, formatProviderLabel, getMonthLabel } from "./formatters";
import type { DashboardChartPoint } from "./dashboard-chart-types";

type TooltipPayloadItem = {
  name: string;
  value: number;
  payload?: DashboardChartPoint;
  dataKey?: string | number;
};

type DashboardChartTooltipProps = {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  setActivePoint: (point: DashboardChartPoint | null) => void;
};

export function DashboardChartTooltip({
  active,
  payload,
  label,
  setActivePoint
}: DashboardChartTooltipProps) {
  useEffect(() => {
    if (active && payload && payload.length > 0) {
      setActivePoint(payload[0].payload ?? null);
    } else {
      setActivePoint(null);
    }
  }, [active, payload, setActivePoint]);

  if (!active || !payload?.length) {
    return null;
  }

  let formattedLabel = label || "";
  if (formattedLabel.length === 10) {
    const [year, month, day] = formattedLabel.split("-");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const shortYear = year.slice(2);
    formattedLabel = `${day} ${monthNames[Number.parseInt(month, 10) - 1]} ${shortYear}`;
  } else if (formattedLabel.length === 7) {
    formattedLabel = getMonthLabel(formattedLabel);
  }

  return (
    <div
      style={{
        background: "rgba(35,35,35,0.96)",
        border: "1px solid rgba(154,154,154,0.4)",
        borderRadius: 12,
        padding: "8px 14px",
        fontSize: 13,
        color: "#f5f5f5"
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{formattedLabel}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {[...payload]
          .filter((item) => item.name !== "referenceLineValue" && item.dataKey !== "referenceLineValue")
          .sort((a, b) => {
            const isMainA = ["heritage", "checking", "investment", "crypto", "value"].includes(a.name);
            const isMainB = ["heritage", "checking", "investment", "crypto", "value"].includes(b.name);
            if (isMainA && !isMainB) return -1;
            if (!isMainA && isMainB) return 1;
            return (b.value || 0) - (a.value || 0);
          })
          .map((item, index) => {
            const labelString = item.name === "value"
              ? "TOTAL"
              : ["heritage", "checking", "investment", "crypto"].includes(item.name)
                ? String(item.name).toUpperCase()
                : formatProviderLabel(item.name);

            return (
              <div key={index} className="flex justify-between gap-6 items-center">
                <span className="text-[10px] font-bold uppercase" style={{ color: "#ffffff" }}>
                  {labelString}
                </span>
                <span className="font-semibold">{formatEuroCents(item.value)}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
