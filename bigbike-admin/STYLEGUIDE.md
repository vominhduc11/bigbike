# BigBike Admin Interface Style Guide

> Phạm vi: toàn bộ giao diện nội bộ trong `bigbike-admin`.
> Nguồn token thực thi: `src/styles/admin-tokens.css` → `src/index.css` → Tailwind/CSS variables.

## 1. Mục tiêu thiết kế

BigBike Admin là công cụ vận hành, vì vậy ưu tiên dữ liệu rõ, thao tác nhanh, trạng thái dễ nhận biết và không gây nhầm lẫn. Giao diện giữ mật độ **Thoáng**: dòng bảng mặc định cao 48px, khoảng cách theo thang 4px và vùng bấm tối thiểu 44px. Không dùng hero hoặc trang trí kiểu chiến dịch trong màn nghiệp vụ, trừ khu vực xem trước nội dung.

Cách tổ chức được tham khảo có chọn lọc từ [Shopify Save Bar](https://shopify.dev/docs/api/app-home/apis/user-interface-and-interactions/save-bar-api), [Carbon Data Table](https://carbondesignsystem.com/components/data-table/usage/) và [Atlassian Page Header](https://atlassian.design/components/page-header/). Ngưỡng trợ năng theo [WCAG 2.1 – Contrast Minimum](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html) và kỹ thuật [giảm chuyển động C39](https://www.w3.org/WAI/WCAG22/Techniques/css/C39).

## 2. Màu sắc

### Ba vai trò màu đỏ

| Vai trò | Light | Dark | Dùng cho |
|---|---|---|---|
| Brand | `#FF0C09` | `#FF5A4D` | Logo, vạch menu đang chọn, badge điều hướng, chấm thông báo và nhận diện thương hiệu |
| Primary | `#E50A07`; hover/active `#CC0906` | `#FF5A4D`; hover `#FF7A6F`; active `#E8402F` | CTA, link, focus, trạng thái selected/active và thao tác chính |
| Danger | text `#B91C1C`, nền `#FEF2F2` | text `#F85149`, nền `rgba(218, 54, 51, 0.15)` | Xoá vĩnh viễn, lỗi và cảnh báo phá huỷ; không dùng thay Primary hoặc Brand |

Không dùng Brand làm màu chữ/link trên nền sáng. Không dùng Danger cho thao tác chỉ thay đổi trạng thái có thể hoàn tác.

### Bảng tương phản đã đo

Tỷ lệ dưới đây được tính trực tiếp từ token. Nền trong suốt ở dark mode được ghép lên `--admin-color-surface-base` trước khi đo.

| Cặp ngữ nghĩa | Light | Tỷ lệ | Dark | Tỷ lệ |
|---|---|---:|---|---:|
| Chữ chính / surface | `#111827` / `#FFFFFF` | 17.74:1 | `#E6EDF3` / `#161B22` | 14.64:1 |
| Chữ phụ / surface | `#374151` / `#FFFFFF` | 10.31:1 | `#8B949E` / `#161B22` | 5.62:1 |
| Chữ muted / surface | `#6B7280` / `#FFFFFF` | 4.83:1 | `#848E99` / `#161B22` | 5.20:1 |
| Placeholder / surface | `#6B7280` / `#FFFFFF` | 4.83:1 | `#848E99` / `#161B22` | 5.20:1 |
| Nút Primary | `#FFFFFF` / `#E50A07` | 4.80:1 | `#2A0805` / `#FF5A4D` | 6.01:1 |
| Link Primary / surface | `#E50A07` / `#FFFFFF` | 4.80:1 | `#FF5A4D` / `#161B22` | 5.62:1 |
| Success | `#15803D` / `#F0FDF4` | 4.79:1 | `#3FB950` / success bg | 5.86:1 |
| Warning | `#92400E` / `#FFFBEB` | 6.84:1 | `#D29922` / warning bg | 5.65:1 |
| Danger | `#B91C1C` / `#FEF2F2` | 5.91:1 | `#F85149` / danger bg | 4.59:1 |
| Info | `#1D4ED8` / `#EFF6FF` | 6.16:1 | `#58A6FF` / info bg | 5.90:1 |
| Neutral | `#374151` / `#F3F4F6` | 9.37:1 | `#8B949E` / neutral bg | 4.95:1 |

`src/styles/admin-tokens.test.js` kiểm tự động 22 cặp ngữ nghĩa ở cả light và dark; mọi cặp chữ thường phải đạt tối thiểu 4.5:1.

## 3. Typography

| Utility/token | Font | Dùng cho |
|---|---|---|
| `font-body` / `--admin-font-body` | Inter | Nội dung, form, bảng, nút và điều hướng |
| `font-display` / `--admin-font-display` | Oswald | H1, wordmark và số KPI |
| `font-mono` / `--admin-font-mono` | JetBrains Mono | SKU, mã đơn, ID, đường dẫn chuyển hướng, mã nhật ký và code block |

Không dùng `.mono`, Exo, Bungee hoặc font tự nhập khác. Thang chữ chuẩn nằm ở `--admin-text-xs` đến `--admin-text-3xl`; không tạo kích thước tùy ý khi đã có mức tương đương.

## 4. Spacing, radius và bề rộng

- Spacing: 4, 8, 12, 16, 20, 24, 32, 40 và 48px qua `--admin-space-*` hoặc Tailwind tương ứng.
- Khoảng cách giữa các khối nội dung cấp màn luôn là **16px** (`--admin-screen-gap`). Khoảng cách lớn hơn chỉ dùng bên trong một bố cục có chủ đích, không dùng để tự tách các card cấp màn.
- Control có đúng ba mức chiều cao trên desktop: phụ 28px, thường 36px, chính 44px. Input/select và nút đứng cùng hàng phải dùng cùng mức. Trên mobile mọi nút và control nhập liệu có chiều cao/vùng bấm tối thiểu 44px.
- Card/panel/filter/table wrap: `--admin-radius-card` = 12px.
- Button/input/select/menu/pagination: `--admin-radius-control` = 8px.
- Thumbnail trong bảng: `--admin-radius-thumb` = 5px.
- `rounded-full` chỉ dành cho phần tử thực sự tròn.
- Nội dung toàn admin chỉ có một giới hạn `--bb-content-max: 1700px` tại `.bb-page-content`. `Screen` luôn rộng 100% trong khung này và không nhận `maxWidth`.

## 5. Cách dựng màn chuẩn

### Bốn linh kiện bắt buộc

| Linh kiện | Quy tắc |
|---|---|
| `ScreenHeader` | Header duy nhất của màn ổn định: nhóm menu, H1, mô tả cần thiết, badge và action. Nhóm chỉ nhận một trong 5 nhóm sidebar; tự ẩn khi trùng H1. Login, Nhận lời mời và màn con đang nhúng không tạo header thứ hai. |
| `DetailSection` | Khối nội dung cấp màn duy nhất. Hỗ trợ mô tả, badge, action, dấu bắt buộc, cấp heading và nội dung không padding. |
| `ScreenSkeleton` | Loading cấp màn duy nhất với ba variant `table`, `form`, `cards`. Spinner vẫn dùng cho nút đang xử lý. |
| `StickyActionBar` | Thanh thao tác của form cấp trang. Thứ tự: Huỷ/Bỏ thay đổi → Xem trước nếu có → thao tác phụ → Lưu ở ngoài cùng bên phải. |

`CollapsibleSection` chỉ dùng cho nhóm con cần thu gọn. Form trong modal dùng footer cố định của modal, không tạo thanh lưu cấp trang.

Mô tả dưới H1 chỉ được giữ khi nêu phạm vi, giới hạn hoặc hậu quả không thể suy ra từ tên màn. Không dùng câu kiểu “Quản lý …” để lặp lại H1. Mỗi field tối đa một helper ngắn; helper dài hơn 80 ký tự dùng `Tooltip` hiện có. Cảnh báo an toàn, quyền, lỗi và hậu quả nghiệp vụ phải luôn hiện bằng `Alert`, không giấu trong tooltip.

Không khôi phục `SectionCard`, `MediaCardSkeleton`, skeleton/vạch xám tự chế, `.mono`, header dựng tay hoặc giới hạn bề rộng riêng từng màn.

### Bố cục theo loại màn

- Màn danh sách: `Screen` → `ScreenHeader` → cảnh báo/quyền → `FilterBar` → `FilterChips` nếu có → `BulkActionBar` khi có chọn thật → `AdminTable`/`MobileCardList` → phân trang.
- Màn form/detail: `Screen` → `ScreenHeader` → trạng thái/cảnh báo → form gồm các `DetailSection` → `StickyActionBar`.
- Dashboard/report: `ScreenHeader` → `SummaryCard`/KPI → `DetailSection`; không dựng card header/body bằng tay.
- Màn nhúng: giữ nội dung và trạng thái, bỏ H1/header cấp trang bị trùng.

## 6. Bảng dữ liệu

- Dùng `AdminTable`; mobile dùng `MobileCardList` khi bảng không đọc tốt ở chiều rộng nhỏ.
- Tiêu đề cột và dòng dữ liệu dùng cùng một mật độ. Ba mật độ hợp lệ: `compact` 40px, `regular` 48px và `spacious` 56px. Đơn hàng mặc định `compact`, Sản phẩm mặc định `spacious`, các bảng khác `regular`; lựa chọn được nhớ riêng từng màn.
- Trên mobile, bảng dữ liệu phải chuyển sang `MobileCardList`; không yêu cầu người dùng kéo ngang để đọc.
- Màn danh sách có bộ lọc phải thu bộ lọc vào một nút 44px trên mobile và mở bằng `MobileFilterDrawer`; desktop vẫn dùng `FilterBar` trực tiếp.
- Ghi nhớ số dòng theo `page-size:<screen>`: URL hợp lệ → localStorage → mặc định. Reset filter không reset số dòng; giá trị lỗi hoặc storage bị chặn được bỏ qua.
- Ẩn/hiện cột có ở: Sản phẩm, Danh mục, Bài viết, Thương hiệu, Đơn hàng, Khách hàng, Đánh giá, Chuyển hướng, Người dùng, Nhật ký, Chat, Hàng ngừng bán và Menu.
- Cột định danh, chọn dòng, kéo/sắp xếp và thao tác luôn cố định.
- Thao tác dòng dùng một mẫu: `Xem`/`Sửa` luôn nhìn thấy, thao tác phụ và phá huỷ nằm trong menu ba chấm; thao tác phá huỷ tiếp tục qua `ConfirmDialog`.
- Vạch trạng thái lấy cùng tone-map với badge. Nhật ký giữ vạch danger cho hành động nguy hiểm.
- Chọn nhiều dòng chỉ có ở: Sản phẩm, Danh mục, Bài viết, Đơn hàng, Đánh giá, Chuyển hướng, Video trang chủ, Thư viện ảnh và Menu. Không thêm checkbox khi chưa có thao tác hàng loạt thật.

## 7. Trạng thái bắt buộc

Mọi màn hoặc khối dữ liệu phải thiết kế rõ các trạng thái liên quan:

- Loading: `ScreenSkeleton` đúng variant; nút xử lý dùng spinner và trạng thái disabled.
- Empty: giải thích ngắn và CTA phù hợp nếu người dùng có quyền.
- Error/network failure: nêu việc không hoàn thành được và cho Thử lại khi an toàn.
- Success: phản hồi rõ nhưng không che nội dung.
- Disabled/read-only/permission denied: giải thích lý do, không chỉ làm mờ điều khiển.
- Updating/submitting: ngăn gửi lặp và giữ thông tin đang xử lý.
- Partial data/unknown status: dùng fallback được thiết kế; không render `null`, `undefined`, `NaN` hoặc enum thô.

## 8. Trợ năng và chuyển động

- Chữ thường đạt ít nhất 4.5:1; focus phải nhìn thấy ở cả light/dark.
- Vùng bấm tối thiểu 44×44px trên thao tác chính và mobile.
- Input có label; icon-only button có `aria-label`; heading đúng thứ bậc; trạng thái không chỉ truyền đạt bằng màu.
- Hỗ trợ bàn phím cho menu, modal, bảng và thanh thao tác.
- Khi `prefers-reduced-motion: reduce`, animation/transition rút về gần tức thời, smooth scroll tắt nhưng trạng thái cuối vẫn đúng.

## 9. Kiểm tra trước khi giao

Chạy từ `bigbike-admin`:

```powershell
node scripts/check-i18n.js
npm run lint
$env:VITE_STOREFRONT_BASE_URL='https://bigbike.vn'; npm test -- --run
$env:VITE_STOREFRONT_BASE_URL='https://bigbike.vn'; npm run build
```

Khi Docker backend/database đang hoạt động, chạy đủ Playwright qua preview kiểm thử cô lập `:4280`; không tự khởi động hoặc restart dịch vụ dùng chung. Chỉ cập nhật ảnh chuẩn sau khi xem trực tiếp khác biệt ở 1440, 768 và 375px.
