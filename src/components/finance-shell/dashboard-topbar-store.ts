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
};

type DashboardTopbarEntry = {
  items: DashboardTopbarItem[];
  updatedAt: number;
};

type StoredDashboardTopbarItem = Pick<DashboardTopbarItem, "active" | "animateChanges" | "ariaLabel" | "id" | "label" | "value">;

const listeners = new Set<() => void>();
const entries = new Map<string, DashboardTopbarEntry>();
const delayedTopbarPublishes = new Map<string, ReturnType<typeof globalThis.setTimeout>>();
const emptyEntry: DashboardTopbarEntry = {
  items: [],
  updatedAt: 0
};
const pendingTopbarValue = "--";
const storagePrefix = "morgan:dashboard-topbar:v1:";
const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

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
  return items.map(({ active, animateChanges, ariaLabel, id, label, value }) => ({
    active,
    animateChanges,
    ariaLabel,
    id,
    label,
    value
  }));
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
  entries.set(cacheKey, {
    items,
    updatedAt: Date.now()
  });
  writeStoredTopbarItems(cacheKey, items);
  emitTopbarChange();
}

function dropUnverifiedTopbar(cacheKey: string) {
  const hadEntry = entries.delete(cacheKey);
  removeStoredTopbarItems(cacheKey);

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

    return parsedItems
      .filter((item): item is StoredDashboardTopbarItem => typeof item.id === "string")
      .map((item) => {
        const storedValue = item.value && item.value !== "--" && item.value !== "-"
          ? item.value
          : pendingTopbarValue;

        return {
          active: !!item.active,
          animateChanges: !!item.animateChanges,
          ariaLabel: item.ariaLabel,
          id: item.id,
          label: item.label,
          suppressInitialChanges: true,
          value: placeholderValues ? "" : storedValue
        };
      });
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
  items: DashboardTopbarItem[]
) {
  const cacheKey = getEntryKey(userId, stage);

  if (items.length === 0) {
    clearDelayedTopbarPublish(cacheKey);
    commitDashboardTopbar(cacheKey, items);
    return;
  }

  const previousItems = entries.get(cacheKey)?.items ?? readStoredDashboardTopbarItems(stage, userId);
  if (shouldDropInitialZeroTopbarPublish(previousItems, items)) {
    clearDelayedTopbarPublish(cacheKey);
    dropUnverifiedTopbar(cacheKey);
    return;
  }

  if (shouldDropUnreadyTopbarPublish(previousItems, items)) {
    clearDelayedTopbarPublish(cacheKey);
    return;
  }

  clearDelayedTopbarPublish(cacheKey);
  commitDashboardTopbar(cacheKey, items);
}

export function seedDashboardTopbarLayout(
  stage: DashboardStageKey,
  userId: string,
  items: DashboardTopbarItem[]
) {
  if (items.length === 0) {
    return;
  }

  const cacheKey = getEntryKey(userId, stage);
  const previousEntry = entries.get(cacheKey);
  if (previousEntry) {
    if (shouldDropUnreadyTopbarPublish(previousEntry.items, items)) {
      return;
    }

    const previousById = new Map(previousEntry.items.map((item) => [item.id, item]));
    const nextIds = new Set(items.map((item) => item.id));
    const mergedItems = [
      ...items.map((item) => {
        const previousItem = previousById.get(item.id);

        return previousItem
          ? {
              ...item,
              active: previousItem.active,
              onClick: previousItem.onClick,
              suppressInitialChanges: previousItem.suppressInitialChanges ?? item.suppressInitialChanges
            }
          : item;
      }),
      ...previousEntry.items.filter((item) => !nextIds.has(item.id))
    ];

    entries.set(cacheKey, {
      items: mergedItems,
      updatedAt: Date.now()
    });
    writeStoredTopbarItems(cacheKey, mergedItems);
    emitTopbarChange();
    return;
  }

  writeStoredTopbarItems(cacheKey, items);
  entries.set(cacheKey, {
    items,
    updatedAt: Date.now()
  });
  emitTopbarChange();
}

export function clearDashboardTopbar(stage: DashboardStageKey, userId: string) {
  const cacheKey = getEntryKey(userId, stage);
  clearDelayedTopbarPublish(cacheKey);
  entries.delete(cacheKey);
  removeStoredTopbarItems(cacheKey);
  emitTopbarChange();
}

export function readDashboardTopbarItems(stage: DashboardStageKey, userId: string) {
  return entries.get(getEntryKey(userId, stage))?.items ?? [];
}

export function useDashboardTopbarEntry(userId: string | null, stage: DashboardStageKey | null) {
  return useSyncExternalStore(
    subscribeTopbar,
    () => userId && stage ? entries.get(getEntryKey(userId, stage)) ?? emptyEntry : emptyEntry,
    () => emptyEntry
  );
}

export function usePublishDashboardTopbar(
  stage: DashboardStageKey,
  userId: string,
  items: DashboardTopbarItem[]
) {
  useIsomorphicLayoutEffect(() => {
    publishDashboardTopbar(stage, userId, items);
  }, [items, stage, userId]);
}
