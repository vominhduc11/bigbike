# Phase 1K – OpenAPI Contract Generation Report

**Date:** 2026-04-21
**Phase:** 1K — OpenAPI / Contract Generation + Backend API Documentation

---

## Summary

Phase 1K delivers a fully documented OpenAPI 3.0.3 specification for the entire BigBike backend API.
Because Spring Boot 4.0.5 uses Spring Framework 7.x, `springdoc-openapi 2.x` (which targets Spring Boot 3.x) was not added as a dependency to avoid compatibility risk.
Instead a **manual static JSON** approach is used: the spec is embedded as a classpath resource and served by a dedicated controller.

---

## Deliverables

| Artifact | Path |
|---|---|
| OpenAPI 3.0.3 spec (source) | `src/main/resources/openapi/bigbike-openapi.json` |
| OpenAPI 3.0.3 spec (docs copy) | `docs/openapi/bigbike-openapi.json` |
| Static controller | `src/main/java/.../api/openapi/OpenApiStaticController.java` |
| Contract tests | `src/test/java/.../api/Phase1KOpenApiContractTest.java` |

---

## Endpoint

`GET /v3/api-docs` — returns the full OpenAPI 3.0.3 JSON document.
Requires no authentication (added to `SecurityConfig` `permitAll` list).

---

## API Coverage

### Security Schemes

| Scheme | Type | Location |
|---|---|---|
| `AdminBearerAuth` | HTTP Bearer JWT | `Authorization` header |
| `CustomerSession` | API Key (cookie) | `bb_session` cookie |
| `CsrfHeader` | API Key (header) | `X-CSRF-Token` header |

### API Groups (Tags)

| # | Tag | Paths |
|---|---|---|
| 1 | Public Catalog | `/api/v1/products/**`, `/api/v1/categories/**`, `/api/v1/brands/**` |
| 2 | Public Content | `/api/v1/articles/**`, `/api/v1/pages/**` |
| 3 | Public Settings | `/api/v1/settings/public` |
| 4 | Public Menus | `/api/v1/menus/{location}` |
| 5 | Order Lookup | `/api/v1/orders/lookup` |
| 6 | Customer Auth | `/api/v1/customer/auth/**` |
| 7 | Customer Profile | `/api/v1/customer/me` |
| 8 | Cart | `/api/v1/cart`, `/api/v1/cart/**` |
| 9 | Checkout | `/api/v1/checkout`, `/api/v1/checkout/options`, `/api/v1/orders/quick-buy` |
| 10 | Customer Orders | `/api/v1/customer/orders/**` |
| 11 | Admin Auth | `/api/v1/auth/**` |
| 12 | Admin Catalog | `/api/v1/admin/products/**`, `/api/v1/admin/categories/**`, `/api/v1/admin/brands/**` |
| 13 | Admin Content | `/api/v1/admin/articles/**`, `/api/v1/admin/pages/**` |
| 14 | Admin Orders | `/api/v1/admin/orders/**` |
| 15 | Admin Customers | `/api/v1/admin/customers/**` |
| 16 | Admin Media | `/api/v1/admin/media/**` |
| 17 | Admin Redirects | `/api/v1/admin/redirects/**` |
| 18 | Admin Settings | `/api/v1/admin/settings/**` |
| 19 | Admin Menus | `/api/v1/admin/menus/**` |
| 20 | Admin Coupons | `/api/v1/admin/coupons/**` |

### Common Response Envelopes (Schemas)

| Schema | Fields |
|---|---|
| `ApiDataResponse` | `data`, `meta` |
| `ApiListResponse` | `data[]`, `pagination`, `meta` |
| `ApiErrorResponse` | `error`, `meta` |
| `ApiMeta` | `requestId`, `timestamp` |
| `PaginationMeta` | `page`, `pageSize`, `totalItems`, `totalPages`, `hasNext`, `hasPrevious` |
| `ApiError` | `code`, `message`, `details[]` |
| `ApiErrorDetail` | `field`, `code`, `message` |

---

## Security Notes

- `passwordHash` is **not** present anywhere in the spec — confirmed by test.
- Storage bucket/secret fields are **not** present in any schema — confirmed by test.
- All admin endpoints declare `AdminBearerAuth` security requirement.
- Cart and checkout mutation endpoints declare `CsrfHeader` requirement.

---

## Test Results

**Test class:** `Phase1KOpenApiContractTest` — **12 tests, all passed**

| # | Test | Result |
|---|---|---|
| 1 | `openApiDocsEndpoint_availableInTestOrDev` | PASS |
| 2 | `openApi_containsAdminBearerSecurityScheme` | PASS |
| 3 | `openApi_containsCustomerSessionCookieScheme` | PASS |
| 4 | `openApi_containsCsrfHeader` | PASS |
| 5 | `openApi_containsCartEndpoints` | PASS |
| 6 | `openApi_containsCheckoutEndpoints` | PASS |
| 7 | `openApi_containsAdminOrderEndpoints` | PASS |
| 8 | `openApi_containsAdminCustomerMediaRedirectEndpoints` | PASS |
| 9 | `openApi_containsAdminSettingsMenuCouponEndpoints` | PASS |
| 10 | `openApi_doesNotExposePasswordHash` | PASS |
| 11 | `openApi_doesNotExposeStorageBucketSecret` | PASS |
| 12 | `openApi_responseIsValidJson` | PASS |

**Full suite:** 292 tests, 0 failures, 0 errors.

---

## Implementation Risk Note

**springdoc-openapi compatibility:** Spring Boot 4.0.5 ships Spring Framework 7.x.
`springdoc-openapi 2.x` officially supports Spring Boot 3.x (Spring Framework 6.x) and has no stable release for Spring Boot 4.x as of 2026-04-21.
Adding it would risk compile or runtime failures.
**Decision:** Use a static JSON file served by `OpenApiStaticController`. This approach is zero-risk and fully functional for contract validation, client generation, and documentation tooling (Swagger UI can consume a raw JSON URL).

If `springdoc-openapi 3.x` releases with Spring Boot 4.x support in the future, the migration path is:
1. Add dependency
2. Replace `OpenApiStaticController` with springdoc auto-configuration
3. Delete the static JSON (or keep as fallback)

---

## docker compose config

Validated: `docker compose config` completes without error.
