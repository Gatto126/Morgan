export type ChartDotSelectedPoint = {
  month: string;
  seriesKey: string;
  value: number;
};

export type SelectableChartDotPayload = {
  rawMonth?: string;
} & Record<string, unknown>;

export function getSelectableChartDotPoint<TPoint extends SelectableChartDotPayload>(
  payload: TPoint | undefined,
  seriesKey: string,
  valueKey = seriesKey
): ChartDotSelectedPoint | null {
  if (!payload?.rawMonth) return null;

  const rawValue = payload[valueKey];
  if (rawValue == null) return null;

  const value = Number(rawValue);
  if (!Number.isFinite(value)) return null;

  return {
    month: payload.rawMonth,
    seriesKey,
    value
  };
}
