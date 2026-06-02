"use client";

import { cn } from "@/shared/utils";

type CurrentValueSkeletonProps = {
  className?: string;
};

export function CurrentValueSkeleton({ className }: CurrentValueSkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("current-value-skeleton block rounded-full", className)}
    />
  );
}
