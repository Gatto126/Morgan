"use client";

import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";

import { frameOverlayPanelMotionDurationMs } from "./frame-overlay-panels";
import type { SettingsSection } from "./settings-panel-types";
import type { UserRecord } from "./types";
import type { Stage } from "./use-finance-navigation";

type UseFinanceProfileSelectionParams = {
  activeUser: UserRecord | null;
  hasUsers: boolean;
  showUserSelectView: boolean;
  clearApiKeyDraft: () => void;
  clearPanelFeedback: () => void;
  handleCloseUserSelect: () => void;
  resetPreview: () => void;
  setActiveSettingsSection: Dispatch<SetStateAction<SettingsSection | null>>;
  setActiveUser: Dispatch<SetStateAction<UserRecord | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setIsClosingUserSelect: Dispatch<SetStateAction<boolean>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setShowCreateUserSubmenu: Dispatch<SetStateAction<boolean>>;
  setShowSettingsView: Dispatch<SetStateAction<boolean>>;
  setShowUploadView: Dispatch<SetStateAction<boolean>>;
  setShowUserSelectView: Dispatch<SetStateAction<boolean>>;
  setStage: Dispatch<SetStateAction<Stage>>;
};

export function useFinanceProfileSelection({
  activeUser,
  hasUsers,
  showUserSelectView,
  clearApiKeyDraft,
  clearPanelFeedback,
  handleCloseUserSelect,
  resetPreview,
  setActiveSettingsSection,
  setActiveUser,
  setError,
  setIsClosingUserSelect,
  setNotice,
  setShowCreateUserSubmenu,
  setShowSettingsView,
  setShowUploadView,
  setShowUserSelectView,
  setStage
}: UseFinanceProfileSelectionParams) {
  const pendingUserSelectionTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pendingUserSelectionTimerRef.current) {
        window.clearTimeout(pendingUserSelectionTimerRef.current);
        pendingUserSelectionTimerRef.current = null;
      }
    };
  }, []);

  const commitUserSelection = useCallback((user: UserRecord) => {
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
  }, [
    clearApiKeyDraft,
    clearPanelFeedback,
    resetPreview,
    setActiveSettingsSection,
    setActiveUser,
    setError,
    setIsClosingUserSelect,
    setNotice,
    setShowCreateUserSubmenu,
    setShowSettingsView,
    setShowUploadView,
    setShowUserSelectView,
    setStage
  ]);

  const handleUserSelect = useCallback((user: UserRecord) => {
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
  }, [
    activeUser?.id,
    commitUserSelection,
    handleCloseUserSelect,
    showUserSelectView
  ]);

  const goBackToSelection = useCallback(() => {
    if (hasUsers) {
      setStage("select");
      return;
    }

    setStage("welcome");
  }, [hasUsers, setStage]);

  return {
    goBackToSelection,
    handleUserSelect
  };
}
