"use client";

import { useEffect, useMemo, useState } from "react";
import { ChartPie } from "lucide-react";
import { Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

import { SelectableChartDot } from "@/components/chart-primitives/selectable-chart-dot";
import {
  buildDashboardChartData,
  collectCheckingProviders,
  collectCryptoInstitutions,
  collectCryptoTokens,
  collectInvestmentProducts
} from "@/components/dashboard/dashboard-chart-data-model";
import { DashboardLoadingSpinner } from "@/components/dashboard/dashboard-status";
import type { DashboardChartPoint } from "@/components/dashboard/dashboard-chart-types";
import { formatEuroCents } from "@/components/dashboard/formatters";
import type { BinanceBalanceRow } from "@/components/dashboard/types";
import { DashboardTopbarTab } from "@/components/finance-shell/dashboard-topbar-tab";
import { useStableChartFrame } from "@/hooks/use-stable-chart-frame";

import {
  selectCurrentValuationHeritageAggregate,
  useCurrentValuationSnapshotMap
} from "./current-valuations-store";
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
  binanceRefreshKey: number;
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

const FALLBACK_CHART_SIZE = { width: 520, height: 320 };
const WELCOME_HERITAGE_BODY = "Your Heritage value across all profiles, cash, ETF, stock and crypto positions.";
const WELCOME_BACKGROUND_GRID_LINES = [22, 42, 62, 82];

function WelcomeHeritageTooltip({ active, payload, setActivePoint }: HeritageTooltipProps) {
  useEffect(() => {
    setActivePoint(active ? payload?.[0]?.payload ?? null : null);
  }, [active, payload, setActivePoint]);

  return null;
}

export function WelcomeHeritagePreview({
  binanceRefreshKey,
  isActive,
  users = []
}: WelcomeHeritagePreviewProps) {
  const [activePoint, setActivePoint] = useState<DashboardChartPoint | null>(null);
  const { chartContainerRef, frameReady, renderedChartSize } = useStableChartFrame({
    fallbackSize: FALLBACK_CHART_SIZE
  });
  const shouldLoad = isActive && users.length > 0;
  const { records } = useAccountPortfolioPreviewData({
    isActive: shouldLoad,
    users
  });
  const profileIds = useMemo(() => users.map((user) => user.id), [users]);
  const snapshotsByProfileId = useCurrentValuationSnapshotMap(profileIds);
  const currentValuationAggregate = useMemo(
    () => selectCurrentValuationHeritageAggregate(users, snapshotsByProfileId, { binanceRefreshKey }),
    [binanceRefreshKey, snapshotsByProfileId, users]
  );
  const currentValuationPoint = currentValuationAggregate.point;
  const historicalChartData = useMemo(
    () => getAggregatedAccountChartData(records),
    [records]
  );
  const canRenderCommittedChart = currentValuationPoint !== null;
  const chartData = useMemo(
    () => canRenderCommittedChart
      ? mergeCurrentValuationPoint(historicalChartData, currentValuationPoint)
      : [],
    [canRenderCommittedChart, currentValuationPoint, historicalChartData]
  );
  const heritageValues = useMemo(
    () => chartData
      .map((point) => point.heritage)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value)),
    [chartData]
  );
  const xAxisTicks = useMemo(() => getWelcomeXAxisTicks(chartData), [chartData]);
  const activePointKey = String(activePoint?.rawMonth ?? activePoint?.month ?? "");
  const visibleActivePoint = activePointKey && chartData.some((point) => {
    return String(point.rawMonth ?? point.month ?? "") === activePointKey;
  })
    ? activePoint
    : null;
  const topbarValue = visibleActivePoint?.heritage ?? currentValuationPoint?.heritage ?? null;
  const yDomain = getWelcomeYDomain(heritageValues);
  const hasChartData = heritageValues.length > 0;
  const showChartLoader = !hasChartData;
  const xAxisLabels = useMemo(
    () => hasChartData ? xAxisTicks.map((tick) => formatWelcomeXAxisTick(tick)) : [],
    [hasChartData, xAxisTicks]
  );
  const topbarDisplayValue = typeof topbarValue === "number" && Number.isFinite(topbarValue)
    ? formatEuroCents(topbarValue)
    : "";

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[520px] flex-col justify-center">
      <div className="relative h-[360px]">
        <div className="hide-scrollbar absolute left-0 top-10 z-20 flex gap-2 overflow-x-auto px-1 pb-1 [&_.dashboard-topbar-currency-icon]:h-3.5 [&_.dashboard-topbar-currency-icon]:w-3.5 [&_.dashboard-topbar-line]:gap-2 [&_.dashboard-topbar-tab]:h-10 [&_.dashboard-topbar-tab]:w-[146px] [&_.dashboard-topbar-tab]:rounded-[14px] [&_.dashboard-topbar-tab]:px-2 sm:top-12 sm:[&_.dashboard-topbar-currency-icon]:h-4 sm:[&_.dashboard-topbar-currency-icon]:w-4 sm:[&_.dashboard-topbar-line]:gap-3 sm:[&_.dashboard-topbar-tab]:h-12 sm:[&_.dashboard-topbar-tab]:w-[178px] sm:[&_.dashboard-topbar-tab]:rounded-[16px] sm:[&_.dashboard-topbar-tab]:px-3">
          <DashboardTopbarTab
            active
            animateChanges={!!currentValuationPoint && !activePoint}
            ariaLabel={currentValuationPoint ? "Heritage preview" : "Heritage valuation loading"}
            icon={ChartPie}
            value={topbarDisplayValue}
          />
        </div>

        <div ref={chartContainerRef} className="absolute inset-x-0 top-0 h-[320px] overflow-visible">
          {showChartLoader ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-[84px] z-10 flex h-[170px] items-center justify-center"
            >
              <DashboardLoadingSpinner />
            </div>
          ) : null}
          <svg
            aria-hidden="true"
            className="absolute inset-0 h-full w-full overflow-visible"
            focusable="false"
            role="presentation"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {WELCOME_BACKGROUND_GRID_LINES.map((value) => (
              <line
                key={value}
                x1="5.4"
                x2="94.6"
                y1={value}
                y2={value}
                stroke="rgba(154,154,154,0.12)"
                strokeDasharray="3 3"
                strokeWidth="0.35"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
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
            <Tooltip
              content={<WelcomeHeritageTooltip setActivePoint={setActivePoint} />}
              cursor={{ stroke: "rgba(255,255,255,0.12)", strokeWidth: 1, fill: "transparent" }}
            />
            {frameReady && hasChartData ? (
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
          {WELCOME_HERITAGE_BODY}
        </p>
      </div>
    </div>
  );
}

function getWelcomeYDomain(values: number[]): [number, number] {
  if (values.length === 0) {
    return [0, 5];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const padding = Math.max(50_000, Math.round(range * 0.12));

  return [Math.max(0, min - padding), max + padding];
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
      binanceHistoricalPoints: record.data.binanceHistoricalPoints ?? [],
      hasBinancePortfolio: record.user.hasBinanceCredentials
        || binanceTotalCents > 0
        || (record.data.binanceHistoricalPoints?.length ?? 0) > 0,
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

function mergeCurrentValuationPoint(
  chartData: DashboardChartPoint[],
  currentPoint: DashboardChartPoint | null
) {
  if (!currentPoint || typeof currentPoint.heritage !== "number" || !Number.isFinite(currentPoint.heritage)) {
    return chartData;
  }

  const rawMonth = String(currentPoint.rawMonth ?? currentPoint.month ?? "");
  if (!rawMonth) {
    return chartData;
  }

  return [
    ...chartData.filter((point) => String(point.rawMonth ?? point.month ?? "") !== rawMonth),
    {
      ...currentPoint,
      heritage: currentPoint.heritage,
      month: rawMonth,
      rawMonth,
      value: currentPoint.heritage
    }
  ].sort((first, second) => String(first.rawMonth).localeCompare(String(second.rawMonth)));
}

function getBinanceTotalCents(binanceBalances: BinanceBalanceRow[]) {
  return Math.round(binanceBalances.reduce((sum, balance) => sum + balance.eurValue, 0) * 100);
}
