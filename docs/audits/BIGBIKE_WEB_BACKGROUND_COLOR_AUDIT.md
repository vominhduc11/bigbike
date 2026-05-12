# BigBike Web — Background Color Audit (vs `bigbike_vn__2026_04_17`)

> Ngày audit: 2026-05-12
> Phạm vi: toàn bộ `bigbike-web` (Next.js) vs theme WordPress cũ `bigbike_vn__2026_04_17` (theme slug `bigbike`).
> Tác giả: Claude (read-only audit, không sửa code).
>
> **Lưu ý quan trọng trước khi đọc tiếp:** trong `bigbike-web/STYLEGUIDE.md` (mục "Nguyên Tắc Bắt Buộc", dòng 13) — và tài liệu nguồn `DESIGN.md` mà file đó dẫn — có một quyết định thiết kế ghi rõ:
>
> > "Theme — Dark-first, nền chính `#000000`, bề mặt tương phản mạnh"
>
> Tức là `bigbike-web` đã **chủ động** chọn dark theme, không phải bug. Báo cáo này chỉ đối chiếu fact giữa 2 dự án; phần "đề xuất sửa" được tách thành 2 nhánh (giữ dark vs quay về WP parity) để user quyết định.

---

## 1. Executive Summary

**Kết luận:** **LỆCH NHIỀU.** `bigbike-web` đang chạy **dark-first** (nền chính `#000000`) trong khi WordPress tham chiếu chạy **light-first** (nền body `#ffffff`, header đen, footer đen-xám).

**Mức độ rủi ro UI/brand:** **MEDIUM**.
- Không phải bug code (đã có quyết định thiết kế `STYLEGUIDE.md` chọn dark).
- Nhưng nếu mục tiêu là "khớp với WP cũ" thì gần như **toàn bộ page-level surface** đang lệch.
- Các surface "lá" (product card, login card, account sidebar, checkout summary, contact map placeholder) phần lớn vẫn trắng — vì vậy người dùng WP cũ vẫn nhận ra brand.

**Tổng số finding:**

| Severity | Số lượng |
|---|---:|
| P0 (toàn site / brand chính) | 1 |
| P1 (homepage / product / detail / footer) | 12 |
| P2 (section phụ) | 9 |
| P3 (cleanup token / hard-code) | 6 |

**Quyết định cần từ user trước khi sửa:**

1. (A) Giữ dark-first theo `STYLEGUIDE.md` → audit này đóng vai trò "doc the intentional diff". Cập nhật `STYLEGUIDE.md` để ghi rõ là **không** parity với WP. **Không sửa code.**
2. (B) Đổi về light-first cho khớp WP → xem **Section 7 (Recommended Fix Plan, Track B)**. Đây là refactor lớn vì rải qua ~50 chỗ.

---

## 2. Color Palette Comparison

> WP-side trace: `bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/style.css` + 4 file minified `dist/{home,product-category,product-page,general-page}.css` (extract bằng `awk RS="}"` rồi grep `background`).
> Next-side trace: `bigbike-web/styles/brand-tokens.css` + `bigbike-web/app/globals.css` (9267 dòng) + scan các `.tsx` cho `style={{ background … }}`.

| Surface | WP `bigbike_vn__2026_04_17` | bigbike-web hiện tại | Trạng thái |
|---|---|---|---|
| **Body (page)** | `#ffffff` — `body{...;background-color:#fff}` (style.css L472, dist/home.css L72, product-category L72, product-page L72, general-page L72) | `#000000` — `body{background:var(--bb-bg-page)}` ([globals.css:18](../../bigbike-web/app/globals.css#L18)) + `--bb-bg-page: var(--bb-color-black)` ([brand-tokens.css:69](../../bigbike-web/styles/brand-tokens.css#L69)) | ❌ **Lệch trục theme** |
| **Header** | `#000000` — `header{...;background:#000;height:80px}` (dist/home.css L20-area + main.css) | `#000000` — `.wp-header{background:#000}` ([globals.css:1457-1469](../../bigbike-web/app/globals.css#L1457-L1469)) | ✅ Match |
| **Footer top** | `#3a3a3a` — `footer .top{background:#3a3a3a;padding:60px 0}` | `#3a3a3a` — `.bb-footer{background:#3a3a3a}` ([globals.css:45-49](../../bigbike-web/app/globals.css#L45-L49)) | ✅ Match |
| **Footer bottom (dải đen)** | `#000000` — `footer .foot{background:#000;padding:30px 0;color:#fff}` | Không có dải bottom đen riêng; `.bb-footer-bottom` chỉ là `border-top: 1px solid rgba(255,255,255,0.08)` ([globals.css:77-79](../../bigbike-web/app/globals.css#L77-L79)) | ⚠️ **Lệch nhẹ** — thiếu band đen 30px dưới cùng |
| **Sub-menu header (desktop)** | `#ffffff` — `.sub-menu{background-color:#fff;box-shadow:...}` | `rgba(22, 22, 22, 0.97)` ≈ `#161616` ([globals.css:1795](../../bigbike-web/app/globals.css#L1795)) | ❌ Lệch |
| **Mobile nav drawer** | `#000000` — `.container .navigation{background-color:#000}` | `#0d0d0d` — `.wp-mobile-menu{background:#0d0d0d}` ([globals.css:2107](../../bigbike-web/app/globals.css#L2107)) | ⚠️ Gần đúng (đậm hơn 1 step) |
| **User toggle menu** | `#ffffff` — `.user-control--item.user .toogle-menu{background-color:#fff}` | Dark — `rgba(10, 10, 10, 0.92)` ([globals.css:612](../../bigbike-web/app/globals.css#L612)) | ❌ Lệch trục |
| **Search overlay (full)** | Bar đen + form input đen trong suốt, fixed top 80px ngay dưới header — `header .user-control--item.search form{background-color:#000}` | Dark theme, search container `var(--bb-bg-page)` (black) ([globals.css:491](../../bigbike-web/app/globals.css#L491)) | ✅ Match (cùng đen) |
| **Breadcrumb** | Transparent — `.breadcrumb{background:0 0}` | Transparent (chỉ set padding, text color) ([globals.css:4382-4385](../../bigbike-web/app/globals.css#L4382-L4385)) | ✅ Match |
| **Page-title banner** | image cover, no solid bg — `.page-title{background-repeat:no-repeat;background-size:cover;margin-bottom:90px}` | `#0d0d0d` solid khi không có hero image — `.wp-cat-hero{background:#0d0d0d}` ([globals.css:4402](../../bigbike-web/app/globals.css#L4402)) | ⚠️ Lệch khi không có ảnh |
| **Product card** | `#ffffff` — woocommerce default + `.product .product--item` không override; chỉ `.product .desc{background-color:#f8f8f8}` | `var(--bb-bg-surface)` = `#ffffff` ([globals.css:4231](../../bigbike-web/app/globals.css#L4231)) | ✅ Match |
| **Product description block** | `#f8f8f8` — `.product .desc{background-color:#f8f8f8;padding:30px}` (product-category + product-page) | Không có selector tương ứng; phần spec dùng `.wp-pdp-features{background:#141414}` ([globals.css:4737](../../bigbike-web/app/globals.css#L4737)) | ❌ Lệch — WP xám sáng, BB-web đen |
| **Category card homepage** | `#ffffff` (forced) — `.category-list .item{background:#fff!important;border:solid 1px #cecece}` (override default `#f2f2f2`) | `#ffffff` — `.wp-cat-list-item{background:var(--bb-color-white)}` ([globals.css:3719](../../bigbike-web/app/globals.css#L3719)) | ✅ Match |
| **About section (homepage)** | (WP không có khối about riêng — content xếp trên body trắng) | `#101010` + gradient đỏ — `.wp-about{background:linear-gradient(135deg,rgba(255,12,9,0.16),...) , #101010}` ([globals.css:2756-2766](../../bigbike-web/app/globals.css#L2756-L2766)) | ❌ Lệch trục (BB-web phát minh khối dark mới) |
| **Experience section** | (WP đặt trên body trắng) | `#000000` — `.wp-experience{background:var(--bb-bg-page)}` ([globals.css:3012-3015](../../bigbike-web/app/globals.css#L3012-L3015)) | ❌ Lệch trục |
| **News section (homepage)** | (WP đặt trên body trắng, news card trắng) | `#000000` — `.wp-news-section--home{background:var(--bb-bg-page)}` ([globals.css:6555-6558](../../bigbike-web/app/globals.css#L6555-L6558)) | ❌ Lệch trục; card vẫn trắng ✓ |
| **Video section** | `.videos-slide--inner-item-desc{background:#000}` — chỉ desc đen; outer trên body trắng | `#111` outer — `.wp-video-section ...{background:#111}` ([globals.css:6330](../../bigbike-web/app/globals.css#L6330)) | ⚠️ Lệch trục (WP để trắng, BB-web để dark) |
| **Brands section** | (WP đặt trên body trắng; brand chip white) | `var(--bb-bg-page)` = `#000000` — `.wp-brands-section{background:var(--bb-bg-page)}` ([globals.css:7202](../../bigbike-web/app/globals.css#L7202)); `.wp-brand-chip{background:#141414}` ([globals.css:4273](../../bigbike-web/app/globals.css#L4273)) | ❌ Lệch trục |
| **SEO content (bottom)** | `#f8f8f8` — `.content-bottom{background-color:#f8f8f8;padding:60px 0}` (general-page) | `#000000` — `.wp-seo-content{background:var(--bb-bg-page)}` ([globals.css:4075-4078](../../bigbike-web/app/globals.css#L4075-L4078)) | ❌ Lệch trục (xám sáng → đen) |
| **Promo banner image** | (woocommerce image link, no bg) | `var(--bb-bg-surface)` = `#ffffff` — `.wp-promo-banner-image{background:var(--bb-bg-surface)}` ([globals.css:1860-1862](../../bigbike-web/app/globals.css#L1860-L1862)) | ⚠️ N/A (BB-web tự thiết kế) |
| **Promo banner fallback** | (n/a) | gradient đỏ `linear-gradient(135deg, #c00 0%, #8b0000 100%)` ([globals.css:2957](../../bigbike-web/app/globals.css#L2957)) | N/A |
| **Cart / Checkout form section** | `#ffffff` (woocommerce default, body trắng) | `#141414` — `.wp-checkout-section{background:#141414}` ([globals.css:5214](../../bigbike-web/app/globals.css#L5214)) | ❌ Lệch trục |
| **Checkout title bar** | (woocommerce headings, body trắng) | `var(--bb-color-gray-50)` = `#f5f5f5` — `.wp-checkout-title-bar{background:var(--bb-color-gray-50)}` ([globals.css:7629-7631](../../bigbike-web/app/globals.css#L7629-L7631)) | ⚠️ Khác cấu trúc; xám sáng vẫn ở "phía light" |
| **Checkout summary card** | `#ffffff` (sidebar woocommerce) | `#ffffff` — `.wp-summary-card{background:#fff}` ([globals.css:5187](../../bigbike-web/app/globals.css#L5187)) | ✅ Match |
| **Order summary (checkout)** | `#ffffff` | `#141414` — `.wp-order-summary{background:#141414}` ([globals.css:5248](../../bigbike-web/app/globals.css#L5248)) | ❌ Lệch |
| **My account sidebar** | `#ffffff` + shadow — `.my-account-sidebar{background:#fff;box-shadow:0 0 6px rgba(0,0,0,.16)}` | `#ffffff` — `.wp-account-sidebar{background:#fff}` ([globals.css:5263](../../bigbike-web/app/globals.css#L5263)) | ✅ Match |
| **My account user header** | (woocommerce) | `#f8f8f8` — `.wp-account-user{background:#f8f8f8}` ([globals.css:5264](../../bigbike-web/app/globals.css#L5264)) | ✅ Match (giống WP `.product .desc`) |
| **Order card (account)** | `#ffffff` body + `rgba(0,0,0,.05)` zebra — `.woocommerce-orders-table tbody tr:nth-of-type(odd){background-color:rgba(0,0,0,.05)}` | `#141414` — `.wp-order-card{background:#141414}` + head `#0d0d0d` ([globals.css:5309-5310](../../bigbike-web/app/globals.css#L5309-L5310)) | ❌ Lệch trục |
| **Order detail drawer** | (n/a — WP không có drawer này) | `#111` — `.wp-detail-panel{background:#111}` ([globals.css:5334](../../bigbike-web/app/globals.css#L5334)) | N/A |
| **Login / Register card** | `#ffffff` — woocommerce account form + `.user-activity .login{max-width:370px}` (no bg, body trắng) | `#ffffff` — `.bb-auth-wrap .bb-card{background:#fff}` ([globals.css:1303-1308](../../bigbike-web/app/globals.css#L1303-L1308)) | ✅ Match (card riêng), nhưng ngồi trên page `#000` thay vì `#fff` |
| **Input field** | `#ffffff` + `1px solid #ccc` — `input[type="text"]{...;border:1px solid #ccc}` | `#ffffff` — `.bb-input{background:var(--bb-color-white)}` ([brand-tokens.css:485](../../bigbike-web/styles/brand-tokens.css#L485)) | ✅ Match |
| **Filter sidebar (catalog)** | `#ffffff` — `.product-list-filter{background-color:#fff}` | Border-right trắng mờ; inputs `#0d0d0d` ([globals.css:4470, 4485](../../bigbike-web/app/globals.css#L4470)) | ❌ Lệch — WP sidebar trắng, BB-web để dark theo body |
| **Mobile filter drawer** | `#ffffff` — `.sidebar-wrap-product .wrapper-product{background-color:#fff}` | Phụ thuộc context drawer — không có rule riêng; nhiều input dùng `#0d0d0d` | ❌ Lệch |
| **Filter sort select** | `#ffffff` — `.product-list-filter .form-group.form-select select{background-color:#fff}` | `#ffffff` — `.wp-catalog-sort select{background:#fff}` ([globals.css:4564](../../bigbike-web/app/globals.css#L4564)) | ✅ Match |
| **Product thumb strip nav** | (woocommerce gallery) | `#ffffff` — `.wp-pdp-strip-nav{background:var(--bb-bg-surface, #fff)}` ([globals.css:4572](../../bigbike-web/app/globals.css#L4572)) | ✅ Match (gallery) |
| **Product main image** | (woocommerce gallery, `#fff` body) | radial-gradient `#ffffff → #e2e2e2` — `.wp-pdp-main{...}` ([globals.css:4579](../../bigbike-web/app/globals.css#L4579)) | ✅ Match (sáng) |
| **Product gallery thumb** | `#ffffff` | `#ffffff` — `.wp-pdp-thumb{background:#fff}` ([globals.css:4640](../../bigbike-web/app/globals.css#L4640)) | ✅ Match |
| **Product variant chip** | size selected: `#000` w/ white text — `.product-information .size .group .form-group input:checked+label{background-color:#000;color:#fff}` | `.wp-pdp-chip{background:#202020}` ([globals.css:4657](../../bigbike-web/app/globals.css#L4657)) | ⚠️ Gần đúng |
| **Toast** | (n/a — toastr.min.css default) | `#141414` — `.wp-toast{background:#141414}` ([globals.css:4374](../../bigbike-web/app/globals.css#L4374)) | N/A |
| **Review form** | (woocommerce comment form, body trắng) | `#141414` — `.wp-review-form{background:#141414}` ([globals.css:4337](../../bigbike-web/app/globals.css#L4337)) | ❌ Lệch |
| **Recently viewed card** | (n/a) | `#141414` outer + `#0e0e0e` img — `.wp-pdp-recently-card / -img` ([globals.css:4307-4311](../../bigbike-web/app/globals.css#L4307-L4311)) | N/A |
| **Article (news) widget** | `#ffffff` + border (sidebar woocommerce / archive) | `#ffffff` — `.wp-article-widget{background:#fff}` ([globals.css:5718](../../bigbike-web/app/globals.css#L5718)) | ✅ Match |
| **Contact map placeholder** | (n/a — WP nhúng iframe Google) | `#f2f2f2` — `.wp-contact-map-full{background:#f2f2f2}` ([globals.css:5634](../../bigbike-web/app/globals.css#L5634)) | ✅ Tương đương xám sáng |
| **About brand cell** | (n/a) | `#ffffff` — `.wp-about-brand-cell{background:#fff}` ([globals.css:5662](../../bigbike-web/app/globals.css#L5662)) | ✅ Sáng |
| **About quality tile** | (n/a) | `#f8f8f8` — `.wp-about-quality-tile{background:#f8f8f8}` ([globals.css:5673](../../bigbike-web/app/globals.css#L5673)) | ✅ Sáng |

**Tổng kết palette:**

- BB-web giữ đúng WP cho: **header, footer top, breadcrumb, product card, login card, my-account sidebar, input, gallery thumb, sort select, category card homepage, article widget, search overlay**.
- BB-web **lệch trục theme** ở: **body, sub-menu, user dropdown, các section homepage (about/experience/news/video/brands/seo), product description block, filter sidebar, checkout section, order card, order summary, review form, page-title fallback**.

---

## 3. File-by-file Findings

> Severity gán theo: **P0** = ảnh hưởng toàn site / trục brand; **P1** = page chính (home/product/detail/header/footer); **P2** = section phụ; **P3** = cleanup token / hard-code.

### BG-001 · P0 · Body / page background lệch trục dark↔light

- File: [bigbike-web/styles/brand-tokens.css:69-71](../../bigbike-web/styles/brand-tokens.css#L69-L71) + [bigbike-web/app/globals.css:17-24](../../bigbike-web/app/globals.css#L17-L24)
- Hiện tại: `--bb-bg-page: var(--bb-color-black)` = `#000000`; `body{background:var(--bb-bg-page)}`.
- WP tham chiếu: `body{background:#fff}` (style.css:472 + dist/home.css + dist/product-category.css + dist/product-page.css + dist/general-page.css — đồng nhất).
- Component bị ảnh hưởng: **toàn site** — mọi page wrapper kế thừa qua `--bb-bg-page` (`.wp-home`, `.bb-page`, `.wp-experience`, `.wp-news-section--home`, `.wp-brands-section`, `.wp-seo-content`).
- Ảnh hưởng: nếu mục tiêu là parity với WP cũ, đây là sai cấp 1 — tất cả những finding bên dưới đều là **hệ quả** của quyết định này.
- Đề xuất: xem **Section 7** — quyết định Track A (giữ dark, doc lại) hoặc Track B (đổi `--bb-bg-page` sang `--bb-color-white`).

### BG-002 · P1 · Footer thiếu dải đen 30px dưới cùng

- File: [bigbike-web/app/globals.css:44-79](../../bigbike-web/app/globals.css#L44-L79)
- Hiện tại: `.bb-footer{background:#3a3a3a}`; `.bb-footer-bottom` chỉ có `border-top: 1px solid rgba(255,255,255,0.08)` — toàn footer là 1 màu xám.
- WP: `footer .top{background:#3a3a3a;padding:60px 0}` + `footer .foot{background:#000;padding:30px 0;color:#fff}` — 2 dải rõ rệt.
- Ảnh hưởng: footer mất khối tách kép → nhìn ngắn hơn WP, mất "anchor" copyright bar đen.
- Đề xuất: thêm `.bb-footer-bottom { background: #000; }` (chỉ background, không động border).

### BG-003 · P1 · Sub-menu desktop nền đen thay vì trắng

- File: [bigbike-web/app/globals.css:1795](../../bigbike-web/app/globals.css#L1795)
- Hiện tại: `rgba(22, 22, 22, 0.97)` ≈ `#161616` (dark gần đen).
- WP: `header .navigation ul .navigation--item .sub-menu{background-color:#fff;box-shadow:0,0,0,.16}` — trắng có shadow.
- Component: dropdown của menu chính trên desktop khi hover một item top-level.
- Ảnh hưởng: WP user thấy lạ — sub-menu trắng nhẹ → giờ thành đen tối.
- Đề xuất: chỉ đổi nếu Track B.

### BG-004 · P1 · User toggle menu (account dropdown) nền đen thay vì trắng

- File: [bigbike-web/app/globals.css:612](../../bigbike-web/app/globals.css#L612)
- Hiện tại: `rgba(10, 10, 10, 0.92)` (gần đen).
- WP: `header .user-control--item.user .toogle-menu{background-color:#fff;...}` — trắng có shadow.
- Component: dropdown khi click icon user trên header.
- Ảnh hưởng: WP sáng, BB-web tối.
- Đề xuất: chỉ đổi nếu Track B.

### BG-005 · P1 · Mobile nav drawer `#0d0d0d` thay vì `#000`

- File: [bigbike-web/app/globals.css:2107](../../bigbike-web/app/globals.css#L2107)
- Hiện tại: `#0d0d0d`.
- WP: `.container .navigation{background-color:#000}` — đen tuyệt đối.
- Ảnh hưởng: rất nhẹ; mắt thường khó phân biệt.
- Đề xuất: đổi sang `#000` (1 dòng) — cùng trục dark, parity tốt hơn.

### BG-006 · P1 · Homepage section "About" tự tạo block dark

- File: [bigbike-web/app/globals.css:2756-2766](../../bigbike-web/app/globals.css#L2756-L2766) + [app/page.tsx:359-411](../../bigbike-web/app/page.tsx#L359-L411)
- Hiện tại: `.wp-about{background: linear-gradient(135deg, rgba(255,12,9,0.16),...) , #101010; ... color:#fff}`.
- WP: không có section "about" tách riêng — content được render bên trong khối woocommerce / page builder, ngồi trên `body{background:#fff}`.
- Ảnh hưởng: BB-web tạo khối dark gradient mới, không tồn tại trong WP.
- Đề xuất: nếu Track B → trả về nền `#fff` hoặc `#f8f8f8`; nếu Track A → giữ.

### BG-007 · P1 · Homepage section "Experience" toàn dark

- File: [bigbike-web/app/globals.css:3012-3015](../../bigbike-web/app/globals.css#L3012-L3015)
- Hiện tại: `background: var(--bb-bg-page)` = `#000`.
- WP: section đặt trên body trắng; carousel item desc đỏ + image cover.
- Đề xuất: Track B → bỏ override `background`; để section inherit body trắng.

### BG-008 · P1 · Homepage section "News" toàn dark

- File: [bigbike-web/app/globals.css:6555-6558](../../bigbike-web/app/globals.css#L6555-L6558)
- Hiện tại: `.wp-news-section--home{background: var(--bb-bg-page); padding: 72px 0 88px}` — đen.
- WP: news section trên body trắng, card trắng (`.news--item-thumbnail`).
- Lưu ý: card vẫn trắng (BB-web có `.wp-news-section--home .wp-news-card{background:var(--bb-bg-surface)}` ở [globals.css:6596-6608](../../bigbike-web/app/globals.css#L6596-L6608)) — chỉ outer là đen.
- Đề xuất: Track B → bỏ `background` để fallback về body trắng.

### BG-009 · P1 · Video section outer `#111`

- File: [bigbike-web/app/globals.css:6326-6336](../../bigbike-web/app/globals.css#L6326-L6336)
- Hiện tại: `.wp-video-section` outer `#111`.
- WP: `.videos-slide--inner-item-desc{background:#000}` (chỉ desc đen); outer trên body trắng.
- Đề xuất: Track B → outer body trắng, chỉ giữ desc card `#000`.

### BG-010 · P1 · Brands section trên page đen

- File: [bigbike-web/app/globals.css:7202](../../bigbike-web/app/globals.css#L7202) + chip [globals.css:4273](../../bigbike-web/app/globals.css#L4273)
- Hiện tại: `.wp-brands-section{background:var(--bb-bg-page)}` = đen; `.wp-brand-chip{background:#141414}`.
- WP: brands grid trắng/transparent trên body trắng.
- Đề xuất: Track B → outer trắng, chip `#fff` border `#cecece`.

### BG-011 · P1 · SEO content bottom đen thay vì xám sáng

- File: [bigbike-web/app/globals.css:4075-4108](../../bigbike-web/app/globals.css#L4075-L4108) + [globals.css:7205-7207](../../bigbike-web/app/globals.css#L7205-L7207)
- Hiện tại: `.wp-seo-content{background:var(--bb-bg-page); border-top: 1px solid var(--bb-border-subtle);}`.
- WP: `.content-bottom{background-color:#f8f8f8;padding:60px 0}` (general-page) + `.seo-block-content .content-block{padding:30px;background-color:#f8f8f8}`.
- Đề xuất: Track B → `background: #f8f8f8`, đổi text color sang `#000`/`var(--bb-text-inverse)`.

### BG-012 · P1 · Product description block thiếu khối xám `#f8f8f8`

- File: [bigbike-web/app/globals.css:4737](../../bigbike-web/app/globals.css#L4737)
- Hiện tại: `.wp-pdp-features{background:#141414; border:1px solid rgba(255,255,255,0.08); color:#fff}` (đen).
- WP: `.product .desc{background-color:#f8f8f8; padding:30px}` (product-category + product-page) — khối xám sáng nổi trên body trắng.
- Đề xuất: Track B → đổi `#f8f8f8` + chữ đen.

### BG-013 · P1 · Filter sidebar tổng thể đen

- File: catalog filters inputs: [globals.css:4470](../../bigbike-web/app/globals.css#L4470), [4485](../../bigbike-web/app/globals.css#L4485), [4536](../../bigbike-web/app/globals.css#L4536); layout: [globals.css:4446](../../bigbike-web/app/globals.css#L4446)
- Hiện tại: inputs `#0d0d0d`, color dot `#1a1a1a`; sidebar không có background riêng → kế thừa body đen.
- WP: `.product-list-filter{background-color:#fff;z-index:2!important}` — sidebar trắng.
- Đề xuất: Track B → background trắng cho `.wp-filters-v2` + inputs trắng.

### BG-014 · P1 · Mobile filter drawer thiếu nền trắng

- WP: `.sidebar-wrap-product .wrapper-product{background-color:#fff}` — drawer trắng.
- BB-web: không tìm thấy rule riêng cho mobile drawer; kế thừa body đen.
- Đề xuất: Track B → thêm `.wp-mobile-filter-drawer { background: #fff; color: #000; }`.

### BG-015 · P1 · Page-title hero fallback đen khi không có ảnh

- File: [bigbike-web/app/globals.css:4402](../../bigbike-web/app/globals.css#L4402)
- Hiện tại: `.wp-cat-hero{background:#0d0d0d}` (khi banner image trống).
- WP: `.page-title{background-repeat:no-repeat;background-size:cover;margin-bottom:90px}` — không set màu solid; khi không có ảnh → trắng theo body.
- Đề xuất: Track B → bỏ `background:#0d0d0d` để fallback về body trắng (hoặc đổi `#f8f8f8`).

### BG-016 · P2 · Checkout section block `#141414`

- File: [globals.css:5214](../../bigbike-web/app/globals.css#L5214)
- WP checkout: card trắng trên body trắng.
- Đề xuất: Track B → `#fff` + border `#e4e4e4`.

### BG-017 · P2 · Order summary `#141414`

- File: [globals.css:5248](../../bigbike-web/app/globals.css#L5248)
- WP: `#fff`.
- Đề xuất: Track B → `#fff`.

### BG-018 · P2 · Radio tile thanh toán `#0d0d0d`

- File: [globals.css:5232](../../bigbike-web/app/globals.css#L5232), [5310](../../bigbike-web/app/globals.css#L5310), [5362](../../bigbike-web/app/globals.css#L5362), [5500](../../bigbike-web/app/globals.css#L5500)
- WP: radio tile không có rule, mặc định trắng trên body trắng.
- Đề xuất: Track B → `#f8f8f8` cho tile chưa chọn, `#fff`+border đỏ khi chọn.

### BG-019 · P2 · KPI / address / order cards `#141414`

- Files: [globals.css:5286, 5309-5310, 5373, 5393](../../bigbike-web/app/globals.css#L5286)
- WP: account content trắng trên body trắng; zebra `rgba(0,0,0,.05)` cho hàng table.
- Đề xuất: Track B → `#fff` + border `#e4e4e4`; zebra `rgba(0,0,0,.04)`.

### BG-020 · P2 · Recently viewed cards `#141414`/`#0e0e0e`

- File: [globals.css:4307-4311](../../bigbike-web/app/globals.css#L4307-L4311)
- WP không có feature "recently viewed" → không có baseline.
- Đề xuất: nếu Track B → đổi `#fff` cho card outer, `#f4f4f4` cho image fallback; nếu Track A → giữ.

### BG-021 · P2 · Review form `#141414`

- File: [globals.css:4337](../../bigbike-web/app/globals.css#L4337)
- WP: form review woocommerce trắng.
- Đề xuất: Track B → `#fff`.

### BG-022 · P2 · Order detail drawer `#111`

- File: [globals.css:5334](../../bigbike-web/app/globals.css#L5334)
- WP không có drawer này.
- Đề xuất: Track B → `#fff` + border `#e4e4e4`.

### BG-023 · P2 · Toast `#141414`

- File: [globals.css:4374](../../bigbike-web/app/globals.css#L4374)
- WP dùng toastr default (trắng/red).
- Đề xuất: low priority — giữ.

### BG-024 · P2 · About section CTA tile `#fff` (đã đúng) nhưng outer dark

- File: [globals.css:2756](../../bigbike-web/app/globals.css#L2756)
- Tile bên trong đúng (white `.wp-about-quality-tile{#f8f8f8}` ở [5673](../../bigbike-web/app/globals.css#L5673)).
- Vấn đề: outer `.wp-about` `#101010` không khớp WP.
- Đề xuất: gộp với BG-006.

### BG-025 · P3 · Hard-code `#141414` lặp ~10 lần

- Files & dòng:
  - [globals.css:629](../../bigbike-web/app/globals.css#L629) `.bb-category-card`
  - [globals.css:4273](../../bigbike-web/app/globals.css#L4273) `.wp-brand-chip`
  - [globals.css:4307](../../bigbike-web/app/globals.css#L4307) `.wp-pdp-recently-card`
  - [globals.css:4337](../../bigbike-web/app/globals.css#L4337) `.wp-review-form`
  - [globals.css:4374](../../bigbike-web/app/globals.css#L4374) `.wp-toast`
  - [globals.css:4638](../../bigbike-web/app/globals.css#L4638) `.wp-pdp-video-thumb`
  - [globals.css:4737](../../bigbike-web/app/globals.css#L4737) `.wp-pdp-features`
  - [globals.css:5214](../../bigbike-web/app/globals.css#L5214) `.wp-checkout-section`
  - [globals.css:5248](../../bigbike-web/app/globals.css#L5248) `.wp-order-summary`
  - [globals.css:5286](../../bigbike-web/app/globals.css#L5286) `.wp-kpi`
  - [globals.css:5309](../../bigbike-web/app/globals.css#L5309) `.wp-order-card`
  - [globals.css:5373](../../bigbike-web/app/globals.css#L5373) `.wp-address-card`
  - [globals.css:5393](../../bigbike-web/app/globals.css#L5393) `.wp-success .order-card`
- Đề xuất P3: thêm token `--bb-bg-surface-dark: #141414` vào `brand-tokens.css`, thay toàn bộ; điều này giúp dù chọn Track A hay Track B đều dễ swap về sau.

### BG-026 · P3 · Hard-code `#0d0d0d` lặp ~7 lần

- Files & dòng:
  - [globals.css:2107](../../bigbike-web/app/globals.css#L2107) `.wp-mobile-menu`
  - [globals.css:4402](../../bigbike-web/app/globals.css#L4402) `.wp-cat-hero`
  - [globals.css:4470](../../bigbike-web/app/globals.css#L4470), [4485](../../bigbike-web/app/globals.css#L4485) `.wp-filter-search`, `.wp-filter-price-input`
  - [globals.css:5180](../../bigbike-web/app/globals.css#L5180) `.wp-promo-input input`
  - [globals.css:5200](../../bigbike-web/app/globals.css#L5200) `.wp-summary-trust div`
  - [globals.css:5232](../../bigbike-web/app/globals.css#L5232) `.wp-radio-tile`
  - [globals.css:5310](../../bigbike-web/app/globals.css#L5310) `.wp-order-head`
  - [globals.css:5362](../../bigbike-web/app/globals.css#L5362) `.wp-order-actions`
- Đề xuất P3: thêm token `--bb-bg-surface-dark-2: #0d0d0d`.

### BG-027 · P3 · Hard-code `#1a1a1a` ở chip nhỏ

- Files: [globals.css:4536](../../bigbike-web/app/globals.css#L4536), [5296](../../bigbike-web/app/globals.css#L5296), [5492](../../bigbike-web/app/globals.css#L5492), [8784](../../bigbike-web/app/globals.css#L8784)
- Đã có `--bb-color-dark: #1a1a1a` trong [brand-tokens.css:34](../../bigbike-web/styles/brand-tokens.css#L34) — nhưng không được dùng.
- Đề xuất P3: thay 4 chỗ trên thành `var(--bb-color-dark)`.

### BG-028 · P3 · `#f8f8f8` lặp 4 lần — đã có `--bb-color-gray-50: #f5f5f5` rất gần

- Files dùng `#f8f8f8`: [globals.css:5264](../../bigbike-web/app/globals.css#L5264), [5673](../../bigbike-web/app/globals.css#L5673), [5762-5764](../../bigbike-web/app/globals.css#L5762-L5764)
- Token gần nhất: `--bb-color-gray-50: #f5f5f5` ([brand-tokens.css:38](../../bigbike-web/styles/brand-tokens.css#L38)).
- WP gốc dùng `#f8f8f8` (product description, content-bottom).
- Đề xuất P3: hoặc thêm `--bb-color-gray-25: #f8f8f8` để khớp WP, hoặc thống nhất `--bb-color-gray-50: #f8f8f8` (chú ý đụng các nơi đang dùng gray-50).

### BG-029 · P3 · Hard-code `#3a3a3a` chỉ ở footer

- File: [globals.css:47](../../bigbike-web/app/globals.css#L47)
- Có comment "exact value #3a3a3a from main.css".
- Đề xuất P3: thêm `--bb-color-footer-top: #3a3a3a` để rõ ý đồ.

### BG-030 · P3 · `bb-card` color conflict trắng-trên-trắng

- File: [globals.css:399-409](../../bigbike-web/app/globals.css#L399-L409)
- `.bb-card { background: ... var(--bb-bg-surface); color: var(--bb-text-primary); }` — surface trắng + text primary trắng.
- Hệ quả thực tế: bị che vì có các selector cụ thể hơn (vd `.bb-auth-wrap .bb-card`) override; nhưng nếu một component nào đó dùng đúng `.bb-card` mặc định thì sẽ trắng/trắng.
- Đề xuất P3: đổi `color: var(--bb-text-inverse);` hoặc bỏ rule color (để theme chọn).

---

## 4. Page Coverage Matrix

| Page / Component | Đã kiểm tra | Background hiện tại (BB-web) | Background tham chiếu (WP) | Trạng thái | Ghi chú |
|---|---|---|---|---|---|
| Root layout `body` | ✓ | `#000` ([globals.css:18](../../bigbike-web/app/globals.css#L18)) | `#fff` (style.css:472) | **Mismatch** | BG-001 |
| Header `.wp-header` | ✓ | `#000` | `#000` | Match | |
| Header sub-menu desktop | ✓ | `#161616` (semi) | `#fff` | **Mismatch** | BG-003 |
| User account dropdown | ✓ | `#0a0a0a` (semi) | `#fff` | **Mismatch** | BG-004 |
| Search overlay | ✓ | `#000` | `#000` | Match | |
| Mobile nav drawer | ✓ | `#0d0d0d` | `#000` | Lệch nhẹ | BG-005 |
| Footer top | ✓ | `#3a3a3a` | `#3a3a3a` | Match | |
| Footer bottom band | ✓ | (không có) | `#000` 30px | **Mismatch** | BG-002 |
| Breadcrumb | ✓ | transparent | transparent | Match | |
| Homepage hero slider | ✓ | image / fallback dark | image / no solid | Match (visual gần) | |
| Homepage Featured 3-grid | ✓ | tile gradient dark | tile dark (WP `.product--item-cart` slide-up đen) | Match | |
| Homepage About section | ✓ | `#101010` + gradient đỏ | (n/a — block không tồn tại trong WP) | **N/A diverged** | BG-006 |
| Homepage Category list | ✓ | `#fff` items | `#fff!important` items | Match | |
| Homepage Promo banner image | ✓ | `#fff` | (n/a — woocommerce banner) | Match | |
| Homepage Experience section | ✓ | `#000` | trắng | **Mismatch** | BG-007 |
| Homepage News section | ✓ | `#000` outer, `#fff` card | trắng outer, `#fff` card | **Mismatch outer**, card OK | BG-008 |
| Homepage Video section | ✓ | `#111` outer | trắng outer, `#000` desc card | **Mismatch outer** | BG-009 |
| Homepage Brands section | ✓ | `#000` outer, `#141414` chip | trắng outer, `#fff` chip | **Mismatch** | BG-010 |
| Homepage SEO content bottom | ✓ | `#000` | `#f8f8f8` | **Mismatch** | BG-011 |
| Product listing `.bb-page` | ✓ | `#000` | `#fff` | **Mismatch** | BG-001 hệ quả |
| Product listing filter sidebar | ✓ | dark (kế thừa) | `#fff` | **Mismatch** | BG-013 |
| Product listing mobile filter drawer | ✓ | dark (kế thừa) | `#fff` | **Mismatch** | BG-014 |
| Product listing sort select | ✓ | `#fff` | `#fff` | Match | |
| Product listing product card | ✓ | `#fff` (surface) | `#fff` | Match | |
| Product listing pagination | ✓ | inherit (text on dark) | trên trắng | **Visual mismatch** | hệ quả BG-001 |
| Product detail page wrapper | ✓ | `#000` | `#fff` | **Mismatch** | hệ quả BG-001 |
| Product detail main image | ✓ | radial `#fff→#e2e2e2` | trắng (woocommerce) | Match (sáng) | |
| Product detail thumb strip | ✓ | `#fff` thumbs | `#fff` | Match | |
| Product detail price row | ✓ | trên page đen (border `#e4e4e4`) | trên page trắng | **Visual mismatch** | |
| Product detail features (spec) | ✓ | `#141414` | `#f8f8f8` | **Mismatch** | BG-012 |
| Product detail tabs | ✓ | transparent border `rgba(255,255,255,0.08)` | tabs trên trắng + `#cecece` | **Mismatch** | hệ quả BG-001 |
| Product detail related section | ✓ | dark wrapper | trên trắng | **Mismatch** | hệ quả BG-001 |
| Product detail recently viewed | ✓ | `#141414` cards | (n/a) | N/A | BG-020 |
| Product detail review form | ✓ | `#141414` | trắng | **Mismatch** | BG-021 |
| Cart page | ✓ | `#000` page, mostly grid white | trắng | **Mismatch outer** | hệ quả BG-001 |
| Checkout page wrapper | ✓ | `#000` | `#fff` | **Mismatch** | hệ quả BG-001 |
| Checkout section block | ✓ | `#141414` | `#fff` | **Mismatch** | BG-016 |
| Checkout title bar | ✓ | `#f5f5f5` | (woocommerce headings) | Tương đương | |
| Checkout radio tile | ✓ | `#0d0d0d` | `#fff` | **Mismatch** | BG-018 |
| Checkout summary card | ✓ | `#fff` | `#fff` | Match | |
| Checkout order summary | ✓ | `#141414` | `#fff` | **Mismatch** | BG-017 |
| Login page | ✓ | `#000` page + `#fff` card | `#fff` page + `#fff` card | **Mismatch outer**, card OK | hệ quả BG-001 |
| Register page | ✓ | giống login | giống login | **Mismatch outer** | hệ quả BG-001 |
| Forgot password | ✓ | giống login | giống login | **Mismatch outer** | hệ quả BG-001 |
| Account dashboard | ✓ | `#000` page + `#fff` sidebar + `#141414` KPI/cards | `#fff` page + `#fff` sidebar | **Mismatch outer + KPI** | BG-019 |
| Account orders list | ✓ | `#141414` order cards | `#fff` table + zebra `rgba(0,0,0,.05)` | **Mismatch** | BG-019 |
| Account order detail (drawer) | ✓ | `#111` drawer | (n/a — WP không có drawer này) | N/A | BG-022 |
| Account orders detail page `[id]` | ✓ | `#141414` blocks | trang dedicated trắng | **Mismatch** | BG-019 |
| Account returns | △ chưa đọc file riêng | giả định theo pattern `wp-account` | giả định trắng | **Need visual verification** | |
| Address book | ✓ | `#141414` cards | `#fff` | **Mismatch** | BG-019 |
| Contact `/lien-he` | ✓ (component `ContactForm.tsx`) | success banner: `var(--bb-brand-primary-soft)`; map `#f2f2f2` | trắng + iframe map | Map OK; outer page **mismatch** | hệ quả BG-001 |
| About `/gioi-thieu` | ✓ (brand cells + tiles) | `#fff` cells, `#f8f8f8` tiles | trắng | Inner OK; outer **mismatch** | hệ quả BG-001 |
| Policy pages `/chinh-sach` | △ chưa đọc riêng | `wp-content` rich text, page wrapper `#000` | trắng | **Mismatch outer** | hệ quả BG-001 |
| Warranty / Help pages | △ chưa đọc riêng | giả định pattern static | trắng | **Need visual verification** | |
| News listing | ✓ | `#fff` widget + page `#000` | trắng | **Mismatch outer** | hệ quả BG-001 |
| News detail | △ chưa đọc riêng | dùng `bb-richtext` + page `#000` | trắng | **Mismatch outer** | hệ quả BG-001 |
| Brand page `[slug]` | △ chưa đọc file | brand chips `#141414` | trắng | **Mismatch** | BG-010 |
| Category page `[slug]` | △ chưa đọc file | dùng `wp-cat-layout` + `bb-page` đen | trắng | **Mismatch outer** | hệ quả BG-001 |
| Search page | ✓ | search dropdown `rgba(10,10,10,0.92)` + chip `#1a1a1a` | trên đen (search bar) | Match | |
| Error 404 / Error boundary | △ chưa đọc | `bb-page` đen | trắng | **Mismatch outer** | hệ quả BG-001 |
| Email verify `/xac-nhan-email` | △ chưa đọc | dùng `bb-auth-wrap` | trắng | **Mismatch outer**, card OK | hệ quả BG-001 |

**Note:** các dòng có `△` ("chưa đọc riêng"): suy luận từ pattern wrapper chung (`bb-page`, `bb-container`, `bb-card`) — không phải kết luận chắc. Cần visual QA bằng dev server để confirm.

---

## 5. Responsive Verification

Kiểm tra rule background trong các media query của `globals.css`:

- **Desktop (≥992px):** body `#000`, header `#000`, footer `#3a3a3a`, các section homepage dark. Lệch trục như mô tả ở Section 2.
- **Tablet (576-991px):** không có rule background thay đổi theo breakpoint cho body / page wrapper. Section padding chỉnh nhỏ lại ([globals.css:3320, 3324, 3379](../../bigbike-web/app/globals.css#L3320)) nhưng background giữ nguyên. → Lệch theo cùng pattern desktop.
- **Mobile (<576px):** tương tự, không có override background. `.wp-mobile-menu` `#0d0d0d` chỉ hiện ≤767px (BG-005).
- **Sticky header state:** `html[data-header-hidden]` chỉ translate transform, không đổi color ([globals.css:1472-1474](../../bigbike-web/app/globals.css#L1472-L1474)) → match WP `headroom` plugin behavior.
- **Header scrolled:** `html[data-header-scrolled]` cũng không đổi background ([globals.css:4393](../../bigbike-web/app/globals.css#L4393)) → match WP `header.active` chỉ thêm overlay `#000` trên right-header (`header.active .right-header:after{background:#000}`) — BB-web không port logic này, nhưng vì header đã đen sẵn nên kết quả visual giống.
- **Hover/focus/active states:** đã trace, hover product card `box-shadow` + border, không đổi background outer. Match WP.

**Kết luận responsive:** vấn đề background lệch trục là **đồng đều mọi breakpoint**, không có rò rỉ chỉ-mobile hay chỉ-desktop. → fix 1 lần ở token level sẽ phủ tất cả.

---

## 6. Hard-coded Color Audit

`globals.css` có **89 lượt** dùng hex literal cho `background` / `background-color` (đã đếm bằng awk). Phân bố:

| Hex | Số lần | Mục đích | Token đã tồn tại? | Đề xuất |
|---|---:|---|---|---|
| `#000` / `#000000` | ~15 | header, mobile drawer, footer band, button hover | `--bb-color-black` ([brand-tokens.css:33](../../bigbike-web/styles/brand-tokens.css#L33)) | Thay thành `var(--bb-color-black)` |
| `#fff` / `#ffffff` | ~12 | card, surface, auth, account sidebar | `--bb-color-white` ([brand-tokens.css:48](../../bigbike-web/styles/brand-tokens.css#L48)) | Thay thành `var(--bb-color-white)` hoặc `var(--bb-bg-surface)` |
| `#141414` | ~13 | dark cards (brand chip, recently, review form, order, kpi, address, success, checkout section, order summary, video thumb, features, toast) | **Chưa có** | Thêm `--bb-bg-surface-dark: #141414` (BG-025) |
| `#0d0d0d` | ~9 | mobile menu, cat-hero, filter inputs, promo input, summary trust, radio tile, order head/actions | **Chưa có** | Thêm `--bb-bg-surface-dark-2: #0d0d0d` (BG-026) |
| `#0e0e0e` | 1 | recently viewed img placeholder | **Chưa có** | gộp với `#0d0d0d` |
| `#0a0a0a` | 2 | pdp video embed, search footer | **Chưa có** | gộp với `#0d0d0d` |
| `#111` | 2 | video section, detail drawer | **Chưa có** | gộp với `#0d0d0d` |
| `#1a1a1a` | 4 | filter color dot, order tl dot, search chip, dòng 8784 | `--bb-color-dark` ([brand-tokens.css:34](../../bigbike-web/styles/brand-tokens.css#L34)) đã có | Thay `var(--bb-color-dark)` (BG-027) |
| `#191919`, `#252525`, `#202020` | 3-4 | about mark, recently fallback, pdp chip | **Chưa có** | tạo `--bb-color-dark-3 .. -5` hoặc gom |
| `#3a3a3a` | 1 | footer top | **Chưa có** | Thêm `--bb-color-footer-top` (BG-029) |
| `#f8f8f8` | 4 | account user header, quality tile, error banner | gần `--bb-color-gray-50: #f5f5f5` | Thêm `--bb-color-gray-25: #f8f8f8` (BG-028) |
| `#f2f2f2` | 3 | contact map, article widget thumb | **Chưa có** | Thêm `--bb-color-gray-75` |
| `#f4f4f4` | 1 | strip nav hover | **Chưa có** | gộp với `#f5f5f5` |
| `#f5f5f5` | (đã token) | checkout title bar | `--bb-color-gray-50` đã có | OK |
| `#dddddd` | 1 | dòng 8712 (skeleton?) | `--bb-color-gray-200: #dddddd` đã có ([brand-tokens.css:40](../../bigbike-web/styles/brand-tokens.css#L40)) | Thay token |
| `#cecece` | 1 | dòng 6376 (pagination?) | `--bb-color-gray-300: #cecece` đã có ([brand-tokens.css:41](../../bigbike-web/styles/brand-tokens.css#L41)) | Thay token |
| `#c00`, `#8b0000` | 2 | promo banner gradient | Brand red `--bb-color-red-700: #cc0906` gần | Cân nhắc dùng |
| `#a50064`, `#005ba4`, `#1877f2`, `#0068ff` | 4 | momo, vnpay, fb, zalo logos | brand bên thứ 3 — giữ nguyên | |
| `#00bfff`, `#0099cc` | 2 | chat button | `--bb-color-cyan / -hover` đã có | Thay token |
| `#fef2f2` | 1 | error banner soft | `--bb-color-red-50: #fff4f3` gần | cân nhắc |

`.tsx` hardcoded backgrounds: chỉ **2 chỗ** dùng `style={{ background: ... }}`:

1. [components/contact/ContactForm.tsx:73](../../bigbike-web/components/contact/ContactForm.tsx#L73) — `var(--bb-brand-primary-soft)` (đã dùng token, OK).
2. [components/home/ExperienceCarousel.tsx:265](../../bigbike-web/components/home/ExperienceCarousel.tsx#L265) — `linear-gradient(135deg, #c00, #8b0000)` (gradient promo, fine vì thuộc style component).
3. [app/tai-khoan/don-hang/[id]/page.tsx:459](../../bigbike-web/app/tai-khoan/don-hang/[id]/page.tsx#L459) — `var(--c-danger, #ef4444)` (token chưa tồn tại, fallback `#ef4444`). → P3: tạo `--bb-state-danger-strong` hoặc dùng `var(--bb-brand-primary)`.

`backgroundColor` trong inline style: **0 chỗ**. Tốt — không có hard-code rải rác.

Tailwind utilities `bg-*`: **0 chỗ** trong toàn repo. Tốt — đã ép qua `globals.css`.

---

## 7. Recommended Fix Plan

> **Quyết định gốc:** chọn 1 trong 2 track. Không hỗn hợp.

### Track A — Giữ Dark-First (theo `STYLEGUIDE.md`)

Nếu user khẳng định brand đã chuyển sang dark-first và `bigbike_vn__2026_04_17` chỉ là dữ liệu lịch sử:

1. **(P0/P3)** Cập nhật [bigbike-web/STYLEGUIDE.md](../../bigbike-web/STYLEGUIDE.md) thêm 1 dòng:
   > "BigBike-web là **dark-first**, không parity màu với theme WordPress `bigbike` cũ. Các pixel-perfect comparison với WP chỉ giữ ở: header, footer top, breadcrumb, product card surface, login card."
2. **(P1)** Thêm dải `.bb-footer-bottom { background: #000; }` để khôi phục band 30px đen (BG-002) — đây là detail brand WP giữ được.
3. **(P1)** Đổi `.wp-mobile-menu` từ `#0d0d0d` → `#000` (BG-005) — khớp WP đen tuyệt đối.
4. **(P3 cleanup)** Bổ sung tokens cho dark surfaces (BG-025, BG-026, BG-027) để tránh hard-code rải:
   ```css
   --bb-bg-surface-dark: #141414;     /* card, panel */
   --bb-bg-surface-dark-2: #0d0d0d;   /* inset, input */
   --bb-color-dark-5: #111;           /* drawer outer */
   --bb-color-footer-top: #3a3a3a;
   ```
   sau đó thay `find/replace` trong `globals.css` tại các selector đã liệt kê BG-025/026.
5. **(P3)** Sửa `.bb-card` color conflict (BG-030).
6. **(P3)** Thay 4 chỗ `#1a1a1a` thành `var(--bb-color-dark)` (BG-027).

**Effort:** ~1-2 giờ; rủi ro thấp; không thay đổi visual đáng kể.

---

### Track B — Quay về Light-First (parity với WP)

Nếu user yêu cầu khớp WP:

**Bước 1 — Token (atomic, 1 file):**

[bigbike-web/styles/brand-tokens.css:69-75](../../bigbike-web/styles/brand-tokens.css#L69-L75) đổi:

```css
--bb-bg-page: var(--bb-color-white);       /* was --bb-color-black */
--bb-bg-section: var(--bb-color-white);    /* was --bb-color-black */
--bb-bg-inverse: var(--bb-color-black);    /* keep */
--bb-text-primary: var(--bb-color-black);  /* was --bb-color-white */
--bb-text-secondary: var(--bb-color-gray-700);
--bb-text-inverse: var(--bb-color-white);
--bb-text-inverse-secondary: var(--bb-color-gray-300);
```

⚠️ Mệt phần này — `--bb-text-primary` đảo sẽ làm bể chữ trên các surface dark cố định (header, footer, mobile drawer). Buộc phải đánh dấu các header/footer scope ngược.

**Bước 2 — Scoped dark surfaces (giữ đen rõ ràng):**

```css
.wp-header,
.bb-footer,
.wp-mobile-menu,
.wp-mobile-menu-overlay,
.wp-search-overlay { color: var(--bb-color-white); }
```

**Bước 3 — Fix từng section (theo Findings):**

| Selector | Đổi `background` thành | Nguồn |
|---|---|---|
| `.wp-home` | bỏ override (inherit body trắng) | BG-001 hệ quả |
| `.wp-about` | `#f8f8f8` hoặc `#fff` + border subtle, **bỏ gradient đỏ** | BG-006 |
| `.wp-experience` | `var(--bb-color-white)` | BG-007 |
| `.wp-news-section--home` | bỏ override `background` (inherit trắng) | BG-008 |
| `.wp-video-section` outer + `.wp-video-section-inner` | trắng; chỉ `.videos-slide--inner-item-desc` giữ `#000` | BG-009 |
| `.wp-brands-section` | trắng; `.wp-brand-chip` → `#fff` + `1px solid #cecece` | BG-010 |
| `.wp-seo-content` | `#f8f8f8` (nay là `--bb-color-gray-25` mới) + chữ `#000` | BG-011 |
| `.wp-pdp-features` | `#f8f8f8` + chữ `#000` | BG-012 |
| `.wp-cat-hero` | bỏ `#0d0d0d` solid; nếu không có ảnh, để fallback ảnh placeholder hoặc gradient sáng | BG-015 |
| `.wp-filters-v2`, mobile filter drawer wrapper | `#fff` + inputs `#fff` | BG-013, BG-014 |
| `.wp-checkout-section`, `.wp-order-summary`, `.wp-review-form` | `#fff` + border `var(--bb-border-subtle)` | BG-016, BG-017, BG-021 |
| `.wp-radio-tile`, `.wp-order-head`, `.wp-order-actions` | `#f8f8f8` (idle), `#fff` (checked) | BG-018 |
| `.wp-kpi`, `.wp-address-card`, `.wp-order-card`, `.wp-success .order-card` | `#fff` + border subtle; zebra rows `rgba(0,0,0,0.04)` | BG-019 |
| `.wp-detail-panel` | `#fff` + border-left subtle | BG-022 |
| `.wp-pdp-recently-card`, `.wp-pdp-recently-img` | `#fff` outer, `#f4f4f4` img | BG-020 |
| `.wp-toast` | trắng + border-left đỏ (giữ thay đổi minimal) | BG-023 |
| Footer `.bb-footer-bottom` | thêm `background: #000; padding: 30px 0; color: #fff;` | BG-002 |
| `.wp-header .sub-menu` (hover desktop) | `#fff` + shadow `rgba(0,0,0,0.16)` | BG-003 |
| User toggle menu dropdown | `#fff` | BG-004 |

**Bước 4 — Cleanup tokens:** giống Track A (BG-025-029).

**Bước 5 — Bắt buộc QA visual mọi page:** vì đổi từ dark sang light đảo độ tương phản — type colors, border colors, icon colors đều cần check. Đặc biệt là:
- `.bb-richtext` color
- `.bb-card` color (BG-030)
- Inline shadow values dùng `rgba(255,255,255,...)` phải đảo sang `rgba(0,0,0,...)`
- `border-color: rgba(255,255,255,0.08)` rải khắp — phải đảo

**Effort ước tính:** 1-2 ngày dev + 1 ngày QA visual. Rủi ro **cao** vì đụng chữ/border/shadow toàn site. Bắt buộc test mọi page trước khi deploy.

---

## 8. Acceptance Criteria

Sau khi sửa (Track A hoặc Track B), hệ thống phải đạt:

### Chung (cả 2 track):
- [ ] `STYLEGUIDE.md` phản ánh đúng quyết định theme (dark-first hoặc light-first parity WP).
- [ ] Không còn `#141414`, `#0d0d0d`, `#1a1a1a`, `#3a3a3a` hard-code rải rác — chuyển hết qua CSS variable trong `brand-tokens.css`.
- [ ] Không còn `background: #fff` / `background: #000` hard-code khi đã có `--bb-color-white` / `--bb-color-black` (trừ rule trong scope `.wp-header`/`.bb-footer` được phép giữ literal vì comment đã giải thích).
- [ ] Footer bottom có dải đen 30px (BG-002) khôi phục.
- [ ] Mobile nav drawer dùng `#000` đúng như WP (BG-005).
- [ ] Không phá responsive: tất cả breakpoint (320, 576, 768, 992, 1200) render đúng.
- [ ] Không động business logic, không động routing, không động ISR/SSR/CSR behavior, không động SEO metadata, không động sanitizer.
- [ ] `themeColor` trong `app/layout.tsx` (line 49-51) phải khớp track đã chọn (`#000` cho Track A, `#fff` cho Track B — hiện đang `#000` cho cả 2 mode).

### Riêng Track B (parity WP):
- [ ] `--bb-bg-page` = `--bb-color-white`.
- [ ] Tất cả selector trong table Section 7 Bước 3 đã đổi.
- [ ] Mọi page CMS / static / blog hiển thị nền trắng.
- [ ] Mọi card account / checkout / review form hiển thị trắng.
- [ ] Pixel diff vs screenshot WP cũ ≤ 5% trên page chính (home, product list, product detail, login, checkout, account).
- [ ] Visual accessibility: contrast ratio ≥ 4.5 cho body text (WCAG AA).

### Riêng Track A (giữ dark):
- [ ] Audit này được link trong `STYLEGUIDE.md` để document "intentional divergence".
- [ ] Dark surfaces dùng token thay vì hex literal.

---

## Phụ lục: Nguồn dữ liệu

**WP tham chiếu** (extract bằng `awk 'BEGIN{RS="}";ORS="}\n"}1' file.css | grep background`):

- `bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/style.css` (985 dòng — Underscores normalize + typography + body `#fff`)
- `bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/dist/home.css` (175 KB minified, single-line)
- `bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/dist/product-category.css` (165 KB minified)
- `bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/dist/product-page.css`
- `bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/dist/general-page.css`
- `bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/header.php` (line 26: `<meta name="theme-color" content="#fff">` — confirm light)
- `bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/styles/{main,custom,home,product,product-detail,news,static-page,login,cart,check-out}.css` (đa số rỗng hoặc <50 dòng — chỉ overrides minor)

**bigbike-web** (Next.js):

- `bigbike-web/styles/brand-tokens.css` (691 dòng — tokens)
- `bigbike-web/app/globals.css` (9267 dòng — page styles)
- `bigbike-web/STYLEGUIDE.md` (160 dòng — design constraints)
- `bigbike-web/app/layout.tsx` (98 dòng — root layout, themeColor)
- `bigbike-web/app/page.tsx` (homepage, dùng `.wp-home`)
- `bigbike-web/app/{dang-nhap,thanh-toan,san-pham,danh-muc-san-pham}/page.tsx`
- `bigbike-web/app/product/[slug]/page.tsx`
- `bigbike-web/components/{contact/ContactForm,home/ExperienceCarousel,catalog/CatalogFilters,catalog/ProductGallery,catalog/VariantSelector,ui/Skeletons}.tsx` — scan inline backgrounds.

**Lệnh đã chạy để build evidence:**

```bash
# WP minified extract:
cd bigbike_vn__2026_04_17/files/wp-content/themes/bigbike/dist
awk 'BEGIN{RS="}";ORS="}\n"}1' home.css | grep -i background | grep -v base64

# bigbike-web hex scan:
grep -nE "background\s*:\s*#[0-9a-fA-F]{3,8}" bigbike-web/app/globals.css

# Component scan:
grep -rE "style=\{\{[^}]*background" bigbike-web/{app,components} --include='*.tsx'
grep -rE "bg-\[#|backgroundColor" bigbike-web --include='*.tsx'
```

**Không xác minh được:**

- Trang `tai-khoan/returns`, `chinh-sach/*`, `bao-hanh`, `huong-dan*`, `tin-tuc/[slug]`, brand `[slug]`, category `[slug]`, error pages, `xac-nhan-email` — chưa đọc file riêng từng page. Đã đánh dấu `△` trong matrix Section 4. Đề xuất visual QA bằng dev server (`npm run dev` → đi qua từng route) khi triển khai fix plan.
- Hover/focus states trong sub-menu và user dropdown chưa được visual test, chỉ trace theo CSS rule.
- Behavior `headroom.js` ẩn header khi scroll không có verify chéo với WP scroll detector — nhưng hành vi background không đổi giữa state.
