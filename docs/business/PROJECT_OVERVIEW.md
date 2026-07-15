# Project Overview

BigBike is a commerce platform for motorcycle safety gear and rider accessories.

## Repo Scope

| Surface | Runtime | Purpose | Current status | Evidence |
|---|---|---|---|---|
| `bigbike-web` | Next.js 16.2.4 + React 19 | Public catalog, SEO content, cart, checkout, customer account | `CONFIRMED_FROM_CODE` | `bigbike-web/package.json`, `bigbike-web/app`, `bigbike-web/lib` |
| `bigbike-admin` | Vite 8 + React 19 | Internal catalog, orders, customers, media (online-only; POS and returns removed 2026-06-23) | `CONFIRMED_FROM_CODE` | `bigbike-admin/package.json`, `bigbike-admin/src` |
| `bigbike-backend` | Spring Boot 4.0.5, Java 17 | API, business rules, persistence, auth, integrations, WebSocket | `CONFIRMED_FROM_CODE` | `bigbike-backend/pom.xml`, `bigbike-backend/src/main/java` |

## Core Business Domains

| Domain | Current reality | Status | Evidence |
|---|---|---|---|
| Catalog | Public product/category/brand/content reads are implemented across backend and web. | `CONFIRMED_FROM_CODE` | `SecurityConfig.java`, public controllers, `bigbike-web/lib/api/public-api.ts` |
| Cart and checkout | Guest and customer carts are live; checkout validates availability, price, CSRF, and idempotency. Storefront payment is fixed to COD. There is no shipping-method choice or shipping fee (`PAY_RULE_001`, `SHIP_RULE_001`). | `CONFIRMED_FROM_CODE` | `CartService.java`, `CheckoutService.java`, `Phase1ECartApiTest.java`, `Phase1FCheckoutApiTest.java` |
| ~~POS~~ | **REMOVED (owner decision 2026-06-23).** BigBike is now **online-only** — there is no in-store / walk-in point-of-sale flow. Walk-in customers are not entered into the system. | `REMOVED` | — |
| Media | Admin media upload uses Apache Tika validation and rejects unsupported MIME types; SVG is accepted but sanitized on upload (`SvgSanitizer`). | `CONFIRMED_FROM_CODE` | `AdminMediaService.java`, `SvgSanitizer.java`, `AdminMediaP0Test.java` |
| Inventory | Availability is the manual boolean **Còn hàng / Hết hàng** on each product/variant. Selling and cancelling do not decrement or restore stock; admin changes availability by hand. | `CONFIRMED_FROM_CODE` | `AdminCatalogMutationService.java`, `InventoryPolicyService.java`, `CheckoutService.java`, `AdminOrderService.java` |
| Returns | Customer return creation/listing and admin return status management are live. | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java`, `AdminReturnController.java`, `Phase1LReturnsApiTest.java` |
| Address lookup | Dữ liệu địa chỉ Việt Nam hai cấp (tỉnh/thành → phường/xã) đang hoạt động. Storefront dùng dữ liệu tích hợp sẵn; backend còn API đọc công khai tương đương nhưng không có caller nội bộ. | `CONFIRMED_FROM_CODE` | `VnAddressController.java`, `bigbike-web/lib/vn-address-data.ts`, `VnAddressFields.tsx` |
| WebSocket admin order feed | Admin order push events are live through STOMP/WebSocket. | `CONFIRMED_FROM_CODE` | `WebSocketConfig.java`, `AdminOrderWsService.java`, `adminWebSocket.js` |

## Confirmed Non-Goals Or Missing Pieces

| Topic | Current finding | Status | Evidence |
|---|---|---|---|
| External payment gateway | Out of scope. New storefront orders use fixed `COD`, reconciled manually by admin. No automatic gateway, redirect, or webhook. `BACS` is legacy-order compatibility only and is rejected for new checkout requests. The Alepay/ZaloPay plan was dropped. | `NOT_FOUND_IN_REPO` | `CheckoutService.java`, `INTEGRATION_GUIDE.md` |
| External shipping carrier | No GHN, GHTK, or Viettel Post integration was confirmed in active source. `OrderEntity.fulfillmentStatus` field exists without carrier-driven lifecycle. | `NOT_FOUND_IN_REPO` | repo search, `INTEGRATION_GUIDE` verification |
| Stock receipt workflow | Receipt tables were dropped in V120 (business decision, 2026-05-16) — schema-only, never built. The current boolean-availability model has no receiving workflow. | `REMOVED` | `V120__drop_stock_receipt_tables.sql`, `V261__inventory_availability_toggle.sql` |
| Invoice / e-invoice (hóa đơn điện tử) | No invoice entity / service / e-invoice provider integration. **Owner decision 2026-07-06: không triển khai.** | `OUT_OF_SCOPE` | Trước cờ theo NĐ 123/2020; owner chốt không làm — xử lý ngoài hệ thống nếu cần |
| Customer-data export / delete (Nghị định 13/2023) | No customer-facing data-portability endpoint. | `NOT_FOUND_IN_REPO` | repo search |
| Customer support / ticketing | No customer-facing support channel beyond static contact info (hotline/Zalo/Facebook/address) on `/lien-he`; no contact form, ticketing, SLA, or escalation. | `NOT_FOUND_IN_REPO` | repo search |
| Notification center (admin read/unread) | Persistent `admin_notifications` table (V102); `AdminNotificationController` with list-unread + mark-read endpoints. | `CONFIRMED_FROM_CODE` | `AdminNotificationController.java`, `V102__create_admin_notifications_table.sql` |
| Bộ Công Thương TMĐT registration / legal-content footer badge | Legal/policy pages are fixed in the web source; registration status remains outside repo. | `NEEDS_LEGAL_CONFIRMATION` | `app/chinh-sach/[slug]`, `app/huong-dan/[...sub]` |

> Production-readiness verdict: ❌ NOT_READY. See `docs/business/ACCEPTANCE_CRITERIA.md` for the 15-blocker production gate.

## Operational Notes

- The backend Docker profile defaults to `prod` in `docker-compose.yaml`.
- Customer-facing cart and checkout use cookie-based sessions plus CSRF validation.
- Admin APIs use JWT bearer auth; admin WebSocket connect also requires JWT.
