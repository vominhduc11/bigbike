---
title: Menus Module — System Slot Hardening
status: RESOLVED
date: 2026-05-08
---

# Menus Module — System Slot Hardening Fix Report

## Bối cảnh

Trước fix này, module Menus của `bigbike-admin` cho phép admin **tạo mới menu container** ở location bất kỳ. Storefront (`bigbike-web`) thì lại chỉ consume menu ở 3 location cố định:

- `primary` → header
- `footer` → footer chính
- `guide` → footer guide widget

Hệ quả: nếu admin tạo location lạ (`sale-menu`, `mobile-nav`, …) → dữ liệu mồ côi, không có cách nào hiển thị; nếu admin xoá nhầm `primary/footer/guide` → header/footer mất sạch (và đã xảy ra trên DB local của user).

## Quyết định kiến trúc

> Menu container/location là **system-defined slots**, không phải dữ liệu business cho admin tạo tuỳ ý.

- Admin chỉ quản lý **menu items** bên trong 3 slot cố định.
- Việc "tạo menu container động" chỉ có ý nghĩa khi đã có cơ chế gán menu vào layout/widget/page region — hiện chưa có. Đến khi nào có CMS layout động thì mở lại tính năng.

## Allowed locations (single source of truth)

```
primary  →  Header Menu
footer   →  Footer Menu
guide    →  Buying Guide Menu
```

Constants tập trung tại [MenuLocations.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/domain/menu/MenuLocations.java). Backend, tests, migration và admin FE đều derive từ source này — không hard-code rải rác.

## Thay đổi

### Backend

| File | Thay đổi |
|---|---|
| `domain/menu/MenuLocations.java` *(new)* | Constant class với set `{primary, footer, guide}` + helper `isSystem(...)` |
| `service/admin/AdminMenuService.java#createMenu` | Validate `location` ∈ whitelist → 400 `INVALID_MENU_LOCATION` (trước duplicate check) |
| `service/admin/AdminMenuService.java#deleteMenu` | Block delete nếu `location` thuộc system → 409 `SYSTEM_MENU_CANNOT_BE_DELETED` |
| `db/migration/V84__seed_system_menu_slots.sql` *(new)* | Idempotent seed cho cả 3 system slots — recover prod DB nơi system menu đã bị xoá thủ công, đồng thời lần đầu seed `primary` cho prod (V22 chỉ seed `footer`+`guide`) |

`UpdateMenuRequest` không có field `location` → không thể đổi location qua PATCH (sẵn từ trước, không cần thay đổi).

### Admin FE — `MenuScreen.jsx`

- ❌ Bỏ button "Tạo mới Menu" / `openAddMenu` / modal create.
- ❌ Bỏ icon `Pencil` / `Trash2` ở sidebar (không cho edit/delete menu container).
- ❌ Bỏ field nhập location tự do.
- ✅ Sidebar sidebar list → **3 slot tabs cố định** (segmented cards).
- ✅ Mỗi tab hiển thị: title (system slot name, fallback display name từ DB), location badge code, mô tả, optional flag "Thiếu" / "Đang ẩn".
- ✅ Nếu DB thiếu slot (không nên xảy ra sau V84 + delete-block) → panel hiển thị warning state, không cho tạo.
- ✅ Mọi thao tác trên menu items giữ nguyên: add, edit, delete leaf, drag-reorder cùng cấp, đổi parent, target type picker, status toggle.
- ✅ `clearParentId` flow không bị phá.

### Admin FE — `lib/adminApi.js`

- Bỏ exports `createMenu`, `updateMenu`, `deleteMenu` (UI không còn consume; backend endpoint vẫn tồn tại để giữ tính tương thích test/contract).

### Admin FE — locales

- Xoá orphan keys: `empty`, `emptyDesc`, `formLocation`, `formStatus`, `formName`, `errNameRequired`, `noItemsDesc`, `deleteMenuConfirm`, `deleteMenuTitle`, `saveError`.
- Thêm: `slotPrimaryTitle/Desc`, `slotFooterTitle/Desc`, `slotGuideTitle/Desc`, `slotMissingBadge`, `slotInactiveBadge`, `slotMissingTitle`, `slotMissingDesc`.

### Tests

| Test | Trạng thái |
|---|---|
| `adminMenus_create_systemLocation_succeeds` | ✅ Updated — pre-clean rồi POST `primary` |
| `adminMenus_create_unsupportedLocation_returns400` | ✅ **NEW** — `sale-menu-XXX` → 400 `INVALID_MENU_LOCATION` |
| `adminMenus_createDuplicateLocation_returns409` | ✅ Updated — POST `footer` (đã có) → 409 |
| `createMenu_invalidStatus_returns400` | ✅ Updated — pre-clean `guide` rồi POST với bad status → 400 |
| `deleteSystemMenu_primary_returns409` | ✅ **NEW** — 409 `SYSTEM_MENU_CANNOT_BE_DELETED`, menu vẫn tồn tại |
| `deleteSystemMenu_footer_returns409` | ✅ **NEW** |
| `deleteSystemMenu_guide_returns409` | ✅ **NEW** |
| Regression: list / get / update / item CRUD / reorder / clearParentId / delete-with-children / deep-hierarchy delete | ✅ All pass |

**Test command + result:**

```
./mvnw test -Dtest='Phase1JAdminSettingsMenuCouponApiTest,Phase1K1ContractHardeningTest'
```

```
Phase1JAdminSettingsMenuCouponApiTest — Tests run: 87, Failures: 0, Errors: 0, Skipped: 0
Phase1K1ContractHardeningTest         — Tests run: 10, Failures: 0, Errors: 0, Skipped: 0
BUILD SUCCESS
```

## Rủi ro còn lại

1. **Custom-location menus còn tồn tại trên prod DB từ migration cũ** sẽ vẫn nằm im đó (không hiển thị, không bị xoá). Tham chiếu DELETE qua API vẫn hoạt động cho non-system locations, nên admin có thể clean qua API trực tiếp nếu muốn. UI không expose.
2. **Direct DB tampering** (xoá `menus` qua psql, restore từ backup cũ) sẽ bypass được cả tầng API guard. Phòng thủ: Flyway V84 idempotent re-seed sẽ chạy lại trên next deploy. Nếu cần realtime self-heal có thể thêm `ApplicationRunner` ensure-on-startup, nhưng hiện tại không cần.
3. **Tests dùng `createTestMenu` với location random** vẫn được phép (helper đi thẳng repo, bypass API guard) — đó là behavior cố ý cho test fixture, không ảnh hưởng production path.

## Khi nào mở lại "Create menu container"

Khi (và chỉ khi) đã có cơ chế gán menu container vào page region / layout slot / widget config. Lúc đó update lại `MenuLocations` thành extensible (DB-backed registry) và mở lại UI create.
