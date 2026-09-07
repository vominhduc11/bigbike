# Triển khai nguồn sản phẩm Google Merchant — 07/09/2026

Owner yêu cầu thực thi đồng bộ sau audit hiện trạng. Phương án: admin tiếp tục đăng/sửa sản phẩm tại BigBike; Google lấy XML động theo lịch sau một lần đăng ký URL trong GMC. **Nguồn đã hoạt động công khai:** `https://bigbike.vn/google-merchant.xml`. **Đã xác minh Google tiếp nhận đủ 1.172 SKU qua bản xuất GMC lúc 12:30:21 ngày 07/09 do owner cung cấp. Chưa xác minh duyệt/hiển thị toàn bộ nguồn mới, cấu hình lịch và lần lấy định kỳ tiếp theo.**

## Căn cứ và phạm vi

- `docs/business/BUSINESS_RULES.md`: `GMC_RULE_001`–`005`; giữ quy tắc giá/tồn/lifecycle hiện hữu.
- `docs/engineering/API_CONTRACT.md` §Google Merchant product feed; `DATA_CONTRACT.md` §Google Merchant feed projection; `INTEGRATION_GUIDE.md` §Google Merchant Center; `ARCHITECTURE.md` §Storefront Rendering Strategy; `API_FLOW_MAP.md` §Google Merchant catalog sync.
- Web: XML route + đọc catalog không cache, dựng XML, chọn biến thể từ URL, Product/ProductGroup JSON-LD, alias nội bộ tránh vòng redirect VI và các kiểm thử tương ứng.
- Backend/admin: dùng API/publication/stock hiện hữu; không thêm bảng, migration, permission, endpoint backend hoặc màn hình quản trị. Không sửa sản phẩm thật, `.env` hay thông tin tài khoản Google.

## Bằng chứng dữ liệu và chức năng

- Đọc API thật từ backend trên VPS: 185 sản phẩm công khai → 1.172 SKU (1.114 dòng biến thể + 58 sản phẩm đơn); 1.071 còn hàng và 101 hết hàng tại thời điểm kiểm tra.
- XML được parse toàn bộ: ID duy nhất, không thiếu các trường cơ bản bắt buộc; link biến thể mang `?variant=`. Không phải bằng chứng Google đã duyệt mọi sản phẩm.
- Phát hiện SKU cha trùng trong dữ liệu thật: dùng `product.id` làm `item_group_id`/`productGroupID`; không thay SKU shop. Chuẩn hóa tên thuộc tính màu/kích cỡ tương đương; ba mẫu còn thiếu thuộc tính được ghi trong `GMC_SETUP.md`.
- Kiểm ảnh chụp PDP thực tế: mẫu LS2 FF800 Storm có watermark/logo shop chèn vào ảnh, cần xử lý chất lượng ảnh để đáp ứng [quy định Google](https://support.google.com/merchants/answer/6324350?hl=en). Không coi XML hợp lệ là bằng chứng ảnh đã được Google duyệt; chưa thay ảnh hoặc kiểm toàn bộ kho ảnh.
- Nguồn HTTP chạy thử trên VPS trả `200 application/xml`, `Cache-Control: no-store`, `X-Merchant-Product-Count: 185`, `X-Merchant-Item-Count: 1172`.
- Kiểm tra bản đóng gói phát hiện vòng 301 ở đường VI và lỗi `DYNAMIC_SERVER_USAGE` khi alias chưa khai cấu hình render. Alias `/vi/internal/product/{slug}/` dùng cùng cơ chế homepage/catalog hiện hữu và khai `force-dynamic` trực tiếp như trang sản phẩm gốc. Kiểm tra lại trên image cuối và tên miền thật trả 200; HTML ban đầu có đúng SKU `FF800OB-XANHLA-XXL`, giá 3.190.000 VND, InStock cùng link đã chọn biến thể. URL công khai/canonical giữ nguyên.

## Kiểm tra

| Kiểm tra | Kết quả |
|---|---|
| Web unit suite trước bổ sung alias | PASS — 591/591 |
| Web unit suite sau alias và chạy lại các ca trượt | 590/593 trong lượt chạy song song với build; ba ca trượt thuộc copy-audit/FloatingChat. Chạy riêng hai file bằng một worker: PASS 13/13, không sửa code hoặc nới timeout của các ca này |
| Proxy regression sau bổ sung alias | PASS — 25/25, gồm hai ca GMC mới |
| Web lint sau sửa alias/E2E | PASS — runtime data guard, ESLint |
| Định dạng và hygiene | PASS — Prettier trực tiếp trên file đổi; không thêm CSS; không phát hiện chữ vỡ mã. Các dấu `Â` trong fixture địa chỉ “Âu Cơ” là tiếng Việt hợp lệ |
| Production build chạy ngoài Docker trong thư mục thử riêng | PASS — TypeScript và build hoàn tất; không dùng `ignoreBuildErrors` |
| Production Docker image dùng `.env.vps`, gồm alias cuối | PASS — image `878395767a59`, build + TypeScript hoàn tất |
| Playwright landing 375/768/1440 và hết hàng | PASS — 4/4 trên đúng image triển khai, backend/catalog thật; kiểm HTML/schema, giá hiển thị, lựa chọn, stock, canonical, lỗi runtime và tràn ngang. Ảnh 375/768/1440 đã lưu; không cập nhật baseline |
| Đường feed qua domain công khai sau triển khai | PASS — HTTP 200 XML, `no-store`, Cloudflare `DYNAMIC`, 185 sản phẩm / 1.172 SKU duy nhất, 1.071 còn / 101 hết, không thiếu trường cơ bản; lần đo 4,87 giây |
| Landing qua tên miền thật | PASS — sản phẩm đơn `TNB-SCS-S13`, biến thể còn `FF800OB-XANHLA-XXL`, biến thể hết `LS2-OF600R-M`: HTTP 200; SKU, giá, Còn/Hết và URL Offer khớp nguồn |
| Web sau triển khai | PASS — `bigbike-web` healthy, đúng image đã kiểm; trang chủ công khai HTTP 200 |
| GMC tiếp nhận dữ liệu sau khi owner thêm nguồn | PASS — bản xuất 12:30:21 có đủ 1.172 SKU Trực tuyến; giá, stock, link, ảnh, nhóm và các thuộc tính được đối chiếu khớp XML |
| GMC duyệt/hiển thị nguồn mới và lấy định kỳ | Chưa xác minh — bản xuất không có cột duyệt/hiển thị hoặc lịch; chưa theo dõi một lần admin thay đổi thật rồi GMC lấy lại |

Lệnh kiểm tra nguồn: `curl -f -A 'Mozilla/5.0' https://bigbike.vn/google-merchant.xml`. Container nền được xác nhận qua `docker ps`; backend đọc từ `http://127.0.0.1:8080`. Các file XML/log/ảnh thử nằm ngoài repo tại `/tmp/bigbike-gmc-audit-2026-09-07/`. Không đưa credentials vào báo cáo.

## Triển khai và khả năng khôi phục

- Chỉ cập nhật `bigbike-web` bằng `docker compose --env-file .env.vps up -d --no-deps --no-build bigbike-web` sau khi build image và kiểm Playwright. Thời điểm start container: 07/09/2026 11:48:57 giờ Việt Nam.
- Image chạy: `sha256:878395767a59e17ab522c8594eefa061ca2eba8d7c84a4087a5ea81aadde8094`; được gắn cả tag `bigbike-web:gmc-20260907` và tag Compose mặc định `bigbike-bigbike-web:latest`.
- Image trước được giữ tại `bigbike-web:gmc-previous-20260907`; không xoá/prune image, volume hoặc dữ liệu shop. Dịch vụ thử `bigbike-gmc-preview` đã dừng và tự dọn sau kiểm tra.
- Không commit/push trong phiên. Agent không thay đổi tài khoản Google; owner đã báo hoàn tất thêm nguồn và cung cấp bản xuất GMC để đối chiếu việc tiếp nhận.

## Nghiệm thu tiếp nhận từ bản xuất GMC của owner

- Nguồn bằng chứng: tệp `sản_phẩm_2026-09-07_12-30-21_.zip` được owner chia sẻ qua Drive, chứa một TSV UTF-8, 23 cột và 1.290 dòng dữ liệu. SHA-256 ZIP: `900a244dcb8c83d8469c306721501666ed775606cc1902de8887a4a717fad697`. Tệp gốc được giữ ngoài repo, không đưa dữ liệu tài khoản hoặc đường tải có chữ ký vào docs.
- Lấy lại `https://bigbike.vn/google-merchant.xml` bằng `curl --fail --location`: HTTP 200 XML; SHA-256 bản XML đối chiếu: `ed88231cabf6307abc56ea460d0da77d3bab7681caa4b223bd33bd141d728250`.
- Parse toàn bộ TSV bằng `csv.DictReader` và XML bằng `ElementTree`, đối chiếu SKU chính xác trong kênh Trực tuyến. Đủ 1.172/1.172 SKU, không thiếu mã; giá so sánh theo số tiền và tiền tệ, Còn/Hết quy đổi đúng giá trị VI/Google. Không lệch giá, stock, URL, ảnh chính, nhóm biến thể, tiêu đề, kích cỡ, màu, brand hoặc giới tính. Các trường văn bản được chuẩn hóa Unicode NFC khi cần.
- Phân bổ: 1.202 dòng Trực tuyến = 1.172 SKU trong XML + 30 mã ngoài XML có link cũ `/sp/…html`; 88 dòng Địa phương. Trong phần khớp XML có 1.071 còn hàng và 101 hết hàng.
- Có 1.260 ID đơn lẻ nhưng 1.290 khóa đầy đủ duy nhất `(kênh, nhãn nguồn, ngôn ngữ, ID)`. Ba mươi ID xuất hiện ở cả hai kênh; không kết luận trùng lỗi khi chỉ nhìn ID. Bốn mã khớp XML có `update type=merge`: `GCRM103`, `RBP02`, `EA113B`, `GCRM104`; không suy diễn nguồn sở hữu hoặc tự xóa nguồn cũ.
- Giới hạn: TSV không có tên nguồn sở hữu, cột phê duyệt, khả năng hiển thị hoặc lịch lấy. `tình trạng=mới` là tình trạng hàng hóa. Hai dòng có mỗi dòng một lượt nhấp đều thuộc kênh Địa phương; tệp không chỉ rõ khoảng thời gian hay vị trí Google của lượt nhấp. Không dùng số đó làm bằng chứng nguồn mới đã có lượt hiển thị/nhấp trên Google Shopping.
- Bằng chứng đọc/đối chiếu nằm ngoài repo tại `/tmp/bigbike-gmc-export-20260907-123021.zip`, `/tmp/bigbike-gmc-export-20260907-123021.rows.json`, `/tmp/bigbike-gmc-receipt-verification-20260907.xml`, `/tmp/bigbike-gmc-receipt-verification-20260907.json`. Không thao tác ghi trong GMC hoặc sửa dữ liệu bán hàng.

## Bước hoàn tất phía Google

Theo [GMC_SETUP.md](../engineering/GMC_SETUP.md): việc tiếp nhận đã có bằng chứng từ bản xuất GMC. Tiếp tục kiểm kết quả duyệt/khả năng hiển thị của nguồn mới, giờ lấy tự động và nguồn sở hữu 30 mã trực tuyến ngoài XML trước khi dọn. Xác minh thêm một lần admin cập nhật thật → Google lấy lại; không sửa dữ liệu thật chỉ để thử nếu chưa có thay đổi nghiệp vụ cần thực hiện. Không suy ra duyệt/hiển thị hoặc lịch đã chạy từ kết quả tiếp nhận.
