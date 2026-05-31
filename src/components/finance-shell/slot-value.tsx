"use client";

import { cn } from "@/shared/utils";

type SlotValueProps = {
  animateChanges?: boolean;
  className?: string;
  identityKey?: string;
  suppressInitialChanges?: boolean;
  value: string | number;
};

export function SlotValue({ className, value }: SlotValueProps) {
  const text = String(value);

  return (
    <span aria-label={text} className={cn("slot-value inline-flex h-5 items-center justify-end", className)}>
      {Array.from(text).map((character, index) => {
        const isDigit = /\d/.test(character);
        const isSeparator = character === "," || character === ".";

        return (
          <span
            aria-hidden="true"
            className={cn(
              "slot-value-character inline-flex h-5 items-center justify-center",
              isDigit && "slot-value-digit min-w-[0.58em]",
              isSeparator && "min-w-[0.22em]",
              !isDigit && !isSeparator && "min-w-[0.42em]"
            )}
            key={`${index}-${character}`}
          >
            {character}
          </span>
        );
      })}
    </span>
  );
}
