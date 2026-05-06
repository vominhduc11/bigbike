# Coupons Module Audit

> Audit ngày 2026-05-06 — Senior Fullstack/QA review
> Scope: backend coupon admin + cart/coupon flow + checkout + DB + admin/web FE + WP importer + test
> Phương pháp: đọc source code thật (không phỏng đoán), trích evidence file:line. Không sửa code.
> Test runtime KHÔNG được chạy trong session này (xem §9 — backend test cần Postgres + Java toolchain integrated env, không khả dụng trong shell).

---

## 1. Executive Summary

**Verdict: NOT_READY for production. ~55% complete.**

Module coupon **có UI admin, có cart apply/remove, có checkout snapshot vào order**, nhưng có nhiều lỗ hổng nghiêm trọng:

- **P0-COUPON-01** — Checkout **KHÔNG** revalidate coupon (status / expiresAt / usageLimit / minimumAmount). Coupon đã apply vào cart sau đó admin disable / hết hạn / hết lượt → checkout vẫn dùng `cart_coupons.discount_amount` đã cache.
- **P0-COUPON-02** — `usageLimit` không atomic. Increment `usage_count` ở checkout không kèm điều kiện `< usage_limit` → 2 checkout song song có thể vượt giới hạn.
- **P0-COUPON-03** — Update `discountType` partial từ FIXED 200 000 → PERCENT mà không gửi `amount` mới: service không reset `amount`, sẽ tạo coupon `PERCENT 200 000%`.
- **P1-COUPON-04** — "One coupon per cart" enforce ở service, không có constraint DB. 2 request POST `/cart/coupons` concurrent với code khác nhau có thể chèn 2 dòng vào `cart_coupons`.
- **P1-COUPON-05** — Test coverage cho cart coupon, checkout coupon, scheduler, race condition: gần như **0**. Coupon admin có 10 test (status / discount type / duplicate), không có test apply/checkout/race.
- **P1-COUPON-06** — Permission inconsistency: SHOP_MANAGER có `coupons.read/write` trong [AdminRolePermissions.java:41](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminRolePermissions.java#L41) và migration [V49](bigbike-backend/src/main/resources/db/migration/V49__create_roles_permissions_tables.sql), nhưng `SecurityConfig` chặn `/api/v1/admin/**` ở mức `hasRole("ADMIN")` → SHOP_MANAGER không qua được URL guard.
- **P2-COUPON-07** — Admin order detail trả `appliedCoupons` từ BE nhưng UI admin **không hiển thị** mã coupon đã dùng.
- **P2-COUPON-08** — Customer order detail (BE + web FE) **không hiển thị** code coupon đã dùng.
- **P2-COUPON-09** — `merge guest → customer cart` chỉ merge items, **không merge cart_coupons** → coupon do guest apply biến mất sau login.
- **P2-COUPON-10** — Admin Coupon UI thiếu các field BE đã hỗ trợ: `description`, `startsAt`, `maximumAmount`, `metadata`, status `ARCHIVED`, edit `code`/`name`.
- **P2-COUPON-11** — Schema entity vs migration mismatch: entity bắt `name NOT NULL` ([CouponEntity.java:27](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/coupon/CouponEntity.java#L27)) nhưng migration V5 định nghĩa `name varchar(255)` nullable.
- **P2-COUPON-12** — `discount_type` và `status` không có CHECK constraint ở DB; mọi giá trị string đều insert được nếu bypass service.
- **P3-COUPON-13** — WP importer không validate runtime rules → có thể import coupon `amount=0`, PERCENT > 100, etc.

**Điều kiện chuyển READY**: xem §11.

---

## 2. Route & API Matrix

| Method | Route | Controller | Service | Permission | Status |
|---|---|---|---|---|---|
| GET | `/api/v1/admin/coupons` | [AdminCouponController.listCoupons](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminCouponController.java#L52-L66) | [AdminCouponService.listCoupons](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCouponService.java#L53-L78) | `coupons.read` + `hasRole("ADMIN")` | COMPLETE |
| GET | `/api/v1/admin/coupons/{id}` | [AdminCouponController.getCouponById](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminCouponController.java#L68-L75) | [AdminCouponService.getCouponById](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCouponService.java#L82-L86) | `coupons.read` + `hasRole("ADMIN")` | COMPLETE |
| POST | `/api/v1/admin/coupons` | [AdminCouponController.createCoupon](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminCouponController.java#L77-L84) | [AdminCouponService.createCoupon](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCouponService.java#L90-L135) | `coupons.write` + `hasRole("ADMIN")` | PARTIAL |
| PATCH | `/api/v1/admin/coupons/{id}` | [AdminCouponController.updateCoupon](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminCouponController.java#L86-L95) | [AdminCouponService.updateCoupon](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCouponService.java#L139-L217) | `coupons.write` + `hasRole("ADMIN")` | BROKEN (xem P0-03) |
| PATCH | `/api/v1/admin/coupons/{id}/status` | [AdminCouponController.updateCouponStatus](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminCouponController.java#L97-L106) | [AdminCouponService.updateCouponStatus](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCouponService.java#L221-L240) | `coupons.write` + `hasRole("ADMIN")` | COMPLETE |
| POST | `/api/v1/cart/coupons` | [CartController.applyCoupon](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/cart/CartController.java#L110-L121) | [CartService.applyCoupon](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L238-L288) | guest+customer (permitAll) | PARTIAL |
| DELETE | `/api/v1/cart/coupons/{code}` | [CartController.removeCoupon](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/cart/CartController.java#L123-L134) | [CartService.removeCoupon](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L290-L297) | guest+customer (permitAll) | COMPLETE |
| POST | `/api/v1/checkout` (cart→order, áp dụng coupon) | [CheckoutController](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/checkout) | [CheckoutService.checkoutFromCart](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java#L152-L267) | guest+customer (permitAll) | BROKEN (no revalidate, race) |
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
| `/api/v1/admin/coupons*` | `hasRole("ADMIN")` ([SecurityConfig.java:105](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java#L105)) | `coupons.read` / `coupons.write` ([AdminCouponController.java:63,73,82,92,103](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminCouponController.java#L63)) | URL guard **chặn SHOP_MANAGER** trước khi tới permission check |
| `/api/v1/cart/coupons*` | `permitAll` ([SecurityConfig.java:79-80](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java#L79-L80)) | none | cart guest/customer flow OK |

### Role grant inconsistency (P1-06)

| Role | `coupons.read/write` in [AdminRolePermissions.MAP](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminRolePermissions.java#L15-L64) | `coupons.read/write` in DB seed [V49](bigbike-backend/src/main/resources/db/migration/V49__create_roles_permissions_tables.sql) | URL guard `/api/v1/admin/**` |
|---|---|---|---|
| SUPER_ADMIN | `*` (line 16) | (not seeded with explicit grants per file) | `hasRole("ADMIN")` does NOT match `ROLE_SUPER_ADMIN` — may also be blocked unless mapping injects ADMIN role too |
| ADMIN | YES (line 27) | YES | ALLOWED |
| SHOP_MANAGER | YES (line 41) | YES (V49 line 110-111) | **BLOCKED** — `hasRole("ADMIN")` chặn |
| EDITOR / AUTHOR / etc | NO | NO | BLOCKED OK |

→ Granting `coupons.*` to SHOP_MANAGER là dead code; SHOP_MANAGER không thể gọi admin coupon API trừ khi SecurityConfig được mở. **P1-COUPON-06**.
→ Cần verify: SUPER_ADMIN principal có được attach role `ADMIN` thêm không? Nếu không sẽ bị chặn ngay tại URL guard. Cần investigation. **NEEDS_VERIFICATION**.

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
| **Update partial revalidate full state** | Update **không gọi `validateAmount` lại nếu req.amount==null nhưng req.discountType thay đổi** ([AdminCouponService.java:166-175](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCouponService.java#L166-L175)) — current `entity.amount` được dùng làm `effectiveAmount` nhưng KHÔNG check ngược `PERCENT amount ≤ 100` khi đổi type | NOT_FOUND_TEST | **BROKEN** (P0-03) | Đổi FIXED→PERCENT mà không gửi amount mới → tạo PERCENT với amount=200 000 → discount = 200 000% subtotal |
| Apply: empty code | `@NotBlank` [ApplyCouponRequest.java:6](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/cart/dto/ApplyCouponRequest.java#L6) | NOT_FOUND_TEST | PARTIAL | |
| Apply: not found | [CartService.java:249-250](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L249-L250) | NOT_FOUND_TEST | PARTIAL | |
| Apply: inactive/archived/expired | [CartService.java:253-261](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L253-L261) (status != ACTIVE → từ chối, đè cả ARCHIVED) | NOT_FOUND_TEST | PARTIAL | |
| Apply: not started (`startsAt > now`) | [CartService.java:256-258](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L256-L258) | NOT_FOUND_TEST | PARTIAL | |
| Apply: over usage limit | [CartService.java:262-264](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L262-L264) | NOT_FOUND_TEST | PARTIAL (race risk — see P0-02) | |
| Apply: subtotal < minAmount | [CartService.java:267-275](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L267-L275) | NOT_FOUND_TEST | PARTIAL | |
| Apply: discount > subtotal → cap | [CartService.java:382](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L382) | NOT_FOUND_TEST | PARTIAL | |
| Cart recalculate khi item change → re-validate coupon | [CartService.refreshCartTotals](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L328-L369) auto-remove coupon nếu inactive/expired/over-limit & recompute discount | NOT_FOUND_TEST | PARTIAL | Coupon sẽ không tự remove nếu subtotal sụt dưới minAmount — chỉ recompute. **Hidden bug** |
| **Checkout revalidate** (status, expiresAt, usageLimit, minAmount) | **NONE** [CheckoutService.java:177-179](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java#L177-L179) chỉ gọi `cartCalculator.recalculateCart` (sum, không re-validate). [Block 232-248](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java#L232-L248) chỉ snapshot và increment | NOT_FOUND_TEST | **BROKEN** (P0-01) | |

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
- ❌ **Không có** `unique(cart_id)` để enforce 1-coupon/cart ở DB → race condition với 2 code khác nhau (P1-04).
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

- **Apply** dùng `findByCodeForUpdate` ([CouponJpaRepository.java:22-24](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/coupon/CouponJpaRepository.java#L22-L24)) — chỉ chống race apply same coupon vào nhiều cart cùng lúc.
- **Checkout** chỉ gọi `incrementUsageCount` UPDATE không condition ([CouponJpaRepository.java:31-34](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/coupon/CouponJpaRepository.java#L31-L34)). **Không lock**, không atomic compare-set → P0-02.
- Recommend SQL: `UPDATE coupons SET usage_count = usage_count + 1 WHERE id=? AND (usage_limit IS NULL OR usage_count < usage_limit) RETURNING ...` và xử lý 0-row-affected.

---

## 8. Cart / Checkout / Order Flow

```
[Cart applyCoupon] → cart_coupons row + recompute totals (lock coupon row briefly)
        ↓
[Cart updateItem/removeItem/addItem] → refreshCartTotals → re-validate coupons,
        auto-remove if status≠ACTIVE/expired/over-limit; recompute discount
        ⚠ KHÔNG re-check minimumAmount → coupon vẫn ở lại nếu subtotal sụt dưới min
        ↓
[Checkout]
  1. reserveIdempotency (SHA-256 hash request payload, table checkout_idempotency_keys)
  2. syncPricesAndValidateStock (price re-sync + stock check)
  3. cartCalculator.recalculateCart  ← chỉ SUM, KHÔNG re-validate coupon
  4. tạo OrderEntity, save line items, addresses, shipping, payment
  5. for each cart_coupon:
       - tạo OrderAppliedCouponEntity (snapshot code, discount, couponId)
       - couponRepo.incrementUsageCount(id)  ← KHÔNG check < limit
  6. set cart.status = CONVERTED
  7. attachOrderToReservation  (idempotency stores orderId for retries)
```

Evidence: [CheckoutService.java:152-267](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java#L152-L267).

**Special-case checks** (theo yêu cầu §3 đề bài):

| # | Case | Hiện trạng | Verdict |
|---|---|---|---|
| 1 | Apply rồi admin disable rồi user checkout | refreshCartTotals chỉ chạy khi cart thay đổi item, không chạy ở checkout. Checkout không revalidate. → **NEW order với discount cũ và `couponRepo.incrementUsageCount` cho coupon INACTIVE**. | **BROKEN P0-01** |
| 2 | Apply khi đủ min, giảm qty xuống dưới min | `refreshCartTotals` re-check `nowInvalid=!ACTIVE OR over usageLimit OR expired` ([CartService.java:346-348](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L346-L348)) — **KHÔNG kiểm tra subtotal < minAmount**. Coupon ở lại với discount đã recomputed (FIXED giữ nguyên, PERCENT chia theo subtotal mới). | **BROKEN P1** (logic edge case) |
| 3 | usageLimit=1, 2 user checkout đồng thời | applyCoupon dùng pessimistic lock; nhưng việc 2 user khác cart có thể apply trước (mỗi cart 1 row), sau đó cùng checkout. Checkout không lock, increment unconditionally → cả 2 thành công, `usage_count=2 > limit=1`. | **BROKEN P0-02** |
| 4 | Idempotency-Key checkout retry | reserveIdempotency dùng UNIQUE constraint. Nếu cùng key + cùng request hash → trả existing summary, **không** chạy lại logic → KHÔNG increment usage_count thêm. | **OK** ([CheckoutService.java:454-501](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java#L454-L501)) |
| 5 | Update FIXED 200 000 → PERCENT (không gửi amount) | [updateCoupon](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCouponService.java#L139-L217): line 156-164 set `entity.discountType=PERCENT`. line 166-169 chỉ chạy validateAmount nếu `req.amount != null`. Line 173 dùng `effectiveAmount = entity.getAmount()` cho `validateMinMaxAmounts` nhưng **không** chạy `validateAmount(effectiveAmount, type)`. → Lưu coupon `PERCENT amount=200000` → discount tính `subtotal * 200000 / 100 = subtotal * 2000` → cap `min(discount, subtotal)` ở [computeDiscount](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L382). Discount sẽ luôn = subtotal → ĐƠN HÀNG MIỄN PHÍ. | **BROKEN P0-03** |
| 6 | Guest cart CONVERTED → reload | `getOrCreateGuestCart` ([CartService.java:78-91](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L78-L91)) **chỉ findBySessionId** không filter status. Nếu cart CONVERTED vẫn được trả về → Cart UI hiển thị order đã chuyển. **BUG** (ngoài coupon scope nhưng phát hiện được). | **BROKEN P1** |
| 7 | Apply 2 coupon khác nhau cùng cart concurrent | applyCoupon đọc `findByCartId` rồi check empty → 2 request có thể cùng đọc empty trước insert → cả 2 chèn → cart có 2 cart_coupons. Không có `unique(cart_id)` chống. | **BROKEN P1-04** |
| 8 | Coupon expired bởi scheduler nhưng đang trong cart | refreshCartTotals sẽ remove khi cart thay đổi tiếp; **nhưng** checkout không revalidate → vẫn dùng. (Same as #1) | **BROKEN P0-01** |
| 9 | Merge guest → customer | [CartService.mergeGuestCart](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L197-L228) chỉ merge **items**. **KHÔNG** copy `cart_coupons` từ guest sang customer cart. Sau khi guest cart set MERGED, cart_coupons cascade-delete? Không — cascade chỉ trên items via cart_items FK; cart_coupons cũng cascade khi guest cart bị xóa (V20: `on delete cascade`), nhưng guest cart chỉ set MERGED không bị xóa, vậy cart_coupons orphan. → coupon mất khi login. | **BROKEN P2-09** |
| 10 | Order detail có hiển thị coupon? | Admin BE: có (`appliedCoupons`). Admin UI: KHÔNG. Customer BE: không có field. Customer UI: không. | **MISSING P2-07/08** |

---

## 9. Test Coverage

### Tests đã có

| Test file | Coupon-related tests | Coverage |
|---|---|---|
| [Phase1JAdminSettingsMenuCouponApiTest.java](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1JAdminSettingsMenuCouponApiTest.java) | #19 401 unauth list, #20 list, #21 createFixed, #22 createPercent, #23 invalid discountType, #24 percent>100, #25 duplicateCode→409, #26 updateName, #27 updateStatus, #28 getById, #29-30 ARCHIVED, #31-32 invalid status | Admin CRUD validation chính |
| [Phase1BSchemaTest.java](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/schema/Phase1BSchemaTest.java#L194-L208) | `coupon_saveAndFind` (1 round-trip) | Schema only |
| [Phase1CCommerceSchemaTest.java](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/schema/Phase1CCommerceSchemaTest.java#L205-L220) | `orderAppliedCoupon_saveAndFindByCode` | Schema only |
| [Phase2CWordPressCustomerOrderCouponDryRunImporterTest.java](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase2CWordPressCustomerOrderCouponDryRunImporterTest.java) | mapper percent/fixed_cart, dry-run | WP migration mapper |
| [Phase1K1ContractHardeningTest.java](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1K1ContractHardeningTest.java) | (mention coupon) | OpenAPI contract |
| [Phase1KOpenApiContractTest.java](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1KOpenApiContractTest.java) | (mention coupon) | OpenAPI contract |

### Tests THIẾU (NOT_FOUND)

- ❌ Cart `applyCoupon` happy path / inactive / expired / over usageLimit / subtotal<min / not found / not started — **0 test**.
- ❌ Cart `removeCoupon` — 0 test.
- ❌ Cart `refreshCartTotals` auto-invalidate khi coupon hết hạn — 0 test.
- ❌ Checkout với coupon, snapshot `order_applied_coupons`, increment `usage_count` — 0 test.
- ❌ Race condition usageLimit (2 checkout song song) — 0 test.
- ❌ Idempotency-Key checkout với coupon — 0 test.
- ❌ Update partial discountType→PERCENT không gửi amount — 0 test (nếu có sẽ catch P0-03).
- ❌ Scheduler `expireOverdueCoupons` — 0 test.
- ❌ Guest cart merge with coupon — 0 test.
- ❌ FE admin coupon screen — 0 test (project không có Vitest setup mạnh).
- ❌ Web FE cart coupon UI — 0 test.

### Lệnh chạy test (không thực thi được trong session này)

Đã thử kiểm tra Java toolchain:

```
PS> & 'C:\Program Files\Common Files\Oracle\Java\javapath\java.exe' -version
→ exit 9 (Oracle javapath broken; JDK config dùng A:\jdk17 nhưng PATH không trỏ tới)
PS> & 'A:\jdk17\bin\java.exe' -version
→ java 17.0.12 OK
```

Lệnh đề xuất chạy lại trong CI:

```bash
cd bigbike-backend
./mvnw -DfailIfNoTests=false -Dtest='Phase1JAdminSettingsMenuCouponApiTest' test
./mvnw -DfailIfNoTests=false -Dtest='Phase1BSchemaTest#coupon_saveAndFind' test
./mvnw -DfailIfNoTests=false -Dtest='Phase2CWordPressCustomerOrderCouponDryRunImporterTest' test
```

**Cần Postgres test container** (Spring Boot test với DataSource thật). Trong audit này: **KHÔNG VERIFY ĐƯỢC RUNTIME** vì Postgres + maven build chain không khả dụng từ shell hiện tại; coverage assertion dựa trên đọc code static only.

### Tests nên bổ sung (priority)

1. (P0) `CheckoutService` revalidate coupon test — 6 case: inactive / archived / expired / startsAt-future / over-limit / subtotal<min.
2. (P0) Race usageLimit 2 checkout đồng thời — `@Sql` setup `usage_limit=1`, 2 thread `CompletableFuture` checkout cart khác nhau, expect 1 success + 1 fail (`ConflictException` hoặc HTTP 409).
3. (P0) Update coupon FIXED→PERCENT không gửi amount → expect 400 hoặc auto-reset amount.
4. (P1) `applyCoupon` race với 2 codes khác nhau cùng cart concurrent.
5. (P1) Idempotency-Key checkout với coupon retry → `usage_count` chỉ +1.
6. (P1) `refreshCartTotals` removes/keeps coupon các trường hợp.
7. (P1) Scheduler `expireOverdueCoupons` flips ACTIVE+expired→EXPIRED.
8. (P2) MergeGuestCart preserves coupon (or explicitly drops it consistently).
9. (P2) Admin/Customer order detail returns/displays applied coupons.

---

## 10. Findings

### P0 Blockers

#### P0-COUPON-01 — Checkout không revalidate coupon

- **Title**: Checkout copy nguyên `cart_coupons.discount_amount` mà không re-validate status/expires/usageLimit/minimumAmount của coupon source
- **Evidence**:
  - [CheckoutService.java:177-179](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java#L177-L179) — chỉ gọi `cartCalculator.recalculateCart` (sum-only).
  - [CheckoutService.java:232-248](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java#L232-L248) — snapshot + increment, không re-check.
- **Impact**: Coupon admin đã disable (INACTIVE/ARCHIVED), hết hạn, hoặc đã đạt usageLimit vẫn được áp dụng vào order mới; doanh nghiệp mất tiền.
- **Repro**:
  1. Admin tạo coupon `SALE10` ACTIVE.
  2. Customer apply `SALE10` vào cart.
  3. Admin set status=INACTIVE.
  4. Customer POST `/api/v1/checkout` → order tạo với discount đã apply, `couponRepo.incrementUsageCount` được gọi cho coupon INACTIVE.
- **Fix**: Trong `CheckoutService.checkoutFromCart`, sau `cartCouponRepo.findByCartId(...)` thêm vòng lặp re-validate gọi cùng helper với `CartService.applyCoupon` (status=ACTIVE, startsAt≤now<expiresAt, usage_count<usage_limit, subtotal≥minAmount). Nếu fail → 409 với message rõ ràng.
- **Tests cần thêm**: 6 tests như mục §9 #1.

#### P0-COUPON-02 — usageLimit không atomic

- **Title**: `incrementUsageCount` UPDATE không có guard `usage_count < usage_limit` → race condition
- **Evidence**:
  - [CouponJpaRepository.java:31-34](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/coupon/CouponJpaRepository.java#L31-L34) — `UPDATE c SET c.usageCount = c.usageCount + 1 WHERE c.id = :id` (không có WHERE limit).
  - Checkout không lock coupon. apply có lock nhưng tx ngắn và release; checkout TX riêng.
- **Impact**: Coupon `usage_limit=1` có thể bị nhiều order áp dụng đồng thời → vượt giới hạn doanh nghiệp đã thiết lập.
- **Repro**: 2 user A, B cùng apply coupon `LIMIT1` (limit=1, usage_count=0) vào 2 cart khác nhau. Lần lượt gọi POST `/checkout` đồng thời. Cả 2 thành công, `usage_count=2`.
- **Fix**:
  - Đổi query → `UPDATE coupons SET usage_count = usage_count + 1, updated_at = :now WHERE id = :id AND (usage_limit IS NULL OR usage_count < usage_limit)` rồi đọc rows-affected. Nếu 0 → throw conflict.
  - Hoặc lấy pessimistic lock trong checkout: `couponRepo.findByIdForUpdate` trước increment.
- **Tests**: Race test 2-thread CompletableFuture với truncate-table fixture.

#### P0-COUPON-03 — Update FIXED→PERCENT không validate effective amount

- **Title**: Partial PATCH change `discountType` không kéo theo re-validate `amount` ngược với type mới
- **Evidence**:
  - [AdminCouponService.updateCoupon](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCouponService.java#L139-L217). Block 156-164 set new type, block 166-169 chỉ run `validateAmount` khi `req.amount != null`. Không có lệnh `validateAmount(entity.getAmount(), type)` sau khi đổi type.
- **Impact**: Coupon FIXED 200 000đ chuyển thành PERCENT giữ amount=200 000 → coupon "PERCENT 200 000%" → discount = subtotal (cap ở computeDiscount) → đơn hàng miễn phí khi áp dụng.
- **Repro**:
  ```
  POST /api/v1/admin/coupons {"code":"X","name":"X","discountType":"FIXED","amount":200000}
  PATCH /api/v1/admin/coupons/{id} {"discountType":"PERCENT"}
  → coupon stored: discountType=PERCENT, amount=200000
  ```
- **Fix**: Sau khi set type mới, luôn gọi `validateAmount(entity.getAmount(), type)` regardless of `req.amount` null.
- **Tests**: Update partial test PERCENT amount>100.

### P1 High

#### P1-COUPON-04 — One-coupon-per-cart không enforce ở DB

- **Evidence**: [CartService.java:243-246](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L243-L246) — service-level `if (!existing.isEmpty()) throw`. DB [V20](bigbike-backend/src/main/resources/db/migration/V20__add_coupon_cart_gender_shipping_threshold.sql) chỉ `unique(cart_id, coupon_code)`.
- **Impact**: Race condition 2 request POST `/cart/coupons` với code khác nhau song song có thể tạo 2 dòng cart_coupons cho cùng cart.
- **Repro**: 2 thread submit `{code:"A"}` và `{code:"B"}` cùng cart đồng thời.
- **Fix**: Migration thêm `CREATE UNIQUE INDEX uq_cart_coupons_cart_id ON cart_coupons(cart_id)` (assumes single-coupon policy permanent).
- **Tests**: Race test concurrent applyCoupon.

#### P1-COUPON-05 — Test coverage cart/checkout/scheduler/race ≈ 0

- **Evidence**: §9 — Phase1ECartApiTest không cover coupon, Phase1FCheckoutApiTest không cover coupon, không có CouponExpirySchedulerTest.
- **Impact**: Mọi P0 trên đều có thể regression mà không bị catch.
- **Fix**: Bổ sung test theo list §9.

#### P1-COUPON-06 — Permission inconsistency SHOP_MANAGER

- **Evidence**: SHOP_MANAGER có `coupons.read/write` ở [AdminRolePermissions.java:41](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminRolePermissions.java#L41) và [V49](bigbike-backend/src/main/resources/db/migration/V49__create_roles_permissions_tables.sql) line 110-111. Nhưng [SecurityConfig.java:105](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java#L105) `hasRole("ADMIN")` block.
- **Impact**: Doanh nghiệp expects SHOP_MANAGER quản lý coupon nhưng bị 403. Hoặc spec sai. Cần align.
- **Fix**: Quyết định business: nếu SHOP_MANAGER được quản coupon → SecurityConfig đặc cách `/api/v1/admin/coupons/**` cho `ADMIN/SUPER_ADMIN/SHOP_MANAGER`. Nếu không → xóa grant ở AdminRolePermissions + V49 (cần migration mới).
- **Tests**: Test SHOP_MANAGER token call coupon CRUD → expect 200 hoặc 403 theo decision.

#### P1-COUPON — Cart edge: subtotal sụt dưới minAmount sau apply, coupon không tự bỏ

- **Evidence**: [CartService.refreshCartTotals](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L339-L349) — chỉ check status/expired/over-limit, **thiếu** check `subtotal < coupon.minAmount`.
- **Impact**: Customer apply 100k coupon (min=500k), subtotal=600k. Sau đó remove items → subtotal=300k. Coupon vẫn áp dụng giảm 100k → tổng 200k mặc dù chưa đạt min.
- **Fix**: Thêm `if (coupon.getMinAmount() != null && subtotal.compareTo(coupon.getMinAmount()) < 0) toRemove.add(cc);`
- **Tests**: Cart adjust qty edge case.

#### P1 — getOrCreateGuestCart không filter status (out-of-coupon-scope nhưng phát hiện)

- **Evidence**: [CartService.java:78-91](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/cart/CartService.java#L78-L91) — `findBySessionId(guestId)` trả về cart bất kể status.
- **Impact**: Sau checkout (cart=CONVERTED), reload trang `/gio-hang` → cart cũ hiển thị, tiếp tục modify cart đã CONVERTED.
- **Note**: Out of strict coupon scope; nhưng tương tác với coupon sẽ làm cart_coupons hiện trên giao diện sai.

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

### Verdict: **NOT_READY**

### Điều kiện chuyển READY (Definition of Ready):

**Bắt buộc (P0)**:

- [ ] P0-COUPON-01 fixed: checkout revalidate coupon (status / startsAt / expiresAt / usageLimit / subtotal≥minAmount). Test integration coverage 6 case.
- [ ] P0-COUPON-02 fixed: `incrementUsageCount` đổi sang conditional UPDATE + xử lý 0-row-affected. Test concurrent 2-thread.
- [ ] P0-COUPON-03 fixed: Update partial luôn re-validate effective amount sau khi đổi type. Test PERCENT amount>100 partial.
- [ ] CI green với 3 test groups: AdminCoupon (đã có), CartCoupon (mới), CheckoutCoupon (mới).

**Khuyến cáo (P1) — đừng release rộng nếu chưa fix**:

- [ ] P1-COUPON-04: Add unique index `cart_coupons(cart_id)` (sau khi cleanup duplicate nếu có).
- [ ] P1-COUPON-05: Tests bổ sung cho cart apply/remove/refreshCartTotals + scheduler.
- [ ] P1-COUPON-06: Quyết định + align SHOP_MANAGER permission (Security URL config vs role grant).
- [ ] P1: refreshCartTotals re-check minAmount.

**Có thể release rồi fix sau (P2/P3) — track trong backlog**:

- P2-07/08: hiển thị coupon trên admin/customer order detail.
- P2-09: merge guest cart preserve coupon.
- P2-10: expose full BE fields trên UI admin.
- P2-11/12: DB constraint cleanup.
- P3-13: WP importer validation hardening.

### % hoàn thiện ước lượng

| Layer | % | Ghi chú |
|---|---|---|
| BE Admin CRUD | 85% | Có audit log, validation tương đối đầy đủ; thiếu update partial validate (P0-03) |
| BE Cart apply/remove | 70% | Có lock, có recompute; thiếu re-check minAmount khi cart change |
| BE Checkout | 30% | Snapshot OK, idempotency OK; **không revalidate**, **race usageLimit** |
| BE Scheduler | 90% | Hoạt động, có log; thiếu test |
| DB schema | 60% | Thiếu CHECK / unique cart_id / fix nullable name |
| Admin FE | 60% | Cơ bản OK; thiếu nhiều field, không hiển thị order coupon |
| Web FE | 75% | Cart UI OK; checkout chỉ list code, order detail không có |
| Permission | 70% | URL+permission OK cho ADMIN; SHOP_MANAGER inconsistent |
| WP importer | 70% | Chạy được nhưng có thể nhập dữ liệu vi phạm runtime |
| Test | 25% | Admin CRUD có; cart/checkout/scheduler/race gần 0 |
| **Tổng** | **~55%** | |

---

*End of audit — 2026-05-06*
