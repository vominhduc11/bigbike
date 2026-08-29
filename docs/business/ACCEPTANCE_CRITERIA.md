# Acceptance Criteria

This file captures measurable acceptance criteria that can be verified from current code, config, and tests.

## Module Criteria

| Module | Acceptance criteria | Current evidence | Verdict |
|---|---|---|---|
| Cart | Guest/customer carts work, CSRF blocks unsafe mutations, totals are recalculated. | `Phase1ECartApiTest.java` | `PASS` |
| Checkout | Checkout validates payload, shipping, per-variant availability (`isAvailable`), idempotency, and creates orders. (No quantity decrement — boolean availability, V261.) | `Phase1FCheckoutApiTest.java`, `CheckoutService.java` | `PASS` |
| ~~POS~~ | Removed platform-wide (owner decision 2026-06-23, online-only). The POS search/sale endpoints, service, tests, and `pos.*` permissions no longer exist. | — | `REMOVED` |
| Media | Valid JPEG/PNG/WebP image and MP4 video uploads work; fake MIME, renamed GIF/SVG, empty files, and unsupported types fail at both UI and server; drag-and-drop follows the same image allowlist; delete/restore flows exist. | `AdminMediaP0Test.java`, `MediaLibraryScreen.test.jsx`, `MediaPickerModal.test.jsx` | `REQUIRED_FOR_2026-08-28` |
| Brand logo standardization | New/replaced brand logos accept JPEG/JPG, PNG and WebP, use the admin 1:1 crop flow when needed, are at least 400×400 with a 1:1 ratio within 1% tolerance, and are rechecked from stored bytes without a logo-specific byte ceiling. Transparency is a non-blocking quality warning. Existing logos remain usable with non-blocking quality warnings, and missing public logos render initials instead of the BigBike logo. | `MEDIA_RULE_011`/`MEDIA_RULE_012`, `DATA_CONTRACT.md` “Brand logo quality and storage marker”, Brand admin/backend tests | `REQUIRED_FOR_2026-08-29` |
| Vietnam address | Địa chỉ mới dùng đúng hai cấp tỉnh/thành → phường/xã; web chọn từ dữ liệu tích hợp sẵn. API đọc công khai chỉ còn provinces và wards-by-province, không có district tier. | `VnAddressController.java`, `VnAddressFields.tsx`, `vn-address-data.ts` | `PASS` |
| WebSocket admin feed | Admin clients can connect with JWT and subscribe to admin order topic. | `WebSocketConfig.java`, `adminWebSocket.js` | `PASS` |
| Stock receipt workflow | Receipt-based receiving was dropped in V120 — feature never built. (Inventory is now a boolean availability toggle — no receiving flow, V261.) | `V120__drop_stock_receipt_tables.sql` | `REMOVED` |
| Trợ lý BigBike — tư vấn và trần lượt | Trần mặc định 40 lượt tư vấn có nội dung, owner chỉnh 10–100; làm rõ/retry hợp lệ miễn trần và đạt trần vẫn có handoff hoặc hội thoại nối tiếp. Trần AI hằng ngày là 400 và chỉ logical response vào AI giữ một slot. | `CHAT_RULE_006`, `009`, `010`; chat service/quota tests | `REQUIRED_FOR_2026-08-29` |
| Trợ lý BigBike — một model | Trợ lý dùng duy nhất Gemini 3.7 Flash do cấu hình máy chủ khóa. Lỗi/quá tải chỉ thử lại chính model trong deadline 65 giây/tối đa bốn lần gọi; vẫn lỗi trả lời xin lỗi kèm Gặp nhân viên, không đổi model. Kiểm duyệt đánh giá sản phẩm không đổi. | `CHAT_RULE_019`; retry/isolation tests | `REQUIRED_FOR_2026-08-29` |
| Trợ lý BigBike — gặp nhân viên | Bấm/nói gặp nhân viên tạo hàng chờ, không đóng chat. Nhân viên có `chat.reply` tiếp nhận nguyên tử, nhắn trong widget; AI lùi khi `ACTIVE`, rồi nhân viên bàn giao hoặc đóng. Ngoài giờ hiện lịch/lần mở cửa kế tiếp, không xin liên hệ. | `CHAT_RULE_040`, `045`–`047`; handoff/admin/web tests | `REQUIRED_FOR_2026-08-29` |
| Trợ lý BigBike — tư vấn an toàn | Hàng, size, giá, tồn, policy và đơn được xác minh từ nguồn thật; không bịa, hứa giảm giá/quà/ngày giao, hoặc lộ dữ liệu đơn. Cách nói tự nhiên và bộ viết tắt phổ thông đóng trong code vẫn hỗ trợ tìm hàng. | `CHAT_RULE_001`–`020`, `034`–`039`; VI/EN guard tests | `REQUIRED_FOR_2026-08-29` |
| Trợ lý BigBike — giỏ, nhớ và ảnh | Thẻ chat chỉ thêm biến thể còn hàng sau hậu kiểm; cùng thiết bị được nhớ 30 ngày và khách có quyền tắt/xóa. Ảnh mặc định tắt; khi bật, giới hạn 1/lượt, 3/hội thoại, 20/ngày, 8 MB và riêng tư 90 ngày. | `CHAT_RULE_014`, `049`, `052`, `057`–`059`; cart/memory/image tests | `REQUIRED_FOR_2026-08-29` |

## Trợ lý BigBike — nghiệm thu sau rút gọn (owner 2026-08-29)

Mọi ca có chữ khách nhìn thấy phải có tiếng Việt có dấu đầy đủ và tiếng Anh. Unit/integration dùng provider/MinIO fixture; không chạy hàng loạt Gemini thật hoặc dùng dữ liệu khách.

| # | Ca nghiệm thu | Bằng chứng tự động | Verdict |
|---:|---|---|---|
| 1 | Câu trả lời tư vấn dùng dữ kiện catalog/policy thật, vẫn giữ size/giá/tồn/so sánh/safety. | Chat service/tool/guard tests VI/EN | `REQUIRED` |
| 2 | Gemini 3.7 Flash lỗi timeout/429/5xx/network/payload không hợp lệ được thử lại cùng model trong budget; thất bại cuối có action Gặp nhân viên. | `AiChatClient`/`ChatService` retry tests | `REQUIRED` |
| 3 | Một retry không tạo thêm daily AI slot; bộ đếm hôm nay trên trần 400 còn chính xác. | quota service/API/admin tests | `REQUIRED` |
| 4 | Handoff hàng chờ, nhận nguyên tử, nhắn, trả AI, kết thúc, lịch giờ trực và email giữ nguyên hai quyền `chat.read/chat.reply`. | `ChatHandoffServiceTest`, permission/admin/web tests | `REQUIRED` |
| 5 | Cài đặt chỉ còn các field owner giữ; không có model chooser, giá, eval, cost warning, proactive, template/abbreviation editor. | settings registry/API/admin tests | `REQUIRED` |
| 6 | Không còn API, bảng dữ liệu, giao diện hoặc bản dịch cho lead, feedback, attribution, proactive, reports đã gỡ. | migration/reference scan/admin/web tests | `REQUIRED` |
| 7 | Ảnh, nhớ 30 ngày và thêm giỏ trong chat tiếp tục hoạt động theo rule hiện hành. | image/memory/cart tests | `REQUIRED` |
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
| Notification center (admin read/unread) | Persistent `admin_notifications` table (V102); scoped recent list with exact server unread count and mark-all-read per admin. Rows older than six months are automatically removed without changing per-admin read markers. | `CONFIRMED_FROM_CODE` |
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
