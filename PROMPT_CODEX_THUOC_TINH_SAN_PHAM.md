# Prompt bàn giao — Hiện trực quan các loại thuộc tính, gỡ chức năng tạo loại thuộc tính

> Chủ shop đã rà trực tiếp trên hệ thống thật ngày 20/09/2026 và chốt các quyết định dưới đây.
> Mọi con số trong tài liệu này là **đo thật trên máy chủ** (kho dữ liệu đang chạy), không phải ước lượng — máy local không có dữ liệu này.
> Làm theo đúng giao kèo tài liệu-trước của repo: đọc tài liệu chuẩn liên quan trước khi sửa, và cập nhật tài liệu trong cùng một lần thay đổi.

---

## Bối cảnh

Trong màn sửa sản phẩm của khu quản trị, khối **"Chọn điểm khác nhau giữa các lựa chọn"** là nơi nhân viên khai sản phẩm này khác nhau ở cái gì (màu, cỡ, đời máy…) để hệ thống tự sinh ra các lựa chọn bán hàng.

Hiện tại khối đó chỉ bày sẵn **Màu** và **Cỡ**. Mười loại còn lại bị giấu trong một ô xổ xuống tên "Thuộc tính khác" — phải bấm mở mới biết trong đó có gì. Cuối ô xổ xuống còn một dòng **"Tạo loại thuộc tính mới"**.

Hệ thống đang có 12 loại thuộc tính:

| Loại thuộc tính | Số giá trị | Số sản phẩm đang dùng |
|---|---|---|
| Cỡ | 92 | 125 |
| Màu sắc | 95 | 91 |
| Giới tính (đang ghi "Gender") | 2 | 7 |
| Model | 49 | 3 |
| Bo | 14 | 2 |
| Cỡ ốc | 8 | 1 |
| Iphone | 6 | 1 |
| Chiều dài | 2 | 1 |
| Dung tich | 4 | **0** |
| Kích thước ốc | 1 | **0** |
| Cặp | 0 | **0** |
| Solo | 0 | **0** |

Toàn shop có **144 sản phẩm đang có lựa chọn**, trong đó **15 sản phẩm dùng loại thuộc tính ngoài Màu/Cỡ**.

---

## Việc 1 — Bày hết các loại thuộc tính ra ngoài (việc chính)

**Chủ shop chốt:** bỏ hẳn ô xổ xuống "Thuộc tính khác". Mọi loại thuộc tính hệ thống đang có phải **nhìn thấy ngay** trong khối, mỗi loại một ô tick, giống hệt cách Màu và Cỡ đang bày bây giờ — nhân viên đọc một lượt là biết có thể khai những gì, không phải mở ô xổ xuống để dò.

**Chỉ thay cách chọn LOẠI thuộc tính, không thay cách chọn giá trị.** Loại chưa tick thì chỉ là một ô tick, không bày giá trị ra. **Tick vào loại nào thì mới hiện danh sách giá trị của đúng loại đó**, y như hiện tại — không được đổ hết giá trị của cả 8 loại ra màn hình (riêng Màu đã 95 giá trị, Cỡ 92, Model 49).

Yêu cầu:

1. **Màu và Cỡ giữ vị trí đầu** (dùng nhiều nhất), các loại còn lại xếp sau theo thứ tự chữ cái.
2. **Danh sách lấy động từ hệ thống**, không viết cứng trong mã. Sau này dev thêm một loại mới thì nó tự hiện ra, không phải sửa lại màn hình.
3. **Bảng giá trị hiện ra khi tick giữ nguyên 100%** như hiện nay: ô tìm kiếm, danh sách giá trị để tick, đường thêm giá trị mới, phần cuộn khi danh sách dài. Không đổi phần này.
4. **Bỏ tick là cách duy nhất để gỡ một loại ra.** Hiện các loại ngoài Màu/Cỡ còn thêm một nút dấu X riêng — thành hai đường làm cùng một việc, gỡ nút X đi.
5. **Giữ nguyên lời hỏi xác nhận** khi gỡ một loại đang có dữ liệu ("thao tác này sẽ bỏ N lựa chọn cùng mã, giá và ảnh riêng").
6. **Xem trên điện thoại vẫn gọn:** 8 ô tick phải tự xuống dòng đều, không tràn ngang, không dính chữ.

**Không đụng tới ô "Bảng cỡ"** ngay dưới khối — chủ shop chốt giữ nguyên dạng ô chọn như hiện nay, vì nó chỉ hiện khi sản phẩm có Cỡ và mỗi sản phẩm chỉ chọn được một bảng.

---

## Việc 2 — Gỡ chức năng tạo / đổi tên / xoá loại thuộc tính khỏi khu quản trị

**Lý do chủ shop chốt gỡ:** tạo thêm một loại thuộc tính mới là việc gần như không bao giờ xảy ra, nhưng đặt ngay cạnh thao tác hằng ngày thì dễ bấm nhầm và đẻ ra loại rác (bảng trên đã có 4 loại rác kiểu đó). Khi nào thật sự cần loại mới thì **yêu cầu dev làm**.

Gỡ khỏi màn quản trị:

- **"Tạo loại thuộc tính mới"** — có ở **hai chỗ**: trong khối "Chọn điểm khác nhau giữa các lựa chọn", và trong ô chọn tên thuộc tính khi sửa chi tiết từng lựa chọn. Gỡ cả hai, kèm hộp nhập tên đi theo nó.
- **Nút hình bút chì "Đổi tên thuộc tính"** ở phần sửa chi tiết từng lựa chọn — bên trong hộp đó còn cho xoá luôn cả loại thuộc tính. Gỡ cả nút lẫn hộp.
- Dọn các câu chữ song ngữ không còn chỗ dùng sau khi gỡ.

**Giữ nguyên, tuyệt đối không gỡ nhầm:**

- **Thêm / sửa / xoá GIÁ TRỊ** của một loại thuộc tính — thêm màu "Xanh rêu", thêm một cỡ mới… Đây là việc hằng ngày của nhân viên, khác hẳn việc tạo ra một *loại* thuộc tính mới.
- **Cửa sau cho dev** vẫn để nguyên: phần xử lý phía máy chủ cho tạo / đổi tên / xoá loại thuộc tính không gỡ, để dev còn chạy được khi shop yêu cầu, và để làm việc 3 bên dưới.

---

## Việc 3 — Xoá 4 loại thuộc tính rác

Bốn loại dưới đây **không gắn với bất kỳ sản phẩm nào** (đã kiểm chứng trên dữ liệu thật: 0 lượt dùng). Chủ shop chốt xoá hẳn khỏi hệ thống, kèm các giá trị bên trong chúng:

| Loại | Số giá trị bên trong | Ghi chú |
|---|---|---|
| Dung tich | 4 (250ML, 400ML, 60cc, 100cc) | Sót lại từ web cũ, viết không dấu |
| Kích thước ốc | 1 (M8-3+) | Trùng vai với "Cỡ ốc" đang dùng thật |
| Cặp | 0 | Rỗng |
| Solo | 0 | Rỗng |

Yêu cầu:

- Việc dọn phải chạy được **một lần cho cả máy làm việc lẫn máy thật**, không phải bấm tay từng nơi.
- **Không đụng 8 loại còn lại**, kể cả những loại chỉ 1–3 sản phẩm dùng (Model, Bo, Cỡ ốc, Iphone, Chiều dài) — chúng đang gắn với hàng thật.
- Kiểm chứng lại số 0 lượt dùng ngay trước khi xoá, không xoá dựa trên bảng trong tài liệu này.

---

## Ràng buộc chung

- **Không đụng dữ liệu đã lưu:** lựa chọn của 144 sản phẩm phải giữ nguyên mã hàng, giá riêng, ảnh, trạng thái còn/hết hàng. Website khách không được đổi gì.
- **Song ngữ Việt–Anh đầy đủ** cho mọi chữ mới; tiếng Việt có dấu đầy đủ.
- **Cập nhật tài liệu chuẩn cùng lúc, cùng một lần thay đổi.** Có ít nhất hai chỗ đang mô tả ngược với thiết kế mới: một luật nghiệp vụ nói "admin có thể tạo loại thuộc tính biến thể mới ngay trong màn sửa sản phẩm", và điều khoản nghiệm thu của khối lựa chọn sản phẩm. Rà lại toàn bộ tài liệu chuẩn, đừng chỉ sửa hai chỗ này.
- **Bổ sung và cập nhật kiểm thử** cho cách bày mới và cho việc các chức năng đã gỡ không còn xuất hiện; chạy kiểm thử và chạy thử thật trên màn hình trước khi báo xong.
- Tự rà lại phạm vi trong mã trước khi sửa — danh sách trên là kết quả rà ngày 20/09/2026, có thể còn chỗ phát sinh.
