import { createPortal } from "react-dom";
import { ChartPie, Coins, Landmark, Wallet } from "lucide-react";
import { DashboardTopbarTab } from "@/components/finance-shell/dashboard-topbar-tab";
import { cn } from "@/shared/utils";
import { formatEuroCents } from "./formatters";
import type { AccountTab, DashboardData } from "./types";

type ActivePoint = Record<string, string | number | null | undefined>;

type DashboardTabsProps = {
  portalNode: HTMLElement | null;
  isActive: boolean;
  contentVisible: boolean;
  visibleTabs: { key: AccountTab; label: string }[];
  activeTab: AccountTab;
  activePoint: ActivePoint | null;
  data: DashboardData;
  onActiveTabChange: (tab: AccountTab) => void;
  getGlobalInvestmentLiveTotal: () => number;
  getGlobalCryptoLiveTotal: () => number;
};

const TAB_ICONS = {
  heritage: ChartPie,
  checking: Landmark,
  investment: Wallet,
  crypto: Coins
};

export function DashboardTabs({
  portalNode,
  isActive,
  contentVisible,
  visibleTabs,
  activeTab,
  activePoint,
  data,
  onActiveTabChange,
  getGlobalInvestmentLiveTotal,
  getGlobalCryptoLiveTotal
}: DashboardTabsProps) {
  if (!portalNode) {
    return null;
  }

  return createPortal(
    <div
      className={cn("flex items-center gap-2 sm:gap-3", !isActive && "absolute pointer-events-none opacity-0 invisible")}
      style={{
        opacity: contentVisible ? 1 : 0,
        transform: contentVisible ? "none" : "translateY(6px)",
        transition: contentVisible ? "opacity 0.45s ease-out, transform 0.45s ease-out" : "none"
      }}
    >
      {visibleTabs.map((tab) => {
        const tabIsActive = activeTab === tab.key;
        const Icon = TAB_ICONS[tab.key];
        const value = formatEuroCents(
          activePoint
            ? (() => {
                const binancePoint = (activePoint.binance as number) || 0;
                if (tab.key === "crypto") {
                  return typeof activePoint.crypto === "number" ? activePoint.crypto : binancePoint;
                }
                if (tab.key === "heritage") {
                  return typeof activePoint.heritage === "number" ? activePoint.heritage : binancePoint;
                }
                return (activePoint[tab.key] as number) || 0;
              })()
            : (tab.key === "investment"
                ? getGlobalInvestmentLiveTotal()
                : tab.key === "crypto"
                  ? getGlobalCryptoLiveTotal()
                  : tab.key === "heritage"
                    ? data.accountTotals.checking + getGlobalInvestmentLiveTotal() + getGlobalCryptoLiveTotal()
                    : data.accountTotals[tab.key])
        );

        return (
          <DashboardTopbarTab
            active={tabIsActive}
            ariaLabel={`${tab.label} dashboard tab`}
            icon={Icon}
            key={tab.key}
            onClick={() => onActiveTabChange(tab.key)}
            value={value}
          />
        );
      })}
    </div>,
    portalNode
  );
}
