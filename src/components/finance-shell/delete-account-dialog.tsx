"use client";

import { useRef } from "react";
import { X as XIcon } from "lucide-react";

import { Input } from "@/components/ui/input";

import { canSubmitDeleteAccountDialog } from "./delete-account-dialog-helpers";
import { useModalFocusTrap } from "./use-modal-accessibility";

type DeleteAccountDialogProps = {
  error: string | null;
  isDeleting: boolean;
  isOpen: boolean;
  onClose: () => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  password: string;
};

export function DeleteAccountDialog({
  error,
  isDeleting,
  isOpen,
  onClose,
  onPasswordChange,
  onSubmit,
  password,
}: DeleteAccountDialogProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const canSubmit = canSubmitDeleteAccountDialog(password, isDeleting);

  useModalFocusTrap({
    active: isOpen,
    containerRef: dialogRef,
    focusKey: isOpen ? "delete-account" : "closed",
    onEscape: isDeleting ? undefined : onClose
  });

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div
        ref={dialogRef}
        aria-labelledby="delete-account-title"
        aria-modal="true"
        className="relative flex w-full max-w-[460px] flex-col gap-5 rounded-[20px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-shell)] p-5 shadow-2xl sm:p-6"
        role="dialog"
        tabIndex={-1}
      >
        <button
          aria-label="Close"
          className="absolute right-4 top-4 flex h-8 w-8 cursor-pointer items-center justify-center text-[color:var(--text-dim)] transition-colors hover:text-white disabled:pointer-events-none disabled:opacity-40"
          disabled={isDeleting}
          onClick={onClose}
          type="button"
        >
          <XIcon className="h-5 w-5" strokeWidth={2.3} />
        </button>

        <div className="space-y-2 pr-8">
          <h2 id="delete-account-title" className="text-xl font-bold uppercase tracking-[-0.04em] text-[color:var(--danger)]">
            Delete account
          </h2>
          <p className="text-sm font-medium leading-relaxed text-[color:var(--text-dim)]">
            This permanently removes every profile, transaction, Binance balance and cached price tied to this account.
          </p>
        </div>

        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) {
              onSubmit();
            }
          }}
        >
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
              Password
            </label>
            <Input
              autoComplete="current-password"
              autoFocus
              className="w-full border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-white focus:border-white focus:ring-0"
              data-autofocus=""
              disabled={isDeleting}
              onChange={(event) => onPasswordChange(event.target.value)}
              placeholder="Enter your password"
              type="password"
              value={password}
            />
          </div>

          {error ? (
            <div className="text-xs font-semibold text-[color:var(--danger)]">{error}</div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="flex h-11 items-center justify-center rounded-[16px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] px-5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--text-dim)] transition-colors hover:border-white hover:bg-[color:var(--surface-elevated)] hover:text-white disabled:pointer-events-none disabled:opacity-40"
              disabled={isDeleting}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="flex h-11 items-center justify-center rounded-[16px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] px-5 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[color:var(--danger)] transition-colors hover:border-red-400 hover:bg-[color:var(--surface-elevated)] hover:text-red-400 disabled:pointer-events-none disabled:opacity-40"
              disabled={!canSubmit}
              type="submit"
            >
              {isDeleting ? "Deleting..." : "Delete account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
