# Báo cáo hoàn tất Trợ lý BigBike — 14/08/2026

## 1. Kết luận cho owner

Mười hạng mục V1–V10 đã được xử lý trong cây làm việc. Trợ lý nay hiểu việc so sánh các mẫu vừa hiện, giữ đúng ngữ cảnh một/nhiều sản phẩm, không để khách khác phải xếp hàng, giữ trần AI chính xác khi có nhiều người hỏi cùng lúc, phục hồi tốt hơn khi dịch vụ AI hoặc một thẻ sản phẩm gặp lỗi, và có chỉ số câu chưa trả lời được trong quản trị.

Phần sửa cuối cùng cho truy vấn PostgreSQL đã có kiểm thử bằng PostgreSQL thật nhưng **chưa được nạp vào container dùng chung**, vì quy định vận hành không cho phép agent tự khởi động lại dịch vụ. Do đó hai kịch bản thật V5/V6 chưa được chạy lại sau bản sửa cuối; xem mục 8.

Căn cứ tài liệu canonical đã cập nhật trước khi sửa code:

- `docs/business/BUSINESS_RULES.md`: `CHAT_RULE_001`, `CHAT_RULE_005`, `CHAT_RULE_006`, `CHAT_RULE_007`, `CHAT_RULE_009`, `CHAT_RULE_010`, `CHAT_RULE_018`, `CHAT_RULE_019`, `CHAT_RULE_022`, `CHAT_RULE_023`.
- `docs/engineering/API_CONTRACT.md`: hợp đồng gửi tin, timeout phía web, thống kê câu chưa trả lời và dữ liệu quản trị hội thoại.
- `docs/engineering/DATA_CONTRACT.md`: bộ đếm AI theo ngày, nguồn fallback và thống kê quản trị.
- `docs/engineering/API_FLOW_MAP.md`: luồng so sánh, tham chiếu sản phẩm, đổi nhu cầu, retry và fallback.
- `docs/engineering/INTEGRATION_GUIDE.md`: retry Gemini, giới hạn provider request và cơ chế cứu phần trả lời dùng được.

## 2. Trạng thái V1–V10

| Vấn đề | Trạng thái | Kết quả kinh doanh | Bằng chứng chính |
|---|---|---|---|
| V1 — Bộ lọc chặn nhầm câu đúng | Đã sửa | Phân biệt trợ lý tự xưng “em” với gọi khách là “em”; không hiểu nhầm “từ tìm kiếm” hoặc “hai hoặc ba mẫu”; vẫn chặn câu cộc lốc, bịa số, mã nội bộ, thông tin riêng tư và URL lạ. | `ChatResponseGuard.java`, `ChatResponseGuardTest.java`; `CHAT_RULE_001`, `CHAT_RULE_007` |
| V2 — So sánh các mẫu | Đã sửa | Khi lượt trước vừa hiện 2–3 mẫu, trợ lý so sánh đúng các mẫu đó bằng giá, cỡ, màu, lựa chọn và thông số đã lưu; chỉ hỏi tên khi không có thẻ đã xác minh. | `ChatToolService.java`, `ChatToolServiceTest.java`, `ChatSearchInterpretationTest.java`; `CHAT_RULE_006` |
| V3 — Chỉ phục vụ một khách/lúc | Đã sửa | Khác hội thoại chạy đồng thời; cùng hội thoại vẫn tuần tự; quota ngày giữ chỗ nguyên tử, không vượt trần; web dừng chờ sau 45 giây, giữ nội dung để thử lại. | `ChatService.java`, `ChatAiQuotaService.java`, `V1024__add_atomic_chat_ai_daily_usage.sql`, `ChatConcurrencyTest.java`, `FloatingChat.tsx`; `CHAT_RULE_009`, `CHAT_RULE_010` |
| V4 — Hai bài kiểm thử đỏ và tên “Bi” còn sót | Đã sửa | Câu chào chuẩn và câu hỏi mơ hồ nhiều mẫu hoạt động đúng; tên khách nhìn thấy đổi thành “Trợ lý BigBike” ở web, quản trị, câu trả lời và cài đặt. | `ChatAvailabilityTest.java`, `ChatToolServiceTest.java`, `V1025__rename_chat_assistant_visible_copy.sql`, các locale web/admin |
| V5 — Quên “sản phẩm này” | Đã sửa | Một mẫu thì nối ngay đúng mẫu; nhiều mẫu thì hỏi chọn và nêu đúng tên; không dùng câu “đang hiển thị N sản phẩm” thay cho câu trả lời chi tiết. | `ChatToolService.java`, `ChatToolServiceTest.java`; `CHAT_RULE_005`, `CHAT_RULE_006` |
| V6 — Giá cũ bám sang loại hàng mới | Đã sửa | Đổi loại hàng thì bỏ giá kế thừa; nếu chỉ bộ lọc kế thừa làm rỗng kết quả thì bỏ riêng bộ lọc đó, tìm lại và nói rõ; không bỏ giá khách vừa nêu. | `ChatToolService.java`, `ChatSearchInterpretationTest.java`; `CHAT_RULE_018` |
| V7 — Một lỗi nhỏ làm mất cả câu trả lời | Đã sửa | Retry đúng một lần sau 2 giây cho lỗi tạm thời; cứu câu hoàn chỉnh khi chạm giới hạn; rút về tối đa 5 câu rồi kiểm lại; chỉ bỏ thẻ sản phẩm hỏng. | `AiChatClient.java`, `ChatResponseGuard.java`, `ChatService.java`, `AiChatFunctionCallingTest.java`, `ChatServiceFallbackTest.java`; `CHAT_RULE_007`, `CHAT_RULE_019` |
| V8 — Không biết vì sao trợ lý im lặng | Đã sửa | Mọi luồng fallback/chặn dùng mã lý do cố định không chứa nội dung chat hay định danh; quản trị có chỉ số số câu chưa trả lời được theo ngày. | `ChatFallbackReason.java`, `ChatService.java`, `AdminChatService.java`, `AdminChatStatsResponse.java`, `ChatConversationListScreen.jsx`; `CHAT_RULE_019` |
| V9 — Hai nút gợi ý lạc đề | Đã sửa | “Tìm theo nhu cầu” và “Đổi nhu cầu” chỉ nêu tối đa 4 nhóm cấp cao nhất rồi hỏi khách; “Đổi nhu cầu” xóa bộ lọc cũ; không sửa thứ tự kho. | `ChatToolService.java`, `ChatToolServiceTest.java`; `CHAT_RULE_022` |
| V10 — Màu còn dạng mã | Đã sửa | Đã xuất đủ danh sách phát hiện trên dữ liệu đang chạy; không sửa bất kỳ màu hay sản phẩm nào. | Mục 7 của báo cáo; `CHAT_RULE_023` |

## 3. Bằng chứng V1 — toàn bộ câu mẫu song ngữ

Kiểm thử `everyPreparedBilingualReplyFamilyPasses` đưa **30 câu mẫu thuộc 15 nhóm** qua đúng lớp kiểm duyệt dùng ngoài thực tế. Kết quả: **30/30 được chấp nhận**.

1. Tự giới thiệu
   - VI: “Dạ, em là Trợ lý BigBike, trợ lý ảo AI của BigBike. Em có thể tìm sản phẩm đang bán, tra chính sách đã công bố hoặc xem đơn của tài khoản đang đăng nhập. Anh/chị cho em biết tên hàng, thương hiệu, danh mục hoặc tầm giá đang quan tâm nhé.”
   - EN: “I am BigBike Assistant, BigBike's AI shopping assistant. I can find currently sold products, check published policies, or view orders for a signed-in account. Please tell me the product, brand, category, or budget you are interested in.”
2. Hỏi loại hàng/nhu cầu
   - VI: “Dạ, anh/chị đang cần loại sản phẩm nào hoặc muốn dùng cho nhu cầu gì ạ? Anh/chị cho em biết loại hàng và tầm giá để em kiểm tra đúng sản phẩm đang bán nhé.”
   - EN: “What type of product or riding need would you like help with? Tell me the item and budget, and I will check currently sold products without guessing.”
3. Nêu nhóm hàng lớn
   - VI: “Dạ, một số nhóm hàng chính của BigBike gồm Mũ bảo hiểm, Đồ bảo hộ và Phụ kiện. Anh/chị đang cần nhóm nào hoặc muốn dùng cho nhu cầu gì ạ?”
   - EN: “BigBike's main product groups include Helmets, Protective gear and Accessories. Which group or riding need would you like help with?”
4. Hỏi tên mẫu cần so sánh khi chưa có thẻ trước đó
   - VI: “Dạ, anh/chị muốn so sánh hai hoặc ba mẫu nào ạ? Em sẽ chỉ dùng thông tin sản phẩm đã lưu.”
   - EN: “Which two or three models would you like to compare? I will use only the saved product information.”
5. Chưa hoàn tất tra cứu
   - VI: “Dạ, em chưa lấy được thông tin phù hợp cho câu hỏi này nhưng anh/chị vẫn có thể hỏi tiếp. Anh/chị gửi tên mẫu, loại hàng hoặc chi tiết cần kiểm tra, em sẽ tra lại theo dữ liệu BigBike đang bán nhé.”
   - EN: “I could not complete that lookup yet. Please send the product name, product type or exact detail you want checked, and I will try again from the current BigBike catalogue.”
6. Cần thêm chi tiết
   - VI: “Dạ, em cần anh/chị nói thêm loại hàng, tên mẫu hoặc tầm giá để lọc đúng dữ liệu BigBike đang bán. Anh/chị cho em biết rõ thêm một chi tiết giúp em nhé.”
   - EN: “I still need a little more detail to help with this. Please tell me the product type, model or price range, and I will filter the products currently sold by BigBike.”
7. Bỏ giá kế thừa và tìm lại
   - VI: “Dạ, tầm giá đã nêu ở lượt trước không có kết quả phù hợp nên em đã bỏ riêng bộ lọc cũ và tìm lại yêu cầu này. Các sản phẩm bên dưới là kết quả đang bán sau khi em tìm lại. Anh/chị cho em tầm giá mới nếu muốn em lọc hẹp lại nhé.”
   - EN: “The price filter from your previous product request returned no matches, so I removed only that older filter and searched this request again. The products below are the currently available results after that retry. Tell me a new budget if you would like me to narrow the list again.”
8. Tìm rộng hơn yêu cầu ban đầu
   - VI: “Dạ, các sản phẩm bên dưới đến từ tìm kiếm rộng hơn yêu cầu ban đầu của anh/chị. Anh/chị cho em tên mẫu, loại hàng hoặc tầm giá cụ thể hơn để em lọc lại nhé.”
   - EN: “The products below come from a broader search than your original request. Please tell me a more specific name, category or budget so I can narrow the results.”
9. Trợ lý tạm nghỉ
   - VI: “Dạ, Trợ lý BigBike đang tạm nghỉ. Anh/chị bấm Gặp nhân viên; Hotline, Zalo và Messenger luôn hiển thị bên dưới để BigBike hỗ trợ trực tiếp.”
   - EN: “BigBike Assistant is temporarily paused. Please choose Talk to staff; Hotline, Zalo and Messenger are available below for direct help.”
10. Hết trần AI theo ngày
    - VI: “Dạ, Trợ lý BigBike đã dùng hết lượt tư vấn tự động trong hôm nay. Anh/chị bấm Gặp nhân viên; Hotline, Zalo và Messenger luôn hiển thị bên dưới để BigBike hỗ trợ trực tiếp.”
    - EN: “BigBike Assistant has reached today's automated-chat limit. Please choose Talk to staff; Hotline, Zalo and Messenger are available below for direct help.”
11. Hết 12 lượt của hội thoại
    - VI: “Dạ, em đã nhận đủ 12 lượt hỏi trong hội thoại này. Anh/chị bấm Gặp nhân viên để BigBike hỗ trợ tiếp nhé. Các kênh liên hệ vẫn luôn có sẵn.”
    - EN: “This conversation has reached its 12-question limit. Please choose Talk to staff to continue with BigBike. Your contact options remain available.”
12. Chính sách đổi/trả
    - VI: “Dạ, em tóm tắt chính sách công bố của BigBike: yêu cầu đổi size hoặc đổi sản phẩm trong 7 ngày và hoàn tiền hoặc trả hàng trong 1 ngày, tùy điều kiện nguyên trạng đã nêu. Hàng sale và phí vận chuyển có điều kiện riêng. Anh/chị vui lòng mở trang Chính sách đổi trả hoặc bấm Gặp nhân viên trước khi gửi hàng về.”
    - EN: “BigBike's published policy allows a size or product exchange request within 7 days, and a refund or return request within 1 day, subject to the listed product-condition rules. Sale items and shipping responsibility have separate conditions. Please open the Returns and Exchanges Policy or choose Talk to staff before sending anything back.”
13. Bảo hành
    - VI: “Dạ, em xác nhận BigBike bảo hành chính hãng theo chính sách từng thương hiệu; thời hạn cụ thể hiển thị trên trang sản phẩm. Va đập, tự ý sửa đổi và hao mòn tự nhiên không mặc nhiên thuộc diện bảo hành. Trường hợp phức tạp, anh/chị bấm Gặp nhân viên và gửi ảnh hoặc video giúp shop kiểm tra.”
    - EN: “BigBike provides genuine manufacturer warranty under each brand's policy, and the exact period is shown on each product page. Impact damage, modification and normal wear are not automatically covered. For a complex warranty case, please choose Talk to staff and send photos or video.”
14. Thanh toán
    - VI: “Dạ, em xác nhận BigBike hiện hỗ trợ hai hình thức thanh toán thủ công: nhận hàng trả tiền và chuyển khoản ngân hàng. Em không nhận tiền và không chốt đơn thay anh/chị. Anh/chị vui lòng đi qua Giỏ hàng để chọn hình thức và kiểm tra lại trước khi xác nhận.”
    - EN: “BigBike currently supports two manual payment methods: cash on delivery and bank transfer. BigBike Assistant cannot take payment or place an order on your behalf. Please continue through the cart to choose a method and review the order before confirming.”
15. Giao hàng
    - VI: “Đơn online hiện không cộng phí vận chuyển vào tổng tiền và không có bước chọn hãng giao hàng khi thanh toán. Em không cam kết ngày giao vì hệ thống chưa có dữ liệu thời gian xác nhận. Anh/chị bấm Gặp nhân viên nếu cần ước tính theo địa chỉ cụ thể.”
    - EN: “BigBike does not add a shipping fee to the current online order total, and there is no shipping-method selector at checkout. I cannot promise a delivery date because no confirmed timing data is available. Choose Talk to staff for a destination-specific estimate.”

Chiều chặn vẫn được kiểm thử và đạt:

- Gọi khách bằng “em”: “Chào em…”, “Em vui lòng chọn…”, “Em có thể tham khảo…” bị chặn.
- Xua đuổi/cộc lốc: “Tự xem đi. Dừng hỏi nữa.” bị chặn.
- Bịa số/toàn kho: “BigBike có ba sản phẩm…”, “BigBike chỉ có ba mẫu…”, “BigBike không có bất kỳ…” bị chặn nếu không có tổng từ lượt tra hiện tại.
- Mã kỹ thuật và dữ liệu thô: `JSON`, `API`, `functionCall`, `CANCELLED`, `1590000.00 ₫`, `ronin-red` bị chặn.
- Email, số điện thoại khách hoặc số lạ không thuộc danh sách hotline công khai bị chặn.
- URL do nội dung tự sinh và thẻ hết hàng/giá không đủ điều kiện bị chặn.
- Khẳng định sản phẩm lấy từ lịch sử mà không tra lại ở lượt hiện tại bị chặn.
- Câu đúng dài 6 câu được giữ 5 câu hoàn chỉnh rồi kiểm lại; câu chỉ có 1 câu vẫn bị chặn theo chuẩn 2–5 câu.

## 4. Bằng chứng V3 — đồng thời và quota chính xác

`ChatConcurrencyTest` đạt **2/2**:

- Hai hội thoại được giữ tại một hàng rào đồng thời: cả hai cùng vào bước gọi AI trước khi một bên được thả. Mỗi hội thoại kết thúc đúng 1 lượt, 2 tin, 1 lượt AI; nội dung `alpha` và `beta` không lẫn nhau; bộ đếm ngày là 2.
- 40 yêu cầu giữ quota được bắn đồng thời bằng 16 luồng vào trần 7. Kết quả chính xác **7 được nhận, 33 bị từ chối, bộ đếm cuối bằng 7**, không vượt trần.

Quota mới nằm ở `chat_ai_daily_usage`, giữ slot bằng một phép ghi nguyên tử theo ngày Việt Nam trước khi gọi AI. Retry nội bộ vẫn thuộc cùng một slot. Web dùng timeout 45 giây, khôi phục bản nháp và cho gửi lại đúng nội dung thay vì quay vô tận.

## 5. Nhật ký thay đổi trên hệ thống đang chạy

Đã chạy `docker ps` trước khi đọc hệ thống; các container `bigbike-backend`, `bigbike-web`, `bigbike-admin`, `bigbike-postgres`, `bigbike-redis`, `bigbike-minio` đều healthy. Agent không tự khởi động, dừng hay khởi động lại container.

### 5.1 Câu chào owner cho phép cập nhật

| Ngôn ngữ | Giá trị cũ | Giá trị mới |
|---|---|---|
| VI | `Em là Bi, trợ lý ảo AI của BigBike. Em có thể giúp anh/chị chọn sản phẩm, xem chính sách hoặc kiểm tra đơn hàng đã đăng nhập.` | `Em là Trợ lý BigBike, trợ lý ảo AI của BigBike. Em có thể giúp anh/chị chọn sản phẩm, xem chính sách hoặc kiểm tra đơn hàng khi đã đăng nhập.` |
| EN | `I’m Bi, BigBike’s AI assistant. I can help you choose products, check store policies, or view orders on your signed-in account.` | `I’m BigBike Assistant, BigBike’s AI shopping assistant. I can help you choose products, check store policies, or view orders on your signed-in account.` |

API availability tiếng Việt và tiếng Anh đã trả đúng hai giá trị mới trên hệ thống đang chạy.

### 5.2 Mô tả cài đặt đổi tên

| Cài đặt | Mô tả cũ | Mô tả mới |
|---|---|---|
| Bật/tắt | `Bật trợ lý bán hàng Bi. Khi tắt, widget trở về bảng Hotline–Zalo–Messenger.` | `Bật Trợ lý BigBike. Khi tắt, widget vẫn giữ các kênh Hotline–Zalo–Messenger.` |
| Câu chào | `Câu chào đầu khung chat của Bi.` | `Câu chào đầu khung chat của Trợ lý BigBike.` |
| Lịch sử gần nhất | `Số cặp hỏi–đáp gần nhất gửi cho Bi sau khi che thông tin riêng tư; 0 để tắt, tối đa 3.` | `Số cặp hỏi–đáp gần nhất gửi cho Trợ lý BigBike sau khi che thông tin riêng tư; 0 để tắt, tối đa 3.` |

Migration `V1025` dùng điều kiện so sánh giá trị cũ trước khi đổi, nên không ghi đè nếu owner đã tùy chỉnh sau đó.

### 5.3 Các thay đổi dữ liệu khác

- `V1024` tạo bảng đếm quota nguyên tử và backfill số lượt AI đã có theo ngày Việt Nam. Không chứa nội dung chat hoặc thông tin khách.
- Kiểm thử thật tạo 11 câu hỏi không chứa thông tin cá nhân, các phản hồi và bản ghi hội thoại tương ứng; một hội thoại được ghi trạng thái khách từ chối lời mời liên hệ. Không tạo lead, không ghi tên/số điện thoại.
- Bộ đếm AI thật trước kiểm thử là **3**, sau kiểm thử là **11**: đã dùng **8 lượt AI trả phí**, dưới trần 12 lượt dành cho xác minh cuối.
- Không sửa giá, tồn kho, đơn hàng, khách hàng, nội dung sản phẩm, tên sản phẩm, tên màu hoặc thứ tự danh mục.

## 6. Xác minh cuối bằng hệ thống thật

Đã gửi 11 câu hỏi, dùng 8 lượt AI:

| Kịch bản | Kết quả trên container đang chạy |
|---|---|
| Tìm mũ 2–3 triệu rồi “So sánh các mẫu” | Đạt. Tìm ra LS2 OF600 và ILM Z503; lượt sau so sánh đúng hai mẫu bằng dữ liệu đã lưu, không fallback. |
| Câu mơ hồ “Cái kia rẻ hơn đúng không?” khi có hai mẫu | Đạt. Trợ lý nêu đúng hai tên và hỏi khách chọn, không gắn lại hai thẻ. |
| Hỏi “sản phẩm này” sau đúng một mẫu | Chưa xác nhận lại sau bản sửa cuối. Truy vấn tạo ngữ cảnh một mẫu gặp lỗi PostgreSQL của bản container cũ nên không tạo được tiền đề hợp lệ. |
| Đang lọc 4–5 triệu rồi chuyển sang tai nghe | Chưa xác nhận lại sau bản sửa cuối. Lượt chuyển loại hàng gặp cùng lỗi PostgreSQL của bản container cũ. |
| “Tìm theo nhu cầu” | Đạt. Chỉ nêu 4 nhóm cấp cao nhất rồi hỏi nhu cầu. |
| Đi tới fallback, từ chối lời mời liên hệ, hỏi tiếp | Đạt. Lời mời xuất hiện; từ chối thành công; lượt sau không hỏi lại. |
| Không còn “Bi” trong lời trợ lý/khung chat | Đạt trong 11 phản hồi thật và bộ E2E. Tên “Bi” chỉ còn trong migration lịch sử/điều kiện so sánh giá trị cũ và audit lịch sử, không phải chữ khách nhìn thấy. |

Lỗi thật phát hiện trong quá trình này: PostgreSQL không cho `SELECT DISTINCT` sắp xếp theo biểu thức tên khi join danh mục. Bản sửa chuyển điều kiện thuộc danh mục sang truy vấn con theo mã sản phẩm, nên không còn dòng trùng và vẫn sắp xếp được. Đồng thời lớp đọc câu hỏi đã bỏ đúng các cụm dẫn nhập “tìm đúng mẫu”, “chuyển sang”, “đổi sang” trước khi tạo từ định danh. `CatalogPostgresQueryTest` đã xác nhận cả tìm cho trợ lý và danh sách công khai với danh mục + sắp tên trên PostgreSQL thật.

## 7. V10 — màu dạng mã để owner sửa trong quản trị

Đây là kết quả truy vấn chỉ đọc trên PostgreSQL đang chạy. **Không có dữ liệu nào trong danh sách dưới đây bị agent sửa.** Có 39 cặp sản phẩm–giá trị màu cần owner rà lại:

| # | Sản phẩm | Giá trị màu hiện tại |
|---:|---|---|
| 1 | Balo moto phượt ILM BP01 | `VANG` |
| 2 | Mũ bảo hiểm fullface NIC N01 | `carbon-forged-bong` |
| 3 | Mũ bảo hiểm fullface ILM MF509 | `cyborg-gray` |
| 4 | Mũ bảo hiểm fullface ILM MF509 | `day1-green` |
| 5 | Mũ bảo hiểm fullface ILM MF509 | `day1-orange` |
| 6 | BÓ GỐI KOMINE SK-608 CHÍNH HÃNG | `den` |
| 7 | GIÀY BẢO HỘ CHỐNG NƯỚC KOMINE BK-101 | `den` |
| 8 | MŨ BẢO HIỂM NỬA ĐẦU CHO NGƯỜI ĐI XE MÁY XPEED | `den` |
| 9 | MŨ BẢO HIỂM LẬT HÀM LS2 FF901 ADVANT X CARBON | `den-bong` |
| 10 | MŨ BẢO HIỂM NỬA ĐẦU CHO NGƯỜI ĐI XE MÁY XPEED | `den-bong` |
| 11 | MŨ BẢO HIỂM DUAL SPORT ILM WS-902 | `den-nham-2` |
| 12 | Mũ bảo hiểm fullface ILM MF509 | `den-nham-3` |
| 13 | Mũ bảo hiểm fullface ILM MF510 Racing | `den-nham-3` |
| 14 | Mũ bảo hiểm fullface ILM Z503 | `den-nham-3` |
| 15 | Mũ bảo hiểm tháo hàm ILM Z302 | `den-nham-3` |
| 16 | Mũ bảo hiểm fullface ILM MF510 Racing | `den-xam` |
| 17 | Mũ bảo hiểm fullface ILM MF509 | `mythology-gold` |
| 18 | Mũ bảo hiểm fullface ILM MF509 | `mythology-silver` |
| 19 | GIÀY BẢO HỘ CHỐNG NƯỚC KOMINE BK-101 | `nau` |
| 20 | Mũ bảo hiểm fullface ILM MF509 | `ronin-blue` |
| 21 | Mũ bảo hiểm fullface ILM MF509 | `ronin-red` |
| 22 | Mũ bảo hiểm fullface ILM MF510 Racing | `tem-do` |
| 23 | Mũ bảo hiểm fullface ILM MF510 Racing | `tem-trang` |
| 24 | Mũ bảo hiểm fullface ILM MF510 Racing | `tem-xam` |
| 25 | MŨ BẢO HIỂM DUAL SPORT ILM WS-902 | `trang-2` |
| 26 | Mũ bảo hiểm fullface ILM MF510 Racing | `trang-xam` |
| 27 | Mũ bảo hiểm fullface ILM MF509 | `war-damaged-gray` |
| 28 | BÓ GỐI KOMINE SK-608 CHÍNH HÃNG | `xam-2` |
| 29 | GIÀY BẢO HỘ CHỐNG NƯỚC KOMINE BK-101 | `xam-2` |
| 30 | MŨ BẢO HIỂM NỬA ĐẦU CHO NGƯỜI ĐI XE MÁY XPEED | `xam-2` |
| 31 | Mũ bảo hiểm fullface ILM MF510 Racing | `xam-vang` |
| 32 | Mũ bảo hiểm tháo hàm ILM Z302 | `xanh-army` |
| 33 | Quần giáp moto jean mùa hè Spirit | `xanh-dam-om` |
| 34 | Quần giáp moto jean mùa hè Spirit | `xanh-dam-suong` |
| 35 | Áo giáp moto touring LS2 Bolton Air cho nam | `xanh-la-xam` |
| 36 | Mũ bảo hiểm tháo hàm ILM Z302 | `xanh-mecha` |
| 37 | Quần giáp moto jean mùa hè Spirit | `xanh-nhat-om` |
| 38 | Quần giáp moto jean mùa hè Spirit | `xanh-nhat-suong` |
| 39 | Quần giáp moto jean mùa hè Spirit | `xanh-om` |

## 8. Kiểm thử và việc còn nợ

### 8.1 Kết quả đạt

- Backend trọng tâm trợ lý: **128/128** đạt, gồm guard, so sánh/ngữ cảnh, consent, fallback, AI orchestration và đồng thời/quota.
- PostgreSQL thật qua Testcontainers: `CatalogPostgresQueryTest` **1/1** đạt; xác nhận tìm theo danh mục + sắp tên ở cả trợ lý và catalog công khai.
- Backend đóng gói: `./mvnw -DskipTests package` đạt.
- Web unit: **53 file, 412/412** đạt.
- Web E2E riêng khung chat: **14/14** đạt, gồm timeout 45 giây và luồng gặp nhân viên.
- Web lint đạt; còn một cảnh báo không chặn thuộc script audit redirect ngoài phạm vi trợ lý. Web production build đạt.
- Admin unit: **86 file, 822/822** đạt; lint và production build đạt.
- `git diff --check` đạt; không có lỗi khoảng trắng trong patch.

### 8.2 Việc còn nợ

1. **Not run: xác minh thật V5/V6 sau bản sửa PostgreSQL cuối.** Lý do: code mới chưa được triển khai vào container dùng chung và agent không được phép tự restart. Cần owner/deployer nạp bản mới, sau đó chạy lại đúng hai tình huống “sản phẩm này” và đổi từ mũ 4–5 triệu sang tai nghe. Không dùng thêm AI thật trong lượt này để giữ ngân sách.
2. **Bộ backend toàn hệ thống chưa xanh hoàn toàn.** Lần chạy sạch có 1.634 test: 9 failure, 2 error, 1 skip. Các lỗi nằm ngoài 10 hạng mục trợ lý và tập trung ở thay đổi redirect/catalog/SEO/test-isolation đang cùng tồn tại trong cây làm việc:
   - `ContentPublicApiTest`: 2 failure (tổng bài viết).
   - `HomepagePublicApiTest`: 2 failure (slug danh mục).
   - `Phase1NReviewsApiTest`: 1 failure (địa chỉ proxy).
   - `PublicReadApiTest`: 3 failure (giá/màu/bài viết).
   - `PermissionCatalogMigrationConsistencyTest`: 1 failure (quyền SEO Editor).
   - `AuthProfileGuardTest`: 1 error (kiểm tra rate-limit ở profile production).
   - `StorefrontCatalogUrlMigrationTest`: 1 error (parser migration V359).
3. Các migration lịch sử và audit cũ vẫn chứa chuỗi “Bi” để lưu vết giá trị cũ/điều kiện compare-and-set. Không đổi các file migration đã chạy; chuỗi này không hiện cho khách hoặc nhân viên.

Chưa commit hoặc push thay đổi.
