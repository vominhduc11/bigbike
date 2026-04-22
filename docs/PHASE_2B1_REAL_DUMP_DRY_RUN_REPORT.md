# PHASE 2B.1 — REAL DUMP DRY-RUN CALIBRATION REPORT

> **Generated:** 2026-04-22  
> **DB writes:** None — pure dry-run  
> **Migration enabled by default:** `false`  
> **Total tests:** 363 / 363 pass  

---

## A. Summary

| Item | Value |
|------|-------|
| Full dry-run executed | **Yes** |
| Dump path | `bigbike_vn__2026_04_17/sqldump.sql` |
| Dump size | ~127 MB |
| Encoding | ISO-8859-1 (MySQL mixed-encoding) |
| DB writes | **None** |
| Duration | ~1972 ms (~2 s) |
| Parser fix applied | **Yes** — multi-row INSERT (one row per line) |

---

## B. Real Dump Counts

| Domain | Source | Mapped | Skipped / Deferred | Notes |
|--------|-------:|-------:|--------------------|-------|
| Products | 1227 | 1150 | 77 skipped | 77 missing slug or name |
| Variations | 4040 | 4040 | 0 deferred | all mapped; parent-id resolution pending Phase 2D |
| Categories (product_cat) | 50 | 50 | 0 | all mapped |
| Brands (pwb-brand) | 45 | 45 | 0 | all mapped |
| Product Tags | 2895 | 0 | 2895 deferred | no target table; counted only |
| Media (attachments) | 12054 | 12054 | 0 | 100% mapped |
| Pages | 22 | 22 | 0 | all mapped |
| Articles (posts) | 174 | 174 | 0 | all mapped |
| Menus | 3 | 3 | 0 | all mapped |
| Menu Items | 46 | 46 | 0 | all mapped |
| RankMath Redirects | 40 | 40 | 0 | all mapped |
| FG Redirects | 19516 | 0 | 19516 skipped | schema finding — see § D |
| Permalink Manager | 0 | 0 | — | plugin not present in dump |

**Total source rows (catalog + content + media):** 20 556  
**Total mapped:** 17 584  
**Total warnings (all domains):** 20 084  

---

## C. Top Warnings

### Warning summary

| Warning type | Count |
|---|---:|
| Duplicate SKU | 9 |
| Invalid price (`_price` not numeric) | 0 |
| Missing `_wp_attached_file` | 0 |
| RankMath self-loop redirects | 0 |
| RankMath duplicate sources | 0 |
| Permalink URI conflicts | 0 |
| FG redirect skipped (no `new_url` column) | 19 516 |
| Streaming parser warnings | 0 |

### Duplicate SKUs (9 detected)

9 products share a SKU with another product.  
These will generate `WARN: Duplicate SKU: <sku>` entries in product warnings.  
Resolution required before Phase 2D real import (deduplicate or assign unique SKUs).

### FG Redirects — schema mismatch (19 516 skipped)

`kd_fg_redirect` schema discovered in real dump:

```sql
CREATE TABLE `kd_fg_redirect` (
  `old_url` varchar(191) NOT NULL,
  `id` bigint(20) unsigned NOT NULL,
  `type` varchar(20) NOT NULL,
  `activated` tinyint(1) NOT NULL,
  PRIMARY KEY (`old_url`)
);
```

**Finding:** Table has `old_url` (source) but no `new_url` / `redirect_to` column.  
The FG plugin stores only redirect *sources* here; the destination is encoded in `type` or handled elsewhere.  
→ All 19 516 rows are skipped with `"Missing source or target"` warning.  
→ Requires Phase 2D investigation to determine if these are "passthrough" rules or if target is stored elsewhere.  

### Permalink Manager

`permalink-manager_uris` option was not found in `kd_options`.  
Either Permalink Manager plugin was not installed on this BigBike instance, or the option key differs.  
→ 0 URI entries; no conflicts.

---

## D. Parser Issues Found / Fixed

### New issue found in Phase 2B.1 (critical)

**Bug:** `WordPressSqlDumpRowReader` only parsed the **first data row** of each multi-row INSERT statement.

**Root cause:** The real mysqldump has one data row per line:
```sql
INSERT INTO `kd_posts` VALUES
(row1),
(row2),
...
(rowN);
```
The Phase 2B `pendingInsert` mechanism correctly buffered `INSERT INTO kd_posts VALUES` and combined it with the next `(row1)` line. However it **cleared** the pending state after dispatching row 1, causing rows 2…N to be silently ignored (they don't start with `INSERT` so the `!line.startsWith("INSERT") continue` filtered them out).

The fixture used in Phase 2B tests had all rows on one line (so the bug was not caught):
```sql
INSERT INTO `kd_posts` VALUES
(row1),(row2),(row3);
```

**Fix applied:** Replaced `pendingInsert/pendingInsertTable` with `multiRowTable/multiRowHeader`. After dispatching any `(row)` line, the parser stays in multi-row mode and continues dispatching subsequent `(row)` lines until a non-data line is encountered.

**Impact:** Before fix: `products.source=2`, `media.source=1` (only first row of each INSERT captured). After fix: `products.source=1227`, `media.source=12054`.

### Phase 2B fixes still active

| Fix | Description |
|-----|-------------|
| ISO-8859-1 charset | Handles mixed MySQL encoding without `MalformedInputException` |
| PHP truncated array early-exit | Handles WooCommerce attachment metadata truncation |
| Null-safe `Collectors.toMap()` | Prevents NPE on null meta values |
| `valuesConsumed` flag | Prevents double-VALUES parsing bug |

---

## E. Performance

| Metric | Value |
|--------|-------|
| Dump size | ~127 MB |
| Parse duration | 1972 ms (~2 s) |
| Streaming | Yes — line-by-line, ISO-8859-1, single pass |
| Memory model | Accumulates 8 target tables only; no full-dump load |
| DB writes | None |

---

## F. Commands Executed

```bash
# Full test suite (363 tests, 0 failures):
cd bigbike-backend
./mvnw test

# Real dump dry-run via safe runner:
./mvnw spring-boot:run \
  -Dspring-boot.run.arguments="\
    --bigbike.migration.wordpress.enabled=true \
    --bigbike.migration.wordpress.dry-run=true \
    --bigbike.migration.wordpress.dump-path=../bigbike_vn__2026_04_17/sqldump.sql \
    --bigbike.migration.wordpress.mode=catalog-dry-run"
```

---

## G. Safety Check

- [x] No DB writes
- [x] Migration disabled by default (`enabled=false`)
- [x] Runner is no-op in normal startup (triple-guard: `enabled` + `dry-run` + `mode`)
- [x] No frontend changes
- [x] No WordPress source modification
- [x] No media files copied
- [x] No customer / order / coupon importer
- [x] No write plan implemented
- [x] No destructive command executed
- [x] `dry-run=true` enforced (default)
- [x] Old tests not deleted (363 = 353 + 10 new)

---

## H. Recommended Next Phase

| Phase | Scope |
|-------|-------|
| **Phase 2C** | Customer / Order / Coupon dry-run importer |
| **Phase 2D** | Write plan + idempotent real import command; investigate `kd_fg_redirect` target encoding |
| **Phase 2E** | Media copy / sync (`wp-content/uploads` → storage) |
| **Phase 3**  | Legacy URL / SEO runtime alignment (RankMath 40 redirects → Spring) |

---

## Appendix — Actual test output (Phase2B1RealDumpDryRunCalibrationTest)

```
╔═══════════════════════════════════════════════════════════════╗
║         PHASE 2B.1 REAL DUMP DRY-RUN COUNTS                  ║
╠═══════════════════════════════════════════════════════════════╣
║  products       source=1227    mapped=1150    skipped=77      ║
║  variations     source=4040    mapped=4040    deferred=0      ║
║  categories     source=50      mapped=50      skipped=0       ║
║  brands         source=45      mapped=45      skipped=0       ║
║  tags           source=2895    deferred=2895                  ║
║  media          source=12054   mapped=12054   skipped=0       ║
║  pages          source=22      mapped=22      skipped=0       ║
║  articles       source=174     mapped=174     skipped=0       ║
║  menus          source=3       mapped=3       skipped=0       ║
║  menu_items     source=46      mapped=46      skipped=0       ║
║  rank_math      source=40      mapped=40      skipped=0       ║
║  fg_redirect    source=19516   mapped=0       skipped=19516   ║
║  permalink      entries=0      parsed=0       conflicts=0     ║
╠═══════════════════════════════════════════════════════════════╣
║  total_source=20556  total_mapped=17584  warnings=20084       ║
║  streaming_warnings=0  elapsed=1972 ms (~1 s)                 ║
╚═══════════════════════════════════════════════════════════════╝
```
