# Business Rules

Only rules verified from current code, config, migration, or test are documented here.

## Catalog Availability

- Public catalog/cart/checkout only accept products with publish status `PUBLISHED`. `CONFIRMED_FROM_CODE`
- Variant add-to-cart/checkout requires the variant to be available and in stock. `CONFIRMED_FROM_CODE`
- Checkout re-syncs prices from DB before order creation and reports price changes. `CONFIRMED_FROM_CODE`

Evidence:

- `CartService.java`
- `CheckoutService.java`
- `Phase1ECartApiTest.java`
- `Phase1FCheckoutApiTest.java`

## SKU Roles

- `product.sku` is a **model/group code** — an optional descriptive identifier for the product family. It is not the selling code when variants exist. `CONFIRMED_FROM_CODE`
- `variant.sku` is the **selling SKU** — the code used in cart, checkout, and inventory to identify the actual unit being sold. `CONFIRMED_FROM_CODE`
- **`PRODUCT_RULE_SKU_001` — every variant must have a SKU, and variant SKUs must be unique.** On the admin product upsert API, each variant in the `variants[]` list must carry a non-blank `sku` (`@NotBlank` on `VariantRequest.sku`; admin form blocks save with a per-row error). Variant SKUs are **globally unique, case-insensitive** across all products: the backend rejects a save that reuses a SKU held by another variant (and the admin form flags duplicates within the same product before submit). `product.sku` stays optional and is **not** part of the uniqueness check. `CONFIRMED_FROM_CODE`
- Uniqueness is enforced at the DB level by a partial unique index `ux_product_variants_sku_lower` on `lower(sku)` (V244), which also backfilled SKUs for legacy/WP-import variants that had none and de-duplicated pre-existing collisions. The application layer pre-validates duplicates to return a friendly error before hitting the constraint. `CONFIRMED_FROM_CODE`
- The `product_variants.sku varchar(100)` column stays nullable so the index ignores any future null (the requirement is a **write-time validation**, not a `NOT NULL` schema change); `products.sku varchar(100)` remains fully optional with no uniqueness. `CONFIRMED_FROM_CODE`
- When snapshotting line items into cart/order, the system uses `variant.sku` if present, otherwise falls back to `product.sku`. This fallback covers single-variant or no-variant products where the parent SKU is the selling code. `CONFIRMED_FROM_CODE`
- Inventory search reads both `p.sku` and `v.sku` so admin tools can locate stock by either code. `CONFIRMED_FROM_CODE`

Evidence:

- `ProductEntity.java` (line 34)
- `ProductVariantEntity.java` (line 29)
- `VariantRequest.java` (`@NotBlank` on `sku` — admin upsert write-time requirement)
- `ProductDetailScreen.jsx` / `schemas.js` (admin form per-row SKU required validation)
- `PosOrderService.java` (line 233 — fallback `variant.getSku() != null ? variant.getSku() : product.getSku()`)
- `CartService.java` (line 153 — same fallback)
- `CheckoutService.java` (line 723 — same fallback)
- `V1__create_catalog_content_tables.sql` (lines 65, 166 — `product_sku` / `variant_sku` columns)

## Order Completion & Cancellation Rules

The three statuses on an order are independent and **never** to be conflated:

| Field | Meaning |
|---|---|
| `OrderEntity.status` | Where the order sits in the fulfillment / lifecycle pipeline. |
| `OrderEntity.paymentStatus` | Where the money is. |
| `OrderEntity.fulfillmentStatus` | Where the goods are (DELIVERY orders only). |

`COMPLETED` means **goods delivered**. Payment is reconciled separately by the admin and does **not** gate completion (owner decision 2026-06-23).

- `ORDER_RULE_001` — Payment status no longer blocks completion. An order may be transitioned to `COMPLETED` while `paymentStatus = UNPAID`; the admin reconciles the money offline and may mark the order paid before or after completing it (owner decision 2026-06-23 — see `PAY_RULE_001`). The only completion precondition that remains is delivery (`ORDER_RULE_003`). (History: an UNPAID order was blocked from completion until 2026-06-23. `PARTIALLY_PAID` was removed by V114; the `REFUNDED` payment status was removed 2026-06-23 — the CHECK constraint allows `UNPAID/PAID/CANCELLED` only.) `CONFIRMED_FROM_CODE`
- `ORDER_RULE_002` — `paymentMethod` is **optional** for online orders and no longer affects completion. Online checkout no longer asks the customer to choose a payment method, so new web/quick-buy orders are stored with `paymentMethod = null`; legacy/explicit `COD`/`BACS` values are still accepted and displayed. (History: until 2026-06-23 a `COD` order could not be completed until `paymentStatus = PAID`; that guard was removed with the owner decision to reconcile payment offline.) `CONFIRMED_FROM_CODE`
- `ORDER_RULE_003` — `fulfillmentType = DELIVERY` orders cannot transition to `COMPLETED` unless `fulfillmentStatus = DELIVERED`. Reason: a delivery order cannot be "complete" before it has actually been delivered. Admin must walk fulfillment through `UNFULFILLED → PROCESSING → SHIPPED → DELIVERED` (or jump straight to `DELIVERED` from `UNFULFILLED`) via `PATCH /admin/orders/{id}/fulfillment` first. (Every order is now a `DELIVERY` order — the in-store `IN_STORE` fulfillment type was retired with POS, 2026-06-23.) Backend message: `Chỉ được hoàn thành đơn giao hàng sau khi đã giao thành công.` `CONFIRMED_FROM_CODE`
- `ORDER_RULE_004` — Orders with `paymentStatus = PAID` **can be cancelled directly** (no refund step). Refunds were removed platform-wide (2026-06-23); the admin reconciles the money manually outside the system. Cancelling restores stock as for any other cancel. (`PARTIALLY_PAID` removed in V114; `REFUNDED` removed 2026-06-23 — the prior cancel-blocking guard and its `POST /admin/orders/{id}/refund` requirement no longer exist.) `CONFIRMED_FROM_CODE`
- `ORDER_RULE_005` — ~~POS auto-complete + CASH/CARD_TERMINAL paid-at-counter rule.~~ **REMOVED (owner decision 2026-06-23, online-only — see "POS Rules" banner below).** The POS create-order path no longer exists; there is no longer an order that starts `COMPLETED + PAID`. `REMOVED`
- `ORDER_RULE_006` — ~~POS completed orders cannot be cancelled directly.~~ **REMOVED (2026-06-23, online-only).** No POS order is created `COMPLETED` anymore, so this guard is moot. `COMPLETED` remains terminal in `ALLOWED_TRANSITIONS` for online orders. `REMOVED`
- `ORDER_RULE_008` — ~~POS below-cost override guard (`pos.sell_below_cost`).~~ **REMOVED (2026-06-23, online-only).** Price override only existed in the POS flow, which is gone; the `pos.*` permissions were dropped. Cost price is still admin-only and never exposed on the storefront (see DATA_CONTRACT "Cost price"). `REMOVED`

Evidence:

- `AdminOrderService.java` — `validateBeforeComplete`, `validateBeforeCancel`, `ALLOWED_TRANSITIONS`
- `CheckoutService.java` — initial `fulfillmentStatus = UNFULFILLED` for DELIVERY orders
- `Phase1HAdminOrderApiTest.java` — covers the surviving rules above (happy + rejection paths)

## POS Rules

> **POS (Point of Sale / "bán tại quầy" / walk-in) was REMOVED platform-wide (owner decision 2026-06-23).** BigBike is now **online-only**: every order is placed through the storefront / quick-buy and is a `DELIVERY` order. Walk-in customers are no longer recorded in the system. The endpoints `POST /admin/pos/orders` and `GET /admin/pos/products/search`, the `AdminPosController` / `PosOrderService`, the `pos.read` / `pos.write` / `pos.price_override` / `pos.sell_below_cost` permissions, and the old `POS_CUSTOMER_*` rules were all deleted. Legacy POS orders (`channel`/`fulfillmentType = IN_STORE`, `source = 'pos'`) were purged from the database. The `channel` / `fulfillment_type` / `source` columns still exist (online orders use `fulfillmentType = DELIVERY`), but `IN_STORE` / `'pos'` values are no longer written.

## Media Rules

- Media upload validation is server-side MIME/content validation using Apache Tika magic-byte detection. `CONFIRMED_FROM_CODE`
- Allowed MIME types include common raster images, `image/svg+xml`, MP4 video, and selected audio formats. `CONFIRMED_FROM_CODE`
- SVG is allowed but sanitized on upload (`SvgSanitizer`): scripts, event handlers, `javascript:`/external references and CSS vectors are stripped; non-SVG content declared as `image/svg+xml` is rejected. `CONFIRMED_FROM_CODE`
- Hard delete is blocked when a media URL is still referenced. `CONFIRMED_FROM_CODE`
- `MEDIA_RULE_002` — URL ảnh trong gallery sản phẩm (`product.gallery`) và gallery biến thể (`variant.gallery`) bắt buộc phải thuộc whitelist MinIO khi thêm mới hoặc chỉnh sửa (mediaType không phải video). Ảnh cũ (legacy) đã tồn tại từ trước vẫn được chấp nhận để đảm bảo khả năng tương thích ngược khi sửa sản phẩm cũ. `CONFIRMED_FROM_CODE`

Evidence:

- `AdminMediaService.java`
- `AdminMediaP0Test.java`
- `CatalogRequestValidator.java` (gọi `validateWhitelistedMediaUrl` cho gallery mới)
- `AdminMutationValidators.java` (`validateWhitelistedMediaUrl`)

## Inventory Rules

> **Serial-number tracking was REMOVED platform-wide (2026-06-23, V259).** There are no more per-unit serials, no serial lifecycle, and no serial-only selling mode. (The old `RULE-SER-*` IDs and the dedicated serial docs were deleted.)
>
> **Inventory switched to a BOOLEAN availability model (2026-06-23, V262).** There is no longer a tracked stock **quantity**. Availability is a simple **"Còn hàng / Hết hàng"** flag that the admin toggles by hand. The quantity columns are kept in the database but are **dormant** (no longer drive availability), and the `LOW_STOCK` tier no longer exists.

- Availability is a **boolean**, not a count: a variant is either available or not; a no-variant product is either in stock or out of stock. There is no on-hand number anymore. `CONFIRMED_FROM_CODE`
- The admin sets availability by hand via a toggle in the Inventory screen. **Selling does NOT change availability** — there is no auto-decrement, no auto-restore, and no per-unit ledger for sales. `CONFIRMED_FROM_CODE`
- **Overselling is NOT auto-prevented.** When an item sells out, the admin must manually flip it to **"Hết hàng"**; until then the storefront keeps accepting orders. `CONFIRMED_FROM_CODE`
- Manual inventory movement types `IN` / `OUT` / `ADJUSTMENT` / `RETURN` are no longer written for sales or restores. (The `stock_movements` ledger is dormant for the availability model.) `CONFIRMED_FROM_CODE`
- The dormant columns `product_variants.quantity_on_hand`, `products.stock_quantity` and `products.manage_stock` are kept for compatibility but are **not** read for availability. The `low_stock_threshold` site setting was **removed (V279)**. `CONFIRMED_FROM_CODE`
- Receipt-based receiving tables were **dropped in V120** — schema-only, never implemented in Java. `REMOVED`

### Stock State Derivation Rules `CONFIRMED_FROM_CODE`

- `stockState` is a two-state badge (`IN_STOCK` / `OUT_OF_STOCK`) that **mirrors the boolean availability**. `LOW_STOCK` was **removed from the enum (V279)**. Admin cannot set `stockState` directly via the API; it is **derived on every product-form save** from the Còn/Hết toggles (`InventoryPolicyService.recomputeProductState`).
- `STOCK_RULE_001`: A new variant defaults to **available** (`is_available = true`); a new no-variant product defaults to **in stock** unless the admin flips its product-level Còn/Hết switch to "Hết hàng". `stockState` is derived to match on save.
- `STOCK_RULE_002`: Toggling availability is the only thing that changes a variant's / product's stock state. There is no quantity to recompute on sale, cancel, or return.
- `STOCK_RULE_003`: ~~Quantity thresholds (`LOW_STOCK` tier, `low_stock_threshold`).~~ **REMOVED (V262; `LOW_STOCK` enum value and `low_stock_threshold` setting fully deleted in V279).** No "sắp hết" tier exists; availability is binary.
- `STOCK_RULE_004`: `forceOutOfStock` (product-level boolean) remains a separate hard override. It disables purchase on web even when the item is marked available. Still manually controlled by admin.
- `STOCK_RULE_005`: For products **with variants**, availability is gated **per variant** by `product_variants.is_available`. The variant's `stockState` mirrors it (`IN_STOCK` if available, else `OUT_OF_STOCK`). The web variant selector (`VariantSelector.tsx`) dims unavailable options (still clickable for image preview); buying a variant requires `is_available = true`.
- `STOCK_RULE_006`: For products **without variants**, `products.stock_state` (`IN_STOCK` / `OUT_OF_STOCK`) is set **directly by the admin toggle**. `forceOutOfStock` still hard-disables purchase regardless.
- `STOCK_RULE_007`: Sản phẩm đang **"Hết hàng"** → khách chỉ xem được, không thể đặt hàng. Không có chế độ "đặt trước" hay "HÀNG ODER" qua web. Muốn nhận đơn ODER, admin phải bật **"Còn hàng"** thì khách mới đặt được. **Lưu ý:** bán không tự chuyển sang "Hết hàng" — khi bán hết, admin phải tự tắt, nếu không web vẫn cho đặt (không tự chặn bán quá).
- `STOCK_RULE_008`: For products **with variants**, the product-level `stockState` is an **aggregate** of its variants: `IN_STOCK` if **any** variant is `is_available`, else `OUT_OF_STOCK` (only when **all** variants are unavailable). This is what the storefront product-level badge reads (`products.stock_state`) and what the admin inventory grouped view shows. `CONFIRMED_FROM_CODE`
- `STOCK_RULE_009`: **Hiển thị badge tồn kho ở buy-box trang chi tiết sản phẩm (web — chỉ phần nhìn).** Cài đặt trong `WpPurchaseSection.tsx`. Badge chỉ còn **hai trạng thái**: **"Còn hàng" / "Hết hàng"** theo `stockState` (per-variant `is_available` khi đã chọn biến thể; product-level aggregate `STOCK_RULE_008` khi chưa chọn) hoặc `forceOutOfStock`. Thông báo cũ **"Chỉ còn N sản phẩm" / "Sắp hết" đã bị gỡ** cùng với mô hình số lượng (V262). `CONFIRMED_FROM_CODE`

Evidence:

- `AdminInventoryService.java`
- `AdminInventoryController.java` (availability PATCH endpoints)
- `CheckoutService.java` (per-variant `isAvailable` gate)
- `AdminCatalogMutationService.java`
- `V120__drop_stock_receipt_tables.sql`
- `V165__aggregate_variant_product_stock_state.sql` (product-level aggregate trigger — `STOCK_RULE_008`)
- `V259__remove_serial_management.sql` (serial tracking removed — 2026-06-23)
- `V262__inventory_availability_toggle.sql` (boolean availability; backfilled `is_available` + `stock_state` from prior quantities; quantity columns kept dormant — 2026-06-23. Note: `V261` was taken by the return/refund removal, so the inventory migration is `V262`.)
- `bigbike-web/components/wp/WpPurchaseSection.tsx` (`STOCK_RULE_009` — PDP buy-box badge display)

## Bilingual / Auto-translation Rules

> Áp dụng cho **sản phẩm, danh mục, thương hiệu, bài viết, cài đặt (site settings)** (mọi thực thể song ngữ). **Từ 2026-07-03: không còn tự động dịch.** Tính năng tự dịch VI→EN bằng Google Gemini (và cơ chế khoá tay đi kèm `en_overrides`/`en_locked`) đã bị **gỡ bỏ hoàn toàn**. Tiếng Anh nay do admin **tự nhập tay**, dùng cùng 1 bộ ô nhập với nút chuyển VI/EN (`contentLang`) trên form — không đổi UX, chỉ đổi nguồn sinh nội dung EN.

- `TRANSLATION_RULE_001`: **Tiếng Anh nhập tay, không tự sinh.** Admin gõ trực tiếp nội dung tiếng Anh ở từng ô/khối, đổi qua nút VI/EN ở header màn chi tiết (`useContentLang()`) để xem/sửa đúng 1 ngôn ngữ tại 1 thời điểm. Không còn service dịch, không còn endpoint `POST /api/v1/admin/translate` hay `POST /api/v1/admin/translate/backfill`, không còn khoá tay theo trường (`en_overrides`/`en_locked` đã bị xoá khỏi DB). `CONFIRMED_FROM_CODE`
- `TRANSLATION_RULE_002`: **Tiếng Anh bắt buộc CHỈ khi trường tiếng Việt tương ứng đang bắt buộc — áp dụng nhất quán cho mọi thực thể song ngữ.** Trường/khối tiếng Việt nào **không** bắt buộc thì tiếng Anh tương ứng cũng **không** bắt buộc — được lưu dở dang, admin để trống vẫn lưu được (xem `*_RULE_002` riêng từng entity: `PRODUCT_RULE_002`/`CATEGORY_RULE_002`/`BRAND_RULE_002`/`ARTICLE_RULE_002`). Trường tiếng Việt nào **đang** bắt buộc (theo validate hiện tại — request validator backend `CatalogRequestValidator`/`ContentRequestValidator` + Zod `create*Schema` phía admin) thì tiếng Anh tương ứng **cũng bắt buộc**, thiếu → chặn lưu: **Tên** (Sản phẩm/Danh mục/Thương hiệu), **Tiêu đề** (Bài viết), **Tên hiển thị site** — `site_name` (Cài đặt, xem `SETTINGS_RULE_001`). Áp dụng cho **cả tạo mới lẫn sửa bản ghi cũ** — kể cả bản ghi cũ đang thiếu tiếng Anh ở field bắt buộc: sửa dù chỉ một phần nhỏ khác của bản ghi cũng bị chặn lưu tới khi bổ sung đủ EN cho field bắt buộc. **Hai ngoại lệ giữ tùy chọn dù VI bắt buộc** (quyết định business riêng, không đảo theo quy tắc chung): `slug` (đường dẫn URL) — `slugEn` vẫn luôn tùy chọn, không tự sinh (xem `PRODUCT_RULE_003`/`CATEGORY_RULE_003`/`BRAND_RULE_003`/`ARTICLE_RULE_003`); `body`/`bodyBlocks` (nội dung Bài viết) — bản tiếng Anh vẫn tùy chọn, coi như một khối nội dung dài tương tự specifications/FAQ của Sản phẩm, không phải field định danh cốt lõi. Fallback từng-trường về tiếng Việt khi EN trống (`COALESCE`) là **hành vi thiết kế vĩnh viễn** cho field/khối tùy chọn — không phải lưới an toàn tạm thời chờ dịch bù — và cũng là cách xử lý bản ghi cũ đang thiếu EN ở field bắt buộc cho tới khi admin tự bổ sung. `CONFIRMED_FROM_CODE`
- `TRANSLATION_RULE_003`: **Sửa tiếng Anh KHÔNG ảnh hưởng tiếng Việt.** Tiếng Việt là canonical, lưu ở cột chính; tiếng Anh ở cột `*_en` riêng. Thao tác ở chế độ EN chỉ ghi cột tiếng Anh — nay càng tuyệt đối vì không còn cơ chế tự-dịch nào có thể ghi đè ngầm. `CONFIRMED_FROM_CODE`

Evidence: `service/admin/CatalogRequestValidator.java`, `service/admin/ContentRequestValidator.java`, `service/admin/AdminMutationValidators.java` (`validateRequiredText`/`validateRequiredSlug` — nguồn xác định trường VI nào đang bắt buộc), `api/admin/dto/ProductTranslationRequest.java`/`CategoryTranslationRequest.java`/`BrandTranslationRequest.java`/`ArticleTranslationRequest.java` (nơi thêm `@NotBlank` cho `en.name`/`en.title`), `api/admin/dto/settings/UpdateSiteSettingRequest.java` (`valueEn`), `bigbike-admin/src/lib/schemas.js` (`create*Schema`), `bigbike-admin/src/lib/contentLang.js` (`useContentLang`). Đã gỡ (không còn trong repo): `service/integration/GeminiTranslationService.java`, `api/admin/AdminTranslateController.java`, `service/admin/TranslationBackfillService.java`, `service/admin/EnOverridesCodec.java`, `bigbike-admin/src/lib/geminiTranslate.js`, cột `en_overrides`/`en_locked` (dropped ở V312).

## Product Catalog Rules

- `PRODUCT_RULE_001`: Mỗi sản phẩm bắt buộc có **bản nội dung tiếng Việt** (canonical). **Bản tiếng Anh nhập tay** — admin tự gõ qua nút chuyển VI/EN trên form (`TRANSLATION_RULE_001`). **Tên** sản phẩm bắt buộc cả VI lẫn EN — thiếu `translations.en.name` chặn lưu (`TRANSLATION_RULE_002`). Các field/khối còn lại (mô tả, shortDescription, specifications, specStats, faqs, commitments, trustBadges, positiveNotes, negativeNotes, suitabilityAdvisory, descriptionBlocks, specificationsHtml, specStatsHtml, trustBadgesHtml, seoTitle, seoDescription, slug) vẫn **tùy chọn** ở EN — để trống vẫn lưu được, web fallback về tiếng Việt (`PRODUCT_RULE_002`). `CONFIRMED_FROM_CODE`
- `PRODUCT_RULE_002`: Khi đọc nội dung sản phẩm bằng tiếng Anh (`lang=en`), mỗi trường text thiếu bản tiếng Anh sẽ **tự lùi về bản tiếng Việt theo từng trường** (`COALESCE`) — hành vi **thiết kế vĩnh viễn** cho field/khối tùy chọn (`TRANSLATION_RULE_002`), đồng thời áp dụng cho bản ghi cũ đang thiếu EN ở `name` (field bắt buộc) cho tới khi admin tự bổ sung. Một sản phẩm có thể có tên tiếng Anh nhưng mô tả vẫn hiển thị tiếng Việt. `CONFIRMED_FROM_CODE`
- `PRODUCT_RULE_003`: `slug` tiếng Việt là **canonical**; mỗi sản phẩm có thêm `slugEn` (slug tiếng Anh) **tùy chọn**. Khi xem bản tiếng Anh, URL dùng `slugEn`; **trống thì lùi về `slug` tiếng Việt**. Web tra cứu sản phẩm theo **vi HOẶC en** slug (cả hai URL mở cùng sản phẩm). `slugEn` phải **duy nhất** trong phạm vi sản phẩm (không trùng `slugEn` của sản phẩm khác), không được trùng bất kỳ `slug` tiếng Việt nào của sản phẩm khác (cho phép trùng với `slug` tiếng Việt của chính sản phẩm đó; cross-column uniqueness — partial-unique index lo en-vs-en, vi-vs-en enforce ở tầng ứng dụng). Đổi/xoá `slugEn` **tự sinh redirect 301**. `CONFIRMED_FROM_CODE`
- `PRODUCT_RULE_004`: **Phân biệt hành vi `lang=en` giữa WEB và ADMIN.** `PRODUCT_RULE_002` (fallback theo từng trường về tiếng Việt) áp dụng cho cả **web/public** lẫn **bigbike-admin**. Khi admin chuyển sang EN, các **danh sách** (sản phẩm, danh mục, thương hiệu, bài viết, menu, video trang chủ, Slider, Đánh giá, Highlights) **hiển thị đầy đủ toàn bộ bản ghi** — bản ghi chưa có trường tiếng Anh (`name_en`/`title_en`/`label_en` rỗng) **tự động hiển thị tên tiếng Việt làm dự phòng** (không bị ẩn). Hành vi này đồng nhất với `PRODUCT_RULE_002`: fallback từng trường, không ẩn bản ghi. Màn **chi tiết/form soạn thảo** và **ô chọn (selector) trong form** vẫn hiện đầy đủ song ngữ để nhập liệu. Giao diện admin (menu/nút/nhãn) luôn cố định tiếng Việt. `CONFIRMED_FROM_CODE`
- `PRODUCT_RULE_006`: ~~**"Hiển thị trên web" — admin bật/tắt 5 section tab của PDP, opt-in.**~~ **CHỨC NĂNG ĐÃ GỠ (2026-06-22).** Trước đây admin có bảng công tắc bật/tắt riêng 5 section dạng tab (`description, specifications, faqs, videos, reviews`); sản phẩm mới mặc định **tắt hết** (opt-in) → dễ gây "nhập nội dung mà không hiện". Owner chốt **bỏ hẳn**: nay **mọi khối PDP hiện thuần theo nội dung** (giống các khối ngoài tab vốn đã vậy) — không còn bật/tắt từng phần. Đã gỡ ở **admin** (ô "Hiển thị trên web" + `SectionVisibilityEditor` + `SECTION_VISIBILITY_KEYS`/`resolve…Form`) và **web** (gating trong `ProductView.tsx` + xoá `lib/utils/section-visibility.ts`). **Hệ quả:** sản phẩm trước đây bị tắt một phần (nhất là SP tạo mới mặc định tắt) nay sẽ **hiện phần đó nếu có nội dung**. **Backend giữ NGỦ YÊN:** cột `products.section_visibility` + `Product.sectionVisibility` (record) + `UpsertProductRequest.sectionVisibility` không drop (tránh phẫu thuật record/migration) — admin không gửi, web bỏ qua; có thể dọn sau. *(Bối cảnh cũ: bảng từng quản 16 section rồi thu hẹp về 5 tab; `suitability`/`sizeGuide`/`prosCons` đã tách thành khối riêng — nay tất cả gate theo "có nội dung".)* Mục "Tùy chỉnh tab" (V231) vẫn dormant như trước (web render bố cục cố định, `ProductView` truyền `tabs={[]}`). `CONFIRMED_FROM_CODE`
- `PRODUCT_RULE_007`: **Đăng sản phẩm MỚI phải nhập đủ 10 ô bắt buộc.** Khi admin **tạo mới** một sản phẩm (KHÔNG áp dụng khi sửa sản phẩm cũ), phải điền đủ **10 ô**: **Tên, Danh mục, Thương hiệu, SKU, Đường dẫn (slug), Giới tính, Giá bán lẻ, Ảnh đại diện, Mô tả ngắn, Mô tả chi tiết**. FAQ (≥ 1 câu), Số liệu nổi bật (≥ 1 dòng), Dải tin cậy (≥ 1 dòng — `trustBadges`, dải badge trên tên sản phẩm) là **"nên có"** — nhắc nhở để trang đầy đủ hơn, KHÔNG chặn đăng. _(Ô "Quick Answer / câu trả lời nhanh" — làm lại ở V300 sau khi từng bị gỡ hoàn toàn ở V253 — cũng là ô **tùy chọn**, không nằm trong 10 ô bắt buộc này.)_ **Sửa sản phẩm cũ**: SKU/Đường dẫn/Giới tính chỉ là **nhắc nhở** (không chặn lưu); Tên/Danh mục/Thương hiệu/Ảnh/Giá/Mô tả ngắn/Mô tả chi tiết vẫn bắt buộc ở mọi lần đăng theo publish-gate chung `PRODUCT_RULE_005`. Quy tắc này **chặt hơn** publish-gate `PRODUCT_RULE_005` (7 trường) đúng **3 trường thêm khi tạo mới** (SKU, Đường dẫn, Giới tính) và **chỉ kích hoạt thêm 3 trường đó ở luồng tạo mới**. Thực thi **thuần ở frontend admin** (Zod `createProductSchema` `.superRefine` theo cờ `isCreate`; checklist "required" trong form tạo mới) — **backend KHÔNG enforce** field-completeness ở tầng API (tránh vỡ test / luồng import). `CONFIRMED_FROM_CODE`
- `PRODUCT_RULE_008`: **Tên biến thể (variant name) không do admin nhập tay — luôn tự sinh từ thuộc tính.** Backend tính `variant.name` bằng cách nối giá trị các thuộc tính của biến thể theo đúng thứ tự (ví dụ `"Đen bóng - XL"`), ưu tiên nhãn hiển thị trong từ điển thuộc tính (`attribute_values.label`) khi biến thể liên kết được, nếu không thì dùng nguyên văn giá trị đã gửi. Trường `variants[].name` **đã bị gỡ khỏi request API** (`VariantRequest` không còn field này) — admin form cũng không còn ô nhập, chỉ hiển thị tên tự tính làm preview. Biến thể không có thuộc tính nào (hiếm — hiện tại 0 bản ghi) dùng tên dự phòng `"Biến thể N"` theo vị trí trong sản phẩm. Dữ liệu cũ đã được backfill 1 lần sang quy ước mới. `CONFIRMED_FROM_CODE`
- `PRODUCT_RULE_009` (2026-07-04): **Nhập sản phẩm hàng loạt từ file (CSV/JSON) — hành vi bắt buộc.** Danh mục/thương hiệu trong file ghi bằng **slug**, backend tra `findBySlug` — không tồn tại thì báo lỗi dòng đó, **không tự tạo**. Đối chiếu sản phẩm đã có: **SKU sản phẩm ưu tiên, fallback slug**; SKU sản phẩm trùng nhiều bản ghi → lỗi dòng đó (không đoán). **Biến thể đối chiếu theo SKU** (không theo id nội bộ trong file) trước khi ghi — nếu file không gắn đúng id biến thể đã có, hệ thống tự tra theo SKU để cập nhật đúng chỗ thay vì tạo mới, tránh xoá nhầm biến thể cũ (mất lịch sử tồn kho `stock_movements` + reset số lượng về 0). Sản phẩm **mới** luôn vào `DRAFT` bất kể cột trạng thái trong file ghi gì. Sản phẩm **đã có**: cột trạng thái được áp dụng **trừ khi** giá trị là `PUBLISHED` hoặc giá trị legacy/không hợp lệ (`ARCHIVED`/`PENDING`/`PRIVATE`/không nhận dạng được) — các trường hợp này bị bỏ qua kèm cảnh báo, không tự động đăng bán qua nhập file (vì luồng cập nhật sản phẩm không chạy lại `validatePublishReadiness`, chỉ endpoint đăng bán riêng mới chạy). Bước xem trước (validate) gọi thẳng `CatalogRequestValidator.validateProductRequest(..., preview=false, ...)` — **không** dùng `previewProduct` (chế độ preview cố tình bỏ qua bắt buộc tên tiếng Anh và kiểm tra trùng SKU/slug liên sản phẩm, nên không phản ánh đúng những gì lưu thật sẽ chặn). Thiếu tên tiếng Anh → lỗi dòng đó, không tự lấy tên tiếng Việt thay thế. Ảnh: link đã thuộc kho MinIO thì giữ nguyên; link ngoài hoặc để trống → bỏ qua (không tải về), đánh dấu "thiếu ảnh". `CONFIRMED_FROM_CODE`
- `PRODUCT_RULE_010`: **Mỗi sản phẩm chỉ thuộc đúng 1 danh mục.** `ProductEntity.category` là `@ManyToOne` bắt buộc (`nullable = false`) — không phải quan hệ nhiều-nhiều. Bảng liên kết nhiều-nhiều cũ (`product_category_map`) đã bị xoá ở `V110__drop_product_category_map.sql` (2026-05-14); mảng `categories[]` trong response chỉ còn giữ lại để tương thích API, luôn chứa đúng 1 danh mục chính. `CONFIRMED_FROM_CODE`
- `PRODUCT_RULE_011`: **Đơn vị tiền tệ chỉ VND.** `UpsertProductRequest.currency` chỉ chấp nhận đúng chuỗi `"VND"` nếu có gửi lên (regex `^(VND)$`), nhưng tầng lưu trữ **luôn ghi cứng `"VND"`** bất kể client gửi gì (`AdminCatalogMutationService.applyProductPatch`) — không có đường nào tạo được sản phẩm với tiền tệ khác. `CONFIRMED_FROM_CODE`
- `ATTRIBUTE_RULE_001` (2026-07-02): **Admin có thể tạo loại thuộc tính biến thể mới và xóa loại/giá trị thuộc tính — nhưng xóa bị CHẶN khi đang được sử dụng.** Trước rule này, danh sách loại thuộc tính (Color, Size, Bo, Dungtich, Gender, Model...) là dữ liệu di trú từ WordPress, chỉ đổi tên/thêm giá trị được, không tạo mới hay xóa được. Owner chốt: (1) **Tạo mới** một loại thuộc tính (vd "Chất liệu") qua `POST /admin/attributes` — `code` (mã máy, bất biến) tự sinh từ tên theo đúng quy tắc kebab-case bỏ dấu như slug sản phẩm; trùng mã → `409 CONFLICT`. (2) **Xóa** một loại thuộc tính (`DELETE /admin/attributes/{id}`) hoặc một giá trị (`DELETE /admin/attribute-values/{id}`) — **chặn với `409 CONFLICT`** nếu còn **bất kỳ** `product_variant_options` nào (biến thể của sản phẩm bất kỳ) đang liên kết tới nó; thông báo lỗi cho admin biết, **không tự động gỡ khỏi sản phẩm**. Xóa một loại thuộc tính không còn dùng sẽ cascade xóa các giá trị con (cũng đang không dùng) ở tầng DB. `CONFIRMED_FROM_CODE`
- `PRODUCT_RULE_005`: **Điều kiện đăng bán (publish gate) — chỉ tab "Tổng quan" là bắt buộc.** Form sản phẩm chia 4 tab (Tổng quan / Nội dung / Chi tiết / Biến thể). Để chuyển sản phẩm sang trạng thái `PUBLISHED`, admin phải điền đủ **7 trường thuộc tab Tổng quan**: **Tên, Thương hiệu, Danh mục, Ảnh đại diện, Giá bán lẻ (> 0), Mô tả ngắn, Mô tả chi tiết**. Các tab còn lại — gồm **SEO (tiêu đề/mô tả/canonical), thư viện ảnh, video, thông số, FAQ, biến thể…** — **được để trống** và vẫn đăng bán được. Modal checklist tách 2 nhóm: nhóm **bắt buộc** (7 trường trên) và nhóm **"Nên bổ sung để trang đầy đủ & đẹp hơn"** — liệt kê các phần làm trang sản phẩm phong phú hơn (SEO, bộ sưu tập ảnh, ô số liệu nổi bật, ưu/nhược điểm, phù hợp với ai, thông số kỹ thuật, FAQ, biến thể) với dấu ✓ (đã có) / ⚠ (còn trống) để **thông báo cho admin biết**, nhưng **không chặn đăng**. Cổng kiểm tra này là **UX phía admin** (modal checklist khi bấm "Lưu & đăng"): còn trường bắt buộc thiếu thì ẩn nút "Đăng ngay", buộc về sửa; nhóm nên-bổ-sung không ảnh hưởng nút đăng. Lưu nháp (`DRAFT`) / ẩn (`HIDDEN`) không bị gate. Sản phẩm **đã** ở `PUBLISHED` khi lưu lại không kích hoạt modal. **Backend enforce 5 trường lõi (Tên, Thương hiệu, Danh mục, Ảnh đại diện, Giá bán lẻ > 0) tại endpoint publish-status để làm lưới an toàn; SEO không bắt buộc để đăng ở cả backend và frontend. Luồng lưu form (upsert) vẫn gate đủ 7 trường Tổng quan ở frontend.** `CONFIRMED_FROM_CODE`

Evidence:

- `ProductEntity.java`, `ProductSpecificationEntity.java`, `ProductFaqEntity.java` (các cột `*_en`, gồm `suitability_advisory_en` thêm ở V237; `quick_answer_summary_en` từng gỡ ở V253, thêm lại ở V300)
- `JpaCatalogReadRepository.java` (resolve locale + fallback cho web; predicate `name_en` non-blank khi `locale=en` ở `buildProductSpec`/`findCategoriesPaged`; overload `findAllCategories/findAllBrands(locale, strictEnglish)` cho admin)
- `AdminCatalogReadService.java` (truyền `strictEnglish = "en".equals(locale)` cho tree/brands)
- `AdminContentReadService.java` + `JpaContentReadRepository.java` (`findArticlesByFilter`/`findPagesByFilter` lọc `title_en` khi `locale=en`)
- `HomeHighlightsService.java` (`listHighlights(lang, strictEnglish)` — admin ẩn slot chưa có `name_en`)
- `CatalogController.java` (`lang` param)
- `AdminCatalogMutationService.java` (`applyProductPatch` ghi cột `_en` + `slug_en`; validate uniqueness `slugEn`; auto-301 khi `slugEn` đổi)
- `ProductJpaRepository.java` (`findBySlugOrSlugEn`, `findBySlugEn`)
- `V136__add_product_bilingual_content.sql`, `V214__add_product_slug_en.sql`
- `DATA_CONTRACT.md` — "Product bilingual content"
- `bigbike-admin/src/screens/ProductDetailScreen.jsx` — `getPublishReadiness` (publish gate: required = tab Tổng quan; SEO = warning), `PublishChecklistModal` (ẩn nút đăng khi còn blocker), `TAB_SECTIONS.general` (PRODUCT_RULE_005)
- `bigbike-admin/src/screens/product-detail/constants.js` — `getPublishReadiness` (checklist "required" khớp `isCreate`); `bigbike-admin/src/lib/schemas.js` — `createProductSchema` (`.superRefine` theo cờ `isCreate` ép đủ 10 ô khi tạo mới) (PRODUCT_RULE_007)
- PRODUCT_RULE_008: `VariantRequest.java` (không còn field `name`), `AdminCatalogMutationService.java` (`applyVariants` / `deriveVariantName`), `V297__derive_variant_name_from_options.sql`, `bigbike-admin/src/screens/product-detail/VariantEditors.jsx` (`deriveVariantName`, không còn `<Input>` tên biến thể trong `VariantCard`).
- PRODUCT_RULE_009: `service/admin/ProductImportService.java` (toàn bộ pipeline import), `api/admin/AdminProductImportController.java` (`/api/v1/admin/products/import/validate|commit|export`), `persistence/repository/catalog/ProductJpaRepository.java` (`findAllBySkuIgnoreCase`), `persistence/repository/catalog/ProductVariantJpaRepository.java` (`findBySkuIgnoreCase`), `V30__add_inventory_tracking.sql` (`stock_movements.product_variant_id ... on delete cascade` — lý do phải đối chiếu biến thể theo SKU trước khi ghi), `product-import-template.csv`.
- PRODUCT_RULE_010: `ProductEntity.java` (dòng `@JoinColumn(name = "category_id", nullable = false)`), `V110__drop_product_category_map.sql`.
- PRODUCT_RULE_011: `UpsertProductRequest.java` (field `currency`), `AdminCatalogMutationService.java` (`applyProductPatch`, dòng `entity.setCurrency("VND")`).
- ATTRIBUTE_RULE_001: `AdminAttributeController.java` (`createAttribute`, `deleteAttribute`, `deleteAttributeValue`), `AdminAttributeService.java` (cùng tên method + guard `variantOptionRepo.countByAttribute_Id`/`countByAttributeValue_Id` ném `ConflictException`), `ProductVariantOptionJpaRepository.java`, `CreateAttributeRequest.java`, `API_CONTRACT.md` — "Attribute value management — admin catalog endpoints", `bigbike-admin/src/screens/product-detail/VariantEditors.jsx` (`CreateAttributeModal`, nút xóa trong `AttributeRenameModal`/`AttributeValueManagerModal`), `bigbike-admin/src/lib/adminApi.js` (`createAttribute`, `deleteAttribute`, `deleteAttributeValue`).
- PRODUCT_RULE_006 (CHỨC NĂNG GỠ 2026-06-22): admin gỡ ô "Hiển thị trên web" + `SectionVisibilityEditor` + `SECTION_VISIBILITY_KEYS`/`sectionHasContent`/`parse|resolveSectionVisibilityForm` (`ProductDetailScreen.jsx`, `product-detail/ContentEditors.jsx`, `product-detail/constants.js`, `lib/contracts.js`, locales); web gỡ gating trong `components/catalog/ProductView.tsx` + xoá `lib/utils/section-visibility.ts` + bỏ field `lib/contracts/public.ts`. Backend NGỦ YÊN (không drop): `V245__add_product_section_visibility.sql`, `ProductEntity.sectionVisibility`, `Product.sectionVisibility` (record), `UpsertProductRequest.sectionVisibility` + `AdminCatalogMutationService` (present-flag) — còn nhưng không có nguồn ghi/đọc.

## Review And Rating Display Rules

- `REVIEW_RULE_001`: Chỉ review trạng thái **APPROVED** được tính vào điểm trung bình và số lượng đánh giá hiển thị. Review `PENDING` / `SPAM` / `TRASH` không bao giờ xuất hiện trên web và không được tính. `CONFIRMED_FROM_CODE`
- `REVIEW_RULE_002`: Điểm hiển thị = **trung bình cộng** điểm của tất cả review đã duyệt, làm tròn **1 chữ số thập phân, half-up** (ví dụ `[5, 4, 3]` → `4.0`; `[5, 2]` → `3.5`). Quy ước này thống nhất ở 3 nơi: cache `products.rating` (`AdminReviewService.toCachedRating` — `RoundingMode.HALF_UP`), `avgRating` của API public reviews (`PublicReviewService.roundAverage`), và SQL backfill `V63`. Giá trị hiển thị trên web phải khớp giữa `rating` (denormalized trên Product), `avgRating` (API reviews) và trung bình cộng thực tế. `CONFIRMED_FROM_CODE`
- `REVIEW_RULE_003`: **Widget 5 sao chỉ hiển thị khi sản phẩm có ≥ 1 review đã duyệt.** Gate hiển thị bắt buộc dựa trên `ratingCount` / `totalReviews` ≥ 1 (kết hợp `rating > 0` để vẽ), **không được** dùng `rating > 0` làm tín hiệu duy nhất. Sản phẩm 0 review → **ẩn hoàn toàn sao** (có thể thay bằng dòng "Chưa có đánh giá"); cấm mọi giá trị sao mặc định khi thiếu dữ liệu (4.5 ở component, 2 sao của plugin `starRating` theme WP khi `.rating-star` thiếu `data-rating`). Microdata/schema.org `aggregateRating` cũng chỉ được xuất khi có ≥ 1 review đã duyệt. `CONFIRMED_FROM_CODE`
- `REVIEW_RULE_005`: Một review có thể kèm **tối đa 10 ảnh thực tế của khách** (`photos`). Ảnh do khách tải lên phải nằm trong **MinIO** (URL nội bộ `/media/reviews/...`); cấm link ngoài (validate qua `SafeMediaAssetUrlPolicy`). Mỗi ảnh chỉ nhận định dạng ảnh `image/jpeg|png|webp`, ≤ 8MB. Ảnh **chỉ hiển thị công khai khi review ở trạng thái `APPROVED`** — duyệt chung với review theo `REVIEW_RULE_001`, không có moderation riêng cho từng ảnh. Ảnh **không** ảnh hưởng điểm trung bình, `ratingCount`, hay `aggregateRating` (gate hiển thị sao vẫn theo `REVIEW_RULE_003`). `CONFIRMED_FROM_CODE` (field `title` bị gỡ bỏ hoàn toàn — `V298__drop_review_title.sql`, 2026-07-01)
- `REVIEW_RULE_004`: Gate theo `ratingCount` thay vì `rating` vì `rating > 0` không tự chứng minh sản phẩm có review. **Importer WP đã được sửa để không còn tạo rating ảo**: `WordPressProductMapper` không default `4.5` khi WP meta thiếu (để `null`), `ProductImporter` không seed `rating` từ meta sản phẩm, và `ReviewImporter` recompute `rating` / `rating_count` từ review **APPROVED** sau khi import (0 review duyệt → `rating = NULL`, `rating_count = 0`; trung bình HALF_UP 1 decimal — `REVIEW_RULE_002`). Cache rating do đó chỉ phản ánh review thật. Lưu ý: bản ghi tồn dư từ lần import cũ có thể vẫn mang rating ảo cho tới khi re-import / backfill — web vẫn an toàn vì gate theo `ratingCount`. `CONFIRMED_FROM_CODE`

Evidence:

- `AdminReviewService.java` (`updateStatus`, `deleteReview` → `recomputeProductReviewAggregate`: 0 approved → `rating = NULL`, `rating_count = 0`; `toCachedRating` HALF_UP 1 decimal)
- `PublicReviewService.java` (`getProductReviews` — chỉ APPROVED; `roundAverage`)
- `ReviewJpaRepository.java` (`findAggregateByProductIdAndStatus`)
- `WordPressProductMapper.java` (không còn default 4.5), `ProductImporter.java` (không seed rating từ meta), `ReviewImporter.java` (`recomputeRatingCache` từ review APPROVED sau import — `REVIEW_RULE_004`)
- `bigbike-web/lib/rating.ts` (`hasApprovedReviews` — gate dùng chung phía web)
- `bigbike-web/components/ui/RatingStars.tsx`, `ProductCard.tsx`, `ComparisonTable.tsx`, `WpProductSwipeItem.tsx`, `WpPurchaseSection.tsx`, `ReviewsSection.tsx` (các nơi render sao theo `REVIEW_RULE_003`)
- `API_CONTRACT.md` — "Public Reviews Contract"; `DATA_CONTRACT.md` — "Product rating denormalization"

## Category Catalog Rules

- `CATEGORY_RULE_001`: Mỗi danh mục bắt buộc có **bản nội dung tiếng Việt** (canonical). **Bản tiếng Anh nhập tay** — admin tự gõ qua nút chuyển VI/EN trên form (`TRANSLATION_RULE_001`). **Tên** danh mục bắt buộc cả VI lẫn EN — thiếu `translations.en.name` chặn lưu (`TRANSLATION_RULE_002`). Các field còn lại (mô tả, introContent, seoTitle, seoDescription, slug) vẫn tùy chọn ở EN, web fallback về tiếng Việt (`CATEGORY_RULE_002`). `CONFIRMED_FROM_CODE`
- `CATEGORY_RULE_002`: Khi đọc danh mục bằng tiếng Anh (`lang=en`), mỗi trường thiếu bản tiếng Anh sẽ **tự lùi về bản tiếng Việt theo từng trường** — hành vi thiết kế vĩnh viễn cho field tùy chọn, đồng thời áp dụng cho bản ghi cũ đang thiếu EN ở `name` (field bắt buộc) cho tới khi admin tự bổ sung. `CONFIRMED_FROM_CODE`
- `CATEGORY_RULE_003`: `slug` tiếng Việt là **canonical**; mỗi danh mục có thêm `slugEn` (slug tiếng Anh) **tùy chọn**. Khi xem bản tiếng Anh, URL dùng `slugEn`; **trống thì lùi về `slug` tiếng Việt**. Web tra cứu danh mục theo **vi HOẶC en** slug (cả hai URL mở cùng danh mục). `slugEn` phải **duy nhất** trong phạm vi danh mục (không trùng `slugEn` của danh mục khác), không được trùng bất kỳ `slug` tiếng Việt nào của danh mục khác (cho phép trùng với `slug` tiếng Việt của chính danh mục đó; cross-column uniqueness — partial-unique index lo en-vs-en, vi-vs-en enforce ở tầng ứng dụng). Đổi/xoá `slugEn` **tự sinh redirect 301**. `CONFIRMED_FROM_CODE`
- `CATEGORY_RULE_004`: **Xóa mềm danh mục** (đưa vào Thùng rác) đặt cột `deleted = true`. Khi xóa mềm, sản phẩm bên trong danh mục **giữ nguyên** (không bị dồn đi). Khi **Xóa vĩnh viễn danh mục** từ Thùng rác, xóa luôn toàn bộ cây danh mục con bên dưới nó. Mọi sản phẩm trong cả cây (gốc lẫn con) không bị xóa mà **tự động chuyển sang danh mục hệ thống "Chưa phân loại"** (`uncategorized`) trước khi thực sự xóa. Thao tác xóa vĩnh viễn từ Thùng rác không bị chặn vì lý do "còn sản phẩm". Admin (`bigbike-admin`) hiện hộp xác nhận nêu rõ số sản phẩm/danh mục con sẽ chuyển/xóa trước khi thực thi. `CONFIRMED_FROM_CODE` (2026-06-27)
- `CATEGORY_RULE_005`: Danh mục hệ thống **"Chưa phân loại"** (`id`/`slug` = `uncategorized`, tên VI "Chưa phân loại", EN "Uncategorized") là **kho chứa** cho sản phẩm khi danh mục gốc bị xoá vĩnh viễn (`CATEGORY_RULE_004`). Danh mục này **bị khóa**: backend chặn **sửa** (`updateCategory`) và **xóa** (cả xóa mềm và xóa cứng) nó (HTTP 409). Mặc định **`is_visible = false`** — không hiển thị như một danh mục ngoài storefront (menu/lưới danh mục); sản phẩm bên trong vẫn truy cập/tìm kiếm bình thường. `CONFIRMED_FROM_CODE` (2026-06-27)
- `CATEGORY_RULE_006`: **Lọc/duyệt sản phẩm theo danh mục gồm cả danh mục con.** Khi lọc theo một danh mục (admin: tham số `categoryId`; web khách: slug danh mục), kết quả gồm sản phẩm gắn trực tiếp vào danh mục đó **và** sản phẩm gắn vào bất kỳ danh mục con nào bên dưới (đệ quy toàn bộ cây con). Danh mục lá (không con) chỉ trả về đúng sản phẩm gắn trực tiếp — không đổi so với trước. `CONFIRMED_FROM_CODE` (2026-07-03)

Evidence:

- `CategoryEntity.java` (các cột `name_en`, `description_en`, `seo_title_en`, `seo_description_en`, `deleted`)
- `AdminCatalogMutationService.java` (`softDeleteCategory`, `restoreCategory`, `hardDeleteCategory` — gom cây con, chuyển sản phẩm sang `uncategorized` rồi xoá leaves-first; khóa danh mục `uncategorized`)
- `ProductJpaRepository.java` (`findIdsByCategory_IdIn`, `reassignCategory` — bulk chuyển danh mục sản phẩm)
- `V292__ensure_uncategorized_category.sql` (bảo đảm danh mục hệ thống "Chưa phân loại" tồn tại, `is_visible = false`)
- `V293__add_category_deleted.sql` (bổ sung cột `deleted` cho categories)
- `AdminCatalogController.java` (`DELETE /admin/categories/{id}` để xóa mềm, `POST /admin/categories/{id}/restore` để khôi phục, `DELETE /admin/categories/{id}/permanent` để xóa vĩnh viễn)
- `ProductEntity.java` (`category_id` `nullable = false`)
- `JpaCatalogReadRepository.java` (resolve locale + fallback cho category, lọc bỏ `deleted = true`; `resolveCategoryIdWithDescendants`/`resolveCategorySlugWithDescendants` — BFS trong bộ nhớ trên toàn bộ cây danh mục để mở rộng 1 category thành chính nó + mọi danh mục con, dùng cho cả `buildProductSpec` (admin) và `buildPublicListingSpec` (web khách))
- `CatalogController.java` (`lang` param trên category endpoints)

## Brand Catalog Rules

- `BRAND_RULE_001`: Mỗi thương hiệu bắt buộc có **bản nội dung tiếng Việt** (canonical). **Bản tiếng Anh nhập tay** — admin tự gõ qua nút chuyển VI/EN trên form (`TRANSLATION_RULE_001`). **Tên** thương hiệu bắt buộc cả VI lẫn EN — thiếu `translations.en.name` chặn lưu (`TRANSLATION_RULE_002`). Các field còn lại (mô tả, seoTitle, seoDescription, slug) vẫn tùy chọn ở EN, web fallback về tiếng Việt (`BRAND_RULE_002`). `CONFIRMED_FROM_CODE`
- `BRAND_RULE_002`: Khi đọc thương hiệu bằng tiếng Anh (`lang=en`), mỗi trường thiếu bản tiếng Anh sẽ **tự lùi về bản tiếng Việt theo từng trường** — hành vi thiết kế vĩnh viễn cho field tùy chọn, đồng thời áp dụng cho bản ghi cũ đang thiếu EN ở `name` (field bắt buộc) cho tới khi admin tự bổ sung. `CONFIRMED_FROM_CODE`
- `BRAND_RULE_003`: `slug` tiếng Việt là **canonical**; mỗi thương hiệu có thêm `slugEn` (slug tiếng Anh) **tùy chọn**. Khi xem bản tiếng Anh, URL dùng `slugEn`; **trống thì lùi về `slug` tiếng Việt**. Web tra cứu thương hiệu theo **vi HOẶC en** slug (cả hai URL mở cùng thương hiệu). `slugEn` phải **duy nhất** trong phạm vi thương hiệu (không trùng `slugEn` của thương hiệu khác), không được trùng bất kỳ `slug` tiếng Việt nào của thương hiệu khác (cho phép trùng với `slug` tiếng Việt của chính thương hiệu đó; cross-column uniqueness — partial-unique index lo en-vs-en, vi-vs-en enforce ở tầng ứng dụng). Đổi/xoá `slugEn` **tự sinh redirect 301**. `CONFIRMED_FROM_CODE`
- `BRAND_RULE_004`: **Xóa mềm thương hiệu** (gộp với tính năng Ẩn) đặt cột `isVisible = false` (đưa vào Thùng rác). Khôi phục thương hiệu đặt lại `isVisible = true`. Chỉ được **Xóa vĩnh viễn thương hiệu** từ Thùng rác (`isVisible = false`), nếu đang hoạt động thì chặn lại (409). Khi xóa cứng thương hiệu còn sản phẩm, toàn bộ sản phẩm liên kết được **tự động chuyển sang thương hiệu hệ thống "Chưa phân loại"** (`uncategorized-brand`) thay vì để trống — mirror `CATEGORY_RULE_004`. API trả về số sản phẩm đã chuyển (`reassignedProductCount`) để admin biết. Thương hiệu "Chưa phân loại" **bị khoá** (không cho sửa/xoá/khôi phục), **ẩn hoàn toàn khỏi web** (`isVisible = false` vĩnh viễn — không có trang riêng, không menu/bộ lọc, PDP sản phẩm bên trong không hiện mục thương hiệu nào) và **ẩn khỏi danh sách quản lý thương hiệu trong admin** (chỉ hiện tên "Chưa phân loại" trên chính sản phẩm để admin biết cần gán lại). `CONFIRMED_FROM_CODE` (2026-07-03)

Evidence:

- `BrandEntity.java` (các cột `name_en`, `description_en`, `seo_title_en`, `seo_description_en`, `isVisible`)
- `AdminCatalogMutationService.java` (`deleteBrand` đặt `isVisible = false`, `restoreBrand` đặt `isVisible = true`, `hardDeleteBrand` chuyển sản phẩm sang `uncategorized-brand` rồi xóa khỏi DB, khoá sửa/xoá/khôi phục thương hiệu hệ thống)
- `ProductJpaRepository.java` (`reassignBrand` bulk-update)
- `AdminCatalogReadService.java` (`listBrands` loại `uncategorized-brand` khỏi kết quả)
- `JpaCatalogReadRepository.java` (resolve locale + fallback cho brand; `toBrandSummary` trả `null` khi `publicView && !isVisible`)
- `CatalogController.java` (`lang` param trên brand endpoints)
- `AdminCatalogController.java` (`DELETE /admin/brands/{id}` để xóa mềm, `POST /admin/brands/{id}/restore` để khôi phục, `DELETE /admin/brands/{id}/permanent` để xóa vĩnh viễn, trả `reassignedProductCount`)
- Migration `V304__ensure_uncategorized_brand.sql` (seed thương hiệu hệ thống, mirror `V292` của category)

## Article (Blog) Rules

- `ARTICLE_RULE_001`: Mỗi bài viết bắt buộc có **bản nội dung tiếng Việt** (canonical). **Bản tiếng Anh nhập tay** — admin tự gõ qua nút chuyển VI/EN trên form (`TRANSLATION_RULE_001`). **Tiêu đề** bài viết bắt buộc cả VI lẫn EN — thiếu `translations.en.title` chặn lưu (`TRANSLATION_RULE_002`). Các field còn lại — gồm cả **`body`/`bodyBlocks`** (nội dung bài viết), dù bắt buộc ở tiếng Việt, EN vẫn **tùy chọn theo ngoại lệ business riêng** (coi như khối nội dung dài, không phải field định danh) — cùng excerpt, seoTitle, seoDescription, slug đều tùy chọn ở EN, web fallback về tiếng Việt (`ARTICLE_RULE_002`). `CONFIRMED_FROM_CODE`
- `ARTICLE_RULE_002`: Khi đọc bài viết bằng tiếng Anh (`lang=en`), mỗi trường thiếu bản tiếng Anh sẽ **tự lùi về bản tiếng Việt theo từng trường** (title, excerpt, body, seoTitle, seoDescription) — hành vi thiết kế vĩnh viễn cho field/khối tùy chọn (kể cả `body`/`bodyBlocks`), đồng thời áp dụng cho bản ghi cũ đang thiếu EN ở `title` (field bắt buộc) cho tới khi admin tự bổ sung. `CONFIRMED_FROM_CODE`
- `ARTICLE_RULE_003`: `slug` tiếng Việt là **canonical**; mỗi bài viết có thêm `slugEn` (slug tiếng Anh) **tùy chọn**. Khi xem bản tiếng Anh, URL dùng `slugEn`; **trống thì lùi về `slug` tiếng Việt**. Web tra cứu bài viết theo **vi HOẶC en** slug (cả hai URL mở cùng bài viết). `slugEn` phải **duy nhất** trong phạm vi bài viết (không trùng `slugEn` của bài viết khác), không được trùng bất kỳ `slug` tiếng Việt nào của bài viết khác (cho phép trùng với `slug` tiếng Việt của chính bài viết đó; cross-column uniqueness — partial-unique index lo en-vs-en, vi-vs-en enforce ở tầng ứng dụng). **Chỉ áp dụng cho bài viết** (slug cố định cho trang thông tin/chính sách nay nằm tĩnh ở web, xem "Static Page Rules — REMOVED" bên dưới). `CONFIRMED_FROM_CODE`
- `ARTICLE_RULE_004`: Admin có thể đánh dấu một bài viết là **nổi bật** (`featured`). Web hiển thị các bài `featured` ở khu **"Tin nổi bật"**; nếu **không có bài nào** được đánh dấu nổi bật, web **fallback sang các bài viết mới nhất**. `featured` chỉ áp dụng cho bài viết. `CONFIRMED_FROM_CODE`

Evidence:

- `ArticleEntity.java` (các cột `title_en`, `excerpt_en`, `body_en`, `seo_title_en`, `seo_description_en`; `featured`, `seo_no_index`)
- `JpaContentReadRepository.java` (resolve locale + fallback cho article)
- `ContentController.java` (`lang` param trên article endpoints; `listArticles` query param `featured`)
- `AdminContentMutationService.java` (`applyArticlePatch` ghi cột `_en` + `slug_en` + `featured`/`seo_no_index`; validate uniqueness `slugEn`)
- `ArticleJpaRepository.java` (`findBySlug`, `findBySlugEn`)
- `UpsertArticleRequest.java` (`featured`), `SeoMetaRequest.java` (`noIndex`)
- `V138__add_article_page_bilingual_content.sql`, `V216__add_article_slug_en.sql`, `V222__add_article_featured_and_seo_no_index.sql`
- `DATA_CONTRACT.md` — "Article bilingual content", "Article featured + seo_no_index (V222)"

## Site Settings Rules

- `SETTINGS_RULE_001` (cập nhật 2026-07-03 — bỏ tự động dịch): **Cài đặt (site settings) nhập song ngữ bằng nút VI/EN, không còn 2 ô xếp chồng, không còn tự động dịch.** Mỗi setting dịch được (`isTranslatableSetting()` — nhóm `general`/`public_hero`/`seo`, kiểu chữ) hiện **1 ô tại 1 thời điểm**, đổi qua nút VI/EN ở header admin (`useContentLang()`); setting **không** dịch được (ảnh/số/điện thoại/boolean/ngân hàng…) luôn hiện đúng 1 giá trị tiếng Việt, không đổi theo nút ngôn ngữ. Không còn tự động dịch VI→EN khi lưu, không còn endpoint `/admin/translate`, không còn cơ chế khoá `en_locked` (đã xoá khỏi DB cùng Gemini — `TRANSLATION_RULE_001`) — admin **tự gõ** tiếng Anh cho từng setting dịch-được. Setting nào **vừa dịch-được vừa bắt buộc ở VI** (hiện chỉ `site_name`, cờ `.required()` trong `SettingDefinitionRegistry`) thì bản tiếng Anh (`valueEn`) cũng bắt buộc — để trống chặn lưu (`TRANSLATION_RULE_002`). Setting dịch-được khác (không bắt buộc VI) vẫn tùy chọn ở EN, web fallback về tiếng Việt khi trống. `CONFIRMED_FROM_CODE`

Evidence:

- `SiteSettingEntity.java` (không còn cột `en_locked` — dropped V312, trước đó thêm ở V309)
- `AdminSiteSettingResponse.java` / `UpdateSiteSettingRequest.java` / `BatchUpdateSettingsRequest.BatchSettingUpdate` (field `valueEn`; không còn `enLocked`)
- `SettingDefinitionRegistry.java` (`.required()` — hiện chỉ `site_name`), `SettingValueValidator.java` (bắt buộc `valueEn` khi setting translatable + required)
- `AdminSettingsService.java` (`updateSetting`/`batchUpdateSettings` — không còn nhánh xử lý `enLocked`)
- `bigbike-admin/src/screens/settings/SettingField.jsx` (ô đơn theo `useContentLang()`, không còn hint khoá)
- `bigbike-admin/src/screens/SettingsScreen.jsx` (`handleSave` lưu trực tiếp `batchUpdateSettings`, không còn gọi dịch/khoá)
- `screens/settings/constants.js` (`TRANSLATABLE_GROUPS`, `isTranslatableSetting()` — không đổi phạm vi field nào dịch được)

## Static Page Rules — REMOVED (2026-06-24)

> **REMOVED / Deprecated 2026-06-24.** Module "Trang tĩnh CMS" (pages) đã gỡ khỏi toàn stack. 10 trang thông tin (Giới thiệu, Liên hệ, Hướng dẫn + 3 trang con, 4 trang chính sách) nay **đóng cứng trong `bigbike-web`** (nguồn `static-pages.json` + `static-pages.ts`, song ngữ VI/EN cố định trong code). Không còn bảng `pages` (drop ở `V271`), không còn endpoint hay màn admin quản lý trang. Các rule dưới đây **không còn áp dụng** — giữ lại làm lịch sử.
>
> - ~~`PAGE_RULE_001`~~: (cũ) Mỗi trang tĩnh bắt buộc có bản nội dung tiếng Việt; bản tiếng Anh tùy chọn. → Nay nội dung song ngữ cố định trong code web.
> - ~~`PAGE_RULE_002`~~: (cũ) Đọc trang `lang=en` lùi về VI theo từng trường. → Không còn — web tự chọn bản theo locale.
> - ~~`PAGE_RULE_003`~~: (cũ) `slug` của trang dùng chung 1 bản. → Slug nay là route cố định trong web.
>
> Lý do gỡ: 10 trang này nội dung ổn định, không cần admin sửa thường xuyên → chuyển thành tĩnh để đơn giản hoá vận hành. Bài viết (ARTICLE_RULE_*) **vẫn còn** quản lý động qua module Nội dung (Tin tức).

## Contact Page Rules

Trang `/lien-he` là **trang tĩnh hoàn toàn**: bố cục, nhãn, tiêu đề và SEO cố định trong code web (i18n `Contact`/`StaticPage`). Không có hero. Admin **không quản lý** trang này — không trang CMS, không trình dựng khối, không tab Cài đặt. (Đảo bỏ trình dựng `contact_page_layout` trước đây — bảng đã drop ở `V270`.)

- `CONTACT_PAGE_RULE_001`: Bố cục cố định trong code (`bigbike-web/components/contact/ContactPageContent.tsx`): cột thông tin (hotline / địa chỉ / giờ làm việc) + cột kênh trực tuyến (Zalo / Facebook / hotline) + bản đồ Google nhúng dựng từ địa chỉ cửa hàng. `CONFIRMED_FROM_CODE`
- `CONTACT_PAGE_RULE_002`: Số điện thoại / địa chỉ / giờ / URL mạng xã hội **không** hardcode trong code — là dữ liệu CHUNG ở `site_settings` nhóm `contact` (single source dùng chung header/footer/trang Giới thiệu), web đọc qua `GET /api/v1/settings/public`. Vì admin không quản lý trang Liên hệ, nhóm `contact` hiện không có UI sửa (tab Cài đặt ẩn qua `HIDDEN_GROUPS`); muốn cho sửa lại thì bỏ `CONTACT` khỏi `HIDDEN_GROUPS`. `CONFIRMED_FROM_CODE`
- `CONTACT_PAGE_RULE_003`: Nhãn/tiêu đề song ngữ VI/EN qua i18n; không còn endpoint admin/public riêng cho trang (`GET/PUT /api/v1/admin/contact-page` và `GET /api/v1/contact-page` đã gỡ). `CONFIRMED_FROM_CODE`

Evidence:

- `bigbike-web/app/lien-he/page.tsx`, `bigbike-web/components/contact/ContactPageContent.tsx` (trang tĩnh)
- `bigbike-web/messages/{vi,en}.json` namespace `Contact` (nhãn/tiêu đề song ngữ)
- `V270__drop_contact_page_layout.sql` (drop bảng; gỡ controller/service/entity/DTO/converter contact-page + whitelist `SecurityConfig`)
- `bigbike-admin/src/screens/settings/constants.js` (`CONTACT` trong `HIDDEN_GROUPS`)

## Guide Page Builder Rules — REMOVED (2026-06-24)

> **REMOVED / Deprecated 2026-06-24.** Trang Hướng dẫn `/huong-dan` (+ 3 trang con `mua-hang`/`size-mu`/`size-gang-tay`) nay là **nội dung tĩnh trong `bigbike-web`** (nguồn `static-pages.json`). Trình dựng trang Hướng dẫn (GuidePageBuilder) trong admin đã gỡ; bảng `guide_page_layout` drop ở `V271`; endpoint admin/public guide-page không còn. Các rule dưới đây **không còn áp dụng** — giữ lại làm lịch sử.
>
> - ~~`GUIDE_PAGE_RULE_000`~~..~~`GUIDE_PAGE_RULE_003`~~: (cũ) Lưới ô + hero do admin dựng qua trình dựng nhúng trong module Nội dung, lưu ở `guide_page_layout`, web dựng lưới/sidebar từ entries. → Toàn bộ chuyển thành tĩnh trong web.

## Policy Page Rules

Trang chính sách `/chinh-sach/{slug}`: **thân bài nay là nội dung tĩnh trong `bigbike-web`** (nguồn `static-pages.json`, module pages gỡ 2026-06-24 — không còn trang CMS), còn thanh bên (danh sách + thứ tự các trang chính sách) **vẫn** do admin dựng qua **menu vị trí `policy`** — tái dùng trình quản lý Menu sẵn có. Phần menu sidebar GIỮ NGUYÊN; chỉ nguồn thân bài đổi từ CMS sang tĩnh.

- `POLICY_PAGE_RULE_001`: `slug` trên URL khớp trang chính sách tĩnh trong web; web tự phân giải nội dung từ `static-pages.json` (**không còn** gọi `GET /api/v1/pages/{slug}`). Slug không khớp trang tĩnh nào → 404. `CONFIRMED_FROM_CODE`
- `POLICY_PAGE_RULE_002`: Thanh bên dựng từ menu location `policy` (`GET /api/v1/menus/policy`); mỗi mục trỏ tới `/chinh-sach/{page-slug}`, mục đang xem mang trạng thái `current` khi slug khớp. Admin thêm/bớt/sắp thứ tự mục như menu header/footer. Chỉ mục `ACTIVE` hiển thị. `CONFIRMED_FROM_CODE`
- `POLICY_PAGE_RULE_003`: `policy` là một system menu slot (cạnh `primary`/`footer`/`guide`) — admin không tạo/xóa container, chỉ quản lý mục bên trong. Nhãn mục song ngữ (`label` VI + `label_en`), lùi về VI khi thiếu EN (giống menu khác). V226 seed sẵn 4 mục chính sách. `CONFIRMED_FROM_CODE`

Evidence:

- `MenuLocations.java` (`POLICY`), `AdminMenuService.java`, `PublicMenuController.java`
- `V226__seed_policy_menu_slot.sql`
- `bigbike-web/app/chinh-sach/[slug]/page.tsx` (render động), `bigbike-admin/src/screens/MenuScreen.jsx` (slot `policy`)

## WebSocket Rules

- WebSocket STOMP connect must include native header `Authorization: Bearer <token>`. `CONFIRMED_FROM_CODE`
- Only `ADMIN` and `SUPER_ADMIN` roles are allowed to connect. `CONFIRMED_FROM_CODE`
- Current confirmed topic is `/topic/admin/orders`. `CONFIRMED_FROM_CODE`
- Confirmed event type in the checkout flow is `NEW_ORDER`; `ORDER_STATUS_CHANGED` is declared in the event record comment but needs a live sender check before relying on it. `NEEDS_VERIFICATION`

Evidence:

- `WebSocketConfig.java`
- `AdminOrderWsService.java`
- `OrderWsEvent.java`
- `adminWebSocket.js`

## Redirect And Integration Rules

- Internal redirect endpoints are `permitAll` in Spring Security and are expected to be locked down at infra layer in production. `CONFIRMED_FROM_CONFIG`
- `PAY_RULE_001`: Online checkout no longer asks the customer to choose a payment method (owner decision 2026-06-23). The web checkout and quick-buy ("Mua nhanh") forms send no `paymentMethod`, and the order is stored with `paymentMethod = null`. The field is optional on the API; the only accepted explicit codes remain `COD` and `BACS` (for legacy/backward-compatible callers). There is no automatic payment gateway — all payment is reconciled manually by the admin. `CONFIRMED_FROM_CODE`
- `PAY_RULE_002`: Manual-confirm reconciliation. New online orders are created in `PROCESSING` with `paymentStatus = UNPAID`; the admin reconciles the money offline (cash on delivery or bank transfer, however the customer pays) and marks the order paid via `PATCH /admin/orders/{id}/payment-status` whenever convenient — payment does not gate completion (`ORDER_RULE_001`). No payment redirect, no provider webhook. Legacy `BACS` orders still start in `ON_HOLD`. The Alepay/ZaloPay online-gateway plan was dropped. `CONFIRMED_FROM_CODE`
- `SHIP_RULE_001`: Shipping-method choice and shipping fee removed (owner decision 2026-06-23). Online checkout and quick-buy no longer ask the customer to pick a shipping method, and online orders carry **no shipping fee** (`shippingAmount = 0`, `totalAmount = subtotal − discount`). The whole admin shipping-management module (shipping zones + shipping methods, `/api/v1/admin/shipping/*`, the admin "Vận chuyển" screen, the `shipping_zones`/`shipping_methods` tables, and the `shipping.read`/`shipping.write` permissions) was dropped (migration `V264`). **Delivery is free to the customer (owner decision 2026-06-25): no shipping fee is charged either in-system or offline.** The web checkout summary and the cart page therefore display "Miễn phí vận chuyển" (free shipping) — superseding the earlier cart copy that mentioned a 35.000đ fee / free-over-2M threshold. The shop still arranges delivery; the order's shipping **address** and delivery/fulfillment **status** (tracking, carrier) are unchanged; `order_shipping_items` is kept only as a historical snapshot for legacy/imported orders and gets no new rows. `CONFIRMED_FROM_CODE`
- No external shipping carrier integration was confirmed in active repo code. `NOT_FOUND_IN_REPO`

Evidence:

- `SecurityConfig.java`
- `CheckoutService.java`, `CheckoutOptionsResponse.java`, `V264__remove_shipping_methods.sql`
- repo search for payment/shipping providers

> **Accounts Receivable (công nợ / bán chịu) was REMOVED platform-wide (2026-06-23).** The credit-sale flow (POS `CREDIT` payment method), per-customer credit limit / payment terms, the `accounts_receivable` ledger, receivable payments, write-off, and the overdue scheduler no longer exist. (POS itself was subsequently removed entirely, 2026-06-23, online-only — see "POS Rules".) There is no downstream debt-collection process. The old `AR_RULE_*` IDs and the three receivable state machines were deleted.

## Reports Rules

Status: `CONFIRMED_FROM_CODE` — derived from audit of `AdminReportService.java`, `OrderJpaRepository.java`, `OrderLineItemJpaRepository.java`, `AdminCustomerService.java`.

> **Refund metrics were removed (2026-06-23)** together with the refund feature: `refundAmount`, `netRevenue` (= paid − refund), and the `REFUNDED`-related status handling no longer exist. Net revenue now equals paid revenue.

### Metric Definitions

- `REPORT_RULE_001`: **GMV (`grossOrderValue`)** = `SUM(totalAmount)` for orders where `placedAt` is within the requested range AND `status NOT IN ('CANCELLED', 'FAILED')`. `CONFIRMED_FROM_CODE`
- `REPORT_RULE_002`: **Paid Revenue (`paidRevenue`)** = `SUM(paidAmount)` for orders where `placedAt` is within the requested range AND `paymentStatus = 'PAID'` AND `status NOT IN ('CANCELLED', 'FAILED')`. `paidAmount` is the total cash collected. `PARTIALLY_PAID` was removed in V114; the `REFUNDED` payment status was removed 2026-06-23. `CONFIRMED_FROM_CODE`
- `REPORT_RULE_005`: **Order Count (`orderCount`)** = `COUNT(id)` excluding `status IN ('CANCELLED', 'FAILED')`. `CONFIRMED_FROM_CODE`
- `REPORT_RULE_006`: **Average Order Value (`avgOrderValue`)** = `grossOrderValue / orderCount`. Returns zero if `orderCount = 0`. `CONFIRMED_FROM_CODE`

### Excluded Status Sets

- `REPORT_RULE_007`: Both revenue and ranking metrics exclude `status IN ('CANCELLED', 'FAILED')` — applied to GMV, paidRevenue, orderCount, avgOrderValue, daily revenue, topProducts and topCustomers rankings. (The separate `REFUNDED` ranking exclusion was removed 2026-06-23.) `CONFIRMED_FROM_CODE`

### Timezone

- `REPORT_RULE_008`: All date boundaries (`from`, `to` params) are parsed in `Asia/Ho_Chi_Minh` timezone. Daily revenue grouping uses `AT TIME ZONE 'Asia/Ho_Chi_Minh'`. This matches `AdminDashboardService` behavior. `CONFIRMED_FROM_CODE`

### Product And Customer Rankings

- `REPORT_RULE_009`: **topProducts** uses `COALESCE(product_pk, product_id::text)` as group key. Admin-created products have `product_id = NULL` and `product_pk` set; regular products have both. Filtering `product_id IS NOT NULL` (legacy behavior) silently excludes admin-created products. `CONFIRMED_FROM_CODE`
- `REPORT_RULE_010`: **topCustomers** uses `COALESCE(customer_id::text, customer_email)` as group key to prevent the same customer appearing as multiple rows if their email changed over time. Display email is `MAX(customer_email)`. `CONFIRMED_FROM_CODE`

Evidence:

- `AdminReportService.java`
- `OrderJpaRepository.java`
- `OrderLineItemJpaRepository.java`
- `AdminCustomerService.java`

## Returns And Refunds

> **Returns (RMA) and Refunds were REMOVED platform-wide (2026-06-23).** The customer return flow, the admin returns module, per-item inspection, RMA stock-restore, and **every refund path** (cancel-time refund, POS refund, manual order refund) no longer exist. The `returns` / `return_items` / `return_history` tables, the `refund_amount` / `refund_reason` / `refunded_at` order & payment columns, and the `REFUNDED` order/payment status were dropped. Old `REFUNDED` orders were migrated to `CANCELLED`. The old `RETURN_RULE_*` IDs, the return state machine, and `RefundService` were deleted.
>
> A **paid order is now cancelled directly** — the admin reconciles the money manually outside the system (see `ORDER_RULE_004`). There is no system-tracked return lifecycle.
>
> **Customer-facing return/exchange policy text is kept** (CMS policy pages — including "Chính sách bảo hành" — and the per-product "Đổi size 30 ngày" line). That is a **manual commitment shown to customers**, not a system feature. (The separate warranty-lookup feature/page was removed entirely 2026-06-23, V266.)

## Contact Inbox Rules

> Removed. The public contact form and admin contact inbox were deleted (migration `V128__drop_contact_messages.sql`). Customers reach the shop through the contact info on `/lien-he` (hotline, Zalo, Facebook, address, map) — a **static page** (see "Contact Page Rules"); the shared contact values come from `site_settings` group `contact`. There is still no contact form, no `contact_messages` table, and no `contact.read`/`contact.write` permissions.
