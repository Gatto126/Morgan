"use client";

import { useEffect, useRef, useState } from "react";

import type { DashboardData } from "./types";

type UseDashboardVisualStateParams = {
  dataDependenciesReady?: boolean;
  data: DashboardData | null;
  error: string | null;
  hasRenderableChartData: boolean;
  importRefreshVersion: number;
  loading: boolean;
  onImportRefreshComplete?: () => void;
  shouldShowUploadPanel: boolean;
  transactionCount: number;
};

export function shouldStartDashboardVisualStateVisible({
  data,
  dataDependenciesReady,
  loading
}: {
  data: DashboardData | null;
  dataDependenciesReady: boolean;
  loading: boolean;
}) {
  return dataDependenciesReady && !!data && !loading;
}

export function isDashboardVisualReady({
  chartReady,
  data,
  dataDependenciesReady,
  hasRenderableChartData = false,
  loading,
  requireRenderableChartData = false,
  shouldShowUploadPanel,
  transactionCount
}: {
  chartReady: boolean;
  data: DashboardData | null;
  dataDependenciesReady: boolean;
  hasRenderableChartData?: boolean;
  loading: boolean;
  requireRenderableChartData?: boolean;
  shouldShowUploadPanel: boolean;
  transactionCount: number;
}) {
  const chartReadyForContext = requireRenderableChartData ? chartReady && hasRenderableChartData : chartReady;

  return dataDependenciesReady && !!data && !loading && (shouldShowUploadPanel || transactionCount === 0 || chartReadyForContext);
}

export function useDashboardVisualState({
  dataDependenciesReady = true,
  data,
  error,
  hasRenderableChartData,
  importRefreshVersion,
  loading,
  onImportRefreshComplete,
  shouldShowUploadPanel,
  transactionCount
}: UseDashboardVisualStateParams) {
  const hasInitialData = shouldStartDashboardVisualStateVisible({
    data,
    dataDependenciesReady,
    loading
  });
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(!hasInitialData);
  const [contentVisible, setContentVisible] = useState(hasInitialData);
  const [chartReady, setChartReady] = useState(false);
  const firstLoadCompletedRef = useRef(hasInitialData);
  const completedImportRefreshVersionRef = useRef(0);
  const onImportRefreshCompleteRef = useRef(onImportRefreshComplete);

  useEffect(() => {
    onImportRefreshCompleteRef.current = onImportRefreshComplete;
  }, [onImportRefreshComplete]);

  const initialDashboardVisualReady = isDashboardVisualReady({
    chartReady,
    data,
    dataDependenciesReady,
    loading,
    shouldShowUploadPanel,
    transactionCount
  });
  const importDashboardVisualReady = isDashboardVisualReady({
    chartReady,
    data,
    dataDependenciesReady,
    hasRenderableChartData,
    loading,
    requireRenderableChartData: true,
    shouldShowUploadPanel,
    transactionCount
  });
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
