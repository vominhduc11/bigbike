/**
 * Shared hand-rolled SVG icons that were duplicated byte-for-byte across feature
 * components. Only verbatim duplicates live here — single-use glyphs stay local,
 * and these are intentionally NOT swapped for lucide-react (that would change the
 * rendered path).
 */

/** Hamburger menu icon — shared by the desktop shop-info drawer and the mobile menu.
 * Optional className lets callers override the 22px default (e.g. responsive size-up
 * on 3xl/4xl). CSS width/height win over the presentation attributes below. */
export function MenuIcon({ className }: { className?: string } = {}) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <line x1="4" y1="6" x2="17.5" y2="6" />
      <line x1="4" y1="11" x2="19" y2="11" />
      <line x1="9" y1="16" x2="19" y2="16" />
    </svg>
  );
}

type CarouselArrowProps = { dir: "prev" | "next" };

/** Prev/next chevron used by the product galleries / related-products carousel. */
export function CarouselArrow({ dir }: CarouselArrowProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={dir === "prev" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
