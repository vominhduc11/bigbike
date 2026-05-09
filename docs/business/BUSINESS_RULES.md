# Business Rules

Only rules verified from current code, config, migration, or test are documented here.

## Catalog Availability

- Public catalog/cart/checkout only accept products with publish status `PUBLISHED`. `CONFIRMED_FROM_CODE`
- Variant add-to-cart/checkout requires the variant to be available and in stock. `CONFIRMED_FROM_CODE`
- Checkout re-syncs prices from DB before order creation and reports price changes. `CONFIRMED_FROM_CODE`

Evidence:

- `CartService.java`
- `CheckoutService.java`
- `Phase1ECartApiTest.java`
- `Phase1FCheckoutApiTest.java`

## SKU Roles

- `product.sku` is a **model/group code** — an optional descriptive identifier for the product family. It is not the selling code when variants exist. `CONFIRMED_FROM_CODE`
- `variant.sku` is the **selling SKU** — the code used at POS, cart, checkout, inventory, and returns to identify the actual unit being sold. `CONFIRMED_FROM_CODE`
- Both fields are nullable in DB (`products.sku varchar(100)`, `product_variants.sku varchar(100)`). No DB-level uniqueness constraint on either. `CONFIRMED_FROM_CODE`
- When snapshotting line items into cart/order, the system uses `variant.sku` if present, otherwise falls back to `product.sku`. This fallback covers single-variant or no-variant products where the parent SKU is the selling code. `CONFIRMED_FROM_CODE`
- Inventory search and serial-tracking views read both `p.sku` and `v.sku` so admin tools can locate units by either code. `CONFIRMED_FROM_CODE`

Evidence:

- `ProductEntity.java` (line 34)
- `ProductVariantEntity.java` (line 29)
- `PosOrderService.java` (line 233 — fallback `variant.getSku() != null ? variant.getSku() : product.getSku()`)
- `CartService.java` (line 153 — same fallback)
- `CheckoutService.java` (line 723 — same fallback)
- `V51__add_serial_tracking.sql` (lines 123, 127 — `variant_sku`, `product_sku` in `serial_inventory_view`)
- `V1__create_catalog_content_tables.sql` (lines 65, 166)

## Coupon Rules

- One coupon per cart is enforced in service logic and backed by DB uniqueness. `CONFIRMED_FROM_CODE`
- Applying a coupon locks the coupon row and validates status, expiry, usage limit, and minimum amount. `CONFIRMED_FROM_CODE`
- Cart refresh removes coupons that become invalid after apply. `CONFIRMED_FROM_CODE`
- Checkout revalidates coupons from fresh DB state and atomically increments usage. `CONFIRMED_FROM_CODE`
- Scheduler flips overdue active coupons to `EXPIRED` hourly. `CONFIRMED_FROM_CODE`

Evidence:

- `CartService.java`
- `CheckoutService.java`
- `CouponExpiryScheduler.java`
- `V73__enforce_one_coupon_per_cart.sql`
- `Phase1ECartApiTest.java`
- `Phase1FCheckoutApiTest.java`
- `Phase1JAdminSettingsMenuCouponApiTest.java`

## POS Rules

- POS endpoints require admin JWT plus `pos.read` or `pos.write`; price override requires `pos.price_override`. `CONFIRMED_FROM_CODE`
- POS sale is immediate: order status `COMPLETED`, payment status `PAID`, payment provider `POS`. `CONFIRMED_FROM_CODE`
- POS writes order snapshots including customer/staff fields when provided/available. `CONFIRMED_FROM_CODE`
- POS decrements stock immediately and writes stock movement + audit log. `CONFIRMED_FROM_CODE`
- No POS expiry cleanup lifecycle is currently documented because no live cleanup job was confirmed. `NOT_FOUND_IN_REPO`

Evidence:

- `AdminPosController.java`
- `PosOrderService.java`
- `AdminRolePermissions.java`
- `V71__add_pos_staff_and_customer_name_to_orders.sql`
- `Phase1MPosApiTest.java`

## Media Rules

- Media upload validation is server-side MIME/content validation using Apache Tika magic-byte detection. `CONFIRMED_FROM_CODE`
- Allowed MIME types include common raster images, MP4 video, and selected audio formats. `CONFIRMED_FROM_CODE`
- SVG is not in the allowlist and is rejected by test and service validation. `CONFIRMED_FROM_CODE`
- Hard delete is blocked when a media URL is still referenced. `CONFIRMED_FROM_CODE`

Evidence:

- `AdminMediaService.java`
- `AdminMediaP0Test.java`

## Inventory And Serial Rules

- Active manual inventory movement types are `IN`, `OUT`, `ADJUSTMENT`, and `RETURN`. `CONFIRMED_FROM_CODE`
- For manual stock-in, serial numbers are required and must match quantity exactly. `CONFIRMED_FROM_CODE`
- For other movement types, serials are optional but cannot exceed movement quantity. `CONFIRMED_FROM_CODE`
- Duplicate serials in request or existing DB state are rejected. `CONFIRMED_FROM_CODE`
- Current serial handling is movement-log based, not a fully modeled product-serial lifecycle table. `CONFIRMED_FROM_CODE`
- Receipt tables exist in migrations, but an active receiving service/controller is not documented. `NOT_FOUND_IN_REPO`

Evidence:

- `AdminInventoryService.java`
- `StockMovementSerialEntity.java`
- `V52__add_stock_receipts.sql`
- `V53__add_stock_receipt_lines.sql`
- `V55__add_receipt_serials.sql`
- `V57__add_stock_movement_serials.sql`

## WebSocket Rules

- WebSocket STOMP connect must include native header `Authorization: Bearer <token>`. `CONFIRMED_FROM_CODE`
- Only `ADMIN` and `SUPER_ADMIN` roles are allowed to connect. `CONFIRMED_FROM_CODE`
- Current confirmed topic is `/topic/admin/orders`. `CONFIRMED_FROM_CODE`
- Confirmed event type in checkout/POS flow is `NEW_ORDER`; `ORDER_STATUS_CHANGED` is declared in the event record comment but needs a live sender check before relying on it. `NEEDS_VERIFICATION`

Evidence:

- `WebSocketConfig.java`
- `AdminOrderWsService.java`
- `OrderWsEvent.java`
- `adminWebSocket.js`

## Redirect And Integration Rules

- Internal redirect endpoints are `permitAll` in Spring Security and are expected to be locked down at infra layer in production. `CONFIRMED_FROM_CONFIG`
- No external payment webhook/provider contract was confirmed in active repo code. `NOT_FOUND_IN_REPO`
- No external shipping carrier integration was confirmed in active repo code. `NOT_FOUND_IN_REPO`

Evidence:

- `SecurityConfig.java`
- repo search for payment/shipping providers

## Accounts Receivable Rules

AR module implemented in V75 (Flyway). Rules below are `CONFIRMED_FROM_CODE`.

- `AR_RULE_001`: Credit sale (bán chịu) is supported via POS CREDIT payment method. Only customers with `creditEnabled=true` and `creditStatus=ACTIVE` may purchase on credit. ADMIN role can create and manage all receivables; SHOP_MANAGER can read and record payments. `CONFIRMED_FROM_CODE`
- `AR_RULE_002`: Credit limit is configurable per customer (`credit_limit` column on `customers` table). A null limit means no cap. ADMIN with `receivables.override_limit` permission may override the limit at point of sale. `CONFIRMED_FROM_CODE`
- `AR_RULE_003`: Payment terms are configurable per customer (`payment_terms_days`). Due date = `placedAt + paymentTermsDays` days, persisted on `accounts_receivable.due_date`. `CONFIRMED_FROM_CODE`
- `AR_RULE_004`: Credit sales are POS-only (walk-in). Web/mobile checkout does not support CREDIT payment. `CONFIRMED_FROM_CODE`
- `AR_RULE_005`: Exceeding credit limit blocks the POS sale with HTTP 422. ADMIN with `receivables.override_limit` permission can bypass. `CONFIRMED_FROM_CODE`
- `AR_RULE_006`: Partial payments are supported. Each `POST /admin/receivables/{id}/payments` call records a PaymentEntity and updates `paidAmount`. `paymentStatus` transitions: UNPAID → PARTIALLY_PAID → PAID. `CONFIRMED_FROM_CODE`
- `AR_RULE_007`: Write-off is supported via `POST /admin/receivables/{id}/write-off` with mandatory reason. Requires `receivables.write_off` permission (ADMIN only). Sets status=WRITTEN_OFF, records audit log. `CONFIRMED_FROM_CODE`
- `AR_RULE_008`: Overdue receivables are flagged by scheduler. `ReceivableOverdueScheduler` runs daily at 00:05 (`@Scheduled(cron = "0 5 0 * * ?")`) and calls `ReceivableService.refreshOverdueStatus()`, which transitions OPEN/PARTIALLY_PAID receivables past `dueDate` to OVERDUE. No auto-cancellation — status becomes OVERDUE for staff attention. `CONFIRMED_FROM_CODE`
- `AR_RULE_009`: Target is registered customers (UUID FK on `accounts_receivable.customer_id`). Walk-in without system account: `customer_id` is nullable; `customer_name` and `customer_phone` are snapshotted at creation. `CONFIRMED_FROM_CODE`
- `AR_RULE_010`: No customer-facing SOA in web/mobile portal. Receivables are admin-only. `CONFIRMED_FROM_CODE`
- `AR_RULE_011`: Aging report implemented: buckets are notDue, 0–30 days, 31–60 days, 61–90 days, 90+ days. Also: total outstanding, overdue outstanding, written-off total, open/overdue count. `CONFIRMED_FROM_CODE`

### Customer credit status state machine

`ACTIVE` → `SUSPENDED` (admin manual) → `ACTIVE` (reinstate)
`ACTIVE` → `BLOCKED` (admin manual, permanent — requires credit clear)

### Receivable payment status state machine

`UNPAID` → `PARTIALLY_PAID` (paidAmount > 0 and < outstanding) → `PAID` (paidAmount ≥ outstanding)

### Receivable status state machine

`OPEN` → `PARTIALLY_PAID` → `CLOSED` (fully paid)
`OPEN` / `PARTIALLY_PAID` → `OVERDUE` (past due date, not closed)
`OPEN` / `PARTIALLY_PAID` / `OVERDUE` → `WRITTEN_OFF` (admin write-off with reason)

Evidence:

- `V75__add_credit_and_receivables.sql`
- `CustomerEntity.java` (credit fields added)
- `ReceivableEntity.java`
- `ReceivableJpaRepository.java`
- `CreditPolicyService.java`
- `ReceivableService.java`
- `ReceivableQueryService.java`
- `ReceivableOverdueScheduler.java` (cron `0 5 0 * * ?` daily 00:05; verifies `@EnableScheduling` in `BigbikeBackendApplication.java`)
- `AdminReceivableController.java`
- `PosOrderService.java` (CREDIT branch)
- `AdminRolePermissions.java` (`receivables.*` permissions added)
- `AdminReceivableApiTest.java`

## Reports Rules

Status: `CONFIRMED_FROM_CODE` — derived from audit of `AdminReportService.java`, `OrderJpaRepository.java`, `OrderLineItemJpaRepository.java`, `RefundService.java`, `AdminCustomerService.java`.

### Metric Definitions

- `REPORT_RULE_001`: **GMV (`grossOrderValue`)** = `SUM(totalAmount)` for orders where `placedAt` is within the requested range AND `status NOT IN ('CANCELLED', 'FAILED')`. REFUNDED orders are **included** in GMV — they represent real demand placed in the period. `CONFIRMED_FROM_CODE`
- `REPORT_RULE_002`: **Paid Revenue (`paidRevenue`)** = `SUM(paidAmount)` for orders where `placedAt` is within the requested range AND `paymentStatus IN ('PAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')` AND `status NOT IN ('CANCELLED', 'FAILED')`. `paidAmount` is never modified by `RefundService.applyRefund()` — it is the total cash collected. Including `PARTIALLY_REFUNDED` and `REFUNDED` payment statuses ensures orders that later received refunds are still counted as collected cash. `CONFIRMED_FROM_CODE`
- `REPORT_RULE_003`: **Refund Amount (`refundAmount`)** = `SUM(refundAmount)` for orders where `placedAt` is within the requested range AND `refundAmount IS NOT NULL AND refundAmount > 0`. Anchored to `placedAt`, not `refundedAt`. `CONFIRMED_FROM_CODE`
- `REPORT_RULE_004`: **Net Revenue (`netRevenue`)** = `paidRevenue − refundAmount`. No clamp. Negative net revenue is a valid business scenario (e.g. refunds exceed cash collected in a cohort). Display as-is. `CONFIRMED_FROM_CODE`
- `REPORT_RULE_005`: **Order Count (`orderCount`)** = `COUNT(id)` excluding `status IN ('CANCELLED', 'FAILED')`. REFUNDED orders count. `CONFIRMED_FROM_CODE`
- `REPORT_RULE_006`: **Average Order Value (`avgOrderValue`)** = `grossOrderValue / orderCount`. Returns zero if `orderCount = 0`. `CONFIRMED_FROM_CODE`

### Excluded Status Sets

- `REPORT_RULE_007`: Two separate excluded-status sets are used:
  - **REVENUE_EXCLUDED** = `['CANCELLED', 'FAILED']` — applied to GMV, paidRevenue, orderCount, avgOrderValue, daily revenue.
  - **RANKING_EXCLUDED** = `['CANCELLED', 'FAILED', 'REFUNDED']` — applied to topProducts and topCustomers rankings. REFUNDED orders are excluded from rankings because refunded revenue is not retained. `CONFIRMED_FROM_CODE`

### Timezone

- `REPORT_RULE_008`: All date boundaries (`from`, `to` params) are parsed in `Asia/Ho_Chi_Minh` timezone. Daily revenue grouping uses `AT TIME ZONE 'Asia/Ho_Chi_Minh'`. This matches `AdminDashboardService` behavior. `CONFIRMED_FROM_CODE`

### Product And Customer Rankings

- `REPORT_RULE_009`: **topProducts** uses `COALESCE(product_pk, product_id::text)` as group key. Admin-created products have `product_id = NULL` and `product_pk` set; regular products have both. Filtering `product_id IS NOT NULL` (legacy behavior) silently excludes admin-created products. `CONFIRMED_FROM_CODE`
- `REPORT_RULE_010`: **topCustomers** uses `COALESCE(customer_id::text, customer_email)` as group key to prevent the same customer appearing as multiple rows if their email changed over time. Display email is `MAX(customer_email)`. `CONFIRMED_FROM_CODE`

### Known Limitation

- `REPORT_RULE_011`: **Refund attribution is period-inaccurate.** `refundedAt` on `OrderEntity` is overwritten on every `RefundService.applyRefund()` call — for an order with multiple partial refunds, it holds only the timestamp of the last one. Switching to `refundedAt`-based aggregation would silently drop early partial refunds and double-count in cross-period scenarios. Therefore `refundAmount` is currently attributed to the order's `placedAt` period, not the period the refund occurred. This means the Reports module cannot accurately answer "how much was refunded this week?" if the order was placed in a prior week. A `refund_transactions` table (planned P1/P2) is required for per-period refund accuracy. `CONFIRMED_FROM_CODE`

Evidence:

- `AdminReportService.java`
- `OrderJpaRepository.java`
- `OrderLineItemJpaRepository.java`
- `RefundService.java`
- `AdminCustomerService.java`
