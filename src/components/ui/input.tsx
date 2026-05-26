import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => {
    return (
      <input
        className={cn(
          "flex h-12 w-full rounded-[16px] border border-[color:var(--line-strong)] bg-[color:var(--surface-panel)] px-5 text-center text-lg font-semibold tracking-[-0.03em] text-[color:var(--text-main)] shadow-[0_0_0_1px_var(--line-soft)_inset] outline-none transition-[border-color,background-color,box-shadow] duration-200 placeholder:text-[color:var(--text-dim)] focus:border-[color:var(--text-main)] focus:bg-[color:var(--surface-elevated)]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
