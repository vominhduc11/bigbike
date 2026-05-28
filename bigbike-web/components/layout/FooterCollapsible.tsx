"use client";

import { useId, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function FooterCollapsible({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const contentId = useId();

  return (
    <section className="mb-[2.286rem] max-md:mb-7 max-md:border-b max-md:border-white/20 max-md:pb-6">
      <h3 className="m-0 font-body text-base font-medium uppercase text-brand-on-dark md:text-[1.143rem]">
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
          <span className="text-xl leading-none" aria-hidden="true">
            {open ? "−" : "+"}
          </span>
        </button>
      </h3>
      <div id={contentId} className={cn("mt-4 md:mt-[30px] md:block", open ? "block" : "hidden")}>
        {children}
      </div>
    </section>
  );
}
