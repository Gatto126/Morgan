"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";

import type { SettingsSection } from "./settings-panel-types";
import type { UserRecord } from "./types";
import type { Stage } from "./use-finance-navigation";

const restorableStages = new Set<Stage>(["welcome", "select", "create", "dashboard", "checking", "investment", "settings", "binance", "crypto"]);

type UseFinanceProfilePersistenceParams = {
  activeUser: UserRecord | null;
  hasRestoredClientState: boolean;
  initialUsers: UserRecord[];
  stage: Stage;
  setActiveSettingsSection: Dispatch<SetStateAction<SettingsSection | null>>;
  setActiveUser: Dispatch<SetStateAction<UserRecord | null>>;
  setHasRestoredClientState: Dispatch<SetStateAction<boolean>>;
  setShowUploadView: Dispatch<SetStateAction<boolean>>;
  setStage: Dispatch<SetStateAction<Stage>>;
};

function isRestorableStage(value: string | null): value is Stage {
  return value !== null && restorableStages.has(value as Stage);
}

function resolveRestoredStage(savedStage: string | null) {
  if (!isRestorableStage(savedStage) || savedStage === "select" || savedStage === "create") {
    return "dashboard" as Stage;
  }

  return savedStage;
}

export function resolveInitialFinanceState(initialUsers: UserRecord[]) {
  const onlyUser = initialUsers.length === 1 ? initialUsers[0] : null;

  if (onlyUser) {
    return {
      activeUser: onlyUser,
      showUploadView: false,
      stage: "dashboard" as Stage
    };
  }

  return {
    activeUser: null,
    showUploadView: false,
    stage: initialUsers.length > 0 ? "welcome" as Stage : "create" as Stage
  };
}

export function clearPersistedFinanceProfileSelection() {
  localStorage.removeItem("morgan_active_user");
  localStorage.removeItem("morgan_stage");
}

export function useFinanceProfilePersistence({
  activeUser,
  hasRestoredClientState,
  initialUsers,
  stage,
  setActiveSettingsSection,
  setActiveUser,
  setHasRestoredClientState,
  setShowUploadView,
  setStage
}: UseFinanceProfilePersistenceParams) {
  useEffect(() => {
    let cancelled = false;

    const restoreTimer = window.setTimeout(() => {
      try {
        const savedUserId = localStorage.getItem("morgan_active_user");
        const savedStage = localStorage.getItem("morgan_stage");
        const savedUser = savedUserId ? initialUsers.find((user) => user.id === savedUserId) ?? null : null;

        if (!cancelled && savedUser) {
          const restoredStage = resolveRestoredStage(savedStage);

          setActiveUser(savedUser);
          setShowUploadView(false);
          setStage(restoredStage);
          setActiveSettingsSection(restoredStage === "settings" ? "general" : null);
        } else if (!cancelled && initialUsers.length > 0 && initialUsers.length !== 1) {
          setShowUploadView(false);
          setStage("select");
          setActiveSettingsSection(null);
        }
      } catch (err) {
        console.warn("Could not read localStorage for persistence", err);
      } finally {
        if (!cancelled) {
          setHasRestoredClientState(true);
        }
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(restoreTimer);
    };
  }, [
    initialUsers,
    setActiveSettingsSection,
    setActiveUser,
    setHasRestoredClientState,
    setShowUploadView,
    setStage
  ]);

  useEffect(() => {
    if (!hasRestoredClientState) return;

    try {
      if (activeUser) {
        localStorage.setItem("morgan_active_user", activeUser.id);
      } else {
        localStorage.removeItem("morgan_active_user");
      }
      localStorage.setItem("morgan_stage", stage);
    } catch (err) {
      console.warn("Could not write localStorage for persistence", err);
    }
  }, [stage, activeUser, hasRestoredClientState]);

  return initialUsers.length > 1 && !hasRestoredClientState && !activeUser;
}
