# Kết nối BigBike với Google Merchant Center

## Kết quả mong đợi

Nhân viên đăng/sửa sản phẩm, giá và trạng thái Còn/Hết tại BigBike. GMC lấy nguồn `https://bigbike.vn/google-merchant.xml` theo lịch đã cấu hình; không nhập lại từng sản phẩm hoặc tải file thủ công. Nguồn chứa từng lựa chọn bán hàng (biến thể) với SKU, giá, ảnh và đường dẫn chọn sẵn tương ứng. Quy tắc: `GMC_RULE_001`–`005`.

**Trạng thái 07/09/2026: nguồn đã triển khai trên VPS tại `https://bigbike.vn/google-merchant.xml`; đã xác nhận Google tiếp nhận đủ 1.172 SKU của 185 sản phẩm qua bản xuất GMC lúc 12:30:21 do owner cung cấp. Toàn bộ SKU, giá, Còn/Hết, link, ảnh và nhóm biến thể khớp nguồn XML được lấy lại khi đối chiếu. Chưa xác minh trạng thái duyệt/hiển thị của toàn bộ nguồn mới, cấu hình giờ lấy tự động hoặc lần lấy định kỳ tiếp theo.**

Kết quả kiểm thử, phạm vi và giới hạn: [FEATURE_GMC_IMPLEMENTATION_2026-09-07.md](../audits/FEATURE_GMC_IMPLEMENTATION_2026-09-07.md).

**Cập nhật 30/10/2026:** đã khôi phục HTTP 200 XML sau khi owner duyệt đưa trang Kewig BD-1L trùng về Nháp và chuyển 301 sang lựa chọn 90 cm. Lần kiểm cuối có 213 sản phẩm / 1.187 dòng duy nhất, phản hồi công khai 6,50 giây; đã GET kiểm đủ 1.187 link và 912 URL ảnh qua origin production. Đây là số feed tại lần kiểm, chưa phải số Google tiếp nhận/duyệt; chưa truy cập GMC. Header theo dõi thời điểm dựng mới được chuẩn bị trong source, chưa triển khai. Xem phần thực thi tiếp nối trong [báo cáo 30/10](../audits/FEATURE_GOOGLE_MERCHANT_TICKET_REVIEW_2026-10-30.md).

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

- Công cụ kiểm tra chỉ đọc tại root repo: `python3 scripts/check-google-merchant.py --url https://bigbike.vn/google-merchant.xml --max-age-seconds 60`. Mức 60 giây là ngưỡng kiểm tra bản XML động trong lần gọi, không phải quyền phục vụ bản dự phòng. Công cụ xuất JSON và exit 1 khi HTTP/XML/count/SKU/tuổi bản dựng/thời gian phản hồi có lỗi; không gửi thông báo hoặc tự cài lịch chạy. Có thể thêm `--expected-items N` với số dòng đã đối chiếu catalog hiện tại; không dùng số lịch sử cố định. Kiểm XML và hai header đếm chỉ xác nhận tính nhất quán, chưa thay thế đối chiếu catalog, HTML từng lựa chọn và ảnh.
- `X-Merchant-Generated-At` chỉ có trên bản dựng hoàn tất, dùng kiểm tuổi XML sau khi đọc nguồn không cache. Thiếu header cũng là lỗi theo dõi, kể cả HTTP 200. Ngày 30/10/2026 owner giao quyết định hợp lý: chọn tiếp tục nguồn mới hoặc 503 theo `GMC_RULE_005`, chưa dùng bản dự phòng cũ vì rủi ro giá/Còn–Hết. Người phụ trách: chủ shop; kết quả hiện chỉ ở JSON trên VPS. Đề xuất chạy mỗi 5 phút sau khi duyệt vận hành; chưa cài lịch hoặc kênh gửi ra ngoài. Chuyển sang bản dự phòng sau này vẫn phải chốt độ cũ, làm mới, lưu bền vững và sửa docs trước.

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

## DEV-7 — nguồn tồn kho cửa hàng (06/11/2026)

Shop cung cấp mã cửa hàng chính xác từ Google Business Profile. Dev cấu hình GMC_STORE_CODE và đưa web mới lên, kiểm `/google-local-inventory.tsv` trả 200, ID/giá hiện hành/Còn-Hết khớp XML. Sau đó shop thêm nguồn local inventory tìm nạp hằng ngày cùng giờ XML trong tài khoản chính 124097107. Theo dõi lỗi local_stores_lack_inventory và Google Maps sau 2–3 ngày; chưa có bằng chứng Google nhận/duyệt thì không coi là hoàn tất. Quantity bị bỏ vì hệ thống không quản lý số tồn. [Đặc tả Google](https://support.google.com/merchants/answer/14819809?hl=en).

### Mã cửa hàng đã được owner cung cấp (06/11/2026)

Owner xác nhận `BIGBIKE-HCM-01` là mã hồ sơ cửa hàng. Cấu hình qua `GMC_STORE_CODE` trên web production theo DEPLOYMENT_GUIDE, không đóng cứng trong mã nguồn. Sau khi xác nhận URL TSV trả 200, shop đăng nguồn local inventory `https://bigbike.vn/google-local-inventory.tsv` trong tài khoản 124097107 và đặt lịch hằng ngày cùng giờ XML. Việc xác nhận mã từ owner không thay thế bằng chứng GMC đã nhận/duyệt hoặc Google Maps đã hiển thị.

**Nguồn đã hoạt động:** ngày 06/11/2026, đã cấu hình mã thật, nạp lại riêng web và xác nhận HTTPS TSV trả 200 với 1.184 dòng. Toàn bộ ID, availability và giá hiện hành khớp feed XML; bộ kiểm tra nguồn thật đạt. Shop có thể đăng URL local inventory và đặt lịch tìm nạp; chưa kiểm tra tài khoản Google đã tiếp nhận/duyệt.

**Cập nhật kết quả GMC do owner cung cấp 06/11/2026:** nguồn local inventory `409043453` đã được đọc lúc 16:41 nhưng báo mã cửa hàng `BIGBIKE-HCM-01` không hợp lệ. Owner xác nhận mới lưu mã trong Google Business Profile hôm nay. Chờ đủ 24 giờ từ lần lưu để Google đồng bộ và tìm nạp lại; đồng thời xác minh đúng hồ sơ Shop Bigbike đã liên kết trong tài khoản 124097107. Đây là lỗi nhận diện cửa hàng phía Google, chưa chứng minh cần sửa feed. Nếu còn lỗi sau thời gian đó, kiểm liên kết/mã/xác minh và kết quả xử lý mới. Xem [hướng dẫn Google](https://support.google.com/merchants/answer/15077749?hl=en) và báo cáo DEV7_DEV8_DEV9.

## Đợt 2 — 09/11/2026

Đối chiếu từng yêu cầu và bằng chứng tại [báo cáo đợt 2](../audits/FEATURE_GMC_ROUND2_2026-11-09.md). Mốc lịch sử 5 phút ở phần trên được thay bằng yêu cầu kiểm ba URL **mỗi 60 giây từ bên ngoài VPS**; Telegram có bot đang dùng cho đơn mới/sao lưu và có thể tái sử dụng, chưa có runner ngoài VPS hoặc tin thử nên chưa đạt. Hướng dẫn/cấu hình mẫu: `deploy/monitoring/README-GMC.md`; công cụ kiểm chỉ đọc `scripts/check-storefront-uptime.py` không tự gửi tin/cài lịch.

Shop giữ rule xác minh định danh, không mặc định `identifier_exists=no`. [Bảng đề xuất 30 danh mục](../audits/GMC_CATEGORY_MAPPING_PROPOSAL_2026-11-09.md) chưa được duyệt/applied. Không đổi prefix wp-var vì chúng là ID thật hiện hành, chưa có ánh xạ đích mới. Code đợt 2 đã triển khai theo yêu cầu owner tối 09/11/2026: feed công khai vẫn đủ 1.184 SKU, 123 ảnh chính và 5 tên đổi; giá/Còn–Hết/brand/link không đổi. XML và TSV cùng 1.184 mã, không lệch ID/giá/Còn–Hết. Trang fallback ≤1h không áp dụng cho feed. Web đã tăng giới hạn bộ nhớ từ 512MiB lên 1GiB để giảm áp lực heap đã quan sát; cần theo dõi lâu hơn. Probe ba URL chạy một lần đạt, chưa có lịch mỗi phút/Telegram gửi thử hoặc bằng chứng độc lập ngoài VPS. Xem phần triển khai của báo cáo đợt 2 và thư mục evidence/deployment.

### Quyết định tiếp nối 10/11/2026

Owner chọn giữ ID thật ổn định và điều chỉnh tiêu chí phiếu: kiểm toàn bộ link hiện hành mở đúng lựa chọn, không đổi `wp-var-*` thành ID giả. Không có chuyển ID nên redirect old→new sáu tháng chưa áp dụng. Mapping 30 danh mục và thương hiệu còn chờ shop; giữ quy tắc định danh. Owner chỉ yêu cầu gói cài giám sát, sẽ cung cấp nơi chạy ngoài VPS và nhóm Telegram sau; chưa kết nối/gửi thử hoặc nghiệm thu cảnh báo. Căn cứ GMC_RULE_003/004/009.

Bổ sung source 10/11: giới hạn vòng đời window xử lý nội dung để giảm giữ bộ nhớ, theo tài liệu thư viện đã cài; phải gắn lại hooks lọc HTML/CSS. Chưa nạp bản này lên production và chưa coi một nguồn đã tái hiện là nguyên nhân duy nhất của ba sự cố. Chi tiết đo trước/sau và nghiệm thu nằm ở báo cáo đợt 2, phần tiếp nối 10/11.
