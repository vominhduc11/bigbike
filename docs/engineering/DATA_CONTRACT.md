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

## Proposed Accounts Receivable Data Fields

> Status: `PROPOSED_FOR_AR_MODULE` — not yet implemented. Requires business confirmation of `AR_RULE_001`–`AR_RULE_011` in `docs/business/BUSINESS_RULES.md` and Phase 1 prerequisite fixes before Flyway migration is written.

### Phase 2 MVP — orders table extension (Flyway V74 proposed)

Outstanding balance for any order is already derivable from existing columns as `totalAmount - paidAmount` without schema change.

| Column | Type | Nullable | Purpose |
|---|---|---|---|
| `due_at` | `TIMESTAMPTZ` | YES | Payment due date for credit orders; null for immediate cash/card sales |
| `credit_terms` | `VARCHAR(100)` | YES | Human-readable payment terms snapshot at time of sale (e.g. `NET_30`); null for non-credit |

`due_at` is computed from `placedAt + credit_terms_days` at order creation and persisted for scheduler queries (overdue detection).

### Phase 3 B2B only — customer credit profiles table (Flyway V75 proposed)

Only required if `AR_RULE_009` confirms B2B/dealer registered accounts. Walk-in credit does not need this table (phone-based identity is sufficient for POS).

| Column | Type | Nullable | Purpose |
|---|---|---|---|
| `customer_id` | `UUID FK → customers.id` | NO | Customer this profile belongs to |
| `credit_limit` | `NUMERIC(15,2)` | NO | Maximum outstanding balance allowed |
| `payment_terms_days` | `INT` | NO | Days until payment is due after sale |
| `is_active` | `BOOLEAN` | NO | Whether credit is currently enabled for this customer |
| `approved_by_admin_id` | `UUID` | YES | Admin who approved or last modified the credit profile |
| `created_at` | `TIMESTAMPTZ` | NO | Profile creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | NO | Last modification timestamp |

### Dashboard KPI — new `todayPaidRevenue` field (Phase 1 P-1 fix, implemented)

`AdminDashboardSummaryResponse.KpiResponse` now includes:

| Field | Computation | Purpose |
|---|---|---|
| `todayRevenue` | `SUM(totalAmount)` no filter — gross order value placed | Gross GMV for the day |
| `todayPaidRevenue` | `SUM(paidAmount)` where `paymentStatus IN ('PAID','PARTIALLY_PAID')` | Actual cash collected today |

The delta `todayRevenue - todayPaidRevenue` equals today's receivables (unpaid/partially-paid order value).

Status: `CONFIRMED_FROM_CODE` (P-1 fix applied in `AdminDashboardService.java` and `OrderJpaRepository.java`)
