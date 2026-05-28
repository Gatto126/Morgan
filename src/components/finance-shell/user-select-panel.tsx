"use client";

import type { RefObject } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/shared/utils";

import PlusIcon from "../ui/plus-icon";

type ProfileOption = {
  id: string;
  name: string;
};

type UserSelectPanelProps<TUser extends ProfileOption> = {
  users: TUser[];
  activeUserId: string | null;
  isCreateOpen: boolean;
  profileName: string;
  saving: boolean;
  error: string | null;
  notice: string | null;
  createInputRef: RefObject<HTMLInputElement | null>;
  onSelectUser: (user: TUser) => void;
  onToggleCreate: () => void;
  onCloseCreate: () => void;
  onProfileNameChange: (value: string) => void;
  onCreateUser: () => void;
  onSignOut: () => void;
};

type ProfileNavButtonProps = {
  eyebrow: string;
  isActive?: boolean;
  label: string;
  onClick: () => void;
};

function ProfileNavButton({
  eyebrow,
  isActive = false,
  label,
  onClick,
}: ProfileNavButtonProps) {
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
          isActive ? "text-white" : "text-[color:var(--text-dim)] group-hover:text-white"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "block text-[10px] font-bold uppercase tracking-[0.18em] transition-colors duration-200",
          isActive ? "text-[color:var(--text-dim)]" : "text-[color:var(--text-dim)]/50 group-hover:text-[color:var(--text-dim)]"
        )}
      >
        {eyebrow}
      </span>
    </button>
  );
}

export function UserSelectPanel<TUser extends ProfileOption>({
  users,
  activeUserId,
  isCreateOpen,
  profileName,
  saving,
  error,
  notice,
  createInputRef,
  onSelectUser,
  onToggleCreate,
  onCloseCreate,
  onProfileNameChange,
  onCreateUser,
  onSignOut
}: UserSelectPanelProps<TUser>) {
  const openCreateSection = () => {
    if (!isCreateOpen) {
      onToggleCreate();
    }
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-[850px] items-stretch justify-start text-left md:h-[380px]">
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
              onClick={openCreateSection}
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

      <div className="flex h-full w-full flex-row items-stretch overflow-hidden md:w-[470px]">
        <div className="hidden w-[2px] shrink-0 self-stretch bg-[color:var(--line-strong)] opacity-30 md:mx-8 md:block" />

        <div className="flex h-full w-full shrink-0 flex-col overflow-y-auto py-3 pr-2 hide-scrollbar md:w-[398px] md:py-4">
          <div key={isCreateOpen ? "new-profile" : "profiles"} className="flex h-full flex-1 flex-col animate-submenu-in">
            {!isCreateOpen ? (
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

                      return (
                        <button
                          key={user.id}
                          aria-disabled={isCurrentProfile ? "true" : undefined}
                          aria-current={isCurrentProfile ? "true" : undefined}
                          className={cn(
                            "flex w-full select-none items-center justify-between gap-3 rounded-[16px] border bg-[color:var(--surface-panel)] px-4 py-3 text-left text-sm font-semibold text-white transition-colors md:text-base",
                            isCurrentProfile
                              ? "cursor-default border-white bg-[color:var(--surface-elevated)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]"
                              : "cursor-pointer border-[color:var(--line-strong)] hover:bg-[color:var(--surface-elevated)]"
                          )}
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
                      );
                    })}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col gap-3 md:hidden">
                  <button
                    className="group block w-full cursor-pointer select-none space-y-1 bg-transparent p-0 text-left"
                    onClick={openCreateSection}
                    type="button"
                  >
                    <span className="block text-2xl font-bold tracking-[-0.06em] text-[color:var(--text-dim)] transition-colors duration-200 group-hover:text-white">
                      New Profile
                    </span>
                    <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]/50 transition-colors duration-200 group-hover:text-[color:var(--text-dim)]">
                      Create new profile
                    </span>
                  </button>

                  <button type="button" onClick={onSignOut} className="group block cursor-pointer select-none space-y-1 bg-transparent p-0 text-left">
                    <span className="block text-2xl font-bold tracking-[-0.06em] text-[color:var(--text-dim)] transition-colors duration-200 group-hover:text-white">
                      Log out
                    </span>
                    <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]/50 transition-colors duration-200 group-hover:text-[color:var(--text-dim)]">
                      Back to landing
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-1 flex-col justify-between pb-1 md:pb-2">
                <button
                  type="button"
                  onClick={onCloseCreate}
                  className="mb-4 flex cursor-pointer items-center gap-1 self-start text-xs font-bold uppercase tracking-wider text-[color:var(--text-dim)] hover:text-white md:hidden"
                >
                  &lt; Back to profiles
                </button>

                <div className="space-y-4 md:space-y-6">
                  <div>
                    <h2 className="text-xl font-bold uppercase tracking-[-0.06em] text-white md:text-2xl">New Profile</h2>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
                      Profile name
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1 md:pt-2">
                    <div className="min-w-0 flex-1">
                      <Input
                        ref={createInputRef}
                        value={profileName}
                        onChange={(event) => onProfileNameChange(event.target.value)}
                        className="h-11 w-full rounded-[16px] border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-lg text-white focus:border-white focus:ring-0 sm:h-12 sm:text-xl"
                        placeholder="Profile"
                        maxLength={24}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            onCreateUser();
                          }
                        }}
                      />
                    </div>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center sm:h-12 sm:w-12">
                      <button
                        type="button"
                        aria-label="Create profile"
                        className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[16px] border border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-[color:var(--text-dim)] transition-[background-color,border-color,color,transform,opacity] hover:border-white hover:bg-[color:var(--surface-elevated)] hover:text-white active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40 sm:h-12 sm:w-12 has-lucide"
                        disabled={saving || !profileName.trim()}
                        onClick={onCreateUser}
                      >
                        <PlusIcon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.4} />
                      </button>
                    </div>
                  </div>
                  {error ? <p className="mt-1 text-xs font-semibold text-[color:var(--danger)]">{error}</p> : null}
                  {notice ? <p className="mt-1 text-xs font-semibold text-emerald-400">{notice}</p> : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
