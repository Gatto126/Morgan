import { useState } from "react";

import PlusIcon from "../ui/plus-icon";

import { Input } from "@/components/ui/input";
import { cn } from "@/shared/utils";

type CreateProfileStageProps = {
  initialProfileName: string;
  saving: boolean;
  title: string;
  onCreateProfile: (profileName: string) => void;
};

export function CreateProfileStage({
  initialProfileName,
  saving,
  title,
  onCreateProfile
}: CreateProfileStageProps) {
  const [profileName, setProfileName] = useState(initialProfileName);

  function submitProfile() {
    onCreateProfile(profileName);
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-[1164px] items-center justify-center text-left md:relative md:h-[526px] md:max-h-[526px]">
      <div className="hidden md:absolute md:left-1/4 md:top-1/2 md:block md:w-[320px] md:-translate-x-1/2 md:-translate-y-1/2">
        <div className="space-y-7">
          <h1 className="text-3xl font-bold tracking-[-0.06em] text-white sm:text-[2.35rem]">
            {title}
          </h1>

          <div className="max-w-[250px] space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
              Profile workspace
            </div>
            <p className="text-sm font-medium leading-relaxed text-[color:var(--text-dim)]">
              Use profiles to keep financial workspaces separate. You can add more later to track family finances too.
            </p>
          </div>
        </div>
      </div>

      <div className="hidden h-full w-[2px] shrink-0 self-stretch bg-[color:var(--line-strong)] opacity-30 md:absolute md:left-1/2 md:top-0 md:block" />

      <div className="flex h-full w-full shrink-0 flex-col items-center justify-center space-y-4 py-1 text-center md:absolute md:left-3/4 md:top-1/2 md:h-[108px] md:w-[398px] md:-translate-x-1/2 md:-translate-y-1/2 md:space-y-0 md:py-0">
        <h1 className="text-3xl font-bold tracking-[-0.06em] text-white sm:text-[2.35rem] md:hidden">
          {title}
        </h1>
        <p className="max-w-[300px] text-sm font-medium leading-relaxed text-[color:var(--text-dim)] md:hidden">
          Use profiles to keep financial workspaces separate. Add more later for family finances too.
        </p>

        <div className="w-full max-w-[398px] space-y-3 md:relative md:h-[108px] md:space-y-0">
          <Input
            autoFocus
            className="w-full border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-xl text-white focus:border-white focus:ring-0 sm:h-12"
            maxLength={24}
            onChange={(event) => setProfileName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                submitProfile();
              }
            }}
            placeholder="Profile"
            value={profileName}
          />
          <div className="flex min-h-12 w-full justify-center md:absolute md:left-0 md:top-[60px]">
            <button
              type="button"
              aria-label="Create profile"
              className={cn(
                "flex h-12 w-12 cursor-pointer items-center justify-center rounded-[16px] border border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-[color:var(--text-dim)] transition-[background-color,border-color,color,transform,opacity] duration-200 hover:border-[color:var(--text-dim)] hover:bg-[color:var(--surface-elevated)] active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40 has-lucide"
              )}
              disabled={saving || !profileName.trim()}
              onClick={submitProfile}
            >
              <PlusIcon className="h-5 w-5" strokeWidth={2.3} />
            </button>
          </div>
          <div className="min-h-4 text-center text-xs font-semibold text-[color:var(--text-dim)] md:absolute md:left-0 md:top-[calc(100%+0.75rem)] md:w-full">
            {saving ? <span>Saving...</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
