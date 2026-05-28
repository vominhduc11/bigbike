"use client";

import { ChevronUp } from "lucide-react";

export function ScrollToTopButton() {
  function scrollToTop() {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: prefersReduced ? "auto" : "smooth" });
  }

  return (
    // Anchored to the bottom bar's `.bb-container` (right-0 = content right edge).
    // The negative top cancels the bar's own top padding (pt-6 mobile / py-[30px] md+)
    // and -translate-y-1/2 centers the button on the gray/black divider — so it stays
    // on the footer boundary no matter the footer height or the button's own size.
    <button
      type="button"
      className="absolute right-0 top-[-1.5rem] z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center bg-brand text-white transition-colors hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:top-[-1.875rem] md:h-[52px] md:w-[52px]"
      onClick={scrollToTop}
      aria-label="Lên đầu trang"
    >
      <ChevronUp size={24} strokeWidth={3} aria-hidden="true" />
    </button>
  );
}
