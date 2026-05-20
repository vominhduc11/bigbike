"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

type FocusTrapOptions = {
  active: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  lockScroll?: boolean;
  onEscape?: () => void;
  restoreFocus?: boolean;
};

function getFocusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => {
      const isRendered =
        element.offsetWidth > 0 ||
        element.offsetHeight > 0 ||
        element.getClientRects().length > 0;

      return (
        !element.hasAttribute("disabled") &&
        element.getAttribute("aria-hidden") !== "true" &&
        isRendered
      );
    },
  );
}

export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  {
    active,
    initialFocusRef,
    lockScroll = false,
    onEscape,
    restoreFocus = true,
  }: FocusTrapOptions,
) {
  const onEscapeRef = useRef(onEscape);

  useEffect(() => {
    onEscapeRef.current = onEscape;
  }, [onEscape]);

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;
    const trapRoot = container;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflowY;
    const hadTabIndex = trapRoot.hasAttribute("tabindex");

    if (!hadTabIndex) {
      trapRoot.setAttribute("tabindex", "-1");
    }
    if (lockScroll) {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflowY = "hidden";
    }

    const focusTarget =
      initialFocusRef?.current ?? getFocusableElements(trapRoot)[0] ?? trapRoot;
    window.requestAnimationFrame(() => {
      focusTarget.focus({ preventScroll: true });
    });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onEscapeRef.current?.();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(trapRoot);
      if (focusable.length === 0) {
        event.preventDefault();
        trapRoot.focus({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (!hadTabIndex) {
        trapRoot.removeAttribute("tabindex");
      }
      if (lockScroll) {
        document.body.style.overflow = previousOverflow;
        document.documentElement.style.overflowY = previousHtmlOverflow;
      }
      if (restoreFocus && previouslyFocused?.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [active, containerRef, initialFocusRef, lockScroll, restoreFocus]);
}
