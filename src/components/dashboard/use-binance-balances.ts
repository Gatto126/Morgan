import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchDashboardStageData,
  readDashboardStageDataCache
} from "@/components/finance-shell/dashboard-stage-data-cache";

import type { BinanceBalanceRow } from "./types";

type UseBinanceBalancesOptions = {
  userId: string;
  isActive: boolean;
  shouldLoad: boolean;
  binanceRefreshKey: number;
};

type BinanceBalancesPayload = {
  balances?: BinanceBalanceRow[];
  hasApiKey?: boolean;
  isStale?: boolean;
};

export function useBinanceBalances({
  userId,
  isActive,
  shouldLoad,
  binanceRefreshKey
}: UseBinanceBalancesOptions) {
  const [binanceBalances, setBinanceBalances] = useState<BinanceBalanceRow[]>([]);
  const [hasFreshBinanceBalances, setHasFreshBinanceBalances] = useState(false);
  const [freshBinanceRefreshKey, setFreshBinanceRefreshKey] = useState(binanceRefreshKey);
  const [isBinanceNew, setIsBinanceNew] = useState(false);
  const [isBinanceSyncing, setIsBinanceSyncing] = useState(false);
  const [filterSmallBinance, setFilterSmallBinance] = useState(true);
  const prevBinanceCountRef = useRef(0);
  const binanceListRef = useRef<HTMLDivElement>(null);
  const lastPreloadKeyRef = useRef("");

  const applyBinancePayload = useCallback((payload: BinanceBalancesPayload) => {
    if (Array.isArray(payload.balances)) {
      const wasEmpty = prevBinanceCountRef.current === 0;
      prevBinanceCountRef.current = payload.balances.length;
      setBinanceBalances(payload.balances);
      if (wasEmpty && payload.balances.length > 0) {
        setIsBinanceNew(true);
        setTimeout(() => setIsBinanceNew(false), 600);
      }
    }
    setHasFreshBinanceBalances(true);
    setFreshBinanceRefreshKey(binanceRefreshKey);
  }, [binanceRefreshKey]);

  const loadBinanceBalances = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
    const payload = await fetchDashboardStageData("binance", userId, {
      force,
      version: binanceRefreshKey
    }).catch(() => null);

    if (!payload) return null;

    applyBinancePayload(payload);

    return payload as { isStale?: boolean; hasApiKey?: boolean };
  }, [applyBinancePayload, binanceRefreshKey, userId]);

  const fetchBinanceBalances = useCallback(async (syncIfStale = true) => {
    try {
      const payload = await loadBinanceBalances({ force: syncIfStale });
      if (!payload) {
        return;
      }

      if (syncIfStale && payload.isStale && payload.hasApiKey) {
        setIsBinanceSyncing(true);
        try {
          await fetch("/api/binance/sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId })
          });
          await loadBinanceBalances({ force: true });
        } catch {
          // Sync failures leave the last cached Binance balances visible.
        } finally {
          setIsBinanceSyncing(false);
        }
      }
    } catch {
      // Network errors leave the current Binance state untouched.
    }
  }, [loadBinanceBalances, userId]);

  useEffect(() => {
    const cachedPayload = readDashboardStageDataCache("binance", userId, binanceRefreshKey);

    if (cachedPayload) {
      const hydrateTimer = window.setTimeout(() => {
        applyBinancePayload(cachedPayload);
      }, 0);

      return () => window.clearTimeout(hydrateTimer);
    }
  }, [applyBinancePayload, binanceRefreshKey, userId]);

  useEffect(() => {
    if (!shouldLoad) {
      return;
    }

    const preloadKey = `${userId}:${binanceRefreshKey}`;
    if (lastPreloadKeyRef.current === preloadKey) {
      return;
    }

    lastPreloadKeyRef.current = preloadKey;
    void fetchBinanceBalances(true);
  }, [fetchBinanceBalances, binanceRefreshKey, shouldLoad, userId]);

  useEffect(() => {
    if (!isActive && !shouldLoad) {
      return;
    }

    const interval = window.setInterval(() => void fetchBinanceBalances(true), 600_000);
    const handleFocus = () => void fetchBinanceBalances(true);

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchBinanceBalances, binanceRefreshKey, isActive, shouldLoad]);

  return {
    binanceBalances,
    binanceBalancesKnown:
      hasFreshBinanceBalances
      && freshBinanceRefreshKey === binanceRefreshKey,
    isBinanceNew,
    isBinanceSyncing,
    filterSmallBinance,
    setFilterSmallBinance,
    binanceListRef
  };
}
