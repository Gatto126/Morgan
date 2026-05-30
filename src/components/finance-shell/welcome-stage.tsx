import type { RefObject } from "react";

import { cn } from "@/shared/utils";

import type { UserRecord } from "./types";
import { WelcomeHeritagePreview } from "./welcome-heritage-preview";

type WelcomeStageProps = {
  activeUser: UserRecord | null;
  backgroundRef: RefObject<HTMLDivElement | null>;
  isBackgroundVisible: boolean;
  isPanelModalOpen: boolean;
  onSignOut: () => void;
};

export function WelcomeStage({
  activeUser,
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
          <div className="mx-auto grid h-full w-full min-w-0 gap-5 text-left md:grid-cols-[minmax(0,1fr)_2px_minmax(0,1fr)]">
            <div className="mx-auto flex min-h-0 min-w-0 w-full max-w-[380px] flex-col justify-center gap-10 py-1 sm:gap-12 md:gap-16 lg:gap-24 lg:py-2">
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
                  Track accounts, investments and crypto in one private dashboard.
                </p>
              </div>

              <div className="pt-6">
                <a
                  className="group block cursor-pointer select-none space-y-1 text-left"
                  href="/api/logout"
                  onClick={() => {
                    onSignOut();
                  }}
                >
                  <div className="text-2xl font-bold tracking-[-0.06em] text-[color:var(--text-dim)] transition-colors group-hover:text-white md:text-3xl sm:text-[2.2rem]">
                    Log out
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]/50 transition-colors group-hover:text-[color:var(--text-dim)]">
                    End session
                  </div>
                </a>
              </div>
            </div>

            <div className="hidden w-[2px] shrink-0 self-stretch bg-[color:var(--line-strong)] opacity-30 md:block" />

            <WelcomeHeritagePreview
              activeUser={activeUser}
              isActive={isBackgroundVisible && !isPanelModalOpen}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
