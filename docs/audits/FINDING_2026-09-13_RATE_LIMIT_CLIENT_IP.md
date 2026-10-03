# Hạn mức chống spam (rate limit) và địa chỉ khách sau Cloudflare — 2026-09-13

> **Trạng thái:** ĐÃ ĐIỀU TRA + ĐO THẬT TRÊN VPS, **CHƯA SỬA GÌ** (không đổi code, cấu hình hay dữ liệu).
> Owner **chưa quyết định sửa**. Đã đề nghị viết prompt bàn giao, owner chưa trả lời → **không tự sửa**.

---

## 1. Owner đã hỏi gì

1. Hệ thống BigBike đã cấu hình rate limit chưa?
2. Có nên bỏ rate limit trong phần mềm, chuyển hoàn toàn sang cấu hình ở Cloudflare?
3. Hỏi sâu về cách từng lớp nhận diện khách. Ẩn dụ đã dùng khi giải thích: **"bưu cục" = Cloudflare edge** (một địa chỉ edge chuyển yêu cầu vào máy chủ).

## 2. Kết luận đã trả lời owner

- **Đã có 3 lớp, cả 3 đều đang bật:** Cloudflare → nginx trên máy chủ → phần mềm.
- **Không nên bỏ lớp phần mềm.** Hai bên làm hai việc khác nhau:
  - Cloudflare thấy đúng địa chỉ thật → hợp để chặn lũ truy cập / dò mật khẩu từ vòng ngoài.
  - Phần mềm biết danh tính (email, phiên, tài khoản nhân viên) và loại thao tác (đặt hàng, chat AI, nhập/xuất file) → Cloudflare không làm thay được. Kẻ xấu đổi địa chỉ liên tục thì chỉ lớp này chặn được.
- **Có lỗi thật:** lớp phần mềm gộp mọi khách vào chung một rổ đếm (chi tiết mục 4).
- **Việc sửa làm trên máy chủ BigBike, không làm trong Cloudflare.** Khách đi qua edge nào là do Cloudflare tự quyết, không cấu hình được.

## 3. Hiện trạng 3 lớp (đo 13/09)

| Lớp | Cấu hình | Nhận diện khách |
|---|---|---|
| **1 · Cloudflare** | Cả 5 tên miền `bigbike.vn`, `www`, `api`, `admin`, `media` trỏ về địa chỉ Cloudflare (đi qua proxy). **Chưa xem được đang có luật rate limit/WAF nào** (cần vào dashboard). | ✅ Thấy đúng địa chỉ thật |
| **2 · nginx trên máy chủ** | `api.bigbike.vn` 10 lượt/giây (burst 20) · `bigbike.vn` 30 lượt/giây (burst 30) · `admin.bigbike.vn` 30 lượt/giây (burst 30, `/ws` được miễn) | 🟡 Đếm theo **địa chỉ edge Cloudflare** — gom nhóm khách ngẫu nhiên theo edge. Tài liệu ghi là chủ đích. |
| **3 · Phần mềm** | 22 nhóm hạn mức, lưu bộ đếm ở Redis, đang bật (`BIGBIKE_RATE_LIMIT_ENABLED=true`, store=redis) | ❌ Bộ đếm theo địa chỉ **gộp mọi khách**; bộ đếm theo danh tính vẫn đúng |

### Ngưỡng lớp phần mềm

| Khách | Ngưỡng | Nhân viên | Ngưỡng |
|---|---|---|---|
| Đăng nhập | 5/phút | Sửa dữ liệu | 60/phút |
| Đăng ký | 3/phút | Tải ảnh lên | 30/phút (2 cùng lúc/tài khoản, 10 toàn hệ thống) |
| Quên/đặt lại mật khẩu | 5/phút | Kiểm tra file nhập | 6/giờ |
| Gửi lại email xác minh | 3/giờ | Nhập hàng loạt | 2/giờ (1 cùng lúc toàn hệ thống) |
| Đặt hàng | 5/phút | Xuất file | 12/giờ (3 cùng lúc toàn hệ thống) |
| Tra cứu đơn | 20/phút | Kết nối nhận thông báo | 10 lần bắt tay/phút |
| Tìm kiếm | 60/phút | | |
| Chat trợ lý | 10/phút | | |
| Viết đánh giá | 5/phút | | |

Đã thử thật qua internet: gọi tra cứu đơn liên tục → lượt thứ ~25 nhận `429` đúng mẫu lỗi chuẩn, có `Retry-After`.

### Lớp nginx hiện gần như vô hại (log trọn ngày 12/09)

| Lối vào | Tổng lượt | Số địa chỉ edge Cloudflare | Edge bận nhất |
|---|---:|---:|---:|
| bigbike.vn | 41.445 | 4.027 | 1.088 lượt/cả ngày |
| api.bigbike.vn | 2.440 | 299 | 66 lượt/cả ngày |

Ngưỡng là 10–30 lượt **mỗi giây** → còn rất xa.

## 4. Lỗi chính: lớp phần mềm gộp mọi khách vào chung rổ

### Diễn giải kinh doanh

Mỗi yêu cầu Cloudflare chuyển vào đều **kèm sẵn địa chỉ thật của khách**. nginx giữ nguyên và ghi thêm địa chỉ edge vào cuối → ghi chú có 2 giá trị. Phần mềm chỉ tin ghi chú có đúng 1 giá trị → bỏ luôn → coi mọi người là một, lấy địa chỉ nội bộ của máy chủ thay vào.

**Không mất thông tin.** Chỉ là chưa lớp nào được dặn cách đọc cho đúng.

### Có 3 rổ chung, mỗi lối vào một rổ (× mỗi loại thao tác)

| Lối vào | Ai dùng | Phần mềm thấy mọi khách là |
|---|---|---|
| `api.bigbike.vn` | Khách: đăng nhập, đăng ký, đặt hàng, tra cứu đơn, chat, giỏ hàng, tài khoản | `172.20.0.1` (cổng mạng Docker) |
| `bigbike.vn` (qua lớp trung gian của web) | Khách: gợi ý tìm kiếm, gửi đánh giá | `172.20.0.4` (container web) |
| `admin.bigbike.vn` | Toàn bộ nhân viên | `172.20.0.5` (container admin) |

Ngoại lệ: `POST /api/v1/chat/videos` ở cửa api gửi đúng 1 giá trị (địa chỉ edge) → đếm theo edge, giống lớp nginx.

### Hậu quả

- Cả shop chỉ có **5 lượt khách đăng nhập/phút, 5 đơn đặt/phút, 3 đăng ký/phút, 20 tra cứu đơn/phút, 60 tìm kiếm/phút, 10 tin chat/phút** — chia chung. Vào đợt khuyến mãi → khách thật bị chặn oan.
- Tất cả nhân viên cộng lại: 60 thao tác sửa/phút, 10 lần kết nối chuông thông báo/phút.
- Bộ đếm theo địa chỉ **vô tác dụng** với kẻ xấu.

### Phần vẫn đúng

- Bộ đếm theo **email / phiên đăng nhập / tài khoản nhân viên** vẫn riêng từng người (mỗi yêu cầu phải qua đủ cả bộ đếm địa chỉ lẫn danh tính).
- Khoá tài khoản nhân viên sau nhiều lần sai mật khẩu tính theo tài khoản → không ảnh hưởng.
- Giới hạn "cùng lúc toàn hệ thống" (nhập 1, xuất 3, ảnh 10) là chủ đích.

### Bằng chứng (gọi thẳng backend `127.0.0.1:8080`, đăng nhập khách, email giả)

| Lượt | Ghi chú địa chỉ gửi kèm | Email | Kết quả |
|---|---|---|---|
| Khách X ×5 | `11.11.11.11, 172.71.1.1` (dạng thật sau nginx) | 5 email khác nhau | 4 lượt 400, lượt 5 bị **429** (rổ đã tốn 2 lượt ở lần thử trước) |
| Khách Y ×2 | `22.22.22.22, 172.71.1.1` | email khác hẳn | **429 ngay** → chung rổ với X |
| Khách Z ×1 | `33.33.33.33` (1 giá trị) | email khác | 400, không bị chặn → rổ riêng |

Trước đó: `6.6.6.1` (1 giá trị) bị 429 ở lượt 6 đúng ngưỡng 5/phút; `6.6.6.2` (1 giá trị) vẫn qua → xác nhận phần mềm **đếm đúng từng địa chỉ khi nhận được 1 giá trị**.

⚠️ **Điểm chưa giải thích được:** thử với tra cứu đơn, lượt dùng 1 giá trị `7.7.7.7` + mã tra cứu mới vẫn bị 429 ngay sau khi rổ chung bị dùng hết. Chưa rõ vì sao (có thể còn khoá phụ khác cho nhóm này). **Không dùng thử nghiệm tra cứu đơn làm bằng chứng**; bằng chứng sạch là thử nghiệm đăng nhập ở trên. Nên xem lại khi sửa.

## 5. Lỗi đi kèm: địa chỉ lưu trong dữ liệu cũng sai (từ 01/09)

| Dữ liệu | Địa chỉ đang lưu |
|---|---|
| Đơn hàng | 15/15 đơn = `172.20.0.1` |
| Phiên đăng nhập khách | 13/13 = `172.20.0.1` |
| Phiên đăng nhập nhân viên | 477/477 là địa chỉ nội bộ (`172.20.0.3`–`.7`) |
| Nhật ký quản trị | 381 dòng không ghi địa chỉ, 31 dòng địa chỉ nội bộ, **23 dòng đúng địa chỉ thật** |

23 dòng đúng là nhật ký đổi trạng thái đơn / xác nhận chuyển khoản — do một chỗ trong phần mềm tự lấy **giá trị đầu tiên** của ghi chú mà không kiểm tra → **giả mạo được** (ai cũng tự ghi địa chỉ giả được). Tức là trong cùng phần mềm đang có **2 cách lấy địa chỉ khác nhau**.

Hậu quả kinh doanh: có đơn ảo/gian lận hoặc tài khoản nhân viên bị người lạ đăng nhập thì **không truy được vào từ đâu**.

## 6. Phát hiện phụ (chưa điều tra sâu)

- **Ảnh ở `media.bigbike.vn` không được Cloudflare giữ bản sao:** gọi 2 lần đều `cf-cache-status: MISS` → mỗi lượt xem ảnh đều chạy vào máy chủ. File giao diện `/_next/static/` thì `HIT`. Trang HTML `DYNAMIC`.
- **Tường lửa máy chủ** chỉ mở cổng 80/443 cho 22 dải địa chỉ Cloudflare (+ SSH). Danh sách này **cập nhật tay**, không tự đổi khi Cloudflare thêm dải.

## 7. Việc còn treo / bước tiếp theo

1. **Chờ owner quyết**: sửa lỗi gộp khách hay viết prompt bàn giao cho Codex. **Không tự sửa.**
2. **Chưa xem Cloudflare dashboard** — chưa biết đã có luật rate limit/WAF nào. Liên quan việc khoá IP trang quản trị bằng luật Cloudflare đang treo từ 12/09.
3. **Khi sửa, phải lưu ý:**
   - **Docs-first:** `docs/engineering/RATE_LIMITING.md` hiện ghi rõ *không bật real_ip hay tin header của CDN khi chưa ghi nhận và kiểm thử mọi chặng proxy* → phải cập nhật tài liệu trước.
   - Chỉ tin địa chỉ Cloudflare ghi kèm **khi chặng trực tiếp thuộc 22 dải Cloudflare**. Bỏ điều kiện này là kẻ xấu tự ghi địa chỉ giả để né chặn.
   - Có **4 chặng** phải xử lý đồng bộ: nginx trên máy chủ (3 site — bản đang chạy nằm ở `/etc/nginx/sites-available`, xem ghi chú lệch repo), nginx bên trong container admin, lớp trung gian của web, và phần mềm (gộp luôn cách lấy địa chỉ riêng của nhật ký đơn hàng về một chỗ).
   - Cân nhắc chuyển lớp nginx sang đếm theo địa chỉ thật luôn (ngưỡng hiện đặt cho edge, đổi sang từng khách thì nên xem lại burst).
   - Phải có kiểm thử **chống giả mạo** + kiểm thử **khác khách thì khác rổ** trên hệ thống thật.
4. Nếu viết prompt cho Codex: viết ở mức kinh doanh và **nhúng sẵn số liệu đo** ở tài liệu này (máy local không có dữ liệu thật).

## 8. Tác động phụ của phiên điều tra

Chỉ gửi yêu cầu đọc/đăng nhập sai, **không ghi tay vào CSDL hay Redis**:
- Qua internet: ~27 lượt tra cứu đơn giả.
- Gọi thẳng backend: ~57 lượt tra cứu đơn giả, ~64 lượt tìm kiếm, ~19 lượt đăng nhập khách với email `@example.invalid`, mật khẩu sai.
- Hệ quả: rổ chung đăng nhập / tra cứu đơn của cửa api có thể bị đầy trong ~1 phút lúc thử (khoảng 08:00–08:30 giờ VN, 13/09).

---

## Phụ lục kỹ thuật (cho phiên làm việc tiếp)

### File liên quan

| File | Vai trò |
|---|---|
| `bigbike-backend/.../config/ratelimit/RateLimitTier.java` | Ngưỡng 22 nhóm |
| `bigbike-backend/.../config/ratelimit/RateLimitPolicyCatalog.java` | Đường dẫn → nhóm |
| `bigbike-backend/.../config/RateLimitingFilter.java` | Luôn áp khoá `IP` trước, rồi `IDENTITY` / `INTERNAL_TOKEN` |
| `bigbike-backend/.../config/AuthenticatedRateLimitingFilter.java` | Khoá `CUSTOMER_SESSION` / `ADMIN_ACCOUNT` |
| `bigbike-backend/.../config/ratelimit/RateLimitConcurrencyGuard.java` | Giới hạn cùng lúc toàn hệ thống |
| `bigbike-backend/.../config/ClientIpResolver.java` | Chỉ nhận `X-Forwarded-For` **đúng 1 giá trị** từ proxy tin cậy; có dấu phẩy → trả `remoteAddr` |
| `bigbike-backend/.../api/admin/AdminOrderController.java` `extractClientIp` | Tự `split(",")[0]` → giả mạo được |
| Dùng `ClientIpResolver` | `AdminAuthService`, `CustomerAuthController`, `CustomerOAuthController`, `CheckoutController`, `AdminReviewController`, `AdminRolesController`, `AdminAdminUsersController`, `AdminProductExportController`, `AdminReportController` |
| `bigbike-web/lib/api/backend-proxy.ts` | Xoá `X-Forwarded-For` nếu có dấu phẩy (BFF chỉ dùng cho `search-suggest`, reviews) |
| `docs/engineering/RATE_LIMITING.md` | Tài liệu chuẩn |

### Cấu hình đang chạy

- `.env.vps` / container: `BIGBIKE_RATE_LIMIT_ENABLED=true`, `BIGBIKE_RATE_LIMIT_STORE=redis`, `BIGBIKE_RATE_LIMIT_REDIS_URL=redis://redis:6379/0`, `BIGBIKE_TRUSTED_PROXIES=127.0.0.1,::1,172.20.0.0/24`. Khoá Redis dạng `bb:rl:v1:<tier>:<scope>:<hmac>`.
- Mạng Docker `bigbike-dev` 172.20.0.0/16, gateway `172.20.0.1`; backend `.3`, web `.4`, admin `.5` (IP container có thể đổi sau khi tạo lại — lịch sử đã thấy `.6`, `.7`).
- `/etc/nginx/sites-available/api.bigbike.vn`: `location /` và `/ws` → `X-Forwarded-For $proxy_add_x_forwarded_for`; `= /api/v1/chat/videos` → `X-Forwarded-For $remote_addr`.
- `/etc/nginx/sites-available/bigbike.vn.nextjs`, `admin.bigbike.vn` → `$proxy_add_x_forwarded_for`.
- nginx trong container admin: `/api/` và `/ws` → `X-Forwarded-For $http_x_forwarded_for` (chuyển nguyên).
- Không có `set_real_ip_from` / `real_ip_header` ở bất kỳ đâu. Không nơi nào đọc `CF-Connecting-IP`.
- Dải Cloudflare: `/etc/ufw/cloudflare-ips.current` (22 dải, ufw đang bật).

### Lệnh tái hiện bằng chứng

```bash
L="http://127.0.0.1:8080/api/v1/customer/auth/login"
hit(){ curl -s -o /dev/null -w "%{http_code} " -H "Content-Type: application/json" \
  -H "X-Forwarded-For: $1" -d "{\"email\":\"$2\",\"password\":\"wrongpass123\"}" "$L"; }
for i in 1 2 3 4 5; do hit "11.11.11.11, 172.71.1.1" "x$i@example.invalid"; done; echo
hit "22.22.22.22, 172.71.1.1" "y1@example.invalid"; echo   # mong đợi khi còn lỗi: 429
hit "33.33.33.33" "z1@example.invalid"; echo               # rổ riêng: 400
```

### Truy vấn phân loại địa chỉ đã lưu

```sql
WITH t AS (
  SELECT 'orders' bang, ip_address ip, created_at FROM orders
  UNION ALL SELECT 'customer_sessions', ip_address, created_at FROM customer_sessions
  UNION ALL SELECT 'audit_logs', ip_address, created_at FROM audit_logs
  UNION ALL SELECT 'admin_refresh_tokens', created_by_ip, created_at FROM admin_refresh_tokens)
SELECT bang,
  CASE WHEN ip IS NULL OR ip='' THEN 'khong ghi'
       WHEN ip ~ '^(172\.|127\.|10\.|::1)' THEN 'noi bo'
       ELSE 'that' END loai, count(*), count(DISTINCT ip)
FROM t WHERE created_at >= '2026-09-01' GROUP BY 1,2 ORDER BY 1,3 DESC;
```

---

## 9. Bổ sung cùng ngày: có nên thêm rate limit ở Cloudflare (đo lúc ~11:00)

**Đã khuyên owner: CÓ, nhưng chỉ vài luật nhắm đúng chỗ. Không thay được việc sửa lỗi gộp khách.** Máy chủ không có quyền truy cập Cloudflare (không token), nên **chưa biết gói đang dùng và luật hiện có**. Đã hỏi owner gói nào; chưa soạn biểu thức luật.

### Bằng chứng: máy dò lỗ hổng quét thật sáng 13/09, không lớp nào chặn

- 10:22 → 11:05: dò file nhạy cảm (`.env`, `/@fs/root/.config/gcloud/application_default_credentials.json`, `/proc/self/environ`, `.zsh_history`, `.windsurf/mcp.json`, `/?path=../../.azure/credentials`…), giả danh GrokBot / Perplexity / TelegramBot / meta-externalagent / Baiduspider.
- Cửa api: đỉnh **477 lượt/phút lúc 11:03** (215 lúc 11:04), rải qua **28 edge** nên nginx 10 lượt/giây/edge không chặn. Cả ngày 643 lượt đường lạ: 623×401, 18×403, 2×400. Lượt 200 duy nhất phút 11:03 là `GET /api/v1/cart` (299 byte, giỏ trống).
- Cửa web: 649 lượt dò file nhạy cảm: 612×404, 33×308, 2×304, **2×200** (`/?path=../../.azure/credentials` lúc 10:22 và 10:32, **104.369 byte = đúng dung lượng trang chủ bình thường** → Next.js bỏ qua tham số, **không lộ gì**).
- Cửa admin: không bị quét.
- ⚠️ Gọi lại đường dò để kiểm chứng đã bị bộ phân loại an toàn của Claude chặn → kiểm chứng bằng so dung lượng trong log. Đừng thử gọi lại đường dò.

### Lượng truy cập thật 14 ngày (lọc bỏ curl/node/python/headless) — dùng để chọn ngưỡng

| Thao tác | Tổng | Phút cao nhất (cộng dồn mọi khách) |
|---|---:|---:|
| Đăng nhập/đăng ký/mật khẩu + đặt hàng (cửa api) | 30 | 8 |
| Tra cứu đơn | 55 | 4 |
| POST `/api/v1/chat/*` | 6.723 | 29 — **đính chính: 6.648 lượt là `/chat/sessions` (mở khung chat khi vào trang), tin nhắn thật chỉ 49 + 12 ảnh + 2 video** |
| Toàn cửa api (không tính đợt quét) | — | ~186 |
| Nhân viên ở cửa admin (trừ `/ws`) | 18.791 | 176 (một điện thoại Android 149 lượt/phút) |
| Công cụ tự động `node` ở cửa admin | 738 | 138 (nhập nội dung 11/09) |

### Đề xuất đã nêu với owner

1. Luật chống dò tài khoản/spam (cửa api): đăng nhập, đăng ký, quên/đặt lại mật khẩu, gửi lại xác minh, đặt hàng, tra cứu đơn, gửi chat — khoảng 20 lượt/phút/IP (gói chỉ có khung 10 giây: ~5 lượt/10 giây). **Không tính** refresh/logout (web tự gọi).
2. Luật chặn dò file bí mật (custom rule, chặn ngay lượt đầu) cho cả 3 tên miền.
3. Lưới an toàn toàn cửa api nếu còn luật: ~300 lượt/phút/IP.
- **Không đặt:** giới hạn chung toàn trang bigbike.vn (nhiều thuê bao 4G chung IP, chặn nhầm Google/Merchant Center), ảnh media, `/ws`, cửa admin (nhân viên 176/phút + công cụ 138/phút; cửa này nên khoá IP theo kế hoạch 12/09, nếu vẫn đặt phải chừa `103.1.236.148`).

## 10. Owner báo gói Cloudflare = **Free** → luật đã soạn (chưa bật, chờ owner tự dán)

### Giới hạn gói Free (đối chiếu tài liệu Cloudflare 13/09)

- Rate limiting rules: **1 luật**, trường lọc chỉ **Path + Verified Bot**, đếm theo **IP**, khung **10 giây**, chặn **10 giây**. Không lọc được theo method/host.
- Custom rules: **5 luật**, **không có regex**, mọi action trừ Log.

### Kiểm chứng trước khi soạn

- **Không lộ file bí mật.** 14 ngày có 385 lượt 200 vào `/.env`, `/.git/config`, `/.aws/credentials`, `/.ssh/id_rsa`, `/docker-compose.yml`… — **toàn bộ ở admin.bigbike.vn, đều 1.037 byte = trang khung SPA** (nginx container admin trả `index.html` cho mọi đường). bigbike.vn và api: **0 lượt 200**. `find` thư mục `/app/public` (web) và `/usr/share/nginx/html` (admin): **không có file nào** thuộc loại bị dò.
- Website bị dò **liên tục**: 14 ngày có 4.246 lượt `/.env`, 1.044 `/@fs/`, 580 `credentials`, 132 lượt `../` trong tham số. Mọi lượt khớp các mẫu dưới đây đều là máy dò, không có khách thật.
- Trình duyệt gửi kèm OPTIONS trước POST sang cửa api (vd checkout 15 POST / 9 OPTIONS) → luật đếm theo path sẽ tính cả 2. Khung 10 giây đông nhất trên **một edge** (cộng mọi khách qua edge đó) cho nhóm đường bên dưới: **7 lượt**.

### Luật A — Rate limiting rule (dùng hết 1 luật của Free)

- Tên: `Chong spam dang nhap - dat hang - chat` · Đếm theo IP · **20 lượt / 10 giây → Block 10 giây**
```
(http.request.uri.path eq "/api/v1/customer/auth/login")
or (http.request.uri.path eq "/api/v1/customer/auth/register")
or (http.request.uri.path eq "/api/v1/customer/auth/password/forgot")
or (http.request.uri.path eq "/api/v1/customer/auth/password/reset")
or (http.request.uri.path eq "/api/v1/customer/auth/resend-verification")
or (http.request.uri.path eq "/api/v1/customer/auth/verify-email")
or (http.request.uri.path eq "/api/v1/auth/login")
or (http.request.uri.path eq "/api/v1/checkout")
or (http.request.uri.path eq "/api/v1/orders/lookup")
or (http.request.uri.path eq "/api/v1/chat/messages")
or (http.request.uri.path eq "/api/v1/chat/messages/stream")
or (http.request.uri.path eq "/api/v1/chat/images")
or (http.request.uri.path eq "/api/v1/chat/videos")
```
Cố ý KHÔNG đưa vào: `/chat/sessions` (6.648 lượt/14 ngày, mở khi vào trang), refresh/logout (web tự gọi), GET `/chat/images/{id}/content`.

### Luật B — Custom rule (1/5), action Block

```
(http.request.uri.path contains "/.env")
or (http.request.uri.path contains "/.git")
or (http.request.uri.path contains "/.aws")
or (http.request.uri.path contains "/.ssh")
or (http.request.uri.path contains "/.docker")
or (http.request.uri.path contains "/.vscode")
or (http.request.uri.path contains "/@fs/")
or (http.request.uri.path contains "/proc/self")
or (http.request.uri.path contains "id_rsa")
or (http.request.uri.path contains "wp-config")
or (http.request.uri.path contains "phpinfo")
or (http.request.uri.path contains "docker-compose")
or (http.request.uri.path contains "_history")
or (http.request.uri.path contains ".bak")
or (http.request.uri.path contains "credentials")
or (http.request.uri.path contains "mcp.json")
or (http.request.uri.path contains "server-status")
or (http.request.uri.query contains "../")
```
Cố ý KHÔNG đưa: `.sql`, `config.json`, `jwks`, `/.well-known` (có thể dùng hợp lệ). Không chặn `/wp-*` chung vì còn luật chuyển hướng link WordPress cũ.

### Kiểm chứng sau khi owner bật (chưa làm)

- Luật B: xem log nginx — lượt dò các mẫu trên phải biến mất (Cloudflare chặn trước khi tới máy chủ). **Không gọi thử đường dò** (bộ phân loại an toàn chặn).
- Luật A: gửi ~25 lượt tra cứu đơn giả liên tiếp từ VPS → phải nhận trang chặn của Cloudflare (không phải JSON 429 của phần mềm).
- Custom rules còn 4 chỗ; kế hoạch khoá IP trang quản trị (12/09) sẽ dùng thêm 1.

### ✅ Luật B: owner đã bật — kiểm chứng 11:37 ngày 13/09

- `https://bigbike.vn/kiem-tra-cloudflare-luat-b.bak` → **403 trang chặn Cloudflare** ("Sorry, you have been blocked", có Ray ID) và **không có dòng nào trong log nginx** → chặn trước khi tới máy chủ.
- Đối chứng `.../kiem-tra-cloudflare-luat-b` → 308 bình thường, **có** trong log nginx. Trang chủ 200, `api.bigbike.vn/api/v1/categories` 200 (có `X-Request-Id` của máy chủ).
- Lượt dò cuối cùng lọt tới máy chủ: bigbike.vn 10:32, api.bigbike.vn 11:04 (trước lúc bật).
- Luật A chưa bật (owner được khuyên là tuỳ chọn, lợi ích nhỏ trên gói Free).
