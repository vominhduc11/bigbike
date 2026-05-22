"use client";

import { ChevronUp } from "lucide-react";

export function ScrollToTopButton() {
  return (
    <button
      type="button"
      className="absolute z-20 flex h-[52px] w-[52px] items-center justify-center bg-brand text-white transition-colors hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white max-md:right-[15px] max-md:top-0 md:right-0 md:top-[-150px] xl:right-[-100px]"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Lên đầu trang"
    >
      <ChevronUp size={24} strokeWidth={3} aria-hidden="true" />
    </button>
  );
}
