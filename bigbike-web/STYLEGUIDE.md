# BigBike Web Styleguide

> Cập nhật ngày 2026-08-01: `bigbike-web` áp dụng desktop canvas cố định 1440px; giao diện tại 1440px là baseline, không nới theo viewport lớn hơn.
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
| Chat / hỗ trợ | Cyan riêng (`--bb-chat-title-bg`), nút tròn cố định góc phải dưới |
| Bo góc | `0px` cho mọi component thường; chỉ phần tử tròn thật sự dùng `50%` |
| Font body / link | Arial |
| Font display / CTA / nhãn chức năng (nhóm B) | Arial / Helvetica (UPPERCASE) — **Oswald và font display riêng đã gỡ bỏ** |
| Font menu chính | Arial / Helvetica, giữ nguyên kiểu chữ của nhãn dữ liệu — **Oswald và font display riêng đã gỡ bỏ** |
| Font tiêu đề trang / tiêu đề nội dung / body / link (nhóm A) | Arial / Helvetica |
| Card | Nền trắng, chữ đen, border `#DDDDDD`, không shadow ở trạng thái nghỉ |
| Product card | Ảnh vuông 1:1, hover border đỏ + shadow nhẹ đỏ |
| Copy | Tiếng Việt đầy đủ dấu; nhóm B luôn viết HOA, riêng menu chính giữ nguyên kiểu chữ của nhãn; nhóm A dùng sentence case |
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
- Chat: dùng token riêng `--bb-chat-title-bg`, không dùng màu chủ đạo
- Success: `#2E7D32` (token `--bb-color-success` / Tailwind `text-success`)

Accessibility mappings:

- `#FF0C09` remains the canonical brand red primitive. For small text, links, prices, badges, and button backgrounds that carry white text, use the AA-safe red token (`--bb-brand-primary-aa`, currently `#CC0906`).
- `#007BFF` remains the canonical blue primitive. For body links and small informational text on light backgrounds, use `--bb-link-text` (currently `#005FCC`).
- On dark header surfaces, red hover/active states may use the canonical brand red (`--bb-brand-primary-on-dark`). On the footer top strip `#3A3A3A`, use `--bb-brand-primary-inverse` for red hover accents.
- Default subtle dividers can stay light (`#DDDDDD` / `#CECECE`), but form controls and selected/important borders must use `--bb-border-control` or a stronger token.

---

## Typography

> Source of truth chi tiết: [`docs/TYPOGRAPHY.md`](docs/TYPOGRAPHY.md). Hệ chữ chỉ có **11 nhóm**: 10 nhóm chữ đọc/chức năng và 1 nhóm trang trí nền. Mỗi nhóm có đúng một phông cố định, một cỡ mobile và một cỡ desktop.

Toàn bộ typography dùng **Arial / Helvetica** cho tiêu đề, nội dung và chữ chức năng/nhấn; nhóm B mặc định viết IN HOA, riêng menu chính giữ nguyên kiểu chữ của nhãn. **Oswald và font display riêng không được dùng.**

| Nhóm | Vai trò | Phông cố định | Mobile `<768px` | Desktop `≥768px` | Ví dụ |
|---|---|---|---:|---:|---|
| B1 | Trang trí / Display | Arial / Helvetica, IN HOA | 30px | 40px | Slogan footer, chữ hero trang trí, số kết quả bảng size |
| B2 | Liên hệ lớn | Arial / Helvetica, IN HOA | 24px | 30px | Hotline/email lớn, “Thông tin cửa hàng” |
| B3 | Badge nhấn / % giảm | Arial / Helvetica, IN HOA | 16px | 18px | “-20%”, nhãn giảm giá nổi bật |
| B4 | Nút · Menu · Tab | Arial / Helvetica | 16px | 18px | Nút/tab/nhãn Còn-Hết hàng viết HOA; menu chính giữ nguyên kiểu chữ của nhãn |
| B5 | Nhãn nhỏ / Eyebrow / Badge | Arial / Helvetica, IN HOA | 11px | 12px | Chữ dẫn nhỏ, badge, ngày đăng, nhãn thanh đáy, SKU |
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
- Nhóm B dùng Arial/Helvetica và mặc định IN HOA; riêng menu chính giữ nguyên kiểu chữ của nhãn. Nhóm A dùng Arial/Helvetica. Body dùng sentence case.
- Giá theo cấp độ nơi hiển thị: giá lớn PDP = A1; tổng tiền = A2/A3; giá dòng = A4; giá card = A5.
- Không dùng letter-spacing âm.
- Letter-spacing chuẩn hóa về 3 token: `tracking-normal` (0) mặc định, `tracking-wide` (0.04em) cho nav/button/kicker, `tracking-display` (0.08em) cho eyebrow nổi bật. KHÔNG dùng arbitrary `tracking-[…]` hay thêm bậc mới (`tracking-wider/widest`).
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
- Title: Arial/Helvetica, A4 variant, 16px on mobile and desktop, weight 600.
- Price: Arial/Helvetica, A5, weight 600, đỏ `#FF0C09`.
- Hover: border đỏ, shadow `0 4px 12px rgba(255,12,9,0.1)`.
- Add-to-cart bar: đen, chữ trắng, trượt lên khi hover; trên touch luôn hiện.

### Rating display

- Public product ratings always show five stars and the approved-review count.
- No approved reviews: use five neutral outline stars, `Chưa có đánh giá`/`No reviews yet`, and `0 đánh giá`/`0 reviews`; never show `0/5` or a default score.
- Approved reviews: show the one-decimal average, partial star fill when needed, and the review count.
- Inconsistent count/score data: keep neutral stars and the safe count; do not invent a score. Use existing brand, muted-text and spacing tokens.

### Category Tiles (lưới danh mục trang chủ)

- Component: ô danh mục `CategoryListItem` dùng **chung một thiết kế** cho mọi breakpoint - chỉ responsive (co số cột + kích thước tile), không có layout mobile riêng.
- Cột theo breakpoint: 2 (mobile) · 3 (≥ 600) · 4 (≥ 768 desktop). Màn hình rộng hơn không tăng số cột vì toàn site giữ nguyên baseline 1440px.
- Divider: đường kẻ 1px grey `#CECECE` vẽ bằng **border trên từng tile** (border-right + border-bottom) + border top/left trên grid — **không** dùng nền xám lấp `gap`. Hàng cuối thiếu item sẽ không sinh mảng xám.
- Tile: nền trắng, cao 290px (mobile co còn 170px), radius `0`, không shadow ở trạng thái nghỉ.
- Icon: wrapper cố định 72px (mobile 48px), `object-contain`, căn giữa; không tăng kích thước theo viewport siêu rộng.
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
- **Desktop content canvas = 1440px** (token `--bb-desktop-canvas`): nội dung chrome của header và các khối media rộng giữ baseline 1440px, căn giữa bằng `margin-inline: auto`. Đây là giới hạn của **nội dung**, không phải giới hạn của dải nền ngoài.
- **Inner content rail = component `<Container>`** (`components/layout/Container.tsx`, token `--bb-container-xl`): cố định tối đa 1200px ở mọi desktop tier. Dùng `<Container>` cho mọi rail nội dung ngoài của trang — KHÔNG hardcode wrapper 1200px riêng lẻ. Grid có sidebar: `<Container className="grid …">`.
- **Full-bleed surface = 100% viewport**: header background, homepage hero, `PageHero`, section có ảnh/nền trang trí toàn khối, bản đồ Liên hệ và hai dải footer phải phủ hết chiều rộng viewport. Chữ, card, form, menu và carousel item bên trong vẫn dùng canvas 1440px hoặc rail 1200px; không kéo giãn card để lấp màn hình.
- Desktop padding 24px; tablet 24px; mobile 16px (qua token `--bb-page-padding-*` / `--bb-mobile-page-x`).
- Product grid: desktop 3 cột, tablet 2 cột, mobile 1 cột.
- Section spacing: desktop 72px, tablet 52px, mobile 32px.
- Touch target tối thiểu 44px.

### Page frame: hero vs hero-less (né logo header)

Header có logo-emblem thò xuống body ~92px ở mọi desktop tier (≥768px) khi ở đầu trang chưa cuộn. Hai biến thể khung xử lý việc này:

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
| `2xl:` | ≥ 1536px | extra-large — mốc kiểm tra canvas; không nới content rail |
| `3xl:` | ≥ 1920px | full HD — mốc nghiệm thu canvas; không tăng spacing, cột hoặc component |
| `4xl:` | ≥ 2560px | QHD/ultra-wide — mốc nghiệm thu canvas; không tăng spacing, cột hoặc component |

Content canvas max-width: `--bb-desktop-canvas = 90rem` (1440px). Inner content max-width: `--bb-container-xl = 75rem` (1200px) ở mọi tier. Full-bleed surface không có `max-width`.

### Fixed desktop canvas (toàn site)

- Header/footer background và các media surface được đánh dấu full-bleed phủ viewport; nội dung bên trong không vượt content canvas 1440px.
- Inner `<Container>` giữ 1200px. Các giới hạn đọc nội dung, sidebar, PDP, checkout và account tiếp tục giữ max-width riêng nếu đã hẹp hơn.
- Lưới, card, carousel, icon, spacing và header height giữ đúng trạng thái tại 1440px khi viewport lên 1536/1920/2560px.
- Thành phần `position: fixed` phục vụ thao tác (drawer, dialog, mobile bottom navigation, sticky purchase bar, chat, scroll-to-top) vẫn bám viewport; không ép vào canvas.
- Không đặt `max-width: 1440px` lên `<main>`, `<header>` hoặc `<footer>` ngoài cùng. Full-bleed phải đến từ cấu trúc wrapper, không dùng `100vw` breakout bên trong rail vì dễ sinh tràn ngang.

`bb-product-archive` / `bb-search-results-page` trong `globals.css` là **dead CSS** (không gắn vào markup) — giữ lại theo policy migration WP, **không** dùng làm hook cho rule mới; grid thật dùng Bootstrap `.col-md-3.col-6` trong `.product-list`.

> **Trang chi tiết sản phẩm (`/product/[slug]`):** toàn bộ rail tiếp tục chốt `max-w-[1200px]` ở mọi tier, gồm breadcrumb, khối ảnh+mua hàng, tabs mô tả và carousel liên quan. Khu ảnh, thumbnail và cơ chế né logo giữ nguyên; canvas mới chỉ giới hạn khung ngoài.

> **Quy tắc:** Rule mới phải dùng breakpoint canonical. Không dùng `2xl:`/`3xl:`/`4xl:` để tăng chiều rộng, số cột, khoảng cách, typography hoặc kích thước component bên trong canvas.

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
