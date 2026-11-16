# Testing Guide

## Admin session renewal regressions

Run `npm test -- --maxWorkers=2` in `bigbike-admin` for the unit/component suite.
The focused files are `src/lib/adminApi.session.test.js`, `src/lib/auth.test.jsx`
and `src/lib/useFormAutosave.test.jsx`: independent token stores sharing one lock,
same-tab concurrent/delayed 401s, temporary refresh errors, confirmed rejection,
late response invalidation, bootstrap retry and draft flush before unmount.

Run `npx playwright test session-renewal.spec.ts --retries=0` against the managed
source production preview, with `E2E_BACKEND_ORIGIN` matching the backend's configured
Admin origin. The test uses `testAnon` and `apiLoginSession`, never the store cleanup
fixture. Two real tabs share an isolated cookie jar and call real login/refresh/me.
Only this test session is logged out. Product data is never submitted; other
non-auth writes are intercepted. Controlled 401/network/503 responses exercise
recovery; final logout really revokes the test browser's session, and the test retains
that revoked cookie to verify an actual refresh 401 rather than only a missing cookie.
Traces, video and
screenshots are disabled so auth response bodies cannot enter saved artifacts.
The test also checks the last product name is flushed before both tabs show login.
This desktop Chromium test does not establish coverage for other browsers or every
editor, and does not test a dropped refresh response after a server-side commit.

## Read-only settings/banner regressions

Run `npx playwright test banners-settings.spec.ts` against the source production
preview on `localhost:4280`. The spec overrides the automatic `e2eDataGuard`
cleanup fixture with a no-op; it must never invoke data cleanup against the shop.
Real settings, authentication and media are read from the running stack. Test
PATCH requests are intercepted and fulfilled within Playwright (pending, success,
validation and network failures); no setting write reaches the backend. Other
business writes are blocked. Use the shared `VIEWPORTS` entries for 1440×900,
768×1024 and 375×812. Build the preview with
`VITE_STOREFRONT_BASE_URL=http://localhost:3000` to compare against local storefront
assets, and set `E2E_BACKEND_ORIGIN` only in the test process if the running backend
requires the configured production admin origin. Do not edit `.env` or rebuild or
restart shared containers. Backend setting tests use mocked persistence, not a
real DB or Flyway migrations.

## Local Commands

| App | Commands from repo config | Status | Evidence |
|---|---|---|---|
| `bigbike-web` | `npm run lint`, `npm run test`, `npm run build` | `CONFIRMED_FROM_CONFIG` | `bigbike-web/package.json` |
| `bigbike-admin` | `npm run check:i18n`, `npm run lint`, `npm run test`, `npm run build` | `CONFIRMED_FROM_CONFIG` | `bigbike-admin/package.json` |
| `bigbike-backend` | `./mvnw test`, `./mvnw package` | `CONFIRMED_FROM_CONFIG` | `bigbike-backend/pom.xml` |

## Kiểm hồi quy ranh giới ba cửa

`bash deploy/nginx/tests/domain-boundary-config-test.sh --self-test` là cổng bắt buộc trước commit
khi thay đổi Nginx, lớp phân loại host hoặc tài liệu triển khai. Bài kiểm chỉ dùng Bash cùng
`grep`/`awk`/`sed` có sẵn trên máy chủ. Nó phải cho bộ cấu hình nguyên vẹn đạt, tạo bản sao tạm,
gỡ cố ý một chốt rồi chứng minh bản hỏng bị báo sai; tuyệt đối không sửa file active.

Bộ kiểm backend phải phủ cửa khách, cửa nhân viên, tên Docker nội bộ, ba host local và host lạ;
đường viết hoa, dấu `;`/mã hoá, phiên nhân viên hợp lệ đi sai cửa, năm nhóm được mở, API khách,
`/ws` và `/api/internal/**`. Sau khi owner kích hoạt, kiểm đọc thật trang chủ, một sản phẩm, admin,
chuông báo và một số ảnh đang dùng; không tạo đơn hoặc sửa dữ liệu.

Cửa ảnh phải trả `200` và đúng content type cho object thật, `404` cho gốc bucket/đường lạ/kho chat,
và giữ nguyên lỗi object không tồn tại của MinIO. Chỉ mô phỏng MinIO mất kết nối trong Nginx tạm;
không dừng MinIO production để thử trang xin lỗi. `OWNER_CONFIRMED_2026-09-12`

## E2E test-data safety

The COD-only payment cutover is the exception explicitly requested by the shop owner for one
controlled live smoke test. Use the configured shop mailbox as the customer email, a unique
`E2E_PAYMENT_COD_` marker, an available product and synthetic customer/contact data. Verify the
confirmation page, customer email and admin order, then cancel only that marked test order with the
existing cancellation flow. Do not reuse real customer data or delete shop orders.

### Google Merchant source and landing pages

The web unit suite covers complete pagination, upstream failures, eligibility, XML escaping, real SKU uniqueness, variant grouping, price/stock/image projection, exact variant links and fail-closed HTTP responses (`__tests__/merchant/`). Existing purchase/JSON-LD tests cover initial selection and customer changes. The read-only `e2e/google-merchant.e2e.ts` downloads the actual feed and checks variant landing pages at the canonical 375/768/1440 viewport sizes, including an unavailable variant. It checks server-rendered offers, selected options, visible price, canonical URL, runtime errors and horizontal overflow. It never edits shop products or creates carts/orders; Google account receipt/approval is a separate operational check.

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

Kịch bản `media-folder-sidebar.spec.ts` chỉ kiểm giao diện cây thư mục, nên dùng guard
cục bộ thay cho lượt dọn toàn bộ module: tạo thư mục mang tiền tố
`E2E_MEDIA_FOLDER_<run>_`, giữ ID trả về và xóa đúng các ID đó theo thứ tự con trước cha
trong `finally`. Không đổi tên/xóa thư mục shop hoặc tạo/chuyển/xóa file. Bản dựng
riêng trong `bigbike-admin/e2e/media-sidebar/` bọc App thật bằng `I18nextProvider`
để kiểm nhãn Việt/Anh qua browser; nhãn giao diện chạy thật vẫn cố định tiếng Việt.
Chạy từ `bigbike-admin`: `E2E_BASE_URL=http://localhost:4281 E2E_BACKEND_ORIGIN=<origin admin được backend chấp nhận> npx playwright test --config e2e/media-sidebar/playwright.config.ts`.

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

## Daily out-of-stock digest regression

Automated coverage must prove: one aggregate (not per-item messages) when stock is out; complete silence when no item qualifies; draft/hidden/trash/discontinued rows are excluded; a published product with a mix of available and unavailable variants appears only in the separate partial section; disabling the setting prevents a run; the configured Vietnam time and same-day catch-up work; one local date cannot create a second notification or SMTP attempt; estimated legacy ages and exact future ages render bilingually; every product link targets its admin editor; and a long list remains fully viewable. Email tests render the template and mock dispatch — they must never use real SMTP.

Status: `CONFIRMED_FROM_CODE_AND_TEST`


## Internal email configuration regression

The backend must resolve one shared internal recipient for new-order
notifications. Tests cover the valid configured value, rejection of a missing value at
startup, rejection of a malformed value, and the distinction between "accepted by the
SMTP provider" and final mailbox delivery in the email-dispatch log. The customer sender
address and email templates are outside this regression.

Status: `REQUIRED_FOR_NOTIFICATION_DELIVERY_CONFIGURATION`

## Post-purchase review invitation regression

The regression suite must cover automatic campaign opening on the first scheduler callback after
deployment, fixed seven-day due dates and the fixed 20-attempt daily quota. It must prove that
legacy/pre-cutoff orders are not backfilled, the server switch closes pending work and a later
enable starts a new cutoff, and a refunded order is not specially excluded. Keep coverage for
one-delivery-per-order, product-level reviewed filtering, two-stage eligibility checks, token
consumption, permanent public opt-out, pacing, failure/uncertain terminal states and all durable
delivery statuses. Admin invitation list/summary/opt-out/skip tests are removed because those
endpoints and the Settings surface no longer exist.

Automated tests must use a fake mail dispatcher and a fixed clock in Vietnam time; no test may connect to SMTP or use a real customer/order record. Required coverage:

- a native order completed after the active campaign cutoff is queued and attempted once after the fixed seven-day delay; repeated queue/sender runs never create a second delivery or attempt;
- imported/legacy orders, orders completed before enable, cancelled orders, missing-email orders and emails already opted out do not send; a refunded order is not specially excluded;
- disabling closes the campaign and skips pending deliveries; re-enabling creates a new cutoff and does not catch up an older order;
- duplicate line items produce one product link; products already reviewed by linked customer/order email or consumed invite item are omitted; no eligible product means no send;
- review submission with a valid product token stays `PENDING`, consumes that item exactly once and works for a guest with blank review email; wrong-product/invalid/reused tokens are rejected;
- unsubscribe is public, idempotent for its valid token, reveals no email and permanently suppresses every pending delivery for the normalized address;
- one atomic Vietnam-date attempt counter never exceeds the fixed 20-attempt daily limit under repeated/concurrent dispatcher calls; failures and uncertain outcomes consume a slot and are not retried;
- VI/EN subject/body/product links/unsubscribe copy render with valid Unicode; durable delivery states and provider-error diagnostics are covered without an admin reporting surface;
- web tests prove the fragment opens the existing PDP dialog and passes the hidden token, checkout snapshots `vi|en`, and both localized unsubscribe routes cover loading/success/error states;
- focused Playwright may verify the local public direct-link/unsubscribe screens only against isolated fixtures. It must never trigger a real SMTP message or mutate live shop data.

Status: `REQUIRED_FOR_REVIEW_RULE_014_016`

## Historical-order and overdue-reminder regression

Use PostgreSQL integration data only; never clone or mutate shop orders. The canonical fixture contains 1,661 rows with `legacy_id`, including 388 PENDING and 508 PROCESSING, plus 5 native rows. Required checks:

- run the same classification SQL twice: membership remains 1,661; order status, content and all monetary columns keep identical values; rollback/reactivate changes only batch activity;
- operational dashboard/nav/list/recent/status/reminder queries exclude active historical rows while financial dashboard/reports/customer purchase aggregates remain unchanged and disclose inclusion;
- ALL/OPERATIONAL/HISTORICAL plus OVERDUE filters, admin detail provenance, uncapped CSV scope columns/header, and `409 HISTORICAL_ORDER_READ_ONLY` with zero side effects;
- strictly older PENDING native order produces one `ORDER_OVERDUE_DIGEST`; repeated/same-day/concurrent/next-day runs do not duplicate it; in-threshold/exact-boundary/non-PENDING/history rows are excluded; zero candidates, no active history batch or invalid setting create no notification;
- admin Vitest covers VI/EN filters, read-only states, Settings regression that keeps the stored `order_overdue_days=2` row out of the UI, dashboard threshold `>=5`, report/customer scope wording and digest navigation; Playwright uses only isolated test fixtures and 1440/768/375 viewports. The owner decision on 2026-09-01 supersedes the former Settings editor for this threshold; reminder and overdue-filter coverage remains unchanged.

Status: `REQUIRED_FOR_ORDER_RULE_013_015_NOTIFICATION_RULE_002_REPORT_RULE_012`

## Variant attribute link regression

The product editor must be tested with every attribute type, not only colour:

- A legacy product with complete dictionary links saves without edits; changing
  only a variant price or availability must not produce an option error.
- An existing or backend-provisioned attribute with no values can receive its
  first value inside the product editor, and the selected value is sent with its
  `attributeValueId`.
- A missing value is reported on the exact variant option with a bilingual
  instruction to choose from the list; unrelated variants are not marked.
- The editor renders every returned attribute type dynamically, keeps colour and
  size first, shows values only for checked types, and exposes no type
  create/rename/delete controls in either the builder or variant detail.
- The V1053 migration is tested for alias mapping, exact public-label
  preservation, no writes to already-linked rows, safe rollback and a second
  idempotent run. The guarded V1089 cleanup is tested for the all-four target
  set, zero-reference enforcement and a safe second invocation.

Status: `REQUIRED_FOR_PRODUCT_RULE_008_AND_ATTRIBUTE_RULE_001`

## CI Truth

GitHub Actions currently runs:

| Job | What CI actually does | Status | Evidence |
|---|---|---|---|
| secret-artifact-guard | Blocks tracked environment files and credential artifacts; allows only public `.env.example` templates and the root `.env.vps.example`. Real `.env` / `.env.vps` files remain forbidden; template contents are still subject to the gitleaks scan. | `CONFIRMED_FROM_CONFIG` | `.github/workflows/secret-artifact-guard.yml`, `.github/workflows/ci.yml`, `.gitignore` |
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
| Review invitation | Eligibility/cutoff/idempotency/opt-out/quota/token/API/template suites plus web direct-link/unsubscribe tests; no admin invitation surface | `REQUIRED_FOR_REVIEW_RULE_014_016` |
| Trợ lý BigBike | Tư vấn core, một model cố định với same-model retry, quota, direct contact, nhớ trong phiên, cart và ảnh riêng tư VI/EN. Web phải có bài kiểm khung chat: nhãn AI ngắn, ba nút ở đầu khung điện thoại và thêm nút mở rộng/thu gọn trên máy tính (2026-09-07), khung 544px/mở rộng tối đa 928px vừa màn hình, thẻ hai cột chỉ khi mở rộng, giữ hội thoại/câu đang nhập/ảnh chờ/lựa chọn khi đổi kích thước, màn mở đầu lời chào + bốn gợi ý, tỉ lệ đầu+đáy ≤40% và đáy đoạn chat bám sát đáy khung sau khi trả lời xong (`CHAT_RULE_061`). **Bắt buộc có bài kiểm thử Testcontainers + PostgreSQL (`spring.flyway.enabled=true`, hồ sơ `tc`) chèn mọi giá trị `chat_messages.source` mà backend có thể sinh** — bộ test H2 mặc định tắt Flyway nên không bao giờ thấy ràng buộc CHECK, và đó là lý do lỗi mất câu trả lời sống được nhiều ngày. Không chạy bulk Gemini thật. | `REQUIRED_FOR_CHAT_RULE_001_020_040_059_061` |

## Trợ lý BigBike — ma trận kiểm thử (owner decision 2026-08-29)

**Quyết định chủ shop 2026-10-02 — `CHAT_RULE_070`: đã gỡ toàn bộ Trợ lý BigBike.** Các mô tả trợ lý bên dưới chỉ là lịch sử, không còn là yêu cầu đang áp dụng. Web chỉ có nút liên hệ trực tiếp Hotline/Zalo/Messenger, không gọi API chat hoặc Gemini; quản trị không có hội thoại/cài đặt/quyền chat. Dữ liệu cũ không bị xóa hàng loạt; chỉ tiếp tục dọn dữ liệu đã hết hạn theo thời hạn có sẵn. Xem `BUSINESS_RULES.md` § Gỡ Trợ lý BigBike và khôi phục liên hệ trực tiếp.


- Backend: tư vấn sản phẩm/so sánh/size/giá/tồn/policy/đơn dùng nguồn thật; safety chặn bịa giá, giảm/quà/giao hàng, khan hiếm và lộ PII.
- Backend: Gemini 3.7 Flash là model duy nhất; timeout/`429`/`5xx`/network/empty-invalid payload chỉ retry chính model trong 65 giây/tối đa 4 provider calls; final failure mở các kênh liên hệ trực tiếp, không tự handoff và không thử model khác.
- Backend: one logical turn giữ đúng một quota slot, retry không tạo slot mới; quota 400/ngày và trần 40 lượt mặc định còn chính xác; clarification/fast-path không gọi AI.
- Backend: không có queue/claim/staff message/return-to-AI/close/outside-hours handoff; direct contact không ghi dữ liệu; `chat.read` trả đúng 403 khi thiếu quyền và `chat.reply` không còn được cấp.
- Backend: setting registry chỉ còn các key được giữ; review moderation không bị ảnh hưởng; migration V1070 assert dữ liệu handoff đã được dọn trước khi bỏ cấu trúc.
- Web/admin: không render/call/mocking cho model chooser/evaluation/cost/fallback, lead/form liên hệ, feedback, proactive, attribution, unanswered/data gaps, template/abbreviation editor; đầy đủ VI/EN và không mojibake.
- Web: action lỗi mở đúng panel Hotline/Zalo/Messenger mà không tạo request; không có lối gọi người thật; add cart/variant vẫn có hậu kiểm; memory v2 xoay token cũ và quyền tắt/xóa vẫn đúng.
- Image: khi AI service có cấu hình thì luôn bật, 3 ảnh/lượt, 9/hội thoại, 8 MB/ảnh; hạn mức ngày chỉnh ở quản trị, khởi điểm 60, giữ bộ đếm; private ownership/retention; `availability` không còn trả `disclosure` và khung chat không còn dòng công bố ảnh (owner decision 2026-09-06); thiếu service thì nút tự ẩn; image intent tiếp tục dùng fixture, không chạy bulk provider thật.
- Image (owner decision 2026-09-07): phải có bài kiểm cho từng câu đã đo hỏng ngày 07/09 — ảnh sản phẩm kèm “muốn đặt đơn hàng”, kèm “có size nào”, kèm “bảo hành bao lâu” đều **không** được rơi sang tra đơn/từ chối đoán size; ảnh mà model nhận là hoá đơn hoặc ảnh đầu/người thì **vẫn** dừng lượt. Lượt ghép phải lưu **đúng một** dòng trợ lý (unique index `(request_id, role)`), nội dung dòng lưu và nội dung trả về phải bằng nhau, và tin nhắn khách chỉ được lưu một lần kể cả khi client không gửi `requestId` (`ChatImageChainedTurnTest`).
- Image WebP: fixture WebP thật nằm ở `src/test/resources/chat/` vì Java **không encode được WebP** (backend chỉ mang bộ đọc). Fixture bắt buộc là **ảnh nhiễu**: bộ đọc từ chối ảnh giãn quá 2048:1 nên ảnh một màu trơn bị coi là ảnh bom và bài kiểm sẽ đo nhầm thứ khác. Cách sinh lại ghi ở `src/test/resources/chat/README.md`. Phải giữ cả ca WebP hỏng/không giải mã được vẫn không vượt được chốt 1.600 px.
- Backend (owner decision 2026-09-06): mọi câu hỏi trong phạm vi phải có bài kiểm chứng minh **không** ra thông báo lỗi kỹ thuật — chính sách bảo hành, quy định đội mũ, hai câu mặc cả giá (`ChatAnsweredQuestionsTest`).
- Backend: bài kiểm nhận diện danh mục phải dùng bộ danh mục **giống kho thật**, gồm các tên đụng hư từ (`Phụ kiện cho xe`, `Áo mưa, đồ đi mưa moto`, `Túi đeo hông`). Bộ danh mục rút gọn không bắt được lỗi này — đó là lý do lỗi bấm nút đổi nhóm hàng sống sót (`ChatCategoryAliasHygieneTest`).
- Backend: bấm hết các nút của một vòng hỏi lại phải giữ nguyên nhóm hàng ở **mọi** nhóm được kiểm.
- Backend: mỗi câu chữ mới hiển thị cho khách phải được khẳng định là đi qua được `ChatResponseGuard.check`; tên sản phẩm có thể chứa từ bị coi là thuật ngữ kỹ thuật nên phải bỏ tên đó ra khỏi câu thay vì mất cả câu trả lời.
- Backend: luật cấm khẳng định bao trùm phải có bài kiểm cả hai chiều — đoạn trích chính sách đi qua được `check`, câu model tự khẳng định về kho vẫn bị `checkModel` chặn.
- E2E: dùng REST/SSE/STOMP mock hoặc fixture, dữ liệu tiền tố `E2E_`; không gọi AI thật và không chạm dữ liệu khách.

Các context PostgreSQL profile `tc` chạy toàn bộ migration từ kho trống. Migration production có thể dùng snapshot hợp lệ nhưng không sửa version đã áp dụng. Nếu server local không chạy do migration đã áp dụng không có trong source, ghi `Not run` và tiếp tục unit/build/static checks.
## Public video viewer regression — 2026-09-07

- `components/home/video-carousel/VideoModal.test.tsx`: preserve legacy providers and descriptions; loading/slow/error/retry, valid source links, YouTube readiness/error callbacks, stale callback cleanup, keyboard controls, empty data and single-video controls. Shared YouTube loader and gallery facade tests cover lazy loading and recovery after script failures.
- Real read-only browser checks on existing home/PDP video data: 360×640, 375×667, 390×844, 568×320, 844×390, 768×1024, 1440×900 and 1920×1080. Verify controls ≥44px, no overlaps, short landscape player ≥200×200, nearby desktop arrows, long content remains reachable, VI/EN, next/previous/close and restored scroll/focus. Browser emulation does not replace a physical Safari/Android check of browser chrome/safe areas.
- Loading/failure fixtures belong in component tests only; do not write fake videos into the running shop. Player-side errors for legacy TikTok/Facebook embeds remain provider-owned; the viewer offers a source link.

## Cart quick view and full-page regression — 2026-09-07

- `components/cart/CartExperience.test.tsx` exercises the real shared query hooks and both cart views with controlled API responses: pending mutations, same-ID snapshot refresh, failed edits and quantity rollback, initial/refetch errors, retry, offline failure without queued edits, unavailable items, empty state, focus restoration, desktop dismissal, and Vietnamese/English destinations. `CartParts`, `QuantityStepper`, `MobileBottomNav` and `HeaderUiContext` tests cover the reused controls.
- Browser verification uses an isolated build against the running local backend and real published catalog variants in a fresh guest session. Cover 320/375/430px mobile, touch emulation, 768/1024/1440px full page, a six-line cart, fixed sheet footer, 44px touch targets, free shipping, matching quantities/totals, offline edits and recovery, delete-to-empty, and checkout navigation in both languages. Check that only one checkout action is visible, that the chat launcher clears the mobile cart action bar, and that resizing to desktop closes the sheet and releases scroll lock. Do not submit a real order; remove the guest-session test lines afterward.
- References: `API_FLOW_MAP.md` § Cart review; `BUSINESS_RULES.md` `SHIP_RULE_001`; `bigbike-web/STYLEGUIDE.md` § Giỏ hàng nhanh trên điện thoại.

## Storefront measurement regression

Automated tests must prove the shared helper is the only component-facing measurement path and
that blank environment ids produce no third-party request. Required coverage:

- standard commerce payloads include `add_payment_info` with `payment_type=COD`; confirming the
  same cart again/reloading cannot repeat that step, and no transfer method appears;
- assistant open and phone/Zalo/Messenger clicks are measured at all shared placements, with PDP
  product context when available and no phone number/contact text in event parameters;
- brand/size/price filters emit only after matching results succeed, while initial URL state,
  failed requests and refetches do not; promotion, size result, successful login/sign-up, accepted
  review and video-open actions each emit once at the documented success boundary;
- the header emits one `search` for each exact settled suggestion result (including zero products),
  and a direct result page emits its own `search` with the total matching products. Tests assert
  both `search_surface` values, prevent render/stale/error duplicates, and prove email/phone/token
  terms are sent only as `[redacted]`;
- scroll 10/25/50/75/90/100 and PDP section reach use per-session/path de-duplication across
  remount/reload; GA4's automatic scroll event is not fired manually;
- authenticated Identify uses only the internal customer id; logout clears GA4 identity; masked
  private surfaces and exact Clarity CSP/env gates are asserted;
- Meta coverage initializes only the approved `460465848002810` Pixel when its public id is set,
  and proves that a blank id has no Meta request. Assert one direct base installer, the exact
  `connect.facebook.net` `script-src` allowance and no Google Tag Manager/Zaraz path. Do not
  simulate a manual PageView for client navigation: Meta's library owns that behavior;
- the shared helper maps only `ViewContent`, successful `AddToCart`, `InitiateCheckout`,
  COD-confirmed `AddPaymentInfo`, once-only `Purchase`, sanitized `Search` and channel-only
  `Contact` to Meta. Every commerce payload uses the same variant SKU as GA4/feed and numeric
  integer VND. Assert no Meta event for listing, remove-from-cart, cart view or address selection;
  assert `Purchase` has `eventID` `purchase_<orderNumber>` and is still suppressed when the
  thank-you page reloads;
- both customer and admin cancellation paths insert one sanitized outbox row atomically. Repeated
  cancellation/scheduler calls do not add or resend a row; disabled configuration sends nothing;
  orders placed before the `2026-09-06 00:00 Asia/Ho_Chi_Minh` GA4 cutover enqueue nothing;
  the row is committed as `SENDING` before the network call; a mocked collector receives the real
  `refund` HTTP body with the original `transaction_id`, VND value and items; HTTP/network failure
  is terminal `FAILED` for manual GA4 reconciliation, never an automatic resend. Checkout tests also prove a
  valid Google-tag `client_id` is stored but never returned, while malformed/missing ids are safely
  discarded and cannot block an order.

Focused Playwright runs against an isolated/local stack and intercepts GA4/Meta/Clarity hosts. It must
exercise the highest-volume/read-only paths: assistant open/contact, a successful filter, a
homepage promotion, product-section reach and full-page scroll. It asserts actual outbound
requests, blank-local script gates, exact CSP hosts and masking, not just helper calls. State-
changing success boundaries (COD confirmation, video/review, auth identity and customer/admin
cancellation) stay in component/API/integration tests with controlled records; the backend HTTP
client test sends the real `refund` body to a local collector. Never point tests at the live GA4
or Meta Pixel, submit real customer data, or mutate a real shop order. Production release verification
uses one owner-marked test order and GA4 DebugView/Realtime plus Meta Test Events, then cancels
that same test order and checks the revenue correction; do not create a transfer order. DebugView must also show `key`,
`token`, `tiep`, `s` and `q` URL values redacted, and Clarity must remain disabled until its project-level URL
masking for those parameters is visible in a test recording.

Status: `REQUIRED_FOR_ANALYTICS_RULE_001_006`

## Current Testing Gaps

| Gap | Status | Evidence |
|---|---|---|
| Admin unit/component tests run through the dedicated `npm run test` script. | `RESOLVED_2026-08-28` | `bigbike-admin/package.json` |
| Web unit tests exist locally but are not run in CI. | `CONFIRMED_FROM_CONFIG` | `bigbike-web/package.json`, `.github/workflows/ci.yml` |
| Live redirect quality | Two sequential scans of the 241-row owner URL list, 0.5s/request/pass; the live scan is evidence, not a unit-test substitute. | `REQUIRED_FOR_AUDIT_2026-08-14` |


### Xác nhận trợ lý và video bằng dữ liệu thật — đợt 08/09/2026

**Quyết định chủ shop 2026-10-02 — `CHAT_RULE_070`: đã gỡ toàn bộ Trợ lý BigBike.** Các mô tả trợ lý bên dưới chỉ là lịch sử, không còn là yêu cầu đang áp dụng. Web chỉ có nút liên hệ trực tiếp Hotline/Zalo/Messenger, không gọi API chat hoặc Gemini; quản trị không có hội thoại/cài đặt/quyền chat. Dữ liệu cũ không bị xóa hàng loạt; chỉ tiếp tục dọn dữ liệu đã hết hạn theo thời hạn có sẵn. Xem `BUSINESS_RULES.md` § Gỡ Trợ lý BigBike và khôi phục liên hệ trực tiếp.


Chỉ chạy provider thật khi owner đã duyệt ngân sách, đếm trước/sau từng đợt và tách slot chữ/ảnh/video. Đợt này: tối đa 160 slot chữ, tám ảnh, tám video; không reset bộ đếm. So câu trả lời với hàng/biến thể/chính sách đang công bố, kiểm Việt/Anh và chuỗi đổi chủ đề/quay lại nhiều mẫu. Test giả lập kiểm giới hạn/quyền/lỗi, không thay bằng chứng chất lượng AI.

Video cần tệp có hình/tiếng thật: nhiều góc sản phẩm; thao tác; lời nhắn; không lời nhắn; câu nói trong âm thanh; hành động cuối đoạn. Kiểm thêm MP4/MOV/WebM, tệp hỏng/giả MIME/quá 15 giây/quá 40 MB, một video/lượt, hai/hội thoại, mười/ngày, ảnh XOR video, retry không tính lại, đồng hồ chung tối đa 60 giây, hết hạn bảy ngày/khách xóa lịch sử, ownership và `chat.read`, lịch sử web/admin, nội dung Việt/Anh. Mọi dữ liệu thử có manifest riêng; không gọi công cụ dọn E2E toàn hệ thống.
<!-- 2026-09-08: Preflight giữ kiểm tra TypeScript của các test web. Vitest globals phải có khai báo kiểu trong setup; test double của Next Image khai báo rõ các prop riêng. Không dùng ignoreBuildErrors hoặc loại test khỏi bước kiểm kiểu để che lỗi. -->

### Image assistant regression — 2026-09-08

Bắt buộc kiểm fixture Việt–Anh: logo hãng có/không kinh doanh/hết hàng; screenshot găng tay có logo shop; không rõ mẫu; JSON bị cắt/rỗng/sai schema rồi retry; nhiều ảnh/thứ tự/xung đột/quota một phần; cạnh tranh PostgreSQL/reset ngày/idempotency; ghi nhớ ảnh không có chữ và hỏi tiếp; ảnh tài liệu không tạo hành động thanh toán hoặc thông báo nội bộ, còn ảnh sản phẩm vẫn đi đúng luồng hỏi hàng. CLI phải có dry-run/apply/resume/verify/rollback trên dữ liệu thử riêng, không dữ liệu khách. Kiểm PostgreSQL cho ảnh phải dựng Hibernate SessionFactory với `hbm2ddl.auto=validate` trên schema migration và đọc/ghi entity thật; kiểm SQL bằng JDBC đơn thuần không bắt được lệch kiểu entity/cột. Browser kiểm 1440/768/375, lỗi tải, Việt–Anh; provider giả chỉ trong test, không vào runtime. Không gọi Gemini thật để chạy bộ đề; ghi Not run cho kiểm trên production chưa chạy.

Khi chạy toàn bộ backend trên VPS ít RAM, các Spring context thử phải dùng H2 riêng, tránh context bị loại khỏi cache xóa schema của context khác. Không lấy DB/MinIO/Gemini từ `.env.vps` cho kiểm thử. Lệnh kiểm toàn bộ có giới hạn tài nguyên (PostgreSQL Testcontainers vẫn tự tạo DB riêng):

```bash
cd bigbike-backend
JAVA_TOOL_OPTIONS='-XX:ActiveProcessorCount=2 -Xmx1100m' GEMINI_API_KEY= \
./mvnw -B clean verify -Dspring.test.context.cache.maxSize=2 \
  '-Dspring.datasource.url=jdbc:h2:mem:bigbike-image-${random.uuid};MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH;NON_KEYWORDS=VALUE' \
  -Dbigbike.minio.endpoint=http://127.0.0.1:1 -Dbigbike.ai.gemini-api-key=
```

Kiểm giao diện khung chọn ảnh mà không ghi dữ liệu khách/tiêu AI: `PW_BASE_URL=https://bigbike.vn npx playwright test assistant-images.e2e.ts --workers=1` từ `bigbike-web`. Ca này đọc availability thật, chặn và trả phiên giả chỉ trong trình duyệt, không gửi ảnh/tin nhắn; kiểm Việt–Anh ở 375/768/1440 và lưu ảnh chụp trong artifact Playwright. Đây là kiểm composer, không thay phép kiểm nhận diện bằng AI hoặc kiểm quyền server.

### DEV-7–DEV-9 (06/11/2026)

- `__tests__/merchant/local-inventory.test.ts`, `local-route.test.ts`: toàn bộ ID/giá hiện hành/Còn-Hết khớp XML; loại hàng đúng; lỗi nguồn/cấu hình trả 503; HEAD và UTF-8 TSV.
- `__tests__/analytics/analytics.test.ts`: chống lặp VI/EN, khác slug, biến thể khác và lượt quay lại; eventID duy nhất, Purchase giữ ID ổn định.
- `e2e/local-inventory-hours.e2e.ts`: đọc danh mục thật, đối chiếu toàn bộ TSV/XML và HTML giờ VI/EN, footer thực tế. Chỉ chạy trên bản web mới đã có GMC_STORE_CODE; không tạo/sửa hàng, không gửi đo lường thật. Ví dụ `PW_BASE_URL=http://localhost:3002 npx playwright test e2e/local-inventory-hours.e2e.ts --workers=1`.

### GMC tiếp nối 10/11/2026 — kiểm an toàn

- `python3 -m unittest discover -s scripts/tests -v`: gồm ngưỡng ảnh hai cạnh 800 của shop; probe HTTP/nội dung; monitor lần đầu khỏe không spam, từng URL độc lập, lỗi/khôi phục, gửi lỗi không mất trạng thái và thử lại, dry-run không gửi/ghi state, không log secret. Không gửi Telegram thật bằng test.
- `systemd-analyze verify deploy/monitoring/gmc/bigbike-gmc-monitor.service deploy/monitoring/gmc/bigbike-gmc-monitor.timer` và `systemd-analyze calendar --iterations=3 '*-*-* *:*:00'`: chỉ kiểm cú pháp/lịch dự kiến, không phải bằng chứng cài lịch.
- E2E sự cố: sao chép đúng artifact web đang chạy vào thư mục tạm trên host; khởi chạy process riêng chỉ nghe loopback, API proxy riêng chỉ GET tới dữ liệu thật. Chỉ proxy thử nghiệm trả 503/4xx và chỉ browser thử nghiệm chặn snapshot/analytics; không tắt/restart production hoặc ghi dữ liệu shop. Kiểm nút mua khóa trước snapshot → mở sau snapshot thật → khóa sau lỗi; kiểm desktop/mobile, 4xx không dùng fallback và 404/410 xóa cache. Runtime trên host có thể khác Node trong container, cần ghi giới hạn này. Không tuyên bố đã gây lỗi backend production để thử.
- Kiểm toàn bộ link HTTPS: tuần tự, không follow redirect, xác nhận SKU trong JSON-LD và HTML đủ; lưu từng kết quả, giới hạn bộ nhớ/sức khỏe/độ trễ để dừng chính tiến trình kiểm. Không thay kết quả từng URL bằng ba mẫu.

Kiểm phần sửa bộ nhớ: `html-server-lifecycle.test.ts` chạy môi trường Node, lặp nội dung qua hơn hai lần làm mới window, xác nhận output, lọc script/iframe ngoài, typography và rel link vẫn đúng. Đo cùng HTML catalog thật ba lượt có nhường event loop và thu gom chỉ trong process cô lập; đối chiếu hash output VI/EN trước/sau. Không gọi forced-GC hoặc tạo heap snapshot trên production.


## Performance validation — 2026-11-12 / continuation 2026-11-13

`performance-validation.yml` runs only on standard GitHub-hosted ubuntu-24.04 runners,
with read-only repository permission, no shop/environment secrets and bounded timeouts.
On 14/11 the owner authorized continuing the previously described publication and CI
step. A separate `ci/performance-validation-*` branch may trigger sequential regression
and full-stack jobs by push, only while repository visibility is public. Main and the
original dirty workspace stay untouched; production deployment is a separate approval.
Manual dispatch remains available; private repositories require operator confirmation
of remaining included quota before running. No larger runner, paid service, production
copy or extra capacity is authorized. Public standard runners are free independently
of included compute per [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
(checked 14/11/2026). This workflow disables dependency caches and artifact uploads;
only bounded, compressed allowlisted sanitized JSON is written to job logs for retrieval.
GitHub documents job logs/summaries outside artifact storage allowance. No account
spending controls or storage quotas are changed. This does not establish an account
billing audit. Unpublished local work cannot be measured by remote CI. No green unit
gate certifies full-system latency.

Regression gates and full-stack arms run sequentially. The opt-in full-stack job uses
`scripts/performance/run_ci.py` and `compose.ci.yml`: real PostgreSQL 16, Redis 7.4,
MinIO (same release as root Compose; see the pinned official-binary CI image in
DEPLOYMENT_GUIDE), Java 17 backend, production Next.js and built
Admin behind nginx. It refuses local/self-hosted execution. Its internal Docker
network has no external route; only loopback ports >=10000 are published. No root
`.env`, production volumes, credentials, data or cloud integrations are mounted.
Only this ephemeral CI project may be started/removed by the runner. This does not
permit any Docker service change on shared local/VPS machines.

Fresh schema uses canonical migrations plus exactly the two existing synthetic
precondition fixtures V26_5 and V1028_5 (from test resources). These satisfy legacy
V27 FK references and V1029's 109-row mapping preconditions without a legacy dump.
Do not include other test/dev migrations. Schema validation and normal login,
CSRF, permissions and rate limits stay enabled. The non-prod initializer creates
an isolated admin; measured catalog fixtures are created through real admin APIs
with `E2E_PERF_` names. IDs in the two historical migration precondition fixtures
are fixed only to satisfy immutable migrations. They contain no customer data.
SMTP/Telegram/analytics/OAuth/AI credentials are absent. The network additionally
blocks outbound delivery; browser navigation permits loopback only. Tracking tests
without real provider credentials establish local event logic only.

Freeze one complete candidate workspace/revision, including earlier user changes.
Create two copies and change only hash-bound, attributed optimization files in
Before via `prepare_baseline.py`. Never use Git HEAD as a general baseline for a
dirty candidate. A full-tree comparison must show exactly those source differences.
Run arms sequentially, with fresh identical database/buckets, generated fixture bytes,
config, resources, warm-up, tool versions and workloads. Keep functional migration
repairs and all unrelated changes identical in both arms. Record source, fixture and
runtime identities, tool versions and timings. Distinguish existing four optimizations
from any new changes in the continuation report; combined A/B is not attribution to
one individual change.

Bounded API workload starts at concurrency 1, then 2 and 4. Report successful-only
P50/P95/P99/throughput alongside all statuses, errors, timeouts and 429; do not follow
redirects, retry failed samples, relax security or count fast errors toward SLOs.
Stop progression on non-success, timeout, container OOM/restart, memory >=85% of its
limit or host available memory <512MiB. Component query counts and aggregate database
SQL counters have separate scope; aggregate statements are not exact queries/request.
Collect CPU/RAM, connections/waits/locks and normalized pg_stat_statements summaries
without raw SQL parameters. Diagnostics may add overhead and must match both arms.
The fixed low-load CI run is a lab observation, not production capacity certification.

Browser checks use production builds in mobile/desktop Chromium. Record navigation
TTFB, FCP, LCP and CLS, observed interaction event durations separately. A lab INP
observation may use the pinned official web-vitals collector injected into browser
contexts before navigation. Publish interim reportAllChanges observations and actual
hidden-flush counts. The library flushes if a native hidden transition arrives, but
headless navigation may omit that event/final click; do not synthesize visibility
events or claim finalization when absent. Record support/missing interactions explicitly. This is scripted lab evidence, never field INP.
Also record JS/CSS bytes and duplicate request URLs without query/PII. Lighthouse
runs serially with the same pinned version/settings; never relabel TBT as INP. Check
catalog/search/PDP/cart/checkout and authenticated admin surfaces with real fixtures;
mark unexecuted CRUD/report/bulk paths explicitly. Uploaded media cases share deterministic
JPEG, opaque/transparent PNG, WebP and valid MP4 bytes; check original hashes, dimensions,
transparency, Range/download/cache and authorization. Request-wall duration, transport
and backend processing duration must be labeled separately: no server-only timing may
be inferred from upload wall time. Long uploads/video and report SLOs remain open until
measured on representative data; do not force the ordinary 300ms API target on them.

Search submission is functionally verified only after the new query appears in
the rendered heading and the non-busy catalog grid contains exactly the expected
owned fixture links on the current page. A changed URL or a short INP observation
alone does not prove that search results loaded. Obtain the reference page through
the real public API with the same query/page/size/sort/language rather than copying
search ranking or majority-match rules into the harness. Label the resulting API
cache prewarm explicitly; still wait for the actual rendered results, and keep the
same readiness check and reference read in both arms.

After all API/browser/Lighthouse/media measurements finish in each arm, the
isolated lab may create a separate `E2E_PRODUCT_MERCHANT_` product through normal
Admin APIs, with its own generic attribute and two owned values/variants. Do not
change the40 published products or10000 drafts used for measurement. Check the
complete real Merchant XML and headers, two variant SKU rows, inherited/own sale
prices, stock, option/group/image identity, then real initial HTML/structured data,
canonical and manual selection on375/768/1440 viewports. Use the existing browser
egress boundary and quality helpers. Add the explicitly selected available variant
to a separate guest cart and check opaque product/variant IDs, inherited sale price
and totals; adding the unavailable variant must409 without changing that cart.
This does not decide whether omitting a variant is allowed. Keep credentials, payloads and raw
browser output private; publish only bounded counts/statuses and partial phase
evidence. Remove these records only with teardown of their job-owned stack.
This proves a generic single-axis variant flow, not color/size/multi-axis coverage
or Google account approval. When the lab has no configured GMC store code, assert
Local Inventory503 with no-store/retry headers; a positive TSV parity check needs
the actual configured store code and must never invent or configure one.

Publish only allowlisted sanitized JSON summaries. Never publish raw test XML,
application/access logs, environment files, passwords/tokens/cookies, audit snapshots,
request payloads or browser storage/traces. Preserve errors as counts/case names.
The job must fail on missing required cases/skips and retain partial sanitized evidence
when a gate fails; cleanup cannot turn an incomplete run into acceptance.

Continuation baseline (13/11): `baseline-manifest.json` now attributes exactly three
backend files for the two new optimizations. Hash-bound Before snapshots of image
services retain pre-existing PNG conversion and the earlier unchanged-variant skip.
The former six-file manifest is retained under `scripts/performance/baselines/` as
historical evidence; it is not used as this run's Before.

For identical fixture IDs/timestamps, capture the first arm's entirely synthetic CI
database with pg_dump after API seeding, plus the exact public-bucket objects/variant
keys and MIME types. Keep dump, credential hashes, sessions and object copies private
in the job temporary directory (0600), outside artifacts. Restore into the second
arm's fresh owned database/bucket before starting its backend; same generated CI
credentials/config and logical data. Publish only fixture hashes/counts. This is
never a production backup/import path. MinIO Last-Modified and wall clock naturally
differ; do not claim those headers identical. New test writes then run in each arm
in the same order. Redis starts fresh per arm with normal limits enabled.

The lab web standalone is built by Node22 on the hosted Ubuntu runner and runs on
Node22/glibc to preserve native Sharp compatibility. Shipping images currently use
Node20/Alpine; the lab therefore establishes a reproducible comparison, not exact
production runtime parity. Detect both root and monorepo-nested standalone entrypoints.
Assert real image delivery before accepting browser/Lighthouse measurements.

After first-arm fixture capture, stop only that job's new provisioner backend/proxy/
Redis, restore the frozen synthetic snapshot and recreate those three owned CI
processes. This removes the seeding JVM/limiter warm state. Both measured arms
then boot fresh and perform the same normal login/build/warm-up sequence. Redis
limits remain enabled during measurement; no bucket reset occurs while measuring.
Refuse to adopt a pre-existing project. This exception is confined to unique
GitHub-run-owned ephemeral services and grants no permission over shared services.

All three lab browser/API origins enter the ephemeral nginx edge. Preserve the
documented coarse budgets: API10 requests/sec burst20; web/admin30 requests/sec
burst30, with WebSocket exempt from the HTTP coarse limit. Backend tiers remain
unchanged. Proxy emits429 JSON/no-store/Retry-After; resource/API/network429 stops
acceptance. Local syntax checks do not start a server and do not prove runtime.

CI unit fixtures retain their documented default public origins: unset only build-specific
`VITE_STOREFRONT_BASE_URL` and `VITE_ADMIN_API_BASE` for the unit-test command. These
are restored for the actual localhost production builds and runtime/browser workloads.
Evidence: overriding VITE_STOREFRONT_BASE_URL reproduces three unrelated URL-policy/
English-link assertion failures (60/63); do not change assertions or business URL rules
merely to accommodate the lab build environment. Sanitized Vitest failure output
includes static case names/source locations and fixed categories, never matcher values.

Commerce integration follow-up (14/11): run real price-review409 → cart reload →
same-key retry/replay plus discontinued add/quantity/checkout guards on two dedicated
E2E_PERF products, separate from the measured PDP fixture. Check owned DB order,
payment and reservation counts around rejected/replayed requests. These deliberate
price/status changes are functional cases on synthetic CI data, never a way to improve
benchmark scores or edit shop data. Restore the two original fixture values through
normal APIs afterward; run the same sequence in both arms and publish booleans/counts
only in commerce.json. Missing-variant business policy remains pending owner response;
do not infer it from nullability of the request field.

Large Admin catalog protocol (14/11): prepare 10,000 new synthetic simple products via
existing import validate/commit APIs, bounded100-row files, identical bytes for validation
and commit, normal products.update and mutation limits. Import deliberately creates DRAFT
and ignores media/variants/status per PRODUCT_RULE_009; do not alter this behavior to seed
published data. Label this separate10k draft/simple scenario; it does not establish10k
public/variant/media performance. Keep the primary40 published fixtures and PDP price.
Pace import requests>=1.15s, never retry partial commits blindly, fail on any row error,
warning/skip,429/timeout or resource boundary. Capture the initial frozen dataset only after
all imports complete, so both arms have identical IDs/data. Measure published representative
Admin query separately from10k draft query and verify sampled adjacent/middle/last pages,
exact totals, repeated-page stability and Before/After page identity hashes in both directions.
Retain all failures/partial counts; an incomplete seed is not a10k benchmark.

This expanded hosted lab uses PostgreSQL1GiB (same in both arms, shared_buffers128MB),
and a90-minute stack-job ceiling; total configured ceilings200 standard runner-minutes.
Public standard compute remains free per the billing boundary above. Private manual runs
must confirm the corresponding available quota; no spending control is raised. These are
CI resource limits, not shop tuning. No parallel builds/arms; all other lab limits remain.

Browser HTTP-cache correction (15/11 QA): Playwright context.route disables HTTP cache.
Candidate f85d92 contained the warm_browser_cache label bug, but its browser step
never ran because the backend gate failed. No warm-cache result was produced. Any
future use of that old routing tool denotes HTTP-cache-disabled repeated navigation;
never claim warm-cache acceptance from it. A future cache-preserving browser egress proxy may replace routing
ONLY after native tests prove cache hits and no denied-origin requests from main page,
WebSocket, worker and cross-site frame targets. The proxy is a CI measurement tool,
forwards only owned loopback origins without changing bodies/auth/headers, adds a
recorded extra local hop equally to both arms, and never emits raw URLs/cookies/logs.
Do not use page-only CDP blocking: native tests show workers/OOPIF/WebSocket escape it.
If complete egress protection/cache proof is absent, keep routing and mark warm HTTP
cache unverified. No security/provider restriction is relaxed for nicer scores.

Homepage test-fixture isolation (15/11): shared Spring contexts/cache and idempotent
SQL seed are not a clean fixture after other API tests mutate homepage flags/seed
rows. Reproduce the failure before changes, then use a dedicated H2 database/context
for HomepagePublicApiTest and invalidate only test-owned reference/listing caches
when directly resetting repository fixtures. Keep actual caches enabled and all
original homepage filter/order/rating assertions. Do not lower TTL or disable caches
in the application just to make tests pass; production API invalidation is a separate
invariant already covered by dedicated tests.

Cache-preserving collector protocol: reject-only loopback HTTP proxy with Chrome
explicit loopback-bypass list (remove implicit bypass first), no DIRECT fallback,
no upstream resolving/forwarding. Retain native main/worker/OOPIF/HTTP/HTTPS/WS cache
and deny proofs. Actual first page measurement clears browser HTTPcache before
navigation (cookies retained), second navigation uses enabled cache with observed
cache-hit counts; this never denotes cold server/DBcache. Preserve normal app behavior
and no-store private responses. Record transport limits and block non-proxied UDP/
QUIC in the lab; do not infer a blanket network audit from HTTP-only tests.

Resuming unchanged frontend gates (15/11): a later CI snapshot may reuse the two
successful frontend jobs of immutable run43670539154/f85d92a682238f3af17361b608219be995ca1257.
Before skipping duplicate frontend work, boundary must verify through public GitHub
run/job metadata the exact SHA/workflow and both success conclusions with lint/unit/
sanitized-count/build steps passed. Git must prove identical web/admin trees and
summarize_tests.py; compare the exact frontend workflow block excluding only the
reuse condition itself. Publish reuse proof and source reference. Any missing/changed/
failed/unreadable proof falls back to full frontend gates. Backend remains mandatory
for its fixture changes; never bypass a failed or unverified gate. This avoids repeating
already-passed builds when only backend test fixtures or lab tooling/docs change.

Internal web revalidation in the measured stack (15/11): configure the existing real
backend WEB_REVALIDATE_URL/SECRET and Next REVALIDATE_SECRET with one generated CI
secret and the single owned web replica. This is internal business behavior, not an
external provider to omit. Provisioning runs before a web process exists; leave its
URL blank only in that unmeasured initial seeding phase. After frozen restore, recreate
the measured backend with the real internal URL and expected replica count1 in BOTH
arms; Next receives the same generated secret. Never change shared-shop env.
Verify unauthorized revalidate401, prime a dedicated fixture PDP, patch its name via
normal Admin API, poll rendered H1 for committed change and restore via the same API.
Retain functional delay/counts and fail on missing refresh; no manual privileged
revalidation call may fake the backend-to-web integration. This is separate from
latency measurements and preserves the primary PDP price/source fixtures.

Workflow descendant condition correction (15/11): GitHub's implicit success() can
skip a descendant of a verified-reused frontend job even after the backend succeeds.
The isolated-stack job must explicitly use always() AND needs.backend.result=='success'
AND the authorized push/full-stack condition. This overrides skip propagation only;
a failed/missing backend gate still prohibits the stack. Run43676719268 passed backend
but never executed its stack; overall green is not performance acceptance.

CI startup diagnostics (15/11): record a separate infrastructure-start phase before
Compose starts PostgreSQL/Redis/MinIO. Failed commands expose only fixed categories
(registry authentication/manifest/rate-limit/transport, network overlap, invalid
Compose config, health/resource errors); never publish captured stderr, command
arguments, generated credentials or environment. Preserve those categories in the
sanitized arm status. A registry error is an environment dependency failure, not
an API performance result. Do not substitute a different storage release silently.

Host access to the internal-only lab network (15/11): Docker28.0.4 intentionally
skips port programming for internal networks (`moby/libnetwork/endpoint.go`,
`if !n.internal`). Keep that network internal; do not add an egress bridge or change
daemon/firewall settings. The hosted runner may access owned container IPv4s directly
as documented by Docker network internal mode. Use bounded host TCP byte relays
bound only to127.0.0.1:19000 (MinIO9000) and18080/13000/14000 (owned nginx80/81/82).
Remove the ineffective Compose published ports (Postgres is accessed by exec only).
Before each relay, verify hosted CI, exact owned project/service/running container,
only the owned internal network, matching network project/subnet and assignedIP.
Refresh nginx relays after controlled CI-only recreation; close all relays before
removing the owned stack. No request/header/auth/cookie/body rewrite or application
responses originate in relays; normal rate/auth/business gates remain in real apps.
Record this extra transport hop in both arms as a lab limitation, not production
network latency. Bound sockets/connections and publish counters only. Verify raw
bytes, half-close/streaming, bidirectionality and lifecycle with helper-owned TCP
fixtures; these fixtures never enter the BigBike application or measured workload.

Runtime failure evidence: before cleaning up a failed owned stack, publish only
allowlisted service state/exit/OOM/health fields and fixed error-signature codes
derived from at most80 private log lines per backend/web container. No raw logs,
error messages, environment, request bodies, credentials or customer fields may
be exported. A real GET from the owned web container to its expected internal
public API may report status/time and fixed field types/counts for an owned fixture
only; never export response values. Failure diagnostics do not replace functional
or latency gates and must not mask the original exception or delay cleanup.

Revalidation fixture name edits must satisfy the existing bilingual write contract
(TRANSLATION_RULE_002): read the owned Admin detail and preserve its nonblank
translations.en.name in both Vietnamese-name PATCH and restore. Missing English
fixture content is a setup failure; do not relax validation or synthesize a rule.
This independent harness correction does not diagnose an earlier PDP GET500.

Standalone portability gate (15/11): after the production Webpack build, inspect
only deployable server JS (not source maps/dependency sources) for literal
file://.../node_modules/css-tree/lib/data{,-patch}.js anchors left by bundling
createRequire(import.meta.url). Reject such host-dependent chunks. Native-load
css-tree from the real standalone entrypoint, verify resolution remains inside
the artifact, and parse/generate CSS under Node filesystem permissions permitting
only that artifact and Node/system runtime. Require CJS/patch/MDN trace closure.
Export booleans/counts/fixed failure codes only; no absolute paths or logs. A local
replica that can read its original build directory is insufficient portability proof.
The CI Docker PDP/revalidation scenario remains mandatory; this package gate does
not replace real application rendering or end-to-end acceptance.

Admin access-cache concurrency regression (15/11): PERMISSION_MATRIX's Admin
access-change lifecycle applies to later requests after commit. Test a cold DB
lookup paused after reading an old permission/account snapshot; commit-time evict
must prevent that loader from repopulating either cache. A later request must
read current permissions/status/accessVersion, including disable/revoke cases.
Use deterministic latches, not timing sleeps. Preserve unknown-role/user behavior,
role normalization, immutable permission lists and cached hot reads. Keep DB work
outside any publication lock; serialize invalidation with generation-checked
publication only. This does not cancel an already authorized request or introduce
a role/session rule. Do not change resend-invite hierarchy without an owner rule.

Frontend reuse anchor updated16/11 after the CSS portability repair: immutable
run43702380890 / 7ce05befd54a10f2aee36e8f20c52d0dee36863c replaces the historical
f85 reference above. Both frontend lint/unit/no-skip/build jobs passed; the web's
standalone portability step also passed. Compare check_standalone.py as well as
both app trees and summarize_tests.py, and require that explicit web step success.
The later cart failure in that run does not invalidate its completed frontend
gates; backend changes still require a fresh full backend gate and runtime checks.
