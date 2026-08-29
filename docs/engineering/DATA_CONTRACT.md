# Data Contract
## Canonical Data Notes

### Money

- Business intent is VND pricing.
- Current backend DTOs commonly serialize Java `BigDecimal` amounts with scale `2`, which appears in JSON and tests as values like `50000.00`.
- Do not document fractional business meaning for VND; document the current serialized shape instead.

Evidence:

- `CartService.java`
- `CheckoutService.java`
- cart and checkout tests

### Admin notification data

- `admin_notifications` is the shared notification backlog; application writes are append-only and the retention job may delete only expired rows. Active fields are `id`, `type`, optional `order_id`/`order_number`, `payload`, and `created_at`; the legacy shared `is_read` field is removed by the retention cleanup migration.
- `admin_notification_reads` stores one `last_read_at` and `updated_at` per `admin_id`. It is never deleted by notification retention and is the only source used to derive `isRead` and `unreadCount` for the current admin.
- The API returns at most 50 recent in-scope rows. The `unreadCount` in the response is the exact server count and can exceed the 30 rows cached/displayed by the admin bell. Order/chat scope remains permission-filtered, and this change adds no payload or browser-storage data.
- Rows older than six calendar months by `created_at` are deleted in daily batches; expiry is age-based and does not inspect or mutate per-admin read markers.

Status: `OWNER_CONFIRMED_2026-08-28` / `CONFIRMED_FROM_CODE`

Evidence:

- `AdminNotificationEntity.java`
- `AdminNotificationReadEntity.java`
- `AdminNotificationController.java`
- `AdminNotificationRetentionCleanupService.java`
- `V1067__admin_notification_retention_and_remove_legacy_read_state.sql`

### Media fields

- Canonical public media shape remains `image`, `gallery[]`, and `videos[]` at the product/content contract level.
- Admin media persistence stores `publicUrl`, `mimeType`, `fileSize`, dimensions, status, storage metadata, and `originalFilename`. New uploads preserve the safe basename supplied by the uploader (including Unicode and extension); historical rows are backfilled from the stored object path when no original name was previously recorded. The authenticated admin download contract always streams the stored MinIO object, including `DELETED` rows, never a thumbnail/variant or an external URL-only video.
- `media.content_sha256` (V369) stores the lowercase SHA-256 of the bytes actually held in object storage. It is nullable for historical rows, format-checked, and unique when present. Live migration and admin upload use it to reuse identical content even when filenames differ; a checksum must never be populated until the object bytes have been read and verified.
- Allowlist for **new Admin Media Library uploads** is `image/jpeg|image/png|image/webp` and `video/mp4`. Audio was removed by the owner decision recorded in `BUSINESS_RULES.md` § Media Rules (AUD-074); historical audio or other legacy objects already present in storage are not deleted automatically. The owner decision on 2026-08-28 also removed GIF and SVG from all new admin image uploads and selectors. Declared MIME and Apache Tika content detection must match exactly; the filename extension is not trusted. Customer review/avatar/chat contracts remain separate and continue to accept JPEG/PNG/WebP.

Status: `CONFIRMED_FROM_CODE`

Evidence:

- `AdminMediaService.java`
- product/content DTO mappings in repo

### Live migration audit/checkpoint tables (V370)

`live_migration_runs` and `live_migration_checkpoints` are operational audit data for the one-time WordPress cutover. A run binds one immutable source snapshot SHA-256 and reviewed plan SHA-256 to its status and protected-domain baseline counts. Domain checkpoints are unique by `(run_id, domain,batch_number)`, but they are audit markers rather than partial-commit resume points: all PostgreSQL data, the run row, and checkpoints commit atomically only after post-write validation. A failure rolls the whole database transaction back; a small hash-bound `FAILED` run record may then be committed separately, with no data checkpoints. Content-addressed MinIO objects copied before rollback may remain and are reverified/reused by the next fresh-plan retry. These tables never contain source rows, customer/order/admin payloads, database passwords, OAuth/SMTP secrets, or backup credentials. They are not application catalog/content APIs and must not be repurposed as business data.

### Media dimension validation — ratio enforced, size is advisory only (owner clarification 2026-07-30; category square rule 2026-08-28)

Business rule (đổi 2026-07-04): mọi ảnh/video admin gán vào một vị trí hiển thị cụ thể **chỉ
cần đúng tỉ lệ** (nếu vị trí đó ép khung, tức `ratio` khác `null`) — không đạt tỉ lệ thì **bị từ
chối, không lưu được**. **Không còn chặn theo kích thước tối thiểu** (`minW`/`minH`) ở lớp
client theo từng vị trí nữa; các số `idealW`/`idealH`/`minW`/`minH` trong `IMAGE_RECO` giờ chỉ
còn vai trò **khuyến nghị hiển thị** cho admin (gợi ý nên dùng ảnh nét cỡ nào), không dùng để
chặn lưu. Vị trí có `ratio: null` (`squareMedium`, `illustration`, `general`) do đó
**không có điều kiện chặn theo kích thước**; Media Library cũng không áp dụng một sàn pixel
chung cho ảnh raster. `brand.logo` là ngoại lệ có hợp đồng riêng ở mục Brand logo bên dưới.
Ảnh nhỏ hợp lệ ở các vị trí khác vẫn được lưu, không upscale.

**Lịch sử:** trước 2026-07-03 chỉ cảnh báo (không chặn) → audit 2026-07-03 đổi thành chặn cả
kích thước tối thiểu VÀ tỉ lệ → **2026-07-04 bỏ chặn kích thước tối thiểu ở client, chỉ còn
chặn tỉ lệ** (kích thước xuống hàng khuyến nghị) → **2026-07-30 bỏ sàn pixel chung ở server**
theo owner clarification.

**Phương pháp (không đổi):** đo khung hiển thị THẬT bằng cách đọc trực tiếp component + CSS của
`bigbike-web` (desktop tham chiếu 1920×1080, mobile 390×844) — không suy đoán. Riêng
`categoryImage` của lưới danh mục trang chủ dùng khung vuông 64px ở điện thoại, 80px ở
máy tính bảng và 96px ở máy tính; ảnh được căn giữa bằng `object-contain`, không kéo giãn hoặc
cắt. Kích thước
khuyến nghị (`idealW`/`idealH`, trùng số với `minW`/`minH` cũ) = **2 × khung hiển thị thật** (hệ
số retina) — số này KHÔNG còn là ngưỡng chặn, chỉ để hiển thị gợi ý. Vị trí dùng chung 1 ảnh cho
nhiều ngữ cảnh (vd banner vừa làm nền desktop vừa mobile qua `background-size:cover`) → lấy ngữ
cảnh đòi hỏi độ phân giải cao nhất. Nguồn chuẩn duy nhất (single source of truth) là
`bigbike-admin/src/lib/imageRecommendations.js` (`IMAGE_RECO`) — bảng dưới đây là ảnh chụp lúc
audit, sửa code thì sửa cả bảng này.

| Spec key (`IMAGE_RECO`) | Vị trí dùng | Khung hiển thị thật (1×, evidence) | Kích thước khuyến nghị (2×, không chặn) | Tỉ lệ ép (vẫn chặn) |
|---|---|---|---|---|
| `productImage` | Ảnh đại diện + gallery sản phẩm (PDP) | Khung vuông tối đa 903×903px (desktop ≥1920px) — kính lúp zoom 2.5× cần nguồn ≥1300×1300 nhưng đã nằm trong 2×903 | 1800×1800 | 1:1 |
| `categoryImage` | Ảnh danh mục (`image`, lưới danh mục trang chủ) | Khung vuông 64px (điện thoại), 80px (máy tính bảng), 96px (máy tính); `object-contain`, không cắt | Không có kích thước tối thiểu; nguồn được tối ưu theo khung | 1:1 tuyệt đối khi ảnh mới/thay URL; ảnh cũ giữ nguyên nếu URL không đổi |
| `logo` | Logo hãng (`brand.logo`; lưới hãng, trang chi tiết hãng và Giới thiệu) | Khung vuông dùng chung: khoảng 88×88px ở carousel trang chủ, 96×96px ở danh sách, tối đa 320×320px ở chi tiết, 128×128px ở Giới thiệu; `object-contain`, không cắt | 800×800 | 1:1, sai lệch tối đa 1% khi ghi logo mới |
| `cover` | Ảnh OG/chia sẻ mạng xã hội (sản phẩm/danh mục/hãng/bài viết) | **Không có khung hiển thị trên bigbike-web** — chỉ nằm trong `<meta og:image>`, Facebook/Zalo tự crop → dùng thẳng chuẩn Open Graph, không áp công thức 2× nội bộ | 1200×630 | 40:21 |
| `promo` | Banner khuyến mãi trang chủ | Container rộng tối đa 1600px (≥1920px viewport), cao tự do theo ảnh (không crop) | 3200×1050 (chiều cao chỉ là gợi ý theo tỉ lệ 3:1, không ép) | tự do |
| `squareMedium` | Ảnh PNG nền trong chồng carousel "Góc trải nghiệm" trang chủ | Rộng tối đa ~266px (desktop, `ExperienceCarousel.tsx`), không ép cao | 600×600 | tự do |
| `illustration` | Ảnh minh hoạ hero (category `heroImageUrl`, brand-detail logo-as-hero, `hero_default/hero_*_illustration_url`) | Khung PageHero tối đa `451×400px`, `object-contain`, không cắt hoặc kéo méo; ảnh mặc định hệ thống `mu-bao-hiem.png` = 451×400 | 900×800 | tự do |
| `videoThumb` | Ảnh thumbnail carousel Video (trang chủ + "Video sản phẩm" PDP) | Thẻ **DỌC** `aspect-ratio 9/16`, rộng tối đa ~242px (desktop 1920px) — KHÔNG phải 16:9 ngang như giả định cũ | 500×900 | 9:16 |
| `video` | File video tải lên carousel Video ở trên | Khung player modal tối đa 420×747 (desktop) — cùng carousel dọc nên video gốc phải quay DỌC | 850×1500 | 9:16 |
| `contentVideo` | Video nhúng khối "video" trong bài viết/content | Khung **NGANG** 16:9 rộng bằng cột nội dung (~1170px desktop) — khác hẳn `video` ở trên dù cùng là "video tải lên" | 2340×1320 | 16:9 |
| `general` | Ảnh chèn khối "image" trong nội dung + ảnh chèn rich-text chung (FAQ, callout, mô tả hãng, `about_content_html`...) | Ngữ cảnh rộng nhất trong nhóm này: full cột nội dung ~1170px desktop | 2340×1560 | tự do |
| `featureImage` | Ảnh khối "feature" (ảnh cạnh chữ) trong nội dung | Nửa cột nội dung, ÉP 4:3 (`aspect-[4/3] object-cover`) → ~565×424 desktop | 1130×850 | 4:3 |
| *(không có key)* | `menuIconUrl` — icon 1 màu cạnh tên danh mục gốc trong menu đầu trang | Icon raster 1 màu (JPEG/PNG/WebP), hiển thị cố định 20×16px qua CSS mask | **Không kiểm tra kích thước** — ảnh chỉ hiển thị 20×16px | — |

**Chặn ở đâu:**

1. **Client (bigbike-admin, chặn theo tỉ lệ, không còn chặn theo kích thước):** `MediaPickerModal`/`VideoPickerModal` nhận prop `recommend` (spec ở trên) — đo kích thước ảnh/video vừa chọn (`useMediaValidation`), disable nút xác nhận + báo lỗi nếu sai tỉ lệ (`wrongRatio`) khi `spec.ratio` khác `null`. Không còn reason `tooSmall` — ảnh/video đúng tỉ lệ nhưng nhỏ hơn số khuyến nghị vẫn được chấp nhận. Ô upload hiện dòng khuyến nghị kích thước (không dùng từ "yêu cầu"/"bắt buộc" cho phần size) + nêu tỉ lệ bắt buộc nếu vị trí đó ép khung.
2. **Server (`AdminMediaService.java`):** kiểm tra file rỗng, giới hạn dung lượng, declared MIME và Apache Tika content detection; **không chặn ảnh raster theo kích thước pixel**. Server vẫn ghi nhận width/height khi runtime đọc được để trả metadata, nén theo `MEDIA_RULE_006` nhưng không upscale. Không enforce tỉ lệ ở server vì upload chưa gắn với vị trí hiển thị; client kiểm tra tỉ lệ khi chọn media cho field có khung ép.

Status: `CONFIRMED_FROM_CODE` (đo trực tiếp component bigbike-web + code hiện tại, xem evidence)

Evidence:

- `bigbike-web/components/ui/MediaImage.tsx`, `components/home/HomeCategoryGrid.tsx`, `components/home/BrandCarousel.tsx`, `components/about/AboutPageContent.tsx`, `app/[locale]/brands/BrandListClient.tsx`, `app/[locale]/brands/BrandListDefault.tsx`, `components/catalog/CatalogSidebar.tsx`, `components/layout/PageHero.tsx`, `components/catalog/ProductCard.tsx`, `components/layout/Footer.tsx`, `next.config.ts`
- `bigbike-web/components/catalog/ProductGallery.tsx`, `components/wp/WpCategoryHero.tsx`, `components/home/HeroSlider.tsx`, `components/home/video-carousel/VideoCard.tsx`, `components/home/video-carousel/VideoModal.tsx`, `components/home/ExperienceCarousel.tsx`, `components/catalog/description-blocks/blocks.tsx`, `app/page.tsx`, `app/globals.css` (container width tiers and protected image contexts)
- `bigbike-admin/src/lib/imageRecommendations.js`, `lib/useMediaDimensions.js`, `components/MediaPickerModal.jsx`, `components/VideoPickerModal.jsx`, `components/MediaRequirementHint.jsx`
- `bigbike-backend/.../service/admin/AdminMediaService.java` (MIME validation, dimension metadata, compression)

### SKU fields

`product.sku` and `variant.sku` are two different things despite sharing a name.

| Field | DB column | Role | Required? |
|---|---|---|---|
| `product.sku` | `products.sku varchar(100)` | **Product-level SKU** — labeled plainly "SKU" in the admin UI (renamed 2026-07-07 from "Model code / group code"). Not used as the selling code when variants exist. | **Always required** (draft and publish alike, `PRODUCT_RULE_005`), regardless of whether the product has variants. Column stays nullable (no unique constraint) — the requirement is write-time, not a schema `NOT NULL`. |
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

### Admin quick-search response

The admin topbar quick-search response is a compact read model and does not change the existing product list payload. A product result contains the product-level `sku` plus `matchedVariants[]` when a product variant matched the query. Each matched variant carries its stable `id`, selling `sku`, derived `name` and ordered `options[]` (`name`, `value`, and `attributeValueId` when available). The count is the number of distinct products, not the number of matching variants.

Order quick-search results carry both the order's stored customer-name snapshot and the shipping address `fullName` snapshot as separate fields, so the client can explain why the order matched without exposing a new write field. All other quick-search item fields are read-only projections of the existing admin list/detail data.

Text matching for the admin read path is accent-insensitive and case-insensitive. The staff product path retains every entered word; the assistant/public `ProductSearchTerms` stop-word behavior remains a separate contract. `%`, `_` and `\\` are data characters and never wildcard operators.

Status: `OWNER_CONFIRMED_FROM_HANDOFF_2026-08-28`

Evidence: `AdminQuickSearchResponse` DTOs, `ProductVariant`, `ProductVariantOption`, `OrderEntity`, `OrderAddressEntity`, `ProductSearchTerms`.

### Variant display name (derived, not admin-entered)

`product_variants.name varchar(255)` is **not admin-entered free text**. It is derived server-side on every save from the variant's own linked attribute values, joined in option order (e.g. `"Đen bóng - XL"`). `product_variant_options.attribute_id` and `attribute_value_id` are both `NOT NULL`; the value must belong to that attribute. The read path uses these foreign keys directly and never repeats a text lookup. A variant with no option rows falls back to the positional placeholder `"Biến thể N"` (1-based within the product).

`product_variant_options.legacy_display_name` and `legacy_display_value` are nullable compatibility snapshots populated only for rows repaired by the complete-link migration. They preserve the exact public option text that existed before a raw legacy row was connected to a canonical dictionary entry. Existing correctly linked rows and newly created rows keep both columns `NULL`. A product save carries these snapshots forward only when the same dictionary value remains selected; changing the option intentionally drops the snapshot and uses the new dictionary label.

The admin upsert request no longer accepts a `name` field for a variant (`VariantRequest` has no `name` property); the admin editor no longer renders a name input — it derives and displays the same value client-side for the accordion label, purely as a UI preview of what the backend will compute on save. Legacy rows (WordPress-imported, historically free text like `"color: do, size: m"`) were backfilled once to the derived convention (`V297__derive_variant_name_from_options.sql`).

Status: `CONFIRMED_FROM_CODE`

### Cart and audit retention data (V1046)

`carts.expires_at` is the authoritative expiry for a cart in retention scope. Only `ACTIVE` and
`MERGED` carts may have their expiry acted on; `CONVERTED` carts are never a purge candidate. The
application writes expiry as the last valid cart interaction plus 30 days. For an historical
`ACTIVE`/`MERGED` row whose expiry is null, V1046 sets it once to the last known
`updated_at` (or `created_at` when necessary) plus 30 days; it never backfills or purges a
`CONVERTED` row.

`maintenance_cart_purge_runs` records a one-off operational purge (`id`, cutoff, start/finish,
status, cart/item totals and optional failure reason). `maintenance_cart_purge_backup_carts` and
`maintenance_cart_purge_backup_items` keep a row-for-row copy of the deleted cart and cart-item
data under that run id. The backup has no customer/order mutation role; it exists solely to restore
one verified purge run (completed, or stopped after at least one backed-up batch) and is eligible
for deletion after 90 days.

`audit_logs.created_at` is the retention timestamp for administrative audit rows; records older
than 12 calendar months are eligible for the daily batch cleanup.

Evidence:

- `VariantRequest.java` (no `name` field)
- `AdminCatalogMutationService.java` (`applyVariants` / `deriveVariantName`)
- `V297__derive_variant_name_from_options.sql`
- `bigbike-admin/src/screens/product-detail/VariantEditors.jsx` (`deriveVariantName`, no name `<Input>` in `VariantCard`)

### Product pricing model — 2 fields (2026-07-04)

`products.retail_price` / `product_variants.retail_price` (`numeric(19,2)`, `NOT NULL` on products, nullable on variants) is the list price ("Giá niêm yết"). `sale_price` (`numeric(19,2)`, nullable, `>= 0`) is the optional discounted selling price ("Giá sale") — when set it must be strictly **less than** `retail_price` (enforced by `AdminMutationValidators.validateSalePriceRule`, both product- and variant-level). There is no admin/public read split any more — nothing sensitive left to withhold, so both prices are returned on every read (admin and public).

`compare_at_price` ("Giá gốc/gạch ngang") and `cost_price` ("Giá vốn") were **removed entirely** from both `products` and `product_variants` in `V317__consolidate_product_pricing.sql` (columns dropped, along with their `V195` non-negative `CHECK` constraints). Rationale: `cost_price` formerly backed the POS below-cost guard, which was removed with the POS module 2026-06-23 (`ORDER_RULE_008`) — it had zero remaining code consumers and zero populated rows in production at the time of removal. `compare_at_price` and `retail_price`/`salePrice` had become redundant in practice: of all rows with `compare_at_price` set, the only ones where it differed meaningfully from `retail_price` were rows with an active discount, and those rows already had `retail_price == sale_price` (or `sale_price` unset) — i.e. `compare_at_price` was carrying the "was" price while `retail_price` carried the "is" price, which is exactly what the 2-field model expresses directly.

Historical rows where `compare_at_price > retail_price` (a real, currently-displayed discount) were backfilled **before** the column drop, in the same migration: `sale_price = COALESCE(sale_price, retail_price)`, `retail_price = compare_at_price`. This is lossless per the pre-migration data audit (every affected row already had `retail_price == sale_price` or `sale_price IS NULL`).

The shared `ProductPrice` domain record is now `ProductPrice(BigDecimal retailPrice, BigDecimal salePrice, String currency)`.

**Web display rule** (PDP, product card, everywhere price is shown): `salePrice` set and `< retailPrice` → show `retailPrice` struck through + `salePrice` as the main/selling price + discount-percent badge. `salePrice` not set → show `retailPrice` as the plain selling price, no strikethrough, no badge. See `PRODUCT_RULE_012`.

**Checkout/charging rule (2026-07-06; extended 2026-07-07 — product price as shared/default variant price):** a product with zero variants is priced (both display and charging) at the product level. A product with **one or more variants**: a variant with its **own** `retailPrice` is "self-priced" — it is priced (both display and charging) by its own `retailPrice`/`salePrice`, and never falls back to the product's `salePrice` even if it has none of its own. A variant with **no** `retailPrice` of its own instead **defers entirely to the product's** `retailPrice`/`salePrice` as its effective price — this is a deliberate, permanent rule (not a legacy-data patch), used for both cart/checkout pricing and for the catalog read/display path (`JpaCatalogReadRepository.toVariant`/`toVariantForListing`), so the storefront and admin show the same effective price checkout would charge. `product_variants.retailPrice` is required once a product has ≥1 variant **only when the product itself has no valid `retailPrice` (`> 0`) to fall back to** — enforced at variant create/update (`CatalogRequestValidator`, `AdminMutationValidators.validateVariantFieldsRequired`) and mirrored client-side (`bigbike-admin/src/lib/schemas.js`), not just at read time. A variant with its own `salePrice` but no own `retailPrice` is rejected at write time (it isn't "self-priced," so that `salePrice` would otherwise be silently ignored in favor of the product's). See `PRODUCT_RULE_013`.

Status: `CONFIRMED_FROM_CODE`

Evidence:

- `ProductPrice.java`, `ProductSnapshotResponse.java` (both 2-field only)
- `AdminMutationValidators.validateSalePriceRule`, `AdminMutationValidators.validateVariantFieldsRequired`, `CatalogRequestValidator.java`
- `bigbike-web/lib/pricing.ts` (`derivePricing`)
- `V317__consolidate_product_pricing.sql`, `PRODUCT_RULE_012`
- `VariantPricing.java`, `CheckoutSupport.java`, `CartService.java`, `JpaCatalogReadRepository.java` (`toVariant`/`toVariantForListing`), `bigbike-admin/src/lib/schemas.js`, `PRODUCT_RULE_013`

**Admin input normalization (2026-08-18):** form state của các ô tiền trong `bigbike-admin` là chuỗi trong lúc soạn thảo; khi rời ô, giá được format theo locale. Khi tạo payload, `retailPrice`/`salePrice` luôn là số nguyên hoặc `null` theo presence semantics hiện hành. Riêng `salePrice = 0` do giao diện admin nhập được coi là để trống và gửi `null`; wire shape/backend storage vẫn giữ `sale_price` nullable `numeric(19,2)`, không thêm giới hạn giá mới.

### Address fields — district (quận/huyện) is legacy-only (2025 administrative reform)

From 01/07/2025 Vietnam abolished the district administrative tier nationwide (Nghị quyết
202/2025/QH15 — 63→34 tỉnh/thành; Nghị quyết 1654-1687/NQ-UBTVQH15 — 10.035→3.321 phường/xã;
mã theo Quyết định 19/2025/QĐ-TTg). The storefront (`bigbike-web`) and `VnAddressController`
now only collect/serve **2 levels: province → ward**. `district` is no longer collected by new
writes (web checkout and the account address book all stop sending it), but the
column/field is **kept, nullable, read-only** so historical customer addresses and orders placed
before the reform keep displaying their original quận/huyện. No backfill/migration was run —
existing rows are untouched.

`CustomerAddressResponse` currently contains:

- `id`
- `type`
- `fullName`
- `phone`
- `country`
- `province`
- `district` — legacy-only; `null` for addresses saved after this change
- `ward`
- `addressLine1`
- `addressLine2`
- `isDefault`

`SaveCustomerAddressRequest.district` is optional (`@Size` only, no `@NotBlank`) — kept for
backward compatibility with clients that still send it, but no longer required. `ward` is the
required sub-province field going forward.

The request's remaining existing validation is: `type` = `BILLING|SHIPPING`; required
`fullName`/`province`/`ward` ≤255 characters; required `addressLine1` ≤500 characters; required
`phone` matching `^\\+?[0-9]{8,15}$`; optional valid `email` ≤255 characters. The storefront
uses the same limits before submit. This records current server validation only; it does not alter
address data, historical rows, or the public contract.

`VN_PROVINCES` in `bigbike-web/lib/vn-address-data.ts` and `vn-address.json` (backend resource)
share the same source dataset: 34 provinces, ~3.265 unique ward names (fetched from
34tinhthanh.com and cross-checked against the official per-province ward counts from the
Nghị quyết 1654-1687/NQ-UBTVQH15 series; ~56 literal duplicate rows in the raw source were
deduped by name).

Status: `CONFIRMED_FROM_CODE`

Evidence:

- `CustomerAddressResponse.java`
- `SaveCustomerAddressRequest.java`
- `VnAddressService.java`, `VnAddressController.java`, `bigbike-backend/src/main/resources/vn-address.json`
- `bigbike-web/lib/vn-address-data.ts`, `bigbike-web/components/ui/VnAddressFields.tsx`

### POS order snapshot fields — REMOVED (owner decision 2026-06-23, online-only)

The POS flow was removed entirely; there is no longer any code that writes `channel`/`fulfillmentType = IN_STORE`, `source = 'pos'`, a `POS` payment provider, or an immediate `COMPLETED + PAID` POS order. Legacy POS orders were purged from the database.

The `orders.channel`, `orders.fulfillment_type`, and `orders.source` columns **still exist** — online orders use `fulfillmentType = DELIVERY` and `channel = WEB`. Only the `IN_STORE` / `'pos'` values are no longer written. `AdminOrderListItemResponse.source` is retained on the order list/detail responses but only ever carries online values now.

### Order cancellation reason

`orders.cancel_reason` (`TEXT` nullable, migration `V351`) stores the admin-entered reason when an order is moved to `CANCELLED`. It is required by backend validation for admin cancellation requests (`UpdateOrderStatusRequest.cancelReason`) but remains nullable for non-cancelled orders and legacy data.

`V351__add_orders_cancel_reason.sql` backfills best-effort from the latest `order_notes.note_type = 'ADMIN'` row for already-cancelled orders. From this change onward, the application no longer writes to `order_notes`; the table is intentionally not dropped in this PR and awaits a separate backup + user-confirmed drop migration.

Status: `CONFIRMED_FROM_CODE`

Evidence: `OrderEntity.cancelReason`, `AdminOrderService.updateOrderStatus`, `V351__add_orders_cancel_reason.sql`

**Phone normalization:** `customers.phone` is stored in normalized form (`PhoneNumbers.normalize`: retain digits, `+84`/`84` → `0`) consistently across **online registration, login, profile update, admin customer edit, and new WordPress customer imports**. This makes phone a reliable identity key (the same person typing `+84…` or `0…` resolves to one profile). Identity and uniqueness lookups normalize the stored value inside the database query, so pre-existing `+84…` and formatted rows still match. There is no bulk backfill of existing database rows; the importer normalizes only rows processed from this change onward.

Status: `CONFIRMED_FROM_CODE`

### Payment method compatibility — nullable for legacy rows, two manual methods for new orders

`orders.payment_method` and `payments.payment_method` are nullable at the schema/entity layer so
legacy orders created under the former manual-reconciliation model can still be loaded and shown.
Migration `V284__allow_null_payment_method.sql` removed the `NOT NULL` constraint from
`payments.payment_method`; `PaymentEntity` must mirror that nullability.

This storage compatibility does **not** make the current checkout contract optional: every new
storefront checkout order uses `COD` or `BANK_TRANSFER`; an omitted request value is normalized to
`COD`, and any other explicit method is rejected. `BANK_TRANSFER` is the new manual-transfer code
and must not reuse legacy `BACS`; `BACS`/`null` are read compatibility only. `CONFIRMED_FROM_CODE`

### Payment record status vocabulary

`payments.status` is required and is exposed only as read-only transaction metadata in
`OrderPaymentResponse.status`. It is not `OrderEntity.status` and does not control order
transitions.

| Value | Meaning |
|---|---|
| `PENDING` | Chưa có bằng chứng thanh toán thành công |
| `SUCCEEDED` | Bản ghi thanh toán thành công |
| `FAILED` | Bản ghi thanh toán thất bại |
| `CANCELLED` | Bản ghi đã huỷ; gồm dữ liệu hoàn tiền cũ sau khi refund bị gỡ |

Migration `V353__normalize_payment_record_status.sql` normalizes legacy
`UNPAID`/`PARTIALLY_PAID → PENDING`, `PAID → SUCCEEDED`, and
`REFUNDED`/`PARTIALLY_REFUNDED → CANCELLED`, preserves existing canonical values,
and stops on unknown values instead of guessing. It then adds
`ck_payments_status` for exactly the four values above. Checkout and WordPress
import code must write only the same vocabulary. The admin order detail may
display it but provides no payment-status mutation control. See `PAY_RULE_003`.

### Admin invite (email-based admin user onboarding)

Admin users are onboarded by **email invite**, not by an admin typing a password. Schema impact (`V201__admin_invite_tokens.sql`):

- `admin_users.password_hash` is now **nullable** — an `INVITED` user has no password until they accept. Login (`AdminAuthService.login`) rejects any account whose `password_hash` is null.
- New table `admin_invite_tokens`: `id` (uuid PK), `admin_user_id` (uuid, FK → `admin_users`, `ON DELETE CASCADE`), `token_hash` (varchar(64), unique — SHA-256 of the raw token, raw token never stored), `expires_at` (timestamptz, default 48h), `used_at` (timestamptz, null until accepted), `created_at` (timestamptz). One active (unused, unexpired) token per user; creating/resending an invite deletes the user's prior tokens first.

Flow: create admin (`admin-users.write`) → row inserted `status = INVITED`, no password, invite token + email sent → invitee opens `{ADMIN_BASE}/accept-invite?token=…` → `POST /api/v1/auth/admin/accept-invite` sets password, flips `status = ACTIVE`, consumes the token.

Account lockout (`V283__admin_login_lockout.sql`): two columns added to `admin_users`:
- `failed_login_attempts` (integer, `NOT NULL DEFAULT 0`) — running count of consecutive failed password attempts.
- `locked_until` (timestamptz, nullable) — when set and in the future, `AdminAuthService.login` refuses the attempt before checking the password.

Access/session invalidation (`V367__add_admin_access_version.sql`) adds `access_version`
(`bigint`, `NOT NULL DEFAULT 0`) to `admin_users`. The access JWT contains this exact value. The
value increases when a status becomes `DISABLED` or `SUSPENDED`, and when an administrator resets
the password; every bearer token issued with the old value is invalid. A role or permission edit does
not change this field because it keeps sessions and instead causes the server to re-resolve current
permissions. `OWNER_CONFIRMED_2026-07-31`.

After 5 consecutive failures the account is locked for 15 minutes (`AdminLoginAttemptService`, `REQUIRES_NEW` so the counter survives the rejected login). A successful login clears both columns. See `PERMISSION_MATRIX.md` → "Admin Login Security".

Status: `CONFIRMED_FROM_CODE`

### Admin role tables

`admin_roles` stores role definitions: `id` (varchar(50), primary key), `name`, optional
`description`, `is_system`, `created_at` and `updated_at`. `role_permissions` stores the permissions
granted to each role: `role_id` (foreign key to `admin_roles.id`, cascade on role deletion) and
`permission`; `(role_id, permission)` is the composite primary key.

`admin_users.role` stores the role id assigned to an admin user and is the relation used by the
admin role-management contract. `assignedUserCount` counts users linked through this column when
their status is `ACTIVE`, `INVITED`, `DISABLED` or `SUSPENDED`. The separate
`admin_user_roles` element-collection table is legacy/import compatibility and is not used for this
role count.

Evidence: `V2__create_admin_auth_tables.sql`, `V49__create_roles_permissions_tables.sql`,
`AdminUserEntity.java`, `AdminRoleEntity.java`.

### Return / Refund data — removed (2026-06-23)

> **Removed (2026-06-23).** The Return (RMA) and Refund data model — `returns` / `return_items` / `return_history` tables, the `refund_amount` / `refund_reason` / `refunded_at` columns on `orders` & `payments`, and the `REFUNDED` value on order status — was dropped. Old REFUNDED orders were migrated to CANCELLED.

## Inventory Model

> **Serial-number tracking was REMOVED platform-wide (2026-06-23, V259).** `product_serials`, `order_line_item_serials`, `return_item_serials`, `stock_movement_serials`, the `track_serials` columns, the serial→quantity sync trigger (`fn_sync_qty_from_serial_lifecycle`), and the `serial_inventory_only` / `reservation_ttl_minutes` settings are all dropped.
>
> **Inventory switched to a BOOLEAN availability model (2026-06-23, V261).** There is no tracked stock **quantity** anymore. Availability is a per-variant / per-product boolean that the admin toggles by hand.

- Availability is a **boolean**, not a quantity:
  - **Per variant** — `product_variants.is_available` (existing column) is the **sole gate**. The variant's `stock_state` mirrors it: `IN_STOCK` if available, else `OUT_OF_STOCK`.
  - **Per product without variants** — `products.stock_state` (`IN_STOCK` / `OUT_OF_STOCK`) is set **directly** by the admin toggle, persisted as `products.available` (renamed from `products.force_out_of_stock` in V342, 2026-07-19 — the old hard-override behavior for products WITH variants was removed at the same time).
  - **Product with variants** — `stock_state` = `IN_STOCK` if **any** variant `is_available`, else `OUT_OF_STOCK`.

### Product discontinued flag (V1023, owner decision 2026-08-13)

`products.discontinued BOOLEAN NOT NULL DEFAULT FALSE` is an orthogonal public
availability flag; it does not extend `PublishStatus` or `stockState`.

- Domain/API: `Product.discontinued` is present on public list/detail and admin
  responses; `UpsertProductRequest.discontinued` is an optional presence-guarded
  boolean on create/update.
- Public list, search, related/accessory projections, catalog facets, sitemap and
  Merchant feed exclude rows where `discontinued = true`. A direct public detail
  lookup may still read a `PUBLISHED` discontinued product for its historical
  `/sp/{slug}.html` page.
- The historical page is indexable (no `noindex`), uses schema.org
  `Discontinued`, and must not expose checkout/purchase controls.
- A discontinued product remains `PUBLISHED`; `DRAFT`/`TRASH` behavior is unchanged.

Owner display decision 2026-08-18: the `/sp/{slug}.html` page keeps the same URL and
locale-resolved data. For a matching `PUBLISHED + discontinued=true` product, the web
renders the complete existing detail payload (gallery, description, specifications, FAQs,
videos, reviews and other PDP sections) and replaces only the price/variant/purchase area
with the discontinued status panel. No mobile sticky purchase bar or alternate add-to-cart
path may render. For a legacy-only row, the page uses its history fields and does not invent
missing product data.

Migration: `V1023__redirect_and_discontinued_catalog_rules.sql`.

### Legacy discontinued product history (`legacy_discontinued_products`)

Một hàng lịch sử WordPress có thể không còn bản ghi trong `products`; không được tạo
`Product` giả chỉ để giữ URL cũ. Bảng này là catalog vận hành riêng cho những URL đó.
Nó dùng cùng trải nghiệm trang lịch sử với `products.discontinued = true`, nhưng không
có giá, SKU, tồn kho, trạng thái bán hay dữ liệu checkout.

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | Primary key. |
| `slug` | `VARCHAR(255)` | Legacy product slug, unique; web chỉ phục vụ qua `/sp/{slug}.html`. |
| `name` / `name_en` | `VARCHAR(255)` | Tên hiển thị VI và EN; `name_en` rỗng được phép fallback VI. |
| `brand_name` | `VARCHAR(255)` nullable | Nhãn lịch sử, không tạo hay yêu cầu brand còn public. |
| `category_slug` | `VARCHAR(255)` | Danh mục public còn hiệu lực, dùng để chọn 4–8 hàng đang bán phù hợp; web có thể dùng nhóm cha hoặc thứ tự bán chạy khi nhóm không còn hàng. |
| `image_url` | `VARCHAR(2048)` nullable | Chỉ URL ảnh nguồn đã kiểm chứng; rỗng thì web dùng empty state, không gán ảnh sản phẩm khác. |
| `enabled` | `BOOLEAN NOT NULL DEFAULT TRUE` | Tắt là URL không còn được nhận là trang lịch sử (để redirect/410 xử lý nếu có rule). |
| `created_at` / `updated_at` | `TIMESTAMP` | Audit vận hành. |

Admin chỉ cần `products.read` để xem và `products.update` để tạo/sửa/bật/tắt, giữ cùng
phạm vi catalog thay vì sinh quyền mới. Public list/search/facet/sitemap không đọc bảng
này; nó chỉ được lookup chính xác từ route `/sp/{slug}.html`.

Migration: `V1034__create_legacy_discontinued_products.sql`. Owner decision 2026-08-15;
see `BUSINESS_RULES.md` `REDIRECT_RULE_013`.
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
- `AdminInventoryController.java` (read-only list/summary; availability PATCH endpoints removed 2026-07-15, AUD-056)
- `CheckoutService.java` (per-variant `isAvailable` gate)
- `V120__drop_stock_receipt_tables.sql`
- `V259__remove_serial_management.sql`
- `V261__inventory_availability_toggle.sql` (backfilled `is_available` + `stock_state` from current quantities)

### Catalog size scale model (V1028/V1029/V1031, owner decision 2026-08-14)

Size classification is separate from the existing variant attribute dictionary.
The `products.size_scale_id` foreign key points to one row in
`catalog_size_scales` for every product that has a size option. The scale points
to a configured display group and carries a system-managed filter namespace; its
`catalog_size_values` carry the canonical key, the user-entered display label
used for both languages, and explicit order. `catalog_size_groups` contains the
four current public groups: clothing letters, shoes, waist-inch pants and EU
pants.
The old subgroup columns remain only as storage compatibility columns and are
empty after V1031.

The scale catalog is the source of truth for public grouping, ordering and
namespace matching. Existing `product_variant_options.option_name`,
`option_value`, `attribute_id` and `attribute_value_id` remain intact for
variant names, PDP selection, cart and inventory. The data cleanup only
canonicalizes size option text and repoints duplicate size dictionary values;
variant IDs, SKUs, availability and option ownership are not changed.

Admin product read/upsert carries `sizeScaleId`. A product with a size option
cannot be saved without a valid scale, and every size option must resolve to a
value in that scale. Products without a size option may leave the field null.
The scale manager write shape is `{ name, groupId, values: string[] }`; code,
namespace, sort order, English label and subgroup fields are generated or
cleared by the server. A new scale gets a generated code and appended order;
an existing scale keeps its internal code and product references when renamed.
New scales and values are data additions, not code-level numeric or category
classification rules.

V1029 verifies that every published size option resolves inside its assigned
scale and aborts the migration otherwise — a scale missing a value that live
products already use blocks startup, so seed the value in the same migration.
V1031 moves the two numeric-pants scales into separate groups and clears all
subgroup assignments without changing scale IDs, value IDs, product links,
variant IDs, SKUs, availability or option ownership.

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

**API input contract:** `stockState` bị bỏ khỏi `UpsertProductRequest` và `VariantRequest` vì là field suy ra. Catalog create/update nhận các nguồn boolean thật từ form sản phẩm: `UpsertProductRequest.available` (chỉ áp dụng SP không biến thể) và `VariantRequest.isAvailable`, rồi `InventoryPolicyService.recomputeProductState` cập nhật `stockState`; đường này dùng quyền `products.update`. Hai endpoint Inventory `PATCH .../availability` (đường phụ dùng `inventory.write`) đã gỡ 2026-07-15 (AUD-056) — product upsert là đường mutation availability duy nhất; `inventory.write` bị xóa khỏi catalog và role grants tại `V364`.

**API response contract:** `stockState` vẫn có trong response (read-only). `stockQuantity` / `quantityOnHand` không còn nằm trong response product/variant; các cột số lượng dormant chỉ phục vụ tương thích dữ liệu cũ và migration, không được đưa trở lại contract. Storefront chỉ hiển thị "Còn hàng / Hết hàng".

**`forceOutOfStock` — REMOVED (2026-07-19, V342):** field này từng là manual hard override, chặn mua ngay cả khi `stockState = IN_STOCK`/biến thể còn hàng. Owner quyết định gỡ hẳn: SP có biến thể giờ chỉ còn per-variant `isAvailable` quyết định mua được hay không (không còn override); SP không biến thể đổi tên field lưu trữ thành `available` (thuận dấu) nhưng hành vi/UI với loại SP này không đổi.

Evidence:

- `AdminInventoryService.java` / `AdminInventoryController.java` (chỉ còn đọc list/summary — đường availability phụ đã gỡ 2026-07-15, AUD-056)
- `ProductMutationService.java`, `UpsertProductRequest.available`, `VariantRequest.isAvailable`, `InventoryPolicyService.java` (đường form sản phẩm)
- `CheckoutService.java` (per-variant `isAvailable` gate)
- `BUSINESS_RULES.md` STOCK_RULE_001–009
- `V165__aggregate_variant_product_stock_state.sql` (trigger giữ `products.stockState` đồng bộ với variants)
- `V261__inventory_availability_toggle.sql` (boolean availability; backfill `is_available` + `stock_state` từ số lượng hiện tại — 2026-06-23)

### Product rich-text content field

`description` / `description_en` are the flat rendered HTML fields for the
"Mô tả sản phẩm" section on the PDP. They are optional `TEXT` values and may be
authored through `descriptionBlocks`, whose renderer keeps the flat fields in
sync.

`contentBottom` / `content_bottom(_en)` were removed by
`V151__drop_product_content_bottom.sql`: the storefront never rendered them and
all rows were verified `NULL`. They are not part of Product domain, mutation,
response, admin normalizer or validation contracts. The similarly named
homepage setting and Category's historical `content_bottom` rename are separate
features.

**Đã xóa (2026-07-07):** `promotionContent`/`promotion_content(_en)` (added `V124`, deprecated on web/admin since 2026-06-18) và `installationGuide`/`installation_guide(_en)` (added `V133`, format đổi ở `V242`) — cả cột DB lẫn `Product`/`UpsertProductRequest` field đã bị drop hẳn (`V325__drop_dead_product_fields.sql`), không còn ngủ yên. Cả hai chưa từng được `bigbike-web` render cho khách (xác nhận qua audit — không có renderer nào tham chiếu tới chúng) và không có ô nhập trên admin. Xem `BUSINESS_RULES.md` `PRODUCT_RULE_006`.

Status: `CONFIRMED_FROM_CODE`

### Product PDP content — `suitability_advisory` (V237)

Bilingual dual-column field cho khối "Phù hợp với ai" trên PDP. Follows the
`shortDescription`/`sizeGuide` dual-text pattern: canonical (vi) column + `_en`
column, `pick(vi, en, locale)` on read, raw English surfaced in `translations.en`
for the admin editor.

| Field | DB columns (added) | Type | PDP surface |
|---|---|---|---|
| `suitabilityAdvisory` | `suitability_advisory` + `suitability_advisory_en` (`V237`; format đổi ở `V240__convert_suitability_advisory_to_cards.sql`) | `TEXT`, max 20 000 | "Phù hợp với ai" — **JSON array các thẻ tư vấn** `[{ audience, advice, linkLabel?, linkUrl? }]` (trước V240 là rich-HTML). Web parse JSON → mỗi item một thẻ (đối tượng in đậm + lời khuyên + link nội bộ tùy chọn); `linkUrl` dùng chung cả vi/en, mảng `_en` mirror theo index. Hidden when empty. |

It is detail-only (null in list responses), nullable, presence-flag on PATCH,
empty/blank normalized to `NULL`.

> **Correction (2026-07-05):** this section previously stated the PDP "Hoàn thiện
> bộ bảo hộ" block reuses `relatedProducts`. Verified against `ProductView.tsx`
> (`i18n key crossSellTitle` → `"Hoàn thiện bộ bảo hộ"` / `"Complete your gear"`)
> and `messages/vi.json:136`: **`crossSellTitle` renders the `accessoryProducts`
> field**, not `relatedProducts`. `relatedProducts` instead renders as
> `relatedTitle` ("Sản phẩm tương tự" / "Related products") — see
> "Product related products — `relatedProducts` / `relatedProductIds`" and
> "Product accessories — `accessoryProducts` / `accessoryProductIds` (V239)" in
> `API_CONTRACT.md`.

Status: `CONFIRMED_FROM_CODE`

### Product PDP content — `quick_answer_summary` (V300)

Bilingual dual-column field cho khối "Quick Answer" trên PDP — đoạn tóm tắt AIO
40–60 từ, render blockquote ngay sau Specs Dashboard, trước "Tính năng chi tiết"
(canonical layout block #3, xem `PDP_CONTENT_GUIDE.md` §0b). Follows the
`shortDescription`/`suitability_advisory` dual-text pattern: cột canonical (vi) +
`_en`, `pick(vi, en, locale)` on read, raw English surfaced in `translations.en`
for the admin editor.

| Field | DB columns (added) | Type | PDP surface |
|---|---|---|---|
| `quickAnswerSummary` | `quick_answer_summary` + `quick_answer_summary_en` (`V300`) | `TEXT`, max 600 | "Quick Answer" — đoạn văn bản thường (không định dạng), câu đầu nói thẳng sản phẩm là gì + cho ai + nổi bật điều gì. Hidden when empty — không có công tắc bật/tắt riêng (cơ chế `section_visibility` đã gỡ 2026-06-22). |

It is detail-only (null in list responses), nullable, presence-flag on PATCH,
empty/blank normalized to `NULL`.

> **Lịch sử:** field độc lập này từng tồn tại ở V236, bị drop hoàn toàn ở
> `V253__drop_product_quick_answer_summary.sql` (2026-06-20), và được thêm lại ở
> `V300__add_product_quick_answer_summary.sql` (2026-07-02) theo yêu cầu chủ shop —
> hành vi tương tự bản cũ nhưng KHÔNG khôi phục cơ chế `section_visibility` (đã gỡ
> sau đó, mọi khối PDP giờ tự hiện theo nội dung).

Status: `CONFIRMED_FROM_CODE`

### Product specs HTML — field `specifications` (V255, mô hình "HTML là nguồn" — cập nhật)

`specifications_html` là **nguồn render DUY NHẤT** của tab "Thông số kỹ thuật" trên web. Theo
đúng `shortDescription`/`suitability_advisory` dual-text pattern: cột canonical (vi) + `_en`,
`pick(vi, en, locale)` on read, raw English surfaced in `translations.en` cho admin editor.

| Field | DB columns (added) | Type | PDP surface |
|---|---|---|---|
| `specifications` | `specifications_html` + `specifications_html_en` (`V255`) | `TEXT`, max 50 000 | Web **luôn** render HTML này (qua `sanitizeRichHtml`, **cho phép `<table>` và CSS inline `style`**). HTML là **nguồn DUY NHẤT**; không còn bảng/lưới cấu trúc dự phòng. |

It is detail-only (null in list responses), nullable, presence-flag on PATCH,
empty/blank normalized to `NULL`. **Admin UX (không đổi contract):** ô "Thông số kỹ thuật" có 2 tab —
nhập "có cấu trúc" (dòng tên/giá trị) HOẶC "dán HTML"; **cả 2 cùng ghi vào field `specifications` này**.
Tab cấu trúc chỉ là công cụ nhập tạm: khi mở tab thì parse HTML hiện có lấy chữ (bỏ CSS), khi lưu thì
GHÉP nội dung đã sửa ngược vào HTML hiện có (giữ nguyên `style`/markup, helper `lib/specSheet.js`).
**Lưu ý phân biệt tên:** đây KHÔNG phải field cấu trúc `specifications` (mảng dòng tên/giá trị) của
bảng `product_specifications` cũ — bảng đó đã backfill sang HTML rồi bị DROP ở V329/V330; admin/backend
từ đó không còn nhận, lưu, trả về mảng cấu trúc dưới bất kỳ tên nào. HTML rỗng thì web không render
tab thông số kỹ thuật. HTML thô được sanitize ở web (`sanitizeRichHtml` với `allowInlineStyles`),
không parse/sanitize ở backend (opaque như `suitability_advisory`).

Status: `CONFIRMED_FROM_CODE` — `ProductEntity.specifications`/`specificationsEn`,
`Product.specifications`, `ProductTranslations.ProductContent.specifications`,
`UpsertProductRequest` (+ presence flag) / `ProductTranslationRequest` (HTML only),
`AdminCatalogMutationService.applyProductPatch` / `ProductFieldApplier.applyTranslations`,
`JpaCatalogReadRepository` (detail mapper `pick`s it; list mapper passes `null`),
migration `V255__add_product_specifications_html.sql`, `V329__BackfillProductHtmlOnlySections.java`,
`V330__drop_product_html_only_structured_tables.sql`.

### Product spec-stats HTML — field `specStats` (V256, mô hình "HTML là nguồn")

`spec_stats_html` là **nguồn render** của khối "Ô số liệu nổi bật" (specStats) dưới khu mua hàng trên
web. Mô hình giống `specifications_html` (V255): cột canonical (vi) + `_en`, `pick(vi, en, locale)`
on read, raw English trong `translations.en`, detail-only, presence-flag on PATCH, blank→`NULL`.

| Field | DB columns (added) | Type | PDP surface |
|---|---|---|---|
| `specStats` | `spec_stats_html` + `spec_stats_html_en` (`V256`) | `TEXT`, max 50 000 | Web **luôn** render HTML này khi non-blank (qua `sanitizeRichHtml` với `allowInlineStyles`). HTML là **nguồn DUY NHẤT**; không còn lưới cấu trúc dự phòng. |

**Admin UX (không đổi contract):** khối có 2 tab — nhập "có cấu trúc" (mỗi ô 2 dòng: **value**
số liệu chính + **label** tên chỉ tiêu, tối đa 4 ô) HOẶC "dán HTML"; cả 2 cùng ghi vào field
`specStats` này. Tab cấu trúc là công cụ nhập tạm: parse từ HTML khi mở tab, sửa xong GHÉP vào HTML hiện có (giữ style/markup,
chỉ đổi chữ — helper `lib/specStatsBlock.js`, lưới sinh ra có class `bb-specstats` + inline-style
tự chứa mô phỏng `FeaturedSpecsBar`). Mỗi ô mã hoá cố định **2 span**: `[value, label]`; `value`
luôn span đầu, `label` luôn span cuối → parse không nhập nhằng. **Lưu ý phân biệt tên:** đây KHÔNG
phải field cấu trúc `specStats` (lưới ô value/label) của bảng `product_spec_stats` cũ — bảng đó đã
backfill sang HTML rồi bị DROP ở V329/V330; admin/backend từ đó không còn nhận, lưu, trả về lưới
cấu trúc dưới bất kỳ tên nào. HTML rỗng thì web không render khối số liệu.

**Đã bỏ (owner decision 2026-07-06):** dòng thứ 3 tuỳ chọn **unit** (đơn vị/chú thích, vd "gram")
từng cho phép mã hoá ô thành 3 span `[value, unit, label]`. Admin không còn ô nhập này; parser vẫn
đọc an toàn dữ liệu cũ (bỏ qua mọi span ở giữa, chỉ lấy span đầu/cuối). Migration
`V322__strip_spec_stats_html_unit_span.sql` dọn span đơn vị còn sót trong dữ liệu cũ của
`spec_stats_html`/`spec_stats_html_en` (không đổi schema — `unit` chưa bao giờ là cột riêng).
Status:
`CONFIRMED_FROM_CODE` — `ProductEntity.specStats`/`specStatsEn`, `Product.specStats`,
`UpsertProductRequest`(+presence)/`ProductTranslationRequest`, `AdminCatalogMutationService` /
`ProductFieldApplier`, `JpaCatalogReadRepository`/`JpaCatalogReadSupport`, migration
`V256__add_product_spec_stats_html.sql`, `V329__BackfillProductHtmlOnlySections.java`,
`V330__drop_product_html_only_structured_tables.sql`.

### Product trust-badges HTML — field `trustBadges` (V257, mô hình "HTML là nguồn")

`trust_badges_html` là **nguồn render** của khối "Dải tin cậy" (trustBadges) trên tên sản phẩm ở web.
Mô hình giống `spec_stats_html` (V256): cột vi + `_en`, `pick` per-locale, raw EN trong
`translations.en`, detail-only, presence-flag, blank→`NULL`.

| Field | DB columns (added) | Type | PDP surface |
|---|---|---|---|
| `trustBadges` | `trust_badges_html` + `trust_badges_html_en` (`V257`) | `TEXT`, max 50 000 | Web **luôn** render HTML này khi non-blank (qua `sanitizeRichHtml` với `allowInlineStyles`). HTML là **nguồn DUY NHẤT**; không còn dải cấu trúc dự phòng. |

**Admin UX:** 2 tab (cấu trúc: danh sách nhãn ngắn / dán HTML), cùng ghi vào field `trustBadges`
này; tab cấu trúc parse tạm từ HTML và GHÉP ngược vào HTML giữ style + chấm tròn, chỉ đổi chữ (helper
`lib/trustBadgesBlock.js`, class `bb-trust-badges`). **Lưu ý phân biệt tên:** đây KHÔNG phải field
cấu trúc `trustBadges` (danh sách nhãn) của bảng `product_trust_badges` cũ — bảng đó đã backfill sang
HTML rồi bị DROP ở V329/V330; admin/backend từ đó không còn nhận, lưu, trả về danh sách cấu trúc dưới
bất kỳ tên nào. HTML rỗng thì web không render dải tin cậy. Status: `CONFIRMED_FROM_CODE` —
migration `V257__add_product_trust_badges_html.sql` (+ thread `ProductEntity`/`Product`/
`ProductTranslations`/`UpsertProductRequest`/`ProductTranslationRequest`/mutation+read như V256),
`V329__BackfillProductHtmlOnlySections.java`, `V330__drop_product_html_only_structured_tables.sql`.

### Product description blocks — `description_blocks` (V139, gộp song ngữ ở V326)

Admin-curated structured content stored as JSONB in `products.description_blocks` (nullable). The column holds a JSON array of block objects — the **structured** source of truth for the "Mô tả sản phẩm" section. The mutation service renders blocks to HTML and writes the result into the existing `description`/`description_en` (TEXT) columns simultaneously, so public consumers see no change.

**V326 — gộp song ngữ vào 1 mảng:** Trước đây tiếng Việt (`description_blocks`) và tiếng Anh (`description_blocks_en`, V229) là **2 cột JSONB tách biệt**, chỉ khớp nhau theo vị trí (không có ràng buộc gì ở schema). Từ V326, **chỉ còn 1 mảng** (`description_blocks`) — mỗi khối mang cả 2 ngôn ngữ ngay trong chính nó qua field `*En` song song (`text`/`textEn`, `html`/`htmlEn`, `items`/`itemsEn`...), đúng ràng buộc đã dùng cho `faqs`/`commitments`/`highlights`: **tiếng Việt quyết định số khối/thứ tự khối**, tiếng Anh chỉ dịch nội dung khối đã có (không tự thêm/bớt/sắp xếp khối riêng). Cột `description_blocks_en` đã **DROP** bởi `V326__MergeProductDescriptionBlocksBilingual.java` (Java-based migration, cùng kiểu với `V238`) sau khi gộp dữ liệu 225 sản phẩm hiện có (matching theo `type` + vị trí; khối VI không có khối EN tương ứng thì giữ nguyên VI, field `*En` để trống — không đoán mò, ném lỗi nếu gặp hình dạng dữ liệu lạ).

**Owner decision 2026-07-20 — thu hẹp còn đúng 2 lựa chọn:** Current product import/export and the Admin product description editor support only `feature` with `side="right"` (ảnh phải + chữ trái) and `feature` with `side="left"` (ảnh trái + chữ phải). `paragraph`/`image` — 2 trong 4 khối menu trước đó (owner decision 2026-07-15) — **không còn tạo mới được cho sản phẩm** qua menu Admin hay Import file. Migration một lần `V343__MigrateLegacyDescriptionBlocksToFeature.java` đã chuyển toàn bộ khối `paragraph`/`image` cũ trong `description_blocks` của mọi sản phẩm thành khối `feature` tương đương (chữ-thuần hoặc ảnh-thuần) tại thời điểm đổi quyết định, nên không sản phẩm nào còn 2 loại khối này trong DB sau migration. `paragraph`/`image` vẫn là subtype hợp lệ về mặt kỹ thuật của sealed interface `DescriptionBlock` (dùng chung với Content) — một PATCH thường gửi thẳng các type này vẫn được `AdminCatalogMutationService` chấp nhận, chỉ **Import file** (`ProductImportService.checkImportDescriptionBlocks`) và **menu Admin** (`PRODUCT_MENU`) chặn tạo mới. In the import template, `feature.side` must be `left` or `right`; `auto` is legacy/internal and not accepted for product JSON import.

**Owner request 2026-07-21 — gợi ý so le tự động (UX-only, không đổi giá trị lưu):** Admin `BlockEditor`/`BlockControls` tự tính phía ngược khối liền trước (`nextProductFeatureSide` trong `block-editor/constants.js`) khi bấm "+ Thêm khối" (cuối danh sách) hoặc "+" chèn khối bên dưới một khối cụ thể, rồi tạo khối đó luôn với `side='left'`/`'right'` tường minh — không còn dropdown 2 lựa chọn cho thao tác thêm/chèn ở `productMode`. Khối đầu tiên (không có khối liền trước) mặc định `side='right'`. Đây thuần là gợi ý UI khi TẠO khối mới; không thêm giá trị `auto` vào dữ liệu lưu, không đổi import/export, không đảo quyết định 2026-07-20 ở trên. Người dùng vẫn có thể đổi `side` thủ công sau khi khối đã tạo qua dropdown "Vị trí ảnh" của khối đó (2 lựa chọn trái/phải, xem `FeatureBlockEditor`).

The Java `DescriptionBlock` hierarchy still deserializes older product rows and article/content body blocks (`heading`, `list`, `video`, `callout`, `divider`, dormant `prosCons`, và giờ cả `paragraph`/`image` cho mục đích lịch sử/Content) so historical data can be read safely. Those legacy/content-only types are **not** valid choices for product JSON import/export or the current Admin product description menu. **`suitability`/`sizeGuide` đã tách khỏi sealed interface này ở V327/V328** — xem mục "Product PDP sections — `suitability_section` / `size_guide_section`" ngay dưới bảng.

| `type` | Required fields (VI) | Optional fields (VI) | Field `*En` song song (V326, luôn optional) |
|---|---|---|---|
| `paragraph` | `html` (≤ 50 000 chars; inline `<b><i><a><br>` only) | — | `htmlEn` (≤ 50 000) |
| `image` | `url` (≤ 2 000 chars) | `alt` (≤ 500), `caption` (≤ 500) | `altEn` (≤ 500), `captionEn` (≤ 500) — `url` dùng chung, không dịch |
| `feature` | `side` (`left` hoặc `right` trong file import) | `url` (≤ 2 000 chars), `alt` (≤ 500), `caption` (≤ 500), `subheading` (≤ 500), `heading` (≤ 500), `html` (≤ 50 000) | `altEn`, `captionEn`, `subheadingEn`, `headingEn` (mỗi ≤ 500), `htmlEn` (≤ 50 000) — `url`/`side` dùng chung |

**Ưu/Nhược điểm (`prosCons`) ĐÃ TÁCH RA khỏi mô tả (V251)** — quay lại là khối RIÊNG cố định ngay dưới mô tả, ngoài tab; nguồn dữ liệu hiện là `products.highlights` JSONB (xem §Ưu điểm/Nhược điểm), KHÔNG còn là khối trong `description_blocks`. Subtype `ProsConsBlock` vẫn còn trong sealed interface (dormant, để deserialize an toàn dữ liệu cũ, KHÔNG có field `*En` vì đã ngừng dùng từ V254); migration `V251` gỡ mọi khối `prosCons` còn sót trong `description_blocks`.

### Product PDP sections — `suitability_section` / `size_guide_section` (V327/V328)

> **V327/V328 — Suitability/sizeGuide TÁCH RA khỏi `description_blocks` (đảo quyết định V246/V251).** Chủ shop yêu cầu trình dựng mô tả (BlockEditor) chỉ còn đúng 4 loại khối menu (`paragraph`/`image`/`feature`×2 side) — `suitability`/`sizeGuide` không còn hợp lệ như phần tử trong `descriptionBlocks` (Jackson 400 nếu request còn gửi `type` này, do 2 subtype đã bị xoá khỏi `@JsonSubTypes`/`permits` của `DescriptionBlock`). Thay vào đó là **2 cột JSONB độc lập** trên `products`, mỗi cột giữ nguyên shape cũ (`title`/`titleEn`/`html`/`htmlEn` [+ `cards` cho suitability]) nhưng là **1 object đơn**, không phải phần tử mảng. Migration `V327` (SQL, thêm cột) + `V328` (Java, trích JSON thô — không phụ thuộc `DescriptionBlock` class — ra khỏi `description_blocks`, audit thật trước khi viết: 225 sản phẩm, đúng 4 khối `suitability` + 3 khối `sizeGuide`, không sản phẩm nào có ≥2 khối cùng loại).

| Field | DB column | Type | Domain class |
|---|---|---|---|
| "Phù hợp với ai" | `suitability_section` | `jsonb`, nullable | `SuitabilitySection` (`title`/`titleEn` ≤500, `html`/`htmlEn` ≤20 000; **không còn `cards`**) |
| "Bảng size" | `size_guide_section` | `jsonb`, nullable | `SizeGuideSection` (`title`/`titleEn` ≤500, `html`/`htmlEn` ≤20 000) |

**Mô hình render giữ nguyên như `sizeGuideSection`:** `html`/`htmlEn` là **nguồn render DUY NHẤT** trên web.
Admin có 2 tab nhập — "có cấu trúc" hoặc "dán HTML" — nhưng tab cấu trúc chỉ là công cụ parse tạm từ HTML
và GHÉP ngược vào `html`/`htmlEn` tương ứng tab ngôn ngữ đang xem, dùng helper `lib/suitabilityCards.js`.
Không còn `cards` trong contract/domain/storage. HTML rỗng thì web không render section. HTML sanitize giống
hệt cơ chế cũ (`sanitizeRichHtml` cho phép `style` inline ở web, `sanitizeHtml` ở admin preview).

**Presence-flag riêng cho từng field** (`suitabilitySectionPresent`/`sizeGuideSectionPresent`) — độc lập với `descriptionBlocksPresent`, gửi object thay thế TOÀN BỘ (không merge từng field con), `null` xoá field. Không còn render vào cột phẳng `description`/`description_en` (khác với trước — `DescriptionBlockRenderer` đã bỏ `renderSuitability`/`renderSizeGuide`; cột phẳng đó chỉ còn là fallback cho sản phẩm cũ chưa có khối cấu trúc nào, và fallback đó giờ không bao gồm nội dung 2 field này — chấp nhận được vì section PDP đọc thẳng field mới, không phụ thuộc fallback).

**Read:** locale-resolved qua `SuitabilitySection.resolveForLocale`/`SizeGuideSection.resolveForLocale` (cùng `pick()` convention) trên public reads; admin reads nhận raw object (2 ngôn ngữ inline). `MEDIA_RULE_003` (ảnh nhúng trong `html`/`htmlEn`) áp dụng y hệt như khi còn là khối — xem `AdminMutationValidators.suitabilitySectionMediaUrls`/`sizeGuideSectionMediaUrls`.

Status: `CONFIRMED_FROM_CODE` — `SuitabilitySection.java`/`SizeGuideSection.java` (domain), `SuitabilitySectionConverter`/`SizeGuideSectionConverter` (JPA), `ProductEntity.suitabilitySection`/`sizeGuideSection`, `UpsertProductRequest.suitabilitySection`/`sizeGuideSection` + presence flags, `AdminCatalogMutationService.applyProductPatch`, `JpaCatalogReadRepository`/`JpaCatalogReadSupport` (`resolveSuitabilitySectionForPublic`/`resolveSizeGuideSectionForPublic`, `hasSuitabilitySectionTranslation`/`hasSizeGuideSectionTranslation` cho cờ "có bản dịch EN"), `V327__add_product_suitability_size_guide_sections.sql`, `V328__ExtractProductSuitabilitySizeGuideFromBlocks.java`, `V329__BackfillProductHtmlOnlySections.java`.

### Product admin HTML input safety and structured import (owner decision 2026-08-17)

Seven product-detail blocks expose a structured input tab and an HTML input tab: trust badges,
highlight stat boxes, suitability, size guide, specifications, highlights, and FAQs. The tab is
an admin editing choice; it does not add a second persisted source. The existing persisted sources
remain unchanged: HTML fields for trust/spec-stats/specifications/size guide/suitability, and JSONB
arrays for highlights/FAQs.

HTML typed or pasted into the admin editor is held as a local draft. It must not update the form's
canonical value until the manager explicitly chooses to receive the parsed content and confirms the
operation. The parser accepts ordinary headings, paragraphs, lists and tables in addition to the
BigBike-generated marker classes. The UI reports the number of recognized items and skipped parts.
Zero recognized items is a non-destructive result: the persisted value remains unchanged and the
editor shows that the old content was kept. A custom raw-HTML action is available only for fields
whose persisted source is HTML; array-backed highlights/FAQs continue to persist recognized item
content only, with no new raw-HTML field.

The Vietnamese model remains canonical for item count and order. English import updates only existing
matching positions and never creates, removes or reorders Vietnamese items (`PRODUCT_RULE_001/002`).
Structured edits merge text into existing HTML while preserving the current presentation markup where
possible. Specifications read the first two cells as name/value and leave additional table cells
untouched; the admin form warns that those extra cells are not editable there. Size-guide and
specification serializers/prompts use the website's canonical token-based presentation so generated
HTML and AI output round-trip into the structured tab consistently. No API, database column, JSONB
shape or storefront renderer changes are part of this behavior.

**Canonical product-template presentation (owner decision 2026-08-17):** the four descriptions of a
product-content template are one contract: the admin structured serializer, the admin AI brief, the
`product-template/HUONG-DAN.md` guide, and `product-template/mau-day-du.json`. `specifications` uses
only the `shop_attributes` class and lets the website's scoped CSS apply web font/color tokens; it
must not put fixed colors, fonts, or sizes on the table cells. A specification value may contain safe
inline `<strong>`/`<em>` markup. Parsing must return that inline markup and structured merging must
retain it, including when another cell is edited. `sizeGuideSection` uses the exact tokenized
table/header/cell/note styles emitted by `lib/sizeChart.js`, with `<thead>` and `<tbody>`. The
generated `suitabilitySection` wrapper and audience `<strong>` use the exact tokenized styles in the
admin AI brief; audience content may contain safe bold/italic inline markup and merging must retain
the audience element's presentation attributes. `specStats`, `trustBadges`, highlights, and FAQs
continue to use their existing canonical templates. The sample's illustration URLs are checked
`/media/uploads/...` paths from the current media store; this cleanup does not mutate stored product
records. Automated template tests must verify the sample parses into the structured size/spec/
suitability models and that structured edits preserve text and inline formatting.

Status: `CONFIRMED_FROM_OWNER_DECISION` — `BUSINESS_RULES.md` `PRODUCT_RULE_019`/`PRODUCT_RULE_020`, admin block
editors and helpers under `bigbike-admin/src/screens/product-detail/`, `bigbike-admin/src/components/
block-editor/`, and `bigbike-admin/src/lib/`.

### Category intro HTML source and structured editor (owner decision 2026-08-18)

`categories.intro_content` / `intro_content_en` are opaque rendered HTML fields and remain the only
persisted source for the category intro. The admin structured tab parses recognized eyebrow, heading,
intro, brand, FAQ and contact nodes as an editing convenience; it does not replace or normalize the
whole field. A structured edit patches only the selected recognized node and preserves unknown
standalone tables, images, columns, wrappers and their original order. Missing or extra recognized
sections are valid states. FAQ question/answer pairing is positional by appearance, including legacy
markup where all questions sit in one outer block.

The category and product AI brief buttons are clipboard-only. They attach a fresh read-time profile to
the existing localized prompt template. The profile is not persisted, does not change any API or
database shape, and marks unavailable facts explicitly rather than guessing.

**`feature` — hàng ảnh + chữ 2 cột (thêm sau V139, code-only):** Gói chung 1 ảnh + tiêu đề phụ (`subheading`, eyebrow) + tiêu đề chính (`heading`) + đoạn mô tả (`html`) + danh sách vào MỘT khối, render thành khối 2 cột ảnh–chữ trên web (chỉ desktop; mobile xếp dọc). `side`=`auto`/null → các khối `feature` liên tiếp tự xen kẽ trái/phải (so le); `left`/`right` ép vị trí ảnh. **Không field nào bắt buộc riêng lẻ** — admin có thể lưu khối chỉ có ảnh, chỉ có chữ, hoặc cả hai; khối chỉ bị coi là rỗng và bị lọc bỏ trước khi gửi khi CẢ ảnh lẫn mọi phần chữ (VI **và** EN) đều trống (`cleanDescriptionBlocks` ở admin). Web tự chọn layout theo dữ liệu thực có (`featureHasImage`/`featureHasText` ở `description-blocks/grouping.ts`): đủ ảnh+chữ → 2 cột; chỉ chữ hoặc chỉ ảnh → full width, không chừa nửa cột trống. **Khối này thay thế cơ chế "ghép ngầm" cũ** (web từng tự gom một khối `image`/`video` + cụm `text` liền sau thành hàng 2 cột) — cơ chế ghép ngầm đã được GỠ BỎ; muốn 2 cột phải dùng khối `feature`.

**Vốn từ khối GIỚI HẠN ở phạm vi SẢN PHẨM (V238 + V251 + V327/V328 + owner decision 2026-07-15, thu hẹp tiếp 2026-07-20):** Trình soạn mô tả sản phẩm chỉ cho tạo đúng **2 khối menu**: `feature` preset ảnh phải + chữ trái (`side="right"`), và `feature` preset ảnh trái + chữ phải (`side="left"`). **`paragraph`/`image` đã gỡ khỏi menu sản phẩm (owner decision 2026-07-20)** — 2 loại này vẫn còn trong menu bài viết (`CONTENT_MENU`), chỉ không còn tạo mới được cho sản phẩm; migration một lần `V343__MigrateLegacyDescriptionBlocksToFeature.java` đã chuyển hết khối `paragraph`/`image` cũ của mọi sản phẩm sang khối `feature` tương đương (chữ-thuần hoặc ảnh-thuần) tại thời điểm đổi quyết định. Video sản phẩm là mục riêng (`videos[]`) trong form Admin, không phải khối mô tả chi tiết của sản phẩm. **`prosCons` đã gỡ khỏi vốn từ khối (V251)** — Ưu/Nhược điểm nhập ở card riêng. **`suitability`/`sizeGuide` đã tách khỏi `descriptionBlocks` (V327/V328)** thành `suitabilitySection`/`sizeGuideSection`; request còn gửi hai type này trong mảng sẽ nhận 400. Các loại `heading`/`list`/`video`/`callout`/`divider` không được tạo mới cho sản phẩm. Migration `V238__ConsolidateProductDescriptionBlocks.java` vẫn là lịch sử gộp dữ liệu cũ về vốn từ tại thời điểm migration; subtype cũ có thể còn để đọc dữ liệu lịch sử nhưng không xuất ra template nhập sản phẩm.

**Presence semantics (PATCH):** Sending `descriptionBlocks` (including `[]`) triggers rendering and overwrites both the block column and the flat `description`/`description_en` HTML columns. Omitting the key leaves all three untouched. Since V326 there is only ONE presence-flag (`descriptionBlocksPresent`) — sending the merged array drives both languages' flat-HTML render at once (EN resolved per-field with VI fallback, see "Localize đọc" below).

**Read:** `description_blocks` is returned on product detail responses as `descriptionBlocks: BlockObject[] | null`. Not included in list responses (null). **Admin detail reads get the raw array** (both languages inline per block, unresolved). **Public reads get a per-field locale-resolved copy** (`DescriptionBlock.resolveForLocale`): each block's base fields become `pick(base, en, locale)`, `*En` fields are stripped (null) — same convention as `faqs`/`commitments`/`highlights`.

**HTML sanitizer:** Rendered HTML is sanitized (Jsoup `Safelist`) before writing to `description`/`description_en` to block XSS vectors (`<script>`, `on*` handlers, `javascript:` URIs).

Status: `CONFIRMED_FROM_CODE` — `DescriptionBlock.java` (sealed interface, `resolveForLocale` static resolver), `DescriptionBlocksConverter`, `ProductEntity.descriptionBlocks`, `DescriptionBlockRenderer`, `AdminCatalogMutationService.applyProductPatch`, `JpaCatalogReadRepository`/`JpaCatalogReadSupport`, migrations `V139`, `V238`, `V251`, `V326`, `V327`/`V328`, `V343`. Admin `BlockEditor` cho sản phẩm chỉ tạo `feature` trái/phải; mỗi khối đổi field theo `contentLang`, còn Content đơn ngữ. `DescriptionBlockRenderer` render các khối ra HTML SEO. Subtype `ProsConsBlock` giữ lại dormant để deserialize an toàn dữ liệu cũ.

**Phân biệt Block Menu (CONTENT_MENU vs PRODUCT_MENU):**
- **Menu bài viết (`CONTENT_MENU`):** `heading`, `paragraph`, `list`, `image`, `video`.
- **Menu sản phẩm (`PRODUCT_MENU`):** `feature` (preset ảnh trái/phải) ×2 — `paragraph`/`image` đã gỡ (2026-07-20).
- Khối `video` khi ghi chỉ nhận `provider="youtube"` hoặc `provider="upload"`. `upload` dùng URL video thuộc kho media nội bộ; dữ liệu TikTok/Facebook cũ vẫn có thể xuất hiện trên đường đọc để renderer tương thích.

### Product FAQ entries — `products.faqs` JSONB (V133 → V331/V332/V333)

Per-product list of question/answer pairs rendered in the PDP "Câu hỏi
thường gặp" section band and emitted as `FAQPage` JSON-LD. Stored as a nullable
JSONB column on `products` (`faqs`), following the same physical-storage pattern
as `description_blocks` / `suitability_section`.

Shape: JSON array of `{ question, questionEn?, answer, answerEn?, sortOrder? }`.
`answer` is sanitized rich-text **HTML** authored via the admin TipTap editor; max
20 000 chars at the DTO. The web PDP renders it through `sanitizeRichHtml` inside
a `.wyswyg` block; the `FAQPage` JSON-LD strips it to plain text. Legacy plain-text
answers render unchanged (no tags).

The upsert DTO accepts at most 50 FAQ entries (`@Size(max = 50)`). Rows with a
blank question or answer are dropped on write. Exposed on the public and admin
product detail responses as the `faqs` array on the domain `Product` record;
omitted from product *list* responses (detail-only).

Status: `CONFIRMED_FROM_CODE` — `ProductFaq` domain record, `FaqRequest`,
`AdminCatalogMutationService.applyFaqs`, JSONB converter on `ProductEntity.faqs`,
`V331__add_product_jsonb_content_columns.sql`, `V332__MigrateProductChildContentToJsonb.java`,
`V333__drop_product_child_content_tables.sql`.

### Product commitment rows — `products.commitments` JSONB (V232 → V331/V332/V333)

Per-product list of commitment rows rendered under the add-to-cart / buy-now
buttons on the PDP (`WpPurchaseSection.tsx`). **Replaces** the former global
`public_product` commitment settings (V228) — each product now owns its own rows.
Stored as a nullable JSONB column on `products` (`commitments`), following the
same physical-storage pattern as `description_blocks` / `suitability_section`.

Shape: JSON array of `{ icon, title, titleEn?, subtitle?, subtitleEn?, sortOrder? }`.
`icon` is a key from the fixed web set (e.g. `truck`, `refresh-cw`, `shield-check`);
unknown → web falls back to `shield-check`.

The upsert DTO accepts at most 12 rows (`@Size(max = 12)`). Rows with a blank
title are dropped on write. Exposed on the public and admin product detail
responses as the `commitments` array on the domain `Product` record (admin reads
also carry `titleEn`/`subtitleEn`); omitted from product *list* responses
(detail-only). An empty list hides the whole block on the PDP.

`V232` also **seeds** every existing product with the three former default rows
(delivery / size-exchange / warranty, icons `truck` / `refresh-cw` /
`shield-check`) so no product loses the block on migration, and **removes** the
6 `product_commitment_*` rows from `site_settings`.

Status: `CONFIRMED_FROM_CODE` — `ProductCommitment` domain record,
`CommitmentRequest`, `AdminCatalogMutationService.applyCommitments`,
JSONB converter on `ProductEntity.commitments`, `V331__add_product_jsonb_content_columns.sql`,
`V332__MigrateProductChildContentToJsonb.java`, `V333__drop_product_child_content_tables.sql`.

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

### Product "Specs Dashboard" stat boxes — HTML-only (`spec_stats_html`)

Per-product "Specs Dashboard" content is no longer stored as structured rows. The
only persisted/rendered source is `products.spec_stats_html` / `spec_stats_html_en`
(see §"Product spec-stats HTML"). The former `product_spec_stats` child table was
backfilled into HTML and dropped by `V329__BackfillProductHtmlOnlySections.java` +
`V330__drop_product_html_only_structured_tables.sql`.

### Product SEO template fields — pros/cons, warranty, origin, weight, size guide (V175)

Nhóm field bổ sung cho template trang sản phẩm chuẩn SEO/AEO (xem
`SEO_PDP_IMPLEMENTATION_PLAN.md`, Giai đoạn 3). Tất cả **detail-only** (null/empty
trong product *list* responses, như `faqs`/`commitments`).

**Ưu điểm / Nhược điểm — `products.highlights` JSONB** (schema.org
`positiveNotes` / `negativeNotes`). Stored as a nullable JSONB column on `products`,
following the same physical-storage pattern as `description_blocks` /
`suitability_section`.

Shape: `{ positiveNotes: [{ content, contentEn?, sortOrder? }], negativeNotes: [{ content, contentEn?, sortOrder? }] }`.
`content`/`contentEn` are sanitized rich-text **HTML** authored via the admin TipTap
editor; max 20 000 chars at the DTO. The web PDP renders each note through
`sanitizeRichHtml`; the schema.org `positiveNotes`/`negativeNotes` JSON-LD strips it
to plain text. Legacy plain-text notes render unchanged (no tags). During bulk JSON
import, every embedded `<img>` is removed from either language, matching the other
owner-authored HTML content blocks.
Upsert DTO nhận tối đa 20 mục mỗi nhóm (`@Size(max = 20)`). Mục `content` blank bị
drop. Đọc ra domain `Product` thành 1 field lồng `highlights` (record
`ProductHighlights { positiveNotes, negativeNotes }`, đã resolve theo locale).

> **V251 — Ưu/Nhược điểm TÁCH RA khỏi mô tả lại (đảo phần `prosCons` của V246).** Ưu/Nhược
> điểm trở lại là **khối RIÊNG cố định ngay dưới mô tả, ngoài tab** — admin nhập ở card riêng
> ("Ưu điểm & Nhược điểm"), **không bắt buộc** (đăng sản phẩm được khi để trống). **Nguồn dữ
> liệu duy nhất quay về `products.highlights` JSONB này**; admin gửi lại
> `positiveNotes`/`negativeNotes` (DTO `UpsertProductRequest`, `AdminCatalogMutationService.applyHighlights`),
> backend đọc ra response + schema.org `positiveNotes`/`negativeNotes` (json-ld). Migration `V251`
> gỡ mọi khối `prosCons` còn sót trong `description_blocks`/`_en` (no-op ở production vì V246 chưa
> chạy). **Suitability ("Phù hợp với ai") + sizeGuide ("Bảng size") GIỮ NGUYÊN là khối trong mô tả**
> (chỉ `prosCons` bị đảo). `size_guide` / `suitability_advisory` cột scalar = legacy/dormant như trước.
>
> **(V327/V328) Đảo NGƯỢC LẠI quyết định ngay trên:** suitability/sizeGuide cũng TÁCH RA khỏi
> `description_blocks` — giống hệt hướng `prosCons` đã đi ở V251, chỉ trễ hơn. Lý do: chủ shop
> muốn trình dựng mô tả (BlockEditor) chỉ còn đúng 4 loại khối trong menu "+ Thêm khối". Xem mục
> "Product PDP sections — `suitability_section` / `size_guide_section` (V327/V328)" ở trên.

> **(2026-07-07) Gộp `positiveNotes`/`negativeNotes` thành 1 field lồng `highlights`
> — chủ shop chốt, đổi wire shape và sau đó chuyển lưu vật lý từ bảng con sang JSONB trên `products`.**
> Request (`POST/PATCH /admin/products`, và file mẫu nhập/xuất JSON hàng loạt —
> dùng chung DTO theo `PRODUCT_RULE_009`) cũng như response chi tiết sản phẩm
> (admin + public) đổi từ 2 key top-level `positiveNotes`/`negativeNotes` thành
> 1 key `highlights: { positiveNotes: [...], negativeNotes: [...] }`. Item bên
> trong (`content`/`contentEn`/`sortOrder`) không đổi. Domain có thêm record
> `ProductHighlights` (`Product.highlights`); DTO có thêm `HighlightsRequest`
> (`UpsertProductRequest.highlights`), thay 2 field phẳng cũ. Schema.org JSON-LD
> cho Google (`bigbike-web/lib/seo/json-ld.ts`) **vẫn giữ nguyên 2 property rời**
> `positiveNotes`/`negativeNotes` — chuẩn ngoài, không đổi được; web tự un-nest
> lại thành field phẳng ngay tại tầng fetch/nhận dữ liệu trước khi build JSON-LD.

**Cột lưu trữ bổ sung trên `products`:**

| Column | Type | Null | Notes |
|---|---|---|---|
| ~~`warranty_months`~~ | — | — | **Đã DROP ở V266** (gỡ module bảo hành). Domain field `warrantyMonths` đã gỡ từ V249, dữ liệu đã backfill sang `product_purchase_lines`; cột nay bị xoá hẳn. |
| ~~`warranty_scope`~~ | — | — | **Đã DROP ở V266** (gỡ module bảo hành). Domain field `warrantyScope` đã gỡ từ V249, dữ liệu đã backfill (fallback) sang `product_purchase_lines`; cột nay bị xoá hẳn. |
| `pdp_shipping_line` | `TEXT` | YES | **(dormant từ V249)** Domain field `pdpShippingLine` đã gỡ; cột giữ làm lưới an toàn, dữ liệu đã backfill sang `product_purchase_lines`. Không còn admin đọc/ghi. |
| `pdp_return_line` | `TEXT` | YES | **(dormant từ V249)** Domain field `pdpReturnLine` đã gỡ; cột giữ làm lưới an toàn, dữ liệu đã backfill sang `product_purchase_lines`. Không còn admin đọc/ghi. |
| `origin_brand_country` | `VARCHAR(120)` | YES | "Thương hiệu [nước]". Domain `originBrandCountry`. |
| `origin_brand_country_en` | `VARCHAR(120)` | YES | **(V319)** Bản tiếng Anh của `origin_brand_country`. Domain `originBrandCountryEn`; resolved per-locale qua `pick()` (như các field `*_en` khác), raw value chỉ trả trong `translations.en.originBrandCountry` trên admin read. |
| `size_guide` | `TEXT` | YES | Bảng size dạng HTML (rich-text, sanitize khi render). Domain `sizeGuide`. |
| `faqs` | `JSONB` | YES | (V331/V332/V333) FAQ per-product, shape giữ nguyên API `faqs[]`; thay cho bảng con `product_faqs`. |
| `commitments` | `JSONB` | YES | (V331/V332/V333) Commitment rows per-product, shape giữ nguyên API `commitments[]`; thay cho bảng con `product_commitments`. |
| `highlights` | `JSONB` | YES | (V331/V332/V333) `{ positiveNotes, negativeNotes }`; thay cho bảng con `product_highlights`. |
| `gallery` | `JSONB` | YES | (V334/V335/V336) Gallery ảnh/video cấp sản phẩm, shape giữ nguyên API `gallery[]` (`GalleryMedia[]`); thay cho bảng con `product_gallery_images`. |
| `videos` | `JSONB` | YES | (V334/V335/V336) Video cấp sản phẩm cho tab "Video", shape giữ nguyên API `videos[]` (`VideoAsset[]`); thay cho bảng con `product_videos`. |

**Trọng lượng (đã gỡ):** field dẫn xuất `weightGrams` đã được **gỡ khỏi domain/API/admin/web**
(quyết định chủ shop — ô "Trọng lượng (gram)" trong form đăng sản phẩm biến mất, web ngừng khai
`Product.weight` cho schema.org). Cột vật lý `weight_kg` (`NUMERIC(10,4)`) **vẫn tồn tại** trong
DB (kích thước vật lý do trình nhập WooCommerce ghi — `length_cm`/`width_cm`/`height_cm` cùng nhóm),
KHÔNG drop; chỉ không còn admin ghi/đọc qua field `weightGrams` nữa.

Status: `CONFIRMED_FROM_CODE` — `ProductEntity`
(scalar/JSONB cols), `HighlightRequest`, `HighlightsRequest`, `UpsertProductRequest`,
`ProductHighlights` (domain), `Product`, `AdminCatalogMutationService.applyHighlights`,
`JpaCatalogReadRepository`, migration `V175`, `V331__add_product_jsonb_content_columns.sql`,
`V332__MigrateProductChildContentToJsonb.java`, `V333__drop_product_child_content_tables.sql`.

### Full product catalog CSV projection (2026-07-19)

The administrative full-catalog CSV export is a lossless read projection of the current `products` record and its catalog relations; it does not introduce a separate persistence model. Scalar `products` columns are emitted individually, including bilingual `*_en` columns, all pricing/availability/publish/homepage fields, legacy-but-stored operational columns, SEO/media metadata, and `created_at`/`updated_at`/`version`.

JSONB groups (`description_blocks`, `suitability_section`, `size_guide_section`, `faqs`, `commitments`, `highlights`, `gallery`, and `videos`) are serialized as compact JSON strings in their own CSV cells. Relational groups are serialized in the same way: `variants_json` includes every `product_variants` field plus ordered `product_variant_options` and `product_variant_gallery_images`; `related_products_json` and `accessory_products_json` retain each link's order and linked-product identifying/list-view data. This is intentionally one row per product, rather than one row per child record, so a complete catalog can be opened in Excel without losing nested detail. The exact endpoint/header order is specified by `API_CONTRACT.md` §"Full product catalog CSV export".

### Product gallery — `products.gallery` JSONB (V1 → V248 → V334/V335/V336)

Per-product mixed image/video gallery hiển thị ở dải media chính trên PDP (tách biệt
với `products.videos` — tab "Video" riêng, xem mục dưới). Ban đầu là bảng con
`product_gallery_images` (`V1__create_catalog_content_tables.sql`), thêm hỗ trợ
media hỗn hợp ảnh+video ở `V248__add_gallery_media_video.sql`. Nay là 1 cột JSONB
nullable trên `products` (`gallery`), theo đúng khuôn vật lý như `description_blocks`
/ `faqs` / `commitments` / `highlights`.

Shape: JSON array of `GalleryMedia { id, mediaType, image: ImageAsset|null, videoUrl,
videoProvider, title, titleEn, description, descriptionEn, durationSeconds, uploadedOn }`
— `image: ImageAsset { id, url, alt, width, height, mimeType }`.
`mediaType="image"` → `image` là ảnh, các trường video null. `mediaType="video"`
→ `image` là thumbnail/poster tuỳ chọn (có thể null), `videoUrl`+`videoProvider`
là video cùng metadata song ngữ/thời lượng/ngày đăng. Request ghi nhận `youtube|tiktok|facebook|upload`
và URL đầy đủ khớp provider; `upload` chỉ là file nội bộ.

Upsert DTO (`GalleryImageRequest`) round-trips optional `id` and nhận
`url`/`alt`/`width`/`height`/`mimeType`/`mediaType`/`videoUrl`/`videoProvider`/
`title`/`titleEn`/`description`/`descriptionEn`/`durationSeconds`/`uploadedOn`/`sortOrder`.
Full-replace; item rỗng (ảnh thiếu `url` HOẶC video thiếu `videoUrl`) bị bỏ; thứ tự lưu
= thứ tự sau khi sort theo `sortOrder` (null → dùng index gốc), stable — giống hệt cơ
chế `ordered()` đã dùng cho `faqs`/`commitments`/`highlights`. Video luôn được service
gán/preserve ID ổn định. Exposed trên public + admin
product detail responses là `gallery` array trên domain `Product`; product *list*
responses trả `[]` (detail-only).

**Validation khi ghi:** URL ảnh đã lưu trên entity hiện tại tiếp tục được grandfather theo
`MEDIA_RULE_003`. Video phải dùng URL đầy đủ của `youtube|tiktok|facebook` hoặc file
nội bộ `upload`; PATCH bỏ hẳn field gallery thì dữ liệu hiện có không bị đụng.

Status: `CONFIRMED_FROM_CODE` — `GalleryMedia`/`ImageAsset` domain record, `GalleryImageRequest`,
`ProductFieldApplier.applyGallery`, `ProductGalleryConverter` JSONB converter trên
`ProductEntity.gallery`, `JpaCatalogReadRepository.toGallery`/`toGalleryMedia`,
`V1__create_catalog_content_tables.sql`, `V248__add_gallery_media_video.sql`,
`V334__add_product_gallery_videos_jsonb_columns.sql`,
`V335__MigrateProductGalleryVideosToJsonb.java`,
`V336__drop_product_gallery_videos_tables.sql`,
`V1049__add_product_video_metadata.sql`.

### Product videos — `products.videos` JSONB (V1 → V175 → V334/V335/V336)

Per-product video list cho tab "Video" riêng dưới PDP — **tách biệt** với
`products.gallery` (gallery video do admin đăng chung khu ảnh thumbnail, xem mục
trên). Ban đầu là bảng con `product_videos` (`V1__create_catalog_content_tables.sql`),
thêm cột `description` ở `V175__add_product_seo_template_fields.sql`. Nay là 1 cột
JSONB nullable trên `products` (`videos`), theo đúng khuôn vật lý như `faqs`/`commitments`.

Shape: JSON array of `VideoAsset { id, url, title, titleEn, thumbnail: ImageAsset|null,
provider, description, descriptionEn, durationSeconds, uploadedOn }`. `id` is a
server-managed stable UUID string; `titleEn`/`descriptionEn` are nullable and public English
reads fall back to Vietnamese. The same locale-resolved `description` renders immediately below
the player and is the only source for `VideoObject.description`. `durationSeconds` is nullable
and non-negative; `uploadedOn` is a nullable ISO local date supplied by the editor.

Upsert DTO (`VideoRequest`) round-trips the optional server-managed `id`, and accepts
`url`/`title`/`titleEn`/`provider`/`description`/`descriptionEn`/`durationSeconds`/
`uploadedOn`/`thumbnailUrl`/`sortOrder`. Full-replace; item thiếu `url` bị bỏ; thứ tự
lưu = thứ tự sau khi sort theo `sortOrder` (null → dùng index gốc), giống `applyGallery`.
The service assigns an ID for every new item and preserves a valid existing ID; `thumbnail.id`
remains null. Exposed
trên public + admin product detail responses là `videos` array trên domain `Product`;
product *list* responses trả `[]` (detail-only).

Khi ghi, `provider` nhận `youtube|tiktok|facebook|upload` và URL phải khớp provider;
URL rút gọn hoặc provider lạ trả `400 INVALID_VALUE`. `upload` phải là video nội bộ.
PATCH không gửi `videos` giữ nguyên cột JSONB hiện có.

Status: `CONFIRMED_FROM_CODE` — `VideoAsset`/`ImageAsset` domain record, `VideoRequest`,
`ProductFieldApplier.applyVideos`, `ProductVideosConverter` JSONB converter trên
`ProductEntity.videos`, `JpaCatalogReadRepository.toVideos`,
`V1__create_catalog_content_tables.sql`, `V175__add_product_seo_template_fields.sql`,
`V334__add_product_gallery_videos_jsonb_columns.sql`,
`V335__MigrateProductGalleryVideosToJsonb.java`,
`V336__drop_product_gallery_videos_tables.sql`,
`V1049__add_product_video_metadata.sql`.

### Product gender flags — `products.gender_male` / `products.gender_female` (V1030)

Giới tính mục tiêu là hai cờ độc lập, không có lựa chọn `Unisex` hay `Không chọn`.
Hai cờ đều mặc định `false`; `false/false` là trạng thái hợp lệ và được biểu diễn
trên API bằng `genders: []`.

| Flags | API `genders` | Meaning |
|---|---|---|
| `false/false` | `[]` | Không gắn giới tính; chỉ hiện khi không lọc giới tính |
| `true/false` | `["Nam"]` | Dành cho nam |
| `false/true` | `["Nữ"]` | Dành cho nữ |
| `true/true` | `["Nam","Nữ"]` | Dành cho cả nam và nữ |

Field-level attributes:
- **DB columns:** `products.gender_male BOOLEAN NOT NULL DEFAULT FALSE` and `products.gender_female BOOLEAN NOT NULL DEFAULT FALSE`. Migration V1030 backfills the old scalar without inference: `Nam` → male, `Nữ` → female, blank/`NULL`/legacy `Unisex` → both flags false, then removes the old scalar column.
- **Domain/API:** `Product.genders[]` is the canonical field on list and detail responses, with unique values in the stable order `Nam`, `Nữ`. `genders: []` is always valid. `UpsertProductRequest.genders` is presence-aware: omitted on PATCH preserves both flags; an explicit empty array clears both; one or both supported values set the corresponding flags.
- **Legacy compatibility:** import accepts an old scalar `gender` value (`Nam`/`Nữ`; legacy `Unisex` becomes `[]`) and CSV accepts `Nam`, `Nữ`, `Nam|Nữ` or blank. New exports use only canonical `genders` in JSON and the documented CSV encoding.
- **Public filter param:** canonical `filter_gender` is one value, `Nam` or `Nữ`; a product matches when its corresponding flag is true. Repeated legacy query values are tolerated by taking the first supported value, so old URLs never become an empty result.
- **Admin filter param:** `filter_gender` is one of blank/all, `Nam`, or `Nữ`; products with both flags match either gender filter. There is no `NULL`/blank-gender filter option.
- **Facet:** `CatalogFacets.genders[]` remains the fixed set `[Nam, Nữ]` with live membership counts; products with both flags contribute to both counts and zero-count buckets are omitted.

Status: `CONFIRMED_FROM_OWNER_DECISION_2026-08-14`

Evidence: `ProductEntity.java`, `Product.java`, `CatalogReadService.java` (`matchesGender`, `buildGenderBuckets`), `UpsertProductRequest.java`, `ProductImportRow.java`, `V1030__replace_product_gender_with_flags.sql`.

### Product video description — `product_videos.description` (V175)

**Đã chuyển sang JSONB** — xem mục *"Product videos — `products.videos` JSONB"* ở trên
(V334/V335/V336). Lịch sử: cột `description TEXT NULL` từng thêm vào bảng con
`product_videos` ở V175, nay là field `description` trong mỗi phần tử JSON.

### Gallery media hỗn hợp — ảnh + video trong gallery (V248)

**Phần product-level đã chuyển sang JSONB** — xem mục *"Product gallery —
`products.gallery` JSONB"* ở trên (V334/V335/V336). Phần **biến thể**
(`product_variant_gallery_images`) **KHÔNG đổi** — vẫn là bảng con riêng, đọc qua
`ProductVariant.gallery`, cùng shape `GalleryMedia[]`, cùng logic
`JpaCatalogReadRepository.toGalleryMedia` (dùng chung với product-level).

Domain: `Product.gallery` và `ProductVariant.gallery` cùng dùng `List<GalleryMedia>`
với metadata video đã nêu ở trên.

Status: `CONFIRMED_FROM_CODE` — `V248__add_gallery_media_video.sql`,
`V295__drop_gallery_caption_columns.sql`, `ProductVariantGalleryImageEntity` (biến
thể, còn bảng), `ProductGalleryConverter` (sản phẩm, nay JSONB), `GalleryMedia`,
`GalleryImageRequest` (`mediaType`/`videoUrl`/`videoProvider`),
`ProductFieldApplier.applyGallery`/`applyVariantGallery`.

### Variant color representation image (2026-07-03)

The variant color representation image (ảnh đại diện màu) is decoupled from the variant gallery. Admins select a single image via the media picker per color, and this choice is sent directly via `imageUrl` / `imageAlt` on `VariantRequest`.
- **Lưu trữ**: Lưu trong các cột `image_url`, `image_alt`, v.v. của bảng `product_variants`.
- **Color-scoped**: Ảnh đại diện màu được đồng bộ cho tất cả các biến thể có cùng `colorKey` (ví dụ: Đỏ - S, Đỏ - M, Đỏ - L chia sẻ chung một ảnh đại diện).
- **Fallback**: Nếu ảnh đại diện màu bị bỏ trống (null/rỗng), web/storefront tự động lấy ảnh đầu tiên của dải ảnh (`gallery[0]`) làm fallback.
- **Không dùng cơ chế đánh sao**: Trường `cover` trên `GalleryImageRequest` (write) và `isCover` trên `GalleryMedia` (read) bị loại bỏ hoàn toàn.

Status: `CONFIRMED_FROM_CODE` — `VariantRequest.java` (`imageUrl`/`imageAlt` field), `AdminCatalogMutationService.applyVariants`.

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

### Product ↔ category — ordered many-to-many (V348)

`products.category_id` đã được thay bằng bảng liên kết `product_category_map`:

| Column | Type | Null | Notes |
|---|---|---|---|
| `product_id` | `VARCHAR(64)` | NO | FK → `products.id`, `ON DELETE CASCADE`. |
| `category_id` | `VARCHAR(64)` | NO | FK → `categories.id`, `ON DELETE CASCADE`. |
| `sort_order` | `INTEGER` | NO | Thứ tự danh mục của sản phẩm; `0` là danh mục chính. |

Khóa chính `(product_id, category_id)` cấm một liên kết trùng; chỉ mục `(category_id, product_id)` phục vụ lọc catalog theo danh mục/cây con. Migration `V348__restore_product_category_map.sql` backfill đúng một liên kết `sort_order = 0` từ cột cũ cho từng sản phẩm rồi mới bỏ `products.category_id`. Vì migration `V110` đã xóa map lịch sử, V348 chỉ có thể bảo toàn danh mục chính còn lại tại thời điểm migrate.

`ProductEntity.categories` là danh sách có thứ tự (`@OrderColumn`). API luôn trả `categories[]` không trùng, đầy đủ theo thứ tự; `category` là phần tử đầu để tương thích breadcrumb/SEO. `CategorySummary` có `visible` và `deleted`, cho phép client giữ liên kết cũ nhưng không tạo link công khai tới danh mục đã ẩn/xóa mềm.

Status: `CONFIRMED_FROM_CODE` — `ProductEntity.categories`, `V348__restore_product_category_map.sql`, `JpaCatalogReadRepository`.

### Product tags — REMOVED (V243)

The product tag feature was removed entirely on 2026-06-19. The storefront never consumed these tags (no tag-filter page or tag-aware search was ever wired), and the admin tag editor was removed, so the tables held only dead WordPress-import data. Migration `V243__drop_product_tags.sql` drops `product_tag_map` then `product_tags`; the `ProductTagEntity`, `ProductTagJpaRepository`, `AdminProductTagService`, `ProductTagsRequest`, the admin sub-resource, and `ProductEntity.tags` are all deleted.

Status: `CONFIRMED_FROM_CODE` — removal verified; no remaining `product_tag` references in runtime code.

### Product rating denormalization — `products.rating` / `products.rating_count`

Cache denormalized của review **APPROVED**, phục vụ list/detail đọc nhanh không join bảng `reviews`:

- `products.rating` — `numeric(3,2)`, nullable, **không có default** (thêm ở `V18`, check constraint `ck_products_rating`: `NULL` hoặc `0..5`). Giá trị = trung bình cộng điểm review đã duyệt, làm tròn **1 decimal HALF_UP** (`AdminReviewService.toCachedRating`).
- `products.rating_count` — `integer`, nullable, **không có default** (thêm ở `V43`). Giá trị = số review đã duyệt.
- `reviews.rating` — `numeric(2,1) NOT NULL`, check giá trị thuộc tập `{1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5}` bước 0,5 (`V14` tạo `smallint 1..5`; **`V347` nới sang thập phân nửa sao** — `BUSINESS_RULES.md` `REVIEW_RULE_008`, owner decision 2026-07-22) — nên hễ có ≥ 1 review đã duyệt thì trung bình luôn ≥ 1.
- `reviews.photos` — `jsonb`, nullable (`V234`). Mảng URL ảnh khách hàng đúng namespace MinIO `/media/reviews/...`, tối đa 10. `NULL`/`[]` = không có ảnh. Chỉ phục vụ hiển thị khi review `APPROVED` (`REVIEW_RULE_005`).
- `reviews.version` — `bigint NOT NULL DEFAULT 0` (`V355`), optimistic concurrency token. Admin list/detail trả field này; single mutation và từng item bulk phải echo `expectedVersion`.
- **Kiểm duyệt tự động (`V380`, `REVIEW_RULE_012`/`013`)** — 5 cột nullable, tất cả `NULL` với mọi review có trước `V380` (không backfill; UI hiểu `NULL` = "chưa qua kiểm duyệt tự động"). Các cột này là **ghi chú kết quả**, không phải nguồn sự thật của trạng thái — trạng thái vẫn chỉ nằm ở `reviews.status`.
  - `reviews.moderation_source` — `varchar(16) NULL`, check ∈ `{RULE, AI, SKIPPED}`. `RULE` = danh sách từ cấm bắt được (không gọi AI); `AI` = AI đã trả lời hợp lệ; `SKIPPED` = không chạy được (tắt công tắc, thiếu khoá dịch vụ, nhận xét rỗng, lỗi mạng, quá hạn chờ, phản hồi sai định dạng).
  - `reviews.moderation_verdict` — `varchar(16) NULL`, check ∈ `{CLEAN, BLOCKED}`. `CLEAN` **không** đồng nghĩa đã duyệt — review vẫn ở `PENDING` chờ người bấm (`REVIEW_RULE_012`).
  - `reviews.moderation_categories` — `jsonb NULL`. Mảng mã loại vi phạm, giá trị hợp lệ `PROFANITY`, `HARASSMENT`, `ADVERTISING`, `SENSITIVE`. Có thể chứa loại **đang tắt** trong Cài đặt — khi đó nó chỉ là ghi chú cho người duyệt, không phải lý do chặn. `NULL`/`[]` = không phát hiện gì.
  - `reviews.moderation_reason` — `varchar(500) NULL`. Câu giải thích ngắn bằng tiếng Việt hiển thị cho admin (với `RULE` là từ cấm đã khớp; với `SKIPPED` là mã lý do máy đọc được). **Không bao giờ** được sao chép vào audit (`REVIEW_RULE_011`).
  - `reviews.moderation_checked_at` — `timestamptz NULL`, thời điểm chạy xong. `NULL` = chưa từng chạy. Đặt cùng lúc với 4 cột trên, kể cả khi `SKIPPED`, nên `NULL` phân biệt được rõ "chưa chạy" với "chạy rồi nhưng bỏ qua".
- `reviews.first_approved_at` — `timestamptz NULL` (`V356`), marker bền vững cho email duyệt lần đầu. `V356` backfill row đang `APPROVED`; `V358` đọc audit `REVIEW_STATUS_CHANGED` lịch sử để backfill cả review từng được duyệt rồi đã về `PENDING`/`SPAM`/`TRASH`, trước khi redaction audit. Marker không bị xóa khi review rời `APPROVED`, nên restore rồi duyệt lại không gửi email lần hai.

`review_photo_uploads` (`V357`) là sổ claim ảnh bền vững, tách khỏi JSON hiển thị:

| Column | Type / constraint | Meaning |
|---|---|---|
| `object_key` | `varchar(500) PRIMARY KEY` | Canonical MinIO key under `reviews/`; uniqueness is the atomic single-claim boundary. |
| `public_url` | `varchar(600) NOT NULL UNIQUE` | Canonical `/media/reviews/...` URL returned to the browser. |
| `product_id` | `varchar(64) NOT NULL` | Product supplied at upload; submit must match it. |
| `uploaded_at` | `timestamptz NOT NULL` | Starts the 24-hour unclaimed retention window. |
| `claimed_at` | `timestamptz NULL` | Set atomically in the review-submit transaction. |
| `review_id` | `bigint NULL`, FK `reviews(id) ON DELETE SET NULL` | Owning review after claim. Multiple photos may belong to one review; one object key cannot belong to two reviews. |

Submit first persists the `PENDING` review, then conditionally updates every upload
row where `object_key`, `product_id` match and `claimed_at IS NULL`. Any zero-row
claim aborts the whole transaction. A scheduled cleanup atomically removes
unclaimed rows older than 24 hours before deleting their MinIO objects, so cleanup
cannot race a successful claim. It also sweeps old untracked MinIO objects left by
an interrupted upload. Hard-delete cleanup happens after commit and checks legacy
JSON references before deleting; product-delete cascade sets `review_id = NULL`,
allowing the same scheduled sweep to collect those objects.

Review audit snapshots never serialize author name/email, `body`/comment, or entries
in `photos`; only safe operational metadata such as IDs, product metadata,
status/rating/photo count and version is retained (`REVIEW_RULE_011`). `V358`
rewrites historical Review snapshots to that allowlist; malformed legacy JSON is
replaced by a safe redacted marker, while non-Review audit rows are untouched.

**Recompute flow (đường duy nhất được ghi cache):** `AdminReviewService.recomputeProductReviewAggregate` chạy sau **mọi chuyển trạng thái được phép thực sự làm đổi dữ liệu** (`PENDING → APPROVED|SPAM|TRASH` hoặc `APPROVED|SPAM|TRASH → PENDING`) và sau `deleteReview`; same-state no-op không recompute theo `REVIEW_RULE_009`. Khi 0 review approved: `rating = NULL` (không phải 0) và `rating_count = 0`. `PublicReviewService.submitReview` tạo review PENDING và **không** recompute (đúng — pending không được tính). Admin upsert product **không thể** set tay 2 field này (`UpsertProductRequest` cố ý không khai báo field; xem comment "Phase 2D" trong `AdminCatalogMutationService`).

**Trạng thái NULL hợp lệ:** sản phẩm admin tạo mới có `rating = NULL` và `rating_count = NULL` (chưa từng recompute) cho tới khi review đầu tiên được duyệt.

**Invariant `rating_count ≥ 1 ⟺ rating > 0`: `PARTIAL`.** Đường moderation luôn giữ invariant. Pipeline WordPress import **đã được sửa** để cũng tuân theo: `WordPressProductMapper` không còn default `4.5` (meta thiếu → `null`), `ProductImporter` không seed `rating` từ meta sản phẩm, `ReviewImporter.recomputeRatingCache` recompute `rating`/`rating_count` từ review APPROVED sau import (mirror `AdminReviewService`). Bản ghi tồn dư hoặc payload lệch có thể có count dương nhưng rating null; web phải hiển thị sao trung tính và giữ count an toàn, không suy diễn điểm. Với count NULL/0, web hiển thị sao rỗng/trung tính + `Chưa có đánh giá` + `0 đánh giá`, không ẩn toàn bộ widget.

**API mapping:** list-item + detail `Product` trả `rating` / `ratingCount` (optional, nullable — `bigbike-web/lib/contracts/public.ts`). API public reviews trả `avgRating` (1-decimal; **`0.0` khi 0 review**, không phải null — `PublicReviewService.roundAverage`) và `totalReviews`; `0.0` chỉ là sentinel transport. FE dùng `resolveRatingDisplay` để tách `empty`/`rated`/`inconsistent`, không dùng `avgRating > 0` đơn lẻ và không dùng `ratingCount` để suy ra số lượt mua.

Status: `CONFIRMED_FROM_CODE` — `AdminReviewService.java`, `PublicReviewService.java`,
`ReviewJpaRepository.java`, `ProductEntity.java`, `UpsertProductRequest.java`,
`WordPressProductMapper.java`, `ProductImporter.java`, `ReviewImporter.java`, migrations `V14`, `V18`, `V43`, `V63`, `V347`.

### Review title — REMOVED (V298)

The optional review "title" field (added alongside `reviews.photos` in `V234`) was removed entirely on 2026-07-01. `photos` (ảnh khách hàng) is unaffected and stays exactly as documented above. Migration `V298__drop_review_title.sql` drops `reviews.title`; `ReviewEntity.title`, `SubmitReviewRequest.title`, `PublicProductReviewsResponse.ReviewItem.title`, the `MAX_TITLE_LENGTH` validation in `PublicReviewController`, and the title handling in `PublicReviewService`/`AdminReviewService` are all deleted. The original `V234__add_review_title_photos.sql` file is left unchanged (Flyway is append-only).

Status: `CONFIRMED_FROM_CODE` — removal verified; no remaining review-title references in runtime code.

### Product bilingual content — English columns (V136)

BigBike sản phẩm có 2 bản nội dung: **tiếng Việt** (canonical, bắt buộc) và
**tiếng Anh** (tùy chọn). Bản tiếng Việt vẫn nằm ở các cột gốc như cũ; bản tiếng
Anh được lưu trên **các cột `_en` nullable cùng dòng** hoặc field `*En` trong JSONB
cùng dòng — không có bảng dịch riêng. Lý do: chỉ có đúng 2 ngôn ngữ cố định; nội dung
product detail dùng JSONB/HTML cùng dòng để tránh bảng dịch phụ dễ lệch thứ tự.

**Cột `_en` trên `products`** (đều nullable, kiểu khớp cột gốc):

| Cột tiếng Việt (gốc) | Cột tiếng Anh | Kiểu |
|---|---|---|
| `name` | `name_en` | `VARCHAR(255)` |
| `short_description` | `short_description_en` | `TEXT` |
| `description` | `description_en` | `TEXT` |
| `size_guide` | `size_guide_en` | `TEXT` |
| `content_bottom` | `content_bottom_en` | `TEXT` |
| `seo_title` | `seo_title_en` | `VARCHAR(255)` |
| `seo_description` | `seo_description_en` | `TEXT` |

**Field `*En` trong JSONB:** `description_blocks`, `suitability_section`, `faqs`,
`commitments`, `highlights`, `videos` và video item trong `gallery` giữ bản tiếng Anh inline
trong từng object. Các khối
HTML-only (`specifications`, `specStats`, `trustBadges`) dùng cột `_en`
riêng trên `products`.

**Fallback theo từng trường:** khi đọc bản tiếng Anh, mỗi trường lấy
`COALESCE(<field>_en, <field>)` — sản phẩm có thể có tên tiếng Anh nhưng mô tả
vẫn lùi về tiếng Việt. Bản tiếng Việt không bao giờ bị thiếu (xem
`BUSINESS_RULES.md` `PRODUCT_RULE_001`, `PRODUCT_RULE_002`).

**Slug tiếng Anh (`slug_en`, V214):** xem mục **"English URL slug"** bên dưới — `slug` tiếng Việt là canonical, `slug_en` là URL tiếng Anh tùy chọn.

**`en_overrides` — ĐÃ GỠ BỎ (V312).** Cột `TEXT` này từng tồn tại trên `products`, `categories`,
`brands`, `articles`, lưu JSON array các trường/khối tiếng Anh admin khoá khỏi tự-dịch. Cùng với việc
gỡ bỏ tính năng tự động dịch VI→EN (Gemini), cột này (và `EnOverridesCodec`) đã bị **drop khỏi DB**
ở migration `V312__remove_gemini_translation_lock.sql` — không còn round-trip qua admin
(`translations.overrides` không còn tồn tại trong response). Tiếng Anh nay **nhập tay 100%**; xem
`BUSINESS_RULES.md` `TRANSLATION_RULE_001/002` cho quy tắc field nào bắt buộc EN.

**Không dịch:** alt ảnh, tên video, tên biến thể, `seo_canonical_url`.

**Admin list reads:** danh sách admin (product/category/brand/content) nay cũng
resolve **trường hiển thị** (`name` / `title`) theo `lang` qua cùng cơ chế
`COALESCE(<field>_en, <field>)` — khối `translations` vẫn `null` ở list (chỉ có ở
detail). Mặc định `vi`; chỉ detail trả cả 2 bản để soạn thảo song ngữ.

Status: `CONFIRMED_FROM_CODE` — `ProductEntity`, các JSONB converter product content,
`ProductTranslations` domain record,
`JpaCatalogReadRepository` (resolve locale list + detail), migration `V136`.

**`size_guide_en` thêm ở `V316__add_product_size_guide_en.sql`** (2026-07-04, cùng đợt tính năng nhập
sản phẩm hàng loạt) — trước đó cột `size_guide` không có bản tiếng Anh, dù mẫu file nhập/xuất sản phẩm
có cột riêng cho bảng size tiếng Anh. `ProductTranslationRequest.ProductContentRequest.sizeGuide` (field
không hậu tố `En` vì đã nằm trong khối `.en`) ghi qua `ProductFieldApplier.applyTranslations`.

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
| `intro_content` | `intro_content_en` | `TEXT` |

`intro_content`/`intro_content_en` (đổi tên từ `content_bottom`/`content_bottom_en` qua `V290`; field domain `introContent`) = khối giới thiệu hiển thị ở ĐẦU trang danh mục (trên lưới sản phẩm). Fallback: giống `PRODUCT_RULE_002` — mỗi trường lùi về VI khi EN bị null/blank. Xem `CATEGORY_RULE_001/002`.

**Slug tiếng Anh (`slug_en`, V213):** xem mục **"English URL slug"** bên dưới.

Status: `CONFIRMED_FROM_CODE` — `CategoryEntity`, `CategoryTranslations` domain record, migration `V137`.

### Category intro FAQ markup normalization (V1038)

The category intro structured mode remains the safe input source for the visible template. Its
FAQ questions are rendered as `<h3 class="bb-ci-qt">` and the display HTML no longer
contains `FAQPage`/`Question`/`Answer` microdata attributes. The public web emits one
standalone `FAQPage` JSON-LD block from the same parsed questions and plain-text answers,
so the customer-facing text and machine-readable text stay in sync without duplicate
markup. Migration `V1038__normalize_category_intro_faq_markup.sql` first copies every
affected category's Vietnamese and English intro HTML into
`category_intro_faq_markup_backup`, then normalizes both language columns. The backup
table is retained as a recovery record and is not part of the admin editing flow.

The same `intro_content`/`intro_content_en` fields also support an advanced raw-HTML input mode.
The mode is an admin editing choice, not stored data: structured and advanced input always read and
write one field. HTML that contains custom presentation outside the structured template (including
tables) opens in advanced mode and is not converted on load. Switching to structured mode requires
confirmation before a later structured edit can serialize over the custom markup. The 50,000-character
limit and bilingual fallback are unchanged; no category rows are rewritten for this capability.

Structured mode also exposes a copy-only AI prompt and a manual paste reader. The reader accepts the
Vietnamese/English labeled format or the equivalent JSON object, reports ignored/unknown sections before
writing, and preserves existing fields that are absent from the pasted result. It does not call an AI service.
The structured model stores only the existing template fields; the intro and FAQ answer values may contain
sanitized inline `strong`/`b`, `em`/`i`, `br`, and safe `a` markup. Titles, labels, brands, and questions remain
plain text. The serializer continues to produce the same `bb-cat-intro` wrapper and FAQ rows, while free HTML
in advanced mode still does not produce the template's intro cards or category FAQ JSON-LD.

Status: `CONFIRMED_FROM_CODE` — `V1038__normalize_category_intro_faq_markup.sql`,
`categoryIntro.js`, `category-intro.ts`, category page JSON-LD builder.

### Category soft-delete — `deleted` (V293)

Cột `deleted` (`BOOLEAN`, `NOT NULL`, mặc định `false`) trên bảng `categories` được sử dụng để quản lý trạng thái Xóa mềm (Thùng rác) của danh mục. Khi `deleted = true`, danh mục được coi là nằm trong Thùng rác và sẽ tự động bị ẩn khỏi toàn bộ luồng đọc công khai (storefront web). Các sản phẩm thuộc danh mục bị xóa mềm vẫn được giữ nguyên và bán bình thường.

### Category visibility and homepage placement

Category uses three independent booleans with separate meanings:

| API/domain field | Persistence | Default | Meaning |
|---|---|---|---|
| `isVisible` | `categories.is_visible` | `true` | Whether an active Category may appear on the storefront. Hiding a Category with a directly visible child is rejected with `409`. |
| `deleted` | `categories.deleted` | `false` | Trash lifecycle. Soft-delete/restore cascade the complete subtree and do not themselves change product links. |
| `showOnHomepage` | `categories.show_on_homepage` | `false` | Placement in the homepage category surface only; it is independent of visibility and Trash. |

`showOnHomepage` is omitted by the create form while false; an explicit true value is persisted. On update, absence preserves the stored value and a supplied `false` clears the homepage placement. No Category list/detail response currently exposes a product count, so an admin consumer must not synthesize one from the current page.

The system Category `uncategorized` is permanently hidden and may be read in the admin Category list, but every write operation (upsert, visibility change, soft delete, restore and permanent delete) is rejected with `409`. It is excluded from the Category parent picker.

### Category media and SEO write shape

The Category upsert DTO accepts separate assets for `image` (grid thumbnail), `icon` (hero illustration), `menuIcon` (root-category header-menu line icon), `banner` (desktop hero background), and `seo.ogImage`. Assets other than `menuIcon` retain the normal `ImageAsset { url, alt, width, height, mimeType }` shape; `menuIcon` persists only its `url`.

For `PATCH`, omitting an asset block preserves it; `{ "url": null }` clears that asset. Omitting `seo` preserves SEO. Supplying `seo` normalizes blank text fields to `null`; `seo: {}` therefore clears title, description, canonical URL and the social image. Admin forms always send an explicit `seo` block when saved.

### Category header menu icon — `menu_icon_url` (V213)

Cột `menu_icon_url` (`TEXT`, nullable) trên `categories` lưu **icon line đơn sắc** cạnh tên danh mục
gốc trong menu đầu trang website (máy tính và điện thoại). Bộ lọc "Danh mục sản phẩm" không đọc field
này. Render qua CSS `mask-image` theo `currentColor`.

Phân biệt rõ với các cột ảnh khác trên `categories`:

| Cột | Vai trò |
|---|---|
| `menu_icon_url` | Icon line đơn sắc cho menu đầu trang của danh mục gốc (mask-image). **Field này.** |
| `icon_url` (`icon`) | Ảnh minh hoạ **hero** trang danh mục (WP ACF `image_left`) — KHÔNG dùng cho menu. |
| `image_url` (`image`) | Ảnh thumbnail danh mục (lưới trang chủ). |
| `banner_url` | Ảnh nền hero. |

Trước đây icon menu đầu trang gắn theo **slug** (CSS theme WP `.{slug}>a::before`) → đổi slug là mất icon, và
icon không quản được trong admin. Đã chuyển hẳn sang DATA-DRIVEN, một nguồn duy nhất là `menu_icon_url`:
- **File icon gốc nằm trong repo web** (`bigbike-web/public/wp/icon-N.svg`, `abdominals.png`). **`V223`** đã upload
  11 file icon menu này lên MinIO (`bigbike-media/uploads/wp-icons/*`) và migrate `menu_icon_url` từ seed cũ
  `/wp/<file>` → `/media/uploads/wp-icons/<file>` (phục vụ qua rewrite `/media/*`, cùng origin nên mask-image render
  đúng). Các asset `/wp/*` khác (vd banner `/wp/page-title-bg.png`) vẫn do web phục vụ tĩnh + admin proxy
  `/wp/ → bigbike-web` (`bigbike-admin/nginx.conf`).
- **`V217`** thêm cột + backfill theo slug; **`V219`** hoàn thiện: khoá theo **ID danh mục** (`wp-cat-NNN`, ổn
  định từ WP import — không drift như slug) cho 13 danh mục, idempotent + guard (chỉ đè NULL hoặc giá-trị-mặc-
  định `/wp/*`,`/media/uploads/wp-icons/*`). Mô tả lịch sử của `WpCategorySidebar` render icon cho cả danh
  mục con đã bị supersede bởi `CATEGORY_RULE_010`; code hiện hành chỉ dùng icon cho menu đầu trang.
- **`V360`** bổ sung fallback slug→icon cho các mục menu header legacy không còn category record tương ứng, để
  các item lịch sử trên menu chính vẫn hiển thị icon đúng theo asset MinIO dù DB category không có dòng khớp.

**Admin-writable:** admin chỉnh ở form danh mục (`CategoryDetailScreen` → "Biểu tượng menu"), gửi
qua `UpsertCategoryRequest.menuIcon` → `menu_icon_url`. URL phải qua whitelist
`AdminMutationValidators.validateWhitelistedMediaUrl` (`/media/`, `/media-proxy/`, hoặc MinIO public base). Seed
hiện tại `/media/uploads/wp-icons/*` (sau `V223`) hợp lệ với whitelist → lưu lại trong admin không còn HTTP 400;
seed cũ `/wp/*` (file tĩnh, KHÔNG qua được whitelist) đã được migrate. Xem `API_CONTRACT` §"Menu/category line-icon".

DANH MỤC CON (`parent_id IS NOT NULL`) không được giữ `menu_icon_url`: mọi request ghi có `menuIcon` đều
bị bỏ qua im lặng và lưu `NULL`, kể cả khi URL không thuộc kho media; khi hạ root thành con, icon bị xoá.
Khi nâng lại thành root, field bắt đầu trống và admin phải chọn lại. Migration `V1065__clear_category_child_menu_icons.sql`
chuẩn hoá dữ liệu cũ bằng cách đặt `menu_icon_url = NULL` cho toàn bộ danh mục con, không đụng các danh mục gốc.

**Banner hero + hero illustration (V219):** `banner_url` (ảnh nền hero) trước là hardcode `DEFAULT_BG`
(`WpCategoryHero.tsx` → `/wp/page-title-bg.png`); V219 đưa vào DB cho mọi danh mục để ô "Ảnh banner hero" trong
admin quản được (web y nguyên, fallback `DEFAULT_BG` giữ trong code cho danh mục chưa đặt). `icon_url` (ảnh
minh hoạ hero, ACF `image_left`) V219 đổi URL ngoài `bigbike.vn/wp-content/uploads/` → `/media-proxy/wp-uploads/`
(ảnh sẵn trong MinIO từ WP import). Cả hai admin sửa qua `UpsertCategoryRequest.banner` / `.icon`.

Status: `OWNER_CONFIRMED_2026-08-28` + `CONFIRMED_FROM_CODE` — `CategoryEntity.menuIconUrl`, `Category` domain record, `JpaCatalogReadRepository`, `UpsertCategoryRequest.menuIcon`, `CategoryMutationService.applyCategoryPatch`, `CatalogRequestValidator`, `AdminMenuService`, migrations `V213`/`V217`/`V219`/`V223`/`V1065`.

### Brand bilingual content — English columns (V137); `name`/`slug` de-duplicated (V352)

Thương hiệu có tên riêng và slug dùng chung VI/EN; chỉ các field nội dung/SEO có bản tiếng Anh tùy chọn.
Bản tiếng Anh lưu trên các cột `_en` nullable cùng dòng trong bảng `brands`. `name_en` và `slug_en`
từng tồn tại (V137/V215) như cột legacy tương thích dữ liệu cũ, nhưng không entity nào có dữ liệu
khác biệt thực sự (`name_en` luôn trùng `name`; `slug_en` chưa từng được ghi) và không điều khiển
tên/slug hiển thị hay validation — nên đã **xoá hẳn khỏi bảng `brands`** ở `V352`. Brand giờ chỉ còn
đúng 2 cột đại diện tên/đường dẫn: `name` và `slug`, không tách VI/EN.

**Cột `_en` còn lại trên `brands`** (đều nullable, chỉ áp dụng cho nội dung/SEO):

| Cột tiếng Việt | Cột tiếng Anh | Kiểu |
|---|---|---|
| `description` | `description_en` | `TEXT` |
| `seo_title` | `seo_title_en` | `VARCHAR(255)` |
| `seo_description` | `seo_description_en` | `TEXT` |

Fallback: tên thương hiệu luôn lấy từ `name` theo `BRAND_RULE_001`; slug thương hiệu luôn lấy từ
`slug` theo `BRAND_RULE_003`; các trường còn lại lùi về VI khi EN bị null/blank theo `BRAND_RULE_002`.
`UpsertBrandRequest`/`BrandTranslationRequest.BrandContentRequest` vẫn còn field `slug`/`name` ở
translations.en cho tương thích client cũ gửi lên — luôn bị bỏ qua, không có cột DB nào lưu chúng.

Status: `CONFIRMED_FROM_CODE` — `BrandEntity`, `BrandTranslations` domain record, migration `V137`, `V352`.

### Brand homepage placement — `show_on_homepage` (V349)

Brand có một cờ boolean riêng cho vị trí trên trang chủ, không phải state xóa mềm:

| Field domain/API | Cột DB | Kiểu | Ý nghĩa |
|---|---|---|---|
| `showOnHomepage` | `show_on_homepage` | `BOOLEAN NOT NULL DEFAULT TRUE` | Khi `true`, Brand có thể xuất hiện trong dải logo thương hiệu trang chủ; khi `false`, chỉ loại khỏi dải này. |

Migration `V349__add_brand_show_on_homepage.sql` backfill mọi Brand hiện có thành `true`, nên không làm thương hiệu hiện tại biến mất khỏi carousel sau deploy. `isVisible` vẫn là cờ xóa mềm duy nhất và tiếp tục được dùng cho toàn bộ public Brand reads. `showOnHomepage` không lọc `/brands`, `/brands/{slug}`, facet thương hiệu hoặc `BrandSummary` nhúng trong sản phẩm.

`Brand` domain/public response và `UpsertBrandRequest` đều mang field `showOnHomepage`; field này được ghi qua create/update admin. Public list chỉ áp dụng bộ lọc khi caller truyền `showOnHomepage` (trang chủ truyền `true`).

Status: `CONFIRMED_FROM_CODE` — `BrandEntity.showOnHomepage`, `Brand.showOnHomepage`, `UpsertBrandRequest.showOnHomepage`, `BrandMutationService.applyBrandPatch`, `CatalogReadService.listBrands`, migration `V349`.

### Brand logo quality and storage marker (V1064)

`brand.logo` dùng `ImageAsset` như các ảnh khác ở đường đọc, nhưng đường ghi logo mới có
hợp đồng chặt hơn `Media Library` chung. `ImageAssetRequest` nhận thêm `mediaId` tùy chọn;
đây là UUID của bản ghi media nội bộ dùng cho `brand.logo`, không phải URL ngoài. Khi admin
chọn file hoặc nhập URL, media phải được lưu vào MinIO trước, sau đó request Brand gửi
`mediaId` cùng URL nội bộ. Máy chủ lấy bytes và metadata thực tế của object, không tin
`width`/`height`/`mimeType` do trình duyệt gửi.

| Field domain/API | Cột DB | Kiểu | Ý nghĩa |
|---|---|---|---|
| `logoStandardizedAt` | `logo_standardized_at` | `TIMESTAMPTZ NULL` | Có giá trị khi logo mới/thay thế đã vượt qua toàn bộ chuẩn logo; `NULL` giữ nghĩa logo legacy/chưa chuẩn hóa. Migration `V1064` không sửa 18 logo cũ. |

Logo mới/thay thế nhận JPEG/JPG, PNG hoặc WebP; không còn trần dung lượng riêng cho logo,
kích thước tối thiểu 400×400, tỉ lệ nằm trong ±1% của 1:1. Ảnh có một chiều nhỏ hơn 400
bị chặn; ảnh chưa vuông được cắt trong admin bằng vùng vuông admin chọn; server chỉ kiểm tra
bản cuối, không tự cắt hoặc đệm. Nền trong suốt không còn là điều kiện chặn: logo không có
alpha được lưu nhưng quality trả về cảnh báo. Logo cũ được grandfathered khi URL không đổi:
vẫn trả về bình thường, không bị chặn khi sửa field khác. Nếu media legacy không còn đọc/đo
được, admin quality dùng `TRANSPARENCY_UNVERIFIED` thay vì đoán là nền đặc.

Admin Brand response thêm field tùy chọn `logoQuality` (public Brand response không trả field
này): `{ status, issues[], width, height, fileSize, mimeType, transparent, ratio }`.
`status` là `MISSING`, `LEGACY`, `VALID` hoặc `INVALID`; `issues[]` dùng các mã ổn định
`MISSING_LOGO`, `LEGACY_LOGO`, `NOT_SQUARE`, `TOO_SMALL`, `UNSUPPORTED_TYPE`,
`NOT_TRANSPARENT`, `TRANSPARENCY_UNVERIFIED` và `MEDIA_UNAVAILABLE`. `NOT_TRANSPARENT` chỉ
là cảnh báo chất lượng, không phải lỗi khóa lưu. Đây là dữ liệu cảnh
báo/hiển thị, không phải cờ khóa việc sửa Brand.

Status: `OWNER_CONFIRMED_2026-08-29` — `BrandEntity.logoStandardizedAt`, `ImageAssetRequest.mediaId`,
`BrandLogoValidationService`, migration `V1064__add_brand_logo_standardized_at.sql`.

### English URL slug — `slug_en` (V213 categories / V214 products / V216 articles)

Mỗi danh mục / sản phẩm / **bài viết** có thêm cột `slug_en VARCHAR(100)` **nullable** đang hoạt động.
Brand từng có `slug_en` (V215) nhưng chỉ là legacy compatibility, không entity nào có dữ liệu khác
`NULL` (không ghi/sửa qua admin, response brand không dùng nó làm slug điều hướng) — cột đã bị **xoá
hẳn khỏi DB** ở `V352` cùng `name_en`, xem mục **"Brand bilingual content"** bên trên. Brand hiện chỉ
còn 1 cột tên (`name`) và 1 cột slug (`slug`), không tách VI/EN.

| Bảng | Cột VI (canonical) | Cột EN | Migration |
|---|---|---|---|
| `categories` | `slug` | `slug_en` | `V213` |
| `products` | `slug` | `slug_en` | `V214` |
| `articles` | `slug` | `slug_en` | `V216` |

**Index:** mỗi bảng có **partial-unique index** `ux_<bảng>_slug_en ON <bảng> (slug_en) WHERE slug_en IS NOT NULL` — cho phép nhiều `NULL`, chặn trùng `slug_en` (en-vs-en) ở tầng DB.

**Uniqueness chéo cột (vi-vs-en):** `slug_en` **không được trùng** bất kỳ `slug` (vi) nào cùng loại, và `slug` vi mới không được trùng `slug_en` đang tồn tại. Ràng buộc này **enforce ở tầng ứng dụng** (`AdminCatalogMutationService.validate*` cho catalog; `AdminContentMutationService.validateArticleRequest` cho bài viết) — DB chỉ lo en-vs-en. Lý do: tránh `/.../x/` mơ hồ khi `x` vừa là slug vi của entity này vừa là slug en của entity khác.

**Lookup:** public read tra cứu theo **vi HOẶC en** slug (`findBySlug(slug).or(() -> findBySlugEn(slug))` — ưu tiên khớp vi trước cho tất định) nên cả hai URL mở cùng entity. Brand chỉ có `findBySlug` — không còn overload theo `slug_en`.

**Response:** domain record của category/product/article trả cả `slug` (canonical vi, không đổi theo locale) lẫn `slugEn` (nullable). Web dùng `slug` cho canonical + `slugEn` cho URL/hreflang tiếng Anh; `slugEn` trống → URL EN lùi về `slug` vi. `Brand`/`BrandSummary` domain record **không có field `slugEn`** (đã bỏ hẳn cùng `V352`); web luôn dùng `brand.slug` cho mọi locale. Mọi `CategorySummary` trong `category` và `categories[]` đều mang `slugEn`, `visible`, `deleted`; `category` là phần tử đầu của danh sách có thứ tự để breadcrumb PDP điều hướng đúng URL EN và chỉ tạo liên kết khi danh mục còn công khai.

**Redirect:** catalog danh mục/sản phẩm/bài viết đổi/xoá `slug_en` tự sinh 301 (`autoCreateSlugRedirect`/`autoCreateSlugEnRedirect`) — đổi → old-EN-URL→new-EN-URL; xoá → old-EN-URL→slug VI trong cùng locale; honored runtime bởi `bigbike-web/proxy.ts` qua `/api/internal/redirect`. Từ 2026-08-03, chi tiết sản phẩm EN dùng `/en/product/`, bài viết EN dùng `/en/tin-tuc/`; các alias cũ `/en/products/{slug}` và `/en/news...` redirect 301 tương thích, trong khi danh sách sản phẩm vẫn là `/en/products/` và danh mục vẫn dùng `/en/categories/`. Mọi redirect danh mục VI mới dùng `/danh-muc/{slug}/`; nguồn `/danh-muc-san-pham/{slug}/` cũ được giữ làm tương thích 301. Brand không có khái niệm slug EN nên không sinh redirect riêng. **Bài viết trước 2026-07-24 KHÔNG có cơ chế redirect** (module nội dung chưa wiring `SlugRedirectHelper`) — từ 2026-07-24 đã bổ sung, hành vi giờ đồng nhất với Sản phẩm/Danh mục.

**Ngoài phạm vi:** module pages/CMS vẫn đã gỡ. Web định tuyến tám route bằng slug cố định. Từ 2026-08-23, tiêu đề/thân bài Bảo hành và Đổi trả là bốn row allowlist trong `site_settings` nhóm `store_policy`, dùng chung cho endpoint policy và Trợ lý BigBike; các trang còn lại vẫn tĩnh.

Status: `CONFIRMED_FROM_CODE` — `CategoryEntity`/`ProductEntity`/`ArticleEntity` (`slugEn`), `*JpaRepository.findBySlugEn` (category/product/article only — `BrandJpaRepository` has no such method), `JpaCatalogReadRepository`/`JpaContentReadRepository` (map active `slugEn` + OR-resolve), `AdminCatalogMutationService`/`AdminContentMutationService` (validate), migrations `V213`/`V214`/`V216`; brand `name_en`/`slug_en` dropped by `V352`.

### Redirects table (`redirects`)

Stores admin-managed URL-redirect rules, independent from the `slug_en`-triggered auto-redirect described above (that feature writes into this same table via `autoCreateSlugRedirect`, but most rows are created directly by admins through `AdminRedirectController`).

| Column | Type | Notes |
|---|---|---|
| `source_pattern` | `VARCHAR(1024)` | The old/legacy exact internal path. **Case-sensitive, stored without trailing slashes** (except root `/`), and never contains a scheme/host, query or fragment — canonicalized by `AdminRedirectService` at write time. A locale-prefixed source such as `/en/categories/old-slug` remains locale-prefixed and is looked up before the neutral Vietnamese alias by `bigbike-web/proxy.ts`. Unique (`uq_redirects_source_pattern`, `V80`). |
| `target_url` | `VARCHAR(2048)` | Destination — either an internal path (`/...`) or an absolute `http(s)://` URL whose host must match `bigbike.site.base-url` (open-redirect protection, see `REDIRECT_RULE_004`). Protocol-relative (`//...`) and non-http(s) schemes are rejected. Always the fully-resolved final destination — `AdminRedirectService` auto-collapses any chain through another enabled rule at write time (`REDIRECT_RULE_010`), so this column never points at another rule's `source_pattern`. |
| `enabled` | `BOOLEAN` | Disabled rules are skipped by the internal lookup. |
| `status_code` | `INTEGER` | `301` (default) or `410`. A `410` rule is terminal and is served as Gone rather than redirecting to `target_url`. |
| `hit_count` / `last_hit_at` | `INT` / `TIMESTAMP` | Incremented fire-and-forget by `bigbike-web/proxy.ts` after a served redirect. |

`legacy_id` (WordPress migration provenance) and `notes` (free-text admin note) were dropped by
`V379__drop_redirect_notes_legacy_id.sql` (owner decision 2026-08-08) — neither was read by the
live redirect-serving path, only by the admin screen.

**Normalization policy** (`AdminRedirectService`, applied before persistence and the uniqueness/loop checks): case-sensitive (matches `bigbike-web/proxy.ts`'s pathname lookup and PostgreSQL text equality), all trailing slashes stripped except for root `/`. `/Foo` and `/foo` remain distinct; `/foo`, `/foo/` and `/foo///` are the same source. Loop comparison uses the target pathname, so `/foo?campaign=old`, `/foo#section` and an absolute same-site URL ending in `/foo` are still self-loops for source `/foo`.

**Redirect behavior:** dòng `status_code = 301` được phục vụ bằng HTTP 301; dòng
`status_code = 410` được proxy chuyển sang trang Gone song ngữ và không đọc
`target_url`. `redirect_type` vẫn không tồn tại; `status_code` được bổ sung lại
ở `V1023__redirect_and_discontinued_catalog_rules.sql` với check constraint chỉ cho `301` hoặc `410`.
Hit tracking chỉ áp dụng cho redirect 301 đã gửi thành công. Từ `REDIRECT_RULE_011`,
mọi 301 trỏ vào `/product/` phải resolve được tới sản phẩm `PUBLISHED` và
`discontinued = false`; mọi 301 trỏ vào danh mục phải resolve được tới danh mục
`visible` và chưa `deleted`. `available = false` không làm sản phẩm không hợp lệ.
`410` không áp dụng guard này vì là đích kết thúc.

**Business rules enforced in `AdminRedirectService`** (see BUSINESS_RULES.md `REDIRECT_RULE_001`–`006` for the authoritative list): self-redirect prevention, multi-hop loop detection (max chain depth 20, walked via `redirectRepo.findBySourcePattern`), source-pattern uniqueness, open-redirect protection, status code limited to HTTP 301/410, and hit-count tracking for 301.

**Migration-seeded data:** `V106__import_legacy_wp_redirects.sql` inserts reviewed paths directly. Historical runtime imports accidentally persisted 49 PHP-serialized RankMath `sources` values as one unusable source each; `V377__repair_serialized_redirect_sources.sql` expands their 72 exact patterns, keeps already-existing canonical rows on conflict, inserts the 14 missing paths, then removes the 49 unusable serialized rows. The storefront proxy still fails closed on unsafe/off-domain targets and direct loops because legacy rows did not necessarily pass the admin validator.

Status: `CONFIRMED_FROM_CODE_AND_RUNTIME_DATA_2026-08-07` — `RedirectEntity.java`, `AdminRedirectService.java`, `bigbike-web/proxy.ts`, `V4__create_media_redirect_menu_tables.sql`, `V80__add_redirect_source_pattern_unique.sql`, `V106__import_legacy_wp_redirects.sql`, `V377__repair_serialized_redirect_sources.sql`.

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
| `author_name` | `author_name_en` | `VARCHAR(255)` |

Fallback: giống `PRODUCT_RULE_002` — mỗi trường lùi về VI khi EN bị null/blank. Tác giả là trường tùy chọn; cả hai bản trống thì không sinh byline hoặc JSON-LD `author`. Xem `ARTICLE_RULE_001/002/007`.

**Slug tiếng Anh (`slug_en`, V216):** xem mục **"English URL slug"** bên trên — `slug` tiếng Việt là canonical, `slug_en` là URL tiếng Anh tùy chọn (không sinh redirect).

Status: `CONFIRMED_FROM_CODE` — `ArticleEntity`, `ArticleTranslations` domain record, migration `V138`.

### Article featured + seo_no_index (V222)

Migration `V222__add_article_featured_and_seo_no_index.sql` thêm 2 cột boolean vào bảng `articles`:

| Cột | Kiểu | Default | Map ra payload | Ý nghĩa |
|---|---|---|---|---|
| `featured` | `BOOLEAN NOT NULL` | `false` | top-level `featured` | Đánh dấu "Tin nổi bật" — điều khiển widget Tin nổi bật trên web và query param `featured=true` của `GET /api/v1/articles`. |
| `seo_no_index` | `BOOLEAN NOT NULL` | `false` | `seo.noIndex` | `true` = đặt `noindex` cho bài viết (không cho search engine index trang chi tiết). |

**Lưu ý lịch sử — `articles.seo_no_index`:** cột này từng tồn tại ở `V1` nhưng bị **DROP** ở `V152` (chưa dùng đến). `V222` **tái thêm** để dùng thật trong contract per-article SEO noindex.

> **Đã mở rộng ở `V371`** — xem §"SEO noindex theo từng ngôn ngữ (V371)" bên dưới. Từ `V371`, `articles.seo_no_index` là cờ của **riêng bản tiếng Việt**; bản tiếng Anh dùng cột mới `seo_no_index_en`.

Status: `CONFIRMED_FROM_CODE` — `ArticleEntity.featured`, `ArticleEntity.seoNoIndex`, migration `V222__add_article_featured_and_seo_no_index.sql` (ghi chú: cột `seo_no_index` từng bị drop ở `V152`). Xem [API_CONTRACT.md](API_CONTRACT.md) §"Article payload — featured + seo.noIndex (V222)".

### SEO noindex theo từng ngôn ngữ (V371)

Migration `V371__add_seo_no_index_per_locale.sql` đưa cờ "cho Google hiển thị" về đủ 4 loại
thực thể và **tách theo ngôn ngữ**. Rule nghiệp vụ: [BUSINESS_RULES.md](../business/BUSINESS_RULES.md)
`SEO_RULE_001` (cờ thủ công) và `SEO_RULE_002` (ngưỡng đủ nội dung EN).

| Bảng | Cột thêm ở V371 | Kiểu | Default |
|---|---|---|---|
| `products` | `seo_no_index`, `seo_no_index_en` | `BOOLEAN NOT NULL` | `false` |
| `categories` | `seo_no_index`, `seo_no_index_en` | `BOOLEAN NOT NULL` | `false` |
| `brands` | `seo_no_index`, `seo_no_index_en` | `BOOLEAN NOT NULL` | `false` |
| `articles` | `seo_no_index_en` *(cột `seo_no_index` đã có từ `V222`)* | `BOOLEAN NOT NULL` | `false` |

Lịch sử đầy đủ của họ cột này: `V1` (5 bảng, nullable, chưa dùng) → `V152` DROP toàn bộ →
`V222` khôi phục riêng `articles` → `V371` khôi phục đủ 4 loại và tách VI/EN.

**Không backfill.** Ngưỡng "đủ nội dung tiếng Anh" (`SEO_RULE_002`) được **tính động từ dữ liệu**
tại thời điểm đọc, không lưu thành cột. Nhờ vậy bản dịch mới tạo tự động ở trạng thái ẩn cho tới
khi có nội dung, và dịch xong là tự hiện. Hai cột trên là lớp **ghi đè thủ công** thêm vào.

**Cách map ra payload** — trường `seo.noIndex` trong response là **giá trị đã resolve theo `lang`
của request**, không phải giá trị thô của cột:

| `lang` | `seo.noIndex` = |
|---|---|
| `vi` | `seo_no_index` |
| `en` | `seo_no_index_en` **OR NOT** (đủ nội dung EN theo `SEO_RULE_002`) |

Cột dùng để xét ngưỡng EN: sản phẩm `name_en` + (`short_description_en` \| `description_en`);
danh mục `name_en` + (`description_en` \| `intro_content_en`); bài viết `title_en` + `body_en`;
thương hiệu `description_en` (bảng `brands` không có `name_en`/`slug_en` — đã DROP ở `V352`).
**`slug_en` không tham gia ngưỡng.**

Status: `CONFIRMED_FROM_CODE` — migration `V371__add_seo_no_index_per_locale.sql`,
`ProductEntity`/`CategoryEntity`/`BrandEntity`/`ArticleEntity`, `SeoIndexPolicy.java`,
`JpaCatalogReadSupport.toSeoMeta`, `ArticleMapper`. Xem [API_CONTRACT.md](API_CONTRACT.md)
§"SEO `noIndex` cho cả 4 loại (V371)".

### SEO title/description text contract (2026-08-20)

Các cột `seo_title`/`seo_title_en` và `seo_description`/`seo_description_en` là metadata
chữ thuần, không phải trường HTML. Backend từ chối thẻ markup trong `SeoMetaRequest` với
`400 VALIDATION_ERROR`; nội dung rich-text của `description`, `short_description`, `body` và
các block tương ứng vẫn được lưu ở trường riêng theo contract của từng entity.

Khi public web dùng fallback từ một trường rich-text vì SEO description đang trống, web phải
chuyển thành chữ thuần trước khi dựng `<meta name="description">`, Open Graph và Twitter. Giá
trị công khai được chuẩn hóa còn tối đa 165 ký tự ở ranh giới từ; giá trị rỗng sau chuẩn hóa
được xử lý như thiếu metadata. Quy tắc này không thay đổi fallback song ngữ từng trường và
không cho phép ghi nội dung tiếng Việt vào cột `_en` thay cho bản dịch thủ công.

Status: `CONFIRMED_FROM_OWNER_REQUEST_AND_CODE` — `SeoMetaRequest`,
`AdminMutationValidators.validateSeoMeta`, `bigbike-web/lib/seo/metadata.ts`,
`BUSINESS_RULES.md` `SEO_RULE_009`.

### Article home_experience (V272)

Migration `V272__add_article_home_experience.sql` thêm 1 cột boolean vào bảng `articles`:

| Cột | Kiểu | Default | Map ra payload | Ý nghĩa |
|---|---|---|---|---|
| `home_experience` | `BOOLEAN NOT NULL` | `false` | top-level `homeExperience` | Admin chọn tay bài vào carousel "Góc trải nghiệm cùng BigBike" trên trang chủ — điều khiển query param `homeExperience=true` của `GET /api/v1/articles`. |

Trang chủ hiển thị tối đa 3 bài có `home_experience = true` (mới nhất trước). Khi **không** bài nào được chọn, web fall back về 3 bài viết mới nhất bất kỳ (logic ở `app/page.tsx`, xem [API_CONTRACT.md](API_CONTRACT.md) §"Article list — homeExperience (V272)"). Trước V275 fallback lấy theo category `reviews`; sau khi gộp nhóm còn 1 "Tin tức" thì lấy bài mới nhất bất kỳ.

Status: `CONFIRMED_FROM_CODE` — `ArticleEntity.homeExperience`, migration `V272__add_article_home_experience.sql`. Xem [API_CONTRACT.md](API_CONTRACT.md) §"Article payload — featured + seo.noIndex (V222)".

### Content categories — REMOVED (V368)

Owner decision 2026-08-03: xóa toàn bộ chức năng danh mục nội dung. Forward migration `V368__drop_content_categories.sql` detach mọi bài viết rồi xóa `articles.category_id`, `article_category_map` và `content_categories` cùng foreign key/index liên quan. Không sửa migration lịch sử V275; rollback yêu cầu restore snapshot target trước migration. `article_tags` và danh mục sản phẩm không bị ảnh hưởng.

Hệ quả contract: bài viết không còn category ở entity/request/response, API list không còn query filter `category`, storefront không còn sidebar/drawer/label category và importer không tạo content category.

### Page bilingual content — REMOVED (2026-06-24)

> **REMOVED (2026-06-24).** Bảng `pages` đã drop ở `V271__drop_pages_and_guide_page.sql` cùng entity `PageEntity` / domain `Page` / `PageTranslations` / enum `PageType`. Các cột song ngữ `_en` của trang (title/body/hero_*/seo_*, thêm ở `V138`) không còn. 8 route thông tin/chính sách hiện hành là **nội dung tĩnh trong `bigbike-web`**; trong đó có đúng 3 trang chính sách cố định — không còn dữ liệu trang trong DB. Bài viết (`articles`) vẫn giữ cột song ngữ — xem §"Article bilingual content (V138)".

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
(`GET /api/v1/admin/menus/...`) trả thêm `labelEn` thô để editor sửa song ngữ. Cột
`cssClass`/`status` không dịch. Cột `url` **không có bản `_en` riêng** nhưng có thể
được **resolve động** theo `lang` khi mục liên kết danh mục (`target_type=CATEGORY`)
— xem §"Menu item nhãn & URL tự resolve theo danh mục" trong `API_CONTRACT.md`.

**Mục liên kết danh mục (`target_type=CATEGORY`) — `label`/`label_en`/`url` là
snapshot fallback, không phải giá trị hiển thị thật:** khi còn liên kết hợp lệ,
mọi lần đọc (public lẫn admin) đều tính lại `label`/`label_en`/`url` **live** từ
`CategoryEntity.name/name_en/slug/slug_en` — bỏ qua giá trị 3 cột này trong DB.
3 cột trên vẫn được ghi lại (snapshot) mỗi lần tạo/sửa mục menu, nhưng chỉ dùng
làm **fallback** khi danh mục liên kết đã bị xóa; admin **không sửa tay** được
`label`/`labelEn`/`url` của mục CATEGORY-linked qua UI (chỉ chọn lại danh mục).

Status: `CONFIRMED_FROM_CODE` — `MenuItemEntity.labelEn`, `AdminMenuService` (pick
locale + `getPublicMenuByLocation(location, lang)` + `resolveDisplayLabel`/
`resolveDisplayUrl`/`toAdminItemResponse`), migration `V160`.

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

`articles.body_blocks` là cột `jsonb` thêm vào trong migration `V140`. Cột này lưu mảng block có cấu trúc và dùng chung Java `DescriptionBlock` hierarchy để deserialize/render dữ liệu, nhưng là vocabulary riêng cho bài viết/content, không phải menu mô tả sản phẩm hiện hành.

7 block type cho bài viết/content: `heading`, `paragraph`, `list`, `image`, `video`, `callout`, `divider`.

Admin hiện cho tạo mới `heading`, `paragraph`, `list`, `image`, `video`; các type khác vẫn được đọc/render để tương thích dữ liệu cũ. Khối `video` tuân theo `MEDIA_RULE_004`: request ghi chỉ nhận `provider` `youtube|upload`, URL YouTube phải hợp lệ và `upload` phải là media nội bộ. TikTok/Facebook chỉ còn là dữ liệu legacy trên đường đọc/render; khi gửi lại `bodyBlocks`, mọi khối video legacy phải được thay nguồn.

**Migration (V141):** HTML cũ trong cột `body` của tất cả article đã được parse sang blocks bởi `BodyBlockParser` khi chạy migration. Parser ánh xạ từng top-level HTML element sang block type gần nhất. Element không nhận dạng được trở thành fallback `paragraph` (outerHTML được giữ nguyên).

**Read behavior:** Admin detail read trả về `bodyBlocks` trong `AdminContentItem`. Public read (`GET /api/v1/articles/{slug}`) vẫn chỉ đọc `body` HTML — không thay đổi contract web.

**Mutation semantics (presence flag):**
- Key `bodyBlocks` có mặt trong request → render blocks → ghi đè cả `body_blocks` lẫn `body`.
- Key `bodyBlocks` vắng mặt → `body` được cập nhật bình thường; `body_blocks` không bị đụng.
- Array rỗng `[]` → `body_blocks` = `[]`; `body` = `""`.

Status: `CONFIRMED_FROM_CODE` — `ArticleEntity.bodyBlocks`, `Article.bodyBlocks`, `AdminContentItem.bodyBlocks`, `UpsertArticleRequest.bodyBlocksPresent`, `AdminContentMutationService.applyArticlePatch`, migration `V140/V141`.

### Page body blocks — REMOVED (2026-06-24)

> **REMOVED (2026-06-24).** Cột `pages.body_blocks` (V140) cùng cả bảng `pages` đã drop ở `V271`. Module pages đã gỡ; trang thông tin nay tĩnh ở web. Article body blocks vẫn còn — xem §"Article body blocks (V140)".

### Contact page layout — đã gỡ (`contact_page_layout`, V224 → drop V270)

Trang `/lien-he` nay là **trang tĩnh**: bố cục cố định trong code web, không còn bảng layout do admin quản lý. Bảng singleton `contact_page_layout` (V224) đã bị **drop ở `V270`**; toàn bộ Java mapping (entity/repository/converter/service/controllers) đã gỡ. Thông tin liên hệ (hotline/địa chỉ/giờ/URL mạng xã hội) vẫn ở `site_settings` nhóm `contact` (single source dùng chung header/trang chủ/trang sản phẩm/`/lien-he`/`/gioi-thieu`/khung chat/trang xác nhận đơn hàng) — xem §"Site settings groups". **Không còn dùng chung với footer từ 2026-07-03**: `WpFooter.tsx` hardcode riêng bản sao của các giá trị này (quyết định chủ shop) — sửa nhóm `contact` ở Cài đặt không còn cập nhật footer.

Status: `CONFIRMED_FROM_CODE` — `bigbike-web/app/lien-he/page.tsx`, `bigbike-web/components/contact/ContactPageContent.tsx`, migration `V270__drop_contact_page_layout.sql`.

### Guide page layout — REMOVED (2026-06-24)

> **REMOVED (2026-06-24).** Bảng singleton `guide_page_layout` (V227) đã drop ở `V271__drop_pages_and_guide_page.sql` cùng entity `GuidePageLayoutEntity` / `GuideEntry` / `GuideEntriesConverter` / `GuidePageService`. Trang Hướng dẫn `/huong-dan` (+ đúng 2 trang con `size-mu`/`size-trang-phuc`) nay là **nội dung tĩnh trong `bigbike-web`**. Trình dựng trang Hướng dẫn trong admin cũng đã gỡ.

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
> **Vẫn còn:** hero của các **trang danh sách** (`/san-pham`, `/brands`, `/tin-tuc`) — lưu ở `SiteSettingEntity` nhóm `public_hero`, quản lý qua màn **Banner trang** (`BannerScreen.jsx`). Mỗi Hero chỉ quản lý một ảnh nền desktop; website dùng lại ảnh đó ở mobile với responsive CSS. Các key cũ `hero_*_mobile_image_url` vẫn được giữ trong dữ liệu và API để tương thích, nhưng không được hiển thị, sửa trong admin hoặc render trên web. Đó là cơ chế riêng, không liên quan tới bảng `pages`.

### Article ↔ Product relation — REMOVED (V167)

> **REMOVED (V167).** Tính năng gắn sản phẩm liên quan vào bài viết đã bị gỡ. Bảng join `article_product_map` (thêm ở `V130__add_article_product_map.sql`) đã bị drop ở `V167__drop_article_product_map.sql`. Code hiện tại không còn `Article.relatedProducts`, `AdminContentItem.relatedProducts`, hay `UpsertArticleRequest.productIds`. Legacy `articles.product_image_url` / `product_image_alt` columns (single decorative thumbnail) không liên quan đến tính năng này và vẫn giữ nguyên.
>
> Đây là tính năng **khác** với Product `relatedProducts` (`product_related_product_map`, V135) ở section trên — cái đó vẫn còn sống.

Status: `CONFIRMED_FROM_CODE` — `V167__drop_article_product_map.sql`, `Article.java` (no `relatedProducts`), `UpsertArticleRequest.java` (no `productIds`), `AdminContentItem` (no `relatedProducts`).

### Catalog facets response shape

Read-only aggregation served by `GET /api/v1/catalog/facets` (see [API_CONTRACT.md](API_CONTRACT.md#catalog-facets-contract)). Counts are computed from the catalog read model; color/finish classification is read from the data-driven visual-facet tables below.

`CatalogFacets`:
| Field | Type | Purpose |
|---|---|---|
| `categories` | `FacetBucket[]` | One bucket per visible category. |
| `brands` | `FacetBucket[]` | One bucket per visible brand; `image` carries the brand logo. |
| `colors` | `FacetBucket[]` | Configured base colors only; `swatch` carries the configured dot color. |
| `finishes` | `FacetBucket[]` | Configured finish buckets; empty when the context has no mapped finish. |
| `availability` | `FacetBucket \| null` | The single `in-stock` bucket/count. |
| `genders` | `FacetBucket[]` | Fixed Nam/Nữ buckets (V1030). A product with both flags contributes to both buckets; only genders with `count > 0` are included. |
| `sizes` | `FacetBucket[]` | Dynamic variant-size buckets. Values are normalized for display (`XXXL` → `3XL`) and only buckets with `count > 0` are included. |
| `sizeGroups` | `SizeGroupFacet[]` | Ordered configured size groups and namespaced values. |
| `priceRange` | `PriceRange | null` | Actual effective-price extent and dynamic density buckets for the current non-price facet context; null when no product or only one distinct effective price exists. |
| `resultCount` | `long` | Unique products matching the full active context. |
| `resolvedColorKeys` | `string[]` | Canonical base-color keys resolved from current/legacy color query values; empty when every supplied value is intentionally outside the public color vocabulary. |

`FacetBucket`: `{ key: string, label: string, image: ImageAsset | null, swatch: string | null, count: long }` — `image` may be populated for category/brand buckets; `swatch` only for colors.

`PriceRange`: `{ minPrice: long, maxPrice: long, step: long, buckets: PriceHistogramBucket[] }`.

`PriceHistogramBucket`: `{ minPrice: long, maxPrice: long, count: long }`. The range endpoints are the true minimum/maximum effective sale prices after category/search/brand/color/gender/size context, before the active price filter. `step` is `50,000` VND for wire compatibility; the public web does not count display ticks from the true minimum, but derives round intervals from price bands and histogram density, with an open-ended final display tick when the density cap excludes a long tail. There are at most 24 equal-width histogram buckets, including zero-count buckets. Effective sale price is used only when `salePrice > 0` and `salePrice < retailPrice`; otherwise retail price is used. Typed public bounds remain exact integers and are not snapped to `step`. `CONFIRMED_FROM_OWNER_DECISION_2026-08-14_REFINED_2026-08-15`

### Catalog visual facet configuration (V1033, owner decision 2026-08-15)

`catalog_visual_facets` stores the public color/finish vocabulary:

| Column | Type | Constraint / purpose |
|---|---|---|
| `facet_type` | `VARCHAR(20)` | `COLOR` or `FINISH`; part of PK. |
| `facet_key` | `VARCHAR(80)` | Stable public query key; part of PK. |
| `label_vi`, `label_en` | `VARCHAR(120)` | Required bilingual labels. |
| `swatch` | `VARCHAR(7)` nullable | `#RRGGBB`, allowed only for `COLOR`. |
| `sort_order` | `INTEGER` | Stable display order. |
| `active` | `BOOLEAN` | Inactive rows do not classify or appear. |

`catalog_visual_alias_mappings` is a many-to-many mapping from a normalized raw
variant-color alias to a configured facet:

| Column | Type | Constraint / purpose |
|---|---|---|
| `alias_key` | `VARCHAR(160)` | Normalized legacy/raw option key; part of PK. |
| `facet_type`, `facet_key` | `VARCHAR` | FK to `catalog_visual_facets`; part of PK. |

One alias may map to several base colors and one or more finishes. Raw product
variant data is unchanged. Unknown aliases have no mapping, never create a
bucket, and are surfaced only by the owner audit query. Adding a color, finish
or alias therefore requires data configuration but no code deployment.

Status: `CONFIRMED_FROM_OWNER_DECISION_2026-08-15` — `BUSINESS_RULES.md`
`CATALOG_RULE_006`–`CATALOG_RULE_010`.

### customers / customer_addresses — account page fields (V127)

| Table | Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|---|
| `customer_addresses` | `email` | `VARCHAR(255)` | YES | `null` | Per-address contact email; backs the "Email" field on the address book popup |

### customers — avatar_url (V346, owner decision 2026-07-21)

| Table | Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|---|
| `customers` | `avatar_url` | `VARCHAR(500)` | YES | `null` | Either a MinIO object URL (`/media/customers/{customerId}/...`) for a self-uploaded avatar, **or** — OAuth-imported avatars only — a raw external hotlink to the Google/Facebook CDN (see below). `null` = no avatar — storefront (account sidebar, header, reviews) and admin customer detail all render a generated circular initials badge in that case. A generated default badge is never itself stored as a MinIO object. |

Two paths ever write a non-null value:

1. `CustomerAvatarStorageService.store(MultipartFile)`, called from `POST /api/v1/customer/me/avatar` (direct upload) — always a MinIO object URL, never a client-supplied string (contrast with `reviews.photos`, which does accept client-supplied MinIO URLs from a separate upload step). Refused with `403` when the customer has any `customer_oauth_links` row (CUSTOMER_RULE_010, below) — a social-account customer never reaches this path.
2. `CustomerOAuthService.syncProfileFromProvider` (added 2026-08-07, revised same day — **owner-approved exception** to the project's MinIO-only media rule, scoped to this field only — `BUSINESS_RULES.md` MEDIA_RULE_005 / CUSTOMER_RULE_010), called on **every** OAuth login — account creation, first link, and every repeat sign-in via `touchLogin` — not just once. It sets the column to the provider's `picture` URL **as-is, a hotlink to `*.googleusercontent.com`/`*.fbcdn.net`/`platform-lookaside.fbsbx.com`, not a MinIO object**; no server-side fetch happens. Because a social account's profile has no self-service edit path (CUSTOMER_RULE_010), this sync-on-every-login IS the only update mechanism — change the photo on Google/Facebook, it lands here on next sign-in. When the provider stops returning a photo (Facebook's `is_silhouette` placeholder, or Google briefly erroring), the column is cleared back to `null`, mirroring self-removal. Known trade-off: the hotlink itself can go stale/break between logins if the provider rotates the URL or the customer changes photo visibility — nothing refreshes it until the next login. `bigbike-web`'s `next.config.ts` `images.remotePatterns` allowlists those three provider CDN hostnames so `next/image` renders the hotlink.

Removal (self-service `DELETE /api/v1/customer/me/avatar` — also refused with `403` for a social account, or admin `DELETE /api/v1/admin/customers/{id}/avatar`, unaffected) nulls the column either way; the best-effort MinIO delete only ever matches (and only ever runs against) a `/media/customers/...` URL, so it silently no-ops for an OAuth hotlink.

`reviews.customer_id` (pre-existing, previously always `null`) is now populated when the submitter had a valid session at submit time — see `BUSINESS_RULES.md` review rules and `API_CONTRACT.md`'s Public Reviews Contract. `authorAvatarUrl` on the public reviews read path is resolved by joining this column back to `customers.avatar_url` live at read time (no denormalized snapshot column on `reviews`).

Evidence: `V346__add_customer_avatar_url.sql`, `CustomerEntity.java`, `CustomerAvatarStorageService.java`, `CustomerOAuthService.java`, `next.config.ts`.

### Order line-item thumbnail — `productThumbnailUrl` (response-only, no DB column)

`OrderLineItemResponse.productThumbnailUrl` (`String`, nullable) backs the product thumbnail
in both the customer and admin order-detail views. Its value prefers the `image_url` snapshot
stored on `order_line_items` at checkout (AUD-038, V340), so a later catalog image change does
not alter the image shown for a new order. For legacy rows whose snapshot is `null` or blank,
both read paths batch-resolve the current product `image_url` by `product_pk` in one query; this
is a presentational fallback only and returns `null` when the product no longer exists or has no
image. The shared resolver avoids an N+1 product lookup.

Evidence: `CheckoutSupport`, `OrderLineItemThumbnailResolver`,
`ProductJpaRepository.findImageUrlsByIds`.

### order_line_items — `product_variant_pk` (V158)

| Table | Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|---|
| `order_line_items` | `product_variant_pk` | `VARCHAR(64)` | YES | `null` | Varchar snapshot of `product_variants.id` for the line's variant. Variant-side counterpart of `product_pk` (V74). |

`product_variants.id` is a varchar string PK (`wp-var-*` for migrated WordPress catalog,
`var_<hex>` for admin-created), so the legacy UUID column `product_variant_id` is `null` for
every non-UUID variant — the same UUID/varchar mismatch V74 fixed on the product side. Resolve
the variant from a line by **`product_variant_id` (UUID) first, then `product_variant_pk`** — see
`OrderLineItemEntity.resolveVariantKey()` (and `resolveProductKey()` for the product side). This varchar PK still uniquely identifies the line's variant for snapshots. _(Since V261 inventory is a boolean availability toggle — there is no quantity decrement/restore, so the former stock-restore paths no longer run.)_

Snapshotted at line creation on the sell path that records the variant by its string id —
storefront cart-checkout (`CheckoutService.buildLineItemFromCart`, since V176). (The former POS sell path was removed 2026-06-23; the former quick-buy sell path was removed 2026-07-15.) Historical rows
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
| `customers` | `oauth_provider` | `VARCHAR(20)` | YES | `null` | **Superseded by `customer_oauth_links` (V378)** — kept in sync as a legacy mirror of the customer's most recent link |
| `customers` | `oauth_subject` | `VARCHAR(255)` | YES | `null` | **Superseded by `customer_oauth_links` (V378)** — legacy mirror |
| `customer_sessions` | `remember` | `BOOLEAN` | NO | `false` | Whether the session was created with "Ghi nhớ" — drives the refresh-cookie lifetime and is preserved across refresh-token rotation |

Partial unique index `ux_customers_oauth` on `(oauth_provider, oauth_subject)` where `oauth_provider IS NOT NULL` — prevents two accounts linking to the same provider identity.

### customer_oauth_links — one row per linked social identity (V378)

The single `(oauth_provider, oauth_subject)` pair on `customers` could hold only **one** provider,
so linking a second one silently overwrote the first and there was no way to list or unlink an
identity. V378 moves the identities to their own table; the V129 columns remain for backward
compatibility and are written alongside, to be dropped in a later migration.

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `id` | `UUID` | NO | — | PK |
| `customer_id` | `UUID` | NO | — | FK → `customers(id)` `ON DELETE CASCADE` |
| `provider` | `VARCHAR(20)` | NO | — | `google` / `facebook` |
| `subject` | `VARCHAR(255)` | NO | — | Stable provider-side user id (the OAuth `sub`) |
| `linked_at` | `TIMESTAMPTZ` | NO | `now()` | When the customer linked it |

- `ux_customer_oauth_links_identity` on `(provider, subject)` — one provider identity maps to at
  most one customer, the same guarantee `ux_customers_oauth` gave.
- `ux_customer_oauth_links_customer_provider` on `(customer_id, provider)` — a customer links each
  provider at most once.
- `idx_customer_oauth_links_customer` on `(customer_id)`.

The migration backfills from the V129 columns. It was a no-op on every environment at the time
(0 rows had `oauth_provider IS NOT NULL`).

**Who gets a row here (updated 2026-08-07, CUSTOMER_RULE_010):** `CustomerOAuthService.linkOrCreate`
only ever adds a link to a customer whose `password_hash IS NULL` — either a brand-new account
created for this OAuth login, or a pre-existing OAuth-only account matched by a verified email
(the mechanism that still lets Google and Facebook merge into one account with each other). A
customer that has a password is **never** given a row here by a new login, regardless of email
match — this supersedes the pre-2026-08-07 rule, which adopted a password account when its email
was verified. Existing rows created before this change (a password account that already picked up
a link under the old rule) are left as-is; the new rule only governs new links going forward.

**`existsByCustomerId(customer_id)` on this table is the single source of truth for
"is this customer's profile provider-managed"** — `CustomerAuthService.requireNotOauthManaged`
gates `PATCH /api/v1/customer/me` and both avatar endpoints on it, and `CustomerSummary.oauthManaged`
(API response field, added 2026-08-07) mirrors it for the frontend. A customer with ≥1 row here is
locked from self-editing regardless of whether `customers.password_hash` is also non-null (a
grandfathered pre-2026-08-07 merge) — see CUSTOMER_RULE_010.

**Known edge case — email-collision with a password account can prevent Google+Facebook from
merging with each other.** When a verified OAuth email matches an *existing password account*,
`linkOrCreate` creates a new OAuth-only customer with `email` set to `null` (to avoid colliding
with `customers_email_unique`, a partial unique index that still enforces uniqueness among non-null
emails table-wide — see `customers — avatar_url` section's sibling `V64__add_customer_email_phone_unique.sql`).
If the *other* social provider is later used with that same real email, its `findByEmail` lookup no
longer finds the first OAuth account (its `email` column is `null`), matches the password account
again instead, and — since that account has a password — falls through to creating a **third**,
still-separate customer. Net effect: a customer with a password account plus both Google and
Facebook sharing that same address ends up with 3 distinct customer rows, not the 2 (password +
one merged social) the rule would otherwise produce. Accepted trade-off, not a bug — narrow enough
in practice (requires all three identities to share one exact address) that a dedicated matching
column was judged not worth the added schema complexity.

### customer_privacy_consents — versioned evidence for new-account agreement (V1063)

`customer_privacy_consents` is append-only evidence that a **newly created** customer explicitly
agreed to the Privacy Policy. It is not an account-profile setting and does not retroactively
populate historical customers.

| Column | Type | Nullable | Default | Purpose |
|---|---|---|---|---|
| `id` | `UUID` | NO | `gen_random_uuid()` | PK |
| `customer_id` | `UUID` | NO | — | FK → `customers(id)` `ON DELETE CASCADE` |
| `policy_version` | `VARCHAR(32)` | NO | — | Server-owned published-policy version; first value is `2026-08-27` |
| `locale` | `VARCHAR(2)` | NO | — | Storefront language at acceptance: `vi` or `en` |
| `accepted_at` | `TIMESTAMPTZ` | NO | `now()` | Server time when the account was created |

- Unique `(customer_id, policy_version)` prevents duplicate evidence for the same version.
- `idx_customer_privacy_consents_customer` supports a future customer-data request without adding
  an admin screen in this scope.
- Registration and first-time OAuth creation insert this row in the same transaction as the
  customer. Existing account sign-in and first linking to an existing passwordless customer do not
  insert a row. See `CUSTOMER_RULE_011`.

### Dashboard KPI & Lists

`AdminDashboardSummaryResponse` contains the following sections:

#### KPI Block (`kpi` field of type `KpiResponse`)

| Field | Computation | Purpose |
|---|---|---|
| `todayRevenue` | `SUM(totalAmount)` excluding CANCELLED | Gross GMV placed today _(REFUNDED removed 2026-06-23, FAILED removed 2026-07-21)_ |
| `todayPaidRevenue` | `SUM(totalAmount)` where `status = 'COMPLETED'` | Recognized revenue from completed orders; response name retained for compatibility |
| `todayRevenuePct` | Percentage comparison between today's revenue and yesterday's revenue | Double percentage growth (null if yesterday has no data or zero revenue) |
| `todayOrders` | Count of orders placed today excluding CANCELLED | Volume of transactions today |
| `todayOrdersDelta` | Difference in order count between today and yesterday | Trend in order volume |
| `pendingOrders` | Count of orders with status `PENDING` | Active orders requiring admin action |
| `activeProducts` | Count of products with publish status `PUBLISHED` | Active catalog size |

#### Daily Revenue (`revenueData` field)
List of `RevenueDayResponse` objects representing the revenue series over the selected period:
- `date`: `String` (ISO date `yyyy-MM-dd` in Vietnam timezone)
- `revenue`: `BigDecimal` (gross daily revenue)
- `orders`: `int` (number of orders)

#### Order Status Breakdown (`orderStatusBreakdown` field)
List of `OrderStatusBreakdownItem` objects representing count of orders per status:
- `status`: `String` (order status name)
- `count`: `long` (number of orders)

#### Recent Orders (`recentOrders` field)
List of the last 5 `RecentOrderItem` objects:
- `id`: `UUID` (order ID)
- `orderNumber`: `String` (order reference number)
- `customerName`: `String` (customer name)
- `customerEmail`: `String` (customer email)
- `total`: `BigDecimal` (total order amount)
- `orderStatus`: `String` (status of the order)
- `currency`: `String` (currency code)
- `placedAt`: `Instant` (creation timestamp)

#### Top Products (`topProducts` field)
List of top 5 `TopProductItem` objects by revenue:
- `productId`: `String` (product primary key `product_pk` varchar, supports admin-created products)
- `name`: `String` (product name snapshot)
- `revenue`: `BigDecimal` (revenue generated)
- `units`: `long` (total units sold)

Status: `CONFIRMED_FROM_CODE`

Evidence: `AdminDashboardService.java`, `AdminDashboardSummaryResponse.java`

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

Evidence: `CustomerStatus.java`, `AdminCustomerService.ALLOWED_STATUSES`, `AdminCustomerService.deriveSegment()`

### Admin customer mutation and KPI projection (owner decision 2026-07-28)

- The admin mutation contract and OpenAPI expose only editable `displayName` and `phone`. The transport DTO temporarily retains `email`, `firstName`, and `lastName` only as forbidden-field sentinels so legacy/stale clients receive deterministic `400 VALIDATION_ERROR` instead of a silent ignored write. The persisted identity columns remain readable in admin detail but are not writable through the admin customer API.
- Synthetic rows (`is_synthetic = true`) use the same editable profile fields but cannot transition to a different account status.
- `AdminCustomerListItemResponse.orderCount` / `totalSpent` and `AdminCustomerOrderSummaryResponse.orderCount` / `totalSpent` / `avgOrderValue` / derived segment exclude `orders.status = 'CANCELLED'`.
- `AdminCustomerSummaryResponse.vip` uses the same non-cancelled lifetime-spend basis. `latestOrders`, `firstOrderAt`, and `lastOrderAt` remain full-history projections and may include cancelled orders.
- `AdminCustomerSummaryResponse.total` and `vip` include synthetic rows. `active` and `newLast30Days` describe registered accounts and exclude `is_synthetic = true`.

Status: `CONFIRMED_FROM_OWNER_DECISION`

Evidence: `CUSTOMER_RULE_004`, `CUSTOMER_RULE_006`–`CUSTOMER_RULE_008`, `AdminCustomerService.java`, `OrderJpaRepository.java`.

## Customer `isSynthetic` Flag

`customers.is_synthetic` (`BOOLEAN NOT NULL`) marks a customer row that was auto-created from a **guest order's billing metadata during the WordPress migration** — it never registered an account and has no password (`WordPressCustomerMapper.mapSynthetic`, called when a legacy guest order has no matching WP user). `isSynthetic = false` is every normal path: self-registration, admin-visible orders placed by a real account, and OAuth-linked accounts (`CustomerAuthService.java` explicitly sets `setSynthetic(false)` on registration/OAuth-create). There is no code path that flips the flag after creation.

Both `AdminCustomerListItemResponse.isSynthetic` and `AdminCustomerDetailResponse.isSynthetic` expose the flag to the admin API, and `GET /api/v1/admin/customers` accepts a `synthetic` boolean query filter (see API_CONTRACT.md "Customer Admin").

Status: `CONFIRMED_FROM_CODE`

Evidence: `CustomerEntity.java` (`is_synthetic` column), `WordPressCustomerMapper.java` (`mapSynthetic`), `CustomerImporter.java`, `CustomerAuthService.java` (`setSynthetic(false)`), `AdminCustomerListItemResponse.java`, `AdminCustomerDetailResponse.java`

## Customer Export CSV Contract

`GET /api/v1/admin/reports/customers/export` is an uncapped read projection over
`customers`. It accepts the same `q`, `status`, `synthetic`, and `emailVerified`
filters as `GET /api/v1/admin/customers`, streams all matching pages, and does not
apply the generic 10,000-row report limit.

The CSV columns, in order, are:

1. `id`
2. `email`
3. `phone`
4. `display_name`
5. `first_name`
6. `last_name`
7. `status`
8. `gender`
9. `email_verified_at`
10. `last_login_at`
11. `created_at`

Status: `CONFIRMED_FROM_OWNER_DECISION`

Evidence: `CUSTOMER_RULE_009`, `AdminCustomerCsvExportService.java`, `AdminReportController.java`.

## Reports Analytics Response Shape

`GET /api/v1/admin/reports/analytics` returns `AdminAnalyticsResponse`.

### PeriodSummary (summary field)

| Field | Type | Description |
|---|---|---|
| `grossOrderValue` | `BigDecimal` | GMV: SUM(totalAmount) excl CANCELLED _(REFUNDED removed 2026-06-23, FAILED removed 2026-07-21)_ |
| `paidRevenue` | `BigDecimal` | SUM(totalAmount) where status = COMPLETED; response name retained for compatibility |
| `orderCount` | `int` | COUNT excl CANCELLED |
| `avgOrderValue` | `BigDecimal` | grossOrderValue / orderCount; zero if orderCount = 0 |

### DailyRevenue item (dailyRevenue[] array)

| Field | Type | Description |
|---|---|---|
| `date` | `String` | ISO-8601 date string `YYYY-MM-DD` in Asia/Ho_Chi_Minh timezone |
| `revenue` | `BigDecimal` | Daily grossOrderValue (same exclusion set as summary) |
| `orders` | `long` | Number of daily orders |

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
| `orderCount` | `long` | COUNT of orders excl RANKING_EXCLUDED statuses |

Status: `CONFIRMED_FROM_CODE` — shape confirmed from `AdminAnalyticsResponse.java` audit; fields updated per P0 plan. `refundAmount` and `netRevenue` fields were completely removed from the DTO on 2026-07-04.

Evidence: `AdminAnalyticsResponse.java`, `AdminReportService.java`, `OrderJpaRepository.java`, `OrderLineItemJpaRepository.java`

## Order Export CSV Contract

The `GET /api/v1/admin/reports/orders/export` endpoint accepts the same operational
filters as the Orders list (`q`, `status`, `from`, `to`) and returns every matching
order across all pages. `from`/`to` are inclusive Vietnam calendar dates
(`Asia/Ho_Chi_Minh`); the export has no 10,000-row truncation limit.

The CSV contains the following columns:
1. `order_number`
2. `status`
3. `customer_email`
4. `customer_phone`
5. `currency`
6. `subtotal`
7. `shipping`
8. `total`
9. `paid_amount`
10. `placed_at`
11. `paid_at`
12. `completed_at`
13. `cancelled_at`

*(Note: the "discount" column was removed on 2026-07-04 since discounts are no longer supported)*

## Homepage Highlights Configuration (V362)

`home_category_highlights` stores the current `{slot, product_id}` assignments for
the three fixed homepage slots. The rows are replaced as one logical configuration.
`home_highlights_config` is a singleton metadata row (`id = 1`) containing:

| Column | Type / constraint | Meaning |
|---|---|---|
| `id` | `smallint PRIMARY KEY`, constrained to `1` | Singleton configuration identity. |
| `version` | `bigint NOT NULL DEFAULT 0` with JPA `@Version` | Configuration-wide optimistic concurrency token echoed as admin `version` and submitted as `expectedVersion`. |
| `updated_at` | `timestamptz NOT NULL` | Last successful configuration replacement. |

Admin reads return `{ items, version }`; admin saves must send the version read from
the same configuration. A stale version is rejected with `409 CONCURRENT_MODIFICATION`.
The public homepage read remains a list of highlight items and does not expose this
admin concurrency metadata.

## Site Settings — `setting_group` enum (V132)

`SiteSettingEntity` rows in table `site_settings` are partitioned by `setting_group`. The admin settings screen renders one tab per group. Group names are **lowercase**.

| `setting_group` | Purpose | Admin tab |
|---|---|---|
| `general` | Site name, footer description. `site_name` drives header/SEO; `footer_description` drives the header's mobile shop-info panel and the web footer (`WpFooter.tsx` — reconnected 2026-07-04 as the sole exception; see `API_CONTRACT.md` "Footer hardcoded" note). `footer_tagline`/`bct_url`/`business_registration` **removed 2026-07-03 (V308)** — see §"`footer_tagline`/`bct_url`/`business_registration` keys — removed" below. | Cài đặt chung |
| `contact` | Hotline/email/address, opening hours, social links — **shared site data** for the header + the static `/lien-he` and `/gioi-thieu` pages + homepage, product page, floating-chat widget, order-confirmation page. Since 2026-06-23 both the contact page builder and the Settings "Liên hệ" tab are gone; the group has **no admin UI** (hidden via `HIDDEN_GROUPS`). Rows stay in the DB and feed the web read-only; unhide `CONTACT` to allow editing again. **Footer stopped consuming this group 2026-07-03** (hardcoded in `WpFooter.tsx`) — editing these rows updates every surface above except the footer. | (ẩn — dữ liệu chung, không UI) |
| `public_home` | **Removed 2026-07-03 (V311).** Was: homepage promo banner, experience/about blocks, featured/news/videos kicker+title (15 keys). All hardcoded in `bigbike-web` now — see §"`public_home` keys — removed" below. | (đã gỡ) |
| `payment` | Bank-transfer account shown to customers at checkout — holder, number, bank, branch (4 keys) | Thanh toán |
| `public_about` | **Removed 2026-06-24 (V274).** The About page (`/gioi-thieu`) is **fully static** — copy from i18n `About`, the 5 service tiles from theme assets; the web never read these keys (`AboutPageContent.tsx`). The 28 rows (seeded V223, re-seeded V269), the `SettingDefinitionRegistry` defs, and `AboutServiceMediaSeeder` were all dropped. | (đã gỡ) |
| `public_product` | **No shared settings.** All product-detail content is per-product now: commitment rows under the buy buttons (`product.commitments`, JSONB on `products`) and the trust-badge row above the title (`product.trustBadges`, HTML-only). The former `product_commitment_*` (V228) and `product_trust_*` keys were removed in V232/V233. | (không có tab — nhóm trống) |
| `public_hero` | Hero banners for listing pages (`/san-pham`, `/brands`, `/tin-tuc`) — 14 active keys (desktop background, title, alt text and per-page illustration; plus 2 global fallbacks). The 3 legacy `hero_*_mobile_image_url` keys remain stored and returned for compatibility only; they are not editable or rendered. Managed by the dedicated **Banner trang** admin screen (`BannerScreen.jsx`), not the generic settings screen. | Banner trang |
| `promo` | **No rows.** The promo-banner keys (`promo_title`/`promo_off`/`promo_href`/`promo_image_url`) used to live in the `public_home` group — that group was removed entirely in V311 (hardcoded in `bigbike-web`); no `promo` group ever existed in the DB. | (không có tab — nhóm trống) |
| `seo` | Homepage SEO title and description (`seo_home_title`/`seo_home_description`), plus the homepage bottom SEO HTML block (`home_content_bottom_html`). The visible homepage H1 is the localized title of the introduction block, not a site-setting field. The former `seo_home_h1` row is retained in storage for compatibility but is no longer editable or part of the public homepage contract. | SEO website |
| `ai_assistant` | Vận hành Trợ lý BigBike: công tắc chung, trần mặc định 400 lượt AI/ngày giờ Việt Nam, ngưỡng cảnh báo chi phí tháng (không tự khoá), số cặp hỏi–đáp gần nhất gửi model (`ai_assistant_recent_turn_pairs`, `0..12`, mặc định `12`), công tắc diễn giải cách nói tự nhiên, email handoff, câu chào và bốn gợi ý nhanh song ngữ. Lịch sử lấy từ đúng conversation, che PII rồi cắt 450 ký tự/tin. Không chứa khoá AI. | Trợ lý BigBike |
| `store` | Operational: low-stock threshold | Cửa hàng |
| `inventory` | **No rows.** The `default_warranty_months` key was removed in V266 (warranty module dropped); `reservation_ttl_minutes` and `serial_inventory_only` in V259 (serial tracking dropped). No `inventory` group remains in the DB. | (không có tab — nhóm trống) |
| `product_assign` | Editable text of the "Phân công" guide shown on the product AND content/article create/edit screens (shared data) — `product_assign_title` (STRING) + `product_assign_roles` (JSON array, 1–6 dynamic role entries, V318). **Super-admin-only writable** (see below). | Phân công sản phẩm |
| `security` | **Removed 2026-06-24 (V273).** `login_max_attempts` + `session_timeout_minutes` were seeded (V29) but **never enforced** by any auth/session code (no account lockout, no idle-timeout); dropped from the DB and from `SettingDefinitionRegistry`. | (đã gỡ) |

**Removed:** `payment_sepay` — the SePay payment gateway was removed in V59; any leftover `payment_sepay` rows are deleted by V132.

### `footer_tagline`/`bct_url`/`business_registration` keys — removed (2026-07-03, V308)

> **Removed (2026-07-03, V308).** Shop-owner decision: the web footer (`bigbike-web/components/wp/WpFooter.tsx`) was hardcoded — it no longer reads any `site_settings` row (except `footer_description`, which was reconnected on 2026-07-04) or the `GET /api/v1/menus/footer` menu for its content (contact info, social links, tagline, BCT badge, ĐKKD line, and footer link list are now fixed constants/JSX in the component, frozen at what was live that day). Of the settings it used to read, three had **no other consumer**: `footer_tagline` (group `general`), `bct_url` (`general`), `business_registration` (`general`) — these were dropped outright rather than left orphaned. Removed together: the `site_settings` rows (`V308__remove_footer_only_settings.sql`), the 3 `SettingDefinitionRegistry` definitions, and their `KEY_LABELS_VI`/`KEY_GUIDE` entries in `bigbike-admin/src/screens/settings/constants.js`. `footer_description` (also `general`) was **kept** — it feeds the header's mobile shop-info panel (`WpHeader.tsx`) and is now also read by the footer again as the sole exception. The `contact` group (hotline/email/address/social URLs) is **unchanged and still live** for the header, homepage, product page, `/lien-he`, `/gioi-thieu`, floating chat, and order-confirmation — only the footer stopped consuming it (see `API_CONTRACT.md` "Footer hardcoded" note for the full list). Same pattern as the `public_about` removal (V274) just below.

### `public_home` keys — removed (2026-07-03, V311)

> **Removed (2026-07-03, V311).** Shop-owner decision: the entire `public_home` setting group (15 keys) was **dropped** and its 4 homepage content blocks hardcoded straight into `bigbike-web` (`app/page.tsx` + `components/home/HomeLocalizedSettings.tsx`), value-for-value from the last content live in the DB — no copy changed. Removed together: the 15 `site_settings` rows (`V311__remove_public_home_settings.sql`), the 15 `SettingDefinitionRegistry` definitions, the "Trang chủ" admin tab (`TAB_ORDER`/`TAB_META`/`TRANSLATABLE_GROUPS` in `bigbike-admin/src/screens/settings/constants.js`) plus their `KEY_LABELS_VI`/`KEY_GUIDE`/`KEY_HINTS_VI`/`KEY_RECO`/`SECTION_GUIDE` entries, the now-unused `IMAGE_RECO.promo` preset (`bigbike-admin/src/lib/imageRecommendations.js`), the `group_public_home` locale string (admin `vi.json`/`en.json`), and the orphaned `Home.featuredKicker`/`featuredTitle`/`newsKicker`/`newsTitle`/`videosTitle` fallback strings in `bigbike-web/messages/{vi,en}.json` (were only used as the removed settings' empty-value fallback). The 4 blocks and their 15 keys:
>
> | Block | Keys |
> |---|---|
> | Banner khuyến mãi | `promo_title`, `promo_off`, `promo_href`, `promo_image_url` |
> | Khối trải nghiệm | `home_exp_subtitle`, `home_exp_title`, `home_exp_desc` |
> | Khối giới thiệu | `about_title`, `about_subtitle`, `about_content_html` |
> | Sản phẩm nổi bật / Tin tức / Video | `home_featured_kicker`, `home_featured_title`, `home_news_kicker`, `home_news_title`, `home_videos_title` |
>
> The EN swap for these blocks (client-side, `useLocale()`) now picks between hardcoded VI/EN string constants instead of refetching `GET /api/v1/settings/public` by key. The `HomeContentBottom`/`home_content_bottom_html` block remains admin-editable, and the homepage title/description fields are admin-editable in the same `seo` group after V1036. The visible H1 is the localized title of the introduction block; the former `seo_home_h1` row is retained but no longer edited or consumed. The old `promo_image_url` hotlink is no longer used; the current homepage banner is the bundled `bigbike-web/public/brand/home/promo-banner.jpg`. Same pattern as the `public_about` removal (V274) and `footer_tagline`/`bct_url`/`business_registration` removal (V308) above.

### `seo` — homepage SEO fields (updated 2026-08-27)

> **Historical note:** V337 removed `seo_home_title`, `seo_home_description` and `og_image_url` on 2026-07-12. Owner decision on 2026-08-16 reversed that decision for the two text SEO fields and added `seo_home_h1`. On 2026-08-27 the visible H1 moved to the localized homepage introduction block; the old `seo_home_h1` row remains stored but is no longer editable or publicly consumed. `og_image_url` remains intentionally absent, so the website still has no default social-share image.
>
> | Key | Type | What it controlled |
> |---|---|---|
> | `seo_home_title` | STRING | Homepage `<title>` (Google/browser tab) |
> | `seo_home_description` | LONG_TEXT | Homepage meta description (Google snippet) |
>
> **Current keys:** `seo_home_title` (`STRING`), `seo_home_description` (`LONG_TEXT`) and `home_content_bottom_html` (`HTML`) are admin-editable and public. The two SEO text keys are translatable; blank title falls back to `site_name`, and blank description falls back to the localized homepage description. The former `seo_home_h1` row is retained in `site_settings` but is ignored by the admin editor and public homepage. The H1 is the localized title of the homepage introduction block. Per-entity SEO (category/product/article — `SeoMeta`/`seoOgImageUrl`) is separate and untouched.

### `public_about` keys — removed (2026-06-24, V274)

> **Removed (2026-06-24, V274).** The entire `public_about` setting group (all `about_page_*` keys, seeded by V223 and re-seeded by V269) was **dropped**. The About page (`/gioi-thieu`) is fully static: the copy comes from the i18n `About` namespace and the 5 service tiles from theme assets (`AboutPageContent.tsx`) — the web never consumed these settings. Removed together: the 28 DB rows (V274), the 28 `SettingDefinitionRegistry` definitions, and the runtime `AboutServiceMediaSeeder` (+ its 5 bundled seed images). The store/hotline/Facebook cards in the connect block still read the shared `contact` keys; brand logos still load from the brand taxonomy.

### `public_warranty` keys — removed (2026-06-23, V266)

> **Removed (2026-06-23, V266).** The entire `public_warranty` setting group (all `warranty_page_*` keys) and the `/bao-hanh` web page were **deleted** along with the warranty feature. There is no longer a warranty-lookup page, a **Trang Bảo hành** settings tab, or any `warranty_page_*` setting. Customer-facing warranty wording survives only as CMS policy content (e.g. the "Chính sách bảo hành" content page) and per-product marketing rows.

### `public_product` keys — product-page trust badges

The `public_product` group has **no shared settings** — all product-detail content is per-product.

> **Commitment rows moved to per-product (V232).** The former `product_commitment_{1..3}_title/subtitle` keys (V228) were **removed**; the block is stored **per product** in `products.commitments` JSONB — see *"`products.commitments` JSONB"* above.
>
> **Trust badges moved to per-product (V233) and then HTML-only.** The former `product_trust_genuine` / `product_trust_freeship` keys were **removed in V233**. The trust-badge row above the product title is now stored per product in `trust_badges_html` / `trust_badges_html_en`; the former `product_trust_badges` child table was backfilled into HTML and dropped. Empty HTML → web hides the row. **No default seed** — products start empty; admin curates per product. The eyebrow line above the title (`category.name` / `originBrandCountry`, falls back to brand name) is unchanged and built from existing product data.

`AboutServiceMediaSeeder` is idempotent: it keys MinIO objects deterministically (`uploads/seed/about-service-{n}.png`), looks up the `media` row by `file_path`, and only rewrites the setting while its value is blank or a `/wp-content/themes/` path — so admin-chosen images are never overwritten. MinIO is per-environment and not replicated by DB migrations, so the seed runs at runtime on each env; MinIO failures are logged (not fatal) and the web still falls back to the theme image baked into `bigbike-web/public`.

### `product_assign` keys + super-admin-only write (V157, consolidated to a dynamic role list by V318)

The product create/edit screen — and, since V318, the content/article create/edit screen too — shows a "Phân công" (team-assignment) guide banner reading the SAME underlying data. Originally 7 flat keys, one STRING/LONG_TEXT pair per fixed role (seeded `V157__seed_product_assignment_settings.sql`). `V318__consolidate_product_assignment_roles.sql` consolidated the 6 per-role keys into one JSON array so Super Admin can add/remove roles (1–6) without a code deploy — the old hardcoded "exactly 3 roles" (Content/SEO/Quản lý) model no longer exists structurally.

| `setting_key` | Type | Content |
|---|---|---|
| `product_assign_title` | STRING | Banner heading ("Phân công") — unchanged by V318 |
| `product_assign_roles` | JSON | Array of `{id, name, items}` objects, 1–6 entries. `items` is a single free-text field (matches the old per-role LONG_TEXT content 1:1, not a nested list). Introduced by V318, replacing the 6 keys below. |

V318 migrated the 3 legacy role/items pairs (`product_assign_role_content`/`product_assign_items_content`, `_seo`, `_manager`) into `product_assign_roles`, preserving whatever text was live in the DB at migration time (not the original V157 seed defaults), and assigning stable ids `content`/`seo`/`manager` to the 3 migrated entries — so the admin UI's `useRoleLabel` lookup can still fall back to the original default label if one of these 3 is later renamed or deleted. The 6 old keys were then deleted from `site_settings`.

**`product_assign_roles` validation** (`SettingValueValidator.validateProductAssignRoles`): must be a JSON array of 1–6 objects; each needs a non-blank, array-unique `id`, a non-blank `name` (≤1,000 chars), and an `items` string (≤65,536 chars, blank allowed — a newly-added role may not have its tasks filled in yet).

**Read shape.** `AdminSettingsService.getProductAssignment()` returns `AdminProductAssignmentResponse(String title, List<RoleAssignmentDto> roles)` (`RoleAssignmentDto(String id, String name, String items)`) — parses `product_assign_roles`' raw JSON via Jackson; a missing key or parse failure returns an empty `roles` list rather than throwing, since this read sits on the hot path for every product/content editor open across all 4 roles that can reach it.

**Super-admin-only write.** Both keys carry a `superAdminOnly` flag in `SettingDefinitionRegistry`. `AdminSettingsService` rejects any write (single or batch) to a `superAdminOnly` key unless the caller holds the wildcard `*` permission (i.e. `SUPER_ADMIN`) — even `ADMIN` (who has `settings.write`) is blocked. `AdminSiteSettingResponse` exposes `superAdminOnly` so the admin UI hides the tab for non-super-admins. The flag is surfaced in `AdminSiteSettingResponse.superAdminOnly`.

Migration `V132__cleanup_sepay_and_normalize_inventory_settings.sql`:
- `DELETE FROM site_settings WHERE setting_group = 'payment_sepay'` — removes dead SePay rows that survived V59 in some environments.
- `UPDATE site_settings SET setting_group = 'inventory' WHERE setting_group = 'INVENTORY'` — folds the legacy uppercase `INVENTORY` group into the lowercase `inventory` group so casing is uniform.

Status: `CONFIRMED_FROM_CODE`

Evidence:
- `SettingDefinitionRegistry.java` — registers keys for `general`/`contact`/`payment`/`public_hero`/`seo`/`store`/`product_assign` (the `seo` group contains the three restored homepage SEO text fields plus `home_content_bottom_html`; the `promo`/`tax`/`inventory`/`public_product`/`security`/`public_about`/`public_home` groups have **no** registered keys)
- `V157__seed_product_assignment_settings.sql` — original 7-key seed; `V318__consolidate_product_assignment_roles.sql` — consolidation to the 2-key JSON shape
- `AdminProductAssignmentController.java` — `GET /api/v1/admin/product-assignment` (read for the banner, one of `products.read` / `content.read`)
- `SettingsScreen.jsx` — `HIDDEN_GROUPS` now includes `product_assign` (bypasses the generic per-field settings flow; rendered instead by the bespoke `AssignmentRolesScreen.jsx`, same pattern as `public_hero`/`BannerScreen.jsx`), explicit `isSuperAdmin` gate on the synthetic tab
- `bigbike-admin/src/screens/product-detail/Layout.jsx` (`useRoleLabel`/`AssignmentBanner`), `bigbike-admin/src/screens/content-detail/ContentAssignmentBanner.jsx` (reads the same endpoint/query key)
- `V59__remove_sepay_payment_artifacts.sql`, `V132__cleanup_sepay_and_normalize_inventory_settings.sql`

### Site Settings — `en_locked` — ĐÃ GỠ BỎ (V312)

`site_settings.en_locked` (`boolean NOT NULL DEFAULT false`, thêm ở V309) từng là cờ khoá dịch cho ô
VI/EN của màn Cài đặt, mirror `en_overrides` của Product/Category/Brand/Article. Cùng với việc gỡ bỏ
tính năng tự động dịch VI→EN (Gemini), cột này đã bị **drop khỏi DB** ở migration
`V312__remove_gemini_translation_lock.sql`; `AdminSiteSettingResponse`/`UpdateSiteSettingRequest`/
`BatchUpdateSettingsRequest.BatchSettingUpdate` không còn field `enLocked`.

Tiếng Anh cho setting nay **nhập tay 100%** qua `valueEn`. Setting nào **vừa dịch-được
(`isTranslatableSetting()`) vừa `.required()` ở VI** (hiện chỉ `site_name`) thì `valueEn` cũng bắt
buộc non-blank khi lưu — xem `BUSINESS_RULES.md` §"Site Settings Rules" (`SETTINGS_RULE_001`) và
`TRANSLATION_RULE_002`.

Status: `CONFIRMED_FROM_CODE` — `SiteSettingEntity.java`, `AdminSettingsService.java`,
`AdminSiteSettingResponse.java`, `UpdateSiteSettingRequest.java`, `BatchUpdateSettingsRequest.java`,
`V312__remove_gemini_translation_lock.sql`. Xem `API_CONTRACT.md` §"Bilingual content — nhập tay,
không còn tự động dịch (V312)".

### PDP mockup port — bilingual description blocks, featured specs (V229–V230)

Migration bổ sung cho trang chi tiết sản phẩm (bigbike-web), port bố cục mockup nhưng giữ design
system web. Tất cả nullable / default an toàn → sản phẩm cũ giữ nguyên hành vi (không backfill).

| Migration | Bảng.cột | Kiểu | Default | Ý nghĩa |
|---|---|---|---|---|
| `V229` | ~~`products.description_blocks_en`~~ | ~~`JSONB`~~ | ~~`NULL`~~ | Khối mô tả có cấu trúc bản tiếng Anh, từng song song `description_blocks` của V139. **DROP ở `V326`** — mỗi khối trong `description_blocks` nay mang cả 2 ngôn ngữ inline (field `*En`), xem §"Product description blocks — description_blocks (V139, gộp song ngữ ở V326)". |
| `V230` | `product_specifications.featured` | `BOOLEAN NOT NULL` | `false` | ~~"Đưa lên ô nổi bật"~~ **GỠ BỎ ở `V235`** — từng thay bằng `product_spec_stats`, sau đó backfill vào `spec_stats_html` và drop bảng ở V329/V330. Xem §"Product spec-stats HTML". |
| `V234` | ~~`reviews.title`~~ + `reviews.photos` | ~~`varchar(160)`~~ + `JSONB` | `NULL` | Mảng URL ảnh khách hàng (MinIO `/media/reviews/...`, ≤10) cho đánh giá sản phẩm. Nullable, không backfill → review cũ giữ `NULL`. Xem `BUSINESS_RULES.md` `REVIEW_RULE_005`. `reviews.title` (tiêu đề tuỳ chọn) thêm cùng migration này **đã bị drop ở `V298`** — xem §"Review title — REMOVED (V298)". |

**Đã xóa (2026-07-07):** `V231` (`products.product_tabs`, JSONB — cấu hình tab PDP theo từng sản phẩm) và `V245` (`products.section_visibility`, TEXT — "Hiển thị trên web") đều bị **DROP** bởi `V325__drop_dead_product_fields.sql`. Cả hai chưa từng có UI quản lý thật trên admin (chỉ dormant/ngủ yên trước đó) — xem `BUSINESS_RULES.md` `PRODUCT_RULE_006`.

**Localize đọc (public) — cập nhật V326:** `description_blocks_en` (cột riêng của V229) đã DROP.
`description_blocks` giờ resolve **theo từng field trong từng khối** qua `DescriptionBlock.resolveForLocale`
(en → field `*En` nếu non-blank, fallback field VI) — chi tiết ở §"Product description blocks —
description_blocks (V139, gộp song ngữ ở V326)". (`specifications[].featured` của V230 đã
**gỡ bỏ ở V235**; field cấu trúc `specStats` cũ (bảng `product_spec_stats`) cũng đã backfill vào HTML
(nay là field `specStats` hiện hành, cột `spec_stats_html`) và drop bảng ở V329/V330.) Khối EN của mô tả không còn
nằm ở `translations.en.descriptionBlocks` (field đã xóa khỏi `ProductTranslations.ProductContent`) —
admin đọc thẳng field `*En` trong từng khối của `descriptionBlocks`, không cần đường riêng.

Status: `CONFIRMED_FROM_CODE` — `DescriptionBlock.resolveForLocale`,
`AdminCatalogMutationService`, migrations `V229` (products-column table row,
nay REMOVED) – `V230` – `V326` (drop `description_blocks_en`, xem §"Product description blocks").
Xem [API_CONTRACT.md](API_CONTRACT.md) §"PDP — descriptionBlocks / specifications.featured (V229–V230, gộp song ngữ V326)".

## Live WordPress migration owner-plan contract (2026-08-03) — REMOVED 2026-08-18

> **REMOVED (2026-08-18).** The cutover completed in 2026-06 and the entire `migration/wordpress/**` package (including every `Live*` planner named below) was deleted from the repository. This section is kept as a historical record of what the one-time migration was contractually allowed to write; it no longer describes any code that exists. See `MODULE_CATALOG.md` row "WordPress migration toolchain".

The production migration plan is not an alternate application data model. It is a one-time, immutable, JSON-serialized write contract generated by `migration.wordpress.live` and bound to the source-dump hash, target snapshot, owner-override SHA-256 and every record-level action.

- `ProductPlan.sourceModifiedGmt` is the exact parsed WordPress `post_modified_gmt`. For duplicate SKU `SCS-S10X`, sources `41038` and `41181` must both exist with distinct timestamps; only the latest may be selected and the selected ID must be `41181`. Source `41038` has action `EXCLUDE_OWNER_OVERRIDE` and contributes no product/SEO/translation/media values.
- Each inferred required product value is a `ProductInferencePlan` containing source ID, field, inferred value, evidence, rule ID, confidence, uniqueness evidence and decision. Unresolved values use `MANUAL_REVIEW`; no executor path accepts that action. `uncategorized-brand` is a real target fallback plus warning, never a newly invented brand.
- `ACKNOWLEDGED_NO_SAFE_TARGET` has a null target and is non-actionable: no `redirects` row is inserted or updated. It stays in the reviewed report and preserves the legacy 404. HTML-anchor unlink and the exact `wp-art-26064` dead-image removal are `TargetContentRewritePlan` operations with exact before/after whole-field SHA-256; JSON/plain/canonical URL deletion is not part of this contract.
- `OwnerDecisionPlans` also carries exact recovery-file evidence, the active unavailable-media fallback, and the read-only target media cleanup plan. Target cleanup rows include integrity state, UUID/object key/public URL, reference evidence, canonical ID, audit/reference/age evidence and whole-field hash-bound rebinds. They are not executable by the migration writer.

Status: `OWNER_CONFIRMED_2026-08-03` and `CONFIRMED_FROM_CODE` — `live-migration-owner-overrides-v1.json`, `LiveMigrationPreflightReport`, `LiveDuplicateProductSelectionPlanner`, `LiveProductInferencePlanner`, `LiveSourceMediaRecoveryPlanner`, `LiveTargetMediaCleanupPlanner`, `LiveMigrationContentRewriter`, `LiveMigrationExecutionGate`.

## Maintenance State Data Contract

Migration `V374__maintenance_admin_lock.sql` creates a dedicated single-row table and **deletes** the five `site_settings` rows added by `V373` (V373 already ran in production, so V374 is forward-only and V373 must not be edited). Migration `V1054__simplify_admin_maintenance_lock.sql` is the current forward-only cleanup; V373, V374 and V375 remain unchanged.

| Column | Type | Default | Notes |
|---|---|---|---|
| `id` | `SMALLINT` PK | `1` | `CHECK (id = 1)` — exactly one row |
| `state` | `VARCHAR(16)` | `NORMAL` | `CHECK (state IN ('NORMAL','ACTIVE'))`; legacy `UPCOMING` is normalized to `NORMAL` by V1054 |
| `staff_note` | `TEXT` | null | Message shown to staff on the maintenance overlay |
| `updated_by` | `UUID` | null | Admin who last changed the state |
| `updated_at` | `TIMESTAMPTZ` | `NOW()` | |

V1054 first converts the live legacy value `UPCOMING` to `NORMAL`, removes the old `maintenance_expected_at` setting if it remains, and drops `expected_at`. The measured live evidence on 2026-08-24 was one `UPCOMING` row with an expected time overdue since 2026-08-07; `staff_note`, `updated_by` and audit timestamps are preserved. The current response shape is `state`, `staffNote`, `updatedAt`, `canToggle` and `uploadCount`; expected time is not retained or returned.

**Why a dedicated table instead of `site_settings`.** `AdminSettingsService.listSettings` reads `settingRepo.findAll()` and does not consult `SettingDefinitionRegistry`, while every registry-driven guard treats an unregistered key as *unrestricted* (`requireSuperAdminForRestrictedKey` uses `.orElse(false)`, and value validation only runs when a definition exists). Keeping the lock in `site_settings` would therefore let any holder of `settings.write` flip it — defeating the `DEVELOPER`-only rule — and would let an arbitrary string be written into `maintenance_mode`, which `MaintenanceService.normalizedState` rejects on every subsequent read, bricking the status endpoint. The separate table plus `CHECK` constraint makes both unreachable by construction.

V374 also creates the `DEVELOPER` role (`is_system = TRUE`) with 34 explicitly enumerated permissions. It deliberately does **not** copy `ADMIN`'s permission set: `ADMIN` holds `seo.index` (granted by V372) which is missing from `PermissionCatalog`, so copying would propagate that latent `400 UNKNOWN_PERMISSION` on the Roles screen to a third role.

No customer or order data is touched by a state change. The response DTO (`state`, `staffNote`, `updatedAt`, `canToggle`, `uploadCount`) is derived, not a second persisted model — `canToggle` and `uploadCount` are computed per request. Checkout draft fields remain browser-local only and must never contain an access token, refresh token, password or payment secret.

## Trợ lý BigBike — dữ liệu sau rút gọn (V1068, owner decision 2026-08-29)

Migration V1068 là bước mới, không sửa migration đã chạy. Nó xóa dứt điểm dữ liệu/cấu trúc chỉ phục vụ chọn model, chi phí theo model, chấm model, mở lời chủ động, xin liên hệ, gắn đơn từ chat, phản hồi câu trả lời và báo cáo phụ. Bảng/field còn lại dưới đây là hợp đồng đang chạy.

### `chat_conversations`

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | Khóa hội thoại. |
| `customer_id` / `visitor_id` | nullable FK | Scope đúng khách đăng nhập hoặc định danh first-party hiện tại; không chứa contact snapshot. |
| `locale` | `VARCHAR` | `vi` hoặc `en` cho copy khách nhìn thấy. |
| `status` / `turn_count` | enum/integer | Trạng thái chat và lượt tư vấn có nội dung; trần mặc định 40 do setting. |
| `expires_at` / timestamps | `TIMESTAMPTZ` | Retention tối đa 90 ngày. |

Không có trạng thái/lần đếm/lời mời liên hệ trên hội thoại.

### `chat_messages`

| Column | Type | Notes |
|---|---|---|
| `id` / `conversation_id` / `sequence` | UUID/FK/integer | Message thuộc đúng hội thoại và sắp xếp ổn định. |
| `role` | `CUSTOMER|ASSISTANT|STAFF|SYSTEM` | `STAFF` có snapshot tên hiển thị, `SYSTEM` báo trạng thái. |
| `content` / `locale` | text/locale | Nội dung đã qua lớp an toàn và định dạng. |
| `source` / `outcome_code` / `ai_called` | server-owned | Phân biệt fast-path/AI/fallback an toàn; `ai_called` hỗ trợ quota, không là ledger chi phí. |
| `products_json` / `cross_sell_products_json` | JSONB nullable | Snapshot thẻ đã hậu kiểm, tối đa 8 sản phẩm và 2 phụ kiện. |
| `created_at` | `TIMESTAMPTZ` | Thứ tự detail/retention. |

Không còn token, độ trễ, số lần gọi nhà cung cấp, chi phí, requested/served model, fallback metadata, interaction source hoặc lead-prompt metadata trên message.

### `chat_handoff_requests`

| Column | Type | Notes |
|---|---|---|
| `id` / `request_id` | UUID | Server id và idempotency. |
| `conversation_id` | FK | Một request đang chờ cho đúng hội thoại; retention cùng hội thoại. |
| `status` | `WAITING|ACTIVE|RETURNED_TO_AI|CLOSED` | Theo state machine `§15B`. |
| `trigger_source` / `customer_kind` | enum | `BUTTON|MESSAGE` và `GUEST|SIGNED_IN`; không phải số điện thoại/contact. |
| `question_summary` / `products_json` | nullable | Snapshot tối thiểu để nhân viên xử lý; không PII. |
| assignee/resolution/business-hours fields | nullable | Claim nguyên tử, kết thúc/bàn giao và thông báo lần mở cửa tiếp theo. |

Không có `contact_present` hay liên kết đến bảng liên hệ.

### `chat_visitors`

Định danh first-party ngẫu nhiên chỉ lưu hash token, `memory_enabled`, `last_seen_at`, `remembered_until` và timestamps. Không có IP, fingerprint, contact hoặc prose. Visitor hết cửa sổ nhớ 30 ngày được xóa; `visitor_id` của transcript còn retention thành `NULL`, không xóa sớm transcript.

### `chat_ai_daily_usage`

| Column | Type | Notes |
|---|---|---|
| `usage_date` | `DATE` PK | Ngày kinh doanh `Asia/Ho_Chi_Minh`. |
| `used_count` | integer | Số logical response đã giữ slot, không đếm fast-path hay retry lần hai. |
| timestamps | `TIMESTAMPTZ` | Audit counter không chứa nội dung/định danh khách. |

Backend dùng atomic upsert có điều kiện `used_count < dailyLimit` trước khi gọi Gemini 3.7 Flash. Reservation không hoàn lại sau provider failure; vì vậy một logical response, kể cả có retry, chỉ dùng đúng một slot.

### `chat_images` và `chat_image_daily_usage`

`chat_images` giữ id/request id, conversation/message FK, private bucket/object key, MIME/kích thước/hash sau re-encode, status, intent/safety code, expiry/timestamps. Không trả object key, filename, EXIF/GPS hay raw hash ra DTO. `chat_image_daily_usage` giữ quota nguyên tử theo ngày Việt Nam. Contract cố định: 1 ảnh/lượt, 3 ảnh/hội thoại, 20 ảnh/ngày, tối đa 8 MB; ảnh private được xóa object trước metadata khi hết hạn/xóa history.

### `chat_product_image_fingerprints`

Một row dấu vân tay cục bộ cho ảnh chính của hàng đang bán: `product_id`, media/ref/version hash, `fingerprint_version`, dHash/histogram/tỷ lệ và `indexed_at`. Chỉ dùng ảnh catalog nội bộ, không lưu fingerprint ảnh khách và không gọi nhà cung cấp để dựng index.

### Browser chat state và cart

Browser chỉ giữ signed visitor token, preference nhớ/tắt, conversation/thread id, sequence và UI session flags cần hiển thị. Khi tắt nhớ, token chuyển sang `sessionStorage`; xóa history xóa token/cache sau server hard-delete; logout không để lộ history khách cũ. Không có cờ mở lời chủ động, form liên hệ, phản hồi câu trả lời hoặc proof gắn đơn.

`cart_items` không có field conversation/interaction/attributed-at. Thêm giỏ từ chat dùng cùng validation sản phẩm, biến thể, giá và tồn như mọi lần thêm giỏ khác.

### Dữ liệu bị xóa ở V1068

- Bảng: `chat_ai_usage_events`, `chat_evaluation_runs`, `chat_evaluation_model_results`, `chat_message_feedback`, `chat_leads`, `chat_interactions`, `chat_order_attributions`.
- Cột telemetry/model/interaction/lead-prompt của `chat_messages`; các cột lead-offer của `chat_conversations`; các cột attribution của `cart_items`; `chat_handoff_requests.contact_present`.
- Toàn bộ `chat_visitors` hiện có, notification loại `CHAT_LEAD` và settings đã bỏ (model lựa chọn, cost warning, template/abbreviation owner-editable, memory-days, proactive và image quota owner-editable).
- Dữ liệu cũ có thể chứa metadata lead trong `chat_messages.action_metadata` được scrub; transcript/tin nhắn không thuộc tính năng đã gỡ, handoff, ảnh và counter quota được giữ.
