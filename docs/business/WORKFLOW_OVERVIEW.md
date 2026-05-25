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

## Product Comparison Workflow

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 1 | Guest/Customer | Add a product to the comparison list via the compare button on a product card or the product detail page | `CONFIRMED_FROM_CODE` | `CompareButton.tsx`, `compare-context.tsx` |
| 2 | System | Enforce max 3 products and a same-category rule; a rejected add raises a toast. The list persists in the browser (`localStorage`) — no login required | `CONFIRMED_FROM_CODE` | `compare-context.tsx`, `compare-storage.ts` |
| 3 | Guest/Customer | Open `/so-sanh` from the floating compare bar to view a side-by-side table of specifications, price, rating, stock and variant options | `CONFIRMED_FROM_CODE` | `CompareBar.tsx`, `ComparisonTable.tsx` |
| 4 | System | Fetch each compared product via `GET /api/v1/products/{slug}` to obtain specifications (omitted from list responses) | `CONFIRMED_FROM_CODE` | `client-api.ts` `fetchPublicProduct`, `CompareClient.tsx` |

## Account Login Workflow

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 1 | Guest | Open `/dang-nhap` or `/dang-ky` as separate legacy-parity pages; registration remains a separate route, not an in-place auth tab | `CONFIRMED_FROM_CODE` | `bigbike_vn__2026_04_17/sqldump.sql`, live legacy pages `/dang-nhap.html`, `/dang-ky.html`, `page.tsx`, `LoginForm.tsx`, `RegisterForm.tsx` |
| 2a | Guest | Sign in with email/phone + password; "Ghi nhớ" keeps the session for 30 days (vs 1 day when unchecked) | `CONFIRMED_FROM_CODE` | `CustomerAuthService.login`, `CustomerSessionService` |
| 2b | Guest | Or sign in with the legacy-visible Facebook social link; the backend OAuth service still supports Google/Facebook provider callbacks | `CONFIRMED_FROM_CODE` | `SocialLoginButtons.tsx`, `CustomerOAuthService.linkOrCreate` |
| 3 | System | Issue `bb_session` / `bb_refresh` / `bb_csrf` cookies and return the customer to the page they came from | `CONFIRMED_FROM_CODE` | `CustomerAuthController`, `CustomerOAuthController` |

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
| 0 | Customer | Pre-check eligibility via `GET /api/v1/customer/orders/{orderId}/return-eligibility` — frontend uses this to decide whether to show the return form and which items are still returnable. | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java`, `CustomerReturnService.getReturnEligibility` |
| 1 | Customer | Submit return from own order | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java`, `Phase1LReturnsApiTest.java` |
| 2 | Customer | View own returns | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java` |
| 3 | Admin | Review return list/detail | `CONFIRMED_FROM_CODE` | `AdminReturnController.java` |
| 4 | Admin | Update return status: `PENDING → APPROVED/REJECTED → RECEIVED → INSPECTING (optional) → COMPLETED/REFUNDED` | `CONFIRMED_FROM_CODE` | `AdminReturnController.java`, `AdminReturnService.java` |
| 4a | Admin | (Optional QC) After `RECEIVED → INSPECTING`, mark each ReturnItem PASS/FAIL via `PATCH /returns/{id}/items/{itemId}/inspect`. Mandatory for safety equipment (helmet, body armour). | `CONFIRMED_FROM_CODE` | `AdminReturnService.inspectItem` (V104) |
| 5 | System | Stock restore on `COMPLETED/REFUNDED`. Items with `inspection_result = 'FAIL'` are **skipped** so customer-damaged goods don't re-enter inventory. | `CONFIRMED_FROM_CODE` | `AdminReturnService.restoreStockForReturn` |
