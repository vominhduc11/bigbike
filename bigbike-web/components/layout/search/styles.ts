// Class bundles + path constant for the search panel, lifted out of SearchToggle
// to keep the component file focused on logic. Pure strings — behavior lives in SearchToggle.

// Inline-Tailwind class bundles for the search-panel CONTENT (the overlay shell
// — layer/overlay/panel/form/input + transitions/keyframe — stays in globals.css
// per the CLAUDE.md keyframe/complex-pseudo exemption). Search reds use
// --bb-brand-primary (#ff0c09) → text-brand-on-dark (the exact-value token).
export const preLabelRow =
  "flex items-center justify-between border-b border-border bg-card px-4 pt-2 pb-1 max-md:border-0 max-md:bg-transparent max-md:px-0 max-md:pt-0 max-md:pb-2";
export const preLabel =
  "font-cta text-b5-label font-bold uppercase tracking-normal text-muted-foreground";
export const preChips =
  "flex flex-wrap gap-1.5 px-4 pb-3 pt-2.5 max-md:gap-2 max-md:px-0 max-md:pb-5 max-md:pt-0";
export const preChip =
  "inline-flex min-h-11 cursor-pointer items-center gap-1.5 border border-border bg-card px-3 font-cta text-b4-action font-semibold text-foreground transition-colors duration-fast hover:text-brand-on-dark focus-visible:text-brand-on-dark focus-visible:outline-none";
export const preContent =
  "min-h-0 flex-1 overflow-y-auto [overscroll-behavior:contain] max-md:px-6 max-md:pt-4 max-md:pb-[calc(24px_+_env(safe-area-inset-bottom))]";
export const preSection = "max-md:mb-5";
export const preRemove =
  "inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-muted-foreground transition-colors duration-fast hover:text-foreground focus-visible:text-foreground focus-visible:outline-none";
export const resultItem =
  "flex cursor-pointer items-center gap-3 border-b border-border px-4 py-2.5 text-foreground no-underline transition-colors duration-fast hover:bg-card focus-visible:bg-card focus-visible:outline-none max-md:px-0";
export const resultsLabel =
  "m-0 border-b border-border bg-card px-4 pt-2 pb-1 font-cta text-b5-label font-bold uppercase tracking-normal text-muted-foreground";

// ── Search SHELL bundles (were the `.bb-header-search*` overlay rules in
// globals.css). Dual layout: desktop centered-bar dropdown ↔ mobile (≤767 =
// max-md) full-screen. Raw var() refs + `color:`-hinted arbitraries mirror the
// legacy cascade exactly (the mobile "light reskin" layer is already merged in).
// The `bb-suggest-in` keyframe and the global prefers-reduced-motion duration
// override stay in globals.css.
export const sLayer =
  "pointer-events-none opacity-0 invisible [transition:opacity_0.3s_ease,visibility_0s_linear_0.3s] " +
  // md+ stacking-context anchor: the opacity fade-in (opacity<1 mid-transition) makes
  // THIS layer a transient stacking context. Without an explicit z on a positioned
  // layer it forms at z-auto → during the 0.3s fade the whole overlay (dim+panel)
  // drops below any positive-z page content, which then pokes through; after the fade
  // (opacity=1) the context dissolves and it pops back. Pinning relative + z-modal makes
  // the context permanent and high, so transient and settled states are identical.
  "md:relative md:z-[var(--bb-z-modal)] max-md:z-[var(--bb-z-modal)] " +
  // fixed black bar across the header strip (desktop only; hidden on the mobile full-screen panel)
  "before:content-[''] before:fixed before:inset-x-0 before:top-0 before:h-[var(--bb-header-height)] " +
  "before:bg-black before:opacity-0 before:z-[var(--bb-z-modal)] before:[transition:opacity_0.2s_ease] max-md:before:hidden";
export const sLayerOpen =
  "pointer-events-auto opacity-100 visible [transition:opacity_0.3s_ease,visibility_0s_linear_0s] before:opacity-100";
export const sOverlay =
  // md+ z-index: the dim layer must sit just under the panel (z-modal+1). Without an
  // explicit z it falls back to auto and any positioned WP-theme PDP element (z>0)
  // paints above it → background looks un-dimmed. Mobile keeps its own z via sOverlayOpen.
  "fixed inset-0 [border:none] bg-[rgba(0,0,0,0.64)] md:z-[var(--bb-z-modal)] " +
  "max-md:bg-[color-mix(in_srgb,var(--bb-color-black)_58%,transparent)]";
// open: the .is-open .overlay rule lifts the overlay just under the mobile panel
export const sOverlayOpen = "max-md:z-[calc(var(--bb-mobile-panel-z)_-_1)]";
export const sPanel =
  "fixed top-0 left-1/2 z-[calc(var(--bb-z-modal)_+_1)] w-[min(calc(100vw_-_24px),770px)] h-[var(--bb-header-height)] " +
  "px-10 py-0 [transform:translateX(-50%)] " +
  "max-md:left-0 max-md:z-[var(--bb-mobile-panel-z)] max-md:flex max-md:w-screen max-md:h-[100dvh] max-md:max-h-[100dvh] " +
  "max-md:flex-col max-md:p-0 max-md:overflow-hidden max-md:bg-[var(--bb-bg-page)] max-md:text-[color:var(--bb-text-primary)] max-md:[transform:none]";
export const sForm =
  "relative flex items-center h-full " +
  "max-md:h-auto max-md:min-h-[calc(var(--bb-header-height)_+_env(safe-area-inset-top))] " +
  "max-md:[padding:max(10px,env(safe-area-inset-top))_14px_10px] max-md:gap-2 " +
  "max-md:[border-bottom:1px_solid_var(--bb-mobile-shell-border)] max-md:bg-[var(--bb-bg-surface-dark-2)] max-md:flex-[0_0_auto]";
export const sIcon =
  "absolute top-1/2 left-0 mt-[3px] [transform:translateY(-50%)] text-white " +
  "max-md:static max-md:inline-flex max-md:w-[var(--bb-touch-target)] max-md:h-[var(--bb-touch-target)] " +
  "max-md:min-w-[var(--bb-touch-target)] max-md:min-h-[var(--bb-touch-target)] max-md:items-center max-md:justify-center " +
  "max-md:[transform:none] max-md:text-[color:var(--bb-text-inverse)]";
export const sClose =
  // min-h-0 / p-0 ungated: the base `.bb-header-search-close` rule was !important,
  // beating the ≤767 touch-target min-height, so the action stays min-height:0 everywhere.
  // Clear and close share this fixed action slot now that only one X is rendered.
  "absolute top-1/2 right-0 [transform:translateY(-50%)] min-h-0 p-0 text-white " +
  "hover:bg-transparent hover:text-[color:var(--bb-brand-primary)] focus-visible:bg-transparent focus-visible:text-[color:var(--bb-brand-primary)] " +
  "max-md:static max-md:right-auto max-md:w-[var(--bb-touch-target)] max-md:h-[var(--bb-touch-target)] " +
  "max-md:min-w-[var(--bb-touch-target)] max-md:items-center max-md:justify-center max-md:[transform:none] max-md:text-[color:var(--bb-text-inverse)]";
export const sClear = sClose;
export const sLoading =
  "absolute top-1/2 right-20 flex h-[var(--bb-touch-target)] w-[var(--bb-touch-target)] shrink-0 " +
  "items-center justify-center [transform:translateY(-50%)] text-white " +
  "max-md:static max-md:right-auto max-md:ml-auto max-md:[transform:none] max-md:text-[color:var(--bb-text-inverse)]";
export const sInput =
  // `!` mirrors the legacy !important — guarantees these win over the shadcn Input
  // base regardless of twMerge grouping. A4 keeps search input at 16px on mobile
  // (preventing iOS zoom) and 18px on desktop, including ultra-wide screens.
  "h-full [border:none]! bg-transparent! [padding:0_88px_0_34px]! [box-shadow:none]! [color:var(--bb-text-inverse)]! text-a4-content! " +
  "placeholder:text-white placeholder:opacity-100 placeholder:font-normal focus-visible:outline-none " +
  "max-md:h-[var(--bb-touch-target)]! max-md:[border:1px_solid_rgba(255,255,255,0.18)]! max-md:bg-[var(--bb-bg-surface)]! " +
  "max-md:[padding:0_12px]! max-md:text-[color:var(--bb-text-primary)]! max-md:leading-none! " +
  "max-md:min-w-0 max-md:placeholder:text-[color:var(--bb-text-secondary)]";
export const sResults =
  "absolute top-full left-10 right-10 z-[1] bg-background [border-top:2px_solid_var(--bb-brand-primary)] " +
  "[box-shadow:0_8px_32px_rgba(0,0,0,0.18)] animate-[bb-suggest-in_180ms_var(--bb-ease-standard)_both] motion-reduce:animate-none " +
  "md:flex md:flex-col md:overflow-hidden md:[max-height:min(520px,calc(100dvh-var(--bb-header-height)-24px))] " +
  "max-md:static max-md:left-auto max-md:right-auto max-md:flex max-md:flex-1 max-md:flex-col max-md:min-h-0 max-md:max-h-none " +
  "max-md:overflow-hidden max-md:[box-shadow:none] max-md:animate-none max-md:rounded-none";
