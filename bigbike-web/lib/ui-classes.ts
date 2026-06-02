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

/* ── Skeleton shimmer system (was `.bb-skel*` in globals.css) ──────────────────
 * Loading-placeholder primitives shared by Skeletons.tsx + the per-page loading
 * states. Shapes are square by default (the global `.bb-theme :is(span…)` rule
 * forces radius 0); SkelCircle adds `!rounded-full` to win that specificity.
 * The `skeleton-shimmer` keyframe stays in globals.css (Tailwind can't define it). */

/** Shimmer base: animated gradient sweep. Set width/height via style or extra classes. */
export const skelBase =
  "block animate-skeleton-shimmer bg-[linear-gradient(90deg,rgba(0,0,0,0.04)_0%,rgba(0,0,0,0.1)_50%,rgba(0,0,0,0.04)_100%)] bg-[length:200%_100%] motion-reduce:animate-none";

/** Vertical group of skeleton lines (was `.bb-skel-col`). */
export const skelCol = "flex min-w-0 flex-col gap-2";
/** Horizontal group, vertically centered (was `.bb-skel-row`). */
export const skelRow = "flex items-center gap-2";
/** Stacked block spacing (was `.bb-skel-stack`: 12px between children). */
export const skelStack = "space-y-3";
