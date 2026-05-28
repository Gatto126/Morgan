import type { ReactNode } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

type DashboardPanelHostProps = {
  children: ReactNode;
  showUploadView: boolean;
  isClosingUpload: boolean;
  onCloseUpload?: () => void;
  uploadElement?: ReactNode;
  reviewElement?: ReactNode;
  previewTransactionsCount: number;
  showSettingsView: boolean;
  isClosingSettings: boolean;
  onCloseSettings?: () => void;
  settingsElement?: ReactNode;
  showUserSelectView: boolean;
  isClosingUserSelect: boolean;
  onCloseUserSelect?: () => void;
  userSelectElement?: ReactNode;
};

function CloseButton({
  onClick,
  title
}: {
  onClick?: () => void;
  title: string;
}) {
  return (
    <div
      role="button"
      onClick={onClick}
      className="absolute right-0 top-0 z-50 flex h-8 w-8 cursor-pointer items-center justify-center text-[color:var(--text-dim)] transition-colors hover:text-white"
      title={title}
    >
      <X className="h-5 w-5" strokeWidth={2.3} />
    </div>
  );
}

function PanelOverlay({
  children,
  isClosing
}: {
  children: ReactNode;
  isClosing: boolean;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-20 flex h-full w-full flex-col justify-center overflow-hidden rounded-[18px] bg-[color:var(--surface-canvas)]",
        isClosing ? "upload-panel-exit pointer-events-none" : "upload-panel-enter"
      )}
    >
      {children}
    </div>
  );
}

export function DashboardPanelHost({
  children,
  showUploadView,
  isClosingUpload,
  onCloseUpload,
  uploadElement,
  reviewElement,
  previewTransactionsCount,
  showSettingsView,
  isClosingSettings,
  onCloseSettings,
  settingsElement,
  showUserSelectView,
  isClosingUserSelect,
  onCloseUserSelect,
  userSelectElement
}: DashboardPanelHostProps) {
  const isPanelClosing =
    (showUploadView && isClosingUpload) ||
    (showSettingsView && isClosingSettings) ||
    (showUserSelectView && isClosingUserSelect);

  const panel = showUploadView ? (
    <PanelOverlay isClosing={isClosingUpload}>
        <CloseButton onClick={onCloseUpload} title="Esci dall'importazione" />
        {previewTransactionsCount > 0 ? reviewElement : uploadElement}
    </PanelOverlay>
  ) : showSettingsView ? (
    <PanelOverlay isClosing={isClosingSettings}>
        <CloseButton onClick={onCloseSettings} title="Esci dalle impostazioni" />
        {settingsElement}
    </PanelOverlay>
  ) : showUserSelectView ? (
    <PanelOverlay isClosing={isClosingUserSelect}>
        <CloseButton onClick={onCloseUserSelect} title="Esci dalla selezione utente" />
        {userSelectElement}
    </PanelOverlay>
  ) : null;

  return (
    <div className="relative h-full min-h-0 w-full overflow-hidden rounded-[18px]">
      <div
        className={cn("panel-content-reveal absolute inset-0 z-0 flex h-full min-h-0 w-full flex-col", panel && "pointer-events-none")}
        data-visible={!panel || isPanelClosing ? "true" : "false"}
      >
        {children}
      </div>
      {panel}
    </div>
  );
}
