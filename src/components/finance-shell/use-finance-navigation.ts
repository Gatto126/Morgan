"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";

import type { SettingsSection } from "./settings-panel";

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

function clearTimer(timerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>) {
  if (timerRef.current) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

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

  const closeUploadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeSettingsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeUserSelectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      clearTimer(closeUploadTimerRef);
      clearTimer(closeSettingsTimerRef);
      clearTimer(closeUserSelectTimerRef);
    };
  }, []);

  const triggerCloseUpload = useCallback(() => {
    clearTimer(closeUploadTimerRef);
    setIsClosingUpload(true);
    closeUploadTimerRef.current = setTimeout(() => {
      closeUploadTimerRef.current = null;
      setShowUploadView(false);
      resetPreview();
      setIsClosingUpload(false);
    }, 250);
  }, [resetPreview]);

  const clearAllCloseTimers = useCallback(() => {
    clearTimer(closeUploadTimerRef);
    clearTimer(closeSettingsTimerRef);
    clearTimer(closeUserSelectTimerRef);
  }, []);

  const resetClosingFlags = useCallback(() => {
    setIsClosingUpload(false);
    setIsClosingSettings(false);
    setIsClosingUserSelect(false);
  }, []);

  const triggerCloseSettings = useCallback(() => {
    clearTimer(closeSettingsTimerRef);
    setIsClosingSettings(true);
    closeSettingsTimerRef.current = setTimeout(() => {
      closeSettingsTimerRef.current = null;
      setShowSettingsView(false);
      setIsClosingSettings(false);
    }, 250);
  }, []);

  const triggerCloseUserSelect = useCallback(() => {
    clearTimer(closeUserSelectTimerRef);
    setIsClosingUserSelect(true);
    closeUserSelectTimerRef.current = setTimeout(() => {
      closeUserSelectTimerRef.current = null;
      setShowUserSelectView(false);
      setIsClosingUserSelect(false);
      setShowCreateUserSubmenu(false);
    }, 250);
  }, []);

  const navigateTo = useCallback((newStage: Stage) => {
    clearAllCloseTimers();
    resetClosingFlags();
    setStage(newStage);
    setShowUploadView(false);
    setShowSettingsView(false);
    setShowUserSelectView(false);
    setShowCreateUserSubmenu(false);
    setActiveSettingsSection(null);
    clearPanelFeedback();
  }, [clearAllCloseTimers, clearPanelFeedback, resetClosingFlags]);

  const navigateHome = useCallback(() => {
    clearAllCloseTimers();
    resetClosingFlags();
    setStage("welcome");
    setShowUploadView(false);
    setShowSettingsView(false);
    setShowUserSelectView(false);
    setShowCreateUserSubmenu(false);
    setActiveSettingsSection(null);
    clearApiKeyDraft();
    clearPanelFeedback();
  }, [clearAllCloseTimers, clearApiKeyDraft, clearPanelFeedback, resetClosingFlags]);

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
    showSettingsView,
    triggerCloseSettings
  ]);

  const handleCloseSettings = useCallback(() => {
    triggerCloseSettings();
    setActiveSettingsSection(null);
    clearPanelFeedback();
  }, [clearPanelFeedback, triggerCloseSettings]);

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
  }, [activeSettingsSection, clearApiKeyDraft, clearPanelFeedback]);

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
