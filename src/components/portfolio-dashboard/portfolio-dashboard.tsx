"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { ChartPoint } from "@/types/chart";
import { DashboardPanelHost } from "@/components/dashboard-panel-host";
import { DashboardLoadingOverlay, DashboardLoadingState } from "@/components/dashboard/dashboard-status";
import { buildPortfolioChartData, getPortfolioXAxisTicks } from "./chart-data";
import { formatProviderLabel } from "./formatters";
import { PortfolioChart } from "./portfolio-chart";
import { PortfolioDashboardTabs } from "./portfolio-dashboard-tabs";
import { PortfolioProviderCards } from "./portfolio-provider-cards";
import type {
  PortfolioDashboardTab,
  PortfolioDashboardProps,
  PortfolioProviderSummary,
  PortfolioSelectedPoint,
  TimeRange
} from "./types";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { usePortfolioDashboardData } from "./use-portfolio-dashboard-data";
import { usePortfolioLivePrices } from "./use-portfolio-live-prices";

export type { PortfolioDashboardConfig, PortfolioDashboardProps, PortfolioTransaction } from "./types";

export function PortfolioDashboard({
  config,
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
}: PortfolioDashboardProps) {
  const { data, loading, error, importRefreshVersion } = usePortfolioDashboardData({
    endpoint: config.endpoint,
    fetchErrorMessage: config.fetchErrorMessage,
    userId,
    transactionCount,
    isActive,
    shouldLoad
  });
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [timeRange, setTimeRange] = useState<TimeRange>("ALL");
  const [selectedPoint, setSelectedPoint] = useState<PortfolioSelectedPoint | null>(null);
  const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>({});
  const [showSoldAssets, setShowSoldAssets] = useState(false);
  const [chartReady, setChartReady] = useState(false);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);
  const [loadingOverlayFadingOut, setLoadingOverlayFadingOut] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
  const firstLoadCompletedRef = useRef(false);
  const completedImportRefreshVersionRef = useRef(0);
  const onImportRefreshCompleteRef = useRef(onImportRefreshComplete);
  const isMobile = useIsMobile();
  const livePrices = usePortfolioLivePrices({
    providers: data?.providers,
    priceQueryParam: config.priceQueryParam,
    isActive,
    shouldLoad: shouldLoad && !!data
  });
  const [activeChartPoint, setActiveChartPoint] = useState<ChartPoint | null>(null);
  const activePoint = activeChartPoint;
  const isPanelOpen = showUploadView || showSettingsView || showUserSelectView;

  useEffect(() => {
    onImportRefreshCompleteRef.current = onImportRefreshComplete;
  }, [onImportRefreshComplete]);

  const toggleSeries = (key: string) => {
    setHiddenSeries(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const tabsPortalNode = typeof document === "undefined" ? null : document.getElementById("dashboard-tabs-portal");
  const cardsPortalNode = typeof document === "undefined" ? null : document.getElementById("dashboard-cards-portal");

  const activeProvider = useMemo(() => {
    return data?.providers.find(p => p.sourceInstitution === activeTab) || null;
  }, [data, activeTab]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return buildPortfolioChartData({ data, activeTab, timeRange, activeProvider });
  }, [data, activeTab, timeRange, activeProvider]);

  const xAxisTicks = useMemo(() => {
    return getPortfolioXAxisTicks(chartData);
  }, [chartData]);

  const hasRenderableChartData = useMemo(() => {
    if (!data) {
      return false;
    }

    const seriesKeys = activeTab === "ALL"
      ? ["heritage", ...data.providers.map((provider) => provider.sourceInstitution)]
      : ["balance", ...(activeProvider?.products.map((product) => product.productName) ?? [])];

    return chartData.some((point) =>
      seriesKeys.some((key) => {
        const value = point[key];
        return typeof value === "number" && Number.isFinite(value);
      })
    );
  }, [activeProvider, activeTab, chartData, data]);

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

  if (loading) return <DashboardLoadingState isActive={isActive} showLoadingOverlay={showLoadingOverlay} loadingOverlayFadingOut={loadingOverlayFadingOut} />;
  if (error) return <div className={cn("absolute inset-0 flex h-full items-center justify-center text-sm text-[color:var(--danger)]", isActive ? "z-10 opacity-100 visible" : "z-0 pointer-events-none opacity-0 invisible")}>{error}</div>;
  if (!data) return null;

  const getProviderLiveTotal = (provider: PortfolioProviderSummary) => {
    let liveTotal = 0;
    let hasHoldings = false;
    for (const prod of provider.products) {
      if (Math.abs(prod.quantity) > 0.000001) {
        hasHoldings = true;
        const livePrice = prod.isin ? livePrices[prod.isin] : null;
        if (livePrice != null) {
          liveTotal += Math.round(prod.quantity * livePrice * 100);
        } else {
          liveTotal += prod.investedValue;
        }
      }
    }
    // Only return liveTotal if there are actual holdings, else use the static total (for historical pure cash accounts etc)
    return hasHoldings ? liveTotal : provider.total;
  };

  const allTotal = data.providers.reduce((sum, p) => sum + getProviderLiveTotal(p), 0);
  const tabs: PortfolioDashboardTab[] = [{ key: "ALL", label: config.rootLabel, total: allTotal }, ...data.providers.map(p => ({ key: p.sourceInstitution, label: formatProviderLabel(p.sourceInstitution), total: getProviderLiveTotal(p) }))];

  return (
    <div className={cn("absolute inset-0 flex h-full w-full flex-col gap-4", isActive ? "z-10 opacity-100 visible" : "z-0 pointer-events-none opacity-0 invisible")}>
      <DashboardLoadingOverlay showLoadingOverlay={showLoadingOverlay} loadingOverlayFadingOut={loadingOverlayFadingOut} />
      <PortfolioDashboardTabs
        portalNode={tabsPortalNode}
        tabs={tabs}
        activeTab={activeTab}
        activePoint={activePoint}
        rootIcon={config.rootIcon}
        isActive={isActive}
        onSelectTab={setActiveTab}
      />

      <div
        className="relative flex w-full flex-1 flex-col min-h-[240px] sm:min-h-[400px] md:min-h-[440px] lg:min-h-[520px] justify-center"
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
          <PortfolioChart
            data={data}
            activeProvider={activeProvider}
            activeTab={activeTab}
            chartData={chartData}
            xAxisTicks={xAxisTicks}
            timeRange={timeRange}
            selectedPoint={selectedPoint}
            hiddenSeries={hiddenSeries}
            showSoldAssets={showSoldAssets}
            isMobile={isMobile}
            transactionCount={transactionCount}
            onSetTimeRange={setTimeRange}
            onSelectPoint={setSelectedPoint}
            onToggleSeries={toggleSeries}
            onToggleSoldAssets={() => setShowSoldAssets(prev => !prev)}
            onSetActiveChartPoint={setActiveChartPoint}
            onChartReadyChange={setChartReady}
          />
        </DashboardPanelHost>
      </div>

      <PortfolioProviderCards
        portalNode={cardsPortalNode}
        providers={data.providers}
        config={config}
        livePrices={livePrices}
        isActive={isActive}
        getProviderLiveTotal={getProviderLiveTotal}
      />
    </div>
  );
}
