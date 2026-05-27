import { useCallback, useEffect, useRef, useState } from "react";
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
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);
  const [importRefreshVersion, setImportRefreshVersion] = useState(0);
  const [newProviderKeys, setNewProviderKeys] = useState<Set<string>>(new Set());
  const knownProviderKeysRef = useRef<Set<string>>(new Set());
  const pendingImportRefreshRef = useRef(false);
  const lastRefreshTransactionCountRef = useRef(transactionCount);
  const hasLoadedRef = useRef(false);

  const fetchDashboard = useCallback(
    async () => {
      try {
        const response = await fetch(`/api/transactions/dashboard?userId=${userId}`, {
          cache: "no-store"
        });
        const payload = (await response.json()) as DashboardData & { error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Errore nel caricamento della dashboard.");
        }

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
        setDataVersion((version) => version + 1);
        setError(null);
      } catch (fetchError: unknown) {
        setError(fetchError instanceof Error ? fetchError.message : "Errore nel caricamento.");
        setData(null);
      } finally {
        setLoading(false);
        if (pendingImportRefreshRef.current) {
          pendingImportRefreshRef.current = false;
          setImportRefreshVersion((version) => version + 1);
        }
      }
    },
    [userId]
  );

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
      void fetchDashboard();
    }, 60_000);

    function handleFocus() {
      void fetchDashboard();
    }

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearTimeout(initialLoad);
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
  }, [transactionCount, fetchDashboard, shouldLoad, loading]);

  return {
    data,
    dataVersion,
    importRefreshVersion,
    loading,
    error,
    newProviderKeys
  };
}
