"use client";

import type { RefObject } from "react";

import { ProfileCreateSection } from "./profile-create-section";
import { ProfileListSection } from "./profile-list-section";
import { UserSelectMenu } from "./user-select-menu";
import type { ProfileOption } from "./user-select-panel-types";

type UserSelectPanelProps<TUser extends ProfileOption> = {
  users: TUser[];
  activeUserId: string | null;
  isCreateOpen: boolean;
  initialProfileName: string;
  saving: boolean;
  error: string | null;
  notice: string | null;
  createInputRef: RefObject<HTMLInputElement | null>;
  onSelectUser: (user: TUser) => void;
  onToggleCreate: () => void;
  onCloseCreate: () => void;
  onCreateUser: (profileName: string) => void;
  onSignOut: () => void;
};

export function UserSelectPanel<TUser extends ProfileOption>({
  users,
  activeUserId,
  isCreateOpen,
  initialProfileName,
  saving,
  error,
  notice,
  createInputRef,
  onSelectUser,
  onToggleCreate,
  onCloseCreate,
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
      <UserSelectMenu
        isCreateOpen={isCreateOpen}
        onCloseCreate={onCloseCreate}
        onOpenCreate={openCreateSection}
        onSignOut={onSignOut}
      />

      <div className="flex h-full w-full flex-row items-stretch overflow-hidden md:w-[470px]">
        <div className="hidden w-[2px] shrink-0 self-stretch bg-[color:var(--line-strong)] opacity-30 md:mx-8 md:block" />

        <div className="flex h-full w-full shrink-0 flex-col overflow-y-auto py-3 pr-2 hide-scrollbar md:w-[398px] md:py-4">
          <div key={isCreateOpen ? "new-profile" : "profiles"} className="flex h-full flex-1 flex-col animate-submenu-in">
            {isCreateOpen ? (
              <ProfileCreateSection
                createInputRef={createInputRef}
                error={error}
                initialProfileName={initialProfileName}
                notice={notice}
                saving={saving}
                onCloseCreate={onCloseCreate}
                onCreateUser={onCreateUser}
              />
            ) : (
              <ProfileListSection
                activeUserId={activeUserId}
                users={users}
                onOpenCreate={openCreateSection}
                onSelectUser={onSelectUser}
                onSignOut={onSignOut}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
