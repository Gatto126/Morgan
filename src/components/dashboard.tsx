"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff, ChartPie, Landmark, Wallet, Coins, ChartGantt, ChartBar, X } from "lucide-react";
import { Line, LineChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { globalLivePricesCache, saveLivePricesToCache } from "@/lib/live-prices";
import { cn } from "@/lib/utils";

type AccountTab = "heritage" | "checking" | "investment" | "crypto";
type TimeRange = "ALL" | "1Y" | "6M" | "3M" | "1M" | "1W";

type MonthlyBucket = {
  month: string;
  checking: number;
  investment: number;
  crypto: number;
  heritage: number;
  providerChecking?: Record<string, number>;
  providerProducts?: Record<string, number>;
  providerCryptoTokens?: Record<string, number>;
  providerIncome?: Record<string, number>;
  providerExpenses?: Record<string, number>;
  providerInterest?: Record<string, number>;
  providerCashback?: Record<string, number>;
  providerTax?: Record<string, number>;
};

type CheckingSummary = {
  income: number;
  expenses: number;
  interest: number;
  cashback: number;
  tax: number;
  total: number;
};

type InvestmentProductSummary = {
  productName: string;
  quantity: number;
  investedValue: number;
  cashback: number;
  isin?: string;
};

type CryptoTokenSummary = {
  tokenName: string;
  quantity: number;
  investedValue: number;
  tokenSymbol?: string;
};

type ProviderSummary = {
  sourceInstitution: string;
  total: number;
  checking: CheckingSummary;
  investmentProducts: InvestmentProductSummary[];
  cryptoTokens: CryptoTokenSummary[];
};

type BinanceBalanceRow = {
  tokenSymbol: string;
  tokenName: string | null;
  freeAmount: number;
  lockedAmount: number;
  eurValue: number;
};

type DailyBucket = MonthlyBucket & {
  date: string;
};

type DashboardData = {
  accountTotals: Record<AccountTab, number>;
  monthlyData: MonthlyBucket[];
  dailyData: DailyBucket[];
  providerSummaries: ProviderSummary[];
};

const ACCOUNT_TABS: { key: AccountTab; label: string }[] = [
  { key: "heritage", label: "HERITAGE" },
  { key: "checking", label: "CHECKING" },
  { key: "investment", label: "INVESTMENT" },
  { key: "crypto", label: "CRYPTO" }
];

const TIME_RANGES: TimeRange[] = ["ALL", "1Y", "6M", "3M", "1M", "1W"];

const GRAYSCALE_PALETTE = ["#a3a3a3", "#737373", "#525252", "#d4d4d4", "#a8a29e", "#78716c", "#57534e"];

const euroFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2
});

function formatEuroCents(cents: number) {
  const { number, symbol } = formatEuroParts(cents);
  return `${number} ${symbol}`;
}

function formatEuroParts(cents: number): { number: string; symbol: string } {
  const parts = euroFormatter.formatToParts(cents / 100);
  const symbol = parts.find(p => p.type === "currency")?.value ?? "€";
  const number = parts.filter(p => p.type !== "currency" && p.type !== "literal").map(p => p.value).join("").trim();
  return { number, symbol };
}

function formatProviderLabel(source: string) {
  return source.replace(/_/g, " ").toUpperCase();
}

function getMonthLabel(month: string) {
  const [year, m] = month.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const shortYear = year.slice(2);
  return `${monthNames[Number.parseInt(m, 10) - 1]} ${shortYear}`;
}

function filterData(data: { monthly: MonthlyBucket[], daily: DailyBucket[] }, range: TimeRange): (MonthlyBucket & { date?: string })[] {
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
  return data.daily.filter(d => d.date >= cutoffKey);
}

type TooltipPayloadItem = {
  name: string;
  value: number;
  payload?: ChartPoint;
  dataKey?: string | number;
};

type ChartPoint = Record<string, string | number | null | undefined>;

type CustomTooltipProps = {
  active?: boolean;
  payload?: TooltipPayloadItem[];
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

  if (!active || !payload?.length) {
    return null;
  }

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
    <div
      style={{
        background: "rgba(35,35,35,0.96)",
        border: "1px solid rgba(154,154,154,0.4)",
        borderRadius: 12,
        padding: "8px 14px",
        fontSize: 13,
        color: "#f5f5f5"
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{formattedLabel}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {[...payload]
          .filter(p => p.name !== "referenceLineValue" && p.dataKey !== "referenceLineValue")
          .sort((a, b) => {
            const isMainA = ["heritage", "checking", "investment", "crypto", "value"].includes(a.name);
            const isMainB = ["heritage", "checking", "investment", "crypto", "value"].includes(b.name);
            if (isMainA && !isMainB) return -1;
            if (!isMainA && isMainB) return 1;
            return (b.value || 0) - (a.value || 0);
          })
          .map((p, index) => {
            let labelStr = "";
            if (p.name === "value") {
              labelStr = "TOTAL";
            } else if (["heritage", "checking", "investment", "crypto"].includes(p.name)) {
              labelStr = String(p.name).toUpperCase();
            } else {
              labelStr = formatProviderLabel(p.name);
            }
            return (
              <div key={index} className="flex justify-between gap-6 items-center">
                <span className="text-[10px] font-bold uppercase" style={{ color: "#ffffff" }}>
                  {labelStr}
                </span>
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

  const formattedValue = new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(val / 100);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const rectWidth = isMobile ? 64 : 72;
  const rectHeight = 24;

  const top = viewBox.y - rectHeight / 2;
  const left = isMobile
    ? Math.max(2, viewBox.x - rectWidth / 2) // Center it on the line or keep it inside
    : viewBox.x - rectWidth + 2;

  const overlayTarget = typeof document !== "undefined" ? document.getElementById("chart-reference-overlay") : null;
  if (!overlayTarget) return null;

  return createPortal(
    <div
      style={{
        position: 'absolute',
        top,
        left,
        width: rectWidth,
        height: rectHeight,
        backgroundColor: '#1a1a1a',
        border: '2px solid #444444',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 100,
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.4)'
      }}
    >
      <span style={{
        color: '#ffffff',
        fontSize: '10px',
        fontWeight: 'bold',
        whiteSpace: 'nowrap'
      }}>
        {isMobile ? formattedValue.replace(/\s/g, "").replace(",00", "") : formattedValue.replace(/\s/g, "")}
      </span>
    </div>,
    overlayTarget
  );
};

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
  showSettingsView = false,
  isClosingSettings = false,
  onCloseSettings,
  settingsElement,
  showUserSelectView = false,
  isClosingUserSelect = false,
  onCloseUserSelect,
  userSelectElement,
  onImportRefreshComplete,
  binanceRefreshKey = 0
}: DashboardProps) {
  const [binanceBalances, setBinanceBalances] = useState<BinanceBalanceRow[]>([]);
  const [isBinanceNew, setIsBinanceNew] = useState(false);
  const [isBinanceSyncing, setIsBinanceSyncing] = useState(false);
  const [filterSmallBinance, setFilterSmallBinance] = useState(false);
  const prevBinanceCountRef = useRef(0);
  const binanceListRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);
  const [loadingOverlayFadingOut, setLoadingOverlayFadingOut] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);
  const firstLoadCompletedRef = useRef(false);
  const [newProviderKeys, setNewProviderKeys] = useState<Set<string>>(new Set());
  const knownProviderKeysRef = useRef<Set<string>>(new Set());
  const pendingImportRefreshRef = useRef(false);
  const onImportRefreshCompleteRef = useRef(onImportRefreshComplete);
  const [activeTab, setActiveTab] = useState<AccountTab>("heritage");
  const [timeRange, setTimeRange] = useState<TimeRange>("ALL");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [selectedSeriesKey, setSelectedSeriesKey] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [livePrices, setLivePrices] = useState<Record<string, number | null>>(globalLivePricesCache);
  const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>({});
  const [prevActiveTab, setPrevActiveTab] = useState<AccountTab>(activeTab);
  const [showSoldAssets, setShowSoldAssets] = useState(false);
  const [activeChartPoint, setActiveChartPoint] = useState<ChartPoint | null>(null);
  const requiresInitialUpload = transactionCount === 0;
  const shouldShowUploadPanel = (showUploadView || requiresInitialUpload) && !showSettingsView && !showUserSelectView;

  useEffect(() => {
    onImportRefreshCompleteRef.current = onImportRefreshComplete;
  }, [onImportRefreshComplete]);

  const visibleTabs = useMemo(() => {
    return ACCOUNT_TABS.filter((tab) => {
      if (tab.key === "heritage") return transactionCount > 0;
      if (tab.key === "checking") return checkingCount > 0;
      if (tab.key === "investment") return investmentCount > 0;
      if (tab.key === "crypto") return cryptoCount > 0;
      return true;
    });
  }, [checkingCount, investmentCount, cryptoCount, transactionCount]);

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

  useEffect(() => {
    if (!loading && !firstLoadCompletedRef.current) {
      firstLoadCompletedRef.current = true;
      setLoadingOverlayFadingOut(true);
      setContentVisible(true);
      const t = setTimeout(() => {
        setShowLoadingOverlay(false);
        setLoadingOverlayFadingOut(false);
      }, 550);
      return () => clearTimeout(t);
    }
  }, [loading]);

  const yAxisWidth = isMobile ? 0 : 50;
  const baseMargin = isMobile ? 0 : 24;
  const marginLeft = baseMargin;
  const marginRight = baseMargin;

  const portalNode = typeof document === "undefined" ? null : document.getElementById("dashboard-tabs-portal");
  const cardsPortalNode = typeof document === "undefined" ? null : document.getElementById("dashboard-cards-portal");

  const fetchDashboard = useCallback(
    async () => {
      try {
        const response = await fetch(`/api/transactions/dashboard?userId=${userId}`, {
          cache: "no-store"
        });
        const payload = (await response.json()) as DashboardData & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Errore nel caricamento della dashboard.");
        }

        if (pendingImportRefreshRef.current) {
          const currentKeys = new Set<string>();
          (payload.providerSummaries as Array<{ sourceInstitution: string; checking: { total: number }; investmentProducts: Array<{ quantity: number }>; cryptoTokens: Array<{ quantity: number }> }>).forEach(p => {
            if (p.checking.total !== 0) currentKeys.add(`checking-${p.sourceInstitution}`);
            if (p.investmentProducts.filter(x => Math.abs(x.quantity) > 0.000001).length > 0) currentKeys.add(`investment-${p.sourceInstitution}`);
            if (p.cryptoTokens.filter(x => Math.abs(x.quantity) > 0.000001).length > 0) currentKeys.add(`crypto-${p.sourceInstitution}`);
          });
          const newKeys = new Set([...currentKeys].filter(k => !knownProviderKeysRef.current.has(k)));
          if (newKeys.size > 0) {
            setNewProviderKeys(newKeys);
            setTimeout(() => setNewProviderKeys(new Set()), 1000);
          }
          knownProviderKeysRef.current = currentKeys;
        } else {
          const currentKeys = new Set<string>();
          (payload.providerSummaries as Array<{ sourceInstitution: string; checking: { total: number }; investmentProducts: Array<{ quantity: number }>; cryptoTokens: Array<{ quantity: number }> }>).forEach(p => {
            if (p.checking.total !== 0) currentKeys.add(`checking-${p.sourceInstitution}`);
            if (p.investmentProducts.filter(x => Math.abs(x.quantity) > 0.000001).length > 0) currentKeys.add(`investment-${p.sourceInstitution}`);
            if (p.cryptoTokens.filter(x => Math.abs(x.quantity) > 0.000001).length > 0) currentKeys.add(`crypto-${p.sourceInstitution}`);
          });
          knownProviderKeysRef.current = currentKeys;
        }

        setData(payload);
        setError(null);
      } catch (fetchError: unknown) {
        setError(fetchError instanceof Error ? fetchError.message : "Errore nel caricamento.");
        setData(null);
      } finally {
        setLoading(false);
        if (pendingImportRefreshRef.current) {
          pendingImportRefreshRef.current = false;
          requestAnimationFrame(() => requestAnimationFrame(() => {
            onImportRefreshCompleteRef.current?.();
          }));
        }
      }
    },
    [userId]
  );

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const initialLoad = window.setTimeout(() => {
      void fetchDashboard();
    }, 0);

    const interval = window.setInterval(() => {
      void fetchDashboard();
    }, 60_000);

    function handleFocus() {
      void fetchDashboard();
    }

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchDashboard, isActive]);

  useEffect(() => {
    if (!isActive || loading) {
      return;
    }

    pendingImportRefreshRef.current = true;
    void fetchDashboard();
  }, [transactionCount, fetchDashboard, isActive, loading]);

  const fetchLivePrices = useCallback(async (summaries: ProviderSummary[]) => {
    const allIsins = new Set<string>();
    const allCryptos = new Set<string>();
    for (const prov of summaries) {
      for (const prod of prov.investmentProducts) {
        if (prod.isin && Math.abs(prod.quantity) > 0.000001) allIsins.add(prod.isin);
      }
      for (const token of prov.cryptoTokens) {
        if (token.tokenSymbol && Math.abs(token.quantity) > 0.000001) allCryptos.add(token.tokenSymbol);
      }
    }
    if (allIsins.size === 0 && allCryptos.size === 0) return;
    try {
      const params = new URLSearchParams();
      if (allIsins.size > 0) params.set("isins", [...allIsins].join(","));
      if (allCryptos.size > 0) params.set("cryptos", [...allCryptos].join(","));

      const res = await fetch(`/api/prices?${params.toString()}`);
      if (res.ok) {
        const prices = await res.json();
        saveLivePricesToCache(prices);
        setLivePrices(prev => ({ ...prev, ...prices }));
      }
    } catch { /* silently fail */ }
  }, []);

  // Fetch live prices whenever data changes, refresh them every 60 seconds and on window focus
  useEffect(() => {
    if (!isActive || !data?.providerSummaries) return;
    const initialLoad = window.setTimeout(() => {
      void fetchLivePrices(data.providerSummaries);
    }, 0);
    const interval = window.setInterval(() => {
      void fetchLivePrices(data.providerSummaries);
    }, 60_000);
    const handleFocus = () => {
      void fetchLivePrices(data.providerSummaries!);
    };
    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [data?.providerSummaries, fetchLivePrices, isActive]);

  const loadBinanceBalances = useCallback(async () => {
    const res = await fetch(`/api/binance/balances?userId=${userId}`);
    if (!res.ok) return null;

    const d = await res.json();
    if (Array.isArray(d.balances)) {
      const wasEmpty = prevBinanceCountRef.current === 0;
      prevBinanceCountRef.current = d.balances.length;
      setBinanceBalances(d.balances);
      if (wasEmpty && d.balances.length > 0) {
        setIsBinanceNew(true);
        setTimeout(() => setIsBinanceNew(false), 600);
      }
    }

    return d as { isStale?: boolean; hasApiKey?: boolean };
  }, [userId]);

  const fetchBinanceBalances = useCallback(async (syncIfStale = true) => {
    try {
      const d = await loadBinanceBalances();
      if (!d) return;
      if (syncIfStale && d.isStale && d.hasApiKey) {
        setIsBinanceSyncing(true);
        try {
          await fetch("/api/binance/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
          });
          await loadBinanceBalances();
        } catch {
          // sync failed silently, keep showing cached data
        } finally {
          setIsBinanceSyncing(false);
        }
      }
    } catch {
      // network error, keep current state
    }
  }, [loadBinanceBalances, userId]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const initialLoad = window.setTimeout(() => {
      void fetchBinanceBalances(true);
    }, 0);
    const interval = window.setInterval(() => void fetchBinanceBalances(true), 600_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [fetchBinanceBalances, binanceRefreshKey, isActive]);

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

      const binanceCents = Math.round(binanceBalances.reduce((s, b) => s + b.eurValue, 0) * 100);

      const checkingVal = resolveValue("checking", bucket.checking);
      const investmentVal = resolveValue("investment", bucket.investment);
      const cryptoVal = resolveValue("crypto", bucket.crypto);
      // Add live Binance to crypto only after the first crypto transaction exists (honest about history)
      const cryptoWithBinance = cryptoVal !== null ? cryptoVal + binanceCents : null;

      // Main line: add Binance to heritage/crypto tabs so the white line reflects the full portfolio
      const rawValue = resolveValue("value", val);
      const valueWithBinance =
        rawValue !== null && (activeTab === "heritage" || activeTab === "crypto")
          ? rawValue + binanceCents
          : rawValue;

      const baseEntry: Record<string, number | string | null> = {
        month: rawMonth,
        rawMonth,
        value: valueWithBinance
      };

      baseEntry.checking = checkingVal;
      baseEntry.investment = investmentVal;
      baseEntry.crypto = cryptoWithBinance; // used as CRYPTO sub-line in heritage tab

      if (checkingVal === null && investmentVal === null && cryptoWithBinance === null) {
        baseEntry.heritage = null;
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

      // Institution aggregate crypto — sum all tokens per bucket as one line per institution.
      // Since providerCryptoTokens are not split by institution in historical data,
      // we attribute the total to each institution proportionally (for single-institution
      // users this equals 100%; multi-institution is additive — improve with API later).
      cryptoInstitutions.forEach((inst) => {
        const instKey = `crypto_inst_${inst}`;
        const rawSum = cryptoTokens.reduce((s, token) => {
          const v = bucket.providerCryptoTokens?.[token];
          return s + (v != null && Math.abs(v) > 0.000001 ? Math.abs(v) : 0);
        }, 0);
        baseEntry[instKey] = resolveValue(instKey, rawSum > 0 ? rawSum : undefined);
      });

      // Binance sub-line key for the crypto tab (constant live value, no historical data)
      baseEntry["binance"] = binanceCents > 0 ? binanceCents : null;

      return baseEntry;
    });
  }, [data, activeTab, timeRange, checkingProviders, investmentProducts, cryptoTokens, cryptoInstitutions, binanceBalances]);

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

  if (!loading && error) {
    return (
      <div className={cn("flex h-full items-center justify-center", !isActive && "absolute inset-0 pointer-events-none opacity-0 invisible")}>
        <p className="text-sm text-[color:var(--danger)]">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={cn("flex h-full flex-col gap-4 overflow-hidden relative w-full", !isActive && "absolute inset-0 pointer-events-none opacity-0 invisible")}>
        {showLoadingOverlay && (
          <div
            className="absolute inset-0 z-[60] flex items-center justify-center"
            style={{
              background: "var(--surface-canvas)",
              opacity: loadingOverlayFadingOut ? 0 : 1,
              transition: loadingOverlayFadingOut ? "opacity 550ms cubic-bezier(0.4,0,0.2,1)" : "none",
              pointerEvents: loadingOverlayFadingOut ? "none" : "all"
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                border: "2.5px solid rgba(255,255,255,0.07)",
                borderTopColor: "rgba(255,255,255,0.5)",
                animation: "dashboardSpinner 0.85s linear infinite"
              }}
            />
          </div>
        )}
      </div>
    );
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
    <div className={cn("flex h-full flex-col gap-4 overflow-hidden relative w-full", !isActive && "absolute inset-0 pointer-events-none opacity-0 invisible")}>
      {showLoadingOverlay && (
        <div
          className="absolute inset-0 z-[60] flex items-center justify-center"
          style={{
            background: "var(--surface-canvas)",
            opacity: loadingOverlayFadingOut ? 0 : 1,
            transition: loadingOverlayFadingOut ? "opacity 550ms cubic-bezier(0.4,0,0.2,1)" : "none",
            pointerEvents: loadingOverlayFadingOut ? "none" : "all"
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "2.5px solid rgba(255,255,255,0.07)",
              borderTopColor: "rgba(255,255,255,0.5)",
              animation: "dashboardSpinner 0.85s linear infinite"
            }}
          />
        </div>
      )}
      {/* Account type tabs (Rendered inside header portal) */}
      {portalNode &&
        createPortal(
          <div
            className={cn("flex items-center gap-2 sm:gap-3", !isActive && "absolute pointer-events-none opacity-0 invisible")}
            style={{
              opacity: contentVisible ? 1 : 0,
              transform: contentVisible ? "none" : "translateY(6px)",
              transition: contentVisible ? "opacity 0.45s ease-out, transform 0.45s ease-out" : "none"
            }}
          >
            {visibleTabs.map((tab) => {
              const isActive = activeTab === tab.key;
              const Icon = {
                heritage: ChartPie,
                checking: Landmark,
                investment: Wallet,
                crypto: Coins
              }[tab.key];

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
                    <Icon className="h-4 w-4 flex-shrink-0" strokeWidth={2.2} />
                  </div>
                  <span className={`text-right tabular-nums whitespace-nowrap ${isActive ? "" : "opacity-70"}`}>
                    {formatEuroCents(
                      activePoint
                        ? (() => {
                            // activePoint["binance"] is the constant live Binance balance injected into every chart bucket
                            const binancePt = (activePoint["binance"] as number) || 0;
                            if (tab.key === "crypto") return ((activePoint["crypto"] as number) || 0) + binancePt;
                            if (tab.key === "heritage") return ((activePoint["heritage"] as number) || 0) + binancePt;
                            return (activePoint[tab.key] as number) || 0;
                          })()
                        : (tab.key === "investment"
                            ? getGlobalInvestmentLiveTotal()
                            : tab.key === "crypto"
                              ? getGlobalCryptoLiveTotal()
                              : tab.key === "heritage"
                                ? data.accountTotals.checking + getGlobalInvestmentLiveTotal() + getGlobalCryptoLiveTotal()
                                : data.accountTotals[tab.key])
                    )}
                  </span>
                </button>
              );
            })}
          </div>,
          portalNode
        )}

      {/* Chart area */}
      <div className="flex-1 min-h-[240px] sm:min-h-[400px] md:min-h-[440px] lg:min-h-[520px] relative w-full flex flex-col justify-center">
        {showSettingsView ? (
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
        ) : shouldShowUploadPanel ? (
          <div className={cn("relative w-full h-full flex flex-col justify-center", isClosingUpload ? "upload-panel-exit" : "upload-panel-enter")}>
            {!requiresInitialUpload ? (
              <div
                role="button"
                onClick={onCloseUpload}
                className="absolute right-0 top-0 z-50 flex h-8 w-8 cursor-pointer items-center justify-center text-[color:var(--text-dim)] transition-colors hover:text-white"
                title="Esci dall'importazione"
              >
                <X className="h-5 w-5" strokeWidth={2.3} />
              </div>
            ) : null}
            {previewTransactionsCount > 0 ? reviewElement : uploadElement}
          </div>
        ) : (
          <>
            {/* Time range filters */}
            <div className="absolute top-0 right-0 z-10 flex items-center justify-end gap-0.5">
              {activeTab === "investment" && (
                <button
                  aria-label="Toggle sold assets"
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[color:var(--text-dim)] transition-colors hover:bg-[rgba(255,255,255,0.08)] hover:text-white"
                  onClick={(e) => { e.stopPropagation(); setShowSoldAssets(!showSoldAssets); }}
                  title={showSoldAssets ? "Nascondi asset venduti" : "Mostra asset venduti"}
                  type="button"
                >
                  {showSoldAssets ? <ChartGantt className="h-4 w-4" strokeWidth={2.2} /> : <ChartBar className="h-4 w-4" strokeWidth={2.2} />}
                </button>
              )}

              {TIME_RANGES.map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setTimeRange(range)}
                  className="cursor-pointer rounded-md px-1.5 py-0 text-[8.5px] sm:text-[10px] font-bold uppercase tracking-wider transition-colors duration-150"
                  style={{
                    background: timeRange === range ? "rgba(255,255,255,0.08)" : "transparent",
                    color: timeRange === range ? "#f5f5f5" : "#737373"
                  }}
                >
                  {range}
                </button>
              ))}
            </div>

            {/* Bar chart */}
            <div className="flex-1 min-h-0 w-full pt-10 focus:outline-none outline-none">
              <div className="relative w-full h-full" onClick={() => { setSelectedMonth(null); setSelectedSeriesKey(null); }}>
                <div id="chart-reference-overlay" className="absolute inset-0 pointer-events-none z-10" />
                <style dangerouslySetInnerHTML={{ __html: `
                  .recharts-wrapper, .recharts-wrapper *, .recharts-surface, .recharts-surface *, .recharts-container, .recharts-container * {
                    outline: none !important;
                    box-shadow: none !important;
                  }
                `}} />
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={processedChartData}
                    margin={{
                      top: 8,
                      right: marginRight,
                      bottom: 0,
                      left: marginLeft
                    }}
                    style={{ outline: "none", overflow: "visible" }}
                    accessibilityLayer={false}
                  >
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
                    <YAxis
                      tick={{ fill: "#a8a8a8", fontSize: isMobile ? 9 : 10, dx: isMobile ? 4 : 0 }}
                      axisLine={false}
                      tickLine={false}
                      mirror={isMobile}
                      tickFormatter={(value: number) => {
                        if (isMobile && value >= 100000) {
                          return `${Math.round(value / 100000)}k €`;
                        }
                        return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value / 100);
                      }}
                      width={yAxisWidth}
                    />
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(154,154,154,0.12)" vertical={false} />
                    <Tooltip
                      content={<ChartTooltip setActivePoint={setActiveChartPoint} />}
                      cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1, fill: "transparent" }}
                    />
                                     {chartConfig.subLines.map((sub) => {
                      if (hiddenSeries[sub.key]) return null;
                      return (
                        <Line
                          key={sub.key}
                          type="linear"
                          dataKey={sub.key}
                          name={sub.key}
                          stroke={sub.stroke}
                          strokeWidth={2}
                          isAnimationActive={false}
                          connectNulls={false}
                          activeDot={(props: { cx?: number; cy?: number; payload?: Record<string, string | number | null> }) => {
                            const { cx, cy, payload } = props;
                            if (cx === undefined || cy === undefined || !payload || payload[sub.key] == null) return null;
                            return (
                              <circle
                                cx={cx}
                                cy={cy}
                                r={5}
                                fill="#1a1a1a"
                                stroke={sub.stroke}
                                strokeWidth={2}
                                style={{ cursor: "pointer", outline: "none" }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedMonth(payload.rawMonth as string);
                                  setSelectedSeriesKey(sub.key);
                                }}
                              />
                            );
                          }}
                          dot={false}
                        />
                      );
                    })}

                    {/* Main line series - rendered last to guarantee it stays on top */}
                    {!hiddenSeries[activeTab] && (
                      <Line
                        key={`${activeTab}-${Object.keys(hiddenSeries).sort().map(k => hiddenSeries[k] ? '0' : '1').join('')}`}
                        type="linear"
                        dataKey="value"
                        name={activeTab}
                        stroke="#ffffff"
                        strokeWidth={2.5}
                        isAnimationActive={false}
                        connectNulls={false}
                        activeDot={(props: { cx?: number; cy?: number; payload?: Record<string, string | number | null> }) => {
                          const { cx, cy, payload } = props;
                          if (cx === undefined || cy === undefined || !payload || payload.value == null) return null;
                          return (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={6}
                              fill="#1a1a1a"
                              stroke="#ffffff"
                              strokeWidth={2}
                              style={{ cursor: "pointer", outline: "none" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMonth(payload.rawMonth as string);
                                setSelectedSeriesKey("value");
                              }}
                            />
                          );
                        }}
                        dot={false}
                      />
                    )}

                     {/* Reference line drawn as a Line component to guarantee it stays on top of all other data lines */}
                    {selectedValue !== null && (
                      <Line
                        key={`ref-line-path-${selectedValue}-${Object.keys(hiddenSeries).sort().map(k => hiddenSeries[k] ? '0' : '1').join('')}`}
                        type="linear"
                        dataKey="referenceLineValue"
                        stroke="rgba(254, 254, 254, 0.5)"
                        strokeWidth={1.5}
                        strokeDasharray="6 4"
                        dot={false}
                        activeDot={false}
                        isAnimationActive={false}
                      />
                    )}

                    {/* ReferenceLine used exclusively to position the custom reference label portal */}
                    {selectedValue !== null && (
                      <ReferenceLine
                        key={`ref-line-label-${selectedValue}-${Object.keys(hiddenSeries).sort().map(k => hiddenSeries[k] ? '0' : '1').join('')}`}
                        y={selectedValue}
                        stroke="transparent"
                        label={<CustomReferenceLabel selectedValue={selectedValue} />}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {(() => {
              const allSeriesKeys = [activeTab, ...chartConfig.subLines.map((s) => s.key)];
              const visibleCount = allSeriesKeys.filter((k) => !hiddenSeries[k]).length;

              return (
                <div
                  className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap w-full pt-2 pb-0"
                  style={{ visibility: transactionCount > 0 ? "visible" : "hidden" }}
                >
                  {allSeriesKeys.map((k) => {
                    const isMain = k === activeTab;
                    const subLine = chartConfig.subLines.find((s) => s.key === k);
                    const color = isMain ? "#ffffff" : subLine?.stroke || "#cccccc";
                    const label = isMain ? chartConfig.mainLabel : subLine?.label || k;
                    const isLastVisible = !hiddenSeries[k] && visibleCount <= 1;

                    return (
                      <div key={k} style={{ color: hiddenSeries[k] ? "#4C4C4C" : color }}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            if (isLastVisible) return;
                            toggleSeries(k);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              if (isLastVisible) return;
                              toggleSeries(k);
                            }
                          }}
                          className={`flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider select-none outline-none whitespace-nowrap ${
                            isLastVisible ? "cursor-not-allowed" : "cursor-pointer"
                          }`}
                          style={{ WebkitTapHighlightColor: "transparent", color: "inherit" }}
                        >
                          <div
                            className="h-[6px] w-[14px] rounded-full sm:h-[8px] sm:w-[16px] flex-shrink-0"
                            style={{ backgroundColor: hiddenSeries[k] ? "#4C4C4C" : color }}
                          />
                          <span className={cn(hiddenSeries[k] && "line-through")}>{label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* Summary Cards by Account Type */}
      {cardsPortalNode &&
        createPortal(
          <div
            className={cn("grid gap-4 w-full pb-6 lg:pb-0", !isActive && "absolute pointer-events-none opacity-0 invisible")}
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              alignItems: "start",
              opacity: contentVisible ? 1 : 0,
              transform: contentVisible ? "none" : "translateY(10px)",
              transition: contentVisible ? "opacity 0.5s ease-out 0.06s, transform 0.5s ease-out 0.06s" : "none"
            }}
          >

            {/* CHECKING CARD */}
        {data.providerSummaries.some(p => p.checking.total !== 0) && (
          <div className="flex flex-col gap-3">
            {data.providerSummaries.filter(p => p.checking.total !== 0).map((provider) => {
              const filteredTimeData = filterData({ monthly: data.monthlyData, daily: data.dailyData }, timeRange);
              const providerAverage = filteredTimeData.length > 0
                ? Math.round(filteredTimeData.reduce((sum, d) => sum + (d.providerChecking?.[provider.sourceInstitution] || 0), 0) / filteredTimeData.length)
                : 0;
              const providerIncomePeriod = filteredTimeData.reduce((sum, d) => sum + (d.providerIncome?.[provider.sourceInstitution] || 0), 0);
              const providerExpensesPeriod = filteredTimeData.reduce((sum, d) => sum + (d.providerExpenses?.[provider.sourceInstitution] || 0), 0);

              const providerInterestPeriod = timeRange === "ALL"
                ? provider.checking.interest
                : filteredTimeData.reduce((sum, d) => sum + (d.providerInterest?.[provider.sourceInstitution] || 0), 0);
              const providerCashbackPeriod = timeRange === "ALL"
                ? provider.checking.cashback
                : filteredTimeData.reduce((sum, d) => sum + (d.providerCashback?.[provider.sourceInstitution] || 0), 0);
              const providerTaxPeriod = timeRange === "ALL"
                ? provider.checking.tax
                : filteredTimeData.reduce((sum, d) => sum + (d.providerTax?.[provider.sourceInstitution] || 0), 0);

              const isNew = newProviderKeys.has(`checking-${provider.sourceInstitution}`);
              return (
                <div key={`checking-${provider.sourceInstitution}`} className={cn("flex flex-col gap-4 rounded-[20px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-canvas)] p-4", isNew && "card-enter")}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--text-main)]">
                      {formatProviderLabel(provider.sourceInstitution)}
                    </span>
                    <span className="text-sm font-bold text-[color:var(--text-main)]">
                      {formatEuroCents(provider.checking.total)}
                    </span>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <hr className="mb-3 border-[color:var(--line-strong)] opacity-50" />
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="pl-3 text-[color:var(--text-dim)] font-medium">Income</span>
                          <span className="font-semibold text-[color:var(--text-main)]">
                            {formatEuroCents(providerIncomePeriod)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="pl-3 text-[color:var(--text-dim)] font-medium">Spending</span>
                          <span className="font-semibold text-[color:var(--text-main)]">
                            {formatEuroCents(providerExpensesPeriod)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="pl-3 text-[color:var(--text-dim)] font-medium">Average</span>
                          <span className="font-semibold text-[color:var(--text-main)]">
                            {formatEuroCents(providerAverage)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="pl-3 text-[color:var(--text-dim)] font-medium">Interest</span>
                          <span className="font-semibold text-[color:var(--text-main)]">
                            {formatEuroCents(providerInterestPeriod)}
                          </span>
                        </div>
                        {providerCashbackPeriod !== 0 && (
                          <div className="flex justify-between">
                            <span className="pl-3 text-[color:var(--text-dim)] font-medium">Cashback</span>
                            <span className="font-semibold text-[color:var(--text-main)]">
                              {formatEuroCents(providerCashbackPeriod)}
                            </span>
                          </div>
                        )}
                        {provider.sourceInstitution === "trade_republic" && (
                          <div className="flex justify-between">
                            <span className="pl-3 text-[color:var(--text-dim)] font-medium">Tax</span>
                            <span className="font-semibold text-[color:var(--text-main)]">
                              {formatEuroCents(providerTaxPeriod)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* INVESTMENT CARD */}
        {data.providerSummaries.some(p => p.investmentProducts.filter(x => Math.abs(x.quantity) > 0.000001).length > 0) && (
          <div className="flex flex-col gap-3">
            {data.providerSummaries
              .map(p => ({ ...p, investmentProducts: p.investmentProducts.filter(x => Math.abs(x.quantity) > 0.000001) }))
              .filter(p => p.investmentProducts.length > 0)
              .map((provider) => (
              <div key={`investment-${provider.sourceInstitution}`} className={cn("flex flex-col gap-4 rounded-[20px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-canvas)] p-4", newProviderKeys.has(`investment-${provider.sourceInstitution}`) && "card-enter")}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--text-main)]">
                    {formatProviderLabel(provider.sourceInstitution)}
                  </span>
                  <span className="text-sm font-bold text-[color:var(--text-main)]">
                    {formatEuroCents(getProviderInvestmentLiveTotal(provider))}
                  </span>
                </div>
                <div className="space-y-4">
                  {provider.investmentProducts.map((product) => {
                    const isInvNew = newProviderKeys.has(`investment-${provider.sourceInstitution}`);
                    return (
                    <div key={product.productName} className={isInvNew ? "card-enter" : undefined}>
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

                      <div className="space-y-1.5 text-sm">
                        {product.isin && (
                          <div className="flex justify-between">
                            <span className="pl-3 text-[color:var(--text-dim)] font-medium">ISIN</span>
                            <span className="font-semibold text-[color:var(--text-main)]">
                              {product.isin}
                            </span>
                          </div>
                        )}
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
                        {product.cashback !== 0 && (
                          <div className="flex justify-between">
                            <span className="pl-3 text-[color:var(--text-dim)] font-medium">Cashback</span>
                            <span className="font-semibold text-[color:var(--text-main)]">
                              {formatEuroCents(product.cashback)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CRYPTO + BINANCE CARD — share the same flex column so Binance sits directly below crypto */}
        {(data.providerSummaries.some(p => p.cryptoTokens.filter(x => Math.abs(x.quantity) > 0.000001).length > 0) || binanceBalances.length > 0) && (
          <div className="flex flex-col gap-3">
            {data.providerSummaries
              .map(p => ({ ...p, cryptoTokens: p.cryptoTokens.filter(x => Math.abs(x.quantity) > 0.000001) }))
              .filter(p => p.cryptoTokens.length > 0)
              .map((provider) => (
              <div key={`crypto-${provider.sourceInstitution}`} className={cn("flex flex-col gap-4 rounded-[20px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-canvas)] p-4", newProviderKeys.has(`crypto-${provider.sourceInstitution}`) && "card-enter")}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--text-main)]">
                      {formatProviderLabel(provider.sourceInstitution)}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-[color:var(--text-main)]">
                    {formatEuroCents(getProviderCryptoLiveTotal(provider))}
                  </span>
                </div>
                <div className="space-y-4">
                  {provider.cryptoTokens.map((token) => {
                    const isCryptoNew = newProviderKeys.has(`crypto-${provider.sourceInstitution}`);
                    return (
                    <div key={token.tokenName} className={isCryptoNew ? "card-enter" : undefined}>
                      <hr className="mb-3 border-[color:var(--line-strong)] opacity-50" />
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-main)]">
                          {token.tokenName}
                        </span>
                        <span className="text-xs font-bold text-[color:var(--text-main)] pl-2">
                          {(() => {
                            const price = token.tokenSymbol ? livePrices[token.tokenSymbol] : null;
                            return price != null ? formatEuroCents(Math.round(price * 100)) : "-";
                          })()}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <span className="pl-3 text-[color:var(--text-dim)] font-medium">Quantity</span>
                          <span className="font-semibold text-[color:var(--text-main)]">
                            {token.quantity.toLocaleString("it-IT", { maximumFractionDigits: 8 })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="pl-3 text-[color:var(--text-dim)] font-medium">Invested Value</span>
                          <span className="font-semibold text-[color:var(--text-main)]">
                            {formatEuroCents(token.investedValue)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="pl-3 text-[color:var(--text-dim)] font-medium">Current Value</span>
                          {(() => {
                            const price = token.tokenSymbol ? livePrices[token.tokenSymbol] : null;
                            if (price == null) {
                              return (
                                <span className="font-semibold text-[color:var(--text-dim)] underline decoration-dotted decoration-[color:var(--text-dim)]">
                                  {formatEuroCents(0)}
                                </span>
                              );
                            }
                            const currentValueCents = Math.round(token.quantity * price * 100);
                            return (
                              <span className="font-semibold text-[color:var(--text-main)]">
                                {formatEuroCents(currentValueCents)}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* BINANCE CARD — inside crypto column, no grid gap */}
            {binanceBalances.length > 0 && (() => {
              const visibleBinanceBalances = filterSmallBinance
                ? binanceBalances.filter(b => b.eurValue >= 0.95)
                : binanceBalances;
              return (
              <div className={cn("flex flex-col gap-4 rounded-[20px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-canvas)] p-4", isBinanceNew && "card-enter")}>
                <div className="flex items-center justify-between select-none">
                  {/* Left zone — click scrolls list to top */}
                  <div
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => binanceListRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
                  >
                    <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--text-main)]">
                      BINANCE
                    </span>
                    {isBinanceSyncing && (
                      <span className="text-[9px] font-medium text-[color:var(--text-dim)] animate-pulse uppercase tracking-wider">
                        syncing
                      </span>
                    )}
                  </div>
                  {/* Right zone — fully independent from scroll area */}
                  <div className="flex items-center gap-2">
                    <div
                      role="button"
                      tabIndex={0}
                      title={filterSmallBinance ? "Mostra tutti i token" : "Nascondi token sotto 0,95 €"}
                      onClick={() => setFilterSmallBinance(f => !f)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setFilterSmallBinance(f => !f); }}
                      className="cursor-pointer text-[color:var(--text-dim)] transition-colors hover:text-white"
                      style={{ WebkitTapHighlightColor: "transparent" }}
                    >
                      {filterSmallBinance
                        ? <EyeOff className="h-3.5 w-3.5" strokeWidth={2.2} />
                        : <Eye className="h-3.5 w-3.5" strokeWidth={2.2} />}
                    </div>
                    <span className="text-sm font-bold text-[color:var(--text-main)]">
                      {euroFormatter.format(binanceBalances.reduce((s, b) => s + b.eurValue, 0))}
                    </span>
                  </div>
                </div>
                <div ref={binanceListRef} className="max-h-[300px] overflow-y-auto hide-scrollbar space-y-4">
                  {visibleBinanceBalances.map((token) => {
                    const total = token.freeAmount + token.lockedAmount;
                    const isPartialLock = token.lockedAmount > 0 && token.freeAmount > 0;
                    return (
                      <div key={token.tokenSymbol}>
                        <hr className="mb-3 border-[color:var(--line-strong)] opacity-50" />
                        <div className="mb-1.5 flex items-start justify-between min-w-0">
                          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-main)] break-words w-0 flex-1 pr-3">
                            {token.tokenName ? `${token.tokenName} (${token.tokenSymbol})` : token.tokenSymbol}
                          </span>
                          <span className="text-xs font-bold text-[color:var(--text-main)] flex-shrink-0 pt-[1px]">
                            {euroFormatter.format(token.eurValue)}
                          </span>
                        </div>
                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between">
                            <span className="pl-3 text-[color:var(--text-dim)] font-medium">Quantity</span>
                            <span className="font-semibold text-[color:var(--text-main)]">
                              {total.toLocaleString("it-IT", { maximumFractionDigits: 8 })}
                            </span>
                          </div>
                          {isPartialLock && (
                            <div className="flex justify-between">
                              <span className="pl-3 text-[color:var(--text-dim)] font-medium">Locked</span>
                              <span className="font-semibold text-[color:var(--text-main)]">
                                {token.lockedAmount.toLocaleString("it-IT", { maximumFractionDigits: 8 })}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="pl-3 text-[color:var(--text-dim)] font-medium">Current Value</span>
                            <span className="font-semibold text-[color:var(--text-main)]">
                              {euroFormatter.format(token.eurValue)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })()}
          </div>
        )}

          </div>,
          cardsPortalNode
        )}
    </div>
  );
}
