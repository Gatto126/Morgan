"use client";

import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

import type { SettingsSection } from "./settings-panel-types";
import type { UserRecord } from "./types";
import { clearPersistedFinanceProfileSelection } from "./use-finance-profile-persistence";
import type { Stage } from "./use-finance-navigation";

type DeleteProfilePayload = {
  error?: string;
};

type UseFinanceProfileDeletionParams = {
  activeUser: UserRecord | null;
  users: UserRecord[];
  clearApiKeyDraft: () => void;
  clearPanelFeedback: () => void;
  resetPreview: () => void;
  setActiveSettingsSection: Dispatch<SetStateAction<SettingsSection | null>>;
  setActiveUser: Dispatch<SetStateAction<UserRecord | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setShowCreateUserSubmenu: Dispatch<SetStateAction<boolean>>;
  setShowSettingsView: Dispatch<SetStateAction<boolean>>;
  setShowUploadView: Dispatch<SetStateAction<boolean>>;
  setShowUserSelectView: Dispatch<SetStateAction<boolean>>;
  setStage: Dispatch<SetStateAction<Stage>>;
  setUsers: Dispatch<SetStateAction<UserRecord[]>>;
};

type ProfileDeletionTransitionParams = {
  activeUserId: string | null;
  deletedProfileId: string;
  remainingUsers: UserRecord[];
};

export function resolveProfileDeletionTransition({
  activeUserId,
  deletedProfileId,
  remainingUsers
}: ProfileDeletionTransitionParams) {
  const deletedActiveProfile = activeUserId === deletedProfileId;

  if (remainingUsers.length === 0) {
    return {
      clearPersistedSelection: true,
      nextActiveUser: null,
      nextStage: "create" as Stage,
      resetPanels: true
    };
  }

  if (deletedActiveProfile) {
    return {
      clearPersistedSelection: true,
      nextActiveUser: null,
      nextStage: "select" as Stage,
      resetPanels: true
    };
  }

  return {
    clearPersistedSelection: false,
    nextActiveUser: undefined,
    nextStage: undefined,
    resetPanels: false
  };
}

export function useFinanceProfileDeletion({
  activeUser,
  users,
  clearApiKeyDraft,
  clearPanelFeedback,
  resetPreview,
  setActiveSettingsSection,
  setActiveUser,
  setError,
  setNotice,
  setShowCreateUserSubmenu,
  setShowSettingsView,
  setShowUploadView,
  setShowUserSelectView,
  setStage,
  setUsers
}: UseFinanceProfileDeletionParams) {
  const [deletingProfileId, setDeletingProfileId] = useState<string | null>(null);
  const activeUserId = activeUser?.id ?? null;

  const handleDeleteProfile = useCallback(async (profile: UserRecord) => {
    if (deletingProfileId) {
      return;
    }

    const confirmed = window.confirm(`Delete profile "${profile.name}" and all of its data? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setDeletingProfileId(profile.id);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/users/${profile.id}`, {
        method: "DELETE"
      });
      const payload = (await response.json().catch(() => ({}))) as DeleteProfilePayload;

      if (!response.ok) {
        throw new Error(payload.error ?? "Error while deleting profile.");
      }

      const remainingUsers = users.filter((user) => user.id !== profile.id);
      const transition = resolveProfileDeletionTransition({
        activeUserId,
        deletedProfileId: profile.id,
        remainingUsers
      });

      setUsers(remainingUsers);

      if (transition.clearPersistedSelection) {
        clearPersistedFinanceProfileSelection();
      }

      if (transition.nextActiveUser !== undefined) {
        setActiveUser(transition.nextActiveUser);
      }

      if (transition.nextStage) {
        setStage(transition.nextStage);
      }

      if (transition.resetPanels) {
        resetPreview();
        clearPanelFeedback();
        clearApiKeyDraft();
        setShowUploadView(false);
        setShowUserSelectView(false);
        setShowCreateUserSubmenu(false);
        setShowSettingsView(false);
        setActiveSettingsSection(null);
      }

      setNotice(remainingUsers.length === 0 ? null : `Profile "${profile.name}" deleted.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Error while deleting profile.");
    } finally {
      setDeletingProfileId(null);
    }
  }, [
    activeUserId,
    clearApiKeyDraft,
    clearPanelFeedback,
    deletingProfileId,
    resetPreview,
    setActiveSettingsSection,
    setActiveUser,
    setError,
    setNotice,
    setShowCreateUserSubmenu,
    setShowSettingsView,
    setShowUploadView,
    setShowUserSelectView,
    setStage,
    setUsers,
    users
  ]);

  return {
    deletingProfileId,
    handleDeleteProfile
  };
}
