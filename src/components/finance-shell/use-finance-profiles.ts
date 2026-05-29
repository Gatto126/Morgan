import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";

import { frameOverlayPanelMotionDurationMs } from "./frame-overlay-panels";
import type { SettingsSection } from "./settings-panel";
import type { UserRecord } from "./types";
import type { Stage } from "./use-finance-navigation";
import type { ImportedTransactionCounts } from "./use-transaction-import";

const restorableStages = new Set<Stage>(["welcome", "select", "create", "dashboard", "checking", "investment", "settings", "binance", "crypto"]);

type UseFinanceProfilesParams = {
  accountName: string;
  activeUser: UserRecord | null;
  hasRestoredClientState: boolean;
  initialUsers: UserRecord[];
  name: string;
  saving: boolean;
  showUserSelectView: boolean;
  stage: Stage;
  users: UserRecord[];
  clearApiKeyDraft: () => void;
  clearPanelFeedback: () => void;
  handleCloseUserSelect: () => void;
  resetPreview: () => void;
  setActiveSettingsSection: Dispatch<SetStateAction<SettingsSection | null>>;
  setActiveUser: Dispatch<SetStateAction<UserRecord | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setHasRestoredClientState: Dispatch<SetStateAction<boolean>>;
  setIsClosingUserSelect: Dispatch<SetStateAction<boolean>>;
  setName: Dispatch<SetStateAction<string>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setSaving: Dispatch<SetStateAction<boolean>>;
  setShowCreateUserSubmenu: Dispatch<SetStateAction<boolean>>;
  setShowSettingsView: Dispatch<SetStateAction<boolean>>;
  setShowUploadView: Dispatch<SetStateAction<boolean>>;
  setShowUserSelectView: Dispatch<SetStateAction<boolean>>;
  setStage: Dispatch<SetStateAction<Stage>>;
  setUsers: Dispatch<SetStateAction<UserRecord[]>>;
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

export function useFinanceProfiles({
  accountName,
  activeUser,
  hasRestoredClientState,
  initialUsers,
  name,
  saving,
  showUserSelectView,
  stage,
  users,
  clearApiKeyDraft,
  clearPanelFeedback,
  handleCloseUserSelect,
  resetPreview,
  setActiveSettingsSection,
  setActiveUser,
  setError,
  setHasRestoredClientState,
  setIsClosingUserSelect,
  setName,
  setNotice,
  setSaving,
  setShowCreateUserSubmenu,
  setShowSettingsView,
  setShowUploadView,
  setShowUserSelectView,
  setStage,
  setUsers
}: UseFinanceProfilesParams) {
  const pendingUserSelectionTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pendingUserSelectionTimerRef.current) {
        window.clearTimeout(pendingUserSelectionTimerRef.current);
        pendingUserSelectionTimerRef.current = null;
      }
    };
  }, []);

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

  const hasUsers = users.length > 0;
  const isRestoringProfileSelection = initialUsers.length > 1 && !hasRestoredClientState && !activeUser;

  function applyImportedTransactionCounts({
    insertedCount,
    addedChecking,
    addedInvestment,
    addedCrypto
  }: ImportedTransactionCounts) {
    if (!activeUser) return;

    setActiveUser((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        transactionCount: prev.transactionCount + insertedCount,
        checkingCount: prev.checkingCount + addedChecking,
        investmentCount: prev.investmentCount + addedInvestment,
        cryptoCount: prev.cryptoCount + addedCrypto
      };
    });

    setUsers((currentUsers) =>
      currentUsers.map((user) => {
        if (user.id === activeUser.id) {
          return {
            ...user,
            transactionCount: user.transactionCount + insertedCount,
            checkingCount: user.checkingCount + addedChecking,
            investmentCount: user.investmentCount + addedInvestment,
            cryptoCount: user.cryptoCount + addedCrypto
          };
        }

        return user;
      })
    );
  }

  function commitUserSelection(user: UserRecord) {
    setActiveUser(user);
    resetPreview();
    setIsClosingUserSelect(false);
    setShowUserSelectView(false);
    setShowCreateUserSubmenu(false);
    setShowSettingsView(false);
    setActiveSettingsSection(null);
    clearPanelFeedback();
    clearApiKeyDraft();
    setShowUploadView(false);
    setStage("dashboard");
    setError(null);
    setNotice(null);
  }

  async function handleCreateUser() {
    const trimmed = name.trim();
    if (!trimmed || saving) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: trimmed })
      });

      const payload = (await response.json()) as { user?: UserRecord; error?: string; users?: UserRecord[] };

      if (!response.ok || !payload.user) {
        throw new Error(payload.error ?? "User creation failed.");
      }

      const updatedUsers = payload.users ?? [...users, payload.user];
      setUsers(updatedUsers);
      setActiveUser(payload.user);
      setName("");
      resetPreview();
      setNotice(null);
      setShowUploadView(false);
      setShowUserSelectView(false);
      setShowCreateUserSubmenu(false);
      setStage("dashboard");
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : "User creation failed.");
    } finally {
      setSaving(false);
    }
  }

  function handleUserSelect(user: UserRecord) {
    if (activeUser?.id === user.id) {
      return;
    }

    if (pendingUserSelectionTimerRef.current) {
      window.clearTimeout(pendingUserSelectionTimerRef.current);
      pendingUserSelectionTimerRef.current = null;
    }

    if (showUserSelectView) {
      handleCloseUserSelect();
      pendingUserSelectionTimerRef.current = window.setTimeout(() => {
        pendingUserSelectionTimerRef.current = null;
        commitUserSelection(user);
      }, frameOverlayPanelMotionDurationMs);
      return;
    }

    commitUserSelection(user);
  }

  function handleToggleCreateUser() {
    setShowCreateUserSubmenu((prev) => !prev);
    setName(users.length === 0 ? accountName : "");
    setError(null);
    setNotice(null);
  }

  function goBackToSelection() {
    if (hasUsers) {
      setStage("select");
      return;
    }

    setStage("welcome");
  }

  return {
    applyImportedTransactionCounts,
    goBackToSelection,
    handleCreateUser,
    handleToggleCreateUser,
    handleUserSelect,
    hasUsers,
    isRestoringProfileSelection
  };
}
