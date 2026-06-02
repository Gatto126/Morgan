"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";

import {
  ensureFinanceBinanceCurrentBalances,
  ensureFinanceCurrentValuation,
  ensureFinanceStageReady,
  invalidateFinanceProfile
} from "./finance-session-orchestrator";
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
      setNotice(
        tokenCount > 0
          ? `Connected! ${tokenCount} token${tokenCount !== 1 ? "s" : ""} found.`
          : "Connected! Empty wallet."
      );
      keepApiSettingsOpen();

      setBinanceRefreshKey(nextRefreshKey);
      setActiveUser(updatedUser);
      clearApiKeyDraft();
      setUsers((prevUsers) =>
        prevUsers.map((user) => (user.id === activeUser.id ? updatedUser : user))
      );
      invalidateFinanceProfile(activeUser.id);
      void Promise.allSettled([
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
      ]).catch(() => {
        // The last committed valuation remains visible if live quote refresh fails.
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
    binanceRefreshKey,
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

      invalidateFinanceProfile(activeUser.id);
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
