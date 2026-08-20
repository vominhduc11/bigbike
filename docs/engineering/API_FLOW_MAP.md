# API Flow Map

## Client To API To Service

| Client surface | Endpoint(s) | Backend entrypoint | Core side effects / data | Status |
|---|---|---|---|---|
| Web search | Kết quả tìm kiếm: trang `/tim-kiem` gọi `GET /api/v1/products`; gợi ý gõ nhanh (dropdown header) gọi `GET /api/v1/search-suggest` qua route `/app/api/search-suggest`. (`GET /api/v1/search` đã gỡ 2026-07-15, AUD-066 — không client nào dùng.) | `PublicSearchController`, `PublicProductController` | Search result payload from global search service | `CONFIRMED_FROM_CODE` |
| Web catalog price filter | Catalog archive pages fetch `GET /api/v1/catalog/facets` without the active price bounds, render the returned dynamic `priceRange` histogram, and fetch `GET /api/v1/products` with exact `min_price`/`max_price` after a slider commit or an explicit `Apply`/`Áp dụng` action. Leaving one numeric box never applies by itself. Mobile edits remain a draft until the sheet's single `View N products` action. The range honors category/search/brand/color/gender/size context and keeps true endpoints stable while the customer drags; the web derives a round, density-aware display scale from the existing histogram and treats its final capped tick as open-ended. Each commit snaps only the handle the customer moved and carries the other committed bound unchanged into the result and URL. | `CatalogController` -> `CatalogReadService` -> `CatalogReadSupport` / catalog repositories | Effective sale price (valid sale below retail, otherwise retail), at most 24 density buckets, dual-handle keyboard/touch slider, exact integer input, bilingual full-number labels, and URL-safe clamp/swap only | `OWNER_CONFIRMED_2026-08-14_REFINED_2026-08-15` |
| Web catalog size filters | Catalog archive pages fetch `GET /api/v1/catalog/facets` with the current category/search/brand/non-size filters, then fetch `GET /api/v1/products` with repeated `kich-co` values. Legacy unqualified values remain accepted. | `CatalogController` -> `CatalogReadService` -> configured size-scale catalog | Four ordered size groups without subgroups and OR-matched product list; size counts exclude the active size dimension but honor the remaining page context | `OWNER_CONFIRMED_2026-08-14` |
| Web catalog filter workspace | The category/all/search/brand pages server-render the exact URL context, then use repeated `pwb-brand`/`filter_color`/`filter_finish`/`kich-co`, scalar gender/price and `in_stock` for later client updates. Desktop debounces one product+facet pair; while the mobile full-screen sheet is open only facets refresh until the customer applies. | `CatalogController` -> `CatalogReadService` -> visual-facet configuration + catalog/order repositories | OR inside a facet, AND across facets; canonical colors and finishes; descendant-aware category counts; exact `resultCount`; real best-selling order; no unfiltered-to-filtered content flash | `OWNER_CONFIRMED_2026-08-15` |
| Admin size-scale manager | Product editor opens the manager, reads `GET /api/v1/admin/size-scale-groups` and `GET /api/v1/admin/size-scales`, then creates/updates one scale with `POST/PATCH /api/v1/admin/size-scales` using `{ name, groupId, values[] }`. | `AdminSizeScaleController` -> `AdminSizeScaleService` -> size-scale repositories | Server derives technical metadata, validates duplicates and usage conflicts, and preserves product-to-scale links | `OWNER_CONFIRMED_2026-08-14` |
| Tin tức list page (`/tin-tuc`, `/en/tin-tuc`) | `GET /api/v1/articles` | `ContentController` -> `ContentReadService` | Paginated article list; content-category filter/sidebar/drawer no longer exists | `CONFIRMED_FROM_OWNER_DECISION` (2026-08-03) |
| Địa chỉ VN (storefront) | không gọi API — dùng dữ liệu tích hợp sẵn `VN_PROVINCES` (`vn-address-data.ts`, hai cấp tỉnh/thành → phường/xã). Backend API `GET /api/v1/address/provinces[...]` đã gỡ 2026-07-15 (AUD-056, owner decision #8 — không có caller). | — | Không có side effect | `REMOVED` |
| Cart UI | `/api/v1/cart`, `/api/v1/cart/items` | `CartController` -> `CartService` | Session/customer cart, item snapshots | `CONFIRMED_FROM_CODE` |
| Checkout UI | `POST /api/v1/checkout` | `CheckoutController` -> `CheckoutService` | Order/payment/shipping snapshots, per-variant `isAvailable` gate (no quantity decrement, V261), notifications, WS event | `CONFIRMED_FROM_CODE` |
| Customer address UI | `/api/v1/customer/addresses` | `CustomerAddressController` -> `CustomerAddressService` | Own-address CRUD | `CONFIRMED_FROM_CODE` |
| Customer orders UI | `/api/v1/customer/orders` | `CustomerOrderController` -> `OrderReadService` | Own order list/detail | `CONFIRMED_FROM_CODE` |
| Storefront Trợ lý BigBike | `GET /api/v1/chat/availability`; `POST /api/v1/chat/messages`; `POST /api/v1/chat/messages/stream`; `POST /api/v1/chat/leads`; `POST /api/v1/cart/items` | `ChatController` -> local input guard -> `ChatService` -> `ChatToolService` -> `AiChatClient`; cart attribution qua `CartService` | Lưu chat tối đa 90 ngày; snapshot web tối đa 24 giờ giữ `conversationId` và `requestId`. Stream chỉ phát progress code cố định rồi final đã kiểm duyệt. Tối đa 8 thẻ; chọn biến thể/thêm giỏ trong chat. Lead vẫn cần consent. | `OWNER_CONFIRMED_2026-08-18` |
| Storefront login screen (`/dang-nhap`, `/dang-ky`) | `POST /api/v1/customer/auth/login` (+ `remember`), `POST /register`, `GET /oauth/{provider}/authorize` + `/callback` | `CustomerAuthController` / `CustomerOAuthController` -> `CustomerAuthService` / `CustomerOAuthService` | Session cookies issued; `remember` drives refresh-cookie lifetime; OAuth links-or-creates the customer | `CONFIRMED_FROM_CODE` |
| Product review panel | `GET /api/products/{productId}/reviews` qua BFF chỉ-đọc; `POST /api/v1/products/{productId}/reviews` và `/reviews/photos` gọi thẳng API public từ trình duyệt với `credentials: include` | `PublicReviewController` -> `PublicReviewService` | Gửi trực tiếp giữ đúng `bb_session` của host API để backend tự lấy danh tính khách đã đăng nhập, đồng thời giữ IP thật cho hai hạn mức gửi đánh giá/tải ảnh; review mới ở `PENDING`, ảnh upload được claim nguyên tử khi submit và upload bỏ dở được dọn sau 24 giờ (`REVIEW_RULE_007`, `REVIEW_RULE_009`–`REVIEW_RULE_011`) | `CONFIRMED_BACKEND_ENFORCED` |
| Admin media UI | `/api/v1/admin/media`, `/api/v1/admin/media/{id}/download` | `AdminMediaController` -> `AdminMediaService` | Tải lên và quản lý metadata trong MinIO; tải riêng object gốc bằng stream xác thực; không có đường thay file | `CONFIRMED_FROM_CODE` |
| Admin dashboard out-of-stock alert | `GET /api/v1/admin/inventory/summary` | `AdminInventoryController` -> `AdminInventoryService` | Standalone admin inventory screen removed 2026-06-23; only the summary endpoint is still called (by the Dashboard "Hết hàng" alert). Còn/Hết toggled per-variant in the product editor (`products.update`). The orphan `grouped` / `movements` / `PATCH .../availability` / `export.csv` endpoints were deleted 2026-07-15 (AUD-056, owner decision #8). Serial tracking removed V259, quantity model removed V261 | `CONFIRMED_FROM_CODE` |
| Admin product editor live preview | `POST /api/v1/admin/products/preview` | `AdminCatalogController` -> `AdminCatalogMutationService.previewProduct` -> `JpaCatalogReadRepository.mapPreviewProduct` | Dry-run render of the unsaved upsert payload to the public `Product` shape; **no persistence** (`@Transactional(readOnly=true)`); admin embeds the bigbike-web `/preview/product` iframe and postMessages the result | `CONFIRMED_FROM_CODE` |
| Admin AI content brief | Category editor reads the existing category detail/tree plus `GET /api/v1/catalog/facets?category={slug}&lang={lang}`; product editor reads `GET /api/v1/admin/products/{id}` when the preview opens and again at copy time | Existing catalog read services; no new mutation endpoint | The preview performs one read and caches the localized HTML brief for the open panel; copying always refreshes the profile first. Both paths are clipboard/read-only, make no AI call, and write no database data | `OWNER_CONFIRMED_FROM_OWNER_DECISION_2026-08-18` |
| Admin product list CSV export | `ProductListScreen` → export Dialog → `GET /api/v1/admin/products/export.csv` | `ProductListScreen` / `adminApi.exportFullProductCatalogCsv` -> `AdminProductExportController` -> filtered keyset export service | Operator chooses `FILTERED`, `SELECTED`, or explicit `ALL`, status expansion and a column preset; CSV is streamed with UTF-8 BOM and every export records effective scope, filters, columns and row count | `CONFIRMED_FROM_OWNER_DECISION` (2026-08-09) |
| Admin Orders list + CSV | `GET /api/v1/admin/orders`; `GET /api/v1/admin/reports/orders/export` | `AdminOrderController` / `AdminReportController` -> shared order filter specification | List and CSV share `q`/`status`/`from`/`to`; calendar dates use `Asia/Ho_Chi_Minh`. CSV returns every matching order across pages with no 10,000-row cap (`ORDER_RULE_011`/`ORDER_RULE_012`). | `CONFIRMED_FROM_CODE` |
| Admin Customers list/detail + CSV | `GET /api/v1/admin/customers`, `/summary`, `/{customerId}`; `PATCH /{customerId}`, `PATCH /{customerId}/status`, `DELETE /{customerId}/avatar`; `GET /api/v1/admin/reports/customers/export` | `AdminCustomerController` / `AdminReportController` -> `AdminCustomerService` / `AdminCustomerCsvExportService` | List and CSV share `q`/`status`/`synthetic`/`emailVerified`; CSV returns every match without a row cap. Purchase KPIs exclude cancelled orders; registered-account KPIs exclude synthetic rows. Admin profile edits are limited to display name/phone, synthetic status is locked, and a real avatar removal writes an audit event (`CUSTOMER_RULE_004`–`CUSTOMER_RULE_009`). | `CONFIRMED_BACKEND_ENFORCED` |
| Admin live order feed | WebSocket `/ws` + topic `/topic/admin/orders` | `WebSocketConfig` + `AdminOrderWsService` | Admin push notifications after commit | `CONFIRMED_FROM_CODE` |
| Admin lịch sử Trợ lý BigBike | `GET /api/v1/admin/chat/conversations`, `/{id}`, `/stats` | `AdminChatController` -> `AdminChatService` | Chỉ đọc, `chat.read`; thêm token, chi phí, độ trễ, từ chối nội dung, đơn và doanh thu hỗ trợ; telemetry dữ liệu cũ nullable | `OWNER_CONFIRMED_2026-08-18` |

## Flow Highlights

### Catalog size scale

`admin product editor -> GET /admin/size-scales -> select sizeScaleId -> product upsert validation -> product.size_scale_id + existing variant options -> public facets/list filter`

Scale and value labels/order/namespace are data-driven. The manager only edits
the scale name, its group and the ordered comma-separated values; technical
metadata is derived on the server. Adding a scale or value does not require
frontend/backend classification code; a product must be explicitly assigned
before its size options can be saved.

Status: `OWNER_CONFIRMED_2026-08-14`

### Catalog filters

`request URL -> server page parses exact context -> products + facets fetched for the same key -> desktop chips/sidebar or mobile draft sheet -> 250 ms coalescing -> native history update -> refreshed products/facets`

Color/finish aliases are resolved through configuration data. Direct legacy
color URLs remain valid and are normalized to base-color keys. Base canonical
and nofollow behavior do not change; filtered URLs are never added to sitemap
or opened for indexing.

Status: `OWNER_CONFIRMED_2026-08-20`

### Legacy URL and history catalog

`old URL -> bigbike-web/proxy.ts -> active redirect snapshot (fallback: single lookup) ->
301/410 or locale route -> exact lookup in admin-managed legacy_discontinued_products (or a
PUBLISHED product with discontinued=true) -> bilingual history page + 4–8 ranked active
suggestions (same brand, then same product kind, then same/parent category or popularity
fallback)`

The redirect table remains the source of truth for 301/410 rules. History entries are
persisted and operated in Admin, never a static `/sp/` source registry. A legacy-only entry
renders the history layout; a matching `PUBLISHED + discontinued=true` product keeps its
existing PDP content and replaces only the purchase area with a discontinued status panel.
The 4–8 suggestion ranking, no-image single-column layout, breadcrumb/brand links, trust
strip, Zalo contact and bottom safety note are owner display decisions from 2026-08-18;
the owner removed the discontinued-page inline search on 2026-08-20. These display
decisions do not change API shape, URL, catalog exclusion or redirect behavior.

Status: `OWNER_CONFIRMED_2026-08-15`

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

### Trợ lý BigBike

`widget + pageContext hiện tại -> xác minh PDP để chọn trần 12|20 -> local input guard trước quota -> idempotency theo requestId -> khóa đúng conversation -> context không PII + tối đa 12 cặp lịch sử đã che/cắt -> atomic reserve một slot nếu cần AI -> Gemini hiểu ý/chọn dữ liệu với thinking budget 1.024 -> backend validate tool/argument/slug/quyền -> tối đa 3 tool song song/nối tiếp và 4 provider requests -> final không thinking, tối đa 2.048 output token -> guard Markdown giới hạn, 10 câu/2.000 ký tự, tối đa 8 card -> backend chuẩn hóa resultKind + chọn action cố định -> lưu một cặp message + telemetry -> stream chỉ phát ba progress cố định và final đã duyệt; web timeout 75 giây`

`search_products -> chuẩn hoá/đối chiếu alias với catalog thật -> parser giá giữ 500 k, không ánh xạ chung hong/gt/k -> CatalogReadService -> published + sellable + priced -> tối đa 8 sản phẩm`; context giữ thứ tự nhóm gần nhất qua câu chính sách, còn so sánh trực tiếp dùng tối đa ba mẫu. Mọi dữ kiện lịch sử phải tra lại ở lượt hiện tại.

`list_categories -> CatalogReadService -> nhóm hàng công khai + tổng sản phẩm đang bán của từng nhóm -> functionResponse`; không trả danh sách sản phẩm, giá hoặc tồn kho chi tiết.

`search_articles -> kho nội dung hiện hành -> chỉ PUBLISHED + đúng locale -> tìm title/excerpt/body -> tối đa 3 bài -> bỏ HTML/URL/liên hệ/giá/khuyến mãi/tồn kho/lời hứa/chính sách động/prompt injection -> functionResponse không link`; bài viết chỉ là kiến thức chung, dữ kiện sống vẫn qua catalog/policy.

`đơn đã đăng nhập -> CustomerPrincipal từ SecurityContext -> OrderReadService customer summary projection -> chỉ orderNumber/status/placedAt/createdAt/totalAmount/currency -> bản địa hóa backend`; Gemini `get_my_orders` giữ cùng ranh giới khi cần. Guest-order dừng ở local action LOGIN/ORDER_LOOKUP và không chạm order repository.

`assistant response đủ điều kiện -> leadPromptSequence=1 -> storefront render -> interaction LEAD_PROMPT_VIEWED`; nếu ignored và lượt sau hỏi size/stock đúng một mẫu hoặc add cart từ chat thì `sequence=2`; `accept -> chat_leads + admin notification`, `decline -> terminal không PII`. `action click -> idempotent interaction -> originInteractionId trên lượt tiếp -> assistant response/product card -> assistantInteractionId khi add cart -> checkout -> attribution action type + revenue`; mọi bước đều xác minh conversation/message/action/product. `local refusal -> OUT_OF_SCOPE|CONTENT_REFUSAL|ROLE_DEFENSE, không quota`; `Gemini safety block -> CONTENT_REFUSAL`; lỗi tạm provider retry một lần trong trần 4 request. Cleanup chat đặt liên kết nullable nhưng giữ action type và số tiền báo cáo.

Status: `OWNER_CONFIRMED_2026-08-18`
