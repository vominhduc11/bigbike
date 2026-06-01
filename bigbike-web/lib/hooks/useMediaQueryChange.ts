"use client";

import { useEffect } from "react";

/**
 * Run `onMatch` when `query` STARTS matching — i.e. the media query's "change"
 * event fires with `matches === true`. It deliberately does NOT fire on mount,
 * only on an actual breakpoint crossing, which mirrors the close-on-breakpoint
 * effects it replaces (a value-returning `useMediaQuery` would instead fire on
 * mount-while-matching and change that behaviour).
 *
 * Pass a literal `query` and a stable `onMatch` (e.g. a context callback) so the
 * subscription is not rebound on every render.
 */
export function useMediaQueryChange(query: string, onMatch: () => void): void {
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) onMatch();
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query, onMatch]);
}
