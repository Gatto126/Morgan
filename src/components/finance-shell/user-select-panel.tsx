"use client";

import type { RefObject } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
  return (
    <div className="mx-auto flex w-full max-w-[850px] items-stretch text-left justify-start md:h-[380px] h-full">
      <div className={cn("w-full md:w-[380px] shrink-0 flex flex-col justify-between py-1 md:py-2 h-full", isCreateOpen && "hidden md:flex")}>
        <div className="space-y-4 md:space-y-8 flex flex-col justify-between h-full">
          <div className="space-y-4 md:space-y-6">
            <div className="space-y-1 select-none">
              <div className="text-2xl md:text-3xl font-bold tracking-[-0.06em] text-white sm:text-[2.2rem]">
                Select profile
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]/50">
                Manage profiles
              </div>
            </div>

            <div className="flex flex-col gap-2 md:gap-3 overflow-y-auto max-h-[120px] md:max-h-[220px] pr-2 hide-scrollbar">
              {users.map((user) => {
                const isCurrentProfile = activeUserId === user.id;

                return (
                  <button
                    key={user.id}
                    className={cn(
                      "w-full text-left px-4 py-2.5 md:py-3 rounded-[12px] border bg-[color:var(--surface-panel)] text-white hover:bg-[color:var(--surface-elevated)] transition-all font-semibold select-none cursor-pointer text-sm md:text-base flex items-center justify-between gap-3",
                      isCurrentProfile
                        ? "border-white bg-[color:var(--surface-elevated)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)]"
                        : "border-[color:var(--line-strong)]"
                    )}
                    onClick={() => onSelectUser(user)}
                  >
                    <span className="min-w-0 truncate">{user.name}</span>
                    {isCurrentProfile ? (
                      <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.16em] text-[color:var(--text-dim)]">
                        Active
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-5 pt-2">
            <button
              aria-pressed={isCreateOpen}
              className="group block w-full cursor-pointer select-none space-y-1 bg-transparent p-0 text-left"
              onClick={onToggleCreate}
              type="button"
            >
              <span
                className={cn(
                  "block text-2xl font-bold tracking-[-0.06em] transition-colors duration-200 md:text-3xl sm:text-[2.2rem]",
                  isCreateOpen ? "text-white" : "text-[color:var(--text-dim)] group-hover:text-white"
                )}
              >
                New Profile
              </span>
              <span
                className={cn(
                  "block text-[10px] font-bold uppercase tracking-[0.18em] transition-colors duration-200",
                  isCreateOpen ? "text-[color:var(--text-dim)]" : "text-[color:var(--text-dim)]/50 group-hover:text-[color:var(--text-dim)]"
                )}
              >
                Create new profile
              </span>
            </button>

            <button type="button" onClick={onSignOut} className="group block cursor-pointer select-none space-y-1 text-left">
              <div className="text-xl md:text-2xl font-bold tracking-[-0.06em] text-[color:var(--text-dim)] transition-colors duration-200 group-hover:text-white">
                Log out
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]/50 transition-colors duration-200 group-hover:text-[color:var(--text-dim)]">
                Back to landing
              </div>
            </button>
          </div>
        </div>
      </div>

      <div
        className={cn(
          "flex flex-row items-stretch transition-all duration-300 ease-in-out overflow-hidden h-full w-full md:w-auto",
          isCreateOpen ? "w-full md:w-[470px] opacity-100 translate-x-0" : "w-0 opacity-0 -translate-x-4 pointer-events-none"
        )}
      >
        {isCreateOpen ? (
          <>
            <div className="hidden md:block w-[2px] bg-[color:var(--line-strong)] opacity-30 self-stretch shrink-0 mx-8" />

            <div className="w-full md:w-[398px] shrink-0 flex flex-col justify-between md:justify-end h-full py-1 md:py-2">
              <div key="open" className="flex-1 flex flex-col justify-between md:justify-end h-full pb-2 animate-submenu-in">
                <button
                  type="button"
                  onClick={onCloseCreate}
                  className="md:hidden flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-[color:var(--text-dim)] hover:text-white mb-4 self-start cursor-pointer"
                >
                  &lt; Back to profiles
                </button>

                <div className="space-y-4 md:space-y-6">
                  <div className="space-y-1">
                    <h2 className="text-2xl md:text-3xl font-bold tracking-[-0.06em] text-white uppercase">New Profile</h2>
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
                      Profile name
                    </div>
                  </div>
                  <div className="space-y-3 pt-1 md:pt-2">
                    <Input
                      ref={createInputRef}
                      value={profileName}
                      onChange={(event) => onProfileNameChange(event.target.value)}
                      className="h-11 w-full border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-lg text-white focus:border-white focus:ring-0 sm:h-12 sm:text-xl"
                      placeholder="Profile"
                      maxLength={24}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          onCreateUser();
                        }
                      }}
                    />
                    <div className="flex min-h-11 justify-center">
                      <button
                        type="button"
                        aria-label="Create profile"
                        className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[16px] border border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-[color:var(--text-dim)] transition-[background-color,border-color,color,transform,opacity] hover:border-white hover:bg-[color:var(--surface-elevated)] hover:text-white active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40 sm:h-12 sm:w-12"
                        disabled={saving || !profileName.trim()}
                        onClick={onCreateUser}
                      >
                        <PlusIcon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.4} />
                      </button>
                    </div>
                  </div>
                  {error ? <p className="text-xs text-[color:var(--danger)] mt-1 font-semibold">{error}</p> : null}
                  {notice ? <p className="text-xs text-emerald-400 mt-1 font-semibold">{notice}</p> : null}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
