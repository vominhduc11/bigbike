# Kiểm tra đăng sản phẩm từ BigBike lên Google Merchant Center

> **Báo cáo hiện trạng trước triển khai.** Sau báo cáo này, owner đã yêu cầu thực thi kết nối GMC. Theo dõi thay đổi và nghiệm thu tại [FEATURE_GMC_IMPLEMENTATION_2026-09-07.md](FEATURE_GMC_IMPLEMENTATION_2026-09-07.md); canonical contract mới là `GMC_RULE_001`–`005` và `GMC_SETUP.md`. Các kết luận “chưa có feed” bên dưới mô tả bản được kiểm tra ban đầu.

Ngày kiểm tra: 07/09/2026, giờ Việt Nam. Kiểm tra trực tiếp trên **VPS production**, các container đang chạy và tên miền `https://bigbike.vn`. `127.0.0.1:3000`/`:8080` trong báo cáo là cổng nội bộ trên chính VPS, không phải môi trường phát triển.

## Kết luận

**Chưa có bằng chứng đủ để khẳng định “admin xuất bản sản phẩm là tự lên GMC, không cần đăng thủ công”.**

- BigBike hiện có luồng xuất bản/cập nhật website, sitemap động và dữ liệu có cấu trúc `Product`/`ProductGroup` để Google đọc sản phẩm.
- Không tìm thấy nguồn sản phẩm dành riêng cho GMC (feed), tích hợp Merchant API, cấu hình GMC hoặc cơ chế nhận kết quả đồng bộ trong mã nguồn và bản triển khai được kiểm tra.
- GMC vẫn có thể tự thêm sản phẩm bằng nguồn **Found by Google / Add products from online store**, nếu tài khoản đã xác minh website và bật nguồn tự động. Đây là cơ chế Google đọc website; không cần BigBike có API đẩy riêng. Chưa truy cập được tài khoản GMC để xác minh nguồn đang bật, lần lấy gần nhất, số sản phẩm nhận được hoặc trạng thái duyệt.
- Vì vậy, **không được suy ra “GMC đang đồng bộ” chỉ từ sitemap/schema**, cũng không được suy ra “bắt buộc đăng tay” chỉ từ việc chưa có feed/API.

Phạm vi yêu cầu là kiểm tra hiện trạng. Không sửa mã nguồn, cấu hình, dữ liệu sản phẩm, chính sách truy cập hoặc tài khoản Google; không khởi động lại dịch vụ.

## Căn cứ chuẩn và bản đồ luồng

| Phần | Hành vi được kiểm tra | Căn cứ |
|---|---|---|
| Phạm vi module | Catalog admin và Catalog browse còn hoạt động | `docs/business/MODULE_CATALOG.md`, hai hàng tương ứng |
| Admin | Tạo/lưu nháp và xuất bản là các hành động riêng; xuất bản bằng `PATCH /api/v1/admin/products/{id}/publish` | `docs/engineering/API_CONTRACT.md:792`; `docs/business/STATE_MACHINES.md:67`; `PRODUCT_RULE_005` trong `docs/business/BUSINESS_RULES.md:350` |
| Admin → máy chủ | Nút xuất bản gọi API BigBike và cập nhật trạng thái trên màn quản trị | `bigbike-admin/src/screens/ProductDetailScreen.jsx:854`; `bigbike-admin/src/lib/adminApi.js:751` |
| Máy chủ → website | Lưu trạng thái, ghi nhật ký, yêu cầu website làm mới dữ liệu sau khi giao dịch lưu thành công | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/ProductMutationService.java:251`; `service/web/WebRevalidationService.java:70`; `docs/engineering/INTEGRATION_GUIDE.md:168` |
| Website → Google đọc | Sitemap dựng từ sản phẩm công khai; trang chi tiết chứa Product/ProductGroup và Offer | `bigbike-web/app/sitemap.ts:130`; `bigbike-web/lib/seo/json-ld.ts:43` và `:501` |
| Hàng ngừng bán | Loại khỏi danh sách/sitemap/feed theo quy tắc; việc tài liệu nhắc feed không xác nhận feed đã triển khai | `docs/engineering/DATA_CONTRACT.md:451`; `docs/business/STATE_MACHINES.md:73` |
| GA4 | Gửi SKU làm mã sản phẩm trong sự kiện đo lường, không phải luồng đưa danh mục vào GMC | `docs/engineering/INTEGRATION_GUIDE.md:385`, đặc biệt hàng Item ids tại `:402` |

Luồng có bằng chứng: **Admin xuất bản → BigBike lưu và làm mới website → sitemap/trang sản phẩm có thể được Google thu thập**. Bước **Google tiếp nhận vào đúng tài khoản GMC** chưa được xác minh.

## F1 — Chưa có kênh đồng bộ GMC do BigBike quản lý

- **Mức độ:** Medium — khoảng trống khả năng tích hợp; không phải lỗi làm sai một hợp đồng đồng bộ đã được chốt.
- **Lệch ở đâu:** Admin xác nhận xuất bản trên BigBike; máy chủ cập nhật BigBike; không có bước gửi sản phẩm sang GMC hoặc nhận trạng thái thành công/thất bại từ Google.
- **Bằng chứng:** luồng ba đầu ở bảng trên; tìm mã nguồn, OpenAPI, cấu hình deployment, route của bản web và mã ứng dụng trong JAR đang chạy không tìm thấy feed/đích Merchant API.
- **Rule liên quan:** `PRODUCT_RULE_005`, API lifecycle và Web Revalidation chỉ quy định xuất bản/làm mới website. Không tìm thấy hợp đồng Merchant API/feed đang hoạt động trong canonical docs.
- **Hậu quả vận hành:** thông báo “đã xuất bản” trong admin không xác nhận GMC đã nhận hoặc duyệt sản phẩm; chưa có trạng thái GMC để nhân viên theo dõi trong admin.
- **Cần owner quyết:** không cần quyết định để kết luận hiện trạng. Việc xây thêm feed/API là phạm vi triển khai tiếp theo, cần chốt dựa trên nguồn GMC đang sử dụng và yêu cầu tốc độ cập nhật.
- **Trạng thái:** Đã xác minh khả năng hiện có; chưa triển khai mới trong yêu cầu kiểm tra này.
- **Đối chiếu lịch sử:** `docs/audits/FINDING_2026-08-14_REDIRECT_FINAL.md:344` và `FINDING_2026-08-13_REDIRECT_DISCONTINUED.md:57` từng ghi chưa tìm thấy feed. Các ghi chú này không có mã `AUD-xxx` riêng; lần này kiểm lại độc lập trên bản chạy hiện tại.

## Kết quả kiểm tra trực tiếp

| Kiểm tra | Kết quả |
|---|---|
| `docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'` | `bigbike-web`, `bigbike-backend`, `bigbike-admin`, `bigbike-postgres`, `bigbike-redis`, `bigbike-minio` đang chạy và healthy |
| Cấu hình backend đang chạy | Profile `prod`, URL website `https://bigbike.vn`; cấu hình yêu cầu website làm mới và khóa xác thực tương ứng đều có giá trị. Không xuất giá trị khóa bí mật |
| Đọc DB bằng transaction read-only | 185 `PUBLISHED`, 35 `DRAFT`, 29 `TRASH`; đều `discontinued=false` tại thời điểm kiểm tra |
| `GET http://127.0.0.1:8080/api/v1/products?page=1&size=3` | HTTP 200; tổng danh sách công khai 185 sản phẩm |
| `GET https://bigbike.vn/sitemap.xml` | HTTP 200, XML hợp lệ; 740 URL, gồm 185 URL chi tiết VI và 185 URL chi tiết EN. Không phải 370 sản phẩm khác nhau |
| `GET https://bigbike.vn/robots.txt` | HTTP 200; các quy tắc trả về không chặn Googlebot ở `/product/` hoặc `/media/`. Không dùng kết quả này để khẳng định đã vượt qua mọi lớp bảo vệ ngoài robots |
| Ba trang sản phẩm mẫu | HTTP 200; mỗi trang có trong sitemap và có Product/ProductGroup, SKU/mã nhóm, ảnh, giá VND, tình trạng hàng, canonical phù hợp |
| Ảnh chính trên ba trang mẫu | GET với User-Agent `Mozilla/5.0` đều HTTP 200, `image/webp`. Kiểm một ảnh qua web nội bộ VPS cũng HTTP 200 |
| Manifest web đang chạy | Đọc `/app/.next/server/app-paths-manifest.json` trong `bigbike-web`: 48 route; có sitemap/robots/trang sản phẩm, không có route mang tên merchant/shopping/gmc/feed |
| Backend đang chạy | Đọc `/app/app.jar` trong `bigbike-backend`, xét 1.073 class ứng dụng: không có class mang tên Merchant/GMC/ShoppingFeed hoặc chuỗi đích Merchant API/feed trong tập mẫu tìm kiếm |
| OpenAPI trong repo | 148 đường dẫn; không có đường dẫn merchant/shopping/gmc/feed |
| Cấu hình và lịch chạy | Không có tên biến merchant/gmc/shopping/feed trong môi trường ba app, `.env`, `.env.example`, `docker-compose.yaml`; không có tham chiếu tương ứng trong cấu hình Nginx/cron đã kiểm tra |
| Cơ sở dữ liệu | Không có bảng khớp merchant/shopping/gmc/feed/sync/outbox hoặc khóa `site_settings` khớp merchant/shopping/gmc/feed |

Mẫu sản phẩm đã mở trên tên miền thật:

- [Bu lông nâng chân gương Kewig](https://bigbike.vn/product/bu-long-nang-chan-guong-kewig/): `ProductGroup`, tám biến thể; giá đọc theo Offer của từng biến thể.
- [Đầu gá nam châm tháo nhanh cho DJI Kewig X1](https://bigbike.vn/product/dau-ga-nam-cham-thao-nhanh-cho-dji-kewig-x1/): `Product`, giá 135.000 VND, InStock.
- [Đầu chuyển khớp bi ra ren 6 ly Kewig R7](https://bigbike.vn/product/dau-chuyen-khop-bi-ra-ren-6-ly-kewig-r7/): `Product`, giá 179.000 VND, InStock.

### Giới hạn về chất lượng dữ liệu và quyền truy cập

- `description` trong dữ liệu có cấu trúc của ba trang mẫu đang là chuỗi rỗng. Sản phẩm có biến thể không màu có thể không có ảnh riêng trên từng `hasVariant`, trong khi nhóm sản phẩm có ảnh. Đây là quan sát dữ liệu để kiểm tra khi nghiệm thu GMC, **không phải bằng chứng Google đã từ chối sản phẩm**. Chưa thay đổi điều kiện xuất bản của shop hoặc tự tạo mã GTIN/MPN.
- Các lần HEAD/GET ảnh với User-Agent mặc định `Python-urllib` nhận HTTP 403, nội dung `error code: 1010`, phía Cloudflare; cùng ảnh qua GET kiểu trình duyệt và origin hoạt động. **Không kết luận ảnh bị hỏng hoặc Googlebot bị chặn** từ việc công cụ kiểm tra bị chặn. Cần kết quả thu thập thật trong GMC nếu Google báo lỗi ảnh.
- `GET /v3/api-docs` trên backend VPS trả 404; việc thống kê 148 đường dẫn là từ OpenAPI trong repo, không phải OpenAPI sinh trực tiếp từ production. Bản chạy được kiểm tra bổ sung bằng manifest và JAR.
- `https://bigbike.vn/api/v1/products` trả 404; kiểm chứng dữ liệu dùng cổng backend nội bộ VPS. Không coi đường API đặt nhầm trên domain web là lỗi của website.

### Các lệnh đọc có thể dùng để đối chiếu

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
docker exec bigbike-web node -e 'const fs=require("fs"); const d=JSON.parse(fs.readFileSync("/app/.next/server/app-paths-manifest.json","utf8")); console.log(Object.keys(d).filter(x=>/merchant|shopping|gmc|feed|sitemap|robots/i.test(x)));'
docker exec bigbike-postgres psql -X -U bigbike -d bigbike -v ON_ERROR_STOP=1 -c "BEGIN TRANSACTION READ ONLY; SELECT publish_status, discontinued, COUNT(*) FROM products GROUP BY publish_status, discontinued ORDER BY publish_status, discontinued; SELECT setting_key, setting_group FROM site_settings WHERE setting_key ~* '(merchant|shopping|gmc|feed)' ORDER BY setting_key; COMMIT;"
```

JAR được đọc bằng `docker exec bigbike-backend cat /app/app.jar` vào bộ nhớ công cụ, sau đó đọc danh sách/class trong ZIP; không chạy hoặc ghi đè JAR. Nginx được đọc tại `/etc/nginx/sites-enabled/`, cấu hình cron tại `/etc/cron.d`, `/etc/crontab`, `/var/spool/cron/crontabs`; không sửa các file này.

## Phần chưa xác minh và bước hoàn tất vận hành

- **Not run:** đăng nhập GMC, kiểm tra quyền sở hữu `bigbike.vn`, nguồn đang hoạt động, lần lấy dữ liệu gần nhất, danh sách sản phẩm/biến thể và lỗi duyệt. Không có phiên đăng nhập/công cụ GMC trong phiên làm việc này. Đã hỏi owner nguồn hiện tại, chưa nhận thông tin về nguồn.
- **Not run:** tạo/xuất bản thử một sản phẩm rồi chờ xuất hiện trong GMC; đây là thao tác ghi trên hệ thống bán hàng và cần quyền xem GMC. Phiên này chỉ đọc trạng thái thật và đối chiếu luồng code.
- **Not run:** kiểm tra schema toàn bộ 185 sản phẩm, Google Rich Results Test và crawl từ hạ tầng Google thật; ba mẫu không thay thế kiểm định toàn catalog.
- **Not run:** lint, build, unit/E2E suite; không thay đổi mã ứng dụng hoặc bài kiểm thử, không cần build/deploy để kiểm tra hiện trạng này.

Trình tự phù hợp để đạt mục tiêu không nhập tay từng sản phẩm:

1. Xem **GMC → Settings → Data sources → Found by Google** hoặc nguồn tệp/API hiện có. Đối chiếu một SKU mới ở trên cùng thời điểm lấy dữ liệu và trạng thái sản phẩm.
2. Nếu nguồn tự động từ website đang hoạt động và nhận đúng hàng mới, admin có thể quản lý sản phẩm ở BigBike và để Google lấy lại theo lịch. Vẫn cần theo dõi sản phẩm bị từ chối hoặc lỗi tài khoản; xuất bản BigBike không bảo đảm duyệt GMC.
3. Nếu chưa có nguồn phù hợp, có thể cấu hình nguồn tự động từ website sau khi kiểm định dữ liệu; hoặc bổ sung feed sản phẩm do BigBike sinh và đăng ký URL một lần trong GMC. Với cách dùng feed, hệ thống sinh dữ liệu và GMC lấy định kỳ, nhân viên không tải file/nhập lại từng sản phẩm.
4. Nếu cần gửi thay đổi ngay sau thao tác admin, xem xét Merchant API kèm theo dõi kết quả/thử lại. Đây là khả năng chưa có, không được mô tả là đã triển khai.

Theo [Google — tự thêm sản phẩm từ website](https://support.google.com/merchants/answer/12158480?hl=en), nguồn tự động cần dữ liệu có cấu trúc, quyền thu thập và website đã được xác minh/claim; trạng thái nguồn xem ở Found by Google. Tài liệu hiện hành nêu kiểm tra website ít nhất một lần mỗi 24 giờ, không bảo đảm xuất hiện ngay sau khi admin bấm xuất bản.

Theo [Google — thêm sản phẩm từ tệp](https://support.google.com/merchants/answer/12158380?hl=en), GMC có thể lấy tệp từ URL định kỳ; mặc định mỗi 24 giờ và cho phép chỉnh lịch. Upload file thủ công không tự đồng bộ khi dữ liệu thay đổi.

[Google — dữ liệu có cấu trúc](https://support.google.com/merchants/answer/6069143?hl=en) phân biệt nguồn sản phẩm dựng từ website với tính năng tự sửa giá/tình trạng của sản phẩm đã có; không dùng việc tự sửa thông tin để khẳng định sản phẩm mới đã được nhập.
