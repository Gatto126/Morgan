import type { ReactNode } from "react";
import { X } from "lucide-react";

import { cn } from "@/shared/utils";

type DashboardChartOverlayPanelProps = {
  isClosingSettings: boolean;
  isClosingUpload: boolean;
  isClosingUserSelect: boolean;
  onCloseSettings?: () => void;
  onCloseUpload?: () => void;
  onCloseUserSelect?: () => void;
  previewTransactionsCount: number;
  reviewElement?: ReactNode;
  settingsElement?: ReactNode;
  shouldShowUploadPanel: boolean;
  showSettingsView: boolean;
  showUserSelectView: boolean;
  uploadElement?: ReactNode;
  userSelectElement?: ReactNode;
};

function OverlayPanel({
  children,
  isClosing,
  onClose,
  title
}: {
  children?: ReactNode;
  isClosing: boolean;
  onClose?: () => void;
  title: string;
}) {
  return (
    <div className={cn("absolute inset-0 z-20 flex h-full w-full flex-col justify-center overflow-hidden rounded-[18px] bg-[color:var(--surface-canvas)]", isClosing ? "upload-panel-exit pointer-events-none" : "upload-panel-enter")}>
      <div
        role="button"
        onClick={onClose}
        className="absolute right-0 top-0 z-50 flex h-8 w-8 cursor-pointer items-center justify-center text-[color:var(--text-dim)] transition-colors hover:text-white"
        title={title}
      >
        <X className="h-5 w-5" strokeWidth={2.3} />
      </div>
      {children}
    </div>
  );
}

export function DashboardChartOverlayPanel({
  isClosingSettings,
  isClosingUpload,
  isClosingUserSelect,
  onCloseSettings,
  onCloseUpload,
  onCloseUserSelect,
  previewTransactionsCount,
  reviewElement,
  settingsElement,
  shouldShowUploadPanel,
  showSettingsView,
  showUserSelectView,
  uploadElement,
  userSelectElement
}: DashboardChartOverlayPanelProps) {
  if (showSettingsView) {
    return (
      <OverlayPanel isClosing={isClosingSettings} onClose={onCloseSettings} title="Esci dalle impostazioni">
        {settingsElement}
      </OverlayPanel>
    );
  }

  if (showUserSelectView) {
    return (
      <OverlayPanel isClosing={isClosingUserSelect} onClose={onCloseUserSelect} title="Esci dalla selezione utente">
        {userSelectElement}
      </OverlayPanel>
    );
  }

  if (shouldShowUploadPanel) {
    return (
      <OverlayPanel isClosing={isClosingUpload} onClose={onCloseUpload} title="Esci dall'importazione">
        {previewTransactionsCount > 0 ? reviewElement : uploadElement}
      </OverlayPanel>
    );
  }

  return null;
}
