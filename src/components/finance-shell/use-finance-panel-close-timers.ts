"use client";

import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

type UseFinancePanelCloseTimersParams = {
  resetPreview: () => void;
  setIsClosingSettings: Dispatch<SetStateAction<boolean>>;
  setIsClosingUpload: Dispatch<SetStateAction<boolean>>;
  setIsClosingUserSelect: Dispatch<SetStateAction<boolean>>;
  setShowCreateUserSubmenu: Dispatch<SetStateAction<boolean>>;
  setShowSettingsView: Dispatch<SetStateAction<boolean>>;
  setShowUploadView: Dispatch<SetStateAction<boolean>>;
  setShowUserSelectView: Dispatch<SetStateAction<boolean>>;
};

function clearTimer(timerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>) {
  if (timerRef.current) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

export function useFinancePanelCloseTimers({
  resetPreview,
  setIsClosingSettings,
  setIsClosingUpload,
  setIsClosingUserSelect,
  setShowCreateUserSubmenu,
  setShowSettingsView,
  setShowUploadView,
  setShowUserSelectView
}: UseFinancePanelCloseTimersParams) {
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

  const clearAllCloseTimers = useCallback(() => {
    clearTimer(closeUploadTimerRef);
    clearTimer(closeSettingsTimerRef);
    clearTimer(closeUserSelectTimerRef);
  }, []);

  const resetClosingFlags = useCallback(() => {
    setIsClosingUpload(false);
    setIsClosingSettings(false);
    setIsClosingUserSelect(false);
  }, [setIsClosingSettings, setIsClosingUpload, setIsClosingUserSelect]);

  const triggerCloseUpload = useCallback(() => {
    clearTimer(closeUploadTimerRef);
    setIsClosingUpload(true);
    closeUploadTimerRef.current = setTimeout(() => {
      closeUploadTimerRef.current = null;
      setShowUploadView(false);
      resetPreview();
      setIsClosingUpload(false);
    }, 250);
  }, [resetPreview, setIsClosingUpload, setShowUploadView]);

  const triggerCloseSettings = useCallback(() => {
    clearTimer(closeSettingsTimerRef);
    setIsClosingSettings(true);
    closeSettingsTimerRef.current = setTimeout(() => {
      closeSettingsTimerRef.current = null;
      setShowSettingsView(false);
      setIsClosingSettings(false);
    }, 250);
  }, [setIsClosingSettings, setShowSettingsView]);

  const triggerCloseUserSelect = useCallback(() => {
    clearTimer(closeUserSelectTimerRef);
    setIsClosingUserSelect(true);
    closeUserSelectTimerRef.current = setTimeout(() => {
      closeUserSelectTimerRef.current = null;
      setShowUserSelectView(false);
      setIsClosingUserSelect(false);
      setShowCreateUserSubmenu(false);
    }, 250);
  }, [
    setIsClosingUserSelect,
    setShowCreateUserSubmenu,
    setShowUserSelectView
  ]);

  return {
    clearAllCloseTimers,
    resetClosingFlags,
    triggerCloseSettings,
    triggerCloseUpload,
    triggerCloseUserSelect
  };
}
