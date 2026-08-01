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
| Font display / nav / CTA / nhãn chức năng (nhóm B) | Barlow Condensed (UPPERCASE) — **Oswald đã gỡ bỏ** |
| Font tiêu đề trang / tiêu đề nội dung / body / link (nhóm A) | Arial / Helvetica |
| Card | Nền trắng, chữ đen, border `#DDDDDD`, không shadow ở trạng thái nghỉ |
| Product card | Ảnh vuông 1:1, hover border đỏ + shadow nhẹ đỏ |
| Copy | Tiếng Việt đầy đủ dấu; nhóm B luôn viết HOA, nhóm A dùng sentence case |
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

> Source of truth chi tiết: [`docs/TYPOGRAPHY.md`](docs/TYPOGRAPHY.md). Hệ chữ chỉ có **11 nhóm**: 10 nhóm chữ đọc/chức năng và 1 nhóm trang trí nền. Mỗi nhóm có đúng một phông cố định, một cỡ mobile và một cỡ desktop.

Hai phông được giữ nguyên: **Arial / Helvetica** cho tiêu đề trang và nội dung; **Barlow Condensed** cho chữ chức năng/nhấn, luôn viết IN HOA. **Oswald không được dùng.**

| Nhóm | Vai trò | Phông cố định | Mobile `<768px` | Desktop `≥768px` | Ví dụ |
|---|---|---|---:|---:|---|
| B1 | Trang trí / Display | Barlow Condensed, IN HOA | 30px | 40px | Slogan footer, chữ hero trang trí, số kết quả bảng size |
| B2 | Liên hệ lớn | Barlow Condensed, IN HOA | 24px | 30px | Hotline/email lớn, “Thông tin cửa hàng” |
| B3 | Badge nhấn / % giảm | Barlow Condensed, IN HOA | 16px | 18px | “-20%”, nhãn giảm giá nổi bật |
| B4 | Nút · Menu · Tab | Barlow Condensed, IN HOA | 16px | 16px | Nút, menu chính, tab, nhãn Còn/Hết hàng |
| B5 | Nhãn nhỏ / Eyebrow / Badge | Barlow Condensed, IN HOA | 11px | 12px | Chữ dẫn nhỏ, badge, ngày đăng, nhãn thanh đáy, SKU |
| A1 | Tiêu đề lớn H1 | Arial / Helvetica | 26px | 32px | Tiêu đề khối lớn, tên và giá lớn trên trang sản phẩm |
| A2 | Tiêu đề trang H2 | Arial / Helvetica | 20px | 24px | Giỏ hàng, thanh toán, tài khoản, đăng nhập, thông báo thành công |
| A3 | Tiêu đề khối H3 | Arial / Helvetica | 18px | 20px | Tiêu đề khối, hộp thoại, sidebar |
| A4 | Nội dung + tiêu đề nhỏ | Arial / Helvetica | 16px | 18px | Đoạn văn, mô tả, tên bài/sản phẩm/card, ô nhập |
| A5 | Chú thích / Meta | Arial / Helvetica | 13px | 14px | Breadcrumb, phụ đề, nhãn form, giá phụ, bộ đếm |
| D | Trang trí nền | Phông tại thành phần | `clamp()` | `clamp()` | Chỉ số “404” mờ trong `app/not-found.tsx` |

Quy tắc:

- Mọi đoạn chữ phải thuộc đúng một nhóm A1–A5, B1–B5 hoặc D.
- Chỉ có một breakpoint cỡ chữ: `768px`. Mobile dùng `<768px`; desktop dùng `≥768px`.
- Sang mobile chỉ đổi cỡ, không đổi phông. Breakpoint siêu rộng chỉ được đổi bố cục/lưới, không đổi cỡ chữ.
- Nhóm B dùng Barlow Condensed và IN HOA; nhóm A dùng Arial/Helvetica. Body dùng sentence case.
- Giá theo cấp độ nơi hiển thị: giá lớn PDP = A1; tổng tiền = A2/A3; giá dòng = A4; giá card = A5.
- Không dùng letter-spacing âm.
- Letter-spacing chuẩn hóa về 3 token: `tracking-normal` (0) mặc định, `tracking-wide` (0.04em) cho uppercase nav/button/kicker, `tracking-display` (0.08em) cho eyebrow nổi bật. KHÔNG dùng arbitrary `tracking-[…]` hay thêm bậc mới (`tracking-wider/widest`).
- Không render chữ trắng nhỏ hơn 16px trên nền tối, trừ meta phụ có màu `#CECECE`.
- Form input dùng A4, luôn ≥16px để tránh iOS tự phóng to.

### Tailwind font-size utilities

Mười token cỡ chữ được định nghĩa trong `styles/brand-tokens.css` và expose qua Tailwind v4 `@theme inline` trong `app/globals.css`:

| Utility | Nhóm |
|---|---|
| `text-b1-display` · `text-b2-contact` · `text-b3-promo` · `text-b4-action` · `text-b5-label` | B1–B5 |
| `text-a1-title` · `text-a2-page` · `text-a3-section` · `text-a4-content` · `text-a5-meta` | A1–A5 |

Cấm dùng cỡ Tailwind mặc định (`text-sm`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`, `text-4xl`, `text-5xl`), arbitrary cỡ chữ (`text-[Npx]`, `text-[…em]`) và `font-size` hardcode khi đã có token nhóm. Ngoại lệ duy nhất được co giãn là số “404” mờ thuộc nhóm D.

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
- Title: Arial/Helvetica, A4, weight 600.
- Price: Arial/Helvetica, A5, weight 600, đỏ `#FF0C09`.
- Hover: border đỏ, shadow `0 4px 12px rgba(255,12,9,0.1)`.
- Add-to-cart bar: đen, chữ trắng, trượt lên khi hover; trên touch luôn hiện.

### Category Tiles (lưới danh mục trang chủ)

- Component: ô danh mục `CategoryListItem` dùng **chung một thiết kế** cho mọi breakpoint - chỉ responsive (co số cột + kích thước tile), không có layout mobile riêng.
- Cột theo breakpoint: 2 (mobile) · 3 (≥ 600) · 4 (≥ 768 desktop) · **6 (4xl ≥ 2560)**. Số cột là ước của 12 danh mục để hàng luôn đầy (12 item ở 4xl = 6 × 2 hàng).
- Divider: đường kẻ 1px grey `#CECECE` vẽ bằng **border trên từng tile** (border-right + border-bottom) + border top/left trên grid — **không** dùng nền xám lấp `gap`. Hàng cuối thiếu item sẽ không sinh mảng xám.
- Tile: nền trắng, cao 290px (mobile co còn 170px), radius `0`, không shadow ở trạng thái nghỉ.
- Icon: wrapper cố định 72px (mobile 48px) → 80px (≥ 1536) → 88px (≥ 2560), `object-contain`, căn giữa.
- Label: Arial/Helvetica, sentence case, weight 600, nhóm A4 (`text-a4-content`); clamp tối đa 2 dòng. Màn siêu rộng chỉ nới tile, không đổi cỡ chữ.
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
- **Outer page rail = component `<Container>`** (`components/layout/Container.tsx`, token `--bb-container-xl`): mặc định 1200px, tự nới 1360/1600/2240 ở 2xl/3xl/4xl. Dùng `<Container>` cho MỌI rail ngoài của trang — KHÔNG hardcode `mx-auto w-full max-w-[1200px] px-4 sm:px-6`. Grid có sidebar: `<Container className="grid …">`.
- Desktop padding 24px; tablet 24px; mobile 16px (qua token `--bb-page-padding-*` / `--bb-mobile-page-x`).
- Product grid: desktop 3 cột, tablet 2 cột, mobile 1 cột.
- Section spacing: desktop 72px, tablet 52px, mobile 32px.
- Touch target tối thiểu 44px.

### Page frame: hero vs hero-less (né logo header)

Header có logo-emblem thò xuống body ~92px (≥768px) · ~118px (3xl) · ~110px (4xl) khi ở đầu trang chưa cuộn. Hai biến thể khung xử lý việc này:

- **Hero**: render `<PageHero>` (banner tối 250/450px tự che logo). PageHero phát `data-page-hero` → `body:has([data-page-hero]) .bb-main { padding-top: 0 }`.
- **Hero-less**: KHÔNG banner. Mọi shell hero-less phát class **`bb-heroless`** trên phần tử gốc → `body:has(.bb-heroless) .bb-main` cấp `padding-top = header-stack + overhang` (tự động theo tier). Đây là cơ chế **duy nhất** — KHÔNG dùng allowlist class thủ công. Shell đã phát sẵn: `StaticPageShell` (khi `showHero={false}`), `AccountShell`, `ProductView`; loading twin tương ứng (`gio-hang/loading`, account skeleton) cũng phải phát. Trang hero-less mới → dùng một trong các shell này (hoặc phát `bb-heroless`) là được né logo sẵn. Né theo chiều DỌC, nội dung vẫn căn trái tự nhiên.

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

Mọi trang/component đều **nới đều** theo content rail ở `3xl`/`4xl`, không trang nào để dải trống hai bên hay lệch với phần còn lại. Các surface cũ ghim ở Bootstrap `.container` 1140px (header, footer, giỏ hàng, thanh toán, tài khoản, tin tức, trang tĩnh, home) nay bám `var(--bb-container-xl)` qua rule `body .container { max-width: var(--bb-container-xl) }` đặt trong block `UNIFORM ULTRA-WIDE EXPANSION` của `globals.css`. Các rail viết bằng Tailwind cũng nới đều nhờ đã đổi sang component `<Container>` (cùng token `--bb-container-xl`) — KHÔNG còn hardcode `max-w-[1200px]` cho rail ngoài (ngoại lệ: trang sản phẩm, xem dưới; và `<PageHero>` đã dùng chung `<Container>` để mép hero canh thẳng body).

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
- **PDP:** trang sản phẩm gắn class `.bb-product-page` (+ `.bb-heroless` để né logo) trên `#main-content`. Rail nội dung chốt **`max-w-[1200px]` cố định ở mọi tier** (quyết định owner 2026-07-11 — KHÔNG nới ở ultra-wide, giữ tỉ lệ gallery ảnh, mọi mép trong trang canh thẳng ở 1200). Đây là ngoại lệ có chủ đích: các trang khác nới đều, riêng PDP giữ 1200.

`bb-product-archive` / `bb-search-results-page` trong `globals.css` là **dead CSS** (không gắn vào markup) — giữ lại theo policy migration WP, **không** dùng làm hook cho rule mới; grid thật dùng Bootstrap `.col-md-3.col-6` trong `.product-list`.

> **Ngoại lệ - trang chi tiết sản phẩm (`/product/[slug]`):** toàn bộ các rail của trang **chốt `max-w-[1200px]` cố định ở mọi tier** (KHÔNG nới ở ultra-wide — quyết định owner 2026-07-11), gồm breadcrumb, khối tổng quan ảnh+mua hàng, tabs mô tả và carousel sản phẩm liên quan, để mọi mép trái/phải canh thẳng nhau. Lý do giữ 1200 thay vì nới: nới rộng sẽ sinh dải trắng lớn quanh khu ảnh, vỡ tỉ lệ gallery. Trong khối tổng quan, khu ảnh **lấp đầy cột 7fr** nên mép trái ảnh thẳng hàng breadcrumb/tabs; cột thumbnail dùng slide cao cố định 100px với `slidesPerView:"auto"`, **co theo số ảnh thật**: chiều cao thanh được tính bằng JS = `min(tổng-chiều-cao-thumbnail, chiều-cao-ảnh)` theo bậc 470/598/738px để Swiper có chiều cao xác định và cuộn được khi tràn. `self-start` chặn grid kéo giãn thanh. Nút cuộn chỉ hiện khi thumbnail thực sự tràn. Carousel liên quan giữ tối đa 4 cột cho khớp rail 1200px. Đây là ngoại lệ có chủ đích của riêng trang sản phẩm (khác các trang nới đều), phần rail né logo qua `.bb-heroless`.

> **Quy tắc:** Rule mới phải dùng Tailwind prefix (`sm:`/`md:`/`lg:`/`xl:`/`2xl:`/`3xl:`/`4xl:`) hoặc các giá trị pixel tương ứng trong media query. Không thêm breakpoint ad-hoc mới ngoài 7 tier trên. Khi thêm class `4xl:`, kiểm tra rằng container/grid cha cũng đã có rule tương ứng để tránh layout lệch ở viewport ≥ 2560px.

### Legacy breakpoints (giữ nguyên, không ép đổi hàng loạt)

| Giá trị | Lý do tồn tại |
|---|---|
| `575px` / `576px` | Mốc lưới legacy từ WP — chỉ dùng cho bố cục, không đổi cỡ chữ |
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
