# PROMPT cho Claude Code — Đồng bộ 100% Typography từ `bigbike_vn` (WP) sang `bigbike-web` (Next.js)

> Dán toàn bộ nội dung dưới đây cho Claude Code đang mở tại repo `bigbike-web`.
> Brief đã được khảo sát sẵn cả hai dự án; các giá trị WP và đường dẫn trong đây là ground-truth, hãy verify lại với source rồi thực thi.

---

## 0. Mục tiêu

Làm cho **typography hiển thị (rendered) của `bigbike-web` khớp 100%** với site WordPress gốc `bigbike_vn__2026_04_17`: cùng cỡ chữ, cùng line-height / weight / letter-spacing / text-transform, và **cùng cách thay đổi theo breakpoint**. Phạm vi: **toàn site** (home, PDP, danh mục, tin tức, giỏ hàng, checkout, account, header, footer, richtext...).

Đây KHÔNG phải refactor sáng tạo — đây là **port 1:1 thang chữ WP**, chỉ thích nghi về mặt kỹ thuật cho Next.js + Tailwind v4.

---

## 1. Ràng buộc bắt buộc (đã chốt với chủ dự án)

1. **GIỮ font Arial/Helvetica.** KHÔNG tải lại webfont Barlow / Barlow Condensed / Oswald. Toàn bộ token `--bb-font-*` giữ nguyên `Arial, Helvetica, "Helvetica Neue", sans-serif`. (Hệ quả: nơi WP dùng *Barlow Condensed* hay *Oswald* thì ở bigbike-web vẫn là Arial — chỉ khớp **cỡ/weight/transform/line-height**, không khớp hình chữ. Đây là chủ ý.)
2. **Sao chép đúng mô hình responsive của WP:** cỡ **cố định** (không fluid) + **nhảy bậc theo breakpoint**. **GỠ BỎ toàn bộ `clamp()` fluid** trong thang chữ.
3. **Breakpoint = Bootstrap của WP:** `576 / 768 / 992 / 1200px`. Dùng đúng các mốc này cho mọi override typography (viết `@media (min-width:…)` / `(max-width:…)` thẳng cho token, KHÔNG cần trùng với breakpoint utility của Tailwind).
4. **Phạm vi: toàn site.**

---

## 2. ⚠️ Thích nghi BẮT BUỘC cho Next.js + Tailwind v4 (phần "phù hợp dự án hiện tại")

WP đặt `html { font-size: 14px }` rồi viết size bằng `rem` (mỗi `rem` = 14px). **TUYỆT ĐỐI KHÔNG** đặt `html{font-size:14px}` trong bigbike-web, vì:

- `styles/brand-tokens.css` định nghĩa **spacing & container bằng rem**: `--bb-space-4: 1rem`, `--bb-space-8: 2rem`, `--bb-container-xl: 75rem`, `--bb-container-wide: 90rem`…
- Tailwind v4 cũng dùng **rem cho toàn bộ spacing/sizing utilities** (`p-4`, `gap-6`, `h-10`, `max-w-*`…).
- Đổi root xuống 14px sẽ **co toàn bộ layout ~12.5%** → vỡ spacing/containers toàn site.

### Quy tắc chuyển đổi đúng

- **Giữ `html` root = 16px.**
- **Quy mọi cỡ chữ WP về px thực tế của WP, rồi biểu diễn lại bằng `rem` neo 16px** (giá trị `rem` = `px_WP / 16`). Cách này cho **rendered px y hệt WP** mà vẫn **rem-based → giữ WCAG zoom** (đúng tinh thần dự án: type phải rem-only).
  - Vì WP rem neo 14px nên: **`px_WP = rem_WP × 14`**, rồi **`rem_mới = px_WP / 16`**.
  - Ví dụ: WP `4.375rem` = `61.25px` → bigbike-web `3.828rem`. WP `1.143rem` = `16px` → `1rem`.
- Không hardcode `px` cho type (trừ các nhãn ≤ 12px vốn đã là px cố định trong dự án). Ưu tiên `rem` neo 16.

### Bảng quy đổi nhanh (WP rem@14 → px → rem@16)

| WP (rem@14) | px thực | rem@16 (dùng trong bigbike-web) |
|---|---|---|
| 0.875rem | 12.25px | 0.766rem |
| 1rem | 14px | 0.875rem |
| 1.143rem | 16px | 1rem |
| 1.25rem | 17.5px | 1.094rem |
| 1.286rem | 18px | 1.125rem |
| 1.357rem (lh) | 19px | 1.1875rem |
| 1.429rem | 20px | 1.25rem |
| 1.5rem | 21px | 1.3125rem |
| 2.143rem | 30px | 1.875rem |
| 2.857rem (lh) | 40px | 2.5rem |
| 3.125rem | 43.75px | 2.734rem |
| 3.429rem | 48px | 3rem |
| 3.714rem | 52px | 3.25rem |
| 4.143rem (lh) | 58px | 3.625rem |
| 4.286rem (lh) | 60px | 3.75rem |
| 4.375rem | 61.25px | 3.828rem |

> Các giá trị WP viết thẳng bằng `px` (vd `24px`, `35px`, `16px`, `14px`, `13px`, `12px`, `20px`, `18px`, `22px`) giữ nguyên px đó → quy ra rem@16 = `px/16`.

---

## 3. Nguồn sự thật (đọc & verify trước khi sửa)

Theme WP: `S:\project\bigbike\bigbike_vn__2026_04_17\files\wp-content\themes\bigbike\`

- `styles/main.css` — base + global components (minified 1 dòng).
- `dist/home.css` — **bundle đầy đủ** (Bootstrap + main + page) → file tốt nhất để soi cả base lẫn `@media`.
- `dist/product-page.css`, `dist/product-category.css`, `dist/general-page.css` — CSS theo trang.
- `styles/product-detail.css`, `styles/news.css`, `styles/news-detail.css`, `styles/product.css`, `styles/static-page.css`, `styles/cart.css`, `styles/check-out.css`, `styles/register.css`, `styles/login.css`, `styles/payment-success.css`.
- `styles/fonts.css` — chỉ là `@font-face` (BỎ QUA, ta không dùng webfont).
- `:root` WP: `--theme-size:14px; --theme-font:"Barlow"; --theme-font-second:"Barlow Condensed"; --theme-gray:#6f6f6f; --theme-red:#ff0c09`.

**Cách trích xuất** (file minified): de-minify bằng prettier/cssnano hoặc grep theo block:
```
rg -o "[^{}]*\{[^{}]*font-size[^{}]*\}" dist/home.css
rg -o "@media[^{]*\{" dist/home.css        # liệt kê breakpoint
```
Với mỗi element, phải lấy đủ: **base + mọi override trong `@media`** (WP trộn cả mobile-first lẫn desktop-first — xác định đúng từng cái, đừng đoán).

---

## 4. Thang chữ WP đã trích xuất (reference — vẫn phải đối chiếu source)

Đơn vị px = đã quy về thực tế (root 14px). Khi áp vào bigbike-web → đổi sang rem@16 theo §2.

### 4.1 Global / base
- `body`: **16px**, color `#000`, bg `#fff`, line-height base ~1.15 (normalize). (WP có `body{font-size:1rem}` rồi bị override `body{font-size:16px;padding:80px 0 0}` → **16px thắng**.)
- `h1–h6`: `font-weight:600; margin:0 0 .5rem`.
- Màu chữ phụ: `#6f6f6f` (gray), nhấn đỏ `#ff0c09`.

### 4.2 Heading / tiêu đề
| Vai trò (selector WP) | Mobile | Desktop | LH | Weight | Transform | Ghi chú |
|---|---:|---:|---|---|---|---|
| Banner trang `.page-title h1` | 24px | **61.25px** (4.375rem) | 1.x | 600 | — | desktop trong `@media (min-width:992px)` vùng `.page-title` (verify mốc) |
| Tiêu đề section `.block-title h3` | **24px** (lh 30px) | **35px** (lh 60px) | — | 600 | — | WP font Oswald → giữ Arial |
| Kicker section `.block-title p.sub-title` | 16px | 16px | 19px | 600 | — | màu `#cecece` |
| Mô tả section `.block-title--content p` | 14px | 14px | 1.214 | 400 | — | màu `#3a3a3a` |
| `.title h3` | 24px | 24px | 29px | 600 | — | |
| `.title p` | 14px | 14px | — | 400 | — | |
| Page title chung `body .page-title h1` | 24px | 24px | — | 600 | — | |

### 4.3 Header / nav
| Selector | Cỡ | Weight | Ghi chú |
|---|---:|---|---|
| `header .navigation` (nav chính) | 16px | — | WP Barlow Condensed |
| nav submenu `a` | 14px | 600 | WP Oswald |
| `.user-control--item > a` (icon/text) | 18px | — | |
| ô search header `input` | 24px | 400 | |

### 4.4 Product
| Selector | Cỡ | Weight | Ghi chú |
|---|---:|---|---|
| Tên SP card `.product--item-title a` | 16px | — | |
| Link cart card `.product--item-cart a` | 13px | — | |
| Giá sale `.product--item-sale p` | 18px | 600 | xoay -20deg |
| `.product .desc h2` (+ span) | 16px | 600 | |
| `.product .desc p` | 14px | — | |
| `.product-information .group-label` | 24px | 600 | lh 52px, WP Oswald |
| Nút prev/next slider SP | 43.75px | 400 | |
| `.jq-rating-label` | 22px | — | |

### 4.5 News / blog / widget
| Selector | Cỡ | Weight | Ghi chú |
|---|---:|---|---|
| Tên bài `.news--item-title a` | 14px | 600 | |
| Ngày `.news-date` | 12px | — | |
| widget news `h3` (+a) | 14px | — | lh 18px |
| `.widget--title h3.big` | 20px | — | |
| `.widget--title .sub-title` | 20px | — | WP Oswald |

### 4.6 SEO content block
| Selector | Cỡ | Weight |
|---|---:|---|
| `.seo-block-content h2 span` | 18px | 600 |
| `.seo-block-content h3 (span)` | 16px | 600 |
| `.seo-block-content p, li` | 14px | — (màu #6f6f6f) |

### 4.7 Footer / contact / misc
| Selector | Cỡ | Weight | Ghi chú |
|---|---:|---|---|
| `.newletters form h3` | 48px | 500 | lh 58px, WP Barlow Condensed, UPPER |
| `.contact-infor--item` | 30px | — | WP Barlow Condensed |
| `.information--item h3` | 16px | 500 | UPPER, màu đỏ |
| `.social-sharing p` | 14px | 600 | UPPER |
| `.social-sharing a` | 21px | — | |
| `.contact-page .title h3` | 24px | — | lh 29px |
| `.contact-page .desc p` | 14px | — | (`b` = 20px/500) |
| `.block-text p` | 12.25px | — | lh 1.25rem; nhưng `body .block-text p,.wyswyg`=16px |
| pagination `li` | 21px | 600 | |
| `legend` | 21px | — | |

> ⚠️ Bảng trên là lõi đã xác minh. **Phần đuôi dài** (mọi selector còn lại) → Claude Code tự quét source theo §3 và áp 1:1. Không bỏ sót element nào có `font-size` trong CSS theme WP.

---

## 5. Kiến trúc bigbike-web cần sửa

Tailwind **v4 CSS-first** (KHÔNG có `tailwind.config.ts`; token expose qua `@theme inline`). Type tập trung ở token → **sửa token là phần lớn site tự cập nhật**, sau đó quét component cho phần bypass.

### 5.1 `styles/brand-tokens.css` — TRUNG TÂM
- **Thay toàn bộ `--fs-*` từ `clamp()` → cố định + `@media`** khớp WP:
  `--fs-overline, --fs-caption, --fs-button, --fs-body, --fs-body-lg, --fs-h4, --fs-h3, --fs-h2, --fs-h1, --fs-display, --fs-display-xl`.
- Các token clamp khác cũng phải bỏ fluid: `--bb-text-nav, --bb-text-22/26/32/40/50, --bb-text-hero, --bb-text-section-title, --bb-text-section-kicker, --bb-text-footer-slogan, --bb-text-h1/h2`.
- Giữ nguyên: `--bb-font-*` (Arial), `--bb-text-xs/sm/base/lg/xl/3xl` (đã là px hợp lý), weights.
- Line-height: set theo WP (vd section-title lh 60px@desktop/30px@mobile, body ~1.5, heading 1.x). Dùng token `--bb-line-*` hiện có, thêm nếu thiếu.

**Mẫu chuyển 1 token (clamp → fixed + breakpoint):**
```css
/* TRƯỚC (fluid) */
--fs-h1: clamp(1.875rem, 1.596rem + 1.19vw, 3.5rem);

/* SAU (WP-parity: 24px mobile → 61.25px desktop @≥992px) */
--fs-h1: 1.5rem;                 /* 24px */
@media (min-width: 992px) {
  :root { --fs-h1: 3.828rem; }   /* 61.25px = 4.375rem@14 của WP */
}
```
> Lưu ý: override CSS variable trong `@media` phải đặt trên `:root` (hoặc selector đang giữ token), KHÔNG đặt trong `@theme inline` (block đó không nhận `@media`).

### 5.2 `app/globals.css`
- `@theme inline` (map `--text-*` → `--fs-*`/`--bb-text-*`) **giữ cấu trúc**, chỉ cần token nguồn đã đổi giá trị là utilities `text-h1/h2/.../text-body/text-display…` tự đúng.
- `body { font-size: var(--fs-body) }` → đảm bảo `--fs-body` = 16px cố định (1rem). Bỏ comment "fluid 16→18".
- Quét các rule `.bb-*` trong file (rất nhiều) đang dùng `clamp(`, `text-[..px]`, `var(--fs-*)`, `var(--bb-text-*)`, `vw`: chỉnh về giá trị WP. Đặc biệt: `.bb-cat-hero-title` đang `clamp(2.5rem,5vw,4.375rem)` → phải thành 24px→61.25px theo §4.2; `.bb-page h1`, `.bb-page-head h1`, `.bb-section-head`, `.bb-seo-content h1..h6`, `.bb-success h1`, `.bb-cart-heading-row h1`, `.bb-pagination-page`, `.bb-breadcrumb`…
- Nếu cần mốc 576/992/1200 mà chưa có: viết `@media` trực tiếp (không phụ thuộc `--breakpoint-*`).

### 5.3 `lib/ui-classes.ts`
- `sectionHeading` / `sectionEyebrow` dùng `text-[length:var(--bb-text-section-title)]` / `--bb-text-section-kicker` → token đã đổi nên tự đúng; **verify** giá trị: section title 35px/24px, kicker 16px.
- `iconBtn` đang `text-[1.286rem]` (=20.6px@16 — SAI so với WP 18px) → đổi `text-[1.125rem]` (18px).
- Rà các bundle khác (`fieldLabel`, `metaLabel`, `tableHeader`, `categoryBadge`, `authHeading`, `authInput`, `stateTitle`, `sectionSubheading`) cho khớp cỡ WP tương ứng.

### 5.4 Quét component toàn site (`app/**`, `components/**`)
Tìm và sửa mọi nơi đặt cỡ chữ trực tiếp / fluid:
```
rg -n "text-\[(.*?(rem|px|vw).*?)\]" app components
rg -n "clamp\(" app components styles
rg -n "leading-\[|tracking-\[" app components
rg -n "text-(display|h1|h2|h3|h4|body|button|caption|overline)\b" app components   # kiểm tra ngữ cảnh
```
Mỗi kết quả: map về token đúng hoặc giá trị WP (rem@16). Ưu tiên dùng utility token (`text-h1`, `text-body`, `text-ui-N`) thay cho raw `text-[..]`.

### 5.5 Các file CSS phụ
`rg -l "clamp\(|font-size|text-\[" styles/` → xử lý mọi file (vd `styles/home-news-parity.css` nếu có) theo cùng nguyên tắc.

---

## 6. Trình tự thực thi đề xuất

1. **Đọc & de-minify** các file WP §3; lập bảng `selector → {size, lh, weight, transform, breakpoint}` đầy đủ (mở rộng bảng §4).
2. Sửa **`styles/brand-tokens.css`**: đổi hết `--fs-*` và token clamp sang fixed + `@media` (576/768/992/1200).
3. Sửa **`app/globals.css`**: body, các rule `.bb-*`, hero title, bỏ `vw`/`clamp` ngoài nhóm "chữ trang trí" (xem §8).
4. Sửa **`lib/ui-classes.ts`**.
5. Quét & sửa **component** (§5.4) + **CSS phụ** (§5.5).
6. **Build + verify** (§7).
7. Cập nhật **`docs/TYPOGRAPHY.md`** mô tả lại mô hình mới (fixed + breakpoint WP-parity, root 16px, rem@16=px WP, giữ Arial). Cập nhật `docs/audits/TYPOGRAPHY_SCALE_AUDIT.md` nếu liên quan.

---

## 7. Kiểm chứng (bắt buộc)

- `npm run build` (hoặc lệnh build của repo) PASS; `npm run lint` PASS; chạy test nếu có (`vitest`).
- **Không còn `clamp()` trong thang chữ:** `rg -n "clamp\(" styles app components` chỉ còn lại (nếu có) các ngoại lệ "chữ trang trí" ở §8.
- **Không còn `vw` giữa cỡ chữ đọc.**
- **Bảng đối chiếu render:** với ≥10 element tiêu biểu (body, h1 banner, section title, kicker, nav, tên SP, giá, news title, footer slogan, breadcrumb), lập bảng px đo được ở **375 / 768 / 992 / 1200 / 1440px** so với WP. Sai số = 0 ở mức px nguyên (cho phép ±0.5px do làm tròn rem).
- Lý tưởng: chụp screenshot 2 site ở 3 viewport (mobile/tablet/desktop) đối chiếu mắt thường ở vài trang chính.

---

## 8. Ngoài phạm vi / ĐỪNG đụng

- **Không** thêm webfont, **không** đổi `--bb-font-*`.
- **Không** đổi `html` root sang 14px (xem §2).
- **Không** đổi màu, spacing, layout, container — chỉ typography (size/lh/weight/letter-spacing/transform/family-mapping).
- **Giữ nguyên** ngoại lệ "chữ trang trí" cố ý dùng `vw` thuần (không phải text đọc, `pointer-events:none`/`select-none`, opacity thấp): `.bb-promo-bg-text`, watermark trong `PageHero.tsx`, số "404" nền trong `not-found.tsx`. WP cũng không có parity cho mấy cái này.
- Token số `--bb-text-9/10/11/13/15/17` và bộ `text-ui-N`: giữ là px cố định (đúng nhóm "chữ cố định"); chỉ chỉnh nếu lệch cỡ WP.

---

## 9. Định nghĩa "Done"

- [ ] `brand-tokens.css`: 0 `clamp()` trong type token; có override `@media 576/768/992/1200` đúng WP.
- [ ] `globals.css` + `ui-classes.ts` + component + CSS phụ: mọi cỡ chữ = WP (rem@16), không raw fluid/vw (trừ §8).
- [ ] Build/lint/test PASS.
- [ ] Bảng đối chiếu render khớp WP ở 5 viewport.
- [ ] `docs/TYPOGRAPHY.md` cập nhật theo mô hình mới.

> Nếu phát hiện xung đột giữa bảng §4 và source WP thực tế, **source WP thắng** — báo lại điểm lệch trong phần tổng kết.
