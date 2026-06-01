import { Coins, Landmark, Wallet } from "lucide-react";

import { readDashboardStageDataCache } from "./dashboard-stage-data-cache";
import type { DashboardStageKey } from "./dashboard-stage-items";
import type { DashboardTopbarItem } from "./dashboard-topbar-store";
import type { UserRecord } from "./types";

const fallbackValue = "--";
const euroFormatter = new Intl.NumberFormat("it-IT", {
  currency: "EUR",
  minimumFractionDigits: 2,
  style: "currency"
});

function formatEuroCents(cents: number) {
  return euroFormatter.format(cents / 100);
}

function getAbbreviatedLabel(label: string) {
  const upper = label.replace(/_/g, " ").trim().toUpperCase();
  const words = upper.split(/\s+/).filter(Boolean);

  return words.length > 1 ? words.map((word) => word[0]).join("") : upper;
}

function getCachedProviders<TProvider>(data: { providers?: TProvider[] } | null) {
  return Array.isArray(data?.providers) ? data.providers : null;
}

export function getCachedStageTopbarItems(activeUser: UserRecord, activeStage: DashboardStageKey): DashboardTopbarItem[] {
  if (activeStage === "checking") {
    const data = readDashboardStageDataCache("checking", activeUser.id, activeUser.checkingCount);
    const providers = getCachedProviders(data);
    if (!providers || providers.length === 0) {
      return [];
    }

    const total = providers.reduce((sum, provider) => sum + provider.total, 0);

    return [
      {
        active: true,
        icon: Landmark,
        id: "checking",
        value: formatEuroCents(total)
      },
      ...providers.map((provider) => ({
        active: false,
        id: `checking:${provider.sourceInstitution}`,
        label: getAbbreviatedLabel(provider.sourceInstitution),
        value: formatEuroCents(provider.total)
      }))
    ];
  }

  if (activeStage === "investment" || activeStage === "crypto") {
    const version = activeStage === "investment" ? activeUser.investmentCount : activeUser.cryptoCount;
    const data = readDashboardStageDataCache(activeStage, activeUser.id, version);
    const providers = getCachedProviders(data);
    if (!providers || providers.length === 0) {
      return [];
    }

    const RootIcon = activeStage === "investment" ? Wallet : Coins;

    return [
      {
        active: true,
        icon: RootIcon,
        id: activeStage,
        value: fallbackValue
      },
      ...providers.map((provider) => ({
        active: false,
        id: `${activeStage}:${provider.sourceInstitution}`,
        label: getAbbreviatedLabel(provider.sourceInstitution),
        value: fallbackValue
      }))
    ];
  }

  return [];
}
