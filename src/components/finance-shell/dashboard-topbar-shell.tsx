import { Bitcoin, ChartPie, Coins, Landmark, Wallet } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";

import { DashboardTopbarTab } from "./dashboard-topbar-tab";
import {
  resolveVisibleDashboardStage,
  type DashboardStageKey
} from "./dashboard-stage-items";
import { seedCurrentDashboardStageTopbars } from "./dashboard-topbar-current-values";
import { getCachedStageTopbarItems } from "./dashboard-topbar-cache";
import {
  readStoredDashboardTopbarItems,
  useDashboardTopbarEntry,
  type DashboardTopbarItem
} from "./dashboard-topbar-store";
import { hasDashboardStageTopbarData } from "./dashboard-topbar-visibility";
import type { UserRecord } from "./types";
import type { Stage } from "./use-finance-navigation";
import { LIVE_PRICES_UPDATED_EVENT } from "@/shared/live-prices";

type DashboardTopbarShellProps = {
  activeUser: UserRecord | null;
  binanceRefreshKey?: number;
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
const fallbackValue = "";

function getDashboardFallbackItems(activeUser: UserRecord, activeStage: DashboardStageKey): DashboardTopbarItem[] {
  if (activeStage === "dashboard") {
    if (!hasDashboardStageTopbarData(activeUser, activeStage)) {
      return [];
    }

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

function preferStableTopbarItems(
  entryItems: DashboardTopbarItem[],
  hydratedItems: DashboardTopbarItem[],
  fallbackItems: DashboardTopbarItem[]
) {
  const stableFallbackItems = hydratedItems.length > fallbackItems.length
    ? hydratedItems
    : fallbackItems;

  if (
    entryItems.length >= stableFallbackItems.length
    && entryItems.length > 0
  ) {
    return entryItems;
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
  binanceRefreshKey = 0,
  isDashboardStage,
  stage
}: DashboardTopbarShellProps) {
  const activeStage = activeUser && isDashboardStage
    ? resolveVisibleDashboardStage(stage, activeUser)
    : null;
  const hasTopbarData = activeUser && activeStage
    ? hasDashboardStageTopbarData(activeUser, activeStage)
    : false;
  const entry = useDashboardTopbarEntry(hasTopbarData ? activeUser?.id ?? null : null, hasTopbarData ? activeStage : null);
  const fallbackItems = useMemo(
    () => activeUser && activeStage && hasTopbarData ? getDashboardFallbackItems(activeUser, activeStage) : [],
    [activeStage, activeUser, hasTopbarData]
  );
  const [hydratedItems, setHydratedItems] = useState<DashboardTopbarItem[]>([]);

  useLayoutEffect(() => {
    if (!activeUser) {
      return;
    }

    seedCurrentDashboardStageTopbars(activeUser, binanceRefreshKey);
  }, [activeStage, activeUser, binanceRefreshKey]);

  useEffect(() => {
    if (!activeUser) {
      return;
    }

    const handleLivePricesUpdated = () => {
      seedCurrentDashboardStageTopbars(activeUser, binanceRefreshKey);
    };

    window.addEventListener(LIVE_PRICES_UPDATED_EVENT, handleLivePricesUpdated);
    return () => window.removeEventListener(LIVE_PRICES_UPDATED_EVENT, handleLivePricesUpdated);
  }, [activeUser, binanceRefreshKey]);

  useEffect(() => {
    let cancelled = false;

    if (!activeUser || !activeStage || !hasTopbarData) {
      const resetTimer = window.setTimeout(() => {
        if (!cancelled) {
          setHydratedItems([]);
        }
      }, 0);

      return () => {
        cancelled = true;
        window.clearTimeout(resetTimer);
      };
    }

    const hydrateTimer = window.setTimeout(() => {
      if (cancelled) {
        return;
      }

      const storedItems = readStoredDashboardTopbarItems(activeStage, activeUser.id, { placeholderValues: true });
      const cachedItems = getCachedStageTopbarItems(activeUser, activeStage);

      setHydratedItems(cachedItems.length > storedItems.length ? cachedItems : storedItems);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(hydrateTimer);
    };
  }, [activeStage, activeUser, hasTopbarData]);

  const rawItems = preferStableTopbarItems(entry.items, hydratedItems, fallbackItems);
  const items = useMemo(
    () => activeStage
      ? rawItems.map((item) => ({
          ...item,
          icon: getFallbackIcon(activeStage, item)
        }))
      : rawItems,
    [activeStage, rawItems]
  );

  if (!activeUser || !isDashboardStage || !hasTopbarData || items.length === 0) {
    return null;
  }

  return (
    <div className="dashboard-topbar-shell flex items-center gap-2">
      {items.map((item, index) => (
        <DashboardTopbarTab
          active={item.active}
          ariaLabel={item.ariaLabel}
          icon={item.icon}
          key={`${activeStage}:${item.id}:${index}`}
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
