# ADMIN_DESIGN.md

> Admin-specific UX/UI guideline cho `bigbike-admin`.
>
> File này mô tả cách thiết kế dashboard quản trị BigBike: layout shell, navigation, CRUD, table, form, filter, detail screen, status display, empty/loading/error state và operational UX.
>
> File này phải bám theo:
> - `docs/brand/BRAND_GUIDELINES.md`
> - `docs/design/DESIGN_SYSTEM.md`
> - `docs/tokens/ADMIN_DESIGN_TOKENS.md`
>
> File này không định nghĩa business rules, API contract, database schema, permission matrix hoặc token implementation chi tiết. Dashboard không cần ôm hết vũ trụ, dù con người hay bắt một trang quản trị làm như vậy.

---

## 1. Purpose

`ADMIN_DESIGN.md` là tài liệu thiết kế riêng cho `bigbike-admin`, dùng để hướng dẫn developer và AI agent khi xây dựng hoặc chỉnh sửa giao diện quản trị nội bộ.

Admin dashboard phục vụ nhóm vận hành, quản trị sản phẩm, xử lý đơn hàng, quản lý nội dung, theo dõi dữ liệu và cấu hình hệ thống. Vì vậy UX phải ưu tiên:

- Đọc dữ liệu nhanh.
- Tìm kiếm và lọc hiệu quả.
- Thao tác nghiệp vụ rõ ràng.
- Tránh nhầm lẫn ở action nguy hiểm.
- Trạng thái dữ liệu minh bạch.
- Form/CRUD ổn định.
- Không trang trí dư thừa.

File này áp dụng cho toàn bộ `bigbike-admin`, bao gồm:

- Login/admin auth screen.
- Dashboard overview.
- Product/catalog management.
- Order management.
- Customer/user management.
- Content/news/page management.
- Promotion/campaign management nếu có.
- Inventory/stock-related admin screens nếu có.
- Settings/configuration screens.
- Support/contact/ticket screens nếu có.
- Shared admin components.

File này không thay thế:

- `DESIGN_SYSTEM.md`: shared UI rulebook.
- `ADMIN_DESIGN_TOKENS.md`: token implementation chi tiết.
- `BUSINESS_RULES.md`: business behavior.
- `API_CONTRACT.md`: backend/API contract.
- `DATA_CONTRACT.md`: data model contract.
- `PERMISSION_MATRIX.md`: role/permission rules nếu dự án có file này.

---

## 2. Admin Design Principles

### 2.1 Data-first

Admin UI phải ưu tiên dữ liệu. Mọi visual phải phục vụ việc đọc, so sánh, lọc, chỉnh sửa hoặc ra quyết định.

Không dùng layout kiểu landing page cho màn hình vận hành. Operator không cần một hero “BỨT TỐC CÙNG BIGBIKE” khi họ chỉ muốn tìm đơn hàng chưa xử lý. Đời đã đủ nhiễu.

### 2.2 Fast operation

Admin phải cho phép thao tác nhanh:

- Search rõ.
- Filter dễ dùng.
- Sort trực quan.
- Row actions nhất quán.
- Bulk actions khi cần.
- Form có validation gần field.
- Loading/submitting state rõ.
- Không bắt người dùng click quá nhiều để làm việc phổ biến.

### 2.3 Predictable layout

Các module admin phải dùng chung cấu trúc:

- Page title.
- Description/helper nếu cần.
- Primary action.
- Filter/search area.
- Main data area.
- Pagination.
- Empty/error/loading state.

Không để mỗi module phát minh layout mới chỉ vì “trông khác cho vui”.

### 2.4 Safe actions

Action nguy hiểm phải được thiết kế cẩn thận:

- Xóa.
- Hủy.
- Disable.
- Publish/unpublish.
- Change status có ảnh hưởng vận hành.
- Bulk update.
- Reset hoặc clear dữ liệu.

Các action này cần confirmation, message rõ hậu quả, và không đặt quá gần action an toàn nếu dễ bấm nhầm.

### 2.5 Compact but readable

Admin nên dense hơn public website, nhưng không được khó đọc.

- Table row có thể compact.
- Filter bar gọn.
- Card metric gọn.
- Form chia nhóm rõ.
- Text không quá nhỏ.
- Spacing không bóp nghẹt nội dung.

### 2.6 Brand-aware, not brand-heavy

Admin vẫn thuộc BigBike, nhưng brand expression phải tiết chế.

Dùng brand cho:

- Logo.
- Sidebar/header.
- Primary action.
- Focus state.
- Key accent.
- Login screen.

Không dùng quá mức:

- Bungee everywhere.
- Red background toàn trang.
- Biker photo làm nền mọi màn.
- Animation marketing.
- Texture/grunge trên table/form.

Admin là chỗ làm việc, không phải poster treo garage.

---

## 3. Brand Application for Admin

### 3.1 Color usage

Admin dùng BigBike Red `#F90606` cho:

- Primary action.
- Active navigation.
- Focus state.
- Important alert.
- Destructive/error khi context phù hợp.
- Badge/pill cần emphasis.

Admin không dùng red cho:

- Toàn bộ background.
- Mọi icon.
- Mọi text active.
- Tất cả status.
- Decoration không có ý nghĩa.

Dark gray / black dùng cho:

- Sidebar.
- Top bar nếu phù hợp.
- Login visual panel.
- Brand header.
- Footer/internal shell nếu có.

Content area nên ưu tiên readability. Nếu dùng dark admin toàn bộ, cần token riêng và kiểm tra contrast kỹ.

### 3.2 Typography

Admin default font là `Exo`.

Dùng `Exo` cho:

- Page title.
- Navigation.
- Table.
- Form.
- Button.
- Badge.
- Filter.
- Modal.
- Toast.
- Detail metadata.

`Bungee` chỉ nên dùng rất tiết chế:

- Login brand display.
- Empty state brand-heavy nếu phù hợp.
- Campaign/admin preview title nếu cần.

Không dùng Bungee cho table, form, menu, button phổ thông hoặc paragraph dài.

### 3.3 Logo usage

Logo dùng ở:

- Login screen.
- Sidebar brand area.
- App header nếu không có sidebar.
- Empty state hoặc auth-related page nếu cần.

Rules:

- Logo đúng variant.
- Không stretch.
- Không đổi màu ngoài guideline.
- Không đặt trên nền rối.
- Không lặp logo quá nhiều.

### 3.4 Icon style

Admin icon phải:

- Cùng style.
- Cùng stroke/fill weight.
- Dễ hiểu.
- Không cute/cartoon.
- Có label hoặc accessible label nếu là icon-only button.

Icon không được là nguồn ý nghĩa duy nhất cho status hoặc destructive action.

---

## 4. Admin Information Architecture

### 4.1 Main navigation groups

Admin navigation nên tổ chức theo nhóm nghiệp vụ rõ ràng. Tùy scope thực tế, có thể gồm:

- Dashboard
- Orders
- Products
- Categories / Brands
- Customers / Accounts
- Content / News / Pages
- Promotions / Campaigns
- Inventory / Stock
- Support / Contacts
- Reports / Analytics
- Settings

Không bắt buộc phải có tất cả module nếu sản phẩm chưa triển khai. Không tạo menu rỗng để “trông có vẻ enterprise”, vì enterprise thật cũng đã đủ mệt.

### 4.2 Navigation rules

Sidebar/top navigation phải:

- Hiển thị active route rõ.
- Nhóm menu theo domain.
- Không quá nhiều cấp nested.
- Có collapsed state nếu cần.
- Có tooltip/label khi collapsed.
- Không đổi vị trí item giữa các phiên làm việc.

### 4.3 Page naming

Page title phải rõ domain:

- `Orders`
- `Products`
- `Product detail`
- `Create product`
- `Edit product`
- `Customers`
- `Content posts`
- `Settings`

Không dùng title mơ hồ như `Management`, `Detail`, `List`.

### 4.4 Breadcrumbs

Dùng breadcrumbs cho màn hình sâu:

```text
Products / Helmets / Edit product
Orders / #BB-1024
Content / News / Edit post
```

Breadcrumb giúp operator biết đang ở đâu và quay lại nhanh.

---

## 5. Admin Shell Layout

### 5.1 Desktop shell

Desktop shell khuyến nghị:

```text
┌───────────────────────────────────────────────┐
│ Top bar: search / notifications / account     │
├───────────────┬───────────────────────────────┤
│ Sidebar       │ Page header                   │
│ Navigation    │ Filters / actions             │
│               │ Main content                  │
│               │ Pagination / footer actions   │
└───────────────┴───────────────────────────────┘
```

Rules:

- Sidebar ổn định.
- Top bar không quá cao.
- Content area đủ rộng cho table.
- Primary action nằm trong page header hoặc action bar.
- Filter/search nằm gần data area.

### 5.2 Sidebar

Sidebar phải có:

- Logo/brand compact.
- Main navigation.
- Active item.
- Collapsed option nếu cần.
- User/account/settings entry nếu phù hợp.

Sidebar không nên chứa:

- Banner marketing lớn.
- Social links public.
- Hình ảnh trang trí.
- Menu item chưa có route.

### 5.3 Top bar

Top bar có thể chứa:

- Global search nếu có.
- Notification/system alert.
- Current user menu.
- Quick action nếu rất cần.
- Environment indicator nếu có staging/production.

Không đặt quá nhiều action trong top bar khiến page action bị loãng.

### 5.4 Page header

Mỗi page nên có:

- Title.
- Description ngắn nếu cần.
- Primary action.
- Optional secondary actions.
- Optional breadcrumbs.

Ví dụ:

```text
Products
Manage product catalog, pricing, stock visibility and publish status.
[Create product]
```

### 5.5 Content region

Content region phải rõ:

- Filter area.
- Data table/list.
- State container.
- Pagination/footer.

Không để filter, table, actions và empty state trộn vào nhau không hierarchy.

---

## 6. Dashboard Overview

### 6.1 Dashboard goal

Dashboard là màn hình giúp admin nhìn nhanh tình hình vận hành.

Nên ưu tiên:

- KPI chính.
- Đơn hàng cần xử lý.
- Sản phẩm/tồn kho cần chú ý.
- Recent activities.
- System alerts.
- Quick links tới module quan trọng.

Không biến dashboard thành nơi nhồi mọi chart có thể vẽ được.

### 6.2 Metric cards

Metric card phải có:

- Label rõ.
- Value nổi bật.
- Delta/trend nếu có dữ liệu.
- Time range nếu metric phụ thuộc thời gian.
- Loading/empty/error state.

Không hiển thị số không rõ nghĩa.

Ví dụ label tốt:

- `Orders today`
- `Pending orders`
- `Low stock products`
- `Published products`
- `Revenue this month`

### 6.3 Dashboard tables/lists

Dashboard có thể có compact lists:

- Recent orders.
- Products needing attention.
- Latest contacts/support requests.
- Recent content updates.

Rules:

- Chỉ hiển thị top items.
- Có link `View all`.
- Không copy full table module vào dashboard.

### 6.4 Alerts

Alert nên dùng cho việc cần chú ý:

- Failed sync.
- Low stock.
- Payment/checkout issue nếu có.
- Content publish issue.
- System configuration missing.

Alert phải có action tiếp theo hoặc link chi tiết nếu relevant.

---

## 7. Product & Catalog Admin UX

### 7.1 Product list

Product list nên hỗ trợ:

- Search theo tên/SKU.
- Filter theo category, brand, publish status, stock state.
- Sort theo updated date, price, stock, name.
- Pagination.
- Row actions.
- Bulk actions nếu relevant.
- Loading/empty/error state.

Các cột khuyến nghị:

- Product image thumbnail.
- Product name.
- SKU nếu có.
- Category/brand.
- Price.
- Stock/status.
- Publish state.
- Updated date.
- Actions.

Không nhồi mô tả dài vào table. Table là để scan, không phải đọc tiểu thuyết sản phẩm.

### 7.2 Product thumbnail

Thumbnail phải:

- Có fallback khi ảnh lỗi.
- Giữ tỷ lệ nhất quán.
- Không làm row quá cao vô lý.
- Click được nếu dẫn tới detail/edit.

### 7.3 Product create/edit form

Product form nên chia nhóm:

- Basic information.
- Media.
- Pricing.
- Category/brand.
- Inventory/stock visibility.
- SEO/content fields nếu có.
- Publish settings.

Rules:

- Field label rõ.
- Validation gần field.
- Autosave chỉ dùng nếu có UX rõ.
- Dirty state cần cảnh báo khi rời trang nếu mất dữ liệu.
- Save action cố định hoặc dễ tìm.

### 7.4 Media management

Media UI phải:

- Cho upload/choose image rõ.
- Có preview.
- Có trạng thái loading/uploading.
- Có error khi upload fail.
- Có alt text nếu ảnh dùng public web.
- Có reorder nếu gallery cần thứ tự.

Không để admin upload ảnh mà không biết ảnh nào sẽ làm cover.

### 7.5 Publish state

Publish state phải rõ bằng text + badge:

- Draft.
- Published.
- Hidden/unlisted nếu có.
- Scheduled nếu có.

Không chỉ dùng icon con mắt rồi bắt người dùng đoán.

---

## 8. Order Admin UX

### 8.1 Order list

Order list là màn hình vận hành quan trọng. Phải tối ưu scan và xử lý nhanh.

Nên hỗ trợ:

- Search theo mã đơn, tên khách, phone/email nếu có.
- Filter theo status, payment state, date range, shipping state nếu có.
- Sort theo created date, updated date, total.
- Pagination.
- Row action.
- Bulk action nếu domain cho phép.
- Export nếu có nhu cầu vận hành.

Các cột khuyến nghị:

- Order code.
- Customer.
- Total.
- Payment state.
- Order status.
- Created date.
- Updated date.
- Actions.

Không invent status mới ở design doc. Status thật phải lấy từ `BUSINESS_RULES.md` hoặc data contract.

### 8.2 Order status display

Status phải:

- Có text label.
- Có màu semantic.
- Consistent toàn admin.
- Có tooltip/helper nếu status phức tạp.
- Không chỉ dùng màu.

### 8.3 Order detail

Order detail nên chia thành:

- Header: order code, status, primary actions.
- Customer information.
- Items.
- Payment/shipping info nếu có.
- Timeline/activity.
- Notes/internal comments nếu có.
- Audit/history nếu có.

Actions phải rõ hậu quả:

- Confirm.
- Update status.
- Cancel.
- Print/export.
- Contact customer.

Dangerous hoặc irreversible action phải confirmation.

### 8.4 Order timeline

Timeline nên dùng cho trạng thái xử lý:

- Created.
- Confirmed.
- Processing.
- Shipped.
- Completed.
- Cancelled.
- Failed events nếu có.

Timeline phải show timestamp và actor nếu data có. Nếu không có data, không giả vờ có.

### 8.5 Manual notes

Nếu admin có notes:

- Note input rõ context.
- Phân biệt internal note và customer-facing note.
- Có timestamp và author nếu data hỗ trợ.
- Không để note quan trọng trôi mất trong UI.

---

## 9. Customer / Account Admin UX

### 9.1 Customer list

Customer list nên hỗ trợ:

- Search theo tên/email/phone nếu có.
- Filter theo status/group nếu có.
- Sort theo created date/recent activity nếu có.
- Pagination.
- Row actions.

Các cột khuyến nghị:

- Customer name.
- Contact.
- Order count nếu có.
- Last activity/order nếu có.
- Status.
- Created date.
- Actions.

### 9.2 Customer detail

Customer detail nên có:

- Profile summary.
- Contact info.
- Order history nếu có.
- Addresses nếu có.
- Notes nếu có.
- Account status/actions.

Không hiển thị dữ liệu nhạy cảm quá mức nếu role không cần.

### 9.3 Privacy-aware UI

Admin UI phải tránh phơi dữ liệu cá nhân không cần thiết.

Rules:

- Không show full sensitive data nếu không cần.
- Có clear permission denied state.
- Không log/display secret/token.
- Copy/export dữ liệu cá nhân phải theo permission/business docs.

Design doc không định nghĩa policy, nhưng UI phải hỗ trợ privacy-aware behavior.

---

## 10. Content / News / Page Admin UX

### 10.1 Content list

Content list nên hỗ trợ:

- Search title.
- Filter publish status/category.
- Sort updated/published date.
- Pagination.
- Quick preview.
- Edit action.

Các cột khuyến nghị:

- Title.
- Type/category.
- Author nếu có.
- Publish status.
- Updated date.
- Actions.

### 10.2 Editor layout

Editor nên chia:

- Main content area.
- SEO/meta panel nếu có.
- Publish panel.
- Media/cover image.
- Preview action.

Rules:

- Save/publish action rõ ràng.
- Draft vs published state rõ.
- Preview không được nhầm với publish.
- Validation cho title/slug/required content nếu domain yêu cầu.

### 10.3 SEO/content hints

Nếu admin quản lý public content:

- Title length hint nếu có.
- Meta description hint nếu có.
- Slug field rõ.
- Cover image alt text nếu có.

Không nhồi SEO rule quá sâu ở đây. Chi tiết thuộc `WEB_DESIGN.md` hoặc SEO docs nếu có.

---

## 11. Promotion / Campaign Admin UX

### 11.1 Promotion list

Nếu có module promotion/campaign, list nên có:

- Campaign name.
- Status.
- Start/end date.
- Target/scope nếu có.
- Last updated.
- Actions.

### 11.2 Campaign form

Campaign form nên group:

- Basic information.
- Time range.
- Visual/banner config nếu có.
- Applicable products/categories nếu có.
- Publish/active state.

Không invent pricing/discount business logic trong design doc.

### 11.3 Visual preview

Nếu campaign ảnh hưởng public UI, admin nên có preview:

- Banner preview.
- Badge preview.
- Mobile/desktop preview nếu có thể.
- Warning nếu thiếu image/copy.

---

## 12. Inventory / Stock Admin UX

### 12.1 Stock visibility

Nếu có stock/admin inventory UI, trạng thái phải rõ:

- In stock.
- Low stock.
- Out of stock.
- Preorder/backorder nếu business docs có.

Không tự tạo trạng thái ngoài contract.

### 12.2 Stock list

Stock-related table nên ưu tiên:

- Product/SKU.
- Current stock.
- Threshold nếu có.
- Stock state.
- Updated date.
- Actions.

### 12.3 Warnings

Low-stock/out-of-stock warning phải:

- Dễ thấy.
- Không dùng màu một mình.
- Có link/action tới sản phẩm liên quan.

---

## 13. Support / Contact Admin UX

### 13.1 Support list

Nếu có support/contact module, list nên có:

- Customer/contact.
- Subject.
- Status.
- Priority nếu có.
- Created date.
- Last update.
- Assignee nếu có.
- Actions.

### 13.2 Conversation/detail

Support detail nên có:

- Original request.
- Conversation/reply timeline nếu có.
- Internal notes nếu có.
- Status/action panel.
- Attachments nếu có.

### 13.3 Reply UX

Nếu admin có reply:

- Textarea rõ.
- Attachment state rõ.
- Submit loading.
- Error recovery.
- Confirmation nếu gửi external/customer-facing message.

Không để admin bấm nhầm giữa internal note và customer reply.

---

## 14. Settings UX

### 14.1 Settings structure

Settings nên group theo domain:

- Store/profile.
- Users/roles nếu có.
- Payment/shipping config nếu có.
- SEO/content config nếu có.
- Notification config nếu có.
- System/integration config nếu có.

Không tạo một trang settings dài như hóa đơn tiền điện.

### 14.2 Settings forms

Settings form phải:

- Có section heading.
- Có helper text.
- Có save state.
- Có validation.
- Có confirmation với destructive/reset action.
- Có permission denied state nếu user không có quyền.

### 14.3 Sensitive settings

Sensitive settings phải:

- Không show secret raw.
- Có reveal/copy behavior an toàn nếu cần.
- Có confirmation khi rotate/reset.
- Có audit/history nếu backend hỗ trợ.

---

## 15. Search, Filter, Sort Pattern

### 15.1 Search

Search phải:

- Đặt gần table/list.
- Có placeholder cụ thể.
- Có clear button nếu nhập text.
- Không trigger quá nhiều request nếu chưa debounce.
- Không làm mất filter hiện tại trừ khi user reset.

Placeholder tốt:

```text
Search orders by code or customer
Search products by name or SKU
Search customers by name, phone or email
```

### 15.2 Filters

Filter phải:

- Có label.
- Có default state.
- Có reset all.
- Hiển thị active filters khi có nhiều filter.
- Không ẩn filter quan trọng quá sâu.

### 15.3 Advanced filters

Advanced filters dùng khi filter nhiều.

Rules:

- Collapsible.
- Không che mất table.
- Có apply/reset rõ.
- Preserve state khi paging/sorting nếu có thể.

### 15.4 Sorting

Sort phải:

- Có visual indicator.
- Toggle direction rõ.
- Không reset search/filter vô lý.
- Default sort phải phù hợp domain.

---

## 16. CRUD Screen Pattern

### 16.1 List page

List page structure:

```text
Page header
Search/filter/action bar
Table/list
Pagination
State container
```

Bắt buộc có:

- Loading state.
- Empty state.
- Error state.
- Permission state nếu relevant.

### 16.2 Create page

Create page phải:

- Có title rõ.
- Có form grouping.
- Có validation.
- Có cancel/back action.
- Có submit loading.
- Có success handling.

Không đưa người dùng vào form trắng dài 2km không có section heading.

### 16.3 Edit page

Edit page phải:

- Load existing data rõ.
- Có dirty state nếu cần.
- Có save/cancel.
- Có error recovery.
- Có warning khi rời trang nếu dữ liệu chưa lưu.

### 16.4 Detail page

Detail page dùng để xem tổng quan và xử lý action.

Nên có:

- Summary header.
- Main details.
- Related data.
- Timeline/history nếu có.
- Action panel.

### 16.5 Delete / archive

Delete/archive action phải:

- Có confirmation.
- Ghi rõ object bị ảnh hưởng.
- Có loading state.
- Có success/error feedback.
- Không dùng primary red CTA giống action mua/lưu nếu dễ nhầm.

---

## 17. Forms

### 17.1 Field labels

Mọi field cần label visible.

Không dùng placeholder thay label.

### 17.2 Required fields

Required field phải rõ:

- `*`
- helper text
- validation message

Không chỉ dựa vào màu.

### 17.3 Validation

Validation message phải:

- Gần field.
- Cụ thể.
- Không blame user.
- Có hướng sửa nếu cần.

Tốt:

```text
Price must be greater than 0.
Product name is required.
Slug can only contain lowercase letters, numbers and hyphens.
```

Không tốt:

```text
Invalid.
Error.
Wrong input.
```

### 17.4 Form grouping

Form dài phải chia section:

- Basic information.
- Media.
- Pricing.
- Visibility.
- SEO.
- Advanced settings.

### 17.5 Submit area

Submit area phải:

- Dễ tìm.
- Có primary action.
- Có cancel/back nếu cần.
- Có loading/submitting state.
- Không cho double-submit.

### 17.6 Inline save vs page save

Chỉ dùng inline save khi:

- Field độc lập.
- Hậu quả rõ.
- Có loading/success/error tại field.
- Không gây conflict với full page save.

---

## 18. Tables

### 18.1 Table density

Admin table nên compact nhưng readable.

Rules:

- Row height đủ cho text và badge.
- Không nhồi paragraph vào cell.
- Long text truncate có tooltip/detail nếu cần.
- Important columns ưu tiên trái.
- Actions ưu tiên phải.

### 18.2 Column design

Column phải có purpose rõ.

Tránh:

- Quá nhiều cột.
- Cột tên mơ hồ.
- Cột chứa nhiều loại dữ liệu không liên quan.
- Cột action không nhất quán.

### 18.3 Row action

Row actions nên gồm:

- View/detail.
- Edit.
- More menu.
- Destructive action trong menu hoặc confirm flow.

Không đặt delete icon đỏ ngay cạnh edit nếu dễ bấm nhầm.

### 18.4 Bulk selection

Bulk selection phải:

- Có checkbox rõ.
- Có selected count.
- Có clear selection.
- Có confirmation với destructive bulk action.
- Không mất selection do sort/filter nếu behavior không rõ.

### 18.5 Table loading

Table loading dùng:

- Skeleton rows.
- Loading overlay nhẹ nếu refresh.
- Không xóa data cũ ngay nếu đang refetch, trừ khi cần.

### 18.6 Table empty

Empty state phải phân biệt:

- Không có data.
- Không có result do filter/search.
- Không có quyền xem data.
- Load failed.

### 18.7 Table error

Error state cần:

- Message rõ.
- Retry button.
- Không show raw server stack trace.

---

## 19. Status, Badge, and State Labels

### 19.1 Status label rules

Status label phải:

- Có text.
- Có color semantic.
- Có icon nếu giúp scan.
- Consistent toàn hệ thống.

Không dùng màu một mình.

### 19.2 Badge categories

Badge dùng cho:

- Order status.
- Payment state.
- Publish status.
- Stock state.
- Promotion state.
- User/account status.

### 19.3 Severity mapping

Semantic mapping chung:

- Success: hoàn tất, active, verified, in stock.
- Warning: cần chú ý, pending, low stock.
- Error/danger: failed, cancelled, invalid, out of stock nếu context cần.
- Info: informational, draft, scheduled, preorder nếu domain cho phép.
- Neutral: archived, disabled, no data.

Không tự quyết định meaning ngược nhau giữa module.

---

## 20. Modals, Drawers, and Overlays

### 20.1 Modal usage

Modal dùng cho:

- Confirmation.
- Small focused form.
- Preview nhanh.
- Action cần quyết định ngay.

Không dùng modal cho flow dài nhiều bước.

### 20.2 Drawer usage

Drawer phù hợp cho:

- Detail preview từ table.
- Filter panel.
- Quick edit nhẹ.
- Activity log preview.

Drawer không thay thế full page detail nếu nội dung phức tạp.

### 20.3 Confirmation dialogs

Confirmation dialog phải có:

- Title rõ.
- Object/action cụ thể.
- Hậu quả.
- Primary/destructive action rõ.
- Cancel action.
- Loading state khi confirm.

### 20.4 Overlay accessibility

Overlay phải:

- Trap focus nếu implement.
- Close bằng Escape nếu phù hợp.
- Không scroll background vô lý.
- Có accessible title.

---

## 21. Notifications, Toasts, and Feedback

### 21.1 Toast usage

Toast dùng cho feedback ngắn:

- Saved.
- Created.
- Deleted.
- Updated.
- Failed request.
- Export started/completed nếu có.

### 21.2 Toast content

Toast message phải:

- Ngắn.
- Cụ thể.
- Có action nếu cần.

Tốt:

```text
Product saved successfully.
Failed to update order. Retry.
```

Không tốt:

```text
Success.
Error happened.
```

### 21.3 Inline feedback

Dùng inline feedback cho:

- Form validation.
- Section-level error.
- Partial load issue.
- Permission warning.

Toast không thay thế inline form error.

---

## 22. Empty, Loading, Error, Permission States

### 22.1 Loading

Mọi màn hình phải có loading state:

- Full page loading cho initial load.
- Section loading cho partial load.
- Button loading cho submit/action.
- Table skeleton cho list.

### 22.2 Empty

Empty state cần:

- Title.
- Description.
- Primary action nếu có.
- Illustration/icon tiết chế nếu dùng.

Examples:

```text
No products yet.
Create your first product to start building the catalog.
[Create product]
```

```text
No orders match your filters.
Try changing the date range or clearing filters.
[Reset filters]
```

### 22.3 Error

Error state cần:

- Message.
- Retry action.
- Contact/support hint nếu cần.
- Không show raw technical details.

### 22.4 Permission denied

Permission denied state cần:

- Nói rõ không có quyền.
- Không leak dữ liệu.
- Có action quay lại hoặc liên hệ admin nếu phù hợp.

### 22.5 Partial data

Nếu chỉ một phần màn hình lỗi:

- Giữ phần data đã load được.
- Hiển thị inline warning ở section lỗi.
- Cho retry section đó.

---

## 23. Responsive Admin Rules

### 23.1 Desktop-first

Admin ưu tiên desktop vì nghiệp vụ table/form nhiều. Tuy nhiên vẫn phải usable trên tablet/small screen.

### 23.2 Sidebar behavior

Breakpoint nhỏ:

- Sidebar collapse hoặc drawer.
- Active navigation vẫn rõ.
- User không bị kẹt vì menu che nội dung.

### 23.3 Table behavior

Small screen:

- Horizontal scroll cho bảng nhiều cột.
- Card layout fallback nếu phù hợp.
- Giữ action quan trọng dễ truy cập.
- Không bóp cột đến mức không đọc được.

### 23.4 Filter behavior

Small screen:

- Filter stack vertical.
- Có drawer/collapsible filter nếu nhiều field.
- Reset/apply action rõ.

### 23.5 Form behavior

Form responsive:

- Desktop có thể dùng 2 columns nếu field ngắn.
- Mobile/small screen dùng 1 column.
- Submit action vẫn dễ tìm.
- Modal không vượt viewport.

---

## 24. Accessibility Rules

Admin phải đáp ứng accessibility cơ bản.

### 24.1 Keyboard

Keyboard navigation phải hoạt động cho:

- Navigation.
- Buttons.
- Inputs.
- Selects.
- Tabs.
- Modals.
- Row actions.
- Pagination.

### 24.2 Focus

Focus state phải rõ, không bị remove.

### 24.3 Text contrast

Text phải đủ contrast, đặc biệt trong:

- Dark sidebar.
- Disabled state.
- Badge.
- Error/warning.
- Table metadata.

### 24.4 Color is not enough

Không dùng màu là tín hiệu duy nhất.

Status cần text label. Error cần message. Required field cần dấu hoặc text.

### 24.5 Screen reader semantics

Khi implement:

- Icon-only button cần aria-label.
- Modal cần title/description semantics.
- Form error cần liên kết với field.
- Table header phải rõ.

---

## 25. Performance UX

### 25.1 Perceived performance

Admin nên cho cảm giác nhanh bằng:

- Skeleton đúng layout.
- Optimistic UI khi an toàn.
- Disable action khi submitting.
- Không block toàn màn nếu chỉ refetch một section.
- Giữ filter/table state khi quay lại nếu có thể.

### 25.2 Large data

Với dữ liệu lớn:

- Không render quá nhiều row cùng lúc nếu ảnh hưởng performance.
- Pagination hoặc virtualization nếu cần.
- Server-side search/filter/sort nếu data lớn.
- Không load image full-size trong table.

### 25.3 Media-heavy admin

Ảnh sản phẩm trong admin cần:

- Thumbnail optimized.
- Lazy loading nếu list dài.
- Fallback khi ảnh lỗi.
- Upload progress.

---

## 26. Copywriting for Admin

### 26.1 Tone

Admin copy phải:

- Ngắn.
- Rõ.
- Trực tiếp.
- Không marketing quá đà.
- Không đổ lỗi user.

### 26.2 Button labels

Button label nên dùng động từ rõ:

- `Create product`
- `Save changes`
- `Update status`
- `Export`
- `Reset filters`
- `Cancel`
- `Delete`

Không dùng label mơ hồ:

- `OK`
- `Submit`
- `Do it`
- `Proceed` nếu context không rõ.

### 26.3 Error messages

Error message phải nói được:

- Cái gì lỗi.
- Vì sao nếu biết.
- User làm gì tiếp.

### 26.4 Empty state copy

Empty state copy phải hữu ích, không sáo rỗng.

Tốt:

```text
No products match your filters.
Clear filters or search with another keyword.
```

Không tốt:

```text
Nothing here.
```

---

## 27. Admin Screen Checklist

Trước khi merge một admin screen, kiểm tra:

### Layout

- [ ] Page title rõ.
- [ ] Primary action rõ.
- [ ] Search/filter nằm đúng vị trí.
- [ ] Layout không lệch spacing.
- [ ] Responsive behavior có xử lý.

### Component

- [ ] Dùng component/style có sẵn.
- [ ] Không tạo one-off style nếu không document.
- [ ] Button hierarchy đúng.
- [ ] Status badge có text + color.
- [ ] Icon-only action có label/accessibility.

### Data state

- [ ] Loading state.
- [ ] Empty state.
- [ ] Error state.
- [ ] Permission denied state nếu relevant.
- [ ] Partial data state nếu relevant.
- [ ] Không render raw null/undefined.

### Form

- [ ] Labels visible.
- [ ] Required fields rõ.
- [ ] Validation gần field.
- [ ] Submit loading.
- [ ] Dangerous action có confirmation.

### Table

- [ ] Search/filter/sort/pagination nếu relevant.
- [ ] Row actions nhất quán.
- [ ] Bulk action có selected count và confirmation nếu nguy hiểm.
- [ ] Long text truncate hợp lý.
- [ ] Table usable trên smaller screens.

### Accessibility

- [ ] Focus visible.
- [ ] Keyboard navigation không vỡ.
- [ ] Contrast đủ đọc.
- [ ] Không dùng màu là tín hiệu duy nhất.
- [ ] Touch/click target đủ lớn.

---

## 28. Do / Don't

### Do

- Do giữ admin data-first.
- Do dùng BigBike Red cho primary action và active state có kiểm soát.
- Do dùng Exo làm UI font chính.
- Do thiết kế table/search/filter thật kỹ.
- Do có đủ loading/empty/error/success/permission states.
- Do giữ destructive action an toàn.
- Do dùng status text + color.
- Do chia form dài thành section.
- Do tối ưu admin cho desktop nhưng vẫn usable trên small screens.
- Do bám `DESIGN_SYSTEM.md` và `ADMIN_DESIGN_TOKENS.md`.

### Don't

- Don't biến admin thành landing page.
- Don't lạm dụng Bungee.
- Don't dùng red background toàn dashboard.
- Don't dùng ảnh biker làm nền table/form.
- Don't tạo random gradient.
- Don't copy template Vite/Next mặc định.
- Don't render blank screen khi data rỗng.
- Don't dùng placeholder thay label.
- Don't đặt delete action sát edit mà không guard.
- Don't invent business status trong UI doc.
- Don't hardcode token ngẫu nhiên.

---

## 29. Relationship With Other Docs

### `BRAND_GUIDELINES.md`

Nguồn chuẩn cho:

- Logo.
- Màu thương hiệu.
- Typeface.
- Brand mood.
- Asset usage.

Admin chỉ áp dụng brand ở mức đủ nhận diện, không copy toàn bộ marketing expression vào dashboard.

### `DESIGN_SYSTEM.md`

Nguồn chuẩn cho:

- Shared UI rules.
- Component behavior.
- State design.
- Accessibility.
- Responsive principles.

`ADMIN_DESIGN.md` chỉ mở rộng cho admin-specific UX.

### `ADMIN_DESIGN_TOKENS.md`

Nguồn chuẩn cho:

- Token implementation.
- Admin density.
- Admin color mapping.
- Spacing/radius/shadow values.
- Component token mapping.

File này không hardcode token chi tiết.

### `WEB_DESIGN.md`

Nguồn chuẩn cho public website UX. Không dùng web-specific hero/category/campaign layout để áp vào admin.

### `BUSINESS_RULES.md`

Nguồn chuẩn cho business behavior. Admin UI phải biểu diễn đúng business behavior, không tự phát minh rule.

### `API_CONTRACT.md`

Nguồn chuẩn cho API. Admin design không định nghĩa endpoint hoặc payload.

### `DATA_CONTRACT.md`

Nguồn chuẩn cho data model. Admin design không định nghĩa schema.

### `PERMISSION_MATRIX.md`

Nếu tồn tại, đây là nguồn chuẩn cho role/permission. Admin design chỉ mô tả cách thể hiện permission denied/disabled/hidden state.

---

## 30. AI Agent Rules

Khi AI agent sửa `bigbike-admin`:

1. Đọc `BRAND_GUIDELINES.md`.
2. Đọc `DESIGN_SYSTEM.md`.
3. Đọc `ADMIN_DESIGN.md`.
4. Đọc `ADMIN_DESIGN_TOKENS.md`.
5. Không tự tạo visual language mới.
6. Không dùng web marketing layout cho admin table/form.
7. Không hardcode màu/spacing/font nếu token đã có.
8. Không tạo component mới nếu component hiện có đáp ứng.
9. Không bỏ qua loading/empty/error/permission states.
10. Không invent business rules, API fields hoặc database columns.
11. Không dùng icon-only action nếu không có accessible label.
12. Không merge screen chưa xử lý destructive confirmation.

Admin BigBike phải nhanh, rõ, chắc, ít nhiễu. Nếu operator phải nhìn 5 giây mới biết nút chính ở đâu, UI đã thất bại trước khi backend kịp bị đổ lỗi.
