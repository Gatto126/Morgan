import type { Dispatch, RefObject, SetStateAction } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/shared/utils";

import { DashboardCheckingCards } from "./dashboard-checking-cards";
import { DashboardCryptoCards } from "./dashboard-crypto-cards";
import { DashboardInvestmentCards } from "./dashboard-investment-cards";
import type { BinanceBalanceRow, DashboardData, ProviderSummary, TimeRange } from "./types";

type DashboardCardsProps = {
  cardsPortalNode: HTMLElement | null;
  isActive: boolean;
  contentVisible: boolean;
  data: DashboardData;
  timeRange: TimeRange;
  livePrices: Record<string, number | null>;
  binanceBalances: BinanceBalanceRow[];
  isBinanceSyncing: boolean;
  filterSmallBinance: boolean;
  setFilterSmallBinance: Dispatch<SetStateAction<boolean>>;
  binanceListRef: RefObject<HTMLDivElement | null>;
  getProviderInvestmentLiveTotal: (provider: ProviderSummary) => number;
  getProviderCryptoLiveTotal: (provider: ProviderSummary) => number;
};

export function DashboardCards({
  cardsPortalNode,
  isActive,
  contentVisible,
  data,
  timeRange,
  livePrices,
  binanceBalances,
  isBinanceSyncing,
  filterSmallBinance,
  setFilterSmallBinance,
  binanceListRef,
  getProviderInvestmentLiveTotal,
  getProviderCryptoLiveTotal
}: DashboardCardsProps) {
  if (!cardsPortalNode) {
    return null;
  }

  return createPortal(
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
      <DashboardCheckingCards data={data} timeRange={timeRange} />
      <DashboardInvestmentCards
        getProviderInvestmentLiveTotal={getProviderInvestmentLiveTotal}
        livePrices={livePrices}
        providers={data.providerSummaries}
      />
      <DashboardCryptoCards
        binanceBalances={binanceBalances}
        binanceListRef={binanceListRef}
        filterSmallBinance={filterSmallBinance}
        getProviderCryptoLiveTotal={getProviderCryptoLiveTotal}
        isBinanceSyncing={isBinanceSyncing}
        livePrices={livePrices}
        providers={data.providerSummaries}
        setFilterSmallBinance={setFilterSmallBinance}
      />
    </div>,
    cardsPortalNode
  );
}
