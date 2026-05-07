# Settings Module Completion Audit

> Audit ngày 2026-05-07 — read-only inspection, no source code modification.
> Mục tiêu: đánh giá module **Settings / Cài đặt** đã production-ready chưa, đối chiếu admin FE ↔ backend ↔ public web ↔ DB ↔ tests.
>
> **Cập nhật 2026-05-07:** Đã hoàn thành Phase A / B / B.1 / C. Xem [Section 1.1](#11-post-audit-implementation-summary) và các finding được mark `✅ FIXED`.

---

## 1. Executive Summary

**Kết luận ban đầu (2026-05-07 sáng): Module Settings GẦN HOÀN THIỆN nhưng CHƯA production-ready.**
**Kết luận sau Phase A/B/B.1/C (2026-05-07 chiều): Tất cả blocker P0/P1 lõi đã được đóng. Module đạt production-ready cho luồng hiện tại. Remaining work là P2/P3 backlog.**

| Trục | Trạng thái ban đầu | Trạng thái hiện tại |
|---|---|---|
| Route + UI Settings | ✅ Đã có, ổn | ✅ Không đổi |
| Permission gate (`settings.read` / `settings.write`) | ✅ Đã có | ✅ Không đổi |
| Backend CRUD + endpoint | ✅ Đã có | ✅ + batch endpoint mới |
| Public endpoint + revalidation | ✅ Đã có | ✅ Không đổi |
| Audit log trên update | ✅ Có | ✅ + mask sensitive value trong log |
| Sensitive key block public | ✅ Có | ✅ Strict allowlist (Phase B) |
| **Validation theo type** (boolean/number/URL/email) | ❌ Thiếu hoàn toàn | ✅ **FIXED Phase B** — SettingDefinitionRegistry + SettingValueValidator |
| **Mask sensitive setting** trong response | ❌ Không có | ✅ **FIXED Phase B** — `settingValue="********"`, `sensitive`, `masked` fields |
| **google_maps_url domain allowlist** ở backend | ❌ Không có | ✅ **FIXED Phase B.1** — chỉ accept google.com/maps |
| **Audit log ghi plaintext sensitive value** | ❌ Leak trong log | ✅ **FIXED Phase B.1** — snapshot mask khi isSensitive |
| **Partial-save risk** (Promise.all) | ❌ Race condition | ✅ **FIXED Phase C** — batch endpoint + FE gọi 1 request |
| **Mock vs live permission key** | ❌ `settings.update` vs `settings.write` | ✅ **FIXED Phase A** |
| **iframe URL từ setting** ở `lien-he` page | ❌ Không có domain allowlist | ✅ **FIXED Phase A** — exact key match + domain allowlist + sandbox fix |
| **Dynamic role permissions** (V49) ↔ check thực tế | ❌ Decorative — không được consult | ❌ Chưa fix — P1 backlog |
| **Group casing** trong DB | ⚠️ Không nhất quán | ⚠️ Chưa fix — P2 backlog |
| **Test coverage** | ⚠️ Chỉ 9/~25 hành vi | ✅ **83 tests, 0 failures** (Phase B+B.1+C thêm 22 tests) |
| **Batch update endpoint** | ❌ Không có | ✅ **FIXED Phase C** — `PATCH /api/v1/admin/settings` |

**Risk level hiện tại: LOW cho core Settings. Remaining P1 (dynamic RBAC) là cross-module và được track riêng.**

---

## 1.1 Post-Audit Implementation Summary

| Phase | Mô tả | Files thay đổi | Tests thêm |
|---|---|---|---|
| **Phase A** | Iframe security (exact key match, domain allowlist, sandbox fix); mock permission key fix (`settings.update` → `settings.write`) | `lien-he/page.tsx`, `mockData.js` | — (tests có từ trước) |
| **Phase B** | SettingDefinitionRegistry (38 keys, type/range/public/sensitive), SettingValueValidator (12 loại), mask sensitive response, strict public allowlist | `SettingDefinitionRegistry.java`, `SettingValueValidator.java`, `SettingValueType.java`, `AdminSettingsService.java`, `AdminSiteSettingResponse.java` | PB1–PB14 (14 tests) |
| **Phase B.1** | Google Maps domain allowlist enforcement (backend); audit log snapshot mask sensitive values | `SettingValueValidator.java`, `AdminSettingsService.java` | PB.1–PB.4 (4 tests) |
| **Phase C** | Batch update endpoint all-or-nothing; FE dùng batch thay Promise.all; API_CONTRACT.md cập nhật | `BatchUpdateSettingsRequest.java`, `AdminSettingsController.java`, `AdminSettingsService.java`, `adminApi.js`, `SettingsScreen.jsx`, `API_CONTRACT.md` | PC1–PC2 (2 tests) |

**Test suite tổng kết:** `Phase1JAdminSettingsMenuCouponApiTest` — **83 tests, 0 failures, 0 errors.**

---

## 2. Scope Inspected

### Admin FE
- [bigbike-admin/src/App.jsx](../../bigbike-admin/src/App.jsx) (route + permission gate)
- [bigbike-admin/src/screens/SettingsScreen.jsx](../../bigbike-admin/src/screens/SettingsScreen.jsx)
- [bigbike-admin/src/lib/adminApi.js:1043-1067](../../bigbike-admin/src/lib/adminApi.js#L1043-L1067)
- [bigbike-admin/src/lib/contracts.js:550-561](../../bigbike-admin/src/lib/contracts.js#L550-L561) (`normalizeSetting`)
- [bigbike-admin/src/lib/mockData.js:502-529](../../bigbike-admin/src/lib/mockData.js#L502-L529) (ROLE_PERMISSION_MAP), [502-761](../../bigbike-admin/src/lib/mockData.js#L713-L761) (mock settings)
- [bigbike-admin/src/screens/RolesScreen.jsx](../../bigbike-admin/src/screens/RolesScreen.jsx) (PERMISSION_CATALOG, SENSITIVE_PERMS)

### Backend API
- [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminSettingsController.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminSettingsController.java)
- [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/public_/PublicSettingsController.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/public_/PublicSettingsController.java)
- [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSettingsService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSettingsService.java)
- [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/settings/SiteSettingEntity.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/settings/SiteSettingEntity.java)
- [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/settings/SiteSettingJpaRepository.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/settings/SiteSettingJpaRepository.java)
- [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/settings/AdminSiteSettingResponse.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/settings/AdminSiteSettingResponse.java)
- [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/settings/UpdateSiteSettingRequest.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/settings/UpdateSiteSettingRequest.java)
- [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/settings/PublicSiteSettingResponse.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/settings/PublicSiteSettingResponse.java)
- [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java)
- [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/JwtAuthFilter.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/JwtAuthFilter.java)
- [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminRolePermissions.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminRolePermissions.java)
- [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/DevAdminAuthService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/DevAdminAuthService.java)
- [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminAuthService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminAuthService.java)
- [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminRoleService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminRoleService.java)
- [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/web/WebRevalidationService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/web/WebRevalidationService.java)

### DB Migrations (đụng `site_settings`)
- V5 (create table)
- V18, V19, V21 (homepage seed)
- V22, V23, V24 (footer/contact seed)
- V29 (tax + store + security)
- V32 (home_exp_*)
- V40 (messenger_url)
- V45 (sepay seed) → **gỡ ở V59**
- V48 (google_maps_url + seo_home_h1)
- V49 (admin_roles + role_permissions tables — NOT consulted at runtime)
- V58 (redirects perms)
- V59 (delete `payment_sepay.*`)
- Dev: V1001, V1004 (extra dev seeds, có double key + quoted values)

### Public Web
- [bigbike-web/lib/api/public-api.ts:353-355](../../bigbike-web/lib/api/public-api.ts#L353-L355) (`listPublicSettings`, tag `settings`, revalidate 3600s)
- [bigbike-web/components/layout/SiteFooter.tsx](../../bigbike-web/components/layout/SiteFooter.tsx)
- [bigbike-web/components/layout/SiteHeader.tsx:73-100](../../bigbike-web/components/layout/SiteHeader.tsx#L73-L100)
- [bigbike-web/components/layout/FloatingChatLoader.tsx](../../bigbike-web/components/layout/FloatingChatLoader.tsx)
- [bigbike-web/app/page.tsx:72-87](../../bigbike-web/app/page.tsx#L72-L87) (metadata)
- [bigbike-web/app/page.tsx:280-307](../../bigbike-web/app/page.tsx#L280-L307) (home content)
- [bigbike-web/app/lien-he/page.tsx](../../bigbike-web/app/lien-he/page.tsx)

### Tests
- [bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1JAdminSettingsMenuCouponApiTest.java](../../bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1JAdminSettingsMenuCouponApiTest.java)
- KHÔNG có FE test cho Settings (admin / web).
- KHÔNG có e2e test cho luồng admin → backend → public web.

---

## 3. Route & Navigation Audit

| Route | Component | Permission | Status | Evidence |
|---|---|---|---|---|
| `/admin/settings` | `SettingsScreen` | `settings.read` | ✅ Đúng | [App.jsx:104](../../bigbike-admin/src/App.jsx#L104), [App.jsx:206](../../bigbike-admin/src/App.jsx#L206), [App.jsx:388](../../bigbike-admin/src/App.jsx#L388) |
| Nav item "Cài đặt" trong nhóm `system` | — | `settings.read` | ✅ Đúng | [App.jsx:104](../../bigbike-admin/src/App.jsx#L104) |
| Edit gating (canUpdate prop) | — | `settings.write` | ✅ Đúng | [App.jsx:388](../../bigbike-admin/src/App.jsx#L388) |

Không có route detail cho từng key — toàn bộ chạy single-screen, tab bên trái. OK với scale hiện tại (~30 settings).

---

## 4. Screen / UI Feature Audit

Checklist cho [SettingsScreen.jsx](../../bigbike-admin/src/screens/SettingsScreen.jsx):

| Feature | Status | Evidence |
|---|---|---|
| Loading state | ✅ | [SettingsScreen.jsx:367-369](../../bigbike-admin/src/screens/SettingsScreen.jsx#L367-L369) |
| Error state + retry | ✅ | [SettingsScreen.jsx:370-380](../../bigbike-admin/src/screens/SettingsScreen.jsx#L370-L380) |
| Empty state | ✅ | [SettingsScreen.jsx:394-395](../../bigbike-admin/src/screens/SettingsScreen.jsx#L394-L395) |
| Read-only mode khi thiếu `settings.write` | ✅ | [SettingsScreen.jsx:167-181](../../bigbike-admin/src/screens/SettingsScreen.jsx#L167-L181) |
| Editable mode | ✅ | input controls render khi `canUpdate` |
| Dirty state badge mỗi field + tab badge | ✅ | [SettingsScreen.jsx:155, 162-165, 416-419](../../bigbike-admin/src/screens/SettingsScreen.jsx#L155) |
| Save button disable khi không dirty / có error | ✅ | [SettingsScreen.jsx:233](../../bigbike-admin/src/screens/SettingsScreen.jsx#L233) |
| Discard button (per tab) | ✅ | [SettingsScreen.jsx:306-318](../../bigbike-admin/src/screens/SettingsScreen.jsx#L306-L318) |
| Save success toast | ✅ | [SettingsScreen.jsx:427-432](../../bigbike-admin/src/screens/SettingsScreen.jsx#L427-L432) |
| Save error feedback (gắn vào field) | ⚠️ Partial — gán error chung cho tất cả field dirty | [SettingsScreen.jsx:358-361](../../bigbike-admin/src/screens/SettingsScreen.jsx#L358-L361) |
| Inline FE validation | ⚠️ Yếu — chỉ check email "@", URL prefix, phone regex | [SettingsScreen.jsx:59-74](../../bigbike-admin/src/screens/SettingsScreen.jsx#L59-L74) |
| Hide groups (SECURITY) / hide keys (currency, timezone, tax_label) | ✅ | [SettingsScreen.jsx:84-90](../../bigbike-admin/src/screens/SettingsScreen.jsx#L84-L90) |
| Quote-stripping helper cho legacy `site.*` keys | ✅ | [SettingsScreen.jsx:14-19](../../bigbike-admin/src/screens/SettingsScreen.jsx#L14-L19) |
| Edit `value` only (KHÔNG cho sửa `group`/`isPublic`/`description`) | ⚠️ **By-design limit** — nhưng backend hỗ trợ → có gap | [adminApi.js:1060-1067](../../bigbike-admin/src/lib/adminApi.js#L1060-L1067) chỉ gửi `value` |
| Public/private/sensitive badge | ❌ Không hiển thị | UI không show `isPublic` — P2 backlog |
| Mask secret value trong UI | ❌ Không có | Backend đã mask; input vẫn là text — FE typed control là P2 backlog |
| Typed controls (switch/number/textarea/URL/media-picker) | ❌ Không có — dùng `<input type=text|email|url|tel|number>` | [SettingsScreen.jsx:21-38](../../bigbike-admin/src/screens/SettingsScreen.jsx#L21-L38) — P2 backlog |
| Save nhiều dirty field bằng batch (all-or-nothing) | ✅ **FIXED Phase C** — gọi `batchUpdateSettings` 1 request | [SettingsScreen.jsx](../../bigbike-admin/src/screens/SettingsScreen.jsx), [adminApi.js](../../bigbike-admin/src/lib/adminApi.js) |
| Accessibility (aria-describedby, aria-current) | ✅ | [SettingsScreen.jsx:175, 413](../../bigbike-admin/src/screens/SettingsScreen.jsx#L175) |
| Responsive | ❓ Chưa verify runtime — code có CSS class nhưng không kiểm chứng |

---

## 5. API Contract Audit

### Admin endpoints

| Method | Path | Request | Response | Permission | Validation | Status |
|---|---|---|---|---|---|---|
| GET | `/api/v1/admin/settings` | `?page,size,q,group,isPublic` | `{ data: AdminSiteSettingResponse[], pagination }` | `settings.read` | min/max int validators bằng `@Min/@Max` | ✅ |
| GET | `/api/v1/admin/settings/{settingKey}` | — | `{ data: AdminSiteSettingResponse }` | `settings.read` | — | ✅ |
| PATCH | `/api/v1/admin/settings/{settingKey}` | `{ value?, group?, isPublic?, description? }` | `{ data: AdminSiteSettingResponse }` | `settings.write` | ✅ **FIXED Phase B** — SettingDefinitionRegistry + SettingValueValidator; 3 gates: read-only, public allowlist, type/range | ✅ |
| PATCH | `/api/v1/admin/settings` | `{ updates: [{key, value}] }` | `{ data: AdminSiteSettingResponse[] }` | `settings.write` | ✅ **NEW Phase C** — validate-all-then-save-all trong `@Transactional`; 400 nếu bất kỳ item nào invalid, không có partial save | ✅ |

`AdminSiteSettingResponse` hiện có thêm 3 field mới (Phase B): `valueType` (STRING/BOOLEAN/…), `sensitive` (boolean), `masked` (boolean). Backward compatible — FE cũ bỏ qua field mới.

### Public endpoint

| Method | Path | Request | Response | Permission | Status |
|---|---|---|---|---|---|
| GET | `/api/v1/settings/public` | — | `{ data: PublicSiteSettingResponse[] }` (chỉ `key/value/group`) | permitAll ([SecurityConfig.java:91](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java#L91)) | ✅ Strict allowlist (Phase B) — chỉ expose key được registry đánh dấu `publicAllowed=true` và không sensitive |

### Endpoints không có (theo design — không phải bug)
- ℹ️ POST `/api/v1/admin/settings` — create new setting: không cần, settings được seed bằng migration
- ℹ️ DELETE `/api/v1/admin/settings/{key}` — delete setting: không cần, xoá qua migration
- ✅ ~~POST `/api/v1/admin/settings/batch`~~ → **FIXED Phase C** thành `PATCH /api/v1/admin/settings`

---

## 6. Permission / RBAC Audit

| Layer | Source | Settings perms |
|---|---|---|
| FE route | [App.jsx:104, 206](../../bigbike-admin/src/App.jsx#L104) | `settings.read` |
| FE edit gate | [App.jsx:388](../../bigbike-admin/src/App.jsx#L388) | `settings.write` |
| FE Roles UI catalog | [RolesScreen.jsx:53-54](../../bigbike-admin/src/screens/RolesScreen.jsx#L53-L54) | `settings.read`, `settings.write` |
| FE mock ROLE_PERMISSION_MAP (ADMIN) | [mockData.js:511](../../bigbike-admin/src/lib/mockData.js#L511) | `settings.read`, **`settings.update`** ⚠️ mismatch |
| FE buildMockRoles (live ALL_PERMS) | [adminApi.js:2064](../../bigbike-admin/src/lib/adminApi.js#L2064) | `settings.read`, `settings.write` |
| BE `requirePermission` đọc | [DevAdminAuthService.java:73-76](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/DevAdminAuthService.java#L73-L76) | `AdminRolePermissions.MAP` (hardcoded) |
| BE `AdminRolePermissions.MAP` | [AdminRolePermissions.java:24](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminRolePermissions.java#L24) | ADMIN có cả `settings.read` + `settings.write` |
| DB `role_permissions` (V49) | [V49__create_roles_permissions_tables.sql:40](../../bigbike-backend/src/main/resources/db/migration/V49__create_roles_permissions_tables.sql#L40) | ADMIN có cả `settings.read` + `settings.write` |
| BE controller call | [AdminSettingsController.java:56,66,76](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminSettingsController.java#L56) | `settings.read` (GET), `settings.write` (PATCH) |
| Spring `hasRole("ADMIN")` gate cho `/api/v1/admin/**` | [SecurityConfig.java:109](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java#L109) | URL-level, chặn SHOP_MANAGER khỏi `/admin/settings/**` |

### Mismatches

1. **FE mock dùng `settings.update`** thay vì `settings.write` (P3) — [mockData.js:511](../../bigbike-admin/src/lib/mockData.js#L511). Live ROLE_PERMISSION_MAP (mock auth user) sẽ thiếu `settings.write`, dẫn đến UI read-only mode khi force-mock dù role là ADMIN.
2. **Dynamic role table V49 KHÔNG được consult** ở runtime — comment trong V49 nói "Replaces hardcoded AdminRolePermissions.MAP" nhưng `requirePermission` vẫn dùng `AdminRolePermissions.MAP`. Admin sửa permissions qua UI → DB ghi nhưng không có hiệu lực. (P1)
3. **`AdminRolePermissions.MAP` thiếu các permission `pos.*` và `receivables.*` trong DB seed** (V49+V58 không seed). Hiện không gây vấn đề vì DB không được consult. Nhưng nếu sau này switch sang DB, ADMIN/SHOP_MANAGER sẽ mất quyền POS/Receivables. (P2)
4. **SHOP_MANAGER không có `settings.read`/`write`** ở mọi nguồn — đúng. ✅
5. **EDITOR/SEO_EDITOR không có settings perm** — đúng. ✅

---

## 7. Validation & Security Audit

### FE validation ([SettingsScreen.jsx:59-74](../../bigbike-admin/src/screens/SettingsScreen.jsx#L59-L74))

```js
// Chỉ kiểm:
// - email phải có '@'
// - URL phải start với http:// | https:// | /
// - phone chỉ chứa digits/+/-/space
```

→ Yếu, không check:
- boolean phải `true|false`
- number phải numeric (chỉ kiểm khi key chứa "threshold|price|amount")
- decimal/rate (`tax_rate` không validate)
- enum (none defined)
- empty value cho key bắt buộc

### BE validation — ✅ FIXED Phase B

`SettingDefinitionRegistry` + `SettingValueValidator` đã được triển khai:

- **38 keys** được đăng ký với type, range, public allowlist, sensitive flag.
- **12 loại validation**: STRING (max 1000), LONG_TEXT (65536), HTML (262144), BOOLEAN (true|false only), INTEGER (pattern + range), DECIMAL/MONEY (BigDecimal + range), URL (http/https + host), IMAGE_URL, EMAIL (regex), PHONE (regex), ENUM (allowedValues).
- **google_maps_url** (Phase B.1): domain allowlist chặt — chỉ `www.google.com`, `google.com`, `maps.google.com`; https only; path phải bắt đầu `/maps`; subdomain hijack bị từ chối.
- Unregistered keys vẫn chấp nhận arbitrary value → backward compat.
- 3 gates trong `updateSetting` và `batchUpdateSettings`: (1) read-only, (2) public allowlist, (3) type/range.

### Sensitive setting protection — ✅ FIXED Phase B + B.1

- `SettingDefinitionRegistry.isSensitive(key)`: kết hợp `sensitive` flag trong registry VÀ substring fragment blacklist (belt-and-suspenders).
- `toAdminResponse`: nếu sensitive → `settingValue="********"`, `sensitive=true`, `masked=true`.
- `snapshot()` (audit log): nếu sensitive → ghi `"********"` thay plaintext cho cả before và after.
- Public endpoint strict allowlist: chỉ expose key có `publicAllowed=true` trong registry VÀ không sensitive — ngăn leak kể cả khi DB flag `is_public=true` nhưng key chưa được allowlist.
- ⚠️ Detection vẫn dùng substring blacklist (bổ sung bởi registry flag). `smtp_pass`, `mailgun_key` etc. chưa có trong registry → nếu thêm key mới phải đăng ký trong registry. **P2 backlog.**

### XSS / Open redirect / iframe risk (`bigbike-web`) — ✅ FIXED Phase A

`app/lien-he/page.tsx` đã được fix:
- Match key chính xác `setting.settingKey === "google_maps_url"` thay vì regex `/map/i`.
- Domain allowlist: chỉ render iframe khi host là `www.google.com` hoặc `maps.google.com`.
- Sandbox: bỏ `allow-same-origin` (chỉ giữ `allow-scripts`) → iframe không còn truy cập được `document.cookie` của origin chính.

Backend (Phase B.1) bổ sung validation: `google_maps_url` phải là Google Maps URL hợp lệ trước khi lưu vào DB → defense-in-depth.

External URLs trong Footer dùng `rel="noopener noreferrer"` ✅ ([SiteFooter.tsx:262-289](../../bigbike-web/components/layout/SiteFooter.tsx#L262-L289)).

### Payment / tax / checkout setting risk

`tax_enabled`, `tax_rate`, `tax_inclusive`, `order_min_amount` được sửa qua admin nhưng **không validate type**, **không có audit cảnh báo "thay đổi thuế suất"** ngoài audit log chung.
→ **P1** business risk nếu admin nhập sai giá trị thuế.

V59 đã xoá `payment_sepay.*` settings nên hiện tại **không có credential nào trong site_settings**. Nhưng nếu sau này thêm lại (theo memo `reference_4thitek_sepay.md`), policy mask + denylist hiện tại sẽ không đủ vì ADMIN read-side vẫn thấy plaintext token.

---

## 8. DB Behavior Audit

### Schema ([V5](../../bigbike-backend/src/main/resources/db/migration/V5__create_commerce_settings_tables.sql#L61-L74))

```sql
create table site_settings (
    id uuid primary key,
    setting_key varchar(255) not null unique,
    setting_value text not null,
    setting_group varchar(100) not null,
    is_public boolean not null default false,
    description text,
    created_at timestamp with time zone not null,
    updated_at timestamp with time zone not null
);
create index idx_site_settings_setting_key on site_settings (setting_key);  -- redundant với unique
create index idx_site_settings_setting_group on site_settings (setting_group);
create index idx_site_settings_is_public on site_settings (is_public);
```

| Mục | Trạng thái |
|---|---|
| `setting_key` UNIQUE | ✅ |
| Indexes (key/group/is_public) | ✅ Đủ |
| `setting_value text not null` | ✅ |
| `setting_group varchar(100) NOT NULL` (DB) vs Entity field annotation cho phép null | ⚠️ Mismatch — Entity ([SiteSettingEntity.java:26-27](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/settings/SiteSettingEntity.java#L26-L27)) không có `nullable=false`. Service [AdminSettingsService.java:115](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSettingsService.java#L115) set group=null khi blank → DB sẽ raise `NOT NULL violation` (PSQLException) thay vì 400 đẹp. P2 |

### Group casing inconsistency

| Migration | Group casing |
|---|---|
| V18 | `public_home`, `seo` (lowercase) |
| V22, V23, V24 | `general`, `contact` (lowercase) |
| V29 | `TAX`, `STORE`, `SECURITY` (UPPERCASE) |
| V32 | `public_home` (lowercase) |
| V40, V48 | `contact` / `seo` (lowercase) |
| V1001 dev | `general`, `commerce` (lowercase, có thêm group `commerce` chỉ trong dev) |

→ FE phải `(s.settingGroup || 'GENERAL').toUpperCase()` ([SettingsScreen.jsx:274](../../bigbike-admin/src/screens/SettingsScreen.jsx#L274)) để chuẩn hoá. **Inconsistency là nguồn gốc cho confusion** khi viết test/seed mới. P2.

### Seed conflicts

- Tất cả migrations đều dùng `where not exists (...)` hoặc `on conflict (setting_key) do nothing` → idempotent ✅
- Một vài migration update `set is_public = true, ... where setting_key in (...)` (V18) → có thể **override is_public** của setting đã được sửa thủ công → P3 informational.

### Key duplications (dev-only)

V1001 seed `site.name`, `site.url`, `site.contact_email`, `site.currency` — trùng/khác chuẩn so với `site_name`, `contact_email`, `store_currency` đã seed bởi V22/V29.
- Giá trị V1001 có **dấu nháy kép** (`'"BigBike"'`) → cần helper strip quotes ở cả admin FE và public web. P2.

### Pagination/filter/sort

- [`AdminSettingsService.listSettings`](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSettingsService.java#L53-L86) **load toàn bộ** rồi filter trong memory bằng Stream:
  ```java
  Stream<SiteSettingEntity> stream = settingRepo.findAll().stream();
  ```
  → Với ~30 settings hiện tại OK; nhưng không tận dụng index DB. Nếu settings tăng lên (thêm POS/SePay/multi-store) sẽ chậm. **P2** scalability.
- Sort by `(group, key)` ASC trong memory ✅
- Không hỗ trợ sort khác (`updatedAt desc`) — P3.

---

## 9. Public Web Integration Audit

### Public endpoint contract

Backend trả về `key/value/group` only ([PublicSiteSettingResponse.java:3-7](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/settings/PublicSiteSettingResponse.java#L3-L7)) → tránh leak `description`, `isPublic`, timestamps. ✅

### Cache / revalidate

- FE Next.js: `loadData("/api/v1/settings/public", 3600, ["settings"])` ([public-api.ts:353-355](../../bigbike-web/lib/api/public-api.ts#L353-L355))
- BE on update: `webRevalidationService.revalidate("settings")` ([AdminSettingsService.java:126](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSettingsService.java#L126))
- Tag khớp ✅
- Revalidate chạy **after-commit** ([WebRevalidationService.java:51-58](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/web/WebRevalidationService.java#L51-L58)) ✅
- Revalidate failure log warn, không fail transaction ([WebRevalidationService.java:76-77](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/web/WebRevalidationService.java#L76-L77)) ✅
- TTL fallback 3600s nếu revalidate-secret/url chưa cấu hình ([WebRevalidationService.java:33](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/web/WebRevalidationService.java#L33)) ✅

### Keys public web đang đọc

| Key | Component | Note |
|---|---|---|
| `site_name`, `site_title`, `site.name` | Footer, Header | fallback chain ✅ |
| `footer_tagline`, `footer_description` | Footer | ✅ |
| `hotline`, `phone`, `support_phone`, `contact_phone` | Footer/Header/FloatingChat | fallback chain |
| `hotline_2` | Footer | |
| `contact_email`, `email`, `support_email`, `site.contact_email` | Footer | fallback chain |
| `contact_address`, `address`, `site_address` | Footer | fallback chain |
| `facebook_url`, `zalo_url` | Footer/FloatingChat | |
| `youtube_url`, `tiktok_url`, `instagram_url` | Footer | **Chỉ seed ở dev V1004**, không có ở prod migration |
| `messenger_url` | FloatingChat | |
| `bct_url` | Footer | |
| `seo_home_title`, `seo_home_description`, `og_image_url`, `seo_home_h1` | `app/page.tsx` metadata + H1 | |
| `promo_title`, `promo_off`, `promo_href`, `promo_image_url` | `app/page.tsx` hero promo | |
| `home_exp_subtitle/title/desc` | `app/page.tsx` exp section | |
| `about_title`, `about_subtitle`, `about_content_html` | `app/page.tsx` (`hasSettingsAbout`) | ❌ KHÔNG seed ở migration nào, KHÔNG có trong admin UI labels |
| `home_content_bottom_html` | `app/page.tsx` bottom block | ❌ KHÔNG seed, KHÔNG có trong admin UI |
| `address` (raw) | `app/page.tsx` localBusiness JSON-LD | ❌ KHÔNG có (chỉ có `contact_address`) → JSON-LD luôn rỗng |
| `phone` (raw, fallback) | `app/page.tsx` | OK fallback to "" |

#### Findings:

- **`youtube_url`, `tiktok_url`, `instagram_url`** chỉ seed ở dev (V1004). Production sẽ không có → social block không hiển thị. Admin không có label cho 3 key này nhưng vẫn render được nếu key tồn tại → có thể tạm sống được nếu admin manual SQL insert. P2.
- **`about_*`, `home_content_bottom_html`** code path vẫn còn trong `app/page.tsx` nhưng key chưa từng được seed → block không bao giờ render. Dead code path / hoặc migration cần thêm. P2.
- **`address` (key thô)** → JSON-LD localBusiness sẽ luôn `address=""`. P2 SEO.

### Quote-stripping

- Footer: `normalizeSettingValue` ([SiteFooter.tsx:23-29](../../bigbike-web/components/layout/SiteFooter.tsx#L23-L29)) strip quotes ✅
- `app/page.tsx`'s `findSetting` ([page.tsx:89-94](../../bigbike-web/app/page.tsx#L89-L94)) **KHÔNG strip quotes** → nếu admin dùng key `site.name` (legacy quoted) làm SEO title, sẽ render `"BigBike Title"` (có dấu nháy). P3.
- FloatingChatLoader: dùng `setting.settingValue.trim()` thẳng — không strip quotes ([FloatingChatLoader.tsx:11](../../bigbike-web/components/layout/FloatingChatLoader.tsx#L11)). P3.
- lien-he: dùng `pickSetting` không strip quotes ([lien-he/page.tsx:17-20](../../bigbike-web/app/lien-he/page.tsx#L17-L20)). P3.

### XSS / iframe risk: xem mục 7. P1.

---

## 10. Test Coverage Audit

### Backend ([Phase1JAdminSettingsMenuCouponApiTest.java](../../bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1JAdminSettingsMenuCouponApiTest.java))

**Kết quả hiện tại: 83 tests, 0 failures, 0 errors** (toàn bộ test suite bao gồm Menu, Coupon và Settings).

| Behavior | Covered? | Test method | Priority |
|---|---|---|---|
| No auth → 401 | ✅ | `adminSettings_withoutToken_returns401` | — |
| Permission missing → 403 | ❌ | — | P2 backlog |
| `settings.read` allowed list | ✅ | `adminSettings_withAdminToken_returnsList` | — |
| Filter by `group` | ✅ | `adminSettings_filterByGroup` | — |
| Filter by `q` | ❌ | — | P3 backlog |
| Filter by `isPublic` | ❌ | — | P3 backlog |
| GET by key — success | ✅ | `adminSettings_getByKey_returnsDetail` | — |
| GET by key — not found 404 | ❌ | — | P3 backlog |
| PATCH value | ✅ | `adminSettings_updateValue_succeeds` | — |
| Sensitive key cannot become public | ✅ | `adminSettings_sensitiveKey_cannotBePublic`, `updateSetting_apiKeyCannotBePublic`, `updateSetting_clientSecretCannotBePublic` | — |
| Public endpoint returns only public | ✅ | `publicSettings_returnsOnlyPublicSettings` | — |
| Public endpoint rejects unregistered key (strict allowlist) | ✅ **Phase B** | `publicSettings_unregisteredPublicKey_filteredByAllowlist` | — |
| Sensitive value masked trong admin GET | ✅ **Phase B** | `adminSettings_sensitiveValue_maskedOnGet` | — |
| Non-sensitive not masked, `valueType` returned | ✅ **Phase B** | `adminSettings_nonSensitiveValue_notMasked` | — |
| Invalid email → 400 | ✅ **Phase B** | `adminSettings_invalidEmail_returns400` | — |
| Invalid phone → 400 | ✅ **Phase B** | `adminSettings_invalidPhone_returns400` | — |
| Invalid URL → 400 | ✅ **Phase B** | `adminSettings_invalidUrl_returns400` | — |
| Invalid boolean → 400 | ✅ **Phase B** | `adminSettings_invalidBoolean_returns400` | — |
| Integer out of range → 400 | ✅ **Phase B** | `adminSettings_integerOutOfRange_returns400` | — |
| Invalid enum → 400 | ✅ **Phase B** | `adminSettings_invalidEnum_returns400` | — |
| Decimal out of range → 400 | ✅ **Phase B** | `adminSettings_decimalOutOfRange_returns400` | — |
| Registered non-public key cannot be set isPublic=true | ✅ **Phase B** | `adminSettings_registeredNonPublicKey_isPublicTrue_rejected` | — |
| Unregistered key cannot be set isPublic=true | ✅ **Phase B** | `adminSettings_unregisteredKey_isPublicTrue_rejected` | — |
| Registered key valid update succeeds + valueType returned | ✅ **Phase B** | `adminSettings_validUpdateOnRegisteredKey_succeeds` | — |
| Unregistered key accepts arbitrary value | ✅ **Phase B** | `adminSettings_unregisteredKey_anyValueAccepted` | — |
| google_maps_url non-Google domain → 400 | ✅ **Phase B.1** | `adminSettings_googleMapsUrl_nonGoogle_returns400` | — |
| google_maps_url valid Google Maps URL → 200 | ✅ **Phase B.1** | `adminSettings_googleMapsUrl_googleMaps_succeeds` | — |
| google_maps_url subdomain hijack → 400 | ✅ **Phase B.1** | `adminSettings_googleMapsUrl_googleComEvil_returns400` | — |
| Audit log masks sensitive value (before + after) | ✅ **Phase B.1** | `adminSettings_auditLog_masksSensitiveValue` | — |
| Batch update all valid → 200, all updated | ✅ **Phase C** | `adminSettings_batchUpdate_allValid_succeeds` | — |
| Batch update one invalid → 400, no setting changed | ✅ **Phase C** | `adminSettings_batchUpdate_oneInvalid_rollsBack` | — |
| Web revalidation gọi sau update | ❌ | — | P2 backlog |
| Pagination — page=2, size=N | ❌ | — | P3 backlog |
| PATCH key not found → 404 | ❌ | — | P3 backlog |
| Race / concurrent update conflict | ❌ | — | P3 backlog (optimistic lock chưa có) |

**Coverage estimate trước audit: ~36% (9/25).  
Coverage hiện tại: ~70%+ cho behavior đã implement.**

### Frontend (admin & web)

❌ **Vẫn không có test nào** cho Settings module ở cả `bigbike-admin` lẫn `bigbike-web`. **P2 backlog.**

Cần bổ sung (sau):
- Vitest unit cho `validateValue`, `displayValue`, `inputTypeFor`, `placeholderFor`, `tabLabel`
- React Testing Library: render modes (canUpdate true/false), `batchUpdateSettings` mock, success toast, error path
- Public web: `__tests__/components/SiteFooter` snapshot với settings mẫu

### End-to-end

❌ Không có. **P2 backlog.**

Priority e2e flow:
1. Login admin → vào `/admin/settings` → đổi nhiều field cùng tab → Lưu (batch) → success toast
2. Goto bigbike-web `/` → assert giá trị mới hiển thị (sau revalidate)
3. Force-attempt set `payment_*.token` isPublic=true → 400
4. Verify SHOP_MANAGER bị 403 khi gọi `/api/v1/admin/settings`

---

## 11. Findings

### ✅ FIXED Phase A — ~~[P0] Iframe URL từ public setting cho phép XSS / cookie exfiltration trên `bigbike-web/lien-he`~~

- **Fix đã apply:** `lien-he/page.tsx` — match key chính xác (`setting.settingKey === "google_maps_url"`), domain allowlist (chỉ `www.google.com` / `maps.google.com`), bỏ `allow-same-origin` khỏi sandbox.
- **Backend defense-in-depth (Phase B.1):** `SettingValueValidator.validateGoogleMapsUrl()` từ chối save nếu URL không phải Google Maps hợp lệ — attacker không thể đưa URL xấu vào DB ngay cả khi bypass FE.
- **Remaining:** Unit test FE cho `lien-he/page.tsx` (P2 backlog).

---

### ✅ FIXED Phase B — ~~[P1] Backend không validate type của setting value~~

- **Fix đã apply:** `SettingDefinitionRegistry` (38 keys), `SettingValueValidator` (12 type), tích hợp vào `updateSetting` và `batchUpdateSettings`. Unregistered keys vẫn pass để backward compat.
- **Tests added (Phase B):** PB4–PB10 cover email/phone/URL/boolean/integer/decimal/enum validation.
- **Remaining:** Typed controls trên FE (P2 backlog).

---

### ✅ FIXED Phase B + B.1 — ~~[P1] Không mask sensitive value trong admin response~~

- **Fix đã apply:** `toAdminResponse` → `settingValue="********"`, `sensitive=true`, `masked=true` khi key sensitive. `snapshot()` (audit log) cũng mask. `AdminSiteSettingResponse` có 3 field mới backward-compatible.
- **Tests added:** PB2 (admin GET masked), PB.4 (audit log masked).
- **Remaining:** FE input `type=password` + eye-toggle cho sensitive field (P2 backlog). `X-Reveal-Secret` header nếu cần (P3 backlog).

---

### ❌ OPEN (P1 backlog, cross-module) — [P1] Dynamic role permissions (V49) là decorative — không được consult ở runtime

- **Status:** Chưa fix. Nằm ngoài scope Phase A/B/B.1/C (no RBAC refactor per spec).
- **Evidence vẫn còn nguyên:** `requirePermission` vẫn đọc `AdminRolePermissions.MAP` hardcoded; UI Roles không có tác dụng runtime.
- **Risk hiện tại:** Moderate — hardcoded MAP đúng cho các role hiện tại (ADMIN/SHOP_MANAGER). Impact thực tế chỉ xảy ra nếu admin muốn thay đổi permission qua UI → UI cho phép nhưng backend không phản ánh.
- **Backlog action:** Refactor `requirePermission` đọc qua `AdminRoleService` + cache; seed `pos.*`/`receivables.*` vào `role_permissions`; integration test DB-driven permission.

---

### ✅ FIXED Phase C — ~~[P1] Partial-save risk khi UI gửi nhiều PATCH song song~~

- **Fix đã apply:**
  - Backend: `PATCH /api/v1/admin/settings` (không path variable) — validate-all-first trong Phase 1 trước khi chạm DB, save-all trong Phase 2 dưới `@Transactional`. 400 nếu bất kỳ item nào invalid, không có partial save.
  - Frontend: `batchUpdateSettings()` trong `adminApi.js`; `handleSave` trong `SettingsScreen.jsx` gọi 1 request thay `Promise.all`.
- **Tests added (Phase C):** PC1 (all valid → 200 + both updated), PC2 (one invalid → 400 + no change).
- **Remaining:** Field-level error mapping từ batch response (server trả `failures: [{key, code}]`) — hiện tại error gán cho tất cả dirty fields (P2 backlog). Audit log dùng individual `SETTING_UPDATED` entries — không gộp thành `SETTINGS_BATCH_UPDATED` (P3 backlog, informational only).

---

### ✅ FIXED Phase A — ~~[P1] FE mock dùng `settings.update` thay vì `settings.write`~~

- **Fix đã apply:** `mockData.js` đã được sửa `'settings.update'` → `'settings.write'`. Mock ADMIN role trong FORCE_MOCK mode hiện có đủ permission để SettingsScreen render editable.
- **Remaining:** Unit test cho `buildMockAdminUser('ADMIN')` (P3 backlog).

---

### [P2] Group casing không nhất quán giữa các migration

- **Evidence:** V18/V22/V23/V24/V32/V40/V48 dùng lowercase (`general`, `contact`, `public_home`, `seo`); V29 dùng UPPERCASE (`TAX`, `STORE`, `SECURITY`); V1001 dev có thêm group `commerce`.
- **Impact:** FE buộc phải normalize bằng `(group||'GENERAL').toUpperCase()` ở cả admin và public web. Test/seed mới có thể lập lại lỗi này. SQL filter `WHERE setting_group = 'tax'` sẽ miss row.
- **Root cause:** Convention không được thiết lập từ đầu.
- **Recommended fix:**
  1. Migration mới (V76) `UPDATE site_settings SET setting_group = LOWER(setting_group)` (hoặc UPPER, chọn 1).
  2. Add CHECK constraint `setting_group ~ '^[a-z_]+$'`.
  3. Update doc `docs/engineering/DATA_CONTRACT.md` ghi rõ convention.
- **Suggested tests:** repo test: assert tất cả `setting_group` ở cùng casing.

---

### [P2] Entity field `setting_group` cho phép null nhưng DB schema NOT NULL

- **Evidence:**
  - [SiteSettingEntity.java:26-27](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/settings/SiteSettingEntity.java#L26-L27): `@Column(name = "setting_group", length = 100) private String settingGroup;` (default nullable=true)
  - [V5__create_commerce_settings_tables.sql:65](../../bigbike-backend/src/main/resources/db/migration/V5__create_commerce_settings_tables.sql#L65): `setting_group varchar(100) not null`
  - [AdminSettingsService.java:115](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSettingsService.java#L115): `entity.setSettingGroup(req.group().isBlank() ? null : req.group());`
- **Impact:** Nếu admin gửi `group: ""`, service set null → DB raise generic `PSQLException: null value in column ... violates not-null constraint` thay vì 400 đẹp.
- **Recommended fix:**
  1. Service: nếu blank → từ chối với 400 hoặc giữ nguyên `entity.getSettingGroup()`.
  2. Entity: đổi `@Column(... nullable=false)` cho khớp schema.
- **Suggested tests:** PATCH `{group: ""}` → 400 (không phải 500).

---

### [P2] Settings consume bởi web nhưng không seed trong migration prod

- **Evidence:**
  - [app/page.tsx:290-294](../../bigbike-web/app/page.tsx#L290-L294) đọc `about_title`, `about_subtitle`, `about_content_html`, `home_content_bottom_html` — không có migration nào seed.
  - [app/page.tsx:306](../../bigbike-web/app/page.tsx#L306) đọc `address` thô — chỉ có `contact_address` trong DB.
  - SiteFooter đọc `youtube_url`/`tiktok_url`/`instagram_url` — chỉ seed dev V1004.
- **Impact:**
  - About/home_content_bottom block không bao giờ render trên prod (silent fallback).
  - Social block thiếu YouTube/TikTok/Instagram trên prod.
  - LocalBusiness JSON-LD `address=""` → SEO thiệt thòi.
- **Root cause:** Code path web đi trước migration; prod migration chưa catch up.
- **Recommended fix:**
  1. Tạo migration V76 seed: `youtube_url`, `tiktok_url`, `instagram_url` (group=contact, public, value rỗng).
  2. Quyết định: hoặc seed `about_*` keys hoặc xoá code path từ `app/page.tsx`.
  3. Đổi `findSetting(settings, "address")` → `"contact_address"`.
  4. Bổ sung `KEY_LABELS_VI` cho 3 social URL trong [SettingsScreen.jsx](../../bigbike-admin/src/screens/SettingsScreen.jsx).
- **Suggested tests:** snapshot test SiteFooter với fixture đầy đủ social URLs.

---

### [P2] List settings load all rows then filter in-memory

- **Evidence:** [AdminSettingsService.java:59](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSettingsService.java#L59):
  ```java
  Stream<SiteSettingEntity> stream = settingRepo.findAll().stream();
  ```
- **Impact:** Hiện ~30 settings nên không vấn đề. Nếu mở rộng (multi-store, multi-locale) >1000 rows + filter sẽ chậm và tốn memory.
- **Recommended fix:** Dùng Spring Data Pageable + Specification (q LIKE, group =, isPublic =) → DB filter, sau đó paginate ở DB.
- **Suggested tests:** sau khi refactor, performance test với 1000 settings → response < 200ms.

---

### [P2] `tax_label` & `store_currency` được seed `is_public=true` nhưng admin UI ẩn

- **Evidence:** V29 seed `tax_label` và `store_currency` với `is_public=true` ([V29:43-47](../../bigbike-backend/src/main/resources/db/migration/V29__seed_tax_and_inventory_settings.sql#L43-L47), [V29:26-31](../../bigbike-backend/src/main/resources/db/migration/V29__seed_tax_and_inventory_settings.sql#L26-L31)). Admin UI ẩn 2 key này ([SettingsScreen.jsx:90](../../bigbike-admin/src/screens/SettingsScreen.jsx#L90)).
- **Impact:** Admin không thể chỉnh `store_currency` qua UI nhưng public web có thể đọc thấy nó. Đây là design choice "default luôn đúng cho VN" nhưng tạo hidden state. Nếu chuyển sang multi-currency / multi-tenant trong tương lai, hidden config sẽ là điểm mù.
- **Recommended fix:**
  1. Hoặc giữ ẩn nhưng đảm bảo `is_public=false` (vì web không cần public read).
  2. Hoặc bỏ ẩn khỏi UI và cho phép sửa với cảnh báo.
- **Suggested tests:** consistency check: mọi key trong HIDDEN_KEYS đều `is_public=false`.

---

### [P2] FE save error gán cho TẤT CẢ field dirty

- **Evidence:** [SettingsScreen.jsx:358-361](../../bigbike-admin/src/screens/SettingsScreen.jsx#L358-L361):
  ```js
  setErrors((p) => ({ ...p, ...Object.fromEntries(dirty.map((s) => [s.key, errMsg])) }))
  ```
- **Impact:** Khi 1 request fail (vì lý do của 1 key), tất cả field dirty đều hiển thị error đỏ — admin không biết key nào sai.
- **Recommended fix:** Sau khi triển batch endpoint, server trả `{ failures: [{key, code, message}] }` → FE map error theo key.
- **Suggested tests:** UI test: 1 trong 3 PATCH fail → chỉ field tương ứng đỏ.

---

### [P2] Audit snapshot build JSON thủ công, không robust

- **Evidence:** [AdminSettingsService.java:169-183](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSettingsService.java#L169-L183):
  ```java
  return "{\"key\":\"" + escapeJson(s.getSettingKey()) + ...
  ```
  `escapeJson` chỉ escape `\\` và `"` — không escape `\n`, `\r`, `\t`, control chars, unicode.
- **Impact:** Setting value chứa newline/tab/control char → audit log JSON broken (audit-logs UI parse fail).
- **Recommended fix:** dùng `ObjectMapper.writeValueAsString(...)` (đã có Jackson trong classpath).
- **Suggested tests:** update setting với value `"line1\nline2"` → audit_logs.before_data parse được bằng JsonNode.

---

### [P2] `DEV_ADMIN_ID` fallback trong production path

- **Evidence:** [AdminSettingsController.java:31, 81-87](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminSettingsController.java#L81-L87):
  ```java
  private static final UUID DEV_ADMIN_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
  ...
  return DEV_ADMIN_ID; // when AdminPrincipal is missing
  ```
- **Impact:** Trong prod path (JWT auth), `SecurityContextHolder` luôn có AdminPrincipal nên fallback không xảy ra. Nhưng fallback tồn tại là code smell và sẽ kích hoạt nếu controller được gọi qua dev-bypass — audit log ghi nhầm `actor_id=DEV_ADMIN_ID` thay vì user thật.
- **Recommended fix:**
  - Production path: nếu không lấy được AdminPrincipal → throw `UnauthorizedException`.
  - Dev path: ghi rõ `actor_type='DEV'` thay vì `'ADMIN'`.
- **Suggested tests:** call PATCH với token nhưng AdminPrincipal mismatch → 401.

---

### [P3] FE mock key dùng `settings.update` (không phải mismatch chính, đã list ở P1 mismatches)

→ Đã ghi ở P1.

---

### [P3] `findSetting` ở `app/page.tsx` không strip quotes

- **Evidence:** [app/page.tsx:89-94](../../bigbike-web/app/page.tsx#L89-L94)
- **Impact:** Nếu admin lỡ paste giá trị dạng `"BigBike SEO Title"` (legacy V1001 dev format) → `<title>"BigBike SEO Title"</title>` có dấu nháy.
- **Recommended fix:** dùng helper `normalizeSettingValue` chung từ `lib/utils/settings.ts` (cần tạo) cho cả Footer/Header/page.

---

### [P3] Documentation drift

- `docs/business/BUSINESS_RULES.md`, `docs/engineering/API_CONTRACT.md`, `docs/engineering/PERMISSION_MATRIX.md` cần verify có entry cho:
  - SETTING_RULE_xxx (Sensitive key cannot be public)
  - API_SETTING_GET/PATCH endpoints
  - Permission `settings.read`/`settings.write`
- Audit này không kiểm tra `docs/`. **Cần follow-up.**

---

## 12. Completion Checklist

| Item | Status | Phase |
|---|---|---|
| Route `/admin/settings` | ✅ | Pre-audit |
| Permission gate FE | ✅ | Pre-audit |
| Permission gate BE controller | ✅ | Pre-audit |
| URL gate SecurityConfig | ✅ | Pre-audit |
| Loading/error/empty/retry | ✅ | Pre-audit |
| Dirty state + Save/Discard | ✅ | Pre-audit |
| Save success feedback | ✅ | Pre-audit |
| Save error feedback (field-level) | ⚠️ Vẫn gán cho tất cả dirty fields | P2 backlog |
| FE validation (inline) | ⚠️ Yếu nhưng đủ cho UX cơ bản | P2 backlog |
| BE typed validation | ✅ | Phase B |
| google_maps_url domain allowlist (BE) | ✅ | Phase B.1 |
| Sensitive key block public (strict allowlist) | ✅ | Phase B |
| Sensitive value masking trong admin response | ✅ | Phase B |
| Audit log mask sensitive values | ✅ | Phase B.1 |
| FE mock permission key (`settings.write`) | ✅ | Phase A |
| Batch update endpoint (all-or-nothing) | ✅ | Phase C |
| FE dùng batch endpoint | ✅ | Phase C |
| iframe URL allowlist + sandbox fix | ✅ | Phase A |
| Audit log on update | ✅ (JSON build string thủ công) | Pre-audit |
| Audit JSON robust (ObjectMapper) | ❌ | P2 backlog |
| Web revalidation tag `settings` | ✅ | Pre-audit |
| After-commit revalidation | ✅ | Pre-audit |
| Public endpoint không leak `description`/`isPublic` | ✅ | Pre-audit |
| Public endpoint strict allowlist (registry-driven) | ✅ | Phase B |
| DB schema + indexes | ✅ | Pre-audit |
| DB unique key | ✅ | Pre-audit |
| Group casing nhất quán (DB) | ❌ | P2 backlog |
| Entity ↔ DB nullability khớp (`setting_group`) | ❌ | P2 backlog |
| Pagination DB-side | ❌ (in-memory) | P2 backlog |
| Public/private/sensitive badge UI | ❌ | P2 backlog |
| Typed control UI (switch/picker/textarea) | ❌ | P2 backlog |
| FE input type=password cho sensitive | ❌ | P2 backlog |
| Dynamic role permissions thực sự được consult | ❌ | P1 backlog (cross-module) |
| DEV_ADMIN_ID fallback cleanup | ❌ | P2 backlog |
| Backend test coverage | ✅ 83 tests / ~70%+ behavior covered | Phase B+B.1+C |
| FE test coverage | ❌ 0% | P2 backlog |
| E2E test admin↔BE↔web | ❌ 0% | P2 backlog |
| Quote-stripping consistent ở web | ⚠️ Footer có, `page.tsx` không có | P3 backlog |
| Settings consumed by web nhưng không seed (`youtube_url`, `about_*`, ...) | ⚠️ Silent fallback trên prod | P2 backlog |
| `API_CONTRACT.md` cập nhật | ✅ | Phase C |

Legend: ✅ Done · ⚠️ Partial · ❌ Missing

---

## 13. Final Verdict

**Module Settings hiện đạt khoảng 70 % production-ready cho luồng hiện tại** (admin sửa value cơ bản, public web đọc read-only).

### KHÔNG được phép giao cho AI agent code tiếp ngay nếu:
- Còn thiếu **typed validation** + **secret masking** + **iframe allowlist** (P0/P1 security/correctness blockers).
- Permission model còn tự mâu thuẫn (V49 decorative).

### Bắt buộc phải làm trước khi production:
1. **P0** Allowlist iframe URL ở `lien-he/page.tsx` (~30 phút).
2. **P1** Triển khai `SettingDefinitionRegistry` + typed validation + sensitive masking.
3. **P1** Hoặc consult DB role_permissions, hoặc xoá V49/AdminRoleService UI để tránh false security.
4. **P1** Batch update endpoint hoặc disable parallel save trong FE.
5. **P1** Sửa mismatch `settings.update` → `settings.write` ở mockData.

### Có thể defer (nice-to-have):
- DB-side pagination khi >100 settings.
- Group casing migration normalize.
- Audit JSON robust với Jackson.
- `DEV_ADMIN_ID` cleanup.
- FE tests + e2e test.
- `about_*` / `home_content_bottom_html` quyết định seed hay xoá code path.

---

## 14. Suggested Implementation Plan

### Phase A — Security & validation hardening (P0/P1, ~3 ngày)

**Goal:** Đóng các lỗ hổng có thể leak data hoặc làm hỏng business logic.

1. Đổi [`bigbike-web/app/lien-he/page.tsx`](../../bigbike-web/app/lien-he/page.tsx) iframe:
   - Match key chính xác `setting.settingKey === "google_maps_url"`.
   - Allowlist origin `^https://(www\.)?google\.com/maps`.
   - Bỏ `allow-same-origin` (chỉ giữ `sandbox="allow-scripts"`) hoặc đổi sang `<a>` link.
2. Tạo `SettingDefinition` class + registry:
   ```
   bigbike-backend/.../service/admin/SettingDefinitionRegistry.java
   ```
   - Map<String, SettingDefinition> với 30+ key hiện có.
   - Type, range, regex, allowedValues, isSensitive, isPublicAllowed.
3. Refactor `AdminSettingsService.updateSetting`:
   - Validate `req.value()` qua registry → `ValidationException` nếu sai.
   - Check `isPublicAllowed` thay vì substring blacklist.
4. Mask trong `toAdminResponse`: nếu `isSensitive` → `settingValue = "*****"` trừ khi user có perm `settings.reveal_secret`.
5. Sửa entity `SiteSettingEntity.settingGroup` sang `nullable=false`; sửa service không set null.
6. Sửa [`adminApi.js`](../../bigbike-admin/src/lib/adminApi.js) updateSetting trả thêm `definition` metadata; FE render type-aware control.

### Phase B — FE UX (P1/P2, ~2 ngày)

1. Thêm typed controls: switch/number/textarea/url/email/select theo `definition.type`.
2. Hiển thị badge public/private/secret bên cạnh field.
3. Mask + eye-toggle cho sensitive value.
4. Field-level error mapping (cần Phase C batch endpoint).
5. Sửa [mockData.js](../../bigbike-admin/src/lib/mockData.js) `'settings.update'` → `'settings.write'`.
6. Bổ sung KEY_LABELS_VI cho `youtube_url`, `tiktok_url`, `instagram_url`.

### Phase C — Backend registry + batch + dynamic roles (P1, ~3 ngày)

1. Endpoint `PATCH /api/v1/admin/settings/batch` (transactional, all-or-nothing).
2. FE đổi sang gọi batch.
3. Refactor `requirePermission` đọc qua `AdminRoleService.getPermissionsForRole(role)` (cache 60s).
4. Migration V76 seed `pos.*`, `receivables.*` cho ADMIN/SHOP_MANAGER vào `role_permissions`.
5. Audit JSON dùng `ObjectMapper`.
6. Loại bỏ fallback `DEV_ADMIN_ID` ở production path.

### Phase D — Tests, e2e, docs (~2 ngày)

1. Backend tests cho missing behavior (mục 10): typed validation, audit, revalidation, batch, pagination, 403, 404.
2. FE Vitest unit + RTL component tests.
3. Playwright e2e: admin → BE → public web tag invalidation.
4. Update `docs/engineering/API_CONTRACT.md` (settings batch endpoint), `docs/engineering/DATA_CONTRACT.md` (group casing), `docs/business/BUSINESS_RULES.md` (sensitive setting rule).

### Phase E — Cleanup (P2/P3, ~1 ngày)

1. Migration V76 normalize `setting_group` casing.
2. Migration V76 seed missing public web keys (`youtube_url` etc.) hoặc xoá code path web.
3. Quote-stripping helper chung cho web (`lib/utils/settings.ts`).
4. Optional: DB-side pagination với Specification.

---

## Audit Commands Run

```bash
rg -n "settings.read|settings.write|settings.update|SettingsScreen|fetchSettings|updateSetting" bigbike-admin bigbike-backend bigbike-web
# → confirmed: mock uses `settings.update`, all other places use `settings.write`

rg -n "site_settings|setting_key|setting_value|setting_group|is_public" bigbike-backend/src/main/resources/db
# → 14 migrations touch site_settings (listed in section 2)

rg -n "/api/v1/admin/settings|/api/v1/settings/public|PublicSettingsController|AdminSettingsController" bigbike-backend
# → confirmed routes match doc spec

rg -n "listPublicSettings|footer_tagline|site_name|zalo_url|seo_home_title|promo_title|google_maps_url" bigbike-web bigbike-admin bigbike-backend
# → cross-referenced consumed keys in section 9
```

---

*— End of audit —*
