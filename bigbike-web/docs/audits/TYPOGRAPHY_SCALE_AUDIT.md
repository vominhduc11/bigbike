# Typography Scale Audit — bigbike-web

> Ngày kiểm tra: 2026-06-01 · Phạm vi: toàn bộ `app/` + `components/` (174 file `.tsx`)
> Nguồn scale: **Tailwind v4 (không có `tailwind.config.js`)** — token khai báo trong `@theme inline` của `app/globals.css` + `styles/brand-tokens.css`. Source of truth: `docs/TYPOGRAPHY.md`, `STYLEGUIDE.md`.

## 0. Bối cảnh & "scale chuẩn" của dự án

Dự án KHÔNG dùng `tailwind.config.js`. Toàn bộ typography utility được expose qua `@theme inline` (globals.css dòng 37–141), map về CSS variable trong `brand-tokens.css`. Vốn từ vựng **hợp lệ**:

| Nhóm | Utility hợp lệ |
|---|---|
| Font-size (canonical, fluid `clamp`) | `text-display-xl` `text-display` `text-h1` `text-h2` `text-h3` `text-h4` `text-body-lg` `text-body` `text-button` `text-caption` `text-overline` |
| Font-size (legacy WP-parity) | `text-hero` `text-section-title` `text-news-title` `text-product-title` `text-22/26/32/40/50` `text-9/10/11/13/15/17` |
| Font-size (Tailwind base — được phép) | `text-xs/sm/base/lg/xl/2xl/3xl` (theo comment globals.css dòng 91) |
| Font-family | `font-display` `font-heading` `font-cta` `font-nav` `font-body` |
| Line-height (role token) | `leading-display` (1.1) · `leading-heading` (1.15) · `leading-title` (1.2) · `leading-body` (1.5) |
| Letter-spacing (chỉ 3 bậc) | `tracking-normal` (0) · `tracking-wide` (0.04em) · `tracking-display` (0.08em) |

**Hai luật cốt lõi định hình toàn bộ audit này:**

1. **Một token = một `clamp()`; KHÔNG override font-size theo breakpoint** (STYLEGUIDE dòng 83, 122–126). Hệ quả quan trọng: token fluid (`text-h1`, `text-display`…) tự co giãn mobile→4K, **không cần và không được thêm** `md:text-2xl lg:text-3xl`. Vì vậy "thiếu responsive class" (tiêu chí 3) **không** sửa bằng cách thêm breakpoint — mà sửa bằng cách đổi size cố định sang token fluid.
2. **Heading cấp trang phải dùng utility token — cấm `text-2xl`/`text-3xl` cố định và cấm arbitrary `text-[26px]`** (STYLEGUIDE dòng 113). Mọi typography phải truy về scale tập trung, không khai báo rời trên component.

---

## 1. Tổng quan

| # | Tiêu chí | Số vấn đề | Mức nặng nhất |
|---|---|:--:|:--:|
| 1 | Arbitrary font-size (`text-[…]`) ngoài scale | **11** (6 file) | High |
| 2 | Nhóm typography không nhất quán (size cố định / sai font trên heading) | **9** | High |
| 3 | Display/Hero/Heading không fluid (kẹt size cố định) | **5** | Medium |
| 4 | Breakpoint không đồng bộ | **0*** | — |
| 5 | Semantic HTML sai (div/p thay heading, thẻ lệch vai trò) | **6 nhóm** | High |
| 6 | `leading-`/`tracking-` ngoài scale (arbitrary + bậc cấm) | **16** (14 leading + 2 tracking) | High |

\* **Tiêu chí 4 = 0 vi phạm theo nghĩa đen.** Quét toàn dự án không có bất kỳ `md:text-*` / `lg:text-*` override font-size nào (đúng luật "một clamp"). "Không nhất quán" thực chất nằm ở **tầng class** (token fluid vs size cố định vs arbitrary vs class CSS `bb-*`) — đã gộp vào tiêu chí 2 & 3. Xem mục 2.4.

Tổng: **~47 điểm cần xử lý**. Tập trung cao ở 3 file: `components/layout/SiteFooter.tsx` (8), `components/layout/HeaderNavItem.tsx` (4), `components/catalog/ProductCard.tsx` (semantic + size). Đây là các component xuất hiện trên **mọi trang** → ưu tiên fix.

---

## 2. Chi tiết từng vấn đề

### 2.1 — Tiêu chí 1: Arbitrary font-size `text-[…]`

Nhiều giá trị có **token tương đương sẵn** — chỉ cần thay class.

| File : dòng | Hiện tại | Vấn đề | Gợi ý fix |
|---|---|---|---|
| `components/layout/HeaderNavItem.tsx` : 43, 54, 139, 167 | `text-[13px]` ×4 | 13px không có token (gần nhất `text-13`=14px). Nav xuất hiện mọi trang → tần suất cao | `text-13` (hoặc `text-sm`); nếu buộc đúng 13px, thêm token `--bb-text-12` rồi expose |
| `components/content/ArticleCarousel.tsx` : 20 | `text-[3.125rem]` | 50px cố định, không fluid. Token `text-50` (clamp 30→50) tồn tại đúng cho case này | `text-50` hoặc `text-section-title` |
| `components/home/MobileSectionHeader.tsx` : 17 | `text-[10px]` | 10px **dưới sàn scale** (token nhỏ nhất = 12px) | `text-overline` (12→14) |
| `components/layout/SiteFooter.tsx` : 220 | `text-[clamp(2.25rem,1.125rem+4.8vw,3.429rem)]` | Footer slogan — đã có token chuyên dụng `--bb-text-footer-slogan` (chỉ chưa expose ra utility) | Expose `--text-footer-slogan` trong `@theme` rồi dùng `text-footer-slogan` |
| `components/layout/SiteFooter.tsx` : 241, 242 | `text-[clamp(1.375rem,…)]`, `text-[clamp(1.625rem,…)]` | Heading cột footer khai báo clamp rời | `text-h4` / `text-22` (token fluid sẵn) |
| `app/not-found.tsx` : 33 | `text-[clamp(7rem,22vw,14rem)]` | Số "404" display bespoke (chấp nhận được nhưng nên token hoá) | Thêm token `--fs-display-2xl` hoặc giữ + ghi chú ngoại lệ |
| `components/layout/PageHero.tsx` : 91 | `text-[clamp(64px,19vw,200px)]` | Ghost-text trang trí sau hero (bespoke) | Token hoá hoặc khai báo trong CSS layer |

```tsx
// HeaderNavItem.tsx — ví dụ
- <span className="... text-[13px] ...">
+ <span className="... text-13 ...">

// ArticleCarousel.tsx:20
- <... className="text-[3.125rem] ...">
+ <... className="text-50 ...">
```

### 2.2 — Tiêu chí 2: Nhóm typography không nhất quán

Heading / text-nhóm-heading dùng **size Tailwind cố định** (không fluid, vi phạm luật "heading phải dùng token"):

| File : dòng | Thẻ | Hiện tại | Vấn đề | Gợi ý fix |
|---|---|---|---|---|
| `components/catalog/ProductCard.tsx` : 234 | `<h3>` | `font-heading text-lg font-semibold uppercase leading-display` | Tên sản phẩm size cố định `text-lg` — **trong khi cùng file** dòng 359 dùng `bb-product-name` (= `--fs-h4` fluid). Hai biến thể, hai nhóm khác nhau | Thống nhất về `text-h4` (hoặc class `bb-product-name`) |
| `components/layout/FooterCollapsible.tsx` : 13 | `<h3>` | `font-body text-body-lg font-medium uppercase` | UPPERCASE heading nhưng dùng `font-body` (Barlow thường) + `text-body-lg` (token body) → sai cả font lẫn nhóm | `font-heading text-h4` |
| `components/layout/PolicySidebar.tsx` : 44 | `<h3>` | `font-display text-base ... uppercase` | Heading sidebar dùng `text-base` cố định | `text-h4` hoặc `text-product-title` |
| `app/tai-khoan/doi-tra/page.tsx` : 71 | `<h3>` | `text-sm font-bold ... tracking-wide` | `<h3>` render ở `text-sm` (14px cố định) | `text-caption` (fluid) nếu cần nhỏ, hoặc `text-h4` |
| `components/home/HomeVideoCarousel.tsx` : 80 | `<span>` | `font-display text-2xl ...` | `text-2xl` cố định (luật cấm `text-2xl` cho heading) | `text-h3`/`text-h2` token |
| `components/ui/ContactInfoList.tsx` : 79 | `<span>` | `font-display text-base font-semibold uppercase` | Label-heading size cố định | `text-button`/`text-caption` |
| `app/gioi-thieu/page.tsx` : 201 | `<span>` | `font-display text-sm ... uppercase` | Eyebrow/label size cố định | `text-overline` |
| `app/tai-khoan/page.tsx` : 56 | `<span>` | `font-display font-bold text-sm uppercase tracking-wide` | Như trên | `text-overline`/`text-caption` |

> **Lưu ý `text-sm` (159 lần) & `text-xs` (26 lần):** comment globals.css dòng 91 **cho phép** base scale Tailwind, nên đây không phải vi phạm cứng. Nhưng đang tồn tại song song 3 cách diễn đạt "chữ nhỏ": `text-sm` (14px cố định) · `text-caption` (14→17 fluid) · `text-13/15`. Khuyến nghị **chọn một** (ưu tiên `text-caption` cho text co giãn) khi refactor để hội tụ về một nhóm.

### 2.3 — Tiêu chí 3: Display/Hero/Heading thiếu tính fluid

Vì hệ thống xử lý responsive **bằng `clamp()` ở tầng token**, "thiếu responsive" = đang kẹt ở **size cố định không co giãn**. Cách sửa đúng là **đổi sang token fluid, KHÔNG thêm `md:`/`lg:`**.

- Các heading `text-lg / text-base / text-sm / text-2xl` ở mục 2.2 → đều thuộc nhóm này (không scale theo viewport).
- `app/dang-ky/page.tsx` : 30, `app/dang-nhap/page.tsx` : 30 (và các trang auth) — `<h1>` dùng class `.bb-auth-heading`, mà class này (`globals.css:388`) đặt `font-size: var(--bb-text-base)` = **16px cố định**, không có `font-family` (rớt về Barlow body). H1 cấp trang ở 16px cố định là quá nhỏ + không fluid.
  ```css
  /* globals.css:388 — hiện tại */
  .bb-auth-heading { font-size: var(--bb-text-base); font-weight: 600; text-transform: none; }
  /* gợi ý */
  .bb-auth-heading { font-family: var(--bb-font-heading); font-size: var(--fs-h3); font-weight: 600; }
  ```
- `components/home/HeroSlider.tsx` : 69 — tiêu đề hero (`bb-main-banner-title`) là nhóm Hero nhưng đang là `<p>` (xem thêm 2.5).

### 2.4 — Tiêu chí 4: Breakpoint handling

**Không phát hiện vi phạm trực tiếp.** Quét `(sm|md|lg|xl|2xl|3xl|4xl):text-*` trên toàn bộ component → **0 kết quả**. Hệ thống cố ý không override font-size theo breakpoint (đúng luật "một token = một clamp"). Sự "không nhất quán" mà tiêu chí này nhắm tới đã chuyển hoá thành **không nhất quán ở tầng class** (token vs cố định vs arbitrary vs class CSS) — đã liệt kê ở 2.1–2.3. → Không cần hành động riêng cho tiêu chí 4; sửa 2.1–2.3 là đủ.

### 2.5 — Tiêu chí 5: Semantic HTML

| # | File : dòng | Vấn đề | Gợi ý fix |
|---|---|---|---|
| a | `components/catalog/ProductCard.tsx` : 124, 195, 299 (`<p>`) vs 234, 359 (`<h3>`) | **Cùng một component**, tên sản phẩm khi là `<p class="bb-fp-title">`/`product--item-title`, khi là `<h3>`. Vai trò semantic lệch nhau giữa các biến thể (featured / archive / default) | Thống nhất tên sản phẩm = `<h3>` ở mọi biến thể |
| b | `app/lien-he/page.tsx` : 214 · `components/catalog/ProductContactCta.tsx` : 36 | `<p className="font-display text-h4 uppercase">` — nhìn là heading h4 nhưng thẻ là `<p>` | Đổi `<p>` → `<h3>`/`<h4>` |
| c | `app/tin-tuc/[slug]/page.tsx` : 222 (`<div class="widget--title">`), 279 (`<div class="related--title">`) | Widget/related title là `<div>` không heading — **trong khi** case song song dùng `<h3>` (`CatalogFilters.tsx:73`, `tin-tuc/page.tsx:211`, `[slug]/page.tsx:280`) | Đổi `<div>` tiêu đề → `<h3>` để đồng bộ |
| d | `components/home/HeroSlider.tsx` : 69 | Tiêu đề hero (`bb-main-banner-title`) là `<p>` — nhóm Display/Hero nên là heading | Cân nhắc `<h2>` (hoặc `<h1>` nếu là banner chính của trang) |
| e | `app/page.tsx` : 172 (`<h3>`) đứng **trước** `<h1 class="sr-only">` dòng 419 | Thứ tự heading đảo (h3 xuất hiện trong DOM trước h1 trang) → cây heading sai cho screen-reader/SEO | Đưa `<h1>` lên đầu luồng, hoặc hạ `<h3>` carousel thành cấp phù hợp sau h1 |
| f | Nhiều `<h1>` trong 1 file: `app/xac-nhan-email/page.tsx` (57/64/74/113), `quen-mat-khau/ForgotPasswordFlow.tsx` (61/69/131/142), `components/layout/PageHero.tsx` (96/165) | Là các nhánh render có điều kiện (state) — **khả năng cao chỉ 1 cái render**. Cần xác nhận không có 2 `<h1>` cùng hiện | Spot-check runtime; nếu an toàn thì bỏ qua |

> Form label dùng đúng: có 13 thẻ `<label>` trong các form. Các `<p class="bb-field-label">` (`doi-tra/page.tsx`) là **nhãn khối nội dung** (heading mục "Sản phẩm"/"Lịch sử"), không phải label cho input → không tính là lỗi `<label>`, nhưng có thể nâng thành `<h4>` cho đúng vai trò.

### 2.6 — Tiêu chí 6: `leading-` / `tracking-` ngoài scale

**Arbitrary `leading-[…]`** (cấm — phải dùng role token `leading-display/heading/title/body`):

| File : dòng | Hiện tại | Gợi ý |
|---|---|---|
| `components/layout/SiteFooter.tsx` : 251 | `leading-[1.786rem]` | `leading-title` (đơn vị rem tuyệt đối là anti-pattern) |
| `components/layout/SiteFooter.tsx` : 260 | `leading-[1.65]` | `leading-body` |
| `components/layout/SiteFooter.tsx` : 277, 284, 293, 321, 348 | `leading-[1.45]` ×5 | `leading-body` |
| `app/tai-khoan/doi-tra/page.tsx` : 107, 115 | `leading-[1.6]` ×2 (note box body) | `leading-body` |
| `app/gioi-thieu/page.tsx` : 95 | `leading-[1.55]` | `leading-body` |
| `components/content/ArticleCard.tsx` : 110 | `leading-[1.65]` | `leading-body` |
| `components/home/HomeVideoCarousel.tsx` : 90 | `leading-[1.4]` | `leading-title` |
| `components/catalog/RecentlyViewedSection.tsx` : 73 | `leading-[1.35]` (title) | `leading-title` |
| `components/ui/badge.tsx` : 6 | `leading-[12px]` | `leading-none` |

**Tracking ngoài 3 bậc cho phép** (cấm `tracking-tight/tighter/wider/widest` + cấm letter-spacing âm trừ display token):

| File : dòng | Hiện tại | Gợi ý |
|---|---|---|
| `app/not-found.tsx` : 33 | `tracking-tighter` | `tracking-normal` (hoặc `tracking-display`) |
| `app/not-found.tsx` : 36 | `tracking-tight` | `tracking-normal` |

**Leading built-in dùng trên heading (off-system, nên đổi sang role token):**

- `components/catalog/RecentlyViewedSection.tsx` : 41 — `<h2 ... leading-normal>` = 1.5 trên heading → **anti-pattern** (STYLEGUIDE: "KHÔNG để heading 1.5–1.75"). Đổi `leading-display`/`leading-title`.
- `app/huong-dan/GuidePage.tsx` : 113 — `leading-snug` (built-in 1.375) → `leading-title`.
- `app/gioi-thieu/page.tsx` : 214 — `leading-tight` (built-in 1.25) → `leading-heading`.
- `components/content/ArticleCard.tsx` (CSS `.bb-news-card-title`, globals.css:3121) — `line-height: 1.35` hardcode → token `--bb-line-snug`.

```tsx
// SiteFooter.tsx — gom mọi leading body về 1 token
- className="... leading-[1.45] ..."   // ×5 + 1.65 + 1.786rem
+ className="... leading-body ..."

// not-found.tsx:33,36 — bỏ tracking âm
- className="... tracking-tighter ..."
+ className="... tracking-normal ..."
```

---

## 3. Danh sách ưu tiên fix

### 🔴 High — sửa trước (tần suất cao / phá vỡ luật hệ thống / ảnh hưởng a11y-SEO)

1. **`ProductCard.tsx`** — thống nhất tên sản phẩm về `<h3>` + một token (`text-h4`/`bb-product-name`) cho mọi biến thể (2.2 + 2.5a). Component dùng toàn site.
2. **`SiteFooter.tsx`** — thay 8 `leading-[…]` arbitrary → `leading-body`/`leading-title`; 3 `text-[clamp…]` → token (`text-footer-slogan`/`text-h4`/`text-22`). Footer mọi trang (2.1 + 2.6).
3. **`HeaderNavItem.tsx`** — 4× `text-[13px]` → `text-13`/`text-sm`. Nav mọi trang (2.1).
4. **Toàn bộ `leading-[…]` arbitrary còn lại** (gioi-thieu, doi-tra, ArticleCard, HomeVideoCarousel, RecentlyViewedSection, badge) → role token (2.6). Trực tiếp vi phạm "mọi typography phải thuộc scale".
5. **Heading order trang chủ** `app/page.tsx` (h3 trước h1) (2.5e).

### 🟡 Medium

6. Heading dùng size cố định → token fluid: `FooterCollapsible.tsx:13`, `PolicySidebar.tsx:44`, `HomeVideoCarousel.tsx:80`, `doi-tra:71` (2.2).
7. `.bb-auth-heading` (globals.css:388) — thêm `font-heading` + đổi sang `--fs-h3` fluid; H1 auth đang 16px cố định (2.3).
8. `<p>`-as-heading: `lien-he:214`, `ProductContactCta:36`; `<div>`-as-title: `tin-tuc/[slug]:222,279` (2.5b, 2.5c).
9. `text-[3.125rem]` → `text-50` (ArticleCarousel); `text-[10px]` → `text-overline` (MobileSectionHeader) (2.1).
10. `leading-normal`/`snug`/`tight` trên heading → role token (2.6).

### 🟢 Low

11. `not-found.tsx` — `tracking-tight/tighter` → `tracking-normal`; clamp display bespoke (token hoá hoặc ghi chú ngoại lệ) (2.1, 2.6).
12. `PageHero.tsx:91` ghost-text clamp — token hoá khi tiện (2.1).
13. `HeroSlider.tsx:69` hero title `<p>` → cân nhắc heading (2.5d).
14. Xác minh runtime các file nhiều `<h1>` có điều kiện chỉ render 1 (2.5f).
15. Hội tụ `text-sm`/`text-xs` rải rác về `text-caption`/`text-overline` khi refactor (2.2, ghi chú).

---

### Phụ lục — lệnh quét tái sử dụng

```bash
# Arbitrary typography
grep -rnoE "(text|leading|tracking|font)-\[[^]]*\]" app components --include=*.tsx \
  | grep -vE "text-\[(#|rgb|hsl|var\(--)"
# Tracking ngoài 3 bậc
grep -rnE "tracking-(tight|tighter|wider|widest)" app components --include=*.tsx
# Override font-size theo breakpoint (phải = rỗng)
grep -rnE "(sm|md|lg|xl|2xl|3xl|4xl):text-(xs|sm|base|lg|xl|[2-9]xl|h[1-4])" app components --include=*.tsx
```
