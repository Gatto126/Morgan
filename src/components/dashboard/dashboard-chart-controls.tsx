import { ChartBar, ChartGantt } from "lucide-react";

import { ChartTimeRangeControls } from "@/components/chart-primitives/chart-time-range-controls";

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
    <div data-testid="dashboard-chart-controls" className="absolute top-0 right-0 z-10 flex items-center justify-end gap-0.5">
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

      <ChartTimeRangeControls
        className="contents"
        onTimeRangeChange={onTimeRangeChange}
        ranges={TIME_RANGES}
        timeRange={timeRange}
      />
    </div>
  );
}
