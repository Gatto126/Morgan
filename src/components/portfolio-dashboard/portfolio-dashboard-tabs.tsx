import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";

import { DashboardTopbarTab } from "@/components/finance-shell/dashboard-topbar-tab";
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
    <div className={cn("flex items-center gap-2", !isActive && "absolute pointer-events-none opacity-0 invisible")}>
      {tabs.map((tab) => {
        const isSelected = activeTab === tab.key;
        const value = formatEuroCents(
          activePoint
            ? Number(tab.key === "ALL" ? (activePoint.heritage ?? 0) : (activePoint[tab.key] ?? 0))
            : tab.total
        );

        return (
          <DashboardTopbarTab
            active={isSelected}
            icon={tab.key === "ALL" ? RootIcon : undefined}
            key={tab.key}
            label={tab.key === "ALL" ? undefined : getAbbreviatedLabel(tab.label)}
            onClick={() => onSelectTab(tab.key)}
            value={value}
          />
        );
      })}
    </div>,
    portalNode
  );
}
