# API Contract

This document is the human-readable companion to `bigbike-backend/src/main/resources/openapi/bigbike-openapi.json`.

## Governance

- Canonical contract sources for active work:
  1. controller/service/config/test evidence
  2. this document
  3. checked-in OpenAPI companion
- If OpenAPI and controllers drift, controllers and current tests are the verification source until docs are repaired.

## Auth Models

| Model | Used by | Current contract | Status | Evidence |
|---|---|---|---|---|
| Admin JWT | Admin REST APIs | `Authorization: Bearer <token>` | `CONFIRMED_FROM_CODE` | `SecurityConfig.java`, admin controllers |
| Customer session cookie | Customer account/order/address APIs | `bb_session` cookie | `CONFIRMED_FROM_CODE` | `SecurityConfig.java`, `CustomerSessionFilter.java` |
| CSRF header | Customer/guest cart and checkout mutations | `X-CSRF-Token` must match `bb_csrf` cookie | `CONFIRMED_FROM_CODE` | `CustomerCsrfFilter.java`, tests |
| Admin WebSocket JWT | STOMP CONNECT to `/ws` | native header `Authorization: Bearer <token>` | `CONFIRMED_FROM_CODE` | `WebSocketConfig.java`, `adminWebSocket.js` |

## Public And Customer Endpoints

| Method | Path | Current purpose | Response shape | Status | Evidence |
|---|---|---|---|---|---|
| `GET` | `/api/v1/search` | Cross-domain search for products/articles | `ApiDataResponse<SearchPayload>` | `CONFIRMED_FROM_CODE` | `PublicSearchController.java` |
| `GET` | `/api/v1/search-suggest` | Lightweight typeahead product suggestions | `ApiDataResponse<SearchPayload>` | `CONFIRMED_FROM_CODE` | `PublicSearchController.java` |
| `GET` | `/api/v1/address/provinces` | List provinces | `ApiDataResponse<List<VnAddressItem>>` | `CONFIRMED_FROM_CODE` | `VnAddressController.java` |
| `GET` | `/api/v1/address/provinces/{provinceCode}/districts` | List districts by province code | `ApiDataResponse<List<VnAddressItem>>` | `CONFIRMED_FROM_CODE` | `VnAddressController.java` |
| `GET` | `/api/v1/address/districts/{districtCode}/wards` | List wards by district code | `ApiDataResponse<List<VnAddressItem>>` | `CONFIRMED_FROM_CODE` | `VnAddressController.java` |
| `POST` | `/api/v1/contact` | Submit contact form | `ApiDataResponse<Void>` with HTTP `201` | `CONFIRMED_FROM_CODE` | `ContactController.java` |
| `POST` | `/api/v1/customer/auth/verify-email` | Verify email token from request param | `ApiDataResponse<{verified:true}>` | `CONFIRMED_FROM_CODE` | `CustomerAuthController.java` |
| `POST` | `/api/v1/customer/auth/resend-verification` | Resend the email-verification message for the authenticated customer | `ApiDataResponse<Map<String,Object>>` | `CONFIRMED_FROM_CODE` | `CustomerAuthController.java` |
| `GET` | `/api/v1/customer/addresses` | List own addresses | `ApiDataResponse<List<CustomerAddressResponse>>` | `CONFIRMED_FROM_CODE` | `CustomerAddressController.java` |
| `POST` | `/api/v1/customer/addresses` | Create own address | `ApiDataResponse<CustomerAddressResponse>` with HTTP `201` | `CONFIRMED_FROM_CODE` | `CustomerAddressController.java` |
| `PATCH` | `/api/v1/customer/addresses/{id}` | Update own address | `ApiDataResponse<CustomerAddressResponse>` | `CONFIRMED_FROM_CODE` | `CustomerAddressController.java` |
| `DELETE` | `/api/v1/customer/addresses/{id}` | Delete own address | HTTP `204` no body | `CONFIRMED_FROM_CODE` | `CustomerAddressController.java` |
| `GET` | `/api/v1/customer/orders` | List own orders | `ApiListResponse<OrderListItemResponse>` | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java` |
| `GET` | `/api/v1/customer/orders/{orderId}` | Get own order detail | `ApiDataResponse<OrderDetailResponse>` | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java` |
| `GET` | `/api/v1/customer/orders/returns` | List own returns | `ApiDataResponse<List<CustomerReturnResponse>>` | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java` |
| `GET` | `/api/v1/customer/orders/returns/{returnId}` | Get own return detail | `ApiDataResponse<CustomerReturnResponse>` | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java` |
| `POST` | `/api/v1/customer/orders/{orderId}/returns` | Create own return request | `ApiDataResponse<CustomerReturnResponse>` with HTTP `201` | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java` |
| `GET` | `/api/v1/customer/orders/{orderId}/return-eligibility` | Pre-check whether the customer can open a return on this order and which line items still have returnable quantity. Read-only. Returns stable reason codes (`OK`, `ORDER_NOT_FOUND`, `NOT_OWNER`, `ORDER_NOT_COMPLETED`, `WINDOW_EXPIRED`, `RETURN_IN_PROGRESS`, `NOTHING_TO_RETURN`). | `ApiDataResponse<ReturnEligibilityResponse>` | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java`, `CustomerReturnService.getReturnEligibility` |
| `GET` | `/api/v1/customer/wishlist` | List own wishlist product IDs, newest first | `ApiDataResponse<List<String>>` | `CONFIRMED_FROM_CODE` | `CustomerWishlistController.java` |
| `GET` | `/api/v1/customer/wishlist/products` | List own wishlisted products (paginated, PUBLISHED only) | `ApiListResponse<Product>` | `CONFIRMED_FROM_CODE` | `CustomerWishlistController.java` |
| `POST` | `/api/v1/customer/wishlist` | Add a product to own wishlist (idempotent) | `ApiDataResponse<{productId,added}>` with HTTP `201` | `CONFIRMED_FROM_CODE` | `CustomerWishlistController.java` |
| `DELETE` | `/api/v1/customer/wishlist/{productId}` | Remove a product from own wishlist | HTTP `204` no body | `CONFIRMED_FROM_CODE` | `CustomerWishlistController.java` |

## Commerce Mutation Contracts

| Endpoint | Current contract | Status | Evidence |
|---|---|---|---|
| `POST /api/v1/cart/coupons` | Applies one coupon to the active cart after validation and row locking. | `CONFIRMED_FROM_CODE` | `CartService.applyCoupon`, cart tests |
| `POST /api/v1/checkout` | Revalidates price/stock/coupon state, creates order/payment/shipping rows, decrements stock, and snapshots coupons. | `CONFIRMED_FROM_CODE` | `CheckoutService.java`, checkout tests |
| `POST /api/v1/orders/quick-buy` | Creates order directly from one product/variant request. | `CONFIRMED_FROM_CODE` | `CheckoutService.quickBuy` |
| `POST /api/v1/admin/pos/orders` | Creates completed/paid in-store order immediately. | `CONFIRMED_FROM_CODE` | `AdminPosController.java`, `PosOrderService.java` |

## Checkout Options Contract

`GET /api/v1/checkout/options` — no auth required; accessible to guests and authenticated customers.

Response shape: `ApiDataResponse<CheckoutOptionsResponse>`:
- `paymentMethods`: `[{ code, title }]` — currently `COD` ("Thanh toán khi nhận hàng") and `BACS` ("Chuyển khoản ngân hàng"). **Codes are uppercase strings.**
- `shippingMethods`: `[{ id, code, title, cost, freeShippingThreshold, minOrderAmount, zoneRegionCode }]`
  - `cost` — base shipping fee (VND, never null; zero-cost methods have `cost: 0`)
  - `freeShippingThreshold` — if `orderSubtotal >= freeShippingThreshold`, effective shipping is 0; `null` means no threshold
  - `minOrderAmount` — minimum subtotal required to use this method; `null` means no minimum
  - `zoneRegionCode` — region/zone identifier (e.g. ISO-3166-2 code) this method applies to; `null` means applies to all regions

Frontend must compute `effectiveShippingCost` using `freeShippingThreshold` before displaying totals — the cart total returned by `GET /api/v1/cart` does not include shipping (always 0 in cart phase).

Status: `CONFIRMED_FROM_CODE` | Evidence: `CheckoutService.getOptions`, `ShippingMethodOptionResponse.java`, `CheckoutController.java`

## Dashboard Contract

| Endpoint | Permission | Current behavior | Status | Evidence |
|---|---|---|---|---|
| `GET /api/v1/admin/dashboard?period={7d\|30d\|90d}` | `orders.read`; accessible to `ADMIN`, `SUPER_ADMIN`, `SHOP_MANAGER` | Returns KPI aggregates, revenue series, order-status breakdown, recent orders, top products. Revenue excludes `CANCELLED`, `FAILED`, `REFUNDED` orders. Default period: `30d`. | `CONFIRMED_FROM_CODE` | `AdminDashboardController.java`, `AdminDashboardService.java` |

Response shape: `ApiDataResponse<AdminDashboardSummaryResponse>`:
- `kpi`: `{ todayRevenue, todayPaidRevenue, todayRevenuePct, todayOrders, todayOrdersDelta, pendingOrders, activeProducts }`
- `revenueData`: `[{ date (ISO yyyy-MM-dd), revenue, orders }]` — one entry per day in the period, VN timezone
- `orderStatusBreakdown`: `[{ status, count }]` — period-scoped, all statuses with count > 0
- `recentOrders`: last 5 orders `[{ id, orderNumber, customerName, customerEmail, total, orderStatus, currency, placedAt }]`
- `topProducts`: top 5 by line-item revenue `[{ productId (product_pk varchar), name, revenue, units }]`

Status: `CONFIRMED_FROM_CODE`

## Admin Catalog Contract

### Product list — filter and sort params (V111+)

`GET /api/v1/admin/products` and `GET /api/v1/products` accept the homepage placement filter:

| Param | Type | Purpose |
|---|---|---|
| `homepageBlock` (admin) / `homepage_block` (public) | enum `NONE \| FEATURED_GRID \| RECOMMENDED_CAROUSEL` (optional) | Filter to a single homepage slot. Omit for all. |
| `sort` | `string` (optional) | Accepts `homepageOrder:asc` and `homepageOrder:desc` in addition to `name`, `price`, `createdAt`, `updatedAt`. Null-last: unpinned products always appear after pinned ones. |

**Schema:** Each product carries exactly one `homepageBlock` enum. Migration `V111__refactor_product_homepage_block.sql` (2026-05-14) backfilled from the legacy boolean pair (`is_featured`, `show_on_homepage`) with the rule: `is_featured=true` → `FEATURED_GRID`, else `show_on_homepage=true` → `RECOMMENDED_CAROUSEL`, else `NONE`. The legacy columns are dropped.

**Homepage placement limits** (enforced on the web frontend, not the backend API):
- `FEATURED_GRID` — max 12 products shown in the "Sản phẩm nổi bật" grid
- `RECOMMENDED_CAROUSEL` — max 10 products shown in the "Gợi ý dành cho bạn" carousel

A product is in exactly one slot, so the prior web dedupe pass is no longer needed. Admin UI shows a warning banner when the filtered count of a slot exceeds its limit.

Status: `CONFIRMED_FROM_CODE`

Evidence:
- `HomepageBlock.java` — enum definition
- `AdminCatalogController.java` — `@RequestParam(...) String homepageBlock` with `@Pattern` validation
- `CatalogController.java` — `@RequestParam(name = "homepage_block", ...) String homepageBlock`
- `AdminCatalogReadService.listProducts()` / `CatalogReadService.listProducts()` — single-slot filter
- `bigbike-openapi.json` — `homepage_block` param + `homepageBlock` enum field on Product schema
- `V111__refactor_product_homepage_block.sql` — schema change + backfill

### Product upsert — `stockState` is read-only

`POST /api/v1/admin/products` and `PATCH /api/v1/admin/products/{id}` do **not** accept `stockState` in the request body. The field is derived from `quantityOnHand` via `InventoryPolicyService` and can only be mutated through the Inventory module endpoints (`/api/v1/admin/inventory/...`).

- On create: backend forces `stockState = OUT_OF_STOCK` regardless of payload.
- On update: backend never reads `stockState` from the request.
- DTO `UpsertProductRequest` has no setter for the field; admin form does not render a picker.

Status: `CONFIRMED_BACKEND_ENFORCED`

Evidence: `UpsertProductRequest.java` (no `stockState` setter), `AdminCatalogMutationService.applyProductPatch` (`if (create) entity.setStockState(OUT_OF_STOCK)`), `InventoryPolicyService.java` (sole writer post-create).

### Product upsert — single category only

A product belongs to exactly one category, written via `categoryId`. The legacy `product_category_map` M:N side table was dropped in migration `V110__drop_product_category_map.sql` (2026-05-14). The `categories[]` array in product responses now always contains exactly the primary category, preserved for API compatibility.

Status: `CONFIRMED_BACKEND_ENFORCED`

## POS Contract

| Endpoint | Permission | Current behavior | Status | Evidence |
|---|---|---|---|---|
| `GET /api/v1/admin/pos/products/search` | `pos.read` | Product search for POS UI | `CONFIRMED_FROM_CODE` | `AdminPosController.java` |
| `POST /api/v1/admin/pos/orders` | `pos.write`; `pos.price_override` when overriding unit price | Immediate paid/completed order, payment record, stock movement, audit log, WS event | `CONFIRMED_FROM_CODE` | `AdminPosController.java`, `PosOrderService.java`, `Phase1MPosApiTest.java` |

Response fields verified in `PosOrderResponse` usage:

- `orderId`
- `orderNumber`
- `status`
- `paymentStatus`
- `paymentMethod`
- `totalAmount`

Status: `CONFIRMED_FROM_CODE`

## Admin Settings Contract

| Endpoint | Permission | Current behavior | Status | Evidence |
|---|---|---|---|---|
| `GET /api/v1/admin/settings` | `settings.read` | Paginated list with optional filters: `q` (key/description substring), `group`, `isPublic`. Sensitive keys return `settingValue="********"` with `sensitive=true, masked=true`. | `CONFIRMED_FROM_CODE` | `AdminSettingsController.java`, `AdminSettingsService.java` |
| `GET /api/v1/admin/settings/{key}` | `settings.read` | Single setting by key. Sensitive values masked. | `CONFIRMED_FROM_CODE` | `AdminSettingsController.java` |
| `PATCH /api/v1/admin/settings/{key}` | `settings.write` | Update single setting (value, group, isPublic, description). Validates type/range per `SettingDefinitionRegistry`. Sensitive keys cannot be made public. | `CONFIRMED_FROM_CODE` | `AdminSettingsController.java` |
| `PATCH /api/v1/admin/settings` | `settings.write` | **Batch update** — atomically update multiple settings in one transaction. Body: `{"updates":[{"key":"…","value":"…"}]}`. All validations run before any mutation; if any item is invalid the whole request fails with 400 and no settings are changed. | `CONFIRMED_FROM_CODE` | `AdminSettingsController.java`, `AdminSettingsService.batchUpdateSettings` |
| `GET /api/v1/settings/public` | public | List settings marked `isPublic=true` that are on the registry public allowlist. Sensitive keys are never exposed regardless of DB flag. | `CONFIRMED_FROM_CODE` | `PublicSettingsController.java` |

**Batch update response shape:** `ApiDataResponse<List<AdminSiteSettingResponse>>` — items in same order as request `updates` array.

**Sensitive key masking:** Any key whose name contains `secret`, `password`, `token`, `api_key`, `privatekey`, etc. always returns `settingValue="********"` in admin responses and in audit log `before_data`/`after_data`.

**Page hero settings (group `public_hero`, all `publicAllowed`):**

For each listing page that lacks a `PageEntity` backing (`/san-pham`, `/brands`, `/tin-tuc`), the hero block is composed from 5 keys:

| Key prefix | Type | Purpose |
|---|---|---|
| `hero_<page>_image_url` | `IMAGE_URL` | Background image URL |
| `hero_<page>_image_alt` | `STRING` | Image alt text |
| `hero_<page>_title` | `STRING` | Heading text |
| `hero_<page>_description` | `STRING` | Short tagline below heading |
| `hero_<page>_kicker` | `STRING` | Small uppercase chip above heading |

Concrete keys: `hero_products_*`, `hero_brands_*`, `hero_news_*` (15 total). All are returned by `GET /api/v1/settings/public`. CMS pages (about/contact/policy/guides) carry the same hero fields directly on the `Page` entity instead — see [DATA_CONTRACT.md](DATA_CONTRACT.md) "Page hero fields".

**`UpsertPageRequest` admin DTO** (admin can edit hero on any CMS page):
- `heroImage`: `{ url, alt }` — same nested shape as `coverImage`. Send `{ url: "" }` to clear.
- `heroTitle`, `heroDescription`, `heroKicker`: nullable strings.

**Public `Page` response** adds `heroImageUrl`, `heroImageAlt`, `heroTitle`, `heroDescription`, `heroKicker` (all nullable strings) to the existing shape.

## Coupon Gift Contract

| Method | Path | Permission | Current behavior | Status | Evidence |
|---|---|---|---|---|---|
| `POST` | `/api/v1/admin/customers/{customerId}/coupon-gift` | `coupons.write` | Creates a unique `GIFT`-prefixed coupon locked to the customer, saves audit log, sends email async. Returns `AdminCouponDetailResponse`. Customer must have email. | `CONFIRMED_FROM_CODE` | `AdminCustomerController.java`, `AdminCouponGiftService.java` |
| `POST` | `/api/v1/admin/coupon-gifts/bulk` | `coupons.write` | Creates one unique coupon per active customer with email (no `customer_id` lock — shared gift campaign). Emails sent async. Returns `{ sent, skipped }`. | `CONFIRMED_FROM_CODE` | `AdminCouponGiftController.java`, `AdminCouponGiftService.java` |

**Bulk gift request body** (same fields as single gift):
```json
{ "discountType": "FIXED|PERCENT", "amount": 50000, "minimumAmount": null, "validDays": 30, "channel": "ALL" }
```

**Bulk gift response shape:** `ApiDataResponse<BulkCouponGiftResult>` — `{ "sent": 120, "skipped": 5 }` where `skipped` = customers without email or with inactive status.

## Audit Log Contract

| Endpoint | Permission | Current behavior | Status | Evidence |
|---|---|---|---|---|
| `GET /api/v1/admin/audit-logs` | `audit-logs.read` | Paginated list (page/size), filterable by actorType, actorId, resourceType, resourceId, action, q (matches action text), from/to (LocalDate). Enriches actor display name and resource code. | `CONFIRMED_FROM_CODE` | `AdminAuditLogController.java`, `AdminAuditLogService.java` |

**Resource types written by backend** (as of P0 fix):
- `ORDER` — order lifecycle events (AdminOrderService, PosOrderService, RefundService)
- `PRODUCT` — create/update/publish/soft-delete/restore (AdminCatalogMutationService)
- `CATEGORY` — create/update/soft-delete (AdminCatalogMutationService)
- `BRAND` — create/update/soft-delete (AdminCatalogMutationService)
- `INVENTORY` — stock adjustments (AdminInventoryService)
- `CONTENT` — article/page create/update/delete (AdminContentMutationService)
- `COUPON` — AdminCouponService
- `CUSTOMER` — AdminCustomerService
- `MEDIA` — AdminMediaService
- `MENU` / `MENU_ITEM` — AdminMenuService
- `REDIRECT` — AdminRedirectService
- `SITE_SETTING` — AdminSettingsService
- `REVIEW` — AdminReviewService
- `RECEIVABLE` — ReceivableService
- `ADMIN_USER` — AdminAdminUsersService
- `ADMIN_ROLE` — AdminRoleService (fixed in V76; previously erroneously `ADMIN_ROLE:<roleId>`)

**Note:** `resource_id` column is `uuid` type. For entities with String IDs (products, categories, brands, content, roles), `resource_id = null` and the entity identifier is embedded in `afterData`/`beforeData` JSON.

## Admin Returns Inspection Contract (V104)

| Method | Path | Permission | Purpose | Status | Evidence |
|---|---|---|---|---|---|
| `PATCH` | `/api/v1/admin/returns/{returnId}/items/{itemId}/inspect` | `orders.write` | Records a per-item QC decision while the parent return is `INSPECTING`. Body: `{ "result": "PASS"|"FAIL", "note": "..." }`. Idempotent: calling again overwrites the previous decision. | `CONFIRMED_FROM_CODE` | `AdminReturnController.java`, `AdminReturnService.inspectItem`, `V104__add_return_item_inspection.sql` |

`AdminReturnDetailResponse.ReturnItemResponse` now includes `inspectionResult`, `inspectionNote`, `inspectedAt`.

State machine guards (also see [STATE_MACHINES.md §10](../business/STATE_MACHINES.md)):
- `INSPECTING → COMPLETED/REFUNDED` is rejected with `items.INSPECTION_INCOMPLETE` if any `ReturnItem` is missing an inspection result.
- `restoreStockForReturn` skips items with `inspection_result = 'FAIL'` so customer-damaged goods don't re-enter inventory.

## Admin Warranty Contract

All three endpoints are gated by `warranty.read` (read) or `warranty.write` (void). Responses are **not** wrapped in `ApiDataResponse` — these endpoints return the DTO directly, consistent with each other but inconsistent with the broader admin API envelope convention.

`WarrantyRecordResponse` shape: `{ id: UUID, serialId: UUID, orderLineItemId: UUID|null, customerId: UUID|null, customerEmail: string|null, customerPhone: string|null, startDate: LocalDate, endDate: LocalDate, status: "ACTIVE"|"VOIDED", createdAt: Instant }`

| Method | Path | Permission | Purpose | Status | Evidence |
|---|---|---|---|---|---|
| `GET` | `/api/v1/admin/warranties?page&size&status&customerId&q` | `warranty.read` | Paginated list filtered by optional `status` and `customerId`. Optional `q` is a case-insensitive free-text filter matching `customerEmail` or `customerPhone` (blank treated as no filter). Returns `PageResult<WarrantyRecordResponse>`. | `CONFIRMED_FROM_CODE` | `AdminWarrantyController.java`, `AdminWarrantyService.search` |
| `GET` | `/api/v1/admin/warranties/by-serial/{serialId}` | `warranty.read` | Look up a warranty record by the internal serial UUID (not the human-readable serial number string). Returns `WarrantyRecordResponse` or `404` if no warranty exists for that serial. Wired into the `SerialListScreen` serial-detail "Bảo hành" panel via `adminApi.getWarrantyBySerial`; HTTP-tested. | `CONFIRMED_FROM_CODE` | `AdminWarrantyController.java:31`, `AdminWarrantyService.getBySerial`, `WarrantyApiTest.java`, audit finding F-08 |
| `PATCH` | `/api/v1/admin/warranties/{warrantyId}/void` | `warranty.write` | Void an active warranty. Idempotent rejection: returns `409` if already `VOIDED`. Sets `status = "VOIDED"`, stamps `updatedAt`. | `CONFIRMED_FROM_CODE` | `AdminWarrantyController.java`, `AdminWarrantyService.voidWarranty`, `WarrantyApiTest.java` |

**Public warranty lookup (no auth):**

| Method | Path | Permission | Purpose | Status | Evidence |
|---|---|---|---|---|---|
| `GET` | `/api/v1/warranties/lookup?serial={serialNumber}` | None (public) | Customer-facing lookup by human-readable serial number string. Returns `ApiDataResponse<PublicWarrantyResponse>` with `{ serialNumber, productName, status, startDate, endDate, daysLeft }`. Consumed by web `/bao-hanh` and the mobile `WarrantyLookupScreen` (route `/bao-hanh`). | `CONFIRMED_FROM_CODE` | `PublicWarrantyController.java`, `WarrantyApiTest.java` |

## Admin Contact Inbox Contract (V105)

| Method | Path | Permission | Purpose | Status | Evidence |
|---|---|---|---|---|---|
| `GET` | `/api/v1/admin/contact-messages?page&size&status&q` | `contact.read` | Paginated list with optional status filter and search across name/phone/email/content. | `CONFIRMED_FROM_CODE` | `AdminContactController.java`, `AdminContactService.list` |
| `GET` | `/api/v1/admin/contact-messages/{id}` | `contact.read` | Detail with admin note, assignee display name, IP, user-agent. | `CONFIRMED_FROM_CODE` | `AdminContactController.java`, `AdminContactService.getDetail` |
| `PATCH` | `/api/v1/admin/contact-messages/{id}` | `contact.write` | Patch status / admin note / assigned admin. All fields optional. `resolved_at` stamped on first entry into terminal state. | `CONFIRMED_FROM_CODE` | `AdminContactController.java`, `AdminContactService.update` |

## Admin Notification Center Contract (V102)

Persistent counterpart of the WebSocket order feed — admins offline when an event fires still see it here. All three endpoints are gated by `orders.read` (no dedicated `notifications.*` permission).

| Method | Path | Permission | Purpose | Status | Evidence |
|---|---|---|---|---|---|
| `GET` | `/api/v1/admin/notifications` | `orders.read` | List unread notifications with `unreadCount`. Each item: `id`, `type`, `orderId`, `orderNumber`, `payload`, `isRead`, `createdAt`. | `CONFIRMED_FROM_CODE` | `AdminNotificationController.java`, `AdminNotificationService.listUnread` |
| `POST` | `/api/v1/admin/notifications/mark-read` | `orders.read` | Mark the given notification IDs as read. Body `{ "ids": [uuid] }`. Returns `{ updated }`. | `CONFIRMED_FROM_CODE` | `AdminNotificationController.java`, `AdminNotificationService.markRead` |
| `POST` | `/api/v1/admin/notifications/mark-all-read` | `orders.read` | Mark every unread notification as read. Returns `{ updated }`. | `CONFIRMED_FROM_CODE` | `AdminNotificationController.java`, `AdminNotificationService.markAllRead` |

## WebSocket Contract

| Item | Current contract | Status | Evidence |
|---|---|---|---|
| Connect endpoint | `/ws` | `CONFIRMED_FROM_CODE` | `WebSocketConfig.java` |
| CONNECT auth | native header `Authorization: Bearer <admin-jwt>` | `CONFIRMED_FROM_CODE` | `WebSocketConfig.java`, `adminWebSocket.js` |
| Allowed roles | `ADMIN`, `SUPER_ADMIN` | `CONFIRMED_FROM_CODE` | `WebSocketConfig.java` |
| Confirmed topic | `/topic/admin/orders` | `CONFIRMED_FROM_CODE` | `AdminOrderWsService.java`, `adminWebSocket.js` |
| Payload | `OrderWsEvent` with `type`, `orderId`, `orderNumber`, `customerName`, `total`, `status`, `paymentMethod`, `timestamp` | `CONFIRMED_FROM_CODE` | `OrderWsEvent.java` |

## Response Shape Caveats

The repo does not use one wrapper consistently across every controller:

- Most public/customer CRUD endpoints use `ApiDataResponse` or `ApiListResponse`. Customer-returns endpoints (`/returns`, `/returns/{id}`, `/{orderId}/returns`) are now also wrapped — the prior raw-payload inconsistency was fixed in `CustomerOrderController`.
- Some admin modules use raw `PageResult`, DTOs, CSV, or other non-envelope responses.

Status: `CONFIRMED_FROM_CODE`

## Mobile Coverage Notes

| Topic | Current status | Evidence |
|---|---|---|
| Search, address, contact, customer address, customer returns are wrapped in mobile endpoint constants. | `CONFIRMED_FROM_CODE` | `api_endpoints.dart` |
| Verify-email and home-videos are wrapped in `api_endpoints.dart` (constants `verifyEmail` line 52, `homeVideos` line 26). Home-videos widget integration is still pending in the mobile app (tracked as `CMS-004`). | `CONFIRMED_FROM_CODE` | `api_endpoints.dart` lines 26, 52 |

## Proposed Accounts Receivable Endpoints

> Status: `PROPOSED_FOR_AR_MODULE` — not yet implemented. Requires business confirmation (`AR_RULE_001`–`AR_RULE_011` in `BUSINESS_RULES.md`) and completion of Phase 1 prerequisite fixes before these endpoints are built.

### Admin receivables endpoints

| Method | Path | Permission | Proposed behavior |
|---|---|---|---|
| `GET` | `/api/v1/admin/receivables` | `receivables.read` | Paginated list of credit orders with `outstanding > 0`, filterable by `customerId`, `dueStatus` (CURRENT / OVERDUE / ALL), date range |
| `GET` | `/api/v1/admin/receivables/summary` | `receivables.read` | Total outstanding amount, overdue count, aging buckets (0–30, 31–60, 61–90, 90+ days) |
| `GET` | `/api/v1/admin/receivables/customers/{customerId}` | `receivables.read` | Per-customer credit orders and payment history |
| `POST` | `/api/v1/admin/orders/{id}/payments` | `receivables.record_payment` | Record a partial or full payment against a credit order; updates `paidAmount`, transitions `paymentStatus` to `PAID` or keeps `PARTIALLY_PAID`; creates a new `PaymentEntity` row |
| `PATCH` | `/api/v1/admin/orders/{id}/credit-terms` | `receivables.set_credit_terms` | Set or update `due_at` and `credit_terms` on an existing order |
| `POST` | `/api/v1/admin/orders/{id}/write-off` | `receivables.write_off` | Write off uncollectable receivable — sets `paymentStatus` to `CANCELLED` with an audit note |

### POS endpoint extension (additive, same path)

`POST /api/v1/admin/pos/orders` — if request body includes `paymentMethod: "CREDIT"` and the caller has `pos.credit_sale` permission:
- Creates order with `status = COMPLETED` and `paymentStatus = UNPAID`
- Requires `dueAt` in request body (ISO-8601 timestamp)
- Does NOT create a `PaymentEntity` row (payment is deferred)
- This is an additive extension to the existing POS endpoint; existing `CASH` / `CARD_TERMINAL` behavior is unchanged

### Customer-facing extension (additive, existing endpoint)

`GET /api/v1/customer/orders/{orderId}` — extend `OrderDetailResponse` with two additional read-only fields:
- `outstanding`: `BigDecimal` — `totalAmount - paidAmount` (zero for fully paid orders)
- `dueAt`: `Instant` nullable — payment due date for credit orders (null for non-credit)
