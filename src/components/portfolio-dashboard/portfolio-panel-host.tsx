import type { ReactNode } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

type PortfolioPanelHostProps = {
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

export function PortfolioPanelHost({
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
}: PortfolioPanelHostProps) {
  if (showUploadView) {
    return (
      <div className={cn("relative w-full h-full flex flex-col justify-center", isClosingUpload ? "upload-panel-exit" : "upload-panel-enter")}>
        <CloseButton onClick={onCloseUpload} title="Esci dall'importazione" />
        {previewTransactionsCount > 0 ? reviewElement : uploadElement}
      </div>
    );
  }

  if (showSettingsView) {
    return (
      <div className={cn("relative w-full h-full flex flex-col justify-center", isClosingSettings ? "upload-panel-exit" : "upload-panel-enter")}>
        <CloseButton onClick={onCloseSettings} title="Esci dalle impostazioni" />
        {settingsElement}
      </div>
    );
  }

  if (showUserSelectView) {
    return (
      <div className={cn("relative w-full h-full flex flex-col justify-center", isClosingUserSelect ? "upload-panel-exit" : "upload-panel-enter")}>
        <CloseButton onClick={onCloseUserSelect} title="Esci dalla selezione utente" />
        {userSelectElement}
      </div>
    );
  }

  return <>{children}</>;
}
