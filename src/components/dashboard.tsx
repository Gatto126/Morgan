"use client";

import { useMemo, type ReactNode } from "react";

import { usePortalNode } from "@/hooks/use-portal-node";
import { getUtcDateKey } from "@/shared/date-keys";
import { cn } from "@/shared/utils";

import { DashboardCards } from "./dashboard/dashboard-cards";
import { DashboardChart } from "./dashboard/dashboard-chart";
import { DashboardErrorState, DashboardLoadingOverlay, getDashboardStageVisibilityStyle } from "./dashboard/dashboard-status";
import { DashboardTabs } from "./dashboard/dashboard-tabs";
import {
  selectCurrentValuationChartPoint,
  useCurrentValuationSnapshot,
  type CurrentValuationSnapshot
} from "./finance-shell/current-valuations-store";
import {
  applyLiveBinanceBalanceValues,
  getBinanceBalancesTotalCents
} from "./dashboard/binance-live-values";
import { useBinanceBalances } from "./dashboard/use-binance-balances";
import { useDashboardChartModel } from "./dashboard/use-dashboard-chart-model";
import { useDashboardData } from "./dashboard/use-dashboard-data";
import { useDashboardLivePrices } from "./dashboard/use-dashboard-live-prices";
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

function isDashboardValuationSnapshotCurrent(
  snapshot: CurrentValuationSnapshot | null,
  {
    binanceRefreshKey,
    checkingCount,
    cryptoCount,
    investmentCount,
    transactionCount
  }: {
    binanceRefreshKey: number;
    checkingCount: number;
    cryptoCount: number;
    investmentCount: number;
    transactionCount: number;
  }
) {
  return !!snapshot
    && snapshot.version.binanceRefreshKey === binanceRefreshKey
    && snapshot.version.checkingCount === checkingCount
    && snapshot.version.cryptoCount === cryptoCount
    && snapshot.version.dateKey === getUtcDateKey()
    && snapshot.version.investmentCount === investmentCount
    && snapshot.version.transactionCount === transactionCount;
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
    binanceBalancesKnown,
    isBinanceSyncing,
    filterSmallBinance,
    setFilterSmallBinance,
    binanceListRef
  } = useBinanceBalances({
    userId,
    shouldLoad,
    binanceRefreshKey
  });
  const { data, dataFresh, loading, error, importRefreshVersion } = useDashboardData({
    userId,
    isActive,
    shouldLoad,
    transactionCount
  });
  const { cryptoPricesReady, investmentPricesReady, livePrices } = useDashboardLivePrices(data?.providerSummaries, {
    binanceBalances,
    isActive,
    shouldLoad: shouldLoad && !!data
  });
  const liveBinanceBalances = useMemo(
    () => applyLiveBinanceBalanceValues(binanceBalances, livePrices),
    [binanceBalances, livePrices]
  );
  const livePriceReadiness = useMemo(() => ({
    crypto: cryptoPricesReady,
    investment: investmentPricesReady
  }), [cryptoPricesReady, investmentPricesReady]);
  const binanceTotalCents = useMemo(
    () => getBinanceBalancesTotalCents(liveBinanceBalances),
    [liveBinanceBalances]
  );
  const hasBinancePortfolio = hasBinanceCredentials || binanceTotalCents > 0;
  const storedValuationSnapshot = useCurrentValuationSnapshot(userId);
  const currentValuationSnapshot = useMemo(
    () => isDashboardValuationSnapshotCurrent(storedValuationSnapshot, {
      binanceRefreshKey,
      checkingCount,
      cryptoCount,
      investmentCount,
      transactionCount
    })
      ? storedValuationSnapshot
      : null,
    [
      binanceRefreshKey,
      checkingCount,
      cryptoCount,
      investmentCount,
      storedValuationSnapshot,
      transactionCount
    ]
  );
  const currentValuationChartPoint = useMemo(
    () => selectCurrentValuationChartPoint(currentValuationSnapshot),
    [currentValuationSnapshot]
  );
  const dashboardValuesKnown = !!data && dataFresh;
  const dashboardCryptoValuesKnown = cryptoPricesReady && (!hasBinanceCredentials || binanceBalancesKnown);
  const hasCurrentValuationPoint = !!currentValuationChartPoint;
  const topbarCryptoValuesKnown = hasCurrentValuationPoint || dashboardCryptoValuesKnown;
  const topbarInvestmentValuesKnown = hasCurrentValuationPoint || investmentPricesReady;
  const requiresInitialUpload = transactionCount === 0 && !hasBinancePortfolio;
  const shouldShowUploadPanel = showUploadView && !showSettingsView && !showUserSelectView;
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
    applyLiveToday: false,
    binanceBalances: liveBinanceBalances,
    binanceTotalCents,
    checkingCount,
    currentValuationPoint: currentValuationChartPoint,
    cryptoCount,
    data,
    hasBinancePortfolio,
    investmentCount,
    livePriceReadiness,
    livePrices,
    transactionCount
  });
  const currentPoint = currentValuationChartPoint;
  const topbarPoint = activeChartPoint ?? currentPoint;
  const {
    contentVisible,
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
  const shouldRenderVisuals = isActive;

  if (!loading && error) {
    return <DashboardErrorState error={error} isActive={isActive} />;
  }

  return (
    <div
      className={cn("absolute inset-0 flex h-full w-full flex-col gap-4", isActive ? "z-10 opacity-100 visible" : "z-0 pointer-events-none opacity-0 invisible")}
      style={getDashboardStageVisibilityStyle(isActive)}
    >
      {shouldRenderVisuals ? (
        <>
          <DashboardLoadingOverlay showLoadingOverlay={showLoadingOverlay} />
          <DashboardTabs
            visibleTabs={visibleTabs}
            activeTab={activeTab}
            activePoint={data ? topbarPoint : null}
            isTooltipActive={!!activeChartPoint}
            cryptoValuesKnown={topbarCryptoValuesKnown}
            investmentValuesKnown={topbarInvestmentValuesKnown}
            valuesKnown={dashboardValuesKnown}
            userId={userId}
            onActiveTabChange={setActiveTab}
          />
          {data ? (
            <>
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
                currentPoint={currentPoint}
                currentValuationSnapshot={currentValuationSnapshot}
                investmentValuesKnown={topbarInvestmentValuesKnown}
                livePrices={livePrices}
                binanceBalances={liveBinanceBalances}
                isBinanceSyncing={isBinanceSyncing}
                filterSmallBinance={filterSmallBinance}
                setFilterSmallBinance={setFilterSmallBinance}
                binanceListRef={binanceListRef}
              />
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
