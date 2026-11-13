# Backend/API and migration continuation — 2026-11-13

## Scope and result

Implemented one forward data correction and restored one skipped functional test.
These are correctness/acceptance-gate repairs, not a new claim of latency improvement.
No shop database modification, production migration, deployment, shared-container
restart, dependency/index change, commit or push was performed.

Canonical basis:

- `docs/business/BUSINESS_RULES.md`, ARTICLE_RULE_001/007/010/011.
- `docs/engineering/API_CONTRACT.md`, Audit Log Contract and public catalog responses.
- `docs/engineering/DATA_CONTRACT.md`, Article bilingual content / forward V1095.
- `docs/engineering/DEPLOYMENT_GUIDE.md`, Schema And Migration Notes / forward V1095.

Lead updated canonical docs before implementation. The private backup and guarded
data rollback procedure is prepared in `article-audit-repair-runbook.md`; it has not
been executed on shop data.

## Root cause and correction

The historical V1091 JSONB subtraction removes only properties on the outer object.
The existing test also requires retired article keys inside translations and arrays
to disappear. This is an implementation gap and an incomplete migration sequence in
the test. The canonical audit contract already requires old article snapshots to be
cleaned. V1091 is immutable: its current Git blob and HEAD both equal
`5df91cb25b7fb38b4e8cfdb5fa01f496b15c6358`.

V1095 traverses JSON objects/arrays and removes exactly `excerpt`, `excerpt_en`,
`authorName`, `authorNameEn` only for resource_type CONTENT and action prefix
CONTENT_ARTICLE_. It keeps array order, scalar values, text mentioning property names,
all other modules/actions, malformed/unrepresentable snapshots and unchanged formatting.
Rows whose JSON does not change are not rewritten. Temporary helper functions are
dropped before completion; no application helper/schema remains.

The original `removesArticleColumnsAndOnlyArticleAuditKeys` assertions remain intact;
the test now runs V1091 then V1095. New independent PostgreSQL fixtures cover direct
repair of an already-migrated database, exact action scoping, nested/empty/null/scalar
JSON, strings containing key names, malformed data, idempotence/no row rewrite and
transaction rollback. Independent QA additionally identified PostgreSQL JSONB parse
failures for escaped NUL (22P05) and huge numeric values (22003). The parse-only handler
now preserves those text snapshots too; corresponding byte/xmin cases were added.
No general error handler hides other migration failures.

The disabled public category/brand test no longer depends on a missing catalog seed.
It creates unique synthetic category/brand records using existing isolated H2 helpers
and checks returned IDs, names and slugs. The original test is enabled; assertions were
strengthened rather than removed. No application mock or permission change was added.

## Verification and limits

Initial clean targeted Maven run: **26 passed, zero failed/errors/skipped** in 2m53.
Sanitized counts/case names are in `backend-migration-tests.json` (no raw test XML,
properties, cookies or application logs are published).

- PublicReadApiTest: 22 passed, zero skipped.
- ArticleExcerptAuthorRemovalMigrationPostgresTest: 1 passed.
- NestedArticleAuditCleanupMigrationPostgresTest: 2 passed.
- PerformanceCiSchemaMigrationPostgresTest: 1 passed.

Fresh PostgreSQL16 rehearsal ran 457 Flyway migrations (canonical sequence plus only
two existing synthetic catalog compatibility fixtures) through V1095, then Flyway
validation. The fixture contains no customers/orders/admin accounts. Observed migration
execution was 13.067s, not a production-duration forecast. Hibernate/runtime schema
validation and the real CI stack startup remain separate gates.

The two synthetic compatibility fixtures are V26_5 and V1028_5. Current V27 itself
already guards missing product IDs (its older fixture comment is stale); V1029 still
requires 109 sized products. The old V1070_5 fixture contains a real technical email
and is deliberately excluded. Current V1071 permits an absent technical account;
V1083 permits no historical orders. No historical migration was edited.

The corrected JSONB edge cases were subsequently exercised in Lead's initial full
backend run: `backend-full-initial-summary.json` records **1,572 executions, 1,571
passed, one failure, zero errors/skips**. The corrected migration cases passed in
that run; the sole failure was `Phase1DCustomerAuthTest.login_withPhone_succeeds`.
This remains a failed historical full gate, not an all-green result. Lead's later
`auth-cache-targeted-summary.json` records 32 targeted cases passed after the fixture
and cache changes; it does not replace the required final full-suite rerun. The
initial 26-pass run alone does not validate the later parse-handler correction.

## Backend source inventory

`backend-inventory.json` records actual source locations/annotations and per-component
status. It distinguishes inventory from manual review, functional testing and measurement.

- 53 controller classes including HealthController, 212 HTTP method annotations;
  the prior API-only count was 52/211. This counting difference is not a new route.
- 20 scheduled/asynchronous declarations.
- 61 entity files and 67 repository files.

This is not an all-query, all-endpoint or background-task performance audit. Authenticated
network latency, scheduler duration, pool/lock capacity, complete API permission behavior,
all indexes/N+1 patterns and production workload tails remain unmeasured by this agent.
The full backend regression gate and cross-system acceptance are owned by Lead.

## Risk and rollback

V1095 changes retained article audit data irreversibly unless a protected backup exists.
Invalid/unrepresentable snapshots remain for operator review. The actual audit volume,
lock duration and rollback restore have not been exercised against shop data. An image
rollback alone cannot restore removed keys. Do not edit Flyway history or published
migrations. Before approved rollout, back up the exact eligible IDs privately, rehearse
restoration in isolation and use compare-and-swap checks against after-values to avoid
overwriting later edits. Application data, article content and unrelated audits are out
of scope for the repair.
