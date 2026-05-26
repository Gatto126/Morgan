import { cn } from "@/lib/utils";

type DashboardStatusProps = {
  isActive: boolean;
};

type DashboardLoadingOverlayProps = {
  showLoadingOverlay: boolean;
  loadingOverlayFadingOut: boolean;
};

export function DashboardErrorState({ error, isActive }: DashboardStatusProps & { error: string }) {
  return (
    <div className={cn("flex h-full items-center justify-center", !isActive && "absolute inset-0 pointer-events-none opacity-0 invisible")}>
      <p className="text-sm text-[color:var(--danger)]">{error}</p>
    </div>
  );
}

export function DashboardLoadingOverlay({
  showLoadingOverlay,
  loadingOverlayFadingOut
}: DashboardLoadingOverlayProps) {
  if (!showLoadingOverlay) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 z-[60] flex items-center justify-center"
      style={{
        background: "var(--surface-canvas)",
        opacity: loadingOverlayFadingOut ? 0 : 1,
        transition: loadingOverlayFadingOut ? "opacity 550ms cubic-bezier(0.4,0,0.2,1)" : "none",
        pointerEvents: loadingOverlayFadingOut ? "none" : "all"
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

export function DashboardLoadingState({
  isActive,
  showLoadingOverlay,
  loadingOverlayFadingOut
}: DashboardStatusProps & DashboardLoadingOverlayProps) {
  return (
    <div className={cn("flex h-full flex-col gap-4 overflow-hidden relative w-full", !isActive && "absolute inset-0 pointer-events-none opacity-0 invisible")}>
      <DashboardLoadingOverlay showLoadingOverlay={showLoadingOverlay} loadingOverlayFadingOut={loadingOverlayFadingOut} />
    </div>
  );
}
