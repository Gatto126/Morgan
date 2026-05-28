"use client";

import { CircleCheckBig, Eye, EyeOff, LogOut, RefreshCcwDot, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SettingsSection = "general" | "apiKey" | "dangerZone";

type SettingsNavButtonProps = {
  eyebrow: string;
  isActive: boolean;
  isDanger?: boolean;
  label: string;
  onClick: () => void;
};

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

function SettingsNavButton({
  eyebrow,
  isActive,
  isDanger = false,
  label,
  onClick,
}: SettingsNavButtonProps) {
  return (
    <button
      aria-pressed={isActive}
      className="group block w-full cursor-pointer select-none space-y-1 bg-transparent p-0 text-left"
      onClick={onClick}
      type="button"
    >
      <span
        className={cn(
          "block text-2xl font-bold tracking-[-0.06em] transition-colors duration-200 md:text-3xl sm:text-[2.2rem]",
          isActive
            ? isDanger ? "text-[color:var(--danger)]" : "text-white"
            : isDanger
              ? "text-[color:var(--text-dim)] group-hover:text-[color:var(--danger)]"
              : "text-[color:var(--text-dim)] group-hover:text-white"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "block text-[10px] font-bold uppercase tracking-[0.18em] transition-colors duration-200",
          isActive
            ? isDanger ? "text-[color:var(--danger)]/80" : "text-[color:var(--text-dim)]"
            : isDanger
              ? "text-[color:var(--text-dim)]/50 group-hover:text-[color:var(--danger)]/80"
              : "text-[color:var(--text-dim)]/50 group-hover:text-[color:var(--text-dim)]"
        )}
      >
        {eyebrow}
      </span>
    </button>
  );
}

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
      <div className={cn("w-full md:w-[380px] shrink-0 flex flex-col justify-between py-1 md:py-2 h-full", isOpen && "hidden md:flex")}>
        <div className="space-y-4 md:space-y-6">
          <SettingsNavButton
            eyebrow="General Settings"
            isActive={activeSection === "general"}
            label="Settings"
            onClick={() => onSelectSection("general")}
          />

          <SettingsNavButton
            eyebrow="Manage API"
            isActive={activeSection === "apiKey"}
            label="API Key"
            onClick={() => onSelectSection("apiKey")}
          />
        </div>

        {hasActiveUser ? (
          <SettingsNavButton
            eyebrow="Delete account"
            isActive={activeSection === "dangerZone"}
            isDanger
            label="Danger zone"
            onClick={() => onSelectSection("dangerZone")}
          />
        ) : null}
      </div>

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
                  <div className="flex-1 flex flex-col justify-start">
                    <div className="space-y-4 md:space-y-6">
                      <div>
                        <h2 className="text-xl md:text-2xl font-bold tracking-[-0.06em] text-white uppercase">General Settings</h2>
                      </div>
                      <div className="text-[10px] md:text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-dim)]">
                        Account
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-[16px] border border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] px-4 py-3">
                        <div className="min-w-0 text-left">
                          <div className="truncate text-sm font-bold text-white">{accountName}</div>
                          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--text-dim)]/70">
                            Local account
                          </div>
                        </div>
                        <button
                          aria-label="Log out"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-[color:var(--text-dim)] transition-colors hover:border-white hover:bg-[color:var(--surface-elevated)] hover:text-white cursor-pointer has-lucide"
                          onClick={onSignOut}
                          type="button"
                        >
                          <LogOut className="h-4 w-4" strokeWidth={2.3} />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                {activeSection === "apiKey" ? (
                  <div className="flex-1 flex flex-col justify-between h-full pb-1 md:pb-2">
                    <div className="space-y-4 md:space-y-6">
                      <div>
                        <h2 className="text-xl md:text-2xl font-bold tracking-[-0.06em] text-white uppercase">BINANCE</h2>
                      </div>

                      <div className="space-y-3 md:space-y-4">
                        <div className="space-y-1 md:space-y-1.5">
                          <label className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
                            API KEY
                          </label>
                          <Input
                            className="w-full text-sm md:text-base bg-[color:var(--surface-panel)] border-[color:var(--line-strong)] text-white disabled:opacity-75 disabled:cursor-not-allowed"
                            placeholder="Enter API Key"
                            disabled={isApiKeySaved}
                            value={isApiKeySaved ? binanceApiKeyPreview ?? "Saved securely" : binanceKeyInput}
                            onChange={(event) => onBinanceKeyChange(event.target.value)}
                          />
                        </div>

                        <div className="space-y-1 md:space-y-1.5">
                          <label className="text-[9px] md:text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
                            SECRET
                          </label>
                          <div className="relative">
                            <Input
                              type={showSecret ? "text" : "password"}
                              className="w-full text-sm md:text-base pr-10 bg-[color:var(--surface-panel)] border-[color:var(--line-strong)] text-white disabled:opacity-75 disabled:cursor-not-allowed"
                              placeholder="Enter Secret Key"
                              disabled={isApiKeySaved}
                              value={isApiKeySaved ? "Stored server-side" : binanceSecretInput}
                              onChange={(event) => onBinanceSecretChange(event.target.value)}
                            />
                            {!isApiKeySaved ? (
                              <button
                                aria-label={showSecret ? "Hide secret key" : "Show secret key"}
                                className="icon-plain absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center text-[color:var(--text-dim)] transition-colors hover:text-white"
                                onClick={onToggleSecret}
                                type="button"
                              >
                                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto pt-4 md:pt-6 shrink-0 flex items-center gap-2 h-10 md:h-12">
                      <div className="flex-1 min-w-0 flex items-center justify-end overflow-hidden">
                        {showDeleteApiConfirm ? (
                          <div className="flex items-center gap-2 animate-delete-confirm-in">
                            <button
                              type="button"
                              onClick={() => onDeleteApiKeys(false)}
                              className="flex h-10 md:h-12 items-center justify-center rounded-[16px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-[color:var(--danger)] hover:text-red-400 hover:bg-[color:var(--surface-elevated)] hover:border-red-400 transition-colors cursor-pointer text-[10px] md:text-[11px] font-extrabold uppercase tracking-[0.14em] px-3 md:px-5 whitespace-nowrap"
                            >
                              API Only
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteApiKeys(true)}
                              className="flex h-10 md:h-12 items-center justify-center rounded-[16px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-[color:var(--danger)] hover:text-red-400 hover:bg-[color:var(--surface-elevated)] hover:border-red-400 transition-colors cursor-pointer text-[10px] md:text-[11px] font-extrabold uppercase tracking-[0.14em] px-3 md:px-5 whitespace-nowrap"
                            >
                              API + Data
                            </button>
                          </div>
                        ) : (
                          <div className="text-[10px] md:text-[11px] font-semibold tracking-wider truncate">
                            {error ? <span className="text-[color:var(--danger)]">{error}</span> : null}
                            {notice && !error ? (
                              <span
                                className={cn(
                                  isTesting
                                    ? "text-yellow-400"
                                    : notice.toLowerCase().includes("delete") || notice.toLowerCase().includes("cancel")
                                      ? "text-[color:var(--danger)]"
                                      : "text-emerald-500"
                                )}
                              >
                                {notice}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </div>

                      {isTesting ? (
                        <button
                          type="button"
                          disabled
                          title="Testing Binance connection..."
                          className="flex h-10 w-10 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-[16px] border-2 border-yellow-400/40 bg-[color:var(--surface-panel)] text-yellow-400 opacity-80 cursor-not-allowed"
                        >
                          <RefreshCcwDot className="h-4 w-4 md:h-5 md:w-5 animate-spin" strokeWidth={2.3} />
                        </button>
                      ) : isApiKeySaved ? (
                        <button
                          type="button"
                          onClick={onToggleDeleteApiConfirm}
                          title={showDeleteApiConfirm ? "Cancel" : "Delete Saved API Keys"}
                          className={cn("trash-danger flex h-10 w-10 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-[16px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] hover:bg-[color:var(--surface-elevated)] transition-colors cursor-pointer focus:outline-none", showDeleteApiConfirm && "is-open")}
                        >
                          <Trash2 className="h-4 w-4 md:h-5 md:w-5" strokeWidth={2.3} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={onSaveApiKeys}
                          title="Save API Keys"
                          className="flex h-10 w-10 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-[16px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-[color:var(--text-dim)] hover:text-white hover:bg-[color:var(--surface-elevated)] hover:border-white transition-colors cursor-pointer"
                        >
                          <CircleCheckBig className="h-4 w-4 md:h-5 md:w-5" strokeWidth={2.3} />
                        </button>
                      )}
                    </div>
                  </div>
                ) : null}

                {activeSection === "dangerZone" && hasActiveUser ? (
                  <div className="flex-1 flex flex-col justify-between h-full animate-submenu-in">
                    <div className="space-y-4 md:space-y-6">
                      <div>
                        <h2 className="text-xl md:text-2xl font-bold tracking-[-0.06em] text-[color:var(--danger)] uppercase">Danger Zone</h2>
                      </div>
                      <div className="text-[10px] md:text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--text-dim)]">
                        Delete Account Data
                      </div>
                      <p className="text-xs md:text-sm text-[color:var(--text-dim)] mt-2 md:mt-4 leading-relaxed">
                        Deleting your account is permanent and cannot be undone. All of your personal data, including connected bank accounts, crypto wallets, and transaction histories, will be permanently removed from the system.
                      </p>
                    </div>

                    <div className="mt-auto pt-4 md:pt-6 flex items-center justify-end shrink-0">
                      <button
                        type="button"
                        onClick={onDeleteAccount}
                        className="flex h-10 md:h-12 items-center justify-center rounded-[16px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-[color:var(--danger)] hover:text-red-400 hover:bg-[color:var(--surface-elevated)] hover:border-red-400 transition-colors cursor-pointer text-[10px] md:text-[11px] font-extrabold uppercase tracking-[0.14em] px-4 md:px-6"
                      >
                        Delete Account
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
