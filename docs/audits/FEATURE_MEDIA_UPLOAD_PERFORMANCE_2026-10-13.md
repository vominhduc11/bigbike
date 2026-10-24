# Kiểm tra tốc độ upload ảnh nhỏ trong admin — 2026-10-13

## Kết luận

Media có chi phí xử lý sau khi gửi file và lỗi thống kê đã được xác nhận trên hệ thống thật. Trong **một lần thử được owner cho phép**, ảnh JPEG 7.122 bytes được gửi trong **109 ms**, upload trả thành công sau **802 ms**, và ảnh xuất hiện trong thư viện sau **2.380 ms** tính từ chọn file. Không tái hiện một POST upload ảnh nhỏ kéo dài hàng chục giây trong lần thử này.

Hai yêu cầu thống kê của màn Media, trước và sau upload, đều trả **504 sau khoảng 30 giây**. Số đo bên trong backend xác nhận một lượt thống kê kết thúc bằng **500 sau 39,36 giây**. Đây là lỗi riêng của việc thống kê thư viện, không phải thời gian gửi tệp hoặc thời gian POST upload đã đo.

Sau khi xác nhận nguyên nhân, owner yêu cầu sửa và build bản mới nhất bằng `.env.vps`. **Đã sửa source và build thành công cả ba app; chưa nạp bản sửa vào container đang chạy.** Phép đo read-only của source mới trên dữ liệu thật giảm bước xác định ảnh đã dùng/chưa dùng từ **38.744,73 ms xuống 1.359,87–1.994,51 ms**. Đây là số đo xử lý dữ liệu, chưa phải thời gian HTTP hoặc upload sau triển khai.

## Căn cứ chuẩn

- `docs/business/MODULE_CATALOG.md` — **Media admin**, module đang hoạt động trên admin/backend.
- `docs/business/BUSINESS_RULES.md` — **Media Rules**, `MEDIA_RULE_006` (nén ảnh trước lưu) và `MEDIA_RULE_007` (ảnh nhỏ hợp lệ vẫn được upload, không có ngưỡng kích thước ảnh dùng chung).
- `docs/engineering/API_CONTRACT.md` — **Administrative Deletion and Restore Contract / 5. Thư viện ảnh/video (Media)**: upload, danh sách, thống kê và chi tiết media là các thao tác riêng; giữ nguyên kiểm tra MIME, quyền và dữ liệu phản hồi.
- `docs/engineering/API_FLOW_MAP.md` — **Admin media UI**.
- `docs/engineering/INTEGRATION_GUIDE.md` — **Media Integration Policy**: nén ảnh trước lưu MinIO.
- Không có cam kết số giây tối đa cho upload trong canonical docs; báo cáo không tự đặt SLA mới.

## Cách đo và giới hạn

- Xác nhận `bigbike-admin`, `bigbike-backend`, `bigbike-postgres`, `bigbike-minio` đang chạy bằng `docker ps` trước truy cập.
- Kiểm tra thư viện bằng `SELECT` qua `docker exec bigbike-postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" ...'`; chỉ lấy số lượng, dung lượng, kích thước ảnh, thời gian truy vấn và cấu hình timeout.
- Đọc bản đang triển khai bằng `docker cp bigbike-backend:/app/app.jar /tmp/bigbike-media-audit-20261013/backend-app.jar`; gọi các hàm đọc của chính bản này qua kết nối PostgreSQL read-only. Dữ liệu nội dung dùng trong so khớp nằm trong bộ nhớ; báo cáo chỉ lưu số đo tổng hợp.
- Đọc cấu hình proxy bằng `docker exec bigbike-admin cat /etc/nginx/conf.d/default.conf`: `proxy_read_timeout 30s`.
- Playwright chạy **một worker, không retry**, truy cập `https://admin.bigbike.vn/admin/media`, dùng helper đăng nhập `apiLoginSession` và bộ thu lỗi hiện có trong `bigbike-admin/e2e/fixtures/admin-test.ts`. Dùng `testAnon` để không kích hoạt bộ dọn dữ liệu E2E toàn hệ thống.
- Owner đã đồng ý đăng nhập admin và tải đúng **một ảnh thử** tên `kiem-tra-toc-do-media.jpg`. Không chạy thao tác sửa/xóa ảnh của shop. File thử giữ nguyên tên đã được owner duyệt, không dùng tiền tố E2E khác.
- Đo tiến độ gửi tệp bằng sự kiện XHR trong trình duyệt; đo lúc phản hồi và lúc thẻ ảnh hiện ra. Không thay phản hồi API, không dùng dữ liệu giả trong ứng dụng.
- Đối chiếu số đo backend qua `GET http://localhost:8080/actuator/prometheus` với phiên đăng nhập đã được cho phép; chỉ lưu các số đo HTTP liên quan Media, không lưu token/cookie.
- Chromium chạy trên VPS. Kết quả gồm đường HTTPS qua host quản trị thật nhưng **không đo mạng hoặc trình duyệt của owner**. Chỉ có một ảnh JPEG 100×100 trong phép upload; không suy rộng thành thời gian của mọi định dạng/kích thước.

## Số đo

| Bước | Kết quả |
|---|---:|
| File JPEG thử | 7.122 bytes, 100×100 |
| Gửi xong bytes lên máy chủ | 109,40 ms |
| Nhận phản hồi upload thành công `201` | 802,30 ms |
| Chờ sau khi gửi xong file | 692,90 ms |
| Xử lý POST upload bên trong backend, từ chênh lệch bộ đếm và tổng thời gian | 668,22 ms; đúng 1 lượt thành công mới |
| Ảnh xuất hiện trong lưới, tính từ chọn file | 2.380 ms |
| Làm mới danh sách sau upload, 24 file/trang | 1.185 ms |
| Thống kê trước upload | `504` sau 30.084 ms |
| Thống kê sau upload | `504` sau 30.109 ms |
| Một lượt thống kê kết thúc bên trong backend | `500` sau 39.360,39 ms |
| Tính trạng thái đã dùng/chưa dùng trên toàn thư viện bằng lớp đang triển khai | 38.744,73 ms |
| Kiểm tra tham chiếu cho ảnh 7 KB có sẵn | 628–920 ms, 64 truy vấn/lượt |
| Tính nơi dùng của 30 ảnh | 1.003–1.415 ms, 69 truy vấn/lượt |
| Thu thập nội dung chứa tham chiếu ảnh | 69 truy vấn, 8.127 đoạn, 15.677.502 ký tự |
| Nén ảnh 7 KB có sẵn sau lượt làm nóng | 5–7 ms |

Trước ảnh thử có 4.928 media, gồm 4.913 bản ghi ngoài thùng rác. Sau phép thử có thêm đúng một ảnh; giao diện hiển thị 4.914 mục ngoài thùng rác. Dung lượng lưu của ảnh thử vẫn là 7.122 bytes.

## F1 — Upload ảnh nhỏ vẫn phải chờ kiểm tra nơi dùng ảnh

- **Mức độ:** Low (chi phí hiệu năng đã đo, không có SLA bị vi phạm).
- **Trạng thái:** Đã sửa source, có kiểm thử; chờ nạp bản mới và đo lại upload thật.
- **Lệch ở đâu:** File đã được gửi nhưng backend còn dựng phản hồi chi tiết, bao gồm toàn bộ tham chiếu sử dụng ảnh.
- **Bằng chứng:** `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java:257` gọi `toDetail(saved)`; `:696` gọi `MediaReferenceService.getReferences`. `MediaReferenceService.java:45` đọc các trường ảnh/HTML/JSON qua nhiều bảng; phép đo trên bản đang triển khai ghi 64 truy vấn và 0,63–0,92 giây cho ảnh 7 KB có sẵn. POST ảnh thử mới thực tế mất 668 ms bên trong backend.
- **Giao diện liên quan:** `bigbike-admin/src/lib/adminApi.js:1417` chỉ kết thúc upload khi XHR nhận phản hồi; `bigbike-admin/src/screens/MediaLibraryScreen.jsx:218` chờ phản hồi rồi mới báo hoàn tất. Tiến độ gửi bytes không đồng nghĩa backend đã xử lý xong.
- **Rule liên quan:** `MEDIA_RULE_006`/`MEDIA_RULE_007`; API Contract phần Media. Không thay quy tắc nhận ảnh/nén ảnh hoặc bỏ kiểm tra tham chiếu khi xóa vĩnh viễn.
- **Hậu quả vận hành:** Ảnh nhẹ vẫn có thời gian chờ gần như không phụ thuộc dung lượng; sau đó còn chờ làm mới danh sách.
- **Hướng xử lý có căn cứ:** Tối ưu cách tìm tham chiếu/đọc dữ liệu và cập nhật danh sách, giữ nguyên kết quả phản hồi và các kiểm tra nghiệp vụ. Trả mặc định “chưa dùng” cho mọi upload sẽ sai với nhánh tái sử dụng ảnh trùng checksum nên không áp dụng tùy tiện.
- **Bản sửa:** Chỉ file mới với UUID/object key mới trả ngay detail có `usageCount=0`, `references=[]`, `tags=[]`; nhánh trùng checksum vẫn đọc tham chiếu và thẻ của file đang có. Không đổi nén ảnh, lưu MinIO, MIME, quyền hoặc chốt xóa. Hai kiểm thử upload xác nhận riêng hai nhánh này.

## F2 — Thống kê thư viện quét toàn bộ dữ liệu, vượt timeout

- **Mức độ:** Medium.
- **Trạng thái:** Đã sửa source và đối chiếu toàn thư viện thật; chờ nghiệm thu HTTP sau nạp.
- **Lệch ở đâu:** Thống kê của thư viện được gọi khi mở màn và làm mới sau upload nhưng không hoàn tất trong thời hạn proxy.
- **Bằng chứng:** `AdminMediaService.java:355` tải toàn bộ media theo bộ lọc; `:363` gọi `getUsedMediaIds(all)`. `MediaReferenceService.java:202` thu thập toàn bộ đoạn tham chiếu rồi lặp từng media qua các đoạn này. Trên 4.913 media và 8.127 đoạn nội dung, bước này mất 38,74 giây trong phép đo read-only. Endpoint thật mất 39,36 giây rồi ghi `500` theo số đo backend; trình duyệt đã nhận `504` sau 30 giây.
- **Giao diện liên quan:** `MediaLibraryScreen.jsx:105` gọi thống kê khi mở màn; `:157` vô hiệu hóa các query Media; `:241` gọi làm mới sau upload. `bigbike-admin/src/lib/queryClient.js` cho retry lỗi 5xx tối đa hai lượt, có thể phát sinh thêm các lượt thống kê nặng. Không đo đầy đủ mọi lượt retry trong đợt này.
- **Runtime:** PostgreSQL `idle_in_transaction_session_timeout = 30s`; vòng lặp so khớp trong Java không cần thêm truy vấn trong thời gian dài. Phép đo read-only giữ transaction bị DB ngắt khi truy vấn tiếp theo được chạy sau vòng lặp; metric endpoint thật xác nhận lỗi backend sau khoảng 39 giây. Không kết luận proxy timeout hoặc lỗi thống kê đã làm POST ảnh thử thất bại — POST thử trả `201`.
- **Rule liên quan:** API Contract phần Media yêu cầu thống kê trả tổng số/dung lượng và số đã dùng/chưa dùng đúng bộ lọc. Không bỏ trường thống kê hoặc tăng timeout để che phép quét nặng trong một thay đổi chưa được đánh giá.
- **Hậu quả vận hành:** Media có thể tiếp tục tải/chờ thống kê và phát sinh lỗi dù ảnh đã upload thành công; các lượt retry gây thêm công việc cho máy chủ.
- **Hướng xử lý có căn cứ:** Ưu tiên tối ưu phép tìm nơi dùng ảnh cho cả danh sách/thống kê; giảm các lượt làm mới trùng nhau. Giữ nguyên phạm vi tham chiếu để bảo vệ file còn đang dùng.
- **Bản sửa:** Gom các trường của cùng bảng thành một truy vấn, giảm từ 69 xuống 13 truy vấn nhưng giữ từng trường là một đoạn riêng. Bộ so khớp literal dùng chung tìm tất cả đường dẫn trong một lượt đọc nội dung; UUID chỉ khớp khi bằng toàn bộ giá trị. Không cache tham chiếu qua request, không đổi bộ lọc hay số đếm. Các hàm lấy tham chiếu chi tiết và bảo vệ xóa vĩnh viễn giữ nguyên.

## F3 — Làm mới dữ liệu trùng sau upload

- **Mức độ:** Low.
- **Trạng thái:** Đã sửa source; kiểm thử thư viện và picker đạt.
- **Bằng chứng trước sửa:** Thư viện vừa vô hiệu hóa cả nhóm Media vừa vô hiệu hóa riêng thư mục, gây hai lượt tải thư mục. Picker tải danh sách thủ công rồi đổi `refreshKey`, khiến effect tải lần thứ hai và chậm chọn file vừa tải.
- **Bản sửa:** Thư viện làm mới một lượt cho mỗi nhóm dữ liệu, không tải lại trang đang rời khi upload từ trang sau về trang 1. Picker giữ metadata upload để chọn ngay, dùng một effect tải danh sách; xóa tìm kiếm có hiệu lực ngay, giữ bộ lọc thư mục/thẻ.
- **Căn cứ:** `docs/engineering/API_FLOW_MAP.md`, hàng **Admin media UI**. Kiểm thử xác nhận số lượt tải, về trang 1 và lựa chọn file vừa upload.

## Đối chiếu source mới với dữ liệu thật

Kết nối PostgreSQL read-only; đối chiếu lớp đang triển khai và source mới trên cùng dữ liệu. Hai cách thu thập trả cùng tập 8.127 đoạn nội dung, kể cả số lần lặp. Đối chiếu độc lập với phép `String.contains`/UUID equality trước đây xác nhận **toàn bộ usage count và tập đã dùng giống nhau** cho 4.914 media ngoài thùng rác: 2.946 đã dùng, 1.968 chưa dùng. Không lưu nội dung, URL riêng hoặc dữ liệu khách hàng vào bằng chứng.

Ba lượt đo tiếp theo dùng giới hạn heap 512 MB như bản triển khai:

| Lượt | Xác định đã dùng/chưa dùng, 4.914 media | Tính nơi dùng của 30 ảnh |
|---|---:|---:|
| 1 | 1.994,51 ms | 1.089,67 ms |
| 2 | 1.359,87 ms | 974,94 ms |
| 3 | 1.538,58 ms | 950,62 ms |

Phép đối chiếu đầu chạy đồng thời với các bộ kiểm thử/build nên source mới mất 5.454,37 ms cho toàn thư viện; ba lượt trên được đo khi tải giảm. Phép đếm cũ toàn bộ nơi dùng dùng làm oracle mất 99.017,40 ms, **không dùng số này thay cho baseline thống kê 38,74/39,36 giây** vì oracle phải đếm hết thay vì dừng ở tham chiếu đầu tiên.

## Build và phạm vi triển khai đã chuẩn bị

Đã chạy `docker compose --env-file .env.vps build` thành công cho cả ba app theo yêu cầu owner; không sửa `.env` hoặc `.env.vps`:

- Backend: `sha256:ac753a533ee533fee2dedcbd3fbb7e07c1a89479cbb8df7914ac1b023a9df63d`.
- Admin: `sha256:e3a5871428cd3412858f82a30ec004c302f67e058635b7829ce38de8b82ca018`.
- Web: `sha256:de1d07ac45aecc117956039e046b284d85bf1cae21dd08a4afdc822af6816124`, trùng bản đang chạy.

So sánh nội dung jar mới với jar backend đang chạy: chỉ `AdminMediaService`, `MediaReferenceService` và các class lồng liên quan thay đổi/thêm/bỏ. **Các resource, migration, thư viện và class backend còn lại giống bản đang chạy.** Các thay đổi LivePreview/song ngữ/bảo hành có sẵn của phiên khác được giữ nguyên; không sửa thêm trong task Media.

Đã giữ hai image đang chạy tại `bigbike-backend:before-media-performance-20261013` và `bigbike-admin:before-media-performance-20261013`. Chưa thực hiện `up/restart/recreate`. Sau khi owner duyệt, nạp riêng backend/admin bằng `docker compose --env-file .env.vps up -d --no-deps --no-build bigbike-backend bigbike-admin`, xác nhận healthy và thử đúng một ảnh nhỏ mới để đo nhánh không trùng checksum. `AGENTS.md` §5.6 yêu cầu approval trước thao tác thay container đang chạy.

## Kiểm thử và phần còn lại

- **Đạt:** Gửi đúng một file đã được owner cho phép; POST `201`; ảnh xuất hiện trong thư viện; `SELECT` xác nhận đúng một bản ghi thử, đúng dung lượng và kích thước. Ảnh màn hình đã được xem để kiểm tra thẻ ảnh và thông báo tải thành công.
- **Không đạt:** Cổng kiểm tra runtime sạch của E2E. Hai yêu cầu thống kê trả `504`; ngoài ra trang công khai có lỗi console về script Cloudflare bị chính sách bảo mật chặn. Lỗi script không được xác định là nguyên nhân upload chậm trong báo cáo này.
- **Đạt trên source:** 47 bài backend tập trung cho matcher/upload/xóa/auto-folder; admin lint và build; 7 file/100 bài admin chạy lại gồm hai file Media và toàn bộ các file đã fail lần đầu; kiểm nginx boundary self-test gồm cả hai trường hợp cố ý phá chốt; kiểm encoding và `git diff --check`.
- **Bộ admin đầy đủ:** Lần đầu 127 file/1.203 bài, 8 fail (7 timeout khi chạy đồng thời build/benchmark, 1 bài SettingsEditors không tìm được phần tử). Chạy lại toàn bộ các file fail cùng hai file Media với `--maxWorkers=1`: 100/100 đạt. Không ghi lần chạy đầy đủ đầu tiên là pass.
- **Bộ backend đầy đủ:** 1.535 bài, 2 fail, 1 skip; không có error. `Phase1DCustomerAuthTest.login_withPhone_succeeds` fail khi dựng số điện thoại thử ngẫu nhiên, helper chưa padding đủ chữ số; chạy lại class riêng đạt 27/27. `ArticleExcerptAuthorRemovalMigrationPostgresTest` fail vì migration chỉ bỏ field cấp ngoài, bài kiểm kỳ vọng cả field lồng; resource migration không đổi và giống bản đang triển khai; chạy lại class riêng vẫn fail cùng assertion. Không sửa luồng đăng nhập hoặc migration bài viết trong task Media; không ghi bộ đầy đủ là pass.
- **Chưa chạy:** Upload trên máy/mạng của owner; thử ảnh PNG/WebP hoặc ảnh có dung lượng nhỏ nhưng kích thước pixel lớn; thử upload thật trong picker sản phẩm/bài viết; kiểm HTTP/upload sau nạp bản sửa. Kiểm thử picker source đã đạt.
- **Dữ liệu thử còn lại:** `kiem-tra-toc-do-media.jpg`, media ID `a5a60d42-9a69-4b73-8aa1-1636ee89927d`, chưa dùng. Không xóa trong đợt này vì owner chỉ duyệt việc tải ảnh thử.
- **Bằng chứng tổng hợp:** [performance.json](evidence/media-upload-2026-10-13/performance.json) trước sửa, [source-fix-verification.json](evidence/media-upload-2026-10-13/source-fix-verification.json) sau sửa source. Script, log build/kiểm thử, ảnh và jar đối chiếu nằm tại `/tmp/bigbike-media-audit-20261013/`; không đưa jar, cookie/token hoặc nội dung raw vào git.

## PR summary / preflight

Summary:
- Giảm việc quét tham chiếu khi upload file mới và thống kê Media; bỏ lượt tải danh sách/thư mục trùng.
- Giữ kết quả tham chiếu/số đếm, nhánh trùng checksum và chốt xóa ảnh đang dùng.

Files changed:
- `bigbike-backend/.../service/admin/{AdminMediaService,MediaReferenceService,MediaReferenceMatcher}.java` — trả detail file mới và so khớp chung cùng inventory.
- `bigbike-admin/src/{screens/MediaLibraryScreen,components/MediaPickerModal}.jsx` cùng bài kiểm — làm mới một lượt, chọn ảnh vừa tải ngay.
- Hai bài backend mới — so khớp literal và hai nhánh upload.
- `docs/engineering/{API_CONTRACT,API_FLOW_MAP,DEPLOYMENT_GUIDE}.md` — ghi căn cứ Media và quy trình nạp riêng.
- Báo cáo này và evidence tổng hợp — baseline, so khớp dữ liệu thật, checks và giới hạn.

Checks:
- Web lint/test: Not run — source web không đổi; Docker build bằng `.env.vps` đạt và image trùng bản đang chạy.
- Admin lint/build: PASS; full test: FAIL lần đầu, toàn bộ file fail chạy lại đạt (100 bài gồm Media).
- Backend focused test: PASS (47); full test: FAIL (2 bài khác phạm vi, 1 skip); auth chạy lại PASS (27).
- Nginx boundary self-test, encoding và diff whitespace: PASS.

Notes:
- Không có migration, biến môi trường mới, đổi quyền hoặc đổi business rule; chưa commit/push.
- Bản sửa chưa chạy production; cần approval nạp riêng backend/admin và nghiệm thu một upload mới.
