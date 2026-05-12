# BigBike Web Styleguide

> Cập nhật ngày 2026-05-12: `bigbike-web` áp dụng theo file thiết kế do user cung cấp tại `C:\Users\vomin\Downloads\DESIGN.md`.
>
> File này là nguồn rút gọn cho giao diện `bigbike-web`. Khi thay đổi token, layout, component hoặc trạng thái UI, phải giữ code khớp các quy tắc dưới đây.

---

## Nguyên Tắc Bắt Buộc

| Mục | Quy tắc |
|---|---|
| Theme | Dark-first, nền chính `#000000`, bề mặt tương phản mạnh |
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

--bb-bg-page: #000000;
--bb-bg-section: #000000;
--bb-bg-surface: #ffffff;
--bb-bg-surface-raised: #f5f5f5;
--bb-bg-surface-hover: #fff4f3;

--bb-text-primary: #ffffff;
--bb-text-secondary: #cecece;
--bb-text-muted: #abb8c3;
--bb-text-inverse: #000000;

--bb-border-subtle: #dddddd;
--bb-border-default: #cecece;
--bb-border-strong: #abb8c3;
```

State colors:

- Danger: `#FF0C09`
- Warning: `#FCB900`
- Info: `#007BFF`
- Chat: `#00BFFF`

---

## Typography

| Vai trò | Font | Size | Weight | Line height |
|---|---|---:|---:|---:|
| Display / hero | Barlow Condensed | 30px | 700 | 45px |
| H1 | Barlow | 32px | 600 | 48px |
| H2 | Barlow | 24px | 600 | 36px |
| H3 | Oswald | 18px | 600 | 20px |
| Body | Barlow Condensed | 16px | 400 | 24px |
| Button / CTA | Oswald | 16px | 600 | 24px |
| Link | Barlow | 16px | 400 | 24px |
| Meta / badge | Barlow | 12px | 700 | 12px |

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
- Price: Oswald 16/600, đỏ `#FF0C09`.
- Hover: border đỏ, shadow `0 4px 12px rgba(255,12,9,0.1)`.
- Add-to-cart bar: đen, chữ trắng, trượt lên khi hover; trên touch luôn hiện.

### Inputs

- Nền trắng, chữ đen, padding `12px 16px`, border `#DDDDDD`, radius `0`.
- Focus: border xanh `#007BFF`, ring `rgba(0,123,255,0.1)`.
- Error: border đỏ, nền `#FFF4F3`.

### Navigation

- Header nền đen, cao 64px, chữ trắng.
- Nav hover/active: đỏ `#FF0C09`, underline đỏ.
- Cart badge: đỏ, chữ trắng, tròn.

### Footer

- Nền `#1A1A1A`.
- Heading trắng, link `#CECECE`, hover đỏ.
- Divider `#333322`.

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

| Breakpoint | Hành vi |
|---|---|
| 320-639px | 1 cột, padding 16px, hero title 18px |
| 640-1023px | 2 cột, padding 24px |
| 1024px+ | 3 cột, padding 32px |
| 1200px+ | Container centered 1200px |

---

## Update Rule

Nếu `DESIGN.md` thay đổi, cập nhật theo thứ tự:

1. `bigbike-web/STYLEGUIDE.md`
2. `bigbike-web/styles/brand-tokens.css`
3. `bigbike-web/app/globals.css`
4. Component liên quan nếu CSS token chưa đủ
