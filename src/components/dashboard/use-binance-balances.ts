import { useCallback, useEffect, useRef, useState } from "react";
import type { BinanceBalanceRow } from "./types";

type UseBinanceBalancesOptions = {
  userId: string;
  isActive: boolean;
  binanceRefreshKey: number;
};

export function useBinanceBalances({
  userId,
  isActive,
  binanceRefreshKey
}: UseBinanceBalancesOptions) {
  const [binanceBalances, setBinanceBalances] = useState<BinanceBalanceRow[]>([]);
  const [isBinanceNew, setIsBinanceNew] = useState(false);
  const [isBinanceSyncing, setIsBinanceSyncing] = useState(false);
  const [filterSmallBinance, setFilterSmallBinance] = useState(false);
  const prevBinanceCountRef = useRef(0);
  const binanceListRef = useRef<HTMLDivElement>(null);

  const loadBinanceBalances = useCallback(async () => {
    const response = await fetch(`/api/binance/balances?userId=${userId}`);
    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    if (Array.isArray(payload.balances)) {
      const wasEmpty = prevBinanceCountRef.current === 0;
      prevBinanceCountRef.current = payload.balances.length;
      setBinanceBalances(payload.balances);
      if (wasEmpty && payload.balances.length > 0) {
        setIsBinanceNew(true);
        setTimeout(() => setIsBinanceNew(false), 600);
      }
    }

    return payload as { isStale?: boolean; hasApiKey?: boolean };
  }, [userId]);

  const fetchBinanceBalances = useCallback(async (syncIfStale = true) => {
    try {
      const payload = await loadBinanceBalances();
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
          await loadBinanceBalances();
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
    if (!isActive) {
      return;
    }

    const initialLoad = window.setTimeout(() => {
      void fetchBinanceBalances(true);
    }, 0);
    const interval = window.setInterval(() => void fetchBinanceBalances(true), 600_000);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [fetchBinanceBalances, binanceRefreshKey, isActive]);

  return {
    binanceBalances,
    isBinanceNew,
    isBinanceSyncing,
    filterSmallBinance,
    setFilterSmallBinance,
    binanceListRef
  };
}
