# Phase 1I — Admin Customer / Media / Redirect APIs

**Date:** 2026-04-21  
**Branch:** main  
**Tests:** 32 new (220 total, 0 failures)

---

## A. Summary

Implements three admin management domains missing from earlier phases:

- **Admin Customer API** — list/filter customers, view full detail with addresses and order summary, update basic info with uniqueness validation, update status (ACTIVE/DISABLED/PENDING/BLOCKED). Audit logged. Password hash never exposed.
- **Admin Media API** — list/filter media files, view full detail (storageProvider name exposed, bucket/secret never), update metadata (altText/title/caption/status), logical delete (status = DELETED). Audit logged. No binary upload in this phase.
- **Admin Redirect API** — list/filter redirects, view detail, create with self-loop prevention and duplicate enabled source detection, update, toggle enabled flag, logical delete (enabled=false). Audit logged.

All three domains are needed for:
- Admin frontend showing customer CRM, media library, and redirect management
- WordPress migration layer (customers/media/redirects will be bulk-imported from WP data)

---

## B. Files Changed

### New — DTOs (`api/admin/dto/`)
| File | Description |
|------|-------------|
| `customer/AdminCustomerListItemResponse.java` | Paginated list item with orderCount + totalSpent |
| `customer/AdminCustomerDetailResponse.java` | Full customer profile with addresses + order summary |
| `customer/AdminCustomerAddressResponse.java` | Address record |
| `customer/AdminCustomerOrderSummaryResponse.java` | orderCount, totalSpent, latestOrders (max 5) |
| `customer/UpdateCustomerRequest.java` | email, phone, displayName, firstName, lastName |
| `customer/UpdateCustomerStatusRequest.java` | status, reason |
| `media/AdminMediaListItemResponse.java` | List item (no bucket/secret) |
| `media/AdminMediaDetailResponse.java` | Full detail (storageProvider name, no bucket) |
| `media/UpdateMediaRequest.java` | altText, title, caption, status |
| `redirect/AdminRedirectListItemResponse.java` | List item with hitCount |
| `redirect/AdminRedirectDetailResponse.java` | Full detail including notes |
| `redirect/CreateRedirectRequest.java` | sourcePattern, targetUrl, statusCode, enabled, notes |
| `redirect/UpdateRedirectRequest.java` | Partial update (all fields optional) |
| `redirect/UpdateRedirectEnabledRequest.java` | Single `enabled` boolean |

### New — Services (`service/admin/`)
| File | Description |
|------|-------------|
| `AdminCustomerService.java` | List/detail/update/status + audit |
| `AdminMediaService.java` | List/detail/update/delete + audit |
| `AdminRedirectService.java` | List/detail/create/update/enabled/delete + audit |

### New — Controllers (`api/admin/`)
| File | Description |
|------|-------------|
| `AdminCustomerController.java` | 4 endpoints |
| `AdminMediaController.java` | 4 endpoints |
| `AdminRedirectController.java` | 6 endpoints |

### Updated
| File | Change |
|------|--------|
| `service/auth/DevAdminAuthService.java` | Added 6 permissions: customers.read/write, media.read/write, redirects.read/write |

### New — Tests
| File | Tests |
|------|-------|
| `api/Phase1IAdminManagementApiTest.java` | 32 tests |

---

## C. API Endpoints

### Admin Customer API

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/admin/customers` | `customers.read` | List with q/status/synthetic filters |
| GET | `/api/v1/admin/customers/{customerId}` | `customers.read` | Full detail (addresses + order summary) |
| PATCH | `/api/v1/admin/customers/{customerId}` | `customers.write` | Update email/phone/displayName/firstName/lastName |
| PATCH | `/api/v1/admin/customers/{customerId}/status` | `customers.write` | Update status with reason |

Query params for list: `page`, `size`, `q` (email/phone/displayName), `status`, `synthetic`

### Admin Media API

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/admin/media` | `media.read` | List with q/mimeType/status/storageProvider filters |
| GET | `/api/v1/admin/media/{mediaId}` | `media.read` | Full detail |
| PATCH | `/api/v1/admin/media/{mediaId}` | `media.write` | Update altText/title/caption/status |
| DELETE | `/api/v1/admin/media/{mediaId}` | `media.write` | Logical delete (status=DELETED), 204 response |

### Admin Redirect API

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/api/v1/admin/redirects` | `redirects.read` | List with q/enabled/statusCode filters |
| GET | `/api/v1/admin/redirects/{redirectId}` | `redirects.read` | Full detail |
| POST | `/api/v1/admin/redirects` | `redirects.write` | Create redirect |
| PATCH | `/api/v1/admin/redirects/{redirectId}` | `redirects.write` | Update redirect |
| PATCH | `/api/v1/admin/redirects/{redirectId}/enabled` | `redirects.write` | Toggle enabled |
| DELETE | `/api/v1/admin/redirects/{redirectId}` | `redirects.write` | Logical delete (enabled=false), 204 response |

---

## D. Validation / Business Rules

### Customer
- `email` uniqueness across all customers; case-folded to lowercase before storage
- `phone` uniqueness across all customers
- `status` must be one of: `ACTIVE`, `DISABLED`, `PENDING`, `BLOCKED`
- `passwordHash` never returned in any response
- `orderCount` and `totalSpent` computed from orders table at query time
- `latestOrders` capped at 5, sorted by `placedAt` descending

### Media
- `status` must be one of: `ACTIVE`, `INACTIVE`, `DELETED`
- Only `altText`, `title`, `caption`, `status` are updatable — file binary not touched
- Logical delete: sets `status = DELETED`; physical file not removed in this phase
- `bucket` field is never included in any response DTO (storage secret hygiene)
- `storageProvider` (e.g., `LOCAL`, `S3`) is included as it is needed for admin-fe display

### Redirect
- `statusCode` must be one of: `301`, `302`, `307`, `308`
- `sourcePattern == targetUrl` → 400 (self-loop prevention)
- When creating or updating with `enabled=true`: if another enabled redirect already exists with the same `sourcePattern` → 409 Conflict
- `redirectType` defaults to `EXACT` if not provided
- Logical delete: `enabled = false` (preserves history for analytics/migration)
- Duplicate active source check uses in-service query; no DB unique constraint on sourcePattern (DB allows multiple disabled entries)

---

## E. Audit Design

### Action Names
| Domain | Action |
|--------|--------|
| Customer | `CUSTOMER_UPDATED`, `CUSTOMER_STATUS_UPDATED` |
| Media | `MEDIA_UPDATED`, `MEDIA_DELETED` |
| Redirect | `REDIRECT_CREATED`, `REDIRECT_UPDATED`, `REDIRECT_ENABLED_UPDATED`, `REDIRECT_DELETED` |

### Actor Mapping
- `actorType = "ADMIN"`
- `actorId` from `AdminPrincipal.id()` if it is a valid UUID (JWT path)
- Falls back to `00000000-0000-0000-0000-000000000001` for dev bypass path (id is "dev-admin-user")

### Before/After Strategy
- Customer: compact JSON `{"email":"...","phone":"...","displayName":"...","status":"..."}`
- Media: compact JSON `{"altText":"...","title":"...","caption":"...","status":"..."}`
- Redirect: compact JSON `{"source":"...","target":"...","statusCode":301,"enabled":true}`
- Sensitive fields (passwordHash, bucket) never appear in before/after data

---

## F. Security Design

- All 14 endpoints are under `/api/v1/admin/**` which SecurityConfig already gates with `ROLE_ADMIN`
- JWT Bearer token required (production path) or `X-Admin-Role` dev header (test/dev bypass)
- No CustomerCsrfFilter applies to admin JWT API (CSRF filter only runs on customer cookie paths)
- No `permitAll()` for any of these endpoints
- Customer-facing APIs (cart, checkout, customer orders, public catalog) are unaffected
- Password hash and storage bucket field excluded from all response DTOs at mapping layer

---

## G. Tests Added

**Class:** `Phase1IAdminManagementApiTest` (32 tests)

| # | Test | Domain |
|---|------|--------|
| 1 | `adminCustomers_withoutToken_returns401` | Customer auth |
| 2 | `adminCustomers_withAdminToken_returnsList` | Customer list |
| 3 | `adminCustomers_searchByEmailWorks` | Customer search |
| 4 | `adminCustomerDetail_returnsAddressesAndOrderSummary` | Customer detail |
| 5 | `updateCustomer_updatesBasicInfo` | Customer update |
| 6 | `updateCustomer_duplicateEmail_returns409` | Customer uniqueness |
| 7 | `updateCustomerStatus_disablesCustomer` | Customer status |
| 8 | `customerMutation_writesAuditLog` | Customer audit |
| 9 | `adminMedia_withoutToken_returns401` | Media auth |
| 10 | `adminMedia_listWorks` | Media list |
| 11 | `adminMedia_filterByMimeTypeWorks` | Media filter |
| 12 | `adminMedia_detailWorks` | Media detail |
| 13 | `updateMedia_updatesAltTitleCaption` | Media update |
| 14 | `deleteMedia_marksDeleted` | Media logical delete |
| 15 | `mediaMutation_writesAuditLog` | Media audit |
| 16 | `adminRedirects_withoutToken_returns401` | Redirect auth |
| 17 | `adminRedirects_listWorks` | Redirect list |
| 18 | `createRedirect_validRequest_succeeds` | Redirect create |
| 19 | `createRedirect_invalidStatusCode_returns400` | Redirect validation |
| 20 | `createRedirect_selfLoop_returns400` | Redirect self-loop |
| 21 | `createRedirect_duplicateEnabledSource_returns409` | Redirect duplicate |
| 22 | `updateRedirect_updatesTarget` | Redirect update |
| 23 | `disableRedirect_setsEnabledFalse` | Redirect toggle |
| 24 | `deleteRedirect_disablesOrDeletes` | Redirect logical delete |
| 25 | `redirectMutation_writesAuditLog` | Redirect audit |
| 26 | `adminOrders_stillWork` | Regression |
| 27 | `customerOrders_stillProtected` | Regression |
| 28 | `guestOrderLookup_stillWorks` | Regression |
| 29 | `cartApi_stillWorks` | Regression |
| 30 | `checkoutApi_stillWorks` | Regression |
| 31 | `publicCatalog_stillPublic` | Regression |
| 32 | `customerMe_stillWorks` | Regression |

---

## H. Commands Executed

```
cd bigbike-backend
./mvnw test --no-transfer-progress
```

**Result: PASS — 220 tests, 0 failures, 0 errors**

| Test Class | Tests | Result |
|------------|-------|--------|
| AdminAuthApiTest | 10 | PASS |
| AdminAuthSecurityTest | 8 | PASS |
| AdminMutationApiTest | 4 | PASS |
| AdminReadApiTest | 5 | PASS |
| AuthProfileGuardTest | 1 | PASS |
| Phase1DCustomerAuthTest | 20 | PASS |
| Phase1ECartApiTest | 25 | PASS |
| Phase1FCheckoutApiTest | 26 | PASS |
| Phase1GOrderReadApiTest | 22 | PASS |
| Phase1HAdminOrderApiTest | 28 | PASS |
| **Phase1IAdminManagementApiTest** | **32** | **PASS** |
| PublicReadApiTest | 5 | PASS |
| BigbikeBackendApplicationTests | 1 | PASS |
| Phase1BSchemaTest | 12 | PASS |
| Phase1CCommerceSchemaTest | 17 | PASS |
| PasswordServiceTest | 4 | PASS |
| **TOTAL** | **220** | **PASS** |

---

## I. Remaining Risks

1. **Binary upload deferred** — `AdminMediaController` has no `POST /admin/media` upload endpoint. Physical file creation requires storage abstraction (S3/MinIO/local) not yet implemented.

2. **Redirect runtime middleware deferred** — The redirect table is populated but there is no middleware in the main web that reads it and issues actual HTTP redirects. Phase 3 (SEO/Legacy URL routing) will consume this data.

3. **Customer login disabled-status enforcement deferred** — `CustomerAuthService.login()` does not currently reject `DISABLED` customers. The admin can set status=DISABLED, but disabled customers can still authenticate until the auth service is updated. **Risk: medium.** Recommend adding status check in Phase 1J or as a hotfix.

4. **WordPress migration deferred** — Customers, media files, and redirects from the live WordPress site have not been imported. The import tooling is Phase 2.

5. **actorId fallback for dev path** — When using the dev bypass (X-Admin-Role header, no JWT), `actorId` falls back to a fixed UUID `00000000-0000-0000-0000-000000000001`. This is intentional and documented. Production path (JWT) always sets a real admin UUID.

---

## J. Recommended Next Tasks

1. **Phase 1J — Admin Settings / Menu / Coupon APIs**  
   Implement remaining admin domains: site settings (currency, timezone, company info), navigation menus, coupon/discount codes. Needed before frontend integration.

2. **Phase 1K — OpenAPI / Contract Generation + Backend API Documentation**  
   Generate OpenAPI 3.x spec from Spring annotations. Validate against frontend TS types. Required before frontend team can safely build against the API.

3. **Phase 2 — WordPress Migration Layer**  
   ETL pipeline: import customers, orders, media, redirects, products, articles from WordPress database export. Requires Phase 1A–1I to be stable.

4. **Phase 3 — Main Web Legacy URL / SEO Alignment**  
   Activate redirect middleware in Next.js routing layer, consuming the `redirects` table. Implement canonical URL logic and OpenGraph for product/article pages.

5. **Phase 4 — Frontend Integration**  
   Connect admin-fe and main web-fe to the stable backend API. Requires Phases 1A–1K to be complete.

---

## K. Safety Check

- ✅ Did not modify frontend (Next.js, React, admin-fe)
- ✅ Did not implement binary file upload
- ✅ Did not connect MinIO/S3 or any storage backend
- ✅ Did not import WordPress data
- ✅ Did not implement redirect middleware / main web routing
- ✅ Did not expose `passwordHash` in any response DTO
- ✅ Did not expose `bucket` (storage secret) in any response DTO
- ✅ Did not hardcode any secret or credentials
- ✅ Did not break Phase 1A–1H APIs (all 220 tests pass)
- ✅ Did not change Spring Boot or Java version
