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

## Operational Reality Gaps (for production)

These business processes are **expected to exist** for a Vietnamese e-commerce + walk-in shop running real operations, but are **not present in the current repo**. Listed here so AI agents and humans do not assume they exist.

| Process | Current finding | Status | Evidence / Note |
|---|---|---|---|
| Invoice / e-invoice (hóa đơn điện tử) | No `invoice` entity, no service, no provider integration (Misa/VNPT/SInvoice/Easyinvoice). Refund/cancel does not affect any invoice. | `NOT_FOUND_IN_REPO` | Required by Nghị định 123/2020/NĐ-CP for legal entities selling retail. NEEDS_BUSINESS_CONFIRMATION on which provider to integrate. |
| Bank-transfer manual reconcile (BACS) | Online checkout supports `COD` and `BACS` only (`CheckoutService.ALLOWED_PAYMENT_METHODS`); provider is `INTERNAL`. Admin patches `paymentStatus`/`paidAmount` thủ công sau khi nhận chuyển khoản. Đây là design intent — không có cổng tự động. | `MANUAL_BY_DESIGN` | Risk còn lại: data-entry errors. Có thể bổ sung "bank transfer record" / structured audit log để giảm rủi ro nhập sai, nhưng KHÔNG tích hợp auto-reconcile (SePay/VNPAY/MoMo). |
| External payment provider / webhook | Không có và không trong kế hoạch. SePay artifacts đã bị V59 xoá; không có code `webhook|VNPAY|MoMo|SePay` trong backend Java. | `OUT_OF_SCOPE` | Business chốt: thanh toán chuyển khoản đối soát thủ công, không dùng cổng auto. |
| External shipping carrier (GHN/GHTK/ViettelPost) | `fulfillmentStatus` field exists on `OrderEntity` but no transition map, no tracking number entity, no carrier integration code. Internal shipping limited to zones/methods (price config). | `NOT_FOUND_IN_REPO` | Without integration, fulfillment runs 100% offline (Excel/Zalo). |
| Stock receiving workflow | Tables `stock_receipts`, `stock_receipt_lines`, `receipt_serials` exist (V52/V53/V55) without active Java service/controller/UI. | `SCHEMA_ONLY` | Decide: implement vs. defer. |
| Warranty / product-serial lifecycle | Serials are stored on stock movements (`StockMovementSerialEntity`); there is no `product_serial` lifecycle table (RECEIVED → IN_STOCK → RESERVED → SOLD → RETURNED → WARRANTY_ACTIVE). No warranty activation/claim/repair flow. | `NOT_FOUND_IN_REPO` (full lifecycle) | NEEDS_BUSINESS_CONFIRMATION whether warranty is required for motorcycle gear. |
| Customer-data export / delete (right to be forgotten) | No `GET /api/v1/customer/me/export` or `DELETE /api/v1/customer/me`; no anonymize-on-request endpoint. | `NOT_FOUND_IN_REPO` | Required by Nghị định 13/2023/NĐ-CP về dữ liệu cá nhân. |
| Customer support / dispute / complaint handling | Public `ContactController POST /api/v1/contact` exists (rate-limited). No ticketing system, no SLA, no escalation, no complaint resolution workflow. | `NOT_FOUND_IN_REPO` | Required for B2C TMĐT per Nghị định 85/2021. NEEDS_BUSINESS_CONFIRMATION on tooling (Crisp/Zendesk/in-house). |
| Notification center (admin read/unread) | Admin has WebSocket toast (`NEW_ORDER`) and email notifications, but no persistent `notifications` table and no read/unread state. Admin offline during a WS event will permanently miss it. | `NOT_FOUND_IN_REPO` | `NotificationBell` component shows count only when WS connected. |
| Refund history (per partial refund) | `refundedAt` column is overwritten on every `RefundService.applyRefund()` call. No `refund_transactions` table. | `CODE_DEFECT` (REPORT_RULE_011) | Tracked as ORD-007 in `ORDER_PAYMENT_REFUND_WS_AUDIT.md`. |
| POS refund / hoàn tiền tại quầy | POS sales create `COMPLETED + PAID`. There is no POS-specific refund/return-at-counter service. POS refunds must go through admin order refund flow. | `NOT_FOUND_IN_REPO` | NEEDS_BUSINESS_CONFIRMATION. |
| Backup / restore / data retention runbook | Out of repo (DevOps concern). | `NEEDS_PRODUCTION_RUNTIME_VERIFICATION` | Document in deployment runbook before production. |
