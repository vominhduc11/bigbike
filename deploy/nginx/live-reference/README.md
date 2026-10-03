# Bản sao cấu hình nginx đang chạy thật (chụp 2026-09-12)

Đây **không** phải file để triển khai — chỉ để đối chiếu. Bản gốc vận hành luôn nằm ở
`/etc/nginx/sites-available/` trên máy chủ. Trước thay đổi 2026-09-12, bản repo lệch
bản live 121 dòng ở `api.bigbike.vn` và 102 dòng ở `admin.bigbike.vn`; vì vậy mọi
thay đổi production phải lấy bản live làm gốc, không copy đè từ repo.

Chụp lại sau khi thêm vào bản live:
- `admin.bigbike.vn`: `location /ws` (WebSocket — trước đó `location /` đặt
  `Connection ""` làm hỏng handshake, nên chuông báo đơn chưa bao giờ chạy trên production)
- `bigbike.vn.nextjs`, `admin.bigbike.vn`, `api.bigbike.vn`: `error_page 502 503 504`
  trỏ tới trang xin lỗi tĩnh, **không** bật `proxy_intercept_errors` để không nuốt
  mất phản hồi lỗi hợp lệ của ứng dụng.
- `api.bigbike.vn`: trả `404` cho toàn bộ `/api/v1/admin/**` và `/api/v1/auth/**`,
  gồm cả khai báo riêng cũ của `/api/v1/admin/media`.
- `admin.bigbike.vn`: trong `/api` chỉ chuyển tiếp năm nhóm đã duyệt; các đường API
  khác trả `404`. `/`, `/ws`, `/media/`, `/media-proxy/` và `/wp/` giữ nguyên.
- `admin.bigbike.vn`: giới hạn HTTP/API 30 yêu cầu/giây, burst 30; `/ws` được miễn.
- `admin.bigbike.vn` (13/09/2026): truyền trực tiếp toàn bộ request/response proxy,
  không ghi tệp JSON, ảnh lớn hoặc asset vào vùng đệm đĩa của host. Chốt này ngăn
  lỗi quyền thư mục tạm tái diễn thành `500` khi nhập JSON hoặc ảnh `200` bị cắt dở.
- `media.bigbike.vn`: bản nguyên trạng trước khi siết cửa ảnh; chỉ file trong thư mục
  `live-reference/` được coi là ảnh chụp byte-for-byte của production tại thời điểm này.

File trong `deploy/nginx/` là ứng viên triển khai và có thể khác mốc live khi đang chờ
owner kích hoạt; trạng thái chờ phải được ghi rõ trong `DEPLOYMENT_GUIDE.md`. Sau khi
production đã qua kiểm tra, chụp lại file active vào thư mục này. Trước lần thay đổi
tiếp theo luôn chạy: `diff live-reference/<host> /etc/nginx/sites-available/<host>`.
