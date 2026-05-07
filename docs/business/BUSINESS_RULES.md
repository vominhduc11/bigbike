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

Current confirmed state (no AR module exists):

- The concept of a "credit sale" (bán chịu / công nợ) does not exist in the system. `CONFIRMED_FROM_CODE`
- All POS sales are immediately `COMPLETED` and paymentStatus `PAID`. Credit POS sales are not supported. `CONFIRMED_FROM_CODE`
- No `CREDIT` payment method exists in any whitelist. POS accepts only `CASH` and `CARD_TERMINAL`; web/mobile checkout accepts only `COD` and `BACS`. `CONFIRMED_FROM_CODE`
- `OrderEntity` carries `paidAmount`, `totalAmount`, and `refundAmount`; outstanding balance is derivable as `totalAmount - paidAmount` without schema change. `CONFIRMED_FROM_CODE`
- `PaymentEntity` is 1-N per order, supporting multiple partial payment records per order already. `CONFIRMED_FROM_CODE`
- No customer credit profile, credit limit, or payment terms fields exist on `CustomerEntity`. `CONFIRMED_FROM_CODE`
- Dashboard KPI `todayRevenue` currently sums `totalAmount` for ALL orders regardless of status or paymentStatus — inflates reported revenue. `CONFIRMED_FROM_CODE` (P-1 fix applied, see `AdminDashboardService.java`)
- No `receivables.*` permission strings exist in `AdminRolePermissions.java`. `CONFIRMED_FROM_CODE`

Rules pending business confirmation before any AR implementation:

- `AR_RULE_001`: Is "bán chịu" (credit sale) a required feature? Who can approve (ADMIN only, or SHOP_MANAGER too)? `NEEDS_BUSINESS_CONFIRMATION`
- `AR_RULE_002`: What is the maximum credit limit per customer — fixed system-wide or configurable per customer? `NEEDS_BUSINESS_CONFIRMATION`
- `AR_RULE_003`: What is the payment due window (e.g. NET_7, NET_30)? `NEEDS_BUSINESS_CONFIRMATION`
- `AR_RULE_004`: Is POS the only channel for credit sales, or can web/mobile customers also buy on credit? `NEEDS_BUSINESS_CONFIRMATION`
- `AR_RULE_005`: What happens when a credit customer exceeds their limit — block the sale or warn and require override? `NEEDS_BUSINESS_CONFIRMATION`
- `AR_RULE_006`: Are partial payments allowed after the credit sale (e.g. customer pays 50% today, 50% next week)? `NEEDS_BUSINESS_CONFIRMATION`
- `AR_RULE_007`: Is write-off (xóa nợ xấu) a required operation? Who can perform it? `NEEDS_BUSINESS_CONFIRMATION`
- `AR_RULE_008`: Should overdue receivables auto-cancel the order or only send a notification to staff? `NEEDS_BUSINESS_CONFIRMATION`
- `AR_RULE_009`: Is the target customer walk-in regulars (no system account) or registered B2B accounts? `NEEDS_BUSINESS_CONFIRMATION`
- `AR_RULE_010`: Is a Statement of Account (sao kê nợ) needed for customers to view via the web/mobile portal? `NEEDS_BUSINESS_CONFIRMATION`
- `AR_RULE_011`: What receivables reporting is required — aging report (0–30, 31–60, 61–90, 90+ days overdue) or simple outstanding balance per customer? `NEEDS_BUSINESS_CONFIRMATION`

Evidence:

- `OrderEntity.java` (`paidAmount`, `totalAmount`, `refundAmount`)
- `PaymentEntity.java` (1-N per order)
- `CustomerEntity.java` (no credit profile fields)
- `PosOrderService.java` line 394 (`CASH`/`CARD_TERMINAL` whitelist)
- `AdminDashboardService.java` (`sumRevenueSince` — no status filter)
- `AdminRolePermissions.java` (no `receivables.*` permissions)
