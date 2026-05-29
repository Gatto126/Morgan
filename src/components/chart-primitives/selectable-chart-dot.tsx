import {
  getSelectableChartDotPoint,
  type ChartDotSelectedPoint,
  type SelectableChartDotPayload
} from "./selectable-chart-dot-model";

export type { ChartDotSelectedPoint } from "./selectable-chart-dot-model";

type SelectableChartDotProps<TPoint extends SelectableChartDotPayload> = {
  color: string;
  cx?: number;
  cy?: number;
  onSelectPoint: (point: ChartDotSelectedPoint) => void;
  payload?: TPoint;
  radius?: number;
  seriesKey: string;
  valueKey?: string;
};

export function SelectableChartDot<TPoint extends SelectableChartDotPayload>({
  color,
  cx,
  cy,
  onSelectPoint,
  payload,
  radius = 6,
  seriesKey,
  valueKey = seriesKey
}: SelectableChartDotProps<TPoint>) {
  if (cx === undefined || cy === undefined || !payload || !payload.rawMonth) return null;

  const selectedPoint = getSelectableChartDotPoint(payload, seriesKey, valueKey);
  if (!selectedPoint) return null;

  return (
    <circle
      cx={cx}
      cy={cy}
      r={radius}
      fill="#1a1a1a"
      stroke={color}
      strokeWidth={2}
      style={{ cursor: "pointer", outline: "none" }}
      onClick={(event) => {
        event.stopPropagation();
        onSelectPoint(selectedPoint);
      }}
    />
  );
}
