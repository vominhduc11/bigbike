# BigBike isolated performance continuation

This tooling prepares a reproducible **lab comparison**, not production acceptance.
Read `docs/audits/PERFORMANCE_OPTIMIZATION_2026-11-13.md` for measured component
results, source coverage and outstanding business workflows.

## Run boundary

Publish the reviewed frozen snapshot on a separate `ci/performance-validation-*`
branch. A push runs only on this public repository with standard ubuntu-24.04 runners;
manual dispatch is also available. Private manual runs require operator confirmation
of included quota. No paid runner, cache, artifact storage or external service is
provisioned. Sanitized bounded JSON results are compressed into job logs by
`publish_results.py`; retrieve logs and decode only the BBPERF framing. Raw private
logs remain in runner temporary storage. Production deployment is separately gated.

`run_ci.py` refuses local/self-hosted execution, a dirty source checkout, an
unapproved quota flag or a pre-existing Docker project. **Do not spoof CI flags
to run the stack/load test on the shop VPS.** File-only baseline unit exercises
may simulate flags in disposable source copies; they never start services.

The job creates only unique `bbperf-<run>-<attempt>-before|after` projects.
Compose is standalone, uses an explicit generated private env file, loopback
ports 18080/13000/14000/19000/15432 and an internal network with no outbound route.
It does not extend root Compose or use the shop env/volumes/accounts/buckets.
Authentication, CSRF, permissions, backend limits and API/web/admin nginx budgets
remain enabled. Real SMTP/Telegram/analytics/AI credentials are absent, and browser
requests to external hosts are blocked. Never publish private logs, traces, storage,
raw Lighthouse data, env files, cookies, SQL dumps or report XML.

## Source and data identity

`prepare_baseline.py --root .` verifies the three continuation source identities.
The Before snapshots retain earlier dirty PNG-compression changes and the four
optimizations from 12 November. Only collation-key caching and decoded-raster reuse
change between arms. Cache invalidation/auth/migration correctness repairs remain
identical. The old six-file manifest is historical, retained under `baselines/`.

The runner clones one clean revision twice, reconstructs only those three files,
then verifies a full tracked-tree identity/difference set. Both arms use the same
fixture bytes/toolchain/config/limits. Synthetic API catalog/hero/media setup is
captured privately as a PostgreSQL custom archive plus exact MinIO objects/MIME.
Restore happens before the measured JVM starts. The first provisioner JVM/Redis
is reset only inside its newly created job project; no limit reset occurs during
measurement. Normal later test writes generate new IDs/timestamps in each arm;
initial snapshot equality is not a claim that runtime databases remain identical.

## Gates and observations

- Candidate regression gates are mandatory and reject failures/errors/skips.
  Before images intentionally do not compile candidate-only test sources; this
  does not skip Candidate regressions.
- Real API setup, product edit/readback, guest cart/order totals, two-account
  profile/cart isolation, authenticated/unauthenticated boundaries and stored
  original download/metadata/alpha/Range are exercised by `stack_checks.py`.
- `browser.cjs` observes production pages at widths 375 and 1440, search, actual add/cart
  checkout, authenticated Admin pages, image delivery and local runtime/network
  errors. `admin_smoke.py` also runs the repository's real auth/quality fixture.
  Missing CRUD/bulk/variant/role/report scenarios remain explicit in the audit.
  Search submission waits for the heading and actual current-page fixture links
  to match a real public API reference read (same query/page/size/sort/language).
  That reference read warms API cache; it is not a cold-search claim.
- API stages 1/2/4 use fixed pacing, two repeats, 3s warmup / 12s measurements. Search
  stays below its normal 60/minute tier. Stop on any non-success, timeout, OOM,
  restart, memory 85% or host available RAM below 512MiB. Success-only P50/P95/P99
  coexist with every status/429/error count. This is closed-loop, low-load data.
- Docker resources, SQL aggregate counters and Hikari snapshots are collected;
  aggregate counters include collectors/background work, not exact queries/request.
- Lighthouse 12.8.2 is installed separately from app dependencies; lock/tool/image
  identities are retained. Browser Event Timing is lab evidence, not field INP.
  A first navigation is not labeled server-cold cache. Web lab Node 22/glibc differs
  from shipping Node 20/Alpine; CDN/TLS/HA topology is outside this experiment.

Only allowlisted sanitized JSON is published through bounded job logs. Inspect
`status.json` and partial results before interpreting a failed run. `comparison.json` requires two
completed, successful arms, identical dataset identities and matching repeats.
It labels a median of repeat P95s explicitly; it is not a pooled P95 or capacity SLO.

## Local safe checks

```sh
python3 -B -m unittest discover -s scripts/performance -p 'test_*.py'
python3 -B scripts/performance/prepare_baseline.py --root .
node --check scripts/performance/browser.cjs
bash deploy/nginx/tests/domain-boundary-config-test.sh --self-test
```

These are unit/source-boundary checks. They are not an executed full-stack result.

14Nov extension: seed10k synthetic simple DRAFT products using the real validate/commit
import APIs in100-row files, normal limits/permission/auth, then freeze the full initial
dataset. Only first-arm provisioning imports; both measured arms restore identical data.
The40 published fixtures remain separate. Sample ASC/DESC adjacent/middle/end pages,
compare full-row/ID hashes, and separately measure published vs large-draft Admin reads.
Resource sampling runs at most every3s; seed cutoff20min, sampled-page cutoff4min.
PostgreSQL1GiB/stack job90min are identical for both arms; no shop resource change.
Commerce correctness repairs and date-fixture correction remain in BOTH arms. Real
API/PG checkout409/reload/same-key retry and discontinued cases run separately from
primary PDP data. Helper tests do not establish that the hosted stack has executed.

16Nov extension: after all measurements, `merchant_checks.py` creates one separately
owned product, generic attribute and two values/variants through normal APIs. It
checks complete XML/header consistency and six real variant landing/switch cases
at375/768/1440, preserving the measured40/10k dataset. `merchant.json` records partial
phases on failure. This does not certify size/color/multi-axis variants or Google
account acceptance. Local Inventory without a configured store code must503; positive
TSV parity needs the actual configured code, never a fabricated shop identifier.
