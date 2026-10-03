# Khôi phục 16 bài blog theo file team bổ sung — 2026-09-14

## Nguồn và phạm vi

- Owner yêu cầu đọc sheet và bổ sung đầy đủ cho đúng nhóm 16 bài đã chờ 52 ảnh trong thân bài.
- Owner xác nhận trong phiên: “khi có đủ ảnh thì đăng lại 16 bài luôn, hiện tại 16 bài này cả chữ và ảnh là cũ”. Phạm vi được chốt là cập nhật toàn bộ bản tiếng Việt từ file nguồn, gồm tiêu đề, nội dung, ảnh và metadata SEO; giữ nguyên ID/URL và trạng thái bài hiện có.
- Nguồn: [Content - Bigbike, tab 16 Url](https://docs.google.com/spreadsheets/d/16nKogveaepfyuE7AN3gxthtSIlyiIA7fD9Hii3VcRUQ/edit?gid=1259840797#gid=1259840797), hàng 2–17; cột C xác định bài, cột E là file Word nguồn. Cột D ghi tổng cộng 52 ảnh cần bổ sung; dấu hoàn thành cột F chỉ là trạng thái biên tập của nguồn.
- Đã tải đủ 16 DOCX ở cột E. Bản nguồn hiện có 102 ảnh trong thân bài và 16 thumbnail; không còn dòng báo thiếu ảnh. Mọi ảnh nhúng đều giải mã được. Chuyển DOCX sang nội dung web bảo toàn toàn bộ chữ, liên kết, bảng, danh sách và số ảnh; không có cảnh báo chuyển đổi.
- Nội dung nguồn được chuẩn bị tại `/root/exports/bigbike-blog16-restore-20260914/`; `manifest.json` lưu đường dẫn nguồn, SHA-256, ảnh và số phần tử để đối chiếu. `before-api.json` lưu bản 16 bài trước cập nhật.

## Căn cứ canonical

- `docs/business/BUSINESS_RULES.md`: `ARTICLE_RULE_001/002` (nội dung tiếng Việt và bản tiếng Anh), `ARTICLE_RULE_003` (giữ URL bài), `MEDIA_RULE_003/006` (ảnh nội bộ và xử lý ảnh khi tải lên).
- `docs/engineering/API_CONTRACT.md`: Article / Page body blocks — cập nhật đồng thời `bodyBlocks` và `body`; Media Library — tải ảnh qua API quản trị và tái sử dụng ảnh trùng checksum.
- `docs/engineering/PERMISSION_MATRIX.md`: Content dùng `content.read/update`, Media dùng `media.read/write`.
- Đây là cập nhật nội dung biên tập theo nguồn owner cung cấp; không đổi quy tắc kinh doanh, API hay cấu hình triển khai.
- `TRANSLATION_RULE_002` yêu cầu tiêu đề EN khi cập nhật tiêu đề VI. Chỉ bổ sung bản dịch tiêu đề cho 11 bài chưa có; giữ nguyên các bản dịch đã có và mọi trường EN khác.

## Trạng thái thực hiện

Đã cập nhật và đăng đủ **16/16 bài** bằng bản nguồn mới: tiêu đề, toàn bộ thân bài, metadata SEO, **102 ảnh nội dung và 16 ảnh đại diện**. Giữ nguyên ID, slug/URL, ngày đăng, trạng thái `PUBLISHED` và các cờ hiển thị hiện có.

### Kết quả đối chiếu

- 16/16 bản xem trước bảo toàn chữ, liên kết, bảng, danh sách, định dạng nhấn mạnh và ảnh so với HTML chuyển từ DOCX.
- 118/118 ảnh nguồn đã được tải vào kho nội bộ qua API; URL ảnh công khai trả HTTP 200 và đúng định dạng ảnh.
- 16/16 lần cập nhật thành công; đọc lại API công khai và quản trị khớp dữ liệu đã chuẩn bị.
- 16/16 URL trong sheet mở được bản mới trên `https://bigbike.vn`. Chữ, tiêu đề và metadata SEO khớp nguồn; số ảnh, bảng, danh sách và liên kết được bảo toàn. Khi so sánh đã tính đến chuẩn hóa khoảng trắng, HTTP thành HTTPS và dấu `/` cuối liên kết nội bộ của website.
- So sánh bản ghi trước/sau theo ID xác nhận chỉ đổi các trường nội dung, ảnh, SEO, 11 tiêu đề EN bắt buộc còn thiếu và thông tin cập nhật. Không thay đổi ngày đăng, URL hay trường nghiệp vụ ngoài phạm vi. Số phiên bản tăng từ 0 lên 2 sau luồng cập nhật và sắp xếp ảnh của hệ thống.
- **48/48 lượt kiểm tra trình duyệt Chromium đạt**: 16 bài × điện thoại 375×812, máy tính bảng 768×1024 và máy tính 1440×900. Tổng cộng 354 lượt ảnh tải thành công; mọi ảnh có địa chỉ và mô tả, không tràn ngang màn hình; đủ bảng và không còn thông báo thiếu ảnh. Đã xem trực tiếp ảnh chụp giao diện điện thoại và máy tính. Phạm vi trình duyệt là Chromium, chưa chạy Safari/Firefox.

### Bằng chứng lưu cục bộ

Thư mục `/root/exports/bigbike-blog16-restore-20260914/`:

- `16-bai-blog-day-du-20260914.zip`: toàn bộ 16 file Word nguồn có đủ ảnh.
- `doi-chieu-16-bai.csv`, `manifest.json`: danh sách nguồn và số lượng ảnh của từng bài.
- `before-api.json`, `before-db.json`: bản nội dung trước khi cập nhật.
- `payloads.json`, `previews.json`, `applied.json`: nội dung gửi lên, xem trước và kết quả đọc lại.
- `uploaded-media.json`, `media-checks.json`: đối chiếu ảnh đã tải và khả năng truy cập công khai.
- `after-db.json`, `database-diff-checks.json`, `public-html-checks.json`: dữ liệu sau cập nhật, phạm vi thay đổi và kết quả đối chiếu website.
- `verification/`: bản lưu các kịch bản kiểm tra công khai và trình duyệt; không chứa thông tin đăng nhập.
- `browser-results.json`, `browser-evidence.jsonl`, `visual-mobile.png`, `visual-desktop.png`, `article-*.png`: kết quả 48 lượt kiểm tra và ảnh chụp giao diện.
- `completion-summary.json`: tổng hợp hoàn tất, 16 bài và 118 ảnh.

### Ghi nhận ngoài phạm vi nội dung

Website chặn script thống kê Cloudflare bởi chính sách tải script. Lỗi này cũng xuất hiện trên trang chủ không thuộc phạm vi cập nhật (`homepage-console-baseline.json`); không ảnh hưởng việc tải chữ và ảnh của 16 bài. Kiểm tra trình duyệt lưu riêng cảnh báo này, vẫn chặn các lỗi khác. Không sửa cấu hình website trong đợt cập nhật nội dung này.

Trình duyệt còn ghi nhận cảnh báo Meta Pixel về định dạng tham số tiền tệ. Cảnh báo được lưu trong bằng chứng kiểm tra, không làm thay đổi kết quả tải nội dung và ảnh.

## Thao tác runtime

- Xác nhận container bằng `docker ps`.
- Đọc bài qua `GET /api/v1/articles/{slug}` trên `bigbike-backend` cổng 8080 và `GET /api/v1/admin/content/article/{id}`.
- Tải ảnh bằng `POST /api/v1/admin/media`, tuần tự theo giới hạn 30 ảnh/phút; không ghi SQL trực tiếp, không khởi động lại container.
- Xem trước bằng `POST /api/v1/admin/content/articles/preview`, sau đó cập nhật qua `PATCH /api/v1/admin/content/articles/{id}` trên `bigbike-backend` cổng 8080. Lưu `bodyBlocks` để hệ thống đồng bộ `body`.
- Ảnh nhúng dùng địa chỉ tuyệt đối từ cấu hình `BIGBIKE_MEDIA_PUBLIC_BASE_URL` của `bigbike-backend`, đã xác minh bằng `docker exec bigbike-backend printenv BIGBIKE_MEDIA_PUBLIC_BASE_URL`; xem trước xác nhận mọi `src` được giữ lại. Không đổi cấu hình.
- Đọc bảng `articles` trên `bigbike-postgres` bằng `docker exec … psql … SELECT` để đối chiếu 16 ID trước/sau; chỉ thao tác đọc.
- Kiểm tra HTML công khai: `/tmp/bigbike-blog16-env/bin/python /tmp/bigbike-blog16-public-check.py`.
- Kiểm tra trình duyệt: `node bigbike-web/node_modules/@playwright/test/cli.js test --config=/tmp/bigbike-blog16.playwright.config.ts`.
- Không thay đổi mã ứng dụng; không chạy lại toàn bộ CI vì đây là cập nhật dữ liệu biên tập qua chức năng quản trị hiện có.

## Danh sách 16 bài đã đăng

| STT | Bài viết | Ảnh nội dung | Ảnh đại diện |
|---|---|---:|---:|
| 1 | [Top 7 mẫu găng tay Taichi chính hãng tại Shop bảo hộ Bigbike.vn](https://bigbike.vn/tin-tuc/gang-tay-moto-taichi-chinh-hang/) | 7 | 1 |
| 2 | [Top 13 các hang động nổi tiếng ở Việt Nam đáng khám phá](https://bigbike.vn/tin-tuc/cac-hang-dong-noi-tieng-o-viet-nam/) | 14 | 1 |
| 3 | [Mũ bảo hiểm dual sport: 7 tiêu chí chọn đúng khi đi phượt, đi tour](https://bigbike.vn/tin-tuc/mu-bao-hiem-dual-sport-ls2-phuot-moto/) | 5 | 1 |
| 4 | [Áo Giáp Moto Nữ - Cách Chọn Phù Hợp Khi Đi Phố Và Đi Tour](https://bigbike.vn/tin-tuc/quan-ao-giap-bao-ho-nu/) | 5 | 1 |
| 5 | [Xe tay ga nào đi phượt tốt nhất? 5 lựa chọn theo cung đường](https://bigbike.vn/tin-tuc/xe-tay-ga-nao-di-phuot-tot-nhat/) | 9 | 1 |
| 6 | [Vì sao giáp bảo vệ đầu gối quan trọng khi đi xe máy, đi phượt?](https://bigbike.vn/tin-tuc/vi-sao-giap-bao-ve-goi-lai-quan-trong-nhu-vay/) | 4 | 1 |
| 7 | [Tai nghe Bluetooth Sena cho mũ fullface - 5 tiêu chí nên kiểm tra](https://bigbike.vn/tin-tuc/tai-nghe-bluetooth-scs-sena-fullface/) | 5 | 1 |
| 8 | [9 cách tránh ma khi đi đêm giúp biker vững tâm và an toàn hơn](https://bigbike.vn/tin-tuc/cach-tranh-ma-khi-di-dem/) | 5 | 1 |
| 9 | [Đồ bảo hộ da cho biker - Cách chọn đúng theo hành trình](https://bigbike.vn/tin-tuc/tat-tan-tat-ve-do-da-bao-ho-ma-biker-nao-cung-nen-biet/) | 6 | 1 |
| 10 | [Top 7 mũ bảo hiểm phượt cho nữ đáng cân nhắc tại Bigbike](https://bigbike.vn/tin-tuc/mu-bao-hiem-phuot-cho-nu/) | 5 | 1 |
| 11 | [Top 15 dụng cụ cắm trại dã ngoại nên chuẩn bị trước chuyến đi](https://bigbike.vn/tin-tuc/dung-cu-cam-trai-da-ngoai/) | 7 | 1 |
| 12 | [Găng tay chống nắng - Cách chọn đúng cho người đi xe máy, moto](https://bigbike.vn/tin-tuc/gang-tay-chong-nang/) | 5 | 1 |
| 13 | [Top 6 găng tay chống nước đi xe máy đáng cân nhắc khi đi mưa](https://bigbike.vn/tin-tuc/gang-tay-chong-nuoc-di-xe-may/) | 7 | 1 |
| 14 | [Top 9 mẫu giày đi phượt chống nước cực bền cho dân phượt](https://bigbike.vn/tin-tuc/giay-di-phuot/) | 7 | 1 |
| 15 | [Khám phá 6 tiêu chí vàng khi chọn kính đi phượt cho biker](https://bigbike.vn/tin-tuc/kinh-di-phuot/) | 5 | 1 |
| 16 | [Tai nghe gắn mũ bảo hiểm - Cách chọn phù hợp khi đi phố và đi tour](https://bigbike.vn/tin-tuc/tai-nghe-gan-mu-bao-hiem/) | 6 | 1 |
