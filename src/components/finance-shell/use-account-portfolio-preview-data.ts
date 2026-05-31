"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { BinanceBalanceRow, DashboardData } from "@/components/dashboard/types";

import { fetchDashboardStageData } from "./dashboard-stage-data-cache";
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

async function fetchProfilePreviewRecord(user: UserRecord): Promise<AccountPortfolioPreviewRecord> {
  const shouldLoadDashboard = user.transactionCount > 0;
  const dashboardPromise = shouldLoadDashboard
    ? fetchDashboardStageData("dashboard", user.id, {
        fallbackErrorMessage: "Could not load portfolio preview.",
        version: user.transactionCount
      })
    : Promise.resolve(null);
  const binancePromise = user.hasBinanceCredentials
    ? fetchDashboardStageData("binance", user.id, {
        fallbackErrorMessage: "Could not load Binance balances."
      })
    : Promise.resolve({ balances: [] });
  const [data, binancePayload] = await Promise.all([dashboardPromise, binancePromise]);

  return {
    binanceBalances: Array.isArray(binancePayload.balances) ? binancePayload.balances : [],
    data,
    user
  };
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
        previewUsers.map((user) => fetchProfilePreviewRecord(user))
      );

      if (signal.aborted) return;

      setState({ error: null, loading: false, records });
    } catch (error: unknown) {
      if (signal.aborted) return;

      setState({
        error: error instanceof Error ? error.message : "Could not load portfolio preview.",
        loading: false,
        records: []
      });
    }
  }, []);

  useEffect(() => {
    if (!isActive || users.length === 0) {
      return;
    }

    const controller = new AbortController();
    const loadTimer = window.setTimeout(() => {
      void fetchPreviewRecords(users, controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(loadTimer);
      controller.abort();
    };
  }, [fetchPreviewRecords, isActive, users, usersKey]);

  return isActive && users.length > 0 ? state : emptyPreviewState;
}
