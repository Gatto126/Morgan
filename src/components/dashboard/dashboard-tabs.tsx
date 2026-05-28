import { createPortal } from "react-dom";
import { ChartPie, Coins, Landmark, Wallet } from "lucide-react";
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

        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onActiveTabChange(tab.key)}
            data-active={tabIsActive ? "true" : "false"}
            className={`flex h-12 w-[165px] flex-shrink-0 cursor-pointer items-center justify-between rounded-[16px] border-2 px-3 text-[11px] font-extrabold uppercase tracking-[0.14em] transition-colors hover:bg-[color:var(--surface-elevated)] has-lucide ${
              tabIsActive
                ? "border-white bg-[color:var(--surface-panel)] text-white"
                : "border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-[color:var(--text-dim)]"
            }`}
          >
            <div className="flex items-center justify-center w-[28px] flex-shrink-0">
              <Icon className="h-4 w-4 flex-shrink-0" strokeWidth={2.2} />
            </div>
            <span className={`text-right tabular-nums whitespace-nowrap ${tabIsActive ? "" : "opacity-70"}`}>
              {formatEuroCents(
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
              )}
            </span>
          </button>
        );
      })}
    </div>,
    portalNode
  );
}
