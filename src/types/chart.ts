export type ChartPrimitive = string | number | null | undefined;

export type ChartPoint = {
  month?: string;
  rawMonth: string;
  date?: string;
} & Record<string, ChartPrimitive>;

export type ChartTooltipPayload<TPoint extends Record<string, unknown> = ChartPoint> = {
  dataKey?: string | number;
  name?: string | number;
  value: number;
  payload?: TPoint;
};

export type ActiveDotProps<TPoint extends ChartPoint = ChartPoint> = {
  cx?: number;
  cy?: number;
  payload: TPoint;
};
