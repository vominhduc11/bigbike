# BigBike Production Readiness Audit

> **Ngày audit:** 2026-05-16
> **Reviewer:** Claude (Opus 4.7) — audit độc lập, không kế thừa kết luận audit trước.
> **Phạm vi:** `bigbike-web`, `bigbike-admin`, `bigbike-backend`, database/Flyway migrations, `bigbike_mobile`, config/deployment.
> **Mode:** AUDIT + TRACE + REPORT. Không sửa code hàng loạt. Mọi finding có evidence `file:line`.
> **Phương pháp:** Đọc docs canonical + audit trước → trace source code thật → **chạy `mvn clean test` toàn bộ suite** → đối chiếu kết quả với báo cáo trước.

---

## 1. Executive Summary

**Overall status: `NOT_READY` (technical blocker).**

Lõi nghiệp vụ của BigBike (catalog, cart, checkout, order, refund, POS, serial, công nợ, RBAC) **được thiết kế tốt** — pessimistic locking chống bán âm kho, idempotency chống đơn trùng, RBAC đọc từ DB, IDOR được chặn đúng, state machine enforce ở backend. Ba audit chuyên sâu trước (Order/POS/Serial) và audit `BIGBIKE_FULL_E2E_WORKFLOW_AUDIT.md` đã trace đúng phần lớn workflow.

**Tuy nhiên, audit này phát hiện một blocker mà các báo cáo trước bỏ sót:**

> **Bộ test backend KHÔNG xanh.** Chạy `./mvnw clean test` đầy đủ → **1164 test, 7 FAIL, 1 skip → `BUILD FAILURE`.**
> CI thật sự chạy `./mvnw -B clean verify` (theo `TESTING_GUIDE.md`) → CI đang **ĐỎ**.
> Báo cáo `BIGBIKE_LAUNCH_READINESS_SUMMARY.md` ghi "354 test PASS, 0 FAIL" — nhưng đó chỉ là **19 class được chọn lọc**, không phải toàn bộ suite.

### Main blockers

| # | Blocker | Severity |
|---|---|---|
| PROD-01 | Bộ test backend FAIL — `mvn clean test` → 7/1164 fail → CI gate (`clean verify`) đỏ | **P1** |
| PROD-02 | `application-prod.properties` đặt `management.endpoints.web.exposure.exclude=*` đè cả `include` → actuator health bị ẩn ở prod → Docker healthcheck fail → `bigbike-web`/`bigbike-admin` không khởi động | **P1** |

### Top risks before production

1. **Không có lưới an toàn hồi quy đáng tin.** Khi suite có 7 fail "đã biết", không thể phân biệt regression mới với nhiễu cũ. Mọi tuyên bố "đã test" sau đây đều mất giá trị.
2. **CI đỏ = không có pipeline deploy an toàn.** Docker build trong CI nằm sau `clean verify` — verify fail thì image không được publish theo quy trình.
3. **Một số test fail che giấu khả năng có bug thật** ở POS (bán sản phẩm có biến thể mà không chọn biến thể) và công nợ (write-off không phản ánh sang đơn) — cần xác nhận, xem PROD-03 / PROD-04.
4. Báo cáo readiness trước **over-claimed** — verdict "READY / 0 FAIL" dựa trên test run cục bộ, không phản ánh trạng thái suite thật.

### Recommended next phase

**Phase 1 (bắt buộc trước production):** Đưa `mvn clean verify` về xanh — sửa hoặc cập nhật 7 test fail sau khi xác nhận từng cái là *test cũ* hay *bug thật*; sửa config actuator prod. Không có việc nào trong Phase 1 là thay đổi business rule.

---

## 2. Scope Covered

### Repos / modules đã kiểm tra
- `bigbike-backend` — ~50 controller, ~119 service, 119 Flyway migration, config/security.
- `bigbike-web`, `bigbike-admin` — đối chiếu qua docs + audit trước (không trace lại sâu — audit `BIGBIKE_WEB_DESIGN_SYSTEM_*` + `BIGBIKE_FULL_E2E` đã phủ).
- `bigbike_mobile` — đối chiếu qua audit trước (FULL-02/FULL-05).
- Database — toàn bộ `db/migration/*.sql`.
- Config/deployment — `docker-compose.yaml`, `.env`, `application*.properties`, `SecurityConfig.java`.

### Docs đã đọc
`BIGBIKE_FULL_E2E_WORKFLOW_AUDIT.md`, `BIGBIKE_LAUNCH_READINESS_SUMMARY.md`, `BIGBIKE_LAUNCH_DECISION_CHECKLIST.md`, `DEPLOYMENT_GUIDE.md`, `TESTING_GUIDE.md`, `CLAUDE.md`/`AGENTS.md`. Tham chiếu (không đọc lại sâu): `BIGBIKE_ORDER_E2E_WORKFLOW_AUDIT.md`, `POS_IN_STORE_WORKFLOW_RECHECK_AUDIT.md`, `BIGBIKE_SERIAL_MODULE_PRODUCTION_READY_AUDIT.md`.

### Commands đã chạy (evidence thật)
| Command | Kết quả |
|---|---|
| `./mvnw -q -B clean test` (backend, full suite) | **`BUILD FAILURE` — Tests run: 1164, Failures: 7, Errors: 0, Skipped: 1** |
| `git ls-files --error-unmatch .env` | `.env` **không** được track — đúng (gitignored) |
| `git check-ignore .env` | `.env` được `.gitignore` bao phủ — đúng |
| `ls db/migration/*.sql \| sed ... \| sort -V` | 119 migration, V1→V119, **không gap, không trùng version** |

### Những phần CHƯA kiểm tra được (UNKNOWN — không suy đoán)
- **Không chạy được test web/admin/mobile** trong session này (chỉ backend). Kết quả `tsc`/`flutter analyze` lấy từ báo cáo trước, không tự verify.
- **Không chạy được app với profile `prod` thật** (cần DB + đủ env) → PROD-02 dựa trên hành vi Spring Boot đã được tài liệu hoá, không dựa trên test runtime.
- **File upload validation** (`AdminMediaService`) — không tìm thấy logic kiểm tra content-type/magic-byte qua grep nhanh; đánh dấu `UNKNOWN`, cần trace riêng.
- Web/admin runtime, performance bundle, ISR — không đo trong session này.

---

## 3. Production Readiness Scorecard

| Nhóm | Status | Evidence | Notes |
|---|---|---|---|
| **Business correctness** | WARN | `AdminOrderService.java:427`, `PosOrderService.java:233` | State machine & money rules enforce ở backend. Nhưng 2 hành vi cần xác nhận (PROD-03, PROD-04). |
| **API / Data contract** | PASS | `SecurityConfig.java`, `CustomerOrderController.java` | Endpoint nhất quán; audit FULL đã chuẩn hoá DTO (FULL-08/10). Không phát hiện lệch contract mới. |
| **Database / migration** | PASS | `db/migration/` V1–V119 | Tuần tự, không gap/trùng. `ddl-auto=validate`. Prod chỉ chạy versioned migration. |
| **Security** | PASS (1 caveat) | `SecurityConfig.java`, `RateLimitingFilter.java`, `application.properties` | RBAC DB-driven, IDOR chặn, rate-limit auth, CORS tường minh, secret qua env. Caveat: internal redirect endpoint `permitAll` (đã ghi nhận). |
| **Reliability / transaction / idempotency** | PASS | `CheckoutService.java:166,339`, `ProductVariantJpaRepository.java:24` | `@Transactional` + `PESSIMISTIC_WRITE` lock product/variant/coupon; `CheckoutIdempotencyKeyEntity`. Chống bán âm kho & đơn trùng. |
| **Performance / scalability** | UNKNOWN | — | Không đo bundle/ISR/N+1 trong session này. List endpoint có phân trang (`page/size`). |
| **Observability / ops** | **FAIL** | `application-prod.properties:21-24`, `docker-compose.yaml` healthcheck | PROD-02: actuator bị `exclude=*` đè → health endpoint ẩn ở prod → healthcheck đổ. |
| **Testing** | **FAIL** | `mvn clean test` → 7 fail / 1164 | PROD-01: suite đỏ, CI gate đỏ. |
| **UI workflow handling** | PASS | Audit `BIGBIKE_FULL_E2E` §8 | 33/37 workflow `CONFIRMED_E2E` theo audit trước; không trace lại trong session này. |

---

## 4. Workflow Trace Matrix

> Trace mới/độc lập trong audit này. Workflow khác xem `BIGBIKE_FULL_E2E_WORKFLOW_AUDIT.md §3` (không lặp lại).

| Workflow | UI entry | API endpoint | Controller/Service | Entity/table | State transition | Permission | Side effects | Test coverage | Issues |
|---|---|---|---|---|---|---|---|---|---|
| Checkout (cart → order) | `/thanh-toan` | `POST /api/v1/checkout` | `CheckoutService.placeOrder` | orders, order_items, stock_movements | Order/Payment/Fulfillment khởi tạo | public (CSRF filter) | stock−, email, WS, coupon redeem | `Phase1FCheckoutApiTest` ✅ pass | — (locking + idempotency đúng) |
| Customer xem đơn / return | `/tai-khoan/don-hang` | `GET/PATCH /api/v1/customer/orders/**` | `CustomerOrderController` → `OrderReadService` | orders, returns | Order/Return | `ROLE_CUSTOMER` | — | trong `Phase1G/H/L` | **IDOR chặn đúng** (`OrderReadService.java:100` — 404, không leak) |
| Admin cập nhật payment-status | `OrderDetailScreen` | `PATCH /api/v1/admin/orders/{id}/payment-status` | `AdminOrderService.updatePaymentStatus` | orders, payments | Payment transition map | `orders.write` | audit, payment record | `Phase1HAdminOrderApiTest` ❌ **4 fail** | **PROD-01-A** — test cũ gửi `paidAmount≠total` |
| Admin refund đơn | `RefundDialog` | `POST /api/v1/admin/orders/{id}/refund` | `AdminOrderService` → `RefundService` | refund_transactions | Order→REFUNDED | `orders.refund` | serial restore, warranty void, receivable | `Phase1HAdminOrderApiTest` ❌ | Chỉ hỗ trợ full refund (chủ ý) — test cũ gửi partial |
| Công nợ — write-off | receivables screen | `POST /api/v1/admin/receivables/{id}/write-off` | `ReceivableService.writeOff` | accounts_receivable, orders | AR→WRITTEN_OFF | `receivables.write` | audit | `AdminReceivableApiTest` ❌ **1 fail** | **PROD-03** — order paymentStatus vẫn `UNPAID` (test mong `WRITTEN_OFF`) |
| POS bán hàng tại quầy | `PosScreen` | `POST /api/v1/admin/pos/orders` | `PosOrderService` | orders, payments, stock_movements | Order/Payment | `pos.sell` | stock−, payment, audit, WS, receivable | `Phase1MPosApiTest` ❌ **2 fail** | **PROD-04** — bán product có biến thể mà thiếu `productVariantId` → 200 (test mong 409) |
| Backend healthcheck (deploy) | Docker | `GET /actuator/health` | Spring Actuator | — | — | `permitAll` | — | — | **PROD-02** — bị `exclude=*` ẩn ở prod profile |

---

## 5. Findings

### [PROD-01] Bộ test backend FAIL — `mvn clean test` đỏ, CI gate đỏ

- **Severity:** P1
- **Category:** Testing
- **Status:** CONFIRMED
- **Evidence:**
  - `./mvnw clean test` (chạy trong audit này) → `Tests run: 1164, Failures: 7, Errors: 0, Skipped: 1` → `BUILD FAILURE`.
  - `docs/engineering/TESTING_GUIDE.md:18` — CI chạy `./mvnw -B clean verify` → `verify` bao gồm `test` → **CI đang đỏ**.
  - `docs/audits/BIGBIKE_LAUNCH_READINESS_SUMMARY.md:13,73` ghi "354 test PASS, 0 FAIL" — đó là 19 class chọn lọc, không phải toàn suite (1164 test).
  - 7 test fail: `Phase1HAdminOrderApiTest` (4), `Phase1MPosApiTest` (2), `AdminReceivableApiTest` (1) — đều thuộc nhóm order/payment/POS/công nợ, **không** nằm trong 19 class regression của báo cáo trước.

- **Problem:** Toàn bộ suite không xanh. 5/7 fail có nguyên nhân là **test cũ chưa cập nhật theo thay đổi production code** (xem PROD-01-A); 2/7 còn lại nghi ngờ bug thật (PROD-03, PROD-04). `git log`: `AdminOrderService.java` sửa lần cuối `2026-05-15 21:18` (commit 611f8e0), trong khi `Phase1HAdminOrderApiTest.java` sửa lần cuối `2026-05-15 18:02` (commit d96ac80) — **code đổi sau test, test không được cập nhật cùng PR**.

- **Impact:** (1) CI gate đỏ → không có pipeline deploy an toàn. (2) Suite có 7 fail "đã biết" → mất khả năng phát hiện regression mới — mọi tuyên bố "đã test" mất giá trị. (3) Báo cáo readiness trước over-claimed → quyết định launch dựa trên thông tin sai.

- **Recommended Fix:** Trước khi launch, xử lý từng test fail theo phân loại bên dưới. Với test cũ (PROD-01-A): cập nhật test cho khớp business rule mới (đã xác nhận rule là chủ ý). Với PROD-03/PROD-04: xác nhận với chủ shop/PM xem hành vi production hiện tại đúng hay sai, rồi sửa code *hoặc* test. Bổ sung quy tắc: PR đổi business rule phải cập nhật test cùng PR.

- **Safe To Auto Fix:** NO — phải xác nhận từng case là test-cũ hay bug-thật trước; vượt phạm vi "lỗi chắc chắn, phạm vi nhỏ".

---

### [PROD-01-A] 5 test fail do business rule đổi mà test không cập nhật

- **Severity:** P1 (thành phần của PROD-01)
- **Category:** Testing
- **Status:** CONFIRMED
- **Evidence:**
  - `AdminOrderService.java:424-429` — khi đặt `paymentStatus=PAID`: `if (paid.compareTo(order.getTotalAmount()) != 0) throw ValidationException ... "paidAmount phải bằng tổng đơn hàng"`. Đây là rule **chủ ý** (hardening từ Order E2E audit).
  - Test cũ vẫn gửi `paidAmount` lẻ ≠ total: `Phase1HAdminOrderApiTest.java:586` (`paidAmount:2000000`), `:607` (`1200000`), `:642` (`900000`) → bước `PATCH payment-status` trả **400** thay vì 200 → fail tại `.andExpect(status().isOk())` (line 588/609/644).
  - 4 test fail Phase1H (`createRefund_full`, `createRefund_partial_isRejected`, `createRefund_exceedsRefundable`, `refundReport_onlyFullRefund`) đều fail tại cùng bước setup PATCH payment-status, **chưa từng chạy tới phần refund**.
  - `Phase1MPosApiTest.posRefund_cashPartialRefund_isRejected_returns400:760` — `assertThat(order.getRefundAmount()).isNull()` fail vì giá trị là `0.00` (cột có default), không phải `null`. Refund partial vẫn bị từ chối đúng (400) — chỉ assertion về `null` là lỗi thời.

- **Problem:** Production code đã siết rule (PAID phải trả đủ tổng đơn; không hỗ trợ partial refund; `refundAmount` default `0.00`). Test phản ánh hành vi CŨ.

- **Impact:** Không phải bug production — nhưng giữ suite đỏ, che lấp regression thật.

- **Recommended Fix:** Cập nhật `Phase1HAdminOrderApiTest` (gửi `paidAmount` = tổng đơn) và `Phase1MPosApiTest` (assert `refundAmount` theo `0.00`/`compareTo(ZERO)`). Không đổi production code.

- **Safe To Auto Fix:** NO (audit phase) — nhưng đây là sửa test thuần, không đụng business rule/contract; an toàn cho Phase 1 sau khi user duyệt.

---

### [PROD-02] Actuator prod bị `exclude=*` đè — healthcheck đổ, web/admin không khởi động

- **Severity:** P1
- **Category:** Ops
- **Status:** CONFIRMED (hành vi Spring Boot tất định, có tài liệu)
- **Evidence:**
  - `bigbike-backend/src/main/resources/application-prod.properties:22-23`:
    ```
    management.endpoints.web.exposure.include=health,info,metrics,prometheus
    management.endpoints.web.exposure.exclude=*
    ```
  - Spring Boot: thuộc tính `exclude` **được ưu tiên hơn** `include`; `*` khớp mọi endpoint → khi cả hai cùng đặt, `exclude=*` loại bỏ **tất cả**, kể cả `health`.
  - `docker-compose.yaml` — backend healthcheck: `wget -qO- http://127.0.0.1:8080/actuator/health`; `bigbike-web` và `bigbike-admin` đều `depends_on: bigbike-backend: condition: service_healthy`.

- **Problem:** Ở profile `prod`, `/actuator/health` bị ẩn → healthcheck container backend luôn fail → backend không bao giờ `healthy` → `bigbike-web` và `bigbike-admin` **không bao giờ start**. Comment trong file ("expose health… — deny everything else") cho thấy ý định là chỉ phơi 4 endpoint — nhưng `include` đã làm việc đó; dòng `exclude=*` thừa và phá luôn cả 4.

- **Impact:** Toàn bộ stack không lên được khi deploy với profile `prod` qua docker-compose. Đây là blocker deploy tuyệt đối.

- **Recommended Fix:** Xoá dòng `management.endpoints.web.exposure.exclude=*` trong `application-prod.properties`. `include=health,info,metrics,prometheus` một mình đã đủ giới hạn đúng 4 endpoint.

- **Safe To Auto Fix:** YES — xoá 1 dòng config, không đổi business rule/contract/API. (Audit phase: ghi recommended fix; khuyến nghị thực thi ngay đầu Phase 1.)

---

### [PROD-03] Write-off công nợ không phản ánh sang `paymentStatus` của đơn

- **Severity:** P2
- **Category:** Business
- **Status:** NEEDS_CONFIRMATION
- **Evidence:**
  - `AdminReceivableApiTest.writeOff_updatesOrderPaymentStatusToWrittenOff:416` — `expected: "WRITTEN_OFF" but was: "UNPAID"`.
  - `ReceivableService.java:198` — `writeOff(...)` cập nhật `ReceivableEntity` (status → `WRITTEN_OFF`) nhưng (theo trace) không đặt `order.paymentStatus`.
  - `AdminOrderService.java:105-112` — `ALLOWED_PAYMENT_TRANSITIONS` **không có** trạng thái `WRITTEN_OFF`; không có transition nào dẫn vào nó.

- **Problem:** Sau write-off, công nợ ở `WRITTEN_OFF` nhưng đơn vẫn `UNPAID`. Hoặc (a) test phản ánh kỳ vọng đúng và đây là bug thiếu side-effect; hoặc (b) write-off chủ ý chỉ là khái niệm sổ công nợ, đơn giữ `UNPAID` — và test lỗi thời.

- **Impact:** Nếu (a): báo cáo doanh thu / trạng thái đơn không nhất quán với sổ công nợ — đơn đã xoá nợ vẫn hiện "chưa thanh toán". Nếu (b): chỉ là test sai.

- **Recommended Fix:** Hỏi chủ shop/kế toán: đơn được write-off công nợ nên hiển thị trạng thái thanh toán gì? Nếu cần `WRITTEN_OFF` trên đơn → thêm trạng thái vào enum + transition map + side-effect trong `ReceivableService.writeOff` (đổi state machine → cần `NEEDS_CONFIRMATION`). Nếu không → sửa test.

- **Safe To Auto Fix:** NO — có thể chạm state machine / business rule.

---

### [PROD-04] POS chấp nhận bán sản phẩm có biến thể mà không chọn biến thể

- **Severity:** P2
- **Category:** Business / Data Contract
- **Status:** NEEDS_CONFIRMATION
- **Evidence:**
  - `Phase1MPosApiTest.createPosOrder_missingVariantId_returns409:268` — tạo product *có* variant (`createProductWithVariant`), gửi POS order line chỉ có `productId` (không `productVariantId`) → `expected 409 but was 200`.
  - `PosOrderService.java:233` — `boolean isProductLevelSerial = item.productVariantId() == null || item.productVariantId().isBlank();` — khi thiếu `productVariantId`, code đi nhánh "product-level" (`:270` "Product-level non-serial managed stock") **mà không kiểm tra product đó có tồn tại variant hay không**.

- **Problem:** Một sản phẩm được tạo với biến thể vẫn bán được ở POS dưới dạng "product-level", trừ kho ở mức product thay vì mức variant. Nếu kho thực được quản lý ở mức variant, đơn POS này lấy/trừ nhầm tầng tồn kho.

- **Impact:** Sai lệch tồn kho khi nhân viên quầy quên chọn biến thể; serial/tracking ở mức variant bị bỏ qua. Mức độ phụ thuộc sản phẩm thực tế có dùng variant hay không.

- **Recommended Fix:** Xác nhận quy tắc nghiệp vụ: sản phẩm có ≥1 variant thì POS **bắt buộc** chọn variant. Nếu đúng → thêm guard trong `PosOrderService` (product có variant mà `productVariantId` trống → `ConflictException`). Nếu POS chủ ý hỗ trợ bán product-level cho product có variant → cập nhật test.

- **Safe To Auto Fix:** NO — chạm business rule POS / inventory.

---

### [DOC-PR-01] `DEPLOYMENT_GUIDE.md` ghi sai số migration & verdict readiness over-claimed

- **Severity:** P3
- **Category:** Docs (DOC_CODE_MISMATCH)
- **Status:** CONFIRMED
- **Evidence:**
  - `docs/engineering/DEPLOYMENT_GUIDE.md:23` — "Active Flyway migrations run through `V73`". Thực tế: migration cao nhất là **V119** (`db/migration/V119__*.sql`), 119 file.
  - `BIGBIKE_FULL_E2E_WORKFLOW_AUDIT.md:13` — ghi "**252 Flyway migration**". Thực tế: **119**.
  - `BIGBIKE_LAUNCH_READINESS_SUMMARY.md` verdict "✅ Launch được / 0 FAIL" cho backend — mâu thuẫn với `mvn clean test` đỏ (PROD-01).

- **Problem:** Docs deployment và audit readiness chứa số liệu lỗi thời/sai và verdict không phản ánh trạng thái suite thật.

- **Impact:** Người đọc tin hệ thống đã sẵn sàng trong khi CI đỏ; nhầm phạm vi migration khi vận hành DB.

- **Recommended Fix:** Cập nhật `DEPLOYMENT_GUIDE.md` (migration through V119); đính chính `BIGBIKE_LAUNCH_READINESS_SUMMARY.md` rằng "0 FAIL" chỉ đúng cho 19 class chọn lọc, không cho toàn suite.

- **Safe To Auto Fix:** YES (sửa docs) — nhưng để user quyết định cách đính chính báo cáo readiness trước.

---

### [SEC-01] Endpoint internal redirect `permitAll` — phụ thuộc bảo vệ tầng hạ tầng

- **Severity:** P3
- **Category:** Security
- **Status:** CONFIRMED (đã ghi nhận từ trước, không mới)
- **Evidence:** `SecurityConfig.java:97-99` — `GET /api/internal/redirect`, `/api/internal/redirects/active`, `POST /api/internal/redirects/hit/**` đều `permitAll`. `application.properties` có cơ chế `bigbike.internal.token` nhưng 3 endpoint này không bị filter token. `application-dev.properties` đặt `bigbike.internal.allow-open=true` (đúng — chỉ dev).
- **Problem:** 3 endpoint redirect mở công khai; comment trong code nói "lock down at infra layer (private network / IP allowlist) for prod".
- **Impact:** Thấp — không trả PII, chỉ phục vụ middleware `bigbike-web`. Nhưng `POST .../hit/**` cho phép bơm hit-counter từ ngoài nếu không chặn ở infra.
- **Recommended Fix:** Đảm bảo reverse proxy/firewall chặn `/api/internal/**` từ internet công cộng ở prod; hoặc gác bằng `X-Internal-Token`. Ghi rõ trong `DEPLOYMENT_GUIDE.md`.
- **Safe To Auto Fix:** NO — quyết định hạ tầng.

---

### [OPS-01] `.env` local chứa secret thật; compose mặc định profile `prod` nhưng `.env` ép `dev`

- **Severity:** P3
- **Category:** Ops
- **Status:** CONFIRMED
- **Evidence:**
  - `.env` **không** bị git track (`git ls-files` không khớp) và được `.gitignore` bao phủ — **đúng**.
  - Nhưng `.env` trên đĩa chứa credential thật: `BIGBIKE_MAIL_PASSWORD=jgwwnvcavlptrzid` (Gmail App Password), `BIGBIKE_JWT_SECRET=...`, `WEB_REVALIDATE_SECRET=...`.
  - `docker-compose.yaml` — `SPRING_PROFILES_ACTIVE: ${SPRING_PROFILES_ACTIVE:-prod}` (mặc định prod) nhưng `.env:SPRING_PROFILES_ACTIVE=dev` → chạy compose với `.env` hiện tại → backend chạy **profile dev** (seed data, `flyway.out-of-order=true`, cookie không Secure).

- **Problem:** (1) Secret thật nằm trong file local — rủi ro nếu máy dev bị lộ; nên dùng App Password riêng cho dev và xoay vòng. (2) Production deploy phải dùng `.env` khác (`SPRING_PROFILES_ACTIVE=prod` + JWT secret riêng) — không được tái dùng `.env` dev này.
- **Impact:** Nếu vô tình deploy với `.env` dev → backend chạy profile dev ở prod (insecure cookie, seed data).
- **Recommended Fix:** Tài liệu hoá rõ trong `DEPLOYMENT_GUIDE.md`: prod cần `.env` riêng với `SPRING_PROFILES_ACTIVE=prod`, JWT secret sinh mới, SMTP credential prod. Xoay vòng Gmail App Password đang dùng.
- **Safe To Auto Fix:** NO — quyết định vận hành.

---

## 6. Critical Launch Blockers

Chỉ liệt kê P0/P1 chặn production:

| Mã | Severity | Vấn đề | Trạng thái |
|---|---|---|---|
| PROD-01 | P1 | `mvn clean test` đỏ — 7/1164 fail → CI gate (`clean verify`) đỏ | CONFIRMED |
| PROD-02 | P1 | `application-prod.properties` `exclude=*` ẩn actuator health → healthcheck đổ → web/admin không start ở prod | CONFIRMED |

> **Không có P0** (mất tiền / bán âm kho / lỗ hổng bảo mật nghiêm trọng). Lõi locking/idempotency/RBAC/IDOR vững. Nhưng **2 P1 trên chặn launch tuyệt đối**: một làm CI/regression-net hỏng, một làm stack không deploy được với profile prod.

---

## 7. Recommended Fix Plan

### Phase 1 — Must fix before production
1. **PROD-02:** Xoá `management.endpoints.web.exposure.exclude=*` trong `application-prod.properties`. (1 dòng, an toàn.)
2. **PROD-01-A:** Cập nhật `Phase1HAdminOrderApiTest` (gửi `paidAmount` = tổng đơn) + `Phase1MPosApiTest` (assert `refundAmount` theo `0.00`). Sửa test thuần, không đụng business rule.
3. **PROD-03 / PROD-04:** Đưa cho chủ shop/PM 2 câu hỏi nghiệp vụ (write-off → trạng thái đơn; POS product có variant bắt buộc chọn variant?). Sau khi có verdict → sửa code *hoặc* test cho khớp.
4. Chạy lại `./mvnw clean verify` → xác nhận **xanh hoàn toàn** trước khi build image prod.

### Phase 2 — Should fix before public launch
- DOC-PR-01: cập nhật `DEPLOYMENT_GUIDE.md` (migration V119) + đính chính `BIGBIKE_LAUNCH_READINESS_SUMMARY.md`.
- SEC-01: chốt cách chặn `/api/internal/**` ở infra prod; ghi vào `DEPLOYMENT_GUIDE.md`.
- OPS-01: tài liệu hoá `.env` prod riêng biệt; xoay vòng Gmail App Password.
- Bổ sung CI: chặn merge nếu `clean verify` đỏ (nếu chưa có branch protection).

### Phase 3 — Hardening / optimization
- Test transition matrix cho state machine Order/Payment/Return/Product (`STATE_MACHINES.md §18` — vẫn `MISSING_TEST_COVERAGE`).
- Wire web/admin/mobile test vào CI (`TESTING_GUIDE.md` ghi nhận hiện không có).
- Đo N+1 / pagination / ISR / bundle size — chưa kiểm tra trong audit này.
- Trace file-upload validation `AdminMediaService` (content-type/magic-byte/path-traversal) — đánh dấu `UNKNOWN`.

---

## 8. Test Plan Needed

### Sửa test hiện có (Phase 1)
- `Phase1HAdminOrderApiTest` — `paidAmount` phải = tổng đơn ở mọi setup `PATCH payment-status → PAID`.
- `Phase1MPosApiTest` — assertion `refundAmount`; xác nhận lại kỳ vọng `createPosOrder_missingVariantId`.
- `AdminReceivableApiTest` — điều chỉnh sau khi PROD-03 có verdict.

### Unit test còn thiếu
- State transition matrix: Order / Payment / Fulfillment / Return / Product / Serial — test trực tiếp map transition + guard.
- `ReceivableService.writeOff` — side-effect lên đơn (theo verdict PROD-03).
- `PosOrderService` — nhánh product-level vs variant-level (theo verdict PROD-04).

### Integration / E2E test
- Checkout dưới tải đồng thời (race condition pessimistic lock — verify không bán âm kho).
- Idempotency: gửi lại cùng `idempotencyKey` → 1 đơn duy nhất.
- Refund unified: order/POS/return → refund ledger + serial restore + warranty void + receivable atomic.

### Security test
- IDOR: customer A gọi `/customer/orders/{B's id}` → 404 (đã trace đúng ở code, cần test cố định).
- Rate-limit: login > 5/min, register > 3/min → 429.
- Permission gate: role không có quyền gọi endpoint admin → 403.

### Smoke test production (sau deploy)
- `GET /actuator/health` trả `UP` (verify PROD-02 đã fix).
- Đặt 1 đơn thật → trừ kho, email, hiện trong admin.
- 1 đơn POS → kho trừ đúng tầng (variant), audit log có.

---

## 9. Final Verdict

**BigBike CHƯA production-ready.** Verdict: **`NOT_READY`** — vì lý do kỹ thuật, không phải vì lõi nghiệp vụ yếu.

- **Lõi thương mại** (catalog → cart → checkout → order → refund → POS → serial → công nợ) **thiết kế tốt và an toàn**: pessimistic locking chống bán âm kho, idempotency chống đơn trùng, RBAC đọc từ DB, IDOR chặn đúng (404 không leak), state machine + money rule enforce ở backend. Đây là kết quả thật, đã trace code.

- **Hai blocker P1 chặn launch:**
  1. **PROD-01** — `mvn clean test` đỏ (7/1164 fail). CI gate (`clean verify`) đỏ → không có pipeline deploy an toàn, không có lưới hồi quy đáng tin. Báo cáo `BIGBIKE_LAUNCH_READINESS_SUMMARY.md` tuyên bố "0 FAIL" dựa trên **19 class chọn lọc**, không phải toàn suite — verdict đó **không còn đúng**.
  2. **PROD-02** — config actuator prod (`exclude=*`) làm healthcheck đổ → `bigbike-web`/`bigbike-admin` không khởi động khi deploy profile `prod`.

- **Còn thiếu gì để ready:**
  - Đưa `clean verify` về xanh (sửa test cũ + xác nhận PROD-03/PROD-04 là bug hay test-drift).
  - Sửa 1 dòng config actuator.
  - Đính chính báo cáo readiness trước cho khớp sự thật.

- **Risk phải xử lý trước khi deploy thật:**
  - PROD-04: POS có thể trừ nhầm tầng tồn kho khi quên chọn biến thể — cần xác nhận nghiệp vụ.
  - PROD-03: write-off công nợ không đồng bộ trạng thái đơn — ảnh hưởng báo cáo doanh thu, cần xác nhận.
  - OPS-01: tuyệt đối không deploy prod bằng `.env` dev hiện tại.

**Khoảng cách tới production-ready là nhỏ và rõ ràng** — không có việc nào trong Phase 1 đụng business rule (trừ 2 mục `NEEDS_CONFIRMATION` cần verdict nghiệp vụ trước). Sau khi `clean verify` xanh và PROD-02 được sửa, hệ thống có thể tái đánh giá là `READY`.

---

## Phụ lục — Phân loại doc-vs-code

| Loại | Mục |
|---|---|
| **DOC_CODE_MISMATCH** | `DEPLOYMENT_GUIDE.md` "migrations through V73" (thật: V119); `BIGBIKE_FULL_E2E` "252 migration" (thật: 119); `BIGBIKE_LAUNCH_READINESS_SUMMARY.md` "0 FAIL" (thật: 7 fail toàn suite). |
| **DOC_GAP** | `DEPLOYMENT_GUIDE.md` không nêu rủi ro deploy nhầm profile `dev`; không tài liệu hoá việc chặn `/api/internal/**` ở infra. |
| **IMPLEMENTATION_GAP** | Không phát hiện rule trong docs mà code thiếu (trong phạm vi đã trace). PROD-03/PROD-04 là vùng *cần xác nhận* docs có quy định hay không. |

*Audit này không sửa code. Mọi recommended fix ở trạng thái đề xuất; PROD-01-A và PROD-02 an toàn để thực thi ở Phase 1 sau khi user duyệt.*
