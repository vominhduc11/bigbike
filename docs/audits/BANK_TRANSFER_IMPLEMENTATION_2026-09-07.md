# Bàn giao luồng chuyển khoản — 2026-09-07

Đã triển khai mã nguồn và cập nhật tài liệu trước khi sửa mã. Chưa áp dụng bản dựng mới vào các container đang phục vụ. Báo cáo này ghi nhận kết quả triển khai; quy tắc chuẩn vẫn nằm trong tài liệu nghiệp vụ và kỹ thuật.

## Phạm vi đã hoàn tất

- Website: sau đặt đơn chuyển khoản, mở hướng dẫn tại đường dẫn xác nhận với `step=bank-transfer`; lấy ngân hàng từ bốn khóa cài đặt hiện có và số tiền từ đơn. Hai nút đi tiếp chỉ điều hướng. Có trạng thái chờ thanh toán, hỗ trợ khi thiếu thông tin, thử lại khi lỗi tải; giữ cách đọc BACS.
- Chống đặt trùng: khóa thao tác trước kiểm tra biểu mẫu; lưu khóa gửi lặp, nội dung yêu cầu và kết quả trong phiên trình duyệt; khôi phục cả kết quả có thông báo thay đổi giá. Khi mất phản hồi, thử lại cùng yêu cầu/cùng khóa, kể cả giỏ đã chuyển thành đơn. Đăng xuất xóa thông tin phục hồi phiên.
- Quản trị: trạng thái thanh toán và nút xác nhận đủ tiền ở đầu chi tiết đơn. Hộp xác nhận nêu mã đơn và tổng tiền; cập nhật chi tiết, lịch sử và hành động sau thao tác. Phiên khác đọc lại dữ liệu khi nhận thông báo.
- Máy chủ: chỉ `orders.write` được xác nhận đơn BANK_TRANSFER vận hành ở PENDING/PROCESSING. Đối chiếu đúng một thanh toán khớp phương thức, tổng và loại tiền; từ chối dữ liệu bất thường. Khóa cùng đơn khi nhận tiền, hủy và đổi trạng thái; gửi lặp không thêm lịch sử. Thanh toán và lịch sử bắt buộc cùng thành công hoặc cùng hoàn tác.
- Xác nhận tiền không đổi trạng thái đơn. Hoàn thành vẫn là xác nhận đã giao thành công, kèm điều kiện đã nhận đủ tiền. COD, quy tắc hủy và hoàn tiền thủ công giữ nguyên.

Căn cứ: [BUSINESS_RULES.md](../business/BUSINESS_RULES.md) `ORDER_RULE_001/002`, `PAY_RULE_001/002/003`; [STATE_MACHINES.md](../business/STATE_MACHINES.md) phần đơn hàng/thanh toán; [API_CONTRACT.md](../engineering/API_CONTRACT.md) mục “Manual bank receipt”; [DATA_CONTRACT.md](../engineering/DATA_CONTRACT.md) phần Payment. Các tài liệu luồng, phân quyền, tích hợp và nghiệm thu đã đồng bộ. OpenAPI bổ sung lệnh xác nhận và phương thức thanh toán trong chi tiết quản trị/khách/tra cứu đơn.

## Kiểm tra đã chạy

| Phần | Kết quả |
|---|---|
| Backend — đặt đơn | `Phase1FCheckoutApiTest`: 34 đạt |
| Backend — đọc đơn | `Phase1GOrderReadApiTest`: 24 đạt |
| Backend — quản trị đơn | `Phase1HAdminOrderApiTest`: 20 đạt sau sửa quyền đọc trong chính kiểm thử mới |
| Backend — PostgreSQL thật trong container kiểm thử riêng | `BankTransferPostgresIntegrationTest`: 5 đạt; hai lần xác nhận đồng thời, cạnh tranh hoàn thành/hủy, hoàn tác cả thanh toán/lịch sử, đơn lịch sử chỉ đọc |
| OpenAPI | `OpenApiContractDriftTest`: 5 đạt; chạy lại sau cập nhật schema cuối cùng vẫn đạt |
| Đóng gói backend | `mvnw -B -DskipTests package`: đạt |
| Website — toàn bộ kiểm thử | 93 tệp, 584 kiểm thử đạt |
| Website — lint | Đạt; chạy lại sau chỉnh sửa cuối cùng vẫn đạt |
| Website — build | Biên dịch thành công; dừng ở kiểm tra TypeScript do `.next/dev/types` tham chiếu các đường dẫn trang cũ |
| Quản trị — toàn bộ kiểm thử | Lần đầu: 1.133 đạt, 6 lỗi và 1 bộ không nạp được vì thiếu tệp mẫu sản phẩm |
| Quản trị — chạy lại các lỗi có thể kiểm tra | 63/63 đạt khi giới hạn một worker và đặt `VITE_STOREFRONT_BASE_URL=https://bigbike.vn` chỉ trong tiến trình kiểm thử; không sửa `.env` |
| Quản trị — build / bản dịch | Đạt; 3.818 khóa Việt/Anh khớp nhau |
| Quản trị — lint | Lệnh tổng dừng vì định dạng ở 400 tệp có sẵn; ESLint toàn app chạy riêng đạt, định dạng 8 tệp quản trị đã sửa đạt |
| Diff | `git diff --check`: đạt |

Các kiểm thử website mới bao phủ hai nút chỉ điều hướng, COD/BACS, tài khoản thiếu, lỗi tải, nhãn Anh/Việt, dữ liệu bất thường, gửi lặp trước khi kiểm tra biểu mẫu xong, khôi phục sau mất phản hồi và thông báo thay đổi giá. Kiểm thử quản trị bao phủ quyền, lịch sử, đơn kết thúc, COD và thao tác xác nhận tiền.

Lệnh chính đã chạy từ từng thư mục ứng dụng:

```powershell
# bigbike-backend
.\mvnw.cmd -B '-Dtest=Phase1FCheckoutApiTest,Phase1GOrderReadApiTest,Phase1HAdminOrderApiTest,OpenApiContractDriftTest,BankTransferPostgresIntegrationTest' test
.\mvnw.cmd -B '-Dtest=Phase1HAdminOrderApiTest' test
.\mvnw.cmd -B '-Dtest=OpenApiContractDriftTest' test
.\mvnw.cmd -B -DskipTests package

# Mỗi frontend
npm test
npm run lint
npm run build

# bigbike-admin: tách kiểm tra cú pháp khỏi định dạng toàn kho
npx eslint .
$env:VITE_STOREFRONT_BASE_URL = 'https://bigbike.vn'
npm test -- src/lib/urlPolicies.test.js src/screens/product-detail/constants.test.js src/screens/RedirectListScreen.test.jsx --maxWorkers=1
```

Backend đã chạy năm bộ liên quan, tổng 88 kiểm thử; chưa chạy toàn bộ bộ kiểm thử backend. Log backend ở `bigbike-backend/target/bank-transfer-*.log`; log frontend ở `%TEMP%/bigbike-*-bank-*.log` trên máy thực hiện.

## Giới hạn xác minh và bước áp dụng

1. Website còn lỗi kiểm tra kiểu có sẵn: ngoài đường dẫn sinh tự động cũ, kiểm tra đọc bằng TypeScript API bỏ riêng cache dev tìm thấy 93 lỗi trong 13 tệp kiểm thử không sửa ở task này (thiếu tên toàn cục Vitest, kiểu của ảnh giả lập và assertion). Không sửa cấu hình kiểm tra để bỏ qua lỗi. Bộ duyệt tự động chặn xóa `.next/dev/types` với lý do chung “blocked by policy”; thư mục được giữ nguyên.
2. Bộ kiểm thử mẫu sản phẩm quản trị không nạp được vì thiếu `product-template/mau-day-du.json`. Bộ thư viện quản trị local cũng thiếu lệnh Prettier dù đã khai báo; kiểm tra định dạng dùng bản Prettier hiện có của website qua PATH tiến trình. Không cài lại thư viện hoặc định dạng lại tệp ngoài phạm vi.
3. Chưa kiểm tra luồng mới bằng trình duyệt trên hệ thống thật ở điện thoại/máy tính và hai ngôn ngữ: các container đang chạy bản dựng cũ, không gắn trực tiếp mã nguồn. Đã xác nhận stack bằng `docker ps`; không khởi động lại hay thay dữ liệu đơn thật. Container PostgreSQL do Testcontainers tạo chỉ chứa dữ liệu kiểm thử riêng.
4. Trước khi áp dụng: xử lý lỗi nền của bản dựng website, dựng lại cả ba ứng dụng trong đợt triển khai được chủ dự án cho phép, kiểm tra cấu hình ngân hàng, rồi nghiệm thu COD và chuyển khoản bằng đơn kiểm thử được chỉ định. Kiểm tra thêm hai phiên quản trị đồng thời và giao diện 375/768/1440px Việt/Anh.
5. Không cần migration; không sửa `.env`, không tự đánh dấu đơn cũ đã thanh toán, không thêm cột trạng thái thanh toán trên đơn. Nội dung tệp `package-lock.json` có sẵn ở gốc repo được giữ nguyên và đưa vào cùng thay đổi theo yêu cầu đẩy toàn bộ lên GitHub.
