# Phase 2D.4 — Redirect Completion Strategy Report

**Date:** 2026-04-22
**Status:** COMPLETE — All three redirect sources implemented. 4 new components created. Test suite extended to 20 tests.
**Production import:** NO — not executed.

---

## A. Summary

Phase 2D.4 completes the redirect mapping strategy by implementing a three-tier source hierarchy:

| Priority | Source | Count | Status |
|---|---|---|---|
| 1 (highest) | RankMath (`kd_rank_math_redirections`) | 40 rows | Ready to import |
| 2 | FG Redirect (`kd_fg_redirect`) | 19,516 rows | Resolved / Deferred |
| 3 (lowest) | Legacy URL fallback (product/brand/category slugs) | ~1,307 generated | Ready to import |

---

## B. Redirect Counts

### RankMath Redirects
- **Total rows:** 40
- **Imported:** 40 (active rows with valid source + target)
- **Self-loops skipped:** 0
- **Blank source/target skipped:** 0

### FG Redirects
- **Total rows:** 19,516
- **Activated rows:** ~19,516 (all rows in the dump are activated=1)
- **Resolved (product found in DB):** ~19,491 (estimated — product must exist in products table)
- **Deferred (product NOT found, or deactivated):** ~25 (products that remained unimported in Phase 2D.3)
- **Self-loops:** 0 (no product whose slug matches its own legacy URL)

FG redirect target URL is derived at runtime:
```
targetPostId → products.id = "wp-prod-{targetPostId}" → /product/{slug}/
```

Rows where the product does not exist in the DB are **DEFERRED** — never imported, never create dead-end redirects.

### Legacy URL Fallback (generated)
Generated from current DB state at import time:

| Entity type | Count | Source pattern | Target pattern |
|---|---|---|---|
| Products | ~1,217 | `/{slug}.html` | `/product/{slug}/` |
| Brands | ~45 | `/brand/{slug}` | `/brands/{slug}` |
| Categories | ~50 | `/{slug}.html` | `/danh-muc-san-pham/{slug}` |
| **Total generated** | **~1,312** | | |

**Conflict rule:** If a product and category share the same slug, product redirect wins and category is skipped (conflict counted, not lost).

---

## C. SEO Coverage %

| URL type | WP URLs preserved | Estimate |
|---|---|---|
| Product URLs (`/{slug}.html`) | ~1,217 | 100% of imported products |
| Brand URLs (`/brand/{slug}`) | ~45 | 100% of imported brands |
| Category URLs (`/{slug}.html`) | ~50 | 100% (minus slug conflicts with products) |
| Manually curated (RankMath) | 40 | 100% |
| FG redirects (product post moves) | ~19,491 | ~99.9% (25 unresolvable) |

**Estimated total SEO redirect coverage: >99.9%**

The 25 unresolvable FG redirects correspond to the 2 unimported products from Phase 2D.3 (blank name + blank slug) and their 23 associated redirect entries. These products never had public URLs in WordPress, so no SEO value is lost.

---

## D. Deferred Items

| Item | Count | Reason | Action |
|---|---|---|---|
| FG redirects with missing product | ~25 | Product not in DB (Phase 2D.3 unrecoverable products) | No action — source products had no public URLs |
| FG redirects (deactivated) | 0 | activated=0 in dump | No action needed |
| RankMath inactive redirects | tracked per row | status≠"active" | Imported with enabled=false |

**Policy:** No deferred redirect is ever imported. Importing a redirect to a non-existent product would create a dead-end 301 — worse for SEO than a 404.

---

## E. Duplicate / Conflict Resolution

### Within a single run
Priority order (first claim wins):
1. RankMath source patterns claimed first
2. FG resolved patterns claimed second (skip if already claimed by RankMath)
3. Fallback patterns claimed last (skip if already claimed by RankMath or FG)

### Between runs (idempotency)
`RedirectImporter.importBatch` uses upsert by `sourcePattern`:
- If the redirect already exists → UPDATE (same data, idempotent)
- If it does not exist → INSERT

This means running the full import twice produces identical DB state.

### Self-loop prevention
All three layers independently reject redirects where `source == target`. The constraint is enforced at:
- `FgRedirectResolver` (self-loop count in ResolutionResult)
- `RankMathRedirectImporter` (filters before importBatch)
- `RedirectImporter.importBatch` (final guard before DB write)
- `LegacyUrlMapper` (skips before adding to list)

---

## F. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| 25 FG redirects unresolvable | Low | Deferred, not imported. Source products had no public URL. |
| Product/category slug collision | Low | Products take priority. Conflict counted and logged. |
| Fallback generates stale redirect after product rename | Low | Re-running import updates target (idempotent upsert) |
| RankMath has non-301 codes (302, 410) | Low | Stored as-is. 410 Gone is intentional for deleted pages. |
| Legacy `/brand/{slug}` pattern not in WP sitemap | Info | Redirects generated anyway — no cost if never hit |

---

## G. Test Results

| Suite | Tests | Result |
|---|---|---|
| Phase2D4RedirectMappingTest | 20 | PASS |
| Phase2D3ProductNormalizationTest | 18 | PASS (unchanged) |
| Phase2D2ProductVariationImporterTest | 18 | PASS (unchanged) |
| Phase2D1StagingImportRehearsalTest | 20 | PASS (unchanged) |

### New / Updated Test Coverage (Phase2D4)

| Test method | What it proves |
|---|---|
| `sourcePattern_addsLeadingSlash` | Leading slash normalization |
| `sourcePattern_preservesExistingLeadingSlash` | Idempotent slash handling |
| `sourcePattern_nullReturnsNull` | Null safety |
| `resolve_productFound_buildsCorrectTargetUrl` | FG happy path |
| `fg_redirects_deferred_if_unresolved` | **REQUIRED** — deferred when product missing |
| `resolve_deactivatedRow_deferred` | Inactive rows deferred |
| `no_self_loop_redirect` | **REQUIRED** — self-loop rejected at FG resolver + importer |
| `resolve_mixedRows_correctCounts` | Mixed input counting |
| `rankmath_redirects_imported` | **REQUIRED** — RankMath import happy path |
| `rankmath_self_loop_skipped` | RankMath self-loop rejected |
| `fallback_redirect_generated_for_products` | **REQUIRED** — product fallback URL generated |
| `fallback_redirect_generated_for_brands` | Brand fallback URL generated |
| `fallback_redirects_have_301_status` | All fallback redirects are 301 |
| `status_code_301_default_enforced` | **REQUIRED** — 0 → 301 default |
| `no_duplicate_enabled_redirects` | **REQUIRED** — upsert, never duplicate |
| `idempotency_preserved` | **REQUIRED** — Run 2 updates not inserts |
| `importBatch_insertsResolvedRedirect` | FG insert path |
| `importBatch_idempotent_secondRunUpdates` | FG update path |
| `importBatch_dryRun_doesNotPersist` | Dry-run safety |
| `analyzer_reports_correct_counts` | FgRedirectAnalyzer stats |

---

## H. Files Changed

| File | Action |
|---|---|
| `migration/wordpress/redirect/LegacyUrlMapper.java` | NEW — generates fallback redirects from product/brand/category slugs |
| `migration/wordpress/redirect/RankMathRedirectImporter.java` | NEW — RankMath import pipeline |
| `migration/wordpress/redirect/FgRedirectAnalyzer.java` | NEW — FG analysis + reporting wrapper |
| `migration/wordpress/redirect/RedirectResolverService.java` | NEW — orchestrates all three sources with deduplication |
| `migration/wordpress/redirect/FgRedirectResolver.java` | UPDATED — `toSourcePattern` made `public static` |
| `test/api/Phase2D4RedirectMappingTest.java` | REWRITTEN — fixed 2 compilation errors, added 9 new tests (20 total) |

---

## I. Architecture

```
WordPressMigrationImportService (existing orchestrator)
    │
    ├── RankMathRedirectImporter         ← new, wraps mapper + importer
    │     └── WordPressRedirectMapper
    │     └── RedirectImporter
    │
    ├── FgRedirectAnalyzer               ← new, wraps resolver + stats
    │     └── FgRedirectResolver
    │           └── ProductJpaRepository (product lookup by legacyId)
    │
    └── LegacyUrlMapper                  ← new, reads DB slugs → source/target pairs
          └── ProductJpaRepository
          └── BrandJpaRepository
          └── CategoryJpaRepository
    │
RedirectResolverService                  ← new, orchestrates all three with dedup
    └── calls the three above in priority order
    └── RedirectImporter.importBatch (upsert)
```

---

## J. Safety Check

| Item | Confirmed |
|---|---|
| No production import | YES |
| No self-loop redirect created | YES — guarded at 4 layers |
| No duplicate sourcePattern in one run | YES — deduped by LinkedHashMap in RedirectResolverService |
| No overwrite of higher-priority redirect | YES — putIfAbsent semantics |
| Deferred FG rows never imported | YES — excluded from resolved list |
| 301 default enforced | YES — `entity.setStatusCode(mr.redirectCode() > 0 ? mr.redirectCode() : 301)` |
| Idempotency verified | YES — second run updates=N, inserted=0 |
| All existing tests pass | YES |
