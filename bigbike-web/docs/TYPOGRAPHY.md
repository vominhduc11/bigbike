# BIGBIKE-WEB — Hệ thống Typography

Tài liệu này là nguồn sự thật chi tiết cho typography của `bigbike-web`. Từ ngày 2026-07-11, toàn bộ chữ trong website được chuẩn hoá về **11 nhóm cố định**: A1–A5, B1–B5 và nhóm trang trí D.

## 1. Nguyên tắc nền

- Giữ đúng hai phông đang có: **Arial / Helvetica** và **Barlow Condensed**. Không dùng Oswald hoặc thêm phông khác.
- Nhóm A dùng Arial/Helvetica cho tiêu đề trang và nội dung. Nhóm B dùng Barlow Condensed cho chức năng/nhấn và luôn viết IN HOA.
- Mỗi nhóm có đúng một cỡ mobile và một cỡ desktop. Sang mobile chỉ đổi cỡ, không đổi phông.
- Breakpoint cỡ chữ duy nhất là `768px`: `<768px` dùng cỡ mobile, `≥768px` dùng cỡ desktop.
- Các breakpoint 375px, 600px, 991px, 1920px, 2560px và màn siêu rộng không được thay đổi cỡ chữ. Chúng chỉ được thay đổi bố cục hoặc lưới.
- Mọi đoạn chữ phải thuộc đúng một nhóm. Không có cỡ chữ tự do, thang `text-ui-*`, cỡ Tailwind mặc định hoặc `font-size` hardcode ngoài token nhóm.
- Ngoại lệ duy nhất được co giãn là số “404” mờ, không phải chữ đọc, thuộc nhóm D.

## 2. Bảng 11 nhóm chữ

| Nhóm | Vai trò | Phông cố định | Mobile `<768px` | Desktop `≥768px` | Dùng cho |
|---|---|---|---:|---:|---|
| B1 | Trang trí / Display | Barlow Condensed, IN HOA | 32px | 40px | Slogan footer, chữ hero trang trí, số kết quả bảng size |
| B2 | Liên hệ lớn | Barlow Condensed, IN HOA | 24px | 32px | Hotline/email lớn ở footer, “Thông tin cửa hàng” |
| B3 | Badge nhấn / % giảm | Barlow Condensed, IN HOA | 18px | 20px | Nhãn “-20%”, nhãn giảm giá nổi bật |
| B4 | Nút · Menu · Tab | Barlow Condensed, IN HOA | 16px | 18px | Nút bấm, menu chính, tab, nhãn Còn/Hết hàng |
| B5 | Nhãn nhỏ / Eyebrow / Badge | Barlow Condensed, IN HOA | 12px | 14px | Chữ dẫn nhỏ, badge, ngày đăng, nhãn thanh đáy, SKU |
| A1 | Tiêu đề lớn H1 | Arial / Helvetica | 28px | 32px | Tiêu đề khối lớn; tên và giá lớn trên trang sản phẩm |
| A2 | Tiêu đề trang H2 | Arial / Helvetica | 22px | 26px | Giỏ hàng, thanh toán, tài khoản, đăng nhập, thông báo thành công |
| A3 | Tiêu đề khối H3 | Arial / Helvetica | 20px | 22px | Tiêu đề khối trong trang, hộp thoại, sidebar |
| A4 | Nội dung + tiêu đề nhỏ | Arial / Helvetica | 16px | 18px | Đoạn văn, mô tả, tên bài/sản phẩm/card, ô nhập |
| A5 | Chú thích / Meta | Arial / Helvetica | 14px | 16px | Breadcrumb, phụ đề, nhãn form, giá phụ/giá gạch, bộ đếm |
| D | Trang trí nền | Phông tại thành phần | `clamp()` | `clamp()` | Chỉ số “404” mờ trong `app/not-found.tsx` |

Giá được phân nhóm theo cấp độ nơi hiển thị: giá lớn trên trang sản phẩm = A1; tổng tiền giỏ hàng = A2 hoặc A3; giá trong một dòng = A4; giá trên card = A5.

Nhãn phụ (kicker) của các khối trang chủ là biến thể cố định dùng Barlow Condensed, 16px ở cả mobile và desktop, in đậm, màu `#CECECE`. Utility tương ứng là `text-home-kicker`.

Tiêu đề product card là biến thể cố định của A4: Arial / Helvetica, 16px ở cả mobile và desktop, font-weight 600. Utility tương ứng là `text-product-card`.

## 3. Token nguồn — `styles/brand-tokens.css`

Mười token dưới đây là nguồn cỡ chữ duy nhất. Giá trị mobile khai báo tại `:root`; mỗi token đổi đúng một lần trong `@media (min-width: 768px)`.

```css
--bb-text-b1-display: 2rem;       /* 32px → 40px */
--bb-text-b2-contact: 1.5rem;     /* 24px → 32px */
--bb-text-b3-promo: 1.125rem;     /* 18px → 20px */
--bb-text-b4-action: 1rem;         /* 16px → 18px */
--bb-text-b5-label: 0.75rem;      /* 12px → 14px */
--bb-text-a1-title: 1.75rem;      /* 28px → 32px */
--bb-text-a2-page: 1.375rem;      /* 22px → 26px */
--bb-text-a3-section: 1.25rem;    /* 20px → 22px */
--bb-text-a4-content: 1rem;        /* 16px → 18px */
--bb-text-a5-meta: 0.875rem;      /* 14px → 16px */
```

`body` và mọi ô nhập dùng A4. Cỡ mobile 16px là kích thước chuẩn của nhóm A4.

## 4. Tailwind v4 utilities — `app/globals.css`

Dự án dùng Tailwind v4 với `@theme inline`, không có `tailwind.config`. Token nguồn được expose thành utility theo vai trò:

| Utility | Nhóm | Utility | Nhóm |
|---|---|---|---|
| `text-b1-display` | B1 | `text-a1-title` | A1 |
| `text-b2-contact` | B2 | `text-a2-page` | A2 |
| `text-b3-promo` | B3 | `text-a3-section` | A3 |
| `text-b4-action` | B4 | `text-a4-content` | A4 |
| `text-b5-label` | B5 | `text-a5-meta` | A5 |

Không gắn `md:text-*`: chính token CSS tự đổi tại 768px. Một thành phần chỉ dùng một utility nhóm ở mọi kích thước màn hình.

## 5. Quy tắc sử dụng

- Nhóm B phải đi với phông Barlow Condensed và chữ IN HOA; nhóm A đi với Arial/Helvetica.
- Menu chính của header là biến thể điều chỉnh của B4: Barlow Condensed, 15px ở cả mobile và desktop, font-weight 900, line-height 21px.
- Form input, textarea và select luôn dùng A4.
- Không dùng `text-[Npx]`, `text-[…em]`, cỡ Tailwind mặc định (`text-sm`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`, `text-4xl`, `text-5xl`) hoặc token số `text-ui-*`.
- Không hardcode `font-size` bằng px trong CSS nếu vai trò đã thuộc một nhóm.
- Không tạo override cỡ chữ tại 375px, 600px, 991px, 1920px, 2560px hoặc quy tắc giảm riêng 2px cho trang sản phẩm.
- Không phóng chữ ở ô tìm kiếm/gợi ý trên màn lớn; chỉ được nới khung.
- Nút chat nổi dùng A4. Số “404” giữ `clamp()` và phải có `aria-hidden`, `select-none`.
- Tiếng Việt phải đủ dấu; mọi file dùng UTF-8 không BOM.

## 6. Phông chữ

Barlow Condensed được self-host bằng `next/font` trong `app/fonts.ts`. Arial/Helvetica dùng font hệ thống. Cả hai hỗ trợ tiếng Việt.

```css
--bb-font-body: Arial, Helvetica, "Helvetica Neue", sans-serif;
--bb-font-cta: var(--font-barlow-condensed), Arial, Helvetica, "Helvetica Neue", sans-serif;
```

`font-body` là alias bắt buộc cho nhóm A; `font-cta` là alias bắt buộc cho nhóm B. Khi chuẩn hoá một thành phần, phải sửa cả cỡ chữ và phông để khớp nhóm ngữ nghĩa; không giữ alias phông cũ nếu alias đó làm sai bảng canonical.

## 7. Kiểm tra trước khi hoàn thành

- Tìm kiếm toàn repo xác nhận không còn cỡ arbitrary, cỡ Tailwind mặc định hoặc token cỡ cũ đang được tham chiếu.
- Xác nhận chỉ `@media (min-width: 768px)` thay đổi mười token nhóm.
- Build sạch và kiểm tra trực quan trang chủ, sản phẩm, giỏ/thanh toán, tin tức và tài khoản ở hai phía breakpoint 768px.

*Source of truth typography cho `bigbike-web`. Mô hình: 11 nhóm, một breakpoint 768px, một phông cố định cho mỗi nhóm. Cập nhật 2026-07-11.*
