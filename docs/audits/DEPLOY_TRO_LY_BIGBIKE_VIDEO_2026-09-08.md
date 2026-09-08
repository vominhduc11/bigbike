# Trợ lý BigBike — triển khai website thật ngày 08/09/2026

**Đã triển khai và xác nhận trên `bigbike.vn`, `admin.bigbike.vn`, `api.bigbike.vn`.** Video có tiếng được trả lời trong **40,86 giây** tính từ khi server nhận đủ file. Bản web cuối đã phát lại video sau tải lại trang, không còn lỗi tải tệp của trợ lý. Kiểm sức khỏe sau triển khai: cả ba tên miền HTTPS 200 và ba dịch vụ khỏe. [Bằng chứng dịch vụ](evidence/assistant-deployment-2026-09-08/final-health.json), [thời gian server](evidence/assistant-deployment-2026-09-08/video-server-timing.json), [trình duyệt bản cuối](evidence/assistant-deployment-2026-09-08/final-browser-check.json).

## Bản đã nạp

Tiếp nhận nguyên kết quả kiểm định trong [báo cáo bàn giao](FEATURE_TRO_LY_BIGBIKE_VIDEO_2026-09-08.md), không chạy lại toàn bộ audit. Nền Git vẫn là `1e5bb99dc4f64a6fa3d5208cac9ce7213d92e095`; không commit/push. Kiểm SHA256SUMS, khả năng áp dụng patch và đối chiếu đủ 160 file trước tích hợp; không thay cả cây mã, reset hoặc stash. Backend/admin cuối khớp bản nguồn đã kiểm trong bàn giao. [Đối chiếu nguồn](evidence/assistant-deployment-2026-09-08/source-final-verification.json).

| Thành phần | Bản đang chạy / thay đổi |
|---|---|
| Backend | `bigbike-assistant-candidate:20260908`, image `f67d2770989378cfcabaaa6806ec31cdfe5db744cffa08c882d890c15f522123`; JAR SHA256 `75f6ea11ff596e346cebf54b5e178794b725d3235cf2286ee17dce3d26540c67`. Có xử lý video và tác vụ xóa sau bảy ngày. |
| Website | `bigbike-assistant-web:20260908-r2`, image `9895177fda3276f98426d1b1466999659a348dfbcc1b157de086b787f7876002`. Build bằng `.env.vps` thật; bản cuối nạp lúc 17:02 ngày 08/09, giờ Việt Nam. |
| Quản trị | `bigbike-assistant-admin:20260908`, image `938e09c92118afeb75aeca2cab0bb102ff5ab3930dc9dd7369a5589665dea014`. Build bằng `.env.vps` thật. |
| PostgreSQL | Flyway bổ sung duy nhất V1081, thành công trong 223 ms. Đối chiếu theo `installed_rank`: toàn bộ 454 bản ghi migration cũ giữ nguyên. PostgreSQL không khởi động lại. |
| API gateway | Thêm đúng location nhận `/api/v1/chat/videos`: 45 MiB, upstream timeout 75 giây; các location hiện hữu giữ nguyên. `nginx -t` đạt, reload thành công. Không tăng giới hạn chung 10 MiB. |

Các tag mặc định `bigbike-bigbike-backend/web/admin:latest` cũng trỏ về đúng image cuối; các image cũ được giữ bằng tag rollback. Không dùng bundle preview. `.env.vps` giữ nguyên SHA256. Redis, MinIO và 11 container ngoài phạm vi nạp ứng dụng giữ thời điểm khởi động trước phiên triển khai. [Migration](evidence/assistant-deployment-2026-09-08/migration-final.json), [gateway](evidence/assistant-deployment-2026-09-08/gateway.json), [image mặc định](evidence/assistant-deployment-2026-09-08/standard-image-tags.json), [dịch vụ khác](evidence/assistant-deployment-2026-09-08/unrelated-services.json).

## Kiểm trên tên miền thật

| Ca | Kết quả và bằng chứng |
|---|---|
| Hỏi chữ | “Tôi tìm mũ fullface dưới 7 triệu.” trả tám mẫu từ dữ liệu shop, đúng trần giá; nguồn TOOL, không gọi AI chữ thêm. [Lịch kiểm](evidence/assistant-deployment-2026-09-08/smoke.jsonl). |
| Một video có tiếng | Fixture clip mũ 12,00161 giây, có lời nhắn hỏi bảo hành; trả nhận diện có giới hạn và chính sách shop, không khẳng định mẫu khi thiếu tin cậy. Thời gian server 40,860642 giây, trong giới hạn 60 giây. [Câu trả lời](evidence/assistant-deployment-2026-09-08/video-answer.json). |
| Phát lại sau tải lại | Bản web r2: video riêng tư phát được, có nút điều khiển; kiểm ở 375/768/1440 px. Không có lỗi trang hoặc API trợ lý. [Bản cuối](evidence/assistant-deployment-2026-09-08/final-browser-check.json), [ảnh mobile](evidence/assistant-deployment-2026-09-08/chat-video-375.png), [ảnh desktop](evidence/assistant-deployment-2026-09-08/chat-video-1440.png). |
| Quyền đọc | Chủ hội thoại 200/no-store; không định danh và visitor khác 404; admin chưa đăng nhập 401; admin được phép 200/no-store và phát được. URL object kho riêng không xác thực trả 403. [Quyền/UI](evidence/assistant-deployment-2026-09-08/ui-permissions.jsonl), [kho riêng](evidence/assistant-deployment-2026-09-08/private-object-before-cleanup.json), [ảnh admin](evidence/assistant-deployment-2026-09-08/admin-video-1440.png). |
| Việt/Anh | Nút video, lỗi quá 40 MiB và trang quyền riêng tư đều kiểm trên tên miền thật. Công bố gửi cả video/tiếng tới Gemini và giữ bảy ngày hiển thị đủ hai ngôn ngữ. [Quyền/UI](evidence/assistant-deployment-2026-09-08/ui-permissions.jsonl), [ảnh tiếng Anh](evidence/assistant-deployment-2026-09-08/chat-video-en-375.png). |
| Giới hạn gateway | Request thử 11 MiB đi qua gateway và bị backend từ chối đúng vì không phải video hợp lệ: HTTP 400, `VALIDATION_ERROR` / `CHAT_VIDEO_UNSUPPORTED_TYPE`; không gọi AI. [Bằng chứng](evidence/assistant-deployment-2026-09-08/gateway-body-check.json). |
| Giữ/xóa tệp | Metadata đặt hết hạn đúng bảy ngày. Sau xóa lịch sử fixture: không còn video trong DB và xác thực kho trả `NoSuchKey`. [Thời hạn](evidence/assistant-deployment-2026-09-08/video-server-timing.json), [dọn DB](evidence/assistant-deployment-2026-09-08/cleanup.json), [dọn object](evidence/assistant-deployment-2026-09-08/private-object-after-cleanup.json). |

Khi kiểm live đã phát hiện lần khôi phục lịch sử gọi lấy video trước khi danh tính chat tải xong, sinh 404 tạm thời. Bản r2 chờ token hợp lệ rồi mới lấy tệp; kiểm hồi quy 35 test đạt và đã phát lại trên tên miền thật sau khi nạp r2. Không tiêu thêm lượt AI cho các lần phát lại. Lần build r2 đầu bị ngắt (exit 143), chưa đưa lên; lần build hoàn chỉnh sau đó thành công. [Build cuối](evidence/assistant-deployment-2026-09-08/web-r2-build.json), [kiểm tra tổng hợp](evidence/assistant-deployment-2026-09-08/checks-final.json).

Kết quả backend 1.730 test (một skip đã có), 289 test trợ lý/OpenAPI cuối, web 684 và admin 1.144 được kế thừa từ hồ sơ bàn giao. Phiên triển khai chạy build production, lint web/admin, 35 test phần lịch sử video, kiểm định dạng/dữ liệu hardcode, cấu hình nginx và smoke live. Không chạy lại AI cho video không lời nhắn, quá hạn hoặc toàn bộ ma trận từ chối; dùng bằng chứng audit đã được duyệt. Ca admin đăng nhập nhưng thiếu `chat.read` được kế thừa từ audit, không sửa quyền tài khoản production để thử lại.

## Lượt dùng và dọn dữ liệu

| Nhóm | Audit trước | Thêm khi triển khai | Cộng dồn |
|---|---:|---:|---:|
| AI chữ | 92 | 0 | 92 |
| AI ảnh | 5 | 0 | 5 |
| AI video | 8 | 1 | 9 |
| Tổng | 105 | 1 | 106 |

Đối chiếu trước ghi: production chưa có lượt video độc lập. Sau V1081, chuyển đúng tám lượt audit vào ngày **2026-09-08** trước khi nạp backend mới. Sau một video live, quota ngày là chín. Bộ đếm shop chữ là 93 vì có một lượt trước audit; ảnh năm. Xóa fixture không giảm số đếm. [Chuyển quota](evidence/assistant-deployment-2026-09-08/video-quota-carry.json), [sổ cuối](evidence/assistant-deployment-2026-09-08/usage-final.json).

Đã xóa đúng bốn danh tính khách vãng lai do phiên này tạo, một hội thoại/bốn tin nhắn/một video; bản ghi liên quan còn không. Đây là fixture triển khai, không phải tài khoản hay dữ liệu khách hàng. Phiên đăng nhập admin thử đã đăng xuất. Không chạy cleanup tổng thể, sửa hàng hóa, đơn hàng, dữ liệu khách hoặc chính sách nguồn.

## Còn lại và khôi phục

- Giữ nguyên bốn nội dung chờ chủ shop chốt: giờ mở cửa Việt/Anh khác nhau; địa chỉ tiếng Anh cũ; tên tiếng Anh JK-1734; mô tả mùa hè của GK-242 trong tiếng Việt. Việc triển khai mã/video không giải quyết các mâu thuẫn dữ liệu này.
- Console còn cảnh báo CSP chặn beacon phân tích Cloudflare, đã ghi từ [audit ngày 07/09](WEB_HEADER_UI_2026_09_07.md). Không thuộc lỗi trợ lý/video và không sửa ngoài phạm vi. Bằng chứng cuối giữ cảnh báo này riêng, không tuyên bố console toàn website sạch.
- Đã nhận video thật: **giữ backend biết video, V1081, tác vụ xóa bảy ngày và quota** nếu cần khôi phục. Có thể quay web/admin về image đã lưu để ngừng nhận video mới. Không nạp backend chỉ biết ảnh. Snapshot và hướng dẫn cụ thể ở `/root/bigbike-assistant-deploy-20260908/ROLLBACK.md`; cấu hình có bí mật nằm trong `private/`, không đưa vào Git/báo cáo công khai.

Căn cứ: [BUSINESS_RULES.md](../business/BUSINESS_RULES.md) `CHAT_RULE_062–065`; [API_CONTRACT.md](../engineering/API_CONTRACT.md) phần video chat; [DATA_CONTRACT.md](../engineering/DATA_CONTRACT.md) video/lịch sử/quota; [PERMISSION_MATRIX.md](../engineering/PERMISSION_MATRIX.md) quyền đọc video; [STATE_MACHINES.md](../business/STATE_MACHINES.md) phần 15D; [DEPLOYMENT_GUIDE.md](../engineering/DEPLOYMENT_GUIDE.md) phần triển khai video và khôi phục.
