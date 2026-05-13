# SHADCN / RADIX UI MIGRATION AUDIT — bigbike-web

> Cập nhật: 2026-05-13
> Phạm vi: toàn bộ `bigbike-web/`
> Liên quan: [STYLEGUIDE.md](../../bigbike-web/STYLEGUIDE.md), [brand-tokens.css](../../bigbike-web/styles/brand-tokens.css), [WP_TO_NEXT_UI_PARITY_AUDIT.md](WP_TO_NEXT_UI_PARITY_AUDIT.md), [BIGBIKE_WEB_BACKGROUND_COLOR_AUDIT.md](BIGBIKE_WEB_BACKGROUND_COLOR_AUDIT.md)

---

## 1. Tóm Tắt Điều Hành

| Mục | Giá trị |
|---|---|
| Stack hiện tại | Next.js 16.2.4 (App Router, RSC) + React 19.2.4 + Tailwind CSS v4 |
| Radix UI đã cài | **KHÔNG** (0 package, 0 import) |
| shadcn/ui đã cài | **KHÔNG** (không có `components.json`, không có `components/ui/button.tsx`…) |
| `class-variance-authority` / `clsx` / `tailwind-merge` / `lucide-react` | **KHÔNG cài** package nào |
| Form lib | `react-hook-form` 7.74 + `@hookform/resolvers` 5 + `zod` 4 — sẵn sàng tương thích shadcn Form |
| Tooltip lib | `@tippyjs/react` 4 (chỉ import trong code/script — phần lớn tooltip là custom `BBTooltip`) |
| Design tokens BigBike | **Đã hoàn thiện** trong `styles/brand-tokens.css` (709 dòng, đầy đủ palette/typography/spacing/radius) |
| CSS global | `app/globals.css` = **9.571 dòng**, chứa **2.185** lượt xuất hiện `wp-*` |
| Lượt dùng class `wp-*` ngoài CSS | **342+ tham chiếu trên 30+ file TS/TSX** (chính: layout, catalog, content, scripts) |
| Brand contract | **Light-first WP-parity** (track B); `radius = 0` ở mọi component; font Oswald/Barlow/Barlow Condensed; CTA uppercase |

**Kết luận cốt lõi:** BigBike đã có sẵn một design system gần như đầy đủ — gồm token, class utility (`.bb-button`, `.bb-card`, `.bb-input`, `.bb-badge`, `.bb-price`, `.bb-product-card`…) và WP-parity layer. Giá trị thực của shadcn/Radix ở đây **không phải visual**, mà là:

1. **Accessibility primitives của Radix** (focus trap, roving tabindex, aria-* chuẩn, keyboard navigation) cho các component tương tác (Dialog, Tabs, DropdownMenu, Tooltip, Popover, Sheet, Accordion, Select, RadioGroup, Checkbox).
2. **Mẫu code chuẩn shadcn** (`components/ui/*` + `cn()` + `cva`) để dev mới onboard nhanh hơn.

Vì vậy có **2 chiến lược migration hợp lệ** — sẽ trình bày ở Section 8 và cần user chọn trước khi triển khai Phase 1.

---

## 2. Hiện Trạng Custom UI Component

### 2.1 `components/ui/` (UI primitives nội bộ)

| File | Vai trò hiện tại | Có nên migrate sang shadcn/Radix? |
|---|---|---|
| `BBTooltip.tsx` | Tooltip CSS thuần, mouse + focus, có aria-describedby | **Có** — Radix Tooltip xử lý a11y tốt hơn (collision, delay group, escape) |
| `EmptyState.tsx` | Visual block trạng thái rỗng | **Giữ custom** — không có equivalent shadcn |
| `ErrorState.tsx` | Visual block trạng thái lỗi | **Giữ custom** |
| `LoadingGrid.tsx` | Skeleton grid danh sách | Có thể dùng shadcn Skeleton làm base, wrapper giữ |
| `MediaImage.tsx` | Wrap `next/image` + fallback | **Giữ custom** — domain-specific |
| `PaginationNav.tsx` | Pagination link-based (SSR friendly) | **Giữ custom** — shadcn Pagination chủ yếu hữu ích trong client-state; ở đây dùng query string |
| `PriceText.tsx` | Format giá VND có sale/compare | **Giữ custom** — brand-specific |
| `RatingStars.tsx` | Sao đánh giá | **Giữ custom** |
| `Skeletons.tsx` | Tập hợp skeleton wp-* | Có thể chia: phần raw skeleton dùng shadcn `Skeleton`, phần wp-card-skeleton giữ |
| `VnAddressFields.tsx` | Form fields chọn tỉnh/huyện/xã | **Giữ custom** — wrap shadcn Select bên trong nếu migrate Select |

### 2.2 `components/layout/`

| File | Pattern Radix có thể dùng | Ghi chú |
|---|---|---|
| `SiteHeader.tsx` (RSC) | — | Server component, không cần migrate |
| `SiteFooter.tsx` | — | Static, không có interactive primitive |
| `StickyHeaderShell.tsx` | — | Sticky logic, không phải primitive |
| `HeaderNavItem.tsx` | **NavigationMenu** (Radix) hoặc giữ custom + Popover | Hiện dùng hover/focus CSS thuần |
| `HeaderUserMenu.tsx` | **DropdownMenu** (Radix) | Hiện custom; Radix sẽ có roving tab, ESC, click outside |
| `MobileHeaderMenu.tsx` | **Sheet/Dialog** (Radix) | Đã có `useFocusTrap` tự viết — Radix Dialog làm việc này chuẩn hơn |
| `SearchToggle.tsx` | **Dialog** hoặc **Popover** | Click toggle, có thể chuẩn hoá |
| `AccountShell.tsx` | — | Layout component |
| `FloatingChatLoader.tsx` | — | Floating widget, không phải primitive |
| `PolicySidebar.tsx` | — | Sidebar nav |
| `PageHero.tsx`, `BctBadge.tsx` | — | Visual block |

### 2.3 `components/catalog/`

| File | Pattern Radix có thể dùng | Ưu tiên |
|---|---|---|
| `QuickBuyModal.tsx` | **Dialog** | **Cao** — modal a11y (focus trap, aria-modal, restore focus) |
| `ProductTabs.tsx` | **Tabs** | **Cao** — hiện không có keyboard arrow nav, không có roving tabindex |
| `CatalogFilters.tsx` | **Accordion** (cho FilterSection) + **Sheet** (cho mobile drawer) + **Checkbox/RadioGroup** | **Cao** — nhiều interactive primitive bị custom |
| `CatalogSortSelect.tsx` | **Select** | Trung — hiện dùng native `<select>`? cần xác nhận |
| `VariantSelector.tsx` | **RadioGroup** (nếu là chọn 1) hoặc giữ button group | Trung |
| `PurchaseSectionClient.tsx` | — | Compose ProductTabs/AddToCart/VariantSelector |
| `ProductCard.tsx` | — | Visual card — giữ `.bb-product-card` |
| `ProductCardAddBar.tsx` | — | Visual + hover anim, giữ custom |
| `ProductGallery.tsx` | **Tabs**/**Carousel**? | Hiện dùng `swiper` — đã đủ tốt |
| `PricingPanel.tsx` | — | Visual block |
| `AddToCartButton.tsx` | — | Button + click; có thể wrap shadcn Button |
| `WishlistButton.tsx` | — | Button + state |
| `StockStatus.tsx` | — | Visual badge — dùng `.bb-badge` |
| `RecentlyViewedSection.tsx` | — | Section |
| `ReviewsSection.tsx` | — | Section |

### 2.4 `components/home/`

| File | Ghi chú |
|---|---|
| `BrandCarousel.tsx`, `FeaturedProductsCarousel.tsx`, `ExperienceCarousel.tsx`, `HomeVideoCarousel.tsx` | Dùng `swiper` 12 — **giữ nguyên**, không cần Radix |
| `HeroSlider.tsx` | Dùng `swiper` — giữ nguyên |
| `FloatingChat.tsx`, `HomeAnalytics.tsx`, `WpFeaturedProductCard.tsx` | Visual/widget, không cần migrate |

### 2.5 `components/cart/`, `components/contact/`, `components/content/`, `components/providers/`, `components/analytics/`

| File | Ghi chú |
|---|---|
| `CartIcon.tsx` | Icon nhỏ, không cần migrate |
| `ContactForm.tsx` | **Form** (shadcn Form + react-hook-form) — đã có `react-hook-form` sẵn |
| `ArticleCard.tsx`, `ArticleTOC.tsx` | Visual/content |
| `QueryProvider.tsx` | React Query provider |
| `AnalyticsView.tsx`, `PurchaseEvent.tsx` | Analytics-only |

---

## 3. CSS Global — Phân Loại

### 3.1 `styles/brand-tokens.css` (709 dòng) — **TÀI SẢN, GIỮ NGUYÊN**

- Định nghĩa toàn bộ token: color primitive (red 50-900, gray 25-900, blue/cyan/orange/warning/green/purple/pink/magenta), semantic color (`--bb-brand-primary`, `--bb-text-primary`…), background light/dark, border, overlay, state, typography (Oswald/Barlow/Barlow Condensed), spacing 4px scale, container/breakpoint, **radius = 0 ở tất cả mọi nơi**, focus ring, shadow, duration/easing, z-index.
- Cung cấp class utility cấp app: `.bb-theme`, `.bb-container`, `.bb-display`, `.bb-h1/h2/h3`, `.bb-body`, `.bb-kicker`, `.bb-meta`, `.bb-button` + `.bb-button-primary/secondary/outline/dark`, `.bb-card` + `.bb-card-hover`, `.bb-input`, `.bb-badge` + variants, `.bb-price`, `.bb-product-card`, `.bb-hero-overlay`, `.bb-richtext`.
- Đây **chính là tầng "shadcn của BigBike"** — đã sản phẩm hoá theo brand. Migration phải tôn trọng tầng này.

### 3.2 `app/globals.css` (9.571 dòng) — **WP-PARITY LAYER**

Cấu trúc (đã đọc 200 dòng đầu, suy ra từ pattern):

- **Top:** import tailwind + brand-tokens; alias `--background`/`--foreground`; `@theme inline` cho Tailwind v4.
- **Body + main:** layout chung.
- **`.bb-footer*` (≈200 dòng):** footer WP-parity.
- **Phần lớn còn lại:** class `wp-*` (2.185 lượt xuất hiện) — match design WordPress cũ. Bao gồm:
  - `wp-header-*`, `wp-logo`, `wp-nav-*` — header
  - `wp-product-card`, `wp-product-grid`, `wp-product-*` — catalog
  - `wp-filter-*`, `wp-pdp-*` — listing + PDP
  - `wp-floating-*` — floating actions
  - `wp-home`, `wp-section-*` — home sections
  - `wp-skeleton-*` — loading
  - Reset, base, utilities ở giữa

**Đánh giá:** Hầu hết class `wp-*` đang **được dùng thật sự** (xem Section 4). Không thể xoá đại trà; phải xử lý từng nhóm sau khi component tương ứng đã migrate.

### 3.3 Các class `wp-*` còn cần giữ

Dựa trên dấu vết grep, các nhóm còn dùng nặng:

- `wp-header-*`, `wp-logo*` → trong `SiteHeader`, `MobileHeaderMenu`, `SearchToggle`, `HeaderUserMenu`, `HeaderNavItem`
- `wp-filter-*` → trong `CatalogFilters`
- `wp-pdp-*` → trong `ProductTabs`, `PurchaseSectionClient`
- `wp-floating-*` → trong `layout.tsx`, `FloatingChatLoader`
- `wp-skeleton-*` → trong `Skeletons.tsx`
- `wp-home`, `wp-section-*` → trong `app/page.tsx` và home components
- `wp-product-*` → trong `ProductCard`, `ProductCardAddBar`, listing page

**Quy tắc:** Chỉ xoá class `wp-*` **sau khi**:
1. Component dùng nó đã chuyển sang shadcn/Radix có style equivalent.
2. Verified bằng grep trên toàn repo không còn ref.
3. Verified visual qua screenshot multi-viewport.

---

## 4. Rủi Ro Migration

| # | Rủi ro | Mức độ | Mitigation |
|---|---|---|---|
| R1 | shadcn CLI có thể không tương thích Tailwind v4 hoàn toàn (CSS-first `@theme inline`, không có `tailwind.config.js`) | **Cao** | Config thủ công: viết `components/ui/*` từ template, không phụ thuộc `shadcn add` |
| R2 | Next.js 16 + React 19.2 — bleeding edge; một số Radix package có thể chưa update peer deps | **Trung** | Pin `@radix-ui/react-*` version mới nhất; test từng primitive trước khi commit |
| R3 | Phá visual WP-parity (radius, color, font, padding) | **Cao** | Map token sang shadcn HSL vars; override `--radius: 0`; CSS variable cho color brand; QA screenshot |
| R4 | Class `wp-*` còn dùng — nếu xoá nhầm sẽ vỡ layout | **Cao** | Không xoá CSS trong Phase 1-4; chỉ refactor ở Phase 5 sau khi component đã migrate |
| R5 | SSR/hydration mismatch với Radix portal (Dialog, Tooltip, DropdownMenu) | **Trung** | Dùng `"use client"` đúng chỗ, dùng `Portal` của Radix; test build |
| R6 | Phá query string filter/sort/pagination (CatalogFilters) | **Cao** | Migrate đúng API — Radix Accordion + Sheet, giữ logic `buildQueryString` |
| R7 | Phá cart/wishlist flow (QuickBuyModal) | **Cao** | Migrate Dialog phải giữ y nguyên submit/redirect/idempotency key |
| R8 | Phá SEO (metadata, sitemap, robots) | **Thấp** | Không đụng `app/layout.tsx` metadata, `sitemap.ts`, `robots.ts` |
| R9 | Tăng bundle size do nhiều Radix package | **Thấp** | Radix tree-shake tốt, chỉ import primitive thực dùng |
| R10 | Form rebuild làm vỡ validation `ContactForm`/checkout | **Trung** | Giữ schema zod, chỉ thay UI wrapper |
| R11 | Tooltip hover hành vi đổi (Tippy vs Radix) | **Thấp** | Acceptable — Radix tốt hơn |
| R12 | Hot reload Tailwind v4 chậm hơn khi add nhiều file `components/ui/*` | **Thấp** | Acceptable |

---

## 5. Routes & Business Logic Cần Bảo Vệ

Tất cả route sau **PHẢI** giữ nguyên URL + query params + SSR behavior:

```
/                                 — home
/san-pham                          — product listing (q, category, pwb-brand, filter_color, min_price, max_price, sort, page)
/danh-muc-san-pham                 — category index
/danh-muc-san-pham/[slug]          — category detail
/brands                            — brand index
/brands/[slug]                     — brand detail
/product/[slug]                    — PDP
/tim-kiem                          — search
/gio-hang                          — cart
/thanh-toan                        — checkout
/don-hang/xac-nhan                 — order confirm
/dang-nhap, /dang-ky, /quen-mat-khau, /xac-nhan-email — auth
/tai-khoan, /tai-khoan/doi-tra     — account
/tin-tuc, /tin-tuc/[slug]          — blog
/huong-dan, /huong-dan/[...sub]    — guides
/bao-hanh, /chinh-sach/[slug], /gioi-thieu, /huong-dan-mua-hang, /lien-he — content
```

API contract (`lib/api/public-api.ts`, `lib/api/client-api.ts`, `lib/contracts/*`) **KHÔNG ĐƯỢC ĐỤNG VÀO**.

Business flow phải giữ:
- Add-to-cart, wishlist toggle, quick-buy → API như cũ.
- Filter/sort/pagination → query string format giữ y nguyên.
- Form `ContactForm` → submit endpoint + payload giữ y nguyên.
- SEO metadata + JSON-LD (`lib/seo/json-ld.ts`) → giữ nguyên.

---

## 6. Inventory shadcn Primitives Cần — Ưu Tiên

| Primitive | Component dùng | Ưu tiên | Lý do a11y |
|---|---|---|---|
| **Dialog** | `QuickBuyModal`, có thể thêm cho image preview | **P0** | Focus trap, aria-modal, restore focus, ESC, body scroll lock |
| **Sheet** (Dialog with side variant) | `MobileHeaderMenu`, `CatalogFilters` (mobile drawer) | **P0** | Mobile drawer chuẩn |
| **Tabs** | `ProductTabs` | **P0** | Roving tabindex, arrow key navigation |
| **DropdownMenu** | `HeaderUserMenu` | **P0** | Roving focus, click outside, ESC, sub-menu |
| **Tooltip** | thay `BBTooltip` | **P1** | Collision detection, delay group, touch-friendly |
| **Accordion** | `CatalogFilters.FilterSection` | **P1** | Native disclosure ARIA |
| **Select** | `CatalogSortSelect`, `VnAddressFields` | **P1** | Custom-styled native-like select, keyboard nav |
| **RadioGroup** | nếu `VariantSelector` chọn 1 | **P2** | Roving tabindex |
| **Checkbox** | filter brand/color | **P2** | a11y label binding |
| **Popover** | nếu cần (cart preview?) | **P2** | Same as Tooltip nhưng có interactive content |
| **Form** | `ContactForm`, checkout, address | **P1** | Tích hợp react-hook-form chuẩn |
| **Label** | tất cả form | **P1** | Đi kèm Form |
| **Skeleton** | base cho `Skeletons.tsx` | **P2** | Đơn giản, dễ swap |
| **Button** | wrapper chung | **P2** | Hoặc giữ `.bb-button` (đã đủ) |
| **Card** | — | **Bỏ qua** | `.bb-card` + `.bb-product-card` đã chuẩn |
| **Badge** | — | **Bỏ qua** | `.bb-badge` đã chuẩn |
| **Input/Textarea** | wrapper chung | **P2** | Hoặc giữ `.bb-input` |
| **Separator** | — | **P3** | Cosmetic |
| **Alert** | toast/error block | **P2** | Hoặc dùng `ErrorState` đã có |
| **Pagination** | — | **Bỏ qua** | `PaginationNav` đã SSR-friendly |

---

## 7. Thứ Tự Migration An Toàn

```
PHASE 1: Foundation
  1.1  Cài deps: @radix-ui/react-{slot,dialog,dropdown-menu,tabs,...},
                  class-variance-authority, clsx, tailwind-merge, lucide-react
  1.2  Tạo lib/utils.ts với cn()
  1.3  Tạo components.json
  1.4  Tạo tầng `components/ui/*` template (Button/Dialog/Sheet/Tabs/...)

PHASE 2: Token mapping
  2.1  Thêm shadcn-style HSL CSS vars vào brand-tokens.css ánh xạ từ BigBike tokens
        --background, --foreground, --primary, --primary-foreground, --secondary,
        --destructive, --muted, --accent, --popover, --card, --border, --input, --ring, --radius
  2.2  Set --radius: 0
  2.3  Test 1 component shadcn render đúng brand

PHASE 3: P0 Primitives (Dialog, Sheet, Tabs, DropdownMenu)
  3.1  Dialog → QuickBuyModal
  3.2  Sheet → MobileHeaderMenu
  3.3  Tabs → ProductTabs
  3.4  DropdownMenu → HeaderUserMenu
  → build + typecheck + screenshot mỗi component

PHASE 4: Module-by-module — tuỳ scope user chọn
  4.1  Layout (header/footer/floating)
  4.2  Home page
  4.3  Product listing (CatalogFilters Accordion + Sheet mobile, CatalogSortSelect)
  4.4  PDP (đã có Tabs ở Phase 3; thêm Tooltip cho stock/feature)
  4.5  Cart/Checkout (Form, RadioGroup payment, Select address)
  4.6  Search, brand, category, blog, content pages
  4.7  Auth/account forms

PHASE 5: CSS cleanup
  5.1  Grep từng nhóm wp-*; xác nhận không còn ref → di chuyển sang section "legacy" hoặc xoá
  5.2  Tách globals.css thành layer: tokens / base / wp-legacy / utilities
  5.3  Verify build + visual

PHASE 6: QA
  6.1  npm run lint, build, test
  6.2  Playwright (đã có dep) screenshot 390/768/1024/1440
  6.3  Smoke test: filter/sort/pagination, add-to-cart, quick-buy, mobile menu, PDP tabs
```

---

## 8. Hai Chiến Lược — Cần User Chọn

### Chiến lược A: Full shadcn (visual + a11y)

- Thay `.bb-button` → shadcn `Button` với variant primary/secondary/outline/dark.
- Thay `.bb-card` → shadcn `Card`.
- Thay `.bb-input`/`.bb-badge` → shadcn equivalents.
- Map toàn bộ token sang HSL var của shadcn (`--primary`, `--secondary`…).
- **Ưu:** Dev mới onboard nhanh, pattern chuẩn ngành.
- **Nhược:** Churn lớn (≈30-50 file), rủi ro lệch visual brand cao, phải QA pixel-perfect; lợi ích visual gần như zero vì `.bb-*` đã đúng STYLEGUIDE.

### Chiến lược B: Radix-first hybrid (a11y trước, visual sau)

- **Visual:** giữ `.bb-button`, `.bb-card`, `.bb-input`, `.bb-badge`, `.bb-product-card`, `.bb-price` — đã đúng STYLEGUIDE và WP-parity.
- **Interactive primitives:** dùng Radix (Dialog/Sheet/Tabs/DropdownMenu/Tooltip/Accordion/Select/RadioGroup/Checkbox/Popover) wrapped trong `components/ui/*` theo pattern shadcn, **style bằng `.bb-*` class hoặc Tailwind**.
- **Form:** dùng shadcn Form + react-hook-form (đã có sẵn `@hookform/resolvers`).
- **Icon:** dùng `lucide-react` thay vì inline SVG (giảm trùng lặp).
- **Ưu:** Lấy 90% giá trị (a11y, form pattern, icon system) với 30% churn; brand không thể vỡ; có thể dừng giữa chừng vẫn nhất quán.
- **Nhược:** Không phải "pure shadcn", một số dev xa lạ với `.bb-*` class.

**Đề xuất:** **Chiến lược B** — phù hợp nhất với codebase này vì:
1. `brand-tokens.css` đã là "shadcn của BigBike" — không cần thay tầng dưới.
2. STYLEGUIDE quy định radius = 0, font racing, uppercase — shadcn default phải override hết.
3. Giá trị thực của Radix là a11y, không phải CSS.
4. Cho phép dừng/tiếp tục giữa các phase mà không vỡ giao diện.

---

## 9. Acceptance Criteria Cho Migration

Hoàn tất khi:

- [ ] `npm run lint` không lỗi nghiêm trọng.
- [ ] `npm run build` thành công.
- [ ] `npm run test` pass (vitest đã có).
- [ ] Mọi route trong Section 5 vẫn render đúng và giữ URL.
- [ ] Filter/sort/pagination giữ query string format.
- [ ] Quick-buy modal vẫn submit và redirect đúng.
- [ ] Add-to-cart, wishlist hoạt động.
- [ ] Header desktop + mobile menu hoạt động trên 390/768/1024/1440.
- [ ] PDP tabs có keyboard navigation (arrow key).
- [ ] Visual brand không lệch (đỏ #FF0C09, radius 0, font Oswald/Barlow, uppercase heading/CTA).
- [ ] Bundle size không tăng quá +50KB gzip.
- [ ] SEO metadata, sitemap, robots, JSON-LD không đổi.

---

## 10. Khuyến Nghị Cho User

1. **Chốt chiến lược A hay B** trước khi vào Phase 1.
2. **Chốt scope** — full migration một mạch hay theo module (header → listing → PDP → checkout) với mỗi module một PR riêng để dễ review/rollback.
3. **Chốt mức xoá CSS `wp-*`** — giữ nguyên (chỉ thêm tầng UI mới), hay dọn dần sau migration.
4. Sau khi chốt 3 điểm trên, tôi sẽ vào Phase 1 (setup foundation) và báo cáo build pass trước khi chạm Phase 3 (component thay thế thực sự).
