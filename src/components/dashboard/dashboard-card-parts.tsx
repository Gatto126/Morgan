import type { ReactNode } from "react";

import { SlotValue } from "@/components/finance-shell/slot-value";

type DashboardCardShellProps = {
  title: string;
  value: string;
  children: ReactNode;
  animateValueChanges?: boolean;
  titleAddon?: ReactNode;
};

type DashboardMetricRowProps = {
  label: string;
  value: ReactNode;
  animateValueChanges?: boolean;
  valueClassName?: string;
};

type DashboardAssetHeaderProps = {
  name: string;
  value: ReactNode;
  align?: "center" | "start";
  animateValueChanges?: boolean;
};

function shouldUseSlotValue(value: ReactNode) {
  return (typeof value === "string" || typeof value === "number")
    && /\d/.test(String(value))
    && !/[A-Za-z]/.test(String(value));
}

function renderCardValue(value: ReactNode, animateChanges = false) {
  return shouldUseSlotValue(value)
    ? <SlotValue animateChanges={animateChanges} value={String(value)} />
    : value;
}

export function DashboardCardShell({ title, value, animateValueChanges = false, titleAddon, children }: DashboardCardShellProps) {
  return (
    <div className="flex flex-col gap-4 rounded-[20px] border-2 border-[color:var(--line-strong)] bg-[color:var(--surface-canvas)] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-extrabold uppercase tracking-[0.14em] text-[color:var(--text-main)]">
            {title}
          </span>
          {titleAddon}
        </div>
        <span className="text-sm font-bold text-[color:var(--text-main)]">
          {renderCardValue(value, animateValueChanges)}
        </span>
      </div>
      {children}
    </div>
  );
}

export function DashboardMetricRow({ label, value, animateValueChanges = false, valueClassName = "text-[color:var(--text-main)]" }: DashboardMetricRowProps) {
  return (
    <div className="flex justify-between">
      <span className="pl-3 text-[color:var(--text-dim)] font-medium">{label}</span>
      <span className={`font-semibold ${valueClassName}`}>
        {renderCardValue(value, animateValueChanges)}
      </span>
    </div>
  );
}

export function DashboardAssetHeader({ name, value, align = "start", animateValueChanges = false }: DashboardAssetHeaderProps) {
  return (
    <div className={`mb-1.5 flex ${align === "center" ? "items-center" : "items-start"} justify-between min-w-0`}>
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-main)] break-words w-0 flex-1 pr-3">
        {name}
      </span>
      <span className="text-xs font-bold text-[color:var(--text-main)] flex-shrink-0 pt-[1px]">
        {renderCardValue(value, animateValueChanges)}
      </span>
    </div>
  );
}
