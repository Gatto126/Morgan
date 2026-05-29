"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ACCOUNT_TABS, GRAYSCALE_PALETTE } from "./constants";
import type { DashboardChartConfig, DashboardChartPoint } from "./dashboard-chart-types";
import { filterData, formatProviderLabel } from "./formatters";
import type { AccountTab, BinanceBalanceRow, DashboardData, MonthlyBucket, TimeRange } from "./types";

type UseDashboardChartModelParams = {
  binanceBalances: BinanceBalanceRow[];
  binanceTotalCents: number;
  checkingCount: number;
  cryptoCount: number;
  data: DashboardData | null;
  hasBinancePortfolio: boolean;
  investmentCount: number;
  transactionCount: number;
};

export function useDashboardChartModel({
  binanceBalances,
  binanceTotalCents,
  checkingCount,
  cryptoCount,
  data,
  hasBinancePortfolio,
  investmentCount,
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
    setHiddenSeries((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  }, []);

  const checkingProviders = useMemo(() => {
    if (!data) return [];
    const keys = new Set<string>();
    data.monthlyData.forEach((bucket) => {
      if (bucket.providerChecking) {
        Object.keys(bucket.providerChecking).forEach((key) => keys.add(key));
      }
    });
    return Array.from(keys);
  }, [data]);

  const investmentProducts = useMemo(() => {
    if (!data) return [];
    const keys = new Set<string>();
    data.monthlyData.forEach((bucket) => {
      if (bucket.providerProducts) {
        Object.keys(bucket.providerProducts).forEach((key) => keys.add(key));
      }
    });
    return Array.from(keys);
  }, [data]);

  const cryptoTokens = useMemo(() => {
    if (!data) return [];
    const keys = new Set<string>();
    data.monthlyData.forEach((bucket) => {
      if (bucket.providerCryptoTokens) {
        Object.keys(bucket.providerCryptoTokens).forEach((key) => keys.add(key));
      }
    });
    return Array.from(keys);
  }, [data]);

  const cryptoInstitutions = useMemo(() => {
    if (!data) return [];
    return data.providerSummaries
      .filter((provider) => provider.cryptoTokens.some((token) => Math.abs(token.quantity) > 0.000001))
      .map((provider) => provider.sourceInstitution);
  }, [data]);

  const chartData = useMemo(() => {
    if (!data) {
      return [];
    }

    const firstAcquisitionDates = new Map<string, string>();

    data.dailyData.forEach((bucket) => {
      const bucketDate = bucket.date || bucket.month || "";

      if (bucket.checking && Math.abs(bucket.checking) > 0.000001 && !firstAcquisitionDates.has("checking")) {
        firstAcquisitionDates.set("checking", bucketDate);
      }
      if (bucket.investment && Math.abs(bucket.investment) > 0.000001 && !firstAcquisitionDates.has("investment")) {
        firstAcquisitionDates.set("investment", bucketDate);
      }
      if (bucket.crypto && Math.abs(bucket.crypto) > 0.000001 && !firstAcquisitionDates.has("crypto")) {
        firstAcquisitionDates.set("crypto", bucketDate);
      }

      const val = bucket[activeTab as keyof MonthlyBucket] as number | undefined;
      if (val && Math.abs(val) > 0.000001 && !firstAcquisitionDates.has("value")) {
        firstAcquisitionDates.set("value", bucketDate);
      }

      if (bucket.providerChecking) {
        Object.keys(bucket.providerChecking).forEach((provider) => {
          const providerValue = bucket.providerChecking?.[provider];
          if (providerValue && Math.abs(providerValue) > 0.000001 && !firstAcquisitionDates.has(provider)) {
            firstAcquisitionDates.set(provider, bucketDate);
          }
        });
      }

      if (bucket.providerProducts) {
        Object.keys(bucket.providerProducts).forEach((product) => {
          const productValue = bucket.providerProducts?.[product];
          if (productValue && Math.abs(productValue) > 0.000001 && !firstAcquisitionDates.has(product)) {
            firstAcquisitionDates.set(product, bucketDate);
          }
        });
      }

      if (bucket.providerCryptoTokens) {
        Object.keys(bucket.providerCryptoTokens).forEach((token) => {
          const tokenValue = bucket.providerCryptoTokens?.[token];
          if (tokenValue && Math.abs(tokenValue) > 0.000001 && !firstAcquisitionDates.has(token)) {
            firstAcquisitionDates.set(token, bucketDate);
          }
        });
      }

      if (bucket.crypto && Math.abs(bucket.crypto) > 0.000001) {
        cryptoInstitutions.forEach((institution) => {
          const key = `crypto_inst_${institution}`;
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
          return rawVal;
        }
        if (hasBeenAcquired) {
          return 0;
        }
        return null;
      };

      const checkingVal = resolveValue("checking", bucket.checking);
      const investmentVal = resolveValue("investment", bucket.investment);
      const cryptoVal = resolveValue("crypto", bucket.crypto);
      const cryptoWithBinance = cryptoVal !== null ? cryptoVal + binanceTotalCents : null;

      const rawValue = resolveValue("value", val);
      const valueWithBinance =
        rawValue !== null
          ? (activeTab === "heritage" || activeTab === "crypto" ? rawValue + binanceTotalCents : rawValue)
          : (hasBinancePortfolio && (activeTab === "heritage" || activeTab === "crypto") ? binanceTotalCents : rawValue);

      const baseEntry: DashboardChartPoint = {
        month: rawMonth,
        rawMonth,
        value: valueWithBinance
      };

      baseEntry.checking = checkingVal;
      baseEntry.investment = investmentVal;
      baseEntry.crypto = cryptoWithBinance;

      if (checkingVal === null && investmentVal === null && cryptoWithBinance === null) {
        baseEntry.heritage = hasBinancePortfolio ? binanceTotalCents : null;
      } else {
        baseEntry.heritage = (checkingVal || 0) + (investmentVal || 0) + (cryptoWithBinance || 0);
      }

      checkingProviders.forEach((provider) => {
        baseEntry[provider] = resolveValue(provider, bucket.providerChecking?.[provider]);
      });

      investmentProducts.forEach((product) => {
        baseEntry[product] = resolveValue(product, bucket.providerProducts?.[product]);
      });

      cryptoTokens.forEach((token) => {
        baseEntry[token] = resolveValue(token, bucket.providerCryptoTokens?.[token]);
      });

      cryptoInstitutions.forEach((institution) => {
        const institutionKey = `crypto_inst_${institution}`;
        const rawSum = cryptoTokens.reduce((sum, token) => {
          const value = bucket.providerCryptoTokens?.[token];
          return sum + (value != null && Math.abs(value) > 0.000001 ? Math.abs(value) : 0);
        }, 0);
        baseEntry[institutionKey] = resolveValue(institutionKey, rawSum > 0 ? rawSum : undefined);
      });

      baseEntry.binance = hasBinancePortfolio ? binanceTotalCents : null;

      return baseEntry;
    });
  }, [data, activeTab, timeRange, checkingProviders, investmentProducts, cryptoTokens, cryptoInstitutions, binanceTotalCents, hasBinancePortfolio]);

  const xAxisTicks = useMemo(() => {
    const ticks: string[] = [];
    const seenMonths = new Set<string>();
    chartData.forEach((dataPoint) => {
      const rawMonth = dataPoint.rawMonth as string;
      if (!rawMonth) return;
      const monthKey = rawMonth.substring(0, 7);
      if (!seenMonths.has(monthKey)) {
        seenMonths.add(monthKey);
        ticks.push(rawMonth);
      }
    });
    return ticks;
  }, [chartData]);

  const selectedValue = useMemo(() => {
    if (!selectedMonth) return null;
    const entry = chartData.find((dataPoint) => dataPoint.rawMonth === selectedMonth);
    const key = selectedSeriesKey || "value";
    return entry ? (entry[key] as number | null) : null;
  }, [selectedMonth, selectedSeriesKey, chartData]);

  const processedChartData = useMemo(() => {
    if (selectedValue === null) return chartData;
    return chartData.map((dataPoint) => ({
      ...dataPoint,
      referenceLineValue: selectedValue
    }));
  }, [chartData, selectedValue]);

  const chartConfig: DashboardChartConfig = useMemo(() => {
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
    }

    if (activeTab === "checking") {
      return {
        mainKey: "checking",
        mainLabel: "CHECKING",
        subLines: checkingProviders.map((provider, index) => ({
          key: provider,
          label: formatProviderLabel(provider),
          stroke: GRAYSCALE_PALETTE[index % GRAYSCALE_PALETTE.length]
        }))
      };
    }

    if (activeTab === "investment") {
      let filteredProducts = investmentProducts;
      if (!showSoldAssets) {
        filteredProducts = investmentProducts.filter((productName) => {
          return data?.providerSummaries.some((provider) =>
            provider.investmentProducts.some((product) => product.productName === productName && Math.abs(product.quantity) > 0.000001)
          ) ?? false;
        });
      }
      return {
        mainKey: "investment",
        mainLabel: "INVESTMENT",
        subLines: filteredProducts.map((product, index) => ({
          key: product,
          label: product,
          stroke: GRAYSCALE_PALETTE[index % GRAYSCALE_PALETTE.length]
        }))
      };
    }

    const institutionLines = cryptoInstitutions.map((institution, index) => ({
      key: `crypto_inst_${institution}`,
      label: formatProviderLabel(institution),
      stroke: GRAYSCALE_PALETTE[index % GRAYSCALE_PALETTE.length]
    }));
    if (binanceBalances.length > 0) {
      institutionLines.push({
        key: "binance",
        label: "BINANCE",
        stroke: GRAYSCALE_PALETTE[institutionLines.length % GRAYSCALE_PALETTE.length]
      });
    }
    return {
      mainKey: "crypto",
      mainLabel: "CRYPTO",
      subLines: institutionLines
    };
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
