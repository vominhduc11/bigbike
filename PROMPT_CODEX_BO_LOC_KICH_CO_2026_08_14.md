# Nhiệm vụ: Làm lại bộ lọc Kích cỡ trên web khách hàng (14/08/2026)

Đọc `AGENTS.md` trước. Tuân thủ Docs-First Contract: thay đổi chạm quy tắc kinh doanh / hợp đồng dữ liệu / cách lọc → **cập nhật tài liệu trước, rồi sửa code, trong cùng một PR**. Cite evidence path trong response.

**Chế độ chạy:** một lần gọi = chạy tới xong, không dừng giữa chừng xin duyệt. Owner đã chốt sẵn ở mục 2 — **không hỏi lại những điều đó**. Vướng kỹ thuật không vượt được → ghi `Not run: <lý do>` rồi chạy tiếp việc khác.

**Môi trường:** stack chạy sẵn trong Docker (web khách, quản trị, máy chủ, cơ sở dữ liệu, kho ảnh, bộ nhớ đệm). Chạy `docker ps` trước khi dùng; container cần dùng chưa chạy thì **dừng, báo owner**, không tự khởi động lại. Trong container mặc định **chỉ đọc**; thao tác sửa/xoá dữ liệu thật phải hỏi owner trước. **Không mock dữ liệu** khi hệ thống thật đang chạy và tra được.

---

## 0. Bối cảnh — vấn đề đang có thật

Trang "Tất cả sản phẩm" của web khách hàng có cột lọc bên trái, trong đó có mục **Kích cỡ**. Mục này đang gom **toàn bộ cỡ của mọi loại hàng vào chung một danh sách**, nên vừa nhìn lộn xộn vừa **lọc ra sai hàng**.

Số liệu đo trên hệ thống đang chạy ngày 14/08/2026:

- Cửa hàng có **176 sản phẩm đang bán**, trong đó **109 sản phẩm có cỡ**.
- Trang "Tất cả sản phẩm" đang hiện **52 ô cỡ** trong một danh sách phẳng.
- Danh sách sắp theo "sản phẩm nhiều nhất" chứ không theo thứ tự cỡ, nên **S nằm sau XXL**, và cỡ giày `42` chen vào giữa các cỡ chữ ngay trong 10 ô hiện đầu tiên.
- **Bấm cỡ `42` trả về 12 đôi giày và 1 cái quần giáp.** Cùng con số nhưng một bên là cỡ chân, một bên là vòng eo. Đây là lỗi nặng nhất, không phải chuyện thẩm mỹ.
- Ngay trong một nhóm hàng cũng chưa ổn: nhóm **"Áo quần mô tô phượt" ra 43 ô cỡ**, vì áo dùng cỡ chữ còn quần dùng cỡ số. Riêng **Mũ bảo hiểm (9 ô)** và **Giày (10 ô)** thì đã gọn sẵn — đừng làm hỏng hai chỗ này.

Lý do gốc: hệ thống đang coi "Kích cỡ" là **một loại cỡ duy nhất dùng chung cho mọi mặt hàng**, trong khi cửa hàng thực tế đang bán theo **6 thang cỡ khác nhau**:

| Thang cỡ | Loại hàng | Giá trị đang có trong kho |
|---|---|---|
| Cỡ chữ – mũ | Mũ bảo hiểm | XS, S, M, L, XL, XXL + cỡ ghép XS/S, M/L, XL/2XL |
| Cỡ chữ – găng tay | Găng tay | XS → 3XL + cỡ ghép XS/S, M/L |
| Cỡ chữ – đồ mặc | Áo, quần, đồ mưa, đồ lót | XS → 5XL, cỡ nữ WS/WM/WL, big size BM/BL/BXL/2BM/2BL |
| Cỡ giày | Giày | 36 → 45 |
| Cỡ eo (inch) | Quần jean, quần vải | 28, 30, 32, 33, 34, 36, 38, 40, 42 |
| Cỡ áo quần châu Âu | Áo, quần adventure | 46 → 62, và dạng cặp 30/44, 31/46, 32/48… |

Chỉ **5 nhóm hàng gốc** có cỡ: Áo quần mô tô phượt (51 sản phẩm), Mũ bảo hiểm (20), Găng tay (19), Giày (13), Phụ kiện khác – Đồ lót – Đồ mưa (6). Khối lượng rà soát dữ liệu **không lớn**.

---

## 1. Kết quả mong muốn — mô tả bằng cái khách nhìn thấy

Sau khi làm xong:

1. Trên trang "Tất cả sản phẩm" và trang Tìm kiếm, mục Kích cỡ **không còn là một danh sách phẳng**, mà tách thành **3 khối gập lại được**, khách bấm mở khối mình quan tâm:

   - **Cỡ đồ mặc (chữ)** — XS, S, M, L, XL, XXL, 3XL, 4XL, 5XL; dòng phụ **Nữ:** WS, WM, WL; dòng phụ **Big size:** BM, BL, BXL. Các cỡ ghép (XS/S, M/L, XL/2XL) nằm đúng vị trí trong thang.
   - **Cỡ giày** — 36 → 45.
   - **Cỡ quần theo số** — dòng **Eo (inch):** 28 → 42; dòng **Châu Âu:** 46 → 62.

2. **Thứ tự trong mỗi khối là thứ tự cỡ thật** (nhỏ → lớn), không phải "sản phẩm nhiều nhất trước". Nữ và big size xếp thành nhóm phụ ở cuối khối cỡ chữ.

3. **Bấm cỡ ra đúng loại hàng.** Bấm `42` trong khối "Cỡ giày" chỉ ra giày. Bấm `42` trong khối "Cỡ quần theo số" chỉ ra quần. Không còn cảnh trộn giày với quần.

4. Trang **một nhóm hàng cụ thể** chỉ dùng một thang cỡ (ví dụ Mũ, Giày) thì hiển thị **một danh sách duy nhất như hiện nay**, không cần chia khối — chỉ khác là sắp đúng thứ tự. Không được biến trang Mũ đang gọn thành 3 khối rỗng.

5. Khách **chọn được nhiều cỡ cùng lúc** (người mặc vừa cả L và XL chọn được cả hai).

6. Ô lọc chắc chắn ra 0 sản phẩm (sau khi khách đã chọn thương hiệu / nhóm hàng khác) thì **không hiện ra nữa**, để khách không bấm vào trang trống.

7. Số trong ngoặc bên cạnh mỗi cỡ **đúng với những gì khách đang xem** trên trang đó.

> **Chấp nhận có chủ ý:** vì mũ, găng tay và áo quần dùng chung thang cỡ chữ, bấm "M" ở trang "Tất cả sản phẩm" sẽ ra cả mũ M, áo M lẫn găng M. Owner đã cân nhắc và chọn như vậy — **đừng tự tách thêm nhóm**.

---

## 2. Owner đã chốt — làm theo, không hỏi lại

1. **Gom 3 nhóm cỡ** như mục 1, không phải 6 nhóm chi tiết, cũng không phải ẩn hẳn bộ lọc cỡ.
2. **Làm đủ cả 4 phần việc ở mục 3**, kể cả phần chuẩn hoá dữ liệu — không dừng ở "sửa hiển thị cho đẹp".
3. **Cỡ trùng nghĩa phải gộp thành một ô.** Hiện `XXL` (57 sản phẩm) và `2XL` (4 sản phẩm) đang là hai ô riêng dù là cùng một cỡ. Thang chữ chốt dùng: XS, S, M, L, XL, **XXL**, 3XL, 4XL, 5XL — gộp mọi cách viết khác về đúng một trong các cỡ này.
4. **Cỡ quần dạng cặp (30/44, 31/46…) giữ nguyên cách viết**, xếp theo con số đầu tiên. Không tự tách đôi, không tự đổi sang một chuẩn khác.
5. **Cách xác định một cỡ thuộc nhóm nào phải là do khai báo, không phải do hệ thống đoán.** Không chấp nhận cách làm "nhìn thấy số từ 36 đến 45 thì đoán là giày" — vì cỡ eo quần cũng rơi vào khoảng đó. Mỗi mặt hàng phải được gắn rõ đang dùng bảng cỡ nào, và **thêm loại hàng mới sau này không được bắt sửa code**.

---

## 3. Bốn phần việc

Làm theo thứ tự này. Mỗi phần xong in một dòng tiến độ rồi sang phần kế ngay.

### Phần 1 — Sắp đúng thứ tự cỡ và sửa số đếm sai

Ngoài trang "Tất cả sản phẩm", **trang Tìm kiếm** và **trang Thương hiệu** đang lấy danh sách cỡ và số đếm của **toàn bộ cửa hàng**, không theo kết quả khách đang xem. Khách vào một thương hiệu chỉ có vài sản phẩm vẫn thấy đủ 52 ô cỡ, kèm số đếm của cả shop. Phải khoanh lại đúng ngữ cảnh của từng trang.

Cùng lúc, chuyển thứ tự sắp xếp cỡ từ "nhiều sản phẩm nhất" sang "thứ tự cỡ thật".

### Phần 2 — Chia bộ lọc thành 3 khối

Dựng phần hiển thị theo mục 1. Ưu tiên **dùng lại thành phần giao diện đã có sẵn** trong web (khối lọc, danh sách gập/mở) thay vì tạo mới. Không tạo trang mới, không đổi đường dẫn trang.

### Phần 3 — Khai báo bảng cỡ và rà lại dữ liệu sản phẩm

Đây là phần khiến vấn đề không tái phát, và là phần tốn công nhất.

- Cho phép khai báo **bảng cỡ** trong phần quản trị, và khi tạo phân loại hàng thì chọn đúng bảng cỡ. **Phần khai báo thuộc tính phân loại trong màn hình sản phẩm đã có sẵn** — tận dụng, đừng dựng màn hình quản trị mới nếu không thực sự cần.
- Rà lại **109 sản phẩm có cỡ**, gán đúng bảng cỡ. Phần lớn suy được từ nhóm hàng; riêng nhóm "Áo quần mô tô phượt" phải phân biệt áo (cỡ chữ) với quần (cỡ số) theo từng mẫu.
- Dọn dữ liệu bẩn: khoảng **5% dòng cỡ đang là chữ nhập tay tự do**, chưa gắn vào bảng cỡ nào; có cả cỡ viết thường. Chuẩn hoá hết.
- Sau khi rà xong, **kiểm lại từng nhóm hàng** để chắc không mẫu nào rơi vào nhóm cỡ sai.

### Phần 4 — Chọn nhiều cỡ và ẩn ô vô nghĩa

Cho chọn nhiều cỡ cùng lúc (mục 1.5) và ẩn ô chắc chắn ra 0 kết quả (mục 1.6).

---

## 4. Ràng buộc — dễ làm hỏng, đọc kỹ

- **Đường dẫn lọc cũ phải vẫn chạy.** Khách đã lưu link, và công cụ tìm kiếm đã biết một số đường dẫn lọc cỡ. Sau khi đổi, link cũ **không được ra trang trống hoặc trang lỗi** — vẫn phải ra đúng hàng như trước.
- **Không đụng vào cách sắp xếp cây nhóm hàng** trong kho. Nhóm hàng giữ nguyên; chỉ gắn thêm thông tin bảng cỡ.
- **Không đụng bộ lọc màu, thương hiệu, giới tính, khoảng giá** ngoài phần bắt buộc để số đếm đúng ngữ cảnh.
- **Trang chi tiết sản phẩm và bảng chọn cỡ khi mua hàng phải giữ nguyên hành vi.** Việc chuẩn hoá cỡ không được làm mất phân loại đang bán hoặc làm sai tồn kho của từng cỡ.
- **Trợ lý ảo cũng đang đọc dữ liệu cỡ** để trả lời khách. Sau khi chuẩn hoá, kiểm lại vài câu hỏi kiểu "mẫu này còn cỡ nào" để chắc trợ lý vẫn trả lời đúng. Lưu ý mỗi lần thử tiêu một lượt AI thật (trần 120 lượt/ngày) — chỉ thử vài ca xác nhận cuối.
- **Sản phẩm ngừng bán vẫn phải bị loại khỏi bộ lọc và số đếm** như hiện nay.

---

## 5. Yêu cầu chất lượng chung

- **Song ngữ:** mọi chữ mới hiện cho khách (tên 3 khối cỡ, dòng phụ "Nữ", "Big size", "Eo (inch)", "Châu Âu") phải có **cả tiếng Việt và tiếng Anh**, không viết chữ thẳng vào giao diện.
- **Tiếng Việt có dấu đầy đủ**, không lỗi font.
- **Dùng lại thành phần giao diện có sẵn**, theo đúng hệ thống thiết kế của web khách hàng (màu, phông, khoảng cách, bo góc lấy từ bộ chuẩn — không tự chọn màu riêng).
- **Có kiểm thử tự động** cho: việc chia cỡ vào đúng nhóm, thứ tự cỡ trong từng nhóm, việc gộp cỡ trùng nghĩa, và việc bấm cỡ giày không ra quần.
- **Chạy đầy đủ bước kiểm tra trước khi chốt** theo quy trình sẵn có của repo.
- Xong thì **kiểm thử thật trên hệ thống đang chạy**: mở trang "Tất cả sản phẩm", trang Tìm kiếm, trang Thương hiệu, trang nhóm Mũ, nhóm Giày, nhóm Áo quần — trên cả màn hình máy tính và điện thoại — rồi chụp lại.

---

## 6. Báo cáo cuối — viết cho chủ shop đọc, không dùng từ kỹ thuật

1. Trước / sau: trang "Tất cả sản phẩm" từ **52 ô cỡ lộn xộn** còn bao nhiêu khối, mỗi khối bao nhiêu ô.
2. Xác nhận bấm cỡ `42` ở khối "Cỡ giày" ra bao nhiêu sản phẩm và **toàn bộ có phải giày không**.
3. Bảng liệt kê **mỗi nhóm hàng đang dùng bảng cỡ nào**, và số sản phẩm đã gán.
4. Danh sách **sản phẩm phải sửa tay** vì không tự suy được nhóm cỡ.
5. Danh sách **cỡ đã gộp** (cỡ nào gộp vào cỡ nào, mỗi cái bao nhiêu sản phẩm).
6. Phần nào **chưa làm được** và vì sao.
7. Ảnh chụp màn hình bộ lọc mới trên máy tính và điện thoại.
