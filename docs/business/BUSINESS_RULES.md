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
- Each coupon has a `channel` field: `ALL` (default) | `ONLINE` | `POS`. `CONFIRMED_FROM_CODE`
  - `ONLINE` coupons can only be applied via web/mobile cart — rejected at POS. `CONFIRMED_FROM_CODE`
  - `POS` coupons can only be applied at point of sale — rejected in web/mobile cart. `CONFIRMED_FROM_CODE`
  - `ALL` coupons work on both channels. `CONFIRMED_FROM_CODE`
- A coupon may be restricted to a specific customer via `customer_id` (nullable FK). `NULL` = shared for all customers. `CONFIRMED_FROM_CODE`
- Admin can send a personalized coupon gift to a single customer (`POST /api/v1/admin/customers/{id}/coupon-gift`): creates a unique `GIFT`-prefixed code, sets `customer_id`, and emails it. Requires `coupons.write` permission and the customer must have an email address. `CONFIRMED_FROM_CODE`
- Admin can bulk-gift a unique coupon to every active customer who has an email (`POST /api/v1/admin/coupon-gifts/bulk`): each customer gets an individual code. Email is sent async per recipient. Returns `{ sent, skipped }`. Requires `coupons.write` permission. `CONFIRMED_FROM_CODE`

Evidence:

- `CartService.java`
- `CheckoutService.java`
- `CouponPolicyService.java`
- `PosOrderService.java`
- `CouponExpiryScheduler.java`
- `AdminCouponGiftService.java`
- `AdminCustomerController.java`
- `AdminCouponGiftController.java`
- `V73__enforce_one_coupon_per_cart.sql`
- `V118__add_coupon_channel.sql`
- `V119__add_coupon_customer_restriction.sql`
- `Phase1ECartApiTest.java`
- `Phase1FCheckoutApiTest.java`
- `Phase1JAdminSettingsMenuCouponApiTest.java`

## Order Completion & Cancellation Rules

The three statuses on an order are independent and **never** to be conflated:

| Field | Meaning |
|---|---|
| `OrderEntity.status` | Where the order sits in the fulfillment / lifecycle pipeline. |
| `OrderEntity.paymentStatus` | Where the money is. |
| `OrderEntity.fulfillmentStatus` | Where the goods are (DELIVERY orders only). |

`COMPLETED` means **goods delivered**, not **money received**. The two must be checked separately before the transition.

- `ORDER_RULE_001` — `OrderStatus.COMPLETED` is allowed with `paymentStatus = UNPAID` only when the order is `paymentMethod = CREDIT` AND has a valid `customerId`. Anything else is rejected. Reason: only credit/receivable orders have a downstream collection process; non-credit unpaid completions leave money on the table with no receivable to chase it. (`PARTIALLY_PAID` was a valid state before V114; removed by V114 migration — V116 CHECK constraint now enforces `UNPAID/PAID/REFUNDED/CANCELLED` as the only valid values.) `CONFIRMED_FROM_CODE`
- `ORDER_RULE_002` — `paymentMethod = COD` orders cannot transition to `COMPLETED` unless `paymentStatus = PAID`. Reason: COD means cash on delivery; "complete" is goods + money, not just goods. Backend message: `Đơn COD phải được thu tiền trước khi hoàn thành.` `CONFIRMED_FROM_CODE`
- `ORDER_RULE_003` — `fulfillmentType = DELIVERY` orders cannot transition to `COMPLETED` unless `fulfillmentStatus = DELIVERED`. Reason: a delivery order cannot be "complete" before it has actually been delivered. Admin must walk fulfillment through `UNFULFILLED → PROCESSING → SHIPPED → DELIVERED` (or jump straight to `DELIVERED` from `UNFULFILLED`) via `PATCH /admin/orders/{id}/fulfillment` first. POS in-store orders (`fulfillmentType = IN_STORE`) are exempt — goods change hands at the counter on creation. Backend message: `Chỉ được hoàn thành đơn giao hàng sau khi đã giao thành công.` `CONFIRMED_FROM_CODE`
- `ORDER_RULE_004` — Orders with `paymentStatus = PAID` cannot transition to `CANCELLED` directly. They must go through `POST /admin/orders/{id}/refund` (RefundService) so the refund_transaction, payment record, receivable write-off, warranty void, and serial/stock restore stay atomic. When the guard rejects the cancel, stock is NOT restored and serials are NOT released — the order stays in its current status. Backend message: `Đơn đã có thanh toán, cần xử lý hoàn tiền/void trước khi hủy.` `CONFIRMED_FROM_CODE` (`PARTIALLY_PAID` removed in V114; only `PAID` remains as the blocking condition.)
- `ORDER_RULE_005` — POS orders are created with `status = COMPLETED` directly. CASH/CARD_TERMINAL force `paymentStatus = PAID`; CREDIT forces `paymentStatus = UNPAID` (always fully unpaid at creation — downPayment was removed in V114) AND requires `customerId` + a successful `ReceivableService.createReceivableForOrder` — receivable creation failure rolls back the whole POS order transaction. Debt is collected later via `ReceivableService.recordPayment`. `CONFIRMED_FROM_CODE`
- `ORDER_RULE_006` — POS orders that are already `COMPLETED` cannot be `CANCELLED` directly. `COMPLETED` is terminal in `ALLOWED_TRANSITIONS`. A POS-specific void flow (separate from `CANCELLED`) is not implemented today; cancelling a completed POS sale must currently be modelled as a refund/return. `CONFIRMED_FROM_CODE`
- `ORDER_RULE_007` — Direct `COMPLETED → REFUNDED` status patch is rejected. Refunds must go through `POST /admin/orders/{id}/refund` → `RefundService.applyRefund` so refund_transaction, payment.refundAmount, warranty void, SOLD serial restore, receivable write-off, and the status flip happen atomically. `CONFIRMED_FROM_CODE`

Evidence:

- `AdminOrderService.java` — `validateBeforeComplete`, `validateBeforeCancel`, `ALLOWED_TRANSITIONS`
- `CheckoutService.java` — initial `fulfillmentStatus = UNFULFILLED` for DELIVERY orders
- `PosOrderService.java` — POS CASH/CARD/CREDIT branches, receivable creation rollback
- `RefundService.java` — single authoritative refund flow
- `Phase1HAdminOrderApiTest.java` — covers all four rules above (happy + rejection paths)
- `Phase1MPosApiTest.java` — covers POS CASH/CARD/CREDIT including missing-customer rejection and credit limit overrides

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
- Receipt-based receiving tables were **dropped in V120** — schema-only, never implemented in Java. Stock-in is movement-log based only. `REMOVED`

### Stock State Derivation Rules `CONFIRMED_FROM_CODE`

- `stockState` (`IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`) is always **derived** from `quantityOnHand` (or `stockQuantity` for no-variant products). Admin cannot set it manually via the catalog create/update API.
- `STOCK_RULE_001`: New product or variant is always created with `stockState = OUT_OF_STOCK` (initial `quantityOnHand = 0`).
- `STOCK_RULE_002`: Every time `quantityOnHand` changes (stock-in, sale, cancel, return), `stockState` is recomputed via `InventoryPolicyService.recomputeStockState()`.
- `STOCK_RULE_003`: Thresholds — `quantityOnHand <= 0` → `OUT_OF_STOCK`; `0 < quantityOnHand <= low_stock_threshold` → `LOW_STOCK`; `quantityOnHand > low_stock_threshold` → `IN_STOCK`. Default threshold is 5 (configurable via `low_stock_threshold` site setting).
- `STOCK_RULE_004`: `forceOutOfStock` (product-level boolean) is a separate emergency override. It disables purchase on web even when `stockState = IN_STOCK`. It is still manually controlled by admin.
- `STOCK_RULE_005`: For products with variants, checkout enforces stock via `variant.quantityOnHand` directly (not `variant.stockState`). `variant.stockState` is used for display only (web UI disables "Mua ngay" when `OUT_OF_STOCK`).
- `STOCK_RULE_006`: For no-variant products, checkout enforces via `product.stockState == OUT_OF_STOCK` AND `product.stockQuantity`. Both are derived from stock movements.
- `STOCK_RULE_007`: Sản phẩm có tồn kho = 0 → khách chỉ xem được, không thể đặt hàng. Không có chế độ "đặt trước" hay "HÀNG ODER" qua web. Muốn nhận đơn ODER, admin phải nhập hàng về trước (tồn kho > 0) thì khách mới đặt được.

Evidence:

- `AdminInventoryService.java`
- `InventoryPolicyService.java`
- `CheckoutService.java` (lines 323–357, 862–901)
- `AdminCatalogMutationService.java`
- `StockMovementSerialEntity.java`
- `V57__add_stock_movement_serials.sql`
- `V108__backfill_stock_state_from_quantity.sql`
- `V120__drop_stock_receipt_tables.sql`

## Product Catalog Rules

- `PRODUCT_RULE_001`: Mỗi sản phẩm bắt buộc có **bản nội dung tiếng Việt** (canonical). **Bản tiếng Anh là tùy chọn** — admin có thể tạo/sửa sản phẩm mà không nhập bản tiếng Anh. `CONFIRMED_FROM_CODE`
- `PRODUCT_RULE_002`: Khi đọc nội dung sản phẩm bằng tiếng Anh (`lang=en`), mỗi trường text thiếu bản tiếng Anh sẽ **tự lùi về bản tiếng Việt theo từng trường** (`COALESCE`). Một sản phẩm có thể có tên tiếng Anh nhưng mô tả vẫn hiển thị tiếng Việt. `CONFIRMED_FROM_CODE`
- `PRODUCT_RULE_003`: `slug` của sản phẩm dùng chung 1 bản (không dịch theo ngôn ngữ). `CONFIRMED_FROM_CODE`

Evidence:

- `ProductEntity.java`, `ProductSpecificationEntity.java`, `ProductFaqEntity.java` (các cột `*_en`)
- `JpaCatalogReadRepository.java` (resolve locale + fallback)
- `CatalogController.java` (`lang` param)
- `AdminCatalogMutationService.java` (`applyProductPatch` ghi cột `_en`)
- `V136__add_product_bilingual_content.sql`
- `DATA_CONTRACT.md` — "Product bilingual content"

## Category Catalog Rules

- `CATEGORY_RULE_001`: Mỗi danh mục bắt buộc có **bản nội dung tiếng Việt** (canonical). **Bản tiếng Anh là tùy chọn**. `CONFIRMED_FROM_CODE`
- `CATEGORY_RULE_002`: Khi đọc danh mục bằng tiếng Anh (`lang=en`), mỗi trường thiếu bản tiếng Anh sẽ **tự lùi về bản tiếng Việt theo từng trường**. `CONFIRMED_FROM_CODE`
- `CATEGORY_RULE_003`: `slug` của danh mục dùng chung 1 bản (không dịch theo ngôn ngữ). `CONFIRMED_FROM_CODE`

Evidence:

- `CategoryEntity.java` (các cột `name_en`, `description_en`, `seo_title_en`, `seo_description_en`)
- `JpaCatalogReadRepository.java` (resolve locale + fallback cho category)
- `CatalogController.java` (`lang` param trên category endpoints)
- `AdminCatalogMutationService.java` (`applyCategoryPatch` ghi cột `_en`)
- `V137__add_category_brand_bilingual_content.sql`
- `DATA_CONTRACT.md` — "Category bilingual content"

## Brand Catalog Rules

- `BRAND_RULE_001`: Mỗi thương hiệu bắt buộc có **bản nội dung tiếng Việt** (canonical). **Bản tiếng Anh là tùy chọn**. `CONFIRMED_FROM_CODE`
- `BRAND_RULE_002`: Khi đọc thương hiệu bằng tiếng Anh (`lang=en`), mỗi trường thiếu bản tiếng Anh sẽ **tự lùi về bản tiếng Việt theo từng trường**. `CONFIRMED_FROM_CODE`
- `BRAND_RULE_003`: `slug` của thương hiệu dùng chung 1 bản (không dịch theo ngôn ngữ). `CONFIRMED_FROM_CODE`

Evidence:

- `BrandEntity.java` (các cột `name_en`, `description_en`, `seo_title_en`, `seo_description_en`)
- `JpaCatalogReadRepository.java` (resolve locale + fallback cho brand)
- `CatalogController.java` (`lang` param trên brand endpoints)
- `AdminCatalogMutationService.java` (`applyBrandPatch` ghi cột `_en`)
- `V137__add_category_brand_bilingual_content.sql`
- `DATA_CONTRACT.md` — "Brand bilingual content"

## Article (Blog) Rules

- `ARTICLE_RULE_001`: Mỗi bài viết bắt buộc có **bản nội dung tiếng Việt** (canonical). **Bản tiếng Anh là tùy chọn**. `CONFIRMED_FROM_CODE`
- `ARTICLE_RULE_002`: Khi đọc bài viết bằng tiếng Anh (`lang=en`), mỗi trường thiếu bản tiếng Anh sẽ **tự lùi về bản tiếng Việt theo từng trường** (title, excerpt, body, seoTitle, seoDescription). `CONFIRMED_FROM_CODE`
- `ARTICLE_RULE_003`: `slug` của bài viết dùng chung 1 bản (không dịch theo ngôn ngữ). `CONFIRMED_FROM_CODE`

Evidence:

- `ArticleEntity.java` (các cột `title_en`, `excerpt_en`, `body_en`, `seo_title_en`, `seo_description_en`)
- `JpaContentReadRepository.java` (resolve locale + fallback cho article)
- `ContentController.java` (`lang` param trên article endpoints)
- `AdminContentMutationService.java` (`applyArticlePatch` ghi cột `_en`)
- `V138__add_article_page_bilingual_content.sql`
- `DATA_CONTRACT.md` — "Article bilingual content"

## Static Page Rules

- `PAGE_RULE_001`: Mỗi trang tĩnh bắt buộc có **bản nội dung tiếng Việt** (canonical). **Bản tiếng Anh là tùy chọn**. `CONFIRMED_FROM_CODE`
- `PAGE_RULE_002`: Khi đọc trang bằng tiếng Anh (`lang=en`), mỗi trường thiếu bản tiếng Anh sẽ **tự lùi về bản tiếng Việt theo từng trường** (title, body, heroTitle, heroDescription, heroKicker, seoTitle, seoDescription). `CONFIRMED_FROM_CODE`
- `PAGE_RULE_003`: `slug` của trang dùng chung 1 bản (không dịch theo ngôn ngữ). `CONFIRMED_FROM_CODE`

Evidence:

- `PageEntity.java` (các cột `title_en`, `body_en`, `hero_title_en`, `hero_description_en`, `hero_kicker_en`, `seo_title_en`, `seo_description_en`)
- `JpaContentReadRepository.java` (resolve locale + fallback cho page)
- `ContentController.java` (`lang` param trên page endpoints)
- `AdminContentMutationService.java` (`applyPagePatch` ghi cột `_en`)
- `V138__add_article_page_bilingual_content.sql`
- `DATA_CONTRACT.md` — "Page bilingual content"

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
- `PAY_RULE_001`: Online checkout accepts only payment-method codes `COD` and `BACS`. Both are confirmed manually by admin — there is no automatic payment gateway. `CONFIRMED_FROM_CODE`
- `PAY_RULE_002`: Manual-confirm reconciliation. `COD` — admin marks the order paid after cash is collected on delivery. `BACS` — admin verifies the bank transfer, then patches `paymentStatus`/`paidAmount`. No payment redirect, no provider webhook. The Alepay/ZaloPay online-gateway plan was dropped; those method codes are no longer accepted. `CONFIRMED_FROM_CODE`
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
- `AR_RULE_007`: Write-off is supported via `POST /admin/receivables/{id}/write-off` with mandatory reason. Requires `receivables.write_off` permission (ADMIN only). Sets AR status=WRITTEN_OFF and records audit log. The linked `orders.payment_status` is NOT updated — it stays UNPAID (the debt is cancelled at the AR level, not collected; V116 CHECK constraint does not permit WRITTEN_OFF as an order payment status). `CONFIRMED_FROM_CODE`
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

## Returns And Inspection Rules

- `RETURN_RULE_001`: Customer returns are only valid for orders in `COMPLETED` status within `RETURN_WINDOW_DAYS = 30` days from `orders.completed_at`. `CONFIRMED_FROM_CODE`
- `RETURN_RULE_002`: An order can have **at most one active return** at a time. Active = status in `{PENDING, APPROVED, RECEIVED, INSPECTING}`. Enforced both in `CustomerReturnService`/`AdminReturnService` and by the V65 partial unique index. `CONFIRMED_FROM_CODE`
- `RETURN_RULE_003`: For each `order_line_item_id`, the running sum of `return_items.quantity` across non-`REJECTED` returns must not exceed the original `order_line_items.quantity`. Validated server-side at submission time. `CONFIRMED_FROM_CODE`
- `RETURN_RULE_004`: **Inspection step (V104).** Returns may transition `RECEIVED → INSPECTING` to enter a per-item QC phase. Every `ReturnItem` must be marked `PASS` or `FAIL` via `PATCH /admin/returns/{id}/items/{itemId}/inspect` before the return can move on to `COMPLETED` or `REFUNDED`. Skipping inspection is allowed (legacy path `RECEIVED → COMPLETED/REFUNDED`), but is **not recommended for safety equipment** (mũ bảo hiểm, áo giáp). `CONFIRMED_FROM_CODE`
- `RETURN_RULE_005`: **FAIL items never re-enter stock.** When a return closes from `INSPECTING`, `restoreStockForReturn` skips any `ReturnItem` with `inspection_result = 'FAIL'`. This prevents customer-damaged goods from being put back on the sellable shelf. `CONFIRMED_FROM_CODE`
- `RETURN_RULE_006`: `GET /api/v1/customer/orders/{orderId}/return-eligibility` is read-only and never mutates state. It returns one of the stable reason codes `OK`, `ORDER_NOT_FOUND`, `NOT_OWNER`, `ORDER_NOT_COMPLETED`, `WINDOW_EXPIRED`, `RETURN_IN_PROGRESS`, `NOTHING_TO_RETURN`. Frontend should call this before rendering the return form. `CONFIRMED_FROM_CODE`

Evidence:

- `AdminReturnService.java`
- `CustomerReturnService.java`
- `ReturnItemEntity.java`
- `V104__add_return_item_inspection.sql`

## Contact Inbox Rules

> Removed. The public contact form and admin contact inbox were deleted (migration `V128__drop_contact_messages.sql`). Customers reach the shop through the static contact info on `/lien-he` (hotline, Zalo, Facebook, address, map). No `contact_messages` table, no `contact.read`/`contact.write` permissions.
