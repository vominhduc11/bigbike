# Homepage Data Fix Report

> **Phase:** DATA — xử lý các P1 còn lại của homepage `bigbike-web` bằng dữ liệu/cấu hình, không sửa code frontend.
> **Ngày:** 2026-05-18
> **Liên quan:** [HOMEPAGE_DESIGN_PARITY_AUDIT.md](HOMEPAGE_DESIGN_PARITY_AUDIT.md) · [HOMEPAGE_P1_FIX_PLAN.md](HOMEPAGE_P1_FIX_PLAN.md) · [HOMEPAGE_P1_FIX_REPORT.md](HOMEPAGE_P1_FIX_REPORT.md)

---

## 1. Summary

### Data hiện tại thiếu/sai gì
Điều tra database thật (`bigbike-postgres`) cho kết quả **khác hẳn giả định ban đầu** của report audit. Database **không rỗng**:

- Tổng sản phẩm: **1231** — không phải 3.
- Trạng thái: **`PUBLISHED` = 3**, **`DRAFT` = 1228**.
- Bản import WordPress đã nạp đủ sản phẩm + đã gán homepage block + đã gán slider, **nhưng để gần như toàn bộ ở `DRAFT`**.
- API public chỉ trả sản phẩm `PUBLISHED` → mọi khối homepage trỏ tới sản phẩm `DRAFT` đều rỗng/không render.

→ Tất cả P1 còn lại là **DATA thuần**. Không phát hiện bug code mới. Không cần sửa frontend.

### Đã làm gì
Tạo **dev migration idempotent**: [`bigbike-backend/src/main/resources/db/migration-dev/V1009__publish_homepage_products_dev.sql`](../../bigbike-backend/src/main/resources/db/migration-dev/V1009__publish_homepage_products_dev.sql).
- Chỉ chạy dưới Flyway profile `dev` (`spring.flyway.locations` có `classpath:db/migration-dev`).
- 4 câu `UPDATE` có guard → idempotent, chạy lại nhiều lần cho cùng kết quả.
- Không `INSERT`/`DELETE`, không đổi schema, không đụng FK, không tạo duplicate.
- **Chưa ghi vào DB** — Flyway chỉ áp dụng khi backend khởi động lại (thao tác do người dùng kiểm soát, theo CLAUDE.md).

### Còn gì cần làm thủ công
- **Khởi động lại `bigbike-backend`** để Flyway áp dụng V1009 (xem mục 5).
- Sau khi áp dụng: verify + chụp screenshot (mục 6 — hiện PENDING vì chưa restart).
- Các hạng mục data thuộc **P2** (không trong phạm vi phase này): danh sách brand, ảnh promo banner, số lượng category `showOnHomepage`, wording menu, excerpt bài viết — xem mục 7.

---

## 2. Data Source Trace

| Homepage Area | API (frontend gọi) | Backend Controller / Service | DB Table / Entity | Key Fields |
|---|---|---|---|---|
| Hero slider (ảnh nền + link) | `GET /api/v1/sliders?location=home` | `PublicSliderController` → `SliderReadService` | `sliders` | `location`, `sort_order`, `desktop_image`, `mobile_image`, `product_id`, `external_link`, `is_active` |
| Hero overlay (tên SP, danh mục, mã, CTA) | `GET /api/v1/products/{slug}` (qua `getProductBySlug`, slug parse từ `slider.productLink`) | `CatalogController` | `products` | `publish_status`, `slug`, `name`, `sku`, `image_url`, `category_id` |
| Dải card dưới hero (FEATURED_GRID) | `GET /api/v1/products?homepage_block=FEATURED_GRID` | `CatalogController` | `products` | `homepage_block`, `publish_status`, `homepage_order` |
| "Item đặc sắc" (RECOMMENDED_CAROUSEL) | `GET /api/v1/products?homepage_block=RECOMMENDED_CAROUSEL` | `CatalogController` | `products` | `homepage_block`, `publish_status`, `category_id` |
| Tab danh mục trong "Item đặc sắc" | (lọc client-side trong `FeaturedProductsTabbedGrid`) | — | `products` → `categories` | `products.category_id`, `categories.name` |
| Lưới danh mục (P2) | `GET /api/v1/categories?showOnHomepage=true` | `CatalogController` | `categories` | `show_on_homepage`, `is_visible`, `sort_order` |
| Promo banner (P2) | settings | `PublicSettingsController` | `settings` | `promo_image_url` |

**Quy tắc then chốt:** API public **chỉ trả sản phẩm `publish_status = 'PUBLISHED'`**. Đây là gốc rễ của mọi khối homepage trống — chứ không phải thiếu dữ liệu.

---

## 3. Current Data Problems

| Area | Problem | Root Cause | Evidence (query DB) |
|---|---|---|---|
| Hero | 7/8 slider trỏ tới sản phẩm có thật + có ảnh nhưng hero không hiện overlay | 7 sản phẩm slider đều `publish_status = DRAFT` → `getProductBySlug` 404 | `select s.id, s.product_id, p.publish_status from sliders s join products p on p.id=s.product_id where s.location='home'` → cả 7 đều `DRAFT` |
| Featured grid | Dải card dưới hero không render | 5 sản phẩm đã gán `homepage_block = FEATURED_GRID` nhưng đều `DRAFT` → API trả 0 | `select count(*) from products where homepage_block='FEATURED_GRID'` = 5; cùng điều kiện `publish_status='PUBLISHED'` = 0 |
| Recommended carousel | "Item đặc sắc" chỉ 2 card | Chỉ 2 sản phẩm `RECOMMENDED_CAROUSEL` ở trạng thái `PUBLISHED` | `select id, publish_status from products where homepage_block='RECOMMENDED_CAROUSEL'` → 2 dòng, đều PUBLISHED |
| Tab "Chưa phân loại" | Carousel hiện tab "Chưa phân loại" | `wp-cat-359` là **category thật** (`name='Chưa phân loại'`, `is_visible=false`); sản phẩm `LS2 KOKU KIDNEY BELT` (`wp-prod-36698`) bị gán vào đó | `select id,slug,name,is_visible from categories where id='wp-cat-359'` → tồn tại; `products.category_id` của `wp-prod-36698` = `wp-cat-359` |

**Không phải lỗi:** code frontend (`HeroSlider`, `FeaturedProductsTabbedGrid`, `app/page.tsx`) render đúng theo dữ liệu API trả về. Sliders có `product_id` hợp lệ; homepage block đã gán đúng. Vấn đề duy nhất là `publish_status`.

---

## 4. Data Fixes / Admin Actions

| # | Area | Required Action | Expected Result | Status |
|---|---|---|---|---|
| 1 | Hero | Publish 7 sản phẩm slider: `wp-prod-38469, 37433, 39156, 38995, 36772, 35026, 33022` | `getProductBySlug` resolve được → hero render overlay (danh mục + tên SP + nút "MUA NGAY" + watermark + mã slide) | ✅ Đã đưa vào V1009 |
| 2 | Featured grid | Publish 5 sản phẩm đã gán `FEATURED_GRID`: `wp-prod-138, 29819, 7121, 7389, 8478` | Block 2 render dải card dưới hero (5 card; design yêu cầu ≥3 — admin có thể trim còn 3 nếu muốn) | ✅ Đã đưa vào V1009 |
| 3 | Recommended carousel | Gán thêm 3 sản phẩm intercom (`wp-prod-38469, 36772, 35026`, cùng category "Tai nghe Bluetooth") vào `RECOMMENDED_CAROUSEL` | Block "Item đặc sắc" có 5 sản phẩm; tab "Tai nghe Bluetooth" hiện 3 card → carousel thật | ✅ Đã đưa vào V1009 |
| 4 | Category | Gán lại `wp-prod-36698` (LS2 KOKU KIDNEY BELT) từ `wp-cat-359` "Chưa phân loại" → `wp-cat-293` "Giáp bảo hộ tay chân - đai lưng - phụ kiện giáp" | Không còn sản phẩm published nào thuộc `wp-cat-359` → tab "Chưa phân loại" biến mất | ✅ Đã đưa vào V1009 |

**Cách 2 — qua admin panel** (tương đương, nếu không chạy migration): trong `bigbike-admin` → Sản phẩm: mở từng sản phẩm ở bảng trên, đổi trạng thái sang **Đã xuất bản**; với mục 3 set **Khối trang chủ = Recommended carousel**; với mục 4 đổi **Danh mục** sản phẩm LS2 KOKU KIDNEY BELT.

> Không hardcode bất kỳ dữ liệu nào vào frontend. Không đổi API/data contract.

---

## 5. SQL / Seed Changes

**File đã tạo:** `bigbike-backend/src/main/resources/db/migration-dev/V1009__publish_homepage_products_dev.sql`

Đây là **dev seed migration** — đúng cơ chế sẵn có của project (cùng thư mục với `V1001`–`V1008`). Nội dung gồm 4 `UPDATE` idempotent:

1. `update products set publish_status='PUBLISHED' where id in (7 slider products) and publish_status<>'PUBLISHED'`
2. `update products set publish_status='PUBLISHED' where homepage_block='FEATURED_GRID' and publish_status<>'PUBLISHED'`
3. `update products set homepage_block='RECOMMENDED_CAROUSEL' where id in (3 intercoms) and homepage_block<>'RECOMMENDED_CAROUSEL'`
4. `update products set category_id='wp-cat-293' where id='wp-prod-36698' and category_id='wp-cat-359'`

**Kiểm tra trước (dry-run SELECT, không ghi DB):**

| Bước | Số dòng sẽ ảnh hưởng | Xác nhận |
|---|---|---|
| 1 — publish slider products | 7 | ✅ đúng kỳ vọng |
| 2 — publish FEATURED_GRID | 5 | ✅ đúng kỳ vọng |
| 3 — gán RECOMMENDED_CAROUSEL | 3 | ✅ đúng kỳ vọng |
| 4 — đổi category belt | 1 | ✅ đúng kỳ vọng |
| Category đích `wp-cat-293` tồn tại | — | ✅ có |

**Cách áp dụng:** Migration chạy tự động khi `bigbike-backend` khởi động lại với profile `dev` (`SPRING_PROFILES_ACTIVE=dev`). Lệnh restart là **thao tác của người dùng** (CLAUDE.md cấm agent tự `restart`):

```
docker compose restart bigbike-backend
```

Sau khi restart, vì frontend dùng ISR `revalidate = 3600`, có thể trang chủ cache tới 1h. Để thấy ngay, gọi revalidate hoặc khởi động lại `bigbike-web`, hoặc đợi ISR hết hạn.

> **An toàn:** migration không xoá dữ liệu, không sửa schema, chỉ đổi `publish_status` / `homepage_block` / `category_id` của **đúng 16 sản phẩm** được liệt kê. Không ảnh hưởng `migration/` production. Nếu cần hoàn tác: set lại `publish_status='DRAFT'` cho các id tương ứng.

---

## 6. Verification Screenshots

**Trạng thái: PENDING** — chưa thể chụp ảnh "after" vì migration chỉ áp dụng sau khi `bigbike-backend` được khởi động lại, và việc restart container dùng chung do người dùng quyết định (không nằm trong quyền agent).

Sau khi người dùng restart backend (và refresh ISR của `bigbike-web`), bước verify dự kiến:
- Chụp Playwright 4 viewport: 1920×1080, 1440×900, 768×1024, 390×844.
- Chụp riêng: `hero-default`, `below-hero-featured-grid`, `recommended-carousel`, `category-grid`.
- Lưu vào `docs/audits/homepage-data-after-shots/`.

→ Có thể yêu cầu agent chụp bổ sung ngay sau khi backend đã restart.

---

## 7. Remaining P1 Issues

| P1 | Trạng thái sau Phase DATA |
|---|---|
| Hero banner phẳng | ✅ **Hết** sau khi áp dụng V1009 (7 slider product được publish). Cần verify bằng screenshot. |
| Mất dải 3 card dưới hero | ✅ **Hết** sau khi áp dụng V1009 (5 FEATURED_GRID product được publish). |
| "Item đặc sắc" thiếu sản phẩm | ✅ **Hết** sau khi áp dụng V1009 (carousel có 5 sản phẩm). |
| Tab "Chưa phân loại" | ✅ **Hết** sau khi áp dụng V1009 (belt product đổi sang `wp-cat-293`). |

- **P1 cần code tiếp:** Không. Issue code P1 duy nhất (mega menu) đã xử lý ở [HOMEPAGE_P1_FIX_REPORT.md](HOMEPAGE_P1_FIX_REPORT.md).
- **P1 cần business confirmation:** Không còn. (Việc publish sản phẩm đã được người dùng phê duyệt qua lựa chọn tạo dev migration.)
- **Còn phụ thuộc thao tác người dùng:** restart `bigbike-backend` để Flyway áp dụng V1009 + verify screenshot.

**Ghi chú phạm vi (P2 — KHÔNG xử lý ở phase này, vẫn nằm trong audit gốc):**
- Featured grid sẽ hiện **5** card; design vẽ 3 — admin có thể set 2 sản phẩm về `homepage_block=NONE` nếu muốn đúng 3.
- `FeaturedProductsTabbedGrid` chia tab theo từng category → có thể ra nhiều tab ít card; đây là vấn đề **dạng hiển thị (P2)**, không phải data.
- Brand strip, ảnh promo banner, số lượng category `showOnHomepage` (12 vs 8), wording menu, excerpt bài viết — đều là P2 data/config, để phase P2.

---

## 8. Final Verdict

Sau Phase DATA, **toàn bộ 4 issue P1 đều có đường giải quyết rõ ràng bằng dữ liệu** — đã đóng gói trong dev migration `V1009`, idempotent và an toàn. Không cần thêm thay đổi code frontend.

**Điều kiện để chuyển sang P2/P3:**
1. Người dùng restart `bigbike-backend` để áp dụng V1009.
2. Agent (hoặc người dùng) chụp lại homepage 4 viewport + 4 section, xác nhận hero/featured grid/carousel hiển thị đúng và tab "Chưa phân loại" đã biến mất.

→ **Sau khi 2 bước trên hoàn tất và verify đạt, homepage đủ điều kiện chuyển sang xử lý P2/P3.** Trước khi verify, kết luận P1 = "đã giải quyết ở mức dữ liệu, chờ áp dụng".

---

*Hết báo cáo. Phase DATA không sửa code frontend, không đổi API/data contract, không hardcode. Chỉ thêm 1 file dev seed migration idempotent; chưa ghi vào database.*
