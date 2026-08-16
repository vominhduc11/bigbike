# Nhiệm vụ: Dọn dứt điểm phần chuyển hướng link cũ của bigbike.vn (14/08/2026)

Đọc `AGENTS.md` trước. Tuân thủ Docs-First Contract: thay đổi chạm quy tắc kinh doanh / hợp đồng dữ liệu / trạng thái → **cập nhật tài liệu trước, rồi sửa code, trong cùng một PR**. Cite evidence path trong response.

Đây **không** phải "tự ý fix cái đã bị audit flag" — đây chính là task riêng owner giao để xử lý các finding đó. Cứ làm tới xong.

**Chế độ chạy:** một lần gọi = chạy tới xong, không dừng giữa chừng xin duyệt. Owner đã chốt sẵn ở mục 2 — **không hỏi lại 4 điều đó**. Vướng kỹ thuật không vượt được → ghi `Not run: <lý do>` rồi chạy tiếp việc khác.

---

## 0. Bối cảnh

BigBike đã chuyển từ web cũ sang web mới. Có một danh sách 241 đường dẫn cũ còn nhận lượt truy cập (**4.067 lượt bấm trong 180 ngày**) cần bảo đảm khách bấm vào là tới đúng chỗ.

Ngày **14/08/2026** đã chạy một đợt kiểm hiện trạng: bấm thử **toàn bộ 241 đường dẫn** trên hệ thống thật đang chạy, đối chiếu với dữ liệu thật. Kết quả tổng:

| Khách bấm link cũ thì thấy gì | Số link | Lượt bấm |
|---|---|---|
| Đúng trang sản phẩm | 151 | 2.754 (67%) |
| Trang "Đã ngừng bán" đàng hoàng | 30 | 389 (9%) |
| Đúng trang thương hiệu | 8 | 343 (8%) |
| Đúng bài viết | 14 | 153 (3%) |
| Đúng trang nhóm hàng (link nhóm hàng cũ) | 11 | 31 (1%) |
| ⚠️ Rơi về trang chủ, mất bộ lọc | 6 | 180 (4%) |
| ⚠️ Rơi về trang liệt kê tất cả sản phẩm | 4 | 120 (2%) |
| ⚠️ Link sản phẩm bị đổ về trang nhóm hàng | 6 | 58 (1%) |
| ❌ Trang trắng (lỗi) | 10 | 29 (1%) |

Tức phần lớn đã ổn. Việc còn lại là **7 vấn đề ở mục 3**, đã xác minh bằng dữ liệu thật, **không cần điều tra lại từ đầu** — chỉ cần verify khi sửa.

**Cảnh báo về nguồn tin:** có một bảng thống kê chuyển hướng do bên SEO gửi (241 dòng, cột "kết quả" ghi OK/SAI/404). **Bảng đó đã lỗi thời** — nhiều mục bảng chấm sai thì hệ thống đã sửa xong, và ngược lại bảng chấm "OK" thì thực tế lại hỏng. **Không dùng bảng đó làm chuẩn.** Chuẩn duy nhất là kết quả bấm thử trên hệ thống thật.

**Môi trường:** stack chạy sẵn trong Docker (web, backend, admin, cơ sở dữ liệu, kho ảnh). Chạy `docker ps` trước khi dùng; container cần dùng chưa chạy thì **dừng, báo owner**, không tự khởi động lại. Trong container mặc định **chỉ đọc**; thao tác ghi/xoá/restart phải hỏi owner trước (AGENTS.md §5.6).

> ⚠️ **Khi bấm thử hàng loạt, phải giãn nhịp (~0,5 giây một lần gọi), không quét dồn dập nhiều luồng.** Chính việc quét dồn dập là nguyên nhân gây ra kết quả sai ở V6 dưới đây — quét ẩu sẽ ra số liệu ẩu.

---

## 1. Nguyên tắc bắt buộc giữ

- Mọi chuyển hướng dùng loại **vĩnh viễn**, **tối đa 1 chặng** — không đi vòng.
- **Không đưa link của một sản phẩm cụ thể về trang nhóm hàng hay trang liệt kê chung** — Google chấm đó là trang lỗi trá hình.
- Link bản tiếng Anh phải tới đích tiếng Anh, không đi vòng qua bản tiếng Việt.
- Hàng đã ngừng kinh doanh thì cho khách xem **trang "Đã ngừng bán"** có tên hàng và gợi ý hàng cùng loại — không để trang trắng.

---

## 2. Owner đã chốt — làm theo, không hỏi lại

1. **Bộ lọc theo size: làm thật.** Bổ sung bộ lọc theo size vào trang danh sách sản phẩm, rồi trỏ các link lọc size cũ vào đúng kết quả lọc tương ứng.
2. **Hàng cũ không còn bán: dùng trang "Đã ngừng bán" + gợi ý hàng thay thế.** Đúng như cách đang làm với các mặt hàng Kriega, Forma, SMK — hiện tên hàng cũ, báo đã ngừng kinh doanh, gợi ý hàng cùng loại đang bán. **Không** đá thẳng khách sang một mặt hàng khác tên.
3. **Ba nhóm hàng đã xoá (Áo lót · Vớ – Ống tay · Kính thay – Pinlock): trỏ sang nhóm hàng gần nhất còn bán.** Không mở lại 3 nhóm này.
4. **Được phép tự sửa dữ liệu luật chuyển hướng trên hệ thống đang chạy** (bật/tắt, đổi đích, thêm luật mới) — nhưng **phải ghi lại đầy đủ mọi thay đổi** trong báo cáo cuối để owner soát. Riêng thao tác xoá dữ liệu hoặc restart dịch vụ thì vẫn phải hỏi trước.

---

## 3. Bảy vấn đề đã xác minh

Xếp theo mức thiệt hại kinh doanh. Làm từ trên xuống.

### V1 — Mũ Caberg Drift Evo II Carbon đang bán nhưng khách không vào được từ bất kỳ đâu 🔴

Trong hệ thống đang tồn tại **hai bản** của chiếc mũ này: một bản đã bỏ vào thùng rác và một bản đang bán bình thường. Hiện có một luật chuyển hướng **kéo bản đang bán sang bản trong thùng rác**, nên bất kỳ ai bấm vào cũng gặp trang trắng — kể cả khách bấm từ menu hay từ trang nhóm hàng trên web, chứ không riêng khách vào từ link cũ. Chiếc mũ này coi như đang biến mất khỏi cửa hàng.

**Yêu cầu:**
- Khách vào được trang bán của chiếc mũ này từ mọi đường: link cũ, menu, trang nhóm hàng, tìm kiếm.
- **Rà soát toàn bộ các luật chuyển hướng khác** xem còn trường hợp nào đang trỏ vào mặt hàng đã bỏ thùng rác, đã ẩn hoặc không còn tồn tại. Đây là lỗi loại "âm thầm mất doanh thu", phải quét hết chứ không sửa mỗi ca này.
- Bổ sung một chốt chặn để về sau **không thể** lưu được một luật trỏ vào mặt hàng/nhóm hàng đã bị xoá hoặc đang ẩn.

### V2 — Bộ lọc theo size không hoạt động, 180 lượt bấm rơi về trang chủ 🔴

Các link cũ dạng lọc theo size đang đưa khách về trang chủ kèm điều kiện lọc, nhưng **trang chủ bỏ qua hoàn toàn điều kiện đó** — đã đếm: có lọc hay không lọc đều hiện đúng cùng một bộ 27 sản phẩm. Khách tìm size lớn bị ném vào trang chủ chung chung.

Các link liên quan: `/size/xxl/page/3` (147 lượt), `/size/3xl` (16), `/size/xxxl` (13), `/size/39` (1), `/size/46` (1).

**Yêu cầu:**
- Trang danh sách sản phẩm có **bộ lọc theo size dùng được thật** (chọn size → danh sách đổi theo), hoạt động cả bản tiếng Việt lẫn tiếng Anh, cả trên máy tính lẫn điện thoại.
- Các link lọc size cũ trỏ vào đúng kết quả lọc tương ứng, **1 chặng**.
- Size không còn hàng nào (ví dụ size 39, 46) thì hiện trang kết quả rỗng có lời nhắn tử tế và gợi ý, **không** để trang trắng.
- Lưu ý: có một link cũ là `/?detail=26-01-13-zy0118t4.html` đang đứng nguyên tại trang chủ — xử lý luôn cho gọn.

### V3 — Bảy mặt hàng cũ còn cho khách xem trang trắng 🟠

| Mặt hàng | Nguyên nhân |
|---|---|
| Găng tay LS2 Vega Man | luật có sẵn nhưng **đang bị tắt** |
| Găng tay moto phượt LS2 Spark Man | luật có sẵn nhưng **đang bị tắt** |
| Mũ 3/4 carbon NIC N03 | luật có sẵn nhưng **đang bị tắt** |
| Quần giáp Dririder Nordic 2 | luật có sẵn nhưng **đang bị tắt** |
| Ví Kriega Stash Wallet | **chưa có luật nào** |
| Mũ fullface LS2 FF807 Dragon Carbon 6K | **chưa có luật nào** |
| Mũ LS2 FF327 Challenger Carbon Fold | đang trỏ vào bản Caberg đã bỏ thùng rác (xem V1) |

**Yêu cầu:** cả bảy đều cho ra **trang "Đã ngừng bán"** theo chốt số 2 của owner. Bốn luật đang tắt hiện đang đá khách sang một mặt hàng khác tên — không dùng cách đó nữa.

### V4 — Ba nhóm hàng đã xoá nhưng vẫn còn link cũ trỏ tới 🟠

Ba nhóm **Áo lót**, **Vớ – Ống tay**, **Kính thay – Pinlock** đã bị xoá khỏi web và không còn mặt hàng nào, nhưng vẫn còn luật chuyển hướng trỏ tới → trang trắng.

Đang ảnh hưởng: Áo lót Sixs TS2 Italy (4 lượt), Ống tay chống nắng Givi BS01DG (3 lượt), và link nhóm hàng "Kính thay LS2" (24 lượt — link này hiện đã ra trang "Đã ngừng bán", cần xác nhận lại sau khi sửa).

**Yêu cầu:** trỏ sang nhóm hàng gần nhất còn bán theo chốt số 3. Rà soát xem còn luật nào khác đang trỏ vào nhóm hàng đã xoá không.

### V5 — Sáu link sản phẩm đang bị đổ về trang nhóm hàng 🟡

Google chấm kiểu này là trang lỗi trá hình. Danh sách (58 lượt):

- Giáp ngực rời RS Taichi TRV079 (19 lượt)
- Túi đuôi xe chống nước Tornado 2 Pack Sack (17)
- Áo giáp Scoyco JK53 Jean (12)
- Áo thun moto thời trang (6)
- Trùm đầu (link cũ dạng mã số, 2)
- Pát chân gương Osopro (2)

**Yêu cầu:** chuyển sang **trang "Đã ngừng bán"** theo chốt số 2; mặt hàng nào thực tế vẫn còn bán thì trỏ thẳng vào đúng trang bán của nó.

> Lưu ý phân biệt: **11 link của nhóm hàng cũ đang trỏ sang nhóm hàng mới là ĐÚNG**, giữ nguyên, không đụng. Chỉ sửa các link vốn là link của một sản phẩm cụ thể.

### V6 — Link tốt vẫn tạm báo trang trắng khi hệ thống bận 🟠

Trong đợt kiểm, lần quét đầu có **15 trên 241 link báo trang trắng, thử lại thì chạy đúng hoàn toàn**. Nguyên nhân: khi việc tra cứu luật chuyển hướng bị chậm quá ngưỡng chờ, hệ thống **ghi nhớ luôn kết quả "không có luật" trong vài phút** rồi mới chịu tra lại. Trong khoảng đó, link vốn tốt vẫn trả trang trắng cho mọi khách.

Đây nhiều khả năng chính là lý do bảng thống kê SEO chấm sai nhiều mục.

**Yêu cầu:**
- Tra cứu hỏng vì chậm/lỗi kết nối thì **không được ghi nhớ như là "không có luật"** — lần sau phải tra lại.
- Có cơ chế chịu tải tốt hơn cho việc tra cứu này (ví dụ nạp sẵn danh sách luật thay vì hỏi từng lần), miễn là khi owner sửa luật thì web cập nhật trong thời gian ngắn và có cách làm mới ngay.
- Chứng minh bằng số: quét lại toàn bộ 241 link **hai lượt liên tiếp**, kết quả hai lượt phải giống hệt nhau.

### V7 — Rà soát và báo cáo: nhiều link cũ đang đưa khách sang hàng của hãng khác ⚪

Hiện có khá nhiều link cũ chuyển khách sang một mặt hàng **khác thương hiệu** — ví dụ balo Kriega chuyển sang balo ILM, giáp lưng Alpinestars chuyển sang giáp lưng LS2, găng Alpinestars chuyển sang găng RS Taichi, túi chống nước Kriega chuyển sang túi ILM.

Nếu đây là chủ ý (hàng cũ ngưng bán, đẩy sang hàng thay thế đang bán) thì chấp nhận được; nếu không thì khách mở ra thấy hàng khác hãng sẽ thoát trang.

**Yêu cầu: chỉ liệt kê, KHÔNG tự đổi.** Lập bảng đầy đủ (link cũ · tên hàng cũ · tên hàng đích · thương hiệu hai bên · lượt bấm), đưa vào báo cáo cuối để owner quyết.

---

## 4. Phạm vi

**Được làm:** phần web khách hàng, phần quản trị, phần máy chủ và dữ liệu luật chuyển hướng — miễn là phục vụ 7 việc trên.

**Không đụng tới:** giá bán, tồn kho, đơn hàng, dữ liệu khách hàng, nội dung bài viết, giao diện/màu sắc/bố cục ngoài phạm vi bộ lọc size ở V2. Không xoá mặt hàng, không xoá nhóm hàng, không đổi tên hàng.

**Không tự quyết thay owner:** gặp mặt hàng không rõ còn bán hay đã ngừng → ghi vào báo cáo, mặc định cho ra trang "Đã ngừng bán" (an toàn hơn trang trắng), **không** tự đá sang hàng khác.

---

## 5. Yêu cầu chất lượng

- **Song ngữ đầy đủ:** mọi chữ hiện ra cho khách (bộ lọc size, trang "Đã ngừng bán", lời nhắn khi rỗng) phải có cả tiếng Việt và tiếng Anh.
- **Tiếng Việt có dấu đầy đủ**, không lỗi phông chữ. Áp dụng cho cả nhãn, chú thích và thông báo.
- **Dùng lại thành phần giao diện có sẵn** của dự án, không tự vẽ mới cái đã có; không hardcode màu/khoảng cách.
- **Có kiểm thử tự động** cho phần mới, và chạy đủ bộ kiểm tra tự động của từng phần đã đụng vào trước khi chốt.
- **Cập nhật tài liệu** cho phần quy tắc kinh doanh và luồng có thay đổi, cùng một PR.
- **Chạy bước kiểm tra trước khi chốt** theo quy trình sẵn có của repo.
- **Xác minh cuối cùng bằng hệ thống thật**, không chỉ bằng kiểm thử: quét lại đủ 241 link, giãn nhịp, hai lượt liên tiếp.

---

## 6. Báo cáo cuối — bắt buộc có

1. **Bảng trước/sau cho đủ 241 link:** link cũ · khách thấy gì trước khi sửa · khách thấy gì sau khi sửa · số chặng. Nêu rõ còn bao nhiêu link chưa xử lý được và vì sao.
2. **Nhật ký thay đổi dữ liệu luật chuyển hướng:** từng luật đã thêm / đã sửa đích / đã bật / đã tắt, kèm lý do. Đây là phần owner soát, viết cho người không rành kỹ thuật đọc được.
3. **Bảng V7** (link đang đưa khách sang hàng khác hãng) để owner quyết.
4. **Bằng chứng V6:** kết quả hai lượt quét liên tiếp giống nhau.
5. **Danh sách việc còn nợ** kèm lý do, ghi rõ `Not run: <lý do>`.
6. Viết báo cáo bằng **ngôn ngữ kinh doanh** — owner là chủ shop, không phải lập trình viên.
