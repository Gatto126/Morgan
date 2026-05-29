"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";

import type { SettingsSection } from "./settings-panel-types";
import type { Stage } from "./use-finance-navigation";

type UseFinanceOverlayNavigationParams = {
  activeSettingsSection: SettingsSection | null;
  hasActiveUser: boolean;
  hasUsers: boolean;
  showSettingsView: boolean;
  showUploadView: boolean;
  showUserSelectView: boolean;
  clearAllCloseTimers: () => void;
  clearApiKeyDraft: () => void;
  clearPanelFeedback: () => void;
  navigateTo: (newStage: Stage) => void;
  resetClosingFlags: () => void;
  resetPreview: () => void;
  setActiveSettingsSection: Dispatch<SetStateAction<SettingsSection | null>>;
  setShowCreateUserSubmenu: Dispatch<SetStateAction<boolean>>;
  setShowSettingsView: Dispatch<SetStateAction<boolean>>;
  setShowUploadView: Dispatch<SetStateAction<boolean>>;
  setShowUserSelectView: Dispatch<SetStateAction<boolean>>;
  triggerCloseSettings: () => void;
  triggerCloseUpload: () => void;
  triggerCloseUserSelect: () => void;
};

export function useFinanceOverlayNavigation({
  activeSettingsSection,
  hasActiveUser,
  hasUsers,
  showSettingsView,
  showUploadView,
  showUserSelectView,
  clearAllCloseTimers,
  clearApiKeyDraft,
  clearPanelFeedback,
  navigateTo,
  resetClosingFlags,
  resetPreview,
  setActiveSettingsSection,
  setShowCreateUserSubmenu,
  setShowSettingsView,
  setShowUploadView,
  setShowUserSelectView,
  triggerCloseSettings,
  triggerCloseUpload,
  triggerCloseUserSelect
}: UseFinanceOverlayNavigationParams) {
  const handlePlusClick = useCallback(() => {
    if (showUploadView) {
      triggerCloseUpload();
      return;
    }

    clearAllCloseTimers();
    resetClosingFlags();
    setShowUploadView(true);
    setShowSettingsView(false);
    setActiveSettingsSection(null);
    setShowUserSelectView(false);
    setShowCreateUserSubmenu(false);
    clearPanelFeedback();
  }, [
    clearAllCloseTimers,
    clearPanelFeedback,
    resetClosingFlags,
    setActiveSettingsSection,
    setShowCreateUserSubmenu,
    setShowSettingsView,
    setShowUploadView,
    setShowUserSelectView,
    showUploadView,
    triggerCloseUpload
  ]);

  const handleCloseUpload = useCallback(() => {
    triggerCloseUpload();
  }, [triggerCloseUpload]);

  const handleSettingsClick = useCallback(() => {
    if (showSettingsView) {
      triggerCloseSettings();
      setActiveSettingsSection(null);
      clearPanelFeedback();
    } else {
      clearAllCloseTimers();
      resetClosingFlags();
      setShowUploadView(false);
      resetPreview();
      setShowUserSelectView(false);
      setShowCreateUserSubmenu(false);
      setActiveSettingsSection("general");
      clearPanelFeedback();
      clearApiKeyDraft();
      setShowSettingsView(true);
    }
  }, [
    clearAllCloseTimers,
    clearApiKeyDraft,
    clearPanelFeedback,
    resetClosingFlags,
    resetPreview,
    setActiveSettingsSection,
    setShowCreateUserSubmenu,
    setShowSettingsView,
    setShowUploadView,
    setShowUserSelectView,
    showSettingsView,
    triggerCloseSettings
  ]);

  const handleCloseSettings = useCallback(() => {
    triggerCloseSettings();
    setActiveSettingsSection(null);
    clearPanelFeedback();
  }, [clearPanelFeedback, setActiveSettingsSection, triggerCloseSettings]);

  const handleUserSelectClick = useCallback(() => {
    if (!hasActiveUser) {
      if (!hasUsers) return;
      navigateTo("select");
      return;
    }

    if (showUserSelectView) {
      triggerCloseUserSelect();
    } else {
      clearAllCloseTimers();
      resetClosingFlags();
      setShowUploadView(false);
      resetPreview();
      setShowSettingsView(false);
      setActiveSettingsSection(null);
      setShowCreateUserSubmenu(false);
      setShowUserSelectView(true);
    }
  }, [
    clearAllCloseTimers,
    hasActiveUser,
    hasUsers,
    navigateTo,
    resetClosingFlags,
    resetPreview,
    setActiveSettingsSection,
    setShowCreateUserSubmenu,
    setShowSettingsView,
    setShowUploadView,
    setShowUserSelectView,
    showUserSelectView,
    triggerCloseUserSelect
  ]);

  const handleCloseUserSelect = useCallback(() => {
    triggerCloseUserSelect();
  }, [triggerCloseUserSelect]);

  const toggleSettingsSection = useCallback((section: SettingsSection) => {
    clearPanelFeedback();
    if (section === "apiKey" && activeSettingsSection !== "apiKey") {
      clearApiKeyDraft();
    }
    setActiveSettingsSection(section);
  }, [
    activeSettingsSection,
    clearApiKeyDraft,
    clearPanelFeedback,
    setActiveSettingsSection
  ]);

  return {
    handleCloseSettings,
    handleCloseUpload,
    handleCloseUserSelect,
    handlePlusClick,
    handleSettingsClick,
    handleUserSelectClick,
    toggleSettingsSection
  };
}
