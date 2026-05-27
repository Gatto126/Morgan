import { useEffect } from "react";
import { createPortal } from "react-dom";
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";

import { useChartContainerReady } from "@/hooks/use-chart-container-ready";
import { cn } from "@/lib/utils";
import type { ActiveDotProps, ChartPoint, ChartTooltipPayload } from "@/types/chart";

import { GRAYSCALE_PALETTE, TIME_RANGES } from "./constants";
import { formatEuroCents, formatProviderLabel, getMonthLabel } from "./formatters";
import type { CheckingData, CheckingSelectedPoint, TimeRange } from "./types";

type CustomTooltipProps = {
  active?: boolean;
  payload?: ChartTooltipPayload[];
  label?: string;
  setActivePoint: (point: ChartPoint | null) => void;
};

function ChartTooltip({ active, payload, label, setActivePoint }: CustomTooltipProps) {
  useEffect(() => {
    if (active && payload && payload.length > 0) {
      setActivePoint(payload[0].payload ?? null);
    } else {
      setActivePoint(null);
    }
  }, [active, payload, setActivePoint]);

  if (!active || !payload?.length) return null;

  let formattedLabel = label || "";
  if (formattedLabel.length === 10) {
    const [year, month, day] = formattedLabel.split("-");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    formattedLabel = `${day} ${monthNames[Number.parseInt(month, 10) - 1]} ${year.slice(2)}`;
  } else if (formattedLabel.length === 7) {
    formattedLabel = getMonthLabel(formattedLabel);
  }

  return (
    <div className="rounded-xl border border-[rgba(154,154,154,0.4)] bg-[rgba(35,35,35,0.96)] p-2 px-3.5 text-[13px] text-[#f5f5f5]">
      <div className="mb-1.5 font-bold">{formattedLabel}</div>
      <div className="flex flex-col gap-1">
        {[...payload].sort((left, right) => {
          if (left.name === "heritage" || left.name === "value") return -1;
          if (right.name === "heritage" || right.name === "value") return 1;
          return (right.value || 0) - (left.value || 0);
        }).map((payloadItem, index) => {
          const name = String(payloadItem.name ?? "");
          let labelStr = "";
          if (name === "value") {
            labelStr = "TOTAL";
          } else if (name === "heritage") {
            labelStr = "HERITAGE";
          } else if (name === "balance") {
            labelStr = "BALANCE";
          } else if (name === "income") {
            labelStr = "INCOME";
          } else if (name === "expenses") {
            labelStr = "EXPENSES";
          } else {
            labelStr = formatProviderLabel(name);
          }

          return (
            <div key={index} className="flex items-center justify-between gap-6">
              <span className="text-[10px] font-bold uppercase text-white">{labelStr}</span>
              <span className="font-semibold">{formatEuroCents(payloadItem.value)}</span>
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

  const rawValue = typeof selectedValue === "number" ? selectedValue : (typeof value === "number" ? value : 0);
  const formattedValue = new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(rawValue / 100);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const rectWidth = isMobile ? 64 : 72;
  const rectHeight = 24;
  const top = viewBox.y - rectHeight / 2;
  const left = isMobile ? Math.max(2, viewBox.x - rectWidth / 2) : viewBox.x - rectWidth + 2;
  const overlayTarget = typeof document !== "undefined" ? document.getElementById("chart-reference-overlay") : null;

  if (!overlayTarget) return null;

  return createPortal(
    <div
      className="pointer-events-none absolute z-[100] flex items-center justify-center rounded-[12px] border-2 border-[#444444] bg-[#1a1a1a] shadow-[0_4px_6px_-1px_rgba(0,0,0,0.4)]"
      style={{ top, left, width: rectWidth, height: rectHeight }}
    >
      <span className="whitespace-nowrap text-[10px] font-bold text-white">
        {isMobile ? formattedValue.replace(/\s/g, "").replace(",00", "") : formattedValue.replace(/\s/g, "")}
      </span>
    </div>,
    overlayTarget
  );
};

type CheckingChartProps = {
  data: CheckingData;
  activeTab: string;
  chartData: ChartPoint[];
  xAxisTicks: string[];
  timeRange: TimeRange;
  selectedPoint: CheckingSelectedPoint | null;
  hiddenSeries: Record<string, boolean>;
  isMobile: boolean;
  transactionCount: number;
  onSetTimeRange: (range: TimeRange) => void;
  onSelectPoint: (point: CheckingSelectedPoint | null) => void;
  onToggleSeries: (key: string) => void;
  onSetActiveChartPoint: (point: ChartPoint | null) => void;
  onChartReadyChange: (ready: boolean) => void;
};

export function CheckingChart({
  data,
  activeTab,
  chartData,
  xAxisTicks,
  timeRange,
  selectedPoint,
  hiddenSeries,
  isMobile,
  transactionCount,
  onSetTimeRange,
  onSelectPoint,
  onToggleSeries,
  onSetActiveChartPoint,
  onChartReadyChange
}: CheckingChartProps) {
  const yAxisWidth = isMobile ? 0 : 50;
  const baseMargin = isMobile ? 0 : 24;
  const { chartContainerRef, chartReady, chartSize } = useChartContainerReady();

  useEffect(() => {
    onChartReadyChange(chartReady);
  }, [chartReady, onChartReadyChange]);

  return (
    <>
      <div className="absolute right-0 top-0 z-10 flex items-center justify-end gap-0.5">
        {TIME_RANGES.map((range) => (
          <button
            key={range}
            type="button"
            onClick={() => onSetTimeRange(range)}
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
        <div ref={chartContainerRef} className="relative w-full h-full" onClick={() => onSelectPoint(null)}>
          <div id="chart-reference-overlay" className="absolute inset-0 pointer-events-none z-10" />
          <style dangerouslySetInnerHTML={{ __html: `
            .recharts-wrapper, .recharts-wrapper *, .recharts-surface, .recharts-surface *, .recharts-container, .recharts-container * {
              outline: none !important;
              box-shadow: none !important;
            }
          `}} />
          {chartReady ? (
          <LineChart
            width={chartSize.width}
            height={chartSize.height}
            data={chartData}
            margin={{ top: 8, right: baseMargin, bottom: 0, left: baseMargin }}
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
                    return `${Math.round(value / 100000)}k`;
                  }
                  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value / 100);
                }}
                width={yAxisWidth}
              />
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(154,154,154,0.12)" vertical={false} />
              <Tooltip content={<ChartTooltip setActivePoint={onSetActiveChartPoint} />} cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1, fill: "transparent" }} />

              {activeTab !== "ALL" ? (
                <>
                  <Line
                    type="linear"
                    dataKey="income"
                    name="income"
                    stroke="#8f8f8f"
                    strokeWidth={2}
                    isAnimationActive={false}
                    connectNulls={false}
                    hide={!!hiddenSeries.income}
                    activeDot={(props: ActiveDotProps) => {
                      const { cx, cy, payload } = props;
                      if (payload.income == null) return null;
                      return (
                        <circle
                          cx={cx} cy={cy} r={5}
                          fill="#1a1a1a" stroke="#8f8f8f" strokeWidth={2}
                          style={{ cursor: "pointer", outline: "none" }}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectPoint({ month: payload.rawMonth, seriesKey: "income", value: Number(payload.income) });
                          }}
                        />
                      );
                    }}
                    dot={false}
                  />
                  <Line
                    type="linear"
                    dataKey="expenses"
                    name="expenses"
                    stroke="#404040"
                    strokeWidth={2}
                    isAnimationActive={false}
                    connectNulls={false}
                    hide={!!hiddenSeries.expenses}
                    activeDot={(props: ActiveDotProps) => {
                      const { cx, cy, payload } = props;
                      if (payload.expenses == null) return null;
                      return (
                        <circle
                          cx={cx} cy={cy} r={5}
                          fill="#1a1a1a" stroke="#404040" strokeWidth={2}
                          style={{ cursor: "pointer", outline: "none" }}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectPoint({ month: payload.rawMonth, seriesKey: "expenses", value: Number(payload.expenses) });
                          }}
                        />
                      );
                    }}
                    dot={false}
                  />
                  <Line
                    key={`balance-${Object.keys(hiddenSeries).sort().map(key => hiddenSeries[key] ? "0" : "1").join("")}`}
                    type="linear"
                    dataKey="balance"
                    name="balance"
                    stroke="#ffffff"
                    strokeWidth={2.5}
                    isAnimationActive={false}
                    connectNulls={false}
                    hide={!!hiddenSeries.balance}
                    activeDot={(props: ActiveDotProps) => {
                      const { cx, cy, payload } = props;
                      if (payload.balance == null) return null;
                      return (
                        <circle
                          cx={cx} cy={cy} r={6}
                          fill="#1a1a1a" stroke="#ffffff" strokeWidth={2}
                          style={{ cursor: "pointer", outline: "none" }}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectPoint({ month: payload.rawMonth, seriesKey: "balance", value: Number(payload.balance) });
                          }}
                        />
                      );
                    }}
                    dot={false}
                  />
                </>
              ) : (
                <>
                  {data.providers.map((provider, index) => {
                    const providerKey = provider.sourceInstitution;
                    if (hiddenSeries[providerKey]) return null;

                    const strokeColor = GRAYSCALE_PALETTE[index % GRAYSCALE_PALETTE.length];
                    return (
                      <Line
                        key={providerKey}
                        type="linear"
                        dataKey={providerKey}
                        name={providerKey}
                        stroke={strokeColor}
                        strokeWidth={2}
                        isAnimationActive={false}
                        connectNulls={false}
                        activeDot={(props: ActiveDotProps) => {
                          const { cx, cy, payload } = props;
                          if (payload[providerKey] == null) return null;
                          return (
                            <circle
                              cx={cx} cy={cy} r={6}
                              fill="#1a1a1a" stroke={strokeColor} strokeWidth={2}
                              style={{ cursor: "pointer", outline: "none" }}
                              onClick={(event) => {
                                event.stopPropagation();
                                onSelectPoint({ month: payload.rawMonth, seriesKey: providerKey, value: Number(payload[providerKey]) });
                              }}
                            />
                          );
                        }}
                        dot={false}
                      />
                    );
                  })}
                  <Line
                    key={`heritage-${Object.keys(hiddenSeries).sort().map(key => hiddenSeries[key] ? "0" : "1").join("")}`}
                    type="linear"
                    dataKey="heritage"
                    name="heritage"
                    stroke="#ffffff"
                    strokeWidth={2.5}
                    isAnimationActive={false}
                    hide={!!hiddenSeries.heritage}
                    activeDot={(props: ActiveDotProps) => {
                      const { cx, cy, payload } = props;
                      if (payload.heritage == null) return null;
                      return (
                        <circle
                          cx={cx} cy={cy} r={6}
                          fill="#1a1a1a" stroke="#ffffff" strokeWidth={2}
                          style={{ cursor: "pointer", outline: "none" }}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectPoint({ month: payload.rawMonth, seriesKey: "heritage", value: Number(payload.heritage) });
                          }}
                        />
                      );
                    }}
                    dot={false}
                  />
                </>
              )}

              {selectedPoint && (
                <ReferenceLine
                  y={selectedPoint.value}
                  stroke="rgba(254, 254, 254, 0.5)"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  label={<CustomReferenceLabel selectedValue={selectedPoint.value} />}
                />
              )}
          </LineChart>
          ) : null}
        </div>
      </div>

      {activeTab === "ALL" ? (() => {
        const allSeriesKeys = ["heritage", ...data.providers.map(provider => provider.sourceInstitution)];
        const visibleCount = allSeriesKeys.filter(key => !hiddenSeries[key]).length;

        return (
          <div
            className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap w-full pt-2 pb-0"
            style={{ visibility: transactionCount > 0 ? "visible" : "hidden" }}
          >
            {allSeriesKeys.map((key, index) => {
              const color = key === "heritage" ? "#ffffff" : GRAYSCALE_PALETTE[(index - 1) % GRAYSCALE_PALETTE.length];
              const isLastVisible = !hiddenSeries[key] && visibleCount <= 1;

              return (
                <div key={key} style={{ color: hiddenSeries[key] ? "#4C4C4C" : color }}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (isLastVisible) return;
                      onToggleSeries(key);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        if (isLastVisible) return;
                        onToggleSeries(key);
                      }
                    }}
                    className={`flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider select-none outline-none ${
                      isLastVisible ? "cursor-not-allowed" : "cursor-pointer"
                    }`}
                    style={{ WebkitTapHighlightColor: "transparent", color: "inherit" }}
                  >
                    <div className="w-[14px] h-[6px] sm:w-[16px] sm:h-[8px] rounded-full" style={{ backgroundColor: hiddenSeries[key] ? "#4C4C4C" : color }} />
                    <span className={cn(hiddenSeries[key] && "line-through")}>
                      {key === "heritage" ? "HERITAGE" : formatProviderLabel(key)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })() : (() => {
        const metrics = ["balance", "income", "expenses"];
        const visibleCount = metrics.filter(key => !hiddenSeries[key]).length;
        const metricColors: Record<string, string> = {
          balance: "#ffffff",
          income: "#8f8f8f",
          expenses: "#404040"
        };

        return (
          <div
            className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap w-full pt-2 pb-0"
            style={{ visibility: transactionCount > 0 ? "visible" : "hidden" }}
          >
            {metrics.map((metric) => {
              const isLastVisible = !hiddenSeries[metric] && visibleCount <= 1;
              const color = metricColors[metric];

              return (
                <div key={metric} style={{ color: hiddenSeries[metric] ? "#4C4C4C" : color }}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (isLastVisible) return;
                      onToggleSeries(metric);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        if (isLastVisible) return;
                        onToggleSeries(metric);
                      }
                    }}
                    className={`flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider select-none outline-none ${
                      isLastVisible ? "cursor-not-allowed" : "cursor-pointer"
                    }`}
                    style={{ WebkitTapHighlightColor: "transparent", color: "inherit" }}
                  >
                    <div className="w-[14px] h-[6px] sm:w-[16px] sm:h-[8px] rounded-full" style={{ backgroundColor: hiddenSeries[metric] ? "#4C4C4C" : color }} />
                    <span className={cn(hiddenSeries[metric] && "line-through")}>{metric}</span>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}
    </>
  );
}
