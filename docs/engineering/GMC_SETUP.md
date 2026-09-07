# Kết nối BigBike với Google Merchant Center

## Kết quả mong đợi

Nhân viên đăng/sửa sản phẩm, giá và trạng thái Còn/Hết tại BigBike. GMC lấy nguồn `https://bigbike.vn/google-merchant.xml` theo lịch đã cấu hình; không nhập lại từng sản phẩm hoặc tải file thủ công. Nguồn chứa từng lựa chọn bán hàng (biến thể) với SKU, giá, ảnh và đường dẫn chọn sẵn tương ứng. Quy tắc: `GMC_RULE_001`–`005`.

**Trạng thái 07/09/2026: nguồn đã triển khai trên VPS tại `https://bigbike.vn/google-merchant.xml`; đã xác nhận Google tiếp nhận đủ 1.172 SKU của 185 sản phẩm qua bản xuất GMC lúc 12:30:21 do owner cung cấp. Toàn bộ SKU, giá, Còn/Hết, link, ảnh và nhóm biến thể khớp nguồn XML được lấy lại khi đối chiếu. Chưa xác minh trạng thái duyệt/hiển thị của toàn bộ nguồn mới, cấu hình giờ lấy tự động hoặc lần lấy định kỳ tiếp theo.**

Kết quả kiểm thử, phạm vi và giới hạn: [FEATURE_GMC_IMPLEMENTATION_2026-09-07.md](../audits/FEATURE_GMC_IMPLEMENTATION_2026-09-07.md).

## Thiết lập một lần trong tài khoản GMC của shop

1. Mở đúng tài khoản Merchant Center quản lý BigBike; xác minh và claim website `https://bigbike.vn` nếu chưa làm.
2. Xem **Settings → Data sources** trước. Nếu đã có nguồn tự động/feed/API chứa cùng sản phẩm, kiểm tra SKU và phạm vi để tránh tạo nguồn trùng; không tự xóa sản phẩm hoặc nguồn cũ.
3. Chọn **Add product source → Add products from a file → Enter a link to your file**.
4. Nhập `https://bigbike.vn/google-merchant.xml`. Không yêu cầu username/password cho đường feed này.
5. Chọn **Tiếng Việt**, quốc gia bán **Việt Nam**, tiền tệ **VND** khi giao diện hỏi. Đặt lịch lấy tự động hằng ngày theo giờ Việt Nam; có thể chọn lịch khác mà tài khoản hỗ trợ. Google hướng dẫn mặc định lấy mỗi 24 giờ.
6. Chạy **Fetch now / Update** lần đầu. Kiểm tra trạng thái xử lý, tổng sản phẩm/biến thể, SKU và lỗi ở mục Products/Needs attention.
7. Đối chiếu một sản phẩm đơn và một biến thể: tên, ảnh, giá bán, Còn/Hết và lựa chọn được mở đúng từ link Google. Kiểm lại sau một lần sửa thật trong admin và một lần GMC lấy lại nguồn.

Được Google nhận dữ liệu khác với được duyệt hiển thị. Nếu tài khoản yêu cầu GTIN/MPN, nhóm tuổi hoặc thông tin khác, dùng dữ liệu nhà sản xuất có căn cứ; không đặt mã giả hoặc khai `identifier_exists=false` để lách thiếu mã. Cấu hình giao hàng/đổi trả trong GMC theo chính sách thật của shop; feed không tự đặt phí hoặc cam kết giao hàng.

## Kết quả đối chiếu bản xuất GMC 07/09/2026

- Bản xuất có 1.290 dòng: 1.202 mặt hàng Trực tuyến và 88 mặt hàng Địa phương. Trong 1.202 mặt hàng Trực tuyến, đủ 1.172 SKU khớp nguồn XML; còn 30 mã ngoài nguồn XML dùng link cũ `/sp/…html`.
- Cả 1.172 SKU khớp giá, Còn/Hết (1.071 còn, 101 hết), link, ảnh chính, nhóm biến thể, tiêu đề, kích cỡ, màu, nhãn hiệu và giới tính. Bốn SKU khớp nguồn mới (`GCRM103`, `RBP02`, `EA113B`, `GCRM104`) có `update type=merge`; cần kiểm nguồn sở hữu trước khi thay đổi nguồn cũ, không suy ra ý nghĩa thao tác chỉ từ trường này.
- Không có dòng trùng khi đối chiếu đầy đủ kênh + nhãn nguồn + ngôn ngữ + ID. Có 30 ID cùng tồn tại ở kênh Trực tuyến và Địa phương; không coi đây là lỗi trùng sản phẩm chỉ dựa trên ID.
- Tệp xuất không có cột phê duyệt hoặc khả năng hiển thị. Cột `tình trạng` với giá trị `mới` là tình trạng hàng hóa, không phải kết quả Google xét duyệt. Hai lượt nhấp được ghi nhận ở mặt hàng Địa phương; không suy ra lượt hiển thị/quảng cáo của nguồn XML mới từ số này.
- Bước còn lại: xem kết quả duyệt ở GMC, xác nhận lịch lấy tự động, đối chiếu nguồn cũ trước khi dọn và kiểm một lần thay đổi thật trong admin được GMC lấy lại. Chưa sửa/xóa nguồn hoặc dữ liệu trong tài khoản Google.

## Vận hành và xử lý sự cố

- Link nguồn phải trả **200 XML**, không phải HTML trang đăng nhập/challenge. `X-Merchant-Product-Count` là số sản phẩm cha; `X-Merchant-Item-Count` là số dòng gửi Google sau khi tách biến thể.
- Tạm hết hàng: vẫn có trong nguồn với `out_of_stock`. Ngừng bán, về Nháp, vào Thùng rác hoặc tắt hiển thị Google VI: không còn trong nguồn ở lần lấy kế tiếp. Hiệu lực phía Google phụ thuộc lần lấy/xử lý của GMC, không tức thời theo nút admin.
- HTTP 503: nguồn chưa dựng đủ dữ liệu tin cậy. Kiểm backend/catalog/SKU, sau đó lấy lại; không thay lỗi bằng một feed rỗng.
- Cloudflare: nếu GMC báo không lấy được nguồn/ảnh, kiểm Security events cho yêu cầu Google thật và cấu hình cho phép Google đã xác minh. Không tắt bảo vệ toàn website chỉ vì một công cụ thử nhận 403.
- Thiếu mã hàng hoặc SKU trùng (không phân biệt hoa thường), SKU quá 50 ký tự: sửa đúng mã thật trong admin; không tự đổi SKU hàng loạt khi nguồn Google cũ đã dùng các mã đó.
- Nguồn mặc định chứa nội dung VI. Không đăng cùng file thành nguồn EN rồi khai sai ngôn ngữ.

## Kiểm tra kỹ thuật trên VPS

### Dữ liệu cần shop bổ sung (đọc catalog thật 07/09/2026)

- `ao-lot-thun-lanh-mac-trong-giap-moto`: các lựa chọn Áo/Quần/Dual không có cùng bộ thuộc tính kích cỡ. Cần xác nhận và điền thông tin đúng cho từng lựa chọn.
- `ao-giap-moto-mua-he-komine-jk-177-enigma`: SKU `KOM177-V0` đang mang tên “Biến thể 1”, chưa có thuộc tính. Không tự gán size/màu cho mã này.
- `giay-moto-co-cao-ilm-brc1`: sáu mã hàng chỉ có ba giá trị size 41/42/44, chưa có thuộc tính phân biệt hai mã cùng size. Không suy diễn màu từ chữ trong SKU.

Các mã này vẫn được xuất theo dữ liệu thật. Đây là gap dữ liệu để kiểm tra khi Google xử lý/duyệt, không phải bằng chứng tài khoản GMC đã báo lỗi. Chuẩn hóa tên thuộc tính đã xử lý các cách viết `Size`/`Kích cỡ` và `màu sắc`/`Màu sắc` mà không thay đổi dữ liệu admin.

Ảnh mẫu mũ LS2 FF800 Storm đang có watermark `Bigbike.vn` và logo BigBike chèn trong ảnh. [Quy định ảnh của Google](https://support.google.com/merchants/answer/6324350?hl=en) không chấp nhận watermark/logo chèn lên ảnh, trừ thương hiệu là một phần thật của sản phẩm. Cần dùng ảnh gốc phù hợp hoặc kiểm tra tính năng cải thiện ảnh tự động trong GMC; chưa xác nhận Google xử lý/duyệt ảnh này và không tự sửa ảnh shop trong phiên. Đây là kiểm tra một mẫu, không phải thống kê toàn bộ kho ảnh.

```bash
curl -f -A 'Mozilla/5.0' -D /tmp/bigbike-gmc-headers.txt -o /tmp/bigbike-gmc.xml https://bigbike.vn/google-merchant.xml
```

Không đưa dữ liệu tài khoản/credentials vào repo. Không cần service-account JSON hoặc OAuth secret cho cách kết nối bằng URL.

Nguồn chính thức: [Google — thêm sản phẩm từ tệp](https://support.google.com/merchants/answer/12158380?hl=en), [ID sản phẩm](https://support.google.com/merchants/answer/6324405?hl=en), [nhóm biến thể](https://support.google.com/merchants/answer/6324507?hl=en), [thuộc tính biến thể](https://support.google.com/merchants/answer/17085214).
