# Phase 2D.1 — Staging Import Rehearsal Report

**Date:** 2026-04-22
**Status:** Safety gates implemented and tested. Real rehearsal blocked by Docker not running.
**Production import:** NO — not executed.

---

## A. Summary

| Item | Result |
|---|---|
| DB used for rehearsal | H2 in-memory (test profile) — fixture tests only |
| Real dump rehearsal | BLOCKED — Docker Desktop not running, Postgres unavailable at localhost:5432 |
| Production import | NO |
| Test suite | 454/454 PASS (20 new Phase2D1 tests, 434 regression) |

New safety gates added to `WordPressMigrationImportRunner`:

- **Guard 5 (new):** `bigbike.migration.wordpress.environment` must be `local` or `staging`
- **Guard 6 (new):** DB URL must not contain production-like substrings (`bigbike.vn`, `prod`, `production`, `rds.amazonaws`, `cloudsql`, `db.render.com`, `railway.app`)

All six guards must pass before any DB write occurs.

---

## B. Commands Executed

### Write-plan command (attempted, blocked by no Postgres)
```bash
./mvnw spring-boot:run \
  -Dspring-boot.run.arguments="\
    --spring.profiles.active=dev \
    --bigbike.migration.wordpress.enabled=true \
    --bigbike.migration.wordpress.dry-run=true \
    --bigbike.migration.wordpress.dump-path=../bigbike_vn__2026_04_17/sqldump.sql \
    --bigbike.migration.wordpress.mode=write-plan"
```
Result: `Connection to localhost:5432 refused` — Docker Desktop was not running.

### Import first run (NOT executed — Postgres unavailable)
```bash
./mvnw spring-boot:run \
  -Dspring-boot.run.arguments="\
    --spring.profiles.active=dev \
    --bigbike.migration.wordpress.enabled=true \
    --bigbike.migration.wordpress.dry-run=false \
    --bigbike.migration.wordpress.confirm-execute=true \
    --bigbike.migration.wordpress.environment=local \
    --bigbike.migration.wordpress.dump-path=../bigbike_vn__2026_04_17/sqldump.sql \
    --bigbike.migration.wordpress.mode=import \
    --bigbike.migration.wordpress.domains=all"
```

### Import second run (NOT executed)
Same command as above — idempotency to be verified when Postgres is available.

### Test suite
```bash
cd bigbike-backend && ./mvnw test
```
Result: **454 tests, 0 failures, 0 errors, 0 skipped**

---

## C. Import Counts (from Phase 2B + 2C dry-run calibration — real dump)

Counts from Phase2B1RealDumpDryRunCalibrationTest (10 tests, all passing with real dump):

| Domain | Source rows | Mapped | Skipped/Deferred |
|---|---|---|---|
| categories | ~50 | ~50 | ~0 |
| brands | ~45 | ~45 | ~0 |
| media | ~12,054+ | ~12,054 | ~0 |
| pages | known count | mapped | skipped |
| articles | known count | mapped | skipped |
| redirects (RankMath) | ~40 | ~40 | ~0 |
| menus | counted | mapped | skipped |
| menu_items | counted | mapped | skipped |
| products | mapped | ~mapped | 77 skipped |
| product_variations | counted | mapped | deferred |
| product_tags | ~2,895 | — | DEFERRED (no target schema) |
| customers (wp_users) | counted | mapped | excluded privileged |
| customer_addresses | derived from customers | mapped | — |
| synthetic guest customers | from orders | mapped | skipped |
| coupons | counted | mapped | skipped |
| orders | counted | mapped | skipped |
| order_line_items | counted | mapped | skipped |
| order_shipping_items | counted | mapped | skipped |
| order_fee_items | counted | mapped | skipped |
| order_addresses | 2× orders | mapped | — |
| payments | = orders | mapped | — |
| FG redirects | 19,516 | — | DEFERRED (no new_url column) |

First/second run counts: **NOT COLLECTED** — Postgres unavailable.

---

## D. Idempotency Verification

### Fixture tests (H2, pass):
- `fixtureRehearsal_secondImportDoesNotDuplicateRows` — category count after run 2 equals count after run 1 ✓
- `fixtureRehearsal_firstImportCreatesRows` — inserted ≥ 1 ✓

### Real dump idempotency:
**NOT VERIFIED** — requires Postgres running. Run these checks manually:

```sql
-- After first import
SELECT COUNT(*) FROM categories;     -- record N1
SELECT COUNT(*) FROM orders;         -- record M1

-- Run import again (same command)
-- After second import
SELECT COUNT(*) FROM categories;     -- must equal N1
SELECT COUNT(*) FROM orders;         -- must equal M1

-- Duplicate checks
SELECT slug, COUNT(*) FROM categories GROUP BY slug HAVING COUNT(*) > 1;
SELECT order_number, COUNT(*) FROM orders GROUP BY order_number HAVING COUNT(*) > 1;
SELECT source_pattern, COUNT(*) FROM redirects WHERE enabled=true
  GROUP BY source_pattern HAVING COUNT(*) > 1;
SELECT code, COUNT(*) FROM coupons GROUP BY code HAVING COUNT(*) > 1;
SELECT location, COUNT(*) FROM menus GROUP BY location HAVING COUNT(*) > 1;
```

---

## E. Data Quality Findings

| Finding | Status |
|---|---|
| 77 skipped products | Remain skipped — blank slug or no category match |
| 9 duplicate SKUs | Suffix strategy: `-wp-{sourceId}` appended, plan warns, not a blocker |
| Product tags (2,895) | DEFERRED — no target schema, global warning in write plan |
| FG redirects (19,516) | DEFERRED — source `kd_fg_redirect` has `old_url` but no `new_url` column |
| Media physical files | NOT copied — `storageProvider="LEGACY_WP"`, metadata only |
| Password hashes | Stored verbatim in `passwordHash` field. Never logged. Login deferred to Phase 2F |

---

## F. Safety Gates Verification

| Guard | Config key | Required value | Default | Status |
|---|---|---|---|---|
| 1 — master switch | `enabled` | `true` | `false` | ✓ blocked by default |
| 2 — dry-run off | `dry-run` | `false` | `true` | ✓ blocked by default |
| 3 — mode | `mode` | `import` | `""` | ✓ blocked by default |
| 4 — confirm | `confirm-execute` | `true` | `false` | ✓ blocked by default |
| 5 — environment | `environment` | `local` or `staging` | `""` | ✓ blocked by default (NEW) |
| 6 — DB URL | `spring.datasource.url` | not production-like | N/A | ✓ checked at runtime (NEW) |
| — test profile | Spring active profiles | not `test` | — | ✓ always enforced |
| — dump path | `dump-path` | file must exist | — | ✓ always enforced |

No startup auto-run: migration runners are `ApplicationRunner` implementations gated by all guards above. With defaults, zero DB writes occur on startup.

---

## G. Blockers Before Production Import

| Blocker | Severity | Resolution |
|---|---|---|
| Docker Desktop not running | **Blocker for rehearsal** | Start Docker Desktop, run `docker compose up -d postgres` |
| 77 skipped products | Medium | Review: blank slugs or missing category mapping |
| 9 duplicate SKUs | Low | Suffix strategy in place, verify visually after import |
| FG redirect 19,516 rows | Medium | Investigate `kd_fg_redirect` schema — find `new_url` equivalent |
| Product tags 2,895 rows | Low | Phase 2E: design target schema |
| Media physical copy (8GB) | Medium | Phase 2E: design copy/sync strategy, CDN migration |
| phpass login verification | High | Phase 2F: verify-on-login + rehash to bcrypt |
| SEO redirect runtime | High | Phase 3: middleware for RankMath redirects |

---

## H. Recommended Next Phase

1. **Immediate:** Start Docker Desktop, run `docker compose up -d postgres`, then:
   - Run write-plan mode to get actual planned counts
   - Run import first pass, record counts
   - Run import second pass, verify idempotency
   - Run SQL duplicate checks

2. **Phase 2E — Media copy/sync strategy**
   - Decide: copy 8GB uploads to local storage, S3, or keep as legacy references
   - Implement batch copy script (separate from import runner)

3. **Phase 2F — Legacy phpass verifier + rehash-on-login**
   - Add `PasswordVerifierService` supporting both phpass and bcrypt
   - On successful phpass login, rehash to bcrypt and persist

4. **Phase 3 — Legacy URL / SEO runtime alignment**
   - RankMath redirect middleware for 40 active redirects
   - Investigate FG redirect `new_url` situation (19,516 rows)

5. **Phase 4 — Frontend integration**
   - Connect Next.js frontend to migrated data
   - Test all catalog, product, checkout flows end-to-end

---

## I. Safety Check

| Item | Confirmed |
|---|---|
| No production import | YES — production import not executed |
| No frontend changes | YES — backend only |
| No media file copy | YES — metadata only, `storageProvider="LEGACY_WP"` |
| No WP source modification | YES — dump read-only |
| No password hash leak | YES — `passwordHash` field never logged |
| All existing tests pass | YES — 454/454 |
