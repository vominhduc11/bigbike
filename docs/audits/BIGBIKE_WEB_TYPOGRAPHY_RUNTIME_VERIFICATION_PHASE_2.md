# BigBike Web — Typography Runtime Computed-Style Verification Report — Phase 2

**Date:** 2026-05-12  
**Engineer role:** Senior Frontend QA Engineer  
**Tool:** Playwright 1.60.0 (headless Chromium)  
**Server:** Next.js 16 production (`npm start`, rebuilt with mock API data)  
**Script:** `bigbike-web/scripts/verify-typography-computed.mjs`  
**Raw data:** `docs/audits/runtime/typography-computed-results.json`

Prerequisite reports:
- Phase 1: `docs/audits/BIGBIKE_WEB_TYPOGRAPHY_RUNTIME_VERIFICATION.md` — 822 PASS, 0 FAIL, verdict: PASS_RUNTIME_PARITY

---

## 1. Objective

Phase 1 ended with 4 selector groups marked NOT_VERIFIABLE due to the absence of backend API data. Phase 2 targets closure of those gaps by running the same verification script against a Next.js production build served with a minimal mock API fixture.

**P1 selectors to close:**

| Selector | Phase 1 status |
|---|---|
| `.wp-product-name` | NOT_VERIFIABLE (no products rendered) |
| `.wp-product-price b` | NOT_VERIFIABLE (same) |
| `.wp-section-title` | NOT_VERIFIABLE (same) |
| `.wp-pdp-related-title` | NOT_VERIFIABLE (product detail empty shell) |

**Additional P2 selectors included:**

| Selector | Phase 1 status |
|---|---|
| `.bb-button` | NOT_VERIFIABLE (no CTA contexts) |
| `.wp-btn-primary` | NOT_VERIFIABLE (same) |
| `.wp-page-head h1` | NOT_VERIFIABLE (no page-head H1 contexts) |

---

## 2. Environment and Approach

### Mock API server

Backend (`localhost:8080`) was not available. A minimal Node.js HTTP fixture server was created at `bigbike-web/scripts/mock-api-server.mjs` (not production-committed). The server responds to all API endpoints needed for a Next.js production build.

Key fixture data injected:

| Resource | Count | Notes |
|---|---|---|
| Products | 4 | 3 in category `ao-bao-ho-moto`; 1 in `tui-dung-xe-may` |
| Categories | 3 | `mu-bao-hiem`, `ao-bao-ho-moto`, `tui-dung-xe-may` |
| Articles | 2 | Standard blog entries |
| Sliders | 2 | Homepage hero |
| Home videos | 1 | |
| Pages | 2 | `gioi-thieu`, `lien-he` (contact form) |
| Menus | 2 | `header`, `footer` — **items array empty** (see §5.1) |

Three products share the same category (`ao-bao-ho-moto`) so the `/product/ls2-koku-kidney-belt` PDP renders a **Related Products** section — this is the condition required for `.wp-pdp-related-title` to appear in the DOM.

### Build procedure

```
# 1. Start mock API server (background)
node bigbike-web/scripts/mock-api-server.mjs

# 2. Clear stale fetch-cache so next build fetches from mock server
rm -rf bigbike-web/.next/cache/fetch-cache

# 3. Rebuild production with mock data
npm run build --prefix bigbike-web

# 4. Start production server
npm start --prefix bigbike-web
```

The build pre-rendered 4 PDP pages using `generateStaticParams()` from the mock `/api/v1/products` response.

### Scope

| Dimension | Value |
|---|---|
| Viewports | 375 px (mobile), 768 px (tablet), 1440 px (desktop) |
| Routes | 12 — `/`, `/san-pham`, `/danh-muc-san-pham`, `/product/ls2-koku-kidney-belt`, `/tim-kiem`, `/tin-tuc`, `/tin-tuc/tai-nghe-bluetooth-5-3-la-gi`, `/lien-he`, `/dang-nhap`, `/gioi-thieu`, `/bao-hanh`, `/gio-hang` |
| Selector groups | 18 (same 16 from Phase 1 + `/bao-hanh` and `/gio-hang` added for button coverage) |
| CSS properties checked | 16 per selector |

---

## 3. Summary

| Metric | Count |
|---|---|
| **TOTAL CHECKS** | **657** |
| **PASS** | **657** |
| **FAIL** | **0** |
| **MISSING_SELECTOR** | **363** |
| **ERROR** | **0** |

MISSING_SELECTOR breakdown by selector group (all expected — see §5):

| Selector label | MISSING count | Cause |
|---|---|---|
| `nav-item-link` | 36 | Mock server returns empty menu items (see §5.1) |
| `sub-menu-link` | 36 | Same |
| `section-title` | 36 | CSS class not present in any React component (see §5.2) |
| `product-card-name` | 33 | Selector present only on `/san-pham`; absent on 11 other routes |
| `product-price-current` | 33 | Same |
| `pdp-related-title` | 33 | Renders only on `/product/ls2-koku-kidney-belt`; absent on 11 other routes |
| `form-input` | 30 | Login page only; absent on 10 other routes |
| `page-h1` | 30 | Present on `/danh-muc-san-pham` and `/bao-hanh` only |
| `breadcrumb` | 24 | Present on 4 routes (category, product-detail, news-detail, warranty) |
| `breadcrumb-link` | 24 | Same |
| `button-primary` | 24 | Present on 4 routes (search, news-detail, contact, login) |
| `wp-btn-primary` | 24 | Present on 4 routes (product-detail, news-list, warranty, cart) |

---

## 4. Verdict

> **INCONCLUSIVE_REMAINING_DATA_GAPS**

All Phase 1 NOT_VERIFIABLE selectors that could be reached via DOM have been verified and **passed**. However, `.wp-section-title` remains permanently unverifiable because the CSS class is not referenced in any React/TSX component in the codebase — it cannot be found in the DOM regardless of API data availability. Per the Phase 2 rules, full confirmation cannot be claimed while a P1 selector remains unresolved.

All 657 verifiable checks returned PASS. Zero CSS failures were detected.

---

## 5. Phase 1 Gap Closure — Selector-by-Selector

### 5.1 Navigation items — NOT NEWLY VERIFIED (Phase 1 already PASS)

`.wp-navigation-item:not(.active) > a` and `.wp-sub-menu-item > a` are MISSING in Phase 2 because the mock server returns an empty items array for both `header` and `footer` menu endpoints. The nav component renders no items, so the selectors do not appear in the DOM.

**Status: not a regression.** Both selectors were verified with full expected values in Phase 1 (822 PASS). The Phase 2 mock server is a known-limited fixture focused on product/article data.

### 5.2 `.wp-section-title` — PERMANENTLY_UNVERIFIABLE

A codebase grep confirms this class is defined only in `bigbike-web/app/globals.css`:

```css
.wp-section-title {
  font-family: var(--bb-font-display);
  font-size: clamp(24px, 4vw, 35px);
  font-weight: 600;
  text-transform: uppercase;
  ...
}
```

The class is not applied in any `.tsx`, `.jsx`, or `.js` file in the project. The CSS rule exists but is dead code from the WP migration — no React component references it. Providing API data cannot cause it to appear in the DOM.

**Status: PERMANENTLY_UNVERIFIABLE via DOM testing.** The CSS declaration itself is correct per the WP parity spec. A dedicated CSS-source audit (separate from runtime DOM verification) would be required to formally close this gap.

**Recommendation (P1 — separate task):** Either wire `.wp-section-title` to the correct component(s), or confirm the intended replacement class and update the baseline spec.

### 5.3 `.wp-product-name` — NOW VERIFIED ✓

Verified on `/san-pham` (product listing) at all 3 viewports. **12 PASS.**

| Property | Expected | Actual | Status |
|---|---|---|---|
| font-family | contains "Oswald" | `Oswald, "Oswald Fallback", …` | PASS |
| font-size | 16px | 16px | PASS |
| font-weight | 600 | 600 | PASS |
| text-transform | none | none | PASS |

### 5.4 `.wp-product-price b` — NOW VERIFIED ✓

Verified on `/san-pham` at all 3 viewports. **12 PASS.**

| Property | Expected | Actual | Status |
|---|---|---|---|
| font-family | contains "Oswald" | `Oswald, "Oswald Fallback", …` | PASS |
| font-size | 14px | 14px | PASS |
| font-weight | 600 | 600 | PASS |
| color | rgb(255, 12, 9) | rgb(255, 12, 9) | PASS |

### 5.5 `.wp-pdp-related-title` — NOW VERIFIED ✓

Verified on `/product/ls2-koku-kidney-belt` at all 3 viewports. The related products section rendered because 2 other mock products (`agv-k6-helmet`, `ls2-ff800-storm-ii`) share the same `ao-bao-ho-moto` category. **3 PASS.**

| Property | Expected | Actual | Status |
|---|---|---|---|
| font-family | contains "Oswald" | `Oswald, "Oswald Fallback", …` | PASS |

---

## 6. Additional P2 Selector Verification

### 6.1 `.wp-btn-primary` — NOW VERIFIED ✓

Found and verified on 4 routes × 3 viewports = **24 PASS.**

Routes where `.wp-btn-primary` was found:
- `/product/ls2-koku-kidney-belt` — "Thêm vào giỏ hàng" button
- `/tin-tuc` — news listing page CTA
- `/bao-hanh` — warranty form submit button (static, no API required)
- `/gio-hang` — cart page "Xem sản phẩm" link (renders without API data)

| Property | Expected | Actual | Status |
|---|---|---|---|
| font-family | contains "Barlow Condensed" | `"Barlow Condensed", "Barlow Condensed Fallback", …` | PASS |
| text-transform | uppercase | uppercase | PASS |

### 6.2 `.bb-button` — NOW VERIFIED ✓

Found and verified on 4 routes × 3 viewports × 4 properties = **48 PASS.**

Routes where `.bb-button` was found:
- `/tim-kiem` — search empty/results state button
- `/tin-tuc/tai-nghe-bluetooth-5-3-la-gi` — news-detail CTA
- `/lien-he` — ContactForm submit button
- `/dang-nhap` — login submit button

| Property | Expected | Actual | Status |
|---|---|---|---|
| font-family | contains "Barlow Condensed" | `"Barlow Condensed", "Barlow Condensed Fallback", …` | PASS |
| font-size | 16px | 16px | PASS |
| font-weight | 600 | 600 | PASS |
| text-transform | uppercase | uppercase | PASS |

### 6.3 `.wp-page-head h1` — NOW VERIFIED ✓

Found and verified on 2 routes × 3 viewports × 2 properties = **12 PASS.**

Routes where `.wp-page-head h1` was found:
- `/danh-muc-san-pham` — category listing page heading
- `/bao-hanh` — warranty page heading

| Property | Expected | Actual | Status |
|---|---|---|---|
| font-family | contains "Oswald" | `Oswald, "Oswald Fallback", …` | PASS |
| font-weight | 600 | 600 | PASS |

---

## 7. PASS Count by Selector — Phase 2

| Selector | PASS | Routes found |
|---|---|---|
| `body` | 180 | All 12 routes × 3 viewports × 5 props |
| `footer-col-heading` | 108 | All 12 routes × 3 viewports × 3 props |
| `footer-brand-heading` | 72 | All 12 routes × 3 viewports × 2 props |
| `footer-link` | 72 | All 12 routes × 3 viewports × 2 props |
| `breadcrumb` | 48 | 4 routes × 3 viewports × 4 props |
| `button-primary` (`.bb-button`) | 48 | 4 routes × 3 viewports × 4 props |
| `generic-link` | 36 | All routes × 3 viewports × 1 prop |
| `breadcrumb-link` | 24 | 4 routes × 3 viewports × 2 props |
| `wp-btn-primary` | 24 | 4 routes × 3 viewports × 2 props |
| `product-card-name` (`.wp-product-name`) | 12 | `/san-pham` × 3 viewports × 4 props |
| `product-price-current` (`.wp-product-price b`) | 12 | `/san-pham` × 3 viewports × 4 props |
| `page-h1` (`.wp-page-head h1`) | 12 | 2 routes × 3 viewports × 2 props |
| `form-input` | 6 | `/dang-nhap` × 3 viewports × 2 props |
| `pdp-related-title` (`.wp-pdp-related-title`) | 3 | `/product/ls2-koku-kidney-belt` × 3 viewports × 1 prop |
| **TOTAL** | **657** | |

---

## 8. Mismatch Table

**No mismatches.** Zero FAIL entries recorded across all 657 checks.

---

## 9. Cross-Phase Summary

| Selector | Phase 1 status | Phase 2 status | Combined verdict |
|---|---|---|---|
| `body` | PASS | PASS | ✓ VERIFIED |
| `.wp-navigation-item:not(.active) > a` | PASS | MISSING (mock limitation) | ✓ VERIFIED (Phase 1) |
| `.wp-sub-menu-item > a` | PASS | MISSING (mock limitation) | ✓ VERIFIED (Phase 1) |
| `.wp-breadcrumb` | PASS | PASS | ✓ VERIFIED |
| `.wp-breadcrumb a` | PASS | PASS | ✓ VERIFIED |
| `.bb-footer .bb-footer-col h3` | PASS | PASS | ✓ VERIFIED |
| `.bb-footer .bb-footer-brand h2` | PASS | PASS | ✓ VERIFIED |
| `.bb-footer a` | PASS | PASS | ✓ VERIFIED |
| `.bb-input` | PASS | PASS | ✓ VERIFIED |
| `a` (generic link) | PASS | PASS | ✓ VERIFIED |
| `.wp-product-name` | NOT_VERIFIABLE | **PASS** | ✓ NOW VERIFIED |
| `.wp-product-price b` | NOT_VERIFIABLE | **PASS** | ✓ NOW VERIFIED |
| `.wp-pdp-related-title` | NOT_VERIFIABLE | **PASS** | ✓ NOW VERIFIED |
| `.bb-button` | NOT_VERIFIABLE | **PASS** | ✓ NOW VERIFIED |
| `.wp-btn-primary` | NOT_VERIFIABLE | **PASS** | ✓ NOW VERIFIED |
| `.wp-page-head h1` | NOT_VERIFIABLE | **PASS** | ✓ NOW VERIFIED |
| `.wp-section-title` | NOT_VERIFIABLE | MISSING (class not in codebase) | ⚠ PERMANENTLY_UNVERIFIABLE |

---

## 10. Recommendations

### R1 — Resolve `.wp-section-title` dead CSS (P1)

The CSS rule `.wp-section-title { font-family: var(--bb-font-display); … }` exists in `app/globals.css` but no React component applies this class. Two options:

1. **Wire the class:** Identify all section title headings in product listing, homepage, news listing, and category pages; apply `.wp-section-title` in the JSX.
2. **Delete and replace:** If the site uses a different class name for section titles (e.g. `.bb-section-title`), document the correct class, audit its CSS, and update the verification baseline.

No CSS change is needed until the correct class is confirmed — this is a component-to-CSS mapping issue, not a typography failure.

### R2 — Mock server menu items (P2 — low priority)

Update `mock-api-server.mjs` to return realistic navigation menu items if Phase 3 verification needs to cover nav selectors in a mock-only context. Not required since Phase 1 already covers them with real data.

---

## 11. Environment

| Item | Value |
|---|---|
| Playwright | 1.60.0 |
| Browser | Chromium (headless) |
| Next.js build | Production (`next build` → `npm start`) with mock data |
| Mock server | `bigbike-web/scripts/mock-api-server.mjs` (Node.js, port 8080) |
| Mock products | 4 (3 in `ao-bao-ho-moto`, 1 in `tui-dung-xe-may`) |
| CSS chunk | `_next/static/chunks/001rr4q_o9pzd.css` (same as Phase 1) |
| Key CSS tokens | `--bb-text-base: 16px`, `--bb-font-body: Barlow`, `--bb-font-display: Oswald`, `--bb-font-nav: Barlow Condensed` |
