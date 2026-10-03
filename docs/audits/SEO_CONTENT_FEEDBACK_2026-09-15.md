# Xử lý phản hồi SEO cho 83 bài Tin tức — 2026-09-15

## Nguồn và phạm vi

- Owner yêu cầu xử lý đầy đủ ghi chú của team SEO tại cột G trong hai bảng:
  - [Đăng 69 bài Blog — tab Keyword Cannibalization](https://docs.google.com/spreadsheets/d/1kLd-sDHVxdlWyBwOVDHhR4N5oxnokAgnD7ZyBu-Po3E/edit?gid=1387066112#gid=1387066112).
  - [16 bài cần bổ sung hình ảnh — tab 16 Url](https://docs.google.com/spreadsheets/d/16nKogveaepfyuE7AN3gxthtSIlyiIA7fD9Hii3VcRUQ/edit?gid=1259840797#gid=1259840797).
- Bảng thứ nhất có 67 dòng cần xử lý nội dung sau khi loại đúng hai dòng cột G ghi `redirect` và `#N/A`; bảng thứ hai có 16/16 dòng cần xử lý. Tổng phạm vi là **83 bài**.
- File Word ở cột nguồn được tải mới trong phiên và dùng làm chuẩn cho chữ, heading, chữ nhấn mạnh, danh sách, bảng, liên kết, ảnh và caption. Snapshot nguồn cùng SHA-256 nằm tại `/root/exports/bigbike-seo-feedback-20260915/source-manifest.json`; bản bài trước cập nhật nằm tại `before-api.json`.

## Căn cứ canonical

- `docs/business/MODULE_CATALOG.md`: Content admin quản lý bài Tin tức và dùng quyền `content.read` / `content.update`.
- `docs/business/BUSINESS_RULES.md`: `ARTICLE_RULE_001`–`003` cho nội dung tiếng Việt, fallback tiếng Anh và URL bài; `MEDIA_RULE_003` cho ảnh nhúng thuộc kho nội bộ; `MEDIA_RULE_006` cho xử lý ảnh khi tải lên.
- `docs/engineering/API_CONTRACT.md`: Article Content Contract và mục Article body blocks — gửi `bodyBlocks` để hệ thống đồng bộ lại HTML `body`; Media Library cho tải và tái sử dụng ảnh.
- `docs/engineering/PERMISSION_MATRIX.md`: cập nhật bài dùng `content.update`, đọc/tải ảnh dùng `media.read` / `media.write`.
- Đây là cập nhật dữ liệu biên tập theo nguồn đã được owner giao. Không đổi quy tắc kinh doanh, hợp đồng API, quyền hoặc cấu hình triển khai.

## Kết quả thực hiện

Đã cập nhật và xác minh **83/83 bài**, gồm **67 bài** ở bảng thứ nhất và **16 bài** ở bảng thứ hai.

- Định dạng lại đầy đủ nội dung theo file nguồn; bảo toàn **3.582** thẻ chữ nhấn mạnh.
- Khôi phục **601 ảnh trong thân bài** và gắn đủ **601 caption ảnh**.
- Định dạng **102 bảng** và gắn đủ **102 caption bảng**. Hai bảng không có caption trong file nguồn được đặt tên theo đúng nội dung bảng:
  - `Bảng so sánh chất liệu găng tay moto`.
  - `Bảng các hạng mục truyền động và phanh cần kiểm tra sau khi đi mưa`.
- Khôi phục **446 lượt liên kết nội bộ**, tương ứng **181 URL riêng biệt**; tất cả kết thúc ở trang BigBike trả HTTP 200. Chuẩn hóa 263 lượt liên kết về HTTPS/URL đích trực tiếp và bỏ mã theo dõi. Ba đích nguồn đã hỏng được đổi sang bài hiện hành có bằng chứng runtime.
- Đổi đúng một ảnh đại diện theo phản hồi ở bài `tai-nghe-scs-s9x-bluetooth`; các ảnh đại diện còn lại được giữ nguyên. Bài `quan-ao-di-phuot` đã có đúng ảnh nguồn và ảnh tải thành công nên không tạo bản trùng.
- Hai yêu cầu kích thước ảnh 750 px đã được áp dụng đúng: ba ảnh cuối bài `giay-scoyco` và ảnh nguồn số 4–6 của bài `tat-tan-tat-ve-do-da-bao-ho-ma-biker-nao-cung-nen-biet`.
- Kiểm riêng toàn bộ ghi chú đặc biệt: 4 heading đúng cấp và in đậm; bỏ số khỏi 20 H3; giữ chữ in đậm trước dấu `:` tại 9 nhóm nội dung; bổ sung địa chỉ và số điện thoại trong 5 bài; khôi phục ảnh/link tại 12 bài bị báo lỗi; sửa phần lịch trình đi trong ngày theo file nguồn.
- Trình hiển thị nội dung dùng chung đã bổ sung kiểu caption theo design system: cỡ chữ meta, căn giữa, in nghiêng, màu phụ và ảnh nằm giữa khung bài.

## Kho ảnh

- Có **602 tệp nguồn duy nhất** cần dùng: 601 ảnh thân bài và một ảnh đại diện mới.
- Tái sử dụng 444 tệp đã có trong kho; tải 158 tệp còn thiếu qua Media API.
- Phát hiện 10 bản ghi ảnh cũ còn metadata nhưng mất object trong MinIO. Đã tải lại qua Media API bằng bản giữ nguyên từng pixel, sau đó trỏ nội dung tới object mới; không sửa database trực tiếp.
- **602/602 tệp** trả HTTP 200, đúng MIME, kích thước và checksum mong đợi. Kết quả ở `/root/exports/bigbike-seo-feedback-20260915/media-checks.json` và `repaired-media.json`.

## Bảo toàn dữ liệu ngoài phạm vi

- Giữ nguyên ID, slug/URL, ngày đăng, trạng thái `PUBLISHED`, metadata SEO, bản tiếng Anh, tác giả và các cờ hiển thị của 83 bài.
- Chỉ thay `bodyBlocks`/`body` cho 83 bài và ảnh đại diện của đúng một bài có yêu cầu.
- Đối chiếu lại sau toàn bộ lượt kiểm tra xác nhận 83/83 bản ghi không có cập nhật xen vào và vẫn khớp payload đã duyệt.

## Kiểm chứng

| Hạng mục | Kết quả |
| --- | --- |
| Chuyển đổi và kiểm ghi chú cột G | 83/83 đạt; 67 + 16, không thiếu dòng |
| Xem trước qua luồng quản trị | 83/83 đạt |
| Đọc lại quản trị và API công khai sau lưu | 83/83 đạt |
| HTML tại `https://bigbike.vn/tin-tuc/{slug}/` | 83/83 trả 200 và khớp số ảnh, caption, bảng, link, heading, danh sách, chữ nhấn mạnh |
| Ảnh nguồn/kho ảnh | 602/602 đạt |
| Liên kết nội bộ | 181/181 URL đạt; 446/446 lượt có `href` hợp lệ |
| Trình duyệt Chromium | **249/249 đạt**: 83 bài × 375×812, 768×1024, 1440×900 |
| Vệ sinh mã nguồn web | ESLint, Prettier, kiểm chữ lỗi mã hóa và guard dữ liệu runtime đều đạt |

Kiểm tra trình duyệt xác nhận mỗi bài có đúng một H1; đúng số ảnh, caption, bảng, liên kết, heading, danh sách và chữ nhấn mạnh; ảnh có URL/alt; ảnh đại diện tải thật; caption hiển thị đúng kiểu; ảnh và bảng không làm tràn ngang. Toàn bộ ảnh thân bài đã được kiểm tra tải thật ở lượt điện thoại, đồng thời 602 tệp được kiểm riêng bằng HTTP/MIME/checksum nên hai kích thước còn lại không tải lặp lại toàn bộ tệp.

Ba thumbnail của khối “bài liên quan” báo 400 chỉ trên server Next.js chạy thử vì không có ánh xạ media legacy của môi trường Docker. Chúng nằm ngoài nội dung 83 bài; cả ba URL tương ứng trên website công khai đều trả 200. Bộ kiểm tra chỉ loại đúng ba lỗi môi trường này và vẫn chặn mọi lỗi ảnh của bài đang kiểm.

## Bằng chứng lưu cục bộ

Thư mục `/root/exports/bigbike-seo-feedback-20260915/`:

- `source-rows.json`, `source-manifest.json`, `sources/`: dữ liệu hai sheet và 83 file nguồn.
- `doi-chieu-83-bai.csv`: bảng 83 dòng để team SEO rà theo bài, URL, ghi chú cột G và số lượng nội dung đã đăng.
- `prepared.json`, `prepared-validation.json`: nội dung chuyển đổi và kiểm từng ghi chú đặc biệt.
- `before-api.json`, `payloads.json`, `previews.json`, `applied.json`: bản trước, payload, xem trước và kết quả đọc lại.
- `media-resolved.json`, `media-checks.json`, `repaired-media.json`: đối chiếu kho ảnh.
- `internal-link-checks.json`: đối chiếu link ở môi trường local và website công khai.
- `verification/public-html-checks.json`: đối chiếu 83 HTML công khai.
- `verification/browser-summary.json`, `browser-results-*-run.json`, `screenshots/`: kết quả 249 lượt trình duyệt và ảnh chụp đại diện.
- `completion-summary.json`: tổng hợp kết quả cuối cùng của toàn bộ đợt xử lý.

## Thao tác runtime

- Xác nhận trạng thái stack bằng `docker compose ps`; mọi service cần dùng đều đang chạy và khỏe.
- Đọc bài qua API quản trị và công khai của `bigbike-backend`; xem trước trước khi ghi.
- Tải ảnh qua Media API, sau đó cập nhật bài qua Content API; không ghi SQL trực tiếp.
- Không khởi động lại, dựng lại hoặc thay container dùng chung.
