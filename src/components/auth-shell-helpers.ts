import { cn } from "@/shared/utils";

export function getAuthSubmitButtonClass(canSubmit: boolean) {
  return cn(
    "flex h-11 w-11 items-center justify-center rounded-[16px] border bg-[color:var(--surface-panel)] p-0 transition-[background-color,border-color,color,transform,opacity] duration-200 sm:h-12 sm:w-12 has-lucide",
    canSubmit
      ? "cursor-pointer border-[color:var(--line-strong)] text-[color:var(--text-dim)] hover:border-white hover:bg-[color:var(--surface-elevated)] hover:text-white active:scale-[0.985]"
      : "cursor-not-allowed border-[color:var(--line-strong)] text-[color:var(--text-dim)]/35 opacity-60"
  );
}

export function getAuthLandingResetState() {
  return {
    view: "landing" as const,
    password: "",
    error: null,
    successMessage: null,
  };
}
