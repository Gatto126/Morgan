import { useEffect, useMemo } from "react";
import { ChartPie, Coins, Landmark, Wallet } from "lucide-react";
import {
  seedDashboardTopbarLayout,
  usePublishDashboardTopbar,
  type DashboardTopbarItem
} from "@/components/finance-shell/dashboard-topbar-store";
import { formatEuroCents } from "./formatters";
import type { AccountTab, DashboardData } from "./types";

type ActivePoint = Record<string, string | number | null | undefined>;

type DashboardTabsProps = {
  visibleTabs: { key: AccountTab; label: string }[];
  activeTab: AccountTab;
  activePoint: ActivePoint | null;
  data: DashboardData | null;
  userId: string;
  onActiveTabChange: (tab: AccountTab) => void;
  getGlobalInvestmentLiveTotal: () => number;
  getGlobalCryptoLiveTotal: () => number;
  getProviderInvestmentLiveTotal: (provider: DashboardData["providerSummaries"][number]) => number;
  getProviderCryptoLiveTotal: (provider: DashboardData["providerSummaries"][number]) => number;
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

export function DashboardTabs({
  visibleTabs,
  activeTab,
  activePoint,
  data,
  userId,
  onActiveTabChange,
  getGlobalInvestmentLiveTotal,
  getGlobalCryptoLiveTotal,
  getProviderInvestmentLiveTotal,
  getProviderCryptoLiveTotal
}: DashboardTabsProps) {
  const items = useMemo<DashboardTopbarItem[]>(
    () => visibleTabs.map((tab) => {
        const tabIsActive = activeTab === tab.key;
        const Icon = TAB_ICONS[tab.key];
        const isLiveMarketValue = tab.key === "heritage" || tab.key === "investment" || tab.key === "crypto";
        const value = data
          ? formatEuroCents(
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
            )
          : "--";

        return {
          active: tabIsActive,
          animateChanges: isLiveMarketValue && !activePoint,
          ariaLabel: `${tab.label} dashboard tab`,
          icon: Icon,
          id: tab.key,
          onClick: () => onActiveTabChange(tab.key),
          value
        };
      }),
    [
      activePoint,
      activeTab,
      data,
      getGlobalCryptoLiveTotal,
      getGlobalInvestmentLiveTotal,
      onActiveTabChange,
      visibleTabs
    ]
  );

  usePublishDashboardTopbar("dashboard", userId, items);

  useEffect(() => {
    if (!data) {
      return;
    }

    const checkingProviders = data.providerSummaries.filter((provider) => provider.checking.total !== 0);
    const checkingTotal = checkingProviders.reduce((sum, provider) => sum + provider.checking.total, 0);
    seedDashboardTopbarLayout("checking", userId, [
      {
        active: true,
        icon: Landmark,
        id: "checking",
        value: formatEuroCents(checkingTotal)
      },
      ...checkingProviders.map((provider) => ({
        active: false,
        id: `checking:${provider.sourceInstitution}`,
        label: getProviderTabLabel(provider.sourceInstitution),
        value: formatEuroCents(provider.checking.total)
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
        value: formatEuroCents(getGlobalInvestmentLiveTotal())
      },
      ...investmentProviders.map((provider) => ({
        active: false,
        animateChanges: true,
        id: `investment:${provider.sourceInstitution}`,
        label: getProviderTabLabel(provider.sourceInstitution),
        value: formatEuroCents(getProviderInvestmentLiveTotal(provider))
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
        value: formatEuroCents(getGlobalCryptoLiveTotal())
      },
      ...cryptoProviders.map((provider) => ({
        active: false,
        animateChanges: true,
        id: `crypto:${provider.sourceInstitution}`,
        label: getProviderTabLabel(provider.sourceInstitution),
        value: formatEuroCents(getProviderCryptoLiveTotal(provider))
      }))
    ]);
  }, [
    data,
    getGlobalCryptoLiveTotal,
    getGlobalInvestmentLiveTotal,
    getProviderCryptoLiveTotal,
    getProviderInvestmentLiveTotal,
    userId
  ]);

  return null;
}
