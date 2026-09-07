# BigBike Web Styleguide

> Cập nhật ngày 2026-08-01: `bigbike-web` áp dụng desktop canvas cố định 1440px; giao diện tại 1440px là baseline, không nới theo viewport lớn hơn.
> Track B light-first WP-parity đã được chọn — xem `docs/audits/BIGBIKE_WEB_BACKGROUND_COLOR_AUDIT.md`.
>
> File này là nguồn rút gọn cho giao diện `bigbike-web`. Khi thay đổi token, layout, component hoặc trạng thái UI, phải giữ code khớp các quy tắc dưới đây.

---

## Nguyên Tắc Bắt Buộc

| Mục                                                          | Quy tắc                                                                                                               |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Theme                                                        | Light-first (WP-parity): nền trang `#ffffff`, chữ đen; header và footer giữ dark                                      |
| CTA chính                                                    | Đỏ `#FF0C09`, dùng cho mua hàng, khẩn cấp, giá sale                                                                   |
| Link / tương tác phụ                                         | Xanh `#007BFF`                                                                                                        |
| Chat / hỗ trợ                                                | Cyan riêng (`--bb-chat-title-bg`), nút tròn cố định góc phải dưới                                                     |
| Bo góc                                                       | `0px` cho mọi component thường; chỉ phần tử tròn thật sự dùng `50%`                                                   |
| Font body / link                                             | Arial                                                                                                                 |
| Font display / CTA / nhãn chức năng (nhóm B)                 | Arial / Helvetica (UPPERCASE) — **Oswald và font display riêng đã gỡ bỏ**                                             |
| Font menu chính                                              | Arial / Helvetica, giữ nguyên kiểu chữ của nhãn dữ liệu — **Oswald và font display riêng đã gỡ bỏ**                   |
| Font tiêu đề trang / tiêu đề nội dung / body / link (nhóm A) | Arial / Helvetica                                                                                                     |
| Card                                                         | Nền trắng, chữ đen, border `#DDDDDD`, không shadow ở trạng thái nghỉ                                                  |
| Product card                                                 | Ảnh vuông 1:1, hover border đỏ + shadow nhẹ đỏ                                                                        |
| Copy                                                         | Tiếng Việt đầy đủ dấu; nhóm B luôn viết HOA, riêng menu chính giữ nguyên kiểu chữ của nhãn; nhóm A dùng sentence case |
| Emoji                                                        | Không dùng                                                                                                            |

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

| Nhóm | Vai trò                    | Phông cố định             | Mobile `<768px` | Desktop `≥768px` | Ví dụ                                                                       |
| ---- | -------------------------- | ------------------------- | --------------: | ---------------: | --------------------------------------------------------------------------- |
| B1   | Trang trí / Display        | Arial / Helvetica, IN HOA |            30px |             40px | Slogan footer, chữ hero trang trí, số kết quả bảng size                     |
| B2   | Liên hệ lớn                | Arial / Helvetica, IN HOA |            24px |             30px | Hotline/email lớn, “Thông tin cửa hàng”                                     |
| B3   | Badge nhấn / % giảm        | Arial / Helvetica, IN HOA |            16px |             18px | “-20%”, nhãn giảm giá nổi bật                                               |
| B4   | Nút · Menu · Tab           | Arial / Helvetica         |            16px |             18px | Nút/tab/nhãn Còn-Hết hàng viết HOA; menu chính giữ nguyên kiểu chữ của nhãn |
| B5   | Nhãn nhỏ / Eyebrow / Badge | Arial / Helvetica, IN HOA |            11px |             12px | Chữ dẫn nhỏ, badge, ngày đăng, nhãn thanh đáy, SKU                          |
| A1   | Tiêu đề lớn H1             | Arial / Helvetica         |            26px |             32px | Tiêu đề khối lớn, tên và giá lớn trên trang sản phẩm                        |
| A2   | Tiêu đề trang H2           | Arial / Helvetica         |            20px |             24px | Giỏ hàng, thanh toán, tài khoản, đăng nhập, thông báo thành công            |
| A3   | Tiêu đề khối H3            | Arial / Helvetica         |            18px |             20px | Tiêu đề khối, hộp thoại, sidebar                                            |
| A4   | Nội dung + tiêu đề nhỏ     | Arial / Helvetica         |            16px |             18px | Đoạn văn, mô tả, tên bài/sản phẩm/card, ô nhập                              |
| A5   | Chú thích / Meta           | Arial / Helvetica         |            13px |             14px | Breadcrumb, phụ đề, nhãn form, giá phụ, bộ đếm                              |
| D    | Trang trí nền              | Phông tại thành phần      |       `clamp()` |        `clamp()` | Chỉ số “404” mờ trong `app/not-found.tsx`                                   |

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

| Utility                                                                                      | Nhóm  |
| -------------------------------------------------------------------------------------------- | ----- |
| `text-b1-display` · `text-b2-contact` · `text-b3-promo` · `text-b4-action` · `text-b5-label` | B1–B5 |
| `text-a1-title` · `text-a2-page` · `text-a3-section` · `text-a4-content` · `text-a5-meta`    | A1–A5 |

Cấm dùng cỡ Tailwind mặc định (`text-sm`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`, `text-4xl`, `text-5xl`), arbitrary cỡ chữ (`text-[Npx]`, `text-[…em]`) và `font-size` hardcode khi đã có token nhóm. Ngoại lệ duy nhất được co giãn là số “404” mờ thuộc nhóm D.

---

## Component Rules

### Buttons

- Primary: nền `#FF0C09`, chữ trắng, padding `16px 32px`, radius `0`, border none.
- Secondary: nền trắng, chữ đỏ, border đỏ `2px`, radius `0`.
- Ghost: transparent, chữ/border xanh `#007BFF`, radius `0`.
- Hover primary: `#E50A07`, lift nhẹ `translateY(-1px)` hoặc scale tối đa `1.02`.
- Disabled: nền `#CECECE`, không transform.

### Hành động không trùng lặp (owner request 2026-09-07)

- Trong cùng một khối nội dung và cùng trạng thái hiển thị, mỗi thao tác chỉ có một nút hoặc liên kết hành động rõ ràng. Không đặt thêm bản icon bên cạnh bản có chữ cho cùng thao tác.
- Khu tài khoản giữ “Đăng xuất” ở cuối menu; bỏ icon đăng xuất trong thông tin cá nhân. Menu tài khoản dùng chung ở đầu website vẫn có đăng xuất.
- Danh sách sản phẩm/danh mục/thương hiệu/tìm kiếm chỉ hiện một bộ chip và nút bỏ lọc. Khi không có kết quả, bộ này nằm trong thông báo rỗng; khi có kết quả hoặc lỗi hệ thống, giữ ở đầu danh sách. Liên kết bỏ riêng size không hiện cạnh bộ chip đã có thao tác bỏ size.
- Giỏ hàng trên điện thoại chỉ dùng nút đặt hàng ở thanh cố định dưới màn hình; máy tính dùng nút trong khối tổng tiền.
- Trang tổng hợp hướng dẫn chỉ dùng các thẻ chọn bài. Menu bên được giữ ở các bài hướng dẫn chi tiết.
- Trang liên hệ và trang xác nhận đơn giữ một nút mở Zalo trong mỗi khối liên hệ; số Zalo bổ sung chỉ là thông tin đọc được.
- Khối sản phẩm ngừng bán chỉ có một đường dẫn nhóm hàng: khi có gợi ý, dùng liên kết nhóm trong thông tin sản phẩm; khi không có gợi ý, nút chính “Xem cả nhóm hàng” dẫn tới nhóm đó và nhãn nhóm chỉ là chữ.
- Được lặp có mục đích: ảnh/tên/nút chọn của cùng thẻ sản phẩm; menu dùng chung và nội dung trang; nút viết đánh giá ở đầu và cuối trang sản phẩm dài; nút mua nổi chỉ xuất hiện khi cụm mua chính ra khỏi màn hình. Hai lựa chọn chuyển khoản “Tiếp tục” / “Chuyển khoản sau” giữ theo `docs/engineering/API_FLOW_MAP.md` mục Manual transfer receipt.

### Giỏ hàng nhanh trên điện thoại (2026-09-07)

- Giữ nền tối đồng bộ với menu điện thoại, phông Arial và góc vuông. Tiêu đề “Giỏ hàng” là nội dung chính; số lượng là thông tin phụ.
- Mỗi dòng ưu tiên ảnh, tên sản phẩm, màu/cỡ; bỏ mã SKU khỏi khung xem nhanh. Bộ số lượng và thành tiền nằm trên một hàng riêng, có thể xuống dòng trên màn hình hẹp/phóng lớn chữ; nút chạm tối thiểu 44px.
- Danh sách dùng đường phân cách nhẹ, cuộn riêng. Tổng tiền, thông tin miễn phí vận chuyển và nút chính cố định trong chân khung, có khoảng an toàn đáy màn hình.
- Nút chính “Tiếp tục đặt hàng” chiếm toàn chiều rộng; “Xem giỏ hàng” là liên kết phụ ở dưới. Cùng nhãn chuyển bước trên trang giỏ hàng; “Đặt hàng” dành cho bước xác nhận đơn cuối cùng.
- Lỗi cập nhật giữ nguyên danh sách và số lượng đã xác nhận; hiển thị thông báo dễ hiểu và nút thử lại. Không hiển thị thanh kéo trang trí khi chưa hỗ trợ kéo.
- Thông báo lỗi trên nền tối dùng chữ sáng đủ tương phản; nút chính luôn giữ chữ trắng. Nút hỗ trợ nổi trên trang giỏ hàng điện thoại phải nằm phía trên thanh tổng tiền, không che tổng tiền hoặc nút chuyển bước.
- Trang giỏ hàng dùng một cột đến dưới 1024px; chỉ chia danh sách và tổng tiền thành hai cột khi đủ rộng. Bảng trượt vẫn chỉ có dưới 768px, không mở rộng sang tablet/desktop.

### Product Cards

- Nền trắng, chữ đen, padding 20px, border `1px solid #DDDDDD`, radius `0`.
- Ảnh vuông 1:1, full width.
- Title: Arial/Helvetica, A4 variant, 16px on mobile and desktop, weight 600.
- Price: Arial/Helvetica, A5, weight 600, đỏ `#FF0C09`.
- Hover: border đỏ, shadow `0 4px 12px rgba(255,12,9,0.1)`.
- Add-to-cart bar: đen, chữ trắng, trượt lên khi hover; trên touch luôn hiện.

### Rating display

- Public aggregate ratings always show exactly five stars followed by the approved-review count as `({n})`.
- Product cards in catalog/search/brand/category lists are the exception: render no rating row when the approved-review count is zero, and never make the card rating a write-review trigger.
- No approved reviews: use five neutral outline stars and `(0)`; never show a status label, `0/5`, or a default score.
- Approved reviews: keep the one-decimal partial star fill when needed and show `(n)`; do not show the average as visible text.
- Inconsistent count/score data: keep neutral stars and the safe count as `(n)`; do not invent a score. Preserve the full state-specific aria-label.

### Catalog filters

- Reuse shadcn/Radix controls and brand tokens. Filter choices use one neutral-to-red language: unselected square choices have a light neutral border and black text, hover uses a very light brand-red surface with a brand-red border, and selected choices use the solid brand red. Link-blue remains reserved for links and secondary text actions such as show-more.
- Use square checkboxes for multi-select lists and round radio controls for the single-select gender list. Small size choices must not scale on hover; keep every filter control at least 44px tall.
- The price filter uses one fixed localized endpoint line above a two-handle slider. It has no text inputs, range hint, open-ended “and above” label, or separate apply button. Endpoints come from the current catalog context, are rounded outward by the catalog price bands, and the slider uses histogram quantiles so dense price ranges receive more track space. Dragging is continuous and snaps to a display amount only on release; only the handle the customer moved is snapped, while the other committed bound remains unchanged. Desktop applies on release and mobile applies the draft from `View N products`.
- Desktop filter order is Brand, Price, Size, Color, Finish, Availability, Gender. Category navigation is provided by the header menu and direct category URLs; catalog pages do not render a child-category image rail or a sidebar filter tree.
- Desktop sidebar is sticky and independently scrollable; list facets show eight rows before a small underlined text action. Size uses a compact grid; color uses a swatch plus name/count.
- Mobile filter uses the existing sticky toolbar trigger with an active-count badge and a full-viewport sheet. The sheet has collapsed group summaries, active chips, clear-all, and a sticky `View N products` action.
- Every filter chip/control is keyboard operable, has a complete accessible name, and keeps a minimum 44px touch target on mobile. Empty facet groups are not rendered.

### Category Tiles (lưới danh mục trang chủ)

- Component: ô danh mục `CategoryListItem` dùng **chung một thiết kế** cho mọi breakpoint - chỉ responsive (co số cột + kích thước tile), không có layout mobile riêng.
- Cột theo breakpoint: 2 (mobile) · 3 (≥ 600) · 4 (≥ 768 desktop). Màn hình rộng hơn không tăng số cột vì toàn site giữ nguyên baseline 1440px.
- Divider: đường kẻ 1px grey `#CECECE` vẽ bằng **border trên từng tile** (border-right + border-bottom) + border top/left trên grid — **không** dùng nền xám lấp `gap`. Hàng cuối thiếu item sẽ không sinh mảng xám.
- Tile: nền trắng, cao 290px (mobile co còn 170px), radius `0`, không shadow ở trạng thái nghỉ.
- Icon: khung vuông cố định 64px (điện thoại), 80px (máy tính bảng), 96px (máy tính); ảnh `object-contain`, căn giữa, giữ nguyên tỉ lệ và không cắt. Không tăng kích thước theo viewport siêu rộng.
- Label: Arial/Helvetica, sentence case, weight 600, nhóm A4 (`text-a4-content`); clamp tối đa 2 dòng. Màn siêu rộng chỉ nới tile, không đổi cỡ chữ.
- Hover: ảnh đỏ `cat-hover.jpg` phủ kín tile (200ms), icon invert trắng + scale `1.06`, label trắng.
- Active: icon scale `0.97`. Focus-visible: outline `2px solid var(--bb-link-text)` (`#005FCC`), offset `-3px`.

### Image frames và responsive loading

- Mọi ảnh nằm trong cùng một hàng, lưới hoặc rail phải có parent `relative` với kích thước khung đã chốt; không để kích thước intrinsic của file quyết định bố cục.
- Dùng `MediaImage fill` với `object-contain` cho logo, icon và ảnh cần giữ toàn bộ nội dung; chỉ dùng `object-cover` khi ngữ cảnh đã quy định crop.
- Khung logo dùng theo ngữ cảnh nhưng phải đồng nhất trong cùng component: Giới thiệu `128×128px`, dải thương hiệu trang chủ `120×120px`, lưới Thương hiệu cao `64px`, cột lọc `96×48px`. Logo luôn căn giữa hai chiều và giữ nguyên tỉ lệ.
- Ảnh minh hoạ PageHero dùng khung desktop tối đa `451×400px`, không làm thay đổi chiều cao tổng banner.
- Mọi `MediaImage` trong khung cố định phải khai báo `sizes` bằng kích thước CSS thực tế. Candidate tải về phải đạt tối thiểu `kích thước khung × DPR` nhưng không chọn candidate lớn hơn cần thiết.

### Trợ lý BigBike — khung đọc mở rộng

- Quyết định chủ shop 2026-09-07: trên máy tính (từ 768px), khung thường rộng 544px; nút “Mở rộng khung chat” mở khung rộng tối đa 928px, cao 90% màn hình. Cả hai kích thước phải nằm trong màn hình, chừa khoảng cách theo token ở các cạnh. Nút đổi thành “Thu gọn khung chat” khi mở rộng.
- Đầu khung máy tính có bốn nút cùng kích thước: liên hệ, xoá, mở rộng/thu gọn, đóng. Điện thoại giữ toàn màn hình và ba nút liên hệ, xoá, đóng; không hiện nút đổi kích thước.
- Khung thường và điện thoại hiển thị sản phẩm một cột. Khung mở rộng hiển thị hai cột, kể cả phụ kiện liên quan; tiêu đề nhóm và nút xem thêm chiếm trọn hàng. Giữ ba sản phẩm đầu và nút xem thêm cho danh sách dài.
- Mở rộng/thu gọn không tạo hội thoại mới, không gửi lại câu hỏi, không làm mất câu đang nhập, ảnh chờ gửi hay lựa chọn sản phẩm. Giữ cơ chế bám đáy khi đang đọc tin mới; không kéo khách đang đọc tin cũ về cuối.
- Tiếp tục dùng Arial, màu hỗ trợ cyan, các token khoảng cách/viền của web và nút thao tác tối thiểu 44px. Chỉ thay bố cục hiển thị, không cắt câu trả lời hay đổi quy tắc tư vấn.

### Video viewer — mobile và desktop (owner request 2026-09-07)

- Dùng chung viewer cho carousel trang chủ và video sản phẩm; giữ nguồn video, thứ tự và cách chuyển vòng hiện có. Tái sử dụng Dialog/Button shadcn, Arial, màu nền tối và góc vuông của web.
- Tên video xuất hiện một lần trong thanh đầu cùng nút đóng; không thêm dải tiêu đề trùng bên dưới. Mô tả thật vẫn đọc được dưới player, hoặc trong cột thông tin khi xoay ngang; nội dung dài cuộn trong vùng riêng.
- Mobile: vùng bấm 48×48px, nút trước / số thứ tự / nút tiếp thành một hàng dưới player. Desktop từ `lg`: hai nút nằm sát hai bên player, khoảng cách 16px; số thứ tự vẫn rõ ràng. Một video thì ẩn điều hướng và bộ đếm.
- Bố cục theo chiều cao khả dụng `dvh`, chừa safe-area cả bốn cạnh. Player co theo phần còn lại sau tiêu đề, mô tả và điều hướng; các vùng không chồng nhau. Bề rộng player tối đa 420px, nội dung dọc giữ tỷ lệ, không crop hoặc kéo giãn.
- Khi landscape và chiều cao ≤600px: player bên trái, tiêu đề / mô tả / điều hướng bên phải. Khung nhúng tối thiểu 200×200px; màn quá nhỏ cho toàn bộ nội dung được cuộn thay vì cắt nút. Chiều rộng khung có thể lớn hơn tỷ lệ 9:16 để giữ điều khiển đọc được; nội dung video vẫn giữ tỷ lệ gốc.
- Có trạng thái tải, tải chậm, lỗi nguồn / thiếu nguồn, thử lại; nguồn hợp lệ có đường mở video gốc. YouTube dùng sự kiện player để phân biệt đã sẵn sàng với iframe chỉ vừa tải; không che điều khiển/branding khi player sẵn sàng. TikTok/Facebook cũ giữ khả năng nhúng; lỗi bên trong iframe do nền tảng hiển thị, có lối mở nguồn gốc.
- Giữ focus trong Dialog, đóng bằng Escape/nút đóng, trả focus về video vừa mở và trả lại trạng thái cuộn của trang. Phím trái/phải chuyển video khi focus ở phần điều khiển BigBike, không cướp phím của player. Không tự chuyển carousel phía sau khi viewer đang mở.

### Inputs

- Nền trắng, chữ đen, padding `12px 16px`, border `#DDDDDD`, radius `0`.
- Focus: border xanh `#007BFF`, ring `rgba(0,123,255,0.1)`.
- Error: border đỏ, nền `#FFF4F3`.

### Navigation

- Header nền đen, cao 80px (5rem desktop / 60px mobile), chữ trắng.
- Logo lớn tràn xuống dưới header là chủ ý của chủ shop (xác nhận 2026-09-07): giữ nguyên ảnh 210×190px, vị trí đầu trang và ngưỡng hiển thị hiện có từ 1261px. Không cắt, thu nhỏ hoặc ép logo vào chiều cao header; khi cuộn vẫn chuyển sang logo ngang 150px như hiện tại.
- Trên điện thoại, logo ngang rộng 112px, giữ nguyên tỉ lệ và căn giữa theo chiều cao; từ 768px dùng logo ngang 150px trước ngưỡng chuyển sang logo lớn hiện có. Chừa khoảng cách giữa logo và cụm thao tác, kể cả màn hình 320px.
- Bộ đổi ngôn ngữ trên điện thoại dùng nút gọn `VI`/`EN` kèm mũi tên, mở lựa chọn “Tiếng Việt” và “English”; từ 768px giữ hai nút trực tiếp `VI / EN`. Mọi nút và lựa chọn có vùng bấm tối thiểu 44px; nút trên header cao bằng header, có tên truy cập “Ngôn ngữ”/“Language”, trạng thái đang chọn và đang chuyển. Giữ nguyên đích chuyển ngôn ngữ, bộ lọc và vị trí liên kết của trang hiện tại.
- Nav hover/active: đỏ `#FF0C09`; trạng thái trang hiện tại chỉ đổi màu chữ, không thêm gạch chân, vạch hay nền.
- **Nút icon header** (tìm kiếm, giỏ hàng, tài khoản, mở menu): tất cả cùng bề rộng `--bb-header-action-width` — 58px từ 768px trở lên, 44px trên điện thoại (bằng `--bb-touch-target`). Bề rộng cố định, nội dung căn giữa, không đệm ngang riêng: vùng hover của 4 nút phải bằng nhau, kể cả khi nút tài khoản đổi từ icon 18px sang ảnh đại diện 32px lúc đã đăng nhập. Không ép `w-*`/`px-*` riêng cho từng nút.
- Biểu tượng tìm kiếm và mở/đóng menu cùng khung 24px trên điện thoại, 18px từ 768px; dùng cùng độ dày nét, căn giữa vùng bấm và cùng màu trạng thái.
- Menu điện thoại/máy tính bảng là khung toàn chiều cao màn hình. Thanh tiêu đề và nút “Đóng menu” nằm bên trong khung, luôn thấy khi cuộn; hỗ trợ chạm, bàn phím và Escape, trả tiêu điểm về nút mở khi đóng. Lớp nền phủ cả header phía sau để không hiển thị nút tưởng bấm được nhưng đang bị khoá. Khi chuyển sang bố cục menu máy tính từ 1280px, đóng khung và mở lại cuộn trang.
- Menu tài khoản trên máy tính căn theo mép phải nút mở, luôn nằm trọn trong màn hình. Escape đóng menu cả khi tiêu điểm ở một mục bên trong và trả tiêu điểm về nút tài khoản.
- Cart badge: đỏ, chữ trắng, tròn.

### Thanh điều hướng dưới trên điện thoại

- Giữ bốn mục Trang chủ / Tìm kiếm / Giỏ hàng / Tài khoản trên nền tối, chia đều bốn cột ở cỡ chữ thông thường. Khi tăng cỡ chữ khiến thanh hẹp hơn 24 lần cỡ chữ nhãn, chuyển thành hai cột, hai hàng để đọc được trọn từ. Biểu tượng cùng khung 24px theo token, căn thẳng hàng trong mỗi hàng; vùng bấm tối thiểu 48px, không phóng nút khi hover.
- Nhãn dùng Arial, nhóm B5, chữ hoa và căn giữa. Hiện đủ tên trên một dòng ở màn hình 320px trở lên với cỡ chữ thông thường; cho phép xuống dòng giữa các từ khi tăng cỡ chữ, không dùng dấu ba chấm hoặc giảm cỡ chữ để ép vừa. Chiều cao các ô đồng đều và tự giãn theo nhãn dài nhất.
- Chiều cao thực của thanh được đồng bộ vào `--bb-mobile-nav-height`, tách riêng khoảng an toàn đáy màn hình. Nội dung cuối trang và các nút nổi phải chừa đủ chỗ khi nhãn xuống dòng, khi đổi ngôn ngữ hoặc xoay màn hình.
- Mục Trang chủ phải có cùng dấu chọn trên HTML đầu tiên và sau khi trình duyệt khởi tạo, kể cả khi server dùng đường dẫn rewrite nội bộ `/vi/internal/home/`. Quy về trang công khai cùng locale khi xác định mục đang chọn; không chờ khởi tạo xong mới thêm dấu chọn (theo `docs/engineering/ARCHITECTURE.md`, mục i18n & rendering).
- Mục Tìm kiếm sáng đỏ và có vạch đánh dấu khi đang mở khung tìm kiếm hoặc ở trang kết quả `/tim-kiem/` / `/en/search/`. Trạng thái trang hiện tại tách biệt với trạng thái khung đang mở; bấm mục này vẫn mở khung tìm kiếm sẵn có, đóng bằng Escape trả tiêu điểm về nút vừa bấm.

### Footer

- Top strip nền `#3A3A3A` (khớp WP).
- Bottom bar nền `#000000`.
- Heading trắng, link `#CECECE`, hover đỏ.
- Divider `#333333`.
- Nội dung pháp lý trên nền xám dùng token `--bb-text-footer-legal`.
- Các nhóm “Thông tin” và “Mạng xã hội” khi xếp dọc (`<992px`) dùng đệm dưới 16px và khoảng cách giữa nhóm 16px. Tiêu đề giữ vùng bấm tối thiểu 44px; chỉ chừa khoảng cách 16px trước nội dung khi nhóm đang mở, bỏ khoảng cách này khi thu gọn.

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

| Token / prefix Tailwind | px       | Dùng khi                                                                       |
| ----------------------- | -------- | ------------------------------------------------------------------------------ |
| _(default)_             | < 640px  | mobile — 1 cột, padding 16px                                                   |
| `sm:`                   | ≥ 640px  | tablet nhỏ — 2 cột nhẹ, padding 24px                                           |
| `md:`                   | ≥ 768px  | tablet — layout 2 cột ổn định                                                  |
| `lg:`                   | ≥ 1024px | desktop — 3 cột / sidebar, padding 32px                                        |
| `xl:`                   | ≥ 1280px | large desktop — grid mở rộng                                                   |
| `2xl:`                  | ≥ 1536px | extra-large — mốc kiểm tra canvas; không nới content rail                      |
| `3xl:`                  | ≥ 1920px | full HD — mốc nghiệm thu canvas; không tăng spacing, cột hoặc component        |
| `4xl:`                  | ≥ 2560px | QHD/ultra-wide — mốc nghiệm thu canvas; không tăng spacing, cột hoặc component |

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

| Giá trị                     | Lý do tồn tại                                                                          |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `575px` / `576px`           | Mốc lưới legacy từ WP — chỉ dùng cho bố cục, không đổi cỡ chữ                          |
| `767px` / `768px`           | Bootstrap 3 mobile boundary từ WP theme — trùng Tailwind `md:` nhưng off-by-one        |
| `900px` / `991px` / `992px` | WP two-column layout threshold — đổi sang `lg: 1024px` cần review layout               |
| `600px`                     | Homepage legacy selector — đổi sang 640px risk regression trên phone 360-600px         |
| `1279px` / `1280px`         | Header nav fit threshold — below this width the primary menu uses the hamburger drawer |

Các breakpoint legacy được annotate trong globals.css với comment `/* BP note: ... */`.

---

## Update Rule

Nếu `DESIGN.md` thay đổi, cập nhật theo thứ tự:

1. `bigbike-web/STYLEGUIDE.md`
2. `bigbike-web/styles/brand-tokens.css`
3. `bigbike-web/app/globals.css`
4. Component liên quan nếu CSS token chưa đủ
