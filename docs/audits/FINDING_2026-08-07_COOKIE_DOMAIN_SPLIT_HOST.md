# Finding: cookie khách hàng host-only sau cutover domain — khách không mua hàng được

- **Status:** FIXED + DEPLOYED 2026-08-07 (F-1 và F-2 phần code). F-3 là sự cố vận hành riêng, đã tự khỏi.
  **Còn nợ:** F-2 rào cản #2 và #3 (khai báo redirect URI ở Google Cloud Console và Facebook App)
  là thao tác của owner, chưa làm — đăng nhập social vẫn chưa chạy thật cho tới khi xong.
- **Trigger:** owner hỏi "đăng nhập bằng Facebook/Google chưa hoàn thiện đúng không". Đào vào luồng
  OAuth thì phát hiện luồng đó không thể chạy vì một lỗi nằm dưới nó, ảnh hưởng rộng hơn nhiều.

## F-1 — Root cause: `Set-Cookie` không có `Domain`, cookie chỉ thuộc `api.bigbike.vn` (ĐÃ SỬA)

- **Location:** `bigbike-backend/.../config/CustomerAuthCookies.java` → `addCookie()`;
  `bigbike-backend/.../api/cart/CartController.java` → `setGuestCookie` / `setCsrfCookie` (bản sao thứ hai
  của cùng logic, cũng thiếu `Domain`).
- **Evidence (đo trên hệ thống thật 2026-08-07):**

  ```
  $ curl -s -i https://api.bigbike.vn/api/v1/cart | grep -i set-cookie
  set-cookie: bb_guest_id=...; Path=/; Max-Age=2592000; Secure; SameSite=Strict
  set-cookie: bb_csrf=...;     Path=/; Max-Age=2592000; Secure; SameSite=Strict
  ```

  Không có thuộc tính `Domain=` → cookie host-only, chỉ gắn với `api.bigbike.vn`.
  Trước cutover 2026-08-06 web và API cùng host `103.1.236.148` (khác port; cookie **bỏ qua port**)
  nên vẫn dùng chung được. Sau cutover chúng thành hai host khác nhau.

- **Impact — hai tầng, đều im lặng:**

  1. **Mọi thao tác ghi của khách trả 403.** `bigbike-web/lib/api/client-api.ts:39` đọc `bb_csrf`
     từ `document.cookie` để dựng header `X-CSRF-Token`. Script chạy trên `bigbike.vn` không thể
     đọc cookie thuộc `api.bigbike.vn` → header luôn rỗng → `CustomerCsrfFilter` chặn.
     Chứng minh trực tiếp:

     ```
     POST /api/v1/cart/items  (không header)  -> 403 {"code":"CSRF_INVALID"}
     POST /api/v1/cart/items  (có header)     -> 400 VALIDATION_ERROR  (đã qua được CSRF)
     ```

     Phạm vi: thêm/sửa/xoá giỏ hàng, **thanh toán**, sửa hồ sơ + địa chỉ, gửi đánh giá.
  2. **Khách đăng nhập rồi vẫn bị đá ra.** `bigbike-web/proxy.ts:281` chặn `/tai-khoan/**` dựa trên
     sự hiện diện của cookie `bb_session` trong request tới `bigbike.vn` — cookie đó không bao giờ
     có mặt ở đây. Đây cũng là lý do luồng OAuth không thể hoàn tất: callback redirect thẳng về
     `/tai-khoan/` và bị bật ngược ra `/dang-nhap/`.

- **Số liệu ủng hộ:** toàn bộ bảng `customers` chỉ có **1** tài khoản từng đăng nhập, `last_login_at`
  gần nhất **2026-07-22** — trước cutover. `customers` có **0** dòng `oauth_provider IS NOT NULL`.

- **Fix:**
  - Thêm cấu hình `bigbike.cookies.domain` (`BIGBIKE_COOKIES_DOMAIN`), áp `Domain` trong
    `CustomerAuthCookies.addCookie` khi giá trị không rỗng. Rỗng = host-only, đúng cho local dev
    (`localhost:3000` + `localhost:8080` chung host).
  - `CartController` bỏ 3 hàm dựng cookie riêng, dùng chung `CustomerAuthCookies`
    (`setGuestId` / `clearGuestId` / `setGuestCsrf`) — trước đây là bản sao logic thứ hai, và chính
    nó phát ra `bb_csrf` cho khách vãng lai.
  - **Dọn cookie cũ khi triển khai:** cookie host-only và cookie có `Domain` là **hai mục khác nhau**
    trùng tên; trình duyệt gửi CẢ HAI tới host API và phía server có thể đọc nhầm cái cũ — đúng
    lại lỗi 403 mà thay đổi này định sửa. Nên khi có cấu hình `Domain`, mỗi `Set-Cookie` được đặt
    trước một `Set-Cookie` host-only `Max-Age=0` cùng tên + path để khai tử bản cũ. Tự tắt khi
    không cấu hình `Domain`; hết tác dụng sau khi mọi khách đã được cấp cookie mới.
  - Wiring: `application.properties`, `docker-compose.yaml`, `.env.example`, `.env.vps.example`,
    `.env.vps` (`.bigbike.vn`).
  - Test chặn hồi quy: `src/test/.../config/CustomerAuthCookiesTest.java` (11 test) — khẳng định
    `Domain` có mặt trên cả 4 cookie khách, có mặt cả khi xoá cookie, vắng mặt khi cấu hình rỗng,
    `bb_csrf` vẫn đọc được bằng script trong khi `bb_session` vẫn `HttpOnly`, và bản khai tử
    host-only luôn đứng TRƯỚC bản mới, đúng path.
  - Đã chạy lại `Phase1ECartApiTest`, `Phase1FCheckoutApiTest`, `CustomerCsrfFilterTest`,
    `CorsConfigTest`, `Phase1K1ContractHardeningTest`: 83/83 đạt.

- **Đã triển khai** 2026-08-07T03:56:28Z bằng `docker compose --env-file .env.vps up -d --build
  bigbike-backend` (owner duyệt trước). Nghiệm thu trên hệ thống thật:

  ```
  set-cookie: bb_csrf=;    Path=/; Max-Age=0; ...                       <- khai tử bản host-only
  set-cookie: bb_csrf=...; Path=/; Domain=.bigbike.vn; Max-Age=2592000  <- bản dùng chung

  POST /api/v1/cart/items + X-CSRF-Token  ->  400 VALIDATION_ERROR (body rỗng)
                                              tức đã QUA cổng CSRF, trước đó là 403 CSRF_INVALID
  ```

## F-2 — Đăng nhập social: đã code đủ nhưng chưa từng chạy được lần nào

Không phải "chưa làm". `CustomerOAuthController` + `CustomerOAuthService` gọi HTTP thật tới Google
và Facebook, có state chống giả mạo (so sánh constant-time), có `linkOrCreate` chống chiếm tài khoản,
`SecurityConfig` đã mở public đúng phạm vi GET, `V129` đã có cột, `bigbike-web` đã render đủ hai nút.
Chặn đứng ở ba chỗ ngoài code:

| # | Rào cản | Bằng chứng |
|---|---|---|
| 1 | F-1 ở trên | callback về `/tai-khoan/` bị proxy bật ra ngay |
| 2 | Google chưa khai redirect URI | `GET https://api.bigbike.vn/api/v1/customer/auth/oauth/google/authorize` → Google trả `Error 400: redirect_uri_mismatch` cho `https://api.bigbike.vn/api/v1/customer/auth/oauth/google/callback` |
| 3 | Facebook cần App Review cho scope `email` | đã cảnh báo sẵn ở `INTEGRATION_GUIDE.md` §Social Login |

**8 lỗ hổng chất lượng trong chính luồng OAuth — ĐÃ SỬA + TRIỂN KHAI 2026-08-07:**

| # | Trước | Sau |
|---|---|---|
| 1 | `?error=oauth` không được `LoginFormIsland.tsx` đọc → trang login trắng trơn khi hỏng | 4 mã lỗi phân biệt (`OAuthError.java`) + `lib/auth/oauth-error.ts` + chuỗi song ngữ `Auth.social.error*`; mã lạ (kể cả `oauth` cũ) rơi về thông báo chung, không bao giờ im lặng |
| 2 | `errorUrl()` đóng cứng `/dang-nhap/` | Chọn `/dang-nhap/` hay `/en/login/` theo locale mang trong cookie state |
| 3 | Không kiểm `status` → tài khoản `BLOCKED` vẫn được cấp session rồi kẹt vòng lặp | `requireActive` ném `oauth_blocked` trước khi tạo session |
| 4 | `lastLoginAt` không cập nhật từ lần đăng nhập social thứ 2 | `touchLogin` chạy trên mọi nhánh; kèm gắn đơn khách vãng lai (parity với đăng nhập mật khẩu) |
| 5 | Email Facebook mặc định coi là đã xác thực → nhận nuôi mọi tài khoản trùng email | Chỉ nhận nuôi khi tài khoản cũ **đã xác thực email** hoặc **không có mật khẩu**; còn lại tạo tài khoản riêng với `email = null` |
| 6 | Một khách chỉ giữ 1 provider, link mới ghi đè âm thầm | Bảng `customer_oauth_links` (V378), unique theo `(customer_id, provider)` — giữ được cả Google lẫn Facebook |
| 7 | State không gắn provider → state của Google dùng được ở callback Facebook | Payload cookie đổi thành `provider\|nonce\|base64url(returnTo)`, so khớp constant-time cả provider |
| 8 | Hai endpoint OAuth không có giới hạn tần suất | Tier `OAUTH` trong `RateLimitingFilter` — 20 req/phút/IP |

Bổ sung ngoài danh sách: `appsecret_proof` cho Graph API; `SecurityConfig` thu hẹp `permitAll` từ
`oauth/**` xuống đúng 2 đường `authorize`/`callback` để endpoint `links` mới nằm sau `ROLE_CUSTOMER`;
trang khách có khối "Tài khoản liên kết" (`LinkedAccountsPanel.tsx`) xem/gỡ liên kết, chặn gỡ cách
đăng nhập cuối cùng; xoá key i18n chết `Auth.social.prefix`.

Kiểm thử mới: `CustomerOAuthApiTest` (24), `CustomerAuthCookiesTest` (11), `oauth-error.test.ts` (7),
`e2e/social-login.e2e.ts` (12, đã chạy thật trên `https://bigbike.vn` sau khi triển khai).

## F-3 — Dựng lại web bằng `--env-file` sai (đã tự khỏi trong ngày)

Bản web khởi động 2026-08-07T03:22:58Z được dựng bằng `.env` (local) thay vì `.env.vps`: canonical và
`og:url` của **mọi trang** khai `https://103.1.236.148:3000/...`, hai nút social trỏ
`http://103.1.236.148:8080/...` (cổng bị tường lửa chặn). Bản 03:29:46Z đã đúng — tổng gián đoạn ~7 phút.
Rủi ro SEO toàn site + lộ IP gốc. Cảnh báo đã bổ sung vào `DEPLOYMENT_GUIDE.md` §Environments.
