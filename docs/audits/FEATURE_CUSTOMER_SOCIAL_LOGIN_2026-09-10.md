# Audit đăng nhập/đăng ký Google và Facebook — 2026-09-10

## Phạm vi

Khách mở trang đăng nhập hoặc đăng ký → chọn Google/Facebook → nhà cung cấp trả hồ sơ →
BigBike tạo hoặc nhận diện tài khoản → lưu email khi hợp lệ → tạo phiên đăng nhập → nhân viên
xem hồ sơ trong khu vực Khách hàng.

Tính năng còn sống tại `bigbike-web` + `bigbike-backend`; `bigbike-admin` chỉ đọc hồ sơ khách.
`docs/business/MODULE_CATALOG.md` ghi Customer account là `CONFIRMED_FROM_CODE`.

## Căn cứ chuẩn

- `docs/business/BUSINESS_RULES.md` — `CUSTOMER_RULE_010`: tài khoản mật khẩu và tài khoản
  Google/Facebook là các danh tính riêng; khi email nhà cung cấp đã thuộc tài khoản mật khẩu,
  tài khoản mạng xã hội mới được tạo với email trống.
- `docs/business/BUSINESS_RULES.md` — `CUSTOMER_RULE_011`: chỉ tạo tài khoản mạng xã hội mới từ
  luồng đăng ký có đồng ý Chính sách bảo mật.
- `docs/business/WORKFLOW_OVERVIEW.md` — Account Login Workflow, bước 2c–4.
- `docs/engineering/API_CONTRACT.md` — Social login (OAuth2) flow.
- `docs/engineering/DATA_CONTRACT.md` — `customer_oauth_links`, gồm trường hợp email trùng tài
  khoản mật khẩu.
- `docs/engineering/INTEGRATION_GUIDE.md` — Social Login: Facebook có thể không trả email; lần
  đăng nhập sau chỉ bổ sung được khi email chưa thuộc khách hàng khác.

## Bản đồ ba đầu

| Đầu | Thành phần | Vai trò |
|---|---|---|
| Website | `SocialLoginButtons.tsx`, `LoginForm.tsx`, `RegisterForm.tsx` | Mở luồng Google/Facebook, giữ trang quay lại và hiển thị lỗi |
| Máy chủ | `CustomerOAuthController`, `CustomerOAuthService` | Đổi mã xác thực, nhận hồ sơ, nối/tạo tài khoản và bổ sung email khi có thể |
| Dữ liệu | `customers`, `customer_oauth_links` | Lưu hồ sơ khách và danh tính Google/Facebook riêng |
| Quản trị | `CustomerListScreen.jsx`, `CustomerDetailScreen.jsx` | Hiển thị email; dùng dấu `—` khi email trống |

## Kết quả dữ liệu đang chạy

Kiểm tra chỉ đọc trên `bigbike-postgres`, không lấy ra địa chỉ email hay thông tin nhận diện khách:

| Nhà cung cấp | Liên kết | Có email | Không có email |
|---|---:|---:|---:|
| Google | 7 | 6 | 1 |
| Facebook | 2 | 1 | 1 |

Có 8 hồ sơ khách mạng xã hội; một hồ sơ liên kết cả Google và Facebook. Hai hồ sơ không có email
đều `ACTIVE`, không có mật khẩu và không có mốc xác thực email. Dữ liệu hiện tại không lưu lại
email thô mà nhà cung cấp từng trả ở thời điểm đăng nhập, nên không thể phân biệt hồi tố chắc chắn
từng hồ sơ thiếu email vì nhà cung cấp không trả email hay vì email đã thuộc tài khoản mật khẩu.

## Kết luận đối chiếu

Không phát hiện lỗi làm email biến mất ngẫu nhiên:

1. Google/Facebook trả email đã xác minh và email chưa bị tài khoản khác giữ → BigBike lưu email.
2. Facebook không trả email (khách không cấp quyền hoặc quyền cũ chưa có email) → tài khoản vẫn
   được tạo, email để trống.
3. Email mạng xã hội trùng tài khoản mật khẩu → theo `CUSTOMER_RULE_010`, BigBike cố ý không gộp
   hai tài khoản và để email của tài khoản mạng xã hội trống.
4. Ở lần đăng nhập sau, nếu nhà cung cấp bắt đầu trả email và email chưa thuộc khách khác, BigBike
   tự bổ sung email; nếu email đã có chủ, hệ thống tiếp tục để trống để tránh chiếm tài khoản.

Khu vực quản trị hiện chỉ hiện email trống bằng dấu `—`; chưa cho nhân viên biết hồ sơ đến từ
Google hay Facebook. Đây là giới hạn quan sát của màn hình, không phải lỗi lưu dữ liệu và chưa có
yêu cầu chuẩn để thay đổi API/UI.

## Hạng mục kiểm thử được củng cố

### F1 — Thiếu kiểm thử khóa hai nhánh bổ sung email sau lần đăng nhập đầu

- **Mức độ:** Low
- **Lệch ở đâu:** hành vi máy chủ đã có và tài liệu đã mô tả, nhưng bộ kiểm thử chưa khóa riêng
  nhánh bổ sung email thành công và nhánh từ chối khi email đã thuộc khách khác.
- **Bằng chứng:** `CustomerOAuthService.backfillEmailIfMissing`,
  `CustomerOAuthApiTest.java`, `docs/engineering/INTEGRATION_GUIDE.md` §Social Login.
- **Rule liên quan:** `CUSTOMER_RULE_010`.
- **Hậu quả vận hành:** một thay đổi sau này có thể làm hỏng cơ chế bổ sung email mà kiểm thử cũ
  không phát hiện trực tiếp.
- **Trạng thái:** Đã sửa — bổ sung hai kiểm thử, không đổi hành vi chạy thật.

## Kiểm chứng

- `docker compose ps`: web, admin, backend, PostgreSQL, Redis và MinIO đều đang healthy/running.
- Cấu hình Google/Facebook trong `bigbike-backend`: đủ client id/secret và URL callback; không in
  secret ra báo cáo.
- Gọi chỉ đọc hai đường bắt đầu đăng nhập: đều trả `302` tới đúng Google/Facebook; Google yêu cầu
  `openid email profile`, Facebook yêu cầu `email,public_profile` kèm `auth_type=rerequest`.
- `./mvnw -Dtest=CustomerOAuthApiTest test`: 32/32 đạt sau khi thêm hai test bảo vệ mới.
- `./mvnw test`: 1.761 kiểm thử đạt, 0 thất bại, 0 lỗi, 1 bỏ qua.
- `PW_BASE_URL=http://localhost:3000 npx playwright test e2e/social-login.e2e.ts --workers=1`:
  12/12 đạt trên website container.
- Vòng đăng nhập thật qua màn đồng ý của Google/Facebook: `Not run` — cần một tài khoản thử của
  từng nhà cung cấp và sự đồng ý tương tác; audit không dùng tài khoản cá nhân của khách.
