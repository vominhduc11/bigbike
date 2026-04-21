# Phase 1K.1 — Contract Hardening Sync Report

**Date:** 2026-04-21
**Phase:** 1K.1 — Contract Hardening Sync Before WordPress Migration

---

## A. Summary

Phase 1K.1 confirms and extends contract hardening across three API domains (Coupons, Menus, Settings) and keeps the static OpenAPI spec in sync with all behavior changes. No feature work outside scope was performed.

---

## B. Files Changed

| File | Change |
|---|---|
| `service/admin/AdminSettingsService.java` | Added `private_key` and `clientsecret` to `SENSITIVE_KEY_FRAGMENTS` |
| `src/main/resources/openapi/bigbike-openapi.json` | Updated admin settings PATCH description with full sensitive-fragment list |
| `docs/openapi/bigbike-openapi.json` | Synced with source |
| `test/api/Phase1K1ContractHardeningTest.java` | 10 new tests |

---

## C. Coupon Contract Changes

**Status:** No code changes required — already correct from Phase 1J.1.

Allowed statuses (all three mutation paths):
- `ACTIVE`
- `INACTIVE`
- `EXPIRED`
- `ARCHIVED`

Validation applied in:
- `createCoupon` — if `status` field is present in request
- `updateCoupon` — if `status` field is present in request
- `updateCouponStatus` — always

Unknown status → `400 VALIDATION_ERROR`.

OpenAPI schemas `CreateCouponRequest`, `UpdateCouponRequest`, `UpdateCouponStatusRequest` all enumerate `["ACTIVE","INACTIVE","EXPIRED","ARCHIVED"]`.

---

## D. Menu Validation / Cycle Prevention

**Status:** No code changes required — already correct from Phase 1J.1.

### Menu and item status

Allowed menu status: `ACTIVE | INACTIVE`
Allowed item status: `ACTIVE | INACTIVE`

Invalid status on create or update → `400 VALIDATION_ERROR`.

Public `GET /api/v1/menus/{location}`:
- Returns `404` if menu `status != ACTIVE`.
- Returns only `ACTIVE` items in the item list.

### Parent-cycle prevention

**Direct self-parent blocked**: `parentId == itemId` → 400.

**Deep cycle detection** (`validateNoDeepCycle`): Builds a parentMap including the proposed new link, then walks the chain from `parentId`. If we reach `itemId` during the walk, it is a cycle → 400.

**Reorder validation**:
1. Each item in the payload must belong to the target menu (else 400 WRONG_MENU).
2. Self-parent blocked.
3. Full graph cycle detection across all proposed parentId changes.
4. All validation runs before any `save` call — partial changes cannot be persisted.

**Partial-change safety**: `reorderItems` is `@Transactional`. All validation happens before the "Apply changes" section. A validation exception causes full rollback — no item is modified if the payload is invalid.

---

## E. Settings Sensitive-Key Hardening

### Change: two new fragments added

`SENSITIVE_KEY_FRAGMENTS` before:
```
secret, password, token, privatekey, api_key, apikey, accesskey, access_key, client_secret
```

`SENSITIVE_KEY_FRAGMENTS` after:
```
secret, password, token, privatekey, private_key,
api_key, apikey, accesskey, access_key,
client_secret, clientsecret
```

**Added:** `private_key` (necessary — `privatekey` did not match `private_key` keys), `clientsecret` (explicit alias, already caught by `secret` but listed for clarity).

### Rules unchanged

- Setting with a sensitive key **cannot** be set `isPublic=true` → `400`.
- Updating the **value** of a sensitive key (without touching `isPublic`) → `200` (allowed).
- Public endpoint `GET /api/v1/settings/public` only returns `isPublic=true` settings; private settings are never returned regardless of key name.

---

## F. OpenAPI Files Updated

### `src/main/resources/openapi/bigbike-openapi.json`

Changed admin settings `PATCH /api/v1/admin/settings/{settingKey}` description to reflect full sensitive-fragment list:

> Sensitive keys (containing secret/password/token/privatekey/private_key/api_key/apikey/accesskey/access_key/client_secret/clientsecret) cannot be set isPublic=true. Updating the value of a sensitive key is allowed as long as isPublic is not set to true.

All other schema enums were already correct:
- Coupon status: `["ACTIVE","INACTIVE","EXPIRED","ARCHIVED"]` ✓
- Menu status: `["ACTIVE","INACTIVE"]` ✓
- Menu item status: `["ACTIVE","INACTIVE"]` ✓

### `docs/openapi/bigbike-openapi.json`

Synced with source file (`cp` command).

---

## G. Tests Added / Updated

### New test class: `Phase1K1ContractHardeningTest.java` — 10 tests

| # | Test | Section |
|---|---|---|
| 1 | `reorderMenuItems_invalidGraph_doesNotPersistPartialChanges` | §3 Menu cycle |
| 2 | `updateSetting_privateKeyCannotBePublic` | §4 Settings |
| 3 | `updateSetting_clientsecretCannotBePublic` | §4 Settings |
| 4 | `updateSetting_privateSensitiveValueCanStillBeUpdated` | §4 Settings |
| 5 | `publicSettings_neverReturnsSensitivePrivateKeys` | §4 Settings |
| 6 | `openApiDocsEndpoint_stillWorks` | §5 OpenAPI |
| 7 | `openApi_couponStatusIncludesArchived` | §5 OpenAPI |
| 8 | `openApi_menuStatusDocumentsActiveInactive` | §5 OpenAPI |
| 9 | `openApi_stillDoesNotExposePasswordHash` | §5 OpenAPI |
| 10 | `openApi_stillDoesNotExposeStorageSecrets` | §5 OpenAPI |

### Pre-existing tests confirmed still passing (from Phase 1J/1K):

All 292 prior tests plus 10 new = **302 total**.

---

## H. Commands Executed

```
# From bigbike-backend/
./mvnw test
# Result: Tests run: 302, Failures: 0, Errors: 0, Skipped: 0 — BUILD SUCCESS

# From root
docker compose config
# Result: OK (no errors)
```

---

## I. Total Tests

| Class | Count |
|---|---|
| Phase1K1ContractHardeningTest (new) | 10 |
| Phase1KOpenApiContractTest | 12 |
| Phase1JAdminSettingsMenuCouponApiTest | 53 |
| All other prior tests | 227 |
| **Total** | **302** |

---

## J. Safety Check

- No test deleted or disabled.
- No frontend modified.
- No features outside scope implemented.
- No API signatures changed (only internal validation/set additions).
- Static OpenAPI JSON kept in sync between `src/main/resources/openapi/` and `docs/openapi/`.
- `docker compose config` passes with no errors.
