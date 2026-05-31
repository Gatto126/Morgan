import { Bitcoin, ChartPie, Coins, Landmark, Wallet } from "lucide-react";
import { useMemo } from "react";

import { DashboardTopbarTab } from "./dashboard-topbar-tab";
import { dashboardStageDataFreshTtlMs, readDashboardStageDataCache } from "./dashboard-stage-data-cache";
import {
  resolveVisibleDashboardStage,
  type DashboardStageKey
} from "./dashboard-stage-items";
import {
  readStoredDashboardTopbarItems,
  useDashboardTopbarEntry,
  type DashboardTopbarItem
} from "./dashboard-topbar-store";
import type { UserRecord } from "./types";
import type { Stage } from "./use-finance-navigation";

type DashboardTopbarShellProps = {
  activeUser: UserRecord | null;
  isDashboardStage: boolean;
  stage: Stage;
};

const fallbackIcons = {
  binance: Bitcoin,
  checking: Landmark,
  crypto: Coins,
  dashboard: ChartPie,
  investment: Wallet
} satisfies Record<DashboardStageKey, typeof ChartPie>;
const fallbackValue = "--";
const freshCacheOptions = { maxAgeMs: dashboardStageDataFreshTtlMs };
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

function getDashboardFallbackItems(activeUser: UserRecord, activeStage: DashboardStageKey): DashboardTopbarItem[] {
  if (activeStage === "dashboard") {
    const items: DashboardTopbarItem[] = [
      {
        active: true,
        ariaLabel: "HERITAGE dashboard tab",
        icon: ChartPie,
        id: "heritage",
        value: fallbackValue
      }
    ];

    if (activeUser.checkingCount > 0) {
      items.push({
        active: false,
        ariaLabel: "CHECKING dashboard tab",
        icon: Landmark,
        id: "checking",
        value: fallbackValue
      });
    }

    if (activeUser.investmentCount > 0) {
      items.push({
        active: false,
        ariaLabel: "INVESTMENT dashboard tab",
        icon: Wallet,
        id: "investment",
        value: fallbackValue
      });
    }

    if (activeUser.cryptoCount > 0 || activeUser.hasBinanceCredentials) {
      items.push({
        active: false,
        ariaLabel: "CRYPTO dashboard tab",
        icon: Coins,
        id: "crypto",
        value: fallbackValue
      });
    }

    return items;
  }

  if (activeStage === "binance") {
    return [{
      active: true,
    icon: Bitcoin,
    id: "binance",
    label: "BINANCE",
    value: fallbackValue
  }];
  }

  return [{
    active: true,
    icon: fallbackIcons[activeStage],
    id: activeStage,
    value: fallbackValue
  }];
}

function getCachedStageTopbarItems(activeUser: UserRecord, activeStage: DashboardStageKey): DashboardTopbarItem[] {
  if (activeStage === "checking") {
    const data = readDashboardStageDataCache("checking", activeUser.id, activeUser.checkingCount, freshCacheOptions);
    if (!data) {
      return [];
    }

    const total = data.providers.reduce((sum, provider) => sum + provider.total, 0);

    return [
      {
        active: true,
        icon: Landmark,
        id: "checking",
        value: formatEuroCents(total)
      },
      ...data.providers.map((provider) => ({
        active: false,
        id: `checking:${provider.sourceInstitution}`,
        label: getAbbreviatedLabel(provider.sourceInstitution),
        value: formatEuroCents(provider.total)
      }))
    ];
  }

  if (activeStage === "investment" || activeStage === "crypto") {
    const version = activeStage === "investment" ? activeUser.investmentCount : activeUser.cryptoCount;
    const data = readDashboardStageDataCache(activeStage, activeUser.id, version, freshCacheOptions);
    if (!data) {
      return [];
    }

    const total = data.providers.reduce((sum, provider) => sum + provider.total, 0);
    const RootIcon = activeStage === "investment" ? Wallet : Coins;

    return [
      {
        active: true,
        icon: RootIcon,
        id: activeStage,
        value: formatEuroCents(total)
      },
      ...data.providers.map((provider) => ({
        active: false,
        id: `${activeStage}:${provider.sourceInstitution}`,
        label: getAbbreviatedLabel(provider.sourceInstitution),
        value: formatEuroCents(provider.total)
      }))
    ];
  }

  return [];
}

function preferStableTopbarItems(
  entryItems: DashboardTopbarItem[],
  storedItems: DashboardTopbarItem[],
  cachedItems: DashboardTopbarItem[],
  fallbackItems: DashboardTopbarItem[]
) {
  const stableFallbackItems = cachedItems.length > fallbackItems.length
    ? cachedItems
    : fallbackItems;

  if (
    entryItems.length >= stableFallbackItems.length
    && entryItems.length > 0
  ) {
    return entryItems;
  }

  if (
    storedItems.length >= stableFallbackItems.length
    && storedItems.length > 0
  ) {
    return storedItems;
  }

  return stableFallbackItems;
}

function getFallbackIcon(activeStage: DashboardStageKey, item: DashboardTopbarItem) {
  if (item.icon || item.label) {
    return item.icon;
  }

  if (activeStage === "dashboard" && item.id in fallbackIcons) {
    return fallbackIcons[item.id as DashboardStageKey];
  }

  if (item.id === activeStage) {
    return fallbackIcons[activeStage];
  }

  return undefined;
}

export function DashboardTopbarShell({
  activeUser,
  isDashboardStage,
  stage
}: DashboardTopbarShellProps) {
  const activeStage = activeUser && isDashboardStage
    ? resolveVisibleDashboardStage(stage, activeUser)
    : null;
  const entry = useDashboardTopbarEntry(activeUser?.id ?? null, activeStage);
  const fallbackItems = useMemo(
    () => activeUser && activeStage ? getDashboardFallbackItems(activeUser, activeStage) : [],
    [activeStage, activeUser]
  );
  const cachedItems = useMemo(
    () => activeUser && activeStage ? getCachedStageTopbarItems(activeUser, activeStage) : [],
    [activeStage, activeUser]
  );
  const storedItems = useMemo(
    () => activeUser && activeStage
      ? readStoredDashboardTopbarItems(activeStage, activeUser.id, { placeholderValues: true })
      : [],
    [activeStage, activeUser]
  );

  const rawItems = preferStableTopbarItems(entry.items, storedItems, cachedItems, fallbackItems);
  const items = useMemo(
    () => activeStage
      ? rawItems.map((item) => ({
          ...item,
          icon: getFallbackIcon(activeStage, item)
        }))
      : rawItems,
    [activeStage, rawItems]
  );

  if (!activeUser || !isDashboardStage || items.length === 0) {
    return null;
  }

  return (
    <div className="dashboard-topbar-shell flex items-center gap-2">
      {items.map((item, index) => (
        <DashboardTopbarTab
          active={item.active}
          ariaLabel={item.ariaLabel}
          icon={item.icon}
          key={`topbar-slot-${index}`}
          label={item.label}
          onClick={item.onClick}
          suppressInitialChanges={item.suppressInitialChanges}
          value={item.value}
          animateChanges={item.animateChanges}
          valueIdentity={item.id}
        />
      ))}
    </div>
  );
}
