import { Bitcoin, ChartPie, Coins, Landmark, Wallet } from "lucide-react";
import { useMemo } from "react";

import { DashboardTopbarTab } from "./dashboard-topbar-tab";
import { getVisibleDashboardStageKeys, type DashboardStageKey } from "./dashboard-stage-items";
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

function resolveActiveDashboardStage(
  stage: Stage,
  visibleStageKeys: Set<DashboardStageKey>
): DashboardStageKey {
  const candidateStage = stage as DashboardStageKey;

  return visibleStageKeys.has(candidateStage) ? candidateStage : "dashboard";
}

function getDashboardFallbackItems(activeUser: UserRecord, activeStage: DashboardStageKey): DashboardTopbarItem[] {
  if (activeStage === "dashboard") {
    const items: DashboardTopbarItem[] = [
      {
        active: true,
        ariaLabel: "HERITAGE dashboard tab",
        icon: ChartPie,
        id: "heritage",
        value: "0,00 €"
      }
    ];

    if (activeUser.checkingCount > 0) {
      items.push({
        active: false,
        ariaLabel: "CHECKING dashboard tab",
        icon: Landmark,
        id: "checking",
        value: "0,00 €"
      });
    }

    if (activeUser.investmentCount > 0) {
      items.push({
        active: false,
        ariaLabel: "INVESTMENT dashboard tab",
        icon: Wallet,
        id: "investment",
        value: "0,00 €"
      });
    }

    if (activeUser.cryptoCount > 0 || activeUser.hasBinanceCredentials) {
      items.push({
        active: false,
        ariaLabel: "CRYPTO dashboard tab",
        icon: Coins,
        id: "crypto",
        value: "0,00 €"
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
    value: "0,00 €"
  }];
  }

  return [{
    active: true,
    icon: fallbackIcons[activeStage],
    id: activeStage,
    value: "0,00 €"
  }];
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
  const visibleStageKeys = useMemo(() => new Set(getVisibleDashboardStageKeys(activeUser)), [activeUser]);
  const activeStage = activeUser && isDashboardStage
    ? resolveActiveDashboardStage(stage, visibleStageKeys)
    : null;
  const entry = useDashboardTopbarEntry(activeUser?.id ?? null, activeStage);
  const fallbackItems = useMemo(
    () => activeUser && activeStage ? getDashboardFallbackItems(activeUser, activeStage) : [],
    [activeStage, activeUser]
  );
  const storedItems = useMemo(
    () => activeUser && activeStage
      ? readStoredDashboardTopbarItems(activeStage, activeUser.id)
      : [],
    [activeStage, activeUser]
  );

  const rawItems = entry.items.length > 0
    ? entry.items
    : storedItems.length > 0
      ? storedItems
      : fallbackItems;
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
