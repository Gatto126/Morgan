"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Bitcoin, X } from "lucide-react";
import { Line, LineChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import type { ActiveDotProps, ChartPoint, ChartTooltipPayload } from "@/types/chart";

type TimeRange = "ALL" | "1Y" | "6M" | "3M" | "1M" | "1W";

const TIME_RANGES: TimeRange[] = ["ALL", "1Y", "6M", "3M", "1M", "1W"];

const euroFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});

function formatEuroCents(cents: number) {
  return euroFormatter.format(cents / 100);
}

function formatEur(value: number) {
  return euroFormatter.format(value);
}

function getMonthLabel(month: string) {
  const [year, m] = month.split("-");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const shortYear = year.slice(2);
  return `${monthNames[Number.parseInt(m, 10) - 1]} ${shortYear}`;
}

function filterData(daily: ChartPoint[], range: TimeRange): ChartPoint[] {
  if (range === "ALL") return daily;

  const cutoff = new Date();
  if (range === "1W") cutoff.setDate(cutoff.getDate() - 7);
  else if (range === "1M") cutoff.setDate(cutoff.getDate() - 30);
  else if (range === "3M") cutoff.setMonth(cutoff.getMonth() - 3);
  else if (range === "6M") cutoff.setMonth(cutoff.getMonth() - 6);
  else if (range === "1Y") cutoff.setFullYear(cutoff.getFullYear() - 1);

  const cutoffKey = cutoff.toISOString().split("T")[0];
  return daily.filter((d) => (d.date ?? "") >= cutoffKey);
}

type ChartTooltipProps = {
  active?: boolean;
  payload?: ChartTooltipPayload[];
  label?: string;
};

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
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
        {payload.map((p, index) => (
          <div key={index} className="flex items-center justify-between gap-6">
            <span className="text-[10px] font-bold uppercase text-white truncate max-w-[150px]">BINANCE</span>
            <span className="font-semibold">{formatEuroCents(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const CustomReferenceLabel = (props: { viewBox?: { x: number; y: number }; value?: number; selectedValue?: number | null }) => {
  const { viewBox, value, selectedValue } = props;
  if (!viewBox) return null;
  const val = typeof selectedValue === "number" ? selectedValue : typeof value === "number" ? value : 0;
  const formattedValue = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(val / 100);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const rectWidth = isMobile ? 64 : 72;
  const rectHeight = 24;
  const top = viewBox.y - rectHeight / 2;
  const left = isMobile ? Math.max(2, viewBox.x - rectWidth / 2) : viewBox.x - rectWidth + 2;
  const overlayTarget = typeof document !== "undefined" ? document.getElementById("chart-reference-overlay") : null;
  if (!overlayTarget) return null;
  return createPortal(
    <div
      className="pointer-events-none absolute z-[100] flex items-center justify-center rounded-[12px] border-2 border-[#444444] bg-[#1a1a1a] shadow-[0_4px_6px_-1px_rgba(0,0,0,0.4)]"
      style={{ top, left, width: rectWidth, height: rectHeight }}
    >
      <span className="whitespace-nowrap text-[10px] font-bold text-white">
        {isMobile ? formattedValue.replace(/\s/g, "").replace(",00", "") : formattedValue.replace(/\s/g, "")}
      </span>
    </div>,
    overlayTarget
  );
};

type BinanceBalance = {
  id: string;
  userId: string;
  tokenSymbol: string;
  tokenName: string | null;
  freeAmount: number;
  lockedAmount: number;
  eurValue: number;
};

interface BinanceDashboardProps {
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
}

export function BinanceDashboard({
  userId,
  showUploadView = false,
  isClosingUpload = false,
  onCloseUpload,
  uploadElement,
  reviewElement,
  previewTransactionsCount = 0,
  isActive = true,
  showSettingsView = false,
  isClosingSettings = false,
  onCloseSettings,
  settingsElement,
  showUserSelectView = false,
  isClosingUserSelect = false,
  onCloseUserSelect,
  userSelectElement,
}: BinanceDashboardProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("ALL");
  const [selectedPoint, setSelectedPoint] = useState<{ month: string; seriesKey: string; value: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [balances, setBalances] = useState<BinanceBalance[]>([]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Fetch balances when becoming active or on first mount
  useEffect(() => {
    if (!isActive) return;
    fetch(`/api/binance/balances?userId=${userId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.balances)) setBalances(data.balances);
      })
      .catch(() => {});
  }, [isActive, userId]);

  const totalEur = useMemo(() => balances.reduce((sum, b) => sum + b.eurValue, 0), [balances]);

  const yAxisWidth = isMobile ? 0 : 50;
  const baseMargin = isMobile ? 0 : 24;
  const tabsPortalNode = typeof document === "undefined" ? null : document.getElementById("dashboard-tabs-portal");

  // Empty chart data (historical tracking not yet implemented)
  const allDailyData = useMemo(() => {
    const points = [];
    const today = new Date();
    const start = new Date();
    start.setFullYear(today.getFullYear() - 1, today.getMonth() - 4);
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      points.push({ date: dateStr, rawMonth: dateStr, balance: 0 });
    }
    return points;
  }, []);

  const chartData = useMemo(() => filterData(allDailyData, timeRange), [allDailyData, timeRange]);

  const xAxisTicks = useMemo(() => {
    const ticks: string[] = [];
    const seenMonths = new Set<string>();
    chartData.forEach((d) => {
      const rawMonth = d.rawMonth as string;
      if (!rawMonth) return;
      const monthKey = rawMonth.substring(0, 7);
      if (!seenMonths.has(monthKey)) {
        seenMonths.add(monthKey);
        ticks.push(rawMonth);
      }
    });
    return ticks;
  }, [chartData]);

  return (
    <div className={cn("relative flex h-full flex-col gap-4 overflow-hidden w-full", !isActive && "absolute inset-0 pointer-events-none opacity-0 invisible")}>
      {/* Tabs Portal */}
      {tabsPortalNode &&
        createPortal(
          <div className={cn("flex items-center gap-2 sm:gap-3", !isActive && "absolute pointer-events-none opacity-0 invisible")}>
            <button
              type="button"
              className="flex h-12 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[16px] border-2 px-4 sm:px-5 text-[11px] font-extrabold uppercase tracking-[0.14em] transition-colors border-white bg-[color:var(--surface-panel)] text-white"
            >
              <Bitcoin className="h-5 w-5 flex-shrink-0" strokeWidth={2.2} />
              <span>BINANCE</span>
              <span className="font-bold">{formatEur(totalEur)}</span>
            </button>
          </div>,
          tabsPortalNode
        )}

      {/* Chart Area */}
      <div className="relative flex w-full flex-1 flex-col min-h-[240px] sm:min-h-[400px] md:min-h-[440px] lg:min-h-[520px] justify-center">
        {showUploadView ? (
          <div className={cn("relative w-full h-full flex flex-col justify-center", isClosingUpload ? "upload-panel-exit" : "upload-panel-enter")}>
            <div role="button" onClick={onCloseUpload} className="absolute right-0 top-0 z-50 flex h-8 w-8 cursor-pointer items-center justify-center text-[color:var(--text-dim)] transition-colors hover:text-white" title="Esci dall'importazione">
              <X className="h-5 w-5" strokeWidth={2.3} />
            </div>
            {previewTransactionsCount > 0 ? reviewElement : uploadElement}
          </div>
        ) : showSettingsView ? (
          <div className={cn("relative w-full h-full flex flex-col justify-center", isClosingSettings ? "upload-panel-exit" : "upload-panel-enter")}>
            <div role="button" onClick={onCloseSettings} className="absolute right-0 top-0 z-50 flex h-8 w-8 cursor-pointer items-center justify-center text-[color:var(--text-dim)] transition-colors hover:text-white" title="Esci dalle impostazioni">
              <X className="h-5 w-5" strokeWidth={2.3} />
            </div>
            {settingsElement}
          </div>
        ) : showUserSelectView ? (
          <div className={cn("relative w-full h-full flex flex-col justify-center", isClosingUserSelect ? "upload-panel-exit" : "upload-panel-enter")}>
            <div role="button" onClick={onCloseUserSelect} className="absolute right-0 top-0 z-50 flex h-8 w-8 cursor-pointer items-center justify-center text-[color:var(--text-dim)] transition-colors hover:text-white" title="Esci dalla selezione utente">
              <X className="h-5 w-5" strokeWidth={2.3} />
            </div>
            {userSelectElement}
          </div>
        ) : (
          <>
            <div className="absolute right-0 top-0 z-10 flex items-center justify-end gap-0.5">
              {TIME_RANGES.map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setTimeRange(range)}
                  className="cursor-pointer rounded-md px-1.5 py-0 text-[8.5px] font-bold uppercase tracking-wider transition-colors duration-150 sm:text-[10px]"
                  style={{
                    background: timeRange === range ? "rgba(255,255,255,0.08)" : "transparent",
                    color: timeRange === range ? "#f5f5f5" : "#737373",
                  }}
                >
                  {range}
                </button>
              ))}
            </div>

            <div className="mt-10 flex-1 min-h-0 w-full outline-none" onClick={() => setSelectedPoint(null)}>
              <div className="relative h-full w-full">
                <style dangerouslySetInnerHTML={{ __html: `.recharts-wrapper, .recharts-wrapper *, .recharts-surface, .recharts-surface *, .recharts-container, .recharts-container * { outline: none !important; box-shadow: none !important; }` }} />
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
                        if (value.length === 7) return getMonthLabel(value);
                        const [year, month] = value.split("-");
                        return getMonthLabel(`${year}-${month}`);
                      }}
                    />
                    <YAxis tick={{ fill: "#a8a8a8", fontSize: isMobile ? 9 : 10 }} axisLine={false} tickLine={false} mirror={isMobile} tickFormatter={(v) => formatEuroCents(v).replace(/\s/g, "").replace(",00", "")} width={yAxisWidth} />
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(154,154,154,0.12)" vertical={false} />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1, fill: "transparent" }} />
                    <Line
                      type="linear"
                      dataKey="balance"
                      name="balance"
                      stroke="#ffffff"
                      strokeWidth={2.5}
                      isAnimationActive={false}
                      activeDot={(props: ActiveDotProps) => {
                        const { cx, cy, payload } = props;
                        return (
                          <circle
                            cx={cx} cy={cy} r={6}
                            fill="#1a1a1a" stroke="#ffffff" strokeWidth={2}
                            style={{ cursor: "pointer", outline: "none" }}
                            onClick={(e) => { e.stopPropagation(); setSelectedPoint({ month: payload.rawMonth, seriesKey: "balance", value: Number(payload.balance) }); }}
                          />
                        );
                      }}
                      dot={false}
                    />
                    {selectedPoint && <ReferenceLine y={selectedPoint.value} stroke="rgba(254,254,254,0.5)" strokeWidth={1.5} strokeDasharray="6 4" label={<CustomReferenceLabel selectedValue={selectedPoint.value} />} />}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2 pb-0 sm:gap-4 overflow-x-auto max-h-[100px] hide-scrollbar" style={{ visibility: "visible" }}>
              <div className="text-[#ffffff]">
                <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider select-none outline-none whitespace-nowrap">
                  <div className="h-[6px] w-[14px] rounded-full sm:h-[8px] sm:w-[16px] flex-shrink-0 bg-white" />
                  <span>BALANCE</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
