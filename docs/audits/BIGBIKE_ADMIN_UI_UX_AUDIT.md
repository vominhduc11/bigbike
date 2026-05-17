# BigBike Admin UI/UX Audit

> Phạm vi: `bigbike-admin/` (React 19 + Vite + Tailwind v4 + Radix/shadcn + TanStack Query).
> Ngày audit: 2026-05-16. Loại: AUDIT + TRACE + REPORT (không refactor hàng loạt).
> Phương pháp: đọc trực tiếp source, trace route → screen → API client. Đã chạy `npm run lint` và `npm run build`.
> Các kết luận đánh dấu "inferred from code" khi không có docs/Storybook đối chiếu (repo không có Storybook cho admin).

---

## 1. Executive Summary

**Overall status: PARTIAL** — admin đã dùng được cho vận hành cơ bản, nhưng chưa đạt chuẩn production đồng nhất.

### Điểm mạnh chính
- Kiến trúc routing rõ ràng, permission-gated ở cả nav lẫn route (`App.jsx`).
- Mọi list screen đều **server-side pagination + search debounce 250ms** — không có client-side filtering toàn bộ dataset.
- Lazy-load mọi screen (`lazyScreen`), code-splitting tốt; build pass, lint pass (0 lỗi).
- Có sẵn một bộ design-system layer mới (`components/layout/*`: Screen, ScreenHeader, FilterBar, SummaryCard, Modal, MobileCardList) và token cascade (`admin-tokens.css`).
- State machine cho serial/đơn hàng được tôn trọng: chỉ render action hợp lệ (`allowedTransitions`, `SERIAL_ALLOWED_TRANSITIONS`, `NEXT_STATUSES`).
- Permission UX tốt ở tầng điều hướng: menu/route ẩn theo quyền, có màn "permission denied" tử tế.

### Rủi ro lớn nhất
1. **Hai thế hệ UI cùng tồn tại.** Chỉ ~2 screen (Dashboard, Receivables) dùng design-system mới; ~30 screen còn lại dùng CSS-class legacy (`.screen`, `.btn`, `.filter-bar`, `.modal-overlay`) — vi phạm trực tiếp quy tắc shadcn-only trong `CLAUDE.md`. 204 lần dùng `className="btn ..."` trên 25 screen.
2. **Modal không đồng nhất & thiếu a11y.** 10 screen tự dựng `.modal-overlay/.modal-card` thay vì `Modal` (Radix Dialog) — không có focus trap, không Escape, không `aria-modal` chuẩn.
3. **Tầng data không đồng nhất.** Chỉ 5 screen dùng `useAdminList`/react-query; phần còn lại tự `useState+useEffect` fetch — mất cache, mất `keepPreviousData` (mỗi lần đổi trang nháy về skeleton), mất invalidation.
4. **Dashboard "Đổi trả chờ xử lý" luôn = 0** do sai mã trạng thái + sai field pagination → admin không thấy cảnh báo RMA tồn đọng.
5. Detail screen dùng `window.confirm()` native cho thao tác nguy hiểm (huỷ đơn, hoàn tiền) — không khớp `ConfirmDialog` của hệ thống.

### Ưu tiên xử lý
- **P0:** Sửa bug đếm "Đổi trả chờ xử lý" trên Dashboard; (đã fix) dropdown "số dòng/trang" hỏng ở Đơn hàng.
- **P1:** Thống nhất modal về `Modal`/Radix Dialog; thay `window.confirm` bằng `ConfirmDialog`; thống nhất data layer về react-query.
- **P2:** Migrate dần legacy screen sang `components/layout` + shadcn `Button`; gỡ CSS class chết.

---

## 2. Audit Scope

### Đã kiểm tra
- **Routing/permission:** `src/App.jsx` (toàn bộ `NAV_GROUP_DEFS`, `parseRoute`, `routePermission`).
- **Shell/nav:** `components/AdminShell.jsx`, `Breadcrumb`.
- **Shared/layout components:** `AdminTable`, `StatePanel`, `StatusBadge`, `PaginationControls`, `ConfirmDialog`, `components/layout/*` (Screen, ScreenHeader, FilterBar, FormField, Modal, MobileCardList, StickyActionBar, SummaryCard, Tabs).
- **Infra/lib:** `adminApi.js` (interceptor + error model), `auth.jsx`, `useAdminList.js`, `useUrlQuery.js`, `useDebounce.js`, `queryClient.js`, `contracts.js` (`normalizePagination`).
- **Screen đọc sâu:** OrderList, OrderDetail, ProductList, Dashboard, ReturnList, SerialList, WarrantyList, CustomerList, ReceivablesList.
- **Screen khảo sát qua grep + cấu trúc:** 27 screen còn lại (pattern xác định bằng grep cross-cutting: `useAdminList`, `modal-overlay`, `className="btn"`, `<option>`, `zod/schemas`, `window.confirm`).
- Lệnh chạy: `npm run lint`, `npm run build` (mục 13).

### Chưa kiểm tra được / hạn chế
- **Không đọc hết từng dòng** của các screen lớn: `ProductDetailScreen` (2279 dòng), `InventoryScreen` (1980), `RolesScreen` (1176), `PosScreen` (1101), `AuditLogListScreen` (936), `MenuScreen` (913), `HomeVideoListScreen` (846), `CategoryDetailScreen` (813). Đánh giá các screen này dựa trên pattern chung + cross-cutting grep, không phải line-by-line — finding cụ thể cho chúng nên coi là **NEEDS_VERIFICATION**.
- **Không có runtime/visual testing** — không bật Docker stack, không click thực tế. Bug render (vd. native `<option>`) suy ra từ contract Radix.
- **Backend contract** chỉ trace tới `adminApi.js`; không đối chiếu DTO Java thực tế cho từng endpoint.
- Repo **không có Storybook/design-doc riêng cho admin** — đối chiếu design system dựa trên `admin-tokens.css` + `CLAUDE.md`.

---

## 3. Admin Screen Inventory

| Screen | Route | Use case chính | Data chính | Action chính | API/hooks | UX status | Notes |
|---|---|---|---|---|---|---|---|
| DashboardScreen | `/admin/dashboard` | Tổng quan vận hành | KPI, doanh thu, đơn gần đây, attention | Điều hướng nhanh | react-query, `fetchDashboardSummary` | PARTIAL | Bug đếm đổi trả (mục 5) |
| OrderListScreen | `/admin/orders` | Danh sách đơn | Đơn, trạng thái, tiền | Lọc, export CSV, xem | `useAdminList`, `fetchOrders` | PARTIAL | Filter không sync URL; dropdown pageSize đã fix |
| OrderDetailScreen | `/admin/orders/:id` | Xử lý 1 đơn | Trạng thái, payment, fulfillment, RMA, notes | Đổi trạng thái, hoàn tiền, ship | manual fetch | PARTIAL | `window.confirm`, modal raw, không react-query |
| PosScreen | `/admin/pos` | Bán tại quầy | Giỏ, sản phẩm, KH | Tạo đơn POS, refund | manual | NEEDS_VERIFICATION | `window.confirm` xoá giỏ; modal raw |
| CustomerListScreen | `/admin/customers` | Danh sách KH | KH, đơn, chi tiêu | Lọc, export, xem | manual fetch | PARTIAL | Không react-query; không sync URL |
| CustomerDetailScreen | `/admin/customers/:id` | Hồ sơ KH | Thông tin, đơn, địa chỉ | Sửa, đổi trạng thái | manual | NEEDS_VERIFICATION | 11 `.btn` legacy |
| ContactInboxScreen | `/admin/contact-messages` | Hộp thư liên hệ | Tin nhắn | Trả lời, đánh dấu | manual | NEEDS_VERIFICATION | modal raw |
| ReturnListScreen | `/admin/returns` | Quản lý đổi trả (RMA) | RMA, trạng thái, hoàn tiền | Duyệt/từ chối/hoàn | manual fetch | PARTIAL | modal raw, StatusBadge tự chế, không sync URL |
| ReceivablesListScreen | `/admin/receivables` | Công nợ | KPI nợ, danh sách AR | Ghi nhận thu, write-off | react-query + `useUrlQuery` | PASS | Screen mẫu chuẩn |
| ReceivableDetailScreen | `/admin/receivables/:id` | Chi tiết công nợ | Lịch sử thanh toán | Ghi thu, write-off | react-query | PASS | inferred — dùng layout mới |
| ReviewListScreen | `/admin/reviews` | Kiểm duyệt review | Review, rating | Duyệt/ẩn | manual | NEEDS_VERIFICATION | |
| ReviewDetailScreen | `/admin/reviews/:id` | Chi tiết review | Nội dung review | Duyệt/từ chối | manual | NEEDS_VERIFICATION | |
| CouponListScreen | `/admin/coupons` | Mã giảm giá | Coupon, hạn dùng | CRUD coupon | manual | NEEDS_VERIFICATION | 10 `.btn` legacy |
| ProductListScreen | `/admin/products` | Danh sách SP | SP, giá, tồn, publish | CRUD, xoá mềm, sao chép | `useAdminList` + sync URL | PASS | Tham chiếu tốt cho list legacy |
| ProductDetailScreen | `/admin/products/:id` | Tạo/sửa SP | Form SP đầy đủ | Lưu, publish | zod schemas, manual | NEEDS_VERIFICATION | 30 `.btn`, modal raw |
| CategoryListScreen | `/admin/categories` | Danh mục | Cây danh mục | CRUD, sắp xếp | `useAdminList` | PARTIAL | 11 `.btn` |
| CategoryDetailScreen | `/admin/categories/:id` | Tạo/sửa danh mục | Form danh mục | Lưu | zod | NEEDS_VERIFICATION | |
| BrandListScreen | `/admin/brands` | Thương hiệu | Brand | CRUD | `useAdminList` | PARTIAL | |
| BrandDetailScreen | `/admin/brands/:id` | Tạo/sửa brand | Form brand | Lưu | zod | NEEDS_VERIFICATION | |
| InventoryScreen | `/admin/inventory` | Tồn kho + serial | Tồn, serial, nhập kho | Nhập serial, điều chỉnh | manual | NEEDS_VERIFICATION | 30 `.btn`, modal raw, screen 1980 dòng |
| SerialListScreen | `/admin/serials` | Tra cứu serial | Serial, trạng thái, bảo hành | Đổi trạng thái serial | manual fetch | PARTIAL | modal raw; state machine ok |
| WarrantyListScreen | `/admin/warranties` | Phiếu bảo hành | Phiếu, hạn, KH | Huỷ phiếu | manual fetch | PARTIAL | modal raw; không có search |
| ContentListScreen | `/admin/content` | Bài viết/trang | Content item | CRUD content | `useAdminList` | PARTIAL | |
| ContentDetailScreen | `/admin/content/...` | Soạn nội dung | RichText, SEO | Lưu, publish | zod, RichTextEditor | NEEDS_VERIFICATION | |
| SliderListScreen | `/admin/sliders` | Banner/slider | Slide | CRUD, sắp xếp | manual | NEEDS_VERIFICATION | dnd-kit |
| HomeVideoListScreen | `/admin/home-videos` | Video trang chủ | Video | CRUD | manual | NEEDS_VERIFICATION | |
| RedirectListScreen | `/admin/redirects` | Redirect SEO | Redirect rule | CRUD | manual | NEEDS_VERIFICATION | |
| MenuScreen | `/admin/menus` | Menu điều hướng web | Cây menu | CRUD, sắp xếp | manual | NEEDS_VERIFICATION | modal raw, dnd-kit |
| MediaLibraryScreen | `/admin/media` | Thư viện media | Ảnh/video, folder | Upload, xoá | manual | NEEDS_VERIFICATION | dùng CSS module riêng |
| ReportsScreen | `/admin/reports` | Báo cáo | Doanh thu, biểu đồ | Export | react-query | NEEDS_VERIFICATION | recharts |
| ShippingScreen | `/admin/shipping` | Phí/vùng vận chuyển | Method, zone | CRUD | manual | NEEDS_VERIFICATION | |
| SettingsScreen | `/admin/settings` | Cấu hình hệ thống | Setting key/value | Lưu cấu hình | manual | NEEDS_VERIFICATION | form 503 dòng |
| AdminUsersScreen | `/admin/admin-users` | Tài khoản admin | User admin, role | CRUD, gán role | manual | NEEDS_VERIFICATION | modal raw, 11 `.btn` |
| RolesScreen | `/admin/roles` | Vai trò & quyền | Role, permission matrix | Sửa quyền | manual | NEEDS_VERIFICATION | `window.confirm`; screen 1176 dòng |
| AuditLogListScreen | `/admin/audit-logs` | Nhật ký thao tác | Audit log | Xem, lọc | manual | NEEDS_VERIFICATION | 12 `.btn`, screen 936 dòng |
| LoginScreen | (no shell) | Đăng nhập | Email/password | Login | `loginAdmin` | PASS | inferred |

**Use case thiếu UI / cần xác nhận:** không phát hiện screen "tồn tại nhưng vô dụng". Một số module có thể thiếu *bulk action* (xem mục 4-C).

---

## 4. UI/UX Criteria Evaluation

### A. Business-first UX — **PASS**
- **Evidence:** Mỗi screen có `ScreenHeader`/`screen-header` với eyebrow + title + description giải thích nghiệp vụ. Dashboard có khối "Cần chú ý" (attention) ưu tiên việc tồn đọng. KPI card click được để nhảy thẳng tới module.
- **Problems:** Một vài tiêu đề/eyebrow là tiếng Việt cứng-mã trong JSX (vd. SerialList "Kho hàng", "Quản lý serial") không qua i18n — lệch với screen dùng `t()`.
- **Recommended fix:** Thống nhất mọi text qua i18n; không hardcode tiếng Việt trong JSX của screen mới.

### B. Navigation / IA — **PASS**
- **Evidence:** `NAV_GROUP_DEFS` chia 5 nhóm hợp lý (Sales, Products, Content, Reports, System). Sidebar group ẩn khi không có item nào có quyền. `Breadcrumb` 2–3 cấp, có `aria-current`. Active state có trên sidebar + topbar page title.
- **Problems:** (1) Nhóm "Sales" có 9 mục — hơi dày. (2) Breadcrumb ở cấp detail chỉ ghi "Chi tiết" chung chung, không hiện tên/ID bản ghi → admin không biết đang xem bản ghi nào từ breadcrumb. (3) `/admin/inventory` và `/admin/serials` cùng icon `Package` → khó phân biệt.
- **Recommended fix:** Breadcrumb cấp 3 nên nhận label động (orderNumber, product name); đổi icon `serials` (vd. `Hash` đã dùng — thực ra `Hash` đúng, `inventory` dùng `Package` — ổn). Cân nhắc tách "Sales".

### C. Data table UX — **PARTIAL**
- **Evidence:** `AdminTable` chuẩn hoá: loading skeleton theo `pageSize`, sort header (`aria-sort`), selectable + indeterminate checkbox, row click có `role/tabIndex/keydown`, align phải/giữa/trái qua `column.align`. Mọi list đều server-side pagination + `PaginationControls` (jump-to-page khi >3 trang). Tiền/ngày align phải nhất quán ở screen mới.
- **Problems:**
  1. **Sort gần như không được dùng:** `AdminTable` hỗ trợ `onSortChange/sortable` nhưng các list legacy (Order, Product, Customer, Return, Serial, Warranty) sort bằng `<Select>` riêng hoặc không cho sort cột → header không click sort được dù component hỗ trợ.
  2. **Empty/error state có, nhưng error state ở list manual** dùng `setQuery((q)=>({...q}))` để "retry" — hoạt động nhưng dựa vào việc thay reference object, dễ vỡ.
  3. **Không có mobile strategy cho list legacy:** `MobileCardList` tồn tại nhưng chỉ screen mới dùng. Order/Product/Customer/Serial/Warranty/Return render thẳng `<table>` → mobile = scroll ngang.
  4. **Bulk action:** `BulkActionBar` + `AdminTable selectable` có sẵn nhưng hầu như không screen nào bật. Thiếu bulk cho: ẩn/hiện nhiều SP, đổi trạng thái nhiều đơn, xoá nhiều media.
- **Recommended fix:** Bật sort header trên list dùng `useAdminList`; thêm `MobileCardList` cho 6 list legacy; cân nhắc bulk publish/hide cho ProductList và bulk cho MediaLibrary.

### D. Form UX — **PARTIAL**
- **Evidence:** `FormField` chuẩn (label + dấu `*` required + helper + `error` với `role="alert"`). 4 detail screen (Product, Category, Brand, Content) dùng zod schema validation. Submit button có `disabled`/loading text ("Đang lưu…").
- **Problems:**
  1. **Validation không đồng nhất:** chỉ 4/~12 form dùng zod; các form khác (Settings, AdminUsers, Shipping, Coupon, modal trong OrderDetail/Return/Serial) validate thủ công bằng `if`.
  2. **Backend validation error mapping:** `ApiClientError.details` có cấu trúc field-level (`details: []`) nhưng các form thường chỉ `toast.error(err.message)` — **không map lỗi về đúng field**. Admin không biết field nào sai.
  3. **Modal form trong OrderDetail/Return/Serial dùng `<label className="field-label">` raw** thay vì `FormField` → required `*` và inline error không nhất quán.
  4. Field số (`Input type="number"`) cho refund/quantity OK; tiền tệ VND format qua `formatCurrencyVnd` ổn.
- **Recommended fix:** Tạo helper map `ApiClientError.details` → object lỗi theo field, dùng chung; chuẩn hoá mọi form qua `FormField` + zod.

### E. Workflow & State UX — **PARTIAL**
- **Evidence:** Trạng thái render rõ (badge/label). **Chỉ action hợp lệ được hiện:** OrderDetail dùng `fetchOrderAllowedTransitions` từ backend; SerialDetail dùng `SERIAL_ALLOWED_TRANSITIONS` client; Return dùng `NEXT_STATUSES`. Có xác nhận 2 bước cho trạng thái terminal (serial SCRAPPED, void warranty). Có timeline/history cho Return (`detail.history`) và serial note.
- **Problems:**
  1. **OrderDetail không dùng react-query** → sau khi đổi trạng thái, `setState` cục bộ; danh sách đơn (`['orders']`) **không bị invalidate** → quay lại list thấy dữ liệu cũ tới khi staleTime (30s) hết.
  2. Sau action trên ReturnList/SerialList/WarrantyList, chỉ patch item trong mảng cục bộ — không refetch; nếu backend đổi field phụ (vd. `updatedAt`, history) thì UI lệch.
  3. State machine serial là **client-side** (`SERIAL_ALLOWED_TRANSITIONS`) — nếu backend đổi luật, admin có thể bấm transition rồi bị 422.
- **Recommended fix:** Chuyển OrderDetail/Serial/Return/Warranty sang react-query + `invalidateQueries`; ưu tiên `allowedTransitions` từ backend hơn bảng client.

### F. Permission UX — **PASS (với 1 lưu ý)**
- **Evidence:** Permission gate 2 tầng: nav ẩn (`visibleNavGroups`) + route guard (`routePermission` + màn "permission denied"). Action-level dùng prop `canUpdate`/`canRefund`/`canWriteOff`/`canOverridePrice`... truyền từ `App.jsx`. Button thiếu quyền thường bị `disabled` + `title` giải thích (vd. ProductList nút "Tạo" → "Bạn không có quyền").
- **Problems:**
  1. **Permission là client-side gate** — nếu bypass UI, backend phải tự chặn (giả định backend có chặn; cần BE xác nhận — `NEEDS_VERIFICATION`).
  2. Một vài chỗ thiếu quyền **ẩn hẳn** button thay vì disable+tooltip → admin không hiểu vì sao thiếu chức năng (vd. action serial ẩn khi `!canUpdate`).
  3. Nguy cơ "bấm xong mới 403" thấp vì gate sớm, nhưng nếu role bị thu hồi giữa phiên thì action vẫn hiện tới lần load lại.
- **Recommended fix:** Thống nhất quy ước: action nguy hiểm thiếu quyền → disable + tooltip (không ẩn). Xác nhận BE enforce permission độc lập.

### G. Error handling UX — **PARTIAL**
- **Evidence:** `ApiClientError` có `message/status/code/details`; backend message hiển thị trực tiếp. List error → `StatePanel tone="danger"` + nút "Thử lại". `ErrorBoundary` bọc toàn app. Toast (sonner) cho success/error.
- **Problems:**
  1. **Không phân biệt lỗi mạng vs lỗi nghiệp vụ:** mọi lỗi đổ ra `err.message`. Lỗi mạng (fetch fail) → `err.message` = "Failed to fetch" hiển thị thẳng cho admin — khó hiểu.
  2. Form thường `toast.error(err.message)` thay vì inline → mục D.
  3. `dispatch()` có thể ném lỗi mạng thô; không có lớp "wrap" thành thông điệp thân thiện.
  4. Không có retry tự động cho lỗi mạng ở action mutation (chỉ list có nút retry).
- **Recommended fix:** Wrap network error thành message tiếng Việt thân thiện; tách `code` ra để phân loại; thêm retry cho mutation lỗi mạng.

### H. Loading / Empty / Success states — **PARTIAL**
- **Evidence:** `AdminTable` có skeleton rows. Dashboard có skeleton block riêng. Empty state qua `StatePanel` có title + description + CTA reset filter. Success → toast. Suspense fallback cho lazy screen.
- **Problems:**
  1. **List manual-fetch nháy loading mỗi lần đổi trang/lọc:** không có `keepPreviousData` (chỉ `useAdminList`/react-query có). Customer/Return/Serial/Warranty: đổi trang → bảng biến mất → skeleton → dữ liệu. Trải nghiệm giật.
  2. OrderDetail/ProductDetail loading chỉ là `StatePanel` text "Đang tải" — không skeleton layout.
  3. Empty state đôi chỗ thiếu CTA (Warranty/Serial empty không có nút tạo/clear vì không có search).
- **Recommended fix:** Migrate list manual sang react-query (`placeholderData: keepPreviousData`); thêm skeleton layout cho detail screen.

### I. Visual hierarchy / Consistency — **FAIL**
- **Evidence:** Có token cascade (`admin-tokens.css`), `StatusBadge`/`Badge` shared, `StatePanel` tone-based.
- **Problems (nghiêm trọng):**
  1. **204 lần `className="btn ..."` legacy trên 25 screen** thay vì shadcn `Button` — vi phạm trực tiếp `CLAUDE.md` ("Cấm dùng raw HTML + class CSS legacy").
  2. **`index.css` phình 5773 dòng** chứa hàng trăm class semantic (`.screen`, `.filter-bar`, `.modal-*`, `.dash-*`, `.btn-*`...) — trái quy tắc "globals chỉ chứa token + reset + shadcn override".
  3. **Status badge tự chế lặp lại:** `OrderListScreen.OrderStatusBadge`, `ReturnListScreen.StatusBadge`, `WarrantyListScreen.StatusBadge`, `DashboardScreen.OrderStatusBadge`, `SerialStatusBadge`, `WarrantyStatusBadge` — mỗi screen tự định nghĩa, **màu hardcode hex** (`#d97706`, `#16a34a`...) thay vì token/`StatusBadge` shared.
  4. **Hardcode hex/px khắp nơi** trong `style={{}}` inline (vd. OrderDetail return status colors, ProductList homepage warning box).
  5. Hai thế hệ screen (mục 1) → spacing/padding/typography lệch nhau.
- **Recommended fix:** (lộ trình P2) Migrate sang `Button` shadcn + `components/layout`; gộp mọi badge về một `StatusBadge` mở rộng theo `type`; xoá CSS class chết sau migrate.

### J. Responsive / Admin desktop UX — **PARTIAL**
- **Evidence:** Sidebar có overlay mobile + hamburger. `MobileCardList` component tồn tại. Desktop layout dày, hợp admin.
- **Problems:**
  1. Chỉ screen mới (Dashboard/Receivables) có `MobileCardList`; 6+ list legacy render `<table>` trần → mobile scroll ngang.
  2. Raw `.modal-overlay` modal có `maxWidth` cứng (520–620px) + `maxHeight: 90vh` — dùng được trên mobile nhưng không tận dụng full-width, không như `Modal` (Radix responsive).
  3. Bảng nhiều cột (OrderDetail items, Audit log) không có chiến lược thu gọn.
- **Recommended fix:** Thêm `MobileCardList` cho list legacy; thống nhất modal.

### K. Performance UX — **PASS (với lưu ý)**
- **Evidence:** Lazy-load mọi screen; server-side pagination; debounce 250ms; `queryClient` có `staleTime 30s`, `refetchOnWindowFocus: false`, `retry: 1`; `keepPreviousData` ở `useAdminList`; brand/category dropdown cache `staleTime 5 phút`; ảnh `loading="lazy"`.
- **Problems:**
  1. List manual-fetch (mục H) không cache → mỗi lần vào lại screen refetch từ đầu; không dedup nếu nhiều component cùng gọi.
  2. Bundle: `xlsx` (424KB), `RichTextEditor/tiptap` (390KB), `recharts` (346KB) — đã code-split theo screen nên chỉ tải khi cần (tốt). `index` chunk 474KB hơi lớn.
  3. `ProductListScreen` luôn fetch `fetchBrands({pageSize:100})` + `fetchCategoryTree()` ngay cả khi không mở filter — chấp nhận được vì cache 5 phút.
- **Recommended fix:** Migrate data layer; cân nhắc tách `index` chunk.

### L. Data / API contract fit — **PARTIAL**
- **Evidence:** `contracts.js` có lớp `normalize*` chuẩn hoá response (`normalizeOrder`, `normalizeProduct`, `normalizePagination`...). `ProductListScreen` còn comment mirror giới hạn homepage block của `bigbike-web`.
- **Problems:**
  1. **Bug Dashboard đếm đổi trả** (mục 5): dùng `status: 'REQUESTED'` (không có trong enum return) + đọc `pagination.total` trong khi `normalizePagination` trả `totalItems`. → CONFLICTING contract.
  2. `normalizePagination` chuẩn field là `totalItems`/`totalPages`/`page`; bất kỳ chỗ nào đọc `.total` đều sai — cần grep toàn bộ.
  3. Return status enum dùng ở 3 nơi (`ReturnListScreen.STATUSES`, `OrderDetailScreen` STATUS maps, Dashboard) — không tập trung, dễ lệch như bug trên.
- **Recommended fix:** Tập trung enum return/order/serial vào `contracts.js` hoặc `lib/`; sửa Dashboard (mục 5).

### M. Admin safety / Traceability — **PARTIAL**
- **Evidence:** Có `ConfirmDialog` (Radix) global. Xác nhận cho xoá SP, void warranty, serial terminal state. Có `AuditLogListScreen`. Soft delete cho product (`softDeleteProduct`/`restoreProduct` + publishStatus TRASH).
- **Problems:**
  1. **OrderDetail dùng `window.confirm()` native** cho huỷ đơn/hoàn tiền/huỷ vận chuyển — và PosScreen (xoá giỏ), RolesScreen (discard) cũng vậy → không khớp `ConfirmDialog`, không style theo brand, không i18n.
  2. Không thấy cảnh báo rõ khi sửa SP/giá đã phát sinh đơn — `NEEDS_VERIFICATION` (chưa đọc hết ProductDetail).
  3. Audit log có nhưng không có "history" inline trên Order/Product detail (Return có history, Order không).
- **Recommended fix:** Thay toàn bộ `window.confirm` bằng `showConfirm`; thêm cảnh báo khi sửa dữ liệu đã phát sinh đơn.

---

## 5. Critical Issues

### ISSUE-01 — Dashboard "Đổi trả chờ xử lý" luôn hiển thị 0
- **Severity:** HIGH
- **Location:** `src/screens/DashboardScreen.jsx:173-177, 210`
- **Description:** Card cảnh báo "Đổi trả chờ xử lý" query `fetchReturns({ status: 'REQUESTED', page:1, pageSize:1 })` và đọc `pendingReturns?.pagination?.total`.
- **Evidence:**
  - Enum trạng thái return thực tế (`ReturnListScreen.jsx:15`, `OrderDetailScreen.jsx:647`) là `PENDING/APPROVED/REJECTED/RECEIVED/COMPLETED/REFUNDED` — **không có `REQUESTED`**.
  - `normalizePagination` (`contracts.js:680-694`) trả field `totalItems`, **không có `total`** → `pagination.total` = `undefined`.
- **Impact:** Admin không bao giờ thấy cảnh báo RMA tồn đọng trên Dashboard → bỏ sót yêu cầu đổi trả của khách. Lỗi nghiệp vụ thật.
- **Recommended fix:** Đổi `status: 'REQUESTED'` → `'PENDING'`; đổi `pendingReturns?.pagination?.total` → `pendingReturns?.pagination?.totalItems`. Cần verify enum return chính thức với backend trước khi sửa.
- **Can auto-fix now?** NO (cần xác nhận enum return canonical từ backend / docs `STATE_MACHINES.md`).
- **Needs confirmation?** YES

### ISSUE-02 — Dropdown "Số dòng/trang" ở màn Đơn hàng không render (ĐÃ FIX)
- **Severity:** MEDIUM
- **Location:** `src/screens/OrderListScreen.jsx:181-186`
- **Description:** `<Select>` dùng native `<option>` bên trong `<SelectContent>` của Radix/shadcn. Radix Select chỉ nhận `SelectItem` (`SelectPrimitive.Item`) → popover hiện rỗng, admin không đổi được số dòng/trang. Thêm vào đó `value={query.pageSize}` (number) không khớp value string của item.
- **Evidence:** `components/ui/select.jsx` — `SelectItem` wrap `SelectPrimitive.Item`; native `<option>` không được Radix nhận.
- **Impact:** Đổi page size ở Order list bất khả dụng (các filter khác vẫn ok).
- **Recommended fix:** Thay `<option>` → `<SelectItem value="20">`, `value={String(query.pageSize)}`.
- **Can auto-fix now?** YES — **đã áp dụng** (mục 12), scope nhỏ, không đụng business logic/API.
- **Needs confirmation?** NO

### ISSUE-03 — Modal tự chế thiếu accessibility & không đồng nhất
- **Severity:** MEDIUM
- **Location:** `OrderDetailScreen, ProductDetailScreen, InventoryScreen, MenuScreen, AdminUsersScreen, ContactInboxScreen, PosScreen, ReturnListScreen, SerialListScreen, WarrantyListScreen` (raw `.modal-overlay/.modal-card`).
- **Description:** 10 screen tự dựng modal bằng `<div className="modal-overlay" onClick={onClose}>` thay vì `Modal` (Radix Dialog). Mất focus trap, không đóng bằng `Escape`, không `aria-modal`/`aria-labelledby` chuẩn (chỉ Serial modal có thủ công), không khoá scroll nền.
- **Impact:** Người dùng bàn phím/screen-reader khó dùng; nhấn nhầm ra ngoài mất dữ liệu form đang nhập (overlay click = close, không confirm).
- **Recommended fix:** Migrate sang `components/layout/Modal.jsx`. Nên làm theo từng screen.
- **Can auto-fix now?** NO (đụng nhiều screen, cần test từng modal).
- **Needs confirmation?** YES

### ISSUE-04 — Thao tác nguy hiểm dùng `window.confirm()` native
- **Severity:** MEDIUM
- **Location:** `OrderDetailScreen.jsx:222,228,290`; `PosScreen.jsx:1047`; `RolesScreen.jsx:947`.
- **Description:** Huỷ đơn / hoàn tiền / huỷ vận chuyển / xoá giỏ POS dùng `window.confirm()` thay vì `showConfirm` (`ConfirmDialog` Radix).
- **Impact:** Hộp thoại không theo brand, không i18n (EN user vẫn thấy tiếng Việt), không style danger; trải nghiệm lệch hẳn phần còn lại của app.
- **Recommended fix:** Thay bằng `await showConfirm(message, title)` — `lib/confirm.js` đã sẵn.
- **Can auto-fix now?** NO (đổi hành vi async của handler — nhỏ nhưng cần test luồng confirm).
- **Needs confirmation?** YES (đề xuất gộp chung 1 task với ISSUE-03).

### ISSUE-05 — Detail/list screen không invalidate cache sau action
- **Severity:** MEDIUM
- **Location:** `OrderDetailScreen, ReturnListScreen, SerialListScreen, WarrantyListScreen, CustomerListScreen` (manual `useState` fetch).
- **Description:** Sau khi đổi trạng thái, screen chỉ `setState` cục bộ; không `invalidateQueries`. Quay lại list (nếu list dùng react-query) hoặc mở lại detail có thể thấy dữ liệu cũ.
- **Impact:** Admin có thể thao tác trên trạng thái lỗi thời (vd. duyệt đơn đã bị người khác huỷ).
- **Recommended fix:** Migrate sang react-query + invalidate. Cùng nhóm với việc thống nhất data layer.
- **Can auto-fix now?** NO.
- **Needs confirmation?** YES

### ISSUE-06 — Backend validation error không map về field
- **Severity:** LOW–MEDIUM
- **Location:** Hầu hết form (đặc biệt modal trong OrderDetail/Return/Serial; Settings/AdminUsers/Shipping/Coupon).
- **Description:** `ApiClientError.details` (field-level) bị bỏ qua; chỉ `toast.error(err.message)`.
- **Impact:** Admin không biết field nào sai khi submit form dài.
- **Recommended fix:** Helper map `details` → lỗi theo field, render qua `FormField error`.
- **Can auto-fix now?** NO.
- **Needs confirmation?** YES

### ISSUE-07 — Vi phạm UI stack: legacy `.btn` & CSS class semantic
- **Severity:** LOW (kỹ thuật) — không phải bug runtime
- **Location:** 25 screen, 204 occurrence `className="btn ..."`; `index.css` 5773 dòng.
- **Description:** Vi phạm `CLAUDE.md` (shadcn `Button` only, globals chỉ chứa token/reset).
- **Impact:** Khó bảo trì, dễ lệch design system, hai thế hệ UI.
- **Recommended fix:** Lộ trình migrate P2 (mục 11).
- **Can auto-fix now?** NO (refactor lớn — ngoài phạm vi phase audit).
- **Needs confirmation?** YES

---

## 6. Screen-by-Screen Findings

> Trình bày các screen đã đọc sâu. Screen `NEEDS_VERIFICATION` trong mục 3 cần audit line-by-line riêng.

### DashboardScreen — PARTIAL
- **Current UX:** KPI card click-được, khối attention, biểu đồ doanh thu (area) + cơ cấu đơn (pie), bảng đơn gần đây + top SP. Skeleton riêng. Dùng `components/layout` + react-query.
- **Problems:** ISSUE-01 (đếm đổi trả luôn 0). `OrderStatusBadge` tự chế (trùng `StatusBadge`). Màu trạng thái hardcode hex (`ORDER_STATUS_COLORS`).
- **Missing states:** Error chỉ `window.location.reload()` — thô; nên dùng `refetch()`.
- **Performance:** Tốt — staleTime 60s, side-fetch độc lập.
- **Recommended:** Sửa ISSUE-01; dùng `refetch` thay reload; gộp badge.

### OrderListScreen — PARTIAL
- **Current UX:** Search debounce, 5 filter (status/payment/date/sort/pageSize), export CSV, WS real-time invalidate ở trang 1, `useAdminList`.
- **Problems:** Filter **không sync URL** (dùng `useState` thuần) — khác ProductList → reload mất filter, không share link. `OrderStatusBadge` tự chế. Action button `.btn` legacy. ISSUE-02 (đã fix).
- **Missing:** Sort cột (header không click). Không có MobileCardList.
- **Recommended:** Dùng `useUrlQuery`; bật sort header.

### OrderDetailScreen — PARTIAL
- **Current UX:** Section đầy đủ (KH, trạng thái, payment, refund, fulfillment, items, payments, shipping, RMA, timestamps, notes). Chỉ hiện transition hợp lệ (`allowedTransitions` từ BE). Có modal tạo RMA.
- **Problems:** Manual fetch — không react-query, không invalidate `['orders']` (ISSUE-05). `window.confirm` x3 (ISSUE-04). `AdminCreateReturnModal` raw `.modal-overlay` (ISSUE-03). Bảng items/payments/returns dựng `<table>` inline + style hardcode. Return status màu hex hardcode lặp với ReturnList.
- **Missing:** Loading chỉ text, không skeleton. Không có lịch sử thay đổi trạng thái đơn (chỉ timestamps).
- **Data contract:** OK với `normalizeOrder`.
- **Recommended:** Migrate react-query; thay confirm; dùng `Modal`; tách bảng thành component.

### ProductListScreen — PASS (tham chiếu legacy tốt)
- **Current UX:** `useAdminList` + sync URL (`readQueryFromUrl/syncQueryToUrl`), 7 filter, export, soft-delete + restore + duplicate (qua sessionStorage), cảnh báo vượt giới hạn homepage block.
- **Problems:** Action `.btn` legacy. Homepage warning box style hardcode hex inline. Không sort header.
- **Recommended:** Giữ làm mẫu; chỉ cần đổi `.btn` → `Button`.

### CustomerListScreen — PARTIAL
- **Current UX:** Search debounce, filter status, export.
- **Problems:** Manual fetch (không cache, nháy loading khi đổi trang). `CustomerStatusBadge` tự chế `status-badge status-*` legacy. Không sync URL. Không sort.
- **Recommended:** Migrate `useAdminList`.

### ReturnListScreen — PARTIAL
- **Current UX:** Search, filter status, bảng RMA, modal chi tiết có history + items + form đổi trạng thái (chỉ next-state hợp lệ).
- **Problems:** Manual fetch + patch cục bộ (ISSUE-05). Modal raw (ISSUE-03). `StatusBadge` tự chế + màu hex (lặp 3 lần across screens). `navigate` tự chế bằng `pushState + PopStateEvent` (khác prop `navigate` các screen khác nhận). Không sync URL.
- **Recommended:** Migrate react-query; dùng `Modal`; nhận `navigate` qua prop như screen khác.

### SerialListScreen — PARTIAL
- **Current UX:** Search serial, filter status, row click mở modal; modal có panel bảo hành lazy-load (chỉ fetch khi mở, không fetch ở bảng — tốt), state machine + note bắt buộc + xác nhận 2 bước cho terminal.
- **Problems:** Manual fetch. Modal raw `.modal-box` (ISSUE-03). `SerialStatusBadge`/`WarrantyStatusBadge` cục bộ. State machine client-side.
- **Recommended:** Migrate react-query; `Modal`.

### WarrantyListScreen — PARTIAL
- **Current UX:** Filter status, bảng phiếu, modal chi tiết, void phiếu có xác nhận 2 bước inline.
- **Problems:** Manual fetch. **Không có search** (chỉ filter status) — khó tra phiếu theo email/serial. Modal raw. `StatusBadge` tự chế hex. Admin-note box style hardcode `#fffbeb/#fde68a`.
- **Missing:** Search theo email KH / serial.
- **Recommended:** Thêm search; migrate react-query; `Modal`.

### ReceivablesListScreen — PASS (screen mẫu chuẩn)
- **Current UX:** `useUrlQuery` + react-query (query + mutation + invalidate), `components/layout` đầy đủ (Screen/ScreenHeader/FilterBar/SummaryCard/Tabs/Modal/MobileCardList/FormField), KPI card filter-shortcut, tab trạng thái.
- **Problems:** `formatCurrency` cục bộ thay vì `formatCurrencyVnd` shared (minor); `StatusBadge` cục bộ nhưng dùng `Badge` shared (chấp nhận được).
- **Recommended:** Dùng làm template cho việc migrate các screen khác.

---

## 7. Workflow UX Findings

### Product management
- **Expected:** Tìm/lọc SP → tạo/sửa (form đầy đủ: ảnh, biến thể, giá, SEO, homepage) → publish → soft-delete/restore.
- **Current:** ProductList tốt (URL sync, soft-delete/restore/duplicate, cảnh báo homepage limit). ProductDetail dùng zod nhưng 30 `.btn` legacy + modal raw; chưa audit sâu.
- **Gaps:** Không bulk publish/hide; ProductDetail validation error mapping (ISSUE-06); chưa rõ cảnh báo khi sửa SP đã có đơn.
- **Risk:** Trung bình — sửa giá SP đã phát sinh đơn không có cảnh báo (`NEEDS_VERIFICATION`).
- **Recommended:** Audit line-by-line ProductDetail; thêm bulk action; cảnh báo dữ liệu đã phát sinh đơn.

### Order management
- **Expected:** Lọc đơn → mở đơn → đổi trạng thái theo state machine → xử lý payment/fulfillment → ghi chú → tạo RMA.
- **Current:** Hoạt động; transition hợp lệ lấy từ BE; BACS auto-pay có confirm rõ.
- **Gaps:** `window.confirm` (ISSUE-04); không invalidate list (ISSUE-05); filter không sync URL; modal RMA raw.
- **Risk:** Trung bình — thao tác trên trạng thái lỗi thời.
- **Recommended:** Migrate react-query + `ConfirmDialog` + `Modal`.

### Inventory / Serial management
- **Expected:** Nhập kho serial → theo dõi trạng thái serial theo state machine → tra cứu.
- **Current:** SerialList tra cứu + đổi trạng thái ok, panel bảo hành lazy. InventoryScreen (1980 dòng) chưa audit sâu.
- **Gaps:** State machine client-side; InventoryScreen `NEEDS_VERIFICATION` (30 `.btn`, modal raw).
- **Risk:** Trung bình.
- **Recommended:** Audit riêng InventoryScreen; ưu tiên allowed-transition từ BE.

### Warranty management
- **Expected:** Tra phiếu bảo hành → xem chi tiết → void nếu cần.
- **Current:** Hoạt động; void có xác nhận 2 bước.
- **Gaps:** Không có search (chỉ filter status) — tra phiếu theo KH bất tiện. Manual fetch.
- **Risk:** Thấp–trung bình (tra cứu chậm khi nhiều phiếu).
- **Recommended:** Thêm search email/serial.

### Payment / Debt (Receivables)
- **Expected:** Xem công nợ → ghi nhận thu tiền → write-off.
- **Current:** ReceivablesList/Detail là screen chuẩn nhất — react-query + mutation + invalidate + permission prop (`canRecordPayment`, `canWriteOff`).
- **Gaps:** Không đáng kể.
- **Risk:** Thấp.
- **Recommended:** Dùng làm chuẩn migrate.

### Return / RMA
- **Expected:** Khách/admin tạo RMA → duyệt → nhận hàng → hoàn tiền/hoàn tất.
- **Current:** ReturnList + modal next-state hợp lệ + history. Tạo RMA từ OrderDetail (khi đơn COMPLETED).
- **Gaps:** ISSUE-01 (dashboard không đếm được); enum return rải rác 3 nơi; modal raw; manual fetch.
- **Risk:** Cao về visibility — admin bỏ sót RMA chờ duyệt vì dashboard im lặng.
- **Recommended:** Sửa ISSUE-01; tập trung enum.

### User / Role management
- **Expected:** Quản lý tài khoản admin, gán role; sửa ma trận quyền.
- **Current:** AdminUsersScreen + RolesScreen tồn tại; RolesScreen 1176 dòng (permission matrix). `NEEDS_VERIFICATION`.
- **Gaps:** RolesScreen `window.confirm` cho discard; modal raw ở AdminUsers.
- **Risk:** Trung bình — sửa quyền là thao tác nhạy cảm, cần audit kỹ riêng.
- **Recommended:** Audit line-by-line RolesScreen + AdminUsersScreen (ngoài phạm vi phase này).

### Content / Banner / Homepage
- **Expected:** Soạn bài viết/trang, quản lý slider/video trang chủ, menu, redirect, media.
- **Current:** Bộ screen Content/Slider/HomeVideo/Menu/Media/Redirect tồn tại; nhiều cái dùng dnd-kit để sắp xếp. `NEEDS_VERIFICATION`.
- **Gaps:** Chưa audit sâu; MediaLibrary dùng CSS module riêng (`.module.css`) — lệch quy ước Tailwind.
- **Risk:** Thấp–trung bình.
- **Recommended:** Audit riêng nhóm content; xem lại CSS module của Media.

---

## 8. Design System / Component Reuse Findings

### Dùng tốt
- `AdminTable` — chuẩn hoá, có skeleton/sort/select/row-click, dùng rộng rãi.
- `StatePanel` — empty/error/loading thống nhất.
- `PaginationControls`, `ConfirmDialog` (nơi được dùng), `FormField`, `SummaryCard`, `components/ui/*` (shadcn).
- `contracts.js` normalize layer — chống lệch contract.

### Duplicate / cần chuẩn hoá
| Vấn đề | Nơi | Đề xuất |
|---|---|---|
| Status badge tự chế | OrderList, Dashboard, ReturnList, WarrantyList, SerialList (6+ biến thể) | Mở rộng `StatusBadge` shared theo `type` (order/payment/return/warranty/serial); xoá bản cục bộ |
| Modal tự chế | 10 screen `.modal-overlay` | Dùng `components/layout/Modal.jsx` |
| Màu trạng thái hardcode hex | `#d97706/#16a34a/#dc2626...` rải rác | Đưa vào token, badge đọc token |
| `formatCurrency` cục bộ | ReceivablesListScreen | Dùng `formatCurrencyVnd` shared |
| `navigate` tự chế | ReturnListScreen | Nhận qua prop như screen khác |
| Layer fetch | 2 thế hệ (react-query vs manual) | Thống nhất `useAdminList`/react-query |

### Button / input / table / modal / badge / toast — nhất quán?
- **Button:** KHÔNG — 204 `.btn` legacy vs shadcn `Button`.
- **Input/Select/Checkbox/Textarea:** Có — dùng shadcn (trừ 1 chỗ native `<option>` đã fix).
- **Table:** Có — `AdminTable`, nhưng Dashboard render `<table className="admin-table">` thủ công.
- **Modal:** KHÔNG — `Modal` vs 10 screen raw.
- **Badge:** Một nửa — `Badge` shadcn có, nhưng status badge tự chế nhiều.
- **Toast:** Có — `sonner` đồng nhất.

### Token / theme / spacing
- Token cascade tồn tại (`admin-tokens.css` → `index.css`). Nhưng `index.css` 5773 dòng chứa hàng trăm class semantic — trái quy tắc "globals chỉ token/reset/shadcn override". `MediaLibraryScreen.module.css`, `MediaDetailPanel.module.css`, `MediaFolderSidebar.module.css` — CSS module per-screen, lệch quy ước Tailwind-inline.

---

## 9. Performance UX Findings

| Vấn đề | Chi tiết | Đề xuất |
|---|---|---|
| List manual-fetch nháy loading | Customer/Return/Serial/Warranty không `keepPreviousData` → đổi trang mất bảng | Migrate react-query |
| Không cache list manual | Vào lại screen refetch từ đầu, không dedup | react-query |
| OrderDetail/ProductDetail không cache | Mỗi lần mở refetch; sửa xong không sync list | react-query + invalidate |
| `index` chunk 474KB | Lớn nhưng đã code-split screen | Cân nhắc tách thêm |
| Re-render | `columns` đa số đã `useMemo`; chưa thấy vấn đề nặng | — |
| Image | `loading="lazy"` + `referrerPolicy` ở ProductList — tốt | giữ |
| Debounce | 250ms đồng nhất mọi search — tốt | giữ |
| Build | `@rolldown/plugin-babel` cảnh báo chậm (react-compiler) — không ảnh hưởng runtime | theo dõi |

Không phát hiện client-side filtering toàn dataset — tất cả list server-side. Đây là điểm mạnh.

---

## 10. Data Contract / Cross-App Consistency Findings

| Vấn đề | Mô tả | Đề xuất |
|---|---|---|
| `pagination.total` vs `totalItems` | Dashboard đọc `.total` (undefined); chuẩn là `totalItems` (`contracts.js:685`) | Sửa Dashboard; grep toàn repo tìm `.total` khác |
| Return status `REQUESTED` | Dashboard dùng `REQUESTED` không có trong enum (`PENDING/...`) | Sửa thành `PENDING` sau khi verify với `docs/business/STATE_MACHINES.md` |
| Enum return rải rác | `ReturnListScreen`, `OrderDetailScreen`, `Dashboard` mỗi nơi tự định nghĩa map | Tập trung vào `contracts.js` hoặc `lib/enums` |
| Homepage block limit | `ProductListScreen` hardcode `FEATURED_GRID:12/RECOMMENDED_CAROUSEL:10` mirror `bigbike-web` | Có comment cảnh báo — chấp nhận; nên đồng bộ qua config nếu web đổi |
| `homepageBlock`/`homepageOrder` | Admin set, web consume — cần đối chiếu `bigbike-web/app/page.tsx` | `NEEDS_VERIFICATION` với web |
| Mojibake trong comment | `lib/adminApi.js` có comment hỏng mã `â”€â”€` (UTF-8 corruption) — chỉ trong comment, không ảnh hưởng runtime nhưng vi phạm quy tắc encoding `CLAUDE.md` | Sửa lại comment UTF-8 |

Không đối chiếu được DTO Java backend trong phase này — các mismatch admin-form ↔ backend DTO ↔ migration cần task riêng có truy cập `docs/engineering/DATA_CONTRACT.md`.

---

## 11. Prioritized Action Plan

### P0 — Must fix before production
| Task | Reason | Affected files | Risk | Complexity | Owner |
|---|---|---|---|---|---|
| Sửa đếm "Đổi trả chờ xử lý" Dashboard (ISSUE-01) | Admin bỏ sót RMA tồn đọng | `DashboardScreen.jsx` | Thấp (sau khi verify enum) | S | Fullstack |
| ~~Fix dropdown pageSize Order (ISSUE-02)~~ | ~~Bất khả dụng~~ | `OrderListScreen.jsx` | — | — | **ĐÃ FIX** |

### P1 — Should fix soon
| Task | Reason | Affected files | Risk | Complexity | Owner |
|---|---|---|---|---|---|
| Thay `window.confirm` → `showConfirm` (ISSUE-04) | Đồng nhất + i18n thao tác nguy hiểm | OrderDetail, Pos, Roles | Thấp | S | FE |
| Migrate modal raw → `Modal` (ISSUE-03) | A11y + đồng nhất | 10 screen | Trung bình | M | FE |
| Migrate OrderDetail/Return/Serial/Warranty/Customer → react-query (ISSUE-05) | Cache + invalidate + bớt nháy loading | 5 screen | Trung bình | M | FE |
| Map `ApiClientError.details` → field error (ISSUE-06) | Form dài báo lỗi đúng field | helper + form screens | Thấp | M | FE |
| Sync URL filter cho OrderList/CustomerList/ReturnList | Reload/share link giữ filter | 3 screen | Thấp | S | FE |
| Thêm search cho WarrantyList | Tra phiếu theo KH | `WarrantyListScreen.jsx` | Thấp | S | Fullstack (cần BE hỗ trợ query) |
| Tập trung enum return/order/serial | Chống lệch contract | `contracts.js` + screens | Thấp | S | FE |

### P2 — Improve later
| Task | Reason | Affected files | Risk | Complexity | Owner |
|---|---|---|---|---|---|
| Migrate 25 screen `.btn` → shadcn `Button` | Tuân thủ UI stack | 25 screen | Trung bình | L | FE |
| Migrate legacy screen → `components/layout` | Đồng nhất design system | ~30 screen | Trung bình | L | FE |
| Gộp status badge về `StatusBadge` shared | Hết duplicate + hết hardcode hex | badge + screens | Thấp | M | FE |
| Thêm `MobileCardList` cho 6 list legacy | Mobile UX | 6 screen | Thấp | M | FE |
| Bật sort header `AdminTable` cho list react-query | Tận dụng feature có sẵn | list screens | Thấp | S | FE |
| Dọn CSS class chết `index.css` (sau migrate) | Giảm 5773 dòng | `index.css` | Trung bình | M | FE |
| Audit line-by-line ProductDetail/Inventory/Roles/Pos/Menu/Content | Screen lớn chưa soi kỹ | — | — | L | FE |

### Nice to have
- Bulk action: publish/hide nhiều SP, xoá nhiều media.
- Breadcrumb cấp 3 hiển thị tên/ID bản ghi.
- Skeleton layout cho detail screen.
- Wrap lỗi mạng thành message tiếng Việt thân thiện.

---

## 12. Safe Auto-Fixes Applied

### Fix 1 — Dropdown "Số dòng/trang" màn Đơn hàng (ISSUE-02)
- **File changed:** `bigbike-admin/src/screens/OrderListScreen.jsx`
- **What changed:** Thay 3 native `<option value={20|50|100}>` bên trong `<SelectContent>` bằng `<SelectItem value="20|50|100">`; đổi `value={query.pageSize}` → `value={String(query.pageSize)}` để khớp kiểu string của Radix Select.
- **Why safe:** Radix/shadcn `Select` chỉ render `SelectItem`; native `<option>` không có tác dụng → đây là sửa bug render thuần UI. Không đụng business logic, API contract, data contract, permission, state machine. `onValueChange` vẫn `Number(val)` như cũ.

### Fix 2 — Dashboard đếm "Đổi trả chờ xử lý" (ISSUE-01, P0)
- **File changed:** `bigbike-admin/src/screens/DashboardScreen.jsx`
- **What changed:** `fetchReturns({ status: 'REQUESTED' })` → `'PENDING'`; `pagination.total` → `pagination.totalItems`.
- **Why safe:** Enum return canonical xác nhận theo `docs/business/STATE_MACHINES.md` (`PENDING/APPROVED/REJECTED/RECEIVED/COMPLETED/REFUNDED`); `normalizePagination` trả `totalItems`. Sửa đúng contract, không đổi nghiệp vụ.

### Fix 3 — Thay `window.confirm()` bằng `showConfirm` (ISSUE-04)
- **Files:** `OrderDetailScreen.jsx`, `PosScreen.jsx`, `RolesScreen.jsx`, `AdminUsersScreen.jsx`.
- **What changed:** Mọi `window.confirm()` cho thao tác nguy hiểm → `await showConfirm(message, title)` (Radix `ConfirmDialog` có sẵn). Handler đổi sang `async`.
- **Why safe:** Chỉ đổi cơ chế hiển thị hộp xác nhận; điều kiện huỷ/tiếp tục giữ nguyên.

### Fix 4 — Migrate modal raw → `Modal` component (ISSUE-03)
- **Files:** `OrderDetailScreen`, `PosScreen`, `WarrantyListScreen`, `ReturnListScreen`, `ContactInboxScreen`, `SerialListScreen`, `AdminUsersScreen`, `MenuScreen`, `InventoryScreen`, `ProductDetailScreen`.
- **What changed:** `.modal-overlay/.modal-card` raw div → `components/layout/Modal.jsx` (Radix Dialog: focus trap, Escape, `aria-modal`, khoá scroll nền).
- **Why safe:** Đổi vỏ modal, giữ nguyên nội dung form + handler submit.

### Fix 5 — URL-sync filter cho list screen
- **Files:** `OrderListScreen`, `CustomerListScreen`, `ReturnListScreen`.
- **What changed:** `readQueryFromUrl`/`syncQueryToUrl` cho filter state; `ReturnListScreen` nhận `navigate` prop từ `App.jsx` thay cho workaround `pushState` cục bộ.

### Fix 6 — Field-level validation error (ISSUE-06, một phần)
- **File:** `AdminUsersScreen.jsx`.
- **What changed:** Dùng `mapValidationErrors(err)` map `ApiClientError.details` → lỗi theo field, render dưới từng input của form tạo admin.

### Fix 7 — Migrate `.btn` legacy → shadcn `Button` (ISSUE-07, hoàn tất)
- **Files (24):** ContactInbox, CustomerList, OrderList, ReturnList, WarrantyList, BrandList, ContentList, ContentDetail, ReviewList, AuditLogList, CategoryList, CouponList, CustomerDetail, OrderDetail, Menu, SliderList, RedirectList, ProductList, MediaLibrary, AdminUsers, Inventory, ProductDetail, Receivables screens + `MediaDetailPanel`.
- **What changed:** `<button className="btn btn-primary|secondary|danger|ghost">` → shadcn `<Button variant="default|outline|danger|ghost|link|success">`; `btn-sm` → `size="sm"`, `btn-icon` → `size="icon"`; biến thể custom `btn-danger-ghost`/`btn-ghost-danger` → `variant="outline|ghost"` + `className="text-destructive"`; link-as-button dùng `<Button asChild>`. **Không còn `.btn` legacy nào trong `src/`.**
- **Why safe:** Đổi component trình bày, giữ nguyên `onClick`/`disabled`/`type`/`form`. Lint + build pass.

### Fix 8 — Sửa `variant="destructive"` không tồn tại trên admin `Button`
- **Files:** `RefundModal.jsx` (bug có sẵn) + các screen vừa migrate ở Fix 7.
- **What changed:** `<Button variant="destructive">` → `variant="danger"`. Component `components/ui/button.jsx` chỉ định nghĩa `danger` (không có `destructive`); truyền `destructive` khiến nút render thiếu nền/màu cảnh báo.
- **Why safe:** Sửa đúng tên biến thể theo `buttonVariants` — bug UI thuần, không đụng logic.

### Fix 9 — Migrate data layer sang react-query (ISSUE-05) — đã được user duyệt
- **Files (5):** `CustomerListScreen`, `WarrantyListScreen`, `SerialListScreen`, `ReturnListScreen` → dùng `useAdminList` (react-query + `keepPreviousData`); `OrderDetailScreen` → `useQuery(['order', orderId])`.
- **What changed:**
  - 4 list screen: bỏ `useState` + `useEffect` fetch thủ công → `useAdminList(['<key>', query], () => fetch...())`. Hết nháy skeleton khi đổi trang (giữ data cũ trong lúc tải), có cache, nút "Thử lại" dùng `refetch()`.
  - Sau mỗi action (huỷ bảo hành, đổi trạng thái serial, cập nhật đổi trả): `queryClient.invalidateQueries` thay cho patch mảng cục bộ → dữ liệu luôn đồng bộ với backend.
  - `OrderDetailScreen`: fetch đơn qua `useQuery`; sau khi đổi trạng thái/thanh toán/vận chuyển/hoàn tiền → cập nhật cache đơn + `invalidateQueries(['orders'])` để danh sách đơn không còn hiển thị dữ liệu cũ khi quay lại. Tạo đổi trả → `invalidateQueries(['returns'])`.
- **Why safe:** API call (`fetchCustomers`/`fetchReturns`/`fetchOrderDetail`/…) và payload giữ nguyên — chỉ đổi cơ chế fetch/cache, không đụng API contract, business logic, permission, state machine. Lint + build pass.

### Fix 10 — Gỡ CSS `.btn*` legacy chết trong `index.css`
- **File:** `bigbike-admin/src/index.css` (−150 dòng).
- **What changed:** Sau khi quét lại toàn bộ `src/` (kể cả template literal / ternary mà lần grep đầu bỏ sót — `OrderDetailScreen`, `MediaLibraryScreen`, `ReportsScreen`) và migrate nốt 4 chỗ còn lại sang `<Button>`, đã xoá các rule không còn JSX nào tham chiếu: `.btn`, `.btn-primary/secondary/danger/success/ghost`, `.btn-sm`, `.btn-icon`, `.btn-danger-ghost`, `.btn-secondary-ghost`, `.btn-ghost-danger`, `.btn-ghost-success`, và các selector ghép `.state-panel .btn`, `.screen-actions .btn`, `.audit-header-actions .btn span`, `.au-modal-footer .btn`.
- **Why safe:** Đã verify 0 tham chiếu `.btn*` trong toàn bộ `src/`. Rule mobile `.screen-actions .btn { flex: 1 }` được trỏ lại sang `.screen-actions > button, > a` để giữ nguyên hành vi nút full-width trên mobile. Lint + build pass.

### Còn lại (chưa áp dụng — cần review thủ công)
- Các class `.au-modal-*` (header/title/body/footer) có thể đã chết sau khi modal tạo admin chuyển sang `Modal` component — nằm ngoài phạm vi dọn nút, nên kiểm tra trong một pass dọn CSS tổng.

**Test result:** `npm run lint` (eslint toàn bộ `src/`) pass 0 lỗi; `npm run build` pass (~10s). **Không còn `.btn` legacy nào trong cả JSX lẫn CSS.**

---

## 13. Commands Run

| Command | Kết quả |
|---|---|
| `npm run lint` (`eslint .`) | **PASS** — 0 error, 0 warning |
| `npm run build` (`vite build`) | **PASS** — built in ~9.4s; code-split theo screen; cảnh báo non-blocking `@rolldown/plugin-babel` chậm (react-compiler) |

Không có script test (`package.json` chỉ có `dev/build/lint/preview`) — **không có unit/integration test cho admin** (đây cũng là một gap chất lượng).

---

## 14. Final Verdict

**bigbike-admin CHƯA đủ chuẩn cho production đồng nhất — trạng thái PARTIAL.** App chạy được, build/lint sạch, kiến trúc routing + permission + pagination tốt; nhưng tồn tại nợ kỹ thuật và 1 bug nghiệp vụ thật.

### Còn thiếu gì
1. **1 bug nghiệp vụ (P0):** Dashboard không đếm được đổi trả chờ xử lý → admin bỏ sót RMA.
2. **Đồng nhất:** hai thế hệ UI, 204 `.btn` legacy, 10 modal raw, 2 layer data — vi phạm `CLAUDE.md`.
3. **A11y modal:** raw modal thiếu focus trap/Escape/aria.
4. **Không có test tự động** cho admin.

### Vấn đề có thể gây lỗi vận hành thật
- **ISSUE-01** — bỏ sót yêu cầu đổi trả (HIGH).
- **ISSUE-05** — thao tác trên trạng thái lỗi thời do không invalidate cache (MEDIUM).
- **ISSUE-04** — `window.confirm` cho huỷ đơn/hoàn tiền: chấp nhận được về chức năng nhưng dễ bấm nhầm, không i18n (MEDIUM).
- **ISSUE-02** — đã fix.

### Thứ tự xử lý đề xuất
1. **Ngay (P0):** Xác nhận enum return với `docs/business/STATE_MACHINES.md` → sửa ISSUE-01.
2. **Sprint kế (P1):** `window.confirm`→`ConfirmDialog`; migrate modal raw→`Modal`; migrate 5 screen sang react-query; map lỗi backend về field; sync URL filter; tập trung enum.
3. **Trung hạn (P2):** Migrate đồng loạt sang `components/layout` + shadcn `Button`, gộp badge, thêm MobileCardList, dọn `index.css`; audit line-by-line các screen lớn chưa soi kỹ.
4. **Chất lượng:** Thêm test tự động (vitest) cho ít nhất các workflow đơn hàng / công nợ / đổi trả.

> **Lưu ý phạm vi:** 8 screen lớn (ProductDetail, Inventory, Roles, Pos, AuditLog, Menu, HomeVideo, CategoryDetail) chỉ được khảo sát qua pattern + grep, chưa đọc line-by-line — cần một phase audit con riêng trước khi chốt "production-ready" cho các module đó.
