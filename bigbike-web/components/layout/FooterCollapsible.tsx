"use client";

import { useState } from "react";
import type { ReactNode } from "react";

export function FooterCollapsible({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="mb-[2.286rem] max-md:border-b max-md:border-[#4b4b4b] max-md:pb-10">
      <h3 className="m-0">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 text-left md:cursor-default"
        >
          <span className="font-body text-base font-medium uppercase text-brand">{title}</span>
          <span className="text-2xl leading-none text-brand md:hidden" aria-hidden="true">
            {open ? "−" : "+"}
          </span>
        </button>
      </h3>
      <div className={`${open ? "block" : "hidden"} mt-[30px] md:block`}>{children}</div>
    </section>
  );
}
