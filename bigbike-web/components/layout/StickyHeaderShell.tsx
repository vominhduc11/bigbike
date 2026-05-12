"use client";

import { useEffect, useRef } from "react";

const SCROLL_ATTR = "data-header-scrolled";
const HIDDEN_ATTR = "data-header-hidden";
const SCROLL_THRESHOLD = 10;
const HIDE_AFTER = 80;
const DELTA = 6;

export function StickyHeaderShell({ children }: { children: React.ReactNode }) {
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;

    function onScroll() {
      const y = window.scrollY;
      const root = document.documentElement;

      root.toggleAttribute(SCROLL_ATTR, y > SCROLL_THRESHOLD);

      const diff = y - lastY.current;
      if (Math.abs(diff) < DELTA) return;

      if (diff > 0 && y > HIDE_AFTER) {
        root.setAttribute(HIDDEN_ATTR, "");
      } else if (diff < 0) {
        root.removeAttribute(HIDDEN_ATTR);
      }

      lastY.current = y;
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.documentElement.removeAttribute(SCROLL_ATTR);
      document.documentElement.removeAttribute(HIDDEN_ATTR);
    };
  }, []);

  return <header className="wp-header">{children}</header>;
}
