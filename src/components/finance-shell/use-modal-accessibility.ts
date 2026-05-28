"use client";

import { useEffect, useRef } from "react";

type ElementRef = {
  current: HTMLElement | null;
};

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => {
    if (element.closest("[aria-hidden='true'], [inert]")) {
      return false;
    }

    return element.offsetWidth > 0 || element.offsetHeight > 0 || element.getClientRects().length > 0;
  });
}

function focusInitialElement(container: HTMLElement) {
  const preferredElement = container.querySelector<HTMLElement>("[data-autofocus]");
  if (
    preferredElement &&
    !preferredElement.closest("[aria-hidden='true'], [inert]") &&
    (preferredElement.offsetWidth > 0 || preferredElement.offsetHeight > 0 || preferredElement.getClientRects().length > 0)
  ) {
    preferredElement.focus({ preventScroll: true });
    return;
  }

  const focusableElements = getFocusableElements(container);
  const target =
    focusableElements.find((element) => element.hasAttribute("autofocus")) ??
    focusableElements[0] ??
    container;

  target.focus({ preventScroll: true });
}

export function useInertElements(isActive: boolean, refs: ElementRef[]) {
  useEffect(() => {
    if (!isActive) {
      return;
    }

    const previousStates = refs
      .map((ref) => ref.current)
      .filter((element): element is HTMLElement => Boolean(element))
      .map((element) => ({
        ariaHidden: element.getAttribute("aria-hidden"),
        element,
        inert: (element as HTMLElement & { inert?: boolean }).inert,
        inertAttribute: element.hasAttribute("inert")
      }));

    for (const { element } of previousStates) {
      element.setAttribute("aria-hidden", "true");
      element.setAttribute("inert", "");
      (element as HTMLElement & { inert?: boolean }).inert = true;
    }

    return () => {
      for (const { ariaHidden, element, inert, inertAttribute } of previousStates) {
        if (ariaHidden === null) {
          element.removeAttribute("aria-hidden");
        } else {
          element.setAttribute("aria-hidden", ariaHidden);
        }

        if (inertAttribute) {
          element.setAttribute("inert", "");
        } else {
          element.removeAttribute("inert");
        }

        (element as HTMLElement & { inert?: boolean }).inert = inert;
      }
    };
  }, [isActive, refs]);
}

export function useModalFocusTrap({
  active,
  containerRef,
  focusKey,
  onEscape
}: {
  active: boolean;
  containerRef: ElementRef;
  focusKey?: unknown;
  onEscape?: () => void;
}) {
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onEscapeRef = useRef(onEscape);
  const wasActiveRef = useRef(false);

  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (!wasActiveRef.current) {
      previousFocusRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      wasActiveRef.current = true;
    }

    focusInitialElement(container);

    const focusTimer = window.setTimeout(() => {
      focusInitialElement(container);
    }, 0);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [active, containerRef, focusKey]);

  useEffect(() => {
    if (!active) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!containerRef.current) {
        return;
      }

      if (event.key === "Escape") {
        if (onEscapeRef.current) {
          event.preventDefault();
          onEscapeRef.current();
        }
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = getFocusableElements(containerRef.current);
      if (focusableElements.length === 0) {
        event.preventDefault();
        containerRef.current.focus({ preventScroll: true });
        return;
      }

      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (!activeElement || !containerRef.current.contains(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? lastFocusable : firstFocusable).focus({ preventScroll: true });
        return;
      }

      if (event.shiftKey) {
        if (activeElement === firstFocusable) {
          event.preventDefault();
          lastFocusable.focus({ preventScroll: true });
        }
        return;
      }

      if (activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus({ preventScroll: true });
      }
    }

    function handleFocusIn(event: FocusEvent) {
      const container = containerRef.current;
      const target = event.target;

      if (!container || (target instanceof Node && container.contains(target))) {
        return;
      }

      focusInitialElement(container);
    }

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("focusin", handleFocusIn, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("focusin", handleFocusIn, true);
      wasActiveRef.current = false;

      if (previousFocusRef.current?.isConnected) {
        previousFocusRef.current.focus({ preventScroll: true });
      }
    };
  }, [active, containerRef]);
}
