"use client";

import { useEffect, useRef, useState } from "react";

type IdleCallback = (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void;
type IdleWindow = Window & typeof globalThis & {
  cancelIdleCallback?: (handle: number) => void;
  requestIdleCallback?: (callback: IdleCallback, options?: { timeout?: number }) => number;
};

export function scheduleIdleTask(callback: () => void, timeoutMs = 1_600) {
  const currentWindow = window as IdleWindow;

  if (
    typeof currentWindow.requestIdleCallback === "function"
    && typeof currentWindow.cancelIdleCallback === "function"
  ) {
    const idleId = currentWindow.requestIdleCallback(callback, { timeout: timeoutMs });
    return () => currentWindow.cancelIdleCallback?.(idleId);
  }

  const timeoutId = window.setTimeout(callback, Math.min(timeoutMs, 900));
  return () => window.clearTimeout(timeoutId);
}

export function useDeferredTransactionRows(
  isActive: boolean,
  totalCount: number,
  {
    fallbackDelayMs = 1_800,
    idleTimeoutMs = 1_200,
    preload = false
  }: {
    fallbackDelayMs?: number;
    idleTimeoutMs?: number;
    preload?: boolean;
  } = {}
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldLoadRows, setShouldLoadRows] = useState(false);

  useEffect(() => {
    const canScheduleRows = isActive || preload;

    if (!canScheduleRows || totalCount === 0 || shouldLoadRows) {
      return;
    }

    const node = containerRef.current;
    let cancelIdleTask: (() => void) | null = null;
    let observer: IntersectionObserver | null = null;

    function scheduleLoad() {
      if (cancelIdleTask) {
        return;
      }

      cancelIdleTask = scheduleIdleTask(() => setShouldLoadRows(true), idleTimeoutMs);
    }

    if (!isActive && preload) {
      scheduleLoad();
      return () => {
        cancelIdleTask?.();
      };
    }

    if (node && "IntersectionObserver" in window) {
      observer = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          scheduleLoad();
          observer?.disconnect();
          observer = null;
        }
      }, { rootMargin: "180px" });
      observer.observe(node);
    }

    const fallbackTimer = window.setTimeout(scheduleLoad, fallbackDelayMs);

    return () => {
      observer?.disconnect();
      cancelIdleTask?.();
      window.clearTimeout(fallbackTimer);
    };
  }, [fallbackDelayMs, idleTimeoutMs, isActive, preload, shouldLoadRows, totalCount]);

  return {
    rowsContainerRef: containerRef,
    shouldLoadRows: (isActive || preload) && shouldLoadRows
  };
}
