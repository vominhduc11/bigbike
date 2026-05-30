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
| Font body / link | Barlow |
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

Accessibility mappings:

- `#FF0C09` remains the canonical brand red primitive. For small text, links, prices, badges, and button backgrounds that carry white text, use the AA-safe red token (`--bb-brand-primary-aa`, currently `#CC0906`).
- `#007BFF` remains the canonical blue primitive. For body links and small informational text on light backgrounds, use `--bb-link-text` (currently `#005FCC`).
- On dark header surfaces, red hover/active states may use the canonical brand red (`--bb-brand-primary-on-dark`). On the footer top strip `#3A3A3A`, use `--bb-brand-primary-inverse` for red hover accents.
- Default subtle dividers can stay light (`#DDDDDD` / `#CECECE`), but form controls and selected/important borders must use `--bb-border-control` or a stronger token.

---

## Typography

> Source of truth chi tiết: [`docs/TYPOGRAPHY.md`](docs/TYPOGRAPHY.md) — superfamily Barlow, fluid `clamp()`. **Oswald đã gỡ bỏ.** Một token = một `clamp()`; KHÔNG override font-size theo breakpoint.

Superfamily **Barlow**: Barlow Condensed cho mọi display/heading/nav/CTA/label (UPPERCASE); Barlow cho body/link. Size fluid qua token `--fs-*` (rem + clamp).

| Vai trò | Font | Size (sàn→trần) | Weight | Line height |
|---|---|---:|---:|---:|
| Display / H1 | Barlow Condensed | 30→56px (`--fs-h1`) | 600 (700 nhấn) | 1.1 |
| H2 | Barlow Condensed | 24→40px (`--fs-h2`) | 600 (700 nhấn) | 1.2 |
| H3–H6 | Barlow Condensed | 20→30px (`--fs-h3`); richtext h3–h6 giữ 18px (`--bb-text-h3`) | 600 | 1.2 |
| Section title | Barlow Condensed | 30→50px (`--bb-text-section-title`) | 600 | 1.2 |
| Body | Barlow | 16→18px (`--fs-body`) | 400 | 1.6 |
| Button / CTA | Barlow Condensed | 15→16px | 600 | 1.2 |
| Nav | Barlow Condensed | 17px | 600 | 1 |
| Link (body) | Barlow | 16→18px | 400 | 1.6 |
| Meta / badge | Barlow Condensed | 12→13px | 600 | 1.4 |
| News title | Barlow Condensed | 20px (`--bb-text-news-title`) | 600 | 1.2 |
| Price | Barlow Condensed | 16px | 600 | 1.5 |
| Footer slogan | Barlow Condensed | 46→54.86px | 500 | 1.2 |

Quy tắc:

- Heading, nav, badge, CTA: uppercase + Barlow Condensed.
- Body text dùng sentence case + Barlow.
- Không dùng letter-spacing âm (trừ display token theo `docs/TYPOGRAPHY.md`).
- Letter-spacing chuẩn hóa về 3 token: `tracking-normal` (0) mặc định, `tracking-wide` (0.04em) cho uppercase nav/button/kicker, `tracking-display` (0.08em) cho eyebrow nổi bật. KHÔNG dùng arbitrary `tracking-[…]` hay thêm bậc mới (`tracking-wider/widest`).
- Không render chữ trắng nhỏ hơn 16px trên nền tối, trừ meta phụ có màu `#CECECE`.
- Form input dùng `--fs-body` (≥16px) → tránh iOS auto-zoom.

### Tailwind font-size utilities

Token cỡ chữ expose thành Tailwind utility trong `app/globals.css` (`@theme inline`). Heading cấp trang phải dùng **utility token** — KHÔNG dùng `text-2xl`/`text-3xl` cố định hay arbitrary `text-[26px]`.

**Canonical fluid scale (dùng cho component mới / refactor)** — map tới `--fs-*` (một clamp, fluid mobile→ultra-wide):

| Utility | Token nguồn |
|---|---|
| `text-display-xl` / `text-display` | `--fs-display-xl` / `--fs-display` |
| `text-h1` / `text-h2` / `text-h3` / `text-h4` | `--fs-h1…h4` (canonical; KHÔNG qua `--bb-text-*`) |
| `text-body-lg` / `text-body` | `--fs-body-lg` / `--fs-body` |
| `text-button` / `text-caption` / `text-overline` | `--fs-button` / `--fs-caption` / `--fs-overline` |

**Legacy WP-parity (đang migrate dần, vẫn dùng được):**

| Utility | Token nguồn |
|---|---|
| `text-section-title` / `text-hero` | `--bb-text-section-title` (30→50px) / `--bb-text-hero` (18→30px) — đã fluid qua clamp |
| `text-news-title` / `text-product-title` | `--bb-text-news-title` (20px) / `--bb-text-product-title` (16px) — cố định |
| `text-22` / `text-26` / `text-32` / `text-40` / `text-50` | `--bb-text-22…50` — numeric WP, vẫn step theo breakpoint |
| `text-9` / `text-10` / `text-11` / `text-13` / `text-15` / `text-17` | `--bb-text-9…17` (12–17px) — cố định, chỉ cho meta / label phụ |

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

- Component: `.bb-cat-list` — chỉ hiện ở desktop (`hidden md:block`, ≥ 768px). Mobile dùng `MobileCategoryGrid` (2–3 cột).
- Cột theo breakpoint: 2 (≤ 575) · 3 (≤ 767) · 4 (desktop) · **6 (4xl ≥ 2560)**. Số cột là ước của 12 danh mục để hàng luôn đầy (12 item ở 4xl = 6 × 2 hàng).
- Divider: đường kẻ 1px grey `#CECECE` vẽ bằng **border trên từng tile** (border-right + border-bottom) + border top/left trên grid — **không** dùng nền xám lấp `gap`. Hàng cuối thiếu item sẽ không sinh mảng xám.
- Tile: nền trắng, cao 290px, radius `0`, không shadow ở trạng thái nghỉ.
- Icon: wrapper cố định 72px → 80px (≥ 1536) → 88px (≥ 2560), `object-contain`, căn giữa.
- Label: Barlow Condensed, UPPERCASE, weight 600, 17 → 18 (≥ 1536) → 20px (≥ 2560), clamp tối đa 2 dòng.
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
