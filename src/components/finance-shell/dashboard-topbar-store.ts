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
  if (!storage || items.length === 0) {
    return;
  }

  try {
    storage.setItem(`${storagePrefix}${cacheKey}`, JSON.stringify(serializeItems(items)));
  } catch {
    // Persistent layout is best-effort; the in-memory store still covers same-page navigation.
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
          value: placeholderValues ? pendingTopbarValue : storedValue
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
  entries.set(getEntryKey(userId, stage), {
    items,
    updatedAt: Date.now()
  });
  writeStoredTopbarItems(getEntryKey(userId, stage), items);
  emitTopbarChange();
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
  writeStoredTopbarItems(cacheKey, items);

  if (entries.has(cacheKey)) {
    return;
  }

  entries.set(cacheKey, {
    items,
    updatedAt: Date.now()
  });
  emitTopbarChange();
}

export function clearDashboardTopbar(stage: DashboardStageKey, userId: string) {
  entries.delete(getEntryKey(userId, stage));
  emitTopbarChange();
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
