"use client";

import { SettingsApiKeySection } from "./settings-api-key-section";
import { SettingsDangerZoneSection } from "./settings-danger-zone-section";
import { SettingsGeneralSection } from "./settings-general-section";
import { SettingsMenu } from "./settings-menu";
import type { SettingsSection } from "./settings-panel-types";

import { cn } from "@/shared/utils";

export type { SettingsSection } from "./settings-panel-types";

type SettingsPanelProps = {
  accountName: string;
  activeSection: SettingsSection | null;
  hasActiveUser: boolean;
  isApiKeySaved: boolean;
  binanceApiKeyPreview: string | null;
  binanceKeyInput: string;
  binanceSecretInput: string;
  showSecret: boolean;
  isTesting: boolean;
  showDeleteApiConfirm: boolean;
  error: string | null;
  notice: string | null;
  onSelectSection: (section: SettingsSection) => void;
  onBackToMenu: () => void;
  onSignOut: () => void;
  onBinanceKeyChange: (value: string) => void;
  onBinanceSecretChange: (value: string) => void;
  onToggleSecret: () => void;
  onToggleDeleteApiConfirm: () => void;
  onDeleteApiKeys: (deleteData: boolean) => void;
  onSaveApiKeys: () => void;
  onDeleteAccount: () => void;
};

export function SettingsPanel({
  accountName,
  activeSection,
  hasActiveUser,
  isApiKeySaved,
  binanceApiKeyPreview,
  binanceKeyInput,
  binanceSecretInput,
  showSecret,
  isTesting,
  showDeleteApiConfirm,
  error,
  notice,
  onSelectSection,
  onBackToMenu,
  onSignOut,
  onBinanceKeyChange,
  onBinanceSecretChange,
  onToggleSecret,
  onToggleDeleteApiConfirm,
  onDeleteApiKeys,
  onSaveApiKeys,
  onDeleteAccount
}: SettingsPanelProps) {
  const isOpen = activeSection !== null;

  return (
    <div className="mx-auto flex w-full max-w-[850px] items-stretch text-left justify-start md:h-[380px] h-full">
      <SettingsMenu
        activeSection={activeSection}
        hasActiveUser={hasActiveUser}
        isOpen={isOpen}
        onSelectSection={onSelectSection}
      />

      <div
        className={cn(
          "flex flex-row items-stretch transition-all duration-300 ease-in-out overflow-hidden h-full w-full md:w-auto",
          isOpen ? "w-full md:w-[470px] opacity-100 translate-x-0" : "w-0 opacity-0 -translate-x-4 pointer-events-none"
        )}
      >
        {isOpen ? (
          <>
            <div className="hidden md:block w-[2px] bg-[color:var(--line-strong)] opacity-30 self-stretch shrink-0 mx-8" />

            <div className="w-full md:w-[398px] shrink-0 flex flex-col h-full overflow-y-auto pr-2 hide-scrollbar py-3 md:py-4">
              <div key={activeSection} className="flex-1 flex flex-col h-full animate-submenu-in">
                <button
                  type="button"
                  onClick={onBackToMenu}
                  className="md:hidden flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[color:var(--text-dim)] hover:text-white mb-4 self-start cursor-pointer"
                >
                  &lt; Back to settings
                </button>

                {activeSection === "general" ? (
                  <SettingsGeneralSection
                    accountName={accountName}
                    onSignOut={onSignOut}
                  />
                ) : null}

                {activeSection === "apiKey" ? (
                  <SettingsApiKeySection
                    binanceApiKeyPreview={binanceApiKeyPreview}
                    binanceKeyInput={binanceKeyInput}
                    binanceSecretInput={binanceSecretInput}
                    error={error}
                    isApiKeySaved={isApiKeySaved}
                    isTesting={isTesting}
                    notice={notice}
                    showDeleteApiConfirm={showDeleteApiConfirm}
                    showSecret={showSecret}
                    onBinanceKeyChange={onBinanceKeyChange}
                    onBinanceSecretChange={onBinanceSecretChange}
                    onDeleteApiKeys={onDeleteApiKeys}
                    onSaveApiKeys={onSaveApiKeys}
                    onToggleDeleteApiConfirm={onToggleDeleteApiConfirm}
                    onToggleSecret={onToggleSecret}
                  />
                ) : null}

                {activeSection === "dangerZone" && hasActiveUser ? (
                  <SettingsDangerZoneSection onDeleteAccount={onDeleteAccount} />
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
