# Đồng bộ SEO content từ bảng biên tập — 2026-09-11

## Phạm vi

Đồng bộ 69 bài Tin tức theo tab `Keyword Cannibalization` trong bảng `Content Blog - Bigbike.vn`:

- Cột D là URL nguồn cần còn truy cập được.
- Cột E (`Title mới`) là chuẩn cho trường tiêu đề SEO, không thay đổi tiêu đề H1 của bài.
- Cột F là tài liệu biên tập dùng để đối chiếu nội dung và ảnh.

Tính năng Tin tức/Content vẫn đang hoạt động theo `docs/business/MODULE_CATALOG.md` (mục Content management), với bài tiếng Việt có đường dẫn chuẩn `/tin-tuc/{slug}/` theo `docs/business/BUSINESS_RULES.md`, `ARTICLE_RULE_003`.

## Finding và xử lý

### F1 — Bảy tiêu đề SEO không khớp bản biên tập

- **Mức độ:** Medium.
- **Lệch ở đâu:** Bảng biên tập cột E khác trường `seo.title` đang hiển thị trên website ở 7/69 bài.
- **Căn cứ:** User chốt cột E là chuẩn trong phiên; `docs/engineering/DATA_CONTRACT.md` (Article SEO fields) phân biệt `title` bài viết và `seo.title`.
- **Hậu quả vận hành:** Google và mạng xã hội có thể nhận tiêu đề cũ/không đúng với kế hoạch SEO.
- **Đã sửa:** Cập nhật đúng 7 trường `seo.title`, đồng thời giữ nguyên mô tả, canonical, ảnh OG và cờ lập chỉ mục đang có.
- **Lưu ý:** Ô E51 được áp dụng nguyên văn là `op 12 cách chọn balo phượt chuẩn dành cho biker 2026`, theo đúng dữ liệu biên tập hiện có.

### F2 — Hai URL nguồn từng trả 404

- **Mức độ:** Medium.
- **Lệch ở đâu:** Hai URL tại cột D không còn trỏ tới bài đang xuất bản.
- **Căn cứ:** `docs/business/BUSINESS_RULES.md`, nhóm Redirect rules: URL cũ cần 301 một bước tới đích nội bộ, nguồn chuyển hướng là duy nhất.
- **Hậu quả vận hành:** Mất lượt truy cập từ kết quả tìm kiếm và liên kết cũ.
- **Đã sửa:** Tạo hai chuyển hướng 301 tới bài hiện hành; kiểm tra lại trả về trang đích 200.

### F3 — Một URL nguồn đi qua hai bước chuyển hướng

- **Mức độ:** Low.
- **Lệch ở đâu:** URL cũ LS2 FF800 đi qua URL trung gian trước khi vào bài mới.
- **Căn cứ:** `docs/business/BUSINESS_RULES.md`, nhóm Redirect rules yêu cầu một bước chuyển hướng vĩnh viễn.
- **Hậu quả vận hành:** Tăng độ trễ và làm tín hiệu SEO kém gọn.
- **Đã sửa:** Đổi đích của quy tắc hiện có trực tiếp tới `/tin-tuc/mu-bao-hiem-ls2-ff800-storm-ii/`.

### F4 — Metadata hướng dẫn còn lẫn ở đầu một số bài

- **Mức độ:** Low.
- **Lệch ở đâu:** 13 bài có phần ghi chú biên tập như từ khóa/slug gợi ý nằm trước nội dung xuất bản.
- **Căn cứ:** `docs/business/BUSINESS_RULES.md`, nhóm Article Rules quy định body là nội dung bài viết; tài liệu cột F là bản biên tập đã được user yêu cầu đồng bộ.
- **Hậu quả vận hành:** Khách và công cụ tìm kiếm có thể nhìn thấy phần ghi chú không dành cho độc giả.
- **Đã sửa:** Bỏ đúng tiền tố ghi chú; giữ nguyên phần nội dung và ảnh của bài.

### F5 — Thumbnail từ tài liệu chưa được nhập mới

- **Mức độ:** Medium.
- **Lệch ở đâu:** Ảnh bìa trên website chưa lấy theo tài liệu cột F.
- **Căn cứ chọn ảnh:** Owner chốt: lấy ảnh sau nhãn `Hình Thumbnail`; khi không có nhãn, lấy ảnh đầu tiên trước H1.
- **Hậu quả vận hành:** Thumbnail trên website có thể không phải ảnh biên tập mới nhất.
- **Đã sửa:** Tải vào kho ảnh nội bộ và gắn ảnh bìa mới cho 65/69 bài; 25 bài dùng nhãn thumbnail, 40 bài dùng ảnh đầu tiên trước H1. Toàn bộ 65 ảnh mới và 4 ảnh bìa giữ nguyên đều trả về HTTP 200.
- **Ngoại lệ minh bạch:** 4 tài liệu (hàng 25, 33, 43, 65) không có ảnh thumbnail và cũng không có ảnh nào trước H1, nên giữ ảnh bìa hiện có thay vì tự lấy ảnh trong thân bài.

## Kiểm chứng sau cập nhật

| Hạng mục | Kết quả |
| --- | --- |
| URL cột D | 69/69 kết thúc ở HTTP 200 |
| Chuỗi chuyển hướng | 69/69 tối đa một bước 301 rồi HTTP 200; không còn chuỗi nhiều bước |
| Tiêu đề SEO theo cột E | 69/69 khớp sau khi cập nhật 7 bài lệch; kiểm tra trang web xác nhận cả 7 tiêu đề mới đã hiển thị |
| Ảnh thumbnail từ tài liệu cột F | 65 ảnh đã nhập vào kho ảnh nội bộ và gắn đúng bài; 4 bài không có ảnh hợp lệ theo quy tắc chọn nên giữ ảnh bìa cũ; 69/69 URL ảnh trả HTTP 200 |

## Không thay đổi

- Không thay đổi tiêu đề H1, mô tả SEO, canonical, ảnh OG hoặc trạng thái lập chỉ mục ngoài các trường cần thiết.
- Không sửa mã nguồn, cấu hình hay dữ liệu khách hàng.
