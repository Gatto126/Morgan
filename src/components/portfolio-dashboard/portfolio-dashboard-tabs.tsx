import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/shared/utils";
import type { ChartPoint } from "@/types/chart";

import { formatEuroCents, getAbbreviatedLabel } from "./formatters";
import type { PortfolioDashboardTab } from "./types";

type PortfolioDashboardTabsProps = {
  portalNode: HTMLElement | null;
  tabs: PortfolioDashboardTab[];
  activeTab: string;
  activePoint: ChartPoint | null;
  rootIcon: LucideIcon;
  isActive: boolean;
  onSelectTab: (tabKey: string) => void;
};

export function PortfolioDashboardTabs({
  portalNode,
  tabs,
  activeTab,
  activePoint,
  rootIcon: RootIcon,
  isActive,
  onSelectTab
}: PortfolioDashboardTabsProps) {
  if (!portalNode) return null;

  return createPortal(
    <div className={cn("flex items-center gap-2 sm:gap-3", !isActive && "absolute pointer-events-none opacity-0 invisible")}>
      {tabs.map((tab) => {
        const isSelected = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onSelectTab(tab.key)}
            data-active={isSelected ? "true" : "false"}
            className={`flex h-12 w-[165px] flex-shrink-0 cursor-pointer items-center justify-between rounded-[16px] border-2 px-3 text-[11px] font-extrabold uppercase tracking-[0.14em] transition-colors hover:bg-[color:var(--surface-elevated)] has-lucide ${
              isSelected
                ? "border-white bg-[color:var(--surface-panel)] text-white"
                : "border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-[color:var(--text-dim)]"
            }`}
          >
            <div className="flex items-center justify-center w-[28px] flex-shrink-0">
              {tab.key === "ALL" ? (
                <RootIcon className="h-4 w-4 flex-shrink-0" strokeWidth={2.2} />
              ) : (
                <span className="font-bold">{getAbbreviatedLabel(tab.label)}</span>
              )}
            </div>
            <span className={`text-right tabular-nums whitespace-nowrap ${isSelected ? "" : "opacity-70"}`}>
              {formatEuroCents(
                activePoint
                  ? Number(tab.key === "ALL" ? (activePoint.heritage ?? 0) : (activePoint[tab.key] ?? 0))
                  : tab.total
              )}
            </span>
          </button>
        );
      })}
    </div>,
    portalNode
  );
}
