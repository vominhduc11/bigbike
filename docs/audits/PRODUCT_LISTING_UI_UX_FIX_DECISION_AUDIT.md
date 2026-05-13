# PRODUCT LISTING UI/UX — Fix Decision Audit

**Trang audit:** `bigbike-web/app/san-pham/page.tsx`
**Ngày audit:** 2026-05-13
**Auditor:** Claude (Opus 4.7) — codebase BigBike Next.js 16.2.4 / React 19.2 / Tailwind v4
**Evidence base:**
- Code: 8 file `.tsx` + 2 file CSS (`globals.css` 9587 dòng, `brand-tokens.css` 709 dòng)
- Spec: `bigbike-web/STYLEGUIDE.md` (canonical design rules, cập nhật 2026-05-12)
- Dev server thật: `http://localhost:3000/san-pham/` (200 OK)
- Screenshots Playwright: 10 file tại `docs/screenshots/product-listing/audit/`
- Đo lường JSON: `docs/screenshots/product-listing/audit/metrics.json`, `metrics-edge.json`
- Typecheck: `npx tsc --noEmit -p tsconfig.json` → **pass, không có lỗi**

> **Ngữ cảnh data**: trên môi trường dev hiện tại backend chỉ có **2 sản phẩm** (`tui-chong-nuoc-ilm-bl01`, `ls2-koku-kidney-belt`). Nhiều vấn đề trông tệ vì data ít, nhưng hệ quả layout (filter dài hơn grid ~7x) là **CSS-induced**, không chỉ data-induced — sẽ ghi rõ trong từng item.

---

## 0. Tóm tắt điều hành

| Issue | Status |
|---|---|
| 1. Sidebar filter quá dài | **TRUE** (CSS, không chỉ data) |
| 2. Product grid trống khi ít sản phẩm | **PARTIAL** (data + CSS) |
| 3. Product card thiếu visual boundary | **TRUE** (CSS bug, vi phạm STYLEGUIDE) |
| 4. Typography trong filter quá nhỏ/dày | **PARTIAL** (theo design system, không phải bug) |
| 5. Toolbar count + sort chưa nổi bật | **TRUE** |
| 6. Add-to-cart phụ thuộc hover trên touch | **FALSE** (đã có fallback) |
| 7. Hero polish hơn catalog | **TRUE** |
| 8. Floating chat che CTA | **PARTIAL** (chỉ mobile khi filter mở) |
| 9. Responsive mobile/tablet | **TRUE** (mobile vẫn 2 cột do CSS conflict) |
| 10. WP parity chứ chưa tối ưu conversion | **TRUE** |

**Verdict tổng:** **6 TRUE / 3 PARTIAL / 1 FALSE.**
**Có nên fix:** **YES** — nhưng theo phase, không big-bang.
**Priority cao nhất:** Issue #3 (card border) và #9 (mobile grid CSS conflict) vì vi phạm STYLEGUIDE/spec.

---

## 1. Sidebar filter quá dài

**Status:** **TRUE**

**Evidence:**
- Đo lường thực tế desktop 1440px (no filter, 2 sản phẩm):
  - `.wp-filters-v2` height = **2924.4 px**
  - `.wp-product-grid` height = **436.3 px**
  - Layout height = **2972.4 px** (filter chiếm ~98%)
  - Doc height = **4026 px**
  - Nguồn: `docs/screenshots/product-listing/audit/metrics.json`
- Desktop 1440px (active filter, 1 sản phẩm): filter **2965 px** vs grid **436 px** (`metrics-edge.json`).
- Tablet 1024px: filter **2955 px** vs grid **485 px**.
- CSS gốc: [bigbike-web/app/globals.css:4503](bigbike-web/app/globals.css#L4503) (`.wp-filters-v2 { position: sticky; ... padding-right: 28px; border-right: ... }`)
- Filter sections render trong [bigbike-web/components/catalog/CatalogFilters.tsx:189-366](bigbike-web/components/catalog/CatalogFilters.tsx#L189-L366): luôn render full danh sách categories + brands. Brand search input chỉ filter UI nhưng không giới hạn DOM (`brands.length > 6 && ...` chỉ là conditional cho search box, không phải scroll container).
- Trong screenshot tham chiếu `docs/screenshots/product-listing/product-listing-full-desktop.png`: phần "Thương hiệu" liệt kê ~60+ brand entries.

**Tại sao filter cao**:
1. **Brands list không có max-height + overflow** — render tất cả brands trực tiếp. Code: [CatalogFilters.tsx:241-251](bigbike-web/components/catalog/CatalogFilters.tsx#L241-L251).
2. **Categories radio list cũng không scroll** — [CatalogFilters.tsx:204-214](bigbike-web/components/catalog/CatalogFilters.tsx#L204-L214).
3. Filter sticky (`position: sticky; top: calc(var(--bb-header-height) + 34px + 16px)`) tại [globals.css:4503](bigbike-web/app/globals.css#L4503) **chỉ có ý nghĩa khi filter ngắn hơn viewport**; với 2924px nó vô tác dụng (sticky không có gì để stick).

**Impact:**
- **UX**: user phải scroll nhiều khi danh mục/brand dài; sticky không hoạt động → mất context khi xem product cuối.
- **Conversion**: page height bị filter kéo dài làm cảm giác "ít sản phẩm hơn" — bias tiêu cực.
- **SEO**: không ảnh hưởng (DOM vẫn ổn).
- **Maintainability**: thiếu chuẩn hoá max-height + scroll → khi brand seed lên 200 mục sẽ tệ hơn.

**Fix recommendation:**
- **Nên fix:** YES.
- **Priority:** P1.
- **Effort:** S (1–2h CSS).
- **Risk:** Thấp — chỉ thêm `max-height` + `overflow-y: auto` cho brand/category lists, không đụng business logic.
- **Approach gợi ý:** `.wp-filter-section-body` chứa list dài → bọc thêm `max-height: 320px; overflow-y: auto;` khi `n > 12`. Đồng thời giữ search input cho brands.

---

## 2. Product grid bên phải quá trống khi ít sản phẩm

**Status:** **PARTIAL**

**Evidence:**
- Grid height 436px khi 2 cards, vs layout 2972px. (`metrics.json`)
- Screenshot `desktop-1440.png` và `product-listing-full-desktop.png` đều show whitespace lớn bên phải.
- Số cột grid thật: **3 cột ở ≥1024px** (do override [globals.css:8841-8845](bigbike-web/app/globals.css#L8841-L8845) thắng line 4287 vì xuất hiện sau trong cascade). 2 sản phẩm chia 3 cột → cột thứ 3 trống.
- Card width = 285px (đo được trên grid 904px khi active filter, 1 card).

**Vì sao PARTIAL**:
- Phần "trống" chính là do **chỉ có 2 sản phẩm trong seed data** (bigbike đang dev, backend chưa import full catalog). Đây không phải UI bug.
- Tuy nhiên việc **filter dài 7x grid** (issue #1) khuếch đại cảm giác trống. Nếu fix issue #1, screen sẽ cân hơn ngay cả với 2 sản phẩm.

**Impact:**
- UX: cảm giác kho hàng nghèo nàn — ảnh hưởng trust signal.
- Có thể giảm nhẹ bằng cách: (a) tăng card width (3 cột thay vì 4 ở wide desktop), (b) thêm "khối filler" như feature highlight / brand spotlight / banner khi ít sản phẩm.

**Fix recommendation:**
- **Nên fix:** PARTIAL — không cần làm gì với layout grid (3 cột hợp lý cho ảnh vuông 1:1). Fix bằng cách giải quyết issue #1 + thêm empty-state-friendly content khi page có ≤4 items (optional).
- **Priority:** P3.
- **Effort:** S.
- **Risk:** Thấp.

---

## 3. Product card thiếu visual boundary

**Status:** **TRUE** — **VI PHẠM STYLEGUIDE**

**Evidence:**
- **STYLEGUIDE.md** [STYLEGUIDE.md:107-115](bigbike-web/STYLEGUIDE.md#L107-L115):
  > **Product Cards**
  > - Nền trắng, chữ đen, **padding 20px**, **border `1px solid #DDDDDD`**, radius `0`.
  > - Ảnh vuông 1:1, full width.
  > - Title: Oswald **18/600/20**.
  > - Hover: **border đỏ, shadow `0 4px 12px rgba(255,12,9,0.1)`**.
- **Thực tế hiện tại** (đo bằng `getComputedStyle`):
  - `.wp-product-card` border = `"0px solid rgb(221, 221, 221)"` — border-color đã set #DDDDDD nhưng **border-width = 0**. (`metrics-edge.json` mọi case)
  - `.wp-product-card` background = `rgb(255, 255, 255)` ✓
  - Padding card: theo [globals.css:8881](bigbike-web/app/globals.css#L8881) là `16px 0 0` (chỉ top), KHÔNG phải 20px như spec.
  - Title font-size = 16px (theo [globals.css:8906](bigbike-web/app/globals.css#L8906)) → **vi phạm spec yêu cầu 18px**.
- CSS culprit:
  - [globals.css:4288](bigbike-web/app/globals.css#L4288): `.wp-product-card { background:...; overflow:hidden; ... }` — **không khai báo border**.
  - [globals.css:8335-8370](bigbike-web/app/globals.css#L8335-L8370): rule áp dụng `border-color: var(--bb-border-subtle)` cho `.wp-product-card` nhưng không kèm `border-width` → border không xuất hiện.
  - Bản hover [globals.css:8372-8383](bigbike-web/app/globals.css#L8372-L8383): chỉ change `border-color` + `box-shadow`, vẫn không có `border-width`.
- So sánh: **`.wp-fp-item` (Featured Product card)** đã đúng spec — [globals.css:8973-8977](bigbike-web/app/globals.css#L8973-L8977): `padding: 20px; border: 1px solid #dddddd;`. Tức là 2 dạng product card không nhất quán nhau.

**Impact:**
- **UX**: card "trôi" trên nền trắng, không có ranh giới — user khó scan, hover effect cũng yếu (chỉ có shadow vì border-width=0 nên border-color đổi vô nghĩa).
- **Brand consistency**: vi phạm STYLEGUIDE → CLAUDE.md Docs-First Contract section "Khi docs mâu thuẫn code → docs là source of truth".
- **Conversion**: thiếu visual hierarchy → tỷ lệ click vào card thấp hơn so với cards có border rõ.

**Fix recommendation:**
- **Nên fix:** YES — **bắt buộc theo STYLEGUIDE**.
- **Priority:** **P0**.
- **Effort:** XS (10 phút CSS).
- **Risk:** Rất thấp — chỉ thêm `border: 1px solid #ddd; padding: 20px;` cho `.wp-product-card`, kèm bump `.wp-product-name` lên 18px.
- **Caveat:** Phải verify hover border-color đổi sang `var(--bb-brand-primary)` (đã có ở [globals.css:8372-8383](bigbike-web/app/globals.css#L8372-L8383) — chỉ cần thêm width).

---

## 4. Typography trong filter quá nhỏ/dày, khó scan

**Status:** **PARTIAL**

**Evidence:**
- `.wp-filter-section-header` font-size = **11px** uppercase, letter-spacing 0.1em. [globals.css:4518](bigbike-web/app/globals.css#L4518)
- `.wp-filter-row` (option text) = **12px**. [globals.css:4532](bigbike-web/app/globals.css#L4532)
- `.wp-filter-search` placeholder = 12px.
- `.wp-filter-price-label` = **10px** uppercase.
- `.wp-filter-color-name` = **9px** uppercase.
- STYLEGUIDE [STYLEGUIDE.md:86](bigbike-web/STYLEGUIDE.md#L86): "Meta / badge | Barlow | 12px | 700 | 12px". 10–12px là vùng meta được spec cho phép, nhưng 9px (color name) **dưới spec**.
- WCAG 2.5: text nhỏ hơn 12px gây khó đọc cho người ≥40 tuổi, đặc biệt ALL CAPS letter-spacing 0.1em (giảm legibility).

**Impact:**
- **UX accessibility**: filter scannability kém — nhất là với 60+ brand entries (issue #1).
- **Vi phạm STYLEGUIDE** ở color-name 9px.

**Fix recommendation:**
- **Nên fix:** PARTIAL — bump 11px → 12px cho section-header, 9px → 10px cho color-name. Không cần phá design system.
- **Priority:** P3.
- **Effort:** XS.
- **Risk:** Rất thấp.

---

## 5. Toolbar catalog (count + sort) chưa nổi bật

**Status:** **TRUE**

**Evidence:**
- `.wp-catalog-head` ở [globals.css:4617-4621](bigbike-web/app/globals.css#L4617-L4621): chỉ là flex-row 18px margin-bottom, **không có background**, không có border, không sticky.
- Count text **14px** secondary color, sort native browser `<select>` 14px (đo được: `countFontSize: "14px"`, `sortFontSize: "14px"`).
- Sort dropdown render dạng native select [CatalogSortSelect.tsx:25-37](bigbike-web/components/catalog/CatalogSortSelect.tsx#L25-L37) — không match design system (sharp radius nhưng default browser styling).
- Hiện không có view-toggle (grid/list) hay items-per-page selector, không có "Áp dụng lại filter" CTA — thiếu functional density.
- Screenshot tham chiếu: toolbar nhỏ, nằm ở góc, dễ bị bỏ qua.

**Impact:**
- **Conversion**: sort là tín hiệu quan trọng trong e-commerce; user mong muốn so sánh giá / mới nhất nhanh.
- Hero rất nổi bật ngay trên → toolbar 14px tụt hậu về visual weight.

**Fix recommendation:**
- **Nên fix:** YES.
- **Priority:** P2.
- **Effort:** S–M (2–4h: làm CatalogSortSelect dạng custom dropdown, thêm border-bottom toolbar, có thể thêm sticky `top` khi user scroll).
- **Risk:** Thấp.

---

## 6. Add-to-cart / chọn biến thể phụ thuộc hover (rủi ro touch)

**Status:** **FALSE** — đã có fallback đúng.

**Evidence:**
- CSS [globals.css:8966-8971](bigbike-web/app/globals.css#L8966-L8971):
  ```css
  @media (hover: none), (pointer: coarse) {
    .wp-product-addbar,
    .wp-fp-cart {
      transform: translateY(0);
    }
  }
  ```
- Đo lường trên viewport mobile 390 (`metrics-edge.json` case `mobile-390-hover-addbar`): `addbarTransform: "matrix(1, 0, 0, 1, 0, 52)"` (visible, không hidden) — verified mở rộng đúng trên touch.
- Component [ProductCardAddBar.tsx:14-46](bigbike-web/components/catalog/ProductCardAddBar.tsx#L14-L46) sử dụng button + `e.stopPropagation()` để không trigger card link → click không conflict.

**Caveat nhỏ (không phải bug, là design choice cần xác nhận):**
- Trên mobile 390px, addbar luôn visible đè lên 52px dưới image. Card height 324px → addbar chiếm ~16% chiều cao card. Ảnh sản phẩm bị che một góc → có thể giảm visual; nhưng đây là design pattern intentional theo STYLEGUIDE.md:114 ("Add-to-cart bar: đen, trượt lên khi hover; trên touch luôn hiện").

**Fix recommendation:**
- **Không cần fix.** Behavior đúng spec. Có thể cân nhắc tăng aspect ratio image trên mobile để bù 52px addbar (P3 nếu user complain).

---

## 7. Hero polish hơn phần catalog, tạo cảm giác lệch chất lượng

**Status:** **TRUE**

**Evidence:**
- Hero [PageHero.tsx:39-78](bigbike-web/components/layout/PageHero.tsx#L39-L78): full-bleed image, overlay gradient, breadcrumb stylized, kicker đỏ, title 3.2rem clamp, count badge đỏ. CSS [globals.css:4459-4472](bigbike-web/app/globals.css#L4459-L4472).
- Catalog area: padding flat, card không border (issue #3), toolbar plain (issue #5), filter dense uppercase font-11/12px (issue #4).
- Tỷ lệ visual: hero 360px height vs grid 436px height (1 row 3 cột) → hero gần bằng grid → tỷ trọng visual lệch về hero.

**Impact:**
- **UX/branding**: user vào trang được hero "đập" mạnh nhưng phần shop core trông đơn giản → giảm trust / perceived premium.

**Fix recommendation:**
- **Nên fix:** YES — fix bằng cách nâng catalog phần lên (cards có border, toolbar đậm hơn, filter có header phân vùng).
- **Priority:** P2 (gián tiếp — sẽ tự cải thiện khi fix #3, #5).
- **Effort:** kết hợp với fix #3 + #5.
- **Risk:** Thấp.

---

## 8. Floating chat có nguy cơ che nội dung hoặc CTA

**Status:** **PARTIAL** — chỉ rủi ro ở mobile khi filter mở.

**Evidence:**
- `.wp-floating-group` [globals.css:272-285](bigbike-web/app/globals.css#L272-L285): `position: fixed; bottom: 24px; right: 24px; z-index: var(--bb-z-overlay) (=400)`.
- Mobile responsive: `bottom: 16px; right: 12px;` ([globals.css:6187-6191](bigbike-web/app/globals.css#L6187-L6191)).
- Button kích thước 56×56px + label "Bạn cần hỗ trợ?" (~140×30px) — `wp-chat-btn` 56×56 + `wp-chat-label` ([globals.css:3262-3290](bigbike-web/app/globals.css#L3262-L3290)).
- Trên mobile 390 (`mobile-390-filter-open.png`): khi filter accordion mở, "Áp dụng bộ lọc" button (red, full width, [globals.css:4599-4601](bigbike-web/app/globals.css#L4599-L4601)) nằm ở `addbarBottom ~3499px` (cuối filter section). User scroll xuống cuối, button "Áp dụng" có thể bị che bởi floating chat 56×56 (bottom 16px, right 12px). Trên viewport 390×844, vùng bottom-right 56×56 sẽ overlap nếu Apply button không ở vị trí khác.
- Z-index chat = 400 (overlay) cao hơn nội dung thường (raised=10, sticky=100) → đè đè được.
- Trên desktop 1440 (`desktop-1440.png`): chat ở bottom-right không che gì vì grid kết thúc ở y≈959 và layout dài 2972px — chat fixed ở viewport, không che catalog vùng quan tâm (cards trên cùng).

**Impact:**
- **Mobile UX**: rủi ro che "Áp dụng bộ lọc" khi user vừa nhập price range. Đây là CTA quan trọng nhất của filter form.
- **Desktop**: không vấn đề.
- **Tablet 768**: cần check thêm, nhưng filter Apply button cũng full-width ở cuối section.

**Fix recommendation:**
- **Nên fix:** YES, chỉ ở mobile.
- **Priority:** P2.
- **Effort:** XS — option (a) đẩy floating chat lên `bottom: 92px` khi filter accordion mở; option (b) `padding-bottom: 80px` cho `.wp-filters-v2-body` mobile để Apply button có chỗ thoát.
- **Risk:** Rất thấp.

---

## 9. Responsive mobile/tablet — filter drawer, card, pagination

**Status:** **TRUE** — có 2 bug CSS rõ ràng.

**Evidence:**

### 9.1 Mobile 390px vẫn 2 cột grid (vi phạm STYLEGUIDE "mobile 1 cột")
- STYLEGUIDE [STYLEGUIDE.md:148](bigbike-web/STYLEGUIDE.md#L148): "Product grid: desktop 3 cột, tablet 2 cột, **mobile 1 cột**".
- STYLEGUIDE [STYLEGUIDE.md:158](bigbike-web/STYLEGUIDE.md#L158): "320-575px | **1 cột**".
- Đo thực tế 390px (`metrics-edge.json` case `mobile-390-hover-addbar`):
  - `gridTemplateColumns: "167px 167px"` → **2 cột!**
  - Card width 167px → rất hẹp cho ảnh + title + price + addbar.
- Nguyên nhân CSS conflict:
  - Rule 1: [globals.css:6062](bigbike-web/app/globals.css#L6062) `@media (max-width: 480px) { .wp-product-grid { grid-template-columns: 1fr; } }` — specificity 0,1,0.
  - Rule 2: [globals.css:6001-6002](bigbike-web/app/globals.css#L6001-L6002) `@media (max-width: 1024px) { .wp-cat-layout .wp-product-grid { grid-template-columns: repeat(2, 1fr); } }` — specificity **0,2,0** (cao hơn).
  - Cả 2 đều match ở 390px → rule 2 thắng do specificity cao hơn.
  - Rule 3 (ghost rule cuối file): [globals.css:8830-8845](bigbike-web/app/globals.css#L8830-L8845) đặt `.wp-product-grid` mặc định 1 cột → 640px 2 cột → 1024px 3 cột. Specificity 0,1,0 — vẫn không thắng rule 2.

### 9.2 Tablet landscape 1024px — filter vẫn dạng sidebar dài
- Layout 1024px (`metrics.json` case `tablet-1024`):
  - Grid columns = 2 (do rule 6001)
  - Filter width = 240, height = **2955px**
  - Layout height = **3003px** (filter chiếm 98%)
- Filter chuyển sang accordion (`display: none` body) chỉ ở `≤768px` ([globals.css:6026-6031](bigbike-web/app/globals.css#L6026-L6031)). Khoảng `769-1023px` filter vẫn dạng full sidebar mở → page cao bất hợp lý.

### 9.3 Mobile filter accordion: behavior chính xác
- Mobile 390 (`mobile-390.png`, `metrics-edge.json` case `mobile-390-hover-addbar`):
  - `filtersBodyDisplay: "none"` → đúng spec accordion.
  - `filtersHeight: 58px` ✓
- Toggle button hoạt động (`mobile-390-filter-open.png` mở body lên 2821px).

### 9.4 Pagination
- [bigbike-web/components/ui/PaginationNav.tsx] — chưa đọc trong audit này, nhưng trong screenshot không thấy pagination (vì 2 sản phẩm < 24/page). Cần test với data đủ sản phẩm để verify. **NEEDS_VERIFICATION** với seed data nhiều hơn.

**Impact:**
- 9.1: Mobile cards 167px là quá hẹp — title 18px sẽ wrap xấu, price/stock badge chen chúc. **Vi phạm STYLEGUIDE rõ ràng.**
- 9.2: Tablet landscape user vào sẽ thấy filter dài như desktop nhưng 2 cột grid → khoảng trống lớn hơn.
- 9.3: OK.
- 9.4: chưa verify.

**Fix recommendation:**
- **Nên fix 9.1:** YES, **P0** (vi phạm STYLEGUIDE).
  - Sửa rule 6001-6002 → đổi sang `@media (min-width: 769px) and (max-width: 1024px)` để chỉ áp dụng tablet, KHÔNG mobile.
  - Hoặc tăng specificity của rule 1024px: `.wp-cat-layout .wp-product-grid { grid-template-columns: 1fr; }` ở `@media (max-width: 480px)`.
- **Nên fix 9.2:** YES, **P1**.
  - Convert filter sang accordion từ 1024px trở xuống (extend từ 768 hiện tại). Hoặc làm filter sticky thật bằng cách add max-height + overflow ở `.wp-filters-v2`.
- **Effort tổng:** S (1h cho 9.1 + 9.2).
- **Risk:** Thấp — chỉ điều chỉnh media query breakpoint.

---

## 10. WP parity nhưng chưa tối ưu conversion e-commerce

**Status:** **TRUE** — observation, không phải bug đơn lẻ.

**Evidence cảm tính dựa trên industry best practice:**
- **Thiếu QuickView modal** — user phải click vào PDP mới thấy chi tiết, không thể compare nhanh.
- **Không có "items per page"** dropdown — fix 24/page.
- **Không có view toggle (grid/list)** — list view giúp so sánh spec.
- **Không có "đang xem N/Tổng" loading state** khi đổi filter — page reload toàn trang (form GET) → UX rebound.
- **Sort options nghèo:** không có "Bán chạy" (popularity), "Đánh giá cao" (rating desc) — chỉ có created/name/price.
- **Filter chips active đặt trên cùng filter sidebar** ([CatalogFilters.tsx:171-187](bigbike-web/components/catalog/CatalogFilters.tsx#L171-L187)) → user phải nhìn vào sidebar mới thấy đang lọc gì. Lý tưởng: chips nên ở toolbar.
- **Wishlist button đè trên ảnh** — OK nhưng không có "Add to compare".
- **Card không show số review/rating count** — chỉ show stars khi `product.rating > 0` ([ProductCard.tsx:59-63](bigbike-web/components/catalog/ProductCard.tsx#L59-L63)). Không có "(123 đánh giá)".

**Impact:**
- Conversion ngắn hạn không gãy, nhưng so với chuẩn e-commerce 2026 thì thiếu nhiều affordance.

**Fix recommendation:**
- **Có nên fix:** PARTIAL — không phải trong scope audit này; nên log thành **Phase 2/3 backlog**, ưu tiên QuickView + filter chips lên toolbar.
- **Priority:** P2–P3.
- **Effort:** M–L (feature add, cần PRD).
- **Risk:** Cần coordination với backend (bán chạy / rating count cần API support).

---

## 11. Vấn đề bonus phát hiện thêm (không trong question gốc)

### 11.1 Inconsistency giữa `.wp-product-card` (catalog) và `.wp-fp-item` (featured)
- Featured Product trên home dùng `.wp-fp-item` → đã có `padding: 20px; border: 1px solid #dddddd;` ([globals.css:8973-8977](bigbike-web/app/globals.css#L8973-L8977)).
- Catalog product dùng `.wp-product-card` → KHÔNG có border (issue #3).
- **Cùng STYLEGUIDE.md "Product Cards" spec nhưng 2 implementation khác nhau** → maintenance debt.

### 11.2 Form GET sort hidden input trong filter form
- [CatalogFilters.tsx:193-195](bigbike-web/components/catalog/CatalogFilters.tsx#L193-L195) inject `<input type="hidden" name="sort" value={current.sort} />` để preserve sort khi submit filter. **OK đúng pattern**.
- Nhưng `CatalogSortSelect` ([CatalogSortSelect.tsx:18-23](bigbike-web/components/catalog/CatalogSortSelect.tsx#L18-L23)) dùng router push: gọi `params.delete("page")` → đúng. Verified không phá SEO URL.

### 11.3 `key={[...].join(",")}` của CatalogFilters tại [san-pham/page.tsx:185](bigbike-web/app/san-pham/page.tsx#L185)
- Force unmount + remount khi filter change → reset `useState(brandSearch)` và `mobileOpen`. Đây có thể là intentional (reset UI state on URL change) nhưng cũng làm mất search input value khi user submit filter — **NEEDS_VERIFICATION với UX intent**. Không phải bug, chỉ flag.

### 11.4 CSS conflict rộng hơn ngoài grid
- Rule `.wp-product-grid` được redefine 5 lần trong file (line 4287, 6001, 6002, 6048, 6062, 8830, 8836, 8842) → khó maintain. Codebase cần consolidation.
- Tương tự `.wp-product-card`, `.wp-product-body`, `.wp-product-name` đều bị redefine 2–3 lần ở các vùng khác nhau của file globals.css (4288 vs 8847, 4305 vs 8881, 4307 vs 8906). Đây là technical debt từ WP-parity migration.

---

# Fix Plan nếu được duyệt

> **Nguyên tắc:** không phá business logic, không đổi SEO URL/query params, không đụng `generateMetadata`, canonical, noindex, form GET filter, add-to-cart, wishlist. Chỉ sửa CSS + một số JSX nhẹ.

## Phase 1 — Quick wins (CSS-only, 1 PR, ~3h)

**Mục tiêu:** fix vi phạm STYLEGUIDE và CSS conflicts đơn giản.

| # | Hành động | File | Effort | Risk |
|---|---|---|---|---|
| 1 | Thêm `border: 1px solid #ddd; padding: 20px;` cho `.wp-product-card` | `globals.css` (rule 4288 và 8335-8370) | XS | Rất thấp |
| 2 | Bump `.wp-product-name` 16px → 18px (theo spec) + giữ `text-transform: none` | `globals.css:8906-8909` | XS | Thấp (test với title dài) |
| 3 | Fix mobile 1 cột: đổi media `@media (max-width: 1024px)` → `(min-width: 481px) and (max-width: 1024px)` cho rule `.wp-cat-layout .wp-product-grid` | `globals.css:6001-6002` | XS | Rất thấp |
| 4 | Thêm `max-height: 320px; overflow-y: auto;` cho `.wp-filter-section-body` khi chứa `>10` items (CSS variant) | `globals.css:4522` | XS | Thấp |
| 5 | Bump `.wp-filter-color-name` 9px → 11px | `globals.css:4596` | XS | Rất thấp |
| 6 | Mobile padding-bottom 80px cho `.wp-filters-v2-body` để Apply button không bị floating chat che | `globals.css` mobile block | XS | Rất thấp |

**Acceptance Phase 1:**
- Desktop 1440 (`/san-pham/`): mỗi card có border xám rõ ràng, hover đổi sang đỏ + shadow đỏ; title đọc 18px.
- Mobile 390: grid **1 cột**, card chiếm full width container (≈358px).
- Active filter desktop: filter section list dài (>10 items) có scroll, page total height giảm ít nhất 40%.

## Phase 2 — Refactor layout / card / filter / toolbar (1 PR, ~6h)

**Mục tiêu:** cải thiện chất lượng visual + chuẩn hoá CSS.

| # | Hành động | File | Effort | Risk |
|---|---|---|---|---|
| 7 | Consolidate `.wp-product-grid` rules vào 1 chỗ duy nhất, xoá duplicates | `globals.css` | S | Thấp (test trên home + catalog + PDP related) |
| 8 | Convert `<select>` sort sang custom dropdown (giữ keyboard a11y) | `CatalogSortSelect.tsx` | M | Thấp |
| 9 | Toolbar có background `--bb-bg-surface-raised`, border-bottom đỏ 2px (giống `.wp-filters-v2-header`) | `globals.css:4617-4621` | XS | Rất thấp |
| 10 | Filter chips chuyển sang toolbar (left), giữ chips trên sidebar fallback | `san-pham/page.tsx` + `CatalogFilters.tsx` | M | Thấp |
| 11 | Filter sidebar accordion từ 1024px trở xuống thay vì 768px (giảm tablet height) | `globals.css:6026-6031` | XS | Thấp |
| 12 | Brands list: limit hiện 12, "Xem thêm" expand toggle | `CatalogFilters.tsx:241-251` | S | Thấp |

**Acceptance Phase 2:**
- Tablet 768-1024px: filter là accordion, page height ≤ 1.5x grid height.
- Sort dropdown styled theo brand (sharp corner, đỏ accent).
- Toolbar có chip filter active, dễ nhận biết.
- Brands list mặc định show 12 items + "Xem thêm" toggle.

## Phase 3 — Responsive + QA (1 PR, ~3h)

**Mục tiêu:** test toàn bộ viewport + edge cases.

| # | Hành động |
|---|---|
| 13 | Chạy Playwright test capture 4 viewport (1440 / 1024 / 768 / 390) lưu vào `docs/screenshots/product-listing/regression/` |
| 14 | Verify pagination component khi page > 1 với seed data |
| 15 | Verify filter Apply button không bị floating chat che ở mọi viewport |
| 16 | Verify SEO: `generateMetadata` title/canonical/noindex không đổi với cùng query params trước/sau fix |
| 17 | Verify form GET filter giữ nguyên các name params (`category`, `pwb-brand`, `q`, `filter_color`, `min_price`, `max_price`, `sort`) |
| 18 | Verify add-to-cart + wishlist + variants buttons vẫn hoạt động trên touch |
| 19 | Lighthouse mobile + desktop trước/sau |

**Acceptance Phase 3:**

### Desktop 1440px
- Card có border #ddd, hover đỏ + shadow.
- 3 cột grid (đã đúng), gap 24px.
- Title 18px Oswald.
- Filter có max-height list, page total height ≤ 2x grid height khi có nhiều sản phẩm; sticky thực sự active.
- Toolbar nổi bật, có chip filter active.

### Tablet landscape 1024px
- 3 cột grid OK, hoặc 2 cột nếu desktop-mode override.
- Filter ở dạng accordion mở mặc định, height filter ≤ 400px khi đóng list dài.

### Tablet portrait 768px
- 2 cột grid.
- Filter accordion đóng mặc định, toggle hoạt động.
- Toolbar full-width, sort dropdown vừa.

### Mobile 390px
- **1 cột grid** (fix bug 9.1).
- Card full width container, title 18px wrap đẹp.
- Filter accordion đóng mặc định, mở lên không che floating chat Apply button.
- Floating chat không che bất kỳ CTA nào.

### Cross-viewport
- SEO metadata không đổi.
- Form GET filter submit ra URL đúng format hiện tại.
- Add-to-cart + variant select + wishlist hoạt động trên touch, không có hover-only path.
- Sort không reset filter, filter không reset sort.
- Active filter chip click → xoá đúng key, giữ các key khác.

---

## Tham chiếu

- Screenshots audit: `docs/screenshots/product-listing/audit/`
- Metrics JSON: `docs/screenshots/product-listing/audit/metrics.json`, `metrics-edge.json`
- Screenshot reference user-provided: `docs/screenshots/product-listing/product-listing-full-desktop.png`
- Scripts: `scripts/audit-product-listing-viewports.js`, `scripts/audit-product-listing-edge.js`
- Spec gốc: `bigbike-web/STYLEGUIDE.md`
- Source code chính: `bigbike-web/app/san-pham/page.tsx`, `bigbike-web/components/catalog/*`, `bigbike-web/components/layout/PageHero.tsx`
- CSS: `bigbike-web/app/globals.css`, `bigbike-web/styles/brand-tokens.css`

## Đề xuất quyết định

**Verdict:** **YES, tiến hành fix theo Phase 1 trước.** Phase 1 toàn fix CSS vi phạm STYLEGUIDE rõ ràng, risk rất thấp, không phá business logic / SEO / form. Sau Phase 1 review lại screenshot rồi quyết định Phase 2/3.

**Lý do KHÔNG fix big-bang:**
- Issue #2, #6, #10 không cần fix ngay (false positive hoặc data-induced).
- Phase 2 (toolbar refactor + filter chips relocate) cần UX review/A/B vì đụng đến IA — không nên gộp chung với Phase 1.
- CSS file 9587 dòng có nhiều rule duplicate → consolidation cần PR riêng để có thể revert dễ.
