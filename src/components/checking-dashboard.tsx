"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { DashboardPanelHost } from "@/components/dashboard-panel-host";
import { DashboardLoadingOverlay, DashboardLoadingState } from "@/components/dashboard/dashboard-status";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { usePortalNode } from "@/hooks/use-portal-node";
import { cn } from "@/shared/utils";
import type { ChartPoint } from "@/types/chart";

import { buildCheckingChartData, getCheckingXAxisTicks } from "./checking-dashboard/chart-data";
import { CheckingChart } from "./checking-dashboard/checking-chart";
import { CheckingDashboardTabs } from "./checking-dashboard/checking-dashboard-tabs";
import { CheckingProviderCards } from "./checking-dashboard/checking-provider-cards";
import { formatProviderLabel } from "./checking-dashboard/formatters";
import type {
  CheckingDashboardProps,
  CheckingDashboardTab,
  CheckingSelectedPoint,
  TimeRange
} from "./checking-dashboard/types";
import { useCheckingDashboardData } from "./checking-dashboard/use-checking-dashboard-data";

export function CheckingDashboard({
  userId,
  showUploadView = false,
  isClosingUpload = false,
  onCloseUpload,
  uploadElement,
  reviewElement,
  previewTransactionsCount = 0,
  transactionCount = 0,
  isActive = true,
  shouldLoad = isActive,
  showSettingsView = false,
  isClosingSettings = false,
  onCloseSettings,
  settingsElement,
  showUserSelectView = false,
  isClosingUserSelect = false,
  onCloseUserSelect,
  userSelectElement,
  onImportRefreshComplete
}: CheckingDashboardProps) {
  const { data, loading, error, importRefreshVersion } = useCheckingDashboardData({
    userId,
    transactionCount,
    isActive,
    shouldLoad
  });

  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [timeRange, setTimeRange] = useState<TimeRange>("ALL");
  const [selectedPoint, setSelectedPoint] = useState<CheckingSelectedPoint | null>(null);
  const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>({});
  const [activeChartPoint, setActiveChartPoint] = useState<ChartPoint | null>(null);
  const [chartReady, setChartReady] = useState(false);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);
  const [loadingOverlayFadingOut, setLoadingOverlayFadingOut] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
  const firstLoadCompletedRef = useRef(false);
  const completedImportRefreshVersionRef = useRef(0);
  const onImportRefreshCompleteRef = useRef(onImportRefreshComplete);
  const isMobile = useIsMobile();
  const isPanelOpen = showUploadView || showSettingsView || showUserSelectView;

  useEffect(() => {
    onImportRefreshCompleteRef.current = onImportRefreshComplete;
  }, [onImportRefreshComplete]);

  const toggleSeries = (key: string) => {
    setHiddenSeries(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const tabsPortalNode = usePortalNode("dashboard-tabs-portal");
  const cardsPortalNode = usePortalNode("dashboard-cards-portal");

  const chartData = useMemo(() => {
    if (!data) {
      return [];
    }

    return buildCheckingChartData({ data, activeTab, timeRange });
  }, [data, activeTab, timeRange]);

  const xAxisTicks = useMemo(() => {
    return getCheckingXAxisTicks(chartData);
  }, [chartData]);

  const hasRenderableChartData = useMemo(() => {
    if (!data) {
      return false;
    }

    const seriesKeys = activeTab === "ALL"
      ? ["heritage", ...data.providers.map((provider) => provider.sourceInstitution)]
      : ["balance", "income", "expenses"];

    return chartData.some((point) =>
      seriesKeys.some((key) => {
        const value = point[key];
        return typeof value === "number" && Number.isFinite(value);
      })
    );
  }, [activeTab, chartData, data]);

  const effectiveChartReady = !isPanelOpen && chartReady;
  const initialVisualReady =
    !!data && !loading && (isPanelOpen || (effectiveChartReady && hasRenderableChartData));
  const importRefreshSettled =
    !loading && (error !== null || (!!data && effectiveChartReady && hasRenderableChartData));

  useEffect(() => {
    if (!initialVisualReady || firstLoadCompletedRef.current) {
      return;
    }

    firstLoadCompletedRef.current = true;
    setLoadingOverlayFadingOut(true);
    setContentVisible(true);
    const timer = window.setTimeout(() => {
      setShowLoadingOverlay(false);
      setLoadingOverlayFadingOut(false);
    }, 550);
    return () => window.clearTimeout(timer);
  }, [initialVisualReady]);

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

  if (loading) {
    return <DashboardLoadingState isActive={isActive} showLoadingOverlay={showLoadingOverlay} loadingOverlayFadingOut={loadingOverlayFadingOut} />;
  }

  if (error) {
    return (
      <div className={cn("absolute inset-0 flex h-full items-center justify-center", isActive ? "z-10 opacity-100 visible" : "z-0 pointer-events-none opacity-0 invisible")}>
        <p className="text-sm text-[color:var(--danger)]">{error}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const allTotal = data.providers.reduce((sum, provider) => sum + provider.total, 0);
  const tabs: CheckingDashboardTab[] = [
    { key: "ALL", label: "CHECKING", total: allTotal },
    ...data.providers.map(provider => ({
      key: provider.sourceInstitution,
      label: formatProviderLabel(provider.sourceInstitution),
      total: provider.total
    }))
  ];

  return (
    <div className={cn("absolute inset-0 flex h-full w-full flex-col gap-4", isActive ? "z-10 opacity-100 visible" : "z-0 pointer-events-none opacity-0 invisible")}>
      <DashboardLoadingOverlay showLoadingOverlay={showLoadingOverlay} loadingOverlayFadingOut={loadingOverlayFadingOut} />
      <CheckingDashboardTabs
        portalNode={tabsPortalNode}
        tabs={tabs}
        activeTab={activeTab}
        activePoint={activeChartPoint}
        isActive={isActive}
        onSelectTab={setActiveTab}
      />

      <div
        className="flex-1 min-h-[240px] sm:min-h-[400px] md:min-h-[440px] lg:min-h-[520px] relative w-full flex flex-col justify-center"
        style={{
          opacity: contentVisible ? 1 : 0,
          transform: contentVisible ? "none" : "translateY(10px)",
          transition: contentVisible ? "opacity 0.5s ease-out 0.06s, transform 0.5s ease-out 0.06s" : "none"
        }}
      >
        <DashboardPanelHost
          showUploadView={showUploadView}
          isClosingUpload={isClosingUpload}
          onCloseUpload={onCloseUpload}
          uploadElement={uploadElement}
          reviewElement={reviewElement}
          previewTransactionsCount={previewTransactionsCount}
          showSettingsView={showSettingsView}
          isClosingSettings={isClosingSettings}
          onCloseSettings={onCloseSettings}
          settingsElement={settingsElement}
          showUserSelectView={showUserSelectView}
          isClosingUserSelect={isClosingUserSelect}
          onCloseUserSelect={onCloseUserSelect}
          userSelectElement={userSelectElement}
        >
          <CheckingChart
            data={data}
            activeTab={activeTab}
            chartData={chartData}
            xAxisTicks={xAxisTicks}
            timeRange={timeRange}
            selectedPoint={selectedPoint}
            hiddenSeries={hiddenSeries}
            isMobile={isMobile}
            transactionCount={transactionCount}
            onSetTimeRange={setTimeRange}
            onSelectPoint={setSelectedPoint}
            onToggleSeries={toggleSeries}
            onSetActiveChartPoint={setActiveChartPoint}
            onChartReadyChange={setChartReady}
          />
        </DashboardPanelHost>
      </div>

      <CheckingProviderCards
        portalNode={cardsPortalNode}
        providers={data.providers}
        isActive={isActive}
      />
    </div>
  );
}
