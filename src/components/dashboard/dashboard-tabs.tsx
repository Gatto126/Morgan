import { useMemo } from "react";
import { ChartPie, Coins, Landmark, Wallet } from "lucide-react";
import {
  usePublishDashboardTopbar,
  type DashboardTopbarItem
} from "@/components/finance-shell/dashboard-topbar-store";
import { getDashboardPointValue, isDashboardPointValueReady } from "./dashboard-current-point";
import type { DashboardChartPoint } from "./dashboard-chart-types";
import { formatEuroCents } from "./formatters";
import type { AccountTab } from "./types";

type DashboardTabsProps = {
  visibleTabs: { key: AccountTab; label: string }[];
  activeTab: AccountTab;
  activePoint: DashboardChartPoint | null;
  cryptoValuesKnown?: boolean;
  investmentValuesKnown?: boolean;
  isTooltipActive?: boolean;
  valuesKnown: boolean;
  userId: string;
  onActiveTabChange: (tab: AccountTab) => void;
};

const TAB_ICONS = {
  heritage: ChartPie,
  checking: Landmark,
  investment: Wallet,
  crypto: Coins
};

export function DashboardTabs({
  visibleTabs,
  activeTab,
  activePoint,
  cryptoValuesKnown = true,
  investmentValuesKnown = true,
  isTooltipActive = !!activePoint,
  valuesKnown,
  userId,
  onActiveTabChange
}: DashboardTabsProps) {
  const items = useMemo<DashboardTopbarItem[]>(
    () => visibleTabs.map((tab) => {
        const tabIsActive = activeTab === tab.key;
        const Icon = TAB_ICONS[tab.key];
        const isChartInteraction = isTooltipActive;
        const tabValuesKnown = isDashboardPointValueReady({
          cryptoValuesKnown,
          investmentValuesKnown,
          isTooltipActive: isChartInteraction,
          tabKey: tab.key,
          valuesKnown
        });
        const pointValue = getDashboardPointValue(activePoint, tab.key);
        const hasPointValue = tabValuesKnown && pointValue !== null;
        const value = hasPointValue ? formatEuroCents(pointValue) : "";

        return {
          active: tabIsActive,
          animateChanges: isChartInteraction || tab.key !== "checking",
          ariaLabel: `${tab.label} dashboard tab`,
          icon: Icon,
          id: tab.key,
          onClick: () => onActiveTabChange(tab.key),
          suppressInitialChanges: !isChartInteraction,
          value,
          valuePending: !isChartInteraction && !hasPointValue
        };
      }),
    [
      activePoint,
      activeTab,
      cryptoValuesKnown,
      investmentValuesKnown,
      isTooltipActive,
      onActiveTabChange,
      valuesKnown,
      visibleTabs
    ]
  );

  usePublishDashboardTopbar("dashboard", userId, items, {
    transient: isTooltipActive,
    uiOnly: !isTooltipActive
  });

  return null;
}
