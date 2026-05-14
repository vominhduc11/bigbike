# BigBike Web — Full Design System Audit

Ngày kiểm tra: **2026-05-13**
Phạm vi: toàn bộ source `bigbike-web/` (app, components, styles, lib)
Người kiểm tra: Senior Frontend / UI-UX Architect agent (audit-only mode)
Tham chiếu trước đó: [`BIGBIKE_WEB_DESIGN_SYSTEM_CONSISTENCY_AUDIT.md`](./BIGBIKE_WEB_DESIGN_SYSTEM_CONSISTENCY_AUDIT.md) (2026-05-13, narrower scope — đợt sửa shared UI primitive). Audit lần này mở rộng phạm vi: chấm điểm **toàn bộ** dự án trên trục “một design system duy nhất”.

---

## 0. TL;DR

| Hạng mục | Kết luận |
|---|---|
| Token foundation (color/font/radius/spacing) | **Tốt** — cascade `STYLEGUIDE.md → brand-tokens.css → globals.css @theme inline → Tailwind utility` đã chuẩn. |
| Brand alignment (CTA đỏ `#FF0C09`, link xanh `#007BFF`, radius `0`, Barlow/Oswald) | **Tốt** — không phát hiện hex lạ trong UI logic (`#FF0C09`, `#007BFF` được dùng đúng chỗ; hex còn lại là logo Zalo/Facebook hoặc swatch product color). |
| shadcn primitives (Button/Input/Select/Dialog/Badge/Accordion…) | **Tốt** — đã tồn tại đầy đủ, `rounded-none`, dùng brand token. |
| Quality gates (`lint`, `tsc`, `vitest`, `next build`) | **Tốt** — 0 error, build PASS, 95/95 test PASS. |
| **Mức độ thống nhất design system trên toàn site** | **Chưa đạt** — bị phá vỡ bởi tầng styling **legacy WP-parity** trong `globals.css` (7 546 dòng, 1 728 selector `.wp-*` / `.bb-*`) mà phần lớn page + component tiêu thụ trực tiếp, song song với Tailwind. |
| Mức độ tuân thủ `AGENTS.md` §5.9 (“viết Tailwind trực tiếp vào `className`, không thêm class mới vào `globals.css`”) | **Vi phạm có hệ thống**. Toàn bộ surface page chính (home, PDP, catalog, cart, checkout, account, blog, 404) đang chạy bằng class `.wp-*` định nghĩa trong `globals.css`. |

Verdict tổng: **Trung bình lệch về phía Chưa đạt.** Foundation đúng, hệ component primitive đúng, nhưng tầng consumer (page + composite component) vẫn là cổng WordPress port chứ chưa phải Tailwind/shadcn-first. Đây là gốc rễ của hầu hết các vấn đề bên dưới.

---

## 1. Design system hiện tại

### 1.1 Tài liệu nền

Tồn tại:
- [`bigbike-web/STYLEGUIDE.md`](../../bigbike-web/STYLEGUIDE.md) — source of truth web. Định nghĩa palette, typography, component rule, layout, responsive.
- [`AGENTS.md`](../../AGENTS.md) §5.9, §5.11 — bắt buộc React + Tailwind + Radix + shadcn, cấm thêm class CSS mới vào `globals.css` khi Tailwind đủ.
- [`CLAUDE.md`](../../CLAUDE.md) — mirror Section 5.9 / 5.11.

Không tồn tại trong working tree (docs có nhắc tới):
- `Bigbike Design System/README.md` — `NOT_FOUND_IN_REPO`.
- `Bigbike Design System/colors_and_type.css` — `NOT_FOUND_IN_REPO`.
- `Bigbike Design System/ui_kits/website/` — `NOT_FOUND_IN_REPO`.
- `Bigbike Design System/preview/` — `NOT_FOUND_IN_REPO`.
- `docs/DOCS_VERIFICATION_REPORT.md` — `NOT_FOUND_IN_REPO`.

→ Audit không thể đối chiếu với bản UI kit prototype gốc. Mọi đánh giá đi theo `STYLEGUIDE.md` + token đang chạy.

### 1.2 Token cascade thực tế

| Lớp | File | Trạng thái |
|---|---|---|
| Brand rules | [`bigbike-web/STYLEGUIDE.md`](../../bigbike-web/STYLEGUIDE.md) | ✅ đầy đủ |
| CSS variables | [`bigbike-web/styles/brand-tokens.css`](../../bigbike-web/styles/brand-tokens.css) (355 dòng) | ✅ đầy đủ, đa số đúng `STYLEGUIDE` |
| Tailwind `@theme inline` | [`bigbike-web/app/globals.css:36-82`](../../bigbike-web/app/globals.css#L36-L82) | ✅ map đầy đủ shadcn color tokens + brand alias |
| Tailwind utility consumed in JSX | rải rác | ⚠️ một phần — phần còn lại đi đường `.wp-*` |

Token được khai báo:
- Color: brand-primary đỏ `#FF0C09`, hover `#E50A07`, active `#CC0906`; blue `#007BFF`; cyan `#00BFFF`; warning `#FCB900`; gray-25..gray-500; bg-page/section/surface/surface-raised/surface-hover/surface-dark; text-primary/secondary/muted/inverse; border-subtle/default/strong/brand; state success/warning/danger/info.
- Typography: `--bb-font-display` = Oswald, `--bb-font-heading` = Oswald, `--bb-font-body` = Barlow, `--bb-font-cta` = Barlow Condensed, `--bb-font-nav` = Barlow Condensed. Loaded qua `next/font` ở [`app/layout.tsx:3-31`](../../bigbike-web/app/layout.tsx#L3-L31). Đúng `STYLEGUIDE`.
- Radius: tất cả radius token (`--bb-radius-none/sm/md/pill/card/button/input`) đều = `0` — đúng quy định “sharp industrial”.
- Spacing: thang 4px qua `--bb-space-2..20`.
- Shadow: 5 mức (sm/md/lg/brand/product/dropdown). `--bb-shadow-sm: none` đúng triết lý card phẳng.
- Motion: `--bb-duration-fast/normal/slow`, `--bb-ease-standard`.
- Z-index: header 200, dropdown 300, overlay 400, modal 500.

Đánh giá: **token foundation đầy đủ, đúng STYLEGUIDE.** Không có brand token “fantasy”.

### 1.3 shadcn primitives

Đã có (đếm trong [`components/ui/`](../../bigbike-web/components/ui/)): `accordion, badge, button, card, checkbox, dialog, dropdown-menu, form, input, label, popover, radio-group, select, separator, sheet, skeleton, tabs, textarea, tooltip` cộng custom: `EmptyState, ErrorState, LoadingGrid, MediaImage, PaginationNav, PriceText, RatingStars, Skeletons, VnAddressFields, BBTooltip`.

Tất cả primitive shadcn đã được map về brand:
- `Button` cva variants [`components/ui/button.tsx:6-37`](../../bigbike-web/components/ui/button.tsx#L6-L37): primary/secondary/outline/dark/ghost/link/destructive, đúng spec STYLEGUIDE (red primary, white secondary border red, blue outline, dark black, link blue). Radius `rounded-none` ngầm qua base. Min touch target 44px.
- `Input` [`components/ui/input.tsx`](../../bigbike-web/components/ui/input.tsx): `rounded-none`, `min-h-[48px]`, border-border, focus shadow `var(--bb-focus-ring)`, error state via `aria-invalid`.
- `Badge` [`components/ui/badge.tsx`](../../bigbike-web/components/ui/badge.tsx): 12 variants (sale/stock-in/stock-low/stock-out/preorder/info/warning/success…). State colors đi qua var(--bb-state-*-bg/text/border) — đúng token.
- `Select/Dialog/Sheet/Checkbox/Radio/Tabs/Accordion/Popover/Tooltip` đều có `rounded-none` và bám theme inline.
- `EmptyState`, `ErrorState` dùng Tailwind utility tokens (`bg-card`, `border-border`, `text-muted-foreground`, `text-foreground`) — pattern lý tưởng.

### 1.4 Lớp “WP parity” trong globals.css — gốc rễ vấn đề

[`app/globals.css`](../../bigbike-web/app/globals.css) 7 546 dòng, **1 728 selector**, 9 lệnh `!important`. Chia thành:
- Reset + tokens + base (acceptable scope theo §5.9).
- `.bb-*` (≈70 selector) — helper layer trung gian (card, kicker, query-input, skel, link…).
- `.wp-*` (≈1 600 selector) — port toàn bộ WordPress theme. Đây mới là body của globals.css.

`.wp-*` đang được consume trong **57 file** `.tsx` (grep `className=".*wp-"` đếm được **955 chỗ**). Bao gồm toàn bộ page chính: `app/page.tsx`, `app/product/[slug]/page.tsx`, `app/danh-muc-san-pham/[slug]/page.tsx`, `app/san-pham/page.tsx`, `app/gio-hang/page.tsx`, `app/thanh-toan/page.tsx`, `app/tai-khoan/**`, `app/tin-tuc/**`, `app/lien-he/page.tsx`, `app/not-found.tsx`, … và phần lớn `components/`.

Tương phản với mục tiêu §5.9:
> `globals.css` chỉ được chứa: design tokens; base/reset; shadcn overrides; những thứ Tailwind thật sự không làm được. **Không được thêm class mới vào `globals.css` chỉ vì muốn đặt tên ngắn — đó là lý do của Tailwind utility + `cn()`.**

Đây là vi phạm có hệ thống. Không phải vài chỗ lỡ tay — đây là **cách kiến trúc UI hiện tại**. Kết quả là toàn bộ visual của trang chủ, PDP, catalog, cart, checkout, account, blog, hero, mega-menu… không đến từ Tailwind/shadcn mà đến từ globals.css. Vô tình thì design system **kép**: brand-tokens.css (tốt) và một CSS framework WP-clone song song.

---

## 2. Quality gates

| Lệnh | Kết quả | Ghi chú |
|---|---|---|
| `npm run lint` | **0 error / 2 warning** | `app/thanh-toan/page.tsx:124` react-hooks/incompatible-library (RHF `watch()` — kỹ thuật, không phải UI). `scripts/verify-typography-computed.mjs:745` unused var. |
| `npx tsc --noEmit` | **PASS** (không stdout) | Type sạch. |
| `npm run test` (vitest) | **95 / 95 PASS** | 12 test files, 10.4s. |
| `npm run build` (Next 16 Turbopack) | **PASS** | Compile 7s, prerender 174 trang static, build hoàn tất. Warning: Sentry deprecation (kỹ thuật) + `SITE_ORIGIN=localhost` (env không phải UI) + cache item >2MB cho articles list (backend list page issue, ngoài scope UI). |

Verdict: code tests/types/build sạch. **Quality gate không che giấu vấn đề design system — vấn đề chỉ lộ khi nhìn trực quan + đọc CSS layer.**

---

## 3. Vấn đề phát hiện theo mức độ

> Quy ước: `[file:line]` trỏ vào evidence trực tiếp. P0 = phá UI hoặc vi phạm hard rule. P1 = lệch design system rõ ràng. P2 = polish / cleanup nhỏ.

### 3.1 P0 — Phá design system / vi phạm hard rule

#### P0-1. `globals.css` 7 546 dòng (1 728 selector) là tầng styling chính — vi phạm AGENTS §5.9
- **File**: [`app/globals.css`](../../bigbike-web/app/globals.css)
- **Bằng chứng**: `wc -l` = 7546. `grep -c '^\.[a-z]'` = 1728. `grep '!important'` = 9 chỗ. Class `.wp-*` được tham chiếu 955 lần trong 57 file `.tsx`.
- **Ảnh hưởng**: design system thực tế tồn tại 2 lớp song song (brand-tokens + Tailwind theme inline = lớp 1; toàn bộ `.wp-*` class definitions = lớp 2). Bất cứ thay đổi visual nào (đổi shadow, đổi spacing, đổi font weight) phải sửa 2 chỗ. Mục tiêu “một design system duy nhất” không đạt được khi mỗi page tiêu thụ CSS class riêng.
- **Đề xuất**: lên kế hoạch migration nhiều giai đoạn (KHÔNG fix trong lượt audit này): (1) inventory hoá `.wp-*` selector → mapping sang Tailwind utility; (2) chuyển từng surface (header, footer, product card, news card, hero, filters, checkout) sang Tailwind + shadcn variant; (3) xóa nhóm rule tương ứng trong `globals.css` sau khi xác nhận không còn consumer.

#### P0-2. Ba “Product Card” song song, không cùng một component
- **File**:
  - [`components/catalog/ProductCard.tsx`](../../bigbike-web/components/catalog/ProductCard.tsx) — class `wp-product-card` / `wp-product-image` / `wp-product-body` / `wp-product-price` / `wp-stock-badge`.
  - [`components/home/WpFeaturedProductCard.tsx`](../../bigbike-web/components/home/WpFeaturedProductCard.tsx) — class `wp-fp-item` / `wp-fp-thumb` / `wp-fp-cart` / `wp-fp-title` / `wp-fp-price-*`.
  - [`app/page.tsx:201-257`](../../bigbike-web/app/page.tsx#L201-L257) inline `FeaturedProductTile` — class `wp-tile-3` / `wp-tile-3-name` / `wp-tile-3-price-*` / `wp-tile-3-cta`.
- **Bằng chứng**: cùng dữ liệu `Product`, cùng vai trò (thẻ sản phẩm dẫn vào PDP), 3 layout + style khác nhau (size, ratio, hover, badge, add-to-cart).
- **Ảnh hưởng**: visual lệch giữa Listing / Featured / Home tile. Vi phạm AGENTS §5.9 “Cấm code lại component đã có” + §5.11 “Visual consistency”.
- **Đề xuất**: hợp nhất về 1 `ProductCard` shadcn-style với props variant (`compact`, `featured`, `tile`) thay vì 3 component class-CSS riêng. Có thể giữ lại tạm transitional, nhưng phải có roadmap.

#### P0-3. Native `<input type="radio">` cho filter — vi phạm AGENTS §5.9 “không dùng native khi shadcn có sẵn”
- **File**: [`components/catalog/CatalogFilters.tsx:184`](../../bigbike-web/components/catalog/CatalogFilters.tsx#L184), [`:228`](../../bigbike-web/components/catalog/CatalogFilters.tsx#L228), [`:234`](../../bigbike-web/components/catalog/CatalogFilters.tsx#L234), [`:330`](../../bigbike-web/components/catalog/CatalogFilters.tsx#L330) (color swatch).
- **Bằng chứng**:
  ```tsx
  <input type="radio" name="category" value="" defaultChecked={!current.category} />
  ```
- **Ảnh hưởng**: không có a11y wrapper của Radix RadioGroup, không có focus ring chuẩn, hover/focus visual phụ thuộc CSS bên ngoài. `components/ui/radio-group.tsx` đã tồn tại — vẫn không được dùng.
- **Đề xuất**: thay bằng `<RadioGroup>` + `<RadioGroupItem>` từ `components/ui/radio-group.tsx`; giữ submit qua form GET như hiện tại.

#### P0-4. Native `<input type="search">` ở 404 + raw `<input type="number">` ở filter
- **File**: [`app/not-found.tsx:44-50`](../../bigbike-web/app/not-found.tsx#L44-L50); [`components/catalog/CatalogFilters.tsx:260-269`](../../bigbike-web/components/catalog/CatalogFilters.tsx#L260-L269), [`:274-284`](../../bigbike-web/components/catalog/CatalogFilters.tsx#L274-L284).
- **Bằng chứng**:
  ```tsx
  <input type="search" name="q" placeholder="..." className="wp-404-search-input" />
  ```
- **Ảnh hưởng**: không reuse shadcn `Input` → focus ring + min-height + spacing lệch với mọi field khác trên site (login, register, checkout, contact, account đều dùng shadcn `Input`).
- **Đề xuất**: thay bằng `<Input type="search" />` / `<Input type="number" />`.

#### P0-5. Inline style + hardcoded px trong 34 file (221 occurrence)
- **File chính**:
  - [`components/ui/Skeletons.tsx`](../../bigbike-web/components/ui/Skeletons.tsx) — 77 lần `style={{}}` với raw px (`maxWidth: 1440`, `padding: "0 24px 64px"`, `gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))"`, `gap: 14`, `marginTop: 28`, `borderRadius: 0`, …).
  - [`app/tai-khoan/don-hang/[id]/page.tsx`](../../bigbike-web/app/tai-khoan/don-hang/[id]/page.tsx) — 26 inline-style.
  - [`app/tai-khoan/doi-tra/page.tsx`](../../bigbike-web/app/tai-khoan/doi-tra/page.tsx) — 30 inline-style.
  - [`app/tai-khoan/don-hang/page.tsx`](../../bigbike-web/app/tai-khoan/don-hang/page.tsx) — 14 inline-style.
  - [`app/tai-khoan/edit-address/[type]/page.tsx`](../../bigbike-web/app/tai-khoan/edit-address/[type]/page.tsx) — 12 inline-style.
  - [`app/thanh-toan/page.tsx`](../../bigbike-web/app/thanh-toan/page.tsx) — 12 inline-style.
- **Bằng chứng (samples)**:
  - `style={{ maxWidth: 1440, margin: "0 auto", padding: "0 24px 64px" }}` ở [`app/danh-muc-san-pham/page.tsx:72`](../../bigbike-web/app/danh-muc-san-pham/page.tsx#L72), [`app/brands/[slug]/page.tsx:214`](../../bigbike-web/app/brands/[slug]/page.tsx#L214), [`components/ui/Skeletons.tsx:389,415,442`](../../bigbike-web/components/ui/Skeletons.tsx#L389).
  - `style={{ height: 42, width: "100%", borderRadius: "var(--bb-radius-input)" }}` ở [`app/dang-nhap/page.tsx:115,117`](../../bigbike-web/app/dang-nhap/page.tsx#L115).
  - `style={{ fontSize: 11, color: "var(--bb-text-secondary)", fontWeight: 700, lineHeight: 1 }}` ở [`components/catalog/CatalogFilters.tsx:342`](../../bigbike-web/components/catalog/CatalogFilters.tsx#L342).
- **Ảnh hưởng**: spacing lệch tầng token (token chỉ có `--bb-space-2/3/4/5/6/8/10/12/15/16/20/section-y` — không có 14/22/28). Container max-width 1440px **mâu thuẫn** STYLEGUIDE `container 1200px`. Không cách nào đổi typography/spacing toàn site bằng cách sửa token nếu các giá trị đó được hard-code trong JSX.
- **Đề xuất**: thay inline-style bằng Tailwind utility (`max-w-screen-xl`, `px-4 sm:px-6 lg:px-8`, `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`, `gap-4`, `mt-7`…). Trường hợp cần biến dynamic (background-image, transform động, swatch hex từ data) là hợp lệ — giữ inline style nhưng kẹp trong utility container.

#### P0-6. `maxWidth: 1440` ở 5 chỗ mâu thuẫn STYLEGUIDE container 1200px
- **File**: [`app/danh-muc-san-pham/page.tsx:72`](../../bigbike-web/app/danh-muc-san-pham/page.tsx#L72), [`app/brands/[slug]/page.tsx:214`](../../bigbike-web/app/brands/[slug]/page.tsx#L214), [`components/ui/Skeletons.tsx:389,415,442`](../../bigbike-web/components/ui/Skeletons.tsx#L389-L442).
- **Bằng chứng**: token `--bb-container-xl: 75rem` = 1200px; STYLEGUIDE §Layout: “Container tối đa 1200px”. Các chỗ này đang dùng `maxWidth: 1440`.
- **Ảnh hưởng**: trên màn 1440+ những trang này rộng hơn so với mọi page khác đang dùng `.bb-container` (1200). Visual mép trái/phải khác nhau khi đi qua page.
- **Đề xuất**: thay bằng `.bb-container` hoặc `<div className="max-w-[var(--bb-container-xl)] mx-auto px-4 sm:px-6 lg:px-8">`.

### 3.2 P1 — Lệch design system rõ ràng

#### P1-1. Font size `13px` không có trong typography scale
- **File**: [`components/ui/PaginationNav.tsx:42,50,51`](../../bigbike-web/components/ui/PaginationNav.tsx#L42-L51); [`components/layout/SiteFooter.tsx:322`](../../bigbike-web/components/layout/SiteFooter.tsx#L322).
- **Bằng chứng**: `text-[13px]`. STYLEGUIDE scale: 12 (meta), 14 (sm), 16 (base), 18 (h3), 20 (xl), 24 (h2), 30 (hero), 32 (h1). Không có 13.
- **Ảnh hưởng**: pagination chữ to nhỏ so với badge/meta khác. Visual khó ăn khớp.
- **Đề xuất**: dùng `text-xs` (12) hoặc `text-sm` (14). Nếu thực sự cần 13, đưa lên token mới `--bb-text-13` để có thể audit.

#### P1-2. Font size `10px` ở badge — dưới ngưỡng `meta` 12px
- **File**: [`components/catalog/ProductTabs.tsx:59`](../../bigbike-web/components/catalog/ProductTabs.tsx#L59).
- **Bằng chứng**: `text-[10px]`.
- **Ảnh hưởng**: chữ nhỏ dưới scale, khó đọc trên mobile.
- **Đề xuất**: `text-xs` (12) là tối thiểu, hoặc dùng `Badge` shadcn với `min-h-[24px]`.

#### P1-3. Skeletons.tsx (974 dòng) mix `.bb-skel-*` + `.wp-*` + inline px + import shadcn `Card`
- **File**: [`components/ui/Skeletons.tsx`](../../bigbike-web/components/ui/Skeletons.tsx).
- **Bằng chứng**: file dùng `wp-product-card`, `wp-news-card`, `wp-fp-item`, `wp-cart-layout`, `wp-checkout-layout`, `wp-account-header`, `bb-skel-row`, `bb-skel-col`, `bb-skel-stack` (class CSS), `bb-skel--text/title/block/circle/btn/chip` (class CSS), inline `style={{}}` raw px (77 chỗ), và import `Card from "@/components/ui/card"` (chỉ ở `AuthSkeleton`).
- **Ảnh hưởng**: skeleton có cấu trúc bám theo `.wp-*` classes — khi migrate page sang Tailwind/shadcn, skeleton sẽ vỡ. Ngoài ra mỗi page skeleton dùng `maxWidth: 1440` → khác container thực tế (1200).
- **Đề xuất**: viết skeleton bằng shadcn `Skeleton` + Tailwind grid trùng layout production. Khoá ngầm skeleton = layout-mirror, không phải class-mirror.

#### P1-4. CSS file kèm theo có 9 `!important`
- **File**: [`app/globals.css:695,965,966,3269,3819,3934,4028,4056,4057`](../../bigbike-web/app/globals.css).
- **Bằng chứng**: 9 `!important`, 7 trong số đó liên quan layout list-reset / search shell / detail-note.
- **Ảnh hưởng**: dấu hiệu CSS specificity war. Khi shadcn override sẽ phải thêm `!important` nữa hoặc đụng độ.
- **Đề xuất**: đánh giá từng dòng, di chuyển thành utility `list-none m-0 p-0 …` trong JSX.

#### P1-5. Hardcoded hex `#1a1a1a / #f5f5f5 / #e02020 / #1d6fe8 / #6b7280 / #f97316 / #eab308` cho color filter
- **File**: [`components/catalog/CatalogFilters.tsx:78-85`](../../bigbike-web/components/catalog/CatalogFilters.tsx#L78-L85).
- **Bằng chứng**: mảng `COLOR_OPTIONS` chứa hex màu sản phẩm.
- **Ảnh hưởng**: ở mức “representational color của sản phẩm thực” — chấp nhận được. Nhưng `#e02020` (đỏ) và `#1d6fe8` (xanh) không khớp brand `#FF0C09` / `#007BFF`. Khi swatch đỏ rơi cạnh CTA đỏ thì lệch tone.
- **Đề xuất**: nâng thành `--bb-swatch-red / --bb-swatch-blue / …` để mọi nơi muốn show swatch dùng chung; canh lại tone cho gần brand (vẫn cho phép khác chính xác vì là “tag màu sản phẩm”).

#### P1-6. SVG inline icon thay vì sprite/icon library — không sai nhưng phình code
- **File**: rải rác (FloatingChat, SiteFooter, ProductCard, HeaderUserMenu, MobileHeaderMenu, …).
- **Bằng chứng**: `lucide-react` đã có trong dependencies (v1.14) nhưng grep `import { ... } from "lucide-react"` = **0 chỗ** trong `bigbike-web/components/`.
- **Ảnh hưởng**: mỗi icon SVG được copy raw — khó đảm bảo stroke-width / sizing đồng nhất (8/14/16/24px hiện đều có).
- **Đề xuất**: chuẩn hóa icon size bằng lucide-react (`<ShoppingCart size={20} />`) cho mọi icon utility. Giữ logo + brand icon (Zalo/Facebook/Messenger) raw.

#### P1-7. Hex `#fff` raw thay vì `bg-white` / `--bb-color-white`
- **File**: nhiều SVG inline trong [`components/home/FloatingChat.tsx`](../../bigbike-web/components/home/FloatingChat.tsx) (line 25, 42, 56, 67, 77).
- **Bằng chứng**: `fill="#fff"`, `stroke="#fff"`.
- **Ảnh hưởng**: hex trong SVG attribute không qua theme — chấp nhận được vì SVG attribute không lấy được `var()` ở mọi browser fallback. Để vậy được.
- **Đề xuất**: giữ — nhưng dùng `currentColor` rồi parent set color qua Tailwind nếu muốn theme hóa.

#### P1-8. Footer top-strip dùng `#3A3A3A` qua token `--bb-color-footer-top` nhưng inline style cũng có `bg-footer-top` không thấy dùng đồng nhất
- **File**: [`components/layout/SiteFooter.tsx`](../../bigbike-web/components/layout/SiteFooter.tsx).
- **Bằng chứng**: `--color-footer-top: var(--bb-color-footer-top)` ở `globals.css` đã được map sang Tailwind `bg-footer-top`. Cần xác minh footer sử dụng nhất quán (full file > 80 dòng).
- **Đề xuất**: scan thêm trong sprint cleanup.

#### P1-9. ProductCard duplicated với PriceText / RatingStars / WishlistButton / Stock state nhưng three variants không reuse logic
- **File**: 3 cards trong P0-2.
- **Bằng chứng**: cùng logic `mapStockState`, cùng logic discount %, cùng `RatingStars`, cùng `formatVnd`. Mỗi card lặp tự ghép lại.
- **Đề xuất**: tách hook `useProductPricing(product)` + 1 `ProductCard` variant prop.

#### P1-10. PageHero / hero block định nghĩa nhiều lần
- **File**: `components/layout/PageHero.tsx` (đã dùng) song song với `.wp-cat-hero`, `.wp-news-hero`, `.wp-article-header`, `.wp-hero-fallback` trong `globals.css` được consume rải rác.
- **Bằng chứng**: grep `wp-cat-hero`, `wp-news-hero`, `wp-article-header` cho 14 chỗ ở trang catalog / news / article. PageHero tồn tại nhưng không phải canonical.
- **Ảnh hưởng**: header hero của 4 surface có 4 visual khác nhau.
- **Đề xuất**: hợp nhất qua `PageHero` shadcn-style với prop `variant`: `category | news | article | static`.

### 3.3 P2 — Polish / Cleanup

- **P2-1.** `app/page.tsx:217,478,478,454,471` inline style `display: "block"`, `textDecoration: "none"`, `position: "relative"` → Tailwind `block`, `no-underline`, `relative`. (5 chỗ).
- **P2-2.** `app/dang-nhap/page.tsx:113` inline `<div style={{ height: 8 }} />` → `h-2`.
- **P2-3.** `components/catalog/CatalogFilters.tsx:339` inline `style={opt.hex ? { background: opt.hex } : undefined}` — hợp lệ (dynamic color) nhưng `aria-hidden=true` nên dùng `<span style={{ '--swatch': hex }} className="bg-[var(--swatch)] …">` để dễ override.
- **P2-4.** `aria-busy="true"` skeleton ngoài cùng OK, nhưng skeleton item cũng nên có `aria-hidden="true"` đồng đều (Skeletons.tsx có nhưng không nhất quán).
- **P2-5.** Sentry deprecation warning (`disableLogger`, `automaticVercelMonitors`) — kỹ thuật, không UI.
- **P2-6.** `[routes] SITE_ORIGIN is "http://localhost:3000"` build warning — env config, không UI.
- **P2-7.** RHF `watch()` không memo (lint warning) — không UI nhưng cần fix riêng.
- **P2-8.** `next/font/google` (Barlow + Oswald + Barlow Condensed) load đầy đủ weights — kiểm tra weights thực dùng để giảm payload (Oswald 400/500/600/700 = 4 file; Barlow 300/400/500/600/700 = 5 file; Barlow Condensed 400/500/600/700 = 4 file). Tổng 13 font file.
- **P2-9.** Article list backend trả >2MB → Next data cache fail. Cần phân trang server-side.
- **P2-10.** `app/[slug]/page.tsx:80` inline style dùng var() đúng nhưng nên gom vào Tailwind utility class (`text-muted-foreground text-xs mt-4`).

---

## 4. Component / page tuân thủ tốt

| Component / Page | Lý do |
|---|---|
| [`components/ui/button.tsx`](../../bigbike-web/components/ui/button.tsx) | Variant đầy đủ, brand-aligned, focus ring qua token, min touch 44px. |
| [`components/ui/badge.tsx`](../../bigbike-web/components/ui/badge.tsx) | 12 variants với state token (success/warning/danger). |
| [`components/ui/input.tsx`](../../bigbike-web/components/ui/input.tsx), [`textarea.tsx`](../../bigbike-web/components/ui/textarea.tsx), [`select.tsx`](../../bigbike-web/components/ui/select.tsx), [`checkbox.tsx`](../../bigbike-web/components/ui/checkbox.tsx) | Đúng shadcn, focus ring `--bb-focus-ring`, aria-invalid state, error style nền `--bb-color-red-50`. |
| [`components/ui/dialog.tsx`](../../bigbike-web/components/ui/dialog.tsx), [`sheet.tsx`](../../bigbike-web/components/ui/sheet.tsx), [`tooltip.tsx`](../../bigbike-web/components/ui/tooltip.tsx), [`popover.tsx`](../../bigbike-web/components/ui/popover.tsx) | Radix wrapper đầy đủ, overlay `--bb-overlay-modal`. |
| [`components/ui/EmptyState.tsx`](../../bigbike-web/components/ui/EmptyState.tsx), [`ErrorState.tsx`](../../bigbike-web/components/ui/ErrorState.tsx) | 100% Tailwind utility + token, không có class `.wp-*` / `.bb-empty-*` raw — pattern lý tưởng. |
| [`app/bao-hanh/page.tsx`](../../bigbike-web/app/bao-hanh/page.tsx) | Trang mới, dùng `<Input>`, `<Button>`, `<Badge variant="…">` đầy đủ. Sạch. |
| [`app/error.tsx`](../../bigbike-web/app/error.tsx) | Layout sạch dùng `bb-page` + `bb-error-state` + `Button`. |
| `styles/brand-tokens.css` | Tokens chia 4 lớp (primitive → semantic → layout → motion) — đúng best-practice. |

---

## 5. Pattern nên chuẩn hóa thành shared component / token

1. **`ProductCard` shadcn duy nhất** với props: `variant: "compact" | "featured" | "tile"`, `data: Product`, `wishlistDisabled`, `hideAddBar`. Thay thế cả 3 component hiện tại.
2. **`PageHero`** mở rộng variant `category | news | article | static | error` để dẹp `.wp-cat-hero`, `.wp-news-hero`, `.wp-article-header`.
3. **`Container`** primitive (`bb-container` đã có nhưng chưa nhất quán): React component `<Container size="xl|md">` để dẹp `maxWidth: 1440` raw.
4. **`StockBadge`** một chỗ duy nhất (đang lặp giữa ProductCard, FeaturedProductTile, PDP, OrderItem).
5. **`SectionHeader`** (kicker + h2 + “Xem tất cả →”) — hiện được lặp tay ở home, PDP, catalog với class `wp-section-head`, `wp-pdp-related-header`.
6. **Token mới**:
   - `--bb-text-13` nếu nhất quyết giữ 13px; nếu không thì xoá hết `text-[13px]`.
   - `--bb-swatch-*` cho 7 màu sản phẩm filter, kèm map sang “tên” swatch.
   - `--bb-icon-size-xs/sm/md/lg` (14/16/20/24) để đồng bộ icon SVG inline.
7. **Skeleton lưới**: viết lại `Skeletons.tsx` để mirror Tailwind grid của page, bỏ inline px.
8. **Icon system**: chấp nhận lucide-react cho icon utility, giữ raw SVG cho logo + brand icon.

---

## 6. Điểm chưa thể kết luận vì thiếu docs/source

| Mục | Lý do thiếu |
|---|---|
| Đối chiếu với UI kit prototype gốc (`Bigbike Design System/ui_kits/website/`) | Thư mục **không tồn tại** trong working tree. |
| Đối chiếu visual với BIGBIKE_BRANDGUIDELINE.pdf | PDF 23 trang, tool không đọc trực tiếp; AGENTS ghi rõ. |
| Background color decision (light vs dark) | STYLEGUIDE đã chốt light-first (Track B WP-parity) — đối chiếu với `BIGBIKE_WEB_BACKGROUND_COLOR_AUDIT.md` cần thêm sprint riêng. |
| Mobile parity với `bigbike_mobile/` | Flutter app cùng API nhưng UI hệ riêng — ngoài scope. |
| 8 swatch màu filter có khớp tag màu admin nhập không | Cần đối chiếu với backend `productColors` enum (data contract). |
| Hero slider performance trên 4G (LCP) | Audit hiện tại không chạy Lighthouse/CWV. |

---

## 7. Kết luận tổng

**Mức độ thống nhất design system của `bigbike-web` hiện tại: Chưa đạt** — cụ thể: **Trung bình lệch về phía Chưa đạt**.

- **Đạt**: token foundation + shadcn primitive layer. Đây là phần “móng” đúng và đẹp.
- **Chưa đạt**: tầng consumer (page + composite component). Toàn bộ surface chính đang chạy bằng class CSS `.wp-*` định nghĩa trong `globals.css` — về bản chất là một **WordPress theme port song song với Tailwind design system**. Hệ quả:
  - Mỗi thay đổi visual phải đụng 2 chỗ (token + class definition).
  - Có 3 product card, 3-4 hero block, nhiều skeleton hardcode 1440px container.
  - 221 chỗ inline-style với px raw — không track được qua token.
  - Còn native HTML primitive (`<input type=radio/number/search>`) lẽ ra phải dùng shadcn.

Build PASS, lint PASS, test PASS — quality gate hiện không bắt được vấn đề. Phải có quy ước CSS/Tailwind/grep gate (ESLint plugin / Stylelint) để chặn drift mới.

---

## 7b. Fix đã thực hiện ngay sau audit (2026-05-13)

Các fix nhỏ, không đụng business logic, đã được áp dụng + verify qua lint/tsc/test/build:

| # | Vấn đề | File sửa | Thay đổi |
|---|---|---|---|
| 1 | P0-6 maxWidth 1440 lệch container 1200 | `app/danh-muc-san-pham/page.tsx:72` | `style={{maxWidth:1440,…}}` → `className="bb-container pb-16"` |
| 2 | P0-6 + inline-style card | `app/brands/[slug]/page.tsx:214-222` | wrapper + inner card sang Tailwind utility |
| 3 | P0-6 trong skeleton | `components/ui/Skeletons.tsx:389` (CategoryListSkeleton) | `style maxWidth:1440` → `className="bb-container pb-16"` |
| 4 | P0-6 trong skeleton | `components/ui/Skeletons.tsx:415` (BrandListSkeleton) | `style maxWidth:1440` → `className="bb-container"` |
| 5 | P0-6 trong skeleton | `components/ui/Skeletons.tsx:442` (BrandDetailSkeleton) | `style maxWidth:1440` → `className="bb-container mb-6"` |
| 6 | P1-1 text-[13px] không có trong scale | `components/ui/PaginationNav.tsx:42,50,51` | `text-[13px]` → `text-sm` (3 chỗ) |
| 7 | P1-1 text-[13px] | `components/layout/SiteFooter.tsx:322` | `text-[13px]` → `text-sm` |
| 8 | P1-2 text-[10px] dưới ngưỡng meta | `components/catalog/ProductTabs.tsx:59` | `text-[10px]` → `text-xs` |
| 9 | P0-4 (partial) native `<input type=search>` | `app/not-found.tsx:7,44-50` | thêm import `Input` từ `components/ui/input`; thay `<input>` → `<Input>` |

Verify sau khi sửa:
- `npx tsc --noEmit`: PASS (no output).
- `npm run lint`: 0 errors / 2 warnings (đều pre-existing, không liên quan).
- `npm run test`: 12/12 file, 95/95 test PASS.
- `npm run build`: PASS (174 trang static, không error mới).

Không thực hiện trong lượt này (rủi ro lớn hoặc cần thiết kế / sprint riêng): P0-1 (globals.css 7546 dòng), P0-2 (hợp nhất 3 ProductCard), P0-3 + nửa P0-4 ở CatalogFilters (đụng form GET behavior), P0-5 (221 inline-style), P1-3 (refactor 974-line Skeletons.tsx), P1-10 (hợp nhất PageHero variants), P1-9 (hợp nhất ProductCard pricing logic).

---

## 8. Danh sách ưu tiên fix (đề xuất, không thực hiện trong audit này)

1. **(P0-1, lớn nhất)** Thiết kế migration plan cho `globals.css` → Tailwind. Inventory `.wp-*` selector và mapping. Làm theo surface (header → footer → product card → catalog → PDP → cart → checkout → account → blog → static).
2. **(P0-2)** Hợp nhất 3 product card thành 1 component shadcn + variants.
3. **(P0-3, P0-4)** Đổi tất cả `<input type="radio|number|search">` còn lại sang shadcn primitives (`RadioGroup`, `Input`).
4. **(P0-6)** Đổi 5 chỗ `maxWidth: 1440` về `--bb-container-xl` (1200).
5. **(P0-5)** Refactor `Skeletons.tsx` 974 dòng → Tailwind grid + shadcn `Skeleton`.
6. **(P1-1, P1-2)** Loại bỏ `text-[10px]`, `text-[13px]`; chuẩn hóa scale.
7. **(P1-5)** Đưa 7 swatch color filter thành CSS token.
8. **(P1-10, P1-9)** Hợp nhất PageHero + ProductCard variants (giảm 30-40% duplicate trong components/).
9. **(P1-4)** Review từng `!important` trong globals.css, dọn theo migration.
10. **(P1-6)** Đưa icon utility về `lucide-react` để đồng bộ stroke-width/size.
11. **(P2-1..3)** Cleanup inline-style raw px sang Tailwind utility.
12. **(P2-7, P2-9)** Fix RHF watch() memo + Article list backend pagination.
13. Thêm guard chống drift: ESLint rule cấm `style={{...}}` ngoài whitelist file, Stylelint cấm thêm class `.wp-*` mới trong globals.css.

---

## 9. Quality gate kết quả (chi tiết)

```text
$ npm run lint
0 errors / 2 warnings
- app/thanh-toan/page.tsx:124  react-hooks/incompatible-library (RHF watch())
- scripts/verify-typography-computed.mjs:745  unused var "err"

$ npx tsc --noEmit
PASS (no output)

$ npm run test
Test Files  12 passed (12)
Tests       95 passed (95)
Duration    10.39s

$ npm run build
✓ Compiled successfully in 7.0s
✓ Generating static pages using 15 workers (174/174)
PASS — Next 16.2.4 Turbopack production build complete.

Warnings (none design-system related):
- Sentry: disableLogger / automaticVercelMonitors deprecated
- SITE_ORIGIN env = http://localhost:3000 (set NEXT_PUBLIC_SITE_URL)
- /api/v1/articles >2MB → next data cache miss
```

---

## 10. Quick Reference — vi phạm hard rule có evidence trực tiếp

| Rule (source) | Vi phạm | Evidence |
|---|---|---|
| AGENTS §5.9 “globals.css không được thêm class mới khi Tailwind đủ” | 1 728 selector `.bb-*/.wp-*` trong [`app/globals.css`](../../bigbike-web/app/globals.css) consume bởi 57 file `.tsx` (955 lần) | `wc -l app/globals.css` = 7546; `grep -c '^\.[a-z]'` = 1728 |
| AGENTS §5.9 “Cấm dùng native `<select>/<input type=checkbox/radio>` khi shadcn có” | 4× `<input type="radio">` filter + 2× `<input type="number">` + 1× `<input type="search">` | [`CatalogFilters.tsx:184,228,234,260,274`](../../bigbike-web/components/catalog/CatalogFilters.tsx), [`not-found.tsx:44`](../../bigbike-web/app/not-found.tsx) |
| AGENTS §5.9 “Cấm tạo component mới khi component tương đương đã tồn tại” | 3 ProductCard variants | `ProductCard.tsx`, `WpFeaturedProductCard.tsx`, `app/page.tsx FeaturedProductTile` |
| AGENTS §5.11 “Container max-width 1200px” | 5 chỗ `maxWidth: 1440` | [`danh-muc-san-pham/page.tsx:72`](../../bigbike-web/app/danh-muc-san-pham/page.tsx#L72), [`brands/[slug]/page.tsx:214`](../../bigbike-web/app/brands/[slug]/page.tsx#L214), [`Skeletons.tsx:389,415,442`](../../bigbike-web/components/ui/Skeletons.tsx) |
| AGENTS §5.11 “Spacing thang 4px, không arbitrary px khi Tailwind step đủ” | 221 inline-style với px raw trong 34 file | `grep style={{ --include="*.tsx"` |
| AGENTS §5.11 “Typography scale Tailwind, không arbitrary `text-[13px]`” | `text-[13px]` x3, `text-[10px]` x1 | [`PaginationNav.tsx:42,50,51`](../../bigbike-web/components/ui/PaginationNav.tsx), [`SiteFooter.tsx:322`](../../bigbike-web/components/layout/SiteFooter.tsx), [`ProductTabs.tsx:59`](../../bigbike-web/components/catalog/ProductTabs.tsx) |
| AGENTS §5.11 “Border radius 0 mặc định” | ✅ tuân thủ — `rounded-none` xuyên suốt, không có `rounded-md/lg/xl` ngoài shadcn primitive base | — |

---

*Hết audit.*
