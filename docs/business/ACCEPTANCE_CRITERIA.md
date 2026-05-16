# Acceptance Criteria

This file captures measurable acceptance criteria that can be verified from current code, config, and tests.

## Module Criteria

| Module | Acceptance criteria | Current evidence | Verdict |
|---|---|---|---|
| Cart | Guest/customer carts work, CSRF blocks unsafe mutations, totals are recalculated, coupon refresh works. | `Phase1ECartApiTest.java` | `PASS` |
| Checkout | Checkout validates payload, shipping, stock, coupon redemption, idempotency, and creates orders. | `Phase1FCheckoutApiTest.java`, `CheckoutService.java` | `PASS` |
| Coupon | Admin coupon CRUD exists; cart apply and checkout redemption are enforced; expiry scheduler exists. | `Phase1JAdminSettingsMenuCouponApiTest.java`, `Phase1ECartApiTest.java`, `Phase1FCheckoutApiTest.java`, `CouponExpiryScheduler.java` | `PASS` |
| POS | POS search and order creation require auth; completed/paid immediate sale is enforced; stock/payment/audit side effects exist. | `Phase1MPosApiTest.java`, `PosOrderService.java` | `PASS` |
| Media | Valid PNG upload works; fake MIME, empty files, SVG, and unsupported types fail; delete/restore flows exist. | `AdminMediaP0Test.java` | `PASS` |
| Returns | Customer return create/list/detail and admin return list/detail/status endpoints exist. | `Phase1LReturnsApiTest.java`, return controllers | `PASS` |
| Vietnam address | Province/district/ward endpoints are public and available to web/mobile clients. | `VnAddressController.java`, client endpoint maps | `PASS` |
| WebSocket admin feed | Admin clients can connect with JWT and subscribe to admin order topic. | `WebSocketConfig.java`, `adminWebSocket.js` | `PASS` |
| Mobile docs coverage | Mobile client docs describe real architecture and endpoint map. | `bigbike_mobile/README.md`, `api_client.dart`, `api_endpoints.dart` | `PASS` |
| Stock receipt workflow | Receiving workflow is implemented end to end in Java service/controller layer. | no confirmed service/controller | `NEEDS_VERIFICATION` |

## Release Caveats

| Topic | Current limitation | Status |
|---|---|---|
| External payment gateway | No confirmed live provider/webhook contract. Online checkout uses provider `INTERNAL` (COD/BACS only). | `NOT_FOUND_IN_REPO` |
| External shipping carrier | No confirmed GHN/GHTK/ViettelPost integration. `fulfillmentStatus` field is exposed but has no carrier-driven lifecycle. | `NOT_FOUND_IN_REPO` |
| Mobile release ownership | Real client exists, but production support scope is still not formalized. | `NEEDS_VERIFICATION` |
| Receipt-based receiving flow | Schema exists without confirmed active API/service workflow. | `SCHEMA_ONLY` |
| Invoice / e-invoice (hóa đơn điện tử) | No invoice entity, no e-invoice provider integration. | `NOT_FOUND_IN_REPO` |
| Bank-transfer reconciliation (mismatch handling) | Manual via `paymentStatus`/`paidAmount` patches; no structured "bank transfer record" / "payment correction" entity. | `DOCUMENTED_NOT_ENFORCED` |
| Customer-data export / delete (Nghị định 13/2023) | No customer-facing data export or delete endpoint. | `NOT_FOUND_IN_REPO` |
| Customer support / ticketing | Only public contact form exists; no ticketing/SLA/escalation. | `NOT_FOUND_IN_REPO` |
| Notification center (admin read/unread) | Persistent `admin_notifications` table (V102); `AdminNotificationController` with list-unread, mark-read, mark-all-read endpoints. | `CONFIRMED_FROM_CODE` |
| Refund history per partial refund | `refundedAt` is overwritten; no `refund_transactions` table (REPORT_RULE_011). | `CODE_DEFECT` |
| Legal / compliance content (Privacy / Terms / Return / Shipping / Complaint policy + Bộ Công Thương registration / footer badge) | CMS-driven (`/chinh-sach/[slug]`); content correctness depends on what admin published. | `NEEDS_LEGAL_CONFIRMATION` |
| Email production deliverability | Code path confirmed; runtime not tested. | `NEEDS_PRODUCTION_RUNTIME_VERIFICATION` |
| WebSocket per-subscribe topic-level authz | CONNECT auth confirmed; per-subscribe authz not verified. | `NEEDS_VERIFICATION` |

> **Production-ready verdict:** ❌ NOT_READY. 15 blocker chia 4 nhóm:
>
> - **Business / Operational** (5 — B01 invoice, B05 bank reconciliation, B06 refund history, B08 verify-email POST drift, B12 customer support).
> - **Legal / Compliance** (3 — B02 Bộ Công Thương registration, B03 policy content, B04 customer-data export/delete).
> - **Ops / Security / Infra** (4 — B07 PROD_CONFIG bundle, B09 SUPER_ADMIN seed, B10 MinIO/SMTP smoke, B11 backup runbook).
> - **Strategic Business Decisions** (3 — B13 payment provider, B14 shipping carrier, B15 receiving + warranty + serial).
>
> Mức phạt và phạm vi nghĩa vụ pháp lý cụ thể cần legal counsel xác nhận theo hành vi vi phạm hiện hành; audit không thay thế tư vấn pháp lý chính thức.
