# Cart + Checkout + Coupon + Quick Buy + Order E2E Audit

**Audit date:** 2026-05-07  
**Auditor role:** Senior Software Architect + QA Auditor  
**Scope:** Deep audit of Cart, Checkout, Coupon, Quick Buy, Order Received domain  
**Prerequisite doc:** `docs/audits/E2E_WORKFLOW_MASTER_INVENTORY.md` (Phase 1 master inventory)

---

## 1. Scope and Files Read

### Backend — confirmed read

| File | Path |
|---|---|
| `CartController.java` | `api/cart/CartController.java` |
| `CheckoutController.java` | `api/checkout/CheckoutController.java` |
| `OrderLookupController.java` | `api/order/OrderLookupController.java` |
| `CustomerOrderController.java` | `api/order/CustomerOrderController.java` |
| `AdminOrderController.java` | `api/admin/AdminOrderController.java` |
| `AdminInventoryController.java` | `api/admin/AdminInventoryController.java` |
| `CartService.java` | `service/cart/CartService.java` (432 lines, full) |
| `CheckoutService.java` | `service/checkout/CheckoutService.java` (956 lines, full) |
| `CouponExpiryScheduler.java` | `service/coupon/CouponExpiryScheduler.java` |
| `InventoryPolicyService.java` | `service/inventory/InventoryPolicyService.java` |
| `AdminOrderWsService.java` | `service/ws/AdminOrderWsService.java` |
| `OrderWsEvent.java` | `service/ws/OrderWsEvent.java` |
| `DevAdminAuthService.java` | `service/auth/DevAdminAuthService.java` |
| `AdminRolePermissions.java` | `service/auth/AdminRolePermissions.java` |
| `SecurityConfig.java` | `config/SecurityConfig.java` (via Explore agent) |
| `CustomerCsrfFilter.java` | `config/CustomerCsrfFilter.java` (via Explore agent) |
| `RateLimitingFilter.java` | `config/RateLimitingFilter.java` (via Explore agent) |
| `WebSocketConfig.java` | `config/WebSocketConfig.java` (via Explore agent) |
| `CustomerSessionFilter.java` | `config/CustomerSessionFilter.java` (via Explore agent) |
| `CheckoutIdempotencyKeyEntity.java` | `persistence/entity/commerce/order/` |

### DTOs — confirmed read
Cart: `AddCartItemRequest`, `UpdateCartItemRequest`, `CartItemResponse`, `CartResponse`, `CartTotalsResponse`, `ApplyCouponRequest`  
Checkout: `CheckoutRequest`, `QuickBuyRequest`, `OrderSummaryResponse`, `CheckoutOptionsResponse`  
Order: `OrderDetailResponse`, `OrderListItemResponse`, `CreateReturnRequest`, `CustomerReturnResponse`  
Admin Order: `AdminOrderDetailResponse`, `AdminOrderListItemResponse`, `UpdateOrderStatusRequest`, `UpdatePaymentStatusRequest`, `CreateRefundRequest`, `CreateOrderNoteRequest`

### Migrations — confirmed read

| Migration | Content |
|---|---|
| `V6__create_cart_tables.sql` | `carts`, `cart_items` schema |
| `V7__create_order_tables.sql` | `orders`, `order_line_items`, `order_shipping_items`, `order_fee_items`, `order_applied_coupons`, `order_addresses`, `order_notes` |
| `V49__create_roles_permissions_tables.sql` | `admin_roles`, `role_permissions` seed |
| `V62__create_checkout_idempotency_keys.sql` | `checkout_idempotency_keys` schema |
| `V67__add_optimistic_lock_version.sql` | `version` column on `orders` and `returns` |
| `V71__add_pos_staff_and_customer_name_to_orders.sql` | `created_by_admin_id`, `customer_name` on `orders` |
| `V73__enforce_one_coupon_per_cart.sql` | `UNIQUE(cart_id)` on `cart_coupons` |
| `V74__add_order_line_item_product_pk.sql` | `product_pk` on `cart_items` and `order_line_items` |

### Frontend — confirmed read
**bigbike-web:** `gio-hang/page.tsx` (365L), `thanh-toan/page.tsx` (603L), `don-hang/xac-nhan/page.tsx` (99L), `tai-khoan/don-hang/page.tsx` (229L), `tai-khoan/don-hang/[id]/page.tsx` (468L), `lib/api/client-api.ts` (208L), `lib/cart-context.tsx` (82L), `lib/contracts/commerce.ts` (301L)  
**bigbike-admin:** `OrderListScreen.jsx`, `OrderDetailScreen.jsx`, `OrderNotificationToast.jsx`, `lib/adminApi.js` (orders section), `lib/contracts.js` (normalizeOrder), `lib/adminWebSocket.js`  
**bigbike_mobile:** `core/models/cart.dart`, `core/providers/cart_provider.dart`, `features/cart/cart_screen.dart`, `core/models/checkout.dart`, `features/checkout/checkout_screen.dart`, `features/checkout/order_confirmation_screen.dart`, `core/models/order.dart`, `features/account/orders_screen.dart`, `features/account/order_detail_screen.dart`, `core/api/api_endpoints.dart`, `core/api/api_client.dart`

---

## 2. Test Execution Results

### Backend tests

| Test class | Tests | Pass | Fail | Status |
|---|---|---|---|---|
| `Phase1ECartApiTest` | 27 | 27 | 0 | ✅ PASS |
| `Phase1FCheckoutApiTest` | 41 | 41 | 0 | ✅ PASS |
| `Phase1GOrderReadApiTest` | 22 | 22 | 0 | ✅ PASS |
| `Phase1HAdminOrderApiTest` | 36 | 36 | 0 | ✅ PASS |
| `Phase1KInventoryP0FixApiTest` | 10 | 2 | 8 | ❌ FAIL (see CRIT-001) |
| `Phase1KInventorySerialApiTest` | 18 | 2 | 16 | ❌ FAIL (see CRIT-001) |

Total cart/checkout/order: **126/126 tests pass**.  
Inventory: **4/28 tests pass** — see CRIT-001.

### Web lint (bigbike-web)

```
✖ 1 problem (0 errors, 1 warning)
app/thanh-toan/page.tsx:129 — React Hook Form watch() cannot be memoized (see MED-003)
```

### Flutter tests — NOT_RUN
Flutter SDK not available in test environment. Mobile findings are from static code review only.

---

## 3. E2E Workflow Trace

### 3.1 Guest cart lifecycle

```
[Browser] GET /api/v1/cart
  → CartController.resolveCart()
  → No bb_guest_id cookie: generates UUID, sets bb_guest_id (30d, SameSite=Strict, secure=false, httpOnly=false)
  → Sets bb_csrf cookie (30d, SameSite=Strict, secure=false, httpOnly=false)
  → CartService.getOrCreateGuestCart(guestId) → DB: carts.session_id = guestId, status = ACTIVE
  → Returns CartResponse (empty cart)

[Browser] POST /api/v1/cart/items  + X-CSRF-Token header
  → CustomerCsrfFilter validates bb_csrf cookie vs X-CSRF-Token header (constant-time compare)
  → CartController.addItem()
  → CartService.addItem(): validates product PUBLISHED, variant available + not OUT_OF_STOCK
  → validateQuantityAgainstStock(): checks variant.quantityOnHand or product.stockQuantity
  → resolveUnitPrice(): always from product (salePrice ?? retailPrice) — variant prices ignored
  → If same product+variant exists: merges quantity; else: creates new CartItemEntity
  → CartCalculator.recalculateItem(): computes lineSubtotal, lineDiscount, lineTotal
  → refreshCartTotals(): revalidates coupons (removes stale), recalculates cart totals
  → Returns updated CartResponse
```

### 3.2 Login → cart merge

```
[Browser] POST /api/v1/customer/auth/login
  → Sets bb_session cookie (HTTP-only, ACTIVE customer only)

[Browser] GET /api/v1/cart  (with both bb_session and bb_guest_id)
  → CartController.resolveCart(): detects CustomerPrincipal
  → CartService.getOrCreateCustomerCart(customerId)
  → If bb_guest_id present: CartService.mergeGuestCart(guestId, customerCart)
    → Adds guest item quantities to customer cart items (no stock re-validation!)
    → Marks guest cart status = "MERGED"
  → Returns merged cart

NOTE: Stock is NOT re-validated during merge — see MED-004.
```

### 3.3 Checkout from cart

```
[Browser] GET /api/v1/checkout/options
  → Returns: paymentMethods=[COD, BACS], shippingMethods=[enabled, sorted by sortOrder]

[Browser] POST /api/v1/checkout  + Idempotency-Key header (optional)
  → RateLimitingFilter: 5 requests/min per IP (429 if exceeded)
  → CustomerCsrfFilter: validates X-CSRF-Token vs bb_csrf cookie
  → CheckoutController.checkout()
  
  CheckoutService.checkoutFromCart():
    1. reserveIdempotency(FLOW_CHECKOUT, customerId|guestSessionId, idempotencyKey, req)
       - INSERT checkout_idempotency_keys; if UNIQUE conflict → return existing order (idempotent)
       - scope_key: "customer:{UUID}" | "guest:{sessionId}" | "anonymous" (see HIGH-001)
    2. Validate: items not empty, address fields, paymentMethod ∈ {COD, BACS}
    3. syncPricesAndValidateStock(): FOR UPDATE lock on product+variant, check stock, re-sync prices
       → Collects PriceChange list for response
    4. Reload+revalidate+recompute each coupon from fresh DB
    5. Resolve shipping method (auto-select if exactly 1 enabled, else required)
    6. resolveShippingCost(): checks minOrderAmount, applies freeShippingThreshold
    7. buildOrder(): COD → status=PROCESSING, BACS → status=ON_HOLD; paymentStatus=UNPAID
    8. orderRepo.save(order)
    9. decrementStockForCartItems(): FOR UPDATE lock per variant, writes StockMovementEntity(type=OUT)
   10. Save lineItems (from cart), addresses (BILLING+SHIPPING), shippingItem, PaymentEntity(status=PENDING)
   11. Atomic coupon redemption: couponRepo.attemptRedeem() via conditional UPDATE (usage_count check)
   12. Save order note (SYSTEM)
   13. cart.status = "CONVERTED"
   14. orderNotificationService.sendOrderConfirmation() (async email)
   15. adminOrderWsService.pushEvent(NEW_ORDER) — after transaction commit
   16. attachOrderToReservation()
   → Returns OrderSummaryResponse (orderId, orderNumber, orderKey, status, amounts, priceChanges)

[Browser] GET /don-hang/xac-nhan?orderNumber=...&orderKey=...
  → Next.js server component: OrderLookupController.lookup() → guestLookup()
  → Displays order confirmation with PurchaseEvent analytics
```

### 3.4 Quick Buy

```
[Browser] POST /api/v1/orders/quick-buy  + Idempotency-Key header (optional)
  → CheckoutController.quickBuy()
  → CheckoutService.quickBuy():
    1. reserveIdempotency(FLOW_QUICK_BUY, ...) — same logic as checkout
    2. validateAddress(), validatePaymentMethod()
    3. productRepo.findByIdForUpdate(): FOR UPDATE pessimistic lock on product
    4. variantRepo.findByIdForUpdate(): FOR UPDATE on variant (if provided)
    5. Stock validation inline (no price-change collection)
    6. lineSubtotal = unitPrice × qty; NO coupon application
    7. buildOrder(), save order
    8. decrementVariantStock() or product.stockQuantity -= qty (for non-variant products)
    9. Save lineItem, addresses (BILLING only, same for SHIPPING), shippingItem, PaymentEntity
   10. Save system note; no coupon redemption
   11. sendOrderConfirmation(), pushEvent(NEW_ORDER)
   → Returns OrderSummaryResponse (no priceChanges)

KEY DIFFERENCE from checkout: no coupon support, no cart involved,
both BILLING and SHIPPING address set from billingAddress only.
```

### 3.5 Coupon apply + redeem

```
[Browser] POST /api/v1/cart/coupons  { "code": "SUMMER10" }
  → CartService.applyCoupon():
    1. normalizeCode(code): trim + toUpperCase
    2. Enforce one-per-cart: if cartCouponRepo.findByCartId not empty → 409 Conflict
    3. couponRepo.findByCodeForUpdate(): pessimistic SELECT FOR UPDATE on coupon row
    4. CouponPolicyService.validate(): status=ACTIVE, not expired, usageLimit not exceeded, minAmount met
    5. computeDiscount(): PERCENT or FIXED
    6. cartCouponRepo.saveAndFlush(): if UNIQUE(cart_id) conflict (V73) → 409 Conflict
    7. refreshCartTotals(): revalidates all coupons on subtotal change

[Checkout]
  → Reload coupon from DB (fresh state)
  → CouponPolicyService.validate() again
  → couponRepo.attemptRedeem(): conditional UPDATE WHERE usage_count < usage_limit
  → If 0 rows updated: 409 (limit exhausted concurrently)
  → Save OrderAppliedCouponEntity with snapshotted discount amount
```

### 3.6 Admin order management

```
[Admin] GET /api/v1/admin/orders?page=1&size=20&sort=createdAt:desc
  → AdminOrderController: requires orders.read
  → AdminOrderService.listOrders() (sort param interpretation — see MED-002)

[Admin] PATCH /api/v1/admin/orders/{id}/status  { "status": "COMPLETED" }
  → AdminOrderController: requires orders.write
  → adminOrderWsService.pushEvent(ORDER_STATUS_CHANGED) — confirmed from test logs

[Admin] PATCH /api/v1/admin/orders/{id}/payment-status  { "paymentStatus": "PAID", "paidAmount": 500000 }
  → AdminOrderController: requires orders.write
  → adminOrderWsService.pushEvent(ORDER_PAYMENT_STATUS_CHANGED) — confirmed from test logs (undocumented)

[Admin] POST /api/v1/admin/orders/{id}/refund  { "refundAmount": 200000, "reason": "..." }
  → AdminOrderController: requires orders.write
  → Optimistic lock on OrderEntity (@Version, V67)
```

### 3.7 WebSocket order notification

```
[Admin browser] adminWebSocket.js
  → STOMP CONNECT to /ws with Authorization: Bearer {jwt}
  → WebSocketConfig: validates JWT, checks ROLE_ADMIN or ROLE_SUPER_ADMIN
  → Subscribe /topic/admin/orders
  
[Backend] AdminOrderWsService.pushEvent(event)
  → If inside active transaction: registers TransactionSynchronization.afterCommit()
  → Else: sends immediately
  → messaging.convertAndSend("/topic/admin/orders", event)

Confirmed event types (from test logs):
  - "NEW_ORDER" — sent by CheckoutService and PosOrderService
  - "ORDER_STATUS_CHANGED" — sent by AdminOrderService.updateOrderStatus()
  - "ORDER_PAYMENT_STATUS_CHANGED" — sent by AdminOrderService.updatePaymentStatus() [UNDOCUMENTED]

OrderWsEvent fields: type, orderId, orderNumber, customerName, total, status, paymentMethod, timestamp
```

---

## 4. Schema Audit

### 4.1 Cart tables (V6)

| Table | Key columns | Notes |
|---|---|---|
| `carts` | `id UUID PK`, `customer_id UUID FK nullable`, `session_id varchar(255)`, `status varchar(50)`, amounts, `expires_at` | No CHECK on status values; no unique constraint on (customer_id, status=ACTIVE) at DB level — enforced at service level |
| `cart_items` | `cart_id FK cascade-delete`, `product_id UUID nullable`, `product_variant_id UUID nullable`, `sku`, amounts | `CHECK quantity > 0` present; no FK on product_id (decoupled) |
| `cart_coupons` | `cart_id FK`, `coupon_code`, `discount_type`, `discount_amount` | `UNIQUE(cart_id)` from V73 — enforces one-coupon-per-cart at DB level |

### 4.2 Order tables (V7 + V71 + V74)

| Table | Key columns | Notes |
|---|---|---|
| `orders` | `id UUID PK`, `order_number UNIQUE`, `order_key UNIQUE`, `customer_id FK nullable`, `status`, `payment_status`, amounts, `placed_at`, `version BIGINT DEFAULT 0` (V67) | `created_by_admin_id UUID nullable` (V71); no CHECK on status values |
| `order_line_items` | `order_id FK cascade-delete`, `product_id UUID nullable`, `product_pk varchar(64) nullable` (V74), `product_variant_id UUID nullable`, amounts | `CHECK quantity > 0`; `product_pk` enables top-products query for admin-created products |
| `order_addresses` | `order_id FK cascade-delete`, `type varchar(50)`, contact fields | No CHECK on type values (BILLING/SHIPPING enforced only by code) |
| `order_notes` | `order_id FK cascade-delete`, `author_type`, `note_type`, `is_customer_visible` | No CHECK on author_type |
| `order_applied_coupons` | `order_id FK cascade-delete`, `coupon_id FK nullable` | Snapshot of coupon code and discount at time of order |

### 4.3 Idempotency table (V62)

| Column | Type | Notes |
|---|---|---|
| `flow_type` | varchar(50) | "CHECKOUT" or "QUICK_BUY" |
| `scope_key` | varchar(255) | "customer:{UUID}", "guest:{sessionId}", or "anonymous" |
| `idempotency_key` | varchar(255) | From Idempotency-Key header |
| `request_hash` | varchar(64) | SHA-256 of request body |
| `order_id` | UUID FK nullable (on delete set null) | Null while in-flight, set after order created |
| UNIQUE | `(flow_type, scope_key, idempotency_key)` | Prevents duplicate submissions |

---

## 5. Security Audit

### 5.1 Cookie security

| Cookie | httpOnly | secure | SameSite | TTL | Risk |
|---|---|---|---|---|---|
| `bb_guest_id` | false | false | Strict | 30d | XSS can read guestId; unencrypted over HTTP |
| `bb_csrf` | false | false | Strict | 30d | Must be JS-readable for CSRF injection; SameSite=Strict mitigates CSRF; unencrypted over HTTP |
| `bb_session` | true | (from SessionFilter) | (from SessionFilter) | session | Proper HTTP-only session cookie |

`secure=false` is appropriate in local dev but should be `true` in production. There is no evidence of a production profile that overrides this — see HIGH-002.

### 5.2 CSRF protection

`CustomerCsrfFilter` enforces X-CSRF-Token header (matching bb_csrf cookie) for all non-safe HTTP methods (not GET/HEAD/OPTIONS) on non-admin, non-auth endpoints. Uses constant-time comparison. Exemptions: `/api/v1/customer/auth/**` (login/register), `/api/v1/admin/**`. SameSite=Strict on all cookies provides defense-in-depth.

### 5.3 Rate limiting

| Endpoint | Limit |
|---|---|
| Cart mutations (`POST/PATCH/DELETE /api/v1/cart/**`) | 30 req/min per IP |
| Checkout + Quick Buy | 5 req/min per IP |
| Order lookup GET | 20 req/min per IP |
| Login | 5 req/min per IP |
| Register | 3 req/min per IP |
| Contact | 3 req/min per IP |

Rate limits are per-IP via Bucket4j. X-Forwarded-For is trusted (first IP in chain).

### 5.4 Idempotency scope — anonymous collision risk (HIGH-001)

Anonymous checkouts (`customerId=null`, no guest cookie) use `scope_key = "anonymous"`. Any two different anonymous users who submit checkout with the same `Idempotency-Key` value AND the same request hash receive identical `OrderSummaryResponse` from idempotency replay — meaning User B receives User A's order details (orderId, orderNumber, orderKey) if they happen to use the same header value. This is a data privacy concern at scale, though low-probability.

**Mitigation path:** Assign a `bb_guest_id` cookie at checkout time if none exists (currently done in `CartController` but not in `CheckoutController` when no guest cookie is present). Use guest session as scope_key for anonymous checkouts.

### 5.5 Admin permission path

`DevAdminAuthService.requirePermission()`:
- **JWT path** (production): reads `adminPermissionService.getPermissionsForRole(principal.role())` from DB `role_permissions` table
- **Dev header path** (dev/test bypass): reads from `X-Admin-Permissions` header or DB; only active when `bigbike.auth.dev-header-enabled=true`

`AdminOrderController.resolveAdminId()` falls back to `00000000-0000-0000-0000-000000000001` (DEV_ADMIN_ID) when `principal.id()` is not a valid UUID (e.g., "dev-admin-user"). This is LOW-003.

---

## 6. Business Rule Validation

### 6.1 Cart rules — all CONFIRMED_FROM_CODE

| Rule | Implementation | Status |
|---|---|---|
| PUBLISHED products only | `CartService.addItem()`: checks `product.getPublishStatus() == PublishStatus.PUBLISHED` | ✅ |
| Variant available + not OUT_OF_STOCK | `CartService.addItem()`: `variant.isAvailable()` + `stockState != OUT_OF_STOCK` | ✅ |
| Quantity vs stock validation | `CartService.validateQuantityAgainstStock()`: variant.quantityOnHand or product.stockQuantity | ✅ |
| Unit price from product (variant prices ignored) | `CartService.resolveUnitPrice()`: product.salePrice ?? product.retailPrice | ✅ |
| Same product+variant merged (quantity accumulated) | `CartService.addItem()`: `matchesProductVariant()` check | ✅ |
| Cart totals refreshed after each mutation | `CartService.refreshCartTotals()`: called after every item/coupon change | ✅ |
| Stale coupons auto-removed on refresh | `CartService.refreshCartTotals()`: removes coupons that fail ACTIVE/expiry/limit/minAmount | ✅ |
| One coupon per cart | Service pre-check + V73 DB UNIQUE(cart_id) + DataIntegrityViolationException catch | ✅ |
| Guest cart merged at login | `CartController.resolveCart()`: merges guestId cart into customer cart | ✅ |
| Guest merge: no stock re-validation | `CartService.mergeGuestCart()`: just adds quantities — see MED-004 | ⚠️ |

### 6.2 Checkout rules — all CONFIRMED_FROM_CODE

| Rule | Implementation | Status |
|---|---|---|
| Empty cart rejected | `CheckoutService.checkoutFromCart()`: items.isEmpty() → EMPTY_CART validation error | ✅ |
| Payment methods: COD or BACS only | `ALLOWED_PAYMENT_METHODS = Set.of("COD", "BACS")` | ✅ |
| COD → PROCESSING status | `buildOrder()`: line 655 | ✅ |
| BACS → ON_HOLD status | `buildOrder()`: line 655 | ✅ |
| paymentStatus always starts UNPAID | `buildOrder()`: PAYMENT_STATUS_UNPAID | ✅ |
| PaymentEntity status = PENDING | `buildPayment()`: PAYMENT_RECORD_STATUS_PENDING | ✅ |
| Prices re-synced from DB at checkout | `syncPricesAndValidateStock()`: FOR UPDATE lock + currentPrice comparison | ✅ |
| Price changes reported in response | `OrderSummaryResponse.priceChanges` list | ✅ |
| Stock decremented after order saved | `decrementStockForCartItems()` called after `orderRepo.save()` | ✅ |
| StockMovement OUT written at decrement | `decrementVariantStock()`: saves `StockMovementEntity(type=OUT, referenceType=ORDER)` | ✅ |
| Coupon revalidated from fresh DB | `couponRepo.findByCode()` + `couponPolicy.validate()` in checkout loop | ✅ |
| Coupon atomically redeemed | `couponRepo.attemptRedeem()`: conditional UPDATE with usage_count check | ✅ |
| Cart marked CONVERTED after checkout | `cart.setStatus(CART_STATUS_CONVERTED)` | ✅ |
| Idempotency: duplicate key → same order | `reserveIdempotency()`: existing key returns cached OrderSummaryResponse | ✅ |
| Idempotency: different payload → 409 | `requestHash` comparison: different hash throws ConflictException | ✅ |
| Idempotency key max 255 chars | `normalizeIdempotencyKey()` enforces length | ✅ |

### 6.3 Quick Buy rules — CONFIRMED_FROM_CODE

| Rule | Implementation | Status |
|---|---|---|
| No cart involved | `CheckoutService.quickBuy()`: no cart lookup | ✅ |
| No coupon support | Quick Buy has no coupon redemption code path | ✅ |
| Both BILLING and SHIPPING = billingAddress | `addressRepo.save(buildAddress(savedOrder, "SHIPPING", req.billingAddress(), now))` | ✅ |
| Same idempotency as checkout | `reserveIdempotency(FLOW_QUICK_BUY, ...)` | ✅ |
| Stock validation with FOR UPDATE lock | `productRepo.findByIdForUpdate()` + `variantRepo.findByIdForUpdate()` | ✅ |

### 6.4 Coupon scheduler — CONFIRMED_FROM_CODE

`CouponExpiryScheduler.expireOverdueCoupons()`:
- Runs hourly via `@Scheduled(cron = "0 0 * * * *")`
- Calls `couponRepo.expireOverdue(Instant.now())`
- `@Transactional`, logs count of expired coupons

---

## 7. API Contract Audit

### 7.1 Web ↔ Backend contract

| Frontend call | Backend endpoint | Contract match |
|---|---|---|
| `fetchCart()` | `GET /api/v1/cart` | ✅ `CartResponse` matches `contracts/commerce.ts` |
| `addCartItem(productId, variantId, qty)` | `POST /api/v1/cart/items` | ✅ |
| `updateCartItem(itemId, qty)` | `PATCH /api/v1/cart/items/{itemId}` | ✅ |
| `removeCartItem(itemId)` | `DELETE /api/v1/cart/items/{itemId}` | ✅ |
| `clearCart()` | `DELETE /api/v1/cart/clear` | ✅ (also `DELETE /api/v1/cart` — dual path) |
| `applyCoupon(code)` | `POST /api/v1/cart/coupons` | ✅ |
| `removeCoupon(code)` | `DELETE /api/v1/cart/coupons/{code}` | ✅ |
| `submitCheckout(payload, idempotencyKey)` | `POST /api/v1/checkout` + `Idempotency-Key` header | ✅ |
| `fetchCheckoutOptions()` | `GET /api/v1/checkout/options` | ✅ |
| `submitQuickBuy(payload)` | `POST /api/v1/orders/quick-buy` | ✅ |
| `getOrderLookup(orderNumber, orderKey)` | `GET /api/v1/orders/lookup?orderNumber=&orderKey=` | ✅ |
| `fetchMyOrders(page, status)` | `GET /api/v1/customer/orders` | ✅ |
| `fetchMyOrder(orderId)` | `GET /api/v1/customer/orders/{orderId}` | ✅ |

**Known drift:** `GET /api/v1/customer/orders/returns` and `GET /api/v1/customer/orders/returns/{returnId}` return raw DTOs (not wrapped in `ApiDataResponse` envelope). This is a documented drift in `DOCS_VERIFICATION_REPORT.md`.

### 7.2 Admin ↔ Backend contract

| Frontend call | Backend endpoint | Contract match |
|---|---|---|
| `fetchOrders(query)` | `GET /api/v1/admin/orders` | ✅ |
| `fetchOrderDetail(orderId)` | `GET /api/v1/admin/orders/{orderId}` | ✅ |
| `fetchOrderAllowedTransitions(orderId)` | `GET /api/v1/admin/orders/{orderId}/allowed-transitions` | ✅ |
| `updateOrderStatus(orderId, status)` | `PATCH /api/v1/admin/orders/{orderId}/status` | ✅ |
| `updateOrderPaymentStatus(orderId, status, amount)` | `PATCH /api/v1/admin/orders/{orderId}/payment-status` | ✅ |
| `addOrderNote(orderId, {content, customerVisible})` | `POST /api/v1/admin/orders/{orderId}/notes` | ✅ |
| `createRefund(orderId, input)` | `POST /api/v1/admin/orders/{orderId}/refund` | ✅ |
| `exportOrdersCsv(filters)` | `GET /api/v1/admin/reports/orders/export` | ✅ |

**Admin normalizer fields (contracts.js `normalizeOrder`):**

| Backend field | Frontend field | Notes |
|---|---|---|
| `s.lineItems` | `items` | Correct — backend uses `lineItems` |
| `s.subtotalAmount` | `subtotal` | Rename with Amount suffix |
| `s.shippingAmount` | `shippingFee` | Rename |
| `s.discountAmount` | `discount` | Rename |
| `s.totalAmount` | `total` | Rename |
| `s.placedAt` | `createdAt` | `createdAt` is derived from `placedAt` |
| `s.status ?? s.orderStatus` | `orderStatus` | Handles both field names |
| `customerName` | derived from `customerEmail || customerPhone` | No dedicated name field from backend |
| `paymentMethod` | derived from `payments[0].paymentMethod` | First payment record |

**NEEDS_VERIFICATION (MED-002):** Admin order list sends `sort=createdAt:desc` but `createdAt` in the frontend is derived from `placedAt`. The backend `AdminOrderService.listOrders()` must interpret `createdAt` as a sort parameter. If the backend's sort parsing maps `createdAt` → `placed_at` column, the sort is correct; if it maps to the DB `created_at` column (which may differ), sort order is wrong.

### 7.3 Mobile ↔ Backend contract

Mobile app (`api_endpoints.dart`, `api_client.dart`) covers all public storefront APIs including cart, checkout, orders. Mobile uses `double` for price fields (Dart 64-bit IEEE 754) — sufficient precision for VND values. Cart provider uses `AsyncNotifierProvider` (Riverpod).

---

## 8. WebSocket Audit

### 8.1 Event types

| Event type | Emitter | Admin client handler | Status |
|---|---|---|---|
| `NEW_ORDER` | `CheckoutService`, `quickBuy`, `PosOrderService` | `OrderNotificationToast` shows toast, `OrderListScreen` invalidates query | `CONFIRMED_FROM_TESTS` |
| `ORDER_STATUS_CHANGED` | `AdminOrderService.updateOrderStatus()` | Verified from test logs; frontend likely handles via query invalidation | `CONFIRMED_FROM_TESTS` |
| `ORDER_PAYMENT_STATUS_CHANGED` | `AdminOrderService.updatePaymentStatus()` | Not documented in `OrderWsEvent.java` comment; frontend handling unverified | `NEWLY_CONFIRMED — NEEDS_VERIFICATION` |

### 8.2 WS delivery guarantee

`AdminOrderWsService.pushEvent()` delays send until `TransactionSynchronization.afterCommit()` when inside a transaction. Exception in `doSend()` is caught and logged as WARN — no retry, no dead-letter queue. Failed WS pushes are silently lost.

---

## 9. Issues Found

### CRITICAL

#### CRIT-001: Inventory tests fail with 403 — permission system regression

**Affected tests:** `Phase1KInventoryP0FixApiTest` (8/10 fail), `Phase1KInventorySerialApiTest` (16/18 fail)  
**Symptoms:** All calls to `POST /api/v1/admin/inventory/variants/{id}/adjust` return HTTP 403. Even `GET /api/v1/admin/inventory/export.csv` (requires `products.read`) returns 403. These tests create a fresh ADMIN user via `adminUserRepo`, log in to get a JWT, and use it.  
**Root cause analysis:**
- `DevAdminAuthService.requirePermission()` → `adminPermissionService.getPermissionsForRole("ADMIN")` → reads `role_permissions` table
- V49 seeds ADMIN with `products.read` and `products.update`
- Phase1H (AdminOrder) passes with `orders.read`/`orders.write` for the same ADMIN role
- The failure is isolated to `products.*` permissions for ADMIN while `orders.*` permissions work
- Root cause is unknown from this audit — requires inspection of `AdminPermissionService.getPermissionsForRole()` and whether Phase1H/I/J tests modify the `role_permissions` table

**Severity:** CRITICAL — inventory mutation is a production workflow. Tests confirm a potential gap in authorization that could silently block staff access in production.  
**Action required:** Investigate `AdminPermissionService.getPermissionsForRole()` implementation; run Phase1K in isolation vs after Phase1H suite; confirm `products.*` permissions in `role_permissions` table post-V49 in test DB.

---

### HIGH

#### HIGH-001: Anonymous idempotency scope creates cross-user data leakage

**File:** `CheckoutService.java:570-578`  
**Code:**
```java
private String buildScopeKey(UUID customerId, String guestSessionId) {
    if (customerId != null) return "customer:" + customerId;
    if (guestSessionId != null && !guestSessionId.isBlank()) return "guest:" + guestSessionId;
    return ANONYMOUS_SCOPE; // "anonymous"
}
```
**Issue:** `CheckoutController.quickBuy()` extracts `guestSessionId` from `bb_guest_id` cookie only if `cp == null` (guest). If a guest has no `bb_guest_id` cookie but sends an `Idempotency-Key` header, `guestSessionId` is null, and `scope_key = "anonymous"`. Any other anonymous user using the same key value and same payload hash would receive the first user's order data from `loadExistingSummary()`.  
**Probability:** Low (anonymous users rarely send Idempotency-Key headers), but the data returned includes `orderId`, `orderNumber`, `orderKey` of another user's order.  
**Fix:** In `CheckoutController.quickBuy()`, assign a random `guestId` when no `bb_guest_id` cookie exists (mirror the cart flow), or skip idempotency entirely for anonymous requests.

#### HIGH-002: Cookie `secure=false` — cleartext transmission in production

**File:** `CartController.java:164-183`  
**Code:**
```java
ResponseCookie.from(GUEST_COOKIE, guestId)
    .httpOnly(false).secure(false).sameSite("Strict")...
ResponseCookie.from(CSRF_COOKIE, csrfValue)
    .httpOnly(false).secure(false).sameSite("Strict")...
```
**Issue:** Both `bb_guest_id` and `bb_csrf` cookies are set with `secure=false`. Over an unencrypted HTTP connection (e.g., behind a reverse proxy that doesn't forward TLS), these cookies are transmitted in plaintext. An attacker on the network can read `bb_guest_id` to hijack a guest session, or read `bb_csrf` (though SameSite=Strict provides primary CSRF protection).  
**Fix:** Use Spring Boot profile-based configuration to set `secure=true` in `prod` profile. This is a deployment-time concern — confirm production is TLS-terminated at the edge. If TLS is always enforced at infra level, risk is low.

---

### MEDIUM

#### MED-001: `ORDER_PAYMENT_STATUS_CHANGED` WebSocket event undocumented

**Evidence:** Test log during `Phase1HAdminOrderApiTest`: `WS pushed ORDER_PAYMENT_STATUS_CHANGED for order BB-20260507-0CCCC5`  
**File:** `OrderWsEvent.java:8` — comment only documents `"NEW_ORDER" | "ORDER_STATUS_CHANGED"`  
**Docs:** `BUSINESS_RULES.md` WebSocket section marks `ORDER_STATUS_CHANGED` as `NEEDS_VERIFICATION` — now confirmed. `ORDER_PAYMENT_STATUS_CHANGED` is absent from docs entirely.  
**Impact:** Admin frontend WebSocket handlers must handle this event type. If `OrderNotificationToast.jsx` or `OrderListScreen.jsx` only reacts to `NEW_ORDER` and `ORDER_STATUS_CHANGED`, payment status updates may not trigger order list refresh.  
**Action:** Update `OrderWsEvent.java` comment and `BUSINESS_RULES.md` to document `ORDER_PAYMENT_STATUS_CHANGED`. Verify admin frontend handles it.

#### MED-002: Admin sort param `createdAt:desc` may not match backend DB column (NEEDS_VERIFICATION)

**Evidence:** `OrderListScreen.jsx:39` — `sort: 'createdAt:desc'` default; `contracts.js:489` — `createdAt` is derived from `placedAt`.  
**Issue:** The backend receives `sort=createdAt:desc`. If `AdminOrderService.listOrders()` maps sort param `createdAt` to DB column `created_at` (order creation timestamp) rather than `placed_at`, the sort order may not match what the user expects (placed_at = business timestamp, created_at = DB record creation which may differ by milliseconds, or they may be identical depending on checkout flow).  
**Action:** Read `AdminOrderService.listOrders()` to confirm sort param parsing. Update `docs/engineering/API_CONTRACT.md` with the confirmed sort field mapping.

#### MED-003: React Compiler lint warning on checkout page

**File:** `bigbike-web/app/thanh-toan/page.tsx:129`  
**Warning:** `React Hook Form's watch() API returns a watch() function which cannot be memoized safely. React Compiler will skip memoizing this component.`  
**Impact:** The entire checkout page component is excluded from React Compiler memoization. On slow devices this may cause unnecessary re-renders. Not a correctness bug.  
**Fix:** Use `watch("fieldName")` for specific fields instead of `watch()` (full form watch), or use `useWatch()` hook which React Compiler handles correctly.

#### MED-004: Cart merge at login does not re-validate stock

**File:** `CartService.java:203-233`  
**Code:**
```java
public CartEntity mergeGuestCart(String guestId, CartEntity customerCart) {
    // Adds guest item quantities to customer cart items
    // No stock validation performed
}
```
**Issue:** When a guest logs in and their guest cart is merged into the customer cart, item quantities are added without checking `quantityOnHand`. Example: guest cart has 3 units of a product with only 2 in stock; customer cart has 2 units of the same product. After merge: cart has 5 units but only 2 in stock. Stock validation happens at checkout time, so the user will see an error at that step — but the cart state itself is temporarily invalid.  
**Severity:** Medium — this is a UX issue (misleading cart state), not a data integrity issue (checkout will reject it).  
**Fix:** Apply `validateQuantityAgainstStock()` during merge, capping merged quantity at available stock, with a user-visible notification.

---

### LOW

#### LOW-001: CSRF cookie TTL coupled to guest cookie TTL

**File:** `CartController.java:41-42`  
**Code:** `GUEST_TTL = 60 * 60 * 24 * 30` — both cookies use the same 30-day TTL  
**Issue:** The CSRF token does not expire independently of the session. If a user's browser retains the `bb_csrf` cookie for 30 days and the application is updated with a new security policy, old CSRF tokens remain valid until expiry. SameSite=Strict mitigates the CSRF risk, making this defense-in-depth only.

#### LOW-002: Idempotency hash uses Object.toString() — non-standard serialization

**File:** `CheckoutService.java:580-588`  
```java
private String hashRequest(Object requestBody) {
    byte[] payload = String.valueOf(requestBody).getBytes(StandardCharsets.UTF_8);
    MessageDigest digest = MessageDigest.getInstance("SHA-256");
    return HexFormat.of().formatHex(digest.digest(payload));
}
```
**Issue:** `String.valueOf(requestBody)` calls Java record's auto-generated `toString()`. This produces consistent results for Java records (deterministic field ordering) but is brittle — if `CheckoutRequest` or `QuickBuyRequest` fields are reordered or new fields added with null values, the hash changes for existing pending requests. A standard serialization (e.g., JSON) would be more robust.  
**Current risk:** Low — record toString() is deterministic within a JVM run and all price fields are integer VND amounts.

#### LOW-003: Admin note author fallback to DEV_ADMIN_ID

**File:** `AdminOrderController.java:163-173`  
```java
private UUID resolveAdminId() {
    // ...
    return DEV_ADMIN_ID; // 00000000-0000-0000-0000-000000000001
}
```
**Issue:** When `principal.id()` is not a parseable UUID (e.g., dev-bypass "dev-admin-user"), admin notes and order status changes are attributed to DEV_ADMIN_ID. This silently masks the true author in production audit logs if any admin user somehow gets a non-UUID ID.  
**Fix:** Throw an exception instead of silently falling back, or ensure all production admin user IDs are UUIDs.

#### LOW-004: Mobile price fields use Dart `double` instead of exact decimal

**File:** `bigbike_mobile/lib/core/models/cart.dart`, `checkout.dart`, `order.dart`  
**Issue:** All price fields are `double` in Dart (64-bit IEEE 754, ~15-16 significant digits). VND prices up to ~999 billion (10^12) have limited precision at the cent level. For a Vietnamese motorcycle equipment store where typical prices are 100,000–10,000,000 VND, this is practically safe. However, if prices include decimal cents (unlikely for VND), `double` introduces rounding errors.  
**Fix:** Use Dart `Decimal` package for monetary amounts in a future refactor.

---

## 10. State Machine Cross-Check

### Order status transitions (from CheckoutService + AdminOrderService)

| Trigger | From | To |
|---|---|---|
| Checkout (COD) | — | PROCESSING |
| Checkout (BACS) | — | ON_HOLD |
| Quick Buy (COD) | — | PROCESSING |
| Quick Buy (BACS) | — | ON_HOLD |
| POS (CASH/CARD) | — | COMPLETED |
| POS (CREDIT) | — | COMPLETED |
| Admin updateOrderStatus | any | admin-controlled |

### CartStatus values (confirmed from code)

| Value | Trigger |
|---|---|
| ACTIVE | Created (guest or customer) |
| MERGED | Guest cart merged into customer cart |
| CONVERTED | Checkout completed |
| ABANDONED | (not set by any current code path — schema exists) |
| EXPIRED | (not set by any current code path — schema has `expires_at` column) |

`ABANDONED` and `EXPIRED` are schema values with no active transition logic — no cleanup scheduler confirmed in this domain. `CONFIRMED_FROM_CODE` for ACTIVE/MERGED/CONVERTED; `SCHEMA_ONLY` for ABANDONED/EXPIRED.

### PaymentRecordStatus values (payments table)

| Value | When set |
|---|---|
| PENDING | buildPayment() at checkout/quickBuy/POS cash |
| PAID | Admin updatePaymentStatus() |
| PARTIALLY_PAID | Admin updatePaymentStatus() |
| FAILED | Admin updatePaymentStatus() |
| REFUNDED | createRefund() when fully refunded |

`PARTIALLY_REFUNDED` and `CANCELLED` exist as enum values in admin contracts.js but no write path to set them in the current checkout domain was found.

---

## 11. Concurrency and Race Condition Audit

| Scenario | Mechanism | Assessment |
|---|---|---|
| Two concurrent add-to-cart for last unit | CartService validates against `quantityOnHand` without DB lock; stock decrement happens at checkout | TOCTOU window exists between cart add and checkout. Checkout's FOR UPDATE lock is the authoritative guard. |
| Two concurrent checkout with same product | `syncPricesAndValidateStock()` uses `findByIdForUpdate()` (pessimistic lock) | ✅ Protected |
| Two concurrent coupon apply on same cart | `cartCouponRepo.saveAndFlush()` triggers V73 UNIQUE constraint + DataIntegrityViolationException catch | ✅ Protected |
| Two concurrent coupon redeem at checkout | `couponRepo.attemptRedeem()` conditional UPDATE | ✅ Protected |
| Two concurrent order status updates | `@Version` on `OrderEntity` (V67) → ObjectOptimisticLockingFailureException → 409 | ✅ Protected |
| Two concurrent checkouts with same idempotency key | `checkout_idempotency_keys` UNIQUE constraint + DataIntegrityViolationException | ✅ Protected |
| WS push while order transaction still open | `TransactionSynchronization.afterCommit()` defers push | ✅ Correct |

---

## 12. Cross-Surface Coverage

| Feature | bigbike-web | bigbike-admin | bigbike_mobile |
|---|---|---|---|
| Cart: view/add/update/remove | ✅ Full | N/A | ✅ Full |
| Cart: apply/remove coupon | ✅ Full | N/A | Not found (NEEDS_VERIFICATION) |
| Checkout from cart | ✅ Full | N/A | ✅ Full |
| Quick Buy | ✅ (`submitQuickBuy`) | N/A | Partial (checkout_screen covers it) |
| Order confirmation page | ✅ Server-side with lookup | N/A | ✅ OrderConfirmationScreen |
| Guest order lookup | ✅ | N/A | Not confirmed |
| Customer order list/detail | ✅ | N/A | ✅ |
| Customer return creation | ✅ (order detail page) | N/A | ✅ |
| Admin order list + filters | N/A | ✅ | N/A |
| Admin order detail | N/A | ✅ | N/A |
| Admin order status update | N/A | ✅ | N/A |
| Admin refund | N/A | ✅ | N/A |
| Admin order notes | N/A | ✅ | N/A |
| Real-time order notification (WS) | N/A | ✅ | N/A |

---

## 13. Known Gaps and Unverified Items

| Item | Status | Notes |
|---|---|---|
| Mobile coupon apply/remove | `NOT_FOUND_IN_REVIEWED_FILES` | No coupon UI found in `cart_screen.dart`; may exist elsewhere |
| Mobile guest order lookup | `NOT_FOUND_IN_REVIEWED_FILES` | `api_endpoints.dart` not confirmed to include `/orders/lookup` |
| Admin sort param `createdAt` mapping | `NEEDS_VERIFICATION` | See MED-002 |
| `ORDER_PAYMENT_STATUS_CHANGED` admin frontend handling | `NEEDS_VERIFICATION` | See MED-001 |
| Cart ABANDONED status lifecycle | `SCHEMA_ONLY` | No write path or cleanup scheduler found |
| Cart EXPIRED status lifecycle | `SCHEMA_ONLY` | `expires_at` column exists but no expiry logic found |
| `orderNotificationService.sendAdminNewOrderNotification()` | `NOT_FULLY_AUDITED` | Confirmed it exists and is called; email templates/config not verified |
| `BACS` payment flow (bank transfer) | `CONFIRMED_SCHEMA` | Order created ON_HOLD; no SePay/bank reconciliation in active code (SePay was removed in V59) |
| `ORDER_STATUS_CHANGED` admin frontend handler | `CONFIRMED_FROM_TESTS` | Test logs confirm it's sent; frontend handler code not deep-read |

---

## 14. Docs Update Required

Based on this audit, the following documentation updates are needed:

| Doc | Update needed |
|---|---|
| `BUSINESS_RULES.md` — WebSocket section | Add `ORDER_PAYMENT_STATUS_CHANGED` as confirmed event type; mark `ORDER_STATUS_CHANGED` as `CONFIRMED_FROM_TESTS` |
| `BUSINESS_RULES.md` — Cart rules | Add `MED-004` caveat: guest merge does not re-validate stock |
| `STATE_MACHINES.md` — CartStatus | Note `ABANDONED` and `EXPIRED` as `SCHEMA_ONLY` (no active lifecycle logic) |
| `STATE_MACHINES.md` — PaymentRecordStatus | Note `PARTIALLY_REFUNDED` and `CANCELLED` as `SCHEMA_ONLY` in checkout domain |
| `PERMISSION_MATRIX.md` | Add `CRIT-001` finding: `products.read`/`products.update` test failure note |
| `API_CONTRACT.md` | Add admin sort param mapping (after MED-002 verified); document anonymous idempotency scope caveat |
| `DOCS_VERIFICATION_REPORT.md` | Section 3: Flag CRIT-001 as code issue requiring fix before shipping |

---

## 15. Summary Scorecard

| Category | Result |
|---|---|
| Core cart/checkout/order backend tests | ✅ 126/126 PASS |
| Inventory backend tests | ❌ 4/28 PASS (CRIT-001) |
| Web lint | ⚠️ 1 warning (MED-003) |
| Flutter tests | NOT_RUN |
| CRITICAL issues | 1 (CRIT-001: inventory permission regression) |
| HIGH issues | 2 (HIGH-001: anon idempotency scope; HIGH-002: cookie secure=false) |
| MEDIUM issues | 4 (MED-001 through MED-004) |
| LOW issues | 4 (LOW-001 through LOW-004) |
| Business rules confirmed | All cart/checkout/coupon/Quick Buy rules — CONFIRMED_FROM_CODE |
| State machine accuracy | CartStatus 5 values confirmed; ABANDONED/EXPIRED = SCHEMA_ONLY |
| API contract drift | Returns endpoints (unboxed DTO) — existing documented drift only |
| New drift discovered | `ORDER_PAYMENT_STATUS_CHANGED` WS event undocumented |

**Overall domain health:** Cart + Checkout + Coupon + Quick Buy core is well-implemented with proper concurrency guards. The only blocking issue before production is CRIT-001 (inventory permission regression), which does not affect this domain directly but indicates a risk in the permission system. HIGH-001 and HIGH-002 should be addressed before first public traffic at scale.
