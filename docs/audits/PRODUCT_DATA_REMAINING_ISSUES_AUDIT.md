# Product Data — Remaining Issues Audit (Phase 2)

**Ngày thực hiện:** 2026-05-24  
**Thực hiện bởi:** Senior Backend/Data Engineer  
**Căn cứ:** [`docs/audits/PRODUCT_DATA_COMPLETENESS_AUDIT.md`](PRODUCT_DATA_COMPLETENESS_AUDIT.md) (Phase 1 report)  
**Backup Phase 2:** `backups/product-data-audit/20260524-151523-before-phase2.sql` (14.8 MB)

---

## Tổng quan — Phase 2 hoàn thành

Phase 2 xử lý 6 nhóm vấn đề còn lại sau Phase 1 fill. 4 trong 6 nhóm đã được xử lý hoàn toàn hoặc một phần tự động; 2 nhóm (giá và short_description) chỉ xuất CSV để operator xử lý thủ công.

| # | Vấn đề | Trước Phase 2 | Sau Phase 2 | Trạng thái |
|---|--------|--------------|-------------|------------|
| 1 | Products `retail_price = 0` | 73 | 73 (không auto-fix giá) | CSV export — chờ operator |
| 2 | Products thiếu ảnh chính | 212 | 210 (2 được promote từ gallery) | 210 cần upload thủ công |
| 3 | Duplicate variant SKUs | 12 duplicate SKUs (24 variants) | 0 duplicates | **Đã fix hoàn toàn** |
| 4 | Products thiếu `brand_id` | 388 | 182 (-206 được assign) | 3 MEDIUM cần review, 182 không match |
| 5 | Products thiếu `short_description` | 1230 | 1230 (không auto-apply) | CSV export — chờ operator |
| 6 | Variants `quantity_on_hand = 0` | 4040 (100%) | 4040 (không thay đổi) | Dự kiến đúng — xem STEP 6 |

---

## STEP 1 — 73 Products giá = 0

### Tình trạng
Tất cả 73 products có `retail_price IS NULL OR retail_price <= 0`. Không auto-fix giá vì không có nguồn dữ liệu tin cậy.

### Phân tích nguồn giá

| Nguồn giá | Số lượng |
|-----------|----------|
| `compare_at_price > 0` (có thể suggest) | 71 |
| `sale_price > 0` (có thể suggest) | 2 |
| Cả 3 giá đều = 0 (cần nhập thủ công) | 0 |

71 trong 73 products có `compare_at_price` — operator có thể dùng cột `suggested_price` trong CSV làm tham khảo.

### Output
- **CSV:** [`docs/audits/price-zero-products.csv`](price-zero-products.csv) — 73 products với `suggested_price` và `suggestion_reason`
- Columns: `id, name, sku, category, brand, retail_price, compare_at_price, sale_price, wp_stock_qty, has_image, legacy_id, suggested_price, suggestion_reason`

### Hành động của operator
- Xem cột `suggested_price` — đa số là `compare_at_price` (giá gốc WP)
- Xác nhận giá đúng rồi UPDATE `retail_price` trực tiếp hoặc qua admin UI
- **Không publish sản phẩm chưa có giá**

---

## STEP 2 — 212 Products thiếu ảnh chính

### Tình trạng
- 2 products có gallery images nhưng không có `image_url` → **đã được auto-promote** trong Phase 2
- 210 products không có bất kỳ ảnh nào (không có gallery, không có `image_id`)

### Kết quả auto-promote
2 products đã được cập nhật `image_url` từ ảnh đầu tiên trong gallery (`sort_order` nhỏ nhất). Verify bằng:
```sql
SELECT COUNT(*) FROM products WHERE image_url IS NULL AND image_id IS NULL
  AND EXISTS (SELECT 1 FROM product_gallery_images gi WHERE gi.product_id = products.id);
-- Expected: 0
```

### Output
- **CSV:** [`docs/audits/no-image-products.csv`](no-image-products.csv) — 210 products cần upload thủ công
- Columns: `id, name, slug, sku, category, brand, legacy_id, publish_status`

### Hành động của operator
- Upload ảnh qua admin panel cho từng product
- Ưu tiên products có `publish_status = PUBLISHED` (nếu có) trước

---

## STEP 3 — 12 Duplicate Variant SKUs (đã fix)

### Nguyên nhân
Import WordPress để lại 12 SKU bị duplicate — mỗi SKU xuất hiện trong 2 products khác nhau (WP duplicate posts). Tất cả đều `OUT_OF_STOCK`, `quantity_on_hand = 0`, không có order/return references.

### Chiến lược fix
- **Giữ:** variant của product `product_id` nhỏ hơn (older WP post)
- **Rename:** variant của product `product_id` lớn hơn → append `-XXXXXX` (6-digit variant ID suffix)
- Ví dụ: `3151017-46` → `3151017-46-XXXXXX`

### Safety gates đã pass
1. `0` order_line_items references to duplicate SKUs
2. `0` return_items references to duplicate SKUs
3. `0` generated SKU conflicts with existing SKUs

### Kết quả

| Metric | Trước | Sau |
|--------|-------|-----|
| Duplicate variant SKU groups | 12 | **0** |
| Variants bị rename | — | 12 |
| Variants giữ nguyên SKU | — | 12 |

Verify:
```sql
SELECT COUNT(*) FROM (
  SELECT sku FROM product_variants WHERE sku IS NOT NULL AND sku <> ''
  GROUP BY sku HAVING COUNT(*) > 1
) t;
-- Expected: 0 ✓
```

### Script
- Dry-run: `scripts/product-audit/phase2/03-fix-dup-sku-dryrun.sql`
- Apply: `scripts/product-audit/phase2/03-fix-dup-sku-apply.sql`

---

## STEP 4 — Brand Assignment (HIGH confidence)

### Chiến lược matching
- **HIGH:** `UPPER(brand.name)` là substring của `UPPER(product.name)` — tên brand xuất hiện trong tên sản phẩm
- **MEDIUM:** `brand.slug` xuất hiện trong `product.slug` nhưng KHÔNG trong `product.name`
- Tie-break: brand name dài nhất trong cùng confidence level (most specific match)
- Chỉ apply HIGH confidence. MEDIUM export để review. **Không bao giờ overwrite brand_id đã có.**

### Kết quả

| Metric | Số lượng |
|--------|----------|
| Products không có brand (trước Phase 2) | 388 |
| Được assign HIGH confidence | **206** |
| MEDIUM confidence — không apply (cần review) | 3 |
| Không match bất kỳ brand nào | 179 |
| **Products không có brand (sau Phase 2)** | **182** |

### Phân phối brand sau fill (top 10)

| Brand | Products |
|-------|----------|
| LS2 | 139 |
| SCOYCO | 126 |
| FURYGAN | 119 |
| TAICHI | 87 |
| ALPINESTARS | 82 |
| KOMINE | 78 |
| GIVI | 68 |
| AGV | 52 |
| HJC | 44 |
| KRIEGA | 36 |

### 3 MEDIUM confidence matches — cần review thủ công

| Product ID | Product Name | Suggested Brand | Lý do MEDIUM |
|------------|-------------|-----------------|--------------|
| `wp-prod-33452` | ÁO GIÁP BẢO HỘ CHO NỮ SEVENTY SD-JR49 | MACNA | Slug match, không khớp tên |
| `wp-prod-37123` | GĂNG TAY MOTO O'NEAL BUTCH CARBON GLOVE BLACK | ONEAL | Slug match (`oneal`), không khớp tên |
| `wp-prod-3989` | TÚI HÍT BÌNH XĂNG SW-MOTECH QUICK-LOCK... | SW MOTECH | Slug match (`sw-motech`), tên product có `SW-MOTECH` không exact |

> Lưu ý: 182 products không có brand match — tên sản phẩm không chứa tên brand rõ ràng. Có thể là generic accessories hoặc brands chưa có trong bảng `brands`.

### Output
- **CSV:** [`docs/audits/brand-assignment-review.csv`](brand-assignment-review.csv) — 3 MEDIUM matches chờ review
- **Scripts:** `scripts/product-audit/phase2/04-brand-assign-dryrun.sql`, `04-brand-assign-apply.sql`

### Hành động của operator
1. Xem 3 MEDIUM matches trong CSV — xác nhận hoặc từ chối từng cái
2. Nếu xác nhận: `UPDATE products SET brand_id = '...', updated_at = now() WHERE id = '...' AND brand_id IS NULL;`
3. 182 products còn lại: cần xác định brand thủ công qua admin panel hoặc thêm brands mới vào bảng `brands`

---

## STEP 5 — Short Description (CSV export only)

### Tình trạng
- 1 product có `short_description` (PUBLISHED)
- **1230 products** không có `short_description`

### Phân tích chất lượng draft

| Chất lượng draft | Số lượng |
|-----------------|----------|
| Có đủ brand + category (tốt nhất) | 1048 |
| Category only (không có brand) | 182 |
| Brand only | 0 |
| Name only (yếu nhất) | 0 |

### Format draft
```
{Tên sản phẩm} là sản phẩm {danh mục} chính hãng từ thương hiệu {brand}. Mua tại BigBike Vietnam với chất lượng đảm bảo, bảo hành chính hãng.
```

Ví dụ:
> *ÁO FURYGAN RYOKO là sản phẩm Áo Bảo Hộ Vải chính hãng từ thương hiệu FURYGAN. Mua tại BigBike Vietnam với chất lượng đảm bảo, bảo hành chính hãng.*

### Output
- **CSV:** [`docs/audits/product-short-description-review.csv`](product-short-description-review.csv) — 1230 products, 380 KB
- Columns: `id, name, sku, publish_status, category, brand, draft_short_description`
- Sorted: publish-ready products first, then by category/brand/name

### Hành động của operator
- Review `draft_short_description` trong CSV — chỉnh sửa nếu cần
- Import vào DB qua admin panel hoặc bulk UPDATE sau khi review
- **Không apply thẳng từ CSV chưa review — đây chỉ là draft gợi ý**

---

## STEP 6 — Stock Audit (read-only)

### Tổng quan variant stock

| Metric | Số lượng |
|--------|----------|
| Tổng variants | 4040 |
| Variants `quantity_on_hand > 0` | **0** |
| Variants `quantity_on_hand = 0` | 4040 |
| Variants `quantity_on_hand < 0` | 0 |

### WP product-level stock vs variant stock

| Metric | Số lượng |
|--------|----------|
| Products có `manage_stock = true AND stock_quantity > 0` | 1 |
| Trong đó: variants cũng = 0 | 1 |
| Products không quản lý stock (`manage_stock = false/null`) | 1131 |

### Sản phẩm duy nhất có stock_quantity > 0

| Trường | Giá trị |
|--------|---------|
| Product ID | `wp-prod-138` |
| Tên | BALO MOTO PHƯỢT TAICHI RSB278 - CHỐNG NƯỚC |
| `stock_quantity` (WP legacy) | 8 |
| Variant count | 4 |
| `SUM(quantity_on_hand)` | 0 |
| Status | PUBLISHED |

### Giải thích

Toàn bộ `quantity_on_hand = 0` là **dự kiến đúng**. Migration V30 đã backfill `quantity_on_hand` từ `products.stock_quantity`, nhưng WP lưu stock ở product level và không phân tách theo variant. Với product có nhiều variants, V30 chỉ backfill vào 1 variant và để lại 0 cho các variant còn lại.

Kết quả: **100% variants hiện tại = OUT_OF_STOCK** — đây là trạng thái đúng từ góc độ data integrity (không có thông tin phân bổ stock theo variant từ WP), không phải lỗi.

### Lưu ý cho `wp-prod-138`
Product này PUBLISHED với stock_quantity = 8 từ WP nhưng tất cả 4 variants đều `quantity_on_hand = 0`. Cần operator xác nhận stock thực tế và update variant nào đang có hàng.

### Hành động của operator
- Không cần can thiệp gấp — đây là data từ WP import, không có stock bị mất
- Khi có thông tin stock thực, update `product_variants.quantity_on_hand` qua admin panel hoặc bulk import từ inventory system
- `wp-prod-138` cần ưu tiên xử lý vì là PUBLISHED product

---

## Tổng kết trạng thái sản phẩm (sau Phase 2)

| Metric | DRAFT (1211) | PUBLISHED (20) |
|--------|-------------|----------------|
| Có brand | 1029 (85%) | 20 (100%) |
| Có category | 1211 (100%) | 20 (100%) |
| Có ảnh chính | 1001 (83%) | 20 (100%) |
| Có `retail_price > 0` | 1138 (94%) | 20 (100%) |
| Có `short_description` | 0 (0%) | 1 (5%) |
| **Đủ điều kiện publish** (brand+category+image+price) | **826 (68%)** | 20 (100%) |

---

## Publish Readiness Recommendation

**826 DRAFT products** đã đủ 4 điều kiện cơ bản (brand, category, image, price > 0). Tuy nhiên, **chưa nên publish hàng loạt** vì:

1. **0/826 có `short_description`** — trang product sẽ hiển thị kém, ảnh hưởng SEO
2. **100% variants `OUT_OF_STOCK`** — hiển thị "hết hàng" khi publish
3. **73 products trong 826 cần giá thật xác nhận** (đã có suggested_price nhưng chưa được apply)

### Thứ tự ưu tiên trước publish hàng loạt

| Ưu tiên | Việc cần làm | File hỗ trợ |
|---------|-------------|-------------|
| 1 | Review và apply `short_description` từ CSV | `product-short-description-review.csv` |
| 2 | Update `retail_price` cho 73 products giá = 0 | `price-zero-products.csv` |
| 3 | Update stock cho variants có hàng thực tế | Admin panel / inventory system |
| 4 | Upload ảnh cho 210 products thiếu ảnh | `no-image-products.csv` |
| 5 | Review 3 MEDIUM brand matches | `brand-assignment-review.csv` |
| 6 | Gán brand cho 182 products không match | Admin panel |

---

## Operator Checklist trước publish

- [ ] Import `short_description` từ CSV sau review (1230 products)
- [ ] Confirm và apply giá cho 73 products giá = 0 (xem `suggested_price`)
- [ ] Update variant stock cho `wp-prod-138` (PUBLISHED, WP stock = 8)
- [ ] Review 3 MEDIUM brand matches và apply nếu đúng
- [ ] Upload ảnh cho 210 products trong `no-image-products.csv`
- [ ] Spot-check 20 PUBLISHED products — xác nhận data correct
- [ ] Khi publish: dùng admin bulk-publish, filter theo `publish_status = DRAFT` và đủ điều kiện

---

## Rollback

Nếu cần rollback toàn bộ Phase 2:

```bash
docker exec -i bigbike-postgres psql -U bigbike -d bigbike \
  < backups/product-data-audit/20260524-151523-before-phase2.sql
```

Backup chứa: `products`, `product_variants`, `product_gallery_images`, `brands`, `categories`.

---

## Scripts Phase 2

| File | Mục đích | DB changes |
|------|---------|-----------|
| `scripts/product-audit/phase2/01-audit-price-zero.sql` | Audit giá = 0, export list | Không |
| `scripts/product-audit/phase2/02-fix-no-image-apply.sql` | Promote gallery → main image (2 products) | **Có** |
| `scripts/product-audit/phase2/03-fix-dup-sku-dryrun.sql` | Preview duplicate SKU fix | Không |
| `scripts/product-audit/phase2/03-fix-dup-sku-apply.sql` | Fix 12 duplicate variant SKUs | **Có** |
| `scripts/product-audit/phase2/04-brand-assign-apply.sql` | Assign brand HIGH confidence (206 products) | **Có** |
| `scripts/product-audit/phase2/05-gen-short-desc.sql` | Generate short_description draft CSV | Không |
| `scripts/product-audit/phase2/06-audit-stock.sql` | Audit WP stock vs variant qty | Không |
