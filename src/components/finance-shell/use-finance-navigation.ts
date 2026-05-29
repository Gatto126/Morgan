"use client";

import { useState } from "react";

import type { SettingsSection } from "./settings-panel-types";
import { useFinanceOverlayNavigation } from "./use-finance-overlay-navigation";
import { useFinancePanelCloseTimers } from "./use-finance-panel-close-timers";
import { useFinanceStageNavigation } from "./use-finance-stage-navigation";

export type Stage = "welcome" | "select" | "create" | "dashboard" | "checking" | "investment" | "settings" | "binance" | "crypto";

type UseFinanceNavigationOptions = {
  initialStage: Stage;
  initialShowUploadView: boolean;
  hasActiveUser: boolean;
  hasUsers: boolean;
  resetPreview: () => void;
  clearApiKeyDraft: () => void;
  clearPanelFeedback: () => void;
};

export function shouldAutoOpenUpload(transactionCount: number | null, stage: Stage) {
  void transactionCount;
  void stage;
  return false;
}

export function useFinanceNavigation({
  initialStage,
  initialShowUploadView,
  hasActiveUser,
  hasUsers,
  resetPreview,
  clearApiKeyDraft,
  clearPanelFeedback
}: UseFinanceNavigationOptions) {
  const [stage, setStage] = useState<Stage>(initialStage);
  const [showUploadView, setShowUploadView] = useState(initialShowUploadView);
  const [isClosingUpload, setIsClosingUpload] = useState(false);
  const [showSettingsView, setShowSettingsView] = useState(false);
  const [isClosingSettings, setIsClosingSettings] = useState(false);
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSection | null>(
    initialStage === "settings" ? "general" : null
  );
  const [showUserSelectView, setShowUserSelectView] = useState(false);
  const [isClosingUserSelect, setIsClosingUserSelect] = useState(false);
  const [showCreateUserSubmenu, setShowCreateUserSubmenu] = useState(false);

  const {
    clearAllCloseTimers,
    resetClosingFlags,
    triggerCloseSettings,
    triggerCloseUpload,
    triggerCloseUserSelect
  } = useFinancePanelCloseTimers({
    resetPreview,
    setIsClosingSettings,
    setIsClosingUpload,
    setIsClosingUserSelect,
    setShowCreateUserSubmenu,
    setShowSettingsView,
    setShowUploadView,
    setShowUserSelectView
  });
  const {
    navigateHome,
    navigateTo
  } = useFinanceStageNavigation({
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
  });
  const {
    handleCloseSettings,
    handleCloseUpload,
    handleCloseUserSelect,
    handlePlusClick,
    handleSettingsClick,
    handleUserSelectClick,
    toggleSettingsSection
  } = useFinanceOverlayNavigation({
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
  });

  return {
    stage,
    setStage,
    showUploadView,
    setShowUploadView,
    isClosingUpload,
    showSettingsView,
    setShowSettingsView,
    isClosingSettings,
    activeSettingsSection,
    setActiveSettingsSection,
    showUserSelectView,
    setShowUserSelectView,
    isClosingUserSelect,
    setIsClosingUserSelect,
    showCreateUserSubmenu,
    setShowCreateUserSubmenu,
    handlePlusClick,
    handleCloseUpload,
    handleSettingsClick,
    handleCloseSettings,
    handleUserSelectClick,
    handleCloseUserSelect,
    navigateTo,
    navigateHome,
    toggleSettingsSection
  };
}
