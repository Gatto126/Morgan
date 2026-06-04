"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";

import {
  ensureFinanceBinanceCurrentBalances,
  ensureFinanceCurrentValuation,
  ensureFinanceStageReady,
  invalidateFinanceProfile
} from "./finance-session-orchestrator";
import type { CurrentValuationSnapshot } from "./current-valuations-store";
import { clearDashboardTopbarsForProfile } from "./dashboard-topbar-store";
import type { SettingsSection } from "./settings-panel-types";
import type { UserRecord } from "./types";

type UpdateProfileBinancePayload = {
  error?: string;
  user?: Pick<UserRecord, "hasBinanceCredentials" | "binanceApiKeyPreview">;
};

type UseFinanceBinanceActionsParams = {
  activeUser: UserRecord | null;
  onBinanceCredentialsDeleted: () => void;
  showApiSettingsPanel: () => void;
  setActiveUser: Dispatch<SetStateAction<UserRecord | null>>;
  setUsers: Dispatch<SetStateAction<UserRecord[]>>;
};

const BINANCE_REFRESH_KEY_STORAGE_KEY = "morgan:finance:binance-refresh-key:v1";

type BinanceConnectNoticeOptions = {
  binanceRefreshKey: number;
  tokenCount: number;
  valuationSnapshot?: CurrentValuationSnapshot | null;
};

function readStoredBinanceRefreshKey() {
  if (typeof window === "undefined") {
    return 0;
  }

  try {
    const value = Number(window.localStorage.getItem(BINANCE_REFRESH_KEY_STORAGE_KEY));
    return Number.isSafeInteger(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeStoredBinanceRefreshKey(value: number) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(BINANCE_REFRESH_KEY_STORAGE_KEY, String(Math.max(0, value)));
  } catch {
    // Persistence is best-effort; the in-memory key still protects the current page.
  }
}

function formatTokenCount(count: number) {
  return `${count} token${count !== 1 ? "s" : ""}`;
}

export function getBinanceConnectNotice({
  binanceRefreshKey,
  tokenCount,
  valuationSnapshot
}: BinanceConnectNoticeOptions) {
  if (tokenCount <= 0) {
    return "Connected! No material balance above EUR 0.49.";
  }

  const prefix = `Connected! ${formatTokenCount(tokenCount)} found.`;
  const isCurrentSnapshot = valuationSnapshot?.version.binanceRefreshKey === binanceRefreshKey;
  if (!isCurrentSnapshot) {
    return `${prefix} Values are still preparing.`;
  }

  const binanceValue = valuationSnapshot.totals.binance;
  if (
    valuationSnapshot.status === "ready"
    && binanceValue.status === "ready"
    && typeof binanceValue.cents === "number"
    && binanceValue.cents > 0
    && valuationSnapshot.providers.BINANCE?.hasBinance
  ) {
    return prefix;
  }

  if (
    valuationSnapshot.status === "ready"
    && binanceValue.status === "ready"
    && typeof binanceValue.cents === "number"
  ) {
    return `${prefix} Current value unavailable.`;
  }

  return `${prefix} Values are still preparing.`;
}

export function useFinanceBinanceActions({
  activeUser,
  onBinanceCredentialsDeleted,
  showApiSettingsPanel,
  setActiveUser,
  setUsers
}: UseFinanceBinanceActionsParams) {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [binanceRefreshKey, setBinanceRefreshKeyState] = useState(readStoredBinanceRefreshKey);
  const [showDeleteApiConfirm, setShowDeleteApiConfirm] = useState(false);
  const [binanceFading, setBinanceFading] = useState(false);
  const [forceApiSettingsSection, setForceApiSettingsSection] = useState(false);

  const setBinanceRefreshKey = useCallback<Dispatch<SetStateAction<number>>>((value) => {
    setBinanceRefreshKeyState((currentValue) => {
      const nextValue = typeof value === "function"
        ? value(currentValue)
        : value;
      writeStoredBinanceRefreshKey(nextValue);
      return nextValue;
    });
  }, []);

  const clearApiKeyDraft = useCallback(() => {
    setShowSecret(false);
  }, []);

  const clearPanelFeedback = useCallback(() => {
    setError(null);
    setNotice(null);
    setShowDeleteApiConfirm(false);
  }, []);

  const clearForcedApiSettingsSection = useCallback(() => {
    setForceApiSettingsSection(false);
  }, []);

  const keepApiSettingsOpen = useCallback(() => {
    setForceApiSettingsSection(true);
    showApiSettingsPanel();
  }, [showApiSettingsPanel]);

  useEffect(() => {
    if ((notice || error) && !isTesting) {
      const timer = window.setTimeout(() => {
        setNotice(null);
        setError(null);
      }, 3500);
      return () => window.clearTimeout(timer);
    }
  }, [notice, error, isTesting]);

  const handleConnectBinanceApi = useCallback(async (apiKey: string, apiSecret: string) => {
    if (!activeUser) return;

    try {
      let updatedUser: UserRecord | null = null;

      keepApiSettingsOpen();
      setError(null);
      setNotice(null);

      const response = await fetch(`/api/users/${activeUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: apiKey.trim() || null,
          apiSecret: apiSecret.trim() || null
        })
      });

      const payload = (await response.json()) as UpdateProfileBinancePayload;

      if (!response.ok || !payload.user) {
        throw new Error(payload.error ?? "Failed to save API keys.");
      }

      updatedUser = {
        ...activeUser,
        hasBinanceCredentials: payload.user.hasBinanceCredentials,
        binanceApiKeyPreview: payload.user.binanceApiKeyPreview
      };

      keepApiSettingsOpen();
      setIsTesting(true);
      setNotice("Connecting Binance...");

      const nextRefreshKey = binanceRefreshKey + 1;
      const syncResult = await ensureFinanceBinanceCurrentBalances({
        binanceRefreshKey: nextRefreshKey,
        event: "binance-connect",
        force: true,
        priority: "user",
        seedVersions: [binanceRefreshKey],
        throwOnError: true,
        user: updatedUser
      });
      const balances = syncResult.balances;
      const tokenCount = balances.length;

      setBinanceRefreshKey(nextRefreshKey);
      setActiveUser(updatedUser);
      clearApiKeyDraft();
      setUsers((prevUsers) =>
        prevUsers.map((user) => (user.id === activeUser.id ? updatedUser : user))
      );
      invalidateFinanceProfile(activeUser.id);
      setNotice(tokenCount > 0 ? "Preparing Binance valuation..." : "Checking Binance balances...");
      keepApiSettingsOpen();

      const [, valuationResult] = await Promise.allSettled([
        ensureFinanceStageReady({
          binanceRefreshKey: nextRefreshKey,
          event: "binance-connect",
          livePriceMaxAgeMs: 0,
          priority: "user",
          stage: "binance",
          user: updatedUser
        }),
        ensureFinanceCurrentValuation({
          binanceRefreshKey: nextRefreshKey,
          event: "binance-connect",
          force: true,
          livePriceMaxAgeMs: 0,
          priority: "user",
          user: updatedUser
        })
      ]);
      setNotice(getBinanceConnectNotice({
        binanceRefreshKey: nextRefreshKey,
        tokenCount,
        valuationSnapshot: valuationResult.status === "fulfilled"
          ? valuationResult.value.snapshot
          : null
      }));
    } catch (err) {
      keepApiSettingsOpen();
      setError(err instanceof Error ? err.message : "Error saving API keys.");
    } finally {
      keepApiSettingsOpen();
      setIsTesting(false);
    }
  }, [
    activeUser,
    binanceRefreshKey,
    clearApiKeyDraft,
    keepApiSettingsOpen,
    setActiveUser,
    setBinanceRefreshKey,
    setUsers
  ]);

  const handleDeleteApiKeys = useCallback(async (deleteData: boolean) => {
    if (!activeUser) return;

    setShowDeleteApiConfirm(false);
    setError(null);
    setNotice(null);
    setBinanceFading(true);

    try {
      const response = await fetch(`/api/users/${activeUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey: null,
          apiSecret: null,
          deleteBalances: deleteData
        })
      });

      const payload = (await response.json()) as UpdateProfileBinancePayload;

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to delete API keys.");
      }

      await new Promise<void>((resolve) => window.setTimeout(resolve, 300));

      const updatedUser: UserRecord = {
        ...activeUser,
        hasBinanceCredentials: false,
        binanceApiKeyPreview: null
      };
      setActiveUser(updatedUser);
      clearApiKeyDraft();
      setUsers((prevUsers) =>
        prevUsers.map((user) => (user.id === activeUser.id ? updatedUser : user))
      );

      invalidateFinanceProfile(activeUser.id);
      clearDashboardTopbarsForProfile(activeUser.id);
      if (deleteData) {
        setBinanceRefreshKey((key) => key + 1);
      }
      void ensureFinanceCurrentValuation({
        binanceRefreshKey: deleteData ? binanceRefreshKey + 1 : binanceRefreshKey,
        event: "binance-delete",
        force: true,
        livePriceMaxAgeMs: 0,
        priority: "user",
        user: updatedUser
      }).catch(() => {
        // The next stage warmup will retry valuation after API-key deletion.
      });
      onBinanceCredentialsDeleted();

      setNotice(deleteData ? "API keys and data deleted." : "API keys deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting API keys.");
    } finally {
      setBinanceFading(false);
    }
  }, [
    activeUser,
    binanceRefreshKey,
    clearApiKeyDraft,
    onBinanceCredentialsDeleted,
    setActiveUser,
    setBinanceRefreshKey,
    setUsers
  ]);

  const getVisibleSettingsSection = useCallback(
    (activeSettingsSection: SettingsSection | null, showSettingsView: boolean) =>
      forceApiSettingsSection && showSettingsView ? "apiKey" : activeSettingsSection,
    [forceApiSettingsSection]
  );

  return {
    binanceFading,
    binanceRefreshKey,
    clearApiKeyDraft,
    clearForcedApiSettingsSection,
    clearPanelFeedback,
    error,
    getVisibleSettingsSection,
    handleDeleteApiKeys,
    handleConnectBinanceApi,
    isTesting,
    notice,
    setError,
    setNotice,
    setShowDeleteApiConfirm,
    setShowSecret,
    showDeleteApiConfirm,
    showSecret
  };
}
