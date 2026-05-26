"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Landmark, X } from "lucide-react";
import { Line, LineChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";

type TimeRange = "ALL" | "1Y" | "6M" | "3M" | "1M" | "1W";

type MonthBucket = {
  month: string;
  total: number;
  providers: Record<string, number>;
  providerIncome: Record<string, number>;
  providerExpenses: Record<string, number>;
};

type CheckingTransaction = {
  id: string;
  bookingDate: string;
  typeLabel: string;
  description: string;
  direction: "IN" | "OUT";
  amountCents: number;
};

type CheckingProviderSummary = {
  sourceInstitution: string;
  total: number;
  income: number;
  expenses: number;
  interest: number;
  cashback: number;
  tax: number;
  transactions: CheckingTransaction[];
};

type CheckingData = {
  monthlyData: MonthBucket[];
  dailyData: any[];
  providers: CheckingProviderSummary[];
};

const GRAYSCALE_PALETTE = ["#8f8f8f", "#404040", "#737373", "#525252", "#262626"];

const TIME_RANGES: TimeRange[] = ["ALL", "1Y", "6M", "3M", "1M", "1W"];

const euroFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2
});

function formatEuroCents(cents: number) {
  return euroFormatter.format(cents / 100);
}

function formatEuroParts(cents: number): { number: string; symbol: string } {
  const parts = euroFormatter.formatToParts(cents / 100);
  const symbol = parts.find(p => p.type === "currency")?.value ?? "€";
  const number = parts.filter(p => p.type !== "currency" && p.type !== "literal").map(p => p.value).join("").trim();
  return { number, symbol };
}

function formatSignedEuroCents(cents: number, direction: "IN" | "OUT") {
  if (cents === 0) {
    return formatEuroCents(cents);
  }
  const sign = direction === "IN" ? "+" : "-";
  return `${sign}${formatEuroCents(cents)}`;
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

function filterData(data: { monthly: MonthBucket[], daily: any[] }, range: TimeRange): any[] {
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

type CustomTooltipProps = {
  active?: boolean;
  payload?: { value: number; payload?: any }[];
  label?: string;
  setActivePoint: (point: any) => void;
};

function ChartTooltip({ active, payload, label, setActivePoint }: CustomTooltipProps) {
  useEffect(() => {
    if (active && payload && payload.length > 0) {
      setActivePoint(payload[0].payload);
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
        {[...payload].sort((a: any, b: any) => {
          if (a.name === "heritage" || a.name === "value") return -1;
          if (b.name === "heritage" || b.name === "value") return 1;
          return (b.value || 0) - (a.value || 0);
        }).map((p: any, index: number) => {
          let labelStr = "";
          if (p.name === "value") {
            labelStr = "TOTAL";
          } else if (p.name === "heritage") {
            labelStr = "HERITAGE";
          } else if (p.name === "balance") {
            labelStr = "BALANCE";
          } else if (p.name === "income") {
            labelStr = "INCOME";
          } else if (p.name === "expenses") {
            labelStr = "EXPENSES";
          } else {
            labelStr = formatProviderLabel(p.name);
          }
          return (
            <div key={index} className="flex justify-between gap-6 items-center">
              <span className="text-[10px] font-bold uppercase" style={{ color: "#ffffff" }}>{labelStr}</span>
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
    ? Math.max(2, viewBox.x - rectWidth / 2)
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

interface CheckingDashboardProps {
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

export function CheckingDashboard({
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
}: CheckingDashboardProps) {
  const [data, setData] = useState<CheckingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [newProviderKeys, setNewProviderKeys] = useState<Set<string>>(new Set());
  const knownProviderKeysRef = useRef<Set<string>>(new Set());
  const pendingImportRefreshRef = useRef(false);
  const onImportRefreshCompleteRef = useRef(onImportRefreshComplete);
  onImportRefreshCompleteRef.current = onImportRefreshComplete;

  const [activeTab, setActiveTab] = useState<string>("ALL"); // "ALL" or provider name
  const [timeRange, setTimeRange] = useState<TimeRange>("ALL");
  const [selectedPoint, setSelectedPoint] = useState<{ month: string, seriesKey: string, value: number } | null>(null);
  const [hiddenSeries, setHiddenSeries] = useState<Record<string, boolean>>({});
  const [isMobile, setIsMobile] = useState(false);
  const [activeChartPoint, setActiveChartPoint] = useState<any | null>(null);
  const activePoint = activeChartPoint;

  const toggleSeries = (key: string) => {
    setHiddenSeries(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

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

  const fetchDashboard = useCallback(
    async () => {
      try {
        const response = await fetch(`/api/transactions/checking?userId=${userId}`, {
          cache: "no-store"
        });
        const payload = (await response.json()) as CheckingData & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Errore nel caricamento della pagina checking.");
        }

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
    },
    [userId]
  );

  useEffect(() => {
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
  }, [fetchDashboard]);

  useEffect(() => {
    if (!loading) {
      pendingImportRefreshRef.current = true;
      void fetchDashboard();
    }
  }, [transactionCount, fetchDashboard]);

  const chartData = useMemo(() => {
    if (!data) {
      return [];
    }

    const filtered = filterData({ monthly: data.monthlyData, daily: data.dailyData }, timeRange);

    return filtered.map((bucket) => {
      const rawKey = bucket.date || bucket.month;

      if (activeTab === "ALL") {
        const ret: any = {
          month: rawKey,
          rawMonth: rawKey,
          heritage: Math.abs(bucket.total)
        };
        data.providers.forEach(p => {
          const provKey = p.sourceInstitution;
          const val = bucket.providers[provKey];
          // Use null only if undefined (i.e. before account was ever opened)
          ret[provKey] = val !== undefined ? Math.abs(val) : null;
        });
        return ret;
      } else {
        const bal = bucket.providers[activeTab];
        const inc = bucket.providerIncome[activeTab];
        const exp = bucket.providerExpenses[activeTab];

        const hasBalance = bal !== undefined;
        const ret: any = {
          month: rawKey,
          rawMonth: rawKey,
          balance: hasBalance ? Math.abs(bal) : null,
          income: hasBalance ? Math.abs(inc || 0) : null,
          expenses: hasBalance ? Math.abs(exp || 0) : null,
          heritage: Math.abs(bucket.total)
        };
        data.providers.forEach(p => {
          const provKey = p.sourceInstitution;
          const val = bucket.providers[provKey];
          ret[provKey] = val !== undefined ? Math.abs(val) : null;
        });
        return ret;
      }
    });
  }, [data, activeTab, timeRange]);

  // Removed selectedValue since we use selectedPoint directly within the render

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

  if (loading) {
    return (
      <div className={cn("flex h-full items-center justify-center", !isActive && "absolute inset-0 pointer-events-none opacity-0 invisible")}>
        <p className="text-sm text-[color:var(--text-dim)]">Caricamento checking...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex h-full items-center justify-center", !isActive && "absolute inset-0 pointer-events-none opacity-0 invisible")}>
        <p className="text-sm text-[color:var(--danger)]">{error}</p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const allTotal = data.providers.reduce((sum, p) => sum + p.total, 0);

  const tabs = [
    { key: "ALL", label: "CHECKING", total: allTotal },
    ...data.providers.map(p => ({
      key: p.sourceInstitution,
      label: formatProviderLabel(p.sourceInstitution),
      total: p.total
    }))
  ];

  return (
    <div className={cn("flex h-full flex-col gap-4 overflow-hidden relative w-full", !isActive && "absolute inset-0 pointer-events-none opacity-0 invisible")}>
      {/* Account type tabs (Rendered inside header portal) */}
      {portalNode &&
        createPortal(
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
                  <div className="flex items-center justify-center w-[40px] flex-shrink-0">
                    {tab.key === "ALL" ? (
                      <Landmark className="h-4 w-4 flex-shrink-0" strokeWidth={2.2} />
                    ) : (
                      <span className="font-bold">{getAbbreviatedLabel(tab.label)}</span>
                    )}
                  </div>
                  <span className={`text-right tabular-nums whitespace-nowrap ${isActive ? "" : "opacity-70"}`}>
                    {formatEuroCents(
                      activePoint
                        ? (tab.key === "ALL" ? (activePoint.heritage ?? 0) : (activePoint[tab.key] ?? 0))
                        : tab.total
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
            {/* Time range filters */}
            <div className="absolute top-0 right-0 z-10 flex items-center justify-end gap-0.5">

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
              <div className="relative w-full h-full" onClick={() => setSelectedPoint(null)}>
                <div id="chart-reference-overlay" className="absolute inset-0 pointer-events-none z-10" />
                <style dangerouslySetInnerHTML={{ __html: `
                  .recharts-wrapper, .recharts-wrapper *, .recharts-surface, .recharts-surface *, .recharts-container, .recharts-container * {
                    outline: none !important;
                    box-shadow: none !important;
                  }
                `}} />
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
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
                    <Tooltip content={<ChartTooltip setActivePoint={setActiveChartPoint} />} cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1, fill: "transparent" }} />
                    {activeTab !== "ALL" ? (
                      <>
                        <Line
                          type="linear"
                          dataKey="income"
                          name="income"
                          stroke="#8f8f8f"
                          strokeWidth={2}
                          isAnimationActive={false}
                          connectNulls={false}
                          hide={!!hiddenSeries['income']}
                          activeDot={(props: any) => {
                            const { cx, cy, payload } = props;
                            if (payload.income == null) return null;
                            return (
                              <circle
                                cx={cx} cy={cy} r={5}
                                fill="#1a1a1a" stroke="#8f8f8f" strokeWidth={2}
                                style={{ cursor: "pointer", outline: "none" }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPoint({ month: payload.rawMonth, seriesKey: 'income', value: payload.income });
                                }}
                              />
                            );
                          }}
                          dot={false}
                        />
                        <Line
                          type="linear"
                          dataKey="expenses"
                          name="expenses"
                          stroke="#404040"
                          strokeWidth={2}
                          isAnimationActive={false}
                          connectNulls={false}
                          hide={!!hiddenSeries['expenses']}
                          activeDot={(props: any) => {
                            const { cx, cy, payload } = props;
                            if (payload.expenses == null) return null;
                            return (
                              <circle
                                cx={cx} cy={cy} r={5}
                                fill="#1a1a1a" stroke="#404040" strokeWidth={2}
                                style={{ cursor: "pointer", outline: "none" }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPoint({ month: payload.rawMonth, seriesKey: 'expenses', value: payload.expenses });
                                }}
                              />
                            );
                          }}
                          dot={false}
                        />
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
                          activeDot={(props: any) => {
                            const { cx, cy, payload } = props;
                            if (payload.balance == null) return null;
                            return (
                              <circle
                                cx={cx} cy={cy} r={6}
                                fill="#1a1a1a" stroke="#ffffff" strokeWidth={2}
                                style={{ cursor: "pointer", outline: "none" }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedPoint({ month: payload.rawMonth, seriesKey: 'balance', value: payload.balance });
                                }}
                              />
                            );
                          }}
                          dot={false}
                        />
                      </>
                    ) : (
                      <>
                        {data.providers.map((p, idx) => {
                          const provKey = p.sourceInstitution;
                          // Use conditional render (not hide prop) so that when a provider is
                          // re-shown, React inserts it BEFORE Heritage in SVG, keeping Heritage on top
                          if (hiddenSeries[provKey]) return null;
                          const strokeColor = GRAYSCALE_PALETTE[idx % GRAYSCALE_PALETTE.length];
                          return (
                            <Line
                              key={provKey}
                              type="linear"
                              dataKey={provKey}
                              name={provKey}
                              stroke={strokeColor}
                              strokeWidth={2}
                              isAnimationActive={false}
                              connectNulls={false}
                              activeDot={(props: any) => {
                                const { cx, cy, payload } = props;
                                if (payload[provKey] == null) return null;
                                return (
                                  <circle
                                    cx={cx} cy={cy} r={6}
                                    fill="#1a1a1a" stroke={strokeColor} strokeWidth={2}
                                    style={{ cursor: "pointer", outline: "none" }}
                                    onClick={(e) => { e.stopPropagation(); setSelectedPoint({ month: payload.rawMonth, seriesKey: provKey, value: payload[provKey] }); }}
                                  />
                                );
                              }}
                              dot={false}
                            />
                          );
                        })}
                        {/* Heritage: force remount last (via dynamic key) whenever any series is toggled */}
                        <Line
                          key={`heritage-${Object.keys(hiddenSeries).sort().map(k => hiddenSeries[k] ? '0' : '1').join('')}`}
                          type="linear"
                          dataKey="heritage"
                          name="heritage"
                          stroke="#ffffff"
                          strokeWidth={2.5}
                          isAnimationActive={false}
                          hide={!!hiddenSeries['heritage']}
                            activeDot={(props: any) => {
                              const { cx, cy, payload } = props;
                              if (payload.heritage == null) return null;
                              return (
                                <circle
                                  cx={cx} cy={cy} r={6}
                                  fill="#1a1a1a" stroke="#ffffff" strokeWidth={2}
                                  style={{ cursor: "pointer", outline: "none" }}
                                  onClick={(e) => { e.stopPropagation(); setSelectedPoint({ month: payload.rawMonth, seriesKey: 'heritage', value: payload.heritage }); }}
                                />
                              );
                            }}
                            dot={false}
                        />
                      </>
                    )}

                    {selectedPoint && (
                      <ReferenceLine
                        y={selectedPoint.value}
                        stroke="rgba(254, 254, 254, 0.5)"
                        strokeWidth={1.5}
                        strokeDasharray="6 4"
                        label={<CustomReferenceLabel selectedValue={selectedPoint.value} />}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Legend */}
            {activeTab === "ALL" ? (() => {
              const allSeriesKeys = ['heritage', ...data.providers.map(p => p.sourceInstitution)];
              const visibleCount = allSeriesKeys.filter(k => !hiddenSeries[k]).length;
              return (
                <div
                  className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap w-full pt-2 pb-0"
                  style={{ visibility: transactionCount > 0 ? "visible" : "hidden" }}
                >
                  <div style={{ color: hiddenSeries['heritage'] ? '#4C4C4C' : '#ffffff' }}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (!hiddenSeries['heritage'] && visibleCount <= 1) return;
                        toggleSeries('heritage');
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { if (!hiddenSeries['heritage'] && visibleCount <= 1) return; toggleSeries('heritage'); } }}
                      className={`flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider select-none outline-none ${
                        !hiddenSeries['heritage'] && visibleCount <= 1 ? 'cursor-not-allowed' : 'cursor-pointer'
                      }`}
                      style={{ WebkitTapHighlightColor: 'transparent', color: 'inherit' }}
                    >
                      <div className="w-[14px] h-[6px] sm:w-[16px] sm:h-[8px] rounded-full" style={{ backgroundColor: hiddenSeries['heritage'] ? '#4C4C4C' : '#ffffff' }} />
                      <span className={cn(hiddenSeries['heritage'] && "line-through")}>HERITAGE</span>
                    </div>
                  </div>
                  {data.providers.map((p, idx) => {
                    const provKey = p.sourceInstitution;
                    const strokeColor = GRAYSCALE_PALETTE[idx % GRAYSCALE_PALETTE.length];
                    const isLastVisible = !hiddenSeries[provKey] && visibleCount <= 1;
                    return (
                      <div key={provKey} style={{ color: hiddenSeries[provKey] ? '#4C4C4C' : strokeColor }}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            if (isLastVisible) return;
                            toggleSeries(provKey);
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { if (isLastVisible) return; toggleSeries(provKey); } }}
                          className={`flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider select-none outline-none ${
                            isLastVisible ? 'cursor-not-allowed' : 'cursor-pointer'
                          }`}
                          style={{ WebkitTapHighlightColor: 'transparent', color: 'inherit' }}
                        >
                          <div className="w-[14px] h-[6px] sm:w-[16px] sm:h-[8px] rounded-full" style={{ backgroundColor: hiddenSeries[provKey] ? '#4C4C4C' : strokeColor }} />
                          <span className={cn(hiddenSeries[provKey] && "line-through")}>{formatProviderLabel(provKey)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })() : (() => {
              const metrics = ['balance', 'income', 'expenses'];
              const visibleCount = metrics.filter(k => !hiddenSeries[k]).length;
              const metricColors: Record<string, string> = {
                balance: '#ffffff',
                income: '#8f8f8f',
                expenses: '#404040'
              };
              return (
                <div
                  className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap w-full pt-2 pb-0"
                  style={{ visibility: transactionCount > 0 ? "visible" : "hidden" }}
                >
                  {metrics.map((m) => {
                    const isLastVisible = !hiddenSeries[m] && visibleCount <= 1;
                    const color = metricColors[m];
                    return (
                      <div key={m} style={{ color: hiddenSeries[m] ? '#4C4C4C' : color }}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            if (isLastVisible) return;
                            toggleSeries(m);
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { if (isLastVisible) return; toggleSeries(m); } }}
                          className={`flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider select-none outline-none ${
                            isLastVisible ? 'cursor-not-allowed' : 'cursor-pointer'
                          }`}
                          style={{ WebkitTapHighlightColor: 'transparent', color: 'inherit' }}
                        >
                          <div className="w-[14px] h-[6px] sm:w-[16px] sm:h-[8px] rounded-full" style={{ backgroundColor: hiddenSeries[m] ? '#4C4C4C' : color }} />
                          <span className={cn(hiddenSeries[m] && "line-through")}>{m}</span>
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

      {cardsPortalNode &&
        createPortal(
          <div className={cn("flex flex-col gap-5 w-full pb-6 lg:pb-0", !isActive && "absolute pointer-events-none opacity-0 invisible")}>
            {data.providers.map((provider, idx) => {
              const isNew = newProviderKeys.has(provider.sourceInstitution);
              return (
              <div key={provider.sourceInstitution} className={cn("grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4", isNew && "card-enter")} style={isNew ? { animationDelay: `${idx * 80}ms` } : undefined}>

                {/* Provider Summary Card (Left) */}
                <div className="flex flex-col rounded-[20px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-canvas)] p-4 h-full">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--text-main)]">
                      {formatProviderLabel(provider.sourceInstitution)}
                    </span>
                    <span key={`total-${provider.sourceInstitution}-${isNew ? "s" : dataVersion}`} className={cn("text-sm font-bold text-[color:var(--text-main)]", !isNew && dataVersion > 0 && "value-flash")}>
                      {formatEuroCents(provider.total)}
                    </span>
                  </div>
                  <div key={`values-${provider.sourceInstitution}-${isNew ? "s" : dataVersion}`} className={cn("mt-4 space-y-1.5 text-sm", !isNew && dataVersion > 0 && "value-flash")}>
                    <hr className="mb-3 border-[color:var(--line-strong)] opacity-50" />
                    <div className="flex justify-between">
                      <span className="pl-3 text-[color:var(--text-dim)] font-medium">Income</span>
                      <span className="font-semibold text-[color:var(--text-main)]">
                        {formatEuroCents(provider.income)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="pl-3 text-[color:var(--text-dim)] font-medium">Expenses</span>
                      <span className="font-semibold text-[color:var(--text-main)]">
                        {formatEuroCents(provider.expenses)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="pl-3 text-[color:var(--text-dim)] font-medium">Interest</span>
                      <span className="font-semibold text-[color:var(--text-main)]">
                        {formatEuroCents(provider.interest)}
                      </span>
                    </div>
                    {provider.cashback !== 0 && (
                      <div className="flex justify-between">
                        <span className="pl-3 text-[color:var(--text-dim)] font-medium">Cashback</span>
                        <span className="font-semibold text-[color:var(--text-main)]">
                          {formatEuroCents(provider.cashback)}
                        </span>
                      </div>
                    )}
                    {(provider.sourceInstitution === "trade_republic" || provider.tax !== 0) && (
                      <div className="flex justify-between">
                        <span className="pl-3 text-[color:var(--text-dim)] font-medium">Tax</span>
                        <span className="font-semibold text-[color:var(--text-main)]">
                          {formatEuroCents(provider.tax)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Transactions Table (Right) */}
                <div className="flex flex-col min-h-[280px] lg:h-[400px] flex-1 overflow-hidden rounded-[20px] border-2 border-[color:var(--line-strong)] bg-[#1f1f1f]">
                  <div className="h-full overflow-auto rounded-[20px] hide-scrollbar">
                    <table className="min-w-full border-separate border-spacing-0 text-[11px] sm:text-sm">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-[0.12em] text-[#D9D9D9] sm:text-[11px] sm:tracking-[0.18em]">
                          <th className="sticky top-0 z-20 rounded-tl-[18px] border-b border-[color:var(--line-strong)] bg-[#1f1f1f] px-1.5 py-2 font-medium sm:px-4 sm:py-3">Date</th>
                          <th className="sticky top-0 z-20 border-b border-[color:var(--line-strong)] bg-[#1f1f1f] px-4 py-2 font-medium hidden md:table-cell sm:py-3">Sort</th>
                          <th className="sticky top-0 z-20 border-b border-[color:var(--line-strong)] bg-[#1f1f1f] px-1.5 py-2 font-medium sm:px-4 sm:py-3 text-left w-full">Description</th>
                          <th className="sticky top-0 z-20 rounded-tr-[18px] border-b border-[color:var(--line-strong)] bg-[#1f1f1f] px-1.5 py-2 text-right font-medium sm:px-4 sm:py-3">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {provider.transactions.map((tx) => (
                          <tr key={tx.id} className={cn("border-b border-[color:rgba(255,255,255,0.08)] align-middle last:border-b-0 hover:bg-[color:rgba(255,255,255,0.03)] transition-colors duration-150", isNew && "card-enter")}>
                            <td className="px-1.5 py-2 text-[color:var(--text-main)] sm:px-4">
                              <div className="font-semibold whitespace-nowrap">{new Date(tx.bookingDate).toISOString().split('T')[0]}</div>
                            </td>
                            <td className="px-4 py-2 text-[color:var(--text-main)] hidden md:table-cell whitespace-nowrap">{tx.typeLabel}</td>
                            <td className="px-1.5 py-2 text-[color:var(--text-main)] sm:px-4 w-full max-w-0">
                              <div className="leading-5 truncate">{tx.description}</div>
                            </td>
                            <td className="px-1.5 py-2 text-right text-[color:var(--text-main)] font-semibold whitespace-nowrap sm:px-4">{formatSignedEuroCents(tx.amountCents, tx.direction)}</td>
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
