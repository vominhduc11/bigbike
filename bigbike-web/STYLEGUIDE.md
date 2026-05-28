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
| Font body | Barlow |
| Font heading / CTA | Oswald |
| Font layout dày đặc | Barlow Condensed |
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

| Vai trò | Font | Size | Weight | Line height |
|---|---|---:|---:|---:|
| Display / H1 | Oswald | 32px | 600 | 1.08 |
| H2 | Oswald | 24px | 600 | 1.5 |
| H3–H6 | Barlow Condensed | 18px | 600 | 1.1 |
| Body | Barlow | 16px | 400 | 1.5 |
| Button / CTA | Barlow Condensed | 16px | 600 | 1 |
| Nav | Barlow Condensed | 17px | 600 | 1 |
| Link (body) | Barlow | 16px | 400 | 1.5 |
| Meta / badge | Barlow Condensed | 12px | 600 | 1 |
| News title | Oswald | 20px | 600 | 1.5 |
| Price | Barlow Condensed | 16px | 600 | 1.5 |
| Footer slogan | Barlow Condensed | 3.429rem | 500 | 4.143rem |

Quy tắc:

- Heading, nav, badge, CTA: uppercase.
- Body text dùng sentence case.
- Không dùng letter-spacing âm.
- Không render chữ trắng nhỏ hơn 16px trên nền tối, trừ meta phụ có màu `#CECECE`.

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
- Title: Oswald 18/600/20.
- Price: Barlow Condensed 16/600, đỏ `#FF0C09`.
- Hover: border đỏ, shadow `0 4px 12px rgba(255,12,9,0.1)`.
- Add-to-cart bar: đen, chữ trắng, trượt lên khi hover; trên touch luôn hiện.

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
| `3xl:` | ≥ 1920px | ultra-wide — **chỉ dùng khi thật sự cần** layout full-bleed hoặc container override |

Container max-width: `--bb-container-xl` = `75rem` (1200px) — áp dụng cho mọi breakpoint.

> **Quy tắc:** Rule mới phải dùng Tailwind prefix (`sm:`/`md:`/`lg:`/`xl:`/`2xl:`/`3xl:`) hoặc các giá trị pixel tương ứng trong media query. Không thêm breakpoint ad-hoc mới.

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
