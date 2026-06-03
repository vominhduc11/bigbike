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

/* ── Account shell bundles (were `.bb-account-*` leaf in globals.css) ──────────
 * Shared by AccountShell and the account Skeletons (page mirror). */

/** Account section heading row (was `.bb-account-header` container). */
export const accountHeaderShell =
  "mb-[22px] flex items-center justify-between border-b border-[#e4e4e4] pb-3.5 max-md:mb-4 max-md:pb-3";
/** Account sidebar rail (was `.bb-account-sidebar`): sticky desktop, static <=1024px. */
export const accountSidebar =
  "sticky top-[calc(var(--bb-header-height)_+_24px)] [align-self:start] max-[1024px]:static";

/* ── Shared typography bundles (were `.bb-*` leaf classes in globals.css) ──────
 * Direct-applied text-style classes with no contextual overrides. Font-size
 * tokens use the `text-<n>` @theme utilities (sm/base/xs/26 map 1:1 to the
 * --bb-text-* px/clamp values); `text-muted-foreground` == --bb-text-muted,
 * `text-brand` == --bb-text-brand, `tracking-display/wide` == the --bb-tracking-*. */

/** Form field label (was `.bb-field-label`). */
export const fieldLabel = "text-sm font-bold uppercase tracking-display text-muted-foreground";
/** Section eyebrow / kicker — the small uppercase label above a section title.
 * Canonical: muted gray, wide tracking, condensed black. The ONE eyebrow style
 * (home/compare/recently-viewed previously split between muted-grey and brand-red).
 * Compose with spacing, e.g. `cn(sectionEyebrow, "mb-3")`. */
export const sectionEyebrow =
  "text-[var(--bb-text-muted)] font-cta text-[length:var(--bb-text-section-kicker)] tracking-[0.15em] font-black leading-none uppercase";
/** Primary section heading (h2-level), fluid 30→50px. The ONE canonical section
 * title — unified from the prior split (`text-26` here vs the home inline
 * `--bb-text-section-title`). Compose with spacing, e.g. `cn(sectionHeading, "mb-4")`. */
export const sectionHeading =
  "m-0 font-heading text-[length:var(--bb-text-section-title)] font-semibold leading-[1.2] tracking-normal uppercase text-foreground";
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

/** Header action icon button (was `.bb-user-control .bb-icon-btn` /
 * `.bb-site-header .bb-cart-icon-link`): full-height transparent square button,
 * white icon, brand-red on hover with a faint white wash, focus ring; WCAG
 * touch-target (44px) on coarse pointers and at the <=768 edge. Shared by the
 * search / shop-info / mobile-menu triggers and the cart link. Compose with the
 * per-button visibility classes (e.g. `hidden md:inline-flex`). */
export const iconBtn =
  "inline-flex items-center justify-center h-full min-h-[var(--bb-header-height)] w-auto py-0 px-[clamp(10px,0.9vw,16px)] " +
  "text-white bg-transparent border-none rounded-none text-[1.286rem] leading-none cursor-pointer no-underline " +
  "transition-[color,background] duration-fast ease-[var(--bb-ease-standard)] " +
  // `!` on hover color: the cart link is an <a>, so the unlayered global `a:hover`
  // (brand red #cc0906) would otherwise beat this; rgba (not the /opacity form) to
  // match the legacy literal rgba rather than v4's oklab mix.
  "hover:!text-[var(--bb-brand-primary)] hover:bg-[rgba(255,255,255,0.05)] " +
  "focus-visible:outline-none focus-visible:[outline:2px_solid_var(--bb-brand-primary)] focus-visible:[outline-offset:-2px] " +
  // Touch-target only widens (min-width 44px) — the base min-height (header height)
  // out-specified the old touch-target min-height, so that stays at the header height.
  "pointer-coarse:min-w-[var(--bb-touch-target)] max-[769px]:min-w-[var(--bb-touch-target)]";

/** Submenu category icon (was `.bb-submenu-icon`): a 20×16 mask-image glyph that
 * paints with currentColor, so it follows the parent link's text color (white →
 * brand-red on hover). The mask-image URL is set inline per item. Shared by the
 * desktop mega-menu (HeaderNavItem) and the mobile drawer (MobileHeaderMenu). */
export const submenuIcon =
  "inline-block shrink-0 w-5 h-4 bg-current " +
  "[mask-repeat:no-repeat] [mask-position:center] [mask-size:contain] " +
  "[-webkit-mask-repeat:no-repeat] [-webkit-mask-position:center] [-webkit-mask-size:contain] " +
  "transition-[background-color] duration-[var(--bb-duration-normal)] ease-[ease]";

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

/** Product card grid — 1 col / 2 cols ≥576 / 3 cols ≥992, 24px gap. Was the
 * `.bb-product-grid` rule (removed when catalog/archive moved inline); shared by
 * the favorites page and its loading skeleton so the two stay in lockstep. */
export const productGrid =
  "grid grid-cols-1 gap-6 min-[576px]:grid-cols-2 min-[992px]:grid-cols-3";

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
