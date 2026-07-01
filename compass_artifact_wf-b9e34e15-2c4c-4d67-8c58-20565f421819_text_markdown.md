# Bộ tiêu chí UI/UX cho bigbike-admin: Khung audit cho Admin Dashboard / Back-Office nội bộ

## TL;DR
- **Admin dashboard cho nhân viên vận hành nội bộ phải tối ưu cho EFFICIENCY (tốc độ tác vụ lặp lại, mật độ thông tin cao, quyền lực cho power user), KHÔNG phải cho first-impression/learnability như website tiêu dùng** — Nielsen Norman Group khẳng định rõ "the usability requirements and tradeoffs for workplace app design are different from consumer apps" và "Efficiency is more valuable than gold for users of complex applications".
- Với bigbike-admin (14+ route, 21 module, data từ backend API thật không có mock fallback), bốn trụ cột quan trọng nhất là: (1) data table dày đặc + bulk actions + filter/sort/search nâng cao; (2) error prevention & recovery mạnh (confirm cho destructive action, inline validation, hiển thị lỗi backend rõ ràng); (3) consistency tuyệt đối giữa 21 module để nhân viên mới học nhanh; (4) permission-aware UI (ẩn control không có quyền).
- Bộ tiêu chí dưới đây được cấu trúc thành 8 nhóm chủ đề dạng checklist ứng dụng trực tiếp, dựa trên Nielsen Norman Group, Baymard Institute, và các design system enterprise (Carbon, Salesforce Lightning, Material).

## Key Findings

1. **Enterprise ≠ Consumer.** Người dùng nội bộ được đào tạo, dùng bắt buộc, dùng hàng ngày nhiều giờ, và phát triển expertise theo thời gian. NN/g ("Usability Metrics"): "Intranets, extranets, and weblications are similar to traditional software design and will hopefully have skilled users; studying experienced users is thus more important than working with the novice users who typically dominate public websites." Do đó thiết kế nên ưu tiên efficiency và giảm số click cho tác vụ lặp lại thay vì hand-holding.
2. **Efficiency là ưu tiên số 1.** NN/g ("10 Usability Heuristics Applied to Complex Applications"): "Efficiency is more valuable than gold for users of complex applications. Yet, all users… eventually reach an efficiency plateau where continued usage does not increase efficiency any more." NN/g ("8 Design Guidelines for Complex Applications"): người dùng "tend to plateau at mediocre performance… Many users will satisfice… This behavior adds up to an incredible chasm in productivity over time, as users spend years or even decades using the same system day-in and day-out in inefficient ways." Accelerators (keyboard shortcuts, bulk actions, saved views) là công cụ giúp power user vượt qua plateau này mà không cản trở người mới.
3. **Chi phí lỗi cao hơn.** Complex/enterprise apps "mitigate the risks of executing high-impact (or high-value) tasks, where high loss (e.g., revenue or even lives) is at stake" (NN/g). Vì bigbike-admin thao tác trực tiếp lên dữ liệu vận hành thật (đơn hàng, sản phẩm, khách hàng), error prevention và recovery phải được thiết kế nghiêm ngặt.
4. **Consistency giảm tải nhận thức xuyên suốt 21 module.** NN/g: "frequent users — not just new users learning the system — are confused by lack of consistency." Một pattern chung cho toàn bộ CRUD giúp nhân viên mới học một lần dùng được mọi nơi.
5. **Xử lý lỗi backend là điểm sống còn.** Vì hệ thống không có mock fallback, mọi lỗi API hiện thẳng lên UI — cần error state có ý nghĩa, không được dead-end như kiểu ví dụ NN/g phê phán: "Could not display data. Contact your system administrator" ("Contact your system administrator is not sufficient resolution guidance").

## Details

### Nhóm 1 — Nguyên tắc nền tảng: Enterprise/Back-office UX khác Consumer UX
Điểm khác biệt căn bản (áp dụng làm "triết lý" xuyên suốt audit):
- **Tối ưu cho repeat/expert user, không phải first-time visitor.** Chấp nhận learning curve dốc hơn nếu đổi lại năng suất dài hạn cao hơn (mô hình Excel/ServiceNow). NN/g Heuristic #7 (Flexibility & Efficiency): nếu chỉ tối ưu learnability, "repeat users will be slowed down because the system likely includes a lot more step-by-step handholding than a repeat user would need."
- **Mật độ thông tin cao là tính năng, không phải lỗi.** Khác website tiêu dùng ưa whitespace rộng; back-office cần thấy nhiều dữ liệu cùng lúc. Whitespace quá nhiều có thể làm giảm usability khi mật độ dữ liệu là mục đích chính.
- **Dùng bắt buộc + được đào tạo.** NN/g: "Many complex applications require user training, or at least are accompanied by robust documentation and help sites." Cho phép có documentation/help, tooltip, onboarding — nhưng không thay thế cho thiết kế nhất quán.
- **10 heuristics của Nielsen vẫn là khung nền** (visibility of system status; match system–real world; user control & freedom; consistency & standards; error prevention; recognition over recall; flexibility & efficiency; aesthetic & minimalist design; help users recognize/recover from errors; help & documentation).
- **Landing mặc định /admin/products hợp lý** cho một hệ thống catalog-centric; nên đảm bảo default view của mỗi module hữu ích ngay khi mở (defaults là phần thường bị xem nhẹ trong thiết kế table).

### Nhóm 2 — Task Efficiency (tác vụ lặp lại)
Checklist:
- **Bulk actions:** checkbox chọn nhiều dòng; thanh action theo ngữ cảnh (contextual toolbar) chỉ xuất hiện khi có dòng được chọn; hỗ trợ chọn-tất-cả và giữ selection qua phân trang; luôn có confirm/undo cho bulk destructive. Áp dụng cho products, orders, reviews, media.
- **Keyboard shortcuts / accelerators:** ưu tiên cho action tần suất cao (tạo mới, lưu, tìm kiếm, điều hướng giữa module). NN/g: accelerators nên được "designed for tasks that users perform frequently." Hiển thị shortcut cạnh label (right-aligned trong menu, hoặc trong tooltip). Cân nhắc command palette (Cmd/Ctrl+K) và phím "?" để mở bảng shortcut. Tránh xung đột với shortcut OS/browser.
- **Inline editing:** cho phép sửa cell trực tiếp trong table với ít friction (click → text cursor); confirm khi blur/Enter/nút Save; với dữ liệu high-stakes (giá, tồn kho) cân nhắc thêm friction (edit trong expandable row/side drawer để "leaves less room for error").
- **Form design nhập nhanh & chính xác:** label luôn hiện (không dùng placeholder thay label — "Placeholders in Form Fields Are Harmful", NN/g); proximity label–field; input mask/date picker để chống lỗi định dạng; smart defaults; giảm số field xuống mức tối thiểu cần thiết (NN/g: bỏ bớt field cải thiện tỷ lệ hoàn thành trong hầu hết trường hợp); tab-order hợp lý; nút chính (Save) vị trí nhất quán.
- **Giảm số click:** action thường ngày nên đạt 2–3 click. Theo UXPilot ("8 Enterprise UX Design Best Practices" — blog design agency, không phải NN/g): "Enterprise users often spend six to eight hours a day inside the same systems, so seemingly small inefficiencies can add up to major bottlenecks… Actions that might take eight to ten clicks… should be streamlined to two or three wherever possible."

### Nhóm 3 — Information Architecture & Data Table density
Checklist thiết kế data table lớn (áp dụng cho mọi list view: products, orders, customers…):
- **Alignment:** text canh trái; số định lượng (giá, số lượng, %) canh phải; dùng tabular/monospace figures cho số để dễ so sánh (tránh $1,111.11 trông "nhỏ hơn" $999.99); header canh theo cột; **không dùng center alignment**.
- **Row division:** ưu tiên line divider mảnh (1px, xám nhạt) thay vì zebra stripes (zebra gây xung đột với các state hover/selected/disabled — có thể tạo tới 5 mức xám gây rối).
- **Density toggle:** cung cấp 3 mức (condensed ~40px / regular ~48px / relaxed ~56px) để user tự chọn.
- **Column management:** freeze cột định danh bên trái + horizontal scroll; cho reorder/hide/resize/add-remove cột; luôn có "reset to default"; **lưu trạng thái (state preservation)** theo session/tài khoản.
- **Sticky header/footer + control panel** giữ context khi scroll; footer sticky cho totals/roll-ups.
- **Sorting:** chevron trên header; default sort hợp lý (mới nhất trên cùng, hoặc "cần xử lý nhất" — ví dụ đơn chờ xử lý, tồn kho thấp); chevron không được phá alignment của header.
- **Pagination:** với dataset lớn (backend thật) nên **server-side** sort/filter/pagination (client-side chỉ hợp lý dưới ~1.000 dòng); default 25 dòng/trang, cho chọn 10/25/50/100; luôn hiện tổng số kết quả. Dùng pagination (không infinite scroll) cho dữ liệu phân tích/tham chiếu.
- **Row details:** expandable row / quick-view sidebar / modal tùy độ phức tạp; row hover gợi ý clickable; search highlighting cho kết quả tìm kiếm.
- **Trạng thái (status) hiển thị bằng badge màu + text** (không chỉ dựa vào màu — lý do accessibility).
- **Progressive disclosure:** hiện KPI/cột quan trọng nhất trước, chi tiết theo yêu cầu; cân nhắc cấu trúc 3 lớp (tổng quan → chi tiết khi click → cấu hình khi cố ý). Lưu ý: với màn hình vận hành/monitoring nơi mật độ thông tin là mục đích, không ẩn quá nhiều.

### Nhóm 4 — Error Prevention & Recovery (đặc biệt quan trọng: không có mock fallback)
Checklist:
- **Confirmation dialog cho destructive/irreversible action** (xóa sản phẩm, xóa admin-user, xóa đơn…). NN/g: "Use a confirmation dialog before committing to actions with serious consequences… consider a confirmation dialog before actions that cannot be undone." Dialog phải: nêu cụ thể đối tượng và phạm vi (số lượng bị ảnh hưởng), nút xác nhận ghi rõ hành động ("Delete" thay vì "OK/Confirm").
- **Type-to-confirm cho action cực nguy hiểm** (ví dụ xóa toàn bộ danh mục — kiểu MailChimp yêu cầu gõ tên list trước khi xóa) — chỉ dùng cho trường hợp hiếm & nghiêm trọng, vì nếu lạm dụng sẽ thành thao tác tự động vô nghĩa.
- **Tách xa nút hủy diệt khỏi nút lành tính**; dùng tín hiệu thị giác dư thừa (màu đỏ + icon). NN/g ("Dangerous UX: Consequential Options Close to Benign Options"): "Confirmatory and destructive actions should be far apart from each other; use additional redundant visual signals to differentiate between them and avoid user errors. Preventing errors is better than helping users recover from them."
- **Undo bất cứ khi nào có thể** — tốt hơn cả confirm; giảm chi phí sai lầm (ví dụ Gmail "Undo" khi xóa email).
- **Đừng lạm dụng confirm** cho action thường (routine) → gây "banner blindness"/thao tác tự động. Cân nhắc "Don't ask again".
- **Inline/real-time validation:** NN/g: "Ideally, all validation should be inline; that is, as soon as the user has finished filling in a field, an indicator should appear nearby if the field contains an error." Validate on blur, báo lỗi ngay cạnh field, ngôn ngữ người-đọc-được nêu rõ cái gì sai + cách sửa; validation summary chỉ bổ trợ, không thay thế inline.
- **Xử lý lỗi backend API rõ ràng (điểm sống còn):**
  - Không dead-end: tránh "Could not display data. Contact your system administrator" — NN/g coi đây là hướng dẫn không đủ.
  - Phân loại theo HTTP status/loại lỗi: 400/422 (validation → map về field cụ thể), 401/403 (quyền → thông báo cần quyền gì, hoặc ẩn action), 404 (không tìm thấy), 5xx/network (lỗi hệ thống → cho "Try again", chỉ khi retry thực sự có thể thành công — "don't offer 'Try again' in cases where you can detect that the operation will fail").
  - Error state có: thông điệp người-đọc-được (không jargon), action khắc phục (retry/quay lại), và (nếu có) mã lỗi/trace id để hỗ trợ debug — nhưng không lộ thông tin nhạy cảm.
  - Dùng React error boundary để một khối lỗi không làm trắng màn hình toàn app.
  - **Phân biệt rõ empty state (không có dữ liệu) với error state (gọi API thất bại)** — hai thứ khác nhau, không được gộp.

### Nhóm 5 — Consistency & Learnability (21 module)
Checklist:
- **Một design system/component library dùng chung** cho tables, forms, filters, modals, buttons, badges (mô hình Carbon Design System, Salesforce Lightning Design System, Microsoft Fluent, Material) — mọi module products/orders/customers/… trông và hành xử giống nhau. Salesforce Lightning đặc biệt chuẩn hóa "data-heavy UI elements like tables, filters, charts, and bulk actions".
- **Pattern CRUD nhất quán:** list → detail → create/edit → delete theo cùng một cấu trúc và cùng vị trí action ở tất cả 21 module. Học một lần, dùng mọi nơi.
- **Ngôn ngữ nhất quán:** cùng một từ cho cùng một khái niệm (không lẫn lộn "Delete/Remove/Discard"); cùng convention cho label, empty/loading/error state. NN/g Heuristic #4: "Users should not have to wonder whether different words, situations, or actions mean the same thing."
- **External consistency (Jakob's Law):** dùng convention chuẩn ngành (icon kính lúp = search, bell = notifications, gear = settings, account góc phải trên) để tái sử dụng kiến thức sẵn có → phẳng đường học.
- **Navigation nhất quán:** nhóm 21 module theo 4 nhóm chức năng (Sản phẩm / Nội dung-marketing / Vận hành / Hệ thống) rõ ràng trong sidebar; breadcrumb; highlight route hiện tại.

### Nhóm 6 — Accessibility & Performance/Responsiveness (công cụ dùng hàng ngày)
Checklist:
- **Response time (Nielsen 0.1s / 1s / 10s — "Response Times: The 3 Important Limits", dựa trên Robert Miller 1968, vẫn là chuẩn hiện hành):** thao tác trực tiếp (sort cột, chọn dòng, inline edit) phản hồi <0,1s để cảm giác "directly manipulating objects"; điều hướng/áp filter <1s ("the limit for the user's flow of thought to stay uninterrupted"); tác vụ >1s phải có feedback (spinner/skeleton); >10s ("the limit for keeping the user's attention focused") cần progress bar + ước lượng thời gian + cho phép làm việc khác.
- **Loading states:** skeleton screen cho full-page/table load (giảm perceived wait, chỉ dùng cho full-page load, không dùng cho download/upload/convert → dùng progress bar); spinner cho action ngắn/blocking hoặc single module; progress bar cho >10s; **luôn phản hồi tức thì (~50ms) mọi click** để không bị hiểu là "treo".
- **Kỳ vọng khác consumer:** internal tool không bị áp lực first-load speed như trang consumer; nhưng interaction responsiveness trong-phiên lại quan trọng hơn vì user thao tác liên tục hàng giờ.
- **Accessibility (WCAG):** semantic HTML table; ARIA label cho table/header/action; keyboard navigation đầy đủ (không phụ thuộc hover — vì disabled button/tooltip permission cần accessible; bulk action không được chỉ dựa vào hover); screen reader thông báo loading/busy/lỗi (WCAG Notification of Loading/Busy); contrast đủ; **không truyền tải trạng thái chỉ bằng màu**.
- **Responsive:** desktop-first (đây là công cụ desktop nhiều giờ), nhưng đảm bảo dùng được trên tablet cho quản lý on-the-go; table lớn cần chiến lược horizontal scroll + freeze cột trên màn nhỏ.

### Nhóm 7 — Operational Efficiency (quy trình thực tế)
Checklist:
- **Permission-aware UI (RBAC):** mỗi route/action gắn permission. **Nguyên tắc: user không nên thấy tính năng họ không dùng được** — "users should never see features they can't use, every visible option should be actionable". Ẩn (hide) control/route không có quyền; với action bị chặn tạm thời trong ngữ cảnh (không phải thiếu quyền vĩnh viễn) thì disable + tooltip giải thích ("Bạn không có quyền cho hành động này").
- **Bảo mật ở backend là bắt buộc:** frontend RBAC chỉ lo UX, không lo security — "Always enforce RBAC rules on the backend — regardless of what the UI shows." Ẩn UI không thay cho kiểm tra server-side; log các nỗ lực truy cập trái phép.
- **Trạng thái loading/empty/error rõ ràng ở mọi module:** empty state có hướng dẫn/CTA (ví dụ "Chưa có sản phẩm — Thêm sản phẩm đầu tiên"); phân biệt với error state; skeleton loader và empty state nên cùng vị trí top để tránh "visual jump".
- **Saved views / filter đã lưu:** cho phép lưu bộ filter hay dùng, chia sẻ qua URL/permalink, filter chips hiển thị điều kiện đang áp, giữ selection qua phân trang; hiển thị số kết quả cạnh mỗi facet để tránh dẫn tới 0 kết quả.
- **Giảm thao tác:** quy trình thường ngày (duyệt đơn, đổi trạng thái, sửa giá/tồn) nên tối ưu xuống 2–3 bước.

### Nhóm 8 — Best practice theo loại module (admin thương mại điện tử)
**Catalog (products, categories, brands):**
- List có ảnh thumbnail, tên, SKU, giá, tồn kho, trạng thái (active/draft), danh mục/brand; filter đa điều kiện; bulk edit (đổi giá, đổi trạng thái, gán danh mục); inline edit giá/tồn.
- Form sản phẩm: nhiều field (mô tả, ảnh, biến thể như size găng tay/áo giáp/giày, thuộc tính bảo hộ) → dùng progressive disclosure/tabs/section; upload ảnh với preview; validation real-time.
- Quản lý quan hệ category–brand–product rõ ràng; tránh trùng lặp thông tin (không lặp tên cột trong từng cell).

**Order management (orders):**
- Order list với status workflow rõ ràng (badge màu): mới → xác nhận → đóng gói → giao → hoàn tất/hủy/hoàn tiền; default sort ưu tiên đơn cần xử lý.
- Order detail: thông tin khách, sản phẩm (ảnh + category + status), địa chỉ, thanh toán, lịch sử trạng thái; action đổi trạng thái nhanh; xử lý hoàn/hủy có confirm.
- Cập nhật trạng thái khi hoàn/hoàn tiền; hiển thị rõ đơn hoàn một phần.

**Content/media (content, media, menus, sliders, coupons, redirects):**
- Media library: grid/list, filter theo loại, bulk delete có confirm, preview; upload có progress + thông báo lỗi định dạng/size **trước khi** upload (error prevention).
- Coupons/redirects: form với validation (tránh trùng mã, sai định dạng URL), ngày hiệu lực dùng date picker.
- Menus/sliders: sắp xếp kéo-thả trực quan; preview trước khi publish.

**Admin-users & RBAC (admin-users, settings):**
- Giao diện quản lý role/permission rõ ràng (role → resource → action như read/create/update/delete); nguyên tắc least privilege; tránh "role explosion".
- Hiển thị UI theo role; audit trail cho hành động nhạy cảm; xóa/deactivate admin-user là destructive → cần confirm mạnh (cân nhắc type-to-confirm).
- Settings: nhóm logic, mô tả rõ tác động của mỗi cấu hình, confirm cho thay đổi có ảnh hưởng rộng.

## Recommendations
Triển khai theo 3 giai đoạn, kèm ngưỡng để biết khi nào chuyển bước:

**Giai đoạn 1 — Nền tảng & An toàn (làm ngay):**
1. Chuẩn hóa component library dùng chung (table, form, modal, button, badge, empty/loading/error state) để đảm bảo consistency trên 21 module.
2. Chuẩn hóa **error handling backend**: một component error state thống nhất, map lỗi theo HTTP status, không dead-end, phân biệt empty vs error, dùng error boundary. Đây là ưu tiên cao nhất vì không có mock fallback.
3. Confirm dialog cho mọi destructive action + inline validation cho mọi form.
4. Permission-aware UI: ẩn route/action không có quyền, enforce ở backend.
*Ngưỡng chuyển bước:* khi mọi module đã dùng chung 1 bộ component và không còn lỗi backend nào hiện dạng trắng-màn-hình/dead-end.

**Giai đoạn 2 — Efficiency cho power user:**
5. Bulk actions + server-side filter/sort/pagination cho các list lớn (products, orders, customers).
6. Density toggle, column management + state preservation, sticky header.
7. Saved views/filter + filter chips.
8. Inline editing cho field tần suất cao (giá, tồn kho, trạng thái đơn).
*Ngưỡng:* khi các tác vụ vận hành thường ngày đo được ≤3 click và list load <1s (server-side).

**Giai đoạn 3 — Tối ưu nâng cao:**
9. Keyboard shortcuts + command palette (Cmd/Ctrl+K) + bảng "?" shortcut.
10. Audit accessibility (WCAG) + keyboard navigation đầy đủ.
11. Tối ưu response time theo ngưỡng 0,1/1/10s; skeleton screens.
*Ngưỡng:* khi power user (nhân viên lâu năm) báo cáo giảm thời gian tác vụ và audit WCAG đạt mức AA.

**Cách dùng làm khung audit:** biến 8 nhóm trên thành checklist chấm điểm (đạt / chưa / không áp dụng) cho từng module trong 21 module; ưu tiên fix theo thứ tự Nhóm 4 (lỗi) → Nhóm 5 (consistency) → Nhóm 2 & 3 (efficiency/table) → còn lại.

## Caveats
- Phần lớn nghiên cứu định lượng về list/table (ví dụ Baymard Institute) đến từ **bối cảnh e-commerce tiêu dùng (consumer product list/checkout)** — Baymard mô tả cơ sở của họ là "25 rounds of qualitative usability testing with 4,400+ test participant/site sessions… 54 rounds of benchmarking the world's 327 leading e-commerce sites… 12 [quantitative] studies with a total of 20,240 participants". Đây là dữ liệu consumer, KHÔNG phải internal admin table — dùng như tham chiếu định hướng, không phải bằng chứng trực tiếp cho back-office.
- Nhiều nguồn về "SaaS dashboard best practices" thiên về **analytics/KPI dashboard** (biểu đồ, widget), khác với **operational/CRUD admin** của bigbike-admin (chủ yếu là bảng + form). Đã ưu tiên nguồn về data table, enterprise/complex application, và CRUD.
- Một số nguồn (blog design agency như UXPilot, Pencil & Paper; template vendor) mang tính marketing hoặc kinh nghiệm cá nhân; các khẳng định cốt lõi đã neo vào NN/g và design system uy tín (Carbon/Salesforce/Material).
- Con số response time 0,1/1/10s là nghiên cứu kinh điển của Nielsen/Miller (gốc 1968, phổ biến qua Usability Engineering 1993) nhưng vẫn được coi là chuẩn hiện hành.
- Bộ tiêu chí là khung tổng hợp từ best practice; nên validate bằng usability testing với chính nhân viên vận hành BigBike (nghiên cứu experienced users, đúng tinh thần enterprise UX của NN/g).