"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/shared/utils";
import type { ChartPoint } from "@/types/chart";
import { DashboardPanelHost } from "@/components/dashboard-panel-host";
import { DashboardLoadingOverlay, getDashboardStageVisibilityStyle } from "@/components/dashboard/dashboard-status";
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
import { usePortalNode } from "@/hooks/use-portal-node";
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
  const hasInitialData = !!data && !loading;
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(!hasInitialData);
  const [contentVisible, setContentVisible] = useState(hasInitialData);
  const firstLoadCompletedRef = useRef(hasInitialData);
  const completedImportRefreshVersionRef = useRef(0);
  const onImportRefreshCompleteRef = useRef(onImportRefreshComplete);
  const isMobile = useIsMobile();
  const { livePrices } = usePortfolioLivePrices({
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

  const cardsPortalNode = usePortalNode("dashboard-cards-portal");
  const dashboardStage = config.endpoint.includes("/crypto") ? "crypto" : "investment";

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
    return hasHoldings ? liveTotal : provider.total;
  };
  const allTotal = data?.providers.reduce((sum, p) => sum + getProviderLiveTotal(p), 0) ?? 0;
  const tabs: PortfolioDashboardTab[] = data
    ? [
        { key: "ALL", label: config.rootLabel, total: allTotal },
        ...data.providers.map(p => ({
          key: p.sourceInstitution,
          label: formatProviderLabel(p.sourceInstitution),
          total: getProviderLiveTotal(p)
        }))
      ]
    : [{ key: "ALL", label: config.rootLabel, total: 0 }];

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
    setContentVisible(true);
    setShowLoadingOverlay(false);
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

  if (error) return (
    <div
      className={cn("absolute inset-0 flex h-full items-center justify-center text-sm text-[color:var(--danger)]", isActive ? "z-10 opacity-100 visible" : "z-0 pointer-events-none opacity-0 invisible")}
      style={getDashboardStageVisibilityStyle(isActive)}
    >
      {error}
    </div>
  );
  if (!data) {
    return (
      <div
        className={cn("absolute inset-0 flex h-full w-full flex-col gap-4", isActive ? "z-10 opacity-100 visible" : "z-0 pointer-events-none opacity-0 invisible")}
        style={getDashboardStageVisibilityStyle(isActive)}
      >
        <DashboardLoadingOverlay showLoadingOverlay={showLoadingOverlay} />
        <PortfolioDashboardTabs
          tabs={tabs}
          activeTab={activeTab}
          activePoint={null}
          rootIcon={config.rootIcon}
          valuesKnown={false}
          stage={dashboardStage}
          userId={userId}
          onSelectTab={setActiveTab}
        />
      </div>
    );
  }

  return (
    <div
      className={cn("absolute inset-0 flex h-full w-full flex-col gap-4", isActive ? "z-10 opacity-100 visible" : "z-0 pointer-events-none opacity-0 invisible")}
      style={getDashboardStageVisibilityStyle(isActive)}
    >
      <DashboardLoadingOverlay showLoadingOverlay={showLoadingOverlay} />
      <PortfolioDashboardTabs
        tabs={tabs}
        activeTab={activeTab}
        activePoint={activePoint}
        rootIcon={config.rootIcon}
        stage={dashboardStage}
        userId={userId}
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
        transactionRowsEndpoint={`${config.endpoint}/rows`}
        userId={userId}
        getProviderLiveTotal={getProviderLiveTotal}
      />
    </div>
  );
}
