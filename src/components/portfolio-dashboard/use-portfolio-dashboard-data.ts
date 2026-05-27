import { useCallback, useEffect, useRef, useState } from "react";

import type { PortfolioData } from "./types";

type UsePortfolioDashboardDataOptions = {
  endpoint: string;
  fetchErrorMessage: string;
  userId: string;
  transactionCount: number;
  isActive: boolean;
  shouldLoad: boolean;
};

export function usePortfolioDashboardData({
  endpoint,
  fetchErrorMessage,
  userId,
  transactionCount,
  isActive,
  shouldLoad
}: UsePortfolioDashboardDataOptions) {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [importRefreshVersion, setImportRefreshVersion] = useState(0);
  const [newProviderKeys, setNewProviderKeys] = useState<Set<string>>(new Set());
  const knownProviderKeysRef = useRef<Set<string>>(new Set());
  const pendingImportRefreshRef = useRef(false);
  const lastRefreshTransactionCountRef = useRef(transactionCount);
  const hasLoadedRef = useRef(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await fetch(`${endpoint}?userId=${userId}`, { cache: "no-store" });
      const payload = (await response.json()) as PortfolioData & { error?: string };
      if (!response.ok) throw new Error(payload.error ?? fetchErrorMessage);

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
  }, [endpoint, fetchErrorMessage, userId]);

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

    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      void fetchDashboard();
    }
    const interval = window.setInterval(() => { void fetchDashboard(); }, 60_000);
    const handleFocus = () => { void fetchDashboard(); };
    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchDashboard, isActive]);

  useEffect(() => {
    if (!shouldLoad || loading || lastRefreshTransactionCountRef.current === transactionCount) {
      return;
    }

    lastRefreshTransactionCountRef.current = transactionCount;
    pendingImportRefreshRef.current = true;
    void fetchDashboard();
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
