# BigBike Web Styleguide

> Cập nhật ngày 2026-05-12: `bigbike-web` áp dụng theo file thiết kế do user cung cấp tại `C:\Users\vomin\Downloads\DESIGN.md`.
> Track B light-first WP-parity đã được chọn — xem `docs/audits/BIGBIKE_WEB_BACKGROUND_COLOR_AUDIT.md`.
>
> File này là nguồn rút gọn cho giao diện `bigbike-web`. Khi thay đổi token, layout, component hoặc trạng thái UI, phải giữ code khớp các quy tắc dưới đây.

---

## Nguyên Tắc Bắt Buộc

| Mục | Quy tắc |
|---|---|
| Theme | Light-first (WP-parity): nền trang `#ffffff`, chữ đen; header và footer giữ dark |
| CTA chính | Đỏ `#FF0C09`, dùng cho mua hàng, khẩn cấp, giá sale |
| Link / tương tác phụ | Xanh `#007BFF` |
| Chat / hỗ trợ | Cyan `#00BFFF`, nút tròn cố định góc phải dưới |
| Bo góc | `0px` cho mọi component thường; chỉ phần tử tròn thật sự dùng `50%` |
| Font body / link | Arial |
| Font heading / display / nav / CTA / label | Barlow Condensed (UPPERCASE) — **Oswald đã gỡ bỏ** |
| Card | Nền trắng, chữ đen, border `#DDDDDD`, không shadow ở trạng thái nghỉ |
| Product card | Ảnh vuông 1:1, hover border đỏ + shadow nhẹ đỏ |
| Copy | Tiếng Việt đầy đủ dấu; CTA và heading thường viết HOA |
| Emoji | Không dùng |

---

## Palette

```css
--bb-brand-primary: #ff0c09;
--bb-brand-primary-hover: #e50a07;
--bb-brand-primary-active: #cc0906;
--bb-color-blue: #007bff;
--bb-color-cyan: #00bfff;

/* Light-first (WP-parity) */
--bb-bg-page: #ffffff;
--bb-bg-section: #ffffff;
--bb-bg-surface: #ffffff;
--bb-bg-surface-raised: #f5f5f5;
--bb-bg-surface-hover: #fff4f3;
--bb-bg-surface-alt: #f8f8f8;

/* Dark surfaces: header, footer, drawers, toasts */
--bb-bg-surface-dark: #141414;
--bb-bg-surface-dark-2: #0d0d0d;
--bb-bg-surface-dark-3: #111111;
--bb-color-footer-top: #3a3a3a;

/* Text on light background */
--bb-text-primary: #000000;
--bb-text-secondary: #6f6f6f;
--bb-text-muted: #abb8c3;

/* Text on dark surfaces (header, footer) */
--bb-text-inverse: #ffffff;
--bb-text-inverse-secondary: #cecece;

--bb-border-subtle: #dddddd;
--bb-border-default: #cecece;
--bb-border-strong: #abb8c3;
```

State colors:

- Danger: `#FF0C09`
- Warning: `#FCB900`
- Info: `#007BFF`
- Chat: `#00BFFF`
- Success: `#2E7D32` (token `--bb-color-success` / Tailwind `text-success`) — ngoại lệ chức năng duy nhất dùng xanh lá (VD: "Còn hàng", huy hiệu "Chính hãng"). KHÔNG dùng cho logo, CTA hay bất kỳ phần tử thương hiệu nào khác.

Accessibility mappings:

- `#FF0C09` remains the canonical brand red primitive. For small text, links, prices, badges, and button backgrounds that carry white text, use the AA-safe red token (`--bb-brand-primary-aa`, currently `#CC0906`).
- `#007BFF` remains the canonical blue primitive. For body links and small informational text on light backgrounds, use `--bb-link-text` (currently `#005FCC`).
- On dark header surfaces, red hover/active states may use the canonical brand red (`--bb-brand-primary-on-dark`). On the footer top strip `#3A3A3A`, use `--bb-brand-primary-inverse` for red hover accents.
- Default subtle dividers can stay light (`#DDDDDD` / `#CECECE`), but form controls and selected/important borders must use `--bb-border-control` or a stronger token.

---

## Typography

> Source of truth chi tiết: [`docs/TYPOGRAPHY.md`](docs/TYPOGRAPHY.md). **Oswald đã gỡ bỏ.** Mô hình hiện tại: cỡ chữ **CỐ ĐỊNH theo pixel WP-parity** (đã gỡ toàn bộ `clamp()` fluid kể từ 2026-06-08). Chỉ section-title có một bậc nhảy tại `@768px`. Không scale theo màn lớn.

Hai font thực: **Arial / Helvetica** (body/UI toàn trang) và **Barlow Condensed** (CTA/nav/heading/label, UPPERCASE).

| Vai trò | Font | Cỡ chữ | Weight | Line height |
|---|---|---:|---:|---:|
| Display-XL | — | 80px (`--fs-display-xl`) | 600 | 1.1 |
| Display | — | 40px (`--fs-display`) | 600 | 1.1 |
| H1 / Page banner | Arial | 24px (`--fs-h1`) | 600 | 1.1 |
| H2 | Arial | 24px (`--fs-h2`) | 600 | 1.2 |
| H3 | Arial | 20px (`--fs-h3`) | 600 | 1.2 |
| H4 | Arial | 18px (`--fs-h4`) | 600 | 1.2 |
| Section title | Arial | 24px mobile → 35px (≥768px) (`--bb-text-section-title`) | 600 | 1.2 |
| Body | Arial | 16px (`--fs-body`) | 400 | 1.5 |
| Body-LG | Arial | 18px (`--fs-body-lg`) | 400 | 1.5 |
| Button / CTA | Barlow Condensed | 16px (`--fs-button`) | 600 | 1.2 |
| Nav | Barlow Condensed | 16px (`--bb-text-nav`) | 600 | 1 |
| Meta / overline / badge | Barlow Condensed | 12px (`--fs-overline`) | 900 | 1 |
| Caption | Arial | 14px (`--fs-caption`) | 400 | 1.5 |
| News title | Barlow Condensed | 20px (`--bb-text-news-title`) | 600 | 1.2 |
| Product title | Arial | 16px (`--bb-text-product-title`) | 600 | 1.25 |
| Footer slogan | Barlow Condensed | 48px (`--bb-text-footer-slogan`) | 500 | 1.2 |

Quy tắc:

- Section title, product title: uppercase + Arial.
- Nav, badge, CTA, eyebrow, kicker: uppercase + Barlow Condensed.
- Body text dùng sentence case + Arial.
- Không dùng letter-spacing âm.
- Letter-spacing chuẩn hóa về 3 token: `tracking-normal` (0) mặc định, `tracking-wide` (0.04em) cho uppercase nav/button/kicker, `tracking-display` (0.08em) cho eyebrow nổi bật. KHÔNG dùng arbitrary `tracking-[…]` hay thêm bậc mới (`tracking-wider/widest`).
- Không render chữ trắng nhỏ hơn 16px trên nền tối, trừ meta phụ có màu `#CECECE`.
- Form input dùng `--fs-body` (≥16px) → tránh iOS auto-zoom.

### Tailwind font-size utilities

Token cỡ chữ expose thành Tailwind utility trong `app/globals.css` (`@theme inline`). Heading cấp trang phải dùng **utility token** — KHÔNG dùng `text-2xl`/`text-3xl` Tailwind cố định hay arbitrary `text-[26px]`.

> **Quy tắc đồng bộ cỡ chữ (2026-07-10):** Mọi component React/shadcn trong `components/ui|catalog|content|layout` và các trang `app/` **KHÔNG** dùng arbitrary `text-[Npx]` khi đã có token tương đương. Mỗi vai trò map về đúng 1 token: meta/eyebrow→`text-overline` (12), caption/phụ→`text-caption` (14), body/input→`text-body` (16), nút/CTA→`text-button` (16), card/dialog/h4→`text-h4` (18), sub-heading→`text-h3` (20), heading→`text-h2`/`text-h1` (24), số hiển thị lớn→`text-display`; control cố định không phải heading (stepper, nút lg, avatar) dùng `text-ui-*`. Cỡ trang trí riêng (`PageHero` watermark, `404`, `SearchToggle`) được giữ `clamp()`/`text-ui-*` khi cần bảo toàn tỷ lệ đã duyệt.

**Canonical scale (dùng cho component mới / refactor)** — map tới `--fs-*` (cố định, WP-parity):

| Utility | Token nguồn | Giá trị |
|---|---|---|
| `text-display-xl` / `text-display` | `--fs-display-xl` / `--fs-display` | 80px / 40px |
| `text-h1` / `text-h2` / `text-h3` / `text-h4` | `--fs-h1…h4` | 24px / 24px / 20px / 18px |
| `text-body-lg` / `text-body` | `--fs-body-lg` / `--fs-body` | 18px / 16px |
| `text-button` / `text-caption` / `text-overline` | `--fs-button` / `--fs-caption` / `--fs-overline` | 16px / 14px / 12px |

**Fixed-px UI scale** — dùng cho button, badge, price, dense label (KHÔNG scale):

| Utility | Giá trị |
|---|---|
| `text-ui-9` … `text-ui-17` | 9–17px (mỗi bước) |
| `text-ui-18` / `text-ui-20` / `text-ui-22` / `text-ui-24` / `text-ui-26` / `text-ui-30` / `text-ui-32` / `text-ui-35` | 18–35px |

**WP-parity heading + section:**

| Utility | Token nguồn | Giá trị |
|---|---|---|
| `text-section-title` | `--bb-text-section-title` | 24px mobile → 35px (≥768px) |
| `text-hero` | `--bb-text-hero` | 18px cố định |
| `text-news-title` / `text-product-title` | `--bb-text-news-title` / `--bb-text-product-title` | 20px / 16px cố định |
| `text-footer-slogan` | `--bb-text-footer-slogan` | 48px cố định |

**Numeric WP-parity (chỉ dùng khi khớp pixel WP gốc):**

| Utility | Token nguồn | Giá trị thực |
|---|---|---|
| `text-22` / `text-26` / `text-32` / `text-40` / `text-50` | `--bb-text-22…50` | 18 / 20 / 24 / 26 / 30px |
| `text-9` / `text-10` / `text-11` / `text-13` / `text-15` / `text-17` | `--bb-text-9…17` | 12 / 12 / 12 / 14 / 15 / 17px |

### Thang chữ trang chi tiết sản phẩm — PDP type scale (2026-06-20)

PDP (`app/product/[slug]`, scope `.bb-product-page`) gom về **5 bậc cố định** trên desktop (modular ~1,25), thay cho mớ 9 cỡ rời rạc trước đó. Thang này dùng token `text-ui-*` để giữ đúng kích thước đã được xác minh trên desktop:

| Bậc | Utility | px | Dùng cho |
|---|---|---:|---|
| Điểm nhấn (Display) | `text-ui-32` | 32 | Tên sản phẩm (`.product_title`), giá bán, điểm đánh giá trung bình |
| Tiêu đề khối | `text-ui-24` / `.pdp-section-head .title` | 24 | Tên các khối (Mô tả/Thông số/Đánh giá/Tương tự/Đã xem), số thông số nổi bật |
| Tiêu đề phụ | `text-ui-20` | 20 | Heading trong mô tả, tên thuộc tính + ô chọn, câu hỏi FAQ, tên/tiêu đề review, nút Gọi/Zalo |
| Nội dung | `text-ui-18` | 18 | Đoạn văn mô tả, bảng thông số, dòng ưu/nhược, cam kết, nội dung review |
| Chữ nhỏ | `text-ui-14` | 14 | Eyebrow, figcaption, nhãn số liệu, ngày/meta review, nhãn form |

- **Mobile (`max-md:`, <768px) = mỗi bậc −2px:** 30 / 22 / 18 / 16 / 12. Áp qua biến thể `max-md:text-ui-*` trên từng phần tử (giá giữ `!`, checkmark giữ `after:`); phần CSS-driven (`.product_title` 32→30, `.pdp-section-head .title` + `.block-title` 24→22) xử lý trong `app/globals.css`.
- Tiêu đề khối 24/22px là ngoại lệ có chủ đích (trang chủ vẫn 35px); quy tắc được giới hạn trong `.bb-product-page` nên không ảnh hưởng trang chủ.
- Phần tử chỉ-mobile (sticky bar, anchor nav, heading tab `md:hidden`) KHÔNG nằm trong thang desktop này.

**Trang Tin tức** áp cùng tinh thần: tên bài và tiêu đề khối 18px, ngày/chuyên mục 12px, thân bài 16px, h2/h3 trong bài 22/18px. Tiêu đề hero dùng chung mọi archive nên giữ nguyên. **Tài khoản:** tiêu đề trang 24px (mobile 22px). Các trang giỏ hàng, thanh toán, đăng nhập và trang tĩnh giữ tỷ lệ hiển thị đã được duyệt.

---

## Component Rules

### Buttons

- Primary: nền `#FF0C09`, chữ trắng, padding `16px 32px`, radius `0`, border none.
- Secondary: nền trắng, chữ đỏ, border đỏ `2px`, radius `0`.
- Ghost: transparent, chữ/border xanh `#007BFF`, radius `0`.
- Hover primary: `#E50A07`, lift nhẹ `translateY(-1px)` hoặc scale tối đa `1.02`.
- Disabled: nền `#CECECE`, không transform.

### Product Cards

- Nền trắng, chữ đen, padding 20px, border `1px solid #DDDDDD`, radius `0`.
- Ảnh vuông 1:1, full width.
- Title: Barlow Condensed 18/600/20.
- Price: Barlow Condensed 16/600, đỏ `#FF0C09`.
- Hover: border đỏ, shadow `0 4px 12px rgba(255,12,9,0.1)`.
- Add-to-cart bar: đen, chữ trắng, trượt lên khi hover; trên touch luôn hiện.

### Category Tiles (lưới danh mục trang chủ)

- Component: ô danh mục `CategoryListItem` dùng **chung một thiết kế** cho mọi breakpoint - chỉ responsive (co số cột + kích thước tile), không có layout mobile riêng.
- Cột theo breakpoint: 2 (mobile) · 3 (≥ 600) · 4 (≥ 768 desktop) · **6 (4xl ≥ 2560)**. Số cột là ước của 12 danh mục để hàng luôn đầy (12 item ở 4xl = 6 × 2 hàng).
- Divider: đường kẻ 1px grey `#CECECE` vẽ bằng **border trên từng tile** (border-right + border-bottom) + border top/left trên grid — **không** dùng nền xám lấp `gap`. Hàng cuối thiếu item sẽ không sinh mảng xám.
- Tile: nền trắng, cao 290px (mobile co còn 170px), radius `0`, không shadow ở trạng thái nghỉ.
- Icon: wrapper cố định 72px (mobile 48px) → 80px (≥ 1536) → 88px (≥ 2560), `object-contain`, căn giữa.
- Label: Barlow Condensed, UPPERCASE, weight 600, 17px (mobile 13px) → 18 (≥ 1536) → 20px (≥ 2560), clamp tối đa 2 dòng.
- Hover: ảnh đỏ `cat-hover.jpg` phủ kín tile (200ms), icon invert trắng + scale `1.06`, label trắng.
- Active: icon scale `0.97`. Focus-visible: outline `2px solid var(--bb-link-text)` (`#005FCC`), offset `-3px`.

### Inputs

- Nền trắng, chữ đen, padding `12px 16px`, border `#DDDDDD`, radius `0`.
- Focus: border xanh `#007BFF`, ring `rgba(0,123,255,0.1)`.
- Error: border đỏ, nền `#FFF4F3`.

### Navigation

- Header nền đen, cao 80px (5rem desktop / 60px mobile), chữ trắng.
- Nav hover/active: đỏ `#FF0C09`, underline đỏ.
- Cart badge: đỏ, chữ trắng, tròn.

### Footer

- Top strip nền `#3A3A3A` (khớp WP).
- Bottom bar nền `#000000`.
- Heading trắng, link `#CECECE`, hover đỏ.
- Divider `#333333`.
- Nội dung pháp lý trên nền xám dùng token `--bb-text-footer-legal`.

### Hero / Impact Sections

- Nền đen hoặc ảnh có overlay tối.
- Padding desktop `60px 52px`, mobile giảm về 32px.
- Chữ trắng, CTA đỏ.

---

## Layout

- Spacing theo thang 4px.
- Container tối đa 1200px.
- Desktop padding 24px; tablet 24px; mobile 16px.
- Product grid: desktop 3 cột, tablet 2 cột, mobile 1 cột.
- Section spacing: desktop 72px, tablet 52px, mobile 32px.
- Touch target tối thiểu 44px.

---

## Responsive

### Breakpoint policy (canonical — áp dụng cho rule mới)

| Token / prefix Tailwind | px | Dùng khi |
|---|---|---|
| _(default)_ | < 640px | mobile — 1 cột, padding 16px |
| `sm:` | ≥ 640px | tablet nhỏ — 2 cột nhẹ, padding 24px |
| `md:` | ≥ 768px | tablet — layout 2 cột ổn định |
| `lg:` | ≥ 1024px | desktop — 3 cột / sidebar, padding 32px |
| `xl:` | ≥ 1280px | large desktop — grid mở rộng |
| `2xl:` | ≥ 1536px | extra-large — điều chỉnh spacing/type scale |
| `3xl:` | ≥ 1920px | ultra-wide — full-bleed hero, container override 1600px |
| `4xl:` | ≥ 2560px | wide-screen workstation / 32:9 super-ultrawide / showroom TV — container 2240px, grid sản phẩm 6 cột |

Container max-width: `--bb-container-xl` co giãn theo tier — `75rem` (1200px) mặc định → `85rem` (1360px) tại `2xl` → `100rem` (1600px) tại `3xl` → `140rem` (2240px) tại `4xl`. Override tập trung trong block `LARGE-DESKTOP RESPONSIVE EXPANSION` của `globals.css`.

### Uniform ultra-wide expansion (phương án B — toàn site, chỉ `3xl`/`4xl`)

Mọi trang/component đều **nới đều** theo content rail ở `3xl`/`4xl`, không trang nào để dải trống hai bên hay lệch với phần còn lại. Các surface cũ ghim ở Bootstrap `.container` 1140px (header, footer, giỏ hàng, thanh toán, tài khoản, tin tức, trang tĩnh, home) nay bám `var(--bb-container-xl)` qua rule `body .container { max-width: var(--bb-container-xl) }` đặt trong block `UNIFORM ULTRA-WIDE EXPANSION` của `globals.css`.

**Ràng buộc tuyệt đối:** block này **chỉ chứa media query `min-width:1920px` và `min-width:2560px`**; không tác động bất kỳ breakpoint nào ≤ `2xl`. Lấy hệ token `2xl→3xl→4xl` làm chuẩn cho đích width (1600/2240). Selector `body .…` được giữ để cô lập quy tắc màn hình rộng khỏi các phạm vi khác.

Densify lưới (giữ kích thước tile ~constant, đặt cùng block):

| Lưới | Selector | `3xl` | `4xl` |
|---|---|---|---|
| Sản phẩm archive/category/search (có sidebar) | `.product-list .col-md-3.col-6` | 5 cột | 6 cột |
| Danh mục trang chủ (full-width) | `.product-category-list .col-md-3.col-6` | 5 cột | 6 cột |
| Tin tức (có sidebar) | `.bb-blog-listing-parity .col-md-4` | 4 cột | 5 cột |
| Thương hiệu (`/brands`) | Tailwind `lg:grid-cols-5` | `3xl:grid-cols-6` | `4xl:grid-cols-7` |
| Carousel logo hãng (home) | Swiper `breakpoints` | `1920: 6` | `2560: 7` |

Cap để giữ chất lượng khi container rộng:
- **Cột chữ (prose):** `.blog-content.wyswyg` (bài viết) và `.col-md-9 > .static-page.wyswyg` (trang tĩnh có sidebar) cap `1000px`/`1100px` để dòng không quá dài. Trang `gioi-thieu`/`lien-he` (`.static-page.wyswyg` full-width `col-md-12`) **không** cap.
- **Sidebar tài khoản:** `.account-dashboard > .row > .col-md-3` cap `320px`/`360px` (khớp tỉ lệ `.bb-account-layout`), content lấy phần còn lại.
- **PDP:** trang sản phẩm gắn class `.bb-product-page` trên `#main-content`; mọi rail của nó **chốt 1600px ở `4xl`**, nối tiếp ngoại lệ rail 1600 bên dưới.

`bb-product-archive` / `bb-search-results-page` trong `globals.css` là **dead CSS** (không gắn vào markup) — giữ lại theo policy migration WP, **không** dùng làm hook cho rule mới; grid thật dùng Bootstrap `.col-md-3.col-6` trong `.product-list`.

> **Ngoại lệ - trang chi tiết sản phẩm (`/product/[slug]`):** toàn bộ các rail của trang **chốt tối đa 1600px ở `4xl`** thay vì 2240px, gồm breadcrumb, khối tổng quan ảnh+mua hàng, tabs mô tả và carousel sản phẩm liên quan, để mọi mép trái/phải canh thẳng nhau. Lý do chốt 1600 thay vì 2240: nếu nới tới 2240px sẽ sinh dải trắng rất lớn quanh khu ảnh, vỡ tỉ lệ. Trong khối tổng quan, khu ảnh **lấp đầy cột 7fr** nên mép trái ảnh thẳng hàng breadcrumb/tabs; cột thumbnail dùng slide cao cố định 100px với `slidesPerView:"auto"`, **co theo số ảnh thật**: chiều cao thanh được tính bằng JS = `min(tổng-chiều-cao-thumbnail, chiều-cao-ảnh)` theo bậc 470/598/738px để Swiper có chiều cao xác định và cuộn được khi tràn. `self-start` chặn grid kéo giãn thanh. Nút cuộn chỉ hiện khi thumbnail thực sự tràn. Carousel liên quan giữ tối đa 4 cột cho khớp container 1600px. Đây là ngoại lệ có chủ đích của riêng trang sản phẩm, không áp cho các trang khác.

> **Quy tắc:** Rule mới phải dùng Tailwind prefix (`sm:`/`md:`/`lg:`/`xl:`/`2xl:`/`3xl:`/`4xl:`) hoặc các giá trị pixel tương ứng trong media query. Không thêm breakpoint ad-hoc mới ngoài 7 tier trên. Khi thêm class `4xl:`, kiểm tra rằng container/grid cha cũng đã có rule tương ứng để tránh layout lệch ở viewport ≥ 2560px.

### Legacy breakpoints (giữ nguyên, không ép đổi hàng loạt)

| Giá trị | Lý do tồn tại |
|---|---|
| `575px` / `576px` | WP-parity typography scale từ brand-tokens.css — đổi sang 640px cần visual regression test |
| `767px` / `768px` | Bootstrap 3 mobile boundary từ WP theme — trùng Tailwind `md:` nhưng off-by-one |
| `900px` / `991px` / `992px` | WP two-column layout threshold — đổi sang `lg: 1024px` cần review layout |
| `600px` | Homepage legacy selector — đổi sang 640px risk regression trên phone 360-600px |
| `1260px` | Nav flyout clamp threshold — specific to nav overflow fix |

Các breakpoint legacy được annotate trong globals.css với comment `/* BP note: ... */`.

---

## Update Rule

Nếu `DESIGN.md` thay đổi, cập nhật theo thứ tự:

1. `bigbike-web/STYLEGUIDE.md`
2. `bigbike-web/styles/brand-tokens.css`
3. `bigbike-web/app/globals.css`
4. Component liên quan nếu CSS token chưa đủ
