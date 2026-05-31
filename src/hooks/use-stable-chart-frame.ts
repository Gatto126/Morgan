import { useEffect } from "react";

import { useChartContainerReady } from "./use-chart-container-ready";

type ChartSize = {
  height: number;
  width: number;
};

type UseStableChartFrameOptions = {
  fallbackSize: ChartSize;
  onFrameReadyChange?: (ready: boolean) => void;
};

export function useStableChartFrame({
  fallbackSize,
  onFrameReadyChange
}: UseStableChartFrameOptions) {
  const { chartContainerRef, chartReady, chartSize } = useChartContainerReady();
  const renderedChartSize = chartReady ? chartSize : fallbackSize;
  const frameReady = renderedChartSize.width > 0 && renderedChartSize.height > 0;

  useEffect(() => {
    onFrameReadyChange?.(frameReady);
  }, [frameReady, onFrameReadyChange]);

  return {
    chartContainerRef,
    frameReady,
    renderedChartSize,
    seriesReady: chartReady
  };
}
