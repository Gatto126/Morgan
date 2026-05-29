import { cn } from "@/shared/utils";

type ProfileNavButtonProps = {
  eyebrow: string;
  isActive?: boolean;
  label: string;
  onClick: () => void;
};

export function ProfileNavButton({
  eyebrow,
  isActive = false,
  label,
  onClick,
}: ProfileNavButtonProps) {
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
          isActive ? "text-white" : "text-[color:var(--text-dim)] group-hover:text-white"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "block text-[10px] font-bold uppercase tracking-[0.18em] transition-colors duration-200",
          isActive ? "text-[color:var(--text-dim)]" : "text-[color:var(--text-dim)]/50 group-hover:text-[color:var(--text-dim)]"
        )}
      >
        {eyebrow}
      </span>
    </button>
  );
}
