# Publish Readiness Report (Phase 3)

**Ngày thực hiện:** 2026-05-24  
**Thực hiện bởi:** Senior Backend/Data Engineer  
**Căn cứ:** Phase 1 + Phase 2 data cleanup đã hoàn thành  
**Script audit:** `scripts/product-audit/publish-readiness-audit.sql`

---

## Gate đã implement

Backend giờ enforce 9 hard gates khi publish (`PATCH /api/v1/admin/products/{id}/publish`). Product thiếu bất kỳ gate nào sẽ nhận HTTP **422 `PRODUCT_NOT_READY_TO_PUBLISH`** với chi tiết từng field.

| # | Gate | Backend check | Admin UI |
|---|------|--------------|----------|
| 1 | `name` not blank | ✅ | ✅ required |
| 2 | `category_id` not null | ✅ | ✅ required (mới) |
| 3 | `brand_id` not null | ✅ | ✅ required (mới) |
| 4 | `image_url` hoặc `image_id` not null | ✅ | ✅ required (upgraded) |
| 5 | `retail_price > 0` | ✅ | ✅ required |
| 6 | `seo_title` not blank | ✅ | ✅ required (mới) |
| 7 | `seo_description` not blank | ✅ | ✅ required (mới) |
| 8 | `seo_canonical_url` not blank | ✅ | ✅ required (mới) |
| 9 | `short_description` not blank | ✅ | ✅ required (upgraded) |

**Stock (all variants OUT_OF_STOCK):** Không phải hard gate — web đã hiển thị "Hết hàng" và disable add-to-cart đúng. Chỉ là warning trong admin UI.

---

## Tổng quan kết quả audit

**Tổng sản phẩm: 1231** (1211 DRAFT + 20 PUBLISHED)

| Bucket | Số lượng | % |
|--------|----------|---|
| `publish_ready_strict` (pass tất cả 9 gates) | **1** | 0.1% |
| `ready_except_short_desc` (chỉ thiếu short_description) | **845** | 68.6% |
| `multiple_issues` (thiếu short_description + ≥1 gate khác) | **385** | 31.3% |

> **Kết quả quan trọng:** 0 DRAFT products hiện đủ điều kiện publish. 1 PUBLISHED product đã đủ điều kiện (là sản phẩm đã publish trước, không bị ảnh hưởng bởi gate mới).

---

## Chi tiết từng gate

| Gate | Số products failing | % failing |
|------|--------------------:|----------:|
| `short_description` | **1230** | 99.9% |
| `image` | 210 | 17.1% |
| `brand` | 182 | 14.8% |
| `retail_price` | 73 | 5.9% |
| `seo_title` | 1 | 0.1% |
| `name` | 1 | 0.1% |
| `seo_description` | 1 | 0.1% |
| `seo_canonical_url` | 0 | 0.0% |
| `category_id` | 0 | 0.0% |

**Phân tích:** `short_description` là gate duy nhất fail 99.9% sản phẩm — đây là bottleneck chính. SEO fields (title, desc, canonical) và category đều đã được fill từ Phase 1, gần như không có vấn đề.

---

## Phân tích nhóm `multiple_issues` (385 products)

Tất cả 385 products trong nhóm này đều thiếu `short_description` (100%) CỘNG THÊM ít nhất 1 gate khác:

| Số gate thêm bị fail | Products | Missing brand | Missing image | Missing price |
|----------------------|----------|--------------|--------------|--------------|
| +1 gate | 312 | 119 | 140 | 53 |
| +2 gates | 66 | 56 | 63 | 13 |
| +3 gates (brand+image+price+short_desc) | 7 | 7 | 7 | 7 |

---

## Lưu ý đặc biệt: `wp-prod-35864`

Product ID `wp-prod-35864` có **name = empty string** và `seo_title` / `seo_description` là NULL. Đây là WP import artifact bị lỗi dữ liệu. Cần operator kiểm tra và nhập thủ công qua admin panel trước khi publish.

---

## Operator Action Plan — Thứ tự ưu tiên

| Ưu tiên | Việc cần làm | Sản phẩm bị ảnh hưởng | File hỗ trợ |
|---------|-------------|----------------------|-------------|
| **1** | Nhập `short_description` | **1230** | `product-short-description-review.csv` |
| **2** | Gán `brand_id` | 182 | `brand-assignment-review.csv` |
| **3** | Upload ảnh chính | 210 | `no-image-products.csv` |
| **4** | Nhập `retail_price` | 73 | `price-zero-products.csv` |
| **5** | Fix `wp-prod-35864` (name rỗng) | 1 | Admin panel |

**Sau khi hoàn thành ưu tiên 1:** 845 products có thể publish ngay (chỉ cần short_description).  
**Sau khi hoàn thành cả 4 ưu tiên:** toàn bộ 1211 DRAFT products có thể publish (trừ 7 products cần cả 4 fix).

---

## Operator Checklist trước publish hàng loạt

- [ ] Nhập `short_description` từ CSV đã review (`product-short-description-review.csv`)
- [ ] Gán brand cho 182 products còn thiếu (review `brand-assignment-review.csv`)
- [ ] Upload ảnh cho 210 products trong `no-image-products.csv`
- [ ] Xác nhận và nhập giá cho 73 products trong `price-zero-products.csv`
- [ ] Fix product `wp-prod-35864`: nhập name và SEO data
- [ ] Confirm gate hoạt động: thử publish 1 product DRAFT thiếu brand → expect 422
- [ ] Confirm gate positive: thử publish 1 product đủ điều kiện → expect 200

---

## Verification — Backend Gate

Để confirm gate đang hoạt động sau khi deploy backend:

```bash
# Lấy 1 product DRAFT thiếu brand (bất kỳ trong 182 products)
PRODUCT_ID="wp-prod-..."   # lấy từ DB: SELECT id FROM products WHERE brand_id IS NULL AND publish_status='DRAFT' LIMIT 1

# Gọi publish — expect 422
curl -s -X PATCH http://localhost:8080/api/v1/admin/products/$PRODUCT_ID/publish \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{"publishStatus":"PUBLISHED"}' | jq .
```

Response mong đợi:
```json
{
  "code": "PRODUCT_NOT_READY_TO_PUBLISH",
  "message": "Product is missing required data to publish.",
  "details": [
    { "field": "brandId",          "code": "REQUIRED", "message": "Brand is required to publish." },
    { "field": "shortDescription", "code": "REQUIRED", "message": "Short description is required to publish." }
  ]
}
```

---

## Files được tạo/sửa trong Phase 3

| File | Thay đổi |
|------|---------|
| `scripts/product-audit/publish-readiness-audit.sql` | Tạo mới — read-only audit script |
| `bigbike-backend/.../api/error/PublishGateException.java` | Tạo mới — HTTP 422, code `PRODUCT_NOT_READY_TO_PUBLISH` |
| `bigbike-backend/.../service/admin/AdminMutationValidators.java` | Thêm `validatePublishReadiness()` + `throwIfPublishErrors()` + constant `REQUIRED` |
| `bigbike-backend/.../service/admin/AdminCatalogMutationService.java` | Gọi gate trong `updateProductPublishStatus()` khi target = PUBLISHED |
| `bigbike-admin/src/screens/ProductDetailScreen.jsx` | Update `getPublishReadiness()`: 9 items thay vì 5, 8 required thay vì 2 |
| `bigbike-admin/src/locales/en.json` | Thêm `brand`, `category`, `seoTitle`, `seoDesc` checklist labels |
| `bigbike-admin/src/locales/vi.json` | Thêm labels tiếng Việt tương ứng |

---

## Constraints đã tuân thủ

- ✅ Không publish sản phẩm nào
- ✅ Không thay đổi dữ liệu product hàng loạt
- ✅ Gate chỉ áp dụng khi target = PUBLISHED (DRAFT/HIDDEN/TRASH không bị ảnh hưởng)
- ✅ State machine transitions không thay đổi
- ✅ 20 PUBLISHED products hiện tại không bị ảnh hưởng (gate chỉ check khi CHUYỂN sang PUBLISHED)
