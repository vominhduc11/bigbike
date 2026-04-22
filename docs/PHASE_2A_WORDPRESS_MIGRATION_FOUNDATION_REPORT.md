# Phase 2A — WordPress Migration Inventory + Importer Foundation Report

**Date:** 2026-04-21
**Phase:** 2A — WordPress Migration Inventory + Importer Foundation

---

## A. Summary

- WordPress dump found and inventoried: `bigbike_vn__2026_04_17/sqldump.sql` (128 MB).
- Table prefix confirmed: **`kd_`** (not the default `wp_`).
- HPOS disabled — orders are in legacy `kd_posts` (post_type=shop_order).
- RankMath redirections table found with 40 active rows.
- `docs/legacy/SEO_REDIRECT_MAP.csv` exists but has header only (empty rows).
- `wp-content/uploads` directory exists in archive but no file listing (8 GB+ estimated).
- No destructive import performed. No production DB writes outside tests.
- Migration is disabled by default (`bigbike.migration.wordpress.enabled=false`).

---

## B. WordPress Inventory

### SQL/source files found

| File | Size | Notes |
|---|---|---|
| `bigbike_vn__2026_04_17/sqldump.sql` | 128 MB | Full MySQL dump from server |
| `bigbike_vn__2026_04_17/files/wp-config.php` | — | Confirms table prefix `kd_`, charset `utf8mb4` |
| `bigbike_vn__2026_04_17/files/wp-content/` | 8 GB+ | Full uploads, themes, plugins |
| `docs/legacy/SEO_REDIRECT_MAP.csv` | 1 row (header only) | Empty — no actual entries yet |

### Table prefix

**`kd_`** — confirmed from `meta.json` and first CREATE TABLE statement.

### Total tables detected

**94 tables** detected in dump.

### Core WordPress tables (all present)

`kd_posts`, `kd_postmeta`, `kd_users`, `kd_usermeta`, `kd_options`, `kd_terms`, `kd_term_taxonomy`, `kd_term_relationships`, `kd_termmeta`, `kd_comments`, `kd_commentmeta`, `kd_links`

### WooCommerce mode

- **HPOS is OFF** (confirmed from `kd_options`: `woocommerce_custom_orders_table_enabled=no`).
- `kd_wc_orders` table exists but has **0 rows** — HPOS tables are empty.
- Order source-of-truth: **legacy `kd_posts`** (post_type=`shop_order`) + `kd_postmeta` + `kd_woocommerce_order_items` + `kd_woocommerce_order_itemmeta`.
- WooCommerce order text count: ~1 136 occurrences of `shop_order` in dump.

### RankMath/redirect source

- `kd_rank_math_redirections` — **40 rows**, `status=active` (most), `header_code=301/302`.
- `kd_rank_math_404_logs` — present.
- `kd_fg_redirect` — legacy redirect plugin table, lower priority.
- `docs/legacy/SEO_REDIRECT_MAP.csv` — header only, needs manual population.

### Media/uploads

- `wp-content/uploads/` exists in archive.
- ~41 276 attachment references in dump (post_type=attachment occurrences).
- Physical file copy deferred to Phase 2E.

### Plugin evidence in tables

| Plugin | Tables found |
|---|---|
| WooCommerce (legacy) | `kd_woocommerce_order_items`, `kd_woocommerce_order_itemmeta`, `kd_woocommerce_tax_rates`, etc. |
| RankMath | `kd_rank_math_redirections`, `kd_rank_math_analytics_*`, `kd_rank_math_404_logs` |
| Yoast SEO (inactive) | `kd_yoast_*` tables present; `_yoast_wpseo_*` postmeta present |
| Wordfence | `kd_wf*` tables (~18 tables) |
| WP Rocket | `kd_wpr_*` tables |
| Action Scheduler | `kd_actionscheduler_*` |
| EWWW Image Optimizer | `kd_ewwwio_*` |
| Google Listings & Ads | `kd_gla_*` |
| Permalink Manager Pro | Active — controls all product/category/brand URL patterns |
| Perfect WooCommerce Brands | `pwb-brand` taxonomy in `kd_term_taxonomy` |

---

## C. Mapping Plan

### 1. Products

- Source: `kd_posts (post_type=product)` + `kd_postmeta`
- Target: `products` + `product_variants` + `product_specifications` + `product_gallery_images`
- URL pattern: `sp/{slug}.html` (Permalink Manager Pro)
- Key meta: `_sku`, `_price`, `_regular_price`, `_sale_price`, `_stock`, `_stock_status`, `_thumbnail_id`, `_product_image_gallery`
- SEO: `rank_math_title` (primary) → `_yoast_wpseo_title` (fallback)
- Taxonomy: `product_cat` → categories, `pwb-brand` → brands, `product_tag` → tags

### 2. Categories

- Source: `kd_terms` + `kd_term_taxonomy (taxonomy=product_cat)`
- Target: `categories`
- Hierarchical — parent via `term_taxonomy.parent`
- URL: `{slug}.html` (hierarchical per Permalink Manager Pro)

### 3. Brands

- Source: `kd_terms` + `kd_term_taxonomy (taxonomy=pwb-brand)`
- Target: `brands`
- URL: `brand/{slug}.html`
- Plugin: Perfect WooCommerce Brands

### 4. Media

- Source: `kd_posts (post_type=attachment)` + `_wp_attached_file`, `_wp_attachment_image_alt`, `_wp_attachment_metadata`
- Target: `media`
- Phase 2A: record relative paths only
- Phase 2E: physical file copy/sync from wp-content/uploads/

### 5. Pages/Articles

- Pages: `kd_posts (post_type=page)` → `pages`, URL: `{slug}.html`
- Articles: `kd_posts (post_type=post)` → `articles`, URL: `tin-tuc/{slug}.html`
- Both use dual SEO metadata: RankMath primary, Yoast fallback

### 6. Redirects

- Source 1: `kd_rank_math_redirections` (40 rows, `status=active`)
  - `sources` field: JSON array with `pattern` key — parsed via regex
  - `url_to`: destination
  - `header_code`: 301/302
- Source 2: `kd_fg_redirect` (legacy plugin, lower priority)
- Source 3: `docs/legacy/SEO_REDIRECT_MAP.csv` (currently empty)
- Target: `redirects`
- Polylang `vi/` and `en/` prefix redirects already in RankMath rows

### 7. Menus

- Source: `kd_terms (taxonomy=nav_menu)` + `kd_posts (post_type=nav_menu_item)` + `kd_postmeta (_menu_item_*)`
- Target: `menus` + `menu_items`
- Key meta: `_menu_item_url`, `_menu_item_title`, `_menu_item_menu_item_parent`, `_menu_item_target`, `_menu_item_classes`

### 8. Customers

- Source: `kd_users` + `kd_usermeta (billing_* / shipping_*)`
- Target: `customers` + `customer_addresses`
- phpass hashes stored as `legacyPasswordHash` (not migrated as bcrypt; used for backward-compat login)
- Guest orders: `isSynthetic=true`, derived from order billing meta
- Exclude: administrators, editors

### 9. Orders (Legacy WooCommerce, HPOS OFF)

- Source: `kd_posts (post_type=shop_order)` + `kd_postmeta` + `kd_woocommerce_order_items` + `kd_woocommerce_order_itemmeta`
- Target: `orders` + `order_line_items` + `order_addresses` + `order_shipping_items` + `order_applied_coupons`
- WC status map: `wc-pending`→PENDING_PAYMENT, `wc-processing`→PROCESSING, `wc-completed`→COMPLETED, `wc-cancelled`→CANCELLED, `wc-refunded`→REFUNDED
- Order number: `_order_number` postmeta, fallback post ID

### 10. Coupons

- Source: `kd_posts (post_type=shop_coupon)` + `kd_postmeta`
- Target: `coupons`
- discount_type map: `percent`→PERCENT, `fixed_cart`/`fixed_product`→FIXED
- `post_status=trash` → status=ARCHIVED

### 11. Settings

- Source: `kd_options` (safe keys whitelist)
- Target: `site_settings`
- Import: `blogname`, `blogdescription`, `admin_email`, `woocommerce_currency`, `woocommerce_weight_unit`
- Exclude: auth keys, salts, secrets, DB credentials, any key containing `secret/password/key/token/salt`

---

## D. Importer Architecture

### Package layout

```
migration/wordpress/
├── config/
│   └── WordPressMigrationProperties.java   — @ConfigurationProperties, disabled by default
├── inventory/
│   └── WordPressDumpInventoryService.java  — streaming table detector, prefix detection
├── parser/
│   └── WordPressCsvRedirectReader.java     — streaming CSV parser for redirect map
├── mapper/
│   ├── WordPressProductMapper.java
│   ├── WordPressMediaMapper.java
│   ├── WordPressCustomerMapper.java
│   ├── WordPressOrderMapper.java
│   ├── WordPressCouponMapper.java
│   ├── WordPressMenuMapper.java
│   └── WordPressRedirectMapper.java
├── model/
│   ├── WpPost.java
│   ├── WpPostMeta.java
│   ├── WpTerm.java
│   ├── WpTermTaxonomy.java
│   ├── WpUser.java
│   ├── WpUserMeta.java
│   ├── WpOrderItem.java
│   ├── WpOrderItemMeta.java
│   ├── WpAttachmentMeta.java
│   └── WpRedirectRow.java
├── report/
│   └── MigrationDryRunReport.java          — accumulates mapped/skipped/warnings per domain
└── service/
    └── WordPressMappingPlanService.java    — full domain mapping plan (12 domains)
```

### Streaming design

- `WordPressDumpInventoryService.detectTables()` reads line by line via `BufferedReader` — safe for 128 MB+ files.
- `WordPressCsvRedirectReader.parse()` accepts any `Reader` — testable with `StringReader`, production uses `FileReader`.
- All mapper inputs are plain Java records — no JPA entity dependency, fully unit-testable.

### Dry-run report design

`MigrationDryRunReport` is a builder that accumulates per-domain stats:
- `sourceCount` — rows found in dump
- `mappedCount` — rows successfully mapped
- `skippedCount` — rows excluded (invalid status, missing required fields, etc.)
- `warnings` — non-fatal issues
- `unmappedFields` — fields present in source but without a target mapping

All stat collection happens in memory. No DB writes in Phase 2A.

---

## E. Fixture Tests

### Test fixture files

| File | Purpose |
|---|---|
| `fixtures/wordpress/wp_sample_dump_header.sql` | Minimal CREATE TABLE statements with `kd_` prefix for inventory tests |
| `fixtures/wordpress/wp_sample_posts.sql` | 7 sample posts: product, attachment, page, article, coupon, order, nav_menu_item |
| `fixtures/wordpress/wp_sample_postmeta.sql` | Corresponding postmeta for all sample posts |
| `fixtures/wordpress/wp_sample_terms.sql` | Terms and term_taxonomy: product_cat, pwb-brand, product_tag, nav_menu, category |
| `fixtures/wordpress/seo_redirect_sample.csv` | 4 sample redirect rows with valid CSV header |

### Test class: `Phase2AWordPressMigrationFoundationTest` — 20 tests

| # | Test |
|---|---|
| 1 | `inventory_detectsWpTablePrefixFromCreateTable` |
| 2 | `inventory_detectsCoreWordPressTables` |
| 3 | `inventory_detectsWooCommerceLegacyOrderTables` |
| 4 | `inventory_streamsDumpWithoutReadAllBytes` |
| 5 | `redirectCsvReader_validHeader_parsesRows` |
| 6 | `redirectCsvReader_missingHeader_returnsWarning` |
| 7 | `productMapper_mapsSkuPriceStockThumbnailGallery` |
| 8 | `mediaMapper_mapsAttachmentFileAltMetadata` |
| 9 | `customerMapper_mapsWpUserAndBillingMeta` |
| 10 | `orderMapper_mapsLegacyShopOrderBasics` |
| 11 | `couponMapper_mapsShopCouponBasics` |
| 12 | `menuMapper_mapsNavMenuItemBasics` |
| 13 | `mappingPlan_containsAllRequiredDomains` |
| 14 | `dryRunReport_countsMappedSkippedWarnings` |
| 15 | `migrationProperties_defaultDisabledAndDryRun` |
| 16 | `importerDoesNotRunOnApplicationStartup` |
| 17 | `openApiDocs_stillWork` |
| 18 | `adminAuth_stillWorks` |
| 19 | `publicCatalog_stillPublic` |
| 20 | `existing302TestsStillPass` |

---

## F. Gaps / Blockers for Real Migration

| Gap | Severity | Notes |
|---|---|---|
| `docs/legacy/SEO_REDIRECT_MAP.csv` empty | Low | Header present; RankMath 40 rows are the real source |
| PHP serialized data in postmeta | Medium | `_wp_attachment_metadata`, `_menu_item_classes` contain PHP `serialize()` format. Phase 2A uses regex extraction; Phase 2B needs full PHP-serialize parser or pre-processing |
| Physical media copy (8 GB) | High | wp-content/uploads not yet copied; paths recorded only. Phase 2E needed |
| phpass password hashes | Medium | Stored as legacyPasswordHash; customers cannot log in with new system until phpass verifier is implemented (Phase 2C) |
| RankMath sources JSON structure | Low | `sources` field is JSON array; regex extraction works for standard patterns; edge cases need validation |
| WooCommerce product variations | Medium | Mapped as `WpPost(post_type=product_variation)` — not fully modeled in Phase 2A mappers |
| Custom post types (video CPT) | Medium | `video` CPT URL variant unclear; needs confirmation from theme analysis |
| Order number format | Low | Falls back to post_id if `_order_number` missing — needs validation per actual dump |
| WP user role filtering | Low | Must exclude administrators/editors; `wp_capabilities` usermeta needs parsing |
| Permalink Manager Pro URI map | Medium | Serialized in `kd_options.permalink-manager_uris`; actual URL per post needs deserialization for redirect map generation |

---

## G. Recommended Next Phases

| Phase | Name | Scope |
|---|---|---|
| 2B | Catalog/Content/Media/Redirect dry-run importer | Parse real dump, map products/categories/brands/media/pages/articles/redirects/menus into in-memory result sets, generate dry-run report with counts |
| 2C | Customer/Order/Coupon dry-run importer | Parse customers (including phpass hash), orders (legacy WooCommerce), coupons; dry-run only |
| 2D | Real import command with idempotency + batch writes | Write to production DB with `sourceId`/`legacyId` dedup, transactional batches, resume-safe |
| 2E | Media copy/sync strategy | Copy 8 GB uploads to new storage; update media.storagePath; serve via CDN |
| 3 | Legacy URL / SEO alignment | Implement redirect middleware; validate all 40 RankMath redirects; populate CSV; canonical URL audit |

---

## H. Commands Executed

```
# From bigbike-backend/
./mvnw test
# Result: Tests run: 322, Failures: 0, Errors: 0, Skipped: 0 — BUILD SUCCESS

# From root
docker compose config
# Result: OK
```

---

## I. Safety Check

- No destructive import run — migration disabled by default.
- No production DB writes outside test fixtures.
- No SQL dump loaded into memory — all inventory uses streaming `BufferedReader`.
- No WordPress source files modified.
- No frontend changes.
- No API signatures changed.
- No secrets hardcoded.
- Existing 302 tests still pass (322 total = 302 prior + 20 new).
- `docker compose config` passes.
