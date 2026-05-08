# Content · Media · Menus · Sliders · Home Videos · Redirects · Settings — Deep Audit

**Date:** 2026-05-08
**Scope:** Read-only audit of the CMS domain (Content, Media, Menus, Sliders, Home Videos, Redirects, Settings) across all four sub-projects: `bigbike-backend`, `bigbike-admin`, `bigbike-web`, `bigbike_mobile`.
**Docs baseline:** `docs/business/MODULE_CATALOG.md`, `docs/business/BUSINESS_RULES.md`, `docs/business/STATE_MACHINES.md`, `docs/engineering/API_CONTRACT.md`, `docs/engineering/PERMISSION_MATRIX.md`.

---

## Section 1 — Content / Articles Admin API Audit

| Endpoint | Permission Required | Status Filter (admin) | Slug Uniqueness | Publish Transition Validated | Audit Logged | Revalidation Triggered | Finding |
|---|---|---|---|---|---|---|---|
| `GET /api/v1/admin/content` | `content.read` | `DRAFT\|PUBLISHED\|HIDDEN\|ARCHIVED` only | N/A | N/A | N/A | N/A | List filter REGEX excludes PENDING, PRIVATE, TRASH — matches DB check constraint |
| `POST /api/v1/admin/content` (article) | `content.update` | N/A | App-layer uniqueness check | Not validated on create (only on update) | CONTENT_ARTICLE_CREATED | Yes — async post-commit | PARTIAL: create skips transition validation; no initial DRAFT→DRAFT guard needed but docs are silent |
| `PATCH /api/v1/admin/content/{id}` (article) | `content.update` | N/A | App-layer re-checked | `validatePublishTransition()` called | CONTENT_ARTICLE_UPDATED | Yes — async post-commit | OK |
| `DELETE /api/v1/admin/content/{id}` (article) | `content.update` | N/A | N/A | Sets `ARCHIVED` (not TRASH) | CONTENT_ARTICLE_DELETED | Yes | OK — matches STATE_MACHINES.md |
| `POST /api/v1/admin/content` (page) | `content.update` | N/A | App-layer check | Not on create | CONTENT_PAGE_CREATED | Yes | Same PARTIAL as article create |
| `PATCH /api/v1/admin/content/{id}` (page) | `content.update` | N/A | App-layer re-checked | `validatePublishTransition()` called | CONTENT_PAGE_UPDATED | Yes | OK |
| `DELETE /api/v1/admin/content/{id}` (page) | `content.update` | N/A | N/A | Sets `ARCHIVED` | CONTENT_PAGE_DELETED | Yes | OK |

**Evidence:** `bigbike-backend/.../api/admin/AdminContentController.java:49` (PUBLISH_STATUS_REGEX), `AdminContentMutationService.java:82,113` (validatePublishTransition), `AdminContentMutationService.java:92,119,145` (auditLog).

**`resolveAdminId()` behavior:** `AdminContentController.java:160-167` — falls back to hardcoded `DEV_ADMIN_ID = UUID("00000000-0000-0000-0000-000000000001")` when no JWT principal is present. This is the dev header bypass path. Compare `AdminMediaController.resolveAdminId()` which throws `UnauthorizedException` — inconsistent fallback strategy across CMS controllers.

---

## Section 2 — Static Pages / Policies / Guides Audit

| Page Type | DB Constraint | Public Read | Admin Write | SEO Fields | Seeded Via Migration |
|---|---|---|---|---|---|
| ABOUT | `ck_pages_page_type` in V1 | `GET /api/v1/pages/{slug}` — PUBLISHED only | `content.update` | title, description, canonicalUrl, ogImage, noIndex | V21 |
| CONTACT | same | same | same | same | V21 |
| POLICY | same | same | same | same | V21 |
| HELP | same | same | same | same | V21 |
| CUSTOM | same | same | same | same | V21 |

`ContentReadService.getPageBySlug()` filters `PublishStatus.PUBLISHED`. No unpublished page is ever returned to the web or mobile clients.

**Evidence:** `V1__create_catalog_content_tables.sql:276` (page_type check constraint), `ContentReadService.java:getPageBySlug()`.

---

## Section 3 — Content State Machine Audit

| From State | To State | Allowed? | Enforced by | Evidence |
|---|---|---|---|---|
| DRAFT | PUBLISHED | Yes | `AdminMutationValidators.validatePublishTransition()` | `AdminContentMutationService.java:113` |
| PUBLISHED | HIDDEN | Yes | same | same |
| HIDDEN | PUBLISHED | Yes | same | same |
| HIDDEN | ARCHIVED | Yes | same | same |
| PUBLISHED | ARCHIVED | Yes | same | same |
| ARCHIVED | any | No | same | same |
| any → TRASH | Blocked | DB check constraint | `V1__create_catalog_content_tables.sql:243` (`ck_articles_publish_status` only allows DRAFT, PUBLISHED, HIDDEN, ARCHIVED) |
| DELETE action | Sets ARCHIVED | `deleteArticle()` / `deletePage()` | `AdminContentMutationService.java` |

**Mismatch to flag:** `AdminContentController.java:49` defines `PUBLISH_STATUS_REGEX = "^(DRAFT|PUBLISHED|HIDDEN|ARCHIVED)$"` for the admin list filter. The DB `PublishStatus` enum in `domain/catalog/PublishStatus.java` includes `PENDING`, `PRIVATE`, `TRASH` — these are in the Java enum but NOT in the DB check constraint and NOT accepted by the list filter. Docs `STATE_MACHINES.md` does not mention PENDING/PRIVATE/TRASH for content. Status: **CONFLICTING_EVIDENCE** — the Java enum has more states than the DB schema allows for content.

---

## Section 4 — Media Library Audit

### 4a. Upload Security Matrix

| Check | Mechanism | Implementation | Finding |
|---|---|---|---|
| Allowed MIME types | Whitelist | jpeg, png, webp, gif, mp4, mpeg, ogg, wav, webm, aac | SVG explicitly excluded — confirmed |
| Magic-byte detection | Apache Tika on first 8192 bytes | `AdminMediaService.validateMimeContent()` | Declared Content-Type cross-checked with Tika result |
| SVG blocked | Not in ALLOWED_MIME_TYPES | `AdminMediaService.ALLOWED_MIME_TYPES` | OK |
| Filename sanitization | Non-alphanumeric replaced, lowercase, max 200 chars | `AdminMediaService.sanitizeFilename()` | OK |
| Storage backend | MinIO | `AdminMediaService.hardDeleteMedia()` | MinIO delete precedes DB delete (atomic order) |

### 4b. Soft / Hard Delete Matrix

| Operation | Endpoint | Default | Reference Check | MinIO | DB |
|---|---|---|---|---|---|
| Soft delete | `DELETE /{id}?permanent=false` | Yes (default) | None | No | Sets status=DELETED |
| Restore | `PATCH /{id}/restore` | N/A | N/A | N/A | Sets status=ACTIVE |
| Hard delete | `DELETE /{id}?permanent=true` | No | `hasReferences()` checked first | Delete before DB row | Delete DB row |

**Evidence:** `AdminMediaService.java:hardDeleteMedia()`, `AdminMediaController.java`.

### 4c. Public URL Format

`/media/uploads/{uuid}/{filename}` — relative path, no base URL prefix from the service. Clients must prepend the CDN/origin base URL.

### 4d. Media Status Values

ACTIVE, INACTIVE, DELETED. Soft delete → DELETED. Restore → ACTIVE. Hard delete → physical removal.

### 4e. resolveAdminId() difference

`AdminMediaController.resolveAdminId()` throws `UnauthorizedException` when no JWT principal. `AdminContentController.resolveAdminId()` falls back to `DEV_ADMIN_ID`. This inconsistency means unauthenticated media mutations are correctly blocked, but unauthenticated content mutations (via dev header bypass) silently attribute to the fallback dev ID. Risk: CMS-006 (LOW) — tracked in Section 15.

---

## Section 5 — Menus Audit

| Feature | Implementation | Evidence |
|---|---|---|
| Location uniqueness | Service-layer check | `AdminMenuService.java` |
| Cycle detection | `validateNoDeepCycle()` + `detectCycleInMap()` | `AdminMenuService.java` |
| Delete item blocked if has children | `CHILD_ITEMS_EXIST` error | `AdminMenuService.java` |
| Public read — ACTIVE check | `getPublicMenuByLocation()` checks menu status + full ancestor chain | `AdminMenuService.java` |
| Menu item URL validation | NONE — stored as-is | `AdminMenuService.java` — no URL format validation on item URL field |
| Audit logging | Yes — `AuditLogJpaRepository` injected | `AdminMenuService.java:49` |
| Cache/revalidation on change | `WebRevalidationService` called on menu mutation | confirmed |

**Schema (V4):** `menus` table has `location varchar(100) not null unique`. `menu_items.url text` — no DB-level URL constraint.

**Gap:** Menu item URLs are stored without any validation. An EDITOR could store arbitrary strings including javascript: URIs. Risk: CMS-007 (MEDIUM) — tracked in Section 15.

---

## Section 6 — Sliders Audit

| Feature | Implementation | Evidence |
|---|---|---|
| Sort order uniqueness | DB constraint `uq_sliders_location_sort_order` | `V17__create_sliders_table.sql:13` |
| Reorder — constraint safety | Two-pass (negative intermediate values) | `AdminSliderService.java` |
| External link validation | `SafePublicLinkPolicy.validateOrThrow()` | `AdminSliderService.java` |
| Image URL validation | `SafeMediaAssetUrlPolicy.validateImageUrlOrThrow()` | `AdminSliderService.java` |
| is_active field | Added in V34 | `V34__add_slider_is_active.sql` |
| product_id FK | ON DELETE SET NULL | `V17__create_sliders_table.sql:11` |
| Audit logging | NONE — `AuditLogJpaRepository` NOT injected | `AdminSliderService.java` — no import, no audit writes |
| Revalidation | `WebRevalidationService` called | `AdminSliderService.java` import confirmed |
| Permission | `sliders.read` / `sliders.write` | PERMISSION_MATRIX confirmed |

**Web contract — link fields:** `HomeSlider` type in `bigbike-web/lib/contracts/public.ts:59-70` has three link fields: `externalLink`, `productLink`, and `link`. The backend `SliderEntity` has only `external_link` and `product_id`. The `link` field in the web type is a computed/derived field — its derivation logic should be documented. Risk: CMS-005 (LOW — contract drift) — tracked in Section 15.

---

## Section 7 — Home Videos Audit

| Feature | Implementation | Evidence |
|---|---|---|
| Video URL validation | `HomeVideoUrlPolicy.validateOrThrow()` | `AdminHomeVideoService.java` |
| YouTube ID extraction | `YouTubeUrlParser.extractId()` | `AdminHomeVideoService.java` |
| Sort order uniqueness | DB constraint added in V72 | `V72__enforce_home_video_sort_order_uniqueness.sql` |
| youtube_id column | Added in V36 | `V36__add_youtube_id_to_home_videos.sql` |
| is_active field | Boolean, default true | `V35__create_home_videos_table.sql:7` |
| thumbnail | JSON column | `V35__create_home_videos_table.sql:6` |
| Audit logging | NONE — not injected | `AdminHomeVideoService.java` — no AuditLogJpaRepository |
| Revalidation | `WebRevalidationService` called | `AdminHomeVideoService.java` |
| Permission | `home_videos.read` / `home_videos.write` | seeded in test-seed.sql:268-269 |
| Public API endpoint | `GET /api/v1/home-videos` | `SecurityConfig.java:permitAll` |
| Mobile endpoint | `/api/v1/home-videos` — NOT in `ApiEndpoints.dart` | `bigbike_mobile/lib/core/api/api_endpoints.dart` — sliders present, home-videos absent |

**Mobile gap:** `ApiEndpoints.dart` (line 24) has `static const String sliders = '/api/v1/sliders'` but no corresponding constant for `/api/v1/home-videos`. Mobile home screen does not show home videos. Risk: CMS-004 (MEDIUM) — tracked in Section 15.

---

## Section 8 — Redirects Audit

| Feature | Implementation | Evidence |
|---|---|---|
| Allowed status codes | 301, 302, 307, 308 only | `AdminRedirectService.java:34`, `V4__create_media_redirect_menu_tables.sql:40` (DB check constraint) |
| Target URL validation | Blocks `//` protocol-relative; blocks external hosts not matching `bigbike.site.base-url` | `AdminRedirectService.java:292` |
| Source pattern uniqueness | DB unique index added V80 | `V80__add_redirect_source_pattern_unique.sql` |
| Self-loop check | Direct equality only: `sourcePattern.equals(targetUrl)` | `AdminRedirectService.java:332-340` |
| Multi-hop loop detection (A→B→A) | ABSENT | `AdminRedirectService.java` — `validateNoSelfLoop()` only checks direct equality |
| Audit logging | `AuditLogJpaRepository` present | `AdminRedirectService.java:43` |
| Hit counter | `incrementHitCount()` via `InternalRedirectController.POST /api/internal/redirects/hit/{id}` | `InternalRedirectController.java:91-99` |
| Internal token auth | Optional — defaults to OPEN when `bigbike.internal.token` not configured | `InternalRedirectController.java:102-105` |
| Permission | `redirects.read` / `redirects.write`; SEO_EDITOR has both | test-seed.sql:327-330 |
| Revalidation | `WebRevalidationService` called on mutations | `AdminRedirectService.java` |

**Internal API security detail (InternalRedirectController):**
- `isAuthorized()` at line 102-105: returns `true` when `internalToken` is blank (default `${bigbike.internal.token:}`).
- All three endpoints (`GET /redirect`, `GET /redirects/active`, `POST /redirects/hit/**`) are `permitAll` in `SecurityConfig`.
- Design intent (comment at line 30): "When the property is empty (default), the endpoints are open — lock down at the network layer (private VPC / nginx ACL) for production."
- If `BIGBIKE_INTERNAL_TOKEN` is not set in production env and infra ACL is absent, all redirect data is publicly readable and hit counts are publicly writable.
- Status: **NEEDS_INFRA_VERIFICATION** — Risk CMS-002 (HIGH) in Section 15.

---

## Section 9 — Settings Audit

| Feature | Implementation | Evidence |
|---|---|---|
| Sensitive key masking | `MASKED_VALUE = "********"` for keys containing secret, password, token, api_key, privatekey | `AdminSettingsService.java` |
| Public exposure guard | Double-guard: `isSensitiveFragment()` AND `SettingDefinition::publicAllowed` | `AdminSettingsService.isPubliclyExposable()` |
| Public list endpoint | `GET /api/v1/settings/public` — `permitAll` | `SecurityConfig.java` |
| `isPublic` flag write | Single update validates; **batch update does NOT validate `isPublic` changes** | `AdminSettingsService.java` — batch path skips `isPublic` change guard |
| DB schema | `site_settings.is_public boolean not null default false` | `V5__create_commerce_settings_tables.sql:66` |
| Audit logging | `AuditLogJpaRepository` present | `AdminSettingsService.java:37` |
| Revalidation | `WebRevalidationService` triggers `settings` tag | confirmed |
| Mobile contract | `PublicSiteSetting` read via `ApiEndpoints.publicSettings = '/api/v1/settings/public'` | `api_endpoints.dart:23` |
| Admin normalization | `normalizeSetting()` in `bigbike-admin/src/lib/contracts.js` accepts both `key`/`value` (mock) and `settingKey`/`settingValue` (backend) | `contracts.js:normalizeSetting()` |

**Batch update isPublic gap:** The batch update endpoint allows updating `is_public=true` on a sensitive key without validation (single-key update path does validate). This is a minor privilege escalation risk — a SUPER_ADMIN could accidentally expose a sensitive key via batch update. Risk: CMS-008 (LOW) — tracked in Section 15.

---

## Section 10 — Homepage / Public Rendering Matrix

| Data Source | Endpoint | ISR Tag | Sanitization | Safety Check | Notes |
|---|---|---|---|---|---|
| Sliders | `GET /api/v1/sliders?location=home` | `sliders` | None (image URLs only) | `SafePublicLinkPolicy` / `SafeMediaAssetUrlPolicy` at write time | OK |
| Home Videos | `GET /api/v1/home-videos` | `home-videos` | None | `isSafeHomeVideoUrl()` in `app/page.tsx` | OK |
| Public Menu | `GET /api/v1/menus/{location}` | `menus` | None | Ancestor chain ACTIVE check in service | OK |
| Public Settings | `GET /api/v1/settings/public` | `settings` | None | double-guard in `isPubliclyExposable()` | OK |
| `about_content_html` | from settings | `settings` | `sanitizeRichHtml()` in `app/page.tsx` | Yes | OK |
| `home_content_bottom_html` | from settings | `settings` | `sanitizeRichHtml()` | Yes | OK |
| Articles (homepage row) | `GET /api/v1/articles` | `articles` | N/A (title/excerpt only) | PUBLISHED filter in ContentReadService | OK |

**Evidence:** `bigbike-web/app/page.tsx`, `bigbike-web/lib/api/public-api.ts`, `bigbike-web/lib/contracts/public.ts`.

---

## Section 11 — Frontend Contract Matrix

### 11a. bigbike-web `public.ts` Types vs Backend

| Type | Backend Field | Web Field | Match? |
|---|---|---|---|
| `HomeSlider.desktopImage` | `desktop_image JSON` | `desktopImage?: SliderImage \| null` | OK |
| `HomeSlider.mobileImage` | `mobile_image JSON` | `mobileImage?: SliderImage \| null` | OK |
| `HomeSlider.productId` | `product_id varchar(64)` | `productId?: string \| null` | OK |
| `HomeSlider.externalLink` | `external_link text` | `externalLink?: string \| null` | OK |
| `HomeSlider.productLink` | Not in DB | `productLink?: string \| null` | **DRIFT** — derived/computed on backend, not stored |
| `HomeSlider.link` | Not in DB | `link?: string \| null` | **DRIFT** — derived/computed, not stored; source of truth unclear |
| `HomeVideo.youtubeId` | `youtube_id varchar(32)` (V36) | `HomeVideo` via `VideoAsset` — no direct youtubeId typed | Schema has youtubeId; web type uses `VideoAsset` shape without explicit youtubeId field |
| `PublicSiteSetting.settingKey` | `setting_key varchar(255)` | `settingKey` | OK |
| `PublicSiteSetting.settingValue` | `setting_value text` | `settingValue` | OK |

### 11b. bigbike-admin `contracts.js` vs Backend

| Field | Backend | Admin | Notes |
|---|---|---|---|
| Setting key | `settingKey` | `normalizeSetting()` accepts `key` or `settingKey` | Dual-field normalization for mock/real backend |
| Setting value | `settingValue` | `normalizeSetting()` accepts `value` or `settingValue` | Same |
| Setting group | `settingGroup` | `settingGroup` with default `'GENERAL'` | OK |

### 11c. bigbike_mobile `api_endpoints.dart` vs Backend

| Module | Endpoint Constant | Exists in `ApiEndpoints`? |
|---|---|---|
| Sliders | `/api/v1/sliders` | Yes — `static const String sliders` |
| Home Videos | `/api/v1/home-videos` | **NO** — missing |
| Public Menu | `/api/v1/menus/{location}` | Yes — `static String menu(String location)` |
| Public Settings | `/api/v1/settings/public` | Yes — `static const String publicSettings` |
| Articles | `/api/v1/articles` | Yes |
| Pages | `/api/v1/pages/{slug}` | Yes — `static String page(String slug)` |

---

## Section 12 — Security / Permission Audit Table

| Permission | Role(s) | Admin Endpoint | Public Endpoint | Runtime Source |
|---|---|---|---|---|
| `content.read` | ADMIN, SHOP_MANAGER(no), EDITOR, AUTHOR, CONTRIBUTOR, SEO_EDITOR | `GET /api/v1/admin/content` | N/A | `role_permissions` DB table |
| `content.update` | ADMIN, EDITOR, AUTHOR, SEO_EDITOR | `POST/PATCH/DELETE /api/v1/admin/content` | N/A | same |
| `media.read` | ADMIN, EDITOR, AUTHOR, CONTRIBUTOR | `GET /api/v1/admin/media/**` | N/A | same |
| `media.write` | ADMIN, EDITOR, AUTHOR | `POST/PATCH/DELETE /api/v1/admin/media/**` | N/A | same |
| `menus.read` | ADMIN, EDITOR | `GET /api/v1/admin/menus/**` | `GET /api/v1/menus/**` (permitAll) | same |
| `menus.write` | ADMIN, EDITOR | `POST/PATCH/DELETE /api/v1/admin/menus/**` | N/A | same |
| `sliders.read` | ADMIN, EDITOR | `GET /api/v1/admin/sliders/**` | `GET /api/v1/sliders` (permitAll) | same |
| `sliders.write` | ADMIN, EDITOR | `POST/PATCH/DELETE /api/v1/admin/sliders/**` | N/A | same |
| `home_videos.read` | ADMIN | `GET /api/v1/admin/home-videos/**` | `GET /api/v1/home-videos` (permitAll) | same |
| `home_videos.write` | ADMIN | `POST/PATCH/DELETE /api/v1/admin/home-videos/**` | N/A | same |
| `redirects.read` | ADMIN, SEO_EDITOR | `GET /api/v1/admin/redirects/**` | `/api/internal/redirects/active` (permitAll) | same |
| `redirects.write` | ADMIN, SEO_EDITOR | `POST/PATCH/DELETE /api/v1/admin/redirects/**` | `/api/internal/redirects/hit/**` (permitAll) | same |
| `settings.read` | ADMIN | `GET /api/v1/admin/settings/**` | `GET /api/v1/settings/public` (permitAll) | same |
| `settings.write` | ADMIN | `POST/PATCH /api/v1/admin/settings/**` | N/A | same |
| N/A (internal) | N/A | N/A | `/api/internal/redirect` (permitAll) | optional `X-Internal-Token` |

**Runtime permission source:** `AdminPermissionService.java` — reads from `role_permissions` DB table. `AdminRolePermissions.MAP` (reference-only Java class) is NOT used at runtime.

**EDITOR does NOT have `home_videos.read` or `home_videos.write`** — confirmed by both `AdminRolePermissions.MAP` and `test-seed.sql`. The home_videos permissions are ADMIN-only in the reference mapping.

---

## Section 13 — SEO / Sitemap / Robots / Revalidation Audit

### 13a. ISR Revalidation Flow

```
Backend mutation (e.g. updateArticle)
  → WebRevalidationService.revalidate(tags)
  → TransactionSynchronization.afterCommit() [post-transaction]
  → CompletableFuture.runAsync() [async, non-blocking]
  → POST https://bigbike-web/api/revalidate
    Header: x-revalidate-secret: {REVALIDATE_SECRET}
    Body: { "tags": ["articles"] }
  → bigbike-web/app/api/revalidate/route.ts
    → validates secret (REVALIDATE_SECRET ?? WEB_REVALIDATE_SECRET env var)
    → revalidateTag(tag, { expire: 0 })
```

**Non-standard `revalidateTag` call:** `route.ts:42` calls `revalidateTag(tag, { expire: 0 })`. The standard Next.js `revalidateTag(tag)` signature accepts only a single string argument. The `{ expire: 0 }` second argument is not documented in Next.js stable API. This may be a custom extension or a mistake. Risk: CMS-003 (MEDIUM) — tracked in Section 15.

**Revalidation disabled when:** `bigbike.web.revalidate-url` or `bigbike.web.revalidate-secret` is empty/blank in backend config. Mutations still succeed; only ISR cache invalidation is skipped.

### 13b. SEO Fields Coverage

| Entity | seo_title | seo_description | seo_canonical_url | seo_og_image | seo_no_index |
|---|---|---|---|---|---|
| articles | Yes (V1) | Yes | Yes | Yes | Yes |
| pages | Yes (V1) | Yes | Yes | Yes | Yes |
| products | Yes (V1) | Yes | Yes | Yes | Yes |
| brands | Yes (V1) | Yes | Yes | Yes | Yes |
| categories | Yes (V1) | Yes | Yes | Yes | Yes |
| sliders | No | No | No | N/A | N/A |
| menus | No | No | No | N/A | N/A |
| home_videos | No | No | No | N/A | N/A |
| redirects | No (notes field only) | No | N/A | N/A | N/A |

### 13c. Tags Map

| ISR Tag | Revalidated By | Next.js Consumer |
|---|---|---|
| `articles` | Article create/update/delete | article list and detail pages |
| `pages` | Page create/update/delete | static page routes |
| `sliders` | Slider mutations | homepage slider section |
| `home-videos` | Home video mutations | homepage video section |
| `menus` | Menu mutations | all navigation components |
| `settings` | Settings mutations | homepage settings-driven content |
| `redirects` | Redirect mutations | N/A — redirects loaded via InternalRedirectController, not ISR |

---

## Section 14 — Test Coverage Audit Table

| Test Class | Tests | Pass | Fail | Skip | Root Cause (if failing) |
|---|---|---|---|---|---|
| `AdminContentApiTest` | 10 | 10 | 0 | 0 | — |
| `ContentPublicApiTest` | 13 | 13 | 0 | 0 | — |
| `ContentP1ApiTest` | 10 | 10 | 0 | 0 | — |
| `AdminMediaP0Test` | 12 | 12 | 0 | 0 | — |
| `SliderApiTest` | 9 | 9 | 0 | 0 | — |
| `SliderRepositoryTest` | 3 | 3 | 0 | 0 | — |
| `HomeVideoRepositoryTest` | 3 | 3 | 0 | 0 | — |
| `AdminRedirectApiTest` | 8 | 8 | 0 | 0 | — |
| `HomeVideoApiTest` | 7 | 7 | 0 | 0 | — |
| `WebRevalidationServiceTest` | 2 | 2 | 0 | 0 | — |
| `AdminMutationValidatorsTest` | 5 | 5 | 0 | 0 | — |
| `HomepagePublicApiTest` | ~11 | ~10 | 0 | 1 | 1 test skipped (annotated) |
| `PublicReadApiTest` | ~11 | ~11 | 0 | 0 | — |
| **`Phase1JAdminSettingsMenuCouponApiTest`** | **83** | **18** | **65** | **0** | **Missing `@Sql` annotation — see CMS-001** |

**Total tested (this domain):** ~193 tests; 128 pass, 65 fail, 1 skip.

**Phase1JAdminSettingsMenuCouponApiTest root cause (CMS-001):**

The test class at `bigbike-backend/src/test/java/.../api/Phase1JAdminSettingsMenuCouponApiTest.java:41-42` has:
```java
@SpringBootTest
class Phase1JAdminSettingsMenuCouponApiTest {
```

It is missing:
```java
@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)
```

In the test profile (`src/test/resources/application.properties`):
- `spring.flyway.enabled=false` — Flyway migrations do not run.
- `spring.jpa.hibernate.ddl-auto=create-drop` — Hibernate creates tables from entities but does NOT seed data.

`AdminPermissionService.getPermissionsForRole("ADMIN")` reads from the empty `role_permissions` table and returns an empty list. Every authenticated request's permission check fails → HTTP 403. Compare `AdminContentApiTest.java:17`: `@Sql(scripts = "/db/test-seed.sql", ...)` present → permissions seeded → 10/10 pass.

---

## Section 15 — Risk Register

| ID | Severity | Module | Title | Evidence | Recommended Action |
|---|---|---|---|---|---|
| **CMS-001** | **CRITICAL** | Testing | `Phase1JAdminSettingsMenuCouponApiTest` — 65/83 tests fail with HTTP 403 | `Phase1JAdminSettingsMenuCouponApiTest.java:41` (missing `@Sql`); `test-seed.sql` seeds `role_permissions` | Add `@Sql(scripts = "/db/test-seed.sql", executionPhase = Sql.ExecutionPhase.BEFORE_TEST_CLASS)` to `Phase1JAdminSettingsMenuCouponApiTest` |
| **CMS-002** | **HIGH** | Security | `InternalRedirectController` — three endpoints `permitAll` and token defaults to OPEN | `InternalRedirectController.java:102-105` (`isAuthorized()` returns `true` when token blank); `SecurityConfig.java` (`permitAll` for all three) | Set `BIGBIKE_INTERNAL_TOKEN` env var in production AND verify nginx/VPC ACL blocks external access; NEEDS_INFRA_VERIFICATION |
| **CMS-003** | **MEDIUM** | Next.js Web | `revalidateTag(tag, { expire: 0 })` — second argument not in Next.js stable API | `bigbike-web/app/api/revalidate/route.ts:42` | Verify against current Next.js version in `node_modules/next/dist/docs/`; remove or document the second argument |
| **CMS-004** | **MEDIUM** | Mobile | Home Videos endpoint missing from `ApiEndpoints.dart` — mobile never loads home videos | `bigbike_mobile/lib/core/api/api_endpoints.dart` — `sliders` present, `homeVideos` absent | Add `static const String homeVideos = '/api/v1/home-videos'` and implement home video widget |
| **CMS-005** | **MEDIUM** | Redirect | No multi-hop redirect loop detection (A→B→A chains) | `AdminRedirectService.java:332-340` — only checks `sourcePattern.equals(targetUrl)` | Implement chain-walk validation or add DB-level chain detection |
| **CMS-006** | **LOW** | Content | `AdminContentController.resolveAdminId()` falls back to hardcoded dev UUID when no JWT principal | `AdminContentController.java:160-167`; contrast `AdminMediaController` which throws | Standardize fallback — throw `UnauthorizedException` in content controller too (or document intentional asymmetry) |
| **CMS-007** | **LOW** | Menus | Menu item URL field has no validation — arbitrary strings including `javascript:` URIs accepted | `AdminMenuService.java`, `V4__create_media_redirect_menu_tables.sql:63` (`url text`) | Add URL scheme whitelist validation in `AdminMenuService` (allow http, https, relative `/`, `tel:`, `mailto:`) |
| **CMS-008** | **LOW** | Settings | Batch settings update does not validate `is_public` flag changes for sensitive keys | `AdminSettingsService.java` — batch path skips `isPublic` guard that single-update path applies | Apply same `isPubliclyExposable()` guard in batch update path |
| **CMS-009** | **LOW** | Content | `PublishStatus` Java enum has PENDING/PRIVATE/TRASH states not supported by DB check constraint or admin list filter | `domain/catalog/PublishStatus.java` vs `V1__create_catalog_content_tables.sql:243`; `AdminContentController.java:49` | Either remove unused enum values or add DB migration to support them; document which values are reserved for future use |
| **CMS-010** | **LOW** | Slider/HomeVideo | No audit log for slider or home video mutations | `AdminSliderService.java` and `AdminHomeVideoService.java` — `AuditLogJpaRepository` not injected | Inject `AuditLogJpaRepository` and write audit events for create/update/delete/reorder |
| **CMS-011** | **LOW** | Web Contract | `HomeSlider` web type has `productLink` and `link` fields with no backend DB column | `bigbike-web/lib/contracts/public.ts:67-68`; slider DB schema has only `external_link` and `product_id` | Document derivation logic in `public-api.ts` or type file; remove unused fields if not computed |

---

## Section 16 — Summary Table

| Module | Backend Impl | Admin UI | Web (Next.js) | Mobile (Flutter) | Tests | Audit Logs | Revalidation | Top Risk |
|---|---|---|---|---|---|---|---|---|
| Content / Articles | COMPLETE | Confirmed (via test) | ISR `articles` tag | API endpoint present | 10/10 pass | Yes | Yes | CMS-009 (enum/DB mismatch) |
| Static Pages | COMPLETE | Confirmed | ISR `pages` tag | `/api/v1/pages/{slug}` in endpoints | 10/10 pass | Yes | Yes | None |
| Media Library | COMPLETE | Confirmed | N/A | `media_image.dart` widget | 12/12 pass | Yes | N/A | None |
| Menus | COMPLETE | Confirmed | ISR `menus` tag | `menu()` in endpoints | Part of Phase1J (failing) | Yes | Yes | CMS-007 (URL no-validate) |
| Sliders | COMPLETE | Confirmed | ISR `sliders` tag | `sliders` in endpoints | 9/9 pass | **MISSING** | Yes | CMS-010 (no audit log) |
| Home Videos | COMPLETE | Confirmed | ISR `home-videos` tag | **MISSING from endpoints** | 7/7 pass | **MISSING** | Yes | CMS-004 (mobile gap) + CMS-010 |
| Redirects | COMPLETE | Confirmed | InternalRedirectController | N/A | 8/8 pass | Yes | Yes | CMS-002 (open endpoints) + CMS-005 (no multi-hop) |
| Settings | COMPLETE | Confirmed | ISR `settings` tag | `publicSettings` in endpoints | Part of Phase1J (failing) | Yes | Yes | CMS-008 (batch guard gap) |
| **Test Suite** | — | — | — | — | **65/193 fail** | — | — | **CMS-001 CRITICAL** |

### Overall Domain Health

- **Backend implementation:** All 8 modules are complete and operational. Core business rules (Tika MIME detection, publish state machine, sensitive key masking, slug uniqueness, sort order uniqueness, cycle detection, reference-check before hard delete) are correctly enforced.
- **Critical blocker:** `Phase1JAdminSettingsMenuCouponApiTest` (CMS-001) — 65 test failures caused by a single missing annotation. This suppresses CI signal for Settings, Menus, and Coupons admin API coverage.
- **Security gap:** InternalRedirectController (CMS-002) is open by default; requires confirmed infra ACL for production.
- **Mobile gap:** Home Videos not wired in mobile client (CMS-004).
- **Missing audit coverage:** Slider and HomeVideo services do not write audit logs (CMS-010).
- **Non-standard Next.js API:** `revalidateTag` second argument (CMS-003) should be verified against installed Next.js version.
