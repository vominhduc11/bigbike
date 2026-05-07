HISTORICAL_REPORT_ONLY - Not canonical. Validate against current code and canonical docs.

# Phase 1J — Admin Settings / Menu / Coupon API Report

**Date:** 2026-04-21
**Tests:** 265/265 PASS (227 previous + 38 new)
**Commit branch:** main

---

## Summary

Phase 1J implements the final three admin management domains for the BigBike backend rewrite:

1. **Site Settings API** — read/update key-value configuration with public/private distinction
2. **Menu API** — full CRUD for navigation menus and their items, reorder support, public endpoint
3. **Coupon API** — create/update/status management for discount coupons with validation rules

---

## Endpoints Added

### Site Settings (Admin)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/api/v1/admin/settings` | settings.read | List all settings (filter: q, group, isPublic) |
| GET | `/api/v1/admin/settings/{settingKey}` | settings.read | Get setting by key |
| PATCH | `/api/v1/admin/settings/{settingKey}` | settings.write | Update setting value/group/isPublic/description |

### Site Settings (Public)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/settings/public` | None | Returns all settings where isPublic=true |

### Menus (Admin)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/api/v1/admin/menus` | menus.read | List menus (filter: q, status) |
| GET | `/api/v1/admin/menus/{menuId}` | menus.read | Get menu with items |
| POST | `/api/v1/admin/menus` | menus.write | Create menu (location uniqueness enforced) |
| PATCH | `/api/v1/admin/menus/{menuId}` | menus.write | Update menu name/status |
| DELETE | `/api/v1/admin/menus/{menuId}` | menus.write | Physical delete (cascades items) |
| POST | `/api/v1/admin/menus/{menuId}/items` | menus.write | Add menu item |
| PATCH | `/api/v1/admin/menus/{menuId}/items/{itemId}` | menus.write | Update menu item |
| DELETE | `/api/v1/admin/menus/{menuId}/items/{itemId}` | menus.write | Physical delete item |
| POST | `/api/v1/admin/menus/{menuId}/items/reorder` | menus.write | Batch reorder items |

### Menus (Public)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/v1/menus/{location}` | None | Returns menu with ACTIVE items only |

### Coupons (Admin)

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/api/v1/admin/coupons` | coupons.read | List coupons (filter: q, code, status, discountType, expired) |
| GET | `/api/v1/admin/coupons/{couponId}` | coupons.read | Get coupon detail |
| POST | `/api/v1/admin/coupons` | coupons.write | Create coupon |
| PATCH | `/api/v1/admin/coupons/{couponId}` | coupons.write | Update coupon fields |
| PATCH | `/api/v1/admin/coupons/{couponId}/status` | coupons.write | Update coupon status only |

---

## Business Rules Enforced

### Settings
- Sensitive keys (containing `secret`, `password`, `token`, `privatekey`) cannot be marked `isPublic=true` — returns 400
- Public endpoint returns only settings with `isPublic=true`
- SETTING_UPDATED audit log written on every update

### Menus
- `location` must be unique per menu — duplicate returns 409
- Parent item cycle prevention: an item cannot be its own parent
- Parent item must belong to the same menu
- Physical deletes: removing a menu cascades to all its items; item delete is physical (not logical)
- Public endpoint filters to `ACTIVE` items only
- Audit events: MENU_CREATED, MENU_UPDATED, MENU_DELETED, MENU_ITEM_CREATED, MENU_ITEM_UPDATED, MENU_ITEM_DELETED, MENU_ITEMS_REORDERED

### Coupons
- `code` is unique (case-insensitive, stored uppercased) — duplicate returns 409
- `discountType` must be `FIXED` or `PERCENT` — invalid returns 400
- `amount` must be > 0
- `PERCENT` amount cannot exceed 100 — returns 400
- `minimumAmount` and `maximumAmount` must be >= 0
- `expiresAt` must be after `startsAt` when both are set
- `status` for status-update must be `ACTIVE`, `INACTIVE`, or `EXPIRED`
- Audit events: COUPON_CREATED, COUPON_UPDATED, COUPON_STATUS_UPDATED

---

## Permissions Added to ADMIN Role

```
settings.read, settings.write
menus.read, menus.write
coupons.read, coupons.write
```

---

## Files Created

### DTOs — Settings
- `api/admin/dto/settings/AdminSiteSettingResponse.java`
- `api/admin/dto/settings/UpdateSiteSettingRequest.java`
- `api/admin/dto/settings/PublicSiteSettingResponse.java`

### DTOs — Menu (13 files)
- `api/admin/dto/menu/AdminMenuResponse.java`
- `api/admin/dto/menu/AdminMenuItemResponse.java`
- `api/admin/dto/menu/CreateMenuRequest.java`
- `api/admin/dto/menu/UpdateMenuRequest.java`
- `api/admin/dto/menu/CreateMenuItemRequest.java`
- `api/admin/dto/menu/UpdateMenuItemRequest.java`
- `api/admin/dto/menu/ReorderMenuItemsRequest.java`
- `api/admin/dto/menu/ReorderMenuItemRequest.java`
- `api/admin/dto/menu/PublicMenuResponse.java`
- `api/admin/dto/menu/PublicMenuItemResponse.java`

### DTOs — Coupon (5 files)
- `api/admin/dto/coupon/AdminCouponListItemResponse.java`
- `api/admin/dto/coupon/AdminCouponDetailResponse.java`
- `api/admin/dto/coupon/CreateCouponRequest.java`
- `api/admin/dto/coupon/UpdateCouponRequest.java`
- `api/admin/dto/coupon/UpdateCouponStatusRequest.java`

### Services
- `service/admin/AdminSettingsService.java`
- `service/admin/AdminMenuService.java`
- `service/admin/AdminCouponService.java`

### Controllers
- `api/admin/AdminSettingsController.java`
- `api/admin/AdminMenuController.java`
- `api/admin/AdminCouponController.java`
- `api/public_/PublicSettingsController.java`
- `api/public_/PublicMenuController.java`

### Files Modified
- `service/auth/DevAdminAuthService.java` — added 6 new permissions to ADMIN role
- `config/SecurityConfig.java` — added `permitAll` for `/api/v1/settings/public` and `/api/v1/menus/**`

### Tests
- `test/api/Phase1JAdminSettingsMenuCouponApiTest.java` — 38 tests

---

## Test Coverage (38 tests)

### Settings (1–7)
1. No auth → 401
2. List settings with auth
3. Filter by group
4. Get by key
5. Update value
6. Sensitive key cannot be made public → 400
7. Public endpoint returns only public settings (no auth needed)

### Menu (8–18)
8. No auth → 401
9. List menus with auth
10. Create menu
11. Duplicate location → 409
12. Get by ID with items
13. Update menu name
14. Add menu item
15. Reorder items
16. Delete item (physical, verified in DB)
17. Delete menu (physical with cascade)
18. Public menu endpoint filters ACTIVE items

### Coupon (19–28)
19. No auth → 401
20. List coupons with auth
21. Create FIXED coupon
22. Create PERCENT coupon
23. Invalid discountType → 400
24. PERCENT > 100 → 400
25. Duplicate code → 409
26. Update coupon name
27. Update coupon status
28. Get coupon detail

### Regression (29–38)
29–38. Admin orders, customers, media, redirects, customer orders protection, order lookup, cart, catalog, checkout, public menus

---

## Out of Scope (Deferred)

- Coupon-cart integration (apply coupon at checkout)
- Media uploads
- WordPress import
- Frontend
