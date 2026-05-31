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
  formatCheckingTooltipLabel,
  formatCheckingTooltipSeriesLabel,
  formatCheckingXAxisTick,
  formatCheckingYAxisTick,
  getCheckingAllLegendItems,
  getCheckingMetricLegendItems
} from "./checking-chart-model";
import { formatEuroCents } from "./formatters";
import type { CheckingData, CheckingSelectedPoint, TimeRange } from "./types";

const FALLBACK_CHART_SIZE = { width: 960, height: 460 };

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
  const { chartContainerRef, renderedChartSize, seriesReady } = useStableChartFrame({
    fallbackSize: FALLBACK_CHART_SIZE,
    onFrameReadyChange: onChartReadyChange
  });

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
          <LineChart
            width={renderedChartSize.width}
            height={renderedChartSize.height}
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
              tickFormatter={(value) => formatCheckingXAxisTick(String(value ?? ""))}
            />
            <YAxis
              tick={{ fill: "#a8a8a8", fontSize: isMobile ? 9 : 10, dx: isMobile ? 4 : 0 }}
              axisLine={false}
              tickLine={false}
              mirror={isMobile}
              tickFormatter={(value: number) => formatCheckingYAxisTick(value, isMobile)}
              width={yAxisWidth}
            />
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(154,154,154,0.12)" vertical={false} />
            <Tooltip
              content={(
                <ChartTooltip
                  formatLabel={formatCheckingTooltipLabel}
                  formatSeriesLabel={formatCheckingTooltipSeriesLabel}
                  formatValue={formatEuroCents}
                  setActivePoint={onSetActiveChartPoint}
                />
              )}
              cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1, fill: "transparent" }}
            />

            {seriesReady && activeTab !== "ALL" ? (
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
                  activeDot={(props: ActiveDotProps) => (
                    <SelectableChartDot
                      {...props}
                      color="#8f8f8f"
                      onSelectPoint={onSelectPoint}
                      radius={5}
                      seriesKey="income"
                    />
                  )}
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
                  activeDot={(props: ActiveDotProps) => (
                    <SelectableChartDot
                      {...props}
                      color="#404040"
                      onSelectPoint={onSelectPoint}
                      radius={5}
                      seriesKey="expenses"
                    />
                  )}
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
            ) : seriesReady ? (
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
                <Line
                  key={`heritage-${Object.keys(hiddenSeries).sort().map(key => hiddenSeries[key] ? "0" : "1").join("")}`}
                  type="linear"
                  dataKey="heritage"
                  name="heritage"
                  stroke="#ffffff"
                  strokeWidth={2.5}
                  isAnimationActive={false}
                  hide={!!hiddenSeries.heritage}
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
        hiddenSeries={hiddenSeries}
        items={activeTab === "ALL" ? getCheckingAllLegendItems(data.providers) : getCheckingMetricLegendItems()}
        onToggleSeries={onToggleSeries}
        transactionCount={transactionCount}
      />
    </>
  );
}
