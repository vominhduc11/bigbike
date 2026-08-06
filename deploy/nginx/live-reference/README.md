# Bản SAO CHÉP cấu hình nginx đang chạy thật (chụp 2026-08-06)

Đây **không** phải file để triển khai — chỉ để đối chiếu. Bản đang chạy nằm ở
`/etc/nginx/sites-available/` trên máy chủ và đã lệch khỏi `deploy/nginx/*.conf`
từ lâu (bản live cũ hơn về cấu trúc nhưng lại chứa các sửa đổi vận hành thật).

Chụp lại sau khi thêm vào bản live:
- `admin.bigbike.vn`: `location /ws` (WebSocket — trước đó `location /` đặt
  `Connection ""` làm hỏng handshake, nên chuông báo đơn chưa bao giờ chạy trên production)
- `bigbike.vn.nextjs`, `admin.bigbike.vn`, `api.bigbike.vn`: `error_page 502 503 504`
  trỏ tới trang xin lỗi tĩnh, **không** bật `proxy_intercept_errors` để không nuốt
  mất phản hồi lỗi hợp lệ của ứng dụng.

Trước khi đụng nginx production: `diff live-reference/<host> /etc/nginx/sites-available/<host>`
