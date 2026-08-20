# BigBike — Checklist hiệu năng xử lý phía sau

Ngày lập: 20/08/2026. Tài liệu này là chuẩn đối chiếu cho vận hành; không thay thế số đo mới
bằng ước tính. Mọi lệnh bên dưới phải do chủ shop chạy trong cửa sổ đã duyệt, không tự chạy trên
máy chủ thật.

## Mốc nền đã đo trên máy chủ thật

- Sau 14,5 ngày chạy liên tục có **805** câu hỏi dữ liệu chậm hơn 200 mili-giây, trung bình
  **282ms**; chậm nhất: giỏ hàng **17,5 giây**, sản phẩm **13,8 giây**, dòng hàng trong giỏ
  **6,5 giây**. **725/805** câu chậm liên quan dữ liệu sản phẩm.
- Có **41.310** giỏ hàng; tháng 8/2026 sinh **37.348** (khoảng 1.900/ngày), tháng 7: 175,
  tháng 6: 1.244, tháng 5: 2.543; shop chỉ có **4** đơn hàng thật.
- Từ điển thuộc tính có **204** giá trị và **8** loại, nhưng bị quét **22,8 triệu** lượt giá trị
  và **5,37 triệu** lượt loại trong 14,5 ngày. Trong 2.256 option biến thể có 238 dòng thiếu
  liên kết loại và 428 dòng thiếu liên kết giá trị.
- Máy có 6 lõi, tổng 8 GB RAM, swap đã dùng 3,5/5 GB. Backend dùng 568 MB trong giới hạn 1 GB;
  không thấy luồng dọn bộ nhớ song song. Không được tăng backend lên 4 GB.
- Kho dữ liệu 159 MB, tỷ lệ đọc trúng bộ nhớ đệm 100%, đã có 298 chỉ mục; pool kết nối, gom
  truy vấn, nén phản hồi, nạp lười và xử lý nền đã phù hợp — không làm lại.
- Nhật ký quản trị tăng từ 324 dòng tháng 5 lên 18.745 dòng tháng 8 và chưa có lịch dọn.

## Cơ chế áp dụng

1. Java dùng G1GC trong đúng giới hạn container 1 GB, heap tối đa vẫn 75% bộ nhớ giới hạn.
2. Lịch 02:45 `Asia/Ho_Chi_Minh` dọn cart `ACTIVE`/`MERGED` đã quá 30 ngày, mỗi giao dịch tối đa
   500 giỏ, luôn ghi số lượng và thời lượng kể cả bằng 0. Lần tương tác hợp lệ gia hạn 30 ngày;
   V1046 bù một lần mốc trống cũ từ `updated_at`/`created_at` + 30 ngày cho `ACTIVE`/`MERGED`;
   `CONVERTED` bị loại trừ tuyệt đối.
3. Dọn tồn đọng dùng backup theo mã lần chạy và có khôi phục đúng mã đó; backup giữ 90 ngày.
4. Migration chỉ liên kết biến thể khi kết quả chắc chắn duy nhất; còn dòng không chắc chắn thì
   migration dừng an toàn, nêu số dòng cần xử lý và không đoán. Sau đó hai liên kết là bắt buộc.
5. Pool phát hiện kết nối bị giữ trên 5 giây, kiểm tra kết nối sống và PostgreSQL tự cắt phiên
   giao dịch bỏ dở sau 30 giây, không cắt câu hỏi hợp lệ theo ngưỡng thời gian.
6. Redis hiện có lưu projection bất biến của danh mục, thương hiệu và từ điển thuộc tính trong tối
   đa 1 giờ; sửa dữ liệu thành công sẽ xoá đệm ngay, Redis lỗi thì đọc PostgreSQL bình thường.
7. Lịch 03:40 `Asia/Ho_Chi_Minh` dọn audit log cũ hơn 12 tháng, từng đợt 500 và có nhật ký.
8. Prometheus registry làm cổng nội bộ hoạt động thật; `pg_stat_statements` cần restart PostgreSQL.

## Lệnh vận hành bắt buộc cho chủ shop

Từ thư mục checkout trên VPS, trong cửa sổ bảo trì đã duyệt, thực hiện đúng thứ tự sau. Sao lưu
PostgreSQL phải hoàn tất và được kiểm tra có thể khôi phục **trước** bước triển khai, vì cả migration
và lần dọn đầu đều thay đổi dữ liệu vận hành.

```bash
# 1. Tạo backup PostgreSQL và kiểm tra archive đọc được trước mọi thay đổi.
backup_dir="backups/performance-20260820"
mkdir -p "$backup_dir"
backup_file="$backup_dir/postgres-before-cart-purge-$(date +%Y%m%d-%H%M%S).dump"
docker compose --env-file .env.vps exec -T postgres sh -c \
  'exec pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > "$backup_file"
docker compose --env-file .env.vps exec -T postgres sh -c \
  'pg_restore -l >/dev/null' < "$backup_file"

# 2. Kiểm tra cấu hình và triển khai source/image có V1045–V1048.
docker compose --env-file .env.vps config >/dev/null
docker compose --env-file .env.vps build bigbike-backend

# 3. PostgreSQL phải khởi động lại để nạp pg_stat_statements; sau đó backend chạy migration mới.
docker compose --env-file .env.vps up -d --force-recreate postgres
docker compose --env-file .env.vps up -d --no-deps --force-recreate bigbike-backend
docker compose --env-file .env.vps ps postgres bigbike-backend
curl -fsS http://127.0.0.1:8080/actuator/health

# 4. Chỉ khi backend khoẻ và migration đã hoàn tất mới dọn lần đầu.
bash scripts/ops/purge-stale-carts.sh --dry-run
bash scripts/ops/purge-stale-carts.sh --execute
# lưu mã lần chạy (run-id) in ở cuối lệnh để hoàn tác khi cần
# CHỈ khi đối chiếu thấy sai: bash scripts/ops/restore-cart-purge.sh <run-id>
```

`--dry-run` chỉ đếm giỏ đủ điều kiện. `--execute` sao lưu rồi xoá tối đa 500 giỏ/đợt, nghỉ một
giây giữa các đợt, và không đụng giỏ đã thành đơn. Chỉ dùng `restore` cho đúng `run-id` vừa kiểm
tra — kể cả run-id bị dừng sau một đợt đã sao lưu —; nó không thay đổi đơn hàng, khách hàng hay
thanh toán.

Sau đó kiểm tra nội bộ: `GET /actuator/prometheus`, `SHOW shared_preload_libraries`, extension
`pg_stat_statements`, số giỏ quá hạn, số audit log quá 12 tháng, log G1GC và log kết quả hai lịch.
Đối chiếu truy vấn chậm với mốc 805 câu/282ms; chỉ báo cáo tốc độ 17,5 giây và 13,8 giây sau khi
có số đo mới, không suy đoán trước.
