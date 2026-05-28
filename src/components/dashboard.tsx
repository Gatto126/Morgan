"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { ACCOUNT_TABS, GRAYSCALE_PALETTE } from "./dashboard/constants";
import { filterData, formatProviderLabel } from "./dashboard/formatters";
import type { AccountTab, MonthlyBucket, ProviderSummary, TimeRange } from "./dashboard/types";
import { useDashboardData } from "./dashboard/use-dashboard-data";
import { useDashboardLivePrices } from "./dashboard/use-dashboard-live-prices";
import { useBinanceBalances } from "./dashboard/use-binance-balances";
import { DashboardErrorState, DashboardLoadingOverlay, DashboardLoadingState } from "./dashboard/dashboard-status";
import { DashboardTabs } from "./dashboard/dashboard-tabs";
import { DashboardChart, type DashboardChartPoint } from "./dashboard/dashboard-chart";
import { DashboardCards } from "./dashboard/dashboard-cards";

interface DashboardProps {
  userId: string;
  showUploadView?: boolean;
  isClosingUpload?: boolean;
  onCloseUpload?: () => void;
  uploadElement?: React.ReactNode;
  reviewElement?: React.ReactNode;
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
  settingsElement?: React.ReactNode;
  showUserSelectView?: boolean;
  isClosingUserSelect?: boolean;
  onCloseUserSelect?: () => void;
  userSelectElement?: React.ReactNode;
  onImportRefreshComplete?: () => void;
  binanceRefreshKey?: number;
  emptyStateElement?: React.ReactNode;
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
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);
  const [loadingOverlayFadingOut, setLoadingOverlayFadingOut] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
  const [chartReady, setChartReady] = useState(false);
  const firstLoadCompletedRef = useRef(false);
  const completedImportRefreshVersionRef = useRef(0);
  const onImportRefreshCompleteRef = useRef(onImportRefreshComplete);
  const [activeTab, setActiveTab] = useState<AccountTab>("heritage");
  const [timeRange, setTimeRange] = useState<TimeRange>("ALL");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedSeriesKey, setSelectedSeriesKey] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const livePrices = useDashboardLivePrices(data?.providerSummaries, { isActive, shouldLoad: shouldLoad && !!data });
  const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>({});
  const [prevActiveTab, setPrevActiveTab] = useState<AccountTab>(activeTab);
  const [showSoldAssets, setShowSoldAssets] = useState(false);
  const [activeChartPoint, setActiveChartPoint] = useState<DashboardChartPoint | null>(null);
  const binanceTotalCents = useMemo(
    () => Math.round(binanceBalances.reduce((sum, balance) => sum + balance.eurValue, 0) * 100),
    [binanceBalances]
  );
  const hasBinancePortfolio = hasBinanceCredentials || binanceTotalCents > 0;
  const requiresInitialUpload = transactionCount === 0 && !hasBinancePortfolio;
  const shouldShowUploadPanel = showUploadView && !showSettingsView && !showUserSelectView;

  useEffect(() => {
    onImportRefreshCompleteRef.current = onImportRefreshComplete;
  }, [onImportRefreshComplete]);

  const visibleTabs = useMemo(() => {
    return ACCOUNT_TABS.filter((tab) => {
      if (tab.key === "heritage") return transactionCount > 0 || hasBinancePortfolio;
      if (tab.key === "checking") return checkingCount > 0;
      if (tab.key === "investment") return investmentCount > 0;
      if (tab.key === "crypto") return cryptoCount > 0;
      return true;
    });
  }, [checkingCount, hasBinancePortfolio, investmentCount, cryptoCount, transactionCount]);

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === activeTab)) {
      const timer = window.setTimeout(() => {
        setActiveTab("heritage");
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [visibleTabs, activeTab]);

  if (activeTab !== prevActiveTab) {
    setPrevActiveTab(activeTab);
    setHiddenSeries({});
    setSelectedMonth(null);
    setSelectedSeriesKey(null);
  }

  const toggleSeries = useCallback((key: string) => {
    setHiddenSeries(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  }, []);

  const checkingProviders = useMemo(() => {
    if (!data) return [];
    const keys = new Set<string>();
    data.monthlyData.forEach((b) => {
      if (b.providerChecking) {
        Object.keys(b.providerChecking).forEach((k) => keys.add(k));
      }
    });
    return Array.from(keys);
  }, [data]);

  const investmentProducts = useMemo(() => {
    if (!data) return [];
    const keys = new Set<string>();
    data.monthlyData.forEach((b) => {
      if (b.providerProducts) {
        Object.keys(b.providerProducts).forEach((k) => keys.add(k));
      }
    });
    return Array.from(keys);
  }, [data]);

  const cryptoTokens = useMemo(() => {
    if (!data) return [];
    const keys = new Set<string>();
    data.monthlyData.forEach((b) => {
      if (b.providerCryptoTokens) {
        Object.keys(b.providerCryptoTokens).forEach((k) => keys.add(k));
      }
    });
    return Array.from(keys);
  }, [data]);

  // Institutions that have crypto transactions (used to build crypto chart sub-lines)
  const cryptoInstitutions = useMemo(() => {
    if (!data) return [];
    return data.providerSummaries
      .filter(p => p.cryptoTokens.some(x => Math.abs(x.quantity) > 0.000001))
      .map(p => p.sourceInstitution);
  }, [data]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const yAxisWidth = isMobile ? 0 : 50;
  const baseMargin = isMobile ? 0 : 24;
  const marginLeft = baseMargin;
  const marginRight = baseMargin;

  const portalNode = typeof document === "undefined" ? null : document.getElementById("dashboard-tabs-portal");
  const cardsPortalNode = typeof document === "undefined" ? null : document.getElementById("dashboard-cards-portal");

  const chartData = useMemo(() => {
    if (!data) {
      return [];
    }

    const firstAcquisitionDates = new Map<string, string>();

    data.dailyData.forEach((bucket) => {
      const bucketDate = bucket.date || bucket.month || "";

      // checking/investment/crypto categories
      if (bucket.checking && Math.abs(bucket.checking) > 0.000001 && !firstAcquisitionDates.has("checking")) {
        firstAcquisitionDates.set("checking", bucketDate);
      }
      if (bucket.investment && Math.abs(bucket.investment) > 0.000001 && !firstAcquisitionDates.has("investment")) {
        firstAcquisitionDates.set("investment", bucketDate);
      }
      if (bucket.crypto && Math.abs(bucket.crypto) > 0.000001 && !firstAcquisitionDates.has("crypto")) {
        firstAcquisitionDates.set("crypto", bucketDate);
      }

      // main value
      const val = bucket[activeTab as keyof MonthlyBucket] as number | undefined;
      if (val && Math.abs(val) > 0.000001 && !firstAcquisitionDates.has("value")) {
        firstAcquisitionDates.set("value", bucketDate);
      }

      // providerChecking
      if (bucket.providerChecking) {
        Object.keys(bucket.providerChecking).forEach((prov) => {
          const provVal = bucket.providerChecking?.[prov];
          if (provVal && Math.abs(provVal) > 0.000001 && !firstAcquisitionDates.has(prov)) {
            firstAcquisitionDates.set(prov, bucketDate);
          }
        });
      }

      // providerProducts
      if (bucket.providerProducts) {
        Object.keys(bucket.providerProducts).forEach((prod) => {
          const prodVal = bucket.providerProducts?.[prod];
          if (prodVal && Math.abs(prodVal) > 0.000001 && !firstAcquisitionDates.has(prod)) {
            firstAcquisitionDates.set(prod, bucketDate);
          }
        });
      }

      // providerCryptoTokens
      if (bucket.providerCryptoTokens) {
        Object.keys(bucket.providerCryptoTokens).forEach((token) => {
          const tokenVal = bucket.providerCryptoTokens?.[token];
          if (tokenVal && Math.abs(tokenVal) > 0.000001 && !firstAcquisitionDates.has(token)) {
            firstAcquisitionDates.set(token, bucketDate);
          }
        });
      }

      // Institution-level crypto (for crypto tab sub-lines by institution)
      if (bucket.crypto && Math.abs(bucket.crypto) > 0.000001) {
        cryptoInstitutions.forEach((inst) => {
          const key = `crypto_inst_${inst}`;
          if (!firstAcquisitionDates.has(key)) firstAcquisitionDates.set(key, bucketDate);
        });
      }
    });

    const filtered = filterData({ monthly: data.monthlyData, daily: data.dailyData }, timeRange) as (MonthlyBucket & { date?: string })[];

    return filtered.map((bucket) => {
      const val = bucket[activeTab as keyof MonthlyBucket] as number | undefined;
      const rawMonth = bucket.date || bucket.month;
      const bucketDate = bucket.date || bucket.month || "";

      const resolveValue = (key: string, rawVal: number | undefined) => {
        const firstDate = firstAcquisitionDates.get(key);
        const hasBeenAcquired = firstDate && bucketDate >= firstDate;

        if (rawVal && Math.abs(rawVal) > 0.000001) {
          return Math.abs(rawVal);
        } else if (hasBeenAcquired) {
          return 0;
        }
        return null;
      };

      const checkingVal = resolveValue("checking", bucket.checking);
      const investmentVal = resolveValue("investment", bucket.investment);
      const cryptoVal = resolveValue("crypto", bucket.crypto);
      // Add live Binance to crypto only after the first crypto transaction exists (honest about history)
      const cryptoWithBinance = cryptoVal !== null ? cryptoVal + binanceTotalCents : null;

      // Main line: add Binance to heritage/crypto tabs so the white line reflects the full portfolio
      const rawValue = resolveValue("value", val);
      const valueWithBinance =
        rawValue !== null
          ? (activeTab === "heritage" || activeTab === "crypto" ? rawValue + binanceTotalCents : rawValue)
          : (hasBinancePortfolio && (activeTab === "heritage" || activeTab === "crypto") ? binanceTotalCents : rawValue);

      const baseEntry: Record<string, number | string | null> = {
        month: rawMonth,
        rawMonth,
        value: valueWithBinance
      };

      baseEntry.checking = checkingVal;
      baseEntry.investment = investmentVal;
      baseEntry.crypto = cryptoWithBinance; // used as CRYPTO sub-line in heritage tab

      if (checkingVal === null && investmentVal === null && cryptoWithBinance === null) {
        baseEntry.heritage = hasBinancePortfolio ? binanceTotalCents : null;
      } else {
        baseEntry.heritage = (checkingVal || 0) + (investmentVal || 0) + ((cryptoWithBinance) || 0);
      }

      checkingProviders.forEach((prov) => {
        baseEntry[prov] = resolveValue(prov, bucket.providerChecking?.[prov]);
      });

      investmentProducts.forEach((prod) => {
        baseEntry[prod] = resolveValue(prod, bucket.providerProducts?.[prod]);
      });

      cryptoTokens.forEach((token) => {
        baseEntry[token] = resolveValue(token, bucket.providerCryptoTokens?.[token]);
      });

      // Institution aggregate crypto â€” sum all tokens per bucket as one line per institution.
      // Since providerCryptoTokens are not split by institution in historical data,
      // we attribute the total to each institution proportionally (for single-institution
      // users this equals 100%; multi-institution is additive â€” improve with API later).
      cryptoInstitutions.forEach((inst) => {
        const instKey = `crypto_inst_${inst}`;
        const rawSum = cryptoTokens.reduce((s, token) => {
          const v = bucket.providerCryptoTokens?.[token];
          return s + (v != null && Math.abs(v) > 0.000001 ? Math.abs(v) : 0);
        }, 0);
        baseEntry[instKey] = resolveValue(instKey, rawSum > 0 ? rawSum : undefined);
      });

      // Binance sub-line key for the crypto tab (constant live value, no historical data)
      baseEntry["binance"] = hasBinancePortfolio ? binanceTotalCents : null;

      return baseEntry;
    });
  }, [data, activeTab, timeRange, checkingProviders, investmentProducts, cryptoTokens, cryptoInstitutions, binanceTotalCents, hasBinancePortfolio]);

  const activePoint = activeChartPoint;

  const xAxisTicks = useMemo(() => {
    const ticks: string[] = [];
    const seenMonths = new Set<string>();
    chartData.forEach((d) => {
      const rawMonth = d.rawMonth as string;
      if (!rawMonth) return;
      const monthKey = rawMonth.substring(0, 7); // "YYYY-MM"
      if (!seenMonths.has(monthKey)) {
        seenMonths.add(monthKey);
        ticks.push(rawMonth);
      }
    });
    return ticks;
  }, [chartData]);

  const selectedValue = useMemo(() => {
    if (!selectedMonth || !chartData) return null;
    const entry = chartData.find(d => d.rawMonth === selectedMonth);
    const key = selectedSeriesKey || "value";
    return entry ? (entry[key] as number | null) : null;
  }, [selectedMonth, selectedSeriesKey, chartData]);

  const processedChartData = useMemo(() => {
    if (selectedValue === null) return chartData;
    return chartData.map(d => ({
      ...d,
      referenceLineValue: selectedValue
    }));
  }, [chartData, selectedValue]);

  const chartConfig = useMemo(() => {
    if (activeTab === "heritage") {
      const subLines = [];
      if (checkingCount > 0) {
        subLines.push({ key: "checking", label: "CHECKING", stroke: "#a3a3a3" });
      }
      if (investmentCount > 0) {
        subLines.push({ key: "investment", label: "INVESTMENT", stroke: "#737373" });
      }
      if (cryptoCount > 0) {
        subLines.push({ key: "crypto", label: "CRYPTO", stroke: "#525252" });
      }
      return {
        mainKey: "heritage",
        mainLabel: "HERITAGE",
        subLines
      };
    } else if (activeTab === "checking") {
      return {
        mainKey: "checking",
        mainLabel: "CHECKING",
        subLines: checkingProviders.map((p, idx) => ({
          key: p,
          label: formatProviderLabel(p),
          stroke: GRAYSCALE_PALETTE[idx % GRAYSCALE_PALETTE.length]
        }))
      };
    } else if (activeTab === "investment") {
      let filteredProducts = investmentProducts;
      if (!showSoldAssets) {
        filteredProducts = investmentProducts.filter(pName => {
          return data?.providerSummaries.some(p =>
            p.investmentProducts.some(ip => ip.productName === pName && Math.abs(ip.quantity) > 0.000001)
          ) ?? false;
        });
      }
      return {
        mainKey: "investment",
        mainLabel: "INVESTMENT",
        subLines: filteredProducts.map((p, idx) => ({
          key: p,
          label: p,
          stroke: GRAYSCALE_PALETTE[idx % GRAYSCALE_PALETTE.length]
        }))
      };
    } else { // activeTab === "crypto"
      const instLines = cryptoInstitutions.map((inst, idx) => ({
        key: `crypto_inst_${inst}`,
        label: formatProviderLabel(inst),
        stroke: GRAYSCALE_PALETTE[idx % GRAYSCALE_PALETTE.length]
      }));
      if (binanceBalances.length > 0) {
        instLines.push({
          key: "binance",
          label: "BINANCE",
          stroke: GRAYSCALE_PALETTE[instLines.length % GRAYSCALE_PALETTE.length]
        });
      }
      return {
        mainKey: "crypto",
        mainLabel: "CRYPTO",
        subLines: instLines
      };
    }
  }, [activeTab, checkingCount, checkingProviders, cryptoCount, cryptoInstitutions, binanceBalances, investmentCount, investmentProducts, showSoldAssets, data?.providerSummaries]);

  const hasRenderableChartData = useMemo(() => {
    const seriesKeys = ["value", ...chartConfig.subLines.map((series) => series.key)];

    return chartData.some((point) =>
      seriesKeys.some((key) => {
        const value = point[key];
        return typeof value === "number" && Number.isFinite(value);
      })
    );
  }, [chartData, chartConfig]);

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
    setLoadingOverlayFadingOut(true);
    setContentVisible(true);
    const timer = window.setTimeout(() => {
      setShowLoadingOverlay(false);
      setLoadingOverlayFadingOut(false);
    }, 550);
    return () => window.clearTimeout(timer);
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

  if (!loading && error) {
    return <DashboardErrorState error={error} isActive={isActive} />;
  }

  if (!data) {
    return <DashboardLoadingState isActive={isActive} showLoadingOverlay={showLoadingOverlay} loadingOverlayFadingOut={loadingOverlayFadingOut} />;
  }

  const getProviderInvestmentLiveTotal = (provider: ProviderSummary) => {
    let liveTotal = 0;
    let hasHoldings = false;
    for (const prod of provider.investmentProducts) {
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
    return hasHoldings ? liveTotal : 0;
  };

  const getGlobalInvestmentLiveTotal = () => {
    return data.providerSummaries.reduce((sum, p) => sum + getProviderInvestmentLiveTotal(p), 0);
  };

  const getProviderCryptoLiveTotal = (provider: ProviderSummary) => {
    let liveTotal = 0;
    let hasHoldings = false;
    for (const token of provider.cryptoTokens) {
      if (Math.abs(token.quantity) > 0.000001) {
        hasHoldings = true;
        const livePrice = token.tokenSymbol ? livePrices[token.tokenSymbol] : null;
        if (livePrice != null) {
          liveTotal += Math.round(token.quantity * livePrice * 100);
        } else {
          liveTotal += token.investedValue;
        }
      }
    }
    return hasHoldings ? liveTotal : 0;
  };

  const getGlobalCryptoLiveTotal = () => {
    const txCrypto = data.providerSummaries.reduce((sum, p) => sum + getProviderCryptoLiveTotal(p), 0);
    const binanceCents = Math.round(binanceBalances.reduce((s, b) => s + b.eurValue, 0) * 100);
    return txCrypto + binanceCents;
  };

  return (
    <div className={cn("absolute inset-0 flex h-full w-full flex-col gap-4", isActive ? "z-10 opacity-100 visible" : "z-0 pointer-events-none opacity-0 invisible")}>
      <DashboardLoadingOverlay showLoadingOverlay={showLoadingOverlay} loadingOverlayFadingOut={loadingOverlayFadingOut} />
      <DashboardTabs
        portalNode={portalNode}
        isActive={isActive}
        contentVisible={contentVisible}
        visibleTabs={visibleTabs}
        activeTab={activeTab}
        activePoint={activePoint}
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
