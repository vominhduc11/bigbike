# Trợ lý BigBike — kiểm định hồi quy và video ngắn, 08/09/2026

> **Cập nhật sau bàn giao, 17:09 ngày 08/09/2026:** bản sửa đã triển khai và xác nhận trên website thật; xem [báo cáo triển khai](DEPLOY_TRO_LY_BIGBIKE_VIDEO_2026-09-08.md). Nội dung bên dưới giữ nguyên mốc kiểm định trước triển khai, gồm các ghi chú “chưa triển khai” tại thời điểm đó.

**Đã sửa và thử trên bản tách riêng dùng dữ liệu shop và AI thật; chưa triển khai lên website phục vụ khách.** Những mâu thuẫn trong nội dung gốc vẫn chờ chủ shop quyết định, không được tính là đã sửa. Các kiểm tra kỹ thuật và gói triển khai đã chuẩn bị xong; xem mục kiểm tra và hồ sơ bàn giao cùng báo cáo.

## 1. Kết quả theo năm yêu cầu

| Yêu cầu | Kết quả quan sát được | Bằng chứng chạy thật |
|---|---|---|
| Hiểu đúng, khớp BigBike | Hiểu câu tự nhiên Việt/Anh, loại hàng, ngân sách, thông số, đúng tổ hợp màu–size và chính sách công bố. Giờ/địa chỉ và vài nội dung hai ngôn ngữ còn mâu thuẫn ở nguồn. | [80 ca sau sửa](evidence/assistant-2026-09-08/final-80.jsonl), [đánh giá từng ca](evidence/assistant-2026-09-08/semantic-review.json), [ca mã mẫu/màu cuối](evidence/assistant-2026-09-08/name-complete.jsonl), [Cam-S cuối](evidence/assistant-2026-09-08/name-release.jsonl) |
| Không bịa | 706 lần hiển thị thẻ đã đối chiếu tên, mã đường dẫn và cặp giá với 184 sản phẩm/1.258 biến thể thật: không có thẻ dùng dữ kiện lạ. Các câu chính sách, cân nặng, tồn màu–size và từ chối cũng được đọc, đối chiếu riêng. | [Đối chiếu thẻ](evidence/assistant-2026-09-08/card-fact-verification.json), danh mục và chính sách trong cùng thư mục |
| Trả lời / từ chối / hỏi rõ | Hỏi số người đi nhóm, mức cân nặng mong muốn, hãng/mẫu cần bảo hành; từ chối dữ liệu người khác và yêu cầu bịa giá; không tự hứa kiểm hàng, phí gửi bảo hành hoặc giảm thêm. | S03–04, S14–16, S19–24; [quyền đơn hàng](evidence/assistant-2026-09-08/order-privacy.json) |
| Theo mạch nhiều lượt | Bốn chuỗi × tám lượt Việt/Anh: hỏi mẫu đầu tiên, đổi sang áo/găng, lạc đề, quay lại mẫu/hai mẫu cũ; hỏi lại khi đại từ còn chỉ nhiều mẫu. | `chain-vi/en-a/b` trong 80 ca; [hồi quy bổ sung](evidence/assistant-2026-09-08/last-regression.jsonl) |
| Trang trọng, lịch sự, ít cảm thán | Đọc câu trả lời Việt/Anh: không có lời lẽ xua đuổi, cảm thán dồn dập hoặc kể lỗi kỹ thuật. Đã bỏ lời mời mua ghép sai ngữ cảnh và giữ nguyên tên hàng khi dịch màu. Tên Anh JK-1734 dạng slug còn cần sửa nguồn. | S13–24, các chuỗi, `END1–2`; [ảnh màn hình tiếng Anh](evidence/assistant-2026-09-08/chat-video-en-375.png) |

Mốc 80 ca có **71 ca đạt trong phạm vi quan sát, bốn ca có lệch nội dung nguồn giữa hai ngôn ngữ và năm ca chờ chốt nội dung gốc**. Bốn ca lệch nguồn là yêu cầu găng mùa hè độc lập và trong chuỗi; năm ca chờ là JK-1734 tiếng Anh và các câu lấy dữ liệu liên hệ. Không cộng HTTP 200 thành điểm chất lượng và không tuyên bố “hết mọi lỗi” ngoài bộ đã chạy. Sau mốc này còn chạy các câu lịch sử và biến thể câu hỏi để bắt/sửa lỗi Cam-S, tai nghe theo giá và đại từ mơ hồ.

## 2. Phương pháp và môi trường

Đọc trước hồ sơ [kiểm định 05/09](FEATURE_TRO_LY_BIGBIKE_2026-09-05.md) và [ảnh 07/09](FEATURE_TRO_LY_BIGBIKE_IMAGE_2026-09-07.md), lấy các tính năng/lỗi đã sửa làm điểm hồi quy. Bộ [80 câu](../../scripts/audits/bigbike-assistant-cases-20260908.json) gồm 24 cặp câu độc lập Việt/Anh và bốn chuỗi tám lượt. Dùng dữ liệu hàng hóa/chính sách thật, ghi nguyên câu hỏi, câu trả lời, thẻ, thời gian và bộ đếm trước/sau; đọc và đối chiếu ngữ nghĩa, không chấm chỉ bằng từ khóa.

- Baseline: gọi HTTP tới `bigbike-backend:8080` đang phục vụ khách; 80 lượt hoàn thành. Có 17 lần HTTP 429 do nhịp gửi thử, giữ bằng chứng và chạy lại sau khi chờ; không nới giới hạn hệ thống.
- Bản sửa: worktree `/tmp/bigbike-assistant-20260908`, nhánh `codex/assistant-video-20260908`, nền `1e5bb99d`. Backend `58080`, web `53001`, admin `54000`; PostgreSQL/MinIO/Redis riêng có nhãn `bigbike.task=assistant-20260908`.
- Dùng bản sao 184 sản phẩm, dữ liệu biến thể, chính sách, dấu vân tay ảnh và ảnh công khai thật. Lần đọc lại danh mục lúc 14:34 không có thay đổi so với đầu đợt. Không sao chép khách/hội thoại thật; hai ca đơn đăng nhập dùng phép chiếu từ hai đơn thật, bỏ nhận dạng và gắn tài khoản thử. Chỉ xuất cờ đúng quyền, không đưa nội dung đơn vào báo cáo/git.
- Vẫn gọi Google Gemini thật, model cố định của shop. Bộ đếm chữ/ảnh dùng chung với shop; video đếm riêng vì production chưa có bảng video. Không tạo ngân sách mới bằng cách dựng cơ sở dữ liệu mới.
- Tắt tác vụ lịch, email và gọi làm mới website trên preview. Trí nhớ được kiểm trong cửa sổ 12 cặp hỏi–đáp hiện hành; không hứa nhớ vô hạn.
- Chủ shop đã cho phép tạo/xóa đúng phiên và tệp thử, giữ nguyên bộ đếm; đã chọn bản thử tách riêng và bước duyệt cuối trước khi nạp dịch vụ dùng chung. Mốc 60 giây bắt đầu khi máy chủ nhận xong tệp, gồm cả chuẩn hóa.

## 3. Lỗi có bằng chứng đã sửa

| Nhóm | Trước sửa, căn cứ | Sau sửa và ca xác nhận |
|---|---|---|
| R01–02, R14 | Câu tự nhiên/viết tắt/nhu cầu bị coi là mã mẫu, “đồ đi phượt” thành đồ mưa, từ nối làm sai nhóm. `CHAT_RULE_001/017`. | S02–08; chuỗi đổi nhóm; nguyên câu lịch sử; `N1–2` tìm bảy tai nghe rồi còn bốn mẫu trên ba triệu. |
| R03, R11, R13 | Hỏi cân nặng trả thông số khác; hỏi còn hàng biến thành bảng đo size; trộn màu này với size của màu khác. `CHAT_RULE_006/060`. | S11 phân biệt số cân thật với nhãn; S12 và NC7–8 xác nhận Avalon X đỏ không có M, chỉ L. |
| R04, R08–09 | Thiếu COD/kiểm hàng; hàng giảm giá bị nói không được đổi hoặc bị đọc thành “hàng giả”. `CHAT_RULE_006/020`. | S13–16 trả đúng dữ liệu chính sách; thiếu quy định thì nêu chưa biết/mời liên hệ. |
| R05–06, R12 | Xin giảm giá sinh câu lỗi; ghép lời mời mua sai; chốt ngôn ngữ bỏ câu đúng có tên hàng. `CHAT_RULE_001/008`. | S21 Việt/Anh không tự giảm giá; giữ giá và phương án thay thế có nguồn; câu chính sách/từ chối không bị đổi sang chào hàng. |
| R07, R15, R23 | Mất mẫu cũ sau chuyển đề; chọn tai nghe khi chưa biết số người; “cái kia rẻ hơn đúng không” tự chọn một mẫu. `CHAT_RULE_005/034`. | Bốn chuỗi tám lượt; S03 hỏi rõ số người; câu xác nhận giá mơ hồ Việt/Anh đã hỏi chọn mẫu. |
| R10, R24–26 | Dịch màu đổi `Cam-S` thành `Orange-S`; đọc Cam-S như màu cam, tìm mọi chữ “camera”; “Carbon” lấn màu đỏ; “không” bị sửa gần đúng thành danh mục “hông”. `CHAT_RULE_017/020`. | NC1–8 và END1–2: đúng một Cam-S, giữ tên/giá, không gọi camera là intercom từ danh mục chung; màu cam thật vẫn tìm đúng; `in red in size M` trả đúng tổ hợp. |
| R16 | Câu đơn tiếng Anh bị chặn vì tên món snapshot tiếng Việt. `CHAT_RULE_004`. | Hai tài khoản thử đọc đúng đơn của mình; mã khách khác trong body không thay quyền; guest phải đăng nhập. |
| R17, R20 | MP4 bị Tika gọi là QuickTime nên từ chối; WebM có MIME Matroska; đọc kho riêng thất bại sau kết nối nhàn rỗi. `CHAT_RULE_062/065`. | Giải mã thực MP4/MOV/WebM; không chỉ tin tên/MIME; đọc lặp sau idle HTTP 200, cùng bytes/no-store. |
| R18–19 | Video thao tác bị chuyển sang tư vấn phụ kiện khác; thẻ giống hình vượt ngân sách đã nêu. `CHAT_RULE_063`, `CHAT_RULE_020`. | V01_RETEST hỏi rõ thao tác/mẫu khi cần; V02_RETEST chỉ còn tám thẻ dưới bảy triệu. |
| R21 | Video có dữ liệu sau tải lại nhưng giao diện giữ trạng thái lỗi từ lần lấy token chưa xong. `CHAT_RULE_065`, contract lịch sử. | Sửa trạng thái tải lại của bộ xem tệp riêng, thêm kiểm hồi quy; Playwright thật xác nhận phát được sau reload. |
| R22 | Theo tai nghe “trên ba triệu” lại ghép camera độc lập cùng danh mục. `CHAT_RULE_001/018/020`. | Ca lịch sử Việt/Anh và N1–2 giữ đúng bốn tai nghe, không có Cam-S. |

Các lỗi này được sửa trong bản riêng, **chưa có hiệu lực trên production**. Các test đơn vị chỉ bổ sung bảo vệ hồi quy; kết luận trả lời ở bảng trên lấy từ HTTP/UI thật. Cần sửa một số fixture cũ cho đúng nhóm hàng, cache danh mục và kỳ vọng chính sách hiện hành; không sửa quy tắc search công khai đã được owner chốt ngày 07/09.

## 4. Video thật

Gửi toàn bộ clip MP4 cùng tiếng cho model video gốc; khung hình trích chỉ hỗ trợ đối chiếu danh mục. Clip thử lấy từ video sản phẩm công khai của BigBike, có nguồn và mã băm trong [hồ sơ fixture](evidence/assistant-2026-09-08/video-fixture-hashes.json). Không dùng video sinh bằng AI. Tám lượt native được phép đã dùng đủ; không gọi thêm để vượt ngân sách.

| Ca | Nội dung | Từ nhận xong tệp đến lưu câu trả lời | Kết quả |
|---|---|---:|---|
| V01 lần đầu | Thao tác tai nghe, Việt, không lời nhắn | 19,79 s | Nhìn đúng nhưng phần nối tư vấn sai; đã sửa R18 |
| V02 lần đầu | Tìm fullface dưới 7 triệu, Anh, có lời nhắn | 19,32 s | Có thẻ vượt giá; đã sửa R19 |
| V03 | Thao tác chỉnh mũ, Anh, không lời nhắn | 20,38 s | Mô tả thao tác, hỏi mục đích; không tự kết luận hỏng |
| V05 | Giữ lời nói về kết nối, cắt hình để không lộ thao tác đó | 9,26 s | Trả đúng chủ đề kết nối tai nghe nghe được |
| V06 | Clip đối chứng đã tắt tiếng | 9,17 s | Chỉ mô tả hình, không nhận là đã nghe lời nói |
| V01 chạy lại | Cùng thao tác tai nghe, không lời nhắn | 13,68 s | Giữ đúng chủ đề, hỏi rõ thay vì đoán cách tháo/phụ kiện |
| V02 chạy lại | Cùng yêu cầu tìm mũ dưới 7 triệu | 16,01 s | Tám thẻ đều nằm trong ngân sách |
| V04 qua giao diện | Video mũ + hỏi chính sách bảo hành bằng Việt | 19,37 s | Nhận nhóm mũ, không chốt mẫu thiếu bằng chứng; trả đúng phần bảo hành ngay cùng lượt |

[Thời gian từ bản ghi máy chủ](evidence/assistant-2026-09-08/video-server-timings.json), [câu trả lời video](evidence/assistant-2026-09-08/video-main.jsonl), [V04](evidence/assistant-2026-09-08/video-ui-answer.json). Cả tám lượt dưới 60 giây; clip thực khoảng 12 giây. V05/V06 là đối chứng khả năng dùng âm thanh; không khẳng định đã kiểm mọi loại giọng nói/âm thanh.

Các kiểm không gọi thêm AI:

- MP4/MOV/WebM giải mã được, giữ tiếng; video 16 giây bị từ chối bằng Việt/Anh, 40 MiB + 1 byte bị từ chối, tệp hỏng bị từ chối. Video thứ ba của hội thoại bị chặn; ảnh+video hoặc hai ID video trong một lượt bị chặn. Quota mười lượt được kiểm cạnh tranh trên PostgreSQL thử, không tiêu thêm hai lượt AI của shop.
- Khi cố ý gửi câu hỏi sau deadline của tệp thử: nhận xin lỗi và mời gửi ảnh; gửi lại trả cùng kết quả, không tăng quota. Unit/integration kiểm giới hạn dùng chung khi nhà cung cấp chậm hoặc trả body trễ. Chưa cố tình làm Gemini thật treo đủ 60 giây.
- Chủ hội thoại HTTP 200/no-store; không token hoặc khách khác HTTP 404. Admin có quyền xem 200; chưa đăng nhập 401; tài khoản admin thật trong preview thiếu `chat.read` nhận 403. [Bằng chứng quyền](evidence/assistant-2026-09-08/video-permissions.json), [thiếu quyền](evidence/assistant-2026-09-08/video-admin-permission-denied.json).
- Dời riêng hạn của fixture về quá hạn: GET bị chặn ngay; tác vụ xóa thật đưa metadata về DELETED; kiểm object bằng xác thực nhận `NoSuchKey`. Đây là kiểm mốc hết hạn bằng fixture, không phải đã chờ đủ bảy ngày. [Bằng chứng xóa](evidence/assistant-2026-09-08/video-object-deletion.json).
- Web thật ở 375/768/1440 px phát clip qua địa chỉ riêng trong trình duyệt, có điều khiển, reload vẫn phát; không lỗi JavaScript trong lượt kiểm cuối. Trang quản trị 1440 px cũng phát được. Lỗi dung lượng/thời lượng tiếng Anh đã hiển thị đúng trên điện thoại. [Web](evidence/assistant-2026-09-08/video-ui.jsonl), [admin](evidence/assistant-2026-09-08/video-admin-ui.json).

V04 đã hoàn thành trên server khi Playwright không đọc được body SSE; khôi phục bằng lịch sử chính phiên thử và replay có cùng kết quả, không gọi lại AI. Token của riêng fixture preview được cấp lại sau lỗi lưu session của harness, có dấu trong manifest riêng. Đã sửa harness rồi kiểm reload thực. Không dùng lỗi của harness để báo sai chi phí hoặc giả thành lượt AI thành công mới.

## 5. Nội dung còn cần chủ shop quyết định

| Nội dung | Dữ liệu hiện tại | Bản đề xuất để duyệt; chưa ghi dữ liệu thật |
|---|---|---|
| Giờ mở cửa | Việt: T2–T7 09–21, CN 09–17. Anh: T2–T6 09–21, T7–CN 09–18. | Chọn một lịch chính xác rồi đồng bộ cả hai bản. Không tự chọn lịch nào. |
| Địa chỉ Anh | Còn Ward 14, District 11; bản Việt đang là Phường Hoà Bình. | `79/30/52 Au Co, Hoa Binh Ward, Ho Chi Minh City`, theo địa chỉ Việt hiện có. |
| Tên Anh JK-1734 | `komine-jk-1734-summer-motorcycle-jacket` | `Komine JK-1734 summer motorcycle jacket`. |
| GK-242 và nhu cầu mùa hè | Tên Anh nói summer/mesh; tên Việt chỉ “Găng tay cụt ngón Komine GK-242”, làm số mẫu lọc hai ngôn ngữ lệch một. | Xác nhận mô tả mùa hè; nếu đúng, tên Việt đề xuất “Găng tay moto mùa hè cụt ngón Komine GK-242”. |

Đã hỏi về dữ liệu liên hệ/tên hàng, chưa nhận được lựa chọn rõ. Đây là dữ liệu đang công bố, nên thao tác ghi cần chủ shop duyệt theo ràng buộc phiên làm việc và `AGENTS.md` §5.6. Không đặt chính sách mới để che mâu thuẫn nguồn.

## 6. Tài liệu và kiểm tra kỹ thuật

Cập nhật cùng thay đổi:

- [BUSINESS_RULES.md](../business/BUSINESS_RULES.md): `CHAT_RULE_062–065`, kế thừa `001/003/005/017/020/058–060`.
- [API_CONTRACT.md](../engineering/API_CONTRACT.md), [DATA_CONTRACT.md](../engineering/DATA_CONTRACT.md), OpenAPI: upload/đọc video, lịch sử, giới hạn, deadline, trạng thái, quota.
- [STATE_MACHINES.md](../business/STATE_MACHINES.md), [PERMISSION_MATRIX.md](../engineering/PERMISSION_MATRIX.md), [RATE_LIMITING.md](../engineering/RATE_LIMITING.md).
- [INTEGRATION_GUIDE.md](../engineering/INTEGRATION_GUIDE.md), [DEPLOYMENT_GUIDE.md](../engineering/DEPLOYMENT_GUIDE.md), [API_FLOW_MAP.md](../engineering/API_FLOW_MAP.md), [WORKFLOW_OVERVIEW.md](../business/WORKFLOW_OVERVIEW.md), [TESTING_GUIDE.md](../engineering/TESTING_GUIDE.md).
- Chính sách bảo mật và toàn bộ thông báo mới cho khách có Việt/Anh; không thêm dòng công bố vào khung chat trái quyết định cũ.

Backend: toàn bộ 1.730 kiểm tra hoàn thành, không lỗi, một kiểm tra PublicRead đã bị đánh dấu bỏ qua trong nguồn. Sau các sửa cách hiểu câu cuối, chạy lại 289 kiểm tra trợ lý/OpenAPI trên mã cuối, không lỗi/bỏ qua. Đóng gói JAR và image runtime có ffmpeg đạt; chính image đó giải mã/encode H.264 + AAC trọn clip thật thành công dưới user không đặc quyền, không gọi thêm AI. Đây là kiểm kỹ thuật; không thay thế bằng chứng AI thật.

Admin: 120 tệp/1.144 kiểm tra đạt; lint, kiểm song ngữ, format và build đạt. Web: 104 tệp/684 kiểm tra của lần chạy toàn bộ cuối đạt; build production 75 trang, lint/kiểu dữ liệu, format và kiểm giao diện video đều đạt. Ba kỳ vọng bảo mật cũ ở lần đầu đã được sửa, lần cuối không còn lỗi. Các sửa kiểu dữ liệu ở fixture UI ngoài chat chỉ để cổng build chạy được; không đổi hành vi các màn kinh doanh đó.

## 7. Lượt AI, dọn dữ liệu và triển khai

**Đã dùng 92 lượt chữ + 5 lượt ảnh + 8 lượt video = 105 lượt theo hạn mức của shop.** Trần được duyệt 160/8/8. Bộ đếm chữ toàn shop 93 gồm một lượt có trước audit; ảnh 5. Đối chiếu 33 lượt chữ baseline trước khi xóa và 59 bản ghi preview có gọi AI khớp tổng 92. Video preview giữ bộ đếm 8. [Sổ sử dụng](evidence/assistant-2026-09-08/usage-final.json).

Đã xóa đúng 54 phiên thử trên production; không sửa/xóa hàng hóa, chính sách hoặc dữ liệu khách. Preview đã xóa hết hội thoại/tin nhắn/ảnh/video/visitor thử; kiểm kho bằng xác thực còn 0 object chat, giữ các bộ đếm. Các server preview đã dừng sau khi lấy đủ bằng chứng để trả tài nguyên cho máy chủ. Cấu hình tác vụ lịch của preview không được đưa vào ứng dụng đóng gói.

Gói đưa lên thật cần owner duyệt:

1. Áp dụng đúng patch từ worktree riêng, kiểm tra không xung đột với phiên khác; không thay cả cây mã. Build web/admin bằng môi trường production, không dùng bundle preview đã trỏ localhost.
2. Nạp backend có ffmpeg và migration bổ sung V1081; không sửa migration cũ. Nếu triển khai ngày 08/09, ghi quota video tối thiểu 8 bằng upsert chỉ tăng; nếu sang ngày khác, giữ số 8 ở đúng ngày 08/09. Không hoàn quota sau dọn dữ liệu.
3. Nạp riêng location `/api/v1/chat/videos` cho 45 MiB; gateway đang chạy có giới hạn chung 10 MiB. Bản cấu hình đã qua `nginx -t` trên bản sao; không sửa file đang dùng hoặc reload nginx trong đợt kiểm.
4. Kiểm sau triển khai trên đúng phiên thử được duyệt và ngân sách còn lại. Hoàn tác web/admin được; giữ backend biết video và tác vụ xóa bảy ngày cho tệp đã nhận. Không đưa backend về bản chỉ có ảnh khi còn video/khóa ngoại liên quan.

**Chưa thực hiện:** nạp dịch vụ/gateway đang phục vụ khách, migration/quota video production, sửa dữ liệu nguồn nêu ở mục 5, kiểm video qua tên miền production sau rollout. Lý do: cần duyệt thao tác trên hệ thống dùng chung/dữ liệu thật; không phải thiếu mã hoặc bỏ qua bước. Không thể kết luận năm tiêu chí đều trọn vẹn khi nội dung nguồn chưa được chủ shop chốt.
