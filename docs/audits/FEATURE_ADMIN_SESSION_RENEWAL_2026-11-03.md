# Admin tự đăng xuất khi mở nhiều tab — 2026-11-03

## Phạm vi và căn cứ

Kiểm tra đăng nhập, khôi phục phiên khi tải trang, gia hạn sau 401, đối chiếu quyền
khi focus/chu kỳ 30 giây, tín hiệu giữa các tab, tải ảnh/xuất dữ liệu và bản nháp sản phẩm.
Không thay đổi website khách hàng, backend, tuổi thọ token, quyền hay schema.

- `docs/engineering/API_CONTRACT.md` — Admin auth endpoints: cookie được ưu tiên,
  refresh một lần, token thiếu/hết hạn/thu hồi trả 401; bổ sung phối hợp trình duyệt trước code.
- `docs/engineering/PERMISSION_MATRIX.md` — Admin access-change lifecycle: khóa/tạm
  ngưng tài khoản hoặc đổi mật khẩu thu hồi refresh sessions và access version;
  đổi quyền/role giữ phiên và tải lại hồ sơ quyền.
- `docs/engineering/API_FLOW_MAP.md` — Admin session renewal and unsaved product forms.
- [W3C Web Locks](https://www.w3.org/TR/web-locks/) — khóa theo origin, giữ tới
  khi promise của callback kết thúc; không dùng khóa hết hạn tự đặt trong storage.
- `AGENTS.md` §§2, 5.6, 17: docs trước code, bảo toàn thay đổi có sẵn, không sửa
  trạng thái container khi chẩn đoán, báo phần chưa kiểm chứng.

## Bằng chứng runtime chỉ đọc

Đã chạy `docker ps --format '{{.Names}} {{.Status}}'`: Admin, backend và DB đang healthy.
Đọc `docker logs --since 2026-11-03T03:46:55Z --until 2026-11-03T05:45:05Z bigbike-admin`
qua bộ lọc chỉ tổng hợp thời gian/endpoint/mã HTTP; không lưu token, địa chỉ IP,
thông tin tài khoản hay nội dung yêu cầu trong báo cáo.

| Giờ Việt Nam | Gia hạn | Đăng nhập tiếp theo trong cửa sổ kiểm |
|---|---|---|
| 10:47:13 | 1 × 200, 1 × 401 | 10:47:15 và 10:47:16, đều 200 |
| 11:48:34 | 1 × 200, 1 × 401 | 11:48:39 và 11:48:40, đều 200 |
| 12:44:45 | 1 × 200, 1 × 401 | Không thấy trong cửa sổ đến 12:45:05 |

Log không ghi giá trị cookie và không chứng minh hai request mang cùng token.
Chuỗi gây lỗi được xác minh thêm bằng code và kiểm thử; không suy ra trực tiếp
từ việc hai request nằm trong cùng một giây.

## Finding

### F1 — Hai tab cùng gia hạn khiến một tab kéo các tab còn lại về đăng nhập

- **Mức độ:** High. **Đã sửa.**
- **Bằng chứng code trước sửa:** `src/lib/adminApi.js` có `refreshInFlight` chỉ trong
  một JS heap; bootstrap và các request 401 gọi refresh không có khóa giữa tab.
  `AuthController.refresh` ưu tiên cookie chung, `AdminAuthService.refresh` thu hồi
  token cũ khi cấp cặp mới. `auth.jsx` chuyển một lỗi gia hạn thành `FORCE_REAUTH`
  trên `bigbike-admin-access`; `App.jsx` thay editor bằng `LoginScreen`.
- **Sửa:** Web Lock chung cho refresh/login/logout, giữ khóa qua fetch và đọc body.
  Mỗi tab chờ rồi dùng cookie hiện hành; không gửi refresh token riêng cũ trong body.
  Token không chuyển qua BroadcastChannel hoặc browser storage. Nhiều 401 cùng tab
  dùng chung promise; 401 về muộn dùng access token đã đổi. JSON/blob/export/upload
  đều dùng cùng cơ chế và chỉ replay một lần. Kết quả đến muộn sau khi hủy phiên
  không được khôi phục token hoặc trạng thái hồ sơ cũ.

### F2 — Mất mạng hoặc máy chủ lỗi cũng bị coi là hết phiên

- **Mức độ:** High. **Đã sửa.**
- **Bằng chứng:** trước sửa `performTokenRefresh` trả `null` cho mọi non-OK, body
  hỏng và exception; caller xóa token/phát báo đăng xuất. Bootstrap còn chuyển
  mọi lỗi `/auth/me` thành unauthenticated.
- **Sửa:** chỉ refresh 401 hoặc replay 401 với token hiện hành mới kết thúc phiên.
  Network/5xx/429/response hỏng/không có Web Locks trả lỗi và giữ editor/cache.
  Lỗi bootstrap tạm thời có nút Thử lại; 403 quyền không tự đăng xuất.
  Các tín hiệu thu hồi từ máy chủ vẫn được thực thi và truyền giữa tab.

### F3 — Bản nháp sản phẩm chưa kịp tự lưu trước khi mất phiên

- **Mức độ:** Medium. **Đã sửa trong phạm vi sản phẩm.**
- **Bằng chứng:** editor debounce 10 giây; mỗi lần gõ lại hủy timer. Chuyển sang
  màn đăng nhập unmount editor và hủy timer cuối mà không lưu phần vừa gõ.
- **Sửa:** trước khi xóa cache/unmount, phát sự kiện cục bộ để editor lưu ngay
  form dirty bằng tiện ích autosave có sẵn; cũng lưu khi `pagehide`. Không tự gửi
  sản phẩm lên server, vẫn yêu cầu người dùng chủ động khôi phục bản nháp.
- **Giới hạn:** không bao phủ editor khác, mật khẩu, byte tệp chưa tải lên, crash,
  storage bị chặn/đầy. TTL cũ một giờ; key sản phẩm hiện vẫn chung giữa tab/tài
  khoản nên cùng sửa một sản phẩm có thể ghi đè bản nháp; server mới hơn thì
  không đề nghị khôi phục. Không coi đây là hệ thống bảo vệ mọi dữ liệu nhập.

## Kiểm thử và triển khai

- **Đạt:** 27 kiểm thử tập trung trong ba file `adminApi.session.test.js`,
  `auth.test.jsx`, `useFormAutosave.test.jsx` (Vitest, tối đa hai worker).
- **Đạt:** `./mvnw -Dtest=AdminAuthApiTest,AdminAuthSecurityTest test`: 21 tests,
  không lỗi/bỏ qua; chạy H2 riêng của test, không ghi DB đang vận hành. Gồm token
  xoay vòng, token đã thu hồi/hết hạn, khóa tài khoản và đổi mật khẩu.
- **Đạt:** `E2E_NO_WEBSERVER=1 npx playwright test session-renewal.spec.ts --retries=0`
  trên bản build source preview `localhost:4280`, backend đang chạy thật.
  Hai JS heaps/cookie jar chung, bootstrap song song, bốn refresh thực đều 200,
  401 chủ động để kích hoạt gia hạn, network/503 giữ tên đang nhập, logout chỉ
  thu hồi phiên test; giữ lại cookie đã thu hồi để kiểm thật refresh 401, cả hai
  tab về login và tên vừa gõ xuất hiện trong autosave (lần chạy cuối 11,9 giây).
  Mô phỏng hai cửa sổ visible để kích hoạt focus, không bỏ qua chính sách thật
  rằng tab nền không tự đối chiếu hồ sơ. Không tạo/sửa sản phẩm hoặc chạy cleanup DB.
  Lượt đầu của kịch bản bị sai giả định visibility/thời điểm sẵn sàng; đã chỉnh
  điều kiện chờ editor và kích hoạt đúng trạng thái, chạy lại đạt.
- **Đạt:** build Admin production qua preview; kiểm tra cấu hình Compose bằng
  `docker compose --env-file .env.vps config --quiet`; `git diff --check`;
  `bash deploy/nginx/tests/domain-boundary-config-test.sh --self-test`.
- **Đạt:** toàn bộ Vitest Admin: **129 file / 1.226 test**, lệnh
  `npm test -- --maxWorkers=2`. Lượt đầu không giới hạn worker timeout ở các screen
  không liên quan; đã dừng tiến trình test của phiên này và chạy lại có giới hạn.
- **Đạt:** `npm run lint` (runtime guard, i18n, định dạng, ESLint), kiểm lại riêng
  `App.jsx` sau khi chuyển việc xóa cache của tín hiệu thu hồi vào sau flush.
  Chạy lại bốn file App/auth/renewal/autosave sau lần sửa cuối: **39/39 đạt**.
- **Chưa kiểm:** mobile/trình duyệt khác Chromium, mất response sau khi server
  đã commit, tab bị kill giữa refresh, mọi loại editor/upload. Không có migration,
  không tăng TTL hoặc thêm grace period chấp nhận refresh token cũ.

Theo chỉ đạo bổ sung của chủ shop, sau kiểm tra chạy chính xác
`docker compose --env-file .env.vps up -d --build`. Lệnh build toàn stack lấy cả
những thay đổi đã tồn tại trước phiên này; các thay đổi đó được giữ nguyên.
Không sửa `.env` hoặc `.env.vps`, không commit/push, không lưu token trong báo cáo.

### Kết quả triển khai

- `docker compose --env-file .env.vps up -d --build` kết thúc **exit 0**.
  Image Admin mới: `sha256:f3fbe57292bad8e80267d5352e4b5567879d200dd90f41fc70ab7a1cdc1731a7`.
  Image cũ còn sẵn theo ID `sha256:dd439b9985d3115f5353ee9a22a886b4fbe755b8c85bde3eea833c7415818143`.
- Website và backend dùng lại đúng image đang vận hành, chỉ Admin được recreate.
  Không sửa cấu hình môi trường hoặc tác động container bằng lệnh khác ngoài
  lệnh triển khai đã được chủ shop yêu cầu.
- `docker compose --env-file .env.vps ps --format '{{.Name}} {{.State}} {{.Health}}'`:
  Admin, backend, web, Postgres, Redis, MinIO đều `running healthy`.
- `curl` đọc `https://admin.bigbike.vn/admin/products/new`: **200**.
- `E2E_BASE_URL=https://admin.bigbike.vn E2E_NO_WEBSERVER=1 npx playwright test session-renewal.spec.ts --retries=0`:
  **1/1 đạt, 11,0 giây**, trên bản đã triển khai. Cùng kịch bản hai tab, lỗi tạm
  thời, cookie thực sự đã thu hồi và autosave như trên. Không ghi sản phẩm/dữ liệu
  nghiệp vụ; chỉ tạo và thu hồi phiên đăng nhập riêng cho kiểm thử.
- Tab đã mở trước triển khai tiếp tục giữ JavaScript cũ. Người vận hành cần
  **lưu phần đang nhập rồi tải lại tất cả tab Admin một lần**. Chưa xác minh phối
  hợp giữa tab bản cũ và tab bản mới; khóa chỉ có hiệu lực đầy đủ khi các tab đã
  nhận cùng bản sửa. Không tự ép tải lại để tránh làm mất form đang mở.
