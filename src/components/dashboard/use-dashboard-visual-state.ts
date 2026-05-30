"use client";

import { useEffect, useRef, useState } from "react";

import type { DashboardData } from "./types";

type UseDashboardVisualStateParams = {
  data: DashboardData | null;
  error: string | null;
  hasRenderableChartData: boolean;
  importRefreshVersion: number;
  loading: boolean;
  onImportRefreshComplete?: () => void;
  shouldShowUploadPanel: boolean;
  transactionCount: number;
};

export function useDashboardVisualState({
  data,
  error,
  hasRenderableChartData,
  importRefreshVersion,
  loading,
  onImportRefreshComplete,
  shouldShowUploadPanel,
  transactionCount
}: UseDashboardVisualStateParams) {
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);
  const [contentVisible, setContentVisible] = useState(false);
  const [chartReady, setChartReady] = useState(false);
  const firstLoadCompletedRef = useRef(false);
  const completedImportRefreshVersionRef = useRef(0);
  const onImportRefreshCompleteRef = useRef(onImportRefreshComplete);

  useEffect(() => {
    onImportRefreshCompleteRef.current = onImportRefreshComplete;
  }, [onImportRefreshComplete]);

  const initialDashboardVisualReady =
    !!data && !loading && (shouldShowUploadPanel || transactionCount === 0 || chartReady);
  const importDashboardVisualReady =
    !!data && !loading && (shouldShowUploadPanel || transactionCount === 0 || (chartReady && hasRenderableChartData));
  const importRefreshSettled = !loading && (error !== null || importDashboardVisualReady);

  useEffect(() => {
    if (!initialDashboardVisualReady || firstLoadCompletedRef.current) {
      return;
    }

    firstLoadCompletedRef.current = true;
    setContentVisible(true);
    setShowLoadingOverlay(false);
  }, [initialDashboardVisualReady]);

  useEffect(() => {
    if (
      importRefreshVersion === 0 ||
      completedImportRefreshVersionRef.current >= importRefreshVersion ||
      !importRefreshSettled ||
      !onImportRefreshCompleteRef.current
    ) {
      return;
    }

    completedImportRefreshVersionRef.current = importRefreshVersion;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        onImportRefreshCompleteRef.current?.();
      });
    });
  }, [importRefreshSettled, importRefreshVersion]);

  return {
    chartReady,
    contentVisible,
    setChartReady,
    showLoadingOverlay
  };
}
