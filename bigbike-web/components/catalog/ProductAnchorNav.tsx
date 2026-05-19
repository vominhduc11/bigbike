"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export type AnchorSection = { id: string; label: string };

/**
 * Sticky in-page navigation for the product detail page. Sits just below the
 * site header, mirrors the section bands rendered on the page, highlights the
 * section currently in view, and shows a thin read-progress bar.
 */
export function ProductAnchorNav({ sections }: { sections: AnchorSection[] }) {
  const [activeId, setActiveId] = useState(sections[0]?.id ?? "");
  const [progress, setProgress] = useState(0);

  const handleScroll = useCallback(() => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    setProgress(max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0);

    // The section whose top has scrolled above the offset line is "active".
    const offset = 180;
    let current = sections[0]?.id ?? "";
    for (const section of sections) {
      const el = document.getElementById(section.id);
      if (el && el.getBoundingClientRect().top - offset <= 0) {
        current = section.id;
      }
    }
    setActiveId(current);
  }, [sections]);

  useEffect(() => {
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, [handleScroll]);

  function jumpTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (sections.length < 2) return null;

  return (
    <nav
      aria-label="Mục lục sản phẩm"
      className="sticky top-[var(--bb-header-stack,5rem)] z-30 border-y border-border bg-white"
    >
      <div className="mx-auto flex max-w-[1440px] gap-1 overflow-x-auto px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((section) => {
          const active = activeId === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => jumpTo(section.id)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "shrink-0 whitespace-nowrap border-b-2 px-4 py-3 font-heading text-xs font-semibold uppercase tracking-[0.05em] transition-colors",
                active
                  ? "border-brand text-brand"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {section.label}
            </button>
          );
        })}
      </div>
      <div
        className="h-0.5 bg-brand transition-[width] duration-100"
        style={{ width: `${progress}%` }}
        aria-hidden="true"
      />
    </nav>
  );
}
