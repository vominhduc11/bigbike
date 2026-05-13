# BigBike Web — Video/Carousel Section UI Fix Report

**Date:** 2026-05-13
**Scope:** `bigbike-web` — Home Video Carousel section
**Status:** COMPLETE — build pass

---

## Files Changed

| File | Change type |
|---|---|
| `bigbike-web/app/globals.css` | CSS cascade fixes + section rewrite |
| `bigbike-web/components/home/HomeVideoCarousel.tsx` | PlayIcon component update |

---

## Root Cause: Cascade Conflicts

The video section was declared as a dark/biker section (lines ~6355) but was later overridden by 7 "light-first WP-parity" blocks added in a previous Track B audit. These overrides effectively undid all dark styling:

| Override location | Effect |
|---|---|
| `background: var(--bb-bg-page)` block 1 (line ~7166) | Made `.wp-video-section` background white |
| `color: var(--bb-text-primary)` header block (line ~7125) | Made header text black |
| `background: var(--bb-bg-page)` block 2 (line ~8160) | Made background white again |
| `color: var(--bb-text-primary)` titles block (line ~8229) | Made title text black → invisible on dark bg |
| `padding-block: var(--bb-section-y)` (line ~8884) | Added padding to outer wrapper, conflicting with `padding: 0` |
| `padding-block: 32px` responsive (line ~9105) | Same issue on mobile |
| `padding-block: 52px` responsive (line ~9125) | Same issue on tablet |
| `border-bottom: 1px solid rgba(221,221,221,0.28)` (line ~8895) | Imposed light border on dark section header |

**Fix:** Removed `.wp-video-section` / `.wp-video-section-header` / `.wp-video-section-title` from all 7 incorrect light-first override blocks.

---

## UI Issues Fixed

### 1. Heading / Title

| Before | After |
|---|---|
| `color: black` (overridden by light theme) — unreadable on dark bg | `color: #fff` restored, `text-shadow: 0 2px 16px rgba(0,0,0,0.9)` |
| `font-size: 35px`, `font-weight: 400` | `font-size: 42px`, `font-weight: 700` |
| No separator between title and carousel | Red accent bar (`::after` 48px × 3px) + white divider line |
| `letter-spacing: 0.02em` | `letter-spacing: 0.06em` — more display-appropriate |
| `line-height: 1.2` | `line-height: 1.1` — tighter, more impactful |

### 2. Background

| Before | After |
|---|---|
| Background image present but `background: white` override made it invisible | `background: var(--bb-bg-surface-dark-3)` restored as base |
| No overlay — bg image competed directly with cards | `::before` gradient overlay: `rgba(0,0,0,0.72)→0.58→0.78` top-to-bottom |
| Background anchored at center | `background-position: center 30%` shows upper portion of bike image |
| No `position: relative` on inner | Added `position: relative` + `z-index` stacking for container |

### 3. Video Cards

| Before | After |
|---|---|
| `background: #c00` (full saturated red) bleeding through `opacity: 0.7` thumbnail | `background: #1a1a1a` (neutral dark) + `::after` red tint at `rgba(160,0,0,0.18)` |
| `max-height: 233px` cap — card felt small | Removed height cap; `aspect-ratio: 16/10` fills viewport naturally |
| No card elevation | `box-shadow: 0 4px 20px rgba(0,0,0,0.5)` + stronger on hover |
| Flat look | Border-top on `.wp-video-card-desc` animates to red on hover |

### 4. Thumbnail Overlay

| Before | After |
|---|---|
| Thumbnail `opacity: 0.7` + red `#c00` background = heavy red wash | `opacity: 0.88` (less dark) + `::after` pseudo `rgba(160,0,0,0.18)` |
| Hover only scaled | Hover: scale `1.04` + opacity `0.78` + tint increases to `rgba(200,0,0,0.28)` |

### 5. Play Button

| Before | After |
|---|---|
| Raw 30×34px SVG triangle floating on thumbnail | 56×56px glass circle (`border-radius: 50%`, `border: 2px solid rgba(255,255,255,0.75)`) |
| No background — low contrast on bright thumbnails | `background: rgba(0,0,0,0.52)` |
| Hover: scale 1.1 only | Hover: circle turns red `rgba(200,0,0,0.72)`, scale `1.08` |
| `aria-hidden` not on wrapper | `aria-hidden="true"` on both `<span>` wrapper and SVG |
| `.bb-theme` reset `border-radius: 0` on all `<span>` | Added `.wp-video-play-btn-ring` to `border-radius: 50%` exception list |

**TSX change:** `PlayIcon` now returns `<span className="wp-video-play-btn-ring"><svg …/></span>`.

### 6. Carousel Arrows

| Before | After |
|---|---|
| `background: transparent`, no border — invisible controls | `background: rgba(0,0,0,0.55)`, `border: 1px solid rgba(255,255,255,0.18)` |
| 32×50px irregular shape | 44×44px square (touch-compliant) |
| Positioned at `-98px` / `-40px` outside container | Positioned at `-60px` / `-52px` desktop; overlaid at edges for tablet |
| Hidden at ≤991px | Visible at 768–991px (compact 36×36px, overlaid at `left:6px/right:6px`) |
| Hidden at ≤991px | Hidden only at ≤575px (mobile) |
| No `focus-visible` | `outline: var(--bb-focus-outline)` on focus |
| SVG `width/height: 100%` | SVG fixed `18×18px` |

### 7. Pagination Dots

| Before | After |
|---|---|
| `8px × 8px` circle as the button itself — touch target too small | Button is `24px × 44px` transparent; visual dot via `::before` pseudo-element |
| `background: #cecece` (light gray on dark = low contrast) | `rgba(255,255,255,0.35)` (white-tinted) |
| Active: `width: 20px` + red | Active: `width: 28px` + red — slightly wider pill |
| No `focus-visible` | `outline` on focus |
| `margin-top: 30px` | `margin-top: 28px` + `align-items: center` for correct optical alignment |

### 8. Modal

| Before | After |
|---|---|
| Close button: bare `×` with no background | `background: rgba(255,255,255,0.1)` + border + hover turns red |
| `z-index: 1000` (magic number) | `z-index: var(--bb-z-modal)` (500 from tokens) |
| Title plain `1rem` | Oswald font, `0.9375rem`, `uppercase`, `letter-spacing: 0.04em` |
| `focus-visible` missing on close | `outline: var(--bb-focus-outline)` added |

---

## Responsive Breakpoints Checked

| Viewport | Title | Background | Cards | Arrows | Dots |
|---|---|---|---|---|---|
| 375px | 24px, readable | Overlay present | Full width, natural ratio | Hidden | Visible, large touch target |
| 430px | 24px | ✓ | ✓ | Hidden | ✓ |
| 768px | 32px | ✓ | 2 per row (Swiper breakpoint) | Compact overlaid | ✓ |
| 1024px | 32px | ✓ | 3 per row | Overlaid at -24px | ✓ |
| 1366px | 42px | ✓ | 3 per row | -52px outside | ✓ |
| 1440px | 42px | ✓ | 3 per row | -60px outside | ✓ |
| 1920px | 42px | ✓ | 3 per row (container capped at 75rem) | -60px outside | ✓ |

---

## Build Results

```
TypeScript: no errors (tsc --noEmit)
ESLint: 6 pre-existing issues (3 errors in ForgotPasswordFlow.tsx, CartIcon.tsx, wishlist-context.tsx — none in changed files)
Next.js build: SUCCESS (all pages compiled, no new errors)
```

---

## Data / CMS Notes

No hardcoded titles used. All video cards render `safeText(video.title, "Video")` from the `HomeVideo.title` field (string from API). The `text-transform: uppercase` in CSS normalizes display without modifying source data.

If video titles still appear as raw slugs (`forma-low`, `ray-man`), the issue is upstream in the CMS admin — the video record's `title` field needs to be set. The frontend renders whatever the API returns; no slug-to-title coercion needed since the `safeText` fallback is `"Video"`.

---

## Sections Not Affected

All other homepage sections (`HeroSlider`, `FeaturedProductsCarousel`, `ExperienceCarousel`, `NewsSection`, `BrandCarousel`, SEO content) were not modified. The cascade conflict fixes only removed classes from multi-selector blocks; no styles for other sections were altered.
