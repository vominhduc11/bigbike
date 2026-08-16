# Nhiệm vụ: Đưa Trợ lý ảo BigBike đạt mức mở cho khách thật (14/08/2026)

Đọc `AGENTS.md` trước. Tuân thủ Docs-First Contract: thay đổi chạm quy tắc kinh doanh / hợp đồng dữ liệu / trạng thái → **cập nhật tài liệu trước, rồi sửa code, trong cùng một PR**. Cite evidence path trong response.

Đây **không** phải "tự ý fix cái đã bị audit flag" — đây chính là task riêng owner giao để xử lý các finding đó. Cứ làm tới xong.

**Chế độ chạy:** một lần gọi = chạy tới xong, không dừng giữa chừng xin duyệt. Owner đã chốt sẵn ở mục 2 — **không hỏi lại 3 điều đó**. Vướng kỹ thuật không vượt được → ghi `Not run: <lý do>` rồi chạy tiếp việc khác.

---

## 0. Bối cảnh

Trợ lý ảo (khung chat trên web khách hàng) đã chạy thật từ 09/08/2026. Đã có **một đợt sửa ngày 13/08** và đợt đó **chạy rồi** — phần việc còn nằm trong cây làm việc **chưa commit**. Ngày **14/08/2026** đã kiểm định lại toàn bộ: đọc code cả ba phần (web khách, máy chủ, quản trị), đối chiếu với bộ quy tắc kinh doanh đã ghi trong tài liệu, đọc lại **113 cuộc trò chuyện thật** trong hệ thống đang chạy, xem nhật ký máy chủ, và **dựng lại tình huống lỗi bằng kiểm thử tạm để xác nhận nguyên nhân**.

**Đã tốt lên rõ, đừng dò lại và đừng làm hỏng:**

| Ngày | Câu khách hỏi | Trợ lý không trả lời được | Tỉ lệ |
|---|---|---|---|
| 10/08 | 70 | 30 | 43% |
| 11/08 | 39 | 9 | 23% |
| 12/08 | 48 | 4 | 8% |

Việc đếm số mẫu và lọc theo tầm giá nay **khớp 100%** với kho — phần bịa số liệu coi như xong hẳn. Xoá dữ liệu sau 90 ngày chạy đúng. Che thông tin khách trước khi gửi cho AI, giới hạn 6 công cụ chỉ-đọc, chặn spam, trần chi phí — đều đã kiểm tra và đạt.

**Việc còn lại là 10 vấn đề ở mục 3.** Mỗi vấn đề đã có bằng chứng từ dữ liệu thật hoặc từ kiểm thử tái hiện được — **không cần điều tra lại từ đầu**, chỉ cần verify khi sửa.

**Môi trường:** stack chạy sẵn trong Docker (web, máy chủ, quản trị, cơ sở dữ liệu, kho ảnh, bộ nhớ đệm). Chạy `docker ps` trước khi dùng; container cần dùng chưa chạy thì **dừng, báo owner**, không tự khởi động lại. Trong container mặc định **chỉ đọc**; thao tác xoá dữ liệu hoặc khởi động lại dịch vụ phải hỏi owner trước (AGENTS.md §5.6).

> ⚠️ **Hạn mức AI là tiền thật.** Mỗi lần gọi thử trợ lý qua khung chat tiêu một lượt AI thật, trần **120 lượt/ngày**. Hôm nay đã dùng 3. Đếm trước và sau khi thử. Ưu tiên kiểm thử tự động; chỉ dùng chat thật cho vài ca xác nhận cuối. **Không** để cạn trần, vì khách thật sẽ gặp đúng màn hình lỗi đang cần sửa.

---

## 1. Nguyên tắc bắt buộc giữ

Đây là phần dễ làm hỏng nhất trong nhiệm vụ này. Đọc kỹ trước khi đụng vào bất cứ thứ gì.

- **Lớp kiểm duyệt câu trả lời phải giữ nguyên sức mạnh.** Nhiệm vụ ở V1 là sửa chỗ nó **bắt nhầm câu đúng**, tuyệt đối **không phải** nới lỏng để câu trả lời "qua bài" cho dễ. Sau khi sửa, trợ lý vẫn phải bị chặn khi: bịa số lượng hàng, nói sai tồn kho, gọi khách bằng "em", nói cộc lốc, lộ mã kỹ thuật, lộ số điện thoại lạ, lộ đường dẫn.
- **Cấm bịa số liệu.** Mọi con số về số mẫu / giá / tồn kho phải có kết quả tra cứu tương ứng ở **chính lượt đó**. Phần này vừa sửa xong và đang đúng 100% — làm hỏng lại là hỏng nặng hơn cả lỗi đang sửa.
- **Không nới bất kỳ chốt chặn an toàn nào**: giới hạn số lượt mỗi cuộc trò chuyện, trần lượt AI theo ngày, phạm vi công cụ chỉ-đọc, quyền xem hội thoại ở quản trị, cấm sinh câu lệnh truy vấn, khoá AI chỉ nằm ở máy chủ.
- **Không ghi thông tin cá nhân của khách vào nhật ký hệ thống**, kể cả khi thêm phần đo lường ở V8.
- **Chỉ ghi thông tin liên hệ sau khi khách chủ động đồng ý**, mỗi cuộc trò chuyện mời đúng một lần, khách từ chối thì không hỏi lại.

---

## 2. Owner đã chốt — làm theo, không hỏi lại

1. **Việc "khung chat chỉ phục vụ được một khách tại một thời điểm" (V3): làm luôn đợt này.** Không để đợt sau.
2. **Nút "Tìm theo nhu cầu" (V9): cho trợ lý hỏi lại cho gọn** — chỉ nêu vài nhóm hàng lớn rồi hỏi khách đang cần gì, thay vì đọc hết danh sách. **Không** đụng vào cách sắp xếp nhóm hàng trong kho.
3. **Câu chào của trợ lý trong phần Cài đặt: được phép tự cập nhật** trên hệ thống đang chạy, nhưng **phải ghi lại đầy đủ giá trị cũ và giá trị mới** trong báo cáo cuối để owner soát.

**Tên trợ lý:** đã chốt từ trước là **"Trợ lý BigBike"**, bỏ hẳn tên riêng "Bi" ở mọi chỗ khách nhìn thấy. Đợt 13/08 đã đổi phần lớn nhưng chưa xong — xem V4.

---

## 3. Mười vấn đề đã xác minh

Xếp theo mức thiệt hại kinh doanh. Làm từ trên xuống. **V1 là gốc rễ — sửa nó gỡ luôn phần lớn V2 và các lần trợ lý im lặng còn lại.**

### V1 — Lớp kiểm duyệt đang chặn nhầm chính câu chữ của trợ lý 🔴

Hệ thống có một lớp kiểm duyệt để trợ lý không nói bậy, không gọi khách bằng "em", không cộc lốc, không bịa số. Lớp này đang **bắt nhầm những cách nói hoàn toàn bình thường**, và xui ở chỗ đó lại là những câu trợ lý dùng nhiều nhất khi cần hỏi thêm cho rõ.

Ba kiểu bắt nhầm đã tái hiện được bằng kiểm thử:

| Trợ lý muốn nói | Hệ thống hiểu nhầm thành |
|---|---|
| "em **cần** anh/chị cho em biết loại hàng…" | đang gọi khách bằng "em" |
| "…sau khi em **tìm** lại" | đang gọi khách bằng "em" |
| "đến **từ tìm** kiếm rộng hơn…" | "tự tìm" — câu xua đuổi khách |
| "anh/chị muốn so sánh hai hoặc **ba mẫu** nào ạ?" | đang bịa con số tồn kho |

Mỗi lần bắt nhầm, khách không nhận được câu hỏi làm rõ mà nhận câu xin lỗi. Đây là nguyên nhân âm thầm phía sau phần lớn các lần trợ lý "chịu thua" còn sót lại.

**Yêu cầu:**
- Phân biệt được **trợ lý tự xưng "em"** (đúng, phải cho qua) với **trợ lý gọi khách là "em"** (sai, phải chặn). Tương tự, phân biệt cụm chữ vô tình trùng nhau với câu xua đuổi thật.
- Một con số chỉ bị coi là "bịa số hàng" khi nó thật sự đang nói về số lượng hàng trong kho, **không phải** khi nó nằm trong câu hỏi lại kiểu "hai hoặc ba mẫu nào".
- **Rà hết** các câu mẫu soạn sẵn của trợ lý (cả tiếng Việt lẫn tiếng Anh) và bảo đảm **không câu nào tự bị chặn bởi chính hệ thống**. Đây là loại lỗi phải quét hết, không sửa riêng bốn ca trên.
- Bổ sung kiểm thử tự động: mọi câu mẫu soạn sẵn phải đi qua được lớp kiểm duyệt. Có bài kiểm thử này thì lỗi tương tự không tái diễn.
- Đồng thời bổ sung kiểm thử cho chiều ngược lại: câu gọi khách bằng "em", câu cộc lốc, câu bịa số vẫn phải bị chặn như cũ.

### V2 — Nút "So sánh các mẫu" chưa bao giờ chạy được 🔴

Đây là nút gợi ý **có sẵn trong khung chat**, hiện ra ngay sau khi trợ lý vừa đưa danh sách sản phẩm. Khách bấm vào thì nhận câu xin lỗi. Nút "So sánh sản phẩm" hỏng y hệt, cả bản tiếng Việt lẫn tiếng Anh.

**Bằng chứng thật — hỏng cả hai lần thử gần nhất:**

```
13/08 11:28  KHÁCH   Tìm sản phẩm mũ từ 2tr đến 3tr
13/08 11:28  TRỢ LÝ  ...shop có 2 mẫu... Anh/chị muốn em kiểm tra chi tiết mẫu nào ạ?
13/08 11:30  KHÁCH   So sánh các mẫu
13/08 11:30  TRỢ LÝ  Dạ, em chưa hoàn tất được lần tra này...          ← THUA

14/08 09:39  KHÁCH   tôi muốn tìm sản phẩm thương hiệu NIC
14/08 09:39  TRỢ LÝ  ...shop hiện có 3 mẫu... NIC N01F, NIC N02, NIC N01
14/08 09:39  KHÁCH   So sánh các mẫu
14/08 09:39  TRỢ LÝ  Dạ, em chưa lấy được thông tin phù hợp...        ← THUA
```

Trợ lý vừa tự hiện đúng 2–3 mẫu, vừa tự mời "muốn em kiểm tra chi tiết mẫu nào", khách làm đúng như lời mời thì lại không hiểu.

Có **hai lớp lỗi chồng lên nhau**, phải sửa cả hai:
1. Trợ lý nhận ra chữ "so sánh" rồi **hỏi lại tên mẫu ngay**, không thèm nhìn xem mình vừa hiện những sản phẩm nào. Phần xử lý so sánh dựa trên sản phẩm vừa hiện **đã được viết rồi** nhưng không bao giờ tới lượt chạy.
2. Chính câu hỏi lại đó cũng bị lớp kiểm duyệt chặn (xem V1).

**Yêu cầu:**
- Khi khách nói "so sánh các mẫu / hai mẫu này / so sánh giúp em" ngay sau khi trợ lý vừa hiện 2–3 sản phẩm đã xác minh, trợ lý **phải so sánh đúng những mẫu đó**, không hỏi lại tên. Chỉ hỏi lại khi lượt trước không có sản phẩm nào.
- Nội dung so sánh dựa **hoàn toàn** trên dữ liệu đã lưu — giá, cỡ đang bán, màu, lựa chọn, thông số. Không suy đoán, không bịa điểm khác biệt. Thiếu dữ liệu thì nói rõ là chưa có.
- Kiểm thử phải chạy **cả hai lớp** — dựng câu trả lời so sánh xong thì cho nó đi qua lớp kiểm duyệt luôn. Kiểm thử hiện tại chỉ kiểm lớp đầu nên lỗi này lọt qua nhiều ngày mà vẫn xanh.
- Quy tắc kinh doanh cho ngoại lệ so sánh **đã có sẵn trong tài liệu** — đây là việc làm cho code khớp tài liệu, không phải đổi quy tắc.

### V3 — Khung chat chỉ phục vụ được một khách tại một thời điểm 🔴

Toàn bộ khung chat đang bị xếp thành một hàng: khách thứ hai phải đợi khách thứ nhất trả lời xong mới tới lượt. Bình thường mỗi lượt mất 2–4 giây, nhưng khi dịch vụ AI chậm thì một lượt kéo tới gần một phút — và khung chat phía khách **không có mốc chờ tối đa** nên vòng xoay cứ quay mãi.

Hiện chưa lộ vì lượng khách còn ít. Chỉ cần chạy quảng cáo hoặc vào giờ cao điểm là khách sẽ thấy trợ lý "đơ".

Kèm theo: vì cách xếp hàng hiện tại nằm sai chỗ so với lúc ghi nhận, **trần lượt AI mỗi ngày có thể bị vượt nhẹ** khi nhiều khách hỏi cùng lúc — tức là chi phí nhỉnh hơn mức owner đã đặt.

**Yêu cầu:**
- Nhiều khách chat cùng lúc mà không phải chờ nhau.
- Vẫn phải giữ đúng: mỗi cuộc trò chuyện đếm lượt chính xác, không lẫn lộn dữ liệu giữa hai khách, không tạo trùng cuộc trò chuyện.
- **Trần lượt AI mỗi ngày phải đếm chính xác kể cả khi nhiều khách hỏi cùng lúc** — không được vượt.
- Khung chat phía khách có **mốc chờ tối đa**; quá mốc thì báo rõ ràng và cho khách thử lại, không để quay vô tận.
- Chứng minh bằng kiểm thử có nhiều khách hỏi cùng lúc, không chỉ bằng lời.

### V4 — Đợt sửa 13/08 chưa hoàn tất: hai bài kiểm thử đang đỏ 🔴

Bộ kiểm thử tự động của trợ lý **đang báo lỗi ở hai chỗ**, nghĩa là phần việc chưa commit chưa xong:

1. **Câu chào mở đầu không còn khớp chuẩn đã đặt ra** — hệ quả của việc đổi tên trợ lý làm dở.
2. **Lỗi mới phát sinh:** khi khách nói mơ hồ kiểu "cái kia rẻ hơn đúng không" trong lúc đang có 2 mẫu trên màn hình, trợ lý **đưa luôn cả 2 sản phẩm** thay vì hỏi khách muốn nói mẫu nào. Quy tắc đã chốt là phải hỏi lại và nêu đúng tên các mẫu đang hiện, không được đoán.

**Về tên trợ lý:** giao diện web và quản trị đã đổi hết sang "Trợ lý BigBike", nhưng **câu chào lưu trong phần Cài đặt vẫn là tên "Bi"** — nên khách mở chat ra vẫn thấy tên cũ. Vài nhãn trong màn Cài đặt cũng còn chữ "Bi".

**Yêu cầu:**
- Hai bài kiểm thử trên phải xanh, và sửa theo hướng **làm cho hành vi đúng lại**, không phải sửa bài kiểm thử cho khớp hành vi sai.
- Quét sạch chữ "Bi" ở **mọi chỗ khách nhìn thấy** và trong màn quản trị: câu chào, câu tự giới thiệu, thông báo khi trợ lý tạm nghỉ/hết lượt, lời dặn gửi cho AI, nhãn trong Cài đặt, tài liệu, bài kiểm thử.
- Cập nhật câu chào trong Cài đặt trên hệ thống đang chạy theo chốt số 3 của owner, ghi lại giá trị cũ/mới.
- Giữ nguyên yêu cầu: khách phải biết rõ đây là **trợ lý ảo AI**, và nút "Gặp nhân viên" luôn hiển thị.

### V5 — Trợ lý quên mất "sản phẩm này" là mẫu nào 🟠

Khi khách hỏi tiếp về đúng sản phẩm vừa hiện, trợ lý nhiều lúc không hiểu "này" là mẫu nào. Nó chỉ hiểu chắc chắn khi phía AI chủ động chọn tra lại sản phẩm — còn không thì trả lời chung chung hoặc chịu thua.

**Bằng chứng thật (12/08 18:12):** khách hỏi thông số của mẫu vừa xem, **phải gõ lại 5 lần** mà vẫn không lấy được thông số. Có lượt trợ lý chỉ đáp *"em đang hiển thị 1 sản phẩm phù hợp bên dưới"* — tức là không trả lời đúng câu hỏi, chỉ nói lại một câu vô thưởng vô phạt.

**Yêu cầu:**
- Khách hỏi "sản phẩm này / mẫu này / cái này / nó" ngay sau khi trợ lý vừa hiện **đúng một** sản phẩm → phải hiểu ngay, không hỏi lại.
- Vừa hiện **nhiều** sản phẩm → hỏi khách chọn và **nêu đúng tên các mẫu đang hiện** (đây cũng là lỗi V4 mục 2).
- Câu trả lời loại "em đang hiển thị N sản phẩm bên dưới" **không được dùng làm câu trả lời cho một câu hỏi cụ thể**. Khách hỏi thông số mà nhận lại câu đó là hỏng — thà nói rõ chưa có dữ liệu và hỏi tiếp một bước cụ thể.

### V6 — Bộ lọc giá dính lại khi khách đổi loại hàng 🟠

Khách đang xem mũ tầm 4–5 triệu, chuyển sang hỏi tai nghe thì trợ lý vẫn giữ nguyên khoảng 4–5 triệu và báo không có hàng — trong khi shop có tai nghe.

Trợ lý **có nói rõ** là đang lọc theo giá cũ, đó là điểm tốt phải giữ. Nhưng theo quy tắc đã chốt, khi bộ lọc kế thừa cho kết quả rỗng thì phải **tự bỏ riêng bộ lọc đó và tìm lại** trong phạm vi khách vừa hỏi, rồi nói rõ việc đó — chứ không dừng ở câu "không tìm thấy".

**Yêu cầu:**
- Bộ lọc cũ cho kết quả rỗng → tự bỏ nó, tìm lại, và nói rõ với khách là đã bỏ.
- Bộ lọc **khách vừa nêu ở lượt hiện tại** thì không được tự bỏ.
- Khách đổi hẳn sang loại hàng khác thì bộ lọc giá cũ không được bám theo.

### V7 — Một trục trặc nhỏ là mất trắng cả câu trả lời 🟠

Bốn chỗ khác nhau cùng một kiểu: có sẵn thông tin đúng rồi nhưng hệ thống vẫn vứt cả câu trả lời và cho khách câu xin lỗi.

1. **Dịch vụ AI báo bận hoặc lỗi tạm thời** → bỏ luôn lượt, không thử lại lần nào. Chỉ cần thử lại một lần sau vài giây là phần lớn ca này qua được.
2. **Câu trả lời dài quá mức cho phép** → bị cắt giữa chừng rồi bỏ luôn cả lượt, thay vì giữ phần đã viết được.
3. **Bắt buộc đúng 2–5 câu** → câu trả lời đúng và đầy đủ nhưng viết thành 6 câu bị loại hoàn toàn, chỉ vì độ dài. Nên cắt bớt cho vừa thay vì bỏ cả câu.
4. **Một sản phẩm nhập sai giá** (giá khuyến mãi bằng hoặc cao hơn giá gốc) hoặc đang hết hàng lọt vào kết quả → bỏ **toàn bộ** câu trả lời thay vì chỉ bỏ sản phẩm đó ra. Một dòng dữ liệu nhập sai trong kho có thể làm trợ lý im lặng với cả một nhóm câu hỏi.

**Yêu cầu:** cả bốn chỗ đổi sang hướng **giữ lại phần dùng được**, chỉ bỏ phần hỏng. Vẫn giữ nguyên nguyên tắc ở mục 1 — không vì "cứu câu trả lời" mà cho lọt số liệu chưa xác minh hoặc sản phẩm không đủ điều kiện bán ra ngoài.

### V8 — Không theo dõi được vì sao trợ lý im lặng 🟡

Với luồng trả lời nhanh (không qua AI), khi lớp kiểm duyệt chặn thì hệ thống **không ghi lại lý do gì cả**. Chính vì vậy lỗi nút "So sánh" ở V2 nằm im nhiều ngày mà không ai biết — nhật ký sạch trơn trong khi khách thì nhận câu xin lỗi.

**Yêu cầu:**
- Mọi lần trợ lý bị chặn hoặc phải dùng câu xin lỗi đều ghi lại **lý do dưới dạng mã cố định**, ở **mọi luồng**, không riêng luồng có AI.
- Không ghi nội dung chat, tên khách, số điện thoại hay bất kỳ thông tin cá nhân nào vào nhật ký.
- Không để mã lý do nội bộ lọt ra màn hình khách.
- Cho chủ shop **tự nhìn thấy chỉ số này ở màn quản trị hội thoại** — bao nhiêu câu trợ lý không trả lời được, theo ngày. Đây là thứ owner cần để tự biết trợ lý đang tốt lên hay xấu đi mà không phải nhờ ai kiểm.

### V9 — Hai nút gợi ý trả lời lạc đề 🟡

- **"Tìm theo nhu cầu"** → trợ lý đổ ra hơn 14 nhóm hàng lẫn lộn nhau: *Balo đeo lưng, Fullface, Giá đỡ điện thoại, Dualsport, Áo quần mùa hè, Lật hàm – Tháo hàm…* Kiểu mũ và loại phụ kiện bị xếp ngang hàng nên khách đọc xong không biết chọn gì.
- **"Đổi nhu cầu"** → trợ lý hỏi khách muốn xem size, màu hay thông số, trong khi khách vừa bấm là muốn **đổi sang nhóm hàng khác**. Trả lời sai hẳn ý.

**Yêu cầu:** theo chốt số 2 của owner — trợ lý chỉ nêu **vài nhóm hàng lớn** rồi hỏi khách đang cần gì, không đọc hết danh sách. Nút "Đổi nhu cầu" phải hiểu đúng là khách muốn đổi loại hàng. **Không** đụng vào cách sắp xếp nhóm hàng trong kho.

### V10 — Tên màu sản phẩm còn lẫn mã kỹ thuật ⚪

Một số sản phẩm có tên màu nhập dạng mã, ví dụ mũ NIC N01 có màu ghi là `carbon-forged-bong` nằm cạnh màu ghi đúng là "CARBON 3K BÓNG". Trợ lý **đã có lớp làm sạch nên hiện chưa lộ ra ngoài** — phần code coi như xong.

**Yêu cầu: chỉ liệt kê, KHÔNG tự sửa dữ liệu sản phẩm.** Xuất danh sách đầy đủ các giá trị màu dạng mã kèm tên sản phẩm vào báo cáo cuối, để owner tự sửa lại trong màn quản trị sản phẩm. Lý do đáng sửa: màu này cũng hiện trên trang sản phẩm cho khách xem, không riêng trong chat.

---

## 4. Phạm vi

**Được làm:** phần trợ lý ảo ở cả ba nơi — khung chat trên web khách, phần xử lý ở máy chủ, màn quản trị hội thoại — miễn là phục vụ 10 việc trên. Được cập nhật câu chào trong Cài đặt theo chốt số 3.

**Không đụng tới:** giá bán, tồn kho, đơn hàng, dữ liệu khách hàng, nội dung sản phẩm, cách sắp xếp nhóm hàng trong kho, giao diện/màu sắc/bố cục ngoài khung chat. Không xoá dữ liệu, không đổi tên sản phẩm, không sửa tên màu trong kho.

**Không tự quyết thay owner:** gặp chỗ phải chọn giữa "trợ lý nói ít mà chắc" và "trợ lý nói nhiều mà có rủi ro sai" → **luôn chọn nói ít mà chắc**, ghi lại vào báo cáo để owner cân nhắc sau. Gặp quy tắc kinh doanh trong tài liệu ghi là chưa xác minh hoặc mâu thuẫn → **dừng, hỏi owner**, không tự đặt ra quy tắc mới.

---

## 5. Yêu cầu chất lượng

- **Song ngữ đầy đủ:** mọi chữ hiện ra cho khách phải có cả tiếng Việt và tiếng Anh, và bản tiếng Anh **không được lẫn tiếng Việt**.
- **Tiếng Việt có dấu đầy đủ**, không lỗi phông chữ, kể cả trong nhãn, chú thích, thông báo và bài kiểm thử.
- **Giọng trợ lý:** xưng "em", gọi khách "anh/chị", không cộc lốc. Câu xin lỗi khi bí phải viết bằng **tiếng Việt đời thường của người bán hàng** và nêu **một bước đi tiếp cụ thể** — không dùng chữ máy móc kiểu "chưa nhận được kết quả đã xác minh".
- **Dùng lại thành phần giao diện có sẵn** của dự án, không tự vẽ mới cái đã có; không hardcode màu/khoảng cách.
- **Có kiểm thử tự động cho từng vấn đề đã sửa**, và chạy đủ bộ kiểm tra tự động của cả ba phần đã đụng vào — phải xanh hết trước khi chốt.
- **Cập nhật tài liệu** cho phần quy tắc kinh doanh và luồng có thay đổi, cùng một PR.
- Nếu phải đổi cấu trúc cơ sở dữ liệu: **kiểm tra kỹ không trùng với bản cập nhật đã có, và tuyệt đối không sửa bản đã chạy** — repo này đã hai lần bị sập lúc triển khai vì đúng lỗi đó, và bộ kiểm thử tự động **không** bắt được.
- **Chạy bước kiểm tra trước khi chốt** theo quy trình sẵn có của repo.

**Xác minh cuối bằng hệ thống thật — tối đa 12 lượt, đếm hạn mức trước và sau.** Kịch bản bắt buộc:

1. "Tìm mũ bảo hiểm từ 2 đến 3 triệu" → bấm nút **"So sánh các mẫu"** → phải so sánh được, **không** được chịu thua.
2. Hỏi thông số kỹ thuật của mẫu vừa hiện bằng chữ "sản phẩm này" → phải trả lời đúng mẫu đó ngay lần đầu, nội dung trọn ý.
3. Đang xem một loại hàng có lọc giá → chuyển sang hỏi loại hàng khác → không được bám bộ lọc giá cũ.
4. Bấm **"Tìm theo nhu cầu"** → phải hỏi lại gọn gàng, không đọc hết danh sách nhóm hàng.
5. Đi tới lúc trợ lý bí → phải mời để lại liên hệ; khách từ chối thì không hỏi lại.
6. Kiểm không còn chữ "Bi" nào trong lời trợ lý và trong khung chat.

---

## 6. Báo cáo cuối — bắt buộc có

1. **Bảng 10 vấn đề × trạng thái** (`Đã sửa` / `Not run: <lý do>`), kèm evidence path.
2. **Bằng chứng cho V1:** danh sách các câu mẫu soạn sẵn đã kiểm, xác nhận không câu nào tự bị chặn — và xác nhận các câu đáng bị chặn thì vẫn bị chặn.
3. **Bằng chứng cho V3:** kết quả kiểm thử nhiều khách hỏi cùng lúc, và xác nhận trần lượt AI mỗi ngày vẫn đếm đúng.
4. **Nhật ký thay đổi trên hệ thống đang chạy:** câu chào cũ và câu chào mới, cùng bất kỳ thay đổi dữ liệu nào khác.
5. **Danh sách tên màu dạng mã kèm tên sản phẩm** (V10) để owner tự sửa trong quản trị.
6. **Số lượt AI đã tiêu** trong quá trình kiểm thử.
7. **Danh sách việc còn nợ** kèm lý do.
8. Viết phần tóm tắt bằng **ngôn ngữ kinh doanh** — người đọc là chủ shop, không phải lập trình viên.
