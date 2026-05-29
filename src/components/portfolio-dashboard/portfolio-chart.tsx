import { useEffect } from "react";
import { ChartBar, ChartGantt } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";

import { ChartLegend } from "@/components/chart-primitives/chart-legend";
import { ChartReferenceLabel } from "@/components/chart-primitives/chart-reference-label";
import { ChartTimeRangeControls } from "@/components/chart-primitives/chart-time-range-controls";
import { ChartTooltip } from "@/components/chart-primitives/chart-tooltip";
import { useChartContainerReady } from "@/hooks/use-chart-container-ready";
import type { ActiveDotProps, ChartPoint } from "@/types/chart";

import { GRAYSCALE_PALETTE, TIME_RANGES } from "./constants";
import { formatEuroCents, formatProviderLabel, getMonthLabel } from "./formatters";
import type { PortfolioData, PortfolioProviderSummary, PortfolioSelectedPoint, TimeRange } from "./types";

function formatTooltipLabel(label?: string) {
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

function formatTooltipSeriesLabel(name: string) {
  if (name === "value" || name === "balance") return "BALANCE";
  if (name === "heritage") return "HERITAGE";
  return formatProviderLabel(name);
}

type PortfolioChartProps = {
  data: PortfolioData;
  activeProvider: PortfolioProviderSummary | null;
  activeTab: string;
  chartData: ChartPoint[];
  xAxisTicks: string[];
  timeRange: TimeRange;
  selectedPoint: PortfolioSelectedPoint | null;
  hiddenSeries: Record<string, boolean>;
  showSoldAssets: boolean;
  isMobile: boolean;
  transactionCount: number;
  onSetTimeRange: (range: TimeRange) => void;
  onSelectPoint: (point: PortfolioSelectedPoint | null) => void;
  onToggleSeries: (key: string) => void;
  onToggleSoldAssets: () => void;
  onSetActiveChartPoint: (point: ChartPoint | null) => void;
  onChartReadyChange: (ready: boolean) => void;
};

export function PortfolioChart({
  data,
  activeProvider,
  activeTab,
  chartData,
  xAxisTicks,
  timeRange,
  selectedPoint,
  hiddenSeries,
  showSoldAssets,
  isMobile,
  transactionCount,
  onSetTimeRange,
  onSelectPoint,
  onToggleSeries,
  onToggleSoldAssets,
  onSetActiveChartPoint,
  onChartReadyChange
}: PortfolioChartProps) {
  const yAxisWidth = isMobile ? 0 : 50;
  const baseMargin = isMobile ? 0 : 24;
  const { chartContainerRef, chartReady, chartSize } = useChartContainerReady();

  useEffect(() => {
    onChartReadyChange(chartReady);
  }, [chartReady, onChartReadyChange]);

  return (
    <>
      {activeTab !== "ALL" && (
        <div className="absolute left-0 top-0 z-10 flex items-center justify-start" style={{ marginLeft: isMobile ? 0 : 40 }}>
          <button
            aria-label="Toggle sold assets"
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[color:var(--text-dim)] transition-colors hover:bg-[rgba(255,255,255,0.08)] hover:text-white"
            onClick={(event) => { event.stopPropagation(); onToggleSoldAssets(); }}
            title={showSoldAssets ? "Nascondi asset venduti" : "Mostra asset venduti"}
            type="button"
          >
            {showSoldAssets ? <ChartGantt className="h-4 w-4" strokeWidth={2.2} /> : <ChartBar className="h-4 w-4" strokeWidth={2.2} />}
          </button>
        </div>
      )}
      <ChartTimeRangeControls
        onTimeRangeChange={onSetTimeRange}
        ranges={TIME_RANGES}
        timeRange={timeRange}
      />

      <div className="mt-10 flex-1 min-h-0 w-full outline-none" onClick={() => onSelectPoint(null)}>
        <div ref={chartContainerRef} className="relative h-full w-full">
          <div id="chart-reference-overlay" className="pointer-events-none absolute inset-0 z-10" />
          {chartReady ? (
            <LineChart width={chartSize.width} height={chartSize.height} data={chartData} margin={{ top: 8, right: baseMargin, bottom: 0, left: baseMargin }} accessibilityLayer={false}>
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
              <YAxis tick={{ fill: "#a8a8a8", fontSize: isMobile ? 9 : 10 }} axisLine={false} tickLine={false} mirror={isMobile} tickFormatter={(value) => formatEuroCents(value).replace(/\s/g, "").replace(",00", "")} width={yAxisWidth} />
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(154,154,154,0.12)" vertical={false} />
              <Tooltip
                content={(
                  <ChartTooltip
                    formatLabel={formatTooltipLabel}
                    formatSeriesLabel={formatTooltipSeriesLabel}
                    formatValue={formatEuroCents}
                    labelClassName="truncate max-w-[150px]"
                    priorityNames={["heritage", "value", "balance"]}
                    setActivePoint={onSetActiveChartPoint}
                  />
                )}
                cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1, fill: "transparent" }}
              />

              {activeTab === "ALL" ? (
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
                        strokeWidth={1.5}
                        isAnimationActive={false}
                        connectNulls={false}
                        activeDot={(props: ActiveDotProps) => {
                          const { cx, cy, payload } = props;
                          if (payload[providerKey] == null) return null;
                          return <circle cx={cx} cy={cy} r={6} fill="#1a1a1a" stroke={strokeColor} strokeWidth={2} style={{ cursor: "pointer", outline: "none" }} onClick={(event) => { event.stopPropagation(); onSelectPoint({ month: payload.rawMonth, seriesKey: providerKey, value: Number(payload[providerKey]) }); }} />;
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
                    connectNulls={false}
                    hide={!!hiddenSeries.heritage}
                    activeDot={(props: ActiveDotProps) => {
                      const { cx, cy, payload } = props;
                      if (payload.heritage == null) return null;
                      return (
                        <circle
                          cx={cx} cy={cy} r={6}
                          fill="#1a1a1a" stroke="#ffffff" strokeWidth={2}
                          style={{ cursor: "pointer", outline: "none" }}
                          onClick={(event) => { event.stopPropagation(); onSelectPoint({ month: payload.rawMonth, seriesKey: "heritage", value: Number(payload.heritage) }); }}
                        />
                      );
                    }}
                    dot={false}
                  />
                </>
              ) : (
                <>
                  {activeProvider?.products.map((product, index) => {
                    const productKey = product.productName;
                    const isSold = Math.abs(product.quantity) <= 0.000001;
                    if (!showSoldAssets && isSold) return null;
                    if (hiddenSeries[productKey]) return null;
                    const strokeColor = GRAYSCALE_PALETTE[index % GRAYSCALE_PALETTE.length];
                    return (
                      <Line
                        key={productKey}
                        type="linear"
                        dataKey={productKey}
                        name={productKey}
                        stroke={strokeColor}
                        strokeWidth={1.5}
                        isAnimationActive={false}
                        connectNulls={false}
                        activeDot={(props: ActiveDotProps) => {
                          const { cx, cy, payload } = props;
                          if (payload[productKey] == null) return null;
                          return (
                            <circle
                              cx={cx} cy={cy} r={5}
                              fill="#1a1a1a" stroke={strokeColor} strokeWidth={2}
                              style={{ cursor: "pointer", outline: "none" }}
                              onClick={(event) => { event.stopPropagation(); onSelectPoint({ month: payload.rawMonth, seriesKey: productKey, value: Number(payload[productKey]) }); }}
                            />
                          );
                        }}
                        dot={false}
                      />
                    );
                  })}
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
                      return (
                        <circle
                          cx={cx} cy={cy} r={6}
                          fill="#1a1a1a" stroke="#ffffff" strokeWidth={2}
                          style={{ cursor: "pointer", outline: "none" }}
                          onClick={(event) => { event.stopPropagation(); onSelectPoint({ month: payload.rawMonth, seriesKey: "balance", value: Number(payload.balance) }); }}
                        />
                      );
                    }}
                    dot={false}
                  />
                </>
              )}
              {selectedPoint && <ReferenceLine y={selectedPoint.value} stroke="rgba(254, 254, 254, 0.5)" strokeWidth={1.5} strokeDasharray="6 4" label={<ChartReferenceLabel selectedValue={selectedPoint.value} />} />}
            </LineChart>
          ) : null}
        </div>
      </div>

      {activeTab === "ALL" ? (() => {
          const allSeriesKeys = ["heritage", ...data.providers.map(provider => provider.sourceInstitution)];

          return (
            <ChartLegend
              className="flex flex-wrap items-center justify-center gap-3 pt-2 pb-0 sm:gap-4 overflow-x-auto max-h-[100px] hide-scrollbar"
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
          let metricKeys = ["balance", ...(activeProvider?.products.map(product => product.productName) || [])];

          if (!showSoldAssets) {
            metricKeys = metricKeys.filter(key => {
              if (key === "balance") return true;
              const product = activeProvider?.products.find(item => item.productName === key);
              if (product && Math.abs(product.quantity) <= 0.000001) return false;
              return true;
            });
          }

          return (
            <ChartLegend
              className="flex flex-wrap items-center justify-center gap-3 pt-2 pb-0 sm:gap-4 overflow-x-auto max-h-[100px] hide-scrollbar"
              hiddenSeries={hiddenSeries}
              items={metricKeys.map((key, index) => {
                const isBalance = key === "balance";
                return {
                  key,
                  label: isBalance ? "BALANCE" : key,
                  color: isBalance ? "#ffffff" : GRAYSCALE_PALETTE[(index - 1) % GRAYSCALE_PALETTE.length],
                  labelClassName: "truncate"
                };
              })}
              labelClassName="max-w-[150px]"
              onToggleSeries={onToggleSeries}
              transactionCount={transactionCount}
            />
          );
        })()}
    </>
  );
}
