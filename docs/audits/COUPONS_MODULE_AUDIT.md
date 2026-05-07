HISTORICAL_REPORT_ONLY - Not canonical. Validate against current code and canonical docs.

# Coupons Module Audit

> Audit ngày 2026-05-06 — Senior Fullstack/QA review
> Scope: backend coupon admin + cart/coupon flow + checkout + DB + admin/web FE + WP importer + test
> Phương pháp: đọc source code thật (không phỏng đoán), trích evidence file:line. Không sửa code.
> Test runtime đã được chạy lại trong session update 2026-05-06: targeted coupon/cart/checkout suites PASS và full `.\mvnw.cmd test` PASS (849 tests, 0 failures, 0 errors, 3 skipped).

---

## 1. Executive Summary

**Verdict: READY** _(updated 2026-05-06 after P0/P1 hardening verification)_

Tất cả P0 và P1 chính trong scope coupon checkout/cart/admin permission đã được fix và verified bằng integration tests: `Phase1FCheckoutApiTest` **41/41 PASS**, `Phase1JAdminSettingsMenuCouponApiTest` **63/63 PASS**, `Phase1ECartApiTest` **27/27 PASS**; full backend suite `.\mvnw.cmd test` cũng PASS (**849 tests, 0 failures, 0 errors, 3 skipped**). Phần còn lại là LOW/P2 backlog, không còn block release; xem §11.

**Lịch sử audit ban đầu**: NOT_READY for production (~55% complete) với 3 P0 blockers:

- **P0-COUPON-01** ~~Checkout **KHÔNG** revalidate coupon~~ → **RESOLVED** (CheckoutService lines 186-203)
- **P0-COUPON-02** ~~`usageLimit` không atomic~~ → **RESOLVED** (`attemptRedeem` conditional UPDATE với status/date/limit guards)
- **P0-COUPON-03** ~~Update `discountType` partial không re-validate `amount`~~ → **RESOLVED** (AdminCouponService lines 164-168)
- **P1-COUPON-04** ~~"One coupon per cart" enforce ở service, không có constraint DB~~ → **RESOLVED** ([V73 migration](bigbike-backend/src/main/resources/db/migration/V73__enforce_one_coupon_per_cart.sql) + `DataIntegrityViolationException` → 409 trong CartService)
- **P1-COUPON-05** — Test coverage cho cart coupon / checkout coupon / permission mismatch. ~~gần như **0**~~ → **RESOLVED for release blockers** (`Phase1FCheckoutApiTest` hiện cover 7 coupon checkout cases; `Phase1JAdminSettingsMenuCouponApiTest` cover 7 coupon hardening cases; `Phase1ECartApiTest` cover refresh/minimumAmount invalidation). Concurrent stress test, scheduler test, và OpenAPI/doc sync follow-up chuyển xuống **LOW/tooling**, không block release.
- **P1-COUPON-06** ~~Permission inconsistency: SHOP_MANAGER bị SecurityConfig chặn ở URL guard~~ → **RESOLVED** ([SecurityConfig.java:105](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java#L105) dùng `hasAnyRole("ADMIN","SUPER_ADMIN","SHOP_MANAGER")` cho `/api/v1/admin/coupons/**`. Test `shopManager_canListCoupons` PASS.)
- **P2-COUPON-07** — Admin order detail trả `appliedCoupons` từ BE nhưng UI admin **không hiển thị** mã coupon đã dùng.
- **P2-COUPON-08** — Customer order detail (BE + web FE) **không hiển thị** code coupon đã dùng.
- **P2-COUPON-09** — `merge guest → customer cart` chỉ merge items, **không merge cart_coupons** → coupon do guest apply biến mất sau login.
- **P2-COUPON-10** — Admin Coupon UI thiếu các field BE đã hỗ trợ: `description`, `startsAt`, `maximumAmount`, `metadata`, status `ARCHIVED`, edit `code`/`name`.
- **P2-COUPON-11** — Schema entity vs migration mismatch: entity bắt `name NOT NULL` ([CouponEntity.java:27](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/coupon/CouponEntity.java#L27)) nhưng migration V5 định nghĩa `name varchar(255)` nullable.
- **P2-COUPON-12** — `discount_type` và `status` không có CHECK constraint ở DB; mọi giá trị string đều insert được nếu bypass service.
- **P3-COUPON-13** — WP importer không validate runtime rules → có thể import coupon `amount=0`, PERCENT > 100, etc.

**READY criteria**: đã đạt; xem §11 cho final verdict và backlog còn lại.

---

## 2. Route & API Matrix

| Method | Route | Controller | Service | Permission | Status |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/coupons` | [AdminCouponController.listCoupons](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminCouponController.java#L52-L66) | [AdminCouponService.listCoupons](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCouponService.java#L53-L78) | `coupons.read` + coupon URL matcher in `SecurityConfig` | COMPLETE |
| GET | `/api/v1/admin/coupons/{id}` | [AdminCouponController.getCouponById](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminCouponController.java#L68-L75) | [AdminCouponService.getCouponById](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCouponService.java#L82-L86) | `coupons.read` + coupon URL matcher in `SecurityConfig` | COMPLETE |
| POST | `/api/v1/admin/coupons` | [AdminCouponController.createCoupon](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminCouponController.java#L77-L84) | [AdminCouponService.createCoupon](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCouponService.java#L90-L135) | `coupons.write` + coupon URL matcher in `SecurityConfig` | PARTIAL |
| PATCH | `/api/v1/admin/coupons/{id}` | [AdminCouponController.updateCoupon](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminCouponController.java#L86-L95) | [AdminCouponService.updateCoupon](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCouponService.java#L139-L217) | `coupons.write` + coupon URL matcher in `SecurityConfig` | COMPLETE |
| PATCH | `/api/v1/admin/coupons/{id}/status` | [AdminCouponController.updateCouponStatus](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminCouponController.java#L97-L106) | [AdminCouponService.updateCouponStatus](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCouponService.java#L221-L240) | `coupons.write` + coupon URL matcher in `SecurityConfig` | COMPLETE |
| POST | `/api/v1/cart/coupons` | [CartController.applyCoupon](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/cart/CartController.java#L110-L121) | [CartService.applyCoupon](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L238-L288) | guest+customer (permitAll) | PARTIAL |
| DELETE | `/api/v1/cart/coupons/{code}` | [CartController.removeCoupon](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/cart/CartController.java#L123-L134) | [CartService.removeCoupon](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L290-L297) | guest+customer (permitAll) | COMPLETE |
| POST | `/api/v1/checkout` (cart→order, áp dụng coupon) | [CheckoutController](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/checkout) | [CheckoutService.checkoutFromCart](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java#L152-L267) | guest+customer (permitAll) | COMPLETE (fresh revalidation + atomic redeem) |
| Scheduler | cron `0 0 * * * *` | [CouponExpiryScheduler.expireOverdueCoupons](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/coupon/CouponExpiryScheduler.java#L18-L27) | repo [`expireOverdue`](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/coupon/CouponJpaRepository.java#L26-L29) | n/a (`@EnableScheduling` ở [BigbikeBackendApplication](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/BigbikeBackendApplication.java)) | COMPLETE |

Không tìm thấy: dedicated public coupon detail endpoint (xem code → giá ở cart) → **NOT_FOUND** intentional, OK vì cart flow đã trả discount.

---

## 3. Screen & UI Matrix

### Admin Frontend ([bigbike-admin](bigbike-admin/))

| Route | Component | Permission guard | Mutation guard | Status |
|---|---|---|---|---|
| `/admin/coupons` | [CouponListScreen](bigbike-admin/src/screens/CouponListScreen.jsx) | [App.jsx:64](bigbike-admin/src/App.jsx#L64) — `coupons.read` | `canUpdate=hasPermission('coupons.write')` ([App.jsx:362-363](bigbike-admin/src/App.jsx#L362-L363)) | PARTIAL |

**Gaps trong UI Admin** (so với BE DTO `AdminCouponDetailResponse`):

| BE field | UI Admin có expose? | Evidence |
|---|---|---|
| `code` | tạo có / sửa **không** | [CouponListScreen.jsx:117-124](bigbike-admin/src/screens/CouponListScreen.jsx#L117-L124) (edit không gửi `code`) |
| `name` | tạo có / sửa **không** | edit form không hiển thị name |
| `description` | KHÔNG | UI không có field |
| `discountType` | có | line 195-200, 218-223 |
| `amount` | có | line 201, 224 |
| `minimumAmount` | có | line 202, 225 |
| `maximumAmount` | KHÔNG | UI không có field |
| `usageLimit` | có | line 203, 226 |
| `startsAt` | KHÔNG | UI không có field, BE có |
| `expiresAt` | có (chỉ date, end-of-day +07:00) | [line 26-30](bigbike-admin/src/screens/CouponListScreen.jsx#L26-L30) |
| `metadata` | KHÔNG | UI không có field |
| `status: ARCHIVED` | filter dropdown thiếu (chỉ ALL/ACTIVE/INACTIVE/EXPIRED) | [line 247-250](bigbike-admin/src/screens/CouponListScreen.jsx#L247-L250) |
| toggle status | chỉ ACTIVE↔INACTIVE | [line 62-71](bigbike-admin/src/screens/CouponListScreen.jsx#L62-L71) |

UI states present: loading / empty / error / submitting → COMPLETE.
i18n labels: COMPLETE (sử dụng `t('coupons.*')`).

### Web Frontend ([bigbike-web](bigbike-web/))

| Route | File | Status |
|---|---|---|
| `/gio-hang` (Cart) — apply / remove coupon UI | [app/gio-hang/page.tsx](bigbike-web/app/gio-hang/page.tsx#L100-L128), [page.tsx:301-340](bigbike-web/app/gio-hang/page.tsx#L301-L340) | COMPLETE (form, list, error) |
| `/thanh-toan` (Checkout) — hiển thị coupon code áp dụng | [app/thanh-toan/page.tsx:546-551](bigbike-web/app/thanh-toan/page.tsx#L546-L551) | PARTIAL (chỉ list code, không cho remove) |
| Customer order detail (`/tai-khoan/don-hang/{id}`) — hiển thị coupon đã dùng | NOT_FOUND — backend `OrderDetailResponse` không return `appliedCoupons` ([OrderDetailResponse.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/order/dto/OrderDetailResponse.java)) | MISSING |
| Admin order detail | [bigbike-admin/src/screens/OrderDetailScreen.jsx](bigbike-admin/src/screens/OrderDetailScreen.jsx#L313-L319) — chỉ in `order.discount`, không show appliedCoupons | MISSING |

API client web: [bigbike-web/lib/api/client-api.ts:81-87](bigbike-web/lib/api/client-api.ts#L81-L87) — `applyCoupon`, `removeCoupon`. COMPLETE.

---

## 4. Data Contract Matrix

| BE (`AdminCouponDetailResponse`) | DB column (V5) | Admin FE (`normalizeCoupon`) | Web FE | Notes |
|---|---|---|---|---|
| `id: UUID` | `coupons.id uuid pk` | `id: string` | n/a | OK |
| `legacyId: Long` | `legacy_id bigint unique` | NOT_FOUND in normalizeCoupon | n/a | UI ignores legacyId; OK |
| `code: String` | `code varchar(100) not null unique` | `code: string` | (chỉ list từ `cart.couponCodes`) | OK |
| `name: String` | `name varchar(255)` (nullable in V5) — entity says `nullable=false` | `name: string` | n/a | **MISMATCH** entity vs migration |
| `description: String` | `description text` | NOT_FOUND in admin form | n/a | Field unused on FE |
| `discountType: String` | `discount_type varchar(50) not null` (no CHECK) | normalizes `FIXED_AMOUNT→FIXED` ([contracts.js:572](bigbike-admin/src/lib/contracts.js#L572)) | n/a | OK on FE; DB allows arbitrary string |
| `amount: BigDecimal` | `amount numeric(19,2)` | renamed `discountValue` ([contracts.js:579](bigbike-admin/src/lib/contracts.js#L579)) | n/a | renamed; OK |
| `minimumAmount` | `minimum_amount numeric(19,2)` | renamed `minimumOrderAmount` ([contracts.js:581](bigbike-admin/src/lib/contracts.js#L581)) | n/a | renamed; OK |
| `maximumAmount` | `maximum_amount numeric(19,2)` | exposed as `maximumAmount` but **không** dùng trong form | n/a | Hidden on FE |
| `usageLimit` | `usage_limit integer` | renamed `maxUsage` ([contracts.js:584](bigbike-admin/src/lib/contracts.js#L584)) | n/a | renamed; OK |
| `usageCount` | `usage_count integer not null default 0` | `usageCount: number` | n/a | OK |
| `startsAt` | `starts_at timestamp tz` | NOT_FOUND in admin form | n/a | Hidden |
| `expiresAt` | `expires_at timestamp tz` | `expiresAt: string` | n/a | OK |
| `status` | `status varchar(50) not null` (no CHECK) | normalizes against `COUPON_STATUS_VALUES=['ACTIVE','INACTIVE','EXPIRED','ARCHIVED']` | n/a | OK on FE; DB unconstrained |
| `metadata` | `metadata text` | NOT_FOUND | n/a | Hidden |
| `createdAt`, `updatedAt` | `created_at`, `updated_at` not null | exposed | n/a | OK |

**Cart coupon contract**:
- BE [`CartResponse.couponCodes: List<String>`](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/cart/CartController.java#L188-L203) — only the codes, **không** trả discount per coupon, type, expiresAt.
- Web FE `Cart.couponCodes?: string[]` ([commerce.ts:32](bigbike-web/lib/contracts/commerce.ts#L32)) — đồng bộ.
- Cart total discount tổng cộng nằm ở `totals.discountAmount`. UI không hiển thị mỗi coupon discount riêng. PARTIAL (đủ cho 1 coupon/cart hiện tại nhưng nếu sau này hỗ trợ nhiều coupon sẽ thiếu).

**Order applied coupons contract**:
- BE Admin [`OrderAppliedCouponResponse`](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/order/OrderAppliedCouponResponse.java) returns `id, couponId, code, discountAmount`. Service map ở [AdminOrderService.java:469-470, 503](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java#L469-L503).
- Admin FE: NOT used. **MISSING UI** to display.
- Customer-side `OrderDetailResponse` (file [OrderDetailResponse.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/order/dto/OrderDetailResponse.java)) **không có** field appliedCoupons.

---

## 5. Permission Matrix

### Backend

| Endpoint | URL guard | Permission check | Note |
|---|---|---|---|
| `/api/v1/admin/coupons*` | `hasAnyRole("ADMIN","SUPER_ADMIN","SHOP_MANAGER")` ([SecurityConfig.java:105](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java#L105)) | `coupons.read` / `coupons.write` ([AdminCouponController.java:63,73,82,92,103](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminCouponController.java#L63)) | ✅ URL guard khớp với role grant |
| `/api/v1/cart/coupons*` | `permitAll` ([SecurityConfig.java:79-80](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java#L79-L80)) | none | cart guest/customer flow OK |

### Role grant alignment (P1-06 resolved)

| Role | `coupons.read/write` in [AdminRolePermissions.MAP](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminRolePermissions.java#L15-L64) | `coupons.read/write` in DB seed [V49](bigbike-backend/src/main/resources/db/migration/V49__create_roles_permissions_tables.sql) | URL guard `/api/v1/admin/**` |
|---|---|---|---|
| SUPER_ADMIN | `*` (line 16) | (not seeded with explicit grants per file) | ALLOWED via `hasAnyRole("ADMIN","SUPER_ADMIN","SHOP_MANAGER")` |
| ADMIN | YES (line 27) | YES | ALLOWED |
| SHOP_MANAGER | YES (line 41) | YES (V49 line 110-111) | ALLOWED via coupon-specific matcher |
| EDITOR / AUTHOR / etc | NO | NO | BLOCKED OK |

→ ✅ `SecurityConfig` đã align với `docs/engineering/PERMISSION_MATRIX.md`: `/api/v1/admin/coupons/**` dùng `hasAnyRole("ADMIN","SUPER_ADMIN","SHOP_MANAGER")` ([SecurityConfig.java:105](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java#L105)). Test `shopManager_canListCoupons` PASS.
→ SUPER_ADMIN dùng matcher trực tiếp; không còn vướng mắc role-kép.

### Frontend (admin)

- Route guard: [App.jsx:64](bigbike-admin/src/App.jsx#L64) (`permission: 'coupons.read'`) — Sidebar nav hide nếu không có quyền.
- Mutation hide/disable: [App.jsx:362-363](bigbike-admin/src/App.jsx#L362-L363) — `canUpdate=hasPermission('coupons.write')`. CouponListScreen hide nút Create/Edit/Toggle khi `canUpdate=false` ([line 145-156, 174-178](bigbike-admin/src/screens/CouponListScreen.jsx#L145-L178)).
- COMPLETE for UI guard.

---

## 6. Validation Matrix

| Rule | Implementation evidence | Test evidence | Status | Notes |
|---|---|---|---|---|
| `code` required | `@NotBlank` [CreateCouponRequest.java:8](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/coupon/CreateCouponRequest.java#L8) | NOT_FOUND_TEST | PARTIAL | Validation OK, no negative test |
| `code` trim+UPPERCASE | [AdminCouponService.java:92,147](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCouponService.java#L92) | NOT_FOUND_TEST | PARTIAL | OK |
| `code` unique | `findByCode` then 409 [AdminCouponService.java:95-97](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCouponService.java#L95-L97) + DB `unique` [V5](bigbike-backend/src/main/resources/db/migration/V5__create_commerce_settings_tables.sql) | duplicateCode test [Phase1JAdminSettingsMenuCouponApiTest.java:413-424](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1JAdminSettingsMenuCouponApiTest.java#L413-L424) | COMPLETE | |
| `name` required | `@NotBlank` [CreateCouponRequest.java:9](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/coupon/CreateCouponRequest.java#L9) | NOT_FOUND_TEST | PARTIAL | |
| `discountType` ∈ {FIXED, PERCENT, FIXED_AMOUNT-legacy} | [AdminCouponService.java:99-102, 159-162](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCouponService.java#L99-L102) | invalidDiscountType test [Phase1J.java:385](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1JAdminSettingsMenuCouponApiTest.java#L385) | COMPLETE | DB không có CHECK |
| `amount > 0` | [AdminCouponService.java:271-274](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCouponService.java#L271-L274) | NOT_FOUND_TEST | PARTIAL | |
| `PERCENT amount ≤ 100` | [AdminCouponService.java:275-278](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCouponService.java#L275-L278) | percentOver100 test [Phase1J.java:399](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1JAdminSettingsMenuCouponApiTest.java#L399) | COMPLETE | |
| `minimumAmount ≥ 0` | [AdminCouponService.java:282-284](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCouponService.java#L282-L284) | NOT_FOUND_TEST | PARTIAL | |
| `maximumAmount > 0` | [AdminCouponService.java:285-288](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCouponService.java#L285-L288) | NOT_FOUND_TEST | PARTIAL | |
| `maximumAmount ≥ amount` (FIXED) | [AdminCouponService.java:289-293](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCouponService.java#L289-L293) | NOT_FOUND_TEST | PARTIAL | |
| `usageLimit ≥ 0` | [AdminCouponService.java:297-301](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCouponService.java#L297-L301) | NOT_FOUND_TEST | PARTIAL | |
| `startsAt < expiresAt` | [AdminCouponService.java:303-307](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCouponService.java#L303-L307) | NOT_FOUND_TEST | PARTIAL | |
| `status` ∈ {ACTIVE,INACTIVE,EXPIRED,ARCHIVED} | [AdminCouponService.java:122-127, 201-208, 226-230](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCouponService.java#L122-L208) | invalidStatus tests [Phase1J.java:496-520](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1JAdminSettingsMenuCouponApiTest.java#L496-L520) | COMPLETE | DB không có CHECK |
| **Update partial revalidate full state** | [AdminCouponService.java:164-168](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCouponService.java#L164-L168) gọi `validateAmount(entity.getAmount(), type)` khi đổi `discountType` mà không gửi `amount` mới | `updateCoupon_fixedToPercent_withHighAmount_returns400` [Phase1JAdminSettingsMenuCouponApiTest.java:859-867](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1JAdminSettingsMenuCouponApiTest.java#L859-L867) | COMPLETE | P0-03 resolved |
| Apply: empty code | `@NotBlank` [ApplyCouponRequest.java:6](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/cart/dto/ApplyCouponRequest.java#L6) | NOT_FOUND_TEST | PARTIAL | |
| Apply: not found | [CartService.java:249-250](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L249-L250) | `applyCoupon_nonexistentCode_returns404` [Phase1JAdminSettingsMenuCouponApiTest.java:887-900](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1JAdminSettingsMenuCouponApiTest.java#L887-L900) | COMPLETE | |
| Apply: inactive/archived/expired | [CartService.java:253-261](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L253-L261) (status != ACTIVE → từ chối, đè cả ARCHIVED) | `applyCoupon_inactiveCoupon_returns409` [Phase1JAdminSettingsMenuCouponApiTest.java:902-918](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1JAdminSettingsMenuCouponApiTest.java#L902-L918), `applyCoupon_expiredCoupon_returns409` [Phase1JAdminSettingsMenuCouponApiTest.java:920-936](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1JAdminSettingsMenuCouponApiTest.java#L920-L936) | COMPLETE | |
| Apply: not started (`startsAt > now`) | [CartService.java:256-258](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L256-L258) | NOT_FOUND_TEST | PARTIAL | |
| Apply: over usage limit | [CartService.java:262-264](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L262-L264) | NOT_FOUND_TEST | PARTIAL | Dedicated apply-path test vẫn còn thiếu dù checkout atomic guard đã fix |
| Apply: subtotal < minAmount | [CartService.java:267-275](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L267-L275) | NOT_FOUND_TEST | PARTIAL | |
| Apply: discount > subtotal → cap | [CartService.java:382](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L382) | NOT_FOUND_TEST | PARTIAL | |
| Cart recalculate khi item change → re-validate coupon | [CartService.refreshCartTotals](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L323-L365) auto-remove coupon nếu inactive/expired/over-limit/**subtotal < minimumAmount** và recompute discount | `updateItemQty_reducesSubtotalBelowMinAmount_couponRemoved` [Phase1ECartApiTest.java:511-549](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1ECartApiTest.java#L511-L549), `couponBecomesInactive_afterApply_cartRefreshRemovesCoupon` [Phase1ECartApiTest.java:551-590](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1ECartApiTest.java#L551-L590) | COMPLETE | minAmount re-check resolved |
| **Checkout revalidate** (status, expiresAt, usageLimit, minAmount) | [CheckoutService.java:186-203](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java#L186-L203) reload fresh coupon, `couponPolicy.validate(...)`, recompute discount trước khi snapshot/redeem | `checkout_withDisabledCoupon_returns409`, `checkout_withExpiredCoupon_returns409`, `checkout_couponUsageLimitExhausted_secondCheckoutFails` trong [Phase1FCheckoutApiTest.java](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1FCheckoutApiTest.java) | COMPLETE | P0-01 resolved |

---

## 7. DB Behavior

### Schema `coupons` ([V5](bigbike-backend/src/main/resources/db/migration/V5__create_commerce_settings_tables.sql))

```sql
create table coupons (
    id uuid primary key,
    legacy_id bigint unique,
    code varchar(100) not null unique,
    name varchar(255),                      -- ⚠ entity NOT NULL, migration NULL
    description text,
    discount_type varchar(50) not null,      -- ⚠ no CHECK
    amount numeric(19,2) not null default 0, -- ⚠ default 0 contradicts service "amount > 0"
    minimum_amount numeric(19,2),
    maximum_amount numeric(19,2),
    usage_limit integer,
    usage_count integer not null default 0,
    starts_at timestamp with time zone,
    expires_at timestamp with time zone,
    status varchar(50) not null,             -- ⚠ no CHECK
    metadata text,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);
create index idx_coupons_code on coupons (code);
create index idx_coupons_status on coupons (status);
create index idx_coupons_legacy_id on coupons (legacy_id);
create index idx_coupons_expires_at on coupons (expires_at);
```

Findings:
- ⚠ **Nullable mismatch** `name` (P2-11).
- ⚠ Không CHECK constraint `status`/`discount_type`/`amount > 0`/`usage_count <= usage_limit` (P2-12).
- Index trên `code`, `status`, `expires_at`, `legacy_id` đầy đủ cho query thông thường.
- ✅ Pessimistic write lock có dùng ([CouponJpaRepository.findByCodeForUpdate](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/coupon/CouponJpaRepository.java#L22-L24)) — chỉ ở `applyCoupon` thôi, **không ở checkout**.

### Schema `cart_coupons` ([V20](bigbike-backend/src/main/resources/db/migration/V20__add_coupon_cart_gender_shipping_threshold.sql))

```sql
create table cart_coupons (
    id uuid primary key,
    cart_id uuid not null references carts(id) on delete cascade,
    coupon_code varchar(100) not null,
    discount_type varchar(50) not null,
    discount_amount decimal(19,2) not null default 0,
    created_at timestamp with time zone not null,
    unique (cart_id, coupon_code)
);
create index idx_cart_coupons_cart_id on cart_coupons (cart_id);
```

Findings:
- ✅ Cascade delete khi xóa cart.
- ✅ Unique `(cart_id, coupon_code)` chống duplicate same code.
- ✅ **`UNIQUE(cart_id)`** được thêm bởi [V73](bigbike-backend/src/main/resources/db/migration/V73__enforce_one_coupon_per_cart.sql) — enforce 1-coupon/cart ở DB level; `DataIntegrityViolationException` xử lý trong CartService thành 409.
- ❌ Không có FK từ `coupon_code` sang `coupons.code` → cart_coupon có thể tham chiếu code không tồn tại (service xử lý lazy ở refresh).

### Schema `order_applied_coupons` ([V7](bigbike-backend/src/main/resources/db/migration/V7__create_order_tables.sql))

```sql
create table order_applied_coupons (
    id uuid primary key,
    order_id uuid not null references orders(id) on delete cascade,
    coupon_id uuid references coupons(id),  -- nullable FK
    code varchar(100) not null,
    discount_amount numeric(19,2) not null default 0,
    metadata text,
    created_at timestamp with time zone not null
);
```

Findings:
- ✅ FK to `orders` (cascade) và `coupons` (nullable, không cascade — đúng).
- ❌ Không có `unique(order_id, code)` — order có thể chứa duplicate.
- ✅ Index trên `order_id`, `coupon_id`, `code`.

### Concurrency

- **Apply** dùng `findByCodeForUpdate` ([CouponJpaRepository.java:22-24](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/coupon/CouponJpaRepository.java#L22-L24)) + DB `UNIQUE(cart_id)` qua [V73](bigbike-backend/src/main/resources/db/migration/V73__enforce_one_coupon_per_cart.sql) → race apply coupon khác code cùng cart không còn phụ thuộc chỉ service check.
- **Checkout** dùng `attemptRedeem` atomic conditional UPDATE ([CouponJpaRepository.java:31-38](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/coupon/CouponJpaRepository.java#L31-L38)); [CheckoutService.java:252-269](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java#L252-L269) ném `ConflictException` khi `redeemed == 0`.
- Concurrent stress test ở mức thread scheduling vẫn nên bổ sung sau, nhưng không còn là P0/P1 release blocker.

---

## 8. Cart / Checkout / Order Flow

```
[Cart applyCoupon] -> validate current cart subtotal/status/date/usage, save coupon row
        -> DB UNIQUE(cart_id) + CartService catch DataIntegrityViolationException => 409
        ->
[Cart updateItem/removeItem/addItem] -> refreshCartTotals
        -> re-validate status/startsAt/expiresAt/usageLimit/minimumAmount
        -> auto-remove invalid coupon and recompute totals
        ->
[Checkout]
  1. reserveIdempotency (request hash)
  2. syncPricesAndValidateStock
  3. recalculate cart subtotal
  4. reload fresh coupon entities from DB
  5. couponPolicy.validate(freshCoupon, subtotal) + recompute discount
  6. save OrderAppliedCoupon snapshot
  7. couponRepo.attemptRedeem(id, now) -> 0 rows => 409 conflict
  8. set cart.status = CONVERTED
  9. attachOrderToReservation
```

Evidence: [CheckoutService.java:152-267](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java#L152-L267).

**Special-case checks** (theo yêu cầu §3 đề bài):

| # | Case | Hiện trạng | Verdict |
|---|---|---|---|
| 1 | Apply rồi admin disable rồi user checkout | Checkout reload fresh coupon entities và `couponPolicy.validate(...)`; coupon inactive/expired bị reject trước khi tạo order. | **RESOLVED P0-01** |
| 2 | Apply khi đủ min, giảm qty xuống dưới min | `refreshCartTotals` kiểm tra `subtotal < coupon.minAmount` và auto-remove coupon; test cart regression PASS. | **RESOLVED P1** |
| 3 | usageLimit=1, 2 user checkout đồng thời | Checkout dùng `attemptRedeem` atomic conditional UPDATE; giao dịch thua nhận 409, và nếu rơi vào nhánh `redeemed == 0` sẽ trả generic message "Mã giảm giá không còn hiệu lực hoặc đã đạt giới hạn sử dụng." | **RESOLVED P0-02** |
| 4 | Idempotency-Key checkout retry | reserveIdempotency dùng UNIQUE constraint. Nếu cùng key + cùng request hash → trả existing summary, **không** chạy lại logic → KHÔNG increment usage_count thêm. | **OK** ([CheckoutService.java:454-501](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java#L454-L501)) |
| 5 | Update FIXED 200 000 → PERCENT (không gửi amount) | `AdminCouponService` validate lại existing amount khi `discountType` đổi; PATCH trả 400 nếu amount cũ không hợp lệ cho type mới. | **RESOLVED P0-03** |
| 6 | Guest cart CONVERTED → reload | `getOrCreateGuestCart` dùng `findBySessionIdAndStatus(..., ACTIVE)` nên cart CONVERTED không còn được reuse. | **RESOLVED P1** |
| 7 | Apply 2 coupon khác nhau cùng cart concurrent | DB `UNIQUE(cart_id)` + `DataIntegrityViolationException` -> 409 ngăn 2 coupon/cùng cart. | **RESOLVED P1-04** |
| 8 | Coupon expired bởi scheduler nhưng đang trong cart | Dù cart chưa refresh, checkout vẫn revalidate fresh coupon trước redeem. | **RESOLVED P0-01** |
| 9 | Merge guest → customer | [CartService.mergeGuestCart](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L197-L228) chỉ merge **items**. **KHÔNG** copy `cart_coupons` từ guest sang customer cart. Sau khi guest cart set MERGED, cart_coupons cascade-delete? Không — cascade chỉ trên items via cart_items FK; cart_coupons cũng cascade khi guest cart bị xóa (V20: `on delete cascade`), nhưng guest cart chỉ set MERGED không bị xóa, vậy cart_coupons orphan. → coupon mất khi login. | **BROKEN P2-09** |
| 10 | Order detail có hiển thị coupon? | Admin BE: có (`appliedCoupons`). Admin UI: KHÔNG. Customer BE: không có field. Customer UI: không. | **MISSING P2-07/08** |

---

## 9. Test Coverage

### Tests đã có

| Test file | Coupon-related tests | Coverage |
|---|---|---|
| [Phase1JAdminSettingsMenuCouponApiTest.java](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1JAdminSettingsMenuCouponApiTest.java) | Admin CRUD gốc + 7 coupon hardening tests mới (#33-39 scope hardening) | Admin CRUD + coupon policy regression |
| [Phase1BSchemaTest.java](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/schema/Phase1BSchemaTest.java#L194-L208) | `coupon_saveAndFind` (1 round-trip) | Schema only |
| [Phase1CCommerceSchemaTest.java](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/schema/Phase1CCommerceSchemaTest.java#L205-L220) | `orderAppliedCoupon_saveAndFindByCode` | Schema only |
| [Phase2CWordPressCustomerOrderCouponDryRunImporterTest.java](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase2CWordPressCustomerOrderCouponDryRunImporterTest.java) | mapper percent/fixed_cart, dry-run | WP migration mapper |
| [Phase1K1ContractHardeningTest.java](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1K1ContractHardeningTest.java) | (mention coupon) | OpenAPI contract |
| [Phase1KOpenApiContractTest.java](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1KOpenApiContractTest.java) | (mention coupon) | OpenAPI contract |

### Checkout/cart/admin test evidence (updated 2026-05-06)

`Phase1FCheckoutApiTest` hiện cover 7 coupon checkout cases trong scope release blocker:

| Test | Case | Kết quả |
|---|---|---|
| C1 `checkout_withFixedCoupon_discountApplied` | Happy path: FIXED coupon áp dụng → discount đúng, usageCount +1 | ✅ PASS |
| C2 `checkout_withDisabledCoupon_returns409` | Admin disable coupon sau khi apply vào cart → checkout 409 | ✅ PASS |
| C3 `checkout_withExpiredCoupon_returns409` | Coupon hết hạn sau khi apply → checkout 409 | ✅ PASS |
| C4 `checkout_couponUsageLimitExhausted_secondCheckoutFails` | usageLimit=1: 2 session apply, checkout lần 2 fail, `usageCount` dừng ở 1 | ✅ PASS |
| C5 `checkout_afterSubtotalDropsBelowMinimumAmount_couponRemovedBeforeCheckout` | subtotal giảm dưới `minimumAmount` -> coupon bị remove trước checkout, order không còn discount | ✅ PASS |
| C6 `checkout_idempotencyKeyRetry_noDoubleCouponIncrement` | Idempotency-Key retry không double-increment `usageCount` | ✅ PASS |
| C7 `checkout_concurrentRequests_onlyOneRedeemsLastCouponUse` | 2 checkout đồng thời tranh 1 lượt cuối: 1 request 200, 1 request 409 generic redeem conflict, `usageCount` vẫn là 1 | ✅ PASS |

`Phase1JAdminSettingsMenuCouponApiTest` tiếp tục cover 7 coupon hardening cases phía admin/cart apply:

| Test | Case | Kết quả |
|---|---|---|
| J1 `updateCoupon_fixedToPercent_withHighAmount_returns400` | Partial FIXED→PERCENT với existing amount invalid | ✅ PASS |
| J2 `applyCoupon_nonexistentCode_returns404` | Cart apply coupon không tồn tại | ✅ PASS |
| J3 `applyCoupon_inactiveCoupon_returns409` | Cart apply coupon inactive | ✅ PASS |
| J4 `applyCoupon_expiredCoupon_returns409` | Cart apply coupon expired | ✅ PASS |
| J5 `applyCoupon_validActiveCoupon_succeeds` | Cart apply coupon active hợp lệ | ✅ PASS |
| J6 `shopManager_canListCoupons` | SHOP_MANAGER qua được coupon URL matcher | ✅ PASS |
| J7 `applyCoupon_secondCoupon_returns409` | Cart không nhận coupon thứ hai | ✅ PASS |

`Phase1ECartApiTest` giữ coverage cho refresh/minimumAmount invalidation, bao gồm `updateItemQty_reducesSubtotalBelowMinAmount_couponRemoved` và `couponBecomesInactive_afterApply_cartRefreshRemovesCoupon`.

**Kết quả suite đã chạy lại** (2026-05-06):

| Test suite | Kết quả |
|---|---|
| `Phase1FCheckoutApiTest` | **41/41** PASS |
| `Phase1JAdminSettingsMenuCouponApiTest` | **63/63** PASS |
| `Phase1ECartApiTest` | **27/27** PASS |
| Full backend `.\mvnw.cmd test` | **849 tests, 0 failures, 0 errors, 3 skipped** |

### Tests còn thiếu (backlog)

- ❌ Cart `applyCoupon` over usageLimit / notStarted timing branch chưa có dedicated test.
- ❌ Cart `removeCoupon` — 0 test.
- ❌ Cart `refreshCartTotals` cho startsAt/notStarted timing branch chưa có dedicated test.
- ❌ Soak/stress concurrency rộng hơn (nhiều hơn 2 request đồng thời, lặp nhiều vòng) chưa có; đã có deterministic 2-request race test C7 cho last redemption.
- ❌ Scheduler `expireOverdueCoupons` — 0 test.
- ❌ Guest cart merge with coupon — 0 test.
- ❌ FE admin coupon screen — 0 test (project không có Vitest setup mạnh).
- ❌ Web FE cart coupon UI — 0 test.

---

## 10. Findings

### P0 Blockers

#### P0-COUPON-01 — Checkout không revalidate coupon — **RESOLVED 2026-05-06**

- **Title**: Checkout copy nguyên `cart_coupons.discount_amount` mà không re-validate status/expires/usageLimit/minimumAmount của coupon source
- **Status**: ✅ RESOLVED
- **Fix applied**: [CheckoutService.java:186-203](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java#L186-L203) — vòng lặp reload fresh coupon từ DB, gọi `couponPolicy.validate(freshCoupon, subtotal)` (kiểm tra status, startsAt, expiresAt, usageLimit, minimumAmount) và recompute discount; nếu invalid → ConflictException 409.
- **Test evidence**: C2 (`checkout_withDisabledCoupon_returns409`), C3 (`checkout_withExpiredCoupon_returns409`), C5 (`checkout_afterSubtotalDropsBelowMinimumAmount_couponRemovedBeforeCheckout`) — Phase1FCheckoutApiTest PASS.

#### P0-COUPON-02 — usageLimit không atomic — **RESOLVED 2026-05-06**

- **Title**: `incrementUsageCount` UPDATE không có guard `usage_count < usage_limit` → race condition
- **Status**: ✅ RESOLVED
- **Fix applied**: [CouponJpaRepository.java:31-38](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/coupon/CouponJpaRepository.java#L31-L38) — `attemptRedeem` query thêm các điều kiện `status = 'ACTIVE'`, `startsAt IS NULL OR startsAt <= :now`, `expiresAt IS NULL OR expiresAt >= :now`, `usageLimit IS NULL OR usageCount < usageLimit`; trả về rows affected. [CheckoutService.java:252-259](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java#L252-L259) ném ConflictException message generic "Mã giảm giá không còn hiệu lực hoặc đã đạt giới hạn sử dụng." khi `redeemed == 0`.
- **Test evidence**: C4 (`checkout_couponUsageLimitExhausted_secondCheckoutFails`) chứng minh `usageCount` không vượt quá limit ở flow tuần tự; C7 (`checkout_concurrentRequests_onlyOneRedeemsLastCouponUse`) chứng minh 2 checkout đồng thời chỉ có 1 request redeem thành công và request thua nhận generic conflict message. Phase1FCheckoutApiTest PASS.

#### P0-COUPON-03 — Update FIXED→PERCENT không validate effective amount — **RESOLVED 2026-05-06**

- **Title**: Partial PATCH change `discountType` không kéo theo re-validate `amount` ngược với type mới
- **Status**: ✅ RESOLVED
- **Fix applied**: [AdminCouponService.java:164-168](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCouponService.java#L164-L168) — khi `req.amount == null` nhưng `discountType` thay đổi, gọi `validateAmount(entity.getAmount(), type)` để kiểm tra amount hiện tại có hợp lệ với type mới. FIXED→PERCENT với amount=200000 → `validateAmount` ném ValidationException "PERCENT amount must be ≤ 100".
- **Test evidence**: `updateCoupon_fixedToPercent_withHighAmount_returns400` [Phase1JAdminSettingsMenuCouponApiTest.java:859-867](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1JAdminSettingsMenuCouponApiTest.java#L859-L867) PASS; companion happy-path `updateCoupon_fixedToPercent_withValidAmount_succeeds` [Phase1JAdminSettingsMenuCouponApiTest.java:872-882](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1JAdminSettingsMenuCouponApiTest.java#L872-L882) PASS.

### P1 High

#### P1-COUPON-04 — One-coupon-per-cart DB enforcement — **RESOLVED 2026-05-06**

- **Evidence**: [V73__enforce_one_coupon_per_cart.sql](bigbike-backend/src/main/resources/db/migration/V73__enforce_one_coupon_per_cart.sql) thêm `UNIQUE(cart_id)`; [CartService.applyCoupon](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L244-L280) catch `DataIntegrityViolationException` và trả 409.
- **Impact before fix**: 2 request coupon khác nhau cùng cart có thể cấy 2 dòng `cart_coupons`.
- **Status**: ✅ RESOLVED.

#### P1-COUPON-05 — Test coverage coupon hardening — **RESOLVED for release blockers**

- **Evidence**: `Phase1FCheckoutApiTest` cover 7 coupon checkout cases (happy path, disable-after-apply, expire-after-apply, limit exhausted, minimumAmount drop, idempotency retry, concurrent last redemption); `Phase1JAdminSettingsMenuCouponApiTest` cover 7 admin/cart-apply hardening cases; `Phase1ECartApiTest` cover refresh/minimumAmount invalidation.
- **Release assessment**: Regression risk cho các P0/P1 chính đã có test khóa. Phần còn lại là scheduler, broader stress/soak concurrency, removeCoupon, not-started timing branch, và OpenAPI/doc sync follow-up.
- **Status**: ✅ RESOLVED as blocker; backlog hạ xuống LOW/tooling.

#### P1-COUPON-06 — Permission inconsistency SHOP_MANAGER — **RESOLVED 2026-05-06**

- **Evidence**: [SecurityConfig.java:105](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java#L105) dùng `hasAnyRole("ADMIN","SUPER_ADMIN","SHOP_MANAGER")` cho `/api/v1/admin/coupons/**`; test `shopManager_canListCoupons` [Phase1JAdminSettingsMenuCouponApiTest.java:957-969](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1JAdminSettingsMenuCouponApiTest.java#L957-L969) PASS.
- **Status**: ✅ RESOLVED.

#### P1-COUPON — Cart minimumAmount re-check sau apply — **RESOLVED 2026-05-06**

- **Evidence**: [CartService.refreshCartTotals](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L323-L365) remove coupon khi `subtotal < minimumAmount`.
- **Test evidence**: `updateItemQty_reducesSubtotalBelowMinAmount_couponRemoved` [Phase1ECartApiTest.java:511-549](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1ECartApiTest.java#L511-L549) PASS.
- **Status**: ✅ RESOLVED.

#### P1 — Guest cart CONVERTED reuse — **RESOLVED 2026-05-06**

- **Evidence**: `getOrCreateGuestCart` dùng `findBySessionIdAndStatus(..., ACTIVE)` trong [CartService.java:84-95](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L84-L95), nên cart `CONVERTED` không còn trở lại UI/cart flow.
- **Status**: ✅ RESOLVED.

### P2 Medium

#### P2-COUPON-07 — Admin order UI không hiển thị appliedCoupons

- **Evidence**: BE trả `appliedCoupons` ở [AdminOrderService.java:469-503](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java#L469-L503). FE [OrderDetailScreen.jsx:313-319](bigbike-admin/src/screens/OrderDetailScreen.jsx#L313-L319) chỉ render `order.discount`, không render `order.appliedCoupons`.
- **Impact**: Admin không nhìn thấy coupon code đã dùng cho audit/support.
- **Fix**: FE thêm section "Mã giảm giá đã sử dụng" liệt kê `code + discountAmount` per coupon.

#### P2-COUPON-08 — Customer order detail không hiển thị coupon

- **Evidence**: [OrderDetailResponse.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/order/dto/OrderDetailResponse.java) (customer-side) không có field `appliedCoupons`. Web FE [commerce.ts:146-173](bigbike-web/lib/contracts/commerce.ts#L146-L173) `OrderDetail` cũng vậy.
- **Impact**: Customer xem order history không thấy mã giảm giá đã áp dụng (hợp đồng / hóa đơn cần info này).
- **Fix**: Mở rộng customer DTO + FE.

#### P2-COUPON-09 — Merge guest cart không giữ coupon

- **Evidence**: [CartService.mergeGuestCart](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L197-L228) chỉ chuyển items, không di chuyển hoặc copy `cart_coupons`.
- **Impact**: Guest apply coupon, sau đó login → coupon biến mất. Trải nghiệm xấu.
- **Fix**: Quyết định business: copy coupon (nếu customer cart chưa có) hoặc reject (giữ customer cart's coupon nếu có). Implement trong mergeGuestCart.

#### P2-COUPON-10 — UI Admin thiếu các field BE hỗ trợ

- **Evidence**: §3 bảng "Gaps trong UI Admin".
- **Fix**: Mở rộng form (description, startsAt, maximumAmount, metadata, status ARCHIVED toggle, edit code/name).

#### P2-COUPON-11 — Entity/migration mismatch: name nullable

- **Evidence**: [CouponEntity.java:27](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/coupon/CouponEntity.java#L27) `nullable=false` vs migration V5 `name varchar(255)`.
- **Impact**: Hibernate validate-on-startup có thể warn; legacy import có thể tạo coupon name=NULL ở DB rồi load entity gây NPE / @NotNull violation.
- **Fix**: Thêm migration `ALTER TABLE coupons ALTER COLUMN name SET NOT NULL` (sau khi backfill nullable rows nếu có).

#### P2-COUPON-12 — DB không có CHECK constraint trên status, discount_type, amount, usage_count

- **Evidence**: V5 không có constraint.
- **Impact**: Bypass service (raw SQL, broken seeder, WP importer bug) có thể chèn dữ liệu invalid → service runtime crash khi normalize.
- **Fix**: Migration mới:
  ```sql
  ALTER TABLE coupons
    ADD CONSTRAINT chk_coupons_status CHECK (status IN ('ACTIVE','INACTIVE','EXPIRED','ARCHIVED')),
    ADD CONSTRAINT chk_coupons_discount_type CHECK (discount_type IN ('FIXED','PERCENT')),
    ADD CONSTRAINT chk_coupons_amount_positive CHECK (amount > 0),
    ADD CONSTRAINT chk_coupons_usage_within_limit CHECK (usage_limit IS NULL OR usage_count <= usage_limit);
  ```
  Cần data cleanup trước (legacy imported PERCENT amount=0 hoặc FIXED_AMOUNT etc).

### P3 Low

#### P3-COUPON-13 — WP importer không validate runtime

- **Evidence**: [CouponImporter.java:70-78](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/importer/CouponImporter.java#L70-L78). `amount = mc.amount() != null ? mc.amount() : BigDecimal.ZERO;` → có thể tạo coupon `amount=0`. PERCENT > 100 chỉ cảnh báo, không reject.
- **Impact**: Sau import có coupon vi phạm runtime rule (amount=0 → discount luôn 0; PERCENT 150 → cap nhưng vẫn weird).
- **Fix**: Reject hoặc skip mc.amount=null/<=0/PERCENT>100 thay vì write zero.

#### P3-COUPON — refreshCartTotals refresh chỉ trên cart action, không real-time

- Coupon expire qua scheduler → cart đang giữ coupon **không** tự re-validate cho tới khi user thao tác. Acceptable trade-off; checkout fix (P0-01) sẽ cover.

---

## 11. Final Verdict

### Verdict: **READY** _(updated 2026-05-06)_

Không còn P0/P1 blocker trong coupon module scope. Checkout revalidation, atomic usage guard, generic 0-row redeem conflict, partial FIXED→PERCENT validation, one-coupon-per-cart DB enforcement, minimumAmount re-check, guest cart `CONVERTED` reuse, và SHOP_MANAGER coupon access mismatch đã được resolve và có test evidence.

### P0 Checklist:

- [x] P0-COUPON-01 RESOLVED: `CheckoutService` revalidate coupon (status/startsAt/expiresAt/usageLimit/minimumAmount). Tests C2, C3, C5 PASS.
- [x] P0-COUPON-02 RESOLVED: `attemptRedeem` atomic conditional UPDATE + 0-row-affected -> generic 409 conflict. Tests C4, C7 PASS.
- [x] P0-COUPON-03 RESOLVED: `AdminCouponService.updateCoupon` re-validates effective amount khi đổi discountType. Dedicated tests J1/J2 PASS.
- [x] CI evidence: `Phase1FCheckoutApiTest` 41/41 PASS, `Phase1JAdminSettingsMenuCouponApiTest` 63/63 PASS, `Phase1ECartApiTest` 27/27 PASS, full `.\mvnw.cmd test` PASS (849 tests, 0 failures, 0 errors, 3 skipped).

### Release-blocking status

- [x] P1-COUPON-04 RESOLVED: DB `UNIQUE(cart_id)` + 409 mapping.
- [x] P1 minimumAmount re-check RESOLVED: `refreshCartTotals` removes invalid coupon.
- [x] P1 guest cart `CONVERTED` reuse RESOLVED.
- [x] P1-COUPON-06 RESOLVED: SHOP_MANAGER matcher aligned in `SecurityConfig`.
- [x] P1-COUPON-05 RESOLVED as release blocker: primary regressions now covered by integration tests.

### Remaining LOW/P2 backlog

- **LOW/tooling**: OpenAPI / audit doc sync và regression coverage follow-up cho scheduler, broader concurrency stress/soak, cart remove coupon, not-started timing branch.
- **P2-07/08**: hiển thị coupon trên admin/customer order detail.
- **P2-09**: merge guest cart preserve coupon.
- **P2-10**: expose full BE fields trên UI admin.
- **P2-11/12**: DB constraint cleanup (`coupons.name` nullable mismatch, thiếu CHECK constraints).
- **P3-13**: WP importer validation hardening.

### % hoàn thiện ước lượng

| Layer | % | Ghi chú |
|---|---|---|
| BE Admin CRUD | 92% | P0-03 đã fix; còn UI/admin field gaps + DB enum constraints |
| BE Cart apply/remove | 88% | `applyCoupon`/`refreshCartTotals` hardening đã xong; còn remove/not-started coverage |
| BE Checkout | 90% | Fresh revalidation + atomic redeem + idempotency cover đã có |
| BE Scheduler | 90% | Hoạt động, có log; thiếu test |
| DB schema | 78% | `UNIQUE(cart_id)` đã có; còn CHECK constraints + nullable `name` cleanup |
| Admin FE | 60% | Cơ bản OK; thiếu nhiều field, không hiển thị order coupon |
| Web FE | 75% | Cart UI OK; checkout chỉ list code, order detail không có |
| Permission | 90% | Coupon matcher align với role grants; còn overall system verify theo broader audit |
| WP importer | 70% | Chạy được nhưng có thể nhập dữ liệu vi phạm runtime |
| Test | 72% | Checkout/cart/admin hardening đã có; còn scheduler + concurrency stress + FE |
| **Tổng** | **~84%** | READY for release; remaining work is LOW/P2 |

---

*End of audit — 2026-05-06*
