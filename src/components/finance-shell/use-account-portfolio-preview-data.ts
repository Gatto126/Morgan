"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { BinanceBalanceRow, DashboardData } from "@/components/dashboard/types";

import {
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

async function fetchProfilePreviewRecord(user: UserRecord, signal?: AbortSignal): Promise<AccountPortfolioPreviewRecord> {
  const shouldLoadDashboard = user.transactionCount > 0;
  const dashboardPromise = shouldLoadDashboard
    ? fetchDashboardStageData("dashboard", user.id, {
        fallbackErrorMessage: "Could not load portfolio preview.",
        signal,
        version: user.transactionCount
      })
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
      ? readDashboardStageDataCache("dashboard", user.id, user.transactionCount)
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
      || isDashboardStageDataCacheFresh("dashboard", user.id, user.transactionCount);
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
