"use client";

import { useEffect, useState } from "react";
import { ChartPie } from "lucide-react";
import { Line, LineChart as RechartsLineChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";

import { SelectableChartDot } from "@/components/chart-primitives/selectable-chart-dot";
import { DashboardTopbarTab } from "@/components/finance-shell/dashboard-topbar-tab";
import { useStableChartFrame } from "@/hooks/use-stable-chart-frame";

type PortfolioPreviewRawPoint = {
  rawMonth: string;
  value: number;
};

type PortfolioPreviewPoint = Record<string, string | number> & PortfolioPreviewRawPoint & {
  monthIndex: number;
};

type PortfolioPreviewActiveDotProps = {
  cx?: number;
  cy?: number;
  payload?: PortfolioPreviewPoint;
};

type PortfolioPreviewTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: PortfolioPreviewPoint }>;
  setActivePoint: (point: PortfolioPreviewPoint | null) => void;
};

type PortfolioPreviewChartProps = {
  ariaLabel?: string;
  body?: string;
  title?: string;
};

const portfolioPreviewRawData: PortfolioPreviewRawPoint[] = [
  { rawMonth: "2025-06-01", value: 482400 },
  { rawMonth: "2025-06-05", value: 480900 },
  { rawMonth: "2025-06-08", value: 511200 },
  { rawMonth: "2025-06-11", value: 494600 },
  { rawMonth: "2025-06-17", value: 498100 },
  { rawMonth: "2025-06-24", value: 488900 },
  { rawMonth: "2025-07-01", value: 487600 },
  { rawMonth: "2025-07-05", value: 476500 },
  { rawMonth: "2025-07-10", value: 491300 },
  { rawMonth: "2025-07-15", value: 519800 },
  { rawMonth: "2025-07-20", value: 513200 },
  { rawMonth: "2025-07-24", value: 552600 },
  { rawMonth: "2025-07-29", value: 548900 },
  { rawMonth: "2025-08-03", value: 597600 },
  { rawMonth: "2025-08-08", value: 609800 },
  { rawMonth: "2025-08-14", value: 607900 },
  { rawMonth: "2025-08-20", value: 601500 },
  { rawMonth: "2025-08-26", value: 589400 },
  { rawMonth: "2025-09-01", value: 627300 },
  { rawMonth: "2025-09-08", value: 625700 },
  { rawMonth: "2025-09-15", value: 626400 },
  { rawMonth: "2025-09-22", value: 620800 },
  { rawMonth: "2025-09-27", value: 582600 },
  { rawMonth: "2025-10-02", value: 606100 },
  { rawMonth: "2025-10-08", value: 601700 },
  { rawMonth: "2025-10-14", value: 638900 },
  { rawMonth: "2025-10-21", value: 640600 },
  { rawMonth: "2025-10-29", value: 644800 },
  { rawMonth: "2025-11-04", value: 684200 },
  { rawMonth: "2025-11-11", value: 678600 },
  { rawMonth: "2025-11-18", value: 662800 },
  { rawMonth: "2025-11-24", value: 664900 },
  { rawMonth: "2025-12-01", value: 671700 },
  { rawMonth: "2025-12-07", value: 688400 },
  { rawMonth: "2025-12-11", value: 711600 },
  { rawMonth: "2025-12-18", value: 713200 },
  { rawMonth: "2025-12-25", value: 722500 },
  { rawMonth: "2026-01-03", value: 722900 },
  { rawMonth: "2026-01-09", value: 759400 },
  { rawMonth: "2026-01-12", value: 743800 },
  { rawMonth: "2026-01-16", value: 774600 },
  { rawMonth: "2026-01-22", value: 776800 },
  { rawMonth: "2026-01-29", value: 775200 },
  { rawMonth: "2026-02-04", value: 781400 },
  { rawMonth: "2026-02-12", value: 783600 },
  { rawMonth: "2026-02-18", value: 720700 },
  { rawMonth: "2026-02-26", value: 721500 },
  { rawMonth: "2026-03-05", value: 719900 },
  { rawMonth: "2026-03-12", value: 728400 },
  { rawMonth: "2026-03-19", value: 744600 },
  { rawMonth: "2026-03-26", value: 742700 },
  { rawMonth: "2026-04-02", value: 746100 },
  { rawMonth: "2026-04-10", value: 748400 },
  { rawMonth: "2026-04-16", value: 771900 },
  { rawMonth: "2026-04-21", value: 774700 },
  { rawMonth: "2026-04-24", value: 756600 },
  { rawMonth: "2026-04-26", value: 768200 },
  { rawMonth: "2026-04-30", value: 781100 },
  { rawMonth: "2026-05-03", value: 782800 },
  { rawMonth: "2026-05-07", value: 794600 },
  { rawMonth: "2026-05-10", value: 790400 },
  { rawMonth: "2026-05-14", value: 799300 },
  { rawMonth: "2026-05-18", value: 802100 },
  { rawMonth: "2026-05-22", value: 797900 },
  { rawMonth: "2026-05-26", value: 806800 },
  { rawMonth: "2026-05-30", value: 801420 }
];

const portfolioPreviewData: PortfolioPreviewPoint[] = portfolioPreviewRawData.map((point) => ({
  ...point,
  monthIndex: getPortfolioPreviewMonthIndex(point.rawMonth)
}));

const portfolioPreviewXAxisLabels = [
  "Jun 25",
  "Jul 25",
  "Aug 25",
  "Sep 25",
  "Oct 25",
  "Nov 25",
  "Dec 25",
  "Jan 26",
  "Feb 26",
  "Mar 26",
  "Apr 26",
  "May 26"
];
const portfolioPreviewXAxisTicks = [0, 2, 4, 6, 8, 10, 11.9];
const portfolioPreviewYGridLines = [500000, 600000, 700000, 800000];
const portfolioPreviewFallbackChartSize = { width: 460, height: 290 };
const portfolioPreviewEuroFormatter = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export const portfolioPreviewDefaultBody =
  "Aggregate cash, ETF, stock and crypto wallet values into one portfolio timeline.";

function formatPortfolioPreviewEuroCents(value: number) {
  return portfolioPreviewEuroFormatter.format(value / 100);
}

function getPortfolioPreviewMonthIndex(label: string) {
  const [year, month, day] = label.split("-").map(Number);
  const zeroBasedMonth = month - 1;
  const monthOffset = (year - 2025) * 12 + zeroBasedMonth - 5;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const dayOffset = (day - 1) / daysInMonth;

  return monthOffset + dayOffset;
}

function formatPortfolioPreviewDateTick(value?: number | string) {
  const monthIndex = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(monthIndex)) return "";

  const safeMonthIndex = Math.min(portfolioPreviewXAxisLabels.length - 1, Math.round(monthIndex));

  return portfolioPreviewXAxisLabels[safeMonthIndex] ?? "";
}

function PortfolioPreviewSilentTooltip({
  active,
  payload,
  setActivePoint
}: PortfolioPreviewTooltipProps) {
  useEffect(() => {
    setActivePoint(active ? payload?.[0]?.payload ?? null : null);
  }, [active, payload, setActivePoint]);

  return null;
}

export function PortfolioPreviewChart({
  ariaLabel = "Preview Heritage",
  body = portfolioPreviewDefaultBody,
  title = "Portfolio"
}: PortfolioPreviewChartProps) {
  const [activePoint, setActivePoint] = useState<PortfolioPreviewPoint | null>(null);
  const latestPoint = portfolioPreviewData[portfolioPreviewData.length - 1];
  const topbarPoint = activePoint ?? latestPoint;
  const { chartContainerRef, renderedChartSize, seriesReady } = useStableChartFrame({
    fallbackSize: portfolioPreviewFallbackChartSize
  });

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[460px] flex-col justify-center">
      <div className="relative h-[310px] sm:h-[325px] lg:h-[340px]">
        <div className="hide-scrollbar absolute left-0 top-10 z-20 flex gap-2 overflow-x-auto px-1 pb-1 [&_.dashboard-topbar-currency-icon]:h-3.5 [&_.dashboard-topbar-currency-icon]:w-3.5 [&_.dashboard-topbar-line]:gap-2 [&_.dashboard-topbar-tab]:h-10 [&_.dashboard-topbar-tab]:w-[146px] [&_.dashboard-topbar-tab]:rounded-[14px] [&_.dashboard-topbar-tab]:px-2 sm:top-12 sm:[&_.dashboard-topbar-currency-icon]:h-4 sm:[&_.dashboard-topbar-currency-icon]:w-4 sm:[&_.dashboard-topbar-line]:gap-3 sm:[&_.dashboard-topbar-tab]:h-12 sm:[&_.dashboard-topbar-tab]:w-[178px] sm:[&_.dashboard-topbar-tab]:rounded-[16px] sm:[&_.dashboard-topbar-tab]:px-3">
          <DashboardTopbarTab
            active
            ariaLabel={ariaLabel}
            icon={ChartPie}
            value={formatPortfolioPreviewEuroCents(topbarPoint.value)}
          />
        </div>

        <div ref={chartContainerRef} className="absolute inset-x-0 top-0 h-[310px] overflow-visible sm:h-[340px] lg:h-[360px]">
          <RechartsLineChart
            accessibilityLayer={false}
            data={portfolioPreviewData}
            height={renderedChartSize.height}
            margin={{ top: 8, right: 14, bottom: 26, left: 14 }}
            style={{ outline: "none", overflow: "visible" }}
            width={renderedChartSize.width}
          >
            <XAxis
              allowDecimals={false}
              axisLine={false}
              dataKey="monthIndex"
              domain={[0, 12]}
              dy={10}
              interval={0}
              minTickGap={0}
              tick={{ fill: "#666666", fontSize: 10 }}
              tickFormatter={formatPortfolioPreviewDateTick}
              tickLine={false}
              ticks={portfolioPreviewXAxisTicks}
              type="number"
            />
            <YAxis
              axisLine={false}
              domain={[450000, 830000]}
              tick={false}
              tickLine={false}
              width={0}
            />
            {portfolioPreviewYGridLines.map((value) => (
              <ReferenceLine
                ifOverflow="extendDomain"
                key={value}
                stroke="rgba(154,154,154,0.12)"
                strokeDasharray="3 3"
                y={value}
              />
            ))}
            <Tooltip
              content={<PortfolioPreviewSilentTooltip setActivePoint={setActivePoint} />}
              cursor={{ stroke: "rgba(255,255,255,0.12)", strokeWidth: 1, fill: "transparent" }}
            />
            {seriesReady ? (
              <Line
                activeDot={(props: PortfolioPreviewActiveDotProps) => (
                  <SelectableChartDot
                    color="#ffffff"
                    cx={props.cx}
                    cy={props.cy}
                    onSelectPoint={() => undefined}
                    payload={props.payload}
                    seriesKey="value"
                  />
                )}
                connectNulls={false}
                dataKey="value"
                dot={false}
                isAnimationActive={false}
                name="value"
                stroke="#ffffff"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                type="linear"
              />
            ) : null}
          </RechartsLineChart>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold uppercase tracking-normal text-white sm:text-3xl">
          {title}
        </h2>
        <p className="max-w-[430px] text-sm font-medium leading-relaxed text-[color:var(--text-dim)]">
          {body}
        </p>
      </div>
    </div>
  );
}
