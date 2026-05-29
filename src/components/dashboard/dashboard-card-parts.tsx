import type { ReactNode } from "react";

type DashboardCardShellProps = {
  title: string;
  value: string;
  children: ReactNode;
  titleAddon?: ReactNode;
};

type DashboardMetricRowProps = {
  label: string;
  value: ReactNode;
  valueClassName?: string;
};

type DashboardAssetHeaderProps = {
  name: string;
  value: ReactNode;
  align?: "center" | "start";
};

export function DashboardCardShell({ title, value, titleAddon, children }: DashboardCardShellProps) {
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
          {value}
        </span>
      </div>
      {children}
    </div>
  );
}

export function DashboardMetricRow({ label, value, valueClassName = "text-[color:var(--text-main)]" }: DashboardMetricRowProps) {
  return (
    <div className="flex justify-between">
      <span className="pl-3 text-[color:var(--text-dim)] font-medium">{label}</span>
      <span className={`font-semibold ${valueClassName}`}>
        {value}
      </span>
    </div>
  );
}

export function DashboardAssetHeader({ name, value, align = "start" }: DashboardAssetHeaderProps) {
  return (
    <div className={`mb-1.5 flex ${align === "center" ? "items-center" : "items-start"} justify-between min-w-0`}>
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--text-main)] break-words w-0 flex-1 pr-3">
        {name}
      </span>
      <span className="text-xs font-bold text-[color:var(--text-main)] flex-shrink-0 pt-[1px]">
        {value}
      </span>
    </div>
  );
}
