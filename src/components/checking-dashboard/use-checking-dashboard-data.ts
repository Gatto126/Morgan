import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchDashboardStageData,
  isDashboardStageDataCacheFresh,
  readDashboardStageDataCache
} from "@/components/finance-shell/dashboard-stage-data-cache";

import type { CheckingData } from "./types";

type UseCheckingDashboardDataOptions = {
  userId: string;
  transactionCount: number;
  isActive: boolean;
  shouldLoad: boolean;
};

export function useCheckingDashboardData({
  userId,
  transactionCount,
  isActive,
  shouldLoad
}: UseCheckingDashboardDataOptions) {
  const initialData = readDashboardStageDataCache("checking", userId, transactionCount);
  const [data, setData] = useState<CheckingData | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [importRefreshVersion, setImportRefreshVersion] = useState(0);
  const [newProviderKeys, setNewProviderKeys] = useState<Set<string>>(new Set());
  const knownProviderKeysRef = useRef<Set<string>>(new Set());
  const pendingImportRefreshRef = useRef(false);
  const lastRefreshTransactionCountRef = useRef(transactionCount);
  const hasLoadedRef = useRef(!!initialData);

  const fetchDashboard = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
    try {
      const payload = await fetchDashboardStageData("checking", userId, {
        fallbackErrorMessage: "Errore nel caricamento della pagina checking.",
        force,
        version: transactionCount
      });

      const currentKeys = new Set(payload.providers.map((provider) => provider.sourceInstitution));
      if (pendingImportRefreshRef.current) {
        const newKeys = new Set([...currentKeys].filter(key => !knownProviderKeysRef.current.has(key)));
        if (newKeys.size > 0) {
          setNewProviderKeys(newKeys);
          setTimeout(() => setNewProviderKeys(new Set()), 1000);
        }
      }
      knownProviderKeysRef.current = currentKeys;

      setData(payload);
      setError(null);
    } catch (fetchError: unknown) {
      setError(fetchError instanceof Error ? fetchError.message : "Errore nel caricamento.");
      setData(null);
    } finally {
      setLoading(false);
      if (pendingImportRefreshRef.current) {
        pendingImportRefreshRef.current = false;
        setDataVersion(version => version + 1);
        setImportRefreshVersion(version => version + 1);
      }
    }
  }, [transactionCount, userId]);
  const fetchDashboardIfStale = useCallback(() => {
    if (!isDashboardStageDataCacheFresh("checking", userId, transactionCount)) {
      void fetchDashboard({ force: true });
    }
  }, [fetchDashboard, transactionCount, userId]);

  useEffect(() => {
    if (!shouldLoad || hasLoadedRef.current) {
      return;
    }

    hasLoadedRef.current = true;
    void fetchDashboard();
  }, [fetchDashboard, shouldLoad]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    const initialLoad = window.setTimeout(() => {
      if (hasLoadedRef.current) {
        return;
      }
      hasLoadedRef.current = true;
      void fetchDashboard();
    }, 0);

    const interval = window.setInterval(() => {
      fetchDashboardIfStale();
    }, 60_000);

    function handleFocus() {
      fetchDashboardIfStale();
    }

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchDashboard, fetchDashboardIfStale, isActive]);

  useEffect(() => {
    if (!shouldLoad || loading || lastRefreshTransactionCountRef.current === transactionCount) {
      return;
    }

    lastRefreshTransactionCountRef.current = transactionCount;
    pendingImportRefreshRef.current = true;
    void fetchDashboard({ force: true });
  }, [transactionCount, shouldLoad, loading, fetchDashboard]);

  return {
    data,
    loading,
    error,
    dataVersion,
    importRefreshVersion,
    newProviderKeys
  };
}
