"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { BinanceBalanceRow, DashboardData } from "@/components/dashboard/types";
import { getUtcDateKey } from "@/shared/date-keys";
import { toDashboardPreviewData } from "@/shared/dashboard-preview-data";

import {
  dashboardStageDataFreshTtlMs,
  fetchDashboardStageData,
  isDashboardStageDataCacheFresh,
  readDashboardStageDataCache
} from "./dashboard-stage-data-cache";
import type { UserRecord } from "./types";

export type AccountPortfolioPreviewRecord = {
  binanceBalances: BinanceBalanceRow[];
  data: DashboardData | null;
  user: UserRecord;
};

type AccountPortfolioPreviewState = {
  error: string | null;
  loading: boolean;
  records: AccountPortfolioPreviewRecord[];
};

const emptyPreviewState: AccountPortfolioPreviewState = {
  error: null,
  loading: false,
  records: []
};

const loadingPreviewState: AccountPortfolioPreviewState = {
  error: null,
  loading: true,
  records: []
};

const previewCachePrefix = "morgan:account-portfolio-preview:v1:";
const previewCacheTtlMs = dashboardStageDataFreshTtlMs;
const previewStaleCacheTtlMs = 6 * 60 * 60 * 1_000;
const previewMemoryCache = new Map<string, { data: DashboardData; fetchedAt: number }>();

function getPreviewCacheKey(user: UserRecord) {
  return `${user.id}:${user.transactionCount}:${getUtcDateKey()}`;
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

function readStoredPreviewData(
  cacheKey: string,
  maxAgeMs: number
): { data: DashboardData; fetchedAt: number } | null {
  const storage = getSessionStorage();
  if (!storage) {
    return null;
  }

  const storageKey = `${previewCachePrefix}${cacheKey}`;
  const rawEntry = storage.getItem(storageKey);
  if (!rawEntry) {
    return null;
  }

  try {
    const entry = JSON.parse(rawEntry) as { data?: DashboardData; fetchedAt?: number };
    if (!entry.data || typeof entry.fetchedAt !== "number") {
      storage.removeItem(storageKey);
      return null;
    }

    if (Date.now() - entry.fetchedAt >= previewStaleCacheTtlMs) {
      storage.removeItem(storageKey);
      return null;
    }

    return Date.now() - entry.fetchedAt < maxAgeMs
      ? { data: entry.data, fetchedAt: entry.fetchedAt }
      : null;
  } catch {
    storage.removeItem(storageKey);
    return null;
  }
}

function writeStoredPreviewData(cacheKey: string, data: DashboardData, fetchedAt: number) {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(`${previewCachePrefix}${cacheKey}`, JSON.stringify({ data, fetchedAt }));
  } catch {
    // Session storage is best-effort. The in-memory cache still covers the current page.
  }
}

function readDashboardPreviewDataCache(user: UserRecord, maxAgeMs = previewStaleCacheTtlMs): DashboardData | null {
  const cacheKey = getPreviewCacheKey(user);
  const memoryEntry = previewMemoryCache.get(cacheKey);
  if (memoryEntry && Date.now() - memoryEntry.fetchedAt < maxAgeMs) {
    return memoryEntry.data;
  }

  const storedEntry = readStoredPreviewData(cacheKey, maxAgeMs);
  if (storedEntry) {
    previewMemoryCache.set(cacheKey, storedEntry);
    return storedEntry.data;
  }

  const fullDashboardData = readDashboardStageDataCache("dashboard", user.id, user.transactionCount, { maxAgeMs });
  return fullDashboardData ? toDashboardPreviewData(fullDashboardData) : null;
}

function seedDashboardPreviewDataCache(user: UserRecord, data: DashboardData, fetchedAt = Date.now()) {
  const cacheKey = getPreviewCacheKey(user);
  previewMemoryCache.set(cacheKey, { data, fetchedAt });
  writeStoredPreviewData(cacheKey, data, fetchedAt);
}

function isDashboardPreviewDataCacheFresh(user: UserRecord) {
  if (isDashboardStageDataCacheFresh("dashboard", user.id, user.transactionCount)) {
    return true;
  }

  return readDashboardPreviewDataCache(user, previewCacheTtlMs) !== null;
}

export async function fetchDashboardPreviewData(user: UserRecord, signal?: AbortSignal) {
  const cachedPreview = readDashboardPreviewDataCache(user, previewCacheTtlMs);
  if (cachedPreview) {
    return cachedPreview;
  }

  const params = new URLSearchParams({
    d: getUtcDateKey(),
    userId: user.id,
    v: String(user.transactionCount)
  });
  const response = await fetch(`/api/transactions/dashboard/preview?${params.toString()}`, {
    cache: "default",
    signal
  });
  const payload = await response.json().catch(() => ({})) as DashboardData & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? "Could not load portfolio preview.");
  }

  seedDashboardPreviewDataCache(user, payload);
  return payload;
}

async function fetchProfilePreviewRecord(user: UserRecord, signal?: AbortSignal): Promise<AccountPortfolioPreviewRecord> {
  const shouldLoadDashboard = user.transactionCount > 0;
  const dashboardPromise = shouldLoadDashboard
    ? fetchDashboardPreviewData(user, signal)
    : Promise.resolve(null);
  const binancePromise = user.hasBinanceCredentials
    ? fetchDashboardStageData("binance", user.id, {
        fallbackErrorMessage: "Could not load Binance balances.",
        signal
      })
    : Promise.resolve({ balances: [] });
  const [data, binancePayload] = await Promise.all([dashboardPromise, binancePromise]);

  return {
    binanceBalances: Array.isArray(binancePayload.balances) ? binancePayload.balances : [],
    data,
    user
  };
}

function shouldRequireCachedDashboard(user: UserRecord) {
  return user.transactionCount > 0;
}

function shouldRequireCachedBinance(user: UserRecord) {
  return user.hasBinanceCredentials;
}

export function readAccountPortfolioPreviewCache(users: UserRecord[]): AccountPortfolioPreviewRecord[] {
  const records: AccountPortfolioPreviewRecord[] = [];

  for (const user of users) {
    const data = shouldRequireCachedDashboard(user)
      ? readDashboardPreviewDataCache(user)
      : null;

    if (shouldRequireCachedDashboard(user) && !data) {
      return [];
    }

    const binancePayload = shouldRequireCachedBinance(user)
      ? readDashboardStageDataCache("binance", user.id)
      : { balances: [] };

    if (shouldRequireCachedBinance(user) && !binancePayload) {
      return [];
    }

    records.push({
      binanceBalances: Array.isArray(binancePayload?.balances) ? binancePayload.balances : [],
      data,
      user
    });
  }

  return records;
}

function isAccountPortfolioPreviewCacheFresh(users: UserRecord[]) {
  return users.every((user) => {
    const isDashboardFresh = !shouldRequireCachedDashboard(user)
      || isDashboardPreviewDataCacheFresh(user);
    const isBinanceFresh = !shouldRequireCachedBinance(user)
      || isDashboardStageDataCacheFresh("binance", user.id);

    return isDashboardFresh && isBinanceFresh;
  });
}

function getUsersKey(users: UserRecord[]) {
  return users
    .map((user) => [
      user.id,
      user.transactionCount,
      user.checkingCount,
      user.investmentCount,
      user.cryptoCount,
      user.hasBinanceCredentials ? "binance" : "no-binance"
    ].join(":"))
    .join("|");
}

export function useAccountPortfolioPreviewData({
  isActive,
  users
}: {
  isActive: boolean;
  users: UserRecord[];
}): AccountPortfolioPreviewState {
  const usersKey = useMemo(() => getUsersKey(users), [users]);
  const [state, setState] = useState<AccountPortfolioPreviewState>(loadingPreviewState);

  const fetchPreviewRecords = useCallback(async (previewUsers: UserRecord[], signal: AbortSignal) => {
    await Promise.resolve();
    if (signal.aborted) return;

    setState((currentState) => ({
      ...currentState,
      error: null,
      loading: true
    }));

    try {
      const records = await Promise.all(
        previewUsers.map((user) => fetchProfilePreviewRecord(user, signal))
      );

      if (signal.aborted) return;

      setState({ error: null, loading: false, records });
    } catch (error: unknown) {
      if (signal.aborted) return;

      setState((currentState) => ({
        error: error instanceof Error ? error.message : "Could not load portfolio preview.",
        loading: false,
        records: currentState.records
      }));
    }
  }, []);

  useEffect(() => {
    if (!isActive || users.length === 0) {
      return;
    }

    const controller = new AbortController();
    const loadTimer = window.setTimeout(() => {
      const cachedRecords = readAccountPortfolioPreviewCache(users);
      const hasCachedRecords = cachedRecords.length > 0;
      const isCachedDataFresh = hasCachedRecords && isAccountPortfolioPreviewCacheFresh(users);

      setState({
        error: null,
        loading: !isCachedDataFresh,
        records: cachedRecords
      });

      if (isCachedDataFresh) {
        return;
      }

      void fetchPreviewRecords(users, controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(loadTimer);
      controller.abort();
    };
  }, [fetchPreviewRecords, isActive, users, usersKey]);

  return isActive && users.length > 0 ? state : emptyPreviewState;
}
