# Nhiệm vụ: Rút gọn màn "Quản lý scale kích cỡ" trong trang quản trị (14/08/2026)

Đọc `AGENTS.md` trước. Tuân thủ Docs-First Contract: thay đổi chạm quy tắc kinh doanh / hợp đồng dữ liệu / cách lọc → **cập nhật tài liệu trước, rồi sửa code, trong cùng một PR**. Cite evidence path trong response.

**Chế độ chạy:** một lần gọi = chạy tới xong, không dừng giữa chừng xin duyệt. Owner đã chốt sẵn ở mục 2 — **không hỏi lại những điều đó**. Vướng kỹ thuật không vượt được → ghi `Not run: <lý do>` rồi chạy tiếp việc khác.

**Môi trường:** stack chạy sẵn trong Docker (web khách, quản trị, máy chủ, cơ sở dữ liệu, kho ảnh, bộ nhớ đệm). Chạy `docker ps` trước khi dùng; container cần dùng chưa chạy thì **dừng, báo owner**, không tự khởi động lại. Trong container mặc định **chỉ đọc**; thao tác sửa/xoá dữ liệu thật phải hỏi owner trước. **Không mock dữ liệu** khi hệ thống thật đang chạy và tra được.

---

## 0. Bối cảnh — vấn đề đang có thật

Trong trang quản trị, khi sửa một sản phẩm có cỡ, người dùng bấm vào nút mở bảng **"Quản lý scale kích cỡ"**. Đây là nơi khai báo các thang cỡ của cửa hàng (cỡ chữ mũ, cỡ giày, cỡ eo inch…) và các cỡ nằm trong từng thang.

Bảng này **bắt nhập 13 ô cho một việc rất đơn giản**: 6 ô cho bản thân thang cỡ, và **7 ô cho mỗi một cỡ**. Một thang có 17 cỡ như "Cỡ chữ đồ mặc" là 119 ô phải điền. Người vận hành cửa hàng không hiểu phần lớn các ô đó dùng để làm gì.

Số liệu đo trên hệ thống đang chạy ngày 14/08/2026 — **6 thang cỡ, tổng 73 cỡ**:

| Ô đang bắt nhập | Thực tế trong dữ liệu |
|---|---|
| Mã giá trị / Nhãn tiếng Việt / Nhãn tiếng Anh của mỗi cỡ | **73/73 dòng cả 3 ô giống hệt nhau.** "M" phải gõ 3 lần, "42" phải gõ 3 lần |
| Thứ tự hiển thị | toàn 10, 20, 30 đều tăm tắp — thực chất chỉ là thứ tự dòng trên bảng |
| Tên tiếng Anh của thang cỡ | **khách không bao giờ nhìn thấy.** Bộ lọc trên web chỉ hiện tên nhóm ("Cỡ giày"), không hiện tên thang |
| Ô "Namespace lọc" | gần trùng ý với ô "Nhóm hiển thị" nằm ngay bên cạnh, người dùng không phân biệt nổi |
| Nhóm phụ (3 ô: mã + tên Việt + tên Anh) | **3 trong 6 thang bỏ trống hoàn toàn.** 2 thang khác gán y hệt một nhóm phụ cho **mọi** dòng, tức là thừa |

Nói gọn: trong 13 ô chỉ có **3 thứ thật sự mang thông tin** — tên thang cỡ, thang này thuộc nhóm lọc nào, và danh sách cỡ theo đúng thứ tự.

---

## 1. Kết quả mong muốn — mô tả bằng cái người dùng nhìn thấy

Sau khi làm xong, bảng "Quản lý scale kích cỡ" chỉ còn **3 ô nhập**:

```
QUẢN LÝ SCALE KÍCH CỠ

  Danh sách thang cỡ        Tên thang cỡ  [ Cỡ chữ mũ bảo hiểm          ]
  ─────────────────         Nhóm lọc      [ Cỡ đồ mặc (chữ)         ▾  ]
  › Cỡ chữ mũ bảo hiểm
    Cỡ chữ găng tay         Các cỡ trong thang
    Cỡ chữ đồ mặc           (mỗi cỡ cách nhau dấu phẩy, gõ theo đúng
    Cỡ giày châu Âu          thứ tự muốn hiện cho khách)
    Cỡ vòng eo inch         ┌────────────────────────────────────────┐
    Cỡ đồ mặc châu Âu       │ XS, XS/S, S, M, M/L, L, XL,            │
    [ + Tạo thang mới ]     │ XL/2XL, XXL                            │
                            └────────────────────────────────────────┘

                                      [ Lưu ]    [ Xóa thang cỡ ]
```

Cụ thể:

1. **Thang cỡ chỉ còn 2 ô:** *Tên thang cỡ* (gõ tự do, tiếng Việt) và *Nhóm lọc* (chọn từ danh sách có sẵn).

2. **Các cỡ nhập bằng một khung duy nhất.** Người dùng gõ liền một mạch, cách nhau bằng dấu phẩy: `XS, S, M, L, XL`. Thứ tự gõ chính là thứ tự khách nhìn thấy trên web. Sửa thứ tự = kéo chữ trong khung, không cần đụng ô số nào.

3. **Không còn các ô sau — xóa khỏi màn hình:**
   - Mã scale (tự sinh từ tên thang)
   - Namespace lọc (tự suy ra từ Nhóm lọc đã chọn)
   - Tên tiếng Anh của thang (khách không thấy)
   - Thứ tự hiển thị của thang (theo thứ tự trong danh sách bên trái)
   - Mã giá trị và Nhãn tiếng Anh của từng cỡ (bằng đúng chữ người dùng gõ)
   - Thứ tự của từng cỡ (theo thứ tự gõ)
   - Cả 3 ô nhóm phụ

4. **Vào lại bảng phải thấy đúng cái mình vừa gõ.** Mở một thang cỡ có sẵn thì khung danh sách hiện lại đầy đủ các cỡ, cách nhau dấu phẩy, đúng thứ tự — không phải khung rỗng.

5. **Báo lỗi bằng tiếng người.** Gõ trùng cỡ trong cùng một thang → báo "Cỡ M bị lặp lại"; xóa thang đang có sản phẩm dùng → báo "Thang cỡ này đang được N sản phẩm sử dụng, không xóa được".

6. **Không đụng vào phần chọn thang cỡ ở màn sửa sản phẩm.** Ô chọn thang cỡ trong trang sản phẩm giữ nguyên như hiện tại.

---

## 2. Owner đã chốt — không hỏi lại, không đề xuất khác

1. **Bỏ hẳn nhãn tiếng Anh của từng cỡ.** Cỡ là ký hiệu chung: M, XL, 42 giống nhau ở mọi ngôn ngữ, và dữ liệu thật đã chứng minh 73/73 dòng trùng nhau. Web bản tiếng Anh dùng chung một chữ đó.

2. **Bỏ hẳn nhóm phụ.** Chấp nhận việc trên bộ lọc web, 11 cỡ nữ và big size (`WS WM WL`, `BM BL BXL 2BM 2BL`) sẽ nằm phẳng chung dãy với `XS → 5XL`, **không còn tiêu đề "Nữ" và "Big size" riêng**. Owner chấp nhận vì tên cỡ đã tự nói lên (W = nữ, B = big size).
   > ⚠️ Điều này **thay thế** một phần bản mô tả trong `PROMPT_CODEX_BO_LOC_KICH_CO_2026_08_14.md` (mục 1.1 có nhắc dòng phụ "Nữ" và "Big size"). Đây là quyết định mới của owner, **không phải lỗi cần khôi phục lại**.

3. **Giữ nguyên quyết định gộp nhóm cỡ chữ.** Mũ, găng tay và áo quần vẫn chung một nhóm lọc "Cỡ đồ mặc (chữ)"; bấm "M" ra cả mũ M, áo M lẫn găng M. Owner đã cân nhắc trước đó — **đừng tự tách thêm**.

4. **Không được để mất dữ liệu cũ.** 6 thang cỡ và 73 cỡ đang chạy phải tự chuyển sang cách lưu mới, người vận hành **không phải nhập lại gì cả**.

### ⚠️ Một điểm owner cần xác nhận trước khi gửi prompt này đi

Nhóm lọc **"Cỡ quần theo số"** hiện đang gộp 2 thang khác hẳn nhau: **cỡ vòng eo inch (28 → 42)** và **cỡ châu Âu (46 → 62)**. Trên web chúng đang được tách nhau nhờ 2 tiêu đề phụ. Bỏ nhóm phụ đi thì 25 nút dồn thành một dãy liền `28 30 32 … 42 46 48 … 62` — khách không biết đâu là số đo eo, đâu là chuẩn EU.

**Cách xử lý đề xuất (đã viết sẵn vào mục 3 bên dưới):** tách "Cỡ quần theo số" thành **2 nhóm lọc riêng** — *Cỡ quần (eo inch)* và *Cỡ quần (EU)*. Bộ lọc web thành 4 nhóm thay vì 3, khách vẫn phân biệt được, và màn nhập **vẫn đúng 3 ô** (chỉ là chọn mục khác trong ô Nhóm lọc có sẵn).

> Owner không đồng ý tách → gạch bỏ dòng tương ứng ở mục 3 và giữ 3 nhóm như cũ, chấp nhận 25 nút liền dãy.

---

## 3. Chuyển dữ liệu cũ sang cách lưu mới

Làm tự động, một lần, không cần người vận hành thao tác:

| Dữ liệu cũ | Chuyển thành |
|---|---|
| Tên tiếng Việt của thang | Tên thang cỡ (giữ nguyên) |
| Tên tiếng Anh của thang | bỏ |
| Mã scale, Namespace lọc, Thứ tự thang | bỏ khỏi màn hình; hệ thống tự lo |
| Các cỡ trong thang | ghép lại thành một dòng, cách nhau dấu phẩy, **giữ đúng thứ tự đang hiện** |
| Nhãn tiếng Anh của từng cỡ | bỏ (đã xác minh trùng 100% với tiếng Việt) |
| Nhóm phụ của từng cỡ | bỏ |
| Nhóm lọc "Cỡ quần theo số" | **tách đôi:** thang cỡ vòng eo inch → nhóm *Cỡ quần (eo inch)*; thang cỡ đồ mặc châu Âu → nhóm *Cỡ quần (EU)* |

Sau khi chuyển, tự kiểm và ghi vào báo cáo: **vẫn đủ 6 thang cỡ và 73 cỡ**, không thiếu dòng nào, thứ tự trong từng thang không đảo.

---

## 4. Ràng buộc không được phá

1. **Sản phẩm đang gắn thang cỡ nào thì giữ nguyên thang đó.** Không sản phẩm nào được đổi cỡ hoặc mất cỡ sau khi làm.

2. **Bộ lọc kích cỡ trên web vẫn chạy đúng.** Bấm `42` trong nhóm "Cỡ giày" chỉ ra giày; bấm `42` trong nhóm cỡ quần chỉ ra quần. Không được để tái diễn cảnh trộn giày với quần.

3. **Số đếm bên cạnh mỗi cỡ vẫn đúng** với những gì khách đang xem trên trang đó.

4. **Giao diện theo đúng hệ thiết kế của trang quản trị** — dùng lại thành phần giao diện có sẵn, không tự đặt màu/khoảng cách riêng, không tự tạo thành phần trùng cái đã có.

5. **Toàn bộ chữ tiếng Việt phải có dấu đầy đủ**, không lỗi phông. Có bản tiếng Việt thì phải có bản tiếng Anh tương ứng cho phần giao diện quản trị.

6. **Tài liệu phải cập nhật cùng lúc** — phần mô tả cấu trúc dữ liệu cỡ, phần mô tả các đường gọi dữ liệu của trang quản trị, và phần mô tả luồng bộ lọc trên web.

---

## 5. Nghiệm thu — tự chạy trước khi báo xong

Chạy trên hệ thống thật đang chạy trong Docker, không dùng dữ liệu giả:

1. Mở bảng "Quản lý scale kích cỡ" từ một sản phẩm có cỡ → **đếm đúng 3 ô nhập**, không còn ô kỹ thuật nào.
2. Mở lần lượt cả 6 thang cỡ → khung danh sách hiện đủ các cỡ, đúng thứ tự, không rỗng.
3. Tạo thử một thang mới, gõ `S, M, L`, lưu, đóng bảng, mở lại → thấy đúng `S, M, L`. Sau đó xóa thang thử này đi.
4. Sửa thứ tự trong một thang có sẵn (đổi chỗ 2 cỡ), lưu → ra web xem bộ lọc, thứ tự đổi theo.
5. Thử xóa một thang đang có sản phẩm dùng → phải bị chặn kèm câu báo dễ hiểu.
6. Ra trang "Tất cả sản phẩm" của web khách, mục Kích cỡ → **đếm đủ số nhóm** (4 nhóm nếu tách quần, 3 nếu owner giữ nguyên), thứ tự cỡ trong mỗi nhóm nhỏ → lớn, bấm thử `42` ở nhóm giày và ở nhóm quần, xác nhận ra đúng loại hàng.
7. Kiểm cả trang Tìm kiếm và trang một nhóm hàng cụ thể (Mũ, Giày) — không được biến trang đang gọn thành nhiều nhóm rỗng.
8. Chạy đủ bộ kiểm tra chất lượng của cả 3 phần (web khách, quản trị, máy chủ) trước khi báo xong.

---

## 6. Báo cáo cuối

Ghi ngắn gọn, ngôn ngữ kinh doanh:

- Trước / sau: số ô phải nhập cho một thang cỡ, và cho một thang có 17 cỡ.
- Xác nhận **6 thang / 73 cỡ** còn nguyên sau khi chuyển dữ liệu.
- Ảnh chụp màn hình bảng "Quản lý scale kích cỡ" sau khi rút gọn.
- Ảnh chụp bộ lọc Kích cỡ trên web khách sau khi làm.
- Danh sách tài liệu đã cập nhật.
- Phần nào **không chạy được** thì ghi rõ `Not run: <lý do>`, đừng bỏ lửng.
