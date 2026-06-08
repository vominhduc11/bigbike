# Typography Implementation Plan — bigbike-web (WP-PARITY)

> **Mục tiêu:** áp dụng **100%** typography của site WordPress "bigbike" cũ vào dự án Next.js `bigbike-web`, theo báo cáo audit `bigbike-typography-system-report.md` — nhưng triển khai theo kiến trúc Next.js (token CSS + Tailwind v4 `@theme` + `next/font`).
>
> **Ngày thực hiện:** 2026-06-07 · **Trạng thái:** đã triển khai, build xanh (192/192 trang).

---

## 1. Phân tích & quyết định

### Bối cảnh
`bigbike-web` trước đó chạy hệ typography **Barlow-superfamily fluid** (`clamp()`, gỡ Oswald) — vốn đã **cố ý thay thế** hệ WordPress cũ. Báo cáo audit (`bigbike-typography-system-report.md`) mô tả lại hệ WP cũ (đầy lỗi: Oswald không nạp, px cứng, trộn 2 gốc rem, ~45 cỡ chữ).

### Quyết định của chủ dự án (2 vòng hỏi)
1. **Tái hiện 100% theo báo cáo WP** — đảo ngược hệ fluid.
2. **Giữ nguyên cỡ chữ "lẻ" của WP** (page-title 24, block-title 35, slogan 48, cart 24…).
3. **Nạp Oswald thật** (`next/font`) → heading/giá/menu phụ hiển thị bằng Oswald **đúng ý đồ thiết kế WP** (sửa bug "Oswald không bao giờ được nạp").

### Nguyên tắc kỹ thuật
- **Đổi GIÁ TRỊ token, không sửa từng consumer.** Hệ đã token-hóa → đổi định nghĩa `--fs-*`/`--bb-text-*`/`--bb-font-*` kéo hàng trăm component dịch theo tự động. Giữ TÊN token để không vỡ consumer.
- **px theo cột "≈px" báo cáo** (WP khóa `html:14px` nên px là faithful, render pixel-identical mà không dính mớ rem-14px lỗi). **KHÔNG fluid/clamp.**
- **Tái hiện giá trị THẮNG cascade** (vd page-title h1 đè 61→**24px**).
- **Sửa giá trị hỏng hẳn** về giá trị dự định (`font-size:1.714` → `1.714rem`); **giữ "lỗi đẹp"** có chủ đích (line-height = px chiều cao nút).
- **Phạm vi = typography chữ** (font/size/weight/line-height/letter-spacing/màu/transform/decoration/responsive). Icon-font (FontAwesome/icomoon) **ngoài phạm vi**.

---

## 2. Ánh xạ hệ thống cũ → mới

| Hạng mục | Trước (fluid) | Sau (WP-parity) |
|---|---|---|
| Phông heading/display | Barlow Condensed | **Oswald** (nạp mới) |
| Phông tên+giá SP / menu phụ | Barlow Condensed | **Oswald** |
| Phông menu chính / nút / form | Barlow Condensed | Barlow Condensed (giữ) |
| Phông body | Barlow | Barlow (giữ) |
| Cỡ chữ | `clamp()` fluid 375→2560px | **px cố định** |
| Letter-spacing | 3 token (0 / 0.04 / 0.08em) | **0 toàn site** |
| Màu chữ brand | #cc0906 (AA-safe) | **#ff0c09** (WP) |
| Responsive font-size | nhiều (qua clamp) | **chỉ** section-title 35→24 @≤767 |

### Ánh xạ vai trò WP → token/utility → giá trị
| Vai trò WP (báo cáo §2.2) | Token | px | Font |
|---|---|---:|---|
| body / nội dung | `--fs-body` / `text-body` | 16 | Barlow |
| page-title H1 | `--fs-h1` / `text-h1` / `.bb-page h1` | 24 | Oswald |
| H1 sản phẩm | `--bb-text-product-h1` | 30 | Oswald |
| H1 bài viết | `--bb-text-blog-h1` | 24 | Oswald |
| block-title / section | `--bb-text-section-title` / `sectionHeading` | 35→24@≤767 | Oswald |
| sub-title / kicker | `--bb-text-section-kicker` / `sectionEyebrow` | 16 | Barlow Condensed |
| widget title | `--bb-text-widget-title` | 21 | Oswald |
| tên sản phẩm | `--bb-text-product-title` / ProductCard | 14 | Oswald |
| giá sản phẩm | `.bb-price` / `--bb-font-price` | 14 | Oswald |
| menu chính | `--bb-text-nav` | 16 | Barlow Condensed |
| user-control | `--bb-text-user-control` | 18 | Barlow Condensed |
| nút / form | `--fs-button` | 14 | Barlow Condensed |
| pagination | `--bb-text-pagination` / `.bb-pagination` | 21 | Barlow Condensed |
| tin — title | `--bb-text-news-title` | 17.5 | Oswald |
| slogan / newsletter | `--bb-text-footer-slogan` | 48 | Barlow Condensed |
| giỏ — tổng tiền | `--bb-text-cart-total` | 24 | Oswald |

---

## 3. Các bước đã thực hiện

| # | Việc | File |
|---|---|---|
| 1 | Nạp **Oswald** (500/600/700) + Barlow Condensed thêm 300/400; gắn `--font-oswald` vào `<html>` | `app/fonts.ts`, `app/layout.tsx` |
| 2 | Viết lại khối typography token → px WP, font heading/price = Oswald, line-height WP, **tracking = 0**; thêm override section-title 35→24 @≤767; `.bb-price`/`.bb-kicker`/`.bb-richtext` → Oswald | `styles/brand-tokens.css` |
| 3 | `@theme inline`: `--font-display` → Oswald, thêm `font-price`/`font-oswald` + 8 utility vai trò WP (`text-page-title/product-h1/blog-h1/widget-title/user-control/cart-total/pagination/sale`); zero 13 chỗ `letter-spacing` hardcode | `app/globals.css` |
| 4 | `sectionHeading` → Oswald 35px/600/lh-WP; `sectionEyebrow` → tracking 0 / leading-title | `lib/ui-classes.ts` |
| 5 | Cart (heading→24, total 1.714rem→24, coupon 1.143rem→16); checkout h1 28→24; blog-listing h1 28→24; ProductCard tên+giá → Oswald 14 | `app/gio-hang/page.tsx`, `app/thanh-toan/page.tsx`, `app/globals.css`, `components/catalog/ProductCard.tsx` |
| 6 | Màu chữ/giá brand → **#ff0c09**; zero toàn bộ `tracking-[Xem]` arbitrary (13 file .tsx, pass PowerShell regex) | `styles/brand-tokens.css`, `components/**`, `app/**` |
| 7 | Giữ tên token (không dead CSS); cập nhật comment cũ "fluid/clamp" | `brand-tokens.css`, `globals.css` |
| 8 | **Docs-First**: viết lại `docs/TYPOGRAPHY.md` + section Typography `STYLEGUIDE.md` thành WP-parity; cập nhật memory | `docs/TYPOGRAPHY.md`, `STYLEGUIDE.md` |
| 9 | File này + build verify | (root) |

---

## 4. Đánh đổi (ghi nhận)
- **WCAG**: px cố định → chữ không scale theo browser zoom font-size (giống WP `html:14px`). `#ff0c09` hụt contrast cho body nhỏ. **Có chủ đích** để khớp 100% WordPress.
- **"Lỗi đẹp" WP** giữ có chủ đích: line-height lớn (block-title h3 ~1.714 = 60px/35px), trộn đơn vị.
- **Admin** (`bigbike-admin`) **không đụng** — khác design system (Inter/Bungee).

## 5. Kiểm tra (verification)
1. ✅ `npm run build` — 192/192 trang generate, Oswald `next/font` hợp lệ, token px + utility mới biên dịch OK (chạy 2 lần: sau foundation, sau component).
2. **Cần QA hình ảnh** (dev server cổng ephemeral — memory ghi :3001 hay stale): mở DevTools → Computed → xác nhận heading/tên+giá SP = **Oswald**, menu chính = Barlow Condensed, body = Barlow; đối chiếu cỡ px từng vai trò với báo cáo §2.2 (page-title 24, section 35→24@767, giá 14, slogan 48, cart total 24, pagination 21); letter-spacing = 0; chữ/giá brand = #ff0c09.

## 6. Phủ 100% bảng vai trò §2.2 (đã rà toàn dự án)
Sau khi audit lại toàn bộ `globals.css` + mọi `.tsx`, đã sửa nốt các chỗ per-component còn lệch:
- Phân trang `1.5rem`→`--bb-text-pagination` (21px, tránh thành 24px ở root 16px).
- `.bb-page h1` mobile `2rem`→24px (phẳng, không phóng).
- Heading nội dung bài viết (`.bb-article-wyswyg h1–h6`) → thang heading WP 24/21/18/16/14/12px.
- SEO content-bottom (home) mobile → khớp base (không phóng to trên mobile).
- Submenu mega-menu `13px font-nav`→`14px Oswald` (menu phụ WP = Oswald 14).
- Category-hero mobile `18px`→24px (phẳng); giá cũ `0.9rem`→14px.

**Các `text-[…]` còn lại đều CỐ Ý (không phải nợ):** search input desktop `24px` = đúng WP §2.2; FloatingChat `13px` = cơ chế widget chat (ngoại lệ đã ghi nhận); LanguageSwitcher `11px` = mã ngôn ngữ (nhãn nhỏ ngoài bảng vai trò); giỏ hàng `1em` = kế thừa 24px từ cha. globals.css còn lại = nhãn 14/16/24px hợp WP. → **Mọi phần tử trong bảng §2.2 của báo cáo đã được áp dụng.**

---

*Nguồn đối chiếu per-element: `bigbike-typography-system-report.md` §2.2/§2.3 (size), §3 (font), §4 (weight), §5 (line-height/letter-spacing), §6 (transform/decoration/màu), §7.3 (responsive). Source of truth typography mới: `bigbike-web/docs/TYPOGRAPHY.md`.*
