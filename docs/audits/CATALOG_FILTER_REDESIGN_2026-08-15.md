# Báo cáo làm lại bộ lọc sản phẩm — 15/08/2026

## Kết quả chính

Bộ lọc mới đã được hoàn thiện cho bốn nơi dùng chung: Tất cả sản phẩm, Nhóm hàng,
Tìm kiếm và Thương hiệu. Trên máy tính, cây nhóm hàng được đưa ra thành dải thẻ ảnh
phía trên lưới; cột lọc chuyển sang thứ tự Thương hiệu → Giá → Kích cỡ → Màu sắc →
Nước sơn → Tình trạng hàng → Giới tính, có thể gập và dính khi cuộn. Trên điện thoại,
bảng lọc chiếm trọn màn hình, có số điều kiện, thẻ điều kiện, Xoá tất cả và nút
“Xem N sản phẩm”.

Khách có thể chọn nhiều thương hiệu, nhiều màu và nhiều kích cỡ. Các lựa chọn cùng
nhóm được hiểu là “hoặc”; giữa các nhóm là “và”. Giá giữ nguyên cơ chế hiện có.

## 1. Chiều cao cột lọc

| Trang | Trước: cột lọc | Trước: lưới hàng | Sau: cột lọc | Sau: lưới hàng |
|---|---:|---:|---:|---:|
| Tất cả sản phẩm (177 SP) | 4.277 px | 2.142 px | Not run | Not run |
| Áo quần mùa hè (35 SP) | 3.500 px | 2.142 px | Not run | Not run |
| Mũ bảo hiểm (23 SP) | 2.653 px | 2.142 px | Not run | Not run |
| Găng tay mùa hè (17 SP) | 2.408 px | 1.785 px | Not run | Not run |
| Tai nghe bluetooth (9 SP) | 1.582 px | 1.071 px | Not run | Not run |

Thiết kế mới giới hạn chiều cao cột lọc theo phần màn hình còn nhìn thấy và cho cột
lọc tự cuộn riêng. Trạng thái ban đầu chỉ mở Thương hiệu và Giá; các nhóm còn lại
gập gọn. **Not run:** chưa thể đo số “sau” vì container web/backend đang chạy là bản dựng cũ,
không gắn mã nguồn mới. Theo quy định vận hành, không tự khởi động lại container và
không tự chạy cập nhật cơ sở dữ liệu thật.

## 2. Bộ lọc màu trước/sau

| Chỉ số tại Mũ bảo hiểm | Trước | Sau |
|---|---:|---:|
| Số lựa chọn màu | 44 | 10 màu gốc có hàng thật |
| Sản phẩm trong mục Đen | 5 | 15 |

Số “sau” được tính lại từ dữ liệu thật bằng truy vấn chỉ đọc: mỗi sản phẩm chỉ được
đếm một lần dù có nhiều biến thể cùng màu. Mười màu đang có ở nhóm Mũ bảo hiểm là
Đen, Trắng, Xám, Bạc, Đỏ, Cam, Vàng, Xanh dương, Xanh lá và Khaki/Rêu.

## 3. Danh sách 12 màu gốc và các tên được gom

Một tên ghép có thể xuất hiện ở nhiều dòng, đúng với cách khách tìm màu ghép.

| Màu gốc | Các tên/biến thể đã gom |
|---|---|
| Đen | Đen; Đen bóng; Đen cam; Đen camo; Đen camo đỏ; Đen camo trắng; Đen đỏ; Đen đỏ trắng; Đen hồng; Đen nâu; Đen nhám; Đen phản quang; Đen trắng; Đen trắng đỏ; Đen xám; Đen xanh dương; Đen xanh lá; Đen khaki; Đen neon; Xanh rêu đen; Gloss Black; Matt Black; Black Gray; Juzhen Black Red; Carbon; Carbon 3K bóng/nhám; Carbon 9K bóng; Carbon forged bóng/nhám; Carbon tem bạc/đỏ; Forged cacbon nhám; Nguyên bản carbon |
| Trắng | Trắng; Trắng bóng; Trắng vàng; Trắng xám; Trắng xanh lá; Tráng gương; Cam đen trắng; Đen camo trắng; Đen đỏ trắng; Đen trắng; Đen trắng đỏ; Đỏ trắng xanh; Tem trắng |
| Xám | Xám; Xám bóng; Xám đỏ; Xám vàng; Xám xanh dương; Trắng xám; Đen xám; Xanh lá xám; Tem xám; War Damaged Gray; Cyborg Gray; Silver Gray; Black Gray; Gunmetal |
| Bạc | Bạc; Mythology Silver; Silver Gray; Carbon tem bạc; Tráng gương |
| Đỏ | Đỏ; Đỏ trắng xanh; Đen camo đỏ; Đen đỏ; Đen đỏ trắng; Đen trắng đỏ; Xám đỏ; Tem đỏ; Carbon tem đỏ; Mythology Red; Ronin Red; Super Mecha Red; Juzhen Black Red; Namib đỏ |
| Cam | Cam; Cam đen trắng; Đen cam; Xanh dương cam; Day1 Orange |
| Vàng | Vàng; Vàng neon; Trắng vàng; Xám vàng; Xanh vàng; Mythology Gold; Super Mecha Gold |
| Nâu | Nâu; Đen nâu |
| Xanh dương | Xanh; Xanh dương; Xanh đậm; Xanh đậm om; Xanh đậm sương; Xanh dương cam; Xanh mecha; Xanh nhạt; Xanh nhạt om; Xanh nhạt sương; Xanh om; Xanh vàng; Đen xanh dương; Đỏ trắng xanh; Xám xanh dương; Cyborg Blue; Ronin Blue; Navy; Xanh navy; Blue |
| Xanh lá | Xanh lá; Xanh lá xám; Đen xanh lá; Trắng xanh lá; Day1 Green; Green |
| Khaki/Rêu | Khaki; Xanh army; Xanh rêu; Xanh rêu đen; Đen khaki; Olive |
| Camo | Camo; Camo nhạt; Đen camo; Đen camo đỏ; Đen camo trắng |

Nước sơn được tách riêng thành Bóng, Nhám, Carbon và Phản quang. Tên carbon hiện có
được giữ màu gốc Đen đồng thời có nước sơn Carbon; nếu tên ghi rõ bóng/nhám thì cũng
thuộc đúng mục Bóng/Nhám.

## 4. Tên không quy được về màu gốc

| Tên | Số sản phẩm đang bán | Cách xử lý |
|---|---:|---|
| SỌC | 1 | Không hiện trong Màu sắc vì đây là họa tiết, không phải màu. Link cũ chứa giá trị này được bỏ điều kiện màu thay vì đưa khách tới trang trắng. |

Không còn tên thương mại chưa nhận diện nào khác trong 177 sản phẩm đang bán. Các
tên MYTHOLOGY, WAR DAMAGED, CYBORG, RONIN, SUPER MECHA, Juzhen và DAY1 đều đã nhận
ra màu nhờ từ chỉ màu tiếng Anh trong tên.

## 5. Chữ cần sửa dấu/chính tả dần trong dữ liệu gốc

Đợt này không sửa dữ liệu gốc. Các chuỗi/khóa cũ cần dọn dần gồm:

- Namib Do, Nguyen Ban Carbon, Den Khaki, Trang Guong, Xam Xanh Duong, Den Neon.
- VANG, den-nham-3, den-xam, tem-do, tem-trang, tem-xam, trang-xam, xam-vang.
- xanh-dam-om, xanh-dam-suong, xanh-la-xam, xanh-nhat-om,
  xanh-nhat-suong, xanh-om.
- “Forged cacbon nhám” dùng “cacbon” chưa thống nhất với “carbon”.

Một số sản phẩm hiện đã có bản chữ có dấu ở giá trị hiển thị nhưng khóa cũ vẫn không
dấu; danh sách trên vẫn nên được chuẩn hóa ở đợt quản trị màu/nước sơn tiếp theo.

## 6. Hai lỗi dữ liệu nổi bật

- Tai nghe bluetooth: 9 sản phẩm, 0 sản phẩm có dữ liệu màu. Danh sách 10 màu mặc
  định đã bị gỡ hoàn toàn; nhóm Màu sắc không được dựng khi dữ liệu rỗng.
- Mũ bảo hiểm: phép đếm mới tính cả bốn nhóm con, cho kết quả 23 thay vì 0.
- Tồn kho đối chiếu đúng số owner cung cấp: 164 sản phẩm còn hàng, 13 hết hàng.
- Thương hiệu có số sản phẩm bằng 0 bị loại khỏi cột lọc.

Các số trên được đối chiếu bằng truy vấn chỉ đọc trong container cơ sở dữ liệu đang
chạy; không có dữ liệu thật nào bị sửa.

## 7. Sắp xếp sau khi dọn

Còn bốn lựa chọn thật sự khác nhau:

1. Mới nhất.
2. Bán chạy — dựa trên số lượng đã bán trong các đơn không bị huỷ.
3. Giá thấp đến cao.
4. Giá cao đến thấp.

Đã bỏ khỏi giao diện “Sắp xếp mặc định”, “Theo mức độ phổ biến” giả và lựa chọn
“Theo mới nhất” trùng kết quả. Link cũ vẫn đọc được để không làm hỏng địa chỉ khách
đã lưu. Thẻ sản phẩm có 0 đánh giá không còn hiện năm sao rỗng và không còn mở khung
viết đánh giá từ trang danh sách.

## 8. Ảnh chụp máy tính và điện thoại

**Not run:** không chụp ảnh “sau” trên hệ thống đang chạy vì container web/backend
hiện là bản dựng trước thay đổi. Chụp lúc này sẽ ghi nhận giao diện cũ và gây hiểu
nhầm. Cần triển khai mã mới và chạy cập nhật V1033 theo quy trình của owner trước khi
chụp sáu trang ở hai kích thước màn hình, gồm cả bảng lọc điện thoại đang mở.

## 9. Phần chưa chạy được và lý do

- **Not run — đo chiều cao và kiểm thử thật 6 trang trên desktop/mobile:** bản Docker
  đang chạy không chứa mã mới; agent không được tự restart.
- **Not run — ảnh chụp bộ lọc mới:** cùng lý do trên.
- **Not run — hỏi trợ lý AI thật “mẫu này có màu gì”:** bản backend đang chạy là bản
  cũ, thử lúc này không xác nhận được thay đổi mới và chỉ làm hao hạn mức AI. Các ca
  kiểm tra tự động cho việc đọc/tìm sản phẩm của trợ lý vẫn đạt.
- **Not run — áp thử V1033 vào PostgreSQL thật:** thao tác này sửa cơ sở dữ liệu và
  chưa được owner cho phép trong phiên này.
- Lượt kiểm tra riêng của bộ lọc, hợp đồng dữ liệu và bản dựng web sản xuất đều đạt.
  Lượt rà độc lập toàn bộ tệp web còn báo lỗi ở năm tệp kiểm thử ngoài phạm vi này
  do thiếu khai báo công cụ kiểm thử/kiểu dữ liệu; bản đóng gói web sản xuất vẫn hoàn
  tất cả bước kiểm tra kiểu dữ liệu và tạo đủ 73 trang.
  Lượt kiểm tra toàn bộ máy chủ chạy 1.643 ca nhưng còn 7 lỗi và 18 lỗi môi trường ở
  các phần ngoài công việc này (bài viết, phân quyền, ảnh biến thể và các ca cần tạo
  Docker phụ); các phần đó được giữ nguyên.

## Căn cứ tài liệu và kiểm tra

- Quy tắc chọn nhiều, màu/nước sơn, tồn kho, số đếm nhóm cha và sắp xếp:
  `docs/business/BUSINESS_RULES.md` — `CATALOG_RULE_006` đến `CATALOG_RULE_011`.
- Quy tắc bỏ sao rỗng: `docs/business/BUSINESS_RULES.md` — `REVIEW_RULE_003`.
- Hợp đồng danh sách và số đếm: `docs/engineering/API_CONTRACT.md` — phần
  “Catalog Facets Contract” và “Public product listing”.
- Cấu hình màu/nước sơn: `docs/engineering/DATA_CONTRACT.md` — phần
  “Catalog visual facet configuration (V1033)”.
- Luồng hiển thị lần đầu, hoãn nhẹ và áp dụng trên điện thoại:
  `docs/engineering/API_FLOW_MAP.md` — phần catalog filter workspace.
- Chuẩn giao diện: `bigbike-web/STYLEGUIDE.md` — phần catalog filter workspace và
  ngoại lệ sao đánh giá.
- Môi trường đã kiểm tra trước khi đọc dữ liệu: `docker ps`; các container web,
  backend, admin, PostgreSQL, Redis và MinIO đều ở trạng thái healthy.
