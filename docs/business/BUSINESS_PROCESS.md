# Business Process

## Current Process Map

| Process | Current reality | Status | Evidence |
|---|---|---|---|
| Catalog discovery | Customers browse catalog/content, search, and settings/menu-driven navigation without auth. | `CONFIRMED_FROM_CODE` | public controllers, `SecurityConfig.java`, web clients |
| Guest/customer cart | Cart is session-backed for guests and customer-backed for signed-in users. Mutations require CSRF. | `CONFIRMED_FROM_CODE` | `CartController.java`, `CustomerCsrfFilter.java`, tests |
| Checkout | Checkout revalidates availability (per-variant `isAvailable`) and price, resolves shipping, creates order/payment records, and pushes admin order notifications. **No quantity decrement** (boolean availability, V261). | `CONFIRMED_FROM_CODE` | `CheckoutService.java`, `Phase1FCheckoutApiTest.java` |
| ~~POS sale~~ | **REMOVED (owner decision 2026-06-23, online-only).** In-store / walk-in selling is no longer recorded in the system; the POS endpoints, service, and `pos.*` permissions were dropped. Every sale now goes through the online checkout process above. | `REMOVED` | — |
| Media upload | Admin uploads pass server-side MIME/content validation before persistence to MinIO-backed storage. | `CONFIRMED_FROM_CODE` | `AdminMediaService.java`, `AdminMediaP0Test.java` |
| Inventory adjustment | Admin manual adjustments and order side effects create stock movement records. | `CONFIRMED_FROM_CODE` | `AdminInventoryService.java`, `CheckoutService.java` |
| Admin order feed | Backend pushes order events over WebSocket to authenticated admin clients. | `CONFIRMED_FROM_CODE` | `WebSocketConfig.java`, `AdminOrderWsService.java`, `adminWebSocket.js` |

## Process Notes

### Customer checkout

1. Customer or guest builds cart.
2. Checkout revalidates product price/stock.
3. Backend creates the order, payment row, shipping row, and order notes. (No quantity decrement — boolean availability, V261.)
4. Backend sends email and pushes `/topic/admin/orders` event.

Status: `CONFIRMED_FROM_CODE`

### POS sale — REMOVED (owner decision 2026-06-23, online-only)

The in-store / walk-in point-of-sale process was removed entirely. Walk-in customers are no longer entered into the system; there is no POS product search, no POS order creation, and no `POS` payment. All sales flow through the online customer-checkout process above.

Status: `REMOVED`

### Inventory receiving caveat

The receipt-based receiving schema (`stock_receipts`, `stock_receipt_lines`, `stock_receipt_serials`) was **dropped in V120**. It was schema-only and never built. Receiving is handled entirely through stock movements (type `IN`).

Status: `REMOVED`

## Operational Reality Gaps (for production)

These business processes are **expected to exist** for a Vietnamese online e-commerce shop running real operations, but are **not present in the current repo**. Listed here so AI agents and humans do not assume they exist.

| Process | Current finding | Status | Evidence / Note |
|---|---|---|---|
| Invoice / e-invoice (hóa đơn điện tử) | No `invoice` entity, no service, no provider integration. **Owner decision 2026-07-06: KHÔNG triển khai hoá đơn điện tử trong hệ thống** — xuất hoá đơn (nếu có) xử lý thủ công ngoài hệ thống. | `OUT_OF_SCOPE` | Trước cờ NEEDS_BUSINESS_CONFIRMATION theo NĐ 123/2020/NĐ-CP; owner đã chốt không làm. Tuân thủ pháp lý do chủ shop tự chịu ngoài hệ thống. |
| Legacy bank-transfer reconcile (BACS) | Storefront mới chỉ nhận `COD`; `BACS` bị từ chối ở checkout. Admin vẫn đọc và đối soát thủ công các đơn BACS cũ qua `paymentStatus`/`paidAmount`. | `LEGACY_COMPATIBILITY` | Không quảng bá BACS như lựa chọn thanh toán mới; giữ khả năng vận hành dữ liệu cũ. |
| External payment provider / webhook | Không có cổng thanh toán tự động. Kế hoạch tích hợp Alepay/ZaloPay đã bị bỏ — đơn storefront mới dùng COD cố định, không có redirect hay webhook. | `NOT_FOUND_IN_REPO` | Mọi khoản COD do admin đối soát thủ công. Xem `INTEGRATION_GUIDE.md`. |
| External shipping carrier (GHN/GHTK/ViettelPost) | `fulfillmentStatus` tồn tại trên `OrderEntity` nhưng không có carrier integration/waybill tự động. Shop tự sắp xếp giao hàng; khách được miễn phí giao hàng theo `SHIP_RULE_001`. | `NOT_FOUND_IN_REPO` | Fulfillment chạy thủ công; không có cấu hình phương thức/phí giao hàng trong hệ thống. |
| Stock receiving workflow | Receipt tables (V52/V53/V55) were dropped in V120 by business decision — never built. The current Còn/Hết model has no receiving or quantity movement workflow. | `REMOVED` | Resolved 2026-05-16; boolean availability since V261. |
| Warranty / product-serial lifecycle | **Both removed.** Serial-number tracking was removed 2026-06-23 (V259); the **warranty feature was removed entirely 2026-06-23 (V266)** — no warranty records, no creation on `COMPLETED`/POS sale, no void, no lookup page, no claim/repair workflow. Customer-facing warranty wording survives only as CMS policy content and per-product marketing rows. | `REMOVED` | `V259__remove_serial_management.sql`, `V266__remove_warranty.sql`. |
| Customer-data export / delete (right to be forgotten) | No `GET /api/v1/customer/me/export` or `DELETE /api/v1/customer/me`; no anonymize-on-request endpoint. | `NOT_FOUND_IN_REPO` | Required by Nghị định 13/2023/NĐ-CP về dữ liệu cá nhân. |
| Customer support / dispute / complaint handling | No customer-facing support channel beyond the static contact info (hotline/Zalo/Facebook/address) on `/lien-he`. **Owner decision 2026-07-06: KHÔNG xây kênh hỗ trợ/khiếu nại/ticket/SLA** — khách liên hệ trực tiếp qua hotline/Zalo/Facebook trên `/lien-he`. | `OUT_OF_SCOPE` | Trước cờ NEEDS_BUSINESS_CONFIRMATION theo NĐ 85/2021; owner chốt không làm. Nghĩa vụ pháp lý B2C do chủ shop tự chịu ngoài hệ thống. |
| Notification center (admin read/unread) | Persistent `admin_notifications` table (V102); `AdminNotificationService` + `AdminNotificationController` (GET list-unread, POST mark-read, POST mark-all-read). WS push supplements persistent store — admin offline will not miss events. | `CONFIRMED_FROM_CODE` | `AdminNotificationController.java`, `V102__create_admin_notifications_table.sql` |
| Backup / restore / data retention runbook | Out of repo (DevOps concern). | `NEEDS_PRODUCTION_RUNTIME_VERIFICATION` | Document in deployment runbook before production. |
