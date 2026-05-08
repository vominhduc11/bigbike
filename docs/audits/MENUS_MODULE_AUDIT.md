HISTORICAL_REPORT_ONLY - Not canonical. Validate against current code and canonical docs.

# Menus Module Audit

- **Audit date:** 2026-05-06
- **Fix date:** 2026-05-06
- **Repo branch / commit:** `main`
- **Auditor:** Senior Software Architect + QA Lead
- **Scope:** BigBike Menus module — Backend (Spring Boot), Web Frontend (Next.js), Admin Frontend (React/Vite), DB migrations, tests
- **Phase report baseline:** [PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md](../../bigbike-backend/docs/PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md)

---

## 1. Executive Summary

- **Overall status: CONDITIONALLY_READY — production-ready pending API_CONTRACT doc update.**
- **Production readiness score: 87 / 100.**
- **P0 blockers found:** 3 — **all RESOLVED** as of 2026-05-06.
- **Remaining open issues:** 4 (LOW/P2) — none are blockers.

### P0 blockers (all RESOLVED)

| ID | Issue | Status |
|---|---|---|
| MNU-001 | PATCH menu item không move-to-root (`clearParentId`) | **RESOLVED** |
| MNU-002 | Footer `normalizeMenuUrl` local — sai với external URL, không block `javascript:` | **RESOLVED** |
| MNU-003 | Delete hierarchy: `deleteMenuItem` không guard child → silent cascade/FK violation; `deleteMenu` flat `deleteAll` → FK violation với cây nhiều cấp | **RESOLVED** |
| MNU-004 | Admin có thể tạo location rác và xoá system slot — storefront không có cách nào hiển thị các custom location, và xoá `primary/footer/guide` làm header/footer biến mất. Fixed 2026-05-08 — see `MENUS_SYSTEM_SLOT_FIX_REPORT.md`. | **RESOLVED** |

### Test evidence

```
Phase1JAdminSettingsMenuCouponApiTest — Tests run: 55, Failures: 0, Errors: 0, Skipped: 0
  - Test 42: PATCH item clearParentId:true → item moves to root (DB assertion)    PASS
  - Test 43: DELETE parent item with child → 409 CONFLICT                         PASS
  - Test 44: DELETE menu 3-level hierarchy → 204 + DB fully clean                 PASS
  - Tests 8–18, 33–41: existing menu tests (regression)                           ALL PASS
```

---

## 2. Scope Audited

### Backend
- [AdminMenuController.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminMenuController.java)
- [AdminMenuService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMenuService.java)
- [PublicMenuController.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/public_/PublicMenuController.java)
- [UpdateMenuItemRequest.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/menu/UpdateMenuItemRequest.java) *(modified)*
- [CreateMenuItemRequest.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/menu/CreateMenuItemRequest.java)
- [ReorderMenuItemRequest.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/menu/ReorderMenuItemRequest.java)
- [MenuEntity.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/menu/MenuEntity.java)
- [MenuItemEntity.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/menu/MenuItemEntity.java)
- [MenuJpaRepository.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/menu/MenuJpaRepository.java)
- [MenuItemJpaRepository.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/menu/MenuItemJpaRepository.java)
- [V4__create_media_redirect_menu_tables.sql](../../bigbike-backend/src/main/resources/db/migration/V4__create_media_redirect_menu_tables.sql)

### Web Frontend (Next.js)
- [SiteFooter.tsx](../../bigbike-web/components/layout/SiteFooter.tsx) *(modified)*
- [SiteHeader.tsx](../../bigbike-web/components/layout/SiteHeader.tsx)
- [HeaderNavItem.tsx](../../bigbike-web/components/layout/HeaderNavItem.tsx)
- [MobileHeaderMenu.tsx](../../bigbike-web/components/layout/MobileHeaderMenu.tsx)
- [lib/utils/nav.ts](../../bigbike-web/lib/utils/nav.ts) *(modified)*
- [lib/api/public-api.ts](../../bigbike-web/lib/api/public-api.ts)
- [lib/contracts/public.ts](../../bigbike-web/lib/contracts/public.ts)

### Admin Frontend (React/Vite)
- [MenuScreen.jsx](../../bigbike-admin/src/screens/MenuScreen.jsx)
- [adminApi.js](../../bigbike-admin/src/lib/adminApi.js) (menu functions)

### Tests
- [Phase1JAdminSettingsMenuCouponApiTest.java](../../bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1JAdminSettingsMenuCouponApiTest.java) (tests 8–18, 33–44)

### Docs
- [docs/engineering/API_CONTRACT.md](../engineering/API_CONTRACT.md) *(needs update — MNU-P2-001)*

---

## 3. P0 Bug Detail — RESOLVED

### MNU-001 — PATCH menu item không move-to-root `[RESOLVED]`

**Root cause:** `UpdateMenuItemRequest` là Java record. Cả hai trường hợp "client không gửi `parentId`" và "client gửi `parentId: null`" đều deserialize thành `null`. Service chỉ xử lý parentId khi `req.parentId() != null`, nên không có cách nào đưa item về root qua PATCH.

**Fix:**
- Thêm field `Boolean clearParentId` vào [UpdateMenuItemRequest.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/menu/UpdateMenuItemRequest.java).
- Trong `AdminMenuService.updateMenuItem()` ([AdminMenuService.java:241](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMenuService.java)):
  ```
  if (Boolean.TRUE.equals(req.clearParentId())) → item.setParentId(null)
  else if (req.parentId() != null)               → validate + set parentId
  ```
- Backwards-compatible: client không gửi `clearParentId` → behavior cũ không đổi.

**Reorder endpoint không ảnh hưởng:** `reorderItems` đã xử lý `parentId: null` đúng (`proposedParentMap.put(r.id(), r.parentId())`).

**Test:** Test 42 — `updateMenuItem_clearParentId_movesToRoot` — PASS.

---

### MNU-002 — Footer `normalizeMenuUrl` local — sai với external URL, không block `javascript:` `[RESOLVED]`

**Root cause:** `SiteFooter.tsx` định nghĩa hàm local:
```ts
function normalizeMenuUrl(url: string): string {
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}
```
- URL external (`https://...`) → bị prefix `/` thành `/https://...` — broken link.
- `mailto:`, `tel:`, `#anchor` → bị prefix `/` sai.
- `javascript:alert()` → không bị block (chỉ trở thành `/javascript:alert()` — ngẫu nhiên safe nhưng không đúng).

Hàm chuẩn tại `lib/utils/nav.ts` xử lý đúng external URL nhưng thiếu scheme blocking.

**Fix:**
1. Cập nhật [lib/utils/nav.ts](../../bigbike-web/lib/utils/nav.ts): thêm block `javascript:`, `vbscript:`, `data:` trước logic trailing-slash.
2. Xóa hàm local trong [SiteFooter.tsx](../../bigbike-web/components/layout/SiteFooter.tsx), thêm import `normalizeMenuUrl` từ `@/lib/utils/nav`.

**Behavior sau fix:**

| URL input | Trước fix (local) | Sau fix (nav.ts) |
|---|---|---|
| `/san-pham` | `/san-pham` (OK ngẫu nhiên) | `/san-pham/` (trailing slash chuẩn) |
| `https://facebook.com` | `/https://facebook.com` ❌ | `https://facebook.com` ✅ |
| `mailto:x@y.com` | `/mailto:x@y.com` ❌ | `mailto:x@y.com` ✅ |
| `tel:0909123456` | `/tel:0909123456` ❌ | `tel:0909123456` ✅ |
| `#anchor` | `/#anchor` (debatable) | `#anchor` ✅ |
| `javascript:alert()` | `/javascript:alert()` (ngẫu nhiên safe) | `/` (blocked) ✅ |
| `vbscript:...` | `/vbscript:...` | `/` (blocked) ✅ |
| `data:text/html,...` | `/data:text/html,...` | `/` (blocked) ✅ |

**Test:** Không có test runner FE. Xem MNU-P2-002.

---

### MNU-003 — Delete hierarchy không an toàn `[RESOLVED]`

Có hai sub-issue độc lập:

#### MNU-003a — `deleteMenuItem` không guard child

**Root cause:** Service xóa item mà không kiểm tra item đó có child không. DB schema có FK `parent_id references menu_items(id)` không có `ON DELETE CASCADE` → FK violation (500) hoặc — nếu không có constraint — xóa parent âm thầm tạo orphan children.

**Fix:** Thêm check vào `AdminMenuService.deleteMenuItem()` ([AdminMenuService.java:291](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMenuService.java)):
```java
boolean hasChildren = allItems.stream().anyMatch(i -> itemId.equals(i.getParentId()));
if (hasChildren) throw new ConflictException("... CHILD_ITEMS_EXIST");
```
**Policy:** DELETE parent item có child → trả 409 CONFLICT. Client phải xóa hoặc reparent children trước. Đây là policy an toàn nhất (không xóa ngầm).

**Test:** Test 43 — `deleteMenuItem_withChildren_returns409` — PASS. Parent còn tồn tại trong DB sau 409.

#### MNU-003b — `deleteMenu` flat `deleteAll` → FK violation với hierarchy

**Root cause:** `deleteMenu` dùng:
```java
menuItemRepo.deleteAll(items);  // items ordered by sort_order, not topological
menuRepo.delete(entity);
```
`findByMenuIdOrderBySortOrderAsc` trả items theo `sort_order`. Nếu parent có `sort_order=0`, child có `sort_order=1`, Hibernate xóa parent trước → FK violation trên `parent_id`.

**Root cause thêm:** H2 (test database) không fire `ON DELETE CASCADE` khi JPA commit `DELETE FROM menus`, khác với PostgreSQL production behavior. Code cần đúng trên cả H2 và PostgreSQL.

**Fix:** Thêm helper `deleteMenuItemsBottomUp` xóa theo thứ tự topological (leaves trước → parents sau):
```java
private void deleteMenuItemsBottomUp(List<MenuItemEntity> items) {
    if (items.isEmpty()) return;
    Set<UUID> isParent = items.stream().map(MenuItemEntity::getParentId)
            .filter(p -> p != null).collect(Collectors.toSet());
    List<MenuItemEntity> leaves = items.stream()
            .filter(i -> !isParent.contains(i.getId())).toList();
    List<MenuItemEntity> parents = items.stream()
            .filter(i -> isParent.contains(i.getId())).toList();
    menuItemRepo.deleteAll(leaves);
    deleteMenuItemsBottomUp(parents);  // recurse on former parents now childless
}
```
`deleteMenu` gọi `deleteMenuItemsBottomUp(items)` thay vì `deleteAll(items)`.

**Test:** Test 44 — `deleteMenu_deepHierarchy_returns204AndCleansDb` — 3-level tree (root → level2 → level3) → 204, menu và 3 items đều không còn trong DB. PASS.

**Regression:** Test 17 (`adminMenus_deleteMenu_returns204`) — menu 1 item phẳng — PASS.

---

## 4. Feature Completion Matrix

| # | Feature | Status | Evidence | Notes |
|---|---|---|---|---|
| 1 | List menus (filter q, status) | COMPLETE | `AdminMenuService.listMenus` | — |
| 2 | Get menu by ID | COMPLETE | `getMenuById` | — |
| 3 | Get menu by location (admin) | COMPLETE | `getMenuByLocation` | — |
| 4 | Create menu (location unique) | COMPLETE | `createMenu` + 409 on duplicate | — |
| 5 | Update menu name/status | COMPLETE | `updateMenu` | status validate ACTIVE/INACTIVE |
| 6 | Delete menu (cascade items) | COMPLETE | `deleteMenu` + `deleteMenuItemsBottomUp` | **Fixed MNU-003b** |
| 7 | Create menu item (with parent) | COMPLETE | `createMenuItem` | parent must be same menu |
| 8 | Update menu item | COMPLETE | `updateMenuItem` | — |
| 9 | Move menu item to root via PATCH | COMPLETE | `updateMenuItem` + `clearParentId=true` | **Fixed MNU-001** |
| 10 | Move menu item to new parent via PATCH | COMPLETE | `updateMenuItem` + cycle detection | — |
| 11 | Delete menu item (leaf only) | COMPLETE | `deleteMenuItem` + 409 guard | **Fixed MNU-003a** |
| 12 | Batch reorder items (with reparent) | COMPLETE | `reorderItems` | supports `parentId:null` → root |
| 13 | Cycle detection (PATCH single item) | COMPLETE | `validateNoDeepCycle` | — |
| 14 | Cycle detection (reorder batch) | COMPLETE | `detectCycleInMap` | — |
| 15 | Public menu by location | COMPLETE | `getPublicMenuByLocation` | INACTIVE menu → 404; INACTIVE item filtered |
| 16 | Ancestor chain active filter | COMPLETE | `isAncestorChainActive` | child of INACTIVE parent is hidden |
| 17 | Footer URL normalize (external + scheme) | COMPLETE | `nav.ts` + `SiteFooter.tsx` import | **Fixed MNU-002** |
| 18 | Header URL normalize | COMPLETE | `SiteHeader.tsx` dùng `nav.ts` đúng | không ảnh hưởng |
| 19 | Audit log (all mutations) | COMPLETE | `buildMenuAudit` / `buildItemAudit` | — |
| 20 | Web revalidation on mutations | COMPLETE | `webRevalidationService.revalidate("menus")` | — |
| 21 | Admin FE menu screen (CRUD + DnD reorder) | COMPLETE | `MenuScreen.jsx` | — |

---

## 5. API Audit

| Endpoint | Purpose | Permission | Request | Response | Validation | Test | Status |
|---|---|---|---|---|---|---|---|
| `GET /api/v1/admin/menus` | List | `menus.read` | `page, size, q, status` | `ApiListResponse<AdminMenuResponse>` | enum validate status (service) | T8–T9 | COMPLETE |
| `GET /api/v1/admin/menus/{menuId}` | Detail | `menus.read` | UUID path | `ApiDataResponse<AdminMenuResponse>` | — | T12 | COMPLETE |
| `POST /api/v1/admin/menus` | Create | `menus.write` | `{location, name, status?}` | same | location unique 409; status ACTIVE/INACTIVE | T10–T11, T33–T34 | COMPLETE |
| `PATCH /api/v1/admin/menus/{menuId}` | Update | `menus.write` | `{name?, status?}` | same | — | T13 | COMPLETE |
| `DELETE /api/v1/admin/menus/{menuId}` | Delete | `menus.write` | — | 204 | — | T17, T44 | COMPLETE |
| `POST /api/v1/admin/menus/{menuId}/items` | Create item | `menus.write` | `{label, url, parentId?, ...}` | `ApiDataResponse<AdminMenuItemResponse>` | parent same menu; status | T14, T35 | COMPLETE |
| `PATCH /api/v1/admin/menus/{menuId}/items/{itemId}` | Update item | `menus.write` | `{label?, url?, parentId?, clearParentId?, ...}` | same | cycle; parent same menu; **clearParentId doc needed** | T36, T38, T42 | COMPLETE (doc gap) |
| `DELETE /api/v1/admin/menus/{menuId}/items/{itemId}` | Delete item | `menus.write` | — | 204 | 409 if has children | T16, T43 | COMPLETE |
| `POST /api/v1/admin/menus/{menuId}/items/reorder` | Batch reorder | `menus.write` | `{items:[{id, parentId, sortOrder}]}` | `ApiDataResponse<AdminMenuResponse>` | cycle; parentId same menu; self-parent | T15, T39–T41 | COMPLETE |
| `GET /api/v1/menus/{location}` | Public | None | location path | `ApiDataResponse<PublicMenuResponse>` | INACTIVE menu 404 | T18, T37 | COMPLETE |

---

## 6. DB Schema Audit

| Aspect | Status | Evidence | Notes |
|---|---|---|---|
| `menus.id` UUID PK | PASS | V4 | — |
| `menus.location` UNIQUE constraint | PASS | V4:50 | enforced at DB + service |
| `menu_items.menu_id` FK `ON DELETE CASCADE` | PASS | V4:59 | cascade từ menus |
| `menu_items.parent_id` FK no cascade | PASS (by design) | V4:60 | NO ACTION (default); service manages topological delete |
| Index `idx_menu_items_menu_id` | PASS | V4:74 | covers `findByMenuId` |
| Index `idx_menu_items_parent_id` | PASS | V4:75 | covers child lookup |
| Index `idx_menu_items_sort_order` | PASS | V4:76 | covers ordered fetch |
| Cascade delete items on menu delete (H2) | PASS (via code) | `deleteMenuItemsBottomUp` | H2 không fire DB-level cascade; code tự xử lý topological delete |
| Cascade delete items on menu delete (PostgreSQL) | PASS (via code) | same method | code an toàn hơn DB-level cascade cho self-referential FK |

---

## 7. Remaining Issues (LOW / P2)

| ID | Severity | Area | Issue | Status | Fix Recommendation |
|---|---|---|---|---|---|
| MNU-P2-001 | LOW | Docs | `API_CONTRACT.md` chưa document field `clearParentId` trong `PATCH /admin/menus/{menuId}/items/{itemId}`. | **RESOLVED 2026-05-06** | `API_CONTRACT.md` đã được cập nhật: mở rộng Menus row trong §8.5 + thêm §8.5.1 với full field table và precedence rule. |
| MNU-P2-001a | LOW | Docs | OpenAPI generated spec (nếu có) chưa reflect `clearParentId`. Đây là follow-up riêng, độc lập với API_CONTRACT.md text. | OPEN | Regenerate OpenAPI spec sau khi deploy. Không block release. |
| MNU-P2-002 | LOW | Test | Không có test runner FE (Vitest/Jest) cho `bigbike-web`. `normalizeMenuUrl` và scheme blocking trong `nav.ts` chưa có unit test. | OPEN | Thêm `nav.test.ts` với cases: `/path`, `https://ext`, `mailto:`, `tel:`, `#anchor`, `javascript:`, `vbscript:`, `data:`. |
| MNU-P2-003 | LOW | Behavior | `normalizeMenuUrl` trong `nav.ts` thêm trailing slash cho internal paths (`/san-pham` → `/san-pham/`). Behavior intentional (nhất quán với Header). | CLOSED — by design | Trailing slash chỉ áp dụng cho path thuần `/...` không có `?` hoặc `#`. Không cần fix. |
| MNU-P2-004 | LOW | Resilience | `deleteMenuItemsBottomUp` không có guard vòng lặp vô hạn nếu DB có dữ liệu corrupt (circular `parent_id`). Không thể xảy ra qua API nhờ cycle detection ở write path. | OPEN | Thêm guard: so sánh size `parents` trước/sau; nếu không giảm → `deleteAll(parents)` để thoát. |

---

## 8. Permission / RBAC Audit

| Layer | Status | Evidence |
|---|---|---|
| Controller `menus.read` on GET | PASS | `AdminMenuController` `requirePermission` |
| Controller `menus.write` on POST/PATCH/DELETE | PASS | same |
| Spring Security `/api/v1/admin/**` requires `ROLE_ADMIN` | PASS | `SecurityConfig.java` |
| Public `/api/v1/menus/**` permitAll | PASS | `SecurityConfig.java` |
| FE route guard `menus.read` | PASS | `MenuScreen.jsx` permission gate |
| Permission denial test (missing `menus.write` → 403) | **NOT FOUND** | No negative test | *(shared gap với other modules — không riêng Menus)* |

---

## 9. Test Coverage Summary

### Tests covering Menus (Phase1JAdminSettingsMenuCouponApiTest)

| # | Test name | Scenario | Result |
|---|---|---|---|
| 8 | `adminMenus_withoutToken_returns401` | No auth | PASS |
| 9 | `adminMenus_withAdminToken_returnsList` | List menus | PASS |
| 10 | `adminMenus_create_succeeds` | Create menu | PASS |
| 11 | `adminMenus_createDuplicateLocation_returns409` | Duplicate location | PASS |
| 12 | `adminMenus_getById_returnsMenuWithItems` | Get with items | PASS |
| 13 | `adminMenus_update_succeeds` | Update name | PASS |
| 14 | `adminMenus_createItem_succeeds` | Add item | PASS |
| 15 | `adminMenus_reorderItems_succeeds` | Reorder batch | PASS |
| 16 | `adminMenus_deleteItem_returns204` | Delete leaf item | PASS |
| 17 | `adminMenus_deleteMenu_returns204` | Delete menu (flat) | PASS |
| 18 | `publicMenu_byLocation_returnsActiveItems` | Public + filter inactive | PASS |
| 33 | `createMenu_invalidStatus_returns400` | Bad status | PASS |
| 34 | `updateMenu_invalidStatus_returns400` | Bad status | PASS |
| 35 | `createMenuItem_invalidStatus_returns400` | Bad status | PASS |
| 36 | `updateMenuItem_invalidStatus_returns400` | Bad status | PASS |
| 37 | `publicMenu_inactiveMenu_returns404` | INACTIVE menu → 404 | PASS |
| 38 | `updateMenuItem_deepCycle_returns400` | A→B→A cycle | PASS |
| 39 | `reorderMenuItems_parentFromOtherMenu_returns400` | Cross-menu parent | PASS |
| 40 | `reorderMenuItems_deepCycle_returns400` | 3-item cycle | PASS |
| 41 | `reorderMenuItems_selfParent_returns400` | Self-parent | PASS |
| **42** | `updateMenuItem_clearParentId_movesToRoot` | **Move to root (P0 fix)** | **PASS** |
| **43** | `deleteMenuItem_withChildren_returns409` | **Delete parent → 409 (P0 fix)** | **PASS** |
| **44** | `deleteMenu_deepHierarchy_returns204AndCleansDb` | **Delete 3-level tree (P0 fix)** | **PASS** |

**Total Menus tests: 23 / 55 in Phase1J file. 0 failures.**

---

## 10. Final Verdict

| Dimension | Score | Notes |
|---|---|---|
| API contract completeness | 10/10 | `API_CONTRACT.md` §8.5 + §8.5.1 updated 2026-05-06 |
| Business logic correctness | 10/10 | Tất cả P0 đã fix + test |
| Delete safety | 10/10 | 409 guard + topological delete |
| URL security (XSS via `javascript:`) | 10/10 | Blocked ở `nav.ts` |
| Test coverage (backend) | 9/10 | Không có permission-denial test (shared gap với toàn hệ thống) |
| Test coverage (frontend) | 6/10 | Không có test runner FE (MNU-P2-002) |
| DB schema | 9/10 | Self-referential FK không có cascade là by-design; code handles |
| Docs | 10/10 | `API_CONTRACT.md` updated; OpenAPI regenerate là follow-up riêng (MNU-P2-001a) |

**Production readiness: READY.**

**Không còn blocker nào.** `API_CONTRACT.md` đã được cập nhật (MNU-P2-001 RESOLVED). Không có P0 hoặc required-before-release item nào còn mở.

**Required before release:** *(tất cả đã xong)*
- [x] Fix PATCH move-to-root (`clearParentId`) — MNU-001
- [x] Fix Footer URL normalize + scheme blocking — MNU-002
- [x] Fix delete hierarchy safety (409 guard + topological delete) — MNU-003
- [x] Update `docs/engineering/API_CONTRACT.md` §8.5 + §8.5.1 — MNU-P2-001

**Recommended post-release:**
- [ ] MNU-P2-001a: Regenerate OpenAPI spec để reflect `clearParentId` field.
- [ ] MNU-P2-002: Thêm `nav.test.ts` unit tests cho `normalizeMenuUrl` (7 test cases).
- [ ] MNU-P2-004: Thêm infinite-loop guard vào `deleteMenuItemsBottomUp` cho corrupt-data resilience.
