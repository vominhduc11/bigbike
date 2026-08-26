# Feature audit — Trợ lý BigBike (23/08/2026)

## Phạm vi và căn cứ

Audit xuyên `bigbike-web` (widget khách), `bigbike-backend` (chat/tool/catalog/persistence) và `bigbike-admin` (lịch sử, thống kê, settings). Tính năng đang `LIVE` theo `docs/business/MODULE_CATALOG.md`; căn cứ chuẩn là `CHAT_RULE_001`–`CHAT_RULE_033`, `POLICY_PAGE_RULE_001`–`003`, `PAY_RULE_001`, `SHIP_RULE_001` và quyết định owner ngày 23/08/2026.

Không tìm thấy mã `AUD-xxx` hiện hành trùng các lỗi runtime ngày 23/08; hai báo cáo `FEATURE_BI_2026-08-10.md` và `FEATURE_TRO_LY_BIGBIKE_2026-08-14.md` là lịch sử triển khai, không thay thế finding dưới đây.

## Findings

### F1 — Lỗi một công cụ bị nói thành shop không có hàng
- **Mức độ:** High
- **Lệch ở đâu:** Backend để `IllegalArgumentException` thoát khỏi vòng tool; web nhận fallback phủ nhận tồn tại hàng.
- **Bằng chứng:** log container `orchestration failed stage=tool_execution` rồi `AI_NO_SAFE_RESULT`; `AiChatClient`, `ChatToolRegistry`, `ChatService`.
- **Rule liên quan:** `CHAT_RULE_017`, `CHAT_RULE_019`.
- **Hậu quả vận hành:** khách gõ đúng LS2 FF800/SCS S10X vẫn bị đuổi đi.
- **Trạng thái:** Đã sửa. Lệnh lỗi bị loại riêng, có một lượt tra phục hồi và mã lý do ổn định; lỗi kỹ thuật dùng câu hệ thống bận thay vì phủ nhận hàng.

### F2 — Tìm hàng sai với không dấu, tiếng Anh, tầm giá và đổi loại
- **Mức độ:** High
- **Lệch ở đâu:** Bộ phân loại ưu tiên alias dài sai nhóm, thiếu `headset`, và giữ bộ lọc cũ tới sau khi tra hụt; gợi ý một phía trả tối đa tám mẫu ngoài giá.
- **Bằng chứng:** `ChatToolService` normalization/category resolution/context fallback.
- **Rule liên quan:** `CHAT_RULE_015`–`018`, `CHAT_RULE_020`, `CHAT_RULE_024`.
- **Hậu quả vận hành:** mất trực tiếp đơn mũ/tai nghe và nêu sai tổng số mẫu.
- **Trạng thái:** Đã sửa. Có fixture đối chiếu đúng 4 mũ dưới 2 triệu, 0 fullface dưới 3 triệu, 8 mũ trong khoảng 3–5 triệu và các alias intercom song ngữ.

### F3 — Giữ kết nối cơ sở dữ liệu trong lúc chờ AI
- **Mức độ:** High
- **Lệch ở đâu:** Toàn bộ `ChatService.send` đang nằm trong một transaction, gồm cả provider wait tối đa 65 giây.
- **Bằng chứng:** `@Transactional` ở `ChatService.send`; log Hikari `Apparent connection leak detected` trỏ về chức năng gửi chat.
- **Rule liên quan:** `CHAT_RULE_009`, `CHAT_RULE_019`.
- **Hậu quả vận hành:** có thể cạn pool và làm web/admin ngừng phục vụ khi đông khách.
- **Trạng thái:** Đã sửa. Lời gọi AI nằm ngoài transaction; kiểm thử Hikari xác nhận 0 kết nối đang được giữ trong lúc provider chờ.

### F4 — Bộ lọc an toàn bỏ lọt bạo lực, 18+ và khiếu nại
- **Mức độ:** High
- **Lệch ở đâu:** Pattern cục bộ không nhận các câu mẫu đã kiểm chứng; xúc phạm rơi về fallback thay vì handoff.
- **Bằng chứng:** `ChatInputGuard`, `ChatToolService.isHumanHandoff`.
- **Rule liên quan:** `CHAT_RULE_008`, `CHAT_RULE_027`.
- **Hậu quả vận hành:** rủi ro uy tín; khách đang bức xúc bị trả lời máy móc.
- **Trạng thái:** Đã sửa; nhánh tự hại và tư vấn tai nạn được khóa bằng regression.

### F5 — Câu kết thúc hội thoại báo sai lý do và sai số lượt
- **Mức độ:** Medium
- **Lệch ở đâu:** Mọi conversation đã đóng đều dùng cùng câu `turnLimitText` viết cứng 12.
- **Bằng chứng:** `ChatService.send`, `turnLimitText`.
- **Rule liên quan:** `CHAT_RULE_008`, `CHAT_RULE_009`, `CHAT_RULE_011`.
- **Hậu quả vận hành:** khách tưởng bị giới hạn dù nguyên nhân là lệch chủ đề hoặc dịch vụ lỗi.
- **Trạng thái:** Đã sửa theo trần 16/20 và bốn lý do riêng.

### F6 — Tồn kho size, so sánh và câu hỏi “nhẹ nhất” không trả đúng ý
- **Mức độ:** High
- **Lệch ở đâu:** Detail chỉ liệt kê option; compare lấy cả phụ kiện và lặp field rỗng; superlative rơi vào danh sách tìm hàng.
- **Bằng chứng:** các formatter detail/compare trong `ChatToolService`.
- **Rule liên quan:** `CHAT_RULE_006`, `CHAT_RULE_020`, `CHAT_RULE_028`.
- **Hậu quả vận hành:** khách không biết biến thể cần mua còn hay hết và khó chọn sản phẩm.
- **Trạng thái:** Đã sửa. Tồn kho trả đúng biến thể, so sánh chỉ giữ đúng nhóm/số mẫu và câu hỏi “nhẹ nhất” không giả kết quả khi thiếu trọng lượng.

### F7 — Thông tin shop/chính sách trả lời cũ hoặc bằng giọng kỹ thuật
- **Mức độ:** Medium
- **Lệch ở đâu:** Bank chưa nằm trong snapshot; giao hàng/chính sách là chuỗi cứng và có câu “hệ thống chưa có dữ liệu”.
- **Bằng chứng:** `ChatToolService.shopInfoOutcome/policyOutcome`; policy web tĩnh ở hai nguồn khác nhau.
- **Rule liên quan:** `CHAT_RULE_001`, `CHAT_RULE_006`, `POLICY_PAGE_RULE_003`, `PAY_RULE_001`, `SHIP_RULE_001`.
- **Hậu quả vận hành:** trả lời không nhất quán, có thể đọc chính sách cũ và bỏ lỡ thanh toán.
- **Trạng thái:** Đã sửa bằng nguồn policy chung và fast-path live; cả hai chính sách lấy số liên hệ, địa chỉ và giờ mở cửa từ nhóm cài đặt liên hệ hiện hành.

### F8 — Thẻ sản phẩm và khung chat cản thao tác mua
- **Mức độ:** High
- **Lệch ở đâu:** Dialog desktop có overlay/body lock; card ngang rộng cố định và ba nút; variant làm nội dung tràn; bảng Markdown ép `min-width`.
- **Bằng chứng:** `FloatingChat.tsx`, `BigBikeProductCard.tsx`, `SafeChatMarkdown.tsx`.
- **Rule liên quan:** `CHAT_RULE_001`, `CHAT_RULE_014`, `CHAT_RULE_028`.
- **Hậu quả vận hành:** nút mua bị cắt, không thấy xác nhận giỏ và không xem được trang sản phẩm.
- **Trạng thái:** Đã sửa theo bố cục owner chốt: 3 thẻ dọc + Xem thêm + một vùng Chọn mua; desktop không còn phủ nền/khóa trang, mobile vẫn toàn màn hình.

### F9 — Lời mời số điện thoại chen ngang nhưng không tạo lead
- **Mức độ:** Medium
- **Lệch ở đâu:** Backend tự phát hai sequence; web chỉ cho mở callback khi đã có prompt.
- **Bằng chứng:** `ChatService.offerLeadIfEligible`, `ChatInteractionService.offerSecondLeadAfterVerifiedCart`, `FloatingChat`.
- **Rule liên quan:** `CHAT_RULE_012`, `CHAT_RULE_025`.
- **Hậu quả vận hành:** cắt ngang luồng mua nhưng từ trước tới nay thu được 0 số.
- **Trạng thái:** Đã sửa: form chỉ sau thao tác Gặp nhân viên/Yêu cầu gọi lại, có consent và chống gửi lặp.

### F10 — Nhãn kết quả và định dạng báo cáo quản trị sai
- **Mức độ:** Medium
- **Lệch ở đâu:** `resultKind` ưu tiên CONTACT trước product; dữ liệu cũ chưa backfill; admin dùng locale/múi giờ máy người xem.
- **Bằng chứng:** `ChatService.resultKind`, repository thống kê, hai màn chat admin.
- **Rule liên quan:** `CHAT_RULE_010`, `CHAT_RULE_029`.
- **Hậu quả vận hành:** chủ shop đánh giá sai hiệu quả bán hàng và thấy tiền/ngày không thống nhất.
- **Trạng thái:** Đã sửa; dữ liệu cũ được backfill khi áp V1051 và cảnh báo tháng chốt 25 USD.

### F11 — Một manh mối rộng đã bị coi là đủ để trả hàng
- **Mức độ:** High
- **Lệch ở đâu:** Máy chủ coi riêng giá, thương hiệu, màu hoặc size là đủ để tìm; khung chat chưa có lựa chọn nhanh cho câu hỏi làm rõ; ngữ cảnh chưa giữ được một chuỗi hỏi nhiều vòng.
- **Bằng chứng:** `ChatToolService`, `ChatService`, `FloatingChat.tsx`, hợp đồng chat và snapshot trình duyệt trước bản sửa ngày 24/08/2026.
- **Rule liên quan:** `CHAT_RULE_034`–`CHAT_RULE_036`.
- **Hậu quả vận hành:** câu như “dưới 5 triệu” trả hàng từ nhiều nhóm không liên quan, vừa khó chọn vừa làm khách hiểu nhầm đây là tư vấn đúng nhu cầu.
- **Trạng thái:** Đã sửa. Backend tự đếm hàng đang bán, hỏi từng tiêu chí có ích, nhớ câu trả lời, dừng ở tám mẫu, xử lý cả đại từ trỏ tới nhiều mẫu và không gọi AI ở các vòng làm rõ. Web hiển thị nút lựa chọn đã kiểm tra, khóa nút cũ và lưu/replay đúng phiên. “Tùy em” dùng đơn hoàn tất đủ ngưỡng, rồi hàng nổi bật, rồi giá gần trung vị; luôn loại hàng hết kho.

## Quyết định owner đã nhận

- 3 thẻ dọc, Xem thêm, một vùng Chọn mua.
- Trần 16 thường/20 PDP.
- Tra hàng giảm giá tiếp tục chat; thương lượng giá chuyển người thật.
- Form gọi lại chỉ khi khách chủ động mở Gặp nhân viên.
- Chính sách Bảo hành/Đổi trả dùng nguồn admin chung.
- Đơn mua miễn phí giao hàng; bank hiển thị đủ sau lời nhắc xác nhận đơn.
- Ngưỡng cảnh báo chi phí tháng 25 USD.
- Làm rõ không có trần riêng; vẫn dùng trần hội thoại chung 16/20.
- Bán chạy của trợ lý chỉ bật từ 10 đơn hoàn tất khác nhau và ít nhất 2 sản phẩm còn hàng có doanh số nối đúng.

## Kiểm thử

- Backend — nhóm Trợ lý/chính sách/tìm hàng: **240/240 đạt**, trong đó API đối chiếu số liệu thật trong prompt là **44/44** và kiểm thử không giữ kết nối lúc chờ AI là **2/2**.
- Migration V1051 trên PostgreSQL 16 tạm, độc lập với dữ liệu cũ: **1/1 đạt**; xác nhận thêm cột callback, gán lại `PRODUCT_RESULTS`, bốn setting policy và ngưỡng 25 USD.
- Website khách: lint đạt; unit **495/495**; production build đạt.
- Trang quản trị: lint đạt; unit **917/917**; production build đạt.
- Playwright khung chat: **18/18 đạt** trên desktop/mobile; phép đo thẻ dọc còn được lặp riêng **3/3 đạt** để loại flake do auto-scroll.
- OpenAPI JSON parse, `git diff --check`, guard dữ liệu runtime và rà encoding tiếng Việt: đạt.
- **Chưa chạy đạt toàn bộ backend:** lệnh full suite ghi nhận 1.454 bài, 0 failure nghiệp vụ, 3 lỗi khởi tạo Testcontainers và 11 skip. Docker 29 yêu cầu API >= 1.40 trong khi Testcontainers 1.20.4 mặc định 1.32; khi chạy lại bằng `-Dapi.version=1.40`, migration cũ `V1029__backfill_catalog_size_scales.sql` chặn fresh DB vì đòi đúng 109 sản phẩm. Không sửa V1029 vì ngoài phạm vi audit này; V1051 đã được kiểm riêng trên PostgreSQL thật như dòng trên.
- **Chưa chạy trên tiến trình Docker đang vận hành:** không áp V1051 vào DB dùng chung và không restart backend/web/admin vì quy tắc vận hành cấm tự ghi DB hoặc restart shared stack. Do đó xác nhận “không còn leak” hiện là bằng kiểm thử Hikari tự động, chưa phải quan sát log tải thật sau triển khai.

### Bổ sung kiểm thử cho F11 ngày 24/08/2026

- Bộ ca backend làm rõ/ranking/guard và web unit được bổ sung theo `CHAT_RULE_034`–`036`; số kết quả cuối cùng được ghi trong báo cáo bàn giao của thay đổi ngày 24/08.
- Playwright riêng cho luồng ba lượt chạy bằng API chat giả lập cục bộ, không gọi trợ lý thật và không dùng dữ liệu hội thoại khách.
- Đối chiếu chỉ đọc qua public catalog hiện hành xác nhận chín nhóm đều có ít nhất hai nhánh nhu cầu làm giảm tập kết quả; riêng Giáp tay chân và Giá đỡ điện thoại–Camera thường dừng trước câu nhu cầu vì toàn nhóm đã không quá tám món.
