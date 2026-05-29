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
  const valueClassName = cn(
    "min-w-0 overflow-hidden whitespace-nowrap font-extrabold leading-none tabular-nums",
    getDashboardTopbarValueTextClass(value),
    !active && "opacity-70"
  );

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
      {label ? (
        <>
          <span className="flex min-w-0 items-center justify-start gap-2 overflow-hidden tracking-[0.14em]">
            {Icon ? <Icon className="h-4 w-4 flex-shrink-0" strokeWidth={2.2} /> : null}
            <span className="min-w-0 truncate">{label}</span>
          </span>
          <span className={cn(valueClassName, "justify-self-end text-right")} title={value}>
            {value}
          </span>
        </>
      ) : (
        <span className="col-span-2 flex min-w-0 -translate-x-4 items-center justify-center gap-2.5 overflow-hidden">
          {Icon ? <Icon className="h-4 w-4 flex-shrink-0" strokeWidth={2.2} /> : null}
          <span className={valueClassName} title={value}>
            {value}
          </span>
        </span>
      )}
    </button>
  );
}
