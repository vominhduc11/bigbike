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
- POS, cart, and checkout tests

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
| `variant.sku` | `product_variants.sku varchar(100)` | **Selling SKU** — the code used at POS, cart, checkout, inventory, and returns to identify the actual unit sold. | **Required + globally unique** on the admin upsert API (`@NotBlank` + case-insensitive uniqueness; see `BUSINESS_RULES.md` → `PRODUCT_RULE_SKU_001`). Enforced by partial unique index `ux_product_variants_sku_lower` on `lower(sku)` (V244). Column stays nullable (index ignores nulls) so the requirement is write-time, not a schema `NOT NULL`. |

When snapshotting line items into cart/order/POS, the system uses `variant.sku` first, falling back to `product.sku`. This fallback supports products that have no variants (where `product.sku` is the selling code) and legacy variants whose `sku` is still null (created before the requirement / WP-import).

Inventory and serial-tracking views surface both fields (`product_sku`, `variant_sku`) so admin tools can locate units by either code.

Status: `CONFIRMED_FROM_CODE`

Evidence:

- `ProductEntity.java` (line 34)
- `ProductVariantEntity.java` (line 29)
- `PosOrderService.java` (line 233)
- `CartService.java` (line 153)
- `CheckoutService.java` (line 723)
- `V1__create_catalog_content_tables.sql` (lines 65, 166)
- `V51__add_serial_tracking.sql` (lines 123, 127)

### Cost price (admin-only)

`products.cost_price` and `product_variants.cost_price` (`numeric(19,2)`, nullable, `>= 0`; added in `V195`) store the purchase/cost price used by the POS below-cost guard (`ORDER_RULE_008`). Resolution mirrors selling price: **variant cost first, then product cost**; `NULL` means cost is unknown and no enforcement applies.

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

### POS order snapshot fields

Current POS flow persists or emits these notable fields:

- order channel/source: `IN_STORE` / `pos`
- immediate `COMPLETED` and `PAID` state
- `createdByAdminId`
- `customerName`
- `customerPhone`
- `customerNote`
- payment record with provider `POS`

`AdminOrderListItemResponse` (admin order list) exposes `source` so the list can render a POS badge — previously `source` was only on the order detail response. `PosOrderResponse` exposes `customerName`/`customerPhone`/`customerId` so the POS receipt can print buyer info and the UI can navigate to the linked profile. Evidence: `AdminOrderListItemResponse.java`, `OrderMapper.toAdminListItem`, `PosOrderService.PosOrderResponse`.

**POS-created customer profiles (this PR):** since POS now requires a phone and resolves/auto-creates the customer (`POS_CUSTOMER_002`), a brand-new walk-in produces a `customers` row with `phone` (normalized), `display_name` (entered name or `"Khách tại quầy"`), `status = ACTIVE`, `is_synthetic = true`, `credit_enabled = false`, and no `email`/`password_hash`. No schema change is needed — `customers.phone` is already nullable+unique (`customers_phone_unique`, V64) and email/password are nullable. These profiles appear in the admin customer list (the list does not filter out `is_synthetic` by default). The order snapshot columns (`customer_name`/`customer_phone`) are unchanged and still reflect exactly what staff typed for that sale.

**Phone normalization (this PR):** `customers.phone` is now stored in normalized form (`PhoneNumbers.normalize`: strip spaces/dashes, `+84`/`84` → `0`) consistently across **online registration, login, profile update, admin customer edit, and POS**. This makes phone a reliable identity key (the same person typing `+84…` or `0…` resolves to one profile). Lookups also try the `+84…` variant so pre-existing rows stored before this change (no backfill performed) still match. The WordPress importer (`CustomerImporter`) is intentionally excluded — historical import data is left as-is.

Status: `CONFIRMED_FROM_CODE`

### Admin invite (email-based admin user onboarding)

Admin users are onboarded by **email invite**, not by an admin typing a password. Schema impact (`V201__admin_invite_tokens.sql`):

- `admin_users.password_hash` is now **nullable** — an `INVITED` user has no password until they accept. Login (`AdminAuthService.login`) rejects any account whose `password_hash` is null.
- New table `admin_invite_tokens`: `id` (uuid PK), `admin_user_id` (uuid, FK → `admin_users`, `ON DELETE CASCADE`), `token_hash` (varchar(64), unique — SHA-256 of the raw token, raw token never stored), `expires_at` (timestamptz, default 48h), `used_at` (timestamptz, null until accepted), `created_at` (timestamptz). One active (unused, unexpired) token per user; creating/resending an invite deletes the user's prior tokens first.

Flow: create admin (`admin-users.write`) → row inserted `status = INVITED`, no password, invite token + email sent → invitee opens `{ADMIN_BASE}/accept-invite?token=…` → `POST /api/v1/auth/admin/accept-invite` sets password, flips `status = ACTIVE`, consumes the token.

Status: `CONFIRMED_FROM_CODE`

Evidence:

- `PosOrderService.java`
- `V71__add_pos_staff_and_customer_name_to_orders.sql`

### Coupon channel

`CouponEntity` has a `channel` column (`coupons.channel varchar(20) NOT NULL DEFAULT 'ALL'`) controlling which sales channel may redeem the coupon.

| Value | Allowed in |
|---|---|
| `ALL` | Both online (web/mobile cart) and POS |
| `ONLINE` | Web/mobile cart only — rejected at POS |
| `POS` | POS only — rejected in web/mobile cart |

`CouponPolicyService.validateChannel(coupon, channel)` enforces the check. `CartService` passes `"ONLINE"` and `PosOrderService` passes `"POS"`.

Status: `CONFIRMED_FROM_CODE`

Evidence:

- `CouponEntity.java`
- `CouponPolicyService.java`
- `CartService.java`
- `PosOrderService.java`
- `V118__add_coupon_channel.sql`

### Coupon snapshot

Checkout and POS both copy coupon usage to `OrderAppliedCouponEntity` with:

- `couponId`
- `code`
- `discountAmount`
- `createdAt`

Status: `CONFIRMED_FROM_CODE`

Evidence:

- `CheckoutService.java`
- `PosOrderService.java`

### Return data

`CustomerReturnResponse` currently includes:

- identity: `id`, `returnNumber`, `orderId`, `orderNumber`
- state: `status`
- narrative: `reason`, `customerNote`, `adminNote`
- financials: `refundAmount`
- nested `items[]` and `history[]`
- timestamps: `createdAt`, `updatedAt`

Status: `CONFIRMED_FROM_CODE`

Evidence:

- `CustomerReturnResponse.java`
- `CreateReturnRequest.java`

## Inventory And Serial Model

- Active serial model is `stock_movement_serials` linked to `StockMovementEntity`.
- Manual stock-in requires exact serial count match.
- Receipt-based receiving (`stock_receipts`, `stock_receipt_lines`, `stock_receipt_serials`) was **dropped in V120**. The tables were schema-only — no Java entity/service/controller/UI ever referenced them. Stock-in runs entirely through `stock_movements` (type `IN`) + `stock_movement_serials`.

Status:

- movement serial model: `CONFIRMED_FROM_CODE`
- receipt workflow: `REMOVED` (V120 — dropped, never implemented)

Evidence:

- `AdminInventoryService.java`
- `StockMovementSerialEntity.java`
- `V57__add_stock_movement_serials.sql`
- `V120__drop_stock_receipt_tables.sql`

### stockState — derived field `CONFIRMED_FROM_CODE`

`stockState` trên `product_variants` và `products` là **derived field** — luôn tính từ `quantityOnHand` / `stock_quantity`. Không được set thủ công qua catalog create/update API.

| Bảng | Quantity field | stockState owner |
|---|---|---|
| `product_variants` | `quantity_on_hand` | `variant.stockState` |
| `products` | `stock_quantity` (dùng cho sản phẩm không có variant) | `product.stockState` |

**Quy tắc:**
- `quantity <= 0` → `OUT_OF_STOCK`
- `0 < quantity <= low_stock_threshold` → `LOW_STOCK`
- `quantity > low_stock_threshold` → `IN_STOCK`

**API input contract:** `stockState` bị bỏ khỏi `UpsertProductRequest` và `VariantRequest`. Nếu client gửi trường này lên, backend bỏ qua.

**API response contract:** `stockState` vẫn có trong response (read-only) để FE và client hiển thị.

**forceOutOfStock:** field này vẫn là manual override (emergency disable) và khác biệt với `stockState`. Checkout sẽ từ chối ngay cả khi `stockState = IN_STOCK` nếu `forceOutOfStock = true`.

Evidence:

- `InventoryPolicyService.java`
- `AdminCatalogMutationService.java` (removed stockState from create/update path)
- `CheckoutService.java`
- `BUSINESS_RULES.md` STOCK_RULE_001–007
- `V108__backfill_stock_state_from_quantity.sql`
- `V165__aggregate_variant_product_stock_state.sql` (trigger giữ `products.stockState` đồng bộ với variants)
- `V174__recompute_stock_state_from_real_inventory.sql` (backfill: dọn "còn hàng ảo" của hàng WP-import — variant + sản phẩm không variant về `OUT_OF_STOCK` khi `quantity <= 0` và không còn serial `IN_STOCK`)

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

### Product description blocks — `description_blocks` (V139)

Admin-curated structured content stored as JSONB in `products.description_blocks` (nullable). The column holds a JSON array of block objects — the **structured** source of truth for the "Mô tả sản phẩm" section. The mutation service renders blocks to HTML and writes the result into the existing `description` (TEXT) column simultaneously, so public consumers see no change.

Eleven block types (8 gốc + 3 khối PDP chuyên biệt V246):

| `type` | Required fields | Optional fields |
|---|---|---|
| `heading` | `level` (2 or 3), `text` (≤ 500 chars) | — |
| `paragraph` | `html` (≤ 50 000 chars; inline `<b><i><a><br>` only) | — |
| `list` | `style` (`bulleted`\|`numbered`), `items` (1–200 strings, each ≤ 2 000 chars) | — |
| `image` | `url` (≤ 2 000 chars) | `alt` (≤ 500), `caption` (≤ 500) |
| `video` | `provider` (`youtube`\|`upload`), `url` (≤ 2 000 chars) | `caption` (≤ 500) |
| `callout` | `variant` (`info`\|`warning`\|`note`), `html` (≤ 10 000 chars) | — |
| `divider` | — | — |
| `feature` | `url` (≤ 2 000 chars) | `side` (`auto`\|`left`\|`right`, mặc định `auto`), `alt` (≤ 500), `caption` (≤ 500), `subheading` (≤ 500), `heading` (≤ 500), `html` (≤ 50 000), `listStyle` (`bulleted`\|`numbered`), `items` (≤ 200 strings, each ≤ 2 000 chars) |
| `suitability` (V246) | — | `title` (≤ 500), `cards` (≤ 100 thẻ `{audience ≤500, advice ≤2000, linkLabel ≤500, linkUrl ≤2000}`) |
| `sizeGuide` (V246) | — | `title` (≤ 500), `html` (≤ 20 000; cho phép thẻ `<table>`) |

**2 khối PDP chuyên biệt (V246) — chỉ dùng cho SẢN PHẨM:** `suitability` (Phù hợp với ai), `sizeGuide` (Bảng size). Bản EN nằm ở khối tương ứng trong `description_blocks_en` (theo vị trí). **Ưu/Nhược điểm (`prosCons`) ĐÃ TÁCH RA khỏi mô tả (V251)** — quay lại là khối RIÊNG cố định ngay dưới mô tả, ngoài tab; nguồn dữ liệu là bảng con `product_highlights` (xem §Ưu điểm/Nhược điểm), KHÔNG còn là khối trong `description_blocks`. Subtype `ProsConsBlock` vẫn còn trong sealed interface (dormant, để deserialize an toàn dữ liệu cũ); migration `V251` gỡ mọi khối `prosCons` còn sót trong `description_blocks`/`_en`.

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

### Product "Mua tại BigBike.vn" rows — `product_purchase_lines` (V249)

Per-product list of free-form rows rendered inside the **"Mua tại BigBike.vn"**
trust block on the PDP. Each product owns its own rows (admin tự thêm/bớt dòng),
mirroring `product_commitments` (V232) với cột song ngữ inline. **Thay thế** 4 field
scalar cũ `warranty_months` / `warranty_scope` / `pdp_shipping_line` /
`pdp_return_line` (giờ dormant — xem bảng "Cột scalar trên `products`"): domain field
tương ứng đã gỡ khỏi API/admin/web, dữ liệu cũ được V249 backfill sang bảng này.
Child table của `products`.

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | `BIGINT` identity | NO | Primary key. |
| `product_id` | `VARCHAR(64)` | NO | FK → `products.id`, `ON DELETE CASCADE`. |
| `sort_order` | `INTEGER` | NO | Display order; assigned by the admin editor. |
| `icon` | `VARCHAR(40)` | NO | Icon key từ bộ web cố định; trống khi ghi → `shield-check`. |
| `label` | `VARCHAR(200)` | NO | Nhãn dòng (tiếng Việt / canonical). Dòng có `label` trống bị bỏ khi ghi. |
| `value` | `VARCHAR(300)` | YES | Giá trị/diễn giải dòng (tuỳ chọn). |
| `label_en` | `VARCHAR(200)` | YES | Nhãn tiếng Anh tuỳ chọn; null → fallback `label`. |
| `value_en` | `VARCHAR(300)` | YES | Giá trị tiếng Anh tuỳ chọn; null → fallback `value`. |

DTO upsert nhận tối đa **12** dòng (`@Size(max = 12)`), **full-replace** (presence-flag).
Dòng có `label` trống bị loại khi ghi; `icon` trống → `shield-check`. Trả về trên
product detail (public + admin) dưới dạng mảng `purchaseLines` của domain `Product`;
**public read chỉ `{ icon, label, value }`**, admin read thêm `{ labelEn, valueEn }`.
**Detail-only** — omitted (`[]`) trên product *list* responses.

`V249` còn **backfill**: với mọi sản phẩm có dữ liệu cũ, tạo các dòng từ Bảo hành
(`warranty_months` → "N tháng" / "N months", fallback `warranty_scope`), Giao hàng
(`pdp_shipping_line`) và Đổi trả (`pdp_return_line`), giữ nguyên thứ tự. Cột scalar
gốc được giữ dormant (không drop).

Status: `CONFIRMED_FROM_CODE` — `ProductPurchaseLineEntity`, `ProductPurchaseLine`
domain record, `PurchaseLineRequest`, `UpsertProductRequest` (`purchaseLines`),
`AdminCatalogMutationService.applyPurchaseLines`, `JpaCatalogReadRepository.toPurchaseLines`,
migration `V252__create_product_purchase_lines.sql`.

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
| `warranty_months` | `INTEGER` | YES | **(dormant từ V249)** Domain field `warrantyMonths` đã gỡ; cột giữ làm lưới an toàn, dữ liệu đã backfill sang `product_purchase_lines`. Không còn admin đọc/ghi. |
| `warranty_scope` | `TEXT` | YES | **(dormant từ V249)** Domain field `warrantyScope` đã gỡ; cột giữ làm lưới an toàn, dữ liệu đã backfill (fallback) sang `product_purchase_lines`. Không còn admin đọc/ghi. |
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
`video_provider VARCHAR(16)` (`youtube`|`upload`); cột `image_url` được **nới NULL** (item video
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

**Ngoài phạm vi:** `pages` (trang tĩnh) KHÔNG có `slug_en` (giữ `PAGE_RULE_003` — web định tuyến một số trang tĩnh/chính sách bằng slug cố định).

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

**Pages:** không có `featured` và không bật `seo_no_index` đợt này — `featured` không áp dụng; `noIndex` luôn `false`.

Status: `CONFIRMED_FROM_CODE` — `ArticleEntity.featured`, `ArticleEntity.seoNoIndex`, migration `V222__add_article_featured_and_seo_no_index.sql` (ghi chú: cột `seo_no_index` từng bị drop ở `V152`). Xem [API_CONTRACT.md](API_CONTRACT.md) §"Article payload — featured + seo.noIndex (V222)".

### Page bilingual content — English columns (V138)

Trang tĩnh có 2 bản nội dung: **tiếng Việt** (canonical) và **tiếng Anh** (tùy chọn).
Bản tiếng Anh lưu trên các cột `_en` nullable cùng dòng trong bảng `pages`.

**Cột `_en` trên `pages`** (đều nullable):

| Cột tiếng Việt | Cột tiếng Anh | Kiểu |
|---|---|---|
| `title` | `title_en` | `VARCHAR(255)` |
| `body` | `body_en` | `TEXT` |
| `hero_title` | `hero_title_en` | `VARCHAR(255)` |
| `hero_description` | `hero_description_en` | `TEXT` |
| `hero_kicker` | `hero_kicker_en` | `VARCHAR(255)` |
| `seo_title` | `seo_title_en` | `VARCHAR(255)` |
| `seo_description` | `seo_description_en` | `TEXT` |

Fallback: giống `PRODUCT_RULE_002` — mỗi trường lùi về VI khi EN bị null/blank. Xem `PAGE_RULE_001/002`.

Status: `CONFIRMED_FROM_CODE` — `PageEntity`, `PageTranslations` domain record, migration `V138`.

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

### Page body blocks — `body_blocks` (V140)

`pages.body_blocks` là cột `jsonb` thêm vào trong migration `V140`. Cùng định dạng block với article — xem §"Article body blocks (V140)".

**Migration (V141):** HTML cũ trong cột `body` của tất cả page đã được parse sang blocks bởi `BodyBlockParser`.

**Read / mutation semantics:** giống hệt article `body_blocks` — xem §"Article body blocks (V140)".

Status: `CONFIRMED_FROM_CODE` — `PageEntity.bodyBlocks`, `Page.bodyBlocks`, `AdminContentItem.bodyBlocks`, `UpsertPageRequest.bodyBlocksPresent`, `AdminContentMutationService.applyPagePatch`, migration `V140/V141`.

### Contact page layout — `contact_page_layout.blocks` (V224)

Bảng singleton `contact_page_layout(id uuid PK, blocks jsonb, updated_at timestamptz)` — đúng **một dòng** (id cố định `…0000c0`, seed trong `V224`). Cột `blocks` là mảng khối bố cục của trang `/lien-he`; builder thay cả mảng khi lưu (giống pattern save-whole-list của home highlights).

Mỗi phần tử (`ContactBlock`):

| field | kiểu | ghi chú |
|---|---|---|
| `id` | string | khóa ổn định cho reorder |
| `type` | enum | `channel` \| `address` \| `hours` \| `map` \| `richtext` |
| `enabled` | boolean | khối có render trên web không |
| `sortOrder` | int | thứ tự trong cột (tăng dần) |
| `column` | enum | `main` (trái) \| `online` (phải) |
| `icon` | string | tên lucide (vd `Phone`) **hoặc** đường dẫn/URL ảnh |
| `labelVi` / `labelEn` | string | nhãn song ngữ; web lùi về VI khi EN trống |
| `bindKey` | string? | key `site_settings` cấp giá trị (null = khối custom) |
| `value` / `href` | string? | giá trị/link **chỉ** cho khối custom (bound thì null) |
| `htmlVi` / `htmlEn` | string? | nội dung HTML cho khối `richtext` |

**Single source of truth:** giá trị khối bound (hotline, địa chỉ, giờ, URL mạng xã hội) **không** lưu trong `blocks` — nằm ở `site_settings`, ghi xuyên qua endpoint contact-page (whitelist nhóm `contact`). Xem `BUSINESS_RULES.md` §"Contact Page Builder Rules".

Status: `CONFIRMED_FROM_CODE` — `ContactBlock.java`, `ContactPageLayoutEntity.java`, `ContactBlocksConverter.java`, `ContactPageService.java`, migration `V224`.

### Guide page layout — `guide_page_layout.entries` (V227)

Bảng singleton `guide_page_layout(id uuid PK, hero_title_vi text, hero_title_en text, hero_image_url text, entries jsonb NOT NULL, updated_at timestamptz)` — đúng **một dòng** (id cố định `…0000d0`, seed trong `V227`). Cột `entries` là mảng ô của trang tổng `/huong-dan`; builder thay cả mảng khi lưu (giống pattern save-whole-list của contact page / home highlights).

Hero (3 cột riêng, không nằm trong JSON): `hero_title_vi` / `hero_title_en` (web lùi về VI khi EN trống) + `hero_image_url` (ảnh banner, URL MinIO).

Mỗi phần tử (`GuideEntry`):

| field | kiểu | ghi chú |
|---|---|---|
| `id` | string | khóa ổn định cho reorder |
| `enabled` | boolean | ô có render trên web không |
| `sortOrder` | int | thứ tự trong lưới (tăng dần) |
| `pathSegment` | string | đoạn URL dưới `/huong-dan/` (vd `mua-hang` → `/huong-dan/mua-hang/`) |
| `pageSlug` | string | slug trang CMS chứa nội dung chi tiết (vd `huong-dan-mua-hang`) |
| `icon` | string? | tên lucide (vd `BookOpen`) **hoặc** URL ảnh MinIO |
| `titleVi` / `titleEn` | string | tiêu đề ô song ngữ; web lùi về VI khi EN trống |
| `descriptionVi` / `descriptionEn` | string? | mô tả ngắn song ngữ |

**Phân chia nguồn nội dung:** layout (lưới ô + hero) ở `guide_page_layout`; **thân bài chi tiết** vẫn ở trang CMS (`pages`) theo `pageSlug` — giữ nguyên SEO, bản EN, rich text của module Trang. Web lấy lưới + sidebar + map `pathSegment→pageSlug` từ entries (một nguồn duy nhất; không còn đọc menu location `guide` cho sidebar). Xem `BUSINESS_RULES.md` §"Guide Page Builder Rules".

Status: `CONFIRMED_FROM_CODE` — `GuideEntry.java`, `GuidePageLayoutEntity.java`, `GuideEntriesConverter.java`, `GuidePageService.java`, migration `V227`.

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

### Page hero fields (V98)

`PageEntity` holds an optional hero banner block surfaced on public CMS pages (`/gioi-thieu`, `/lien-he`, `/chinh-sach/*`, `/huong-dan*`). Hero is independent of the SEO OG image and the article cover image.

| Column | DB column | Type | Nullable | Purpose |
|---|---|---|---|---|
| `heroImageUrl` | `hero_image_url` | `VARCHAR(1024)` | YES | Public URL of hero background. Empty/null → web falls back to `wp-cat-hero--no-img` gradient. |
| `heroImageAlt` | `hero_image_alt` | `VARCHAR(512)` | YES | Alt text for accessibility. |
| `heroTitle` | `hero_title` | `VARCHAR(256)` | YES | Heading override. If null, web renders `page.title`. |
| `heroDescription` | `hero_description` | `VARCHAR(1024)` | YES | Short tagline below the heading. Plain text. |
| `heroKicker` | `hero_kicker` | `VARCHAR(128)` | YES | Small uppercase chip rendered above the heading (e.g. `GIỚI THIỆU`). |

Migration: `V98__add_page_hero_fields.sql` — `ALTER TABLE pages ADD COLUMN hero_* …` (all nullable, no default).

For the **listing pages** (`/san-pham`, `/brands`, `/tin-tuc`) which have no `PageEntity`, the same five hero attributes are stored as `SiteSettingEntity` rows in setting group `public_hero` (15 keys total — see [API_CONTRACT.md](API_CONTRACT.md#admin-settings-contract)).

Status: `CONFIRMED_FROM_CODE`

Evidence:
- `PageEntity.java` — added 5 `hero*` fields
- `Page.java` — domain record extended with hero fields
- `UpsertPageRequest.java` — admin DTO accepts `heroImage` + `heroTitle` + `heroDescription` + `heroKicker`
- `JpaContentReadRepository.toDomain(PageEntity)` — maps entity → domain
- `SettingDefinitionRegistry.java` — registers 15 `hero_(products|brands|news)_*` keys
- `V98__add_page_hero_fields.sql`

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

## Accounts Receivable Data Fields

Status: `CONFIRMED_FROM_CODE` — implemented in `V75__add_credit_and_receivables.sql`.

### customers table — credit columns added (V75)

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `credit_enabled` | `BOOLEAN` | NO | `false` | Whether this customer is allowed to purchase on credit |
| `credit_limit` | `NUMERIC(19,2)` | YES | `null` | Maximum outstanding balance; null = uncapped |
| `payment_terms_days` | `INTEGER` | YES | `null` | Days until payment is due after credit sale |
| `credit_status` | `VARCHAR(50)` | NO | `'ACTIVE'` | `ACTIVE` / `SUSPENDED` / `BLOCKED` |
| `credit_note` | `TEXT` | YES | `null` | Internal admin note on credit profile |

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
`OrderLineItemEntity.resolveVariantKey()` (and `resolveProductKey()` for the product side). The
stock-restore paths (`OrderStockRestoreService`, `AdminReturnService`) use this so cancel /
refund / completed-return correctly restock variants of migrated products.

Snapshotted at line creation on every sell path that decrements the variant by its string id —
POS (`PosOrderService`), storefront quick-buy (`CheckoutService.buildLineItemFromProduct`), and
storefront cart-checkout (`CheckoutService.buildLineItemFromCart`, since V176). Historical rows
keep `product_variant_pk = NULL` and fall back to product-level restore. Fixed BUG-2 — see
`TEST_REPORT.md` and `QaBug2StockRestoreTest`.

> **V176 fix (cart-checkout wp-* stock leak).** Before V176, `buildLineItemFromCart` intentionally
> left `product_variant_pk` null on the assumption that cart-checkout decrement was product-level —
> but `CheckoutService` resolved cart lines by the UUID `product_id`/`product_variant_id`, which are
> null for wp-* catalog, so the stock-validate and stock-apply passes **skipped wp-* cart lines
> entirely** (no validation, no decrement, no serial reservation) → silent oversell on the main
> storefront purchase path. V176 adds `cart_items.product_variant_pk`, populates it at add-to-cart,
> and switches cart + checkout resolution to `product_pk` / `product_variant_pk` (varchar, uniform
> for UUID and wp-* entities). Cart-checkout now decrements/reserves at variant level and snapshots
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

### accounts_receivable table (V75; `version` column added in V83)

| Column | Type | Nullable | Purpose |
|---|---|---|---|
| `id` | `UUID PK` | NO | Primary key |
| `order_id` | `UUID FK → orders.id UNIQUE` | NO | One receivable per order |
| `customer_id` | `UUID FK → customers.id` | YES | Null for walk-in without account |
| `customer_name` | `VARCHAR(200)` | YES | Name snapshot at creation |
| `customer_phone` | `VARCHAR(30)` | YES | Phone snapshot at creation |
| `original_amount` | `NUMERIC(19,2)` | NO | Total order amount at time of credit sale |
| `paid_amount` | `NUMERIC(19,2)` | NO | Cumulative amount received so far |
| `outstanding_amount` | `NUMERIC(19,2)` | NO | `original_amount - paid_amount` (maintained in-sync) |
| `written_off_amount` | `NUMERIC(19,2)` | NO | Amount written off (0 unless WRITTEN_OFF) |
| `status` | `VARCHAR(50)` | NO | `OPEN` / `PARTIALLY_PAID` / `OVERDUE` / `CLOSED` / `WRITTEN_OFF` |
| `due_date` | `DATE` | YES | `placedAt + paymentTermsDays`; null if terms not set |
| `payment_terms_days` | `INTEGER` | YES | Snapshot of terms at time of sale |
| `credit_limit_snapshot` | `NUMERIC(19,2)` | YES | Snapshot of customer credit_limit at time of sale |
| `created_from` | `VARCHAR(50)` | YES | Origin channel (e.g. `POS`) |
| `note` | `TEXT` | YES | Staff note |
| `write_off_reason` | `TEXT` | YES | Mandatory when WRITTEN_OFF |
| `written_off_at` | `TIMESTAMPTZ` | YES | Timestamp of write-off |
| `created_by_admin_id` | `UUID` | YES | Admin who created the receivable |
| `created_at` | `TIMESTAMPTZ` | NO | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | NO | Last update timestamp |
| `version` | `BIGINT` | NO | Optimistic locking version |

Constraints: `UNIQUE(order_id)`, `CHECK status IN (...)`, `CHECK outstanding_amount >= 0`, `CHECK paid_amount >= 0`.

Indexes: `(customer_id)`, `(status)`, `(due_date)`, `(created_at DESC)`.

### API response shapes

#### ReceivableListItemResponse

`id`, `orderId`, `orderNumber`, `customerId`, `customerName`, `customerPhone`, `originalAmount`, `paidAmount`, `outstandingAmount`, `status`, `dueDate`, `overdueDays`, `createdFrom`, `createdAt`

#### ReceivableDetailResponse

All list fields plus: `writtenOffAmount`, `paymentTermsDays`, `creditLimitSnapshot`, `note`, `writeOffReason`, `writtenOffAt`, `updatedAt`

#### ReceivableSummaryResponse

`totalOutstanding`, `overdueOutstanding`, `writtenOffTotal`, `countOpen`, `countOverdue`

#### ReceivableAgingResponse

`notDue`, `days0To30`, `days31To60`, `days61To90`, `over90` (all BigDecimal outstanding amounts)

### Dashboard KPI — `todayPaidRevenue` field

`AdminDashboardSummaryResponse.KpiResponse` includes:

| Field | Computation | Purpose |
|---|---|---|
| `todayRevenue` | `SUM(totalAmount)` excluding CANCELLED/FAILED/REFUNDED | Gross GMV placed today |
| `todayPaidRevenue` | `SUM(paidAmount)` where `paymentStatus IN ('PAID')` | Actual cash collected today (PARTIALLY_PAID removed in V114) |

Credit (CREDIT) orders contribute to `todayRevenue` but NOT to `todayPaidRevenue` (until payment is recorded), preserving accurate cash-vs-credit separation.

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
| `grossOrderValue` | `BigDecimal` | GMV: SUM(totalAmount) excl CANCELLED/FAILED (REFUNDED included) |
| `paidRevenue` | `BigDecimal` | SUM(paidAmount) where paymentStatus IN (PAID, REFUNDED) excl CANCELLED orders (PARTIALLY_PAID / PARTIALLY_REFUNDED removed in V114) |
| `refundAmount` | `BigDecimal` | SUM(refundAmount) for orders placed in range (placedAt-anchored) |
| `netRevenue` | `BigDecimal` | paidRevenue − refundAmount; may be negative |
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
| `contact` | Public contact email/address, social links | Liên hệ |
| `public_home` | Homepage hotline, promo banner, experience/about blocks | Trang chủ |
| `public_about` | Full About page (`/gioi-thieu`) copy: intro block-head, intro paragraphs (HTML), quality block, 5 service tiles (title/body/image/highlight), connect block — 28 keys. Seeded by `V223`. | Trang Giới thiệu |
| `public_warranty` | Full Warranty-lookup page (`/bao-hanh`) copy: SEO meta, banner heading, lookup-box kicker/sub/labels/button, result-table labels, status badges (incl. `{daysLeft}` templates), result footers, plus two optional admin rich-text blocks (intro + policy/FAQ) and an optional intro image — 25 keys. Seeded by `V225`. The serial-lookup tool itself is unchanged; only the copy is dynamic. | Trang Bảo hành |
| `public_product` | **No shared settings.** All product-detail content is per-product now: the commitment-rows block under the buy buttons (`product.commitments`, child table `product_commitments`, V232) and the trust-badge row above the title (`product.trustBadges`, child table `product_trust_badges`, V233). The former `product_commitment_*` (V228) and `product_trust_*` keys were removed in V232/V233. | Trang sản phẩm |
| `public_hero` | Hero banners for listing pages (`/san-pham`, `/brands`, `/tin-tuc`) — 17 keys (5 per page incl. per-page `illustration_url` + 2 global fallbacks). Managed by the dedicated **Banner trang** admin screen (`BannerScreen.jsx`), not the generic settings screen. | Banner trang |
| `promo` | Homepage promotion banner | Khuyến mãi |
| `seo` | Homepage SEO title/description, OG image, bottom HTML block | SEO website |
| `store` | Operational: low-stock threshold | Cửa hàng |
| `inventory` | Operational: stock reservation TTL, default warranty months, serial-only selling | Tồn kho |
| `product_assign` | Editable text of the "Phân công" guide shown on the product create/edit screen — role names + task lists (7 keys). **Super-admin-only writable** (see below). | Phân công sản phẩm |
| `security` | Login attempts, session timeout — devops-managed, hidden from the admin UI | (hidden) |

**Removed:** `payment_sepay` — the SePay payment gateway was removed in V59; any leftover `payment_sepay` rows are deleted by V132.

### `public_about` keys — full About page content (V223)

The `/gioi-thieu` page was previously rendered from hardcoded theme copy (i18n `About` namespace) whenever the `Page.body` was blank. `V223__seed_about_page_content_settings.sql` lifts that copy into `site_settings` (group `public_about`, all `is_public = true`) so the shop admin can edit every part from **Cài đặt → Trang Giới thiệu** while keeping the original 5-tile layout. Each text key is seeded with both `setting_value` (VI) and `setting_value_en` (EN). The web page reads settings-first and falls back to the i18n `About` defaults only when a key is blank.

| `setting_key` | Type | Content |
|---|---|---|
| `about_page_kicker` | STRING | Intro block-head small heading |
| `about_page_tagline` | LONG_TEXT | Intro block-head tagline |
| `about_page_intro_html` | HTML | Four opening paragraphs (rich-text) |
| `about_page_quality_heading` | STRING | "Chất lượng dịch vụ" heading |
| `about_page_quality_body` | LONG_TEXT | "Chất lượng dịch vụ" body |
| `about_page_service{1..5}_title` | STRING | Service tile title |
| `about_page_service{1..5}_body` | LONG_TEXT | Service tile body |
| `about_page_service{1..5}_image` | IMAGE_URL | Service tile image. V223 seeds the theme path `images/a-{n}.png`; on startup **`AboutServiceMediaSeeder`** uploads the 5 bundled defaults (`resources/seed/about-services/a-{n}.png`) to MinIO, creates `media` rows, and rewrites the setting to the `/media/...` URL. |
| `about_page_service{1..5}_highlight` | BOOLEAN | Orange tile background (default: tiles 1 & 5 = true) |
| `about_page_connect_heading` | STRING | "Kết nối với chúng tôi" heading |
| `about_page_connect_intro1` | LONG_TEXT | Connect block paragraph 1 |
| `about_page_connect_intro2` | LONG_TEXT | Connect block paragraph 2 |

Tile count is fixed at 5 (the grid layout depends on it); adding/removing tiles is a separate enhancement. The store/hotline/Facebook cards in the connect block still read the shared `contact` keys; brand logos still load from the brand taxonomy.

### `public_warranty` keys — full Warranty-lookup page content (V225)

All copy on `/bao-hanh` lives here. The web page (`app/bao-hanh/page.tsx`) reads settings-first and falls back to the `Warranty` i18n namespace per key, so the page is never blank if a row is empty. The serial-lookup tool's behaviour is unchanged — only its text is dynamic.

| `setting_key` | Type | Content |
|---|---|---|
| `warranty_page_meta_title` | STRING | SEO `<title>` |
| `warranty_page_meta_description` | LONG_TEXT | SEO meta description |
| `warranty_page_heading` | STRING | Page banner heading (also breadcrumb leaf) |
| `warranty_page_kicker` | STRING | Lookup-box kicker |
| `warranty_page_subheading` | LONG_TEXT | Lookup-box sub-line |
| `warranty_page_intro_html` | HTML | **New** rich-text block above the lookup box (empty → hidden) |
| `warranty_page_intro_image` | IMAGE_URL | **New** optional illustration for the intro block (empty → hidden). Uploaded to MinIO via the admin media picker |
| `warranty_page_serial_label` | STRING | Serial input label |
| `warranty_page_serial_placeholder` | STRING | Serial input placeholder |
| `warranty_page_serial_hint` | LONG_TEXT | Hint below the serial input |
| `warranty_page_submit_button` | STRING | Lookup button text |
| `warranty_page_submitting` | STRING | Button text while looking up |
| `warranty_page_not_found` | STRING | "No warranty found" message |
| `warranty_page_result_heading` | STRING | Result block heading |
| `warranty_page_field_product` / `_serial` / `_start` / `_end` | STRING | Result-table row labels |
| `warranty_page_status_active` / `_almost_expired` | STRING | Status badge templates — must keep the `{daysLeft}` placeholder |
| `warranty_page_status_expired` / `_voided` | STRING | Status badge labels |
| `warranty_page_footer_active` / `_voided` | LONG_TEXT | Note under the result for active / voided cards |
| `warranty_page_policy_html` | HTML | **New** rich-text policy/FAQ block below the result (empty → hidden) |

Edited from the generic **Settings** screen (`SettingsScreen.jsx`) under the new **Trang Bảo hành** tab — no dedicated screen. The group is in `TRANSLATABLE_GROUPS`, so text keys carry a VI + EN value (images/templates excluded from the EN editor as usual).

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
- `SettingDefinitionRegistry.java` — registers keys for `general`/`contact`/`public_home`/`public_about`/`public_warranty`/`public_hero`/`promo`/`seo`/`store`/`tax`/`product_assign`
- `V157__seed_product_assignment_settings.sql` — seeds the 7 `product_assign_*` rows
- `AdminProductAssignmentController.java` — `GET /api/v1/admin/product-assignment` (read for the banner, `products.read`)
- `SettingsScreen.jsx` — `TAB_ORDER` / `TAB_META` (tab rendering), `HIDDEN_GROUPS` (`security`, `payment_sepay`), super-admin filter for `superAdminOnly` keys
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
| `V245` | `products.section_visibility` | `TEXT` | `NULL` | "Hiển thị trên web": opaque JSON string `{sectionKey: boolean}` cho **5 section dạng tab** (`description, specifications, faqs, videos, reviews`). Backend truyền nguyên (như `size_guide`); admin serialize / web parse. **NULL = legacy** → web hiện theo nội dung; key=false → ẩn; key=true → hiện nếu có nội dung. SP mới opt-in (tắt hết). Không backfill. Khối ngoài tab không nằm trong map (web tự hiện khi có nội dung); map cũ chứa khoá ngoài-tab hoặc `_order` được bỏ qua an toàn. Xem `BUSINESS_RULES.md` `PRODUCT_RULE_006`. |

**Localize đọc (public):** `description_blocks` resolve theo `lang` (en → `description_blocks_en`, fallback vi) qua
`JpaCatalogReadRepository.pickBlocks`; `product_tabs` resolve `label`/`blocks` theo locale qua `resolveTabs`
(public bỏ raw `labelEn`/`blocksEn`; admin read giữ raw để soạn song ngữ). (`specifications[].featured` của V230 đã
**gỡ bỏ ở V235** → thay bằng `specStats`, xem §"product_spec_stats (V235)".) Khối EN của mô tả nằm trong admin read tại `translations.en.descriptionBlocks`.

Status: `CONFIRMED_FROM_CODE` — `ProductEntity.descriptionBlocksEn`/`productTabs`,
`ProductTab` + `ProductTabsConverter`, `AdminCatalogMutationService` (descriptionBlocksEn / mapTabs / applySpecifications),
`JpaCatalogReadRepository` (pickBlocks / resolveTabs / toSpecifications), migrations `V229`–`V231`.
Xem [API_CONTRACT.md](API_CONTRACT.md) §"PDP — descriptionBlocks(En) / specifications.featured / tabs (V229–V231)".
