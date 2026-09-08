# Bàn giao xử lý ảnh — 08/09/2026

Căn cứ: `BUSINESS_RULES.md` CHAT_RULE_057–059, CHAT_RULE_066–069; `API_CONTRACT.md` phần Trợ lý BigBike; `DATA_CONTRACT.md` phần Image reliability; `PERMISSION_MATRIX.md` phần Receipt image notifications.

Owner đã chọn: nhận biên lai và báo trong chuông quản trị; khởi điểm 60 ảnh/ngày; 3 ảnh/lượt, 9 ảnh/hội thoại, 8 MB/ảnh; còn đủ lượt cho một phần thì đọc theo thứ tự gửi. 60 là mức khởi điểm đã chốt, gấp ba trần cũ 20; không phải dự báo lượng khách hay chi phí. Sau bảy ngày, đối chiếu sử dụng và hóa đơn nhà cung cấp rồi điều chỉnh. Không đổi hạn mức chữ đang vận hành.

## Mốc có sẵn do owner cung cấp

Đây là dữ kiện hệ thống thật ngày 08/09/2026, không phải kết quả chạy lại trong lần sửa mã này:

| Nội dung | Mốc owner cung cấp |
|---|---|
| Hai lượt gửi ảnh gần nhất | Cả hai trả lời trượt trọng tâm |
| Ảnh găng tay trong video BigBike | Đọc lại 4 lần đều nhận đúng găng tay; 1 lần trả JSON dở dang, không được retry ở bản cũ; mức hỏng quan sát khoảng 1/4 lượt |
| Găng tay đang bán | 20 mẫu của Komine, Taichi, LS2, ILM; bản cũ không giới thiệu mẫu nào, lượt sau quay về cả 9 nhóm hàng |
| Ảnh logo Caberg | Bản cũ gợi ý NIC N01, AGV K3, Caberg Drift Evo II; 2/3 khác hãng |
| Caberg đang bán | Avalon X 3.390.000đ; Drift Evo II Carbon 11.500.000đ; Tanami Carbon 12.000.000đ |
| Khả năng đối chiếu ảnh | 184 mặt hàng đang bán; 88 có dữ liệu đối chiếu; 91 mặt hàng còn ảnh tại kho web cũ |
| Hạn mức cũ đang vận hành | 20 ảnh/ngày và 120 lượt trả lời/ngày, dùng chung với khách |

VPS này có dữ liệu thật (owner đã đính chính). Owner đã yêu cầu agent triển khai bằng Compose với `.env.vps` và đưa toàn bộ thay đổi lên GitHub sau khi kiểm tra; bước chuyển 91 sản phẩm vẫn do owner chủ động chạy. Không truy cập ảnh/hội thoại của khách để thử mã, không chạy bộ kiểm thử lên cơ sở dữ liệu vận hành. Số 1/4 là mẫu quan sát owner cung cấp, không phải SLA hoặc ước lượng thống kê mới. Không cộng 88 + 91 để cam kết đủ 184: sau chuyển kho phải kiểm riêng khả năng đọc và chỉ mục của từng sản phẩm.

## Khi đưa bản sửa vào sử dụng

1. Bản giao ngày 08/09/2026 được owner yêu cầu agent dựng và triển khai bằng `docker compose --env-file .env.vps --parallel 1 up -d --build`, rồi đưa toàn bộ thay đổi lên GitHub. Những lần phát hành sau tiếp tục dùng quy trình triển khai của dự án. Kết quả lần này ghi trong [báo cáo bàn giao](../audits/FEATURE_TRO_LY_BIGBIKE_IMAGES_2026-09-08.md).
2. Flyway áp dụng `V1082__chat_image_reliability_and_receipts.sql`. Migration thêm trường/chỉ mục, bỏ ràng buộc một ảnh/tin nhắn, giữ nguyên ảnh/hội thoại và bộ đếm đã dùng. Setting ảnh được đặt 60, không sửa setting hoặc bộ đếm chữ. Không sửa/xóa migration cũ.
3. Mở **Cài đặt → Trợ lý BigBike → Số ảnh đọc tối đa mỗi ngày**. Xác nhận 60 và ô đã dùng/còn lại theo giờ Việt Nam. Sửa hạn mức có hiệu lực cho lần giữ lượt tiếp theo; không đặt lại số đã dùng. Nhập 0 để tạm dừng cấp lượt đọc mới. Những lượt đã được giữ vẫn thuộc yêu cầu cũ.
4. Nhân viên có `chat.read` mở chuông: biên lai mới dẫn tới đúng tin nhắn chứa ảnh. Chỉ nhân viên có quyền đơn hàng mới xác nhận thanh toán ở luồng Đơn hàng hiện có, sau khi đối chiếu ngân hàng. Trợ lý không xác nhận hoặc đổi trạng thái đơn. `settings.read` chỉ xem số tổng hợp, không xem ảnh.
5. Ảnh khách tiếp tục nằm trong kho riêng tư và bị xóa theo thời hạn 90 ngày hiện có. Khi khách xóa hội thoại, thông báo dẫn tới biên lai cũng bị xóa. Chuông không ghi tham chiếu biên lai vào localStorage; làm mới khi trang đang mở để loại thông báo đã hết hạn/xóa.

Nếu cần dừng xử lý ảnh trong lúc kiểm tra: đặt hạn mức ảnh 0, giữ nguyên dữ liệu và schema V1082. Không chạy lệnh DROP hoặc hoàn tác migration theo kiểu xóa dữ liệu ảnh.

## Chuyển ảnh sản phẩm về thư viện

Công cụ: `scripts/ops/migrate-product-images.py`. Chỉ owner chủ động chạy. Python 3 và `psql`; không cần bật Spring hoặc ứng dụng thứ hai. API hiện có đảm nhiệm kiểm ảnh, chuẩn hóa, tạo kích thước, SHA/dedup và MinIO. Cần tài khoản quản trị có `media.write` và `products.update`. Token lấy từ phiên được cấp quyền, truyền qua `BIGBIKE_IMAGE_MIGRATION_TOKEN`, không ghi vào Git, lệnh mẫu hoặc gửi vào chat.

Kết nối PostgreSQL dùng cơ chế `PGSERVICE`/`PGHOST`/`PGPORT`/`PGDATABASE`/`PGUSER` và `.pgpass` hiện có; xác minh đúng database trước. Công cụ không tự đọc `.env`. Mọi manifest phải nằm ngoài repository; thư mục 0700 và tệp 0600. Chuẩn bị bản sao lưu theo quy trình vận hành trước bước `apply`.

```bash
export BIGBIKE_IMAGE_WORKDIR=/root/bigbike-image-migration-20260908
mkdir -p "$BIGBIKE_IMAGE_WORKDIR"
chmod 700 "$BIGBIKE_IMAGE_WORKDIR"
python3 scripts/ops/migrate-product-images.py dry-run \
  --manifest "$BIGBIKE_IMAGE_WORKDIR/catalog-images.json" \
  --source-origin https://TEN-MIEN-KHO-CU-CUA-SHOP
```

Nếu chưa biết origin kho cũ, owner có thể lấy các nguồn ảnh chính bằng câu chỉ đọc sau; kết quả là nguồn cần xác minh, không phải số sản phẩm đã chuyển:

```sql
SELECT DISTINCT substring(image_url FROM '^(https?://[^/]+)') AS source_origin
FROM products
WHERE publish_status = 'PUBLISHED' AND NOT discontinued
  AND image_url LIKE '%/wp-content/uploads/%'
ORDER BY source_origin;
```

Thay origin bằng đúng nguồn công khai đang có trong ảnh sản phẩm; có thể lặp `--source-origin` khi shop có nhiều nguồn/đích redirect được xác minh. Đường tương đối `/wp-content/uploads/...` dùng origin đầu tiên. Không dùng địa chỉ nội bộ, localhost hoặc metadata server làm nguồn ảnh: công cụ chặn IP riêng và kiểm mỗi redirect. Không lấy raw WordPress export.

`dry-run` chỉ đọc các bảng sản phẩm và ghi manifest trên đĩa; không tải ảnh, gọi AI, upload hoặc sửa DB. Xem số **sản phẩm** và số **dòng/trường** cần chuyển (hai số này khác nhau), danh sách URL nguồn, các trường trước thay đổi. Phạm vi là sản phẩm published chưa ngừng kinh doanh, giá VND hợp lệ; ảnh chính/SEO, gallery, biến thể, ảnh trong mô tả Việt–Anh và các khối nội dung ảnh. Khối video và URL video giữ nguyên. Link ngoài các origin đã chỉ định không được tự tải; bổ sung nguồn sau khi xác minh nếu cần.

```bash
# BIGBIKE_IMAGE_API_BASE là backend hiện có, gồm /api/v1; HTTPS (hoặc loopback).
python3 scripts/ops/migrate-product-images.py apply \
  --manifest "$BIGBIKE_IMAGE_WORKDIR/catalog-images.json" \
  --api-base "$BIGBIKE_IMAGE_API_BASE"
python3 scripts/ops/migrate-product-images.py verify \
  --manifest "$BIGBIKE_IMAGE_WORKDIR/catalog-images.json"
```

Mỗi dòng ghi giá trị trước/sau bền vào manifest rồi mới cập nhật có điều kiện. Nếu người khác vừa sửa trường đó, công cụ báo `CONFLICT` và giữ chỉnh sửa của họ. Nếu tải ảnh/ghi DB/làm mới cache lỗi, phần còn lại vẫn chạy, lệnh trả mã khác 0 và manifest giữ tình trạng dở để owner xem. Chạy lại **cùng lệnh apply/cùng manifest** để tiếp tục; không tạo manifest mới để che một lần chạy dở. Ảnh đã upload được dùng lại; mạng rớt trước khi nhận kết quả upload vẫn được pipeline SHA nhận diện để không nhân bản.

Sau mỗi sản phẩm, công cụ gọi PATCH rỗng qua luồng sản phẩm hiện có để đồng bộ thư mục/cache và yêu cầu web làm mới. `REFRESH_PENDING` chưa được coi hoàn tất; chạy lại để thử bước này. Kiểm trang sản phẩm thật sau apply vì phản hồi API thành công không thay cho xác minh cache/CDN ngoài ứng dụng.

Chạy `dry-run` lần nữa vào **manifest mới**: các URL đã chuyển phải không còn được đề xuất. `verify` của manifest cũ kiểm giá trị DB có đúng kết quả dự kiến; bước dựng chỉ mục bên dưới kiểm thêm khả năng đọc bytes thực tế.

## Dựng và kiểm chỉ mục, không dùng AI

`CatalogImageReindexCommand` chỉ kết nối JDBC/MinIO và dùng chính thuật toán dấu vân tay của ứng dụng. Không dựng Spring, không chạy Flyway, scheduler, HTTP listener hoặc gọi Gemini. Các biến `BIGBIKE_IMAGE_INDEX_*` trong `.env.example` là tên biến cho lệnh riêng này; owner cung cấp đúng thông số DB và **bucket ảnh sản phẩm công khai**, không dùng bucket ảnh chat. Không đổi biến môi trường của dịch vụ đang chạy.

```bash
cd bigbike-backend
# Dùng đúng mã đã qua kiểm tra; lệnh Maven này chỉ biên dịch và lấy classpath.
./mvnw -q -DskipTests compile dependency:build-classpath \
  -DincludeScope=runtime -Dmdep.outputFile="$BIGBIKE_IMAGE_WORKDIR/runtime.classpath"
java -XX:ActiveProcessorCount=2 -Xmx512m \
  -cp "target/classes:$(cat "$BIGBIKE_IMAGE_WORKDIR/runtime.classpath")" \
  com.bigbike.bigbike_backend.service.chat.CatalogImageReindexCommand verify \
  > "$BIGBIKE_IMAGE_WORKDIR/index-before.txt"
java -XX:ActiveProcessorCount=2 -Xmx512m \
  -cp "target/classes:$(cat "$BIGBIKE_IMAGE_WORKDIR/runtime.classpath")" \
  com.bigbike.bigbike_backend.service.chat.CatalogImageReindexCommand reindex \
  > "$BIGBIKE_IMAGE_WORKDIR/index-rebuild.txt"
java -XX:ActiveProcessorCount=2 -Xmx512m \
  -cp "target/classes:$(cat "$BIGBIKE_IMAGE_WORKDIR/runtime.classpath")" \
  com.bigbike.bigbike_backend.service.chat.CatalogImageReindexCommand verify \
  > "$BIGBIKE_IMAGE_WORKDIR/index-after.txt"
```

Nên chạy `verify` đầu tiên **trước apply** để có mốc trước–sau. Báo cáo gồm số sản phẩm trong phạm vi, ảnh đọc được, chỉ mục đúng phiên bản, mục chưa tìm được media/SHA và lỗi đọc. Có `UNRESOLVED`/`FAILED` hoặc thiếu chỉ mục thì mã thoát khác 0; giữ danh sách ID, sửa nguồn/đăng ký media tương ứng rồi chạy lại. Không đoán sản phẩm chưa đối chiếu được và không hạ ngưỡng nhận diện để ép đủ số. Những sản phẩm dùng chung đúng ảnh vẫn có thể mơ hồ về mẫu — giữ nguyên nguyên tắc không khẳng định mẫu.

## Quay lui việc chuyển ảnh

```bash
# Chạy từ root repository; dùng lại đúng manifest, đúng database và API.
python3 scripts/ops/migrate-product-images.py rollback \
  --manifest "$BIGBIKE_IMAGE_WORKDIR/catalog-images.json" \
  --api-base "$BIGBIKE_IMAGE_API_BASE"
python3 scripts/ops/migrate-product-images.py verify \
  --manifest "$BIGBIKE_IMAGE_WORKDIR/catalog-images.json"
```

Rollback chỉ trả các trường ảnh về giá trị trước khi công cụ chạy, khi giá trị hiện tại vẫn trùng bản sau. Nếu có chỉnh sửa mới, báo xung đột để owner xử lý riêng. Không xóa object/media mới vì có thể đã được dùng nơi khác. Sau rollback, chạy lại lệnh reindex/verify và mở các trang sản phẩm đã tác động. Nếu sản phẩm đã thay đổi trạng thái/phạm vi, giữ xung đột để xử lý riêng, không ép ghi đè.

## Đo sử dụng và kiểm sau triển khai

Lệnh đọc tổng hợp, không đọc nội dung khách:

```sql
SELECT usage_date, used_count
FROM chat_image_daily_usage
WHERE usage_date >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 6
ORDER BY usage_date;

SELECT setting_key, setting_value
FROM site_settings
WHERE setting_key IN ('ai_assistant_image_daily_limit', 'ai_assistant_daily_limit');
```

Đối chiếu với ô hạn mức ở quản trị và hóa đơn/số sử dụng trong tài khoản nhà cung cấp. Cùng một ảnh retry chỉ giữ một lượt ảnh, nhưng có thể có nhiều lần gọi provider; không dùng bộ đếm ảnh để suy ra số tiền. Log kỹ thuật `chat_image_analysis_failed` có số lần thử và loại lỗi, không chứa bytes/biên lai; dùng thống kê lỗi này cùng số lượt, không suy tỷ lệ lỗi từ mẫu bốn lần cũ.

Owner kiểm trên bản đã triển khai bằng ảnh sản phẩm/logo công khai do shop quản lý, không dùng hội thoại riêng tư làm fixture: Caberg chỉ ra hàng Caberg; hãng không bán nói rõ chưa có; găng tay chưa rõ mẫu vẫn có gợi ý cùng loại; hỏi tiếp giữ nhóm; ba góc chụp nằm cùng một tin nhắn. Biên lai thử phải có dữ liệu giả rõ ràng và không dẫn tới xác nhận một khoản tiền thật. Mỗi lần đọc ảnh thật sẽ dùng hạn mức; chỉ chạy số ca cần thiết sau khi xem bộ kiểm thử tự động.

Not run: chuyển 91 sản phẩm, reindex toàn bộ ảnh vận hành, kiểm catalog sau chuyển kho, đo lưu lượng/chi phí bảy ngày và đọc ảnh bằng AI thật — các việc này do owner chạy theo hướng dẫn trên; triển khai bản sửa theo yêu cầu bổ sung của owner chỉ áp dụng migration/setting đi cùng phiên bản, không chạy công cụ chuyển kho hoặc dùng dữ liệu khách để thử.
