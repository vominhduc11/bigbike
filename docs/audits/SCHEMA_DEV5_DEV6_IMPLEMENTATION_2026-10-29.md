# Triển khai DEV-5 và DEV-6 — 29/10/2026

> **Đã nạp riêng web lên production và kiểm tên miền thật ngày 29/10/2026.** Kết quả vận hành ở mục cuối và [deployment.json](evidence/schema-dev5-dev6-2026-10-29/deployment.json); phần kiểm trước nạp bên dưới được giữ làm mốc.

## Phạm vi và căn cứ

- Workspace thực tế: `/root/myproject/bigbike` trên VPS, nhánh `main`, HEAD ban đầu `4c4499ca`. Workspace sạch trước khi làm. Đường dẫn `S:\project\bigbike` và phiếu ở `C:\Users\vomin\Downloads` không có trong phiên Linux; dùng đặc tả đầy đủ trong tin nhắn owner cùng hai tài liệu đối chiếu được yêu cầu trong repo. Không ghi nhận đã đọc file Windows gốc.
- Đã đọc `AGENTS.md`, `bigbike-web/AGENTS.md`, báo cáo `SCHEMA_TICKET_REVIEW_2026-10-29.md` và toàn bộ `verification.json` đi kèm. Các số 130 bài kiểm và trạng thái production trong đó là bằng chứng lịch sử.
- Tài liệu chuẩn được cập nhật **trước khi sửa hành vi**: [BUSINESS_RULES.md](../business/BUSINESS_RULES.md), `ANALYTICS_RULE_007/008`, cùng `SEO_RULE_004`; [INTEGRATION_GUIDE.md](../engineering/INTEGRATION_GUIDE.md), Google review invitation bridge / Cloudflare Web Analytics CSP / Meta Pixel; [DEPLOYMENT_GUIDE.md](../engineering/DEPLOYMENT_GUIDE.md), Storefront analytics / Google review link and CSP delivery.
- Owner trả lời trong phiên: **có sử dụng Cloudflare Web Analytics, giữ beacon**. Không cần tắt trong tài khoản, không cài thêm beacon.
- Giai đoạn sửa mã chỉ thay web, tài liệu và kiểm thử; không đổi luồng đánh giá sản phẩm, thư mời hiện có, backend, admin, cơ sở dữ liệu hoặc env. Ban đầu chưa deploy; chỉ thị tiếp theo của owner đã cho phép nạp riêng web như mục cuối. Không commit/push.

## Kết quả triển khai

| Phần | Thay đổi |
| --- | --- |
| DEV-5 — trang | `/danh-gia/` tiếng Việt, `/review/` tiếng Anh và `/en/review/` dùng một server page nhẹ dưới `app/[locale]/(review)/internal/google-review/page.tsx`; giữ bản cài GA4 ở locale layout. HTML 200 chứa thông báo chờ, liên kết bấm tay và meta refresh hai giây bên trong `noscript`. Không dựng header/footer cửa hàng nặng cho trang này. |
| Đường dẫn | `proxy.ts` giữ các alias trước bảng chuyển hướng và chuẩn hóa locale; chỉ bổ sung dấu `/` bằng 308 khi thiếu, giữ query/UTM. `/review/` không bị chuyển sang `/en/review/`. |
| Sự kiện và dự phòng | `lib/analytics.ts::trackReviewLinkOpen` dùng helper chung: đợi GA4 khởi tạo trong 800 ms, phát một `review_link_open`, giữ `page_location`, `send_to` và yêu cầu `transport_type: beacon`. `event_timeout` bằng phần thời gian còn lại trừ 50 ms, tối thiểu 1 ms. Callback hoặc timer độc lập cùng đi qua một chốt hoàn thành. Hủy cả timer chờ khởi tạo và timer hạn chờ khi hoàn thành/unmount; bỏ qua callback muộn. Không khóa theo phiên; lần mở mới được đếm mới. Lần thử đầu được trì hoãn để cleanup của React StrictMode không phát trùng. |
| Điều hướng | `ReviewLinkRedirect.tsx` gọi `location.replace` qua callback helper. GA4 chậm, bị chặn, thiếu cấu hình hoặc ném lỗi vẫn không giữ khách lại. Không thêm tag hoặc `page_view` thủ công. |
| Đích chung | `lib/review-link.ts::GOOGLE_REVIEW_URL` = `https://g.page/r/Cd14EwcL5yuNEBM/review`. Muốn đổi: sửa hằng số này, build và phát hành web theo quy trình được duyệt; QR đã in giữ nguyên. Chọn file cấu hình chung nên không có biến môi trường mới, không cần sửa Compose/Dockerfile/env mẫu. Property vẫn lấy từ cấu hình GA4 hiện có `G-REZM4NT0CS`. |
| SEO | Server metadata và HTTP `X-Robots-Tag` đều `noindex, nofollow`; không vào sitemap và không thêm `Disallow`. |
| DEV-6 — Meta | Thêm đúng `https://www.facebook.com` vào `form-action` cùng `'self'`, sau khi cập nhật ngoại lệ trong tài liệu. Không thêm Pixel/PageView. |
| DEV-6 — Cloudflare | Thêm đúng `https://static.cloudflareinsights.com` vào `script-src` theo quyết định giữ của owner. Giữ nguyên `connect-src` và CSP admin; không thêm wildcard. |

QR chuẩn: `https://bigbike.vn/danh-gia/?utm_source=qr&utm_medium=offline&utm_campaign=qr-danh-gia`.

800 ms là thời gian chờ chủ động của trang sau khi logic phía trình duyệt bắt đầu, không bao gồm truyền HTML, khởi động JavaScript, tải Maps hay đăng nhập Google. Khách chưa đăng nhập được phép đi qua bước đăng nhập. `review_link_open` đo mở liên kết, không chứng minh đã gửi đánh giá. Khi chặn thống kê/tắt JavaScript không yêu cầu có sự kiện. Không dùng riêng Realtime luôn hiển thị `qr/offline` làm bằng chứng: đối chiếu UTM của gói gửi và báo cáo nguồn phiên sau xử lý.

## Kiểm tra đã chạy

- `npm run lint`: đạt; `npx eslint` bổ sung cho các file kiểm thử mới: đạt. `npx prettier --check` trên toàn bộ source mới/sửa: đạt. `git diff --check`: đạt. Áp dụng hygiene: không thêm CSS; chữ mới VI/EN đã đọc lại, không có lỗi mã hóa mới.
- `npm run test -- --maxWorkers=2`: **112 file, 769 bài đạt**, gồm nhóm kiểm SEO/analytics cũ và các ca mới. Không kế thừa kết quả 130 bài lịch sử.
- `npm run build`: đạt, gồm kiểm TypeScript và prerender hai locale. Có cảnh báo công cụ Sentry và nhiều lockfile sẵn có; không mở rộng sửa ngoài phạm vi.
- `bash deploy/nginx/tests/domain-boundary-config-test.sh --self-test`: đạt kiểm dương và hai kiểm âm.
- Chromium, `e2e/google-review-link.e2e.ts`, một worker trên bản thử riêng: **13/13 ca đạt**, không bỏ qua ca nào. Kiểm lại riêng ca gói GA4 sau khi thêm assertion trường gửi và chỉ lưu bằng chứng đã bỏ định danh: **1/1 đạt**.
- Thư viện Google thật tạo một `review_link_open`, property `G-REZM4NT0CS`, `page_location` đúng URL mở và đủ ba UTM. Gói có `ep.transport_type=beacon`, nhưng Chromium thực tế dùng **POST / fetch**, không phải bằng chứng `navigator.sendBeacon` được gọi. Bộ kiểm chặn collect và trả 204 **trước khi chuyển tới Google**, nên không làm lệch thống kê shop; không coi là xác nhận nhận dữ liệu trong tài khoản. Thư viện thật được tải từ Google và cung cấp nguyên nội dung trong bộ kiểm để tách thời gian tải tag khỏi bước kiểm dữ liệu.
- DEV-1–DEV-4: trang chủ VI/EN, năm danh mục **mỗi trang năm lần tải**, mô tả dự phòng và thao tác ở 375/768/1440. Lượt chính đạt **10/11**; ca điều hướng danh mục trên desktop vượt ngưỡng chờ thành phần 5 giây. Kiểm riêng với ngưỡng sẵn sàng 30 giây đã đạt **1/1**. Chỉ bổ sung chờ ổn định và danh mục EN thứ năm trong bộ kiểm, không đổi hành vi danh mục/schema. Tổng cộng **11 kịch bản hồi quy đã được kiểm đạt**; không gọi đây là một lượt cả bộ đạt liền mạch.
- Bằng chứng đã loại định danh trình duyệt/phiên: [verification.json](evidence/schema-dev5-dev6-2026-10-29/verification.json).

Các ca mới kiểm alias/slash/query, ưu tiên trước bảng chuyển hướng, UTM, gửi một lần, lần mở mới, callback lặp/muộn, timer 800 ms, khởi tạo chậm, không cấu hình, bị chặn, thư viện lỗi và cleanup trước/sau khởi tạo; noindex/nofollow, robots và sitemap; JavaScript tắt, chuyển hai giây và bấm tay; phản hồi CSP thực tế và ba kích thước 375/768/1440.

## Môi trường kiểm và giới hạn

- Đã chạy `docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'` trước khi đọc runtime: web/admin/backend/PostgreSQL/Redis/MinIO đang chạy. Chỉ đọc `docker inspect bigbike-web` và `docker exec bigbike-web node -e ...` để lấy đường dẫn media đã biên dịch trong `.next/routes-manifest.json`; không ghi container. Cấu hình riêng tư chỉ truyền trong bộ nhớ cho bản thử, không ghi ra báo cáo.
- Bản thử riêng chạy Next standalone trên `http://localhost:3105`; API thật `localhost:8080`, kho ảnh thật `localhost:9000`. Build kiểm dùng property GA4 hiện có với collect bị chặn; Meta/Clarity không bật trong bản thử để tránh gửi thống kê. Đây là artifact kiểm thử, không phải image phát hành production; khi triển khai sau phải build bằng cấu hình triển khai hiện hành. Không dùng dữ liệu giả. Bộ kiểm hồi quy chuyển tiếp phản hồi API thật và điều chỉnh header CORS trong bộ kiểm cho cổng riêng, không sửa CORS dịch vụ dùng chung. Đã đối chiếu cả đường dẫn ảnh cũ `/wp-uploads` trong cấu hình đang chạy; hai ảnh từng lỗi do cấu hình bản thử đều trả 200 sau khi cấu hình đúng.
- Kiểm HTTP container web đang phục vụ trên `localhost:3000` xác nhận hai route vẫn 404 và CSP cũ tại thời điểm đọc, phù hợp việc chưa deploy. Yêu cầu HTTP công khai từ VPS tới hai URL qua Cloudflare trả 403 trong lượt đọc này; không coi đó là bằng chứng production đã được cập nhật.
- Safari và Android thiết bị thật; trình duyệt trong Zalo/Messenger: **chưa kiểm**, VPS chỉ có Chromium. Kích thước mobile là mô phỏng viewport.
- GA4 Realtime/DebugView, báo cáo nguồn phiên, Meta Test Events và Clarity trong tài khoản: **chưa nghiệm thu**. Kiểm gói gửi ở trình duyệt và CSP form không thay thế xác nhận nhận sự kiện trong tài khoản.
- Bản thử do task tạo ở cổng 3105 đã được dừng sau khi kiểm. Các container dùng chung vẫn healthy; không dừng/khởi động lại dịch vụ đang chạy.
- Google Maps/Google sign-in trên thiết bị thật chưa nghiệm thu. Các ca chuyển trang chặn đích ngoài trong bộ kiểm để xác nhận điều hướng, không tự gửi đánh giá Google.

## Tệp chính

- `bigbike-web/lib/review-link.ts`, `lib/analytics.ts`, `components/analytics/ReviewLinkRedirect.tsx`.
- `bigbike-web/app/[locale]/(review)/internal/google-review/page.tsx`, `messages/vi.json`, `messages/en.json`, `proxy.ts`, `next.config.ts`.
- `bigbike-web/__tests__/analytics/review-link.test.tsx`, `__tests__/review-link-routing.test.ts`, `__tests__/seo/robots-noindex.test.ts`, `__tests__/seo/sitemap.test.ts`, `e2e/google-review-link.e2e.ts`, `e2e/home-category-structured-data.e2e.ts`.
- Ba tài liệu chuẩn nêu trên; báo cáo này và bằng chứng kiểm chứng đi kèm. Báo cáo đối chiếu cũ được giữ làm mốc trước triển khai.

## Nạp production theo yêu cầu tiếp theo của owner — 29/10/2026

Owner đã yêu cầu “đưa lên production” sau khi phần code/kiểm thử hoàn tất. Phạm vi:
build mới riêng web bằng `.env.vps`, giữ image đang chạy để hoàn tác, kiểm image ứng viên,
nạp riêng web rồi kiểm HTTP/trình duyệt. Không dùng artifact kiểm trên cổng 3105 để phát hành.
Giữ backend/admin/các dịch vụ dữ liệu, file env và giới hạn tài nguyên; không commit/push.
Kết quả thực tế:

- Build Docker bằng `.env.vps` đạt, dựng đủ trang và qua TypeScript. Image **`sha256:784537ca43a9bbcdf2229385dba312994eaa89ab98abf92fdac86fe28d469e01`**, tag **`bigbike-web:dev56-20261029-083348`**.
- Giữ image trước ở **`bigbike-web:before-dev56-20261029-083348`** (`sha256:752868d979543dc152f7ef8f3493102bb85460f60868d919258581d7a12fc3e7`). Không đẩy image hoặc mã lên kho từ xa.
- Trước nạp đã kiểm image ứng viên trên cổng loopback 3106 bằng cấu hình web production: HTML 200 VI/EN, alias/slash/UTM, noindex/nofollow, CSP, đúng GA4/Pixel, trang chủ/danh mục/sitemap/robots. Container ứng viên đã xóa sau nghiệm thu.
- Đã chạy `docker compose --env-file .env.vps up -d --no-deps --no-build --wait --wait-timeout 180 bigbike-web`. Web dùng đúng image mới, **healthy**, khởi động `2026-10-29T08:43:17.597853349Z`, startup revalidation HTTP **200**, giữ bộ nhớ 512 MB.
- Kiểm **qua tên miền công khai `https://bigbike.vn` đi qua Cloudflare**, không chỉ loopback: `/danh-gia/`, `/review/`, `/en/review/` trả HTML **200**; bản không dấu `/` cuối trả **308**, giữ query/UTM và alias. Metadata/header `noindex, nofollow`, liên kết tay và noscript đúng; sitemap/robots đạt.
- Chromium thực tế: trang chủ VI/EN có hai JSON-LD và chỉ một bản cài GA4/Meta; cả năm danh mục mẫu có một intro/sáu câu hỏi/ba JSON-LD, đúng lang và mô tả ≤160 ký tự. Hai link đánh giá chuyển đúng, một `review_link_open` mỗi lần mở, giữ nguyên UTM và property `G-REZM4NT0CS`.
- Beacon Cloudflare được chèn ở web công khai và tải **200**; không còn lỗi CSP Cloudflare hoặc Meta trong các lượt nghiệm thu. Không có lỗi trang JavaScript trong lượt kiểm này. Thống kê thử đã được chặn trước đầu nhận; không coi là nghiệm thu trong tài khoản GA4/Meta.
- JavaScript tắt trên production: tự chuyển bằng meta refresh và bấm tay đều đạt. Kiểm bằng Chromium, chưa thay cho Safari/Android thật hoặc trình duyệt trong Zalo/Messenger.
- Backend, admin, PostgreSQL, Redis, MinIO giữ nguyên ID/image/thời điểm khởi động, đều healthy; `.env` và `.env.vps` giữ nguyên hash. Giữ nguyên cấu hình Clarity (public id trong `.env.vps` đang trống). Không sửa Nginx, tài khoản Cloudflare, dữ liệu hoặc luồng đánh giá sản phẩm/thư mời.
- Log máy chủ còn cảnh báo cache danh sách bài viết vượt 2 MB và `NoFallbackError` ở route tổng quát; chưa xác định URL nguồn. Không tái hiện lỗi trên các URL nghiệm thu, không kết luận toàn hệ thống không lỗi và không sửa ngoài phạm vi.

Bằng chứng nạp và kiểm công khai: [deployment.json](evidence/schema-dev5-dev6-2026-10-29/deployment.json).
