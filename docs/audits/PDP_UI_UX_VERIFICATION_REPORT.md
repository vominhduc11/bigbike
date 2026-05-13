# PDP UI/UX Verification Report

> Verification-only phase. No code changes. All findings backed by code/data/runtime evidence.

## Scope

### Routes checked
- `/product/ls2-koku-kidney-belt`
- `/product/tui-chong-nuoc-ilm-bl01`

### Files inspected
- `bigbike-web/app/product/[slug]/page.tsx`
- `bigbike-web/components/catalog/PurchaseSectionClient.tsx`
- `bigbike-web/components/catalog/ProductGallery.tsx`
- `bigbike-web/components/catalog/ProductTabs.tsx`
- `bigbike-web/components/catalog/ReviewsSection.tsx`
- `bigbike-web/components/catalog/RecentlyViewedSection.tsx`
- `bigbike-web/components/layout/SiteFooter.tsx`
- `bigbike-web/app/globals.css`
- `bigbike-web/lib/utils/html.ts`
- `bigbike-web/lib/utils/format.ts`
- `bigbike-web/lib/api/public-api.ts`
- `bigbike-web/lib/contracts/public.ts`
- `bigbike-web/app/api/products/[id]/reviews/route.ts` (Next.js route, glob only)

### Runtime / data checks
- Backend `localhost:8080` queried directly:
  - `GET /api/v1/products/ls2-koku-kidney-belt`
  - `GET /api/v1/products/tui-chong-nuoc-ilm-bl01`
  - `GET /api/v1/menus/footer`
- Frontend dev server `localhost:3000` checked:
  - `GET /product/ls2-koku-kidney-belt` → rendered HTML inspected for strings
  - `GET /product/tui-chong-nuoc-ilm-bl01` → rendered HTML inspected for strings
  - `GET /api/products/{id}/reviews/?page=1&size=10` for both products
- User-provided screenshots:
  - `docs/screenshots/product-details/01-localhost-3000-product-ls2-koku-kidney-belt.png`
  - `docs/screenshots/product-details/02-localhost-3000-product-tui-chong-nuoc-ilm-bl01.png`

### Viewports
- CSS reviewed for desktop / tablet / mobile (no actual browser resize test in this phase). Screenshots from user appear at desktop ~1440px.

---

## Executive Summary

| Code | Severity | Status |
|---|---|---|
| PDP-DESC-EMPTY | P2 | Not reproduced on current data (logic gap remains) |
| PDP-REVIEW-RATING-CONFLICT | **P0** | Confirmed |
| PDP-UNCATEGORIZED-PUBLIC | **P0** | Confirmed (LS2 KOKU only) |
| PDP-RECENTLY-VIEWED-LOW-COUNT | P1 | Confirmed |
| PDP-FOOTER-INTERNAL-HEADING | **P0** | Confirmed |
| PDP-TRUST-BADGE-POLISH | P2 | Not a defect (polish observation) |
| PDP-SHARE-POLISH | P2 | Confirmed (visual minor) |
| PDP-BELOW-FOLD-SPACING | P1 | Partially reproduced — coupled with PDP-DESC-EMPTY |

**Confirmed real issues: 5** (3 P0, 1 P1 fully + 1 P1 coupled, 1 P2 visual)
**Not reproduced on current state: 1** (logic gap still worth fixing)
**Polish-only: 1**

**Production-readiness: NOT READY.** The 3 P0s (fake 5.0 rating, "Chưa phân loại" leak, English internal heading "FOOTER NAVIGATION") are public-facing trust hits. Two are 1-line code fixes; one is a data fix in admin.

---

## Findings

### [P0] PDP-REVIEW-RATING-CONFLICT — Rating shown with no reviews

**Status:** Confirmed

**Evidence:**
- Backend data: both products return `rating=5.0` and `ratingCount=null` from `/api/v1/products/{slug}`.
- Reviews Next route returns `{avgRating:0, totalReviews:0, reviews:[]}` for both:
  - `GET /api/products/wp-prod-36698/reviews/?page=1&size=10` → `0 / 0 / []`
  - `GET /api/products/wp-prod-39558/reviews/?page=1&size=10` → `0 / 0 / []`
- Code:
  - `bigbike-web/app/product/[slug]/page.tsx:195` → `initialRating={product.rating ?? null}` (passed to header)
  - `bigbike-web/app/product/[slug]/page.tsx:221` → `initialRating={product.rating ?? null}` (passed to ReviewsSection)
  - `bigbike-web/components/catalog/PurchaseSectionClient.tsx:239` → header shows stars iff `initialRating && initialRating > 0` (no count check)
  - `bigbike-web/components/catalog/ReviewsSection.tsx:274` → `const rating = firstPage?.avgRating || initialRating || 0` (falls back to seeded 5.0 when avgRating=0)
  - `bigbike-web/components/catalog/ReviewsSection.tsx:303-311` → shows rating summary when `rating > 0`
  - `bigbike-web/components/catalog/ReviewsSection.tsx:341` → shows "Chưa có đánh giá chi tiết" when `firstPage && !reviews.length && rating > 0`
- Screenshot evidence: both screenshots show `5.0 ★★★★★` in header AND "Chưa có đánh giá chi tiết" below — the contradiction is visible on the live page.

**Root cause:**
1. Backend denormalizes a placeholder `rating=5.0` while `ratingCount` is null and there are zero approved reviews. The cache is populated from an unknown seed/import default.
2. Frontend trusts `initialRating` alone — it never gates the star display on a non-zero count.
3. `ReviewsSection`'s `||` fallback makes the bogus rating "sticky" even after fresh fetch returns avgRating=0.

**Impact:** HIGH. Customer sees "5.0 sao" while the same page admits "Chưa có đánh giá chi tiết" — looks fake or broken, harms trust. Affects every product imported with default rating.

**Recommended fix:**
1. Backend (preferred): never denormalize `rating > 0` when `ratingCount` is null/0. Set both fields together or null/0 both.
2. Frontend safety net:
   - Header: require `initialRating > 0 && (initialRatingCount ?? 0) > 0` in `PurchaseSectionClient.tsx:239`.
   - `ReviewsSection.tsx:274`: gate rating on `firstPage?.totalReviews > 0` (use `firstPage?.totalReviews ? firstPage.avgRating : 0`, drop `initialRating` fallback for the score).
3. Remove "Chưa có đánh giá chi tiết" empty-state when there are 0 reviews — the missing form already implies that.

**Risk if fixed:** Low. Pure display-rule change. Products with real reviews unaffected.

---

### [P0] PDP-UNCATEGORIZED-PUBLIC — "Chưa phân loại" leaked to public UI

**Status:** Confirmed (LS2 KOKU KIDNEY BELT only; ILM BL01 has a valid category)

**Evidence:**
- Backend: LS2 product returns `category: {slug:"chua-phan-loai", name:"Chưa phân loại"}`.
- Rendered HTML at `localhost:3000/product/ls2-koku-kidney-belt` contains the literal string `Chưa phân loại`.
- Code surfaces it in **at least four public locations**:
  1. Breadcrumb — `app/product/[slug]/page.tsx:160-166`: renders `<Link>{product.category.name}</Link>` whenever both name and slug exist (no normalization).
  2. Brand · category info line — `components/catalog/PurchaseSectionClient.tsx:232-234`: `{brandName}{categoryName ? \` · ${categoryName}\` : ""}` → "LS2 · Chưa phân loại" (CSS uppercases it → "LS2 · CHƯA PHÂN LOẠI").
  3. Related-products kicker — `app/product/[slug]/page.tsx:230-231`: `DANH MỤC {product.category?.name?.toUpperCase()}` → "DANH MỤC CHƯA PHÂN LOẠI".
  4. JSON-LD breadcrumb (`buildBreadcrumbJsonLd`) — SEO leak: search engines index "Chưa phân loại" as a category step.
- Recently-viewed: `app/product/[slug]/page.tsx:257` passes raw `categoryName: product.category?.name` to localStorage → leaks to "VỪA XEM" cards across the site.
- Screenshot 1 (LS2): breadcrumb visibly contains "Chưa phân loại".

**Root cause:** Backend serves a placeholder category for un-classified imported products; presentation layer makes no attempt to filter or normalize.

**Impact:** HIGH. Visible on every page that surfaces LS2 KOKU (PDP, recently-viewed, JSON-LD/SEO). Reads as "broken admin data" to customers. Likely affects other un-classified imports.

**Recommended fix (two-track):**
1. **Data fix (correct long-term):** in admin, assign LS2 KOKU to a real category (e.g. "Đai bảo vệ lưng / Kidney belt") and run the same audit query for any other product still pinned to `chua-phan-loai`.
2. **Presentation safety net (independent):** treat slug `chua-phan-loai` as "no category" in the rendering layer:
   - Breadcrumb: skip the category link, fall back to `/san-pham/` "Sản phẩm".
   - Brand · category line: omit the `· {categoryName}` segment.
   - Related kicker: use generic "SẢN PHẨM" instead of category name.
   - RecentlyViewed save: pass `null` for categoryName when slug is `chua-phan-loai`.
   - JSON-LD: skip the category breadcrumb item.

**Risk if fixed:** Low for the safety-net (purely display). Data fix needs admin to confirm the right destination category — flag in fix phase.

---

### [P0] PDP-FOOTER-INTERNAL-HEADING — Footer column shows "Footer Navigation"

**Status:** Confirmed

**Evidence:**
- Backend `GET /api/v1/menus/footer` returns `name: "Footer Navigation"`.
- `bigbike-web/components/layout/SiteFooter.tsx:194` → `<h3>{footerMenuResult.data?.name || "Menu"}</h3>` outputs the raw menu name verbatim.
- `bigbike-web/app/globals.css:146-151` → `.bb-footer-col h3 { text-transform: uppercase }` → final visible label is **"FOOTER NAVIGATION"**.
- Rendered HTML at both PDP URLs contains the literal "Footer Navigation".
- Both user screenshots clearly show the column heading "FOOTER NAVIGATION".

**Root cause:** Menu admin entity uses a single `name` field treated as both internal identifier and public display label. SiteFooter assumes that name is publication-ready.

**Impact:** HIGH. English internal label on every page of a Vietnamese e-commerce site. Visible immediately above the policy links column. Looks unfinished / un-localized.

**Recommended fix (pick one, ranked):**
1. **Fastest (data only):** rename the menu in admin to e.g. "Liên kết nhanh" or "Chính sách & Hỗ trợ" — instant fix, no deploy.
2. **Code override:** swap line `SiteFooter.tsx:194` to a hard-coded heading (matches the other 3 columns which are already hard-coded: "Danh mục", "Hướng dẫn", "Thông tin").
3. **Schema fix (best long-term):** backend Menu entity gains a separate `displayName` field; SiteFooter prefers `displayName ?? name`.

**Risk if fixed:** Trivial. Option 1 is non-code, easy revert. Option 2 makes the column heading static like its peers (acceptable; menu items are still dynamic).

---

### [P1] PDP-RECENTLY-VIEWED-LOW-COUNT — Section renders with 1 item

**Status:** Confirmed

**Evidence:**
- `bigbike-web/components/catalog/RecentlyViewedSection.tsx:32` → only `items.length === 0` returns null; renders for any positive count.
- `bigbike-web/app/globals.css:4334` → `.wp-pdp-recently-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 14px; }` — `auto-fill` (not `auto-fit`) creates many empty 140px tracks at desktop width; the single card sits at the left while the rest of the row is empty whitespace.
- Screenshot 2 (ILM BL01) shows a single LS2 card on the left and ~70% empty horizontal space.

**Root cause:** No minimum-items threshold, and the grid uses `auto-fill` which preserves empty columns rather than centering/stretching the one card.

**Impact:** MEDIUM. Looks like a broken/half-loaded section. Particularly visible on landing on the second product the user views (first product → no section; second → 1 card alone).

**Recommended fix:**
- Primary: hide the section when `items.length < 2` (change line 32 to `if (items.length < 2)`).
- Alternative if marketing wants to keep at 1: swap grid to `auto-fit` AND limit max-width per card so 1 card centers/stretches sensibly. Less recommended — single card looks lonely either way.

**Risk if fixed:** Tiny — slight reduction in "recently viewed" impressions but only in the rare 1-item case. No analytics impact since `saveRecentProduct` still runs at line 26 (storage continues to fill).

---

### [P1] PDP-BELOW-FOLD-SPACING — Tall empty space below "MÔ TẢ SẢN PHẨM"

**Status:** Partially reproduced — coupled with `PDP-DESC-EMPTY`

**Evidence:**
- Screenshot 1 (LS2): tab panel below the active "MÔ TẢ SẢN PHẨM" tab is a tall empty white box for the LS2 page.
- Screenshot 2 (ILM): tab panel shows just 2 stray bullet markers and lots of empty space.
- BUT current rendered HTML at `localhost:3000` for both URLs contains the full description ("Premium materials", "breathable mesh", "Đặc điểm nổi bật", "Dung tích", etc., grepped from rendered HTML). API returns `description` length 1679 (LS2) and 1237 (ILM).
- CSS checks — no `min-height` on `.wp-pdp-tab-panel` or `.wp-pdp-below`:
  - `globals.css:4783` → `.wp-pdp-tab-panel { padding: 28px 0 32px; }` (only padding)
  - `globals.css:4325` → `.wp-pdp-below { max-width: 1440px; margin: 48px auto 0; padding: 40px 24px 0; border-top: 1px solid var(--bb-border-subtle); }` (no min-height)
  - `.bb-richtext` uses `display: grid; gap: var(--bb-space-3)` → empty paragraphs would still allocate rows + gaps, creating vertical whitespace.

**Root cause:** Screenshots predate the current description content (likely captured before/during V93 blog import on 2026-05-11; today is 2026-05-13). With current data, the empty space disappears.
**Latent risk:** the same screenshot would re-appear for any product whose `description` is only whitespace-wrapped HTML (e.g. `<p>&nbsp;</p>`, `<p></p>`), because `Boolean(description?.trim())` in `ProductTabs.tsx:33` treats the HTML string as truthy.

**Impact:** Currently LOW (screenshots stale). Becomes MEDIUM if any product ships with HTML-only-whitespace description.

**Recommended fix:** see `PDP-DESC-EMPTY` — strip tags before the truthy check. CSS itself does not need changes.

**Risk if fixed:** None.

---

### [P2] PDP-DESC-EMPTY — Description tab logic gap

**Status:** Not reproduced on current data; **logic gap remains** and is the root cause of the screenshot's empty box.

**Evidence:**
- API: both products currently have substantial description (LS2: 1679 chars, ILM: 1237 chars). Content includes `<h3>`, `<p>`, `<strong>`, `<br>`.
- Rendered HTML at `localhost:3000` confirms text strings present (`Premium materials`, `Ergonomic`, `Đặc điểm`, `Dung tích`, etc.).
- Sanitizer (`lib/utils/html.ts:1-4`) returns `"<p>Noi dung dang cap nhat.</p>"` ONLY when `rawHtml` is null/empty string. It does **not** detect HTML strings that contain markup but no visible text (`<p>&nbsp;</p>`, `<p></p>`, `<br>`).
- `ProductTabs.tsx:33` → `const hasDescription = Boolean(description?.trim())` — `trim()` on a non-empty HTML string is truthy; the tab + panel render even with no readable text.
- No `<p>&nbsp;</p>` style HTML observed on either product right now.

**Root cause:** `hasDescription` checks string-presence, not text-content. Sanitizer fallback only triggers on null/empty.

**Impact:** Currently LOW — but the screenshots are evidence this state existed (and probably will again for other imported products with placeholder HTML).

**Recommended fix:**
- Add a text-content check: in `ProductTabs.tsx:33`, derive `const hasDescription = stripHtmlText(description).length > 0` where `stripHtmlText` removes tags + collapses `&nbsp;` + trims. Cheaper alternative: `description?.replace(/<[^>]+>/g, "").replace(/&nbsp;|\s+/g, " ").trim().length > 0`.
- Keep the sanitizer's null-fallback for visual safety in case the check is bypassed.

**Risk if fixed:** Low. Don't over-strip — descriptions with images/iframes/videos but no text should still display. So the check should ALSO consider presence of `<img|iframe|video`. (Specs/videos tabs already handle those separately, so a description that is "only an image" is an edge case worth confirming with content team.)

---

### [P2] PDP-SHARE-POLISH — Share buttons (visual)

**Status:** Confirmed minor

**Evidence:**
- `PurchaseSectionClient.tsx:373-413` — three share buttons: Facebook (`icon + "Facebook"`), Zalo (`icon + "Zalo"`), X/Twitter (`icon + "X"`).
- Screenshots confirm the layout: red Facebook button "Facebook", blue Zalo button "Zalo", black X button with just "X".
- CSS `globals.css:5779-5783` — `.wp-article-share-btn { display: inline-flex; padding: 7px 14px; ... }`.
- Single-character "X" label next to icon reads odd against the longer labels and against the Twitter brand context.

**Root cause:** Twitter → X rebrand resulted in 1-character text label. The icon and text duplicate the same brand letter.

**Impact:** LOW. No functional issue; cosmetic only.

**Recommended fix (pick one):**
- Drop the visible text on the X button (icon-only), keep `aria-label="Chia sẻ trên X (Twitter)"`.
- Or rename to "Tweet" for consistency.

**Risk if fixed:** None.

---

### [P2] PDP-TRUST-BADGE-POLISH — No defect

**Status:** Not a defect (polish observation only)

**Evidence:**
- `PurchaseSectionClient.tsx:362-369` — 4-item trust list (`FEATURES`).
- `globals.css:4765-4767` — `.wp-pdp-features { grid-template-columns: repeat(auto-fit, minmax(min(160px, 100%), 1fr)); gap: 10px; padding: 14px 16px; ... }`.
- Grid auto-fits and reflows cleanly; min track size is `min(160px, 100%)` so on <360px screens each item takes a full row.
- Screenshots show two-column layout at desktop, items align cleanly.

**Recommendation:** No fix required.

---

## Fix Plan Proposal

### Phase 1 — Data & rendering correctness (P0)
1. **PDP-REVIEW-RATING-CONFLICT**
   - Backend: stop seeding `rating=5.0` for products with no approved reviews (or null-out for the 167 imported products now).
   - Frontend safety net: gate stars on `initialRatingCount > 0` (header) and on `firstPage.totalReviews > 0` (ReviewsSection). Remove the "Chưa có đánh giá chi tiết" message when total is 0.
2. **PDP-UNCATEGORIZED-PUBLIC**
   - Admin data: re-categorize LS2 KOKU; sweep DB for any other product on `chua-phan-loai`.
   - Frontend safety net (independent): treat slug `chua-phan-loai` as "no category" in breadcrumb, brand info, related-products kicker, JSON-LD, and recently-viewed save.
3. **PDP-FOOTER-INTERNAL-HEADING**
   - Quick win: rename admin footer menu to a Vietnamese label, OR hard-code the heading in `SiteFooter.tsx:194` to match its peers ("Danh mục" / "Hướng dẫn" / "Thông tin").

### Phase 2 — Layout (P1)
4. **PDP-RECENTLY-VIEWED-LOW-COUNT** — hide section when `items.length < 2`.
5. **PDP-BELOW-FOLD-SPACING** — fixed implicitly by Phase 3 / DESC-EMPTY.

### Phase 3 — Polish (P2)
6. **PDP-DESC-EMPTY** — text-content check before rendering description tab; keep image/iframe special-case.
7. **PDP-SHARE-POLISH** — X button: icon-only or "Tweet" label.

---

## Test Plan For Fix Phase

After each fix:
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- Browser smoke test (desktop 1440 / tablet 768 / mobile 390) on:
  - `/product/ls2-koku-kidney-belt`
  - `/product/tui-chong-nuoc-ilm-bl01`
  - One product **with** reviews (regression for ratings)
  - One product with valid category (regression for breadcrumb)
- Playwright/screenshot regression covering: gallery, variant select, add-to-cart, quick-buy, reviews tab, tabs switch, footer presence.
- Cross-page check after PDP-UNCATEGORIZED-PUBLIC fix: category listing pages, search results, home blocks — wherever `category.name` flows through.

---

## Open Questions / Risks

1. **Backend rating seed source.** Where does `rating=5.0` come from on import? V93 import script, manual seed, or DB default? Need to know before nulling existing values (otherwise next import re-introduces them).
2. **LS2 KOKU's correct category.** "Chưa phân loại" suggests admin never picked one. Suggest "Đai bảo vệ lưng / Kidney belt" but needs business confirmation.
3. **Description "only-image" edge case.** Fix for PDP-DESC-EMPTY must not hide tabs whose description has images/videos but no plain text.
4. **Screenshots possibly stale.** The empty description box in screenshot 1 cannot be reproduced against current data — both screenshots may have been taken between V93 import (2026-05-11) and description re-import. If user captured at a different moment, some findings (DESC-EMPTY, BELOW-FOLD-SPACING) will read as historical. The logic gaps remain real regardless.
