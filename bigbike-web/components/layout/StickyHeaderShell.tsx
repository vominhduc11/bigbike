"use client";

import { useEffect } from "react";

const SCROLL_ATTR = "data-header-scrolled";
const SCROLL_THRESHOLD = 10;

export function StickyHeaderShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    function onScroll() {
      document.documentElement.toggleAttribute(
        SCROLL_ATTR,
        window.scrollY > SCROLL_THRESHOLD,
      );
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.documentElement.removeAttribute(SCROLL_ATTR);
    };
  }, []);

  return <header className="wp-header">{children}</header>;
}
