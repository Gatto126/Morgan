import { Line, ReferenceLine } from "recharts";

import { DashboardChartReferenceLabel } from "./dashboard-chart-reference-label";
import type { DashboardChartConfig, DashboardChartPoint } from "./dashboard-chart-types";
import type { AccountTab } from "./types";

type ActiveDotProps = {
  cx?: number;
  cy?: number;
  payload?: DashboardChartPoint;
};

type DashboardChartLinesProps = {
  activeTab: AccountTab;
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

function SeriesDot({
  color,
  dataKey,
  payload,
  cx,
  cy,
  setSelectedMonth,
  setSelectedSeriesKey
}: ActiveDotProps & {
  color: string;
  dataKey: string;
  setSelectedMonth: (month: string | null) => void;
  setSelectedSeriesKey: (seriesKey: string | null) => void;
}) {
  if (cx === undefined || cy === undefined || !payload || payload[dataKey] == null) return null;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={dataKey === "value" ? 6 : 5}
      fill="#1a1a1a"
      stroke={color}
      strokeWidth={2}
      style={{ cursor: "pointer", outline: "none" }}
      onClick={(event) => {
        event.stopPropagation();
        setSelectedMonth(payload.rawMonth as string);
        setSelectedSeriesKey(dataKey);
      }}
    />
  );
}

export function DashboardChartLines({
  activeTab,
  chartConfig,
  hiddenSeries,
  selectedValue,
  setSelectedMonth,
  setSelectedSeriesKey
}: DashboardChartLinesProps) {
  const hiddenSeriesSignature = getHiddenSeriesSignature(hiddenSeries);

  return (
    <>
      {chartConfig.subLines.map((subLine) => {
        if (hiddenSeries[subLine.key]) return null;
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
              <SeriesDot
                {...props}
                color={subLine.stroke}
                dataKey={subLine.key}
                setSelectedMonth={setSelectedMonth}
                setSelectedSeriesKey={setSelectedSeriesKey}
              />
            )}
            dot={false}
          />
        );
      })}

      {!hiddenSeries[activeTab] && (
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
            <SeriesDot
              {...props}
              color="#ffffff"
              dataKey="value"
              setSelectedMonth={setSelectedMonth}
              setSelectedSeriesKey={setSelectedSeriesKey}
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
          label={<DashboardChartReferenceLabel selectedValue={selectedValue} />}
        />
      )}
    </>
  );
}
