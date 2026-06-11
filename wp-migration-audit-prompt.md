# WordPress → BigBike: Migration Readiness Audit

> **Cách dùng**: Paste toàn bộ nội dung này vào Claude Code trên VPS. Claude Code sẽ tự thực hiện toàn bộ phân tích và xuất report.

---

## Mục tiêu

Kiểm tra toàn bộ dữ liệu WordPress/WooCommerce tại `/var/www/bigbike/files/` và so sánh với dự án BigBike mới tại `/root/myproject/bigbike-web-new/` để xác định toàn bộ vấn đề cần giải quyết trước khi **cut-over** (tắt WordPress, chuyển hoàn toàn sang BigBike).

**Phase 1–5 là READ-ONLY** — không sửa file, không chạy UPDATE/INSERT/DELETE/DROP.
**Phase 6 (Nginx cutover) là DESTRUCTIVE** — chỉ thực hiện khi user xác nhận tường minh sau khi Phase 5 hoàn thành.

---

## Phạm vi migration

**Chỉ migrate sản phẩm đang bán** — cụ thể là sản phẩm thỏa mãn **tất cả** điều kiện:

1. `post_status = 'publish'` — đang được publish, không phải draft/private/trash
2. `_catalog_visibility != 'hidden'` — không bị ẩn khỏi catalog lẫn search

Sản phẩm không thỏa điều kiện trên được coi là **ngừng bán** và **bỏ qua hoàn toàn** khi migration — không cần phân tích gap, không cần mapping.

> Toàn bộ query trong Phase 2.1 và các bảng mapping trong Phase 4 phải áp dụng filter này. Các phase khác (orders, customers, media) vẫn audit toàn bộ.

---

## Thông tin hệ thống

| | |
|---|---|
| WordPress path | `/var/www/bigbike/files/` |
| WordPress DB | `mysql -u root bigbike_main` — prefix bảng: `kd_` |
| BigBike project | `/root/myproject/bigbike-web-new/` |
| BigBike backend | `/root/myproject/bigbike-web-new/bigbike-backend/src/main/java/` |
| BigBike docs | `/root/myproject/bigbike-web-new/docs/` |
| Docker Compose | `/root/myproject/bigbike-web-new/docker-compose.yaml` |
| BigBike PostgreSQL | Container `bigbike-postgres` — credentials trong docker-compose.yaml |

**WordPress site bán đồ bảo hộ mô tô (không phải xe máy).** Các plugin chính: WooCommerce, ACF Pro, Pods, Polylang, perfect-woocommerce-brands, woo-product-variation-gallery, smart-variations-images.

---

## Phase 1 — Verify hạ tầng

1. Chạy `docker compose -f /root/myproject/bigbike-web-new/docker-compose.yaml ps` để xác nhận stack đang chạy.
2. Verify MySQL: `mysql -u root bigbike_main -e "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='bigbike_main';"` — in ra số bảng.
3. Đọc file `/root/myproject/bigbike-web-new/docker-compose.yaml`, lấy credentials PostgreSQL (user, password, db name).
4. Verify PostgreSQL: `docker exec bigbike-postgres psql -U <USER> -d <DB> -c "\dt"` — in ra số bảng.
5. In tóm tắt: stack nào đang chạy, version MariaDB, version PostgreSQL.

---

## Phase 2 — Inventory dữ liệu WordPress

Chạy toàn bộ query sau. Dùng `mysql -u root bigbike_main -e "..."` cho từng block.

### 2.1 Products

> **Lưu ý**: Toàn bộ query trong section này chỉ đếm/phân tích sản phẩm **đang bán** (xem "Phạm vi migration" bên trên). Sản phẩm ngừng bán được thống kê riêng ở block đầu tiên rồi bỏ qua.

```sql
-- ① Thống kê sản phẩm NGỪNG BÁN (để biết có bao nhiêu, rồi bỏ qua)
SELECT p.post_status, COUNT(*) AS count
FROM kd_posts p
WHERE p.post_type = 'product'
GROUP BY p.post_status;

-- Sản phẩm hidden khỏi catalog (publish nhưng visibility = hidden)
SELECT COUNT(*) AS hidden_products
FROM kd_postmeta pm
JOIN kd_posts p ON pm.post_id = p.ID
WHERE p.post_type = 'product'
  AND p.post_status = 'publish'
  AND pm.meta_key = '_visibility'
  AND pm.meta_value = 'hidden';

-- Catalog visibility breakdown (WC 3.x+ dùng term thay meta)
SELECT t.name AS visibility, COUNT(DISTINCT tr.object_id) AS count
FROM kd_term_relationships tr
JOIN kd_term_taxonomy tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
JOIN kd_terms t ON tt.term_id = t.term_id
JOIN kd_posts p ON tr.object_id = p.ID
WHERE tt.taxonomy = 'product_visibility'
  AND p.post_type = 'product' AND p.post_status = 'publish'
GROUP BY t.name;

-- ② Từ đây trở xuống: CHỈ sản phẩm đang bán
-- Định nghĩa CTE dùng chung (thay thế bằng subquery nếu MySQL không hỗ trợ CTE)
-- active_products = publish + không hidden

-- Tổng sản phẩm đang bán theo type
SELECT pm.meta_value AS product_type, COUNT(*) AS count
FROM kd_postmeta pm
JOIN kd_posts p ON pm.post_id = p.ID
WHERE pm.meta_key = '_product_type'
  AND p.post_status = 'publish'
  AND p.ID NOT IN (
    SELECT DISTINCT tr.object_id
    FROM kd_term_relationships tr
    JOIN kd_term_taxonomy tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
    JOIN kd_terms t ON tt.term_id = t.term_id
    WHERE tt.taxonomy = 'product_visibility' AND t.name = 'hidden'
  )
GROUP BY pm.meta_value;

-- Tổng variations của sản phẩm đang bán
SELECT COUNT(*) AS total_active_variations
FROM kd_posts v
JOIN kd_posts parent ON v.post_parent = parent.ID
WHERE v.post_type = 'product_variation'
  AND parent.post_status = 'publish'
  AND parent.ID NOT IN (
    SELECT DISTINCT tr.object_id
    FROM kd_term_relationships tr
    JOIN kd_term_taxonomy tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
    JOIN kd_terms t ON tt.term_id = t.term_id
    WHERE tt.taxonomy = 'product_visibility' AND t.name = 'hidden'
  );

-- Sản phẩm variable đang bán
SELECT COUNT(DISTINCT v.post_parent) AS active_variable_products
FROM kd_posts v
JOIN kd_posts parent ON v.post_parent = parent.ID
WHERE v.post_type = 'product_variation'
  AND parent.post_status = 'publish'
  AND parent.ID NOT IN (
    SELECT DISTINCT tr.object_id
    FROM kd_term_relationships tr
    JOIN kd_term_taxonomy tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
    JOIN kd_terms t ON tt.term_id = t.term_id
    WHERE tt.taxonomy = 'product_visibility' AND t.name = 'hidden'
  );

-- Sản phẩm có variation gallery (chỉ sản phẩm đang bán)
SELECT meta_key, COUNT(DISTINCT pm.post_id) AS products_count
FROM kd_postmeta pm
JOIN kd_posts p ON pm.post_id = p.ID
WHERE pm.meta_key IN (
  'woo_variation_gallery_images',
  'woo-product-variation-gallery',
  '_svi_image',
  '_svi_gallery_images',
  'variable_image_id'
)
AND p.post_type = 'product'
AND p.post_status = 'publish'
GROUP BY meta_key;

-- SKU coverage (chỉ sản phẩm đang bán)
SELECT
  COUNT(*) AS active_products_with_sku,
  (SELECT COUNT(*) FROM kd_posts WHERE post_type='product' AND post_status='publish') AS total_published
FROM kd_postmeta pm
JOIN kd_posts p ON pm.post_id = p.ID
WHERE pm.meta_key = '_sku' AND pm.meta_value != ''
  AND p.post_type = 'product' AND p.post_status = 'publish';

-- Key coverage: price, stock, weight, dimensions (chỉ sản phẩm đang bán và variations của chúng)
SELECT meta_key, COUNT(*) AS usage
FROM kd_postmeta pm
JOIN kd_posts p ON pm.post_id = p.ID
WHERE (
  (p.post_type = 'product' AND p.post_status = 'publish')
  OR (
    p.post_type = 'product_variation'
    AND p.post_parent IN (SELECT ID FROM kd_posts WHERE post_type='product' AND post_status='publish')
  )
)
AND pm.meta_key IN (
  '_sku','_price','_regular_price','_sale_price',
  '_stock','_stock_status','_manage_stock',
  '_weight','_length','_width','_height',
  '_thumbnail_id','_product_image_gallery'
)
GROUP BY meta_key ORDER BY meta_key;

-- ACF / custom meta keys trên sản phẩm đang bán
SELECT meta_key, COUNT(*) AS usage_count
FROM kd_postmeta pm
JOIN kd_posts p ON pm.post_id = p.ID
WHERE p.post_type = 'product'
  AND p.post_status = 'publish'
  AND meta_key NOT LIKE '\_%'
GROUP BY meta_key
ORDER BY usage_count DESC
LIMIT 40;

-- ACF field groups đang active
SELECT p.post_title AS field_group, p.post_status
FROM kd_posts p
WHERE p.post_type = 'acf-field-group'
ORDER BY p.post_title;

-- ACF fields trong từng group
SELECT
  gp.post_title AS group_name,
  fp.post_title AS field_label,
  fp.post_name AS field_key,
  pm.meta_value AS field_type
FROM kd_posts fp
JOIN kd_posts gp ON fp.post_parent = gp.ID
JOIN kd_postmeta pm ON fp.ID = pm.post_id AND pm.meta_key = 'type'
WHERE fp.post_type = 'acf-field'
ORDER BY gp.post_title, fp.menu_order;
```

### 2.2 Categories & Brands

```sql
-- Cây danh mục sản phẩm
SELECT
  t.term_id, t.name, t.slug,
  tt.parent AS parent_id,
  tt.count AS product_count
FROM kd_terms t
JOIN kd_term_taxonomy tt ON t.term_id = tt.term_id
WHERE tt.taxonomy = 'product_cat'
ORDER BY tt.parent, t.name;

-- Brands (perfect-woocommerce-brands)
SELECT t.name AS brand, t.slug, tt.count AS product_count
FROM kd_terms t
JOIN kd_term_taxonomy tt ON t.term_id = tt.term_id
WHERE tt.taxonomy = 'product_brand'
ORDER BY tt.count DESC;

-- Tổng brands
SELECT COUNT(*) AS total_brands
FROM kd_term_taxonomy
WHERE taxonomy = 'product_brand';

-- Product attributes (pa_*)
SELECT
  tt.taxonomy AS attribute,
  COUNT(DISTINCT t.term_id) AS value_count,
  SUM(tt.count) AS usage_on_products
FROM kd_terms t
JOIN kd_term_taxonomy tt ON t.term_id = tt.term_id
WHERE tt.taxonomy LIKE 'pa_%'
GROUP BY tt.taxonomy
ORDER BY usage_on_products DESC;

-- Product tags
SELECT COUNT(*) AS total_tags, SUM(tt.count) AS total_usages
FROM kd_term_taxonomy tt
WHERE tt.taxonomy = 'product_tag';
```

### 2.3 Customers & Users

```sql
-- Tổng users theo role (WP role key có prefix kd_)
SELECT
  REPLACE(
    REPLACE(
      SUBSTRING_INDEX(meta_value, '"', 2), 'a:', ''), '"', ''
  ) AS role_hint,
  COUNT(*) AS count
FROM kd_usermeta
WHERE meta_key = 'kd_capabilities'
  AND meta_value != 'a:0:{}'
GROUP BY meta_value
ORDER BY count DESC
LIMIT 10;

-- Tổng users
SELECT COUNT(*) AS total_users FROM kd_users;

-- Customers có billing address
SELECT COUNT(DISTINCT user_id) AS users_with_billing
FROM kd_usermeta
WHERE meta_key = 'billing_first_name' AND meta_value != '';

-- Customers có shipping address khác billing
SELECT COUNT(DISTINCT user_id) AS users_with_shipping
FROM kd_usermeta
WHERE meta_key = 'shipping_first_name' AND meta_value != '';

-- Social login (nextend-facebook-connect)
SELECT COUNT(*) AS facebook_linked_users
FROM kd_usermeta
WHERE meta_key LIKE '%nextend%facebook%' OR meta_key LIKE '%social%facebook%';

-- User meta keys đang dùng
SELECT meta_key, COUNT(*) AS count
FROM kd_usermeta
WHERE meta_key NOT LIKE 'kd_%'
  AND meta_key NOT IN ('session_tokens','wp_user_level','description')
GROUP BY meta_key
HAVING count > 5
ORDER BY count DESC
LIMIT 30;
```

### 2.4 Orders

```sql
-- Orders theo status + doanh thu
SELECT
  p.post_status AS status,
  COUNT(*) AS count,
  COALESCE(SUM(CAST(pm.meta_value AS DECIMAL(15,2))), 0) AS total_revenue
FROM kd_posts p
LEFT JOIN kd_postmeta pm ON p.ID = pm.post_id AND pm.meta_key = '_order_total'
WHERE p.post_type = 'shop_order'
GROUP BY p.post_status
ORDER BY count DESC;

-- Khoảng thời gian đơn hàng
SELECT
  MIN(post_date) AS oldest_order,
  MAX(post_date) AS newest_order,
  COUNT(*) AS total_orders
FROM kd_posts
WHERE post_type = 'shop_order';

-- Guest orders vs logged-in
SELECT
  CASE WHEN meta_value = '0' THEN 'guest' ELSE 'registered' END AS customer_type,
  COUNT(*) AS count
FROM kd_postmeta
WHERE meta_key = '_customer_user'
GROUP BY CASE WHEN meta_value = '0' THEN 'guest' ELSE 'registered' END;

-- Order items
SELECT COUNT(*) AS total_line_items
FROM kd_woocommerce_order_items
WHERE order_item_type = 'line_item';

-- Order item meta keys
SELECT meta_key, COUNT(*) AS count
FROM kd_woocommerce_order_itemmeta
GROUP BY meta_key
ORDER BY count DESC
LIMIT 20;

-- Payment methods
SELECT meta_value AS payment_method, COUNT(*) AS count
FROM kd_postmeta
WHERE meta_key = '_payment_method'
GROUP BY meta_value ORDER BY count DESC;

-- Shipping methods used
SELECT meta_value AS shipping_method, COUNT(*) AS count
FROM kd_postmeta
WHERE meta_key = '_shipping_method'
GROUP BY meta_value ORDER BY count DESC;

-- Refunds
SELECT COUNT(*) AS total_refunds
FROM kd_posts
WHERE post_type = 'shop_order_refund';

-- Coupons
SELECT COUNT(*) AS total_coupons FROM kd_posts WHERE post_type = 'shop_coupon' AND post_status = 'publish';

-- Order meta keys đặc biệt
SELECT meta_key, COUNT(*) AS count
FROM kd_postmeta pm
JOIN kd_posts p ON pm.post_id = p.ID
WHERE p.post_type = 'shop_order'
  AND meta_key NOT LIKE '\_%'
GROUP BY meta_key
HAVING count > 3
ORDER BY count DESC;
```

### 2.5 Media & Uploads

```bash
# Size thư mục uploads
du -sh /var/www/bigbike/files/wp-content/uploads/

# Tổng số file
find /var/www/bigbike/files/wp-content/uploads -type f | wc -l

# Phân loại theo extension
find /var/www/bigbike/files/wp-content/uploads -type f \
  | sed 's/.*\.//' | tr '[:upper:]' '[:lower:]' \
  | sort | uniq -c | sort -rn | head 15
```

```sql
-- Attachments theo mime type
SELECT post_mime_type, COUNT(*) AS count
FROM kd_posts
WHERE post_type = 'attachment'
GROUP BY post_mime_type ORDER BY count DESC;

-- Tổng attachments
SELECT COUNT(*) AS total_attachments FROM kd_posts WHERE post_type = 'attachment';
```

### 2.6 Polylang (đa ngôn ngữ)

```sql
-- Ngôn ngữ đang dùng
SELECT t.name, t.slug, tt.count AS translated_items
FROM kd_terms t
JOIN kd_term_taxonomy tt ON t.term_id = tt.term_id
WHERE tt.taxonomy = 'language'
ORDER BY tt.count DESC;

-- Products đã được dịch
SELECT COUNT(DISTINCT tr.object_id) AS translated_products
FROM kd_term_relationships tr
JOIN kd_term_taxonomy tt ON tr.term_taxonomy_id = tt.term_taxonomy_id
JOIN kd_posts p ON tr.object_id = p.ID
WHERE tt.taxonomy = 'language' AND p.post_type = 'product';

-- Polylang translations table (nếu tồn tại)
SELECT COUNT(*) AS total_translation_pairs
FROM kd_pll_translations 2>/dev/null;
```

### 2.7 Pods Custom Post Types

```sql
-- Tất cả post_type không phải WP/WC chuẩn
SELECT post_type, COUNT(*) AS count
FROM kd_posts
WHERE post_type NOT IN (
  'post','page','attachment','revision','nav_menu_item',
  'custom_css','customize_changeset','oembed_cache',
  'user_request','wp_block','wp_template','wp_template_part',
  'shop_order','shop_order_refund','shop_coupon',
  'product','product_variation',
  'acf-field','acf-field-group',
  '_pods_pod','_pods_field'
)
AND post_status NOT IN ('auto-draft','trash')
GROUP BY post_type
ORDER BY count DESC;

-- Pods pod definitions
SELECT p.post_name AS pod_name, p.post_title, p.post_status
FROM kd_posts p
WHERE p.post_type = '_pods_pod'
ORDER BY p.post_name;

-- Pods fields cho từng pod
SELECT
  parent.post_name AS pod_name,
  f.post_title AS field_label,
  f.post_name AS field_name,
  pm.meta_value AS field_type
FROM kd_posts f
JOIN kd_posts parent ON f.post_parent = parent.ID
LEFT JOIN kd_postmeta pm ON f.ID = pm.post_id AND pm.meta_key = 'type'
WHERE f.post_type = '_pods_field'
ORDER BY parent.post_name, f.menu_order;
```

### 2.8 Reviews, Coupons & Shipping

```sql
-- Product reviews
SELECT
  COUNT(*) AS total_reviews,
  AVG(CAST(cm.meta_value AS DECIMAL(3,1))) AS avg_rating,
  MIN(c.comment_date) AS oldest_review,
  MAX(c.comment_date) AS newest_review
FROM kd_comments c
JOIN kd_commentmeta cm ON c.comment_ID = cm.comment_id AND cm.meta_key = 'rating'
WHERE c.comment_type IN ('review','');

-- Shipping zones
SELECT zone_name, zone_order
FROM kd_woocommerce_shipping_zones
ORDER BY zone_order;

-- Coupon details
SELECT
  p.post_title AS coupon_code,
  pm1.meta_value AS discount_type,
  pm2.meta_value AS amount,
  p.post_status
FROM kd_posts p
LEFT JOIN kd_postmeta pm1 ON p.ID = pm1.post_id AND pm1.meta_key = 'discount_type'
LEFT JOIN kd_postmeta pm2 ON p.ID = pm2.post_id AND pm2.meta_key = 'coupon_amount'
WHERE p.post_type = 'shop_coupon'
ORDER BY p.post_title;
```

### 2.9 Contact Form 7 Submissions (CFDB7)

```sql
-- Form names và số lượng submission
SELECT form_name, COUNT(*) AS submissions
FROM kd_db7_forms
GROUP BY form_name
ORDER BY submissions DESC;
```

---

## Phase 3 — BigBike Schema Analysis

### 3.1 Đọc BigBike docs

Đọc (chỉ phần liên quan đến product, order, user/customer):
- `/root/myproject/bigbike-web-new/docs/engineering/DATA_CONTRACT.md`
- `/root/myproject/bigbike-web-new/docs/business/BUSINESS_RULES.md`
- `/root/myproject/bigbike-web-new/docs/business/MODULE_CATALOG.md`
- `/root/myproject/bigbike-web-new/docs/engineering/API_CONTRACT.md`

### 3.2 Quét Entity files

Quét toàn bộ `/root/myproject/bigbike-web-new/bigbike-backend/src/main/java/`:

```bash
# Tìm tất cả @Entity classes
grep -rl "@Entity" /root/myproject/bigbike-web-new/bigbike-backend/src/main/java/ --include="*.java"

# Tìm tên table của từng entity
grep -rn "@Table\|@Entity\|@Column\|@NotNull\|@NotBlank" \
  /root/myproject/bigbike-web-new/bigbike-backend/src/main/java/ \
  --include="*.java" -l
```

Với mỗi entity file tìm được, đọc và ghi lại:
- Tên class + tên table
- Tất cả fields: tên, kiểu, constraint (`@NotNull`, `@NotBlank`, `@Size`, nullable, unique)
- Relationships (`@OneToMany`, `@ManyToOne`, `@ManyToMany`)

Ưu tiên đọc kỹ: `Product`, `ProductVariant` (hoặc `Variant`), `Category`, `Brand`, `Order`, `OrderItem`, `User` (hoặc `Customer`), `Address`, `ProductImage`, `ProductAttribute`, `Inventory`.

### 3.3 Query BigBike PostgreSQL

```bash
# Lấy credentials
grep -A 20 "postgres\|POSTGRES" /root/myproject/bigbike-web-new/docker-compose.yaml

# List tất cả tables
docker exec bigbike-postgres psql -U <USER> -d <DB> -c "\dt"

# Schema chi tiết các bảng quan trọng (thay tên bảng thực tế)
for TABLE in products product_variants categories brands orders order_items users addresses product_images; do
  docker exec bigbike-postgres psql -U <USER> -d <DB> -c "\d $TABLE" 2>/dev/null && echo "---"
done

# Row counts (xem bảng nào đã có data)
docker exec bigbike-postgres psql -U <USER> -d <DB> -c "
SELECT schemaname, tablename, n_live_tup AS row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
"
```

---

## Phase 4 — Gap Analysis

Sau khi có đủ dữ liệu từ Phase 2 và 3, phân tích và điền vào các bảng sau:

### 4.1 Product field mapping

Tạo bảng mapping đầy đủ với status:
- ✅ **Direct** — field tương ứng 1-1, migrate thẳng
- ⚠️ **Transform** — có thể migrate nhưng cần xử lý/convert
- ❌ **Lost** — WP có, BigBike không có field tương ứng, data sẽ mất
- 🔴 **Blocker** — BigBike bắt buộc (NOT NULL) nhưng WP không có nguồn data
- ❓ **Unknown** — chưa xác định được mapping

Bao gồm tối thiểu: title, slug, description, short description, SKU, price, sale price, stock, stock status, product type, categories, tags, brands, thumbnail, gallery images, variation images, ACF custom fields (từng field), Polylang translations, product attributes, weight, dimensions, reviews, status (publish/draft).

### 4.2 Order field mapping

Map WooCommerce order fields → BigBike Order entity. Đặc biệt kiểm tra:
- WC order statuses (pending/processing/on-hold/completed/cancelled/refunded/failed) → BigBike state machine
- Guest orders → BigBike xử lý thế nào
- Order meta fields tùy chỉnh → có equivalent không
- Refunds → BigBike có module hoàn tiền không

### 4.3 Customer/User mapping

Map WP user + usermeta → BigBike User/Address entities. Kiểm tra:
- Facebook social login → BigBike auth strategy
- Billing vs Shipping address → BigBike address model
- WP roles → BigBike roles/permissions

### 4.4 Media migration feasibility

- Tổng size uploads vs BigBike MinIO capacity (estimate)
- Image URL references trong `post_content` → cần tìm/replace
- Variation images → cần map sang BigBike ProductVariant image fields
- ACF image fields → kiểu data là attachment ID, cần resolve sang URL

### 4.5 Polylang multilingual

- BigBike có hỗ trợ đa ngôn ngữ không (kiểm tra từ code/docs)
- Nếu không: data dịch của WP sẽ xử lý thế nào (chỉ lấy 1 ngôn ngữ?)
- Nếu có: mapping strategy

### 4.6 Pods custom post types

- List tất cả Pods CPTs đang dùng → BigBike có module tương ứng không
- Data trong các CPT đó có cần migrate không

---

## Phase 5 — Schema Validation & Migration Decisions

> Mục đích: đối chiếu từng mapping với **schema thực tế của BigBike** (entity files + PostgreSQL), phát hiện mâu thuẫn, và hỏi user quyết định trước khi bất kỳ data nào được migrate. Không được tự suy diễn — mỗi điểm mơ hồ phải hỏi.

### Nguyên tắc xử lý

Phân loại từng field mapping vào 1 trong 4 nhóm:

| Nhóm | Định nghĩa | Hành động |
|---|---|---|
| **SAFE** | WP field → BigBike field: type compatible, không có constraint nào bị vi phạm | Ghi vào migration plan, tiếp tục |
| **TRANSFORM** | Migrate được nhưng cần convert (ví dụ: text→int, date format, enum rename) — logic convert rõ ràng, không cần hỏi | Ghi transform rule vào plan, tiếp tục |
| **DECISION** | Có nhiều cách xử lý hợp lý, không có đáp án đúng mặc định — **bắt buộc hỏi user** | In options, đợi user chọn, ghi quyết định |
| **BLOCKER** | Không thể migrate hợp lệ theo bất kỳ cách nào mà không sửa BigBike schema — **dừng và báo ngay** | Báo rõ impact, đề xuất hướng xử lý |

---

### 5.1 Validate từng nhóm data — phát hiện DECISION và BLOCKER

Với mỗi nhóm dưới đây, đọc schema BigBike (entity file + PostgreSQL), đối chiếu với data WP thực tế, rồi phân loại.

#### A. Products & Variants

Kiểm tra:
- BigBike `Product` entity: tất cả field `@NotNull` / `NOT NULL` trong DB → WP có source cho field đó không?
- BigBike `ProductVariant` (hoặc tên tương đương): field nào bắt buộc → variation WP có đủ không?
- WP product type `simple` / `variable` / `grouped` / `external` → BigBike phân biệt type như thế nào? Có field `type` trong entity không?
- WP `_stock_status` có giá trị `instock` / `outofstock` / `onbackorder` → BigBike dùng enum gì? Giá trị có khớp không?
- WP product có thể không có SKU (field rỗng) → BigBike `sku` có `@NotBlank` không? Nếu có: DECISION.
- ACF custom fields từng field một: BigBike có field tương ứng không? Có entity mở rộng không (ProductMeta, ProductAttribute, ProductSpec)?

#### B. Categories & Brands

Kiểm tra:
- WP category tree (nhiều cấp) → BigBike category có hỗ trợ nested/parent không? Nếu BigBike chỉ có 1 level: DECISION.
- WP có `product_brand` taxonomy → BigBike có entity `Brand` riêng không, hay brand chỉ là attribute? DECISION nếu khác.

#### C. Orders & Order Items

Kiểm tra từng WC order status → BigBike order state machine (đọc `STATE_MACHINES.md` và entity enum):
- `wc-pending` → ?
- `wc-processing` → ?
- `wc-on-hold` → ?
- `wc-completed` → ?
- `wc-cancelled` → ?
- `wc-refunded` → ?
- `wc-failed` → ?

Nếu không có mapping 1-1: DECISION cho từng status không map được.

Kiểm tra:
- WC order có `_customer_user = 0` (guest order) → BigBike Order có nullable `userId` không? Nếu NOT NULL: DECISION.
- WC order items lưu product snapshot (tên, giá tại thời điểm mua) → BigBike lưu snapshot hay chỉ FK?
- WC có `shop_order_refund` → BigBike có `Refund` entity không? Nếu không: DECISION (bỏ refund history / lưu vào notes).

#### D. Customers / Users

Kiểm tra:
- WP user `billing_first_name` + `billing_last_name` → BigBike `User` có `fullName` hay tách `firstName`/`lastName`?
- WP có `billing_address` + `shipping_address` riêng → BigBike `Address` entity: có `type` field (BILLING/SHIPPING) không, hay lưu riêng?
- WP user có `user_pass` (bcrypt WordPress format) → BigBike dùng auth provider nào (Spring Security? JWT?)? Password WP có compatible không?
- WP roles (`customer`, `subscriber`, `administrator`) → BigBike role enum là gì?

#### E. Media / Uploads

Kiểm tra:
- BigBike lưu image URL hay binary? MinIO URL pattern là gì?
- WP lưu attachment ID trong `_thumbnail_id`, `_product_image_gallery` → cần resolve sang URL trước khi migrate.
- WP có nhiều image size (thumbnail, medium, large, full) → BigBike dùng size nào? Hay upload original rồi resize?

#### F. Fields mà BigBike có nhưng WP không có nguồn

Quét tất cả `@NotNull` / NOT NULL column trong BigBike schema → list những field không có nguồn từ WP → BLOCKER hoặc DECISION (set default).

---

### 5.2 Hỏi user từng DECISION

**Với mỗi điểm DECISION tìm được ở bước 5.1, in ra block sau và đợi user nhập số trước khi tiếp tục:**

```
══════════════════════════════════════════════════════
DECISION [N/TỔNG]: [Tên vấn đề]
══════════════════════════════════════════════════════
Vấn đề   : [Mô tả rõ ràng — WP lưu gì, BigBike expect gì, tại sao mâu thuẫn]
Dữ liệu  : [Số lượng record bị ảnh hưởng, ví dụ cụ thể]
ERD/Class: [Tên entity, field, constraint liên quan trong BigBike]

Lựa chọn:
  1. [Mô tả option 1 + hệ quả]
  2. [Mô tả option 2 + hệ quả]
  3. [Mô tả option 3 + hệ quả]
  (nếu cần thêm option: tối đa 4)

> Chọn (1-N):
──────────────────────────────────────────────────────
```

Ghi lại: `DECISION [N]: [Tên] → Option [X]: [Mô tả option đã chọn]`

Không được bỏ qua bất kỳ DECISION nào, không được tự chọn thay user.

---

### 5.3 Ví dụ các DECISION thường gặp

Dưới đây là ví dụ về cách trình bày — thực tế hỏi dựa trên những gì tìm được trong schema BigBike thực tế, không phải mặc định hỏi hết các ví dụ này:

**Ví dụ 1 — SKU bắt buộc**
```
DECISION [1/8]: SKU bắt buộc trong BigBike nhưng 47 sản phẩm WP không có SKU
Lựa chọn:
  1. Tự sinh SKU theo pattern BB-{post_id} cho những sản phẩm thiếu
  2. Bỏ qua những sản phẩm không có SKU (không migrate)
  3. Set SKU = null nếu BigBike cho phép nullable (cần kiểm tra schema)
  4. Dừng migration, yêu cầu bổ sung SKU trong WP trước
```

**Ví dụ 2 — WC status không có trong BigBike**
```
DECISION [2/8]: 23 đơn hàng có status wc-on-hold, BigBike không có trạng thái này
Lựa chọn:
  1. Map sang PENDING (chưa xử lý)
  2. Map sang PROCESSING (đang xử lý)
  3. Bỏ qua các đơn on-hold, không migrate
  4. Map sang trạng thái tùy chỉnh — cần cho biết tên status trong BigBike
```

**Ví dụ 3 — ACF field không có mapping**
```
DECISION [3/8]: ACF field "size_guide_url" (156 sản phẩm) không có field tương ứng trong BigBike Product
Lựa chọn:
  1. Nối vào cuối product.description dưới dạng text
  2. Bỏ qua, không migrate field này
  3. Lưu vào ProductAttribute/ProductMeta nếu BigBike có bảng mở rộng
  4. Giữ nguyên quyết định này cho tất cả ACF field không có mapping
```

**Ví dụ 4 — Category nhiều cấp**
```
DECISION [4/8]: WP có category tree 3 cấp (e.g. Bảo hộ → Áo giáp → Áo giáp ngực)
                BigBike Category entity chỉ có field "parentId" — cần xác nhận hỗ trợ depth bao nhiêu
Lựa chọn:
  1. Migrate nguyên cây category (nếu BigBike hỗ trợ đệ quy)
  2. Chỉ migrate 2 cấp đầu, bỏ cấp 3 trở đi
  3. Flatten toàn bộ về 1 cấp (bỏ parent-child)
  4. Hỏi thêm — cho biết BigBike Category có hỗ trợ nested không
```

---

### 5.4 Xử lý BLOCKER

Với mỗi BLOCKER, **không hỏi option** — in ngay:

```
══════════════════════════════════════════════════════
⛔ BLOCKER [N]: [Tên vấn đề]
══════════════════════════════════════════════════════
Vấn đề : [Mô tả]
Impact : [X records không thể migrate]
Lý do  : [Constraint cụ thể trong BigBike schema]

Để giải quyết, cần một trong hai:
  A. Sửa BigBike schema (thêm/sửa field, bỏ constraint) → làm trước khi chạy migration
  B. [Hướng giải quyết thay thế nếu có]

Migration KHÔNG được tiếp tục cho nhóm data này cho đến khi BLOCKER được giải quyết.
══════════════════════════════════════════════════════
```

Sau khi in xong tất cả BLOCKER, hỏi user:
```
Có [N] BLOCKER cần giải quyết trước. Tiếp tục với phần data không bị block không? (YES/NO)
```

---

## Phase 6 — Output Report (sau khi Phase 5 hoàn thành)

Tạo thư mục nếu chưa có:
```bash
mkdir -p /root/myproject/bigbike-web-new/docs/audits
```

Lưu report vào `/root/myproject/bigbike-web-new/docs/audits/wp-migration-audit.md`.

Report phải có cấu trúc:

```
# WordPress → BigBike: Migration Readiness Audit
Ngày kiểm tra: [ngày hôm nay]
Người thực hiện: Claude Code

---

## TÓM TẮT EXECUTIVE

| Chỉ số | Số liệu |
|---|---|
| Tổng sản phẩm WP (tất cả status) | |
| Sản phẩm **ngừng bán** (loại khỏi migration) | |
| Sản phẩm **đang bán** (scope migration) | |
| Tổng variations (của sản phẩm đang bán) | |
| Tổng khách hàng | |
| Tổng đơn hàng | |
| Doanh thu tổng | |
| Tổng media | |
| Size uploads | |
| Ngôn ngữ | |

**Đánh giá tổng thể**: READY / NEEDS_WORK / BLOCKED
**Lý do**: [1-2 câu]

---

## 1. INVENTORY DỮ LIỆU WORDPRESS

### 1.1 Products
[Bảng số liệu]

### 1.2 Categories & Brands
[Bảng số liệu]

### 1.3 Khách hàng & Users
[Bảng số liệu]

### 1.4 Đơn hàng
[Bảng số liệu]

### 1.5 Media
[Bảng số liệu]

### 1.6 Polylang
[Bảng số liệu]

### 1.7 ACF custom fields
[List field groups + fields]

### 1.8 Pods CPTs
[List]

---

## 2. BIGBIKE SCHEMA SUMMARY

### 2.1 Entities
[List entity → table → fields chính]

### 2.2 BigBike DB hiện tại
[Tables đang có, số rows]

---

## 3. FIELD MAPPING ANALYSIS

### 3.1 Products
[Bảng đầy đủ: WP field | WP source | BigBike entity | BigBike field | Status | Ghi chú]

### 3.2 Orders
[Bảng tương tự]

### 3.3 Customers/Users
[Bảng tương tự]

---

## 4. GAPS & ISSUES

### 4.1 Data sẽ MẤT khi migrate (WP có, BigBike không có)
[List cụ thể — từng field, ước tính lượng data bị mất]

### 4.2 BLOCKER — BigBike bắt buộc nhưng WP không có nguồn
[List — đây là vấn đề nghiêm trọng nhất]

### 4.3 Cần TRANSFORM (migrate được nhưng phải xử lý)
[List + mô tả transform cần làm]

### 4.4 NEEDS_VERIFICATION — cần team quyết định
[List câu hỏi cụ thể cần xác nhận]

---

## 5. MIGRATION DECISIONS (từ Phase 5)

[Bảng tổng hợp tất cả quyết định đã được user xác nhận]

| # | Vấn đề | Option đã chọn | Records ảnh hưởng |
|---|---|---|---|
| 1 | [Tên decision] | [Option X: mô tả] | [N records] |
| ... | | | |

### Blockers chưa giải quyết
[List — nếu có, ghi rõ status]

---

## 5. RỦI RO & BLOCKERS

### 🔴 Blockers (không migrate được nếu chưa giải quyết)
[List — mỗi item: mô tả, impact, hướng giải quyết]

### 🟠 Rủi ro cao
[List]

### 🟡 Rủi ro trung bình
[List]

---

## 6. THỨ TỰ MIGRATION KHUYẾN NGHỊ

1. [Bước 1 — lý do]
2. [Bước 2]
...

---

## 7. ƯỚC TÍNH ĐỘ PHỨC TẠP

**Đánh giá**: Simple / Medium / Complex / Very Complex

**Lý do**:
- [Điểm 1]
- [Điểm 2]

**Ước tính thời gian viết migration script**: [X ngày/tuần]
```

---

## Phase 7 — Nginx Cutover (tùy chọn, yêu cầu xác nhận riêng)

> ⚠️ **DỪNG LẠI SAU PHASE 5.** Sau khi đã lưu report, hỏi user:
>
> ```
> Phase 5 hoàn thành. Report đã lưu tại /root/myproject/bigbike-web-new/docs/audits/wp-migration-audit.md
>
> Sẵn sàng thực hiện Nginx cutover (chuyển bigbike.vn từ WordPress sang BigBike)?
> - bigbike.vn      → Next.js  (localhost:3000)
> - api.bigbike.vn  → Spring Boot API (localhost:8080)
> - admin.bigbike.vn → Admin panel (localhost:4000)
>
> Hành động này KHÔNG tự rollback. WordPress vẫn còn trên VPS nhưng sẽ không được serve nữa.
> Gõ YES để tiếp tục, hoặc bất kỳ phím nào khác để dừng.
> ```
>
> Chỉ tiếp tục khi user gõ đúng `YES` (phân biệt hoa thường).

---

### 6.1 Đọc Nginx config hiện tại của bigbike.vn

```bash
# Tìm file config đang serve bigbike.vn
grep -rl "bigbike\.vn" /etc/nginx/sites-enabled/ /etc/nginx/sites-available/ /etc/nginx/conf.d/ 2>/dev/null

# Đọc toàn bộ config đó để lấy đường dẫn SSL cert
cat <file tìm được ở trên>
```

Ghi lại:
- `ssl_certificate` path (thường là `.crt` hoặc `.pem`)
- `ssl_certificate_key` path (thường là `.key`)
- Tên file config hiện tại (dùng ở bước backup)
- Nginx config directory đang dùng (`sites-enabled`, `conf.d`, hay khác)

> **Không được đọc hoặc động vào config của 4thitek.vn hay bất kỳ domain nào khác.**

---

### 6.2 Health check BigBike

**Tất cả 3 check dưới đây phải PASS. Nếu bất kỳ check nào FAIL → dừng lại, báo lỗi cho user, không tiếp tục.**

```bash
# Check 1: Docker stack
docker compose -f /root/myproject/bigbike-web-new/docker-compose.yaml ps --format table
# Expected: tất cả service đang Up

# Check 2: Next.js web
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
# Expected: 200 hoặc 3xx (không phải 000 hay 5xx)

# Check 3: Spring Boot API
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/actuator/health 2>/dev/null \
  || curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/api/health 2>/dev/null \
  || curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/ 2>/dev/null
# Expected: bất kỳ HTTP response (không phải 000)

# Check 4: Admin panel
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000
# Expected: 200 hoặc 3xx
```

---

### 6.3 Backup config hiện tại

```bash
# Backup file config cũ của bigbike.vn (KHÔNG xóa)
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CONFIG_FILE=<đường dẫn file config tìm được ở 6.1>
cp "$CONFIG_FILE" "${CONFIG_FILE}.backup_${TIMESTAMP}"
echo "Backed up to: ${CONFIG_FILE}.backup_${TIMESTAMP}"
```

---

### 6.4 Tạo Nginx config mới cho BigBike

Tạo file `/etc/nginx/sites-available/bigbike-new.conf` với nội dung sau (thay `SSL_CERT` và `SSL_KEY` bằng đường dẫn thực lấy từ bước 6.1):

```nginx
# ============================================================
# bigbike.vn → Next.js (port 3000)
# Tạo bởi migration script — ngày [NGÀY HÔM NAY]
# ============================================================

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name bigbike.vn www.bigbike.vn;
    return 301 https://bigbike.vn$request_uri;
}

# www → non-www redirect
server {
    listen 443 ssl http2;
    server_name www.bigbike.vn;
    ssl_certificate     SSL_CERT;
    ssl_certificate_key SSL_KEY;
    return 301 https://bigbike.vn$request_uri;
}

# Main site
server {
    listen 443 ssl http2;
    server_name bigbike.vn;

    ssl_certificate     SSL_CERT;
    ssl_certificate_key SSL_KEY;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    client_max_body_size 50M;

    # Next.js — bao gồm WebSocket support cho HMR / live features
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        'upgrade';
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }
}

# ============================================================
# api.bigbike.vn → Spring Boot API (port 8080)
# ============================================================

server {
    listen 80;
    server_name api.bigbike.vn;
    return 301 https://api.bigbike.vn$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.bigbike.vn;

    ssl_certificate     SSL_CERT;
    ssl_certificate_key SSL_KEY;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    client_max_body_size 100M;

    location / {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        proxy_connect_timeout 30s;
        proxy_send_timeout 120s;
    }
}

# ============================================================
# admin.bigbike.vn → Admin panel (port 4000)
# ============================================================

server {
    listen 80;
    server_name admin.bigbike.vn;
    return 301 https://admin.bigbike.vn$request_uri;
}

server {
    listen 443 ssl http2;
    server_name admin.bigbike.vn;

    ssl_certificate     SSL_CERT;
    ssl_certificate_key SSL_KEY;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    client_max_body_size 50M;

    location / {
        proxy_pass         http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        'upgrade';
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }
}
```

Sau đó enable config:

```bash
# Tạo symlink (chỉ nếu dùng sites-available/sites-enabled)
# Nếu dùng conf.d thì đặt file thẳng vào conf.d, không cần symlink
ln -sf /etc/nginx/sites-available/bigbike-new.conf /etc/nginx/sites-enabled/bigbike-new.conf
```

---

### 6.5 Disable config WordPress cũ

```bash
# Chỉ remove symlink (hoặc rename file) — KHÔNG xóa file gốc
# Nếu dùng sites-enabled:
rm /etc/nginx/sites-enabled/<tên file config WP cũ>

# Nếu dùng conf.d: rename để nginx không load
mv /etc/nginx/conf.d/<file WP> /etc/nginx/conf.d/<file WP>.disabled
```

---

### 6.6 Test và reload

```bash
# Test config — BẮT BUỘC pass trước khi reload
nginx -t

# Nếu nginx -t OK → reload (graceful, không drop connection)
nginx -s reload

echo "Nginx reloaded successfully"
```

**Nếu `nginx -t` FAIL**: in lỗi, restore backup ngay, không reload:

```bash
# Rollback nếu test fail
cp "${CONFIG_FILE}.backup_${TIMESTAMP}" "$CONFIG_FILE"
# Re-enable WP config nếu đã remove
nginx -s reload
echo "ROLLBACK hoàn thành — WordPress vẫn đang serve"
```

---

### 6.7 Verify sau cutover

```bash
# Kiểm tra response từ domain (chạy từ VPS)
echo "--- bigbike.vn ---"
curl -s -o /dev/null -w "HTTP %{http_code} | Server: %{header_server}\n" \
  -H "Host: bigbike.vn" https://bigbike.vn/ --resolve bigbike.vn:443:127.0.0.1 -k 2>/dev/null \
  || curl -s -o /dev/null -w "HTTP %{http_code}\n" https://bigbike.vn/

echo "--- api.bigbike.vn ---"
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://api.bigbike.vn/ 2>/dev/null || echo "DNS chưa propagate (bình thường nếu subdomain mới)"

echo "--- admin.bigbike.vn ---"
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://admin.bigbike.vn/ 2>/dev/null || echo "DNS chưa propagate (bình thường nếu subdomain mới)"

# Nginx process
nginx -t && echo "Config hiện tại: OK"
```

In kết quả cuối cùng:
```
=== NGINX CUTOVER HOÀN THÀNH ===
bigbike.vn       → Next.js (localhost:3000)
api.bigbike.vn   → Spring Boot (localhost:8080)
admin.bigbike.vn → Admin panel (localhost:4000)

Backup WP config: ${CONFIG_FILE}.backup_${TIMESTAMP}
WordPress files:  /var/www/bigbike/files/ (còn nguyên, không bị xóa)

Lưu ý: Nếu api.bigbike.vn và admin.bigbike.vn trả về lỗi DNS,
đó là bình thường nếu subdomain chưa được trỏ về IP VPS.
Cần thêm A record trên DNS manager: admin.bigbike.vn → [IP VPS]
                                     api.bigbike.vn   → [IP VPS]
```

---

## Lưu ý khi thực hiện

- **Phase 1–4**: chỉ đọc — không sửa, không insert, không xóa bất kỳ thứ gì.
- **Phase 5**: interactive — đọc schema BigBike thực tế, hỏi từng DECISION, không tự chọn thay user.
- **Phase 6**: xuất report — ghi lại tất cả kết quả phân tích + quyết định đã xác nhận.
- **Phase 7**: destructive (Nginx) — chỉ chạy khi user xác nhận `YES`. Luôn backup trước.
- Khi query DB trả về lỗi (bảng không tồn tại): ghi `KHÔNG TỒN TẠI` vào report, tiếp tục.
- **Không bao giờ tự suy diễn** khi mapping không rõ ràng — phân loại là DECISION và hỏi.
- Dùng data thật — không mock, không ước tính nếu có thể query được.
- **Tuyệt đối không động vào** config của `4thitek.vn` và các domain không liên quan.
- Sau Phase 6: in `Report đã lưu tại: /root/myproject/bigbike-web-new/docs/audits/wp-migration-audit.md`
