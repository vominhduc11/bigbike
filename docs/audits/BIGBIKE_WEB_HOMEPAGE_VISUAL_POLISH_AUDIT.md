# BigBike Web — Homepage Visual Polish Audit

**Scope:** Visual fidelity of each homepage section in `bigbike-web` vs WordPress reference (`bigbike_vn__2026_04_17`).
**Date:** 2026-05-13
**Read-only:** no code/CSS/contract changes performed in this audit.
**Predecessor:** [BIGBIKE_WEB_HOMEPAGE_SECTION_ORDERING_PARITY_AUDIT.md](BIGBIKE_WEB_HOMEPAGE_SECTION_ORDERING_PARITY_AUDIT.md) — closed the ordering blocker at ~95% parity.

---

## 1. Executive Summary

**Homepage visual parity: ~88%.** Section order is already 100% WP-faithful; visual fidelity per section is high except for one section that consistently runs the dark "premium" theme instead of WP's light gray (Featured 3 Tiles).

### Top 5 visual gaps

| # | Section | Gap | Severity |
|---|---|---|---|
| 1 | Featured 3 Tiles (`.wp-tile-3`) | Dark surface bg + bright price/red CTA, vs WP `#f2f2f2` light gray bg + simple red text CTA. Visually the strongest divergence on the homepage. | **P1** |
| 2 | About section (`.wp-about`) | Adds 3-tile stats row ("Từ 2013 / 100% / Toàn quốc") not present in WP. Visible only when admin About content fallback fires. | P2 |
| 3 | Brand carousel (`.wp-brands-section`) | No outer pt-120/pb-120 spacing pair to match WP `.partner-slide`'s very generous vertical breathing room. | P2 |
| 4 | Video card (`.wp-video-card`) | Thumbnail does not apply WP's red-tint overlay + 0.7 opacity on idle. Visually cleaner than WP but a deliberate departure. | P3 |
| 5 | Hero pagination (`.wp-slider-dots`) | Dots layout differs from WP's "1/5" Oswald text counter under the slide (with bottom border-bottom rule). Modern dot UI vs WP fraction counter. | P3 |

### Verdict

- **No P0 visible regression.** All sections render correctly, semantically match WP, and pass the screenshot QA from previous phases.
- **One P1 worth deciding** (Featured 3 Tiles) — but it is a brand-theme decision, not a bug.
- All other gaps are P2/P3 — small, optional, mostly intentional improvements.

**Recommendation:** Track B (CSS-only minor polish) for items 3, 5, plus a business decision on item 1. Items 2 and 4 are kept as intentional improvements.

---

## 2. Section-by-section Matrix

| # | Section | WP reference (file:line) | Next component | Visual parity % | Gap summary | Recommendation |
|---|---|---|---|---|---|---|
| 1 | Hero swiper | [page-home.php:22-54](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/page-templates/page-home.php), [styles/home.css:1](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/home.css) `#main-banner` | [HeroSlider.tsx](../../bigbike-web/components/home/HeroSlider.tsx) + `.wp-slider` (globals.css:2524+) | 90% | Pagination format differs (WP=fraction counter "1/5" with bottom border, Next=dots). Slide height aspect close. | KEEP — pagination is a UX preference, both are valid. |
| 2 | Featured 3 Tiles | `.category-list .item { height:300px; padding:30px; background:#f2f2f2 }`, Oswald 18px title, red category text, red text CTA | `.wp-tile-3` (globals.css:3482+), `FeaturedProductTile` ([page.tsx:200-256](../../bigbike-web/app/page.tsx#L200)) | 70% | Dark surface bg vs WP `#f2f2f2`; richer fields (brand, rating, stock); CTA is "Xem sản phẩm" button vs WP red text. | **NEEDS_BUSINESS_DECISION** — see F-001. |
| 3 | About | `.about-bigbike` with `.block-title` (sub-title `#cecece`, h3 black) + centered content | `.wp-about` (globals.css:2786+) | 88% | Adds logo mark on left + stats row in fallback mode. Richer than WP. | KEEP_AS_INTENTIONAL_IMPROVEMENT (stats only show when admin About empty). |
| 4 | Product carousel | `.product .product--item` Oswald 1rem title, sale flag with diagonal skew, prev/next at -80px | `FeaturedProductsCarousel.tsx` + `.wp-prod-carousel-wrap`, `WpFeaturedProductCard` (`.wp-fp-*`) | 90% | Sale badge (`.wp-fp-sale`) uses %-discount, WP uses simple "SALE" word. Cart button on hover preserved. | KEEP — both display sale and cart hover; %-discount is a UX improvement. |
| 5 | Category grid | `.product-category-list` col-md-3 grid, simple `<img>` + `<span class="desc">` + chevron arrow icon | `.wp-cat-list` + `.wp-cat-list-item` (globals.css:3734+) | 92% | Next has arrow circle with stroke transition on hover; very close to WP `i.fal.fa-chevron-circle-right`. | KEEP_AS_WP_PARITY. |
| 6 | Promo banner | `.banner-ads` single full-width `<img>` to `images/banner-ads.jpg` inside `.container` | `.wp-promo-banner` (globals.css:2986+) with two variants (image OR text) | 95% | Image variant matches WP exactly when `/wp/banner-ads.jpg` used. Text variant only fires if no image. | KEEP_AS_WP_PARITY. |
| 7 | Experience / Reviews | `.content-carousel` with `-32%` negative top margin overlay effect, opacity 0→1 on active | `.wp-exp-carousel` + `ExperienceCarousel.tsx` (centered, 2.43 slides desktop) | 88% | Different mechanics (Next uses centered viewport with translate3d), same overlay feel and active-only CTA reveal. | KEEP_AS_WP_PARITY — both look like a "spotlight" carousel. |
| 8 | News grid | `.news--item` with shadow `0 3px 6px rgba(0,0,0,.16)`, skewed red date badge | `.wp-news-section--home` + `.wp-news-card` (globals.css:3950+), `.wp-news-date` clip-path skew at globals.css:5593 | 95% | Shadow + skewed red date badge with `clip-path: polygon(0 0, 100% 0, calc(100% - 18px) 100%, 0 100%)` matches WP visually. "XEM TẤT CẢ TIN TỨC" CTA added below grid. | KEEP_AS_WP_PARITY + intentional CTA. |
| 9 | Video carousel | `.videos-slide--inner` bg image, thumb opacity .7 + red overlay, play icon 1.875rem white, desc min-height 104px black bg, Oswald 1.25rem white title | `.wp-video-section` + `HomeVideoCarousel.tsx`, modal-based playback | 85% | Thumb does NOT apply red-tint overlay/0.7 opacity by default (cleaner look). Modal playback is a UX improvement. Desc card black + Oswald title preserved. | KEEP_AS_INTENTIONAL_IMPROVEMENT (modal playback better than inline). |
| 10 | Brand carousel | `.partner-slide.pt-120.pb-120`, items centered, simple swiper | `.wp-brands-section` + `BrandCarousel.tsx`, `.wp-brand-item` (globals.css:4087+) | 88% | Missing the very generous `pt-120/pb-120` vertical padding pair. Renders tighter than WP. | REORDER_FOR_WP_PARITY: minor CSS-only polish — see F-003. |
| 11 | SEO content bottom | `.content-bottom.wyswyg` ACF wyswyg block, plain typography | `.wp-seo-content` (globals.css:4105+) | 95% | Plain typography close to WP. Hardcoded fallback fires only when admin field empty. | KEEP_AS_WP_PARITY. |

**Average:** ≈ 88%.

---

## 3. Detailed Findings

| ID | Severity | Section | Finding | Evidence | Recommendation |
|---|---|---|---|---|---|
| F-001 | **P1** | Featured 3 Tiles | Next `.wp-tile-3` uses `background: var(--bb-bg-surface)` which in the page-level dark theme renders as a dark "premium" surface. WP `.category-list .item { background:#f2f2f2 }` is light gray. Visual feel diverges noticeably — Next looks like a black tactical product card, WP looks like a magazine grid. Next also adds brand label + rating + stock chip + price block, none in WP. | Next: [globals.css:3482-3614](../../bigbike-web/app/globals.css), Next page screenshot `qa-screenshots/d1440--home-top.png` (3 tiles on dark bg). WP: [styles/home.css:1](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/home.css) `.category-list .item { background:#f2f2f2; height:300px; padding:30px }`. | NEEDS_BUSINESS_DECISION: (a) revert to WP light `#f2f2f2` + Oswald 18px title + red text CTA → loses brand/rating/stock chips, OR (b) keep current dark "premium tile" and document as intentional brand evolution. Owner decides. |
| F-002 | P2 | About section | Next `.wp-about` hardcoded fallback includes a 3-tile stats grid ("Từ 2013 · Năm thành lập / 100% · Hàng chính hãng / Toàn quốc · Giao hàng") + a left-side logo mark. WP only had centered sub-title + h3 + plain block-content. | Next: [page.tsx:392-405](../../bigbike-web/app/page.tsx#L392), `.wp-about-stats` (globals.css:2877+). WP: [page-home.php:88-101](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/page-templates/page-home.php#L88) plain text block. | KEEP_AS_INTENTIONAL_IMPROVEMENT — but only the fallback shows stats. When admin sets `about_title/subtitle/content_html`, Next renders matching WP. No fix needed; document fallback is opinionated. |
| F-003 | P2 | Brand carousel | WP `.partner-slide.pt-120.pb-120` uses 120px top + 120px bottom padding for very generous breathing room. Next `.wp-brands-section { padding: var(--bb-space-12) 0 }` (≈ 48-64px) renders tighter. | Next: `.wp-brands-section` (globals.css:4072+). WP: [styles/home.css:1](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/home.css) `.partner-slide.pt-120.pb-120`. | REORDER_FOR_WP_PARITY (CSS-only). Bump `.wp-brands-section { padding: var(--bb-space-24) 0 }` or `padding: 96px 0` to mimic WP's vertical air. Risk: lower density above footer. |
| F-004 | P3 | Video card | WP `.videos-slide--inner-item-thumbnail a` applies `:after` red overlay + 0.7 opacity to the thumb image, with white play icon at 1.875rem centered. Next `.wp-video-thumb` has no idle red overlay; thumb shows full-color image with a small play SVG icon. | Next: `.wp-video-thumb`, `.wp-video-play-icon` (globals.css:6467+, 6491+). WP: [styles/home.css:1](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/home.css) `.videos-slide--inner-item-thumbnail a:after { background:red; opacity:1 }`. | KEEP_AS_INTENTIONAL_IMPROVEMENT — Next thumbnail is more honest about the actual frame. Optional: add `.wp-video-thumb-wrap::after` with `rgba(255,12,9,0.25)` overlay on idle if user wants WP feel. |
| F-005 | P3 | Hero pagination | WP `#main-banner .swiper-pagination` is a `1/5`-style fraction counter in Oswald 1.143rem under the slide, with a bottom border at 1px solid #707070, max-width 370px. Hidden on mobile. Next uses circular dots (`.wp-slider-dot`). | Next: [HeroSlider.tsx:114-125](../../bigbike-web/components/home/HeroSlider.tsx), `.wp-slider-dots` (globals.css:2594+). WP: [styles/home.css:1](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/home.css) `#main-banner .swiper-pagination { max-width:370px; bottom:70px; font-family:Oswald }`. | KEEP — dot indicators are more conventional and accessible (clickable per slide). WP fraction counter is dated. Document as UX modernization. |
| F-006 | P3 | Sale badge on product carousel | WP `.product--item-sale p` is a 70px-wide red rectangle with `42px solid` diagonal flag border-right, white text "SALE" or product label. Next `.wp-fp-sale` shows a `%`-discount number. | Next: [WpFeaturedProductCard.tsx:38-42](../../bigbike-web/components/home/WpFeaturedProductCard.tsx), `.wp-fp-sale` (globals.css:7996+). WP: `.product--item-sale` with diagonal flag. | KEEP_AS_INTENTIONAL_IMPROVEMENT — %-discount is more useful to shoppers than "SALE" label. |
| F-007 | P3 | Product carousel nav buttons | WP `.product-slide .swiper-button-prev` sits at `left:-80px` outside the carousel viewport. Next `.wp-car-btn` is positioned with `left:8px` inside the viewport with circular dark backdrop. | Next: `.wp-car-btn` (globals.css:3446+). WP: `left:-80px` / `right:-80px` font-size 3.125rem. | KEEP — Next nav buttons stay inside, avoid horizontal-scroll glitches on smaller windows. |
| F-008 | P3 | Block titles | WP `.block-title .sub-title` uses Barlow weight 600 color `#cecece` font 1.143rem. Next uses `.wp-kicker` red color with letter-spacing. | Next: `.wp-kicker` (style differs from WP). WP: `.block-title p.sub-title { color:#cecece; font-size:1.143rem }`. | KEEP — Next red kicker is brand-consistent with header active state, ties homepage to nav. |

---

## 4. Intentional Improvements (NOT visual gaps — keep them)

These were added beyond WP and provide real user/SEO/maintainability value. **Do not remove for parity scoring.**

| Item | Why it's intentional |
|---|---|
| 4 × JSON-LD scripts (Organization, WebSite, LocalBusiness, FAQ) | Required for Google rich results. WP had only some of these inline in header.php. |
| `<h1 className="bb-sr-only">` | Provides accessible/SEO h1 on a slider page. WP homepage lacked h1. |
| `HomeAnalytics` (CSR component) | Client telemetry beyond GTM. Zero visible render. |
| Conditional cat-list fallback (Block 5) | Resilience — users still see categories if no `showOnHomepage` products. WP would show nothing. |
| About section stats grid (`.wp-about-stats`) | Only shows when admin About empty. Adds quick credibility signals (Since 2013, Genuine 100%, Nationwide ship). |
| Featured tile rating + stock + brand chip | Modern e-commerce affordances. WP showed only title + price. |
| %-discount sale badge | More actionable than WP "SALE" word. |
| Video modal playback | Better UX than WP inline player. Body scroll lock + focus trap + ESC to close. |
| Sticky header scroll-up reveal (StickyHeaderShell) | Modern interaction; doesn't change visible content order. |
| `wp-news-section--home` "XEM TẤT CẢ TIN TỨC" CTA | Gives users a clear path to blog index. |
| Hero dot indicators (vs WP fraction counter) | Touch-friendly, per-slide jump. |
| ISR `revalidate = 3600` | Performance — Next-only mechanism. |

---

## 5. Fix Plan (only if user wants visible polish)

**Total work if all phases applied: ~2 hours.** None of these are required to ship.

### Phase HVP1 — CSS-only polish (≤ 30 min, P2/P3 only)

| Change | File | Severity | Risk |
|---|---|---|---|
| F-003: bump `.wp-brands-section { padding }` to ≈96-120px top/bottom for WP-style breathing room. | `bigbike-web/app/globals.css:4072` | P2 | Low — purely vertical spacing. Verify with screenshot QA. |
| F-004 (optional): add `.wp-video-thumb-wrap::after` red-tint overlay at `rgba(255,12,9,0.20)` for WP-feel idle state. Wrap in a single rule. | `bigbike-web/app/globals.css` around `.wp-video-thumb-wrap` | P3 | Low — visual only. |
| F-005 (optional): add a `wp-slider-counter` element below `.wp-slider-dots` showing "1/5" Oswald 1.143rem with `border-bottom: 1px solid #707070`. Keep dots as well or replace. | `HeroSlider.tsx` + `globals.css` | P3 | Low if added alongside dots; Medium if replacing dots (loses click-per-slide). |

### Phase HVP2 — Featured 3 Tiles theme decision (F-001, P1, NEEDS_BUSINESS_DECISION)

Two options to choose **before** any code change:

**Option A — Revert to WP light tiles** (~45 min)
- Change `.wp-tile-3 { background: #f2f2f2; color: #000 }`.
- Remove brand chip, rating row, stock chip from `FeaturedProductTile` JSX.
- Restyle CTA from button-on-dark to red text-only with arrow.
- Pros: strict WP parity. Cons: loses commercial affordances admin already filled in product data for.

**Option B — Keep current dark tiles** (0 min)
- Document in this audit (already done) that dark theme + extended fields is intentional brand evolution.
- Pros: zero risk, current data flow preserved. Cons: visual divergence from WP.

**Recommendation: Option B** unless owner explicitly wants WP visual exactness.

### Phase HVP3 — Browser screenshot QA (15 min, only after HVP1/HVP2)

- Run `scripts/qa-screenshot.ts` against `localhost:3000` after every change.
- Compare:
  - `d1440--home-top.png` for hero + featured tiles
  - `d1440--home-bottom.png` for brand carousel + SEO content + scroll button
  - `d1200--home-top.png` and `m375--home-top.png` for responsive behavior
- Track parity score: target 92%+ if HVP1 applied, 95%+ if HVP2 Option A applied.

---

## 6. Final Recommendation

**ADOPT Track B = CSS-only minor polish + business decision on F-001.**

Concrete actions:

1. **Do NOT change code yet.** This audit is read-only.
2. Hand F-001 (Featured Tiles theme) to product owner with both options laid out in §5 Phase HVP2. Default to Option B unless owner says otherwise.
3. If a polish phase is approved:
   - HVP1: apply F-003 brand padding bump (the cheapest win, +1-2% parity, zero risk).
   - HVP1 (optional): apply F-004 video overlay and/or F-005 hero counter.
   - HVP2: only after F-001 decision.
   - HVP3: screenshot QA after every CSS change.
4. **Do not** remove any "Intentional Improvements" from §4 in pursuit of parity scoring — those are positive deviations from WP.

**Net assessment:** Homepage visual polish is in good shape at ~88%. The remaining 12% is mostly one section (Featured 3 Tiles) plus small spacing/typography choices that can stay as-is without harming the user. **No critical fix is required to close the homepage parity workstream.**

---

## Appendix — Files Read

### Next.js
- [`bigbike-web/app/page.tsx`](../../bigbike-web/app/page.tsx)
- [`bigbike-web/components/home/HeroSlider.tsx`](../../bigbike-web/components/home/HeroSlider.tsx)
- [`bigbike-web/components/home/FeaturedProductsCarousel.tsx`](../../bigbike-web/components/home/FeaturedProductsCarousel.tsx)
- [`bigbike-web/components/home/WpFeaturedProductCard.tsx`](../../bigbike-web/components/home/WpFeaturedProductCard.tsx)
- [`bigbike-web/components/home/ExperienceCarousel.tsx`](../../bigbike-web/components/home/ExperienceCarousel.tsx)
- [`bigbike-web/components/home/HomeVideoCarousel.tsx`](../../bigbike-web/components/home/HomeVideoCarousel.tsx)
- [`bigbike-web/components/home/BrandCarousel.tsx`](../../bigbike-web/components/home/BrandCarousel.tsx)
- [`bigbike-web/app/globals.css`](../../bigbike-web/app/globals.css) (key blocks: `.wp-slider`, `.wp-hero-fallback`, `.wp-tile-3`, `.wp-featured-grid-3`, `.wp-about`, `.wp-products-section`, `.wp-cat-list`, `.wp-promo-banner`, `.wp-experience`, `.wp-exp-carousel`, `.wp-news-section`, `.wp-news-card`, `.wp-news-date`, `.wp-video-section`, `.wp-video-card`, `.wp-brands-section`, `.wp-brand-item`, `.wp-seo-content`)
- [`bigbike-web/styles/brand-tokens.css`](../../bigbike-web/styles/brand-tokens.css) (token defaults for `--bb-bg-surface`, etc.)

### WordPress reference
- [`bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/page-templates/page-home.php`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/page-templates/page-home.php)
- [`bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/home.css`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/home.css)
- [`bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/dist/home.css`](../../bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/dist/home.css) (minified production CSS)
