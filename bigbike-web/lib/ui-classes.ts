/**
 * Shared Tailwind class bundles — the "1 CSS rule for many elements" cases.
 *
 * Replaces shared multi-selector groups that used to live in globals.css
 * (e.g. `.bb-card, .bb-product-card, .bb-fp-item, .bb-news-card { … }`).
 * Import the constant and drop it into `className` instead of repeating the
 * utilities, or re-declaring a shared CSS class.
 */

/** Brand hover affordance shared by every surface card (border highlight + product shadow). */
export const cardHover =
  "transition-[border-color,box-shadow] duration-200 hover:border-brand hover:shadow-[var(--bb-shadow-product)]";

/** Bordered surface card chrome: product card, news card, generic card, etc. */
export const cardChrome = `border border-border bg-card ${cardHover}`;
