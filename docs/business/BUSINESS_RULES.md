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
- `variant.sku` is the **selling SKU** — the code used at POS, cart, checkout, inventory, and returns to identify the actual unit being sold. `CONFIRMED_FROM_CODE`
- **`PRODUCT_RULE_SKU_001` — every variant must have a SKU, and variant SKUs must be unique.** On the admin product upsert API, each variant in the `variants[]` list must carry a non-blank `sku` (`@NotBlank` on `VariantRequest.sku`; admin form blocks save with a per-row error). Variant SKUs are **globally unique, case-insensitive** across all products: the backend rejects a save that reuses a SKU held by another variant (and the admin form flags duplicates within the same product before submit). `product.sku` stays optional and is **not** part of the uniqueness check. `CONFIRMED_FROM_CODE`
- Uniqueness is enforced at the DB level by a partial unique index `ux_product_variants_sku_lower` on `lower(sku)` (V244), which also backfilled SKUs for legacy/WP-import variants that had none and de-duplicated pre-existing collisions. The application layer pre-validates duplicates to return a friendly error before hitting the constraint. `CONFIRMED_FROM_CODE`
- The `product_variants.sku varchar(100)` column stays nullable so the index ignores any future null (the requirement is a **write-time validation**, not a `NOT NULL` schema change); `products.sku varchar(100)` remains fully optional with no uniqueness. `CONFIRMED_FROM_CODE`
- When snapshotting line items into cart/order, the system uses `variant.sku` if present, otherwise falls back to `product.sku`. This fallback covers single-variant or no-variant products where the parent SKU is the selling code. `CONFIRMED_FROM_CODE`
- Inventory search and serial-tracking views read both `p.sku` and `v.sku` so admin tools can locate units by either code. `CONFIRMED_FROM_CODE`

Evidence:

- `ProductEntity.java` (line 34)
- `ProductVariantEntity.java` (line 29)
- `VariantRequest.java` (`@NotBlank` on `sku` — admin upsert write-time requirement)
- `ProductDetailScreen.jsx` / `schemas.js` (admin form per-row SKU required validation)
- `PosOrderService.java` (line 233 — fallback `variant.getSku() != null ? variant.getSku() : product.getSku()`)
- `CartService.java` (line 153 — same fallback)
- `CheckoutService.java` (line 723 — same fallback)
- `V51__add_serial_tracking.sql` (lines 123, 127 — `variant_sku`, `product_sku` in `serial_inventory_view`)
- `V1__create_catalog_content_tables.sql` (lines 65, 166)

## Coupon Rules

- One coupon per cart is enforced in service logic and backed by DB uniqueness. `CONFIRMED_FROM_CODE`
- Applying a coupon locks the coupon row and validates status, expiry, usage limit, and minimum amount. `CONFIRMED_FROM_CODE`
- Cart refresh removes coupons that become invalid after apply. `CONFIRMED_FROM_CODE`
- Checkout revalidates coupons from fresh DB state and atomically increments usage. `CONFIRMED_FROM_CODE`
- Scheduler flips overdue active coupons to `EXPIRED` hourly. `CONFIRMED_FROM_CODE`
- Each coupon has a `channel` field: `ALL` (default) | `ONLINE` | `POS`. `CONFIRMED_FROM_CODE`
  - `ONLINE` coupons can only be applied via web/mobile cart — rejected at POS. `CONFIRMED_FROM_CODE`
  - `POS` coupons can only be applied at point of sale — rejected in web/mobile cart. `CONFIRMED_FROM_CODE`
  - `ALL` coupons work on both channels. `CONFIRMED_FROM_CODE`
- A coupon may be restricted to a specific customer via `customer_id` (nullable FK). `NULL` = shared for all customers. `CONFIRMED_FROM_CODE`
- Admin can send a personalized coupon gift to a single customer (`POST /api/v1/admin/customers/{id}/coupon-gift`): creates a unique `GIFT`-prefixed code, sets `customer_id`, and emails it. Requires `coupons.write` permission and the customer must have an email address. `CONFIRMED_FROM_CODE`
- Admin can bulk-notify all active customers (`POST /api/v1/admin/coupon-gifts/bulk`): sends email with an existing coupon's code to every active customer with a verified email. Accepts `{ couponId }` — selected coupon must be ACTIVE. No new coupon is created. Returns `{ sent, skipped }`. Requires `coupons.write` permission. `CONFIRMED_FROM_CODE`
- Admin can targeted-notify selected customers (`POST /api/v1/admin/coupon-gifts/targeted`): sends email with an existing coupon's code to a specified list of customers. Accepts `{ couponId, customerIds }` — coupon must be ACTIVE. No new coupon is created. Returns `{ sent, skipped }`. Requires `coupons.write` permission. `CONFIRMED_FROM_CODE`
- **Xoá coupon** (`DELETE /api/v1/admin/coupons/{id}`): chỉ xoá được khi coupon **chưa từng được áp dụng vào đơn hàng nào**. Nếu đã có ≥1 dòng `order_applied_coupons` tham chiếu → **chặn (HTTP 409)** kèm thông báo gợi ý admin **chuyển sang INACTIVE** thay vì xoá, để giữ lịch sử đơn. (Trước đây không guard → khoá ngoại RESTRICT ném 500 thô.) `CONFIRMED_FROM_CODE`

Evidence:

- `CartService.java`
- `CheckoutService.java`
- `CouponPolicyService.java`
- `PosOrderService.java`
- `CouponExpiryScheduler.java`
- `AdminCouponGiftService.java`
- `AdminCouponService.java` (`deleteCoupon` — guard `order_applied_coupons` reference)
- `AdminCustomerController.java`
- `AdminCouponGiftController.java`
- `V73__enforce_one_coupon_per_cart.sql`
- `V118__add_coupon_channel.sql`
- `V119__add_coupon_customer_restriction.sql`
- `Phase1ECartApiTest.java`
- `Phase1FCheckoutApiTest.java`
- `Phase1JAdminSettingsMenuCouponApiTest.java`

## Order Completion & Cancellation Rules

The three statuses on an order are independent and **never** to be conflated:

| Field | Meaning |
|---|---|
| `OrderEntity.status` | Where the order sits in the fulfillment / lifecycle pipeline. |
| `OrderEntity.paymentStatus` | Where the money is. |
| `OrderEntity.fulfillmentStatus` | Where the goods are (DELIVERY orders only). |

`COMPLETED` means **goods delivered**, not **money received**. The two must be checked separately before the transition.

- `ORDER_RULE_001` — `OrderStatus.COMPLETED` is allowed with `paymentStatus = UNPAID` only when the order is `paymentMethod = CREDIT` AND has a valid `customerId`. Anything else is rejected. Reason: only credit/receivable orders have a downstream collection process; non-credit unpaid completions leave money on the table with no receivable to chase it. (`PARTIALLY_PAID` was a valid state before V114; removed by V114 migration — V116 CHECK constraint now enforces `UNPAID/PAID/REFUNDED/CANCELLED` as the only valid values.) `CONFIRMED_FROM_CODE`
- `ORDER_RULE_002` — `paymentMethod = COD` orders cannot transition to `COMPLETED` unless `paymentStatus = PAID`. Reason: COD means cash on delivery; "complete" is goods + money, not just goods. Backend message: `Đơn COD phải được thu tiền trước khi hoàn thành.` `CONFIRMED_FROM_CODE`
- `ORDER_RULE_003` — `fulfillmentType = DELIVERY` orders cannot transition to `COMPLETED` unless `fulfillmentStatus = DELIVERED`. Reason: a delivery order cannot be "complete" before it has actually been delivered. Admin must walk fulfillment through `UNFULFILLED → PROCESSING → SHIPPED → DELIVERED` (or jump straight to `DELIVERED` from `UNFULFILLED`) via `PATCH /admin/orders/{id}/fulfillment` first. POS in-store orders (`fulfillmentType = IN_STORE`) are exempt — goods change hands at the counter on creation. Backend message: `Chỉ được hoàn thành đơn giao hàng sau khi đã giao thành công.` `CONFIRMED_FROM_CODE`
- `ORDER_RULE_004` — Orders with `paymentStatus = PAID` cannot transition to `CANCELLED` directly. They must go through `POST /admin/orders/{id}/refund` (RefundService) so the refund_transaction, payment record, receivable write-off, warranty void, and serial/stock restore stay atomic. When the guard rejects the cancel, stock is NOT restored and serials are NOT released — the order stays in its current status. Backend message: `Đơn đã có thanh toán, cần xử lý hoàn tiền/void trước khi hủy.` `CONFIRMED_FROM_CODE` (`PARTIALLY_PAID` removed in V114; only `PAID` remains as the blocking condition.)
- `ORDER_RULE_005` — POS orders are created with `status = COMPLETED` directly. CASH/CARD_TERMINAL force `paymentStatus = PAID`; CREDIT forces `paymentStatus = UNPAID` (always fully unpaid at creation — downPayment was removed in V114) AND requires `customerId` + a successful `ReceivableService.createReceivableForOrder` — receivable creation failure rolls back the whole POS order transaction. Debt is collected later via `ReceivableService.recordPayment`. `CONFIRMED_FROM_CODE`
- `ORDER_RULE_006` — POS orders that are already `COMPLETED` cannot be `CANCELLED` directly. `COMPLETED` is terminal in `ALLOWED_TRANSITIONS`. A POS-specific void flow (separate from `CANCELLED`) is not implemented today; cancelling a completed POS sale must currently be modelled as a refund/return. `CONFIRMED_FROM_CODE`
- `ORDER_RULE_007` — Direct `COMPLETED → REFUNDED` status patch is rejected. Refunds must go through `POST /admin/orders/{id}/refund` → `RefundService.applyRefund` so refund_transaction, payment.refundAmount, warranty void, SOLD serial restore, receivable write-off, and the status flip happen atomically. `CONFIRMED_FROM_CODE`
- `ORDER_RULE_008` — POS below-cost guard. A POS price override (`unitPriceOverride`) that is **below the resolved cost price** is rejected (409) unless the staff holds `pos.sell_below_cost` (`SUPER_ADMIN` wildcard / `ADMIN` by default). Cost resolves variant-first then product (`product_variants.cost_price` → `products.cost_price`); when cost is `NULL` (unknown) there is no enforcement. Cost is admin-only and never exposed on the public storefront (see DATA_CONTRACT "Cost price"). `CONFIRMED_FROM_CODE`

Evidence:

- `AdminOrderService.java` — `validateBeforeComplete`, `validateBeforeCancel`, `ALLOWED_TRANSITIONS`
- `CheckoutService.java` — initial `fulfillmentStatus = UNFULFILLED` for DELIVERY orders
- `PosOrderService.java` — POS CASH/CARD/CREDIT branches, receivable creation rollback
- `RefundService.java` — single authoritative refund flow
- `Phase1HAdminOrderApiTest.java` — covers all four rules above (happy + rejection paths)
- `Phase1MPosApiTest.java` — covers POS CASH/CARD/CREDIT including missing-customer rejection and credit limit overrides

## POS Rules

- POS endpoints require admin JWT plus `pos.read` or `pos.write`; price override requires `pos.price_override`. `CONFIRMED_FROM_CODE`
- POS sale is immediate: order status `COMPLETED`, payment status `PAID`, payment provider `POS`. `CONFIRMED_FROM_CODE`
- POS writes order snapshots including customer/staff fields when provided/available. `CONFIRMED_FROM_CODE`
- POS decrements stock immediately and writes stock movement + audit log. `CONFIRMED_FROM_CODE`
- No POS expiry cleanup lifecycle is currently documented because no live cleanup job was confirmed. `NOT_FOUND_IN_REPO`

### POS Customer Identity (`POS_CUSTOMER_*`)

- `POS_CUSTOMER_001`: Every POS order **requires `customerPhone`** (NotBlank, pattern `^\+?[0-9]{8,15}$`). A sale cannot be completed without a phone — the phone is the customer identity key at the counter. `INTENDED` (this PR)
- `POS_CUSTOMER_002`: On sale, the system **normalizes the phone** (strip spaces/dashes, `+84`/`84` prefix → `0`) and resolves the customer by phone (`CustomerJpaRepository.findByPhone`). If a customer with that phone exists → the order is linked to that existing profile (`order.customer_id` set). If none exists → a **new customer profile is auto-created** (`phone` = normalized, `display_name` = entered name or fallback `"Khách tại quầy"`, `status = ACTIVE`, `is_synthetic = true`, `credit_enabled = false`) and the order is linked to it. `INTENDED` (this PR)
- `POS_CUSTOMER_003`: When the entered phone matches an existing profile but the entered name differs, the **existing profile is preserved unchanged** — the entered name is only snapshotted onto that order's `customer_name` (printed on the receipt), never written back to the customer record. `INTENDED` (this PR)
- `POS_CUSTOMER_004`: If the request carries an explicit valid `customerId` (e.g. staff picked an existing customer), that link is used directly without phone lookup. CREDIT sales still require an explicit `customerId` of a credit-enabled customer (auto-created walk-in profiles have `credit_enabled = false`, so a brand-new walk-in cannot buy on credit until credit is enabled on their profile). `INTENDED` (this PR)

Evidence:

- `AdminPosController.java`
- `PosOrderService.java`
- `AdminRolePermissions.java`
- `V71__add_pos_staff_and_customer_name_to_orders.sql`
- `Phase1MPosApiTest.java`

## Media Rules

- Media upload validation is server-side MIME/content validation using Apache Tika magic-byte detection. `CONFIRMED_FROM_CODE`
- Allowed MIME types include common raster images, `image/svg+xml`, MP4 video, and selected audio formats. `CONFIRMED_FROM_CODE`
- SVG is allowed but sanitized on upload (`SvgSanitizer`): scripts, event handlers, `javascript:`/external references and CSS vectors are stripped; non-SVG content declared as `image/svg+xml` is rejected. `CONFIRMED_FROM_CODE`
- Hard delete is blocked when a media URL is still referenced. `CONFIRMED_FROM_CODE`

Evidence:

- `AdminMediaService.java`
- `AdminMediaP0Test.java`

## Inventory And Serial Rules

- Active manual inventory movement types are `IN`, `OUT`, `ADJUSTMENT`, and `RETURN`. `CONFIRMED_FROM_CODE`
- For manual stock-in, serial numbers are required and must match quantity exactly. `CONFIRMED_FROM_CODE`
- For other movement types, serials are optional but cannot exceed movement quantity. `CONFIRMED_FROM_CODE`
- Duplicate serials in request or existing DB state are rejected. `CONFIRMED_FROM_CODE`
- Current serial handling is movement-log based, not a fully modeled product-serial lifecycle table. `CONFIRMED_FROM_CODE`
- Receipt-based receiving tables were **dropped in V120** — schema-only, never implemented in Java. Stock-in is movement-log based only. `REMOVED`

### Stock State Derivation Rules `CONFIRMED_FROM_CODE`

- `stockState` (`IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`) is always **derived**: from `variant.quantityOnHand` per variant, from `product.stockQuantity` for no-variant products, and — for products **with** variants — the product-level `stockState` is an **aggregate of its variants** (see `STOCK_RULE_008`). Admin cannot set it manually via the catalog create/update API.
- `STOCK_RULE_001`: New product or variant is always created with `stockState = OUT_OF_STOCK` (initial `quantityOnHand = 0`).
- `STOCK_RULE_002`: Every time `quantityOnHand` changes (stock-in, sale, cancel, return), `stockState` is recomputed via `InventoryPolicyService.recomputeStockState()`.
- `STOCK_RULE_003`: Thresholds — `quantityOnHand <= 0` → `OUT_OF_STOCK`; `0 < quantityOnHand <= low_stock_threshold` → `LOW_STOCK`; `quantityOnHand > low_stock_threshold` → `IN_STOCK`. Default threshold is 5 (configurable via `low_stock_threshold` site setting).
- `STOCK_RULE_004`: `forceOutOfStock` (product-level boolean) is a separate emergency override. It disables purchase on web even when `stockState = IN_STOCK`. It is still manually controlled by admin.
- `STOCK_RULE_005`: For products with variants, checkout enforces stock via `variant.quantityOnHand` directly (not `variant.stockState`). `variant.stockState` is used for display only (web UI disables "Mua ngay" when `OUT_OF_STOCK`). The web variant selector (`VariantSelector.tsx`) also **dims out-of-stock options by `stockState`** (still clickable for image preview) so customers see at a glance which colour/size combinations are buyable without clicking through each one; truly inactive variants (`isAvailable = false`) remain locked.
- `STOCK_RULE_006`: For no-variant products, checkout enforces via `product.stockState == OUT_OF_STOCK` AND `product.stockQuantity`. Both are derived from stock movements.
- `STOCK_RULE_007`: Sản phẩm có tồn kho = 0 → khách chỉ xem được, không thể đặt hàng. Không có chế độ "đặt trước" hay "HÀNG ODER" qua web. Muốn nhận đơn ODER, admin phải nhập hàng về trước (tồn kho > 0) thì khách mới đặt được.
- `STOCK_RULE_008`: For products **with variants**, the product-level `stockState` is an **aggregate** of its variants, not a manually maintained field: `IN_STOCK` if **any** variant is `IN_STOCK`; else `LOW_STOCK` if any variant is `LOW_STOCK`; else `OUT_OF_STOCK` (only when **all** variants are out). This is what the storefront product-level badge reads (`products.stock_state`) and what the admin inventory grouped view shows. It is maintained by the DB trigger `fn_sync_product_state_from_variants` on `product_variants` (`V165`), which fires whenever any variant's `stock_state` changes — including serial-driven changes that flow through `fn_sync_qty_from_serial_lifecycle` (`V89`) → variant row → this trigger. **Rationale / prior bug:** before `V165` nothing recomputed the product-level state for variant products. `V108` set `products.stock_state` from `stock_quantity`, which is null/0 for variant products, so they were stuck at `OUT_OF_STOCK` permanently — the storefront showed "Hết hàng" even while a variant still had stock. `CONFIRMED_FROM_CODE`
- `STOCK_RULE_009`: **Hiển thị badge tồn kho ở buy-box trang chi tiết sản phẩm (web — chỉ phần nhìn, KHÔNG đổi điều kiện mua ở `STOCK_RULE_005`/`006`).** Cài đặt trong `WpPurchaseSection.tsx`.
  - **Sản phẩm có biến thể, khách CHƯA chọn biến thể:** badge chỉ hiện **"Còn hàng" / "Hết hàng"** theo product-level aggregate `stockState` (`STOCK_RULE_008`) — **không** hiện "Sắp hết". "Hết hàng" ⟺ `product.stockState == OUT_OF_STOCK` (mọi biến thể đều 0 serial) hoặc `forceOutOfStock`. (`product.stockQuantity` là null/0 cho sản phẩm có biến thể nên không dùng để phân tầng — xem prior bug ở `STOCK_RULE_008`.)
  - **Khi đã xác định một đơn vị tồn cụ thể** — biến thể đã chọn đủ (`variant.stockQuantity`) hoặc sản phẩm không biến thể (`product.stockQuantity`): phân tầng theo **số serial còn lại** — `>= 10` → "Còn hàng"; `1..9` → "Sắp hết"; `<= 0` → "Hết hàng". Ngưỡng **10** (`PDP_LOW_STOCK_CUTOFF`) là hằng số hiển thị riêng của PDP, **độc lập** với `low_stock_threshold` (mặc định 5 ở `STOCK_RULE_003`) vốn chỉ chi phối checkout enforcement và cảnh báo tồn kho ở admin.
  - Biến thể 0 serial vẫn theo `STOCK_RULE_005`: làm mờ option (vẫn click được để xem ảnh màu), chỉ khoá khi `isAvailable = false`; nếu khách chọn trúng biến thể 0 serial → buy-box "Hết hàng" và nút mua bị vô hiệu. `CONFIRMED_FROM_CODE`

Evidence:

- `AdminInventoryService.java`
- `InventoryPolicyService.java`
- `CheckoutService.java` (lines 323–357, 862–901)
- `AdminCatalogMutationService.java`
- `StockMovementSerialEntity.java`
- `V57__add_stock_movement_serials.sql`
- `V108__backfill_stock_state_from_quantity.sql`
- `V120__drop_stock_receipt_tables.sql`
- `V165__aggregate_variant_product_stock_state.sql` (product-level aggregate trigger + backfill — `STOCK_RULE_008`)
- `V89__add_product_serial_lifecycle.sql` (`fn_sync_qty_from_serial_lifecycle` — variant qty/state from serial count)
- `bigbike-web/components/wp/WpPurchaseSection.tsx` (`STOCK_RULE_009` — PDP buy-box badge display)

## Product Catalog Rules

- `PRODUCT_RULE_001`: Mỗi sản phẩm bắt buộc có **bản nội dung tiếng Việt** (canonical). **Bản tiếng Anh là tùy chọn** — admin có thể tạo/sửa sản phẩm mà không nhập bản tiếng Anh. `CONFIRMED_FROM_CODE`
- `PRODUCT_RULE_002`: Khi đọc nội dung sản phẩm bằng tiếng Anh (`lang=en`), mỗi trường text thiếu bản tiếng Anh sẽ **tự lùi về bản tiếng Việt theo từng trường** (`COALESCE`). Một sản phẩm có thể có tên tiếng Anh nhưng mô tả vẫn hiển thị tiếng Việt. `CONFIRMED_FROM_CODE`
- `PRODUCT_RULE_003`: `slug` tiếng Việt là **canonical**; mỗi sản phẩm có thêm `slugEn` (slug tiếng Anh) **tùy chọn**. Khi xem bản tiếng Anh, URL dùng `slugEn`; **trống thì lùi về `slug` tiếng Việt**. Web tra cứu sản phẩm theo **vi HOẶC en** slug (cả hai URL mở cùng sản phẩm). `slugEn` phải **duy nhất** trong phạm vi sản phẩm và **không được trùng** bất kỳ `slug` tiếng Việt nào của sản phẩm khác (cross-column uniqueness — partial-unique index lo en-vs-en, vi-vs-en enforce ở tầng ứng dụng). Đổi/xoá `slugEn` **tự sinh redirect 301**. `CONFIRMED_FROM_CODE`
- `PRODUCT_RULE_004`: **Phân biệt hành vi `lang=en` giữa WEB và ADMIN.** `PRODUCT_RULE_002` (fallback theo từng trường về tiếng Việt) chỉ áp dụng cho **web/public**. Ở **bigbike-admin**, nút VI/EN là **strict English**: khi chọn EN, các **danh sách** (sản phẩm, danh mục, thương hiệu, bài viết/trang, menu, phương thức vận chuyển, video trang chủ, Highlights, Sản phẩm nổi bật) **ẩn hẳn** bản ghi chưa có trường tên/tiêu đề tiếng Anh (`name_en`/`title_en`/`label_en` rỗng) — KHÔNG lùi về tiếng Việt — để admin biết mục nào chưa dịch. Các màn **vận hành tham chiếu sản phẩm** (Đánh giá, Slider, Tồn kho) cũng strict: ở EN hiện tên SP tiếng Anh và ẩn bản ghi có SP chưa dịch (Đánh giá lọc server-side qua `name_en` để phân trang đúng; Slider/Tồn kho lọc client-side — Tồn kho dùng tổng trang chưa lọc nên ở EN trang có thể ít dòng hơn). Riêng **màn chi tiết/form soạn thảo** và **ô chọn (selector) trong form** vẫn hiện đầy đủ song ngữ/không strict để nhập liệu được. Giao diện admin (menu/nút/nhãn) luôn cố định tiếng Việt. `CONFIRMED_FROM_CODE`
- `PRODUCT_RULE_006`: **"Hiển thị trên web" — admin bật/tắt từng section của trang chi tiết sản phẩm (PDP), opt-in.** Mỗi sản phẩm có bảng công tắc cho 16 section: `quickAnswer, description, specStats, prosCons, suitability, sizeGuide, specifications, installation, faqs, reviews, trust, related, accessories, videos, trustBadges, commitments`. Một section **chỉ hiện khi VỪA được bật VỪA có nội dung** — bật mà trống vẫn không hiện. **Không** thuộc bảng này (luôn hiện, không tắt được): khối mua hàng (ảnh/tên/giá/nút mua), breadcrumb, dải liên hệ chân trang; và `contentBottom` (nội dung SEO dưới — admin không soạn ở form sản phẩm) chỉ gate theo nội dung. **Sản phẩm tạo MỚI**: mặc định **tắt hết** (opt-in — admin tự bật). **Sản phẩm cũ chưa cấu hình**: cột `section_visibility` = NULL → web giữ **hành vi legacy = hiện theo nội dung**; lần đầu admin lưu lại, form **seed bật-sẵn theo nội dung hiện có** (reviews/trust seed bật) rồi ghi explicit nên web không đổi. Lưu trữ: opaque JSON string `{sectionKey: boolean}` trên `products.section_visibility` (như `size_guide`); backend chỉ truyền qua, admin serialize / web parse (`lib/utils/section-visibility`). Ẩn/hiện 5 section dạng tab (description/reviews/specs/installation/faq) giờ **cũng do bảng này** quản. **V246:** 3 mục `prosCons` / `suitability` / `sizeGuide` **không còn là section/khoá visibility riêng** — chúng đã trở thành **khối nằm trong "Mô tả sản phẩm"** (admin nhập qua trình dựng khối, tự đặt vị trí), nên hiển thị theo visibility của `description` + sự tồn tại của khối. 3 khoá này được gỡ khỏi bảng công tắc; map cũ của sản phẩm có 3 khoá đó được bỏ qua an toàn. Mục **"Tùy chỉnh tab" (V231) đã gỡ khỏi form admin**: cấu hình tab theo từng sản phẩm (thứ tự/đổi tên/tab tự do) **không bao giờ được web áp dụng** kể từ lần dựng lại PDP (V236) — web render theo bố cục cố định + nhãn i18n, và `ProductView` truyền `tabs={[]}` cho `ProductTabsSection`. Cột `products.product_tabs` và DTO vẫn còn (dormant, không có UI sửa). Gate visibility ở **cả web** (server render), không phải chỉ ràng buộc admin. `CONFIRMED_FROM_CODE`
- `PRODUCT_RULE_005`: **Điều kiện đăng bán (publish gate) — chỉ tab "Tổng quan" là bắt buộc.** Form sản phẩm chia 4 tab (Tổng quan / Nội dung / Chi tiết / Biến thể). Để chuyển sản phẩm sang trạng thái `PUBLISHED`, admin phải điền đủ **7 trường thuộc tab Tổng quan**: **Tên, Thương hiệu, Danh mục, Ảnh đại diện, Giá bán lẻ (> 0), Mô tả ngắn, Mô tả chi tiết**. Các tab còn lại — gồm **SEO (tiêu đề/mô tả/canonical), thư viện ảnh, video, thông số, FAQ, biến thể…** — **được để trống** và vẫn đăng bán được. Modal checklist tách 2 nhóm: nhóm **bắt buộc** (7 trường trên) và nhóm **"Nên bổ sung để trang đầy đủ & đẹp hơn"** — liệt kê các phần làm trang sản phẩm phong phú hơn (SEO, bộ sưu tập ảnh, câu trả lời nhanh, ô số liệu nổi bật, ưu/nhược điểm, phù hợp với ai, thông số kỹ thuật, FAQ, biến thể) với dấu ✓ (đã có) / ⚠ (còn trống) để **thông báo cho admin biết**, nhưng **không chặn đăng**. Cổng kiểm tra này là **UX phía admin** (modal checklist khi bấm "Lưu & đăng"): còn trường bắt buộc thiếu thì ẩn nút "Đăng ngay", buộc về sửa; nhóm nên-bổ-sung không ảnh hưởng nút đăng. Lưu nháp (`DRAFT`) / ẩn (`HIDDEN`) không bị gate. Sản phẩm **đã** ở `PUBLISHED` khi lưu lại không kích hoạt modal. Backend không enforce field-completeness ở tầng API — gate thuần ở frontend. `CONFIRMED_FROM_CODE`

Evidence:

- `ProductEntity.java`, `ProductSpecificationEntity.java`, `ProductFaqEntity.java` (các cột `*_en`, gồm `quick_answer_summary_en` + `suitability_advisory_en` thêm ở V236–V237)
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
- `V245__add_product_section_visibility.sql`; `ProductEntity.sectionVisibility`; `Product.sectionVisibility` (domain record); `UpsertProductRequest.sectionVisibility` + `AdminCatalogMutationService` (ghi); `bigbike-admin/.../ProductDetailScreen.jsx` `SECTION_VISIBILITY_KEYS` / `SectionVisibilityEditor` / `resolveSectionVisibilityForm`; `bigbike-web/lib/utils/section-visibility.ts` + `components/catalog/ProductView.tsx` + `components/wp/WpPurchaseSection.tsx` (gate) — PRODUCT_RULE_006

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
- `ARTICLE_RULE_003`: `slug` tiếng Việt là **canonical**; mỗi bài viết có thêm `slugEn` (slug tiếng Anh) **tùy chọn**. Khi xem bản tiếng Anh, URL dùng `slugEn`; **trống thì lùi về `slug` tiếng Việt**. Web tra cứu bài viết theo **vi HOẶC en** slug (cả hai URL mở cùng bài viết). `slugEn` phải **duy nhất** trong phạm vi bài viết và **không được trùng** bất kỳ `slug` tiếng Việt nào của bài viết khác (cross-column uniqueness — partial-unique index lo en-vs-en, vi-vs-en enforce ở tầng ứng dụng). **Chỉ áp dụng cho bài viết — trang tĩnh (pages) giữ nguyên `PAGE_RULE_003`** (slug cố định, không có `slugEn`). `CONFIRMED_FROM_CODE`
- `ARTICLE_RULE_004`: Admin có thể đánh dấu một bài viết là **nổi bật** (`featured`). Web hiển thị các bài `featured` ở khu **"Tin nổi bật"**; nếu **không có bài nào** được đánh dấu nổi bật, web **fallback sang các bài viết mới nhất**. `featured` chỉ áp dụng cho bài viết — trang tĩnh (pages) không có. `CONFIRMED_FROM_CODE`

Evidence:

- `ArticleEntity.java` (các cột `title_en`, `excerpt_en`, `body_en`, `seo_title_en`, `seo_description_en`; `featured`, `seo_no_index`)
- `JpaContentReadRepository.java` (resolve locale + fallback cho article)
- `ContentController.java` (`lang` param trên article endpoints; `listArticles` query param `featured`)
- `AdminContentMutationService.java` (`applyArticlePatch` ghi cột `_en` + `slug_en` + `featured`/`seo_no_index`; validate uniqueness `slugEn`)
- `ArticleJpaRepository.java` (`findBySlug`, `findBySlugEn`)
- `UpsertArticleRequest.java` (`featured`), `SeoMetaRequest.java` (`noIndex`)
- `V138__add_article_page_bilingual_content.sql`, `V216__add_article_slug_en.sql`, `V222__add_article_featured_and_seo_no_index.sql`
- `DATA_CONTRACT.md` — "Article bilingual content", "Article featured + seo_no_index (V222)"

## Static Page Rules

- `PAGE_RULE_001`: Mỗi trang tĩnh bắt buộc có **bản nội dung tiếng Việt** (canonical). **Bản tiếng Anh là tùy chọn**. `CONFIRMED_FROM_CODE`
- `PAGE_RULE_002`: Khi đọc trang bằng tiếng Anh (`lang=en`), mỗi trường thiếu bản tiếng Anh sẽ **tự lùi về bản tiếng Việt theo từng trường** (title, body, heroTitle, heroDescription, heroKicker, seoTitle, seoDescription). `CONFIRMED_FROM_CODE`
- `PAGE_RULE_003`: `slug` của trang dùng chung 1 bản (không dịch theo ngôn ngữ). `CONFIRMED_FROM_CODE`

Evidence:

- `PageEntity.java` (các cột `title_en`, `body_en`, `hero_title_en`, `hero_description_en`, `hero_kicker_en`, `seo_title_en`, `seo_description_en`)
- `JpaContentReadRepository.java` (resolve locale + fallback cho page)
- `ContentController.java` (`lang` param trên page endpoints)
- `AdminContentMutationService.java` (`applyPagePatch` ghi cột `_en`)
- `V138__add_article_page_bilingual_content.sql`
- `DATA_CONTRACT.md` — "Page bilingual content"

## Contact Page Builder Rules

Trang `/lien-he` không phải nội dung tĩnh: phần thân do admin dựng qua **trình dựng trang Liên hệ** (một danh sách khối có thứ tự). Tiêu đề/mô tả đầu trang vẫn lấy từ trang CMS slug `lien-he` (theo Static Page Rules).

- `CONTACT_PAGE_RULE_001`: Bố cục là một mảng khối (tối đa 40) lưu trong bảng singleton `contact_page_layout`. Mỗi khối có `type` ∈ {`channel`,`address`,`hours`,`map`,`richtext`}, cờ `enabled`, `sortOrder`, `column` ∈ {`main`,`online`}, `icon`, nhãn song ngữ (`labelVi`/`labelEn`). `CONFIRMED_FROM_CODE`
- `CONTACT_PAGE_RULE_002`: Giá trị của khối **bound** (kênh dùng chung như hotline/địa chỉ/giờ/URL mạng xã hội) **không** lưu trong khối — nó nằm ở `site_settings` (single source dùng chung header/footer) và được **ghi xuyên** qua endpoint contact-page, giới hạn bởi whitelist nhóm `contact`. Chỉ khối custom (không `bindKey`) mới giữ `value`/`href` riêng; `richtext` giữ `htmlVi`/`htmlEn`. `CONFIRMED_FROM_CODE`
- `CONTACT_PAGE_RULE_003`: Nhãn/HTML lùi về bản tiếng Việt khi thiếu bản tiếng Anh (giống `PAGE_RULE_002`). Quản lý bằng quyền `content.update`; storefront chỉ nhận khối `enabled`. `CONFIRMED_FROM_CODE`

Evidence:

- `ContactBlock.java`, `ContactPageLayoutEntity.java`, `ContactBlocksConverter.java`
- `ContactPageService.java` (whitelist `WRITE_THROUGH_KEYS`, write-through qua `AdminSettingsService`)
- `AdminContactPageController.java` (`content.update`), `PublicContactPageController.java`
- `V224__add_contact_page_layout.sql`
- `bigbike-web/app/lien-he/page.tsx` (render động), `bigbike-admin/src/screens/ContactPageBuilderScreen.jsx`

## Guide Page Builder Rules

Trang tổng `/huong-dan` không phải nội dung tĩnh: lưới ô hướng dẫn + hero do admin dựng qua **trình dựng trang Hướng dẫn**. Thân bài chi tiết của từng ô vẫn là một trang CMS (module Trang) trỏ tới qua `pageSlug` — giữ nguyên SEO/bản EN/rich text.

- `GUIDE_PAGE_RULE_001`: Lưới là một mảng ô (tối đa 40) lưu trong bảng singleton `guide_page_layout`. Mỗi ô có `enabled`, `sortOrder`, `pathSegment` (đoạn URL dưới `/huong-dan/`), `pageSlug` (trang CMS chứa nội dung), `icon` (lucide hoặc URL ảnh MinIO), tiêu đề/mô tả song ngữ. `CONFIRMED_FROM_CODE`
- `GUIDE_PAGE_RULE_002`: Web dựng lưới, sidebar và map `pathSegment→pageSlug` **chỉ** từ entries của builder — không còn đọc menu location `guide` cho sidebar (menu đó giữ lại nhưng không dùng cho trang này). Ô `pathSegment` không khớp entry nào → 404. `CONFIRMED_FROM_CODE`
- `GUIDE_PAGE_RULE_003`: Tiêu đề/mô tả/hero lùi về bản tiếng Việt khi thiếu bản tiếng Anh (giống `CONTACT_PAGE_RULE_003`). Quản lý bằng quyền `content.update`; storefront chỉ nhận ô `enabled`. Ảnh icon/hero upload qua media library → MinIO, chỉ lưu URL. `CONFIRMED_FROM_CODE`

Evidence:

- `GuideEntry.java`, `GuidePageLayoutEntity.java`, `GuideEntriesConverter.java`
- `GuidePageService.java`, `AdminGuidePageController.java` (`content.update`), `PublicGuidePageController.java`
- `V227__add_guide_page_layout.sql`
- `bigbike-web/app/huong-dan/GuidePage.tsx` (render động), `bigbike-admin/src/screens/GuidePageBuilderScreen.jsx`

## Policy Page Rules

Trang chính sách `/chinh-sach/{slug}` do admin quản lý hoàn toàn: thân bài là một trang CMS (module Trang) bình thường, còn thanh bên (danh sách + thứ tự các trang chính sách) do admin dựng qua **menu vị trí `policy`** — tái dùng trình quản lý Menu sẵn có, không cần builder riêng.

- `POLICY_PAGE_RULE_001`: `slug` trên URL là slug của chính trang CMS — web phân giải trực tiếp `GET /api/v1/pages/{slug}`, không còn bảng map slug hard-code. Slug không khớp trang CMS nào → 404. `CONFIRMED_FROM_CODE`
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
- Confirmed event type in checkout/POS flow is `NEW_ORDER`; `ORDER_STATUS_CHANGED` is declared in the event record comment but needs a live sender check before relying on it. `NEEDS_VERIFICATION`

Evidence:

- `WebSocketConfig.java`
- `AdminOrderWsService.java`
- `OrderWsEvent.java`
- `adminWebSocket.js`

## Redirect And Integration Rules

- Internal redirect endpoints are `permitAll` in Spring Security and are expected to be locked down at infra layer in production. `CONFIRMED_FROM_CONFIG`
- `PAY_RULE_001`: Online checkout accepts only payment-method codes `COD` and `BACS`. Both are confirmed manually by admin — there is no automatic payment gateway. `CONFIRMED_FROM_CODE`
- `PAY_RULE_002`: Manual-confirm reconciliation. `COD` — admin marks the order paid after cash is collected on delivery. `BACS` — admin verifies the bank transfer, then patches `paymentStatus`/`paidAmount`. No payment redirect, no provider webhook. The Alepay/ZaloPay online-gateway plan was dropped; those method codes are no longer accepted. `CONFIRMED_FROM_CODE`
- No external shipping carrier integration was confirmed in active repo code. `NOT_FOUND_IN_REPO`

Evidence:

- `SecurityConfig.java`
- repo search for payment/shipping providers

## Accounts Receivable Rules

AR module implemented in V75 (Flyway). Rules below are `CONFIRMED_FROM_CODE`.

- `AR_RULE_001`: Credit sale (bán chịu) is supported via POS CREDIT payment method. Only customers with `creditEnabled=true` and `creditStatus=ACTIVE` may purchase on credit. ADMIN role can create and manage all receivables; SHOP_MANAGER can read and record payments. `CONFIRMED_FROM_CODE`
- `AR_RULE_002`: Credit limit is configurable per customer (`credit_limit` column on `customers` table). A null limit means no cap. ADMIN with `receivables.override_limit` permission may override the limit at point of sale. `CONFIRMED_FROM_CODE`
- `AR_RULE_003`: Payment terms are configurable per customer (`payment_terms_days`). Due date = `placedAt + paymentTermsDays` days, persisted on `accounts_receivable.due_date`. `CONFIRMED_FROM_CODE`
- `AR_RULE_004`: Credit sales are POS-only (walk-in). Web/mobile checkout does not support CREDIT payment. `CONFIRMED_FROM_CODE`
- `AR_RULE_005`: Exceeding credit limit blocks the POS sale with HTTP 422. ADMIN with `receivables.override_limit` permission can bypass. `CONFIRMED_FROM_CODE`
- `AR_RULE_006`: Partial payments are supported. Each `POST /admin/receivables/{id}/payments` call records a PaymentEntity and updates `paidAmount`. `paymentStatus` transitions: UNPAID → PARTIALLY_PAID → PAID. `CONFIRMED_FROM_CODE`
- `AR_RULE_007`: Write-off is supported via `POST /admin/receivables/{id}/write-off` with mandatory reason. Requires `receivables.write_off` permission (ADMIN only). Sets AR status=WRITTEN_OFF and records audit log. The linked `orders.payment_status` is NOT updated — it stays UNPAID (the debt is cancelled at the AR level, not collected; V116 CHECK constraint does not permit WRITTEN_OFF as an order payment status). `CONFIRMED_FROM_CODE`
- `AR_RULE_008`: Overdue receivables are flagged by scheduler. `ReceivableOverdueScheduler` runs daily at 00:05 (`@Scheduled(cron = "0 5 0 * * ?")`) and calls `ReceivableService.refreshOverdueStatus()`, which transitions OPEN/PARTIALLY_PAID receivables past `dueDate` to OVERDUE. No auto-cancellation — status becomes OVERDUE for staff attention. `CONFIRMED_FROM_CODE`
- `AR_RULE_009`: Target is registered customers (UUID FK on `accounts_receivable.customer_id`). `customer_id` is nullable at the schema level; `customer_name` and `customer_phone` are snapshotted at creation. Note: since `POS_CUSTOMER_001/002`, every POS sale now resolves or auto-creates a customer profile by phone, so POS-originated receivables normally carry a non-null `customer_id`. `CONFIRMED_FROM_CODE` (schema) + `INTENDED` (POS auto-link, this PR)
- `AR_RULE_010`: No customer-facing SOA in web/mobile portal. Receivables are admin-only. `CONFIRMED_FROM_CODE`
- `AR_RULE_011`: Aging report implemented: buckets are notDue, 0–30 days, 31–60 days, 61–90 days, 90+ days. Also: total outstanding, overdue outstanding, written-off total, open/overdue count. `CONFIRMED_FROM_CODE`

### Customer credit status state machine

`ACTIVE` → `SUSPENDED` (admin manual) → `ACTIVE` (reinstate)
`ACTIVE` → `BLOCKED` (admin manual, permanent — requires credit clear)

### Receivable payment status state machine

`UNPAID` → `PARTIALLY_PAID` (paidAmount > 0 and < outstanding) → `PAID` (paidAmount ≥ outstanding)

### Receivable status state machine

`OPEN` → `PARTIALLY_PAID` → `CLOSED` (fully paid)
`OPEN` / `PARTIALLY_PAID` → `OVERDUE` (past due date, not closed)
`OPEN` / `PARTIALLY_PAID` / `OVERDUE` → `WRITTEN_OFF` (admin write-off with reason)

Evidence:

- `V75__add_credit_and_receivables.sql`
- `CustomerEntity.java` (credit fields added)
- `ReceivableEntity.java`
- `ReceivableJpaRepository.java`
- `CreditPolicyService.java`
- `ReceivableService.java`
- `ReceivableQueryService.java`
- `ReceivableOverdueScheduler.java` (cron `0 5 0 * * ?` daily 00:05; verifies `@EnableScheduling` in `BigbikeBackendApplication.java`)
- `AdminReceivableController.java`
- `PosOrderService.java` (CREDIT branch)
- `AdminRolePermissions.java` (`receivables.*` permissions added)
- `AdminReceivableApiTest.java`

## Reports Rules

Status: `CONFIRMED_FROM_CODE` — derived from audit of `AdminReportService.java`, `OrderJpaRepository.java`, `OrderLineItemJpaRepository.java`, `RefundService.java`, `AdminCustomerService.java`.

### Metric Definitions

- `REPORT_RULE_001`: **GMV (`grossOrderValue`)** = `SUM(totalAmount)` for orders where `placedAt` is within the requested range AND `status NOT IN ('CANCELLED', 'FAILED')`. REFUNDED orders are **included** in GMV — they represent real demand placed in the period. `CONFIRMED_FROM_CODE`
- `REPORT_RULE_002`: **Paid Revenue (`paidRevenue`)** = `SUM(paidAmount)` for orders where `placedAt` is within the requested range AND `paymentStatus IN ('PAID', 'REFUNDED')` AND `status NOT IN ('CANCELLED', 'FAILED')`. `paidAmount` is never modified by `RefundService.applyRefund()` — it is the total cash collected. `PARTIALLY_PAID` and `PARTIALLY_REFUNDED` were removed in V114 migration. `REFUNDED` orders are included because `paidAmount` reflects the total cash collected and is not decremented when a refund is applied. `CONFIRMED_FROM_CODE`
- `REPORT_RULE_003`: **Refund Amount (`refundAmount`)** = `SUM(refundAmount)` for orders where `placedAt` is within the requested range AND `refundAmount IS NOT NULL AND refundAmount > 0`. Anchored to `placedAt`, not `refundedAt`. `CONFIRMED_FROM_CODE`
- `REPORT_RULE_004`: **Net Revenue (`netRevenue`)** = `paidRevenue − refundAmount`. No clamp. Negative net revenue is a valid business scenario (e.g. refunds exceed cash collected in a cohort). Display as-is. `CONFIRMED_FROM_CODE`
- `REPORT_RULE_005`: **Order Count (`orderCount`)** = `COUNT(id)` excluding `status IN ('CANCELLED', 'FAILED')`. REFUNDED orders count. `CONFIRMED_FROM_CODE`
- `REPORT_RULE_006`: **Average Order Value (`avgOrderValue`)** = `grossOrderValue / orderCount`. Returns zero if `orderCount = 0`. `CONFIRMED_FROM_CODE`

### Excluded Status Sets

- `REPORT_RULE_007`: Two separate excluded-status sets are used:
  - **REVENUE_EXCLUDED** = `['CANCELLED', 'FAILED']` — applied to GMV, paidRevenue, orderCount, avgOrderValue, daily revenue.
  - **RANKING_EXCLUDED** = `['CANCELLED', 'FAILED', 'REFUNDED']` — applied to topProducts and topCustomers rankings. REFUNDED orders are excluded from rankings because refunded revenue is not retained. `CONFIRMED_FROM_CODE`

### Timezone

- `REPORT_RULE_008`: All date boundaries (`from`, `to` params) are parsed in `Asia/Ho_Chi_Minh` timezone. Daily revenue grouping uses `AT TIME ZONE 'Asia/Ho_Chi_Minh'`. This matches `AdminDashboardService` behavior. `CONFIRMED_FROM_CODE`

### Product And Customer Rankings

- `REPORT_RULE_009`: **topProducts** uses `COALESCE(product_pk, product_id::text)` as group key. Admin-created products have `product_id = NULL` and `product_pk` set; regular products have both. Filtering `product_id IS NOT NULL` (legacy behavior) silently excludes admin-created products. `CONFIRMED_FROM_CODE`
- `REPORT_RULE_010`: **topCustomers** uses `COALESCE(customer_id::text, customer_email)` as group key to prevent the same customer appearing as multiple rows if their email changed over time. Display email is `MAX(customer_email)`. `CONFIRMED_FROM_CODE`

### Known Limitation

- `REPORT_RULE_011`: **Refund attribution is period-inaccurate.** `refundedAt` on `OrderEntity` is overwritten on every `RefundService.applyRefund()` call — for an order with multiple partial refunds, it holds only the timestamp of the last one. Switching to `refundedAt`-based aggregation would silently drop early partial refunds and double-count in cross-period scenarios. Therefore `refundAmount` is currently attributed to the order's `placedAt` period, not the period the refund occurred. This means the Reports module cannot accurately answer "how much was refunded this week?" if the order was placed in a prior week. A `refund_transactions` table (planned P1/P2) is required for per-period refund accuracy. `CONFIRMED_FROM_CODE`

Evidence:

- `AdminReportService.java`
- `OrderJpaRepository.java`
- `OrderLineItemJpaRepository.java`
- `RefundService.java`
- `AdminCustomerService.java`

## Returns And Inspection Rules

- `RETURN_RULE_001`: Customer returns are only valid for orders in `COMPLETED` status within `RETURN_WINDOW_DAYS = 30` days from `orders.completed_at`. `CONFIRMED_FROM_CODE`
- `RETURN_RULE_002`: An order can have **at most one active return** at a time. Active = status in `{PENDING, APPROVED, RECEIVED, INSPECTING}`. Enforced both in `CustomerReturnService`/`AdminReturnService` and by the `idx_returns_order_active` partial unique index (V65, extended to include `INSPECTING` in V191). `CONFIRMED_FROM_CODE`
- `RETURN_RULE_003`: For each `order_line_item_id`, the running sum of `return_items.quantity` across non-`REJECTED` returns must not exceed the original `order_line_items.quantity`. Validated server-side at submission time. `CONFIRMED_FROM_CODE`
- `RETURN_RULE_004`: **Inspection step (V104).** Returns may transition `RECEIVED → INSPECTING` to enter a per-item QC phase. Every `ReturnItem` must be marked `PASS` or `FAIL` via `PATCH /admin/returns/{id}/items/{itemId}/inspect` before the return can move on to `COMPLETED` or `REFUNDED`. Skipping inspection is allowed (legacy path `RECEIVED → COMPLETED/REFUNDED`), but is **not recommended for safety equipment** (mũ bảo hiểm, áo giáp). `CONFIRMED_FROM_CODE`
- `RETURN_RULE_005`: **FAIL items never re-enter stock.** When a return closes from `INSPECTING`, `restoreStockForReturn` skips any `ReturnItem` with `inspection_result = 'FAIL'`. This prevents customer-damaged goods from being put back on the sellable shelf. `CONFIRMED_FROM_CODE`
- `RETURN_RULE_006`: `GET /api/v1/customer/orders/{orderId}/return-eligibility` is read-only and never mutates state. It returns one of the stable reason codes `OK`, `ORDER_NOT_FOUND`, `NOT_OWNER`, `ORDER_NOT_COMPLETED`, `WINDOW_EXPIRED`, `RETURN_IN_PROGRESS`, `NOTHING_TO_RETURN`. Frontend MUST call this before rendering the return form (see `RETURN_RULE_008`). `CONFIRMED_FROM_CODE`
- `RETURN_RULE_007`: **REFUNDED via RMA supports both full and partial coverage.** Transitioning a return to `REFUNDED` (from `RECEIVED` or `INSPECTING`) is allowed for any coverage. Two paths: (a) **full coverage** (every line item's non-rejected return quantity equals the ordered quantity) → `RefundService.applyRefund` refunds the whole order (`refundAmount` must equal `orderRefundableAmount`), restores all stock/serials and flips the order to `REFUNDED`; (b) **partial coverage** → `RefundService.applyReturnPartialRefund` refunds only the returned items' value (`refundAmount` in `(0, orderRefundableAmount]`), stock for the returned PASS items is restored at RMA level (`restoreStockForReturn`), and the order **stays `PAID`/`COMPLETED`** with `refundAmount` accumulating — it flips to `REFUNDED` only once the cumulative refund reaches the full paid amount. There is no `PARTIALLY_REFUNDED` status (V114); revenue reports subtract `SUM(orders.refund_amount)` so partial refunds reduce net revenue correctly. An order-level refund unrelated to an RMA still goes through `POST /admin/orders/{id}/refund` (full-only). `CONFIRMED_FROM_CODE`
- `RETURN_RULE_008`: **Frontend must consult eligibility before render.** Customer FE for both the order-detail "Yêu cầu trả" button and the standalone returns page (`/tai-khoan/doi-tra`) MUST call `GET /api/v1/customer/orders/{orderId}/return-eligibility` and respect both `eligible` and per-item `returnableQuantity`. Submitting without checking leads to backend `ValidationException` and bad UX. Items with `returnableQuantity = 0` must be hidden; the input cap MUST be `returnableQuantity`, not the original ordered quantity. `CONFIRMED_FROM_CODE`

Evidence:

- `AdminReturnService.java`
- `CustomerReturnService.java`
- `ReturnItemEntity.java`
- `V104__add_return_item_inspection.sql`
- `RefundService.java` (V114 full-refund constraint)

## Contact Inbox Rules

> Removed. The public contact form and admin contact inbox were deleted (migration `V128__drop_contact_messages.sql`). Customers reach the shop through the contact info on `/lien-he` (hotline, Zalo, Facebook, address, map) — now **admin-managed via the contact page builder** (see "Contact Page Builder Rules"), not a static page. There is still no contact form, no `contact_messages` table, and no `contact.read`/`contact.write` permissions.
