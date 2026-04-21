# Phase 1C — Order / Cart / Payment Schema Foundation

**Status:** COMPLETE  
**Date:** 2026-04-21  
**Tests:** 67 passed (50 prior + 17 new), 0 failed, 0 skipped

---

## A. Summary

Phase 1C establishes the persistence foundation for BigBike's commerce core: cart, order, and payment domains. No business logic, no API endpoints, no payment gateway integration — only the schema and JPA layer needed by downstream phases.

**Why this layer is needed:**

| Consumer | Requires |
|----------|----------|
| Phase 1D — Customer Session + CSRF | `carts`, `CartJpaRepository.findBySessionId` |
| Phase 1E — Cart/Checkout API | All cart + order tables, snapshot design |
| Phase 2 — WordPress Migration | `orders.legacy_id`, `order_line_items.legacy_item_id`, `order_applied_coupons`, `order_addresses` |
| Phase 3 — Admin Order Module | All order sub-tables, `payments`, `payment_events` |
| Phase 4 — Payment Reconciliation | `payment_events`, `PaymentEventJpaRepository.findByEventId` |

---

## B. Files Changed

### New migrations
- [db/migration/V6__create_cart_tables.sql](../bigbike-backend/src/main/resources/db/migration/V6__create_cart_tables.sql)
- [db/migration/V7__create_order_tables.sql](../bigbike-backend/src/main/resources/db/migration/V7__create_order_tables.sql)
- [db/migration/V8__create_payment_tables.sql](../bigbike-backend/src/main/resources/db/migration/V8__create_payment_tables.sql)

### New domain enums (`domain.commerce`)
- `CartStatus`, `OrderStatus`, `PaymentStatus`, `FulfillmentStatus`
- `PaymentRecordStatus`, `OrderNoteType`, `AddressType`

### New entities (`persistence.entity.commerce.*`)
- `cart/CartEntity`, `cart/CartItemEntity`
- `order/OrderEntity`, `order/OrderLineItemEntity`, `order/OrderShippingItemEntity`
- `order/OrderFeeItemEntity`, `order/OrderAppliedCouponEntity`
- `order/OrderAddressEntity`, `order/OrderNoteEntity`
- `payment/PaymentEntity`, `payment/PaymentEventEntity`

### New repositories (`persistence.repository.commerce.*`)
- `cart/CartJpaRepository`, `cart/CartItemJpaRepository`
- `order/OrderJpaRepository`, `order/OrderLineItemJpaRepository`
- `order/OrderShippingItemJpaRepository`, `order/OrderFeeItemJpaRepository`
- `order/OrderAppliedCouponJpaRepository`, `order/OrderAddressJpaRepository`
- `order/OrderNoteJpaRepository`
- `payment/PaymentJpaRepository`, `payment/PaymentEventJpaRepository`

### New test
- [Phase1CCommerceSchemaTest.java](../bigbike-backend/src/test/java/com/bigbike/bigbike_backend/schema/Phase1CCommerceSchemaTest.java)

### New report
- `docs/PHASE_1C_COMMERCE_SCHEMA_REPORT.md` (this file)

---

## C. Database Migrations

### V6 — carts + cart_items

| Table | Key fields | Constraints |
|-------|-----------|-------------|
| `carts` | `customer_id` nullable FK → customers, `session_id` nullable | — |
| `cart_items` | `cart_id` FK cascade, `product_name text NOT NULL`, `quantity int NOT NULL` | `ck_cart_items_quantity check (quantity > 0)` |

Indexes: `carts(customer_id, session_id, status, expires_at)`, `cart_items(cart_id, product_id, product_variant_id, sku)`

### V7 — orders + 6 sub-tables

| Table | Key fields | Constraints |
|-------|-----------|-------------|
| `orders` | `legacy_id UNIQUE`, `order_number UNIQUE`, `order_key UNIQUE`, `customer_id` nullable FK | — |
| `order_line_items` | `order_id` FK cascade, snapshot fields | `check (quantity > 0)` |
| `order_shipping_items` | `order_id` FK cascade, `shipping_method_id` nullable FK | — |
| `order_fee_items` | `order_id` FK cascade | — |
| `order_applied_coupons` | `order_id` FK cascade, `coupon_id` nullable FK | — |
| `order_addresses` | `order_id` FK cascade, `type NOT NULL` | — |
| `order_notes` | `order_id` FK cascade, append-only (no `updated_at`) | — |

Indexes: 10 on `orders`, plus child table indexes on all FK and query columns.

### V8 — payments + payment_events

| Table | Key fields | Constraints |
|-------|-----------|-------------|
| `payments` | `order_id` FK cascade, `transaction_id`, `provider_reference` | — |
| `payment_events` | `payment_id` nullable FK cascade, `order_id` nullable FK cascade | — |

`payment_events` has no `updated_at` — append-only event log design.

---

## D. Domain Packages

### Enums (`domain.commerce`)

| Enum | Values |
|------|--------|
| `CartStatus` | ACTIVE, MERGED, ABANDONED, CONVERTED, EXPIRED |
| `OrderStatus` | PENDING, PROCESSING, ON_HOLD, COMPLETED, CANCELLED, REFUNDED, FAILED |
| `PaymentStatus` | UNPAID, PENDING, PAID, PARTIALLY_PAID, FAILED, REFUNDED, CANCELLED |
| `FulfillmentStatus` | UNFULFILLED, PROCESSING, SHIPPED, DELIVERED, RETURNED, CANCELLED |
| `PaymentRecordStatus` | PENDING, SUCCEEDED, FAILED, CANCELLED, REFUNDED |
| `OrderNoteType` | SYSTEM, ADMIN, CUSTOMER, PAYMENT, SHIPPING, MIGRATION |
| `AddressType` | BILLING, SHIPPING |

Status fields are stored as `varchar` in DB (not `@Enumerated`) for migration flexibility. Enums exist for application-layer type-safety when needed.

### Repositories — key query methods

| Repository | Methods |
|------------|---------|
| `CartJpaRepository` | `findByCustomerId`, `findBySessionId`, `findByStatus`, `findByExpiresAtBefore` |
| `CartItemJpaRepository` | `findByCartId` |
| `OrderJpaRepository` | `findByLegacyId`, `findByOrderNumber`, `findByOrderKey`, `findByCustomerId`, `findByStatus`, `findByPaymentStatus`, `findByCustomerPhone`, `findByCustomerEmail` |
| `OrderLineItemJpaRepository` | `findByOrderId`, `findByLegacyItemId` |
| `OrderShippingItemJpaRepository` | `findByOrderId` |
| `OrderFeeItemJpaRepository` | `findByOrderId` |
| `OrderAppliedCouponJpaRepository` | `findByOrderId`, `findByCode` |
| `OrderAddressJpaRepository` | `findByOrderId`, `findByOrderIdAndType` |
| `OrderNoteJpaRepository` | `findByOrderId`, `findByOrderIdOrderByCreatedAtAsc` |
| `PaymentJpaRepository` | `findByOrderId`, `findByStatus`, `findByTransactionId`, `findByProviderReference` |
| `PaymentEventJpaRepository` | `findByPaymentId`, `findByOrderId`, `findByProvider`, `findByEventId` |

---

## E. Design Decisions

### Order line items are snapshots, not FK-dependent
`order_line_items.product_id` and `product_variant_id` are nullable UUIDs, not foreign keys to `products`/`product_variants`. Product data (name, SKU, price) is copied at order creation time.

**Why:** Catalog prices and SKUs change over time. An order from 2023 must reflect the price at placement, not today's price. During WordPress migration, many legacy orders reference products that no longer exist in the same form.

### `customer_id` is nullable on both `carts` and `orders`
Guest checkout is a first-class use case. BigBike's WooCommerce data (from `ajax-functions.php:381`) shows quick-buy orders created without a matching customer account. The new schema supports the same pattern.

### `payment_events` is a separate table
Payment webhooks (SePay, PayPal, bank transfer callbacks) arrive asynchronously and must be stored raw for idempotency, replay, and reconciliation — regardless of whether the corresponding `payment` record exists yet. Decoupling events from payments also allows storing webhook delivery failures for retry.

### No FK from `order_shipping_items` to `shipping_methods` (soft reference)
`shipping_method_id` is stored as a bare UUID column (no `@ManyToOne`). At order time, the shipping method snapshot (`method_code`, `method_title`, `amount`) is the authoritative record. The FK is advisory only — if a shipping method is deleted, the order snapshot remains intact.

### `order_applied_coupons.coupon_id` is nullable
A migrated WooCommerce order may reference a coupon code that was deleted or never migrated. The `code` column (varchar) is always present and serves as the functional identifier.

### `order_notes` and `order_applied_coupons` have no `updated_at`
These are append-only records. Notes are never edited; applied coupons are never modified after placement. Omitting `updated_at` signals immutability to future developers.

---

## F. Tests Added

**Class:** `Phase1CCommerceSchemaTest` (17 tests)

| Test | What it verifies |
|------|-----------------|
| `cart_saveAndFindBySessionId` | Cart persists; `findBySessionId` works |
| `cartItem_saveAndFindByCartId` | CartItem with snapshot fields; `findByCartId` traverses FK |
| `order_saveAndFindByOrderNumber` | Order unique constraint on `order_number`; retrieval |
| `order_saveAndFindByOrderKey` | Order unique constraint on `order_key`; retrieval |
| `orderLineItem_saveAndFindByOrderId` | Line item with price snapshot; `findByOrderId` |
| `orderShippingItem_saveAndFindByOrderId` | Shipping snapshot; `findByOrderId` |
| `orderFeeItem_saveAndFindByOrderId` | Fee item; `findByOrderId` |
| `orderAppliedCoupon_saveAndFindByCode` | Coupon application; `findByCode` |
| `orderAddress_saveAndFindByOrderIdAndType` | Address snapshot; `findByOrderIdAndType` |
| `orderNote_saveAndFindByOrderId` | Note with `findByOrderIdOrderByCreatedAtAsc` |
| `payment_saveAndFindByOrderId` | Payment record; `findByOrderId` |
| `paymentEvent_saveAndFindByEventId` | Event with null FK; `findByEventId` |
| `guestOrder_customerIdNullable` | `customer_id = null` is valid; guest phone lookup works |
| `orderSnapshot_doesNotRequireProductFk` | `product_id = null` accepted; snapshot design confirmed |
| `securityRegression_adminStillProtected` | `GET /api/v1/admin/products` → 401 (Phase 1A intact) |
| `authRegression_loginStillWorks` | `POST /api/v1/auth/login` → 400 (endpoint reachable) |
| `publicReadRegression_stillPublic` | `GET /api/v1/products` → 200 (public catalog intact) |

---

## G. Commands Executed

| Command | Result |
|---------|--------|
| `./mvnw test` | **PASS** — 67 tests, 0 failures |

`docker compose config` and `docker compose up -d postgres redis minio` were not run — the task scope is backend Java only and H2 in-memory DB is used for all tests.

---

## H. Remaining Risks

| Risk | Notes |
|------|-------|
| No `order_status_history` table | Status transition audit is not tracked. Add in Phase 1D or 2 if needed for WooCommerce migration fidelity. |
| `cart_items.quantity > 0` enforced by DB check only | Application code must validate before save to surface friendly errors rather than DB exceptions. |
| `payment_events` can reference both a `payment_id` and `order_id` simultaneously | Deduplication logic (idempotency key on `event_id`) is the application's responsibility; not enforced by schema. |
| `orders.order_key` unique constraint | During WC migration, duplicates may exist in legacy data. The migration runner must deduplicate or suffix them. |
| No `@Transactional` on test fixture helpers | Each test saves in default transaction scope. Parallel test execution could expose isolation issues. Currently not a problem with H2 in-memory. |

---

## I. Recommended Next Tasks

1. **Phase 1D — Customer Auth + Session + CSRF foundation**  
   Bind customer login to cart (`CartJpaRepository.findBySessionId`), implement CSRF token for checkout form, customer refresh token flow.

2. **Phase 1E — Cart/Checkout Service + API**  
   `POST /api/v1/cart/add`, `POST /api/v1/checkout`, order creation service using Phase 1B/1C schema.

3. **Phase 2 — WordPress WooCommerce Order Migration**  
   ETL from `kd_wc_orders`, `kd_woocommerce_order_items`, `kd_wc_order_addresses` into Phase 1C tables. Requires `legacy_id` columns already in place.

4. **Phase 3 — Main Web Legacy URL / SEO Alignment**  
   Next.js routes aligned with WC permalink structure, using redirect table from Phase 1B.

5. **Phase 4 — Admin Order / Customer / Media Modules**  
   Admin endpoints for order management, using `OrderJpaRepository`, `PaymentJpaRepository`, `AuditLogJpaRepository`.

---

## J. Safety Check

- No secrets committed
- No frontend changes
- No checkout or cart API implemented
- No WordPress data imported
- Phase 1A auth security: confirmed passing (3 regression tests)
- Phase 1B schema: confirmed passing (all 12 smoke tests still pass)
- No Phase 1A/1B migrations modified
