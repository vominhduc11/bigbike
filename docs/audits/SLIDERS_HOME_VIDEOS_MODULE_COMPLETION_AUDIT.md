# Sliders / Home Videos Module Completion Audit

## Executive Summary

- Overall status: PARTIAL
- Sliders status: PARTIAL - backend, admin route, public route, public rendering, RBAC, and reorder flow are largely wired, but URL/link validation, admin product selection UX, accessibility, and test coverage are not production-complete.
- Home Videos status: NOT READY - CRUD routes exist and public rendering works for happy paths, but URL security policy, duplicate sort order behavior, OpenAPI drift, admin UX/i18n, picker bugs, CSP/media policy, and tests are not production-ready.
- Highest-risk issues:
  - P0: Slider `externalLink` and media URL fields are not protected against unsafe schemes / protocol-relative URLs, while public web renders the link directly.
  - P0: Home Video `videoUrl` accepts arbitrary `http(s)` URLs, and YouTube parsing is not strict to YouTube hosts; public web may render arbitrary external video URLs.
  - P1: `home_videos.sort_order` has no uniqueness guarantee, and create/patch can produce duplicate sort order.
  - P1: Raw OpenAPI file does not include public `GET /api/v1/home-videos`, although docs and controller do.
  - P1: Admin Home Videos screen is not i18n-ready and has a media picker upload refresh bug plus inconsistent upload policy copy.
  - P1: Test coverage is missing for Home Videos and thin for Sliders; one important Slider API test is disabled.
- Recommended release decision: DO NOT release as production-ready. Release only after P0 fixes and the P1 data integrity/API/test gaps are closed.

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
- `bigbike-admin/src/components/media/ImageUrlInput.jsx`
- `bigbike-admin/src/components/media/VideoPickerModal.jsx`
- `bigbike-admin/src/components/media/MediaPickerModal.jsx`
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
| Public Home Video API route | `GET /api/v1/home-videos` should be public and active-only. | Controller exists and read service returns active-only items. Raw OpenAPI is missing this public path. | PARTIAL | `PublicHomeVideoController.java:35-45`, `HomeVideoReadService.java:20-24`, `SecurityConfig.java:74`, `bigbike-openapi.json` has admin home-video paths but no public `/api/v1/home-videos` |
| Homepage data load | Homepage should load sliders and home videos from backend. | `Promise.all` calls `listHomeSliders()` and `listHomeVideos()`, then renders hero and conditional video section. | PASS | `bigbike-web/app/page.tsx:244-265`, `bigbike-web/app/page.tsx:317-320`, `bigbike-web/app/page.tsx:520-533` |
| Orphan/dead route imports | No broken lazy import or route without screen. | No broken import/export found for the inspected modules. | PASS | `SliderListScreen.jsx:160`, `HomeVideoListScreen.jsx:155`, `App.jsx:41-42` |

## API Contract Audit

| Endpoint | Method | Auth | Request | Response | Status | Notes |
|---|---|---|---|---|---|---|
| `/api/v1/sliders?location=home` | GET | Public `permitAll` | Optional `location`, regex `[a-z0-9_-]+`, default `home`. | `ApiDataResponse<List<PublicSliderResponse>>`; active-only; `Cache-Control: public, max-age=300`. | PASS | Matches `docs/engineering/API_CONTRACT.md:122`. Evidence: `PublicSliderController.java:37-48`, `SliderReadService.java:33-37`. |
| `/api/v1/home-videos` | GET | Public `permitAll` | None. | `ApiDataResponse<List<PublicHomeVideoResponse>>`; active-only; `Cache-Control: public, max-age=300`. | PARTIAL | Runtime controller matches docs, but raw OpenAPI file is missing the public path. Evidence: `PublicHomeVideoController.java:35-45`, `docs/engineering/API_CONTRACT.md:123`. |
| `/api/v1/admin/sliders` | GET | `ROLE_ADMIN` + `sliders.read` | Optional `location`, default `home`. | `ApiDataResponse<List<PublicSliderResponse>>`; admin list includes active/inactive. | PASS | `AdminSliderController.java:49-55`, `SliderReadService.java:27-30`. |
| `/api/v1/admin/sliders` | POST | `ROLE_ADMIN` + `sliders.write` | `UpsertSliderRequest`. | `ApiDataResponse<PublicSliderResponse>`. | PARTIAL | Enforces product-or-external-link and duplicate `(location, sortOrder)`, but does not validate `externalLink` scheme/policy. Evidence: `AdminSliderService.java:68-82`, `UpsertSliderRequest.java:12-30`. |
| `/api/v1/admin/sliders/{id}` | PATCH | `ROLE_ADMIN` + `sliders.write` | `PatchSliderRequest`. | `ApiDataResponse<PublicSliderResponse>`. | PARTIAL | Duplicate sort conflict is checked; external URL policy still missing. Evidence: `AdminSliderService.java:160-198`, `PatchSliderRequest.java:10-28`. |
| `/api/v1/admin/sliders/{id}` | DELETE | `ROLE_ADMIN` + `sliders.write` | Path id. | Empty/success response via API wrapper. | PASS | `AdminSliderController.java:90-97`, `AdminSliderService.java:207-212`. |
| `/api/v1/admin/sliders/reorder` | POST | `ROLE_ADMIN` + `sliders.write` | `ReorderSlidersRequest`. | `ApiDataResponse<List<PublicSliderResponse>>`. | PASS | Uses negative temporary sort orders to avoid unique conflicts. Evidence: `AdminSliderService.java:113-148`. |
| `/api/v1/admin/home-videos` | GET | `ROLE_ADMIN` + `home_videos.read` | None. | `ApiDataResponse<List<PublicHomeVideoResponse>>`; admin list includes active/inactive. | PASS | `AdminHomeVideoController.java:45-48`, `HomeVideoReadService.java:27-31`. |
| `/api/v1/admin/home-videos` | POST | `ROLE_ADMIN` + `home_videos.write` | `UpsertHomeVideoRequest`. | `ApiDataResponse<PublicHomeVideoResponse>`. | FAIL | Accepts arbitrary `http(s)` `videoUrl`; does not prevent duplicate `sortOrder`. Evidence: `UpsertHomeVideoRequest.java:17-26`, `AdminHomeVideoService.java:49-64`. |
| `/api/v1/admin/home-videos/{id}` | PATCH | `ROLE_ADMIN` + `home_videos.write` | `PatchHomeVideoRequest`. | `ApiDataResponse<PublicHomeVideoResponse>`. | FAIL | Patch can set duplicate `sortOrder`; URL policy remains too broad. Evidence: `PatchHomeVideoRequest.java:14-20`, `AdminHomeVideoService.java:72-96`. |
| `/api/v1/admin/home-videos/{id}` | DELETE | `ROLE_ADMIN` + `home_videos.write` | Path id. | Empty/success response via API wrapper. | PASS | `AdminHomeVideoController.java:80-87`, `AdminHomeVideoService.java:101-105`. |
| `/api/v1/admin/home-videos/reorder` | POST | `ROLE_ADMIN` + `home_videos.write` | `ReorderHomeVideosRequest`. | `ApiDataResponse<List<PublicHomeVideoResponse>>`. | PARTIAL | Request duplicate sort orders are rejected and reorder uses temp negatives, but DB has no uniqueness constraint. Evidence: `AdminHomeVideoService.java:112-145`, `V35__create_home_videos_table.sql:12-14`. |

## Permission Audit

| Feature | Required Permission | FE Enforced | BE Enforced | Role Coverage | Status |
|---|---|---|---|---|---|
| Public sliders | None, public GET | N/A | `permitAll` GET | Guest/visitor allowed | PASS |
| Public home videos | None, public GET | N/A | `permitAll` GET | Guest/visitor allowed | PASS |
| Admin slider list | `sliders.read` | Route/nav guard with `sliders.read` | `requirePermission("sliders.read")` | `SUPER_ADMIN`, `ADMIN`, `EDITOR` | PASS |
| Admin slider write actions | `sliders.write` | `canUpdate={hasPermission("sliders.write")}` hides add/actions/drag controls | `requirePermission("sliders.write")` on POST/PATCH/DELETE/reorder | `SUPER_ADMIN`, `ADMIN`, `EDITOR` | PASS |
| Admin home video list | `home_videos.read` | Route/nav guard with `home_videos.read` | `requirePermission("home_videos.read")` | `SUPER_ADMIN`, `ADMIN` | PASS |
| Admin home video write actions | `home_videos.write` | `canUpdate={hasPermission("home_videos.write")}` hides add/actions/drag controls | `requirePermission("home_videos.write")` on POST/PATCH/DELETE/reorder | `SUPER_ADMIN`, `ADMIN`; not `EDITOR` | PASS |
| Readonly admin UX | No mutation controls when missing write permission | Mostly hidden; DnD context still mounted but drag handle is hidden | Backend still blocks writes | Depends on role | PARTIAL |
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
| Slider `externalLink` | `@Size(max = 2048)` only; service only enforces product-or-link. | Allows `javascript:`, `data:`, unsafe protocol-relative `//evil.com`, phishing/open redirect, and unsafe public href rendering. | Add backend URL policy validator: allow relative paths beginning with single `/` or approved `https://` URLs; reject `javascript:`, `data:`, `vbscript:`, `file:`, `//...`; mirror in admin FE. | P0 |
| Slider public link rendering | Homepage maps `slider.link || productLink || externalLink`; `HeroSlider` renders `<Link href={slide.href}>`. | Unsafe link values can reach public clickable HTML. | Sanitize before save, and defensively normalize/skip unsafe links in public web. | P0 |
| Slider `desktopImage` / `mobileImage` URL | `ImageAssetRequest.url` allows `^(?:https?://|/).*`. | Allows arbitrary hosts and protocol-relative `//evil.com`; broken/untrusted images can be displayed publicly. | Restrict to Media Library/internal media paths or approved HTTPS media/CDN domains; reject `//...`. | P1 |
| Slider `productId` | Service verifies product exists on create/patch; FK is `ON DELETE SET NULL`. | Product deletion is safe, but admin must type raw id manually. | Keep BE behavior; add Product Picker/Search in admin. | P1 |
| Slider `location` | DTO/public param regex `[a-z0-9_-]+`; DB only checks non-empty trim. | API protects normal writes; DB allows looser direct writes. | Optional DB check constraint alignment. | P2 |
| Slider `sortOrder` | DTO validates `>= 0`; DB unique `(location, sort_order)`; service duplicate checks and reorder temp negatives. | Good integrity model. | Keep; add tests for conflict and reorder swap. | P1 |
| Home Video `videoUrl` | `@URL`, `@Pattern("^https?://.*")`, max length. | Allows arbitrary external video URLs; policy does not enforce YouTube or internal Media Library only. | Add `HomeVideoUrlPolicy`: allow exact YouTube hosts for YouTube or internal media URL/media id from Media Library. | P0 |
| `YouTubeUrlParser` | Supports `watch?v=`, `youtu.be`, `embed`, `shorts`, `v`, but regex is not URI-host anchored. | A URL on a non-YouTube host containing `youtube.com/watch?v=` can still produce a `youtubeId`. | Parse with `URI`, normalize host, allow only `youtube.com`, `www.youtube.com`, `m.youtube.com`, `youtube-nocookie.com`, `youtu.be`; then extract by path/query. | P1 |
| Home Video `sortOrder` | DTO min `>= 0`; reorder request checks duplicates. | Create/patch can duplicate `sortOrder`; DB has no unique constraint. | Add service duplicate checks plus DB unique constraint after duplicate cleanup. | P1 |
| Home Video thumbnail URL | Same `ImageAssetRequest` URL policy as slider images. | Arbitrary external image/domain and protocol-relative risk. | Restrict to Media Library/internal media or approved CDN/YouTube thumbnail domains. | P1 |
| Public Home Video self-hosted playback | Public web falls back to `<video src={video.videoUrl}>`. | With arbitrary URLs, browser may fetch untrusted external media; CSP currently has no explicit `media-src`. | Restrict backend URLs and add explicit CSP `media-src 'self' <media origin>`. | P1 |
| JSON image fields | Entity catches parse/write errors and returns null instead of throwing. | Safe from app crash; bad JSON silently drops image. | Keep, but log structured parse failures if needed. | P2 |
| XSS in titles/alt text | React escapes text; `safeText` handles empty strings. | Text XSS risk low; link href risk remains high. | Fix URL policy. | P0 |

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
| `V35__create_home_videos_table.sql` | PK, active flag, sort ordering, indexes, production-safe integrity. | Creates PK and active/sort index but no unique sort constraint. | FAIL | `V35__create_home_videos_table.sql:1-14` |
| `V36__add_youtube_id_to_home_videos.sql` | Persist extracted YouTube id. | Adds nullable `youtube_id`; no index or backfill. | PARTIAL | Acceptable if table was empty; add index if querying/filtering by YouTube ID later. |
| Home Video create/patch DB behavior | Should reject duplicate sort orders consistently. | Service create/patch do not check duplicate sort orders; DB allows duplicates. | FAIL | `AdminHomeVideoService.java:49-64`, `AdminHomeVideoService.java:72-96` |
| Home Video reorder behavior | Should be transactional and duplicate-safe. | Request duplicate sort orders are rejected and temp negatives are used; no DB unique guarantee remains. | PARTIAL | `AdminHomeVideoService.java:112-145` |
| `V1006__seed_home_videos_dev.sql` | Dev seed should be idempotent and brand-appropriate. | Uses fixed inserts without `ON CONFLICT`; video IDs include meme/pop examples such as `dQw4w9WgXcQ`, `9bZkp7q19f0`, `kJQP7kiw5Fk`. | FAIL | Dev-only via `application-dev.properties`, but still misleading for QA/brand demos. |

## Public Web Rendering Audit

| Component | Behavior | Status | Notes |
|---|---|---|---|
| `listHomeSliders()` | Calls `/api/v1/sliders` with `location=home`, tag `sliders`, revalidate `3600`. | PASS | `bigbike-web/lib/api/public-api.ts:357-359` |
| `listHomeVideos()` | Calls `/api/v1/home-videos`, tag `home-videos`, revalidate `3600`. | PASS | `bigbike-web/lib/api/public-api.ts:361-363` |
| Homepage load | Calls slider and home-video APIs in `Promise.all`. | PASS | `bigbike-web/app/page.tsx:244-265` |
| Homepage hero mapping | Skips slides without desktop image; mobile falls back to desktop; link priority is `link/productLink/externalLink`. | PARTIAL | Good fallback for images, but unsafe href values are not defensively rejected. Evidence: `bigbike-web/app/page.tsx:90-99`. |
| `HeroSlider` empty fallback | Shows branded fallback when no slides. | PASS | `HeroSlider.tsx:43-70` |
| `HeroSlider` loading priority | First slide eager/high fetch priority; others lazy. | PASS | `HeroSlider.tsx:88-95` |
| `HeroSlider` alt text | Uses mapped `alt`. | PASS | `HeroSlider.tsx:90` |
| `HeroSlider` broken image | No `onError` fallback for broken remote images. | PARTIAL | A broken hero URL yields a broken hero image. |
| `HomeVideoCarousel` empty fallback | Returns `null` when no videos. | PASS | `HomeVideoCarousel.tsx:153` |
| `HomeVideoCarousel` thumbnail priority | Custom thumbnail, then YouTube auto thumbnail, then fallback. | PASS | `HomeVideoCarousel.tsx:90-94` |
| `HomeVideoCarousel` thumbnail error | Falls back to local placeholder on image error. | PASS | `HomeVideoCarousel.tsx:104-115` |
| `HomeVideoCarousel` YouTube modal | Uses backend `embedUrl`; backend builds `youtube-nocookie` embed. | PASS | `HomeVideoCarousel.tsx:60-68`, `PublicHomeVideoResponse.java:18-20` |
| `HomeVideoCarousel` uploaded video modal | Uses `<video>` for non-YouTube URLs. | PARTIAL | Rendering exists, but backend accepts arbitrary URL and CSP lacks explicit `media-src`. |
| Modal close/escape/body scroll | Escape close and body scroll lock exist. | PASS | `HomeVideoCarousel.tsx:28-39` |
| Modal focus trap/focus restore | Expected for production accessibility. | PARTIAL | Not implemented. |
| Carousel responsiveness/controls | Embla carousel, disabled controls and dots are implemented. | PASS | `HomeVideoCarousel.tsx:124-214` |
| Next image/CSP config | YouTube thumbnails and CDN are configured; CSP allows `img-src https:`. | PARTIAL | No `media-src`; remotePatterns lacks direct `bigbike.vn` if a custom thumbnail uses that origin through `next/image`. Evidence: `next.config.ts:171-193`, `next.config.ts:364-377`. |

## Admin UX Audit

| Screen Feature | Status | Notes |
|---|---|---|
| Slider list loading/error/empty states | PASS | Query states and empty/error UI exist. Evidence: `SliderListScreen.jsx:448-452`. |
| Slider add/edit/delete/toggle active | PASS | Mutations exist; delete has `confirm`; toggle sends `{ isActive }`. Evidence: `SliderListScreen.jsx:203-238`, `SliderListScreen.jsx:273-276`. |
| Slider reorder rollback | PASS | Optimistic update captures previous data and restores on error. Evidence: `SliderListScreen.jsx:183-198`, `SliderListScreen.jsx:328-339`. |
| Slider form validation | PARTIAL | Requires product or external link, but does not validate link scheme/policy or sort min in FE. Evidence: `SliderListScreen.jsx:300-305`, `SliderListScreen.jsx:392`, `SliderListScreen.jsx:429`. |
| Slider product selection UX | FAIL | Admin must type raw `productId`; scope expects Product Picker/Search. Evidence: `SliderListScreen.jsx:431-433`. |
| Slider image picker | PASS | Uses `ImageUrlInput` for desktop/mobile images. Evidence: `SliderListScreen.jsx:405-420`. |
| Slider readonly user | PASS | Add/actions/drag handle hidden when `canUpdate=false`. |
| Slider i18n | PASS | Screen uses `t("sliders.*")`; keys exist in `vi.json` and `en.json`. |
| Slider accessibility | PARTIAL | Drag icon button has `title` but no explicit `aria-label`; no test coverage. Evidence: `SliderListScreen.jsx:68-86`. |
| Home Video list loading/error/empty states | PASS | Query states and empty/error UI exist. Evidence: `HomeVideoListScreen.jsx:293-308`, `HomeVideoListScreen.jsx:471-472`. |
| Home Video add/edit/delete/toggle active | PASS | Mutations exist; delete has `confirm`; toggle sends `{ isActive }`. |
| Home Video reorder rollback | PARTIAL | Local order resets to server data on error, but does not keep the precise previous snapshot like Slider screen. Evidence: `HomeVideoListScreen.jsx:209-218`, `HomeVideoListScreen.jsx:280-288`. |
| Home Video form validation | PARTIAL | Title has `required`; URL field uses `type="url"`, but YouTube/internal media policy is not enforced in FE. |
| Home Video video picker | FAIL | Upload max constant is 50 MB, UI says 500 MB; screen says MP4/WebM but picker accepts only MP4; upload success can leave modal stuck in loading if page/search do not change. Evidence: `VideoPickerModal.jsx:5-6`, `VideoPickerModal.jsx:101`, `VideoPickerModal.jsx:109-116`, `HomeVideoListScreen.jsx:419-420`. |
| Home Video thumbnail picker | PASS | Uses `ImageUrlInput`. Evidence: `HomeVideoListScreen.jsx:426-432`. |
| Home Video readonly user | PASS | Add/actions/drag handle hidden when `canUpdate=false`. |
| Home Video i18n | FAIL | Screen text is hardcoded Vietnamese; locale files only have nav/role permission keys for home videos. Evidence: `HomeVideoListScreen.jsx:121-147`, `HomeVideoListScreen.jsx:327-465`, `locales/vi.json:1355-1356`, `locales/en.json:1345-1346`. |
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

#### 1. Unsafe Slider public links can reach the homepage

- Title: Slider `externalLink` is not scheme/policy validated before public rendering.
- Evidence: `UpsertSliderRequest.java:29-30`, `PatchSliderRequest.java:27-28`, `AdminSliderService.java:68-74`, `bigbike-web/app/page.tsx:98`, `HeroSlider.tsx:83`.
- Impact: An admin or compromised admin session can persist `javascript:...`, `data:...`, or `//evil.com` as a homepage CTA link. React/Next will render the href; a visitor click can become script execution, phishing, or open redirect.
- Recommended fix: Add a shared backend validator for public links. Allow only relative paths starting with a single `/` or approved `https://` URLs; reject protocol-relative URLs and unsafe schemes. Mirror validation in `SliderListScreen` before submit, and defensively skip unsafe links in `toHeroSlide`.
- Suggested test: Add API tests that POST/PATCH sliders with `javascript:alert(1)`, `data:text/html,...`, `//evil.com`, `http://evil.com`, `/san-pham`, and `https://bigbike.vn/...`; assert unsafe values return validation errors and safe values pass.

#### 2. Home Video accepts arbitrary external video URLs

- Title: Home Video `videoUrl` policy is too broad for production.
- Evidence: `UpsertHomeVideoRequest.java:17-22`, `PatchHomeVideoRequest.java:14-18`, `AdminHomeVideoService.java:49-64`, `HomeVideoCarousel.tsx:69-80`, `next.config.ts:364-377`.
- Impact: Public homepage can render arbitrary external `https://` video sources, causing privacy, CSP, brand-safety, and supply-chain risk. Current CSP has no explicit `media-src`, so legitimate uploaded media may also fail depending on URL origin.
- Recommended fix: Introduce `HomeVideoUrlPolicy`: YouTube URLs must be on allowed YouTube hosts; uploaded video URLs must come from Media Library/internal media origin or a stored media id. Add CSP `media-src 'self' <media origin>`.
- Suggested test: Add controller/service tests rejecting `https://evil.example/video.mp4`, `http://...`, `data:...`, and non-YouTube hosts that contain `youtube.com` in the path; assert YouTube and internal media URLs pass.

### P1 - Should fix before release

#### 1. YouTube parser is format-friendly but host-unsafe

- Title: `YouTubeUrlParser` regex is not anchored to the URL host.
- Evidence: `YouTubeUrlParser.java:8-18`.
- Impact: A URL on another host that embeds `youtube.com/watch?v=...` in its path/query can still produce a `youtubeId`, misleading downstream embed/thumbnail generation.
- Recommended fix: Parse with `URI`, validate host exactly, then extract ID from query/path. Keep support for `watch?v=`, `youtu.be`, `embed`, `shorts`, and `v`.
- Suggested test: `YouTubeUrlParserTest` should include all supported formats and invalid host/path spoofing cases.

#### 2. Home Videos can have duplicate sort orders

- Title: No DB unique constraint or create/patch duplicate check for `home_videos.sort_order`.
- Evidence: `V35__create_home_videos_table.sql:1-14`, `AdminHomeVideoService.java:49-64`, `AdminHomeVideoService.java:72-96`.
- Impact: Admin ordering can become nondeterministic; public carousel order can drift; future unique migration may fail if duplicates already exist.
- Recommended fix: Add duplicate sort checks in create/patch, clean existing duplicates, then add a migration with `unique(sort_order)` or a future-safe unique key if adding `location` later.
- Suggested test: Service/API tests for duplicate create/patch, and reorder tests that swap positions under the DB unique constraint.

#### 3. Public Home Video endpoint is missing from raw OpenAPI

- Title: OpenAPI drift for `GET /api/v1/home-videos`.
- Evidence: `docs/engineering/API_CONTRACT.md:123`, `PublicHomeVideoController.java:35-45`, `bigbike-backend/src/main/resources/openapi/bigbike-openapi.json` contains admin home-video paths but no public `/api/v1/home-videos`.
- Impact: Generated clients, QA contract checks, and external docs can miss a public production endpoint.
- Recommended fix: Regenerate/update OpenAPI and add a contract test that asserts both public slider and home-video paths are present.
- Suggested test: JSON schema/OpenAPI snapshot test for `/api/v1/home-videos`.

#### 4. Admin Home Videos screen is not i18n-ready

- Title: Home Video admin UI hardcodes Vietnamese strings.
- Evidence: `HomeVideoListScreen.jsx:121-147`, `HomeVideoListScreen.jsx:327-465`; locale files only have nav/role keys at `vi.json:1355-1356`, `en.json:1345-1346`.
- Impact: English admin locale is incomplete and the screen violates current i18n conventions used by Slider screen.
- Recommended fix: Add `homeVideos.*` keys to `vi.json` and `en.json`, then replace hardcoded strings with `useTranslation`.
- Suggested test: Frontend render test or static grep test that the Home Video screen has no user-facing hardcoded Vietnamese strings.

#### 5. Video picker upload behavior and copy are inconsistent

- Title: `VideoPickerModal` has contradictory upload limits and can get stuck in loading after upload.
- Evidence: `VideoPickerModal.jsx:5-6`, `VideoPickerModal.jsx:101`, `VideoPickerModal.jsx:109-116`, `HomeVideoListScreen.jsx:419-420`.
- Impact: Admin sees "500 MB" / "MP4, WebM" guidance but only MP4 under 50 MB is accepted. After successful upload, the modal can stay loading if `page` is already `1` and `search` already empty.
- Recommended fix: Decide real upload policy from Media module, align constants/copy/accept attribute, support WebM if documented, and explicitly refetch after upload instead of relying on unchanged effect dependencies.
- Suggested test: Component test for upload success refresh and max-size/type validation.

#### 6. Slider admin requires manual `productId`

- Title: Slider product linking UX is not production-complete.
- Evidence: `SliderListScreen.jsx:431-433`.
- Impact: Admins must know raw product IDs; this is error-prone and does not match expected commerce admin UX. The backend correctly verifies existence, but the screen will still cause operational mistakes.
- Recommended fix: Add Product Picker/Search using admin product search/list endpoint, store selected product id, and show product name/slug preview.
- Suggested test: Frontend test selecting a product and verifying submit payload contains the selected `productId`.

#### 7. URL policy for media image fields is too loose

- Title: `ImageAssetRequest.url` allows arbitrary `http(s)` and protocol-relative paths.
- Evidence: `ImageAssetRequest.java:8-10`.
- Impact: Slider and Home Video thumbnails can reference arbitrary third-party hosts or `//evil.com`, causing broken assets, privacy leaks, and inconsistent CSP/optimization behavior.
- Recommended fix: Restrict image URLs to Media Library/internal media path or approved CDN/legacy origins; reject `//...` and unapproved hosts.
- Suggested test: DTO/controller tests for accepted Media Library URLs and rejected protocol-relative/external URLs.

#### 8. Test coverage is below production gate

- Title: Home Videos have no tests; Sliders have partial/disabled coverage.
- Evidence: `SliderApiTest.java:58-75` is disabled; `SliderRepositoryTest.java:23-54` covers only order and JSON image persistence; `git grep` found no Home Video tests.
- Impact: Security, ordering, permission, mapping, and public active-only behavior can regress silently.
- Recommended fix: Add the test files listed in the Test Coverage Audit before marking the module complete.
- Suggested test: Prioritize backend tests for URL policy, sort-order integrity, public active-only filtering, permission denial, and YouTube parsing.

#### 9. Public video/media CSP and image domains need alignment

- Title: Public web config does not fully match Home Video media behavior.
- Evidence: `next.config.ts:171-193`, `next.config.ts:364-377`, `HomeVideoCarousel.tsx:69-80`.
- Impact: Uploaded videos may fail under CSP due to missing `media-src`; direct `bigbike.vn` thumbnails used by legacy/WP media can fail through `next/image` unless proxied/resolved.
- Recommended fix: Add explicit `media-src` for self and the configured media origin; add/normalize allowed image origins or ensure all Media Library URLs resolve to same-origin proxy paths.
- Suggested test: Playwright smoke test for a Home Video using uploaded media and a custom thumbnail.

### P2 - Nice to improve

#### 1. HeroSlider has no broken image fallback

- Title: Broken hero URLs degrade the main homepage hero.
- Evidence: `HeroSlider.tsx:84-95`.
- Impact: If a slider image URL fails, users see a broken hero image instead of a designed fallback.
- Recommended fix: Add `onError` fallback to a local branded hero placeholder or skip the failing image.
- Suggested test: Public component test with invalid image URL.

#### 2. Modals need focus trap and focus restoration

- Title: Media/video/public video modals are accessible enough for basics but not production-polished.
- Evidence: `VideoPickerModal.jsx:80-90`, `VideoPickerModal.jsx:135`, `HomeVideoCarousel.tsx:28-55`.
- Impact: Keyboard users can tab outside modals and focus may not return to the opener.
- Recommended fix: Use a small modal/focus-trap helper consistently across admin media pickers and public video modal.
- Suggested test: Playwright accessibility flow: open modal, tab cycle remains inside, Escape closes, focus returns to opener.

#### 3. Dev Home Video seed is not brand-safe or idempotent

- Title: `V1006` uses meme/pop YouTube examples and fixed inserts without conflict handling.
- Evidence: `V1006__seed_home_videos_dev.sql:4-31`.
- Impact: QA/demo environments can display off-brand content; re-running dev seeds can fail if rows already exist.
- Recommended fix: Replace with BigBike-relevant sample/internal media or leave empty; add `ON CONFLICT (id) DO UPDATE/NOTHING`.
- Suggested test: Dev migration smoke test or idempotent seed verification.

#### 4. Slider drag preview opacity is overridden

- Title: `SliderCard` sets opacity twice, overriding drag opacity.
- Evidence: `SliderListScreen.jsx:49`, `SliderListScreen.jsx:65`.
- Impact: Minor visual polish issue during drag and inactive display.
- Recommended fix: Combine inactive and drag opacity in one style expression.
- Suggested test: Visual smoke/manual DnD check.

#### 5. Home Video mock fallback is missing

- Title: `fetchHomeVideos` does not honor forced mock mode the way `fetchSliders` does.
- Evidence: `adminApi.js:1201-1213`, `adminApi.js:1259-1267`, `mockData.js` has slider mock data but no home-video mock data.
- Impact: Local mock-mode admin QA can fail or mislead for this screen.
- Recommended fix: Add `queryMockHomeVideos()` or intentionally show a clear mock-unavailable state.
- Suggested test: Admin API client test with `VITE_USE_ADMIN_MOCK=true`.

## Final Completion Verdict

- Estimated completion:
  - Sliders: 75%
  - Home Videos: 55%
  - Combined module: 65%
- Can release now: No. The module should not be labeled production-ready until the P0 URL/security issues and P1 data integrity/API/test gaps are fixed.
- Conditions for 100% complete:
  - Backend validates Slider links and Home Video URLs with an explicit documented policy.
  - Home Video sort order is unique and protected in both service and DB.
  - Raw OpenAPI matches runtime controllers and docs.
  - Admin screens are localized, accessible enough for keyboard use, and use product/media pickers with coherent validation.
  - Public web has safe fallback rendering and CSP/media domain alignment.
  - Backend and frontend tests cover validation, RBAC, active-only public reads, reorder, URL parsing, and public rendering fallbacks.

## Implementation Checklist

- [ ] Add backend `PublicUrlPolicy` for slider `externalLink`; reject unsafe schemes and protocol-relative URLs.
- [ ] Add backend `MediaAssetUrlPolicy` for slider images and home-video thumbnails; restrict to Media Library/internal/approved origins.
- [ ] Add backend `HomeVideoUrlPolicy`; allow exact YouTube hosts or internal Media Library video URLs only.
- [ ] Rewrite `YouTubeUrlParser` to parse `URI` and validate host before extracting ID.
- [ ] Add service-level duplicate `sortOrder` checks for Home Video create/patch.
- [ ] Add DB migration to clean duplicate `home_videos.sort_order` and add a unique constraint.
- [ ] Regenerate/update `bigbike-openapi.json` to include public `GET /api/v1/home-videos`.
- [ ] Add Product Picker/Search to `SliderListScreen.jsx` instead of raw `productId` text input.
- [ ] Add frontend link/video URL validation matching backend policy.
- [ ] Convert `HomeVideoListScreen.jsx` strings to `homeVideos.*` i18n keys in `vi.json` and `en.json`.
- [ ] Fix `VideoPickerModal` upload limit/type/copy mismatch and force refetch after upload.
- [ ] Add modal focus trap/focus restoration for admin media/video pickers and public video modal.
- [ ] Add `media-src` CSP and align `next.config.ts` image remote patterns/proxy behavior with real media origins.
- [ ] Add `HeroSlider` broken image fallback.
- [ ] Replace or remove `V1006` off-brand dev seed and make it idempotent.
- [ ] Add backend tests: `YouTubeUrlParserTest`, `SliderReadServiceTest`, `AdminSliderServiceTest`, `HomeVideoServiceTest`, `HomeVideoApiTest`.
- [ ] Add DB integration tests for Slider FK set-null, Slider unique reorder, Home Video unique sort order, and JSON image parse/write.
- [ ] Add permission tests for Editor/Admin/Shop Manager against Slider and Home Video admin APIs.
- [ ] Add frontend tests for admin submit payloads, toggles, reorder rollback, readonly behavior, picker selection, and public carousel fallback rendering.
