# Phase 1B — Backend Core Schema Foundation

**Status:** COMPLETE  
**Date:** 2026-04-21  
**Tests:** 50 passed, 0 failed, 0 skipped

---

## 1. Flyway Migrations Created

| File | Tables |
|------|--------|
| `V3__create_customer_user_tables.sql` | `customers`, `customer_addresses` |
| `V4__create_media_redirect_menu_tables.sql` | `media`, `redirects`, `menus`, `menu_items` |
| `V5__create_commerce_settings_tables.sql` | `coupons`, `shipping_zones`, `shipping_methods`, `site_settings`, `audit_logs` |
| `V1001__seed_settings_menu_shipping_dev.sql` *(dev-only)* | Seeds: 4 site settings, 3 menus, 1 shipping zone, 2 shipping methods |

All migrations run under H2 (PostgreSQL mode) for tests and are written to be PostgreSQL-compatible for production.

---

## 2. Schema Summary

### customers
- UUID PK, optional `email`/`phone`/`password_hash`, `status NOT NULL`, `is_synthetic NOT NULL DEFAULT false`
- Indexes on `legacy_id`, `email`, `phone`, `status`, `is_synthetic`

### customer_addresses
- UUID PK, FK → `customers(id) ON DELETE CASCADE`
- `type NOT NULL`, `country NOT NULL DEFAULT 'VN'`, `is_default NOT NULL DEFAULT false`
- Indexes on `customer_id`, `type`, `is_default`

### media
- UUID PK, `file_path text NOT NULL`, `storage_provider NOT NULL`, `status NOT NULL`
- Optional: `public_url`, `bucket`, `mime_type`, `file_size`, `width`, `height`, `alt_text`, `title`, `caption`, `metadata`, `sizes`
- Indexes on `legacy_id`, `storage_provider`, `mime_type`, `status`

### redirects
- UUID PK, `source_pattern text NOT NULL`, `target_url text NOT NULL`
- `status_code INTEGER NOT NULL DEFAULT 301` + CHECK constraint `(301, 302, 307, 308)`
- `enabled BOOLEAN NOT NULL DEFAULT true`, `hit_count BIGINT NOT NULL DEFAULT 0`
- Indexes on `source_pattern`, `enabled`, `status_code`, `legacy_id`

### menus
- UUID PK, `location VARCHAR(100) UNIQUE NOT NULL`, `name NOT NULL`, `status NOT NULL`

### menu_items
- UUID PK, FK → `menus(id) ON DELETE CASCADE`, `parent_id` self-referencing FK
- `label NOT NULL`, optional `url`, `target_type`, `target_id UUID`, `sort_order NOT NULL DEFAULT 0`
- Indexes on `menu_id`, `parent_id`, `sort_order`, `legacy_id`

### coupons
- UUID PK, `code VARCHAR(100) UNIQUE NOT NULL`, `discount_type NOT NULL`, `status NOT NULL`
- `amount NUMERIC(19,2)`, `minimum_amount`, `maximum_amount`, `usage_limit`, `usage_count DEFAULT 0`
- `starts_at`, `expires_at` timestamps
- Indexes on `code`, `status`, `legacy_id`, `expires_at`

### shipping_zones
- UUID PK, `name NOT NULL`, `region_code VARCHAR(50)`, `sort_order DEFAULT 0`, `enabled DEFAULT true`

### shipping_methods
- UUID PK, FK → `shipping_zones(id) ON DELETE CASCADE`
- `method_code NOT NULL`, `title NOT NULL`, `cost NUMERIC(19,2)`, `min_order_amount`
- Indexes on `zone_id`, `method_code`, `enabled`, `legacy_id`

### site_settings
- UUID PK, `setting_key UNIQUE NOT NULL`, `setting_value text NOT NULL`
- `setting_group NOT NULL`, `is_public DEFAULT false`
- Values stored as JSON-encoded strings (e.g. `"BigBike"` for string scalars)

### audit_logs
- UUID PK (immutable — no `updated_at`), append-only design
- `actor_type`, `actor_id UUID`, `action NOT NULL`, `resource_type NOT NULL`, `resource_id UUID`
- `before_data text`, `after_data text`, `ip_address`, `user_agent text`
- Indexes on `(actor_type, actor_id)`, `(resource_type, resource_id)`, `action`, `created_at`

---

## 3. JPA Entities + Repositories

| Domain | Entity | Repository | Key Query Methods |
|--------|--------|------------|-------------------|
| customer | `CustomerEntity` | `CustomerJpaRepository` | `findByEmail`, `findByPhone`, `findByLegacyId` |
| customer | `CustomerAddressEntity` | `CustomerAddressJpaRepository` | `findByCustomerId` |
| media | `MediaEntity` | `MediaJpaRepository` | `findByLegacyId`, `findByStorageProvider` |
| redirect | `RedirectEntity` | `RedirectJpaRepository` | `findBySourcePattern`, `findByEnabled` |
| menu | `MenuEntity` | `MenuJpaRepository` | `findByLocation` |
| menu | `MenuItemEntity` | `MenuItemJpaRepository` | `findByMenuId`, `findByMenuIdOrderBySortOrderAsc` |
| coupon | `CouponEntity` | `CouponJpaRepository` | `findByCode`, `findByLegacyId` |
| shipping | `ShippingZoneEntity` | `ShippingZoneJpaRepository` | `findByLegacyId`, `findByEnabledOrderBySortOrderAsc` |
| shipping | `ShippingMethodEntity` | `ShippingMethodJpaRepository` | `findByZoneId`, `findByZoneIdAndEnabledOrderBySortOrderAsc` |
| settings | `SiteSettingEntity` | `SiteSettingJpaRepository` | `findBySettingKey`, `findBySettingGroup`, `findByIsPublic` |
| audit | `AuditLogEntity` | `AuditLogJpaRepository` | `findByActorId`, `findByResourceTypeAndResourceId` |

---

## 4. Design Decisions

- **`text` over `jsonb`** — All JSON columns (`metadata`, `settings`, `before_data`, `after_data`, `sizes`) use `text` type for H2 compatibility. Can be promoted to `jsonb` in a future migration when running against PostgreSQL.
- **`menu_items.parent_id` as bare UUID column** — Not mapped as `@ManyToOne` to avoid self-referential circular issues with Hibernate and cascades. Tree reconstruction is handled in application layer.
- **`coupon.amount` column names** — Migration uses `minimum_amount`/`maximum_amount` (not `min_amount`/`max_amount`) to avoid ambiguity with any future `min()`/`max()` aggregate naming patterns.
- **`audit_logs` is append-only** — No `updated_at` column by design. Rows are never modified after insert.
- **`site_settings` values stored as JSON** — Setting values are JSON-encoded scalars (strings wrapped in `"..."`) to support heterogeneous types in a future extension without schema change.

---

## 5. Test Results

```
Phase1BSchemaTest (12 tests):
  ✓ siteSettings_seedLoaded
  ✓ menus_seedLoaded
  ✓ shippingZone_seedLoaded
  ✓ shippingMethods_seedLoaded
  ✓ customer_saveAndFind
  ✓ customerAddress_saveAndFind
  ✓ media_saveAndFind
  ✓ redirect_saveAndFind
  ✓ menuItem_saveAndFind
  ✓ coupon_saveAndFind
  ✓ auditLog_saveAndFind
  ✓ siteSettings_findByGroup

Full suite: 50 tests, 0 failures, 0 skipped
```

---

## 6. What's NOT in Scope for 1B

- No REST endpoints for any of these domains
- No service layer beyond repositories
- No order/cart/payment tables (Phase 1C+)
- No Elasticsearch indexing
- No file upload handling for media
