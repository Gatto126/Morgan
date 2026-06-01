import { Coins, Landmark, Wallet } from "lucide-react";

import { formatEuroCents } from "@/components/dashboard/formatters";

import {
  refreshCurrentValuationFromCaches,
  selectCurrentValuationTopbar,
  type CurrentValuationSnapshot,
  type CurrentValuationTopbarItem
} from "./current-valuations-store";
import { seedDashboardTopbarLayout, type DashboardTopbarItem } from "./dashboard-topbar-store";
import type { UserRecord } from "./types";

function getProviderTabLabel(sourceInstitution: string) {
  const upper = sourceInstitution.replace(/_/g, " ").trim().toUpperCase();
  const words = upper.split(/\s+/).filter(Boolean);

  return words.length > 1 ? words.map((word) => word[0]).join("") : upper;
}

function formatValuationValue(item: CurrentValuationTopbarItem) {
  return typeof item.value.cents === "number" && Number.isFinite(item.value.cents)
    ? formatEuroCents(item.value.cents)
    : "--";
}

function toProviderTopbarItems(
  items: CurrentValuationTopbarItem[],
  stage: "checking" | "investment" | "crypto"
): DashboardTopbarItem[] {
  return items.slice(1).map((item) => ({
    active: false,
    animateChanges: stage !== "checking",
    id: item.id,
    label: getProviderTabLabel(item.label ?? item.id.replace(`${stage}:`, "")),
    value: formatValuationValue(item)
  }));
}

function seedCheckingTopbar(user: UserRecord, snapshot: CurrentValuationSnapshot) {
  const items = selectCurrentValuationTopbar(snapshot, "checking");

  if (items.length === 0) {
    return;
  }

  seedDashboardTopbarLayout("checking", user.id, [
    {
      active: true,
      icon: Landmark,
      id: "checking",
      value: formatValuationValue(items[0])
    },
    ...toProviderTopbarItems(items, "checking")
  ]);
}

function seedInvestmentTopbar(user: UserRecord, snapshot: CurrentValuationSnapshot) {
  const items = selectCurrentValuationTopbar(snapshot, "investment");

  if (items.length === 0) {
    return;
  }

  seedDashboardTopbarLayout("investment", user.id, [
    {
      active: true,
      animateChanges: true,
      icon: Wallet,
      id: "investment",
      value: formatValuationValue(items[0])
    },
    ...toProviderTopbarItems(items, "investment")
  ]);
}

function seedCryptoTopbar(user: UserRecord, snapshot: CurrentValuationSnapshot) {
  const items = selectCurrentValuationTopbar(snapshot, "crypto");

  if (items.length === 0) {
    return;
  }

  seedDashboardTopbarLayout("crypto", user.id, [
    {
      active: true,
      animateChanges: true,
      icon: Coins,
      id: "crypto",
      value: formatValuationValue(items[0])
    },
    ...toProviderTopbarItems(items, "crypto")
  ]);
}

export function seedCurrentDashboardStageTopbars(user: UserRecord, binanceRefreshKey = 0) {
  const snapshot = refreshCurrentValuationFromCaches(user, { binanceRefreshKey });

  if (!snapshot) {
    return;
  }

  seedCheckingTopbar(user, snapshot);
  seedInvestmentTopbar(user, snapshot);
  seedCryptoTopbar(user, snapshot);
}
