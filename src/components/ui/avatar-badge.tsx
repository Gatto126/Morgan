import { cn, getInitials } from "@/shared/utils";

type AvatarBadgeProps = {
  name: string;
  className?: string;
};

export function AvatarBadge({ name, className }: AvatarBadgeProps) {
  return (
    <div
      aria-label={`Avatar ${name}`}
      className={cn(
        "flex h-12 w-12 items-center justify-center rounded-[16px] border border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] text-xl font-extrabold tracking-[-0.04em] text-[color:var(--text-main)] shadow-[0_0_0_1px_var(--line-soft)_inset]",
        className
      )}
    >
      {getInitials(name)}
    </div>
  );
}
