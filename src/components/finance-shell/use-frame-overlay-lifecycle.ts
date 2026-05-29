"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";

import {
  frameOverlayPanelMotionDurationMs,
  resolveFrameOverlayPanel,
  type ExitingFrameOverlayPanelConfig,
  type FrameOverlayPanelConfig
} from "./frame-overlay-panels";
import { useInertElements, useModalFocusTrap } from "./use-modal-accessibility";
import type { Stage } from "./use-finance-navigation";

type UseFrameOverlayLifecycleParams = {
  activeOverlayPanelRef: RefObject<HTMLDivElement | null>;
  activeUserPresent: boolean;
  appContentRef: RefObject<HTMLDivElement | null>;
  dashboardBackgroundRef: RefObject<HTMLDivElement | null>;
  dashboardCardsPortalRef: RefObject<HTMLDivElement | null>;
  dashboardTabsPortalRef: RefObject<HTMLDivElement | null>;
  isClosingSettings: boolean;
  isClosingUpload: boolean;
  isClosingUserSelect: boolean;
  isDashboardStage: boolean;
  renderSettingsContent: () => ReactNode;
  renderUploadContent: () => ReactNode;
  renderUserSelectContent: () => ReactNode;
  showDeleteAccountConfirm: boolean;
  showSettingsView: boolean;
  showUploadView: boolean;
  showUserSelectView: boolean;
  stage: Stage;
  welcomeBackgroundRef: RefObject<HTMLDivElement | null>;
  onCloseActiveOverlayPanel: () => void;
  onCloseSettings: () => void;
  onCloseUpload: () => void;
  onCloseUserSelect: () => void;
};

export function useFrameOverlayLifecycle({
  activeOverlayPanelRef,
  activeUserPresent,
  appContentRef,
  dashboardBackgroundRef,
  dashboardCardsPortalRef,
  dashboardTabsPortalRef,
  isClosingSettings,
  isClosingUpload,
  isClosingUserSelect,
  isDashboardStage,
  renderSettingsContent,
  renderUploadContent,
  renderUserSelectContent,
  showDeleteAccountConfirm,
  showSettingsView,
  showUploadView,
  showUserSelectView,
  stage,
  welcomeBackgroundRef,
  onCloseActiveOverlayPanel,
  onCloseSettings,
  onCloseUpload,
  onCloseUserSelect
}: UseFrameOverlayLifecycleParams) {
  const isDashboardPanelModalOpen =
    isDashboardStage && activeUserPresent && (showUploadView || showSettingsView || showUserSelectView);
  const isWelcomePanelModalOpen =
    stage === "welcome" && (showUploadView || showSettingsView || showUserSelectView);
  const isPanelModalOpen = isDashboardPanelModalOpen || isWelcomePanelModalOpen;
  const isOverlayPanelClosing =
    (showUploadView && isClosingUpload) ||
    (showSettingsView && isClosingSettings) ||
    (showUserSelectView && isClosingUserSelect);
  const isDashboardBackgroundVisible = !isDashboardPanelModalOpen || isOverlayPanelClosing;
  const isWelcomeBackgroundVisible = !isWelcomePanelModalOpen || isOverlayPanelClosing;
  const activePanelFocusKey = isDashboardPanelModalOpen
    ? `dashboard:${showUploadView ? "upload" : showSettingsView ? "settings" : "profile"}`
    : isWelcomePanelModalOpen
      ? `welcome:${showUploadView ? "upload" : showSettingsView ? "settings" : "profile"}`
      : "closed";
  const shellPanelBackgroundRefs = useMemo(
    () => [dashboardTabsPortalRef, dashboardCardsPortalRef],
    [dashboardCardsPortalRef, dashboardTabsPortalRef]
  );
  const dashboardPanelBackgroundRefs = useMemo(
    () => [dashboardBackgroundRef],
    [dashboardBackgroundRef]
  );
  const welcomePanelBackgroundRefs = useMemo(
    () => [welcomeBackgroundRef],
    [welcomeBackgroundRef]
  );
  const deleteDialogBackgroundRefs = useMemo(
    () => [appContentRef],
    [appContentRef]
  );
  const activeFramePanel = resolveFrameOverlayPanel({
    activeUserPresent,
    isClosingSettings,
    isClosingUpload,
    isClosingUserSelect,
    isDashboardStage,
    renderSettingsContent,
    renderUploadContent,
    renderUserSelectContent,
    showSettingsView,
    showUploadView,
    showUserSelectView,
    stage,
    onCloseSettings,
    onCloseUpload,
    onCloseUserSelect
  });
  const previousFramePanelRef = useRef<FrameOverlayPanelConfig | null>(null);
  const exitingFramePanelTimerRef = useRef<number | null>(null);
  const exitingFramePanelIdRef = useRef(0);
  const [exitingFramePanel, setExitingFramePanel] = useState<ExitingFrameOverlayPanelConfig | null>(null);

  useModalFocusTrap({
    active: isPanelModalOpen && !showDeleteAccountConfirm,
    containerRef: activeOverlayPanelRef,
    focusKey: activePanelFocusKey,
    onEscape: onCloseActiveOverlayPanel
  });
  useInertElements(isPanelModalOpen, shellPanelBackgroundRefs);
  useInertElements(isDashboardPanelModalOpen, dashboardPanelBackgroundRefs);
  useInertElements(isWelcomePanelModalOpen, welcomePanelBackgroundRefs);
  useInertElements(showDeleteAccountConfirm, deleteDialogBackgroundRefs);

  useLayoutEffect(() => {
    const previousFramePanel = previousFramePanelRef.current;
    const previousKey = previousFramePanel?.key ?? null;
    const currentKey = activeFramePanel?.key ?? null;

    if (previousFramePanel && previousKey !== currentKey && currentKey === null && !previousFramePanel.isClosingPanel) {
      if (exitingFramePanelTimerRef.current) {
        window.clearTimeout(exitingFramePanelTimerRef.current);
      }

      const exitId = `${previousFramePanel.key}:exit:${exitingFramePanelIdRef.current}`;
      exitingFramePanelIdRef.current += 1;
      setExitingFramePanel({ ...previousFramePanel, exitId });
      exitingFramePanelTimerRef.current = window.setTimeout(() => {
        exitingFramePanelTimerRef.current = null;
        setExitingFramePanel(null);
      }, frameOverlayPanelMotionDurationMs);
    } else if (!activeFramePanel && previousFramePanel?.isClosingPanel && exitingFramePanel) {
      setExitingFramePanel(null);
    }

    previousFramePanelRef.current = activeFramePanel;
  }, [activeFramePanel, exitingFramePanel]);

  useEffect(() => {
    return () => {
      if (exitingFramePanelTimerRef.current) {
        window.clearTimeout(exitingFramePanelTimerRef.current);
      }
    };
  }, []);

  return {
    activeFramePanel,
    exitingFramePanel,
    isDashboardBackgroundVisible,
    isPanelModalOpen,
    isWelcomeBackgroundVisible,
    isWelcomePanelModalOpen
  };
}
