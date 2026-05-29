import { ChartTooltip } from "@/components/chart-primitives/chart-tooltip";
import type { ChartPoint, ChartTooltipPayload } from "@/types/chart";

import {
  BINANCE_TOOLTIP_PRIORITY_NAMES,
  formatBinanceEuroCents,
  formatBinanceTooltipLabel,
  formatBinanceTooltipSeriesLabel
} from "./binance-chart-model";

const setNoActivePoint = () => undefined;

type BinanceChartTooltipProps = {
  active?: boolean;
  payload?: ChartTooltipPayload<ChartPoint>[];
  label?: string;
};

export function BinanceChartTooltip({ active, payload, label }: BinanceChartTooltipProps) {
  return (
    <ChartTooltip
      active={active}
      formatLabel={formatBinanceTooltipLabel}
      formatSeriesLabel={formatBinanceTooltipSeriesLabel}
      formatValue={formatBinanceEuroCents}
      label={label}
      labelClassName="truncate max-w-[150px]"
      payload={payload}
      priorityNames={BINANCE_TOOLTIP_PRIORITY_NAMES}
      setActivePoint={setNoActivePoint}
    />
  );
}
