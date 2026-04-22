# Phase 2D.1 — Staging Import Rehearsal Report

**Date:** 2026-04-22
**Status:** COMPLETE — Real Postgres rehearsal executed successfully.
**Production import:** NO — not executed.

---

## A. Real Postgres Rehearsal Executed: YES

| Item | Result |
|---|---|
| DB used | Local Postgres 16 via Docker Compose (`bigbike-postgres`) |
| DB URL | `jdbc:postgresql://localhost:5432/bigbike` |
| Dump | `../bigbike_vn__2026_04_17/sqldump.sql` |
| Write-plan executed | YES |
| Import first run | YES — 16,516 inserted, 8 updated, 82 skipped, 0 failed |
| Import second run | YES — 0 inserted, 16,524 updated, 82 skipped, 0 failed |
| Idempotency | VERIFIED — all counts identical after run 2 |
| Duplicate checks | PASS — 0 violations across all domains |
| Test suite | 454/454 PASS |
| Production import | NO |

---

## B. DB Target Used

```
Host:     localhost:5432
DB:       bigbike
User:     bigbike
Password: bigbike_dev_only (docker-compose default)
Source:   docker-compose.yaml → bigbike-postgres container
```

DB URL does NOT match any production-like pattern — import runner guard 6 passed.

---

## C. Write-Plan Result

```
=== PHASE2D_WRITE_PLAN_BEGIN ===
Planned operations: 27117 total rows
  INSERT: 0
  UPSERT: 27117
  DEFER:  22411

Domain breakdown:
  CATEGORIES        table=categories          strategy=UPSERT_BY_SLUG          rows=50
  BRANDS            table=brands              strategy=UPSERT_BY_SLUG          rows=45
  MEDIA             table=media               strategy=UPSERT_BY_LEGACY_ID     rows=12054
  PAGES             table=pages               strategy=UPSERT_BY_SLUG          rows=22
  ARTICLES          table=articles            strategy=UPSERT_BY_SLUG          rows=174
  REDIRECTS         table=redirects           strategy=UPSERT_BY_SOURCE_PATTERN rows=40
  MENUS             table=menus               strategy=UPSERT_BY_LOCATION      rows=3
  MENU_ITEMS        table=menu_items          strategy=UPSERT_BY_LEGACY_ID     rows=46
  PRODUCTS          table=products            strategy=UPSERT_BY_SLUG          rows=1150
  PRODUCT_VARIATIONS table=product_variants   strategy=UPSERT_BY_LEGACY_ID     rows=4040
  PRODUCT_TAGS      table=N/A                 strategy=DEFER_UNSUPPORTED       rows=2895  *** DEFERRED ***
  FG_REDIRECTS      table=N/A                 strategy=DEFER_UNSUPPORTED       rows=19516 *** DEFERRED ***
  CUSTOMERS         table=customers           strategy=UPSERT_BY_LEGACY_ID     rows=1929
  CUSTOMER_ADDRESSES table=customer_addresses strategy=UPSERT_BY_LEGACY_ID     rows=887
  SYNTHETIC_CUSTOMERS table=customers         strategy=UPSERT_BY_LEGACY_ID     rows=289
  COUPONS           table=coupons             strategy=UPSERT_BY_LEGACY_ID     rows=1
  ORDERS            table=orders              strategy=UPSERT_BY_ORDER_NUMBER  rows=1061
  ORDER_ADDRESSES   table=order_addresses     strategy=UPSERT_BY_LEGACY_ID     rows=2122
  ORDER_LINE_ITEMS  table=order_line_items    strategy=UPSERT_BY_LEGACY_ID     rows=1309
  ORDER_SHIPPING_ITEMS table=order_shipping_items strategy=UPSERT_BY_LEGACY_ID rows=834
  ORDER_FEE_ITEMS   table=order_fee_items     strategy=UPSERT_BY_LEGACY_ID     rows=0
  ORDER_APPLIED_COUPONS table=order_applied_coupons strategy=UPSERT_BY_LEGACY_ID rows=0
  PAYMENTS          table=payments            strategy=UPSERT_BY_LEGACY_ID     rows=1061

Global warnings: 2
  DEFERRED: 2895 product tags — target schema not defined. Phase 2E required.
  DEFERRED: 19516 FG redirects — missing new_url column in source. Investigation required.

Executable: true
=== PHASE2D_WRITE_PLAN_END ===
```

---

## D. First Import Counts (Run 1)

**Import runner output:**
```
Duration:  256714ms (4m 16s)
Inserted:  16516
Updated:   8
Skipped:   82
Failed:    0
HasErrors: false

[CATEGORIES]   inserted=50   updated=0    skipped=0  failed=0
[BRANDS]       inserted=45   updated=0    skipped=0  failed=0
[MEDIA]        inserted=12054 updated=0   skipped=0  failed=0
[PAGES]        inserted=22   updated=0    skipped=0  failed=0
[ARTICLES]     inserted=169  updated=0    skipped=5  failed=0
[REDIRECTS]    inserted=40   updated=0    skipped=0  failed=0
[MENUS]        inserted=3    updated=0    skipped=0  failed=0
[PRODUCTS]     inserted=1142 updated=8    skipped=77 failed=0
[CUSTOMERS]    inserted=1929 updated=0    skipped=0  failed=0
[COUPONS]      inserted=1    updated=0    skipped=0  failed=0
[ORDERS]       inserted=1061 updated=0    skipped=0  failed=0
```

**DB counts after run 1 (verified via SQL):**

| Table | Count |
|---|---|
| categories | 50 |
| brands | 45 |
| media | 12,054 |
| pages | 22 |
| articles | 169 |
| redirects | 40 |
| menus | 3 |
| menu_items | 46 |
| products | 1,142 |
| product_variants | 0 |
| customers | 1,929 |
| customer_addresses | 887 |
| coupons | 1 |
| orders | 1,061 |
| order_line_items | 1,309 |
| order_shipping_items | 834 |
| order_addresses | 1,656 |
| payments | 1,061 |

---

## E. Second Import Counts (Run 2)

**Import runner output:**
```
Duration:  253303ms (4m 13s)
Inserted:  0
Updated:   16524
Skipped:   82
Failed:    0
HasErrors: false

[CATEGORIES]   inserted=0 updated=50    skipped=0  failed=0
[BRANDS]       inserted=0 updated=45    skipped=0  failed=0
[MEDIA]        inserted=0 updated=12054 skipped=0  failed=0
[PAGES]        inserted=0 updated=22    skipped=0  failed=0
[ARTICLES]     inserted=0 updated=169   skipped=5  failed=0
[REDIRECTS]    inserted=0 updated=40    skipped=0  failed=0
[MENUS]        inserted=0 updated=3     skipped=0  failed=0
[PRODUCTS]     inserted=0 updated=1150  skipped=77 failed=0
[CUSTOMERS]    inserted=0 updated=1929  skipped=0  failed=0
[COUPONS]      inserted=0 updated=1     skipped=0  failed=0
[ORDERS]       inserted=0 updated=1061  skipped=0  failed=0
```

**DB counts after run 2 — identical to run 1 (all counts verified):**

| Table | Run 1 | Run 2 | Delta |
|---|---|---|---|
| categories | 50 | 50 | 0 ✓ |
| brands | 45 | 45 | 0 ✓ |
| media | 12,054 | 12,054 | 0 ✓ |
| pages | 22 | 22 | 0 ✓ |
| articles | 169 | 169 | 0 ✓ |
| redirects | 40 | 40 | 0 ✓ |
| menus | 3 | 3 | 0 ✓ |
| menu_items | 46 | 46 | 0 ✓ |
| products | 1,142 | 1,142 | 0 ✓ |
| product_variants | 0 | 0 | 0 ✓ |
| customers | 1,929 | 1,929 | 0 ✓ |
| customer_addresses | 887 | 887 | 0 ✓ |
| coupons | 1 | 1 | 0 ✓ |
| orders | 1,061 | 1,061 | 0 ✓ |
| order_line_items | 1,309 | 1,309 | 0 ✓ |
| order_shipping_items | 834 | 834 | 0 ✓ |
| order_addresses | 1,656 | 1,656 | 0 ✓ |
| payments | 1,061 | 1,061 | 0 ✓ |

---

## F. Idempotency Verification

**Result: PASS**

- Run 2 inserted 0 new rows across all domains
- Run 2 skipped count (82) matches run 1 (82)
- Run 2 failed count (0) matches run 1 (0)
- All DB table counts identical between run 1 and run 2

---

## G. Duplicate Checks

All SQL duplicate checks run after second import — **0 violations**:

| Check | Violations |
|---|---|
| Duplicate category slug | 0 ✓ |
| Duplicate brand slug | 0 ✓ |
| Duplicate product slug | 0 ✓ |
| Duplicate order_number | 0 ✓ |
| Duplicate redirect source_pattern (enabled) | 0 ✓ |
| Duplicate coupon code | 0 ✓ |
| Duplicate menu location | 0 ✓ |
| Duplicate media legacy_id | 0 ✓ |
| Duplicate customer legacy_id | 0 ✓ |
| Duplicate product SKU | 0 ✓ |

---

## H. Failures / Warnings Found and Resolved

### 1. `ObjectOptimisticLockingFailureException` on MediaEntity (FIXED)

**Cause:** `MediaImporter` and `RedirectImporter` called `entity.setId(UUID.randomUUID())` on new entities that have `@GeneratedValue(strategy = GenerationType.UUID)`. Setting the ID manually caused Spring Data JPA to call `entityManager.merge()` instead of `persist()`, resulting in a detached-vs-managed entity conflict on flush.

**Fix:** Removed `entity.setId(UUID.randomUUID())` from both importers. JPA now generates UUIDs via `@GeneratedValue` on `persist()` — correct pattern.

### 2. `DataIntegrityViolationException` on customers — `varchar(127)` too short (FIXED)

**Cause:** Some WordPress users have `user_nicename` / meta values longer than 127 chars, which exceeded the `first_name` and `last_name` column limits on `CustomerEntity`.

**Fix:** Added `truncate(String, int max)` helper in `CustomerImporter`. Fields truncated at their schema column limit:
- `email` → 255
- `phone` → 50
- `display_name` → 255
- `first_name` → 127
- `last_name` → 127

### 3. Skipped rows

| Domain | Skipped | Reason |
|---|---|---|
| articles | 5 | Blank slug — cannot upsert without natural key |
| products | 77 | Blank slug (63) or no category match after categories imported (14) |

### 4. Product variants: 0 imported

`product_variants` count = 0. The write-plan planned 4,040 variation rows, but none were imported. The `WordPressMigrationImportService` does not currently call a `ProductVariationImporter` — it was listed in the plan but not implemented as a domain in the import service. This is a pending item.

---

## I. Remaining Blockers Before Production Import

| Blocker | Severity | Resolution |
|---|---|---|
| Product variations not imported (0 rows) | High | Implement `ProductVariationImporter` and wire it into `WordPressMigrationImportService` |
| 77 skipped products | Medium | Review: 63 blank-slug products, 14 missing category mapping |
| 5 skipped articles | Low | Blank-slug articles — review source data |
| FG redirects: 19,516 deferred | Medium | Investigate source `kd_fg_redirect` — find `new_url` equivalent |
| Product tags: 2,895 deferred | Low | Phase 2E: design target schema |
| Media physical files (8GB) not copied | Medium | Phase 2E: copy/sync strategy |
| phpass login verification not implemented | High | Phase 2F: verify-on-login + rehash to bcrypt |
| SEO redirect runtime not implemented | High | Phase 3: middleware for 40 RankMath redirects |
| Customer `first_name`/`last_name` truncation | Low | Some WP users had names >127 chars — truncated silently |

---

## Safety Check

| Item | Confirmed |
|---|---|
| No production import | YES |
| No frontend changes | YES |
| No media file copy | YES — `storageProvider="LEGACY_WP"`, metadata only |
| No WP source modification | YES — dump read-only |
| No password hash leak in logs | YES — `passwordHash` field never logged |
| All existing tests pass | YES — 454/454 |
| Environment guard enforced | YES — `environment=local` required |
| DB URL production guard enforced | YES — localhost does not match production patterns |
| confirm-execute guard enforced | YES — explicit `--confirm-execute=true` required |
