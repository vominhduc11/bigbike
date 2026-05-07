# Business Process

## Current Process Map

| Process | Current reality | Status | Evidence |
|---|---|---|---|
| Catalog discovery | Customers browse catalog/content, search, and settings/menu-driven navigation without auth. | `CONFIRMED_FROM_CODE` | public controllers, `SecurityConfig.java`, web/mobile clients |
| Guest/customer cart | Cart is session-backed for guests and customer-backed for signed-in users. Mutations require CSRF. | `CONFIRMED_FROM_CODE` | `CartController.java`, `CustomerCsrfFilter.java`, tests |
| Checkout | Checkout revalidates stock and price, resolves shipping, applies coupons, creates order/payment records, decrements stock, and pushes admin order notifications. | `CONFIRMED_FROM_CODE` | `CheckoutService.java`, `Phase1FCheckoutApiTest.java` |
| POS sale | Admin POS creates immediate paid/completed in-store orders, decrements stock, writes payment/audit records, and emits an order event. | `CONFIRMED_FROM_CODE` | `PosOrderService.java`, `Phase1MPosApiTest.java` |
| Coupon lifecycle | Coupon can be applied to cart, revalidated on cart refresh, redeemed at checkout, and auto-expired by scheduler. | `CONFIRMED_FROM_CODE` | `CartService.java`, `CheckoutService.java`, `CouponExpiryScheduler.java` |
| Media upload | Admin uploads pass server-side MIME/content validation before persistence to MinIO-backed storage. | `CONFIRMED_FROM_CODE` | `AdminMediaService.java`, `AdminMediaP0Test.java` |
| Inventory adjustment | Admin manual adjustments and order/return side effects create stock movement records. | `CONFIRMED_FROM_CODE` | `AdminInventoryService.java`, `CheckoutService.java`, `AdminReturnService.java` |
| Customer return | Customer submits return request from their own order; admin later reads and updates return status. | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java`, `AdminReturnController.java`, `Phase1LReturnsApiTest.java` |
| Admin order feed | Backend pushes order events over WebSocket to authenticated admin clients. | `CONFIRMED_FROM_CODE` | `WebSocketConfig.java`, `AdminOrderWsService.java`, `adminWebSocket.js` |

## Process Notes

### Customer checkout

1. Customer or guest builds cart.
2. Optional coupon is applied and stored on the cart.
3. Checkout revalidates product price/stock and coupon validity.
4. Backend creates the order, payment row, shipping row, and order notes.
5. Backend decrements stock and stores order-applied coupons.
6. Backend sends email and pushes `/topic/admin/orders` event.

Status: `CONFIRMED_FROM_CODE`

### POS sale

1. Admin searches products through POS product search.
2. Admin submits POS order with items, payment method, idempotency key, and optional customer/staff context.
3. Backend validates permissions, stock, publish status, price override privilege, and tendered amount rules.
4. Backend creates order as `COMPLETED` + `PAID`, creates a `POS` payment, decrements stock, writes audit/system note, and emits order event.

Status: `CONFIRMED_FROM_CODE`

### Inventory receiving caveat

Receipt schema exists in Flyway, but a receiving process built on top of `stock_receipts` was not confirmed in the current Java service/controller layer.

Status: `NOT_FOUND_IN_REPO`
