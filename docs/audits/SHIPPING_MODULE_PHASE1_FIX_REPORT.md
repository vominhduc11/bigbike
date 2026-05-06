# Shipping Module — Phase 1 Fix Report

**Date:** 2026-05-06  
**Scope:** Foundation hardening for manual (no-carrier) shipping operation. No carrier integration (GHN/GHTK/ViettelPost).

---

## 1. Summary of Changes

| # | Layer | File | Change |
|---|-------|------|--------|
| 1 | Backend DTO | `api/admin/dto/shipping/CreateShippingZoneRequest.java` | New — typed record with `@NotBlank @Size` on `name`, `@Size` on `regionCode` |
| 2 | Backend DTO | `api/admin/dto/shipping/CreateShippingMethodRequest.java` | New — typed record with `@NotBlank @Pattern` on `methodCode`, `@NotBlank` on `title`, `@DecimalMin("0")` on cost/minOrderAmount/freeShippingThreshold |
| 3 | Backend Controller | `api/admin/AdminShippingController.java` | POST /zones and POST /zones/{id}/methods now use `@Valid` typed DTOs; PATCH endpoints use `JsonNode` for presence tracking |
| 4 | Backend Service | `service/admin/AdminShippingService.java` | `createZone`/`createMethod` accept typed DTOs; `updateZone`/`updateMethod` accept `JsonNode` with field-level presence checking and non-negative enforcement; supports clearing `regionCode`, `description`, `freeShippingThreshold` by sending `null` explicitly |
| 5 | Backend Service | `service/checkout/CheckoutService.java` | `resolveShippingCost()` now enforces `minOrderAmount` — throws `ValidationException(field=shippingMethodId, code=MIN_ORDER_AMOUNT_NOT_MET)` when `orderSubtotal < method.minOrderAmount` |
| 6 | DB Migration | `db/migration/V68__shipping_check_constraints.sql` | Check constraints: `cost >= 0`, `min_order_amount >= 0`, `free_shipping_threshold >= 0`; unique index `(zone_id, method_code)` |
| 7 | Admin FE | `bigbike-admin/src/screens/ShippingScreen.jsx` | JS validation: methodCode pattern `[a-z0-9_-]+`, cost/minOrderAmount/freeShippingThreshold >= 0; sends `null` (not `undefined`) for clearable fields to enable server-side clearing |
| 8 | Web FE | `bigbike-web/app/thanh-toan/page.tsx` | Order summary now shows `selectedShipping.cost` (method cost from options API) instead of `cart.totals.shippingAmount` (always 0); running total updated accordingly |
| 9 | Web FE | `bigbike-web/lib/api/client-api.ts` | `submitQuickBuy` now accepts optional `idempotencyKey` parameter and forwards as `Idempotency-Key` header |
| 10 | Web FE | `bigbike-web/components/catalog/QuickBuyModal.tsx` | Generates `crypto.randomUUID()` per modal instance; passes to `submitQuickBuy` |
| 11 | Mobile | `bigbike_mobile/pubspec.yaml` | Added `uuid: ^4.5.1` dependency |
| 12 | Mobile | `bigbike_mobile/lib/core/api/api_client.dart` | `post()` accepts optional `extraHeaders: Map<String,String>?`; merges into Dio `Options` |
| 13 | Mobile | `bigbike_mobile/lib/features/checkout/checkout_screen.dart` | Generates `Uuid().v4()` in `initState`; sends as `Idempotency-Key` header on checkout POST |
| 14 | Test | `test/api/AdminShippingApiTest.java` | New — 27 test cases: permission guards, zone CRUD, method CRUD, validation 400s |
| 15 | Test | `test/api/Phase1FCheckoutApiTest.java` | Extended — 3 new tests: `minOrderAmount` enforcement, `freeShippingThreshold` application, `OrderShippingItem` snapshot correctness |

---

## 2. Bug Fixes

### BUG-SHIP-001: `AdminShippingController` accepted invalid payloads
- **Before:** `@RequestBody Map<String,Object>` — no validation; `{"name":"","cost":-9999}` was accepted silently.
- **After:** POST uses `@Valid` typed DTOs with Bean Validation. Invalid payload → `400 VALIDATION_ERROR` via existing `GlobalExceptionHandler`.

### BUG-SHIP-002: `AdminShippingService.updateZone/updateMethod` could not clear optional fields
- **Before:** `if (regionCode != null) entity.setRegionCode(regionCode)` — sending `{"regionCode": null}` in JSON was indistinguishable from field-absent, so clearing was impossible.
- **After:** PATCH methods accept `JsonNode`; `body.has("field")` distinguishes absent from present; `body.get("field").isNull()` detects explicit null → clear.

### BUG-SHIP-003: `CheckoutService.resolveShippingCost` ignored `minOrderAmount`
- **Before:** Method had `minOrderAmount` column in DB and entity, but checkout never enforced it. Admin could set it; customer would never be blocked.
- **After:** If `orderSubtotal < method.minOrderAmount`, throws `ValidationException(field=shippingMethodId, code=MIN_ORDER_AMOUNT_NOT_MET, status=400)`.

### BUG-SHIP-004: Checkout order summary showed wrong shipping cost
- **Before:** `cart.totals.shippingAmount` is always `0` at checkout time (cart does not compute shipping). User saw 0 even when a paid shipping method was selected.
- **After:** Uses `selectedShipping.cost` from `checkoutOptions?.shippingMethods` (the selected method's declared cost). Running total includes the shipping cost.

### BUG-SHIP-005: `submitQuickBuy` missing `Idempotency-Key` header
- **Before:** Only `submitCheckout` sent the header. `submitQuickBuy` had no protection against duplicate submits.
- **After:** Web FE and Mobile both generate a UUID per checkout session and send `Idempotency-Key` header on quick-buy requests.

---

## 3. DB Migration Detail

**V68__shipping_check_constraints.sql**

```sql
alter table shipping_methods
    add constraint chk_shipping_methods_cost_non_negative
        check (cost is null or cost >= 0);

alter table shipping_methods
    add constraint chk_shipping_methods_min_order_amount_non_negative
        check (min_order_amount is null or min_order_amount >= 0);

alter table shipping_methods
    add constraint chk_shipping_methods_free_shipping_threshold_non_negative
        check (free_shipping_threshold is null or free_shipping_threshold >= 0);

create unique index if not exists uidx_shipping_methods_zone_method_code
    on shipping_methods (zone_id, method_code);
```

Seed data compatibility verified: `cod` and `flat_rate` both belong to zone `000...0301` with distinct method codes — no unique constraint conflict.

---

## 4. API Contract — PATCH Clearing Behavior

For `PATCH /api/v1/admin/shipping/zones/{id}` and `PATCH /api/v1/admin/shipping/zones/{zoneId}/methods/{methodId}`:

| Field | Absent in JSON | Present, non-null | Present, `null` |
|-------|---------------|-------------------|-----------------|
| `name` / `title` / `methodCode` | no change | update (validated) | 400 NOT_BLANK |
| `regionCode` / `description` | no change | update | clear to `null` |
| `freeShippingThreshold` | no change | update (validated ≥ 0) | clear to `null` (disables threshold) |
| `cost` / `minOrderAmount` | no change | update (validated ≥ 0) | reset to `0` |
| `sortOrder` / `enabled` | no change | update | no change (ignored) |

---

## 5. Remaining Known Gaps (Out of Phase 1 Scope)

| Gap | Notes |
|-----|-------|
| Carrier integration (GHN/GHTK/ViettelPost) | Explicitly excluded from Phase 1 |
| `FulfillmentStatus` transitions | Dead code — no transitions implemented; flagged in `DOCS_VERIFICATION_REPORT.md` Section 3 |
| Zone-scoped shipping method lookup in checkout | `CheckoutService.resolveShippingMethod` uses global enabled pool, not zone-filtered. Acceptable for current single-zone deployment. |
| Admin FE API error detail display | API returns `error.details[].message` on 400; admin FE shows `e.message` (top-level). Field-level errors not surfaced in UI. |
| Mobile quick-buy idempotency | No mobile quick-buy screen currently exists; not applicable. |
