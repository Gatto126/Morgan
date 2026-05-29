import type { RefObject } from "react";

import { cn } from "@/shared/utils";

type WelcomeStageProps = {
  backgroundRef: RefObject<HTMLDivElement | null>;
  isBackgroundVisible: boolean;
  isPanelModalOpen: boolean;
  onSignOut: () => void;
};

export function WelcomeStage({
  backgroundRef,
  isBackgroundVisible,
  isPanelModalOpen,
  onSignOut
}: WelcomeStageProps) {
  return (
    <div className="relative h-full w-full">
      <div className="relative h-full w-full">
        <div
          ref={backgroundRef}
          aria-hidden={isPanelModalOpen ? "true" : undefined}
          data-panel-background="welcome"
          data-visible={isBackgroundVisible ? "true" : "false"}
          className={cn(
            "panel-content-reveal absolute inset-0 flex items-center justify-center",
            isPanelModalOpen && "pointer-events-none"
          )}
        >
          <div className="mx-auto flex h-full w-full max-w-[850px] items-stretch justify-start text-left md:h-[380px]">
            <div className="flex h-full w-full shrink-0 flex-col justify-between py-1 md:w-[380px] md:py-2">
              <div className="space-y-4 md:space-y-6">
                <div className="space-y-1 select-none">
                  <h1 className="text-4xl font-bold tracking-[-0.06em] text-white sm:text-[3rem]">
                    Morgan
                  </h1>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]/50">
                    Personal finance workspace
                  </div>
                </div>
                <p className="max-w-[320px] text-sm font-medium leading-relaxed text-[color:var(--text-dim)]">
                  Track accounts, investments and crypto in one private local dashboard.
                </p>
              </div>

              <div className="space-y-5 pt-6">
                <button
                  className="group block cursor-pointer select-none space-y-1 text-left"
                  onClick={onSignOut}
                  type="button"
                >
                  <div className="text-2xl font-bold tracking-[-0.06em] text-[color:var(--text-dim)] transition-colors group-hover:text-white md:text-3xl sm:text-[2.2rem]">
                    Log out
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]/50 transition-colors group-hover:text-[color:var(--text-dim)]">
                    End local session
                  </div>
                </button>
              </div>
            </div>

            <div className="mx-8 hidden w-[2px] shrink-0 self-stretch bg-[color:var(--line-strong)] opacity-30 md:block" />

            <div className="hidden h-full w-[398px] shrink-0 flex-col justify-end py-2 md:flex">
              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-3xl font-bold uppercase tracking-[-0.06em] text-white">LOCAL FIRST</h2>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
                    Built around your profiles
                  </div>
                </div>
                <p className="text-sm font-medium leading-relaxed text-[color:var(--text-dim)]">
                  Your account opens Morgan. Profiles inside Morgan separate the financial workspaces.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
