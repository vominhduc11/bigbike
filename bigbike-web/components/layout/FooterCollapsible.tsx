"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FooterCollapsible({ title, children }: { title: string; children: ReactNode }) {
  // WP-parity: footer info/social are expanded by default on mobile (custom.css
  // @max-767 forces .toggle--item-body{display:block}); the +/- only collapses.
  const [open, setOpen] = useState(true);
  const contentId = useId();

  return (
    <section className="mb-[2.286rem] max-md:mb-10 max-md:border-b max-md:border-[#4b4b4b] max-md:pb-10">
      <h3 className="m-0 font-body text-body font-medium uppercase text-brand-on-dark">
        {/* Desktop/tablet: static heading — content is always visible, so no fake toggle */}
        <span className="block max-md:hidden">{title}</span>
        {/* Mobile: real collapse toggle with state-accurate ARIA */}
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={contentId}
          className="flex min-h-[44px] w-full items-center justify-between gap-2 text-left md:hidden"
        >
          <span>{title}</span>
          <span className="text-ui-20 leading-none" aria-hidden="true">
            {open ? "−" : "+"}
          </span>
        </button>
      </h3>
      <div
        id={contentId}
        className={cn(
          "md:mt-[30px] md:block",
          "max-md:grid max-md:transition-[grid-template-rows] max-md:duration-300 max-md:ease-in-out",
          open ? "max-md:grid-rows-[1fr]" : "max-md:grid-rows-[0fr]"
        )}
      >
        <div className="max-md:overflow-hidden">{children}</div>
      </div>
    </section>
  );
}
