# Product Data Completeness Audit

**Date:** 2026-05-24  
**Auditor:** Senior Full-stack/Backend Engineer (automated via script)  
**DB Container:** `bigbike-postgres` (PostgreSQL 16)  
**DB Name:** `bigbike`  
**Backup:** `backups/product-data-audit/20260524-133806-before-fill.sql` (47.6 MB)

---

## 1. Scope

Toàn bộ dữ liệu sản phẩm trong DB dev (WordPress/WooCommerce import), bao gồm 18 bảng liên quan.

**Context:** ~1231 sản phẩm được import từ WP/WooCommerce. Dev seed migrations (V1009, V1010) chỉ publish một số sản phẩm cụ thể; 1211 sản phẩm còn ở DRAFT.

---

## 2. Tables Checked

| Nhóm | Bảng |
|------|------|
| Core | `products`, `brands`, `categories` |
| Variants | `product_variants`, `product_variant_options` |
| Media | `product_gallery_images`, `product_variant_gallery_images`, `product_videos` |
| Content | `product_specifications`, `product_faqs` |
| Relations | `product_tags`, `product_tag_map`, `product_related_product_map` |
| Inventory | `stock_movements`, `product_serials` |
| Attributes | `attributes`, `attribute_values` |
| Reviews | `reviews` |
| Storage | `media` |

---

## 3. Validation Rules

| Field | Rule | Action |
|-------|------|--------|
| `seo_canonical_url` | Phải có trên mọi sản phẩm/brand/category có slug | Fill |
| `seo_title` | Phải có trên mọi sản phẩm/brand/category có name | Fill |
| `seo_description` | Phải có trên mọi sản phẩm có name | Fill |
| `image_alt` | Phải có khi `image_url` tồn tại | Fill |
| `sku` | Nên có, unique, không null | Fill |
| `short_description` | Không thể infer an toàn | Skip — human review |
| `brand_id` | Không thể gán tự động (risk false positive) | Skip — human review |
| `image_url` | Nếu không có image_id/url → không có nguồn | Skip — human review |
| `retail_price = 0` | Không bịa giá | Skip — human review |
| Serial/inventory | Tuyệt đối không tạo giả | Skip |

---

## 4. Missing Data Summary — BEFORE Fill

### products (1231 total)

| Field | Missing Before | Note |
|-------|---------------|------|
| `publish_status = DRAFT` | 1211 | Không tự động publish |
| `seo_canonical_url` | **1231** | Tất cả |
| `short_description` | 1230 | Không fill |
| `seo_title` | 479 | |
| `seo_description` | 357 | |
| `brand_id` | 388 | Không fill |
| `sku` | 290 | |
| `image_url` (không có cả image_id) | 212 | Không fill |
| `image_alt` (có image_url nhưng không có alt) | 1 | |
| `retail_price <= 0` | 73 | Không fill |

### product_variants (4040 total)

| Field | Missing Before |
|-------|---------------|
| `sku` | 2838 |
| `image_url` (không có nguồn) | 4040 |
| `quantity_on_hand = 0` | 4040 |

### brands (46 total)

| Field | Missing |
|-------|---------|
| `seo_title` | 46 (tất cả) |
| `seo_canonical_url` | 46 (tất cả) |

### categories (45 total)

| Field | Missing |
|-------|---------|
| `seo_title` | 45 (tất cả) |
| `seo_canonical_url` | 45 (tất cả) |

### product_gallery_images (2567 total)

| Field | Missing |
|-------|---------|
| `image_alt` | 3 |

---

## 5. Fill Strategy

Chỉ fill những field có thể suy ra **chắc chắn và an toàn**. Không fill nội dung cần product knowledge.

| Field | Strategy |
|-------|----------|
| `products.seo_canonical_url` | `https://bigbike.vn/product/{slug}` |
| `products.seo_title` | `{name} | BigBike Vietnam` (max 255 chars) |
| `products.seo_description` | `short_description` nếu có, hoặc `{name} - Mua sắm tại BigBike Vietnam...` (max 160 chars) |
| `products.image_alt` | product `name` |
| `products.sku` | `BB-{CAT_CODE_5}-{PROD_ID_6_DIGITS}` (unique verified) |
| `product_variants.sku` | `{product_sku}-{VARIANT_ID_6_DIGITS}` (unique verified, variant ID đảm bảo uniqueness) |
| `product_gallery_images.image_alt` | product `name` |
| `brands.seo_title` | `{name} | BigBike Vietnam` |
| `brands.seo_canonical_url` | `https://bigbike.vn/brands/{slug}` |
| `categories.seo_title` | `{name} | BigBike Vietnam` |
| `categories.seo_canonical_url` | `https://bigbike.vn/danh-muc-san-pham/{slug}` |

**SKU format examples:**
- Product: `BB-CHUAP-041181`, `BB-NONBA-041070`, `BB-GIAYB-035865`
- Variant: `AP-PARIS-010618`, `BB-GIAYB-039552-039721`

---

## 6. Records Updated

| Table | Field | Rows Updated |
|-------|-------|-------------|
| `products` | `seo_canonical_url` | **1231** |
| `products` | `seo_title` | **478** |
| `products` | `seo_description` | **356** |
| `products` | `image_alt` | **1** |
| `products` | `sku` | **290** |
| `product_variants` | `sku` | **2838** |
| `product_gallery_images` | `image_alt` | **3** |
| `brands` | `seo_title` | **46** |
| `brands` | `seo_canonical_url` | **46** |
| `categories` | `seo_title` | **45** |
| `categories` | `seo_canonical_url` | **45** |
| **TOTAL** | | **~5379 rows** |

---

## 7. Records Skipped and Reason

### Products (still missing after fill)

| Field | Remaining | Reason |
|-------|-----------|--------|
| `short_description` | 1230 | Không thể infer nội dung an toàn — cần editorial review |
| `brand_id` | 388 | Auto-assign có nguy cơ false positive — cần operator quyết định |
| `image_url` | 212 | Không có image_id lẫn image_url trong source WP data |
| `retail_price ≤ 0` | 73 | Không bịa giá — cần operator nhập giá thật |
| `seo_title` | 1 | Product không có name (dữ liệu gốc thiếu) |
| `seo_description` | 1 | Product không có name (dữ liệu gốc thiếu) |

### Variants (still missing after fill)

| Field | Remaining | Reason |
|-------|-----------|--------|
| `image_url` | 4040 | Không có image_id trong WP variant data |
| `quantity_on_hand` | 4040 (= 0) | Không bịa tồn kho — cần nhập kho thật |

### Pre-existing data issues (NOT introduced by this fill)

| Issue | Count | Details |
|-------|-------|---------|
| Duplicate variant SKUs (legacy WP) | 12 pairs | JK63W-m, LS2METROFF324-xl/xxl/l, JK42BG-m/l/xl, TrumxeBeon-xl/xxl, JK63G-m, FF325G-xxl, 3151017-46-3151017-1275 |
| stock_state = OUT_OF_STOCK | 4034 variants | Tồn kho thật chưa được nhập |

---

## 8. Missing Data Summary — AFTER Fill

### products

| Field | Missing After |
|-------|-------------|
| `seo_canonical_url` | **0** ✓ |
| `sku` | **0** ✓ |
| `seo_title` | 1 (product không có name) |
| `seo_description` | 1 (product không có name) |
| `image_alt` (có image_url) | 0 ✓ |
| `brand_id` | 388 (human review) |
| `image_url` (không nguồn) | 212 (không thể fill) |
| `short_description` | 1230 (editorial) |
| `retail_price ≤ 0` | 73 (human review) |

### product_variants

| Field | Missing After |
|-------|-------------|
| `sku` | **0** ✓ |
| `image_url` | 4040 (không nguồn) |

### brands

| Field | Missing After |
|-------|-------------|
| `seo_title` | **0** ✓ |
| `seo_canonical_url` | **0** ✓ |

### categories

| Field | Missing After |
|-------|-------------|
| `seo_title` | **0** ✓ |
| `seo_canonical_url` | **0** ✓ |

### product_gallery_images

| Field | Missing After |
|-------|-------------|
| `image_alt` | **0** ✓ |

---

## 9. Publish Readiness

- **943 DRAFT sản phẩm đủ điều kiện publish** (có name, slug, image_url, retail_price > 0, category_id)
- **268 DRAFT sản phẩm chưa đủ** (thiếu image hoặc price)
- **20 sản phẩm đang PUBLISHED** (không thay đổi)

Để publish hàng loạt 943 sản phẩm, cần operator xác nhận và chạy riêng.

---

## 10. Risk Notes

| Risk | Mức độ | Xử lý |
|------|--------|-------|
| 12 variant SKUs trùng (legacy WP data) | MEDIUM | Không phải do script này — cần fix riêng theo từng WP product group |
| 212 products không có ảnh | HIGH | Sẽ hiển thị fallback image trên web — cần upload ảnh thật |
| 388 products thiếu brand | LOW | Admin UI vẫn load được, chỉ thiếu brand filter/badge |
| 73 products giá = 0 | HIGH | Không nên publish — sẽ hiện miễn phí trên web |
| 4040 variants tồn kho = 0 | MEDIUM | stock_state = OUT_OF_STOCK, không gây lỗi UI nhưng không bán được |
| 1230 products thiếu short_description | MEDIUM | PDP load được nhưng SEO và card description bị fallback |

---

## 11. Rollback Command

```powershell
# Từ thư mục project root (e:\Project\bigbike):
Get-Content "backups\product-data-audit\20260524-133806-before-fill.sql" |
  docker exec -i bigbike-postgres psql -U bigbike -d bigbike
```

---

## 12. Scripts Created

| File | Mô tả |
|------|-------|
| `scripts/product-audit/run.ps1` | Master script: backup → audit → [fill] → verify |
| `scripts/product-audit/audit.sql` | Read-only audit queries |
| `scripts/product-audit/fill-dry-run.sql` | Preview changes (SELECT only) |
| `scripts/product-audit/fill-apply.sql` | Transaction-wrapped UPDATEs |
| `scripts/product-audit/verify.sql` | Post-fill verification |
| `scripts/product-audit/rollback.md` | Rollback instructions |

Để chạy lại toàn bộ quy trình (sau khi restore backup nếu cần):

```powershell
cd e:\Project\bigbike\scripts\product-audit
.\run.ps1 -Mode dry-run   # preview
.\run.ps1 -Mode apply     # apply
```

---

## 13. Recommended Next Steps (Human Decision Required)

Theo thứ tự ưu tiên:

1. **Fix 73 products có giá = 0** — không publish trước khi có giá thật
2. **Upload ảnh cho 212 products thiếu ảnh** — không nên publish without image
3. **Fix 12 duplicate variant SKUs** — legacy WP data, cần deduplicate thủ công
4. **Viết short_description cho 943 products publish-ready** — cải thiện SEO đáng kể
5. **Assign brand cho 388 products** — cải thiện filter/browse experience
6. **Nhập tồn kho thật vào product_variants** — hiện tại tất cả = 0
7. **Quyết định publish 943 DRAFT products đủ điều kiện** — sau khi xử lý các vấn đề trên
