# Testing Guide

## Local Commands

| App | Commands from repo config | Status | Evidence |
|---|---|---|---|
| `bigbike-web` | `npm run lint`, `npm run test`, `npm run build` | `CONFIRMED_FROM_CONFIG` | `bigbike-web/package.json` |
| `bigbike-admin` | `npm run lint`, `npm run build` | `CONFIRMED_FROM_CONFIG` | `bigbike-admin/package.json` |
| `bigbike-backend` | `./mvnw test`, `./mvnw package` | `CONFIRMED_FROM_CONFIG` | `bigbike-backend/pom.xml` |
| `bigbike_mobile` | `flutter test` available through Flutter toolchain | `CONFIRMED_FROM_CONFIG` | `pubspec.yaml` |

## CI Truth

GitHub Actions currently runs:

| Job | What CI actually does | Status | Evidence |
|---|---|---|---|
| backend | `./mvnw -B clean verify` and Docker build | `CONFIRMED_FROM_CONFIG` | `.github/workflows/ci.yml` |
| web | `npm ci`, `npm run lint`, `npm run build`, Docker build | `CONFIRMED_FROM_CONFIG` | `.github/workflows/ci.yml` |
| admin | `npm ci`, `npm run lint`, `npm run build`, Docker build | `CONFIRMED_FROM_CONFIG` | `.github/workflows/ci.yml` |
| mobile | no CI job | `NOT_FOUND_IN_REPO` | `.github/workflows/ci.yml` |

## Confirmed Backend Feature Tests

| Feature | Confirmed test suite | Status |
|---|---|---|
| Cart | `Phase1ECartApiTest.java` | `CONFIRMED_FROM_TEST` |
| Checkout | `Phase1FCheckoutApiTest.java` | `CONFIRMED_FROM_TEST` |
| Coupons/settings/menus | `Phase1JAdminSettingsMenuCouponApiTest.java` | `CONFIRMED_FROM_TEST` |
| Returns | `Phase1LReturnsApiTest.java` | `CONFIRMED_FROM_TEST` |
| POS | `Phase1MPosApiTest.java` | `CONFIRMED_FROM_TEST` |
| Media hardening | `AdminMediaP0Test.java` | `CONFIRMED_FROM_TEST` |

## Current Testing Gaps

| Gap | Status | Evidence |
|---|---|---|
| Admin repo has no dedicated `test` script in `package.json`. | `CONFIRMED_FROM_CONFIG` | `bigbike-admin/package.json` |
| Web unit tests exist locally but are not run in CI. | `CONFIRMED_FROM_CONFIG` | `bigbike-web/package.json`, `.github/workflows/ci.yml` |
| Mobile tests are not wired into CI. | `NOT_FOUND_IN_REPO` | `.github/workflows/ci.yml` |
