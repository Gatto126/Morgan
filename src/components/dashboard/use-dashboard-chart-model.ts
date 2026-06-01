"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  buildDashboardChartData,
  collectCheckingProviders,
  collectCryptoInstitutions,
  collectCryptoTokens,
  collectInvestmentProducts
} from "./dashboard-chart-data-model";
import {
  addReferenceLineValue,
  buildDashboardChartConfig,
  getSelectedChartValue,
  getVisibleDashboardTabs,
  getXAxisTicks,
  hasRenderableDashboardChartData
} from "./dashboard-chart-display-model";
import type { DashboardChartPoint } from "./dashboard-chart-types";
import type { AccountTab, BinanceBalanceRow, DashboardData, TimeRange } from "./types";

type UseDashboardChartModelParams = {
  binanceBalances: BinanceBalanceRow[];
  binanceTotalCents: number;
  checkingCount: number;
  currentValuationPoint?: DashboardChartPoint | null;
  cryptoCount: number;
  data: DashboardData | null;
  hasBinancePortfolio: boolean;
  investmentCount: number;
  livePriceReadiness?: {
    crypto?: boolean;
    investment?: boolean;
  };
  livePrices: Record<string, number | null>;
  transactionCount: number;
};

export function useDashboardChartModel({
  binanceBalances,
  binanceTotalCents,
  checkingCount,
  currentValuationPoint,
  cryptoCount,
  data,
  hasBinancePortfolio,
  investmentCount,
  livePriceReadiness,
  livePrices,
  transactionCount
}: UseDashboardChartModelParams) {
  const [activeTab, setActiveTab] = useState<AccountTab>("heritage");
  const [timeRange, setTimeRange] = useState<TimeRange>("ALL");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedSeriesKey, setSelectedSeriesKey] = useState<string | null>(null);
  const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>({});
  const [prevActiveTab, setPrevActiveTab] = useState<AccountTab>(activeTab);
  const [showSoldAssets, setShowSoldAssets] = useState(false);
  const [activeChartPoint, setActiveChartPoint] = useState<DashboardChartPoint | null>(null);

  const visibleTabs = useMemo(() => getVisibleDashboardTabs({
    checkingCount,
    cryptoCount,
    hasBinancePortfolio,
    investmentCount,
    transactionCount
  }), [checkingCount, cryptoCount, hasBinancePortfolio, investmentCount, transactionCount]);

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
    setHiddenSeries((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  }, []);

  const checkingProviders = useMemo(() => collectCheckingProviders(data), [data]);
  const investmentProducts = useMemo(() => collectInvestmentProducts(data), [data]);
  const cryptoTokens = useMemo(() => collectCryptoTokens(data), [data]);
  const cryptoInstitutions = useMemo(() => collectCryptoInstitutions(data), [data]);
  const todayKey = useMemo(() => getTodayKey(), []);

  const chartData = useMemo(() => buildDashboardChartData({
    activeTab,
    binanceTotalCents,
    checkingProviders,
    currentValuationPoint,
    cryptoInstitutions,
    cryptoTokens,
    data,
    hasBinancePortfolio,
    investmentProducts,
    livePriceReadiness,
    livePrices,
    todayKey,
    timeRange
  }), [
    activeTab,
    binanceTotalCents,
    checkingProviders,
    currentValuationPoint,
    cryptoInstitutions,
    cryptoTokens,
    data,
    hasBinancePortfolio,
    investmentProducts,
    livePriceReadiness,
    livePrices,
    todayKey,
    timeRange
  ]);
  const todayChartPoint = useMemo(
    () => chartData.find((point) => point.rawMonth === todayKey) ?? chartData[chartData.length - 1] ?? null,
    [chartData, todayKey]
  );
  const currentDisplayPoint = activeChartPoint ?? todayChartPoint;

  const xAxisTicks = useMemo(() => getXAxisTicks(chartData), [chartData]);

  const selectedValue = useMemo(
    () => getSelectedChartValue(chartData, selectedMonth, selectedSeriesKey),
    [chartData, selectedMonth, selectedSeriesKey]
  );

  const processedChartData = useMemo(
    () => addReferenceLineValue(chartData, selectedValue),
    [chartData, selectedValue]
  );

  const chartConfig = useMemo(() => buildDashboardChartConfig({
    activeTab,
    binanceBalanceCount: binanceBalances.length,
    checkingCount,
    checkingProviders,
    cryptoCount,
    cryptoInstitutions,
    investmentCount,
    investmentProducts,
    providerSummaries: data?.providerSummaries ?? [],
    showSoldAssets
  }), [
    activeTab,
    binanceBalances.length,
    checkingCount,
    checkingProviders,
    cryptoCount,
    cryptoInstitutions,
    investmentCount,
    investmentProducts,
    showSoldAssets,
    data?.providerSummaries
  ]);

  const hasRenderableChartData = useMemo(
    () => hasRenderableDashboardChartData(chartData, chartConfig),
    [chartData, chartConfig]
  );

  return {
    activeChartPoint,
    activeTab,
    chartConfig,
    chartData,
    currentDisplayPoint,
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
    todayChartPoint,
    timeRange,
    toggleSeries,
    visibleTabs,
    xAxisTicks
  };
}

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
