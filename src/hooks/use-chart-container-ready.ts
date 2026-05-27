import { useCallback, useEffect, useState } from "react";

export function useChartContainerReady() {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });
  const chartContainerRef = useCallback((node: HTMLDivElement | null) => {
    setElement(node);
    if (!node) {
      setChartSize({ width: 0, height: 0 });
    }
  }, []);

  useEffect(() => {
    if (!element) {
      return;
    }

    let frameId = 0;

    const checkSize = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect();
        setChartSize({
          width: Math.floor(rect.width),
          height: Math.floor(rect.height)
        });
      });
    };

    checkSize();

    const observer = new ResizeObserver(checkSize);
    observer.observe(element);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [element]);

  return {
    chartContainerRef,
    chartReady: chartSize.width > 0 && chartSize.height > 0,
    chartSize
  };
}
