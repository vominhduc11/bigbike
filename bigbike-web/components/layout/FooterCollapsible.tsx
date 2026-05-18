"use client";

import { useState } from "react";
import type { ReactNode } from "react";

/**
 * Cột chân trang dạng thu gọn trên mobile (nút +/−), luôn mở trên desktop (≥ md).
 */
export function FooterCollapsible({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="border-t border-white/10 md:border-t-0">
      <h3 className="m-0">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 py-4 text-left md:cursor-default md:py-0"
        >
          <span className="font-display uppercase text-base text-brand">{title}</span>
          <span className="text-brand text-2xl leading-none md:hidden" aria-hidden="true">
            {open ? "−" : "+"}
          </span>
        </button>
      </h3>
      <div className={`${open ? "grid" : "hidden"} gap-3 pb-5 md:grid md:pb-0 md:pt-1`}>
        {children}
      </div>
    </section>
  );
}
