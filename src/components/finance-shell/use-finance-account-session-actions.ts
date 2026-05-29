"use client";

import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { useRouter } from "next/navigation";

import { authClient } from "@/client/auth-client";

import { getDeleteAccountDialogResetState } from "./delete-account-dialog-helpers";
import type { UserRecord } from "./types";
import { clearPersistedFinanceProfileSelection } from "./use-finance-profile-persistence";

type DeleteAccountPayload = {
  error?: string;
};

type UseFinanceAccountSessionActionsParams = {
  clearSettingsFeedback: () => void;
  setActiveUser: Dispatch<SetStateAction<UserRecord | null>>;
  setUsers: Dispatch<SetStateAction<UserRecord[]>>;
};

export function useFinanceAccountSessionActions({
  clearSettingsFeedback,
  setActiveUser,
  setUsers
}: UseFinanceAccountSessionActionsParams) {
  const router = useRouter();
  const [isSignedOut, setIsSignedOut] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState("");
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const handleSignOut = useCallback(async () => {
    try {
      await authClient.signOut();
    } finally {
      clearPersistedFinanceProfileSelection();
      setIsSignedOut(true);
      router.refresh();
    }
  }, [router]);

  const openDeleteAccountConfirm = useCallback(() => {
    const resetState = getDeleteAccountDialogResetState();

    setDeleteAccountPassword(resetState.password);
    setDeleteAccountError(resetState.error);
    setShowDeleteAccountConfirm(true);
    clearSettingsFeedback();
  }, [clearSettingsFeedback]);

  const closeDeleteAccountConfirm = useCallback(() => {
    if (isDeletingAccount) return;

    setShowDeleteAccountConfirm(false);
    const resetState = getDeleteAccountDialogResetState();
    setDeleteAccountPassword(resetState.password);
    setDeleteAccountError(resetState.error);
  }, [isDeletingAccount]);

  const handleDeleteAccount = useCallback(async () => {
    if (isDeletingAccount) return;

    try {
      setIsDeletingAccount(true);
      setDeleteAccountError(null);
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deleteAccountPassword })
      });
      const payload = (await response.json().catch(() => ({}))) as DeleteAccountPayload;

      if (!response.ok) {
        throw new Error(payload.error ?? "Error during account deletion.");
      }

      try {
        await authClient.signOut();
      } catch {
        // The account and session may already be gone after the server-side delete.
      }

      clearPersistedFinanceProfileSelection();
      setUsers([]);
      setActiveUser(null);
      setIsSignedOut(true);
      setShowDeleteAccountConfirm(false);
      const resetState = getDeleteAccountDialogResetState();
      setDeleteAccountPassword(resetState.password);
      setDeleteAccountError(resetState.error);
      router.refresh();
    } catch (err) {
      setDeleteAccountError(err instanceof Error ? err.message : "Error during account deletion.");
    } finally {
      setIsDeletingAccount(false);
    }
  }, [
    deleteAccountPassword,
    isDeletingAccount,
    router,
    setActiveUser,
    setUsers
  ]);

  return {
    closeDeleteAccountConfirm,
    deleteAccountError,
    deleteAccountPassword,
    handleDeleteAccount,
    handleSignOut,
    isDeletingAccount,
    isSignedOut,
    openDeleteAccountConfirm,
    setDeleteAccountPassword,
    showDeleteAccountConfirm
  };
}
