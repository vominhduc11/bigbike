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
| `GET` | `/api/v1/customer/addresses` | List own addresses | `ApiDataResponse<List<CustomerAddressResponse>>` | `CONFIRMED_FROM_CODE` | `CustomerAddressController.java` |
| `POST` | `/api/v1/customer/addresses` | Create own address | `ApiDataResponse<CustomerAddressResponse>` with HTTP `201` | `CONFIRMED_FROM_CODE` | `CustomerAddressController.java` |
| `PATCH` | `/api/v1/customer/addresses/{id}` | Update own address | `ApiDataResponse<CustomerAddressResponse>` | `CONFIRMED_FROM_CODE` | `CustomerAddressController.java` |
| `DELETE` | `/api/v1/customer/addresses/{id}` | Delete own address | HTTP `204` no body | `CONFIRMED_FROM_CODE` | `CustomerAddressController.java` |
| `GET` | `/api/v1/customer/orders` | List own orders | `ApiListResponse<OrderListItemResponse>` | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java` |
| `GET` | `/api/v1/customer/orders/{orderId}` | Get own order detail | `ApiDataResponse<OrderDetailResponse>` | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java` |
| `GET` | `/api/v1/customer/orders/returns` | List own returns | raw `List<CustomerReturnResponse>` | `CONFIRMED_FROM_CODE`; wrapper inconsistency | `CustomerOrderController.java` |
| `GET` | `/api/v1/customer/orders/returns/{returnId}` | Get own return detail | raw `CustomerReturnResponse` | `CONFIRMED_FROM_CODE`; wrapper inconsistency | `CustomerOrderController.java` |
| `POST` | `/api/v1/customer/orders/{orderId}/returns` | Create own return request | raw `CustomerReturnResponse` with HTTP `201` | `CONFIRMED_FROM_CODE`; wrapper inconsistency | `CustomerOrderController.java` |

## Commerce Mutation Contracts

| Endpoint | Current contract | Status | Evidence |
|---|---|---|---|
| `POST /api/v1/cart/coupons` | Applies one coupon to the active cart after validation and row locking. | `CONFIRMED_FROM_CODE` | `CartService.applyCoupon`, cart tests |
| `POST /api/v1/checkout` | Revalidates price/stock/coupon state, creates order/payment/shipping rows, decrements stock, and snapshots coupons. | `CONFIRMED_FROM_CODE` | `CheckoutService.java`, checkout tests |
| `POST /api/v1/orders/quick-buy` | Creates order directly from one product/variant request. | `CONFIRMED_FROM_CODE` | `CheckoutService.quickBuy` |
| `POST /api/v1/admin/pos/orders` | Creates completed/paid in-store order immediately. | `CONFIRMED_FROM_CODE` | `AdminPosController.java`, `PosOrderService.java` |

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

- Most public/customer CRUD endpoints use `ApiDataResponse` or `ApiListResponse`.
- Customer returns use raw DTO/list responses.
- Some admin modules use raw `PageResult`, DTOs, CSV, or other non-envelope responses.

Status: `CONFIRMED_FROM_CODE`

## Mobile Coverage Notes

| Topic | Current status | Evidence |
|---|---|---|
| Search, address, contact, customer address, customer returns are wrapped in mobile endpoint constants. | `CONFIRMED_FROM_CODE` | `api_endpoints.dart` |
| Verify-email and home-videos are not currently wrapped in `api_endpoints.dart`. | `CODE_ONLY_NOT_DOCUMENTED` | backend controllers/security + `api_endpoints.dart` |

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
