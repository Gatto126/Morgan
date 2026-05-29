"use client";

import { useMemo, type ReactNode } from "react";

import { usePortalNode } from "@/hooks/use-portal-node";
import { cn } from "@/shared/utils";

import { DashboardCards } from "./dashboard/dashboard-cards";
import { DashboardChart } from "./dashboard/dashboard-chart";
import { DashboardErrorState, DashboardLoadingOverlay, DashboardLoadingState } from "./dashboard/dashboard-status";
import { DashboardTabs } from "./dashboard/dashboard-tabs";
import { useBinanceBalances } from "./dashboard/use-binance-balances";
import { useDashboardChartModel } from "./dashboard/use-dashboard-chart-model";
import { useDashboardData } from "./dashboard/use-dashboard-data";
import { useDashboardLivePrices } from "./dashboard/use-dashboard-live-prices";
import { useDashboardLiveTotals } from "./dashboard/use-dashboard-live-totals";
import { useDashboardResponsiveLayout } from "./dashboard/use-dashboard-responsive-layout";
import { useDashboardVisualState } from "./dashboard/use-dashboard-visual-state";

interface DashboardProps {
  userId: string;
  showUploadView?: boolean;
  isClosingUpload?: boolean;
  onCloseUpload?: () => void;
  uploadElement?: ReactNode;
  reviewElement?: ReactNode;
  previewTransactionsCount?: number;
  checkingCount?: number;
  investmentCount?: number;
  cryptoCount?: number;
  transactionCount?: number;
  isActive?: boolean;
  shouldLoad?: boolean;
  showSettingsView?: boolean;
  isClosingSettings?: boolean;
  onCloseSettings?: () => void;
  settingsElement?: ReactNode;
  showUserSelectView?: boolean;
  isClosingUserSelect?: boolean;
  onCloseUserSelect?: () => void;
  userSelectElement?: ReactNode;
  onImportRefreshComplete?: () => void;
  binanceRefreshKey?: number;
  emptyStateElement?: ReactNode;
  hasBinanceCredentials?: boolean;
}

export function Dashboard({
  userId,
  showUploadView = false,
  isClosingUpload = false,
  onCloseUpload,
  uploadElement,
  reviewElement,
  previewTransactionsCount = 0,
  checkingCount = 0,
  investmentCount = 0,
  cryptoCount = 0,
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
  emptyStateElement,
  hasBinanceCredentials = false
}: DashboardProps) {
  const {
    binanceBalances,
    isBinanceSyncing,
    filterSmallBinance,
    setFilterSmallBinance,
    binanceListRef
  } = useBinanceBalances({
    userId,
    isActive,
    shouldLoad,
    binanceRefreshKey
  });
  const { data, loading, error, importRefreshVersion } = useDashboardData({
    userId,
    isActive,
    shouldLoad,
    transactionCount
  });
  const livePrices = useDashboardLivePrices(data?.providerSummaries, {
    isActive,
    shouldLoad: shouldLoad && !!data
  });
  const binanceTotalCents = useMemo(
    () => Math.round(binanceBalances.reduce((sum, balance) => sum + balance.eurValue, 0) * 100),
    [binanceBalances]
  );
  const hasBinancePortfolio = hasBinanceCredentials || binanceTotalCents > 0;
  const requiresInitialUpload = transactionCount === 0 && !hasBinancePortfolio;
  const shouldShowUploadPanel = showUploadView && !showSettingsView && !showUserSelectView;
  const portalNode = usePortalNode("dashboard-tabs-portal");
  const cardsPortalNode = usePortalNode("dashboard-cards-portal");
  const {
    isMobile,
    marginLeft,
    marginRight,
    yAxisWidth
  } = useDashboardResponsiveLayout();
  const {
    activeChartPoint,
    activeTab,
    chartConfig,
    hasRenderableChartData,
    hiddenSeries,
    processedChartData,
    selectedValue,
    setActiveChartPoint,
    setActiveTab,
    setSelectedMonth,
    setSelectedSeriesKey,
    setShowSoldAssets,
    setTimeRange,
    showSoldAssets,
    timeRange,
    toggleSeries,
    visibleTabs,
    xAxisTicks
  } = useDashboardChartModel({
    binanceBalances,
    binanceTotalCents,
    checkingCount,
    cryptoCount,
    data,
    hasBinancePortfolio,
    investmentCount,
    transactionCount
  });
  const {
    getGlobalCryptoLiveTotal,
    getGlobalInvestmentLiveTotal,
    getProviderCryptoLiveTotal,
    getProviderInvestmentLiveTotal
  } = useDashboardLiveTotals({
    binanceBalances,
    data,
    livePrices
  });
  const {
    contentVisible,
    loadingOverlayFadingOut,
    setChartReady,
    showLoadingOverlay
  } = useDashboardVisualState({
    data,
    error,
    hasRenderableChartData,
    importRefreshVersion,
    loading,
    onImportRefreshComplete,
    shouldShowUploadPanel,
    transactionCount
  });

  if (!loading && error) {
    return <DashboardErrorState error={error} isActive={isActive} />;
  }

  if (!data) {
    return (
      <DashboardLoadingState
        isActive={isActive}
        showLoadingOverlay={showLoadingOverlay}
        loadingOverlayFadingOut={loadingOverlayFadingOut}
      />
    );
  }

  return (
    <div className={cn("absolute inset-0 flex h-full w-full flex-col gap-4", isActive ? "z-10 opacity-100 visible" : "z-0 pointer-events-none opacity-0 invisible")}>
      <DashboardLoadingOverlay showLoadingOverlay={showLoadingOverlay} loadingOverlayFadingOut={loadingOverlayFadingOut} />
      <DashboardTabs
        portalNode={portalNode}
        isActive={isActive}
        contentVisible={contentVisible}
        visibleTabs={visibleTabs}
        activeTab={activeTab}
        activePoint={activeChartPoint}
        data={data}
        onActiveTabChange={setActiveTab}
        getGlobalInvestmentLiveTotal={getGlobalInvestmentLiveTotal}
        getGlobalCryptoLiveTotal={getGlobalCryptoLiveTotal}
      />

      <DashboardChart
        showSettingsView={showSettingsView}
        isClosingSettings={isClosingSettings}
        onCloseSettings={onCloseSettings}
        settingsElement={settingsElement}
        showUserSelectView={showUserSelectView}
        isClosingUserSelect={isClosingUserSelect}
        onCloseUserSelect={onCloseUserSelect}
        userSelectElement={userSelectElement}
        shouldShowUploadPanel={shouldShowUploadPanel}
        isClosingUpload={isClosingUpload}
        onCloseUpload={onCloseUpload}
        uploadElement={uploadElement}
        emptyStateElement={requiresInitialUpload ? emptyStateElement : undefined}
        reviewElement={reviewElement}
        previewTransactionsCount={previewTransactionsCount}
        activeTab={activeTab}
        showSoldAssets={showSoldAssets}
        onShowSoldAssetsChange={setShowSoldAssets}
        timeRange={timeRange}
        onTimeRangeChange={setTimeRange}
        processedChartData={processedChartData}
        marginLeft={marginLeft}
        marginRight={marginRight}
        isMobile={isMobile}
        xAxisTicks={xAxisTicks}
        yAxisWidth={yAxisWidth}
        setActiveChartPoint={setActiveChartPoint}
        chartConfig={chartConfig}
        hiddenSeries={hiddenSeries}
        toggleSeries={toggleSeries}
        selectedValue={selectedValue}
        setSelectedMonth={setSelectedMonth}
        setSelectedSeriesKey={setSelectedSeriesKey}
        transactionCount={transactionCount}
        onChartReadyChange={setChartReady}
      />
      <DashboardCards
        cardsPortalNode={cardsPortalNode}
        isActive={isActive}
        contentVisible={contentVisible}
        data={data}
        timeRange={timeRange}
        livePrices={livePrices}
        binanceBalances={binanceBalances}
        isBinanceSyncing={isBinanceSyncing}
        filterSmallBinance={filterSmallBinance}
        setFilterSmallBinance={setFilterSmallBinance}
        binanceListRef={binanceListRef}
        getProviderInvestmentLiveTotal={getProviderInvestmentLiveTotal}
        getProviderCryptoLiveTotal={getProviderCryptoLiveTotal}
      />
    </div>
  );
}
