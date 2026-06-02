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

/** Generic surface card (was `.bb-card`). Effective style after WP-parity
 * overrides: flat bg-card, border, no shadow, square. Add `cardHover` for the
 * hover variant (was `.bb-card-hover`, identical to it). */
export const bbCard =
  "relative overflow-hidden rounded-none border border-border bg-card text-foreground";
/** Card inner padding (was `.bb-card-content`): 20px desktop, 14px mobile. */
export const bbCardContent = "p-5 max-md:p-[14px]";

/* ── Shared typography bundles (were `.bb-*` leaf classes in globals.css) ──────
 * Direct-applied text-style classes with no contextual overrides. Font-size
 * tokens use the `text-<n>` @theme utilities (sm/base/xs/26 map 1:1 to the
 * --bb-text-* px/clamp values); `text-muted-foreground` == --bb-text-muted,
 * `text-brand` == --bb-text-brand, `tracking-display/wide` == the --bb-tracking-*. */

/** Form field label (was `.bb-field-label`). */
export const fieldLabel = "text-sm font-bold uppercase tracking-display text-muted-foreground";
/** Section heading, display font (was `.bb-section-heading`). */
export const sectionHeading = "font-display text-26 font-semibold uppercase text-foreground";
/** Smaller section subheading (was `.bb-section-subheading`). */
export const sectionSubheading = "font-heading text-base font-semibold uppercase text-foreground";
/** Empty/error state title (was `.bb-state-title`). */
export const stateTitle = "m-0 font-heading text-base font-semibold uppercase text-foreground";
/** Inline meta label (was `.bb-meta-label`). */
export const metaLabel = "text-sm uppercase tracking-display text-muted-foreground";
/** Table column header (was `.bb-table-header`). */
export const tableHeader = "font-heading text-xs font-semibold uppercase tracking-wide";
/** Detail value cell (was `.bb-detail-table-cell`). */
export const detailTableCell = "mt-[3px] block text-sm font-bold normal-case tracking-wide text-foreground";
/** Category badge text (was `.bb-category-badge`). */
export const categoryBadge = "m-0 text-sm font-bold uppercase tracking-display text-brand";

/** Auth card heading (was `.bb-auth-heading`). On auth-wrap h1s the kept marker
 * rule `.bb-page--auth .bb-auth-wrap h1` overrides this (text-32/uppercase). */
export const authHeading = "font-heading text-[length:var(--fs-h3)] font-semibold normal-case";
/** Auth form input sizing (was `.bb-auth-input`). */
export const authInput = "h-[52px] min-h-[52px] px-5 py-0 text-sm";

/** Inline text link (was `.bb-link`): blue resting (--bb-link-text), red on
 * hover/focus. The base red is overridden by later WP-parity groups, so the
 * effective resting color is the blue link token. */
export const bbLink =
  "font-bold no-underline text-[var(--bb-link-text)] transition-colors duration-fast ease-[var(--bb-ease-standard)] hover:text-brand focus-visible:text-brand";

/** Section vertical rhythm (was `.bb-section` padding-block: 32/52/section-y). */
export const sectionPad =
  "py-8 min-[640px]:py-[52px] min-[1024px]:py-[var(--bb-section-y)]";
/** Full centered content section rail (was `.bb-section`): rhythm + max-width
 * (--bb-container-xl incl. large-desktop expansion) + responsive inline padding. */
export const bbSection =
  "mx-auto max-w-[var(--bb-container-xl)] px-6 max-[600px]:px-4 " + sectionPad;

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
