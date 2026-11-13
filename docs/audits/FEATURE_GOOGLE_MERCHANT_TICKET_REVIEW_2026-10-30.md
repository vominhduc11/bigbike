# Đối chiếu phiếu sửa Google Merchant với BigBike đang chạy — 30/10/2026

> **Cập nhật thực thi 30/10/2026:** đã khôi phục feed production 200 XML, 213 sản phẩm / 1.187 SKU duy nhất sau duyệt Nháp + 301. Source bổ sung theo dõi chưa deploy. Nội dung kiểm trước bên dưới là ảnh chụp lịch sử; xem phần “Thực thi tiếp nối” và kết quả cuối.

Phạm vi: thẩm định phiếu giao việc do owner cung cấp, bằng tài liệu chuẩn, mã nguồn và dữ liệu thật trên VPS production lúc khoảng 15:06–15:11 giờ Việt Nam. Đây là báo cáo đánh giá; chưa thực thi sửa sản phẩm, ứng dụng, cấu hình hoặc tài khoản Google.

## Kết luận

**Cần xử lý gấp feed, đồng thời cần chỉnh phiếu trước khi giao triển khai.** Nguyên nhân trực tiếp hiện tại đã xác định: SKU `DRHL-KEWIG-BD-1L` xuất hiện ở một sản phẩm đơn và một lựa chọn thuộc sản phẩm khác. Feed phát hiện trùng và chủ động trả 503 theo quy tắc đang có; chưa có bằng chứng lỗi lần này do backend mất kết nối hoặc vượt thời gian chờ.

Những yêu cầu đã có trong dự án: lọc hàng công khai/ngừng bán, xuất từng lựa chọn, giá và Còn/Hết theo lựa chọn, thương hiệu, tối đa 10 ảnh phụ. Các phần này cần kiểm chứng và sửa dữ liệu cụ thể, không mặc định viết lại. Phục vụ bản feed tốt gần nhất và bổ sung dữ liệu định danh là những thay đổi cần cập nhật hợp đồng trước khi triển khai.

Không có công cụ/phiên đăng nhập Merchant Center trong lần kiểm này. Số 504/506 mã, ngày lấy cuối 17/09, trạng thái từ chối, nguồn sở hữu và ngày hết hạn trong phiếu là thông tin owner cung cấp, chưa xác minh độc lập trong Google.

## Căn cứ chuẩn và bản đồ luồng

| Phần | Căn cứ |
| --- | --- |
| Tính năng đang hoạt động | `docs/business/MODULE_CATALOG.md`, hàng Google Merchant product feed |
| Điều kiện đưa hàng vào feed, mã hàng, giá, ảnh và lỗi nguồn | `docs/business/BUSINESS_RULES.md`, `GMC_RULE_001`–`005` |
| SKU, giá và tồn kho | Cùng tài liệu: `PRODUCT_RULE_SKU_001`, `PRODUCT_RULE_012`/`013`, `STOCK_RULE_005`/`006` |
| Trạng thái ngừng bán | `docs/business/STATE_MACHINES.md` §4; `docs/engineering/DATA_CONTRACT.md` §Product discontinued flag |
| XML, phân trang và HTTP 503 | `docs/engineering/API_CONTRACT.md` §Google Merchant product feed, dòng 834–849 |
| Ánh xạ trường | `docs/engineering/DATA_CONTRACT.md` §Google Merchant feed projection, dòng 443–462 |
| Vận hành và lịch sử tiếp nhận | `docs/engineering/GMC_SETUP.md`; báo cáo lịch sử `FEATURE_GMC_IMPLEMENTATION_2026-09-07.md` |

Luồng được đối chiếu: **Quản trị sửa/đăng sản phẩm → backend lưu và cung cấp danh mục công khai → website xuất XML → GMC lấy theo lịch → khách mở đúng lựa chọn trên trang sản phẩm.**

- Quản trị: `bigbike-admin/src/screens/ProductDetailScreen.jsx`, bộ kiểm dữ liệu `src/lib/schemas.js`.
- Backend: `api/admin/dto/UpsertProductRequest.java`, `service/admin/CatalogRequestValidator.java`, `repository/catalog/JpaCatalogReadRepository.java` trong package `com.bigbike.bigbike_backend`.
- Web: `bigbike-web/lib/api/public-api.ts:342`, `lib/merchant/catalog.ts`, `lib/merchant/feed.ts`, `app/google-merchant.xml/route.ts`, `lib/utils/product-variant-link.ts`.
- Tài khoản Google là bước vận hành bên ngoài; BigBike hiện không lưu khóa hoặc gửi dữ liệu bằng Merchant API.

## Kết quả kiểm chứng thật

| Kiểm tra | Kết quả |
| --- | --- |
| `docker ps` | Các service BigBike web/backend/admin/PostgreSQL/MinIO đang chạy; chỉ đọc đúng stack BigBike, không dùng stack audit |
| Feed qua domain, UA curl | 503, `text/plain`, đúng thông báo trong phiếu; 5,84 giây |
| Feed qua domain, UA giả lập Googlebot | 503, cùng thông báo; 5,81 giây |
| Feed trực tiếp web trên VPS `127.0.0.1:3000` | 503, cùng thông báo; 5,74 giây |
| Log `bigbike-web` ngay sau các lần gọi | `[google-merchant] GMC_SKU_DUPLICATE` |
| Kết nối backend của web | `BIGBIKE_API_BASE_URL=http://bigbike-backend:8080`; đường feed đọc nội bộ Docker, không mặc định đi qua `api.bigbike.vn` |
| `robots.txt`, `sitemap.xml` | Đều 200; sitemap parse được 786 URL |
| Đọc đầy đủ catalog và detail trên backend thật | 214 sản phẩm, không lỗi detail; dự kiến 1.188 dòng trước kiểm tra SKU, gồm 1.104 lựa chọn và 84 sản phẩm đơn |
| Số SKU trong các dòng dự kiến | 1.187 giá trị duy nhất; đúng một giá trị bị dùng hai lần |
| Tiền tố ID lựa chọn | 738 ID `wp-var-…`, 366 ID `var_…`; cả hai là dữ liệu hiện tại |
| Đọc file ảnh thật | 25 URL ảnh đều tải được; 21 ảnh nhỏ hơn 500 ở ít nhất một chiều, đang được gán cho 86 dòng lựa chọn |
| Kiểm bốn ảnh lớn thay thế trong kho | Đều 200, kích thước khớp dữ liệu kho; cần đối chiếu đúng màu/sản phẩm trước khi gán |

Các con số 1.188/1.187 là phép đếm dữ liệu dự kiến, **không phải feed đã trả XML thành công**, cũng không phải số hàng Google đã duyệt. Số nghiệm thu cuối phải tính lại sau xử lý mã trùng và các thay đổi nghiệp vụ.

## Các phát hiện và nội dung cần chỉnh

### F1 — High: toàn bộ feed ngừng chạy vì trùng giữa mã hàng đơn và mã lựa chọn

- **Bằng chứng:** log `GMC_SKU_DUPLICATE`; `bigbike-web/lib/merchant/feed.ts:127` kiểm mã chung cho mọi dòng và ném lỗi tại dòng 130; route chuyển lỗi thành 503 tại `app/google-merchant.xml/route.ts:19`.
- **Hai nơi cùng dùng `DRHL-KEWIG-BD-1L`:** sản phẩm đơn `/product/day-thun-rang-hang-kewig-bd-1l/`, ID `prod_c3340fe3669f40e38c9fca236653f07f`; và lựa chọn `var_2a9de4e6a23c47e7b38f87c686875622` của `/product/day-thun-rang-non-bao-hiem-hanh-ly-kewig-bd-1s/`, ID cha `prod_bd0f1b068f234567be9251e11fe647e2`.
- **Lệch giữa các đầu:** quản trị/backend chỉ kiểm SKU lựa chọn trùng với lựa chọn khác (`CatalogRequestValidator.java:572`, `ProductVariantJpaRepository.java:63`); feed yêu cầu duy nhất cho cả hàng đơn lẫn lựa chọn. `PRODUCT_RULE_SKU_001` hiện cho phép SKU cấp sản phẩm trùng; không được tự sửa quy tắc thành mọi SKU cha phải duy nhất.
- **Ảnh hưởng:** một xung đột dữ liệu chặn cập nhật toàn danh mục Google.
- **Chỉnh phiếu:** thay giả thuyết timeout bằng nguyên nhân đã xác minh. Shop xác nhận hai bản ghi có cùng đại diện một mặt hàng không và mã bán hàng thật cần giữ; không tự thêm hậu tố, đổi ID hàng loạt, xóa dòng hoặc bỏ qua lỗi để xuất một phần danh mục.
- **Cần owner quyết khi triển khai:** bản ghi/mã đúng và cách cảnh báo hoặc chặn xung đột này từ khâu quản trị. Quy tắc mới nếu có phải được ghi trước vào docs.
- **Giới hạn lịch sử:** container web hiện được tạo ngày 29/10, nên log của container này không chứng minh chính xác ngày bắt đầu lỗi trong tháng 9. Hai sản phẩm có lần cập nhật gần nhất 14/09 và 18/09; không suy ra thời điểm phát sinh mã trùng từ hai mốc đó.
- **Trạng thái:** Đã xác định; chưa sửa trong phạm vi thẩm định.

### F2 — Medium: lưu bản feed tốt gần nhất là thay đổi hành vi, cần quy định độ cũ

- **Căn cứ:** `GMC_RULE_005` và hợp đồng API hiện yêu cầu dữ liệu mới, đầy đủ hoặc 503. `lib/merchant/catalog.ts:8` chỉ gộp yêu cầu đồng thời, không giữ bản hoàn tất; thời gian chờ tối đa 45 giây tại dòng 13. Route đã có log lỗi ở dòng 25.
- **Chỉnh phiếu:** ưu tiên khôi phục dữ liệu hợp lệ trước. Nếu thêm bản dựng sẵn/bản dự phòng: chỉ công bố sau khi kiểm đầy đủ, lưu bền qua triển khai, ghi thời điểm dựng/số lượng, quy định giới hạn độ cũ và cách làm mới khi sửa giá/Còn–Hết/ngừng bán. Không phục vụ vô hạn giá và hàng đã cũ, không thay bản tốt bằng bản thiếu/rỗng do lỗi.
- **Cảnh báo:** log đang có nhưng chưa đủ chứng minh đã có người nhận cảnh báo. Giao rõ nơi nhận, người chịu trách nhiệm; kiểm cả HTTP, XML, số dòng và tuổi dữ liệu. HTTP 200 đơn thuần không phát hiện bản dự phòng cũ mãi.
- **Docs cần cập nhật khi triển khai:** `BUSINESS_RULES.md`, `API_CONTRACT.md`, `API_FLOW_MAP.md`, `INTEGRATION_GUIDE.md`, `ARCHITECTURE.md`, `GMC_SETUP.md`; bổ sung kiểm thử cho thành công, lỗi nguồn, bản dự phòng hết hạn và khởi động lại.
- **Trạng thái:** Đề xuất mở rộng; chưa chốt giới hạn độ cũ/cách lưu.

### F3 — Medium: phiếu cần giữ ID lựa chọn thật và điều kiện loại hàng hiện hữu

- **Căn cứ:** `GMC_RULE_002`/`004`; `feed.ts:109` đã lọc `PUBLISHED`, không ngừng bán, không VI noindex. Hàng tạm hết phải tiếp tục xuất `out_of_stock`. `product-variant-link.ts:10` so ID chính xác, không bắt buộc tiền tố.
- **Bằng chứng thật:** URL FF800 `?variant=wp-var-9102` trả 200, HTML nhận đúng SKU `FF800OB-XANHLA-XXL`, giá 3.190.000đ. Không thể dùng tiền tố `wp-var-` để kết luận ID cũ/hỏng.
- **RSB279/RSB286:** DB đều `PUBLISHED`, `discontinued=true`; không có trong catalog/sitemap hiện tại, URL `/product/` trả 404. Đã có trạng thái ngừng bán trong hệ thống; không cần mở lại chỉ để làm hết 404 của dữ liệu Google cũ.
- **Chỉnh phiếu:** ghi rõ giữ hàng tạm hết, loại hàng ngừng bán/nháp/thùng rác/VI noindex; giữ ID hiện tại bất kể tiền tố. Chỉ thêm 301 khi đã xác nhận có trang thay thế tương đương; nếu bán lại là quyết định mới của shop.
- **Quan sát SEO riêng:** hai đường `/sp/{slug}.html` đã kiểm đều 301 sang `/product/` rồi 404; khác hành vi trang lịch sử tại `STATE_MACHINES.md` §4. Nên tách rà soát redirect lịch sử, không lấy việc này làm lý do đưa hàng ngừng bán vào feed.
- **Trạng thái:** bộ lọc và hỗ trợ hai tiền tố đã có; cần làm mới phía GMC và kiểm redirect riêng.

### F4 — High: ảnh riêng của lựa chọn quá nhỏ; đã có một số nguồn lớn ngay trong kho

- **Bằng chứng:** `feed.ts:65` ưu tiên ảnh riêng của lựa chọn, không chọn theo độ phân giải. Ảnh riêng nhỏ vẫn được dùng dù ảnh cha lớn hơn. Các kích thước dưới đây được đo từ file thật, không suy từ tên file.

| Nhóm | Ảnh đang gán | Nguồn lớn đã xác minh trong kho |
| --- | --- | --- |
| LS2 FF800 xanh lá | 50×50, tên có `Custom` | 1.080×1.080, `MU-BAO-HIEM-LS2-FF800-XANH-LA-2.jpg` |
| Caberg Avalon X trắng | 50×50 | 1.176×1.176, `CABERG-AVALON-X-WHITE-01.jpg` |
| ILM Z302 ảnh `02` | 50×50 | 1.176×1.176, `MU-BAO-HIEM-ILM-Z302-02.jpg` |
| Komine BK088 đen | 50×21 | 1.500×631, `GIAY-KOMINE-BK088-MAU-DEN-1.jpg` |
| LS2 OF600 | 150×150 | Chưa kết luận đủ nguồn thay thế đúng từng màu |
| LS2 OF610/OF616 | 400×400 | Chưa kết luận đủ nguồn thay thế đúng từng màu |
| Komine GK257, một số OF626 | 447×447 | Cần đối chiếu thêm ảnh đúng mẫu/màu |

- **Chỉnh phiếu:** rà toàn bộ ảnh theo kích thước thật, gồm ảnh lựa chọn; không chỉ tìm hậu tố `150x150`/`300x300`/`400x400`. Có ảnh 50px không mang hậu tố kích thước. Ưu tiên kho MinIO và dữ liệu đã kiểm; không phụ thuộc bản export WordPress cục bộ đã bị xóa vĩnh viễn theo `AGENTS.md` §3.5.
- Script `scripts/ops/migrate-product-images.py` hiện nhập URL WordPress được chỉ định về kho, không tự đối chiếu ảnh nhỏ đã nằm trong `/media/` với bản lớn; đổi script này không tự sửa các tham chiếu hiện tại.
- Không chọn ảnh lớn khác màu thay cho lựa chọn đang bán; không phóng ảnh thumbnail để coi là đã có bản gốc. Có tên file gần giống mới là ứng viên, cần xác minh nội dung trước khi gán.
- 800×800 có thể là mục tiêu chất lượng của shop, không phải ngưỡng Google được dẫn trong phiếu. Google thông báo tối thiểu 500×500 cho mọi sản phẩm từ **31/01/2027**, khuyến nghị khoảng 1.500×1.500 trở lên. Nguồn: [quy định ảnh](https://support.google.com/merchants/answer/6324350?hl=en). Ảnh BK088 1.500×631 cũng cho thấy cần giữ tỷ lệ, không mặc định mọi ảnh gốc phải vuông.
- Bổ sung kiểm watermark/logo chèn và đúng hình hàng: đây là rủi ro đã ghi tại `GMC_SETUP.md` ngày 07/09 và cũng nằm trong quy định Google.
- **Trạng thái:** Xác minh lỗi ảnh và bốn file lớn; chưa gán/thay ảnh, chưa lập xong danh sách mọi mã không còn ảnh gốc.

### F5 — High: cần đối chiếu giá sale và mã hàng đã đổi, không mặc định sửa cách lấy giá

- **Đã có:** `feed.ts:133` dùng giá lựa chọn; dòng 167 dùng Còn/Hết lựa chọn; dòng 178–179 xuất `price` niêm yết và `sale_price` khi hợp lệ, cùng `derivePricing` của web. Phù hợp `PRODUCT_RULE_012`/`013`, `STOCK_RULE_005`/`006`.
- **Spirit:** lựa chọn `wp-var-39315`, SKU `SPIRIT-XANHOM-36` đang có niêm yết 2.500.000đ, sale 290.000đ, còn hàng. URL có query này trả 200, dữ liệu HTML cho Google báo giá 290.000đ. Cần shop xác nhận mức sale thật và đối chiếu `sale_price` trong nguồn Google cũ; chỉ nhìn `price=2500000` chưa đủ kết luận bộ xuất giá sai.
- **LS2 FF901 XS:** cùng ID `var_97a13dab38974c5cbf99f2317528d107` hiện mang SKU `MLH-LS2-FF901X-SOLID-13990000XS`, khác mã `MLH-LS2-FF901X-SOLID-XS` trong phiếu. Lựa chọn S cũng có SKU `MLH-LS2-FF901X-SOLI11900000D-S`. Cần đối chiếu mã thật với shop, không tự đổi vì mã lạ. ID ổn định nhưng SKU đổi sẽ đổi `g:id` theo hợp đồng hiện tại.
- **Trang đích:** FF901 XS và Givi EA145 hiện đều 200, không redirect. Điều đó không chứng minh Google chưa từng gặp lỗi.
- **Chỉnh nghiệm thu:** so dữ liệu mới của từng lựa chọn giữa backend, XML, HTML ban đầu và dữ liệu Google đã xử lý; theo dõi thêm một lần lấy định kỳ. Không hứa toàn bộ cảnh báo cũ biến mất ngay sau một lần bấm lấy; [Google có cơ chế tự cập nhật riêng](https://support.google.com/merchants/answer/12157888?hl=en).
- **Trạng thái:** Đã đối chiếu mẫu thật; chưa thay giá/SKU hoặc xác minh kết quả GMC.

### F6 — Medium: phân biệt thiếu dữ liệu với tính năng xuất đã có

| Yêu cầu | Hiện trạng BigBike | Điều chỉnh công việc |
| --- | --- | --- |
| Thương hiệu | Feed đã xuất từ dữ liệu sản phẩm; hiện 7 dòng thuộc 2 sản phẩm không có brand | Bổ sung thương hiệu có căn cứ cho D3O và áo lót thun lạnh; không chỉ 2 mã D3O trong phiếu |
| Hai tên viết hoa toàn bộ | QL-HBM và TTSLA vẫn đang viết hoa | Sửa tên lưu trong admin; giữ đúng tên thương hiệu/mã model |
| Ảnh phụ | Đã hỗ trợ tối đa 10, bỏ trùng, ưu tiên gallery lựa chọn rồi gallery cha | Rà dữ liệu và chất lượng; 348 dòng dự kiến hiện không có ảnh phụ theo cách xuất, không mặc định là lỗi chương trình hoặc cần tạo đủ 10 |
| Google product category | Chưa xuất, chưa có ánh xạ Google trong luồng này | Đầu việc bổ sung, dùng bảng ánh xạ được rà; `2110` đúng cho mũ bảo hiểm xe máy theo [taxonomy Google](https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt). [Thuộc tính này là tùy chọn](https://support.google.com/merchants/answer/6324436?hl=en), không coi thiếu là mọi sản phẩm bị từ chối |
| GTIN/MPN/identifier_exists | Chưa có trường tương ứng trong Product/Variant và luồng nhập sản phẩm đã kiểm | Nếu triển khai phải bổ sung dữ liệu và đường nhập/lưu qua các lớp liên quan, không chỉ thêm thẻ XML |
| Phí vận chuyển | Feed không tự đặt phí theo `GMC_RULE_003` | Shop cấu hình GMC theo chính sách thực tế, giữ phân công trong phiếu |

**Phải sửa câu “không có mã vạch thì `identifier_exists=no`”.** Không biết/chưa nhập mã khác với nhà sản xuất không cấp mã. Chỉ khai `no/false` khi xác minh đúng điều kiện; bổ sung GTIN/MPN thật phù hợp, không dùng SKU nội bộ giả làm mã hãng. Căn cứ `GMC_RULE_003`, `GMC_SETUP.md` và [Google — identifier_exists](https://support.google.com/merchants/answer/6324478?hl=en).

Các số 7/348 ở đây tính trên 1.188 dòng dự kiến hiện tại, không cùng phạm vi/thời điểm với 506/178 mã trong GMC. Không dùng chênh lệch để khẳng định phiếu thống kê sai.

### F7 — Medium: cần bổ sung nghiệm thu tiếp nhận và đối chiếu phạm vi nguồn

- Tài liệu 07/09 ghi nhận Google từng nhận 1.172 SKU/185 sản phẩm; hiện dự kiến 1.188 dòng/214 sản phẩm, còn phiếu mô tả 504/506 mã trong Google. Cần đối chiếu nguồn, kênh Online/Local, ngôn ngữ, thời điểm cập nhật, SKU đã đổi và mã bị loại; không lấy 504 làm tổng hàng phải xuất hoặc kết luận thiếu bao nhiêu hàng bằng phép trừ.
- Các ngày hết hạn 30/10–29/11 cần kiểm từng mã từ GMC. [Google quy định làm mới và hết hạn](https://support.google.com/merchants/answer/6324499?hl=en); Google còn có thể làm mới qua website. Ngày lấy file cuối không luôn bằng ngày làm mới cuối của từng sản phẩm.
- Phần shop: giữ việc logo, lấy ngay, shipping/đổi trả và quyết định Online/Local. Logo vuông SVG/PNG/WebP phù hợp [hướng dẫn Merchant Center](https://support.google.com/merchants/answer/15098801?hl=en).
- Chỉ dọn nguồn cũ sau khi xác nhận quyền sở hữu mã và nguồn chính đã nhận đầy đủ; không tự xóa nguồn/sản phẩm. Nếu shop chọn triển khai Local thì tách thành công việc khác về dữ liệu tại cửa hàng; không coi feed online tự thay thế việc đó.
- Hotline chính của website hiện là `0906 902 404`. Số doanh nghiệp và số CSKH có thể phục vụ hai vai trò; cần đối chiếu cùng vai trò giữa GMC và website, không bắt buộc đổi cả hai thành một số chỉ vì khác nhau.
- **Trạng thái:** Cần kiểm trong GMC khi triển khai/nghiệm thu; chưa thao tác tài khoản Google.

## Thứ tự giao việc đề xuất

1. **Khôi phục ngay:** chốt mã/bản ghi `DRHL-KEWIG-BD-1L`, xử lý theo dữ liệu hàng thật; kiểm feed hoàn chỉnh 200 XML và mã duy nhất. Giữ mốc trước 03/11 nhưng không trì hoãn bước khôi phục để chờ đủ các việc tối ưu.
2. **Ngăn tái diễn:** chốt kiểm tra xung đột mã tại quản trị; bổ sung chẩn đoán/cảnh báo; nếu chọn bản dự phòng thì cập nhật docs trước, quy định độ cũ, làm mới và kiểm thử phục hồi.
3. **Ảnh và dữ liệu cụ thể:** rà ảnh thật cho toàn bộ lựa chọn, gán đúng nguồn lớn trong kho; danh sách thiếu ảnh để shop bổ sung; kiểm Spirit, thương hiệu, tên viết hoa và SKU FF901 đã đổi.
4. **Đường dẫn:** giữ ID thật cả `wp-var-…` và `var_…`, loại hàng ngừng bán; kiểm toàn bộ link của feed sau khôi phục, rồi tách xử lý redirect lịch sử nếu cần.
5. **Google lấy và xử lý:** shop lấy ngay đúng nguồn, kiểm mã nhận/mã loại và lý do; xác minh thêm lần lấy tự động tiếp theo, giá sale/Còn–Hết đúng lựa chọn. Lượt gọi giả UA Googlebot không thay thế lần lấy từ hạ tầng Google thật.
6. **Hoàn thiện sau:** mapping category; dữ liệu GTIN/MPN có căn cứ và các thay đổi admin/backend cần thiết; các cấu hình tài khoản giao cho shop.

## Bằng chứng, lệnh và giới hạn

Bản tóm tắt kết quả: [verification.json](evidence/gmc-ticket-review-2026-10-30/verification.json). File HTML/catalog phục vụ phân tích để ngoài repo tại `/tmp/bigbike-gmc-review-20261030/`; không sao chép khóa hoặc dữ liệu khách hàng/đơn hàng.

Các lệnh đọc chính đã chạy:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}\t{{.Ports}}'
docker logs --timestamps --since 24h bigbike-web 2>&1 | rg 'google-merchant|GMC_'
docker inspect bigbike-web --format 'created={{.Created}} started={{.State.StartedAt}}'
docker exec bigbike-postgres psql -X -U bigbike -d bigbike -v ON_ERROR_STOP=1 \
  -c "BEGIN TRANSACTION READ ONLY; SELECT id,sku,slug,discontinued FROM products WHERE sku IN ('DRHL-KEWIG-BD-1L','DRHL-KEWIG-BD-1S','RSB279','TC-RSB286'); COMMIT;"
```

GET dữ liệu dùng backend BigBike `http://127.0.0.1:8080/api/v1/products?page=1&size=100&sort=createdAt%3Aasc&lang=vi`, đủ ba trang rồi đọc từng detail. Các GET domain công khai, lịch sử redirect và đo file ảnh dùng Python `urllib`, XML parser và Pillow; không gọi thao tác tạo giỏ/đặt hàng/lưu dữ liệu.

- **Đã kiểm:** 3 lượt feed, robots/sitemap, toàn bộ 214 detail, xung đột SKU bằng API và DB độc lập; 8 trang đích gồm 2 đường lịch sử; 25 file ảnh đang gán và 4 file lớn trong kho; bốn mẫu dữ liệu sản phẩm/giá trong HTML ban đầu.
- **Not run:** tìm nạp/xem trạng thái thật trong GMC, kiểm toàn bộ link của một XML thành công, toàn bộ kho ảnh và tất cả nguồn thay thế, thay đổi admin → chờ Google; chưa có feed thành công hoặc quyền công cụ Google trong phạm vi này.
- **Not run:** lint/build/unit/E2E suites; không đổi source, cấu hình hay test. Đây là kiểm tra hệ thống thật và báo cáo tài liệu.
- **Thay đổi trong phiên:** chỉ thêm báo cáo này và tóm tắt bằng chứng. Không restart/deploy, ghi DB, sửa ảnh, sửa `.env`, commit/push hoặc thao tác tài khoản Google.

---

## Thực thi tiếp nối ngày 30/10/2026 — đã khôi phục feed production; theo dõi chưa triển khai

### Phạm vi và quyết định trong phiên

Luồng còn sống thuộc Catalog/SEO công khai và Catalog admin trong `MODULE_CATALOG.md`: quản trị sửa sản phẩm/lựa chọn → backend trả dữ liệu công khai → web dựng XML → Google mở đúng trang/lựa chọn. Đã đối chiếu `ProductDetailScreen.jsx`, backend `CatalogRequestValidator.validateVariantSkuUniqueness`, public API và `lib/merchant/{catalog,feed}.ts`. Backend hiện kiểm trùng giữa các lựa chọn; SKU cha không có ràng buộc duy nhất. Vì thế xung đột sản phẩm đơn với lựa chọn vẫn có thể xảy ra mà không vi phạm `PRODUCT_RULE_SKU_001`. Không thêm điều kiện lưu/đăng mới khi chưa chốt quy tắc.

Owner giao quyết định hợp lý trong phiên:

- Chọn giữ SKU `DRHL-KEWIG-BD-1L` ở lựa chọn **90 cm** của trang hai cỡ; đề xuất đưa sản phẩm đơn `prod_c3340fe3669f40e38c9fca236653f07f` về Nháp và tạo 301 từ URL sản phẩm đơn sang `/product/day-thun-rang-non-bao-hiem-hanh-ly-kewig-bd-1s/?variant=var_2a9de4e6a23c47e7b38f87c686875622`. Căn cứ hai bản ghi cùng mô tả 90 cm, cùng giá 145.000đ, cùng Còn hàng; trang hai cỡ có đầy đủ nội dung và ảnh hơn. Đây là quyết định vận hành dựa dữ liệu, chưa là xác nhận hàng vật lý. **Đã hỏi duyệt riêng đúng thao tác ghi production; chưa thực hiện khi chưa nhận duyệt cụ thể.**
- Giữ SPIRIT sale 290.000đ và SKU FF901 hiện tại trong lần khôi phục. Dữ liệu web/backend khớp; chưa có chứng từ để đổi giá hoặc mã. Không diễn giải việc giữ nguyên thành xác nhận giá nhà cung cấp/mã chuẩn từ shop.
- Tiếp tục dữ liệu mới hoặc 503 (`GMC_RULE_005`), chưa triển khai feed cũ dự phòng. Owner phụ trách nhận kết quả tại VPS; đề xuất kiểm mỗi 5 phút, chưa cài lịch hoặc gửi ra ngoài. Quyết định này tránh phục vụ giá/tình trạng hàng cũ khi nguồn lỗi.

### Kiểm chứng production mới

Bằng chứng mới tách khỏi ảnh chụp lần trước: [gmc-repair-2026-10-30](evidence/gmc-repair-2026-10-30/summary.json).

- `docker ps --format '{{.Names}} {{.Status}} {{.Ports}}'`: web, backend, PostgreSQL, MinIO đang chạy. Không bật/tắt/restart container.
- `curl --max-time 30` tới domain và `127.0.0.1:3000/google-merchant.xml`: **503**, lần lượt **4,440s / 3,602s**. `docker logs --since 10m --tail 100 bigbike-web` xác nhận `GMC_SKU_DUPLICATE`. `docker exec bigbike-web printenv BIGBIKE_API_BASE_URL` chỉ đọc đúng biến này, giá trị `http://bigbike-backend:8080`.
- GET ba trang `/api/v1/products?page=N&size=100&sort=createdAt:asc&lang=vi` và toàn bộ detail tại backend `127.0.0.1:8080`: **214 sản phẩm**, dự kiến **1.188 dòng**, **1.187 SKU duy nhất**. DB kiểm độc lập bằng `docker exec bigbike-postgres psql -X -U bigbike -d bigbike` với `BEGIN TRANSACTION READ ONLY`, SELECT đúng hai product ID và variant SKU: vẫn cùng xung đột cũ.
- Chạy chính `buildMerchantFeed` trên dữ liệu vừa đọc: hiện trạng ném `GMC_SKU_DUPLICATE`. Chỉ đổi trạng thái sản phẩm đơn thành DRAFT **trong bộ nhớ**, không ghi DB: dựng được XML **213 sản phẩm / 1.187 dòng**, parser XML, mã duy nhất và hai số đếm đều đạt. [Kết quả mô phỏng](evidence/gmc-repair-2026-10-30/proposed-validation.json). Không phải HTTP production hoặc số Google nhận.
- [Ba HTML ban đầu](evidence/gmc-repair-2026-10-30/landing.json), đọc tại origin đang chạy: SPIRIT `wp-var-39315` khớp `price=2500000 VND`, `sale_price=290000 VND`, giá HTML 290.000đ, Còn hàng. FF901 XS `var_97a13dab38974c5cbf99f2317528d107` khớp mã hiện tại, 13.990.000đ, Hết hàng. Kewig lựa chọn 90 cm khớp SKU, 145.000đ, Còn hàng và URL lựa chọn. Giữ cả tiền tố `wp-var-` và `var_` thực tế; không đổi ID.
- Vẫn **7 dòng thiếu thương hiệu**, **348 dòng không có ảnh phụ**; không thêm thương hiệu/ảnh giả hoặc yêu cầu đủ 10 ảnh.
- [Hai URL lịch sử RSB279/RSB286](evidence/gmc-repair-2026-10-30/history.json) vẫn 301 sang `/product/` rồi 404. Giữ ngừng bán và loại khỏi feed. Chưa có căn cứ đích thay thế nên không thêm 301 cho hai mặt hàng này; xử lý trang lịch sử là việc riêng sau khôi phục.

### Ảnh — đã đo file thật, chưa gán dữ liệu

Đã đọc **344 URL ảnh chính khác nhau**, thành công 344/344 tại web origin, đo bằng Pillow thay vì suy luận hậu tố. Chuẩn hóa đường media theo `resolveMediaUrl`: nguồn cũ có `/wp-uploads/` dùng `/wp-content/uploads/`. Đây là dữ liệu đã nằm trong kho hiện hữu, không tái tạo export WordPress. Truy cập ảnh tự động trực tiếp domain bằng Python nhận 403; kết quả nội bộ **không chứng minh Googlebot thật tải được ảnh**.

- **26 ảnh** có ít nhất một chiều dưới 500 px, ảnh hưởng **103 dòng**; trong đó **15 ảnh / 69 dòng** có ít nhất một chiều dưới 100 px. Đây là số đo, chưa phân loại mọi mã theo nhóm quần áo Google.
- [Toàn bộ số đo](evidence/gmc-repair-2026-10-30/images.json), [103 dòng cần rà ảnh](evidence/gmc-repair-2026-10-30/images-needing-review.csv). Các dòng “cần tìm” nghĩa chưa xác minh được nguồn sạch, đúng mẫu/màu; không khẳng định trong kho chắc chắn không tồn tại ảnh đó.
- Bốn nguồn lớn được tải và đo lại: Caberg trắng **1176×1176**, ILM Z302 đen nhám **1176×1176**, BK088 đen **1500×631**, FF800 xanh lá **1080×1080**. [Bằng chứng kích thước](evidence/gmc-repair-2026-10-30/candidates.json).
- So ảnh trực quan: Caberg trắng, ILM và FF800 nguồn lớn có logo BigBike chèn; ILM/FF800 còn watermark trên sản phẩm. Không gán các nguồn này như ảnh đã đạt chuẩn Google. BK088 nguồn lớn đúng giày đen, chưa thấy logo chèn trong ảnh đã kiểm; chỉ đề xuất cho SKU `BK088-DEN-*`, không gán sang `BK088-XAM2-*`. Mã xám đang chung ảnh đen cần shop đối chiếu màu hàng thật.
- SELECT chỉ đọc bảng `media` (ACTIVE, width/height ≥500, tên chứa các mẫu đang rà) tìm thêm **88 ứng viên**, lưu [danh sách kho](evidence/gmc-repair-2026-10-30/library-candidates.json). Kích thước ở danh sách ứng viên là metadata DB, **chưa tải/đánh giá trực quan đủ 88 ảnh**; không tự gán dựa tên file. Không coi việc phát hiện ứng viên là đã sửa ảnh.
- Kiểm lại Google ngày 30/10: [image_link](https://support.google.com/merchants/answer/6324350?hl=en) cấm logo/watermark chèn, khuyến nghị 1500×1500 trở lên. [Image too small](https://support.google.com/merchants/answer/12159030?hl=en) nêu trước **31/01/2027** còn chấp nhận tối thiểu 100×100 với hàng ngoài quần áo, **250×250 với quần áo**; từ ngày đó áp dụng **500×500** cho mọi sản phẩm, đã cảnh báo ảnh dưới 500 từ tháng 7/2026. 500 là mục tiêu chuẩn bị tiêu chuẩn mới, 1500 là khuyến nghị chất lượng; không báo mọi ảnh <500 là đã vi phạm ngưỡng hiện tại. 50×50/50×21 chắc chắn dưới cả hai ngưỡng hiện hành; không phóng to thumbnail để đạt số đo.
- [identifier_exists](https://support.google.com/merchants/answer/6324478?hl=en): chỉ khai no khi chắc chắn mặt hàng không được cấp định danh, không vì shop chưa nhập. Chưa thêm GTIN/MPN/category khi chưa có dữ liệu/ánh xạ kiểm chứng; 2110 không tự áp toàn bộ catalog.

### Phần nguồn đã sửa và căn cứ

Docs đi trước source; không đổi quy tắc kinh doanh:

| File | Thay đổi |
|---|---|
| `docs/engineering/API_CONTRACT.md` §Google Merchant product feed | Bổ sung header UTC thời điểm dựng xong XML, chỉ trên thành công |
| `docs/engineering/GMC_SETUP.md` | Công cụ kiểm tra, ý nghĩa tuổi XML, giới hạn và lựa chọn vận hành |
| `bigbike-web/app/google-merchant.xml/route.ts` | `X-Merchant-Generated-At` sau khi đọc nguồn mới và dựng đầy đủ; giữ 503 và chốt trùng |
| `bigbike-web/__tests__/merchant/route.test.ts` | Kiểm header thành công/HEAD và không có trên 503 |
| `bigbike-web/__tests__/merchant/feed.test.ts` | Hồi quy đúng kiểu xung đột sản phẩm đơn với lựa chọn, cả hai thứ tự; DRAFT bị loại đúng rule |
| `scripts/check-google-merchant.py` | Probe GET chỉ đọc: HTTP, XML, số sản phẩm/dòng so header, SKU trùng/thiếu/dài, trường chính, thời gian <30s, tuổi XML, bản rỗng cần xác nhận độc lập; JSON + exit code, không gửi tin |
| `scripts/tests/test_google_merchant_check.py` | Kiểm XML lỗi/phục hồi, timestamp thiếu/cũ/tương lai, mã trùng, lệch số dòng, nhóm và rỗng |

Căn cứ `BUSINESS_RULES.md` `GMC_RULE_001`–`005`, `PRODUCT_RULE_SKU_001`, `PRODUCT_RULE_012`/`013`, `STOCK_RULE_005`/`006`; `DATA_CONTRACT.md` §Google Merchant feed projection và Product discontinued flag. Tuổi header là tuổi **bản dựng**, không thay thế tuổi dữ liệu DB; hiện mỗi lần dựng đọc no-store, chưa có snapshot. Probe chỉ kiểm nhất quán số dòng và cấu trúc, không tự chứng minh toàn catalog đầy đủ nếu không đối chiếu độc lập.

### Kiểm thử và trạng thái bàn giao

- `npm run lint` (web): **đạt**, gồm guard dữ liệu runtime và ESLint; đã chạy Prettier riêng ba file source/test thay đổi.
- `npx vitest run __tests__/merchant --maxWorkers=2`: **5 file / 21 bài đạt**.
- `python3 -m unittest discover -s scripts/tests -p test_google_merchant_check.py`: **4 bài đạt**.
- Probe trên URL công khai: **phát hiện HTTP 503 đúng**, exit 1; chưa thể xanh trên production.
- `bash deploy/nginx/tests/domain-boundary-config-test.sh --self-test`: **đạt kiểm dương và hai kiểm âm**.
- `npm run test` toàn web: **768/770 đạt**, hai bài audit ngôn ngữ quá timeout 5 giây khi chạy đồng thời build/lint; chạy lại riêng hai file với `--maxWorkers=1`: **2 file / 9 bài đạt**, exit 0. Kết quả này không đổi lần chạy toàn bộ ban đầu thành pass. Không sửa công việc ngôn ngữ/analytics/review-link có sẵn.
- `npm run build`: **đạt**, TypeScript đạt và dựng xong các route; exit 0. Đây là build workspace có thay đổi sẵn, chưa phải image triển khai đã duyệt.
- E2E toàn feed `e2e/google-merchant.e2e.ts`: lúc nguồn 503 chưa chạy; sau khôi phục đã chạy production. Ba bài còn hàng tại 375/768/1440 đạt. Bài hết hàng trượt lần đầu vì origin localhost gọi API production, **đạt khi chạy riêng với `PW_BASE_URL=https://bigbike.vn GMC_PREVIEW_ORIGIN=http://localhost:3000`**, 1 bài/28,1 giây. Không tắt chốt console hoặc sửa CORS để đạt bài kiểm. Quét mọi link/ảnh cập nhật phía dưới.
- Hygiene UI/CSS: **không áp dụng**, không sửa UI, bản dịch hoặc CSS. Backend/admin suites: **Not run**, không sửa source hai app.
- Chưa commit/push, sửa `.env`, ảnh, restart, deploy mã nguồn hoặc tài khoản Google. Đã thay đổi đúng dữ liệu/redirect sau duyệt, qua API chuẩn (xem kết quả cuối). Giữ nguyên các thay đổi analytics/review link/SEO có sẵn.

### Phương án production để owner duyệt

1. **Khôi phục dữ liệu trước, không cần deploy web**: qua hành động publish chính thức, `PATCH /api/v1/admin/products/prod_c3340fe3669f40e38c9fca236653f07f/publish` body `{"publishStatus":"DRAFT"}`; quyền `products.update`. Kiểm lại trước ghi rằng ID/SKU/trạng thái và lựa chọn 90 cm vẫn đúng ảnh chụp. Tạo redirect quản trị 301 từ `/product/day-thun-rang-hang-kewig-bd-1l/` sang URL lựa chọn 90 cm đã GET/kiểm giá ở trên; đọc registry trước để tránh ghi đè. Chỉ thao tác sau duyệt cụ thể, không thay bằng SQL bỏ qua nghiệp vụ. Nếu thiếu quyền đăng nhập sẽ báo shop thao tác đúng bản ghi, không tự chiếm phiên đăng nhập.
2. Lấy lại feed công khai và origin, đếm theo dữ liệu mới, kiểm đầy đủ/duy nhất, HTTP/content-type/XML/<30s; kiểm mọi link và ảnh cùng lựa chọn, giá sale và Còn/Hết trong HTML đầu. Chưa lấy ngay Google cho tới khi xác nhận feed đúng. Không coi số mô phỏng là số cố định phải đạt.
3. Hoàn tác nếu cần: đưa bản ghi đơn về PUBLISHED bằng thao tác chuẩn và gỡ đúng redirect mới tạo; lưu ý việc khôi phục bản ghi trùng sẽ làm feed lỗi lại. Không phục hồi bằng feed thiếu hàng. Nên giữ lựa chọn đúng và sửa quyết định dữ liệu có căn cứ nếu phát hiện hàng vật lý khác.
4. **Theo dõi triển khai riêng**: chưa build Docker image hoặc recreate service. Trước triển khai header mới cần rà phạm vi công việc có sẵn với owner, giữ image đang chạy để hoàn tác, build riêng web theo `.env.vps` hiện hành (đã kiểm label container), không đổi env hoặc service khác. Chỉ sau duyệt mới build/nạp image. Kiểm đúng image mới, feed công khai và probe tuổi dữ liệu; không triển khai lẫn các thay đổi sẵn khi chưa được duyệt. Trước nạp header, probe sẽ báo thiếu timestamp nếu feed đã khôi phục — đây là thiếu phần theo dõi, không kết luận XML hỏng.
5. Sau nguồn 200 đã kiểm đầy đủ, shop bấm **Tìm nạp ngay** đúng **PRODUCTS SOURCE 3**, xem kết quả tiếp nhận/xử lý/lỗi và theo dõi thêm lần lấy tự động. **Chưa có quyền GMC**, không tuyên bố Google đã nhận hay duyệt. Shop giữ phụ trách logo, shipping/đổi trả, Local, điện thoại theo vai trò và dọn nguồn cũ.

Phần còn cần duyệt/quyền: thao tác dữ liệu/301 nêu trên; gán ảnh BK088 đen theo danh sách sau khi duyệt cụ thể; ảnh sạch đúng mẫu/màu cho các mã còn lại; quyết định quy tắc chặn xung đột mã ở quản trị nếu muốn thêm; triển khai header/lịch kiểm và kênh cảnh báo nếu muốn gửi ra ngoài. Không có thay đổi dữ liệu nào được coi là đã duyệt chỉ từ mô phỏng.


### Cập nhật sau owner duyệt — feed đã khôi phục trên production

Owner đã chọn **Duyệt phương án này** cho đúng thao tác Nháp và 301. Đã thực hiện qua API quản trị chính thức, không ghi SQL, không sửa mã nguồn đang chạy:

- Xác thực bằng tài khoản SUPER_ADMIN đã được cung cấp trong fixture E2E của repo; token chỉ giữ trong bộ nhớ, không ghi vào bằng chứng/log. Một lần thử thông tin seed cấu hình trả 401 trước đó; không thay mật khẩu hoặc bỏ qua xác thực.
- Đọc lại hai bản ghi, xác nhận giá/availability và không có redirect nguồn trùng trước ghi.
- Tạo 301 quản trị ID `9aafaaa6-e93a-46ea-a5cd-f5bf75b201e9`, nguồn `/product/day-thun-rang-hang-kewig-bd-1l/`, đích lựa chọn 90 cm đã duyệt.
- PATCH publish đúng product ID sang `DRAFT`; đọc DB trong transaction READ ONLY xác nhận sản phẩm đơn DRAFT, cha hai cỡ PUBLISHED, lựa chọn 90 cm giữ SKU và Còn hàng. [Kết quả thao tác](evidence/gmc-repair-2026-10-30/restore-result.json).
- Feed công khai **200 application/xml trong 5,333 giây**, origin **200 trong 4,463 giây**; XML parse được, **213 sản phẩm / 1.187 dòng / 1.187 mã duy nhất**, mã Kewig 90 cm xuất đúng một lần. Redirect công khai trả **301** đúng URL lựa chọn. [Bằng chứng HTTP](evidence/gmc-repair-2026-10-30/http-restored.json).
- Quét ba luồng đọc HTML đồng thời với trình duyệt trên VPS gây chậm: một probe timeout 30 giây, log web có `NoFallbackError` và lỗi stream; đã dừng toàn bộ tiến trình quét/trình duyệt do phiên tạo, không kill/restart dịch vụ. Sau dừng, kiểm lại feed công khai **200 XML trong 6,783 giây**. Chưa khẳng định ổn định dưới tải; đây là giới hạn nghiệm thu cần theo dõi.
- E2E lần đầu origin localhost: ba bài còn hàng ở 375/768/1440 đạt; bài hết hàng kiểm đúng HTML/lựa chọn/giá nhưng trượt ở chốt console do trình duyệt localhost gọi API production bị CORS. Không sửa CORS production cho môi trường thử. Lượt chạy với origin browser thật + chuyển tiếp transport theo helper đã có bị dừng trong lúc VPS chậm, không ghi là đạt. Lượt kiểm hết hàng riêng và quét tuần tự được ghi kết quả cuối khi hoàn tất.
- Mã nguồn header theo dõi vẫn **chưa deploy**, chưa cài cron hoặc kênh cảnh báo; không thay đổi `.env`. Vì vậy probe yêu cầu timestamp sẽ chưa thể đạt đầy đủ trên bản production cũ. Khôi phục dữ liệu không cần restart/deploy.

Các mô tả “chờ duyệt/chưa ghi” ở phần chuẩn bị phía trên là lịch sử trước quyết định này. Chưa có quyền GMC hoặc lần fetch Google thật; không tuyên bố Google đã nhận/duyệt.

- Lượt E2E hết hàng riêng với origin browser production **đạt 1/1 trong 28,1 giây**. Probe sau giảm tải đọc **200 / 213 sản phẩm / 1.187 dòng** trong **10,860 giây**, chỉ báo `GENERATED_AT_MISSING_OR_INVALID` đúng với header chưa deploy. [Probe production](evidence/gmc-repair-2026-10-30/probe-restored.json).


### Nghiệm thu cuối phiên — kết quả hiện hành

[Kết quả cuối](evidence/gmc-repair-2026-10-30/final-status.json), [kiểm toàn bộ nguồn](evidence/gmc-repair-2026-10-30/acceptance.json), [chi tiết từng link](evidence/gmc-repair-2026-10-30/all-links-refined.json), [chi tiết từng ảnh](evidence/gmc-repair-2026-10-30/all-feed-images.json), [các kiểm tra source](evidence/gmc-repair-2026-10-30/checks.json).

- **Production đã khôi phục**, lần GET công khai cuối **200 application/xml trong 6,498 giây**, XML hợp lệ, **213 sản phẩm / 1.187 dòng / 1.187 SKU duy nhất**. Catalog công khai đọc độc lập sau xử lý cũng có **213 sản phẩm**. Giữ hàng hết ở `out_of_stock`, các ID thật và mọi điều kiện `GMC_RULE_002`–`005`; không bỏ chốt trùng, không lọc bỏ lỗi để tạo HTTP 200.
- **Kiểm đủ 1.187 link bằng GET origin production**, có khoảng nghỉ và một luồng: tất cả HTTP 200, JSON-LD trong HTML đầu chứa đúng SKU lựa chọn, giá bán/sale và Còn/Hết; URL lựa chọn và ảnh hiển thị được đối chiếu. Không thay bằng dữ liệu mock. Tổng lượt kiểm link + ảnh khoảng 18 phút. Đây không phải lượt Googlebot thật hoặc chứng nhận tải dưới mọi mức tải.
- **912 URL ảnh chính/phụ** trong XML tải được tại origin production và mở được định dạng/kích thước ảnh. Không đồng nghĩa tất cả đạt chính sách Google: còn ảnh nhỏ, sai màu hoặc logo/watermark cần sửa theo danh sách. Chưa kiểm khả năng tải thật từ Google qua Cloudflare cho đủ 912 ảnh.
- So URL ảnh theo chuỗi thô phát hiện 30 khác biệt: **27** quy về cùng khóa ảnh MinIO qua đường cũ/mới; **3 SKU ALTL** có ảnh tương ứng trong thẻ `img` của HTML đầu nhưng Product JSON-LD không có trường ảnh. [Phân loại](evidence/gmc-repair-2026-10-30/landing-refined-summary.json). Không gọi 30 khác biệt này là 30 link ảnh hỏng. Ba SKU ALTL vẫn cần rà nội dung ảnh cho đúng loại Áo/Quần; chưa sửa dữ liệu hoặc mở rộng công việc SEO có sẵn.
- `robots.txt` **200**, `sitemap.xml` **200**, hiện **784 URL**; không còn URL VI sản phẩm đơn BD-1L. Không ép số đếm theo ảnh chụp trước. Hai sản phẩm RSB279/RSB286 vẫn ngừng bán; URL lịch sử đã ghi riêng, không mở bán lại.
- Source bổ sung timestamp/probe đã kiểm thử và build; **chưa deploy image web, chưa restart dịch vụ, chưa cài cron/cảnh báo ngoài**. Sự cố chậm khi quét đồng thời đã ghi rõ; lần kiểm cuối giảm tải đáp ứng dưới 30 giây. Không suy ra rủi ro tải đã được sửa bằng việc đổi dữ liệu.
- **Chưa gán ảnh production.** Đã hỏi duyệt riêng đúng 10 mã BK088 đen 36–45; chưa có câu trả lời tại lúc chốt báo cáo. [Phương án cụ thể](evidence/gmc-repair-2026-10-30/proposed-bk088-image-changes.json). Các mã xám không nằm trong phương án đó. Các ảnh mũ có logo/watermark cần nguồn sạch, không tự dùng AI/xóa logo hoặc phóng thumbnail.
- Chưa đổi hai tên viết hoa QL-HBM/TTSLA, 7 thương hiệu thiếu, giá SPIRIT hay SKU FF901. FF901 S đang là `MLH-LS2-FF901X-SOLI11900000D-S`; giữ nguyên cùng XS theo quyết định bảo toàn định danh, chưa coi đây là mã đã xác minh từ chứng từ. Chưa bổ sung ánh xạ Google category hoặc đường nhập/lưu GTIN/MPN; không tự khai `identifier_exists=no`.
- Chưa bổ sung điều kiện chặn lưu/đăng khi SKU sản phẩm đơn trùng SKU lựa chọn: cần owner chốt rule phạm vi dòng thực xuất trước; không áp uniqueness cho mọi SKU cha. Probe đã chuẩn bị giúp phát hiện nguồn lỗi, nhưng giám sát định kỳ chưa hoạt động khi chưa duyệt triển khai/lịch/kênh.
- 301 đã duyệt và kiểm là **URL VI** dùng trong feed; chưa mở rộng sang URL EN lịch sử hoặc các đường `/sp/` khác. Đây là phần SEO còn cần rà, không cản việc nguồn VI đã khôi phục.
- Không còn tiến trình quét/trình duyệt của phiên đang chạy. Không commit/push; giữ nguyên phần công việc có sẵn. Những thông tin “chuẩn bị/chưa ghi” trong phần trước là lịch sử trước lượt owner duyệt, được kết quả hiện hành này thay thế.

**Bàn giao shop:** bấm **Tìm nạp ngay** đúng **PRODUCTS SOURCE 3**, đối chiếu số Google nhận/xử lý và lỗi từng mã, kiểm thêm lần lấy tự động kế tiếp. Phiên không có connector/quyền GMC nên **chưa xác minh Google tiếp nhận, xử lý hoặc duyệt**. Không tự đổi tài khoản, xóa nguồn/sản phẩm, logo, shipping/đổi trả, Local hoặc số điện thoại.

### Kiểm tra tiếp theo — 30/10/2026 17:20 ICT

- `docker ps` xác nhận web, backend, PostgreSQL và MinIO đang chạy. Không thao tác ghi hay khởi động lại container.
- GET tên miền bằng curl User-Agent `Mozilla/5.0`: HTTP 200, XML, 19,193 giây; 213 sản phẩm, 1.187 dòng và 1.187 mã duy nhất, 996 còn hàng, 191 hết hàng; 23 dòng có giá sale, không có dòng thiếu giá. GET origin trước đó: 200, 5,715 giây, cùng số lượng. Hai lượt không phải lấy đồng thời hoặc bằng chứng Google đã lấy.
- GET tên miền bằng Python urllib User-Agent mặc định nhận HTTP 403 trong 0,137 giây; chưa xác định nguồn chặn hay khả năng truy cập của Googlebot. Cần kiểm tra từ tài khoản Google và cấu hình bảo vệ, không kết luận lỗi feed hoặc tự đổi cấu hình.
- Công cụ giám sát origin trả HTTP 200 nhưng báo `GENERATED_AT_MISSING_OR_INVALID` sau 8,082 giây: header thời điểm dựng trong source vẫn chưa lên production. Các test probe 4/4 và test feed/route 10/10 đạt. Chưa cài lịch, gửi cảnh báo hoặc triển khai; đề xuất sau duyệt chạy 5 phút/lần, ghi JSON trên VPS cho chủ shop xem theo `GMC_SETUP.md`; hiện không có kênh báo ngoài. Probe không tự xác minh danh mục đầy đủ độc lập.
- Đối chiếu 103 dòng trong `images-needing-review.csv` với ảnh chính trong XML hiện tại: tất cả vẫn cùng đường ảnh. Đây là đối chiếu đường dẫn, chưa tải lại và kiểm kích thước/ảnh từng dòng. Phương án BK088 đen vẫn chỉ là ứng viên 1500×631 cho 10 cỡ 36–45; ảnh cũ 50×21, đang chờ kiểm duyệt và duyệt ghi. Ảnh xám cần đúng màu. Không ghi ảnh production. Những ảnh còn thiếu nguồn sạch xem bảng bằng chứng hiện có; chưa hoàn thành tìm thêm ảnh MinIO.
- Bảy dòng thiếu thương hiệu vẫn là ALTL-MAO, ALTL-5FDUAL, ALTL-QUAN, D30VT-COMBO3, D30VT-LUNG, D30VT-TAY, D30VT-VAI. Tên hàng không đủ chứng minh thương hiệu; chưa bổ sung. Chưa hoàn thành rà ánh xạ danh mục Google hoặc xác minh mã hãng.
- Nguồn vẫn chặn trùng SKU giữa các dòng thực xuất theo `GMC_RULE_005`. Chưa thêm chặn lúc lưu/đăng; đã hỏi owner chốt phạm vi. Không thay giá, tình trạng, đường dẫn, hay định danh.
- Chưa kiểm lại mẫu trang giá sale/hết hàng và từng ảnh thực tế trong lượt này; kiểm toàn bộ của phiên trước chỉ là bằng chứng lịch sử. Chưa xác minh Google tiếp nhận hoặc duyệt. Chưa thay đổi source hay dữ liệu production trong lượt này.

### Quyết định owner — chặn trùng mã khi lưu hoặc xuất bản

Ngày 30/10/2026 owner đồng ý chặn khi mã sản phẩm đơn trùng mã lựa chọn khác cùng xuất hiện trong nguồn Google; phạm vi là các dòng thực xuất, không áp duy nhất cho mọi SKU cha. Cần thực hiện tại máy chủ cho cả lưu sản phẩm đang công khai và xuất bản, kể cả đường nhập sản phẩm dùng chung; đối chiếu điều kiện `PUBLISHED`, không ngừng bán và noindex VI. Cần xử lý cả hai phía sản phẩm đơn/lựa chọn, các sản phẩm đơn trùng nhau, cập nhật trạng thái/noindex và các thao tác đồng thời. Chưa thay đổi quy tắc canonical, code hay triển khai trong lượt ghi nhận này; cần hoàn tất thiết kế khóa đồng thời và kiểm thử trước khi coi việc chặn có hiệu lực. Feed tiếp tục trả 503 khi phát hiện trùng.

### Đối chiếu tệp shop gửi lúc 17:29 ICT

Tệp Drive `sản_phẩm_2026-10-30_17-29-03_.zip` chứa một TSV xuất danh sách Google: 506 dòng, 506 ID khác nhau; 504 dòng kênh trực tuyến và 2 dòng kênh địa phương. Đây là ảnh chụp danh sách, không có cột kết quả phê duyệt hay lý do từ chối. So với XML origin kiểm lúc khoảng 17:20 cùng ngày: 474 ID xuất hiện ở cả hai, 32 ID trong tệp không có trong XML, 713 ID XML không có trong tệp. Khác biệt thời điểm và phạm vi nguồn/kênh có thể ảnh hưởng; không suy ra 32 mã đều hỏng hay nên xóa. Danh sách cũ có 4 dòng không ghi nhãn hiệu; không đồng nhất với 7 dòng thiếu thương hiệu ở XML hiện tại. Tệp không chứng minh Google đã tìm nạp hay duyệt XML mới. Không nhập, xóa hoặc thay đổi sản phẩm.
