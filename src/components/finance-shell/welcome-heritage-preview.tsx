"use client";

import { useEffect, useMemo, useState } from "react";
import { ChartPie } from "lucide-react";
import { Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";

import { SelectableChartDot } from "@/components/chart-primitives/selectable-chart-dot";
import {
  buildDashboardChartData,
  collectCheckingProviders,
  collectCryptoInstitutions,
  collectCryptoTokens,
  collectInvestmentProducts
} from "@/components/dashboard/dashboard-chart-data-model";
import { getXAxisTicks } from "@/components/dashboard/dashboard-chart-display-model";
import type { DashboardChartPoint } from "@/components/dashboard/dashboard-chart-types";
import { formatEuroCents, getMonthLabel } from "@/components/dashboard/formatters";
import { useBinanceBalances } from "@/components/dashboard/use-binance-balances";
import { useDashboardData } from "@/components/dashboard/use-dashboard-data";
import { useDashboardLivePrices } from "@/components/dashboard/use-dashboard-live-prices";
import { useDashboardLiveTotals } from "@/components/dashboard/use-dashboard-live-totals";
import { DashboardTopbarTab } from "@/components/finance-shell/dashboard-topbar-tab";
import { useChartContainerReady } from "@/hooks/use-chart-container-ready";

import type { UserRecord } from "./types";

type WelcomeHeritagePreviewProps = {
  activeUser: UserRecord | null;
  isActive: boolean;
};

type HeritageActiveDotProps = {
  cx?: number;
  cy?: number;
  payload?: DashboardChartPoint;
};

type HeritageTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: DashboardChartPoint }>;
  setActivePoint: (point: DashboardChartPoint | null) => void;
};

const FALLBACK_CHART_SIZE = { width: 460, height: 310 };

function WelcomeHeritageTooltip({ active, payload, setActivePoint }: HeritageTooltipProps) {
  useEffect(() => {
    setActivePoint(active ? payload?.[0]?.payload ?? null : null);
  }, [active, payload, setActivePoint]);

  return null;
}

export function WelcomeHeritagePreview({
  activeUser,
  isActive
}: WelcomeHeritagePreviewProps) {
  const [activePoint, setActivePoint] = useState<DashboardChartPoint | null>(null);
  const { chartContainerRef, chartReady, chartSize } = useChartContainerReady();
  const shouldLoad = !!activeUser && isActive;
  const {
    binanceBalances
  } = useBinanceBalances({
    binanceRefreshKey: 0,
    isActive,
    shouldLoad,
    userId: activeUser?.id ?? ""
  });
  const { data, loading, error } = useDashboardData({
    isActive,
    shouldLoad,
    transactionCount: activeUser?.transactionCount ?? 0,
    userId: activeUser?.id ?? ""
  });
  const livePrices = useDashboardLivePrices(data?.providerSummaries, {
    isActive,
    shouldLoad: shouldLoad && !!data
  });
  const {
    getGlobalCryptoLiveTotal,
    getGlobalInvestmentLiveTotal
  } = useDashboardLiveTotals({
    binanceBalances,
    data,
    livePrices
  });
  const binanceTotalCents = useMemo(
    () => Math.round(binanceBalances.reduce((sum, balance) => sum + balance.eurValue, 0) * 100),
    [binanceBalances]
  );
  const hasBinancePortfolio = !!activeUser?.hasBinanceCredentials || binanceTotalCents > 0;
  const chartData = useMemo(() => {
    if (!data) return [];

    return buildDashboardChartData({
      activeTab: "heritage",
      binanceTotalCents,
      checkingProviders: collectCheckingProviders(data),
      cryptoInstitutions: collectCryptoInstitutions(data),
      cryptoTokens: collectCryptoTokens(data),
      data,
      hasBinancePortfolio,
      investmentProducts: collectInvestmentProducts(data),
      timeRange: "ALL"
    });
  }, [binanceTotalCents, data, hasBinancePortfolio]);
  const heritageValues = useMemo(
    () => chartData
      .map((point) => point.heritage)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
    [chartData]
  );
  const xAxisTicks = useMemo(() => getWelcomeXAxisTicks(getXAxisTicks(chartData)), [chartData]);
  const latestPoint = useMemo(
    () => [...chartData].reverse().find((point) => typeof point.heritage === "number") ?? null,
    [chartData]
  );
  const currentHeritageValue = data
    ? data.accountTotals.checking + getGlobalInvestmentLiveTotal() + getGlobalCryptoLiveTotal()
    : Number(latestPoint?.heritage ?? 0);
  const topbarValue = Number(activePoint?.heritage ?? currentHeritageValue);
  const renderedChartSize = chartReady ? chartSize : FALLBACK_CHART_SIZE;
  const yDomain = getWelcomeYDomain(heritageValues);
  const yGridLines = getWelcomeGridLines(yDomain);
  const hasChartData = heritageValues.length > 0;

  if (loading && !data) {
    return (
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[460px] flex-col justify-center">
        <div className="h-[310px] animate-pulse rounded-[18px] border border-[color:var(--line-soft)]/40 bg-[color:var(--surface-panel)]/40 sm:h-[340px]" />
        <div className="mt-3 h-16 animate-pulse rounded-[12px] bg-[color:var(--surface-panel)]/40" />
      </div>
    );
  }

  if (error || !hasChartData) {
    return (
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[460px] flex-col justify-center space-y-3">
        <h2 className="text-2xl font-bold uppercase tracking-normal text-white sm:text-3xl">
          Portfolio
        </h2>
        <p className="max-w-[430px] text-sm font-medium leading-relaxed text-[color:var(--text-dim)]">
          Import transactions to build your Heritage timeline.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[460px] flex-col justify-center">
      <div className="relative h-[310px] sm:h-[325px] lg:h-[340px]">
        <div className="hide-scrollbar absolute left-0 top-10 z-20 flex gap-2 overflow-x-auto px-1 pb-1 [&_.dashboard-topbar-currency-icon]:h-3.5 [&_.dashboard-topbar-currency-icon]:w-3.5 [&_.dashboard-topbar-line]:gap-2 [&_.dashboard-topbar-tab]:h-10 [&_.dashboard-topbar-tab]:w-[146px] [&_.dashboard-topbar-tab]:rounded-[14px] [&_.dashboard-topbar-tab]:px-2 sm:top-12 sm:[&_.dashboard-topbar-currency-icon]:h-4 sm:[&_.dashboard-topbar-currency-icon]:w-4 sm:[&_.dashboard-topbar-line]:gap-3 sm:[&_.dashboard-topbar-tab]:h-12 sm:[&_.dashboard-topbar-tab]:w-[178px] sm:[&_.dashboard-topbar-tab]:rounded-[16px] sm:[&_.dashboard-topbar-tab]:px-3">
          <DashboardTopbarTab
            active
            ariaLabel="Heritage preview"
            icon={ChartPie}
            value={formatEuroCents(topbarValue)}
          />
        </div>

        <div ref={chartContainerRef} className="absolute inset-x-0 top-0 h-[310px] overflow-visible sm:h-[340px] lg:h-[360px]">
          <LineChart
            accessibilityLayer={false}
            data={chartData}
            height={renderedChartSize.height}
            margin={{ top: 8, right: 14, bottom: 26, left: 14 }}
            style={{ outline: "none", overflow: "visible" }}
            width={renderedChartSize.width}
          >
            <XAxis
              axisLine={false}
              dataKey="rawMonth"
              dy={10}
              minTickGap={8}
              tick={{ fill: "#666666", fontSize: 10 }}
              tickFormatter={formatWelcomeTick}
              tickLine={false}
              ticks={xAxisTicks}
            />
            <YAxis
              axisLine={false}
              domain={yDomain}
              tick={false}
              tickLine={false}
              width={0}
            />
            {yGridLines.map((value) => (
              <ReferenceLine
                ifOverflow="extendDomain"
                key={value}
                stroke="rgba(154,154,154,0.12)"
                strokeDasharray="3 3"
                y={value}
              />
            ))}
            <Tooltip
              content={<WelcomeHeritageTooltip setActivePoint={setActivePoint} />}
              cursor={{ stroke: "rgba(255,255,255,0.12)", strokeWidth: 1, fill: "transparent" }}
            />
            <Line
              activeDot={(props: HeritageActiveDotProps) => (
                <SelectableChartDot
                  color="#ffffff"
                  cx={props.cx}
                  cy={props.cy}
                  onSelectPoint={() => undefined}
                  payload={props.payload}
                  seriesKey="heritage"
                />
              )}
              connectNulls={false}
              dataKey="heritage"
              dot={false}
              isAnimationActive={false}
              name="heritage"
              stroke="#ffffff"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              type="linear"
            />
          </LineChart>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold uppercase tracking-normal text-white sm:text-3xl">
          Portfolio
        </h2>
        <p className="max-w-[430px] text-sm font-medium leading-relaxed text-[color:var(--text-dim)]">
          Your Heritage value across cash, ETF, stock and crypto positions.
        </p>
      </div>
    </div>
  );
}

function getWelcomeXAxisTicks(ticks: string[]) {
  if (ticks.length <= 7) return ticks;

  return ticks.filter((_, index) => index % 2 === 0 || index === ticks.length - 1);
}

function formatWelcomeTick(value?: string) {
  if (!value) return "";
  if (value.length === 7) return getMonthLabel(value);

  const [year, month] = value.split("-");
  return getMonthLabel(`${year}-${month}`);
}

function getWelcomeYDomain(values: number[]): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const padding = Math.max(50_000, Math.round(range * 0.12));

  return [Math.max(0, min - padding), max + padding];
}

function getWelcomeGridLines([min, max]: [number, number]) {
  const step = (max - min) / 4;

  return [0, 1, 2, 3].map((index) => Math.round(min + step * (index + 1)));
}
