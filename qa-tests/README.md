# BigBike QA — automated production-readiness tests

Test code only — **no production source is modified.** Expectations come from `docs/` (cited per test).

## What this covers
Two layers, focused on the 🔴 highest-risk areas of `PRODUCTION_TEST_CHECKLIST.md`:

1. **Live black-box** (`live/`, Node, no deps) — runs against the **running docker stack**
   (real PostgreSQL → authentic locking/concurrency). Covers items **8, 9, 11, 12, 14, 17, 18, L**.
2. **JUnit gap tests** (`bigbike-backend/src/test/java/com/bigbike/bigbike_backend/qa/`) — for things
   not observable on the live dev stack: the prod-profile auth fail-fast (item 18) and the
   email verify/reset link content (items 17/19). Run in an ephemeral `maven:3.9-eclipse-temurin-17`
   container (no local JDK needed).

## Prerequisites
- Docker stack UP: `docker compose up -d` (backend :8080, postgres :5432, web :3000, admin :4000, minio :9000).
- Node 18+ (global `fetch`). Docker (for the JUnit container + DB access via `docker exec`).
- Seeded admin `admin@bigbike.vn` / `admin123` (from `.env` `BIGBIKE_SEED_ADMIN_PASSWORD`).

## Run
```powershell
# Everything:
pwsh qa-tests/run-all.ps1

# Live suite only (all, or named suites):
node qa-tests/live/run.mjs
node qa-tests/live/run.mjs auth-permission config-env

# JUnit gap tests only:
docker run --rm -v "${PWD}/bigbike-backend:/build" -v bigbike_qa_m2:/root/.m2 -w /build `
  maven:3.9-eclipse-temurin-17 mvn -B -Dtest="com.bigbike.bigbike_backend.qa.*" test
```

## Notes / constraints
- `checkout` / `quick-buy` are rate-limited **5/min per IP** (Bucket4j). The commerce suites wait
  ~62s for a fresh bucket and spend ≤5 calls. `X-Forwarded-For` is **not** trusted from our origin.
- Live commerce tests create **isolated `qatest-*` fixtures** (cloned from a real published product)
  and **tear them down** at the end (`live/lib/fixtures.mjs#teardownQa`). They write a few test
  orders to the **dev** DB during the run; teardown removes the QA footprint.
- Existing backend integration tests under `src/test/.../api/` that use `@Sql(/db/test-seed.sql)`
  currently fail in a clean build (see TEST_REPORT — H2 seed drift). The `qa.*` tests avoid that seed.

See `../TEST_REPORT.md` for results mapped to every checklist item, bugs found, and manual gaps.
