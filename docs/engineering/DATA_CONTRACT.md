# Data Contract

## Canonical Data Notes

### Money

- Business intent is VND pricing.
- Current backend DTOs commonly serialize Java `BigDecimal` amounts with scale `2`, which appears in JSON and tests as values like `50000.00`.
- Do not document fractional business meaning for VND; document the current serialized shape instead.

Status: `CONFIRMED_FROM_CODE`

Evidence:

- `CartService.java`
- `CheckoutService.java`
- POS, cart, and checkout tests

### Media fields

- Canonical public media shape remains `image`, `gallery[]`, and `videos[]` at the product/content contract level.
- Admin media persistence stores `publicUrl`, `mimeType`, `fileSize`, dimensions, status, and storage metadata.
- Current allowlist excludes SVG.

Status: `CONFIRMED_FROM_CODE`

Evidence:

- `AdminMediaService.java`
- product/content DTO mappings in repo

### SKU fields

`product.sku` and `variant.sku` are two different things despite sharing a name.

| Field | DB column | Role | Required? |
|---|---|---|---|
| `product.sku` | `products.sku varchar(100)` | **Model code / group code** — optional descriptive identifier for the product family. Not used as the selling code when variants exist. | Optional (nullable, no unique constraint) |
| `variant.sku` | `product_variants.sku varchar(100)` | **Selling SKU** — the code used at POS, cart, checkout, inventory, and returns to identify the actual unit sold. | Optional (nullable, no unique constraint) |

When snapshotting line items into cart/order/POS, the system uses `variant.sku` first, falling back to `product.sku`. This fallback supports products that have no variants (where `product.sku` is the selling code) and variants that were created without a SKU.

Inventory and serial-tracking views surface both fields (`product_sku`, `variant_sku`) so admin tools can locate units by either code.

Status: `CONFIRMED_FROM_CODE`

Evidence:

- `ProductEntity.java` (line 34)
- `ProductVariantEntity.java` (line 29)
- `PosOrderService.java` (line 233)
- `CartService.java` (line 153)
- `CheckoutService.java` (line 723)
- `V1__create_catalog_content_tables.sql` (lines 65, 166)
- `V51__add_serial_tracking.sql` (lines 123, 127)

### Address fields

`CustomerAddressResponse` currently contains:

- `id`
- `type`
- `fullName`
- `phone`
- `country`
- `province`
- `district`
- `ward`
- `addressLine1`
- `addressLine2`
- `isDefault`

Status: `CONFIRMED_FROM_CODE`

Evidence:

- `CustomerAddressResponse.java`
- `SaveCustomerAddressRequest.java`

### POS order snapshot fields

Current POS flow persists or emits these notable fields:

- order channel/source: `IN_STORE` / `pos`
- immediate `COMPLETED` and `PAID` state
- `createdByAdminId`
- `customerName`
- `customerPhone`
- `customerNote`
- payment record with provider `POS`

Status: `CONFIRMED_FROM_CODE`

Evidence:

- `PosOrderService.java`
- `V71__add_pos_staff_and_customer_name_to_orders.sql`

### Coupon snapshot

Checkout copies coupon usage to `OrderAppliedCouponEntity` with:

- `couponId`
- `code`
- `discountAmount`
- `createdAt`

Status: `CONFIRMED_FROM_CODE`

Evidence:

- `CheckoutService.java`

### Return data

`CustomerReturnResponse` currently includes:

- identity: `id`, `returnNumber`, `orderId`, `orderNumber`
- state: `status`
- narrative: `reason`, `customerNote`, `adminNote`
- financials: `refundAmount`
- nested `items[]` and `history[]`
- timestamps: `createdAt`, `updatedAt`

Status: `CONFIRMED_FROM_CODE`

Evidence:

- `CustomerReturnResponse.java`
- `CreateReturnRequest.java`

## Inventory And Serial Model

- Active serial model is `stock_movement_serials` linked to `StockMovementEntity`.
- Manual stock-in requires exact serial count match.
- `stock_receipts`, `stock_receipt_lines`, and `stock_receipt_serials` exist in Flyway schema, but no active Java receiving workflow was confirmed.

Status:

- movement serial model: `CONFIRMED_FROM_CODE`
- receipt workflow: `NOT_FOUND_IN_REPO`

Evidence:

- `AdminInventoryService.java`
- `StockMovementSerialEntity.java`
- `V52__add_stock_receipts.sql`
- `V53__add_stock_receipt_lines.sql`
- `V55__add_receipt_serials.sql`
- `V57__add_stock_movement_serials.sql`

## Accounts Receivable Data Fields

Status: `CONFIRMED_FROM_CODE` — implemented in `V75__add_credit_and_receivables.sql`.

### customers table — credit columns added (V75)

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `credit_enabled` | `BOOLEAN` | NO | `false` | Whether this customer is allowed to purchase on credit |
| `credit_limit` | `NUMERIC(19,2)` | YES | `null` | Maximum outstanding balance; null = uncapped |
| `payment_terms_days` | `INTEGER` | YES | `null` | Days until payment is due after credit sale |
| `credit_status` | `VARCHAR(50)` | NO | `'ACTIVE'` | `ACTIVE` / `SUSPENDED` / `BLOCKED` |
| `credit_note` | `TEXT` | YES | `null` | Internal admin note on credit profile |

### accounts_receivable table (V75; `version` column added in V83)

| Column | Type | Nullable | Purpose |
|---|---|---|---|
| `id` | `UUID PK` | NO | Primary key |
| `order_id` | `UUID FK → orders.id UNIQUE` | NO | One receivable per order |
| `customer_id` | `UUID FK → customers.id` | YES | Null for walk-in without account |
| `customer_name` | `VARCHAR(200)` | YES | Name snapshot at creation |
| `customer_phone` | `VARCHAR(30)` | YES | Phone snapshot at creation |
| `original_amount` | `NUMERIC(19,2)` | NO | Total order amount at time of credit sale |
| `paid_amount` | `NUMERIC(19,2)` | NO | Cumulative amount received so far |
| `outstanding_amount` | `NUMERIC(19,2)` | NO | `original_amount - paid_amount` (maintained in-sync) |
| `written_off_amount` | `NUMERIC(19,2)` | NO | Amount written off (0 unless WRITTEN_OFF) |
| `status` | `VARCHAR(50)` | NO | `OPEN` / `PARTIALLY_PAID` / `OVERDUE` / `CLOSED` / `WRITTEN_OFF` |
| `due_date` | `DATE` | YES | `placedAt + paymentTermsDays`; null if terms not set |
| `payment_terms_days` | `INTEGER` | YES | Snapshot of terms at time of sale |
| `credit_limit_snapshot` | `NUMERIC(19,2)` | YES | Snapshot of customer credit_limit at time of sale |
| `created_from` | `VARCHAR(50)` | YES | Origin channel (e.g. `POS`) |
| `note` | `TEXT` | YES | Staff note |
| `write_off_reason` | `TEXT` | YES | Mandatory when WRITTEN_OFF |
| `written_off_at` | `TIMESTAMPTZ` | YES | Timestamp of write-off |
| `created_by_admin_id` | `UUID` | YES | Admin who created the receivable |
| `created_at` | `TIMESTAMPTZ` | NO | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | NO | Last update timestamp |
| `version` | `BIGINT` | NO | Optimistic locking version |

Constraints: `UNIQUE(order_id)`, `CHECK status IN (...)`, `CHECK outstanding_amount >= 0`, `CHECK paid_amount >= 0`.

Indexes: `(customer_id)`, `(status)`, `(due_date)`, `(created_at DESC)`.

### API response shapes

#### ReceivableListItemResponse

`id`, `orderId`, `orderNumber`, `customerId`, `customerName`, `customerPhone`, `originalAmount`, `paidAmount`, `outstandingAmount`, `status`, `dueDate`, `overdueDays`, `createdFrom`, `createdAt`

#### ReceivableDetailResponse

All list fields plus: `writtenOffAmount`, `paymentTermsDays`, `creditLimitSnapshot`, `note`, `writeOffReason`, `writtenOffAt`, `updatedAt`

#### ReceivableSummaryResponse

`totalOutstanding`, `overdueOutstanding`, `writtenOffTotal`, `countOpen`, `countOverdue`

#### ReceivableAgingResponse

`notDue`, `days0To30`, `days31To60`, `days61To90`, `over90` (all BigDecimal outstanding amounts)

### Dashboard KPI — `todayPaidRevenue` field

`AdminDashboardSummaryResponse.KpiResponse` includes:

| Field | Computation | Purpose |
|---|---|---|
| `todayRevenue` | `SUM(totalAmount)` excluding CANCELLED/FAILED/REFUNDED | Gross GMV placed today |
| `todayPaidRevenue` | `SUM(paidAmount)` where `paymentStatus IN ('PAID','PARTIALLY_PAID')` | Actual cash collected today |

Credit (CREDIT) orders contribute to `todayRevenue` but NOT to `todayPaidRevenue` (until payment is recorded), preserving accurate cash-vs-credit separation.

Status: `CONFIRMED_FROM_CODE`

Evidence: `AdminDashboardService.java`, `AdminDashboardSummaryResponse.java`

Status: `CONFIRMED_FROM_CODE` (P-1 fix applied in `AdminDashboardService.java` and `OrderJpaRepository.java`)

## Customer Status Enum

The customer `status` column is a `VARCHAR(50)` string in the `customers` table. The authoritative set of valid values is defined in `AdminCustomerService.ALLOWED_STATUSES` (line 48).

| Value | Meaning |
|---|---|
| `ACTIVE` | Normal active customer |
| `DISABLED` | Account disabled by admin |
| `PENDING` | Registration pending verification |
| `BLOCKED` | Account permanently blocked |

**Note:** `INACTIVE` is NOT a valid database status value. It is a computed segment label returned by `AdminCustomerService.deriveSegment()` for display purposes only. Filtering by `status = 'INACTIVE'` at the database level will return zero results.

A `CustomerStatus` Java enum (`domain/customer/CustomerStatus.java`) codifies these values for type-safe use in service and repository layers.

Status: `CONFIRMED_FROM_CODE`

Evidence: `AdminCustomerService.java` line 48, `deriveSegment()` method

## Reports Analytics Response Shape

`GET /api/v1/admin/reports/analytics` returns `AdminAnalyticsResponse`.

### PeriodSummary (summary field)

| Field | Type | Description |
|---|---|---|
| `grossOrderValue` | `BigDecimal` | GMV: SUM(totalAmount) excl CANCELLED/FAILED (REFUNDED included) |
| `paidRevenue` | `BigDecimal` | SUM(paidAmount) where paymentStatus IN (PAID, PARTIALLY_PAID, PARTIALLY_REFUNDED, REFUNDED) excl CANCELLED/FAILED orders |
| `refundAmount` | `BigDecimal` | SUM(refundAmount) for orders placed in range (placedAt-anchored) |
| `netRevenue` | `BigDecimal` | paidRevenue − refundAmount; may be negative |
| `orderCount` | `int` | COUNT excl CANCELLED/FAILED |
| `avgOrderValue` | `BigDecimal` | grossOrderValue / orderCount; zero if orderCount = 0 |

### DailyRevenue item (dailyRevenue[] array)

| Field | Type | Description |
|---|---|---|
| `date` | `String` | ISO-8601 date string `YYYY-MM-DD` in Asia/Ho_Chi_Minh timezone |
| `revenue` | `BigDecimal` | Daily grossOrderValue (same exclusion set as summary) |

### TopProduct item (topProducts[] array)

| Field | Type | Description |
|---|---|---|
| `productKey` | `String` | COALESCE(product_pk, product_id::text) — stable identifier across admin-created and regular products |
| `productName` | `String` | Product name snapshot from order line item |
| `revenue` | `BigDecimal` | SUM(lineTotal) excl RANKING_EXCLUDED statuses |
| `unitsSold` | `long` | SUM(quantity) excl RANKING_EXCLUDED statuses |

### TopCustomer item (topCustomers[] array)

| Field | Type | Description |
|---|---|---|
| `customerKey` | `String` | COALESCE(customer_id::text, customer_email) — stable group key |
| `customerEmail` | `String` | MAX(customer_email) — display email |
| `revenue` | `BigDecimal` | SUM(totalAmount) excl RANKING_EXCLUDED statuses |
| `orderCount` | `int` | COUNT of orders excl RANKING_EXCLUDED statuses |

Status: `CONFIRMED_FROM_CODE` — shape confirmed from `AdminAnalyticsResponse.java` audit; fields updated per P0 plan.

Evidence: `AdminAnalyticsResponse.java`, `AdminReportService.java`, `OrderJpaRepository.java`, `OrderLineItemJpaRepository.java`
