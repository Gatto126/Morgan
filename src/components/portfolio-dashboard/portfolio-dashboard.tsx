"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChartGantt, ChartBar, type LucideIcon, X } from "lucide-react";
import { Line, LineChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { globalLivePricesCache, saveLivePricesToCache } from "@/lib/live-prices";
import { cn } from "@/lib/utils";
import type { ActiveDotProps, ChartPoint, ChartTooltipPayload } from "@/types/chart";

type TimeRange = "ALL" | "1Y" | "6M" | "3M" | "1M" | "1W";

type MonthBucket = {
  month: string;
  total: number;
  providers: Record<string, number>;
  providerProducts: Record<string, Record<string, number>>;
};

type PortfolioBucket = MonthBucket & {
  date?: string;
};

export type PortfolioTransaction = {
  id: string;
  bookingDate: string;
  typeLabel: string;
  description: string;
  direction: "IN" | "OUT";
  amountCents: number;
  tradeType: string | null;
  productName: string | null;
  isin: string | null;
};

type PortfolioProductSummary = {
  productName: string;
  quantity: number;
  investedValue: number;
  cashback: number;
  isin: string | null;
};

type PortfolioProviderSummary = {
  sourceInstitution: string;
  total: number;
  income: number;
  expenses: number;
  interest: number;
  cashback: number;
  tax: number;
  transactions: PortfolioTransaction[];
  products: PortfolioProductSummary[];
};

type PortfolioData = {
  monthlyData: MonthBucket[];
  dailyData: PortfolioBucket[];
  providers: PortfolioProviderSummary[];
};

const GRAYSCALE_PALETTE = ["#8f8f8f", "#404040", "#b3b3b3", "#525252", "#262626", "#d4d4d4", "#737373"];
const TIME_RANGES: TimeRange[] = ["ALL", "1Y", "6M", "3M", "1M", "1W"];

const euroFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2
});

function formatEuroCents(cents: number) {
  return euroFormatter.format(cents / 100);
}

function formatProviderLabel(source: string) {
  return source.replace(/_/g, " ").toUpperCase();
}

function getAbbreviatedLabel(label: string) {
  const upper = label.trim().toUpperCase();
  if (upper === "TRADE REPUBLIC") return "TR";
  if (upper === "REVOLUT") return "REV";
  if (upper === "BINANCE") return "BIN";
  if (upper === "COINBASE") return "CB";
  if (upper === "BBVA") return "BBVA";

  const words = upper.split(/\s+/);
  if (words.length > 1) {
    return words.map(w => w[0]).join("");
  }
  return upper.length > 4 ? upper.slice(0, 3) : upper;
}

function getMonthLabel(month: string) {
  const [year, m] = month.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const shortYear = year.slice(2);
  return `${monthNames[Number.parseInt(m, 10) - 1]} ${shortYear}`;
}

function filterData(data: { monthly: MonthBucket[], daily: PortfolioBucket[] }, range: TimeRange): PortfolioBucket[] {
  if (range === "ALL") {
    return data.daily;
  }

  const cutoff = new Date();

  if (range === "1W") {
    cutoff.setDate(cutoff.getDate() - 7);
  } else if (range === "1M") {
    cutoff.setDate(cutoff.getDate() - 30);
  } else if (range === "3M") {
    cutoff.setMonth(cutoff.getMonth() - 3);
  } else if (range === "6M") {
    cutoff.setMonth(cutoff.getMonth() - 6);
  } else if (range === "1Y") {
    cutoff.setFullYear(cutoff.getFullYear() - 1);
  } else {
    return data.daily;
  }

  const cutoffKey = cutoff.toISOString().split('T')[0];
  return data.daily.filter(d => (d.date ?? "") >= cutoffKey);
}

type CustomTooltipProps = {
  active?: boolean;
  payload?: ChartTooltipPayload[];
  label?: string;
  setActivePoint: (point: ChartPoint | null) => void;
};

function ChartTooltip({ active, payload, label, setActivePoint }: CustomTooltipProps) {
  useEffect(() => {
    if (active && payload && payload.length > 0) {
      setActivePoint(payload[0].payload ?? null);
    } else {
      setActivePoint(null);
    }
  }, [active, payload, setActivePoint]);

  if (!active || !payload?.length) return null;

  let formattedLabel = label || "";
  if (formattedLabel.length === 10) {
    const [year, month, day] = formattedLabel.split("-");
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const shortYear = year.slice(2);
    formattedLabel = `${day} ${monthNames[Number.parseInt(month, 10) - 1]} ${shortYear}`;
  } else if (formattedLabel.length === 7) {
    formattedLabel = getMonthLabel(formattedLabel);
  }

  return (
    <div className="rounded-xl border border-[rgba(154,154,154,0.4)] bg-[rgba(35,35,35,0.96)] p-2 px-3.5 text-[13px] text-[#f5f5f5]">
      <div className="mb-1.5 font-bold">{formattedLabel}</div>
      <div className="flex flex-col gap-1">
        {[...payload].sort((a, b) => {
          if (a.name === "heritage" || a.name === "value" || a.name === "balance") return -1;
          if (b.name === "heritage" || b.name === "value" || b.name === "balance") return 1;
          return (b.value || 0) - (a.value || 0);
        }).map((p, index) => {
          const name = String(p.name ?? "");
          const labelStr = (name === "value" || name === "balance") ? "BALANCE" : name === "heritage" ? "HERITAGE" : formatProviderLabel(name);
          return (
            <div key={index} className="flex items-center justify-between gap-6">
              <span className="text-[10px] font-bold uppercase text-white truncate max-w-[150px]">{labelStr}</span>
              <span className="font-semibold">{formatEuroCents(p.value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const CustomReferenceLabel = (props: { viewBox?: { x: number; y: number }; value?: number; selectedValue?: number | null }) => {
  const { viewBox, value, selectedValue } = props;
  if (!viewBox) return null;
  const val = typeof selectedValue === 'number' ? selectedValue : (typeof value === 'number' ? value : 0);
  const formattedValue = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(val / 100);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const rectWidth = isMobile ? 64 : 72;
  const rectHeight = 24;
  const top = viewBox.y - rectHeight / 2;
  const left = isMobile ? Math.max(2, viewBox.x - rectWidth / 2) : viewBox.x - rectWidth + 2;
  const overlayTarget = typeof document !== "undefined" ? document.getElementById("chart-reference-overlay") : null;
  if (!overlayTarget) return null;
  return createPortal(
    <div className="pointer-events-none absolute z-[100] flex items-center justify-center rounded-[12px] border-2 border-[#444444] bg-[#1a1a1a] shadow-[0_4px_6px_-1px_rgba(0,0,0,0.4)]" style={{ top, left, width: rectWidth, height: rectHeight }}>
      <span className="whitespace-nowrap text-[10px] font-bold text-white">{isMobile ? formattedValue.replace(/\s/g, "").replace(",00", "") : formattedValue.replace(/\s/g, "")}</span>
    </div>,
    overlayTarget
  );
};

export type PortfolioDashboardConfig = {
  endpoint: string;
  rootLabel: string;
  rootIcon: LucideIcon;
  loadingLabel: string;
  fetchErrorMessage: string;
  priceQueryParam: "isins" | "cryptos";
  identifierLabel: string;
  showCashback: boolean;
  transactionFilter: (transaction: PortfolioTransaction) => boolean;
};

export interface PortfolioDashboardProps {
  config: PortfolioDashboardConfig;
  userId: string;
  showUploadView?: boolean;
  isClosingUpload?: boolean;
  onCloseUpload?: () => void;
  uploadElement?: React.ReactNode;
  reviewElement?: React.ReactNode;
  previewTransactionsCount?: number;
  transactionCount?: number;
  isActive?: boolean;
  showSettingsView?: boolean;
  isClosingSettings?: boolean;
  onCloseSettings?: () => void;
  settingsElement?: React.ReactNode;
  showUserSelectView?: boolean;
  isClosingUserSelect?: boolean;
  onCloseUserSelect?: () => void;
  userSelectElement?: React.ReactNode;
  onImportRefreshComplete?: () => void;
}

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
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [newProviderKeys, setNewProviderKeys] = useState<Set<string>>(new Set());
  const knownProviderKeysRef = useRef<Set<string>>(new Set());
  const pendingImportRefreshRef = useRef(false);
  const onImportRefreshCompleteRef = useRef(onImportRefreshComplete);
  const lastRefreshTransactionCountRef = useRef(transactionCount);
  const [activeTab, setActiveTab] = useState<string>("ALL");
  const [timeRange, setTimeRange] = useState<TimeRange>("ALL");
  const [selectedPoint, setSelectedPoint] = useState<{ month: string, seriesKey: string, value: number } | null>(null);
  const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>({});
  const [showSoldAssets, setShowSoldAssets] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [livePrices, setLivePrices] = useState<Record<string, number | null>>(globalLivePricesCache);
  const [activeChartPoint, setActiveChartPoint] = useState<ChartPoint | null>(null);
  const activePoint = activeChartPoint;
  const RootIcon = config.rootIcon;
  const toggleSeries = (key: string) => {
    setHiddenSeries(prev => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    onImportRefreshCompleteRef.current = onImportRefreshComplete;
  }, [onImportRefreshComplete]);

  const yAxisWidth = isMobile ? 0 : 50;
  const baseMargin = isMobile ? 0 : 24;
  const tabsPortalNode = typeof document === "undefined" ? null : document.getElementById("dashboard-tabs-portal");
  const cardsPortalNode = typeof document === "undefined" ? null : document.getElementById("dashboard-cards-portal");

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await fetch(`${config.endpoint}?userId=${userId}`, { cache: "no-store" });
      const payload = (await response.json()) as PortfolioData & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? config.fetchErrorMessage);
      const currentKeys = new Set(payload.providers.map((p: { sourceInstitution: string }) => p.sourceInstitution));
      if (pendingImportRefreshRef.current) {
        const newKeys = new Set([...currentKeys].filter(k => !knownProviderKeysRef.current.has(k)));
        if (newKeys.size > 0) {
          setNewProviderKeys(newKeys);
          setTimeout(() => setNewProviderKeys(new Set()), 1000);
        }
      }
      knownProviderKeysRef.current = currentKeys;
      setData(payload);
      setError(null);
    } catch (fetchError: unknown) {
      setError(fetchError instanceof Error ? fetchError.message : "Errore nel caricamento.");
      setData(null);
    } finally {
      setLoading(false);
      if (pendingImportRefreshRef.current) {
        pendingImportRefreshRef.current = false;
        setDataVersion(v => v + 1);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          onImportRefreshCompleteRef.current?.();
        }));
      }
    }
  }, [config.endpoint, config.fetchErrorMessage, userId]);

  const fetchLivePrices = useCallback(async (providers: PortfolioProviderSummary[]) => {
    const allIsins = new Set<string>();
    for (const prov of providers) {
      for (const prod of prov.products) {
        if (prod.isin && prod.quantity > 0.000001) allIsins.add(prod.isin);
      }
    }
    if (allIsins.size === 0) return;
    try {
      const res = await fetch(`/api/prices?${config.priceQueryParam}=${[...allIsins].join(",")}`);
      if (res.ok) {
        const prices = await res.json();
        saveLivePricesToCache(prices);
        setLivePrices(prev => ({ ...prev, ...prices }));
      }
    } catch { /* silently fail, prices stay null */ }
  }, [config.priceQueryParam]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    void fetchDashboard();
    const interval = window.setInterval(() => { void fetchDashboard(); }, 60_000);
    const handleFocus = () => { void fetchDashboard(); };
    window.addEventListener("focus", handleFocus);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", handleFocus); };
  }, [fetchDashboard, isActive]);

  useEffect(() => {
    if (!isActive || loading || lastRefreshTransactionCountRef.current === transactionCount) {
      return;
    }

    lastRefreshTransactionCountRef.current = transactionCount;
    pendingImportRefreshRef.current = true;
    void fetchDashboard();
  }, [transactionCount, isActive, loading, fetchDashboard]);

  // Fetch live prices whenever data changes, refresh them every 60 seconds and on window focus
  useEffect(() => {
    if (!isActive || !data?.providers) return;
    const providers = data.providers;

    const initialLoad = window.setTimeout(() => {
      void fetchLivePrices(providers);
    }, 0);

    const interval = window.setInterval(() => {
      void fetchLivePrices(providers);
    }, 60_000);

    const handleFocus = () => {
      void fetchLivePrices(providers);
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [data?.providers, fetchLivePrices, isActive]);

  const activeProvider = useMemo(() => {
    return data?.providers.find(p => p.sourceInstitution === activeTab) || null;
  }, [data, activeTab]);

  const chartData = useMemo(() => {
    if (!data) return [];

    const firstProductAcquisition = new Map<string, string>();
    const firstProviderAcquisition = new Map<string, string>();

    data.dailyData.forEach((bucket) => {
      const bucketDate = bucket.date || bucket.month || "";
      if (activeTab !== "ALL") {
        const prodData = bucket.providerProducts?.[activeTab] || {};
        Object.keys(prodData).forEach((pName) => {
          const val = prodData[pName];
          if (val && Math.abs(val) > 0.000001 && !firstProductAcquisition.has(pName)) {
            firstProductAcquisition.set(pName, bucketDate);
          }
        });
      }

      if (bucket.providers) {
        Object.keys(bucket.providers).forEach((provKey) => {
          const val = bucket.providers[provKey];
          if (val && Math.abs(val) > 0.000001 && !firstProviderAcquisition.has(provKey)) {
            firstProviderAcquisition.set(provKey, bucketDate);
          }
        });
      }
    });

    const filtered = filterData({ monthly: data.monthlyData, daily: data.dailyData }, timeRange);

    return filtered.map((bucket) => {
      const rawKey = bucket.date || bucket.month;
      const bucketDate = bucket.date || bucket.month || "";
      const ret: ChartPoint = { month: rawKey, rawMonth: rawKey };

      if (activeTab === "ALL") {
        ret.heritage = Math.abs(bucket.total);
        data.providers.forEach(p => {
          const provKey = p.sourceInstitution;
          const val = bucket.providers[provKey];
          const firstDate = firstProviderAcquisition.get(provKey);
          const hasBeenAcquired = firstDate && bucketDate >= firstDate;

          if (val && Math.abs(val) > 0.000001) {
            ret[provKey] = Math.abs(val);
          } else if (hasBeenAcquired) {
            ret[provKey] = 0;
          } else {
            ret[provKey] = null;
          }
        });
      } else {
        ret.heritage = Math.abs(bucket.total);
        data.providers.forEach(p => {
          const provKey = p.sourceInstitution;
          const val = bucket.providers[provKey];
          const firstDate = firstProviderAcquisition.get(provKey);
          const hasBeenAcquired = firstDate && bucketDate >= firstDate;

          if (val && Math.abs(val) > 0.000001) {
            ret[provKey] = Math.abs(val);
          } else if (hasBeenAcquired) {
            ret[provKey] = 0;
          } else {
            ret[provKey] = null;
          }
        });

        ret.balance = Math.abs(bucket.providers[activeTab] || 0);
        const prodData = bucket.providerProducts[activeTab] || {};

        // Initialize ALL known products
        activeProvider?.products.forEach(p => {
          const pName = p.productName;
          const val = prodData[pName];
          const firstDate = firstProductAcquisition.get(pName);
          const hasBeenAcquired = firstDate && bucketDate >= firstDate;

          if (val && Math.abs(val) > 0.000001) {
            ret[pName] = Math.abs(val);
          } else if (hasBeenAcquired) {
            ret[pName] = 0;
          } else {
            ret[pName] = null;
          }
        });
      }
      return ret;
    });
  }, [data, activeTab, timeRange, activeProvider]);

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

  if (loading) return <div className={cn("flex h-full items-center justify-center text-sm text-[color:var(--text-dim)]", !isActive && "absolute inset-0 pointer-events-none opacity-0 invisible")}>{config.loadingLabel}</div>;
  if (error) return <div className={cn("flex h-full items-center justify-center text-sm text-[color:var(--danger)]", !isActive && "absolute inset-0 pointer-events-none opacity-0 invisible")}>{error}</div>;
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
  const tabs = [{ key: "ALL", label: config.rootLabel, total: allTotal }, ...data.providers.map(p => ({ key: p.sourceInstitution, label: formatProviderLabel(p.sourceInstitution), total: getProviderLiveTotal(p) }))];

  return (
    <div className={cn("relative flex h-full flex-col gap-4 overflow-hidden w-full", !isActive && "absolute inset-0 pointer-events-none opacity-0 invisible")}>
      {tabsPortalNode && createPortal(
        <div className={cn("flex items-center gap-2 sm:gap-3", !isActive && "absolute pointer-events-none opacity-0 invisible")}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                data-active={isActive ? "true" : "false"}
                className={`flex h-12 w-[165px] flex-shrink-0 cursor-pointer items-center justify-between rounded-[16px] border-2 px-3 text-[11px] font-extrabold uppercase tracking-[0.14em] transition-colors hover:bg-[color:var(--surface-elevated)] has-lucide ${
                  isActive
                    ? "border-white bg-[color:var(--surface-panel)] text-white"
                    : "border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-[color:var(--text-dim)]"
                }`}
              >
                <div className="flex items-center justify-center w-[28px] flex-shrink-0">
                  {tab.key === "ALL" ? (
                    <RootIcon className="h-4 w-4 flex-shrink-0" strokeWidth={2.2} />
                  ) : (
                    <span className="font-bold">{getAbbreviatedLabel(tab.label)}</span>
                  )}
                </div>
                <span className={`text-right tabular-nums whitespace-nowrap ${isActive ? "" : "opacity-70"}`}>
                  {formatEuroCents(
                    activePoint
                      ? Number(tab.key === "ALL" ? (activePoint.heritage ?? 0) : (activePoint[tab.key] ?? 0))
                      : tab.total
                  )}
                </span>
              </button>
            );
          })}
        </div>,
        tabsPortalNode
      )}

      <div className="relative flex w-full flex-1 flex-col min-h-[240px] sm:min-h-[400px] md:min-h-[440px] lg:min-h-[520px] justify-center">
        {showUploadView ? (
          <div className={cn("relative w-full h-full flex flex-col justify-center", isClosingUpload ? "upload-panel-exit" : "upload-panel-enter")}>
            <div
              role="button"
              onClick={onCloseUpload}
              className="absolute right-0 top-0 z-50 flex h-8 w-8 cursor-pointer items-center justify-center text-[color:var(--text-dim)] transition-colors hover:text-white"
              title="Esci dall'importazione"
            >
              <X className="h-5 w-5" strokeWidth={2.3} />
            </div>
            {previewTransactionsCount > 0 ? reviewElement : uploadElement}
          </div>
        ) : showSettingsView ? (
          <div className={cn("relative w-full h-full flex flex-col justify-center", isClosingSettings ? "upload-panel-exit" : "upload-panel-enter")}>
            <div
              role="button"
              onClick={onCloseSettings}
              className="absolute right-0 top-0 z-50 flex h-8 w-8 cursor-pointer items-center justify-center text-[color:var(--text-dim)] transition-colors hover:text-white"
              title="Esci dalle impostazioni"
            >
              <X className="h-5 w-5" strokeWidth={2.3} />
            </div>
            {settingsElement}
          </div>
        ) : showUserSelectView ? (
          <div className={cn("relative w-full h-full flex flex-col justify-center", isClosingUserSelect ? "upload-panel-exit" : "upload-panel-enter")}>
            <div
              role="button"
              onClick={onCloseUserSelect}
              className="absolute right-0 top-0 z-50 flex h-8 w-8 cursor-pointer items-center justify-center text-[color:var(--text-dim)] transition-colors hover:text-white"
              title="Esci dalla selezione utente"
            >
              <X className="h-5 w-5" strokeWidth={2.3} />
            </div>
            {userSelectElement}
          </div>
        ) : (
          <>
            {activeTab !== "ALL" && (
              <div className="absolute left-0 top-0 z-10 flex items-center justify-start" style={{ marginLeft: isMobile ? 0 : 40 }}>
                <button
                  aria-label="Toggle sold assets"
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[color:var(--text-dim)] transition-colors hover:bg-[rgba(255,255,255,0.08)] hover:text-white"
                  onClick={(e) => { e.stopPropagation(); setShowSoldAssets(!showSoldAssets); }}
                  title={showSoldAssets ? "Nascondi asset venduti" : "Mostra asset venduti"}
                  type="button"
                >
                  {showSoldAssets ? <ChartGantt className="h-4 w-4" strokeWidth={2.2} /> : <ChartBar className="h-4 w-4" strokeWidth={2.2} />}
                </button>
              </div>
            )}
            <div className="absolute right-0 top-0 z-10 flex items-center justify-end gap-0.5">
              {TIME_RANGES.map((range) => (
                <button key={range} type="button" onClick={() => setTimeRange(range)} className="cursor-pointer rounded-md px-1.5 py-0 text-[8.5px] font-bold uppercase tracking-wider transition-colors duration-150 sm:text-[10px]" style={{ background: timeRange === range ? "rgba(255,255,255,0.08)" : "transparent", color: timeRange === range ? "#f5f5f5" : "#737373" }}>{range}</button>
              ))}
            </div>

            <div className="mt-10 flex-1 min-h-0 w-full outline-none" onClick={() => setSelectedPoint(null)}>
              <div className="relative h-full w-full">
                <style dangerouslySetInnerHTML={{ __html: `
                  .recharts-wrapper, .recharts-wrapper *, .recharts-surface, .recharts-surface *, .recharts-container, .recharts-container * {
                    outline: none !important;
                    box-shadow: none !important;
                  }
                `}} />
                <div id="chart-reference-overlay" className="pointer-events-none absolute inset-0 z-10" />
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: baseMargin, bottom: 0, left: baseMargin }} accessibilityLayer={false}>
                    <XAxis
                      dataKey="rawMonth"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#666666", fontSize: isMobile ? 9 : 11 }}
                      dy={8}
                      padding={{ left: isMobile ? 16 : 0, right: isMobile ? 16 : 0 }}
                      minTickGap={isMobile ? 20 : 10}
                      ticks={xAxisTicks}
                      tickFormatter={(value) => {
                        if (!value) return "";
                        if (value.length === 7) {
                          return getMonthLabel(value);
                        }
                        const [year, month] = value.split("-");
                        return getMonthLabel(`${year}-${month}`);
                      }}
                    />
                    <YAxis tick={{ fill: "#a8a8a8", fontSize: isMobile ? 9 : 10 }} axisLine={false} tickLine={false} mirror={isMobile} tickFormatter={(v) => formatEuroCents(v).replace(/\s/g, "").replace(",00", "")} width={yAxisWidth} />
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(154,154,154,0.12)" vertical={false} />
                    <Tooltip content={<ChartTooltip setActivePoint={setActiveChartPoint} />} cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1, fill: "transparent" }} />

                    {activeTab === "ALL" ? (
                      <>
                        {data.providers.map((p, idx) => {
                          const provKey = p.sourceInstitution;
                          if (hiddenSeries[provKey]) return null;
                          const strokeColor = GRAYSCALE_PALETTE[idx % GRAYSCALE_PALETTE.length];
                          return (
                            <Line
                              key={provKey}
                              type="linear"
                              dataKey={provKey}
                              name={provKey}
                              stroke={strokeColor}
                              strokeWidth={1.5}
                              isAnimationActive={false}
                              connectNulls={false}
                              activeDot={(props: ActiveDotProps) => {
                                const { cx, cy, payload } = props;
                                if (payload[provKey] == null) return null;
                                return <circle cx={cx} cy={cy} r={6} fill="#1a1a1a" stroke={strokeColor} strokeWidth={2} style={{ cursor: "pointer", outline: "none" }} onClick={(e) => { e.stopPropagation(); setSelectedPoint({ month: payload.rawMonth, seriesKey: provKey, value: Number(payload[provKey]) }); }} />;
                              }}
                              dot={false}
                            />
                          );
                        })}
                        <Line
                          key={`heritage-${Object.keys(hiddenSeries).sort().map(k => hiddenSeries[k] ? '0' : '1').join('')}`}
                          type="linear"
                          dataKey="heritage"
                          name="heritage"
                          stroke="#ffffff"
                          strokeWidth={2.5}
                          isAnimationActive={false}
                          connectNulls={false}
                          hide={!!hiddenSeries['heritage']}
                          activeDot={(props: ActiveDotProps) => {
                            const { cx, cy, payload } = props;
                            if (payload.heritage == null) return null;
                            return (
                              <circle
                                cx={cx} cy={cy} r={6}
                                fill="#1a1a1a" stroke="#ffffff" strokeWidth={2}
                                style={{ cursor: "pointer", outline: "none" }}
                                  onClick={(e) => { e.stopPropagation(); setSelectedPoint({ month: payload.rawMonth, seriesKey: 'heritage', value: Number(payload.heritage) }); }}
                              />
                            );
                          }}
                          dot={false}
                        />
                      </>
                    ) : (
                      <>
                        {activeProvider?.products.map((prod, idx) => {
                          const prodKey = prod.productName;
                          const isSold = Math.abs(prod.quantity) <= 0.000001;
                          if (!showSoldAssets && isSold) return null;
                          if (hiddenSeries[prodKey]) return null;
                          const strokeColor = GRAYSCALE_PALETTE[idx % GRAYSCALE_PALETTE.length];
                          return (
                            <Line
                              key={prodKey}
                              type="linear"
                              dataKey={prodKey}
                              name={prodKey}
                              stroke={strokeColor}
                              strokeWidth={1.5}
                              isAnimationActive={false}
                              connectNulls={false}
                              activeDot={(props: ActiveDotProps) => {
                                const { cx, cy, payload } = props;
                                if (payload[prodKey] == null) return null;
                                return (
                                  <circle
                                    cx={cx} cy={cy} r={5}
                                    fill="#1a1a1a" stroke={strokeColor} strokeWidth={2}
                                    style={{ cursor: "pointer", outline: "none" }}
                                    onClick={(e) => { e.stopPropagation(); setSelectedPoint({ month: payload.rawMonth, seriesKey: prodKey, value: Number(payload[prodKey]) }); }}
                                  />
                                );
                              }}
                              dot={false}
                            />
                          );
                        })}
                        <Line
                          key={`balance-${Object.keys(hiddenSeries).sort().map(k => hiddenSeries[k] ? '0' : '1').join('')}`}
                          type="linear"
                          dataKey="balance"
                          name="balance"
                          stroke="#ffffff"
                          strokeWidth={2.5}
                          isAnimationActive={false}
                          connectNulls={false}
                          hide={!!hiddenSeries['balance']}
                          activeDot={(props: ActiveDotProps) => {
                            const { cx, cy, payload } = props;
                            return (
                              <circle
                                cx={cx} cy={cy} r={6}
                                fill="#1a1a1a" stroke="#ffffff" strokeWidth={2}
                                style={{ cursor: "pointer", outline: "none" }}
                                  onClick={(e) => { e.stopPropagation(); setSelectedPoint({ month: payload.rawMonth, seriesKey: 'balance', value: Number(payload.balance) }); }}
                              />
                            );
                          }}
                          dot={false}
                        />
                      </>
                    )}
                    {selectedPoint && <ReferenceLine y={selectedPoint.value} stroke="rgba(254, 254, 254, 0.5)" strokeWidth={1.5} strokeDasharray="6 4" label={<CustomReferenceLabel selectedValue={selectedPoint.value} />} />}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div
              className="flex flex-wrap items-center justify-center gap-3 pt-2 pb-0 sm:gap-4 overflow-x-auto max-h-[100px] hide-scrollbar"
              style={{ visibility: transactionCount > 0 ? "visible" : "hidden" }}
            >
              {activeTab === "ALL" ? (() => {
                const allSeriesKeys = ['heritage', ...data.providers.map(p => p.sourceInstitution)];
                const visibleCount = allSeriesKeys.filter(k => !hiddenSeries[k]).length;

                return allSeriesKeys.map((k, idx) => {
                  const color = k === 'heritage' ? '#ffffff' : GRAYSCALE_PALETTE[(idx-1) % GRAYSCALE_PALETTE.length];
                  const isLastVisible = !hiddenSeries[k] && visibleCount <= 1;
                  return (
                    <div key={k} style={{ color: hiddenSeries[k] ? '#4C4C4C' : color }}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (isLastVisible) return;
                          toggleSeries(k);
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { if (isLastVisible) return; toggleSeries(k); } }}
                        className={`flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider select-none outline-none whitespace-nowrap ${
                          isLastVisible ? 'cursor-not-allowed' : 'cursor-pointer'
                        }`}
                        style={{ WebkitTapHighlightColor: 'transparent', color: 'inherit' }}
                      >
                        <div className="h-[6px] w-[14px] rounded-full sm:h-[8px] sm:w-[16px]" style={{ backgroundColor: hiddenSeries[k] ? '#4C4C4C' : color }} />
                        <span className={cn(hiddenSeries[k] && "line-through")}>
                          {k === 'heritage' ? 'HERITAGE' : formatProviderLabel(k)}
                        </span>
                      </div>
                    </div>
                  );
                });
              })() : (() => {
                let metricKeys = ['balance', ...(activeProvider?.products.map(p => p.productName) || [])];

                if (!showSoldAssets) {
                   metricKeys = metricKeys.filter(k => {
                      if (k === 'balance') return true;
                      const prod = activeProvider?.products.find(p => p.productName === k);
                      if (prod && Math.abs(prod.quantity) <= 0.000001) return false;
                      return true;
                   });
                }

                const visibleCount = metricKeys.filter(k => !hiddenSeries[k]).length;

                return metricKeys.map((k, idx) => {
                  const isBalance = k === 'balance';
                  const color = isBalance ? '#ffffff' : GRAYSCALE_PALETTE[(idx-1) % GRAYSCALE_PALETTE.length];
                  const isLastVisible = !hiddenSeries[k] && visibleCount <= 1;

                  return (
                    <div key={k} style={{ color: hiddenSeries[k] ? '#4C4C4C' : color }}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (isLastVisible) return;
                          toggleSeries(k);
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { if (isLastVisible) return; toggleSeries(k); } }}
                        className={`flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider select-none outline-none whitespace-nowrap max-w-[150px] ${
                          isLastVisible ? 'cursor-not-allowed' : 'cursor-pointer'
                        }`}
                        style={{ WebkitTapHighlightColor: 'transparent', color: 'inherit' }}
                      >
                        <div className="h-[6px] w-[14px] rounded-full sm:h-[8px] sm:w-[16px] flex-shrink-0" style={{ backgroundColor: hiddenSeries[k] ? '#4C4C4C' : color }} />
                        <span className={cn("truncate", hiddenSeries[k] && "line-through")}>{isBalance ? 'BALANCE' : k}</span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </>
        )}
      </div>

      {/* Provider Details Section */}
      {cardsPortalNode && createPortal(
        <div className={cn("flex flex-col gap-5 w-full pb-6 lg:pb-0", !isActive && "absolute pointer-events-none opacity-0 invisible")}>
          {data.providers.map((provider, idx) => {
            const isNew = newProviderKeys.has(provider.sourceInstitution);
            return (
            <div key={provider.sourceInstitution} className={cn("grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4", isNew && "card-enter")} style={isNew ? { animationDelay: `${idx * 80}ms` } : undefined}>

                {/* Product Summary Column (Left) */}
                <div className="flex flex-col rounded-[20px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-canvas)] p-4 h-full">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--text-main)]">
                      {formatProviderLabel(provider.sourceInstitution)}
                    </span>
                    <span className="text-sm font-bold text-[color:var(--text-main)]">
                      {formatEuroCents(getProviderLiveTotal(provider))}
                    </span>
                  </div>

                  <div className="mt-4 space-y-4 max-h-[400px] overflow-y-auto hide-scrollbar pr-1">
                    {provider.products.filter(p => Math.abs(p.quantity) > 0.000001).map((product) => (
                      <div key={product.productName} className={isNew ? "card-enter" : undefined}>
                        <hr className="mb-3 border-[color:var(--line-strong)] opacity-50" />
                        <div className="mb-1.5 flex items-start justify-between min-w-0">
                          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-main)] break-words w-0 flex-1 pr-3">
                            {product.productName}
                          </span>
                          <span className="text-xs font-bold text-[color:var(--text-main)] flex-shrink-0 pt-[1px]">
                            {(() => {
                              const price = product.isin ? livePrices[product.isin] : null;
                              return price != null ? formatEuroCents(Math.round(price * 100)) : "-";
                            })()}
                          </span>
                        </div>

                        <div key={`product-vals-${product.productName}-${isNew ? "s" : dataVersion}`} className={cn("space-y-1.5 text-sm", !isNew && dataVersion > 0 && "value-flash")}>
                          <div className="flex justify-between">
                            <span className="pl-3 text-[color:var(--text-dim)] font-medium">{config.identifierLabel}</span>
                            <span className="font-semibold text-[color:var(--text-main)]">
                              {product.isin}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="pl-3 text-[color:var(--text-dim)] font-medium">Quantity</span>
                            <span className="font-semibold text-[color:var(--text-main)]">
                              {product.quantity.toLocaleString("it-IT", { maximumFractionDigits: 6 })}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="pl-3 text-[color:var(--text-dim)] font-medium">Invested Value</span>
                            <span className="font-semibold text-[color:var(--text-main)]">
                              {formatEuroCents(product.investedValue)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="pl-3 text-[color:var(--text-dim)] font-medium">Current Value</span>
                            {(() => {
                              const price = product.isin ? livePrices[product.isin] : null;
                              if (price == null) {
                                return (
                                  <span className="font-semibold text-[color:var(--text-dim)] underline decoration-dotted decoration-[color:var(--text-dim)]">
                                    {formatEuroCents(0)}
                                  </span>
                                );
                              }
                              const currentValueCents = Math.round(product.quantity * price * 100);
                              return (
                                <span className="font-semibold text-[color:var(--text-main)]">
                                  {formatEuroCents(currentValueCents)}
                                </span>
                              );
                            })()}
                          </div>
                          {config.showCashback && product.cashback !== 0 && (
                            <div className="flex justify-between">
                              <span className="pl-3 text-[color:var(--text-dim)] font-medium">Cashback</span>
                              <span className="font-semibold text-[color:var(--text-main)]">
                                {formatEuroCents(product.cashback)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Transactions Column (Right) */}
                <div className="flex flex-col min-h-[280px] lg:h-[400px] flex-1 overflow-hidden rounded-[20px] border-2 border-[color:var(--line-strong)] bg-[#1f1f1f]">
                  <div className="h-full overflow-auto rounded-[20px] hide-scrollbar">
                    <table className="min-w-full border-separate border-spacing-0 text-[11px] sm:text-sm">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-[#D9D9D9] sm:text-[11px] sm:tracking-[0.18em]">
                          <th className="sticky top-0 z-20 rounded-tl-[18px] border-b border-[color:var(--line-strong)] bg-[#1f1f1f] px-1.5 py-2 font-medium sm:px-4 sm:py-3">Date</th>
                          <th className="sticky top-0 z-20 border-b border-[color:var(--line-strong)] bg-[#1f1f1f] px-4 py-2 font-medium hidden md:table-cell sm:py-3 text-center">Type</th>
                          <th className="sticky top-0 z-20 border-b border-[color:var(--line-strong)] bg-[#1f1f1f] px-1.5 py-2 font-medium sm:px-4 sm:py-3 text-left w-full">Asset</th>
                          <th className="sticky top-0 z-20 rounded-tr-[18px] border-b border-[color:var(--line-strong)] bg-[#1f1f1f] px-1.5 py-2 text-right font-medium sm:px-4 sm:py-3">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {provider.transactions
                          .filter(config.transactionFilter)
                          .slice(0, 50)
                          .map((tx) => (
                          <tr key={tx.id} className={cn("border-b border-[color:rgba(255,255,255,0.08)] align-middle last:border-b-0 hover:bg-[color:rgba(255,255,255,0.03)] transition-colors duration-150", isNew && "card-enter")}>
                            <td className="px-1.5 py-2 text-[color:var(--text-main)] sm:px-4">
                              <div className="font-semibold whitespace-nowrap">{new Date(tx.bookingDate).toISOString().split('T')[0]}</div>
                            </td>
                            <td className="px-4 py-2 text-[color:var(--text-main)] hidden md:table-cell whitespace-nowrap text-center opacity-70">{tx.typeLabel}</td>
                            <td className="px-1.5 py-2 text-[color:var(--text-main)] sm:px-4 w-full max-w-0">
                              <div className="leading-5 truncate capitalize font-medium">
                                {tx.productName || tx.description}
                                {tx.isin && <span className="ml-1"> - {tx.isin}</span>}
                              </div>
                            </td>
                            <td className="px-1.5 py-2 text-right font-bold whitespace-nowrap sm:px-4 text-white">
                              {(tx.tradeType?.toUpperCase() === "SELL" || tx.typeLabel?.toUpperCase() === "SELL") ? "-" : "+"}{formatEuroCents(tx.amountCents)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

            </div>
            );
          })}
        </div>,
        cardsPortalNode
      )}
    </div>
  );
}
