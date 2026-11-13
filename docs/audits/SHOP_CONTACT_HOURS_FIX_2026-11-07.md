# Shop hours, EN address and Maps — 07/11/2026

## Scope and evidence

Owner ticket A–E confirms STORE_HOURS_RULE_001, EN address, CID and Directions place ID.
Canonical references: `docs/business/BUSINESS_RULES.md` STORE_HOURS_RULE_001;
`docs/engineering/DATA_CONTRACT.md` “Shop introduction and EN address correction”; and
`docs/engineering/INTEGRATION_GUIDE.md` “Public shop content and Maps”. Deployment uses
`docs/engineering/DEPLOYMENT_GUIDE.md` VPS command. DEV7/8/9 report is historical context only.

Initial `git status --short` found pre-existing web/admin/config/docs changes, retained.
Initial `docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'` showed web, backend,
admin and infrastructure healthy. Backend public settings on localhost:8080 confirmed the
EN introduction still said Sunday 6:00 PM; EN contact address still said Ward 14/District 11.
Read-only `docker exec bigbike-postgres ... SELECT version,description,success FROM
flyway_schema_history ...` confirmed V1093 was the newest applied migration.

Initial `docker logs --tail 45 bigbike-web` showed existing stream-transform errors
(`controller[kState].transformAlgorithm is not a function`), oversized article-cache entries
and two image-content-type warnings. These precede this deployment and are not attributed
to A–E. Health alone is insufficient to establish page acceptance.

## Changes

- A: V1094 converts only verified VI/EN schedule clauses within `home_content_bottom_html`
  to `{{store_hours}}`. The public-settings web adapter resolves it from the shared schedule
  before homepage rendering and product settings serialization. Surrounding prose and editing
  remain available; other content/settings are untouched.
- B: clothing-size renderer uses shared hours; the old static body stores the same placeholder
  and its accessor resolves it. Routes: `/huong-dan/size-trang-phuc/` and
  `/en/guide/clothing-size/`. Online processing/support schedules are untouched.
- C: V1094 replaces only the exact old EN contact address. VI and other contact data remain.
- D: contact VI/EN iframe uses the confirmed CID; a shadcn Button link below the map uses the
  confirmed Directions place ID, with new-tab isolation. CSP permissions stay unchanged.
- E: contact displays the three shared complete schedule strings once each. Regular opening
  status uses the same opening/closing constants, including Sunday 17:00.

## Verification

- New web regression file: 10/10 passed on the first targeted run.
- Nginx domain-boundary self-test: positive and both negative controls passed.
- Web runtime-business-data guard: passed. No CSS added/removed. New UI copy reviewed in UTF-8.
- Web `npm run lint`: passed; explicit Prettier check of all new/edited web files passed.
- Full web `npm run test -- --maxWorkers=2`: 112/115 files and 790/793 tests passed; three
  tests hit their existing 5s limits under concurrent VPS load. Rerun of those three files
  with `--maxWorkers=1 --testTimeout=30000`: 3/3 files, 10/10 tests passed, no code change.
- Admin lint: passed (runtime-data, i18n, Prettier and ESLint).
- Fresh test database applied all 457 migrations successfully through V1094.
- Read-only browser baseline: existing homepage navigation timeout and contact/guide 503s;
  web became unhealthy (health checks exceeded 5s). See `evidence/shop-contact-hours-2026-11-07/browser-before.json`.
- Backend `./mvnw test`: 1,540 tests, 1,538 passed, 1 failed, 1 skipped; exit 1.
  V1094's preservation/idempotence regression passed. The failure is the existing
  `ArticleExcerptAuthorRemovalMigrationPostgresTest` against historical V1091: nested audit
  fields remain. Both V1091 and its test have zero working-tree diff; V1091 was already applied
  before this ticket. They are outside A–E and were not changed. See the backend summary JSON.
- Concurrent admin test / local web build were deliberately terminated (143) to reduce VPS
  load after page-generation timeouts. These are not counted as passing. Checks continue serially.
  Backend live logs during the slowdown showed database-connection acquisition timeouts
  (`total=20, active=20, idle=0, waiting=67`); read-only activity counts showed idle-in-transaction
  connections. No service was manually stopped/restarted and no live DB write was performed.
- Serial admin `npm run test -- --maxWorkers=1 --testTimeout=30000 --reporter=dot`:
  129/129 files, 1,228/1,228 tests passed, exit 0. No admin source/test was changed.
- Serial admin `npm run build`: passed, exit 0. Serial web `npm run build`: passed,
  exit 0, 97/97 pages; TypeScript passed. No timeout occurred in the successful serial run.
- Environment checksums and hashes of unrelated tracked work match their baselines.
- Full-stack command `docker compose --env-file .env.vps up -d --build` started after these
  checks. Immediately before it, `docker ps` showed all six BigBike services healthy. Three
  previous application images were retained as `*:before-shop-contact-20261107` tags.
- Deployment and deployed acceptance results are recorded below.

No commit/push, env edit, inventory/Meta reimplementation or Clarity activation is part of this task.

## Files changed for this ticket

| File | Purpose |
|---|---|
| `bigbike-web/lib/content/store-hours.ts` | Shared placeholder expansion and regular opening-status calculation. Existing hour values retained. |
| `bigbike-web/lib/api/public-api.ts` | Expand the introduction placeholder at the existing public-settings boundary. |
| `bigbike-web/components/contact/ContactPageContent.tsx` | Correct map/route, reuse Button, remove duplicate day labels and use shared closing boundaries. |
| `bigbike-web/components/guide/ClothingSizeGuideContent.tsx` | Shared localized shop hours. |
| `bigbike-web/lib/content/static-pages.json` | Replace only the old clothing-size schedule with the shared placeholder. |
| `bigbike-web/lib/content/static-pages.ts` | Resolve that placeholder when the clothing-size static body is reused. |
| `bigbike-backend/src/main/resources/db/migration/V1094__sync_shop_hours_content_and_english_address.sql` | Conditional persisted-content/address correction; no schema change. |
| `bigbike-backend/src/test/java/com/bigbike/bigbike_backend/migration/ShopContentCorrectionMigrationPostgresTest.java` | Real PostgreSQL checks for preservation, guards and idempotence. |
| `bigbike-web/__tests__/content/store-hours.test.tsx` | Ten regression cases for content expansion, UI, map and closing boundaries. |
| `bigbike-web/e2e/shop-contact-hours.e2e.ts` | Read-only deployed acceptance, runtime guards and responsive contact screenshots. |
| `docs/business/BUSINESS_RULES.md` | Owner-confirmed shared-content/Maps/address rules. |
| `docs/engineering/DATA_CONTRACT.md` | Placeholder and conditional data-repair contract, documented before source changes. |
| `docs/engineering/INTEGRATION_GUIDE.md` | Public-settings expansion, exact Maps destinations and unchanged Clarity prerequisite. |
| `docs/engineering/DEPLOYMENT_GUIDE.md` | Required full-stack VPS command, measured memory blocker and deployed acceptance procedure. |
| `docker-compose.yaml` | Only backend memory 1g → 2g beyond the pre-existing feed/env changes; necessary to complete deployed acceptance. |

Public data changes: only the introduction's verified hours clause in VI/EN and the exact old
EN contact address. No historical migration, `.env`, `.env.vps`, inventory feed, Meta implementation
or Clarity configuration was edited. The skipped backend case requires disabled V1000 catalog
seed data that is absent from the H2 test environment.

## Deployed acceptance blocker and necessary resource correction

The first exact full-stack command exited 0, all six services reported healthy and V1094 was
applied. The first deployed acceptance failed: direct settings/public returned 500. No success
was claimed for that attempt. Read-only `docker stats --no-stream` showed backend about
911 MiB/1 GiB and sustained CPU pressure. `docker logs --since 3m bigbike-backend` showed G1
retaining 481–485 MiB out of 512 MiB with collections every 40–60 ms; connection-timeout logs
showed all 20 connections checked out. Grouped `pg_stat_activity` counts confirmed these sessions
were idle in transaction awaiting the application, rather than blocked on database locks.

Canonical deployment documentation was updated before the sole additional Compose edit:
backend memory 1g → 2g, keeping Java's existing 50% heap policy. The VPS had about 3.9 GiB
available before this increase. This is a deployment acceptance repair, not a catalog/feed rule
change. All existing feed, Meta, Clarity, env and other resource settings are preserved. The
same full-stack command is rerun and acceptance must pass against that deployed result.

## Deployed source and HTTP acceptance

- Repeated the exact `docker compose --env-file .env.vps up -d --build` command after the
  documented Compose memory adjustment: exit 0. All six services healthy; backend runtime
  memory limit is 2,147,483,648 bytes. A direct EN settings read returned 200 in 0.047s,
  with backend observed at 2.17% CPU / 682 MiB rather than the earlier GC pressure.
- Refreshed the existing settings cache through the web's documented authenticated
  `/api/revalidate` mechanism (200); the token was read inside the web process and never printed.
  A first EN guide read still carried a stale address; the regenerated route was checked again
  and contains zero old-address occurrences. Cloudflare reported DYNAMIC, so this was the app's
  stale-while-revalidate route cache. No CDN or CSP setting was changed.
- Completed current-version HTTP acceptance on 7 paths: homepage EN, contact VI/EN, clothing-size
  VI/EN, product VI/EN. All return 200 after canonical redirects, correct hours, no old Sunday
  18:00/6:00 PM or Ward 14/District 11, no unresolved placeholder and no Clarity loader.
- Backend public settings prove exact surrounding introduction prose preservation, unchanged VI
  address and the correct EN address. Hash comparison over 38 settings per locale found only
  the intended changes: introduction in VI; introduction and contact address in EN.
- Live HTTPS XML/TSV: 200, 1,184 items, all IDs/availability/prices match. Googlebot HEAD: 200
  for both URLs with correct content types. A default Python User-Agent had received 403;
  browser User-Agent and Googlebot succeeded without any security-rule changes.
- Both env-file hashes match the initial values. All unrelated tracked file hashes match;
  for Compose, reverting only the new backend 2g limit in memory reproduces its baseline hash,
  proving the pre-existing feed/analytics/config changes were preserved exactly.
- Evidence: `evidence/shop-contact-hours-2026-11-07/deployed-verification.json`.
- Browser/runtime/responsive/Meta checks completed successfully below.

## Final browser and service acceptance

- `PW_BASE_URL=https://bigbike.vn E2E_BASE_URL=https://bigbike.vn npx playwright test
  e2e/shop-contact-hours.e2e.ts e2e/local-inventory-hours.e2e.ts --workers=1 --reporter=line`:
  **4/4 passed, 2.3 minutes**, exit 0, on the actual deployed HTTPS version.
- The new test checks homepage EN introduction, product VI/EN, size VI/EN, contact VI/EN,
  all three footer hours, no old address/hours/unresolved placeholder, exact iframe and Directions
  URLs, one day/holiday label per row, 1440×900 and 390×844 contact layouts, no horizontal overflow,
  no serious console/render/network issue and no failing API response. Existing Meta locale-switch
  test still observes exactly one ViewContent carrying eventID; complete inventory comparison passes.
- Four current screenshots were retained. Visual review of VI desktop and EN mobile confirms the
  Shop Bigbike pin, Directions below the map, correct address and hours without duplicate labels.
- Final `docker ps`: backend, web, admin, PostgreSQL, Redis and MinIO **healthy**. Backend observed
  at 8.25% CPU / 1.003 GiB of 2 GiB after browsing; web about 298 MiB of 512 MiB.
- From successful HTTP acceptance through browser acceptance, web/backend/admin logs contain
  **zero error entries**; see `post-browser-log-summary.json`. Earlier startup logs retain one
  client-aborted response/serialization error (03:46:29 UTC, not a pool timeout) and the existing
  web stream-abort signature before acceptance. These were not concealed or attributed to A–E.
- `docker compose --env-file .env.vps config --quiet` and final `git diff --check`: passed.
  Both exact full-stack deployment invocations returned 0; the second includes the documented
  backend-memory correction. No service-specific deployment command, manual restart, down,
  volume removal or prune was used.
- No commit/push. Env files, existing inventory/Meta/Clarity changes and other workspace work
  preserved. Canonical documentation was updated before relevant data/config source edits.
- **Not verified:** opening the Google Maps app on a physical phone. Exact URL/place ID and
  the rendered Shop Bigbike map pin are verified. The unrelated historical V1091 test failure
  and H2 seed-dependent skipped test remain disclosed above.

Final evidence: `deployed-verification.json`, `live-e2e.txt`, `backend-summary.json`,
`post-browser-log-summary.json` and four contact screenshots in
`docs/audits/evidence/shop-contact-hours-2026-11-07/`. Full local command logs remain under
`/tmp/bigbike-store-fixes/`; they were not published wholesale.
