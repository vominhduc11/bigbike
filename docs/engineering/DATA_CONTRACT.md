# Data Contract

## Canonical Data Notes

### Money

- Business intent is VND pricing.
- Current backend DTOs commonly serialize Java `BigDecimal` amounts with scale `2`, which appears in JSON and tests as values like `50000.00`.
- Do not document fractional business meaning for VND; document the current serialized shape instead.

Status: `CONFIRMED_FROM_CODE`

Evidence:

- `CartService.java`
- `CheckoutService.java`
- cart and checkout tests

### Media fields

- Canonical public media shape remains `image`, `gallery[]`, and `videos[]` at the product/content contract level.
- Admin media persistence stores `publicUrl`, `mimeType`, `fileSize`, dimensions, status, and storage metadata.
- Allowlist includes common raster images (`image/jpeg|png|webp|gif`), `image/svg+xml`, MP4 video, and selected audio. SVG is accepted but **sanitized on upload** (`SvgSanitizer`) — scripts, event handlers, `javascript:`/external refs and CSS vectors are stripped before storage. `fileSize` for SVG reflects the sanitized bytes; no raster variants/dimensions are generated.

Status: `CONFIRMED_FROM_CODE`

Evidence:

- `AdminMediaService.java`
- product/content DTO mappings in repo

### SKU fields

`product.sku` and `variant.sku` are two different things despite sharing a name.

| Field | DB column | Role | Required? |
|---|---|---|---|
| `product.sku` | `products.sku varchar(100)` | **Model code / group code** — optional descriptive identifier for the product family. Not used as the selling code when variants exist. | Optional (nullable, no unique constraint) |
| `variant.sku` | `product_variants.sku varchar(100)` | **Selling SKU** — the code used in cart, checkout, and inventory to identify the actual unit sold. | **Required + globally unique** on the admin upsert API (`@NotBlank` + case-insensitive uniqueness; see `BUSINESS_RULES.md` → `PRODUCT_RULE_SKU_001`). Enforced by partial unique index `ux_product_variants_sku_lower` on `lower(sku)` (V244). Column stays nullable (index ignores nulls) so the requirement is write-time, not a schema `NOT NULL`. |

When snapshotting line items into cart/order, the system uses `variant.sku` first, falling back to `product.sku`. This fallback supports products that have no variants (where `product.sku` is the selling code) and legacy variants whose `sku` is still null (created before the requirement / WP-import).

Inventory views surface both fields (`product_sku`, `variant_sku`) so admin tools can locate stock by either code.

Status: `CONFIRMED_FROM_CODE`

Evidence:

- `ProductEntity.java` (line 34)
- `ProductVariantEntity.java` (line 29)
- `PosOrderService.java` (line 233)
- `CartService.java` (line 153)
- `CheckoutService.java` (line 723)
- `V1__create_catalog_content_tables.sql` (lines 65, 166)

### Cost price (admin-only)

`products.cost_price` and `product_variants.cost_price` (`numeric(19,2)`, nullable, `>= 0`; added in `V195`) store the purchase/cost price. (These columns formerly backed the POS below-cost guard, which was removed with the POS module 2026-06-23; cost price is retained for margin reporting.) Resolution mirrors selling price: **variant cost first, then product cost**; `NULL` means cost is unknown.

**Cost is admin-only and must never reach the storefront.** The shared `ProductPrice` domain record carries `costPrice`, but it is populated **only on admin (non-public) reads** (`publicView == false`); public reads pass `null`, and the public DTO `ProductSnapshotResponse` maps an explicit price subset (`retailPrice`, `compareAtPrice`, `salePrice`) that excludes cost entirely. Admin sets it via the product create/update API (`UpsertProductRequest.costPrice`, `VariantRequest.costPrice`).

Status: `CONFIRMED_FROM_CODE`

Evidence:

- `ProductPrice.java` (`costPrice` field), `ProductSnapshotResponse.java` (public subset excludes cost)
- `JpaCatalogReadRepository.java` (admin vs `publicView ? null` cost), `AdminCatalogMutationService.java` (`applyProductPatch` / `applyVariants`)
- `PosOrderService.resolveCost` / below-cost guard; `V195__add_cost_price.sql`

### Address fields

`CustomerAddressResponse` currently contains:

- `id`
- `type`
- `fullName`
- `phone`
- `country`
- `province`
- `district`
- `ward`
- `addressLine1`
- `addressLine2`
- `isDefault`

Status: `CONFIRMED_FROM_CODE`

Evidence:

- `CustomerAddressResponse.java`
- `SaveCustomerAddressRequest.java`

### POS order snapshot fields — REMOVED (owner decision 2026-06-23, online-only)

The POS flow was removed entirely; there is no longer any code that writes `channel`/`fulfillmentType = IN_STORE`, `source = 'pos'`, a `POS` payment provider, or an immediate `COMPLETED + PAID` POS order. Legacy POS orders were purged from the database.

The `orders.channel`, `orders.fulfillment_type`, and `orders.source` columns **still exist** — online orders use `fulfillmentType = DELIVERY` and `channel = WEB`. Only the `IN_STORE` / `'pos'` values are no longer written. `AdminOrderListItemResponse.source` is retained on the order list/detail responses but only ever carries online values now.

**Phone normalization:** `customers.phone` is stored in normalized form (`PhoneNumbers.normalize`: strip spaces/dashes, `+84`/`84` → `0`) consistently across **online registration, login, profile update, and admin customer edit**. This makes phone a reliable identity key (the same person typing `+84…` or `0…` resolves to one profile). Lookups also try the `+84…` variant so pre-existing rows stored before this change (no backfill performed) still match. The WordPress importer (`CustomerImporter`) is intentionally excluded — historical import data is left as-is.

Status: `CONFIRMED_FROM_CODE`

### Admin invite (email-based admin user onboarding)

Admin users are onboarded by **email invite**, not by an admin typing a password. Schema impact (`V201__admin_invite_tokens.sql`):

- `admin_users.password_hash` is now **nullable** — an `INVITED` user has no password until they accept. Login (`AdminAuthService.login`) rejects any account whose `password_hash` is null.
- New table `admin_invite_tokens`: `id` (uuid PK), `admin_user_id` (uuid, FK → `admin_users`, `ON DELETE CASCADE`), `token_hash` (varchar(64), unique — SHA-256 of the raw token, raw token never stored), `expires_at` (timestamptz, default 48h), `used_at` (timestamptz, null until accepted), `created_at` (timestamptz). One active (unused, unexpired) token per user; creating/resending an invite deletes the user's prior tokens first.

Flow: create admin (`admin-users.write`) → row inserted `status = INVITED`, no password, invite token + email sent → invitee opens `{ADMIN_BASE}/accept-invite?token=…` → `POST /api/v1/auth/admin/accept-invite` sets password, flips `status = ACTIVE`, consumes the token.

Account lockout (`V283__admin_login_lockout.sql`): two columns added to `admin_users`:
- `failed_login_attempts` (integer, `NOT NULL DEFAULT 0`) — running count of consecutive failed password attempts.
- `locked_until` (timestamptz, nullable) — when set and in the future, `AdminAuthService.login` refuses the attempt before checking the password.

After 5 consecutive failures the account is locked for 15 minutes (`AdminLoginAttemptService`, `REQUIRES_NEW` so the counter survives the rejected login). A successful login clears both columns. See `PERMISSION_MATRIX.md` → "Admin Login Security".

Status: `CONFIRMED_FROM_CODE`

### Return / Refund data — removed (2026-06-23)

> **Removed (2026-06-23).** The Return (RMA) and Refund data model — `returns` / `return_items` / `return_history` tables, the `refund_amount` / `refund_reason` / `refunded_at` columns on `orders` & `payments`, and the `REFUNDED` value on order status & payment_status — was dropped. Old REFUNDED orders were migrated to CANCELLED.

## Inventory Model

> **Serial-number tracking was REMOVED platform-wide (2026-06-23, V259).** `product_serials`, `order_line_item_serials`, `return_item_serials`, `stock_movement_serials`, the `track_serials` columns, the serial→quantity sync trigger (`fn_sync_qty_from_serial_lifecycle`), and the `serial_inventory_only` / `reservation_ttl_minutes` settings are all dropped.
>
> **Inventory switched to a BOOLEAN availability model (2026-06-23, V261).** There is no tracked stock **quantity** anymore. Availability is a per-variant / per-product boolean that the admin toggles by hand.

- Availability is a **boolean**, not a quantity:
  - **Per variant** — `product_variants.is_available` (existing column) is the **sole gate**. The variant's `stock_state` mirrors it: `IN_STOCK` if available, else `OUT_OF_STOCK`.
  - **Per product without variants** — `products.stock_state` (`IN_STOCK` / `OUT_OF_STOCK`) is set **directly** by the admin toggle. `products.force_out_of_stock` remains a hard override.
  - **Product with variants** — `stock_state` = `IN_STOCK` if **any** variant `is_available`, else `OUT_OF_STOCK`.
- **Dormant quantity columns:** `product_variants.quantity_on_hand`, `products.stock_quantity` and `products.manage_stock` are **kept but no longer read** for availability. The `low_stock_threshold` site setting was **removed (V279)**.
- **No quantity behavior:** no stock validation by quantity, no auto-decrement on sale, no stock restore on cancel, and **no stock movements written for sales or restores**. Selling does not change availability; the admin must manually mark an item "Hết hàng" when it sells out (overselling is not auto-prevented). The `stock_movements` ledger is dormant for this model.
- `LOW_STOCK` was **removed from the enum (V279)**. There is no "low stock" tier.
- Receipt-based receiving (`stock_receipts`, `stock_receipt_lines`, `stock_receipt_serials`) was **dropped in V120** — schema-only, never implemented in Java.

Status:

- boolean availability model: `CONFIRMED_FROM_CODE` (V261 — 2026-06-23)
- quantity columns (`quantity_on_hand` / `stock_quantity` / `manage_stock`): `DORMANT` (kept, not used)
- serial model: `REMOVED` (V259 — 2026-06-23)
- receipt workflow: `REMOVED` (V120 — dropped, never implemented)

Evidence:

- `AdminInventoryService.java`
- `AdminInventoryController.java` (availability PATCH endpoints)
- `CheckoutService.java` (per-variant `isAvailable` gate)
- `V120__drop_stock_receipt_tables.sql`
- `V259__remove_serial_management.sql`
- `V261__inventory_availability_toggle.sql` (backfilled `is_available` + `stock_state` from current quantities)

### warranty_records — removed (2026-06-23, V266) `CONFIRMED_FROM_CODE`

> **Removed (2026-06-23, V266).** The `warranty_records` table and the entire warranty feature were dropped — no warranty entity, no per-order-line warranty creation on `COMPLETED`/POS sale, no void, and no `default_warranty_months` setting. Lookup is gone too. Customer-facing warranty wording survives only as CMS policy content and per-product marketing rows (`product_purchase_lines`).

Evidence:

- `V266__remove_warranty.sql`

### stockState — derived from boolean availability `CONFIRMED_FROM_CODE`

`stockState` trên `product_variants` và `products` chỉ còn **hai trạng thái** (`IN_STOCK` / `OUT_OF_STOCK`), **mirror trực tiếp** từ cờ availability — **không** còn tính từ số lượng. `LOW_STOCK` đã được gỡ khỏi enum (V279).

| Bảng | Availability gate | stockState owner |
|---|---|---|
| `product_variants` | `is_available` (boolean) | `variant.stockState` = `IN_STOCK` nếu `is_available`, else `OUT_OF_STOCK` |
| `products` (không variant) | admin toggle | `product.stockState` set trực tiếp (`IN_STOCK` / `OUT_OF_STOCK`) |
| `products` (có variant) | aggregate | `IN_STOCK` nếu **bất kỳ** variant `is_available`, else `OUT_OF_STOCK` |

**Cột số lượng `quantity_on_hand` / `stock_quantity` / `manage_stock` giờ DORMANT** — giữ trong DB nhưng không đọc cho availability. `low_stock_threshold` đã gỡ (V279).

**API input contract:** `stockState` bị bỏ khỏi `UpsertProductRequest` và `VariantRequest`. Availability đổi qua Inventory module (`PATCH .../availability`), không qua catalog create/update API.

**API response contract:** `stockState` vẫn có trong response (read-only). Public `stockQuantity` (product & variant) **luôn null** — storefront chỉ hiển thị "Còn hàng / Hết hàng".

**forceOutOfStock:** field này vẫn là manual override (hard disable) và khác biệt với `stockState`. Checkout sẽ từ chối ngay cả khi `stockState = IN_STOCK` nếu `forceOutOfStock = true`.

Evidence:

- `AdminInventoryService.java` / `AdminInventoryController.java` (availability toggle)
- `AdminCatalogMutationService.java` (removed stockState from create/update path)
- `CheckoutService.java` (per-variant `isAvailable` gate)
- `BUSINESS_RULES.md` STOCK_RULE_001–009
- `V165__aggregate_variant_product_stock_state.sql` (trigger giữ `products.stockState` đồng bộ với variants)
- `V261__inventory_availability_toggle.sql` (boolean availability; backfill `is_available` + `stock_state` từ số lượng hiện tại — 2026-06-23)

### Product rich-text content fields

Four independent rich-HTML columns on the `products` table feed distinct
section bands of the product detail page (PDP). All are admin-editable, optional
(nullable), stored as `TEXT`, and limited to 50 000 characters by the upsert
DTO (`@Size(max = 50000)`).

| Field | DB column | PDP surface |
|---|---|---|
| `description` | `description` | "Mô tả sản phẩm" section band |
| `promotionContent` | `promotion_content` (added `V124__add_product_promotion_content.sql`) | **DEPRECATED 2026-06-18** — gỡ khối render trên PDP web + ô nhập trong admin; cột vẫn còn (ngủ, không xóa) nên dữ liệu cũ được giữ. Không còn surface trên trang sản phẩm. |
| `installationGuide` | `installation_guide` (added `V133__add_product_installation_guide_and_faq.sql`; format đổi ở `V242__convert_installation_guide_to_steps.sql`) | "Hướng dẫn lắp đặt" section band — **JSON object có cấu trúc** `{ steps: [{ icon, title, body, tip?, warning? }], maintenance? }` (trước V242 là rich-HTML tự do). Web parse JSON → lưới các bước (số thứ tự + icon + tiêu đề + nội dung + hộp mẹo/cảnh báo) + ghi chú bảo dưỡng cuối. `icon` dùng chung cả vi/en (ghi vào cả hai cột); `steps[]` bản `_en` mirror theo index. Hidden when empty. Còn lưu opaque như `size_guide` — backend không parse. |
| `contentBottom` | `content_bottom` (added `V43`) | Long-form SEO copy band below the related-products grid |

`promotionContent` and `installationGuide` are surfaced on both the public
product detail response and the admin product read response (they are
components of the domain `Product` record). Empty/blank values are normalized
to `NULL` on write. `installationGuide` lưu **chuỗi JSON opaque** (bilingual qua
cột `_en`); backend truyền nguyên chuỗi, admin/web parse JSON ở hai đầu — giống
`suitability_advisory`.

Status: `CONFIRMED_FROM_CODE`

### Product PDP content — `suitability_advisory` (V237)

> **Đã gỡ (V250):** cặp cột `quick_answer_summary` / `quick_answer_summary_en`
> ("Quick Answer" — blockquote AIO 40–60 từ, thêm ở V236) đã bị **drop hoàn toàn**.
> Trường gỡ khỏi entity/DTO/domain, web PDP không còn render, ô nhập admin đã bỏ.
> Dữ liệu cũ xoá vĩnh viễn qua `V253__drop_product_quick_answer_summary.sql`.

Bilingual dual-column field cho khối "Phù hợp với ai" trên PDP. Follows the
`shortDescription`/`sizeGuide` dual-text pattern: canonical (vi) column + `_en`
column, `pick(vi, en, locale)` on read, raw English surfaced in `translations.en`
for the admin editor.

| Field | DB columns (added) | Type | PDP surface |
|---|---|---|---|
| `suitabilityAdvisory` | `suitability_advisory` + `suitability_advisory_en` (`V237`; format đổi ở `V240__convert_suitability_advisory_to_cards.sql`) | `TEXT`, max 20 000 | "Phù hợp với ai" — **JSON array các thẻ tư vấn** `[{ audience, advice, linkLabel?, linkUrl? }]` (trước V240 là rich-HTML). Web parse JSON → mỗi item một thẻ (đối tượng in đậm + lời khuyên + link nội bộ tùy chọn); `linkUrl` dùng chung cả vi/en, mảng `_en` mirror theo index. Hidden when empty. |

It is detail-only (null in list responses), nullable, presence-flag on PATCH,
empty/blank normalized to `NULL`. The PDP "Hoàn thiện bộ bảo hộ — Có thể bạn cũng
cần" block reuses the existing `relatedProducts` (no new cross-sell column).

Status: `CONFIRMED_FROM_CODE`

### Product specs HTML — `specifications_html` (V255, mô hình "HTML là nguồn" — cập nhật)

`specifications_html` là **nguồn render DUY NHẤT** của tab "Thông số kỹ thuật" trên web. Theo
đúng `shortDescription`/`suitability_advisory` dual-text pattern: cột canonical (vi) + `_en`,
`pick(vi, en, locale)` on read, raw English surfaced in `translations.en` cho admin editor.

| Field | DB columns (added) | Type | PDP surface |
|---|---|---|---|
| `specificationsHtml` | `specifications_html` + `specifications_html_en` (`V255`) | `TEXT`, max 50 000 | Web **luôn** render HTML này (qua `sanitizeRichHtml`, **cho phép `<table>` và CSS inline `style`**). Bảng con `specifications` có cấu trúc chỉ còn là **lưới an toàn legacy** khi `specifications_html` rỗng. |

It is detail-only (null in list responses), nullable, presence-flag on PATCH,
empty/blank normalized to `NULL`. **Admin UX (không đổi contract):** ô "Thông số kỹ thuật" có 2 tab —
nhập "có cấu trúc" (dòng tên/giá trị) HOẶC "dán HTML"; **cả 2 cùng ghi vào `specificationsHtml`**.
Tab cấu trúc chỉ là công cụ nhập: sửa dòng được GHÉP vào HTML hiện có (giữ nguyên `style`/markup,
chỉ đổi chữ — helper `lib/specSheet.js`). Chuyển HTML→cấu trúc thì parse HTML lấy chữ (bỏ CSS).
Khi nạp sản phẩm cũ chưa có `specifications_html`, admin sinh HTML từ bảng `specifications` để
không mất nội dung. HTML thô được sanitize ở web (`sanitizeRichHtml` với `allowInlineStyles`),
không parse/sanitize ở backend (opaque như `suitability_advisory`).

Status: `CONFIRMED_FROM_CODE` — `ProductEntity.specificationsHtml`/`specificationsHtmlEn`,
`Product.specificationsHtml`, `ProductTranslations.ProductContent.specificationsHtml`,
`UpsertProductRequest` (+ presence flag) / `ProductTranslationRequest`,
`AdminCatalogMutationService.applyProductPatch` / `ProductFieldApplier.applyTranslations`,
`JpaCatalogReadRepository` (detail mapper `pick`s it; list mapper passes `null`),
migration `V255__add_product_specifications_html.sql`.

### Product spec-stats HTML — `spec_stats_html` (V256, mô hình "HTML là nguồn")

`spec_stats_html` là **nguồn render** của khối "Ô số liệu nổi bật" (specStats) dưới khu mua hàng trên
web. Mô hình giống `specifications_html` (V255): cột canonical (vi) + `_en`, `pick(vi, en, locale)`
on read, raw English trong `translations.en`, detail-only, presence-flag on PATCH, blank→`NULL`.

| Field | DB columns (added) | Type | PDP surface |
|---|---|---|---|
| `specStatsHtml` | `spec_stats_html` + `spec_stats_html_en` (`V256`) | `TEXT`, max 50 000 | Khi non-blank, web **render HTML này** (qua `sanitizeRichHtml` với `allowInlineStyles`) THAY cho lưới `specStats` có cấu trúc; rỗng → lưới ô số liệu có cấu trúc (`product_spec_stats`) làm lưới an toàn legacy. |

**Admin UX (không đổi contract):** khối có 2 tab — nhập "có cấu trúc" (mỗi ô tối đa 3 dòng: **value**
số liệu chính + **unit** đơn vị/chú thích TÙY CHỌN + **label** tên chỉ tiêu, tối đa 4 ô) HOẶC
"dán HTML"; cả 2 cùng ghi vào `specStatsHtml`. Tab cấu trúc là công cụ nhập: sửa được GHÉP vào HTML
hiện có (giữ style/markup, chỉ đổi chữ — helper `lib/specStatsBlock.js`, lưới sinh ra có class
`bb-specstats` + inline-style tự chứa mô phỏng `FeaturedSpecsBar`). Mỗi ô mã hoá theo **số span**: 2
span = `[value, label]` (không đơn vị — gồm cả HTML legacy chỉ-2-dòng), 3 span = `[value, unit, label]`;
`value` luôn span đầu, `label` luôn span cuối → parse không nhập nhằng, sản phẩm cũ 2 dòng vẫn đọc đúng.
Lưu ý: dòng `unit` chỉ nằm TRONG `specStatsHtml`; mảng `specStats` có cấu trúc (`product_spec_stats`,
fallback legacy) vẫn chỉ `{value, label}` — đúng mô hình "HTML là nguồn". HTML→cấu trúc parse lấy chữ (bỏ
CSS). Nạp sản phẩm cũ chưa có `spec_stats_html` → admin sinh HTML từ lưới `specStats`. Status:
`CONFIRMED_FROM_CODE` — `ProductEntity.specStatsHtml`/`specStatsHtmlEn`, `Product.specStatsHtml`,
`UpsertProductRequest`(+presence)/`ProductTranslationRequest`, `AdminCatalogMutationService` /
`ProductFieldApplier`, `JpaCatalogReadRepository`/`JpaCatalogReadSupport`, migration
`V256__add_product_spec_stats_html.sql`.

### Product trust-badges HTML — `trust_badges_html` (V257, mô hình "HTML là nguồn")

`trust_badges_html` là **nguồn render** của khối "Dải tin cậy" (trustBadges) trên tên sản phẩm ở web.
Mô hình giống `spec_stats_html` (V256): cột vi + `_en`, `pick` per-locale, raw EN trong
`translations.en`, detail-only, presence-flag, blank→`NULL`.

| Field | DB columns (added) | Type | PDP surface |
|---|---|---|---|
| `trustBadgesHtml` | `trust_badges_html` + `trust_badges_html_en` (`V257`) | `TEXT`, max 50 000 | Khi non-blank, web **render HTML này** (qua `sanitizeRichHtml` với `allowInlineStyles`) THAY cho dải `trustBadges` có cấu trúc; rỗng → dải badge có cấu trúc (`product_trust_badges`) làm lưới an toàn legacy. |

**Admin UX:** 2 tab (cấu trúc: danh sách nhãn ngắn / dán HTML), cùng ghi `trustBadgesHtml`; sửa cấu
trúc GHÉP vào HTML giữ style + chấm tròn, chỉ đổi chữ (helper `lib/trustBadgesBlock.js`, class
`bb-trust-badges`). Nạp sản phẩm cũ → sinh HTML từ dải `trustBadges`. Status: `CONFIRMED_FROM_CODE` —
migration `V257__add_product_trust_badges_html.sql` (+ thread `ProductEntity`/`Product`/
`ProductTranslations`/`UpsertProductRequest`/`ProductTranslationRequest`/mutation+read như V256).

### Product description blocks — `description_blocks` (V139)

Admin-curated structured content stored as JSONB in `products.description_blocks` (nullable). The column holds a JSON array of block objects — the **structured** source of truth for the "Mô tả sản phẩm" section. The mutation service renders blocks to HTML and writes the result into the existing `description` (TEXT) column simultaneously, so public consumers see no change.

Eleven block types (8 gốc + 3 khối PDP chuyên biệt V246):

| `type` | Required fields | Optional fields |
|---|---|---|
| `heading` | `level` (2 or 3), `text` (≤ 500 chars) | — |
| `paragraph` | `html` (≤ 50 000 chars; inline `<b><i><a><br>` only) | — |
| `list` | `style` (`bulleted`\|`numbered`), `items` (1–200 strings, each ≤ 2 000 chars) | — |
| `image` | `url` (≤ 2 000 chars) | `alt` (≤ 500), `caption` (≤ 500) |
| `video` | `provider` (`youtube`\|`tiktok`\|`facebook`\|`upload`), `url` (≤ 2 000 chars) | `caption` (≤ 500) |
| `callout` | `variant` (`info`\|`warning`\|`note`), `html` (≤ 10 000 chars) | — |
| `divider` | — | — |
| `feature` | `url` (≤ 2 000 chars) | `side` (`auto`\|`left`\|`right`, mặc định `auto`), `alt` (≤ 500), `caption` (≤ 500), `subheading` (≤ 500), `heading` (≤ 500), `html` (≤ 50 000), `listStyle` (`bulleted`\|`numbered`), `items` (≤ 200 strings, each ≤ 2 000 chars) |
| `suitability` (V246) | — | `title` (≤ 500), `html` (≤ 20 000; **nguồn render web**, cho phép `<table>` + CSS inline). `cards` chỉ là lưới an toàn legacy — payload mới CHỈ gửi `html` (xem dưới) |
| `sizeGuide` (V246) | — | `title` (≤ 500), `html` (≤ 20 000; **nguồn render web**, cho phép thẻ `<table>` + CSS inline) |

**2 khối PDP chuyên biệt (V246) — chỉ dùng cho SẢN PHẨM:** `suitability` (Phù hợp với ai), `sizeGuide` (Bảng size). Bản EN nằm ở khối tương ứng trong `description_blocks_en` (theo vị trí). **Mô hình mới (cập nhật):** `html` là **nguồn render DUY NHẤT** của cả 2 khối trên web. Cả 2 hỗ trợ 2 tab nhập ở admin — "có cấu trúc" HOẶC "dán HTML" — **cùng ghi vào field `html`**. Tab cấu trúc chỉ là công cụ nhập: thao tác (`sizeGuide`: cột/dòng/ghi chú; `suitability`: thẻ đối tượng/lời khuyên/link) được **GHÉP vào `html` hiện có, giữ nguyên CSS/markup, chỉ đổi chữ** (helpers `lib/sizeChart.js`, `lib/suitabilityCards.js`). Chuyển HTML→cấu trúc thì parse `html` lấy chữ (bỏ CSS); thêm dòng/thẻ nhân bản phần tử cuối (kế thừa CSS). **Payload chỉ gửi `html`** cho 2 khối này (suitability bỏ `cards` khỏi payload — `cleanDescriptionBlocks`); `cards` chỉ còn là lưới an toàn legacy khi `html` rỗng (admin sinh `html` từ `cards` lúc nạp để không mất nội dung). HTML thô được sanitize ở web (`sanitizeRichHtml` với `allowInlineStyles` → **giữ `style` inline**, vẫn chặn script/onclick/javascript:); admin preview dùng `sanitizeHtml` đã mở `style`. **Ưu/Nhược điểm (`prosCons`) ĐÃ TÁCH RA khỏi mô tả (V251)** — quay lại là khối RIÊNG cố định ngay dưới mô tả, ngoài tab; nguồn dữ liệu là bảng con `product_highlights` (xem §Ưu điểm/Nhược điểm), KHÔNG còn là khối trong `description_blocks`. Subtype `ProsConsBlock` vẫn còn trong sealed interface (dormant, để deserialize an toàn dữ liệu cũ); migration `V251` gỡ mọi khối `prosCons` còn sót trong `description_blocks`/`_en`.

**`feature` — hàng ảnh + chữ 2 cột (thêm sau V139, code-only):** Gói chung 1 ảnh + tiêu đề phụ (`subheading`, eyebrow) + tiêu đề chính (`heading`) + đoạn mô tả (`html`) + danh sách vào MỘT khối, render thành khối 2 cột ảnh–chữ trên web (chỉ desktop; mobile xếp dọc). `side`=`auto`/null → các khối `feature` liên tiếp tự xen kẽ trái/phải (so le); `left`/`right` ép vị trí ảnh. Chỉ `url` bắt buộc. **Khối này thay thế cơ chế "ghép ngầm" cũ** (web từng tự gom một khối `image`/`video` + cụm `text` liền sau thành hàng 2 cột) — cơ chế ghép ngầm đã được GỠ BỎ; muốn 2 cột phải dùng khối `feature`.

**Vốn từ khối GIỚI HẠN ở phạm vi SẢN PHẨM (V238 + V246 + V251):** Trình soạn mô tả sản phẩm (và tab tự do của sản phẩm) cho tạo **6 khối**: `paragraph` (chỉ văn bản — ô rich-text chứa được `h2/h3/ul/ol/bold/link`), `image` (chỉ ảnh), `feature` với `side="right"` (ảnh phải) / `side="left"` (ảnh trái), và 2 khối PDP `suitability` / `sizeGuide`. **`prosCons` đã gỡ khỏi vốn từ khối (V251)** — Ưu/Nhược điểm nhập ở card riêng, là khối cố định ngoài mô tả. Các loại `heading`/`list`/`callout`/`divider`/`video` đứng riêng **không còn được tạo cho sản phẩm**. Sealed interface `DescriptionBlock` vẫn GIỮ đủ các subtype vì **dùng chung với Content** (Article/Page/Contact vẫn cần heading/list/…). Migration `V238__ConsolidateProductDescriptionBlocks.java` gộp dữ liệu sản phẩm cũ (`products.description_blocks` + `description_blocks_en` + `product_tabs` custom blocks/blocksEn) về vốn từ 4 khối: mỗi mục (heading + đoạn/list/callout đi liền sau) gộp thành MỘT khối `paragraph` rich-HTML (giữ nguyên nội dung), `divider` bị bỏ (web tự kẻ vạch giữa khối), `image`/`feature` giữ nguyên. Idempotent (chỉ rewrite hàng có loại khối ngoài 4-vocab hoặc gộp được).

**Presence semantics (PATCH):** Sending `descriptionBlocks` (including `[]`) triggers rendering and overwrites **both** columns (`description_blocks` and `description`). Omitting the key leaves both columns untouched.

**Read:** `description_blocks` is returned on product detail responses (public and admin) as `descriptionBlocks: BlockObject[] | null`. Not included in list responses (null).

**HTML sanitizer:** Rendered HTML is sanitized (Jsoup `Safelist`) before writing to `description` to block XSS vectors (`<script>`, `on*` handlers, `javascript:` URIs).

Status: `CONFIRMED_FROM_CODE` — `DescriptionBlock.java` (sealed interface, `FeatureBlock` có `subheading`), `DescriptionBlocksConverter`, `ProductEntity.descriptionBlocks`, `DescriptionBlockRenderer` (gồm `renderFeature` render eyebrow), `AdminCatalogMutationService.applyProductPatch`, migration `V139` + `V238` (gộp sản phẩm về 4 khối) + `V251` (gỡ khối `prosCons`). Admin `BlockEditor` chạy `productMode` hiện 6 khối (4 + 2 khối PDP `suitability`/`sizeGuide`); Content giữ đủ khối. `DescriptionBlockRenderer` render các khối ra HTML SEO; `JpaCatalogReadRepository.toHighlights` đọc `positiveNotes`/`negativeNotes` từ bảng con `product_highlights` (V251 — không còn suy ra từ khối). Subtype `ProsConsBlock` giữ lại dormant trong sealed interface để deserialize an toàn dữ liệu cũ.

### Product FAQ entries — `product_faqs` (V133)

Per-product list of question/answer pairs rendered in the PDP "Câu hỏi
thường gặp" section band and emitted as `FAQPage` JSON-LD. Child table of
`products`, mirroring the `product_specifications` pattern.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | `BIGINT` identity | NO | Primary key. |
| `product_id` | `VARCHAR(64)` | NO | FK → `products.id`, `ON DELETE CASCADE`. |
| `sort_order` | `INTEGER` | NO | Display order; assigned by the admin editor. |
| `question` | `VARCHAR(500)` | NO | FAQ question. |
| `answer` | `TEXT` | NO | FAQ answer (sanitized rich-text **HTML** authored via the admin TipTap editor; max 20 000 chars at the DTO). The web PDP renders it through `sanitizeRichHtml` inside a `.wyswyg` block; the `FAQPage` JSON-LD strips it to plain text. Legacy plain-text answers render unchanged (no tags). |

The upsert DTO accepts at most 50 FAQ entries (`@Size(max = 50)`). Rows with a
blank question or answer are dropped on write. Exposed on the public and admin
product detail responses as the `faqs` array on the domain `Product` record;
omitted from product *list* responses (detail-only, like `specifications`).

Status: `CONFIRMED_FROM_CODE` — `ProductFaqEntity`, `ProductFaq` domain record,
`FaqRequest`, `AdminCatalogMutationService.applyFaqs`, migration `V133`.

### Product commitment rows — `product_commitments` (V232)

Per-product list of commitment rows rendered under the add-to-cart / buy-now
buttons on the PDP (`WpPurchaseSection.tsx`). **Replaces** the former global
`public_product` commitment settings (V228) — each product now owns its own rows.
Child table of `products`, mirroring the `product_faqs` pattern with bilingual
inline columns.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | `BIGINT` identity | NO | Primary key. |
| `product_id` | `VARCHAR(64)` | NO | FK → `products.id`, `ON DELETE CASCADE`. |
| `sort_order` | `INTEGER` | NO | Display order; assigned by the admin editor. |
| `icon` | `VARCHAR(40)` | NO | Icon key from the fixed web set (e.g. `truck`, `refresh-cw`, `shield-check`); unknown → web falls back to `shield-check`. |
| `title` | `VARCHAR(200)` | NO | Row title (Vietnamese / canonical). |
| `subtitle` | `VARCHAR(300)` | YES | Optional row subtitle. |
| `title_en` | `VARCHAR(200)` | YES | Optional English title; null → falls back to `title`. |
| `subtitle_en` | `VARCHAR(300)` | YES | Optional English subtitle; null → falls back to `subtitle`. |

The upsert DTO accepts at most 12 rows (`@Size(max = 12)`). Rows with a blank
title are dropped on write. Exposed on the public and admin product detail
responses as the `commitments` array on the domain `Product` record (admin reads
also carry `titleEn`/`subtitleEn`); omitted from product *list* responses
(detail-only). An empty list hides the whole block on the PDP.

`V232` also **seeds** every existing product with the three former default rows
(delivery / size-exchange / warranty, icons `truck` / `refresh-cw` /
`shield-check`) so no product loses the block on migration, and **removes** the
6 `product_commitment_*` rows from `site_settings`.

Status: `CONFIRMED_FROM_CODE` — `ProductCommitmentEntity`, `ProductCommitment`
domain record, `CommitmentRequest`, `AdminCatalogMutationService.applyCommitments`,
migration `V232`.

### ~~Product "Mua tại BigBike.vn" rows — `product_purchase_lines` (V249)~~ — GỠ HẲN ở V276

**Đã gỡ (2026-06-24, quyết định chủ shop):** module "dòng tự thêm" của khối **"Mua tại
BigBike.vn"** (bảng `product_purchase_lines`, từng cho admin nhập tay các dòng Bảo hành /
Giao hàng / Đổi size theo từng SP) đã bị **gỡ hoàn toàn**: editor admin, field
`purchaseLines` trên domain/API/DTO, mapper read và bảng DB (`V276__drop_product_purchase_lines.sql`
drop bảng + index). Lý do: nội dung 3 dòng này gần như giống nhau ở mọi SP nên không cần
quản theo từng SP.

**Vẫn giữ:** khối "Mua tại BigBike.vn" trên PDP web — nhưng nay chỉ còn các ô **tự động**:
Giá + Tồn kho (realtime, cùng nguồn nút mua) và Liên hệ (`hotline` + `zalo_display`) + Địa
chỉ (`contact_address`) từ `site_settings`. Không còn dòng admin nhập tay xen giữa.

Cột scalar legacy `pdp_shipping_line`/`pdp_return_line` trên `products` vẫn dormant (đã
ngừng dùng từ V249, xem bảng "Cột scalar trên `products`"); `warranty_months`/`warranty_scope`
đã DROP ở V266.

Status: `REMOVED` — migration `V276__drop_product_purchase_lines.sql`.

### Product "Specs Dashboard" stat boxes — `product_spec_stats` (V235)

Per-product list of "Specs Dashboard" stat boxes rendered right under the buy area
on the PDP (`FeaturedSpecsBar.tsx`). Each box is a big **value** over a short
**label** — a selling-point figure ("đòn chốt") that answers *"is the price worth
it?"*, **NOT** a technical specification row. **Replaces** the
`product_specifications.featured` flag (V230), which is dropped in this migration.
Child table of `products`, mirroring `product_commitments` with bilingual inline columns.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | `BIGINT` identity | NO | Primary key. |
| `product_id` | `VARCHAR(64)` | NO | FK → `products.id`, `ON DELETE CASCADE`. |
| `sort_order` | `INTEGER` | NO | Display order; assigned by the admin editor. |
| `stat_value` | `VARCHAR(60)` | NO | The headline figure (Vietnamese / canonical), e.g. `24 tháng`. |
| `label` | `VARCHAR(80)` | NO | Short label under the figure, e.g. `Bảo hành`. |
| `stat_value_en` | `VARCHAR(60)` | YES | Optional English value; null → falls back to `stat_value`. |
| `label_en` | `VARCHAR(80)` | YES | Optional English label; null → falls back to `label`. |

The upsert DTO accepts at most **4** rows (`@Size(max = 4)`). Rows with a blank
value or label are dropped on write. Exposed on the public and admin product detail
responses as the `specStats` array on the domain `Product` record (admin reads also
carry `valueEn`/`labelEn`); omitted from product *list* responses (detail-only). An
empty list hides the whole block on the PDP.

`V235` also **seeds** each product from its existing `featured=true` specifications
(up to 4, ordered) so no product loses its dashboard on migration, then **drops**
`product_specifications.featured`. Admin then refines the boxes into proper
selling-point figures.

Status: `CONFIRMED_FROM_CODE` — `ProductSpecStatEntity`, `ProductSpecStat` domain
record, `SpecStatRequest`, `AdminCatalogMutationService.applySpecStats`,
`JpaCatalogReadRepository.toSpecStats`, migration `V235`. See
[API_CONTRACT.md](API_CONTRACT.md) §"Product spec-stat boxes — `specStats` (V235)".

### Product SEO template fields — pros/cons, warranty, origin, weight, size guide (V175)

Nhóm field bổ sung cho template trang sản phẩm chuẩn SEO/AEO (xem
`SEO_PDP_IMPLEMENTATION_PLAN.md`, Giai đoạn 3). Tất cả **detail-only** (null/empty
trong product *list* responses, như `specifications`/`faqs`).

**Ưu điểm / Nhược điểm — bảng con `product_highlights`** (schema.org
`positiveNotes` / `negativeNotes`). Một bảng con duy nhất phân biệt bằng cột
`kind`, mirror pattern `product_faqs`. Song ngữ inline (`content` / `content_en`).

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | `BIGINT` identity | NO | Primary key. |
| `product_id` | `VARCHAR(64)` | NO | FK → `products.id`, `ON DELETE CASCADE`. |
| `kind` | `VARCHAR(8)` | NO | `PRO` (ưu điểm) hoặc `CON` (nhược điểm). |
| `sort_order` | `INTEGER` | NO | Display order trong từng nhóm. |
| `content` | `TEXT` | NO | Câu ưu/nhược (tiếng Việt, canonical). |
| `content_en` | `TEXT` | YES | Bản tiếng Anh tùy chọn; null → fallback VI. |

Upsert DTO nhận tối đa 20 mục mỗi nhóm (`@Size(max = 20)`). Mục `content` blank bị
drop. Đọc ra domain `Product` thành 2 mảng `positiveNotes` / `negativeNotes`
(đã resolve theo locale) qua `JpaCatalogReadRepository.toHighlights`.

> **V251 — Ưu/Nhược điểm TÁCH RA khỏi mô tả lại (đảo phần `prosCons` của V246).** Ưu/Nhược
> điểm trở lại là **khối RIÊNG cố định ngay dưới mô tả, ngoài tab** — admin nhập ở card riêng
> ("Ưu điểm & Nhược điểm"), **không bắt buộc** (đăng sản phẩm được khi để trống). **Nguồn dữ
> liệu duy nhất quay về bảng con `product_highlights` này** (V175); admin gửi lại
> `positiveNotes`/`negativeNotes` (DTO `UpsertProductRequest`, `AdminCatalogMutationService.applyHighlights`),
> backend đọc ra response + schema.org `positiveNotes`/`negativeNotes` (json-ld). Migration `V251`
> gỡ mọi khối `prosCons` còn sót trong `description_blocks`/`_en` (no-op ở production vì V246 chưa
> chạy). **Suitability ("Phù hợp với ai") + sizeGuide ("Bảng size") GIỮ NGUYÊN là khối trong mô tả**
> (chỉ `prosCons` bị đảo). `size_guide` / `suitability_advisory` cột scalar = legacy/dormant như trước.

**Cột scalar mới trên `products`:**

| Column | Type | Null | Notes |
|---|---|---|---|
| ~~`warranty_months`~~ | — | — | **Đã DROP ở V266** (gỡ module bảo hành). Domain field `warrantyMonths` đã gỡ từ V249, dữ liệu đã backfill sang `product_purchase_lines`; cột nay bị xoá hẳn. |
| ~~`warranty_scope`~~ | — | — | **Đã DROP ở V266** (gỡ module bảo hành). Domain field `warrantyScope` đã gỡ từ V249, dữ liệu đã backfill (fallback) sang `product_purchase_lines`; cột nay bị xoá hẳn. |
| `pdp_shipping_line` | `TEXT` | YES | **(dormant từ V249)** Domain field `pdpShippingLine` đã gỡ; cột giữ làm lưới an toàn, dữ liệu đã backfill sang `product_purchase_lines`. Không còn admin đọc/ghi. |
| `pdp_return_line` | `TEXT` | YES | **(dormant từ V249)** Domain field `pdpReturnLine` đã gỡ; cột giữ làm lưới an toàn, dữ liệu đã backfill sang `product_purchase_lines`. Không còn admin đọc/ghi. |
| `origin_brand_country` | `VARCHAR(120)` | YES | "Thương hiệu [nước]". Domain `originBrandCountry`. |
| `size_guide` | `TEXT` | YES | Bảng size dạng HTML (rich-text, sanitize khi render). Domain `sizeGuide`. |

**Trọng lượng (đã gỡ):** field dẫn xuất `weightGrams` đã được **gỡ khỏi domain/API/admin/web**
(quyết định chủ shop — ô "Trọng lượng (gram)" trong form đăng sản phẩm biến mất, web ngừng khai
`Product.weight` cho schema.org). Cột vật lý `weight_kg` (`NUMERIC(10,4)`) **vẫn tồn tại** trong
DB (kích thước vật lý do trình nhập WooCommerce ghi — `length_cm`/`width_cm`/`height_cm` cùng nhóm),
KHÔNG drop; chỉ không còn admin ghi/đọc qua field `weightGrams` nữa.

Status: `CONFIRMED_FROM_CODE` — `ProductHighlightEntity`, `ProductEntity`
(scalar cols), `HighlightRequest`, `UpsertProductRequest`,
`AdminCatalogMutationService.applyHighlights`, `JpaCatalogReadRepository`,
migration `V175`.

### Product gender field — `products.gender` (V184)

`products.gender` `VARCHAR(20)` nullable. Giới tính mục tiêu của sản phẩm.

| Value | Meaning |
|---|---|
| `Nam` | Dành cho nam |
| `Nữ` | Dành cho nữ |
| `Unisex` | Unisex — phù hợp cả hai |
| `NULL` | Chưa gắn giới tính (mặc định) |

Field-level attributes:
- **DB column:** `products.gender VARCHAR(20)`, nullable, no default, no enum constraint.
- **Domain:** `Product.gender()` — exposed on **both list and detail** responses.
- **Admin mutation:** `UpsertProductRequest.gender` (`@Size(max=20)`, presence-flag pattern — omitting the key on PATCH leaves the column untouched).
- **Filter param:** `filter_gender` on `GET /api/v1/products` — case-insensitive exact match on `product.gender`; blank/absent = no filter.
- **Facet:** `CatalogFacets.genders[]` — fixed set `[Nam, Nữ, Unisex]` with live counts; buckets with `count = 0` are omitted.

Status: `CONFIRMED_FROM_CODE`

Evidence: `ProductEntity.java`, `Product.java`, `CatalogReadService.java` (`matchesGender`, `buildGenderBuckets`), `UpsertProductRequest.java`, `AdminCatalogMutationService.java`, `V184__add_product_gender.sql`.

### Product video description — `product_videos.description` (V175)

Thêm cột `description TEXT NULL` vào bảng con `product_videos`. Mô tả 2–3 câu nội dung
video, render dưới embed và làm `description` cho schema.org `VideoObject`. 1 ngôn ngữ
(không song ngữ). Phơi ra `VideoAsset.description` trên domain. `VideoRequest` nhận
`description` (`@Size(max = 5000)`).

### Gallery media hỗn hợp — ảnh + video trong gallery (V248)

Hai bảng gallery `product_gallery_images` và `product_variant_gallery_images` thêm 3 cột:
`media_type VARCHAR(8) NOT NULL DEFAULT 'image'` (`image`|`video`), `video_url TEXT`,
`video_provider VARCHAR(16)` (`youtube`|`tiktok`|`facebook`|`upload`); cột `image_url` được **nới NULL** (item video
có thể không có thumbnail). Một dòng gallery giờ là **ảnh** (mediaType=image, dùng `image_*`) hoặc
**video** (mediaType=video, `video_url`+`video_provider`, `image_*` = thumbnail/poster tuỳ chọn).

Domain: `Product.gallery` và `ProductVariant.gallery` đổi `List<ImageAsset>` → **`List<GalleryMedia>`**
(`GalleryMedia(mediaType, image, videoUrl, videoProvider)`). Web contract: `gallery: GalleryMedia[]`
trên Product + ProductVariant. Read mapper `JpaCatalogReadRepository.toGalleryMedia` dựng item theo loại.

**Tách biệt với `product_videos`** (mục "Video" riêng dưới PDP): gallery video do admin đăng CHUNG khu
vực ảnh thumbnail (cùng `GalleryEditor` admin, cho cả sản phẩm lẫn biến thể), hiển thị trong dải media
trên cùng (`ProductGallery` tự tách ảnh/video từ danh sách gallery); còn `product_videos` chỉ feed tab
"Video". Tương thích ngược: gallery cũ (default `media_type='image'`) hiển thị y như cũ.

Status: `CONFIRMED_FROM_CODE` — `V248__add_gallery_media_video.sql`, `ProductGalleryImageEntity`/
`ProductVariantGalleryImageEntity` (3 field mới), `GalleryMedia`, `GalleryImageRequest`
(`mediaType`/`videoUrl`/`videoProvider`), `AdminCatalogMutationService.applyGallery`/`applyVariantGallery`.

### Product related products — `product_related_product_map` (V135)

Admin-curated list of catalog products shown in the PDP "Sản phẩm liên quan"
section band. Self-referential, ordered many-to-many on `products`. Schema
follows the same `(owner_id, ref_id, sort_order @OrderColumn)` join-table pattern
as the other catalog/content map tables.

| Column | Type | Null | Notes |
|---|---|---|---|
| `product_id` | `VARCHAR(64)` | NO | FK → `products.id`, `ON DELETE CASCADE`. The product whose PDP shows the section. |
| `related_product_id` | `VARCHAR(64)` | NO | FK → `products.id`, `ON DELETE CASCADE`. A curated related product. |
| `sort_order` | `INTEGER` | NO | Display order; managed by JPA `@OrderColumn`. |

Primary key `(product_id, related_product_id)`. The upsert DTO accepts at most
24 related-product IDs (`@Size(max = 24)`); `AdminCatalogMutationService`
de-duplicates, preserves order, drops the product's own ID and unknown IDs.

Exposed as the `relatedProducts` array on the domain `Product` record — present
on the public `GET /api/v1/products/{slug}` and admin product detail responses;
empty in product *list* responses (detail-only, like `specifications`/`faqs`).
Each entry uses the **list-view** product shape (no nested gallery/specs/
relatedProducts). The public read path includes **only `PUBLISHED`** related
products; admin reads keep every linked product so the editor can show drafts.
There is **no category fallback** — an empty list hides the PDP section entirely.

Status: `CONFIRMED_FROM_CODE` — `ProductEntity.relatedProducts`,
`UpsertProductRequest.relatedProductIds`, `AdminCatalogMutationService.resolveProductRefs`,
`JpaCatalogReadRepository.toRelatedProducts`, migration `V135`.

### Product accessories — `product_accessory_product_map` (V239)

Admin-curated list of catalog products shown in the PDP "Phụ kiện" (sản phẩm bán
kèm) section. Self-referential, ordered many-to-many on `products`. Schema mirrors
`product_related_product_map` (V135) exactly — same `(owner_id, ref_id, sort_order
@OrderColumn)` join-table pattern — but is an independent list.

| Column | Type | Null | Notes |
|---|---|---|---|
| `product_id` | `VARCHAR(64)` | NO | FK → `products.id`, `ON DELETE CASCADE`. The product whose PDP shows the section. |
| `accessory_product_id` | `VARCHAR(64)` | NO | FK → `products.id`, `ON DELETE CASCADE`. A curated accessory product. |
| `sort_order` | `INTEGER` | NO | Display order; managed by JPA `@OrderColumn`. |

Primary key `(product_id, accessory_product_id)`. The upsert DTO accepts at most
24 accessory IDs (`@Size(max = 24)`); `AdminCatalogMutationService.resolveProductRefs`
de-duplicates, preserves order, drops the product's own ID and unknown IDs.

Exposed as the `accessoryProducts` array on the domain `Product` record — present
on the public `GET /api/v1/products/{slug}` and admin product detail responses;
empty in product *list* responses (detail-only). Each entry uses the **list-view**
product shape. The public read path includes **only `PUBLISHED`** entries; admin
reads keep every linked product. An empty list hides the PDP section entirely.

Status: `CONFIRMED_FROM_CODE` — `ProductEntity.accessoryProducts`,
`UpsertProductRequest.accessoryProductIds`, `AdminCatalogMutationService.resolveProductRefs`,
`JpaCatalogReadRepository.toAccessoryProducts`, migration `V239`.

### Product tags — REMOVED (V243)

The product tag feature was removed entirely on 2026-06-19. The storefront never consumed these tags (no tag-filter page or tag-aware search was ever wired), and the admin tag editor was removed, so the tables held only dead WordPress-import data. Migration `V243__drop_product_tags.sql` drops `product_tag_map` then `product_tags`; the `ProductTagEntity`, `ProductTagJpaRepository`, `AdminProductTagService`, `ProductTagsRequest`, the admin sub-resource, and `ProductEntity.tags` are all deleted.

Status: `CONFIRMED_FROM_CODE` — removal verified; no remaining `product_tag` references in runtime code.

### Product rating denormalization — `products.rating` / `products.rating_count`

Cache denormalized của review **APPROVED**, phục vụ list/detail đọc nhanh không join bảng `reviews`:

- `products.rating` — `numeric(3,2)`, nullable, **không có default** (thêm ở `V18`, check constraint `ck_products_rating`: `NULL` hoặc `0..5`). Giá trị = trung bình cộng điểm review đã duyệt, làm tròn **1 decimal HALF_UP** (`AdminReviewService.toCachedRating`).
- `products.rating_count` — `integer`, nullable, **không có default** (thêm ở `V43`). Giá trị = số review đã duyệt.
- `reviews.rating` — `smallint NOT NULL`, check `1..5` (`V14`) — nên hễ có ≥ 1 review đã duyệt thì trung bình luôn ≥ 1.
- `reviews.title` — `varchar(160)`, nullable (`V234`). Tiêu đề tuỳ chọn của review. Review cũ / WP-import = `NULL`.
- `reviews.photos` — `jsonb`, nullable (`V234`). Mảng URL ảnh khách hàng trong MinIO (`/media/reviews/...`), tối đa 10. `NULL`/`[]` = không có ảnh. Map qua `@JdbcTypeCode(SqlTypes.JSON)` (mirror `products.product_tabs`). Chỉ phục vụ hiển thị khi review `APPROVED` (xem `BUSINESS_RULES.md` `REVIEW_RULE_005`).

**Recompute flow (đường duy nhất được ghi cache):** `AdminReviewService.recomputeProductReviewAggregate` chạy sau **mọi** chuyển trạng thái review (`updateStatus`, kể cả APPROVED → PENDING/SPAM/TRASH) và sau `deleteReview`. Khi 0 review approved: `rating = NULL` (không phải 0) và `rating_count = 0`. `PublicReviewService.submitReview` tạo review PENDING và **không** recompute (đúng — pending không được tính). Admin upsert product **không thể** set tay 2 field này (`UpsertProductRequest` cố ý không khai báo field; xem comment "Phase 2D" trong `AdminCatalogMutationService`).

**Trạng thái NULL hợp lệ:** sản phẩm admin tạo mới có `rating = NULL` và `rating_count = NULL` (chưa từng recompute) cho tới khi review đầu tiên được duyệt.

**Invariant `rating_count ≥ 1 ⟺ rating > 0`: `PARTIAL`.** Đường moderation luôn giữ invariant. Pipeline WordPress import **đã được sửa** để cũng tuân theo: `WordPressProductMapper` không còn default `4.5` (meta thiếu → `null`), `ProductImporter` không seed `rating` từ meta sản phẩm, `ReviewImporter.recomputeRatingCache` recompute `rating`/`rating_count` từ review APPROVED sau import (mirror `AdminReviewService`). Còn lại một lỗ hổng dữ liệu tồn dư: bản ghi từ lần import cũ (trước fix) có thể vẫn mang `rating` ảo với `rating_count = NULL` cho tới khi re-import / backfill mới; `V63` backfill chỉ chạy một lần lúc Flyway migrate. **Web/mobile vì vậy vẫn bắt buộc gate hiển thị sao theo `ratingCount ≥ 1`** (NULL/0 → ẩn), không dùng `rating > 0` đơn lẻ — xem `BUSINESS_RULES.md` `REVIEW_RULE_003`/`REVIEW_RULE_004`.

**API mapping:** list-item + detail `Product` trả `rating` / `ratingCount` (optional, nullable — `bigbike-web/lib/contracts/public.ts`). API public reviews trả `avgRating` (1-decimal; **`0.0` khi 0 review**, không phải null — `PublicReviewService.roundAverage`) và `totalReviews`; FE phải gate bằng `totalReviews`, không bằng `avgRating > 0`.

Status: `CONFIRMED_FROM_CODE` — `AdminReviewService.java`, `PublicReviewService.java`,
`ReviewJpaRepository.java`, `ProductEntity.java`, `UpsertProductRequest.java`,
`WordPressProductMapper.java`, `ProductImporter.java`, `ReviewImporter.java`, migrations `V14`, `V18`, `V43`, `V63`.

### Product bilingual content — English columns (V136)

BigBike sản phẩm có 2 bản nội dung: **tiếng Việt** (canonical, bắt buộc) và
**tiếng Anh** (tùy chọn). Bản tiếng Việt vẫn nằm ở các cột gốc như cũ; bản tiếng
Anh được lưu trên **các cột `_en` nullable cùng dòng** — không có bảng dịch riêng.
Lý do: chỉ có đúng 2 ngôn ngữ cố định, và các bảng con `product_specifications` /
`product_faqs` bị xóa-tạo-lại toàn bộ mỗi lần lưu (id con đổi liên tục) nên bảng
dịch khóa theo id con sẽ bị mồ côi.

**Cột `_en` trên `products`** (đều nullable, kiểu khớp cột gốc):

| Cột tiếng Việt (gốc) | Cột tiếng Anh | Kiểu |
|---|---|---|
| `name` | `name_en` | `VARCHAR(255)` |
| `short_description` | `short_description_en` | `TEXT` |
| `description` | `description_en` | `TEXT` |
| `content_bottom` | `content_bottom_en` | `TEXT` |
| `promotion_content` | `promotion_content_en` | `TEXT` |
| `installation_guide` | `installation_guide_en` | `TEXT` |
| `seo_title` | `seo_title_en` | `VARCHAR(255)` |
| `seo_description` | `seo_description_en` | `TEXT` |

**Cột `_en` trên `product_specifications`:** `name_en VARCHAR(255)`, `value_en TEXT`,
`group_name_en VARCHAR(255)`.
**Cột `_en` trên `product_faqs`:** `question_en VARCHAR(500)`, `answer_en TEXT`.

**Fallback theo từng trường:** khi đọc bản tiếng Anh, mỗi trường lấy
`COALESCE(<field>_en, <field>)` — sản phẩm có thể có tên tiếng Anh nhưng mô tả
vẫn lùi về tiếng Việt. Bản tiếng Việt không bao giờ bị thiếu (xem
`BUSINESS_RULES.md` `PRODUCT_RULE_001`, `PRODUCT_RULE_002`).

**Slug tiếng Anh (`slug_en`, V214):** xem mục **"English URL slug"** bên dưới — `slug` tiếng Việt là canonical, `slug_en` là URL tiếng Anh tùy chọn.

**Không dịch ở đợt này:** alt ảnh, tên video, tên biến thể, `seo_canonical_url`.

**Admin list reads:** danh sách admin (product/category/brand/content) nay cũng
resolve **trường hiển thị** (`name` / `title`) theo `lang` qua cùng cơ chế
`COALESCE(<field>_en, <field>)` — khối `translations` vẫn `null` ở list (chỉ có ở
detail). Mặc định `vi`; chỉ detail trả cả 2 bản để soạn thảo song ngữ.

Status: `CONFIRMED_FROM_CODE` — `ProductEntity`, `ProductSpecificationEntity`,
`ProductFaqEntity` (các trường `*En`), `ProductTranslations` domain record,
`JpaCatalogReadRepository` (resolve locale list + detail), migration `V136`.

### Category bilingual content — English columns (V137)

Danh mục có 2 bản nội dung: **tiếng Việt** (canonical) và **tiếng Anh** (tùy chọn).
Bản tiếng Anh lưu trên các cột `_en` nullable cùng dòng trong bảng `categories`.

**Cột `_en` trên `categories`** (đều nullable):

| Cột tiếng Việt | Cột tiếng Anh | Kiểu |
|---|---|---|
| `name` | `name_en` | `VARCHAR(255)` |
| `description` | `description_en` | `TEXT` |
| `seo_title` | `seo_title_en` | `VARCHAR(255)` |
| `seo_description` | `seo_description_en` | `TEXT` |
| `content_bottom` | `content_bottom_en` | `TEXT` |

Fallback: giống `PRODUCT_RULE_002` — mỗi trường lùi về VI khi EN bị null/blank. Xem `CATEGORY_RULE_001/002`.

**Slug tiếng Anh (`slug_en`, V213):** xem mục **"English URL slug"** bên dưới.

Status: `CONFIRMED_FROM_CODE` — `CategoryEntity`, `CategoryTranslations` domain record, migration `V137`.

### Category menu/sidebar line-icon — `menu_icon_url` (V213)

Cột `menu_icon_url` (`TEXT`, nullable) trên `categories` lưu **icon line đơn sắc** của danh mục, dùng cho:
menu header (mega-menu) và bộ lọc "Danh mục sản phẩm" ở trang archive (`WpCategorySidebar`). Render qua
CSS `mask-image` theo `currentColor`.

Phân biệt rõ với các cột ảnh khác trên `categories`:

| Cột | Vai trò |
|---|---|
| `menu_icon_url` | Icon line đơn sắc cho menu + sidebar lọc (mask-image). **Field này.** |
| `icon_url` (`icon`) | Ảnh minh hoạ **hero** trang danh mục (WP ACF `image_left`) — KHÔNG dùng cho menu. |
| `image_url` (`image`) | Ảnh thumbnail danh mục (lưới trang chủ). |
| `banner_url` / `mobile_banner_url` | Ảnh nền hero. |

Trước đây icon menu/sidebar gắn theo **slug** (CSS theme WP `.{slug}>a::before`) → đổi slug là mất icon, và
icon không quản được trong admin. Đã chuyển hẳn sang DATA-DRIVEN, một nguồn duy nhất là `menu_icon_url`:
- **File icon gốc nằm trong repo web** (`bigbike-web/public/wp/icon-N.svg`, `abdominals.png`). **`V223`** đã upload
  11 file icon menu này lên MinIO (`bigbike-media/uploads/wp-icons/*`) và migrate `menu_icon_url` từ seed cũ
  `/wp/<file>` → `/media/uploads/wp-icons/<file>` (phục vụ qua rewrite `/media/*`, cùng origin nên mask-image render
  đúng). Các asset `/wp/*` khác (vd banner `/wp/page-title-bg.png`) vẫn do web phục vụ tĩnh + admin proxy
  `/wp/ → bigbike-web` (`bigbike-admin/nginx.conf`).
- **`V217`** thêm cột + backfill theo slug; **`V219`** hoàn thiện: khoá theo **ID danh mục** (`wp-cat-NNN`, ổn
  định từ WP import — không drift như slug) cho 13 danh mục, idempotent + guard (chỉ đè NULL hoặc giá-trị-mặc-
  định `/wp/*`,`/media/uploads/wp-icons/*`). `WpCategorySidebar` render mask-image cho **cả danh mục con** (không
  chỉ gốc) và đã **xóa toàn bộ rule icon-theo-slug** trong 8 file `wp-theme-*.css`.

**Admin-writable:** admin chỉnh ở form danh mục (`CategoryDetailScreen` → "Icon menu / bộ lọc danh mục"), gửi
qua `UpsertCategoryRequest.menuIcon` → `menu_icon_url`. URL phải qua whitelist
`AdminMutationValidators.validateWhitelistedMediaUrl` (`/media/`, `/media-proxy/`, hoặc MinIO public base). Seed
hiện tại `/media/uploads/wp-icons/*` (sau `V223`) hợp lệ với whitelist → lưu lại trong admin không còn HTTP 400;
seed cũ `/wp/*` (file tĩnh, KHÔNG qua được whitelist) đã được migrate. Xem `API_CONTRACT` §"Menu/category line-icon".

**Banner hero + hero illustration (V219):** `banner_url` (ảnh nền hero) trước là hardcode `DEFAULT_BG`
(`WpCategoryHero.tsx` → `/wp/page-title-bg.png`); V219 đưa vào DB cho mọi danh mục để ô "Ảnh banner hero" trong
admin quản được (web y nguyên, fallback `DEFAULT_BG` giữ trong code cho danh mục chưa đặt). `icon_url` (ảnh
minh hoạ hero, ACF `image_left`) V219 đổi URL ngoài `bigbike.vn/wp-content/uploads/` → `/media-proxy/wp-uploads/`
(ảnh sẵn trong MinIO từ WP import). Cả hai admin sửa qua `UpsertCategoryRequest.banner` / `.icon`.

Status: `CONFIRMED_FROM_CODE` — `CategoryEntity.menuIconUrl`, `Category` domain record, `JpaCatalogReadRepository`, `UpsertCategoryRequest.menuIcon` + `AdminCatalogMutationService.applyCategoryPatch`, migrations `V213`/`V217`/`V219`/`V223`.

### Brand bilingual content — English columns (V137)

Thương hiệu có 2 bản nội dung: **tiếng Việt** (canonical) và **tiếng Anh** (tùy chọn).
Bản tiếng Anh lưu trên các cột `_en` nullable cùng dòng trong bảng `brands`.

**Cột `_en` trên `brands`** (đều nullable):

| Cột tiếng Việt | Cột tiếng Anh | Kiểu |
|---|---|---|
| `name` | `name_en` | `VARCHAR(255)` |
| `description` | `description_en` | `TEXT` |
| `seo_title` | `seo_title_en` | `VARCHAR(255)` |
| `seo_description` | `seo_description_en` | `TEXT` |

Fallback: giống `PRODUCT_RULE_002` — mỗi trường lùi về VI khi EN bị null/blank. Xem `BRAND_RULE_001/002`.

**Slug tiếng Anh (`slug_en`, V215):** xem mục **"English URL slug"** bên dưới.

Status: `CONFIRMED_FROM_CODE` — `BrandEntity`, `BrandTranslations` domain record, migration `V137`.

### English URL slug — `slug_en` (V213 categories / V214 products / V215 brands / V216 articles)

Mỗi danh mục / sản phẩm / thương hiệu / **bài viết** có thêm cột `slug_en VARCHAR(100)` **nullable**:

| Bảng | Cột VI (canonical) | Cột EN | Migration |
|---|---|---|---|
| `categories` | `slug` | `slug_en` | `V213` |
| `products` | `slug` | `slug_en` | `V214` |
| `brands` | `slug` | `slug_en` | `V215` |
| `articles` | `slug` | `slug_en` | `V216` |

**Index:** mỗi bảng có **partial-unique index** `ux_<bảng>_slug_en ON <bảng> (slug_en) WHERE slug_en IS NOT NULL` — cho phép nhiều `NULL`, chặn trùng `slug_en` (en-vs-en) ở tầng DB.

**Uniqueness chéo cột (vi-vs-en):** `slug_en` **không được trùng** bất kỳ `slug` (vi) nào cùng loại, và `slug` vi mới không được trùng `slug_en` đang tồn tại. Ràng buộc này **enforce ở tầng ứng dụng** (`AdminCatalogMutationService.validate*` cho catalog; `AdminContentMutationService.validateArticleRequest` cho bài viết) — DB chỉ lo en-vs-en. Lý do: tránh `/.../x/` mơ hồ khi `x` vừa là slug vi của entity này vừa là slug en của entity khác.

**Lookup:** public read tra cứu theo **vi HOẶC en** slug (`findBySlug(slug).or(() -> findBySlugEn(slug))` — ưu tiên khớp vi trước cho tất định) nên cả hai URL mở cùng entity.

**Response:** domain record trả cả `slug` (canonical vi, không đổi theo locale) lẫn `slugEn` (nullable). Web dùng `slug` cho canonical + `slugEn` cho URL/hreflang tiếng Anh; `slugEn` trống → URL EN lùi về `slug` vi. Các record summary nhúng trong response sản phẩm — `CategorySummary` (`category`) và `BrandSummary` (`brand`) — cũng mang thêm `slugEn` (nullable, thô từ `slug_en`) để breadcrumb PDP điều hướng đúng URL EN. Summary danh mục phụ (`categories[]`) **chưa** mang `slugEn`.

**Redirect:** catalog (danh mục/sản phẩm/thương hiệu) đổi/xoá `slug_en` tự sinh 301 (`autoCreateSlugRedirect`) — đổi → old-EN→new-EN; xoá → old-EN→URL vi; honored runtime bởi `bigbike-web/proxy.ts` qua `/api/internal/redirect`. **Bài viết KHÔNG có cơ chế redirect** (module nội dung không có `autoCreateSlugRedirect`) — đổi/xoá `slug_en` không sinh 301.

**Ngoài phạm vi:** trang thông tin/chính sách nay là **nội dung tĩnh ở web** (module pages đã gỡ 2026-06-24, bảng `pages` drop ở `V271`) — web định tuyến bằng slug cố định trong `static-pages.json`, không qua backend.

Status: `CONFIRMED_FROM_CODE` — `CategoryEntity`/`ProductEntity`/`BrandEntity`/`ArticleEntity` (`slugEn`), `*JpaRepository.findBySlugEn`, `JpaCatalogReadRepository`/`JpaContentReadRepository` (map `slugEn` + OR-resolve), `AdminCatalogMutationService`/`AdminContentMutationService` (validate), migrations `V213`/`V214`/`V215`/`V216`.

### Article bilingual content — English columns (V138)

Bài viết (blog) có 2 bản nội dung: **tiếng Việt** (canonical) và **tiếng Anh** (tùy chọn).
Bản tiếng Anh lưu trên các cột `_en` nullable cùng dòng trong bảng `articles`.

**Cột `_en` trên `articles`** (đều nullable):

| Cột tiếng Việt | Cột tiếng Anh | Kiểu |
|---|---|---|
| `title` | `title_en` | `VARCHAR(255)` |
| `excerpt` | `excerpt_en` | `TEXT` |
| `body` | `body_en` | `TEXT` |
| `seo_title` | `seo_title_en` | `VARCHAR(255)` |
| `seo_description` | `seo_description_en` | `TEXT` |

Fallback: giống `PRODUCT_RULE_002` — mỗi trường lùi về VI khi EN bị null/blank. Xem `ARTICLE_RULE_001/002`.

**Slug tiếng Anh (`slug_en`, V216):** xem mục **"English URL slug"** bên trên — `slug` tiếng Việt là canonical, `slug_en` là URL tiếng Anh tùy chọn (không sinh redirect).

Status: `CONFIRMED_FROM_CODE` — `ArticleEntity`, `ArticleTranslations` domain record, migration `V138`.

### Article featured + seo_no_index (V222)

Migration `V222__add_article_featured_and_seo_no_index.sql` thêm 2 cột boolean vào bảng `articles`:

| Cột | Kiểu | Default | Map ra payload | Ý nghĩa |
|---|---|---|---|---|
| `featured` | `BOOLEAN NOT NULL` | `false` | top-level `featured` | Đánh dấu "Tin nổi bật" — điều khiển widget Tin nổi bật trên web và query param `featured=true` của `GET /api/v1/articles`. |
| `seo_no_index` | `BOOLEAN NOT NULL` | `false` | `seo.noIndex` | `true` = đặt `noindex` cho bài viết (không cho search engine index trang chi tiết). |

**Lưu ý lịch sử — `articles.seo_no_index`:** cột này từng tồn tại ở `V1` nhưng bị **DROP** ở `V152` (chưa dùng đến). `V222` **tái thêm** để dùng thật trong contract per-article SEO noindex.

Status: `CONFIRMED_FROM_CODE` — `ArticleEntity.featured`, `ArticleEntity.seoNoIndex`, migration `V222__add_article_featured_and_seo_no_index.sql` (ghi chú: cột `seo_no_index` từng bị drop ở `V152`). Xem [API_CONTRACT.md](API_CONTRACT.md) §"Article payload — featured + seo.noIndex (V222)".

### Article home_experience (V272)

Migration `V272__add_article_home_experience.sql` thêm 1 cột boolean vào bảng `articles`:

| Cột | Kiểu | Default | Map ra payload | Ý nghĩa |
|---|---|---|---|---|
| `home_experience` | `BOOLEAN NOT NULL` | `false` | top-level `homeExperience` | Admin chọn tay bài vào carousel "Góc trải nghiệm cùng BigBike" trên trang chủ — điều khiển query param `homeExperience=true` của `GET /api/v1/articles`. |

Trang chủ hiển thị tối đa 3 bài có `home_experience = true` (mới nhất trước). Khi **không** bài nào được chọn, web fall back về 3 bài viết mới nhất bất kỳ (logic ở `app/page.tsx`, xem [API_CONTRACT.md](API_CONTRACT.md) §"Article list — homeExperience (V272)"). Trước V275 fallback lấy theo category `reviews`; sau khi gộp nhóm còn 1 "Tin tức" thì lấy bài mới nhất bất kỳ.

Status: `CONFIRMED_FROM_CODE` — `ArticleEntity.homeExperience`, migration `V272__add_article_home_experience.sql`. Xem [API_CONTRACT.md](API_CONTRACT.md) §"Article payload — featured + seo.noIndex (V222)".

### Content categories gộp về 1 nhóm "Tin tức" (V275)

Owner decision 2026-06-24: bỏ phân biệt nhóm bài viết. Migration `V275__merge_content_categories_into_news.sql`:

1. Dồn `articles.category_id` của mọi bài về nhóm `tin-tuc` ("Tin tức", id `wp-blog-cat-361`).
2. Dựng lại `article_category_map` để mỗi bài chỉ map tới `tin-tuc`.
3. `DELETE` mọi `content_categories` còn lại (Reviews `wp-blog-cat-365`, các nhóm WP rác, `blog`, `trai-nghiem`…).

Sau migration **chỉ còn 1 content category**. Hệ quả:
- Trang `/tin-tuc`: sidebar lọc theo `articleCount > 0` nên tự rút còn 1 nhóm — không cần đổi code filter.
- Khối "Góc trải nghiệm" trang chủ: fallback chuyển từ `category=reviews` → 3 bài mới nhất bất kỳ.
- **Admin form bài viết bỏ ô "Danh mục".** Backend `ContentRequestValidator.resolveCategory` mặc định gán nhóm `tin-tuc` khi upsert không gửi `categoryId` (trước đây null = không nhóm) → bài luôn thuộc "Tin tức". Endpoint `/admin/content/reference/categories` thành orphan (không còn FE gọi).
- **Một chiều:** không khôi phục được bài nào từng là Reviews vs Tin tức.

Status: `CONFIRMED_FROM_CODE` — migration `V275__merge_content_categories_into_news.sql`.

### Page bilingual content — REMOVED (2026-06-24)

> **REMOVED (2026-06-24).** Bảng `pages` đã drop ở `V271__drop_pages_and_guide_page.sql` cùng entity `PageEntity` / domain `Page` / `PageTranslations` / enum `PageType`. Các cột song ngữ `_en` của trang (title/body/hero_*/seo_*, thêm ở `V138`) không còn. 10 trang thông tin/chính sách nay là **nội dung tĩnh trong `bigbike-web`** (nguồn `static-pages.json`, song ngữ VI/EN cố định trong code) — không còn dữ liệu trang trong DB. Bài viết (`articles`) vẫn giữ cột song ngữ — xem §"Article bilingual content (V138)".

### Menu item bilingual label — English column (V160)

Mục menu điều hướng có 2 bản nhãn: **tiếng Việt** (canonical, bắt buộc) và **tiếng
Anh** (tùy chọn). Bản tiếng Anh lưu trên cột `_en` nullable cùng dòng trong bảng
`menu_items`.

**Cột `_en` trên `menu_items`** (nullable):

| Cột tiếng Việt | Cột tiếng Anh | Kiểu |
|---|---|---|
| `label` | `label_en` | `VARCHAR(255)` |

Fallback: giống `PRODUCT_RULE_002` — `label` lùi về VI khi `label_en` null/blank.
Đọc public (`GET /api/v1/menus/{location}?lang=`) trả `label` đã resolve; đọc admin
(`GET /api/v1/admin/menus/...`) trả thêm `labelEn` thô để editor sửa song ngữ. Các
cột khác (url, target, cssClass, status) không dịch.

Status: `CONFIRMED_FROM_CODE` — `MenuItemEntity.labelEn`, `AdminMenuService` (pick
locale + `getPublicMenuByLocation(location, lang)`), migration `V160`.

### Home video bilingual title — English column (V161)

Video trang chủ có 2 bản tiêu đề: **tiếng Việt** (canonical, bắt buộc) và **tiếng
Anh** (tùy chọn). Bản tiếng Anh lưu trên cột `_en` nullable cùng dòng trong bảng
`home_videos`.

**Cột `_en` trên `home_videos`** (nullable):

| Cột tiếng Việt | Cột tiếng Anh | Kiểu |
|---|---|---|
| `title` | `title_en` | `VARCHAR(255)` |

Fallback: giống `PRODUCT_RULE_002` — `title` lùi về VI khi `title_en` null/blank.
Đọc public (`GET /api/v1/home-videos?lang=`) trả `title` đã resolve; đọc admin
(`GET /api/v1/admin/home-videos`) trả thêm `titleEn` thô để editor sửa song ngữ.

Status: `CONFIRMED_FROM_CODE` — `HomeVideoEntity.titleEn`, `HomeVideo.titleEn`,
`PublicHomeVideoResponse.from(video, lang)`, migration `V161`.

### Article body blocks — `body_blocks` (V140)

`articles.body_blocks` là cột `jsonb` thêm vào trong migration `V140`. Cột này lưu mảng block có cấu trúc — cùng định dạng `DescriptionBlock` với `products.description_blocks` (V139).

7 block type giống hệt: `heading`, `paragraph`, `list`, `image`, `video`, `callout`, `divider`. Schema JSON block giống `DescriptionBlock` — xem §"Product description blocks — description_blocks (V139)".

**Migration (V141):** HTML cũ trong cột `body` của tất cả article đã được parse sang blocks bởi `BodyBlockParser` khi chạy migration. Parser ánh xạ từng top-level HTML element sang block type gần nhất. Element không nhận dạng được trở thành fallback `paragraph` (outerHTML được giữ nguyên).

**Read behavior:** Admin detail read trả về `bodyBlocks` trong `AdminContentItem`. Public read (`GET /api/v1/articles/{slug}`) vẫn chỉ đọc `body` HTML — không thay đổi contract web/mobile.

**Mutation semantics (presence flag):**
- Key `bodyBlocks` có mặt trong request → render blocks → ghi đè cả `body_blocks` lẫn `body`.
- Key `bodyBlocks` vắng mặt → `body` được cập nhật bình thường; `body_blocks` không bị đụng.
- Array rỗng `[]` → `body_blocks` = `[]`; `body` = `""`.

Status: `CONFIRMED_FROM_CODE` — `ArticleEntity.bodyBlocks`, `Article.bodyBlocks`, `AdminContentItem.bodyBlocks`, `UpsertArticleRequest.bodyBlocksPresent`, `AdminContentMutationService.applyArticlePatch`, migration `V140/V141`.

### Page body blocks — REMOVED (2026-06-24)

> **REMOVED (2026-06-24).** Cột `pages.body_blocks` (V140) cùng cả bảng `pages` đã drop ở `V271`. Module pages đã gỡ; trang thông tin nay tĩnh ở web. Article body blocks vẫn còn — xem §"Article body blocks (V140)".

### Contact page layout — đã gỡ (`contact_page_layout`, V224 → drop V270)

Trang `/lien-he` nay là **trang tĩnh**: bố cục cố định trong code web, không còn bảng layout do admin quản lý. Bảng singleton `contact_page_layout` (V224) đã bị **drop ở `V270`**; toàn bộ Java mapping (entity/repository/converter/service/controllers) đã gỡ. Thông tin liên hệ (hotline/địa chỉ/giờ/URL mạng xã hội) vẫn ở `site_settings` nhóm `contact` (single source dùng chung header/footer/web) — xem §"Site settings groups".

Status: `CONFIRMED_FROM_CODE` — `bigbike-web/app/lien-he/page.tsx`, `bigbike-web/components/contact/ContactPageContent.tsx`, migration `V270__drop_contact_page_layout.sql`.

### Guide page layout — REMOVED (2026-06-24)

> **REMOVED (2026-06-24).** Bảng singleton `guide_page_layout` (V227) đã drop ở `V271__drop_pages_and_guide_page.sql` cùng entity `GuidePageLayoutEntity` / `GuideEntry` / `GuideEntriesConverter` / `GuidePageService`. Trang Hướng dẫn `/huong-dan` (+ 3 trang con) nay là **nội dung tĩnh trong `bigbike-web`** (nguồn `static-pages.json`). Trình dựng trang Hướng dẫn trong admin cũng đã gỡ.

### Product homepage placement (V111+)

Two columns on the `products` table control homepage surface placement. The legacy boolean pair (`is_featured`, `show_on_homepage`) was **dropped in migration `V111__refactor_product_homepage_block.sql` (2026-05-14)** and must not be referenced in any new code or query.

| Column | DB column | Type | Purpose |
|---|---|---|---|
| `homepageBlock` | `homepage_block` | `VARCHAR NOT NULL DEFAULT 'NONE'` (enum-constrained) | Which homepage slot this product occupies. Exactly one value per product. |
| `homepageOrder` | `homepage_order` | `INTEGER NULL` (added V95) | Manual ordering pin within the slot. Lower value = appears earlier. `NULL` = unpinned (sorted to end by `createdAt DESC`). |

**`homepageBlock` enum values:**

| Value | Slot | Frontend display |
|---|---|---|
| `NONE` | Not pinned to homepage | Default for all products |
| `FEATURED_GRID` | "Sản phẩm nổi bật" grid | Max 12 shown (admin UI-enforced) |

> `RECOMMENDED_CAROUSEL` was **removed in V149 (2026-05-26)**. The web storefront never rendered that block, making assignments invisible to customers and confusing for admins. All rows previously set to `RECOMMENDED_CAROUSEL` were reset to `NONE` by the migration.

A product occupies exactly one slot. `homepageBlock` and `homepageOrder` are set exclusively via `POST /api/v1/admin/products/homepage-blocks` (see API_CONTRACT.md), not via the per-product update form.

**Backfill rule (V111):** `is_featured=true` → `FEATURED_GRID`; else `show_on_homepage=true` → `RECOMMENDED_CAROUSEL` (removed V149); else `NONE`. Legacy columns then dropped via `ALTER TABLE products DROP COLUMN is_featured, DROP COLUMN show_on_homepage`.

Status: `CONFIRMED_FROM_CODE`

Evidence:
- `ProductEntity.java` — `@Column(name = "homepage_block") @Enumerated(EnumType.STRING) private HomepageBlock homepageBlock` (no `isFeatured` / `showOnHomepage` fields)
- `HomepageBlock.java` — enum `NONE | FEATURED_GRID`
- `AdminCatalogMutationService.setHomepageBlocks()` — atomic bulk set of FEATURED_GRID ordering
- `CatalogReadService.productComparator()` — compound sort: pinned ASC/DESC, null last, `createdAt:DESC` tiebreaker
- `V111__refactor_product_homepage_block.sql` — original schema change + backfill + column drop
- `V149__drop_recommended_carousel_block.sql` — removes RECOMMENDED_CAROUSEL, tightens check constraint
- `API_CONTRACT.md` §"Admin Catalog Contract" — documents filter/sort params + new homepage-blocks endpoint

### Page hero fields — REMOVED (2026-06-24)

> **REMOVED (2026-06-24).** Các cột hero trên `pages` (V98: `hero_image_url`, `hero_image_alt`, `hero_title`, `hero_description`, `hero_kicker`) đã drop cùng cả bảng `pages` ở `V271`. Trang thông tin/chính sách nay tĩnh ở web (hero cố định trong code, không do admin quản lý).
>
> **Vẫn còn:** hero của các **trang danh sách** (`/san-pham`, `/brands`, `/tin-tuc`) — lưu ở `SiteSettingEntity` nhóm `public_hero`, quản lý qua màn **Banner trang** (`BannerScreen.jsx`). Đó là cơ chế riêng, không liên quan tới bảng `pages`.

### Article ↔ Product relation — REMOVED (V167)

> **REMOVED (V167).** Tính năng gắn sản phẩm liên quan vào bài viết đã bị gỡ. Bảng join `article_product_map` (thêm ở `V130__add_article_product_map.sql`) đã bị drop ở `V167__drop_article_product_map.sql`. Code hiện tại không còn `Article.relatedProducts`, `AdminContentItem.relatedProducts`, hay `UpsertArticleRequest.productIds`. Legacy `articles.product_image_url` / `product_image_alt` columns (single decorative thumbnail) không liên quan đến tính năng này và vẫn giữ nguyên.
>
> Đây là tính năng **khác** với Product `relatedProducts` (`product_related_product_map`, V135) ở section trên — cái đó vẫn còn sống.

Status: `CONFIRMED_FROM_CODE` — `V167__drop_article_product_map.sql`, `Article.java` (no `relatedProducts`), `UpsertArticleRequest.java` (no `productIds`), `AdminContentItem` (no `relatedProducts`).

### Catalog facets response shape

Read-only aggregation served by `GET /api/v1/catalog/facets` (see [API_CONTRACT.md](API_CONTRACT.md#catalog-facets-contract)). No DB table — computed in-memory from the catalog read model.

`CatalogFacets`:
| Field | Type | Purpose |
|---|---|---|
| `categories` | `FacetBucket[]` | One bucket per visible category. |
| `brands` | `FacetBucket[]` | One bucket per visible brand; `image` carries the brand logo. |
| `colors` | `FacetBucket[]` | The 10 fixed named colors. |
| `genders` | `FacetBucket[]` | Gender buckets (V184). Only genders with `count > 0` are included. |
| `priceBands` | `PriceBucket[]` | The 9 fixed price bands. |

`FacetBucket`: `{ key: string, label: string, image: ImageAsset | null, count: long }` — `image` is non-null only for brand buckets.

`PriceBucket`: `{ key: string, label: string, minPrice: long | null, maxPrice: long | null, count: long }` — `maxPrice` is `null` for the open-ended top band.

Status: `CONFIRMED_FROM_CODE` — `CatalogFacets.java`, `CatalogReadService.computeFacets`.

### customers / customer_addresses — account page fields (V127)

| Table | Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|---|
| `customer_addresses` | `email` | `VARCHAR(255)` | YES | `null` | Per-address contact email; backs the "Email" field on the address book popup |

### Order line-item thumbnail — `productThumbnailUrl` (response-only, no DB column)

`OrderLineItemResponse.productThumbnailUrl` (`String`, nullable) backs the product thumbnail
in the customer order-detail view. It is **not** snapshotted on `order_line_items` — it is
resolved read-time in `OrderReadService` by joining `order_line_items.product_pk` to
`products.id` and reading the product's current `image_url`. Returns `null` when the product
no longer exists. Rationale: unlike `productName` / `unitPrice` (which must stay historically
fixed), the image is presentational, so showing the product's current image is acceptable and
avoids a migration/backfill — including for orders imported from WordPress.

Evidence: `OrderReadService.resolveProductThumbnails`, `ProductJpaRepository.findImageUrlsByIds`.

### order_line_items — `product_variant_pk` (V158)

| Table | Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|---|
| `order_line_items` | `product_variant_pk` | `VARCHAR(64)` | YES | `null` | Varchar snapshot of `product_variants.id` for the line's variant. Variant-side counterpart of `product_pk` (V74). |

`product_variants.id` is a varchar string PK (`wp-var-*` for migrated WordPress catalog,
`var_<hex>` for admin-created), so the legacy UUID column `product_variant_id` is `null` for
every non-UUID variant — the same UUID/varchar mismatch V74 fixed on the product side. Resolve
the variant from a line by **`product_variant_id` (UUID) first, then `product_variant_pk`** — see
`OrderLineItemEntity.resolveVariantKey()` (and `resolveProductKey()` for the product side). This varchar PK still uniquely identifies the line's variant for snapshots. _(Since V261 inventory is a boolean availability toggle — there is no quantity decrement/restore, so the former stock-restore paths no longer run.)_

Snapshotted at line creation on every sell path that records the variant by its string id —
storefront quick-buy (`CheckoutService.buildLineItemFromProduct`) and
storefront cart-checkout (`CheckoutService.buildLineItemFromCart`, since V176). (The former POS sell path was removed 2026-06-23.) Historical rows
keep `product_variant_pk = NULL` and fall back to product-level restore. Fixed BUG-2 — see
`TEST_REPORT.md` and `QaBug2StockRestoreTest`.

> **V176 fix (cart-checkout wp-* stock leak).** Before V176, `buildLineItemFromCart` intentionally
> left `product_variant_pk` null on the assumption that cart-checkout decrement was product-level —
> but `CheckoutService` resolved cart lines by the UUID `product_id`/`product_variant_id`, which are
> null for wp-* catalog, so the stock-validate and stock-apply passes **skipped wp-* cart lines
> entirely** (no validation, no decrement) → silent oversell on the main
> storefront purchase path. V176 adds `cart_items.product_variant_pk`, populates it at add-to-cart,
> and switches cart + checkout resolution to `product_pk` / `product_variant_pk` (varchar, uniform
> for UUID and wp-* entities). Cart-checkout now decrements at variant level and snapshots
> `product_variant_pk` onto the order line, so restore stays symmetric. See `cart_items —
> product_variant_pk (V176)` below.

### cart_items — `product_variant_pk` (V176)

| Table | Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|---|
| `cart_items` | `product_variant_pk` | `VARCHAR(64)` | YES | `null` | Varchar snapshot of `product_variants.id` for the line's variant — the cart-side counterpart of `order_line_items.product_variant_pk` (V158) and `cart_items.product_pk` (V74). |

The legacy UUID columns `cart_items.product_id` / `product_variant_id` are `null` for migrated wp-*
catalog (string PKs), which made cart-checkout skip stock for those lines (see V176 fix box above).
`product_pk` was already stored; `product_variant_pk` adds the variant side so checkout resolves and
decrements the exact variant. Populated by `CartService.addItem`; cart item dedup, guest-cart merge,
availability marking, and quantity re-validation all key on `product_pk` / `product_variant_pk` so
two distinct wp-* products no longer collapse onto one cart line. V176 backfills existing rows from
the UUID column (exact) and from `product_pk` + `variant_name` (best-effort, only when unambiguous).

### customers / customer_sessions — social login + remember-me (V129)

| Table | Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|---|
| `customers` | `oauth_provider` | `VARCHAR(20)` | YES | `null` | Social provider the account is linked to (`google` / `facebook`); `null` for password-only accounts |
| `customers` | `oauth_subject` | `VARCHAR(255)` | YES | `null` | Stable provider-side user id (the OAuth `sub`). Unique together with `oauth_provider` |
| `customer_sessions` | `remember` | `BOOLEAN` | NO | `false` | Whether the session was created with "Ghi nhớ" — drives the refresh-cookie lifetime and is preserved across refresh-token rotation |

Partial unique index `ux_customers_oauth` on `(oauth_provider, oauth_subject)` where `oauth_provider IS NOT NULL` — prevents two accounts linking to the same provider identity.

### Dashboard KPI — `todayPaidRevenue` field

`AdminDashboardSummaryResponse.KpiResponse` includes:

| Field | Computation | Purpose |
|---|---|---|
| `todayRevenue` | `SUM(totalAmount)` excluding CANCELLED/FAILED | Gross GMV placed today _(REFUNDED removed 2026-06-23)_ |
| `todayPaidRevenue` | `SUM(paidAmount)` where `paymentStatus IN ('PAID')` | Actual cash collected today (PARTIALLY_PAID removed in V114) |

Status: `CONFIRMED_FROM_CODE`

Evidence: `AdminDashboardService.java`, `AdminDashboardSummaryResponse.java`

Status: `CONFIRMED_FROM_CODE` (P-1 fix applied in `AdminDashboardService.java` and `OrderJpaRepository.java`)

## Customer Status Enum

The customer `status` column is a `VARCHAR(50)` string in the `customers` table. The authoritative set of valid values is defined in `AdminCustomerService.ALLOWED_STATUSES` (line 48).

| Value | Meaning |
|---|---|
| `ACTIVE` | Normal active customer |
| `DISABLED` | Account disabled by admin |
| `PENDING` | Registration pending verification |
| `BLOCKED` | Account permanently blocked |

**Note:** `INACTIVE` is NOT a valid database status value. It is a computed segment label returned by `AdminCustomerService.deriveSegment()` for display purposes only. Filtering by `status = 'INACTIVE'` at the database level will return zero results.

A `CustomerStatus` Java enum (`domain/customer/CustomerStatus.java`) codifies these values for type-safe use in service and repository layers.

Status: `CONFIRMED_FROM_CODE`

Evidence: `AdminCustomerService.java` line 48, `deriveSegment()` method

## Reports Analytics Response Shape

`GET /api/v1/admin/reports/analytics` returns `AdminAnalyticsResponse`.

### PeriodSummary (summary field)

| Field | Type | Description |
|---|---|---|
| `grossOrderValue` | `BigDecimal` | GMV: SUM(totalAmount) excl CANCELLED/FAILED _(REFUNDED removed 2026-06-23)_ |
| `paidRevenue` | `BigDecimal` | SUM(paidAmount) where paymentStatus = PAID, excl CANCELLED orders (PARTIALLY_PAID removed in V114; REFUNDED removed 2026-06-23) |
| `orderCount` | `int` | COUNT excl CANCELLED/FAILED |
| `avgOrderValue` | `BigDecimal` | grossOrderValue / orderCount; zero if orderCount = 0 |

### DailyRevenue item (dailyRevenue[] array)

| Field | Type | Description |
|---|---|---|
| `date` | `String` | ISO-8601 date string `YYYY-MM-DD` in Asia/Ho_Chi_Minh timezone |
| `revenue` | `BigDecimal` | Daily grossOrderValue (same exclusion set as summary) |

### TopProduct item (topProducts[] array)

| Field | Type | Description |
|---|---|---|
| `productKey` | `String` | COALESCE(product_pk, product_id::text) — stable identifier across admin-created and regular products |
| `productName` | `String` | Product name snapshot from order line item |
| `revenue` | `BigDecimal` | SUM(lineTotal) excl RANKING_EXCLUDED statuses |
| `unitsSold` | `long` | SUM(quantity) excl RANKING_EXCLUDED statuses |

### TopCustomer item (topCustomers[] array)

| Field | Type | Description |
|---|---|---|
| `customerKey` | `String` | COALESCE(customer_id::text, customer_email) — stable group key |
| `customerEmail` | `String` | MAX(customer_email) — display email |
| `revenue` | `BigDecimal` | SUM(totalAmount) excl RANKING_EXCLUDED statuses |
| `orderCount` | `int` | COUNT of orders excl RANKING_EXCLUDED statuses |

Status: `CONFIRMED_FROM_CODE` — shape confirmed from `AdminAnalyticsResponse.java` audit; fields updated per P0 plan.

Evidence: `AdminAnalyticsResponse.java`, `AdminReportService.java`, `OrderJpaRepository.java`, `OrderLineItemJpaRepository.java`

## Site Settings — `setting_group` enum (V132)

`SiteSettingEntity` rows in table `site_settings` are partitioned by `setting_group`. The admin settings screen renders one tab per group. Group names are **lowercase**.

| `setting_group` | Purpose | Admin tab |
|---|---|---|
| `general` | Site name, footer text, BCT registration URL | Cài đặt chung |
| `contact` | Hotline/email/address, opening hours, social links — **shared site data** for the header/footer + the static `/lien-he` and `/gioi-thieu` pages. Since 2026-06-23 both the contact page builder and the Settings "Liên hệ" tab are gone; the group has **no admin UI** (hidden via `HIDDEN_GROUPS`). Rows stay in the DB and feed the web read-only; unhide `CONTACT` to allow editing again. | (ẩn — dữ liệu chung, không UI) |
| `public_home` | Homepage hotline, promo banner, experience/about blocks | Trang chủ |
| `payment` | Bank-transfer account shown to customers at checkout — holder, number, bank, branch (4 keys) | Thanh toán |
| `public_about` | **Removed 2026-06-24 (V274).** The About page (`/gioi-thieu`) is **fully static** — copy from i18n `About`, the 5 service tiles from theme assets; the web never read these keys (`AboutPageContent.tsx`). The 28 rows (seeded V223, re-seeded V269), the `SettingDefinitionRegistry` defs, and `AboutServiceMediaSeeder` were all dropped. | (đã gỡ) |
| `public_product` | **No shared settings.** All product-detail content is per-product now: the commitment-rows block under the buy buttons (`product.commitments`, child table `product_commitments`, V232) and the trust-badge row above the title (`product.trustBadges`, child table `product_trust_badges`, V233). The former `product_commitment_*` (V228) and `product_trust_*` keys were removed in V232/V233. | (không có tab — nhóm trống) |
| `public_hero` | Hero banners for listing pages (`/san-pham`, `/brands`, `/tin-tuc`) — 17 keys (5 per page incl. per-page `illustration_url` + 2 global fallbacks). Managed by the dedicated **Banner trang** admin screen (`BannerScreen.jsx`), not the generic settings screen. | Banner trang |
| `promo` | **No rows.** The promo-banner keys live in the `public_home` group (`promo_title`/`promo_off`/`promo_href`/`promo_image_url`), not a separate `promo` group — no `promo` group exists in the DB. | (không có tab — nhóm trống) |
| `seo` | Homepage SEO title/description, OG image, bottom HTML block | SEO website |
| `store` | Operational: low-stock threshold | Cửa hàng |
| `inventory` | **No rows.** The `default_warranty_months` key was removed in V266 (warranty module dropped); `reservation_ttl_minutes` and `serial_inventory_only` in V259 (serial tracking dropped). No `inventory` group remains in the DB. | (không có tab — nhóm trống) |
| `product_assign` | Editable text of the "Phân công" guide shown on the product create/edit screen — role names + task lists (7 keys). **Super-admin-only writable** (see below). | Phân công sản phẩm |
| `security` | **Removed 2026-06-24 (V273).** `login_max_attempts` + `session_timeout_minutes` were seeded (V29) but **never enforced** by any auth/session code (no account lockout, no idle-timeout); dropped from the DB and from `SettingDefinitionRegistry`. | (đã gỡ) |

**Removed:** `payment_sepay` — the SePay payment gateway was removed in V59; any leftover `payment_sepay` rows are deleted by V132.

### `public_about` keys — removed (2026-06-24, V274)

> **Removed (2026-06-24, V274).** The entire `public_about` setting group (all `about_page_*` keys, seeded by V223 and re-seeded by V269) was **dropped**. The About page (`/gioi-thieu`) is fully static: the copy comes from the i18n `About` namespace and the 5 service tiles from theme assets (`AboutPageContent.tsx`) — the web never consumed these settings. Removed together: the 28 DB rows (V274), the 28 `SettingDefinitionRegistry` definitions, and the runtime `AboutServiceMediaSeeder` (+ its 5 bundled seed images). The store/hotline/Facebook cards in the connect block still read the shared `contact` keys; brand logos still load from the brand taxonomy.

### `public_warranty` keys — removed (2026-06-23, V266)

> **Removed (2026-06-23, V266).** The entire `public_warranty` setting group (all `warranty_page_*` keys) and the `/bao-hanh` web page were **deleted** along with the warranty feature. There is no longer a warranty-lookup page, a **Trang Bảo hành** settings tab, or any `warranty_page_*` setting. Customer-facing warranty wording survives only as CMS policy content (e.g. the "Chính sách bảo hành" content page) and per-product marketing rows.

### `public_product` keys — product-page trust badges

The `public_product` group has **no shared settings** — all product-detail content is per-product.

> **Commitment rows moved to per-product (V232).** The former `product_commitment_{1..3}_title/subtitle` keys (V228) were **removed**; the block is stored **per product** in `product_commitments` — see *"`product_commitments` — per-product commitment rows (V232)"* below.
>
> **Trust badges moved to per-product (V233).** The former `product_trust_genuine` / `product_trust_freeship` keys were **removed in V233**. The trust-badge row above the product title is now stored **per product** in the `product_trust_badges` child table (id, product_id, sort_order, content, content_en) and edited inside the product detail screen (section "Dải tin cậy"). Mirrors `product_commitments`, simplified to a single bilingual label per badge. Resolved by locale on read (`toTrustBadges` in `JpaCatalogReadRepository`); `contentEn` only on admin reads. Empty list → web hides the row. **No default seed** — products start with an empty list; admin curates per product. `WpPurchaseSection.tsx` reads `product.trustBadges` directly. The eyebrow line above the title (`category.name / originBrandCountry`, falls back to brand name) is unchanged and built from existing product data.

`AboutServiceMediaSeeder` is idempotent: it keys MinIO objects deterministically (`uploads/seed/about-service-{n}.png`), looks up the `media` row by `file_path`, and only rewrites the setting while its value is blank or a `/wp-content/themes/` path — so admin-chosen images are never overwritten. MinIO is per-environment and not replicated by DB migrations, so the seed runs at runtime on each env; MinIO failures are logged (not fatal) and the web still falls back to the theme image baked into `bigbike-web/public`.

### `product_assign` keys + super-admin-only write (V157)

The product create/edit screen shows a "Phân công" (team-assignment) guide banner. Its text is no longer hardcoded — it lives in `site_settings` (group `product_assign`, `is_public = false`), seeded by `V157__seed_product_assignment_settings.sql` with the original Vietnamese defaults.

| `setting_key` | Type | Content |
|---|---|---|
| `product_assign_title` | STRING | Banner heading ("Phân công") |
| `product_assign_role_content` | STRING | Role 1 label ("Content") |
| `product_assign_items_content` | LONG_TEXT | Tasks owned by Content |
| `product_assign_role_seo` | STRING | Role 2 label ("SEO") |
| `product_assign_items_seo` | LONG_TEXT | Tasks owned by SEO |
| `product_assign_role_manager` | STRING | Role 3 label ("Quản lý") |
| `product_assign_items_manager` | LONG_TEXT | Tasks owned by Manager |

**Super-admin-only write.** These keys carry a `superAdminOnly` flag in `SettingDefinitionRegistry`. `AdminSettingsService` rejects any write (single or batch) to a `superAdminOnly` key unless the caller holds the wildcard `*` permission (i.e. `SUPER_ADMIN`) — even `ADMIN` (who has `settings.write`) is blocked. `AdminSiteSettingResponse` exposes `superAdminOnly` so the admin UI hides the tab for non-super-admins. The flag is surfaced in `AdminSiteSettingResponse.superAdminOnly`.

Migration `V132__cleanup_sepay_and_normalize_inventory_settings.sql`:
- `DELETE FROM site_settings WHERE setting_group = 'payment_sepay'` — removes dead SePay rows that survived V59 in some environments.
- `UPDATE site_settings SET setting_group = 'inventory' WHERE setting_group = 'INVENTORY'` — folds the legacy uppercase `INVENTORY` group into the lowercase `inventory` group so casing is uniform.

Status: `CONFIRMED_FROM_CODE`

Evidence:
- `SettingDefinitionRegistry.java` — registers keys for `general`/`contact`/`payment`/`public_home`/`public_hero`/`seo`/`store`/`product_assign` (the `promo`/`tax`/`inventory`/`public_product`/`security`/`public_about` groups have **no** registered keys)
- `V157__seed_product_assignment_settings.sql` — seeds the 7 `product_assign_*` rows
- `AdminProductAssignmentController.java` — `GET /api/v1/admin/product-assignment` (read for the banner, `products.read`)
- `SettingsScreen.jsx` — `TAB_ORDER` / `TAB_META` (tab rendering), `HIDDEN_GROUPS` (`public_hero`, `contact`), super-admin filter for `superAdminOnly` keys
- `V59__remove_sepay_payment_artifacts.sql`, `V132__cleanup_sepay_and_normalize_inventory_settings.sql`

### PDP mockup port — bilingual description blocks, featured specs, per-product tabs (V229–V231)

Ba migration bổ sung cho trang chi tiết sản phẩm (bigbike-web), port bố cục mockup nhưng giữ design
system web. Tất cả nullable / default an toàn → sản phẩm cũ giữ nguyên hành vi (không backfill).

| Migration | Bảng.cột | Kiểu | Default | Ý nghĩa |
|---|---|---|---|---|
| `V229` | `products.description_blocks_en` | `JSONB` | `NULL` | Khối mô tả có cấu trúc bản tiếng Anh (song song `description_blocks` của V139). Render → `description_en` HTML lúc lưu (giống VI). NULL = English authored as legacy HTML hoặc chưa dịch → web fallback `description_en`. |
| `V230` | `product_specifications.featured` | `BOOLEAN NOT NULL` | `false` | ~~"Đưa lên ô nổi bật"~~ **GỠ BỎ ở `V235`** — thay bằng bảng per-product `product_spec_stats` (ô số liệu nhập riêng, tách khỏi thông số kỹ thuật). Xem §"Product 'Specs Dashboard' stat boxes — `product_spec_stats` (V235)". |
| `V231` | `products.product_tabs` | `JSONB` | `NULL` | Cấu hình tab PDP theo từng sản phẩm. NULL = dùng tab mặc định (Mô tả/Đánh giá/Thông số/Lắp đặt/FAQ). Mỗi tab: `{ id, type, enabled, sortOrder, label, labelEn, blocks, blocksEn }`; `type` ∈ description\|reviews\|specs\|installation\|faq\|custom. Lưu canonical: `label`/`blocks`=vi, `labelEn`/`blocksEn`=en. |
| `V234` | `reviews.title` + `reviews.photos` | `varchar(160)` + `JSONB` | `NULL` | Tiêu đề tuỳ chọn + mảng URL ảnh khách hàng (MinIO `/media/reviews/...`, ≤10) cho đánh giá sản phẩm. Nullable, không backfill → review cũ giữ `NULL`. Xem `BUSINESS_RULES.md` `REVIEW_RULE_005`. |
| `V245` | `products.section_visibility` | `TEXT` | `NULL` | ~~"Hiển thị trên web": bật/tắt 5 section dạng tab~~ **CHỨC NĂNG GỠ khỏi admin+web (2026-06-22).** Cột giữ **ngủ yên** (không drop): backend còn truyền qua nhưng admin không ghi, web bỏ qua. Mọi khối PDP nay hiện **thuần theo nội dung**. Xem `BUSINESS_RULES.md` `PRODUCT_RULE_006` (đã đánh dấu gỡ). |

**Localize đọc (public):** `description_blocks` resolve theo `lang` (en → `description_blocks_en`, fallback vi) qua
`JpaCatalogReadRepository.pickBlocks`; `product_tabs` resolve `label`/`blocks` theo locale qua `resolveTabs`
(public bỏ raw `labelEn`/`blocksEn`; admin read giữ raw để soạn song ngữ). (`specifications[].featured` của V230 đã
**gỡ bỏ ở V235** → thay bằng `specStats`, xem §"product_spec_stats (V235)".) Khối EN của mô tả nằm trong admin read tại `translations.en.descriptionBlocks`.

Status: `CONFIRMED_FROM_CODE` — `ProductEntity.descriptionBlocksEn`/`productTabs`,
`ProductTab` + `ProductTabsConverter`, `AdminCatalogMutationService` (descriptionBlocksEn / mapTabs / applySpecifications),
`JpaCatalogReadRepository` (pickBlocks / resolveTabs / toSpecifications), migrations `V229`–`V231`.
Xem [API_CONTRACT.md](API_CONTRACT.md) §"PDP — descriptionBlocks(En) / specifications.featured / tabs (V229–V231)".
