# Phase 1H — Admin Order Read / Status API

**Date:** 2026-04-21  
**Branch:** main  
**Tests:** 28 new (188 total, 0 failures)

---

## Scope

Read and management APIs for admin-side order operations. No refund gateway, payment webhook, email, or frontend work.

---

## Endpoints Implemented

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/admin/orders` | `orders.read` | List orders with filters |
| GET | `/api/v1/admin/orders/{orderId}` | `orders.read` | Full order detail (all notes) |
| PATCH | `/api/v1/admin/orders/{orderId}/status` | `orders.write` | Update order status |
| PATCH | `/api/v1/admin/orders/{orderId}/payment-status` | `orders.write` | Update payment status |
| POST | `/api/v1/admin/orders/{orderId}/notes` | `orders.write` | Add order note |
| GET | `/api/v1/admin/orders/{orderId}/notes` | `orders.read` | List all order notes |

All endpoints are under `/api/v1/admin/**` which requires `ROLE_ADMIN` (JWT or dev bypass).

---

## Files Created

### DTOs (`api/admin/dto/order/`)
- `AdminOrderListItemResponse.java` — list item with `customerEmail`, `customerPhone`, `itemCount`
- `AdminOrderDetailResponse.java` — full detail (all fields, internal notes visible)
- `AdminOrderNoteResponse.java` — note with `authorType`, `authorId`, `noteType`, `customerVisible`
- `UpdateOrderStatusRequest.java` — `status`, `note`, `customerVisible`
- `UpdatePaymentStatusRequest.java` — `paymentStatus`, `paidAmount`, `note`, `customerVisible`
- `CreateOrderNoteRequest.java` — `content`, `customerVisible`, `noteType`

### Service
- `service/admin/AdminOrderService.java` — all business logic

### Controller
- `api/admin/AdminOrderController.java` — thin controller, delegates to service

### Updated
- `service/auth/DevAdminAuthService.java` — added `orders.read` and `orders.write` to ADMIN role

---

## Business Rules

### Status Transitions
```
PENDING    → PROCESSING, ON_HOLD, CANCELLED, FAILED
ON_HOLD    → PROCESSING, CANCELLED, FAILED
PROCESSING → COMPLETED, CANCELLED, FAILED
COMPLETED  → REFUNDED
CANCELLED  → (terminal)
FAILED     → (terminal)
REFUNDED   → (terminal)
```
- Same status → idempotent 200, no DB write, no audit
- Unknown status string → 400
- Invalid transition → 409 Conflict

### Payment Status Rules
- `PAID`: paidAmount defaults to totalAmount if not provided; sets `paidAt`; marks payment record `SUCCEEDED`
- `PARTIALLY_PAID`: paidAmount must be > 0 and < totalAmount (else 400)
- `UNPAID`: paidAmount must be 0 (else 400); clears `paidAt`
- Other statuses: stored as-is

### Note Visibility
- Admin sees ALL notes (`customerVisible=true` and `false`)
- Customer/guest (Phase 1G) sees only `customerVisible=true` notes

### Audit Logging
Every mutation writes to `audit_logs`:
- `ORDER_STATUS_UPDATED` — before/after status
- `ORDER_PAYMENT_STATUS_UPDATED` — before/after paymentStatus
- `ORDER_NOTE_CREATED` — noteType and customerVisible

---

## Tests (28)

| # | Test | Covers |
|---|------|--------|
| 1 | `listOrders_noAuth_returns401` | Unauthenticated list |
| 2 | `listOrders_withAdminToken_returns200` | Basic authenticated list |
| 3 | `listOrders_includesCustomerFields` | customerEmail/customerPhone in list |
| 4 | `listOrders_filterByStatus_returnsMatchingOrders` | Status filter |
| 5 | `listOrders_filterByPaymentStatus_returnsMatchingOrders` | Payment status filter |
| 6 | `listOrders_searchByQ_filtersResults` | Q search (orderNumber) |
| 7 | `listOrders_paginationWorks` | Pagination size=1 |
| 8 | `getOrderDetail_noAuth_returns401` | Unauthenticated detail |
| 9 | `getOrderDetail_unknownId_returns404` | Unknown order ID |
| 10 | `getOrderDetail_success_includesLineItems` | Full detail (lineItems/addresses/shipping/payments) |
| 11 | `getOrderDetail_adminSeesAllNotes_includingInternal` | Admin sees internal notes |
| 12 | `updateOrderStatus_noAuth_returns401` | Unauthenticated status update |
| 13 | `updateOrderStatus_invalidStatus_returns400` | Unknown status string |
| 14 | `updateOrderStatus_invalidTransition_returns409` | CANCELLED→PROCESSING forbidden |
| 15 | `updateOrderStatus_sameStatus_idempotentReturns200` | Idempotent same-status |
| 16 | `updateOrderStatus_pendingToProcessing_succeeds` | ON_HOLD→PROCESSING |
| 17 | `updateOrderStatus_toCompleted_setsCompletedAt` | PROCESSING→COMPLETED + completedAt |
| 18 | `updateOrderStatus_toCancelled_setsCancelledAt` | PROCESSING→CANCELLED + cancelledAt |
| 19 | `updateOrderStatus_withNote_noteIsPersisted` | Status change with note |
| 20 | `updatePaymentStatus_noAuth_returns401` | Unauthenticated payment update |
| 21 | `updatePaymentStatus_paid_setsPaidAmountAndPaidAt` | PAID auto-amount + paidAt |
| 22 | `updatePaymentStatus_partiallyPaid_invalidAmount_returns400` | PARTIALLY_PAID validation |
| 23 | `updatePaymentStatus_unpaid_clearsPaidAt` | UNPAID clears paidAt |
| 24 | `updatePaymentStatus_invalidStatus_returns400` | Unknown payment status |
| 25 | `addNote_noAuth_returns401` | Unauthenticated note creation |
| 26 | `addNote_internalNote_savedWithCustomerVisibleFalse` | Internal note |
| 27 | `addNote_customerVisibleNote_appearsInNotesList` | Customer-visible note |
| 28 | `regression_existingApisStillWork` | Catalog/cart/checkout/auth unaffected |
