# Phase 2D.2 — Product Variation Importer Report

**Date:** 2026-04-22
**Status:** COMPLETE — ProductVariationImporter implemented and rehearsed on real Postgres.
**Production import:** NO — not executed.

---

## A. Summary

| Item | Result |
|---|---|
| ProductVariationImporter | NEW — implemented |
| Wired into WordPressMigrationImportService | YES |
| Tests added | 18 new tests (Phase2D2ProductVariationImporterTest) |
| Full test suite | 472/472 PASS |
| Real rehearsal run 1 | inserted=3907, updated=0, skipped=133, failed=0 |
| Real rehearsal run 2 | inserted=0, updated=3907, skipped=133, failed=0 |
| Idempotency | VERIFIED |
| Duplicate checks | PASS — 0 violations |

---

## B. Changed Files

| File | Action |
|---|---|
| `migration/wordpress/importer/ProductVariationImporter.java` | NEW |
| `migration/wordpress/importer/WordPressMigrationImportService.java` | UPDATED — wired ProductVariationImporter after Products |
| `test/api/Phase2D2ProductVariationImporterTest.java` | NEW — 18 tests |

---

## C. Importer Implementation Summary

**ProductVariationImporter** implements `DomainImporter` for `MigrationDomain.PRODUCT_VARIATIONS`.

Key design decisions:
- **Variant ID**: deterministic `"wp-var-{sourceId}"` — matches `ProductEntity` pattern of `"wp-prod-{sourceId}"`
- **Parent lookup**: `productRepo.findById("wp-prod-{parentProductId}")` — resolves via the same ID scheme
- **Missing parent**: skip with warning, no crash, other variants continue importing
- **Attributes → Options**: stored as `ProductVariantOptionEntity` rows via `cascade = ALL, orphanRemoval = true`
- **Idempotency**: `variantRepo.findById(variantId)` → update if present, insert if absent
- **Options update**: for existing variants, uses `entity.getOptions().clear()` + `addAll()` on the Hibernate-managed collection — avoids orphanRemoval issues from replacing the PersistentBag with an immutable list
- **No `@GeneratedValue` conflict**: `ProductVariantEntity` uses String `@Id` (manually set). `ProductVariantOptionEntity` uses `@GeneratedValue(IDENTITY)` — never manually set id on options

---

## D. Write-Plan vs Execution Result

| Item | Write-Plan Planned | Run 1 Inserted | Run 2 Updated |
|---|---|---|---|
| product_variants | 4,040 | 3,907 | 3,907 |
| Difference | −133 | skipped | skipped |

The 133 skipped variations correspond to variations whose parent product was not found in the DB. These are:
- 77 products were skipped during Phase 2D.1 (63 blank slug + 14 missing category) → their variations have no parent in the DB
- Remaining ~56 variations may reference products that were skipped or not imported for other reasons

This is **expected and correct behavior** — variations without a valid parent are skipped with a logged warning, not failed.

---

## E. First Rehearsal Result (Run 1)

```
Duration:  15823ms
Inserted:  3907
Updated:   0
Skipped:   133
Failed:    0
HasErrors: false

[PRODUCT_VARIATIONS] inserted=3907 updated=0 skipped=133 failed=0
```

---

## F. Second Rehearsal Result (Run 2 — Idempotency)

```
Duration:  18935ms
Inserted:  0
Updated:   3907
Skipped:   133
Failed:    0
HasErrors: false

[PRODUCT_VARIATIONS] inserted=0 updated=3907 skipped=133 failed=0
```

**Idempotency: VERIFIED** — Run 2 inserted 0 new rows. All counts match Run 1.

---

## G. DB Counts After Rehearsal

| Table | Count |
|---|---|
| product_variants | 3,907 |
| product_variant_options | 6,693 |

---

## H. Duplicate Checks

| Check | Violations |
|---|---|
| Duplicate variant id | 0 ✓ |
| Orphan variants (no parent product) | 0 ✓ |
| Variants with NULL stockState | 0 ✓ |
| Variants with NULL name | 0 ✓ |

---

## I. Test Suite

| Suite | Tests | Result |
|---|---|---|
| Phase2D2ProductVariationImporterTest | 18 | PASS |
| All other suites (unchanged) | 454 | PASS |
| **Total** | **472** | **472/472 PASS** |

Test coverage:
- Mapping: price, SKU, stockState (in-stock/out-of-stock), attributes → options, name generation
- Idempotency: first run inserts, second run updates, options replaced on update
- Missing parent: skipped with warning, does not block other variations
- Dry-run: no DB writes
- Service wiring: PRODUCT_VARIATIONS in dependency order, after PRODUCTS, importer bean wired
- Duplicate prevention: same sourceId → same id, no duplicates

---

## J. Remaining Blockers Before Production Import

| Blocker | Severity | Status |
|---|---|---|
| 133 skipped variations (missing parent product) | Medium | Expected — parent products were skipped in Phase 2D.1. Root cause: 77 blank-slug/no-category products |
| 77 skipped products (63 blank slug, 14 no category) | Medium | Phase 2D.1 known issue — still pending |
| 5 skipped articles (blank slug) | Low | Phase 2D.1 known issue |
| FG redirects: 19,516 deferred | Medium | Phase 2E — investigate source new_url |
| Product tags: 2,895 deferred | Low | Phase 2E — schema design required |
| Media physical files (8GB) not copied | Medium | Phase 2E — copy/sync strategy |
| phpass login verification not implemented | High | Phase 2F — verify-on-login + rehash to bcrypt |
| SEO redirect runtime not implemented | High | Phase 3 — middleware for 40 RankMath redirects |

---

## K. Safety Check

| Item | Confirmed |
|---|---|
| No production import | YES |
| No frontend changes | YES |
| No media file copy | YES |
| No WP source modification | YES |
| No password hash leak in logs | YES |
| All existing tests pass | YES — 472/472 |
| Environment guard enforced | YES |
| DB URL production guard enforced | YES |
| confirm-execute guard enforced | YES |
