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

Evidence:

- `AdminMediaService.java`
- `AdminMediaP0Test.java`

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

## Product Catalog Rules

- `PRODUCT_RULE_001`: Mỗi sản phẩm bắt buộc có **bản nội dung tiếng Việt** (canonical). **Bản tiếng Anh là tùy chọn** — admin có thể tạo/sửa sản phẩm mà không nhập bản tiếng Anh. `CONFIRMED_FROM_CODE`
- `PRODUCT_RULE_002`: Khi đọc nội dung sản phẩm bằng tiếng Anh (`lang=en`), mỗi trường text thiếu bản tiếng Anh sẽ **tự lùi về bản tiếng Việt theo từng trường** (`COALESCE`). Một sản phẩm có thể có tên tiếng Anh nhưng mô tả vẫn hiển thị tiếng Việt. `CONFIRMED_FROM_CODE`
- `PRODUCT_RULE_003`: `slug` tiếng Việt là **canonical**; mỗi sản phẩm có thêm `slugEn` (slug tiếng Anh) **tùy chọn**. Khi xem bản tiếng Anh, URL dùng `slugEn`; **trống thì lùi về `slug` tiếng Việt**. Web tra cứu sản phẩm theo **vi HOẶC en** slug (cả hai URL mở cùng sản phẩm). `slugEn` phải **duy nhất** trong phạm vi sản phẩm và **không được trùng** bất kỳ `slug` tiếng Việt nào của sản phẩm khác (cross-column uniqueness — partial-unique index lo en-vs-en, vi-vs-en enforce ở tầng ứng dụng). Đổi/xoá `slugEn` **tự sinh redirect 301**. `CONFIRMED_FROM_CODE`
- `PRODUCT_RULE_004`: **Phân biệt hành vi `lang=en` giữa WEB và ADMIN.** `PRODUCT_RULE_002` (fallback theo từng trường về tiếng Việt) chỉ áp dụng cho **web/public**. Ở **bigbike-admin**, nút VI/EN là **strict English**: khi chọn EN, các **danh sách** (sản phẩm, danh mục, thương hiệu, bài viết/trang, menu, phương thức vận chuyển, video trang chủ, Highlights, Sản phẩm nổi bật) **ẩn hẳn** bản ghi chưa có trường tên/tiêu đề tiếng Anh (`name_en`/`title_en`/`label_en` rỗng) — KHÔNG lùi về tiếng Việt — để admin biết mục nào chưa dịch. Các màn **vận hành tham chiếu sản phẩm** (Đánh giá, Slider, Tồn kho) cũng strict: ở EN hiện tên SP tiếng Anh và ẩn bản ghi có SP chưa dịch (Đánh giá lọc server-side qua `name_en` để phân trang đúng; Slider/Tồn kho lọc client-side — Tồn kho dùng tổng trang chưa lọc nên ở EN trang có thể ít dòng hơn). Riêng **màn chi tiết/form soạn thảo** và **ô chọn (selector) trong form** vẫn hiện đầy đủ song ngữ/không strict để nhập liệu được. Giao diện admin (menu/nút/nhãn) luôn cố định tiếng Việt. `CONFIRMED_FROM_CODE`
- `PRODUCT_RULE_006`: ~~**"Hiển thị trên web" — admin bật/tắt 5 section tab của PDP, opt-in.**~~ **CHỨC NĂNG ĐÃ GỠ (2026-06-22).** Trước đây admin có bảng công tắc bật/tắt riêng 5 section dạng tab (`description, specifications, faqs, videos, reviews`); sản phẩm mới mặc định **tắt hết** (opt-in) → dễ gây "nhập nội dung mà không hiện". Owner chốt **bỏ hẳn**: nay **mọi khối PDP hiện thuần theo nội dung** (giống các khối ngoài tab vốn đã vậy) — không còn bật/tắt từng phần. Đã gỡ ở **admin** (ô "Hiển thị trên web" + `SectionVisibilityEditor` + `SECTION_VISIBILITY_KEYS`/`resolve…Form`) và **web** (gating trong `ProductView.tsx` + xoá `lib/utils/section-visibility.ts`). **Hệ quả:** sản phẩm trước đây bị tắt một phần (nhất là SP tạo mới mặc định tắt) nay sẽ **hiện phần đó nếu có nội dung**. **Backend giữ NGỦ YÊN:** cột `products.section_visibility` + `Product.sectionVisibility` (record) + `UpsertProductRequest.sectionVisibility` không drop (tránh phẫu thuật record/migration) — admin không gửi, web bỏ qua; có thể dọn sau. *(Bối cảnh cũ: bảng từng quản 16 section rồi thu hẹp về 5 tab; `suitability`/`sizeGuide`/`prosCons` đã tách thành khối riêng — nay tất cả gate theo "có nội dung".)* Mục "Tùy chỉnh tab" (V231) vẫn dormant như trước (web render bố cục cố định, `ProductView` truyền `tabs={[]}`). `CONFIRMED_FROM_CODE`
- `PRODUCT_RULE_007`: **Đăng sản phẩm MỚI phải nhập đủ 13 ô bắt buộc.** Khi admin **tạo mới** một sản phẩm (KHÔNG áp dụng khi sửa sản phẩm cũ), phải điền đủ **13 ô**: **Tên, Danh mục, Thương hiệu, SKU, Đường dẫn (slug), Giới tính, Giá bán lẻ, Ảnh đại diện, Mô tả ngắn, Mô tả sản phẩm, FAQ (≥ 1 câu), Số liệu nổi bật (≥ 1 dòng), Dải tin cậy (≥ 1 dòng — `trustBadges`, dải badge trên tên sản phẩm)**. _(Ô "Quick Answer / câu trả lời nhanh" đã gỡ hoàn toàn ở V250.)_ **Sửa sản phẩm cũ** vẫn lưu nhanh được — các ô đó chỉ là **nhắc nhở**, không chặn lưu. Quy tắc này **chặt hơn** publish-gate `PRODUCT_RULE_005` (7 trường) và **chỉ kích hoạt ở luồng tạo mới**. Thực thi **thuần ở frontend admin** (Zod `createProductSchema` `.superRefine` theo cờ `isCreate`; checklist "required" trong form tạo mới) — **backend KHÔNG enforce** field-completeness ở tầng API (tránh vỡ test / luồng import). `CONFIRMED_FROM_CODE`
- `PRODUCT_RULE_005`: **Điều kiện đăng bán (publish gate) — chỉ tab "Tổng quan" là bắt buộc.** Form sản phẩm chia 4 tab (Tổng quan / Nội dung / Chi tiết / Biến thể). Để chuyển sản phẩm sang trạng thái `PUBLISHED`, admin phải điền đủ **7 trường thuộc tab Tổng quan**: **Tên, Thương hiệu, Danh mục, Ảnh đại diện, Giá bán lẻ (> 0), Mô tả ngắn, Mô tả chi tiết**. Các tab còn lại — gồm **SEO (tiêu đề/mô tả/canonical), thư viện ảnh, video, thông số, FAQ, biến thể…** — **được để trống** và vẫn đăng bán được. Modal checklist tách 2 nhóm: nhóm **bắt buộc** (7 trường trên) và nhóm **"Nên bổ sung để trang đầy đủ & đẹp hơn"** — liệt kê các phần làm trang sản phẩm phong phú hơn (SEO, bộ sưu tập ảnh, ô số liệu nổi bật, ưu/nhược điểm, phù hợp với ai, thông số kỹ thuật, FAQ, biến thể) với dấu ✓ (đã có) / ⚠ (còn trống) để **thông báo cho admin biết**, nhưng **không chặn đăng**. Cổng kiểm tra này là **UX phía admin** (modal checklist khi bấm "Lưu & đăng"): còn trường bắt buộc thiếu thì ẩn nút "Đăng ngay", buộc về sửa; nhóm nên-bổ-sung không ảnh hưởng nút đăng. Lưu nháp (`DRAFT`) / ẩn (`HIDDEN`) không bị gate. Sản phẩm **đã** ở `PUBLISHED` khi lưu lại không kích hoạt modal. Backend không enforce field-completeness ở tầng API — gate thuần ở frontend. `CONFIRMED_FROM_CODE`

Evidence:

- `ProductEntity.java`, `ProductSpecificationEntity.java`, `ProductFaqEntity.java` (các cột `*_en`, gồm `suitability_advisory_en` thêm ở V237; `quick_answer_summary_en` đã gỡ ở V250)
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
- `bigbike-admin/src/screens/ProductDetailScreen.jsx` — `createProductSchema` (`.superRefine` theo cờ `isCreate` ép đủ 14 ô khi tạo mới), checklist "required" trong form tạo mới (PRODUCT_RULE_007); ô "Dải tin cậy" gate theo `form.trustBadges`
- PRODUCT_RULE_006 (CHỨC NĂNG GỠ 2026-06-22): admin gỡ ô "Hiển thị trên web" + `SectionVisibilityEditor` + `SECTION_VISIBILITY_KEYS`/`sectionHasContent`/`parse|resolveSectionVisibilityForm` (`ProductDetailScreen.jsx`, `product-detail/ContentEditors.jsx`, `product-detail/constants.js`, `lib/contracts.js`, locales); web gỡ gating trong `components/catalog/ProductView.tsx` + xoá `lib/utils/section-visibility.ts` + bỏ field `lib/contracts/public.ts`. Backend NGỦ YÊN (không drop): `V245__add_product_section_visibility.sql`, `ProductEntity.sectionVisibility`, `Product.sectionVisibility` (record), `UpsertProductRequest.sectionVisibility` + `AdminCatalogMutationService` (present-flag) — còn nhưng không có nguồn ghi/đọc.

## Review And Rating Display Rules

- `REVIEW_RULE_001`: Chỉ review trạng thái **APPROVED** được tính vào điểm trung bình và số lượng đánh giá hiển thị. Review `PENDING` / `SPAM` / `TRASH` không bao giờ xuất hiện trên web và không được tính. `CONFIRMED_FROM_CODE`
- `REVIEW_RULE_002`: Điểm hiển thị = **trung bình cộng** điểm của tất cả review đã duyệt, làm tròn **1 chữ số thập phân, half-up** (ví dụ `[5, 4, 3]` → `4.0`; `[5, 2]` → `3.5`). Quy ước này thống nhất ở 3 nơi: cache `products.rating` (`AdminReviewService.toCachedRating` — `RoundingMode.HALF_UP`), `avgRating` của API public reviews (`PublicReviewService.roundAverage`), và SQL backfill `V63`. Giá trị hiển thị trên web phải khớp giữa `rating` (denormalized trên Product), `avgRating` (API reviews) và trung bình cộng thực tế. `CONFIRMED_FROM_CODE`
- `REVIEW_RULE_003`: **Widget 5 sao chỉ hiển thị khi sản phẩm có ≥ 1 review đã duyệt.** Gate hiển thị bắt buộc dựa trên `ratingCount` / `totalReviews` ≥ 1 (kết hợp `rating > 0` để vẽ), **không được** dùng `rating > 0` làm tín hiệu duy nhất. Sản phẩm 0 review → **ẩn hoàn toàn sao** (có thể thay bằng dòng "Chưa có đánh giá"); cấm mọi giá trị sao mặc định khi thiếu dữ liệu (4.5 ở component, 2 sao của plugin `starRating` theme WP khi `.rating-star` thiếu `data-rating`). Microdata/schema.org `aggregateRating` cũng chỉ được xuất khi có ≥ 1 review đã duyệt. `CONFIRMED_FROM_CODE`
- `REVIEW_RULE_005`: Một review có thể kèm **tiêu đề tuỳ chọn** (`title`, ≤160 ký tự) và **tối đa 10 ảnh thực tế của khách** (`photos`). Ảnh do khách tải lên phải nằm trong **MinIO** (URL nội bộ `/media/reviews/...`); cấm link ngoài (validate qua `SafeMediaAssetUrlPolicy`). Mỗi ảnh chỉ nhận định dạng ảnh `image/jpeg|png|webp`, ≤ 8MB. Tiêu đề + ảnh **chỉ hiển thị công khai khi review ở trạng thái `APPROVED`** — duyệt chung với review theo `REVIEW_RULE_001`, không có moderation riêng cho từng ảnh. Tiêu đề/ảnh **không** ảnh hưởng điểm trung bình, `ratingCount`, hay `aggregateRating` (gate hiển thị sao vẫn theo `REVIEW_RULE_003`). `CONFIRMED_FROM_CODE`
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

- `CATEGORY_RULE_001`: Mỗi danh mục bắt buộc có **bản nội dung tiếng Việt** (canonical). **Bản tiếng Anh là tùy chọn**. `CONFIRMED_FROM_CODE`
- `CATEGORY_RULE_002`: Khi đọc danh mục bằng tiếng Anh (`lang=en`), mỗi trường thiếu bản tiếng Anh sẽ **tự lùi về bản tiếng Việt theo từng trường**. `CONFIRMED_FROM_CODE`
- `CATEGORY_RULE_003`: `slug` tiếng Việt là **canonical**; mỗi danh mục có thêm `slugEn` (slug tiếng Anh) **tùy chọn**. Khi xem bản tiếng Anh, URL dùng `slugEn`; **trống thì lùi về `slug` tiếng Việt**. Web tra cứu danh mục theo **vi HOẶC en** slug (cả hai URL mở cùng danh mục). `slugEn` phải **duy nhất** trong phạm vi danh mục và **không được trùng** bất kỳ `slug` tiếng Việt nào của danh mục khác (cross-column uniqueness — partial-unique index lo en-vs-en, vi-vs-en enforce ở tầng ứng dụng). Đổi/xoá `slugEn` **tự sinh redirect 301**. `CONFIRMED_FROM_CODE`
- `CATEGORY_RULE_004`: **Xoá vĩnh viễn danh mục** xoá luôn **toàn bộ cây danh mục con** bên dưới nó trong cùng một thao tác. Chỉ cho phép xoá khi **không danh mục nào trong cả cây** (danh mục gốc lẫn mọi danh mục con) còn sản phẩm xếp làm danh mục chính; nếu còn → **chặn** (HTTP 409) kèm yêu cầu admin chuyển sản phẩm sang danh mục khác trước. **Không bao giờ xoá sản phẩm** như tác dụng phụ của việc xoá danh mục (sản phẩm bắt buộc có đúng 1 danh mục — `category_id NOT NULL`, xem `DATA_CONTRACT.md`). `CONFIRMED_FROM_CODE`

Evidence:

- `CategoryEntity.java` (các cột `name_en`, `description_en`, `seo_title_en`, `seo_description_en`)
- `AdminCatalogMutationService.java` (`hardDeleteCategory` — gom cây con, chặn khi còn sản phẩm, xoá leaves-first)
- `AdminCatalogController.java` (`DELETE /admin/categories/{id}`, permission `catalog.update`)
- `ProductEntity.java` (`category_id` `nullable = false`)
- `JpaCatalogReadRepository.java` (resolve locale + fallback cho category)
- `CatalogController.java` (`lang` param trên category endpoints)
- `AdminCatalogMutationService.java` (`applyCategoryPatch` ghi cột `_en` + `slug_en`; validate uniqueness `slugEn`; auto-301 khi `slugEn` đổi)
- `CategoryJpaRepository.java` (`findBySlugOrSlugEn`, `findBySlugEn`)
- `V137__add_category_brand_bilingual_content.sql`, `V213__add_category_slug_en.sql`
- `DATA_CONTRACT.md` — "Category bilingual content"

## Brand Catalog Rules

- `BRAND_RULE_001`: Mỗi thương hiệu bắt buộc có **bản nội dung tiếng Việt** (canonical). **Bản tiếng Anh là tùy chọn**. `CONFIRMED_FROM_CODE`
- `BRAND_RULE_002`: Khi đọc thương hiệu bằng tiếng Anh (`lang=en`), mỗi trường thiếu bản tiếng Anh sẽ **tự lùi về bản tiếng Việt theo từng trường**. `CONFIRMED_FROM_CODE`
- `BRAND_RULE_003`: `slug` tiếng Việt là **canonical**; mỗi thương hiệu có thêm `slugEn` (slug tiếng Anh) **tùy chọn**. Khi xem bản tiếng Anh, URL dùng `slugEn`; **trống thì lùi về `slug` tiếng Việt**. Web tra cứu thương hiệu theo **vi HOẶC en** slug (cả hai URL mở cùng thương hiệu). `slugEn` phải **duy nhất** trong phạm vi thương hiệu và **không được trùng** bất kỳ `slug` tiếng Việt nào của thương hiệu khác (cross-column uniqueness — partial-unique index lo en-vs-en, vi-vs-en enforce ở tầng ứng dụng). Đổi/xoá `slugEn` **tự sinh redirect 301**. `CONFIRMED_FROM_CODE`

Evidence:

- `BrandEntity.java` (các cột `name_en`, `description_en`, `seo_title_en`, `seo_description_en`)
- `JpaCatalogReadRepository.java` (resolve locale + fallback cho brand)
- `CatalogController.java` (`lang` param trên brand endpoints)
- `AdminCatalogMutationService.java` (`applyBrandPatch` ghi cột `_en` + `slug_en`; validate uniqueness `slugEn`; auto-301 khi `slugEn` đổi)
- `BrandJpaRepository.java` (`findBySlugOrSlugEn`, `findBySlugEn`)
- `V137__add_category_brand_bilingual_content.sql`, `V215__add_brand_slug_en.sql`
- `DATA_CONTRACT.md` — "Brand bilingual content"

## Article (Blog) Rules

- `ARTICLE_RULE_001`: Mỗi bài viết bắt buộc có **bản nội dung tiếng Việt** (canonical). **Bản tiếng Anh là tùy chọn**. `CONFIRMED_FROM_CODE`
- `ARTICLE_RULE_002`: Khi đọc bài viết bằng tiếng Anh (`lang=en`), mỗi trường thiếu bản tiếng Anh sẽ **tự lùi về bản tiếng Việt theo từng trường** (title, excerpt, body, seoTitle, seoDescription). `CONFIRMED_FROM_CODE`
- `ARTICLE_RULE_003`: `slug` tiếng Việt là **canonical**; mỗi bài viết có thêm `slugEn` (slug tiếng Anh) **tùy chọn**. Khi xem bản tiếng Anh, URL dùng `slugEn`; **trống thì lùi về `slug` tiếng Việt**. Web tra cứu bài viết theo **vi HOẶC en** slug (cả hai URL mở cùng bài viết). `slugEn` phải **duy nhất** trong phạm vi bài viết và **không được trùng** bất kỳ `slug` tiếng Việt nào của bài viết khác (cross-column uniqueness — partial-unique index lo en-vs-en, vi-vs-en enforce ở tầng ứng dụng). **Chỉ áp dụng cho bài viết** (slug cố định cho trang thông tin/chính sách nay nằm tĩnh ở web, xem "Static Page Rules — REMOVED" bên dưới). `CONFIRMED_FROM_CODE`
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
