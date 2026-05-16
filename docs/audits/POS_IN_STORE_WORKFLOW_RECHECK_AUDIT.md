# POS / In-store Sale Workflow — RECHECK Audit

**Ngày**: 2026-05-15
**Fix áp dụng**: 2026-05-16 — tất cả R-01 đến R-06 đã được fix. Xem mô tả bên dưới.
**Phạm vi**: Bán trực tiếp tại quầy (channel `IN_STORE` / source `pos`) — CASH / CARD_TERMINAL / CREDIT + refund + serial + công nợ + permission + audit.
**Loại**: Re-check sau `POS_IN_STORE_WORKFLOW_PRODUCTION_READY_AUDIT.md` (2026-05-14) và `POS_IN_STORE_WORKFLOW_FIX_REPORT.md`.
**Phương pháp**: Trace code thật UI → API → service → DB → migration → test. **Không sửa code.**
**Reviewer**: Senior Engineer/Architect (audit-only).

> **STATUS: FIXED (2026-05-16)** — All findings R-01 through R-06 addressed. See fix summary at bottom of this file.

---

## 1. Executive Summary

Đợt fix 2026-05-14 đã xử lý đúng các blocker của audit cũ: refund serial khôi phục tồn kho + void warranty (`SerialLifecycleService.restoreSoldSerialsForRefund`), tách permission `pos.refund`, FE cart mang cờ `hasSerial`, audit enrich, `cardReferenceNumber` vào `payment.transactionId`. Các điểm này **đã verify lại = PASS**.

**Tuy nhiên, SAU đợt fix đó, hai migration `V114` (rút gọn `payment_status` còn 4 giá trị) và `V116` (thêm CHECK constraint) đã thay đổi mô hình thanh toán toàn hệ thống.** Backend POS + test suite đã được cập nhật theo (downPayment bị bỏ, partial refund bị từ chối). **Nhưng frontend POS, service công nợ, và bộ tài liệu KHÔNG được cập nhật đồng bộ.** Đây là nguồn gốc của các lỗi nghiêm trọng dưới đây.

**Phát hiện chính:**

| # | Mức | Vấn đề |
|---|---|---|
| **R-01** | **P0** | `ReceivableService.writeOff()` ghi `payment_status = 'WRITTEN_OFF'` vào bảng `orders`, nhưng CHECK constraint `ck_orders_payment_status` (V116) **chỉ cho phép** `UNPAID/PAID/REFUNDED/CANCELLED`. → Xoá nợ xấu của đơn công nợ POS **sẽ fail bằng lỗi DB trên Postgres production**. Test chạy H2 không bắt được. |
| **R-02** | **P1** (ảnh hưởng tài chính mức P0) | FE POS vẫn hiển thị ô nhập **"Thanh toán trước" (downPayment)** cho đơn CREDIT và **vẫn gửi `downPayment` lên backend**, nhưng `PosOrderService.createOrder()` **bỏ qua hoàn toàn** field này. Nhân viên thu tiền mặt đặt cọc của khách → hệ thống ghi nhận **đơn UNPAID, công nợ = full, không có payment record**. Tiền cọc khách đưa **biến mất khỏi sổ sách**. |
| **R-03** | **P2** | FE `RefundDialog` cho sửa số tiền hoàn (`<Input type=number>` editable, validate `amountExceeds`) ngụ ý hỗ trợ hoàn một phần. Backend `RefundService` **chỉ chấp nhận hoàn đúng toàn bộ** — nhập số khác sẽ bị reject 400. UI-BE gap gây nhầm lẫn vận hành. |
| **R-04** | **P2** | Audit flag `creditLimitOverridden` là **false positive**: gán `true` cho **mọi** đơn CREDIT tạo bởi user có quyền override, kể cả đơn trong hạn mức. Compliance không lọc được đơn thực sự vượt hạn mức. |
| **R-05** | **P2** | Sản phẩm **không có biến thể + không track serial** (chỉ có `product.stockQuantity`) **không bán được trên POS** — không hiển thị card search, và `createOrder` cũng reject. Cần xác nhận catalog có loại sản phẩm này không. |
| **R-06** | **P2/P3** | Docs drift diện rộng: `BUSINESS_RULES.md`, `API_CONTRACT.md`, `API_FLOW_MAP.md`, `DATA_CONTRACT.md`, `GLOSSARY.md`, `STATE_MACHINES.md` còn mô tả `downPayment`, `PARTIALLY_PAID`, `PARTIALLY_REFUNDED`, partial payment — tất cả đã bị V114 loại bỏ. |

**Đã verify lại = PASS** (không còn là vấn đề): refund serial → IN_STOCK + warranty VOIDED; idempotency tạo đơn; permission `pos.read/write/price_override/refund`; tách `pos.refund` cho ADMIN; index báo cáo POS (V113); `cardReferenceNumber` → `transactionId`; `@Version` chống double-refund đồng thời.

---

## 2. Verdict

> ## ⚠️ READY WITH CONDITIONS — KHÔNG launch full nếu chưa fix R-01 và R-02

| Nhánh workflow | Verdict | Điều kiện |
|---|---|---|
| **POS CASH bán hàng non-serial** | ✅ **READY** | Có thể launch. R-03 (UX refund một phần) nên fix nhưng không chặn. |
| **POS CARD_TERMINAL non-serial** | ✅ **READY** | Có thể launch. |
| **POS bán hàng serial-tracked (CASH/CARD)** | ✅ **READY** | Sale + full refund đã đúng và có test. Lưu ý nghiệp vụ: serial hoàn về thẳng `IN_STOCK` không qua inspection (xem §9). |
| **POS CREDIT (bán chịu)** | ❌ **NOT READY** | Bị chặn bởi **R-02** (tiền cọc biến mất) và **R-01** (không xoá nợ được). Phải fix trước khi mở bán chịu tại quầy. |

**Kết luận top-line**: Workflow mua hàng trực tiếp **trả tiền ngay (CASH/CARD)** đã trơn tru, an toàn, đủ điều kiện production. Workflow **bán chịu (CREDIT)** **chưa launch được** — có 1 lỗi P0 (xoá nợ vi phạm constraint DB) và 1 lỗi P1 ảnh hưởng tài chính (tiền cọc downPayment bị nuốt).

---

## 3. End-to-End Flow Map

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ ADMIN POS UI — bigbike-admin/src/screens/PosScreen.jsx                        │
│  props (App.jsx:416): canUpdate=pos.write, canOverridePrice=pos.price_override │
│                       canOverrideCreditLimit=receivables.override_limit       │
│                       canRefund=pos.refund, userId                            │
│  Cart: localStorage 'pos_cart', TTL 8h, scope theo userId                      │
│  PaymentModal: CASH | CARD_TERMINAL | CREDIT                                   │
│   └─ CREDIT: ô "Thanh toán trước" (downPayment)  ⚠️ R-02 — BE bỏ qua field này │
└───────────────┬────────────────────────────────────────────────────────────────┘
                │ posSearchProducts / posCreateOrder / posCreateRefund
                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ AdminPosController                                                            │
│  GET  /admin/pos/products/search          requirePermission("pos.read")        │
│  POST /admin/pos/orders                   requirePermission("pos.write")       │
│  POST /admin/pos/orders/{id}/refund       requirePermission("pos.refund")  ✅   │
└───────────────┬────────────────────────────────────────────────────────────────┘
                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ PosOrderService.createOrder()  @Transactional                                 │
│  1. validate items / paymentMethod / quantity>0                                │
│  2. CREDIT → load CustomerEntity (customerId bắt buộc)                          │
│  3. Idempotency: findByOrderKey(posIdempotencyKey) → trả đơn cũ nếu có          │
│  4. mỗi item: findByIdForUpdate(product PUBLISHED) + variant thuộc product +    │
│     available + serial countAvailable / non-serial quantityOnHand               │
│  5. unitPriceOverride → cần canOverridePrice                                    │
│  6. CREDIT → creditPolicyService.validateCreditEligibility()                    │
│  7. coupon POS (channel/customer/min/usage) nếu có                              │
│  8. CASH → assert tenderedAmount >= total (chỉ khi field được gửi)              │
│  9. OrderEntity: channel=IN_STORE, fulfillmentType=IN_STORE, source=pos,        │
│     status=COMPLETED, paymentStatus = CREDIT?UNPAID:PAID                        │
│     ⚠️ downPayment KHÔNG được đọc → CREDIT luôn UNPAID, paidAmount=0             │
│ 10. applyPosStock: serial reserve→markSold / non-serial qty-- + stock_movement  │
│ 11. PaymentEntity (provider=POS, PAID) — CHỈ khi !CREDIT                        │
│ 12. CREDIT → receivableService.createReceivableForOrder(downPayment=ZERO)       │
│ 13. OrderNote SYSTEM + AuditLog POS_ORDER_CREATED/POS_CREDIT_ORDER_CREATED      │
│ 14. wsService NEW_ORDER                                                         │
│ 15. response: orderId, status, paymentStatus, totalAmount, tendered, change,    │
│     paidAmount, refundAmount, items[]                                           │
└───────────────┬────────────────────────────────────────────────────────────────┘
                ▼  POST /admin/pos/orders/{id}/refund  (pos.refund)
┌──────────────────────────────────────────────────────────────────────────────┐
│ RefundService.applyRefund()  @Transactional                                   │
│  - order.paymentStatus PHẢI = 'PAID'  (PARTIALLY_PAID/PARTIALLY_REFUNDED reject)│
│  - refundAmount PHẢI = paidAmount - alreadyRefunded  (KHÔNG hỗ trợ partial)     │
│  - order.status=REFUNDED, paymentStatus=REFUNDED                                │
│  - wasCompleted → orderStockRestoreService.restoreForRefund (non-serial)        │
│                 + serialLifecycleService.restoreSoldSerialsForRefund (serial)   │
│  - receivable không CLOSED/WRITTEN_OFF → WRITTEN_OFF (chỉ chạm AR row)          │
│  - PaymentEntity REFUNDED + RefundTransactionEntity ledger + OrderNote + audit  │
└──────────────────────────────────────────────────────────────────────────────┘

CÔNG NỢ (sau bán chịu):
  recordPayment  → AR paidAmount++; order→PAID khi thu đủ            ✅ OK
  writeOff       → AR WRITTEN_OFF  +  order.paymentStatus='WRITTEN_OFF'  ❌ R-01 (vi phạm constraint)
```

Evidence chính:
- [AdminPosController.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminPosController.java)
- [PosOrderService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java)
- [RefundService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/payment/RefundService.java)
- [SerialLifecycleService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/SerialLifecycleService.java)
- [ReceivableService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/receivable/ReceivableService.java)
- [PosScreen.jsx](../../bigbike-admin/src/screens/PosScreen.jsx)
- [V114__migrate_payment_status_simplified.sql](../../bigbike-backend/src/main/resources/db/migration/V114__migrate_payment_status_simplified.sql), [V116__order_status_check_constraints.sql](../../bigbike-backend/src/main/resources/db/migration/V116__order_status_check_constraints.sql)

---

## 4. Case Matrix

| # | Case | Expected | Actual | Verdict | Evidence |
|---|---|---|---|---|---|
| 1 | CASH non-serial happy path | COMPLETED, PAID, paidAmount=total, stock--, payment(POS,PAID), audit, WS | đúng | **PASS** | [PosOrderService.java:341-446](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L341-L446); test `createPosCashOrder_succeeds…` |
| 2 | CASH — tendered < total | reject 409 | đúng | **PASS** | [PosOrderService.java:333-339](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L333-L339); test `…cashInsufficientTendered_returns409` |
| 3 | CASH — không gửi tenderedAmount | (tuỳ chọn) order vẫn PAID | đúng — không validate khi field null; cashier tự xác nhận | **PASS** (P3 note) | [PosOrderService.java:333](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L333) |
| 4 | CARD_TERMINAL + cardReferenceNumber | payment.transactionId = ref + ghi note | đúng | **PASS** | [PosOrderService.java:439-442](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L439-L442) |
| 5 | CREDIT — không downPayment | COMPLETED+UNPAID, paidAmount=0, receivable OPEN outstanding=total | đúng | **PASS** | test `createPosCreditOrder_withoutDownPayment…` |
| 6 | **CREDIT — có downPayment** | thu cọc → ghi nhận tiền đã thu | **SAI** — BE bỏ qua field; cọc khách đưa không vào hệ thống | **FAIL R-02** | [PosOrderService.java:69-70,353,370,430,452](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L353); FE [PosScreen.jsx:161,406-422](../../bigbike-admin/src/screens/PosScreen.jsx#L161) |
| 7 | CREDIT — creditEnabled=false | reject 409 | đúng | **PASS** | [CreditPolicyService.java:40-42](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/receivable/CreditPolicyService.java#L40-L42) |
| 8 | CREDIT — vượt hạn mức, không override | reject 409 | đúng | **PASS** | [CreditPolicyService.java:49-59](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/receivable/CreditPolicyService.java#L49-L59); test `creditSale_shopManager_overCreditLimit_returns409` |
| 9 | CREDIT — vượt hạn mức, có `receivables.override_limit` | allow + audit đánh dấu override | allow OK; **audit flag sai** — `creditLimitOverridden=true` cho cả đơn KHÔNG vượt hạn mức | **PARTIAL R-04** | [PosOrderService.java:476](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L476) |
| 10 | Price override không quyền | reject 409 | đúng | **PASS** | [PosOrderService.java:217-220](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L217-L220); test cover |
| 11 | Price override có quyền | allow, total đúng; FE chỉ hiện nút sửa giá khi `canOverridePrice` | đúng | **PASS** | [PosScreen.jsx:1053](../../bigbike-admin/src/screens/PosScreen.jsx#L1053); test cover |
| 12 | Idempotency — retry cùng key | trả đơn cũ, không trừ kho 2 lần | đúng (order_key UNIQUE + catch DataIntegrityViolation) | **PASS** | [PosOrderService.java:189-203,387-403](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L189-L203); test cover |
| 13 | Idempotency — cùng key, payload khác | — | trả đơn cũ, **bỏ qua payload mới không cảnh báo** | **PARTIAL** (P3) | [PosOrderService.java:189-203](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L189-L203) |
| 14 | Serial-tracked sale | reserve→SOLD, warranty ACTIVE, qty sync qua trigger | đúng | **PASS** | test `posRefund_fullRefundSerialTrackedOrder…` (phần before-refund) |
| 15 | **Serial full refund** | serial SOLD→IN_STOCK, warranty VOIDED, stock_movement ORDER_REFUND_SERIAL | đúng (đã fix) | **PASS** | [SerialLifecycleService.java:332-366](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/SerialLifecycleService.java#L332-L366); test cover |
| 16 | Non-serial full refund | order/payment REFUNDED, qty+N, receivable cancel, ledger, audit | đúng | **PASS** | [RefundService.java:147-151](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/payment/RefundService.java#L147-L151); test cover |
| 17 | **Non-serial partial refund** | — | BE **reject 400** (không hỗ trợ partial); FE vẫn cho nhập số tiền lẻ | **PARTIAL R-03** | [RefundService.java:113-118](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/payment/RefundService.java#L113-L118); FE [PosScreen.jsx:615-624](../../bigbike-admin/src/screens/PosScreen.jsx#L615-L624) |
| 18 | Refund CREDIT — UNPAID | reject 409 | đúng | **PASS** | [RefundService.java:100-103](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/payment/RefundService.java#L100-L103); test `posRefund_creditUnpaidOrder_returns409` |
| 19 | Refund vượt paidAmount | reject 400 | đúng | **PASS** | [RefundService.java:113-118](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/payment/RefundService.java#L113-L118); test cover |
| 20 | Refund không có `pos.refund` | 403 | đúng (SHOP_MANAGER → 403) | **PASS** | [AdminPosController.java:133](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminPosController.java#L133); test cover |
| 21 | Refund 2 lần / đồng thời | không double restore | đúng — lần 2 thấy order REFUNDED → 409; đồng thời chặn bằng `@Version` | **PASS** | [OrderEntity.java:142-144](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/commerce/order/OrderEntity.java#L142-L144); idempotency guard `existsByReferenceType…` |
| 22 | **Write-off công nợ đơn POS CREDIT** | AR WRITTEN_OFF + order chuyển trạng thái | **SAI** — ghi `WRITTEN_OFF` vào `orders.payment_status` vi phạm CHECK `ck_orders_payment_status` → fail | **FAIL R-01** | [ReceivableService.java:217-225](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/receivable/ReceivableService.java#L217-L225); [V116:9-11](../../bigbike-backend/src/main/resources/db/migration/V116__order_status_check_constraints.sql#L9-L11) |
| 23 | Thu nợ (recordPayment) đơn CREDIT | AR paidAmount++; order→PAID khi thu đủ | đúng | **PASS** | [ReceivableService.java:148-158](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/receivable/ReceivableService.java#L148-L158) |
| 24 | Sản phẩm có serial cấp product (không variant) | bán được, refund đúng | sale OK (synthetic variant); refund OK (bridge theo orderLineItem) — **chưa có test** | **PASS (test gap)** | [AdminPosController.java:80-98](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminPosController.java#L80-L98); [PosOrderService.java:259-270,571-578](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L259-L270) |
| 25 | Sản phẩm không variant + không serial (chỉ stockQuantity) | bán được trên POS | **không bán được** — search không render card, `createOrder` reject | **PARTIAL R-05** | [AdminPosController.java:80-82](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminPosController.java#L80-L82); [PosOrderService.java:259-270](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L259-L270) |
| 26 | Out-of-stock product/variant vào cart | bị chặn | đúng — FE filter `stockQuantity>0` + disabled; BE re-validate 409 | **PASS** | [PosScreen.jsx:977,987](../../bigbike-admin/src/screens/PosScreen.jsx#L977) |
| 27 | Cart stale stock/price | không sai đơn | đúng — không override giá → BE resolve giá tươi từ DB; stock stale → BE reject 409 | **PASS** | [PosScreen.jsx:145-150](../../bigbike-admin/src/screens/PosScreen.jsx#L145-L150); [PosOrderService.java:272-280](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L272-L280) |
| 28 | Receipt sau khi tạo đơn thành công | hiển thị items, total, tiền thừa, in được | đúng — items lấy từ BE response | **PASS** | [PosScreen.jsx:669-748](../../bigbike-admin/src/screens/PosScreen.jsx#L669-L748) |
| 29 | Receipt sau khi F5 / mất state FE | in lại được | **không** — `lastOrder` là React state, mất khi reload; không có đường in lại từ Order detail | **PARTIAL** (P2) | [PosScreen.jsx:840,1126-1134](../../bigbike-admin/src/screens/PosScreen.jsx#L840) |
| 30 | Popup print bị chặn | fallback | đúng — fallback hidden iframe | **PASS** | [PosScreen.jsx:516-538](../../bigbike-admin/src/screens/PosScreen.jsx#L516-L538) |
| 31 | Báo cáo doanh thu POS theo ngày/nhân viên | có index | đúng — V113 thêm `idx_orders_channel_placed_at`, `idx_orders_staff_placed_at` | **PASS** | [V113](../../bigbike-backend/src/main/resources/db/migration/V113__add_pos_report_indexes.sql) |

---

## 5. Backend Findings

### 5.1. R-01 (P0) — `ReceivableService.writeOff()` vi phạm CHECK constraint `ck_orders_payment_status`

[ReceivableService.java:217-225](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/receivable/ReceivableService.java#L217-L225):

```java
// Update order paymentStatus to WRITTEN_OFF (POSREC-006)
OrderEntity order = orderRepo.findById(ar.getOrderId()).orElse(null);
if (order != null) {
    order.setPaymentStatus("WRITTEN_OFF");   // ← giá trị không hợp lệ
    orderRepo.save(order);
}
```

[V116__order_status_check_constraints.sql:9-11](../../bigbike-backend/src/main/resources/db/migration/V116__order_status_check_constraints.sql#L9-L11):

```sql
alter table orders
    add constraint ck_orders_payment_status
        check (payment_status in ('UNPAID','PAID','REFUNDED','CANCELLED'));
```

`WRITTEN_OFF` **không nằm** trong tập hợp lệ. Khi admin xoá nợ một đơn công nợ POS (`POST /admin/receivables/{id}/write-off`), `orderRepo.save(order)` sẽ ném `DataIntegrityViolationException` (constraint violation) trên **PostgreSQL production** → toàn bộ transaction write-off rollback → **không xoá được nợ xấu nào**.

**Tại sao test không bắt được**: `Phase1MPosApiTest` và các test khác chạy trên **H2** với `@Sql("/db/test-seed.sql")`. Tuỳ cấu hình, H2 có thể không áp dụng đúng CHECK constraint của Flyway, hoặc bộ test không exercise `writeOff` end-to-end. Lỗi chỉ lộ trên Postgres.

`V114` được tạo SAU `POS_IN_STORE_WORKFLOW_FIX_REPORT` (2026-05-14): nó rút gọn `payment_status` và *cố tình* loại `PARTIALLY_PAID`/`PARTIALLY_REFUNDED`, nhưng **không loại `WRITTEN_OFF`** khỏi code `ReceivableService.writeOff` (vốn có từ trước, comment `POSREC-006`). V116 đóng băng tập 4 giá trị → biến đoạn code này thành bom hẹn giờ.

> Lưu ý: `RefundService` (refund đơn) đặt `order.paymentStatus = "REFUNDED"` — **hợp lệ**. Vấn đề chỉ ở `ReceivableService.writeOff`. Block `RefundService` huỷ AR (line 162-172) chỉ chạm `accounts_receivable.status`, không chạm `orders` → an toàn.

**Cần chốt nghiệp vụ**: đơn công nợ bị xoá nợ nên có `payment_status` gì? Hai hướng fix ở §13.

### 5.2. R-02 (P1, ảnh hưởng tài chính P0) — `downPayment` là field chết ở backend

`PosCreateOrderRequest` vẫn khai báo `Long downPayment` và `String downPaymentMethod` ([PosOrderService.java:69-70](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L69-L70)) kèm comment "partial upfront payment for CREDIT orders". **Nhưng toàn bộ `createOrder()` không hề đọc `req.downPayment()` / `req.downPaymentMethod()`.** Hệ quả với đơn CREDIT:

- `paymentStatus = "UNPAID"` cứng ([L353](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L353)).
- `paidAmount = ZERO` cứng ([L370](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L370)).
- **Không tạo `PaymentEntity`** — `if (!isCreditOrder)` ([L430](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L430)).
- Receivable tạo với downPayment = `BigDecimal.ZERO` cứng → `outstandingAmount = total` ([L452](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L452)).

Test `createPosCreditOrder_withDownPaymentField_isIgnored_orderStartsUnpaid` ([Phase1MPosApiTest.java:448-479](../../bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1MPosApiTest.java#L448-L479)) **xác nhận chủ ý** rằng field bị bỏ qua. Nghĩa là backend được cố tình đơn giản hoá; **lỗi nằm ở FE chưa được dọn** (xem §6.1).

**Hậu quả tài chính**: nhân viên nhập "Thanh toán trước 300.000đ", khách đưa 300k tiền mặt → hệ thống ghi đơn UNPAID, công nợ = full 100%, không payment record. **300k vào ngăn kéo nhưng không có vết trên sổ.** Khách bị ghi nợ nhiều hơn thực tế; khi thu nợ lần sau dễ thu nhầm/thu thừa. Đây là lỗi xử lý tiền — nên được ưu tiên fix ngang P0 dù phân loại UI-BE gap là P1.

### 5.3. R-04 (P2) — Audit flag `creditLimitOverridden` false positive

[PosOrderService.java:476](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L476):

```java
boolean creditLimitOverridden = isCreditOrder && canOverrideCreditLimit && creditCustomer != null;
```

Flag chỉ phản ánh "user CÓ quyền override" + "là đơn CREDIT" — **không** phản ánh "đơn này có THỰC SỰ vượt hạn mức". ADMIN luôn có `receivables.override_limit` → **mọi** đơn công nợ do ADMIN tạo đều bị gắn `creditLimitOverridden:true`, kể cả đơn nhỏ trong hạn mức. Compliance/finance không thể lọc đơn thực sự vượt hạn mức. Để đúng, `CreditPolicyService.validateCreditEligibility` cần trả về cờ "đã thực sự dùng override".

### 5.4. Idempotency — payload khác cùng key (P3)

[PosOrderService.java:189-203](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L189-L203): nếu retry cùng `posIdempotencyKey` nhưng payload khác (items/tiền khác), hệ thống **trả về đơn cũ, im lặng bỏ qua payload mới**. An toàn về mặt không tạo trùng, nhưng client bị hiểu nhầm là payload mới đã được xử lý. Trên thực tế FE sinh key mới mỗi lần mở `PaymentModal` nên ít xảy ra; chỉ là rủi ro khi gọi API thủ công. Đề xuất: so sánh hash payload, trả 409 nếu lệch.

### 5.5. `markSoldForOrder` gọi lặp trong vòng lặp (P3)

[PosOrderService.java:576,590](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L576): `applyPosStock` gọi `serialLifecycleService.markSoldForOrder(orderId)` **mỗi line item serial**; mỗi lần quét toàn bộ bridge của đơn. Idempotent nên không sai, chỉ O(N²) thừa. Nên gọi 1 lần sau vòng lặp.

### 5.6. Line item `regularPrice`/`salePrice` lấy từ product, không từ variant (P3)

[PosOrderService.java:295-296](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L295-L296): `li.setRegularPrice(product.getRetailPrice())`, `li.setSalePrice(product.getSalePrice())` — trong khi `unitPrice` lại resolve theo variant. Với variant có giá riêng, snapshot `regularPrice` trên dòng hàng sai. Không ảnh hưởng tổng tiền (dùng `unitPrice`), chỉ sai dữ liệu so sánh/hiển thị.

### 5.7. Những điểm đã verify lại = PASS

- POS search: `requirePermission("pos.read")`, filter `PUBLISHED`, N+1 có chủ đích (≤20 kết quả).
- `cardReferenceNumber` → `payment.transactionId` cho CARD_TERMINAL ([L439-442](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L439-L442)) — audit cũ flag P2, **đã fix**.
- Audit payload enrich `priceOverridden`, `items[]` ([L473-499](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L473-L499)) — đủ orderId/orderNumber/staffId/totalAmount/couponCode/itemSummary + IP + UA.
- Receivable creation fail → rethrow → rollback toàn bộ đơn ([L449-458](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L449-L458)).
- Concurrency: `findByIdForUpdate` cho product/variant non-serial; `FOR UPDATE SKIP LOCKED` cho serial.

---

## 6. Frontend Findings

### 6.1. R-02 (P1) — UI vẫn nhập và gửi `downPayment` trong khi backend bỏ qua

[PosScreen.jsx](../../bigbike-admin/src/screens/PosScreen.jsx):
- `const [downPayment, setDownPayment] = useState('')` ([L57](../../bigbike-admin/src/screens/PosScreen.jsx#L57)).
- Ô input "Thanh toán trước (tùy chọn)" hiển thị cho đơn CREDIT, placeholder *"0 = ghi nợ toàn bộ"* ([L406-422](../../bigbike-admin/src/screens/PosScreen.jsx#L406-L422)).
- Payload CREDIT: `...(downPaymentNum > 0 ? { downPayment: downPaymentNum } : {})` ([L161](../../bigbike-admin/src/screens/PosScreen.jsx#L161)) → **FE chủ động gửi `downPayment`**.

Backend nhận field nhưng bỏ qua hoàn toàn (§5.2). Nhân viên thấy ô "Thanh toán trước", tin rằng nhập vào là thu tiền cọc — nhưng tiền đó **không được ghi nhận**. Đây là **UI-BE GAP P1, hệ quả tài chính P0**.

Fix dứt khoát — chọn 1 trong 2 (xem §13):
- **(A) Bỏ hẳn downPayment**: xoá state + ô input + field trong payload ở FE; xoá `downPayment`/`downPaymentMethod` khỏi `PosCreateOrderRequest`. Phù hợp với mô hình đã đơn giản hoá (V114) + memory "BigBike không tích hợp cổng thanh toán tự động". Nếu khách muốn trả trước, dùng luồng `recordPayment` công nợ ngay sau khi tạo đơn.
- **(B) Implement đầy đủ**: backend đọc `downPayment` → tạo `PaymentEntity` cho phần thu, `paidAmount = downPayment`, receivable `outstanding = total - downPayment`. **Nhưng** vì V114/V116 đã bỏ `PARTIALLY_PAID` khỏi `orders.payment_status`, đơn vẫn phải để `UNPAID` cho tới khi thu đủ — gây mâu thuẫn ngữ nghĩa. → **Khuyến nghị (A).**

### 6.2. R-03 (P2) — `RefundDialog` cho nhập số tiền hoàn tuỳ ý, backend chỉ nhận full

[PosScreen.jsx:541-666](../../bigbike-admin/src/screens/PosScreen.jsx#L541-L666): `RefundDialog` khởi tạo `amount = String(maxRefundable)` (mặc định = full → happy path OK), nhưng ô `<Input type="number" min={1} max={maxRefundable}>` **cho sửa**, kèm validate `amountExceeds = amountNum > maxRefundable` — toàn bộ ngụ ý "hoàn một phần được phép".

Backend `RefundService` [L113-118](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/payment/RefundService.java#L113-L118): `if (scaled.compareTo(maxRefundable) != 0)` → **reject 400 "Partial refunds are not supported"**. Nếu nhân viên sửa số tiền xuống thấp hơn → lỗi khó hiểu. Đây là tàn dư của mô hình partial-refund cũ (fix report Phase 3) chưa được dọn sau V114.

Fix: khoá ô tiền hoàn thành read-only (luôn = `maxRefundable`), hoặc bỏ ô input và chỉ hiển thị "Hoàn toàn bộ {{amount}}".

### 6.3. Các tàn dư logic partial-refund khác (P3)

`ReceiptModal` ([L687-694](../../bigbike-admin/src/screens/PosScreen.jsx#L687-L694)) còn `effectivePaid`, `alreadyRefunded`, `refundableRemaining`, `setRefundedAmount((prev) => prev + amount)` — logic tích luỹ refund nhiều lần, vô nghĩa khi BE chỉ cho refund 1 lần full. Không gây lỗi (sau 1 refund full, `refundableRemaining=0` → nút disable) nhưng nên đơn giản hoá.

### 6.4. Receipt phụ thuộc React state (P2)

`lastOrder` là state trong `PosScreen` ([L840](../../bigbike-admin/src/screens/PosScreen.jsx#L840)). BE đã trả `items[]` trong response nên receipt hiển thị/in đúng ngay sau khi tạo đơn. **Nhưng** F5/đóng tab → mất `lastOrder` → không mở lại `ReceiptModal` được. Không có đường in lại hoá đơn từ màn Order detail. Đề xuất: nút "In hoá đơn" trong OrderDetailScreen cho đơn `channel=IN_STORE`.

### 6.5. Đã verify lại = PASS

- `App.jsx:416` truyền đủ props: `canUpdate=pos.write`, `canOverridePrice=pos.price_override`, `canOverrideCreditLimit=receivables.override_limit`, `canRefund=pos.refund`, `userId`.
- `contracts.js normalizeVariant` expose `trackSerials: Boolean(input.trackSerials)` ([L214](../../bigbike-admin/src/lib/contracts.js#L214)); `addToCart` set `hasSerial: variant.trackSerials === true` ([PosScreen.jsx:897](../../bigbike-admin/src/screens/PosScreen.jsx#L897)) → cảnh báo `pos.refundSerialWarning` hiện đúng. Audit cũ P0-2 **đã fix**.
- Nút sửa giá chỉ render khi `canOverridePrice` → user thường không override được; BE vẫn re-check (defense in depth).
- Cart localStorage TTL 8h + scope `userId` hợp lý; cart stale không gây sai đơn (BE resolve giá tươi + re-validate stock).
- Print: có fallback iframe khi popup bị chặn (audit cũ P2 **đã fix**).

---

## 7. Database & Migration Findings

| Migration | Nội dung | Trạng thái |
|---|---|---|
| `V46` | `orders.channel`, `payment_method` | OK — POS dùng `IN_STORE` |
| `V79` | seed `pos.read/write/price_override` + receivables permissions cho ADMIN; `pos.read/write` + receivables read/record_payment cho SHOP_MANAGER | OK |
| `V112` | seed `pos.refund` cho **ADMIN** (SHOP_MANAGER không có) | OK — verify đúng |
| `V113` | index `idx_orders_channel_placed_at`, `idx_orders_staff_placed_at` | OK — audit cũ P2 đã fix |
| **`V114`** | rút gọn `payment_status`: `PENDING/PARTIALLY_PAID→UNPAID`, `FAILED→CANCELLED`, `PARTIALLY_REFUNDED→REFUNDED` | OK migration, nhưng **gây drift** với code/docs/FE |
| **`V116`** | CHECK `ck_orders_payment_status IN ('UNPAID','PAID','REFUNDED','CANCELLED')` | OK constraint, nhưng **`ReceivableService.writeOff` vi phạm** → R-01 |
| `V117` | auto-enable serial tracking + backfill `track_serials` | OK |
| `V118/V119` | coupon channel + customer restriction (POS coupon dùng `channel=POS`) | OK |

**Vấn đề DB:**
- **R-01**: `WRITTEN_OFF` không nằm trong `ck_orders_payment_status` nhưng code ghi giá trị này → constraint violation runtime.
- `orders.channel` **không có CHECK constraint** (`IN_STORE/WEB/MOBILE/...`) — `V116` chỉ ràng `status`/`payment_status`/`fulfillment_status`. P3 — nên thêm cho nhất quán.
- `accounts_receivable`, `refund_transactions`, `product_serials`, `order_line_item_serials`, `warranty_records` — schema đầy đủ (V75/V89/V90/V101 đã verify ở audit cũ).

---

## 8. Permission / RBAC Findings

| Permission | Enforce | Verdict |
|---|---|---|
| `pos.read` (search) | `AdminPosController:71` | **PASS** |
| `pos.write` (create) | `AdminPosController:112` | **PASS** |
| `pos.price_override` | service-layer `PosOrderService:217-220` + FE ẩn nút sửa giá | **PASS** |
| `pos.refund` (refund) | `AdminPosController:133` — tách riêng, ADMIN-only (V112) | **PASS** — audit cũ P1 đã fix |
| `receivables.override_limit` | `CreditPolicyService:53-58` | **PASS** (nhưng audit flag sai — R-04) |
| `receivables.write_off` | controller-layer (ngoài scope file này) | enforce OK; nhưng action bị R-01 chặn ở DB |

- `RolesScreen.jsx` BUILTIN_CATALOG có `pos.refund` (`sensitive: true`), `pos.price_override` (`sensitive: true`), label map đầy đủ ([RolesScreen.jsx:27-28,93-94](../../bigbike-admin/src/screens/RolesScreen.jsx#L27-L28)).
- `App.jsx` route `pos` yêu cầu `pos.read`; truyền đủ permission props xuống `PosScreen`.
- Backend không tin permission FE — `requirePermission` ở controller + re-check `unitPriceOverride`/`creditLimit` ở service. **PASS.**
- ADMIN/SHOP_MANAGER seed: SHOP_MANAGER **không** có `pos.refund`, `pos.price_override`, `receivables.override_limit`, `receivables.write_off` → đúng nguyên tắc least-privilege.

**Không có lỗ hổng RBAC.** Phân quyền POS đã chặt chẽ.

---

## 9. Inventory / Serial / Warranty Findings

| Check | Verdict | Ghi chú |
|---|---|---|
| Non-serial: trừ kho 1 lần, ghi `stock_movements` (OUT/ORDER) | **PASS** | `applyPosStock` non-serial branch |
| Non-serial: không bán âm kho, `findByIdForUpdate` | **PASS** | re-validate `quantityOnHand` |
| Serial: reserve→SOLD cùng tx, warranty ACTIVE auto-create | **PASS** | `SerialLifecycleService.reserveForOrderLine` + `markSoldForOrder` |
| Serial: `countAvailable` đúng (IN_STOCK) | **PASS** | — |
| **Serial full refund: SOLD→IN_STOCK** | **PASS** | `restoreSoldSerialsForRefund` — audit cũ P0 đã fix |
| **Serial full refund: warranty VOIDED** | **PASS** | [SerialLifecycleService.java:357-363](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/SerialLifecycleService.java#L357-L363) |
| Stock movement `ORDER_REFUND_SERIAL` ghi đúng | **PASS** | idempotent guard `existsByReferenceTypeAndReferenceId` |
| Idempotency refund serial (không restore 2 lần) | **PASS** | guard `ORDER_REFUND_SERIAL` |
| Non-serial vs serial không double-restore | **PASS** | `OrderStockRestoreService:69` skip line có bridge `order_line_item_serials` |
| Partial refund serial | **N/A** | toàn hệ thống không hỗ trợ partial → reject rõ ràng |
| "Serial zombie" sau refund | **PASS** | serial về IN_STOCK, `soldAt`/`orderLineItemId` clear, warranty VOIDED |

**Lưu ý nghiệp vụ (P2)**: `restoreSoldSerialsForRefund` đưa serial **thẳng về `IN_STOCK`** (sellable ngay), không qua `INSPECTION`. Với hàng bảo hộ mô tô (mũ Arai/Shoei...), một sản phẩm khách đã mua rồi trả lại có thể đã qua sử dụng/hư hại. Bán lại ngay không kiểm tra là rủi ro chất lượng. Luồng `return` (`receiveReturnForReturn` → `RETURNED` → `INSPECTION`) làm đúng quy trình kiểm tra; còn refund POS thì bỏ qua. **Cần chốt với operations**: refund tại quầy có cần bước inspection không. Nếu có, `restoreSoldSerialsForRefund` nên đưa serial về `INSPECTION` thay vì `IN_STOCK`.

---

## 10. Payment / Receivable / Refund Findings

| Check | Verdict | Ghi chú |
|---|---|---|
| CASH/CARD: `PaymentEntity` provider=POS, status=PAID, amount=total | **PASS** | — |
| CARD: `transactionId` = cardReferenceNumber | **PASS** | — |
| CREDIT: không tạo PaymentEntity (đơn UNPAID) | **PASS** (theo thiết kế) | — |
| **CREDIT downPayment**: thu tiền cọc | **FAIL R-02** | field bị bỏ qua — tiền cọc không vào hệ thống |
| Receivable OPEN, outstanding = total | **PASS** | downPayment=ZERO cứng |
| Receivable idempotency (retry không tạo 2 AR) | **PASS** | controller short-circuit + test cover |
| `recordPayment` thu nợ → order→PAID khi đủ | **PASS** | [ReceivableService.java:148-158](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/receivable/ReceivableService.java#L148-L158) |
| **`writeOff` xoá nợ** | **FAIL R-01** | ghi `WRITTEN_OFF` vào `orders.payment_status` → vi phạm CHECK |
| Refund: chỉ order `PAID` | **PASS** | UNPAID/PARTIALLY_PAID/PARTIALLY_REFUNDED đều reject |
| Refund: chỉ full, đúng `paidAmount - alreadyRefunded` | **PASS** | partial reject 400 |
| Refund đơn CREDIT UNPAID | **PASS** | reject 409 (đúng — chưa thu tiền thì không hoàn) |
| Refund đơn CREDIT đã thu đủ (order→PAID) | **PASS (lý thuyết)** | refund được; nhưng FE POS receipt không hiển thị nút (order tạo lúc UNPAID) — phải refund từ màn Order/Receivable |
| Refund full → cancel receivable (AR WRITTEN_OFF) | **PASS** | `RefundService:162-172` chỉ chạm AR row, không chạm `orders` → không dính R-01 |
| Refund vượt paidAmount | **PASS** | reject 400 |
| Refund nhiều lần / đồng thời | **PASS** | status check + `@Version` optimistic lock + idempotency guard stock_movement |
| `RefundTransactionEntity` ledger (IP/UA/admin) | **PASS** | — |

**Mô hình thanh toán sau V114 (đã xác nhận từ code + test):**
- `orders.payment_status` ∈ `{UNPAID, PAID, REFUNDED, CANCELLED}` — **không có** `PARTIALLY_PAID`, `PARTIALLY_REFUNDED`.
- POS CREDIT luôn `UNPAID` → `PAID` (khi thu đủ qua `recordPayment`).
- Refund = **full-only, PAID-only**. Không có partial.
- → Hệ quả: `downPayment` và partial refund **không còn chỗ đứng** trong mô hình. Code backend đã theo; FE và docs thì chưa.

---

## 11. Docs-Code Drift Findings

`BIGBIKE_ORDER_E2E_WORKFLOW_AUDIT.md` mục `ORDER-E2E-09` tuyên bố đã fix drift `PARTIALLY_PAID` trong `BUSINESS_RULES.md`/`STATE_MACHINES.md`, nhưng **fix chưa đầy đủ**. Các vị trí còn drift:

| File | Dòng | Drift | Mức |
|---|---|---|---|
| `docs/business/BUSINESS_RULES.md` | `ORDER_RULE_005` (L84) | "CREDIT forces `paymentStatus = UNPAID` (or `PARTIALLY_PAID` with a downpayment)" — downPayment & PARTIALLY_PAID đã bỏ. Marked `CONFIRMED_FROM_CODE` nhưng sai. | P2 |
| `docs/business/BUSINESS_RULES.md` | `ORDER_RULE_001` (L80) | "COMPLETED ... `UNPAID` or `PARTIALLY_PAID`" — PARTIALLY_PAID đã bỏ | P3 |
| `docs/business/BUSINESS_RULES.md` | `AR_RULE_006` (L192), L206 | "paymentStatus transitions: UNPAID → PARTIALLY_PAID → PAID" — sai với `orders.payment_status` (đúng nếu hiểu là AR status) | P2 |
| `docs/engineering/API_CONTRACT.md` | L280 | `POST /admin/orders/{id}/payments` "keeps `PARTIALLY_PAID`" | P2 |
| `docs/engineering/API_FLOW_MAP.md` | L38 | POS flow: "`PaymentEntity (downPayment only)`" — CREDIT không tạo PaymentEntity | P2 |
| `docs/engineering/API_FLOW_MAP.md` | L52 | "`ReceivableService.writeOff → OrderEntity (WRITTEN_OFF paymentStatus)`" — mô tả đúng code nhưng code vi phạm constraint (R-01); docs cũng cần sửa khi fix R-01 | P2 |
| `docs/engineering/DATA_CONTRACT.md` | L320, L358 | `todayPaidRevenue`/`paidRevenue` filter `paymentStatus IN (...,'PARTIALLY_PAID','PARTIALLY_REFUNDED')` | P2 |
| `docs/business/GLOSSARY.md` | L261 | ví dụ payment status liệt kê `PARTIALLY_PAID` | P3 |
| `docs/business/STATE_MACHINES.md` | L884 | "paymentStatus → `PARTIALLY_REFUNDED`/`REFUNDED`" | P3 |

**Quan trọng**: Audit cũ `POS_IN_STORE_WORKFLOW_PRODUCTION_READY_AUDIT.md` và `FIX_REPORT.md` **đã outdated** — mô tả downPayment tạo `PARTIALLY_PAID`, partial refund, `canHaveRefund` gồm 3 trạng thái. Sau V114 những điều đó không còn đúng. Nên thêm note "SUPERSEDED — xem `POS_IN_STORE_WORKFLOW_RECHECK_AUDIT.md`" vào đầu 2 file đó.

**Nguyên tắc Docs-First (CLAUDE.md)**: V114 thay đổi data shape `payment_status` → đáng lẽ phải update docs cùng PR. Đây là vi phạm quy trình docs-first đã xảy ra trong quá khứ; cần dọn nốt.

---

## 12. Test Coverage Gaps

`Phase1MPosApiTest` (chạy H2) hiện cover tốt: auth 401/403, CASH happy path, validate qty/stock/variant/paymentMethod/tendered, idempotency, staffId/customerName, price override, payment record, stock movement, audit; CREDIT without downPayment, downPayment-ignored, customerId bắt buộc, creditEnabled, over-limit có/không override, idempotency receivable; refund full/serial/credit-unpaid/exceeds/permission.

**Thiếu — cần bổ sung:**

| Test cần thêm | Lý do | Priority |
|---|---|---|
| `writeOff` đơn công nợ POS **trên Postgres** → assert thành công hoặc bắt được constraint violation | Cover R-01 — H2 không bắt được; cần test profile Postgres (Testcontainers) | **P0** |
| Refund đơn serial **cấp product (không variant)** → assert serial restore | Case 24 chưa có test | P1 |
| Refund full đơn nhiều line item (mix serial + non-serial) | Verify không double/sót restore | P1 |
| POS order với `couponCode` (channel POS, min order, customer-restricted) | Toàn bộ nhánh coupon không có test POS | P1 |
| `recordPayment` thu đủ → order chuyển `PAID` → refund được | Verify vòng đời CREDIT đầy đủ | P1 |
| Concurrent 2 refund cùng đơn → 1 thành công, 1 fail sạch | Verify `@Version` chặn double-refund | P2 |
| FE: submit refund với số tiền < full → expect lỗi (sau khi fix R-03) | Cover UI-BE gap | P2 |
| FE build/typecheck `bigbike-admin` sau khi dọn downPayment | Regression | P2 |
| Audit `creditLimitOverridden` chỉ `true` khi thực sự vượt hạn mức (sau fix R-04) | Compliance | P2 |

**Test-infra gap**: bộ test backend chạy H2 — **không phát hiện được vi phạm CHECK constraint của Postgres (R-01)**. Nên có ít nhất 1 test suite chạy Postgres (Testcontainers) cho các luồng đụng `orders.payment_status` / `status`.

---

## 13. Required Fix Plan

### P0 — Bắt buộc fix trước khi launch bán chịu (CREDIT)

**FIX-1 (R-01) — `ReceivableService.writeOff` không được ghi giá trị ngoài constraint.**
Chốt nghiệp vụ rồi chọn 1:
- **(A) Khuyến nghị**: KHÔNG đổi `orders.payment_status` khi write-off. Đơn để nguyên `UNPAID`; trạng thái nợ xấu thể hiện qua `accounts_receivable.status = WRITTEN_OFF`. Sửa `ReceivableService.writeOff` bỏ đoạn `order.setPaymentStatus("WRITTEN_OFF")`. Cập nhật `API_FLOW_MAP.md` L52.
- **(B)** Nếu nghiệp vụ muốn đơn có trạng thái riêng: thêm migration mở rộng `ck_orders_payment_status` để chấp nhận `WRITTEN_OFF`, cập nhật `contracts.js PAYMENT_STATUS_VALUES`, `DATA_CONTRACT.md`, FE hiển thị.
- Thêm test Postgres cover write-off.

### P1 — Bắt buộc fix trước khi launch bán chịu (CREDIT)

**FIX-2 (R-02) — Dọn `downPayment`.** Khuyến nghị phương án (A) ở §6.1:
- FE: xoá state `downPayment`, ô input "Thanh toán trước" ([PosScreen.jsx:57,406-422](../../bigbike-admin/src/screens/PosScreen.jsx#L57)), field trong payload ([L161](../../bigbike-admin/src/screens/PosScreen.jsx#L161)), `downPaymentNum`/`downPaymentInvalid`.
- Backend: xoá `downPayment`, `downPaymentMethod` khỏi `PosCreateOrderRequest`.
- Docs: sửa `BUSINESS_RULES.md ORDER_RULE_005`, `API_FLOW_MAP.md` L38.
- Nếu khách cần trả trước: hướng dẫn dùng `recordPayment` công nợ ngay sau khi tạo đơn (đã hoạt động đúng).

### P2 — Nên fix sớm

**FIX-3 (R-03)** — `RefundDialog`: khoá ô tiền hoàn read-only = `maxRefundable`, hoặc bỏ ô input; xoá logic tích luỹ `refundedAmount`/`alreadyRefunded` thừa.
**FIX-4 (R-04)** — `CreditPolicyService.validateCreditEligibility` trả về cờ "đã thực sự dùng override"; `PosOrderService` set `creditLimitOverridden` theo cờ đó.
**FIX-5 (R-05)** — Xác nhận với catalog: có sản phẩm nào không variant + không serial? Nếu có → thêm nhánh bán product-level non-serial trong POS (search synthesize variant + `createOrder` xử lý `product.stockQuantity`). Nếu không → ghi rõ ràng buộc "mọi sản phẩm bán POS phải có ≥1 variant hoặc serial".
**FIX-6 (R-06)** — Dọn docs drift §11; thêm note SUPERSEDED vào 2 audit/fix-report POS cũ.
**FIX-7** — Inspection cho serial refund (§9): chốt nghiệp vụ; nếu cần kiểm tra, `restoreSoldSerialsForRefund` đưa serial về `INSPECTION` thay vì `IN_STOCK`.
**FIX-8** — Đường in lại hoá đơn từ `OrderDetailScreen` cho đơn `channel=IN_STORE`.

### P3 — Cleanup

- `markSoldForOrder` gọi 1 lần sau vòng lặp (§5.5).
- Line item `regularPrice` lấy từ variant (§5.6).
- Idempotency: so payload hash, 409 nếu lệch (§5.4).
- CHECK constraint cho `orders.channel`.

---

## 14. Suggested Tests

```
# Backend (ưu tiên Postgres / Testcontainers cho nhóm payment_status)
P0  receivableWriteOff_posCreditOrder_onPostgres_succeedsOrNoConstraintViolation
P1  posRefund_productLevelSerialNoVariant_restoresSerial
P1  posRefund_mixedSerialAndNonSerialOrder_restoresAllExactlyOnce
P1  createPosOrder_withPosCoupon_appliesDiscountAndIncrementsUsage
P1  posCredit_recordPaymentInFull_orderBecomesPaid_thenRefundable
P2  posRefund_concurrentDoubleSubmit_oneSucceedsOneFailsCleanly
P2  createPosCreditOrder_inLimit_auditCreditLimitOverriddenIsFalse   (sau FIX-4)

# Frontend (bigbike-admin)
P2  RefundDialog: amount read-only = maxRefundable; submit luôn full   (sau FIX-3)
P2  PaymentModal CREDIT: không còn ô downPayment; payload không có field (sau FIX-2)
P2  vite build + lint sạch sau khi dọn downPayment
```

---

## 15. Final Checklist

| Hạng mục | Trạng thái |
|---|---|
| POS search — `pos.read`, chỉ PUBLISHED, serial/variant normalize | ✅ PASS |
| POS cart — scope userId, TTL 8h, không sai đơn do stale | ✅ PASS |
| CASH sale non-serial | ✅ PASS |
| CARD_TERMINAL sale + cardReferenceNumber → transactionId | ✅ PASS |
| CREDIT sale (không downPayment) | ✅ PASS |
| **CREDIT sale có downPayment** | ❌ **FAIL R-02** — tiền cọc bị nuốt |
| Credit over limit có/không override | ✅ PASS (audit flag sai — R-04) |
| Price override có/không quyền | ✅ PASS |
| Idempotency tạo đơn | ✅ PASS |
| Serial sale + full refund + warranty VOIDED | ✅ PASS |
| Non-serial full refund | ✅ PASS |
| **Non-serial partial refund** | ⚠️ BE reject đúng, FE gây nhầm — R-03 |
| Refund permission `pos.refund` tách riêng | ✅ PASS |
| Refund đồng thời / 2 lần | ✅ PASS (`@Version`) |
| **Write-off công nợ POS** | ❌ **FAIL R-01** — vi phạm CHECK constraint |
| Thu nợ (recordPayment) | ✅ PASS |
| Permission / RBAC | ✅ PASS |
| Audit log tạo đơn (IP/UA/items/staff) | ✅ PASS (flag override sai — R-04) |
| Audit log refund (before/after/IP/UA) | ✅ PASS |
| WebSocket NEW_ORDER / ORDER_REFUND_CREATED | ✅ PASS |
| Index báo cáo POS | ✅ PASS (V113) |
| Receipt sau tạo đơn | ✅ PASS |
| Receipt sau reload | ⚠️ mất state — P2 |
| Sản phẩm không variant + không serial | ⚠️ không bán được — R-05 |
| Docs đồng bộ code | ❌ drift — R-06 |

---

## Kết luận

**1. Workflow mua hàng trực tiếp tại shop đã trơn tru chưa?**
- **CASH / CARD_TERMINAL (trả tiền ngay)** — **Đã trơn tru**: tạo đơn, trừ kho, serial, refund full, in hoá đơn, audit, permission đều đúng và có test. Chỉ còn 1 điểm UX (R-03) nên dọn.
- **CREDIT (bán chịu)** — **Chưa trơn tru**: có lỗ hổng xử lý tiền và lỗi DB.

**2. Có bug/blocker không?** Có:
- **R-01 (P0)** — Xoá nợ xấu đơn công nợ POS sẽ fail bằng lỗi DB trên production (vi phạm CHECK constraint `ck_orders_payment_status`).
- **R-02 (P1, hệ quả tài chính P0)** — Tiền cọc khách trả trước (downPayment) bị hệ thống bỏ qua hoàn toàn — tiền vào ngăn kéo nhưng không có vết sổ sách.
- Cùng các P2/P3: UI refund gây nhầm (R-03), audit flag override sai (R-04), sản phẩm không variant không bán được (R-05), docs drift (R-06).

**3. Có thể launch production chưa?**
- **Bán hàng trả tiền ngay tại quầy (CASH/CARD, kể cả hàng serial): CÓ THỂ LAUNCH** ngay, nên kèm fix R-03.
- **Bán chịu (CREDIT) tại quầy: CHƯA LAUNCH ĐƯỢC.**

**4. Nếu chưa, cần fix gì trước?**
1. **FIX-1 (R-01)** — `ReceivableService.writeOff` không ghi giá trị ngoài `ck_orders_payment_status` (khuyến nghị: không đổi `orders.payment_status` khi write-off).
2. **FIX-2 (R-02)** — Bỏ hẳn `downPayment` ở FE + backend request (khuyến nghị phương án A).
3. Bổ sung test write-off chạy Postgres + test vòng đời CREDIT đầy đủ.

**5. Điều kiện launch:**
- Launch ngay phần **CASH/CARD** với điều kiện: hoàn thành FIX-3 (khoá ô tiền hoàn) để tránh nhầm lẫn vận hành.
- Mở **CREDIT** chỉ sau khi hoàn thành **FIX-1 + FIX-2** và verify bằng test trên Postgres; đồng thời chốt nghiệp vụ inspection cho serial refund (FIX-7) và dọn docs drift (FIX-6).

> Không thể kết luận "không còn bug" cho nhánh CREDIT: đã xác nhận 1 P0 + 1 P1 bằng trace code + migration thực tế. Nhánh CASH/CARD đã kiểm đủ UI → API → service → DB → test và đạt.

---

## Phụ lục — Files đã trace làm bằng chứng

**Backend**: `AdminPosController.java`, `PosOrderService.java`, `RefundService.java`, `SerialLifecycleService.java`, `OrderStockRestoreService.java`, `CreditPolicyService.java`, `ReceivableService.java`, `OrderEntity.java`
**Frontend**: `PosScreen.jsx`, `App.jsx`, `RolesScreen.jsx`, `lib/contracts.js`
**Migrations**: `V46`, `V79`, `V112`, `V113`, `V114`, `V116`, `V117`
**Tests**: `Phase1MPosApiTest.java`
**Docs**: `BUSINESS_RULES.md`, `API_CONTRACT.md`, `API_FLOW_MAP.md`, `DATA_CONTRACT.md`, `STATE_MACHINES.md`, `GLOSSARY.md`, `BIGBIKE_ORDER_E2E_WORKFLOW_AUDIT.md`, `POS_IN_STORE_WORKFLOW_PRODUCTION_READY_AUDIT.md`, `POS_IN_STORE_WORKFLOW_FIX_REPORT.md`

---

## Fix Summary — 2026-05-16

Tất cả vấn đề được phát hiện trong audit này đã được fix:

| # | Vấn đề | Files thay đổi | Ghi chú |
|---|---|---|---|
| **R-01** | `ReceivableService.writeOff()` ghi `WRITTEN_OFF` vào `orders.payment_status`, vi phạm V116 CHECK constraint | `ReceivableService.java` | Xoá block `order.setPaymentStatus("WRITTEN_OFF")`. Order giữ nguyên `UNPAID` sau write-off. |
| **R-02** | FE gửi `downPayment` lên BE nhưng BE bỏ qua — nhân viên thu tiền cọc nhưng hệ thống không ghi nhận | `PosOrderService.java` (xoá field record), `PosScreen.jsx` (xoá state + UI + payload) | downPayment đã bị bỏ từ V114; FE nay đồng bộ. |
| **R-03** | `RefundDialog` cho nhập số tiền tùy ý, ngụ ý hoàn một phần — BE reject 400 nếu không đúng toàn bộ | `PosScreen.jsx` | Thay `<Input type=number>` bằng hiển thị read-only `maxRefundable`. Xoá i18n key không dùng. |
| **R-04** | `creditLimitOverridden` audit flag = true cho mọi đơn CREDIT có quyền override, kể cả trong hạn mức | `CreditPolicyService.java` (thêm `EligibilityResult` record, trả `limitOverrideExercised`), `PosOrderService.java` (dùng return value) | Flag giờ chỉ true khi limit thực sự bị vượt VÀ override được dùng. |
| **R-05** | Sản phẩm không biến thể + không serial không bán được trên POS | `AdminPosController.java` (search), `PosOrderService.java` (validation + applyPosStock) | Hỗ trợ đầy đủ: search trả synthetic variant với `trackSerials=false`, validate kiểm `stockQuantity`, stock decrement + movement ghi đúng. |
| **R-06** | Docs drift: `downPayment`, `PARTIALLY_PAID`, `WRITTEN_OFF` trên orders, partial refund còn trong docs | `BUSINESS_RULES.md`, `API_FLOW_MAP.md`, `DATA_CONTRACT.md`, `STATE_MACHINES.md` | Cập nhật theo thực tế sau V114/V116. |
