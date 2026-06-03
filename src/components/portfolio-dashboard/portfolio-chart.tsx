import { ChartBar, ChartGantt } from "lucide-react";
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";

import { ChartLegend } from "@/components/chart-primitives/chart-legend";
import { ChartReferenceLabel } from "@/components/chart-primitives/chart-reference-label";
import { ChartTimeRangeControls } from "@/components/chart-primitives/chart-time-range-controls";
import { ChartTooltip } from "@/components/chart-primitives/chart-tooltip";
import { SelectableChartDot } from "@/components/chart-primitives/selectable-chart-dot";
import { useStableChartFrame } from "@/hooks/use-stable-chart-frame";
import type { ActiveDotProps, ChartPoint } from "@/types/chart";

import { GRAYSCALE_PALETTE, TIME_RANGES } from "./constants";
import {
  formatPortfolioTooltipLabel,
  formatPortfolioTooltipSeriesLabel,
  formatPortfolioXAxisTick,
  getPortfolioAllLegendItems,
  getPortfolioProviderLegendItems,
  hasRenderablePortfolioLineSeries,
  shouldRenderStandalonePortfolioPointSeries,
  PORTFOLIO_TOOLTIP_PRIORITY_NAMES
} from "./portfolio-chart-model";
import { formatEuroCents } from "./formatters";
import type { PortfolioData, PortfolioProviderSummary, PortfolioSelectedPoint, TimeRange } from "./types";

const FALLBACK_CHART_SIZE = { width: 960, height: 460 };

type PortfolioChartProps = {
  data: PortfolioData;
  activeProvider: PortfolioProviderSummary | null;
  activeTab: string;
  aggregateLegendLabel?: string;
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
  aggregateLegendLabel = "HERITAGE",
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
  const { chartContainerRef, renderedChartSize, seriesReady } = useStableChartFrame({
    fallbackSize: FALLBACK_CHART_SIZE,
    onFrameReadyChange: onChartReadyChange
  });
  const hiddenSeriesSignature = Object.keys(hiddenSeries).sort().map(key => hiddenSeries[key] ? "0" : "1").join("");
  const isAggregateVisible = !hiddenSeries.heritage;
  const formatSeriesLabel = (name: string) => formatPortfolioTooltipSeriesLabel(name, aggregateLegendLabel);

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
          <LineChart
            width={renderedChartSize.width}
            height={renderedChartSize.height}
            data={chartData}
            margin={{ top: 8, right: baseMargin, bottom: 0, left: baseMargin }}
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
              tickFormatter={(value) => formatPortfolioXAxisTick(String(value ?? ""))}
            />
            <YAxis
              tick={{ fill: "#a8a8a8", fontSize: isMobile ? 9 : 10 }}
              axisLine={false}
              tickLine={false}
              mirror={isMobile}
              tickFormatter={(value) => formatEuroCents(value).replace(/\s/g, "").replace(",00", "")}
              width={yAxisWidth}
            />
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(154,154,154,0.12)" vertical={false} />
            <Tooltip
              content={(
                <ChartTooltip
                  formatLabel={formatPortfolioTooltipLabel}
                  formatSeriesLabel={formatSeriesLabel}
                  formatValue={formatEuroCents}
                  labelClassName="truncate max-w-[150px]"
                  priorityNames={PORTFOLIO_TOOLTIP_PRIORITY_NAMES}
                  setActivePoint={onSetActiveChartPoint}
                />
              )}
              cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1, fill: "transparent" }}
            />

            {seriesReady && activeTab === "ALL" ? (
              <>
                {data.providers.map((provider, index) => {
                  const providerKey = provider.sourceInstitution;
                  if (hiddenSeries[providerKey]) return null;
                  const strokeColor = GRAYSCALE_PALETTE[index % GRAYSCALE_PALETTE.length];
                  const hasLine = hasRenderablePortfolioLineSeries(chartData, providerKey);
                  const shouldRenderStandalonePoint =
                    !hasLine && shouldRenderStandalonePortfolioPointSeries(chartData, providerKey, isAggregateVisible);

                  if (!hasLine && !shouldRenderStandalonePoint) return null;

                  if (shouldRenderStandalonePoint) {
                    return (
                      <Line
                        key={`${providerKey}-point-${hiddenSeriesSignature}`}
                        type="linear"
                        dataKey={providerKey}
                        name={providerKey}
                        stroke="transparent"
                        strokeWidth={0}
                        isAnimationActive={false}
                        connectNulls={false}
                        activeDot={false}
                        dot={(props: ActiveDotProps) => (
                          <SelectableChartDot
                            {...props}
                            color={strokeColor}
                            onSelectPoint={onSelectPoint}
                            radius={5}
                            seriesKey={providerKey}
                          />
                        )}
                      />
                    );
                  }

                  return (
                    <Line
                      key={`${providerKey}-line-${hiddenSeriesSignature}`}
                      type="linear"
                      dataKey={providerKey}
                      name={providerKey}
                      stroke={strokeColor}
                      strokeWidth={1.5}
                      isAnimationActive={false}
                      connectNulls={false}
                      activeDot={(props: ActiveDotProps) => (
                        <SelectableChartDot
                          {...props}
                          color={strokeColor}
                          onSelectPoint={onSelectPoint}
                          seriesKey={providerKey}
                        />
                      )}
                      dot={false}
                    />
                  );
                })}
                {isAggregateVisible && hasRenderablePortfolioLineSeries(chartData, "heritage") ? (
                  <Line
                    key={`heritage-${hiddenSeriesSignature}`}
                    type="linear"
                    dataKey="heritage"
                    name="heritage"
                    stroke="#ffffff"
                    strokeWidth={2.5}
                    isAnimationActive={false}
                    connectNulls={false}
                    activeDot={(props: ActiveDotProps) => (
                      <SelectableChartDot
                        {...props}
                        color="#ffffff"
                        onSelectPoint={onSelectPoint}
                        seriesKey="heritage"
                      />
                    )}
                    dot={false}
                  />
                ) : null}
              </>
            ) : seriesReady ? (
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
                      activeDot={(props: ActiveDotProps) => (
                        <SelectableChartDot
                          {...props}
                          color={strokeColor}
                          onSelectPoint={onSelectPoint}
                          radius={5}
                          seriesKey={productKey}
                        />
                      )}
                      dot={false}
                    />
                  );
                })}
                <Line
                  key={`balance-${hiddenSeriesSignature}`}
                  type="linear"
                  dataKey="balance"
                  name="balance"
                  stroke="#ffffff"
                  strokeWidth={2.5}
                  isAnimationActive={false}
                  connectNulls={false}
                  hide={!!hiddenSeries.balance}
                  activeDot={(props: ActiveDotProps) => (
                    <SelectableChartDot
                      {...props}
                      color="#ffffff"
                      onSelectPoint={onSelectPoint}
                      seriesKey="balance"
                    />
                  )}
                  dot={false}
                />
              </>
            ) : null}
            {seriesReady && selectedPoint ? (
              <ReferenceLine
                y={selectedPoint.value}
                stroke="rgba(254, 254, 254, 0.5)"
                strokeWidth={1.5}
                strokeDasharray="6 4"
                label={<ChartReferenceLabel selectedValue={selectedPoint.value} />}
              />
            ) : null}
          </LineChart>
        </div>
      </div>

      <ChartLegend
        className="flex flex-wrap items-center justify-center gap-3 pt-2 pb-0 sm:gap-4 overflow-x-auto max-h-[100px] hide-scrollbar"
        hiddenSeries={hiddenSeries}
        items={activeTab === "ALL"
          ? getPortfolioAllLegendItems(data.providers, aggregateLegendLabel)
          : getPortfolioProviderLegendItems(activeProvider, showSoldAssets)}
        labelClassName={activeTab === "ALL" ? undefined : "max-w-[150px]"}
        onToggleSeries={onToggleSeries}
        transactionCount={transactionCount}
      />
    </>
  );
}
