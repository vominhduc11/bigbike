# Đổi tài khoản nhận thông báo Telegram — 08/09/2026

Đã chuyển nơi nhận thông báo đơn hàng và sao lưu sang tài khoản riêng tư đã bấm
`/start` lúc **19:02:17 ngày 08/09/2026**, giờ Việt Nam, theo yêu cầu của chủ shop.
Telegram đã chấp nhận một tin thử gửi tới đúng tài khoản mới lúc **19:14:47**.

## Căn cứ và nguyên nhân

- [BUSINESS_RULES.md — NOTIFICATION_RULE_003](../business/BUSINESS_RULES.md):
  thông báo đơn mới gửi sau khi lưu đơn thành công, lỗi không làm hỏng đơn và
  không tự gửi lại.
- [DEPLOYMENT_GUIDE.md — Deployment Notes](../engineering/DEPLOYMENT_GUIDE.md):
  đổi người nhận theo quyết định của chủ shop, áp dụng cấu hình vào riêng backend
  với bản ứng dụng đang chạy.
- [INTEGRATION_GUIDE.md — Telegram new-order notification](../engineering/INTEGRATION_GUIDE.md):
  thông báo đơn hàng và sao lưu dùng chung nơi nhận trong `.env.vps`.
- Telegram ghi nhận tài khoản nhận cũ chặn bot lúc **18:23:21**. Thao tác bỏ chặn
  và `/start` lúc **19:02:17** thuộc một tài khoản khác; vì vậy cấu hình cũ tiếp tục
  nhận lỗi `http_403`, gần nhất lúc **19:05:00**.

## Thay đổi đã áp dụng

- Chỉ đổi `BIGBIKE_TELEGRAM_CHAT_ID` trong `.env.vps`, giữ nguyên bot và quyền
  truy cập file. File được Git bỏ qua; báo cáo không chứa token hay mã tài khoản.
- Trước khi áp dụng, xác minh đúng một tài khoản có sự kiện `/start` tại thời điểm
  được duyệt, trạng thái đã bỏ chặn và quyền truy cập qua Telegram `getChat`.
- So sánh cấu hình triển khai với môi trường đang chạy: không có khác biệt ngoài
  nơi nhận được yêu cầu. Giữ nguyên image backend
  `sha256:f67d2770989378cfcabaaa6806ec31cdfe5db744cffa08c882d890c15f522123`.
- Tạo lại riêng `bigbike-backend` bằng `docker-compose.yaml` và override đang dùng
  `/root/bigbike-assistant-deploy-20260908/private/release.compose.yaml`, với
  `--no-deps --no-build --pull never --force-recreate --wait --wait-timeout 180`.
- Backend bắt đầu lúc **19:11:28** và được xác nhận khỏe lúc **19:13:01**.
  Môi trường của container mới chỉ khác nơi nhận Telegram. Các container khác
  giữ nguyên ID và thời điểm khởi động.
- Tác vụ sao lưu đọc `.env.vps` mỗi lần gửi thông báo nên dùng nơi nhận mới từ
  lượt gửi tiếp theo; không cần khởi động lại dịch vụ khác.

## Kiểm tra thực tế

| Kiểm tra | Kết quả |
|---|---|
| `docker ps` trước thao tác | Backend và các dịch vụ liên quan đang chạy |
| `docker inspect bigbike-backend` sau triển khai | `healthy`; đúng nơi nhận được duyệt; giữ nguyên image |
| `docker exec bigbike-backend wget -qO- http://127.0.0.1:8080/actuator/health` | `status: UP` |
| Một lần Telegram `sendMessage`, sau khi chủ shop đồng ý gửi tin thử | HTTP 200, `ok: true`; bot và tài khoản đích khớp cấu hình mới |

Nội dung tin thử: “BigBike: Kiểm tra kết nối Telegram nhận thông báo đơn hàng và
sao lưu.” Lần kiểm tra xác nhận Telegram chấp nhận tin; không xác nhận người nhận
đã đọc. Không tạo đơn thử, gửi lại thông báo đơn cũ hoặc chạy tác vụ sao lưu thử.
Không chạy lại bộ kiểm thử mã nguồn vì đây là thay đổi cấu hình vận hành; đã kiểm
tra trực tiếp cấu hình đang chạy, sức khỏe dịch vụ và gửi tin thật.

Bản cấu hình trước/sau và bằng chứng riêng tư được giữ với quyền truy cập hạn chế
trong `/tmp/bigbike-telegram-recipient-20260908-69nmz5nj/`, không đưa vào Git.
Khôi phục nơi nhận cũ sẽ quay lại tài khoản đã chặn bot; chỉ thực hiện khi chủ shop
yêu cầu và xác minh lại tài khoản đó.
