# Prompt bàn giao — Dọn và thiết kế lại khu quản trị sản phẩm

> Chủ shop đã rà trực tiếp trên hệ thống thật ngày 18/09/2026 và chốt các quyết định dưới đây.
> Mọi con số trong tài liệu này là **đo thật trên máy chủ**, không phải ước lượng — máy local không có dữ liệu này.
> Làm theo đúng giao kèo tài liệu-trước của repo: đọc tài liệu chuẩn liên quan trước khi sửa, và cập nhật tài liệu trong cùng một lần thay đổi.

---

## Việc 1 — Thiết kế lại khối "Lựa chọn sản phẩm" (việc chính)

Khối này hiện được dựng theo cách kho dữ liệu nghĩ, không theo cách người bán hàng nghĩ. Nhân viên nhập liệu thấy khó hiểu.

### Những điểm đã xác minh là sai

- Gọi hai tên cho cùng một thứ: tiêu đề khối ghi "Lựa chọn sản phẩm" nhưng ngay cạnh có nhãn đếm ghi "biến thể". Trong màn sản phẩm còn 9 câu chữ khác vẫn dùng chữ "biến thể", trong đó có **một câu báo lỗi viết cứng trong mã, chỉ có tiếng Việt, không dịch được**.
- Khối mở đầu bằng câu hỏi kỹ thuật về bảng cỡ, kèm lời giải thích nói về cơ chế lọc của website — trong khi việc đầu tiên người nhập cần quyết là "sản phẩm này có nhiều màu/cỡ hay không".
- Chưa thêm gì thì hiện một bảng trống có đủ tiêu đề cột nhưng không dòng nào, và **không một lời chỉ dẫn nào**.
- Thứ tự thao tác ngược: bắt tạo một dòng trống tên "Lựa chọn 1" trước, rồi mới khai nó là màu gì cỡ gì.
- Ô chọn giá trị thuộc tính hiện sẵn lời mời "hãy thêm ngay" khi chưa chọn thuộc tính — mời bấm vào chỗ chưa dùng được. Mục ảnh theo màu cũng hiện tiêu đề trống khi chưa có màu nào.
- Có ba chỗ nhập giá và phải chèn một hộp giải thích dài mới hiểu được quan hệ giữa chúng.
- Các luật chặn (mọi lựa chọn phải dùng cùng một bộ thuộc tính; mã hàng bắt buộc và không trùng; sản phẩm có màu thì lúc đăng bán mới đòi ảnh màu) **không được báo trước**, chỉ lộ ra khi bấm Lưu.

### Luồng mong muốn

1. **Hỏi thẳng khi khối còn trống:** sản phẩm này bán một kiểu duy nhất, hay có nhiều màu / nhiều cỡ? Chọn "một kiểu duy nhất" thì khối gập lại và chỉ dùng giá cấp sản phẩm.
2. **Khai cái gì khác nhau:** chọn Màu và/hoặc Cỡ. Chọn Màu thì hiện bảng màu để tick, có ô tìm và đường thêm màu mới ngay tại chỗ. Chọn Cỡ thì **lúc này** mới hỏi bảng cỡ — đúng lúc cần dùng, không hỏi trước như hiện nay.
3. **Bảng lựa chọn hiện ra với tên có nghĩa:** mỗi dòng tên là "Đen – M", "Đỏ – L"… thay vì "Lựa chọn 1".
4. **Luật hiện ngay tại chỗ:** thiếu ảnh màu, trùng mã hàng, các dòng lệch bộ thuộc tính — báo ngay trên dòng đó kèm câu giải thích, không để nhân viên bấm Lưu rồi mới biết sai ở đâu.

### Chủ shop đã chốt

| Điểm | Quyết định |
|---|---|
| Cách tạo các lựa chọn | Chọn màu + cỡ rồi máy tự sinh bảng. Đây là **đường đi chính** của khối, không phải một nút riêng giấu trong menu |
| Mã hàng từng lựa chọn | **Máy đặt sẵn** theo mẫu *mã sản phẩm gốc + màu + cỡ*, nhân viên sửa được nếu muốn |
| Giá | **Một giá chung**; ô giá từng dòng hiện sẵn giá chung dạng mờ, gõ đè thì thành giá riêng. **Bỏ hộp giải thích dài** |
| Còn hàng | **Giữ nguyên, đã đúng** — sản phẩm có lựa chọn thì công tắc cấp sản phẩm tự ẩn và trạng thái được tính từ các lựa chọn; sản phẩm không có lựa chọn thì công tắc cấp sản phẩm là nơi duy nhất quyết định |

### Gỡ bỏ trong cùng đợt

- **Hộp "Tạo nhanh biến thể" cũ** (mở từ menu "Thêm lựa chọn" → "Tạo hàng loạt"): gỡ hẳn cả mục menu lẫn hộp, cùng toàn bộ chữ hiển thị song ngữ của nó và các câu chữ cũ đã không còn chỗ dùng. Việc sinh dòng tự động **không mất đi** mà chuyển thành bước 2–3 của luồng mới.
- **"Nhân bản"** ở mỗi dòng lựa chọn — có ở cả bản máy tính và bản điện thoại. Chức năng này không được dùng.
- **Bốn thao tác cho các dòng đã tick** trong khối này (điền giá · đánh hết hàng · đánh còn hàng · xoá nhiều dòng) **và các ô tick chọn dòng** đi kèm, vì chúng thành vô nghĩa. Lưu ý: thanh thao tác hàng loạt là đồ dùng chung của khoảng 10 màn danh sách khác (đơn hàng, đánh giá, sản phẩm, danh mục, tin tức, menu, video trang chủ, thư viện ảnh, chuyển hướng) — **chỉ tháo nó ra khỏi khối lựa chọn sản phẩm, không đụng các màn kia**.
- Sau khi gỡ, chỗ nào còn menu chỉ một mục thì **gộp thành nút bấm thẳng**.

### Dọn kèm

- Thống nhất dùng chữ **"lựa chọn"** trên toàn màn hình sản phẩm, bỏ chữ "biến thể" ở phần nhân viên nhìn thấy.
- Câu báo lỗi viết cứng chỉ có tiếng Việt phải đưa vào hệ thống chữ song ngữ như mọi câu khác.

### Số đo thật để cân nhắc thiết kế

- 247 sản phẩm, trong đó **144 sản phẩm có lựa chọn**
- Phổ biến nhất là 3–6 lựa chọn mỗi sản phẩm
- **42 sản phẩm có từ 10 lựa chọn trở lên**; nhiều nhất là 75, rồi 45, 36, 29, 28

---

## Việc 2 — Dọn dữ liệu bảng cỡ

Danh sách bảng cỡ hiện ra trên mọi trang tạo sản phẩm đang có mục rác, làm nhân viên mất niềm tin vào màn hình:

| Bảng cỡ | Số sản phẩm đang dùng | Xử lý |
|---|---|---|
| **Iphone** (6 cỡ, xếp trong nhóm cỡ chữ) | 0 | Xoá — đây là shop đồ bảo hộ mô tô |
| **Cỡ ốc** (8 cỡ, nhóm lọc đang tắt) | 0 | Xoá |
| **Chiều dài** (2 cỡ, xếp nhầm nhóm cỡ chữ) | 1 | Xem lại: đổi nhóm cho đúng, hoặc gộp/xoá nếu thật sự thừa — báo lại trước khi xoá |

Sáu bảng cỡ còn lại đang được dùng thật, giữ nguyên.

---

## Việc 3 — Gỡ chức năng "Sao chép" không dùng

Chủ shop chốt gỡ hẳn, vì không ai dùng:

- **Sao chép danh mục** (trong danh sách danh mục)
- **Sao chép khối nội dung** trong trình soạn thảo — gỡ ở **cả hai nơi**: phần mô tả sản phẩm và trình soạn bài viết tin tức
- **Sao chép thương hiệu**: nút này thực ra đã không còn từ trước, chỉ còn sót chữ thừa trong kho ngôn ngữ — dọn chữ thừa đi

Không đụng tới các chức năng sao chép khác nếu có.

---

## Việc 4 — Sửa lỗi thanh tiêu đề nhóm bị xuống dòng

Thanh tiêu đề của mỗi nhóm nội dung thu gọn được (thanh có mũi tên bung/thu) đang bị vỡ: **mũi tên chiếm trọn một dòng, chữ rớt xuống dòng dưới**, thanh cao gần gấp rưỡi bình thường.

Đây là thanh dùng chung nên lỗi xuất hiện ở nhiều màn: tạo/sửa sản phẩm (3 thanh), vai trò và phân quyền (20 thanh), tạo/sửa thương hiệu (1 thanh), cùng chi tiết đơn hàng, chi tiết danh mục, cài đặt, menu và thư viện ảnh.

Nguyên nhân: trong đợt dọn giao diện cuối tháng 8, phần trình bày của thanh này được viết lại và **quy tắc xếp mũi tên với chữ trên cùng một hàng bị bỏ sót**. Sửa ở một chỗ dùng chung là tất cả các màn hết cùng lúc.

---

## Việc 5 — Nội dung bài viết bị gộp thành một khối "Mô tả cũ" (có thể tách thành đợt riêng)

### Hiện trạng

**104 trong 185 bài viết** — trong đó **99 bài đang đăng trên web** — mở ra trong khu quản trị thì toàn bộ nội dung gộp thành một ô xám "Mô tả cũ", chỉ xem được, không sửa được từng phần. 81 bài còn lại vẫn hiện đúng từng khối.

Nguyên nhân: hệ thống vốn có sẵn bộ tách nội dung thành khối và đã chạy một lần hồi tháng 5/2026, nhưng sau đó nội dung được ghi thẳng vào kho dữ liệu qua nhiều đợt mà không sinh lại phần khối:

| Ngày sửa gần nhất | Số bài mất khối |
|---|---|
| 17/09/2026 (đợt phiếu SEO) | 72 |
| 10/09/2026 (nhập từ Google Docs) | 18 |
| 05/08 · 20/08 · 11/09 | 12 |
| Trước đó | 2 |

**Rủi ro đang treo:** ô "Mô tả cũ" chỉ để xem. Nếu nhân viên mở một trong 104 bài đó, thêm một khối rồi bấm Lưu thì **toàn bộ nội dung cũ bị thay bằng đúng khối vừa thêm**.

### Chủ shop đã chốt

1. **Làm cả hai hướng:** khu quản trị tự tách khối ngay khi mở bài chưa có khối (sửa được liền, chưa đụng dữ liệu cho tới khi bấm Lưu) **và** chạy một đợt chuyển đổi cho toàn bộ 104 bài. Đợt chuyển đổi chỉ điền thêm phần khối, **không đụng vào nội dung gốc** — website khách không đổi gì.
2. **Thêm loại khối bảng biểu** vào trình soạn nội dung, để sửa được từng ô ngay trong trình soạn. **Chỉ thêm cho bài viết tin tức**, không thêm vào phần mô tả sản phẩm (mô tả sản phẩm dùng loại khối ảnh–chữ so le riêng và đã có mục thông số kỹ thuật dạng bảng).
3. **Nâng trần số khối mỗi bài** từ 200 lên khoảng 400.
4. **Chống tái diễn:** hệ thống tự sinh khối cho bài nào còn thiếu, không phụ thuộc việc người chạy đợt ghi dữ liệu có nhớ hay không.

### Thứ tự bắt buộc

**Phải có loại khối bảng trước, rồi mới chạy đợt chuyển đổi 104 bài.** Làm ngược lại thì các bảng bị đóng cứng thành khối thô và phải chạy lần hai.

### Số đo thật

- Chạy thử bộ tách sẵn có lên đúng 104 bài đó: sinh ra khoảng **10.400 khối**, trung bình **95 khối/bài**, trung vị 95
- **99,8% ra khối chuẩn** (đoạn văn, tiêu đề, ảnh kèm chú thích, danh sách)
- Chỉ **23 khối thô** nằm rải ở 17 bài: 16 cái bảng, 4 khối lạ, 3 tiêu đề kiểu cũ
- Bài dài nhất ra **191 khối** — sát trần 200 hiện nay, đó là lý do phải nâng trần
- 5 bài trên 150 khối, 41 bài trên 100 khối
- Trong 104 bài có khoảng **1.700 thẻ định dạng rác** dính theo lúc dán từ Google Docs (885 thẻ hiệu ứng thừa, 806 thẻ "chữ thường" vô nghĩa, vài mẩu dữ liệu ẩn của Google Sheets, 5 chỗ chữ màu xanh). Chúng sẽ tự được dọn khi bài được lưu lại — coi như lợi, chỉ mất 5 chỗ chữ màu xanh

### Tin tốt

Website đã hiển thị bảng đúng sẵn, có cuộn ngang trên điện thoại, và phần lưu trữ cũng đã cho phép thẻ bảng từ trước. Nên thêm loại khối bảng chủ yếu là việc trong trình soạn của khu quản trị, không phải đụng tới cách khách nhìn thấy.

---

## Ràng buộc chung

- **Không đụng dữ liệu đã lưu**: lựa chọn của 144 sản phẩm và nội dung của 185 bài viết phải giữ nguyên.
- **Không đụng máy chủ và website khách** ở các việc 1–4; đó là những việc nằm trong khu quản trị.
- **Song ngữ Việt–Anh đầy đủ** cho mọi chữ mới, tiếng Việt có dấu đầy đủ.
- **Cập nhật tài liệu chuẩn cùng lúc.** Riêng việc 1 có một điều khoản nghiệm thu đang nhắc tới công cụ sinh hàng loạt — phải sửa lại cho khớp thiết kế mới. Đã rà hết tài liệu, ngoài chỗ đó ra không có tài liệu nào mô tả các chức năng bị gỡ.
- **Bổ sung kiểm thử** cho luồng mới; chạy kiểm thử và chạy thử thật trước khi báo xong.
- Tự rà lại phạm vi trong mã trước khi sửa — danh sách trên là kết quả rà ngày 18/09/2026, có thể còn chỗ phát sinh.
