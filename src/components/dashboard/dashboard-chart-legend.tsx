import { ChartLegend } from "@/components/chart-primitives/chart-legend";

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

  return (
    <ChartLegend
      hiddenSeries={hiddenSeries}
      items={allSeriesKeys.map((key) => {
        const isMain = key === activeTab;
        const subLine = chartConfig.subLines.find((series) => series.key === key);

        return {
          key,
          label: isMain ? chartConfig.mainLabel : subLine?.label || key,
          color: isMain ? "#ffffff" : subLine?.stroke || "#cccccc"
        };
      })}
      onToggleSeries={toggleSeries}
      testId="dashboard-chart-legend"
      transactionCount={transactionCount}
    />
  );
}
