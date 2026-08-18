# Nhiệm vụ: Làm lại giao diện trang "hàng đã ngừng bán" trên website khách (18/08/2026)

Đọc `AGENTS.md` trước. Tuân thủ Docs-First Contract: thay đổi chạm quy tắc kinh doanh / cách hiển thị đã ghi trong tài liệu → **cập nhật tài liệu trước, rồi sửa code, trong cùng một PR**. Cite evidence path trong response.

**Chế độ chạy:** một lần gọi = chạy tới xong, không dừng giữa chừng xin duyệt. Owner đã chốt sẵn ở mục 2 — **không hỏi lại những điều đó**. Vướng kỹ thuật không vượt được → ghi `Not run: <lý do>` rồi chạy tiếp việc khác.

**Môi trường:** stack chạy trong Docker (web khách, quản trị, máy chủ, cơ sở dữ liệu, kho ảnh, bộ nhớ đệm). Chạy `docker ps` trước khi dùng.

- **Nếu đang ở máy chủ dùng chung:** container cần dùng chưa chạy thì **dừng, báo owner**, không tự khởi động lại. Trong container mặc định **chỉ đọc**; thao tác sửa/xoá dữ liệu thật phải hỏi owner trước. **Không mock dữ liệu** khi dữ liệu thật đang tra được.
- **Nếu đang ở máy cá nhân (máy dev):** được tự khởi động stack và **được tự tạo dữ liệu thử** để kiểm tra — vì cơ sở dữ liệu mới dựng chỉ có sẵn 58 mặt hàng ngừng bán (do bước cài đặt tự nạp), **không có mặt hàng đang bán nào** và kho ảnh trống. Muốn kiểm chứng được các mục 4, 5 và 9 ở phần 1, hãy tự tạo trong trang quản trị: vài mặt hàng đang bán thuộc nhóm *Áo quần bảo hộ* (ít nhất 2 mặt hàng cùng thương hiệu Scoyco, có cả áo lẫn quần để thấy rõ thứ tự ưu tiên), một nhóm hàng không có mặt hàng nào đang bán, và một mặt hàng đang bán rồi gắn cờ ngừng bán cho nó. Ảnh minh hoạ tự tải lên qua trang quản trị. **Tuyệt đối không tạo hay sửa dữ liệu trên máy chủ thật.**
- Trên máy cá nhân, ảnh của các trang lịch sử cũ có thể không hiện (kho ảnh chưa có bản sao) — **đó không phải lỗi cần sửa**, chỉ cần đảm bảo trang có ảnh và trang không có ảnh đều hiển thị đúng như mô tả ở phần 1.

---

## 0. Bối cảnh — vấn đề đang có thật

Khi một mặt hàng ngừng kinh doanh, địa chỉ cũ của nó trên website vẫn mở được và vẫn có khách vào từ Google hoặc từ link cũ. Trang đó hiện ra một "trang lịch sử": tên hàng, một ô ảnh, nhãn *Đã ngừng bán*, hai nút, và ba mặt hàng gợi ý.

Phần kỹ thuật đang đúng: trang vẫn mở bình thường, Google vẫn hiểu đây là hàng ngừng bán chứ không phải trang hỏng, và không có nút mua gây hiểu nhầm. **Phần khách nhìn thấy mới là chỗ hỏng.**

Số liệu đo trên hệ thống đang chạy ngày 18/08/2026 — **58 trang hàng ngừng bán đang bật**:

| Vấn đề khách gặp | Thực tế trong dữ liệu / trên trang |
|---|---|
| Mở trang ra là một ô trống lớn | **39/58 trang (67%) không có ảnh.** Ô ảnh vẫn chiếm nửa bề ngang trên máy tính và gần hết màn hình đầu trên điện thoại, bên trong chỉ có một dòng chữ mờ |
| Gợi ý mua tiếp lấy nhầm mặt hàng | Hệ thống chỉ lấy **3 mặt hàng mới nhất trong cùng nhóm**, không xét thương hiệu, không xét kiểu hàng. Trang áo giáp đang gợi ý **hai cái quần** |
| Không có ai để hỏi | Trên trang chỉ có 2 nút: xem danh mục và về trang chủ. **Không có nút tư vấn Zalo**, dù trang sản phẩm đang bán có |
| Trang không giống trang sản phẩm của shop | Dùng banner ảnh mũ bảo hiểm dùng chung cho mọi mặt hàng; **tên hàng hiện hai lần cỡ lớn**; đường dẫn phía trên thiếu nhóm hàng; mất dải cam kết *giao toàn quốc – chính hãng – bảo hành – freeship* |
| Thương hiệu là ngõ cụt | Ghi "Thương hiệu: Scoyco" nhưng **không bấm được** sang trang hãng đó |
| Câu lưu ý an toàn chiếm chỗ đắt nhất | Câu "đồ bảo hộ giúp giảm chấn thương…" in đậm, nằm ngay **trên** các nút hành động |
| Đường dành cho hàng thật chưa ai đi | **0 sản phẩm đang bán** được gắn cờ ngừng bán. Khi gắn, trang sản phẩm đầy đủ (ảnh bộ, mô tả, thông số, đánh giá) sẽ bị **rút lại còn tên + một ảnh** — vứt đi toàn bộ nội dung đã đầu tư |

Cách các website lớn xử lý cùng bài toán này: **giữ nguyên trang, chỉ thay khu mua hàng bằng khu chỉ đường** — nhãn ngừng bán đặt đúng chỗ nút mua, hàng thay thế đẩy lên cao ngang tầm mắt, và luôn có một lối liên hệ để khách hỏi mẫu tương đương.

---

## 1. Kết quả mong muốn — mô tả bằng cái khách nhìn thấy

Bố cục trang sau khi làm xong (máy tính, trường hợp **có ảnh**):

```
Trang chủ / Áo quần bảo hộ / Áo giáp / Áo bảo hộ Scoyco JK152
                                  ← đường dẫn đầy đủ, KHÔNG còn banner dùng chung

┌──────────────────┐   ┌────────────────────────────────────────┐
│                  │   │  ĐÃ NGỪNG BÁN                          │
│                  │   │  Mặt hàng này shop không còn kinh       │
│     ẢNH HÀNG     │   │  doanh. Xem các mẫu đang bán tương      │
│                  │   │  đương bên dưới, hoặc nhắn Zalo để      │
│                  │   │  được tư vấn mẫu thay thế phù hợp.      │
│                  │   │                                        │
│                  │   │  [ Xem hàng tương đương ]  [ Tư vấn Zalo ]
└──────────────────┘   │  Thương hiệu: Scoyco →   Nhóm: Áo giáp →│
                       └────────────────────────────────────────┘

  Giao toàn quốc – COD · Chính hãng · Bảo hành · Freeship
  ────────────────────────────────────────────────────────────────

  HÀNG ĐANG BÁN TƯƠNG ĐƯƠNG
  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
  │ mẫu 1  │ │ mẫu 2  │ │ mẫu 3  │ │ mẫu 4  │   ← 4–8 mẫu, có ảnh + giá
  └────────┘ └────────┘ └────────┘ └────────┘

  Tìm nhanh mặt hàng khác  [                        ] [Tìm]

  (cỡ nhỏ, cuối trang) Đồ bảo hộ giúp giảm chấn thương chứ không ngăn được tai nạn.
```

Trường hợp **không có ảnh** (39/58 trang): **bỏ hẳn khung ảnh**, toàn bộ nội dung dồn về một cột chạy hết bề ngang — không còn ô rỗng nào trên trang.

Cụ thể những gì phải đạt:

1. **Trang nằm trong khung trang sản phẩm của shop.** Đường dẫn phía trên đủ các cấp nhóm hàng rồi mới tới tên mặt hàng. Bỏ banner ảnh dùng chung. **Tên mặt hàng chỉ xuất hiện đúng một lần** ở vị trí tiêu đề.

2. **Khối trạng thái nằm đúng chỗ khu mua hàng của trang sản phẩm bình thường**, gồm: nhãn *Đã ngừng bán*, một câu giải thích ngắn dễ hiểu, và ba lối đi — nút chính *Xem hàng tương đương* (đưa khách xuống khối gợi ý), nút *Tư vấn Zalo* (dùng đúng cách liên hệ mà trang sản phẩm đang bán đang dùng), và một đường dẫn sang cả nhóm hàng.

3. **Thương hiệu và nhóm hàng bấm được**, dẫn sang trang hãng và trang nhóm hàng tương ứng.

4. **Khối gợi ý phải ra đúng loại hàng.** Đổi tiêu đề thành đại ý *"Hàng đang bán tương đương"*, và chọn theo thứ tự ưu tiên: cùng thương hiệu trước → rồi tới cùng kiểu hàng (áo gợi ý áo, quần gợi ý quần, găng gợi ý găng — nhận biết theo tên mặt hàng) → thiếu bao nhiêu mới lấy thêm hàng khác trong cùng nhóm cho đủ. Hiện **4 đến 8 mẫu**, có ảnh và giá. Trên điện thoại cho cuộn ngang, không để lẻ ô trống trong lưới.

5. **Nhóm hàng đó không còn mẫu nào đang bán** thì thay bằng lối đi khác (nhóm hàng cha, hoặc hàng bán chạy) — **không để khối trống**.

6. **Giữ dải cam kết** *giao toàn quốc – COD, chính hãng, bảo hành, freeship* giống trang sản phẩm đang bán.

7. **Thêm ô tìm kiếm ngay trên trang** để khách gõ thẳng tên mặt hàng khác.

8. **Câu lưu ý an toàn xuống cuối trang, cỡ chữ nhỏ**, không in đậm, không nằm trên các nút.

9. **Sản phẩm đang bán bị gắn cờ ngừng bán thì giữ nguyên trang đầy đủ.** Khách vẫn xem được ảnh bộ, mô tả, thông số, đánh giá, câu hỏi thường gặp như cũ — **chỉ khu giá + nút mua/thêm giỏ bị thay bằng khối trạng thái ở mục 2**. Không cho mua bằng bất kỳ đường nào (kể cả thanh mua hàng dính đáy trên điện thoại). Địa chỉ trang giữ nguyên như hiện tại.

10. **Trên điện thoại**, nhãn ngừng bán và nút hành động chính phải nằm trong màn hình đầu tiên, không phải cuộn.

11. **Song ngữ đầy đủ.** Bản tiếng Anh dịch trọn vẹn, không lẫn tiếng Việt và ngược lại.

---

## 2. Owner đã chốt — không hỏi lại, không đề xuất khác

1. **Lần này chỉ làm giao diện trên website khách.** KHÔNG thêm ô mới trong trang quản trị, KHÔNG đụng cơ sở dữ liệu, KHÔNG thêm trường dữ liệu mới. Việc cho shop tự chỉ định "mẫu thay thế" và "ngừng bán từ ngày nào" để **đợt sau**.

2. **Trang không có ảnh thì bỏ hẳn khung ảnh, dồn về một cột.** Không dùng ảnh minh hoạ mặc định, không mượn ảnh của mặt hàng khác, không để ô rỗng.

3. **Sản phẩm đang bán bị gắn ngừng bán thì giữ nguyên toàn bộ nội dung**, chỉ bỏ khu mua hàng. Không rút gọn trang như 58 trang lịch sử hiện nay.

4. **Không tự động đưa khách sang mặt hàng khác.** Kể cả khi có mẫu mới thay thế hoàn toàn, địa chỉ cũ vẫn mở ra trang lịch sử; khách tự bấm sang mẫu mới.

5. **Trang ngừng bán vẫn không có giá, không có nút mua, không thêm được vào giỏ.**

6. **Không đổi địa chỉ trang, không tạo địa chỉ mới, không xoá hay tắt trang nào** trong 58 trang đang chạy.

7. **Hàng ngừng bán vẫn không được xuất hiện** trong danh sách, tìm kiếm, bộ lọc và các khối hàng trên trang chủ — giữ nguyên như hiện tại.

---

## 3. Phạm vi làm / cấm đụng

**Được làm:** phần hiển thị trang hàng ngừng bán trên website khách; phần hiển thị sản phẩm đang bán bị gắn cờ ngừng bán; chữ hiển thị hai ngôn ngữ của riêng các phần này; và tài liệu mô tả quy tắc hiển thị của trang này.

> ⚠️ Tài liệu hiện ghi trang chỉ hiện **tối đa 3 mặt hàng cùng nhóm** và mô tả bố cục cũ. Yêu cầu mới ở mục 1 vượt qua mô tả đó → **cập nhật tài liệu trước, rồi sửa code, trong cùng một PR**, và ghi rõ đây là quyết định mới của owner ngày 18/08/2026 chứ không phải lỗi cần khôi phục.

**Cấm đụng:** trang quản trị; cơ sở dữ liệu và dữ liệu thật; cách hoạt động của trang sản phẩm đang bán bình thường; danh sách, bộ lọc, tìm kiếm, sơ đồ trang; các quy tắc chuyển hướng địa chỉ cũ. Không thêm thư viện mới. Không tạo thành phần giao diện mới nếu website đã có sẵn cái tương đương.

---

## 4. Yêu cầu chất lượng

- **Dùng lại thành phần sẵn có của website khách** — thẻ mặt hàng, nút bấm, khối cam kết, nút Zalo, ô tìm kiếm. Không vẽ lại kiểu riêng cho trang này.
- **Theo đúng hệ thống thiết kế của website khách** (màu, phông chữ, khoảng cách, bo góc lấy từ bộ chuẩn chung, không tự đặt giá trị rời).
- **Tiếng Việt có dấu đầy đủ, không lỗi phông**; bản tiếng Anh dịch đủ, không sót chữ.
- **Bấm được bằng bàn phím, đọc được bằng trình đọc màn hình**; vùng bấm đủ lớn trên điện thoại.
- **Không làm hỏng phần Google đang hiểu đúng:** trang vẫn mở bình thường, vẫn báo đúng trạng thái ngừng bán, vẫn không bị chặn thu thập, địa chỉ chính thức của trang giữ nguyên.
- **Có kiểm thử tự động** cho các trường hợp: có ảnh, không có ảnh, nhóm hàng không còn mẫu nào đang bán, và sản phẩm đang bán bị gắn cờ ngừng bán. Chạy trọn bộ kiểm tra của website khách trước khi chốt.
- **Kiểm thử thật trên hệ thống đang chạy:** mở ít nhất 3 trang thật (một trang có ảnh, một trang không ảnh, một trang thuộc nhóm hàng ít mẫu), ở cả máy tính lẫn điện thoại, cả tiếng Việt lẫn tiếng Anh; không được có lỗi hiện trên trình duyệt.

---

## 5. Báo cáo cuối

1. Ảnh chụp **trước và sau** của 3 trang thật, ở 2 kích thước màn hình.
2. Danh sách 11 mục ở phần 1 — mục nào đã đạt, mục nào không làm được thì ghi `Not run: <lý do>`.
3. Tài liệu nào đã cập nhật và cập nhật cái gì.
4. Kết quả các bước kiểm tra đã chạy (nêu cả phần chưa xanh và lý do).
5. Việc còn nợ để đợt sau: ô chỉ định mẫu thay thế, ngày ngừng bán và lý do, và bổ sung ảnh cho 39 trang còn thiếu.
