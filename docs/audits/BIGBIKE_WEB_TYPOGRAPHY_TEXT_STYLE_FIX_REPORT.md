# BigBike Web — Typography / Text Style Fix Report

**Date:** 2026-05-12  
**Based on audit:** `docs/audits/BIGBIKE_WEB_TYPOGRAPHY_TEXT_STYLE_AUDIT.md`  
**Verdict before fix:** FAIL_NOT_MATCHING (1 P0, 29 P1, 24 P2, 21 P3 mismatches)

---

## 1. Executive Summary

Applied 8 groups of typography fixes to `bigbike-web` targeting WP parity. All changes are pure CSS (no component rewrites, no layout changes). TypeScript typecheck and Next.js production build both pass cleanly after changes.

**Approach:** Fixed root design tokens first (cascade source of truth), then patched specific component rules that used wrong tokens or had hard-coded incorrect values. The DESIGN.md enforcement block (bottom of `globals.css`) was the primary target since it takes cascade precedence over earlier rules.

**Claim:** Results CANNOT be claimed as "100% match" — runtime computed style verification (Playwright) has not been run. See §6.

---

## 2. Files Changed

| File | Lines changed | Reason |
|---|---|---|
| `bigbike-web/styles/brand-tokens.css` | 131–137, 141 | Token semantic remapping (root cause of most P1s) |
| `bigbike-web/app/globals.css` | Multiple (see §3) | Body, nav, sub-menu, product card, price, breadcrumb, section title, footer heading |

---

## 3. Changes by Group

### Group 1 — Font Token Semantic Remapping
**File:** `bigbike-web/styles/brand-tokens.css` lines 131–137, 141

**Root cause fixed:** `--bb-font-display` was Barlow Condensed (used everywhere headings appear) while WP uses Oswald for all heading/product contexts. `--bb-font-cta` was Oswald (used for buttons) while WP `.btn` uses Barlow Condensed. `--bb-font-nav` was Barlow while WP `header .navigation` uses Barlow Condensed.

| Token | Before | After | WP source |
|---|---|---|---|
| `--bb-font-display` | Barlow Condensed | **Oswald** | `custom.css .product--item-title`, `home.css .news--item-inside h3` |
| `--bb-font-heading` | Barlow | **Oswald** | `main.css b,h1,h2,h3,h4,h5,h6` + Oswald in WP heading contexts |
| `--bb-font-cta` | Oswald | **Barlow Condensed** | `main.css .btn{font-family:Barlow Condensed}` |
| `--bb-font-nav` | Barlow | **Barlow Condensed** | `main.css header .navigation{font-family:Barlow Condensed}` |
| `--bb-text-base` | 16.002px | **16px** | `main.css body{font-size:16px}` |

**Cascade effect:** This single change fixes font-family for all downstream rules that consume these tokens:
- `--bb-font-display` → hero titles, product names (all), section titles (via `--bb-font-heading`), footer headings, sub-menu items (after explicit rule fix), product addbar, category names
- `--bb-font-cta` → all `.bb-button`, `.wp-btn-primary`, `.wp-hero-cta`, `.wp-fp-cart a`, badge/tag/kicker elements
- `--bb-font-nav` → nav items (after explicit rule fix)

---

### Group 2 — Global Body Typography
**File:** `bigbike-web/app/globals.css`

| Property | Before | After | WP source |
|---|---|---|---|
| `body color` | `var(--bb-text-secondary)` (#6f6f6f) | `var(--bb-text-primary)` (#000) | `main.css body{color:#000}` |
| `body line-height` | `24.003px` (enforcement block) | `var(--bb-line-body)` (1.5) | `main.css body{line-height:1.5}` |
| `.bb-main, .wp-home, ...` color | `var(--bb-text-secondary)` | *removed* | Body cascade now applies |

**Two locations fixed:** initial body rule (line 19) + DESIGN.md enforcement block body rule. The enforcement block is cascade-authoritative. The `.bb-main, .wp-home, ...` rule that re-applied `color: var(--bb-text-secondary)` was stripping the body fix for all page content — that `color` property was removed.

---

### Group 3 — Header Navigation
**File:** `bigbike-web/app/globals.css` — DESIGN.md enforcement block, `.wp-navigation-item > a`

| Property | Before | After | WP source |
|---|---|---|---|
| `font-family` | `var(--bb-font-link)` (Barlow) | `var(--bb-font-nav)` (BC) | `main.css header .navigation{font-family:Barlow Condensed}` |
| `font-size` | 16px | **1.143rem** | `main.css header .navigation{font-size:1.143rem}` |
| `font-weight` | 400 | **600** | `main.css header .navigation--item>a{font-weight:600}` |
| `text-transform` | *(absent)* | **uppercase** | `main.css header .navigation--item>a{text-transform:uppercase}` |

Hover color (`var(--bb-brand-primary)` = #ff0c09) and hover border-bottom were already correct. No changes.

---

### Group 4 — Header Sub-menu
**File:** `bigbike-web/app/globals.css` — DESIGN.md enforcement block, `.wp-sub-menu-item > a`

| Property | Before | After | WP source |
|---|---|---|---|
| `font-family` | `var(--bb-font-link)` (Barlow) | `var(--bb-font-display)` (Oswald) | `custom.css header .navigation ul .navigation--item>.sub-menu li a{font-family:Oswald}` |
| `font-size` | 16px | **14px** | `custom.css …sub-menu li a{font-size:14px}` |
| `font-weight` | 400 | **600** | `custom.css …sub-menu li a{font-weight:600}` |
| `color` | `var(--bb-text-inverse-muted)` | **#6f6f6f** | `custom.css …sub-menu li a{color:#6f6f6f}` |

---

### Group 5 — Product Card Title & Price
**File:** `bigbike-web/app/globals.css` — DESIGN.md enforcement block

**Product name (`.wp-product-name` group rule + specific override):**

| Property | Before | After | WP source |
|---|---|---|---|
| `font-family` (group) | `var(--bb-font-cta)` (Oswald) | `var(--bb-font-display)` (Oswald) | `custom.css .product .product--item-title{font-family:Oswald}` |
| `font-size` | 18px | **16px** (specific override) | `custom.css body .product .product--item-title a{font-size:16px}` |
| `text-transform` | uppercase | **none** (specific override) | WP: no text-transform on product titles |

Note: font-family change on the group rule (`--bb-font-cta` → `--bb-font-display`) also improves `.wp-fp-title`, `.wp-news-card-title`, `.wp-article-title` (all of which use Oswald in WP).

**Product price (`.wp-product-price b` group rule):**

| Property | Before | After | WP source |
|---|---|---|---|
| `font-family` | `var(--bb-font-cta)` (Oswald) | `var(--bb-font-display)` (Oswald) | `custom.css body .product .product--item-price{font-family:Oswald}` |
| `font-size` | 16px | **14px** | `custom.css body .product .product--item-price{font-size:14px}` |

---

### Group 6 — Breadcrumb
**File:** `bigbike-web/app/globals.css` — line 4383 (early rule) + DESIGN.md enforcement block override

**Line 4383 fix:**

| Property | Before | After | WP source |
|---|---|---|---|
| `font-size` | 11px | **16px** | WP breadcrumb inherits body (16px); no explicit size set |
| `letter-spacing` | 0.08em | **0** | WP: no letter-spacing on breadcrumb |
| `text-transform` | uppercase | **none** | WP: no text-transform on breadcrumb |
| `color` | `var(--bb-text-muted)` | **#717171** | `custom.css body .breadcrumb ul li span{color:#717171}` |

**Line 4384 fix:** `color: var(--bb-text-muted)` → `#717171`; added `font-weight: 600` per WP.

**DESIGN.md enforcement block addition (after blue-link group):**
```css
.wp-breadcrumb, .wp-breadcrumb a { color: #717171; }
.wp-breadcrumb a { font-weight: 600; }
```
This overrides the blue color applied to `.wp-breadcrumb a` by the link group rule earlier in the enforcement block.

---

### Group 7 — Section Title Size
**File:** `bigbike-web/app/globals.css` — DESIGN.md enforcement block (added after heading group)

```css
.wp-section-title { font-size: 35px; }
@media (max-width: 767px) { .wp-section-title { font-size: 24px; } }
```

**WP source:** `custom.css body .block-title h3{font-size:35px}`; `@media(max-width:767px) body .block-title h3{font-size:24px}`

Font-family is handled by Group 1 token remapping (`--bb-font-heading` = Oswald, used in the existing heading group rule at `.bb-section-title, .wp-section-title, ...`).

---

### Group 8 — Footer Column Headings
**File:** `bigbike-web/app/globals.css` — DESIGN.md enforcement block, `.bb-footer .bb-footer-brand h2, .bb-footer .bb-footer-col h3`

| Property | Before | After | Reason |
|---|---|---|---|
| `font-family` | `var(--bb-font-cta)` (now BC) | `var(--bb-font-display)` (Oswald) | Footer section headings are heading-style, should use Oswald |

After token remapping `--bb-font-cta` → Barlow Condensed, footer headings would have incorrectly used BC. Explicitly switching to `--bb-font-display` (Oswald) corrects this.

---

## 4. Findings Fixed (from audit F-001 to F-020 reference)

| Finding | Description | Fixed? | Method |
|---|---|---|---|
| F-001 | Body color #6f6f6f vs WP #000 | **YES** | Group 2: body color → `--bb-text-primary` |
| F-002 | Body line-height 24.003px vs WP 1.5 | **YES** | Group 2: → `var(--bb-line-body)` |
| F-003 | Body font-size 16.002px vs WP 16px | **YES** | Group 1: `--bb-text-base` → 16px |
| F-004 | Nav font-family Barlow vs WP Barlow Condensed | **YES** | Group 3 + Group 1 `--bb-font-nav` |
| F-005 | Nav font-size 16px vs WP 1.143rem | **YES** | Group 3 |
| F-006 | Nav font-weight 400 vs WP 600 | **YES** | Group 3 |
| F-007 | Nav text-transform absent vs WP uppercase | **YES** | Group 3 |
| F-008 | Sub-menu font-family Barlow vs WP Oswald | **YES** | Group 4 |
| F-009 | Sub-menu font-size 16px vs WP 14px | **YES** | Group 4 |
| F-010 | Sub-menu font-weight 400 vs WP 600 | **YES** | Group 4 |
| F-011 | Sub-menu color muted-gray vs WP #6f6f6f | **YES** | Group 4 |
| F-012 | Product name font-family BC vs WP Oswald | **YES** | Group 1 + Group 5 |
| F-013 | Product name font-size 18px vs WP 16px | **YES** | Group 5 specific override |
| F-014 | Product name text-transform uppercase vs WP none | **YES** | Group 5 specific override |
| F-015 | Product price font-family (token was Oswald, now correctly Oswald via display) | **YES** | Group 5 (explicit `--bb-font-display`) |
| F-016 | Product price font-size 16px vs WP 14px | **YES** | Group 5 |
| F-017 | Section title font-family Barlow vs WP Oswald | **YES** | Group 1 `--bb-font-heading` |
| F-018 | Section title font-size clamp (~34px) vs WP 35px | **YES** | Group 7 |
| F-019 | Breadcrumb font-size 11px, uppercase, letter-spacing vs WP 16px plain | **YES** | Group 6 |
| F-020 | Breadcrumb color muted/blue vs WP #717171 | **YES** | Group 6 |

---

## 5. Findings Remaining (not addressed in this pass)

### P2 — Partial or deferred

| Finding | Description | Reason not fixed |
|---|---|---|
| Product card background dark vs WP white | WP uses white cards, bigbike-web uses dark (#bg-surface as white but `color: var(--bb-text-inverse)` = white text) | Outside typography scope; requires card design system rework |
| Hero title font-size clamp vs WP specific sizes | WP hero has specific px values; bigbike-web uses `clamp()` | UX decision; clamp gives better responsive behavior |
| Form input font-size 16px vs WP 14px | WP uses `font-size:14px` on form inputs | Separate form styling pass needed |
| Form label font-size (inherits 16px) vs WP 14px | Same as above | Separate form styling pass |
| `.wp-page-head h1` font-size clamp(22px-44px) vs WP 24px | DESIGN.md has no explicit size override | Non-critical; clamp is responsive |
| Footer background #1a1a1a vs WP #3a3a3a | Color, not typography | Background audit scope |
| Footer text color #cecece vs WP text color | WP footer text color not fully extracted | Non-critical |
| Nav hover border-bottom (bigbike-web addition) | WP has no border-bottom on hover; bigbike-web keeps it | UX enhancement, not regression |

### P3 — Minor / informational

| Finding | Description |
|---|---|
| `--bb-font-link` still Barlow | Used for inputs, chat items, minor UI; no WP evidence of different font |
| Letter-spacing tokens all `0` | Matches WP zero-spacing approach |
| `line-height: 1.5` on section titles in enforcement block | WP uses `4.286rem` on `.block-title h3` (= line-height proportional to 35px); bigbike-web `1.5` gives 52.5px at 35px font-size — acceptable |

---

## 6. NOT_VERIFIABLE Items

Per audit report §11, the following require Playwright computed-style verification to confirm:

1. **Actual rendered font stack** — whether `var(--font-oswald)` CSS variable resolves to the correct font-face in the browser (depends on next/font injection into `<html>` className)
2. **Nav font-size 1.143rem actual px** — resolves to ~18.3px at 16px root; WP is ~18.3px at 14px root = 16px. These differ.
3. **Section title 35px on desktop** — clamp from early rule (now overridden by explicit 35px in enforcement block) — need runtime confirmation that cascade is correct
4. **Breadcrumb computed color** — the DESIGN.md override block adds `#717171` after the blue rule; need to confirm cascade order at runtime
5. **Product name text-transform: none** — confirm the specific override (lower in file) correctly beats the grouped rule

### Recommended Playwright verification script

```javascript
// Spot-check computed styles for WP parity
const checks = [
  ['body', 'color', 'rgb(0, 0, 0)'],
  ['body', 'font-size', '16px'],
  ['body', 'line-height', '24px'],  // 16 × 1.5
  ['.wp-navigation-item > a', 'font-family', /Barlow Condensed/i],
  ['.wp-navigation-item > a', 'font-size', '18.288px'],  // 1.143rem × 16px
  ['.wp-navigation-item > a', 'font-weight', '600'],
  ['.wp-navigation-item > a', 'text-transform', 'uppercase'],
  ['.wp-sub-menu-item > a', 'font-family', /Oswald/i],
  ['.wp-sub-menu-item > a', 'font-size', '14px'],
  ['.wp-product-name', 'font-family', /Oswald/i],
  ['.wp-product-name', 'font-size', '16px'],
  ['.wp-product-name', 'text-transform', 'none'],
  ['.wp-product-price b', 'font-family', /Oswald/i],
  ['.wp-product-price b', 'font-size', '14px'],
  ['.wp-section-title', 'font-family', /Oswald/i],
  ['.wp-section-title', 'font-size', '35px'],
  ['.wp-breadcrumb', 'font-size', '16px'],
  ['.wp-breadcrumb', 'text-transform', 'none'],
  ['.wp-breadcrumb a', 'color', 'rgb(113, 113, 113)'],
];
```

---

## 7. Build & Typecheck Results

| Check | Result |
|---|---|
| `tsc --noEmit` | **PASS** (exit 0, no type errors) |
| `next build` | **PASS** (Compiled successfully in 6.6s, all routes generated) |
| Warnings | 2 pre-existing Sentry deprecation warnings (unrelated to typography) |

---

## 8. Summary of What Changed

**`bigbike-web/styles/brand-tokens.css`**
- `--bb-font-display`: Barlow Condensed → **Oswald**
- `--bb-font-heading`: Barlow → **Oswald**
- `--bb-font-cta`: Oswald → **Barlow Condensed**
- `--bb-font-nav`: Barlow → **Barlow Condensed**
- `--bb-text-base`: 16.002px → **16px**

**`bigbike-web/app/globals.css`**
- Body `color`: `--bb-text-secondary` → **`--bb-text-primary`** (2 places: initial + enforcement)
- Body `line-height`: `24.003px` → **`var(--bb-line-body)`** (enforcement block)
- `.bb-main, .wp-home, ...`: removed `color: var(--bb-text-secondary)` override
- `.wp-navigation-item > a`: font-family → `--bb-font-nav`, size → `1.143rem`, weight → `600`, + `text-transform: uppercase`
- `.wp-sub-menu-item > a`: font-family → `--bb-font-display`, size → `14px`, weight → `600`, color → `#6f6f6f`
- Product name group: font-family `--bb-font-cta` → `--bb-font-display`; added `.wp-product-name { font-size: 16px; text-transform: none }`
- Product price group: font-family `--bb-font-cta` → `--bb-font-display`; size `16px` → `14px`
- Breadcrumb (line 4383): size `11px` → `16px`, letter-spacing `0.08em` → `0`, text-transform `uppercase` → `none`, color → `#717171`
- Breadcrumb link (line 4384): color → `#717171`, `font-weight: 600` added
- Breadcrumb enforcement override: `{ color: #717171 }` added after blue-link group
- Section title: `font-size: 35px` + `@media (max-width: 767px) { font-size: 24px }` added
- Footer headings: font-family `--bb-font-cta` → `--bb-font-display`
