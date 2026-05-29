import { ProfileNavButton } from "./profile-nav-button";

type UserSelectMenuProps = {
  isCreateOpen: boolean;
  onCloseCreate: () => void;
  onOpenCreate: () => void;
  onSignOut: () => void;
};

export function UserSelectMenu({
  isCreateOpen,
  onCloseCreate,
  onOpenCreate,
  onSignOut
}: UserSelectMenuProps) {
  return (
    <div className="hidden h-full w-[380px] shrink-0 flex-col justify-between py-2 md:flex">
      <div className="space-y-8">
        <div className="space-y-4 md:space-y-6">
          <ProfileNavButton
            eyebrow="Manage profiles"
            isActive={!isCreateOpen}
            label="Select profile"
            onClick={onCloseCreate}
          />

          <ProfileNavButton
            eyebrow="Create new profile"
            isActive={isCreateOpen}
            label="New Profile"
            onClick={onOpenCreate}
          />
        </div>
      </div>

      <button type="button" onClick={onSignOut} className="group block cursor-pointer select-none space-y-1 bg-transparent p-0 text-left">
        <div className="text-2xl font-bold tracking-[-0.06em] text-[color:var(--text-dim)] transition-colors duration-200 group-hover:text-white md:text-3xl sm:text-[2.2rem]">
          Log out
        </div>
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]/50 transition-colors duration-200 group-hover:text-[color:var(--text-dim)]">
          Back to landing
        </div>
      </button>
    </div>
  );
}
