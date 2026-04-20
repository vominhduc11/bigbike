# DESIGN_SYSTEM.md

> Shared UI rulebook cho toàn bộ BigBike project.
>
> Áp dụng cho:
> - `bigbike-web`: public website / customer-facing website
> - `bigbike-admin`: internal admin dashboard
>
> File này định nghĩa nguyên tắc UI chung, component behavior, state design, accessibility và responsive rules. Không dùng file này để mô tả business rules, API contract, database schema hoặc page layout chi tiết.

---

## 1. Purpose

`DESIGN_SYSTEM.md` là tài liệu trung tâm cho các quy tắc UI dùng chung trong BigBike. Mục tiêu là giúp developer và AI agent triển khai giao diện nhất quán giữa public website và admin dashboard, không tạo ra mỗi màn hình một phong cách riêng như hội chợ template.

File này chịu trách nhiệm cho:

- Nguyên tắc visual và interaction chung.
- Cách áp dụng brand vào UI product.
- Quy tắc màu, typography, spacing, layout, grid.
- Hành vi component dùng lại.
- Form, table, trạng thái dữ liệu, loading, empty, error.
- Accessibility, responsive và adaptive behavior.
- Boundary giữa brand guideline, design system, app-specific design docs và token docs.

File này không cover:

- Logo rule chi tiết, asset inventory, brand history.
- Layout chi tiết từng page của web hoặc admin.
- Business rule như checkout, bảo hành, đổi trả, khuyến mãi.
- API endpoint, request/response, database schema.
- Implementation token cụ thể cho từng app.
- Code implementation.

Boundary:

- Brand source of truth: `docs/brand/BRAND_GUIDELINES.md`
- Shared UI rulebook: `docs/design/DESIGN_SYSTEM.md`
- Web-specific UX: `docs/design/WEB_DESIGN.md`
- Admin-specific UX: `docs/design/ADMIN_DESIGN.md`
- Web implementation tokens: `docs/tokens/WEB_DESIGN_TOKENS.md`
- Admin implementation tokens: `docs/tokens/ADMIN_DESIGN_TOKENS.md`

---

## 2. Design Principles

### 2.1 Bold

BigBike UI phải có cảm giác mạnh, rõ, dứt khoát. Visual không được nhạt, generic hoặc giống SaaS template mặc định.

Áp dụng bằng:

- Contrast rõ giữa nền, surface, text và CTA.
- Headline có lực nhưng không phá readability.
- Button/action rõ vai trò.
- Product image nổi bật.
- Layout có hierarchy mạnh.

### 2.2 Fast scanning

Người dùng phải scan nhanh được thông tin chính.

Với `bigbike-web`:

- Người mua phải thấy nhanh sản phẩm, giá, tình trạng hàng, khuyến mãi, CTA.
- Category và PDP phải giúp ra quyết định nhanh.

Với `bigbike-admin`:

- Operator phải thấy nhanh đơn hàng, trạng thái, cảnh báo, filter, action.
- Table, form, dashboard không được trang trí dư thừa.

### 2.3 Product-first

BigBike là commerce system. Product clarity quan trọng hơn decoration.

Ưu tiên:

- Ảnh sản phẩm rõ.
- Tên sản phẩm dễ đọc.
- Giá và sale state nổi bật.
- Variant, size, màu, tồn kho dễ hiểu.
- CTA mua hàng / xử lý nghiệp vụ dễ tìm.

### 2.4 Strong visual hierarchy

Mỗi màn hình phải trả lời được:

1. Người dùng đang ở đâu?
2. Nội dung quan trọng nhất là gì?
3. Hành động chính là gì?
4. Trạng thái hiện tại là gì?
5. Có lỗi hoặc cảnh báo nào không?

Không đặt mọi thứ cùng một trọng lượng thị giác.

### 2.5 Clear actions

Action phải rõ nghĩa, rõ priority và rõ hậu quả.

- Primary action: hành động chính của màn hình hoặc section.
- Secondary action: hành động phụ, không cạnh tranh với primary.
- Tertiary action: hành động nhẹ, thường dùng cho link/action phụ.
- Destructive action: phải phân biệt rõ và cần confirmation khi có rủi ro.
- Disabled/loading action: phải thể hiện đang không thể thao tác hoặc đang xử lý.

### 2.6 Consistent states

Mọi component và screen phải có state thiết kế sẵn:

- Loading
- Empty
- Error
- Success
- Disabled
- Updating/submitting
- Permission denied khi liên quan phân quyền

Không render raw `null`, `undefined`, empty array hoặc blank screen.

### 2.7 No decorative noise

BigBike có mood mạnh, sporty, biker, mechanical. Nhưng mạnh không có nghĩa là nhồi texture, gradient, icon, badge và animation vào mọi góc.

Không dùng decoration nếu nó không giúp:

- Nhận diện brand.
- Đọc nhanh hơn.
- Ra quyết định nhanh hơn.
- Hiểu trạng thái tốt hơn.
- Tăng conversion hoặc operational clarity.

---

## 3. Brand Application in UI

### 3.1 Brand mood

BigBike UI phải thể hiện:

- Bold
- Fast
- Sporty
- Mechanical
- Strong motorcycle / biker identity
- Commercially clear

Không được đi theo hướng:

- Cute
- Pastel
- Generic SaaS
- Random template UI
- Luxury fashion quá mềm
- Neon cyberpunk lạc mood

### 3.2 BigBike Red

BigBike Red `#F90606` là màu nhận diện chính. Trong UI, red dùng cho:

- Primary CTA.
- Price highlight.
- Sale / promotion badge.
- Active state quan trọng.
- Focus ring.
- Error/destructive khi phù hợp context.
- Key brand accent trong hero, campaign, product section.

Không dùng red như:

- Full-screen background mặc định.
- Màu nền cho toàn bộ admin dashboard.
- Màu cho mọi icon, mọi text, mọi border.
- Text dài trên nền tối nếu contrast/readability kém.

Red phải tạo điểm nhấn. Nếu mọi thứ đều đỏ, không còn thứ gì thật sự quan trọng nữa.

### 3.3 Black / Dark Gray

Black và dark gray là nền chính cho brand-facing surfaces.

Dùng cho:

- Website header.
- Hero section.
- Brand-heavy section.
- Product cards dark mode.
- Footer.
- Campaign block.

Admin có thể dùng dark identity ở sidebar/header, nhưng content area cần ưu tiên readability và data density. Không ép mọi bảng dữ liệu vào nền đen nếu làm giảm khả năng đọc.

### 3.4 Supporting colors

Supporting colors gồm:

- Orange `#F99D1C`
- Pink `#E1058C`
- Blue `#20C4F4`
- Green `#62BB46`

Dùng cho:

- Campaign accent.
- Status phụ.
- Chart/category distinction nếu token docs cho phép.
- Info/success/warning state.

Không dùng màu phụ để đổi logo hoặc cạnh tranh với red trong core brand UI.

### 3.5 Typography

- `Bungee`: dùng cho display/headline/campaign impact.
- `Exo`: dùng cho body, UI labels, table, forms, product description và admin.

Bungee phải dùng tiết chế. Không dùng Bungee cho paragraph, table, form labels hoặc body dài.

### 3.6 Logo

Logo usage chi tiết nằm ở `docs/brand/BRAND_GUIDELINES.md`.

Trong UI:

- Header/login/sidebar dùng logo đúng variant.
- Logo phải có clear space.
- Không stretch, không đổi màu tùy hứng.
- Không đặt logo lên nền quá rối.
- Không dùng logo như decoration lặp lại quá nhiều.

### 3.7 Icon style

Icon trong BigBike nên có cảm giác:

- Rõ, mạnh, dễ scan.
- Cùng stroke/fill weight.
- Không quá mảnh.
- Không cute/cartoon lệch brand.

Admin icon cần ưu tiên semantic clarity hơn decoration.

### 3.8 Imagery direction

Ảnh nên theo hướng:

- Motorcycle / biker lifestyle.
- Gear protection.
- Helmet, gloves, jacket, armor, intercom/accessory.
- Road, touring, garage, asphalt, mechanical texture.
- Product sharp, rõ chi tiết.

Không dùng ảnh sản phẩm mờ, crop lỗi, nền quá rối hoặc visual stock-photo vô hồn.

---

## 4. Color System

File này định nghĩa semantic usage. Giá trị token cụ thể thuộc về:

- `docs/tokens/WEB_DESIGN_TOKENS.md`
- `docs/tokens/ADMIN_DESIGN_TOKENS.md`

### 4.1 Primary action

Dùng cho hành động chính:

- Mua ngay
- Thêm vào giỏ
- Lưu thay đổi
- Tạo mới
- Xác nhận thao tác chính

Primary action nên dùng BigBike Red. Trên mỗi screen/section chỉ nên có một primary action nổi bật nhất.

### 4.2 Secondary action

Dùng cho hành động phụ:

- Xem chi tiết
- Quay lại
- Hủy nhẹ
- Lọc nâng cao
- Export khi không phải hành động chính

Secondary action thường dùng outline, neutral surface hoặc text emphasis vừa phải.

### 4.3 Background

Background phải hỗ trợ readability và hierarchy.

- Web: có thể dark-first, cinematic, brand-heavy.
- Admin: background cần ổn định, không gây mỏi mắt, không làm giảm khả năng đọc table/form.

### 4.4 Surface

Surface dùng cho card, panel, modal, table container, filter box.

Surface phải tách được khỏi background bằng:

- Border subtle.
- Elevation nhẹ.
- Màu nền lệch một cấp.
- Spacing rõ.

### 4.5 Border

Border dùng để phân tách nhẹ, không biến UI thành bảng kẻ ô dày đặc.

- Default border: subtle.
- Focus border: rõ, thường dùng brand red hoặc token focus.
- Error border: rõ và đi kèm message.
- Selected border: rõ hơn default nhưng không lấn CTA.

### 4.6 Text primary

Dùng cho nội dung chính:

- Heading.
- Product name.
- Table primary column.
- Form value chính.
- Important metadata.

Text primary phải đạt contrast tốt trên background.

### 4.7 Text secondary

Dùng cho mô tả, helper text, metadata phụ.

Không dùng secondary text cho thông tin quan trọng như giá, trạng thái đơn, lỗi form.

### 4.8 Muted text

Dùng cho:

- Placeholder.
- Metadata rất phụ.
- Disabled description.
- Empty state supporting copy.

Muted text không được thấp contrast đến mức gần như biến mất.

### 4.9 Success

Dùng cho:

- Hoàn tất.
- Còn hàng.
- Active/verified khi ngữ cảnh tích cực.
- Submit thành công.

Success state phải có text/icon đi kèm, không chỉ dùng màu xanh.

### 4.10 Warning

Dùng cho:

- Tồn kho thấp.
- Cảnh báo chưa nghiêm trọng.
- Chờ xử lý.
- Dữ liệu cần chú ý.

Warning không được trộn với error. Warning là cần chú ý, error là đã có vấn đề.

### 4.11 Error

Dùng cho:

- Validation lỗi.
- Request thất bại.
- Destructive warning.
- Không thể hoàn thành thao tác.

Error phải có message cụ thể và hành động tiếp theo nếu có thể.

### 4.12 Info

Dùng cho:

- Thông tin bổ sung.
- Guidance.
- System note.
- Preorder/backorder label nếu domain docs cho phép.

### 4.13 Promotion / campaign accent

Dùng cho:

- Sale campaign.
- Banner.
- Badge khuyến mãi.
- Seasonal highlights.

Promotion color phải hỗ trợ brand red, không thay thế brand red.

---

## 5. Typography System

### 5.1 Typeface roles

BigBike dùng 2 typeface chính:

- `Bungee`: display/headline/campaign.
- `Exo`: body/UI/admin/product text.

### 5.2 Bungee usage

Dùng Bungee cho:

- Hero heading.
- Campaign title.
- Brand-heavy display text.
- Large marketing labels.
- Short, high-impact copy.

Không dùng Bungee cho:

- Paragraph dài.
- Table.
- Form input.
- Small labels.
- Error message.
- Admin dense UI.

### 5.3 Exo usage

Dùng Exo cho:

- Body text.
- UI labels.
- Navigation.
- Product descriptions.
- Price detail.
- Form.
- Table.
- Admin dashboard.

Exo là default UI font cho phần lớn product interface.

### 5.4 Heading principles

Heading phải:

- Cho biết section/page đang nói về gì.
- Có hierarchy rõ giữa H1/H2/H3.
- Không quá dài nếu dùng display font.
- Có line-height phù hợp tiếng Việt.
- Không lạm dụng uppercase ở đoạn dài.

### 5.5 Body text principles

Body text phải:

- Dễ đọc trên mobile và desktop.
- Có line-height thoáng.
- Không dùng màu quá muted cho nội dung quan trọng.
- Không căn giữa đoạn dài.

### 5.6 Label / caption principles

Label và caption dùng để hỗ trợ scan, không để trang trí.

- Label form phải rõ và luôn hiện.
- Caption dùng cho metadata phụ.
- Helper text phải ngắn, trực tiếp.
- Không dùng placeholder thay label.

---

## 6. Spacing & Layout System

### 6.1 Base spacing

BigBike sử dụng spacing theo hệ 4px scale.

Tất cả spacing nên bám vào scale:

- 4px
- 8px
- 12px
- 16px
- 20px
- 24px
- 32px
- 40px
- 48px
- 64px
- 80px
- 96px

Không căn bằng số ngẫu nhiên như 13px, 27px, 43px trừ khi có lý do rất cụ thể.

### 6.2 Section spacing

Public web có thể dùng section spacing rộng để tạo nhịp marketing/product storytelling.

Admin dùng section spacing gọn hơn để ưu tiên data density.

Rule:

- Web hero/landing section: rộng, có breathing room.
- Web product/category section: thoáng nhưng không làm mất product density.
- Admin dashboard/card/form: compact, predictable.
- Admin table/filter: spacing đủ đọc nhưng không phung phí chiều cao.

### 6.3 Card spacing

Card phải có padding đủ để nội dung không dính mép.

- Product card: ưu tiên ảnh, tên, giá, CTA.
- Info card: heading, metric, helper text rõ ràng.
- Admin card: padding gọn, không gây loãng thông tin.

### 6.4 Form spacing

Form spacing phải giúp người dùng hiểu group field.

- Field cùng nhóm: gần nhau.
- Nhóm khác nhau: cách rõ.
- Error message: gần field lỗi.
- Submit action: nằm ở vị trí dễ đoán.

### 6.5 Dense admin spacing

Admin được phép dùng density cao hơn web, nhưng không được hy sinh readability.

Áp dụng dense spacing cho:

- Table rows.
- Filter bars.
- CRUD forms.
- Summary cards.

Không áp dụng dense spacing cho:

- Confirmation modal nguy hiểm.
- Long content/help text.
- Error recovery flow.

---

## 7. Grid & Page Structure

### 7.1 Shared layout principles

Tất cả app phải có:

- Container width nhất quán.
- Section rhythm dễ đoán.
- Alignment rõ.
- Responsive grid.
- Không clutter.
- Header/action area rõ.
- Content không trôi vô tổ chức.

### 7.2 Web page structure

`bigbike-web` ưu tiên:

- Marketing/product storytelling.
- Product/category grids.
- Hero + CTA sections.
- SEO/content-friendly layout.
- PDP conversion layout.
- Trust blocks.

Public web có thể dùng visual lớn, ảnh lifestyle, campaign banner và spacing rộng hơn admin.

### 7.3 Admin page structure

`bigbike-admin` ưu tiên:

- Sidebar/header/content shell.
- Tables.
- Filters.
- Search.
- CRUD screens.
- Detail pages.
- Operational actions.

Admin layout phải predictable. Operator không nên phải học lại giao diện ở từng module.

### 7.4 Responsive grids

Grid phải adapt theo breakpoint.

- Product grid: tăng/giảm số column theo viewport.
- Card grid: tránh card quá hẹp.
- Admin dashboard metrics: wrap hợp lý.
- Filters: collapse hoặc stack trên màn nhỏ.
- Tables: horizontal scroll hoặc card fallback nếu cần.

---

## 8. Shape, Border, Shadow

### 8.1 Radius

BigBike hợp shape mạnh, hiện đại, hơi mechanical. Không dùng bo góc quá mềm/cute.

Rule:

- Button/card/input có radius vừa phải.
- Badge có thể sắc hoặc pill nhẹ tùy context.
- Hero/campaign visual có thể dùng shape góc cạnh.
- Admin nên dùng radius nhất quán, không trang trí quá tay.

### 8.2 Border

Border dùng để tạo structure.

- Default border: subtle.
- Hover border: rõ hơn nhẹ.
- Focus border: rõ, accessible.
- Selected border: nhận biết được.
- Error border: đi kèm message.

Không dùng border quá dày cho toàn bộ layout.

### 8.3 Shadow / elevation

Web có thể dùng shadow/elevation mạnh hơn để tạo cảm giác thương mại và nổi bật product.

Admin nên dùng elevation nhẹ:

- Card surface tách nền.
- Modal nổi rõ.
- Dropdown dễ nhận biết.
- Sticky header/filter không che nội dung quá mạnh.

Không dùng shadow lung tung làm UI bẩn và mỏi mắt.

---

## 9. Component System

Tất cả component phải bám design system. Không tạo one-off component styles trừ khi có lý do rõ và được document.

### 9.1 Buttons

Button hierarchy:

#### Primary

Dùng cho hành động chính.

Examples:

- `Mua ngay`
- `Thêm vào giỏ`
- `Lưu thay đổi`
- `Tạo sản phẩm`
- `Xác nhận`

Rules:

- Nổi bật nhất trong context.
- Không đặt quá nhiều primary buttons cạnh nhau.
- Có hover, focus, active, disabled, loading states.

#### Secondary

Dùng cho hành động phụ.

Examples:

- `Xem chi tiết`
- `Quay lại`
- `Lọc`
- `Hủy`

Rules:

- Không cạnh tranh với primary.
- Dễ nhận biết là clickable.

#### Tertiary

Dùng cho action nhẹ.

Examples:

- Text link.
- Inline action.
- Table row action phụ.

Rules:

- Không dùng tertiary cho action nguy hiểm hoặc action chính.

#### Destructive

Dùng cho thao tác phá hủy hoặc rủi ro cao.

Examples:

- `Xóa`
- `Hủy đơn`
- `Vô hiệu hóa`

Rules:

- Phải rõ hậu quả.
- Cần confirmation nếu không thể undo.
- Không dùng cùng style với primary brand CTA nếu dễ nhầm.

#### Disabled / loading

Rules:

- Disabled phải có visual state rõ.
- Loading phải chặn double-submit.
- Loading label nên nói rõ thao tác đang xử lý, ví dụ `Đang lưu...`.

### 9.2 Inputs

Input phải có:

- Label rõ.
- Placeholder ngắn nếu cần.
- Helper text khi cần.
- Error state.
- Disabled state.
- Focus state.

Không dùng placeholder thay label.

### 9.3 Selects

Select phải:

- Hiển thị selected value rõ.
- Có empty/default state.
- Có disabled state.
- Có error state nếu required.
- Không dùng select quá dài nếu search/autocomplete phù hợp hơn.

### 9.4 Checkboxes / radios

Rules:

- Label clickable.
- State checked/unchecked/disabled rõ.
- Không chỉ dựa vào màu để thể hiện checked.
- Radio dùng cho lựa chọn đơn.
- Checkbox dùng cho nhiều lựa chọn hoặc boolean.

### 9.5 Cards

Card dùng để group nội dung.

Rules:

- Card có purpose rõ.
- Padding nhất quán.
- Không nhồi quá nhiều action.
- Hover state chỉ dùng nếu card clickable.
- Clickable card phải có focus state.

### 9.6 Product cards

Product card là component quan trọng của `bigbike-web`.

Bắt buộc thể hiện rõ:

- Product image.
- Product name.
- Price.
- Sale/discount nếu có.
- Stock/preorder/out-of-stock state nếu relevant.
- CTA hoặc link vào PDP.

Rules:

- Ảnh không bị crop mất sản phẩm chính.
- Giá không bị chìm.
- Badge không che nội dung quan trọng.
- Card phải usable trên mobile.

### 9.7 Badges

Badge dùng cho:

- Sale.
- New.
- Featured.
- Stock labels.
- Category labels.
- Admin tags.

Rules:

- Text ngắn.
- Màu có ý nghĩa.
- Không spam quá nhiều badge trên một item.

### 9.8 Status badges

Status badge đặc biệt quan trọng cho admin.

Rules:

- Phải dùng cả text và màu.
- Không dùng màu một mình.
- Status label phải consistent toàn hệ thống.
- Status nguy hiểm/cảnh báo phải dễ phân biệt.

### 9.9 Tabs

Tabs dùng để chuyển giữa nhóm nội dung cùng cấp.

Rules:

- Active tab rõ.
- Tab label ngắn.
- Không dùng tabs cho navigation sâu nhiều tầng.
- Mobile phải scroll/collapse hợp lý.

### 9.10 Modals / dialogs

Modal dùng cho:

- Confirmation.
- Focused form nhỏ.
- Critical decision.
- Preview/detail nhanh.

Rules:

- Title rõ.
- Body ngắn, nói đúng hậu quả.
- Primary/secondary action rõ.
- Close behavior rõ.
- Không dùng modal cho flow quá dài.
- Dangerous action phải nhấn mạnh rủi ro.

### 9.11 Toasts / snackbars

Toast dùng cho feedback ngắn:

- Save success.
- Add to cart success.
- Request failed.
- Background update.

Rules:

- Message ngắn.
- Có action retry nếu phù hợp.
- Error toast không thay thế field-level validation.
- Không spam nhiều toast liên tiếp.

### 9.12 Tables

Table dùng nhiều trong admin.

Rules:

- Header rõ.
- Column quan trọng đặt trước.
- Row action dễ tìm nhưng không gây rối.
- Numeric data căn hợp lý.
- Status dùng badge text + color.
- Có loading/empty/error state.
- Có pagination khi dữ liệu lớn.

### 9.13 Pagination

Pagination phải:

- Cho biết page hiện tại.
- Có next/previous.
- Có disabled state.
- Không reset filter/search vô lý khi đổi page.
- Với admin, cân nhắc page size selector nếu cần.

### 9.14 Empty states

Empty state phải nói rõ:

- Không có gì.
- Vì sao có thể xảy ra.
- Người dùng nên làm gì tiếp.

Examples:

- Chưa có sản phẩm.
- Không tìm thấy đơn hàng theo bộ lọc.
- Chưa có dữ liệu báo cáo.

Không render khoảng trắng trống không.

### 9.15 Loading skeletons

Skeleton dùng khi layout đã biết trước.

Rules:

- Skeleton phải gần layout thật.
- Không dùng spinner toàn trang nếu chỉ một section đang load.
- Admin table nên có row skeleton.
- Product grid nên có card skeleton.

### 9.16 Error states

Error state phải gồm:

- Message dễ hiểu.
- Lý do nếu biết.
- Retry action nếu có thể.
- Không expose raw technical stack/error cho user cuối.

---

## 10. Form Rules

### 10.1 Labels

Labels phải luôn visible. Placeholder không được thay label.

Tốt:

- Label: `Tên sản phẩm`
- Placeholder: `Nhập tên sản phẩm`

Không tốt:

- Chỉ có placeholder `Tên sản phẩm`

### 10.2 Required fields

Required fields phải rõ bằng:

- Dấu `*`.
- Helper text.
- Validation message khi thiếu.

Không chỉ dựa vào màu.

### 10.3 Validation

Validation message phải:

- Nằm gần field lỗi.
- Nói rõ lỗi.
- Gợi ý cách sửa nếu cần.
- Không dùng message chung chung như `Invalid input`.

### 10.4 Submit actions

Submit action phải hỗ trợ:

- Loading state.
- Disabled state khi invalid hoặc đang submit.
- Success feedback.
- Error feedback.
- Chống double-submit.

### 10.5 Dangerous actions

Dangerous actions cần confirmation.

Confirmation phải nói rõ:

- Hành động gì sẽ xảy ra.
- Dữ liệu nào bị ảnh hưởng.
- Có thể hoàn tác hay không.

### 10.6 Form states

Mỗi form cần handle:

- Initial state.
- Dirty state nếu cần.
- Disabled state.
- Error state.
- Success state.
- Loading/submitting state.

---

## 11. Table & Data Display Rules

Admin table phải support các behavior sau khi relevant:

- Search.
- Filter.
- Sort.
- Pagination.
- Row actions.
- Bulk actions.
- Loading state.
- Empty state.
- Error retry.

### 11.1 Search

Search phải có placeholder rõ và không làm mất filter hiện tại trừ khi intentional.

### 11.2 Filter

Filter phải:

- Có label rõ.
- Có cách reset.
- Hiển thị active filters nếu có nhiều filter.
- Không ẩn filter quan trọng quá sâu.

### 11.3 Sort

Sort phải:

- Cho biết column nào đang sort.
- Cho biết hướng sort.
- Không gây mất selection nếu có bulk action.

### 11.4 Row actions

Row action nên đặt nhất quán.

- Action phổ biến có thể hiển thị trực tiếp.
- Action ít dùng có thể nằm trong menu.
- Destructive action không được đặt quá gần action an toàn nếu dễ bấm nhầm.

### 11.5 Bulk actions

Bulk actions chỉ dùng khi thật sự relevant.

Rules:

- Selection state rõ.
- Count selected item rõ.
- Có clear selection.
- Dangerous bulk action cần confirmation.

### 11.6 Status display

Status phải dùng text + color.

Không được chỉ dùng dot màu hoặc background màu mà không có label.

### 11.7 Data fallback

Không render raw null/undefined.

Fallback nên dùng:

- `—` cho dữ liệu không có.
- Label cụ thể như `Chưa cập nhật` nếu giúp rõ hơn.
- Empty state riêng nếu cả collection trống.

---

## 12. State Design

Mọi screen/component phải thiết kế state rõ ràng.

### 12.1 Loading

Loading phải cho biết hệ thống đang xử lý.

- Use skeleton cho content layout.
- Use spinner nhỏ cho action-level loading.
- Avoid full-page blocking nếu chỉ một phần load.

### 12.2 Empty

Empty state phải có:

- Title ngắn.
- Description.
- Action tiếp theo nếu có.

### 12.3 Error

Error state phải có:

- Message rõ.
- Retry action nếu có thể.
- Không expose raw stack trace.

### 12.4 Success

Success state dùng cho:

- Submit thành công.
- Add to cart thành công.
- Update thành công.
- Create/delete thành công.

Feedback có thể là toast, inline message hoặc redirect state tùy context.

### 12.5 Disabled

Disabled state phải rõ và có lý do nếu không obvious.

### 12.6 Permission denied

Permission denied state cần:

- Nói rõ người dùng không có quyền.
- Không leak dữ liệu nhạy cảm.
- Gợi ý liên hệ admin nếu phù hợp.

### 12.7 Offline / network failure

Khi relevant, cần state cho:

- Mất mạng.
- Request timeout.
- Server unavailable.
- Retry.

### 12.8 Partial data

Nếu dữ liệu chỉ load được một phần:

- Không pretend là đầy đủ.
- Hiển thị warning hoặc inline notice.
- Cho phép retry phần lỗi nếu có thể.

### 12.9 Updating / submitting

Khi update/submit:

- Disable action gây conflict.
- Hiển thị loading tại đúng nơi.
- Không reset input chưa cần thiết.
- Không cho double-submit.

---

## 13. Motion & Interaction

Motion trong BigBike phải nhanh, subtle, purposeful.

Dùng motion cho:

- Hover state.
- Press feedback.
- Modal transition.
- Toast/snackbar.
- Loading skeleton.
- Add-to-cart feedback.
- Product card hover.
- Dropdown open/close.

Không dùng:

- Animation dài.
- Bouncy/cute animation.
- Decoration không phục vụ UX.
- Parallax nặng ảnh hưởng performance.
- Motion gây khó chịu khi người dùng bật reduced motion.

Rules:

- Interaction feedback phải dưới mức gây chậm thao tác.
- Admin motion càng ít càng tốt.
- Web hero/campaign có thể giàu motion hơn nhưng không phá performance hoặc accessibility.
- Respect `prefers-reduced-motion`.

---

## 14. Accessibility

Accessibility là requirement, không phải phần trang trí để thêm vào cuối sprint.

### 14.1 Contrast

Text phải đủ contrast trên nền.

- Không dùng red text nhỏ trên nền tối nếu khó đọc.
- Muted text không được quá mờ.
- Error/success/warning phải readable.

### 14.2 Focus state

Interactive elements phải có focus visible:

- Button.
- Link.
- Input.
- Select.
- Checkbox/radio.
- Tabs.
- Menu item.
- Table row action.

### 14.3 Icons and meaning

Icon không được là nguồn ý nghĩa duy nhất.

- Status cần text label.
- Icon button cần accessible label.
- Error cần message.

### 14.4 Forms

Form error phải:

- Gần field.
- Readable.
- Không chỉ dựa vào màu.
- Có aria relationship nếu implement.

### 14.5 Touch target

Mobile touch target phải đủ lớn, đặc biệt:

- Add to cart.
- Quantity selector.
- Menu.
- Filter.
- Checkbox/radio.

### 14.6 Keyboard navigation

Keyboard navigation phải hoạt động cho interactive elements.

Không tạo custom component phá keyboard behavior mặc định mà không implement lại accessibility.

---

## 15. Responsive & Adaptive Rules

### 15.1 Public web

`bigbike-web` phải mobile-first và SEO/content-friendly.

Rules:

- Content không bị ẩn vô lý trên mobile.
- Product grid adapt theo viewport.
- CTA quan trọng dễ bấm.
- Header/navigation chuyển sang mobile menu rõ.
- Hero không làm LCP tệ.
- Category/PDP vẫn dễ mua trên mobile.

### 15.2 Admin

`bigbike-admin` desktop-first nhưng vẫn phải usable trên smaller screens.

Rules:

- Sidebar có thể collapse.
- Header action wrap hợp lý.
- Tables dùng horizontal scroll hoặc card fallback.
- Filter stack lại trên màn nhỏ.
- Modal không vượt viewport.
- Forms có layout responsive.

### 15.3 Product grids

Product grid cần adapt:

- Mobile: ít columns, ưu tiên readable card.
- Tablet: tăng density vừa phải.
- Desktop: nhiều columns hơn nhưng card không quá nhỏ.

### 15.4 Tables on small screens

Table small-screen strategy:

- Horizontal scroll cho bảng nhiều cột.
- Card fallback nếu dữ liệu dạng record phù hợp.
- Sticky important column/action nếu cần.
- Không bóp chữ đến mức không đọc được.

### 15.5 Navigation

Navigation phải adapt:

- Web desktop: header nav rõ.
- Web mobile: menu rõ, CTA không biến mất.
- Admin desktop: sidebar/header predictable.
- Admin small screen: collapsed sidebar/drawer.

---

## 16. Image, Icon, and Asset Usage

### 16.1 Product imagery

Product imagery phải:

- Rõ sản phẩm.
- Đúng tỷ lệ.
- Không crop mất phần chính.
- Nền không cạnh tranh với sản phẩm.
- Tối ưu loading/performance.

### 16.2 Motorcycle / biker visual mood

Visual mood nên có:

- Biker lifestyle.
- Motorcycle gear.
- Speed/motion cảm giác vừa phải.
- Asphalt/garage/road/touring context.
- Mechanical texture.

Không dùng hình ảnh generic corporate hoặc lifestyle lạc ngành.

### 16.3 Icon consistency

Rules:

- Không mix nhiều icon set lệch style.
- Icon trong cùng context phải cùng weight.
- Icon màu phải theo semantic/brand token.
- Icon button cần label/accessibility.

### 16.4 Logo usage

Logo và asset rule chi tiết nằm trong `docs/brand/BRAND_GUIDELINES.md`.

File này không embed asset inventory. Asset inventory không thuộc design system.

---

## 17. Do / Don't

### Do

- Do dùng BigBike Red nhất quán cho primary CTA và brand accent.
- Do ưu tiên product clarity trên website.
- Do giữ admin data readable, scan nhanh, ít noise.
- Do thiết kế đủ loading, empty, error, success, disabled states.
- Do dùng Bungee tiết chế cho headline/campaign.
- Do dùng Exo cho UI text, body, forms, tables.
- Do dùng status bằng cả text và color.
- Do giữ spacing theo 4px scale.
- Do dùng component có thể tái sử dụng.
- Do kiểm tra mobile/responsive trước khi merge.

### Don't

- Don't overuse red backgrounds.
- Don't mix unrelated fonts.
- Don't dùng Vite/Next template visuals mặc định.
- Don't tạo random gradients không có trong brand direction.
- Don't hide important actions behind unclear icons.
- Don't render blank state khi data rỗng.
- Don't dùng placeholder thay label.
- Don't dùng màu là tín hiệu duy nhất cho status.
- Don't tạo one-off style nếu component hiện có đáp ứng.
- Don't biến admin dashboard thành landing page quảng cáo.

---

## 18. Relationship With Other Docs

### `docs/brand/BRAND_GUIDELINES.md`

Chịu trách nhiệm cho:

- Brand identity.
- Logo rules.
- Typeface meaning.
- Color meaning.
- Visual mood.
- Asset usage source of truth.

Không dùng brand guideline để thay thế component/system rules.

### `docs/design/DESIGN_SYSTEM.md`

Chịu trách nhiệm cho:

- Shared UI rules.
- Component behavior.
- State design.
- Accessibility.
- Responsive principles.
- App-agnostic visual system.

Không mô tả layout chi tiết từng page.

### `docs/design/WEB_DESIGN.md`

Chịu trách nhiệm cho:

- Public website UX.
- Homepage/category/PDP/cart/content direction.
- SEO/content presentation.
- Marketing/product storytelling.

Không định nghĩa lại toàn bộ design system.

### `docs/design/ADMIN_DESIGN.md`

Chịu trách nhiệm cho:

- Admin dashboard UX.
- Operations flow.
- CRUD screen behavior.
- Table/filter/detail page patterns.

Không định nghĩa lại brand identity.

### `docs/tokens/WEB_DESIGN_TOKENS.md`

Chịu trách nhiệm cho:

- Token implementation cho `bigbike-web`.
- Web-specific CSS/design values.
- Web component token mapping.

Không chứa business rules.

### `docs/tokens/ADMIN_DESIGN_TOKENS.md`

Chịu trách nhiệm cho:

- Token implementation cho `bigbike-admin`.
- Admin-specific UI density, table, form, shell values.
- Admin semantic token mapping.

Không mô tả backend/API.

### `BUSINESS_RULES.md`

Chịu trách nhiệm cho business behavior.

Design system chỉ thể hiện business state bằng UI pattern, không phát minh business state mới.

### `API_CONTRACT.md`

Chịu trách nhiệm cho backend/API contract.

Design system không định nghĩa endpoint, payload hoặc authentication behavior.

### `DATA_CONTRACT.md`

Chịu trách nhiệm cho data model contract.

Design system không định nghĩa schema.

---

## Final Rule for AI Agents

Khi triển khai UI cho BigBike:

1. Đọc `BRAND_GUIDELINES.md` để hiểu brand.
2. Đọc `DESIGN_SYSTEM.md` để hiểu shared UI rules.
3. Đọc `WEB_DESIGN.md` hoặc `ADMIN_DESIGN.md` tùy app đang sửa.
4. Đọc token doc tương ứng trước khi viết style.
5. Không hardcode style ngẫu nhiên.
6. Không tạo component mới nếu component hiện có đủ dùng.
7. Không bỏ qua state design.
8. Không đưa backend/API/database logic vào UI docs.

BigBike UI phải nhìn mạnh, nhanh, rõ sản phẩm, rõ hành động và rõ trạng thái. Nếu một màn hình trông như template starter project chưa xóa logo mặc định, nó chưa đạt chuẩn BigBike.
