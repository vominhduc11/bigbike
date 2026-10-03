# Lựa chọn sản phẩm và khôi phục bài viết — 2026-09-19

## Phạm vi và căn cứ

Thực hiện `PROMPT_CODEX_ADMIN_SAN_PHAM.md`; chủ shop xác nhận đang làm trực tiếp trên VPS và yêu cầu build bằng `.env.vps` sau khi kiểm tra. Sau khi nhận kết quả kiểm tra, chủ shop đã xác nhận đồng ý nạp hai dịch vụ đã build.

- `BUSINESS_RULES.md`: `PRODUCT_RULE_022`, `PRODUCT_RULE_013`, `PRODUCT_RULE_SKU_001`, `CATALOG_RULE_013`, `ARTICLE_RULE_008`.
- `ACCEPTANCE_CRITERIA.md`: Lựa chọn sản phẩm — màu/cỡ và giá chung; Bài viết — khôi phục nội dung thành khối.
- `API_CONTRACT.md` / `DATA_CONTRACT.md`: Article body blocks.
- Thay đổi nguồn trong admin và backend bài viết; không sửa website khách. Workspace có nhiều thay đổi từ trước, được giữ nguyên.

## Đã sửa

- Hỏi cách bán khi chưa có lựa chọn; chọn màu/cỡ trực tiếp, sinh tổ hợp có tên/SKU; giá riêng trống vẫn kế thừa giá chung. Giữ các dòng đã lưu khi thêm giá trị mới; yêu cầu xác nhận trước khi bỏ tổ hợp đang có.
- Cảnh báo ngay thiếu/trùng mã, thiếu thuộc tính, lệch bộ thuộc tính, thiếu ảnh màu; giữ nguyên quy tắc Còn/Hết và điều kiện ảnh chỉ chặn đăng bán.
- Gỡ hộp tạo hàng loạt cũ, nhân bản dòng, chọn dòng và thao tác hàng loạt riêng trong khối lựa chọn; gỡ sao chép danh mục/khối nội dung và chữ thừa thương hiệu. Cập nhật VI–EN.
- Sửa xếp mũi tên và tiêu đề cùng hàng ở `CollapsibleSection`.
- Bài chưa có khối được tách trong bộ nhớ khi mở (kể cả bản nháp tự lưu chưa có khối); thêm khối không thay thế phần cũ. Bảng biểu dùng trình soạn từng ô, chỉ trong bài viết; giới hạn 400 khối.
- API đọc không ghi DB. Ghi HTML tự dựng khối; V1086 chỉ điền khối còn thiếu; V1087 đánh dấu khối cũ khi SQL/import đổi HTML. Tác vụ nền mỗi 60 giây xử lý tối đa 25 bài, cập nhật có điều kiện để không đè lần sửa đồng thời. Bài rỗng nhận `[]`, không tự tạo chữ.
- Khi lưu bài, giữ liên kết tương đối/neo/gọi điện, ảnh, ô gộp và nội dung giàu định dạng; tiếp tục lọc HTML nguy hiểm.

## Dữ liệu VPS đã kiểm chứng

Dùng `docker ps` trước, đọc dữ liệu bằng `docker exec -i bigbike-postgres ... psql -X`.

- 247 sản phẩm, 144 có lựa chọn, nhiều nhất 75 dòng. Các lựa chọn cũ không được sinh lại khi mở màn.
- 185 bài; 104 thiếu khối gồm **103 có HTML + 1 bài rỗng**.
- Chạy thử parser/renderer mới trên 103 HTML thực: **10.379 khối**, tối đa **191/bài**, **16 khối bảng** ở cấp trên cùng; tổng **122 bảng HTML** kể cả các bảng nằm trong khối bao ngoài được giữ nguyên. So sánh toàn bộ chữ, URL liên kết, URL ảnh, số bảng và kiểm tra ràng buộc từng khối: không còn chênh lệch.
- Đã sao lưu articles, catalog_size_scales, catalog_size_values bằng `pg_dump --format=custom` vào `/root/bigbike-admin-product-backup-20260919/` (quyền riêng tư 600/700); không đưa dữ liệu vào Git.
- Đã xóa đúng hai bảng cỡ **Iphone** và **Cỡ ốc**, cùng 14 giá trị thuộc riêng hai bảng. Giao dịch kiểm lại tên/ID và không có sản phẩm tham chiếu trước khi xóa. Còn 7 bảng cỡ; không xóa giá trị thuộc tính chung.
- So sánh dấu kiểm trước/sau dọn bảng cỡ: toàn bộ sản phẩm, lựa chọn, thuộc tính lựa chọn, ảnh lựa chọn và toàn bộ trường bài viết ngoài body_blocks giống hệt.
- **Chiều dài giữ nguyên:** dây ràng hành lý Kewig BD-1S dùng 60 cm/90 cm, hiện nhóm cỡ chữ. Đã hỏi chủ shop về chuyển nhóm; chưa đổi nhóm hoặc xóa.

## Kiểm tra và triển khai

### Kiểm tra đã chạy

- Admin: toàn bộ `npm run lint` đạt; `npm test -- --maxWorkers=1` đạt **122 tệp / 1.152 ca**. Sau các chỉnh sửa cuối, chạy lại 4 tệp liên quan đạt **34 ca**, cùng ESLint trên các tệp vừa sửa. Build Vite và kiểm tra khóa dịch VI–EN đạt.
- Backend: lượt toàn bộ ban đầu chạy **1.816 ca**, có hai lỗi: fixture bài viết mới thiếu tiêu đề tiếng Anh và parser dùng chung vô tình nhận khối bảng cho sản phẩm. Đã sửa fixture, tách parser bảng riêng cho bài viết, giữ nguyên hành vi parser sản phẩm. Chạy lại **7 lớp / 90 ca liên quan: đạt, không lỗi**; tổng báo cáo JUnit hiện tại là **1.821 ca, 0 lỗi, 1 bỏ qua** (tổng hợp lượt toàn bộ và lượt chạy lại, không phải một lượt chạy toàn bộ mới).
- Kiểm thử PostgreSQL riêng xác nhận: điền khối không đổi nội dung/trường gốc; xử lý bài rỗng và JSON null; chạy lại không đổi dữ liệu đã có; cập nhật HTML làm mất hiệu lực khối cũ; cập nhật đồng thời không bị ghi đè.
- Playwright trên **đúng tài nguyên lấy từ image Docker admin đã build bằng `.env.vps`**, kết nối backend thật: **2 kịch bản đạt**. Đã mở sản phẩm thật 75 lựa chọn, mở bài thật 111 khối và sửa ô bảng nhưng không lưu; kiểm tra màn hình 1440/768/375 px, không tràn ngang và không lỗi console/API. Kịch bản lưu tạo riêng một sản phẩm nháp E2E, xác nhận giá chung được kế thừa, mã tự sinh, thêm màu vẫn giữ ID/mã sửa tay/giá riêng/còn-hết của dòng cũ, rồi xóa đúng ID thử.
- Dấu kiểm sau lượt Playwright cuối (`protected-after-final-e2e.txt`) khớp `protected-before.txt` cho cả năm nhóm dữ liệu được bảo vệ. Còn **247 sản phẩm / 185 bài viết / 0 sản phẩm thử của lượt chạy**.
- Kiểm tra ranh giới domain, `git diff --check`, chữ lỗi mã hóa và các mục menu/khóa dịch đã gỡ: đạt.

### Build VPS đã hoàn tất

- `docker compose --env-file .env.vps build bigbike-admin`: thành công; image `sha256:7cd07bc6c99df439049d3d03af38ff159c216237fe25aa09541539ad333528ba`.
- `docker compose --env-file .env.vps build bigbike-backend`: thành công; image `sha256:8e80b7ebda1a1f2a3ff137cf0a34cbeb5e01a92485cdbb7d7d438723f0da7571`.
- Giữ image đang chạy bằng tag `bigbike-admin:before-product-20260919` và `bigbike-backend:before-product-20260919` để có phương án quay lại. Không sửa `.env`, `.env.vps` hoặc khởi động lại website khách.
- Validate Flyway chỉ đọc, với đúng các cờ lịch sử hiện tại của VPS: **461 migration hợp lệ**, chỉ **V1086/V1087** đang chờ. Cấu hình môi trường backend được dựng từ `.env.vps` khớp toàn bộ các biến của container đang chạy, không có biến thêm/đổi.

### Đã triển khai và đối chiếu

- Nạp lần lượt bằng `docker compose --env-file .env.vps up -d --no-deps --no-build bigbike-backend`, sau khi backend healthy mới nạp `bigbike-admin` với cùng các cờ. `docker inspect` xác nhận hai container đang chạy đúng hai image đã kiểm thử, đều **healthy**; backend không khởi động lại ngoài dự kiến và không bị thiếu bộ nhớ.
- `docker exec -i bigbike-postgres ... psql -X -At` xác nhận **V1086/V1087 thành công**. Toàn bộ **104 bài đã được điền khối**, gồm 103 bài có nội dung và một bài rỗng (`[]`); tổng **10.379 khối**, tối đa **191/bài**. Cả **185 bài có mảng body_blocks**, không còn bài thiếu khối.
- Dấu kiểm `protected-after-deploy.txt` khớp hoàn toàn `protected-before.txt`: nội dung VI/EN, thời gian, trạng thái và mọi trường bài viết ngoài phần khối, cùng toàn bộ sản phẩm/lựa chọn/thuộc tính/ảnh lựa chọn được giữ nguyên.
- Backend health trả **200 / UP**. HTTPS quản trị và website trả **200** khi kiểm tra đúng tên miền/SNI qua Nginx tại VPS (`curl --noproxy '*' --resolve <domain>:443:127.0.0.1 ...`). HTML quản trị khớp dấu SHA-256 của bản build đã kiểm thử. Container website giữ nguyên ID và thời điểm khởi động.
- Kiểm tra HTTPS đi qua Cloudflare bằng công cụ HTTP tự động bị trả 403, nên kết quả 200 ở trên xác nhận đường Nginx/dịch vụ tại VPS; không dùng kết quả này để khẳng định kiểm tra qua mọi mạng bên ngoài.
- Chạy lại Playwright chỉ đọc với backend **sau triển khai**, trên tài nguyên admin trùng bản đang phục vụ: **1 kịch bản đạt / 29,8 giây**. Mở sản phẩm 75 lựa chọn và bài 111 khối, sửa ô bảng trong biểu mẫu chưa lưu, kiểm tra 1440/768/375 px; không có yêu cầu ghi dữ liệu, lỗi console hay API. Log backend sau triển khai không có mức ERROR.

### Phần còn chờ quyết định nghiệp vụ

- Bảng **Chiều dài**: chờ quyết định nhóm phù hợp; giữ nguyên sản phẩm và hai giá trị 60/90 cm.

Log kiểm tra cục bộ nằm trong `/tmp/bigbike-admin-vps-artifact-e2e.log`, `/tmp/bigbike-admin-product-alltests.log`, `/tmp/bigbike-backend-product-final-tests.log`, `/tmp/bigbike-vps-admin-build.log`, `/tmp/bigbike-vps-backend-build.log`, `/tmp/bigbike-product-postdeploy-e2e.log`, `/tmp/bigbike-product-backend-deploy.log`, `/tmp/bigbike-product-admin-deploy.log`. Ảnh kiểm tra nằm trong `bigbike-admin/e2e/.artifacts/product-choices-recovery-*/`; không đưa dữ liệu runtime, thông tin đăng nhập hoặc bản sao lưu vào Git.
