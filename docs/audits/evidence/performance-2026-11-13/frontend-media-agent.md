# Frontend and media investigation — 2026-11-13

This is a bounded investigation against the dirty workspace. It does not certify
all website/admin screens, production performance, real uploads, or Core Web Vitals.
The four optimizations in the 2026-11-12 report are existing work, not new results.

## Inventory and coverage

`frontend-media-inventory.json` enumerates **49 web page/route/metadata source files**,
**32 admin screen modules**, and **32 render-switch cases** from the actual workspace.
Each entry records its hash, source boundary, runtime-function status, performance
status, and whether it was fixed in this pass. Route groups are removed from the
internal path hints; public VI/EN URL rewrites must still be resolved through
`bigbike-web/i18n/routing.ts` and `proxy.ts`. Counts are source files and render
cases, not a count of independently measured URLs or fully audited workflows.

Every entry was structurally inventoried (imports, route wiring and direct API
module boundaries); full semantic/CRUD/permission audits are explicitly unverified
unless covered by the focused source reviews below. The old container deployment
was not used as candidate evidence. No shared-container writes or load were run.

| Surface | Source work in this pass | Function evidence | Performance evidence / missing work |
|---|---|---|---|
| Web home/catalog/PDP/search/content/account/auth/cart/checkout | Enumerated source routes and import boundaries. Reviewed public/client API separation, PDP/gallery image sizing, reading-progress behavior and checkout selectors. | Focused price/variant/checkout tests passed; not a real end-to-end purchase. | No production browser/mobile/desktop timing from this candidate. LCP, INP, Lighthouse, interaction and account acceptance await isolated CI. |
| Admin active screens | Enumerated actual lazy screen modules and render cases; inspected permission route wiring and existing E2E helpers. | Focused session/auth/media-picker tests passed. CRUD, reports and bulk operations are not implied by these passes. | Authenticated list/search/edit/browser timing awaits isolated CI. |
| Admin image/video pickers | Prior filter-reset guard remains before fetch, stale success/error responses gated by cleanup, pagination preserved. | Picker tests include old-page filter reset, rapid filters, stale response/error and pagination; original fallback included. | Existing request-count improvement retained; real transfer or click latency not measured here. |
| Web reading progress | Prior ref/transform implementation retains requestAnimationFrame cleanup and portal/mobile/reduced-motion behavior. | Four performance component cases passed within focused web run. | React update count is not INP; no new improvement claimed. |
| SEO/Merchant/local inventory/tracking | Inspected feed force-dynamic/no-store/failure handling, actual media image sizing, Meta eventID/variant view dedup and purchase ID. | Focused SEO, Merchant and analytics suites passed. | Real Merchant acceptance, tracking delivery, deployed landing pages, private two-user cache behavior remain unverified. CI must leave analytics IDs/secrets blank and block external collection. |
| Media upload | Inspected real multipart validation, original compression, dimensions, checksum/dedup, storage PUT, variants and download path. Reused one decoded source for variants after profiling. | 26 media-targeted cases passed with fresh main/test compilation; byte equality and alpha verified. | Offline decode/compression profile measured below. Upload/network/storage/MP4/Range/streaming acceptance still requires real isolated stack and valid media files. |

## Current focused functional checks

Evidence: `frontend-media-focused-tests.json` records only sanitized suite paths and
counts, excluding raw logs/environment values.

- Admin: **5 files, 63 passed, 0 failed, 0 pending/skipped**. Command from
  `bigbike-admin`: `npm run test -- src/components/MediaPickerModal.test.jsx src/components/VideoPickerModal.test.jsx src/lib/mediaOriginalFallback.test.js src/lib/adminApi.session.test.js src/lib/auth.test.jsx --maxWorkers=1 --testTimeout=20000 --reporter=json --outputFile=/tmp/bigbike-admin-perf-20261113.json`.
- Web: **25 files, 272 passed, 0 failed, 0 pending/skipped**. Command from
  `bigbike-web`: `npm run test -- __tests__/analytics __tests__/merchant __tests__/seo __tests__/checkout __tests__/catalog-price-filter.test.ts __tests__/utils/variant-match.test.ts components/catalog/ReadingProgressBar.perf.test.tsx --maxWorkers=1 --testTimeout=20000 --reporter=json --outputFile=/tmp/bigbike-web-perf-20261113.json`.

The two commands ran sequentially with one worker. They are focused unit/component
checks and do not replace a full-suite rerun, frontend production build/lint or
functional checks against real services.

## Media findings before any new source change

`ImageVariantService.generateAndUpload` decodes the stored source once for width
and transparency, then `ImageCompressionService.compress` decodes the same bytes
again for each eligible target width (300/800/1600). A source wider than 1600px
therefore incurred four full image decodes for its variant set. This source
finding was profiled before editing the main implementation. Decode-only samples
showed four versus one decode allocating roughly 64→16 MB (JPEG), 94→24 MB
(opaque PNG) and 119→30 MB (alpha PNG), which justified a bounded reuse change.

`AdminMediaService` also invokes `ImageDimensions.read` before and after original
compression, and that helper fully decodes the raster. It is used by brand-logo
validation/import too: replacing it with header-only dimensions could accept
truncated payloads that previously failed decoding, so this investigation leaves
that path unchanged. Original compression, transparency checks and original
storage remain governed by `BUSINESS_RULES.md` `MEDIA_RULE_006/008` and
`INTEGRATION_GUIDE.md` media storage section.

Video uploads are stored as accepted MP4 bytes and skipped by image-variant
generation. The inspected media path does not transcode uploaded MP4 with ffmpeg.
YouTube home-video synchronization is a separate scheduled remote integration.
Neither source fact demonstrates download Range support, playability or latency.

## New media change and verification

`ImageCompressionService` now offers an internal decoded-source overload, and
`ImageVariantService` passes its already decoded raster to it. Both paths use the
same existing resize/encode/quality/alpha/fail-soft implementation. No concurrency,
background queue, request/storage architecture, original image, accepted MIME,
permission, response field or data schema changed. The decoded image remains a
request-local value; there is no shared or persistent cache. All preceding dirty
edits, including `compressAdminOriginal` and the old unchanged-variant PUT skip,
remain present. Pre-change exact file snapshots and hashes are recorded in
`frontend-media-before-manifest.json`; this pass is additional to the four old
optimizations, not a rerun credited as new work.

The final paired component profile compiled the preserved pre-change actual
compression source and the candidate into separate temporary class directories,
then ran the two JVMs sequentially. Both used the same JDK, dependency jars,
256 MB maximum heap, deterministic or committed fixture bytes, two warm-up sets
and five measured sets per file. `VariantDecodeProfile.java` records fixture and
output hashes plus dimensions/transparency. `media-profile-paired-before.json`,
`media-profile-paired-after.json` and `media-profile-comparison.json` retain the
raw sample arrays and comparison. Every produced byte sequence, dimension and
alpha result matched exactly across arms.

| Fixture / component variant set | Decodes before→after | Median before→after | Thread allocation before→after |
|---|---:|---:|---:|
| JPEG, 2000×1200 | 4→1 | 799→425 ms | 120.2→72.4 MB |
| Opaque PNG, 2000×1200 | 4→1 | 1366→1052 ms | 145.0→74.0 MB |
| Transparent PNG, 2000×1200 | 4→1 | 2953→2469 ms | 181.9→92.5 MB |
| Existing valid wide WebP fixture | 4→1 | 105→27 ms | 27.9→7.5 MB |
| Existing small alpha WebP, no eligible variants | 1→1 | 5.2→7.0 ms | 0.151→0.151 MB |

The small WebP case does not use the new reuse branch; its observed increase is
reported without claiming a benefit. Five samples on a shared host provide
descriptive component timings only. These are neither P95/P99 values nor real
upload transfer/storage wall times, peak RSS, concurrent capacity or production
acceptance. The profile excludes MinIO entirely; targeted service tests separately
exercise output MIME, custom bucket, original-object fallback and independent
storage failure for each variant.

`media-targeted-tests.json`: **26 passed, zero failures/errors/skips** across
`ImageCompressionServiceTest` (14), `ImageDimensionsTest` (3),
`AdminMediaServiceUploadTest` (3) and `ImageVariantServiceTest` (6). Maven explicitly
recompiled 691 main and 205 test source files before running; the result is not
from stale bytecode. The new tests compare exact output bytes at 300/800/1600/2000
pixels for JPEG, opaque PNG and transparent PNG, verify the input pixels remain
unchanged, exercise WebP/original reference fallback, and ensure all eligible
variants receive the same request-local decoded object. Original storage and
partial failure assertions remain intact.

Rollback: remove only the decoded-source overload/delegation and the one variant
call-site change, retaining the preceding PNG-original optimization and all other
user edits, then rebuild the backend image. No data/object rollback is required.
Residual risk is future code mutating a shared decoded source during resize;
current byte/pixel equality tests guard that behavior. No image pooling across
requests is introduced.

## Isolated browser guidance sent to Lead

- Use the real dev-profile `DataInitializer` on an empty CI database with a unique
  synthetic admin email/password. Set E2E credentials explicitly; never use the
  old default shop email/password from E2E helpers. Keep admin login at one per
  worker (5/min/IP), refresh serial (30/min/IP), preserve cookie rotation.
- Derive seeded product/category/variant IDs and slugs from CI fixtures/API;
  existing web E2E samples hardcode actual shop catalog slugs and are unsuitable
  as isolated-fixture identifiers.
- PDP selectors: `[data-purchase-section]`, `[data-variant-picker] [role="radiogroup"]`,
  `[role="radio"]`, `[data-purchase-add]`; choose a complete available variant
  combination before adding a real cart item.
- Checkout requires a nonempty real cart; assert `[data-checkout-form]` exists,
  fill `#billing_full_name`, `#billing_phone`, `#billing_email`,
  `#billing_address_1`, province/ward comboboxes, check confirmation and submit.
  The existing shipping-address E2E skips if form is absent; that skip must not
  count as acceptance of an isolated-stack checkout.
- Existing admin route catalog omits the live discontinued-products screen:
  `App.jsx` wires `/admin/discontinued-products` with `productsRead` policy. A
  generated route inventory must use actual App wiring rather than assume the
  older E2E smoke catalog is exhaustive.

## Outstanding acceptance scope

No new claim is made for concurrent capacity, real upload/download/streaming,
authenticated UI interaction times, INP, Lighthouse, p95/p99, whole-site SEO,
external Merchant approval, tracking delivery, or production safety. These each
need the isolated candidate stack and measurable scenarios prepared by Lead.
