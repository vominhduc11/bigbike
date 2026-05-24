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
| External payment gateway | Out of scope. Online checkout supports only `COD` and `BACS` (manual bank transfer), both reconciled manually by admin. No automatic gateway, no redirect, no webhook. The Alepay/ZaloPay plan was dropped. | `NOT_FOUND_IN_REPO` | `CheckoutService.java`, `INTEGRATION_GUIDE.md` |
| External shipping carrier | No GHN, GHTK, or Viettel Post integration was confirmed in active source. `OrderEntity.fulfillmentStatus` field exists without carrier-driven lifecycle. | `NOT_FOUND_IN_REPO` | repo search, `INTEGRATION_GUIDE` verification |
| Stock receipt workflow | Receipt tables were dropped in V120 (business decision, 2026-05-16) — schema-only, never built. Receiving runs through `stock_movements`. | `REMOVED` | `V120__drop_stock_receipt_tables.sql` |
| Invoice / e-invoice (hóa đơn điện tử) | No invoice entity / service / e-invoice provider integration. | `NOT_FOUND_IN_REPO` | Required by Nghị định 123/2020 for legal entities; NEEDS_BUSINESS_CONFIRMATION on provider |
| Customer-data export / delete (Nghị định 13/2023) | No customer-facing data-portability endpoint. | `NOT_FOUND_IN_REPO` | repo search |
| Customer support / ticketing | No customer-facing support channel beyond static contact info (hotline/Zalo/Facebook/address) on `/lien-he`; no contact form, ticketing, SLA, or escalation. | `NOT_FOUND_IN_REPO` | repo search |
| Notification center (admin read/unread) | Persistent `admin_notifications` table (V102); `AdminNotificationController` with list-unread + mark-read endpoints. | `CONFIRMED_FROM_CODE` | `AdminNotificationController.java`, `V102__create_admin_notifications_table.sql` |
| Bộ Công Thương TMĐT registration / legal-content footer badge | CMS-driven legal pages; registration status outside repo. | `NEEDS_LEGAL_CONFIRMATION` | `app/chinh-sach/[slug]`, `app/huong-dan/[...sub]` |

> Production-readiness verdict: ❌ NOT_READY. See `docs/business/ACCEPTANCE_CRITERIA.md` for the 15-blocker production gate.

## Operational Notes

- The backend Docker profile defaults to `prod` in `docker-compose.yaml`.
- Customer-facing cart and checkout use cookie-based sessions plus CSRF validation.
- Admin APIs use JWT bearer auth; admin WebSocket connect also requires JWT.
- Mobile is a real client, but release ownership and support level still need explicit governance.
