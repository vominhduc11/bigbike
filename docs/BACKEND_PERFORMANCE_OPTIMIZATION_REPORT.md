# BÁO CÁO TỐI ƯU HIỆU NĂNG BACKEND — BigBike

Ngày: 2026-05-16
Phạm vi: `bigbike-backend` (Spring Boot 4.0.5, Java 17, PostgreSQL 16, JPA/Hibernate)
Hướng tiếp cận: **professional performance optimization** — chỉ thực hiện các thay
đổi an toàn, đã chứng minh; không đổi business rule / API contract / state machine.
Các tối ưu có rủi ro được đánh dấu `NEEDS_CONFIRMATION`.

---

## 1. Executive Summary

### Vấn đề hiệu năng chính phát hiện qua audit

1. **Hibernate không bật batch fetch.** `application.properties` thiếu
   `hibernate.default_batch_fetch_size` → mọi collection LAZY của catalog
   (`product.gallery`, `videos`, `specifications`, `variants`,
   `variant.options`) được load **từng dòng một** → N+1 query nghiêm trọng ở
   mọi endpoint đọc sản phẩm.
2. **8 quan hệ `@ManyToOne` trong entity catalog đang EAGER ngầm định** (không
   khai báo `fetch`) → kéo theo graph thừa, đặc biệt
   `ProductVariantOptionEntity.attribute` / `attributeValue` load EAGER cho
   từng option row.
3. **Thiếu index trên 11 cột khóa ngoại** của nhóm bảng catalog
   (`products.brand_id/category_id`, `product_gallery_images.product_id`,
   `product_variant_options.*` ...) → join chậm, cascade-delete chậm, full scan
   khi dữ liệu lớn.
4. **Wishlist gọi repository trong vòng lặp** — 1 query cho mỗi sản phẩm trong
   danh sách yêu thích.
5. **Read service thiếu `@Transactional(readOnly = true)`** → Hibernate không
   bỏ được dirty-check, mỗi lần gọi repository mở transaction riêng.

### Đã tối ưu trong phase này

| # | Hạng mục | Mức | Rủi ro |
|---|---|---|---|
| 1 | Bật Hibernate batch fetch + batch write (config) | P0 | 0 |
| 2 | `fetch = LAZY` cho 8 `@ManyToOne` catalog | P0 | 0 |
| 3 | Migration `V123` thêm 11 index FK catalog | P0/P1 | 0 |
| 4 | Sửa N+1 vòng lặp ở Wishlist (batch query) | P1 | thấp |
| 5 | `@Transactional(readOnly = true)` cho 3 read service | P1/P2 | 0 |

### Phần CHƯA sửa — cần xác nhận (`NEEDS_CONFIRMATION`)

- **Đẩy filter/sort/pagination của `CatalogReadService.listProducts` xuống SQL.**
  Hiện endpoint danh sách sản phẩm public nạp **toàn bộ** sản phẩm + toàn bộ
  object graph vào RAM rồi mới filter/sort/paginate. Đây là điểm nghẽn CPU/heap
  lớn nhất còn lại. Chưa sửa vì: color filter so khớp qua `variant_options`
  chuẩn hoá tiếng Việt có dấu — đẩy xuống SQL có rủi ro sai lệch kết quả; refactor
  cũng có thể đổi shape response. **Sau khi bật batch fetch (#1), số query của
  endpoint này đã giảm mạnh** — phần còn lại là tối ưu bộ nhớ/CPU, không phải
  query. Xem mục 7.
- **Tách lightweight list DTO** cho các API list (bỏ `variants/gallery` khỏi
  response list) — đổi shape response, cần phối hợp web/mobile/admin.
- **Thêm cache (Redis / Caffeine)** — backend hiện không có hạ tầng cache. Xem
  mục 5.

---

## 2. API Performance Risk Matrix

| Module / Endpoint | Risk | Vấn đề | Root cause | Fix | Tác động | File |
|---|---|---|---|---|---|---|
| `GET /api/v1/products` (catalog list) | P0 | N+1 nặng + nạp toàn bộ graph vào RAM | `findAllProducts()` → `findAll()` + map full graph; không batch fetch | Đã bật batch fetch (#1) + LAZY (#2). Phần đẩy filter xuống SQL: `NEEDS_CONFIRMATION` | Giảm hàng trăm query collection xuống còn vài chục (chia lô 25) | `CatalogReadService.java`, `JpaCatalogReadRepository.java`, `application.properties` |
| `GET /api/v1/products/{slug}` (detail) | P0 | N+1 khi load gallery/videos/specs/variants/options | Collection LAZY load từng dòng; `attribute/attributeValue` EAGER | Batch fetch (#1) + LAZY (#2) + index `V123` (#3) | Detail 1 sản phẩm: số query collection giảm rõ rệt | entity catalog, `application.properties` |
| `GET /api/v1/admin/products` | P0 | Như catalog list, lọc qua Specification rồi map full graph | Không batch fetch | Batch fetch (#1) + LAZY (#2) | Giảm N+1 ở phần map | `AdminCatalogReadService.java` |
| Wishlist (`getWishlistProducts`) | P1 | 1 query / 1 sản phẩm | Vòng lặp gọi `findProductByIdPublicView` | Thêm `findProductsByIdsPublicView` batch (#4) | N query → 1 query (+ batch fetch collection) | `CatalogReadService.java`, `CatalogReadRepository.java` |
| Mọi read service catalog/order | P1 | Transaction tách rời, không readOnly | Thiếu `@Transactional(readOnly=true)` | Thêm annotation cấp class (#5) | Gói thao tác đọc trong 1 session, bỏ dirty-check | `CatalogReadService`, `AdminCatalogReadService`, `OrderReadService` |
| Join catalog theo FK chưa index | P0/P1 | Full scan / seq scan khi join, cascade delete chậm | 11 cột FK không có index từ V1/V15/V41 | Migration `V123` (#3) | Index hoá đường join FK chính của catalog | `V123__add_catalog_foreign_key_indexes.sql` |
| Bulk coupon gift | P2 | INSERT từng dòng trong vòng lặp | Không batch JDBC | Đã bật `hibernate.jdbc.batch_size` + `order_inserts` (#1) | Gom INSERT khi flush | `application.properties` |
| `AdminOrderService.toDetail` / `OrderReadService.toDetail` | P3 | 6 query tuần tự cho 1 order detail | Mỗi quan hệ con query riêng | KHÔNG sửa — 6 query đều theo cột FK đã có index, chi phí thấp; gộp lại không đáng rủi ro | — | — |

---

## 3. Database Optimization

### Vấn đề phát hiện

- `products`: FK `brand_id`, `category_id` không có index (từ V1).
- `product_gallery_images`, `product_videos`, `product_specifications`,
  `product_variants`: FK `product_id` không có index → vừa làm chậm fetch
  collection theo product, vừa làm chậm `ON DELETE CASCADE`.
- `product_variant_options`: 3 FK `variant_id`, `attribute_id`,
  `attribute_value_id` không có index.
- `product_variant_gallery_images`: FK `variant_id` không có index.
- `product_tag_map`: PK `(product_id, tag_id)` đã phủ `product_id`; thiếu index
  cho chiều ngược `tag_id`.

### Index đã thêm — `V123__add_catalog_foreign_key_indexes.sql`

11 index, dùng `CREATE INDEX IF NOT EXISTS` (idempotent, không trùng index cũ):

| Bảng | Cột | Phục vụ |
|---|---|---|
| `products` | `brand_id` | filter sản phẩm theo brand |
| `products` | `category_id` | filter theo category, join danh mục |
| `product_gallery_images` | `product_id` | fetch gallery, cascade delete |
| `product_videos` | `product_id` | fetch video, cascade delete |
| `product_specifications` | `product_id` | fetch specs, cascade delete |
| `product_variants` | `product_id` | fetch variant theo product |
| `product_variant_options` | `variant_id` | fetch option theo variant |
| `product_variant_options` | `attribute_id` | resolve dictionary attribute |
| `product_variant_options` | `attribute_value_id` | resolve dictionary value |
| `product_variant_gallery_images` | `variant_id` | fetch gallery variant |
| `product_tag_map` | `tag_id` | tra ngược sản phẩm theo tag |

Không thêm index tràn lan: mỗi index gắn với một đường join FK / filter có thật.

### Index đề xuất nhưng CHƯA thêm (`NEEDS_CONFIRMATION`)

- **Full-text / trigram index cho search `LIKE '%...%'`.** Audit tìm thấy ~44
  query dùng leading-wildcard `LIKE '%kw%'` (product/serial/review/article
  search). Các query này không dùng được B-tree index thường. Giải pháp đúng là
  PostgreSQL `pg_trgm` (extension) + GIN index, hoặc `tsvector` full-text. Đây
  là thay đổi schema lớn hơn, cần xác nhận: bật extension `pg_trgm` ở môi trường
  prod và đánh giá ảnh hưởng write.
- `idx_orders_customer_id_status` cho lọc lịch sử đơn của khách theo trạng thái
  — cần xác nhận pattern truy vấn thực tế trước khi thêm.

### Query cần refactor thêm (`NEEDS_CONFIRMATION`)

- `CatalogReadService.listProducts` — xem mục 7.

---

## 4. ORM / Hibernate / JPA Findings

### N+1 issues

- **Collection LAZY load từng dòng** (`gallery`, `videos`, `specifications`,
  `variants`, `variant.options`) — đã xử lý bằng
  `hibernate.default_batch_fetch_size=25`: Hibernate gom việc khởi tạo collection
  thành câu `... IN (?, ?, ...)` theo lô 25.
- **Wishlist N+1 vòng lặp** — đã xử lý bằng batch query `findProductsByIdsPublicView`.

### Fetch strategy issues

- 8 quan hệ `@ManyToOne` để mặc định EAGER, nay đổi sang `FetchType.LAZY`:
  - `ProductGalleryImageEntity.product`
  - `ProductVideoEntity.product`
  - `ProductSpecificationEntity.product`
  - `ProductVariantGalleryImageEntity.variant`
  - `ProductVariantOptionEntity.variant`, `.attribute`, `.attributeValue`
  - `StockMovementEntity.variant`
- An toàn vì mọi điểm đọc các quan hệ này (`JpaCatalogReadRepository.toDomain*`,
  `toVariantOption`) đều chạy trong transaction `@Transactional(readOnly=true)`
  của repository → không phát sinh `LazyInitializationException`
  (`spring.jpa.open-in-view=false` vẫn giữ nguyên). Các repository query đã dùng
  `JOIN FETCH` tường minh cho `StockMovement.variant` nên không đổi hành vi.

### Projection / DTO improvements

- `JpaCatalogReadRepository.toDomainListItem` đã có sẵn cho admin list (bỏ qua
  description/variants/specs/gallery). Việc áp lightweight DTO cho list public:
  `NEEDS_CONFIRMATION` (đổi shape response).

### Transaction improvements

- Thêm `@Transactional(readOnly = true)` cấp class cho `CatalogReadService`,
  `AdminCatalogReadService`, `OrderReadService` — đều là service thuần đọc.
  Cho phép Hibernate bỏ dirty-check và gói toàn bộ thao tác đọc (kể cả wishlist)
  trong một transaction/session.
- Bật `hibernate.order_inserts/order_updates` + `jdbc.batch_size=25` để gom
  INSERT/UPDATE khi ghi hàng loạt (vd bulk coupon gift).

---

## 5. Cache Strategy

**Hiện trạng:** backend KHÔNG có hạ tầng cache — không có
`spring-boot-starter-cache`, không `spring-boot-starter-data-redis`, không
`@EnableCaching`, không service Redis trong `docker-compose`.

**Quyết định phase này:** chưa thêm cache (`NEEDS_CONFIRMATION`).

**Đề xuất khi triển khai (cần xác nhận):**

| Đối tượng | Nên cache? | TTL gợi ý | Invalidation |
|---|---|---|---|
| Danh sách category | Có | 10–30 phút | `@CacheEvict` khi admin sửa category |
| Danh sách brand | Có | 10–30 phút | `@CacheEvict` khi admin sửa brand |
| Product list/detail public | Cân nhắc | 1–5 phút | evict khi sửa/đổi publish_status sản phẩm |
| Dashboard summary | Cân nhắc | 1–5 phút | chỉ khi có invalidation rõ ràng |
| Order/payment/serial/warranty state | **KHÔNG** | — | dữ liệu realtime, nhạy cảm — cache gây sai workflow |
| User permission/session | **KHÔNG** | — | chưa chắc chắn invalidation |

Cách triển khai an toàn nhất không cần đổi hạ tầng: Spring Cache + Caffeine
(in-memory), `@Cacheable` cho category/brand list, `@CacheEvict` ở mutation
service. Nếu cần chia sẻ cache giữa nhiều instance thì mới cần Redis (đổi
`docker-compose`).

---

## 6. Before/After

> **Latency API: not measured.** Không có môi trường benchmark có kiểm soát và
> chưa có bộ dữ liệu lớn đại diện trong phase này — không đưa số liệu bịa.

### Số query (định tính, đã chứng minh bằng cơ chế Hibernate)

| Thao tác | Trước | Sau |
|---|---|---|
| Catalog list (N sản phẩm) load collection | ~ N×4 query LAZY (mỗi product 1 query/collection) | ~ ⌈N/25⌉×4 query (gom lô `IN`) |
| `variant_options` resolve attribute/value | EAGER từng option row | gom lô 25 |
| Wishlist (M sản phẩm) | M query | 1 query (+ batch fetch collection) |

### Index

- 11 index FK catalog được thêm qua `V123` — áp dụng khi backend khởi động lại
  (Flyway). Đo cụ thể cần `EXPLAIN ANALYZE` trên dữ liệu prod: **not measured**.

### Build / Test

- `./mvnw -o clean test` — **BUILD SUCCESS** (exit code 0).
- **1176 test pass / 0 failure / 0 error / 1 skipped** (75 test class).
- Migration `V123` được Flyway áp dụng sạch trong các schema test (test chạy
  trên H2 in-memory; `CREATE INDEX IF NOT EXISTS` tương thích cả H2 lẫn
  PostgreSQL).

---

## 7. Remaining Risks

### Cần xác nhận business owner / cần làm phase sau (`NEEDS_CONFIRMATION`)

1. **`CatalogReadService.listProducts` vẫn nạp toàn bộ sản phẩm vào RAM.** Batch
   fetch đã giảm mạnh *số query*, nhưng filter/sort/paginate vẫn chạy trong JVM.
   Khi catalog lên hàng nghìn sản phẩm, đây là chi phí CPU/heap. Refactor đẩy
   xuống SQL: rủi ro ở (a) color filter so khớp `variant_options` đã chuẩn hoá
   tiếng Việt có dấu; (b) khả năng đổi shape response. Cần quyết định cách xử lý.
2. **Search `LIKE '%kw%'`** (~44 query) — cần `pg_trgm`/full-text. Thay đổi
   schema + cần bật extension ở prod.
3. **Cache** — chưa triển khai; cần quyết định Caffeine vs Redis.

### Cần kiểm chứng thủ công

- Áp dụng migration `V123` trên DB thật và `EXPLAIN ANALYZE` các query join
  catalog để xác nhận index được dùng.
- Smoke test contract: so sánh response trước/sau ở `GET /products`,
  `GET /products/{slug}`, `GET /admin/products`, wishlist — shape phải y hệt.

### Cần load test riêng

- Đo latency thực của catalog list/detail trước/sau với bộ dữ liệu lớn
  (vài nghìn sản phẩm, mỗi sản phẩm nhiều variant) — chưa thực hiện.

---

## 8. Danh sách file đã sửa / tạo

**Sửa:**
- `bigbike-backend/src/main/resources/application.properties` — bật batch fetch + batch write
- `.../persistence/entity/catalog/ProductGalleryImageEntity.java` — `@ManyToOne` → LAZY
- `.../persistence/entity/catalog/ProductVideoEntity.java` — `@ManyToOne` → LAZY
- `.../persistence/entity/catalog/ProductSpecificationEntity.java` — `@ManyToOne` → LAZY
- `.../persistence/entity/catalog/ProductVariantGalleryImageEntity.java` — `@ManyToOne` → LAZY
- `.../persistence/entity/catalog/ProductVariantOptionEntity.java` — 3 `@ManyToOne` → LAZY
- `.../persistence/entity/catalog/StockMovementEntity.java` — `@ManyToOne` → LAZY
- `.../repository/catalog/CatalogReadRepository.java` — thêm `findProductsByIdsPublicView`
- `.../repository/catalog/JpaCatalogReadRepository.java` — impl batch lookup
- `.../repository/catalog/InMemoryCatalogReadRepository.java` — impl batch lookup (profile mock)
- `.../service/catalog/CatalogReadService.java` — sửa wishlist N+1 + `@Transactional(readOnly=true)`
- `.../service/admin/AdminCatalogReadService.java` — `@Transactional(readOnly=true)`
- `.../service/order/OrderReadService.java` — `@Transactional(readOnly=true)`

**Tạo mới:**
- `bigbike-backend/src/main/resources/db/migration/V123__add_catalog_foreign_key_indexes.sql`
- `docs/BACKEND_PERFORMANCE_OPTIMIZATION_REPORT.md` (tài liệu này)

---

## 9. Acceptance Criteria & Hướng dẫn verify

### Kết quả build / test

- `./mvnw -o clean test`: **BUILD SUCCESS**, exit code 0.
- Tests run: **1176**, Failures: **0**, Errors: **0**, Skipped: **1** (75 test class).
- Không có test nào hồi quy do thay đổi của phase này.

### Lệnh verify

```bash
# 1. Build + test backend (Testcontainers PostgreSQL)
cd bigbike-backend
./mvnw -o clean test          # Windows: mvnw.cmd -o clean test

# 2. Kiểm tra migration V123 áp dụng (sau khi backend khởi động lại)
#    docker ps  -> xác nhận stack chạy; KHÔNG tự restart, nhờ user restart backend
docker compose exec db psql -U bigbike -d bigbike -c "\d+ product_variants"
docker compose exec db psql -U bigbike -d bigbike \
  -c "select indexname from pg_indexes where tablename='product_variant_options';"

# 3. Smoke test contract — shape response phải y hệt trước/sau
curl -s "http://localhost:8080/api/v1/products?page=1&size=20" | head
curl -s "http://localhost:8080/api/v1/products/{slug}" | head
```

### Tiêu chí hoàn thành

- [x] Backend build pass (`./mvnw -o clean test`)
- [x] Test pass — 1176 pass / 0 fail / 0 error / 1 skip
- [x] Không breaking API contract — không sửa controller/DTO/response shape
- [x] Không thay đổi business rule, state machine, permission
- [x] Không làm sai workflow order/payment/serial/warranty
- [x] Migration `V123` chỉ thêm index, không đổi data/semantics
- [x] Báo cáo này đầy đủ 9 mục
- [ ] (Thủ công) Áp `V123` trên DB prod + `EXPLAIN ANALYZE` xác nhận index dùng
