# Workflow Overview

## Customer Commerce Flow

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 1 | Guest/Customer | Browse products, content, search, and suggestions | `CONFIRMED_FROM_CODE` | public controllers, web/mobile clients |
| 2 | Guest/Customer | Build cart with cookie or customer session | `CONFIRMED_FROM_CODE` | `CartController.java`, `CartService.java` |
| 3 | Guest/Customer | Optionally apply coupon to cart | `CONFIRMED_FROM_CODE` | `CartService.applyCoupon` |
| 4 | Guest/Customer | Submit checkout with CSRF token | `CONFIRMED_FROM_CODE` | `CustomerCsrfFilter.java`, `CheckoutService.java` |
| 5 | System | Revalidate price, stock, coupon, shipping method | `CONFIRMED_FROM_CODE` | `CheckoutService.java` |
| 6 | System | Create order, payment, notes, shipping, order-applied coupons | `CONFIRMED_FROM_CODE` | `CheckoutService.java` |
| 7 | System | Decrement stock and push admin order event | `CONFIRMED_FROM_CODE` | `CheckoutService.java`, `AdminOrderWsService.java` |

## POS Workflow

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 1 | Admin / Shop manager | Search POS products | `CONFIRMED_FROM_CODE` | `AdminPosController.java` |
| 2 | Admin / Shop manager | Submit POS order with payment method and idempotency key | `CONFIRMED_FROM_CODE` | `AdminPosController.java`, `PosOrderService.java` |
| 3 | System | Validate stock, publish status, tendered amount, and override permission | `CONFIRMED_FROM_CODE` | `PosOrderService.java` |
| 4 | System | Create order as completed/paid | `CONFIRMED_FROM_CODE` | `PosOrderService.java` |
| 5 | System | Persist payment, audit log, system note, customer/staff snapshot, stock movement | `CONFIRMED_FROM_CODE` | `PosOrderService.java`, `Phase1MPosApiTest.java` |
| 6 | System | Push `NEW_ORDER` WebSocket event | `CONFIRMED_FROM_CODE` | `PosOrderService.java`, `AdminOrderWsService.java` |

## Media Workflow

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 1 | Admin | Upload file to admin media endpoint | `CONFIRMED_FROM_CODE` | `AdminMediaController.java` |
| 2 | System | Detect MIME from content with Apache Tika | `CONFIRMED_FROM_CODE` | `AdminMediaService.java` |
| 3 | System | Reject unsupported/empty/fake MIME uploads, including SVG | `CONFIRMED_FROM_CODE` | `AdminMediaP0Test.java` |
| 4 | System | Persist media metadata and storage reference | `CONFIRMED_FROM_CODE` | `AdminMediaService.java` |

## Address Workflow

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 1 | Web/Mobile | Load provinces | `CONFIRMED_FROM_CODE` | `VnAddressController.java`, clients |
| 2 | Web/Mobile | Load districts by province code | `CONFIRMED_FROM_CODE` | `VnAddressController.java` |
| 3 | Web/Mobile | Load wards by district code | `CONFIRMED_FROM_CODE` | `VnAddressController.java` |

## Return Workflow

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 1 | Customer | Submit return from own order | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java`, `Phase1LReturnsApiTest.java` |
| 2 | Customer | View own returns | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java` |
| 3 | Admin | Review return list/detail | `CONFIRMED_FROM_CODE` | `AdminReturnController.java` |
| 4 | Admin | Update return status | `CONFIRMED_FROM_CODE` | `AdminReturnController.java`, `AdminReturnService.java` |
| 5 | System | Refund/stock side effects depend on admin return service path | `NEEDS_VERIFICATION` for full lifecycle detail | `AdminReturnService.java` |
