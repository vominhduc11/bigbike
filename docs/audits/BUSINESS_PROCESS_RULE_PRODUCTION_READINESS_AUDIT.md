# BUSINESS PROCESS & RULE — PRODUCTION READINESS AUDIT

> **Audit date:** 2026-05-08
> **Auditor:** Senior Business Analyst + Solution Architect + QA Auditor (read-only)
> **Scope:** Toàn bộ business process / business rule của BigBike đối chiếu với canonical docs, engineering docs, source code (`bigbike-backend`, `bigbike-admin`, `bigbike-web`, `bigbike_mobile`), Flyway migrations, test suites, runtime config, và thực tế vận hành e-commerce / POS / công nợ tại Việt Nam.
> **Method:** Read-only inspection (file listing, glob, grep, file reads). Không build, không test, không deploy, không sửa source code application. Reuse evidence từ `PRODUCTION_READINESS_GATE.md` (cycle 10, 2026-05-08, build-evidence: 1016/1017 tests pass) và `E2E_WORKFLOW_MASTER_INVENTORY.md` (2026-05-07) khi đã được spot-check chéo với code.
> **Report id:** `BUSINESS_PROCESS_RULE_PRODUCTION_READINESS_AUDIT-2026-05-08`

---

## 1. Executive Summary

### 1.1 Verdict tổng thể

| Câu hỏi | Verdict |
|---|---|
| **Đủ để code tiếp bằng AI agent chưa?** | ✅ `READY_FOR_AGENT_IMPLEMENTATION`. Docs canonical + audit trail đủ chi tiết, status label nhất quán, evidence path đầy đủ. (Đồng ý với verdict trong `DOCS_VERIFICATION_REPORT.md`.) |
| **Đủ để staging / UAT chưa?** | 🟡 `CONDITIONAL_GO_FOR_STAGING`. Backend test suite 1016/1017 pass, code path business chính đầy đủ. Trước khi UAT cần: (a) seed first SUPER_ADMIN; (b) staging env config đủ (JWT secret, internal token, revalidate); (c) verify một workflow chuyển khoản BACS vận hành thật bằng người trả tiền + admin reconcile thủ công; (d) email SMTP staging deliverability test. |
| **Đủ để production / vận hành thật chưa?** | ❌ `NOT_READY_FOR_PRODUCTION`. Còn **15 production blocker** ở Section 7 — chia 3 nhóm: **Operational reality** (invoice / e-invoice / shipping carrier / payment reconciliation flow / customer support / refund history / serial-warranty), **Legal / compliance** (Bộ Công Thương đăng ký / TMĐT, privacy policy nội dung, terms, return-refund policy nội dung, complaint handling), **Infra / config** (5 PROD_CONFIG đã được `PRODUCTION_READINESS_GATE.md` flag). |

### 1.2 Top 5 production blockers

| # | Blocker | Type | Tác động |
|---|---|---|---|
| 1 | **Invoice / hóa đơn điện tử**: Không có `invoice` entity, không có service xuất hóa đơn sau checkout/POS, không có integration với e-invoice provider (VNPT / Misa / Easyinvoice / Viettel SInvoice). | `NOT_FOUND_IN_REPO` | Vi phạm Nghị định 123/2020/NĐ-CP về hóa đơn điện tử bắt buộc. Bán B2B/B2C không xuất được hóa đơn hợp lệ. |
| 2 | **External payment reconciliation**: Online checkout chỉ có `COD` và `BACS` (chuyển khoản thủ công, provider `INTERNAL`). Không có VNPAY / MoMo / SePay webhook auto-reconciliation. Bank-transfer phải đối soát tay. | `NOT_FOUND_IN_REPO` (online provider) | Khách chuyển khoản → admin phải tay update payment status. Lỗi do người làm tay. Không có signature verification, idempotency, payment correction audit trail riêng cho online provider. |
| 3 | **Shipping carrier integration & fulfillment lifecycle**: `OrderEntity.fulfillmentStatus` field tồn tại nhưng không có transition map, không có tracking number table, không có GHN/GHTK/ViettelPost integration, không có failed-delivery / return-to-sender / COD reconciliation. | `NOT_FOUND_IN_REPO` | Shop hiện chỉ có shipping zone/method (cấu hình giá). Không tự tạo vận đơn, không tracking, không xử lý hàng hoàn về. Phải vận hành tay 100% qua Excel/Zalo. |
| 4 | **Legal / compliance — Bộ Công Thương + nội dung pháp lý**: Không có evidence về (a) đã đăng ký/thông báo website TMĐT với Bộ Công Thương (logo "Đã đăng ký Bộ Công Thương" trên footer), (b) nội dung Privacy Policy / Terms / Return Policy / Shipping Policy / Complaint Handling là CMS-driven (`/chinh-sach/[slug]`) — chưa biết content thực tế đã có và đầy đủ chưa. | `NEEDS_LEGAL_CONFIRMATION` | Vi phạm Nghị định 52/2013/NĐ-CP, sửa đổi 85/2021/NĐ-CP về TMĐT. Có thể bị phạt 20–80 triệu VNĐ và bị buộc gỡ bỏ thông tin. |
| 5 | **Refund per-period accuracy (REPORT_RULE_011)**: `refundedAt` bị overwrite mỗi lần partial refund. Không có `refund_transactions` history table. Reports không trả lời chính xác câu hỏi "tuần này refund bao nhiêu" nếu order placed tuần trước. | `CODE_DEFECT` (đã được docs flag) | Sai lệch số liệu kế toán/báo cáo refund. Không truy được history từng lần partial refund. |

### 1.3 Top 5 risks (nếu vận hành luôn không sửa)

| # | Risk | Mô tả | Severity |
|---|---|---|---|
| R1 | **Khách trả tiền online sai/thiếu/dư** | BACS / chuyển khoản thủ công không có flow recording mismatch (transferred ≠ orderTotal). Admin chỉ có `paidAmount` field. Không có "unallocated payment" / "overpaid" / "underpaid" lifecycle. | High |
| R2 | **POS credit limit override không có 2-eye approval** | `receivables.override_limit` chỉ cần ADMIN role. Không có dual-control / approval workflow trước khi vượt hạn mức tín dụng. | Medium-High |
| R3 | **Customer-facing SOA (sao kê công nợ)** | AR_RULE_010 by-design admin-only. Khách doanh nghiệp/đại lý không tự xem dư nợ → tăng dispute & support load. | Medium |
| R4 | **POS không có flow refund / hoàn tiền tại quầy** | POS sale → COMPLETED + PAID. Không có service "POS refund" hay "POS return tại quầy". Hoàn tiền POS đi qua đường refund Order ở admin → mismatch hành vi vận hành thực tế của shop. | Medium-High |
| R5 | **Notification center không persist** | Admin có toast + WS event nhưng không có `notifications` table hay read/unread API. Admin offline 1 giờ sẽ miss event mãi mãi. | Medium |

### 1.4 Top blocker summary

- **5 Operational reality blockers** (P0): Invoice, Shipping carrier, Receiving workflow, Notification center, Refund history.
- **5 Legal/compliance blockers** (P0): Bộ Công Thương registration, Privacy/Terms/Return/Shipping/Complaint policy content.
- **5 Infra/config blockers** (P1, đã được `PRODUCTION_READINESS_GATE.md` Section 8 list): JWT secret, Internal token, Revalidate URL/secret, Nginx ACL `/api/internal/**`, SSL/TLS termination.

---

## 2. Scope

### 2.1 Files / docs đã đọc trực tiếp trong audit này

**Business canonical**:
- `docs/business/PROJECT_OVERVIEW.md`
- `docs/business/MODULE_CATALOG.md`
- `docs/business/BUSINESS_PROCESS.md`
- `docs/business/BUSINESS_RULES.md`
- `docs/business/WORKFLOW_OVERVIEW.md`
- `docs/business/STATE_MACHINES.md`
- `docs/business/ACCEPTANCE_CRITERIA.md`
- `docs/business/USER_ROLES.md`
- `docs/business/GLOSSARY.md` (verified existence; full content per docs index)

**Engineering canonical**:
- `docs/engineering/ARCHITECTURE.md`
- `docs/engineering/API_CONTRACT.md` (referenced; full content per docs index)
- `docs/engineering/DATA_CONTRACT.md` (referenced; full content per docs index)
- `docs/engineering/API_FLOW_MAP.md`
- `docs/engineering/PERMISSION_MATRIX.md`
- `docs/engineering/INTEGRATION_GUIDE.md`
- `docs/engineering/TESTING_GUIDE.md`
- `docs/engineering/TRACEABILITY_MATRIX.md`
- `docs/engineering/DEPLOYMENT_GUIDE.md`

**Audit history**:
- `docs/DOCS_VERIFICATION_REPORT.md` (2026-05-04 + 2026-05-05 patches)
- `docs/audits/E2E_WORKFLOW_MASTER_INVENTORY.md` (2026-05-07)
- `docs/audits/POS_RECEIVABLES_AUDIT.md` (2026-05-07)
- `docs/audits/POS_RECEIVABLES_FIX_REPORT.md` (referenced via PRODUCTION_READINESS_GATE)
- `docs/audits/PRODUCTION_READINESS_GATE.md` (2026-05-08, cycle 10)

**Code grep / spot-check**:
- `BigbikeBackendApplication.java` — `@EnableScheduling` confirmed.
- `service/coupon/CouponExpiryScheduler.java` — `@Scheduled(cron = "0 0 * * * *")` (hourly).
- `service/receivable/ReceivableOverdueScheduler.java` — `@Scheduled(cron = "0 5 0 * * ?")` (00:05 mỗi ngày). **`refreshOverdueStatus()` đã có caller runtime — POS_RECEIVABLES_AUDIT CRITICAL đã được resolved.**
- `service/checkout/CheckoutService.java` lines 69, 779: `ALLOWED_PAYMENT_METHODS = Set.of("COD", "BACS")`; `payment.setProvider("INTERNAL")`.
- `bigbike-admin/src/screens/PosScreen.jsx` lines 9, 36–63, 218: `PAYMENT_METHODS = ['CASH', 'CARD_TERMINAL', 'CREDIT']`; FE đã hỗ trợ CREDIT (customer selector, downPayment, availableCredit, creditEnabled/Active gates). **POS_RECEIVABLES_AUDIT HIGH "POS frontend missing CREDIT" đã được fix.**
- Grep `webhook|VNPAY|MoMo|SePay|sepay` trong `bigbike-backend/src/main/java`: **0 file** — confirmed `NOT_FOUND_IN_REPO` cho external payment provider/webhook code.
- Grep `GHN|GHTK|ViettelPost|trackingNumber` (case-sensitive) trong backend java: **0 carrier integration file**. `fulfillmentStatus` field tồn tại trong `OrderEntity` + 2 DTO response.
- Grep `invoice|hoa_don|e_invoice` trong backend java: **0 file**. **Confirmed: không có invoice/e-invoice subsystem.**
- Grep `stock_receipt|StockReceipt|warranty|product_serial|ProductSerial` trong backend java: **0 file**. Migrations V52/V53/V55 tồn tại (tables `stock_receipts`, `stock_receipt_lines`, `receipt_serials`) nhưng không có Java code → `SCHEMA_ONLY`.
- Flyway migrations đã chạy: V1 → V82 (verified `ls db/migration/`). V82 = `relax_stock_movement_variant_nullable.sql`.
- Web policy/CMS routes: `app/chinh-sach/[slug]/page.tsx` (catch-all), `app/huong-dan/[...sub]/page.tsx` (catch-all). Nội dung pháp lý CMS-driven, không hardcode.

### 2.2 Modules đã kiểm tra

Toàn bộ 67 module trong `E2E_WORKFLOW_MASTER_INVENTORY.md` Section 3 (M01–M67), 109 E2E workflow, 12 entity state machine, 11 business rule cluster (Catalog, Coupon, POS, Media, Inventory/Serial, WebSocket, Redirect/Integration, Accounts Receivable, Reports, plus implied: Order, Payment, Return).

### 2.3 Những gì chưa kiểm tra được trong audit này

| Topic | Lý do |
|---|---|
| Build / test runtime | Read-only mode — không chạy `./mvnw test`, `npm run build`, `flutter test`. Reuse build evidence từ `PRODUCTION_READINESS_GATE.md` cycle 10 (1016/1017 pass) + `POS_RECEIVABLES_AUDIT.md`. |
| Production runtime config | Không có cluster/Render/staging access. PROD_CONFIG verdict đến từ `PRODUCTION_READINESS_GATE.md` Section 5. |
| Email SMTP deliverability | `EmailDispatchService.java` code path `CONFIRMED_FROM_CODE`; runtime `NEEDS_PRODUCTION_RUNTIME_VERIFICATION`. |
| WebSocket per-subscribe authz | CONNECT-time auth verified ở `WebSocketConfig.java`. Per-topic subscribe authz `NEEDS_VERIFICATION` (đã được docs flag). |
| Mobile per-endpoint mapping | `bigbike_mobile/lib/core/api/api_endpoints.dart` tồn tại; field-by-field mapping `NEEDS_VERIFICATION` (đã được docs flag). |
| Nội dung thực tế của các CMS page (`/chinh-sach/[slug]`, `/huong-dan/[...sub]`) | Phụ thuộc dữ liệu admin đã nhập. Audit này không có DB access để xác nhận content đầy đủ và đúng quy định pháp luật. |
| Backup / restore / data retention | Out of repo — operational/DevOps concern. |
| Customer support / dispute / complaint flow | Không có module dedicated. Hiện có `ContactController` (form liên hệ) nhưng không có ticketing system / SLA / escalation. |

### 2.4 Phương pháp xử lý mâu thuẫn evidence

- **Evidence ưu tiên**: code (controller/service/migration) > test > config > docs > memory.
- Khi audit history (`POS_RECEIVABLES_AUDIT.md` 2026-05-07) ghi "scheduler missing" mà code (`ReceivableOverdueScheduler.java`) hiện đã có `@Scheduled`, ghi nhận **đã fix sau audit** và update status — không trust audit history blindly.
- Khi memory file (`project_sepay_manual.md`) ghi SePay controller tồn tại mà grep current code không tìm thấy, trust code hiện tại.
- Khi docs ghi `NEEDS_VERIFICATION` mà code đã có (sau commit gần nhất), nâng status thành `CONFIRMED_FROM_CODE`.

---

## 3. Business Process Coverage Matrix

> **Status legend**: `CFC` = CONFIRMED_FROM_CODE; `CBT` = CONFIRMED_BY_TEST; `BO` = BACKEND_ONLY; `FO` = FRONTEND_ONLY; `FM` = FRONTEND_MISSING; `DNE` = DOCUMENTED_NOT_ENFORCED; `CNRV` = CONFIG_ONLY_NOT_RUNTIME_VERIFIED; `SO` = STATUS_ONLY; `NFIR` = NOT_FOUND_IN_REPO; `CE` = CONFLICTING_EVIDENCE; `NBC` = NEEDS_BUSINESS_CONFIRMATION; `NLC` = NEEDS_LEGAL_CONFIRMATION; `NPRV` = NEEDS_PRODUCTION_RUNTIME_VERIFICATION; `SchO` = SCHEMA_ONLY.

| # | Process | Expected real-world | Docs claim | Code evidence | FE/Admin/Mobile evidence | Test evidence | Status | Gap | Severity | Recommended action |
|---|---|---|---|---|---|---|---|---|---|---|
| P01 | Public catalog browsing | Khách xem danh sách / chi tiết SP, search, lọc | `BUSINESS_PROCESS.md` "Catalog discovery" CFC | `CatalogController`, `PublicSearchController`, `CatalogReadService` | Web routes `app/san-pham/`, `/danh-muc-san-pham/`, `/brands/`, `/product/[slug]`. Mobile features/products + search + categories + brands | `PublicReadApiTest`, `HomepagePublicApiTest`, `__tests__/api/snapshot-route.test.ts`, `search-suggest-route.test.ts` | CBT | None | None | None |
| P02 | Product / category / brand / content visibility | Chỉ public PUBLISHED, visible=true | `BUSINESS_RULES.md` Catalog Availability + STATE_MACHINES §4/§5 | `CatalogReadService` filter PUBLISHED; `AdminMutationValidators.validatePublishTransition` | Web fetches public; Admin mutate gate `products.update`/`catalog.update` | `AdminMutationValidatorsTest`, `AdminMutationApiTest` | CBT | Per-transition E2E test thiếu | Low | Add direct E2E transition tests |
| P03 | Guest cart | Cookie `bb_guest_id` + CSRF | `WORKFLOW_OVERVIEW.md` Customer Commerce step 2 + CFC | `CartController` + `CustomerCsrfFilter` | Web `lib/cart-context.tsx`, `client-api.ts`. Mobile `cart_provider.dart` | `Phase1ECartApiTest` | CBT | `bb_guest_id` `httpOnly=false` (đã được flag MED-004) | Low | Convert to httpOnly khi feasible |
| P04 | Customer cart | Session-bound; merge guest on login | `BUSINESS_PROCESS.md` Cart CFC | `CartService.merge` triggered on login | (above) | `Phase1ECartApiTest` partial; `Phase1DCustomerAuthTest` | CBT | None | None | None |
| P05 | Coupon apply / revalidate / redeem / expire | One coupon per cart; revalidate on refresh; atomic increment ở checkout; scheduler EXPIRED hourly | `BUSINESS_RULES.md` Coupon Rules CFC | `CartService.applyCoupon` + `CheckoutService.applyAndRedeemCoupon` + `CouponExpiryScheduler @Scheduled(cron="0 0 * * * *")` + V73 unique | Web/admin coupon UI | `Phase1ECartApiTest`, `Phase1FCheckoutApiTest`, `Phase1JAdminSettingsMenuCouponApiTest` | CBT | Concurrent redeem race test thiếu rõ; abandonment scheduler không thấy | Low | Add coupon-double-redeem race test; verify abandoned cart scheduler |
| P06 | Checkout | Validate stock/price/coupon/shipping; create order/payment/shipping; decrement stock; CSRF + idempotency | `BUSINESS_PROCESS.md` Checkout CFC | `CheckoutService` + `CheckoutIdempotencyKeyEntity` (V62) | Web `app/thanh-toan/page.tsx`. Mobile checkout screen | `Phase1FCheckoutApiTest` (41 tests) | CBT | Quick-buy không clear cart (MED-002); idempotency TTL thiếu (MED-001); oversell concurrency test thiếu | Medium | Add TTL job; add oversell concurrency test; align quick-buy clear-cart with business expectation |
| P07 | Payment — internal (COD / BACS) | COD → status PROCESSING; BACS → status ON_HOLD; provider = `INTERNAL` | `STATE_MACHINES.md` §6/§7 + BUSINESS_RULES Order/Payment | `CheckoutService.java:69 ALLOWED_PAYMENT_METHODS Set.of("COD","BACS")`; `:779 payment.setProvider("INTERNAL")` | Web checkout payment selector | `Phase1FCheckoutApiTest` | CBT | None for happy path | Low | None |
| P08 | Payment — external provider / webhook (VNPAY / MoMo / SePay) | Provider tự đẩy webhook, signature verification, idempotency, mismatch handling | `BUSINESS_RULES.md` Redirect/Integration Rules: NFIR. `INTEGRATION_GUIDE.md` SePay `NOT_FOUND_IN_REPO`. | Grep `webhook|VNPAY|MoMo|SePay|sepay` → 0 file | None in any client | None | NFIR | Toàn bộ external payment flow vắng | **High** | Decide GO-LIVE strategy: (a) chỉ COD/BACS manual đến khi tích hợp; (b) tích hợp 1 provider trước (VNPAY / MoMo / SePay) với signature + idempotency + audit. |
| P09 | Bank-transfer manual reconcile | Admin upload sao kê / nhập tay; record payment + audit; chuyển thiếu / chuyển thừa / sai nội dung | Docs không có flow chính thức cho mismatch | Admin order detail có `paymentStatus` patch; không có dedicated "bank statement" / "unallocated payment" / "overpaid/underpaid" entity | Admin OrderDetailScreen | None | DNE / NFIR | Không có lifecycle cho khoản chuyển khoản không khớp; admin chỉ chỉnh `paidAmount` thủ công | **High** | Add `bank_transfer_record` + `payment_correction` entities, hoặc tích hợp SePay bridge. Update BUSINESS_PROCESS.md với sub-process "Bank Transfer Reconciliation". |
| P10 | Shipping method selection (internal zone/method) | Customer chọn shipping; backend validate zone/method enabled | `WORKFLOW_OVERVIEW.md` Customer Commerce step 5 CFC | `CheckoutService.resolveShippingMethod` + `AdminShippingService` (zones/methods) | Web checkout shipping selector | `AdminShippingApiTest`, `Phase1FCheckoutApiTest` | CBT | None | None | None |
| P11 | External shipping carrier (GHN/GHTK/ViettelPost) | Tạo vận đơn, tracking, COD reconciliation, failed-delivery, return-to-sender | `INTEGRATION_GUIDE.md` "Not Confirmed in Active Repo" NFIR | Grep → 0 file | None | None | NFIR | Toàn bộ fulfillment lifecycle vắng | **High** | Quyết định carrier integration strategy. Without it: ship phải làm tay 100% (Excel/Zalo/in nhãn). |
| P12 | Order lifecycle (status) | 7 state, transition map, side-effects (cancelledAt, completedAt, stock restore) | `STATE_MACHINES.md` §6 CONFIRMED_BACKEND_ENFORCED | `AdminOrderService.ALLOWED_TRANSITIONS` map | Admin OrderListScreen / OrderDetailScreen | `Phase1HAdminOrderApiTest` (45) | CBT | Per-transition tests partial; fulfillment status relation NV | Medium | Add per-transition coverage; clarify fulfillmentStatus lifecycle |
| P13 | Order cancellation | Stock restore; cancelledAt set; email; WS event | `STATE_MACHINES.md` §6 row | `AdminOrderService.updateOrderStatus` cancel branch | Admin UI | `Phase1HAdminOrderApiTest` partial | CBT | None | Low | None |
| P14 | Refund lifecycle | Full refund → REFUNDED + stock restore; partial → PARTIALLY_REFUNDED | `BUSINESS_RULES.md` REPORT_RULE + STATE_MACHINES §7 | `RefundService.applyRefund`, `AdminOrderService` refund branch | Admin RefundModal | `Phase1HAdminOrderApiTest` | CBT (P) | **REPORT_RULE_011 known limitation: refundedAt overwrite, no `refund_transactions` history** | **Medium-High** | Add `refund_transactions` table + per-event history (P1 already tracked). |
| P15 | Customer return — create | Customer own order → submit return | `WORKFLOW_OVERVIEW.md` Return step 1 CFC | `CustomerOrderController POST /returns`, `CustomerReturnService.create` | Web/mobile account return form | `Phase1LReturnsApiTest` partial | CBT (P) | Eligibility window (status/time-based) chưa rõ; envelope drift (raw DTO) | Medium | Add eligibility rules + harmonize envelope or add adapter |
| P16 | Return lifecycle (admin) | PENDING → APPROVED → RECEIVED → COMPLETED/REFUNDED, terminal REJECTED | `STATE_MACHINES.md` §10 CONFIRMED_BACKEND_ENFORCED | `AdminReturnService.TRANSITIONS` map | Admin ReturnListScreen | `Phase1LReturnsApiTest` (27) | CBT | None for happy path | Low | None |
| P17 | Inventory deduction / restore | Checkout → OUT; cancel/refund/return → restore | `BUSINESS_PROCESS.md` Inventory CFC | `CheckoutService.decrementStock` + `AdminOrderService.restoreStockForOrder` + `AdminReturnService` | Admin InventoryScreen | `Phase1KInventoryP0FixApiTest`, `Phase1KInventorySerialApiTest` | CBT | Concurrency / oversell race test thiếu rõ | Medium | Add explicit oversell test |
| P18 | Manual inventory adjustment | Admin adjust IN/OUT/ADJUSTMENT/RETURN; serial required for IN | `BUSINESS_RULES.md` Inventory & Serial Rules CFC | `AdminInventoryService.adjustStock` + V50 integrity guards + V57 stock_movement_serials | Admin InventoryScreen | `Phase1KInventoryP0FixApiTest`, `Phase1KInventorySerialApiTest` | CBT | None | Low | None |
| P19 | Stock receipt / receiving (PO from supplier) | Receipt header + line + serial; multi-line | `BUSINESS_RULES.md` "Receipt tables exist in migrations, but an active receiving service/controller is not documented" | Migrations V52/V53/V55 tồn tại; **0 Java service/controller** | None | None | **SchO** | Receiving workflow vắng end-to-end | **High** | Implement receiving service/controller/UI hoặc public là không hỗ trợ. |
| P20 | Serial number handling | Per-product / per-serial lifecycle (RECEIVED → IN_STOCK → RESERVED → SOLD → RETURNED → WARRANTY_ACTIVE) | `BUSINESS_RULES.md` "movement-log based, not a fully modeled product-serial lifecycle" | `StockMovementSerialEntity` + V57 (movement-attached serial). **Không có `product_serial` lifecycle table.** | Admin InventoryScreen có serial input | `Phase1KInventorySerialApiTest` | CFC (movement-log only) | Lifecycle full state machine vắng | Medium | Decide: keep movement-log (sufficient cho most shop) hoặc full lifecycle (required if warranty/repair workflow). |
| P21 | Warranty lifecycle | Activation, claim, repair, replacement | None in docs | Grep `warranty` → 0 file | None | None | NFIR | Toàn bộ warranty subsystem vắng | **High** if business cần warranty for motorcycle gear. | Confirm with business (NEEDS_BUSINESS_CONFIRMATION); if cần → P0 implement. |
| P22 | POS cash sale | Immediate COMPLETED + PAID; stock OUT; WS event | `BUSINESS_RULES.md` POS Rules CFC | `PosOrderService.createOrder` cash branch + `pos.write` permission | Admin PosScreen `PAYMENT_METHODS = ['CASH','CARD_TERMINAL','CREDIT']` | `Phase1MPosApiTest` (29) | CBT | None | Low | None |
| P23 | POS card terminal sale | Same as cash + reference number | (above) | `PosOrderService.createOrder` card branch | Admin PosScreen | `Phase1MPosApiTest` | CBT | Hardware integration not modeled (FE only stores reference text) | Low | NEEDS_BUSINESS_CONFIRMATION whether POS terminal hardware integration cần thiết |
| P24 | POS credit sale (bán chịu / công nợ) | Customer required, credit profile required, limit check, downPayment optional, receivable created | `BUSINESS_RULES.md` AR_RULE_001..005 + `STATE_MACHINES.md` Receivable | `PosOrderService.createOrder` credit branch + `CreditPolicyService.validateCreditEligibility` + `ReceivableService.createReceivableForOrder` | **FE đã có**: `PosScreen.jsx:9 PAYMENT_METHODS includes CREDIT`; lines 36-63 customer selector / availableCredit / downPayment / creditEnabled gates; line 218 credit-specific UI block. (POS_RECEIVABLES_AUDIT HIGH "FE missing CREDIT" đã được resolved) | `Phase1MPosApiTest` (29) including credit branch + `AdminReceivableApiTest` (15) | CBT | Full POS→receivable→payment→writeoff trong 1 integration test thiếu | Low | Add full-chain integration test |
| P25 | Accounts receivable lifecycle | OPEN → PARTIALLY_PAID → CLOSED; OVERDUE side branch; WRITTEN_OFF | `BUSINESS_RULES.md` AR_RULE_006 + STATE_MACHINES "Receivable" | `ReceivableService.recordPayment`, `writeOff`, `refreshOverdueStatus` | Admin ReceivablesListScreen + ReceivableDetailScreen | `AdminReceivableApiTest` (15) | CBT | None for happy path | Low | None |
| P26 | Receivable partial / full payment / write-off | Multi-payment; status transitions; mandatory reason for write-off | `BUSINESS_RULES.md` AR_RULE_006/007 | `ReceivableService.recordPayment` + `writeOff` requires `receivables.write_off` | Admin RecordPaymentModal + WriteOffModal | `AdminReceivableApiTest` | CBT | Write-off does NOT update parent order paymentStatus to WRITTEN_OFF — but may be intentional; currently order paymentStatus set "WRITTEN_OFF" (per E2E inventory note); needs business confirmation | Low | Confirm if order.paymentStatus should reflect WRITTEN_OFF |
| P27 | Overdue receivable detection / scheduler | Auto-flip OPEN/PARTIALLY_PAID past due → OVERDUE | `BUSINESS_RULES.md` AR_RULE_008 | `ReceivableOverdueScheduler @Scheduled(cron="0 5 0 * * ?")` calling `ReceivableService.refreshOverdueStatus()` | Admin sees OVERDUE status | `AdminReceivableApiTest` partial | **CFC** (đã được resolved sau audit 2026-05-07) | Scheduler full-table scan O(n); not paginated. | Low | Add index `(status, dueDate)`; paginate in scheduler if scale grows |
| P28 | Customer account / order history / return request | Customer self-service all owns | `WORKFLOW_OVERVIEW.md` Customer + `BUSINESS_PROCESS.md` | `CustomerOrderController`, `CustomerAddressController`, `CustomerAuthController` | Web `app/tai-khoan/**`. Mobile features/account | `Phase1GOrderReadApiTest`, `Phase1LReturnsApiTest`, `Phase1DCustomerAuthTest` | CBT | verify-email POST drift (CONFLICTING_EVIDENCE) | **Medium** (deploy bug) | **Backend fix**: SecurityConfig permitAll cho POST /verify-email, hoặc đổi về GET. |
| P29 | Admin notification / WebSocket | Real-time NEW_ORDER push | `BUSINESS_RULES.md` WebSocket Rules CFC | `WebSocketConfig` + `AdminOrderWsService` + `OrderWsEvent` | Admin `lib/adminWebSocket.js` STOMP | None direct | CFC (P) | Per-subscribe authz NV; **no persistent notification table → admin offline misses events forever** | **Medium-High** | Add `notifications` entity (read/unread, persistent), per-subscribe authz |
| P30 | Audit log | Mọi mutation quan trọng → log | Audit log permission `audit-logs.read` | `AuditLogEntity` + V76 + `AdminAuditLogService` | Admin AuditLogListScreen | `AdminAuditLogApiTest` (11) | CBT | Slider/HomeVideo audit `resourceId=null` (string IDs); 10 controllers fall back DEV_ADMIN_ID without devHeaderEnabled guard (FUTURE_SCOPE) | Low | Track in backlog |
| P31 | Reports / dashboard metrics | GMV, paidRevenue, refundAmount, netRevenue, topProducts, topCustomers | `BUSINESS_RULES.md` REPORT_RULE_001..011 | `AdminReportService`, `AdminDashboardService`, V77/V78 | Admin ReportsScreen, DashboardScreen | `AdminReportApiTest` (16), `AdminDashboardApiTest` (9), `AdminReportRepositoryQueryTest` (INFRA_FAIL Docker) | CBT | **REPORT_RULE_011 limitation** | **Medium** | Implement `refund_transactions` table |
| P32 | Admin RBAC / permission matrix | Role → permission strings; backend gate | `PERMISSION_MATRIX.md` CFC | `AdminRolePermissions.MAP` + `requirePermission` calls + RbacUrlGate | Admin UI shows/hides buttons | `RbacUrlGateIntegrationTest`, `AdminRolesApiTest` | CBT | None | Low | None |
| P33 | Media upload / delete / reference protection | Tika MIME validation, hard-delete blocked when referenced | `BUSINESS_RULES.md` Media Rules CFC | `AdminMediaService` + Tika | Admin MediaLibraryScreen | `AdminMediaP0Test` (12) | CBT | None | Low | None |
| P34 | Settings / menu / redirect / internal proxy | Admin set, public read; proxy.ts internal redirect | `BUSINESS_RULES.md` Redirect/Integration Rules | `AdminSettingsService`, `AdminMenuService`, `AdminRedirectService`, `InternalRedirectController` + `proxy.ts` | Admin SettingsScreen / MenuScreen / RedirectListScreen | `Phase1JAdminSettingsMenuCouponApiTest`, `AdminRedirectApiTest` | CBT | Internal redirect endpoint `permitAll` (expects infra IP allowlist) | Medium | Configure Nginx ACL; documented in PRODUCTION_READINESS_GATE.md |
| P35 | SEO / content / page / blog | Articles/pages publish lifecycle, sitemap, robots | `STATE_MACHINES.md` §11 + `BUSINESS_RULES.md` | `AdminContentMutationService` + `ContentReadService` + `app/sitemap.ts` + `robots.ts` | Web `app/tin-tuc/`, `/chinh-sach/[slug]`, `/[slug]` (catch-all CMS), `/huong-dan` | `AdminContentApiTest`, `ContentP1ApiTest`, `ContentPublicApiTest`, `__tests__/seo/robots.test.ts` | CBT | Sitemap/robots completeness NV | Low | Audit sitemap content |
| P36 | Legal / compliance pages | Privacy / Terms / Return / Shipping / Complaint / Bộ Công Thương badge | None hardcoded; CMS-driven `/chinh-sach/[slug]` | None hardcoded | Web routes catch-all; mobile content screens | None | **NLC** | **Nội dung thực tế chưa biết có đủ và đúng quy định pháp luật không. Bộ Công Thương registration badge không có evidence trong repo.** | **High** (production blocker) | Confirm with legal counsel + business: registration / content / footer badge / contact details / dispute clause |
| P37 | Invoice / e-invoice (hóa đơn điện tử) | Xuất hóa đơn sau checkout / POS; trạng thái DRAFT/ISSUED/ADJUSTED/CANCELLED; refund/cancel ảnh hưởng invoice | None | Grep `invoice` → 0 file | None | None | **NFIR** | **Toàn bộ invoice subsystem vắng. Vi phạm Nghị định 123/2020/NĐ-CP nếu shop là legal entity bán retail.** | **High** (production blocker) | NEEDS_BUSINESS_CONFIRMATION: ai phát hành hoá đơn (Misa / VNPT / Easyinvoice / Viettel SInvoice). Implement invoice service + entity + provider integration. |
| P38 | Data privacy / customer information handling | Privacy policy, data retention, GDPR-like (PII consent) | None hardcoded | None | Web policy CMS pages | None | **NLC / NEEDS_BUSINESS_CONFIRMATION** | Repo có customer email/phone/address persistence; không thấy retention policy / data deletion / consent audit | **Medium-High** | Add data retention policy doc + customer-data-export / customer-data-delete endpoints (Quyền xóa của khách per Luật An ninh mạng / Nghị định 13/2023) |
| P39 | Backup / restore / data retention operational process | Daily backup, restore drill, retention | None in docs | Out of scope (DevOps) | None | None | **NPRV** | Hoàn toàn out-of-repo | **High** | Document backup/restore runbook trong DEPLOYMENT_GUIDE.md hoặc operational doc |
| P40 | Error / recovery / manual override flows | Khi flow lỗi nửa chừng (paid nhưng order chưa create, etc.), admin recovery? | None comprehensive | Idempotency keys (V62); refund manual; admin order patch; receivable record/write-off | Admin patch APIs | `Phase1FCheckoutApiTest` idempotency | CFC for idempotency; NFIR for manual-override comprehensive UI | No "stuck order recovery" / "force-reconcile" admin command | Medium | Document manual recovery playbook |

---

## 4. Business Rules Verification Matrix

> Status legend giống Section 3.

### 4.1 Catalog rules

| Rule | Statement | Source doc | Backend enforcement | FE support | Mobile support | DB constraint / migration | Test | Runtime / scheduler / config | Final status | Fix required |
|---|---|---|---|---|---|---|---|---|---|---|
| CAT_RULE_001 | Public catalog/cart/checkout chỉ accept `PUBLISHED` | BUSINESS_RULES Catalog Availability | `CatalogReadService` filter; `CartService.addItem` validate | Web/Admin filter UI | Mobile fetch | `PublishStatus.java` enum | `Phase1ECartApiTest`, `PublicReadApiTest` | None | CBT | None |
| CAT_RULE_002 | Variant add-to-cart yêu cầu available + in-stock | BUSINESS_RULES | `CartService.addItem` validate `quantityOnHand > 0` | Web/admin disable "Add to cart" if OOS | Mobile equivalent | None | `Phase1ECartApiTest` | None | CBT | None |
| CAT_RULE_003 | Checkout re-sync price từ DB before order | BUSINESS_RULES | `CheckoutService.checkoutFromCart` revalidate prices | Web shows price-change banner | Mobile equivalent | None | `Phase1FCheckoutApiTest` | None | CBT | None |

### 4.2 Coupon rules

| Rule | Statement | Source | Backend | FE | Mobile | DB | Test | Runtime | Status | Fix |
|---|---|---|---|---|---|---|---|---|---|---|
| COUP_RULE_001 | One coupon per cart | BUSINESS_RULES | `CartService.applyCoupon` | Web/Mobile cart | Yes | V73 unique | `Phase1ECartApiTest` | — | CBT | None |
| COUP_RULE_002 | Apply coupon → lock row + validate status/expiry/limit/min | BUSINESS_RULES | `CouponPolicyService` + service | Web/Admin coupon UI | Yes | None | `Phase1ECartApiTest`, `Phase1JAdminSettingsMenuCouponApiTest` | — | CBT | None |
| COUP_RULE_003 | Cart refresh removes invalid coupon | BUSINESS_RULES | `CartService.refresh` | Web cart auto refresh | Yes | None | `Phase1ECartApiTest` | — | CBT | None |
| COUP_RULE_004 | Checkout revalidates and atomic increment | BUSINESS_RULES | `CheckoutService.applyAndRedeemCoupon` | — | — | None | `Phase1FCheckoutApiTest` | — | CBT | Add explicit concurrent redeem test |
| COUP_RULE_005 | Scheduler hourly: ACTIVE → EXPIRED if past dueDate | BUSINESS_RULES | `CouponExpiryScheduler @Scheduled(cron="0 0 * * * *")` | — | — | None | `Phase1JAdminSettingsMenuCouponApiTest` partial | `@EnableScheduling` confirmed | CBT | Add scheduler runtime smoke test |

### 4.3 POS rules

| Rule | Statement | Source | Backend | FE | Mobile | DB | Test | Runtime | Status | Fix |
|---|---|---|---|---|---|---|---|---|---|---|
| POS_RULE_001 | Endpoints require admin JWT + `pos.read`/`pos.write`; price override yêu cầu `pos.price_override` | BUSINESS_RULES | `AdminPosController.requirePermission` + `PosOrderService.canOverridePrice` | Admin PosScreen | n/a (not POS) | None | `Phase1MPosApiTest` | — | CBT | None |
| POS_RULE_002 | POS sale immediate COMPLETED + PAID + provider POS (cash/card branch) | BUSINESS_RULES | `PosOrderService` cash/card | Admin PosScreen | n/a | None | `Phase1MPosApiTest` | — | CBT | None |
| POS_RULE_003 | POS write order snapshots staff + customer name (V71) | BUSINESS_RULES | `PosOrderService` snapshot | (above) | n/a | V71 | `Phase1MPosApiTest` | — | CBT | None |
| POS_RULE_004 | POS decrements stock + writes movement + audit | BUSINESS_RULES | `PosOrderService.decrementStock` | (above) | n/a | None | `Phase1MPosApiTest` (`stockMovementCreated`) | — | CBT | None |
| POS_RULE_005 | No POS expiry cleanup lifecycle | BUSINESS_RULES NFIR | none | none | n/a | none | none | none | NFIR | NEEDS_BUSINESS_CONFIRMATION whether cleanup needed |
| POS_RULE_006 | POS audit log includes IP/UA (POSREC-001) | POS_RECEIVABLES_FIX_REPORT | `PosOrderService.createOrder` writes IP/UA on AuditLogEntity | — | — | None | `Phase1MPosApiTest` | — | CBT | None (đã được fix) |
| POS_RULE_007 | POS CREDIT branch yêu cầu customer + creditEnabled + creditStatus=ACTIVE; reject if exceed limit unless `receivables.override_limit` | BUSINESS_RULES AR_RULE_001/005 | `CreditPolicyService.validateCreditEligibility` + `PosOrderService` credit branch | **Admin PosScreen line 9 + 36-63: customer selector, availableCredit, downPayment, creditEnabled/Active gates, overLimit blocking** | n/a | V75 | `Phase1MPosApiTest` credit branch + `AdminReceivableApiTest` | — | CBT | None (đã được fix) |

### 4.4 Media rules

| Rule | Statement | Status | Notes |
|---|---|---|---|
| MEDIA_RULE_001 | Server-side Tika MIME magic-byte validation | CBT | `AdminMediaP0Test` |
| MEDIA_RULE_002 | Allowed MIME: common raster + MP4 + audio | CBT | (above) |
| MEDIA_RULE_003 | SVG rejected | CBT | (above) |
| MEDIA_RULE_004 | Hard-delete blocked when referenced | CBT | (above) |

### 4.5 Inventory & serial rules

| Rule | Statement | Status | Notes |
|---|---|---|---|
| INV_RULE_001 | Movement types: IN, OUT, ADJUSTMENT, RETURN | CBT | `Phase1KInventoryP0FixApiTest` |
| INV_RULE_002 | Manual stock-in: serial count = quantity | CBT | `Phase1KInventorySerialApiTest` |
| INV_RULE_003 | Other movements: serial optional, ≤ qty | CBT | (above) |
| INV_RULE_004 | Duplicate serial rejected (req + existing DB) | CBT | (above) |
| INV_RULE_005 | Serial handling movement-log based, not full lifecycle | CFC | `StockMovementSerialEntity`; **no `product_serial` table.** |
| INV_RULE_006 | Receipt tables exist; no active receiving service/controller | **SchO** | V52/V53/V55 only; grep `StockReceipt` Java → 0 file |

### 4.6 WebSocket rules

| Rule | Statement | Status | Notes |
|---|---|---|---|
| WS_RULE_001 | STOMP CONNECT requires `Authorization: Bearer <token>` | CFC | `WebSocketConfig.java` |
| WS_RULE_002 | Only ADMIN, SUPER_ADMIN can connect | CFC | (above) |
| WS_RULE_003 | Confirmed topic `/topic/admin/orders` | CFC | `AdminOrderWsService` |
| WS_RULE_004 | Event `NEW_ORDER` confirmed; `ORDER_STATUS_CHANGED` `NEEDS_VERIFICATION` | CFC + NV | `OrderWsEvent.java` declares; sender side NV |
| WS_RULE_005 | Per-subscribe topic-level authz | NV | Per `DOCS_VERIFICATION_REPORT` |

### 4.7 Redirect & integration rules

| Rule | Status | Notes |
|---|---|---|
| INTEG_RULE_001 (internal redirect permitAll, infra-locked) | CFC + CNRV | Nginx ACL `NEEDS_INFRA_VERIFICATION` |
| INTEG_RULE_002 (external payment webhook) | NFIR | No code |
| INTEG_RULE_003 (external shipping carrier) | NFIR | No code |

### 4.8 Accounts receivable rules

| Rule | Statement | Status | Evidence | Notes |
|---|---|---|---|---|
| AR_RULE_001 | POS CREDIT only; ADMIN manages all; SHOP_MANAGER read+record_payment | CBT | `AdminRolePermissions.java`, `Phase1MPosApiTest`, `AdminReceivableApiTest` | None |
| AR_RULE_002 | Credit limit per customer; null = no cap; override permission required | CBT | `CreditPolicyService`, `customer.creditLimit` | None |
| AR_RULE_003 | Payment terms days → due date | CBT | `ReceivableService.createReceivableForOrder` | None |
| AR_RULE_004 | POS-only; web/mobile checkout không support CREDIT | CBT | `CheckoutService.ALLOWED_PAYMENT_METHODS = COD,BACS` | None |
| AR_RULE_005 | Exceeding limit → HTTP 422 unless override | CBT | `CreditPolicyService` + Phase1MPosApiTest | None |
| AR_RULE_006 | Partial payments OK; status transitions UNPAID → PARTIALLY_PAID → PAID | CBT | `ReceivableService.recordPayment` | None |
| AR_RULE_007 | Write-off: mandatory reason; `receivables.write_off`; status WRITTEN_OFF; audit | CBT | `ReceivableService.writeOff` | Confirm if order.paymentStatus should also flip |
| AR_RULE_008 | Overdue scheduler flags (OPEN/PARTIALLY_PAID past due → OVERDUE) | **CBT** (resolved sau audit 2026-05-07) | **`ReceivableOverdueScheduler.java @Scheduled(cron="0 5 0 * * ?")` calling `refreshOverdueStatus`** | Old POS_RECEIVABLES_AUDIT CRITICAL "no scheduler calls it" was a false alarm vs current code |
| AR_RULE_009 | Walk-in customer snapshot (name, phone) khi `customer_id` null | CBT | V75 schema + `ReceivableEntity` | None |
| AR_RULE_010 | No customer-facing SOA; admin-only by design | CFC | None on web/mobile | NEEDS_BUSINESS_CONFIRMATION nếu cần customer self-serve công nợ |
| AR_RULE_011 | Aging report: notDue, 0–30, 31–60, 61–90, 90+ | CBT | `ReceivableQueryService.aging` | None |

### 4.9 Reports rules

| Rule | Status | Notes |
|---|---|---|
| REPORT_RULE_001 (GMV) | CBT | `AdminReportApiTest` |
| REPORT_RULE_002 (paidRevenue) | CBT | (above) |
| REPORT_RULE_003 (refundAmount anchored to placedAt) | CFC | (above) — see RULE_011 limitation |
| REPORT_RULE_004 (netRevenue, no clamp) | CBT | (above) |
| REPORT_RULE_005 (orderCount) | CBT | (above) |
| REPORT_RULE_006 (avgOrderValue) | CBT | (above) |
| REPORT_RULE_007 (REVENUE_EXCLUDED vs RANKING_EXCLUDED) | CBT | (above) |
| REPORT_RULE_008 (TZ Asia/Ho_Chi_Minh) | CBT | `AdminReportRepositoryQueryTest` (INFRA_FAIL Docker — not a code defect) |
| REPORT_RULE_009 (topProducts COALESCE product_pk) | CBT | (above) |
| REPORT_RULE_010 (topCustomers COALESCE customer_id) | CBT | (above) |
| **REPORT_RULE_011 (refund period attribution limitation)** | **CFC** known limitation | **Required: `refund_transactions` table** |

### 4.10 Order rules (extracted from STATE_MACHINES + ORDER_PAYMENT audits)

| Rule | Status | Notes |
|---|---|---|
| ORDER_RULE_001 (initial status COD→PROCESSING, BACS→ON_HOLD) | CBT | `Phase1FCheckoutApiTest` |
| ORDER_RULE_002 (status transition map enforced) | CFC | `AdminOrderService.ALLOWED_TRANSITIONS` |
| ORDER_RULE_003 (CANCELLED/REFUNDED → restoreStockForOrder) | CBT | `Phase1HAdminOrderApiTest` |
| ORDER_RULE_004 (set cancelledAt/completedAt/paidAt) | CFC | (above) |
| ORDER_RULE_005 (refund full → optional order REFUNDED) | CFC | `RefundService.applyRefund` |
| ORDER_RULE_006 (audit log includes IP/UA — ORD-001) | CBT | `Phase1HAdminOrderApiTest` |

### 4.11 Payment rules

| Rule | Status | Notes |
|---|---|---|
| PAY_RULE_001 (paymentStatus 8 values; transition map) | CFC | `AdminOrderService.ALLOWED_PAYMENT_TRANSITIONS` |
| PAY_RULE_002 (PaymentEntity 5 values) | CFC | `PaymentRecordStatus.java` |
| PAY_RULE_003 (provider INTERNAL for online; POS for POS) | CFC | `CheckoutService:779` + `PosOrderService` |
| PAY_RULE_004 (no external webhook) | NFIR | None |
| PAY_RULE_005 (idempotency at checkout via `Idempotency-Key` header) | CBT | V62 + `Phase1FCheckoutApiTest` |

### 4.12 Return rules

| Rule | Status | Notes |
|---|---|---|
| RET_RULE_001 (state machine PENDING→APPROVED→RECEIVED→COMPLETED/REFUNDED) | CBT | `Phase1LReturnsApiTest` |
| RET_RULE_002 (RECEIVED→COMPLETED restores stock; RECEIVED→REFUNDED restores stock + refund) | CBT | (above) |
| RET_RULE_003 (Customer can only return own order) | CBT | (above) |
| RET_RULE_004 (Customer endpoint envelope drift) | CFC + DRIFT | Documented |
| RET_RULE_005 (Refund attribute REPORT_RULE_011 limitation applies) | CFC | (above) |
| RET_RULE_006 (Eligibility window: status / time-based) | NV / NEEDS_BUSINESS_CONFIRMATION | None explicit |

### 4.13 Admin user / RBAC rules

| Rule | Status | Notes |
|---|---|---|
| RBAC_RULE_001 (8 built-in roles + custom roles) | CBT | `AdminRolesApiTest` |
| RBAC_RULE_002 (Permission-based gate via `requirePermission`) | CBT | `RbacUrlGateIntegrationTest` |
| RBAC_RULE_003 (Self-deactivation guard) | CBT | `Phase1IAdminManagementApiTest` |
| RBAC_RULE_004 (Last Super Admin demotion guard) | CBT | (above) |
| RBAC_RULE_005 (DEV_ADMIN_ID fallback in 10 controllers — FUTURE_SCOPE) | CFC + FUTURE_SCOPE | Production safe (perm check fires first) |

---

## 5. End-to-End Workflow Readiness

> Format: per major workflow, list happy path, negative path, recovery, audit log, permission, notification, reporting impact, missing tests.

### 5.1 Customer checkout (cart → order, COD/BACS)

| Aspect | Status | Note |
|---|---|---|
| Happy path | CBT | `Phase1FCheckoutApiTest` (41 tests) |
| Negative — empty cart, invalid coupon, OOS, invalid address | CBT | (above) |
| Recovery — idempotency replay | CBT | (above), V62 |
| Audit log | CFC | `OrderEntity.placedAt` + `audit_logs` |
| Permission | CFC | Public + CSRF + rate-limit 5/min |
| Notification | CFC | Email + WS NEW_ORDER + ISR revalidate |
| Reporting impact | CFC | Counted in GMV / orderCount; if cancelled excluded |
| Missing tests | Oversell race; partial-shipping selection edge; quick-buy dedicated; price-change array always empty | Medium |

### 5.2 Order admin lifecycle + refund

| Aspect | Status | Note |
|---|---|---|
| Happy path | CBT | `Phase1HAdminOrderApiTest` (45) |
| Negative — invalid transition | CBT | (above) |
| Recovery — manual paymentStatus patch | CFC | `AdminOrderService.updatePaymentStatus` |
| Audit log | CBT (incl. IP/UA — ORD-001 fix) | (above) |
| Permission | CBT | `orders.write` |
| Notification | CFC | Email + WS event |
| Reporting impact | CBT | `AdminReportApiTest` |
| Missing tests | Per-transition E2E full coverage; partial-refund overwriting refundedAt explicit test | Medium |

### 5.3 POS sale (cash / card / credit)

| Aspect | Status | Note |
|---|---|---|
| Happy path | CBT | `Phase1MPosApiTest` (29) |
| Negative — insufficient stock, exceed credit, missing customer for CREDIT, etc. | CBT | (above) |
| Recovery | Idempotency key | CBT |
| Audit log | CBT (incl. IP/UA — POSREC-001 fix) | (above) |
| Permission | CBT | `pos.write`, `pos.price_override`, `receivables.override_limit` |
| Notification | CFC | WS NEW_ORDER |
| Reporting impact | CBT | counted as channel POS; CREDIT may not be in paidRevenue until paid |
| Missing tests | Full POS→receivable→record_payment→write-off chain in one test | Low |

### 5.4 Receivables — record payment / write-off / aging

| Aspect | Status | Note |
|---|---|---|
| Happy path | CBT | `AdminReceivableApiTest` (15) |
| Negative — invalid amount, exceed outstanding, missing reason for write-off | CBT | (above) |
| Recovery | None explicit — "undo payment record" not present | NFIR | Medium |
| Audit log | CBT (incl. IP/UA) | (above) |
| Permission | CBT | `receivables.read`, `record_payment`, `write_off`, `override_limit` |
| Notification | None | Could add customer-facing reminders |
| Reporting impact | CBT | aging buckets, summary |
| Missing tests | Concurrent record_payment; payment idempotency | Low |

### 5.5 Returns (customer → admin)

| Aspect | Status | Note |
|---|---|---|
| Happy path | CBT | `Phase1LReturnsApiTest` (27) |
| Negative — return non-own, terminal status | CBT | (above) |
| Recovery | None explicit | NFIR | Low |
| Audit log | CFC | `audit_logs` + `return_history` |
| Permission | CBT | `orders.write` admin; ROLE_CUSTOMER for customer |
| Notification | CFC | Email per status change |
| Reporting impact | CFC | Refund attribution per REPORT_RULE_011 |
| Missing tests | Customer eligibility window; envelope drift adapter | Medium |

### 5.6 Inventory adjust + serial

| Aspect | Status | Note |
|---|---|---|
| Happy path | CBT | `Phase1KInventoryP0FixApiTest`, `Phase1KInventorySerialApiTest` |
| Negative — duplicate serial, count mismatch, OOS | CBT | (above) |
| Recovery | Manual ADJUSTMENT | CFC |
| Audit log | CFC | `audit_logs` + `stock_movements` |
| Permission | CBT | `products.update` |
| Notification | None | n/a |
| Reporting impact | Stock visible in InventoryScreen; not in revenue reports | n/a |
| Missing tests | Concurrency | Medium |

### 5.7 Coupon redeem + scheduler

| Aspect | Status | Note |
|---|---|---|
| Happy path | CBT | `Phase1ECartApiTest`, `Phase1FCheckoutApiTest`, `Phase1JAdminSettingsMenuCouponApiTest` |
| Scheduler ACTIVE → EXPIRED hourly | CFC | `CouponExpiryScheduler @Scheduled(cron="0 0 * * * *")` |
| Missing tests | Concurrent redemption double-spend | Low |

### 5.8 Admin user / RBAC

| Aspect | Status | Note |
|---|---|---|
| Happy path | CBT | `AdminUsersApiTest`, `AdminRolesApiTest`, `Phase1IAdminManagementApiTest`, `RbacUrlGateIntegrationTest` |
| Self-deactivation / Last Super Admin guard | CBT | (above) |
| Missing tests | Custom-role permission boundary tests | Low |

### 5.9 Public catalog + content

| Aspect | Status | Note |
|---|---|---|
| Happy path | CBT | `PublicReadApiTest`, `HomepagePublicApiTest`, `ContentP1ApiTest`, `ContentPublicApiTest`, `__tests__/api/snapshot-route.test.ts`, `search-suggest-route.test.ts` |
| Sitemap / robots | CBT (robots) + NV (sitemap completeness) | `__tests__/seo/robots.test.ts` |
| Missing tests | Sitemap content audit | Low |

### 5.10 Media upload

| Aspect | Status | Note |
|---|---|---|
| Happy path | CBT | `AdminMediaP0Test` (12) |
| Negative — fake MIME, SVG, hard-delete-when-referenced | CBT | (above) |
| Missing tests | Restore from DELETED edge | Low |

### 5.11 Customer auth (register / verify-email / login / forgot / reset)

| Aspect | Status | Note |
|---|---|---|
| Happy path | CBT | `Phase1DCustomerAuthTest` (20), `Phase1I1CustomerStatusLoginTest` (8) |
| **Verify-email POST** | **CONFLICTING_EVIDENCE** | SecurityConfig permitAll **GET** but controller `@PostMapping`. POST → 401 in prod. **Code bug — needs backend fix**. |
| Missing tests | Verify-email rate limit | Low |

### 5.12 WebSocket admin order feed

| Aspect | Status | Note |
|---|---|---|
| CONNECT-time auth | CFC | `WebSocketConfig.java` (re-verified 2026-05-05) |
| Per-subscribe authz | NV | Documented |
| Persistent notification | NFIR | No `notifications` table |
| Missing tests | Per-subscribe authz gap close | Medium |

---

## 6. Operational Reality Gaps

> Đây là những gì cần cho vận hành thật mà repo hiện tại chưa cover. Mức độ ưu tiên dựa trên impact runtime + legal risk + cost-of-not-having.

### 6.1 Legal / compliance — Việt Nam

| Topic | Status | Tác động | Recommendation |
|---|---|---|---|
| Đăng ký TMĐT với Bộ Công Thương | NLC | Vi phạm Nghị định 52/2013/NĐ-CP, sửa đổi 85/2021/NĐ-CP. Phạt 20–80 triệu. | NEEDS_LEGAL_CONFIRMATION + business action: đăng ký + footer badge "Đã đăng ký Bộ Công Thương" |
| Privacy Policy nội dung | NLC | Luật An ninh mạng, Nghị định 13/2023/NĐ-CP về dữ liệu cá nhân | Confirm content via CMS (`/chinh-sach/privacy-policy` or similar) |
| Terms & Conditions | NLC | Bắt buộc với TMĐT | Confirm content |
| Return / Refund Policy | NLC | Bắt buộc với TMĐT B2C | Confirm content + Article 8 Luật Bảo vệ quyền lợi người tiêu dùng |
| Shipping Policy | NLC | Bắt buộc với TMĐT | Confirm content |
| Payment Policy | NLC | Bắt buộc | Confirm content |
| Complaint / Dispute Handling Policy | NLC | Bắt buộc per Nghị định 85/2021 | Confirm content + provide complaint email/hotline |
| Thông tin thương nhân (legal footer) | NLC | Tên DN, Mã số thuế, Địa chỉ, Số ĐKKD, Email, Hotline | Confirm site_settings configured |
| Customer-data export / data deletion (right to be forgotten) | NFIR | Nghị định 13/2023/NĐ-CP | Add `GET /api/v1/customer/me/export` + `DELETE /api/v1/customer/me` (or anonymize). Document trong Privacy. |

### 6.2 E-commerce notification / registration

| Topic | Status | Recommendation |
|---|---|---|
| Bộ Công Thương online.gov.vn registration (cấp Logo trang TMĐT) | NLC | Business action |
| 3rd-party logo: PCI-DSS (nếu nhận thẻ) | n/a (không có credit card processing trong repo — chỉ POS terminal external) | Document |

### 6.3 Consumer protection

| Topic | Status | Recommendation |
|---|---|---|
| Return policy đủ điều kiện / thời hạn / phí ship / hoàn tiền | NLC + NFIR (eligibility window code) | Add eligibility rules ở `CustomerReturnService`; document policy content |
| Quy trình xử lý hàng lỗi / hàng sai mô tả | NLC | Document policy + ensure return state machine cover REJECTED reason |
| Customer support escalation | NFIR | Hiện chỉ có ContactController. Không có ticketing / SLA. Recommendation: integrate Crisp/Tawk/Zendesk hoặc minimal ticketing. |

### 6.4 Invoice / e-invoice

| Topic | Status | Recommendation |
|---|---|---|
| Invoice entity / state DRAFT/ISSUED/ADJUSTED/CANCELLED | **NFIR** | **P0**: Add `invoice` entity + service + provider integration |
| E-invoice provider (VNPT eInvoice / Misa MeInvoice / Easyinvoice / Viettel SInvoice / Bkav) | **NFIR** | **P0**: Choose 1, integrate API |
| Refund / write-off / cancel impact on invoice | n/a (no invoice) | Document trong Refund/Return flow |
| **Vi phạm Nghị định 123/2020/NĐ-CP nếu shop là pháp nhân** | NLC | NEEDS_LEGAL_CONFIRMATION |

### 6.5 External payment reconciliation

| Topic | Status | Recommendation |
|---|---|---|
| VNPAY/MoMo/SePay webhook integration | NFIR | P0/P1 depending on business priority |
| Signature verification, idempotency, replay attack | NFIR | Required for any provider |
| Bank transfer mismatch (chuyển thiếu/dư/sai content) | DNE | **Add**: `bank_transfer_record`, `payment_correction` entity, admin manual reconcile flow + audit |
| Manual reconcile audit log | Partial | `AuditLogEntity` covers `paymentStatus` change, but not detailed mismatch info |

### 6.6 Shipping carrier lifecycle

| Topic | Status | Recommendation |
|---|---|---|
| Tạo vận đơn (create waybill) | NFIR | P0 if cần auto |
| Tracking number lifecycle | NFIR | P0/P1 |
| Failed delivery / Return-to-sender | NFIR | P1 |
| COD reconciliation (carrier trả tiền COD về shop) | NFIR | P0 if shop dùng COD |
| Without integration | shop run 100% manual via Excel/Zalo | Document workaround |

### 6.7 Serial / warranty lifecycle

| Topic | Status | Recommendation |
|---|---|---|
| Product-serial lifecycle table | NFIR (only movement-attached) | NEEDS_BUSINESS_CONFIRMATION whether full lifecycle cần thiết |
| Warranty activation / claim / repair / replacement | NFIR | NEEDS_BUSINESS_CONFIRMATION |
| If business cần warranty for motorcycle gear (mũ bảo hiểm thường có warranty) → P0 | — | Confirm |

### 6.8 Stock receiving

| Topic | Status | Recommendation |
|---|---|---|
| Receipt service / controller / UI | **SchO** (V52/V53/V55 only) | **P1**: Implement receiving service + UI hoặc mark as deferred |

### 6.9 Data privacy / customer data protection

| Topic | Status | Recommendation |
|---|---|---|
| Customer data retention policy | NFIR | Document |
| Customer data export endpoint | NFIR | Add per Nghị định 13/2023 |
| Customer data deletion endpoint | NFIR | Add per Nghị định 13/2023 |
| Audit log retention | n/a (admin-only read) | Document retention period |

### 6.10 Backup / restore / data retention

| Topic | Status | Recommendation |
|---|---|---|
| Daily DB backup runbook | NFIR (DevOps) | Document trong DEPLOYMENT_GUIDE.md |
| Restore drill runbook | NFIR | Document |
| Backup retention period | NFIR | Document |

### 6.11 Customer support / dispute handling

| Topic | Status | Recommendation |
|---|---|---|
| Ticketing system | NFIR | Integrate Crisp/Zendesk/Help Scout hoặc minimal ticketing |
| SLA / escalation matrix | NFIR | Document |
| Dispute resolution workflow | NFIR | Document + flow trong admin |

### 6.12 Notification center

| Topic | Status | Recommendation |
|---|---|---|
| Persistent `notifications` table | NFIR | **P1**: Add table + read/unread API |
| Read/unread state | NFIR | (above) |
| Push notification (mobile) | NFIR | Future |

---

## 7. Production Blockers

> Chỉ liệt kê những thứ nếu không sửa thì **không nên vận hành thật**.

| # | Blocker | Type | Owner | Reasoning |
|---|---|---|---|---|
| **B01** | **Hóa đơn điện tử (e-invoice)** integration | NFIR — Code | Backend + Business | Nghị định 123/2020. Pháp nhân bán retail bắt buộc. |
| **B02** | **Đăng ký TMĐT với Bộ Công Thương** + footer badge | NLC — Legal | Legal + Business | Nghị định 52/2013, 85/2021. Phạt 20–80 triệu. |
| **B03** | **Privacy / Terms / Return / Shipping / Complaint policy content** đầy đủ + đúng quy định | NLC — Content | Legal + Business + CMS | Bắt buộc với TMĐT B2C. |
| **B04** | **Customer-data export + delete** endpoint per Nghị định 13/2023 | NFIR — Code | Backend | Bắt buộc nếu shop có khách cá nhân (PII). |
| **B05** | **Bank transfer reconciliation flow** (chuyển thiếu/dư/sai nội dung) — admin có UI + audit + correction record | DNE — Code/UX | Backend + Admin FE | Hiện chỉ có `paidAmount` patch tay; mismatch không có lifecycle. Lỗi nhân viên = mất tiền. |
| **B06** | **Refund history table (`refund_transactions`)** — REPORT_RULE_011 | Code defect | Backend | Mất history cho partial refund; sai số liệu. |
| **B07** | **5 PROD_CONFIG infra** từ `PRODUCTION_READINESS_GATE.md` Section 8: JWT secret, Internal token pairing, Revalidate URL/secret, Nginx ACL `/api/internal/**`, SSL/TLS termination | Infra | DevOps | Deploy mặc định = unsafe (dev secret, redirect fail, ISR cache stale, internal endpoint open, cookie rejected). |
| **B08** | **Verify-email POST drift** — backend bug | Code bug | Backend | Customer email-verification link sẽ fail in prod. |
| **B09** | **First SUPER_ADMIN seeding runbook** | Ops | DevOps + Backend | Without it, admin portal unusable on first deploy. |
| **B10** | **MinIO / SMTP staging smoke test** | Ops | DevOps | Without it, media upload + email vận hành không kiểm chứng. |
| **B11** | **Backup / restore runbook** + retention policy | Ops doc | DevOps | Risk data loss vĩnh viễn. |
| **B12** | **Customer support / dispute handling SOP + tooling** | Process | Business + Ops | Bắt buộc cho TMĐT B2C; ảnh hưởng vận hành thực tế. |
| **B13** | **Decision: External payment provider** (VNPAY/MoMo/SePay)? Nếu yes → P0 implement; nếu no → tăng cường BACS reconciliation flow (B05) | Decision | Business + Backend | Hiện chỉ COD/BACS manual; quyết định strategy quan trọng. |
| **B14** | **Decision: External shipping carrier** (GHN/GHTK/VNPost)? Nếu yes → P0/P1 implement; nếu no → publicly disclose "ship handled offline" | Decision | Business + Backend | Hiện không có. |
| **B15** | **Decision: Stock receiving workflow + warranty + serial lifecycle** — nếu shop bán helmet, warranty thường yêu cầu | Decision | Business + Backend | Hiện movement-log only; warranty NFIR. |

---

## 8. UAT Blockers

> Trước khi cho user/business test, phải sửa ít nhất:

| # | Blocker | Why | Owner |
|---|---|---|---|
| U01 | Verify-email POST bug (B08) | Customer flow tổng-thể không complete được | Backend |
| U02 | First SUPER_ADMIN seed (B09) | Admin portal không vào được | DevOps |
| U03 | Staging env config (JWT, internal token, revalidate, mail) (B07 partial) | UAT environment phải sát prod | DevOps |
| U04 | Smoke test data: ít nhất 5–10 product + 1 category + 1 brand + 1 coupon + 1 menu + 1 slider + 1 page chinh-sach + 1 article | Test data | Business + Admin user |
| U05 | Email SMTP working ở staging (verify + order confirmation + reset password) | Customer auth flow | DevOps |
| U06 | MinIO upload & public URL working (B10) | Media flow | DevOps |
| U07 | Documented manual reconcile playbook for BACS (vì auto reconcile không có) | Business team training | Business + Backend |
| U08 | Documented "stuck order" recovery playbook (paid-but-no-order, etc.) | Operational training | Backend + Ops |

---

## 9. Documentation Corrections Needed

> Sau audit, các canonical docs sau cần update để khớp current code:

| File | Section | Vấn đề | Fix |
|---|---|---|---|
| `docs/business/BUSINESS_RULES.md` | AR_RULE_008 | Nói scheduler flag overdue. Audit history (`POS_RECEIVABLES_AUDIT.md` 2026-05-07) ghi "no scheduler calls" — hiện code đã có `ReceivableOverdueScheduler.java` `@Scheduled(cron="0 5 0 * * ?")`. | Add evidence path + status update; clarify resolved 2026-05-08. |
| `docs/business/MODULE_CATALOG.md` | POS row | Nói POS support immediate sale (CASH/CARD_TERMINAL) **and** credit (CREDIT) | Already updated for credit; admin FE row should explicitly mention CREDIT FE coverage. |
| `docs/business/STATE_MACHINES.md` | §10 Return | "Customer-side eligibility rules need deeper audit in `CustomerReturnService`" | Add explicit rules (status, time-window, partial qty) hoặc mark `NEEDS_BUSINESS_CONFIRMATION`. |
| `docs/business/BUSINESS_PROCESS.md` | Process map | Thiếu: invoice process, bank-transfer reconciliation, customer support, data privacy export/delete, fulfillment carrier handoff | Add rows with `NOT_FOUND_IN_REPO` / `NEEDS_BUSINESS_CONFIRMATION` để AI agent biết gap. |
| `docs/business/WORKFLOW_OVERVIEW.md` | Customer Commerce | Thiếu: customer email verification flow + workflow ngữ cảnh BACS reconciliation | Add. |
| `docs/business/ACCEPTANCE_CRITERIA.md` | Multiple rows | Status `PASS` cho POS, Cart, Checkout, Coupon — đúng. Thêm `NEEDS_PRODUCTION_RUNTIME_VERIFICATION` cho email deliverability. | Add release caveat row "Production-ready" verdict. |
| `docs/business/USER_ROLES.md` | Section 13 / 15 — Missing | Đã ghi đúng. Add: WAREHOUSE_STAFF, ACCOUNTANT, SUPPORT_STAFF, CASHIER (đề cập ở `PRODUCTION_READINESS_GATE.md` Section 7 Step 10) → confirm tồn tại trong `AdminRolePermissions.MAP` hoặc remove from PROD_GATE. | Reconcile role count between BUSINESS_RULES.md (7 built-in roles) và PRODUCTION_READINESS_GATE.md (8 built-in roles). |
| `docs/engineering/PERMISSION_MATRIX.md` | Roles table | Tương tự — 7 hay 8 built-in role | Reconcile. |
| `docs/engineering/DATA_CONTRACT.md` | Receivable / Customer credit | Đã update. | OK. |
| `docs/engineering/API_FLOW_MAP.md` | Receivable rows | Đã update with credit flow. | OK. |
| `docs/engineering/TRACEABILITY_MATRIX.md` | "Accounts Receivable: PROPOSED_FOR_AR_MODULE" | Outdated. AR is implemented; status should be `CONFIRMED_BY_TEST` (`AdminReceivableApiTest`). | Update. |
| `docs/audits/POS_RECEIVABLES_AUDIT.md` | Section 1 CRITICAL | "refreshOverdueStatus is dead code — no scheduler" — outdated; code has scheduler now. | Add postscript ghi "RESOLVED 2026-05-08 — see ReceivableOverdueScheduler". |

---

## 10. Recommended Implementation Roadmap

### P0 — Bắt buộc trước production

| Item | Effort | Owner | Reference |
|---|---|---|---|
| 1. Set 5 PROD_CONFIG (JWT secret, internal token, revalidate, Nginx ACL, SSL) | 1–2 days infra | DevOps | `PRODUCTION_READINESS_GATE.md` Section 8 |
| 2. Fix verify-email POST/GET drift in SecurityConfig | 30 min code | Backend | DOCS_VERIFICATION_REPORT 6.1 |
| 3. Seed first SUPER_ADMIN user via DataInitializer or migration runbook | 1 day | Backend + DevOps | `PRODUCTION_READINESS_GATE.md` Section 7 Step 4 |
| 4. Bộ Công Thương TMĐT registration + footer badge | 2–4 weeks legal+business | Legal + Business | Nghị định 52/2013 + 85/2021 |
| 5. Privacy / Terms / Return / Shipping / Complaint policy content (CMS) | 1 week legal+business | Legal + Business | Section 6.1 |
| 6. Email SMTP production smoke test | 0.5 day | DevOps | Section 6.10 |
| 7. MinIO production bucket + ACL + smoke test | 0.5 day | DevOps | (above) |
| 8. Backup runbook + first restore drill | 1–2 days | DevOps | Section 6.10 |
| 9. Decision + initial implementation: e-invoice provider integration (Misa / VNPT / SInvoice / Easyinvoice) | 1–2 weeks | Business + Backend | Section 6.4, B01 |
| 10. Customer-data export + delete endpoint per Nghị định 13/2023 | 3–5 days | Backend | Section 6.1 |
| 11. Bank transfer reconciliation UX + entity + audit (B05) | 1 week | Backend + Admin FE | Section 6.5 |
| 12. Customer support SOP + minimal tooling (Crisp/Zendesk hoặc nội bộ ticket) | 1–2 weeks | Business + DevOps | Section 6.11 |
| 13. Documented operational runbooks: stuck-order recovery, manual reconcile, refund manual | 3–5 days docs | Backend + Ops | Section 8 |

### P1 — Cần cho vận hành ổn định (sau go-live không lâu)

| Item | Effort | Owner |
|---|---|---|
| 1. `refund_transactions` table + per-event refund history (REPORT_RULE_011) | 3–5 days | Backend |
| 2. Decision: external payment provider (VNPAY/MoMo/SePay). Implement 1 trước. | 1–2 weeks | Backend + Business |
| 3. Decision: external shipping carrier (GHN/GHTK/VNPost). Implement 1 trước. | 2–3 weeks | Backend + Business |
| 4. Persistent `notifications` table + read/unread API | 3 days | Backend |
| 5. Stock receiving service + controller + UI (V52/V53/V55 schema → active) | 1–2 weeks | Backend + Admin FE |
| 6. Decision: warranty + product-serial lifecycle | 2–3 weeks | Backend + Business |
| 7. WebSocket per-subscribe topic-level authz hardening | 2 days | Backend |
| 8. POS refund / hoàn tiền tại quầy flow (R4) | 1 week | Backend + Admin FE |
| 9. Customer return eligibility window (status + time-based) | 2 days | Backend |
| 10. Per-transition E2E test for Order, Payment, Product publish | 3–5 days | Backend |
| 11. Idempotency-key TTL job (MED-001) | 1 day | Backend |
| 12. Customer-facing receivable SOA (nếu B2B/đại lý cần) | 1–2 weeks | Backend + Web |

### P2 — Tối ưu / tự động hóa

| Item |
|---|
| Pagination cho `listAdminUsers` (RBAUD-008-LIST) |
| Mobile field-by-field API audit + provider tests |
| Admin SPA Vitest suite |
| Push notification mobile |
| GTM / Analytics finalize |
| Token rotation runbook for `BIGBIKE_INTERNAL_TOKEN` |
| Admin return endpoint envelope normalization (CUSTRET-005) |
| `bb_guest_id` cookie httpOnly (MED-004) |
| Sitemap content audit |

### P3 — Enterprise / scale

| Item |
|---|
| OpenAPI docs gating in production |
| Concurrency oversell test (load test) |
| Read replica + horizontal scale |
| CDN for media |
| Multi-warehouse / multi-store / multi-tenant |
| Marketplace integrations |

---

## 11. Test Plan Required

> Tests đề xuất bổ sung (chia theo tier).

### 11.1 Unit tests (P1)

| Test | Module | Why |
|---|---|---|
| Refund period attribution unit test | `RefundService` | Lock REPORT_RULE_011 limitation explicit |
| Receivable scheduler unit test | `ReceivableOverdueScheduler` | Smoke + dry-run logic |
| `AdminMutationValidators.validatePublishTransition` matrix expansion | catalog | Already 5 tests; add full matrix |

### 11.2 Integration tests — backend (P0/P1)

| Test | Coverage gap |
|---|---|
| POS CREDIT → receivable → record_payment → write-off full chain | Section 5.3 |
| Order per-transition E2E | All 7 status transitions |
| Order paymentStatus per-transition E2E | 8 status combinations |
| Stock oversell concurrency | `Phase1FCheckoutApiTest` extension |
| Coupon double-redeem race | `Phase1ECartApiTest` extension |
| Customer return eligibility window | New |
| verify-email POST end-to-end | After SecurityConfig fix |
| verify-email rate-limit | Add |
| Idempotency key TTL job | Add |
| Bank transfer reconciliation entity + audit | After B05 |
| Invoice service + provider mock | After B01 |

### 11.3 API tests

| Test | Coverage gap |
|---|---|
| Customer-data export | After Nghị định 13/2023 endpoint |
| Customer-data delete | (above) |
| Notification center read/unread | After Section 6.12 |

### 11.4 UI tests — admin (P2)

| Test | Coverage gap |
|---|---|
| Vitest suite for admin SPA — entire admin currently has 0 test | Whole module |
| POS CREDIT flow UI smoke | New |
| RecordPaymentModal validation | New |
| WriteOffModal mandatory reason | New |

### 11.5 UI tests — web (P2)

| Test | Coverage gap |
|---|---|
| Customer auth E2E (Playwright/Vitest) | Currently only schema/route tests |
| Cart/checkout customer flow | New |
| Return creation flow | New |

### 11.6 UI tests — mobile (P2)

| Test | Coverage gap |
|---|---|
| Provider tests for cart/auth/checkout | Currently model-only |
| Widget integration smoke | (above) |

### 11.7 E2E tests

| Test | Coverage gap |
|---|---|
| Browser E2E (Playwright/Cypress) for guest checkout | None today |
| Admin POS happy-path E2E | None today |
| Admin order status update + audit + WS event | None today |

### 11.8 Permission negative tests

| Test | Coverage gap |
|---|---|
| SHOP_MANAGER cannot write_off | None explicit |
| EDITOR cannot pos.write | (extend RbacUrlGate) |
| AUTHOR cannot products.update | (above) |
| SEO_EDITOR cannot orders.write | (above) |
| Custom-role permission boundary | New |

### 11.9 Concurrency / idempotency tests

| Test | Coverage gap |
|---|---|
| Concurrent checkout same idempotency key | Implicit; expand |
| Concurrent stock decrement multi-worker | New |
| Concurrent coupon redemption double-spend | New |
| Concurrent receivable record_payment | New |

### 11.10 Scheduler tests

| Test | Coverage gap |
|---|---|
| `CouponExpiryScheduler` actual invocation under @Scheduled | None direct |
| `ReceivableOverdueScheduler` actual invocation | None direct |
| Idempotency key TTL job | After P1 #11 |

### 11.11 Webhook tests

| Test | Coverage gap |
|---|---|
| Future: external payment provider webhook signature verify + idempotency | After P1 #2 |
| Future: shipping carrier callback | After P1 #3 |

### 11.12 Report metric tests

| Test | Coverage gap |
|---|---|
| GMV vs paidRevenue divergence with REFUNDED orders | `AdminReportApiTest` covers |
| Refund attribution by placedAt vs refundedAt — explicit limitation lock | New (REPORT_RULE_011) |
| Topcustomer email-changed dedup | `AdminReportRepositoryQueryTest` (Docker only) |
| TZ Asia/Ho_Chi_Minh boundary edge | `AdminReportRepositoryQueryTest` (Docker) |

---

## 12. Final Verdict

### 12.1 Có đủ để vận hành thật chưa?

**Không.** Code path business chính (cart, checkout, order, refund, return, POS, AR, inventory, content, RBAC, audit) đã đầy đủ và pass test. Backend test suite đạt **1016/1017** (Docker INFRA_FAIL only). Tuy nhiên **15 production blocker** ở Section 7 chưa giải quyết.

### 12.2 Vì sao chưa?

**3 nhóm gap chính**:

#### a) Operational Reality Gap (5 P0)
- Invoice / e-invoice (B01) → vi phạm Nghị định 123/2020.
- Bank transfer reconciliation (B05) → mất tiền do lỗi nhân viên đối soát tay.
- Refund history (B06) → sai số liệu kế toán refund.
- First SUPER_ADMIN seed (B09) → admin portal không dùng được.
- Backup runbook (B11) → risk mất data vĩnh viễn.

#### b) Legal / Compliance Gap (5 NLC)
- Bộ Công Thương TMĐT registration + footer badge (B02).
- Privacy / Terms / Return / Shipping / Complaint policy content (B03).
- Customer-data export/delete per Nghị định 13/2023 (B04).
- Customer support / dispute handling SOP + tooling (B12).
- Email/MinIO production smoke (B10).

#### c) Infra / Config Gap (5 P1)
- JWT secret strong (B07a)
- Internal token pairing (B07b)
- Revalidate URL/secret pair (B07c)
- Nginx ACL `/api/internal/**` (B07d)
- SSL/TLS termination (B07e)

### 12.3 Cần sửa những gì trước? (theo P0 roadmap Section 10)

**Code gap** (P0 implement):
1. Verify-email POST/GET drift fix (30 min) — backend
2. Invoice service + provider integration (1–2 tuần) — backend + business
3. Customer-data export + delete (3–5 ngày) — backend
4. Bank transfer reconciliation entity + admin UI + audit (1 tuần) — backend + admin FE

**Docs gap** (apply Section 9 ở dưới):
5. Section 9 corrections — sửa AR_RULE_008 evidence, role count reconcile, BUSINESS_PROCESS coverage cho missing flows, TRACEABILITY_MATRIX AR row, POS_RECEIVABLES_AUDIT postscript

**Legal / business confirmation gap**:
6. Bộ Công Thương registration (legal action — 2–4 tuần)
7. CMS policy content review (legal + content — 1 tuần)
8. Customer support SOP + tool decision (business — 1–2 tuần)
9. Decision + commit: invoice provider, payment provider strategy, shipping carrier strategy, warranty/serial strategy
10. Backup runbook + first restore drill (DevOps — 1–2 ngày)

### 12.4 Phân loại final

| Loại gap | Số lượng | Tác động |
|---|---|---|
| Code gap | 4 (B01, B05, B06, B08) + 5 P1 follow-ups | Functionality hoặc data integrity |
| Docs gap | ~10 row corrections | Docs hơi lệch code (không nghiêm trọng) |
| Legal / business confirmation gap | 5 | NEEDS_LEGAL_CONFIRMATION + NEEDS_BUSINESS_CONFIRMATION |
| Infra / ops gap | 5 PROD_CONFIG + 3 ops runbook | Deploy mặc định = unsafe |
| **Total production blockers** | **15** | **Cần giải quyết trước go-live** |

### 12.5 Lời cuối

BigBike codebase ở mức **kỹ thuật engineering đã rất chỉn chu**: 41 controller, 70 service, 82 migration, 1016 test pass, status label nhất quán, audit trail rõ ràng. Cycle 10 audit (`PRODUCTION_READINESS_GATE.md`) đã commit "CONDITIONAL GO" — đúng cho mức kỹ thuật.

Tuy nhiên **e-commerce vận hành thật không dừng ở code-pass**. Phần còn lại (invoice / Bộ Công Thương / shipping carrier / customer support / payment reconciliation / data privacy) là **operational + legal**, không thể giải bằng code-fix nhanh. Một số yêu cầu **business decision** (provider chọn cái nào, warranty có cần không, payment online có cần không), nên cần product/business team commit trước khi engineer code tiếp.

**Khuyến nghị**:
- **Không** ép go-live "soft launch" trên domain bigbike.vn nếu chưa giải quyết B01, B02, B03 (3 blocker pháp lý).
- Có thể go-live "internal staging" (UAT cho team nội bộ + 1–2 đại lý gần) ngay sau khi xử lý U01–U08.
- Lập "production checklist" gồm 15 blocker ở Section 7, treo lên dashboard, gate go-live theo % completion.

---

## Appendix A — Reuse Statement

Audit này reuse evidence từ:
- `docs/audits/PRODUCTION_READINESS_GATE.md` (cycle 10, 2026-05-08, build evidence: 1016/1017 tests pass)
- `docs/audits/E2E_WORKFLOW_MASTER_INVENTORY.md` (2026-05-07, 109 E2E workflows, 67 modules)
- `docs/audits/POS_RECEIVABLES_AUDIT.md` + `POS_RECEIVABLES_FIX_REPORT.md`
- `docs/DOCS_VERIFICATION_REPORT.md` (2026-05-04 + 2026-05-05)

Audit này **không** chạy build/test/deploy/migration. Mọi claim về test pass/fail dựa vào audit trail evidence ở các file trên đã được spot-check chéo với source code (grep, file read) trong audit này.

## Appendix B — Disclaimer

- Audit không thay thế **legal review** chuyên nghiệp. NLC (NEEDS_LEGAL_CONFIRMATION) flag yêu cầu confirm với luật sư / kế toán / chủ doanh nghiệp.
- Audit không thay thế **production runtime verification**. NPRV flag yêu cầu test trên production-like environment với thật DB / SMTP / MinIO / Nginx.
- Mọi đánh giá `CONFIRMED_BY_TEST` dựa vào pass status từ audit trail, không phải actual `mvnw test` trong audit này.
- Memory file `project_sepay_manual.md` (2026-05-01) ghi SePay manual mode — current code đã remove SePay (V59); status `NFIR` cho external payment provider.

---

> **Maintenance**: Khi blocker được resolve, update Section 7 + Section 12. Khi docs canonical được fix theo Section 9, cập nhật lại file này để reflect "RESOLVED".
