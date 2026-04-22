# Phase 1G — Order Read API + Customer Account Orders Report

## A. Summary

Implemented read-only order APIs covering three flows:

1. **Customer orders list** (`GET /api/v1/customer/orders`) — authenticated customer sees their own orders with optional status/paymentStatus filtering and pagination.
2. **Customer order detail** (`GET /api/v1/customer/orders/{orderId}`) — authenticated customer gets full order detail; returns 404 (not 403) for orders belonging to other customers to prevent information leakage.
3. **Guest order lookup** (`GET /api/v1/orders/lookup?orderNumber=...&orderKey=...`) — public endpoint for the order-received/thank-you page flow; validates both orderNumber and orderKey (secret) before returning detail; only returns customer-visible notes.

These APIs are required for:
- The account page (`/account/orders`) listing a customer's purchase history.
- The order-received page (`/order-received?order=BB-...&key=bb_order_...`) shown to guests after checkout.
- Quick-buy post-purchase confirmation.

---

## B. Files Changed

### Created

| Package/Path | File | Purpose |
|---|---|---|
| `api/order/dto/` | `OrderListItemResponse.java` | Summary item for order list (id, orderNumber, status, paymentStatus, totalAmount, currency, placedAt, itemCount) |
| `api/order/dto/` | `OrderDetailResponse.java` | Full order detail record |
| `api/order/dto/` | `OrderLineItemResponse.java` | Snapshot of one line item |
| `api/order/dto/` | `OrderAddressResponse.java` | BILLING/SHIPPING address |
| `api/order/dto/` | `OrderShippingItemResponse.java` | Shipping method snapshot |
| `api/order/dto/` | `OrderPaymentResponse.java` | Payment record (no provider secrets) |
| `api/order/dto/` | `OrderNoteResponse.java` | Customer-visible note |
| `api/order/` | `CustomerOrderController.java` | `GET /api/v1/customer/orders` and `GET /api/v1/customer/orders/{orderId}` |
| `api/order/` | `OrderLookupController.java` | `GET /api/v1/orders/lookup` |
| `service/order/` | `OrderReadService.java` | Ownership check, mapping, note visibility, pagination |
| `test/...` | `Phase1GOrderReadApiTest.java` | 22 integration tests |
| `docs/` | `PHASE_1G_ORDER_READ_API_REPORT.md` | This report |

### Modified

| File | Change |
|---|---|
| `config/SecurityConfig.java` | Added `/api/v1/customer/orders/**` → `hasRole("CUSTOMER")`; `/api/v1/orders/lookup` GET → `permitAll()` |
| `persistence/repository/commerce/order/OrderLineItemJpaRepository.java` | Added `countByOrderId(UUID)` for itemCount in list view |
| `persistence/repository/commerce/order/OrderNoteJpaRepository.java` | Added `findByOrderIdAndCustomerVisibleOrderByCreatedAtAsc(UUID, boolean)` for note visibility filter |

---

## C. API Endpoints

### `GET /api/v1/customer/orders`
- **Auth**: `ROLE_CUSTOMER` (customer session cookie `bb_session`)
- **Query params**: `page` (default 1), `size` (default 20, max 100), `status` (optional), `paymentStatus` (optional)
- **Response**: `ApiListResponse<OrderListItemResponse>` with pagination meta
- **Sort**: `placedAt DESC, createdAt DESC`

### `GET /api/v1/customer/orders/{orderId}`
- **Auth**: `ROLE_CUSTOMER`
- **Rules**: Returns 404 if orderId not found OR order.customerId ≠ current customer — no 403 leak
- **Response**: `ApiDataResponse<OrderDetailResponse>` with full detail (lineItems, addresses, shippingItems, payments, customer-visible notes)
- **Excluded**: `ipAddress`, `userAgent`, `source`, internal note content (customerVisible=false)

### `GET /api/v1/orders/lookup`
- **Auth**: Public — no session, no CSRF (GET is safe)
- **Query params**: `orderNumber` (required), `orderKey` (required)
- **Rules**: Both params validated; exact key match; 404 on any mismatch or unknown order
- **Response**: `ApiDataResponse<OrderDetailResponse>` — same shape as customer detail, but only customer-visible notes
- **Use case**: Order-received page after guest/customer checkout

---

## D. Service / Security Design

### Customer ownership scoping
`OrderReadService.getCustomerOrderDetail(customerId, orderId)`:
```
find order by orderId → 404 if missing
if order.customerId ≠ customerId → 404 (not 403)
return full detail
```
Returns 404 unconditionally so callers cannot distinguish "does not exist" from "belongs to someone else."

### Guest lookup by orderNumber + orderKey
`OrderReadService.guestLookup(orderNumber, orderKey)`:
```
find order by orderNumber → 404 if missing
if order.orderKey ≠ provided orderKey → 404
return full detail
```
The `orderKey` is generated as `bb_order_<20hex>` — functionally acts as an unguessable token without requiring auth.

### Notes visibility
Both customer detail and guest lookup use `customerVisibleNotesOnly = true`:
- Only `OrderNoteEntity.customerVisible = true` notes are returned.
- System notes created by `CheckoutService` have `customerVisible = false` — they do **not** appear.
- Admin-authored internal notes (future) are also hidden unless explicitly marked visible.

### Sensitive fields hidden
`OrderDetailResponse` record does not include:
- `ipAddress` / `userAgent` (captured in `orders.ip_address` / `orders.user_agent` but not mapped)
- `source` (internal tag for checkout vs quick_buy)
- `legacyId`, raw `metadata` fields
- `PaymentEntity.transactionId`, `providerReference`, `metadata` (not in `OrderPaymentResponse`)

### Pagination
Reuses existing `PaginationService` (in-memory on customer's orders). Default 20 / max 100 / page ≥ 1 normalized.

---

## E. Tests Added

**Class**: `Phase1GOrderReadApiTest` (22 tests)

| # | Test | What it verifies |
|---|------|-----------------|
| 1 | `customerOrders_withoutSession_returns401` | 401 without auth |
| 2 | `customerOrders_withSession_returnsOnlyOwnOrders` | Customer A's orderNumber absent from Customer B's list |
| 3 | `customerOrders_paginationWorks` | 2 orders, size=1 → 1 item in data, pagination meta present |
| 4 | `customerOrders_filterByStatusWorks` | PROCESSING filter finds order; CANCELLED filter returns empty list |
| 5 | `customerOrderDetail_ownOrder_returnsDetail` | Own order returns correct orderNumber and status |
| 6 | `customerOrderDetail_otherCustomerOrder_returns404` | Cross-customer access returns 404 |
| 7 | `customerOrderDetail_includesLineItems` | lineItems array length=1, productName present |
| 8 | `customerOrderDetail_includesAddresses` | addresses array length=2 (BILLING+SHIPPING) |
| 9 | `customerOrderDetail_includesShippingItems` | shippingItems array length=1, methodTitle present |
| 10 | `customerOrderDetail_includesPaymentSummary` | payments array, paymentMethod=COD, status=PENDING |
| 11 | `customerOrderDetail_doesNotExposeIpOrUserAgent` | JSON body does not contain "ipAddress" or "userAgent" |
| 12 | `guestLookup_validOrderNumberAndKey_returnsDetail` | 200 with correct orderNumber and status |
| 13 | `guestLookup_wrongKey_returns404` | Wrong key → 404 |
| 14 | `guestLookup_missingParams_returns400` | Missing orderKey → 400; missing orderNumber → 400 |
| 15 | `guestLookup_doesNotExposeInternalNotes` | notes=[] (system note customerVisible=false is hidden) |
| 16 | `orderReceivedFlow_afterCheckout_canLookupByOrderNumberAndKey` | Full round-trip: checkout then lookup by returned number+key |
| 17 | `quickBuyOrder_canLookupByOrderNumberAndKey` | Quick-buy order lookupable by number+key |
| 18 | `publicCatalog_stillPublic` | GET /api/v1/products → 200 |
| 19 | `adminEndpoint_stillProtected` | GET /api/v1/admin/products → 401 |
| 20 | `customerMe_stillWorks` | GET /api/v1/customer/me → 200 with email |
| 21 | `cartApi_stillWorks` | GET /api/v1/cart → 200, status=ACTIVE |
| 22 | `checkoutApi_stillWorks` | GET /api/v1/checkout/options → 200, paymentMethods present |

---

## F. Commands Executed

```
cd bigbike-backend && ./mvnw test
→ Tests run: 160, Failures: 0, Errors: 0, Skipped: 0
→ BUILD SUCCESS

docker compose config
→ PASS (valid compose file, parses cleanly)
```

**Breakdown by class:**
- Phase1GOrderReadApiTest: 22/22 ✓
- Phase1FCheckoutApiTest: 26/26 ✓
- Phase1ECartApiTest: 25/25 ✓
- Phase1DCustomerAuthTest: 20/20 ✓
- All prior suites: 87/87 ✓
- **Total: 160/160**

---

## G. Remaining Risks

| Risk | Status |
|------|--------|
| Guest lookup rate limiting | Deferred — no rate-limit framework configured yet; orderKey length (~20 hex chars) provides ~10^24 search space |
| Admin order management (status update, assign, notes) | Deferred to Phase 1H |
| Order status transitions (PROCESSING → COMPLETED etc.) | Deferred to Phase 1H |
| Email notifications on order creation/update | Deferred |
| Payment webhook processing | Deferred |
| Coupon engine | Deferred from Phase 1F |
| Cart merge after login | Deferred from Phase 1E |

---

## H. Recommended Next Tasks

| Phase | Description |
|-------|-------------|
| **Phase 1H** | Admin Order Read/Status API — admin can list, filter, view, and transition order status |
| **Phase 1I** | Admin Customer/Media/Redirect APIs — fill remaining admin management endpoints |
| **Phase 2** | WordPress Migration Layer — import legacy data (products, orders, customers) |
| **Phase 3** | Main Web Legacy URL/SEO Alignment — ensure old WordPress URLs redirect correctly |
| **Phase 4** | Frontend Integration — connect Next.js pages to Phase 1A–1G APIs |

---

## I. Safety Check

- **No frontend changes** ✓
- **No sensitive fields exposed** — `ipAddress`, `userAgent`, `source`, `transactionId`, internal metadata all excluded from DTOs ✓
- **No cross-customer order access** — 404 returned unconditionally for ownership mismatch ✓
- **No mutation outside scope** — all endpoints are GET (read-only) ✓
- **No admin/customer/cart/checkout APIs broken** — 160/160 tests pass ✓
- **No schema/migration changes** ✓
- **No payment gateway** ✓
- **No coupon / cart merge** ✓
