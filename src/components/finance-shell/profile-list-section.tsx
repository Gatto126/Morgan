import { LoaderCircle, Trash2 } from "lucide-react";

import { ProfileNavButton } from "./profile-nav-button";
import type { ProfileOption } from "./user-select-panel-types";

import { cn } from "@/shared/utils";

type ProfileListSectionProps<TUser extends ProfileOption> = {
  activeUserId: string | null;
  deletingProfileId: string | null;
  users: TUser[];
  onDeleteProfile: (user: TUser) => void;
  onOpenCreate: () => void;
  onSelectUser: (user: TUser) => void;
  onSignOut: () => void;
};

export function ProfileListSection<TUser extends ProfileOption>({
  activeUserId,
  deletingProfileId,
  users,
  onDeleteProfile,
  onOpenCreate,
  onSelectUser,
  onSignOut
}: ProfileListSectionProps<TUser>) {
  return (
    <div className="flex h-full flex-1 flex-col justify-between gap-5">
      <div className="space-y-4 md:space-y-6">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-[-0.06em] text-white md:text-2xl">Select profile</h2>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
            Manage profiles
          </div>
        </div>

        <div className="flex max-h-[230px] flex-col gap-2 overflow-y-auto pr-1 hide-scrollbar md:max-h-[270px] md:gap-3">
          {users.map((user) => {
            const isCurrentProfile = activeUserId === user.id;
            const isDeletingProfile = deletingProfileId === user.id;

            return (
              <div
                key={user.id}
                className="flex w-full items-center gap-2"
              >
                <button
                  aria-disabled={isCurrentProfile ? "true" : undefined}
                  aria-current={isCurrentProfile ? "true" : undefined}
                  className={cn(
                    "flex min-w-0 flex-1 select-none items-center justify-between gap-3 rounded-[16px] border bg-[color:var(--surface-panel)] px-4 py-3 text-left text-sm font-semibold text-white transition-colors md:text-base",
                    isCurrentProfile
                      ? "cursor-default border-white bg-[color:var(--surface-elevated)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]"
                      : "cursor-pointer border-[color:var(--line-strong)] hover:bg-[color:var(--surface-elevated)]",
                    isDeletingProfile ? "opacity-50" : ""
                  )}
                  disabled={isDeletingProfile}
                  onClick={() => {
                    if (!isCurrentProfile) {
                      onSelectUser(user);
                    }
                  }}
                  type="button"
                >
                  <span className="min-w-0 truncate">{user.name}</span>
                  {isCurrentProfile ? (
                    <span className="flex shrink-0 items-center justify-center" title="Active profile">
                      <span
                        aria-hidden="true"
                        className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.55)]"
                      />
                      <span className="sr-only">Active profile</span>
                    </span>
                  ) : null}
                </button>

                <button
                  aria-label={`Delete profile ${user.name}`}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-transparent text-[color:var(--text-dim)] transition-colors hover:border-[color:var(--danger)] hover:text-[color:var(--danger)] disabled:pointer-events-none disabled:opacity-50"
                  disabled={!!deletingProfileId}
                  onClick={() => onDeleteProfile(user)}
                  title="Delete profile"
                  type="button"
                >
                  {isDeletingProfile ? (
                    <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" strokeWidth={2.2} />
                  ) : (
                    <Trash2 aria-hidden="true" className="h-4 w-4" strokeWidth={2.2} />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <MobileProfileActions
        onOpenCreate={onOpenCreate}
        onSignOut={onSignOut}
      />
    </div>
  );
}

function MobileProfileActions({
  onOpenCreate,
  onSignOut
}: Pick<ProfileListSectionProps<ProfileOption>, "onOpenCreate" | "onSignOut">) {
  return (
    <div className="flex shrink-0 flex-col gap-3 md:hidden">
      <ProfileNavButton
        eyebrow="Create new profile"
        label="New Profile"
        onClick={onOpenCreate}
      />

      <button type="button" onClick={onSignOut} className="group block cursor-pointer select-none space-y-1 bg-transparent p-0 text-left">
        <span className="block text-2xl font-bold tracking-[-0.06em] text-[color:var(--text-dim)] transition-colors duration-200 group-hover:text-white">
          Log out
        </span>
        <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]/50 transition-colors duration-200 group-hover:text-[color:var(--text-dim)]">
          Back to landing
        </span>
      </button>
    </div>
  );
}
