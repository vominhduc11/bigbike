# Đối chiếu phiếu dev schema BigBike — 29/10/2026

## Kết luận

Phiếu xác định đúng **hai việc còn mở: DEV-5 và DEV-6**. Chưa thấy cần mở lại DEV-1–DEV-4 trong phạm vi kiểm tra. Cần bổ sung hướng triển khai và chỉnh một số tiêu chí nghiệm thu của DEV-5; DEV-6 cần cập nhật quy định CSP trong tài liệu chuẩn trước khi sửa mã.

Đây là kết quả kiểm chứng, **chưa triển khai các yêu cầu trong phiếu**. Nội dung file đính kèm được xem là yêu cầu đề xuất để đối chiếu, không phải lệnh tự động sửa hoặc triển khai hệ thống.

## Phạm vi và căn cứ

- Phiếu: `C:/Users/vomin/Downloads/Phiếu dev schema bigbike.md`, cập nhật 29/10/2026.
- Mã đang kiểm: commit `8324bc035`; workspace sạch trước khi tạo báo cáo.
- Đã rà các phần liên quan ở web, admin, backend, cấu hình Docker và tài liệu chuẩn; đối chiếu HTML, DOM và phản hồi HTTP trên tên miền thật. Không coi đây là kiểm toán mọi chức năng của toàn bộ monorepo.
- Quy tắc: [BUSINESS_RULES.md](../business/BUSINESS_RULES.md), `ANALYTICS_RULE_001/002`, `SEO_RULE_004`, `SEO_RULE_012–014`.
- Tích hợp: [INTEGRATION_GUIDE.md](../engineering/INTEGRATION_GUIDE.md), mục Google Analytics 4 và Meta Pixel; [DEPLOYMENT_GUIDE.md](../engineering/DEPLOYMENT_GUIDE.md), mục Storefront analytics.
- Nội dung danh mục: [API_CONTRACT.md](../engineering/API_CONTRACT.md), mục Category `introContent`; [DATA_CONTRACT.md](../engineering/DATA_CONTRACT.md), mục Category intro FAQ markup normalization.
- Số liệu đã ghi: [verification.json](evidence/schema-ticket-review-2026-10-29/verification.json).

## Trạng thái từng việc

| Việc | Kết quả hiện tại | Hướng xử lý |
| --- | --- | --- |
| DEV-1 — hồ sơ doanh nghiệp | Trang chủ VI/EN có hai script JSON-LD: graph Organization + SportingGoodsStore và WebSite. Tên, số chính và SearchAction đúng phần đã kiểm. | Giữ đóng. |
| DEV-2 — intro bị lặp | Năm trang danh mục được ghi bằng chứng đều có một intro, sáu câu hỏi, ba JSON-LD; HTML và DOM trùng nhau. | Giữ đóng. |
| DEV-3 — mô tả danh mục | Mô tả ở các trang mẫu liền mạch, không lẫn nhãn/bảng, đúng locale và không quá 160 ký tự. Mã ưu tiên SEO rồi mới lấy `.bb-ci-body`. | Giữ đóng. |
| DEV-4 — ngôn ngữ intro | HTML và DOM đều có `lang=vi/en` đúng route. | Giữ đóng; mô tả nguyên nhân cũ trong phiếu cần chú thích. |
| DEV-5 — link đánh giá Google | `/danh-gia` và `/review` được chuẩn hóa thêm dấu `/` bằng 308, sau đó đều trả 404. Không tìm thấy route, sự kiện `review_link_open` hay cấu hình `REVIEW_URL` trong các phần đã rà. | Cần làm mới. |
| DEV-6 — CSP | Chính sách thực tế vẫn thiếu Cloudflare trong `script-src` và giữ `form-action 'self'`. Trình duyệt tái hiện cả hai kiểu chặn. | Cần sửa đúng phạm vi. |

Năm trang danh mục: mũ bảo hiểm, mũ fullface, tai nghe VI, tai nghe EN và fullface EN. Lượt ghi bằng chứng này kiểm mỗi trang một lần; không ghi nhận đã chạy lại toàn bộ yêu cầu tải năm lần. Các bài kiểm hiện có liên quan cũng đã chạy lại, kết quả ở cuối báo cáo.

## DEV-5 — những điểm nên bổ sung vào phiếu

### 1. Dùng bộ đo hiện có, tránh đếm trùng

`bigbike-web/app/[locale]/layout.tsx:110–128` đã cài GA4 một lần, lấy mã từ `NEXT_PUBLIC_GA4_MEASUREMENT_ID`. `lib/analytics.ts` là nơi duy nhất các component gửi sự kiện; `page_view` do Google tự ghi.

Phiếu nên ghi rõ: **kế thừa bản GA4 hiện có, bổ sung sự kiện qua helper chung, không chèn thêm tag GA4 hoặc gọi thêm page_view**. Giữ nguyên mã `G-REZM4NT0CS`. Sự kiện này đo lượt mở đường dẫn mời đánh giá, không chứng minh khách đã gửi đánh giá thành công trên Google.

GA4 hiện khởi tạo sau khi trang có thể tương tác (`afterInteractive`). Logic mới phải xét cả lúc tag chưa sẵn sàng: helper hiện tại có thể bỏ qua sự kiện nếu chưa có `gtag`. Đây là rủi ro cần thiết kế khi làm DEV-5, chưa phải lỗi đã phát sinh của một route đang tồn tại.

### 2. Chốt thời gian chờ và đường dự phòng

Giữ `location.replace`, callback và timer dự phòng 800 ms. Bổ sung yêu cầu chuyển trang tối đa một lần, hủy timer khi đã chuyển, và chỉ phát một `review_link_open` cho mỗi lần mở trang. Nếu khách quay lại bằng một lần mở mới thì vẫn được tính lượt mới.

Google có tham số `event_timeout`; nên đặt phù hợp với mốc 800 ms. Callback xác nhận việc xử lý lệnh sự kiện hoàn tất, không phải giấy xác nhận dữ liệu đã xuất hiện trong báo cáo. `transport_type: beacon` cũng không thay thế bước kiểm nhận dữ liệu thực tế. [Tài liệu Google tag](https://developers.google.com/tag-platform/gtagjs/reference/parameters).

Nên ghi rõ 800 ms là **khoảng chờ chủ động của trang trung gian**, không bao gồm tải mạng, khởi động JavaScript, Google Maps hoặc đăng nhập. Mốc dưới một giây chỉ nên nghiệm thu trong điều kiện mạng và thiết bị đã xác định.

Đặt meta refresh hai giây trong nhánh `noscript` để phục vụ máy tắt JavaScript; nếu đặt hoạt động cả khi có JavaScript, nó có thể chuyển trang trước khi luồng đo hoàn tất khi máy tải chậm. Giữ liên kết bấm tay ngay trong HTML server, kể cả khi mã chuyển trang không chạy.

### 3. Điều chỉnh tiêu chí Google Maps và GA4

- Link Google trong phiếu thực tế chuyển tới `local/writereview` với place id `ChIJeXyMi5UudTER3XgTBwvnK40`. Khi chưa đăng nhập, nó chuyển tiếp sang trang đăng nhập Google. Tách nghiệm thu thành hai trường hợp đã/chưa đăng nhập; vẫn cần thử thật trên Safari, Chrome, Zalo và Messenger. Google xác nhận khách phải đăng nhập tài khoản để đánh giá. [Hướng dẫn Google Business Profile](https://support.google.com/business/answer/3474122?hl=en).
- Không dùng việc Realtime luôn hiện `qr / offline` làm điều kiện duy nhất. Các thẻ nguồn trong Realtime dùng nguồn thu hút người dùng lần đầu và có độ trễ/giới hạn xử lý. Kiểm thêm sự kiện, `page_location` còn UTM trong dữ liệu gửi, rồi đối chiếu báo cáo nguồn của phiên sau xử lý. [Tài liệu Realtime](https://support.google.com/analytics/answer/9271392?hl=en).
- Khi chặn GA4 hoặc tắt JavaScript, vẫn phải tới Google bằng đường dự phòng, nhưng không yêu cầu có sự kiện GA4. Thêm các ca này vào phiếu.

### 4. Khớp chuẩn URL và SEO hiện tại

`next.config.ts:206` bật `trailingSlash`. Nên in QR bằng `/danh-gia/?utm_source=qr&utm_medium=offline&utm_campaign=qr-danh-gia`; alias là `/review/`. Link không dấu `/` cuối vẫn phải hoạt động và giữ UTM. Redirect 308 chuẩn hóa dấu `/` **không phải** redirect thẳng tới Google mà phiếu muốn tránh.

Hai URL cần trả trang HTML 200 trước khi chuyển bằng trình duyệt, cùng logic và cùng cấu hình đích. Phải xử lý trong hệ route VI/EN hiện tại, không để `/review/` bị đổi ngoài ý muốn sang URL khác hoặc bị bảng redirect quản trị bắt trước trang. Phiếu nên làm rõ câu chờ tiếng Anh cho khách dùng alias tiếng Anh.

Giữ meta `noindex, nofollow`, header `X-Robots-Tag` cho cả hai đường dẫn và không thêm vào sitemap. Không thêm `Disallow` trong robots.txt, theo `SEO_RULE_004`. Sitemap thật trả 200 với 786 URL; không có chính xác hai route gốc này. Một lần lấy sitemap ban đầu bị timeout, các lần đọc lại thành công.

### 5. Cấu hình đích và phạm vi thay đổi

Nếu chọn biến môi trường `REVIEW_URL`, cần khai báo/kiểm tra ở `env.ts`, truyền vào dịch vụ web trong Compose, cập nhật các file env mẫu và hướng dẫn triển khai. Tránh tình huống đổi biến nhưng trang đã dựng lúc build vẫn giữ link cũ. Nếu chọn file cấu hình thì ghi rõ đổi đích cần triển khai lại website. Cả hai cách đều giữ nguyên QR đã in.

Chưa thấy lý do cần thêm bảng dữ liệu, API hoặc trường cài đặt admin cho DEV-5. Luồng đánh giá sản phẩm và thư mời đánh giá đang có trong backend là luồng khác, không tự đổi sang đánh giá Google.

## DEV-6 — giữ đề xuất, bổ sung căn cứ và quyết định Cloudflare

### Meta

Lượt mở `/en/categories/motorcycle-helmet-intercom/` đã ghi lỗi gửi form tới `https://www.facebook.com/tr/` bị `form-action 'self'` chặn. Đây là bằng chứng mới so với báo cáo 22/10, khi chưa tái hiện được lỗi này.

Đề xuất thêm đúng `https://www.facebook.com` vào `form-action` phù hợp lỗi quan sát. Không cần cài lại Pixel: root layout đã có một bản Pixel `460465848002810`, và `lib/cart-context.tsx:93–111` gửi sự kiện thêm giỏ qua helper chung sau khi thao tác thành công.

Tài liệu hiện tại tại `INTEGRATION_GUIDE.md` mục Meta Pixel và `DEPLOYMENT_GUIDE.md:603` vẫn yêu cầu không mở rộng directive khác ngoài phần script đã duyệt. Vì vậy **cần cập nhật ngoại lệ có căn cứ này trong tài liệu chuẩn trước khi sửa CSP**, theo Docs-First. Chưa được suy ra mọi sự kiện Meta đều mất, hoặc việc thư viện tải được nghĩa là sự kiện đã về đủ.

### Cloudflare

Script Cloudflare xuất hiện trên web thật và bị chặn trên trang chủ, các danh mục đã kiểm và sản phẩm SCS S10X. Không tìm thấy bản cài script Cloudflare trong mã đã rà; quan sát phù hợp việc chèn tại Cloudflare, nhưng chưa truy cập tài khoản để xác nhận công tắc nào đang bật.

Phiếu nên giao rõ người quyết định giữ hay tắt và người có quyền thao tác tài khoản. Chưa có bằng chứng trong repo rằng đội dev đang dùng báo cáo Web Analytics này. Với thông tin shop chỉ dùng GA4, **đề xuất tắt tự chèn nếu người vận hành xác nhận không dùng**. Nếu cần giữ, thêm đúng nguồn script; `connect-src` hiện đã cho `https:` nên không cần nới thêm. Cả hai phương án có cơ sở trong [hướng dẫn thiết lập](https://developers.cloudflare.com/web-analytics/get-started/) và [hướng dẫn CSP của Cloudflare](https://developers.cloudflare.com/web-analytics/faq/).

Không tự mở rộng CSP của admin: mã admin dùng chính sách riêng, và HTML trang đăng nhập admin trả 200 trong mẫu kiểm này không chứa beacon Cloudflare. Việc một tên miền đi qua Cloudflare chưa chứng minh nó đang được chèn Web Analytics.

Sau xử lý phải kiểm lại console, GA4, Clarity và Meta Test Events theo phiếu. Chưa có quyền vào các tài khoản này nên lượt rà soát không ghi các bước nhận sự kiện ở tài khoản là đạt.

## Chú thích cần sửa ở phần DEV-4 đã đóng

Phiếu cũ quy nguyên nhân mất `lang` cho admin. Mã hiện tại `bigbike-admin/src/lib/categoryIntro.js:285–290,515` có tạo thuộc tính này; backend chọn nội dung theo locale ở `JpaCatalogReadRepository.java:798–849`; web giữ và chuẩn hóa `lang` ở `lib/utils/html.ts:46–47,191`. Báo cáo sửa ngày 22/10 cũng xác định khâu lọc HTML của web là nguyên nhân trước sửa.

Nên thêm chú thích lịch sử này để tránh người nhận việc sửa nhầm admin hoặc sửa lại dữ liệu danh mục. Không cần mở lại DEV-4.

## Kiểm tra đã chạy và giới hạn

- Chạy `npx vitest run __tests__/seo/homepage-business.test.ts lib/seo/category-intro.test.ts __tests__/seo/json-ld.test.ts __tests__/utils/html.test.ts components/ui/collapsible-content.test.tsx __tests__/analytics/analytics.test.ts __tests__/seo/robots-noindex.test.ts` tại `bigbike-web`: **7 file, 130 bài đạt**. Có cảnh báo cấu hình Vite, không có bài trượt.
- Kiểm Chromium desktop trên trang chủ VI/EN, năm danh mục và URL sản phẩm lấy từ liên kết thật; kiểm HTTP hai alias, UTM, sitemap, admin và chuỗi chuyển tiếp của link Google.
- `docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"` thất bại vì Docker Desktop Linux daemon trên máy chưa hoạt động. Không có kiểm tra container/DB local, không tự khởi động dịch vụ.
- Chưa thử thiết bị thật hoặc trình duyệt trong Zalo/Messenger; chưa xác nhận Realtime, Meta Test Events, Clarity hoặc lựa chọn bật/tắt trong tài khoản Cloudflare. Không chạy lại Google Rich Results/schema.org; không kế thừa kết quả lịch sử thành kết quả mới.
- Lượt mở trang chủ đầu tiên có một số yêu cầu tải trước liên kết (`?_rsc=…`) trả 503. Chưa xác định nguyên nhân hoặc tính lặp lại; ghi nhận riêng, không quy thành lỗi schema và không mở rộng sửa ngoài yêu cầu.
- Chỉ thêm báo cáo và bằng chứng; không thay source, `.env`, dữ liệu, cấu hình Cloudflare hoặc triển khai hệ thống.
