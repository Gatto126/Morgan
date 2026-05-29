import { cn } from "@/shared/utils";

import type { DashboardChartConfig } from "./dashboard-chart-types";
import type { AccountTab } from "./types";

type DashboardChartLegendProps = {
  activeTab: AccountTab;
  chartConfig: DashboardChartConfig;
  hiddenSeries: Record<string, boolean>;
  toggleSeries: (key: string) => void;
  transactionCount: number;
};

export function DashboardChartLegend({
  activeTab,
  chartConfig,
  hiddenSeries,
  toggleSeries,
  transactionCount
}: DashboardChartLegendProps) {
  const allSeriesKeys = [activeTab, ...chartConfig.subLines.map((series) => series.key)];
  const visibleCount = allSeriesKeys.filter((key) => !hiddenSeries[key]).length;

  return (
    <div
      data-testid="dashboard-chart-legend"
      className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap w-full pt-2 pb-0"
      style={{ visibility: transactionCount > 0 ? "visible" : "hidden" }}
    >
      {allSeriesKeys.map((key) => {
        const isMain = key === activeTab;
        const subLine = chartConfig.subLines.find((series) => series.key === key);
        const color = isMain ? "#ffffff" : subLine?.stroke || "#cccccc";
        const label = isMain ? chartConfig.mainLabel : subLine?.label || key;
        const isLastVisible = !hiddenSeries[key] && visibleCount <= 1;

        return (
          <div key={key} style={{ color: hiddenSeries[key] ? "#4C4C4C" : color }}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => {
                if (isLastVisible) return;
                toggleSeries(key);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  if (isLastVisible) return;
                  toggleSeries(key);
                }
              }}
              className={`flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider select-none outline-none whitespace-nowrap ${
                isLastVisible ? "cursor-not-allowed" : "cursor-pointer"
              }`}
              style={{ WebkitTapHighlightColor: "transparent", color: "inherit" }}
            >
              <div
                className="h-[6px] w-[14px] rounded-full sm:h-[8px] sm:w-[16px] flex-shrink-0"
                style={{ backgroundColor: hiddenSeries[key] ? "#4C4C4C" : color }}
              />
              <span className={cn(hiddenSeries[key] && "line-through")}>{label}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
