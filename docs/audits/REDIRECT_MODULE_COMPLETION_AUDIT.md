# Redirect Module Completion Audit

> Audit ngày: 2026-05-07
> Phạm vi: bigbike-admin · bigbike-backend · bigbike-web · docs · migrations · tests
> Phương pháp: trace end-to-end (UI → API client → controller → service → DB → internal API → web proxy → user) trên branch `main` (HEAD `6e2f78e`).

---

## 1. Executive Summary

| Mục | Đánh giá |
|---|---|
| **Verdict** | **CHƯA SẴN SÀNG PRODUCTION** — chạy được CRUD cơ bản, nhưng có 4 lỗ hổng/khoảng trống nghiêm trọng (RBAC mismatch, lack of unique DB constraint, redirect cache không bị invalidate, dead internal endpoints). |
| **Overall score** | **62 / 100** |
| **Production readiness** | Với các fix BLOCKER/HIGH bên dưới sẽ đạt mức MVP. Hiện tại nếu deploy: redirect rules có thể bị duplicate ở DB do race, SEO_EDITOR không thật sự dùng được module dù docs/permission đã seed, và internal endpoint `/api/internal/redirects/*` đang `permitAll` chưa được hardened ở infra layer (đã được flag trong DOCS_VERIFICATION_REPORT). |
| **Biggest risks** | 1) Race condition tạo trùng `source_pattern` (DB không có UNIQUE). 2) `SEO_EDITOR` không thể vào `/api/v1/admin/redirects/**` vì SecurityConfig chỉ cho `ROLE_ADMIN`. 3) Hit counter / bulk-active endpoint là dead integration — proxy không gọi. 4) Cache invalidation BE → web không liên thông tới L1 in-process map của `proxy.ts`. |

---

## 2. Module Inventory

### 2.1 bigbike-admin

| Path | Vai trò | Live? | Vấn đề |
|---|---|---|---|
| [bigbike-admin/src/screens/RedirectListScreen.jsx](../../bigbike-admin/src/screens/RedirectListScreen.jsx) | Screen list/create/edit/delete redirect | ✅ | UI dùng được. Thiếu preview/test, thiếu bulk import, không có cảnh báo open-redirect khi target external. |
| [bigbike-admin/src/lib/adminApi.js#L769-L820](../../bigbike-admin/src/lib/adminApi.js#L769-L820) | `fetchRedirects`, `fetchRedirectDetail`, `createRedirect`, `updateRedirect`, `deleteRedirect` | ✅ | Mock fallback (`shouldFallbackToMockOnLiveError`) có thể che lỗi production khi backend down. |
| [bigbike-admin/src/lib/adminApi.js#L319-L327](../../bigbike-admin/src/lib/adminApi.js#L319-L327) | `buildRedirectQuery` | ✅ | OK. `'ALL'` bị lọc trong `toQueryString` nên không leak query lỗi. |
| [bigbike-admin/src/lib/contracts.js#L350-L371](../../bigbike-admin/src/lib/contracts.js#L350-L371) | `normalizeRedirect` (FE contract normalizer) | ✅ | OK, accept cả `enabled` và (qua JsonAlias BE) `isEnabled`. |
| [bigbike-admin/src/lib/mockData.js#L266-L309](../../bigbike-admin/src/lib/mockData.js#L266-L309) | Mock seed `REDIRECT_DATA` | ✅ (mock mode) | OK. |
| [bigbike-admin/src/lib/mockData.js#L449-L500](../../bigbike-admin/src/lib/mockData.js#L449-L500) | `queryMockRedirects`, `getMockRedirectById` | ✅ (mock mode) | OK. |
| [bigbike-admin/src/App.jsx#L43](../../bigbike-admin/src/App.jsx#L43) | Lazy import `RedirectListScreen` | ✅ | OK. |
| [bigbike-admin/src/App.jsx#L87](../../bigbike-admin/src/App.jsx#L87) | Sidebar entry `nav.redirects` (group `content`) | ✅ | OK. |
| [bigbike-admin/src/App.jsx#L161,L201,L377-L378](../../bigbike-admin/src/App.jsx) | Route mapping + permission gate | ✅ | OK. |

### 2.2 bigbike-backend

| Path | Vai trò | Live? | Vấn đề |
|---|---|---|---|
| [bigbike-backend/.../api/admin/AdminRedirectController.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminRedirectController.java) | REST `/api/v1/admin/redirects` (list/get/create/patch/delete) | ✅ | OK validation. Hardcoded `DEV_ADMIN_ID` fallback xuất hiện trong audit log nếu auth context trống. |
| [bigbike-backend/.../api/internal/InternalRedirectController.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/internal/InternalRedirectController.java) | `GET /api/internal/redirect`, `GET /redirects/active`, `POST /redirects/hit/{id}` | ⚠️ Chỉ `GET /api/internal/redirect` được dùng | `redirects/active` và `redirects/hit/{id}` **chưa được proxy gọi** — dead integration. |
| [bigbike-backend/.../service/admin/AdminRedirectService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminRedirectService.java) | CRUD + audit + revalidate | ✅ | Snapshot JSON build thủ công (escape thô) — không robust với ký tự đặc biệt. Validation chỉ chặn self-loop trực tiếp, không chặn chain/indirect loop, không kiểm soát external target. |
| [bigbike-backend/.../persistence/entity/redirect/RedirectEntity.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/redirect/RedirectEntity.java) | JPA entity | ✅ | OK. |
| [bigbike-backend/.../persistence/repository/redirect/RedirectJpaRepository.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/redirect/RedirectJpaRepository.java) | Repo + `incrementHitCount` query atomic | ✅ | `incrementHitCount` được implement nhưng không có endpoint web gọi. |
| [bigbike-backend/.../persistence/repository/redirect/RedirectSpecification.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/redirect/RedirectSpecification.java) | Filter `q`/`enabled`/`statusCode` | ✅ | OK. |
| [bigbike-backend/.../service/web/WebRevalidationService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/web/WebRevalidationService.java) | Gọi Next.js `revalidateTag` post-commit | ✅ | Tag `redirects` không khớp với cache thật trong proxy.ts (xem mục 8). |
| [bigbike-backend/.../service/auth/DevAdminAuthService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/DevAdminAuthService.java) | `requirePermission` | ✅ | OK ở controller level. Nhưng gặp ROLE matcher trong SecurityConfig sớm hơn. |
| [bigbike-backend/.../service/auth/AdminRolePermissions.java#L33,L67](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminRolePermissions.java) | Map ADMIN + SEO_EDITOR → `redirects.read/write` | ✅ | Mâu thuẫn với `SecurityConfig.java:109` (xem BLOCKER #1). |
| [bigbike-backend/.../config/SecurityConfig.java#L93-L97,L109](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java) | URL-level role matchers | ✅ | `/api/internal/redirect*` `permitAll`; `/api/v1/admin/**` chỉ `hasRole("ADMIN")`. |

### 2.3 Migration / SEO importer

| Path | Vai trò | Live? | Vấn đề |
|---|---|---|---|
| [bigbike-backend/.../migration/wordpress/importer/RedirectImporter.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/importer/RedirectImporter.java) | Upsert MappedRedirect → DB | ✅ (CLI runner) | Phục vụ Phase 2D import, KHÔNG gọi từ admin UI. |
| [bigbike-backend/.../migration/wordpress/redirect/FgRedirectResolver.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/redirect/FgRedirectResolver.java) | FG redirect → product slug resolver | ✅ (CLI runner) | OK. Test coverage tốt. |
| [bigbike-backend/.../migration/wordpress/redirect/FgRedirectAnalyzer.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/redirect/FgRedirectAnalyzer.java) | Analytics khi resolve | ✅ (CLI runner) | OK. |
| [bigbike-backend/.../migration/wordpress/redirect/RankMathRedirectImporter.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/redirect/RankMathRedirectImporter.java) | RankMath import pipeline | ✅ (CLI runner) | OK. |
| [bigbike-backend/.../migration/wordpress/redirect/RedirectResolverService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/redirect/RedirectResolverService.java) | Orchestrator (RankMath > FG > Legacy) | ⚠️ | Implement đầy đủ nhưng **không có user (caller) thực** trong codebase ngoài chính nó — `WordPressMigrationImportService` đi đường khác qua `FgRedirectResolver` + `RedirectImporter`. Có thể là tooling chuẩn bị cho phase sau hoặc dead code. |
| [bigbike-backend/.../migration/wordpress/redirect/LegacyUrlMapper.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/redirect/LegacyUrlMapper.java) | Sinh fallback redirect từ slug | ✅ (CLI runner) | OK theo test. |
| [bigbike-backend/.../migration/wordpress/mapper/WordPressRedirectMapper.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/mapper/WordPressRedirectMapper.java) | RankMath WpRedirectRow → MappedRedirect | ✅ | OK theo test. |
| [bigbike-backend/.../migration/wordpress/parser/WordPressCsvRedirectReader.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/parser/WordPressCsvRedirectReader.java) | CSV parser | ✅ | OK. |
| [bigbike-backend/.../migration/wordpress/runner/WordPressMigrationImportRunner.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/runner/WordPressMigrationImportRunner.java) | CLI ApplicationRunner với 5 guard | ✅ | OK, không tự chạy. |
| [bigbike-web/docs/legacy/SEO_REDIRECT_MAP.csv](../../bigbike-web/docs/legacy/SEO_REDIRECT_MAP.csv) | Map tham khảo | ✅ (doc) | **Không có importer admin** đọc CSV này. CSV chứa template `{slug}` — không phải dữ liệu trực tiếp insert được. |

### 2.4 Database

| Path | Vai trò | Live? | Vấn đề |
|---|---|---|---|
| [bigbike-backend/src/main/resources/db/migration/V4__create_media_redirect_menu_tables.sql](../../bigbike-backend/src/main/resources/db/migration/V4__create_media_redirect_menu_tables.sql) | Tạo bảng `redirects`, `idx_redirects_*` + `ck_redirects_status_code` | ✅ | **Thiếu UNIQUE** trên `source_pattern`, **thiếu unique** trên `legacy_id`. |
| [bigbike-backend/src/main/resources/db/migration/V58__add_redirect_permissions.sql](../../bigbike-backend/src/main/resources/db/migration/V58__add_redirect_permissions.sql) | Seed permissions cho ADMIN + SEO_EDITOR | ✅ | Idempotent (`ON CONFLICT DO NOTHING`). Permission của SEO_EDITOR thực tế không xài được (xem mục RBAC). |

### 2.5 Web

| Path | Vai trò | Live? | Vấn đề |
|---|---|---|---|
| [bigbike-web/proxy.ts](../../bigbike-web/proxy.ts) | Next.js 16 proxy (middleware) lookup redirect, redirect 301/302/307/308 | ✅ | (1) Chỉ gọi exact-match endpoint `/api/internal/redirect`, không gọi `/redirects/active` (dù comment InternalRedirectController nói "consumed by Next.js middleware cache"). (2) Không gọi `/redirects/hit/{id}`. (3) L1 cache 300s không được invalidate khi admin sửa redirect. (4) Không preserve query string. (5) Không chống chain. |
| [bigbike-web/app/api/revalidate/route.ts](../../bigbike-web/app/api/revalidate/route.ts) | Endpoint nhận webhook revalidateTag | ✅ | Chỉ revalidate Next.js cache (fetch/ISR), không xóa được L1 Map của proxy. |
| `bigbike-web/__tests__` | Test web | — | **Không có test cho proxy.ts.** |

### 2.6 Tests

| Path | Loại | Vấn đề |
|---|---|---|
| [bigbike-backend/.../api/AdminRedirectApiTest.java](../../bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/AdminRedirectApiTest.java) | MockMvc, integration | Cover happy path, forbidden khi thiếu permission, validate self-loop. **KHÔNG cover**: missing required field, duplicate sourcePattern, invalid statusCode 999, race condition, audit log content, security URL-level (`hasRole("ADMIN")` test). MockMvc setup không apply `springSecurity()` nên KHÔNG validate URL matcher — chỉ test permission ở DevAdminAuthService level. |
| [bigbike-backend/.../api/Phase2D4RedirectMappingTest.java](../../bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase2D4RedirectMappingTest.java) | Integration | Cover tốt FG resolver, RankMath importer, LegacyUrlMapper, idempotency, dry-run, self-loop. **KHÔNG cover**: chain/indirect loop, external target, RedirectResolverService orchestrator. |
| [bigbike-backend/src/test/resources/fixtures/wordpress/seo_redirect_sample.csv](../../bigbike-backend/src/test/resources/fixtures/wordpress/seo_redirect_sample.csv) | Fixture | OK. |
| `bigbike-admin/src/screens/__tests__/RedirectListScreen.test.*` | — | **Không tồn tại.** |
| `bigbike-web/__tests__/proxy.test.*` | — | **Không tồn tại.** |
| `bigbike-web/__tests__/redirect.test.*` | — | **Không tồn tại.** |

### 2.7 Build artefacts đã commit (cleanup)

`bigbike-backend/target/classes/db/migration/V58__add_redirect_permissions.sql` cùng nhiều file `.class` redirect đang được track bởi git (`git ls-files bigbike-backend/target` trả về kết quả). Đây là vấn đề build hygiene chung của repo — ghi nhận tại [docs/audits/REDIRECT_MODULE_COMPLETION_AUDIT.md](.) để xử lý chung, không thuộc scope module Redirect.

---

## 3. End-to-End Flow Verification

### 3.1 Admin tạo redirect

```
[Admin user] click "Create redirect" trong RedirectListScreen
  → setForm({ sourcePattern, targetUrl, redirectType, statusCode, enabled, notes, legacyId })
  → handleSubmit validate FE (required source/target)
  → saveMutation.mutate() gọi createRedirect(payload)
  → adminApi.js: POST /admin/redirects (Bearer JWT từ readTokens())
  → API base: ${API_BASE}/admin/redirects (env VITE_API_BASE_URL)
  → Spring Security:
      - JwtAuthFilter parse Bearer → set Authentication với ROLE_ADMIN (cho ADMIN)
      - SecurityConfig:109 .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
        → ADMIN ✅ pass; SEO_EDITOR ❌ fail (xem BLOCKER)
  → AdminRedirectController.createRedirect:
      - devAdminAuthService.requirePermission(request, "redirects.write")
        → kiểm tra permission từ ROLE_PERMISSION_MAP của role
      - resolveAdminId() → AdminPrincipal.id() hoặc DEV_ADMIN_ID fallback
      - service.createRedirect(adminId, request)
  → AdminRedirectService.createRedirect (Transactional):
      - normalizeSourcePattern (trim, prepend /)
      - normalizeRequiredUrl(targetUrl)
      - validateNoSelfLoop
      - ensureUniqueSourcePattern (race-prone — DB không có UNIQUE)
      - normalizeStatusCode {301,302,307,308}, default 301
      - normalizeRedirectType từ statusCode
      - new RedirectEntity, set fields, save
      - auditLogRepo.save(REDIRECT_CREATED, adminId, beforeNull, afterSnapshot)
      - webRevalidationService.revalidate("redirects") (sau commit)
  → response 200 + AdminRedirectResponse
```

### 3.2 Web revalidation (broken)

```
WebRevalidationService.revalidate("redirects")
  → POST {bigbike.web.revalidate-url} với header x-revalidate-secret
  → bigbike-web /app/api/revalidate/route.ts
  → revalidateTag("redirects", { expire: 0 })
       └─ chỉ áp dụng cho fetch() có { next: { tags: ["redirects"] } } hoặc ISR pages
       └─ KHÔNG áp dụng cho Map cache `l1Cache` trong proxy.ts → cache stale tối đa 300s
       └─ Cache là per-process; nhiều worker → mỗi worker có L1 riêng
```

### 3.3 User truy cập URL cũ

```
[Browser] GET https://bigbike.vn/old-url
  → Next.js 16 proxy (proxy.ts) chạy trước route handler
  → matcher exclude: api, _next/static, _next/image, favicon.ico, sitemap.xml, sitemap_index.xml, robots.txt, wp-content
  → IF /tai-khoan/* và không có bb_session → redirect /dang-nhap (auth gate, không liên quan SEO redirect)
  → IF / với ?s= → redirect 301 sang /tim-kiem/?q= (search legacy fallback)
  → ELSE lookupRedirect(pathname):
      - L1 cache check → nếu hit, return ngay (TTL 300s)
      - fetchFromBackend(/api/internal/redirect?path=/old-url) qua API_BASE_URL
        → InternalRedirectController.lookup()
          → redirectRepo.findBySourcePattern("/old-url").filter(enabled=true)
          → 200 {target,statusCode} hoặc 404
      - nếu null và path có trailing slash → thử path bỏ trailing
  → IF rule null → NextResponse.next() (không redirect)
  → IF isLoop → NextResponse.next()
  → ELSE NextResponse.redirect(destination, rule.statusCode || 301)
  → recordHit(redirectId): KHÔNG ĐƯỢC GỌI → hit_count luôn 0
```

### 3.4 SEO migration import flow

```
CLI / one-shot:
  --bigbike.migration.wordpress.enabled=true
  --bigbike.migration.wordpress.confirm-execute=true
  --bigbike.migration.wordpress.environment=local|staging
  → WordPressMigrationImportRunner (5 guards: enabled, !dryRun, mode=import, confirm-execute, env)
  → WordPressMigrationImportService.run(options)
     ├─ Đọc dump SQL của WP (kd_rank_math_redirections, kd_fg_redirect)
     ├─ FgRedirectResolver.resolve(fgRedirects) → MappedRedirects
     ├─ RankMath rows → MappedRedirects
     └─ RedirectImporter.importBatch(allRedirects, options)
        ├─ Upsert by sourcePattern (find or create)
        ├─ Skip self-loop, skip blank
        └─ Save với enabled=true, redirectType=PERMANENT
```

⚠️ Không có SEO_REDIRECT_MAP.csv importer cho admin — admin không có nút "Import CSV". CSV chỉ là tài liệu reference với template `{slug}`.

---

## 4. Admin UI Audit

| Hạng mục | Đánh giá |
|---|---|
| Route `/admin/redirects` tồn tại | ✅ ([App.jsx:161](../../bigbike-admin/src/App.jsx#L161)) |
| Sidebar entry, group `content`, icon `ArrowRightLeft` | ✅ ([App.jsx:87](../../bigbike-admin/src/App.jsx#L87)) |
| Lazy load `RedirectListScreen` | ✅ ([App.jsx:43](../../bigbike-admin/src/App.jsx#L43)) |
| Permission gate read/write đúng | ✅ — `redirects.read` cho route, `redirects.write` cho `canUpdate` truyền cho screen |
| Read-only user (chỉ `redirects.read`) ẩn create/edit/delete | ✅ — `canUpdate ? actions : null` |
| Form đầy đủ field | ✅ — sourcePattern, targetUrl, redirectType, statusCode, enabled, notes, legacyId |
| Validate required FE-side | ✅ — chặn empty source/target |
| Confirm delete | ✅ — `showConfirm` |
| Loading / empty / error state | ✅ — `StatePanel` cho cả 3 |
| Search + filter `enabled`/`statusCode` | ✅ — debounce 250ms |
| Pagination | ✅ — `PaginationControls` |
| Mock fallback (dev) | ✅ — `withMockFallback` + warning banner |
| Responsive / a11y | ⚠️ — Form dùng `display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'` — chưa rõ behavior nhỏ hơn 600px. Không có `aria-label` cho icon-only buttons. |
| Business friendliness | ⚠️ — Hiển thị thuật ngữ "PERMANENT/TEMPORARY/CUSTOM", "Status: 301/302/307/308" không có hint cho non-technical user. Không có cảnh báo "301 = vĩnh viễn, ảnh hưởng SEO khó undo". Không có preview/test redirect. |
| Hit counter cột | ⚠️ Hiển thị `hitCount` nhưng giá trị luôn 0 (proxy không call recordHit) → cột này gây hiểu nhầm "redirect chưa ai click". |
| External-target warning | ❌ Không có cảnh báo nếu admin nhập `https://...` hoặc target ngoài domain. |
| Bulk import / export CSV | ❌ Không có. |

---

## 5. Admin API & Contract Audit

| Endpoint | Method | Path FE gọi | BE expect | Khớp? |
|---|---|---|---|---|
| List | GET | `/admin/redirects?page&size&q&enabled&statusCode` | `GET /api/v1/admin/redirects` với cùng query | ✅ |
| Get | GET | `/admin/redirects/{id}` | `GET /api/v1/admin/redirects/{id}` | ✅ |
| Create | POST | `/admin/redirects` body `{sourcePattern,targetUrl,redirectType,statusCode,enabled,notes,legacyId}` | `CreateRedirectRequest` (cùng field) | ✅ |
| Update | PATCH | `/admin/redirects/{id}` partial body | `UpdateRedirectRequest` partial | ✅ |
| Delete | DELETE | `/admin/redirects/{id}` | 204 No Content | ✅ |

| Hạng mục | Đánh giá |
|---|---|
| Boolean `enabled` vs `isEnabled` | ✅ BE accept cả 2 qua `@JsonAlias("isEnabled")`. FE chỉ gửi `enabled`. |
| Pagination parse | ✅ `parseListPayload` có fallback cho cả `payload.data.items` và `payload.items`. |
| Error handling | ⚠️ Mock fallback `withMockFallback` khi `shouldFallbackToMockOnLiveError()` có thể che lỗi production: business user thấy danh sách "có dữ liệu" nhưng thực ra là mock. Banner cảnh báo có nhưng dễ bị bỏ qua. |
| `FORCE_MOCK` block mutation | ✅ `assertMutationEnabled()` chặn POST/PATCH/DELETE khi FORCE_MOCK. |
| Query value `'ALL'` | ✅ `toQueryString` lọc trước khi serialize. |
| Pagination contract | ✅ FE `parseListPayload` đọc `payload.pagination` hoặc `payload.data` page object — khớp với `ApiResponseFactory.list()` của BE. |

---

## 6. Backend Service & Validation Audit

| Validation | Có / Cách | Ghi chú |
|---|---|---|
| `sourcePattern` required | ✅ `@NotBlank` + service `normalizeSourcePattern` | OK. |
| `targetUrl` required | ✅ `@NotBlank` + `normalizeRequiredUrl` | OK. |
| Auto-prepend `/` cho sourcePattern | ✅ | OK. |
| `statusCode` ∈ {301,302,307,308} | ✅ Service set + DB CHECK constraint | OK. |
| `redirectType` ∈ {PERMANENT,TEMPORARY,CUSTOM} | ✅ Service | OK. |
| Default redirectType theo statusCode | ✅ 301→PERMANENT, 302→TEMPORARY, 307→TEMPORARY, 308→PERMANENT | Hợp lý. |
| Default `enabled=true` | ✅ | OK. |
| Default `hitCount=0` | ✅ | OK. |
| `notes` trim/null | ✅ `trimToNull` | OK. |
| `legacyId` Long, optional | ✅ | OK. |
| Self-loop direct (source==target) | ✅ `validateNoSelfLoop` | OK, tested. |
| Duplicate sourcePattern | ⚠️ Service `ensureUniqueSourcePattern` — **không atomic vì DB không có UNIQUE** (xem HIGH #2). |
| Indirect loop / chain | ❌ Không detect. `/a → /b` và `/b → /a` được phép tạo cả 2. Browser sẽ infinite-redirect và lỗi `ERR_TOO_MANY_REDIRECTS`. |
| External target validation | ❌ Cho phép `https://evil.com/...` không kiểm soát. |
| Trailing slash / case normalize | ⚠️ `normalizeSourcePattern` chỉ prepend `/`, không strip trailing slash, không lowercase. Lookup là case-sensitive exact match. |
| Wildcard / regex | ❌ Tên `sourcePattern` gây hiểu nhầm — chỉ exact match. |
| `updatedAt`/`createdAt` set đúng | ✅ Service set explicit từ `Instant.now()` | OK. |
| Snapshot JSON cho audit | ⚠️ Build thủ công, escape thô. Không xử lý tốt unicode/control char trong notes. Nên dùng Jackson. |
| Race condition (cùng lúc 2 request tạo cùng source) | ⚠️ Có thể duplicate vì DB không UNIQUE → 2 row cùng `source_pattern`. Sau đó `findBySourcePattern` sẽ throw `IncorrectResultSizeDataAccessException`. |
| Transaction | ✅ `@Transactional` ở create/update/delete. Audit + revalidate trong cùng transaction. |
| `revalidate("redirects")` post-commit | ✅ `WebRevalidationService` dùng `TransactionSynchronization.afterCommit`. |

---

## 7. Database & Migration Audit

| Hạng mục | Đánh giá |
|---|---|
| Bảng `redirects` schema đầy đủ | ✅ ([V4__create_media_redirect_menu_tables.sql](../../bigbike-backend/src/main/resources/db/migration/V4__create_media_redirect_menu_tables.sql)) |
| `status_code` CHECK | ✅ `ck_redirects_status_code in (301,302,307,308)` |
| Default `enabled=true`, `hit_count=0`, `status_code=301` | ✅ |
| Index `source_pattern` | ✅ (non-unique). |
| Index `enabled`, `status_code`, `legacy_id` | ✅. |
| **UNIQUE trên `source_pattern`** | ❌ **THIẾU** — chỉ là index thường. Service tự check uniqueness → race condition. |
| **UNIQUE trên `legacy_id`** | ❌ Thiếu — `WordPressMigrationImportService` upsert by `source_pattern`, nhưng nếu re-run import từ FG redirect khác có cùng `targetPostId` (làm `legacyId`), không chặn ở DB. Cấp độ thấp hơn vì idempotent ở service. |
| Partial index cho `enabled=true` | ❌ Không có. `findByEnabled(true)` (bulk-active endpoint) sẽ scan full với điều kiện. Không quan trọng nếu bảng nhỏ (<1k entries) — chỉ matter khi >10k. |
| Timestamp timezone | ✅ `timestamp with time zone`. |
| UUID strategy | ✅ Entity `GenerationType.UUID`, schema `uuid primary key` — khớp. |
| FK ảnh hưởng khi delete redirect | ✅ Không có FK, delete an toàn. |
| `hit_count` increment atomic | ✅ JPQL `UPDATE ... SET r.hitCount = r.hitCount + 1 WHERE r.id = :id` + `@Transactional` (gọi qua `recordHit`). Tuy nhiên endpoint không được proxy gọi → tính năng dead. |
| `last_hit_at` update | ✅ Cùng query trên. |
| V58 idempotent | ✅ `ON CONFLICT (role_id, permission) DO NOTHING`. |
| Existing DB upgrade path | ✅ V58 chỉ INSERT, không ALTER → an toàn re-run. |

---

## 8. Web Runtime Redirect Audit (proxy.ts)

| Hạng mục | Đánh giá |
|---|---|
| Chạy trước route handler | ✅ Next.js 16 `proxy.ts` (renamed từ `middleware`). |
| Matcher loại trừ assets | ✅ `(?!api|_next/static|_next/image|favicon.ico|sitemap.xml|sitemap_index.xml|robots.txt|wp-content).*` |
| Backend lookup | ✅ `GET /api/internal/redirect?path=...` |
| Timeout | ✅ `AbortSignal.timeout(2_000)` 2 giây |
| Cache TTL | ✅ env `BIGBIKE_REDIRECT_CACHE_TTL_SECONDS` default 300s |
| L1 cache size cap | ✅ `L1_MAX = 10_000`, evict head khi đầy |
| Trailing slash fallback | ✅ Nếu path có trailing slash và lookup miss → thử bỏ trailing. ⚠️ KHÔNG handle ngược lại (`/old-url` không tìm thấy → thử `/old-url/`). |
| Direct loop detection | ✅ `isLoop()` so sánh `targetPath === currentPath`. Không xử lý `target` là full URL với khác query string nhưng cùng path. |
| Indirect loop / chain | ❌ Không detect. |
| Preserve query string | ❌ `new URL(rule.target, request.url)` không copy `request.nextUrl.searchParams` → query string bị drop. |
| Absolute URL target | ✅ `if (rule.target.startsWith("/")) ... else new URL(rule.target)` — accept tuyệt đối. |
| Open redirect rủi ro | ⚠️ Có. Nếu admin nhập target `https://evil.com`, proxy sẽ redirect 301. Không có host allowlist. |
| Hit counter call | ❌ KHÔNG gọi `/api/internal/redirects/hit/{id}`. Endpoint backend tồn tại nhưng dead. |
| Bulk active redirects | ❌ KHÔNG gọi `/api/internal/redirects/active`. Comment InternalRedirectController nói "consumed by Next.js middleware cache" — **mismatch comment vs implementation**. |
| Backend down fallback | ✅ Try/catch trả null → `NextResponse.next()` (không redirect). User sẽ thấy 404 thật. Hợp lý. |
| Cache invalidation từ admin | ❌ `revalidateTag("redirects")` trong /api/revalidate KHÔNG xóa L1 Map → stale tối đa 300s. Mỗi worker process có L1 riêng → không cách nào invalidate all. |
| Conflict /tai-khoan auth redirect | ✅ Auth gate chạy trước SEO redirect lookup, không xung đột. |
| Conflict /?s= search redirect | ✅ Search redirect chạy trước, exit sớm trước khi vào lookup. |
| SEO status code | ✅ `rule.statusCode || 301`. 301/302/307/308 được pass qua nguyên xi. |

---

## 9. WordPress / SEO Migration Audit

| Hạng mục | Đánh giá |
|---|---|
| FG redirect importer (WP plugin "FG Redirect") | ✅ [FgRedirectResolver.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/redirect/FgRedirectResolver.java), test cover tốt |
| RankMath redirect importer | ✅ [RankMathRedirectImporter.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/redirect/RankMathRedirectImporter.java) |
| Legacy URL fallback (slug-based) | ✅ [LegacyUrlMapper.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/redirect/LegacyUrlMapper.java) |
| Orchestrator (RankMath > FG > Legacy) | ⚠️ [RedirectResolverService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/redirect/RedirectResolverService.java) tồn tại nhưng KHÔNG có caller production — `WordPressMigrationImportService` đi đường tắt, gọi trực tiếp `FgRedirectResolver` + `RedirectImporter`. |
| Duplicate-detect chéo source | ✅ `LinkedHashMap.putIfAbsent` (chỉ trong RedirectResolverService, không dùng) |
| `legacyId` mapping | ✅ Set từ `targetPostId` của FG row hoặc từ `id` của RankMath row. |
| Validate target tồn tại (sản phẩm/danh mục thực sự sống) | ⚠️ Chỉ check khi resolve FG (lookup product by `wp-prod-{legacyId}`). Không check sản phẩm vẫn `PUBLISHED` tại thời điểm import. Không check cho RankMath (target có thể là URL bất kỳ). |
| Report deferred / skipped | ✅ `FgRedirectAnalyzer.AnalysisResult`, `RankMathRedirectImporter.ImportResult.blankSkipped/selfLoopSkipped` |
| SEO_REDIRECT_MAP.csv import | ❌ CSV ở [bigbike-web/docs/legacy/SEO_REDIRECT_MAP.csv](../../bigbike-web/docs/legacy/SEO_REDIRECT_MAP.csv) chỉ là tài liệu — chứa template `{slug}`, KHÔNG có importer (CLI hay admin) đọc trực tiếp. |
| Dry-run / write-plan | ✅ `MigrationExecutionOptions(dryRun=true)`. |
| Tài liệu cho business/SEO user | ⚠️ Hướng dẫn chỉ ở docstring code. Không có README cho phép SEO admin self-service import. |

---

## 10. Permission / RBAC Audit

| Layer | Cấu hình | Vấn đề |
|---|---|---|
| Permission catalog | `redirects.read`, `redirects.write` | OK ([AdminRolePermissions.java#L33,L67](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminRolePermissions.java#L33)) |
| Roles được seed | ADMIN + SEO_EDITOR + SUPER_ADMIN(`*`) ([V58](../../bigbike-backend/src/main/resources/db/migration/V58__add_redirect_permissions.sql), [V49](../../bigbike-backend/src/main/resources/db/migration/V49__create_roles_permissions_tables.sql)) | OK trong DB. |
| Admin sidebar gate | `redirects.read` | OK. |
| Admin route gate | `redirects.read` qua `routePermission` | OK. |
| Admin mutation gate | `redirects.write` truyền `canUpdate` | OK. |
| Backend controller gate | `requirePermission(redirects.read|write)` | OK ở controller-method level. |
| **Backend URL-level gate** | `SecurityConfig.java:109 .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")` | ❌ **SEO_EDITOR không vượt qua** — sẽ bị 403 trước khi đến controller. ADMIN OK. SUPER_ADMIN OK (`ROLE_SUPER_ADMIN` + `ROLE_ADMIN`). |
| Audit log | actor=ADMIN, action=REDIRECT_CREATED/UPDATED/DELETED, resource_type=REDIRECT, resource_id=UUID, beforeData/afterData JSON | OK theo doc API_CONTRACT.md:116. |
| Internal endpoint protection | `permitAll` | ⚠️ Đã được flag `NEEDS_VERIFICATION` ở [DOCS_VERIFICATION_REPORT.md:183](../DOCS_VERIFICATION_REPORT.md). Cần infra layer (nginx ACL / private VPC). |

---

## 11. Test Coverage Audit

### Hiện có

| Test | Coverage |
|---|---|
| [AdminRedirectApiTest.java](../../bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/AdminRedirectApiTest.java) | 3 test: full CRUD happy path; permission missing → 403; self-loop → 400. |
| [Phase2D4RedirectMappingTest.java](../../bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase2D4RedirectMappingTest.java) | 19 test: FG resolver normalization/resolution/deferred/self-loop, RankMath import + self-loop, LegacyUrlMapper product/brand/category, default 301, no duplicate, idempotency, dry-run, analyzer. |

### Thiếu

| Test thiếu | Mức độ | Lý do |
|---|---|---|
| `AdminRedirectApiTest`: missing `sourcePattern`/`targetUrl` | HIGH | `@NotBlank` chưa được test ở API layer. |
| `AdminRedirectApiTest`: invalid statusCode 999 | HIGH | Validation rejection chưa test. |
| `AdminRedirectApiTest`: invalid redirectType `WEIRD` | MEDIUM | Validation rejection chưa test. |
| `AdminRedirectApiTest`: tạo trùng `sourcePattern` → 409 | HIGH | Race khả thi vì DB không có UNIQUE — cần test cả happy path conflict. |
| `AdminRedirectApiTest`: chỉ `redirects.read`, attempt POST → 403 | HIGH | Read-only user mutate phải bị reject. |
| `AdminRedirectApiTest`: SEO_EDITOR endpoint test | HIGH | Hiện tại không test với real Spring Security filter chain. Cần `apply(SecurityMockMvcConfigurers.springSecurity())`. |
| Chain / indirect loop detection | MEDIUM | Hiện không có logic, nên test sẽ fail — cần khi feature implement. |
| External target reject hoặc warning | MEDIUM | Chưa có business rule. |
| Trailing slash normalization (BE side) | MEDIUM | Hiện chỉ ở proxy.ts. |
| Internal `GET /api/internal/redirect` happy path + 404 | HIGH | Kiểm tra integration với proxy.ts. |
| Internal `POST /redirects/hit/{id}` increment | MEDIUM | Không có test. |
| Internal `GET /redirects/active` shape | MEDIUM | Không có test. |
| Audit log content (JSON snapshot) | MEDIUM | Không assert beforeData/afterData. |
| Web `proxy.ts` redirect 301/302/307/308 | HIGH | **Không có test**, đây là path SEO-critical. |
| Web `proxy.ts` query string preservation | MEDIUM | Không có test. |
| Web `proxy.ts` cache TTL behavior | LOW | Không có test. |
| Web `proxy.ts` matcher exclude api/_next/etc | LOW | Không có test. |
| Admin FE `RedirectListScreen` component test | MEDIUM | Không có test. |
| Admin FE adminApi `buildRedirectQuery`/`normalizeRedirect` | LOW | Không có test riêng. |
| E2E (Playwright/Cypress) admin tạo redirect → user truy cập URL cũ | HIGH | **Không có**. |
| `RedirectResolverService.resolve(...)` orchestrator | MEDIUM | Implement nhưng không có user, cũng không có test. |

### Đánh giá tổng

- Backend test coverage: **trung bình** — controller path có test, nhưng chỉ qua `MockMvcBuilders.webAppContextSetup` không có `springSecurity()` → KHÔNG validate URL-level matcher. Giả lập permission qua header `X-Admin-Permissions`.
- Migration test coverage: **tốt** — Phase2D4 cover 19 trường hợp.
- Web proxy test coverage: **0** — đây là gap cao nhất.
- Admin FE test coverage: **0** — cũng gap.
- E2E coverage: **0**.

---

## 12. Business User Readiness

| Câu hỏi | Đánh giá |
|---|---|
| Ngôn ngữ UI có business-friendly | ⚠️ Dùng "PERMANENT/TEMPORARY/CUSTOM", "Status 301/302" — chưa có giải thích cho non-tech user. Đối lập với feedback memory `feedback_explain_style.md` (luôn dùng business language). |
| Hướng dẫn source/target | ⚠️ Chỉ có placeholder `/old-url`, `/new-url` và `notesPlaceholder` chung chung. Không có tooltip "Bắt đầu bằng `/`", "Không phải URL đầy đủ". |
| Cảnh báo 301 permanent | ❌ Không có. 301 được Google cache cứng, đảo ngược khó. |
| Preview / test redirect | ❌ Không có nút "Test redirect" để xem URL cũ resolve sang đâu. |
| Bulk import / export CSV | ❌ Không có. |
| 404 log / report | ❌ Không có module 404 nào ghi nhận URL cũ user truy cập mà chưa có redirect, để admin tự tạo. |
| Phân loại migrated / manual | ⚠️ Có `legacyId` nhưng UI chỉ hiển thị input number, không có filter "chỉ migrated" / "chỉ manual". |
| Ghi chú cho migration | ✅ Field `notes` có. |
| Rollback / disable an toàn | ✅ Toggle `enabled` cho phép disable không cần xóa. |
| Audit log trace ai sửa | ⚠️ Có audit log BE nhưng admin UI không hiển thị history per-redirect. |
| Self-service SEO migration | ❌ Phải DBA + CLI để chạy `WordPressMigrationImportRunner`. SEO admin không dùng được tooling Phase 2D. |

---

## 13. Issues Found

| # | Severity | File / Path | Vấn đề | Tác động | Cách fix | Code change | Test thêm |
|---|---|---|---|---|---|---|---|
| 1 | **BLOCKER** | [config/SecurityConfig.java:109](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java#L109) + [V58__add_redirect_permissions.sql](../../bigbike-backend/src/main/resources/db/migration/V58__add_redirect_permissions.sql) + [AdminRolePermissions.java:65-68](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminRolePermissions.java#L65) | RBAC mismatch: `SEO_EDITOR` được seed `redirects.read/write` nhưng URL matcher `/api/v1/admin/**` chỉ cho `ROLE_ADMIN` → SEO_EDITOR luôn 403. Mâu thuẫn với [PERMISSION_MATRIX.md:17](../engineering/PERMISSION_MATRIX.md), [BUSINESS_RULES.md](../business/BUSINESS_RULES.md), [V49 seed comment](../../bigbike-backend/src/main/resources/db/migration/V49__create_roles_permissions_tables.sql). | Tài khoản SEO không thật sự dùng được module dù docs/permission đã seed. | Thêm matcher trước catch-all: `.requestMatchers("/api/v1/admin/redirects/**").hasAnyRole("ADMIN","SUPER_ADMIN","SEO_EDITOR")`. | Có | `AdminRedirectApiTest.shouldAllowSeoEditor` với `apply(springSecurity())`. |
| 2 | **BLOCKER** | [V4__create_media_redirect_menu_tables.sql:43](../../bigbike-backend/src/main/resources/db/migration/V4__create_media_redirect_menu_tables.sql#L43) | `idx_redirects_source_pattern` là index thường, không UNIQUE. `AdminRedirectService.ensureUniqueSourcePattern` check ở service layer race-prone — 2 admin tạo trùng cùng lúc → 2 row. Sau đó `findBySourcePattern` throw `IncorrectResultSizeDataAccessException`. | Data corruption + 500 errors. | Migration mới `V79__add_unique_redirect_source_pattern.sql`: `DELETE` duplicates rồi `CREATE UNIQUE INDEX uq_redirects_source_pattern ON redirects(source_pattern)`. Service catch `DataIntegrityViolationException` → ConflictException. | Có | Test concurrent insert (Spring `@RepeatedTest` hoặc 2-thread CountDownLatch). |
| 3 | **HIGH** | [proxy.ts](../../bigbike-web/proxy.ts) + [WebRevalidationService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/web/WebRevalidationService.java) + [api/revalidate/route.ts](../../bigbike-web/app/api/revalidate/route.ts) | Cache invalidation broken: `revalidateTag("redirects")` chỉ áp dụng Next fetch/ISR cache, KHÔNG xóa `l1Cache: Map<string, L1Entry>` trong proxy.ts (per-process). Sau khi admin sửa, redirect mới mất tới `BIGBIKE_REDIRECT_CACHE_TTL_SECONDS=300s` để propagate, và mỗi worker có L1 riêng. | Admin tạo redirect xong, gõ URL test trong 5 phút đầu vẫn không thấy redirect → user nghĩ "lỗi" → tạo lại → race condition (#2). | (a) Giảm TTL xuống 30s; HOẶC (b) Đổi proxy lookup dùng fetch + `next: { revalidate: 60, tags: ["redirects"] }` để tận dụng `revalidateTag`; HOẶC (c) Expose `POST /api/internal/proxy-cache/clear` (private) gọi từ revalidate route. Lựa chọn (b) hợp Next 16 nhất. | Có | Test cache invalidation: tạo redirect → gọi `/api/revalidate` → trong < 5s, lookup mới reflect. |
| 4 | **HIGH** | [InternalRedirectController.java:57-77](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/internal/InternalRedirectController.java#L57) + [proxy.ts:47-63](../../bigbike-web/proxy.ts#L47) | Dead integration: `recordHit` và `redirects/active` được implement, có comment "consumed by Next.js middleware", nhưng proxy.ts KHÔNG gọi. Cột `Hits` trong admin UI luôn 0 / null, gây hiểu nhầm. | UX confusion + tính năng mất. Decision-by-numbers (xóa redirect cũ không ai click) không làm được. | Hoặc (a) xóa endpoint + cột UI; HOẶC (b) wire vào proxy.ts: sau khi `NextResponse.redirect(...)` gọi `fetch('/api/internal/redirects/hit/'+id, { method:'POST', keepalive:true })` fire-and-forget. Lựa chọn (b) đúng yêu cầu SEO/marketing. | Có | Test proxy fire hit + DB hit_count tăng. |
| 5 | **HIGH** | [SecurityConfig.java:93-97](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java#L93) | `/api/internal/redirect*` `permitAll`. Đã được flag `NEEDS_VERIFICATION` trong [DOCS_VERIFICATION_REPORT.md:183](../DOCS_VERIFICATION_REPORT.md). Nếu deploy mà không có ACL nginx/firewall, public attacker có thể: enumerate toàn bộ redirect rule (intel về site map cũ), spam `redirects/hit/{uuid}` để inflate hit_count (data poisoning). | Information disclosure + audit corruption. | Thêm shared-secret header check trong InternalRedirectController, hoặc CIDR allowlist filter. Tối thiểu: revoke `permitAll` cho `redirects/hit/**` và yêu cầu shared secret env var. | Có | Test 401 khi thiếu secret. |
| 6 | **HIGH** | [AdminRedirectService.java:283-291](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminRedirectService.java#L283) | Open redirect risk: `targetUrl` chấp nhận `https://evil.com` không kiểm soát. Self-loop check không đủ. | Phishing — admin compromise hoặc social-engineering tạo redirect từ URL cũ trong domain bigbike sang external phishing site. | Validate target: nếu bắt đầu `http(s)://`, host phải nằm trong allowlist (`bigbike.vn`, `*.bigbike.vn`). Nếu không trong allowlist, bắt buộc xác nhận thêm hoặc warn ở UI. | Có | Test reject `https://evil.com`. |
| 7 | **HIGH** | `AdminRedirectApiTest.java` setup | `MockMvcBuilders.webAppContextSetup(...)` không apply `springSecurity()` → URL matcher (`hasRole("ADMIN")`) KHÔNG được test. Mọi test hiện tại đều bypass Spring Security filter chain. | Test fail giả: không phát hiện được issue #1 (SEO_EDITOR mismatch) ở CI. | Đổi setup: `.apply(SecurityMockMvcConfigurers.springSecurity())` + dùng `.with(jwt().authorities(...))` cho từng test. | Có | Re-run AdminRedirectApiTest sẽ phát hiện SEO_EDITOR test fail trước khi fix #1. |
| 8 | **HIGH** | (proxy + admin) | Không có E2E test "admin tạo redirect → user truy cập URL cũ → 301 đúng location". | Không có release gate cho regression. | Thêm Playwright spec hoặc backend integration test gọi cả `AdminRedirectController` và `InternalRedirectController` trong cùng MockMvc. | Có | E2E test. |
| 9 | **MEDIUM** | [proxy.ts:131-135](../../bigbike-web/proxy.ts#L131) | Query string không được preserve. `/old?utm=fb` redirect tới `/new` (drop utm). | Mất tracking marketing/analytics. | `const destination = new URL(rule.target.startsWith("/") ? rule.target : new URL(rule.target).pathname, request.url); for (const [k,v] of request.nextUrl.searchParams) destination.searchParams.append(k,v);` — hoặc per-rule flag. | Có | Test query preserve. |
| 10 | **MEDIUM** | [AdminRedirectService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminRedirectService.java) | Indirect loop / chain không detect. `/a→/b` + `/b→/a` cho phép tạo cả 2. | User vào `/a` infinite redirect, browser error. SEO crawler bỏ qua. | Trong `validateNoSelfLoop`, BFS/DFS tới depth N từ target, nếu thấy current source → reject. | Có | Test chain reject. |
| 11 | **MEDIUM** | Field naming `sourcePattern` | UI placeholder + tên `pattern` gợi ý wildcard, thực tế chỉ exact match. | Admin tạo `/old/*` mong wildcard, không hoạt động. | Đổi tên thành `sourcePath` ở UI, hoặc thực sự implement glob/regex. Nếu implement: lookup phải dùng prefix tree/regex match thay vì `findBySourcePattern` exact. | Có | (Nếu impl) test glob match. |
| 12 | **MEDIUM** | [adminApi.js:776,780](../../bigbike-admin/src/lib/adminApi.js#L776) | Mock fallback ở production. Khi backend down, FE âm thầm trả mock data với banner cảnh báo dễ bị bỏ qua. | Admin nghĩ data đã có/đã save trong khi DB không sync. | Trong production build (`import.meta.env.PROD`), `shouldFallbackToMockOnLiveError()` phải trả false trừ khi explicit env. | Có | Test prod build chặn mock fallback. |
| 13 | **MEDIUM** | [RedirectListScreen.jsx:210-213](../../bigbike-admin/src/screens/RedirectListScreen.jsx#L210) | Hiển thị cột "Hits" (hitCount) luôn = 0 vì proxy không gọi recordHit. | UX hiểu nhầm "không ai dùng redirect này". | Sau khi fix #4, cột này có data. Trước đó: ẩn cột hoặc đổi label "Will track after deployment". | Có | UI test. |
| 14 | **MEDIUM** | (admin UI) | Không có bulk import CSV / export. SEO migration phụ thuộc CLI runner. | Phụ thuộc dev/DBA cho mọi đợt migration mới. | Thêm endpoint `POST /api/v1/admin/redirects/import` accept CSV, parse + dry-run preview + commit. | Có | Test happy path + reject duplicate. |
| 15 | **MEDIUM** | [RedirectResolverService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/redirect/RedirectResolverService.java) | Implement đầy đủ orchestrator (RankMath > FG > Legacy) nhưng không có caller nào trong production code path. | Dead code, hoặc setup nửa chừng cho phase sau (intent không rõ). | Hoặc wire vào `WordPressMigrationImportService` thay cho path tắt hiện tại; HOẶC xóa và gắn TODO. Nếu giữ thì viết test orchestrator. | Có | Test orchestrator. |
| 16 | **MEDIUM** | [AdminRedirectService.java:301-316](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminRedirectService.java#L301) | Audit snapshot dùng manual JSON concat + `escape()` thô (`\\` `\"` only). Notes Unicode/control char có thể tạo JSON invalid. | Audit log corrupt → khó truy hồi. | Dùng `ObjectMapper.writeValueAsString(Map.of(...))`. | Có | Test snapshot với notes chứa newline + emoji. |
| 17 | **MEDIUM** | Không có 404 log surface trong admin | Không có module nào capture URL 404 user thử mà chưa có redirect. | SEO admin không thấy "URL cũ nào còn người vào nhưng chưa có redirect". | Thêm Sentry breadcrumb hoặc lightweight `not_found_log` table; admin UI panel "Top 404s last 7 days". | Có | Out of MVP scope. |
| 18 | **MEDIUM** | (admin UI) | Không có preview/test redirect. | Admin sửa xong không kiểm tra được runtime kết quả. | Nút "Test" mở `/api/internal/redirect?path=...` xem JSON. | Có | UI test. |
| 19 | **LOW** | (admin UI) | Hiển thị technical "PERMANENT/TEMPORARY/CUSTOM" + "301/302/307/308" không kèm giải thích. | Memory feedback `feedback_explain_style.md` ưu tiên ngôn ngữ business. | Tooltip + label tiếng Việt: "Vĩnh viễn (301)", "Tạm thời (302)". | Có | UI snapshot. |
| 20 | **LOW** | proxy.ts trailing slash | Chỉ thử bỏ trailing, không thử thêm trailing. | Admin tạo `/old-url/`, user gõ `/old-url` → miss. | Thêm reverse fallback. | Có | Test cả 2 chiều. |
| 21 | **LOW** | (web) Không có proxy.ts test | SEO-critical path không có test. | Regression khả thi. | Vitest + msw: mock `/api/internal/redirect` + assert NextResponse Location. | Có | Test redirect flow. |
| 22 | **LOW** | (admin) `RedirectListScreen` không có component test | Form/validation chỉ test thủ công. | UI regression. | Vitest + Testing Library: form valid/invalid, permission gate. | Có | Component test. |
| 23 | **LOW** | [InternalRedirectController.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/internal/InternalRedirectController.java) | Không có rate limit. | Spam attack tăng tải DB (sau khi #5 fix shared secret thì ít rủi ro hơn). | Bucket4j filter cho /api/internal. | Optional | — |
| 24 | **LOW** | (build hygiene, repo-wide) | `bigbike-backend/target/` (compiled .class + migration copy) committed vào git. | Lịch sử git lớn, conflict, đôi khi rebuild trễ. | Thêm `target/` vào `.gitignore`, `git rm -r --cached`. | Có | — |

---

## 14. Required Fix Plan

### 14.1 Must fix before production (Blockers / Highs)

1. **#1 — RBAC mismatch SEO_EDITOR** — thêm matcher hoặc đổi tài liệu. Khoảng cách hiện tại: docs nói được dùng, code không cho. Dù chọn hướng nào, phải đồng bộ docs + code + permission seed + test.
2. **#2 — Unique constraint DB cho `source_pattern`** — migration mới + ConflictException catch. Race vô hiệu.
3. **#3 — Cache invalidation BE → proxy** — chuyển proxy.ts sang fetch + `next: { tags }` để revalidateTag hoạt động, hoặc thêm endpoint xóa L1.
4. **#4 — Wire recordHit vào proxy.ts** hoặc xóa endpoint + cột UI. Quyết định business: có cần hit counter không?
5. **#5 — Internal endpoint protection** — shared secret hoặc CIDR allowlist. Là điều kiện bắt buộc khi public deploy.
6. **#6 — Open redirect target validation** — host allowlist.
7. **#7 — Test setup chuẩn** — `apply(springSecurity())` + JWT mock. Sửa setup là tiền đề để các fix khác có CI gate.
8. **#8 — E2E test admin → proxy → user** — release gate.

### 14.2 Should fix soon (Mediums)

9. **#9 — Query string preserve** trong proxy.
10. **#10 — Chain / indirect loop detection**.
11. **#12 — Mock fallback off ở production build**.
12. **#13 — Hits column hide hoặc post-fix label**.
13. **#14 — Bulk import CSV** cho self-service SEO.
14. **#15 — RedirectResolverService**: wire hoặc xóa.
15. **#16 — Audit snapshot dùng Jackson**.
16. **#18 — Preview/test redirect** UI.

### 14.3 Nice to have (Lows)

17. **#11 — Đổi tên `sourcePattern` → `sourcePath`** hoặc thực sự implement glob.
18. **#17 — 404 log + admin panel top-404s**.
19. **#19 — Business-friendly labels** (memory feedback).
20. **#20 — Trailing slash reverse fallback**.
21. **#21 — proxy.ts vitest**.
22. **#22 — RedirectListScreen component test**.
23. **#23 — Rate limit /api/internal**.
24. **#24 — `target/` cleanup** (repo-wide).

---

## 15. Recommended Test Plan

### 15.1 Backend integration

```java
// AdminRedirectApiTest (sau khi fix #7)
shouldRequireAdminRoleOrSeoEditor
shouldRejectMissingSourcePattern → 400 VALIDATION_ERROR field=sourcePattern code=REQUIRED
shouldRejectMissingTargetUrl     → 400
shouldRejectInvalidStatusCode    → 400
shouldRejectInvalidRedirectType  → 400
shouldRejectDuplicateSource_concurrent → 409 (sau #2)
shouldRejectExternalTarget       → 400 (sau #6)
shouldRejectChain_a_b_a          → 400 (sau #10)
shouldNotAllowReadOnlyUserToCreate → 403
shouldAllowSeoEditor             → 200 (sau #1)
shouldUpdateOnlyChangedFields    → patch test
shouldEmitAuditLogOnCreate       → assert audit row
shouldEmitAuditLogOnUpdate       → assert before/after diff
shouldEmitAuditLogOnDelete       → assert before snapshot
```

### 15.2 Internal API

```java
shouldReturn404ForUnknownPath
shouldReturnEnabledRedirectOnly
shouldRejectWithoutSecret        → 401 (sau #5)
shouldIncrementHitCountAtomically (concurrent)
shouldReturnAllActiveInBulkEndpoint
```

### 15.3 Web proxy (vitest + msw)

```ts
proxy.ts
- redirect 301 cho exact match
- redirect 302/307/308 đúng status code
- không redirect khi backend trả 404
- không redirect khi backend timeout/down → next()
- không redirect cho /api, /_next/static, /_next/image, /favicon.ico, /robots.txt, /wp-content, /sitemap.xml
- preserve query string (sau #9)
- không redirect khi target == source (loop)
- trailing slash fallback cả 2 chiều (sau #20)
- L1 cache hit không gọi backend lần 2
- L1 cache TTL expire trigger refetch
- Auth gate /tai-khoan/* không xung đột
- Search redirect /?s= ưu tiên hơn lookup
- Hit counter fire (sau #4)
```

### 15.4 Admin UI (vitest + RTL)

```tsx
RedirectListScreen
- render disabled action buttons khi !canUpdate
- form validate required source/target trước khi gọi API
- delete confirm flow
- pagination + filter behavior
- mock warning banner hiển thị đúng khi data.mode=mock
```

### 15.5 E2E (Playwright)

```ts
e2e/redirect.spec.ts
test('admin creates redirect, user gets 301', async ({ page, request }) => {
  // login admin
  // POST /admin/redirects /old → /new
  // wait for revalidation (≤5s sau #3)
  // GET /old → expect 301 + Location /new
});
```

---

## 16. Final Verdict

| Module | Score |
|---|---|
| Admin UI completeness | **70** /100 — CRUD đủ; thiếu preview, bulk import, business-friendly labels, hits cột gây hiểu nhầm. |
| Backend API completeness | **75** /100 — endpoint đầy đủ, validation cơ bản tốt; thiếu chain detect + open-redirect guard; audit JSON manual. |
| DB / schema readiness | **55** /100 — schema OK, **thiếu UNIQUE source_pattern** là điểm trừ lớn. |
| Permission / RBAC | **45** /100 — permission seeded nhưng SEO_EDITOR bị URL matcher chặn (mismatch nghiêm trọng). |
| Runtime web redirect integration | **55** /100 — chạy được với exact match cơ bản; cache invalidation vỡ, hit counter dead, query string drop. |
| SEO migration readiness | **65** /100 — Phase 2D tooling tốt cho FG + RankMath; thiếu admin self-service + CSV importer; SEO_REDIRECT_MAP.csv chỉ là tài liệu. |
| Validation / security | **50** /100 — cơ bản OK; mở rộng cần chống open redirect, chain, internal endpoint hardening. |
| Test coverage | **45** /100 — backend trung bình (nhưng MockMvc setup bypass security), proxy.ts/admin UI = 0. |
| Business usability | **55** /100 — đủ cho dev/SEO admin có hiểu biết; chưa friendly cho non-tech. |
| **Overall production readiness** | **62 /100** |

### Kết luận

- **Module Redirect đã hoàn thiện chưa?** Chưa. Có 4 issue BLOCKER/HIGH chặn deploy production an toàn (#1 RBAC mismatch, #2 unique constraint, #3 cache invalidation, #5 internal endpoint hardening) và 4 issue HIGH (#4 dead hit counter, #6 open-redirect, #7 test setup, #8 E2E gap) cần xử lý trước khi tin tưởng.
- **Có đủ cho production chưa?** Chỉ đủ cho ADMIN role tạo manual redirect với volume thấp (<100 entries) và chấp nhận stale cache 5 phút. Không đủ cho SEO migration full hoặc multi-user editing.
- **Có đủ cho business/SEO admin dùng chưa?** Chưa. Phải dev/DBA chạy CLI cho SEO migration; SEO_EDITOR role không vào được module dù docs nói có.
- **Có nên giữ trong admin không?** Có. Architecture đúng, logic core ổn, fix 8 issue HIGH+ là production-ready cho phase 1.
- **Cần fix gì trước production?** 8 mục Must-fix tại §14.1.
- **Phần nào để phase sau?** Bulk import CSV, preview redirect, 404 log, glob/regex pattern, cảnh báo 301 permanent, business-friendly labels (Memory `feedback_explain_style.md`).

> **Khuyến nghị**: gắn label `production-blocker` cho 8 issue ở §14.1, bundle thành 1 PR series (security/DB → proxy → tests). Không deploy redirect module live cho khách hàng cuối / SEO migration thật trước khi đóng được toàn bộ §14.1.
