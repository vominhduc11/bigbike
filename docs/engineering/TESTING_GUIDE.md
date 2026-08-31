# Testing Guide

## Local Commands

| App | Commands from repo config | Status | Evidence |
|---|---|---|---|
| `bigbike-web` | `npm run lint`, `npm run test`, `npm run build` | `CONFIRMED_FROM_CONFIG` | `bigbike-web/package.json` |
| `bigbike-admin` | `npm run check:i18n`, `npm run lint`, `npm run test`, `npm run build` | `CONFIRMED_FROM_CONFIG` | `bigbike-admin/package.json` |
| `bigbike-backend` | `./mvnw test`, `./mvnw package` | `CONFIRMED_FROM_CONFIG` | `bigbike-backend/pom.xml` |

## E2E test-data safety

Các kịch bản Playwright chạy trên admin thật phải coi dữ liệu E2E là dữ liệu có vòng đời,
không phải dữ liệu tạm chỉ được dọn ở bước cuối. Registry trong
`scripts/ops/e2e-data-cleanup.mjs` chỉ nhận marker module cụ thể (`E2E_PRODUCT_*`,
`E2E_BRAND_*`, `E2E_CATEGORY_*`, `E2E_CONTENT_*`, `E2E_REDIRECT_*`, `E2E_MEDIA_*`,
`E2E_VIDEO_*`, `E2E_HOME_VIDEO_*`) và các prefix/tên legacy được giữ rõ trong registry
(gồm `e2e_content_cover_*`, `test-upload.png`, `product-image-2000.jpg`). Không dùng
tìm kiếm theo chữ `test`.

Mỗi worker Playwright chạy một lần quét/dọn trực tiếp bằng ID trước khi test bắt đầu và
một lần sau khi test kết thúc. Xoá thực hiện qua API bản ghi, chuyển thẳng qua trạng thái
đã xoá rồi xoá vĩnh viễn; lỗi không bị biến thành annotation. Trước khi xoá danh mục hoặc
thương hiệu, guard kiểm tra cây danh mục và toàn bộ liên kết sản phẩm để không làm thay
đổi sản phẩm thật. Media chỉ được xoá sau các bản ghi liên quan và chỉ khi không còn
reference không xác định. Các quy tắc này khớp API/state hiện hành trong
`docs/engineering/API_CONTRACT.md`, quyền trong `docs/engineering/PERMISSION_MATRIX.md`
và quy tắc liên kết danh mục/thương hiệu/media trong `docs/business/BUSINESS_RULES.md`.

Lệnh vận hành từ thư mục gốc (mặc định chỉ liệt kê, không có request xoá):

```bash
E2E_BASE_URL=https://admin.bigbike.vn \
E2E_ADMIN_EMAIL='tai-khoan-quan-tri' \
E2E_ADMIN_PASSWORD='mat-khau-quan-tri' \
node scripts/ops/e2e-data-cleanup.mjs
```

Chỉ khi đã xem đúng danh sách mới thêm `--delete` để xoá trực tiếp theo ID:

```bash
E2E_BASE_URL=https://admin.bigbike.vn \
E2E_ADMIN_EMAIL='tai-khoan-quan-tri' \
E2E_ADMIN_PASSWORD='mat-khau-quan-tri' \
node scripts/ops/e2e-data-cleanup.mjs --delete
```

Lệnh dừng trước mọi mutation nếu thiếu quyền, thấy liên kết tới dữ liệu thật, hoặc bất kỳ
ID nào xoá thất bại; sau đó quét lại và trả mã lỗi nếu còn sót. Tài khoản xoá media vĩnh
viễn cần quyền `*` theo API contract. Kịch bản editor có thể kiểm tra timeout có chủ đích
bằng `E2E_FORCE_EDITOR_TIMEOUT=1`; worker guard vẫn dọn được sản phẩm đã tạo ngoài timeout
của test.

## Internal email configuration regression

The backend must resolve one shared internal recipient for new-order
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
| admin | `npm ci`, `npm run lint`, `npm run build`, Docker build; lint/build include the bilingual source-call guard | `CONFIRMED_FROM_CONFIG` | `.github/workflows/ci.yml`, `bigbike-admin/package.json` |

## Confirmed Backend Feature Tests

| Feature | Confirmed test suite | Status |
|---|---|---|
| Cart | `Phase1ECartApiTest.java` | `CONFIRMED_FROM_TEST` |
| Checkout | `Phase1FCheckoutApiTest.java` | `CONFIRMED_FROM_TEST` |
| Settings/menus | `Phase1JAdminSettingsMenuCouponApiTest.java` | `CONFIRMED_FROM_TEST` |
| ~~POS~~ | Removed 2026-06-23 (online-only) — `Phase1MPosApiTest.java` deleted | `REMOVED` |
| Media hardening | `AdminMediaP0Test.java` | `CONFIRMED_FROM_TEST` |
| Redirect target integrity | `AdminRedirectApiTest.java` + web proxy redirect tests | `REQUIRED_FOR_REDIRECT_RULE_011_012` |
| Trợ lý BigBike | Tư vấn core, một model cố định với same-model retry, quota, direct contact, memory 30 ngày, cart và ảnh riêng tư VI/EN. Không chạy bulk Gemini thật. | `REQUIRED_FOR_CHAT_RULE_001_020_040_059` |

## Trợ lý BigBike — ma trận kiểm thử (owner decision 2026-08-29)

- Backend: tư vấn sản phẩm/so sánh/size/giá/tồn/policy/đơn dùng nguồn thật; safety chặn bịa giá, giảm/quà/giao hàng, khan hiếm và lộ PII.
- Backend: Gemini 3.7 Flash là model duy nhất; timeout/`429`/`5xx`/network/empty-invalid payload chỉ retry chính model trong 65 giây/tối đa 4 provider calls; final failure mở các kênh liên hệ trực tiếp, không tự handoff và không thử model khác.
- Backend: one logical turn giữ đúng một quota slot, retry không tạo slot mới; quota 400/ngày và trần 40 lượt mặc định còn chính xác; clarification/fast-path không gọi AI.
- Backend: không có queue/claim/staff message/return-to-AI/close/outside-hours handoff; direct contact không ghi dữ liệu; `chat.read` trả đúng 403 khi thiếu quyền và `chat.reply` không còn được cấp.
- Backend: setting registry chỉ còn các key được giữ; review moderation không bị ảnh hưởng; migration V1070 assert dữ liệu handoff đã được dọn trước khi bỏ cấu trúc.
- Web/admin: không render/call/mocking cho model chooser/evaluation/cost/fallback, lead/form liên hệ, feedback, proactive, attribution, unanswered/data gaps, template/abbreviation editor; đầy đủ VI/EN và không mojibake.
- Web: action lỗi mở đúng panel Hotline/Zalo/Messenger mà không tạo request; không có lối gọi người thật; add cart/variant vẫn có hậu kiểm; memory v2 xoay token cũ và quyền tắt/xóa vẫn đúng.
- Image: khi AI service có cấu hình thì luôn bật, có disclosure, 1 ảnh/lượt, 3/hội thoại, 20/ngày, 8 MB, private ownership/retention; thiếu service thì nút tự ẩn; image intent tiếp tục dùng fixture, không chạy bulk provider thật.
- E2E: dùng REST/SSE/STOMP mock hoặc fixture, dữ liệu tiền tố `E2E_`; không gọi AI thật và không chạm dữ liệu khách.

Các context PostgreSQL profile `tc` chạy toàn bộ migration từ kho trống. Migration production có thể dùng snapshot hợp lệ nhưng không sửa version đã áp dụng. Nếu server local không chạy do migration đã áp dụng không có trong source, ghi `Not run` và tiếp tục unit/build/static checks.
## Current Testing Gaps

| Gap | Status | Evidence |
|---|---|---|
| Admin unit/component tests run through the dedicated `npm run test` script. | `RESOLVED_2026-08-28` | `bigbike-admin/package.json` |
| Web unit tests exist locally but are not run in CI. | `CONFIRMED_FROM_CONFIG` | `bigbike-web/package.json`, `.github/workflows/ci.yml` |
| Live redirect quality | Two sequential scans of the 241-row owner URL list, 0.5s/request/pass; the live scan is evidence, not a unit-test substitute. | `REQUIRED_FOR_AUDIT_2026-08-14` |
