import { useLayoutEffect, useMemo } from "react";
import { ChartPie, Coins, Landmark, Wallet } from "lucide-react";
import {
  seedDashboardTopbarLayout,
  usePublishDashboardTopbar,
  type DashboardTopbarItem
} from "@/components/finance-shell/dashboard-topbar-store";
import { getDashboardPointValue, isDashboardPointValueReady } from "./dashboard-current-point";
import type { DashboardChartPoint } from "./dashboard-chart-types";
import { formatEuroCents } from "./formatters";
import type { AccountTab, DashboardData } from "./types";

type DashboardTabsProps = {
  visibleTabs: { key: AccountTab; label: string }[];
  activeTab: AccountTab;
  activePoint: DashboardChartPoint | null;
  seedPoint: DashboardChartPoint | null;
  data: DashboardData | null;
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

function getProviderTabLabel(sourceInstitution: string) {
  const upper = sourceInstitution.replace(/_/g, " ").trim().toUpperCase();
  const words = upper.split(/\s+/).filter(Boolean);

  if (words.length > 1) {
    return words.map((word) => word[0]).join("");
  }

  return upper;
}

function formatSeedPointValue(point: DashboardChartPoint | null, key: string, valuesKnown: boolean) {
  if (!valuesKnown || !point) {
    return "--";
  }

  const value = point[key];
  return typeof value === "number" ? formatEuroCents(value) : "--";
}

export function DashboardTabs({
  visibleTabs,
  activeTab,
  activePoint,
  seedPoint,
  data,
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
        const value = data && tabValuesKnown && pointValue !== null
          ? formatEuroCents(pointValue ?? 0)
          : "--";

        return {
          active: tabIsActive,
          animateChanges: isChartInteraction || tab.key !== "checking",
          ariaLabel: `${tab.label} dashboard tab`,
          icon: Icon,
          id: tab.key,
          onClick: () => onActiveTabChange(tab.key),
          suppressInitialChanges: !isChartInteraction,
          value
        };
      }),
    [
      activePoint,
      activeTab,
      cryptoValuesKnown,
      data,
      investmentValuesKnown,
      isTooltipActive,
      onActiveTabChange,
      valuesKnown,
      visibleTabs
    ]
  );

  usePublishDashboardTopbar("dashboard", userId, items, { transient: isTooltipActive });

  useLayoutEffect(() => {
    if (!data || !valuesKnown) {
      return;
    }

    const checkingProviders = data.providerSummaries.filter((provider) => provider.checking.total !== 0);
    seedDashboardTopbarLayout("checking", userId, [
      {
        active: true,
        icon: Landmark,
        id: "checking",
        value: formatSeedPointValue(seedPoint, "checking", true)
      },
      ...checkingProviders.map((provider) => ({
        active: false,
        id: `checking:${provider.sourceInstitution}`,
        label: getProviderTabLabel(provider.sourceInstitution),
        value: formatSeedPointValue(seedPoint, provider.sourceInstitution, true)
      }))
    ]);

    const investmentProviders = data.providerSummaries.filter(
      (provider) => provider.investmentProducts.length > 0
    );
    seedDashboardTopbarLayout("investment", userId, [
      {
        active: true,
        animateChanges: true,
        icon: Wallet,
        id: "investment",
        value: formatSeedPointValue(seedPoint, "investment", investmentValuesKnown)
      },
      ...investmentProviders.map((provider) => ({
        active: false,
        animateChanges: true,
        id: `investment:${provider.sourceInstitution}`,
        label: getProviderTabLabel(provider.sourceInstitution),
        value: formatSeedPointValue(seedPoint, `investment_inst_${provider.sourceInstitution}`, investmentValuesKnown)
      }))
    ]);

    const cryptoProviders = data.providerSummaries.filter(
      (provider) => provider.cryptoTokens.length > 0
    );
    seedDashboardTopbarLayout("crypto", userId, [
      {
        active: true,
        animateChanges: true,
        icon: Coins,
        id: "crypto",
        value: formatSeedPointValue(seedPoint, "crypto", cryptoValuesKnown)
      },
      ...cryptoProviders.map((provider) => ({
        active: false,
        animateChanges: true,
        id: `crypto:${provider.sourceInstitution}`,
        label: getProviderTabLabel(provider.sourceInstitution),
        value: formatSeedPointValue(seedPoint, `crypto_inst_${provider.sourceInstitution}`, cryptoValuesKnown)
      }))
    ]);
  }, [
    data,
    cryptoValuesKnown,
    investmentValuesKnown,
    seedPoint,
    valuesKnown,
    userId
  ]);

  return null;
}
