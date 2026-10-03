# Prompt bàn giao Codex — Sửa trải nghiệm mua hàng bigbike-web (10/09/2026)

> Dán nguyên phần dưới đây cho Codex.

---

## Bối cảnh

Có một báo cáo chấm trải nghiệm mua hàng đặt tại `docs/audits/BIGBIKE_WEB_CUSTOMER_JOURNEY_AUDIT_2026-09-10.md`.

**Báo cáo đó đã được kiểm chứng lại trên hệ thống thật và có nhiều chỗ sai.** Đừng làm theo nguyên văn báo cáo. Chỉ làm đúng những việc liệt kê dưới đây, và tuyệt đối không đụng vào những việc ở mục "KHÔNG ĐƯỢC LÀM".

Toàn bộ số đo dưới đây lấy từ bản công khai bigbike.vn ngày 10/09/2026, đo bằng trình duyệt giả lập iPhone màn 390×844. Máy của bạn không có dữ liệu thật nên không tự đo lại được — hãy tin các số này.

Phạm vi: chỉ `bigbike-web`. Không đụng backend, không đụng admin, không đụng cơ sở dữ liệu.

---

## VIỆC 1 — Nút "Tư vấn Zalo" trên điện thoại bị vỡ chữ (làm trước tiên)

**Hiện trạng đo được:** Ở mọi trang sản phẩm trên điện thoại, thanh mua hàng dính đáy có 2 nút: "Thêm vào giỏ" và "Tư vấn Zalo". Nút Zalo rộng 153 điểm ảnh nhưng riêng phần đệm lề trái–phải đã ăn mất 64, cộng biểu tượng Zalo 20 và khoảng hở 8 → **chỉ còn 59 điểm ảnh cho dòng chữ cần khoảng 110**.

Kết quả: chữ "TƯ VẤN ZALO" rớt thành **5 dòng** trong một khung chỉ cao 56 điểm ảnh, tràn ra ngoài viền và bị cắt cụt cả phía trên lẫn phía dưới. Đã dựng lại được trên nhiều trang sản phẩm khác nhau, không phải trường hợp cá biệt.

Nút "Thêm vào giỏ" bên cạnh rộng 195 nên vừa đủ 1 dòng — nhưng nó cũng đang chịu cùng mức đệm lề quá lớn đó.

**Mong muốn:** Trên mọi bề ngang điện thoại (từ 320 đến 430), nhãn của cả hai nút nằm gọn **1 dòng**, không bị cắt, không tràn viền, và nút vẫn cao tối thiểu 44 điểm ảnh để dễ bấm.

**Ràng buộc:**
- Giữ nguyên tỉ lệ 60/40 giữa nút giỏ hàng và nút Zalo.
- Giữ nguyên trường hợp hết hàng: khi đó nút giỏ hàng ẩn đi và nút Zalo chiếm trọn bề ngang.
- Kiểm cả bản tiếng Anh, vì nhãn tiếng Anh có thể dài hơn.
- Nguyên nhân là nút đang dùng mức đệm lề mặc định của hệ nút dùng chung; sửa ở phạm vi thanh mua hàng này, **đừng đổi mức đệm lề mặc định của hệ nút toàn site** vì sẽ kéo theo mọi nút khác.

---

## VIỆC 2 — Thanh mua hàng che mất giá ngay khi khách vừa mở trang

**Hiện trạng đo được:** Trên iPhone, khách mở trang sản phẩm và chưa cuộn gì cả thì:

| Thành phần | Vị trí trên màn hình |
|---|---|
| Ảnh sản phẩm | 133 → 489 |
| Tên sản phẩm | 668 → 736 |
| **Giá + tình trạng còn hàng** | **756 → 798** |
| **Thanh mua hàng dính đáy** | **767 → 844** |

Thanh mua hàng đè lên 31 trong 42 điểm ảnh của dòng giá. Ảnh chụp cho thấy con số "7.200.000 ₫" bị xẻ ngang làm đôi. Bản thân thanh mua hàng lại không hiển thị giá, nên khách vừa mở trang là **không đọc được giá**.

**Nguyên nhân:** thanh dính đáy đang bật lên bất cứ khi nào khu vực mua hàng thật không nằm trong tầm nhìn — kể cả lúc khu vực đó còn nằm **phía dưới**, tức là khách còn chưa cuộn tới. Vì vậy nó bật ngay từ giây đầu tiên.

**Mong muốn:** Thanh dính đáy chỉ xuất hiện khi khách đã **cuộn qua khỏi** khu vực mua hàng thật (khu vực đó đã trôi lên phía trên tầm nhìn). Khi khách chưa cuộn tới, thanh phải ẩn để khách đọc được giá và tình trạng hàng.

**Ràng buộc:**
- Không được để trang bị giật hay nhảy nội dung lúc thanh xuất hiện/biến mất.
- Giữ nguyên phần đã có: thanh phản ánh đúng trạng thái "chưa chọn màu/cỡ", và bấm vào lúc chưa chọn thì cuộn khách về chỗ chọn màu/cỡ.
- Giữ nguyên cách thanh này nhường chỗ cho thanh điều hướng dưới đáy.

---

## VIỆC 3 — Form đặt hàng báo lỗi quá muộn

**Hiện trạng:** Form đặt hàng có 6 ô bắt buộc (họ tên, điện thoại, email, địa chỉ, tỉnh/thành, phường/xã) cộng 1 ô xác nhận. Hiện hệ thống **chỉ kiểm tra khi khách bấm nút "Đặt hàng"**. Khách điền sai 3 ô thì phải tới lúc bấm gửi mới biết, và phải sửa cả 3 cùng lúc.

**Mong muốn:** Khách rời khỏi một ô (bấm sang ô khác) là ô đó được kiểm ngay và báo lỗi tại chỗ nếu sai. Sau khi khách đã sửa, lỗi biến mất ngay khi gõ lại cho đúng — không bắt chờ tới lúc bấm gửi.

**Ràng buộc:**
- Không được báo lỗi khi khách còn chưa chạm vào ô đó lần nào.
- Áp dụng cho cả form địa chỉ chính lẫn form "giao tới địa chỉ khác".
- Giữ nguyên toàn bộ câu chữ báo lỗi hiện có, chỉ đổi **thời điểm** hiện.

---

## VIỆC 4 — Trang danh sách sản phẩm quá nặng vì nhúng thừa phiên bản ảnh

**Hiện trạng đo được:** Máy chủ trả trang rất nhanh (0,35–0,9 giây), nhưng bản thân trang thì nặng:

- Trang danh sách sản phẩm nặng **900 KB**, trong đó **350 KB — tức 38% — chỉ là danh sách các phiên bản kích cỡ ảnh** nhúng sẵn trong mã trang.
- Mỗi ảnh sản phẩm đang nhúng sẵn **41 phiên bản kích cỡ** để trình duyệt chọn. Một trang danh sách có 63 ảnh → nhân lên thành 350 KB.
- Mức thông thường của một trang web tương tự là khoảng 8 phiên bản mỗi ảnh.

Đây chính là lý do khách trên 4G phải chờ khoảng 5 giây mới thấy hàng, chứ không phải máy chủ chậm.

**Mong muốn:** Giảm số phiên bản kích cỡ ảnh xuống mức đủ dùng, để trang danh sách nhẹ đi đáng kể.

**Ràng buộc quan trọng — đọc kỹ trước khi sửa:**
- Danh sách hiện tại được đặt có chủ đích: một số ô ảnh cố định (ảnh thu nhỏ danh mục, logo hãng) đang khớp đúng kích cỡ 1× đến 4× của khung chúng. **Đừng xóa bừa.** Đọc phần ghi chú trong cấu hình trước.
- Sau khi sửa, **ảnh không được mờ đi** trên màn hình mật độ cao (điện thoại đời mới, màn Retina). Kiểm mắt thường ở 3 chỗ: ảnh lớn trang sản phẩm, ảnh thẻ hàng ở danh sách, logo hãng.
- Báo lại con số trước/sau: trang danh sách nặng bao nhiêu KB trước và sau khi sửa.

---

## VIỆC 5 — Trang "không tìm thấy" quá cụt

**Hiện trạng:** Có hai loại trang báo không tìm thấy:

- Loại dành cho sản phẩm/bài viết đã xóa: **đang tốt** — có đầu trang, chân trang, ô tìm kiếm, gợi ý bài viết mới. Giữ nguyên.
- Loại dành cho đường dẫn lạ hoàn toàn (khách bấm từ quảng cáo cũ, link gãy): **chỉ có duy nhất một nút "Về trang chủ"**. Không đầu trang, không chân trang, không ô tìm kiếm, không gợi ý gì.

**Mong muốn:** Loại thứ hai cũng cứu được khách như loại thứ nhất — ít nhất phải có ô tìm kiếm và lối đi tiếp (xem sản phẩm / đọc tin tức), thay vì chỉ đá khách về trang chủ.

**Lưu ý kỹ thuật để bạn không mất thời gian:** trang này nằm ngoài khung chung của website nên không tự có đầu/chân trang và không có thông tin ngôn ngữ. Có ghi chú giải thích sẵn ngay trong file đó — đọc trước khi làm, và đừng phá cách xử lý ngôn ngữ hiện tại.

---

## VIỆC 6 — Tìm không ra thì không gợi ý gì

**Hiện trạng đo được trên bản công khai:** gõ `muu` (gõ nhầm của `mũ`, đúng ra phải ra 103 sản phẩm) thì trang chỉ hiện đúng một dòng chữ: *"Không tìm thấy sản phẩm phù hợp."* Không gợi ý sản phẩm nào, không hướng dẫn gì thêm.

**Mong muốn:** Khi không có kết quả, trang vẫn giữ khách lại bằng:
- một khối sản phẩm gợi ý (ví dụ hàng mới nhất hoặc hàng bán chạy),
- và lối bỏ bớt điều kiện lọc nếu khách đang lọc.

**Ràng buộc:** Chỉ làm phần hiển thị. **Không** đụng vào cách tìm kiếm khớp từ khóa ở backend — phần chịu lỗi chính tả là việc riêng, chưa được duyệt.

---

## VIỆC 7 — Không đếm được khách tìm gì

**Hiện trạng:** Website đang gửi 20 loại số liệu về báo cáo bán hàng (xem hàng, xem sản phẩm, thêm giỏ, bắt đầu đặt hàng, mua thành công, mở chat, bấm gọi…). **Không có loại nào cho tìm kiếm.**

Hệ quả: chủ shop không biết mỗi tháng khách gõ tìm những gì, và bao nhiêu lượt tìm ra 0 kết quả — tức là không biết mình đang thiếu hàng gì hoặc đặt tên hàng sai so với cách khách gọi.

**Mong muốn:** Thêm ghi nhận cho mỗi lượt tìm kiếm, kèm **từ khóa khách gõ** và **số kết quả trả về**, để tổng hợp được hằng tháng. Ghi cả lượt tìm từ ô tìm kiếm nhanh lẫn lượt vào thẳng trang kết quả.

**Ràng buộc:** đi theo đúng cách website đang gửi các số liệu khác, đừng dựng cơ chế riêng.

---

## VIỆC 8 — Chữ và nút quá nhỏ, khó bấm

**Hiện trạng đo được ở màn 390:**

| Chỗ | Kích thước thật | Vấn đề |
|---|---|---|
| 5 liên kết chính sách ở chân trang (đổi trả, bảo hành, bảo mật, 2 bài cách đo size) | cao **17** | quá nhỏ, cách nhau chỉ 25 |
| Số điện thoại, Zalo, email ở chân trang | cao **27** | cách nhau chỉ 11–12 → dễ bấm nhầm |
| 4 liên kết mạng xã hội ở chân trang | cao **24** | |
| Nút "Mua ngay" ở trang chủ | **85×24**, không có đệm lề trên–dưới | |

Tổng cộng 13 trên 14 liên kết chân trang đang dưới mức 44 điểm ảnh; 5 cái dưới cả mức 24.

**Mong muốn:** Vùng bấm được của các liên kết/nút này đạt tối thiểu 44 điểm ảnh chiều cao, hoặc ít nhất 24 kèm khoảng hở đủ để không bấm nhầm.

**Ràng buộc:**
- Nới bằng đệm lề, **đừng phóng to cỡ chữ** — cỡ chữ đang đúng hệ thiết kế.
- Chân trang không được dài ra quá đáng; nếu nới đủ 44 làm chân trang phình to bất hợp lý thì chọn phương án 24 + khoảng hở, và nói rõ trong báo cáo bạn đã chọn cái nào.

---

## ❌ KHÔNG ĐƯỢC LÀM

Báo cáo có nêu những việc sau. **Đã kiểm chứng là sai hoặc có hại. Bỏ qua hoàn toàn.**

| Báo cáo nói | Vì sao không làm |
|---|---|
| "Điều tra sự cố website chết 47 giây" — ưu tiên số 1 | Đó là lần cập nhật website của chính shop. Log máy chủ: mất kết nối 10:16:53, chạy lại 10:18:29, đúng lúc bản cập nhật sáng nay lên. Cả ngày có 24 lượt lỗi trên 18.982 lượt truy cập (0,13%), gom trong 2 lần cập nhật. Không có sự cố gì để điều tra. |
| "Nút đổi ngôn ngữ VI rộng 25, EN rộng 32" | Sai. Đo thật: 44×44 trên máy tính, 44×64 trên điện thoại — đã đạt chuẩn. Chỗ này đã sửa xong ngày 08/09. **Đừng đụng vào.** |
| "Email chân trang bị cắt 43 điểm ảnh ở màn 390; liên kết Facebook cắt 19 ở màn 768" | Sai. Không có tràn ngang ở cả hai khổ màn hình (bề rộng cuộn đúng bằng bề rộng màn hình). Email dài 270 trong màn 390 và đã có sẵn cơ chế tự xuống dòng. |
| "Bài 'Cách giặt giày bảo hộ' có 4/4 ảnh hỏng" | Sai. Cả 4 ảnh tải bình thường trên bản công khai. Ảnh 404 duy nhất là ảnh dự phòng không bao giờ được dùng tới. **Không sửa nội dung bài này.** |
| "Form đặt hàng thiếu bước Quận/Huyện" | Sai chuẩn. Việt Nam đã bỏ cấp huyện từ 2025. Tỉnh/Thành → Phường/Xã là đúng luật hiện hành. **Thêm bước huyện là làm sai.** |
| "Tra cứu đơn nên dùng mã đơn + số điện thoại" | Không đổi. Cách hiện tại (mã đơn + mã xác thực) an toàn hơn. Đổi sang số điện thoại thì ai đoán được mã đơn và biết số điện thoại là đọc được tên, địa chỉ, món hàng, số tiền của khách khác. |
| "Đổi thứ tự bộ lọc thành Giá → Hãng → Cỡ → Màu → Còn hàng" | Chuẩn tự đặt, không có căn cứ, và đè lên các quyết định về bộ lọc chủ shop đã chốt hồi tháng 08. |
| "Thanh dưới điện thoại phải luôn có 5 mục, kể cả lúc đặt hàng" | Việc ẩn thanh ở giỏ hàng / đặt hàng là **cố ý**, để không có 2 thanh chồng nhau che nút "Đặt hàng". Thêm mục "Danh mục" là quyết định của chủ shop, chưa chốt. |
| "Điện thoại không phóng to được ảnh sản phẩm" | Nói quá. Khách chụm hai ngón phóng to được tới 5 lần. Nút phóng to riêng là điểm cộng, chưa được duyệt. |
| "Thêm nút Tiếp tục mua sau khi thêm giỏ", "rút gọn mô tả dài bằng Xem thêm", "thay ô đánh giá trống bằng cam kết" | Đều là thay đổi cách bày trang, cần chủ shop duyệt. Chưa duyệt. |
| Mọi kết luận báo cáo ghi là đo trên "bản chạy tại máy" (giỏ chờ 12 giây, tin tức báo chưa có bài, trang liên hệ rỗng) | Đó là máy của người kiểm bị hỏng kết nối dữ liệu, không phải website. Bỏ qua toàn bộ. |

**Cũng không phải việc của bạn** (đây là thiếu nội dung, chủ shop nhập trong trang quản trị, không sửa bằng code):
- Sản phẩm liên quan: 184 sản phẩm đang bán, chỉ 1 sản phẩm được nhập hàng liên quan. Chức năng chạy đúng.
- Cam kết trên trang sản phẩm: 155/184 đã có.
- Bảng size: chỉ 48/184 sản phẩm có.
- Đánh giá: toàn hệ thống đang 0 đánh giá.

---

## Cách tự kiểm trước khi báo xong

1. Chạy đủ bộ kiểm tra tự động của `bigbike-web` (lint, kiểm kiểu, unit test) và bộ kiểm tra trước khi commit của repo.
2. **Chạy thử giao diện phải dùng bản build thật, không dùng chế độ phát triển** — chế độ phát triển làm test đỏ oan.
3. Bổ sung test cho ít nhất: nhãn nút thanh mua hàng không rớt dòng ở màn hẹp; thanh mua hàng chưa hiện khi chưa cuộn; form đặt hàng báo lỗi khi rời ô.
4. Kiểm mắt thường ở 3 khổ màn hình 390 / 768 / 1440 cho các trang: chủ, danh sách sản phẩm, một trang sản phẩm, giỏ hàng, đặt hàng, và một đường dẫn lạ.

## Quy ước bắt buộc của repo

- Đọc `CLAUDE.md` và `AGENTS.md` trước khi sửa. Tài liệu trong `docs/` là chuẩn, code dựng theo tài liệu.
- Giao diện dùng đúng bộ dựng sẵn của dự án, lấy màu/khoảng cách/bo góc từ hệ token — không đặt màu hay số đo cứng.
- Tiếng Việt trong code phải **có dấu đầy đủ**, không lỗi phông.
- Nếu có phiên làm việc khác đang chạy song song: **không dùng lệnh git tạm cất hay đổi nhánh** để so bản gốc.

## Báo cáo lại

Với mỗi việc từ 1 đến 8, ghi rõ: **đã làm / không làm được (kèm lý do)**, và số đo trước–sau nếu có. Nếu gặp chỗ cần chủ shop quyết, dừng ở đó và hỏi bằng bảng chọn phương án, đừng tự quyết.
