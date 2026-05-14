# POS In-Store Workflow — Fix Report

**Date:** 2026-05-14
**Based on audit:** `docs/audits/POS_IN_STORE_WORKFLOW_PRODUCTION_READY_AUDIT.md`
**Tests after fix:** 37/37 passing (`Phase1MPosApiTest`)
**Frontend build:** ✅ clean (Vite, 0 errors)
**Backend compile:** ✅ clean (Maven)

---

## Phase 1 — P0: Serial refund restores inventory and voids warranty

### Root cause
`OrderStockRestoreService.doRestore()` skipped line items with `order_line_item_serials` bridge records with a comment _"stock is restored by SerialLifecycleService"_ — but no such call existed in the refund path. Serial items stayed `SOLD` forever after a refund; `quantity_on_hand` never recovered (DB trigger only fires on serial status change); warranty records remained `ACTIVE`.

### Fix
**`SerialLifecycleService.java`** — new method `restoreSoldSerialsForRefund(UUID orderId, UUID actorId)`:
- Finds all `order_line_item_serials` bridges for the order
- For each `SOLD` serial: transitions to `IN_STOCK`, clears `soldAt` and `orderLineItemId`
- Writes stock movement with `referenceType = ORDER_REFUND_SERIAL` (distinct from `ORDER_REFUND` used by non-serial restore — enables independent idempotency guards)
- Sets associated `warranty_records.status = VOIDED` (was `ACTIVE`)
- Idempotent: no-op if `ORDER_REFUND_SERIAL` movement already exists for the order

**`RefundService.java`** — in `applyRefund()`, added call alongside existing `orderStockRestoreService.restoreForRefund()`:
```java
if (fullRefund && wasCompleted) {
    orderStockRestoreService.restoreForRefund(orderId);         // non-serial items
    serialLifecycleService.restoreSoldSerialsForRefund(orderId, adminId);  // serial items ← NEW
}
```

**Test added:** `posRefund_fullRefundSerialTrackedOrder_restoresSerialAndVoidsWarranty`
- Creates serial-tracked product/variant with one IN_STOCK serial
- Creates POS CASH order → asserts serial is `SOLD`, warranty is `ACTIVE`
- Full refund → asserts serial back to `IN_STOCK`, warranty `VOIDED`, stock movement `ORDER_REFUND_SERIAL` written, order status `REFUNDED`

---

## Phase 2 — P0/P1: FE cart items now carry `hasSerial` flag

### Root cause
`normalizeVariant()` in `contracts.js` did not expose `trackSerials` from the backend response. `addToCart()` in `PosScreen.jsx` never set `hasSerial`. The serial warning in `RefundDialog` (`items.some((it) => it.hasSerial === true)`) was always `false`.

### Fix
**`bigbike-admin/src/lib/contracts.js`** — added to `normalizeVariant()`:
```js
trackSerials: Boolean(input.trackSerials),
```

**`bigbike-admin/src/screens/PosScreen.jsx`** — added to `addToCart()` cart item:
```js
hasSerial: variant.trackSerials === true,
```

---

## Phase 3 — P1: CREDIT downPayment refund UI and BE `paidAmount`

### Root cause
`ReceiptModal` checked `isPaid = order?.paymentStatus === 'PAID'` — CREDIT orders with a downPayment have status `PARTIALLY_PAID`, so the refund button was permanently hidden even though money was collected. Also, `maxRefundable` was derived from the FE cart total rather than the actual collected amount, so for CREDIT orders it could allow over-refunding.

`PosOrderResponse` did not include `paidAmount` or `refundAmount`, forcing the FE to guess.

### Fix
**`PosOrderService.java`** — `PosOrderResponse` record extended with two new fields:
```java
BigDecimal paidAmount,   // collected at point of sale (subtotal for CASH/CARD, downPayment for CREDIT)
BigDecimal refundAmount  // 0 at creation; from order entity on idempotency retry
```
All 3 constructor call sites updated. For the normal return path: `paidAmount = isCreditOrder ? downPayment : subtotal`.

**`PosScreen.jsx` — `ReceiptModal`** — refactored refund state logic:
- `canHaveRefund`: `['PAID','PARTIALLY_PAID','PARTIALLY_REFUNDED'].includes(order?.paymentStatus)`
- `effectivePaid`: uses `order.paidAmount` from BE when present; falls back to cart total for legacy PAID orders
- `alreadyRefunded`: accumulates BE `order.refundAmount` + local session refunds
- `maxRefundable = max(0, effectivePaid − alreadyRefunded)`
- `canRefundAction`: local computed flag (has remaining amount to refund)
- Refund button shown when `canHaveRefund && canRefund` (permission prop, see Phase 4)

---

## Phase 4 — P1: Separate `pos.refund` permission

### Root cause
Refund was gated on `pos.write` — any cashier who can create sales could also issue refunds without separate authorization.

### Fix
**`V112__add_pos_refund_permission.sql`** (new migration):
- Seeds `pos.refund` for `ADMIN` role; `SHOP_MANAGER` does not receive it by default

**`AdminPosController.java`** — `posRefund()` endpoint now requires `pos.refund` instead of `pos.write`

**`App.jsx`** — passes `canRefund={hasPermission('pos.refund')}` to `PosScreen`

**`PosScreen.jsx`** — `PosScreen` props extended with `canRefund`; threaded into `ReceiptModal`; refund button gated on `canHaveRefund && canRefund`

**`RolesScreen.jsx`** — added `pos.refund` to permission list (sensitive: true) and label map

**`locales/vi.json`** — `"permPosRefund": "Hoàn tiền đơn hàng tại quầy"`
**`locales/en.json`** — `"permPosRefund": "Refund walk-in orders"`

**`adminApi.js`** — `pos.refund` added to `ALL_PERMS` list

**`test-seed.sql`** — `pos.refund` seeded for ADMIN in H2 test environment

**Tests added:**
- `posRefund_withoutPosRefundPermission_returns403` — SHOP_MANAGER → 403
- `posRefund_withPosRefundPermission_returns200` — ADMIN → 200

---

## Phase 5 — P1/P2: Audit enrichment + CARD_TERMINAL transactionId

### Fix
**`PosOrderService.java`** — `createOrder()`:

1. **`payment.transactionId`**: For `CARD_TERMINAL` orders, `cardReferenceNumber` is now stored as `payment.transactionId` so card reconciliation has a machine-readable reference (previously only in the note text).

2. **Audit payload enriched** with:
   - `priceOverridden: true/false` — any item used `unitPriceOverride`
   - `creditLimitOverridden: true/false` — CREDIT order + actor has `receivables.override_limit` permission
   - `items: [{sku, qty, unitPrice}, …]` — per-line summary for audit trail

---

## Infra fix: Minio credentials in test properties

`src/test/resources/application.properties` now includes fixed test values for `bigbike.minio.*` so `MinioClient` can be instantiated during H2 integration tests (bucket init fails gracefully with a WARN — this is expected and safe).

---

## Pre-existing test assertion fix

Two assertions in `Phase1MPosApiTest` that were previously unreachable (tests couldn't run due to Minio context failure) checked `order.getRefundAmount()).isNull()` after a failed refund. `OrderEntity.refundAmount` is initialized to `BigDecimal.ZERO`, so the column is persisted as `0.00`, not `NULL`. Fixed to `isEqualByComparingTo(BigDecimal.ZERO)`.

---

## Files changed

| File | Change |
|---|---|
| `bigbike-backend/.../SerialLifecycleService.java` | Add `restoreSoldSerialsForRefund()` |
| `bigbike-backend/.../RefundService.java` | Inject `SerialLifecycleService`, call `restoreSoldSerialsForRefund()` on full refund |
| `bigbike-backend/.../PosOrderService.java` | Add `paidAmount`/`refundAmount` to response; enrich audit; save `transactionId` for card |
| `bigbike-backend/.../AdminPosController.java` | Gate refund on `pos.refund` permission |
| `bigbike-backend/.../V112__add_pos_refund_permission.sql` | Seed `pos.refund` for ADMIN |
| `bigbike-backend/src/test/.../Phase1MPosApiTest.java` | Add 3 new tests; fix 2 pre-existing assertions |
| `bigbike-backend/src/test/resources/application.properties` | Add Minio test credentials |
| `bigbike-backend/src/test/resources/db/test-seed.sql` | Seed `pos.refund` for ADMIN in H2 test env |
| `bigbike-admin/src/lib/contracts.js` | Expose `trackSerials` in `normalizeVariant()` |
| `bigbike-admin/src/screens/PosScreen.jsx` | `hasSerial` in cart; `canRefund` prop; refund state logic |
| `bigbike-admin/src/App.jsx` | Pass `canRefund` to `PosScreen` |
| `bigbike-admin/src/screens/RolesScreen.jsx` | Add `pos.refund` to permission list and label map |
| `bigbike-admin/src/lib/adminApi.js` | Add `pos.refund` to `ALL_PERMS` |
| `bigbike-admin/src/locales/vi.json` | `permPosRefund` label |
| `bigbike-admin/src/locales/en.json` | `permPosRefund` label |
