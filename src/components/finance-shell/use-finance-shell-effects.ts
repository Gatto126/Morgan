"use client";

import { useEffect, type Dispatch, type RefObject, type SetStateAction } from "react";

import type { SettingsSection } from "./settings-panel-types";

type UsePreviewUploadOverlayParams = {
  previewTransactionCount: number;
  setActiveSettingsSection: Dispatch<SetStateAction<SettingsSection | null>>;
  setShowCreateUserSubmenu: Dispatch<SetStateAction<boolean>>;
  setShowSettingsView: Dispatch<SetStateAction<boolean>>;
  setShowUploadView: Dispatch<SetStateAction<boolean>>;
  setShowUserSelectView: Dispatch<SetStateAction<boolean>>;
};

export function useCreateUserInputFocus(
  showCreateUserSubmenu: boolean,
  createUserInputRef: RefObject<HTMLInputElement | null>
) {
  useEffect(() => {
    if (showCreateUserSubmenu && createUserInputRef.current) {
      const timer = window.setTimeout(() => {
        createUserInputRef.current?.focus({ preventScroll: true });
      }, 300);
      return () => window.clearTimeout(timer);
    }
  }, [createUserInputRef, showCreateUserSubmenu]);
}

export function usePreviewUploadOverlay({
  previewTransactionCount,
  setActiveSettingsSection,
  setShowCreateUserSubmenu,
  setShowSettingsView,
  setShowUploadView,
  setShowUserSelectView
}: UsePreviewUploadOverlayParams) {
  useEffect(() => {
    if (previewTransactionCount === 0) {
      return;
    }

    setShowUploadView(true);
    setShowSettingsView(false);
    setShowUserSelectView(false);
    setShowCreateUserSubmenu(false);
    setActiveSettingsSection(null);
  }, [
    previewTransactionCount,
    setActiveSettingsSection,
    setShowCreateUserSubmenu,
    setShowSettingsView,
    setShowUploadView,
    setShowUserSelectView
  ]);
}
