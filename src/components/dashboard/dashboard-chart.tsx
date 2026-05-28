import type { ReactNode } from "react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ChartBar, ChartGantt, X } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { useChartContainerReady } from "@/hooks/use-chart-container-ready";
import { cn } from "@/shared/utils";
import { TIME_RANGES } from "./constants";
import { formatEuroCents, formatProviderLabel, getMonthLabel } from "./formatters";
import type { AccountTab, TimeRange } from "./types";

export type DashboardChartPoint = Record<string, string | number | null | undefined>;

export type DashboardChartConfig = {
  mainKey: string;
  mainLabel: string;
  subLines: Array<{
    key: string;
    label: string;
    stroke: string;
  }>;
};

type TooltipPayloadItem = {
  name: string;
  value: number;
  payload?: DashboardChartPoint;
  dataKey?: string | number;
};

type CustomTooltipProps = {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  setActivePoint: (point: DashboardChartPoint | null) => void;
};

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

function ChartTooltip({ active, payload, label, setActivePoint }: CustomTooltipProps) {
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
          .filter((p) => p.name !== "referenceLineValue" && p.dataKey !== "referenceLineValue")
          .sort((a, b) => {
            const isMainA = ["heritage", "checking", "investment", "crypto", "value"].includes(a.name);
            const isMainB = ["heritage", "checking", "investment", "crypto", "value"].includes(b.name);
            if (isMainA && !isMainB) return -1;
            if (!isMainA && isMainB) return 1;
            return (b.value || 0) - (a.value || 0);
          })
          .map((p, index) => {
            let labelStr = "";
            if (p.name === "value") {
              labelStr = "TOTAL";
            } else if (["heritage", "checking", "investment", "crypto"].includes(p.name)) {
              labelStr = String(p.name).toUpperCase();
            } else {
              labelStr = formatProviderLabel(p.name);
            }
            return (
              <div key={index} className="flex justify-between gap-6 items-center">
                <span className="text-[10px] font-bold uppercase" style={{ color: "#ffffff" }}>
                  {labelStr}
                </span>
                <span className="font-semibold">{formatEuroCents(p.value)}</span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

const CustomReferenceLabel = (props: { viewBox?: { x: number; y: number }; value?: number; selectedValue?: number | null }) => {
  const { viewBox, value, selectedValue } = props;
  if (!viewBox) return null;

  const val = typeof selectedValue === "number" ? selectedValue : (typeof value === "number" ? value : 0);

  const formattedValue = new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(val / 100);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const rectWidth = isMobile ? 64 : 72;
  const rectHeight = 24;

  const top = viewBox.y - rectHeight / 2;
  const left = isMobile
    ? Math.max(2, viewBox.x - rectWidth / 2)
    : viewBox.x - rectWidth + 2;

  const overlayTarget = typeof document !== "undefined" ? document.getElementById("chart-reference-overlay") : null;
  if (!overlayTarget) return null;

  return createPortal(
    <div
      style={{
        position: "absolute",
        top,
        left,
        width: rectWidth,
        height: rectHeight,
        backgroundColor: "#1a1a1a",
        border: "2px solid #444444",
        borderRadius: "12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 100,
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.4)"
      }}
    >
      <span style={{
        color: "#ffffff",
        fontSize: "10px",
        fontWeight: "bold",
        whiteSpace: "nowrap"
      }}>
        {isMobile ? formattedValue.replace(/\s/g, "").replace(",00", "") : formattedValue.replace(/\s/g, "")}
      </span>
    </div>,
    overlayTarget
  );
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

  const panelOverlay = showSettingsView ? (
    <div className={cn("absolute inset-0 z-20 flex h-full w-full flex-col justify-center overflow-hidden rounded-[18px] bg-[color:var(--surface-canvas)]", isClosingSettings ? "upload-panel-exit pointer-events-none" : "upload-panel-enter")}>
      <div
        role="button"
        onClick={onCloseSettings}
        className="absolute right-0 top-0 z-50 flex h-8 w-8 cursor-pointer items-center justify-center text-[color:var(--text-dim)] transition-colors hover:text-white"
        title="Esci dalle impostazioni"
      >
        <X className="h-5 w-5" strokeWidth={2.3} />
      </div>
      {settingsElement}
    </div>
  ) : showUserSelectView ? (
    <div className={cn("absolute inset-0 z-20 flex h-full w-full flex-col justify-center overflow-hidden rounded-[18px] bg-[color:var(--surface-canvas)]", isClosingUserSelect ? "upload-panel-exit pointer-events-none" : "upload-panel-enter")}>
      <div
        role="button"
        onClick={onCloseUserSelect}
        className="absolute right-0 top-0 z-50 flex h-8 w-8 cursor-pointer items-center justify-center text-[color:var(--text-dim)] transition-colors hover:text-white"
        title="Esci dalla selezione utente"
      >
        <X className="h-5 w-5" strokeWidth={2.3} />
      </div>
      {userSelectElement}
    </div>
  ) : shouldShowUploadPanel ? (
    <div className={cn("absolute inset-0 z-20 flex h-full w-full flex-col justify-center overflow-hidden rounded-[18px] bg-[color:var(--surface-canvas)]", isClosingUpload ? "upload-panel-exit pointer-events-none" : "upload-panel-enter")}>
      <div
        role="button"
        onClick={onCloseUpload}
        className="absolute right-0 top-0 z-50 flex h-8 w-8 cursor-pointer items-center justify-center text-[color:var(--text-dim)] transition-colors hover:text-white"
        title="Esci dall'importazione"
      >
        <X className="h-5 w-5" strokeWidth={2.3} />
      </div>
      {previewTransactionsCount > 0 ? reviewElement : uploadElement}
    </div>
  ) : null;

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

          <div className="flex-1 min-h-0 w-full pt-10 focus:outline-none outline-none">
            <div ref={chartContainerRef} className="relative w-full h-full" onClick={() => { setSelectedMonth(null); setSelectedSeriesKey(null); }}>
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
                    content={<ChartTooltip setActivePoint={setActiveChartPoint} />}
                    cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1, fill: "transparent" }}
                  />
                  {chartConfig.subLines.map((sub) => {
                    if (hiddenSeries[sub.key]) return null;
                    return (
                      <Line
                        key={sub.key}
                        type="linear"
                        dataKey={sub.key}
                        name={sub.key}
                        stroke={sub.stroke}
                        strokeWidth={2}
                        isAnimationActive={false}
                        connectNulls={false}
                        activeDot={(props: { cx?: number; cy?: number; payload?: Record<string, string | number | null> }) => {
                          const { cx, cy, payload } = props;
                          if (cx === undefined || cy === undefined || !payload || payload[sub.key] == null) return null;
                          return (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={5}
                              fill="#1a1a1a"
                              stroke={sub.stroke}
                              strokeWidth={2}
                              style={{ cursor: "pointer", outline: "none" }}
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedMonth(payload.rawMonth as string);
                                setSelectedSeriesKey(sub.key);
                              }}
                            />
                          );
                        }}
                        dot={false}
                      />
                    );
                  })}

                  {!hiddenSeries[activeTab] && (
                    <Line
                      key={`${activeTab}-${Object.keys(hiddenSeries).sort().map((key) => hiddenSeries[key] ? "0" : "1").join("")}`}
                      type="linear"
                      dataKey="value"
                      name={activeTab}
                      stroke="#ffffff"
                      strokeWidth={2.5}
                      isAnimationActive={false}
                      connectNulls={false}
                      activeDot={(props: { cx?: number; cy?: number; payload?: Record<string, string | number | null> }) => {
                        const { cx, cy, payload } = props;
                        if (cx === undefined || cy === undefined || !payload || payload.value == null) return null;
                        return (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={6}
                            fill="#1a1a1a"
                            stroke="#ffffff"
                            strokeWidth={2}
                            style={{ cursor: "pointer", outline: "none" }}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedMonth(payload.rawMonth as string);
                              setSelectedSeriesKey("value");
                            }}
                          />
                        );
                      }}
                      dot={false}
                    />
                  )}

                  {selectedValue !== null && (
                    <Line
                      key={`ref-line-path-${selectedValue}-${Object.keys(hiddenSeries).sort().map((key) => hiddenSeries[key] ? "0" : "1").join("")}`}
                      type="linear"
                      dataKey="referenceLineValue"
                      stroke="rgba(254, 254, 254, 0.5)"
                      strokeWidth={1.5}
                      strokeDasharray="6 4"
                      dot={false}
                      activeDot={false}
                      isAnimationActive={false}
                    />
                  )}

                  {selectedValue !== null && (
                    <ReferenceLine
                      key={`ref-line-label-${selectedValue}-${Object.keys(hiddenSeries).sort().map((key) => hiddenSeries[key] ? "0" : "1").join("")}`}
                      y={selectedValue}
                      stroke="transparent"
                      label={<CustomReferenceLabel selectedValue={selectedValue} />}
                    />
                  )}
              </LineChart>
              ) : null}
            </div>
          </div>

          {(() => {
            const allSeriesKeys = [activeTab, ...chartConfig.subLines.map((series) => series.key)];
            const visibleCount = allSeriesKeys.filter((key) => !hiddenSeries[key]).length;

            return (
              <div
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
          })()}
            </>
          )}
      </div>
      {panelOverlay}
    </div>
  );
}
