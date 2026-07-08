# Audit BigBike Admin - chức năng thừa và trùng lặp

Ngày audit: 2026-07-06  
Phạm vi: chỉ đọc `bigbike-admin/src`, đối chiếu docs nghiệp vụ/quyền/API; không sửa source code.

## 1. Tóm tắt

Tài liệu đã đọc trước khi audit:

- `docs/business/MODULE_CATALOG.md`
- `docs/engineering/PERMISSION_MATRIX.md`
- `docs/engineering/API_CONTRACT.md`
- `docs/business/BUSINESS_RULES.md`

Tài liệu đọc thêm khi cần đối chiếu state/data:

- `docs/business/STATE_MACHINES.md`
- `docs/engineering/DATA_CONTRACT.md`

Phạm vi màn hình đã đối chiếu:

- `App.jsx:21-48` lazy import màn hình.
- `App.jsx:51-100` nhóm menu.
- `App.jsx:123-163` parse route.
- `App.jsx:168-200` permission theo route.
- `App.jsx:355-416` render switch.

Kết quả tổng hợp:

| Nhóm | Số phát hiện | Ghi chú |
|---|---:|---|
| Code chết | 3 | Là API wrapper/export không có màn hình nào gọi tới. Không thấy screen/component UI nguyên file bị chết. |
| Nghiệp vụ lỗi thời | 5 | Chủ yếu liên quan `PAGE` content cũ và return/refund/RMA/REFUNDED đã bị gỡ. |
| Trùng lặp UI | 0 | Không có cặp màn hình/menu nào được xác nhận là cùng cho phép sửa cùng một nghiệp vụ theo cách gây rối. |
| Trùng lặp code | 4 | Picker, modal media, field/card wrapper, bảng/list scaffolding. |
| Cần xác minh thêm | 4 | Có liên quan log lịch sử hoặc docs đang mâu thuẫn/chưa rõ. |

Kiểm tra wiring/code chết cấp file:

- Script import graph từ `bigbike-admin/src/main.jsx`: `ENTRY_REACHABLE 197 OF 204`.
- Các file không reachable chỉ là test: `lib/categoryIntro.test.js`, `lib/contentPublishTransitions.test.js`, `lib/sizeChart.test.js`, `lib/specSheet.test.js`, `lib/specStatsBlock.test.js`, `lib/suitabilityCards.test.js`, `lib/trustBadgesBlock.test.js`.
- Kết luận: không thấy screen/component chính nào bị import nhưng không render. Các phát hiện code chết bên dưới là hàm/API wrapper hoặc nhánh nghiệp vụ cũ trong file vẫn đang được dùng.

Không tính là phát hiện:

- `BannerScreen` hợp lệ: docs xác nhận listing page hero banners do admin quản lý (`MODULE_CATALOG.md:8`, `API_CONTRACT.md:1181`); `SettingsScreen.jsx:402` nhúng `BannerScreen`.
- Dashboard và Reports hợp lệ: docs tách rõ Dashboard tổng quan vận hành và Reports phân tích/xuất file (`MODULE_CATALOG.md:37-38`).
- Product assignment guide hiển thị ở cả product và content là thiết kế có chủ đích, cùng endpoint/cùng data (`PERMISSION_MATRIX.md:69`, `API_CONTRACT.md:1132`).
- Inventory summary ở Dashboard hợp lệ: inventory screen đã gỡ, nhưng summary endpoint được giữ cho cảnh báo hết hàng (`MODULE_CATALOG.md:29`, `DashboardScreen.jsx:117-118`).

## 2. Chức năng thừa

| File | Loại | Bằng chứng | Mức độ tin cậy |
|---|---|---|---|
| `bigbike-admin/src/lib/adminApi.js:746` (`fetchRedirectDetail`) | Code chết | Script export-ref: `fetchRedirectDetail -> NO_NONSELF_REFS`. `rg -n "fetchRedirectDetail"` chỉ ra `adminApi.js:746`. Wiring thật: route redirects chỉ có list: `App.jsx:156`, permission `App.jsx:193`, render `RedirectListScreen` tại `App.jsx:399-400`; không có route/detail screen redirect. Ảnh hưởng: API/permission `redirects.read`, không chạm state machine. | Cao |
| `bigbike-admin/src/lib/adminApi.js:1108` (`updateSetting`) | Code chết | Script export-ref: `updateSetting -> NO_NONSELF_REFS`. Màn Settings import/call bulk: `SettingsScreen.jsx:7` import `fetchSettings, batchUpdateSettings`, `SettingsScreen.jsx:188` gọi `batchUpdateSettings`; `adminApi.js:1116` là bulk wrapper đang dùng. Ảnh hưởng: API settings, permission `settings.write`, không chạm state machine. | Cao |
| `bigbike-admin/src/lib/adminApi.js:1742` (`markAdminNotificationsRead`) | Code chết | Script export-ref: `markAdminNotificationsRead -> NO_NONSELF_REFS`. Notification bell import `fetchAdminNotifications, markAllAdminNotificationsRead` tại `NotificationBell.jsx:5`, gọi mark all tại `NotificationBell.jsx:107-114`; không có call mark từng notification. Ảnh hưởng: notification API (`orders.read` theo `API_CONTRACT.md:1277-1278`), không chạm business state. | Cao |
| `bigbike-admin/src/lib/contracts.js:11`, `bigbike-admin/src/lib/adminApi.js:317-333`, `bigbike-admin/src/screens/content-detail/constants.js:17-22`, `bigbike-admin/src/screens/content-detail/constants.js:28-30`, `bigbike-admin/src/screens/content-detail/constants.js:92`, `bigbike-admin/src/screens/content-detail/constants.js:259-271`, `bigbike-admin/src/lib/schemas.js:647`, `bigbike-admin/src/lib/schemas.js:700-701`, `bigbike-admin/src/screens/ContentDetailScreen.jsx:626` | Nghiệp vụ lỗi thời | Docs: static CMS pages/guide-page đã removed (`MODULE_CATALOG.md:28`), `content.read/update` nay chỉ scope articles (`PERMISSION_MATRIX.md:37`), content state chỉ còn articles (`STATE_MACHINES.md:609`). Wiring thật: `App.jsx:137-140` content route luôn set `contentType: 'ARTICLE'`; `App.jsx:376-380` truyền route đó vào `ContentDetailScreen`; `ContentListScreen.jsx:85` create path là `/admin/content/articles/new`. Nhưng code vẫn giữ `CONTENT_TYPE_VALUES = ['ARTICLE','PAGE']`, path `/pages`, `pageType`, `heroImage`, `heroTitle`, validation PAGE. Ảnh hưởng: API contract + data contract content; permission `content.read/update`; không chạm order state. | Cao |
| `bigbike-admin/src/screens/OrderListScreen.jsx:26-27`, `bigbike-admin/src/screens/OrderListScreen.jsx:107-109`, `bigbike-admin/src/screens/OrderListScreen.jsx:326-331`, `bigbike-admin/src/components/StatusBadge.jsx:11`, `bigbike-admin/src/components/StatusBadge.jsx:19`, `bigbike-admin/src/screens/order-detail/constants.js:8`, `bigbike-admin/src/screens/OrderDetailScreen.jsx:181-182`, `bigbike-admin/src/screens/OrderDetailScreen.jsx:350-351`, `bigbike-admin/src/lib/contracts.js:690-693`, `bigbike-admin/src/locales/vi.json:342`, `bigbike-admin/src/locales/vi.json:348`, `bigbike-admin/src/locales/en.json:342`, `bigbike-admin/src/locales/en.json:348` | Nghiệp vụ lỗi thời | Docs: `REFUNDED` order/payment status đã removed (`BUSINESS_RULES.md:54`, `BUSINESS_RULES.md:57`, `STATE_MACHINES.md:56-57`, `DATA_CONTRACT.md:222`). UI vẫn render filter/status/action branch cho `REFUNDED` trong order list/detail và normalizer vẫn chấp nhận status này. Ảnh hưởng: order state machine + data contract + permission `orders.read/write`. | Cao |
| `bigbike-admin/src/lib/contracts.js:823-825` | Nghiệp vụ lỗi thời | Docs: refund data model đã removed (`DATA_CONTRACT.md:222`, `BUSINESS_RULES.md:390`), refund metrics/status đã gỡ (`BUSINESS_RULES.md:359`). Normalizer vẫn map `refundAmount`, `refundReason`, `refundedAt`. Ảnh hưởng: data contract order/payment; không thấy UI hiển thị trực tiếp field này. | Cao |
| `bigbike-admin/src/screens/OrderDetailScreen.jsx:633-635`, `bigbike-admin/src/locales/vi.json:1128`, `bigbike-admin/src/locales/en.json:1128` | Nghiệp vụ lỗi thời | `OrderDetailScreen.jsx:631-635` đang hiển thị `order.trackingNumber` nhưng label key là `orders.detail.colRma`; locale VI/EN là "Mã RMA"/"RMA #". Docs: return/RMA/refund feature removed platform-wide (`MODULE_CATALOG.md:30`, `BUSINESS_RULES.md:390`, `STATE_MACHINES.md:523`). Ảnh hưởng: fulfillment display/data contract; không phải permission mới. | Cao |
| `bigbike-admin/src/screens/ReportsScreen.jsx:327`, `bigbike-admin/src/locales/vi.json:2332`, `bigbike-admin/src/locales/en.json:2332` | Nghiệp vụ lỗi thời | KPI GMV hint vẫn nói "chưa trừ hoàn tiền"/"before refunds". Docs: refund metrics đã removed; net revenue = paid revenue (`BUSINESS_RULES.md:359`), report rules đã bỏ `REFUNDED` handling (`BUSINESS_RULES.md:364`, `BUSINESS_RULES.md:370`). Ảnh hưởng: report/business copy; không chạm permission/state. | Cao |

## 3. Chức năng trùng lặp

| Các file/màn hình liên quan | Loại | Đề xuất giữ bản nào | Lý do |
|---|---|---|---|
| `bigbike-admin/src/components/ProductPickerCombobox.jsx:20`; wrappers riêng tại `FeaturedProductsScreen.jsx:22-60`, `HomeHighlightsScreen.jsx:30-54`, `SliderListScreen.jsx:181-188` và `SliderListScreen.jsx:601-606`, `ProductDetailScreen.jsx:286-317`, `ProductDetailScreen.jsx:1658-1667`, `ProductDetailScreen.jsx:1832-1841` | Code | Giữ `ProductPickerCombobox`, tạo/giữ thêm một hook/wrapper search sản phẩm dùng chung cho fetch/debounce/open/filter disabled ids. | Cùng nghiệp vụ "chọn sản phẩm published từ catalog" bị viết lại fetch/debounce/query key/open state nhiều lần. UI surface khác nhau nên không nên gộp màn hình, chỉ nên gộp logic tìm/chọn. |
| `bigbike-admin/src/components/MediaPickerModal.jsx:86`, `bigbike-admin/src/components/MediaPickerModal.jsx:121`, `bigbike-admin/src/components/MediaPickerModal.jsx:145-181`, `bigbike-admin/src/components/VideoPickerModal.jsx:58`, `bigbike-admin/src/components/VideoPickerModal.jsx:88`, `bigbike-admin/src/components/VideoPickerModal.jsx:120-150`; usages: `BlockEditor.jsx:138-151`, `HomeVideoListScreen.jsx:931`, `ContentEditors.jsx:142-153`, `ContentEditors.jsx:478` | Code | Giữ một picker media có `kind=image/video` thật sự dùng MIME từ `kind`, hoặc tách shared core cho search/upload/focus trap/cache. | Hai modal cùng làm search media, debounce, fetch, focus trap, portal, select/upload; khác chính là MIME image/video. Hiện `MediaPickerModal` nhận prop `kind` nhưng fetch hardcode `mimeType: 'image/'`, còn video có modal riêng. |
| `bigbike-admin/src/components/layout/FormField.jsx:12-23`, `bigbike-admin/src/screens/content-detail/Field.jsx:7-17`, `bigbike-admin/src/screens/product-detail/Layout.jsx:143-155`, `bigbike-admin/src/screens/content-detail/SectionCard.jsx:3`, `bigbike-admin/src/screens/product-detail/Layout.jsx:103` | Code | Giữ/extend `components/layout/FormField.jsx`; cần thêm shared `SectionCard` hoặc dùng `DetailSection` nếu phù hợp. | Cùng wrapper label/error/hint/count và clone child để gắn `id`/`aria-*` bị copy ở content detail và product detail. Để lặp như vậy dễ lệch accessibility, required state, error display. |
| `bigbike-admin/src/components/AdminTable.jsx:13-29`, đang dùng tốt ở `OrderListScreen.jsx:396-413`, `BrandListScreen.jsx:542-557`, `ContentListScreen.jsx:533-550`, `RedirectListScreen.jsx:663-675`; nhưng `ProductListScreen.jsx:393`, `ProductListScreen.jsx:636-716` viết riêng sortable/table/mobile/pagination; `CategoryListScreen.jsx:553-607`, `CategoryListScreen.jsx:1004-1097` viết riêng selection/tree/flat tables | Code | Giữ `AdminTable` làm chuẩn cho list bình thường; riêng `CategoryListScreen` có tree table nên có thể giữ custom nếu không map được vào AdminTable. | Nhiều list lặp logic bảng, sort, checkbox selection, mobile card, pagination. Product list có thể là ứng viên đưa về `AdminTable`/shared list primitives; category tree cần cân nhắc do có hierarchy. |

Không có duplicate UI được xác nhận:

- `DashboardScreen` và `ReportsScreen` cùng có KPI/top products nhưng docs xác nhận hai mục đích khác nhau: dashboard vận hành nhanh (`orders.read`) và reports phân tích/export (`reports.read/export`) tại `MODULE_CATALOG.md:37-38`.
- `FeaturedProductsScreen` và `ProductListScreen` cùng liên quan `homepageBlock`, nhưng docs nói `homepageBlock/homepageOrder` chỉ set qua endpoint `homepage-blocks` (`API_CONTRACT.md:457-459`). `ProductListScreen.jsx:598-608` chỉ cảnh báo khi filter block vượt limit, không sửa danh sách.

## 4. Cần xác minh thêm

| Trường hợp | Bằng chứng | Vì sao cần xác minh |
|---|---|---|
| Audit-log labels cho event đã gỡ: refund, static page, POS | `screens/audit-log-list/constants.js:9`, `screens/audit-log-list/constants.js:16`, `screens/audit-log-list/constants.js:22`; locales: `vi.json:2153-2154`, `vi.json:2211-2215`, `en.json:2153-2154`, `en.json:2211-2215`. Docs: returns/refunds removed (`BUSINESS_RULES.md:390`), pages removed (`MODULE_CATALOG.md:28`), POS removed (`MODULE_CATALOG.md:32`). | Có thể cần giữ để đọc audit log lịch sử. Nếu audit log lịch sử đã purge hoặc owner không cần hiện event cũ, các label/filter này là dư. |
| Docs permission cho auto-translate đang mâu thuẫn | `PERMISSION_MATRIX.md:77-85` vẫn mô tả `POST /api/v1/admin/translate`; trong khi `BUSINESS_RULES.md:132`, `BUSINESS_RULES.md:253`, `API_CONTRACT.md:289-292` nói auto-translate và endpoint đã gỡ. `rg -n "/admin/translate|translate/backfill"` trong `bigbike-admin/src` không có kết quả. | Chạm permission + API contract. Cần chốt docs nào sẽ update; theo docs-first, business/API hiện tại nghiêng về "đã gỡ". |
| Fulfillment status `RETURNED` còn xuất hiện trong order detail | Admin: `OrderDetailScreen.jsx:237-239`, `OrderDetailScreen.jsx:282`. Docs: đầu file state machine ghi fulfillment transitions not confirmed/needs verification (`STATE_MACHINES.md:58`, `STATE_MACHINES.md:846`), nhưng section fulfillment lại có `RETURNED` transitions (`STATE_MACHINES.md:409-423`); return/RMA feature đã removed (`STATE_MACHINES.md:523`). | Không nên tự kết luận xóa `RETURNED` vì docs đang mâu thuẫn giữa "fulfillment returned" và "return/RMA removed". Cần owner/backend xác nhận `RETURNED` ở delivery lifecycle còn dùng hay là vestige của returns. |
| Route shortcut cũ `/admin/banners` | `App.jsx:159-160` map `banners` về `settings`; `App.jsx:235-241` comment/redirect nói đây là lối tắt cũ. Docs xác nhận Banner trang hợp lệ trong Settings (`MODULE_CATALOG.md:8`, `API_CONTRACT.md:1181`). | Không phải duplicate UI vì không có menu riêng, nhưng là route legacy. Cần owner xác nhận có cần giữ cho bookmark/nội bộ hay có thể bỏ về sau. |
