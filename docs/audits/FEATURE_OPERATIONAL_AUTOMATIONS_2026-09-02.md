# Kiểm tra vận hành các chức năng tự động hóa — 2026-09-02

## Phạm vi và căn cứ

Kiểm tra runtime trên VPS lúc 11:21 và kích hoạt phân loại đơn lịch sử lúc 11:29
`Asia/Ho_Chi_Minh`, dùng đúng stack `docker compose --env-file .env.vps`. Video trang
chủ không kiểm tra lại trong báo cáo này vì đã có báo cáo riêng
`FEATURE_HOME_VIDEO_AUTOMATION_2026-09-02.md`.

Căn cứ chuẩn:

- `BUSINESS_RULES.md`: `ORDER_RULE_013`–`015`, `NOTIFICATION_RULE_001`–`002`,
  `STOCK_ALERT_RULE_001`–`006`, `REVIEW_RULE_011`, `REVIEW_RULE_014`–`016`,
  `CART_RULE_001`–`002`, `AUDIT_RULE_001`, `CHAT_RULE_013`.
- `WORKFLOW_OVERVIEW.md`: Historical-order classification and daily operations.
- `DATA_CONTRACT.md`: sổ chạy bản tin hết hàng, nhắc đơn quá hạn và thư mời đánh giá.
- `DEPLOYMENT_GUIDE.md`: bước owner-operated phân loại đơn lịch sử.

## Kết quả runtime

| Chức năng | Kết luận | Bằng chứng VPS |
|---|---|---|
| Bản tin hết hàng | **PASS** | Đang bật, giờ chạy `08:00`. Có đúng một run/ngày cho 31/08, 01/09 và 02/09. Run 02/09 tạo một chuông và hộp thư gửi đã nhận xử lý lúc 08:00. Payload hôm nay có 13 sản phẩm hết sạch, 21 sản phẩm thiếu cỡ/màu và 91 biến thể hết; đối chiếu lại toàn bộ ID với dữ liệu sản phẩm hiện tại cho sai lệch `0/0/0`. |
| Thư mời đánh giá | **PASS có điều kiện / chưa đến lượt gửi** | Env VPS là `true`; campaign/cutoff đang hoạt động, mở lúc 14:00 ngày 01/09. Không có đơn mới không-legacy nào hoàn tất sau cutoff, nên có 0 delivery và 0 lượt gửi là đúng rule; hệ thống không gửi bù đơn cũ. SMTP dùng chung đã nhận thành công bản tin hết hàng hôm nay, nhưng chưa có thư mời production thật để chứng minh luồng gửi end-to-end. |
| Nhắc đơn quá hạn | **ACTIVATED / PASS điều kiện đầu vào** | Owner đã xác nhận 1.660 dòng `legacy_id IS NOT NULL` là tập lịch sử đúng. Batch `LEGACY_WEB_IMPORT_2026_06_11` đang active với đúng 1.660 membership, gồm 388 `PENDING`, 508 `PROCESSING`; sai lệch membership `0`, trùng lặp `0`. Snapshot và checksum của toàn bộ 1.666 dòng `orders` trước/sau giống hệt nhau. Hiện có 0 đơn vận hành quá hạn nên chưa tạo chuông là đúng rule. Batch được kích hoạt sau lịch 04:20 ngày 02/09; callback tự động đầu tiên có thể quan sát là 04:20 ngày 03/09. |
| Dọn giỏ hết hạn | **PASS theo trạng thái dữ liệu** | Tại mốc lịch chạy 02:45 hôm nay không còn giỏ đến hạn. Hiện có 7 giỏ hết hạn sau mốc chạy (04:44–10:06 giờ Việt Nam), đúng lịch sẽ được dọn vào 02:45 ngày 03/09. Giỏ `CONVERTED` không thuộc truy vấn dọn. PostgreSQL ghi nhận 11 dòng giỏ đã được xóa từ lần khởi động DB gần nhất. |
| Dọn backup giỏ | **PASS / không có tải** | Không có backup quá 90 ngày tại mốc 03:15. |
| Dọn khóa chống tạo đơn trùng | **PASS / không có tải quá hạn** | Có 6 khóa hiện hành, không khóa nào cũ quá 90 ngày. |
| Dọn ảnh đánh giá bỏ dở | **PASS / không có tải** | Không có ledger ảnh chưa claim quá 24 giờ. |
| Dọn lịch sử Trợ lý BigBike | **PASS theo trạng thái dữ liệu** | Có 2 hội thoại và 2.813 định danh thiết bị đang còn hạn; không có hội thoại/định danh quá hạn tại mốc 03:20. |
| Dọn nhật ký quản trị | **PASS theo trạng thái dữ liệu** | 26.635 dòng hiện hành; không có dòng cũ quá 12 tháng tại mốc 03:40. |
| Dọn thông báo quản trị | **PASS theo trạng thái dữ liệu** | 3 thông báo hiện hành; không có dòng cũ quá 6 tháng tại mốc 03:50. Sổ chống lặp của bản tin nghiệp vụ tách riêng và không bị dọn theo kho chuông. |

Backend, web, admin, PostgreSQL, Redis và MinIO đều `healthy` khi kiểm tra. Backend
được thay container lúc 10:48 ngày 02/09 nên log các lịch chạy rạng sáng của container
cũ không còn; kết luận ưu tiên sổ chạy bền vững và backlog trong PostgreSQL. Preflight
cuối lúc 11:56 pass toàn bộ 1.610 test backend, 0 failure, 0 error, 1 skip.

## Findings đã xử lý

### P1 — Nhắc đơn quá hạn đã được kích hoạt an toàn

- Owner xác nhận ngày 02/09/2026 rằng 1.660 dòng có `legacy_id IS NOT NULL` là phạm vi
  lịch sử đúng; canonical docs đã được cập nhật trước khi ghi runtime.
- Script đã kích hoạt batch và thêm đúng 1.660 membership trong một transaction. Chạy
  lại lần hai thêm `0` membership, chứng minh thao tác idempotent.
- Trước/sau thao tác đều có 1.666 đơn và cùng checksum
  `548988a3555dbf7d8ae1998b15f24bbd`; không trạng thái, nội dung hay số lượng đơn nào
  bị thay đổi.

### P1 — Công cụ phân loại trong runbook đã được sửa

Lệnh đọc-only chuẩn hiện chạy thành công:

```bash
bash scripts/ops/classify-legacy-orders.sh --dry-run
```

Lỗi cũ tại `:'batch_key'` đã được loại bỏ bằng cách dùng batch key cố định đã quy định
trong contract. `bash -n`, `--dry-run` trước/sau kích hoạt và `--execute` hai lần đều
thành công; các safety gate xác nhận đúng 1.660/388/508 và không cho phép tập dữ liệu
khác lọt qua.

## Giới hạn bằng chứng

- Cờ `email_accepted=true` chỉ chứng minh nhà cung cấp SMTP nhận xử lý, đúng
  `STOCK_ALERT_RULE_006`; không chứng minh thư đã nằm trong Inbox/không vào Spam.
- Chưa có đơn hoàn tất sau cutoff thư mời, nên chưa thể quan sát một thư mời production
  thật trước ít nhất 7 ngày kể từ đơn đủ điều kiện đầu tiên.
- Các tác vụ retention không có sổ run riêng. Backlog tại đúng mốc chạy bằng 0 và code/test
  đều đúng contract, nhưng container cũ đã bị thay nên không còn log để chứng minh callback
  rạng sáng từng được gọi.
- Chưa thể quan sát callback nhắc đơn quá hạn sau kích hoạt trước 04:20 ngày 03/09/2026.
  Sổ run hiện bằng 0 là trạng thái đúng vì batch được kích hoạt sau lịch 04:20 ngày 02/09
  và hiện không có đơn vận hành quá hạn.

## Đã hoàn tất

1. Owner đã xác nhận phạm vi 1.660 đơn lịch sử và canonical docs đã được sửa trước code.
2. Công cụ vận hành đã được sửa và qua kiểm tra cú pháp, dry-run, execute và idempotency.
3. Batch đang active; membership 1.660/1.660; mismatch 0; duplicate 0.
4. Bảng `orders` không bị sửa/xóa/đổi trạng thái trong toàn bộ quá trình.
5. Targeted test cho nhắc đơn quá hạn và PostgreSQL pass 6/6; regression riêng cho dọn
   thông báo pass 5/5 sau khi chuẩn hóa độ chính xác timestamp theo PostgreSQL.
