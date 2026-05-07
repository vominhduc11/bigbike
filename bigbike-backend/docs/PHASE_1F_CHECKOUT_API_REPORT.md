HISTORICAL_REPORT_ONLY - Not canonical. Validate against current code and canonical docs.

# Phase 1F — Checkout / Quick-buy API Report

## Summary

Implemented checkout-to-order conversion, quick-buy, and checkout options endpoints for the BigBike backend. Both guest and authenticated customer flows are supported. All 26 new tests pass; full suite 138/138 green.

---

## API Endpoints

| Method | Path | Auth | CSRF |
|--------|------|------|------|
| `POST` | `/api/v1/checkout` | Guest or Customer | Required |
| `POST` | `/api/v1/orders/quick-buy` | Guest or Customer | Required |
| `GET` | `/api/v1/checkout/options` | Public | Not required |

---

## Files Created

| File | Purpose |
|------|---------|
| `api/checkout/dto/CheckoutAddressRequest.java` | Billing address input record |
| `api/checkout/dto/CheckoutShippingAddressRequest.java` | Shipping address input record (optional override) |
| `api/checkout/dto/CheckoutRequest.java` | POST /checkout request body |
| `api/checkout/dto/QuickBuyRequest.java` | POST /orders/quick-buy request body |
| `api/checkout/dto/OrderSummaryResponse.java` | Response for created order |
| `api/checkout/dto/PaymentMethodOptionResponse.java` | Options list item |
| `api/checkout/dto/ShippingMethodOptionResponse.java` | Options list item |
| `api/checkout/dto/CheckoutOptionsResponse.java` | GET /checkout/options response |
| `api/checkout/CheckoutController.java` | Controller for all 3 endpoints |
| `service/checkout/CheckoutService.java` | Core checkout/quick-buy business logic |
| `service/checkout/OrderNumberGenerator.java` | Human-readable order number (`BB-YYYYMMDD-XXXXXX`) |
| `service/checkout/OrderKeyGenerator.java` | Secret order key (`bb_order_<20hex>`) |
| `test/.../Phase1FCheckoutApiTest.java` | 26 integration tests |

## Files Modified

| File | Change |
|------|--------|
| `persistence/repository/shipping/ShippingMethodJpaRepository.java` | Added `findByEnabledOrderBySortOrderAsc(boolean)` |
| `config/SecurityConfig.java` | Added permitAll for checkout + quick-buy + options endpoints |

---

## Business Logic

### Order status mapping
| Payment method | Order status | Payment status | Payment record |
|----------------|-------------|----------------|----------------|
| `COD` | `PROCESSING` | `UNPAID` | `PENDING` |
| `BACS` | `ON_HOLD` | `UNPAID` | `PENDING` |

### Address handling
- `billingAddress` is always required (validated: fullName, phone 10 digits, email if present must contain `@`, addressLine1 required)
- `shippingAddress`: if `null` or `sameAsBilling: true`, billing address is copied to shipping
- Both `BILLING` and `SHIPPING` address records are always created in `order_addresses`

### Shipping method resolution
- If `shippingMethodId` provided: validated (must exist + enabled)
- If `shippingMethodId` is null: auto-selected if exactly 1 enabled method exists; otherwise 400
- Current seed: 1 enabled method (`COD / 00000000-0000-0000-0000-000000000401`, cost=0)

### Cart → Order conversion (`POST /api/v1/checkout`)
1. Validates cart is non-empty
2. Validates address, payment method, shipping method
3. Builds `OrderEntity` with totals
4. Saves `OrderLineItemEntity` records from cart item snapshots
5. Saves `BILLING` and `SHIPPING` `OrderAddressEntity`
6. Saves `OrderShippingItemEntity`
7. Saves `PaymentEntity` (status=PENDING)
8. Saves system `OrderNoteEntity`
9. Marks cart `status = CONVERTED`
10. Returns `OrderSummaryResponse`

### Quick-buy (`POST /api/v1/orders/quick-buy`)
- No cart required; creates order directly from product lookup
- Product must be `PUBLISHED`; variant (if given) must be `available`
- Unit price: variant sale → variant retail → product sale → product retail
- Billing address also used as shipping address (no separate shipping address input)

---

## Deferred Items

- **Coupon engine** — schema exists (`coupons` table), but usage tracking, per-customer limits, and discount calculation need design clarity before implementation.
- **Cart merge after login** — `CustomerAuthController.login()` does not receive `bb_guest_id`, so merging guest cart items into the authenticated customer cart cannot be done cleanly without modifying the login endpoint. Deferred to a dedicated phase.

---

## Test Coverage (26 tests)

### Checkout Options (2)
- `getOptions_returnsPaymentAndShippingMethods` — 2 payment methods, 1 enabled shipping method
- `getOptions_doesNotRequireCsrf` — GET is CSRF-safe

### CSRF Protection (2)
- `checkout_missingCsrf_returns403`
- `quickBuy_missingCsrf_returns403`

### Address / Payload Validation (6)
- `checkout_emptyCart_returns400`
- `checkout_invalidPaymentMethod_returns400`
- `checkout_missingFullName_returns400`
- `checkout_missingPhone_returns400`
- `checkout_invalidPhone_returns400` (9 digits → rejected)
- `checkout_missingAddressLine1_returns400`

### Shipping Method Selection (3)
- `checkout_shippingMethodAutoSelected_whenOnlyOneEnabled`
- `checkout_shippingMethodById_accepted`
- `checkout_disabledShippingMethod_returns400`

### Guest Checkout Happy Path (5)
- `checkout_guestCOD_createsOrder_status_PROCESSING`
- `checkout_guestBACS_createsOrder_status_ON_HOLD`
- `checkout_guestOrder_paymentStatus_UNPAID`
- `checkout_guestOrder_totalMatchesCartItems` — 2 × 3,000,000 = 6,000,000 VND
- `checkout_cartMarkedConverted_afterCheckout`

### Authenticated Checkout (2)
- `checkout_authenticatedCustomer_createsOrder`
- `checkout_authenticatedCustomer_orderInDB` — verifies DB record via `findByOrderNumber`

### Shipping Address (1)
- `checkout_shippingAddress_sameAsBilling_accepted`

### Quick-buy (5)
- `quickBuy_guestCOD_createsOrder`
- `quickBuy_guestBACS_createsOrder_statusOnHold`
- `quickBuy_productNotFound_returns404`
- `quickBuy_unpublishedProduct_returns409`
- `quickBuy_invalidPaymentMethod_returns400`

---

## Test Results

```
[INFO] Tests run: 26, Failures: 0, Errors: 0, Skipped: 0  — Phase1FCheckoutApiTest
[INFO] Tests run: 138, Failures: 0, Errors: 0, Skipped: 0  — full suite
[INFO] BUILD SUCCESS
```
