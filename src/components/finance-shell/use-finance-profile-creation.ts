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
  accountName: string;
  name: string;
  saving: boolean;
  users: UserRecord[];
  resetPreview: () => void;
  setActiveUser: Dispatch<SetStateAction<UserRecord | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setName: Dispatch<SetStateAction<string>>;
  setNotice: Dispatch<SetStateAction<string | null>>;
  setSaving: Dispatch<SetStateAction<boolean>>;
  setShowCreateUserSubmenu: Dispatch<SetStateAction<boolean>>;
  setShowUploadView: Dispatch<SetStateAction<boolean>>;
  setShowUserSelectView: Dispatch<SetStateAction<boolean>>;
  setStage: Dispatch<SetStateAction<Stage>>;
  setUsers: Dispatch<SetStateAction<UserRecord[]>>;
};

export function useFinanceProfileCreation({
  accountName,
  name,
  saving,
  users,
  resetPreview,
  setActiveUser,
  setError,
  setName,
  setNotice,
  setSaving,
  setShowCreateUserSubmenu,
  setShowUploadView,
  setShowUserSelectView,
  setStage,
  setUsers
}: UseFinanceProfileCreationParams) {
  const handleCreateUser = useCallback(async () => {
    const trimmed = name.trim();
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
      setName("");
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
    name,
    resetPreview,
    saving,
    setActiveUser,
    setError,
    setName,
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
    setName(users.length === 0 ? accountName : "");
    setError(null);
    setNotice(null);
  }, [
    accountName,
    setError,
    setName,
    setNotice,
    setShowCreateUserSubmenu,
    users.length
  ]);

  return {
    handleCreateUser,
    handleToggleCreateUser
  };
}
