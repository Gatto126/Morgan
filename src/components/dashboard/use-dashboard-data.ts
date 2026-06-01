import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchDashboardStageData,
  isDashboardStageDataCacheFresh,
  readDashboardStageDataCache
} from "@/components/finance-shell/dashboard-stage-data-cache";

import type { DashboardData } from "./types";

type UseDashboardDataOptions = {
  userId: string;
  isActive: boolean;
  shouldLoad: boolean;
  transactionCount: number;
};

type ProviderKeySource = {
  sourceInstitution: string;
  checking: { total: number };
  investmentProducts: Array<{ quantity: number }>;
  cryptoTokens: Array<{ quantity: number }>;
};

function getProviderKeys(providerSummaries: ProviderKeySource[]) {
  const currentKeys = new Set<string>();

  providerSummaries.forEach((provider) => {
    if (provider.checking.total !== 0) {
      currentKeys.add(`checking-${provider.sourceInstitution}`);
    }
    if (provider.investmentProducts.filter((product) => Math.abs(product.quantity) > 0.000001).length > 0) {
      currentKeys.add(`investment-${provider.sourceInstitution}`);
    }
    if (provider.cryptoTokens.filter((token) => Math.abs(token.quantity) > 0.000001).length > 0) {
      currentKeys.add(`crypto-${provider.sourceInstitution}`);
    }
  });

  return currentKeys;
}

export function useDashboardData({
  userId,
  isActive,
  shouldLoad,
  transactionCount
}: UseDashboardDataOptions) {
  const initialData = readDashboardStageDataCache("dashboard", userId, transactionCount);
  const [data, setData] = useState<DashboardData | null>(initialData);
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
  const cachedDataForCurrentVersion = freshDataVersion === transactionCount
    ? null
    : readDashboardStageDataCache("dashboard", userId, transactionCount);
  const effectiveData = cachedDataForCurrentVersion ?? data;
  const effectiveDataFresh =
    !!effectiveData
    && (
      !!cachedDataForCurrentVersion
      || (hasFreshData && freshDataVersion === transactionCount)
    );

  const applyDashboardPayload = useCallback((payload: DashboardData) => {
    const currentKeys = getProviderKeys(payload.providerSummaries);
    if (pendingImportRefreshRef.current) {
      const addedKeys = new Set([...currentKeys].filter((key) => !knownProviderKeysRef.current.has(key)));
      if (addedKeys.size > 0) {
        setNewProviderKeys(addedKeys);
        setTimeout(() => setNewProviderKeys(new Set()), 1000);
      }
    }
    knownProviderKeysRef.current = currentKeys;

    setData(payload);
    setHasFreshData(true);
    setFreshDataVersion(transactionCount);
    setDataVersion((version) => version + 1);
    setError(null);
    setLoading(false);
  }, [transactionCount]);

  const fetchDashboard = useCallback(
    async ({ force = false }: { force?: boolean } = {}) => {
      try {
        const payload = await fetchDashboardStageData("dashboard", userId, {
          fallbackErrorMessage: "Errore nel caricamento della dashboard.",
          force,
          version: transactionCount
        });

        applyDashboardPayload(payload);
      } catch (fetchError: unknown) {
        setError(fetchError instanceof Error ? fetchError.message : "Errore nel caricamento.");
        setData((currentData) => currentData ?? null);
      } finally {
        setLoading(false);
        if (pendingImportRefreshRef.current) {
          pendingImportRefreshRef.current = false;
          setImportRefreshVersion((version) => version + 1);
        }
      }
    },
    [applyDashboardPayload, transactionCount, userId]
  );
  const fetchDashboardIfStale = useCallback(() => {
    if (!isDashboardStageDataCacheFresh("dashboard", userId, transactionCount)) {
      void fetchDashboard({ force: true });
    }
  }, [fetchDashboard, transactionCount, userId]);

  useEffect(() => {
    if (!shouldLoad || data) {
      return;
    }

    const cachedData = readDashboardStageDataCache("dashboard", userId, transactionCount);
    if (!cachedData) {
      return;
    }

    knownProviderKeysRef.current = getProviderKeys(cachedData.providerSummaries);
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
  }, [data, fetchDashboardIfStale, shouldLoad, transactionCount, userId]);

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
        fetchDashboardIfStale();
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
    setHasFreshData(false);

    const cachedData = readDashboardStageDataCache("dashboard", userId, transactionCount);
    if (cachedData) {
      const hydrateTimer = window.setTimeout(() => {
        applyDashboardPayload(cachedData);
        pendingImportRefreshRef.current = false;
        setImportRefreshVersion((version) => version + 1);
        fetchDashboardIfStale();
      }, 0);

      return () => window.clearTimeout(hydrateTimer);
    }

    const refreshTimer = window.setTimeout(() => {
      void fetchDashboard({ force: true });
    }, 0);

    return () => window.clearTimeout(refreshTimer);
  }, [
    applyDashboardPayload,
    fetchDashboard,
    fetchDashboardIfStale,
    loading,
    shouldLoad,
    transactionCount,
    userId
  ]);

  return {
    data: effectiveData,
    dataVersion,
    dataFresh: effectiveDataFresh,
    importRefreshVersion,
    loading: cachedDataForCurrentVersion ? false : loading,
    error,
    newProviderKeys
  };
}
