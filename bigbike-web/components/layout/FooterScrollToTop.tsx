"use client";

import { ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export function FooterScrollToTop({ className }: { className?: string }) {
  function scrollToTop() {
    const reduceMotion = window.matchMedia?.(REDUCED_MOTION_QUERY).matches;
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  return (
    <Button
      type="button"
      variant="primary"
      size="icon"
      aria-label="Cuộn lên đầu trang"
      onClick={scrollToTop}
      className={cn(
        "absolute z-[2] h-[52px] min-h-[52px] w-[52px] bg-brand-on-dark px-0 py-0 text-white hover:bg-brand-hover hover:not-disabled:scale-100",
        className,
      )}
    >
      <ChevronUp className="h-5 w-5" aria-hidden />
    </Button>
  );
}
