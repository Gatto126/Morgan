import { useCallback, useEffect, useRef, useState } from "react";

import type { PortfolioData } from "./types";

type UsePortfolioDashboardDataOptions = {
  endpoint: string;
  fetchErrorMessage: string;
  userId: string;
  transactionCount: number;
  isActive: boolean;
  onImportRefreshComplete?: () => void;
};

export function usePortfolioDashboardData({
  endpoint,
  fetchErrorMessage,
  userId,
  transactionCount,
  isActive,
  onImportRefreshComplete
}: UsePortfolioDashboardDataOptions) {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [newProviderKeys, setNewProviderKeys] = useState<Set<string>>(new Set());
  const knownProviderKeysRef = useRef<Set<string>>(new Set());
  const pendingImportRefreshRef = useRef(false);
  const onImportRefreshCompleteRef = useRef(onImportRefreshComplete);
  const lastRefreshTransactionCountRef = useRef(transactionCount);

  useEffect(() => {
    onImportRefreshCompleteRef.current = onImportRefreshComplete;
  }, [onImportRefreshComplete]);

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
        requestAnimationFrame(() => requestAnimationFrame(() => {
          onImportRefreshCompleteRef.current?.();
        }));
      }
    }
  }, [endpoint, fetchErrorMessage, userId]);

  useEffect(() => {
    if (!isActive) {
      return;
    }

    void fetchDashboard();
    const interval = window.setInterval(() => { void fetchDashboard(); }, 60_000);
    const handleFocus = () => { void fetchDashboard(); };
    window.addEventListener("focus", handleFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchDashboard, isActive]);

  useEffect(() => {
    if (!isActive || loading || lastRefreshTransactionCountRef.current === transactionCount) {
      return;
    }

    lastRefreshTransactionCountRef.current = transactionCount;
    pendingImportRefreshRef.current = true;
    void fetchDashboard();
  }, [transactionCount, isActive, loading, fetchDashboard]);

  return {
    data,
    loading,
    error,
    dataVersion,
    newProviderKeys
  };
}
