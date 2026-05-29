import type { ReactNode, RefObject } from "react";

import { X as XIcon } from "lucide-react";

import type { Stage } from "./use-finance-navigation";

import { cn } from "@/shared/utils";

export const frameOverlayPanelMotionDurationMs = 250;

const overlayCloseButtonClass =
  "icon-plain absolute z-50 flex h-8 w-8 cursor-pointer appearance-none items-center justify-center border-0 bg-transparent p-0 text-[color:var(--text-dim)] shadow-none transition-colors hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color:var(--line-strong)]";

export type FrameOverlayPanelType = "upload" | "settings" | "profile";

export type FrameOverlayPanelConfig = {
  closeTitle: string;
  handleClosePanel: () => void;
  isClosingPanel: boolean;
  key: string;
  panelContent: ReactNode;
  panelLabel: string;
  panelType: FrameOverlayPanelType;
  shouldShowClose: boolean;
};

export type ExitingFrameOverlayPanelConfig = FrameOverlayPanelConfig & {
  exitId: string;
};

type ResolveFrameOverlayPanelParams = {
  activeUserPresent: boolean;
  isClosingSettings: boolean;
  isClosingUpload: boolean;
  isClosingUserSelect: boolean;
  isDashboardStage: boolean;
  renderSettingsContent: () => ReactNode;
  renderUploadContent: () => ReactNode;
  renderUserSelectContent: () => ReactNode;
  showSettingsView: boolean;
  showUploadView: boolean;
  showUserSelectView: boolean;
  stage: Stage;
  onCloseSettings: () => void;
  onCloseUpload: () => void;
  onCloseUserSelect: () => void;
};

type FrameOverlayPanelsProps = {
  activePanel: FrameOverlayPanelConfig | null;
  activePanelRef: RefObject<HTMLDivElement | null>;
  exitingPanel: ExitingFrameOverlayPanelConfig | null;
};

type FrameOverlayPanelProps = {
  activePanelRef: RefObject<HTMLDivElement | null>;
  motionState?: "active" | "exit";
  panel: FrameOverlayPanelConfig | ExitingFrameOverlayPanelConfig;
};

export function resolveFrameOverlayPanel({
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
}: ResolveFrameOverlayPanelParams): FrameOverlayPanelConfig | null {
  const canRenderFrameOverlay = stage === "welcome" || (isDashboardStage && activeUserPresent);

  if (!canRenderFrameOverlay) {
    return null;
  }

  const showUploadPanel = showUploadView;
  const showSettingsPanel = !showUploadPanel && showSettingsView;
  const showUserSelectPanel = !showUploadPanel && !showSettingsPanel && showUserSelectView;

  if (!showUploadPanel && !showSettingsPanel && !showUserSelectPanel) {
    return null;
  }

  const isClosingPanel = showUploadPanel
    ? isClosingUpload
    : showSettingsPanel
      ? isClosingSettings
      : isClosingUserSelect;
  const panelType = showUploadPanel ? "upload" : showSettingsPanel ? "settings" : "profile";

  return {
    closeTitle: showUploadPanel
      ? "Esci dall'importazione"
      : showSettingsPanel
        ? "Esci dalle impostazioni"
        : "Esci dalla selezione utente",
    handleClosePanel: showUploadPanel
      ? onCloseUpload
      : showSettingsPanel
        ? onCloseSettings
        : onCloseUserSelect,
    isClosingPanel,
    key: `${stage}:${panelType}`,
    panelContent: showUploadPanel
      ? renderUploadContent()
      : showSettingsPanel
        ? renderSettingsContent()
        : renderUserSelectContent(),
    panelLabel: showUploadPanel
      ? "Import transactions"
      : showSettingsPanel
        ? "Settings"
        : "Select profile",
    panelType,
    shouldShowClose: true
  };
}

export function FrameOverlayPanels({
  activePanel,
  activePanelRef,
  exitingPanel
}: FrameOverlayPanelsProps) {
  if (!activePanel && !exitingPanel) {
    return null;
  }

  return (
    <>
      {activePanel ? (
        <FrameOverlayPanel
          activePanelRef={activePanelRef}
          key={activePanel.key}
          panel={activePanel}
        />
      ) : null}
      {exitingPanel ? (
        <FrameOverlayPanel
          activePanelRef={activePanelRef}
          key={exitingPanel.exitId}
          motionState="exit"
          panel={exitingPanel}
        />
      ) : null}
    </>
  );
}

function FrameOverlayPanel({
  activePanelRef,
  motionState = "active",
  panel
}: FrameOverlayPanelProps) {
  const isExitSnapshot = motionState === "exit";
  const isExiting = isExitSnapshot || panel.isClosingPanel;

  return (
    <div
      aria-hidden={isExitSnapshot ? "true" : undefined}
      aria-label={isExitSnapshot ? undefined : panel.panelLabel}
      className={cn(
        "absolute inset-0 flex h-full w-full flex-col justify-center overflow-hidden rounded-[18px] bg-[color:var(--surface-canvas)] focus:outline-none",
        isExitSnapshot ? "z-[56] pointer-events-none" : "z-[55]"
      )}
      data-autofocus={isExitSnapshot ? undefined : ""}
      data-exiting-panel={isExitSnapshot ? panel.panelType : undefined}
      data-modal-panel={isExitSnapshot ? undefined : panel.panelType}
      inert={isExitSnapshot ? true : undefined}
      ref={isExitSnapshot ? undefined : activePanelRef}
      role={isExitSnapshot ? undefined : "dialog"}
      tabIndex={isExitSnapshot ? undefined : -1}
    >
      <div
        data-panel-motion={isExiting ? "exit" : "enter"}
        className={cn(
          "relative h-full w-full",
          isExiting ? "panel-overlay-exit pointer-events-none" : "panel-overlay-enter"
        )}
      >
        {!isExitSnapshot && panel.shouldShowClose ? (
          <button
            aria-label={panel.closeTitle}
            className={cn(overlayCloseButtonClass, "right-4 top-4")}
            onClick={panel.handleClosePanel}
            title={panel.closeTitle}
            type="button"
          >
            <XIcon className="h-5 w-5" strokeWidth={2.3} />
          </button>
        ) : null}
        <div className="relative flex h-full w-full flex-col justify-center px-3 py-3 sm:px-5 sm:py-5">
          {panel.panelContent}
        </div>
      </div>
    </div>
  );
}
