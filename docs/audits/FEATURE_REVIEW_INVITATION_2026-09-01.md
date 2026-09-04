# Audit bàn giao: thư mời đánh giá tự động — 2026-09-01

## Quyết định và bằng chứng đầu vào

Chủ shop quyết định ngày 01/09/2026: bỏ toàn bộ mặt quản trị của thư mời đánh giá,
nhưng giữ luồng gửi tự động. Số đo production được cung cấp tại thời điểm quyết định:
chưa bật tính năng, chưa có delivery/campaign/opt-out/review thực tế và cấu hình cũ
là chờ 7 ngày, tối đa 20 thư/ngày. Vì vậy không cần chuyển đổi dữ liệu.

Sau khi đối chiếu lịch sử production, `V1075`–`V1077` đã thuộc chuỗi migration media;
migration mới vì vậy được đặt là `V1079__remove_review_invitation_settings.sql`, sau
`V1078__freeze_store_policy_content.sql`. Migration chỉ xóa ba dòng cấu hình cũ trong
`site_settings`; không sửa migration đã chạy và không xóa các bảng campaign/delivery/item/
opt-out/quota.

## Phạm vi đã bàn giao

- Admin không còn tab, ô bật/tắt, ô số ngày chờ, ô trần/ngày, bảng theo dõi, danh sách từ
  chối, thao tác bỏ qua do hoàn tiền hoặc API quản trị của tính năng.
- Backend chỉ đọc `BIGBIKE_REVIEW_INVITATION_ENABLED`, mặc định `true`; delay cố định 7
  ngày và trần cố định 20 lượt thử/ngày.
- Callback scheduler đầu tiên sau deploy tự tạo campaign/cutoff; không tạo campaign lúc
  startup, không gửi bù đơn trước cutoff hoặc đơn có `legacy_id`.
- Khi env tắt, campaign hiện tại đóng và delivery `PENDING` bị chuyển `SKIPPED`; bật lại
  tạo campaign/cutoff mới, không gửi bù. Các delivery vẫn giữ trạng thái chẩn đoán trong
  dữ liệu.
- Giữ nguyên `POST /api/v1/review-invitations/unsubscribe`, trang web từ chối ẩn danh,
  `inviteToken`, form đánh giá không cần đăng nhập và toàn bộ kiểm tra eligibility/quota/
  chống gửi trùng.

## Kiểm tra đã thực hiện

| Hạng mục | Kết quả |
| --- | --- |
| Backend compile | Pass |
| Nhóm `*ReviewInvitation*Test` | 22 chạy, 0 fail, 2 skip do Docker/Testcontainers không khả dụng |
| `OpenApiContractDriftTest` | 5 pass |
| Admin unit tests | 118 file, 1.119 test pass |
| Admin build, i18n guard, runtime-mock guard | Pass |
| Admin Settings E2E | Chưa chạy: backend/Docker không khả dụng; SettingsScreen unit test và static runtime scan đã pass |
| Web unit tests | 87 file, 535 test pass |
| Public unsubscribe E2E | Pass: khách ẩn danh mở trang và xác nhận từ chối thành công |
| Web lint, build | Pass; route từ chối vẫn được build |
| Hygiene runtime guards | Admin và web pass; không có CSS riêng của tính năng cần dọn |
| Full backend `mvn test` | Không xanh do 4 test tích hợp cần Docker và 1 test order có sẵn thất bại ngoài phạm vi |
| Full admin lint | Bị chặn bởi các file Prettier lệch sẵn trong repo; lint/Prettier riêng các file chạm đã pass sau khi format E2E settings |

Docker được kiểm tra trước khi test và không có container đang chạy; không tự khởi động
hoặc thay đổi shared runtime.

## Tài liệu chuẩn đã đồng bộ

Business rules `REVIEW_RULE_014–016`, state machine, workflow, acceptance criteria,
module catalog, API contract/flow, data contract, permission matrix, integration,
testing, deployment và traceability đều ghi nhận mô hình tự động cố định, env switch và
việc không còn mặt quản trị. API contract chỉ giữ endpoint unsubscribe công khai.
