import { Line, ReferenceLine } from "recharts";

import { ChartReferenceLabel } from "@/components/chart-primitives/chart-reference-label";
import { SelectableChartDot, type ChartDotSelectedPoint } from "@/components/chart-primitives/selectable-chart-dot";
import { hasRenderableLineSeries } from "./dashboard-chart-series";
import type { DashboardChartConfig, DashboardChartPoint } from "./dashboard-chart-types";
import type { AccountTab } from "./types";

type ActiveDotProps = {
  cx?: number;
  cy?: number;
  payload?: DashboardChartPoint & { rawMonth?: string };
};

type DashboardChartLinesProps = {
  activeTab: AccountTab;
  chartData: DashboardChartPoint[];
  chartConfig: DashboardChartConfig;
  hiddenSeries: Record<string, boolean>;
  selectedValue: number | null;
  setSelectedMonth: (month: string | null) => void;
  setSelectedSeriesKey: (seriesKey: string | null) => void;
};

function getHiddenSeriesSignature(hiddenSeries: Record<string, boolean>) {
  return Object.keys(hiddenSeries)
    .sort()
    .map((key) => hiddenSeries[key] ? "0" : "1")
    .join("");
}

export function DashboardChartLines({
  activeTab,
  chartData,
  chartConfig,
  hiddenSeries,
  selectedValue,
  setSelectedMonth,
  setSelectedSeriesKey
}: DashboardChartLinesProps) {
  const hiddenSeriesSignature = getHiddenSeriesSignature(hiddenSeries);
  const handleSelectPoint = (point: ChartDotSelectedPoint) => {
    setSelectedMonth(point.month);
    setSelectedSeriesKey(point.seriesKey);
  };

  return (
    <>
      {chartConfig.subLines.map((subLine) => {
        if (hiddenSeries[subLine.key]) return null;
        if (!hasRenderableLineSeries(chartData, subLine.key)) return null;
        return (
          <Line
            key={subLine.key}
            type="linear"
            dataKey={subLine.key}
            name={subLine.key}
            stroke={subLine.stroke}
            strokeWidth={2}
            isAnimationActive={false}
            connectNulls={false}
            activeDot={(props: ActiveDotProps) => (
              <SelectableChartDot
                {...props}
                color={subLine.stroke}
                onSelectPoint={handleSelectPoint}
                radius={5}
                seriesKey={subLine.key}
              />
            )}
            dot={false}
          />
        );
      })}

      {!hiddenSeries[activeTab] && hasRenderableLineSeries(chartData, "value") && (
        <Line
          key={`${activeTab}-${hiddenSeriesSignature}`}
          type="linear"
          dataKey="value"
          name={activeTab}
          stroke="#ffffff"
          strokeWidth={2.5}
          isAnimationActive={false}
          connectNulls={false}
          activeDot={(props: ActiveDotProps) => (
            <SelectableChartDot
              {...props}
              color="#ffffff"
              onSelectPoint={handleSelectPoint}
              seriesKey="value"
            />
          )}
          dot={false}
        />
      )}

      {selectedValue !== null && (
        <Line
          key={`ref-line-path-${selectedValue}-${hiddenSeriesSignature}`}
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
          key={`ref-line-label-${selectedValue}-${hiddenSeriesSignature}`}
          y={selectedValue}
          stroke="transparent"
          label={<ChartReferenceLabel selectedValue={selectedValue} />}
        />
      )}
    </>
  );
}
