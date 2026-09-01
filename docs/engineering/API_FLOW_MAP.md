# API Flow Map

## Client To API To Service

| Client surface | Endpoint(s) | Backend entrypoint | Core side effects / data | Status |
|---|---|---|---|---|
| Admin topbar quick search | `GlobalSearch` → `GET /api/v1/admin/quick-search?q=...`; selecting a row opens the existing detail route, and “Xem tất cả” opens the corresponding list with `?search=...` | `AdminQuickSearchController` → `AdminQuickSearchService` → order/customer/catalog/content/admin-user read repositories | Read-only, permission-scoped groups; accent-insensitive staff search, exact/prefix/contains ranking, five preview rows plus exact group totals, compact matching variant metadata, isolated group errors | `OWNER_CONFIRMED_FROM_HANDOFF_2026-08-28` |
| Web search | Kết quả tìm kiếm: trang `/tim-kiem` gọi cùng lúc `GET /api/v1/products?q=...&sort=relevance` và `GET /api/v1/articles?q=...`; gợi ý gõ nhanh (dropdown header) gọi `GET /api/v1/search-suggest` qua route `/app/api/search-suggest`. Cả hai bề mặt dùng một quy tắc sản phẩm về phạm vi, ranh giới từ, độ bao phủ và thứ tự; bài viết bỏ dấu và coi ký tự wildcard là ký tự thường. (`GET /api/v1/search` đã gỡ 2026-07-15, AUD-066 — không client nào dùng.) | `PublicSearchController`, `PublicProductController`, `ContentController` | Search result payload from global search service and public catalog/content reads | `OWNER_CONFIRMED_2026-08-30` |
| Web header category menu | `GET /api/v1/menus/primary?lang=vi|en` | `PublicMenuController` → `AdminMenuService` | Mục danh mục cấp 1 lấy `iconUrl` từ `category.image` và storefront tô theo màu chữ trong khung 24×24px; cấp 2/cấp 3 hoặc danh mục thiếu ảnh không có icon nhưng vẫn giữ mục menu. Cập nhật danh mục làm mới cache `menus`; không còn fallback theo đường dẫn WordPress cũ. | `OWNER_CONFIRMED_2026-08-29` |
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
| Storefront Trợ lý BigBike | session/history/delete/messages/stream/images; cart thường | Visitor/account ownership -> clarity/count policy -> verified tools/guard; REST ghi; cart revalidate | Nhớ cùng thiết bị 30 ngày, retention 90 ngày; clarification không tính trần; 40 lượt mở hội thoại nối tiếp. Mỗi lượt AI dùng Gemini 3.7 Flash, lỗi chỉ thử lại chính model rồi mở các kênh liên hệ trực tiếp. | `OWNER_CONFIRMED_2026-08-30` |
| Storefront authentication screens (`/dang-nhap`, `/dang-ky`, `/quen-mat-khau`, `/xac-nhan-email`) | Login/registration retain `POST /api/v1/customer/auth/login` (+ `remember`), `POST /register` (+ required privacy agreement), `GET /oauth/{provider}/authorize` + `/callback`; reset and verification retain their existing auth calls. The guest exit is client-only and makes no API call. | `CustomerAuthController` / `CustomerOAuthController` -> `CustomerAuthService` / `CustomerOAuthService` | Session cookies issued; `remember` drives refresh-cookie lifetime; newly created password/OAuth customers receive one server-recorded Privacy Policy agreement; existing social customers keep normal sign-in. A guest exit accepts only an internal safe public `tiep`; account, authentication, missing or unsafe/external destinations resolve to localized home. | `OWNER_CONFIRMED_2026-08-30` |
| Product review panel | `GET /api/products/{productId}/reviews` qua BFF chỉ-đọc; `POST /api/v1/products/{productId}/reviews` và `/reviews/photos` gọi thẳng API public từ trình duyệt với `credentials: include` | `PublicReviewController` -> `PublicReviewService` | Gửi trực tiếp giữ đúng `bb_session` của host API để backend tự lấy danh tính khách đã đăng nhập, đồng thời giữ IP thật cho hai hạn mức gửi đánh giá/tải ảnh; review mới ở `PENDING`, ảnh upload được claim nguyên tử khi submit và upload bỏ dở được dọn sau 24 giờ (`REVIEW_RULE_007`, `REVIEW_RULE_009`–`REVIEW_RULE_011`) | `CONFIRMED_BACKEND_ENFORCED` |
| Post-purchase review invitation | Checkout gửi thêm `locale=vi|en`; email dùng link fragment tới đúng PDP; form gửi `inviteToken` ẩn trong `POST /api/v1/products/{productId}/reviews`; trang từ chối gọi `POST /api/v1/review-invitations/unsubscribe`; không có mặt quản trị | `ReviewInvitationScheduler` / `ReviewInvitationService` / public invitation controller; `PublicReviewService` | Scheduler tự mở cutoff ở callback đầu tiên sau deploy; delay cố định 7 ngày, queue 04:30, một lần thử/10 phút 09:00–20:50, quota ngày nguyên tử 20, một thư/đơn, mã chỉ lưu bản băm, review vẫn `PENDING`, opt-out vĩnh viễn (`REVIEW_RULE_014`–`016`) | `OWNER_CONFIRMED_2026-09-01` |
| Admin Brand logo | Brand form dùng `GET /api/v1/admin/brands/{id}`/`GET /api/v1/admin/brands`, chọn media qua `/api/v1/admin/media` và `/api/v1/admin/media/{id}/download`, hoặc nhập URL qua `POST /api/v1/admin/brands/logo/import-url`; sau khi admin xác nhận vùng cắt thì `POST/PATCH /api/v1/admin/brands` gửi URL nội bộ + `logo.mediaId` | `AdminCatalogController` / `AdminMediaController` -> `BrandLogoValidationService` + `BrandMutationService` / `AdminMediaService` | Non-square source mở crop 1:1 phía admin; server xác minh JPEG/PNG/WebP, tối thiểu 400×400 và tỉ lệ ±1% trên object MinIO cuối, không áp trần dung lượng riêng của logo. Transparency chỉ là cảnh báo; URL ngoài không được lưu trực tiếp; nguồn URL bị giới hạn 10 MB và vẫn qua SSRF/redirect checks. Logo legacy vẫn đọc/sửa các field khác, quality chỉ cảnh báo | `OWNER_CONFIRMED_2026-08-29` |
| Admin media UI | `/api/v1/admin/media`, `/api/v1/admin/media/{id}/download` | `AdminMediaController` -> `AdminMediaService` | Tải lên và quản lý metadata trong MinIO; tải riêng object gốc bằng stream xác thực; không có đường thay file | `CONFIRMED_FROM_CODE` |
| Admin dashboard out-of-stock alert | `GET /api/v1/admin/inventory/summary` | `AdminInventoryController` -> `AdminInventoryService` | Standalone admin inventory screen removed 2026-06-23; only the summary endpoint is still called (by the Dashboard "Hết hàng" alert). Còn/Hết toggled per-variant in the product editor (`products.update`). The orphan `grouped` / `movements` / `PATCH .../availability` / `export.csv` endpoints were deleted 2026-07-15 (AUD-056, owner decision #8). Serial tracking removed V259, quantity model removed V261 | `CONFIRMED_FROM_CODE` |
| Admin product editor live preview | `POST /api/v1/admin/products/preview` | `AdminCatalogController` -> `AdminCatalogMutationService.previewProduct` -> `JpaCatalogReadRepository.mapPreviewProduct` | Dry-run render of the unsaved upsert payload to the public `Product` shape; **no persistence** (`@Transactional(readOnly=true)`); admin embeds the bigbike-web `/preview/product` iframe and postMessages the result | `CONFIRMED_FROM_CODE` |
| Admin AI content brief | Category editor reads the existing category detail/tree plus `GET /api/v1/catalog/facets?category={slug}&lang={lang}`; product editor reads `GET /api/v1/admin/products/{id}` when the preview opens and again at copy time | Existing catalog read services; no new mutation endpoint | The preview performs one read and caches the localized HTML brief for the open panel; copying always refreshes the profile first. Both paths are clipboard/read-only, make no AI call, and write no database data | `OWNER_CONFIRMED_FROM_OWNER_DECISION_2026-08-18` |
| Admin product list CSV export | `ProductListScreen` → export Dialog → `GET /api/v1/admin/products/export.csv` | `ProductListScreen` / `adminApi.exportFullProductCatalogCsv` -> `AdminProductExportController` -> filtered keyset export service | Operator chooses `FILTERED`, `SELECTED`, or explicit `ALL`, status expansion and a column preset; CSV is streamed with UTF-8 BOM and every export records effective scope, filters, columns and row count | `CONFIRMED_FROM_OWNER_DECISION` (2026-08-09) |
| Admin Orders list + CSV | `GET /api/v1/admin/orders`; `GET /api/v1/admin/reports/orders/export` | `AdminOrderController` / `AdminReportController` -> shared order/history filter specification | List and CSV share `q`/`status`/`from`/`to`/`orderScope`/`attention`; calendar dates use `Asia/Ho_Chi_Minh`. UI defaults Operational, API defaults All; historical rows remain searchable/read-only and CSV is uncapped with explicit scope columns (`ORDER_RULE_011`–`015`). | `OWNER_CONFIRMED_2026-08-31` |
| Admin Customers list/detail + CSV | `GET /api/v1/admin/customers`, `/summary`, `/{customerId}`; `PATCH /{customerId}`, `PATCH /{customerId}/status`, `DELETE /{customerId}/avatar`; `GET /api/v1/admin/reports/customers/export` | `AdminCustomerController` / `AdminReportController` -> `AdminCustomerService` / `AdminCustomerCsvExportService` | List and CSV share `q`/`status`/`synthetic`/`emailVerified`; CSV returns every match without a row cap. Purchase KPIs exclude cancelled orders; registered-account KPIs exclude synthetic rows. Admin profile edits are limited to display name/phone, synthetic status is locked, and a real avatar removal writes an audit event (`CUSTOMER_RULE_004`–`CUSTOMER_RULE_009`). | `CONFIRMED_BACKEND_ENFORCED` |
| Admin live order feed | WebSocket `/ws` + topic `/topic/admin/orders` | `WebSocketConfig` + `AdminOrderWsService` | Admin push notifications after commit | `CONFIRMED_FROM_CODE` |
| Admin notification catch-up and unread badge | `GET /api/v1/admin/notifications` on load plus WebSocket `/topic/admin/orders` or `/topic/admin/inventory`; `POST /api/v1/admin/notifications/mark-all-read` when the bell opens | `AdminNotificationController` -> `AdminNotificationService` -> per-admin read marker repository | Permission-scoped recent backlog (≤50), exact server `unreadCount`, per-admin read state; order rows need `orders.read`, daily stock digest rows need `inventory.read`; six-month retention remains shared | `OWNER_CONFIRMED_2026-08-31` |
| Daily overdue-order digest | Stored private `order_overdue_days` (owner-fixed effective value `2`; no Settings editor) → 04:20 Vietnam scheduler → active operational PENDING query → one run/date + one reminder/order ledgers → one `ORDER_OVERDUE_DIGEST` notification | `OrderOverdueReminderScheduler` -> `OrderOverdueReminderService` -> order/history/notification repositories | No active history batch, invalid stored setting or empty result is silent; one digest/day, each order once, no PII/list payload, click opens the exact overdue operational filter | `OWNER_CONFIRMED_2026-09-01` |
| Daily out-of-stock digest | Existing private settings keys → minute scheduler at configured Vietnam time → published/non-discontinued product snapshot → one daily run ledger → `admin_notifications` + `/topic/admin/inventory` refresh event + existing internal mail path | `InventoryOutOfStockDigestScheduler` -> digest/coordinator/email services | Silent on empty/disabled; a notified day carries two complete bilingual sections and direct product edit links; SMTP is claimed at most once per date and does not fan out | `OWNER_CONFIRMED_2026-08-31` |
| Admin vận hành Trợ lý BigBike | conversations/detail/stats/images; Settings giữ quota/cách nói tự nhiên/nhớ gần nhất | `AdminChatController` -> chat/settings services | Transcript, ảnh và thống kê đọc bằng `chat.read`; không có hàng chờ, live reply hoặc chat realtime. Không có model/evaluation/cost/lead/feedback/attribution/report phụ. | `OWNER_CONFIRMED_2026-08-30` |
| Video YouTube trang chủ tự động | `youtube_url` được đọc/ghi ngay trên màn Video trang chủ qua Settings API hiện có; storefront đọc `GET /api/v1/home-videos?lang=vi|en` | `HomeVideoSyncScheduler` → `YouTubeHomeVideoClient` → `YouTubeHomeVideoSyncService` → `HomeVideoJpaRepository` | 04:10 giờ Việt Nam: đọc đúng feed kênh, chống trùng toàn kho, thêm mới lên đầu, rút video đã xoá/ẩn, public tối đa 10; lỗi ngoài là no-op và chỉ sau commit mới revalidate `home-videos` | `OWNER_CONFIRMED_2026-08-31` |

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

`widget + pageContext -> ownership/idempotency -> local safety + clarity/fast-path -> short transaction -> nếu cần AI: atomic reserve 1 slot daily -> Gemini 3.7 Flash -> verified tool calls/guard -> short transaction lưu final -> response/stream progress`

Một logical turn tối đa bốn provider calls trong 65 giây. Timeout/quá tải/`429`/`5xx`/network/payload không hợp lệ chỉ thử lại chính Gemini 3.7 Flash. Không có model fallback; thất bại cuối trả lời lịch sự và mở các kênh liên hệ trực tiếp Hotline/Zalo/Messenger. Retry không giữ quota lần hai; fast-path/clarification/an toàn không giữ quota.

`AI response -> direct contact card`. Khách không tạo handoff, hàng chờ hoặc tin nhắn nhân viên; bấm Hotline/Zalo/Messenger chỉ mở thẻ liên hệ và không gọi API. Trần 40 lượt mở hội thoại nối tiếp. REST history là nguồn đọc chuẩn; không còn luồng STOMP cho chat khách.

`visitor token -> nhớ 30 ngày hoặc session-only khi tắt -> history/reconnect -> optional login merge current device -> own-history delete`. Không fingerprint/IP, lead form, proactive, feedback hoặc proof gắn đơn.

`product card -> live variant revalidate -> cart thường -> checkout`. Chat không ghi nguồn đơn hay doanh thu; backend vẫn hậu kiểm giá/tồn/biến thể như mọi lần thêm giỏ.

`widget disclosure -> multipart upload -> ownership + AI service availability + 1/turn,3/thread,20/day -> MIME/decode/re-encode -> private MinIO -> PENDING/ATTACHED -> Gemini 3.7 Flash phân loại intent -> verified catalog fingerprint matching -> wording “trông giống” -> response`. Xóa history/retention xóa object trước metadata; không có nhánh chuyển ảnh cho nhân viên.

Status: `OWNER_CONFIRMED_2026-08-29`
