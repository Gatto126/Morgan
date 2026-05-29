import type { ReactNode } from "react";
import { useEffect } from "react";
import { CartesianGrid, LineChart, Tooltip, XAxis, YAxis } from "recharts";

import { useChartContainerReady } from "@/hooks/use-chart-container-ready";
import { cn } from "@/shared/utils";

import { DashboardChartControls } from "./dashboard-chart-controls";
import { DashboardChartLegend } from "./dashboard-chart-legend";
import { DashboardChartLines } from "./dashboard-chart-lines";
import { DashboardChartOverlayPanel } from "./dashboard-chart-overlay-panel";
import { DashboardChartTooltip } from "./dashboard-chart-tooltip";
import type { DashboardChartConfig, DashboardChartPoint } from "./dashboard-chart-types";
import { getMonthLabel } from "./formatters";
import type { AccountTab, TimeRange } from "./types";

export type { DashboardChartConfig, DashboardChartPoint } from "./dashboard-chart-types";

type DashboardChartProps = {
  showSettingsView: boolean;
  isClosingSettings: boolean;
  onCloseSettings?: () => void;
  settingsElement?: ReactNode;
  showUserSelectView: boolean;
  isClosingUserSelect: boolean;
  onCloseUserSelect?: () => void;
  userSelectElement?: ReactNode;
  shouldShowUploadPanel: boolean;
  isClosingUpload: boolean;
  onCloseUpload?: () => void;
  uploadElement?: ReactNode;
  emptyStateElement?: ReactNode;
  reviewElement?: ReactNode;
  previewTransactionsCount: number;
  activeTab: AccountTab;
  showSoldAssets: boolean;
  onShowSoldAssetsChange: (showSoldAssets: boolean) => void;
  timeRange: TimeRange;
  onTimeRangeChange: (timeRange: TimeRange) => void;
  processedChartData: DashboardChartPoint[];
  marginLeft: number;
  marginRight: number;
  isMobile: boolean;
  xAxisTicks: string[];
  yAxisWidth: number;
  setActiveChartPoint: (point: DashboardChartPoint | null) => void;
  chartConfig: DashboardChartConfig;
  hiddenSeries: Record<string, boolean>;
  toggleSeries: (key: string) => void;
  selectedValue: number | null;
  setSelectedMonth: (month: string | null) => void;
  setSelectedSeriesKey: (seriesKey: string | null) => void;
  transactionCount: number;
  onChartReadyChange: (ready: boolean) => void;
};

export function DashboardChart({
  showSettingsView,
  isClosingSettings,
  onCloseSettings,
  settingsElement,
  showUserSelectView,
  isClosingUserSelect,
  onCloseUserSelect,
  userSelectElement,
  shouldShowUploadPanel,
  isClosingUpload,
  onCloseUpload,
  uploadElement,
  emptyStateElement,
  reviewElement,
  previewTransactionsCount,
  activeTab,
  showSoldAssets,
  onShowSoldAssetsChange,
  timeRange,
  onTimeRangeChange,
  processedChartData,
  marginLeft,
  marginRight,
  isMobile,
  xAxisTicks,
  yAxisWidth,
  setActiveChartPoint,
  chartConfig,
  hiddenSeries,
  toggleSeries,
  selectedValue,
  setSelectedMonth,
  setSelectedSeriesKey,
  transactionCount,
  onChartReadyChange
}: DashboardChartProps) {
  const { chartContainerRef, chartReady, chartSize } = useChartContainerReady();
  const shouldShowEmptyState = transactionCount === 0 && !!emptyStateElement;
  const isPanelOpen = showSettingsView || showUserSelectView || shouldShowUploadPanel;
  const isPanelClosing =
    (showSettingsView && isClosingSettings) ||
    (showUserSelectView && isClosingUserSelect) ||
    (shouldShowUploadPanel && isClosingUpload);
  const isChartVisible = !isPanelOpen;
  const shouldRevealChartContent = (shouldShowEmptyState || chartReady) && (!isPanelOpen || isPanelClosing);

  useEffect(() => {
    onChartReadyChange(isChartVisible && (shouldShowEmptyState || chartReady));
  }, [chartReady, isChartVisible, onChartReadyChange, shouldShowEmptyState]);

  return (
    <div className="relative flex w-full flex-1 flex-col justify-center overflow-hidden rounded-[18px] min-h-[240px] sm:min-h-[400px] md:min-h-[440px] lg:min-h-[520px]">
      <div
        className={cn("chart-content-reveal absolute inset-0 z-0 flex h-full min-h-0 w-full flex-col", !isChartVisible && "pointer-events-none")}
        data-visible={shouldRevealChartContent ? "true" : "false"}
      >
        {shouldShowEmptyState ? (
          <div className="flex h-full w-full items-center justify-center">
            {emptyStateElement}
          </div>
        ) : (
          <>
            <DashboardChartControls
              activeTab={activeTab}
              onShowSoldAssetsChange={onShowSoldAssetsChange}
              onTimeRangeChange={onTimeRangeChange}
              showSoldAssets={showSoldAssets}
              timeRange={timeRange}
            />

            <div className="flex-1 min-h-0 w-full pt-10 focus:outline-none outline-none">
              <div
                ref={chartContainerRef}
                className="relative w-full h-full"
                onClick={() => {
                  setSelectedMonth(null);
                  setSelectedSeriesKey(null);
                }}
              >
                <div id="chart-reference-overlay" className="absolute inset-0 pointer-events-none z-10" />
                {chartReady ? (
                  <LineChart
                    width={chartSize.width}
                    height={chartSize.height}
                    data={processedChartData}
                    margin={{
                      top: 8,
                      right: marginRight,
                      bottom: 0,
                      left: marginLeft
                    }}
                    style={{ outline: "none", overflow: "visible" }}
                    accessibilityLayer={false}
                  >
                    <XAxis
                      dataKey="rawMonth"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#666666", fontSize: isMobile ? 9 : 11 }}
                      dy={8}
                      padding={{ left: isMobile ? 16 : 0, right: isMobile ? 16 : 0 }}
                      minTickGap={isMobile ? 20 : 10}
                      ticks={xAxisTicks}
                      tickFormatter={(value) => {
                        if (!value) return "";
                        if (value.length === 7) {
                          return getMonthLabel(value);
                        }
                        const [year, month] = value.split("-");
                        return getMonthLabel(`${year}-${month}`);
                      }}
                    />
                    <YAxis
                      tick={{ fill: "#a8a8a8", fontSize: isMobile ? 9 : 10, dx: isMobile ? 4 : 0 }}
                      axisLine={false}
                      tickLine={false}
                      mirror={isMobile}
                      tickFormatter={(value: number) => {
                        if (isMobile && value >= 100000) {
                          return `${Math.round(value / 100000)}k €`;
                        }
                        return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value / 100);
                      }}
                      width={yAxisWidth}
                    />
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(154,154,154,0.12)" vertical={false} />
                    <Tooltip
                      content={<DashboardChartTooltip setActivePoint={setActiveChartPoint} />}
                      cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1, fill: "transparent" }}
                    />
                    <DashboardChartLines
                      activeTab={activeTab}
                      chartConfig={chartConfig}
                      hiddenSeries={hiddenSeries}
                      selectedValue={selectedValue}
                      setSelectedMonth={setSelectedMonth}
                      setSelectedSeriesKey={setSelectedSeriesKey}
                    />
                  </LineChart>
                ) : null}
              </div>
            </div>

            <DashboardChartLegend
              activeTab={activeTab}
              chartConfig={chartConfig}
              hiddenSeries={hiddenSeries}
              toggleSeries={toggleSeries}
              transactionCount={transactionCount}
            />
          </>
        )}
      </div>

      <DashboardChartOverlayPanel
        isClosingSettings={isClosingSettings}
        isClosingUpload={isClosingUpload}
        isClosingUserSelect={isClosingUserSelect}
        onCloseSettings={onCloseSettings}
        onCloseUpload={onCloseUpload}
        onCloseUserSelect={onCloseUserSelect}
        previewTransactionsCount={previewTransactionsCount}
        reviewElement={reviewElement}
        settingsElement={settingsElement}
        shouldShowUploadPanel={shouldShowUploadPanel}
        showSettingsView={showSettingsView}
        showUserSelectView={showUserSelectView}
        uploadElement={uploadElement}
        userSelectElement={userSelectElement}
      />
    </div>
  );
}
