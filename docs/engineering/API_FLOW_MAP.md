# API Flow Map

## Client To API To Service

| Client surface | Endpoint(s) | Backend entrypoint | Core side effects / data | Status |
|---|---|---|---|---|
| Web/mobile search | `GET /api/v1/search`, `GET /api/v1/search-suggest` | `PublicSearchController` | Search result payload from global search service | `CONFIRMED_FROM_CODE` |
| Web/mobile address lookup | `GET /api/v1/address/**` | `VnAddressController` | Read-only administrative address data | `CONFIRMED_FROM_CODE` |
| Web/mobile contact | `POST /api/v1/contact` | `ContactController` | Contact submission flow | `CONFIRMED_FROM_CODE` |
| Cart UI/mobile | `/api/v1/cart`, `/api/v1/cart/items`, `/api/v1/cart/coupons` | `CartController` -> `CartService` | Session/customer cart, item snapshots, coupon attach/remove | `CONFIRMED_FROM_CODE` |
| Checkout UI/mobile | `POST /api/v1/checkout`, `POST /api/v1/orders/quick-buy` | `CheckoutController` -> `CheckoutService` | Order/payment/shipping/coupon snapshots, stock decrement, notifications, WS event | `CONFIRMED_FROM_CODE` |
| Customer address UI/mobile | `/api/v1/customer/addresses` | `CustomerAddressController` -> `CustomerAddressService` | Own-address CRUD | `CONFIRMED_FROM_CODE` |
| Customer orders UI/mobile | `/api/v1/customer/orders` | `CustomerOrderController` -> `OrderReadService` | Own order list/detail | `CONFIRMED_FROM_CODE` |
| Customer returns UI/mobile | `/api/v1/customer/orders/returns`, `/{returnId}`, `/{orderId}/returns` | `CustomerOrderController` -> `CustomerReturnService` | Own return list/detail/create | `CONFIRMED_FROM_CODE` |
| Admin POS UI | `/api/v1/admin/pos/products/search`, `/api/v1/admin/pos/orders` | `AdminPosController` -> `PosOrderService` | POS search; immediate sale (CASH/CARD_TERMINAL); credit sale (CREDIT): validates customer credit profile, creates order with UNPAID paymentStatus, creates ReceivableEntity | `CONFIRMED_FROM_CODE` |
| Admin receivables UI | `GET /admin/receivables`, `GET /admin/receivables/{id}`, `GET /admin/receivables/summary`, `GET /admin/receivables/aging`, `POST /admin/receivables/{id}/payments`, `POST /admin/receivables/{id}/write-off`, `GET/PATCH /admin/customers/{id}/credit` | `AdminReceivableController` -> `ReceivableService` / `ReceivableQueryService` | Receivable list/detail/filter, payment recording (updates paidAmount + paymentStatus + ReceivableEntity + audit log), write-off (sets WRITTEN_OFF + audit log), customer credit profile CRUD | `CONFIRMED_FROM_CODE` |
| Admin media UI | `/api/v1/admin/media` | `AdminMediaController` -> `AdminMediaService` | Tika validation, MinIO storage, metadata persistence | `CONFIRMED_FROM_CODE` |
| Admin inventory UI | `/api/v1/admin/inventory/**` | `AdminInventoryController` -> `AdminInventoryService` | Stock list, movement list, serial validation, manual adjustments | `CONFIRMED_FROM_CODE` |
| Admin returns UI | `/api/v1/admin/returns/**` | `AdminReturnController` -> `AdminReturnService` | Return read/update, refund/stock side effects path | `CONFIRMED_FROM_CODE`; full refund side-effect detail `NEEDS_VERIFICATION` |
| Admin live order feed | WebSocket `/ws` + topic `/topic/admin/orders` | `WebSocketConfig` + `AdminOrderWsService` | Admin push notifications after commit | `CONFIRMED_FROM_CODE` |

## Flow Highlights

### Checkout

`cart client -> CheckoutService -> order/payment/shipping tables -> stock movements -> order-applied coupons -> email + /topic/admin/orders`

Status: `CONFIRMED_FROM_CODE`

### POS

`admin POS UI -> AdminPosController -> PosOrderService -> order/payment/audit/stock movement -> /topic/admin/orders`

Status: `CONFIRMED_FROM_CODE`

### POS credit sale (CREDIT payment method)

`admin POS UI -> AdminPosController -> PosOrderService -> CreditPolicyService (validate limit) -> OrderEntity (COMPLETED + UNPAID) + ReceivableEntity (OPEN) + AuditLogEntity`

Note: downPayment feature was removed in V114 (migration simplified payment model). CREDIT orders are always fully unpaid at creation; debt is collected later via ReceivableService.recordPayment.

Status: `CONFIRMED_FROM_CODE`

### Receivable payment recording

`admin receivables UI -> AdminReceivableController -> ReceivableService.recordPayment -> ReceivableEntity (paidAmount++) + OrderEntity (paidAmount++) + PaymentEntity (new) + AuditLogEntity`

Transitions: OPEN/OVERDUE → PARTIALLY_PAID (if partially paid) → CLOSED (if fully paid)

Status: `CONFIRMED_FROM_CODE`

### Receivable write-off

`admin receivables UI -> AdminReceivableController -> ReceivableService.writeOff -> ReceivableEntity (WRITTEN_OFF) + AuditLogEntity`

Note: OrderEntity.paymentStatus is NOT updated on write-off — it stays UNPAID. The debt is cancelled at the AR level only. V116 CHECK constraint prohibits WRITTEN_OFF as an order payment status value.

Requires `receivables.write_off` permission (ADMIN only).

Status: `CONFIRMED_FROM_CODE`

### Inventory receiving caveat

`stock_receipts` schema exists, but a confirmed `controller -> service -> DB` receiving flow was not found.

Status: `NOT_FOUND_IN_REPO`
