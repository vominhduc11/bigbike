# Database and Admin catalog continuation — 2026-11-13

## Scope and status

This agent owns only `AdminCatalogReadService.java`, its new focused correctness test,
`scripts/performance/AdminNameSortBenchmark.java` and the database evidence files here.
No other existing source changes were altered. No shared service restart, write to the
shop database, migration, new index, dependency or configuration change was performed.

`database-inventory.json` enumerates **144** persistence/relevant source files and all
**94** current public schema table names. Only the ten explicitly noted files/method
groups have been read for this continuation; enumeration does not mean source review.
Per-component booleans explicitly leave functionality, workload measurement and
reverification false unless supported by later test evidence. The focused sort benchmark
below is component evidence, not an end-to-end measurement of these tables or APIs.

| Component | Source reviewed | Functional check | Performance measured | Status |
|---|---|---|---|---|
| Admin product list filtering/sort/paging | Yes: service, JPA projection, specification, repository interface, paginator | 5 unit tests passed (sort/filter forwarding only) | Java sort only | Comparator fixed and reverified; all-match hydration remains open |
| Product category/brand hydration | Yes: JPA list mapping | No deployed-candidate test | No query/request counts | Not verified under isolated load |
| Public product paging | Selected JPA methods/interface compared | No new runtime functional check by this agent | No | Public SQL paging remains unchanged |
| Checkout locks and price refresh | Selected transaction and batched lock method read | Not executed against shop | No contention measurement | Not verified under isolated concurrency |
| Customer order paging/order lock | Selected repository methods | No | No | Source evidence only |
| Hikari, Hibernate batch fetch, OSIV | Configuration read | Runtime DB session snapshot only | No pool-wait/load profile | No sizing changes justified |
| Other schema/repository components | Enumerated individually in JSON | No | No | Explicitly not verified; isolated workload required |

Canonical evidence: `docs/engineering/API_CONTRACT.md`, **Admin Catalog Contract →
Product admin lifecycle endpoints** and **Product list — filter and sort params (V111+)**;
`docs/business/BUSINESS_RULES.md`, `ADMIN_SEARCH_RULE_002`, `PRODUCT_RULE_002`;
`docs/engineering/DEPLOYMENT_GUIDE.md`, **Deployment Notes → Database connections**.
The user explicitly requires retaining Vietnamese ordering, filter/search results, totals,
page stability and permissions. This change is a computational optimization with exactly
the same output; no canonical business/API/data contract changes are needed.

## Confirmed bottleneck and bounded correction

`AdminCatalogReadService.listProducts` calls `findProductsFiltered`, which loads every
matching entity via `findAll(spec)`, maps the lighter list projection (including category
and brand data), filters homepage membership, sorts the full result and slices the page.
This remains an O(matches) hydration/memory and O(matches log matches) sort path.

The existing Vietnamese SECONDARY `Collator.compare` repeatedly analyzes the same name
for every comparison. The correction clones the same configured collator for each sort
and computes one `CollationKey` per distinct name in that request. Keys are discarded
after sorting. Case/accent semantics and ascending-id ties remain the same; direction,
filters, locale projection, publish/stock state, totals and permission enforcement do not
change. Default date, price and homepage sorts are untouched. This optimization is new
in this continuation and separate from the four historical optimizations.

Before source identity is SHA256
`5d55d35a2e7bd77b3fb615d8576ec8e57da76508133a149e0f3579d2c445e03a`.
The file was clean before the agent edit, so its HEAD blob was the exact pre-edit content
for this single file. This says nothing about the many other dirty workspace files.
The before copy was retained at `/tmp/bigbike-admin-catalog-read-service-before-20261113.java`.

## Actual component measurements

Command:

```sh
timeout 90s java -Xmx256m scripts/performance/AdminNameSortBenchmark.java
```

Same immutable, synthetic product-like names, Java 17.0.18, VI SECONDARY strength and
id tie-break in both paths; 3 warmups and 5 measured repetitions per size; seeded random
before/after order; paths run serially. Entire ascending and descending outputs are
asserted equal before measurements. No shop names or private records are exported.

| Synthetic matches | Before median sort ms | After median sort ms | Before cumulative allocated bytes/run | After cumulative allocated bytes/run |
|---:|---:|---:|---:|---:|
| 235 | 11.809 | 3.777 | 1,448,504 | 298,664 |
| 267 | 10.688 | 4.201 | 1,773,848 | 357,016 |
| 1,000 | 63.526 | 10.488 | 10,043,104 | 1,429,928 |
| 10,000 | 939.392 | 145.650 | 166,876,616 | 15,900,168 |

Raw repetitions, source identity and method limits are in
`admin-name-sort-component.json`. These are **not API/database P50/P95/P99**, include
shared-host/JIT/GC noise, and do not prove upload, checkout, CRUD or production capacity.
235/267 match the current non-trash/all-row cardinalities; values and names remain
synthetic. Large data is synthetic, not a copied production database. No end-to-end
Before/After API or SQL-hydration comparison has been run.

Allocated bytes are per-thread cumulative allocation measured by the JVM, **not peak
or retained heap**. The per-sort cache retains O(distinct names) keys until sorting ends;
peak heap must still be measured in the isolated full-stack workload.

## SQL ordering equivalence check

`database-collation-probe.json` captures a SELECT-only comparison on synthetic names.
The current database default `en_US.utf8` gives a different Vietnamese accent order than
Java. The installed `vi-VN-x-icu` gives the expected broad alphabet order on this sample
but **also differs from Java SECONDARY on case/decomposed-character ties**, even with
the same ascending-id tie-break. Example:

- Java: `Áo giáp`, `áo giáp`, `ÁO GIÁP`, decomposed `Áo giáp` (ascending ids).
- Default ICU VI: `áo giáp`, decomposed `Áo giáp`, `Áo giáp`, `ÁO GIÁP`.

Therefore a plain `ORDER BY name` or the existing default ICU VI collation would change
page membership. No SQL replacement was made. A future scalar key/index design needs
exhaustive output equivalence on representative text, duplicate-key pagination and all
filters, plus an isolated PostgreSQL workload before rollout.

## Read-only runtime observations

`docker ps --format '{{.Names}} {{.Status}}'` confirmed the service before access.
SELECT-only commands used `docker exec bigbike-postgres sh -c
'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" ...'`; credentials were read inside the
container and not printed. Synthetic SQL strings, aggregate counters and schema names
only were collected. No application mutation or load was sent to the shop.

At the saved snapshot: 267 products, 235 non-trash, 5 featured; 94 public tables;
350 indexes; PostgreSQL `max_connections=100`; 9 idle sessions and this one active
metadata query. A prior immediate observation showed 15 idle sessions, so these are
instantaneous counters, not stable workload capacity. `pg_stat_statements` is now both
preloaded and installed, unlike the old report's unverified pending configuration.
No raw query text, customer data, order keys or chat content was collected.

Source pool configuration remains maximum 20/minimum 5, 20s checkout timeout, 5s
leak report, batch-fetch size 25 and OSIV off. The snapshot does not justify changing
the pool, adding an index, vacuuming manually or tuning memory. Lock contention,
long transactions, pool wait, all-schema N+1, slow-query distributions and query/request
counts remain unverified pending a safe isolated workload.

## Correctness and rollback

`AdminCatalogReadServiceNameSortTest` covers exact old comparator ordering across every
page in both directions; VI accents/case/NFD and ascending-id ties; unchanged repository
filter forwarding and English projection; homepage filtering/totals; 24 concurrent
requests with independent sort keys. **Executed with Maven: 5 passed, 0 failures, 0 errors, 0 skipped; exit 0.**
Sanitized case/count/source identity evidence is in `database-sort-test-summary.json`.
No skipped case is counted as passed.

Rollback is only the imports and `case "name"` comparator block in
`AdminCatalogReadService.java`, then rebuild the backend. Keep unrelated existing
workspace edits intact. No data rollback or migration is necessary. This is not
deployment approval or whole-system performance acceptance.
