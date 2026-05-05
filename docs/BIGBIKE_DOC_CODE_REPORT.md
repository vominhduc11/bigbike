# BigBike — Báo Cáo Đối Chiếu Docs vs Source Code

**Ngày tạo:** 2026-05-05  
**Cập nhật:** 2026-05-05 — re-verified enum values và risk wording (xem Section 3 M1, Section 5 P1/P2/P3, Section 6 Risk Map)  
**Phạm vi:** Toàn bộ `docs/business/` + `docs/engineering/` đối chiếu với source code hiện tại  
**Phương pháp:** Read-only inspection — không chạy build/test/deploy; chỉ đọc file, glob, grep  
**Dựa trên:** `docs/DOCS_VERIFICATION_REPORT.md` (audit 2026-05-04) + inspection độc lập 2026-05-05

---

## Tóm Tắt Tổng Quan

| Hạng mục | Kết quả |
|---|---|
| Tổng file docs đã đối chiếu | **19** (9 business + 9 engineering + 1 verification report) |
| Docs khớp với code | **17/19** (>89%) |
| Docs có mismatch minor (đã patch) | **2** (M1, M2). M1 đã re-patch 2026-05-05 vì 2026-05-04 patch chỉ list 4 giá trị/enum, thiếu `EXPIRED` (CartStatus) và `REFUNDED` (PaymentRecordStatus) |
| Docs thiếu (code có, docs không) | **7 item** |
| Docs sai/outdated | **2 item minor** (chưa ảnh hưởng nghiêm trọng) |
| Module chưa có documentation | **5 module/feature** |
| Bug code được docs flag đúng | **2 bug code thực sự** (~~BUG-001~~ FIXED 2026-05-05, BUG-004 outstanding) + **2 risk phụ thuộc deploy/ops** (BUG-002, BUG-003) — re-classified 2026-05-05 |
| Trạng thái tổng thể | **`READY_FOR_AGENT_IMPLEMENTATION`** với điều kiện kèm theo |

---

## 1. Docs Đúng Với Code

Toàn bộ 19 file docs đều dùng convention status label nhất quán (`CONFIRMED_FROM_CODE`, `NEEDS_VERIFICATION`, `NOT_FOUND_IN_REPO`, `CONFLICTING_EVIDENCE`) và gắn evidence path thực tế. Đây là chất lượng docs tốt cho audit tự động.

### 1.1 docs/business/ — 9/9 files khớp

| File | Verdict | Nội dung chính đã verify |
|---|---|---|
| `PROJECT_OVERVIEW.md` | ✅ MATCHED | Tech stack (Next.js 16.2.4, Spring Boot 4.0.5, Flutter Dart ^3.11.4), actor map, 5 component chính, capabilities đều khớp code thực tế. |
| `MODULE_CATALOG.md` | ✅ MATCHED | 41 controller backend, ~30 admin screen, mobile router — đều có evidence. Module status labels được gán chính xác. |
| `USER_ROLES.md` | ✅ MATCHED | 7 role kỹ thuật theo `AdminRolePermissions.MAP`; `STAFF` là umbrella term — ghi đúng. |
| `BUSINESS_PROCESS.md` | ✅ MATCHED | Process map có evidence trỏ đúng service/controller. |
| `BUSINESS_RULES.md` | ✅ MATCHED | 30+ rule (PRODUCT_RULE, ORDER_RULE, PAYMENT_RULE, INVENTORY_RULE, RETURN_RULE) có evidence trỏ đúng service. |
| `WORKFLOW_OVERVIEW.md` | ✅ MATCHED | Workflow đầy đủ, status enum khớp. |
| `STATE_MACHINES.md` | ✅ MATCHED | Enum values khớp; transition map có evidence `AdminOrderService`/`CheckoutService`. |
| `ACCEPTANCE_CRITERIA.md` | ✅ MATCHED | DoD measurable, gắn module/file evidence. |
| `GLOSSARY.md` | ✅ MATCHED | Không bịa term không tồn tại trong code. |

### 1.2 docs/engineering/ — 8/9 files khớp (2 sau patch nhỏ)

| File | Verdict | Ghi chú |
|---|---|---|
| `ARCHITECTURE.md` | ✅ MATCHED | Tech stack, layer, integration, Mermaid diagram — đều phản ánh đúng docker-compose.yaml và pom.xml. |
| `API_CONTRACT.md` | 🟡 MATCHED (after M2 patch) | Endpoint match controller; note về mobile API client đã được patch (api_client.dart, api_endpoints.dart, api_exception.dart tồn tại). |
| `DATA_CONTRACT.md` | 🟡 MATCHED (after M1 re-patch 2026-05-05) | Field map đúng; CartStatus (`ACTIVE, MERGED, ABANDONED, CONVERTED, EXPIRED` — 5 values) và PaymentRecordStatus (`PENDING, SUCCEEDED, FAILED, CANCELLED, REFUNDED` — 5 values) đã được cập nhật từ `NEEDS_VERIFICATION` → `CONFIRMED_FROM_CODE`. Patch ban đầu 2026-05-04 list 4 values mỗi enum, thiếu `EXPIRED` và `REFUNDED`; đã sửa lại đầy đủ. |
| `API_FLOW_MAP.md` | ✅ MATCHED | End-to-end flow khớp controller + service. |
| `PERMISSION_MATRIX.md` | ✅ MATCHED | Khớp 100% với `AdminRolePermissions.MAP` + SecurityConfig + `requirePermission` calls. |
| `TESTING_GUIDE.md` | ✅ MATCHED | Khớp `.github/workflows/ci.yml`; script trong package.json đã verify. CI web/admin chạy lint+build nhưng không run test — đã ghi đúng. |
| `DEPLOYMENT_GUIDE.md` | ✅ MATCHED | Khớp docker-compose.yaml; env table đầy đủ; 58 Flyway migrations đã verify (V1–V58). |
| `INTEGRATION_GUIDE.md` | ✅ MATCHED | SePay status `CONFIG_ONLY` đã verify đúng (không có controller/service code — chỉ V44–V47 DB schema). |
| `TRACEABILITY_MATRIX.md` | ✅ MATCHED | Cross-link nhất quán với các docs khác. |

### 1.3 DOCS_VERIFICATION_REPORT.md

File này đã được thực hiện bởi audit kỹ thuật ngày 2026-05-04, đúng chất lượng và verdict `READY_FOR_AGENT_IMPLEMENTATION` là hợp lý.

---

## 2. Docs Còn Thiếu (Code Có, Docs Không)

Các item dưới đây đã xác nhận tồn tại trong code nhưng chưa được document đầy đủ.

### Item C1 — Mobile API Endpoint Mapping Chi Tiết

- **Code:** `bigbike_mobile/lib/core/api/api_endpoints.dart`, `api_client.dart`, `api_exception.dart` — tồn tại đầy đủ
- **Docs hiện tại:** `API_CONTRACT.md` Section 9 ghi là `NEEDS_VERIFICATION` cho mobile mapping. `API_FLOW_MAP.md` và `TRACEABILITY_MATRIX.md` nhắc tên file nhưng không liệt kê endpoint detail.
- **Mức độ ảnh hưởng:** Low — không gây mismatch, chỉ là gap về độ phủ.
- **Đề xuất:** Audit `api_endpoints.dart` và bổ sung "Mobile API Client Mapping" vào `API_CONTRACT.md`.

### Item C2 — `docs/DECISIONS.md` Bị Reference Nhưng Không Tồn Tại

- **Code:** `AGENTS.md` và `README.md` cùng reference `docs/DECISIONS.md` như ADR (Architecture Decision Records).
- **Docs hiện tại:** File này không tìm thấy trong repo. `PROJECT_OVERVIEW.md` Section 10 đã ghi nhận là `NEEDS_VERIFICATION`.
- **Mức độ ảnh hưởng:** Medium — AI agent và developer mới có thể bị mất context về các quyết định kiến trúc quan trọng.
- **Đề xuất:** Tạo file `docs/DECISIONS.md` ghi lại các quyết định chính: chọn Spring Boot 4, Next.js App Router, Flutter companion, Flyway migration strategy, manual payment flow (COD/BACS), deferred coupon-cart integration.

### Item C3 — `CouponExpiryScheduler` Chưa Được Document

- **Code:** `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/coupon/CouponExpiryScheduler.java` — tồn tại
- **Docs hiện tại:** `MODULE_CATALOG.md` ghi coupon module nhưng không nhắc scheduled job.
- **Mức độ ảnh hưởng:** Low — scheduled job tự động expire coupon, nếu không biết có thể debug khó.
- **Đề xuất:** Bổ sung note vào `MODULE_CATALOG.md` Section "Settings/Menus/Coupons" về coupon expiry scheduler.

### Item C4 — `PosExpiredOrderCleanupJob` Chưa Được Document

- **Code:** `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosExpiredOrderCleanupJob.java` — tồn tại
- **Docs hiện tại:** POS module trong `MODULE_CATALOG.md` ghi `PARTIAL`, không nhắc cleanup job.
- **Mức độ ảnh hưởng:** Low — nhưng quan trọng cho vận hành POS để hiểu order lifecycle.
- **Đề xuất:** Bổ sung vào doc POS module.

### Item C5 — Stock Receipt Feature (V52/V53/V55 Migrations)

- **Code:** Migration V52 (`add_stock_receipts`), V53 (`add_stock_receipt_lines`), V55 (`add_receipt_serials`) — tồn tại; code có serial tracking được thêm, bỏ (V54: `remove_serial_tracking`), rồi thêm lại qua stock movement serials (V57).
- **Docs hiện tại:** `MODULE_CATALOG.md` nhắc `StockMovementSerialEntity` nhưng không có mục riêng cho Stock Receipt workflow. Serial flow ghi `INFERRED_FROM_STRUCTURE`.
- **Mức độ ảnh hưởng:** Medium — inventory workflow không rõ ràng cho developer/agent.
- **Đề xuất:** Bổ sung mục "Stock Receipts" vào `MODULE_CATALOG.md` Backend Inventory section.

### Item C6 — `VnAddressService` Chưa Được Document

- **Code:** `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/address/VnAddressService.java` — tồn tại; `bigbike-web/lib/vn-address-data.ts` cũng tồn tại.
- **Docs hiện tại:** Không có reference về Vietnamese address resolution service trong bất kỳ doc nào.
- **Mức độ ảnh hưởng:** Low-Medium — checkout địa chỉ Việt Nam quan trọng cho UX.
- **Đề xuất:** Mention trong `MODULE_CATALOG.md` Section Checkout hoặc cross-cutting.

### Item C7 — `HealthController` Trong Package Cũ

- **Code:** `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/controller/HealthController.java` — controller `GET /actuator/health` ngoài package `api/**`.
- **Docs hiện tại:** `ARCHITECTURE.md` chỉ nói về layer `api/**`. `DOCS_VERIFICATION_REPORT.md` đã flag nhưng đánh giá là Very Low.
- **Mức độ ảnh hưởng:** Very Low — không gây mismatch nghiệp vụ. Spring Boot `actuator/health` endpoint chính thức cũng tồn tại.
- **Đề xuất:** Inline-merge vào `api/health/` khi có cơ hội.

---

## 3. Docs Sai Hoặc Outdated

### Mismatch M1 — CartStatus và PaymentRecordStatus (ĐÃ RE-PATCH 2026-05-05)

- **File:** `docs/engineering/DATA_CONTRACT.md` (Section 7, 13, 18, 22)
- **Docs cũ (pre-2026-05-04):** CartStatus `NEEDS_VERIFICATION`, PaymentRecordStatus `NEEDS_VERIFICATION`
- **Patch 2026-05-04 (chưa đầy đủ):** CartStatus: `ACTIVE, MERGED, ABANDONED, CONVERTED` (4 values — thiếu `EXPIRED`); PaymentRecordStatus: `PENDING, SUCCEEDED, FAILED, CANCELLED` (4 values — thiếu `REFUNDED`).
- **Thực tế code (5 giá trị mỗi enum):**
  - `CartStatus`: `ACTIVE, MERGED, ABANDONED, CONVERTED, EXPIRED` — [`bigbike-backend/.../CartStatus.java`](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/domain/commerce/CartStatus.java)
  - `PaymentRecordStatus`: `PENDING, SUCCEEDED, FAILED, CANCELLED, REFUNDED` — [`bigbike-backend/.../PaymentRecordStatus.java`](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/domain/commerce/PaymentRecordStatus.java)
- **Trạng thái:** **RE-PATCHED 2026-05-05** → DATA_CONTRACT.md Section 7/13/18/22 đều liệt kê đủ 5 giá trị, status `CONFIRMED_FROM_CODE`, evidence path đầy đủ. DOCS_VERIFICATION_REPORT.md Section 3.2 và Section 8 đã được cập nhật để ghi rõ patch ban đầu thiếu `EXPIRED`/`REFUNDED`.

### Mismatch M2 — Mobile API Client "Not Found" (ĐÃ PATCH)

- **File:** `docs/engineering/API_CONTRACT.md`
- **Docs cũ:** "Dart API client not found by repository search"
- **Thực tế code:** `api_client.dart`, `api_endpoints.dart`, `api_exception.dart` đều tồn tại
- **Trạng thái:** **ĐÃ SỬA** trong audit 2026-05-04 → note đã được cập nhật, per-endpoint mapping vẫn `NEEDS_VERIFICATION`

### Mismatch D1 — Design System References Next.js 15 (Chưa patch)

- **File:** `Bigbike Design System/README.md`
- **Docs nói:** Next.js 15
- **Thực tế code:** `bigbike-web/package.json` → Next.js **16.2.4**
- **Mức độ:** Low — design system README không phải engineering doc, nhưng gây nhầm lẫn cho developer mới.
- **Đề xuất:** Update Design System README để phản ánh phiên bản đúng.

### Mismatch D2 — `DevAdminAuthService` còn tồn tại (có guard, risk phụ thuộc profile config)

- **File:** [`bigbike-backend/.../DevAdminAuthService.java`](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/DevAdminAuthService.java); docs liên quan: `docs/engineering/PERMISSION_MATRIX.md` Section 9 + `PROJECT_OVERVIEW.md`.
- **Thực tế code (re-verified 2026-05-05):**
  - Service vẫn tồn tại trong service layer.
  - `ensureDevMockProfile()` (line 93–111) explicit ném `AuthNotImplementedException` khi `SPRING_PROFILES_ACTIVE` chứa `prod`/`production`, hoặc khi không chứa `dev`/`mock`/`test`/`local`.
  - `requirePermission()` (line 61–86) ưu tiên JWT principal trước; chỉ fallback header-bypass khi không có JWT — và fallback đó cũng đi qua `ensureDevMockProfile()`.
  - Kết luận: code **KHÔNG** mặc định bypass auth ở production; nó chỉ bypass khi active profile thuộc dev/mock set.
- **Mức độ:** **Medium** — risk còn lại là nếu deploy production với `SPRING_PROFILES_ACTIVE` sai (e.g. `dev` thay vì `prod`), không phải bypass mặc định.
- **Đề xuất:**
  - Đảm bảo production deploy luôn dùng profile `prod`/`production` (xem [docker-compose.yaml](docker-compose.yaml) — default `SPRING_PROFILES_ACTIVE: prod`).
  - Cân nhắc thêm `@Profile("!prod")` annotation ở bean level cho hard guard, ngay cả khi profile config bị sai.

---

## 4. Module Chưa Có Documentation

| Module / Feature | Tình trạng trong Docs | Code Evidence | Ưu tiên |
|---|---|---|---|
| **POS Full Workflow** | `PARTIAL (doc only)` — code đã đầy đủ; doc chưa mô tả lifecycle | `AdminPosController.java`, `PosOrderService.java`, `PosExpiredOrderCleanupJob.java`, test `Phase1MPosApiTest.java` | P2 |
| **Stock Receipt Management** | `INFERRED_FROM_STRUCTURE` — serial tracking | V52, V53, V55 migrations; service references | P2 |
| **Customer Return Flow (Frontend)** | `NEEDS_VERIFICATION` — admin side rõ, customer không | `CustomerReturnService.java`; mobile có `returns_screen.dart`, `create_return_screen.dart` | P1 |
| **WebSocket STOMP Event Contract** | `NEEDS_VERIFICATION` — tồn tại nhưng chưa document topic/event | `AdminOrderWsService.java`, `WebSocketConfig.java`, `OrderWsEvent.java` | P2 |
| **Coupon Expiry + POS Cleanup Scheduler** | Không có mention trong module docs | `CouponExpiryScheduler.java`, `PosExpiredOrderCleanupJob.java` | P3 |
| **Vietnamese Address Service** | Không mention | `VnAddressService.java`, `bigbike-web/lib/vn-address-data.ts` | P3 |
| **Architecture Decision Records (ADR)** | Referenced nhưng không tồn tại | `docs/DECISIONS.md` không tìm thấy | P2 |

---

## 5. Danh Sách Task Ưu Tiên Để Hoàn Thiện Dự Án

### Priority 1 — BUG / SECURITY (Fix ngay trước production)

| Task | Mô tả | File liên quan |
|---|---|---|
| ~~**BUG-001**~~ Fix email verification — **RESOLVED 2026-05-05** | `POST /api/v1/customer/auth/verify-email` đã được thêm vào SecurityConfig `permitAll` (line 64), bên cạnh GET legacy (line 63). Email verification flow từ frontend hoạt động. | `SecurityConfig.java:63-64`, `CustomerAuthController.java:65`, `bigbike-web/app/xac-nhan-email/page.tsx:24-25` |
| **BUG-004** Lock `internal/redirect` bằng infra | `/api/internal/redirect*` `permitAll` ở app layer nhưng comment trong code nói "should lock by infra/IP allowlist". Repo không có nginx/firewall config → endpoint này public theo mặc định. | `SecurityConfig.java:94-96`, nginx/infra config (out-of-repo) |

### Priority 2 — RISK CẦN XÁC MINH PRODUCTION (Medium — code đã có guard nhưng phụ thuộc deploy/ops)

| Task | Mô tả | File liên quan |
|---|---|---|
| **BUG-002** Verify production Spring profile + (optional) hard guard `DevAdminAuthService` | `DevAdminAuthService` còn tồn tại **nhưng** đã có `ensureDevMockProfile()` chặn `prod`/`production` (line 93-111). Risk còn lại là nếu deploy với `SPRING_PROFILES_ACTIVE` sai (e.g. `dev` ở prod env). docker-compose default là `prod`. Khuyến nghị: thêm `@Profile("!prod")` annotation cho hard guard ở bean level. | `DevAdminAuthService.java:25-26,36,93-111`, `docker-compose.yaml:68` |
| **BUG-003** Audit WebSocket STOMP per-subscribe authorization | `/ws/**` `permitAll` ở HTTP handshake layer (line 100). STOMP CONNECT interceptor (line 56-91 in `WebSocketConfig.java`) **CÓ** validate `Authorization: Bearer`, parse JWT qua `JwtService.parseAccessToken`, và reject nếu role không phải `ADMIN`/`SUPER_ADMIN`. Gap còn lại: per-subscribe topic-level authorization nếu cần fine-grained security (ví dụ: chặn 1 admin subscribe topic của admin khác). | `WebSocketConfig.java:56-91`, `SecurityConfig.java:100` |

### Priority 3 — OPS/DOCUMENTATION CHECK (Low — current repo config đã safe; cần ops awareness)

| Task | Mô tả | File liên quan |
|---|---|---|
| **OPS-005** Maintain `VITE_USE_ADMIN_MOCK=false` discipline | Repo config hiện tại đã hardcode `"false"` ở cả [docker-compose.yaml:164](docker-compose.yaml#L164) và [.github/workflows/ci.yml:118](.github/workflows/ci.yml#L118). Risk còn lại: local override hoặc production build path khác ngoài CI hiện tại (e.g. ai đó build admin Docker image bằng tay với arg khác). Mức độ: Low / documentation note. | `docker-compose.yaml:164`, `.github/workflows/ci.yml:118` |

### Priority 4 — CHỨC NĂNG CÒN THIẾU (Business critical)

| Task | Mô tả | Status hiện tại |
|---|---|---|
| **FEAT-001** External payment gateway | Hệ thống chỉ có COD/BACS/manual. Không có online payment webhook. SePay chỉ có DB schema (V44–V47), không có controller/service. | `NOT_FOUND_IN_REPO` |
| **FEAT-002** External shipping carrier integration | Không có GHN/GHTK/ViettelPost. Admin shipping chỉ là internal zones/methods. | `NOT_FOUND_IN_REPO` |
| **FEAT-003** Coupon-cart/checkout integration | Phase 1J report nói deferred, nhưng `CheckoutService` có ghi cart coupon vào order và increment usage. Cần test/runtime verification để xác nhận coupon application hoạt động end-to-end. | `PARTIAL` / drift |
| **FEAT-004** Customer return flow completeness | Mobile có `returns_screen.dart` và `create_return_screen.dart`. Backend có `CustomerReturnService.java`. Cần audit đầy đủ flow: customer tạo return → admin process → refund. | `NEEDS_VERIFICATION` |
| **FEAT-005** Customer session cleanup job | `PHASE_1D_CUSTOMER_AUTH_REPORT.md` ghi nhận không có session cleanup job. Sessions expired sẽ tích lũy trong DB. | `NEEDS_VERIFICATION` |
| **FEAT-006** POS workflow documentation completion | POS code có **đủ**: [`AdminPosController.java`](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminPosController.java), [`PosOrderService.java`](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java), [`PosExpiredOrderCleanupJob.java`](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosExpiredOrderCleanupJob.java), test [`Phase1MPosApiTest.java`](bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1MPosApiTest.java). Documentation/business workflow vẫn `PARTIAL` vì `MODULE_CATALOG.md` chưa mô tả đầy đủ lifecycle (create draft order → reserve stock → finalize → expire cleanup). | `PARTIAL (doc only)` |

### Priority 5 — DOCUMENTATION GAPS (Cần bổ sung trước khi thêm feature mới)

| Task | Mô tả | File cần tạo/sửa |
|---|---|---|
| **DOC-001** Tạo `docs/DECISIONS.md` | ADR cho các quyết định kiến trúc: Spring Boot 4, Next.js App Router, Flutter companion scope, Flyway strategy, payment model, deferred items. | `docs/DECISIONS.md` (mới) |
| **DOC-002** Document Mobile API endpoint mapping | Audit `bigbike_mobile/lib/core/api/api_endpoints.dart` và bổ sung vào `API_CONTRACT.md` Section 9. | `docs/engineering/API_CONTRACT.md` |
| **DOC-003** Document POS module | Bổ sung POS workflow, `PosOrderService`, `PosExpiredOrderCleanupJob` vào `MODULE_CATALOG.md`. | `docs/business/MODULE_CATALOG.md` |
| **DOC-004** Document Stock Receipt feature | Bổ sung mục Stock Receipts (V52/V53/V55 migrations) vào `MODULE_CATALOG.md` Backend Inventory section. | `docs/business/MODULE_CATALOG.md` |
| **DOC-005** Document WebSocket STOMP event contract | Audit `AdminOrderWsService`, `OrderWsEvent`, `WebSocketConfig` và tạo section riêng trong `ARCHITECTURE.md` hoặc `API_CONTRACT.md`. | `docs/engineering/ARCHITECTURE.md` |
| **DOC-006** Document VnAddressService và Vietnamese address | Mention trong `MODULE_CATALOG.md` Checkout section hoặc cross-cutting. | `docs/business/MODULE_CATALOG.md` |
| **DOC-007** Fix Design System README Next.js version | Update `Bigbike Design System/README.md` từ Next.js 15 → Next.js 16.2.4. | `Bigbike Design System/README.md` |
| **DOC-008** Document CouponExpiryScheduler | Bổ sung vào coupon module trong `MODULE_CATALOG.md`. | `docs/business/MODULE_CATALOG.md` |

### Priority 6 — QUALITY GATES / CI (Cần trước release)

| Task | Mô tả | Trạng thái |
|---|---|---|
| **QA-001** Wire Vitest vào CI cho `bigbike-web` | Script `npm run test` tồn tại nhưng CI không chạy. Cần thêm step vào `.github/workflows/ci.yml`. | `CONFIRMED_SCRIPT` nhưng CI không wire |
| **QA-002** Thêm test suite cho `bigbike-admin` | Không có `test` script trong `bigbike-admin/package.json`. Cần thêm Vitest/RTL. | `NOT_FOUND_IN_REPO` |
| **QA-003** Thêm Flutter CI/CD pipeline | `flutter_test` dependency có nhưng không có CI job. Cần `flutter test` + `flutter analyze` trong CI. | `RECOMMENDED_NOT_IMPLEMENTED` |
| **QA-004** E2E/smoke test automation | README có smoke checklist nhưng không có Playwright/Cypress/E2E script. | `NOT_FOUND_IN_REPO` |
| **QA-005** Database backup automation | Không có script backup PostgreSQL. Production cần postgres dump cron hoặc managed backup. | `NOT_FOUND_IN_REPO` |
| **QA-006** Production monitoring stack | Backend expose Prometheus actuator endpoint nhưng không có Prometheus/Grafana/Loki trong infra. | `OUT_OF_REPO_DEPLOYMENT` |
| **QA-007** Production TLS/reverse proxy config | Không có Nginx/Traefik/Caddy edge config trong repo. Production cần TLS termination + vhost routing. | `OUT_OF_REPO_DEPLOYMENT` |

---

## 6. Tổng Hợp Risk Map

```
HIGH RISK (Fix ngay — bug code thực sự)
├── ~~BUG-001~~: verify-email POST permitAll — RESOLVED 2026-05-05 (SecurityConfig.java:64)
├── BUG-004: /api/internal/redirect* permitAll, không có infra lock trong repo
└── FEAT-001: No online payment gateway → business limitation

MEDIUM RISK (Xử lý trước launch — code có guard, phụ thuộc deploy/ops)
├── BUG-002: DevAdminAuthService — code có ensureDevMockProfile() chặn prod;
│           risk chỉ phát sinh khi SPRING_PROFILES_ACTIVE bị set sai. 
│           Cân nhắc thêm @Profile("!prod") cho hard guard.
├── BUG-003: WebSocket STOMP CONNECT-time auth ĐÃ verified (JWT + role check). 
│           Gap còn lại là per-subscribe topic-level authorization.
├── FEAT-002: No carrier integration → manual fulfillment only
├── FEAT-003: Coupon-cart drift → checkout discount uncertainty (CheckoutService 
│           có ghi coupon + increment usage; cần runtime verify)
├── FEAT-004: Customer return flow incomplete
└── QA-001~004: CI/test gaps → regression risk

LOW RISK (Backlog / ops awareness)
├── OPS-005: VITE_USE_ADMIN_MOCK đã hardcode "false" trong docker-compose + CI; 
│           ops cần duy trì kỷ luật khi build path khác CI hiện tại
├── DOC-001~008: Documentation gaps
├── FEAT-005: Session cleanup job missing
├── QA-005~007: Infra automation
└── Item C2~C7: Minor missing docs
```

---

## 7. Điều Kiện Để Sử Dụng Docs Cho Agent Implementation

Docs hiện tại **đủ chất lượng** để AI agent tiếp tục implement với các điều kiện:

1. **Agent vẫn cross-check field cụ thể** trong `DATA_CONTRACT.md` khi triển khai mutation, đặc biệt drift giữa backend canonical name và admin normalizer (`lineItems→items`, `subtotalAmount→subtotal`, v.v.).
2. **Agent không tự "fix"** các mismatch đã được flag là `CONFLICTING_EVIDENCE` (ví dụ verify-email GET vs POST) trong cùng task khác — đây là bug code cần backend fix riêng.
3. **Dev/DevOps phải verify runtime** các phần `NEEDS_VERIFICATION` trước release gate: WebSocket STOMP auth, customer CSRF coverage, email delivery, sitemap/robots, SEO redirect coverage, POS workflow.
4. **Tin docs hơn memory cũ** — memory file cũ về SePay webhook controller/service không còn đúng; docs phản ánh trạng thái mới hơn (`CONFIG_ONLY`).
5. **Mobile tasks** cần audit thêm `api_client.dart` + `api_endpoints.dart` trước khi ra quyết định.

---

## 8. Evidence Index

| Nhóm | File đã verify | Confidence |
|---|---|---|
| Backend API layer | `bigbike-backend/src/main/java/.../api/**` (41+ controllers, DTOs) | High |
| Backend service layer | `bigbike-backend/src/main/java/.../service/**` (60+ services) | High |
| Backend DB migrations | V1–V58 (58 migration files đã đếm thực tế) | High |
| Public web | `bigbike-web/lib/**`, `bigbike-web/app/page.tsx` | High |
| Admin frontend | `bigbike-admin/src/lib/adminApi.js`, `bigbike-admin/README.md` | High |
| Mobile | `bigbike_mobile/lib/core/api/*.dart`, `bigbike_mobile/lib/features/**` (35 files) | High |
| CI/CD | `.github/workflows/ci.yml` | High |
| Infrastructure | `docker-compose.yaml`, `bigbike-backend/pom.xml` | High |
| Docs | 19 file trong `docs/business/` + `docs/engineering/` | High |

---

*Report này được tạo bằng read-only inspection. Không chạy build/test/deploy. Không sửa source code application.*
