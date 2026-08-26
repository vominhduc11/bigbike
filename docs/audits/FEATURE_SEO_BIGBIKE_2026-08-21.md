# BigBike SEO audit — current-system fixes

Date: 2026-08-21
Scope: `bigbike-web`, public article/product routes, current BigBike APIs, and the
Google Sheet rows that still matched `bigbike.vn`. The spreadsheet was treated as
historical evidence where its tabs contained Hydrinity data or stale crawl results.

Runtime evidence was collected from the running `bigbike-web:3000`,
`bigbike-backend:8080`, and `bigbike-postgres` containers. No live database write or
container restart was performed in this audit.

## Findings and actions

### F1 — Trang chi tiết bài viết trả lỗi máy chủ

- **Mức độ:** High
- **Lệch ở đâu:** API bài viết vẫn trả dữ liệu hợp lệ, trang danh sách vẫn hoạt động,
  nhưng nhiều URL chi tiết bài viết trả HTTP 500 với digest `DYNAMIC_SERVER_USAGE`.
- **Bằng chứng:** `bigbike-web/app/[locale]/tin-tuc/[slug]/page.tsx`; API
  `GET /api/v1/articles/{slug}`; runtime recrawl ngày 2026-08-21.
- **Rule liên quan:** `ARTICLE_RULE_003` và `SEO_RULE_005` trong
  `docs/business/BUSINESS_RULES.md`; article payload trong
  `docs/engineering/API_CONTRACT.md` §Article Content Contract.
- **Hậu quả vận hành:** Khách và máy tìm kiếm không mở được nội dung blog; metadata
  cũng không thể kiểm tra ổn định.
- **Đã sửa:** Khôi phục `export const dynamic = "force-dynamic"` trên route chi tiết
  bài viết. API fetch vẫn dùng data cache/tag hiện có.
- **Kiểm tra:** Bản build mới trả HTTP 200 cho cả `/tin-tuc/pinlock-la-gi/` và
  `/en/tin-tuc/pinlock-la-gi/`.

### F2 — Redirect SCS trả 308 nhưng thiếu địa chỉ đích

- **Mức độ:** Medium
- **Lệch ở đâu:** Route có dữ liệu sản phẩm và canonical slug đúng, nhưng bản
  prerender trả 308 không có `Location`.
- **Bằng chứng:** `bigbike-web/app/[locale]/product/[slug]/page.tsx`; dòng SCS trong
  tab `3xx Status Code`; runtime header check.
- **Rule liên quan:** `PRODUCT_RULE_003` và `SEO_RULE_006` trong
  `docs/business/BUSINESS_RULES.md` — redirect 308 phải có đích hợp lệ.
- **Hậu quả vận hành:** Trình duyệt/bot có thể dừng ở URL cũ thay vì đến trang sản phẩm.
- **Đã sửa:** Ép route chi tiết sản phẩm render động để `permanentRedirect()` phát
  HTTP `Location` đầy đủ.
- **Kiểm tra:** URL cũ trả `308 Location: /en/product/scs-s10x-motorcycle-helmet-bluetooth-intercom/`; URL canonical trả 200.

### F3 — Hai bài Nexx dùng cùng SEO title tiếng Việt

- **Mức độ:** Medium
- **Lệch ở đâu:** API hiện có một nhóm trùng SEO title gồm hai bài. Bài có ID
  `wp-art-31022` có body/SEO description nói về mẫu SX.100R nhưng SEO title lại
  dùng title của bài SR.100R.
- **Rule liên quan:** `SEO_RULE_009` trong `docs/business/BUSINESS_RULES.md` và
  SEO text contract trong `docs/engineering/DATA_CONTRACT.md`.
- **Hậu quả vận hành:** Hai URL cạnh tranh cùng một tiêu đề trên kết quả tìm kiếm.
- **Đã sửa trong mã nguồn dữ liệu:** Thêm migration
  `V1050__repair_current_article_seo_and_external_links.sql`, cập nhật title của
  `wp-art-31022` thành nội dung SX.100R, có điều kiện bảo vệ thay đổi biên tập mới.
- **Trạng thái:** Chờ migration được áp dụng trong lần triển khai backend kế tiếp.

### F4 — Bài viết còn liên kết ngoài trả 502

- **Mức độ:** Low
- **Lệch ở đâu:** Bài `quan-ao-giap-bao-ho-nu` còn một liên kết đến Tuổi Trẻ trả
  HTTP 502 trong tab `5XX Status Code`; liên kết xuất hiện ở cả bản VI và EN.
- **Rule liên quan:** Không có business rule riêng cho URL ngoài; xử lý bảo thủ là
  bỏ liên kết hỏng và giữ nguyên chữ hiển thị, không tự đoán URL thay thế.
- **Hậu quả vận hành:** Khách bấm vào một tham chiếu ngoài bị hỏng.
- **Đã sửa trong mã nguồn dữ liệu:** Cùng migration `V1050` bỏ riêng hyperlink này
  ở `body` và `body_en`, giữ lại nội dung chữ.
- **Trạng thái:** Chờ migration được áp dụng trong lần triển khai backend kế tiếp.

## Không phải lỗi hiện tại

- `robots.txt` và `sitemap.xml` đang hoạt động đúng theo `SEO_RULE_004`; sitemap
  runtime hiện có khoảng 720 URL.
- Nhiều dòng 4xx/empty-meta trong sheet là crawl cũ hoặc bị ảnh hưởng bởi lỗi 500
  của trang bài viết; không sửa hàng loạt theo dữ liệu stale.
- Các tab `Overview`/`Schema` có dữ liệu `hydrinity.com.vn`, nên không dùng làm bằng
  chứng cho BigBike.
- `llms.txt` hiện không tồn tại trong runtime/repository. Canonical docs chưa yêu cầu
  file này, nên đây là quyết định SEO riêng, không tự thêm.

## Verification

- Web focused tests: **53/53 passed**.
- Web production build: **passed**.
- Web full suite: **487/492 passed**; 5 unrelated tests timed out in the existing
  English-copy, static-HTML fixture, and FloatingChat suites.
- Backend `./mvnw test`: compilation passed; the suite ran **1,433 tests** with 1
  failure and 3 errors, all outside the changed article/product routes (Testcontainers
  image availability, MinIO response fixture, and related infrastructure setup).
- Fresh build smoke check: bài viết VI/EN **200**; SCS old slug **308 có Location**;
  canonical SCS **200**.
- Backend/database migration: file `V1050` đã được thêm; **chưa áp dụng trực tiếp**
  vào database đang chạy vì audit này không thực hiện thao tác ghi trong container.
