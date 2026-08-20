# Bật báo lỗi website BigBike

Hướng dẫn này chỉ dành cho chủ shop hoặc người vận hành. Không cần tự sửa mã nguồn và không cần
tự triển khai website.

1. Tạo hoặc đăng nhập tài khoản Sentry, tạo một dự án theo dõi lỗi cho website Next.js của
   BigBike.
2. Trong phần cài đặt dự án, sao chép **DSN** (đường kết nối báo lỗi). Đây là chuỗi bắt đầu bằng
   `https://`.
3. Gửi DSN cho người triển khai qua kênh an toàn. Họ sẽ điền cùng chuỗi này vào hai dòng
   `SENTRY_DSN` và `NEXT_PUBLIC_SENTRY_DSN` của file cấu hình môi trường trên máy chủ. Không dán
   DSN vào mã nguồn, tin nhắn công khai hoặc tài liệu.
4. Trong Sentry, tạo cảnh báo email cho lỗi mới và chọn hộp thư vận hành của shop. Nên để một
   người phụ trách chính và một người dự phòng cùng nhận cảnh báo.
5. Khi người triển khai phát hành bản web tiếp theo, họ kiểm tra một sự cố thử an toàn và xác nhận
   cảnh báo đã tới hộp thư. Không tự khởi động lại máy chủ chỉ để làm bước này.

Website chỉ gửi loại lỗi, thao tác và trang xảy ra lỗi. Website không gửi mật khẩu, email, số điện
thoại, mã đơn, thông tin thanh toán hay nội dung chat. Nếu không muốn bật báo lỗi, để hai dòng DSN
trống: website vẫn hoạt động bình thường nhưng shop sẽ không nhận cảnh báo kỹ thuật.

`SENTRY_AUTH_TOKEN`, `SENTRY_ORG` và `SENTRY_PROJECT` không phải thông tin chủ shop cần điền. Chỉ
người triển khai có thể cần chúng khi chuẩn bị bản phát hành có bản đồ chẩn đoán lỗi.
