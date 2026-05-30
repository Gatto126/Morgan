import type { CSSProperties } from "react";

import { cn } from "@/shared/utils";

type DashboardStatusProps = {
  isActive: boolean;
};

type DashboardLoadingOverlayProps = {
  showLoadingOverlay: boolean;
};

const inactiveDashboardStageStyle: CSSProperties = {
  contain: "layout paint style",
  contentVisibility: "hidden"
};

export function getDashboardStageVisibilityStyle(isActive: boolean) {
  return isActive ? undefined : inactiveDashboardStageStyle;
}

export function DashboardErrorState({ error, isActive }: DashboardStatusProps & { error: string }) {
  return (
    <div
      className={cn("absolute inset-0 flex h-full items-center justify-center", isActive ? "z-10 opacity-100 visible" : "z-0 pointer-events-none opacity-0 invisible")}
      style={getDashboardStageVisibilityStyle(isActive)}
    >
      <p className="text-sm text-[color:var(--danger)]">{error}</p>
    </div>
  );
}

export function DashboardLoadingOverlay({
  showLoadingOverlay
}: DashboardLoadingOverlayProps) {
  if (!showLoadingOverlay) {
    return null;
  }

  return (
    <div
      className="absolute -inset-3 z-[60] flex items-center justify-center overflow-hidden rounded-[18px] bg-[color:var(--surface-canvas)] sm:-inset-5"
      style={{
        pointerEvents: "all"
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "2.5px solid rgba(255,255,255,0.07)",
          borderTopColor: "rgba(255,255,255,0.5)",
          animation: "dashboardSpinner 0.85s linear infinite"
        }}
      />
    </div>
  );
}
