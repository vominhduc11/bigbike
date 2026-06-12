# WordPress → BigBike: Migration Readiness Audit

**Ngày kiểm tra:** 2026-06-11
**Người thực hiện:** Claude Code
**Phạm vi:** Phase 1–5 (read-only) + ghi nhận 4 quyết định của chủ đầu tư. Phase 7 (Nginx cutover) CHƯA thực hiện.

---

## ⚠️ PHÁT HIỆN QUAN TRỌNG NHẤT — KHÁC VỚI GIẢ ĐỊNH BAN ĐẦU

Đây **không phải** một cuộc migration từ con số 0. Trên thực tế:

1. **Hệ thống chuyển dữ liệu WordPress → BigBike đã được lập trình sẵn, đầy đủ** trong backend (`bigbike-backend/.../migration/wordpress/`): có bộ nhập liệu (importer) + mapper cho sản phẩm, biến thể, danh mục, thương hiệu, tag, ảnh, **khách hàng, đơn hàng**, coupon, đánh giá, menu, redirect, admin user — kèm copy ảnh lên MinIO, chế độ chạy thử (dry-run), và cơ chế chống ghi đè. Công cụ đọc từ **file SQL dump** của WordPress (prefix bảng `kd_`), mặc định **tắt** và **dry-run**.

2. **Phần hàng hóa (catalog) đã được nhập từ ~2026-05-08 (khoảng 1 tháng trước) và hiện đã CŨ:**
   - 192 sản phẩm đang bán bên WP đều đã có bên BigBike, **nhưng 183 đang ở trạng thái nháp (DRAFT) — chỉ 9 đã xuất bản** → phần lớn chưa hiện trên web.
   - BigBike đang chứa **1.231 sản phẩm** (nhiều hơn 920 của WP hiện tại) → **313 sản phẩm tồn dư** đã bị xóa bên WP từ sau lần nhập.

3. **2 điểm chặn cut-over còn lại (ảnh KHÔNG còn là vấn đề):**
   - **Catalog chưa xuất bản:** 183/192 sản phẩm đang bán nằm ở nháp → vô hình trên web.
   - **Đơn hàng + khách hàng chưa chuyển:** BigBike chỉ có **6 đơn test + 1 khách test**. WP có **1.660 đơn (₫2,2 tỷ, 2014→2026)** và **1.967 tài khoản (453 có địa chỉ)**.

> ✅ **Đính chính (2026-06-11):** Lần kiểm tra đầu nhầm rằng ảnh chưa được copy (do cách MinIO lưu object dưới dạng thư mục khiến phép đếm `find -type f` ra 0). Thực tế **ảnh ĐÃ được copy đầy đủ lên MinIO** — `bigbike-media/wp-uploads/` chứa **8,4 GB** (đủ năm 2014→2023, cả ảnh gốc lẫn các cỡ thu nhỏ), và test tải ảnh mẫu trả về **HTTP 200, đúng 30.846 bytes**. → **Không cần chạy media copy. Quyết định #4 (chọn ảnh) trở thành không cần thiết.**

**Tin tốt:** schema BigBike đã sẵn sàng cho migration, và phần lớn các "quyết định kinh điển" đã được công cụ tự giải quyết (xem mục 3 & 5).

---

## TÓM TẮT EXECUTIVE

| Chỉ số | Số liệu |
|---|---|
| Tổng sản phẩm WP (tất cả trạng thái) | 920 (publish 214, draft 699, pending 2, private 2, trash 3) |
| Sản phẩm **ngừng bán** (loại khỏi migration) | 22 ẩn khỏi cả catalog & search + 728 không publish |
| Sản phẩm **đang bán** (scope migration) | **192** (variable 133, simple 59) |
| Tổng biến thể (của sản phẩm đang bán) | **1.383** |
| Tổng khách hàng | **1.967** (453 có địa chỉ thật) |
| Tổng đơn hàng | **1.660** (guest 533, có tài khoản 1.127) |
| Doanh thu tổng (mọi trạng thái) | **≈ ₫2.199.329.017** (hoàn thành: ₫1.204.209.000) |
| Tổng media (DB attachments) | 12.285 · Thư mục ảnh **8,1 GB / 91.954 file** (ảnh gốc ~13.376) |
| Ngôn ngữ | Tiếng Việt (chính, 208 SP) + English (phụ, 6 SP) |

**Đánh giá tổng thể:** 🟠 **NEEDS_WORK**

**Lý do:** Công cụ migration và schema đã sẵn sàng (không bị BLOCKED), nhưng việc nhập liệu mới chỉ làm xong một nửa: catalog đã cũ & phần lớn còn ẩn, ảnh chưa được copy lên, đơn hàng và khách hàng chưa chuyển. Cần chạy lại/hoàn tất các bước nhập liệu trước khi cut-over.

---

## 1. INVENTORY DỮ LIỆU WORDPRESS

> Hạ tầng: WordPress trên **MariaDB 10.6.23** (DB `bigbike_main`, 111 bảng, prefix `kd_`). BigBike trên **PostgreSQL 16.13** (DB `bigbike`, 73 bảng). Toàn bộ stack Docker đang chạy khỏe mạnh (web:3000, admin:4000, backend:8080, postgres:5432, minio:9000).

### 1.1 Products

**Định nghĩa scope đã áp dụng:** sản phẩm "đang bán" = `post_status='publish'` VÀ **không** bị ẩn khỏi cả catalog lẫn search.

> ⚠️ Lưu ý kỹ thuật: script gốc dùng filter `t.name='hidden'` — nhưng taxonomy `product_visibility` **không có** term tên `hidden`. WooCommerce lưu "hidden" = có đồng thời `exclude-from-catalog` + `exclude-from-search`. Đã sửa lại filter cho đúng. Tương tự, loại sản phẩm nằm ở taxonomy `product_type`, **không** ở meta `_product_type` (rỗng).

| Nhóm | Số lượng |
|---|---|
| Đang bán (publish, không ẩn) | **192** |
| — variable | 133 (1.383 biến thể) |
| — simple | 59 |
| Publish nhưng ẩn khỏi cả catalog & search (loại) | 22 |
| Publish bị ẩn 1 phần (vẫn trong scope) | 1 |
| Draft / pending / private / trash (loại) | 706 |
| **SKU coverage** | **192/192 = 100%** sản phẩm đang bán có SKU |

**Độ phủ trường dữ liệu** (sản phẩm đang bán + biến thể của chúng):

| Trường | Số bản ghi | Ghi chú |
|---|---|---|
| `_stock_status` | 1.731 | instock 3.371 / outofstock 554 / **onbackorder 21** (toàn bộ) |
| `_stock`, `_manage_stock` | 1.709 | quản lý tồn kho |
| `_thumbnail_id` | 1.680 | ảnh đại diện |
| `_price` / `_regular_price` | 1.651 / 1.484 | giá |
| `_sale_price` | 75 | rất ít sản phẩm giảm giá |
| `_product_image_gallery` | 211 | thư viện ảnh |
| **`_weight`** | **20** | ⚠️ gần như không có cân nặng |
| **`_length/_width/_height`** | **1** | ⚠️ gần như không có kích thước |
| Ảnh biến thể | `rtwpvg_images` (plugin woo-product-variation-gallery) — 2.064 bản ghi |

### 1.7 ACF custom fields (chỉ nhóm gắn với sản phẩm)

Nhóm **"Product Field"** (gắn trên product), độ phủ ~190+/192:

| Field | Kiểu ACF | Map sang BigBike |
|---|---|---|
| `rating` | number | → `Product.rating` ✅ |
| `rating_count` | number | → `Product.ratingCount` ✅ |
| `videos` (repeater `youtube_url`) | repeater | → `Product.videos` (ProductVideo) ✅ |
| `product_more_infomation` | wysiwyg | → `Product.promotionContent` hoặc `installationGuide` ⚠️ |
| `content_bottom` | wysiwyg | → nối vào `description` / `descriptionBlocks` ⚠️ |
| `product_of_stock` | true_false | → `Product.forceOutOfStock` / `manageStock` ⚠️ |

> ⚠️ `rating`/`rating_count` là **số nhập tay** (cosmetic), **không** phải đánh giá thật của khách. WP có **0 review thật** (toàn bộ 995 comment là ghi chú đơn hàng). Các nhóm ACF còn lại (Homepage, Category, Slider, Contact, Video…) thuộc nội dung website, không thuộc dữ liệu sản phẩm cốt lõi.

### 1.2 Categories & Brands

- **Danh mục (`product_cat`):** cây **3 cấp** (vd: MŨ BẢO HIỂM → Fullface → Nón Fullface LS2), ~39 term gồm cả bản dịch tiếng Anh (0 sản phẩm). BigBike hỗ trợ lồng nhau không giới hạn → OK.
- **Thương hiệu:** taxonomy thật là **`pwb-brand`** (perfect-woocommerce-brands) — **16 thương hiệu**, 184 lượt gán: LS2 (42), TAICHI (33), KOMINE (33), GIVI (23), ILM (15), SCS (11)… Taxonomy `product_brand` chỉ là stub không dùng (1 term, 0 SP).
- **Thuộc tính:** `pa_size` (59 giá trị/619 lượt), `pa_color` (122/309), `pa_model` (41/25), `pa_gender` (2/20), `pa_bo` (14/9), `pa_dungtich` (4/0).
- **Tag:** 2.895 tag.

### 1.3 Khách hàng & Users

| Chỉ số | Số liệu |
|---|---|
| Tổng tài khoản | **1.967** |
| Vai trò | customer 1.728 · subscriber 227 · administrator 5 · editor 3 · shop_manager 2 · wpseo_manager 1 |
| Có địa chỉ thanh toán (billing) | 453 |
| Có địa chỉ giao hàng (shipping) | 447 |
| Đăng nhập Facebook (nextend social) | 65 |

> 🔎 **Nguồn gốc Magento:** 1.686 user mang meta `magento_customer_id` / `_fgm2wc_old_user_id`, 1.680 có `magentopass` → site này **trước đây đã từng migrate từ Magento** sang WooCommerce. Tuy nhiên mật khẩu thực dùng để đăng nhập nằm ở `user_pass` (xem 4.3) nên không ảnh hưởng lớn.

### 1.4 Đơn hàng

> Lưu trữ ở dạng cũ `shop_order` (HPOS `kd_wc_orders` tồn tại nhưng **rỗng** → bỏ qua). Khoảng thời gian: **2014-10-22 → 2026-06-09**.

| Trạng thái | Số đơn | Doanh thu (₫) |
|---|---|---|
| wc-completed | 603 | 1.204.209.000 |
| wc-pending | 520 | 350.000.000 |
| wc-processing | 503 | 574.075.000 |
| wc-cancelled | 26 | 56.200.000 |
| wc-on-hold | 8 | 14.845.017 |
| **Tổng** | **1.660** | **≈ 2.199.329.017** |

- **Không có** đơn `refunded` / `failed` / `trash` → chỉ cần map 5 trạng thái trên.
- **Refund:** 0 (không có lịch sử hoàn tiền cần chuyển).
- Khách: **guest 533** / có tài khoản 1.127. Line items 1.909, shipping items 1.346. Coupon dùng: 1.
- **Phương thức thanh toán:** bacs 787 (chuyển khoản), checkmo 360 *(Magento)*, cod 139, cashondelivery 135 *(Magento)*, ccsave 13 *(Magento)*.
- Meta đặc biệt: `is_vat_exempt` (251 đơn).

### 1.5 Media

- Thư mục `wp-content/uploads/`: **8,1 GB**, **91.954 file**.
- Phân loại: jpg 71.948 · png 16.128 · webp 2.863 · jpeg 898 · gif/avif/mov/mp4/pdf ít.
- **Ảnh gốc (không phải bản thu nhỏ tự sinh): ~13.376 file.** Còn lại ~78.000 là các cỡ thumbnail.
- Bản ghi attachment trong DB: 12.285 (image/jpeg 9.501, image/png 2.564, image/webp 203…).

### 1.6 Polylang (đa ngôn ngữ)

- **Tiếng Việt (vi):** 401 mục, **208 sản phẩm** (ngôn ngữ chính).
- **English (en):** 7 mục, **6 sản phẩm** (không đáng kể). BigBike đã có sẵn cột song ngữ EN (`nameEn`, `descriptionEn`…) → đủ chỗ chứa.

### 1.8 Pods CPTs & nội dung khác

- Pods: **1 pod `video`** (62 bản ghi video) → BigBike có entity `HomeVideo` (59 rows đã có).
- CPT khác: `slider` (2), `wpcode` (3), `wpcf7_contact_form` (1).
- **Contact Form 7 (CFDB7):** 618 lượt gửi từ 1 form (không thuộc dữ liệu e-commerce cốt lõi).
- Shipping zone: 1 vùng "Việt Nam". Coupon: 1 (`BANCUAKHANH`, fixed_cart).

---

## 2. BIGBIKE SCHEMA SUMMARY

### 2.1 Entities chính (64 entity)

| Entity → bảng | Trường quan trọng cho migration |
|---|---|
| `ProductEntity` → `products` | `id`(String), **`legacyId`(unique)**, `sku`(nullable), `slug`(NN,unique), `name`(NN), `description`/`shortDescription`, `brand`(nullable), **`category`(NOT NULL)**, `tags`(M2M), ảnh, `retailPrice`(NN), `salePrice`, `currency`(NN), `stockState`(enum NN), `stockQuantity`, `weightKg/lengthCm/widthCm/heightCm`(nullable), `publishStatus`(enum NN), **`rating`/`ratingCount`**, `promotionContent`, `installationGuide`, **`nameEn`/`descriptionEn`…** (song ngữ), `gallery/videos/specifications/faqs/variants` |
| `ProductVariantEntity` → `product_variants` | `product`(NN), `sku`(nullable), `name`(NN), giá, `stockState`(NN), `quantityOnHand`(NN), `isAvailable`(NN), `options`(thuộc tính), `gallery` |
| `CategoryEntity` → `categories` | `slug`(NN,unique), `name`(NN), **`parent`(self-ref → lồng không giới hạn)**, ảnh/icon/banner, SEO, EN, `isVisible`(NN) |
| `BrandEntity` → `brands` | `slug`(NN,unique), `name`(NN), logo/banner, SEO, EN, `isVisible`(NN) |
| `OrderEntity` → `orders` | `id`(UUID), **`legacyId`(unique)**, `orderNumber`, **`customerId`(NULLABLE → guest OK)**, `customerName/Email/Phone` (snapshot), `status`(NN ↔ `OrderStatus`), `paymentStatus`(NN), các khoản tiền (NN), **`refundReason/refundAmount/refundedAt`**, `paymentMethod`, mốc thời gian |
| `OrderStatus` (enum) | **PENDING · PROCESSING · ON_HOLD · COMPLETED · CANCELLED · REFUNDED · FAILED** — khớp 1:1 WooCommerce |
| `CustomerEntity` → `customers` | `id`(UUID), **`legacyId`(unique)**, `email`, `phone`, `passwordHash`, `firstName`/`lastName` (tách), `displayName`, `status`(NN), **`oauthProvider`/`oauthSubject`** (social login), `gender`, `dob`, credit profile |
| Khác | `MediaEntity`(file_path, public_url, storage_provider=MINIO, bucket, sizes json), `CouponEntity`, `ReviewEntity`, `ShippingZone/Method`, `ProductVideo`, serial-inventory (ProductSerial…) |

`PublishStatus` (enum): DRAFT · PUBLISHED · HIDDEN · TRASH · ARCHIVED · PENDING · PRIVATE.
`ProductStockState` (enum): IN_STOCK · LOW_STOCK · OUT_OF_STOCK.

### 2.2 Trạng thái DB BigBike hiện tại (đã nhập 1 phần, ~2026-05-08)

| Bảng | Rows | Tình trạng |
|---|---|---|
| products | 1.232 (1.231 có legacy_id) | ⚠️ **21 PUBLISHED / 1.211 DRAFT**; trong 192 SP đang bán của WP: **9 published, 183 draft**; **313 SP tồn dư** (đã xóa bên WP); chỉ 2 SP mới chưa nhập |
| product_variants | 4.041 | đã nhập |
| categories / brands / product_tags | 45 / 46 / 2.464 | đã nhập (gồm vài term test) |
| media | 12.069 | ✅ **đã copy đầy đủ — MinIO `bigbike-media/wp-uploads/` = 8,4 GB, ảnh tải được (HTTP 200)** |
| orders / customers | 6 / 1 | ⚠️ **chỉ dữ liệu test** (email duc237022@gmail.com) |
| reviews / coupons / wishlist | 0 / 0 / 0 | chưa nhập (WP cũng gần như rỗng) |

### 2.3 Công cụ migration đã có sẵn

Package `migration/wordpress/` — importer + mapper cho **mọi domain** (catalog, media, customers, orders, coupons, redirects…), media copy lên MinIO, dry-run, write-plan chống ghi đè. Điều khiển qua `bigbike.migration.wordpress.*`:
`enabled` (mặc định false), `dryRun` (mặc định true), `confirmExecute`, `environment` (local/staging), `domains`, `dumpPath`, `uploadsPath`, MinIO config. → **Việc viết script migration coi như đã xong ~90%; phần còn lại là chạy + kiểm tra + vá vài edge case.**

---

## 3. FIELD MAPPING ANALYSIS

Ký hiệu: ✅ Direct · ⚠️ Transform · ❌ Lost · 🔴 Blocker

### 3.1 Products

| WP field | Nguồn WP | BigBike field | Status | Ghi chú |
|---|---|---|---|---|
| post_title | kd_posts | `name` | ✅ | |
| post_name | kd_posts | `slug` (NN, unique) | ✅ | |
| ID | kd_posts | `legacyId` + id `wp-prod-<ID>` | ✅ | khóa đối chiếu |
| post_content | kd_posts | `description` | ✅ | |
| post_excerpt | kd_posts | `shortDescription` | ✅ | |
| `_sku` | postmeta | `sku` (nullable) | ✅ | 100% SP đang bán có SKU |
| `_regular_price` | postmeta | `retailPrice` (NN) | ✅ | |
| `_sale_price` | postmeta | `salePrice` | ✅ | |
| `_stock_status` | postmeta | `stockState` (enum) | ⚠️ | instock→IN_STOCK, outofstock→OUT_OF_STOCK, **onbackorder(21)→IN_STOCK** + `backorders` |
| `_stock` / `_manage_stock` | postmeta | `stockQuantity` / `manageStock` | ✅ | |
| `_weight` | postmeta | `weightKg` | ⚠️ | chỉ 20 SP có dữ liệu (nullable nên OK) |
| `_length/_width/_height` | postmeta | `lengthCm/widthCm/heightCm` | ⚠️ | gần như rỗng (nullable) |
| product_type (taxonomy) | term | (suy ra từ có/không có variants) | ✅ | variable=có variants, simple=không |
| product_cat (cây 3 cấp) | term | `category` (NN) + `parent` | ✅ | hỗ trợ lồng nhau |
| pwb-brand | term | `brand` (nullable) | ✅ | 16 thương hiệu |
| product_tag | term | `tags` (M2M) | ✅ | 2.895 tag |
| pa_size/pa_color/… | term | `attribute_values` + variant `options` | ✅ | |
| `_thumbnail_id` | postmeta | `imageId`/`imageUrl` | ⚠️ | cần resolve attachment ID → URL MinIO |
| `_product_image_gallery` | postmeta | `gallery` | ⚠️ | resolve ID → URL |
| `rtwpvg_images` | postmeta | variant `gallery` | ⚠️ | ảnh biến thể |
| ACF `rating`/`rating_count` | postmeta | `rating`/`ratingCount` | ✅ | số nhập tay |
| ACF `videos` | postmeta | `videos` | ✅ | |
| ACF `product_more_infomation` | postmeta | `promotionContent` | ⚠️ | quyết định trường đích |
| ACF `content_bottom` | postmeta | `description`/`descriptionBlocks` | ⚠️ | nối thêm |
| Polylang EN | term language | `nameEn`/`descriptionEn`… | ✅ | chỉ 6 SP |
| rank_math_* (SEO) | postmeta | `seoTitle`/`seoDescription` (1 phần) | ⚠️/❌ | phần lớn SEO meta sẽ bỏ |
| publish status | post_status | `publishStatus` (enum) | ✅ | publish→PUBLISHED |

### 3.2 Orders

| WP field | BigBike field | Status | Ghi chú |
|---|---|---|---|
| ID | `legacyId` | ✅ | |
| post_status (wc-*) | `status` (OrderStatus) | ✅ | **1:1**: pending/processing/on-hold/completed/cancelled |
| `_customer_user` (0 = guest) | `customerId` (nullable) | ✅ | **guest OK** — lưu snapshot tên/email/phone |
| `_order_total` + các khoản | `totalAmount`/`subtotal`/… | ✅ | |
| `_payment_method` | `paymentMethod` (String) | ⚠️ | bacs/cod + checkmo/cashondelivery/ccsave (Magento) cần chuẩn hóa nhãn |
| order_items (line_item) | `OrderLineItem` (snapshot) | ✅ | lưu tên/giá tại thời điểm mua |
| order_items (shipping) | `OrderShippingItem` | ✅ | |
| `is_vat_exempt` | `taxAmount`/note | ⚠️ | 251 đơn |
| billing/shipping | `OrderAddress` | ✅ | |
| refund | `refundAmount`/`refundedAt` | ✅ | WP có 0 refund |

### 3.3 Customers / Users

| WP field | BigBike field | Status | Ghi chú |
|---|---|---|---|
| ID | `legacyId` | ✅ | |
| user_email | `email` | ✅ | |
| billing_first_name / last_name | `firstName` / `lastName` | ✅ | tách sẵn |
| display_name | `displayName` | ✅ | |
| billing_phone | `phone` | ✅ | |
| **user_pass** | `passwordHash` | ✅ | **phpass → hỗ trợ sẵn**; **định dạng mới `$wp$2y$` → đã hỗ trợ** (verifier `$wp$` + tự đổi sang Argon2 khi đăng nhập, 2026-06-12) |
| Facebook (nextend) | `oauthProvider`/`oauthSubject` | ✅ | 65 user |
| billing_* address | `CustomerAddress` (BILLING) | ✅ | 453 user |
| shipping_* address | `CustomerAddress` (SHIPPING) | ✅ | 447 user |
| role (customer/subscriber/…) | `status` + role | ⚠️ | subscriber không có địa chỉ vẫn nhập (theo quyết định) |
| magentopass / magento_customer_id | — | ❌ | bỏ (mật khẩu thật ở user_pass) |

---

## 4. GAPS & ISSUES

### 4.1 Data sẽ MẤT khi migrate (WP có, BigBike không có trường tương ứng)
- **SEO meta của Rank Math** (focus keyword, schema, OG tùy biến…): phần lớn bỏ; chỉ giữ title/description cơ bản.
- **magentopass / magento_customer_id**: bỏ (không cần — mật khẩu thật ở `user_pass`).
- **CFDB7 (618 lượt gửi form liên hệ)**: không thuộc e-commerce, không migrate.
- **Bản dịch English của danh mục/term ít dùng**: giữ ở mức cột EN, các term EN 0-sản-phẩm bỏ.

### 4.2 🔴 BLOCKER (BigBike bắt buộc nhưng nguồn WP thiếu)
- **Không có blocker cứng.** Mọi trường NOT NULL của BigBike đều có nguồn hoặc giá trị mặc định hợp lý:
  - `category` (NN): 100% SP đang bán có danh mục.
  - `retailPrice`/`currency`/`stockState`/`publishStatus` (NN): đều có nguồn (currency mặc định VND).
  - `sku` nullable → SP thiếu SKU vẫn nhập được (mà thực tế 192/192 đều có).

### 4.3 Cần TRANSFORM (migrate được nhưng phải xử lý)
1. **Ảnh: resolve attachment ID → URL MinIO** cho thumbnail, gallery, ảnh biến thể, ảnh ACF.
2. **`onbackorder` (21)** → `stockState=IN_STOCK` + cờ `backorders` (vẫn cho đặt hàng).
3. **Nhãn phương thức thanh toán Magento** (checkmo/cashondelivery/ccsave) → chuẩn hóa về nhãn BigBike.
4. **ACF `product_more_infomation` / `content_bottom`** → gộp vào `promotionContent` / `description`.
5. ~~**79 mật khẩu `$wp$2y$`** → cần bổ sung verifier hoặc buộc reset~~ → ✅ **ĐÃ XỬ LÝ (2026-06-12):** thêm verifier `$wp$` (HMAC-SHA384 + bcrypt) trong `PasswordService`, tự đổi sang Argon2 khi đăng nhập thành công. Không cần buộc reset. (69 user `$wp$2y$` thực tế trong DB.)

### 4.4 NEEDS_VERIFICATION (cần xác nhận khi chạy thật)
- Catalog re-import dùng conflict strategy **UPDATE** để 313 SP tồn dư được xử lý đúng (giữ / ẩn / xóa).
- 21 SP đã chỉnh tay trên BigBike sau lần nhập tháng 5 — re-import có ghi đè chỉnh sửa đó không.
- Cách nối khách (legacy user id) ↔ đơn hàng để không tạo trùng khách.

---

## 5. MIGRATION DECISIONS (đã xác nhận với chủ đầu tư — 2026-06-11)

| # | Vấn đề | Lựa chọn đã chốt | Hệ quả / Records ảnh hưởng |
|---|---|---|---|
| 1 | Catalog đã cũ (183/192 còn ẩn, 313 SP tồn dư) | **Lấy lại dữ liệu mới (re-import từ dump mới nhất)** | Re-import toàn bộ catalog; SP đang publish bên WP sẽ tự PUBLISHED; reconcile 313 SP tồn dư; **lưu ý 21 SP chỉnh tay có thể bị ghi đè** |
| 2 | Phạm vi đơn hàng | **Toàn bộ 1.660 đơn (2014→nay)** | Giữ đầy đủ lịch sử + doanh thu ₫2,2 tỷ, gồm cả đơn thời Magento |
| 3 | Phạm vi khách hàng | **Toàn bộ 1.967 tài khoản** | Gồm ~1.500 tài khoản chỉ đăng ký nhận tin; không ai mất quyền đăng nhập |
| 4 | Phạm vi ảnh | **Chỉ ảnh gốc (~13.400 file)** | ⚠️ Không cần thực hiện nữa — kiểm tra lại cho thấy **toàn bộ ảnh (8,4 GB, mọi cỡ) đã có sẵn trên MinIO và tải được** |

### Blockers chưa giải quyết
Không có blocker cứng. Các điểm TRANSFORM ở 4.3 (đặc biệt **79 mật khẩu định dạng mới** và **copy ảnh lên MinIO**) cần xử lý trước cut-over.

---

## 6. RỦI RO & BLOCKERS

### 🔴 Blockers (phải xong trước cut-over)
1. **Catalog phần lớn còn ẩn** → re-import (đã chốt) để xuất bản đúng 192 SP đang bán.
2. **Đơn hàng & khách hàng chưa chuyển** → chạy importer trước khi cut-over.

> ✅ Ảnh sản phẩm **không còn là blocker** — đã copy đầy đủ lên MinIO (8,4 GB) và tải được bình thường.

### 🟠 Rủi ro cao
- **21 SP chỉnh tay** có thể bị ghi đè khi re-import — cần xác định conflict strategy.
- ~~**79 user (`$wp$2y$`)** không đăng nhập được nếu chưa bổ sung verifier~~ → ✅ **đã hỗ trợ verifier (2026-06-12)** — các user này đăng nhập bình thường, không cần thông báo đặt lại.
- **Khớp guest order ↔ khách**: 533 đơn guest — đảm bảo không tạo khách trùng.

### 🟡 Rủi ro trung bình
- Nhãn thanh toán Magento gây rối báo cáo nếu không chuẩn hóa.
- Cân nặng/kích thước gần như rỗng → tính phí ship theo trọng lượng sẽ thiếu dữ liệu.
- Bản dịch EN rất ít (6 SP) — kỳ vọng đa ngôn ngữ cần được làm rõ.

---

## 7. THỨ TỰ MIGRATION KHUYẾN NGHỊ

1. **Tạo SQL dump mới** từ `bigbike_main` (mysqldump) + xác định đường dẫn `uploads`.
2. **Re-import catalog** (thứ tự: categories → brands → tags → attributes → media metadata → products → variations → reviews) với conflict strategy **UPDATE** — làm tươi dữ liệu & xuất bản 192 SP đang bán; xử lý 313 SP tồn dư.
3. ~~Copy ảnh lên MinIO~~ — **đã xong từ trước** (8,4 GB trong `bigbike-media/wp-uploads/`, tải được). Bỏ qua.
4. **Import khách hàng** (toàn bộ 1.967) — phpass và `$wp$2y$` đều đăng nhập được ngay (verifier đã bổ sung 2026-06-12).
5. **Import đơn hàng** (toàn bộ 1.660) — nối với khách qua legacy id; guest lưu snapshot.
6. **Import coupon** (1) + redirect SEO (URL cũ → mới) để không mất thứ hạng tìm kiếm.
7. **Kiểm tra:** đếm SP đã xuất bản = 192; ảnh hiển thị; tổng doanh thu/đơn khớp; thử đăng nhập vài khách; spot-check 10–20 SP.
8. **Chỉ khi 7 đạt** → Phase 7 Nginx cutover (cần gõ `YES` xác nhận).

---

## 8. ƯỚC TÍNH ĐỘ PHỨC TẠP

**Đánh giá:** 🟢 **Medium** (nhờ công cụ migration đã dựng sẵn ~90%).

**Lý do:**
- Schema BigBike thiết kế sẵn cho migration: `legacyId`, status enum khớp 1:1, guest nullable, danh mục lồng nhau, song ngữ, social login, rating/videos — **không có blocker cứng**.
- Phần "viết script" gần như xong; việc còn lại chủ yếu là **chạy + kiểm tra + vá vài edge case** (79 mật khẩu, onbackorder, nhãn thanh toán, conflict 21 SP chỉnh tay).
- Khối lượng dữ liệu vừa phải (192 SP / 1.660 đơn / 1.967 khách / ~13K ảnh).

**Ước tính thời gian hoàn tất migration (không tính viết mới script):** **3–5 ngày làm việc** cho execution + verification + xử lý edge case, trước khi sẵn sàng cut-over.

---

*Phase 7 (Nginx cutover) CHƯA chạy — chỉ thực hiện khi có xác nhận `YES` tường minh sau khi các blocker mục 6 được giải quyết.*
