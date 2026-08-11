# API Flow Map

## Client To API To Service

| Client surface | Endpoint(s) | Backend entrypoint | Core side effects / data | Status |
|---|---|---|---|---|
| Web search | Kết quả tìm kiếm: trang `/tim-kiem` gọi `GET /api/v1/products`; gợi ý gõ nhanh (dropdown header) gọi `GET /api/v1/search-suggest` qua route `/app/api/search-suggest`. (`GET /api/v1/search` đã gỡ 2026-07-15, AUD-066 — không client nào dùng.) | `PublicSearchController`, `PublicProductController` | Search result payload from global search service | `CONFIRMED_FROM_CODE` |
| Tin tức list page (`/tin-tuc`, `/en/tin-tuc`) | `GET /api/v1/articles` | `ContentController` -> `ContentReadService` | Paginated article list; content-category filter/sidebar/drawer no longer exists | `CONFIRMED_FROM_OWNER_DECISION` (2026-08-03) |
| Địa chỉ VN (storefront) | không gọi API — dùng dữ liệu tích hợp sẵn `VN_PROVINCES` (`vn-address-data.ts`, hai cấp tỉnh/thành → phường/xã). Backend API `GET /api/v1/address/provinces[...]` đã gỡ 2026-07-15 (AUD-056, owner decision #8 — không có caller). | — | Không có side effect | `REMOVED` |
| Cart UI | `/api/v1/cart`, `/api/v1/cart/items` | `CartController` -> `CartService` | Session/customer cart, item snapshots | `CONFIRMED_FROM_CODE` |
| Checkout UI | `POST /api/v1/checkout` | `CheckoutController` -> `CheckoutService` | Order/payment/shipping snapshots, per-variant `isAvailable` gate (no quantity decrement, V261), notifications, WS event | `CONFIRMED_FROM_CODE` |
| Customer address UI | `/api/v1/customer/addresses` | `CustomerAddressController` -> `CustomerAddressService` | Own-address CRUD | `CONFIRMED_FROM_CODE` |
| Customer orders UI | `/api/v1/customer/orders` | `CustomerOrderController` -> `OrderReadService` | Own order list/detail | `CONFIRMED_FROM_CODE` |
| Storefront trợ lý Bi | `GET /api/v1/chat/availability`; `POST /api/v1/chat/messages`; `POST /api/v1/chat/leads` | `ChatController` -> `ChatService` -> bộ `ChatToolService` cố định -> `AiChatClient` | Lưu hội thoại/tin nhắn tối đa 90 ngày; chỉ lead có consent mới ghi và phát thông báo; FAQ/contact fallback không gọi AI | `OWNER_CONFIRMED_2026-08-09` |
| Storefront login screen (`/dang-nhap`, `/dang-ky`) | `POST /api/v1/customer/auth/login` (+ `remember`), `POST /register`, `GET /oauth/{provider}/authorize` + `/callback` | `CustomerAuthController` / `CustomerOAuthController` -> `CustomerAuthService` / `CustomerOAuthService` | Session cookies issued; `remember` drives refresh-cookie lifetime; OAuth links-or-creates the customer | `CONFIRMED_FROM_CODE` |
| Product review panel | `GET /api/products/{productId}/reviews` qua BFF chỉ-đọc; `POST /api/v1/products/{productId}/reviews` và `/reviews/photos` gọi thẳng API public từ trình duyệt với `credentials: include` | `PublicReviewController` -> `PublicReviewService` | Gửi trực tiếp giữ đúng `bb_session` của host API để backend tự lấy danh tính khách đã đăng nhập, đồng thời giữ IP thật cho hai hạn mức gửi đánh giá/tải ảnh; review mới ở `PENDING`, ảnh upload được claim nguyên tử khi submit và upload bỏ dở được dọn sau 24 giờ (`REVIEW_RULE_007`, `REVIEW_RULE_009`–`REVIEW_RULE_011`) | `CONFIRMED_BACKEND_ENFORCED` |
| Admin media UI | `/api/v1/admin/media` | `AdminMediaController` -> `AdminMediaService` | Tika validation, MinIO storage, metadata persistence | `CONFIRMED_FROM_CODE` |
| Admin dashboard out-of-stock alert | `GET /api/v1/admin/inventory/summary` | `AdminInventoryController` -> `AdminInventoryService` | Standalone admin inventory screen removed 2026-06-23; only the summary endpoint is still called (by the Dashboard "Hết hàng" alert). Còn/Hết toggled per-variant in the product editor (`products.update`). The orphan `grouped` / `movements` / `PATCH .../availability` / `export.csv` endpoints were deleted 2026-07-15 (AUD-056, owner decision #8). Serial tracking removed V259, quantity model removed V261 | `CONFIRMED_FROM_CODE` |
| Admin product editor live preview | `POST /api/v1/admin/products/preview` | `AdminCatalogController` -> `AdminCatalogMutationService.previewProduct` -> `JpaCatalogReadRepository.mapPreviewProduct` | Dry-run render of the unsaved upsert payload to the public `Product` shape; **no persistence** (`@Transactional(readOnly=true)`); admin embeds the bigbike-web `/preview/product` iframe and postMessages the result | `CONFIRMED_FROM_CODE` |
| Admin product list CSV export | `ProductListScreen` → export Dialog → `GET /api/v1/admin/products/export.csv` | `ProductListScreen` / `adminApi.exportFullProductCatalogCsv` -> `AdminProductExportController` -> filtered keyset export service | Operator chooses `FILTERED`, `SELECTED`, or explicit `ALL`, status expansion and a column preset; CSV is streamed with UTF-8 BOM and every export records effective scope, filters, columns and row count | `CONFIRMED_FROM_OWNER_DECISION` (2026-08-09) |
| Admin Orders list + CSV | `GET /api/v1/admin/orders`; `GET /api/v1/admin/reports/orders/export` | `AdminOrderController` / `AdminReportController` -> shared order filter specification | List and CSV share `q`/`status`/`from`/`to`; calendar dates use `Asia/Ho_Chi_Minh`. CSV returns every matching order across pages with no 10,000-row cap (`ORDER_RULE_011`/`ORDER_RULE_012`). | `CONFIRMED_FROM_CODE` |
| Admin Customers list/detail + CSV | `GET /api/v1/admin/customers`, `/summary`, `/{customerId}`; `PATCH /{customerId}`, `PATCH /{customerId}/status`, `DELETE /{customerId}/avatar`; `GET /api/v1/admin/reports/customers/export` | `AdminCustomerController` / `AdminReportController` -> `AdminCustomerService` / `AdminCustomerCsvExportService` | List and CSV share `q`/`status`/`synthetic`/`emailVerified`; CSV returns every match without a row cap. Purchase KPIs exclude cancelled orders; registered-account KPIs exclude synthetic rows. Admin profile edits are limited to display name/phone, synthetic status is locked, and a real avatar removal writes an audit event (`CUSTOMER_RULE_004`–`CUSTOMER_RULE_009`). | `CONFIRMED_BACKEND_ENFORCED` |
| Admin live order feed | WebSocket `/ws` + topic `/topic/admin/orders` | `WebSocketConfig` + `AdminOrderWsService` | Admin push notifications after commit | `CONFIRMED_FROM_CODE` |
| Admin lịch sử Bi | `GET /api/v1/admin/chat/conversations`, `/{id}`, `/stats` | `AdminChatController` -> `AdminChatService` | Chỉ đọc, `chat.read`, lọc ngày/lead và thống kê lượt AI theo ngày Việt Nam | `OWNER_CONFIRMED_2026-08-09` |

## Flow Highlights

### Checkout

`cart client -> CheckoutService -> order/payment/shipping tables -> email + /topic/admin/orders` (per-variant `isAvailable` gate; no stock movements written — V261)

Status: `CONFIRMED_FROM_CODE`

### POS — REMOVED (owner decision 2026-06-23, online-only)

The admin POS flow was removed entirely. There is no `admin POS UI -> AdminPosController -> PosOrderService` path anymore; all sales flow through the storefront checkout (`Checkout UI` row above).

Status: `REMOVED`

### Customer login + remember-me

`login screen -> CustomerAuthController.login -> CustomerAuthService.login -> CustomerSessionService.createSession(remember)`

The `remember` flag chooses the refresh-cookie lifetime (1 day when false, 30 days when true) and is persisted on `customer_sessions.remember` so `refresh` preserves it on rotation.

Status: `CONFIRMED_FROM_CODE`

### Social login (OAuth2)

`login screen -> /oauth/{provider}/authorize -> provider consent -> /oauth/{provider}/callback -> CustomerOAuthService.exchangeCode + linkOrCreate -> CustomerAuthService.createSessionForCustomer -> session cookies -> 302 to storefront`

`linkOrCreate` (revised 2026-08-07, CUSTOMER_RULE_010): reuse the account matching `(provider, subject)`; else link onto an existing **passwordless** account with a verified matching email (so Google/Facebook can still merge with each other); else create a new active customer — never adopting a password account, even on a verified email match. Every pass through this also syncs `display_name`/`avatar_url` from the provider (`syncProfileFromProvider`), the only update path for a social account since self-service profile editing is locked (`CustomerAuthService.requireNotOauthManaged`).

Status: `CONFIRMED_FROM_CODE`

### Inventory receiving caveat

The `stock_receipts` schema was **dropped in V120** — no receiving flow was ever built. Since V261 inventory is a boolean availability toggle (no quantity, no stock-in); the `stock_movements` ledger is dormant.

Status: `REMOVED`

### Trợ lý Bi

`một widget chat duy nhất -> availability/master/quota gate -> context rút gọn không PII của phiên + local fast-path nếu rõ -> Gemini chỉ nhận câu hỏi hiện tại + function declarations cố định tự chọn tool -> backend registry validate schema/relevance/quyền/giới hạn (không preselect expected tool) -> backend service/repository thực thi với bộ lọc ngữ cảnh -> functionResponse -> {terminal `TOOL` outcome đã xác minh | Gemini final | một retry sửa xưng hô khi cần và còn slot} -> ChatResponseGuard -> lưu customer + assistant message + context rút gọn -> response hiện tại; thẻ Hotline–Zalo–Messenger mở inline trong cùng luồng khi khách bấm Gặp nhân viên`

`search_products -> parser/ràng buộc backend theo CHAT_RULE_015..018 + metadata danh mục/thương hiệu VI/EN hiện hành -> CatalogReadService -> published + sellable + priced -> tối đa 3 cards`; khi tìm hụt đúng tên/model/slug, có đúng một mẫu hỏi có hàng/size/màu hoặc tầm giá không có hàng nhưng có phương án gần nhất, backend tạo terminal `TOOL` answer an toàn; khi cần detail khác, vòng thứ hai duy nhất là `get_product` với slug đã được lượt hiện tại xác minh.

`đơn đã đăng nhập -> CustomerPrincipal từ SecurityContext -> OrderReadService customer summary projection -> chỉ orderNumber/status/placedAt/createdAt/totalAmount/currency -> bản địa hóa backend`; Gemini `get_my_orders` giữ cùng ranh giới khi cần. Guest-order dừng ở local action LOGIN/ORDER_LOOKUP và không chạm order repository.

`lead có consent -> chat_leads + admin notification`; `lead decline -> OFFERED -> DECLINED` không tạo lượt chat. Unknown/invalid/parallel/over-limit tool, tool/DB/provider timeout, response không parse được, safety block, thiếu grounding hoặc final không qua guard là fallback kỹ thuật: giữ `AI`, không trừ lượt và cho hỏi tiếp; availability/config/quota đóng, handoff/off-topic/turn limit giữ `CONTACT` và client khoá composer. Tối đa 2 tool executions/3 provider requests nội bộ tính một daily slot; retry sửa xưng hô duy nhất sau `WRONG_TONE` tính thêm một slot, chỉ chạy khi còn đủ ngân sách và được lưu bằng `ai_retry_count`.

Status: `OWNER_CONFIRMED_2026-08-09`
