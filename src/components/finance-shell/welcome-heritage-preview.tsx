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
import type { DashboardChartPoint } from "@/components/dashboard/dashboard-chart-types";
import { formatEuroCents } from "@/components/dashboard/formatters";
import type { AccountTab, BinanceBalanceRow, DashboardData } from "@/components/dashboard/types";
import { useDashboardLivePrices } from "@/components/dashboard/use-dashboard-live-prices";
import { useDashboardLiveTotals } from "@/components/dashboard/use-dashboard-live-totals";
import { DashboardTopbarTab } from "@/components/finance-shell/dashboard-topbar-tab";
import { PortfolioPreviewChart } from "@/components/portfolio-preview-chart";
import { useStableChartFrame } from "@/hooks/use-stable-chart-frame";

import type { UserRecord } from "./types";
import {
  type AccountPortfolioPreviewRecord,
  useAccountPortfolioPreviewData
} from "./use-account-portfolio-preview-data";
import {
  formatWelcomeXAxisTick,
  getWelcomeXAxisTicks
} from "./welcome-heritage-preview-axis";

type WelcomeHeritagePreviewProps = {
  isActive: boolean;
  users: UserRecord[];
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

const FALLBACK_CHART_SIZE = { width: 520, height: 310 };

function WelcomeHeritageTooltip({ active, payload, setActivePoint }: HeritageTooltipProps) {
  useEffect(() => {
    setActivePoint(active ? payload?.[0]?.payload ?? null : null);
  }, [active, payload, setActivePoint]);

  return null;
}

export function WelcomeHeritagePreview({
  isActive,
  users = []
}: WelcomeHeritagePreviewProps) {
  const [activePoint, setActivePoint] = useState<DashboardChartPoint | null>(null);
  const { chartContainerRef, renderedChartSize, seriesReady } = useStableChartFrame({
    fallbackSize: FALLBACK_CHART_SIZE
  });
  const shouldLoad = isActive && users.length > 0;
  const { error, loading, records } = useAccountPortfolioPreviewData({
    isActive: shouldLoad,
    users
  });
  const combinedData = useMemo(() => getCombinedDashboardData(records), [records]);
  const binanceBalances = useMemo(
    () => records.flatMap((record) => record.binanceBalances),
    [records]
  );
  const livePrices = useDashboardLivePrices(combinedData?.providerSummaries, {
    isActive,
    shouldLoad: shouldLoad && !!combinedData
  });
  const {
    getGlobalCryptoLiveTotal,
    getGlobalInvestmentLiveTotal
  } = useDashboardLiveTotals({
    binanceBalances,
    data: combinedData,
    livePrices
  });
  const chartData = useMemo(() => getAggregatedAccountChartData(records), [records]);
  const heritageValues = useMemo(
    () => chartData
      .map((point) => point.heritage)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
    [chartData]
  );
  const xAxisTicks = useMemo(() => getWelcomeXAxisTicks(chartData), [chartData]);
  const latestPoint = useMemo(
    () => [...chartData].reverse().find((point) => typeof point.heritage === "number") ?? null,
    [chartData]
  );
  const currentHeritageValue = combinedData
    ? combinedData.accountTotals.checking + getGlobalInvestmentLiveTotal() + getGlobalCryptoLiveTotal()
    : Number(latestPoint?.heritage ?? 0);
  const topbarValue = Number(activePoint?.heritage ?? currentHeritageValue);
  const yDomain = getWelcomeYDomain(heritageValues);
  const yGridLines = getWelcomeGridLines(yDomain);
  const hasChartData = heritageValues.length > 0;
  const xAxisLabels = useMemo(
    () => xAxisTicks.map((tick) => formatWelcomeXAxisTick(tick)),
    [xAxisTicks]
  );

  if (loading && records.length === 0) {
    return (
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[520px] flex-col justify-center">
        <div className="h-[310px] animate-pulse rounded-[18px] border border-[color:var(--line-soft)]/40 bg-[color:var(--surface-panel)]/40 sm:h-[340px]" />
        <div className="mt-3 h-16 animate-pulse rounded-[12px] bg-[color:var(--surface-panel)]/40" />
      </div>
    );
  }

  if (error || !hasChartData) {
    return (
      <PortfolioPreviewChart
        ariaLabel="Heritage preview"
        body="Import transactions to build your Heritage timeline."
      />
    );
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[520px] flex-col justify-center">
      <div className="relative h-[330px] sm:h-[360px] lg:h-[380px]">
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
            margin={{ top: 8, right: 28, bottom: 26, left: 28 }}
            style={{ outline: "none", overflow: "visible" }}
            width={renderedChartSize.width}
          >
            <XAxis
              axisLine={false}
              dataKey="rawMonth"
              height={30}
              interval={0}
              minTickGap={8}
              padding={{ left: 18, right: 18 }}
              tick={false}
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
            {seriesReady ? (
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
            ) : null}
          </LineChart>
          <div className="pointer-events-none absolute bottom-6 left-[46px] right-[46px] h-3 text-[10px] font-medium text-[#666666]">
            {xAxisLabels.map((label, index) => {
              const left = xAxisLabels.length <= 1
                ? 50
                : (index / (xAxisLabels.length - 1)) * 100;

              return (
                <span
                  className="absolute top-0 -translate-x-1/2 whitespace-nowrap"
                  key={`${label}-${index}`}
                  style={{ left: `${left}%` }}
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold uppercase tracking-normal text-white sm:text-3xl">
          Portfolio
        </h2>
        <p className="max-w-[430px] text-sm font-medium leading-relaxed text-[color:var(--text-dim)]">
          Your Heritage value across all profiles, cash, ETF, stock and crypto positions.
        </p>
      </div>
    </div>
  );
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

function getCombinedDashboardData(records: AccountPortfolioPreviewRecord[]): DashboardData | null {
  const recordsWithData = records.filter((record) => record.data);

  if (recordsWithData.length === 0) {
    return null;
  }

  const accountTotals = {
    crypto: 0,
    checking: 0,
    heritage: 0,
    investment: 0
  } satisfies Record<AccountTab, number>;

  for (const { data } of recordsWithData) {
    if (!data) continue;

    accountTotals.checking += data.accountTotals.checking;
    accountTotals.investment += data.accountTotals.investment;
    accountTotals.crypto += data.accountTotals.crypto;
    accountTotals.heritage += data.accountTotals.heritage;
  }

  return {
    accountTotals,
    dailyData: [],
    monthlyData: [],
    providerSummaries: recordsWithData.flatMap((record) => record.data?.providerSummaries ?? [])
  };
}

function getAggregatedAccountChartData(records: AccountPortfolioPreviewRecord[]): DashboardChartPoint[] {
  const pointsByDate = new Map<string, DashboardChartPoint>();

  for (const record of records) {
    if (!record.data || record.user.transactionCount <= 0) {
      continue;
    }

    const binanceTotalCents = getBinanceTotalCents(record.binanceBalances);
    const profileChartData = buildDashboardChartData({
      activeTab: "heritage",
      binanceTotalCents,
      checkingProviders: collectCheckingProviders(record.data),
      cryptoInstitutions: collectCryptoInstitutions(record.data),
      cryptoTokens: collectCryptoTokens(record.data),
      data: record.data,
      hasBinancePortfolio: record.user.hasBinanceCredentials || binanceTotalCents > 0,
      investmentProducts: collectInvestmentProducts(record.data),
      timeRange: "ALL"
    });

    for (const point of profileChartData) {
      if (typeof point.heritage !== "number" || !Number.isFinite(point.heritage)) {
        continue;
      }

      const rawMonth = String(point.rawMonth ?? point.month ?? "");
      if (!rawMonth) {
        continue;
      }

      const currentPoint = pointsByDate.get(rawMonth);
      const currentHeritage = typeof currentPoint?.heritage === "number" ? currentPoint.heritage : 0;
      const heritage = currentHeritage + point.heritage;

      pointsByDate.set(rawMonth, {
        month: rawMonth,
        rawMonth,
        value: heritage,
        heritage
      });
    }
  }

  return [...pointsByDate.values()].sort((first, second) => {
    return String(first.rawMonth).localeCompare(String(second.rawMonth));
  });
}

function getBinanceTotalCents(binanceBalances: BinanceBalanceRow[]) {
  return Math.round(binanceBalances.reduce((sum, balance) => sum + balance.eurValue, 0) * 100);
}
