"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";

import type { BinanceBalanceRow } from "@/components/dashboard/types";

import { seedDashboardStageDataCache } from "./dashboard-stage-data-cache";
import type { SettingsSection } from "./settings-panel-types";
import type { UserRecord } from "./types";

type UpdateProfileBinancePayload = {
  error?: string;
  user?: Pick<UserRecord, "hasBinanceCredentials" | "binanceApiKeyPreview">;
};

type BinanceSyncPayload = {
  balances?: BinanceBalanceRow[];
  error?: string;
  hasApiKey?: boolean;
  isStale?: boolean;
  syncedAt?: string | null;
};

type UseFinanceBinanceActionsParams = {
  activeUser: UserRecord | null;
  onBinanceCredentialsDeleted: () => void;
  showApiSettingsPanel: () => void;
  setActiveUser: Dispatch<SetStateAction<UserRecord | null>>;
  setUsers: Dispatch<SetStateAction<UserRecord[]>>;
};

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
  const [binanceRefreshKey, setBinanceRefreshKey] = useState(0);
  const [showDeleteApiConfirm, setShowDeleteApiConfirm] = useState(false);
  const [binanceFading, setBinanceFading] = useState(false);
  const [forceApiSettingsSection, setForceApiSettingsSection] = useState(false);

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

  const handleSaveApiKeys = useCallback(async (apiKey: string, apiSecret: string) => {
    if (!activeUser) return;

    try {
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

      const updatedUser: UserRecord = {
        ...activeUser,
        hasBinanceCredentials: payload.user.hasBinanceCredentials,
        binanceApiKeyPreview: payload.user.binanceApiKeyPreview
      };
      setActiveUser(updatedUser);
      clearApiKeyDraft();
      setUsers((prevUsers) =>
        prevUsers.map((user) => (user.id === activeUser.id ? updatedUser : user))
      );

      keepApiSettingsOpen();
      setIsTesting(true);
      setNotice("Testing endpoint...");

      const syncResponse = await fetch("/api/binance/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: activeUser.id })
      });

      const syncPayload = (await syncResponse.json()) as BinanceSyncPayload;

      if (!syncResponse.ok) {
        throw new Error(syncPayload.error ?? "Binance connection failed.");
      }

      const balances = Array.isArray(syncPayload.balances) ? syncPayload.balances : [];
      const tokenCount = balances.length;
      const syncedAt = syncPayload.syncedAt ?? new Date().toISOString();
      setNotice(
        tokenCount > 0
          ? `Connected! ${tokenCount} token${tokenCount !== 1 ? "s" : ""} found.`
          : "Connected! Empty wallet."
      );
      keepApiSettingsOpen();
      setBinanceRefreshKey((key) => {
        const nextKey = key + 1;
        const fetchedAt = Date.now();
        const cachePayload = {
          balances,
          hasApiKey: syncPayload.hasApiKey ?? true,
          isStale: syncPayload.isStale ?? false,
          syncedAt
        };

        seedDashboardStageDataCache("binance", activeUser.id, key, cachePayload, fetchedAt);
        seedDashboardStageDataCache("binance", activeUser.id, nextKey, cachePayload, fetchedAt);

        return nextKey;
      });
    } catch (err) {
      keepApiSettingsOpen();
      setError(err instanceof Error ? err.message : "Error saving API keys.");
    } finally {
      keepApiSettingsOpen();
      setIsTesting(false);
    }
  }, [
    activeUser,
    clearApiKeyDraft,
    keepApiSettingsOpen,
    setActiveUser,
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

      if (deleteData) {
        setBinanceRefreshKey((key) => key + 1);
      }
      onBinanceCredentialsDeleted();

      setNotice(deleteData ? "API keys and data deleted." : "API keys deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting API keys.");
    } finally {
      setBinanceFading(false);
    }
  }, [
    activeUser,
    clearApiKeyDraft,
    onBinanceCredentialsDeleted,
    setActiveUser,
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
    handleSaveApiKeys,
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
