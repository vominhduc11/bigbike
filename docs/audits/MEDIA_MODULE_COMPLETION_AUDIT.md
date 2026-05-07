HISTORICAL_REPORT_ONLY - Not canonical. Validate against current code and canonical docs.

# Media Module Completion Audit

- Audit date: 2026-05-06
- Repo branch / commit: `main` @ `f6df500`
- Auditor: Senior Software Architect + QA Lead (read-only audit, no code changes)
- Scope: BigBike Media module — Backend (Spring Boot), Admin Frontend (React/Vite), DB migrations, MinIO storage, WordPress migration, docs

---

## 1. Executive Summary

- **Overall status: PARTIAL — NOT production-ready as-is.**
- **Production readiness score: 56 / 100.**
- **Biggest blockers (P0):**
  1. **SVG XSS** — `image/svg+xml` is in MIME allowlist nhưng KHÔNG sanitize; cho phép upload SVG chứa `<script>` rồi serve qua `/media/...` cùng origin với admin SPA và `bigbike-web` (`AdminMediaService.java:46`, không có sanitizer).
  2. **MIME spoofing** — backend chỉ trust `MultipartFile.getContentType()` (client-supplied), không có magic-byte/Apache Tika check (`AdminMediaService.java:79-84`).
  3. **Hard delete tạo orphan + dangling references** — `hardDeleteMedia` xoá DB row trước cả khi confirm MinIO removeObject thành công, và KHÔNG check media có đang được product/article/slider tham chiếu hay không (`AdminMediaService.java:243-261`). Hậu quả: ảnh sản phẩm 404 sau hard delete.
  4. **No production auth path implemented** — `DevAdminAuthService.ensureDevMockProfile()` ném `AuthNotImplementedException` khi profile = `prod`, nhưng `requirePermission` lại đọc header `X-Admin-Permissions` ở mọi profile non-prod. Tức nếu deploy với `SPRING_PROFILES_ACTIVE=dev|mock|local|test` (như `application.properties` mặc định mock), bất kỳ ai có thể tự gán quyền qua header (`DevAdminAuthService.java:79-86`, `93-110`).
  5. **No reverse-reference safety** — soft delete đặt `status=DELETED`; FE list mặc định ẩn DELETED nhưng các bảng `products.image_url`, `product_gallery_images.image_url`, `product_variants.image_url`, slider/home-video, content article/page vẫn giữ URL → ảnh vẫn render nếu URL còn live (đến khi hard delete) hoặc 404 sau hard delete.
- **Recommended release decision: HOLD.** Không release cho production cho tới khi P0 fix xong + bổ sung test coverage cho upload/permission/delete flow.

---

## 2. Scope Audited

### Backend
- [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminMediaController.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminMediaController.java)
- [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java)
- [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/media/MediaEntity.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/media/MediaEntity.java)
- [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/media/MediaJpaRepository.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/media/MediaJpaRepository.java)
- [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/media/MediaSpecifications.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/media/MediaSpecifications.java)
- DTOs: [AdminMediaDetailResponse.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/media/AdminMediaDetailResponse.java), [AdminMediaListItemResponse.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/media/AdminMediaListItemResponse.java), [UpdateMediaRequest.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/media/UpdateMediaRequest.java)
- MinIO: [MinioConfig.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/MinioConfig.java), [MinioProperties.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/MinioProperties.java), [MediaUrlProperties.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/MediaUrlProperties.java)
- WordPress migration: [MediaCopyRunner.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/media/MediaCopyRunner.java), [MediaCopyService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/media/MediaCopyService.java), [MinioMediaStorageAdapter.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/media/MinioMediaStorageAdapter.java), [MediaStoragePort.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/media/MediaStoragePort.java), [MediaPathResolver.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/media/MediaPathResolver.java), [MediaChecksumService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/media/MediaChecksumService.java), [MediaCopyOptions.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/media/MediaCopyOptions.java), [MediaCopyReport.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/media/MediaCopyReport.java)
- Auth/Security: [DevAdminAuthService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/DevAdminAuthService.java), [SecurityConfig.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java), [RateLimitingFilter.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/RateLimitingFilter.java)

### Admin Frontend
- [bigbike-admin/src/screens/MediaLibraryScreen.jsx](../../bigbike-admin/src/screens/MediaLibraryScreen.jsx)
- [bigbike-admin/src/components/MediaDetailModal.jsx](../../bigbike-admin/src/components/MediaDetailModal.jsx)
- [bigbike-admin/src/components/MediaPickerModal.jsx](../../bigbike-admin/src/components/MediaPickerModal.jsx)
- [bigbike-admin/src/components/VideoPickerModal.jsx](../../bigbike-admin/src/components/VideoPickerModal.jsx)
- [bigbike-admin/src/components/AudioPickerModal.jsx](../../bigbike-admin/src/components/AudioPickerModal.jsx)
- [bigbike-admin/src/lib/adminApi.js](../../bigbike-admin/src/lib/adminApi.js) (functions `fetchMedia`, `uploadMedia`, `deleteMedia`, `hardDeleteMedia`, `restoreMedia`, `updateMedia`)
- [bigbike-admin/src/lib/contracts.js](../../bigbike-admin/src/lib/contracts.js) (`normalizeMediaItem`)
- [bigbike-admin/src/App.jsx](../../bigbike-admin/src/App.jsx) (route + permission gate)
- [bigbike-admin/vite.config.js](../../bigbike-admin/vite.config.js)
- [bigbike-admin/nginx.conf](../../bigbike-admin/nginx.conf)

### DB / Migration
- [V4__create_media_redirect_menu_tables.sql](../../bigbike-backend/src/main/resources/db/migration/V4__create_media_redirect_menu_tables.sql)
- [V16__sync_media_urls_from_media_table.sql](../../bigbike-backend/src/main/resources/db/migration/V16__sync_media_urls_from_media_table.sql)
- [V25__sync_gallery_image_urls_from_media.sql](../../bigbike-backend/src/main/resources/db/migration/V25__sync_gallery_image_urls_from_media.sql) (file enumerated, not deeply read)
- [V37__normalize_media_public_url_and_provider.sql](../../bigbike-backend/src/main/resources/db/migration/V37__normalize_media_public_url_and_provider.sql)
- [V38__fix_media_public_url_wp_uploads_prefix.sql](../../bigbike-backend/src/main/resources/db/migration/V38__fix_media_public_url_wp_uploads_prefix.sql)

### Tests
- [bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1IAdminManagementApiTest.java](../../bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1IAdminManagementApiTest.java) (media tests #9–15)
- [bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase2EMediaCopyTest.java](../../bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase2EMediaCopyTest.java) (migration unit tests)
- [bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1JAdminSettingsMenuCouponApiTest.java](../../bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1JAdminSettingsMenuCouponApiTest.java) (smoke `adminMedia_stillWorks`)
- [bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1KOpenApiContractTest.java](../../bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1KOpenApiContractTest.java) (OpenAPI contains `/api/v1/admin/media`)

### Docs
- [docs/engineering/API_CONTRACT.md](../engineering/API_CONTRACT.md)
- [docs/engineering/PERMISSION_MATRIX.md](../engineering/PERMISSION_MATRIX.md)
- [docs/engineering/DATA_CONTRACT.md](../engineering/DATA_CONTRACT.md)
- [docs/engineering/DEPLOYMENT_GUIDE.md](../engineering/DEPLOYMENT_GUIDE.md)
- [docs/engineering/INTEGRATION_GUIDE.md](../engineering/INTEGRATION_GUIDE.md)
- [docs/business/BUSINESS_RULES.md](../business/BUSINESS_RULES.md) (`MEDIA_RULE_001..003`)
- [docs/business/MODULE_CATALOG.md](../business/MODULE_CATALOG.md)

---

## 3. Route & Screen Audit

| Item | Status | Evidence | Notes |
|---|---|---|---|
| Route `/admin/media` registered | PASS | [App.jsx:86](../../bigbike-admin/src/App.jsx) | Nav item gated by `media.read` |
| URL → screen mapping | PASS | [App.jsx:153](../../bigbike-admin/src/App.jsx) | `module === 'media'` → `media-library` |
| Screen permission gate (read) | PASS | [App.jsx:191](../../bigbike-admin/src/App.jsx) | `media-library` requires `media.read` |
| Mutation gate (`canUpdate` from `media.write`) | PASS | [App.jsx:361](../../bigbike-admin/src/App.jsx) | `<MediaLibraryScreen canUpdate={hasPermission('media.write')} />` |
| Loading state | PASS | [MediaLibraryScreen.jsx:225](../../bigbike-admin/src/screens/MediaLibraryScreen.jsx) | StatePanel tone="info" |
| Error state | PASS | [MediaLibraryScreen.jsx:226](../../bigbike-admin/src/screens/MediaLibraryScreen.jsx) | retry action |
| Empty state | PASS | [MediaLibraryScreen.jsx:227-229](../../bigbike-admin/src/screens/MediaLibraryScreen.jsx) | reset filters action |
| Uploading state | PASS | [MediaLibraryScreen.jsx:151-158](../../bigbike-admin/src/screens/MediaLibraryScreen.jsx) | progress % shown |
| Deleting state | PASS | [MediaLibraryScreen.jsx:262-268](../../bigbike-admin/src/screens/MediaLibraryScreen.jsx) | per-row `deleting` flag |
| Validation error (FE pre-upload) | PASS | [MediaLibraryScreen.jsx:81-90](../../bigbike-admin/src/screens/MediaLibraryScreen.jsx) | MIME + size client-side |
| Read-only state when no `media.write` | PASS | [MediaLibraryScreen.jsx:141, 259](../../bigbike-admin/src/screens/MediaLibraryScreen.jsx) | upload/edit/delete buttons hidden |
| Filter (mimeType, status, provider) | PASS | [MediaLibraryScreen.jsx:179-223](../../bigbike-admin/src/screens/MediaLibraryScreen.jsx) | Backend `q`, `mimeType`, `status`, `storageProvider` |
| Search debounced | PASS | [MediaLibraryScreen.jsx:42-52](../../bigbike-admin/src/screens/MediaLibraryScreen.jsx) | 250 ms debounce |
| Pagination control | PASS | [MediaLibraryScreen.jsx:275](../../bigbike-admin/src/screens/MediaLibraryScreen.jsx) | `PaginationControls` |
| Detail modal save/cancel/error | PASS | [MediaDetailModal.jsx](../../bigbike-admin/src/components/MediaDetailModal.jsx) | `updateMedia` with try/catch + saving flag |
| MediaPickerModal (image, multi-select, drag-drop) | PASS | [MediaPickerModal.jsx](../../bigbike-admin/src/components/MediaPickerModal.jsx) | filter `mimeType: 'image/'`, multi-select, DnD |
| VideoPickerModal | PASS | [VideoPickerModal.jsx](../../bigbike-admin/src/components/VideoPickerModal.jsx) | only `video/mp4`, single-select |
| AudioPickerModal | PASS | [AudioPickerModal.jsx](../../bigbike-admin/src/components/AudioPickerModal.jsx) | mp3/ogg/wav/webm/aac, single-select |
| FE→BE param mapping (`pageSize`→`size`, `search`→`q`) | PASS | [adminApi.js:936-943](../../bigbike-admin/src/lib/adminApi.js) | mapped explicitly |
| Hard-delete & restore in UI | **MISSING** | [MediaLibraryScreen.jsx:62-75](../../bigbike-admin/src/screens/MediaLibraryScreen.jsx) | `hardDeleteMedia` & `restoreMedia` exist trong adminApi.js nhưng **không có UI button**. User không thể restore media bị soft-deleted, không thể hard delete |
| Status filter "INACTIVE" option | **MISSING** | [MediaLibraryScreen.jsx:200-203](../../bigbike-admin/src/screens/MediaLibraryScreen.jsx) | UI chỉ cho ALL/ACTIVE/DELETED. Backend whitelist `INACTIVE` (`AdminMediaService.java:44`) nhưng FE không expose |
| Filter provider "LOCAL" / future providers | PARTIAL | [MediaLibraryScreen.jsx:208-212](../../bigbike-admin/src/screens/MediaLibraryScreen.jsx) | UI chỉ MINIO/LEGACY_WP. Test file dùng `LOCAL` → invisible nếu user filter |
| Edit modal validation (length) | **MISSING** | [MediaDetailModal.jsx:75-89](../../bigbike-admin/src/components/MediaDetailModal.jsx) | Không có maxLength, không có validation |
| Bulk select / bulk delete | **MISSING** | n/a | Không có bulk action |
| `/media/...` accessible từ Vite dev | **BROKEN (dev only)** | [vite.config.js:14-26](../../bigbike-admin/vite.config.js) | Chỉ proxy `/api` & `/media-proxy`. New uploads (`publicUrl=/media/uploads/...`) sẽ resolve sai trong dev — vite trả `index.html` qua SPA fallback |

---

## 4. Feature Completion Matrix

| # | Feature | Status | Evidence | Risk | Fix |
|---|---|---|---|---|---|
| 1 | Upload image (jpeg/png/webp/gif/svg) | PARTIAL | `AdminMediaService.uploadMedia` ([:78-145](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java)) | SVG XSS, MIME spoofing, no rate limit | Sanitize SVG, magic-byte verify, rate-limit |
| 2 | Upload video (mp4) | COMPLETE | same | 50 MB limit phù hợp ngắn promo, không đủ nếu cần video dài | Tăng limit hoặc multipart resumable |
| 3 | Upload audio (mp3/ogg/wav/webm/aac) | COMPLETE | same | — | — |
| 4 | List media | COMPLETE | `AdminMediaService.listMedia` ([:149-185](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java)) | Sort by `createdAt desc` không có index → full scan + sort khi scale | Add index |
| 5 | Search by title/filePath/altText | COMPLETE | `MediaSpecifications.matchesSearch` | Không escape `%`/`_` → user input có wildcard ngoài ý | Escape LIKE wildcards |
| 6 | Filter by MIME type prefix | COMPLETE | `MediaSpecifications.withMimeTypePrefix` | Không validate prefix; user có thể truyền chuỗi tuỳ ý | Whitelist prefix list |
| 7 | Filter by status | COMPLETE | `MediaSpecifications.withStatus` | Không validate input enum | Validate against allowlist |
| 8 | Filter by storage provider | COMPLETE | `MediaSpecifications.withStorageProvider` | Không validate | Validate enum |
| 9 | View detail | COMPLETE | `getMediaDetail` ([:189-193](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java)) | Không kiểm soft-delete khi view detail (DELETED vẫn show trong detail nếu biết ID) | Decide policy |
| 10 | Update altText/title/caption/status | COMPLETE | `updateMedia` ([:198-222](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java)) | Không có max length validation | Add `@Size` |
| 11 | Soft delete | COMPLETE | `deleteMedia` ([:227-238](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java)) | Không check reverse references → product image vẫn render đến lúc hard delete | Add reference scan |
| 12 | Hard delete | PARTIAL | `hardDeleteMedia` ([:243-261](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java)) | MinIO removeObject failure chỉ log warn → orphan; product/article reference dangling | Order: check refs → remove MinIO → delete DB; rollback if fail |
| 13 | Restore | COMPLETE (BE) / MISSING (FE) | `restoreMedia` ([:266-279](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java)) | FE không có nút restore | Add UI |
| 14 | Image preview / video / audio inline | COMPLETE | [MediaLibraryScreen.jsx:238-249](../../bigbike-admin/src/screens/MediaLibraryScreen.jsx) | — | — |
| 15 | Image picker (single + multi) | COMPLETE | [MediaPickerModal.jsx](../../bigbike-admin/src/components/MediaPickerModal.jsx) | — | — |
| 16 | Video picker | COMPLETE | [VideoPickerModal.jsx](../../bigbike-admin/src/components/VideoPickerModal.jsx) | error message ghi "tối đa 500 MB" mâu thuẫn `MAX_FILE_SIZE = 50 MB` ([:101](../../bigbike-admin/src/components/VideoPickerModal.jsx)) | Sửa text |
| 17 | Audio picker | COMPLETE | [AudioPickerModal.jsx](../../bigbike-admin/src/components/AudioPickerModal.jsx) | FE limit 20 MB, BE limit 50 MB → mismatch (FE chặn sớm hơn, không là blocker) | Đồng bộ giới hạn |
| 18 | Drag-and-drop upload | COMPLETE (image picker only) | [MediaPickerModal.jsx:170-182](../../bigbike-admin/src/components/MediaPickerModal.jsx) | Library screen + video/audio picker không có DnD | Optional |
| 19 | Multi-image select | COMPLETE | [MediaPickerModal.jsx:184-213](../../bigbike-admin/src/components/MediaPickerModal.jsx) | — | — |
| 20 | Legacy WordPress migration | COMPLETE | `MediaCopyService` ([:1-225](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/migration/wordpress/media/MediaCopyService.java)) | Đã có guard, idempotent, streaming, checksum | — |
| 21 | MinIO object storage | COMPLETE (functional) | `MinioConfig` + `MinioProperties` | Default credentials hard-coded; bucket auto-create silently swallows errors | Fail-fast in prod |
| 22 | `/media/` proxy | PARTIAL | nginx admin ([:25-30](../../bigbike-admin/nginx.conf)), bigbike-web rewrite ([next.config.ts:266](../../bigbike-web/next.config.ts)) | **Vite dev không proxy** → broken local dev for new uploads | Add proxy |
| 23 | `/media-proxy/` legacy proxy | COMPLETE | nginx ([:34-39](../../bigbike-admin/nginx.conf)), vite ([:21-25](../../bigbike-admin/vite.config.js)) | Còn cần cho rows vẫn lưu URL `http://minio:9000/...` | Keep for compatibility |
| 24 | Audit log on mutations | COMPLETE | `buildAudit` ([:303-315](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java)) | `actorId` rơi về `DEV_ADMIN_ID` hardcoded khi không có JWT (`AdminMediaController.java:39, 127-133`) → audit reference UUID không tồn tại | Force JWT in prod |
| 25 | Image dimensions extraction | PARTIAL | `AdminMediaService.java:109-122` | Chỉ raster jpeg/png/gif. WebP, SVG không có size. ImageIO không có size guard → image bomb DoS | Limit decoder, support WebP via Twelvemonkeys |
| 26 | Sizes/thumbnail variants | MISSING | `MediaEntity.sizes` chỉ filled từ migration; new uploads không generate | Risk: web client phải dùng full-size ảnh → bandwidth cao | Add resizing pipeline |
| 27 | Reverse-reference tracking on delete | MISSING | Không có service nào check `products.image_id`, `product_gallery_images.image_id`, etc. trước khi delete | Hard delete tạo dangling reference | Add `MediaReferenceService` |
| 28 | Rate limiting on upload | MISSING | `RateLimitingFilter.java` không bao gồm `/admin/media` | Spam upload có thể fill bucket | Add tier |
| 29 | Virus scanning | MISSING | n/a | Có thể upload malware qua admin | ClamAV gateway hoặc skip (nội bộ admin) |
| 30 | Signed URL / private bucket | MISSING | Bucket public via nginx proxy | Mọi `/media/...` GET lấy được object | Acceptable nếu media là public asset |
| 31 | Image optimization | MISSING | n/a | — | nice-to-have |
| 32 | Orphan cleanup job | MISSING | n/a | DB rows được xoá nhưng MinIO object còn → bucket grows monotonically | Add scheduled job |
| 33 | Hard delete UI | MISSING | adminApi `hardDeleteMedia` exposed but no caller | User không có cách xoá vĩnh viễn từ UI | Add button (with reverse-ref guard) |

---

## 5. API Audit

| Endpoint | Purpose | Permission | Request | Response | Validation | Test Coverage | Status | Issues |
|---|---|---|---|---|---|---|---|---|
| `POST /api/v1/admin/media` (multipart) | Upload | `media.write` | `file` (required, MultipartFile), `altText` (optional) | `ApiDataResponse<AdminMediaDetailResponse>` 201 | MIME allowlist, ≤50 MB, filename sanitize | **NO controller/service test** | PARTIAL | SVG sanitize, MIME spoof, no length limit on altText, image bomb |
| `GET /api/v1/admin/media` | List | `media.read` | `page≥1`, `size 1..100`, `q`, `mimeType`, `status`, `storageProvider` | `ApiListResponse<AdminMediaListItemResponse>` | controller-level `@Min/@Max`; spec applies; no enum validation | `Phase1IAdminManagementApiTest #10–11` | COMPLETE | Filter values not enum-validated |
| `GET /api/v1/admin/media/{mediaId}` | Detail | `media.read` | UUID path | `ApiDataResponse<AdminMediaDetailResponse>` | path UUID Spring | `#12` | COMPLETE | Returns DELETED media too — by design? |
| `PATCH /api/v1/admin/media/{mediaId}` | Update metadata | `media.write` | `UpdateMediaRequest{altText, title, caption, status}` | `ApiDataResponse<AdminMediaDetailResponse>` | status enum check service-side; no `@Size` | `#13`, `#15` (audit) | PARTIAL | No length limits, empty string semantics not documented |
| `DELETE /api/v1/admin/media/{mediaId}` (?permanent=false) | Soft delete | `media.write` | `permanent=false` | 204 No Content | none | `#14` | COMPLETE | No reverse-ref check |
| `DELETE /api/v1/admin/media/{mediaId}?permanent=true` | Hard delete | `media.write` | `permanent=true` | 204 | none | **MISSING** | PARTIAL | MinIO error swallowed; orphan; no ref check |
| `POST /api/v1/admin/media/{mediaId}/restore` | Restore | `media.write` | none | `ApiDataResponse<AdminMediaDetailResponse>` | none | **MISSING** | COMPLETE | — |

Envelope format `ApiDataResponse` / `ApiListResponse` is present and OpenAPI test confirms `/api/v1/admin/media` is in OpenAPI doc ([Phase1KOpenApiContractTest.java:91-95](../../bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1KOpenApiContractTest.java)).

---

## 6. Permission / RBAC Audit

| Layer | Status | Evidence | Notes |
|---|---|---|---|
| Controller `media.read` on GET | PASS | `AdminMediaController.java:77, 87` | `requirePermission` |
| Controller `media.write` on POST/PATCH/DELETE/restore | PASS | `AdminMediaController.java:62, 97, 109, 122` | — |
| Spring security `/api/v1/admin/**` requires `ROLE_ADMIN` | PASS | `SecurityConfig.java:105` | — |
| FE route guard `media.read` | PASS | `App.jsx:86, 191` | — |
| FE mutation guard `media.write` | PASS | `App.jsx:361`, `MediaLibraryScreen.jsx:141, 259` | `canUpdate` prop |
| Role → permission map matches docs | PASS | `AdminRolePermissions.java` (referenced from `PERMISSION_MATRIX.md`) | SUPER_ADMIN `*`, ADMIN, EDITOR (read/write), AUTHOR (read/write), CONTRIBUTOR (read only) |
| Permission denial test (missing `media.write` returns 403) | **FAIL** | No test found across `bigbike-backend/src/test` | Critical gap |
| Permission denial test (missing `media.read` returns 403) | **FAIL** | None | Critical gap |
| **Dev/test header bypass risk** | **FAIL** | `DevAdminAuthService.java:79-86` reads `X-Admin-Role` / `X-Admin-Permissions` headers when no JWT principal — works in any non-prod profile | If an env runs Spring profile `dev|mock|local|test`, ANY request can self-grant `media.write` |
| **DEV_ADMIN_ID fallback in audit log** | **FAIL** | `AdminMediaController.java:39, 127-133` | `actorId = 00000000-0000-0000-0000-000000000001` when no AdminPrincipal in context. Audit becomes useless |
| Production auth path | **NEEDS VERIFICATION** | `DevAdminAuthService.ensureDevMockProfile()` ([:93-110](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/DevAdminAuthService.java)) throws `AuthNotImplementedException` if profile contains `prod`. Yet `currentAdminUser` is invoked indirectly only when no JWT. | If prod runs JWT-only path, `requirePermission` short-circuits via `AdminPrincipal`. **Confirm** prod profile + JWT-only mode is actually used in production deploy. |

**Conclusion**

- Permission backend: **PARTIAL** (header-bypass in non-prod profile; no negative tests).
- Permission frontend: **PASS** (route + mutation gates).
- Docs permission: **PASS** ([PERMISSION_MATRIX.md:74-75, 105-108, 317-322, 438](../engineering/PERMISSION_MATRIX.md)).
- Test permission: **FAIL** (no permission-denial tests).

---

## 7. Validation Audit

### 7.1 Upload validation

| Validation Area | FE | BE | DB | Test | Status | Risk |
|---|---|---|---|---|---|---|
| MIME allowlist | jpeg/png/webp/gif/svg/mp4/mp3/ogg/wav/webm/aac ([MediaLibraryScreen.jsx:12-16](../../bigbike-admin/src/screens/MediaLibraryScreen.jsx)) | identical ([AdminMediaService.java:45-48](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java)) | n/a | None | PASS (FE/BE align) | MIME from `MultipartFile.getContentType()` is **client-supplied**; spoof possible |
| Magic-byte / Tika sniff | none | none | n/a | None | **MISSING** | **P0**: malware disguised as image |
| File size 50 MB | 50 MB ([MediaLibraryScreen.jsx:17](../../bigbike-admin/src/screens/MediaLibraryScreen.jsx)) | 50 MB ([:51](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java)); spring multipart 52 MB ([application.properties:68](../../bigbike-backend/src/main/resources/application.properties)) | n/a | None | PASS | Audio FE picker = 20 MB ([AudioPickerModal.jsx:6](../../bigbike-admin/src/components/AudioPickerModal.jsx)) — UX inconsistency, not blocker |
| Video FE size text says "500 MB" | bug in VideoPickerModal text | 50 MB enforced | n/a | None | **BUG** | Misleading message ([VideoPickerModal.jsx:101](../../bigbike-admin/src/components/VideoPickerModal.jsx)) |
| Empty file check | implicit (`file.size>0` browser) | none | n/a | None | **MISSING** | 0-byte upload allowed |
| Filename non-empty | none | sanitize returns `"upload"` if blank ([:339](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java)) | n/a | None | PASS | — |
| Filename sanitize / path traversal | none | regex `[^a-zA-Z0-9._-]→_`, lowercase, ≤200 ([:341-343](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java)) | n/a | None | PASS | object key prefix `uploads/{UUID}/` removes residual risk |
| MIME spoofing prevention | none | none | n/a | None | **MISSING** | **P0** |
| SVG sanitize | none | none | n/a | None | **MISSING** | **P0**: SVG with `<script>` served same-origin |
| File-count limit | implicit (single file picker for library, multi for image picker) | controller has single `MultipartFile` → naturally one | n/a | None | PASS | — |
| Rate limit | none | not in `RateLimitingFilter` | n/a | None | **MISSING** | DoS / bucket fill |
| Image-bomb decompression guard | none | none — ImageIO reads full image to extract w/h ([:113-122](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java)) | n/a | None | **MISSING** | OOM via decompression bomb |

### 7.2 Metadata validation

| Field | FE | BE | DB | Status |
|---|---|---|---|---|
| `altText` | no maxLength | no `@Size` | TEXT (unbounded) | PARTIAL |
| `title` | no maxLength | no `@Size` | TEXT (unbounded) | PARTIAL |
| `caption` | no maxLength textarea | no `@Size` | TEXT (unbounded) | PARTIAL |
| `status` | enum select ALL/ACTIVE/DELETED ([MediaLibraryScreen.jsx:200-203](../../bigbike-admin/src/screens/MediaLibraryScreen.jsx)) | enum check `ACTIVE/INACTIVE/DELETED` ([AdminMediaService.java:44, 207-210](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java)) | varchar(50) NOT NULL, no CHECK constraint | PARTIAL — UI missing INACTIVE; no DB CHECK |

### 7.3 Query validation

| Query param | FE map | BE check | Status | Risk |
|---|---|---|---|---|
| `page≥1` | `pageSize` mapped to `size` | controller `@Min(1)` | PASS | — |
| `size≤100` | UI options 12/24/48/96 | `@Max(100)` | PASS | — |
| `mimeType` | UI: `image/`/`video/`/`audio/` | LIKE prefix; not whitelisted | PARTIAL | Arbitrary prefix attack (low) |
| `status` | UI: ACTIVE/DELETED | not enum-validated; passes raw to spec | PARTIAL | Wrong values silently return 0 rows |
| `storageProvider` | UI: MINIO/LEGACY_WP | upper-cased equality | PARTIAL | LOCAL test rows invisible |
| `q` (search) | FE debounce 250ms | not trimmed length-limited; `%` and `_` not escaped | PARTIAL | Wildcard via user input; no DoS unless huge payload |

---

## 8. DB Behavior Audit

| DB Behavior | Current Evidence | Risk | Production Grade? | Fix |
|---|---|---|---|---|
| Table created | [V4__create_media_redirect_menu_tables.sql:1-20](../../bigbike-backend/src/main/resources/db/migration/V4__create_media_redirect_menu_tables.sql) | — | YES | — |
| `id` UUID PK, generated by Hibernate (`GenerationType.UUID`) | `MediaEntity.java:16-18` | — | YES | — |
| `legacy_id` BIGINT UNIQUE | `V4` | for WordPress migration only; NULL for new uploads | YES | — |
| `file_path TEXT NOT NULL` | `V4` | UNIQUE NOT enforced; theoretical duplicate possible (UUID prefix prevents real collisions) | OK | — |
| `public_url TEXT` (nullable) | `V4` | FE shows placeholder if missing — handled | OK | — |
| `storage_provider VARCHAR(50) NOT NULL` | `V4` | No enum CHECK constraint | OK | Add CHECK ('MINIO','LEGACY_WP','LOCAL') |
| `status VARCHAR(50) NOT NULL` | `V4` | No CHECK | OK | Add CHECK |
| `mime_type VARCHAR(127)` | `V4` | nullable | OK | NOT NULL would help |
| `file_size BIGINT` | `V4` | nullable | OK | — |
| `width/height` | `V4` | int nullable; only filled for raster | OK | — |
| `created_at/updated_at TIMESTAMPTZ NOT NULL` | `V4` | service sets manually (not DB default) | OK | — |
| Index on `legacy_id` | `V4:22` | covers migration lookup | YES | — |
| Index on `storage_provider` | `V4:23` | covers provider filter | YES | — |
| Index on `mime_type` | `V4:24` | covers exact mime; **prefix LIKE 'image/%' is left-anchored**, PostgreSQL btree can use it for prefix LIKE if `text_pattern_ops` is set, **but default opclass won't** — verify | PARTIAL | Add `text_pattern_ops` opclass for LIKE optimization |
| Index on `status` | `V4:25` | covers exclude DELETED | YES | — |
| **Index on `created_at` for default sort** | **MISSING** | All list queries `ORDER BY createdAt DESC` ([AdminMediaService.java:175](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java)) | **No** | Add `idx_media_created_at_desc` |
| Index on `title/file_path/alt_text` for search LIKE `%q%` | MISSING; `%foo%` is unindexable on btree anyway | Trigram (`pg_trgm`) needed | OK at low scale | Add `pg_trgm` GIN later |
| Reverse-reference tracking | NONE — `products.image_id`, `product_gallery_images.image_id`, `product_variants.image_id` reference `media.legacy_id` indirectly via legacy_id text but no FK enforced | dangling refs after delete | NO | Add reference scan service |
| Soft delete excludes from list by default | YES — `MediaSpecifications.excludeDeleted()` | — | YES | — |
| Hard delete transactional consistency | NO — `removeObject` then `mediaRepo.delete` in same `@Transactional`, but MinIO call is **not transactional** with DB; if DB rolls back after MinIO success, object is orphaned silently | Orphan | NO | 1) check refs 2) MinIO delete with success 3) DB delete in `@Transactional` |
| Upload object → DB save fail | If `mediaRepo.save` throws, MinIO object remains | Orphan | NO | Try/catch + remove on failure |
| `bigbike-web` & admin web nginx rewrite for `/media/*` | OK ([nginx.conf:25-30](../../bigbike-admin/nginx.conf), [next.config.ts:266](../../bigbike-web/next.config.ts)) | — | YES | — |

---

## 9. Storage / MinIO / Proxy Audit

| Item | Status | Evidence | Notes |
|---|---|---|---|
| MinIO endpoint/credentials from env | PASS | `MinioProperties.java`, `application.properties:25-29` | `${MINIO_ENDPOINT}`, `${MINIO_ROOT_USER}`, `${MINIO_ROOT_PASSWORD}` |
| **Default credentials in code** | **FAIL** | `MinioProperties.java:11-13` defaults `minio_admin`/`minio_dev_only`/`bigbike-media` | Will be used if env unset; ok in compose where compose enforces `?:` but **not** if app deployed bare-metal without env |
| Bucket auto-create | PASS but soft-fail | `MinioConfig.MinioStartupInitializer.ensureBucket` — **logs warn** if bucket creation fails ([MinioConfig.java:48-50](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/MinioConfig.java)) | App keeps running even if MinIO unreachable. Should fail-fast in prod. |
| Upload streaming | PASS | `minioClient.putObject(...stream(file.getInputStream(), file.getSize(), -1)...)` | Spring's MultipartFile spills to disk for large files when `multipart.file-size-threshold` is exceeded; OK |
| `file.getInputStream()` consumed twice | RISK | Once for MinIO put ([:96-101](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java)), once for ImageIO read ([:114](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java)) | Spring's `MultipartFile` returns a **fresh** stream each call, so usually OK; non-blocker |
| Object key collision-safe | PASS | `uploads/{UUID}/{sanitizedFilename}` ([:91](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java)) | UUID prevents real collisions |
| Path traversal in object key | PASS | Sanitized filename + UUID prefix | — |
| Public URL = relative `/media/{key}` | PASS | `AdminMediaService.java:53, 107` | After V37/V38 migrations, all rows use relative `/media/...` |
| Vite dev `/media/` proxy | **FAIL** | `vite.config.js` only proxies `/api` and `/media-proxy` ([:14-26](../../bigbike-admin/vite.config.js)) | Newly uploaded media will 404 in admin dev mode |
| Admin nginx prod proxy `/media/` | PASS | `nginx.conf:25-30` → `http://minio:9000/bigbike-media/` | — |
| `bigbike-web` Next.js rewrite `/media/*` | PASS | `next.config.ts:266` | — |
| `/media-proxy` legacy compat | PASS | both nginx + vite | for old DB rows still pointing at internal hostname |
| CSP `media-src 'self' blob:` | PASS | `nginx.conf:69` | `/media/*` is same-origin → covered |
| CSP `img-src 'self' data: blob: https: http://localhost:9000` | PASS | `nginx.conf:69` | dev allows MinIO direct access |
| Cache headers on `/media/...` | **MISSING** | nginx location has no `add_header Cache-Control` | Hot product images re-fetched every visit |
| Range request (video/audio seek) | UNKNOWN | nginx pass-through; MinIO supports Range | likely works; should test |
| Signed URL / private bucket | NOT IMPLEMENTED | bucket is public via proxy | acceptable for public catalog assets |
| Virus scanning | NOT IMPLEMENTED | n/a | nice-to-have |
| Image optimization / thumbnails | NOT IMPLEMENTED | n/a | sizes column unused for new uploads |
| Orphan cleanup job | NOT IMPLEMENTED | n/a | hard delete failures + orphan from save-fail accumulate |

---

## 10. API / Data Contract Consistency

| Field | Backend DTO | Admin `normalizeMediaItem` | Mock | Docs | Mismatch |
|---|---|---|---|---|---|
| `id` | UUID | string fallback `'unknown-media'` | (mock available) | yes | OK |
| `legacyId` | Long (detail+list) | **NOT in normalizer** | — | partial | FE drops legacyId — fine since UI doesn't show it |
| `filePath` | string | mapped to `filename` (alongside `s.filename`) | mock | yes | FE uses `filename`; BE returns `filePath` — normalizer maps `filePath`→`filename`. OK |
| `filename` | NOT in BE DTO | normalizer uses `s.filename ?? s.filePath` | mock has `filename` | partial | FE accommodates both; live BE only returns `filePath`. **FE depends on `s.filePath` fallback** — works |
| `publicUrl` | string | `s.publicUrl ?? s.url` | — | yes | OK |
| `url` | NOT in BE | normalizer fallback | mock | — | FE accepts both |
| `storageProvider` | string | upper-case | — | yes | OK |
| `mimeType` | string | default `application/octet-stream` | — | yes | OK |
| `fileSize` | Long | int default 0 | — | yes | OK |
| `width/height` | Integer | optional int | — | yes | OK |
| `altText/title/caption` | string | `undefined` if blank | — | yes | OK |
| `sizes` | string (Detail only) | **NOT in normalizer** | — | yes | FE doesn't surface `sizes` — minor; not used |
| `status` | string (Detail+List) | **NOT in normalizer** | — | partial | FE relies on backend filter; UI shows storage-provider color, not status badge — acceptable |
| `bucket` | NOT in DTO | n/a | — | not exposed | OK |
| `createdAt/updatedAt` | Instant | string passthrough | — | yes | OK |

**Mismatches detected:**

- BE returns `filePath`; FE looks for `filename` first then falls back. Normalizer makes this transparent — minor naming inconsistency, no production bug.
- BE Detail DTO has `sizes`; FE never reads it. Wasted bandwidth (cheap).
- FE `normalizeMediaItem` does not capture `legacyId` or `status` — admin user cannot filter by status reliably from a row's badge.
- Mock data shape vs live data shape — FE has dual fallbacks; OK.

**Docs vs code:**

- `API_CONTRACT.md` correctly lists all 7 endpoints (POST/GET/GET-by-id/PATCH/DELETE/restore + permanent flag) — **CONFIRMED_FROM_CODE**.
- `PERMISSION_MATRIX.md` correctly maps `media.read`/`media.write` to controller lines and `App.jsx` lines — **PASS**.
- `BUSINESS_RULES.md` defines `MEDIA_RULE_001..003` — all marked `MISSING_TEST_COVERAGE`. **Confirmed**: there are no upload/MIME/size unit tests, no soft-delete-list-filter test.
- `DATA_CONTRACT.md` line 327 marks `status` enum values "need verification" — **CONFIRMED**: enum is `ACTIVE/INACTIVE/DELETED` per service constant ([:44](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java)).
- `DEPLOYMENT_GUIDE.md` line 130 references `BIGBIKE_MEDIA_PUBLIC_BASE_URL` — used by `MediaUrlProperties` (not by the upload path which now uses relative `/media/...`); kept for content/catalog URL allowlisting.
- **Drift to flag**: docs do not mention the SVG XSS or MIME spoofing risks; `INTEGRATION_GUIDE.md` describes `MIME validation against allowlist` as if sufficient — misleading.

---

## 11. Migration Audit (WordPress Phase 2E)

| Aspect | Status | Evidence | Notes |
|---|---|---|---|
| Activated by env flags + mode `media-copy` | PASS | `MediaCopyRunner.java:74-79` | — |
| Dry-run by default | PASS | `application.properties:36`, `MediaCopyRunner.java:90` | — |
| Confirm-execute guard for real copy | PASS | `MediaCopyRunner.java:93-101` | requires `confirm-execute=true` |
| Environment guard `local` or `staging` | PASS | `:103-112` | — |
| Spring profile `test` block | PASS | `:114-118` | — |
| Production DB URL pattern block | PASS | `:120-132` | reuses `WordPressMigrationImportRunner.PRODUCTION_URL_PATTERNS` |
| Uploads dir existence | PASS | `:134-138` | — |
| MinIO config completeness | PASS | `:140-146` | — |
| Streaming copy 64 KB chunks | PASS | `MediaCopyService.java:35, 175-178` | — |
| Idempotency by ETag (single-part MD5 == hex) | PASS | `MediaCopyService.java:123-132` | — |
| Idempotency by size for multipart ETag | PASS | `:112-123` | — |
| Checksum mismatch → re-copy | PASS | `:128-130` | — |
| Missing source: log + count, do not fail | PASS | `:81-86` | — |
| Retry with exponential backoff | PASS | `:174-198` | 500ms × attempt |
| Update DB row to MINIO provider | PASS | `:200-207` | back-propagation handled by V16 + V25 |
| Tests cover happy path, idempotency, checksum, large file streaming, missing files | PASS | `Phase2EMediaCopyTest.java` 9 tests | — |
| Per-file mimeType used for ContentType | PARTIAL | `MediaCopyService.java:171-172` | falls back to `application/octet-stream` if mimeType blank |
| `LEGACY_WP` rows not in MinIO yet still served | PARTIAL | rows with provider `LEGACY_WP` may have `public_url` pointing at host MinIO; nginx `/media-proxy/` covers this | — |

---

## 12. Test Coverage Audit

### Existing tests

| File | Tests for Media | Scenarios covered |
|---|---|---|
| `Phase1IAdminManagementApiTest.java` | 7 | list 401, list works, mimeType filter, detail, update altText/title/caption, soft delete, mutation audit log smoke |
| `Phase1JAdminSettingsMenuCouponApiTest.java` | 1 (regression) | `adminMedia_stillWorks` (basic GET) |
| `Phase1KOpenApiContractTest.java` | 1 | `/api/v1/admin/media` present in OpenAPI |
| `Phase2EMediaCopyTest.java` | 9 | dryRun counts, skip existing, idempotent, checksum verify, missing files logged, large file streaming, path resolver, checksum service, multipart ETag size match/mismatch |

### Missing tests

| Test Area | Existing | Missing | Risk | Priority |
|---|---|---|---|---|
| Upload happy path multipart | none | end-to-end multipart POST | High — controller code path untested | **P0** |
| Upload invalid MIME 400 | none | text/plain, application/octet-stream | High — regression risk | **P0** |
| Upload too-large 400/413 | none | 60 MB file | High | **P0** |
| Upload empty file (0 bytes) | none | — | Medium | P1 |
| Upload MinIO failure path → 500 with proper error | none | — | High | P1 |
| Upload DB save failure → object cleanup | none | — | Medium | P1 |
| Permission denial: missing `media.write` → 403 | none | for POST/PATCH/DELETE/restore | High — would catch RBAC drift | **P0** |
| Permission denial: missing `media.read` → 403 | none | for GET | High | **P0** |
| Restore endpoint | none | restore changes status to ACTIVE | Medium | P1 |
| Hard delete endpoint | none | `?permanent=true` removes DB + MinIO | High | **P0** |
| Hard delete MinIO failure → DB still deleted | none | catch warn | Medium | P1 |
| Status enum validation in update | none | invalid status → 400 | Medium | P1 |
| Search filter | none | q matches title/altText/filePath | Medium | P1 |
| Storage provider filter | none | MINIO vs LEGACY_WP | Medium | P2 |
| Pagination boundary | none | size=0, size=200, page=0 | Low | P2 |
| Filename sanitization | none | `../../etc/passwd`, special chars | High | P1 |
| SVG sanitization (currently absent) | none | upload SVG with `<script>` | High | **P0** |
| Image bomb / OOM | none | 1MB highly-compressed PNG | Medium | P1 |
| MIME spoofing (`Content-Type: image/png` on `.exe`) | none | — | High | **P0** |
| Audit log captures actorId from JWT | none | with real admin user vs DEV_ADMIN_ID | Medium | P1 |
| FE permission gate | none | `canUpdate=false` hides upload/delete | Low | P2 |
| FE upload rejects oversized client-side | none | jest test | Low | P2 |
| Picker MIME filtering | none | image picker only image, video picker only video | Low | P2 |
| `/media/` proxy resolves MinIO object | none | integration | Medium | P1 |
| Migration dry-run guard | covered | — | — | — |
| Migration real-copy guard | covered (config flags only) | end-to-end smoke against test MinIO container | Medium | P2 |

---

## 13. Bugs / Risks Found

| ID | Severity | Area | Issue | Evidence | Impact | Fix Recommendation |
|---|---|---|---|---|---|---|
| MED-001 | **P0** | Security | SVG accepted into allowlist without sanitization. SVG can contain `<script>`/`onload` and runs in browser when served as `image/svg+xml` from same origin (`/media/...`). | `AdminMediaService.java:46` | Stored XSS in admin SPA + bigbike-web | Either remove `image/svg+xml` from allowlist, or run input through a SVG sanitizer (e.g., `org.owasp.html` adapted, or JSoup whitelist) before MinIO put. Set `Content-Disposition: attachment` for SVG as a defense-in-depth layer. |
| MED-002 | **P0** | Security | MIME spoofing — `file.getContentType()` is the client-supplied value; backend never inspects bytes. | `AdminMediaService.java:79-84` | An attacker uploads `.exe` masquerading as `image/png`; web frontend renders broken image but malware now lives at a stable `/media/...` URL the attacker can later weaponise (e.g., inject as image-src in social engineering). | Add Apache Tika `Tika.detect(InputStream)` and verify against allowlist; reject if claimed mime ≠ detected mime. |
| MED-003 | **P0** | Auth/Security | Permission bypass via header `X-Admin-Permissions` in any non-prod Spring profile (`dev`/`mock`/`local`/`test`). | `DevAdminAuthService.java:79-86, 93-110` | Any deployment misconfigured with non-`prod` profile (e.g., staging shared with internet) accepts arbitrary permissions. Compose default in `docker-compose.yaml:68` is `prod` but anyone overriding for debug strips RBAC. | (a) Forbid header-based path entirely when `@RequestMapping("/api/v1/admin/**")`; (b) enforce JWT-only on those routes regardless of profile; (c) document hard rule that `prod` profile is mandatory in production. |
| MED-004 | **P0** | Auth | `resolveAdminId()` falls back to hardcoded UUID `00000000-0000-0000-0000-000000000001` when no `AdminPrincipal` in security context. All audit log rows for media mutations made via header-bypass path attribute to this UUID — useless for forensics. | `AdminMediaController.java:39, 127-133` | Audit trail integrity broken | Reject the request with 401 instead of returning a fake admin id. Remove `DEV_ADMIN_ID` constant. |
| MED-005 | **P0** | Data integrity | Hard delete removes DB row even when MinIO removeObject fails (only logged warn). Also no reverse-reference scan against `products.image_id`, `product_gallery_images.image_id`, `product_variants.image_id`, slider/home-video tables, content article/page bodies. | `AdminMediaService.java:248-261` | Orphan objects accumulate; dangling URLs in product/article render as broken images on customer-facing site. | Order: 1) build `MediaReferenceScanner`; if any reference exists, return 409 unless `force=true`; 2) `removeObject` and require success (no swallow); 3) only then delete DB row inside `@Transactional`. |
| MED-006 | P1 | Storage | Upload object then DB save: if `mediaRepo.save` fails, MinIO object remains. | `AdminMediaService.java:94-139` | Bucket grows monotonically with orphans | Wrap in try/catch — on save failure, call `removeObject` to roll back. |
| MED-007 | P1 | Storage | `MinioStartupInitializer.ensureBucket` swallows exceptions — app starts even if MinIO unreachable. | `MinioConfig.java:48-50` | Hidden production failure manifests as IllegalStateException at first upload. | In `prod` profile, fail-fast (rethrow). |
| MED-008 | P1 | Configuration | `MinioProperties` ships hardcoded default credentials `minio_admin`/`minio_dev_only`. | `MinioProperties.java:11-13` | If env unset (e.g., deploying outside compose), defaults silently used. | Remove defaults; throw at startup if missing. |
| MED-009 | P1 | Resource | `ImageIO.read` decodes raster image fully into memory to extract width/height — no decompression-bomb guard. | `AdminMediaService.java:113-122` | OOM via crafted PNG (image bomb) | Use `ImageReader` with `setInput`, read header only via `reader.getWidth(0) / getHeight(0)` without decode; or limit pixel count. |
| MED-010 | P1 | Performance | No `idx_media_created_at` — list query sorts by `createdAt DESC` over full table. | `MediaSpecifications` + missing migration | Slows when media table grows | Add Flyway migration `CREATE INDEX idx_media_created_at ON media(created_at DESC);` |
| MED-011 | P1 | Validation | No max length on `altText`/`title`/`caption` (DB columns are unbounded `TEXT`). | `UpdateMediaRequest.java`, `MediaEntity.java:45-52` | Memory pressure on list responses; UI overflow | Add `@Size(max=2000)` on DTO; align with content fields. |
| MED-012 | P1 | Security | No rate limit on `/api/v1/admin/media` upload. | `RateLimitingFilter.java` (no media tier) | DoS by spamming uploads to fill bucket / overload backend | Add tier (e.g., 30 req/min per admin user). |
| MED-013 | P1 | UI/UX | FE has no UI for `restoreMedia` even though endpoint + adminApi function exist. | `MediaLibraryScreen.jsx`, `adminApi.js:963-967` | Dead code in FE; user cannot recover after soft-delete | Add restore button when `status === 'DELETED'`. |
| MED-014 | P1 | UI/UX | FE has no UI for `hardDeleteMedia` even though endpoint + function exist. | same | User cannot purge bucket | Decide whether hard-delete should be admin-only with confirm + ref-check; either expose or remove. |
| MED-015 | P1 | UX | `VideoPickerModal` error text says "Tối đa 500 MB" but enforces 50 MB. | `VideoPickerModal.jsx:101` | User confusion | Fix string to 50 MB. |
| MED-016 | P1 | Validation | `status`, `mimeType`, `storageProvider` query params are not enum-validated; arbitrary strings pass through to spec | `AdminMediaController.java:67-80`, `MediaSpecifications` | Wrong values silently return 0 rows; possible LIKE wildcard via `%` in `mimeType` | Add `@Pattern` or service-side allowlist |
| MED-017 | P1 | Test | No unit/integration test for `POST /api/v1/admin/media` (multipart upload), MIME rejection, size rejection, empty file, hard delete, restore, permission denial. | `Phase1IAdminManagementApiTest.java` only covers list/detail/update/soft-delete | Regressions land silently | Add tests covering each case. |
| MED-018 | P1 | Dev experience | `vite.config.js` does not proxy `/media/...`. New uploads in admin dev mode return SPA `index.html`. | `vite.config.js:14-26` | Devs cannot verify uploads locally | Add `'/media': { target: 'http://localhost:9000', rewrite: (p) => p.replace(/^\/media/, '/bigbike-media') }` |
| MED-019 | P2 | Performance | nginx `/media/` location has no `Cache-Control` header. | `nginx.conf:25-30` | Browser refetches every visit; bandwidth waste | Add `expires 1y; add_header Cache-Control "public, immutable"` for `/media/` |
| MED-020 | P2 | Performance / DB | LIKE `%q%` search not index-backed. | `MediaSpecifications.matchesSearch` | Full scan on title/filePath/altText | Add `pg_trgm` GIN index when scale demands |
| MED-021 | P2 | UX | `image/webp` raster lacks dimension extraction (only JPEG/PNG/GIF). | `AdminMediaService.java:49-50` | Width/height left null for WebP, used by frontend layout | Add Twelvemonkeys ImageIO plugin for WebP |
| MED-022 | P2 | Maintenance | `LOCAL` storage provider seen in test rows (`Phase1IAdminManagementApiTest.java:446`) but not in FE filter | mismatch | Confusion | Either remove `LOCAL` or expose in FE |
| MED-023 | P2 | Operations | No orphan-cleanup scheduled job; bucket grows over time even with hard delete failures. | n/a | Storage cost growth | Add nightly reconciliation job |
| MED-024 | P2 | Validation | Filename sanitization lowercases — accent characters `.jpg` Vietnamese names lose recognisability. | `AdminMediaService.java:341` | UX, not security | Optional: only ASCII-fold instead of stripping non-ASCII |
| MED-025 | P3 | UX | No bulk operations (multi-delete, multi-tag) | n/a | Operational efficiency | nice-to-have |
| MED-026 | P3 | UX | No image optimization / thumbnail generation pipeline (`sizes` JSON populated only by migration). | `MediaEntity.sizes`, never set on upload | Bandwidth on listings | Add resize pipeline for product gallery |
| MED-027 | P3 | Docs | `BUSINESS_RULES.md` MEDIA_RULE_001..003 marked `MISSING_TEST_COVERAGE`; not updated even after `Phase1IAdminManagementApiTest` partially covered RULE_003. | `docs/business/BUSINESS_RULES.md:82-84` | minor doc drift | Update statuses after fixes ship |
| MED-028 | P3 | Audit log | `actorType="ADMIN"` hardcoded in `buildAudit`; if non-admin (system) ever calls service, mislabel. | `AdminMediaService.java:306` | low risk | Pass actor type from controller |
| MED-029 | P3 | Audit log | Upload audit (`MEDIA_UPLOADED`) has only file path/mime; doesn't record file size or final URL. | `:142` | low forensics value | Include size + publicUrl |
| MED-030 | P3 | Behavior | `getMediaDetail` returns DELETED rows. Documented? Likely intentional for restore flow. | `:189-193` | confirm with PM | If undesired, exclude DELETED unless `?includeDeleted=true` |

---

## 14. Final Completion Verdict

- **Is module complete?** **No / Partial.** Core happy-path (upload, list, detail, update metadata, soft-delete, migration) works and is documented. But security hardening (SVG, MIME spoofing, header-bypass), data integrity on hard delete + reverse references, and test coverage of write/permission paths are all materially below production grade.
- **Can release to production?** **Conditional — must fix P0 first.** The module is good enough for a closed-internal-admin staging environment. Releasing as-is to public production exposes XSS via SVG and accepts arbitrary admin permission claims when profile drift occurs.
- **Required fixes before production:**
  - MED-001 sanitize/disallow SVG
  - MED-002 magic-byte MIME validation (Tika)
  - MED-003 remove header-based permission bypass on `/api/v1/admin/**`
  - MED-004 remove `DEV_ADMIN_ID` fallback in controller
  - MED-005 reverse-ref guard + transactional hard delete
  - Tests for MED-001..005 (upload happy/invalid/oversize/empty, hard delete, restore, RBAC denial)
- **Nice-to-have improvements (post-launch):** image optimization pipeline, virus scan, signed URLs, bulk operations, restore/hard-delete UI, decompression-bomb guard, DB created_at index, rate limit, orphan cleanup job.

---

## 15. Recommended Implementation Plan

### Phase 1 — Blocker fixes (P0, ~2–3 days)
1. **MED-001** — Disallow SVG (simplest) **OR** integrate SVG sanitizer (JSoup whitelist) and force `Content-Disposition: attachment` for `image/svg+xml`.
2. **MED-002** — Add Apache Tika dependency + magic-byte verification helper; reject mismatch.
3. **MED-003** — Drop header-based permission bypass on `/api/v1/admin/**`. Restrict `requirePermission` to JWT principal path; optionally keep header path only behind `bigbike.dev.allow-header-auth=true` flag default `false`.
4. **MED-004** — Remove `DEV_ADMIN_ID`; if no JWT principal → 401.
5. **MED-005** — Build `MediaReferenceScanner` covering products/galleries/variants/sliders/home-videos/articles/pages; use it on hard delete; ensure transactional ordering.
6. Add backend tests covering items above + permission-denial cases (ADMIN no `media.write`, etc.).
7. Update `BUSINESS_RULES.md` and `PERMISSION_MATRIX.md` to reflect changes; remove "MISSING_TEST_COVERAGE" tags where addressed.

### Phase 2 — Hardening (P1, ~3–4 days)
- MED-006 transactional cleanup on save failure
- MED-007 fail-fast MinIO bucket check in `prod`
- MED-008 remove default MinIO credentials
- MED-009 image dimension extraction without full decode
- MED-010 add `idx_media_created_at` Flyway migration
- MED-011 length validation on metadata
- MED-012 rate-limit `/admin/media` upload
- MED-013 + MED-014 — UI for restore and hard delete (with ref-check)
- MED-015 fix video picker text
- MED-016 enum-validate query params
- MED-017 fill out test gaps
- MED-018 add `/media/` Vite proxy

### Phase 3 — Optimization (P2, scoped post-launch)
- MED-019 cache headers on nginx `/media/`
- MED-020 `pg_trgm` GIN for search
- MED-021 WebP dimension support (Twelvemonkeys)
- MED-022 reconcile `LOCAL` provider vs FE filter
- MED-023 orphan-cleanup nightly job

### Phase 4 — Test / documentation (rolling)
- MED-024..030 — backlog improvements + doc updates
- Update `docs/business/BUSINESS_RULES.md` MEDIA_RULE entries with covered tests
- Add MEDIA acceptance criteria section to `docs/business/ACCEPTANCE_CRITERIA.md`
- Document the production auth contract (no header bypass; JWT mandatory) in `docs/engineering/PERMISSION_MATRIX.md`

---

### Appendix — Files NOT FOUND (or NEEDS_VERIFICATION) during this audit

- **NOT FOUND**: `bigbike-admin/__tests__/Media*.test.*`, no Vitest/Jest test for any Media component or `adminApi.js` media function.
- **NOT FOUND**: dedicated frontend test for picker MIME filtering or upload validation.
- **NOT FOUND**: SVG sanitizer module anywhere in `bigbike-backend/src/main/java`.
- **NOT FOUND**: virus scanner integration.
- **NOT FOUND**: orphan / reconciliation job (`@Scheduled` for media).
- **NEEDS VERIFICATION**: actual production deploy uses `SPRING_PROFILES_ACTIVE=prod` AND admin requests carry valid JWT (i.e., MED-003 risk does not currently realise). Recommended: confirm with ops + add an integration test that requests without JWT to `/admin/media` get 401 even with Spring profile `dev`.
- **NEEDS VERIFICATION**: range request behaviour for video/audio via nginx `/media/` proxy — likely works but not asserted in tests.
- **NEEDS VERIFICATION**: V25 migration content (only enumerated, not deeply read). Should re-audit before any schema change touching media.
