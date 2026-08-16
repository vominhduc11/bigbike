# Audit: Redirect, catalog filter, brand, and discontinued-product remediation

Date: 2026-08-13
Scope: `PROMPT_CODEX_REDIRECT.md` items A–I
Owner decisions: `1A, 2A, 3A, 4A, 5A`

## Decision record

- Create the `Alpinestars` and `Kriega` brands.
- Use `kich-co` for the public catalog size filter.
- Keep the existing LS2 Zoom Lady destination, which is the summer-jacket PDP.
- Send the BMW R 1200 GS legacy article to `/tin-tuc/test/` and the English source to `/en/tin-tuc/test/`.
- Design the terminal 410 page from `bigbike-web/STYLEGUIDE.md`.

## Canonical evidence

The business rules are recorded in `docs/business/BUSINESS_RULES.md` (`PRODUCT_RULE_017`, `CATALOG_RULE_001`, `REDIRECT_RULE_005`). The state behavior is recorded in `docs/business/STATE_MACHINES.md`. The data and endpoint contracts are updated in `docs/engineering/DATA_CONTRACT.md` and `docs/engineering/API_CONTRACT.md`.

## Implemented changes

- Redirects now support only 301 and terminal 410, with `status_code` in migration `V1023__redirect_and_discontinued_catalog_rules.sql`. The internal lookup returns the status; the proxy serves 301 or a bilingual 410 response and records hits only for 301.
- The migration repairs the five brand aliases, five size aliases, nine category aliases, the two valid product PDP mappings, the English/ Vietnamese Zoom and SCS mappings, BMW article mappings, OF606's final category mapping, and the Apollo/Koku plus wrong-brand terminal 410 rows.
- The migration removes the stale redirect rows for the 24 legacy published-history pages. `bigbike-web/lib/legacy/discontinued-products.ts` keeps those 24 pages at their original `/sp/*.html` URLs; they render 200, `Product` JSON-LD with `https://schema.org/Discontinued`, no `noindex`, no purchase controls, a category link, a home link, and the required safety sentence.
- `products.discontinued` is an orthogonal published-product flag. Public lists, search, facets, sitemap, and product feeds exclude it; the legacy page remains available. Admin mutation validation prevents setting it on a non-published product.
- `/api/v1/products` and the catalog UI use `kich-co`; `XXXL` normalizes to `3XL` and is independent of pagination `size`.
- Unknown brand slugs now return HTTP 404 at the edge, including the localized English path, instead of a 200 soft 404.
- The `/sp/` hero setting repair is included in the migration for the leaked `Tất cả sản phẩm1` value.
- The production locale rewrite uses private internal aliases for the Vietnamese home and catalog routes, so `/sp/` and `/?detail=...` remain 200 responses instead of self-redirecting.
- The six referenced image objects were checked read-only in MinIO and each returned HTTP 200; the page keeps them same-origin through the existing `/media`/`/wp-content/uploads` rewrite.

## Runtime baseline and migration gate

Before applying the new migration, the shared Docker stack was healthy (`bigbike-web`, `bigbike-backend`, `bigbike-admin`, PostgreSQL, Redis, and MinIO). The read-only database check showed:

- `flyway_schema_history` latest applied version: `1020`.
- `products.discontinued` column: absent.
- `redirects.status_code` column: absent.
- Redirect baseline: 748 total, 739 enabled, 9 disabled, 41 never hit, 4 English `.html` rows total and 3 enabled.
- Brands before migration: 23; the two owner-approved brands were absent.

The running containers were not restarted, upgraded, or written to. Therefore the post-migration row counts and live Docker acceptance checks are intentionally pending deployment of `V1023`. The existing untracked `V1022__add_chat_lead_source.sql` was preserved; the redirect migration uses `V1023` to avoid a duplicate version.

The brief says “24 discontinued URLs” but also describes 10 Kriega + 2 SMK + 3 oil/chain + 14 remaining URLs (29). This implementation follows the explicit 24-page registry for 200 history pages and keeps the separate 14-row terminal-410 set visible in the migration. The discrepancy remains recorded rather than silently changing the owner-approved scope.

## Verification

- Web: `npm run lint`, 401/401 Vitest tests, and `npm run build` passed. Production standalone smoke passed for VI and EN discontinued pages, direct 410, fake-backed 301, fake-backed 410, and unknown-brand 404. The final H1 smoke confirmed `/sp/` is HTTP 200 with `Tất cả sản phẩm` (not `Tất cả sản phẩm1`); `/?detail=26-01-13-zy0118t4.html` is HTTP 200 with canonical `/` and no self-redirect.
- The redirect smoke also confirmed `/brand/test.html` resolves to `/brands/test/` and `/en/brand/test.html` resolves to `/en/brands/test/`, each in one 301 without duplicating `/en/`.
- Admin: lint and build passed; focused redirect/product tests passed 4 files / 53 tests. The full Vitest run had one timeout in the pre-existing `ProductListScreen` suite; an isolated rerun passed 6/6.
- Backend: `./mvnw -DskipTests compile` passed; redirect/schema/OpenAPI focused tests passed 47/47. The full suite remains non-green because of pre-existing fixture/assertion failures, Docker Testcontainers API-version incompatibility, forwarded-IP environment variance, an existing permission-migration expectation, and unrelated chat-task failures. No full-suite failure was hidden.
- OpenAPI JSON parses successfully, migration version IDs are unique, and `git diff --check` is clean.

## Not run / pending external state

- Not run: applying `V1023` to the shared runtime database; this requires deployment/operation of the new build and migration.
- Production baseline cURL was run before deployment: Forma still redirected to a 404 PDP, English SCS stayed 404 without redirect, Scoyco still reached an unrelated 200 PDP after two redirects, and an unknown brand still returned 200. These are expected pre-migration findings; post-deployment cURL and live sitemap counts remain pending.
- Not run: Merchant Center feed verification; no Merchant Center feed endpoint or file was found in the repository. Sitemap code now filters `discontinued` products.
- Not run: legacy WordPress export verification; `bigbike_vn__2026_04_17/` is absent from this workspace.
