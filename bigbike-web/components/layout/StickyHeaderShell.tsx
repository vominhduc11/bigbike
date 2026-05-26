"use client";

import { useEffect } from "react";

const SCROLL_ATTR = "data-header-scrolled";
const SCROLL_THRESHOLD = 0;

export function StickyHeaderShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      const root = document.documentElement;

      if (y > SCROLL_THRESHOLD) {
        root.setAttribute(SCROLL_ATTR, "");
      } else {
        root.removeAttribute(SCROLL_ATTR);
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.documentElement.removeAttribute(SCROLL_ATTR);
    };
  }, []);

  return <header className="bb-site-header">{children}</header>;
}
