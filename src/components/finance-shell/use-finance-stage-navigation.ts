"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";

import type { SettingsSection } from "./settings-panel-types";
import type { Stage } from "./use-finance-navigation";

type UseFinanceStageNavigationParams = {
  clearAllCloseTimers: () => void;
  clearApiKeyDraft: () => void;
  clearPanelFeedback: () => void;
  resetClosingFlags: () => void;
  setActiveSettingsSection: Dispatch<SetStateAction<SettingsSection | null>>;
  setShowCreateUserSubmenu: Dispatch<SetStateAction<boolean>>;
  setShowSettingsView: Dispatch<SetStateAction<boolean>>;
  setShowUploadView: Dispatch<SetStateAction<boolean>>;
  setShowUserSelectView: Dispatch<SetStateAction<boolean>>;
  setStage: Dispatch<SetStateAction<Stage>>;
};

export function useFinanceStageNavigation({
  clearAllCloseTimers,
  clearApiKeyDraft,
  clearPanelFeedback,
  resetClosingFlags,
  setActiveSettingsSection,
  setShowCreateUserSubmenu,
  setShowSettingsView,
  setShowUploadView,
  setShowUserSelectView,
  setStage
}: UseFinanceStageNavigationParams) {
  const resetOverlayState = useCallback(() => {
    setShowUploadView(false);
    setShowSettingsView(false);
    setShowUserSelectView(false);
    setShowCreateUserSubmenu(false);
    setActiveSettingsSection(null);
  }, [
    setActiveSettingsSection,
    setShowCreateUserSubmenu,
    setShowSettingsView,
    setShowUploadView,
    setShowUserSelectView
  ]);

  const navigateTo = useCallback((newStage: Stage) => {
    clearAllCloseTimers();
    resetClosingFlags();
    setStage(newStage);
    resetOverlayState();
    clearPanelFeedback();
  }, [
    clearAllCloseTimers,
    clearPanelFeedback,
    resetClosingFlags,
    resetOverlayState,
    setStage
  ]);

  const navigateHome = useCallback(() => {
    clearAllCloseTimers();
    resetClosingFlags();
    setStage("welcome");
    resetOverlayState();
    clearApiKeyDraft();
    clearPanelFeedback();
  }, [
    clearAllCloseTimers,
    clearApiKeyDraft,
    clearPanelFeedback,
    resetClosingFlags,
    resetOverlayState,
    setStage
  ]);

  return {
    navigateHome,
    navigateTo
  };
}
