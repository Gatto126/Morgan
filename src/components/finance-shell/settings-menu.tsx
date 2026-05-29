import type { SettingsSection } from "./settings-panel-types";

import { cn } from "@/shared/utils";

type SettingsMenuProps = {
  activeSection: SettingsSection | null;
  hasActiveUser: boolean;
  isOpen: boolean;
  onSelectSection: (section: SettingsSection) => void;
};

type SettingsNavButtonProps = {
  eyebrow: string;
  isActive: boolean;
  isDanger?: boolean;
  label: string;
  onClick: () => void;
};

export function SettingsMenu({
  activeSection,
  hasActiveUser,
  isOpen,
  onSelectSection
}: SettingsMenuProps) {
  return (
    <div className={cn("w-full md:w-[380px] shrink-0 flex flex-col justify-between py-1 md:py-2 h-full", isOpen && "hidden md:flex")}>
      <div className="space-y-4 md:space-y-6">
        <SettingsNavButton
          eyebrow="General Settings"
          isActive={activeSection === "general"}
          label="Settings"
          onClick={() => onSelectSection("general")}
        />

        <SettingsNavButton
          eyebrow="Manage API"
          isActive={activeSection === "apiKey"}
          label="API Key"
          onClick={() => onSelectSection("apiKey")}
        />
      </div>

      {hasActiveUser ? (
        <SettingsNavButton
          eyebrow="Delete account"
          isActive={activeSection === "dangerZone"}
          isDanger
          label="Danger zone"
          onClick={() => onSelectSection("dangerZone")}
        />
      ) : null}
    </div>
  );
}

function SettingsNavButton({
  eyebrow,
  isActive,
  isDanger = false,
  label,
  onClick,
}: SettingsNavButtonProps) {
  return (
    <button
      aria-pressed={isActive}
      className="group block w-full cursor-pointer select-none space-y-1 bg-transparent p-0 text-left"
      onClick={onClick}
      type="button"
    >
      <span
        className={cn(
          "block text-2xl font-bold tracking-[-0.06em] transition-colors duration-200 md:text-3xl sm:text-[2.2rem]",
          isActive
            ? isDanger ? "text-[color:var(--danger)]" : "text-white"
            : isDanger
              ? "text-[color:var(--text-dim)] group-hover:text-[color:var(--danger)]"
              : "text-[color:var(--text-dim)] group-hover:text-white"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "block text-[10px] font-bold uppercase tracking-[0.18em] transition-colors duration-200",
          isActive
            ? isDanger ? "text-[color:var(--danger)]/80" : "text-[color:var(--text-dim)]"
            : isDanger
              ? "text-[color:var(--text-dim)]/50 group-hover:text-[color:var(--danger)]/80"
              : "text-[color:var(--text-dim)]/50 group-hover:text-[color:var(--text-dim)]"
        )}
      >
        {eyebrow}
      </span>
    </button>
  );
}
