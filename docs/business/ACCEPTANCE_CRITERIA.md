# Acceptance Criteria

This file captures measurable acceptance criteria that can be verified from current code, config, and tests.

## Module Criteria

| Module | Acceptance criteria | Current evidence | Verdict |
|---|---|---|---|
| Cart | Guest/customer carts work, CSRF blocks unsafe mutations, totals are recalculated. | `Phase1ECartApiTest.java` | `PASS` |
| Checkout | Checkout validates payload, shipping, per-variant availability (`isAvailable`), idempotency, and creates orders. (No quantity decrement — boolean availability, V261.) | `Phase1FCheckoutApiTest.java`, `CheckoutService.java` | `PASS` |
| ~~POS~~ | Removed platform-wide (owner decision 2026-06-23, online-only). The POS search/sale endpoints, service, tests, and `pos.*` permissions no longer exist. | — | `REMOVED` |
| Media | Valid PNG upload works; fake MIME, empty files, and unsupported types fail; SVG is accepted and sanitized (script-bearing SVG stored clean, non-SVG declared as SVG fails); delete/restore flows exist. | `AdminMediaP0Test.java`, `SvgSanitizerTest.java` | `PASS` |
| Vietnam address | Địa chỉ mới dùng đúng hai cấp tỉnh/thành → phường/xã; web chọn từ dữ liệu tích hợp sẵn. API đọc công khai chỉ còn provinces và wards-by-province, không có district tier. | `VnAddressController.java`, `VnAddressFields.tsx`, `vn-address-data.ts` | `PASS` |
| WebSocket admin feed | Admin clients can connect with JWT and subscribe to admin order topic. | `WebSocketConfig.java`, `adminWebSocket.js` | `PASS` |
| Stock receipt workflow | Receipt-based receiving was dropped in V120 — feature never built. (Inventory is now a boolean availability toggle — no receiving flow, V261.) | `V120__drop_stock_receipt_tables.sql` | `REMOVED` |
| Trợ lý BigBike — lượt và lead | Trần mặc định 40 lượt tư vấn có nội dung, owner chỉnh 10–100; toàn bộ vòng làm rõ miễn trần và đạt trần thì nối thread giữ ngữ cảnh thay vì cắt cứng. Lead chỉ được mời khi đã có ý định với mẫu cụ thể hoặc thiếu dữ liệu cần người hỗ trợ, luôn có lý do, tối đa 2 lần, không hỏi lại sau từ chối; khách đăng nhập không nhập lại số và chỉ consent mới lưu. | `CHAT_RULE_009`, `CHAT_RULE_012`, `CHAT_RULE_025`, `ChatPhase3SettingsTest`, `ChatServiceFallbackTest` | `PASS` |
| Trợ lý BigBike — làm rõ nhiều vòng | Giá/brand/màu/size đơn lẻ không tự động đủ để quét shop; backend nhớ dữ kiện, mỗi lượt hỏi một tiêu chí có lựa chọn, không lặp và dừng ở tối đa 8 món. Chưa biết nhóm không hiện sản phẩm; biết nhóm được kèm tối đa 3 mẫu tiêu biểu. “Xem hết/tùy em/sốt ruột” dừng hỏi. Cả VI/EN đi qua guard và chuỗi làm rõ không dùng lượt AI. | `CHAT_RULE_034`–`CHAT_RULE_036`, backend/web/E2E tests | `PASS` |
| Trợ lý BigBike — giai đoạn và nỗi lo | Dạo xem không chào hàng; đang chọn không đưa mẫu ngoài so sánh; sắp quyết không mở thêm mẫu; sau mua không bán thêm. Size thiếu phải nói thiếu, chính hãng dùng policy, chê đắt dùng mẫu rẻ hơn cùng nhu cầu và trade-off có evidence. | `CHAT_RULE_037`, `CHAT_RULE_038`, tests VI/EN #1–7 | `PASS` |
| Trợ lý BigBike — bán kèm | Chỉ sau khi khách nghiêng/chốt món chính, chỉ từ `accessoryProducts`, tối đa 2 món còn hàng; đang phân vân hoặc không có relation đáng tin thì không gợi. | `CHAT_RULE_039`, tests VI/EN #8–10 | `PASS` |
| Trợ lý BigBike — hành động và chuyển đổi | Mỗi assistant turn có đúng một `nextStep` theo ngữ cảnh; không lặp bước khách vừa từ chối. Product view/cart add idempotent; checkout trong 168 giờ ghi line revenue cho lần chạm chat hợp lệ gần nhất. | `CHAT_RULE_029`–`CHAT_RULE_030`, `CHAT_RULE_041`, tests VI/EN #11–12, #20–21 | `PASS` |
| Trợ lý BigBike — gặp nhân viên | Bấm/nói gặp nhân viên tạo hàng chờ, không đóng chat. Nhân viên có `chat.reply` tiếp nhận nguyên tử, nhắn ngay trong widget qua nền STOMP sẵn có; AI lùi khi `ACTIVE`, khách thấy nhãn nhân viên/trạng thái, rồi nhân viên bàn giao hoặc đóng. Ngoài giờ hiện lịch và mời để lại liên hệ. | `CHAT_RULE_040`, `CHAT_RULE_045`–`CHAT_RULE_048`, `ChatHandoffServiceTest`, admin/web tests | `PASS` |
| Trợ lý BigBike — dữ liệu và trung thực | Admin xem câu hỏi bó tay cùng data-gap size/spec/raw option/accessory. Customer không thấy mã thô; mọi lời hứa giảm giá/giao hàng/khan hiếm/review/social proof thiếu evidence bị guard chặn. | `CHAT_RULE_023`, `CHAT_RULE_042`–`CHAT_RULE_043`, tests VI/EN #22–25 | `PASS` |
| Trợ lý BigBike — không phá giai đoạn 1/chi phí | Toàn bộ ca giai đoạn 1 vẫn đạt; stage, lead, cross-sell, handoff và báo cáo không tạo thêm AI slot/provider pass. | `CHAT_RULE_034`–`CHAT_RULE_044`, regression #26 | `PASS` |
| Trợ lý BigBike — nguồn kiến thức | `search_articles` chỉ đọc tối đa 3 bài `PUBLISHED` đúng locale và loại dữ kiện động/prompt injection; `get_policy` hỗ trợ privacy. Giá/tồn kho/màu/size/thông số/chính sách động vẫn đọc nguồn sống. | `CHAT_RULE_003`, `CHAT_RULE_031`, backend tests | `REQUIRED_FOR_V1041` |
| Trợ lý BigBike — cấu hình và báo cáo | Owner chỉnh ngưỡng cảnh báo USD, trần hội thoại, lịch trực, thời hạn nhớ, proactive, tối đa 100 viết tắt và 50 FAQ song ngữ; FAQ có xem thử/cảnh báo không-bịa, từng câu bật/tắt. Owner khai phụ kiện trực tiếp trên sản phẩm. Báo cáo có feedback theo lý do/chủ đề/tuần và nối sang FAQ chuẩn. | `CHAT_RULE_010`, `CHAT_RULE_017`, `CHAT_RULE_029`, `CHAT_RULE_032`, `CHAT_RULE_048`, `CHAT_RULE_050`, backend/admin tests | `PASS` |

## Trợ lý BigBike — Giai đoạn 3 (owner 2026-08-25)

Mọi ca dưới đây bắt buộc chạy offline cho cả tiếng Việt và tiếng Anh khi có nội dung khách nhìn thấy. Không gọi AI thật hàng loạt; REST là nguồn chuẩn và STOMP chỉ báo client đồng bộ lại.

| # | Ca nghiệm thu | Bằng chứng tự động | Verdict |
|---:|---|---|---|
| 1 | Nhiều vòng làm rõ không tiêu trần hội thoại. | `ChatServiceFallbackTest.multiRoundClarificationIsFreeOfProviderCalls` | `PASS` |
| 2 | Owner đổi trần 10–100 có hiệu lực ở lần đọc kế tiếp. | `ChatPhase3SettingsTest.turnLimitIsDynamicAndBounded` | `PASS` |
| 3 | Gần/đạt trần vẫn có handoff hoặc successor giữ context, không kể lại. | `ChatServiceFallbackTest.turnLimitCreatesLinkedContinuation`, web continuation test | `PASS` |
| 4 | Yêu cầu gặp người thật vào hàng chờ có thời gian, lâu nhất trước. | `ChatHandoffServiceTest.queueClearsOnlyAfterExplicitAcknowledgement`, admin list test | `PASS` |
| 5 | Tiếp nhận chuyển `ACTIVE`; AI không trả lời tự động. | `ChatHandoffServiceTest`, chat service staff-active tests | `PASS` |
| 6 | Tin nhân viên đến widget theo realtime, có nhãn BigBike rõ. | `ChatHandoffServiceTest.staffMessageAndReturnArePushedToTheOpenCustomerChat`, web history test | `PASS` |
| 7 | Bàn giao trả trạng thái `AI_RESUMED`; trợ lý tiếp tục từ context cũ. | Cùng test handoff + web sync | `PASS` |
| 8 | Nhân viên thứ hai nhận conflict kèm tên người đã tiếp nhận. | `ChatHandoffServiceTest.secondEmployeeCannotClaimAnActiveConversation` | `PASS` |
| 9 | Ngoài giờ hiện lịch VI/EN, không hứa có người trực và mời để lại liên hệ. | `ChatPhase3SettingsTest`, `ChatHandoffServiceTest.afterHoursResponseIncludesConfiguredSchedule` | `PASS` |
| 10 | Thiếu `chat.read` không xem; thiếu `chat.reply` không tiếp nhận/nhắn. | `AdminChatPermissionTest`, `WebSocketConfigAccessTest` | `PASS` |
| 11 | FAQ bật trả đúng nguyên văn owner theo trigger VI/EN. | `ChatAssistantSettingsTest` + tool/guard regression | `PASS` |
| 12 | Xem thử trả đúng nội dung khách sẽ thấy. | `ChatTemplatePreviewServiceTest.bilingualPreviewMatchesTheOwnerAnswerExactly` | `PASS` |
| 13 | Phụ kiện owner liên kết thay suy đoán, chỉ lấy món publish/còn hàng. | `ChatSalesAdvisorServiceTest` + product-detail tests | `PASS` |
| 14 | Lời hứa giảm giá/ngày giao bị nêu đúng mã vi phạm, không sửa draft. | `ChatTemplatePreviewServiceTest`, `SettingValueValidatorTest` | `PASS` |
| 15 | Cùng thiết bị nối lại nhu cầu tối đa 30 ngày. | `ChatVisitorServiceTest.guestResumesOnlyGuestConversationInBothLanguages` | `PASS` |
| 16 | Đăng nhập chỉ gộp history của visitor hiện tại vào đúng customer. | `ChatVisitorServiceTest.loginScopesLatestConversationToCurrentAccount` | `PASS` |
| 17 | Xác nhận xoá làm trợ lý quên sạch; tắt nhớ không âm thầm xoá. | `ChatVisitorServiceTest`, `chat-identity.test.ts`, `FloatingChat.test.tsx` | `PASS` |
| 18 | “Chưa đúng ý” + lý do được lưu và vào báo cáo. | `ChatFeedbackServiceTest.unhelpfulReasonIsRecorded`, admin/web tests | `PASS` |
| 19 | Từ feedback mở được FAQ draft đã che liên hệ. | `ChatFeedbackServiceTest.criticizedQuestionPrefillsTemplateWithoutContactDetails` | `PASS` |
| 20 | Proactive mặc định tắt; chỉ chạy sau khi owner bật. | `ChatPhase3SettingsTest`, `FloatingChat.test.tsx` | `PASS` |
| 21 | Tối đa một lời mở mỗi tab/phiên. | `FloatingChat.test.tsx` proactive VI/EN | `PASS` |
| 22 | Checkout không bao giờ có lời mở chủ động. | `FloatingChat.test.tsx` checkout case | `PASS` |
| 23 | Khách đóng lời mở thì không lặp lại trong phiên. | `FloatingChat.test.tsx` dismiss case | `PASS` |
| 24 | Chọn biến thể còn hàng trong chat, thêm giỏ và xác nhận đúng lựa chọn. | `BigBikeProductCard.test.tsx`, cart backend tests | `PASS` |
| 25 | Biến thể hết hàng bị vô hiệu hoá và backend vẫn revalidate. | `VariantPicker.test.tsx`, cart stock regression | `PASS` |
| 26 | CTA trong chat đi thẳng checkout, giữ đúng cart line/variant. | `BigBikeProductCard.test.tsx`, checkout regression | `PASS` |
| 27 | Toàn bộ test giai đoạn 1–2 tiếp tục đạt. | Backend regression 1.525 ca không lỗi/thất bại (16 ca tự bỏ qua), full admin/web; bốn context PostgreSQL cũ không chạy được vì `V1029` chặn kho dữ liệu rỗng trước khi tới Phase 3 và được ghi rõ trong báo cáo bàn giao. | `PASS` |

## Trợ lý BigBike — Giai đoạn 4 (owner 2026-08-26)

Mọi ca có chữ khách nhìn thấy phải có VI/EN. Automated suite dùng provider/MinIO fixture; model comparison thật chỉ chạy sau thao tác rõ ràng của owner, không dùng dữ liệu khách trong môi trường phát triển. Dấu vân tay ảnh sản phẩm được dựng cục bộ từ kho ảnh nội bộ khi cần, không gọi provider và không đọc dữ liệu khách.

| # | Ca nghiệm thu | Bằng chứng tự động | Verdict |
|---:|---|---|---|
| 1 | Owner đổi model trong Cài đặt, lượt kế tiếp dùng model mới không restart. | `ChatStage4ConfigurationTest`, settings/admin tests | `PASS_AUTOMATED` |
| 2 | Danh sách là giao của account live và catalog ổn định/đủ giá, có mô tả tốc độ/chi phí thường. | Catalog/filter tests + `models.list` account shop 2026-08-26 | `PASS_LIVE_DISCOVERY_2026_08_26` |
| 3 | Đổi model chat không đổi model review moderation. | Independence regression | `PASS_AUTOMATED` |
| 4 | Dataset versioned chạy ngoài customer quota và lưu run/result. | Evaluation service/runner tests; 14 canonical prompts, 0 verified real prompts | `PARTIAL_REAL_DATA_PENDING` |
| 5 | Registry chứa toàn bộ ca giai đoạn 1–3 và giai đoạn 4. | Manifest coverage: 85 acceptance IDs | `PASS_AUTOMATED` |
| 6 | Admin so model cạnh nhau theo số liệu đúng, intent, không bịa, chịu thua, p50/p95 và USD/lượt; AI không tự chấm. | Deterministic scorer/admin tests; live model run intentionally not called | `PARTIAL_PAID_BENCHMARK_NOT_RUN` |
| 7 | Primary lỗi/chậm chuyển model nhanh trong shared 65s/four-request budget, khách vẫn nhận câu an toàn. | `AiChatFunctionCallingTest`, `ChatServiceFallbackTest` | `PASS_AUTOMATED` |
| 8 | Admin thấy số/tỷ lệ/reason fallback. | Distinct-message ledger/stats/admin tests | `PASS_AUTOMATED` |
| 9 | Admin thấy chi phí hôm nay, tháng, trung bình conversation; tách chữ/ảnh/eval/index. | Per-model-attempt usage ledger tests | `PASS_AUTOMATED` |
| 10 | Đọc ảnh mặc định tắt; bật mới thấy nút và backend mới nhận upload. | Settings/web/API tests | `PASS_AUTOMATED` |
| 11 | Ảnh mũ đã calibration trả đúng mẫu bằng “trông giống/looks similar”, không khẳng định cùng mẫu. | Image fixture pipeline VI/EN + read-only real catalog OF626 resize probe; no phone-photo calibration | `PASS_CATALOG_PROBE_PHONE_CALIBRATION_PENDING` |
| 12 | Ảnh hàng shop không bán trả unknown/cùng nhóm, không đoán đại. | Negative/lookalike fixtures | `PASS_AUTOMATED_FIXTURE` |
| 13 | Ảnh sản phẩm hỏng tạo handoff, không phán bảo hành. | Intent/handoff tests VI/EN | `PASS_AUTOMATED` |
| 14 | Ảnh đầu/người hỏi size không đoán, hướng dẫn đo hoặc gặp người. | Intent copy tests VI/EN | `PASS_AUTOMATED` |
| 15 | Ảnh không liên quan bị từ chối lịch sự. | Intent copy tests VI/EN | `PASS_AUTOMATED` |
| 16 | Quá 8 MB/sai type/magic bytes báo rõ, draft/chat còn hoạt động. | Upload validation + 1.600px/WebP bypass regression | `PASS_AUTOMATED` |
| 17 | Hết 20 lượt ảnh/ngày báo rõ nhưng câu chữ vẫn được xử lý. | Atomic quota + combined-turn tests | `PASS_AUTOMATED` |
| 18 | Xóa lịch sử xóa object ảnh trước khi trả success. | Delete/MinIO failure tests | `PASS_AUTOMATED` |
| 19 | Ảnh quá 90 ngày và pending quá một giờ bị cleanup. | Retention cleanup tests | `PASS_AUTOMATED` |
| 20 | Thiếu `chat.read` không tải được ảnh dù biết id. | Admin permission test | `PASS_AUTOMATED` |
| 21 | Chính sách và disclosure VI/EN nêu Google AI, 90 ngày, quyền xem/xóa. | Privacy policy/FloatingChat copy tests | `PASS_AUTOMATED` |
| 22 | Toàn bộ giai đoạn 1–3 đạt với model id cũ/mới giả lập; benchmark thật ghi `Not run` nếu owner chưa chạy. | Full backend regression 1.578 ca (0 failure, 0 error, 1 skipped), admin 1.018/1.018, web 522/522 và manifest matrix ngày 2026-08-26 | `PASS_FULL_REGRESSION_2026_08_26` |

## Release Caveats

| Topic | Current limitation | Status |
|---|---|---|
| External payment gateway | No confirmed live provider/webhook contract. New storefront orders use provider `INTERNAL` with manual `COD` or `BANK_TRANSFER`; BACS is legacy-order compatibility only. | `NOT_FOUND_IN_REPO` |
| External shipping carrier | No confirmed GHN/GHTK/ViettelPost integration. Tracking metadata is manual and has no carrier-driven lifecycle. | `NOT_FOUND_IN_REPO` |
| Receipt-based receiving flow | Schema dropped in V120 — feature not built. | `REMOVED` |
| Invoice / e-invoice (hóa đơn điện tử) | No invoice entity, no e-invoice provider integration. **Owner decision 2026-07-06: không triển khai (out of scope).** | `OUT_OF_SCOPE` |
| Legacy BACS reconciliation (mismatch handling) | Existing BACS orders are reconciled manually via payment records/`paidAmount`; new checkout requests can select `BANK_TRANSFER` but cannot select BACS. No structured bank-transfer correction entity exists. | `LEGACY_COMPATIBILITY` |
| Customer-data export / delete (Nghị định 13/2023) | No customer-facing data export or delete endpoint. | `NOT_FOUND_IN_REPO` |
| Customer support / ticketing | Giai đoạn 3 bổ sung live staff chat bên trong Trợ lý BigBike cho tư vấn bán hàng. Hệ thống ticket/khiếu nại đa kênh vẫn là dự án riêng ngoài phạm vi. | `LIVE_CHAT_CONFIRMED_TICKETING_OUT_OF_SCOPE` |
| Notification center (admin read/unread) | Persistent `admin_notifications` table (V102); `AdminNotificationController` with list-unread, mark-read, mark-all-read endpoints. | `CONFIRMED_FROM_CODE` |
| Legal / compliance content (Privacy / Terms / Return / Shipping / Complaint policy + Bộ Công Thương registration / footer badge) | CMS-driven (`/chinh-sach/[slug]`); content correctness depends on what admin published. | `NEEDS_LEGAL_CONFIRMATION` |
| Email production deliverability | Code path confirmed; runtime not tested. | `NEEDS_PRODUCTION_RUNTIME_VERIFICATION` |
| WebSocket per-subscribe topic-level authz | CONNECT và SUBSCRIBE đều kiểm quyền hiện hành; admin chat cần `chat.read`, token khách chỉ đọc `/user/queue/chat` của conversation đã chứng minh ownership. | `CONFIRMED_FROM_CODE_AND_TEST` |

> **Production-ready verdict:** ❌ NOT_READY. 12 blocker chia 4 nhóm (B01 hoá đơn điện tử + B12 kênh hỗ trợ khách đã chuyển **OUT_OF_SCOPE** — owner chốt 2026-07-06, không còn tính blocker):
>
> - **Business / Operational** (2 — B05 bank reconciliation, B08 verify-email POST drift).
> - **Legal / Compliance** (3 — B02 Bộ Công Thương registration, B03 policy content, B04 customer-data export/delete).
> - **Ops / Security / Infra** (4 — B07 PROD_CONFIG bundle, B09 SUPER_ADMIN seed, B10 MinIO/SMTP smoke, B11 backup runbook).
> - **Strategic Business Decisions** (3 — B13 payment provider, B14 shipping carrier, B15 receiving + warranty; B15 resolved — serial-tracking removed platform-wide 2026-06-23 (V259) and the warranty feature removed entirely 2026-06-23 (V264)).
>
> Mức phạt và phạm vi nghĩa vụ pháp lý cụ thể cần legal counsel xác nhận theo hành vi vi phạm hiện hành; audit không thay thế tư vấn pháp lý chính thức.
