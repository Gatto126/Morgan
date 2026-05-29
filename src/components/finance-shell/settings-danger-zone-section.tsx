type SettingsDangerZoneSectionProps = {
  onDeleteAccount: () => void;
};

export function SettingsDangerZoneSection({
  onDeleteAccount
}: SettingsDangerZoneSectionProps) {
  return (
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
  );
}
