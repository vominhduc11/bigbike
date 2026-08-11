# Feature audit — Trợ lý Bi theo mô hình lai (2026-08-10)

## Phạm vi

Audit và tái cấu trúc toàn bộ lượt chat storefront của Bi: fast-path, Gemini function calling, backend tool validation/execution, catalog, đơn hàng của customer đã đăng nhập, lead consent, quota/persistence, response guard, storefront fallback và admin read-only history/stats. Public request/response của `POST /api/v1/chat/messages` không đổi vì function call là chi tiết nội bộ backend.

## Căn cứ canonical

- `docs/business/BUSINESS_RULES.md` `CHAT_RULE_001`–`CHAT_RULE_018`.
- `docs/engineering/API_CONTRACT.md` §`Trợ lý ảo AI “Bi”`.
- `docs/engineering/API_FLOW_MAP.md` §`Trợ lý Bi`.
- `docs/engineering/DATA_CONTRACT.md` §`Trợ lý Bi — conversation, message và lead`.
- `docs/engineering/PERMISSION_MATRIX.md` §`Trợ lý Bi permissions`.
- `docs/engineering/INTEGRATION_GUIDE.md` §`Trợ lý Bi (Google Gemini)`.

## Flow trước thay đổi

`ChatService` gọi `ChatToolService.resolve()` trước. Backend tự phân loại câu hỏi, tự đọc catalog/đơn hàng và dựng `TOOL_RESULT`; sau đó `AiChatClient` chỉ gửi một request chứa câu hỏi + chuỗi `TOOL_RESULT` để Gemini viết lại câu trả lời. Request không có `tools`, `functionDeclarations`, `functionCall` hay `functionResponse`, nên Gemini không thực sự chọn tool.

Các đường đọc dữ liệu thật gồm catalog search/detail qua `CatalogReadService`, đơn hàng qua `OrderReadService`, settings qua `ChatAssistantSettings`, cùng chat repositories để lưu conversation/message/lead và phục vụ admin. Greeting/help, policy, shop info, handoff, off-topic, guest order, signed-in order và no-match được trả bằng template/backend, không gọi AI. Rủi ro chính là boundary function calling chưa tồn tại, order path dùng DTO rộng hơn projection cần cho chat, final model chưa có một guard thống nhất và parser final còn chấp nhận shape lỏng.

## Flow sau thay đổi

`customer question -> gate/quota -> local fast-path -> Gemini + 5 declarations cố định tự chọn tool -> ChatToolRegistry/ChatToolService validate schema, relevance, quyền và giới hạn (không preselect expected tool) -> ChatToolService execute service/repository cố định -> functionResponse -> Gemini final JSON -> ChatResponseGuard -> persist -> public response hiện tại`.

- Registry chỉ khai báo `search_products`, `get_product`, `get_policy`, `get_shop_info`, `get_my_orders`; không có `capture_lead` và không có identity/query/schema argument.
- Unknown tool, parallel call, extra/wrong-type/SQL-shaped argument, tool không đúng ngữ cảnh, sai sequence, timeout hoặc payload/final không parse được đều fail closed về `CONTACT`.
- Tối đa hai tool executions và ba provider requests; tool thứ hai duy nhất là `search_products -> get_product`. Lượt final giữ stateless history, gửi lại declarations và đặt mode `NONE` để cấm gọi tiếp.
- Product constraints được backend tái dựng từ câu hỏi và tiếp tục enforce `CHAT_RULE_015`–`CHAT_RULE_018`; model không quyết định published, sellability, effective price hay stock safety. Slug detail phải được xác minh bởi search hiện tại hoặc xuất hiện trực tiếp trong câu hỏi. Nếu backend bỏ tầm giá hoặc mở rộng tìm kiếm, một disclosure flag đi cùng kết quả đến hậu kiểm; model không nói rõ thì cả lượt fail closed về `CONTACT`.
- `get_my_orders` lấy UUID duy nhất từ `CustomerPrincipal`, dùng projection sáu field, giới hạn 1/5; guest-order dừng ở local action và không gọi `OrderReadService`.
- Lead vẫn chỉ ghi qua endpoint consent `true` sau trạng thái `OFFERED`; model không có write tool.
- Final guard bắt buộc 3–5 câu, tối đa ba card, chặn URL/thuật ngữ nội bộ/raw status/raw currency và PII. Sau shop-info, chỉ đúng số công khai từ settings được phép xuất hiện.
- Một logical response vẫn chỉ tăng `ai_call_count` một lần và lưu đúng một assistant message `ai_called=true`, kể cả có nhiều provider requests hoặc kết thúc bằng fallback. Không persist product trung gian khi final lỗi.

## Frontend và admin

Storefront chỉ gọi backend; client hạ payload thiếu/không an toàn về `CONTACT`, bỏ product/action không an toàn và chỉ ánh xạ `LOGIN|ORDER_HISTORY|ORDER_LOOKUP` sang route cục bộ. Không có Gemini key, provider call hay tool execution trong browser. Admin chat giữ ba API read-only, tất cả enforce `chat.read`; stats vẫn đếm assistant message `ai_called=true`, không đếm provider requests.

## An toàn dữ liệu

Không có SQL động. Gemini không nhận table/column/customer id/email/access token, không có repository/client DB và không thể tự thực thi tool. Order function response không chứa line item, address, payment detail hoặc PII thừa. Log orchestration chỉ ghi loại lỗi, không ghi câu hỏi, function payload, contact, token hoặc order data.

## Xác minh

- Unit/API function-calling cover valid search, search→detail, unknown/parallel/malformed/identity/SQL calls, giới hạn vòng, thiếu grounding, tool/provider exception/timeout-like failure, payload/final invalid và `CONTACT` fallback.
- Business regression cover hướng/range/ước lượng giá, category/brand có/không dấu, published/priced/sellable, option còn hàng, guest/customer order boundary, lead consent, PII log/response guard và logical quota.
- Storefront regression cover AI/product, CONTACT availability, network failure, invalid payload và fixed local actions; provider được stub, không gọi Gemini thật.
- Backend Bi/API/order/admin permission: `95/95` pass; provider được mock/stub, không dùng secret và không gọi Gemini thật.
- Storefront: `FloatingChat` unit `5/5`, Bi Playwright `4/4`, lint và production build pass.
- Admin chat: `4/4`, lint và production build pass.
- Backend package không chạy test: pass. OpenAPI JSON parse, diff whitespace, secret/provider-key scan, dynamic-SQL scan và UTF-8/mojibake scan: pass.
- Lần chạy chẩn đoán backend rộng `**/service/chat/*Test,**/api/*Test` trước bước siết disclosure cuối: 938 test, 7 failure, 1 environment error, 1 skipped. Không có failure thuộc Bi: bốn assertion content/category đã lệch behavior hiện tại, ba assertion `PublicReadApiTest` về colors/price-band/page seed tái hiện độc lập sau khi fixture Bi đã được dọn, và `AdminReportRepositoryQueryTest` không kết nối được Testcontainers Docker/Postgres. Chạy cô lập `ChatProductDiscoveryApiTest,PublicReadApiTest` xác nhận toàn bộ 20 test Bi lúc đó pass; chỉ ba assertion `PublicReadApiTest` nêu trên còn fail. Sau bước siết disclosure, toàn bộ class Bi/API/order/admin permission liên quan đã được chạy lại trong bộ `95/95` phía trên.

## Giới hạn chủ đích

Giai đoạn đầu không hỗ trợ parallel tool call, không quá hai tool, không có guest order lookup trong chat, không expose write tool và không thêm provider-call telemetry vào business quota/public API. Không đổi model/API: vẫn `gemini-2.5-flash` trên `v1beta generateContent`; final JSON được backend kiểm tra chặt thay vì kết hợp function calling với provider structured-output vốn tài liệu Google hiện chỉ xác nhận cho Gemini 3.

## Hậu kiểm production 2026-08-10 (sửa lỗi rơi về CONTACT)

Sau khi lên production, câu hỏi tìm sản phẩm rơi về `CONTACT` hàng loạt: 15/15 message `CONTACT_FALLBACK` trong 30 ngày đều là câu tìm sản phẩm, trong khi policy/shop-info vẫn trả lời bình thường. Đo trực tiếp trên `gemini-2.5-flash` bằng đúng payload backend dựng:

- **Nguyên nhân chính** — không có provider structured-output ở final request, model trả prose thay vì JSON bốn field: **0/8** reply đúng contract. Giới hạn "structured-output chỉ dùng được với Gemini 3" nêu ở mục trên là **sai**: final request đặt `functionCallingConfig.mode=NONE` nên không gọi function nào, và structured-output chạy đúng cùng function declarations — **8/8** sau khi bật.
- **Nguyên nhân phụ 1** — detail hop thường nhận nhiều `get_product` call song song hoặc prose; fail-closed cả turn khiến câu hỏi mất luôn câu trả lời dù search results đã grounded. Nay chỉ bỏ qua hop đó (log `detail step skipped`), không call chưa validate nào được chạy.
- **Nguyên nhân phụ 2** — guard `RAW_CURRENCY` và ràng buộc 3–5 câu (`CHAT_RULE_007`) loại chính câu trả lời hợp lệ vì system prompt không nêu hai ràng buộc này đủ rõ.

Sau ba thay đổi trên, đo lại bằng đúng system prompt trong code: **11/12 (92%)** qua toàn bộ guard. Phần còn lại là model viết 2 câu — vẫn fail-safe về `CONTACT` đúng `CHAT_RULE_011`, chưa nới `CHAT_RULE_007` vì đó là quyết định của owner.

## Sửa chất lượng phản hồi 2026-08-11

### Căn cứ và phạm vi

Hậu kiểm vận hành ngày 11-08-2026 ghi nhận 34/126 câu rơi vào `CONTACT_FALLBACK`; log quy về `WRONG_TONE`, không phải hết quota. Lần sửa này bám `CHAT_RULE_001`, `CHAT_RULE_005`–`007`, `CHAT_RULE_011`, `CHAT_RULE_015`–`019`; không đổi model, provider, public API hay danh sách năm công cụ đọc.

### Thay đổi

- Prompt và guard cùng bắt buộc Bi tự xưng “em”, gọi khách “anh/chị”, đồng thời chặn cách gọi khách là “em”. Nếu chỉ vấp `WRONG_TONE`, backend chạy tối đa một lượt sửa mới với câu hỏi hiện tại và tool data đã allow-list; không gửi draft bị loại hay lịch sử chat. Lượt sửa đã thử được tính thêm một slot quota và lưu bằng `ai_retry_count=1`.
- Tìm catalog lấy thương hiệu/danh mục từ metadata công khai, bỏ dấu khi nhận diện. Bộ lọc thực tế luôn ưu tiên brand/category nên câu hỏi LS2, mũ và tai nghe không phụ thuộc vào chữ xuất hiện trong tên phụ kiện.
- Không còn cho model suy diễn “tất cả”, “chỉ có N” hoặc “không có” trên toàn kho từ tối đa ba thẻ. Chọn phương án prompt + guard thay vì thêm tổng kho vào `functionResponse`: ít rủi ro hơn vì không mở rộng payload công cụ hay data contract, trong khi vẫn chặn được kết luận sai ở ranh giới cuối.
- Khi backend phải nới từ khoá hoặc bỏ tầm giá, thẻ phương án gần nhất được trả kèm disclosure bắt buộc. Câu có một mẫu chính xác hỏi còn hàng hoặc size/màu được trả deterministic từ dữ liệu đã xác minh để kết quả lặp lại ổn định.
- Conversation chỉ lưu JSON context không PII (loại hàng, brand, khoảng giá, tối đa ba slug công khai, cờ chờ đăng nhập). Context chỉ ràng buộc tool/backend của lượt sau; không thay thế hoặc gửi nguyên văn lịch sử vào Gemini. Các câu “So sánh các mẫu”, “Đổi ngân sách” và quick prompt “Tìm mũ bảo hiểm theo ngân sách” hỏi làm rõ ngay tại backend, không gọi AI.

### Kiểm chứng ban đầu

- Bộ 9 class hồi quy chat/API: **115/115** pass (`ChatToolServiceTest`, `ChatResponseGuardTest`, `ChatServiceFallbackTest`, `ChatAvailabilityTest`, `BiSearchDecisionTest`, `ChatToolRegistryTest`, `ChatProductDiscoveryApiTest`, `AiChatFunctionCallingTest`, `AiChatRequestShapeTest`). Provider đều là stub/mock; không có thử tay hay lượt AI thật.
- Các case cover: LS2 có/không dấu; mũ/tai nghe lọc đúng danh mục; các hướng/range giá; ba lượt Tanami Carbon nhất quán; AGV K3 size/màu; follow-up mũ; login acknowledgement của đơn hàng; clarification cho so sánh/ngân sách; retry tone và reserve quota.

### Full-suite 2026-08-11

`./mvnw test` đã chạy hết **1.510** test. Toàn bộ class Bi ở trên vẫn pass trong full-run, gồm `ChatProductDiscoveryApiTest` 26/26. Build chung dừng ở 8 failure ngoài phạm vi Bi (content/home/public fixture và `PermissionCatalogMigrationConsistencyTest` thiếu permission `EDITOR` từ migration có sẵn) cùng 4 lỗi Testcontainers không lấy được Docker image `postgres:16-alpine`. Không sửa các lỗi này trong đợt Bi để tránh gộp thay đổi content, SEO, permission và hạ tầng không liên quan. Không có lượt AI thật nào được dùng để kiểm chứng.
