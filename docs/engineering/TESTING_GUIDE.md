# Testing Guide

## Local Commands

| App | Commands from repo config | Status | Evidence |
|---|---|---|---|
| `bigbike-web` | `npm run lint`, `npm run test`, `npm run build` | `CONFIRMED_FROM_CONFIG` | `bigbike-web/package.json` |
| `bigbike-admin` | `npm run lint`, `npm run build` | `CONFIRMED_FROM_CONFIG` | `bigbike-admin/package.json` |
| `bigbike-backend` | `./mvnw test`, `./mvnw package` | `CONFIRMED_FROM_CONFIG` | `bigbike-backend/pom.xml` |

## CI Truth

GitHub Actions currently runs:

| Job | What CI actually does | Status | Evidence |
|---|---|---|---|
| backend | `./mvnw -B clean verify` and Docker build | `CONFIRMED_FROM_CONFIG` | `.github/workflows/ci.yml` |
| web | `npm ci`, `npm run lint`, `npm run build`, Docker build | `CONFIRMED_FROM_CONFIG` | `.github/workflows/ci.yml` |
| admin | `npm ci`, `npm run lint`, `npm run build`, Docker build | `CONFIRMED_FROM_CONFIG` | `.github/workflows/ci.yml` |

## Confirmed Backend Feature Tests

| Feature | Confirmed test suite | Status |
|---|---|---|
| Cart | `Phase1ECartApiTest.java` | `CONFIRMED_FROM_TEST` |
| Checkout | `Phase1FCheckoutApiTest.java` | `CONFIRMED_FROM_TEST` |
| Settings/menus | `Phase1JAdminSettingsMenuCouponApiTest.java` | `CONFIRMED_FROM_TEST` |
| ~~POS~~ | Removed 2026-06-23 (online-only) — `Phase1MPosApiTest.java` deleted | `REMOVED` |
| Media hardening | `AdminMediaP0Test.java` | `CONFIRMED_FROM_TEST` |
| Redirect target integrity | `AdminRedirectApiTest.java` + web proxy redirect tests | `REQUIRED_FOR_REDIRECT_RULE_011_012` |
| Trợ lý BigBike — V1041 | API/service tests cho 12/20 lượt, lead sequence/viewed/terminal/idempotency, action attribution, article locale/sanitization, settings validation và stats tháng | `REQUIRED_FOR_CHAT_RULE_009_012_029_032` |

## Trợ lý BigBike — ma trận kiểm thử V1041

- Backend: lời mời 1/2, viewed/ignored/declined/accepted, request đồng thời và idempotency; trigger size/tồn kho đúng một mẫu hoặc add cart; không trigger câu chung/nhiều mẫu.
- Backend: trang thường 12 lượt, PDP hợp lệ 20 lượt, slug giả, rời PDP sau lượt 12 và conversation đã đóng; action → response/card → cart → checkout; interaction giả mạo bị bỏ.
- Backend: `resultKind`/quality, funnel, action stats, monthly USD; article chỉ `PUBLISHED`, đúng locale, tối đa 3 và lọc dữ kiện động/prompt injection; alias/template validate trùng, va chạm, locale và safety.
- Web/admin: lead tự hiện/sequence 2/consent/decline/snapshot cũ; pageContext đúng route; action retry idempotent và nguồn cart; editor/cảnh báo/stats đủ loading, empty, error, saving, success, read-only.
- E2E dữ liệu cô lập: tìm hàng → lead 1 → bỏ qua → hỏi size/tồn kho → lead 2; click action → card → cart → checkout → admin attribution; PDP 20 lượt và route thường 12 lượt.
- Bộ 36 câu dùng AI thật ghi `Not run` khi local thiếu khoá; không dùng lượt trả phí để thay bằng dữ liệu giả.

## Current Testing Gaps

| Gap | Status | Evidence |
|---|---|---|
| Admin repo has no dedicated `test` script in `package.json`. | `CONFIRMED_FROM_CONFIG` | `bigbike-admin/package.json` |
| Web unit tests exist locally but are not run in CI. | `CONFIRMED_FROM_CONFIG` | `bigbike-web/package.json`, `.github/workflows/ci.yml` |
| Live redirect quality | Two sequential scans of the 241-row owner URL list, 0.5s/request/pass; the live scan is evidence, not a unit-test substitute. | `REQUIRED_FOR_AUDIT_2026-08-14` |
