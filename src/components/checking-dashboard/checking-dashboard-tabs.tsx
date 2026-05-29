import { createPortal } from "react-dom";
import { Landmark } from "lucide-react";

import { DashboardTopbarTab } from "@/components/finance-shell/dashboard-topbar-tab";
import { cn } from "@/shared/utils";
import type { ChartPoint } from "@/types/chart";

import { formatEuroCents, getAbbreviatedLabel } from "./formatters";
import type { CheckingDashboardTab } from "./types";

type CheckingDashboardTabsProps = {
  portalNode: HTMLElement | null;
  tabs: CheckingDashboardTab[];
  activeTab: string;
  activePoint: ChartPoint | null;
  isActive: boolean;
  onSelectTab: (tabKey: string) => void;
};

export function CheckingDashboardTabs({
  portalNode,
  tabs,
  activeTab,
  activePoint,
  isActive,
  onSelectTab
}: CheckingDashboardTabsProps) {
  if (!portalNode) return null;

  return createPortal(
    <div className={cn("flex items-center gap-2 sm:gap-3", !isActive && "absolute pointer-events-none opacity-0 invisible")}>
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
            icon={tab.key === "ALL" ? Landmark : undefined}
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
