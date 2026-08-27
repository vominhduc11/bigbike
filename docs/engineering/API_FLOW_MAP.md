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
| Storefront Trợ lý BigBike | session/history/delete/messages/stream/interactions/leads/handoffs/feedback/realtime-token; cart + assistant-attributions | Visitor/account ownership -> clarity/count policy -> staff-state gate -> verified tools/guard; REST ghi, STOMP chỉ báo/sync; cart revalidate | Memory cùng thiết bị 30 ngày, retention 90 ngày; clarification không tính trần; staff ACTIVE chặn AI; feedback/proactive không gọi AI nền. | `OWNER_CONFIRMED_2026-08-25` |
| Storefront login screen (`/dang-nhap`, `/dang-ky`) | `POST /api/v1/customer/auth/login` (+ `remember`), `POST /register` (+ required privacy agreement), `GET /oauth/{provider}/authorize` + `/callback` | `CustomerAuthController` / `CustomerOAuthController` -> `CustomerAuthService` / `CustomerOAuthService` | Session cookies issued; `remember` drives refresh-cookie lifetime; newly created password/OAuth customers receive one server-recorded Privacy Policy agreement; existing social customers keep normal sign-in | `OWNER_CONFIRMED_2026-08-27` |
| Product review panel | `GET /api/products/{productId}/reviews` qua BFF chỉ-đọc; `POST /api/v1/products/{productId}/reviews` và `/reviews/photos` gọi thẳng API public từ trình duyệt với `credentials: include` | `PublicReviewController` -> `PublicReviewService` | Gửi trực tiếp giữ đúng `bb_session` của host API để backend tự lấy danh tính khách đã đăng nhập, đồng thời giữ IP thật cho hai hạn mức gửi đánh giá/tải ảnh; review mới ở `PENDING`, ảnh upload được claim nguyên tử khi submit và upload bỏ dở được dọn sau 24 giờ (`REVIEW_RULE_007`, `REVIEW_RULE_009`–`REVIEW_RULE_011`) | `CONFIRMED_BACKEND_ENFORCED` |
| Admin media UI | `/api/v1/admin/media`, `/api/v1/admin/media/{id}/download` | `AdminMediaController` -> `AdminMediaService` | Tải lên và quản lý metadata trong MinIO; tải riêng object gốc bằng stream xác thực; không có đường thay file | `CONFIRMED_FROM_CODE` |
| Admin dashboard out-of-stock alert | `GET /api/v1/admin/inventory/summary` | `AdminInventoryController` -> `AdminInventoryService` | Standalone admin inventory screen removed 2026-06-23; only the summary endpoint is still called (by the Dashboard "Hết hàng" alert). Còn/Hết toggled per-variant in the product editor (`products.update`). The orphan `grouped` / `movements` / `PATCH .../availability` / `export.csv` endpoints were deleted 2026-07-15 (AUD-056, owner decision #8). Serial tracking removed V259, quantity model removed V261 | `CONFIRMED_FROM_CODE` |
| Admin product editor live preview | `POST /api/v1/admin/products/preview` | `AdminCatalogController` -> `AdminCatalogMutationService.previewProduct` -> `JpaCatalogReadRepository.mapPreviewProduct` | Dry-run render of the unsaved upsert payload to the public `Product` shape; **no persistence** (`@Transactional(readOnly=true)`); admin embeds the bigbike-web `/preview/product` iframe and postMessages the result | `CONFIRMED_FROM_CODE` |
| Admin AI content brief | Category editor reads the existing category detail/tree plus `GET /api/v1/catalog/facets?category={slug}&lang={lang}`; product editor reads `GET /api/v1/admin/products/{id}` when the preview opens and again at copy time | Existing catalog read services; no new mutation endpoint | The preview performs one read and caches the localized HTML brief for the open panel; copying always refreshes the profile first. Both paths are clipboard/read-only, make no AI call, and write no database data | `OWNER_CONFIRMED_FROM_OWNER_DECISION_2026-08-18` |
| Admin product list CSV export | `ProductListScreen` → export Dialog → `GET /api/v1/admin/products/export.csv` | `ProductListScreen` / `adminApi.exportFullProductCatalogCsv` -> `AdminProductExportController` -> filtered keyset export service | Operator chooses `FILTERED`, `SELECTED`, or explicit `ALL`, status expansion and a column preset; CSV is streamed with UTF-8 BOM and every export records effective scope, filters, columns and row count | `CONFIRMED_FROM_OWNER_DECISION` (2026-08-09) |
| Admin Orders list + CSV | `GET /api/v1/admin/orders`; `GET /api/v1/admin/reports/orders/export` | `AdminOrderController` / `AdminReportController` -> shared order filter specification | List and CSV share `q`/`status`/`from`/`to`; calendar dates use `Asia/Ho_Chi_Minh`. CSV returns every matching order across pages with no 10,000-row cap (`ORDER_RULE_011`/`ORDER_RULE_012`). | `CONFIRMED_FROM_CODE` |
| Admin Customers list/detail + CSV | `GET /api/v1/admin/customers`, `/summary`, `/{customerId}`; `PATCH /{customerId}`, `PATCH /{customerId}/status`, `DELETE /{customerId}/avatar`; `GET /api/v1/admin/reports/customers/export` | `AdminCustomerController` / `AdminReportController` -> `AdminCustomerService` / `AdminCustomerCsvExportService` | List and CSV share `q`/`status`/`synthetic`/`emailVerified`; CSV returns every match without a row cap. Purchase KPIs exclude cancelled orders; registered-account KPIs exclude synthetic rows. Admin profile edits are limited to display name/phone, synthetic status is locked, and a real avatar removal writes an audit event (`CUSTOMER_RULE_004`–`CUSTOMER_RULE_009`). | `CONFIRMED_BACKEND_ENFORCED` |
| Admin live order feed | WebSocket `/ws` + topic `/topic/admin/orders` | `WebSocketConfig` + `AdminOrderWsService` | Admin push notifications after commit | `CONFIRMED_FROM_CODE` |
| Admin vận hành Trợ lý BigBike | conversations/detail/stats/funnel/handoffs/feedback/unanswered/data-gaps + claim/send/return/close + template preview; `/stats` dùng chung cho snapshot Chat và telemetry trong Settings | `AdminChatController` -> chat/handoff/feedback/settings services | Transcript/funnel/handoff/unanswered/data-gap đọc bằng `chat.read`; stats snapshot/telemetry được đọc bằng `chat.read` hoặc `settings.read`; live reply bằng `chat.reply`; data-gap thêm `products.read`; template bằng settings permissions; STOMP dùng broker hiện có | `OWNER_CONFIRMED_2026-08-26` |

## Flow Highlights

### Catalog size scale

`admin product editor -> GET /admin/size-scales -> select sizeScaleId -> product upsert validation -> product.size_scale_id + existing variant options -> public facets/list filter`

Scale and value labels/order/namespace are data-driven. The manager only edits
the scale name, its group and the ordered comma-separated values; technical
metadata is derived on the server. Adding a scale or value does not require
frontend/backend classification code; a product must be explicitly assigned
before its size options can be saved.

Status: `OWNER_CONFIRMED_2026-08-14`

### Admin variant attribute dictionary

`admin product editor -> GET /admin/attributes -> GET /admin/attributes/{id}/values -> select attribute value -> product upsert with attributeValueId`

Every variant attribute uses the same dictionary flow. The editor can create a
new value in place and immediately select it; it never falls back to free-text
values. The backend remains authoritative for the attribute/value relationship,
and rejects an empty, unknown or mismatched dictionary id at the exact option
field. Used values cannot be renamed or deleted, so public variant labels and
filters remain stable.

Status: `OWNER_CONFIRMED_2026-08-24`

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

`login or registration screen -> /oauth/{provider}/authorize -> provider consent -> /oauth/{provider}/callback -> CustomerOAuthService.exchangeCode + linkOrCreate -> CustomerAuthService.createSessionForCustomer -> session cookies -> 302 to storefront`

`linkOrCreate` (CUSTOMER_RULE_010/011): reuse the account matching `(provider, subject)`; else link onto an existing **passwordless** account with a verified matching email (so Google/Facebook can still merge with each other); else create a new active customer only when the registration OAuth state carries `privacyConsent=true` and locale `vi|en`. Missing consent returns the localized registration route without creating a customer or session. A new customer and its `customer_privacy_consents` row commit together. Password accounts are still never adopted, even on a verified email match. Every successful OAuth pass still syncs `display_name`/`avatar_url` from the provider (`syncProfileFromProvider`).

Status: `OWNER_CONFIRMED_2026-08-27`

### Inventory receiving caveat

The `stock_receipts` schema was **dropped in V120** — no receiving flow was ever built. Since V261 inventory is a boolean availability toggle (no quantity, no stock-in); the `stock_movements` ledger is dormant.

Status: `REMOVED`

### Trợ lý BigBike

`widget + pageContext hiện tại -> xác minh PDP để chọn trần 16|20 -> local input guard -> transaction ngắn lưu đầu lượt rồi đóng -> idempotency/khóa đúng conversation -> ghép context cấu trúc + clarification selection -> bộ quyết định độ rõ đếm catalog sống -> trả ngay hoặc hỏi một tiêu chí với tối đa 12 lựa chọn, không quota/AI -> chỉ khi đã rõ mới atomic reserve một slot -> Gemini hiểu ý/chọn dữ liệu ngoài transaction DB -> backend validate từng tool call độc lập -> tối đa 3 tool/4 provider requests -> transaction ngắn lưu final + replay metadata -> guard 10 câu/2.000 ký tự, tối đa 8 card -> backend chuẩn hóa resultKind/action/clarification -> stream chỉ phát ba progress cố định và final đã duyệt; web timeout 75 giây`

`product clarity -> chuẩn hoá/đối chiếu alias với catalog thật -> parser giá giữ 500 k, không ánh xạ chung hong/gt/k -> gộp câu hiện tại với group/need/filter đã biết -> đếm active và in-stock candidate riêng -> unknown group: count + options, không card -> known group trên 8: một câu nhu cầu/filter + tối đa 3 card tiêu biểu -> tối đa 8: kết quả cuối`; context giữ tiêu chí đã trả lời/đã thử và thứ tự nhóm gần nhất qua câu chính sách. Hai cây mũ được hợp/khử trùng chỉ trong assistant. So sánh trực tiếp dùng tối đa ba mẫu. Mọi dữ kiện lịch sử phải tra lại ở lượt hiện tại.

`khách chọn tùy em -> lấy candidate còn hàng -> completed linked order stats trong đúng scope -> đủ >=10 đơn khác nhau và >=2 sản phẩm thì xếp theo units sold -> chưa đủ thì FEATURED_GRID -> không có featured thì gần median effective price -> trả đúng một lựa chọn + căn cứ`; không đọc review, không chọn hàng hết kho và không đổi query popularity chung của storefront.

`list_categories -> CatalogReadService -> nhóm hàng công khai + tổng sản phẩm đang bán của từng nhóm -> functionResponse`; không trả danh sách sản phẩm, giá hoặc tồn kho chi tiết.

`search_articles -> kho nội dung hiện hành -> chỉ PUBLISHED + đúng locale -> tìm title/excerpt/body -> tối đa 3 bài -> bỏ HTML/URL/liên hệ/giá/khuyến mãi/tồn kho/lời hứa/chính sách động/prompt injection -> functionResponse không link`; bài viết chỉ là kiến thức chung, dữ kiện sống vẫn qua catalog/policy.

`đơn đã đăng nhập -> CustomerPrincipal từ SecurityContext -> OrderReadService customer summary projection -> chỉ orderNumber/status/placedAt/createdAt/totalAmount/currency -> bản địa hóa backend`; Gemini `get_my_orders` giữ cùng ranh giới khi cần. Guest-order dừng ở local action LOGIN/ORDER_LOOKUP và không chạm order repository.

`greeting/general request -> BROWSING -> một câu nhu cầu`; `hai mẫu -> CHOOSING -> khác biệt đã xác minh -> một ưu tiên -> chốt một`; `size/stock/final price/delivery/warranty -> DECIDING -> gỡ lo, không mở mẫu`; `own order -> POST_PURCHASE -> order snapshot only`. Stage có thể lùi và được lưu trong context không PII.

`eligible exact-product interest/missing data -> leadOffer(reason, sequence<=2) -> consent -> chat_leads`; greeting/general policy/angry/declined không offer. `Gặp nhân viên -> WAITING -> claim(chat.reply) -> ACTIVE -> STAFF messages -> RETURNED_TO_AI|CLOSED`; assistant chỉ chạy ngoài ACTIVE. `visitor token -> history/sync 30 ngày -> optional login merge current device -> own-history delete`. `assistant message -> helpful/unhelpful reason -> weekly aggregation -> template prefill`. `product/cart dwell + setting on + once/session + not checkout -> local proactive copy`. `product card proof -> live variant revalidate -> cart -> checkout`; mọi retry idempotent, guest proof không cấp quyền đọc chat.

Giai đoạn 4 — Phần A: `Settings -> GET /admin/chat/models -> Gemini models.list bằng account hiện tại -> giao với allowlist stable + price registry theo ngày -> owner PUT model -> site_settings -> request kế tiếp snapshot model`; review moderation tiếp tục đọc key/env riêng. `chat turn -> primary deadline 35s -> success hoặc fallback model nhanh trong trần logical turn 65s/4 provider requests -> guard -> final`; mọi request ghi model yêu cầu/model phục vụ/fallback reason/tokens/latency vào usage ledger. `Admin evaluation -> dataset version đã review + expected facts cố định -> provider adapter ngoài quota khách -> deterministic scorer -> run/results lưu DB -> bảng so sánh`; không AI-as-judge, không A/B khách thật và hard cap 2 USD/run.

Giai đoạn 4 — Phần B: `widget disclosure -> multipart upload -> ownership + feature flag + 1/turn,3/thread,20/day -> Tika MIME + decode/re-encode -> private MinIO -> chat_images PENDING/ATTACHED`; `message(imageId) -> intent/safety vision -> hàng hỏng/hóa đơn/size/ngoài phạm vi dùng nhánh an toàn -> product-search -> dấu vân tay ảnh khách trong-memory so với fingerprint ảnh catalog nội bộ -> chỉ match cụ thể khi hash hoặc score+margin qua ngưỡng -> revalidate PUBLISHED/còn bán -> wording guard “trông giống” -> response`. Vision chỉ được phân loại intent/nhóm, không tự cấp bằng chứng match model. `history/admin detail -> metadata ảnh -> authenticated content endpoint -> private object stream`. `DELETE history|retention job -> mark DELETING -> delete object -> delete/cascade metadata`; object lỗi được retry, không xoá metadata trước làm mất đường dọn rác.

Status: `OWNER_CONFIRMED_2026-08-18`
