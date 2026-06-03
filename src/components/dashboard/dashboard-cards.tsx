import type { Dispatch, RefObject, SetStateAction } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/shared/utils";

import { DashboardCheckingCards } from "./dashboard-checking-cards";
import { DashboardCryptoCards } from "./dashboard-crypto-cards";
import { DashboardInvestmentCards } from "./dashboard-investment-cards";
import type { CurrentValuationSnapshot } from "../finance-shell/current-valuations-store";
import type { DashboardChartPoint } from "./dashboard-chart-types";
import type { BinanceBalanceRow, DashboardData, TimeRange } from "./types";

type DashboardCardsProps = {
  cardsPortalNode: HTMLElement | null;
  isActive: boolean;
  contentVisible: boolean;
  data: DashboardData;
  timeRange: TimeRange;
  currentPoint: DashboardChartPoint | null;
  currentValuationSnapshot?: CurrentValuationSnapshot | null;
  investmentValuesKnown: boolean;
  livePrices: Record<string, number | null>;
  binanceBalances: BinanceBalanceRow[];
  isBinanceSyncing: boolean;
  filterSmallBinance: boolean;
  setFilterSmallBinance: Dispatch<SetStateAction<boolean>>;
  binanceListRef: RefObject<HTMLDivElement | null>;
};

export function DashboardCards({
  cardsPortalNode,
  isActive,
  contentVisible,
  data,
  timeRange,
  currentPoint,
  currentValuationSnapshot,
  investmentValuesKnown,
  livePrices,
  binanceBalances,
  isBinanceSyncing,
  filterSmallBinance,
  setFilterSmallBinance,
  binanceListRef
}: DashboardCardsProps) {
  if (!cardsPortalNode) {
    return null;
  }

  return createPortal(
    <div
      className={cn("grid gap-5 w-full pb-6 lg:pb-0", !isActive && "absolute pointer-events-none opacity-0 invisible")}
      style={{
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        alignItems: "start",
        opacity: contentVisible ? 1 : 0,
        transition: "none"
      }}
    >
      <DashboardCheckingCards
        currentPoint={currentPoint}
        data={data}
        timeRange={timeRange}
        valuesKnown={!!currentPoint}
      />
      <DashboardInvestmentCards
        currentPoint={currentPoint}
        currentValuationSnapshot={currentValuationSnapshot}
        valuesKnown={investmentValuesKnown}
        livePrices={livePrices}
        providers={data.providerSummaries}
      />
      <DashboardCryptoCards
        binanceBalances={binanceBalances}
        binanceListRef={binanceListRef}
        currentValuationSnapshot={currentValuationSnapshot}
        filterSmallBinance={filterSmallBinance}
        isBinanceSyncing={isBinanceSyncing}
        providers={data.providerSummaries}
        setFilterSmallBinance={setFilterSmallBinance}
      />
    </div>,
    cardsPortalNode
  );
}
