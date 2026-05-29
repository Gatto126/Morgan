"use client";

import { useCallback, type Dispatch, type SetStateAction } from "react";

import type { UserRecord } from "./types";
import type { Stage } from "./use-finance-navigation";

type CreateUserPayload = {
  error?: string;
  user?: UserRecord;
  users?: UserRecord[];
};

type UseFinanceProfileCreationParams = {
  saving: boolean;
  users: UserRecord[];
  resetPreview: () => void;
  setActiveUser: Dispatch<SetStateAction<UserRecord | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setSaving: Dispatch<SetStateAction<boolean>>;
  setShowCreateUserSubmenu: Dispatch<SetStateAction<boolean>>;
  setShowUploadView: Dispatch<SetStateAction<boolean>>;
  setShowUserSelectView: Dispatch<SetStateAction<boolean>>;
  setStage: Dispatch<SetStateAction<Stage>>;
  setUsers: Dispatch<SetStateAction<UserRecord[]>>;
};

export function useFinanceProfileCreation({
  saving,
  users,
  resetPreview,
  setActiveUser,
  setError,
  setNotice,
  setSaving,
  setShowCreateUserSubmenu,
  setShowUploadView,
  setShowUserSelectView,
  setStage,
  setUsers
}: UseFinanceProfileCreationParams) {
  const handleCreateUser = useCallback(async (profileName: string) => {
    const trimmed = profileName.trim();
    if (!trimmed || saving) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: trimmed })
      });

      const payload = (await response.json()) as CreateUserPayload;

      if (!response.ok || !payload.user) {
        throw new Error(payload.error ?? "User creation failed.");
      }

      const updatedUsers = payload.users ?? [...users, payload.user];
      setUsers(updatedUsers);
      setActiveUser(payload.user);
      resetPreview();
      setNotice(null);
      setShowUploadView(false);
      setShowUserSelectView(false);
      setShowCreateUserSubmenu(false);
      setStage("dashboard");
    } catch (creationError) {
      setError(creationError instanceof Error ? creationError.message : "User creation failed.");
    } finally {
      setSaving(false);
    }
  }, [
    resetPreview,
    saving,
    setActiveUser,
    setError,
    setNotice,
    setSaving,
    setShowCreateUserSubmenu,
    setShowUploadView,
    setShowUserSelectView,
    setStage,
    setUsers,
    users
  ]);

  const handleToggleCreateUser = useCallback(() => {
    setShowCreateUserSubmenu((prev) => !prev);
    setError(null);
    setNotice(null);
  }, [setError, setNotice, setShowCreateUserSubmenu]);

  return {
    handleCreateUser,
    handleToggleCreateUser
  };
}
