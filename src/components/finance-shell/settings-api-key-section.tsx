import { useState } from "react";
import { CircleCheckBig, Eye, EyeOff, RefreshCcwDot, Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/shared/utils";

type SettingsApiKeySectionProps = {
  binanceApiKeyPreview: string | null;
  error: string | null;
  isApiKeySaved: boolean;
  isTesting: boolean;
  notice: string | null;
  showDeleteApiConfirm: boolean;
  showSecret: boolean;
  onDeleteApiKeys: (deleteData: boolean) => void;
  onConnectBinanceApi: (apiKey: string, apiSecret: string) => void;
  onToggleDeleteApiConfirm: () => void;
  onToggleSecret: () => void;
};

export function SettingsApiKeySection({
  binanceApiKeyPreview,
  error,
  isApiKeySaved,
  isTesting,
  notice,
  showDeleteApiConfirm,
  showSecret,
  onDeleteApiKeys,
  onConnectBinanceApi,
  onToggleDeleteApiConfirm,
  onToggleSecret
}: SettingsApiKeySectionProps) {
  const [binanceKeyInput, setBinanceKeyInput] = useState("");
  const [binanceSecretInput, setBinanceSecretInput] = useState("");

  function connectBinanceApi() {
    onConnectBinanceApi(binanceKeyInput, binanceSecretInput);
  }

  return (
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
              onChange={(event) => setBinanceKeyInput(event.target.value)}
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
                onChange={(event) => setBinanceSecretInput(event.target.value)}
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
                <span className={getNoticeClassName(notice, isTesting)}>
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
            title="Connect Binance API"
            className="flex h-10 w-10 md:h-12 md:w-12 shrink-0 items-center justify-center rounded-[16px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-[color:var(--text-dim)] hover:text-white hover:bg-[color:var(--surface-elevated)] hover:border-white transition-colors cursor-pointer"
            aria-label="Connect Binance API"
            onClick={connectBinanceApi}
          >
            <CircleCheckBig className="h-4 w-4 md:h-5 md:w-5" strokeWidth={2.3} />
          </button>
        )}
      </div>
    </div>
  );
}

function getNoticeClassName(notice: string, isTesting: boolean) {
  return cn(
    isTesting
      ? "text-yellow-400"
      : notice.toLowerCase().includes("delete") || notice.toLowerCase().includes("cancel")
        ? "text-[color:var(--danger)]"
        : "text-emerald-500"
  );
}
