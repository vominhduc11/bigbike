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
| External payment gateway | No confirmed live provider/webhook contract. | `NOT_FOUND_IN_REPO` |
| External shipping carrier | No confirmed GHN/GHTK/ViettelPost integration. | `NOT_FOUND_IN_REPO` |
| Mobile release ownership | Real client exists, but production support scope is still not formalized. | `NEEDS_VERIFICATION` |
| Receipt-based receiving flow | Schema exists without confirmed active API/service workflow. | `NEEDS_VERIFICATION` |
