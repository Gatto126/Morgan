"use client";

import { useState } from "react";

import { cn } from "@/shared/utils";

type SlotValueProps = {
  animateChanges?: boolean;
  className?: string;
  identityKey?: string;
  value: string | number;
};

type SlotAnimationState = {
  animatedIndexes: Set<number>;
  identityKey?: string;
  readyToAnimate: boolean;
  suppressedChangesRemaining: number;
  text: string;
};

const emptyAnimatedIndexes = new Set<number>();
const initialSuppressedChanges = 2;

function getAnimatedIndexes(previousText: string, nextText: string) {
  const hasPlaceholderValue = previousText === "-" || previousText === "--";

  if (hasPlaceholderValue || previousText === nextText) {
    return emptyAnimatedIndexes;
  }

  const indexes = new Set<number>();
  Array.from(nextText).forEach((character, index) => {
    if (character !== previousText[index] && /\d/.test(character)) {
      indexes.add(index);
    }
  });

  return indexes.size > 0 ? indexes : emptyAnimatedIndexes;
}

export function SlotValue({ animateChanges = false, className, identityKey, value }: SlotValueProps) {
  const text = String(value);
  const [animationState, setAnimationState] = useState<SlotAnimationState>(() => ({
    animatedIndexes: emptyAnimatedIndexes,
    identityKey,
    readyToAnimate: false,
    suppressedChangesRemaining: initialSuppressedChanges,
    text
  }));
  let currentAnimationState = animationState;

  if (animationState.identityKey !== identityKey) {
    currentAnimationState = {
      animatedIndexes: emptyAnimatedIndexes,
      identityKey,
      readyToAnimate: false,
      suppressedChangesRemaining: initialSuppressedChanges,
      text
    };
    setAnimationState(currentAnimationState);
  } else if (animationState.text !== text) {
    const canAnimate = animationState.readyToAnimate
      && animationState.suppressedChangesRemaining === 0;

    currentAnimationState = {
      animatedIndexes: canAnimate
        ? getAnimatedIndexes(animationState.text, text)
        : emptyAnimatedIndexes,
      identityKey,
      readyToAnimate: true,
      suppressedChangesRemaining: Math.max(0, animationState.suppressedChangesRemaining - 1),
      text
    };
    setAnimationState(currentAnimationState);
  }

  const animatedIndexes = animateChanges ? currentAnimationState.animatedIndexes : emptyAnimatedIndexes;

  return (
    <span aria-label={text} className={cn("slot-value inline-flex h-5 items-center justify-end", className)}>
      {Array.from(text).map((character, index) => {
        const isDigit = /\d/.test(character);
        const isSeparator = character === "," || character === ".";
        const shouldAnimate = isDigit && animatedIndexes.has(index);

        return (
          <span
            aria-hidden="true"
            className={cn(
              "slot-value-character inline-flex h-5 items-center justify-center",
              isDigit && "slot-value-digit min-w-[0.58em]",
              shouldAnimate && "slot-value-digit-live",
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
