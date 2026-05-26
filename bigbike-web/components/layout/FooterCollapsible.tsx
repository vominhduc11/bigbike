"use client";

import { useState } from "react";
import type { ReactNode } from "react";

export function FooterCollapsible({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="mb-[2.286rem] max-md:mb-7 max-md:border-b max-md:border-white/20 max-md:pb-6">
      <h3 className="m-0">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex min-h-[44px] w-full items-center justify-between gap-2 text-left md:min-h-0 md:cursor-default"
        >
          <span className="font-body text-base font-medium uppercase text-white md:text-[1.143rem]">{title}</span>
          <span className="text-xl leading-none text-white md:hidden" aria-hidden="true">
            {open ? "−" : "+"}
          </span>
        </button>
      </h3>
      <div className={`${open ? "block" : "hidden"} mt-4 md:mt-[30px] md:block`}>{children}</div>
    </section>
  );
}
