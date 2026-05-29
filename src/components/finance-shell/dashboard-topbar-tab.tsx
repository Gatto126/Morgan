import { Euro } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/shared/utils";

import {
  getDashboardTopbarIdentityTextClass,
  getDashboardTopbarValueParts,
  getDashboardTopbarValueTextClass
} from "./dashboard-topbar-tab-model";

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
  const { amount, currency } = getDashboardTopbarValueParts(value);
  const showEuroIcon = currency === "EUR" || currency === "\u20ac";
  const valueClassName = cn(
    "dashboard-topbar-value flex h-5 shrink-0 items-center justify-center overflow-hidden whitespace-nowrap text-center font-extrabold leading-none text-white tabular-nums",
    getDashboardTopbarValueTextClass(value)
  );

  return (
    <button
      aria-label={ariaLabel}
      aria-disabled={active ? "true" : undefined}
      className={cn(
        "dashboard-topbar-tab flex h-12 w-[178px] flex-shrink-0 items-center justify-center rounded-[16px] border-2 px-3 text-[11px] font-extrabold uppercase transition-colors has-lucide",
        onClick && !active ? "cursor-pointer" : "cursor-default",
        active
          ? "border-white bg-[color:var(--surface-panel)] text-white"
          : "border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-[color:var(--text-dim)]",
        onClick && !active && "hover:border-white hover:bg-[color:var(--surface-elevated)] hover:text-white"
      )}
      data-active={active ? "true" : "false"}
      onClick={active ? undefined : onClick}
      type="button"
    >
      <span className="dashboard-topbar-line flex h-5 min-w-0 items-center justify-center gap-3">
        <span className="dashboard-topbar-identity flex h-5 shrink-0 items-center justify-center overflow-hidden">
          {label ? (
            <span className={cn("flex h-5 items-center whitespace-nowrap text-center font-extrabold leading-none", getDashboardTopbarIdentityTextClass(label))}>
              {label}
            </span>
          ) : Icon ? (
            <Icon className="h-4 w-4 flex-shrink-0" strokeWidth={2.2} />
          ) : null}
        </span>
        <span className="dashboard-topbar-money flex h-5 min-w-0 items-center justify-center gap-1.5">
          <span className={valueClassName} title={value}>
            {amount}
          </span>
          <span className="dashboard-topbar-currency flex h-5 shrink-0 items-center justify-center overflow-hidden whitespace-nowrap text-[11px] font-extrabold leading-none text-white" title={currency}>
            {showEuroIcon ? (
              <Euro aria-hidden="true" className="dashboard-topbar-currency-icon block h-4 w-4 -translate-y-px text-white" stroke="white" strokeWidth={2.4} />
            ) : currency}
          </span>
        </span>
      </span>
    </button>
  );
}
