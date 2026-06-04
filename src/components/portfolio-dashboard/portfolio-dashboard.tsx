"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/shared/utils";
import type { ChartPoint } from "@/types/chart";
import { DashboardPanelHost } from "@/components/dashboard-panel-host";
import { DashboardLoadingOverlay, getDashboardStageVisibilityStyle } from "@/components/dashboard/dashboard-status";
import { applyLiveBinanceBalanceValues } from "@/components/dashboard/binance-live-values";
import { useBinanceBalances } from "@/components/dashboard/use-binance-balances";
import {
  useCurrentValuationSnapshot
} from "@/components/finance-shell/current-valuations-store";
import {
  buildPortfolioChartData,
  getPortfolioXAxisTicks,
  mergePortfolioDataWithProviderHistory
} from "./chart-data";
import { getEuropeRomeDateKey } from "@/shared/date-keys";
import { formatProviderLabel } from "./formatters";
import { mergePortfolioDataWithBinance } from "./binance-portfolio-provider";
import { PortfolioChart } from "./portfolio-chart";
import { getPortfolioPointValue } from "./portfolio-current-point";
import { selectPortfolioCurrentValuationPoint } from "./portfolio-current-valuation";
import { PortfolioDashboardTabs } from "./portfolio-dashboard-tabs";
import { PortfolioProviderCards } from "./portfolio-provider-cards";
import type {
  PortfolioDashboardTab,
  PortfolioDashboardProps,
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
  onImportRefreshComplete,
  binanceRefreshKey = 0,
  hasBinanceCredentials = false
}: PortfolioDashboardProps) {
  const isCryptoDashboard = config.priceQueryParam === "cryptos";
  const { data, dataFresh, loading, error, importRefreshVersion } = usePortfolioDashboardData({
    endpoint: config.endpoint,
    fetchErrorMessage: config.fetchErrorMessage,
    userId,
    transactionCount,
    isActive,
    refreshKey: isCryptoDashboard ? binanceRefreshKey : 0,
    shouldLoad
  });
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [timeRange, setTimeRange] = useState<TimeRange>("ALL");
  const [selectedPoint, setSelectedPoint] = useState<PortfolioSelectedPoint | null>(null);
  const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>({});
  const [showSoldAssets, setShowSoldAssets] = useState(false);
  const [chartReady, setChartReady] = useState(false);
  const hasInitialData = !!data && !loading && !(isCryptoDashboard && hasBinanceCredentials);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(!hasInitialData);
  const [contentVisible, setContentVisible] = useState(hasInitialData);
  const firstLoadCompletedRef = useRef(hasInitialData);
  const completedImportRefreshVersionRef = useRef(0);
  const onImportRefreshCompleteRef = useRef(onImportRefreshComplete);
  const isMobile = useIsMobile();
  const {
    binanceBalances,
    isBinanceSyncing,
    filterSmallBinance,
    setFilterSmallBinance,
    binanceListRef
  } = useBinanceBalances({
    binanceRefreshKey,
    shouldLoad: shouldLoad && isCryptoDashboard,
    userId
  });
  const dataForPriceKeys = useMemo(
    () => data && isCryptoDashboard ? mergePortfolioDataWithBinance(data, binanceBalances) : data,
    [binanceBalances, data, isCryptoDashboard]
  );
  const { livePrices } = usePortfolioLivePrices({
    binanceBalances: isCryptoDashboard ? binanceBalances : undefined,
    providers: dataForPriceKeys?.providers,
    priceQueryParam: config.priceQueryParam,
    isActive,
    shouldLoad: shouldLoad && !!data
  });
  const liveBinanceBalances = useMemo(
    () => isCryptoDashboard ? applyLiveBinanceBalanceValues(binanceBalances, livePrices) : [],
    [binanceBalances, isCryptoDashboard, livePrices]
  );
  const dataForDisplay = useMemo(
    () => data && isCryptoDashboard ? mergePortfolioDataWithBinance(data, liveBinanceBalances) : data,
    [data, isCryptoDashboard, liveBinanceBalances]
  );
  const dataForChart = useMemo(
    () => dataForDisplay && isCryptoDashboard
      ? mergePortfolioDataWithProviderHistory(dataForDisplay, "BINANCE", dataForDisplay.binanceHistoricalPoints ?? [])
      : dataForDisplay,
    [dataForDisplay, isCryptoDashboard]
  );
  const [activeChartPoint, setActiveChartPoint] = useState<ChartPoint | null>(null);
  const isPanelOpen = showUploadView || showSettingsView || showUserSelectView;
  const todayKey = useMemo(() => getTodayKey(), []);
  useEffect(() => {
    onImportRefreshCompleteRef.current = onImportRefreshComplete;
  }, [onImportRefreshComplete]);

  const toggleSeries = (key: string) => {
    setHiddenSeries(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const cardsPortalNode = usePortalNode("dashboard-cards-portal");
  const dashboardStage = config.endpoint.includes("/crypto") ? "crypto" : "investment";
  const valuationSnapshot = useCurrentValuationSnapshot(userId);

  const activeProvider = useMemo(() => {
    return dataForDisplay?.providers.find(p => p.sourceInstitution === activeTab) || null;
  }, [dataForDisplay, activeTab]);
  const currentValuationPoint = useMemo(() => {
    return selectPortfolioCurrentValuationPoint(valuationSnapshot, {
      activeTab,
      binanceRefreshKey,
      dataFresh,
      stage: dashboardStage,
      transactionCount
    });
  }, [
    activeTab,
    binanceRefreshKey,
    dashboardStage,
    dataFresh,
    transactionCount,
    valuationSnapshot
  ]);

  const chartData = useMemo(() => {
    if (!dataForChart) return [];
    return buildPortfolioChartData({
      activeProvider,
      activeTab,
      applyLiveToday: false,
      currentValuationPoint,
      data: dataForChart,
      livePrices,
      timeRange,
      todayKey
    });
  }, [activeProvider, activeTab, currentValuationPoint, dataForChart, livePrices, timeRange, todayKey]);
  const currentSnapshot = currentValuationPoint;
  const currentDisplayPoint = activeChartPoint ?? currentSnapshot;
  const currentValuesKnown = dataFresh && !!currentSnapshot;

  const xAxisTicks = useMemo(() => {
    return getPortfolioXAxisTicks(chartData);
  }, [chartData]);

  const hasRenderableChartData = useMemo(() => {
    if (!dataForDisplay) {
      return false;
    }

    const seriesKeys = activeTab === "ALL"
      ? ["heritage", ...dataForDisplay.providers.map((provider) => provider.sourceInstitution)]
      : ["balance", ...(activeProvider?.products.map((product) => product.productName) ?? [])];

    return chartData.some((point) =>
      seriesKeys.some((key) => {
        const value = point[key];
        return typeof value === "number" && Number.isFinite(value);
      })
    );
  }, [activeProvider, activeTab, chartData, dataForDisplay]);

  const allTotal = getPortfolioPointValue(currentSnapshot, "ALL") ?? 0;
  const tabs: PortfolioDashboardTab[] = dataForDisplay
    ? [
        { key: "ALL", label: config.rootLabel, total: allTotal },
        ...dataForDisplay.providers.map(p => ({
          key: p.sourceInstitution,
          label: formatProviderLabel(p.sourceInstitution),
          total: getPortfolioPointValue(currentSnapshot, p.sourceInstitution) ?? 0
        }))
      ]
    : [{ key: "ALL", label: config.rootLabel, total: 0 }];

  const effectiveChartReady = !isPanelOpen && chartReady;
  const binanceInitialDataReady =
    !isCryptoDashboard || !hasBinanceCredentials || !!currentValuationPoint;
  const initialVisualReady =
    binanceInitialDataReady && !!dataForDisplay && !loading && (isPanelOpen || (effectiveChartReady && hasRenderableChartData));
  const importRefreshSettled =
    !loading && (error !== null || (binanceInitialDataReady && !!dataForDisplay && effectiveChartReady && hasRenderableChartData));
  const shouldRenderVisuals = isActive;

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
  if (!dataForDisplay) {
    return (
      <div
        className={cn("absolute inset-0 flex h-full w-full flex-col gap-4", isActive ? "z-10 opacity-100 visible" : "z-0 pointer-events-none opacity-0 invisible")}
        style={getDashboardStageVisibilityStyle(isActive)}
      >
        <DashboardLoadingOverlay showLoadingOverlay={showLoadingOverlay} />
      </div>
    );
  }

  return (
    <div
      className={cn("absolute inset-0 flex h-full w-full flex-col gap-4", isActive ? "z-10 opacity-100 visible" : "z-0 pointer-events-none opacity-0 invisible")}
      style={getDashboardStageVisibilityStyle(isActive)}
    >
      {shouldRenderVisuals ? (
        <>
          <DashboardLoadingOverlay showLoadingOverlay={showLoadingOverlay} />
          <PortfolioDashboardTabs
            tabs={tabs}
            activeTab={activeTab}
            activePoint={currentDisplayPoint}
            isTooltipActive={!!activeChartPoint}
            rootIcon={config.rootIcon}
            valuesKnown={currentValuesKnown}
            stage={dashboardStage}
            userId={userId}
            onSelectTab={setActiveTab}
          />

          <div
            className="relative flex w-full flex-1 flex-col min-h-[240px] sm:min-h-[400px] md:min-h-[440px] lg:min-h-[520px] justify-center"
            style={{
              opacity: contentVisible ? 1 : 0,
              transition: "none"
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
                data={dataForDisplay}
                activeProvider={activeProvider}
                activeTab={activeTab}
                aggregateLegendLabel={config.aggregateLegendLabel}
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
            providers={data?.providers ?? []}
            config={config}
            currentPoint={currentSnapshot}
            currentValuationSnapshot={currentValuationPoint ? valuationSnapshot : null}
            valuesKnown={currentValuesKnown}
            livePrices={livePrices}
            isActive={isActive}
            shouldPreloadRows={shouldLoad}
            transactionRowsEndpoint={`${config.endpoint}/rows`}
            userId={userId}
            binanceBalances={liveBinanceBalances}
            isBinanceSyncing={isBinanceSyncing}
            filterSmallBinance={filterSmallBinance}
            setFilterSmallBinance={setFilterSmallBinance}
            binanceListRef={binanceListRef}
          />
        </>
      ) : null}
    </div>
  );
}

function getTodayKey() {
  return getEuropeRomeDateKey();
}
