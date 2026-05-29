export type DashboardChartPoint = Record<string, string | number | null | undefined>;

export type DashboardChartConfig = {
  mainKey: string;
  mainLabel: string;
  subLines: Array<{
    key: string;
    label: string;
    stroke: string;
  }>;
};
