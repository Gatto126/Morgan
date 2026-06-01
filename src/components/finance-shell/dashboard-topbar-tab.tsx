import { Euro } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

import { cn } from "@/shared/utils";

import {
  getDashboardTopbarIdentityTextClass,
  getDashboardTopbarValueParts,
  getDashboardTopbarValueTextClass
} from "./dashboard-topbar-tab-model";
import { SlotValue } from "./slot-value";

type DashboardTopbarTabProps = {
  active: boolean;
  animateChanges?: boolean;
  ariaLabel?: string;
  icon?: LucideIcon;
  label?: string;
  onClick?: () => void;
  suppressInitialChanges?: boolean;
  value: string;
  valueIdentity?: string;
};

export function DashboardTopbarTab({
  active,
  animateChanges = false,
  ariaLabel,
  icon: Icon,
  label,
  onClick,
  suppressInitialChanges = true,
  value,
  valueIdentity
}: DashboardTopbarTabProps) {
  const hoverIdentity = `${active ? "active" : "idle"}:${label ?? ""}:${valueIdentity ?? ""}`;
  const [pointerHoverState, setPointerHoverState] = useState({ hovered: false, identity: hoverIdentity });
  const isPointerHovering = pointerHoverState.hovered && pointerHoverState.identity === hoverIdentity;
  const markPointerHover = () => {
    setPointerHoverState((current) => (
      current.hovered && current.identity === hoverIdentity
        ? current
        : { hovered: true, identity: hoverIdentity }
    ));
  };
  const clearPointerHover = () => {
    setPointerHoverState((current) => (
      current.hovered
        ? { hovered: false, identity: hoverIdentity }
        : current
    ));
  };
  const valuePending = value.trim() === "" || value === "--" || value === "-";
  const displayValue = valuePending ? "" : value;
  const { amount, currency } = getDashboardTopbarValueParts(displayValue);
  const showEuroIcon = currency === "EUR" || currency === "\u20ac";
  const hasTextIdentity = !!label;
  const valueClassName = cn(
    "dashboard-topbar-value flex h-5 shrink-0 items-center justify-end overflow-hidden whitespace-nowrap text-right font-extrabold leading-none text-white tabular-nums",
    hasTextIdentity ? "w-[72px]" : "w-[82px] sm:w-[86px]",
    valuePending && "opacity-0",
    getDashboardTopbarValueTextClass(displayValue)
  );
  const currencyClassName = cn(
    "dashboard-topbar-currency flex h-5 w-4 shrink-0 items-center justify-center overflow-hidden whitespace-nowrap text-[11px] font-extrabold leading-none text-white",
    valuePending && "opacity-0"
  );

  return (
    <button
      aria-label={ariaLabel}
      aria-disabled={active ? "true" : undefined}
      className={cn(
        "dashboard-topbar-tab flex h-12 w-[178px] flex-shrink-0 items-center justify-center rounded-[16px] border-2 px-3 text-[11px] font-extrabold uppercase has-lucide",
        onClick && !active ? "cursor-pointer" : "cursor-default",
        active
          ? "border-white bg-[color:var(--surface-panel)] text-white"
          : "border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-[color:var(--text-dim)]"
      )}
      data-active={active ? "true" : "false"}
      data-hovered={isPointerHovering ? "true" : "false"}
      onClick={active ? undefined : onClick}
      onPointerLeave={clearPointerHover}
      onPointerMove={markPointerHover}
      type="button"
    >
      <span className="dashboard-topbar-line flex h-5 w-full min-w-0 items-center justify-center gap-3">
        <span className={cn("dashboard-topbar-identity flex h-5 shrink-0 items-center justify-center overflow-hidden", hasTextIdentity ? "w-[34px]" : "w-4 sm:w-5")}>
          {label ? (
            <span className={cn("flex h-5 items-center whitespace-nowrap text-center font-extrabold leading-none", getDashboardTopbarIdentityTextClass(label))}>
              {label}
            </span>
          ) : Icon ? (
            <Icon className="dashboard-topbar-identity-icon h-4 w-4 flex-shrink-0" strokeWidth={2.2} />
          ) : null}
        </span>
        <span className={cn("dashboard-topbar-money flex h-5 shrink-0 items-center justify-end gap-1.5", hasTextIdentity ? "w-[94px]" : "w-[104px] sm:w-[108px]")}>
          <span aria-hidden={valuePending ? "true" : undefined} className={valueClassName} title={valuePending ? undefined : value}>
            <SlotValue
              animateChanges={animateChanges}
              identityKey={valueIdentity}
              suppressInitialChanges={suppressInitialChanges}
              value={amount}
            />
          </span>
          <span aria-hidden={valuePending ? "true" : undefined} className={currencyClassName} title={valuePending ? undefined : currency}>
            {showEuroIcon ? (
              <Euro aria-hidden="true" className="dashboard-topbar-currency-icon block h-4 w-4 -translate-y-px text-white" stroke="white" strokeWidth={2.4} />
            ) : currency}
          </span>
        </span>
      </span>
    </button>
  );
}
