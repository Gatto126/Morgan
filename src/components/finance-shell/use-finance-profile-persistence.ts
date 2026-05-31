"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";

import {
  ACTIVE_PROFILE_PERSISTENCE_KEY,
  ACTIVE_STAGE_PERSISTENCE_KEY,
  type PersistedFinanceSelection,
  resolveRestoredStage
} from "./persistence-state";
import type { SettingsSection } from "./settings-panel-types";
import type { UserRecord } from "./types";
import type { Stage } from "./use-finance-navigation";

type UseFinanceProfilePersistenceParams = {
  activeUser: UserRecord | null;
  hasRestoredClientState: boolean;
  initialUsers: UserRecord[];
  skipClientRestore: boolean;
  stage: Stage;
  setActiveSettingsSection: Dispatch<SetStateAction<SettingsSection | null>>;
  setActiveUser: Dispatch<SetStateAction<UserRecord | null>>;
  setHasRestoredClientState: Dispatch<SetStateAction<boolean>>;
  setShowUploadView: Dispatch<SetStateAction<boolean>>;
  setStage: Dispatch<SetStateAction<Stage>>;
};

function writePersistenceCookie(name: string, value: string | null) {
  const encodedName = encodeURIComponent(name);

  if (!value) {
    document.cookie = `${encodedName}=; Path=/; Max-Age=0; SameSite=Lax`;
    return;
  }

  document.cookie = `${encodedName}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function writePersistedFinanceSelectionCookies(activeUser: UserRecord | null, stage: Stage) {
  writePersistenceCookie(ACTIVE_PROFILE_PERSISTENCE_KEY, activeUser?.id ?? null);
  writePersistenceCookie(ACTIVE_STAGE_PERSISTENCE_KEY, stage);
}

function clearPersistedFinanceSelectionCookies() {
  writePersistenceCookie(ACTIVE_PROFILE_PERSISTENCE_KEY, null);
  writePersistenceCookie(ACTIVE_STAGE_PERSISTENCE_KEY, null);
}

export function resolveInitialFinanceState(
  initialUsers: UserRecord[],
  persistedSelection: PersistedFinanceSelection | null = null
) {
  const persistedUser = persistedSelection?.activeUserId
    ? initialUsers.find((user) => user.id === persistedSelection.activeUserId) ?? null
    : null;

  if (persistedUser) {
    return {
      activeUser: persistedUser,
      restoredFromServer: true,
      showUploadView: false,
      stage: resolveRestoredStage(persistedSelection?.stage ?? null)
    };
  }

  const onlyUser = initialUsers.length === 1 ? initialUsers[0] : null;

  if (onlyUser) {
    return {
      activeUser: onlyUser,
      restoredFromServer: false,
      showUploadView: false,
      stage: "dashboard" as Stage
    };
  }

  return {
    activeUser: null,
    restoredFromServer: false,
    showUploadView: false,
    stage: initialUsers.length > 0 ? "welcome" as Stage : "create" as Stage
  };
}

export function clearPersistedFinanceProfileSelection() {
  localStorage.removeItem(ACTIVE_PROFILE_PERSISTENCE_KEY);
  localStorage.removeItem(ACTIVE_STAGE_PERSISTENCE_KEY);
  clearPersistedFinanceSelectionCookies();
}

export function useFinanceProfilePersistence({
  activeUser,
  hasRestoredClientState,
  initialUsers,
  skipClientRestore,
  stage,
  setActiveSettingsSection,
  setActiveUser,
  setHasRestoredClientState,
  setShowUploadView,
  setStage
}: UseFinanceProfilePersistenceParams) {
  useEffect(() => {
    if (skipClientRestore) {
      setHasRestoredClientState(true);
      return;
    }

    let cancelled = false;

    const restoreTimer = window.setTimeout(() => {
      try {
        const savedUserId = localStorage.getItem(ACTIVE_PROFILE_PERSISTENCE_KEY);
        const savedStage = localStorage.getItem(ACTIVE_STAGE_PERSISTENCE_KEY);
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
    skipClientRestore,
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
        localStorage.setItem(ACTIVE_PROFILE_PERSISTENCE_KEY, activeUser.id);
      } else {
        localStorage.removeItem(ACTIVE_PROFILE_PERSISTENCE_KEY);
      }
      localStorage.setItem(ACTIVE_STAGE_PERSISTENCE_KEY, stage);
      writePersistedFinanceSelectionCookies(activeUser, stage);
    } catch (err) {
      console.warn("Could not write persisted finance selection", err);
    }
  }, [stage, activeUser, hasRestoredClientState]);

  return initialUsers.length > 1 && !hasRestoredClientState && !activeUser;
}
