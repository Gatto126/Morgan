import { useEffect } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";

import { ChartLegend } from "@/components/chart-primitives/chart-legend";
import { ChartReferenceLabel } from "@/components/chart-primitives/chart-reference-label";
import { ChartTimeRangeControls } from "@/components/chart-primitives/chart-time-range-controls";
import { ChartTooltip } from "@/components/chart-primitives/chart-tooltip";
import { useChartContainerReady } from "@/hooks/use-chart-container-ready";
import type { ActiveDotProps, ChartPoint } from "@/types/chart";

import { GRAYSCALE_PALETTE, TIME_RANGES } from "./constants";
import { formatEuroCents, formatProviderLabel, getMonthLabel } from "./formatters";
import type { CheckingData, CheckingSelectedPoint, TimeRange } from "./types";

function formatTooltipLabel(label?: string) {
  let formattedLabel = label || "";
  if (formattedLabel.length === 10) {
    const [year, month, day] = formattedLabel.split("-");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    formattedLabel = `${day} ${monthNames[Number.parseInt(month, 10) - 1]} ${year.slice(2)}`;
  } else if (formattedLabel.length === 7) {
    formattedLabel = getMonthLabel(formattedLabel);
  }

  return formattedLabel;
}

function formatTooltipSeriesLabel(name: string) {
  if (name === "value") return "TOTAL";
  if (name === "heritage") return "HERITAGE";
  if (name === "balance") return "BALANCE";
  if (name === "income") return "INCOME";
  if (name === "expenses") return "EXPENSES";
  return formatProviderLabel(name);
}

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
      <ChartTimeRangeControls
        onTimeRangeChange={onSetTimeRange}
        ranges={TIME_RANGES}
        timeRange={timeRange}
      />

      <div className="flex-1 min-h-0 w-full pt-10 focus:outline-none outline-none">
        <div ref={chartContainerRef} className="relative w-full h-full" onClick={() => onSelectPoint(null)}>
          <div id="chart-reference-overlay" className="absolute inset-0 pointer-events-none z-10" />
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
              <Tooltip
                content={(
                  <ChartTooltip
                    formatLabel={formatTooltipLabel}
                    formatSeriesLabel={formatTooltipSeriesLabel}
                    formatValue={formatEuroCents}
                    setActivePoint={onSetActiveChartPoint}
                  />
                )}
                cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1, fill: "transparent" }}
              />

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
                  label={<ChartReferenceLabel selectedValue={selectedPoint.value} />}
                />
              )}
          </LineChart>
          ) : null}
        </div>
      </div>

      {activeTab === "ALL" ? (() => {
        const allSeriesKeys = ["heritage", ...data.providers.map(provider => provider.sourceInstitution)];

        return (
          <ChartLegend
            hiddenSeries={hiddenSeries}
            items={allSeriesKeys.map((key, index) => ({
              key,
              label: key === "heritage" ? "HERITAGE" : formatProviderLabel(key),
              color: key === "heritage" ? "#ffffff" : GRAYSCALE_PALETTE[(index - 1) % GRAYSCALE_PALETTE.length]
            }))}
            onToggleSeries={onToggleSeries}
            transactionCount={transactionCount}
          />
        );
      })() : (() => {
        const metrics = ["balance", "income", "expenses"];
        const metricColors: Record<string, string> = {
          balance: "#ffffff",
          income: "#8f8f8f",
          expenses: "#404040"
        };

        return (
          <ChartLegend
            hiddenSeries={hiddenSeries}
            items={metrics.map((metric) => ({
              key: metric,
              label: metric,
              color: metricColors[metric]
            }))}
            onToggleSeries={onToggleSeries}
            transactionCount={transactionCount}
          />
        );
      })()}
    </>
  );
}
