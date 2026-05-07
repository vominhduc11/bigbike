# Settings Module Completion Audit

> Audit ngày 2026-05-07 — read-only inspection, no source code modification.
> Mục tiêu: đánh giá module **Settings / Cài đặt** đã production-ready chưa, đối chiếu admin FE ↔ backend ↔ public web ↔ DB ↔ tests.

---

## 1. Executive Summary

**Kết luận: Module Settings GẦN HOÀN THIỆN nhưng CHƯA production-ready.**

| Trục | Trạng thái |
|---|---|
| Route + UI Settings | ✅ Đã có, ổn |
| Permission gate (`settings.read` / `settings.write`) | ✅ Đã có |
| Backend CRUD + endpoint | ✅ Đã có |
| Public endpoint + revalidation | ✅ Đã có |
| Audit log trên update | ✅ Có |
| Sensitive key block public | ✅ Có |
| **Validation theo type** (boolean/number/URL/email) | ❌ Thiếu hoàn toàn ở backend |
| **Mask sensitive setting** trong response | ❌ Không có |
| **Dynamic role permissions** (V49) ↔ check thực tế | ❌ Decorative — không được consult |
| **Mock vs live permission key** | ❌ `settings.update` (mock) vs `settings.write` (live) |
| **iframe URL từ setting** ở `lien-he` page | ❌ Không có domain allowlist |
| **Group casing** trong DB | ⚠️ Không nhất quán (`general` vs `TAX`) |
| **Test coverage** | ⚠️ Chỉ 9/~25 hành vi cần thiết |
| **Không có UI cho create/delete setting** | ⚠️ Theo design, nhưng không có batch update → rủi ro partial save |

**Risk level cho deploy production HÔM NAY: HIGH (P0+P1 blockers tồn tại).**

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
| Public/private/sensitive badge | ❌ Không hiển thị | UI không show `isPublic` |
| Mask secret value | ❌ Không có | input bình thường, không có toggle "show/hide" |
| Typed controls (switch/number/textarea/URL/media-picker) | ❌ Không có — dùng `<input type=text|email|url|tel|number>` | [SettingsScreen.jsx:21-38](../../bigbike-admin/src/screens/SettingsScreen.jsx#L21-L38) |
| Save nhiều dirty field bằng `Promise.all(updateSetting)` song song | ⚠️ **Rủi ro partial save** — nếu 3 field, request 2 fail thì 1 và 3 vẫn lưu | [SettingsScreen.jsx:336-338](../../bigbike-admin/src/screens/SettingsScreen.jsx#L336-L338) |
| Accessibility (aria-describedby, aria-current) | ✅ | [SettingsScreen.jsx:175, 413](../../bigbike-admin/src/screens/SettingsScreen.jsx#L175) |
| Responsive | ❓ Chưa verify runtime — code có CSS class nhưng không kiểm chứng |

---

## 5. API Contract Audit

### Admin endpoints

| Method | Path | Request | Response | Permission | Validation | Status |
|---|---|---|---|---|---|---|
| GET | `/api/v1/admin/settings` | `?page,size,q,group,isPublic` | `{ data: AdminSiteSettingResponse[], pagination }` | `settings.read` | min/max int validators bằng `@Min/@Max` | ✅ |
| GET | `/api/v1/admin/settings/{settingKey}` | — | `{ data: AdminSiteSettingResponse }` | `settings.read` | — | ✅ |
| PATCH | `/api/v1/admin/settings/{settingKey}` | `{ value?, group?, isPublic?, description? }` | `{ data: AdminSiteSettingResponse }` | `settings.write` | **Chỉ check sensitive→public** ([AdminSettingsService.java:104-107](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSettingsService.java#L104-L107)) — KHÔNG có type validation | ⚠️ |

### Public endpoint

| Method | Path | Request | Response | Permission | Status |
|---|---|---|---|---|---|
| GET | `/api/v1/settings/public` | — | `{ data: PublicSiteSettingResponse[] }` (chỉ `key/value/group`) | permitAll ([SecurityConfig.java:91](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java#L91)) | ✅ |

### Missing endpoints (theo spec yêu cầu nhưng không có)
- ❌ POST `/api/v1/admin/settings` — create new setting
- ❌ DELETE `/api/v1/admin/settings/{key}` — delete setting
- ❌ POST `/api/v1/admin/settings/batch` — atomic bulk update

→ Quyết định "không cho create/delete" có thể là design choice (settings được seed bằng migration). Nhưng **không có batch update** trong khi FE save song song nhiều request → **partial-save risk**.

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

### BE validation

**Hoàn toàn không có type validation** trong [`AdminSettingsService.updateSetting`](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSettingsService.java#L98-L130).

- `req.value()` được set thẳng vào `entity.setSettingValue(req.value())` mà không kiểm:
  - `tax_rate`: không kiểm phải decimal `0..1`
  - `tax_enabled`/`tax_inclusive`: không kiểm phải `true|false`
  - `low_stock_threshold`/`order_min_amount`: không kiểm phải integer ≥ 0
  - `*_url`/`facebook_url`/`google_maps_url`: không kiểm phải URL hợp lệ
  - `contact_email`: không kiểm format email
  - `hotline*`: không kiểm format phone

→ **P1**: ai có `settings.write` có thể đặt `tax_rate = "abc"` hoặc `low_stock_threshold = "negative"` → checkout/inventory tính sai.

### Sensitive setting protection

- `SENSITIVE_KEY_FRAGMENTS`: `secret, password, token, privatekey, private_key, api_key, apikey, accesskey, access_key, client_secret, clientsecret` ([AdminSettingsService.java:30-33](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSettingsService.java#L30-L33))
- Block: chỉ áp dụng ở **set isPublic=true** cho key sensitive → ngăn leak qua public endpoint.
- ❌ KHÔNG mask `settingValue` trong **admin response** — bất cứ user nào có `settings.read` đều thấy plaintext value của các key chứa `token`/`secret`. (P1)
- ❌ Detection bằng **blacklist substring** — dễ thiếu (`smtp_pass`, `mailgun_key`, `recaptcha_site_key`, ...).

### XSS / Open redirect / iframe risk (`bigbike-web`)

[`app/lien-he/page.tsx:38-43,107-122`](../../bigbike-web/app/lien-he/page.tsx#L38-L122):

```tsx
const mapUrl = pickSetting(publicSettings, [/map/i, /iframe/i, /google_maps?/i]);
const canEmbedMap = /^https?:\/\//i.test(mapUrl);
// ...
<iframe src={mapUrl} sandbox="allow-scripts allow-same-origin" />
```

→ **P1**:
- Regex match khá lỏng: `/map/i` match cả `sitemap_url`, `imap_*` v.v.
- Không có domain allowlist (chỉ check `^https?:`)
- `sandbox="allow-scripts allow-same-origin"` về kỹ thuật **không phải sandbox** (combo allow-scripts + allow-same-origin = iframe có full quyền của bigbike.vn origin → có thể chạy XHR đến `/api/...` nội bộ).
- Bất cứ ai có `settings.write` có thể set `google_maps_url` → một trang phishing → tải JS iframe → đánh cắp session từ bigbike.vn cookies (vì same-origin).

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

| Behavior | Covered? | Test file/method | Recommendation |
|---|---|---|---|
| No auth → 401 | ✅ | `adminSettings_withoutToken_returns401` | — |
| Permission missing → 403 | ❌ | — | thêm test với role=EDITOR/CONTRIBUTOR call list/get/patch → 403 |
| `settings.read` allowed list | ✅ | `adminSettings_withAdminToken_returnsList` | — |
| Filter by `group` | ✅ | `adminSettings_filterByGroup` | — |
| Filter by `q` | ❌ | — | thêm test |
| Filter by `isPublic` | ❌ | — | thêm test |
| GET by key — success | ✅ | `adminSettings_getByKey_returnsDetail` | — |
| GET by key — not found 404 | ❌ | — | thêm test |
| PATCH value | ✅ | `adminSettings_updateValue_succeeds` | — |
| PATCH `group` | ❌ | — | thêm + verify DB constraint nếu set null/blank |
| PATCH `isPublic=true` (non-sensitive) | ❌ | — | thêm test |
| PATCH `description` | ❌ | — | thêm test |
| PATCH key not found → 404 | ❌ | — | thêm test |
| Sensitive key cannot become public | ✅ | `adminSettings_sensitiveKey_cannotBePublic`, `updateSetting_apiKeyCannotBePublic`, `updateSetting_clientSecretCannotBePublic` | — |
| Public endpoint returns only public | ✅ | `publicSettings_returnsOnlyPublicSettings` | — |
| Public endpoint masks secret nếu lỡ public | ❌ | — | có thể không cần (block trên upstream), nhưng nên có double-defense test |
| Typed validation: invalid boolean / number / URL / email | ❌ Backend không có | — | viết test sau khi triển khai SettingDefinitionRegistry |
| Audit log written sau update | ❌ | — | thêm assert `auditLogRepo.findByActionAndResource(...)` |
| Web revalidation gọi sau update | ❌ | — | thêm test với `@MockBean WebRevalidationService` để verify gọi đúng tag `"settings"` |
| Pagination — page=2, size=N | ❌ | — | thêm test |
| DB unique key constraint | ❌ | — | thêm test repo |
| Race / concurrent update conflict | ❌ | — | optimistic lock chưa có cho site_settings (V67 chỉ touch một số entity khác) |

**Coverage rating: ~9/25 ≈ 36%.** Đủ smoke nhưng thiếu nhiều invariant.

### Frontend (admin & web)

❌ **Không có test nào** cho Settings module ở cả `bigbike-admin` lẫn `bigbike-web`.

Cần bổ sung:
- Vitest unit cho `validateValue`, `displayValue`, `inputTypeFor`, `placeholderFor`, `tabLabel`
- React Testing Library:
  - render với `canUpdate=false` → không có input
  - render với `canUpdate=true` → có input + Save disabled khi chưa dirty
  - mock `fetchSettings` → thấy tabs đúng order
  - submit dirty fields → gọi `updateSetting` đúng số lần, success toast hiển thị
  - error path → field error hiển thị
- Public web: `__tests__/components/SiteFooter` snapshot với settings mẫu

### End-to-end

❌ Không có. Cần Playwright/Cypress flow:
1. Login admin → vào `/admin/settings` → đổi `footer_tagline` → save success
2. Goto bigbike-web `/` → assert footer tagline mới hiển thị (sau revalidate hoặc ép `next.revalidate`)
3. Force-attempt set `payment_*.token` isPublic=true → 400
4. Verify SHOP_MANAGER bị 403 khi gọi `/api/v1/admin/settings`

---

## 11. Findings

### [P0] Iframe URL từ public setting cho phép XSS / cookie exfiltration trên `bigbike-web/lien-he`

- **Evidence:** [bigbike-web/app/lien-he/page.tsx:38-43,107-122](../../bigbike-web/app/lien-he/page.tsx#L38-L122)
  ```tsx
  const mapUrl = pickSetting(publicSettings, [/map/i, /iframe/i, /google_maps?/i]);
  const canEmbedMap = /^https?:\/\//i.test(mapUrl);
  <iframe src={mapUrl} sandbox="allow-scripts allow-same-origin" />
  ```
- **Impact:** Bất cứ user nào có `settings.write` có thể set `google_maps_url` thành URL của trang attacker. `sandbox="allow-scripts allow-same-origin"` không phải sandbox an toàn — kết hợp 2 token này cho phép iframe truy cập `document.cookie` của origin chính (bigbike.vn). Attacker có thể đánh cắp session cookies của user truy cập trang Liên hệ.
- **Root cause:** Không có domain allowlist (chỉ check `^https?:`); regex match key quá lỏng (`/map/i` match cả `sitemap_url`); `sandbox` token combo sai.
- **Recommended fix:**
  1. Allowlist origin: chỉ chấp nhận `^https://(www\.)?google\.com/maps(/embed)?(\?|/)`.
  2. Đổi sandbox sang `sandbox="allow-scripts"` (bỏ allow-same-origin) nếu giữ iframe; hoặc render `<a href={mapUrl}>` link thay vì iframe.
  3. Match key chính xác: `setting.settingKey === "google_maps_url"` thay vì regex.
- **Suggested tests:** unit test cho `lien-he/page.tsx` với setting `google_maps_url='https://attacker.test'` → iframe không render; e2e admin set malicious URL → web không render iframe.

---

### [P1] Backend không validate type của setting value

- **Evidence:** [AdminSettingsService.updateSetting:111-113](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSettingsService.java#L111-L113):
  ```java
  if (req.value() != null) {
      entity.setSettingValue(req.value());
  }
  ```
- **Impact:** Có thể đặt `tax_rate="abc"`, `low_stock_threshold="-1"`, `tax_enabled="yes"` → checkout/inventory/UI parse sai. Vì FE validate yếu (regex 4 case), bug có thể stẩy lên prod.
- **Root cause:** Không có `SettingDefinitionRegistry` định nghĩa type cho từng key. Cả schema (text TEXT NOT NULL) và DTO đều generic.
- **Recommended fix:**
  1. Tạo `SettingDefinition` (key, type=BOOLEAN/INT/DECIMAL/MONEY/RATE/URL/EMAIL/PHONE/ENUM/TEXT, allowedValues, range, isPublicAllowed, isSensitive).
  2. Registry static (Map<String, SettingDefinition>) hoặc DB table `setting_definitions`.
  3. Trong `updateSetting`, validate `req.value()` theo definition; throw `ValidationException` nếu sai.
  4. Endpoint trả về metadata + isPublic + isSensitive cho FE để render typed control.
- **Suggested tests:** PATCH `tax_rate="abc"` → 400; `low_stock_threshold="-1"` → 400; `facebook_url="not-a-url"` → 400.

---

### [P1] Không mask sensitive value trong admin response

- **Evidence:** [AdminSiteSettingResponse.java:6-15](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/settings/AdminSiteSettingResponse.java#L6-L15) trả về `settingValue` thẳng. Không có logic mask trong [`toAdminResponse`](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSettingsService.java#L147-L153).
- **Impact:** Bất kỳ admin nào có `settings.read` đều thấy plaintext token/secret/password. Nếu sau này thêm `payment_sepay.webhook_token` (theo memo `reference_4thitek_sepay.md`), token rò rỉ qua audit-trail / network log / browser history.
- **Root cause:** Detection sensitive bằng substring chỉ áp dụng để block `isPublic=true`, không che đọc.
- **Recommended fix:**
  - Trong `toAdminResponse`, nếu `isSensitiveKey(key)` thì:
    - Nếu request không có header `X-Reveal-Secret: true` (cần extra perm `settings.reveal_secret`) → trả về `"********"` (giữ length giả).
    - Trả thêm field `isSecret: true` để FE render mask + nút "Show".
  - FE: SettingsScreen render input `type=password` cho secret + nút eye-toggle.
- **Suggested tests:** GET `/api/v1/admin/settings/{key có 'token'}` → value masked; GET với header reveal → plaintext.

---

### [P1] Dynamic role permissions (V49) là decorative — không được consult ở runtime

- **Evidence:**
  - [V49__create_roles_permissions_tables.sql:1-3](../../bigbike-backend/src/main/resources/db/migration/V49__create_roles_permissions_tables.sql#L1-L3) — comment `"Replaces hardcoded AdminRolePermissions.MAP"`.
  - [DevAdminAuthService.java:73-76](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/DevAdminAuthService.java#L73-L76) — vẫn đọc `AdminRolePermissions.MAP`.
  - [AdminAuthService.java:114-116](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminAuthService.java#L114-L116) — `permissionsForRole` cũng đọc hardcoded.
  - `AdminRoleService.getPermissionsForRole(...)` ([AdminRoleService.java:43-48](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminRoleService.java#L43-L48)) chỉ được gọi từ `AdminRolesController` cho UI display, không bao giờ vào path `requirePermission`.
- **Impact:** Admin sửa `settings.write` cho EDITOR qua UI Roles → DB ghi → reload UI hiển thị thay đổi nhưng EDITOR vẫn bị 403 thật khi gọi `/api/v1/admin/settings`. Tạo cảm giác sai về security model. Ngược lại, nếu có ngày code switch sang DB, danh sách permission `pos.*`/`receivables.*` sẽ biến mất (V49+V58 chưa seed) → ADMIN/SHOP_MANAGER mất quyền POS/Receivables.
- **Root cause:** Migration V49 thêm bảng nhưng không refactor `requirePermission` đọc bảng đó.
- **Recommended fix:**
  1. Đổi `requirePermission` đọc qua `AdminRoleService.getPermissionsForRole(role)` hoặc cache wrapper.
  2. Bổ sung migration seed `pos.*`/`receivables.*` cho ADMIN, `pos.*` + `receivables.read,record_payment` cho SHOP_MANAGER.
  3. Giữ `AdminRolePermissions.MAP` chỉ làm fallback nếu DB chưa có entry (khi seed chưa chạy).
- **Suggested tests:** integration test: set `settings.write` cho `EDITOR` qua DB → call API với JWT EDITOR → 200 (chứng minh DB-driven). Sau đó remove perm → 403.

---

### [P1] Partial-save risk khi UI gửi nhiều PATCH song song

- **Evidence:** [SettingsScreen.jsx:336-338](../../bigbike-admin/src/screens/SettingsScreen.jsx#L336-L338):
  ```js
  const results = await Promise.all(
    dirty.map((s) => updateSetting(s.key, drafts[s.key]))
  );
  ```
- **Impact:** Khi admin sửa 5 field cùng lúc và 1 request fail (ví dụ network/CSRF/server error), 4 setting đã được save vào DB và **không có rollback**. UI hiển thị error chung cho tất cả 5 field → admin tưởng không lưu nhưng thực tế đã lưu một phần. Ảnh hưởng: business config inconsistent (vd. `tax_rate` lưu nhưng `tax_enabled` chưa lưu).
- **Root cause:** Không có batch endpoint, FE dùng Promise.all.
- **Recommended fix:**
  1. Thêm endpoint `PATCH /api/v1/admin/settings/batch` nhận `{ items: [{key, value, group?, isPublic?, description?}] }`, transactional, all-or-nothing.
  2. FE đổi sang gọi 1 request batch.
  3. Audit log gộp `SETTINGS_BATCH_UPDATED` với array changes.
- **Suggested tests:** test batch happy path 3 settings → all updated; test 1 invalid value → all rolled back, không có setting nào thay đổi.

---

### [P1] FE mock dùng `settings.update` thay vì `settings.write`

- **Evidence:** [mockData.js:511](../../bigbike-admin/src/lib/mockData.js#L511): `'settings.read', 'settings.update'`. Còn lại tất cả nguồn đều dùng `settings.write`.
- **Impact:** Khi admin chạy mock auth (FORCE_MOCK), user mock có role=ADMIN nhưng permission set thiếu `settings.write` → SettingsScreen render read-only mode. Dev có thể tưởng có bug FE.
- **Root cause:** Legacy naming chưa update khi rename `update` → `write`.
- **Recommended fix:** Đổi `'settings.update'` thành `'settings.write'` trong [mockData.js:511](../../bigbike-admin/src/lib/mockData.js#L511).
- **Suggested tests:** unit test cho `buildMockAdminUser('ADMIN')` → `permissions` chứa `settings.write`.

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

| Item | Status |
|---|---|
| Route `/admin/settings` | ✅ |
| Permission gate FE | ✅ |
| Permission gate BE controller | ✅ |
| URL gate SecurityConfig | ✅ |
| Loading/error/empty/retry | ✅ |
| Dirty state + Save/Discard | ✅ |
| Save success/error feedback | ⚠️ Partial (error gán toàn field) |
| FE validation | ⚠️ Yếu |
| BE typed validation | ❌ Thiếu hoàn toàn |
| Sensitive key block public | ✅ |
| Sensitive value masking trong response | ❌ |
| Audit log on update | ✅ (nhưng JSON build không robust) |
| Web revalidation tag `settings` | ✅ |
| After-commit revalidation | ✅ |
| Public endpoint không leak `description`/`isPublic` | ✅ |
| DB schema + indexes | ✅ |
| DB unique key | ✅ |
| Group casing nhất quán | ❌ |
| Entity ↔ DB nullability khớp | ❌ |
| Pagination DB-side | ❌ (in-memory) |
| Batch update endpoint | ❌ |
| Public/private/secret badge UI | ❌ |
| Typed control UI | ❌ |
| Mock vs live permission key | ❌ |
| Dynamic role permissions thực sự được consult | ❌ |
| Backend test coverage | ⚠️ ~36% |
| FE test coverage | ❌ 0% |
| E2E test admin↔BE↔web | ❌ 0% |
| iframe URL allowlist | ❌ |
| Quote-stripping consistent ở web | ⚠️ Footer có, page.tsx không có |
| Settings consumed by web nhưng không seed | ⚠️ `youtube_url`, `tiktok_url`, `instagram_url`, `about_*`, `home_content_bottom_html`, `address` |

Legend: ✅ Done · ⚠️ Partial · ❌ Missing · ❓ Unknown

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
