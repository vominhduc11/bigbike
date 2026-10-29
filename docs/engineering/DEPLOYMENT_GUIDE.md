# Deployment Guide

## Docker Compose Defaults

| Service | Current default | Status | Evidence |
|---|---|---|---|
| Postgres | `postgres:16-alpine`, bound to `127.0.0.1:5432` | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml` |
| MinIO | `minio/minio:RELEASE.2025-04-22T22-12-26Z`, bound to `127.0.0.1:9000/9001` | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml` |
| Backend | profile defaults to `prod`, bound to `127.0.0.1:8080` | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml` |
| Web | bound to `127.0.0.1:3000`, backend API base injected via env/build args | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml` |
| Admin | built with real backend API base (`VITE_ADMIN_API_BASE=/api/v1`), bound to `127.0.0.1:4000` | `CONFIRMED_FROM_CONFIG` | `docker-compose.yaml`, `bigbike-admin/Dockerfile` |

## Multi-Environment Run (local vs VPS)

The same compose stack runs in every environment with **no source edits** — only the
env-file differs. `docker compose` loads exactly one env-file, so each file must be complete.

- **Local:** `docker compose up -d --build` (reads `.env`, see `.env.example`). `CONFIRMED_FROM_CONFIG`
- **VPS:** `docker compose --env-file .env.vps up -d --build` (see `.env.vps.example`). `CONFIRMED_FROM_CONFIG`

### Đồng bộ màu đỏ footer — build 2026-10-25

Chủ shop yêu cầu sửa màu chủ đạo của footer và build bản mới. Điểm nhấn dùng đỏ
thương hiệu `#FF0C09` theo `bigbike-web/STYLEGUIDE.md` phần Palette/Footer; chữ nhỏ
trên nền xám giữ màu sáng, hover có gạch đỏ để duy trì độ tương phản.
Build riêng web bằng `docker compose --env-file .env.vps build bigbike-web`, đúng
env-file của container hiện tại; giữ image đang chạy bằng tag hoàn tác trước khi build.
Phạm vi chỉ tạo image mới; nạp image lên website vẫn là bước riêng khi owner yêu cầu.
Không sửa file env hoặc build/recreate backend, admin và dịch vụ dữ liệu.
Kiểm tra mã nguồn: lint/guard, Prettier hai component đã sửa và `git diff --check`
đạt. Lượt Vitest đầy đủ có 106/110 file, 742/746 bài đạt; bốn bài hết giới hạn 5 giây
khi chạy đồng thời với các kiểm tra khác. Chạy lại riêng bốn file đó với
`--maxWorkers=1 --testTimeout=15000` đạt 4/4 file, 29/29 bài, không đổi mã kiểm thử.

Playwright trên bản xem thử nguồn `http://localhost:3002`, dùng backend thật, đã
cập nhật có chủ đích hai ảnh chuẩn footer desktop/mobile vì đổi màu thương hiệu;
hai kịch bản ảnh đạt. Kiểm màu thực tế ở 1440/390px xác nhận biểu tượng/tên pháp lý
`rgb(255, 12, 9)`, hover chữ trắng/gạch đỏ, màu viền focus trắng, không tràn ngang,
không còn `brand-inverse` trong footer. Không có lỗi JavaScript hoặc phản hồi HTTP
lỗi trong lượt kiểm màu; console vẫn có cảnh báo hydration của header và CORS giỏ
hàng do cổng xem thử không nằm trong origin được phép. Không sửa cấu hình hệ thống
để che các cảnh báo này. Hai kịch bản `footer-mobile.e2e.ts` VI/EN chưa đạt vì route
chính sách trên bản dev tự chuyển hướng vòng (301 về chính nó); không kết luận
toàn bộ E2E đạt, không sửa routing trong task màu sắc. Bản xem thử tạm đã dừng.

Bằng chứng màu/runtime: `/tmp/bigbike-footer-color-browser-20261025.json` và hai
ảnh `bigbike-web/e2e/__screenshots__/visual.e2e.ts/footer-{desktop,mobile}.png`.
Build Docker đã thành công, dựng đủ 95/95 trang, kiểm TypeScript đạt. Một số trang
vượt 60 giây ở lượt dựng đầu đã được Next tự thử lại và hoàn tất. Image mới:
`sha256:b0edfa4b6069a3a36a820407b3192a96af24649d305212aa563a599bb05b0d08`,
tag `bigbike-web:footer-color-20261025` và `bigbike-bigbike-web:latest`.
Image trước build được giữ ở `bigbike-web:before-footer-color-20261025-095432`.

**Tại thời điểm kết thúc build, chưa nạp image mới lên website.** Đối chiếu bằng `docker inspect bigbike-web
bigbike-admin bigbike-backend bigbike-postgres bigbike-redis bigbike-minio` xác nhận
cả sáu container giữ nguyên ID/image/thời điểm khởi động và đều healthy; hai file
env giữ nguyên SHA-256. Web đang chạy vẫn dùng
`sha256:ab5fcd31ee60b089c8800c5c3e82bf93d3baa1dfe83adc8fdb94d7491a43ec01`.
Chưa kiểm trình duyệt trên image mới đang chạy; phần kiểm màu bên trên chạy trên
bản xem thử source, không ghi nhận là đã nghiệm thu bản triển khai.

Log build: `/tmp/bigbike-footer-color-docker-build-final-20261025.log`.
Đối chiếu trước/sau: `/tmp/bigbike-footer-color-before-20261025.json` và
`/tmp/bigbike-footer-color-build-verification-20261025.json`.
`BUILT_NOT_DEPLOYED_2026-10-25`
`OWNER_REQUESTED_BUILD_2026-10-25`

Chủ shop sau đó đã yêu cầu “nạp đi” ngày 2026-10-25. Phạm vi được duyệt: nạp riêng
image web `bigbike-web:footer-color-20261025` ở trên bằng
`docker compose --env-file .env.vps up -d --no-deps --no-build --wait --wait-timeout 180 bigbike-web`.
Trước nạp đã xác nhận tag image đúng bản đã build, tag hoàn tác trùng bản đang chạy,
toàn bộ biến môi trường Compose truyền vào web và giới hạn bộ nhớ khớp container
hiện tại. Sau nạp kiểm image/healthy, startup revalidation, màu footer qua HTTPS,
luồng chân trang VI/EN và đối chiếu các dịch vụ còn lại.
`OWNER_APPROVED_DEPLOY_2026-10-25`

Kết quả nạp: web đã dùng đúng image `sha256:b0edfa4b6069a3a36a820407b3192a96af24649d305212aa563a599bb05b0d08`,
healthy; startup revalidation trả 200. Trang chủ HTTPS VI/EN trả 200 và có markup màu
mới. Playwright `footer-mobile.e2e.ts` trên `https://bigbike.vn` đạt 2/2 VI/EN tại
320/375/390/430/768/1024/1440px, gồm mở/thu, bàn phím, chữ 200%, không tràn ngang;
lỗi chuyển hướng của bản dev không xuất hiện trên bản triển khai. Kiểm màu/hover/focus
đạt 6/6 VI/EN ở 375/768/1440px; đã xem ảnh mobile/desktop. Không có lỗi JavaScript,
hydration hoặc HTTP lỗi; mỗi trang vẫn có CSP chặn Cloudflare beacon như trước.
Backend/admin/PostgreSQL/Redis/MinIO giữ nguyên container/image/thời điểm khởi động,
hai file env giữ nguyên SHA-256. Bằng chứng: `/tmp/bigbike-footer-color-deploy-20261025.log`,
`/tmp/bigbike-footer-color-deploy-verification-20261025.json`,
`/tmp/bigbike-footer-color-live-e2e-20261025.json`,
`/tmp/bigbike-footer-color-live-browser-20261025.json`.
`DEPLOYED_AND_VERIFIED_2026-10-25`

Chủ shop tiếp tục yêu cầu bỏ gạch dưới khi hover liên kết footer trong lúc nghiệm thu.
Áp dụng bản sửa theo `bigbike-web/STYLEGUIDE.md` phần Footer, build và nạp lại riêng
web theo phạm vi triển khai đã duyệt; giữ màu đỏ mới và viền focus bàn phím trắng.
Lượt bổ sung đã build thành công 95/95 trang, TypeScript đạt, image
`sha256:752868d979543dc152f7ef8f3493102bb85460f60868d919258581d7a12fc3e7`,
tag `bigbike-web:footer-hover-20261025`. Lint hai component, Prettier, guard dữ liệu
và kiểm encoding đạt; không thêm CSS hoặc mã kiểm thử vào repo. Chưa chạy lại bộ
unit đầy đủ sau lượt chỉ đổi class hiển thị này.

Đã nạp riêng web bằng `docker compose --env-file .env.vps up -d --no-deps --no-build
--wait --wait-timeout 180 bigbike-web`; container dùng đúng image trên, healthy,
startup revalidation trả 200. Giữ bản trước lượt bỏ gạch dưới ở
`bigbike-web:before-footer-hover-20261025-100953`. Kiểm `docker inspect` xác nhận năm
dịch vụ còn lại giữ nguyên container/image/thời điểm khởi động, đều healthy, hai
file env giữ nguyên SHA-256. Log: `/tmp/bigbike-footer-hover-build-20261025.log`,
`/tmp/bigbike-footer-hover-deploy-20261025.log`; đối chiếu tại
`/tmp/bigbike-footer-hover-deploy-verification-20261025.json`.
Nghiệm thu HTTPS đã đạt: `footer-mobile.e2e.ts` VI/EN đạt 2/2, hai kịch bản ảnh
footer desktop/mobile đạt và cập nhật có chủ đích ảnh chuẩn vì email pháp lý cũng
bỏ gạch dưới. Đã kiểm trực tiếp 21 liên kết ở mỗi tổ hợp VI/EN × 375/768/1440px
(126 lượt hover): không liên kết hoặc phần tử con nào có gạch dưới, tiêu đề nhóm
thu gọn cũng không có gạch dưới khi hover. Màu nhấn vẫn `rgb(255, 12, 9)`, link
chính sách hover chữ trắng, viền chọn bằng bàn phím trắng/nét liền/2px, không tràn
ngang. Không có lỗi JavaScript/hydration hoặc HTTP lỗi; vẫn ghi nhận CSP chặn
Cloudflare beacon như trước. Đã xem ảnh mobile/desktop sau cập nhật.
Kết quả: `/tmp/bigbike-footer-hover-live-e2e-20261025.json`,
`/tmp/bigbike-footer-hover-live-browser-20261025.json`; ảnh tại
`/tmp/bigbike-footer-hover-live-{vi,en}-{375,768,1440}-20261025.png`.
`FOOTER_NO_UNDERLINE_DEPLOYED_AND_VERIFIED_2026-10-25`
`OWNER_REQUESTED_FOOTER_HOVER_UPDATE_2026-10-25`

### Build và nạp bản mới sau pull 2026-10-24

Chủ shop yêu cầu build lại sau khi pull commit `85662e73`, sau đó yêu cầu nạp bản mới
lên hệ thống. Phạm vi: build cả ba app bằng `docker compose --env-file .env.vps build`,
giữ image đang chạy để hoàn tác, rồi nạp riêng từng app với
`docker compose --env-file .env.vps up -d --no-deps --no-build --wait <service>`.
Kiểm tra image, health, phản hồi HTTP và startup revalidation sau nạp. Đối chiếu trước
khi nạp xác nhận các biến môi trường được Compose truyền cho ba app khớp container
đang chạy; giữ giới hạn bộ nhớ backend 1 GB, admin 128 MB, web 512 MB. Không recreate
PostgreSQL, Redis hoặc MinIO. Kết quả được bổ sung sau khi thực hiện.
`OWNER_APPROVED_2026-10-24`

Kết quả: build thành công cả ba app, web dựng đủ 95/95 trang. Đã nạp lần lượt backend,
admin và web bằng lệnh có `--wait`; `docker inspect` xác nhận đúng image mới và cả ba
`running/healthy`:

- Backend: `sha256:7397e06601feb7d900650ace2042a48557fc4ab0a8ef37cf3cb43006f9053594`.
- Admin: `sha256:dd439b9985d3115f5353ee9a22a886b4fbe755b8c85bde3eea833c7415818143`.
- Web: `sha256:ab5fcd31ee60b089c8800c5c3e82bf93d3baa1dfe83adc8fdb94d7491a43ec01`.

Image trước nạp được giữ tại `<service>:before-rebuild-20261024-032120`. So sánh
466 resource/class migration với bản backend trước nạp không có khác biệt. Các dịch vụ
PostgreSQL/Redis/MinIO giữ nguyên image và thời điểm khởi động, đều healthy. Startup
revalidation của web trả HTTP 200. Kiểm HTTP với User-Agent trình duyệt: health backend,
admin localhost/HTTPS và trang chủ HTTPS VI/EN đều trả 200; HTML trang chủ có marker chân
trang mới. Playwright `footer-mobile.e2e.ts` chạy trên `https://bigbike.vn`, một worker,
đạt 2/2 kịch bản VI/EN tại 320/375/390/430/768/1024/1440px: mở/thu nhóm liên kết,
điều hướng bàn phím, giữ lựa chọn khi đổi cỡ, đủ thông tin shop, cỡ chữ 200% và không
tràn ngang. Không có lỗi JavaScript/hydration hoặc phản hồi HTTP lỗi trong hai lượt
trình duyệt; mỗi lượt còn một cảnh báo CSP chặn Cloudflare beacon như trước, không sửa
CSP trong đợt này. Không chạy lại bộ unit test đầy đủ; không đo lại upload Media thật.

Log: `/tmp/bigbike-rebuild-20261024.log`, `/tmp/bigbike-rebuild-deploy-{backend,admin,web}-20261024.log`.
Bằng chứng: `/tmp/bigbike-rebuild-{images,verification,rollback}-20261024.json`,
`/tmp/bigbike-rebuild-footer-e2e-20261024.json`.
`DEPLOYED_AND_VERIFIED_2026-10-24`

### Sửa đồng bộ sản phẩm nổi bật 2026-10-18 — đã nạp và nghiệm thu

Owner yêu cầu sửa chênh lệch danh sách nổi bật giữa admin/web và build bản mới bằng
`.env.vps`. Bản sửa áp dụng cho backend và web: xóa snapshot danh sách sản phẩm sau
commit trước khi phát revalidation, đồng thời bao phủ alias trang chủ/catalog/sản
phẩm VI đang được proxy sử dụng. Căn cứ: `API_CONTRACT.md` phần **Product list —
filter and sort params** và `INTEGRATION_GUIDE.md` phần **Web Revalidation**.

Build backend bằng context tạm tách các thay đổi Media còn chờ nạp từ 2026-10-13;
giữ nội dung bảo hành đã triển khai. Không sửa hay bỏ các thay đổi Media trong
workspace. Build web dùng source hiện tại. Cả hai lấy cấu hình từ `.env.vps`, không
thay file env. Giữ image đang chạy để hoàn tác, nạp riêng backend/web bằng
`docker compose --env-file .env.vps up -d --no-deps --no-build bigbike-backend bigbike-web`.
Không recreate admin hoặc dịch vụ dữ liệu. Giữ giới hạn bộ nhớ backend 1 GB, web
512 MB. Nghiệm thu: đúng image mới, healthy, startup revalidation thành công,
danh sách ID/thứ tự trên web VI/EN khớp PostgreSQL và API công khai. Không đổi danh
sách nổi bật thật chỉ để kiểm thử. Kết quả cuối ghi tại
`docs/audits/FEATURE_FEATURED_PRODUCTS_2026-10-18.md`. `OWNER_REQUESTED_2026-10-18`

Kết quả: build thành công hai app bằng `.env.vps`, rồi nạp lần lượt backend và web
với `--no-deps --no-build --wait`. Backend chạy image
`sha256:c4ae3991d56fbec587e2ac5fbefc11366d9455b38ed553caa92a0522b802dbce`;
web chạy image
`sha256:f1022aab4dfb984cf1068dc9ca4d8b7bad98b01d5d2d588e0ef1ee96c4d931ac`.
Cả hai healthy; startup revalidation trả 200. Đối chiếu PostgreSQL, public API
VI/EN và trang chủ VI/EN qua localhost lẫn `https://bigbike.vn/` đều cùng 5 ID,
đúng thứ tự đã lưu. Route revalidation trả đủ alias VI. So sánh jar xác nhận chỉ
`HomepageBlockMutationService.class` khác bản trước; các resource, migration và
Media giống bản đang chạy trước đợt này. Hai file env, giới hạn RAM và image/thời
điểm khởi động của admin/PostgreSQL/Redis/MinIO không đổi.

Đã giữ image cũ ở `bigbike-backend:before-featured-20261018` và
`bigbike-web:before-featured-20261018`; image Media đã build nhưng chưa nạp trước đó
được giữ thêm ở `bigbike-backend:pending-before-featured-20261018`. Web lint và
735/735 bài kiểm đạt; 15/15 bài backend tập trung đạt. Bộ backend đầy đủ chạy
1.539 bài, còn một failure cũ ở `ArticleExcerptAuthorRemovalMigrationPostgresTest`,
một bài skipped và không có error; không ghi bộ đầy đủ là pass. Bản build web có
các lượt tự thử lại trang tĩnh quá 60 giây khi chạy cùng bộ kiểm máy chủ, sau đó
dựng đủ 95/95 trang và build thành công. Log ở
`/tmp/bigbike-featured-*-20261018.log`; bằng chứng đã lọc tại
`docs/audits/evidence/featured-products-2026-10-18/verification.json`.
`DEPLOYED_AND_VERIFIED_2026-10-18`

### Tối ưu upload Media 2026-10-13 — đã nạp trong đợt 2026-10-24

Owner yêu cầu sửa hiện tượng admin upload ảnh nhỏ vẫn chờ lâu và build bản mới nhất bằng `.env.vps`. Đã chạy `docker compose --env-file .env.vps build` thành công cho cả ba app, không sửa env; web dùng lại image đang chạy. Backend mới chỉ khác các class xử lý Media so với jar đang triển khai, không có migration/resource/đổi quyền. Admin sửa lượt làm mới thư viện/picker. Căn cứ: `API_CONTRACT.md` phần **5. Thư viện ảnh/video (Media)** và `API_FLOW_MAP.md` hàng **Admin media UI**. `OWNER_REQUESTED_BUILD_2026-10-13`

Hai image trước đợt build 13/10 được giữ ở `bigbike-backend:before-media-performance-20261013` và `bigbike-admin:before-media-performance-20261013`. **Tại thời điểm 13/10 chưa nạp; bản sửa đã được nạp cùng bản mới ngày 24/10 theo yêu cầu owner và kết quả ở mục trên.** Các tiêu chí Media riêng cần đo lại gồm thống kê HTTP 200 dưới timeout, upload đúng một ảnh nhỏ mới trả 201 và hiện trong lưới, mỗi nhóm danh sách/thống kê/thư mục làm mới một lượt. Đợt 24/10 kiểm image/health và chân trang, không tải ảnh thử nên chưa kết luận thời gian upload sau triển khai. Các lỗi kiểm thử ngoài Media và số đo source/data parity trước nạp được ghi tại `docs/audits/FEATURE_MEDIA_UPLOAD_PERFORMANCE_2026-10-13.md`. `DEPLOYED_2026-10-24; UPLOAD_REMEASUREMENT_NOT_RUN`

### Khôi phục xem trước sản phẩm 2026-10-12

Chủ shop đã duyệt khởi động lại riêng website và cập nhật bản quản trị đã kiểm tra. Phạm vi: `docker compose --env-file .env.vps restart bigbike-web` giữ nguyên image web; build riêng `bigbike-admin` bằng `.env.vps`, giữ image quản trị đang chạy để hoàn tác, rồi nạp với `up -d --no-deps --no-build bigbike-admin`. Không nạp các thay đổi backend của phiên khác và không thay đổi hai file env hay dịch vụ dữ liệu. Nghiệm thu trên hệ thống đang dùng: healthy, preview VI/EN và trang chủ trả 200, khung xem trước hiển thị sản phẩm/ảnh, đổi thiết bị/ngôn ngữ và cập nhật nội dung chưa lưu không ghi sản phẩm. Báo cáo tại `docs/audits/FEATURE_PRODUCT_PREVIEW_2026-10-12.md`. `OWNER_APPROVED_2026-10-12`

Kết quả: đã khởi động lại `bigbike-web` lúc 16:39 (giờ Việt Nam), giữ image `sha256:de1d07ac45aecc117956039e046b284d85bf1cae21dd08a4afdc822af6816124`; startup revalidation trả 200 và website trở lại healthy. Đã build/nạp riêng quản trị lúc 16:42 với image `sha256:b5ef976b6aed286660316a9f82ff1aa26b324ad55796ec47cb12e98b9a065619`, healthy; image trước giữ ở `bigbike-admin:before-product-preview-20261012`. Backend, PostgreSQL, Redis và MinIO giữ nguyên image/thời điểm khởi động, đều healthy.

Kiểm HTTPS thực tế đạt: preview VI/EN và trang chủ trả 200; tám bước Playwright cho báo lỗi/Thử lại, VI/EN, Máy tính/Điện thoại, tên chưa lưu và đóng/mở lại đều đạt; ảnh sản phẩm tải được, không có lỗi trang hoặc API và không gọi thao tác ghi sản phẩm. Console còn thông báo Cloudflare beacon/inline script bị CSP chặn như trước thay đổi, không coi console hoàn toàn sạch. Log/ảnh tại `/tmp/bigbike-product-preview-{docker-build,docker-deploy,live-check}-20261012.log` và `/tmp/bigbike-product-preview-live*-20261012.png`.

### Cập nhật bảo hành 2026-10-08

Theo yêu cầu chủ shop, hai hạng mục ở `POLICY_PAGE_RULE_011` được đổi thành **Không bảo hành / No warranty** trong nguồn dùng chung của website và Trợ lý. Đã chạy `docker compose --env-file .env.vps build` cho ba app, rồi nạp riêng phần nội dung thay đổi bằng `docker compose --env-file .env.vps up -d --no-deps --no-build bigbike-backend`. Container backend dùng image `sha256:472786245647a5448c18707f7afc2542730ece54c5672fb192e8de03796a90b0`, trạng thái `healthy`; image trước giữ tại `bigbike-backend:before-warranty-20261008`. Web/admin build dùng cache và tiếp tục chạy trong container hiện có. Không thay đổi `.env.vps` hoặc các dịch vụ dữ liệu.

Đã làm mới hai tag `store-policies` và `policy:warranty` qua route revalidation của web. Năm bài `StorePolicyServiceTest` đạt; kiểm HTTPS thực tế tại API policy và trang Bảo hành VI/EN xác nhận đúng hai dòng đổi thành không bảo hành, khóa kéo/khóa dán vẫn 6 tháng và keo đế giày vẫn 12 tháng. Log tại `/tmp/bigbike-warranty-{tests,docker-build,docker-deploy,live-checks}-20261008.log`; HTML đã kiểm tại `/tmp/bigbike-warranty-live-{vi,en}-20261008.html`. `OWNER_REQUESTED_2026-10-08`

### Nạp riêng bản web đã build

Logo Bộ Công Thương 2026-10-23: chủ shop yêu cầu thêm logo xanh và liên kết xác nhận theo
`BUSINESS_RULES.md` `POLICY_PAGE_RULE_010`, sau đó build bản web mới bằng `.env.vps`.
Phạm vi build là `docker compose --env-file .env.vps build bigbike-web`; giữ nguyên file env
và các dịch vụ đang chạy. Lệnh build chỉ tạo image mới; nạp image lên website là bước riêng
theo hướng dẫn bên dưới.

Kết quả 2026-10-23: build thành công, dựng đủ 95/95 trang; image mới
`sha256:3cc448758a34bf939a6c153c24a43316ea55f578b4e7a8693b17f95614e25f21`, tag
`bigbike-web:bct-20261023` và `bigbike-bigbike-web:latest`. Lint/guard, định dạng các file UI
đã sửa và 110 file/746 bài Vitest đều đạt (lượt hoàn chỉnh dùng `--maxWorkers=2 --testTimeout=15000`
sau khi đóng bản xem thử để giảm tải bộ nhớ). Playwright trên bản xem thử `http://localhost:3107`
với backend thật xác nhận logo/liên kết đạt 6/6 tại 375/768/1440px cho VI/EN: ảnh tải được,
giữ tỉ lệ, không tràn ngang, nhãn hỗ trợ đọc đúng ngôn ngữ; đã bấm và xác nhận tab mới mở
đúng trang online.gov.vn. Đã xem ảnh chân trang mobile/desktop. Một lượt chụp sớm trên EN
mobile phát sinh cảnh báo do công cụ tạm ẩn con trỏ trong ô tìm kiếm; kiểm lại sau khi tải xong,
giữ nguyên con trỏ khi chụp, không có lỗi runtime. Một số lượt dev còn cảnh báo khung ảnh
sản phẩm trang chủ ngoài phạm vi chân trang; không sửa trong đợt này.

Tại thời điểm hoàn tất build, **chưa nạp image mới hoặc khởi động lại dịch vụ**. `docker ps --filter 'name=^/bigbike-web$'`
và `docker inspect bigbike-web` xác nhận container web vẫn healthy, dùng image trước
`sha256:4d8a09f75bdb11aa12d6784b7f0cd0f8bcadc515836deeeb1105bb8820d874a0`; đã giữ thêm tag
`bigbike-web:before-bct-20261023`. Không sửa `.env`/`.env.vps` hoặc build/recreate backend,
admin và dịch vụ dữ liệu. Log kiểm tra/build nằm tại `/tmp/bigbike-footer-bct-lint-20261023.log`,
`/tmp/bigbike-footer-bct-tests-final-20261023.log`, `/tmp/bigbike-footer-bct-build-20261023.log`;
kết quả trình duyệt/ảnh tại `/tmp/bigbike-footer-bct-browser-20261023.json`,
`/tmp/bigbike-footer-bct-runtime-recheck-20261023.json`, `/tmp/bigbike-footer-bct-{vi,en}-{375,768,1440}-20261023.png`.

Chủ shop đã yêu cầu nạp bản mới sau khi nhận kết quả build ngày 2026-10-23.
Phạm vi được duyệt: `docker compose --env-file .env.vps up -d --no-deps --no-build --wait bigbike-web`,
dùng đúng image `bigbike-web:bct-20261023` đã kiểm tra ở trên. Sau nạp kiểm image/healthy,
HTML công khai và logo/liên kết trên website thật; giữ nguyên backend, admin, dịch vụ dữ liệu
và hai file env. `OWNER_APPROVED_2026-10-23`

Kết quả nạp 2026-10-23: lệnh được duyệt hoàn tất, `bigbike-web` chạy đúng image
`sha256:3cc448758a34bf939a6c153c24a43316ea55f578b4e7a8693b17f95614e25f21`, trạng thái
**healthy**. `docker inspect` trước/sau xác nhận backend, admin, PostgreSQL, Redis và MinIO
giữ nguyên image và thời điểm khởi động. Trang chủ HTTPS trả 200, có logo và liên kết đúng;
file logo công khai có SHA-256 `42ee1fa5050c4d69a810803275e61b7deb286ee4a49ff4da1e69e5025a97dc36`,
trùng file gốc đã tải. Playwright trên `https://bigbike.vn/` và `/en/` kiểm logo đạt 6/6 ở
375/768/1440px; đã bấm logo trên website thật và xác nhận mở đúng trang Bộ Công Thương trong
tab mới. Bốn lượt 375/768 đạt trước khi tiến trình kiểm bị dừng; đã chạy riêng hai lượt 1440
và kiểm thao tác bấm, đều đạt. Không có lỗi JavaScript của trang; console còn CSP chặn
Cloudflare beacon và cảnh báo định dạng currency của Meta Pixel ngoài phạm vi logo,
không thay CSP hoặc cấu hình theo dõi trong đợt này.

Log nạp: `/tmp/bigbike-footer-bct-deploy-20261023.log`; trạng thái trước/sau tại
`/tmp/bigbike-footer-bct-services-{before,after}-20261023.log`; HTML, logo và ảnh thực tế tại
`/tmp/bigbike-footer-bct-live-vi-20261023.html`, `/tmp/bigbike-footer-bct-live-logo-20261023.png`,
`/tmp/bigbike-footer-bct-live-{vi,en}-{375,768,1440}-20261023.png`. Hai lượt desktop và thao tác
bấm được lưu tại `/tmp/bigbike-footer-bct-live-browser-20261023.json` và
`/tmp/bigbike-footer-bct-live-click-20261023.log`.

Phiếu SEO trang chủ/danh mục 2026-10-22: owner yêu cầu triển khai DEV-1–DEV-4 rồi build Docker bằng
`.env.vps` thành bản mới. Chạy lint/test web và kiểm tra ranh giới domain, giữ image web đang chạy
bằng tag `bigbike-web:before-seo-20261022`, build riêng `bigbike-web` với `.env.vps`, kiểm bản image mới
trên cổng loopback tạm trước khi nạp riêng web. Không build/recreate backend, admin hoặc dịch vụ dữ liệu.
Sau nạp, kiểm healthy và HTML/DOM trang chủ, danh mục cha/con/EN qua HTTPS. Không sửa `.env.vps`, CSP
hoặc cài đặt Pixel trong phiếu này. Kết quả/image cụ thể được ghi sau khi các bước thực sự hoàn tất.

Kết quả 2026-10-22: đã build/nạp riêng web bằng hai lệnh bên dưới. Container `bigbike-web` dùng image
`sha256:4d8a09f75bdb11aa12d6784b7f0cd0f8bcadc515836deeeb1105bb8820d874a0`, trạng thái **healthy**,
tag `bigbike-web:seo-20261022`; image trước giữ tại `bigbike-web:before-seo-20261022`. Lint/guard,
746 bài kiểm web, TypeScript, kiểm ranh giới domain và 10 kịch bản Playwright HTTPS đều đạt.
HTML/DOM trang chủ có 2 JSON-LD; danh mục cha/con/EN kiểm 5 lần/trang đều 1 intro/6 câu hỏi/3 JSON-LD,
lang và mô tả đúng. Schema.org kiểm HTML mới trả 0 lỗi/0 cảnh báo; chế độ fetch URL không lấy được trang.
Google Rich Results yêu cầu đăng nhập nên chưa xác nhận kết quả từ Google. CSP/Pixel không đổi;
backend/admin và dịch vụ dữ liệu không được recreate trong đợt này. Bằng chứng:
`docs/audits/FEATURE_HOME_CATEGORY_STRUCTURED_DATA_2026-10-22.md`.

`docker compose --env-file .env.vps build bigbike-web` tạo image mới; container đang chạy tiếp tục dùng image cũ. Khi chủ shop yêu cầu áp dụng thay đổi lên website, nạp image đã kiểm tra bằng `docker compose --env-file .env.vps up -d --no-deps --no-build bigbike-web`. Giữ image trước đó để có thể hoàn tác; xác nhận container dùng đúng image mới, trạng thái healthy và nội dung hiển thị qua `https://bigbike.vn/`.

Đợt chính sách ngày 2026-10-01: chủ shop yêu cầu khắc phục footer vẫn cũ sau khi build. Bản triển khai trước đó có 9 mục chính sách và 2 hướng dẫn size; ngày 2026-10-02 chủ shop xác nhận cách tách thành 9 mục là hiểu sai. Mốc 11 liên kết chỉ mô tả bản cũ, không phải tiêu chí hiện hành.

Bổ sung ngày 2026-10-02 theo hai ảnh và `POLICY_PAGE_RULE_004/010`: chủ shop yêu cầu bỏ logo/liên kết Bộ Công Thương, công bố đầy đủ thông tin hộ kinh doanh và người đại diện, giữ Bảo hành cùng hai hướng dẫn size, rồi build và nạp lại `bigbike-web` bằng `.env.vps`. Kiểm cả VI/EN trên máy tính/điện thoại và xác nhận không còn logo Bộ Công Thương trên website sau khi nạp. `OWNER_REQUESTED_2026-10-02`

Kết quả 2026-10-02: đã chạy `docker compose --env-file .env.vps build bigbike-web`, rồi `docker compose --env-file .env.vps up -d --no-deps --no-build bigbike-web`. Container `bigbike-web` dùng image `sha256:6c0e971eb550ab30805abd623d8759c3502b54d8b3048b2cb642aa642d08bd57`, trạng thái `healthy`; image trước được giữ ở tag `bigbike-web:before-footer-20261002`. HTML qua `https://bigbike.vn/` và hai hướng dẫn size đã có GPKD/người đại diện mới, không còn logo hoặc liên kết Bộ Công Thương.

Kiểm tra đạt: web lint, 115 file/784 bài Vitest, build production trong Docker; chân trang VI/EN ở 375/768/1440px và 21 lượt kiểm chính sách/điều hướng. Kiểm trình duyệt đi qua HTTPS tới Nginx trên máy chủ với dữ liệu thật. Các lượt tải tự động ban đầu bị giới hạn tốc độ Nginx; khi chạy lại cùng các kiểm tra với nhịp yêu cầu 120ms trong bản runner tạm, toàn bộ 21 lượt đạt. Không thay đổi cấu hình giới hạn tốc độ hoặc thêm dữ liệu giả vào ứng dụng.

Đợt sửa tiếp ngày 2026-10-02: tiêu chí mới là bảy mục đúng tên/thứ tự SEO, nguyên văn phần “Copy bên dưới”, một trang gộp cung cấp dịch vụ/đổi trả/hoàn tiền, giữ Bảo hành/hai hướng dẫn size ở nhóm riêng, đủ năm dòng hộ kinh doanh và không có nhãn/liên kết Bộ Công Thương. Chủ shop tiếp tục yêu cầu sửa và đã cho phép build/nạp web bằng `.env.vps`. Sau khi kiểm tra dùng lại hai lệnh nạp riêng web bên trên; xác minh cả URL Giao hàng cũ chuyển về trang gộp. Kết quả của đợt trước không thay cho việc kiểm tra bản sửa này.

Kết quả bản sửa bảy mục ngày 2026-10-02: build bằng `.env.vps` thành công, đã nạp riêng `bigbike-web` với `up -d --no-deps --no-build`. Container dùng image `sha256:81db810e8504bd5939576fda617965b28d66ccf2e45f48c3c0709a11f12007f1`, trạng thái `healthy`; image trước giữ ở tag `bigbike-web:before-seven-policies-20261002`. Backend, admin và các dịch vụ dữ liệu tiếp tục chạy, không được recreate trong đợt này.

Kiểm tra bản sửa đạt: lint/guard, 115 file và 785 bài Vitest, Docker production build; 17 lượt Playwright đọc/điều hướng VI/EN, trong đó cả bảy thân bài VI render thật khớp bản nguồn `POLICY_PUBLICATION_2026-10-02.md`. Footer đạt ở 375/768/1440px cho VI/EN: bảy mục đúng thứ tự, ba liên kết giữ riêng, đủ năm đoạn pháp lý, logo BigBike tải được và không có Bộ Công Thương. Bảo hành và hai trang size đọc được; URL Giao hàng VI/EN trả 301 đúng đích; sitemap khai bảy mục chính cùng Bảo hành cho mỗi ngôn ngữ, không khai URL Giao hàng chuyển hướng. HTML tải từ website công khai cũng có đúng bảy mục và thông tin pháp lý mới.

Ảnh và log kiểm trình duyệt ở `/tmp/bigbike-seven-policies-qa-20261002/`; log build/lint/Vitest ở `/tmp/bigbike-seven-policies-{docker-build,lint,tests}-20261002.log`. Runner tạm tiếp tục dùng HTTPS tới Nginx thật và nhịp yêu cầu 120ms để tránh giới hạn tốc độ; không mock nội dung hoặc sửa giới hạn tốc độ.

Bổ sung theo phản hồi “Thông tin có tới 10 link” ngày 2026-10-02: bản trước mới chia bảy và ba liên kết bằng đường kẻ dưới cùng tiêu đề. Chủ shop đã chọn chuyển ba liên kết giữ lại sang nhóm riêng **Bảo hành và hướng dẫn**. Tách thành hai nhóm có tiêu đề và vùng mở/thu riêng: Thông tin chứa bảy mục, Bảo hành và hướng dẫn chứa ba mục giữ lại. Dùng lại `.env.vps` để build/nạp riêng web sau kiểm tra, xác minh số liên kết theo từng nhóm trên VI/EN và 375/768/1440px.

Kết quả tách nhóm footer ngày 2026-10-02: lint/guard và 3 file/14 bài Vitest về nội dung/song ngữ đạt; Docker production build bằng `.env.vps` thành công. Đã nạp riêng `bigbike-web` với `up -d --no-deps --no-build`; container dùng image `sha256:cbc3cb6ae45c11fe701281add4749cf7076c6463f864a2e74716ff0e5892afce`, trạng thái `healthy`. Image trước giữ ở tag `bigbike-web:before-footer-groups-20261002`.

HTML tải từ website công khai cho cả VI/EN có hai tiêu đề riêng, đúng bảy liên kết trong Thông tin và ba liên kết trong Bảo hành và hướng dẫn. Sáu lượt kiểm trình duyệt ở 375/768/1440px cho VI/EN đạt: đếm liên kết trong từng nhóm, mở/thu độc lập dưới 992px, không tràn ngang, đủ năm đoạn pháp lý và không có nhãn/liên kết Bộ Công Thương. Đã xem ảnh desktop/mobile; ảnh/log/report ở `/tmp/bigbike-footer-groups-qa-20261002/`, log build/lint/Vitest ở `/tmp/bigbike-footer-groups-{docker-build,lint,tests}-20261002.log`. Backend, admin và các dịch vụ dữ liệu giữ nguyên container trong đợt nạp này.

Only `bigbike-web` has links that genuinely change per environment: its client bundle calls
the backend + MinIO **directly from the customer's browser**, so `NEXT_PUBLIC_API_BASE_URL`
and `BIGBIKE_LEGACY_UPLOADS_BASE` must be public addresses rather than `localhost`. Since the
2026-08-06 domain cutover those are the https subdomains behind host nginx
(`https://api.bigbike.vn`, `https://media.bigbike.vn`); container ports stay on `127.0.0.1`,
so a raw `http://<server-ip>:<port>` value would both bypass nginx and be unreachable.
`CONFIRMED_FROM_CONFIG`

`bigbike-admin` is environment-portable: its browser calls hit relative paths (`/api/v1`,
`/media/`, `/ws`) that nginx proxies to internal Docker hostnames (`bigbike-backend:8080`,
`minio:9000`), so its API base never changes. Admin build values that may vary by environment are
`VITE_STOREFRONT_BASE_URL` (live-preview iframe) and optional `VITE_MINIO_EXTRA_ORIGINS`
(comma-separated legacy media origins that must be rewritten through `/media-proxy/`). Both are
passed from the env-file through Compose build args; the extra-origin list defaults to empty and
must never contain a retired host implicitly. `CONFIRMED_FROM_CONFIG`

### Production hostname boundary (`api.bigbike.vn` vs `admin.bigbike.vn`)

The two public hostnames are separate ingress boundaries even though they ultimately reach the
same backend. Nginx must reject a request on the wrong hostname with `404` before proxying it; a
backend `401`, `403` or validation error is not proof that the hostname boundary is closed.

| Host | API paths served | API paths hidden with `404` |
|---|---|---|
| `api.bigbike.vn` | Storefront/customer APIs, including products, customer auth, cart, checkout, content and public settings | `/api/v1/admin`, `/api/v1/admin/**`, `/api/v1/auth`, `/api/v1/auth/**` |
| `admin.bigbike.vn` | `/api/v1/admin/**`, `/api/v1/auth/**`, `/api/v1/catalog/facets`, `/api/v1/settings/public`, `/api/v1/articles` and `/api/v1/articles/**` | Every other `/api` or `/api/**` path |

Nginx là chốt ngoài, còn backend là chốt độc lập thứ hai và phải chặn ngay khi khởi động; không
có chế độ chỉ ghi nhận. Backend phân loại theo `Host` do Nginx ghi đè, không tin
`X-Forwarded-Host`, bỏ cổng và dấu chấm cuối rồi so sánh không phân biệt hoa/thường:

| Nhóm backend | Host mặc định | Phạm vi |
|---|---|---|
| Cửa khách | `api.bigbike.vn`, `bigbike-backend` | Chặn `/api/v1/admin`, `/api/v1/auth` và `/ws`; giữ nguyên API khách và `/api/internal/**` |
| Cửa nhân viên | `admin.bigbike.vn` | Chỉ năm nhóm API trong bảng trên và `/ws` |
| Phát triển/kiểm thử chung | `localhost`, `127.0.0.1`, `::1` | Cho cả hai phía để không làm hỏng Vite, Maven và health-check |

Host thiếu hoặc không thuộc ba nhóm trả `404`. Các biến triển khai là
`BIGBIKE_INGRESS_BOUNDARY_ENABLED`, `BIGBIKE_INGRESS_ADMIN_HOSTS`,
`BIGBIKE_INGRESS_PUBLIC_HOSTS` và `BIGBIKE_INGRESS_SHARED_HOSTS`; mặc định an toàn là bật. Danh
sách production phải giữ `bigbike-backend`, vì web gọi API bằng tên Docker này thay vì tên miền
công khai. `OWNER_CONFIRMED_2026-09-12`

Tại cửa khách, Nginx và backend đều nhận diện đoạn bảo vệ không phân biệt hoa/thường và coi dấu
`;` sau `admin`/`auth` là tham số đường dẫn cần chặn. Quy tắc phải neo ngay sau
`/api/v1/`, không được chặn nhầm `/api/v1/customer/auth/**`. Khai báo riêng cho
`/api/v1/admin/media` phải được giữ vì đường tải ảnh từng có proxy riêng. `OWNER_CONFIRMED_2026-09-12`

The admin hostname restriction applies only to `/api`. Its SPA at `/`, order-notification
WebSocket at `/ws`, product media at `/media/` and `/media-proxy/`, and category background assets
at `/wp/` remain available. The admin request limiter is the coarse `general_limit` policy
(30 requests/second with burst 30) on ordinary HTTP/UI and allowed API proxy locations. `/ws` is
deliberately exempt: Nginx sees the Cloudflare edge address rather than the employee address, so a
connection cap could group unrelated staff sessions and interrupt notifications. Do not add
Nginx `allow`/`deny`, `real_ip`, or trust a Cloudflare forwarding header as part of this boundary;
the employee network allowlist remains owned by Cloudflare. `OWNER_CONFIRMED_2026-09-12`

On production, `/etc/nginx/sites-available/api.bigbike.vn` and
`/etc/nginx/sites-available/admin.bigbike.vn` are always the deployment baseline. Before the
2026-09-12 boundary rollout, the handoff measured the repository copies as 121 and 102 diff lines
away from those active files; the active copies contained the real WebSocket and outage behavior.
Always copy the active files to candidates, add the intended delta, run `nginx -t`, reload only
after it passes, and then mirror the accepted live files back to `deploy/nginx/` and
`deploy/nginx/live-reference/`. A repository mirror is evidence and rollback context, never
permission to overwrite a newer active file without a fresh diff. `CONFIRMED_FROM_LIVE_CONFIG_2026-09-12`

The `admin.bigbike.vn` HTTPS vhost must stream proxied request and response bodies at server scope:
keep `proxy_request_buffering off`, `proxy_buffering off` and `proxy_max_temp_file_size 0`. The
admin host sits behind Cloudflare and forwards to one local container, so it must not spill product
JSON uploads, media responses, exports or large SPA assets into `/var/lib/nginx/body` or
`/var/lib/nginx/proxy`. On 2026-09-13 those temporary directories became unwritable to Nginx;
two product-import validation requests returned Nginx `500` before reaching the backend, while
large product images were returned as truncated `200` responses. Server-wide streaming removes
that failure dependency for every current and future admin proxy location. Before and after every
admin-vhost rollout, run `deploy/nginx/tests/admin-proxy-streaming-config-test.sh` against the
candidate/active file, verify `nginx -t`, and confirm a JSON import dry-run plus a media response
larger than the proxy memory buffers complete without a new `Permission denied` entry. Do not
change the API allowlist, rate-limit or outage behavior as part of this safeguard.
`OWNER_CONFIRMED_AND_DEPLOYED_2026-09-13`

### Cửa ảnh công khai (`media.bigbike.vn`)

Cửa ảnh chỉ chuyển tiếp `GET`, `HEAD`, `OPTIONS` dưới `/bigbike-media/<object-key>`. Hai đường gốc
`/bigbike-media` và `/bigbike-media/` cùng mọi đường khác phải trả `404` tại Nginx, nhờ đó không
chuyển yêu cầu liệt kê kho, đường quản trị MinIO hoặc kho `bigbike-chat-private` vào MinIO. Các
phương thức ghi dưới đường ảnh công khai tiếp tục bị `limit_except` từ chối. Không đặt
`limit_req`/`limit_conn` trên host này cho tới khi lớp trung gian cung cấp địa chỉ khách đáng tin.

Khi Nginx tự sinh `502`/`504` vì MinIO không phản hồi, host trả trang
`maintenance-media.html` với mã `503`, `Retry-After: 60` và `Cache-Control: no-store`.
`proxy_intercept_errors` phải để `off`, nên phản hồi hợp lệ từ MinIO như ảnh không tồn tại vẫn giữ
nguyên. Bản ứng viên nằm ở `deploy/nginx/media.bigbike.vn.conf`; bản chụp production trước khi
owner kích hoạt nằm ở `deploy/nginx/live-reference/media.bigbike.vn`. `OWNER_CONFIRMED_2026-09-12`

> **Build-time bake:** every `NEXT_PUBLIC_*` and `VITE_*` value is compiled into the web/admin
> bundle at build time. After changing any of them you MUST rebuild (`--build`); a plain
> restart keeps the old links. `CONFIRMED_FROM_CONFIG`

When migrating from IP:port to a domain, swap the public values in `.env.vps` for the domain
(e.g. `https://api.bigbike.vn`), update `BIGBIKE_CORS_ALLOWED_ORIGINS`, set
`BIGBIKE_COOKIES_DOMAIN` (below), and rebuild.

> **Always pass `--env-file .env.vps` on the VPS.** A bare `docker compose up -d --build`
> silently falls back to `.env` (the local file), which bakes `http://<server-ip>:<port>` into
> the web bundle: canonical/`og:url` tags advertise the raw origin IP and every browser call
> targets a port that is firewalled off. Observed live on 2026-08-07.

### Cookie Domain when the storefront and the API are different hosts

`BIGBIKE_COOKIES_DOMAIN` sets the `Domain` attribute on the customer cookies
(`bb_session`, `bb_csrf`, `bb_refresh`, `bb_guest_id`). `CONFIRMED_FROM_CODE`
(`CustomerAuthCookies.java`, `application.properties`)

| Environment | Value | Why |
|---|---|---|
| Local (`localhost:3000` + `localhost:8080`) | blank | Cookies ignore the port, so a host-only cookie already reaches both. |
| VPS (`bigbike.vn` + `api.bigbike.vn`) | `.bigbike.vn` | Different hosts of the same site. |

Without it on a split-host deployment the cookies are host-only and two things break, both
silently:

1. The storefront reads `bb_csrf` from `document.cookie` to build the `X-CSRF-Token` header
   (`bigbike-web/lib/api/client-api.ts`). It cannot see a cookie scoped to `api.bigbike.vn`,
   so **every customer mutation — add-to-cart, checkout, profile edit, review — returns
   `403 CSRF_INVALID`.**
2. `bigbike-web/proxy.ts` guards `/tai-khoan/**` on the presence of `bb_session`. That cookie
   is never visible on `bigbike.vn`, so logged-in customers are bounced back to the login page,
   and the social-login callback — which redirects to `/tai-khoan/` — looks like it silently
   failed.

This regressed with the 2026-08-06 domain cutover and was caught on 2026-08-07; see
`docs/audits/FINDING_2026-08-07_COOKIE_DOMAIN_SPLIT_HOST.md`.

### Flyway on a database that once ran the `dev` profile

The VPS database applied 14 seed migrations `V1001..V1015` from `classpath:db/migration-dev`
while the stack was still on the `dev` profile. Profile `prod` ships only `classpath:db/migration`
(max `V373`), so those rows stay in `flyway_schema_history` with no matching file. Two env vars
handle it, and **both are required** — either one alone leaves the stack broken.
`CONFIRMED_FROM_CONFIG` (`docker-compose.yaml`, `.env.vps.example`)

| Var | Value on VPS | Without it |
|---|---|---|
| `SPRING_FLYWAY_IGNORE_MIGRATION_PATTERNS` | `*:missing,*:future` | Backend refuses to start: `Detected applied migration not resolved locally: 1001…`. `*:missing` alone is **not** enough — `V1001+` outranks every classpath version, so Flyway classifies them `future`, not `missing`. |
| `SPRING_FLYWAY_OUT_OF_ORDER` | `true` | Every NEW prod migration (`V371` onward) is numbered below the applied `V1015`, so Flyway marks it `ignored`. Startup fails with `Detected resolved migration not applied to database: 371…`. |

Both default to the safe value (blank / `false`) so a fresh deployment keeps full Flyway
validation. Only set them on a stack carrying this legacy history.

For local Docker development, the root `.env` uses `SPRING_PROFILES_ACTIVE=dev` and must
set `SPRING_FLYWAY_OUT_OF_ORDER=true` when the database already contains the
`db/migration-dev` history. `docker-compose.yaml` passes this variable into the backend,
so an explicit `false` overrides the profile's dev setting and prevents `V368+` from running.

## Deployment Notes

- Backend healthcheck uses `GET /actuator/health`. `CONFIRMED_FROM_CONFIG`
- Web and admin have container healthchecks. `CONFIRMED_FROM_CONFIG`
- The web container self-revalidates its storefront ISR cache on startup via `docker-entrypoint.mjs`: after `next build` bakes a data snapshot into the prerendered pages, the entrypoint waits for the server then POSTs the catalog/content tags to `/api/revalidate` so a fresh start serves backend-fresh data. This runs on every container start — including partial `docker compose up --no-deps` rebuilds — and replaces the former external `bigbike-web-init` one-shot container. `CONFIRMED_FROM_CONFIG`
- Backend mail sending is optional when SMTP env vars are empty. `CONFIRMED_FROM_CONFIG`
- `BIGBIKE_MAIL_ADMIN` is required whenever the backend starts, even when SMTP is disabled. Set it in the selected env-file (`.env` locally or `.env.vps` on the VPS); the checked-in examples use `bigbikevnshop@gmail.com`. This is the one shared recipient for new-order alerts; assistant chat no longer sends internal handoff mail. Missing or malformed values stop backend startup with an explicit configuration error; there is no code or Compose fallback mailbox. `CONFIRMED_FROM_CONFIG`
- Telegram new-order alerts are optional and add to the internal email; they never replace it. Set `BIGBIKE_TELEGRAM_BOT_TOKEN` and `BIGBIKE_TELEGRAM_CHAT_ID` in the selected deployment env-file to enable the channel. Leave either value blank to disable it without affecting backend startup or checkout. `BIGBIKE_TELEGRAM_API_BASE_URL` may point at a controlled fake HTTP service for tests and otherwise defaults to `https://api.telegram.org`; `BIGBIKE_TELEGRAM_TIMEOUT_SECONDS` defaults to 5 seconds. The client sends one post-commit asynchronous request per new order, makes no retry, and logs only a sanitized warning on failure. Never put the bot token or chat ID in Compose, checked-in examples, application logs or incident text; the real values are injected directly on the server.
- **Replacing the Telegram bot on the VPS:** save the approved replacement in `BIGBIKE_TELEGRAM_BOT_TOKEN` in `.env.vps`; preserve the destination unless the owner also requests a recipient change. Telegram [`getMe`](https://core.telegram.org/bots/api#getme) checks the intended bot, while [`getChat`](https://core.telegram.org/bots/api#getchat) checks access to the configured destination. For a private destination, the recipient must [contact the replacement bot first](https://core.telegram.org/bots/tutorial#sending-messages). Saving a valid credential does not by itself confirm message delivery. Backup jobs read the same token and chat ID from `.env.vps` on each run, so an inaccessible destination also interrupts backup alerts. The backend loads these values at startup; applying an env-file change requires recreating only `bigbike-backend` using its deployed image, with the runtime approval required by `AGENTS.md` Section 5.6. A plain [`docker compose restart`](https://docs.docker.com/reference/cli/docker/compose/restart/) does not reload environment changes. Do not include credential values in the change report.
- **Changing the Telegram recipient on the VPS:** an owner-approved recipient change updates only `BIGBIKE_TELEGRAM_CHAT_ID` in `.env.vps`, preserving the current bot token. Identify the intended private account from its exact `/start` event and verify access with `getChat`; starting the bot from another account does not unblock the configured recipient. The destination is shared by new-order and backup alerts, so both move together. Before applying the change, compare the rendered backend configuration with the running container, retain a private rollback copy, and recreate only `bigbike-backend` with its existing image and deployment overrides. Verify that the running destination matches the approved account and the service is healthy. Record no token or chat ID in the report, and distinguish configuration/access checks from an actually accepted message. `OWNER_CONFIRMED_2026-09-08`
- `BIGBIKE_REVIEW_INVITATION_ENABLED` is the only emergency switch for automatic post-purchase review invitations and defaults to `true`. The workflow always waits 7 days after completion and allows 20 send attempts per Vietnam calendar day. Set it to `false` in the backend deployment environment and restart/redeploy the backend; the next scheduler callback closes the active campaign and skips pending deliveries. Setting it back to `true` starts a new campaign cutoff without backfill. There is no admin Settings control or reporting screen. `OWNER_CONFIRMED_2026-09-01`
- `EmailDispatchService` logs a successful SMTP handoff as provider acceptance only. It does not claim final delivery, because SMTP acceptance cannot confirm that the recipient mailbox accepted the message later. `CONFIRMED_FROM_CODE`
- `NEXT_PUBLIC_GA4_MEASUREMENT_ID` enables storefront analytics and is baked into the browser bundle at build time, so changing it requires `docker compose --env-file <file> up -d --build bigbike-web`; a plain restart keeps the previous value. It is declared in `build.args:`, `environment:` and `bigbike-web/Dockerfile`. Leave it blank on local/staging. `CONFIRMED_FROM_CONFIG`
- **Backend memory and garbage collection** — the backend container remains capped at `1g`; Java
  uses G1GC with `MaxRAMPercentage=50.0`, so the JVM heap stays within that existing container
  limit. Do not raise the backend to 4 GB on the shared 8 GB server.
  **Lowered from 75.0 to 50.0 on 2026-08-21**: at 75.0 the heap ceiling alone was 768 MB, and the
  JVM's non-heap footprint (metaspace, code cache, ~69 thread stacks, direct buffers) added roughly
  400 MB, so the container sat at 982 MB / 1024 MB (91.5%) with no headroom — a traffic spike that
  let G1 grow the heap toward its ceiling would have been OOM-killed. Measured over 3 h of live
  traffic the live set was only ~140 MB with **zero Full GCs** and 9-36 ms young pauses, so a
  512 MB ceiling is still ~3.5x the working set. `CONFIRMED_FROM_RUNTIME`
  This setting is designed to let collection work use the host's available CPU cores without
  changing the memory allocation. Java emits its G1 collection identification to the backend log,
  so the shop owner can verify the active collector after deployment. The runtime also uses UTF-8
  so Vietnamese operational logs remain readable.
- **Database connections** — the pool reports a checked-out connection held over 5 seconds,
  validates connections before use, keeps idle connections alive, and uses TCP keepalive to detect
  dead network sessions. PostgreSQL's
  `idle_in_transaction_session_timeout=30000` only terminates abandoned transactions; it does not
  impose a statement timeout on valid long-running queries.
- **Prometheus and PostgreSQL slow-query evidence** — the internal-only
  `/actuator/prometheus` endpoint requires the Prometheus registry dependency. PostgreSQL keeps
  statement logging at 200 ms and is configured with `shared_preload_libraries=pg_stat_statements`.
  The latter takes effect only after the shop owner redeploys/restarts PostgreSQL. Never expose
  Prometheus through the public nginx host.
- Multi-replica ISR currently uses deploy-time fan-out, not a shared Next.js cache handler. If
  more than one `bigbike-web` replica is deployed, `WEB_REVALIDATE_URL` must list every
  replica's `/api/revalidate` URL. Leave `WEB_REDIRECT_CACHE_CLEAR_URL` blank to derive every
  replica's `/_internal/redirect-cache/clear` endpoint, or list each clear endpoint explicitly.
  Set `WEB_REVALIDATE_EXPECTED_REPLICAS=N` so backend startup fails when the fan-out is
  incomplete instead of leaving one replica silently stale. `CONFIRMED_FROM_CONFIG`
- CORS must be set explicitly through `BIGBIKE_CORS_ALLOWED_ORIGINS`. `CONFIRMED_FROM_CONFIG`
- `BIGBIKE_COOKIES_DOMAIN` must be set on any split-host deployment — see the section above. `CONFIRMED_FROM_CODE`
- Social login (OAuth2) needs six vars: `OAUTH_GOOGLE_CLIENT_ID`, `OAUTH_GOOGLE_CLIENT_SECRET`,
  `OAUTH_FACEBOOK_CLIENT_ID`, `OAUTH_FACEBOOK_CLIENT_SECRET`, `OAUTH_CALLBACK_BASE_URL`
  (the API origin, e.g. `https://api.bigbike.vn`) and `OAUTH_WEB_SUCCESS_URL` (the storefront
  origin). Blank client id/secret keeps a provider disabled — the buttons still render and the
  flow lands on the login page with an error. The exact callback URL
  (`{OAUTH_CALLBACK_BASE_URL}/api/v1/customer/auth/oauth/{provider}/callback`) must also be
  registered provider-side, or Google answers `redirect_uri_mismatch`. See
  `INTEGRATION_GUIDE.md` for the provider setup. `CONFIRMED_FROM_CONFIG`
- All service ports (Postgres, MinIO, Backend, Web, Admin) are bound to `127.0.0.1` — public traffic must arrive via the nginx reverse proxy, never directly. `CONFIRMED_FROM_CONFIG`
- `SPRING_PROFILES_ACTIVE` for staging/production must not include `mock`; placeholder auth is explicitly limited to dev/mock behavior in `AuthController` and `DevAdminAuthService`. `CONFIRMED_FROM_CODE`
- `bigbike-web` must call the real backend public APIs (`/api/v1/products`, `/api/v1/menus/**`, `/api/v1/settings/public`, etc.). The legacy `scripts/mock-api-server.mjs` storefront shim is not part of the deployment contract and must not be restored in runtime/dev/prod paths. `CONFIRMED_FROM_CODE`
- `bigbike-admin` must call the real backend admin APIs at runtime. The former admin mock build flag and runtime mock fallback layer have been removed; admin production builds must not include mock data fallbacks. `CONFIRMED_FROM_CODE`
- Admin access synchronization uses the backend's in-process STOMP simple broker. The current
  Compose topology runs one backend instance, so an access change reaches every connected session
  on that node. Do not scale backend replicas for this feature without adding a shared broker/event
  bus for the access-change event and WebSocket routing. `OWNER_CONFIRMED_2026-07-31`

### Admin static delivery: cache and gzip

The admin container (`bigbike-admin/Dockerfile` + `bigbike-admin/nginx.conf`) has two deliberately
different cache policies:

- `index.html`, including every SPA fallback route, is returned with `Cache-Control: no-cache`.
  A browser may keep a local copy, but must ask the server to validate it each time it opens the
  panel. This prevents an old HTML shell from referencing chunk hashes that a newer deployment has
  removed.
- Versioned static assets under `/assets/` keep `Cache-Control: public, immutable` for one year.
  Vite puts a content hash in every asset filename, so a new deployment safely receives a new URL
  while repeat visits reuse unchanged code, styles and fonts.

During the image build, gzip sidecars are generated for text delivery artifacts (`.js`, `.css`,
`.html`, `.json`, `.svg`). Nginx uses `gzip_static on` to send the prebuilt `.gz` file when the
request accepts gzip, avoiding per-request compression CPU. The original file remains in the image
and is returned unchanged to clients that do not advertise gzip. No Brotli module or serving stack
change is part of this contract. `CONFIRMED_FROM_CONFIG`

Verify a local or deployed admin container after a rebuild with all of the following:

1. `curl -I http://localhost:4000/` returns `Cache-Control: no-cache` for the HTML shell.
2. `curl -I http://localhost:4000/assets/<current-hash>.js` returns
   `Cache-Control: public, immutable`.
3. The same asset request with `Accept-Encoding: gzip` returns `Content-Encoding: gzip`; without
   that request header it still returns `200` without a gzip content encoding.

The host Nginx remains a pass-through proxy for the admin container. Before changing an actual VPS,
inspect the active configuration, run `nginx -t`, and reload only after it passes; see
“Deployment Caveats”.

## Security Hardening Config

### Storefront error reporting (Sentry)

`bigbike-web` has Sentry wired for browser, server, edge, and Next request errors. It is disabled
when the browser DSN is blank; server and edge reporting are also disabled when both DSNs are
blank, so local development does not send events. To enable a deployment, set
the same project DSN in `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` in that deployment's env file,
then rebuild the web image because the public value is baked into the browser bundle. The root
`.env.example` carries the blank placeholders; never commit the populated env file.

Storefront events carry only the operation name, HTTP failure class, and page pathname. The client
must not send customer identity, passwords, email, phone, order keys, payment data, chat text,
request bodies, query strings, cookies, or authorization headers. Expected customer outcomes
(`4xx`, including invalid credentials, validation, unavailable stock, duplicate review, rate
limit, and no-result states) are not reported; network failures and `5xx` failures are. The Sentry
build upload values (`SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`) are optional deployment
credentials for the build operator only, never browser configuration. `CONFIRMED_FROM_CODE` —
`sentry.*.config.ts`, `instrumentation.ts`, storefront reporting helper.

### Storefront analytics (GA4, Meta Pixel and Microsoft Clarity)

`bigbike-web` reports to GA4 property `G-REZM4NT0CS` through `gtag.js`, loaded once from
`app/[locale]/layout.tsx`. Google Tag Manager was removed on 2026-09-06. To enable a deployment,
set `NEXT_PUBLIC_GA4_MEASUREMENT_ID` in that deployment's env file **and rebuild the web image**,
because the value is compiled into the browser bundle by `next build`. A blank value renders no
script at all, which is the intended state for local and staging so test traffic never reaches the
live property. The root `.env.example`, `.env.vps.example` and `bigbike-web/.env.example` carry the
blank placeholder; never commit the populated env file.

Set `NEXT_PUBLIC_CLARITY_PROJECT_ID` the same way only for deployments that should record Clarity.
A blank value renders no Clarity script. Its CSP allowance is restricted to `www.clarity.ms`,
`*.clarity.ms` and `c.bing.com`; private assistant/auth/account/checkout/order/review regions must
remain masked. Changing any public measurement id requires rebuilding the web image.

Set `NEXT_PUBLIC_META_PIXEL_ID=460465848002810` only in the production deployment that is approved
to collect Meta measurement; leave it blank elsewhere. This is BigBike's existing Pixel and must
never be replaced with a newly created Pixel because its historical audiences belong to this id. A
blank value renders no Meta loader, image fallback or browser event. It is a direct installation,
not a Google Tag Manager, Cloudflare/Zaraz or Conversions API integration. The only Meta CSP change
is `https://connect.facebook.net` in `script-src`; do not widen another source list.

Cancellation revenue correction runs from the backend. Set the same
`NEXT_PUBLIC_GA4_MEASUREMENT_ID` on the backend service and set the server-only
`BIGBIKE_GA4_API_SECRET`; leave the secret blank locally/staging unless that environment owns an
isolated GA4 property. Blank configuration keeps queued rows pending and makes no outbound call.
Never expose the secret through a `NEXT_PUBLIC_*` variable.

Unlike a backend variable, each public id must be declared in **three** places to reach the browser:
`build.args:` and `environment:` on the `bigbike-web` service in `docker-compose.yaml`, plus a
matching `ARG` + `ENV` pair before `RUN npm run build` in `bigbike-web/Dockerfile`. The previous
Google Tag Manager install failed on both counts, verified in the running container on 2026-09-06:
`NEXT_PUBLIC_GTM_ID` was blank in every env file, and it was declared only under `environment:`,
so even a populated value would have stayed `undefined` in the browser bundle — the compiled
client chunk still read it at runtime instead of carrying a literal, unlike `NEXT_PUBLIC_SITE_URL`
and `NEXT_PUBLIC_API_BASE_URL` beside it. **A restart does not pick up a changed measurement id;
a rebuild does.**

Exactly one GA4 browser install and exactly one Meta Pixel base install may exist in the repo. The
backend Measurement Protocol sender is restricted to cancellation `refund` events and is not a
second page/browser install. Another browser install double-counts every metric the property
reports, revenue included. Analytics events may also carry internal customer id and documented
non-PII action/product context. They must not carry customer name, email, phone, address,
chat/review text, head measurement, or the order lookup `orderKey`. GA4 needs no CSP change:
`next.config.ts` already allows `https://www.googletagmanager.com` in `script-src` (the host that
serves `gtag.js`) and `https://www.google-analytics.com` in `connect-src`. Meta uses only
`https://connect.facebook.net` for its script loader; Clarity uses only the exact hosts above.

Meta page views are owned by Meta's own library: do not add a manual `PageView` when the customer
navigates client-side. The shared helper emits only `ViewContent`, `AddToCart` after a successful
cart mutation, `InitiateCheckout`, `AddPaymentInfo` after COD confirmation, `Purchase`, `Search`
and `Contact`. Commerce content ids are the exact variant SKU already used by GA4 and the product
feed; monetary values are integer VND. `Purchase` carries `eventID` `purchase_<orderNumber>` and
the existing thank-you-page order guard, so the later Conversions API work can de-duplicate without
double-counting. It must not emit list-view, remove-from-cart, cart-view or shipping-address events.

After deployment, verify one non-production-marked browser session in GA4 DebugView/Realtime:
assistant open/contact, product-section reach, COD confirmation and purchase. Cancel only that
same marked test order through the normal workflow, then verify one `refund` with the identical
transaction id and inspect the outbox status without editing it. HTTP 2xx alone is not proof that
GA4 has processed the event. In Meta Events Manager/Test Events, confirm exactly one Pixel
`460465848002810`, one PageView for each navigation, and the sequence PageView → ViewContent →
AddToCart → InitiateCheckout → AddPaymentInfo → Purchase. Refreshing the thank-you page must not
create a second Purchase. Check Vietnamese/English and desktop/mobile; verify SKU parity with GA4.
`OWNER_CONFIRMED_2026-09-12` —
`bigbike-web/app/[locale]/layout.tsx`, `bigbike-web/lib/analytics.ts`, `INTEGRATION_GUIDE.md`
§§"Google Analytics 4 (storefront)" / "Meta Pixel (storefront)" / "Microsoft Clarity (storefront)".

Before the first production deploy, register the event-scoped dimensions and integer metrics in
`INTEGRATION_GUIDE.md` §"Google Analytics 4 (storefront)" in the **existing** GA4 property. Do
not create a new property, stream, tag or Google Tag Manager container. These definitions expose
contact channel/placement, product context, content-section reach, selected filters, size results,
video identity, scroll percent and result counts in Explorations; GA4 does not backfill custom
definitions for events collected before registration.

In that same existing property, set Reporting identity to `Blended` or `Observed` so the built-in
User-ID feature can connect authenticated activity across devices. Do not register `user_id` as a
custom dimension: it is a reserved, high-cardinality system identifier and the raw value is not a
business reporting dimension.

In the GA4 web stream's **Redact data** setting, enable email redaction and add the exact URL query
parameters `key`, `token` and `tiep`; prove each one with the built-in preview and DebugView. Before
setting `NEXT_PUBLIC_CLARITY_PROJECT_ID`, ask Clarity support to mask those same case-sensitive URL
parameters and confirm them in a recording. Element masks do not cover page URLs, so Clarity must
remain disabled until URL masking is confirmed.

- **Public Review CSRF boundary** — `CustomerCsrfFilter` exempts CSRF validation only for `POST /api/v1/products/{productId}/reviews` and `POST /api/v1/products/{productId}/reviews/photos`. These two endpoints intentionally support guests, and the storefront calls them directly on the API host with credentials so an existing customer session can supply authoritative identity. The exemption must match the HTTP method and complete path shape; it must never use the broad `/api/v1/products/` prefix or exempt neighboring/future product mutations. Exact-origin credentialed CORS and the dedicated per-IP `REVIEW` / `REVIEW_PHOTO` limits remain mandatory. `CONFIRMED_FROM_CODE_AND_SECURITY_REVIEW_2026-07-28`
- **`BIGBIKE_TRUSTED_PROXIES`** — comma-separated exact proxy addresses or narrow, private CIDRs (minimum IPv4 `/24`, IPv6 `/64`) trusted to set `X-Forwarded-For`. Per-IP rate limiting consumes forwarding data only when the direct peer matches this list and the header contains exactly one IP. The minimum prefix is enforced at startup, so a `/16` or `/12` bridge range fails the boot — the checked-in Compose default `172.20.0.0/16` is therefore **not** bootable as-is and every environment must set an explicit narrow value. The `bigbike-dev` bridge allocates `172.20.0.x`, so `172.20.0.0/24` is the correct entry for the single-VPS Compose deployment. Do not use broad Docker ranges such as `172.16.0.0/12`; first verify the real ingress/container hop with `docker inspect` and `nginx -T`. Every public nginx proxy location must remove client-provided forwarding data and emit one canonical client address; BFF/admin internal proxies may forward only that single canonical value. `CONFIRMED_FROM_CODE_AND_CONFIG_2026-08-12`
- **Rate limiting and Redis** — production uses `BIGBIKE_RATE_LIMIT_STORE=redis` and a separate `BIGBIKE_RATE_LIMIT_HMAC_SECRET` (32+ chars); do not reuse JWT, internal API, mail or provider secrets. `BIGBIKE_RATE_LIMIT_REDIS_URL` accepts `rediss://` for a managed HA Redis-compatible service, or plaintext `redis://` **only** when the host stays inside the deployment network — a single-label service name (`redis`) or a loopback/private address. A publicly routable host over plaintext `redis://` is rejected at startup, because counters and HMAC-keyed bucket ids would cross the public internet in the clear. The single-VPS Compose deployment runs the in-network `redis` service, which exposes no host port (`OWNER_CONFIRMED_2026-08-12`: managed TLS Redis deferred; revisit before horizontal scaling). Backend production startup still rejects a missing Redis/HMAC configuration, unsafe proxy CIDR, or an accidental local-only limiter. Compose explicitly passes the documented per-tier `BIGBIKE_RATE_LIMIT_TIERS_<TIER>_{LIMIT,WINDOW}` overrides; leave them empty unless an owner-approved, expiry-bound change has staging evidence. Configure Redis memory quota/`noeviction`, alert at capacity pressure, and verify failover on staging before horizontal scaling. `RATE_LIMITING.md` is the canonical tier/failure policy. `OWNER_CONFIRMED_2026-08-12`
- **Nginx rate response** — every deployed limiter must return `429`, not an outage `503`, with `Retry-After` and `Cache-Control: no-store`. The 2026-09-12 admin boundary declares this status and its JSON handler in the admin vhost itself, applies only the request-rate limit selected above, and leaves `/ws` exempt. Keep proxy interception off on paths that can receive backend `429`, so the backend envelope and computed `Retry-After` pass through unchanged. Other host-rate changes remain separate deployments and must be verified from the active config, not inferred from repository files. `OWNER_CONFIRMED_2026-09-12`
- **Actuator** — only `GET /actuator/health` is public. The nginx API config (`deploy/nginx/api.bigbike.vn.conf`) returns `403` for every other `/actuator/` path; Prometheus must scrape the backend over the private network, not the public host. `CONFIRMED_FROM_CONFIG`
- **Media upload body size** — backend and the inner admin container accept media uploads up to 200 MB/210 MiB, but the production host-level admin vhost currently keeps its existing `client_max_body_size 20m`. The public API hostname returns `404` for `/api/v1/admin/media` after the hostname-boundary rollout; it is no longer an alternate upload door. This rollout does not change the effective host upload cap. `CONFIRMED_FROM_LIVE_CONFIG_2026-09-12`
- **Legacy video CSP compatibility** — storefront `frame-src` and admin preview CSP include exactly `https://www.tiktok.com` and `https://www.facebook.com` in addition to YouTube so previously stored video records can still render. These origins are read-only compatibility allowances; every write contract accepts only YouTube or internal Media Library video (`MEDIA_RULE_004`). Do not add shortened-link or wildcard social domains. `CONFIRMED_FROM_OWNER_DECISION`
- **Internal endpoints** — `/api/internal/**` require the `X-Internal-Token` header (matched in constant time) when `BIGBIKE_INTERNAL_TOKEN` is set; deny-by-default when unset. `CONFIRMED_FROM_CONFIG`
- **`BIGBIKE_INTERNAL_TOKEN` / `INTERNAL_API_TOKEN` must both be set** to the same secret value in the environment used by `docker-compose.yaml` (`.env`/`.env.vps`) — generate with `openssl rand -base64 32`. If either is missing or mismatched, the redirect feature fails safe (every lookup gets `401` and falls through to normal routing) but silently does nothing end-to-end; `bigbike-web/proxy.ts` logs the failure on every request. `CONFIRMED_FROM_CONFIG`

## Schema And Migration Notes

- Flyway runs every versioned migration under `bigbike-backend/src/main/resources/db/migration`. Existing migrations are never edited. Production history reserves immutable `V1075`–`V1077` for the media-folder rollout; the policy freeze and review-invitation setting cleanup therefore follow as `V1078` and `V1079`. `V1070__remove_staff_chat_and_retired_assistant_settings.sql` is the additive cleanup for the owner decision 2026-08-30: it removes retired assistant settings, handoff tables/columns/data and `chat.reply`, while retaining core transcript/image/quota structures. `V1079__remove_review_invitation_settings.sql` is the additive cleanup for the owner decision 2026-09-01: it removes only the three retired review-invitation rows from `site_settings`; campaign/delivery/item/opt-out/quota data remains intact. `V1083__cod_only_payment_cutover.sql` is the guarded 2026-09-09 cutover: it verifies and changes only the two named unconfirmed orders, removes the four public bank settings, removes retired payment-notification data and its chat reference column, and aborts on any baseline mismatch. Verify directory sequence and `flyway_schema_history` before rollout. `OWNER_CONFIRMED_2026-09-09`
- Notification retention uses `V1067__admin_notification_retention_and_remove_legacy_read_state.sql` to remove the obsolete shared `admin_notifications.is_read` column/index while retaining `admin_notification_reads`; the backend scheduler removes rows older than six calendar months daily at 03:50 Vietnam time in batches. After rollout, verify the Flyway history, absence of the old column/index, and a successful cleanup log. `OWNER_CONFIRMED_2026-08-28`
- The one-time WordPress live migration must follow [LIVE_MIGRATION_RUNBOOK.md](LIVE_MIGRATION_RUNBOOK.md). The normal Spring `mode=import` runner is legacy rehearsal tooling and is not an authorized production write path. `CONFIRMED_FROM_CODE_2026-08-03`
- Receipt tables (`V52/V53/V55`) were dropped in `V120`; the serial movement table (`V57`) and all other serial tables were dropped in `V259` (serial tracking removed 2026-06-23). POS order snapshot columns were added in `V71` and still exist, but the POS feature itself was removed 2026-06-23 (online-only) — the columns are now only written with online values. `CONFIRMED_FROM_CONFIG`

### Historical order classification / Đánh dấu đơn lịch sử một lần

This owner-operated step runs only after the deployment containing the historical-order tables is healthy. It classifies orders whose existing `legacy_id` is present into the auditable batch `LEGACY_WEB_IMPORT_2026_06_11`; it never updates an order status, amount, customer field, or order content. The safety gate requires the production measurements reconfirmed by the owner on 2026-09-02 to remain exactly `1,660 total / 388 PENDING / 508 PROCESSING`; this replaces the stale `1,661` total recorded on 2026-08-31. Any mismatch rolls the transaction back automatically. Running `--execute` again is intentionally idempotent.

Bước này chỉ do owner chạy sau khi bản triển khai có kho đánh dấu đơn lịch sử đã hoạt động ổn định. Bước chạy dùng dấu `legacy_id` sẵn có để đưa đơn vào lô có thể kiểm tra `LEGACY_WEB_IMPORT_2026_06_11`; tuyệt đối không đổi trạng thái, số tiền, khách hàng hay nội dung đơn. Chốt an toàn được owner xác nhận lại ngày 02/09/2026 là `1.660 tổng / 388 PENDING / 508 PROCESSING`, thay thế số tổng 1.661 ghi ngày 31/08; lệch bất kỳ số nào thì toàn bộ lần chạy tự hoàn tác. Chạy `--execute` lần thứ hai cho cùng kết quả và không tạo bản ghi trùng.

From the repository root / Từ thư mục gốc dự án:

```bash
# Read-only preflight / Chỉ kiểm tra, không ghi dữ liệu
bash scripts/ops/classify-legacy-orders.sh --dry-run

# Owner-authorized one-time classification / Owner chạy đánh dấu một lần
bash scripts/ops/classify-legacy-orders.sh --execute

# Read-only verification / Kiểm tra lại, không ghi dữ liệu
bash scripts/ops/classify-legacy-orders.sh --dry-run
```

The script prints its measured duration; with only 1,660 memberships this should normally finish in under one minute, but the production host determines the actual duration. To undo a mistaken classification without changing any order, run `bash scripts/ops/classify-legacy-orders.sh --rollback`. This deactivates the batch and immediately restores all orders to the operational scope while retaining the classification list and audit evidence. After checking the exact `1,660/1,660/0` candidate/membership/mismatch gate, restore it with `bash scripts/ops/classify-legacy-orders.sh --reactivate`.

Script tự in thời gian thực tế; với 1.660 dấu thành viên, bình thường hoàn tất dưới một phút nhưng máy chủ thật quyết định thời gian cuối cùng. Nếu đánh dấu sai, chạy `bash scripts/ops/classify-legacy-orders.sh --rollback`; lệnh này chỉ tắt lô, đưa toàn bộ đơn trở lại phạm vi vận hành ngay, đồng thời giữ danh sách đánh dấu và dấu vết kiểm tra. Sau khi xác nhận chốt `1.660/1.660/0` cho số ứng viên/số đã đánh dấu/số lệch, bật lại bằng `bash scripts/ops/classify-legacy-orders.sh --reactivate`.

## Backup and restore

Full procedure, including the owner-facing Vietnamese page, lives in
[BACKUP_RESTORE_RUNBOOK.md](BACKUP_RESTORE_RUNBOOK.md). Summary of the deployed setup:

- **Target.** A Synology NAS at the owner's home, reached over the existing Tailscale tailnet at
  `100.116.56.123:/volume1/Bigbike`, mounted at `/mnt/bigbike-nas`. Everything the backup writes stays
  inside the single subdirectory `vps-backups/`; the owner's unrelated business files at the share root
  are never read, moved or deleted. No new port is exposed to the Internet.
- **Schedule and retention live in exactly one file**, `/etc/cron.d/bigbike-backup`: sales data hourly at
  `:10`, operational config daily at `00:40`, media daily at `01:00`, a staleness watchdog hourly at `:40`,
  and a daily digest at `06:00`. Retention is `BB_KEEP_HOURLY=48`, `BB_KEEP_DAILY=30`, `BB_KEEP_MONTHLY=12`.
  The 00:40–01:00 window is deliberate: even the monthly media re-base (~50 min: ~12 min to write, ~37 min to read back) finishes before the backend's own 02:30–04:30 scheduled-job block.
- **Sales data** uses `pg_dump --format=custom` against the running `bigbike-postgres` while the shop keeps
  serving; the datadir is never copied. The dump is written to a small `/var/tmp` scratch file, shipped, then
  removed by an `EXIT` trap even on failure. Hourly→daily→monthly promotion uses hardlinks on the NAS, so no
  byte crosses the link twice.
- **Media** is **not** mirrored file-by-file. Measured on 2026-09-06, the NAS link costs ~280 ms per file
  operation; the 6,223-file MinIO tree would take ~9.6 h per run. Media is instead streamed as one
  `tar --listed-incremental` + `zstd` archive: a full base every `BB_MEDIA_REBASE_DAYS` (30) and a small
  delta archive daily. The stream goes straight to the NAS — no full copy ever lands on the server disk.
- **Integrity.** Every artifact carries a SHA-256 sidecar and is re-read from the NAS (`O_DIRECT`, falling
  back to `posix_fadvise(DONTNEED)`) before the `.part` file is renamed into place. A mismatch deletes the
  bad copy and raises an alert.
- **Alerting** reuses the existing Telegram bot and the internal mailbox `BIGBIKE_MAIL_ADMIN` — both channels,
  per owner decision 2026-09-06. No new channel and no new credential were introduced.
- **Guards.** Three independent layers stop a backup from silently filling the server disk when the NAS is
  unreachable: a `mountpoint` check, a `.nas-marker` sentinel that only exists on the NAS, and `chattr +i`
  on `/mnt/bigbike-nas` so the kernel itself refuses writes to the bare mountpoint. Mounting over the
  immutable directory still works — verified 2026-09-06.
- **Reboot.** `mnt-bigbike\x2dnas.automount` is enabled, so the mount is re-established on demand after a
  reboot without ever blocking boot. The mount is `soft,timeo=600,retrans=2`, so a dead NAS produces an I/O
  error in ~3 minutes instead of wedging processes in uninterruptible sleep.

### NAS link constraints — verified on the host, do not re-derive

The hosting provider blocks **all outbound UDP**. Consequences, all measured 2026-09-06:

- Tailscale cannot build a direct path and always relays via DERP Hong Kong (~105 ms).
- Measured throughput is asymmetric: **~2.0 MB/s writing to the NAS, ~0.5 MB/s reading back from it**.
  The NAS sits on a residential line at the owner's home, so a read is that line *uploading*. Raising
  `rsize`/`wsize` (the NAS caps both at 131072) and `nconnect=8` changed nothing — the bottleneck is the
  home link, not the mount. Budget restores accordingly: the 1.46 GB media archive takes ~50 minutes to
  pull back.
- `systemd-timesyncd` has never synced (`Packet count: 0`). The clock is held to ~1 s by `kvm-clock` from the
  hypervisor, which is why the age-based watchdog is still trustworthy. `/etc/systemd/timesyncd.conf` now
  points at IPv4 pool servers, but it cannot work until UDP egress is allowed.
- The NAS speaks **NFS v4.0 only** — `nfsvers=4.1` is rejected with `Protocol not supported` — and the export
  path is `/volume1/Bigbike`, not `/Bigbike`.
- `showmount`, a targeted `rpcinfo <prog> <ver>`, and any NFSv3 mount **hang unkillably** on this host because
  the NAS accepts TCP on mountd's port but never answers the RPC. Never put them in a health check.

## Deployment Caveats

- **Chat post-deploy check:** confirm the public chat header identifies `Trợ lý BigBike` in Vietnamese and `BigBike Assistant` in English, that the short AI label `TRỢ LÝ AI · HỖ TRỢ 24/7` / `AI ASSISTANT · 24/7 SUPPORT` is the only sub-line and the long “not a human staff member” sentence is gone (owner decision 2026-09-06, `CHAT_RULE_001`), that the header carries exactly three icon buttons — contact, delete conversation, close — with no separate strip for the delete button (`CHAT_RULE_049` still requires the delete control to exist), that opening the chat with no messages shows the greeting plus exactly four tappable suggestions (`CHAT_RULE_061`), that **no image-privacy line remains in the chat frame** (owner decision 2026-09-06, `CHAT_RULE_059` — the wording now lives only on the privacy-policy page), **no memory disclosure line and no memory on/off toggle remain** (owner decision 2026-09-05, `CHAT_RULE_049`), the input is immediately visible, the image button appears only when the AI service is configured, and the Hotline/Zalo/Messenger card opens without any request to `/chat/handoffs`, email or notification. Confirm admin can still view transcript/history and images with `chat.read`, while no queue, claim, staff reply or payment notification appears. Watch backend/nginx logs only for status/connection ids, never transcript/token/PII. **Also grep the backend log for `ck_chat_message_source` after deploy — any hit means the assistant composed a reply the database refused, and the customer saw an error screen.**

- Internal redirect endpoints (`/api/internal/**`) are protected by the `X-Internal-Token` application check. The active `api.bigbike.vn` vhost does not add a second Nginx block; the 2026-09-12 hostname boundary intentionally leaves non-admin/non-auth API behavior unchanged. The admin vhost returns `404` because this path is outside its five allowed API groups. See PERMISSION_MATRIX.md "Internal Redirect Caveat". `CONFIRMED_FROM_LIVE_CONFIG_AND_CODE_2026-09-12`
- The host's nginx `default_server` for both HTTP and HTTPS must return `404` for a direct server IP or an unrecognised `Host`; it must not proxy, redirect, or serve a shared site's virtual host. Before reload: inspect the exact active file, run `nginx -t`, reload nginx only after it passes, then test the raw IP and the named BigBike host separately. `OWNER_CONFIRMED_2026-08-15`
- No confirmed external payment webhook or shipping carrier deployment contract exists in repo. `NOT_FOUND_IN_REPO`

## Automatic outage fallback (manual maintenance removed 2026-08-30)

From 30/08/2026, BigBike has no manual maintenance switch, admin lock, maintenance state machine, technical role or emergency lock environment variable. Migration `V1071` moves `vominhduc760@gmail.com` to `ADMIN` before deleting the retired role and data. Fresh databases may legitimately have no such production account; when the account exists, migration must leave it as `ADMIN`. Existing migrations are never edited after they have run in an environment.

### Static outage pages (unrelated to the lock)

Nginx dùng `maintenance-web.html`, `maintenance-admin.html` và `maintenance-media.html` trong
`deploy/maintenance/templates/` khi upstream tương ứng thật sự không phản hồi. Các trang trả
`503` cùng `Retry-After: 60`, không trả `200` hoặc chuyển hướng; cửa API trả JSON `503` thay vì
HTML. Riêng cửa ảnh không thay phản hồi lỗi hợp lệ do MinIO trả về.

Sinh lại cả ba trang bằng `deploy/maintenance/render-fallback-pages.sh` trong mỗi lần triển khai và
khi thông tin liên hệ thay đổi. Script đọc `contact_address`, `hotline`, `facebook_url`, `zalo_url`
và `opening_hours_*` từ cài đặt công khai rồi nhúng vào file tĩnh. Nếu dữ liệu bắt buộc trống, script
dừng thay vì phát hành trang thiếu thông tin; nó không đụng Docker hoặc nạp lại Nginx. Cấu hình bằng
`BIGBIKE_MAINTENANCE_STATIC_ROOT` và `BIGBIKE_MAINTENANCE_API_URL`.

**Logo.** The page inlines `deploy/maintenance/templates/logo-outage.png` (320px, ~70 KB), **not** `bigbike-web/public/brand/logo-primary.png`. The brand original is 2000×2000 / 6.5 MB, and base64-inlining it produced an **8.6 MB** outage page — served exactly when the system is already struggling and the customer is most likely on mobile data. The derivative keeps the page under 100 KB while still covering 2x retina (CSS caps display width at 160px).

`logo-outage.source.sha256` records which brand logo the derivative was made from, and the render script prints a non-fatal warning when the brand logo has changed since. To regenerate after a rebrand, run this from the repo root (Pillow is needed only for this one-off, never at deploy time):

    python3 -c "
    from PIL import Image
    import hashlib, pathlib
    src = pathlib.Path('bigbike-web/public/brand/logo-primary.png')
    out = pathlib.Path('deploy/maintenance/templates/logo-outage.png')
    im = Image.open(src); W = 320
    r = im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)
    r.convert('RGB').quantize(colors=128).save(out, 'PNG', optimize=True)
    pathlib.Path('deploy/maintenance/templates/logo-outage.source.sha256').write_text(
        hashlib.sha256(src.read_bytes()).hexdigest() + '  logo-primary.png\n')
    "
### Nginx notes

Do not change the outage templates, `render-fallback-pages.sh`, or the Nginx `error_page 502 503 504` blocks as part of this removal. Always run `nginx -t` before any separately approved Nginx reload, and never reload on a failed test.

### Verification after deploy

- **Rate-limit preflight (read-only):** run `docker ps`, then inspect `nginx -T` and the active host files—not only repository copies. For `admin.bigbike.vn`, verify the local `429` handler, two `general_limit` request-limit placements, absence of a host connection cap, and the `/ws` exemption. The API and storefront retain their older request-limit behavior and require a separate approved rollout if their response contract changes. Run `bash deploy/nginx/tests/rate-limit-config-test.sh` in the checkout before copying any Nginx file. Do not add client-IP trust/allow rules or reload Nginx from this verification step.
- **Rate-limit behavior (staging/approved preview only):** on the admin hostname, make one normal request and inspect `status`, `Retry-After`, `Cache-Control`, `error.code`, `meta.requestId` and `meta.timestamp` after a controlled threshold test. It must be `429 RATE_LIMIT_EXCEEDED`, never `503` or the outage body. Do not run a burst/load test against production without an approved window.
- **Redis behavior (staging):** run two backend replicas against the managed endpoint, consume one test bucket through replica A and confirm replica B sees the same remaining state. Test a rolling restart and provider failover; sensitive routes must remain fail-closed, while cart/checkout fallback is bounded and alerts fire. These tests are a release gate for horizontal scaling.

- Confirm `V1071` is recorded in `flyway_schema_history`, the database is still reachable, `maintenance_state` is absent, all five obsolete setting keys are absent, and no `DEVELOPER` role/user/permission references remain.
- Confirm `vominhduc760@gmail.com` has role `ADMIN`; use a fresh login, save one admin record, save one ordinary role, and upload one non-PII image.
- Place a controlled test order or run the approved checkout smoke test to prove the customer flow is unchanged.
- If a controlled outage test is approved, verify `Retry-After: 60` and the static HTML/JSON pages. This tests only the preserved fallback, never a removed lock.

### Rollout gate

Run the migration and the code removal in the same controlled deployment window so an old backend is never expected to use the dropped table. The agent must not start, restart or stop Docker; live checks remain owner-operated when the stack is available.

## Gỡ trợ lý — triển khai 2026-10-02

`CHAT_RULE_070`: triển khai web/admin/backend cùng thay đổi, áp dụng V1093 để bỏ cài đặt trợ lý và quyền chat. Bỏ BIGBIKE_CHAT_MODEL, BIGBIKE_CHAT_TIMEOUT_SECONDS, override rate-limit CHAT và cấu hình dựng chỉ mục BIGBIKE_IMAGE_INDEX_*. GEMINI_API_KEY và cấu hình kiểm duyệt đánh giá vẫn dùng như trước. MINIO_CHAT_PRIVATE_BUCKET còn dùng bảo vệ/dọn tệp lịch sử đến hạn; không đổi policy của kho cũ thành public. Backend không cần ffmpeg/ffprobe để tư vấn video nữa. Không rebuild/restart container đang chạy trong phiên sửa mã nếu chưa có chỉ thị vận hành của owner.

Bổ sung chỉ thị vận hành của chủ shop ngày 2026-10-02: “làm xong rồi thì build docker file .env.vps lại thành bản mới luôn nha”. Build cả `bigbike-backend`, `bigbike-admin`, `bigbike-web` bằng `docker compose --env-file .env.vps build`; giữ image đang chạy trước khi nạp bản mới. Nạp backend trước với `up -d --no-deps --no-build`, xác nhận healthy và V1093 thành công, rồi nạp admin/web với cùng các cờ. Xác minh website công khai có Hotline/Zalo/Messenger, không còn trợ lý hoặc hội thoại/cài đặt trợ lý trong quản trị; giữ nguyên các dịch vụ dữ liệu và file `.env.vps`. URL công khai của bản web phải lấy từ `.env.vps` để không đóng gói nhầm địa chỉ của môi trường local.

Sau khi nạp bản gỡ trợ lý, chủ shop xác nhận phần chức năng đã ổn nhưng giao diện FloatingChat chưa giống hoàn toàn bản đầu, và yêu cầu kiểm tra lịch sử Git. Khôi phục hình thức widget theo `d7b8a1ec`/`CHAT_RULE_070`, rồi build và nạp lại riêng `bigbike-web` bằng `.env.vps`; backend/admin đã gỡ trợ lý và V1093 tiếp tục dùng bản đã kiểm tra. Kiểm VI/EN ở 375/768/1440px, hình/nhãn/kích thước cũ và FAB không đổi vị trí khi mở/đóng. Lượt kiểm qua HTTPS trực tiếp tới Nginx dùng nhịp yêu cầu 120ms như đợt chính sách để không vượt giới hạn tốc độ đang có; không sửa Nginx hoặc giả dữ liệu. Lượt công khai qua Cloudflare vẫn ghi nhận riêng cảnh báo CSP của beacon thống kê có sẵn; không coi đó là lỗi từ widget mới.

Kết quả triển khai và xác minh ngày 2026-10-02:

- Đã build ba app bằng `.env.vps`, nạp backend trước rồi admin/web; V1093 áp dụng thành công. Nhóm cài đặt trợ lý và quyền chat đều còn 0 bản ghi. Số dữ liệu lịch sử trước/sau vẫn là 273 hội thoại, 23 ảnh, 0 video và 160 định danh khách; không xóa hàng loạt dữ liệu cũ.
- Đã build lại riêng web sau khi khôi phục giao diện Git, rồi nạp bằng `docker compose --env-file .env.vps up -d --no-deps --no-build bigbike-web`. Image cuối: web `sha256:f12fcbb050e8ed64995db9973bd74c6a8da178f4cd45f4ac7f1a03a83f148f7c`, admin `sha256:145eae9297b426e54b929992dd722b6ff2a42422a8090ffb0db41f65a6d1818c`, backend `sha256:8e3ffe620cde1d420235e91dbd901ba5abb30ef03eb19c592af7cc19f61cb531`. `docker inspect bigbike-web bigbike-admin bigbike-backend` xác nhận cả ba running/healthy. Các dịch vụ dữ liệu và hai file env thật không bị sửa.
- Bản giao diện cuối đạt 5/5 kiểm thử widget và 6/6 lượt Playwright với dữ liệu thật, HTTPS tới máy chủ đang chạy, VI/EN tại 375/768/1440px. Kiểm nút 48/66px, vị trí mở/đóng, nền xám, ảnh đã tải thành công, liên kết ba kênh, Escape/trả focus, không tràn ngang và không phát request chat. Đã xem ảnh thực tế mobile/desktop; ba asset trên web trả HTTP 200 và khớp byte với source. ESLint, kiểm định dạng và guard dữ liệu web đạt.
- Kiểm thử backend dành cho phần gỡ trợ lý và OpenAPI đều đạt. Bộ backend đầy đủ vẫn có một lỗi sẵn có ở `ArticleExcerptAuthorRemovalMigrationPostgresTest`, liên quan V1091 dọn trường bài viết; migration/test đó không được sửa trong task này. Cảnh báo CSP của beacon thống kê Cloudflare được ghi riêng như trên.
- Giữ image trước đợt gỡ trợ lý với tag `before-assistant-removal-20261002`; riêng bản web liên hệ trước đợt chỉnh giao diện còn ở `bigbike-web:before-contact-appearance-20261002`. Không prune image hoặc đụng volume dữ liệu.

## Trợ lý BigBike giai đoạn 4 — cấu hình và runbook

**Quyết định chủ shop 2026-10-02 — `CHAT_RULE_070`: đã gỡ toàn bộ Trợ lý BigBike.** Các mô tả trợ lý bên dưới chỉ là lịch sử, không còn là yêu cầu đang áp dụng. Web chỉ có nút liên hệ trực tiếp Hotline/Zalo/Messenger, không gọi API chat hoặc Gemini; quản trị không có hội thoại/cài đặt/quyền chat. Dữ liệu cũ không bị xóa hàng loạt; chỉ tiếp tục dọn dữ liệu đã hết hạn theo thời hạn có sẵn. Xem `BUSINESS_RULES.md` § Gỡ Trợ lý BigBike và khôi phục liên hệ trực tiếp.


- Local dùng `.env`; VPS hiện tại bắt buộc dùng `.env.vps` qua `docker compose --env-file .env.vps ...`. Hai file thật không commit và không được copy đè qua nhau; mọi biến mới chỉ commit trong `.env.example` và `.env.vps.example`.
- Trợ lý chỉ chạy `gemini-3.7-flash`; cấu hình triển khai vẫn khai `BIGBIKE_CHAT_MODEL=gemini-3.7-flash` để nhận diện rõ dịch vụ, nhưng backend khóa cứng ID này và bỏ qua mọi giá trị khác. Không có fallback model, catalog cache hoặc evaluation/cost environment. `BIGBIKE_CHAT_TIMEOUT_SECONDS=65` và `MINIO_CHAT_PRIVATE_BUCKET` vẫn áp dụng. Review moderation giữ các biến riêng, không đổi. Không có biến `GEMINI_MODEL` — backend không đọc tên đó ở bất kỳ đâu; nếu file triển khai còn dòng này thì phải xoá, vì nó khiến người đọc tưởng trợ lý chạy model khác.
- Bucket ảnh chat phải tồn tại nhưng tuyệt đối không có anonymous policy. Startup backend kiểm bucket riêng khác bucket media công khai; nếu trùng hoặc không thể xác minh private, tính năng ảnh fail-closed trong khi chat chữ vẫn hoạt động.
- Deploy không cần bật ảnh bằng setting. Sau deploy kiểm hạn mức chữ hiện có (mốc owner cung cấp ngày 08/09/2026 là 120, không thay bằng default code), ảnh 3/lượt–9/hội thoại–8 MB và setting ảnh khởi điểm 60/ngày, chỉnh được trong quản trị. Không còn image disclosure trong khung chat từ 2026-09-06; không còn handoff email/lịch trực. Không có model list, bộ đề, chọn model hoặc theo dõi chi phí/fallback theo model. Backend cập nhật dấu vân tay catalog cục bộ khi cần; thao tác này không gọi Gemini ngoài lượt phân loại ảnh của khách.
- Xoá thử có kiểm soát: upload một fixture không có PII vào hội thoại test, xoá lịch sử, xác minh cả DB metadata và object private biến mất; dùng clock/test fixture cho mốc 90 ngày. Không dùng ảnh hoặc hội thoại khách thật.

Các bước live có chi phí hoặc cần account thật phải do owner chạy sau triển khai; mã nguồn/CI chỉ dùng fake provider. Không gọi hàng loạt Gemini để “test nhanh”.


## Triển khai video ngắn của trợ lý (2026-09-08)

**Quyết định chủ shop 2026-10-02 — `CHAT_RULE_070`: đã gỡ toàn bộ Trợ lý BigBike.** Các mô tả trợ lý bên dưới chỉ là lịch sử, không còn là yêu cầu đang áp dụng. Web chỉ có nút liên hệ trực tiếp Hotline/Zalo/Messenger, không gọi API chat hoặc Gemini; quản trị không có hội thoại/cài đặt/quyền chat. Dữ liệu cũ không bị xóa hàng loạt; chỉ tiếp tục dọn dữ liệu đã hết hạn theo thời hạn có sẵn. Xem `BUSINESS_RULES.md` § Gỡ Trợ lý BigBike và khôi phục liên hệ trực tiếp.


Bổ sung `ffmpeg` vào image backend mới (giữ user không đặc quyền), migration video và các bản web/admin có cùng contract. Chỉ chuẩn bị/build bản riêng; dịch vụ dùng chung chỉ được nạp sau khi owner duyệt gói thay đổi và kết quả thử thật. Không tự sửa file `.env` đang chạy.

Nginx/API gateway cần cho riêng đường `/api/v1/chat/videos` nhận request 45 MiB để chứa tệp tối đa 40 MiB cùng multipart overhead, timeout upstream ít nhất 75 giây; không tăng vô điều kiện giới hạn mọi endpoint. Thời gian mạng upload không tính vào 60 giây xử lý server. Giữ private bucket không anonymous, media source cho web/admin gồm `blob:` như ảnh.

Trước triển khai: kiểm công cụ xử lý video, model khóa cố định, migration chưa trùng số, quota đã tiêu ở preview. Mang số video đã gọi thật vào `chat_video_daily_usage` ở đúng ngày đã dùng theo `Asia/Ho_Chi_Minh`, kể cả khi triển khai vào ngày sau; đối chiếu lượt production độc lập trước khi upsert chỉ tăng để không bỏ sót hoặc đếm trùng. Đợt 2026-09-08 đã dùng tám lượt preview, phải giữ tám lượt ở ngày 2026-09-08. Không reset hoặc hoàn quota. Bản bàn giao phải nêu con số cụ thể để owner duyệt cùng thao tác ghi này.

Với database chưa có video, chạy Flyway V1081 và chuyển quota trước khi nạp backend mới, trong khi backend cũ còn phục vụ. Chỉ mở giao diện nhận video sau khi backend mới khỏe và quota đã đối chiếu. Location video mới phải ghi đè `X-Forwarded-For` bằng `$remote_addr` theo quy định trusted proxy ở trên; giữ nguyên các location khác của cấu hình đang chạy.

Sau triển khai có kiểm soát: một video thật ≤15 giây có tiếng, một video không lời nhắn, quyền đọc của chủ/khách khác/admin; lỗi thời lượng/dung lượng, retry không tính lại, timeout xin ảnh. Kiểm xóa trên đúng fixture của đợt, không chạy cleanup tổng thể lên dữ liệu khách để thử. Video hết hạn bị chặn đọc ngay; job mỗi phút xóa các object quá bảy ngày và thử lại lỗi xóa, giữ placeholder lịch sử.

Hoàn tác: có thể đưa web/admin về bản trước để ngừng nhận video mới, nhưng phải giữ backend hiểu video cùng tác vụ xóa bảy ngày cho các tệp đã nhận. Không đưa backend về bản chỉ có ảnh hoặc xóa migration V1081 trong khi còn dữ liệu video: bản cũ không dọn video và khóa ngoại bảo vệ tệp có thể chặn thao tác xóa lịch sử. Chỉ hoàn tác backend sau khi xác minh mọi tệp đã được xử lý theo thời hạn và có kế hoạch dữ liệu được owner duyệt. Không giảm hoặc đặt lại các bộ đếm AI khi hoàn tác.

Rollback: the previous web/admin release may stop new video submissions, while the video-aware backend and seven-day deletion job must remain active for accepted files. Do not revert to an image-only backend or remove V1081 while video records remain; the older backend cannot clean these files and protective foreign keys may block history deletion. A backend rollback requires verified file disposal and an owner-approved data plan. Never reduce or reset AI usage counters during rollback.

### Bàn giao ảnh Trợ lý — 2026-09-08

**Quyết định chủ shop 2026-10-02 — `CHAT_RULE_070`: đã gỡ toàn bộ Trợ lý BigBike.** Các mô tả trợ lý bên dưới chỉ là lịch sử, không còn là yêu cầu đang áp dụng. Web chỉ có nút liên hệ trực tiếp Hotline/Zalo/Messenger, không gọi API chat hoặc Gemini; quản trị không có hội thoại/cài đặt/quyền chat. Dữ liệu cũ không bị xóa hàng loạt; chỉ tiếp tục dọn dữ liệu đã hết hạn theo thời hạn có sẵn. Xem `BUSINESS_RULES.md` § Gỡ Trợ lý BigBike và khôi phục liên hệ trực tiếp.


Triển khai backend có V1082 trước frontend; migration bổ sung cột nullable và setting ảnh 60/ngày, giữ bộ đếm và setting chữ. Bản COD-only tiếp theo áp dụng V1083 để gỡ dữ liệu cài đặt ngân hàng, luồng thông báo thanh toán và chuyển đúng hai đơn đang xử lý sang COD theo runbook. Chuyển ảnh catalog là thao tác riêng qua công cụ/hướng dẫn IMAGE_ASSISTANT_OPERATIONS.md; không tự chạy theo migration/startup. Sau 7 ngày đối chiếu quota ảnh, lượt bị bỏ vì hết hạn mức và hóa đơn Gemini trước khi chỉnh trần. Không coi 60 ảnh/ngày là dự toán tiền.

Đợt sửa ảnh này đã được owner yêu cầu triển khai trên VPS và đưa toàn bộ thay đổi lên GitHub bằng `docker compose --env-file .env.vps up -d --build` sau khi hoàn tất kiểm tra. Quyền này bao gồm việc áp dụng V1082 khi backend khởi động, không bao gồm chạy công cụ chuyển 91 sản phẩm hoặc sử dụng ảnh/hội thoại thật làm dữ liệu thử. Kiểm sau triển khai bằng health, contract công khai và số tổng hợp; không tiêu hạn mức AI để smoke test.

### Admin lựa chọn sản phẩm và khôi phục khối bài viết — 2026-09-19

Phạm vi release theo `PRODUCT_RULE_022` / `ARTICLE_RULE_008`: admin và backend; dùng `.env.vps` trên VPS, không thay đổi biến môi trường hoặc dựng lại web. Build bằng `docker compose --env-file .env.vps build bigbike-admin bigbike-backend`, sau đó nạp hai image đã kiểm tra theo quy tắc vận hành tại `AGENTS.md` §5.6.

Chủ shop đã xác nhận **đồng ý nạp hai dịch vụ đã kiểm thử** ngày 2026-09-19, sau khi xem kết quả build/kiểm tra và phạm vi khôi phục 104 bài. Nạp backend bằng `docker compose --env-file .env.vps up -d --no-deps --no-build bigbike-backend`; kiểm tra healthy và migration trước khi nạp `bigbike-admin` với cùng các cờ. Không dựng lại hoặc khởi động lại web, PostgreSQL, Redis hay MinIO trong đợt này.

- Backend mới phải hỗ trợ khối `table` trước khi ghi dữ liệu khối bảng. V1086 chạy trong giao dịch, chỉ điền `articles.body_blocks` còn thiếu; HTML VI/EN, thời gian, trạng thái và mọi trường khác giữ nguyên. Bài rỗng nhận `[]`. V1087 cài trigger xóa phần khối lỗi thời khi SQL/import chỉ sửa HTML; tác vụ nền mỗi 60 giây điền tối đa 25 bài bằng cập nhật có điều kiện để bảo vệ sửa đồng thời.
- Trước khi nạp: sao lưu riêng articles và bảng cỡ; đối chiếu dấu kiểm của toàn bộ trường bài viết ngoài `body_blocks` cùng sản phẩm/lựa chọn/thuộc tính/ảnh lựa chọn. Validate Flyway bằng đúng các cờ `SPRING_FLYWAY_IGNORE_MIGRATION_PATTERNS` và `SPRING_FLYWAY_OUT_OF_ORDER` hiện có của VPS, giữ nguyên ngoại lệ migration dev lịch sử. Pending của release này chỉ là V1086/V1087.
- Sau khi nạp: xác nhận hai dịch vụ healthy, hai migration thành công, không còn bài thiếu khối và dấu kiểm dữ liệu gốc khớp. Chạy thử bằng tài khoản kiểm thử; chỉ tạo/xóa đúng ID dữ liệu E2E của lần chạy, không quét xóa dữ liệu toàn hệ thống.
- Quay lại backend cũ cần xử lý phần `body_blocks` đã chuyển đổi trước, vì bản cũ chưa nhận subtype `table`. Giữ image trước release và bản sao lưu riêng; chỉ phục hồi phần khối của các ID đã chuyển đổi khi xác nhận không có lần sửa mới, tuyệt đối không chép đè HTML hay toàn bộ hàng articles. Không xóa lịch sử Flyway để ép chạy lại. Với backend mới, phần khối thiếu được phục hồi bằng đường đọc/tác vụ nền.

Bằng chứng kiểm tra và dữ liệu tổng hợp: `docs/audits/ADMIN_PRODUCT_CHOICES_2026-09-19.md`. Không ghi bí mật môi trường hoặc nội dung bài thật vào báo cáo/Git.

### Dynamic variant attributes and verified catalog cleanup — 2026-09-20

This release updates the product editor and applies the verified attribute cleanup. The editor reads all existing attribute types from `GET /admin/attributes`, orders colour and size first, and keeps the backend type-mutation endpoints only as an operations/development backdoor. Staff can still add, rename and delete attribute **values**, subject to the existing usage guard. The size-chart block and storefront product data are unchanged.

Before deployment, take a database backup outside the repository and record a read-only baseline for `attributes`, `attribute_values`, `product_variant_options`, products and variants. The expected live baseline from the verification pass is 12 attribute types and 273 values. The protected product/variant counts and option links must match after deployment. Do not put the dump or the baseline containing customer/order data into Git.

Flyway migration `V1089__remove_unused_variant_attribute_types.sql` deletes only `dungtich`, `kich-thuoc-oc`, `cap` and `solo` (their five values). It stops before any delete if one target type is referenced by `product_variant_options` or if the four-code set is incomplete. A successful run therefore changes the expected catalog counts from 12 types / 273 values to 8 types / 268 values while leaving product and variant rows untouched. The migration is covered by a PostgreSQL Testcontainers test, including usage and partial-set aborts.

For this release the owner explicitly authorized the complete rebuild and rollout with:

    docker compose --env-file .env.vps up -d --build

Afterward, check `docker compose ps`, backend health and Flyway history (`V1089` succeeded), confirm the four target codes are absent and the eight retained types/268 values remain, and compare the protected product/variant/option baseline. Run the admin product-choice smoke test at desktop, tablet and mobile widths. If the guarded migration stops, keep the previous application image running and restore from the external backup only after confirming the reason; never edit or delete a successful Flyway row to force a rerun.
