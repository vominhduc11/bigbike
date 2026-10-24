# Kiểm tra chức năng xem trước sản phẩm — 2026-10-12

Phạm vi: mở sản phẩm trong quản trị → xem trước dữ liệu chưa lưu → website nhận dữ liệu → đổi VI/EN, Máy tính/Điện thoại, đóng/mở lại. Không lưu, đăng bán hay thay đổi dữ liệu sản phẩm trong các bước kiểm tra.

## Căn cứ

- `docs/business/MODULE_CATALOG.md`: Catalog admin và Catalog browse còn hoạt động.
- `docs/business/WORKFLOW_OVERVIEW.md`: Product Authoring & Live Preview Workflow; xem trước nội dung chưa lưu, dùng template website, giữ nguyên trạng thái đăng bán.
- `docs/business/STATE_MACHINES.md` §4, Live preview: không lưu và không đưa sản phẩm nháp ra public.
- `docs/engineering/API_CONTRACT.md`: Product preview — admin dry-run render; quyền `products.update`, trả public Product.
- `bigbike-admin/STYLEGUIDE.md` §7: lỗi mạng phải có thông báo và cho Thử lại khi an toàn.

Đã tìm các finding xem trước trong `docs/audits/`. Audit ngày 2026-07-15 ghi cơ chế truyền dữ liệu xem trước hoạt động; không có mã AUD cho hai lỗi dưới đây.

## F1 — Khung xem trước trắng vì đường tải trang website đang bị kẹt

- **Mức độ:** High.
- **Trạng thái:** Đã khôi phục trên hệ thống đang dùng sau khi chủ shop duyệt; preview VI/EN và trang chủ tải thành công, website healthy.
- **Bằng chứng:** mở sản phẩm thật `wp-prod-25207` trên `https://admin.bigbike.vn`; `POST /api/v1/admin/products/preview` trả `200`, đúng tên và 16 biến thể. Iframe `https://bigbike.vn/preview/product/` không tải xong; không có tiêu đề sản phẩm trong khung.
- **Lệch ở đâu:** quản trị nhận được dữ liệu; backend dry-run thành công; website không hoàn tất tải trang để nhận dữ liệu.
- **Kiểm chứng runtime:** container `bigbike-web` chạy nhưng `unhealthy`, nhiều lần kiểm tra trang chủ vượt 5 giây. `curl --max-time 10 http://localhost:3000/preview/product/` hết hạn, chưa nhận phản hồi. Trang EN cũng không tải được. Tài nguyên favicon và route nội bộ `/vi/internal/home/`, `/vi/internal/sp/` vẫn phản hồi; các nguồn menu, facets, sản phẩm và settings ở backend vẫn trả `200`.
- **Thử nghiệm tách biệt:** sao chép artifact từ container bằng thao tác đọc, chạy một tiến trình riêng tại `localhost:4320`, dùng cùng backend và cấu hình kiểm tra redirect nội bộ. Cùng artifact trả `200` cho preview VI (~0,40 giây), preview EN (~0,26 giây), trang chủ (~0,15 giây). Container gốc vẫn hết hạn ở 10 giây. Không thay đổi code/config/file hay khởi động lại container gốc.
- **Giới hạn kết luận:** xác nhận tình trạng lỗi thuộc đường xử lý trang của tiến trình website hiện tại; chưa xác định cơ chế nội bộ gây kẹt. Không kết luận do dữ liệu sản phẩm hay thiếu bộ nhớ.
- **Hậu quả vận hành:** người sửa sản phẩm không xem được giao diện; trang chủ và một số trang công khai cũng bị ảnh hưởng trong lần kiểm tra.
- **Owner đã duyệt:** khởi động lại riêng `bigbike-web`, rồi kiểm lại route và khung xem trước trên bản đang dùng. Quyền duyệt cùng lúc cho cập nhật bản quản trị đã kiểm tra; không áp dụng cho backend hay dịch vụ dữ liệu.

## F2 — Khi website tải lỗi, quản trị chỉ để lại vùng trắng

- **Mức độ:** Medium.
- **Trạng thái:** Đã triển khai bản quản trị mới sau khi chủ shop duyệt; đã kiểm trực tiếp thông báo lỗi, Thử lại và các luồng xem trước trên hệ thống đang dùng.
- **Bằng chứng:** `bigbike-admin/src/components/LivePreview.jsx` trước thay đổi chỉ hiển thị lỗi dry-run. Không có trạng thái chờ iframe sẵn sàng, giới hạn chờ hay nút thử tải lại. Trong kịch bản F1, API đã thành công nên khung trắng không có thông báo.
- **Căn cứ:** `bigbike-admin/STYLEGUIDE.md` §7; `docs/engineering/API_CONTRACT.md`, Product preview — Iframe loading/failure state.
- **Thay đổi:** hiện trạng thái đang tải; nếu iframe chưa báo sẵn sàng sau 15 giây thì hiện lỗi và nút Thử lại. Chỉ nhận tín hiệu sẵn sàng từ đúng iframe và nguồn website đã cấu hình. Thử lại chỉ tải lại iframe và gửi nội dung chưa lưu mới nhất. Đóng/mở lại khung tạo phiên nhận dữ liệu mới. Nhãn VI/EN đầy đủ, áp dụng chung cho khung bài viết đang dùng cùng component.
- **Hậu quả vận hành được xử lý:** người dùng biết khung chưa tải được và có thể thử lại, không nhầm với sản phẩm thiếu nội dung.

## Kiểm tra trước triển khai

- Unit regression của `LivePreview`: **3/3 đạt** — đúng nguồn/iframe, nội dung mới nhất và đổi ngôn ngữ; hết hạn/thử lại; đóng/mở và dọn timer.
- Runtime backend thật: preview sản phẩm **200**; không gọi thao tác lưu/đăng bán sản phẩm.
- Runtime website gốc: **không đạt** — preview/trang chủ hết hạn; container unhealthy.
- Artifact website chạy tách biệt: **đạt** — preview VI/EN và trang chủ tải được.
- Admin lint (gồm kiểm mock runtime, song ngữ và định dạng): **đạt**.
- Admin unit suite: **127/127 file, 1.202/1.202 phép kiểm đạt**, chạy `npm run test -- --maxWorkers=1 --testTimeout=15000`. Lần chạy mặc định cùng lúc lint bị hết hạn ở một số kiểm tra ngoài phạm vi preview nên đã dừng; lần chạy lại giới hạn một worker đạt toàn bộ, không sửa các test ngoài phạm vi.
- Admin build: **đạt**, cả bản mặc định lẫn bản dùng cấu hình production của Dockerfile (`VITE_ADMIN_API_BASE=/api/v1`, storefront `https://bigbike.vn`).
- Hygiene: không thêm CSS; text VI/EN có dấu, không mojibake; guard dữ liệu runtime đạt.
- `bash deploy/nginx/tests/domain-boundary-config-test.sh --self-test`: **đạt**, cả kiểm dương và hai kiểm âm.
- Playwright với bản quản trị mới và backend thật: **đạt** VI/Máy tính, VI/Điện thoại, EN/Điện thoại, EN/Máy tính, cập nhật tên chưa lưu, đóng/mở lại. Viewport quản trị 1440×900, iframe 1280px/390px. Không gọi thao tác ghi sản phẩm. Đã chủ động chặn lần tải tài liệu iframe trong môi trường kiểm tra để xác nhận thông báo lỗi sau 15 giây và nút Thử lại; sau khi bỏ chặn, khung nhận lại đúng dữ liệu.
- Giới hạn E2E: HTML quản trị lấy từ `dist` mới, tài liệu iframe lấy từ tiến trình kiểm tra riêng của artifact website; API và tài nguyên ảnh dùng hệ thống thật. Không coi đây là nghiệm thu bản đang dùng: F1 vẫn cần chủ shop duyệt thao tác khôi phục rồi kiểm lại.
- Lượt nghiệm thu cuối trước triển khai dùng bản quản trị build với cấu hình production: **đạt**, ảnh sản phẩm đã tải trước khi chụp; không có lỗi trang/console/API trong bộ thu thập của driver, không có thao tác ghi sản phẩm. Các tiến trình website kiểm tra riêng đã dừng và bản sao runtime tạm đã xóa; giữ ảnh và log để đối chiếu. Website gốc vẫn `unhealthy` trước khi chủ shop duyệt thao tác khôi phục.

## Lệnh đọc để kiểm chứng

```bash
docker ps --format '{{.Names}}\t{{.Status}}\t{{.Ports}}'
docker inspect --format '{{json .State.Health}}' bigbike-web
docker logs --tail 60 bigbike-web
curl --max-time 10 -I http://localhost:3000/preview/product/
curl --max-time 10 -I http://localhost:3000/en/preview/product/
```

Trong giai đoạn chẩn đoán đã đọc log `bigbike-backend`, kiểm tra public API và `SELECT pg_stat_activity` trong `bigbike-postgres`; chưa thay đổi dịch vụ cho tới khi chủ shop duyệt. Không chạy UPDATE/DELETE và không dọn dữ liệu shop hay dữ liệu E2E của phiên khác. Ảnh chụp và driver kiểm tra tạm nằm ngoài git tại `/tmp/bigbike-product-preview-*`.

## Triển khai và nghiệm thu sau khi được duyệt

- Chủ shop trả lời đồng ý khởi động lại riêng website và cập nhật bản quản trị đã kiểm tra.
- Chạy `docker compose --env-file .env.vps restart bigbike-web`; giữ image `sha256:de1d07ac45aecc117956039e046b284d85bf1cae21dd08a4afdc822af6816124`. Website trở lại healthy, startup revalidation trả 200.
- Giữ image quản trị cũ ở `bigbike-admin:before-product-preview-20261012` (`sha256:3a53b560462728093ae474fd4e637c668c28e2462be790703bd032607310c3b2`). Build/nạp riêng quản trị bằng `.env.vps` và `up -d --no-deps --no-build`; image mới `sha256:b5ef976b6aed286660316a9f82ff1aa26b324ad55796ec47cb12e98b9a065619`, healthy.
- Xác minh backend và ba dịch vụ dữ liệu vẫn dùng image/thời điểm khởi động trước đó, đều healthy. Không sửa env, không chạy migration và không commit/push.
- Nghiệm thu qua URL HTTPS thật: **8/8 bước đạt** — thông báo lỗi tải, Thử lại, VI/Máy tính, VI/Điện thoại, EN/Điện thoại, EN/Máy tính, tên chưa lưu, đóng/mở lại. Lỗi tải được tạo bằng cách chặn một yêu cầu tài liệu iframe trong riêng trình duyệt kiểm tra; bỏ chặn rồi bấm Thử lại, dữ liệu được nhận lại mà không gọi thêm dry-run. Không dựng server thay thế hoặc mock dữ liệu trong lần nghiệm thu sau triển khai.
- Ảnh sản phẩm tải được; không có lỗi trang hoặc API; có **0 thao tác ghi sản phẩm**. Đã mở ảnh xem trực tiếp khung sản phẩm và thông báo Thử lại. Console vẫn ghi lỗi Cloudflare beacon/inline script bị CSP chặn như trước đợt sửa: không ghi bộ thu thập hoàn toàn sạch; các thông báo này không cản tám bước xem trước.
- Kiểm cuối: `/preview/product/`, `/en/preview/product/` và `/` trả **200**, cả web/admin healthy. Header preview giữ `X-Robots-Tag: noindex, nofollow` và CSP chỉ cho nguồn admin đã cấu hình nhúng.
- Log build/nạp/nghiệm thu: `/tmp/bigbike-product-preview-{docker-build,docker-deploy,live-check}-20261012.log`. Ảnh: `/tmp/bigbike-product-preview-live-20261012.png`, `/tmp/bigbike-product-preview-live-retry-20261012.png`. Driver đọc: `/tmp/bigbike-product-preview-live-check.mjs`.
