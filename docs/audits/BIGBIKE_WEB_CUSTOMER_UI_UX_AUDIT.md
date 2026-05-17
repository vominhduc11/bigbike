# BigBike Web Customer UI/UX Audit

Ngày kiểm tra: **2026-05-16**
Phạm vi: toàn bộ `bigbike-web/` (app routes, components, styles, lib) — góc nhìn **khách hàng truy cập website**.
Chế độ: **AUDIT + TRACE + REPORT** (không sửa code hàng loạt).
Người kiểm tra: Frontend / UI-UX audit agent.

Audit trước đó liên quan (đọc để không trùng lặp scope):
- [`BIGBIKE_WEB_DESIGN_SYSTEM_FULL_AUDIT.md`](./BIGBIKE_WEB_DESIGN_SYSTEM_FULL_AUDIT.md) (2026-05-13) — chấm trục "một design system duy nhất".
- [`BIGBIKE_WEB_DESIGN_SYSTEM_CONSISTENCY_AUDIT.md`](./BIGBIKE_WEB_DESIGN_SYSTEM_CONSISTENCY_AUDIT.md) (2026-05-13).

Audit lần này **không** chấm lại trục Tailwind-vs-`globals.css` (đã có verdict ở 2 file trên); tập trung vào trải nghiệm khách hàng: route-by-route, responsive thực tế, SEO, accessibility, trust, conversion, state handling.

---

## 1. Executive Summary

### Overall score: **6.4 / 10** — **CHƯA production-ready cho khách hàng thật**

Website có nền tảng tốt: design system thật, component shadcn đầy đủ, ISR + `next/image` + skeleton/empty/error state phủ khắp, PDP và trang auth chỉn chu, JSON-LD có ở các trang quan trọng. Quality gate sạch: `tsc` 0 lỗi, `vitest` 95/95 pass.

Tuy nhiên còn **lỗi P0/P1 chặn launch**: một trang trong menu hướng dẫn trả về trang 404, form lọc tin tức vỡ layout trên mobile, meta description của trang danh mục là HTML rác, và (đã sửa trong audit này) 2 chỗ placeholder hiển thị mã escape `\u` thô cho khách.

### Production readiness verdict

**Chưa nên launch.** Cần xử lý nhóm "Must fix before launch" (Mục 11). Sau khi fix nhóm đó, mức sẵn sàng ~**80%**.

### Top 5 rủi ro

| # | Rủi ro | Severity |
|---|---|---|
| 1 | `/huong-dan/` (trang đích "Hướng dẫn") trả về **trang 404** — và breadcrumb của mọi trang hướng dẫn con đều trỏ về đây | **P0** |
| 2 | Form lọc trang `/tin-tuc` **vỡ layout, tràn ngang** trên mobile (360/390/430px) — select bị cắt khỏi màn hình | **P1** |
| 3 | Meta description trang danh mục là **HTML thô + rác Google Sheets** (`<p><span data-sheets-value=...`) | **P1** |
| 4 | Catalog chỉ có **3 sản phẩm, phần lớn "Hết hàng"**; nhiều danh mục **thiếu ảnh** (lưới ô xám trống) | **P1** (content/data) |
| 5 | Hero trang chủ **không có headline/CTA dạng text** — toàn bộ thông điệp nằm trong ảnh banner | **P1** |

### Top 5 đề xuất fix

1. Tạo nội dung CMS cho slug `huong-dan` (hoặc cho `/huong-dan/` redirect sang `/huong-dan/mua-hang/`) — xoá lỗi 404.
2. Thêm responsive cho form lọc `/tin-tuc` (`grid-cols-1` ở mobile, grid nhiều cột từ `md:`).
3. Strip HTML + cắt độ dài khi dùng `category.description` làm meta description.
4. Bổ sung sản phẩm/ảnh danh mục thật trước launch; ẩn danh mục "Uncategorized / Chưa phân loại" khỏi public.
5. Thêm headline + subheadline + nút CTA dạng **text thật** cho hero (overlay trên ảnh slider).

---

## 2. Audit Scope

### Routes đã kiểm tra (19)
`/` · `/san-pham` · `/danh-muc-san-pham` · `/danh-muc-san-pham/[slug]` · `/product/[slug]` · `/tin-tuc` · `/tin-tuc/[slug]` · `/lien-he` · `/gioi-thieu` · `/bao-hanh` · `/huong-dan` · `/huong-dan-mua-hang` · `/chinh-sach/[slug]` (bao-hanh, doi-tra) · `/gio-hang` · `/dang-nhap` · `/dang-ky` · `/quen-mat-khau` · `/tim-kiem` · `/brands` · 404.

### Components đã đọc code-level
`SiteHeader`, `SiteFooter`, `PageHero`, `HeroSlider`, `ProductCard`, `CatalogFilters`, `ArticleCard`, `ContactForm`, `PurchaseSectionClient`, `metadata.ts`, `globals.css` (token layer), các page server/client tương ứng.

### Viewports đã test
360 · 390 · 430 · 768 · 1024 · 1280 · 1440 px (Playwright/Chromium, mỗi route × 7 viewport).

### Tools/commands
- `npx eslint` · `npx tsc --noEmit` · `npx vitest run`
- Playwright (Chromium) — đo overflow ngang, đếm h1/h2, alt ảnh, accessible name, meta/OG/canonical/JSON-LD, console error; chụp screenshot 390 + 1280px (lưu tại `bigbike-web/qa-screenshots/ux-audit/`).
- `curl` xác minh HTTP status, redirect, SSR HTML.
- Stack chạy bằng Docker Compose (`bigbike-web` :3000, `bigbike-backend` :8080) — tất cả container `healthy`.

---

## 3. Scoring Matrix

| Nhóm tiêu chí | Điểm /10 | Ghi chú ngắn |
|---|---:|---|
| Branding & Visual Identity | 7.0 | Brand đỏ/đen mạnh, token chuẩn; bị trừ vì block tối giữa trang light-first, ảnh 404 tông tím lệch brand |
| Navigation & Header | 6.5 | Header gọn, mobile menu OK; trừ nặng vì `/huong-dan/` 404 reachable từ breadcrumb |
| Homepage / Hero | 6.0 | Nhiều block đủ ý; hero thiếu headline/CTA dạng text; 2 thẻ h1 |
| Product Listing / Category | 6.0 | Card tốt, filter tốt; catalog quá ít hàng, sidebar brand dài vô hạn |
| Product Detail | 8.0 | Đầy đủ gallery/specs/CTA/trust/JSON-LD; sticky bar mobile tốt |
| Trust Signals | 7.0 | Footer + GPKD + BCT + social đầy đủ; rò "Uncategorized", policy nội dung mỏng |
| CTA & Conversion | 7.5 | CTA chính rõ, nhất quán; sticky CTA mobile trên PDP |
| Responsive & Mobile-first | 6.0 | Vỡ form lọc `/tin-tuc`; featured ArticleCard không có breakpoint mobile |
| Performance UX | 7.0 | ISR, next/image, lazy, skeleton; hero dùng `<img>` thô; request 401 mỗi trang |
| SEO UX | 5.5 | Có JSON-LD/metadata helper; nhưng meta desc danh mục HTML rác, thiếu canonical ở vài trang, đa h1 |
| Accessibility | 6.0 | Form auth/contact label tốt; radio filter thiếu accessible name; contrast text trên header bài viết tối |
| Loading / Empty / Error State | 8.5 | EmptyState/ErrorState/Skeleton/`error.tsx`/`not-found.tsx`/`loading.tsx` phủ khắp |
| Data Contract Consistency | 6.0 | category.description HTML thô; tên danh mục lẫn tiếng Anh; "Uncategorized" lộ public |

**Overall = trung bình có trọng số ≈ 6.4 / 10.**

---

## 4. Route-by-route Findings

### 4.1 `/` — Homepage
- **Purpose:** giới thiệu BigBike, điều hướng vào sản phẩm/danh mục/tin tức.
- **User intent:** hiểu shop bán gì, tìm nhanh sản phẩm/danh mục, vào PDP.
- **Strengths:** 11 block có cấu trúc; 4 JSON-LD (Organization/WebSite/LocalBusiness/FAQ); featured grid + carousel + danh mục + tin tức + brand; ISR `revalidate=3600`.
- **Findings:**
  - **[P1] Hero không có text thật.** `HeroSlider` chỉ render `<picture>` + `<img>` link; headline/giá trị/CTA đều nằm **trong ảnh banner**. `h1` thật bị `sr-only`. Khách dùng mạng chậm hoặc ảnh lỗi sẽ thấy hero rỗng; không có nút CTA bấm được riêng. Evidence: `components/home/HeroSlider.tsx:58-92`, `app/page.tsx:276-277`.
  - **[P2] 2 thẻ `<h1>`** trên trang: 1 `sr-only` (`app/page.tsx:276`) + 1 đến từ `home_content_bottom_html` (rich text admin chứa `<h1>`). SEO nên chỉ 1 h1.
  - **[P2] Block video "TRẢI NGHIỆM SẢN PHẨM" nền tối** giữa trang light-first — lệch cảm giác (xem Mục 5).
  - **[P3] Hero dùng `<img>` thô** thay vì `next/image` — mất tối ưu responsive/priority của Next (chấp nhận được với Swiper, nhưng nên cân nhắc).
- **Severity tổng:** P1.
- **Recommendation:** thêm lớp overlay text (kicker + h1 hiển thị + 1 CTA) lên hero; gỡ `<h1>` trong rich text bottom hoặc hạ xuống `<h2>`.

### 4.2 `/san-pham` — Product Listing
- **Purpose / intent:** duyệt + lọc toàn bộ sản phẩm.
- **Strengths:** `PageHero` có breadcrumb + đếm số sản phẩm; `CatalogFilters` (danh mục/brand/giá/màu) dùng Accordion + RadioGroup shadcn; có search brand khi >6 brand; EmptyState + ErrorState đầy đủ; metadata `noIndex` khi có filter (đúng).
- **Findings:**
  - **[P1] Catalog gần như rỗng:** chỉ **3 sản phẩm**, phần lớn badge "Hết hàng". Lưới sản phẩm để lại khoảng trắng lớn cạnh sidebar lọc — trang trông chưa sẵn sàng bán (content/data, không phải code).
  - **[P2] Sidebar lọc brand dài vô hạn.** `CatalogFilters` render **toàn bộ** brand (50+) trong Accordion không giới hạn chiều cao/scroll → sidebar dài hơn cả lưới 3 sản phẩm. Evidence: `components/catalog/CatalogFilters.tsx:224-235` (`RadioGroup` không có `max-height`/overflow).
  - **[P2] Radio filter danh mục & brand có thể thiếu accessible name.** Mã bọc `<label className="bb-filter-row"><RadioGroupItem/><span>…</span></label>`; `RadioGroupItem` của Radix render thành `<button role="radio">` — `<label>` **không** đặt tên cho `<button>` (button không phải labelable element). Filter màu sắc thì có `aria-label` (`CatalogFilters.tsx:327`), nhưng danh mục/brand thì không. NEEDS_VERIFICATION với screen reader thực tế; khuyến nghị thêm `aria-label` hoặc `id`+`htmlFor`.
- **Severity tổng:** P1 (do catalog rỗng) / P2 (code).

### 4.3 `/danh-muc-san-pham` — Category Index
- **Purpose / intent:** xem tất cả danh mục, đi vào danh mục con.
- **Strengths:** build cây danh mục cha/con; chip danh mục con; EmptyState; canonical + metadata đúng.
- **Findings:**
  - **[P2] Phần lớn category card thiếu ảnh** → lưới 3 cột toàn ô xám trống, trông chưa hoàn thiện. (data — admin chưa gắn ảnh danh mục.)
  - **[P2] Danh mục "Uncategorized" lộ ra public.** Card "Uncategorized" hiển thị trong lưới — đây là danh mục kỹ thuật, không nên cho khách thấy. Cần ẩn (web hoặc admin filter).
  - **[P3] Tên danh mục lẫn tiếng Anh:** "BOOTS", "HELMETS", "CLOTHING MOTORCYCLE" xen với "GĂNG TAY", "GIÀY BẢO HỘ", "PHỤ KIỆN KHÁC" — không nhất quán ngôn ngữ (data admin).
- **Severity:** P2.

### 4.4 `/danh-muc-san-pham/[slug]` — Category Detail
- **Findings:**
  - **[P1 — SEO] Meta description = HTML thô.** Trang `san-pham-khuyen-mai` có `<meta name="description">` chứa `<p><span data-sheets-value="{" data-sheets-userformat="{" …` — nội dung paste từ Google Sheets, không được strip. Đây vừa là data bẩn vừa là **thiếu xử lý phía web**: khi dùng `category.description` làm meta description phải strip tag + cắt độ dài. Đánh dấu **DATA_CONTRACT_MISMATCH** (web dùng raw description không sanitize cho `<meta>`).
  - Còn lại layout/filter dùng chung `/san-pham` → kế thừa finding 4.2.
- **Severity:** P1.

### 4.5 `/product/[slug]` — Product Detail
- **Purpose / intent:** xem đủ thông tin để quyết định mua/liên hệ.
- **Strengths (điểm sáng nhất site):** `ProductGallery` + info + `PricingPanel` + `StockStatus` + `VariantSelector` + `QuantityStepper`; 2 CTA rõ ("Thêm vào giỏ" primary, "Mua ngay" secondary); khối trust 4 ý ("Hàng chính hãng 100%"…); tabs specs/mô tả/video; reviews; sản phẩm liên quan; recently-viewed; **sticky purchase bar trên mobile**; JSON-LD Product + Breadcrumb (+ FAQ khi có specs); breadcrumb thật; xử lý "Chưa phân loại" gọn.
- **Findings:**
  - **[P3]** `og:type` luôn `website` cho cả PDP (xem 7.x) — nên `product`.
  - **[P3]** Description PDP fallback chung chung "Chi tiết sản phẩm bảo hộ biker BigBike." khi thiếu `shortDescription` — chấp nhận được.
- **Severity:** P3. Route này gần production-ready.

### 4.6 `/tin-tuc` — Blog / News List
- **Purpose / intent:** đọc tin tức, lọc theo danh mục/từ khoá.
- **Strengths:** featured article + lưới; chip danh mục; PageHero; EmptyState/ErrorState; metadata `noIndex` khi có filter.
- **Findings:**
  - **[P1 — Responsive] Form lọc vỡ layout, tràn ngang trên mobile.** `grid-cols-[minmax(240px,1fr)_minmax(150px,0.45fr)_minmax(160px,0.42fr)_auto]` **không có breakpoint** → ở 360/390/430px tổng min-width ~550px+ ⇒ select "Danh mục" bị cắt khỏi viewport, trang cuộn ngang. Evidence: `app/tin-tuc/page.tsx:189`; Playwright báo `overflowX` ở 360/390/430px; screenshot `qa-screenshots/ux-audit/blog-390.png`.
  - **[P1 — đã FIX] Placeholder hiển thị mã escape thô.** `placeholder="VD: chọn size mũ, …"` là **JSX attribute string** nên `\u` **không** được decode → khách thấy literal `VD: chọn size mũ`. Đã sửa trong audit này: bọc `{...}` (`app/tin-tuc/page.tsx:195`).
  - **[P2] Featured ArticleCard không có breakpoint mobile.** `ArticleCard` variant featured: `grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]` không đổi sang 1 cột ở mobile → cột ảnh bị bóp còn vài px (cột text min 320px chiếm gần hết). Evidence: `components/content/ArticleCard.tsx:52`.
- **Severity:** P1.

### 4.7 `/tin-tuc/[slug]` — Article Detail
- **Strengths:** breadcrumb, JSON-LD Article + Breadcrumb, TOC, share FB/Zalo, sidebar tin nổi bật/mới, related, generateStaticParams.
- **Findings:**
  - **[P2 — A11y/contrast] Header bài viết là block nền tối** (`linear-gradient(145deg,#111,#171717)`) chứa text `text-muted-foreground` (#6f6f6f). #6f6f6f trên #111 ≈ **3.7:1** — **không đạt** WCAG AA (cần 4.5:1) cho meta row 11px (category/author/date) và excerpt. Evidence: `app/tin-tuc/[slug]/page.tsx:132-159`.
  - **[P2] Block tối giữa trang light-first** — lệch design system (xem Mục 5).
- **Severity:** P2.

### 4.8 `/lien-he` — Contact
- **Strengths:** PageHero, bản đồ embed (`<iframe title=…>`, lazy), 3 khối thông tin (hotline/địa chỉ/giờ làm việc) có fallback cứng hợp lý, `ContactForm` label đầy đủ + validation rõ + chống spam cooldown 30s + success state. Trust tốt.
- **Findings:**
  - **[P3]** `ContactForm` nhận props `hotline`/`email` nhưng không dùng (đã `eslint-disable`) — nên truyền alternative-contact (hotline/Zalo) vào success state hoặc bỏ props.
- **Severity:** P3.

### 4.9 `/gioi-thieu` — About
- **Findings:**
  - **[P2 — SEO] 2 thẻ `<h1>`:** PageHero h1 ("Giới thiệu BigBike") + 1 h1 trong `page.body` rich text ("GIỚI THIỆU BIGBIKE"). Evidence: `app/gioi-thieu/page.tsx:86,106`. Nên sanitize hạ cấp heading trong rich text, hoặc PageHero dùng h1 và body chỉ h2+.
- **Severity:** P2.

### 4.10 `/bao-hanh` — Tra cứu bảo hành
- **Findings:**
  - **[P2 — SEO] Trang là client component, không có metadata riêng.** `app/bao-hanh/page.tsx` mở đầu `"use client"` ⇒ không export được `metadata` ⇒ title rơi về default "BigBike - Đồ Bảo Hộ Biker", **thiếu canonical, thiếu OG**. Cần tách: server `page.tsx` (export `metadata`) bọc client component con — đúng như `app/huong-dan/page.tsx` đã làm.
- **Severity:** P2.

### 4.11 `/huong-dan` — Guide Landing
- **Findings:**
  - **[P0] Trang đích "Hướng dẫn" trả về trang 404.** `GET /huong-dan/` → HTTP 200 nhưng render nội dung not-found (`/wp/404.png`, "Không tìm thấy trang"). `GuidePage` resolve slug CMS `huong-dan` (`GuidePage.tsx:58`) nhưng **không có page CMS nào slug `huong-dan`** (thư mục `content/pages/` chỉ có `huong-dan-mua-hang.mdx`, không có `huong-dan.mdx`). Nghiêm trọng hơn: **breadcrumb của mọi trang hướng dẫn con** (`/huong-dan/mua-hang`, `/huong-dan/size-mu`, `/huong-dan/size-gang-tay`) đều có link `{ label: "Hướng dẫn", href: "/huong-dan/" }` (`GuidePage.tsx:119`) → khách bấm sẽ rơi vào 404. Evidence: `curl -sL http://localhost:3000/huong-dan/` (3 lần đều ra `wp/404.png`).
- **Severity:** **P0.**
- **Recommendation:** (a) tạo page CMS slug `huong-dan`; hoặc (b) `redirect('/huong-dan/mua-hang/')` cho route gốc; hoặc (c) đổi landing thành trang index liệt kê `GUIDE_ROUTE_MAP` không cần page CMS. NEEDS_CONFIRMATION về hướng chọn.

### 4.12 `/huong-dan-mua-hang` — Buying Guide
- **Strengths:** title/canonical/OG đúng, h1 đúng ("Hướng dẫn mua hàng"). OK.
- **Severity:** không có finding đáng kể (P3: nội dung body ngắn).

### 4.13 `/chinh-sach/[slug]` — Policy Pages
- **Strengths:** `/chinh-sach/bao-hanh`, `/chinh-sach/doi-tra` render đúng, h1 đúng, canonical đúng, `PolicySidebar`, có `POLICY_SLUG_MAP` + `POLICY_META`. Hoạt động bình thường.
- **Findings:**
  - **[P3] Nội dung policy mỏng:** body "Chính sách đổi trả" ~930 ký tự — đủ dùng nhưng nên đầy đặn hơn để tạo niềm tin.
  - Lưu ý: `generateMetadata` trả `{}` nếu slug lạ (`chinh-sach/[slug]/page.tsx:46`) — chấp nhận được vì route cũng `notFound()`.
- **Severity:** P3.

### 4.14 `/gio-hang` — Cart
- **Strengths:** client component, `CartSkeleton` khi loading, empty state có CTA "Xem sản phẩm", QuantityStepper, coupon, tổng tiền, breadcrumb.
- **Findings:**
  - **[P2 — SEO]** Client component → title default, **không canonical/OG**. Cart nên `noindex` nhưng vẫn cần title riêng "Giỏ hàng".
  - **[P3]** Khi giỏ trống, cột `aside` tóm tắt đơn vẫn hiển thị "Tạm tính: 0 / Tổng cộng: 0" — nên ẩn summary khi rỗng.
  - **[P3]** `window.confirm("Xoá toàn bộ giỏ hàng?")` — confirm native, lệch brand; nên dùng `ConfirmDialog`/Dialog shadcn.
- **Severity:** P2.

### 4.15 `/dang-nhap`, `/dang-ky`, `/quen-mat-khau` — Auth
- **Strengths:** `/dang-nhap` chất lượng cao — `Label htmlFor`, `aria-invalid`, `aria-describedby`, `role="alert"`, toggle hiện/ẩn mật khẩu có `aria-label`, skeleton Suspense, `noValidate` + validation zod. `/quen-mat-khau` có `noindex, follow` đúng.
- **Findings:**
  - **[P2 — SEO]** `/dang-nhap`, `/dang-ky` là client component → title default, không canonical/OG. Nên có metadata + `noindex` rõ ràng (giống `/quen-mat-khau`).
- **Severity:** P2.

### 4.16 `/tim-kiem` — Search
- **Strengths:** title động "Tìm kiếm: {q}", `noindex, follow` đúng, trả kết quả (24 card cho "non"), có scope select.
- **Findings:**
  - **[P3]** 2 input thiếu label association (NEEDS_VERIFICATION — có thể là input ẩn của Radix Select). Search box chính có `aria-label`.
- **Severity:** P3.

### 4.17 `/brands` — Brands
- **Strengths:** title/canonical/OG đúng, h1 "Thương hiệu".
- **Findings:**
  - **[P3]** Body text chứa "đang cập nhật" — brand thiếu mô tả hiển thị placeholder. Chấp nhận được nhưng nên rà.
- **Severity:** P3.

### 4.18 `404 / not-found`
- **Strengths:** PageHero + ảnh 404 + ô tìm kiếm (`role="search"`) + 3 CTA + "Bài viết mới". `not-found.tsx` có `noindex, follow`. Chuyên nghiệp.
- **Findings:**
  - **[P3]** Ảnh `/wp/404.png` tông tím — lệch palette đỏ/đen của brand.
- **Severity:** P3.

---

## 5. Cross-cutting UI/UX Findings

| # | Vấn đề lặp lại | Severity | Evidence |
|---|---|---|---|
| C1 | **Block nền tối giữa trang light-first.** Header bài viết (`#111`), section video trang chủ — STYLEGUIDE quy định trang light-first (nền trắng), chỉ header/footer tối. Các block tối lẻ tẻ giữa trang phá nhịp visual. | P2 | `app/tin-tuc/[slug]/page.tsx:132`; `app/page.tsx:464-478` |
| C2 | **Client component không có metadata.** `/gio-hang`, `/dang-nhap`, `/dang-ky`, `/bao-hanh` đều thiếu title riêng + canonical + OG do `"use client"`. | P2 | results audit (Mục 7) |
| C3 | **Đa `<h1>` do rich text CMS chèn heading.** Trang chủ, `/gioi-thieu` (và tiềm năng policy/page bất kỳ render `page.body`). `sanitizeRichHtml` không hạ cấp heading. | P2 | `app/page.tsx`, `app/gioi-thieu/page.tsx:106` |
| C4 | **`text-muted-foreground` (#6f6f6f) trên nền tối** → contrast < 4.5:1, fail AA. Trên nền trắng thì #6f6f6f đạt ~5:1 (OK). | P2 | `app/tin-tuc/[slug]/page.tsx` |
| C5 | **Request 401 trên MỌI trang.** Browser gọi trực tiếp `http://localhost:8080/api/v1/customer/me`, trả 401 khi chưa đăng nhập → console error ở mọi route, mọi viewport. Hành vi đúng (probe auth) nhưng nên nuốt lỗi để console sạch. | P3 | Playwright console; `curl` xác minh endpoint |
| C6 | **Touch target dưới 44px.** STYLEGUIDE yêu cầu tối thiểu 44px; nhiều link inline (footer, breadcrumb, nav phụ, dot filter) cao ~20-30px. Phổ biến nhưng đa số là text link nên rủi ro thấp. | P2/P3 | đo Playwright (`smallTap` 42-134/route) |
| C7 | **`og:type` luôn `website`** cho cả PDP và article — nên `product` / `article`. | P3 | `lib/seo/metadata.ts:31` |
| C8 | **Comment `globals.css` bị mojibake** (`â”€â”€…` thay vì `─`), file mở đầu BOM. Không ảnh hưởng khách (chỉ comment) nhưng vi phạm quy tắc encoding UTF-8 của repo. | P3 | `app/globals.css:1,4-7` |

---

## 6. Responsive Audit

Test 7 viewport: 360 / 390 / 430 / 768 / 1024 / 1280 / 1440px.

| Viewport | Kết quả |
|---|---|
| 360 / 390 / 430px | **`/tin-tuc` tràn ngang** — form lọc grid 4 cột không breakpoint, select bị cắt. Các route khác **không** overflow. |
| 768px (tablet) | Form lọc `/tin-tuc` vừa khít nhưng chật; featured ArticleCard 2 cột OK. |
| 1024 / 1280 / 1440px | Không phát hiện overflow. Catalog để khoảng trắng lớn do chỉ 3 sản phẩm (không phải lỗi layout). |

Lỗi responsive cụ thể:
- **[P1]** `/tin-tuc` form lọc — `app/tin-tuc/page.tsx:189` — thiếu `grid-cols-1` mobile.
- **[P2]** Featured `ArticleCard` — `components/content/ArticleCard.tsx:52` — grid 2 cột cố định, cột ảnh bị bóp ~vài px ở ≤430px.
- **[P2]** Product grid mobile hiện **2 cột** ở 390px, trong khi STYLEGUIDE ghi "mobile 1 cột / 320-575px 1 cột". 2 cột thực tế OK cho e-commerce nhưng **lệch tài liệu** → cần thống nhất doc ↔ code.
- Header, footer, product card, form (trừ `/tin-tuc`) hoạt động tốt mọi breakpoint.
- Khoảng cách section co giãn hợp lý theo breakpoint.

---

## 7. SEO UX Audit

**Tốt:**
- `metadata.ts` build chuẩn: title template `%s | BigBike`, canonical, OG, Twitter `summary_large_image`, locale `vi_VN`.
- JSON-LD: trang chủ 4 (Organization/WebSite/LocalBusiness/FAQ), PDP 2-3 (Product/Breadcrumb/FAQ), category 1, article 2.
- `noIndex` đúng cho trang có filter (`/san-pham?…`, `/tin-tuc?…`), `/tim-kiem`, `/quen-mat-khau`, 404.
- URL tiếng Việt thân thiện, có trailing-slash redirect 308 nhất quán.
- `generateStaticParams` cho PDP + article.

**Vấn đề:**

| # | Vấn đề | Severity |
|---|---|---|
| S1 | **Meta description category = HTML thô + rác Sheets.** `<meta name="description">` chứa `<p><span data-sheets-value=…`. Phải strip tag + truncate khi dùng `category.description`. | P1 |
| S2 | **`/bao-hanh`, `/gio-hang`, `/dang-nhap`, `/dang-ky` thiếu title riêng + canonical + OG** (client component). | P2 |
| S3 | **Đa `<h1>`** trên trang chủ & `/gioi-thieu` (rich text CMS chèn h1). | P2 |
| S4 | **`/huong-dan/` trả 404** → mất 1 trang index hướng dẫn khỏi index search. | P1 (xem 4.11) |
| S5 | `og:type` cố định `website` (không `product`/`article`). | P3 |
| S6 | Hero homepage không có heading text thật (h1 `sr-only`) → tín hiệu nội dung above-the-fold yếu. | P2 |

SSR/ISR: hợp lý — page tĩnh ISR `revalidate=3600`, dữ liệu động (giá/kho/variant) fetch client qua `/api/products/[id]/snapshot`. Không thấy lạm dụng.

---

## 8. Accessibility Audit

**Tốt:**
- Form auth & contact: `Label htmlFor`, `aria-invalid`, `aria-describedby`, `role="alert"` + `aria-live`, password toggle có `aria-label`.
- Icon-only button có `aria-label` (slider prev/next, xoá item giỏ, share, filter color).
- Ảnh: 0 ảnh thiếu `alt` (đo Playwright); ảnh trang trí `alt=""` đúng chủ ý.
- `<iframe>` bản đồ có `title`.

**Vấn đề:**

| # | Vấn đề | Severity |
|---|---|---|
| A1 | **Radio filter danh mục/brand có thể thiếu accessible name** — `<label>` bọc `RadioGroupItem` (Radix render `<button role=radio>`); button không nhận tên từ `<label>` bọc. Filter màu thì có `aria-label`. NEEDS_VERIFICATION bằng screen reader. | P2 |
| A2 | **Contrast fail** — `text-muted-foreground` trên header bài viết nền tối (~3.7:1). | P2 |
| A3 | **Touch target < 44px** ở nhiều link/inline control (xem C6). | P2/P3 |
| A4 | Slider dot dùng `role="tab"` nhưng không có `tabpanel` tương ứng — semantics chưa chuẩn (có `aria-label` nên không chặn dùng). | P3 |
| A5 | (Đã FIX) placeholder hiển thị `\u…` thô — ảnh hưởng người đọc & screen reader. | — |

Không phát hiện chữ trắng-trên-trắng. Focus ring có (`--bb-focus-ring`, `focus-visible:outline`).

---

## 9. Performance UX Audit

**Tốt:**
- `next/image` dùng rộng rãi, có `sizes`, `priority` cho ảnh hero/above-fold, `fill` + ratio cố định (giảm layout shift).
- ISR `revalidate=3600` cho trang tĩnh; dữ liệu động tách sang client fetch (1 round-trip snapshot).
- Skeleton/`loading.tsx` phủ hầu hết route → perceived performance tốt.
- React Query cho dữ liệu client; lazy `<iframe>` bản đồ; ảnh slide non-first `loading="lazy"`.

**Rủi ro:**

| # | Rủi ro | Severity |
|---|---|---|
| P1r | `globals.css` ~7.3k dòng / 1.8k selector tải trên mọi trang — CSS bundle lớn (đã nêu ở audit design-system trước). | P2 |
| P2r | Request 401 `/api/v1/customer/me` lặp trên mọi trang — thêm 1 round-trip + console error. | P3 |
| P3r | Hero `<img>` thô (không qua `next/image`) — mất tối ưu format/responsive của Next. | P3 |
| P4r | Layout shift: ảnh đều có width/height hoặc `fill`+ratio → rủi ro thấp; featured ArticleCard mobile bị bóp ảnh là lỗi layout, không phải shift. | — |

Lighthouse: chưa chạy được trong môi trường audit (không có Chrome headless cho LH trong stack); khuyến nghị chạy `lighthouse` trên `/`, `/san-pham`, `/product/[slug]` trước launch — đánh dấu **NEEDS_VERIFICATION**.

---

## 10. Data Contract Consistency

| # | Phát hiện | Phân loại |
|---|---|---|
| D1 | `category.description` được dùng nguyên văn (HTML + attribute Google Sheets) làm `<meta name="description">`. Web cần strip/sanitize. | **DATA_CONTRACT_MISMATCH** (web dùng raw field sai mục đích) |
| D2 | Danh mục "Uncategorized / Chưa phân loại" lộ trên `/danh-muc-san-pham`. PDP đã ẩn "chua-phan-loai" (`product/[slug]/page.tsx:109-110`) nhưng category index thì chưa. | Xử lý không nhất quán giữa các surface |
| D3 | Catalog chỉ 3 sản phẩm, nhiều "Hết hàng"; nhiều danh mục thiếu ảnh; brand thiếu mô tả. | **FEATURE_DATA_GAP** (content chưa sẵn sàng, không phải lỗi code) |
| D4 | Tên danh mục lẫn tiếng Anh/tiếng Việt. | Data inconsistency (admin) |

Các field dùng đúng: `product.name/slug/price/stockState/gallery/videos/specifications`, `is_featured`/`homepageBlock` (FEATURED_GRID/RECOMMENDED_CAROUSEL), `showOnHomepage`, `publishStatus` (web chỉ nhận bản published), `isVisible` cho category. Không phát hiện web dùng field legacy sai.

---

## 11. Prioritized Fix Plan

### Must fix before launch (P0–P1)
1. **[P0] `/huong-dan/` 404** — tạo page CMS `huong-dan`, hoặc redirect `/huong-dan/` → `/huong-dan/mua-hang/`, hoặc đổi thành trang index. *(NEEDS_CONFIRMATION hướng chọn.)*
2. **[P1] Form lọc `/tin-tuc` vỡ mobile** — thêm `grid-cols-1` mặc định, `md:grid-cols-[…]` cho desktop. *(`app/tin-tuc/page.tsx:189` — fix nhỏ, an toàn.)*
3. **[P1] Meta description category là HTML rác** — strip tag + truncate trước khi đưa vào `<meta>`. *(Có sẵn `stripAndTruncate` ở `danh-muc-san-pham/page.tsx` — tái dùng pattern.)*
4. **[P1] Content readiness** — bổ sung sản phẩm thật, ảnh danh mục, mô tả brand; ẩn "Uncategorized". *(data + 1 fix nhỏ ẩn category.)*
5. **[P1] Hero không có text** — thêm overlay headline/subheadline/CTA dạng text. *(NEEDS_CONFIRMATION — đụng layout hero.)*
6. **[Đã FIX] Placeholder `\u` thô** — `app/tin-tuc/page.tsx:195`, `app/tai-khoan/edit-account/page.tsx:108` (bọc `{…}`).

### Should fix soon (P2)
- Featured `ArticleCard` thêm breakpoint mobile (1 cột).
- Sidebar brand: giới hạn chiều cao + scroll.
- `/bao-hanh`, `/gio-hang`, `/dang-nhap`, `/dang-ky`: tách server wrapper export `metadata` (title + canonical/`noindex`).
- Gỡ/hạ cấp `<h1>` trong rich text CMS (sanitize hạ heading) → 1 h1/trang.
- Contrast: đổi text trên header bài viết tối sang token sáng đạt AA, hoặc đổi header sang nền sáng.
- Radio filter danh mục/brand: thêm `aria-label`.
- ESLint: 4 lỗi `react-hooks/set-state-in-effect` (`thanh-toan/page.tsx:141`, `QuickBuyModal.tsx:81,113`, `HomeVideoCarousel.tsx:230`, `SearchToggle.tsx:140`).
- Xem lại các block tối giữa trang light-first.

### Nice to have (P3)
- Nuốt lỗi 401 probe auth (console sạch).
- `og:type` theo loại trang (`product`/`article`).
- Cart trống: ẩn summary; thay `window.confirm` bằng Dialog.
- Sửa mojibake comment trong `globals.css`.
- Ảnh 404 theo palette brand.
- `ContactForm`: dùng hoặc bỏ props `hotline`/`email`.

---

## 12. Appendix

### Commands đã chạy
```
docker ps                       # stack healthy: web:3000 backend:8080 ...
npx eslint                      # 4 errors (react-hooks/set-state-in-effect), 2 warnings
npx tsc --noEmit                # 0 error
npx vitest run                  # 12 files, 95/95 tests PASS
node (Playwright Chromium)      # 19 routes × 7 viewport — overflow/h1/alt/meta/console
curl -sL .../huong-dan/         # xác minh route trả 404 (×3)
curl .../api/v1/customer/me     # xác minh nguồn 401
```
*Lưu ý:* `next build` không chạy lại trong audit (container Docker đang chạy bản build production `healthy` ⇒ build hiện hành PASS). `lighthouse` chưa chạy — **NEEDS_VERIFICATION**.

### Screenshots
Lưu tại `bigbike-web/qa-screenshots/ux-audit/` — mỗi route 2 file (`-390.png` mobile, `-1280.png` desktop full-page). Ảnh chứng quan trọng:
- `blog-390.png` — form lọc tràn ngang, select bị cắt.
- `listing-1280.png` — sidebar brand dài hơn lưới 3 sản phẩm.
- `category-index-1280.png` — lưới danh mục thiếu ảnh + card "Uncategorized".
- `product-detail-1280.png` — PDP đạt chuẩn (tham chiếu tích cực).

### File references chính
- `app/page.tsx`, `components/home/HeroSlider.tsx` — hero.
- `app/tin-tuc/page.tsx:189,195` — form lọc / placeholder.
- `app/huong-dan/GuidePage.tsx:55-78,119` — guide landing 404.
- `components/catalog/CatalogFilters.tsx:224-235,327` — sidebar brand / radio a11y.
- `components/content/ArticleCard.tsx:52` — featured card responsive.
- `app/tin-tuc/[slug]/page.tsx:132-159` — header tối / contrast.
- `lib/seo/metadata.ts` — metadata helper.
- `app/bao-hanh/page.tsx:1` — client component thiếu metadata.

---

## Kết luận

**bigbike-web ĐÃ đạt tiêu chí UI/UX cho khách hàng chưa?** — **Chưa.**

**Đạt khoảng bao nhiêu phần trăm?** — **~64%** (overall 6.4/10). Nền tảng kỹ thuật, design system, PDP, state handling và trang auth đã ở mức tốt; nhưng còn lỗi chặn và khoảng trống nội dung.

**Có nên launch chưa?** — **Chưa nên.** Một trang trong hệ thống hướng dẫn trả về 404, một trang chính vỡ layout trên mobile, meta description danh mục là HTML rác, và catalog gần như rỗng — đủ để làm khách mất niềm tin ngay lần đầu truy cập.

**Cần fix gì trước launch?** — Nhóm "Must fix before launch" (Mục 11): xử lý `/huong-dan/` 404, responsive form `/tin-tuc`, sanitize meta description danh mục, bổ sung sản phẩm/ảnh thật + ẩn "Uncategorized", thêm text thật cho hero. (2 lỗi placeholder `\u` đã được sửa trong audit này.) Sau khi xong nhóm đó, mức sẵn sàng ước tính **~80%** và có thể cân nhắc soft-launch kèm theo dõi nhóm P2.
