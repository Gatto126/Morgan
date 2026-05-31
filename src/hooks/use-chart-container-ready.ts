import { useCallback, useLayoutEffect, useState } from "react";

export function useChartContainerReady() {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
  const updateChartSize = useCallback((node: HTMLDivElement) => {
    const rect = node.getBoundingClientRect();
    const nextSize = {
      width: Math.floor(rect.width),
      height: Math.floor(rect.height)
    };

    setChartSize((currentSize) => {
      if (currentSize.width === nextSize.width && currentSize.height === nextSize.height) {
        return currentSize;
      }

      return nextSize;
    });
  }, []);
  const chartContainerRef = useCallback((node: HTMLDivElement | null) => {
    setElement(node);
    if (!node) {
      setChartSize({ width: 0, height: 0 });
      return;
    }

    updateChartSize(node);
  }, [updateChartSize]);

  useLayoutEffect(() => {
    if (!element) {
      return;
    }

    let frameId = 0;

    const checkSize = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        updateChartSize(element);
      });
    };

    checkSize();

    const observer = new ResizeObserver(checkSize);
    observer.observe(element);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [element, updateChartSize]);

  return {
    chartContainerRef,
    chartReady: chartSize.width > 0 && chartSize.height > 0,
    chartSize
  };
}
