import type { LucideIcon } from "lucide-react";

import { cn } from "@/shared/utils";

import { getDashboardTopbarValueTextClass } from "./dashboard-topbar-tab-model";

type DashboardTopbarTabProps = {
  active: boolean;
  ariaLabel?: string;
  icon?: LucideIcon;
  label?: string;
  onClick?: () => void;
  value: string;
};

export function DashboardTopbarTab({
  active,
  ariaLabel,
  icon: Icon,
  label,
  onClick,
  value
}: DashboardTopbarTabProps) {
  return (
    <button
      aria-label={ariaLabel}
      className={cn(
        "grid h-12 w-[178px] flex-shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-[16px] border-2 px-3 text-[11px] font-extrabold uppercase transition-colors has-lucide",
        onClick ? "cursor-pointer hover:bg-[color:var(--surface-elevated)]" : "cursor-default",
        active
          ? "border-white bg-[color:var(--surface-panel)] text-white"
          : "border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-[color:var(--text-dim)]"
      )}
      data-active={active ? "true" : "false"}
      onClick={onClick}
      type="button"
    >
      <span
        className={cn(
          "flex min-w-0 items-center gap-2 overflow-hidden tracking-[0.14em]",
          label ? "justify-start" : "justify-center"
        )}
      >
        {Icon ? <Icon className="h-4 w-4 flex-shrink-0" strokeWidth={2.2} /> : null}
        {label ? <span className="min-w-0 truncate">{label}</span> : null}
      </span>
      <span
        className={cn(
          "min-w-0 justify-self-end overflow-hidden whitespace-nowrap text-right font-extrabold leading-none tabular-nums",
          getDashboardTopbarValueTextClass(value),
          !active && "opacity-70"
        )}
        title={value}
      >
        {value}
      </span>
    </button>
  );
}
