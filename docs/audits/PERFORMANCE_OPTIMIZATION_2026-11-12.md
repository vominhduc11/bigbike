# BigBike performance audit and optimization — 2026-11-12

## Executive summary

Implemented four bounded optimizations, preserving existing workspace changes. No production deployment, shared-container restart, database modification, index, migration, infrastructure purchase or dependency change was performed. This is a validated implementation subset of the requested system-wide audit, not certification that every endpoint or workflow meets its performance target.

Measured work reductions: color vocabulary reads 40→2 per 20 options; image/video picker requests 2→1 when changing filters from page 2; reading-progress React commits 50→0 over 50 scroll frames; redundant variant storage PUTs 3→0 when compression returns the original JPEG/PNG buffer. These are query/request/render/storage counts, not claimed end-to-end latency improvements. Candidate source is not deployed.

The user selected an isolated environment on existing GitHub-hosted CI, within current quota. A manual regression workflow and guarded sampling/baseline tools have been implemented. Remote CI execution and a complete isolated application stack benchmark remain outstanding: workspace changes are uncommitted/unpushed and the session has no workflow-dispatch capability. No remote publication or spending was performed to work around this.

## Scope and agents

Work was divided by app to prevent overlapping edits. Three specialist subagents worked concurrently; a fourth specialist then independently reviewed the initial changes. After resumption, specialist agents hit account usage limits; Lead completed further tests and integration. No claim of independent review of later Lead tooling is made.

| Responsibility | Findings and implementation | Evidence / outstanding scope |
|---|---|---|
| API/backend | English color labels reloaded the same configuration for every option. Added lazy per-product mapping snapshot in `CatalogColorAccessibilityLabelService` and wired both detail/list paths in `JpaCatalogReadRepository`. No shared persistent cache or changed response values. | H2 and disposable PostgreSQL tests count queries and compare output; mapping refresh, VI/admin/no-color cases covered. 52 controllers and 211 HTTP mapping annotations inventoried from source; not 211 measured endpoints. Authenticated API latency/throughput remains unmeasured. |
| Database | Repeated small configuration queries avoided; existing pool/batching reviewed. No basis for adding an index to the seven-row vocabulary result. | Specialist read-only PostgreSQL EXPLAIN: execution 0.099ms, planning 1.236ms. Runtime has 1,025 color options across 96 products. This is one query observation, not an all-schema audit. Admin product reads still materialize all matches before Java collation/slicing; defer SQL replacement until exact Vietnamese ordering is proven. |
| Storefront | Progress bar updated React state and layout width every scroll frame. Replaced with ref/transform; retained portal, mobile visibility and reduced-motion behavior. | Four component tests; actual Chromium component harness checks widths, resize to desktop, reduced motion and unmount without page errors. Running-storefront browser baseline is separate from candidate. Full bundle/third-party/CDN optimization not claimed. |
| Admin | Image and video pickers requested new filters on old page, then page 1. Reset guard now runs before fetch. | 33 focused tests include search/folder/tag, stale success/error, rapid filter changes, and later pagination. Full unit suite described below. Products/orders/customer/media pagination exists at client/API interface; that does not prove efficient backend database pagination. |
| Media | Compression's fail-soft/original-byte result was uploaded again under same-format thumbnail keys. All same-buffer variants now skipped; original remains available. | Six new service test executions: JPEG/PNG/WebP skip, real PNG dimensions/MIME/transparency/custom bucket, mixed success/skip/storage failure, invalid/small input. Existing compression/upload tests also exercised. No real image/video upload-time or streaming-throughput benchmark. |
| Infrastructure | Loopback read sampling, container resource snapshot, cache/compression/pool configuration and ingress boundary inspected. Existing cache/compression mechanisms retained. | `docker ps`, `docker stats --no-stream`, `free -m`, `df -h /` on shared VPS. Disk 93%, 9.2GiB free at discovery; web 412.6MiB/1GiB, backend 974MiB/2GiB, PostgreSQL 157MiB/512MiB. Instantaneous CPU is not capacity evidence. No resource tuning or cleanup applied. |
| Independent QA | No concrete blocker in initial picker/progress/localizer diffs; required media, race and browser coverage before acceptance. Warned against using Git HEAD as Before when unrelated user edits exist. | Race/media/component-browser tests subsequently added. Full production workflow and deployed candidate comparison not independently verified. |

## Canonical evidence

- `docs/engineering/API_CONTRACT.md` §5 Media Library: retain pagination, filters, permissions and response semantics.
- `docs/engineering/DATA_CONTRACT.md`, Catalog visual facet configuration and media dimensions: preserve configured labels and stored-image metadata.
- `docs/business/BUSINESS_RULES.md`, MEDIA_RULE_006/008: retain original quality/transparency and original-object downloads.
- `docs/engineering/INTEGRATION_GUIDE.md`, media storage section: documented omitting unchanged variants before implementation.
- `docs/engineering/TESTING_GUIDE.md`, Performance validation: isolated CI, baseline identity and measurement boundaries.

## Before/After and baseline

| Component | Metric | Before | After | Interpretation |
|---|---|---:|---:|---|
| Catalog | Configuration SELECTs, 20 color options | 40 | 2 | 95% fewer configuration queries; H2/PostgreSQL assertions, same output |
| Admin | List requests after filter change from page 2 | 2 | 1 | 50% fewer requests in this scenario, both pickers |
| Web | React commits for 50 scroll frames | 50 | 0 | Component Profiler measurement; not INP |
| Media | PUT attempts for 3 unchanged JPEG/PNG variants | 3 | 0 | Controlled compression/storage test; original retained |
| API | Production-equivalent P95/P99 | Not measured | Not measured | No load applied to production |
| Database | End-to-end query time reduction | Not measured | Not measured | Query-count savings are proven; latency savings not established |
| Website | TTFB / LCP / CLS before-versus-candidate | Baseline only | Not measured | Local running old deployment is not candidate |
| Website | INP / Lighthouse score | Not measured | Not measured | No substitute based on component render count |
| Admin | Authenticated page-load latency | Not measured | Not measured | HTML shell timing excludes authenticated application |
| Media | Image/video upload time, download throughput | Not measured | Not measured | No production writes or transfer load |
| Infrastructure | Resource reduction | Snapshot only | Not measured | No equivalent candidate deployment |

Read-only runtime sample: five serial requests/path with 500ms delay, loopback, no compression request, all HTTP 200. Median total times: settings 11.171ms, categories 16.095ms, products 99.096ms, cached home 35.983ms, admin HTML shell 2.728ms. Five observations cannot substantiate tail SLOs; the JSON's nearest-rank p95/p99 are descriptive sample maxima only.

Old-container browser baseline: ten unthrottled localhost navigations across five surfaces and two viewports, short 1.5s observation window. Observed TTFB 16–473ms, LCP 256–1,832ms, CLS 0–0.074. These are preliminary observations, not field Core Web Vitals or an acceptance test. No source improvement inferred from them.

## Files and compatibility

Changed source: `bigbike-admin/src/components/{MediaPickerModal,VideoPickerModal}.jsx`, `bigbike-web/components/catalog/ReadingProgressBar.tsx`, backend `service/catalog/CatalogColorAccessibilityLabelService.java`, `repository/catalog/JpaCatalogReadRepository.java`, and `service/admin/ImageVariantService.java`.

Tests: picker test pairs, progress performance test, color test plus PostgreSQL subclass, and new `ImageVariantServiceTest`. Tooling: `.github/workflows/performance-validation.yml` and `scripts/performance/` guarded sampler, tests, source manifest and baseline preparation. Documentation/evidence: this report, media integration note, testing guide and `evidence/performance-2026-11-12/`.

No new public endpoint, request/response field, role, status, dependency, database index or migration. Missing optional image variants use existing original-image fallback. Previously stored objects are untouched. No source files that were already dirty at task start were modified by these optimizations, except small additive documentation entries in already-dirty canonical docs. Other pre-existing changes visible in `git diff` are not part of this performance result.

## Validation

- Admin full suite: **129 files, 1,240 tests passed**, one worker, 20s test timeout. Earlier default-5s shared-host runs timed out; no production code was changed to mask them.
- Web full suite: **119 files, 805 tests passed**, one worker, 20s timeout.
- Backend clean targeted suite: **35 tests passed**, including **four on disposable PostgreSQL**, zero skips/errors/failures.
- New sampler boundary tests: **5 passed**; rejects local/self-hosted execution, production hosts/normal ports, embedded credentials and URL path/query/fragment; validates percentile tails and separates successful requests from redirects without following them.
- Frozen baseline identities: six attributed files verified; local mutation attempt refused. Manifest reconstructs only these files in a separate CI checkout; unrelated candidate changes remain identical.
- Ingress positive and both deliberate-negative configuration tests passed.
- Candidate progress Chromium harness: mobile geometry, desktop hidden, reduced motion transition disabled, unmount cleanup, no page errors. Harness initially had visibility/scrollbar/CSS-transition assertions corrected; final source required no further change.
- Backend full suite, final build/lint statuses: recorded in final verification section below after completion.

`ImageVariantServiceTest` initially ran against an obsolete compiled class and reproduced the old duplicate PUT behavior; `mvn clean ... test` compiled current source and passed. Therefore final backend evidence uses the clean run, not stale target artifacts. XML environment properties, credentials, cookies, source datasets and raw application logs are not published in evidence.

## Risks and remaining work

1. CI workflow is prepared, not remotely executed. A green regression workflow would still not prove API load, Lighthouse, full checkout/admin CRUD, real upload/download or production readiness. The sampler does not provision the full isolated stack.
2. Admin server-side product materialization remains a scale risk. Preserve locale collation and exact result semantics before moving filtering/sorting/paging into SQL.
3. Media still decodes/resizes synchronously; repeated image decode and video throughput need isolated profiles before architectural changes. Current changes only remove unnecessary storage writes.
4. Full schema, all API/authenticated routes, CDN/DNS/TLS/HTTP3 and long-running resource behavior have not been exhaustively audited. No production-capacity claim.
5. Disk is 93% used. Identify owned build/cache/log/backup sizes and obtain approval before removal; no broad prune or cleanup.
6. Production deploy remains a separately approved action. Roll back by restoring the six attributed source files and rebuilding relevant images; no data rollback needed. Retain the deployed images before any future replacement. In source rollback, keep unrelated workspace changes intact.


## Additional verification

Independent Lead read-only repeat on `bigbike-postgres`:

```sh
docker ps --format '{{.Names}}\t{{.Status}}'
docker exec bigbike-postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atc "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT source_label, label_en FROM catalog_visual_display_terms WHERE active = TRUE"'
```

Result: sequential scan, seven rows, execution **0.118ms**, planning **9.566ms** at the
repeat observation. Plan saved in `vocabulary-explain.json`; no row contents or credentials
retained. This is a small read-only query on live data, not a before/after benchmark.
The earlier specialist observation differs in planning time, reinforcing that single
shared-host observations are not sufficient to size an index or claim a latency gain.

Additional admin compatibility check: five new original-image fallback cases plus
33 existing picker cases passed (**38/38**). No source change followed the full 1,240-test
admin run; the newly added fallback test was run separately. New test formatting and
ESLint were checked explicitly.


Frontend final gates: both `npm run lint` commands returned exit 0; Admin production
build completed (1m57s in the specialist run); Web `npm run build -- --webpack`
returned exit 0 with TypeScript and all 97 static pages generated. Existing Sentry
configuration and multiple-lockfile warnings were retained; they are not benchmark
results. The first new-test ESLint invocation from repository root could not locate an
app config; the corrected invocation from `bigbike-admin` returned exit 0.

The baseline reconstruction was also exercised against a temporary isolated Git
checkout with a simulated GitHub-hosted environment: all six resulting files matched
the original Git blobs exactly. This validates reconstruction mechanics, not actual
remote CI execution. The source-workspace application guard was separately refused.


## Final regression result and release blocker

Backend full suite completed with **1,560 test executions: 1,558 passed, one failure,
one skipped** across 201 report suites. Maven returned failure, so the backend full gate
is **NOT green**. Details are saved as sanitized counts/case names in
`backend-full-summary.json`.

The failing case is
`ArticleExcerptAuthorRemovalMigrationPostgresTest.removesArticleColumnsAndOnlyArticleAuditKeys`.
It executes only `V1091__remove_article_excerpt_and_author_fields.sql` against an isolated
PostgreSQL fixture. That migration subtracts keys from the outer JSON object; the test
also expects keys inside `translations` and `items` to disappear. The retained nested
`excerpt`/`authorName` keys trigger the assertion. Both the SQL and test files match
their Git HEAD blobs exactly; neither is touched by the six performance source changes.
This is a pre-existing migration/test mismatch, not an observed optimization regression.
No historical migration was edited, no assertion weakened, and no live audit records
were rewritten to force a green gate. Any data repair must be a separately reviewed
forward migration with canonical article/audit rules and data rollback considerations.

The skipped case is
`PublicReadApiTest.shouldReturnCategoryAndBrandDetailBySlug`, explicitly disabled because
V1000 catalog seed is unavailable in the H2 test context. It is not counted as passed.
All four PostgreSQL color tests and all six new variant service test executions passed.

Release/whole-system acceptance remains blocked by this existing full-suite failure,
unexecuted remote CI/full-stack load tests, and missing deployed Before/After media and
browser measurements. Frontend tests/builds/lint, targeted backend performance tests and
read-only/configuration checks passed. Do not label the entire optimization plan complete
or deploy to production based on this report alone.

The isolated rerun of the unchanged migration test reproduced the same failure (one test, one assertion failure, zero errors). See `preexisting-migration-rerun.json`. This confirms the finding outside the full-suite execution order.
