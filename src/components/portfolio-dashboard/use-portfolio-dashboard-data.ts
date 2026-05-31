import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchDashboardStageData,
  isDashboardStageDataCacheFresh,
  readDashboardStageDataCache
} from "@/components/finance-shell/dashboard-stage-data-cache";

import type { PortfolioData } from "./types";

type UsePortfolioDashboardDataOptions = {
  endpoint: string;
  fetchErrorMessage: string;
  userId: string;
  transactionCount: number;
  isActive: boolean;
  shouldLoad: boolean;
};

function getPortfolioStageFromEndpoint(endpoint: string) {
  return endpoint.includes("/crypto") ? "crypto" : "investment";
}

export function usePortfolioDashboardData({
  endpoint,
  fetchErrorMessage,
  userId,
  transactionCount,
  isActive,
  shouldLoad
}: UsePortfolioDashboardDataOptions) {
  const stage = getPortfolioStageFromEndpoint(endpoint);
  const initialData = readDashboardStageDataCache(stage, userId, transactionCount);
  const [data, setData] = useState<PortfolioData | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [hasFreshData, setHasFreshData] = useState(!!initialData);
  const [freshDataVersion, setFreshDataVersion] = useState(transactionCount);
  const [importRefreshVersion, setImportRefreshVersion] = useState(0);
  const [newProviderKeys, setNewProviderKeys] = useState<Set<string>>(new Set());
  const knownProviderKeysRef = useRef<Set<string>>(new Set());
  const pendingImportRefreshRef = useRef(false);
  const lastRefreshTransactionCountRef = useRef(transactionCount);
  const hasLoadedRef = useRef(!!initialData);

  const fetchDashboard = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
    try {
      const payload = await fetchDashboardStageData(stage, userId, {
        fallbackErrorMessage: fetchErrorMessage,
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
      setHasFreshData(true);
      setFreshDataVersion(transactionCount);
      setError(null);
    } catch (fetchError: unknown) {
      setError(fetchError instanceof Error ? fetchError.message : "Errore nel caricamento.");
      setData((currentData) => currentData ?? null);
    } finally {
      setLoading(false);
      if (pendingImportRefreshRef.current) {
        pendingImportRefreshRef.current = false;
        setDataVersion(version => version + 1);
        setImportRefreshVersion(version => version + 1);
      }
    }
  }, [fetchErrorMessage, stage, transactionCount, userId]);
  const fetchDashboardIfStale = useCallback(() => {
    if (!isDashboardStageDataCacheFresh(stage, userId, transactionCount)) {
      void fetchDashboard({ force: true });
    }
  }, [fetchDashboard, stage, transactionCount, userId]);

  useEffect(() => {
    if (!shouldLoad || data) {
      return;
    }

    const cachedData = readDashboardStageDataCache(stage, userId, transactionCount);
    if (!cachedData) {
      return;
    }

    knownProviderKeysRef.current = new Set(cachedData.providers.map((provider) => provider.sourceInstitution));
    hasLoadedRef.current = true;
    const hydrateTimer = window.setTimeout(() => {
      setData(cachedData);
      setHasFreshData(true);
      setFreshDataVersion(transactionCount);
      setLoading(false);
      setError(null);
      fetchDashboardIfStale();
    }, 0);

    return () => window.clearTimeout(hydrateTimer);
  }, [data, fetchDashboardIfStale, shouldLoad, stage, transactionCount, userId]);

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
    } else {
      fetchDashboardIfStale();
    }
    const interval = window.setInterval(fetchDashboardIfStale, 60_000);
    const handleFocus = () => { fetchDashboardIfStale(); };
    window.addEventListener("focus", handleFocus);
    return () => {
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
    setHasFreshData(false);
    void fetchDashboard({ force: true });
  }, [transactionCount, shouldLoad, loading, fetchDashboard]);

  return {
    data,
    dataFresh: !!data && hasFreshData && freshDataVersion === transactionCount,
    loading,
    error,
    dataVersion,
    importRefreshVersion,
    newProviderKeys
  };
}
