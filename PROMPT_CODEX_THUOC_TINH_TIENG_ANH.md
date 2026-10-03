# Prompt bàn giao — Dọn ô nhập tiếng Anh ở thuộc tính sản phẩm, dịch tên màu trên trang English

> Chủ shop đã rà trực tiếp trên hệ thống thật ngày 20/09/2026 và chốt các quyết định dưới đây.
> Mọi con số trong tài liệu này là **đo thật trên máy chủ** (kho dữ liệu đang chạy), không phải ước lượng — máy local không có dữ liệu này.
> **Prompt này làm TIẾP** trên thay đổi thuộc tính vừa xong cùng ngày (các loại thuộc tính bày thành ô tick, đã gỡ đường tạo/đổi tên/xoá loại thuộc tính). **Không hoàn tác phần đó.**
> Làm theo đúng giao kèo tài liệu-trước của repo: đọc tài liệu chuẩn liên quan trước khi sửa, và cập nhật tài liệu trong cùng một lần thay đổi.

---

## Bối cảnh

Trong màn sửa sản phẩm của khu quản trị, hộp **"Quản lý giá trị thuộc tính"** (nơi nhân viên thêm một màu mới, thêm một cỡ mới) cho mỗi giá trị **hai ô nhập**: tên tiếng Việt và tên tiếng Anh. Chủ shop thấy ô tiếng Anh vô nghĩa với hầu hết loại thuộc tính — ví dụ màu sắc, vì ngoài web khách chỉ thấy **ô ảnh màu** chứ không thấy chữ.

Đã kiểm chứng từng loại trên hệ thống thật:

| Loại thuộc tính | Trang English hiện gì | Đã điền tiếng Anh | Ô tiếng Anh có tác dụng? |
|---|---|---|---|
| Màu sắc | Chỉ **ô ảnh màu**; tên màu nằm ở lớp chữ ẩn cho máy đọc và Google | 0/95 | Gần như không |
| Size | Web tự gọi là "Size"; giá trị là mã S, M, 42 | 0/92 | Không có gì để dịch |
| Giới tính | Web tự dịch Nam/Nữ thành Male/Female | 0/2 | Không |
| Model | Giá trị là mã đời máy (G7, S12, S8X) | 0/49 | Không |
| Iphone | Giá trị là mã máy (15P, 16PM) | 6/6 nhưng **y nguyên tiếng Việt** | Không |
| Chiều dài | 60cm, 90cm | 2/2 nhưng **y nguyên** (60cm → 60cm) | Không |
| **Cỡ ốc** | M8-3 thuận → **M8-3+**, M10-5 nghịch → **M10-5-** | 8/8, khác thật | **Có** |
| **Bo** | Đang lộ tiếng Việt: "Áo", "Quần", "Lưng", "Vai", "Tay" | 0/14 | **Có, và đang thiếu** |

Về **tên loại** thuộc tính: trang web chỉ lấy tên từ hệ thống với các loại ngoài Màu sắc / Size / Giới tính — ba loại đó web có sẵn chữ riêng của nó ("Color", "Size", "Gender"), nên nhập gì cũng không hiện ra.

---

## Việc 1 — Ô nhập tiếng Anh cho giá trị chỉ còn ở hai loại

**Chủ shop chốt:** trong hộp quản lý giá trị thuộc tính, ô nhập tên tiếng Anh **chỉ hiện khi đang làm việc với "Bo" hoặc "Cỡ ốc"**. Sáu loại còn lại — Màu sắc, Size, Giới tính, Model, Iphone, Chiều dài — **ẩn hẳn ô đó**, cả ở dòng thêm giá trị mới lẫn ở từng giá trị đang có.

Yêu cầu:

1. **Nhận biết loại theo mã bất biến của loại thuộc tính**, không dò theo tên hiển thị — tên có thể được đổi, mã thì không.
2. **Không xoá dữ liệu tiếng Anh đã có** của Iphone và Chiều dài. Chỉ ẩn ô nhập, dữ liệu cũ nằm yên trong hệ thống.
3. **Giữ nguyên 100% phần thêm / sửa / xoá giá trị** (thêm màu mới, sửa nhãn, xoá giá trị chưa dùng) — đây là việc hằng ngày của nhân viên.
4. **Không đụng ô nhập tiếng Anh của "Nhóm lọc cỡ"** ở ngay cạnh bảng cỡ. Ô đó web dùng thật (Cỡ giày → "Shoe sizes", Cỡ chữ → "Letter sizes") — giữ nguyên, kể cả việc nó đang bắt buộc phải nhập.
5. **Không thêm dòng ghi chú giải thích** dưới ô. Ẩn là đủ.
6. Bỏ các câu chữ song ngữ không còn chỗ dùng sau khi ẩn.

**Cảnh báo an toàn — đã kiểm chứng, đừng làm ngược:** web nhận ra "cột này là màu", "cột này là cỡ" **qua chính cái tên loại**. Nó chỉ hiểu đúng vài cách viết quen (color / colour cho màu, size cho cỡ). Nếu mở lại đường nhập tên tiếng Anh cho Màu sắc và ai đó gõ chữ khác, trang English sẽ hiện **ô chữ thay vì ô ảnh màu**, và bấm chọn màu không đổi ảnh sản phẩm nữa. Vì vậy ba loại Màu sắc / Size / Giới tính không được có đường nhập tên tiếng Anh ở bất kỳ đâu trong khu quản trị.

---

## Việc 2 — Trang English tự dịch tên màu ở lớp chữ ẩn

Trang English hiện đọc tên màu bằng tiếng Việt ("ĐEN", "XÁM") cho máy đọc dành cho người khiếm thị và cho Google. Khách mắt thường không thấy chữ này, nhưng để tiếng Việt trên trang tiếng Anh thì không sạch.

**Chủ shop chốt:** web **tự dịch** bằng **bảng màu sẵn có của shop** — bảng 12 màu gốc và 4 kiểu bề mặt đang dùng cho bộ lọc màu ngoài web và cho Trợ lý BigBike. **Không bắt nhân viên nhập tay màu nào.**

Yêu cầu:

1. **Dùng lại cơ chế dịch đã có**, đang chạy cho Trợ lý BigBike (nó đã dịch đúng kiểu này: chỉ đổi những từ có trong bảng, giữ nguyên tên riêng). **Không viết bảng màu mới.**
2. **Chỉ đổi lớp chữ ẩn.** Ô ảnh màu, thứ tự, cách bấm chọn, ảnh đổi theo màu — giữ nguyên tuyệt đối.
3. **Không sửa tên màu lưu trong hệ thống.** Dịch lúc hiển thị, không ghi đè dữ liệu.
4. Đo trước khi làm, trên 95 tên màu đang có: **16** tên trùng khít một màu trong bảng, **35** tên có chứa từ của bảng, **44** tên không có từ nào — phần lớn nhóm này vốn đã là tiếng Anh (CYBORG BLUE, MYTHOLOGY RED, SUPER MECHA GOLD).
5. Sau khi dịch sẽ còn **đúng 7 tên vẫn lộ tiếng Việt** vì bảng chưa có từ: SỌC, XANH NHẠT, XANH RÊU, XANH ĐẬM, tem-do, tem-trang, tem-xam. **Được phép** bổ sung mấy từ thiếu này vào bảng màu (nhạt → light, đậm → dark, rêu → olive, sọc/tem → stripe/decal) **với điều kiện** bộ lọc màu ngoài web và cách Trợ lý hiểu màu không bị lệch đi. Nếu có rủi ro làm lệch bộ lọc thì **bỏ qua việc bổ sung**, ghi lại lý do, đừng tự ý sửa bộ lọc.

---

## Việc 3 — Điền tiếng Anh cho loại "Bo"

Đây là loại thuộc tính cho biết khách **mua phần nào trong bộ**. Hai sản phẩm đang dùng: bộ miếng giáp tay/vai/lưng D3O, và áo lót thun lạnh mặc trong giáp. Trang English của áo lót thun lạnh hiện đang hiện tiêu đề "Bo" và các ô "Áo", "Dual", "Quần" — nguyên tiếng Việt.

**Chủ shop duyệt bản dịch dưới đây.** Điền vào hệ thống (đây là sửa dữ liệu, không phải sửa màn hình):

**Tên loại**

| Đang có | Tiếng Anh |
|---|---|
| Bo | Part |

**7 giá trị đang được sản phẩm dùng** — phải điền:

| Tiếng Việt | Tiếng Anh | Sản phẩm dùng |
|---|---|---|
| Tay | Arms | Giáp D3O |
| Vai | Shoulders | Giáp D3O |
| Lưng | Back | Giáp D3O |
| Combo 3 | Set of 3 | Giáp D3O |
| Áo | Top | Áo lót thun lạnh |
| Quần | Pants | Áo lót thun lạnh |
| Dual | Set of 2 | Áo lót thun lạnh |

**7 giá trị không sản phẩm nào đang dùng** — điền cho đủ, nhưng không hiện ra ngoài web:

| Tiếng Việt | Tiếng Anh |
|---|---|
| Chân ghi đông | Handlebar end |
| Mái che | Canopy |
| Nón che | Cover cap |
| núm khóa chống trộm | Anti-theft lock knob |
| CÁI | Piece |
| CẶP | Pair |
| Single | Single |

**Hai điểm chỉ báo, CHƯA CHỐT — không tự làm:**

- 7 giá trị ở bảng dưới không gắn với bất kỳ sản phẩm nào (giống kiểu 4 loại thuộc tính rác đã xoá hôm 20/09). Chủ shop sẽ quyết riêng có xoá hay không. **Để nguyên.**
- Tên loại "Bo" cũng khó hiểu với khách Việt (đúng nghĩa là "Phần"). Đổi tên tiếng Việt là quyết định riêng của chủ shop. **Để nguyên "Bo" cho trang tiếng Việt.**

---

## Kiểm chứng trước khi báo xong

Chạy thật, không suy luận:

1. Màn sửa sản phẩm — bấm quản lý giá trị của **Màu sắc, Size, Giới tính, Model, Iphone, Chiều dài**: không còn ô nhập tiếng Anh nào.
2. Bấm quản lý giá trị của **Bo** và **Cỡ ốc**: ô tiếng Anh vẫn còn, sửa và lưu được.
3. Thêm một giá trị mới cho Màu sắc: vẫn lưu bình thường (hệ thống cho phép để trống tên tiếng Anh, không báo lỗi).
4. Hộp **Nhóm lọc cỡ**: vẫn đòi nhập tên tiếng Anh như cũ, không bị dọn lây.
5. Trang English của một sản phẩm nhiều màu: ô màu **vẫn là ảnh**, bấm chọn vẫn đổi ảnh, và lớp chữ ẩn đã ra tiếng Anh.
6. Trang English của áo lót thun lạnh: tiêu đề khối và các ô đã ra tiếng Anh, không còn "Bo / Áo / Quần".
7. Trang tiếng Việt: không đổi bất cứ chữ nào.
8. Xem trên điện thoại: hộp quản lý giá trị không bị lệch sau khi bỏ một ô nhập.

---

## Tài liệu phải cập nhật cùng lần thay đổi

- Luật nghiệp vụ về thuộc tính sản phẩm (vừa cập nhật 20/09) **ghi thêm**: đường nhập tên tiếng Anh cho giá trị chỉ mở cho hai loại có giá trị bằng chữ Việt; các loại còn lại không có đường nhập, vì web hoặc có chữ riêng, hoặc chỉ hiện ảnh, hoặc giá trị là mã dùng chung hai thứ tiếng.
- **Thêm luật** về cách trang English gọi tên màu: lấy từ bảng màu của shop, không lấy từ ô nhập tay.
- Điều khoản nghiệm thu của khối lựa chọn sản phẩm: bổ sung đúng các điểm ở mục kiểm chứng trên.
- Giữ nguyên phần tài liệu nói các đường tạo/đổi tên/xoá loại thuộc tính vẫn còn ở phía máy chủ làm cửa sau cho dev.

---

## Việc KHÔNG làm trong lần này

- Không mở lại hộp tạo loại thuộc tính mới hay đổi tên loại thuộc tính (đã chốt gỡ hôm 20/09).
- Không xoá dữ liệu tiếng Anh cũ của Iphone và Chiều dài.
- Không xoá 7 giá trị không dùng của loại "Bo".
- Không đổi tên tiếng Việt của loại "Bo".
- Không sửa tên màu của sản phẩm trong hệ thống.
- Không đụng ô "Bảng cỡ" và ô "Nhóm lọc cỡ".
