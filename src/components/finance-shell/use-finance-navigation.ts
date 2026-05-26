"use client";

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";

import type { SettingsSection } from "./settings-panel";

export type Stage = "welcome" | "select" | "create" | "dashboard" | "checking" | "investment" | "settings" | "binance" | "crypto";

type UseFinanceNavigationOptions = {
  initialStage: Stage;
  initialShowUploadView: boolean;
  hasActiveUser: boolean;
  activeUserTransactionCount: number | null;
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

export function useFinanceNavigation({
  initialStage,
  initialShowUploadView,
  hasActiveUser,
  activeUserTransactionCount,
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

  const closeUploadImmediately = useCallback(() => {
    clearTimer(closeUploadTimerRef);
    setIsClosingUpload(false);
    setShowUploadView(false);
    resetPreview();
  }, [resetPreview]);

  const closeSettingsImmediately = useCallback(() => {
    clearTimer(closeSettingsTimerRef);
    setIsClosingSettings(false);
    setShowSettingsView(false);
    setActiveSettingsSection(null);
  }, []);

  const closeUserSelectImmediately = useCallback(() => {
    clearTimer(closeUserSelectTimerRef);
    setIsClosingUserSelect(false);
    setShowUserSelectView(false);
    setShowCreateUserSubmenu(false);
  }, []);

  const navigateTo = useCallback((newStage: Stage) => {
    setStage(newStage);
    setShowUploadView(false);
    setShowSettingsView(false);
    setShowUserSelectView(false);
    setShowCreateUserSubmenu(false);
    setActiveSettingsSection(null);
    clearPanelFeedback();
  }, [clearPanelFeedback]);

  const navigateHome = useCallback(() => {
    setStage("welcome");
    setShowUploadView(false);
    setShowSettingsView(false);
    setShowUserSelectView(false);
    setShowCreateUserSubmenu(false);
    setActiveSettingsSection(null);
    clearApiKeyDraft();
    clearPanelFeedback();
  }, [clearApiKeyDraft, clearPanelFeedback]);

  const handlePlusClick = useCallback(() => {
    if (showSettingsView) {
      closeSettingsImmediately();
    }
    if (showUserSelectView) {
      closeUserSelectImmediately();
    }
    if (activeUserTransactionCount === 0) {
      clearTimer(closeUploadTimerRef);
      setIsClosingUpload(false);
      setShowUploadView(true);
      return;
    }
    if (showUploadView) {
      triggerCloseUpload();
    } else {
      clearTimer(closeUploadTimerRef);
      setIsClosingUpload(false);
      setShowUploadView(true);
    }
  }, [
    activeUserTransactionCount,
    closeSettingsImmediately,
    closeUserSelectImmediately,
    showSettingsView,
    showUploadView,
    showUserSelectView,
    triggerCloseUpload
  ]);

  const handleCloseUpload = useCallback(() => {
    if (activeUserTransactionCount === 0) {
      clearTimer(closeUploadTimerRef);
      setIsClosingUpload(false);
      setShowUploadView(true);
      return;
    }
    triggerCloseUpload();
  }, [activeUserTransactionCount, triggerCloseUpload]);

  const handleSettingsClick = useCallback(() => {
    if (showUploadView) {
      closeUploadImmediately();
    }
    if (showUserSelectView) {
      closeUserSelectImmediately();
    }
    if (showSettingsView) {
      triggerCloseSettings();
      setActiveSettingsSection(null);
      clearPanelFeedback();
    } else {
      clearTimer(closeSettingsTimerRef);
      setIsClosingSettings(false);
      setActiveSettingsSection("general");
      clearPanelFeedback();
      clearApiKeyDraft();
      setShowSettingsView(true);
    }
  }, [
    clearApiKeyDraft,
    clearPanelFeedback,
    closeUploadImmediately,
    closeUserSelectImmediately,
    showSettingsView,
    showUploadView,
    showUserSelectView,
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
    if (showUploadView) {
      closeUploadImmediately();
    }
    if (showSettingsView) {
      closeSettingsImmediately();
    }
    if (showUserSelectView) {
      triggerCloseUserSelect();
    } else {
      clearTimer(closeUserSelectTimerRef);
      setIsClosingUserSelect(false);
      setShowCreateUserSubmenu(false);
      setShowUserSelectView(true);
    }
  }, [
    closeSettingsImmediately,
    closeUploadImmediately,
    hasActiveUser,
    hasUsers,
    navigateTo,
    showSettingsView,
    showUploadView,
    showUserSelectView,
    triggerCloseUserSelect
  ]);

  const handleCloseUserSelect = useCallback(() => {
    triggerCloseUserSelect();
  }, [triggerCloseUserSelect]);

  const toggleSettingsSection = useCallback((section: SettingsSection) => {
    clearPanelFeedback();
    if (section === "apiKey") {
      clearApiKeyDraft();
    }
    setActiveSettingsSection((prev) => (prev === section ? null : section));
  }, [clearApiKeyDraft, clearPanelFeedback]);

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
