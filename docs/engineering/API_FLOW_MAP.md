# API Flow Map

## Client To API To Service

| Client surface | Endpoint(s) | Backend entrypoint | Core side effects / data | Status |
|---|---|---|---|---|
| Web search | Kết quả tìm kiếm: trang `/tim-kiem` gọi `GET /api/v1/products`; gợi ý gõ nhanh (dropdown header) gọi `GET /api/v1/search-suggest` qua route `/app/api/search-suggest`. (`GET /api/v1/search` đã gỡ 2026-07-15, AUD-066 — không client nào dùng.) | `PublicSearchController`, `PublicProductController` | Search result payload from global search service | `CONFIRMED_FROM_CODE` |
| Tin tức list page (`/tin-tuc`) | `GET /api/v1/articles`, `GET /api/v1/content-categories` | `ContentController` -> `ContentReadService` | Paginated article list + content categories with published-article counts for the category filter (desktop sidebar + mobile drawer) | `CONFIRMED_FROM_CODE` |
| Địa chỉ VN (storefront) | không gọi API — dùng dữ liệu tích hợp sẵn `VN_PROVINCES` (`vn-address-data.ts`, hai cấp tỉnh/thành → phường/xã). Backend API `GET /api/v1/address/provinces[...]` đã gỡ 2026-07-15 (AUD-056, owner decision #8 — không có caller). | — | Không có side effect | `REMOVED` |
| Cart UI | `/api/v1/cart`, `/api/v1/cart/items` | `CartController` -> `CartService` | Session/customer cart, item snapshots | `CONFIRMED_FROM_CODE` |
| Checkout UI | `POST /api/v1/checkout` | `CheckoutController` -> `CheckoutService` | Order/payment/shipping snapshots, per-variant `isAvailable` gate (no quantity decrement, V261), notifications, WS event | `CONFIRMED_FROM_CODE` |
| Customer address UI | `/api/v1/customer/addresses` | `CustomerAddressController` -> `CustomerAddressService` | Own-address CRUD | `CONFIRMED_FROM_CODE` |
| Customer orders UI | `/api/v1/customer/orders` | `CustomerOrderController` -> `OrderReadService` | Own order list/detail | `CONFIRMED_FROM_CODE` |
| Storefront login screen (`/dang-nhap`, `/dang-ky`) | `POST /api/v1/customer/auth/login` (+ `remember`), `POST /register`, `GET /oauth/{provider}/authorize` + `/callback` | `CustomerAuthController` / `CustomerOAuthController` -> `CustomerAuthService` / `CustomerOAuthService` | Session cookies issued; `remember` drives refresh-cookie lifetime; OAuth links-or-creates the customer | `CONFIRMED_FROM_CODE` |
| Admin media UI | `/api/v1/admin/media` | `AdminMediaController` -> `AdminMediaService` | Tika validation, MinIO storage, metadata persistence | `CONFIRMED_FROM_CODE` |
| Admin dashboard out-of-stock alert | `GET /api/v1/admin/inventory/summary` | `AdminInventoryController` -> `AdminInventoryService` | Standalone admin inventory screen removed 2026-06-23; only the summary endpoint is still called (by the Dashboard "Hết hàng" alert). Còn/Hết toggled per-variant in the product editor (`products.update`). The orphan `grouped` / `movements` / `PATCH .../availability` / `export.csv` endpoints were deleted 2026-07-15 (AUD-056, owner decision #8). Serial tracking removed V259, quantity model removed V261 | `CONFIRMED_FROM_CODE` |
| Admin product editor live preview | `POST /api/v1/admin/products/preview` | `AdminCatalogController` -> `AdminCatalogMutationService.previewProduct` -> `JpaCatalogReadRepository.mapPreviewProduct` | Dry-run render of the unsaved upsert payload to the public `Product` shape; **no persistence** (`@Transactional(readOnly=true)`); admin embeds the bigbike-web `/preview/product` iframe and postMessages the result | `CONFIRMED_FROM_CODE` |
| Admin live order feed | WebSocket `/ws` + topic `/topic/admin/orders` | `WebSocketConfig` + `AdminOrderWsService` | Admin push notifications after commit | `CONFIRMED_FROM_CODE` |

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

`linkOrCreate`: reuse the account matching `(oauth_provider, oauth_subject)`; else link onto an existing account with a verified matching email; else create a new active customer.

Status: `CONFIRMED_FROM_CODE`

### Inventory receiving caveat

The `stock_receipts` schema was **dropped in V120** — no receiving flow was ever built. Since V261 inventory is a boolean availability toggle (no quantity, no stock-in); the `stock_movements` ledger is dormant.

Status: `REMOVED`
