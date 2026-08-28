# Testing Guide

## Local Commands

| App | Commands from repo config | Status | Evidence |
|---|---|---|---|
| `bigbike-web` | `npm run lint`, `npm run test`, `npm run build` | `CONFIRMED_FROM_CONFIG` | `bigbike-web/package.json` |
| `bigbike-admin` | `npm run lint`, `npm run build` | `CONFIRMED_FROM_CONFIG` | `bigbike-admin/package.json` |
| `bigbike-backend` | `./mvnw test`, `./mvnw package` | `CONFIRMED_FROM_CONFIG` | `bigbike-backend/pom.xml` |

## Internal email configuration regression

The backend must resolve one shared internal recipient for new-order and staff-handoff
notifications. Tests cover the valid configured value, rejection of a missing value at
startup, rejection of a malformed value, and the distinction between "accepted by the
SMTP provider" and final mailbox delivery in the email-dispatch log. The customer sender
address and email templates are outside this regression.

Status: `REQUIRED_FOR_NOTIFICATION_DELIVERY_CONFIGURATION`

## Variant attribute link regression

The product editor must be tested with every attribute type, not only colour:

- A legacy product with complete dictionary links saves without edits; changing
  only a variant price or availability must not produce an option error.
- A new attribute with no values can receive its first value inside the product
  editor, and the selected value is sent with its `attributeValueId`.
- A missing value is reported on the exact variant option with a bilingual
  instruction to choose from the list; unrelated variants are not marked.
- The V1053 migration is tested for alias mapping, exact public-label
  preservation, no writes to already-linked rows, safe rollback and a second
  idempotent run.

Status: `REQUIRED_FOR_PRODUCT_RULE_008_AND_ATTRIBUTE_RULE_001`

## CI Truth

GitHub Actions currently runs:

| Job | What CI actually does | Status | Evidence |
|---|---|---|---|
| backend | `./mvnw -B clean verify` and Docker build | `CONFIRMED_FROM_CONFIG` | `.github/workflows/ci.yml` |
| web | `npm ci`, `npm run lint`, `npm run build`, Docker build | `CONFIRMED_FROM_CONFIG` | `.github/workflows/ci.yml` |
| admin | `npm ci`, `npm run lint`, `npm run build`, Docker build | `CONFIRMED_FROM_CONFIG` | `.github/workflows/ci.yml` |

## Confirmed Backend Feature Tests

| Feature | Confirmed test suite | Status |
|---|---|---|
| Cart | `Phase1ECartApiTest.java` | `CONFIRMED_FROM_TEST` |
| Checkout | `Phase1FCheckoutApiTest.java` | `CONFIRMED_FROM_TEST` |
| Settings/menus | `Phase1JAdminSettingsMenuCouponApiTest.java` | `CONFIRMED_FROM_TEST` |
| ~~POS~~ | Removed 2026-06-23 (online-only) — `Phase1MPosApiTest.java` deleted | `REMOVED` |
| Media hardening | `AdminMediaP0Test.java` | `CONFIRMED_FROM_TEST` |
| Redirect target integrity | `AdminRedirectApiTest.java` + web proxy redirect tests | `REQUIRED_FOR_REDIRECT_RULE_011_012` |
| Trợ lý BigBike | Giai đoạn 1 đầy đủ cộng ma trận sales stage/objection/cross-sell/next-step, lead reason, handoff queue/email, attribution 168 giờ, funnel/unanswered/data-gap và anti-fabrication cho VI/EN | `REQUIRED_FOR_CHAT_RULE_009_012_029_032_034_044` |

## Trợ lý BigBike — ma trận kiểm thử

- Backend: lời mời 1/2, viewed/ignored/declined/accepted, request đồng thời và idempotency; trigger size/tồn kho đúng một mẫu hoặc add cart; không trigger câu chung/nhiều mẫu.
- Backend: mọi trang dùng trần mặc định 40 lượt có nội dung và setting 10–100; clarification/retry không tính, gần trần có handoff/continuation và đạt trần tự nối thread không khóa; slug PDP giả bị bỏ; action → response/card → cart → checkout; interaction giả mạo bị bỏ.
- Backend: `resultKind`/quality, funnel, action stats, monthly USD; article chỉ `PUBLISHED`, đúng locale, tối đa 3 và lọc dữ kiện động/prompt injection; alias/template validate trùng, va chạm, locale và safety.
- Web/admin: lead tự hiện/sequence 2/consent/decline/snapshot cũ; pageContext đúng route; action retry idempotent và nguồn cart; editor/cảnh báo/stats đủ loading, empty, error, saving, success, read-only.
- Backend làm rõ VI/EN: giá-only hỏi nhóm/no-card; fullface + giá rõ trả ngay; policy trực tiếp; tư vấn chung có option; size hỏi số đo; ba lượt price → group → need thu hẹp, không lặp và category được kế thừa; <=8, xem hết, tùy em và sốt ruột dừng đúng lúc.
- Backend ranking/guard: chỉ `COMPLETED` + linked product, ngưỡng 9/10 và >=2 sản phẩm, bỏ out-of-stock, featured rồi median, không review; mọi copy/options đi qua guard, `ai_called=false`, provider/quota bằng 0.
- Web/E2E offline: lựa chọn nhanh được validate/lưu/replay/click, nút cũ disabled, clarification không thành no-results, unknown group không card và known group tối đa 3 card; chạy VI/EN ở 1440/768/375, không gọi AI thật hoặc chạm dữ liệu khách.
- Bộ 36 câu dùng AI thật ghi `Not run` khi local thiếu khoá; không dùng lượt trả phí để thay bằng dữ liệu giả.
- Phase 2 VI/EN #1–7: bốn stage có thể tiến/lùi, comparison không mẫu thứ ba, size thiếu không đoán, cheaper alternative có verified trade-off, warranty từ policy.
- Phase 2 VI/EN #8–16: accessory relation only/max 2/stock filter; đúng một next step và PAUSE suppression; lead đúng reason/max 2/no greeting-no anger/no repeat/account confirmation.
- Phase 2 VI/EN #17–25: handoff persist trước WS/email, email failure vẫn queue, input mở khi `WAITING`; Phase 3 dùng `chat.read`/`chat.reply`, claim nguyên tử và audit người nhận; product view/cart/order 168h + latest touch; cohort funnel, unanswered, raw option sanitizer và anti-fabrication.
- Phase 2 #26: chạy nguyên bộ regression phase 1; assert classification, cross-sell, lead, handoff và report không reserve quota/call provider.
- Phase 3 A #1–3 VI/EN: clarification/retry không tăng counted turn; setting 10–100 có hiệu lực ngay; còn ba lượt trả handoff/continuation và successor giữ context, không hard stop.
- Phase 3 B #4–10 VI/EN: queue/wait seconds/oldest first; claim chặn AI; staff message realtime có nhãn; return-to-AI; concurrent claim 409; outside-hours next-open/contact; thiếu `chat.read` hoặc `chat.reply` trả 403.
- Phase 3 C #11–14 VI/EN: template draft CRUD/toggle/exact preview/matcher; active answer exact; accessory relation wins; unsafe discount/delivery draft giữ nguyên nhưng activation blocked với violation code; abbreviation parity.
- Phase 3 D #15–17 VI/EN: same visitor resume 30 ngày; current-device merge đúng customer; delete own history hard-delete, logout isolation; không fingerprint/IP.
- Phase 3 E #18–19 VI/EN: feedback reason validation/idempotency/weekly aggregation; feedback prefill không PII và đòi settings.write.
- Phase 3 F #20–23 VI/EN: default off; once per session; checkout never; dismissed/disabled stays suppressed; fake timers, không AI/provider/network thật.
- Phase 3 G #24–26 VI/EN: chỉ variant live còn hàng selectable; backend revalidate add cart, confirmation đúng; checkout link giữ đúng cart/price, không tự promotion.
- Phase 3 #27: chạy nguyên bộ Phase 1 + Phase 2. Playwright mock REST/SSE/STOMP bằng route/routeWebSocket; không gọi AI thật hoặc chạm dữ liệu khách.
- Phase 4 A #1–9 VI/EN: discovery chỉ model stable thực sự dùng được + nhãn giá/tốc độ; đổi model có hiệu lực request kế tiếp và không đổi review moderation; eval hiện có **14 prompt mẫu đã kiểm chứng, 0 câu hội thoại thật và registry 85 ca Phase 1–4**. PII sanitizer chỉ tạo draft; draft không chạy/không cộng `caseCount` trước khi owner kiểm chứng ground truth. Deterministic scorer kiểm expected number/answer term/product slug/forbidden claim, versioned run/compare cân số ca giữa các model và hard cap 2 USD; chỉ có acceptance ID trong registry không được báo thành prompt đã chấm. Primary timeout/provider error fallback trong cùng 65 giây/4 request; progress vẫn hiện; stats tách text/image/index/eval và today/month/average/fallback.
- Phase 4 B #10–21 VI/EN: ảnh mặc định tắt; disclosure trước upload; 1/turn, 3/thread, 20/day, 8 MB, JPG/PNG/WebP; MIME giả/corrupt/unsafe/quota trả lỗi dễ hiểu và chat chữ còn dùng; preview/history/admin; tìm mũ chỉ nói “trông giống” với card catalog thật; no-match không đoán; hàng hỏng handoff; ảnh đầu/người không đoán size; hóa đơn không OCR để khẳng định; ngoài phạm vi từ chối; private object ownership/`chat.read`; history delete và retention 90 ngày xoá object.
- Phase 4 #22: chạy nguyên bộ Phase 1–3 với model cũ và adapter model mới. Unit/integration dùng fake provider và fixture ảnh vô hại; không gọi hàng loạt Gemini, không đọc dữ liệu khách thật. Live model discovery, paid eval và quality benchmark chỉ là runbook owner tự chạy bằng `.env.vps` sau deploy.

Các context PostgreSQL profile `tc` chạy toàn bộ migration từ kho trống. Migration production
`V1029` cố ý kiểm đúng 109 sản phẩm legacy tại thời điểm data migration, nên test profile dùng
`db/testmigration/V1028_5__seed_size_products_for_v1029.sql` để tạo đúng 109 sản phẩm giả không có
dữ liệu khách trước V1029. Không sửa checksum migration đã áp dụng và seed này không nằm trong
classpath/runtime production.

Notification retention coverage includes the 500-row batch loop unit test,
`AdminNotificationRetentionMigrationPostgresTest` for V1067 plus the PostgreSQL delete statement
and preserved per-admin marker, and `AdminNotificationPostgresQueryTest` for the full application
context. The latter also depends on every earlier production migration being valid; in the local
handoff run it was blocked by V1047's existing 109-row data-integrity guard before reaching V1067.

## Current Testing Gaps

| Gap | Status | Evidence |
|---|---|---|
| Admin repo has no dedicated `test` script in `package.json`. | `CONFIRMED_FROM_CONFIG` | `bigbike-admin/package.json` |
| Web unit tests exist locally but are not run in CI. | `CONFIRMED_FROM_CONFIG` | `bigbike-web/package.json`, `.github/workflows/ci.yml` |
| Live redirect quality | Two sequential scans of the 241-row owner URL list, 0.5s/request/pass; the live scan is evidence, not a unit-test substitute. | `REQUIRED_FOR_AUDIT_2026-08-14` |
