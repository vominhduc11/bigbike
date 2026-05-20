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
- Current allowlist excludes SVG.

Status: `CONFIRMED_FROM_CODE`

Evidence:

- `AdminMediaService.java`
- product/content DTO mappings in repo

### SKU fields

`product.sku` and `variant.sku` are two different things despite sharing a name.

| Field | DB column | Role | Required? |
|---|---|---|---|
| `product.sku` | `products.sku varchar(100)` | **Model code / group code** — optional descriptive identifier for the product family. Not used as the selling code when variants exist. | Optional (nullable, no unique constraint) |
| `variant.sku` | `product_variants.sku varchar(100)` | **Selling SKU** — the code used at POS, cart, checkout, inventory, and returns to identify the actual unit sold. | Optional (nullable, no unique constraint) |

When snapshotting line items into cart/order/POS, the system uses `variant.sku` first, falling back to `product.sku`. This fallback supports products that have no variants (where `product.sku` is the selling code) and variants that were created without a SKU.

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

### Product rich-text content fields

Four independent rich-HTML columns on the `products` table feed distinct
section bands of the product detail page (PDP). All are admin-editable, optional
(nullable), stored as `TEXT`, and limited to 50 000 characters by the upsert
DTO (`@Size(max = 50000)`).

| Field | DB column | PDP surface |
|---|---|---|
| `description` | `description` | "Mô tả sản phẩm" section band |
| `promotionContent` | `promotion_content` (added `V124__add_product_promotion_content.sql`) | "Ưu đãi & khuyến mãi" section band — hidden when empty |
| `installationGuide` | `installation_guide` (added `V133__add_product_installation_guide_and_faq.sql`) | "Hướng dẫn lắp đặt" section band — hidden when empty |
| `contentBottom` | `content_bottom` (added `V43`) | Long-form SEO copy band below the related-products grid |

`promotionContent` and `installationGuide` are surfaced on both the public
product detail response and the admin product read response (they are
components of the domain `Product` record). Empty/blank values are normalized
to `NULL` on write.

Status: `CONFIRMED_FROM_CODE`

### Product description blocks — `description_blocks` (V139)

Admin-curated structured content stored as JSONB in `products.description_blocks` (nullable). The column holds a JSON array of block objects — the **structured** source of truth for the "Mô tả sản phẩm" section. The mutation service renders blocks to HTML and writes the result into the existing `description` (TEXT) column simultaneously, so public consumers see no change.

Seven block types:

| `type` | Required fields | Optional fields |
|---|---|---|
| `heading` | `level` (2 or 3), `text` (≤ 500 chars) | — |
| `paragraph` | `html` (≤ 50 000 chars; inline `<b><i><a><br>` only) | — |
| `list` | `style` (`bulleted`\|`numbered`), `items` (1–200 strings, each ≤ 2 000 chars) | — |
| `image` | `url` (≤ 2 000 chars) | `alt` (≤ 500), `caption` (≤ 500) |
| `video` | `provider` (`youtube`\|`upload`), `url` (≤ 2 000 chars) | `caption` (≤ 500) |
| `callout` | `variant` (`info`\|`warning`\|`note`), `html` (≤ 10 000 chars) | — |
| `divider` | — | — |

**Presence semantics (PATCH):** Sending `descriptionBlocks` (including `[]`) triggers rendering and overwrites **both** columns (`description_blocks` and `description`). Omitting the key leaves both columns untouched.

**Read:** `description_blocks` is returned on product detail responses (public and admin) as `descriptionBlocks: BlockObject[] | null`. Not included in list responses (null).

**HTML sanitizer:** Rendered HTML is sanitized (Jsoup `Safelist`) before writing to `description` to block XSS vectors (`<script>`, `on*` handlers, `javascript:` URIs).

Status: `CONFIRMED_FROM_CODE` — `DescriptionBlock.java` (sealed interface), `DescriptionBlocksConverter`, `ProductEntity.descriptionBlocks`, `DescriptionBlockRenderer`, `AdminCatalogMutationService.applyProductPatch`, migration `V139`.

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
| `answer` | `TEXT` | NO | FAQ answer (plain text; max 20 000 chars at the DTO). |

The upsert DTO accepts at most 50 FAQ entries (`@Size(max = 50)`). Rows with a
blank question or answer are dropped on write. Exposed on the public and admin
product detail responses as the `faqs` array on the domain `Product` record;
omitted from product *list* responses (detail-only, like `specifications`).

Status: `CONFIRMED_FROM_CODE` — `ProductFaqEntity`, `ProductFaq` domain record,
`FaqRequest`, `AdminCatalogMutationService.applyFaqs`, migration `V133`.

### Product related products — `product_related_product_map` (V135)

Admin-curated list of catalog products shown in the PDP "Sản phẩm liên quan"
section band. Self-referential, ordered many-to-many on `products`. Schema
mirrors `article_product_map` (V130).

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
`UpsertProductRequest.relatedProductIds`, `AdminCatalogMutationService.resolveRelatedProducts`,
`JpaCatalogReadRepository.toRelatedProducts`, migration `V135`.

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

**Không dịch ở đợt này:** `slug` (URL dùng chung 1 bản), alt ảnh, tên video,
tên biến thể, `seo_canonical_url`.

Status: `CONFIRMED_FROM_CODE` — `ProductEntity`, `ProductSpecificationEntity`,
`ProductFaqEntity` (các trường `*En`), `ProductTranslations` domain record,
`JpaCatalogReadRepository` (resolve locale), migration `V136`.

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

Status: `CONFIRMED_FROM_CODE` — `CategoryEntity`, `CategoryTranslations` domain record, migration `V137`.

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

Status: `CONFIRMED_FROM_CODE` — `BrandEntity`, `BrandTranslations` domain record, migration `V137`.

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

Status: `CONFIRMED_FROM_CODE` — `ArticleEntity`, `ArticleTranslations` domain record, migration `V138`.

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
| `FEATURED_GRID` | "Sản phẩm nổi bật" grid | Max 12 shown (frontend-enforced) |
| `RECOMMENDED_CAROUSEL` | "Gợi ý dành cho bạn" carousel | Max 10 shown (frontend-enforced) |

A product occupies exactly one slot — no deduplication pass needed. Admin UI shows a warning banner when the filtered count of a slot exceeds its display limit.

**Backfill rule (V111):** `is_featured=true` → `FEATURED_GRID`; else `show_on_homepage=true` → `RECOMMENDED_CAROUSEL`; else `NONE`. Legacy columns then dropped via `ALTER TABLE products DROP COLUMN is_featured, DROP COLUMN show_on_homepage`.

Status: `CONFIRMED_FROM_CODE`

Evidence:
- `ProductEntity.java` — `@Column(name = "homepage_block") @Enumerated(EnumType.STRING) private HomepageBlock homepageBlock` (no `isFeatured` / `showOnHomepage` fields)
- `HomepageBlock.java` — enum `NONE | FEATURED_GRID | RECOMMENDED_CAROUSEL`
- `UpsertProductRequest.java` — presence-flag pattern (`homepageOrderPresent`) prevents null from clearing an existing value on partial PATCH
- `AdminCatalogMutationService.applyProductPatch()` — applies `homepageBlock` and `homepageOrder` updates
- `CatalogReadService.productComparator()` — compound sort: pinned ASC/DESC, null last, `createdAt:DESC` tiebreaker
- `V111__refactor_product_homepage_block.sql` — schema change + backfill + column drop
- `API_CONTRACT.md` §"Admin Catalog Contract" — documents filter/sort params for `homepageBlock`

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

### Article ↔ Product relation (V130)

An article may reference a set of catalog products ("Sản phẩm sử dụng trong bài viết" — products
showcased on the blog detail page). The relation is many-to-many and ordered.

**Join table `article_product_map`:**

| Column | Type | Nullable | Purpose |
|---|---|---|---|
| `article_id` | `VARCHAR(64)` | NO | FK → `articles.id`, `ON DELETE CASCADE`. |
| `product_id` | `VARCHAR(64)` | NO | FK → `products.id`. |
| `sort_order` | `INTEGER` | NO | Display order, ascending. Owned by Hibernate `@OrderColumn`. |

Composite primary key `(article_id, product_id)`; indexes on both FK columns. Schema mirrors
`article_tag_map` / `article_category_map`.

**Domain exposure:**
- `Article.relatedProducts` — `List<Product>`. The public read path
  (`JpaContentReadRepository.toDomain(ArticleEntity)`) maps each linked `ProductEntity` to a
  list-item `Product` (no variants/specs/gallery) and **filters out products that are not
  `PUBLISHED`** — trashed/draft products never surface on the storefront.
- `AdminContentItem.relatedProducts` — `List<RelatedProductRef>` (`id`, `slug`, `name`, `imageUrl`),
  a lightweight shape so the admin article editor can render product chips without a second fetch.
- `UpsertArticleRequest.productIds` — `List<String>`; the admin upsert replaces the article's product
  set with the resolved, de-duplicated, order-preserving list. `null` keeps the existing set; an
  empty list clears it (same presence semantics as `tags`).

No backfill — the table starts empty. The legacy `articles.product_image_url` / `product_image_alt`
columns are unrelated (a single decorative thumbnail) and are left untouched.

Migration: `V130__add_article_product_map.sql`.

Status: `CONFIRMED_FROM_CODE` — `ArticleEntity.products`, `Article.relatedProducts`,
`JpaContentReadRepository`, `AdminContentMutationService.resolveProducts`, `V130`.

### Catalog facets response shape

Read-only aggregation served by `GET /api/v1/catalog/facets` (see [API_CONTRACT.md](API_CONTRACT.md#catalog-facets-contract)). No DB table — computed in-memory from the catalog read model.

`CatalogFacets`:
| Field | Type | Purpose |
|---|---|---|
| `categories` | `FacetBucket[]` | One bucket per visible category. |
| `brands` | `FacetBucket[]` | One bucket per visible brand; `image` carries the brand logo. |
| `colors` | `FacetBucket[]` | The 10 fixed named colors. |
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

### customers / customer_addresses — account page fields (V126, V127)

| Table | Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|---|
| `customers` | `newsletter_subscribed` | `BOOLEAN` | NO | `false` | Newsletter opt-in; backs the "Đăng ký nhận tin" checkbox on the account info page |
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
| `public_hero` | Hero banners for listing pages (`/san-pham`, `/brands`, `/tin-tuc`) — 15 keys | Hero trang |
| `promo` | Homepage promotion banner | Khuyến mãi |
| `seo` | Homepage SEO title/description/H1, OG image | SEO website |
| `store` | Operational: minimum checkout amount, low-stock threshold | Cửa hàng |
| `tax` | VAT rate, tax-inclusive flag, tax registration number | Thuế & Phí |
| `inventory` | Operational: stock reservation TTL, default warranty months, serial-only selling | Tồn kho |
| `security` | Login attempts, session timeout — devops-managed, hidden from the admin UI | (hidden) |

**Removed:** `payment_sepay` — the SePay payment gateway was removed in V59; any leftover `payment_sepay` rows are deleted by V132.

Migration `V132__cleanup_sepay_and_normalize_inventory_settings.sql`:
- `DELETE FROM site_settings WHERE setting_group = 'payment_sepay'` — removes dead SePay rows that survived V59 in some environments.
- `UPDATE site_settings SET setting_group = 'inventory' WHERE setting_group = 'INVENTORY'` — folds the legacy uppercase `INVENTORY` group into the lowercase `inventory` group so casing is uniform.

Status: `CONFIRMED_FROM_CODE`

Evidence:
- `SettingDefinitionRegistry.java` — registers keys for `general`/`contact`/`public_home`/`public_hero`/`promo`/`seo`/`store`/`tax`
- `SettingsScreen.jsx` — `TAB_ORDER` / `TAB_META` (tab rendering), `HIDDEN_GROUPS` (`security`, `payment_sepay`)
- `V59__remove_sepay_payment_artifacts.sql`, `V132__cleanup_sepay_and_normalize_inventory_settings.sql`
