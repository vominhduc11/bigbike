# Phiếu duyệt tên màu sản phẩm

> Chỉ dùng sau khi chạy truy vấn chỉ-đọc `docs/audits/queries/PRODUCT_COLOR_REVIEW_READ_ONLY.sql` trên production. Phiếu này không tự cập nhật dữ liệu.

| Mã/giá trị hiện tại | Sản phẩm đang dùng | Nhãn nguồn | Trạng thái sản phẩm | Tên Việt đề xuất | Quyết định của chủ shop | Ghi chú |
|---|---|---|---|---|---|---|
| _Dán kết quả truy vấn_ |  |  |  |  | Chờ duyệt |  |

## Nguyên tắc bàn giao

- Không suy đoán tên màu chỉ từ mã.
- Không sửa migration, dữ liệu production hoặc dữ liệu giả local trong lượt kiểm tra này.
- Chỉ tạo thay đổi dữ liệu ở một lượt riêng sau khi chủ shop duyệt từng dòng.
