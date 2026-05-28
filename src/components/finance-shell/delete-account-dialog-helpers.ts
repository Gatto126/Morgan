import { hasLocalPasswordInput } from "@/domain/auth/local-auth";

export function canSubmitDeleteAccountDialog(password: string, isDeleting: boolean) {
  return hasLocalPasswordInput(password) && !isDeleting;
}

export function getDeleteAccountDialogResetState() {
  return {
    password: "",
    error: null,
  };
}
