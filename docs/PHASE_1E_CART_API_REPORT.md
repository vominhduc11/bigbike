# PHASE 1E — CART SERVICE + CART API REPORT

**Date:** 2026-04-21  
**Status:** COMPLETE  
**Tests:** 112 pass (25 new), 0 fail

---

## A. Summary

Phase 1E implements the full cart service and REST API for the BigBike rewrite. It enables:

- **Guest carts** via an opaque `bb_guest_id` UUID cookie (not a secret token), scoped to `carts.session_id`
- **Authenticated customer carts** resolved by `customer_id` from the existing customer session
- **Cart CRUD**: get, add item, update quantity, remove item, clear cart
- **Product snapshot**: name, SKU, unit price captured at add-time; survives product edits
- **BigDecimal totals**: lineSubtotal/lineDiscount/lineTotal per item; subtotal/discount/shipping/fee/total per cart
- **CSRF protection** on all cart mutations (POST/PATCH/DELETE)
- **Ownership scoping**: items are checked against current cart; cross-session access returns 404

This is the foundation for Phase 1F checkout/quick-buy and Phase 1G order read API.

---

## B. Files Changed

### New — Production

| File | Description |
|------|-------------|
| `api/cart/CartController.java` | REST endpoints, cookie management, DTO mapping |
| `api/cart/dto/AddCartItemRequest.java` | Request DTO — add item |
| `api/cart/dto/UpdateCartItemRequest.java` | Request DTO — update quantity |
| `api/cart/dto/CartItemResponse.java` | Response DTO — cart item |
| `api/cart/dto/CartTotalsResponse.java` | Response DTO — cart totals |
| `api/cart/dto/CartResponse.java` | Response DTO — full cart |
| `service/cart/CartService.java` | Cart business logic, session resolution, product snapshot |
| `service/cart/CartCalculator.java` | Pure BigDecimal line and cart total calculation |
| `persistence/repository/catalog/ProductVariantJpaRepository.java` | Variant lookup by ID + product ID |

### Modified — Production

| File | Change |
|------|--------|
| `persistence/repository/commerce/cart/CartJpaRepository.java` | Added `findByCustomerIdAndStatus` |
| `config/SecurityConfig.java` | Added `permitAll` for `/api/v1/cart/**` |

### New — Test

| File | Description |
|------|-------------|
| `test/.../api/Phase1ECartApiTest.java` | 25 cart API tests |

### New — Docs

| File | Description |
|------|-------------|
| `docs/PHASE_1E_CART_API_REPORT.md` | This report |

---

## C. API Endpoints

### GET /api/v1/cart

| Field | Value |
|-------|-------|
| Auth | None required (guest or customer) |
| CSRF | Not required (safe method) |
| Session cookies set | `bb_guest_id` (UUID, not HttpOnly) + `bb_csrf` (UUID, not HttpOnly) for new guests |
| Response | `ApiDataResponse<CartResponse>` |

### POST /api/v1/cart/items

| Field | Value |
|-------|-------|
| Auth | None required (guest or customer) |
| CSRF | Required (`bb_csrf` cookie == `X-CSRF-Token` header) |
| Request | `{ "productId": "string", "productVariantId": "string|null", "quantity": int≥1 }` |
| Errors | 400 qty≤0, 404 product not found, 409 product not published |
| Response | Updated `ApiDataResponse<CartResponse>` |

### PATCH /api/v1/cart/items/{itemId}

| Field | Value |
|-------|-------|
| Auth | None required (guest or customer) |
| CSRF | Required |
| Request | `{ "quantity": int≥1 }` |
| Errors | 400 qty≤0, 404 item not found or not owned by current cart |
| Response | Updated `ApiDataResponse<CartResponse>` |

### DELETE /api/v1/cart/items/{itemId}

| Field | Value |
|-------|-------|
| Auth | None required (guest or customer) |
| CSRF | Required |
| Errors | 404 item not found or not owned by current cart |
| Response | Updated `ApiDataResponse<CartResponse>` |

### DELETE /api/v1/cart

| Field | Value |
|-------|-------|
| Auth | None required (guest or customer) |
| CSRF | Required |
| Response | Empty cart `ApiDataResponse<CartResponse>` |

---

## D. Service Design

### Cart Resolution

```
Authenticated customer (bb_session cookie valid):
  → find CartEntity by customer_id + status=ACTIVE
  → if none: create new ACTIVE cart with customer_id

Guest (bb_session absent):
  → read bb_guest_id cookie
  → if absent: generate UUID, set bb_guest_id cookie + bb_csrf cookie
  → find CartEntity by session_id = guestId
  → if none: create new ACTIVE cart with session_id = guestId
```

### Token Storage Safety

- `bb_session` raw token: NEVER stored in carts table. Used only for auth lookup (hashed in customer_sessions).
- `bb_guest_id`: plain UUID, opaque cart identifier. NOT a secret auth token. Stored as `carts.session_id`.
- `bb_csrf` for guests: plain UUID, set as non-HttpOnly cookie. Frontend reads it and sends as `X-CSRF-Token` header.

### Product Snapshot

When an item is added to the cart:
- `productName` ← `product.name` at add-time
- `sku` ← `variant.sku ?? product.sku`
- `variantName` ← `variant.name` if variant provided
- `unitPrice` ← `salePrice ?? retailPrice` (variant price overrides product price if present)
- `regularPrice` ← `product.retailPrice`
- `salePrice` ← `product.salePrice`

Subsequent product edits do NOT affect the cart snapshot. The snapshot is permanent until item is removed.

### Product ID / Variant ID Mapping

`products.id` is `varchar(64)` (string, may not be UUID-format).  
`cart_items.product_id` is `uuid`.

The service attempts `UUID.fromString(product.id)` — if the string is UUID-format, it stores the UUID; otherwise `productId` remains null in the cart item. The snapshot (name, sku, price) is always correctly stored regardless.

For the new stack (greenfield), products created with UUID string IDs will have proper FK-style references in cart items.

### Calculation Rules

```
lineSubtotal = unitPrice × quantity  (BigDecimal, scale=2, HALF_UP)
lineDiscount = 0  (Phase 1E — coupon deferred)
lineTotal    = lineSubtotal − lineDiscount
cart.subtotalAmount  = Σ lineSubtotal
cart.discountAmount  = Σ lineDiscount
cart.shippingAmount  = 0  (Phase 1E)
cart.feeAmount       = 0  (Phase 1E)
cart.totalAmount     = subtotal − discount + shipping + fee
```

No floating-point arithmetic. All monetary values use `BigDecimal` with consistent scale.

---

## E. Security Design

| Concern | Design |
|---------|--------|
| CSRF on cart GET | Exempt (safe method) |
| CSRF on cart mutations | Enforced by `CustomerCsrfFilter` (double-submit cookie pattern) |
| Admin Bearer JWT | `/api/v1/admin/**` exempt from CSRF — unchanged |
| Customer login/register | `/api/v1/customer/auth/register|login|refresh` exempt — unchanged |
| Cart permitAll | SecurityConfig permits `/api/v1/cart/**` for anonymous access |
| Item ownership | `findOwnedItem` checks `item.cart.id == currentCart.id`; returns 404 on mismatch (no info leak) |
| Raw token in DB | Never — `bb_session` token hash only in `customer_sessions.session_token_hash`; `bb_guest_id` is a plain UUID cart identifier |

---

## F. Tests Added / Updated

**Class:** `Phase1ECartApiTest` — 25 tests

| Test | Covers |
|------|--------|
| `getCart_withoutExistingCart_returnsEmptyOrCreatesCart` | Guest init flow, bb_guest_id cookie |
| `guestCart_usesSessionWithoutRawTokenStorage` | UUID in session_id, no customer_id |
| `addItem_withValidProduct_createsCartItem` | Full add item flow, CSRF, snapshot |
| `addSameItem_incrementsQuantity` | Dedup logic — qty incremented, one item |
| `addItem_productNotFound_returns404` | 404 on missing product |
| `addItem_productUnpublished_returns409` | 409 on DRAFT product |
| `addItem_missingCsrf_forbidden` | CSRF_INVALID 403 |
| `updateItem_missingCsrf_forbidden` | CSRF_INVALID 403 |
| `deleteItem_missingCsrf_forbidden` | CSRF_INVALID 403 |
| `updateItemQuantity_recalculatesTotals` | qty change → correct totals |
| `updateItemQuantity_zeroRejected` | 400 on qty=0 |
| `updateItemQuantity_negativeRejected` | 400 on qty=-1 |
| `removeItem_removesOnlyCurrentCartItem` | Removes specific item, others intact |
| `cartItemCannotBeModifiedFromDifferentSession` | Cross-session ownership isolation (404) |
| `clearCart_removesAllItems` | All items gone, totals=0 |
| `cartTotals_useBigDecimalSnapshot` | Precise BigDecimal arithmetic |
| `productSnapshot_preservedAfterProductChange` | Snapshot survives product mutation |
| `authenticatedCustomerCart_createdForCustomer` | Customer session → customer cart |
| `authenticatedCustomerCart_addItemRequiresCsrf` | Authenticated customer also needs CSRF |
| `authenticatedCustomerCart_addItemWithCsrf_succeeds` | Authenticated customer add with CSRF |
| `publicCatalog_stillPublic` | GET /api/v1/products still public |
| `adminEndpoint_stillProtected` | Admin still 401 without JWT |
| `customerMe_stillWorks` | Phase 1D customer session still works |
| `customerLogout_stillRequiresCsrf` | Phase 1D logout still needs CSRF |
| `existing67TestsStillPass_adminAuthStillProtected` | Sanity regression check |

**Prior test count:** 87  
**New test count:** 112  
**New Phase 1E tests:** 25

---

## G. Commands Executed

| Command | Result |
|---------|--------|
| `cd bigbike-backend && ./mvnw test` | PASS — 112 tests, 0 failures |

---

## H. Remaining Risks

### Deferred: Coupon Engine (Phase 1F)
- `cart.discountAmount` is always 0 in Phase 1E
- `coupons` table exists (V5 migration), basic schema ready
- Deferred because coupon business rules (min order, usage limit, per-customer tracking) require more scope clarity
- `lineDiscount` infrastructure is in place (set to 0 now)

### Deferred: Cart Merge After Login (Phase 1F)
- When a guest with an existing cart logs in, their guest cart is NOT merged into their customer cart
- Current behavior: after login, a new customer cart is created; guest cart persists but is abandoned
- Full merge logic (dedup, quantity add) deferred to Phase 1F checkout planning

### Deferred: Shipping / Tax (Phase 1G+)
- `shippingAmount` and `feeAmount` always 0
- Infrastructure columns exist in `carts`

### Product ID Type Mismatch
- `products.id` = varchar(64); `cart_items.product_id` = uuid
- Cart items for products with non-UUID string IDs will have `product_id = null` (snapshot still complete)
- This is acceptable for Phase 1E; will normalize in migration phase

### Product Availability Assumption
- Phase 1E only checks `publishStatus == PUBLISHED`
- `stockState` (IN_STOCK, OUT_OF_STOCK, etc.) is not checked for cart add
- PRE-ORDER and CONTACT_FOR_STOCK are allowed implicitly
- Stricter availability check can be added in Phase 1F without breaking changes

---

## I. Recommended Next Tasks

1. **Phase 1F — Checkout / Quick-Buy Service + Order Creation API**
   - Convert ACTIVE cart to ORDER
   - Guest checkout (collect contact info without registration)
   - Cart merge after login
   - Basic coupon foundation (fixed/percent)

2. **Phase 1G — Order Read API + Customer Account Orders**
   - GET /api/v1/customer/orders
   - GET /api/v1/customer/orders/{orderId}
   - Order status tracking

3. **Phase 2 — WordPress Migration Layer**
   - Import products, categories, brands, orders from WP DB dump

4. **Phase 3 — Main Web Legacy URL / SEO Alignment**
   - 301 redirect rules in SEO_REDIRECT_MAP.csv
   - /sp/{slug}.html → /product/{slug}/

5. **Phase 4 — Admin Order / Customer / Media Modules**

---

## J. Safety Check

| Constraint | Status |
|------------|--------|
| No secrets committed | ✅ No .env, no hardcoded keys |
| No frontend changes | ✅ Only bigbike-backend touched |
| No checkout/order creation | ✅ CartService.clearCart is the furthest — no order entity created |
| No payment gateway | ✅ Not touched |
| No WordPress import | ✅ Not touched |
| No raw token in DB | ✅ `carts.session_id` stores guest UUID (non-secret); `bb_session` hash only in `customer_sessions` |
| Admin auth intact | ✅ 112 tests pass including AdminAuthApiTest, AdminAuthSecurityTest |
| Customer auth intact | ✅ Phase1DCustomerAuthTest 20/20 pass |
| No breaking migration changes | ✅ No new Flyway migration; no V1-V9 changes |
| Spring Boot version unchanged | ✅ Still 4.0.5 / Java 17 / Maven |
