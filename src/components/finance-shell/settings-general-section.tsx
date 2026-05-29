import { LogOut } from "lucide-react";

type SettingsGeneralSectionProps = {
  accountName: string;
  onSignOut: () => void;
};

export function SettingsGeneralSection({
  accountName,
  onSignOut
}: SettingsGeneralSectionProps) {
  return (
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
  );
}
