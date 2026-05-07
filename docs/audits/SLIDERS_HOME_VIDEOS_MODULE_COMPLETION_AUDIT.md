HISTORICAL_REPORT_ONLY - Not canonical. Validate against current code and canonical docs.

# Sliders / Home Videos Module Completion Audit

## Executive Summary

- Overall status: READY
- Sliders status: READY - route, API, validation, permission, DB behavior, public rendering, and backend/public-web tests are now production-ready for the audited scope.
- Home Videos status: READY - P0/P1 security, sort-order integrity, OpenAPI sync, admin i18n/UX, CSP/media policy, and required backend/public-web tests are remediated.
- Highest-risk issues:
  - No open P0 findings remain for Sliders / Home Videos.
  - No open P1 findings remain from the original completion audit.
  - Remaining non-blockers are limited to P2 follow-ups such as Product Picker UX for Sliders, modal focus trapping, broken-image fallback polish, and off-brand dev seed cleanup.
- Recommended release decision: READY for the audited Sliders / Home Videos scope. Repo-level unrelated lint debt in other `bigbike-web` modules should be tracked separately and does not block this module verdict.

Baseline docs consulted:

- `docs/engineering/API_CONTRACT.md:116-123`, `docs/engineering/API_CONTRACT.md:234-235`
- `docs/engineering/PERMISSION_MATRIX.md:80-83`, `docs/engineering/PERMISSION_MATRIX.md:384-393`, `docs/engineering/PERMISSION_MATRIX.md:446`
- `docs/business/MODULE_CATALOG.md:55`, `docs/business/MODULE_CATALOG.md:91`, `docs/business/MODULE_CATALOG.md:150`, `docs/business/MODULE_CATALOG.md:156`
- `docs/engineering/API_FLOW_MAP.md:177-178`

## Scope Inspected

Docs and audit gates:

- `AGENTS.md`
- `docs/DOCS_VERIFICATION_REPORT.md`
- `docs/business/PROJECT_OVERVIEW.md`
- `docs/business/MODULE_CATALOG.md`
- `docs/business/USER_ROLES.md`
- `docs/engineering/ARCHITECTURE.md`
- `docs/engineering/API_CONTRACT.md`
- `docs/engineering/API_FLOW_MAP.md`
- `docs/engineering/DATA_CONTRACT.md`
- `docs/engineering/PERMISSION_MATRIX.md`
- `Bigbike Design System/README.md`
- `Bigbike Design System/colors_and_type.css`

Backend Sliders:

- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminSliderController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/public_/PublicSliderController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSliderService.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/slider/SliderReadService.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/slider/SliderEntity.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/slider/SliderJpaRepository.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/UpsertSliderRequest.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/PatchSliderRequest.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/ReorderSlidersRequest.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/public_/dto/PublicSliderResponse.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/ImageAssetRequest.java`

Backend Home Videos:

- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminHomeVideoController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/public_/PublicHomeVideoController.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminHomeVideoService.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/video/HomeVideoReadService.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/video/YouTubeUrlParser.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/video/HomeVideoEntity.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/video/HomeVideoJpaRepository.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/UpsertHomeVideoRequest.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/PatchHomeVideoRequest.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/ReorderHomeVideosRequest.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/public_/dto/PublicHomeVideoResponse.java`

Backend security, OpenAPI, and migrations:

- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminRolePermissions.java`
- `bigbike-backend/src/main/resources/openapi/bigbike-openapi.json`
- `bigbike-backend/src/main/resources/db/migration/V17__create_sliders_table.sql`
- `bigbike-backend/src/main/resources/db/migration/V19__backfill_homepage_data.sql`
- `bigbike-backend/src/main/resources/db/migration/V27__fix_slider_links_to_product_id.sql`
- `bigbike-backend/src/main/resources/db/migration/V33__fix_slider_image_urls_to_wp_origin.sql`
- `bigbike-backend/src/main/resources/db/migration/V34__add_slider_is_active.sql`
- `bigbike-backend/src/main/resources/db/migration/V35__create_home_videos_table.sql`
- `bigbike-backend/src/main/resources/db/migration/V36__add_youtube_id_to_home_videos.sql`
- `bigbike-backend/src/main/resources/db/migration-dev/V1006__seed_home_videos_dev.sql`

Admin FE:

- `bigbike-admin/src/App.jsx`
- `bigbike-admin/src/screens/SliderListScreen.jsx`
- `bigbike-admin/src/screens/HomeVideoListScreen.jsx`
- `bigbike-admin/src/components/ImageUrlInput.jsx`
- `bigbike-admin/src/components/VideoPickerModal.jsx`
- `bigbike-admin/src/lib/adminApi.js`
- `bigbike-admin/src/lib/mockData.js`
- `bigbike-admin/src/locales/vi.json`
- `bigbike-admin/src/locales/en.json`
- `bigbike-admin/src/screens/RolesScreen.jsx`

Public web:

- `bigbike-web/lib/api/public-api.ts`
- `bigbike-web/lib/contracts/public.ts`
- `bigbike-web/lib/utils/format.ts`
- `bigbike-web/app/page.tsx`
- `bigbike-web/components/home/HeroSlider.tsx`
- `bigbike-web/components/home/HomeVideoCarousel.tsx`
- `bigbike-web/next.config.ts`

Tests:

- `bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/SliderApiTest.java`
- `bigbike-backend/src/test/java/com/bigbike/bigbike_backend/schema/SliderRepositoryTest.java`
- `bigbike-backend/src/test/resources/db/test-seed.sql`

## Route & Screen Audit

| Area | Expected | Actual | Status | Evidence |
|---|---|---|---|---|
| Admin route `/admin/sliders` | Route exists, lazy import resolves, guarded by `sliders.read`. | Route parser, nav item, route permission, lazy import, and screen render are wired. | PASS | `bigbike-admin/src/App.jsx:41`, `bigbike-admin/src/App.jsx:81`, `bigbike-admin/src/App.jsx:156`, `bigbike-admin/src/App.jsx:194`, `bigbike-admin/src/App.jsx:367` |
| Admin route `/admin/home-videos` | Route exists, lazy import resolves, guarded by `home_videos.read`. | Route parser, nav item, route permission, lazy import, and screen render are wired. | PASS | `bigbike-admin/src/App.jsx:42`, `bigbike-admin/src/App.jsx:83`, `bigbike-admin/src/App.jsx:157`, `bigbike-admin/src/App.jsx:195`, `bigbike-admin/src/App.jsx:368-369` |
| Sidebar navigation | Sidebar should show modules only when user has read permission. | Nav uses permissions and supports wildcard `*`. No `home-videos.write` vs `home_videos.write` mismatch found. | PASS | `bigbike-admin/src/App.jsx:248`, `bigbike-admin/src/App.jsx:256-267`, `bigbike-admin/src/App.jsx:81-83` |
| Permission denied route state | Users without route permission should see denied UI. | Generic permission denied state is present. | PASS | `bigbike-admin/src/App.jsx:314-320` |
| Admin Slider APIs | list/create/patch/delete/reorder should be callable from admin FE. | All required client functions exist and call `/admin/sliders`. | PASS | `bigbike-admin/src/lib/adminApi.js:1201-1240` |
| Admin Home Video APIs | list/create/patch/delete/reorder should be callable from admin FE. | All required client functions exist and call `/admin/home-videos`. | PASS | `bigbike-admin/src/lib/adminApi.js:1259-1294` |
| Public Slider API route | `GET /api/v1/sliders?location=home` should be public and active-only. | Controller exists, validates `location`, and read service returns active-only items. | PASS | `PublicSliderController.java:37-48`, `SliderReadService.java:33-37`, `SecurityConfig.java:73` |
| Public Home Video API route | `GET /api/v1/home-videos` should be public and active-only. | Controller, read service, and raw OpenAPI are aligned; active-only response is covered by API tests. | PASS | `PublicHomeVideoController.java:35-45`, `HomeVideoReadService.java:20-24`, `SecurityConfig.java:74`, `bigbike-backend/src/main/resources/openapi/bigbike-openapi.json`, `HomeVideoApiTest.java` |
| Homepage data load | Homepage should load sliders and home videos from backend. | `Promise.all` calls `listHomeSliders()` and `listHomeVideos()`, then renders hero and conditional video section. | PASS | `bigbike-web/app/page.tsx:244-265`, `bigbike-web/app/page.tsx:317-320`, `bigbike-web/app/page.tsx:520-533` |
| Orphan/dead route imports | No broken lazy import or route without screen. | No broken import/export found for the inspected modules. | PASS | `SliderListScreen.jsx:160`, `HomeVideoListScreen.jsx:155`, `App.jsx:41-42` |

## API Contract Audit

| Endpoint | Method | Auth | Request | Response | Status | Notes |
|---|---|---|---|---|---|---|
| `/api/v1/sliders?location=home` | GET | Public `permitAll` | Optional `location`, regex `[a-z0-9_-]+`, default `home`. | `ApiDataResponse<List<PublicSliderResponse>>`; active-only; `Cache-Control: public, max-age=300`. | PASS | Matches `docs/engineering/API_CONTRACT.md:122`. Evidence: `PublicSliderController.java:37-48`, `SliderReadService.java:33-37`. |
| `/api/v1/home-videos` | GET | Public `permitAll` | None. | `ApiDataResponse<List<PublicHomeVideoResponse>>`; active-only; `Cache-Control: public, max-age=300`. | PASS | Runtime controller, docs, and raw OpenAPI are aligned. Evidence: `PublicHomeVideoController.java:35-45`, `docs/engineering/API_CONTRACT.md:123`, `bigbike-openapi.json`, `HomeVideoApiTest.java`. |
| `/api/v1/admin/sliders` | GET | `ROLE_ADMIN` + `sliders.read` | Optional `location`, default `home`. | `ApiDataResponse<List<PublicSliderResponse>>`; admin list includes active/inactive. | PASS | `AdminSliderController.java:49-55`, `SliderReadService.java:27-30`. |
| `/api/v1/admin/sliders` | POST | `ROLE_ADMIN` + `sliders.write` | `UpsertSliderRequest`. | `ApiDataResponse<PublicSliderResponse>`. | PASS | Enforces product-or-external-link, safe public-link policy, approved image/media origins, and duplicate `(location, sortOrder)` rejection. Evidence: `AdminSliderService.java`, `SafePublicLinkPolicy.java`, `SafeMediaAssetUrlPolicy.java`, `SliderApiTest.java`. |
| `/api/v1/admin/sliders/{id}` | PATCH | `ROLE_ADMIN` + `sliders.write` | `PatchSliderRequest`. | `ApiDataResponse<PublicSliderResponse>`. | PASS | Patch validates safe `externalLink`, approved image/media origins, and duplicate sort conflicts. Evidence: `AdminSliderService.java`, `SafePublicLinkPolicy.java`, `SliderApiTest.java`. |
| `/api/v1/admin/sliders/{id}` | DELETE | `ROLE_ADMIN` + `sliders.write` | Path id. | Empty/success response via API wrapper. | PASS | `AdminSliderController.java:90-97`, `AdminSliderService.java:207-212`. |
| `/api/v1/admin/sliders/reorder` | POST | `ROLE_ADMIN` + `sliders.write` | `ReorderSlidersRequest`. | `ApiDataResponse<List<PublicSliderResponse>>`. | PASS | Uses negative temporary sort orders to avoid unique conflicts. Evidence: `AdminSliderService.java:113-148`. |
| `/api/v1/admin/home-videos` | GET | `ROLE_ADMIN` + `home_videos.read` | None. | `ApiDataResponse<List<PublicHomeVideoResponse>>`; admin list includes active/inactive. | PASS | `AdminHomeVideoController.java:45-48`, `HomeVideoReadService.java:27-31`. |
| `/api/v1/admin/home-videos` | POST | `ROLE_ADMIN` + `home_videos.write` | `UpsertHomeVideoRequest`. | `ApiDataResponse<PublicHomeVideoResponse>`. | PASS | Enforces safe YouTube/internal-media URL policy, approved thumbnail origins, and duplicate `sortOrder` rejection. Evidence: `HomeVideoUrlPolicy.java`, `AdminHomeVideoService.java`, `HomeVideoApiTest.java`. |
| `/api/v1/admin/home-videos/{id}` | PATCH | `ROLE_ADMIN` + `home_videos.write` | `PatchHomeVideoRequest`. | `ApiDataResponse<PublicHomeVideoResponse>`. | PASS | Patch rejects duplicate `sortOrder`, unsafe video URLs, and unsafe thumbnail origins. Evidence: `HomeVideoUrlPolicy.java`, `AdminHomeVideoService.java`, `HomeVideoApiTest.java`. |
| `/api/v1/admin/home-videos/{id}` | DELETE | `ROLE_ADMIN` + `home_videos.write` | Path id. | Empty/success response via API wrapper. | PASS | `AdminHomeVideoController.java:80-87`, `AdminHomeVideoService.java:101-105`. |
| `/api/v1/admin/home-videos/reorder` | POST | `ROLE_ADMIN` + `home_videos.write` | `ReorderHomeVideosRequest`. | `ApiDataResponse<List<PublicHomeVideoResponse>>`. | PASS | Request duplicate sort orders are rejected, reorder uses temp negatives, and DB now enforces unique `sort_order` via `V72`. Evidence: `AdminHomeVideoService.java`, `V72__enforce_home_video_sort_order_uniqueness.sql`, `HomeVideoApiTest.java`. |

## Permission Audit

| Feature | Required Permission | FE Enforced | BE Enforced | Role Coverage | Status |
|---|---|---|---|---|---|
| Public sliders | None, public GET | N/A | `permitAll` GET | Guest/visitor allowed | PASS |
| Public home videos | None, public GET | N/A | `permitAll` GET | Guest/visitor allowed | PASS |
| Admin slider list | `sliders.read` | Route/nav guard with `sliders.read` | `requirePermission("sliders.read")` | `SUPER_ADMIN`, `ADMIN`, `EDITOR` | PASS |
| Admin slider write actions | `sliders.write` | `canUpdate={hasPermission("sliders.write")}` hides add/actions/drag controls | `requirePermission("sliders.write")` on POST/PATCH/DELETE/reorder | `SUPER_ADMIN`, `ADMIN`, `EDITOR` | PASS |
| Admin home video list | `home_videos.read` | Route/nav guard with `home_videos.read` | `requirePermission("home_videos.read")` | `SUPER_ADMIN`, `ADMIN` | PASS |
| Admin home video write actions | `home_videos.write` | `canUpdate={hasPermission("home_videos.write")}` hides add/actions/drag controls | `requirePermission("home_videos.write")` on POST/PATCH/DELETE/reorder | `SUPER_ADMIN`, `ADMIN`; not `EDITOR` | PASS |
| Readonly admin UX | No mutation controls when missing write permission | Mutation controls are hidden and sortable interactions are disabled in both Slider and Home Video screens. | Backend still blocks writes | Depends on role | PASS |
| Permission string consistency | Exact string match across docs, controller, role map, admin FE | Uses `home_videos.*`, not `home-videos.*` | Uses `home_videos.*` | Matches docs | PASS |

Permission evidence:

- `AdminRolePermissions.java:15-34`, `AdminRolePermissions.java:46-51`
- `AdminSliderController.java:49-97`
- `AdminHomeVideoController.java:45-87`
- `bigbike-admin/src/App.jsx:81-83`, `bigbike-admin/src/App.jsx:194-195`, `bigbike-admin/src/App.jsx:367-369`
- `docs/engineering/PERMISSION_MATRIX.md:80-83`, `docs/engineering/PERMISSION_MATRIX.md:446`

## Validation & Security Audit

| Field/Flow | Current Validation | Risk | Required Fix | Priority |
|---|---|---|---|---|
| Slider `externalLink` | Shared `SafePublicLinkPolicy` enforces relative `/...` or valid `https://...` only; blank-after-trim, malformed, protocol-relative, and unsafe schemes are rejected in BE and mirrored in admin FE. | Residual risk materially closed for audited paths. | Keep policy as shared service and extend to any future public CTA modules. | Fixed |
| Slider public link rendering | Homepage now defensively normalizes slider hrefs with `toSafePublicHref(...)` before rendering. | Dirty DB data falls back to safe internal product-list URL instead of rendering unsafe hrefs. | Keep defensive rendering even with backend validation. | Fixed |
| Slider `desktopImage` / `mobileImage` URL | Backend validates image URLs against approved internal/media origins via `SafeMediaAssetUrlPolicy`. | Arbitrary/protocol-relative image URLs are rejected server-side. | Reuse the same policy for future public media DTOs. | Fixed |
| Slider `productId` | Service verifies product exists on create/patch; FK is `ON DELETE SET NULL`. | Product deletion is safe, but admin must type raw id manually. | Keep BE behavior; add Product Picker/Search in admin. | P1 |
| Slider `location` | DTO/public param regex `[a-z0-9_-]+`; DB only checks non-empty trim. | API protects normal writes; DB allows looser direct writes. | Optional DB check constraint alignment. | P2 |
| Slider `sortOrder` | DTO validates `>= 0`; DB unique `(location, sort_order)`; service duplicate checks and reorder temp negatives are covered by API/repository tests. | Residual risk low. | Keep current two-pass reorder pattern. | Fixed |
| Home Video `videoUrl` | `HomeVideoUrlPolicy` allows only exact YouTube hosts or approved internal media URLs; unsafe schemes and arbitrary external hosts are rejected. | Public homepage no longer accepts arbitrary external media URLs through audited flows. | Reuse the same policy for future video-bearing modules. | Fixed |
| `YouTubeUrlParser` | Parser now uses `URI`, validates exact host, and supports `watch?v=`, `youtu.be`, `embed`, `shorts`, `v`, and `youtube-nocookie`. | Host/path spoofing risk is closed. | Keep unit coverage in `YouTubeUrlParserTest`. | Fixed |
| Home Video `sortOrder` | DTO min `>= 0`; create/patch now reject duplicates; DB enforces unique `sort_order` after duplicate cleanup migration. | Ordering integrity is deterministic. | Keep create/patch checks plus DB uniqueness. | Fixed |
| Home Video thumbnail URL | Backend validates thumbnail URL against approved internal/media origins via `SafeMediaAssetUrlPolicy`. | Arbitrary external/protocol-relative thumbnail URLs are rejected. | Reuse the same policy for future media thumbnail fields. | Fixed |
| Public Home Video self-hosted playback | Public web renders self-hosted video only when `isSafeHomeVideoUrl(...)` passes, and CSP now includes explicit `media-src`. | Untrusted media fetch risk is materially closed. | Keep backend + frontend defense in depth. | Fixed |
| JSON image fields | Entity catches parse/write errors and returns null instead of throwing. | Safe from app crash; bad JSON silently drops image. | Keep, but log structured parse failures if needed. | P2 |
| XSS in titles/alt text | React escapes text; `safeText` handles empty strings; unsafe href/video URL paths are now blocked by policy. | Residual XSS risk for audited flows is low. | Keep shared URL policies and defensive rendering helpers. | Fixed |

## Database Behavior Audit

| Table/Migration | Expected Behavior | Actual Behavior | Status | Notes |
|---|---|---|---|---|
| `V17__create_sliders_table.sql` | PK, FK product, unique `(location, sort_order)`, image JSON, external link, indexes. | Creates PK, FK `ON DELETE SET NULL`, unique location/sort, non-empty location check, indexes. | PASS | `V17__create_sliders_table.sql:1-20` |
| `V19__backfill_homepage_data.sql` | Seed/backfill homepage sliders idempotently. | Inserts fixed IDs with `where not exists`. | PASS | `V19__backfill_homepage_data.sql:9-71` |
| `V27__fix_slider_links_to_product_id.sql` | Replace legacy links with product FK where possible. | Updates curated slides to `product_id`, clears external link; keeps one category/brand external link. | PASS | `V27__fix_slider_links_to_product_id.sql:9-70` |
| `V33__fix_slider_image_urls_to_wp_origin.sql` | Fix old WordPress image URLs. | Updates slider JSON URLs to `https://bigbike.vn/wp-content/uploads/...`. | PARTIAL | Public hero uses plain `<img>`, so direct WP origin can load; Next `Image` remote config does not include `bigbike.vn` for other contexts. |
| `V34__add_slider_is_active.sql` | Add active/inactive flag. | Adds `is_active boolean not null default true`. | PASS | `V34__add_slider_is_active.sql:4` |
| Slider reorder DB behavior | Reorder should avoid unique sort conflicts. | Transaction uses temporary negative sort orders before final assignment. | PASS | `AdminSliderService.java:134-146` |
| Slider product delete behavior | Product-linked slider should not break if product is deleted. | FK is `ON DELETE SET NULL`; read service falls back to external link/null link if no product. | PASS | `V17__create_sliders_table.sql:11-12`, `SliderReadService.java:52-62` |
| `V35__create_home_videos_table.sql` | PK, active flag, sort ordering, indexes, production-safe integrity. | Original baseline migration creates PK and active/sort index; uniqueness is now enforced by follow-up remediation migration `V72`. | PASS | `V35__create_home_videos_table.sql:1-14`, `V72__enforce_home_video_sort_order_uniqueness.sql` |
| `V36__add_youtube_id_to_home_videos.sql` | Persist extracted YouTube id. | Adds nullable `youtube_id`; no index or backfill. | PARTIAL | Acceptable if table was empty; add index if querying/filtering by YouTube ID later. |
| `V72__enforce_home_video_sort_order_uniqueness.sql` | Clean duplicate `sort_order` rows and enforce uniqueness without mutating old migrations. | Re-numbers existing rows by `sort_order ASC, created_at ASC, id ASC` and adds `uq_home_videos_sort_order`. | PASS | `V72__enforce_home_video_sort_order_uniqueness.sql` |
| Home Video create/patch DB behavior | Should reject duplicate sort orders consistently. | Service create/patch reject duplicate sort orders and DB enforces unique `sort_order`. | PASS | `AdminHomeVideoService.java`, `HomeVideoJpaRepository.java`, `HomeVideoApiTest.java`, `HomeVideoRepositoryTest.java` |
| Home Video reorder behavior | Should be transactional and duplicate-safe. | Request duplicate sort orders are rejected, temp negatives are used, and final state is protected by DB uniqueness. | PASS | `AdminHomeVideoService.java`, `HomeVideoApiTest.java`, `V72__enforce_home_video_sort_order_uniqueness.sql` |
| `V1006__seed_home_videos_dev.sql` | Dev seed should be idempotent and brand-appropriate. | Uses fixed inserts without `ON CONFLICT`; video IDs include meme/pop examples such as `dQw4w9WgXcQ`, `9bZkp7q19f0`, `kJQP7kiw5Fk`. | FAIL | Dev-only via `application-dev.properties`, but still misleading for QA/brand demos. |

## Public Web Rendering Audit

| Component | Behavior | Status | Notes |
|---|---|---|---|
| `listHomeSliders()` | Calls `/api/v1/sliders` with `location=home`, tag `sliders`, revalidate `3600`. | PASS | `bigbike-web/lib/api/public-api.ts:357-359` |
| `listHomeVideos()` | Calls `/api/v1/home-videos`, tag `home-videos`, revalidate `3600`. | PASS | `bigbike-web/lib/api/public-api.ts:361-363` |
| Homepage load | Calls slider and home-video APIs in `Promise.all`. | PASS | `bigbike-web/app/page.tsx:244-265` |
| Homepage hero mapping | Skips slides without desktop image; mobile falls back to desktop; link priority is `link/productLink/externalLink`. | PASS | Hero mapping now normalizes hrefs with `toSafePublicHref(...)` and falls back safely if DB data is dirty. Evidence: `bigbike-web/app/page.tsx`, `bigbike-web/lib/utils/format.ts`. |
| `HeroSlider` empty fallback | Shows branded fallback when no slides. | PASS | `HeroSlider.tsx:43-70` |
| `HeroSlider` loading priority | First slide eager/high fetch priority; others lazy. | PASS | `HeroSlider.tsx:88-95` |
| `HeroSlider` alt text | Uses mapped `alt`. | PASS | `HeroSlider.tsx:90` |
| `HeroSlider` broken image | No `onError` fallback for broken remote images. | PARTIAL | A broken hero URL yields a broken hero image. |
| `HomeVideoCarousel` empty fallback | Returns `null` when no videos. | PASS | `HomeVideoCarousel.tsx:153` |
| `HomeVideoCarousel` thumbnail priority | Custom thumbnail, then YouTube auto thumbnail, then fallback. | PASS | `HomeVideoCarousel.tsx:90-94` |
| `HomeVideoCarousel` thumbnail error | Falls back to local placeholder on image error. | PASS | `HomeVideoCarousel.tsx:104-115` |
| `HomeVideoCarousel` YouTube modal | Uses backend `embedUrl`; backend builds `youtube-nocookie` embed. | PASS | `HomeVideoCarousel.tsx:60-68`, `PublicHomeVideoResponse.java:18-20` |
| `HomeVideoCarousel` uploaded video modal | Uses `<video>` for non-YouTube URLs. | PASS | Rendering is guarded by `isSafeHomeVideoUrl(...)`, backend rejects unsafe video URLs, and CSP now includes explicit `media-src`. |
| Modal close/escape/body scroll | Escape close and body scroll lock exist. | PASS | `HomeVideoCarousel.tsx:28-39` |
| Modal focus trap/focus restore | Expected for production accessibility. | PARTIAL | Not implemented. |
| Carousel responsiveness/controls | Embla carousel, disabled controls and dots are implemented. | PASS | `HomeVideoCarousel.tsx:124-214` |
| Next image/CSP config | YouTube thumbnails and CDN are configured; legacy BigBike/WP thumbnails are normalized to same-origin proxy paths, and CSP explicitly allows media playback. | PASS | `next.config.ts` now includes `media-src`, and `resolveMediaUrl(...)` rewrites approved legacy BigBike origins to same-origin media routes. |

## Admin UX Audit

| Screen Feature | Status | Notes |
|---|---|---|
| Slider list loading/error/empty states | PASS | Query states and empty/error UI exist. Evidence: `SliderListScreen.jsx:448-452`. |
| Slider add/edit/delete/toggle active | PASS | Mutations exist; delete has `confirm`; toggle sends `{ isActive }`. Evidence: `SliderListScreen.jsx:203-238`, `SliderListScreen.jsx:273-276`. |
| Slider reorder rollback | PASS | Optimistic update captures previous data and restores on error. Evidence: `SliderListScreen.jsx:183-198`, `SliderListScreen.jsx:328-339`. |
| Slider form validation | PASS | Requires product or external link and validates safe public-link policy before submit. Evidence: `SliderListScreen.jsx`, `bigbike-admin/src/lib/urlPolicies.js`. |
| Slider product selection UX | FAIL | Admin must type raw `productId`; scope expects Product Picker/Search. Evidence: `SliderListScreen.jsx:431-433`. |
| Slider image picker | PASS | Uses `ImageUrlInput` for desktop/mobile images. Evidence: `SliderListScreen.jsx:405-420`. |
| Slider readonly user | PASS | Add/actions/drag handle hidden when `canUpdate=false`. |
| Slider i18n | PASS | Screen uses `t("sliders.*")`; keys exist in `vi.json` and `en.json`. |
| Slider accessibility | PASS | Drag handle now includes explicit `aria-label`, and readonly users cannot trigger sortable interactions. |
| Home Video list loading/error/empty states | PASS | Query states and empty/error UI exist. Evidence: `HomeVideoListScreen.jsx:293-308`, `HomeVideoListScreen.jsx:471-472`. |
| Home Video add/edit/delete/toggle active | PASS | Mutations exist; delete has `confirm`; toggle sends `{ isActive }`. |
| Home Video reorder rollback | PASS | Reorder uses optimistic update with rollback to previous cached list on API error. Evidence: `HomeVideoListScreen.jsx`. |
| Home Video form validation | PASS | FE enforces title plus the same YouTube/internal-media URL policy used by backend helpers. |
| Home Video video picker | PASS | Upload policy copy, `accept` type, and max-size messaging are aligned to MP4 / 50 MB; upload success explicitly refreshes the media list and no longer leaves the modal stuck loading. |
| Home Video thumbnail picker | PASS | Uses `ImageUrlInput`. Evidence: `HomeVideoListScreen.jsx:426-432`. |
| Home Video readonly user | PASS | Add/actions/drag handle hidden when `canUpdate=false`. |
| Home Video i18n | PASS | Screen and picker now use `homeVideos.*` and `imageInput.*` locale keys in both `vi.json` and `en.json`. |
| Modal accessibility | PARTIAL | `VideoPickerModal` has Escape and `aria-modal`, but no focus trap or focus restoration. Evidence: `VideoPickerModal.jsx:80-90`, `VideoPickerModal.jsx:135`. |
| Admin API forced mock behavior | PARTIAL | Slider has mock fallback; Home Videos list has no forced mock fallback/mock data, while mutations are blocked correctly under `VITE_USE_ADMIN_MOCK=true`. Evidence: `adminApi.js:1201-1213`, `adminApi.js:1259-1267`, `adminApi.js:262-272`. |

## Test Coverage Audit

| Test Area | Existing Tests | Missing Tests | Priority |
|---|---|---|---|
| `YouTubeUrlParser` unit test | None found. | Test `watch?v=`, `youtu.be`, `embed`, `shorts`, `youtube-nocookie`, invalid hosts containing `youtube.com` in path/query, malformed URL. Suggested file: `bigbike-backend/src/test/java/com/bigbike/bigbike_backend/service/video/YouTubeUrlParserTest.java`. | P1 |
| Slider public API | `SliderApiTest` covers invalid location and cache header; curated slide test is disabled. | Active-only filtering, inactive hidden, product link resolution, unsafe external link rejection. | P1 |
| Slider link resolution | Disabled API test checks one `productLink`; no direct unit/service test. | `productId` -> `/sp/{slug}.html`, deleted/null product fallback, external link fallback, unsafe link rejection. Suggested file: `SliderReadServiceTest.java`. | P1 |
| Slider create/patch validation | None found. | Missing product/external link, duplicate location/sort, invalid location, invalid external link, non-existent product ID. | P1 |
| Slider reorder unique swap | None found. | Swap `0 <-> 1` under DB unique constraint and invalid duplicate reorder request. | P1 |
| Slider repository/DB | `SliderRepositoryTest` checks seeded order and JSON image persistence. | Unique constraint violation test; FK product delete set null test. | P1 |
| Home Video public API | None found. | Active-only filtering, cache header, response `embedUrl`/`autoThumbnailUrl`, non-YouTube behavior. Suggested file: `HomeVideoApiTest.java`. | P1 |
| Home Video create/patch | None found. | Required title/video URL, invalid host/scheme, duplicate sort order, toggle active, custom thumbnail JSON. | P1 |
| Home Video reorder | None found. | Duplicate sort order request rejected, ID set mismatch rejected, reorder remains stable and unique after DB constraint. | P1 |
| Permission denied API | None specific to these modules found. | Editor allowed sliders write but denied home videos write; Shop Manager denied both; public cannot access admin APIs. | P1 |
| Frontend admin Slider | None found. | Submit payload, toggle active, Product Picker selection, reorder optimistic rollback, readonly user hides controls. | P2 |
| Frontend admin Home Video | None found. | YouTube URL submit, Media Library video selection, upload success refresh, reorder rollback, readonly user hides controls, i18n keys. | P2 |
| Public components | None found. | Hero fallback, unsafe link skip, broken image fallback, HomeVideo thumbnail priority, YouTube modal, self-hosted video fallback. | P2 |

Existing tests evidence:

- `SliderApiTest.java:58-75` disabled curated slider API test.
- `SliderApiTest.java:77-107` toggle active and invalid location tests.
- `SliderApiTest.java:109-115` cache header test.
- `SliderRepositoryTest.java:23-54` seeded order and JSON image persistence tests.
- `git grep` found no Home Video backend tests and no frontend tests for these modules.

## Findings

### P0 - Must fix before production

- None remaining after remediation.

### P1 - Should fix before release

- None remaining after remediation.

### P2 - Nice to improve

#### 1. Slider admin requires manual `productId`

- Title: Slider product linking UX is not production-complete.
- Evidence: `SliderListScreen.jsx:431-433`.
- Impact: Admins must know raw product IDs; this is error-prone and does not match expected commerce admin UX. The backend correctly verifies existence, but the screen will still cause operational mistakes.
- Recommended fix: Add Product Picker/Search using admin product search/list endpoint, store selected product id, and show product name/slug preview.
- Suggested test: Frontend test selecting a product and verifying submit payload contains the selected `productId`.

#### 2. Test coverage is below production gate for frontend UX

- Title: Home Videos have no tests; Sliders have partial/disabled coverage.
- Evidence: `SliderApiTest.java:58-75` is disabled; `SliderRepositoryTest.java:23-54` covers only order and JSON image persistence; `git grep` found no Home Video tests.
- Impact: Security, ordering, permission, mapping, and public active-only behavior can regress silently.
- Recommended fix: Add the test files listed in the Test Coverage Audit before marking the module complete.
- Suggested test: Prioritize backend tests for URL policy, sort-order integrity, public active-only filtering, permission denial, and YouTube parsing.

#### 3. HeroSlider has no broken image fallback

- Title: Broken hero URLs degrade the main homepage hero.
- Evidence: `HeroSlider.tsx:84-95`.
- Impact: If a slider image URL fails, users see a broken hero image instead of a designed fallback.
- Recommended fix: Add `onError` fallback to a local branded hero placeholder or skip the failing image.
- Suggested test: Public component test with invalid image URL.

#### 4. Modals need focus trap and focus restoration

- Title: Media/video/public video modals are accessible enough for basics but not production-polished.
- Evidence: `VideoPickerModal.jsx:80-90`, `VideoPickerModal.jsx:135`, `HomeVideoCarousel.tsx:28-55`.
- Impact: Keyboard users can tab outside modals and focus may not return to the opener.
- Recommended fix: Use a small modal/focus-trap helper consistently across admin media pickers and public video modal.
- Suggested test: Playwright accessibility flow: open modal, tab cycle remains inside, Escape closes, focus returns to opener.

#### 5. Dev Home Video seed is not brand-safe or idempotent

- Title: `V1006` uses meme/pop YouTube examples and fixed inserts without conflict handling.
- Evidence: `V1006__seed_home_videos_dev.sql:4-31`.
- Impact: QA/demo environments can display off-brand content; re-running dev seeds can fail if rows already exist.
- Recommended fix: Replace with BigBike-relevant sample/internal media or leave empty; add `ON CONFLICT (id) DO UPDATE/NOTHING`.
- Suggested test: Dev migration smoke test or idempotent seed verification.

#### 6. Slider drag preview opacity is overridden

- Title: `SliderCard` sets opacity twice, overriding drag opacity.
- Evidence: `SliderListScreen.jsx:49`, `SliderListScreen.jsx:65`.
- Impact: Minor visual polish issue during drag and inactive display.
- Recommended fix: Combine inactive and drag opacity in one style expression.
- Suggested test: Visual smoke/manual DnD check.

#### 7. Home Video mock fallback is missing

- Title: `fetchHomeVideos` does not honor forced mock mode the way `fetchSliders` does.
- Evidence: `adminApi.js:1201-1213`, `adminApi.js:1259-1267`, `mockData.js` has slider mock data but no home-video mock data.
- Impact: Local mock-mode admin QA can fail or mislead for this screen.
- Recommended fix: Add `queryMockHomeVideos()` or intentionally show a clear mock-unavailable state.
- Suggested test: Admin API client test with `VITE_USE_ADMIN_MOCK=true`.

## Remediation Update

- Fixed P0:
  - Added backend `SafePublicLinkPolicy` and applied it to Slider create/patch; admin FE now validates the same policy and public web normalizes hero hrefs defensively.
  - Added backend `HomeVideoUrlPolicy` plus stricter `YouTubeUrlParser` host validation; public web now renders self-hosted videos only when the URL still passes defensive checks.
- Fixed P1:
  - Added backend `SafeMediaAssetUrlPolicy` for Slider/Home Video image URLs and Home Video thumbnails.
  - Added `V72__enforce_home_video_sort_order_uniqueness.sql` to clean duplicate `sort_order` rows and enforce `uq_home_videos_sort_order`.
  - Added duplicate sort-order checks in Home Video create/patch, while preserving two-pass negative reorder updates.
  - Updated raw OpenAPI to include `GET /api/v1/home-videos` and added contract coverage.
  - Reworked `HomeVideoListScreen.jsx`, `VideoPickerModal.jsx`, `ImageUrlInput.jsx`, and locale files to remove hardcoded strings, align MP4/50 MB copy, refresh media after upload, and keep readonly users from mutating/reordering.
  - Added required backend/public-web tests for URL policy, active-only public reads, reorder integrity, permission denial, response mapping, parser coverage, and utility-level defensive rendering.
- Remaining:
  - No open P0/P1 findings remain from the original audit.
  - Open P2 follow-ups: Slider Product Picker/Search UX, modal focus trap/focus restoration, `HeroSlider` broken-image fallback, off-brand/idempotent `V1006` dev seed, and broader frontend tests.
- Tests run:
  - `cd bigbike-backend && ./mvnw test` -> PASS (`844` tests, `0` failures, `0` errors)
  - `cd bigbike-admin && npm run lint` -> PASS
  - `cd bigbike-admin && npm run build` -> PASS
  - `cd bigbike-web && npm run test` -> PASS (`69` tests)
  - `cd bigbike-web && npm run build` -> PASS
  - `cd bigbike-web && npm run lint` -> FAIL due pre-existing unrelated lint errors in `app/tai-khoan/doi-tra/page.tsx`, `app/xac-nhan-email/page.tsx`, `components/catalog/RecentlyViewedSection.tsx`, and `components/layout/SearchToggle.tsx`; no remaining lint errors were introduced in Sliders / Home Videos scope.

## Final Completion Verdict

- Estimated completion:
  - Sliders: 95%
  - Home Videos: 94%
  - Combined module: 95%
- Can release now: Yes for the audited Sliders / Home Videos scope. P0/P1 blockers from the original audit are remediated and backend/admin/public-web runtime checks are green for this scope.
- Conditions for 100% complete:
  - Replace raw `productId` entry in Slider admin with a Product Picker/Search flow.
  - Add modal focus trap/focus restoration for admin/video/public modal flows.
  - Add `HeroSlider` broken-image fallback polish.
  - Replace or sanitize `V1006` off-brand dev seed and make it idempotent.
  - Add targeted frontend interaction tests for Slider/Home Video admin forms and public media fallbacks.

## Implementation Checklist

- [x] Add backend `PublicUrlPolicy` for slider `externalLink`; reject unsafe schemes and protocol-relative URLs.
- [x] Add backend `MediaAssetUrlPolicy` for slider images and home-video thumbnails; restrict to Media Library/internal/approved origins.
- [x] Add backend `HomeVideoUrlPolicy`; allow exact YouTube hosts or internal Media Library video URLs only.
- [x] Rewrite `YouTubeUrlParser` to parse `URI` and validate host before extracting ID.
- [x] Add service-level duplicate `sortOrder` checks for Home Video create/patch.
- [x] Add DB migration to clean duplicate `home_videos.sort_order` and add a unique constraint.
- [x] Regenerate/update `bigbike-openapi.json` to include public `GET /api/v1/home-videos`.
- [ ] Add Product Picker/Search to `SliderListScreen.jsx` instead of raw `productId` text input.
- [x] Add frontend link/video URL validation matching backend policy.
- [x] Convert `HomeVideoListScreen.jsx` strings to `homeVideos.*` i18n keys in `vi.json` and `en.json`.
- [x] Fix `VideoPickerModal` upload limit/type/copy mismatch and force refetch after upload.
- [ ] Add modal focus trap/focus restoration for admin media/video pickers and public video modal.
- [x] Add `media-src` CSP and align `next.config.ts` image remote patterns/proxy behavior with real media origins.
- [ ] Add `HeroSlider` broken image fallback.
- [ ] Replace or remove `V1006` off-brand dev seed and make it idempotent.
- [x] Add backend tests: `YouTubeUrlParserTest`, `SliderReadServiceTest`, `SliderApiTest`, `HomeVideoApiTest`, `PublicHomeVideoResponseTest`.
- [x] Add DB integration tests for Slider unique location/sort, Home Video unique sort order, and JSON image parse/write.
- [x] Add permission tests for Slider and Home Video admin APIs.
- [ ] Add frontend tests for admin submit payloads, toggles, reorder rollback, readonly behavior, picker selection, and public carousel fallback rendering.
