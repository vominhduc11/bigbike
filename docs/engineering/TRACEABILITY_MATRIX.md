# Traceability Matrix

| Business capability | Client surface | API/controller | Service/data path | Test evidence | Status |
|---|---|---|---|---|---|
| Catalog search | web, mobile | `PublicSearchController` | search service + payload DTOs | indirect via clients; no dedicated suite confirmed here | `CONFIRMED_FROM_CODE` |
| Vietnam address lookup | web, mobile | `VnAddressController` | address service/data file | client endpoint coverage confirmed | `CONFIRMED_FROM_CODE` |
| Cart | web, mobile | `CartController` | `CartService`, cart tables, coupon attach/remove | `Phase1ECartApiTest.java` | `CONFIRMED_FROM_TEST` |
| Checkout | web, mobile | `CheckoutController` | `CheckoutService`, order/payment/shipping/coupon/stock tables | `Phase1FCheckoutApiTest.java` | `CONFIRMED_FROM_TEST` |
| Coupon lifecycle | admin, web, mobile, backend scheduler | `AdminCouponController`, cart/checkout endpoints | `CartService`, `CheckoutService`, `CouponExpiryScheduler` | `Phase1ECartApiTest.java`, `Phase1FCheckoutApiTest.java`, `Phase1JAdminSettingsMenuCouponApiTest.java` | `CONFIRMED_FROM_TEST` |
| POS | admin | `AdminPosController` | `PosOrderService`, orders/payments/stock/audit/ws | `Phase1MPosApiTest.java` | `CONFIRMED_FROM_TEST` |
| Media hardening | admin | `AdminMediaController` | `AdminMediaService`, MinIO/media refs | `AdminMediaP0Test.java` | `CONFIRMED_FROM_TEST` |
| Customer addresses | web, mobile | `CustomerAddressController` | `CustomerAddressService` | no dedicated suite reopened in this pass | `CONFIRMED_FROM_CODE` |
| Returns | web, mobile, admin | `CustomerOrderController`, `AdminReturnController` | customer/admin return services | `Phase1LReturnsApiTest.java` | `CONFIRMED_FROM_TEST` |
| Admin order push | admin | WebSocket `/ws` + `/topic/admin/orders` | `WebSocketConfig`, `AdminOrderWsService`, `OrderWsEvent` | no dedicated automated WS suite reopened in this pass | `CONFIRMED_FROM_CODE` |
| Receipt-based receiving flow | none | none | dropped in V120 | none | `REMOVED` |
| Dashboard revenue accuracy (gross vs paid) | admin | `AdminDashboardController` | `AdminDashboardService`, `OrderJpaRepository.sumPaidRevenueSince` | no dedicated suite | `CONFIRMED_FROM_CODE` (P-1 fix applied) |
| Accounts Receivable | admin | `AdminReceivableController` | `ReceivableService`, `ReceivableQueryService`, `CreditPolicyService`, `ReceivableOverdueScheduler` (cron `0 5 0 * * ?`), `ReceivableJpaRepository` | `AdminReceivableApiTest.java` | `CONFIRMED_FROM_TEST` |
| POS credit sale (CREDIT) | admin | `AdminPosController` (CREDIT branch) | `PosOrderService` + `CreditPolicyService` + `ReceivableService.createReceivableForOrder` | `Phase1MPosApiTest.java` (credit branch) + `AdminReceivableApiTest.java` | `CONFIRMED_FROM_TEST` |
| External payment provider / webhook | none confirmed | none confirmed | none confirmed (online checkout uses provider `INTERNAL` for COD/BACS only) | none | `NOT_FOUND_IN_REPO` |
| External shipping carrier | none confirmed | none confirmed | none confirmed (`fulfillmentStatus` field exposed on order detail; no carrier integration / waybill / tracking code) | none | `NOT_FOUND_IN_REPO` |
| Invoice / e-invoice | none | none | none | none | `NOT_FOUND_IN_REPO` |
| Stock receiving workflow | none | none | receipt tables dropped in V120 (`V120__drop_stock_receipt_tables.sql`) — receiving runs through `stock_movements` | none | `REMOVED` |
