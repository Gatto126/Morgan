export type ChartPrimitive = string | number | null | undefined;

export type ChartPoint = {
  month?: string;
  rawMonth: string;
  date?: string;
} & Record<string, ChartPrimitive>;

export type ChartTooltipPayload<TPoint extends ChartPoint = ChartPoint> = {
  name?: string | number;
  value: number;
  payload?: TPoint;
};

export type ActiveDotProps<TPoint extends ChartPoint = ChartPoint> = {
  cx?: number;
  cy?: number;
  payload: TPoint;
};
