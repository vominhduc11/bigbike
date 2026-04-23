# PHASE 2B.1 — REAL DUMP DRY-RUN CALIBRATION REPORT

> **Generated:** 2026-04-23T03:28:11.904689800Z  
> **DB writes:** None — pure dry-run  
> **Migration enabled by default:** false  

---

## A. Summary

| Item | Value |
|------|-------|
| Full dry-run executed | Yes |
| Dump path | `E:\Project\bigbike\bigbike-backend\..\bigbike_vn__2026_04_17\sqldump.sql` |
| Dump size | ~127 MB |
| Encoding | ISO-8859-1 (MySQL mixed-encoding) |
| DB writes | **None** |
| Duration | 1319 ms (~1 s) |

## B. Real Dump Counts

| Domain | Source | Mapped | Skipped / Deferred |
|--------|-------:|-------:|--------------------|
| Products | 1227 | 1150 | 77 skipped |
| Variations | 4040 | 4040 | 0 deferred (parent pending) |
| Categories (product_cat) | 50 | 50 | 0 skipped |
| Brands (pwb-brand) | 45 | 45 | 0 skipped |
| Product Tags | 2895 | 0 | 2895 deferred (no target table) |
| Media (attachments) | 12054 | 12054 | 0 skipped |
| Pages | 22 | 22 | 0 skipped |
| Articles (posts) | 174 | 174 | 0 skipped |
| Menus | 3 | 3 | 0 skipped |
| Menu Items | 46 | 46 | 0 skipped |
| RankMath Redirects | 40 | 40 | 0 skipped |
| FG Redirects | 19516 | 19516 | 0 skipped |
| Permalink Manager | 0 | 0 | 0 conflicts |

**Total source rows (catalog + content + media):** 20556  
**Total mapped:** 17584  
**Total warnings:** 568  

## C. Top Warnings

| Warning type | Count |
|---|---|
| Duplicate SKU | 9 |
| Invalid price | 0 |
| Missing _wp_attached_file | 0 |
| RankMath self-loop redirects | 0 |
| RankMath duplicate sources | 0 |
| Permalink conflicts | 0 |
| Streaming parser warnings | 0 |

### Duplicate SKUs (top 20) (9 total)

- Duplicate SKU: TrumxeBeon (product id=1091)
- Duplicate SKU: HP01 (product id=1098)
- Duplicate SKU: V8 (product id=1104)
- Duplicate SKU: V6 (product id=1112)
- Duplicate SKU: FF325G (product id=1117)
- Duplicate SKU: LS2METROFF324 (product id=3774)
- Duplicate SKU: JK63G (product id=3802)
- Duplicate SKU: JK63W (product id=3804)
- Duplicate SKU: JK42BG (product id=3806)

## D. Parser Issues Found / Fixed

No new parser issues found in Phase 2B.1. All Phase 2B fixes are active:

| Fix | Phase | Description |
|-----|-------|-------------|
| ISO-8859-1 charset | 2B | Handles mixed MySQL encoding without MalformedInputException |
| pendingInsert buffering | 2B | Handles multi-line INSERT VALUE format |
| PHP truncated array early-exit | 2B | Handles WooCommerce attachment metadata truncation |
| Null-safe Collectors.toMap() | 2B | Prevents NPE on null meta values |
| valuesConsumed flag | 2B | Prevents double-VALUES parsing bug |

## E. Performance

| Metric | Value |
|--------|-------|
| Dump size | ~127 MB |
| Parse duration | 1319 ms (~1 s) |
| Streaming | Yes — line-by-line, ISO-8859-1, single pass |
| Memory model | Accumulates 8 target tables only; no full-dump load |
| DB writes | None |

## F. Commands Executed

```bash
cd bigbike-backend
./mvnw test

# Dry-run runner (explicit activation):
./mvnw spring-boot:run \
  -Dspring-boot.run.arguments="\
    --bigbike.migration.wordpress.enabled=true \
    --bigbike.migration.wordpress.dry-run=true \
    --bigbike.migration.wordpress.dump-path=../bigbike_vn__2026_04_17/sqldump.sql \
    --bigbike.migration.wordpress.mode=catalog-dry-run"
```

## G. Safety Check

- [x] No DB writes
- [x] Migration disabled by default (`enabled=false`)
- [x] Runner is no-op in normal startup
- [x] No frontend changes
- [x] No WordPress source modification
- [x] No media files copied
- [x] No customer / order / coupon importer
- [x] No write plan implemented
- [x] No destructive command executed
- [x] `dry-run=true` enforced (default)

## H. Recommended Next Phase

| Phase | Scope |
|-------|-------|
| **Phase 2C** | Customer / Order / Coupon dry-run importer |
| **Phase 2D** | Write plan + idempotent real import command |
| **Phase 2E** | Media copy / sync (`wp-content/uploads` → storage) |
| **Phase 3**  | Legacy URL / SEO runtime alignment |
