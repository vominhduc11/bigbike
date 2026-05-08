# Project Overview

BigBike is a commerce platform for motorcycle safety gear and rider accessories.

## Repo Scope

| Surface | Runtime | Purpose | Current status | Evidence |
|---|---|---|---|---|
| `bigbike-web` | Next.js 16.2.4 + React 19 | Public catalog, SEO content, cart, checkout, customer account | `CONFIRMED_FROM_CODE` | `bigbike-web/package.json`, `bigbike-web/app`, `bigbike-web/lib` |
| `bigbike-admin` | Vite 8 + React 19 | Internal catalog, orders, customers, media, coupons, POS, returns | `CONFIRMED_FROM_CODE` | `bigbike-admin/package.json`, `bigbike-admin/src` |
| `bigbike-backend` | Spring Boot 4.0.5, Java 17 | API, business rules, persistence, auth, integrations, WebSocket | `CONFIRMED_FROM_CODE` | `bigbike-backend/pom.xml`, `bigbike-backend/src/main/java` |
| `bigbike_mobile` | Flutter / Dart | Companion client with shared public/account/cart/checkout APIs | `CONFIRMED_FROM_CODE`; production ownership `NEEDS_VERIFICATION` | `bigbike_mobile/pubspec.yaml`, `bigbike_mobile/lib/core` |

## Core Business Domains

| Domain | Current reality | Status | Evidence |
|---|---|---|---|
| Catalog | Public product/category/brand/content reads are implemented across backend and web. | `CONFIRMED_FROM_CODE` | `SecurityConfig.java`, public controllers, `bigbike-web/lib/api/public-api.ts` |
| Cart and checkout | Guest and customer carts are live; checkout validates stock, price, shipping method, CSRF, and idempotency. | `CONFIRMED_FROM_CODE` | `CartService.java`, `CheckoutService.java`, `Phase1ECartApiTest.java`, `Phase1FCheckoutApiTest.java` |
| Coupon | Cart apply, cart refresh revalidation, checkout redemption, and expiry scheduler are live. | `CONFIRMED_FROM_CODE` | `CartService.java`, `CheckoutService.java`, `CouponExpiryScheduler.java`, coupon tests |
| POS | Admin POS is a live immediate-sale flow, not a deferred payment workflow. | `CONFIRMED_FROM_CODE` | `AdminPosController.java`, `PosOrderService.java`, `Phase1MPosApiTest.java` |
| Media | Admin media upload uses Apache Tika validation and rejects unsupported MIME types, including SVG. | `CONFIRMED_FROM_CODE` | `AdminMediaService.java`, `AdminMediaP0Test.java` |
| Inventory | Active service layer is movement-based inventory adjustment plus checkout/order/return side effects. | `CONFIRMED_FROM_CODE` | `AdminInventoryService.java`, `CheckoutService.java`, `AdminReturnService.java` |
| Returns | Customer return creation/listing and admin return status management are live. | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java`, `AdminReturnController.java`, `Phase1LReturnsApiTest.java` |
| Address lookup | Vietnam administrative address lookup is live and consumed by clients. | `CONFIRMED_FROM_CODE` | `VnAddressController.java`, `bigbike-web/lib/vn-address-data.ts`, `api_endpoints.dart` |
| WebSocket admin order feed | Admin order push events are live through STOMP/WebSocket. | `CONFIRMED_FROM_CODE` | `WebSocketConfig.java`, `AdminOrderWsService.java`, `adminWebSocket.js` |

## Confirmed Non-Goals Or Missing Pieces

| Topic | Current finding | Status | Evidence |
|---|---|---|---|
| External payment gateway | No live provider/webhook implementation was confirmed. Checkout currently records provider `INTERNAL` (COD/BACS only); POS records provider `POS`. | `NOT_FOUND_IN_REPO` | `CheckoutService.java`, `PosOrderService.java`, search for `webhook`, `VNPAY`, `MoMo`, `SEPAY` |
| External shipping carrier | No GHN, GHTK, or Viettel Post integration was confirmed in active source. `OrderEntity.fulfillmentStatus` field exists without carrier-driven lifecycle. | `NOT_FOUND_IN_REPO` | repo search, `INTEGRATION_GUIDE` verification |
| Stock receipt workflow | Receipt tables exist in Flyway, but no confirmed Java controller/service was found for a receiving workflow. | `SCHEMA_ONLY` | `V52__add_stock_receipts.sql`, `V53__add_stock_receipt_lines.sql`, `V55__add_receipt_serials.sql`, source search |
| Invoice / e-invoice (hóa đơn điện tử) | No invoice entity / service / e-invoice provider integration. | `NOT_FOUND_IN_REPO` | Required by Nghị định 123/2020 for legal entities; NEEDS_BUSINESS_CONFIRMATION on provider |
| Customer-data export / delete (Nghị định 13/2023) | No customer-facing data-portability endpoint. | `NOT_FOUND_IN_REPO` | repo search |
| Customer support / ticketing | Only public `ContactController POST /contact`; no ticketing / SLA / escalation. | `NOT_FOUND_IN_REPO` | repo search |
| Notification center (admin read/unread) | WS event + email only; no persistent `notifications` table. | `NOT_FOUND_IN_REPO` | `NotificationBell` consumes WS only |
| Bộ Công Thương TMĐT registration / legal-content footer badge | CMS-driven legal pages; registration status outside repo. | `NEEDS_LEGAL_CONFIRMATION` | `app/chinh-sach/[slug]`, `app/huong-dan/[...sub]` |

> Production-readiness verdict and the 15-blocker production gate live in `docs/audits/BUSINESS_PROCESS_RULE_PRODUCTION_READINESS_AUDIT.md`.

## Operational Notes

- The backend Docker profile defaults to `prod` in `docker-compose.yaml`.
- Customer-facing cart and checkout use cookie-based sessions plus CSRF validation.
- Admin APIs use JWT bearer auth; admin WebSocket connect also requires JWT.
- Mobile is a real client, but release ownership and support level still need explicit governance.
