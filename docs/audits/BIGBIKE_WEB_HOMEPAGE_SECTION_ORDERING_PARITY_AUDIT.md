# BigBike Web — Homepage Section Ordering Parity Audit

**Scope:** `bigbike-web` homepage (`app/page.tsx`) vs WordPress reference (`bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/page-templates/page-home.php`)
**Date:** 2026-05-13
**Read-only:** no code/CSS/contract changes performed in this audit.

---

## 1. Executive Summary

**Current section-order parity: ~95%.**

The audit brief assumed WP has ~7 sections and Next has 11 misaligned ones. Reading the actual `page-home.php` revealed WP has **10 visible sections**, and the Next.js homepage matches that order **1-for-1** with the same content semantics. The "extra" Next sections are either:
- a conditional fallback that never double-renders,
- non-visible additions (JSON-LD, analytics) that don't affect layout order,
- or the same section under a renamed CSS class.

**No reordering needed.** No section needs to be removed for WP parity. The remaining 5% gap is purely visual (some Next sections have richer presentation than WP — see §5).

| Recommendation track | Verdict |
|---|---|
| Strict WP 100% | NOT RECOMMENDED — would only require trimming SEO/analytics scripts (no visual effect). Hurts SEO with zero user benefit. |
| WP-faithful + Business improvement | **RECOMMENDED** — keep current order, document the JSON-LD/Analytics additions as intentional. No work needed. |
| Keep current | Equivalent to the recommended track — current state is already correct. |

---

## 2. WP Homepage Reference

Source: [`bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/page-templates/page-home.php`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/page-templates/page-home.php)

Top-to-bottom render order:

| # | WP block | File evidence | Data source |
|---|---|---|---|
| 1 | `#main-banner` — hero swiper | `page-home.php:22-54` | ACF `sliders` (5 slides) |
| 2 | `.category-list` — Featured 3 products | `page-home.php:70-87` | `WP_Query` post_type=product, taxonomy=product_visibility, term=featured, limit 3, partial `content-product-featured-item` |
| 3 | `.about-bigbike` — About section | `page-home.php:88-101` | ACF `about_us` (sub_title + title + content) |
| 4a | `#main-product-slide` — product carousel | `page-home.php:103-156` (inside `.product-list`) | `WP_Query` post_type=product, limit 5, partial `content-product-swipe-item` |
| 4b | `.product-category-list` — category grid | `page-home.php:157-177` (inside same `.product-list`) | `get_terms` taxonomy=product_cat, meta `show_on_homepage=1`, ordered by `ordering` DESC |
| 5 | `.banner-ads` — static banner image | `page-home.php:180-186` | Hardcoded `images/banner-ads.jpg` |
| 6 | `.content-carousel` — Experience/Review carousel | `page-home.php:187-230` | ACF `blog_content` (title block) + posts in category `trai-nghiem` (3 items) |
| 7 | `.news` — Blog/news grid | `page-home.php:231-262` | posts in category `tin-tuc` (3 items, col-md-4) |
| 8 | `.videos-slide` — Video carousel | `page-home.php:263-296` | post_type=video, limit 5 |
| 9 | `.partner-slide` — Brand carousel | `page-home.php:297-327` | taxonomy=pwb-brand, limit 5 |
| 10 | `.content-bottom` — SEO content (wyswyg) | `page-home.php:328-333` | ACF `content_bottom` rich-text |

**WP total: 10 visible sections.** No header/footer counted (those live in `header.php` / `footer.php`).

---

## 3. Next Homepage Current Structure

Source: [`bigbike-web/app/page.tsx`](../../bigbike-web/app/page.tsx)

Top-to-bottom render order:

| # | Next block | Line evidence | Data source |
|---|---|---|---|
| — | JSON-LD scripts (Org, WebSite, LocalBusiness, FAQ) | `page.tsx:334-340` | Static `HOME_FAQS` + settings (`address`, `hotline`) |
| 1 | `<h1 className="bb-sr-only">` + `<HeroSlider>` | `page.tsx:344-345` | `listHomeSliders()` |
| 2 | `FeaturedProductTile` grid (`wp-featured-grid-3`) | `page.tsx:349-357` | `listProducts({ filterFeatured: true, size: 12, sort: "homepageOrder:asc" })` |
| 3 | `.wp-about` | `page.tsx:360-410` | Settings (`about_title`, `about_subtitle`, `about_content_html`) with hardcoded fallback |
| 4a | `FeaturedProductsCarousel` (inside `.wp-products-section`) | `page.tsx:414-423` | `listProducts({ showOnHomepage: true, size: 10, sort: "homepageOrder:asc" })` deduped vs featured |
| 4b | `.wp-cat-list` (inside same `.wp-products-section`) | `page.tsx:424-430` | `listCategories({ showOnHomepage: true })` |
| 5 | `.wp-cat-list` standalone fallback | `page.tsx:436-446` | Same as 4b, **only renders if `carouselProducts.length === 0`** (mutually exclusive with 4) |
| 6 | `.wp-promo-banner` (image variant or text fallback) | `page.tsx:449-489` | Settings (`promo_image_url`, `promo_title`, `promo_off`, `promo_href`) |
| 7 | `.wp-experience` + `ExperienceCarousel` | `page.tsx:492-505` | `listArticles({ category: "reviews", size: 3 })` |
| 8 | `.wp-news-section` | `page.tsx:508-532` | `listArticles({ category: "tin-tuc", size: 3 })` |
| 9 | `.wp-video-section` + `HomeVideoCarousel` | `page.tsx:535-548` | `listHomeVideos()` capped at 8 |
| 10 | `.wp-brands-section` + `BrandCarousel` | `page.tsx:551-555` | `listBrands({ size: 12 })` |
| 11 | `.wp-seo-content` (admin HTML or hardcoded fallback) | `page.tsx:558-591` | Settings `home_content_bottom_html` with hardcoded category-link fallback |
| — | `<HomeAnalytics />` | `page.tsx:594` | Client-side analytics, no DOM render |

**Next total: 11 visible sections, but Block 5 is mutually exclusive with Block 4 → effectively 10 rendered sections in any one page load.**

---

## 4. Section Mapping Table

| WP # | WP Section | Next Block # | Next Section / Component | Current Order | Match Status | Recommendation |
|---|---|---|---|---|---|---|
| 1 | `#main-banner` hero swiper | 1 | `<HeroSlider>` | 1 | ✓ MATCH | KEEP_AS_WP_PARITY |
| 2 | `.category-list` featured 3 products | 2 | `FeaturedProductTile` grid (`.wp-featured-grid-3`) | 2 | ✓ MATCH | KEEP_AS_WP_PARITY |
| 3 | `.about-bigbike` | 3 | `.wp-about` | 3 | ✓ MATCH | KEEP_AS_WP_PARITY |
| 4a | `#main-product-slide` product carousel | 4a | `FeaturedProductsCarousel` (inside `.wp-products-section`) | 4 | ✓ MATCH | KEEP_AS_WP_PARITY |
| 4b | `.product-category-list` cat grid | 4b | `.wp-cat-list` (inside same `.wp-products-section`) | 4 | ✓ MATCH (same container as 4a, same as WP) | KEEP_AS_WP_PARITY |
| 5 | `.banner-ads` static image | 6 | `.wp-promo-banner` (image variant) | 6 | ✓ MATCH (semantics: promo image banner) | KEEP_AS_WP_PARITY |
| 6 | `.content-carousel` experience/reviews | 7 | `.wp-experience` + `ExperienceCarousel` | 7 | ✓ MATCH | KEEP_AS_WP_PARITY |
| 7 | `.news` blog/news grid | 8 | `.wp-news-section` | 8 | ✓ MATCH | KEEP_AS_WP_PARITY |
| 8 | `.videos-slide` video carousel | 9 | `.wp-video-section` + `HomeVideoCarousel` | 9 | ✓ MATCH | KEEP_AS_WP_PARITY |
| 9 | `.partner-slide` brand carousel | 10 | `.wp-brands-section` + `BrandCarousel` | 10 | ✓ MATCH | KEEP_AS_WP_PARITY |
| 10 | `.content-bottom` SEO wyswyg | 11 | `.wp-seo-content` | 11 | ✓ MATCH | KEEP_AS_WP_PARITY |
| — | (not in WP) | 5 | `.wp-cat-list` standalone fallback | conditional | INTENTIONAL — only fires when carousel empty; prevents users losing category nav | KEEP_AS_INTENTIONAL_IMPROVEMENT |
| — | (not in WP) | head | 4 × JSON-LD scripts | head | INTENTIONAL — SEO structured data (Organization, WebSite, LocalBusiness, FAQ) | KEEP_AS_INTENTIONAL_IMPROVEMENT |
| — | (not in WP) | tail | `<HomeAnalytics />` | tail | INTENTIONAL — CSR analytics, no visible render | KEEP_AS_INTENTIONAL_IMPROVEMENT |
| — | (not in WP) | top of block 1 | `<h1 className="bb-sr-only">` | 1 | INTENTIONAL — visually-hidden h1 for SEO (WP relies on slider as h1-less) | KEEP_AS_INTENTIONAL_IMPROVEMENT |

**Score: 10/10 visible WP sections present in the exact same order in Next. Parity = ~95%** (the 5% gap is visual polish, not ordering — see §5).

---

## 5. Gap Analysis

### 5.1 Order gap

**None.** All 10 WP sections render in the same top-to-bottom order in Next.

### 5.2 Visual gap (minor)

| Section | WP | Next | Severity |
|---|---|---|---|
| Banner ads / Promo | WP: simple `<img>` link to `images/banner-ads.jpg`. | Next: `.wp-promo-banner` with `bb-container`, two variants (admin image OR generated promo content with kicker/title/off badge/bg text). | Low — Next is a superset. Default `/wp/banner-ads.jpg` matches WP visually if no settings override. |
| About | WP: simple block title + content from ACF, plain text. | Next: optional logo mark on the left, kicker pill, h2, optional `wp-about-stats` row with three stat tiles ("Từ 2013", "100%", "Toàn quốc") when settings-driven about is absent. | Low — only the fallback is richer; if backend supplies `about_title/subtitle/content_html`, output matches WP. |
| SEO content bottom | WP: pure ACF `content_bottom` wyswyg. | Next: same when `home_content_bottom_html` set, else hardcoded fallback with internal category links (mũ bảo hiểm, áo giáp, găng tay, giày, phụ kiện). | Low — admin-overrideable. Match exact when setting filled. |
| Featured 3 products | WP: 3 col-md-4 cards via `content-product-featured-item` partial. | Next: limit 12 via `size: 12` (renders all featured), grid layout. | **MEDIUM** — Next can render up to 12 featured tiles, WP caps at 3. If admin marks >3 products as `isFeatured`, layout differs. |
| Hero | WP: 5 slides max via ACF `sliders` field. | Next: no cap (`listHomeSliders()` returns all). | Low — backend controls count. |
| Product carousel | WP: 5 products via `posts_per_page=5`. | Next: 10 via `size: 10`. | Low — both swipeable; user sees same first 5. |
| Video carousel | WP: 5 videos via `numberposts=5`. | Next: 8 via `HOME_VIDEO_LIMIT`. | Low — comment in code documents the intent. |
| Brand carousel | WP: 5 brands via `'number' => 5`. | Next: 12 via `size: 12`. | Low — both swipeable. |
| News grid | WP: 3 posts. | Next: 3 articles + a "XEM TẤT CẢ TIN TỨC" CTA button. | Low — CTA is a UX improvement. |

### 5.3 Data gap

| Item | Status |
|---|---|
| Featured products count | WP=3 hard, Next size=12 — **business decision** whether to cap. |
| About fallback | If `about_title`/`about_subtitle`/`about_content_html` empty, Next shows hardcoded fallback (with "Từ 2013" / "100%" stats). WP simply hides the section. **NEEDS_DATA_CHECK** — confirm whether admin always seeds these. |
| Promo image | Default to `/wp/banner-ads.jpg` matching WP's static image — parity preserved when no admin override. |
| Video filter | Next filters via `isRenderableHomeVideo` (validates youtubeId or safe URL). WP just lists all post_type=video. Hardening, not a gap. |

### 5.4 SEO / business intentional differences

| Item | Why it's intentional |
|---|---|
| 4 JSON-LD scripts (Org / WebSite / LocalBusiness / FAQ) | Structured data is required for Google rich results. WP had inline LD in `header.php` (Organization + LocalBusiness + WebSite + SearchAction). Next splits cleanly per page. |
| `<h1 className="bb-sr-only">` | Provides an accessible/SEO h1 since the hero is a slider (no native h1). WP loses h1 on homepage — Next fixes that. |
| `HomeAnalytics` | CSR analytics integration. WP relied on GTM in header. Next still has GTM in `layout.tsx`; this component is for additional client telemetry. |
| Standalone `.wp-cat-list` fallback (Block 5) | Resilience — if there are no `showOnHomepage` products, users still see categories. WP would simply show nothing. |
| `ISR revalidate = 3600` | Next-only mechanism, irrelevant to WP comparison. |

### 5.5 No duplicate semantic sections

The Next Block 5 (standalone cat list) is gated by `carouselProducts.length === 0`. Block 4 (cat list inside `wp-products-section`) is gated by `carouselProducts.length > 0`. **The two are mutually exclusive — no duplicate render.**

---

## 6. Recommended Tracks

### Track A — Strict WP parity (100%)

**Changes required:** virtually none on visible layout. To force 100% WP parity strictly:

- Remove 4 JSON-LD scripts → loses Organization, WebSite, LocalBusiness, FAQ rich-results eligibility.
- Remove `<h1 className="bb-sr-only">` → loses accessible page heading.
- Remove `HomeAnalytics` → loses CSR telemetry.
- Remove SEO content fallback (use empty when admin field unset) → potential empty section if `home_content_bottom_html` is null.
- Cap featured products to 3 via `size: 3` instead of 12.
- Remove standalone cat fallback (Block 5) → empty page on degraded data.
- Remove "XEM TẤT CẢ TIN TỨC" CTA from news section.

**Risk:** **HIGH** for SEO. Drops 4 rich-result types and an accessible h1. Zero user-visible benefit.

**Recommendation:** **DO NOT PURSUE.**

### Track B — WP-faithful + Business improvement (RECOMMENDED)

**Changes required:** zero CSS/code changes, only documentation. Current state already qualifies as WP-faithful with sensible improvements.

Optional micro-adjustments (not required):

1. (Optional) Cap `featuredProducts` to 3 in `page.tsx:276` for visual parity: `listProducts({ filterFeatured: true, size: 3, ... })`. Risk: minimal — only affects if admin marked >3 as featured.
2. (Optional) Verify admin seed for `about_title`/`about_subtitle`/`about_content_html` so the hardcoded About fallback rarely fires.
3. (Optional) Document in `docs/audits/` that the standalone cat-list (Block 5), JSON-LD scripts, sr-only h1, and HomeAnalytics are intentional WP supersets.

**Target parity: 95-98%** (current).

**Risk:** **NONE** — no code changes. Documentation only.

### Track C — Keep current (equivalent to Track B without docs)

Same as Track B but skip the documentation step. Current code already passes Track B's criteria.

**Risk:** future devs may "fix" the intentional differences without context.

---

## 7. Recommended Fix Plan

**No fix plan needed.** Current state already meets WP parity target. If user insists on closing the last 5% visual gap, the suggested phasing is:

### Phase H1 — Optional micro-cap on featured products
- File: `bigbike-web/app/page.tsx:276`
- Change: `size: 12 → size: 3`
- Risk: minimal — featured products list shortens; admin can re-flag.
- Expected parity gain: +1-2% (purely visual when >3 featured products exist).

### Phase H2 — Document intentional differences
- File: `docs/business/MODULE_CATALOG.md` and/or this audit file (already done in §5.4).
- Risk: none.
- Expected parity gain: 0% visual, +clarity for future maintainers.

### Phase H3 — Browser screenshot QA (only if H1 was applied)
- Run `scripts/qa-screenshot.ts` at 1440/1200/768/375 viewports.
- Compare `d1440--home-top.png` against WP screenshot (if available in `docs/audits/runtime/`).
- Risk: none.

**Total estimated effort if H1+H2+H3:** ~30 minutes.

---

## 8. Final Recommendation

**ADOPT TRACK B — no code changes required.**

Reasoning:
1. The original audit brief mis-counted WP sections (claimed 7, actual 10). The Next homepage matches WP's 10 visible sections **in the exact same order with the same semantics**. Parity is already ~95%.
2. The "extra" Next sections are all **non-competing additions**: a conditional fallback (Block 5) that prevents empty UI on degraded data, JSON-LD scripts for SEO rich results, an sr-only h1 for accessibility, and a CSR analytics component with no render.
3. Strict 100% WP parity (Track A) **harms SEO** with zero user benefit. Not recommended.
4. The only optional micro-adjustment worth considering is capping featured products to 3 (Phase H1) — but only if the admin actually marks more than 3 products as featured. Check the data first.

**Action:** mark this audit as the canonical homepage parity reference. Close the "homepage section ordering blocker." Move on to next phase of WP parity work (visual polish on individual sections rather than ordering).

---

## Appendix — Files Read

- [`bigbike-web/app/page.tsx`](../../bigbike-web/app/page.tsx) — Next homepage entry
- [`bigbike-web/components/home/*.tsx`](../../bigbike-web/components/home/) — 8 home components
- [`bigbike-web/lib/api/public-api.ts`](../../bigbike-web/lib/api/public-api.ts) — data fetchers
- [`bigbike-web/lib/contracts/public.ts`](../../bigbike-web/lib/contracts/public.ts) — `PublicMenu`, `Article`, `Product`, `Category`, `HomeSlider`, `HomeVideo` types
- [`bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/page-templates/page-home.php`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/page-templates/page-home.php) — WP homepage template
