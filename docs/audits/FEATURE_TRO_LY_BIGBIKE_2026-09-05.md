# Sửa Trợ lý BigBike — 05–06/09/2026

Nguồn: đợt kiểm định 55 lượt đóng vai khách ngày 05/09/2026 (đạt 20%), cộng bằng chứng đo lại trực
tiếp trên hệ thống đang chạy. Kèm hai quyết định owner: bỏ ghi nhớ dài hạn của trợ lý và dọn một
dòng khai báo model AI thừa trong file triển khai.

## 1. Kết luận cho owner

Lỗi nặng nhất **không nằm ở model AI**. Trợ lý soạn xong câu trả lời rồi cơ sở dữ liệu từ chối lưu,
nên khách nhận màn hình lỗi. Trong 24 giờ trước khi sửa, log máy chủ có **47 lần** bị từ chối kiểu
này; cơ sở dữ liệu còn 64 câu của khách nhưng chỉ 47 câu trả lời. Riêng chức năng gửi ảnh hỏng
**100%** vì một lỗi lưu bản ghi, tái hiện được bằng lệnh gọi thật.

## 2. Gốc rễ đã xác minh

| Mã | Hiện tượng khách thấy | Gốc rễ | Bằng chứng |
|---|---|---|---|
| A1 | Câu hỏi phổ thông (chính sách, thông tin cửa hàng, huỷ đơn, từ chối lịch sự) trả về màn hình lỗi | `ck_chat_message_source` chỉ cho 7 giá trị, mã nguồn sinh thêm `RULE` và `PROVIDER_UNAVAILABLE` | 47 lần `violates check constraint` trong log 24h |
| A1b | Hỏi lại đúng câu vừa rồi cũng hỏng | Một lượt không nằm trong cùng một giao dịch nên câu của khách đã lưu, lượt thử lại đụng `uk_chat_messages_request_role` | log `duplicate key ... (request_id, role)` |
| A1c | — | `chat_visitors.created_at` bị ghi `NULL` khi Spring Data dùng `merge()` | log `null value in column "created_at"` |
| A2 | "Shop chưa có mẫu này" trong khi kho đang có | `sellable()` gộp *không kinh doanh* với *hết hàng*; lớp kiểm duyệt còn chặn nhầm câu khẳng định vắng mặt | đối chiếu 185 SP đang bán / 172 còn hàng |
| A3 | Nút So sánh hỏng | Cần ≥2 thẻ của lượt trước (bị A1 xoá sạch); nhận diện so khớp chính xác 6 chuỗi; bộ lọc cùng nhóm hàng co 2 mẫu thành 1 | đọc mã + test |
| A4 | Hiểu sai ý khách | Mất ngữ cảnh do A1; bộ dọn lịch sử cắt cứng còn 3 cặp lượt dù cài đặt là 12 | `ChatHistorySanitizer` |
| A5 | Gửi ảnh hỏng 100% | Gán tay khoá chính cho bản ghi dùng `@GeneratedValue` → Spring Data `merge()` thay vì `persist()` → lỗi tranh chấp phiên bản | gọi thật `POST /chat/images` → HTTP 409 |
| A6 | Gõ không dấu/tiếng Anh bị thiệt | Không phải do bỏ dấu (đã xử lý đúng). "dưới X" loại trừ đúng mốc X | mũ ILM Z503 giá đúng 3.000.000đ bị loại khỏi "dưới 3 triệu" |
| A7 | Lộ câu chữ nội bộ | Câu mẫu backend dùng từ vận hành; câu dẫn tiếp theo dán mặc định vào mọi câu trả lời | `ChatToolService`, `ChatSalesAdvisorService` |
| A8 | Sai tổ hợp màu + size | Liệt kê màu và size rời nhau, không kiểm tổ hợp | Caberg Avalon X: ĐEN–M, TRẮNG–M, ĐỎ–L |

**Vì sao bộ kiểm thử không bắt được A1:** bộ test mặc định chạy trên H2 với Flyway tắt
(`spring.flyway.enabled=false`), nên ràng buộc CHECK của PostgreSQL không tồn tại trong test.

## 3. Đã sửa

- Bản cập nhật CSDL `V1080` mở rộng danh sách nguồn tin nhắn lên 9 giá trị; hằng số
  `ChatMessageSource` là nguồn chân lý duy nhất, có kiểm tra ngay tại biên lưu trữ.
- Lưu câu hỏi của khách thành thao tác lặp lại được, nên lượt thử lại không còn chết.
- Sửa lỗi ghi `created_at` của định danh khách.
- Ảnh khách: bỏ gán tay khoá chính, dùng mã lượt gửi làm khoá lưu trữ; nhận ảnh theo nội dung thật
  thay vì tin nhãn trình duyệt (chấp `image/jpg`, nhãn rỗng), báo riêng cho ảnh HEIC của iPhone.
- Ba trạng thái tồn kho tách bạch (`CHAT_RULE_060`), kèm mẫu tương đương còn hàng và thẻ liên hệ.
- So sánh: nhận diện tên mẫu ngay trong câu hỏi, giữ đúng số mẫu khách nêu, gỡ mã chết.
- "dưới X" tính bao gồm mốc X; bỏ trần cứng 3 cặp lượt.
- Viết lại câu chữ theo giọng nhân viên bán hàng trang trọng; câu dẫn tiếp theo chỉ xuất hiện khi
  hợp ngữ cảnh; chạy lại lớp kiểm duyệt sau khi khối tư vấn sửa câu trả lời.
- Kiểm đúng tổ hợp màu + size; không đọc "này/kia" thành tên màu.
- Phần B: trợ lý chỉ nhớ trong phiên trình duyệt, chỉ tạo định danh khi khách mở khung chat, xoá
  sạch định danh cũ; giữ nút xoá hội thoại, giữ dòng công bố AI, giữ lưu trữ 90 ngày.
- Phần C: xoá `GEMINI_MODEL` khỏi `.env.vps` và khai đủ bộ biến trợ lý theo tài liệu.

## 4. Kiểm thử chống tái diễn

`ChatMessageSourcePostgresTest` chạy Testcontainers + PostgreSQL thật, áp đúng bản cập nhật CSDL rồi
chèn lần lượt mọi giá trị nguồn mà mã nguồn có thể sinh. Đã kiểm chứng ngược: thêm một nguồn mới mà
quên bản cập nhật CSDL thì bài test **đỏ** ngay.

## 5. Kết quả kiểm chứng trên hệ thống thật

| Đợt | Số lượt | Đạt |
|---|---|---|
| Kiểm định cũ 05/09 (trước khi sửa) | 55 | **20%** |
| Kiểm chứng sau khi sửa và triển khai 06/09 | 44 | **55%** |

Phủ 14 nhóm: chính sách giao hàng/thanh toán, bảo hành đổi trả, thông tin cửa hàng, đơn hàng,
ngoài phạm vi, tìm hàng theo nhu cầu, hỏi giá, so sánh hai mẫu, còn hàng/size, ngân sách, câu mơ hồ,
gõ không dấu, tiếng Anh, chốt đơn. Gửi ảnh kiểm riêng bằng lệnh gọi thật (HTTP 200, trước đó 409).
Chi phí: 63 lượt AI thật trong ngày (trần 400). Hội thoại thử đã xoá sau khi đo.

**Các ca trong phiếu kiểm định cũ nay đã đúng:** phí ship/COD/kiểm hàng, địa chỉ + giờ mở cửa,
"mu fullface duoi 3 trieu" (ra đúng ILM Z503 giá 3.000.000đ), "Mũ bảo hiểm fullface dưới 3,5 triệu"
(3 mẫu), so sánh AGV K1S với Caberg Avalon X, "màu đỏ size M" của Caberg Avalon X, LS2 Zoom Lady
"có bán nhưng đang tạm hết hàng", "Cái mũ đó còn không?" (hỏi lại thay vì đoán).

## 6. Còn nợ sau đợt này

Đo bằng 44 lượt hỏi thật sau khi triển khai (05–06/09), 20 lượt chưa đạt:

- **Tìm hàng theo lời tự nhiên vẫn yếu (9 lượt).** "tai nghe gắn mũ để nói chuyện khi đi phượt nhóm",
  "mũ 3/4 nào nhẹ đội đi phố", "găng tay moto mùa hè thoáng khí", "áo giáp đi phượt mùa hè tầm 5
  triệu", "giày moto đi touring tầm 3 triệu", "Shop có mũ LS2 nào không?" và cả 3 câu tiếng Anh dạng
  này đều chưa ra hàng dù kho có. Đây là khâu hiểu nhu cầu → nhóm hàng, không phải khâu lưu câu
  trả lời. **Đây là hạng mục nặng nhất còn lại.**
- **Bốn lượt vẫn rơi vào câu xin lỗi** (huỷ đơn, mặc cả giảm giá, xin danh sách khách hàng, hỏi thời
  hạn bảo hành). Nguyên nhân ghi trong log là công cụ tra chính sách/thông tin cửa hàng bị coi là
  "không bám câu hỏi", nay đã có log chi tiết `chat_tool_call_dropped_detail` để lần tiếp theo tra
  thẳng ra nguyên nhân.
- **"Cần mua đồ đi phượt" vẫn trả về đồ đi mưa.**
- **Ngữ cảnh sản phẩm còn dính sang câu sau** trong cùng một cuộc trò chuyện ("co ao giap mua he
  size XL k" bị trả lời theo mũ của câu trước).
- **"Cho mình xin số điện thoại nhân viên tư vấn"** vẫn hỏi lại lòng vòng thay vì đưa hotline.
- **"Cho mình đặt mẫu đó size L"** liệt kê size thay vì xác nhận chọn mua.

## 7. Dữ liệu cần owner xử lý (không tự sửa)

- Mũ Caberg Avalon X: giá mức sản phẩm 3.390.000đ thấp hơn mọi phiên bản (ĐEN–M và TRẮNG–M
  3.399.000đ, ĐỎ–L 3.999.000đ).
- Cả ba phiên bản của mẫu này ghi tồn kho 0 nhưng trạng thái vẫn "còn hàng".
- `.env.vps` còn `VITE_GEMINI_API_KEY` là khoá Google thật nhưng không còn nơi nào dùng.
