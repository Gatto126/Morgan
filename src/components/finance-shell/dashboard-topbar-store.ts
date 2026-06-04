"use client";

import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import type { LucideIcon } from "lucide-react";

import type { DashboardStageKey } from "./dashboard-stage-items";

export type DashboardTopbarItem = {
  active: boolean;
  animateChanges?: boolean;
  ariaLabel?: string;
  icon?: LucideIcon;
  id: string;
  label?: string;
  onClick?: () => void;
  suppressInitialChanges?: boolean;
  value: string;
  valuePending?: boolean;
};

type DashboardTopbarEntry = {
  items: DashboardTopbarItem[];
  updatedAt: number;
};

type PublishDashboardTopbarOptions = {
  transient?: boolean;
  uiOnly?: boolean;
};

type StoredDashboardTopbarItem = Pick<DashboardTopbarItem, "active" | "animateChanges" | "ariaLabel" | "id" | "label"> & {
  value?: string;
};

const listeners = new Set<() => void>();
const entries = new Map<string, DashboardTopbarEntry>();
const transientEntries = new Map<string, DashboardTopbarEntry>();
const delayedTopbarPublishes = new Map<string, ReturnType<typeof globalThis.setTimeout>>();
const emptyEntry: DashboardTopbarEntry = {
  items: [],
  updatedAt: 0
};
const pendingTopbarValue = "--";
const storagePrefix = "morgan:dashboard-topbar:v2:";
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const stageRootOrder: Partial<Record<DashboardStageKey, string[]>> = {
  binance: ["binance"],
  checking: ["checking"],
  crypto: ["crypto"],
  dashboard: ["heritage", "checking", "investment", "crypto"],
  investment: ["investment"]
};
const providerOrder: Record<string, number> = {
  bbva: 0,
  trade_republic: 1,
  binance: 2
};

function getEntryKey(userId: string, stage: DashboardStageKey) {
  return `${userId}:${stage}`;
}

function emitTopbarChange() {
  listeners.forEach((listener) => listener());
}

function getSessionStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function serializeItems(items: DashboardTopbarItem[]): StoredDashboardTopbarItem[] {
  return items.map(({ active, animateChanges, ariaLabel, id, label }) => ({
    active,
    animateChanges,
    ariaLabel,
    id,
    label
  }));
}

function normalizeProviderKey(stage: DashboardStageKey, item: DashboardTopbarItem) {
  const stagePrefix = `${stage}:`;
  const identity = item.id.startsWith(stagePrefix)
    ? item.id.slice(stagePrefix.length)
    : item.id;

  return identity
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function getItemSortLabel(stage: DashboardStageKey, item: DashboardTopbarItem) {
  return (item.label ?? normalizeProviderKey(stage, item))
    .trim()
    .toLowerCase();
}

function normalizeDashboardTopbarItems(
  stage: DashboardStageKey,
  items: DashboardTopbarItem[]
) {
  const roots = stageRootOrder[stage] ?? [];

  return items
    .map((item, index) => ({
      index,
      item,
      providerKey: normalizeProviderKey(stage, item),
      rootIndex: roots.indexOf(item.id)
    }))
    .sort((left, right) => {
      const leftIsRoot = left.rootIndex !== -1;
      const rightIsRoot = right.rootIndex !== -1;

      if (leftIsRoot || rightIsRoot) {
        if (leftIsRoot && rightIsRoot) {
          return left.rootIndex - right.rootIndex;
        }

        return leftIsRoot ? -1 : 1;
      }

      const providerRankDelta =
        (providerOrder[left.providerKey] ?? Number.POSITIVE_INFINITY)
        - (providerOrder[right.providerKey] ?? Number.POSITIVE_INFINITY);

      if (providerRankDelta !== 0) {
        return providerRankDelta;
      }

      const labelDelta = getItemSortLabel(stage, left.item).localeCompare(getItemSortLabel(stage, right.item));
      return labelDelta !== 0 ? labelDelta : left.index - right.index;
    })
    .map(({ item }) => item);
}

function writeStoredTopbarItems(cacheKey: string, items: DashboardTopbarItem[]) {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  try {
    if (items.length === 0) {
      storage.removeItem(`${storagePrefix}${cacheKey}`);
      return;
    }

    storage.setItem(`${storagePrefix}${cacheKey}`, JSON.stringify(serializeItems(items)));
  } catch {
    // Persistent layout is best-effort; the in-memory store still covers same-page navigation.
  }
}

function removeStoredTopbarItems(cacheKey: string) {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(`${storagePrefix}${cacheKey}`);
  } catch {
    // Clearing persisted layout is best-effort.
  }
}

function getNumericAmounts(value: string) {
  const normalizedValue = value
    .replace(/\u00a0/g, " ")
    .replace(/[^\d.,+-]+/g, " ");

  return normalizedValue.match(/[+-]?\d+(?:\.\d{3})*(?:,\d+)?|[+-]?\d+(?:\.\d+)?/g) ?? [];
}

function parseTopbarAmount(amount: string) {
  if (amount.includes(",")) {
    return Number(amount.replace(/\./g, "").replace(",", "."));
  }

  return Number(amount);
}

function hasNonZeroTopbarValue(value: string) {
  return getNumericAmounts(value).some((amount) => parseTopbarAmount(amount) !== 0);
}

function isPendingTopbarValue(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue === "" || trimmedValue === pendingTopbarValue || trimmedValue.includes(pendingTopbarValue);
}

function getEffectiveTopbarValuePending(item: DashboardTopbarItem) {
  return isPendingTopbarValue(item.value) && (item.valuePending ?? true);
}

function isZeroOnlyTopbarValue(value: string) {
  const amounts = getNumericAmounts(value);

  return amounts.length > 0 && amounts.every((amount) => parseTopbarAmount(amount) === 0);
}

function hasSameTopbarIdentity(previousItems: DashboardTopbarItem[], nextItems: DashboardTopbarItem[]) {
  return previousItems.length === nextItems.length
    && previousItems.every((item, index) => item.id === nextItems[index]?.id);
}

function shouldDropUnreadyTopbarPublish(
  previousItems: DashboardTopbarItem[],
  nextItems: DashboardTopbarItem[]
) {
  if (
    previousItems.length === 0
    || nextItems.length === 0
    || !hasSameTopbarIdentity(previousItems, nextItems)
    || !previousItems.some((item) => hasNonZeroTopbarValue(item.value))
  ) {
    return false;
  }

  return !nextItems.some((item) => hasNonZeroTopbarValue(item.value))
    && nextItems.every((item) => isPendingTopbarValue(item.value) || isZeroOnlyTopbarValue(item.value));
}

function shouldDropInitialZeroTopbarPublish(
  previousItems: DashboardTopbarItem[],
  nextItems: DashboardTopbarItem[]
) {
  return !previousItems.some((item) => hasNonZeroTopbarValue(item.value))
    && nextItems.length > 0
    && nextItems.every((item) => isZeroOnlyTopbarValue(item.value));
}

function clearDelayedTopbarPublish(cacheKey: string) {
  const delayedPublish = delayedTopbarPublishes.get(cacheKey);
  if (delayedPublish) {
    globalThis.clearTimeout(delayedPublish);
    delayedTopbarPublishes.delete(cacheKey);
  }
}

function commitDashboardTopbar(cacheKey: string, items: DashboardTopbarItem[]) {
  transientEntries.delete(cacheKey);
  entries.set(cacheKey, {
    items,
    updatedAt: Date.now()
  });
  writeStoredTopbarItems(cacheKey, items);
  emitTopbarChange();
}

function publishTransientDashboardTopbar(cacheKey: string, items: DashboardTopbarItem[]) {
  clearDelayedTopbarPublish(cacheKey);
  transientEntries.set(cacheKey, {
    items,
    updatedAt: Date.now()
  });
  emitTopbarChange();
}

function mergeTopbarUiState(
  stage: DashboardStageKey,
  previousItems: DashboardTopbarItem[],
  nextItems: DashboardTopbarItem[]
) {
  const previousById = new Map(previousItems.map((item) => [item.id, item]));

  return normalizeDashboardTopbarItems(
    stage,
    nextItems.map((item) => {
      const previousItem = previousById.get(item.id);
      const value = previousItem?.value ?? pendingTopbarValue;

      return {
        ...item,
        suppressInitialChanges: previousItem?.suppressInitialChanges ?? item.suppressInitialChanges,
        value,
        valuePending: previousItem ? getEffectiveTopbarValuePending(previousItem) : true
      };
    })
  );
}

function publishDashboardTopbarUiState(
  stage: DashboardStageKey,
  cacheKey: string,
  items: DashboardTopbarItem[]
) {
  const previousItems = entries.get(cacheKey)?.items ?? [];
  const mergedItems = mergeTopbarUiState(stage, previousItems, items);

  clearDelayedTopbarPublish(cacheKey);
  transientEntries.delete(cacheKey);
  entries.set(cacheKey, {
    items: mergedItems,
    updatedAt: Date.now()
  });
  writeStoredTopbarItems(cacheKey, mergedItems);
  emitTopbarChange();
}

export function clearTransientDashboardTopbar(stage: DashboardStageKey, userId: string) {
  const cacheKey = getEntryKey(userId, stage);
  const hadEntry = transientEntries.delete(cacheKey);

  if (hadEntry) {
    emitTopbarChange();
  }
}

function dropUnverifiedTopbar(cacheKey: string) {
  const hadEntry = entries.delete(cacheKey);

  if (hadEntry) {
    emitTopbarChange();
  }
}

export function readStoredDashboardTopbarItems(
  stage: DashboardStageKey,
  userId: string,
  { placeholderValues = false }: { placeholderValues?: boolean } = {}
): DashboardTopbarItem[] {
  const storage = getSessionStorage();
  if (!storage) {
    return [];
  }

  try {
    const rawItems = storage.getItem(`${storagePrefix}${getEntryKey(userId, stage)}`);
    if (!rawItems) {
      return [];
    }

    const parsedItems = JSON.parse(rawItems) as Partial<StoredDashboardTopbarItem>[];
    if (!Array.isArray(parsedItems)) {
      return [];
    }

    const items = parsedItems
      .filter((item): item is StoredDashboardTopbarItem => typeof item.id === "string")
      .map((item) => {
        const topbarItem: DashboardTopbarItem = {
          active: !!item.active,
          animateChanges: !!item.animateChanges,
          ariaLabel: item.ariaLabel,
          id: item.id,
          label: item.label,
          suppressInitialChanges: true,
          value: placeholderValues ? "" : pendingTopbarValue
        };

        if (placeholderValues) {
          topbarItem.valuePending = true;
        }

        return topbarItem;
      });

    return normalizeDashboardTopbarItems(stage, items);
  } catch {
    return [];
  }
}

function subscribeTopbar(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function publishDashboardTopbar(
  stage: DashboardStageKey,
  userId: string,
  items: DashboardTopbarItem[],
  { transient = false, uiOnly = false }: PublishDashboardTopbarOptions = {}
) {
  const cacheKey = getEntryKey(userId, stage);
  const normalizedItems = normalizeDashboardTopbarItems(stage, items);

  if (transient) {
    publishTransientDashboardTopbar(cacheKey, normalizedItems);
    return;
  }

  if (uiOnly) {
    publishDashboardTopbarUiState(stage, cacheKey, normalizedItems);
    return;
  }

  const hadTransientEntry = transientEntries.delete(cacheKey);

  if (normalizedItems.length === 0) {
    clearDelayedTopbarPublish(cacheKey);
    commitDashboardTopbar(cacheKey, normalizedItems);
    return;
  }

  const previousItems = entries.get(cacheKey)?.items ?? [];
  if (shouldDropInitialZeroTopbarPublish(previousItems, normalizedItems)) {
    clearDelayedTopbarPublish(cacheKey);
    dropUnverifiedTopbar(cacheKey);
    if (hadTransientEntry) {
      emitTopbarChange();
    }
    return;
  }

  if (shouldDropUnreadyTopbarPublish(previousItems, normalizedItems)) {
    clearDelayedTopbarPublish(cacheKey);
    if (hadTransientEntry) {
      emitTopbarChange();
    }
    return;
  }

  clearDelayedTopbarPublish(cacheKey);
  commitDashboardTopbar(cacheKey, normalizedItems);
}

export function seedDashboardTopbarLayout(
  stage: DashboardStageKey,
  userId: string,
  items: DashboardTopbarItem[]
) {
  const normalizedItems = normalizeDashboardTopbarItems(stage, items);

  if (normalizedItems.length === 0) {
    return;
  }

  const cacheKey = getEntryKey(userId, stage);
  const previousEntry = entries.get(cacheKey);
  if (previousEntry) {
    if (shouldDropUnreadyTopbarPublish(previousEntry.items, normalizedItems)) {
      return;
    }

    const previousById = new Map(previousEntry.items.map((item) => [item.id, item]));
    const mergedItems = normalizedItems.map((item) => {
      const previousItem = previousById.get(item.id);

      return previousItem
        ? {
            ...item,
            active: previousItem.active,
            onClick: previousItem.onClick,
            suppressInitialChanges: previousItem.suppressInitialChanges ?? item.suppressInitialChanges
          }
        : item;
    });
    const normalizedMergedItems = normalizeDashboardTopbarItems(stage, mergedItems);

    entries.set(cacheKey, {
      items: normalizedMergedItems,
      updatedAt: Date.now()
    });
    writeStoredTopbarItems(cacheKey, normalizedMergedItems);
    emitTopbarChange();
    return;
  }

  writeStoredTopbarItems(cacheKey, normalizedItems);
  entries.set(cacheKey, {
    items: normalizedItems,
    updatedAt: Date.now()
  });
  emitTopbarChange();
}

export function clearDashboardTopbar(stage: DashboardStageKey, userId: string) {
  const cacheKey = getEntryKey(userId, stage);
  clearDelayedTopbarPublish(cacheKey);
  entries.delete(cacheKey);
  transientEntries.delete(cacheKey);
  removeStoredTopbarItems(cacheKey);
  emitTopbarChange();
}

export function clearDashboardTopbarsForProfile(userId: string) {
  const stages: DashboardStageKey[] = ["binance", "checking", "crypto", "dashboard", "investment"];

  stages.forEach((stage) => {
    const cacheKey = getEntryKey(userId, stage);
    clearDelayedTopbarPublish(cacheKey);
    entries.delete(cacheKey);
    transientEntries.delete(cacheKey);
    removeStoredTopbarItems(cacheKey);
  });
  emitTopbarChange();
}

export function readDashboardTopbarItems(stage: DashboardStageKey, userId: string) {
  const cacheKey = getEntryKey(userId, stage);

  return transientEntries.get(cacheKey)?.items ?? entries.get(cacheKey)?.items ?? [];
}

export function useDashboardTopbarEntry(userId: string | null, stage: DashboardStageKey | null) {
  return useSyncExternalStore(
    subscribeTopbar,
    () => {
      if (!userId || !stage) {
        return emptyEntry;
      }

      const cacheKey = getEntryKey(userId, stage);
      return transientEntries.get(cacheKey) ?? entries.get(cacheKey) ?? emptyEntry;
    },
    () => emptyEntry
  );
}

export function usePublishDashboardTopbar(
  stage: DashboardStageKey,
  userId: string,
  items: DashboardTopbarItem[],
  options: PublishDashboardTopbarOptions = {}
) {
  const transient = !!options.transient;
  const uiOnly = !!options.uiOnly;

  useIsomorphicLayoutEffect(() => {
    publishDashboardTopbar(stage, userId, items, { transient, uiOnly });

    return () => {
      if (transient) {
        clearTransientDashboardTopbar(stage, userId);
      }
    };
  }, [items, stage, transient, uiOnly, userId]);
}
