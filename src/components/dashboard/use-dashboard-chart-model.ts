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
import { useDashboardSeriesData } from "./use-dashboard-series-data";

type UseDashboardChartModelParams = {
  binanceBalances: BinanceBalanceRow[];
  binanceTotalCents: number;
  checkingCount: number;
  cryptoCount: number;
  data: DashboardData | null;
  hasBinancePortfolio: boolean;
  investmentCount: number;
  transactionCount: number;
  userId: string;
};

export function useDashboardChartModel({
  binanceBalances,
  binanceTotalCents,
  checkingCount,
  cryptoCount,
  data,
  hasBinancePortfolio,
  investmentCount,
  transactionCount,
  userId
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

  const chartDataSource = useDashboardSeriesData({
    activeTab,
    data,
    shouldLoad: !!data,
    userId
  });

  const checkingProviders = useMemo(() => collectCheckingProviders(chartDataSource), [chartDataSource]);
  const investmentProducts = useMemo(() => collectInvestmentProducts(chartDataSource), [chartDataSource]);
  const cryptoTokens = useMemo(() => collectCryptoTokens(chartDataSource), [chartDataSource]);
  const cryptoInstitutions = useMemo(() => collectCryptoInstitutions(chartDataSource), [chartDataSource]);

  const chartData = useMemo(() => buildDashboardChartData({
    activeTab,
    binanceTotalCents,
    checkingProviders,
    cryptoInstitutions,
    cryptoTokens,
    data: chartDataSource,
    hasBinancePortfolio,
    investmentProducts,
    timeRange
  }), [
    activeTab,
    binanceTotalCents,
    checkingProviders,
    cryptoInstitutions,
    cryptoTokens,
    chartDataSource,
    hasBinancePortfolio,
    investmentProducts,
    timeRange
  ]);

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
    providerSummaries: chartDataSource?.providerSummaries ?? [],
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
    chartDataSource?.providerSummaries
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
  };
}
