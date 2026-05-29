"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Bitcoin, X } from "lucide-react";
import { Line, LineChart, CartesianGrid, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { ChartLegend } from "./chart-primitives/chart-legend";
import { ChartReferenceLabel } from "./chart-primitives/chart-reference-label";
import { ChartTimeRangeControls } from "./chart-primitives/chart-time-range-controls";
import { BinanceChartTooltip } from "./binance-dashboard/binance-chart-tooltip";
import {
  BINANCE_CHART_LEGEND_ITEMS,
  BINANCE_TIME_RANGES,
  buildBinanceDailyChartData,
  filterBinanceChartData,
  formatBinanceEuro,
  formatBinanceEuroCents,
  formatBinanceXAxisTick,
  getBinanceXAxisTicks,
  type BinanceTimeRange
} from "./binance-dashboard/binance-chart-model";
import { EmptyChartAction } from "./finance-shell/empty-chart-action";
import { useChartContainerReady } from "@/hooks/use-chart-container-ready";
import { usePortalNode } from "@/hooks/use-portal-node";
import { cn } from "@/shared/utils";
import type { ActiveDotProps } from "@/types/chart";

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
  shouldLoad?: boolean;
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
  shouldLoad = isActive,
  showSettingsView = false,
  isClosingSettings = false,
  onCloseSettings,
  settingsElement,
  showUserSelectView = false,
  isClosingUserSelect = false,
  onCloseUserSelect,
  userSelectElement,
}: BinanceDashboardProps) {
  const [timeRange, setTimeRange] = useState<BinanceTimeRange>("ALL");
  const [selectedPoint, setSelectedPoint] = useState<{ month: string; seriesKey: string; value: number } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [balances, setBalances] = useState<BinanceBalance[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const loadBalances = useCallback(async () => {
    const response = await fetch(`/api/binance/balances?userId=${userId}`);
    const data = await response.json();
    if (Array.isArray(data.balances)) {
      setBalances(data.balances);
    }
  }, [userId]);

  useEffect(() => {
    if (!shouldLoad) return;
    const timer = window.setTimeout(() => {
      void loadBalances().catch(() => {});
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadBalances, shouldLoad]);

  async function handleSyncBalances() {
    if (isSyncing) return;

    setIsSyncing(true);
    setSyncError(null);
    setSyncNotice(null);

    try {
      const response = await fetch("/api/binance/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Binance sync failed.");
      }

      if (Array.isArray(data.balances)) {
        setBalances(data.balances);
      } else {
        await loadBalances();
      }

      setSyncNotice("Sync complete.");
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : "Binance sync failed.");
    } finally {
      setIsSyncing(false);
    }
  }

  const totalEur = useMemo(() => balances.reduce((sum, b) => sum + b.eurValue, 0), [balances]);

  const yAxisWidth = isMobile ? 0 : 50;
  const baseMargin = isMobile ? 0 : 24;
  const { chartContainerRef, chartReady, chartSize } = useChartContainerReady();
  const tabsPortalNode = usePortalNode("dashboard-tabs-portal");

  const allDailyData = useMemo(() => buildBinanceDailyChartData(totalEur), [totalEur]);
  const chartData = useMemo(() => filterBinanceChartData(allDailyData, timeRange), [allDailyData, timeRange]);
  const hasRenderableChartData = totalEur > 0;
  const xAxisTicks = useMemo(() => getBinanceXAxisTicks(chartData), [chartData]);
  const isPanelOpen = showUploadView || showSettingsView || showUserSelectView;
  const isPanelClosing =
    (showUploadView && isClosingUpload) ||
    (showSettingsView && isClosingSettings) ||
    (showUserSelectView && isClosingUserSelect);
  const shouldRevealChartContent = (!hasRenderableChartData || chartReady) && (!isPanelOpen || isPanelClosing);
  const panelOverlay = showUploadView ? (
    <div className={cn("absolute inset-0 z-20 flex h-full w-full flex-col justify-center overflow-hidden rounded-[18px] bg-[color:var(--surface-canvas)]", isClosingUpload ? "upload-panel-exit pointer-events-none" : "upload-panel-enter")}>
      <div role="button" onClick={onCloseUpload} className="absolute right-0 top-0 z-50 flex h-8 w-8 cursor-pointer items-center justify-center text-[color:var(--text-dim)] transition-colors hover:text-white" title="Esci dall'importazione">
        <X className="h-5 w-5" strokeWidth={2.3} />
      </div>
      {previewTransactionsCount > 0 ? reviewElement : uploadElement}
    </div>
  ) : showSettingsView ? (
    <div className={cn("absolute inset-0 z-20 flex h-full w-full flex-col justify-center overflow-hidden rounded-[18px] bg-[color:var(--surface-canvas)]", isClosingSettings ? "upload-panel-exit pointer-events-none" : "upload-panel-enter")}>
      <div role="button" onClick={onCloseSettings} className="absolute right-0 top-0 z-50 flex h-8 w-8 cursor-pointer items-center justify-center text-[color:var(--text-dim)] transition-colors hover:text-white" title="Esci dalle impostazioni">
        <X className="h-5 w-5" strokeWidth={2.3} />
      </div>
      {settingsElement}
    </div>
  ) : showUserSelectView ? (
    <div className={cn("absolute inset-0 z-20 flex h-full w-full flex-col justify-center overflow-hidden rounded-[18px] bg-[color:var(--surface-canvas)]", isClosingUserSelect ? "upload-panel-exit pointer-events-none" : "upload-panel-enter")}>
      <div role="button" onClick={onCloseUserSelect} className="absolute right-0 top-0 z-50 flex h-8 w-8 cursor-pointer items-center justify-center text-[color:var(--text-dim)] transition-colors hover:text-white" title="Esci dalla selezione utente">
        <X className="h-5 w-5" strokeWidth={2.3} />
      </div>
      {userSelectElement}
    </div>
  ) : null;

  return (
    <div className={cn("absolute inset-0 flex h-full w-full flex-col gap-4 overflow-hidden", isActive ? "z-10 opacity-100 visible" : "z-0 pointer-events-none opacity-0 invisible")}>
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
              <span className="font-bold">{formatBinanceEuro(totalEur)}</span>
            </button>
          </div>,
          tabsPortalNode
        )}

      {/* Chart Area */}
      <div className="relative flex w-full flex-1 flex-col justify-center overflow-hidden rounded-[18px] min-h-[240px] sm:min-h-[400px] md:min-h-[440px] lg:min-h-[520px]">
        <div
          className={cn("chart-content-reveal absolute inset-0 z-0 flex h-full min-h-0 w-full flex-col", isPanelOpen && "pointer-events-none")}
          data-visible={shouldRevealChartContent ? "true" : "false"}
        >
            {!hasRenderableChartData ? (
              <div className="flex h-full w-full items-center justify-center">
                <EmptyChartAction
                  actionLabel={isSyncing ? "Loading" : "Sync"}
                  disabled={isSyncing}
                  error={syncError}
                  notice={syncNotice}
                  onAction={() => void handleSyncBalances()}
                  title="Binance"
                />
              </div>
            ) : (
              <>
            <ChartTimeRangeControls
              onTimeRangeChange={(range) => setTimeRange(range)}
              ranges={BINANCE_TIME_RANGES}
              timeRange={timeRange}
            />

            <div className="mt-10 flex-1 min-h-0 w-full outline-none" onClick={() => setSelectedPoint(null)}>
              <div ref={chartContainerRef} className="relative h-full w-full">
                <div id="chart-reference-overlay" className="pointer-events-none absolute inset-0 z-10" />
                {chartReady ? (
                  <LineChart width={chartSize.width} height={chartSize.height} data={chartData} margin={{ top: 8, right: baseMargin, bottom: 0, left: baseMargin }} accessibilityLayer={false}>
                    <XAxis
                      dataKey="rawMonth"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#666666", fontSize: isMobile ? 9 : 11 }}
                      dy={8}
                      padding={{ left: isMobile ? 16 : 0, right: isMobile ? 16 : 0 }}
                      minTickGap={isMobile ? 20 : 10}
                      ticks={xAxisTicks}
                      tickFormatter={(value) => formatBinanceXAxisTick(String(value ?? ""))}
                    />
                    <YAxis tick={{ fill: "#a8a8a8", fontSize: isMobile ? 9 : 10 }} axisLine={false} tickLine={false} mirror={isMobile} tickFormatter={(value) => formatBinanceEuroCents(value).replace(/\s/g, "").replace(",00", "")} width={yAxisWidth} />
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(154,154,154,0.12)" vertical={false} />
                    <Tooltip content={<BinanceChartTooltip />} cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1, fill: "transparent" }} />
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
                    {selectedPoint && <ReferenceLine y={selectedPoint.value} stroke="rgba(254,254,254,0.5)" strokeWidth={1.5} strokeDasharray="6 4" label={<ChartReferenceLabel selectedValue={selectedPoint.value} />} />}
                  </LineChart>
                ) : null}
              </div>
            </div>

            <ChartLegend
              className="flex flex-wrap items-center justify-center gap-3 pt-2 pb-0 sm:gap-4 overflow-x-auto max-h-[100px] hide-scrollbar"
              hiddenSeries={{}}
              items={BINANCE_CHART_LEGEND_ITEMS}
              onToggleSeries={() => undefined}
              transactionCount={hasRenderableChartData ? 1 : 0}
            />
              </>
            )}
        </div>
        {panelOverlay}
      </div>

    </div>
  );
}
