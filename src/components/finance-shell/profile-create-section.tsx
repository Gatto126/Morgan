import { useState, type RefObject } from "react";

import PlusIcon from "../ui/plus-icon";

import { Input } from "@/components/ui/input";

type ProfileCreateSectionProps = {
  createInputRef: RefObject<HTMLInputElement | null>;
  error: string | null;
  initialProfileName: string;
  notice: string | null;
  saving: boolean;
  onCloseCreate: () => void;
  onCreateUser: (profileName: string) => void;
};

export function ProfileCreateSection({
  createInputRef,
  error,
  initialProfileName,
  notice,
  saving,
  onCloseCreate,
  onCreateUser
}: ProfileCreateSectionProps) {
  const [profileName, setProfileName] = useState(initialProfileName);

  function submitProfile() {
    onCreateUser(profileName);
  }

  return (
    <div className="flex h-full flex-1 flex-col justify-between pb-1 md:pb-2">
      <button
        type="button"
        onClick={onCloseCreate}
        className="mb-4 flex cursor-pointer items-center gap-1 self-start text-xs font-bold uppercase tracking-wider text-[color:var(--text-dim)] hover:text-white md:hidden"
      >
        &lt; Back to profiles
      </button>

      <div className="space-y-4 md:space-y-6">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-[-0.06em] text-white md:text-2xl">New Profile</h2>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--text-dim)]">
            Profile name
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1 md:pt-2">
          <div className="min-w-0 flex-1">
            <Input
              ref={createInputRef}
              value={profileName}
              onChange={(event) => setProfileName(event.target.value)}
              className="h-11 w-full rounded-[16px] border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-lg text-white focus:border-white focus:ring-0 sm:h-12 sm:text-xl"
              placeholder="Profile"
              maxLength={24}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  submitProfile();
                }
              }}
            />
          </div>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center sm:h-12 sm:w-12">
            <button
              type="button"
              aria-label="Create profile"
              className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[16px] border border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-[color:var(--text-dim)] transition-[background-color,border-color,color,transform,opacity] hover:border-white hover:bg-[color:var(--surface-elevated)] hover:text-white active:scale-[0.985] disabled:pointer-events-none disabled:opacity-40 sm:h-12 sm:w-12 has-lucide"
              disabled={saving || !profileName.trim()}
              onClick={submitProfile}
            >
              <PlusIcon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.4} />
            </button>
          </div>
        </div>
        {error ? <p className="mt-1 text-xs font-semibold text-[color:var(--danger)]">{error}</p> : null}
        {notice ? <p className="mt-1 text-xs font-semibold text-emerald-400">{notice}</p> : null}
      </div>
    </div>
  );
}
