import { useMemo } from "react";
import type { LucideIcon } from "lucide-react";

import { usePublishDashboardTopbar, type DashboardTopbarItem } from "@/components/finance-shell/dashboard-topbar-store";
import type { ChartPoint } from "@/types/chart";

import { formatEuroCents, getAbbreviatedLabel } from "./formatters";
import type { PortfolioDashboardTab } from "./types";

type PortfolioDashboardTabsProps = {
  tabs: PortfolioDashboardTab[];
  activeTab: string;
  activePoint: ChartPoint | null;
  isTooltipActive?: boolean;
  rootIcon: LucideIcon;
  valuesKnown?: boolean;
  stage: "crypto" | "investment";
  userId: string;
  onSelectTab: (tabKey: string) => void;
};

export function PortfolioDashboardTabs({
  tabs,
  activeTab,
  activePoint,
  isTooltipActive = !!activePoint,
  rootIcon: RootIcon,
  valuesKnown = true,
  stage,
  userId,
  onSelectTab
}: PortfolioDashboardTabsProps) {
  const items = useMemo<DashboardTopbarItem[]>(
    () => tabs.map((tab) => {
        const isSelected = activeTab === tab.key;
        const value = valuesKnown
          ? formatEuroCents(
              activePoint
                ? Number(tab.key === "ALL" ? (activePoint.heritage ?? 0) : (activePoint[tab.key] ?? 0))
                : tab.total
            )
          : "--";

        return {
          active: isSelected,
          animateChanges: true,
          icon: tab.key === "ALL" ? RootIcon : undefined,
          id: tab.key === "ALL" ? stage : `${stage}:${tab.key}`,
          label: tab.key === "ALL" ? undefined : getAbbreviatedLabel(tab.label),
          onClick: () => onSelectTab(tab.key),
          suppressInitialChanges: !isTooltipActive,
          value
        };
      }),
    [RootIcon, activePoint, activeTab, isTooltipActive, onSelectTab, stage, tabs, valuesKnown]
  );

  usePublishDashboardTopbar(stage, userId, items);

  return null;
}
