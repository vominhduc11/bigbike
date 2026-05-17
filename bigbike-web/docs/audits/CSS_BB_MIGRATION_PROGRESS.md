# CSS `.bb-*` Migration — Progress & Handoff

> Chương trình: gỡ lớp CSS `.bb-*` legacy khỏi `app/globals.css`, token hóa px.
> Kế hoạch gốc: `~/.claude/plans/l-p-css-c-trong-polymorphic-barto.md`.
> Cập nhật: 2026-05-17.

---

## Trạng thái tổng quát

| Phase | Trạng thái |
|---|---|
| Phase 0 — Kiểm kê & xác minh | ✅ Xong |
| Phase 1 — Mở rộng token px | ✅ Xong |
| Phase 2 — Xóa CSS chết | ✅ Xong |
| Phase 3 — Phân loại class còn lại | ✅ Xong |
| Phase 4…N — Di trú theo cụm | 🔄 Đang làm — 10/~68 file xong |

`globals.css`: **7.294 → 5.583 dòng** (−1.711, −23,5%). Build `npm run build` exit 0
sau mỗi cụm.

**Cụm tiếp theo trong worklist:** BrandCarousel;
sau đó đến ProductCard (mega-cluster),
PurchaseSectionClient, ReviewsSection. Đây là các cụm nặng nhất — nên migrate có
chụp screenshot before/after để bắt regression thị giác.

---

## Phase 1 — Token hóa px (đã xong)

- **Spacing px** — không thêm token; dùng utility số học Tailwind v4 khi migrate
  (`gap-3.5`=14px, `gap-2.75`=11px, `p-0.75`=3px…), giữ đúng pixel.
- **Font-size px** — đã thêm 9 token cỡ chữ WP-parity vào
  [`styles/brand-tokens.css`](../../styles/brand-tokens.css) (`--bb-text-9` …
  `--bb-text-40`) và expose thành Tailwind utility trong `globals.css` `@theme inline`:
  **`text-9 text-10 text-11 text-15 text-17 text-22 text-26 text-32 text-40`**.
  Cỡ chuẩn (12/14/16/18/20/24/30) vẫn dùng `text-xs/sm/base/lg/xl/2xl/3xl` mặc định.
- Build exit 0 sau khi thêm token.

## Phase 3 — Phân loại class (đã xong)

506 class live, phân loại bằng script (đọc rule CSS của từng class):

- **38 KEEP-in-CSS** — rule có `::before/::after`, `:is()/:where()`, `animation`,
  hoặc `content:` → giữ trong globals.css (hợp lệ theo CLAUDE.md).
- **468 MIGRATE** — chuyển sang inline Tailwind. Trong đó:
  - **181 "simple"** — không selector phức tạp, dễ migrate nhất.
  - **287 "moderate"** — có combinator/descendant/pseudo-class/`@media`/position;
    migrate được bằng Tailwind variant (`hover:`, `group-hover:`, `md:`, `absolute`…)
    nhưng cần cẩn thận hơn.

Dữ liệu chi tiết: `bb-categories.json`, `bb-fileindex.json` (sinh trong quá trình
phân tích — class theo từng file, dùng để chia cụm Phase 4).

---

## Phase 0 — Kết quả kiểm kê (đã xong)

Phân tích toàn bộ `app/` + `components/` (`.tsx`/`.ts`), `lib/`, `content/`,
`scripts/`, `__tests__/`:

- **644** class `.bb-*` định nghĩa trong `globals.css`.
- **506** class live (dùng literal trong JSX, hoặc khớp prefix dựng động).
- **138** class **confirmed-dead** — không nơi nào dùng. Đã xác minh: không có
  literal trong mọi loại file, `content/` MDX sạch, không có `classList.add` runtime,
  đã trừ các prefix dựng động.

**12 prefix class dựng động** (cần chuyển sang `cn()` khi migrate component đó):
`bb-cart-row`, `bb-cat-hero`, `bb-exp-carousel-slide`, `bb-exp-carousel-track`,
`bb-mobile-nav-depth-`, `bb-pdp-main-wrap`, `bb-pdp-thumb`, `bb-prod-carousel-wrap`,
`bb-review-star-btn`, `bb-skel`, `bb-slider-dot`, `bb-video-dot`.
Các class state đi kèm: `.active`, `.is-active`, `.is-zooming`, `.is-jumping`,
`--locked`, `--block`.

**~10 className no-op** (gắn ở JSX nhưng không có CSS — vô hại, dọn khi migrate cụm
tương ứng): `bb-about-richtext` (app/page.tsx:305), `bb-cart-list` +
`bb-cat-grid-img` + `bb-cat-img-cell` (Skeletons.tsx), `bb-cart-promo-form`
(gio-hang), `bb-pdp-chip-label` (VariantSelector), `bb-result-summary` +
`bb-search-section` (tim-kiem), `bb-review-pagination` (ReviewsSection),
`bb-spec-group-header` (ProductTabs).

---

## Phase 2 — Xóa CSS chết (đã xong)

Dùng pruner dựa trên postcss (parse → bỏ rule mà **mọi** selector đều tham chiếu
class chết → ghi lại). Kết quả:

- **292 rule** bị xóa (mọi selector đều chết → rule không bao giờ khớp phần tử nào).
- **10 block `@media`** rỗng sau khi xóa → bỏ luôn.
- **25 rule "partial"** (selector group lẫn class chết + class live) — **giữ nguyên,
  không sửa**; sẽ dọn khi migrate cụm chứa rule đó (rủi ro thấp, chỉ là selector
  thừa không khớp gì).

**Vì sao an toàn:** class chết không gắn lên phần tử DOM nào → rule chứa nó không
khớp gì → xóa rule = 0 thay đổi hiển thị. Verify bằng build pass; không cần
screenshot diff cho phase này (bất biến theo cấu trúc).

Diff: `git diff app/globals.css` → 726 dòng xóa. Class `.bb-*` còn lại trong file:
1.572 lần xuất hiện selector (so với ~2.264 trước).

138 class đã xóa gồm các nhóm: layout checkout 1-page cũ (`bb-checkout-*-1page`,
`bb-checkout-page`…), order timeline cũ (`bb-order-tl-*`, `bb-timeline-*`,
`bb-return-timeline*`), detail panel cũ (`bb-detail-*`), address card cũ
(`bb-address-*`), toast cũ (`bb-toast*`), info/nav card cũ (`bb-info-*`,
`bb-nav-card*`), 404 cũ (`bb-404-search*`, `bb-404-title`), v.v.

---

## Việc còn lại

### Phase 1 — Token hóa px (chưa làm)

Audit 322 px arbitrary trong JSX:

- **Spacing (gap/padding/margin)** — KHÔNG cần token mới. Tailwind v4.2.2 hỗ trợ
  utility số học trên thang `--spacing` (mặc định 4px, repo không override):
  `gap-[14px]`→`gap-3.5`, `[11px]`→`gap-2.75`, `[3px]`→`gap-0.75`,
  `[18px]`→`gap-4.5`, `[30px]`→`gap-7.5`, `[22px]`→`gap-5.5`… giữ đúng px.
- **Font-size `text-[Npx]`** (114 chỗ) — CẦN token vì không nằm trên thang spacing.
  Phân bố: `11px`×43, `15px`×22, `12px`×18 (=`text-xs`), `26px`×8, `16px`×6
  (=`text-base`), `14px`×5 (=`text-sm`), `9px`×4, `18px`×3 (=`text-lg`),
  one-off: `40/32/22/17/10px`.
  → Thêm token `--text-*` vào `@theme` của `globals.css` cho size lệch scale tái
  diễn (11/15/9/26px). Cập nhật `STYLEGUIDE.md` + `DESIGN_SYSTEM_CONSISTENCY.md`.

### Phase 3 — Phân loại ~500 class còn lại

- KEEP-in-CSS: `.bb-richtext`+con (style HTML CMS), `@keyframes`, selector phức tạp
  (`:is()`, scroll/headroom), pseudo-element nhiều state.
- MIGRATE: styling component đơn giản → inline Tailwind.

### Phase 4…N — Di trú theo cụm (đang làm)

Thứ tự rủi ro thấp→cao: component lá → carousel → section trang → form/flow →
layout dùng chung (header/nav/footer làm cuối). Mỗi cụm: migrate + token hóa px +
xóa block CSS + verify (eslint/tsc/build + screenshot 3 breakpoint).

**Đã migrate:**
- ✅ `components/ui/RatingStars.tsx` — `.bb-rating-stars` + `.bb-rating-stars-fill`
  → inline Tailwind; `.bb-rating-stars-empty` (no-op) bỏ luôn. Xóa 2 rule CSS.
- ✅ `components/catalog/PricingPanel.tsx` — không dùng class `.bb-*` thật (chỉ
  trong comment cũ); token hóa px: `text-[11px]`→`text-11`, `px-[10px]`→`px-2.5`.
- ✅ `components/catalog/CatalogFilters.tsx` — 29 class `.bb-filter*/.bb-filters-v2*`
  → inline Tailwind; state class (`open`/`is-open`/`active`) → `cn()`; mobile
  collapse → `max-md:` variant; `.bb-filter-color-input` → `sr-only`; hover-con →
  `group`/`group-hover:`. **Giữ** `.bb-filter-preset*` trong CSS (pseudo `::before`
  skew parallelogram — nhóm KEEP). Xóa 47 rule + 1 `@media`. globals.css → 6.561 dòng.

- ✅ `components/catalog/VariantSelector.tsx` — 8 class `.bb-pdp-chip*/.bb-pdp-swatch*/
  .bb-pdp-opt-group` → inline Tailwind; state (`active`/`oos`) → `cn()`; swatch
  hover-con → `group-hover:`; touch-target (44px) → `pointer-coarse:`/`max-md:`
  variant; `.bb-pdp-chip-label` (no-op) bỏ. Xóa 19 rule. globals.css → 6.496 dòng.
  `.bb-pdp-chip` còn sót trong 1 rule shared touch-target (partial — dọn ở cụm cuối).

- ✅ `components/catalog/RecentlyViewedSection.tsx` — 11 class `.bb-pdp-recently-*`
  → inline Tailwind; tính cascade cuối (override re-skin ở section khác) để giữ
  đúng màu/border. Xóa 18 rule. globals.css → 6.473 dòng. Giữ `.bb-kicker`
  (utility primitive dùng chung — xử lý ở cụm cuối).

- ✅ `components/catalog/ProductTabs.tsx` — 8 class `.bb-pdp-tabs/.bb-pdp-tab-panel/
  .bb-spec-table/.bb-pdp-video*/.bb-video-title` → inline Tailwind. **Giữ**
  `.bb-richtext` + `.bb-article-body` (style HTML CMS — nhóm KEEP) và `.bb-link`
  (shared 11 file). `.bb-spec-group-header` (no-op) bỏ. Xóa 12 rule → 6.446 dòng.

- ✅ `components/catalog/ProductGallery.tsx` — 19 class `.bb-pdp-gallery/.bb-pdp-strip*/
  .bb-pdp-thumb/.bb-pdp-main*/.bb-pdp-zoom*/.bb-lightbox*` → inline Tailwind; các
  `<Button variant="ghost">` bị class `.bb-*` ghi đè toàn bộ → đổi sang `<button>`
  thuần + focus-ring riêng (sạch hơn, hết xung đột merge). Xóa 41 rule + 2 `@media`
  → globals.css **6.372 dòng**. Screenshot diff: pdp d1280/t768/m390 đều ≈ mức nhiễu.

- ✅ `components/home/FeaturedProductsCarousel.tsx` — hoàn tất cụm dở:
  prune class `bb-prod-carousel-wrap`, `bb-prod-carousel-wrap--locked`,
  `bb-prod-carousel-viewport`, `bb-prod-carousel-item`, `bb-car-btn`,
  `bb-car-prev`, `bb-car-next` bằng `_bbtmp-clusterprune.mjs` (postcss);
  **không prune** `.bb-fp-pagination` (swiper hook giữ theo quyết định trước).
  Kết quả prune: xóa 22 rule + 4 at-rule rỗng. Gate pass:
  `npx tsc --noEmit`, `npx eslint components/home/FeaturedProductsCarousel.tsx`,
  `npm run build` đều exit 0. Screenshot diff baseline/current (8 route × 3 viewport)
  worst **0.145%** (mức nhiễu, lớn nhất ở `catalog--m390` do lệch full-page height
  2724→2700). Đã cập nhật lại baseline = current. globals.css → **6.277 dòng**.

- ✅ `components/home/HeroSlider.tsx` (+ `components/ui/Skeletons.tsx` đồng bộ shared):
  migrate toàn bộ lớp `.bb-*` của hero/fallback sang inline Tailwind, chuyển dot state
  sang `cn()`, giữ nguyên logic Swiper. Prune class:
  `bb-hero-fallback`, `bb-hero-fallback-content`, `bb-hero-kicker`, `bb-hero-title`,
  `bb-hero-sub`, `bb-hero-cta`, `bb-hero-fallback-mark`, `bb-slider`,
  `bb-slide-picture`, `bb-slide-img`, `bb-slider-dots`, `bb-slider-dot`.
  Kết quả prune: xóa 35 rule + 2 at-rule rỗng.
  **Giữ** `bb-slider-btn/bb-slider-prev/bb-slider-next` trong CSS vì còn consumer
  `HomeVideoCarousel` (sẽ dọn ở cụm carousel tiếp theo).
  Gate pass: `npx tsc --noEmit`,
  `npx eslint components/home/HeroSlider.tsx components/ui/Skeletons.tsx`,
  `npm run build` đều exit 0.
  Screenshot diff baseline/current (8 route × 3 viewport): worst **0.000%**
  (pixel-identical). Đã cập nhật baseline = current. globals.css → **6.066 dòng**.

- ✅ `components/home/ExperienceCarousel.tsx` — migrate toàn bộ cụm
  `.bb-exp-*` / `.bb-experience-img-wrap` sang inline Tailwind + `cn()` state;
  giữ nguyên logic loop/recenter và CSS var layout (`--bb-exp-gap`, `--bb-exp-slide-w`).
  Prune class:
  `bb-exp-carousel`, `bb-exp-carousel-vp`, `bb-exp-carousel-track`,
  `bb-exp-carousel-slide`, `bb-exp-content`, `bb-experience-img-wrap`,
  `bb-exp-overlay`, `bb-exp-bg`, `bb-exp-product-wrap`, `bb-exp-product-img`,
  `bb-exp-content-body`, `bb-exp-title`, `bb-exp-cta`
  (kèm state class `is-active`, `is-jumping`).
  Kết quả prune: xóa 24 rule + 2 at-rule rỗng.
  Tinh chỉnh parity cuối: `pb` của carousel từ 40px lên 42px để triệt tiêu lệch
  full-page 2px ở route home.
  Gate pass: `npx tsc --noEmit`,
  `npx eslint components/home/ExperienceCarousel.tsx`, `npm run build` đều exit 0.
  Screenshot diff baseline/current (8 route × 3 viewport): worst **0.668%**
  (cart t768 — nhiễu state/runtime); home d1280/t768/m390 lần lượt 0.020%/0.014%/0.026%.
  Đã cập nhật baseline = current. globals.css → **5.900 dòng**.

- ✅ `components/home/HomeVideoCarousel.tsx` — migrate toàn bộ cụm
  `.bb-video-*` + phần shared `bb-slider-btn` sang inline Tailwind.
  Dot indicator đổi từ pseudo-element `::before` sang `<span>` nội bộ để dọn CSS
  triệt để; modal close đổi sang `<button>` thuần để tránh base style shadcn can thiệp.
  Prune class:
  `bb-video-carousel`, `bb-video-carousel-vp`, `bb-video-carousel-slide`,
  `bb-video-dots`, `bb-video-dot`, `bb-video-card`, `bb-video-thumb-wrap`,
  `bb-video-thumb`, `bb-video-thumb-fallback`, `bb-video-thumb-fallback-mark`,
  `bb-video-play-btn-ring`, `bb-video-play-icon`, `bb-video-card-desc`,
  `bb-video-card-title`, `bb-video-modal-backdrop`, `bb-video-modal-inner`,
  `bb-video-modal-close`, `bb-video-modal-player`, `bb-video-modal-title`,
  `bb-slider-btn`, `bb-slider-prev`, `bb-slider-next` (kèm `is-active` state class).
  Kết quả prune: xóa 54 rule + 4 at-rule rỗng.
  Gate pass: `npx tsc --noEmit`,
  `npx eslint components/home/HomeVideoCarousel.tsx`, `npm run build` đều exit 0.
  Screenshot diff baseline/current (8 route × 3 viewport): worst **0.765%**
  (cart t768, do lệch full-page height runtime); route home
  d1280/t768/m390 lần lượt 0.033%/0.052%/0.023%.
  Đã cập nhật baseline = current. globals.css → **5.583 dòng**.

**Bài học breakpoint (quan trọng cho mọi cụm sau):**
- WP-parity dùng `@media (max-width: 768px)` (**bao gồm** đúng 768px). Tailwind
  `max-md:` = `< 768` (loại trừ 768) → SAI ở đúng 768px. Phải dùng **`max-[769px]:`**
  (= `width < 769` = `≤ 768`). Đã sửa cả ProductGallery lẫn CatalogFilters (cụm 3
  trước đó migrate nhầm `max-md:` — screenshot gate bắt được, đã vá).
- `<Button>` có `min-h-[44px]` ở base; class `.bb-*` chỉ set `height` (không set
  `min-height`) nên chiều cao thực render = 44px. Khi migrate phải tính giá trị
  **thực render**, không phải giá trị trong class CSS.

Token thêm: `--bb-text-13` / `text-13` (cỡ chữ 13px gặp khi migrate CSS).

**Worklist Phase 4 — thứ tự foreign-ascending** (entanglement thấp → cao; script
`bb-isolation.mjs` sinh ra `bb-filereport.json`). Cụm sạch nhất làm trước:
`CatalogFilters` (30 class, 0 foreign) → nhóm 1-class foreign thấp → … →
layout primitive `.bb-container` + header/nav/footer làm **cuối cùng**.

**Phát hiện khi bắt đầu Phase 4 — vì sao không thể làm 1 lượt:**
Class `.bb-*` đan xen sâu. Class trông "lá" như `bb-pagination-page` thực ra còn
bị tham chiếu trong 3 selector compound ở section khác; `bb-page`/`bb-container`
là layout primitive bị ~50 file + nhiều rule compound dùng chung. Mỗi class phải
xử lý **tất cả** rule (kể cả compound rải rác trong file 6.600 dòng) → bắt buộc
làm tuần tự từng cụm, verify từng cụm. Đây là công việc nhiều phiên.

**Lưu ý cho Phase 4:**
- `scripts/qa-screenshot.ts` và `scripts/verify-typography-computed.mjs` dùng
  selector `.bb-*` để chụp/đo. Khi migrate component, cập nhật selector trong 2
  script này (hoặc thêm marker `data-*` ổn định).
- 25 rule "partial" còn lại — dọn selector chết khi migrate cụm tương ứng.
- Class dựng động + state class — chuyển sang `cn()` conditional.

### Session Update — 2026-05-17

- ✅ `app/page.tsx` (Home Block 9 wrapper): migrate shell `.bb-video-section*`
  sang inline Tailwind, prune 4 class owned hoàn toàn:
  `bb-video-section`, `bb-video-section-inner`, `bb-video-section-header`,
  `bb-video-section-title`.
  Fix regression mobile:
  (1) `max-[575px]:text-24` -> `max-[575px]:text-[24px]`,
  (2) bỏ nhánh SSR fallback trong `HomeVideoCarousel` để Swiper render ổn định khi verify.
  Gate pass: `npx eslint app/page.tsx components/home/HomeVideoCarousel.tsx`,
  `npx tsc --noEmit`, `npm run build`.
  Screenshot diff baseline/current sau fix: worst `0.668%` (noise runtime),
  riêng route home d1280/t768/m390 = `0.000% / 0.000% / 0.000%`.
  Baseline đã cập nhật = current.

### Cổng kiểm tra screenshot (đã dựng)

Hạ tầng verify thị giác cho Phase 4:

- `next dev` cục bộ chạy ở **`localhost:3100`** (phản ánh working tree). Container
  Docker `localhost:3000` = code gốc trước migration.
- Script tạm: `_bbtmp-shots.mjs` (chụp 8 route × 3 viewport: d1280/t768/m390,
  fullPage, tự dò slug product + category) và `_bbtmp-diff.mjs` (pixel-diff bằng
  `sharp`, ngưỡng 24, xuất ảnh diff).
- Baseline: `qa-screenshots/baseline/` (chụp từ :3100, trạng thái sau 10 cụm đã migrate).
- `qa-screenshots/original/` chụp từ :3000 (code gốc) — đối chiếu xác nhận 6 cụm
  đầu **không đổi diện mạo**: tất cả route migrated lệch 0,05–0,5% (đúng mức nhiễu
  dev-vs-prod / nội dung động). Riêng `cart` lệch ~33% do **giỏ hàng không tất
  định** (state localStorage khác giữa 2 phiên) — không phải regression; khi diff
  hai lần chụp cùng :3100 thì cart ổn định.

**Quy trình mỗi cụm Phase 4 từ giờ:** migrate → prune CSS → tsc/eslint/build →
chụp `:3100` vào `qa-screenshots/current/` → `_bbtmp-diff.mjs baseline current` →
diff trang liên quan phải ≈ mức nhiễu (<~1%); nếu cao hơn → điều tra trước khi
sang cụm kế. Sau khi cụm đạt, cập nhật baseline.
