# Kiểm tra ảnh nguồn Google Merchant — 31/10/2026

## Phạm vi và bằng chứng

- Đọc nguồn công khai `https://bigbike.vn/google-merchant.xml`: HTTP 200, 1.187 dòng. Không truy cập tài khoản GMC; số dòng không thể hiện số Google chấp nhận hay duyệt.
- Kiểm tra stack tại môi trường làm việc bằng `docker ps`; đọc dữ liệu bằng `docker exec bigbike-postgres ... psql` với các câu SELECT trên `product_variants`, `product_variant_gallery_images`; đọc chi tiết qua `GET http://127.0.0.1:8080/api/v1/products/ao-bao-ho-taichi-rsj335-quick-dry-parka?lang=vi`. Không ghi dữ liệu, không khởi động lại container. Không suy diễn đây là kết quả kiểm tra đã triển khai mã nguồn mới trên VPS.
- Trong dữ liệu đang chạy, cả tám SKU RSJ335 theo hai màu và bốn cỡ có ảnh đại diện màu 50 × 50. Với `RSJ335-DEN-XL`, XML công khai chọn đúng URL ảnh 50 × 50 làm ảnh chính; dải ảnh riêng màu đen chứa hai ảnh 1.176 × 1.176. Dải màu xanh rêu có ảnh riêng 1.176 × 1.176. Dải ảnh lớn có thể chứa chữ/logo phủ, chưa được xác minh phù hợp chính sách Google.
- Admin lưu ảnh đại diện và gallery tách biệt theo màu, cùng màu dùng chung giữa các cỡ (`DATA_CONTRACT.md` §Variant color representation image; `API_CONTRACT.md` §Variant color representation image). Trang sản phẩm dùng gallery màu nếu có ảnh, tiếp đó gallery sản phẩm; ảnh đại diện chỉ dùng khi gallery không có ảnh. Nguồn Merchant chọn ảnh đại diện trước gallery (`bigbike-web/lib/merchant/feed.ts`). Ảnh đại diện quá nhỏ cộng với thứ tự ưu tiên này gây ra sự khác biệt.
- Dữ liệu sản phẩm chi tiết của 213 slug trong feed đã đọc thành công ở backend môi trường làm việc. Đối chiếu thông số ảnh chính trong dữ liệu cho 1.187 dòng: 69 dòng có cạnh nhỏ dưới 100 px, 16 dòng từ 100 đến dưới 250 px, 18 dòng từ 250 đến dưới 500 px, 479 dòng có hai cạnh từ 500 px; 605 dòng không có thông số đầy đủ. Đây là số theo metadata backend, không phải kết luận về tình trạng duyệt hoặc nội dung ảnh.

- Kiểm tra trực tiếp tối đa 256 KiB đầu của 344 URL ảnh chính công khai: 69 dòng có cạnh dưới 100 px, 16 dòng từ 100 đến dưới 250 px, 18 dòng từ 250 đến dưới 500 px, 929 dòng có hai cạnh từ 500 px; 155 dòng (39 URL) chưa đọc được kích thước bằng phương pháp này. Từng mức là số dòng, không phải số sản phẩm. Nhóm 100–249 px chỉ vi phạm ngưỡng hiện hành nếu thuộc loại quần áo; nội dung và trạng thái duyệt của toàn bộ ảnh chưa kiểm chứng.

## Chính sách và bước tiếp theo

[Google — ảnh quá nhỏ](https://support.google.com/merchants/answer/12159030?hl=en): trước 31/01/2027 ảnh quần áo tối thiểu 250 × 250, các nhóm khác tối thiểu 100 × 100; từ 31/01/2027 tối thiểu 500 × 500 cho mọi sản phẩm. Không phóng to ảnh thumbnail để đối phó. [Google — image link](https://support.google.com/merchants/answer/6324350?hl=en) yêu cầu ảnh không có lớp chữ/quảng cáo/logo phủ và thể hiện đúng biến thể; cần kiểm từng ảnh, kích thước không xác nhận nội dung đạt chuẩn.

Cần chủ shop cung cấp hoặc xác định ảnh gốc đúng từng màu, không có chữ/logo phủ, và quyết định cách xử lý các dòng thiếu ảnh phù hợp. `GMC_RULE_003` hiện quy định ảnh biến thể nếu có, nếu không dùng ảnh sản phẩm; `GMC_RULE_005` yêu cầu không trả feed thành công thiếu hàng khi lỗi dữ liệu. Không tự chuyển sang gallery có watermark, loại dòng hoặc làm toàn feed lỗi khi chưa có quyết định và contract sửa trước. Chưa sửa mã hoặc dữ liệu hệ thống, chưa triển khai, chưa yêu cầu Google lấy lại nguồn.

## Sửa tại môi trường làm việc sau yêu cầu owner

Owner xác nhận ảnh gốc của shop vẫn có logo và sau khi được giải thích rủi ro đã yêu cầu sửa lỗi ảnh nhỏ. Đã cập nhật `GMC_RULE_003` (ngoại lệ ngày 31/10), `DATA_CONTRACT.md`, `API_CONTRACT.md` trước khi sửa web: ảnh đại diện biến thể có metadata hai cạnh dương và một cạnh dưới 500 px được thay bằng ảnh đầu tiên có metadata hai cạnh từ 500 px trong gallery riêng của cùng màu, nếu có. Giữ nguyên lựa chọn hiện hữu khi thiếu ảnh hoặc thông số; không thay ảnh trong hệ thống đang chạy. Ảnh logo phủ chưa được xác nhận đạt chuẩn Google.

Dựng XML thử bằng mã nguồn mới và dữ liệu chi tiết đọc từ backend môi trường làm việc: 213 sản phẩm, 1.187 SKU. So với snapshot XML công khai đã lấy trong lượt kiểm: không thêm/mất SKU, 74 ảnh chính đổi, không đổi các trường khác ngoài ảnh; 17 URL ảnh mới đều đọc được kích thước thật tối thiểu 500 × 500 cho toàn bộ 74 dòng. Riêng `RSJ335-DEN-XL` chuyển từ ảnh 50 × 50 sang ảnh trong gallery màu đen 1.176 × 1.176. Gallery phân theo màu trong dữ liệu, nhưng chưa kiểm duyệt trực quan toàn bộ 74 ảnh, chưa xác nhận nội dung hay Google phê duyệt. So sánh phụ thuộc hai snapshot đọc tại thời điểm khác nhau.

Kiểm thử `npx vitest run __tests__/merchant/feed.test.ts __tests__/merchant/route.test.ts`: 12/12; ESLint và Prettier trên hai tệp mã/kiểm thử đạt. Chưa triển khai VPS, chưa kiểm XML public sau triển khai, chưa truy cập GMC. Những dòng không đổi có thể vẫn quá nhỏ hoặc thiếu thông tin; cần tiếp tục rà soát ảnh và chủ shop xem tình trạng sau khi triển khai.
