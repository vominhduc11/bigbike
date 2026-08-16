# Việc cần làm: dọn nốt các địa chỉ cũ còn chết trên bigbike.vn

Ngày giao: 15/08/2026. Thay cho `PROMPT_CODEX_REDIRECT_2026_08_14.md`.

## Bối cảnh

Chủ shop đã chốt quy tắc xử lý địa chỉ cũ. Toàn bộ địa chỉ có khách trong 16 tháng gần nhất
(theo báo cáo Google Search Console 13/04/2025 – 12/08/2026) đã được bấm thử trên website thật
ngày 15/08/2026, giãn nhịp và quét 2 lượt để tránh kết quả sai.

**Hiện trạng: 773 địa chỉ đã kiểm — 669 vào được trang sống, 9 đã chủ đích báo "đã gỡ", 95 còn chết.**
Tính theo lượt khách thì 99,4% đã vào đúng chỗ. Phần còn lại là dọn nốt.

Danh sách 95 địa chỉ chết kèm lượt khách, lượt hiển thị và tình trạng backlink:
`DANH_SACH_TRANG_CHET_2026_08_15.csv` (cùng thư mục).

## Quy tắc chủ shop đã chốt

Áp đúng thứ tự này cho từng địa chỉ chết:

1. **Chuyển hướng vĩnh viễn (301)** — khi trang có backlink hợp lý *hoặc* có lượng khách từ trung bình
   trở lên, VÀ tìm được trang đích còn sống thật sự liên quan.
   Đích phải là **đúng thứ khách đang tìm**. Cấm đổ về trang chủ, về danh mục chung chung,
   hoặc về một mặt hàng khác không liên quan — Google coi đó là trang lỗi và huỷ luôn giá trị.

2. **Trang "Đã ngừng bán" (giữ chân khách)** — khi trang vẫn còn giá trị (có backlink hoặc còn nhiều
   lượt hiển thị trên Google) nhưng **không tìm được đích nào thật sự hợp lý**.
   Trang này phải có tên hàng, ảnh, và **gợi ý hàng thay thế cùng nhóm** — nếu chỉ là trang trống báo
   "hết hàng" thì Google vẫn xoá khỏi kết quả tìm kiếm, làm cũng như không.

3. **Báo đã gỡ hẳn (410)** — khi trang vừa không có backlink (hoặc chỉ có backlink rác),
   vừa gần như không còn khách.

**Không được tự ý đổi dữ liệu ngoài phạm vi này. Mọi thay đổi dữ liệu luật chuyển hướng phải báo cáo lại.**

## Việc 1 — Nối lại các mặt hàng ĐANG BÁN mà khách không vào được (ưu tiên cao nhất)

Đây là tiền đang rơi. Các địa chỉ dưới đây đang chết, nhưng mặt hàng vẫn **đang bán bình thường**
trên website. Đã kiểm: tất cả trang đích đều mở được.

| Khách đang bấm vào (chết) | Mặt hàng thật đang bán |
|---|---|
| địa chỉ cũ của mũ dual sport ILM WS902 (3 biến thể: hai bản tiếng Việt và một bản tiếng Anh) | Mũ bảo hiểm dual sport ILM WS902 |
| địa chỉ cũ mũ dual sport Caberg Tanami Carbon (bản có đuôi "2in1") | Mũ bảo hiểm dual sport Caberg Tanami Carbon |
| địa chỉ cũ mũ nửa đầu HJC IS2V | Mũ bảo hiểm nửa đầu Xpeed IS-2V (mặt hàng đã đổi tên thương hiệu) |
| địa chỉ cũ mũ 3/4 LS2 Bob OF601 (địa chỉ có dấu tiếng Việt, đang báo lỗi) | Mũ bảo hiểm 3/4 LS2 Bob OF601 |
| địa chỉ cũ áo bảo hộ nữ LS2 Zoom Lady | Áo moto nữ mùa hè LS2 Zoom Lady |

Xử lý: chuyển hướng 301 từ địa chỉ cũ về đúng mặt hàng.

Riêng địa chỉ có dấu tiếng Việt đang trả về lỗi kỹ thuật thay vì trang không tồn tại — cần xử lý được
cả trường hợp địa chỉ có dấu, đừng để báo lỗi.

## Việc 2 — Hai thương hiệu bị lệch tên

- Địa chỉ `alpinestars` (có chữ "s") đang chết. Trên hệ thống thương hiệu đang lưu tên **`alpinestar`**
  (thiếu chữ "s") và trang đó mở tốt. Nối lại.
- Địa chỉ cũ của thương hiệu **Quadlock** đang chết, trong khi trang thương hiệu Quadlock mở tốt. Nối lại.
- Địa chỉ cũ của **Kriega** và **Enduristan** đang chết, hai thương hiệu này chưa có trên hệ thống và
  **hiện không còn bán mặt hàng nào**. → **Chủ shop đã chốt: báo đã gỡ hẳn (410).** Không tạo trang thương hiệu.
- Địa chỉ cũ dạng "trang 3" của thương hiệu LS2 đang chết → cho về trang thương hiệu LS2.

## Việc 3 — Ba danh mục cũ chết dù danh mục mới vẫn sống

Ba địa chỉ danh mục kiểu cũ đang chết, trong khi **danh mục mới cùng tên vẫn mở bình thường**:
mũ lật hàm/tháo hàm, mũ fullface, và một nhóm "chưa phân loại".

Cả hai dạng địa chỉ (có và không có dấu gạch chéo ở cuối) đều chết — nên đây là lỗi lưới chuyển hướng,
không phải thiếu dữ liệu. Tìm nguyên nhân vì sao nhóm này lọt lưới rồi sửa chung, đừng vá từng cái.

Nhóm "chưa phân loại" không có danh mục tương ứng → báo đã gỡ hẳn.

## Việc 4 — Bộ lọc cỡ và màu chết toàn bộ (18 địa chỉ)

Toàn bộ địa chỉ lọc theo **cỡ** và theo **màu** kiểu cũ đang chết, mất khoảng **3.300 lượt hiển thị**
trên Google trong 16 tháng.

- Phần **lọc cỡ** gắn với việc chủ shop đã chốt ngày 14/08 (gom về 3 nhóm cỡ) — làm chung một đợt.
- Phần **lọc màu** chết hoàn toàn (trắng, đỏ, đen-đỏ, đen-camo, nerve). Dữ liệu mặt hàng hiện **không lưu
  thông tin màu nào**. → **Chủ shop đã chốt: không làm bộ lọc màu.** Cho các địa chỉ lọc màu về nhóm hàng
  tương ứng để giữ lượt hiển thị, không báo gỡ hẳn.

Lưu ý có cả địa chỉ dạng phân trang (trang 2, trang 3, trang 4) — xử lý luôn, đừng bỏ sót.

## Việc 5 — Dọn rác website cũ

- Địa chỉ **trang quản trị WordPress cũ** đang bị Google lập chỉ mục → báo đã gỡ hẳn, và chặn không cho
  Google lập chỉ mục lại.
- Địa chỉ `/home` cũ → cho về trang chủ.
- Địa chỉ cũ của **chính sách bảo mật** đang chết, trong khi trang chính sách bảo mật mới mở tốt → nối lại.
- Địa chỉ cũ của **điều khoản sử dụng** đang chết và website không có trang điều khoản.
  → **Chủ shop đã chốt: cho về trang Chính sách bảo mật.**
- Một địa chỉ tiếng Anh bị lặp đoạn đường dẫn (dạng `/en/en/...`) → cho về đúng nhóm hàng tiếng Anh.

## Việc 6 — 64 trang mặt hàng cũ không còn bán

Đây là nhóm lớn nhất. Đặc điểm chung: **không có backlink nào**, lượng khách rất thấp (1–12 lượt
trong 16 tháng), và **không còn mặt hàng tương ứng** trong kho (kho hiện chỉ còn 208 mặt hàng,
website cũ có nhiều hơn hẳn).

Chia hai nhóm theo lượt hiển thị trên Google trong 16 tháng:

- **Còn nhiều lượt hiển thị (từ 200 trở lên) — khoảng 22 trang:** đưa vào **trang "Đã ngừng bán"**
  kèm gợi ý hàng thay thế cùng nhóm. Vẫn còn người tìm, nên giữ chân khách.
  Nặng nhất: găng tay LS2 Swift Racing (1.298 lượt hiển thị), quần bảo hộ LS2 Commo Air (688),
  áo bảo hộ O'Neal Underdog (779), giáp chân Komine SK690 (734), ống tay chống nắng LS2 (591).
- **Lượt hiển thị thấp — khoảng 40 trang:** báo đã gỡ hẳn.

**Cảnh báo quan trọng:** đừng ghép tự động theo tên gần giống. Đã thử và cho kết quả sai nguy hiểm —
ví dụ quần bảo hộ LS2 Norway bị ghép sang áo nữ mùa hè LS2 Zoom Lady. Ghép sai chủ đề thì Google
huỷ giá trị, đúng thứ chủ shop cấm ở quy tắc 1. **Chỉ nối 301 khi chắc chắn cùng một món hàng
hoặc phiên bản kế nhiệm trực tiếp. Không chắc thì đưa vào trang "Đã ngừng bán".**

## Việc 7 — Trang "Đã ngừng bán" phải quản lý được từ trang quản trị

Hiện danh sách hàng ngừng bán (28 mặt hàng) **nằm cứng trong mã nguồn**. Mỗi lần thêm một mặt hàng
là phải sửa mã và triển khai lại. Trong khi dữ liệu mặt hàng đã có sẵn ô đánh dấu "ngừng bán"
nhưng chưa dùng tới (0 mặt hàng đang dùng).

Việc 6 sẽ đẩy khoảng 22 mặt hàng nữa vào nhóm này → **phải chuyển sang bật/tắt được từ trang quản trị
trước**, nếu không nút thắt sẽ càng nặng.

## Việc 8 — Chặn truy cập thẳng vào máy chủ

Báo cáo backlink cho thấy **43,5% "backlink" (794 liên kết) thực ra là chính website BigBike bị Google
nhìn thấy qua địa chỉ máy chủ thay vì qua tên miền**. Hiện gọi kèm tên miền đã chuyển đúng, nhưng gọi
thẳng vào máy chủ vẫn bị đẩy sang **một website khác chạy chung máy** (4thitek.vn), hoặc báo lỗi máy chủ.

→ Trả về "không tồn tại" cho các lời gọi không kèm tên miền hợp lệ, để Google gỡ dứt điểm 794 địa chỉ ảo đó.
Đừng đẩy sang website khác.

## Không được đụng vào

- **112 trang đang nhận backlink** — đã kiểm toàn bộ ngày 15/08, 111 trang dẫn về trang sống,
  chỉ 1 trang lỗi (đã nằm trong Việc 1). Đừng "tối ưu" lại nhóm này.
- Hai trang túi xe máy có backlink cao nhất (túi đeo hông 169 liên kết, túi treo xe 150 liên kết)
  đang chuyển hướng đúng một chặng về danh mục cùng chủ đề. **Giữ nguyên.**
- **Không disavow backlink.** Có 29 mẫu anchor cờ bạc/casino từ các trang spam bên ngoài, nhưng đã kiểm
  dữ liệu website: **không có mặt hàng hay bài viết nào bị chèn nội dung cờ bạc** — website không bị tấn công.
  Đây là nhiễu thông thường, Google tự bỏ qua. Chỉ xử lý nếu Google gửi cảnh báo chính thức.

## Chủ shop đã chốt (15/08/2026) — không cần hỏi lại

1. **Kriega và Enduristan:** báo đã gỡ hẳn. Không tạo trang thương hiệu rỗng.
2. **Bộ lọc màu:** không làm. Các địa chỉ lọc màu cho về nhóm hàng tương ứng.
3. **Điều khoản sử dụng:** cho về trang Chính sách bảo mật.

Ngoài 3 điểm trên, nếu gặp trường hợp cần chủ shop quyết thì **ghi lại vào báo cáo rồi làm tiếp phần khác**,
đừng dừng cả đợt để chờ.

## Cách làm và báo cáo

- Sửa xong phải **bấm thử lại trên website thật**, giãn nhịp khoảng nửa giây mỗi lần và **quét 2 lượt** —
  quét dồn dập sẽ sinh kết quả 404 giả do bộ nhớ đệm tra cứu, đã từng làm sai lệch báo cáo trước đây.
- Báo cáo cuối phải nêu rõ: mỗi địa chỉ đã xử lý theo cách nào, đích là đâu, và **những địa chỉ chưa xử lý
  kèm lý do**. Không im lặng bỏ qua.
