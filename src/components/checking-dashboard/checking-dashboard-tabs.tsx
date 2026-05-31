import { useMemo } from "react";
import { Landmark } from "lucide-react";

import { usePublishDashboardTopbar, type DashboardTopbarItem } from "@/components/finance-shell/dashboard-topbar-store";
import type { ChartPoint } from "@/types/chart";

import { formatEuroCents, getAbbreviatedLabel } from "./formatters";
import type { CheckingDashboardTab } from "./types";

type CheckingDashboardTabsProps = {
  tabs: CheckingDashboardTab[];
  activeTab: string;
  activePoint: ChartPoint | null;
  valuesKnown?: boolean;
  userId: string;
  onSelectTab: (tabKey: string) => void;
};

export function CheckingDashboardTabs({
  tabs,
  activeTab,
  activePoint,
  valuesKnown = true,
  userId,
  onSelectTab
}: CheckingDashboardTabsProps) {
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
          icon: tab.key === "ALL" ? Landmark : undefined,
          id: tab.key === "ALL" ? "checking" : `checking:${tab.key}`,
          label: tab.key === "ALL" ? undefined : getAbbreviatedLabel(tab.label),
          onClick: () => onSelectTab(tab.key),
          value
        };
      }),
    [activePoint, activeTab, onSelectTab, tabs, valuesKnown]
  );

  usePublishDashboardTopbar("checking", userId, items);

  return null;
}
