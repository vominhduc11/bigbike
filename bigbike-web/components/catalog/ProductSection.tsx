import type { ReactNode } from "react";

type ProductSectionProps = {
  /** Anchor id — matched by ProductAnchorNav for sticky-nav jumps. */
  id: string;
  /** 1-based section number rendered in the badge (e.g. 1 → "01"). */
  index: number;
  /** Section heading. */
  title: string;
  children: ReactNode;
};

/**
 * One numbered band of the product detail page (Mô tả, Thông số, …).
 * The scroll-margin offsets the sticky site header + anchor nav so a
 * jumped-to section never lands hidden behind them.
 */
export function ProductSection({ id, index, title, children }: ProductSectionProps) {
  return (
    <section
      id={id}
      className="scroll-mt-[calc(var(--bb-header-stack,5rem)+4.5rem)] border-t border-border pt-10 first:border-t-0 first:pt-0"
    >
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-7 items-center bg-brand px-2.5 font-display text-sm font-semibold leading-none text-white">
          {String(index).padStart(2, "0")}
        </span>
        <h2 className="font-display text-xl font-semibold uppercase leading-tight tracking-tight text-foreground sm:text-2xl">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}
