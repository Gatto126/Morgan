import { ChartBar, ChartGantt } from "lucide-react";

import { TIME_RANGES } from "./constants";
import type { AccountTab, TimeRange } from "./types";

type DashboardChartControlsProps = {
  activeTab: AccountTab;
  onShowSoldAssetsChange: (showSoldAssets: boolean) => void;
  onTimeRangeChange: (timeRange: TimeRange) => void;
  showSoldAssets: boolean;
  timeRange: TimeRange;
};

export function DashboardChartControls({
  activeTab,
  onShowSoldAssetsChange,
  onTimeRangeChange,
  showSoldAssets,
  timeRange
}: DashboardChartControlsProps) {
  return (
    <div className="absolute top-0 right-0 z-10 flex items-center justify-end gap-0.5">
      {activeTab === "investment" && (
        <button
          aria-label="Toggle sold assets"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[color:var(--text-dim)] transition-colors hover:bg-[rgba(255,255,255,0.08)] hover:text-white"
          onClick={(event) => {
            event.stopPropagation();
            onShowSoldAssetsChange(!showSoldAssets);
          }}
          title={showSoldAssets ? "Nascondi asset venduti" : "Mostra asset venduti"}
          type="button"
        >
          {showSoldAssets ? <ChartGantt className="h-4 w-4" strokeWidth={2.2} /> : <ChartBar className="h-4 w-4" strokeWidth={2.2} />}
        </button>
      )}

      {TIME_RANGES.map((range) => (
        <button
          key={range}
          type="button"
          onClick={() => onTimeRangeChange(range)}
          className="cursor-pointer rounded-md px-1.5 py-0 text-[8.5px] sm:text-[10px] font-bold uppercase tracking-wider transition-colors duration-150"
          style={{
            background: timeRange === range ? "rgba(255,255,255,0.08)" : "transparent",
            color: timeRange === range ? "#f5f5f5" : "#737373"
          }}
        >
          {range}
        </button>
      ))}
    </div>
  );
}
