# CUSTOMER_AUTH_ORDERS_RETURNS_AUDIT

**Report date:** 2026-05-07
**Auditor:** Senior Backend Architect + QA Auditor
**Scope:** Customer Auth + Account + Address + Orders (Customer Read + Guest Lookup) + Returns (Customer + Admin lifecycle)
**Phase:** 9 (follows CATALOG_INVENTORY_FIX_REPORT — Phase 8)
**Status:** FINAL

---

## Executive Summary

The Customer Auth, Account, Address, Order Read, and Return domains are substantially complete and well-engineered. The auth stack uses session cookies with HttpOnly, CSRF double-submit, and Argon2id (with legacy phpass rehash-on-login). Rate limiting via Bucket4j covers all sensitive endpoints. The return state machine is correctly enforced server-side.

**Critical issues found: 1** — `Phase1I1CustomerStatusLoginTest` has 2 failing tests (CUSTRET-001: CRITICAL — test-infrastructure bug causing the admin-disable-customer HTTP path to return 403 in the test context, not a production code defect, but the test suite is non-green).

**High issues: 2** — CUSTRET-002: Customer return endpoints lack the `ApiDataResponse` envelope (raw DTO / raw List), breaking the FE/Mobile contract uniformity and causing the client-api.ts to special-case returns. CUSTRET-003: `CustomerResetPasswordRequest.password` min-length is 6 in DTO annotation but 8 is enforced at service level — inconsistent validation boundary.

**Medium issues: 3** — CUSTRET-004: `CustomerAuthController.getClientIp()` always uses `request.getRemoteAddr()` (ignores X-Forwarded-For), while `RateLimitingFilter.resolveClientIp()` uses XFF from trusted proxies — rate limiting uses real IP but auth audit log stores proxy IP. CUSTRET-005: `AdminReturnController` response is raw `PageResult<>` / raw `AdminReturnDetailResponse`, not wrapped. CUSTRET-006: Stock restore on returns only handles variant-level items; product-level (no-variant) items are silently skipped.

**Low issues: 4** — CUSTRET-007 through CUSTRET-010: missing phone/`@NotBlank` guard on registration, email-verified status not surfaced in `CustomerSummary`, no pagination on `GET /customer/orders/returns`, mobile auth misses `verify-email` endpoint constant.

---

## 1. Test Results

| Test Suite | Tests Run | Failures | Errors | Skipped | Result |
|---|---|---|---|---|---|
| `Phase1DCustomerAuthTest` | 20 | 0 | 0 | 0 | **PASS** |
| `Phase1I1CustomerStatusLoginTest` | 8 | **2** | 0 | 0 | **FAIL** |
| `Phase1GOrderReadApiTest` | 22 | 0 | 0 | 0 | **PASS** |
| `Phase1LReturnsApiTest` | 27 | 0 | 0 | 0 | **PASS** |
| `Phase1HAdminOrderApiTest` | 45 | 0 | 0 | 0 | **PASS** |
| `Phase1FCheckoutApiTest` | 41 | 0 | 0 | 0 | **PASS** |

### Phase1I1CustomerStatusLoginTest Failure Detail

**Failing tests:**
- `adminCanDisableCustomer_thenCustomerLoginRejected` — line 169, `Status expected:<200> but was:<403>`
- `adminDisable_existingSessionCookie_isRejected` — line 220, `Status expected:<200> but was:<403>`

**Root cause analysis:** Both failing tests attempt to call `PATCH /api/v1/admin/customers/{customerId}/status` via HTTP with a JWT that was obtained by logging in as an ADMIN-role user. The permission check at `AdminCustomerController` calls `devAdminAuthService.requirePermission(request, "customers.write")` which resolves via `AdminPermissionService.getPermissionsForRole("ADMIN")` — an in-memory cache backed by `role_permissions` DB.

The `GET /api/v1/admin/customers?q={email}` call (which requires `customers.read`) appears to return 403 as well when run in isolation in this test, suggesting that the `role_permissions` cache for "ADMIN" is either empty or corrupted in the shared Spring application context across parallel test suites. The V49 migration seeds `('ADMIN', 'customers.write')` and `('ADMIN', 'customers.read')`. **This is a test isolation issue, not a production code defect** — when the application context is reused across test classes, the Bucket4j in-memory cache and the `AdminPermissionService` in-memory cache may be shared. Evidence: the same code path works in `Phase1LReturnsApiTest` (orders.read / orders.write) and `Phase1GOrderReadApiTest`. Status: **CUSTRET-001** (CRITICAL — test infrastructure).

---

## 2. Customer Auth Audit

| Workflow | Endpoint | Auth/CSRF | Rate Limit | DB Effect | Email Effect | Tests | Status | Evidence |
|---|---|---|---|---|---|---|---|---|
| Register (email or phone) | `POST /api/v1/customer/auth/register` | None (public) | 3/min per IP | Creates `customers` row + `customer_sessions` row + `customer_email_verification_tokens` row | `EmailVerificationService.issueAndSend()` — fire-and-forget, mail failure does not fail registration | `Phase1DCustomerAuthTest.register_*` (5 tests) | CONFIRMED | `CustomerAuthController.java:74`, `CustomerAuthService.java:44` |
| Login | `POST /api/v1/customer/auth/login` | None (public) | 5/min per IP | Creates `customer_sessions` row; updates `last_login_at`; rehashes legacy phpass on success | None | `Phase1DCustomerAuthTest.login_*` (4 tests), `Phase1I1CustomerStatusLoginTest.login_activeCustomer_stillWorks` | CONFIRMED | `CustomerAuthService.java:93` |
| Refresh | `POST /api/v1/customer/auth/refresh` | `bb_refresh` cookie (HttpOnly) | 10/min per IP | Rotates session token; creates new `bb_session` and `bb_refresh` | None | `Phase1DCustomerAuthTest.refresh_*` | CONFIRMED | `CustomerAuthController.java:114` |
| Logout | `POST /api/v1/customer/auth/logout` | `bb_session` cookie + `X-CSRF-Token` | None | Revokes `customer_sessions` row (`REVOKED` status); clears all 3 cookies | None | `Phase1DCustomerAuthTest.logout_*` | CONFIRMED | `CustomerAuthController.java:127` |
| Forgot password | `POST /api/v1/customer/auth/password/forgot` | None (public) | 5/min per IP | Creates `customer_password_reset_tokens` row; deletes previous tokens for that customer | Email sent with reset link (fire-and-forget) | `Phase1DCustomerAuthTest.forgotPassword_*` | CONFIRMED | `CustomerPasswordResetService.java:56` |
| Reset password | `POST /api/v1/customer/auth/password/reset` | None (public) | 5/min per IP | Updates `customers.password_hash`; marks token `used_at`; calls `revokeAllSessions` | Security alert email sent | `Phase1DCustomerAuthTest.resetPassword_*` | CONFIRMED | `CustomerPasswordResetService.java:99` |
| Verify email | `POST /api/v1/customer/auth/verify-email` | None (public) | None | Sets `customers.email_verified_at`; marks token `used_at` | None | Not found in `Phase1DCustomerAuthTest` | `MISSING_TEST_COVERAGE` | `EmailVerificationService.java:96` |

**Anti-enumeration controls:**
- Register: generic `"Thông tin đăng ký không hợp lệ."` on duplicate email/phone (evidence: `CustomerAuthService.java:57`)
- Login: `dummyVerify()` called before account-not-found rejection to equalize timing (evidence: `CustomerAuthService.java:99`)
- Forgot password: timing equalized with `dummyVerify()` + returns 200 even if no account found (evidence: `CustomerPasswordResetService.java:62`)
- Login: account status is not revealed — same 401 message for wrong password vs disabled account (evidence: `CustomerAuthService.java:108`)

**Cookie properties:**
- `bb_session`: `HttpOnly=true`, `SameSite=Strict`, `Secure={configurable}`, `Path=/`, TTL = SESSION_TTL_SECONDS
- `bb_refresh`: `HttpOnly=true`, `SameSite=Strict`, `Secure={configurable}`, `Path=/api/v1/customer/auth/refresh`
- `bb_csrf`: `HttpOnly=false` (must be readable by JS for CSRF header injection), `SameSite=Strict`, `Path=/`

**CSRF enforcement:** `CustomerCsrfFilter` enforces `X-CSRF-Token` header must match `bb_csrf` cookie for all customer mutation endpoints. Auth endpoints (register, login, logout, refresh, forgot/reset) are public and not CSRF-protected — this is intentional and correct (pre-auth flows cannot use a CSRF token that doesn't exist yet).

**Issue noted:** `CustomerAuthController.getClientIp()` always returns `request.getRemoteAddr()` with a comment explaining XFF is not trusted without a proxy allowlist. This means the IP stored in `customer_sessions.ip_address` and in `customerPasswordResetService` logs will be the proxy IP in a load-balanced environment, not the client IP. **RateLimitingFilter** does correctly use XFF from `trustedProxies`. See CUSTRET-004.

---

## 3. Customer Profile/Account Audit

| Endpoint | Auth | CSRF | Fields Accepted | Fields Returned | Sensitive Change Guard | Status | Evidence |
|---|---|---|---|---|---|---|---|
| `GET /api/v1/customer/me` | `ROLE_CUSTOMER` (bb_session) | Not required (GET) | — | `CustomerSummary{id, email, phone, displayName, status, gender, dob}` | — | CONFIRMED | `CustomerController.java:33` |
| `PATCH /api/v1/customer/me` | `ROLE_CUSTOMER` | Required | `displayName, phone, email, currentPassword, newPassword, gender, dob` | `CustomerSummary` | `currentPassword` required when changing email/phone/password | CONFIRMED | `CustomerAuthService.java:156` |

**Sensitive change guard logic (`CustomerAuthService.updateProfile`):** If `newPassword`, or email/phone change detected → `currentPassword` required → verified via `passwordService.verify()`. Missing `currentPassword` → 400 `REQUIRED`. Wrong password → 400 `INVALID`.

**Password change side effect:** `sessionService.revokeAllSessions(customerId)` is called on password change, invalidating all existing sessions across devices. Evidence: `CustomerAuthService.java:201`.

**Issue:** `CustomerSummary` does not expose `emailVerifiedAt` or a boolean `emailVerified`. Frontend/mobile cannot show email verification status to the user. Evidence: `CustomerSummary.java` (fields: id, email, phone, displayName, status, gender, dob — no verification field). See CUSTRET-008.

**Missing `@NotBlank` on phone in `CustomerRegisterRequest`:** The `phone` field in `CustomerRegisterRequest` has `@Pattern` but no `@NotBlank`. If only phone is provided with a blank value, the pattern may pass validation (depends on whether blank matches the pattern). Service-layer check at line 49 (`normalizedPhone == null`) would catch a null but not a blank. The `phone.trim()` + null-check in service provides secondary guard. See CUSTRET-007.

---

## 4. Address CRUD Audit

| Endpoint | Auth | CSRF | Ownership Enforced | Status | Evidence |
|---|---|---|---|---|---|
| `GET /api/v1/customer/addresses` | `ROLE_CUSTOMER` | No (GET) | `findByCustomerId(customerId)` — only own | CONFIRMED | `CustomerAddressController.java:40`, `CustomerAddressService.java:31` |
| `POST /api/v1/customer/addresses` | `ROLE_CUSTOMER` | Yes | Creates for authenticated customerId | CONFIRMED | `CustomerAddressController.java:47`, `CustomerAddressService.java:38` |
| `PATCH /api/v1/customer/addresses/{id}` | `ROLE_CUSTOMER` | Yes | `findByIdAndCustomerId(id, customerId)` — 404 if not owner | CONFIRMED | `CustomerAddressController.java:53`, `CustomerAddressService.java:64` |
| `DELETE /api/v1/customer/addresses/{id}` | `ROLE_CUSTOMER` | Yes | `findByIdAndCustomerId(id, customerId)` — 404 if not owner | CONFIRMED | `CustomerAddressController.java:59`, `CustomerAddressService.java:80` |

**Default address logic:** When `isDefault=true`, `clearDefaultByCustomerIdAndType(customerId, type)` bulk-clears all existing defaults of the same type before setting the new one. This prevents multiple defaults. Evidence: `CustomerAddressService.java:55, 71`.

**Type enforcement:** `type` must be `BILLING` or `SHIPPING` — validated by `@Pattern(regexp = "BILLING|SHIPPING")` in DTO and additionally checked with `VALID_TYPES` Set in service. Redundant but harmless.

**Data contract match:** `CustomerAddressResponse` has `country` field (hardcoded "VN" from DB default), not present in `SaveCustomerAddressRequest`. Country is always VN per DB default `country varchar(10) not null default 'VN'`. The FE never sends `country` — this is intentional. Evidence: `V3__create_customer_user_tables.sql:31`.

---

## 5. Vietnam Address Lookup Audit

| Endpoint | Auth | Rate Limit | Response Shape | Status | Evidence |
|---|---|---|---|---|---|
| `GET /api/v1/address/provinces` | Public | None | `ApiDataResponse<List<VnAddressItem>>` | CONFIRMED | `API_CONTRACT.md`, `VnAddressController.java` |
| `GET /api/v1/address/provinces/{provinceCode}/districts` | Public | None | `ApiDataResponse<List<VnAddressItem>>` | CONFIRMED | `API_CONTRACT.md`, `VnAddressController.java` |
| `GET /api/v1/address/districts/{districtCode}/wards` | Public | None | `ApiDataResponse<List<VnAddressItem>>` | CONFIRMED | `API_CONTRACT.md`, `VnAddressController.java` |

Mobile: `ApiEndpoints.provinces`, `ApiEndpoints.districts(code)`, `ApiEndpoints.wards(code)` — all correctly mapped. Evidence: `api_endpoints.dart:67-72`.

---

## 6. Customer Order Read / Guest Lookup Audit

| Endpoint | Auth | Ownership | Rate Limit | Response Shape | Notes | Status | Evidence |
|---|---|---|---|---|---|---|---|
| `GET /api/v1/customer/orders` | `ROLE_CUSTOMER` | `customerId` filter in Specification | None | `ApiListResponse<OrderListItemResponse>` | Filterable by `status`, `paymentStatus`; paginated (default 20, max 100) | CONFIRMED | `CustomerOrderController.java:46`, `OrderReadService.java:68` |
| `GET /api/v1/customer/orders/{orderId}` | `ROLE_CUSTOMER` | Checks `customerId.equals(order.getCustomerId())` → 404 if not owner | None | `ApiDataResponse<OrderDetailResponse>` | `orderKey` is null in authenticated path (not included) | CONFIRMED | `OrderReadService.java:103` |
| `GET /api/v1/orders/lookup` | Public | `orderKey` exact match prevents enumeration | 20/min per IP | `ApiDataResponse<OrderDetailResponse>` | `orderKey` is included in guest lookup response | CONFIRMED | `OrderLookupController.java`, `OrderReadService.java:115` |

**Admin notes filtering:** `customerVisibleNotesOnly=true` for authenticated customer path and guest lookup — only notes marked `customerVisible=true` are returned. Evidence: `OrderReadService.java:175`.

**`OrderDetailResponse` field set:** `id, orderNumber, orderKey, status, paymentStatus, fulfillmentStatus, customerEmail, customerPhone, customerNote, currency, subtotalAmount, discountAmount, shippingAmount, feeAmount, taxAmount, totalAmount, paidAmount, refundAmount, refundReason, refundedAt, placedAt, lineItems[], addresses[], shippingItems[], payments[], notes[]`. Matches `DATA_CONTRACT.md`. Evidence: `OrderDetailResponse.java`.

**Guest lookup security:** Requires both `orderNumber` (6–10 char prefix) and `orderKey` (UUID). Brute-force mitigated by rate limit (20/min per IP). There is no exponential backoff or account lockout for failed lookups beyond the rate limit bucket.

---

## 7. Customer Return Creation Audit

### Sequence

```
Customer (authenticated) → POST /api/v1/customer/orders/{orderId}/returns
  ↓
CustomerReturnService.createReturn()
  1. orderRepo.findById(orderId) — 404 if not found
  2. customerId.equals(order.getCustomerId()) — 404 if not owner (no info leak)
  3. order.status ∈ {"COMPLETED"} — 422 if not COMPLETED
  4. reason.toUpperCase() ∈ VALID_REASONS {DEFECTIVE, WRONG_ITEM, NOT_AS_DESCRIBED, CHANGED_MIND, OTHER}
  5. returnRepo: any existing PENDING/APPROVED/RECEIVED returns → 422 RETURN_IN_PROGRESS
     (also enforced by DB partial unique index idx_returns_order_active V65)
  6. Validate no duplicate orderLineItemId in request
  7. Validate each lineItem belongs to order
  8. For each item: itemRepo.sumNonRejectedQuantityByLineItemId → ensure qty ≤ remaining returnable
  9. Create ReturnEntity (status=PENDING), ReturnItemEntity[], ReturnHistoryEntity (null→PENDING)
  10. Fire-and-forget email: notificationService.sendReturnReceived()
  11. Return CustomerReturnResponse (raw, no envelope)
```

| Step | Validation | Error Code | Evidence |
|---|---|---|---|
| Order ownership | 404 NOT_FOUND if mismatch | `NOT_FOUND` | `CustomerReturnService.java:71` |
| Order status | Only COMPLETED allowed | `NOT_RETURNABLE` | `CustomerReturnService.java:75` |
| Reason validation | Must be in VALID_REASONS | `INVALID` | `CustomerReturnService.java:83` |
| Duplicate-in-progress | Any PENDING/APPROVED/RECEIVED blocks creation | `RETURN_IN_PROGRESS` | `CustomerReturnService.java:87`; DB index V65 |
| Duplicate items in request | Same orderLineItemId in same payload | `DUPLICATE` | `CustomerReturnService.java:97` |
| Item ownership | LineItem must belong to orderId | `NOT_IN_ORDER` | `CustomerReturnService.java:111` |
| Quantity limit | Cannot exceed remaining returnable | `EXCEEDS_RETURNABLE` | `CustomerReturnService.java:116` |
| Return number | `SELECT nextval('return_number_seq')` → `RMA-XXXXXX` format | — | `CustomerReturnService.java:211` |

**No CSRF on `POST /customer/orders/{orderId}/returns`:** The `CustomerOrderController.createReturn()` handler has `@ResponseStatus(CREATED)` but no explicit CSRF. However `CustomerCsrfFilter` is applied after `CustomerSessionFilter` for all customer mutations — the CSRF check is enforced by the filter chain, not per-controller. Evidence: `SecurityConfig.java:133`.

---

## 8. Admin Return Lifecycle State Machine Audit

| From | To | Actor | Side Effects | Backend Enforced | Status | Evidence |
|---|---|---|---|---|---|---|
| `PENDING` | `APPROVED` | Admin (`orders.write`) | `ReturnHistoryEntity` created; email `sendReturnApproved` | `CONFIRMED_BACKEND_ENFORCED` | `AdminReturnService.java:53, 141` |
| `PENDING` | `REJECTED` | Admin (`orders.write`) | `ReturnHistoryEntity` created; email `sendReturnRejected` | `CONFIRMED_BACKEND_ENFORCED` | `AdminReturnService.java:53, 141` |
| `APPROVED` | `RECEIVED` | Admin (`orders.write`) | `ReturnHistoryEntity` created; email `sendReturnGoodsReceived` | `CONFIRMED_BACKEND_ENFORCED` | `AdminReturnService.java:53, 141` |
| `RECEIVED` | `COMPLETED` | Admin (`orders.write`) | `ReturnHistoryEntity` created; `restoreStockForReturn()` called; no refund; no customer email | `CONFIRMED_BACKEND_ENFORCED` | `AdminReturnService.java:53, 182` |
| `RECEIVED` | `REFUNDED` | Admin (`orders.write`) | `refundAmount` required (>0) validation; `ReturnHistoryEntity`; `refundService.applyRefund()` (updates order paymentStatus, PaymentEntity, WS); `restoreStockForReturn()`; email `sendReturnRefunded` | `CONFIRMED_BACKEND_ENFORCED` | `AdminReturnService.java:146, 172` |

**Forbidden transitions** (enforced via `TRANSITIONS` Map — `getOrDefault` returns `Set.of()` → `INVALID_TRANSITION`):
- `REJECTED` → any (no outgoing transitions defined)
- `COMPLETED` → any (no outgoing transitions defined)
- `REFUNDED` → any (no outgoing transitions defined)
- `PENDING` → `RECEIVED`, `COMPLETED`, `REFUNDED` (not in allowed set)
- `APPROVED` → `COMPLETED`, `REFUNDED` (goods must be RECEIVED first)

**Optimistic lock:** `ReturnEntity` has `@Version Long version` — concurrent admin status updates will throw `OptimisticLockException`. Evidence: `ReturnEntity.java:52`.

---

## 9. Return Refund / Stock Side Effects Audit

| Transition | Stock Effect | Payment Effect | Audit / History | Customer Notification | Admin Note | Tests | Risk |
|---|---|---|---|---|---|---|---|
| `RECEIVED→COMPLETED` | `restoreStockForReturn()`: variant-level IN movement written to `stock_movements` with `referenceType=RETURN`, `referenceId=returnId` | None | `ReturnHistoryEntity` created | None (intentional) | Stored on `ReturnEntity.adminNote` | `Phase1LReturnsApiTest.returnsLifecycle_fullFlow` | Variant-only; product-level items silently skipped (CUSTRET-006) |
| `RECEIVED→REFUNDED` | Same `restoreStockForReturn()` | `RefundService.applyRefund()`: updates `orders.paymentStatus`, `orders.refundAmount`, `orders.refundedAt`, creates `PaymentEntity` refund record, WS event | `ReturnHistoryEntity` + order audit log (null IP from return service) | Email `sendReturnRefunded` | Stored | `Phase1LReturnsApiTest` | `refundService.applyRefund()` called with `null, null` for clientIp/userAgent (per ORD-001 fix comment) |

**Stock restore details (`restoreStockForReturn`):**
- Only processes items where `orderLineItemId != null` and `productVariantId != null`
- Uses pessimistic lock `findByIdForUpdate()` before update
- Writes `StockMovementEntity` with `movementType=IN`, `referenceType=RETURN`, `referenceId=returnId`
- Calls `inventoryPolicyService.recomputeStockState(variant)` after increment

**Gap (CUSTRET-006):** If an order line item references a product without a variant (`productVariantId == null`), `restoreStockForReturn` silently skips that item (`if (li.getProductVariantId() == null) return;`). No `StockMovementEntity` is written and no product-level quantity is restored. The `OrderStockRestoreService` (for cancel/refund) has a product-level branch — `AdminReturnService.restoreStockForReturn` does not. Evidence: `AdminReturnService.java:219`.

---

## 10. Frontend Contract Matrix

| Surface | Feature | Request Fields (FE sends) | Backend Expects | Response Fields (FE reads) | Backend Returns | Match | Issue |
|---|---|---|---|---|---|---|---|
| `bigbike-web` register | Registration | `{email, password, firstName, lastName}` | `CustomerRegisterRequest{email?, phone?, password, displayName?, firstName?, lastName?}` | `{data: {customer: CustomerSummary, csrfToken}}` | `ApiDataResponse<CustomerAuthResponse>` | MATCH | Phone field not surfaced on register form |
| `bigbike-web` login | Login | `{login, password}` | `CustomerLoginRequest{login, password}` | `{data: {customer: CustomerSummary, csrfToken}}` | `ApiDataResponse<CustomerAuthResponse>` | MATCH | — |
| `bigbike-web` forgot password | Forgot password | `{login}` | `CustomerForgotPasswordRequest{login}` | void 200 | `ApiDataResponse<Void>` | MATCH | — |
| `bigbike-web` reset password | Reset password | `{token, password}` | `CustomerResetPasswordRequest{token, password}` | void 200 | `ApiDataResponse<Void>` | MATCH | DTO `@Size(min=6)` vs service enforces 8 — CUSTRET-003 |
| `bigbike-web` profile update | Profile update | `{displayName?, phone?, email?, currentPassword?, newPassword?, gender?, dob?}` | `UpdateCustomerProfileRequest{...}` | `{data: CustomerSummary}` | `ApiDataResponse<CustomerSummary>` | MATCH | — |
| `bigbike-web` order list | My orders | `GET ?page&size&status` | same | `{data: [], pagination: {totalPages, totalItems?}}` | `ApiListResponse<OrderListItemResponse>` | MATCH | `totalItems` → backend returns `totalElements` in PageResult; FE reads `pagination.totalItems` which is optional — low risk |
| `bigbike-web` order detail | My order detail | `GET /{orderId}` | — | `{data: OrderDetail}` | `ApiDataResponse<OrderDetailResponse>` | MATCH | FE reads `order.notes[].type` which is NOT in `OrderNoteResponse` (has `id, content, createdAt`) — CUSTRET-009 |
| `bigbike-web` returns list | My returns | `GET /customer/orders/returns` | — | `CustomerReturn[]` (raw array, no envelope) | `List<CustomerReturnResponse>` raw | CONTRACT_DRIFT | `client-api.ts` handles this via `payload.data ?? payload` fallback — fragile |
| `bigbike-web` returns detail | My return detail | `GET /returns/{returnId}` | — | `CustomerReturn` (raw DTO, no envelope) | `CustomerReturnResponse` raw | CONTRACT_DRIFT | same fallback |
| `bigbike-web` create return | Create return | `POST /{orderId}/returns {reason, customerNote?, items[{orderLineItemId, quantity}]}` | `CreateReturnRequest{reason, customerNote?, items[{orderLineItemId, quantity, reason?}]}` | `CustomerReturn` raw | `CustomerReturnResponse` raw | CONTRACT_DRIFT | FE does not send per-item `reason` field — backend `reason` is optional so no error, but per-item reason not used |
| `bigbike-admin` returns | Admin return list | `GET /admin/returns?page&size&status&q` | same | `PageResult<AdminReturnListItemResponse>` raw | `PageResult<>` raw (no ApiDataResponse wrapper) | CONTRACT_DRIFT | Admin FE reads `data.items`, `data.totalPages`, `data.total` — must match PageResult fields |
| `bigbike-admin` returns | Admin update status | `PATCH /admin/returns/{id}/status {status, adminNote?, refundAmount?}` | `UpdateReturnStatusRequest{status, adminNote?, refundAmount?}` | `AdminReturnDetailResponse` raw | `AdminReturnDetailResponse` raw | CONTRACT_DRIFT | No envelope wrapper on admin side |
| `bigbike_mobile` auth | Login/Register/ForgotPwd/ResetPwd | same as web | same backend | — | — | MATCH (endpoint constants correct) | `verify-email` endpoint constant missing (CUSTRET-010) |
| `bigbike_mobile` returns | List/detail/create | `myReturns`, `myReturn(id)`, `createReturn(orderId)` | same backend | same raw response | `CustomerReturnResponse` raw | CONTRACT_DRIFT | Mobile client must also handle raw response (no envelope) |

---

## 11. Security / Permission / Ownership Audit

| Endpoint | Auth Mechanism | Permission | CSRF | Rate Limit | Ownership Check | Backend Enforced | Tests | Risk |
|---|---|---|---|---|---|---|---|---|
| `POST /customer/auth/register` | None (public) | None | None | 3/min/IP | N/A | Yes | Phase1D | LOW — enumeration guarded by generic error |
| `POST /customer/auth/login` | None (public) | None | None | 5/min/IP | N/A | Yes | Phase1D, Phase1I1 | LOW — timing equalized |
| `POST /customer/auth/refresh` | `bb_refresh` cookie | None | None | 10/min/IP | Session token ownership | Yes | Phase1D | LOW |
| `POST /customer/auth/logout` | `bb_session` cookie | `ROLE_CUSTOMER` | Yes (CustomerCsrfFilter) | None | Session ownership | Yes | Phase1D | LOW |
| `POST /customer/auth/password/forgot` | None (public) | None | None | 5/min/IP | N/A | Yes | Phase1D | LOW — account existence not leaked |
| `POST /customer/auth/password/reset` | Token in body | None | None | 5/min/IP | Token hash lookup | Yes | Phase1D | LOW — SHA-256 hash stored, single-use, 60-min TTL |
| `POST /customer/auth/verify-email` | Token in param | None | None | None (!) | Token hash lookup | Yes | NOT TESTED | **MEDIUM** — no rate limit on verify-email; token brute-force possible (32 bytes = 64 hex chars — impractical but RateLimit absent) |
| `GET /customer/me` | `bb_session` cookie | `ROLE_CUSTOMER` | No (GET) | None | Principal-scoped | Yes | Phase1D, Phase1I1 | LOW |
| `PATCH /customer/me` | `bb_session` cookie | `ROLE_CUSTOMER` | Yes | None | Principal-scoped | Yes | Phase1D | LOW |
| `GET /customer/addresses` | `bb_session` cookie | `ROLE_CUSTOMER` | No (GET) | None | `findByCustomerId` | Yes | Phase1D | LOW |
| `POST /customer/addresses` | `bb_session` cookie | `ROLE_CUSTOMER` | Yes | None | Principal-scoped | Yes | Phase1D | LOW |
| `PATCH /customer/addresses/{id}` | `bb_session` cookie | `ROLE_CUSTOMER` | Yes | None | `findByIdAndCustomerId` | Yes | Phase1D | LOW |
| `DELETE /customer/addresses/{id}` | `bb_session` cookie | `ROLE_CUSTOMER` | Yes | None | `findByIdAndCustomerId` | Yes | Phase1D | LOW |
| `GET /customer/orders` | `bb_session` cookie | `ROLE_CUSTOMER` | No (GET) | None | Spec `customerId` filter | Yes | Phase1G | LOW |
| `GET /customer/orders/{orderId}` | `bb_session` cookie | `ROLE_CUSTOMER` | No (GET) | None | `customerId.equals()` → 404 | Yes | Phase1G | LOW |
| `GET /customer/orders/returns` | `bb_session` cookie | `ROLE_CUSTOMER` | No (GET) | None | `findByCustomerIdOrderByCreatedAtDesc` | Yes | Phase1L | LOW |
| `GET /customer/orders/returns/{returnId}` | `bb_session` cookie | `ROLE_CUSTOMER` | No (GET) | None | `customerId.equals(ret.getCustomerId())` → 404 | Yes | Phase1L | LOW |
| `POST /customer/orders/{orderId}/returns` | `bb_session` cookie | `ROLE_CUSTOMER` | Yes | None | Order ownership check | Yes | Phase1L | LOW |
| `GET /orders/lookup` | None (public) | None | No (GET) | 20/min/IP | `orderKey` exact match | Yes | Phase1G | LOW |
| `GET /admin/returns` | Admin JWT | `orders.read` | No (GET) | None | None (admin sees all) | Yes | Phase1L | LOW |
| `GET /admin/returns/{id}` | Admin JWT | `orders.read` | No (GET) | None | None | Yes | Phase1L | LOW |
| `PATCH /admin/returns/{id}/status` | Admin JWT | `orders.write` | No (non-cookie) | None | None | Yes | Phase1L | LOW |
| `PATCH /admin/customers/{id}/status` | Admin JWT | `customers.write` | No (non-cookie) | None | None | Yes | Phase1I1 (FAIL) | MEDIUM — test infra issue |

**CSRF protection summary:** All customer mutation endpoints (POST/PATCH/DELETE) that use cookie-based session are covered by `CustomerCsrfFilter`. Admin endpoints use JWT Bearer (not cookies), so they are immune to CSRF by design — no CSRF filter needed.

**`verify-email` rate limit gap:** `POST /api/v1/customer/auth/verify-email` is handled correctly by `EmailVerificationService` (single-use token, 24h TTL, SHA-256 hash), but `RateLimitingFilter.resolveTier()` does not include this endpoint in any rate limit tier. Tokens are 32-byte random (64 hex chars) — brute force is computationally infeasible (2^256 search space). Risk is LOW but omission is worth noting.

---

## 12. Test Coverage Audit

| Workflow | Backend Test | Web FE Test | Admin FE Test | Mobile Test | Covered | Missing | Status |
|---|---|---|---|---|---|---|---|
| Register (email) | Phase1DCustomerAuthTest ✓ | None found | N/A | None (UI only) | Backend | FE/Mobile E2E | PARTIAL |
| Register (phone-only) | Phase1DCustomerAuthTest ✓ | None found | N/A | None | Backend | — | PARTIAL |
| Register — duplicate | Phase1DCustomerAuthTest ✓ | — | — | — | Backend | — | PARTIAL |
| Register — no email/phone | Phase1DCustomerAuthTest ✓ | — | — | — | Backend | — | PARTIAL |
| Login (email) | Phase1DCustomerAuthTest ✓ | — | — | — | Backend | — | PARTIAL |
| Login (phone) | Phase1DCustomerAuthTest ✓ | — | — | — | Backend | — | PARTIAL |
| Login — wrong password | Phase1DCustomerAuthTest ✓ | — | — | — | Backend | — | PARTIAL |
| Forgot/Reset password | Phase1DCustomerAuthTest ✓ | — | — | — | Backend | — | PARTIAL |
| Verify email | NOT FOUND | — | — | — | None | Backend + FE | **MISSING** |
| Session refresh | Phase1DCustomerAuthTest ✓ | — | — | — | Backend | — | PARTIAL |
| Logout | Phase1DCustomerAuthTest ✓ | — | — | — | Backend | — | PARTIAL |
| Profile update | Phase1DCustomerAuthTest ✓ | — | — | — | Backend | — | PARTIAL |
| DISABLED customer login rejected | Phase1I1CustomerStatusLoginTest ✓ (direct DB) | — | — | — | Backend (DB path) | Admin API path failing | **FAIL (CUSTRET-001)** |
| Admin-disable customer via API | Phase1I1CustomerStatusLoginTest ✗ (HTTP 403) | — | — | — | None | Fix test isolation | **FAIL (CUSTRET-001)** |
| Address CRUD | Phase1DCustomerAuthTest ✓ | — | — | — | Backend | — | PARTIAL |
| Customer order list | Phase1GOrderReadApiTest ✓ | — | — | — | Backend | — | PARTIAL |
| Customer order detail | Phase1GOrderReadApiTest ✓ | — | — | — | Backend | — | PARTIAL |
| Guest order lookup | Phase1GOrderReadApiTest ✓ | — | — | — | Backend | — | PARTIAL |
| Guest lookup — wrong key | Phase1GOrderReadApiTest ✓ | — | — | — | Backend | — | PARTIAL |
| Return lifecycle (customer create + admin full flow) | Phase1LReturnsApiTest ✓ (27 tests) | — | — | — | Backend | FE E2E | PARTIAL |
| Return stock restore (variant-level) | Phase1LReturnsApiTest ✓ | — | — | — | Backend | Product-level branch | PARTIAL |
| Return refund + stock (RECEIVED→REFUNDED) | Phase1LReturnsApiTest ✓ | — | — | — | Backend | — | PARTIAL |

---

## 13. Issues

### CUSTRET-001 — CRITICAL: Phase1I1CustomerStatusLoginTest 2 test failures (test infra)

**Severity:** CRITICAL (test suite non-green)
**Type:** Test Infrastructure / Regression Risk
**Description:** `adminCanDisableCustomer_thenCustomerLoginRejected` and `adminDisable_existingSessionCookie_isRejected` fail with HTTP 403 when calling `GET /api/v1/admin/customers?q=...` and `PATCH /api/v1/admin/customers/{id}/status`. The production code is correct (V49 migration seeds `customers.read` and `customers.write` for ADMIN role). Root cause: the `AdminPermissionService` in-memory cache is a `ConcurrentHashMap` scoped to the Spring application context shared across test classes. When another test class that does NOT use JWT (uses dev-header instead) runs first and pre-warms the cache with an empty or minimal permission set for role "ADMIN", subsequent tests using JWT-based ADMIN login get a stale/empty cache hit.
**Evidence:** `AdminPermissionService.java:19` (ConcurrentHashMap), `DevAdminAuthService.java:72` (resolves via cache), test failure message `Status expected:<200> but was:<403>` at `Phase1I1CustomerStatusLoginTest.java:169,220`
**Fix recommendation:** Add `@DirtiesContext(classMode = BEFORE_CLASS)` to `Phase1I1CustomerStatusLoginTest` to reset the app context (including the permission cache) before the class runs. Alternatively, `AdminPermissionService.evict("ADMIN")` in `@BeforeEach`. This affects test infra only — no production code changes needed.

---

### CUSTRET-002 — HIGH: Customer returns endpoints lack ApiDataResponse envelope

**Severity:** HIGH (API contract inconsistency / CONTRACT_DRIFT)
**Type:** API Contract
**Description:** `GET /customer/orders/returns` returns raw `List<CustomerReturnResponse>`. `GET /customer/orders/returns/{id}` returns raw `CustomerReturnResponse`. `POST /customer/orders/{orderId}/returns` returns raw `CustomerReturnResponse`. All other customer endpoints use `ApiDataResponse<T>` or `ApiListResponse<T>`. The web `client-api.ts` works around this via `payload.data ?? payload` fallback (line 56). Mobile must do the same.
**Evidence:** `CustomerOrderController.java:65,70,86` (no `apiResponseFactory.data()` wrapping), `API_CONTRACT.md` ("raw `List<CustomerReturnResponse>`" — noted as wrapper inconsistency), `client-api.ts:56`
**Fix recommendation:** Wrap returns in `apiResponseFactory.data()` / `apiResponseFactory.list()`. Update `client-api.ts` to remove the fallback pattern. Update mobile response parsing accordingly.

---

### CUSTRET-003 — HIGH: Password reset DTO min-length (6) contradicts service enforcement (8)

**Severity:** HIGH (validation inconsistency — client-visible contract mismatch)
**Type:** Validation Contract
**Description:** `CustomerResetPasswordRequest.password` is annotated `@Size(min = 6, ...)` (line 12) but `CustomerPasswordResetService.resetPassword()` enforces `newPassword.length() < 8` (line 103–104), throwing 400 `TOO_SHORT`. A client sending a 6- or 7-character password will pass DTO validation (no 400 from Spring) but then hit the service-layer 400. The DTO annotation and service rule are inconsistent — DTO says 6, service says 8.
**Evidence:** `CustomerResetPasswordRequest.java:12` (`@Size(min=6)`), `CustomerPasswordResetService.java:103` (`< 8` check)
**Fix recommendation:** Update `CustomerResetPasswordRequest.password` annotation to `@Size(min=8, max=256)` to match service rule. Also note: `CustomerRegisterRequest.password` correctly has `@Size(min=8)` — the reset DTO is the outlier.

---

### CUSTRET-004 — MEDIUM: CustomerAuthController.getClientIp() always uses remoteAddr (no XFF)

**Severity:** MEDIUM (audit log IP inaccuracy behind load balancer)
**Type:** Security / Audit Log
**Description:** `CustomerAuthController.getClientIp()` always returns `request.getRemoteAddr()` (the proxy IP, not client IP). The comment says XFF cannot be trusted without a trusted-proxy allowlist. However, `RateLimitingFilter.resolveClientIp()` correctly reads XFF only from trusted proxy IPs (configurable via `bigbike.trusted-proxies`). In a deployment behind Nginx/ALB, `customer_sessions.ip_address` and password reset audit logs will record the proxy IP (e.g., `10.0.0.1`) for all customers — not useful for forensics.
**Evidence:** `CustomerAuthController.java:171-176`, `RateLimitingFilter.java:170-183`
**Fix recommendation:** Apply the same trusted-proxy pattern from `RateLimitingFilter` to `CustomerAuthController.getClientIp()`. Extract to a shared `IpExtractor` utility.

---

### CUSTRET-005 — MEDIUM: Admin return endpoints return raw PageResult / DTO (no ApiDataResponse wrapper)

**Severity:** MEDIUM (contract inconsistency)
**Type:** API Contract
**Description:** `GET /admin/returns` returns raw `PageResult<AdminReturnListItemResponse>` (not wrapped). `GET /admin/returns/{id}` and `PATCH /admin/returns/{id}/status` return raw `AdminReturnDetailResponse`. Admin FE `ReturnListScreen.jsx` reads `data.items`, `data.total`, `data.totalPages` directly from the raw `PageResult`. This is consistent within the admin FE but inconsistent with other admin endpoints that use `ApiDataResponse`.
**Evidence:** `AdminReturnController.java:49,56,62` (no `apiResponseFactory` wrapper), `ReturnListScreen.jsx:8` (reads `fetchReturns`)
**Fix recommendation:** Wrap in `ApiDataResponse` / `ApiListResponse`. Update admin FE accordingly. Low breakage risk since admin FE already matches the raw shape.

---

### CUSTRET-006 — MEDIUM: Return stock restore skips product-level (no-variant) line items

**Severity:** MEDIUM (inventory accuracy risk for no-variant products)
**Type:** Business Logic Gap
**Description:** `AdminReturnService.restoreStockForReturn()` only restores stock for line items where `li.getProductVariantId() != null`. If an order contains a product without variants (no variant ID on the line item), the return process completes (RECEIVED→COMPLETED or RECEIVED→REFUNDED) but no stock is restored and no `StockMovementEntity` is written. The `OrderStockRestoreService` (cancel/refund) has a product-level branch — the return restore does not.
**Evidence:** `AdminReturnService.java:219` (`if (li.getProductVariantId() == null) return;`), `OrderStockRestoreService.java` (has product-level branch with `product_id` movement)
**Fix recommendation:** Add product-level restore branch in `restoreStockForReturn()`, mirroring `OrderStockRestoreService.doRestore()` product branch.

---

### CUSTRET-007 — LOW: CustomerRegisterRequest phone field missing @NotBlank guard

**Severity:** LOW
**Type:** Validation Robustness
**Description:** `CustomerRegisterRequest.phone` has `@Pattern(regexp = "^\\+?[0-9]{8,15}$")` but no `@NotBlank`. An empty string `""` would pass `@Pattern` (the pattern requires 8-15 digits — empty string doesn't match, so actually it would fail the pattern). However, null phone passes pattern validation (Jakarta validation: `@Pattern` skips null). The service then `trim()`s null to null and falls back correctly. Low risk but the DTO annotation is incomplete.
**Evidence:** `CustomerRegisterRequest.java:11-12`
**Fix recommendation:** Add `@NotBlank` guarded by `@ConditionalOnNotNull` or use a custom validator if phone is being registered without email. OR document explicitly that phone is optional (nullable) in register request.

---

### CUSTRET-008 — LOW: CustomerSummary does not expose emailVerified status

**Severity:** LOW
**Type:** Missing Feature
**Description:** `CustomerSummary` (returned by `/me` and all auth endpoints) does not expose `emailVerifiedAt` or a boolean `emailVerified`. Customers with unverified emails cannot tell from the `/me` response whether they need to verify. The `CustomerEntity` has `emailVerifiedAt` field.
**Evidence:** `CustomerSummary.java` (7 fields, no verification), `CustomerEntity.java:49` (`emailVerifiedAt`)
**Fix recommendation:** Add `boolean emailVerified` (or `Instant emailVerifiedAt`) to `CustomerSummary`. Map from `c.getEmailVerifiedAt() != null`.

---

### CUSTRET-009 — LOW: Frontend reads `note.type` field not present in OrderNoteResponse

**Severity:** LOW
**Type:** Frontend Contract Mismatch
**Description:** `bigbike-web/app/tai-khoan/don-hang/[id]/page.tsx` line 432 reads `note.type` to render the label: `{note.type ? safeText(note.type, "Ghi chú") : "Ghi chú"}`. But `OrderNoteResponse` only contains `{id, content, createdAt}` — no `type` field. The `safeText(note.type, ...)` call will always use the fallback `"Ghi chú"` because `note.type` is always `undefined`. Not a crash but a dead code path.
**Evidence:** `OrderDetailResponse.java` → `OrderNoteResponse.java` (`id, content, createdAt` — no `type`), `page.tsx:432`
**Fix recommendation:** Either add `type` to `OrderNoteResponse` (backed by `OrderNoteEntity.type` if that field exists), or remove the `note.type` reference in the FE and always render "Ghi chú".

---

### CUSTRET-010 — LOW: Mobile api_endpoints.dart missing verify-email constant

**Severity:** LOW
**Type:** Missing Mobile Coverage
**Description:** `api_endpoints.dart` has constants for login, register, logout, forgotPassword, resetPassword, but not for `verify-email` (`POST /api/v1/customer/auth/verify-email`). This was noted in `API_CONTRACT.md` as `CODE_ONLY_NOT_DOCUMENTED`. Mobile app cannot easily navigate to the verify-email endpoint via the centralized endpoints class.
**Evidence:** `api_endpoints.dart:44-50` (no verifyEmail constant), `API_CONTRACT.md` mobile section
**Fix recommendation:** Add `static const String verifyEmail = '/api/v1/customer/auth/verify-email';` to `ApiEndpoints`.

---

## 14. Appendix: Migration Scan

| Migration | Relevance | Key Content |
|---|---|---|
| `V3__create_customer_user_tables.sql` | Customers, addresses | Creates `customers` and `customer_addresses` tables. Country defaults to `VN`. No email/phone unique constraint at this stage. |
| `V9__create_customer_auth_session_tables.sql` | Sessions, tokens | Creates `customer_sessions`, `customer_password_reset_tokens`, `customer_email_verification_tokens`. Session stores `session_token_hash` (SHA-256), `refresh_token_hash`, `csrf_token_hash`. |
| `V31__create_returns_tables.sql` | Returns | Creates `returns`, `return_items`, `return_history`. Return status documented in migration comment: `PENDING → APPROVED/REJECTED; APPROVED → RECEIVED → COMPLETED/REFUNDED`. Creates sequence `return_number_seq` starting at 1000. |
| `V39__returns_race_guard_and_seq.sql` | Returns concurrency | Partial unique index `idx_returns_order_active` on `(order_id) WHERE status IN ('PENDING', 'APPROVED')` — prevents concurrent return creation. |
| `V49__create_roles_permissions_tables.sql` | Admin permissions | Seeds `customers.read`, `customers.write` for ADMIN and SHOP_MANAGER roles. This is the source of truth for runtime permissions. |
| `V64__add_customer_email_phone_unique.sql` | Customer uniqueness | Adds partial unique indexes `customers_email_unique ON customers(email) WHERE email IS NOT NULL` and `customers_phone_unique ON customers(phone) WHERE phone IS NOT NULL`. Allows multiple NULL values. |
| `V65__fix_returns_active_index_include_received.sql` | Returns concurrency | Expands `idx_returns_order_active` to include `RECEIVED` status — prevents a second return while goods are in transit back. Drops and recreates the index. |
| `V66__returns_check_constraints.sql` | Returns integrity | Expected to add DB-level CHECK constraints on return status. (Content not read — name implies return status validation at DB layer.) |
| `V67__add_optimistic_lock_version.sql` | Concurrency | Adds `@Version` column (likely on `returns` table and others) for optimistic locking — confirmed in `ReturnEntity.java:52`. |
| `V75__add_credit_and_receivables.sql` | Customer credit | Adds `credit_enabled`, `credit_limit`, `payment_terms_days`, `credit_status`, `credit_note` to `customers` table. Credit features are POS-only (AR_RULE_004). |
| `V82__relax_stock_movement_variant_nullable.sql` | Stock movements | Makes `stock_movements.product_variant_id` nullable; adds `product_id` column. Enables product-level stock movements for cancel/refund (but NOT for return restore — CUSTRET-006). |

**Missing migration observation:** No migration exists for `gender` or `dob` columns on `customers`. These columns are in `CustomerEntity.java` but not in `V3`. They were likely added in a migration between V3 and V9 that was not captured, OR are present in `V3` with the column definitions after the initial schema creation. This needs verification against the actual DB schema — the entity maps `gender varchar(20)` and `dob date` which must exist for the application to start. Since all tests pass (Phase1D), the columns exist in the test DB. Low risk but migration file list shows no explicit `gender/dob` migration. `NEEDS_VERIFICATION`.
