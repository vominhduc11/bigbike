# Rà soát giao diện header — 2026-09-07

Phạm vi: header web, bộ đổi ngôn ngữ, menu điện thoại/máy tính bảng và menu tài khoản. Bắt đầu từ [ảnh điện thoại do chủ shop cung cấp](https://res.cloudinary.com/daohufjec/image/upload/v1788797533/Screenshot_2026-09-07-23-11-06-677_com.android.chrome_uwb6tn.jpg); đối chiếu với trình duyệt và dữ liệu công khai thật của backend. Lượt kiểm tra cuối thực hiện ngày 2026-09-08.

## Căn cứ

- `bigbike-web/STYLEGUIDE.md`, mục **Navigation**: chiều cao header, vùng bấm, biểu tượng, menu và logo.
- `bigbike-web/styles/brand-tokens.css`: màu, font, chiều rộng nút và lớp hiển thị.
- `bigbike-web/docs/TYPOGRAPHY.md`: Arial cho web; không thêm font thay thế.
- `docs/engineering/ARCHITECTURE.md`, mục **i18n & rendering**: URL quyết định ngôn ngữ, HTML đầu tiên phải đồng bộ với trình duyệt.
- `docs/engineering/API_CONTRACT.md`, landing sản phẩm VI/EN: kiểm thử chuyển ngôn ngữ giữ đường dẫn sản phẩm công khai `/en/product/{slug}/`.
- Chủ shop xác nhận logo lớn tràn xuống dưới header là chủ ý. Giữ nguyên ảnh, kích thước, vị trí, ngưỡng hiển thị và biến thể khi cuộn.

## Các vấn đề đã sửa

| Vấn đề có bằng chứng | Thay đổi |
| --- | --- |
| Logo ngang trên điện thoại rộng 64px, khó nhận diện | Tăng logo ngang lên 112px, giữ tỉ lệ; không đổi nhánh logo lớn trên máy tính |
| Nút VI/EN chỉ cao khoảng 26px, khó chạm | Điện thoại dùng bộ chọn gọn, nút cao bằng header; máy tính giữ hai nút trực tiếp, vùng bấm tối thiểu 44px |
| Biểu tượng mở menu lệch và không cùng khung với tìm kiếm | Dùng bộ biểu tượng sẵn có, cùng khung và độ dày nét |
| Nút đóng menu nằm ngoài khung modal, nhìn thấy nhưng không bấm được | Đưa nút đóng vào thanh tiêu đề cố định trong menu; kiểm tra chạm, Escape và trả tiêu điểm |
| Menu/lựa chọn ngôn ngữ có thể còn mở sau khi đổi sang cỡ màn hình lớn | Đóng đúng khi vượt ngưỡng bố cục và trả lại thao tác/cuộn trang |
| Menu tài khoản vượt mép phải 16px ở màn hình 1440px | Căn theo mép phải nút tài khoản |
| Escape không đóng menu tài khoản khi đang chọn một mục bên trong | Xử lý Escape cho cả khung và trả tiêu điểm về nút mở |
| Đổi VI → EN → VI tại liên kết có điểm neo làm lặp fragment, ví dụ `#products#products` | Với URL có fragment, chuyển tài liệu cùng tab để giữ nguyên query/hash và lịch sử; URL thường vẫn điều hướng trong ứng dụng |

Logo lớn tại đầu trang được đo trước/sau: 1280px và 1440px đều ở `(24, 0)`, 1920px ở `(264, 0)`; cùng kích thước **210 × 190px**. Khi cuộn vẫn dùng logo ngang rộng **150px**.

## Xác minh

- Lint và kiểm tra dữ liệu business hardcode: đạt.
- Unit test: 104 file, 672 test đạt trước bước sửa Escape của menu tài khoản; hành vi Escape được kiểm tra riêng trên trình duyệt.
- Production build trong bản sao riêng của web: đạt.
- 13 kiểm thử trình duyệt về điện thoại nhỏ, điều hướng máy tính, xuống dòng danh mục và ưu tiên tải logo: đạt trên bản dev có dữ liệu thật.
- Lượt cuối gồm 18 kịch bản trên production preview: 10 đạt ngay; 3 kiểm thử cũ được cập nhật để nhận URL ảnh tối ưu và query quay về của đăng nhập, chạy lại **3/3 đạt**. Các kiểm tra logo ở 1280/1440/1920px, đổi VI → EN → VI, giữ query/hash, Quay lại/Tiến tới, sản phẩm song ngữ, đóng menu khi điều hướng và thao tác bàn phím đều đạt.
- **5 kịch bản còn lỗi ở runtime guard của toàn trang**: đóng menu sau khi cuộn, chuyển menu sang desktop, đóng bộ chọn ngôn ngữ khi đổi cỡ màn hình, menu tài khoản 1440px và 1920px. Các assertion thao tác/bố cục của header đã hoàn tất; lỗi phát sinh từ khởi tạo thanh điều hướng dưới và ảnh trang chủ EN, mô tả ở phần dưới. Không đánh dấu 5 kịch bản này là đạt.
- Tổng cộng **26 kịch bản đạt** qua hai nhóm kiểm tra (13 bố cục + 13 tương tác/điều hướng); không coi đây là kết quả sạch lỗi cho toàn website.
- Prettier cho toàn bộ source/test/message sửa trong phạm vi header, ESLint cho bản sửa ngôn ngữ cuối và `git diff --check`: đạt.
- Đối chiếu ảnh production preview ở 320, 390, 430, 768, 1024, 1261, 1280, 1440 và 1920px: không tràn ngang. Số đo logo lớn trước/sau khớp hoàn toàn ở cả ba cỡ máy tính. Ảnh và số đo tạm lưu tại `/tmp/bigbike-header-final/` (header, menu, bộ chọn ngôn ngữ, tìm kiếm, tài khoản và `metrics.json`).

Môi trường: đã kiểm tra bằng `docker ps --format '{{.Names}}\t{{.Status}}\t{{.Ports}}'`; service `bigbike-backend` đang chạy ở cổng 8080, web đang chạy ở cổng 3000. Bản thử riêng ở cổng 3018 dùng dữ liệu GET/OPTIONS thật từ backend. Do backend chỉ cho phép origin production, trình duyệt kiểm thử chuyển tiếp phản hồi thật cho origin local; không tạo dữ liệu giả hoặc sửa cấu hình container. Không khởi động lại container, không sửa `.env`, không triển khai.

## Vấn đề ngoài header còn thấy khi kiểm thử

- **Khởi tạo trang chủ trong production:** runtime guard báo React #418. Debugger xác định phần lệch là `ActiveBar` trong `MobileBottomNav`, tại liên kết Trang chủ. HTML server chưa có dấu chọn; trình duyệt thêm dấu chọn ngay lần render đầu. `isHomePath()` chưa nhận đường dẫn rewrite nội bộ `/vi/internal/home/` của `proxy.ts`. Đây là phần thanh điều hướng dưới đang có thay đổi riêng trong workspace; báo cáo này không ghi nhận đã sửa lỗi đó và không bỏ qua runtime guard.
- **Bản dev:** `AccordionPanel` của footer báo thiếu `key` cho phần tử con. Kiểm thử có runtime guard vẫn báo lỗi; không ghi nhận toàn bộ trang đã sạch lỗi.
- **Ảnh nội dung trong bản production thử riêng:** một số ảnh bài viết/sản phẩm còn trỏ `/wp-content/uploads/...`; tối ưu ảnh trả HTTP 400. Lỗi xuất hiện trong kiểm thử trang chủ EN và lượt đối chiếu ảnh nhiều cỡ màn hình. Runtime guard vẫn ghi nhận các lỗi ảnh này, dù thao tác menu và chuyển bố cục hoàn tất.
- Kiểu chữ viết tay trong ảnh điện thoại chưa tái hiện trên trình duyệt kiểm thử; font tính toán của header là Arial. Chưa có cơ sở quy lỗi này cho font trong mã nguồn.

Các thay đổi riêng đang có ở footer, thanh điều hướng dưới, cấu hình sinh tự động và tài liệu deployment không thuộc phần sửa header này.

## Kiểm tra sau triển khai — 2026-09-08

Lượt này thực hiện theo yêu cầu của chủ shop: chạy `docker compose --env-file .env.vps up -d --build`, sau đó đưa toàn bộ thay đổi lên GitHub. Phạm vi gồm cả thay đổi footer và thanh điều hướng dưới đã có trong workspace.

- Docker Compose hoàn tất thành công; bản web mới được dựng bằng `npm run build -- --webpack`. Kiểm tra bằng `docker ps --format 'table {{.Names}}\t{{.Status}}'` ghi nhận cả sáu dịch vụ BigBike khỏe.
- `GET http://localhost:8080/actuator/health` của `bigbike-backend` trả `UP`; `https://bigbike.vn/` và `https://admin.bigbike.vn/` trả HTTP 200. HTML công khai đã có logo điện thoại 112px, bộ chọn ngôn ngữ gọn và nhãn thanh điều hướng mới.
- `npm run lint` đạt, gồm kiểm tra dữ liệu business hardcode, ESLint và Prettier cho các tệp được chuẩn bị commit. Bộ chặn tệp bí mật đã được sửa để chấp nhận đúng tệp mẫu công khai ở root `.env.vps.example`; kiểm tra danh sách tệp và 10 trường hợp tên tệp đều đạt. `.env` và `.env.vps` thật vẫn bị chặn.
- `npm run test -- --maxWorkers=1` đạt: **104 tệp, 680 kiểm thử**, chạy trong khoảng 6 phút 32 giây. Giới hạn một tiến trình giúp tránh cạnh tranh bộ nhớ trên VPS; kết quả này là lượt hoàn tất sau các lần chạy bị dừng do tải máy và hạn chế sandbox.
- Kiểm thử trình duyệt chạy trực tiếp trên `https://bigbike.vn`, một tiến trình: `e2e/mobile-bottom-nav.e2e.ts` và các nhóm `mobile control interactions` / `account menu` của `e2e/header-acceptance.e2e.ts`. Kết quả: **4 đạt, 6 trượt** trong 2 phút. Bốn kiểm thử thanh dưới VI/EN đạt, gồm cỡ màn hình 320/390px, tăng chữ 100/125/200%, chừa khoảng an toàn và trả tiêu điểm khi đóng tìm kiếm.
- Sáu kiểm thử header hoàn tất các assertion thao tác/bố cục, nhưng runtime guard phát hiện mã thống kê `static.cloudflareinsights.com/beacon.min.js` bị `script-src` của trang chặn. Không đánh dấu sáu kiểm thử này là đạt. Các lỗi được báo trong lượt này đều là CSP của mã thống kê, không phải React #418 đã thấy ở lượt preview trước. Chính sách CSP và cấu hình Cloudflare không được thay đổi trong lượt triển khai này.
- Log kiểm thử và dấu vết tạm nằm ở `/tmp/bigbike-publish-e2e-final.log` và `/tmp/bigbike-publish-e2e-final/`; không commit thông tin bí mật hoặc dữ liệu khách hàng.
