# POS / In-store Sale Workflow Production Ready Audit

**Ngày**: 2026-05-14
**Phạm vi**: Bán trực tiếp tại shop (channel `IN_STORE` / source `pos`) — CASH / CARD_TERMINAL / CREDIT + refund + serial + công nợ.
**Reviewer**: Senior Engineer/Architect (audit-only, không sửa code).

---

## 1. Executive Summary

**Verdict tổng**: `PARTIAL — NOT READY FOR SERIAL-TRACKED INVENTORY`

POS core (CASH, CARD_TERMINAL, CREDIT — bán **hàng non-serial**) đã sẵn sàng production: idempotency, audit, websocket, receivable, credit policy đều có test cover thật. Tuy nhiên **đường refund cho hàng track-serials bị thủng**: serial bị "kẹt" trạng thái `SOLD` sau khi hoàn tiền POS, dẫn đến mất khả năng bán lại serial đó + warranty record zombie + `quantity_on_hand` lệch vĩnh viễn so với serial thực tế. Vì BigBike bán đồ bảo hộ mô tô và đã có hạ tầng track-serials cho mũ bảo hiểm cao cấp, đây là **blocker P0** trước khi mở quầy bán hàng tại shop với hàng serial.

**Blockers**:
- **P0-1**: Refund POS không khôi phục serial về `IN_STOCK` và không huỷ warranty record. (PosScreen + RefundService)
- **P0-2**: FE POS không truyền cờ `trackSerials` về cart → admin không biết đang refund serial → cảnh báo `pos.refundSerialWarning` dead-code. (FE-BE GAP)
- **P1-1**: FE POS ẩn nút refund cho đơn CREDIT có downpayment đã thu (`paymentStatus = PARTIALLY_PAID`) mặc dù backend cho phép refund — tiền đặt cọc bị "kẹt" trong UI. (FE-BE GAP)
- **P1-2**: Receipt snapshot phụ thuộc state FE; reload trang sau khi tạo đơn sẽ mất nội dung hoá đơn (BE response không trả line items).
- **P1-3**: Refund endpoint chỉ check `pos.write`, không có permission tách riêng cho refund (mọi nhân viên bán hàng cũng refund được — risk lạm dụng).
- **P2**: Một số UX (popup print, idempotent retry thay đổi tendered, etc.).

POS **non-serial** end-to-end: `PASS` (đủ điều kiện launch quầy với hàng không serial).
POS **serial-tracked**: `FAIL` đường refund — không launch được nếu shop có bán serial tracked tại quầy.

---

## 2. End-to-End Flow Map

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ ADMIN POS UI  (bigbike-admin/src/screens/PosScreen.jsx)                        │
│  - canUpdate = pos.write                                                       │
│  - canOverridePrice = pos.price_override                                       │
│  - canOverrideCreditLimit = receivables.override_limit                         │
│  - LocalStorage cart (8h TTL, scoped userId)                                   │
└──────────────────────────┬─────────────────────────────────────────────────────┘
                           │  posSearchProducts() / posCreateOrder() / posCreateRefund()
                           ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│ AdminPosController  (bigbike-backend/.../api/admin/AdminPosController.java)    │
│  - GET  /api/v1/admin/pos/products/search       requirePermission("pos.read")  │
│  - POST /api/v1/admin/pos/orders                requirePermission("pos.write") │
│  - POST /api/v1/admin/pos/orders/{id}/refund    requirePermission("pos.write") │
│  - extract clientIp, userAgent for audit                                       │
│  - canOverridePrice from "pos.price_override"; canOverrideCreditLimit from     │
│    "receivables.override_limit"                                                │
└──────────────────────────┬─────────────────────────────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│ PosOrderService.createOrder()  @Transactional                                  │
│  1. Validate paymentMethod (CASH/CARD_TERMINAL/CREDIT)                         │
│  2. If CREDIT: load CustomerEntity                                             │
│  3. Idempotency: findByOrderKey(posIdempotencyKey) → short-circuit if exists   │
│  4. For each item:                                                             │
│      - findByIdForUpdate(product) → must be PUBLISHED                          │
│      - findByIdForUpdate(variant) → must belong to product, isAvailable        │
│      - Serial?  countAvailable() >= qty   :  quantityOnHand >= qty             │
│      - Resolve unit price (variant.salePrice → variant.retailPrice →           │
│        product.salePrice → product.retailPrice), or unitPriceOverride          │
│      - canOverridePrice gate                                                   │
│      - Build OrderLineItemEntity (in-memory)                                   │
│  5. CREDIT: creditPolicyService.validateCreditEligibility(...)                 │
│  6. CASH: assert tenderedAmount >= subtotal (when supplied)                    │
│  7. Build OrderEntity:                                                         │
│      channel=IN_STORE, fulfillmentType=IN_STORE, source="pos"                  │
│      status=COMPLETED, currency=VND, shipping/tax/fee/discount = 0             │
│      paymentStatus = CASH/CARD → PAID; CREDIT → UNPAID or PARTIALLY_PAID       │
│      createdByAdminId = staffId, customerName + customerPhone snapshot         │
│      orderKey = posIdempotencyKey (or generated)                               │
│  8. orderRepo.save + flush → on DataIntegrityViolation catch idempotency race  │
│     and return existing order                                                  │
│  9. Save line items linked to order                                            │
│ 10. applyPosStock():                                                           │
│      - Serial: reserveForOrderLine(...) then markSoldForOrder(orderId)         │
│        → SerialLifecycleService writes stock_movements via DB trigger          │
│      - Non-serial: variant.quantityOnHand -= qty + recomputeStockState +       │
│        StockMovementEntity (movementType=OUT, referenceType=ORDER)             │
│ 11. PaymentEntity (provider=POS, status=PAID) — for CASH/CARD always;          │
│      for CREDIT only when downPayment > 0                                      │
│ 12. CREDIT: receivableService.createReceivableForOrder(...)                    │
│      → ReceivableEntity status=OPEN, outstanding=total-downPayment             │
│ 13. OrderNoteEntity (SYSTEM, ADMIN, not customer-visible)                      │
│ 14. AuditLogEntity action=POS_ORDER_CREATED / POS_CREDIT_ORDER_CREATED         │
│ 15. wsService.pushEvent(NEW_ORDER) → /topic/admin/orders                       │
│ 16. Response: { orderId, orderNumber, status, paymentStatus, paymentMethod,    │
│      totalAmount, tenderedAmount, changeAmount }                               │
└──────────────────────────┬─────────────────────────────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│ FE (ReceiptModal) — In hoá đơn (popup print) / Hoàn tiền                       │
└──────────────────────────┬─────────────────────────────────────────────────────┘
                           ▼  POST /admin/pos/orders/{id}/refund (pos.write)
┌────────────────────────────────────────────────────────────────────────────────┐
│ RefundService.applyRefund()  @Transactional                                    │
│  - Order must be PAID / PARTIALLY_PAID / PARTIALLY_REFUNDED                    │
│  - refundAmount in (0, paidAmount - alreadyRefunded]                           │
│  - Update order.refundAmount, refundReason, refundedAt                         │
│  - fullRefund → paymentStatus=REFUNDED + (if COMPLETED) status=REFUNDED        │
│  - partial → paymentStatus=PARTIALLY_REFUNDED                                  │
│  - fullRefund && wasCompleted → orderStockRestoreService.restoreForRefund()    │
│      ⚠ chỉ restore qty cho NON-SERIAL items; serial items SKIP                 │
│      ⚠ KHÔNG có path nào gọi SerialLifecycleService để chuyển SOLD→IN_STOCK    │
│  - fullRefund → cancel outstanding receivable (WRITTEN_OFF, reason             │
│      ORDER_REFUNDED)                                                           │
│  - Payment.refundAmount, payment.status (REFUNDED nếu full)                    │
│  - RefundTransactionEntity (ledger row, ip+ua)                                 │
│  - OrderNoteEntity (REFUND, customerVisible=true)                              │
│  - AuditLog action=ORDER_REFUND_CREATED                                        │
│  - WS event ORDER_REFUND_CREATED                                               │
└────────────────────────────────────────────────────────────────────────────────┘
```

Evidence chính:
- [AdminPosController.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminPosController.java)
- [PosOrderService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java)
- [PosScreen.jsx](../../bigbike-admin/src/screens/PosScreen.jsx)
- [RefundService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/payment/RefundService.java)
- [SerialLifecycleService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/SerialLifecycleService.java)
- [OrderStockRestoreService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/OrderStockRestoreService.java)
- [Phase1MPosApiTest.java](../../bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1MPosApiTest.java)

---

## 3. Case Matrix

| # | Case | Expected | Actual implementation | Evidence | Verdict | Risk |
|---|---|---|---|---|---|---|
| 1 | CASH sale (non-serial) | order COMPLETED, paymentStatus PAID, paidAmount = total, stock -N, payment(provider POS, PAID), audit, WS NEW_ORDER, customer/staff snapshot | đúng | [PosOrderService.java:286-417](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L286-L417), [Phase1MPosApiTest.java:100-117](../../bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1MPosApiTest.java#L100-L117) | **PASS** | — |
| 2 | CASH — insufficient tendered | reject 409 | đúng (line 267-273) | [PosOrderService.java:267-273](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L267-L273), test `createPosOrder_cashInsufficientTendered_returns409` | **PASS** | — |
| 3 | CARD_TERMINAL sale | giống CASH, payment.paymentMethod=CARD_TERMINAL, không yêu cầu shipping, có thể nhập cardReferenceNumber → ghi vào order note | đúng | [PosOrderService.java:380-382](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L380-L382), [AdminPosController.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminPosController.java) | **PASS** | `cardReferenceNumber` chỉ vào note, không vào `payment.transactionId` — khó tra cứu sau này (P2) |
| 4 | CREDIT sale (đủ hạn mức, không downpayment) | COMPLETED + UNPAID, paidAmount=0, receivable OPEN outstanding=total, không có payment record, stock đã trừ | đúng | [PosOrderService.java:289-377](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L289-L377), test `createPosCreditOrder_withoutDownPayment_createsCompletedUnpaidOrderAndReceivable` | **PASS** | — |
| 5 | CREDIT sale với downpayment | COMPLETED + PARTIALLY_PAID, paidAmount=downPayment, payment record cho downpayment, receivable outstanding=total-downPayment | đúng | [PosOrderService.java:307-365](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L307-L365), test `createPosCreditOrder_withDownPayment_createsPartiallyPaidOrderPaymentAndReceivable` | **PASS** | — |
| 6 | CREDIT — customer creditEnabled=false | reject 409 | đúng (CreditPolicyService throws) | [CreditPolicyService.java:40-42](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/receivable/CreditPolicyService.java#L40-L42), test `createPosCreditOrder_rejectsCreditDisabledCustomer_returns409` | **PASS** | — |
| 7 | CREDIT — creditStatus != ACTIVE | reject 409 | đúng | [CreditPolicyService.java:44-47](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/receivable/CreditPolicyService.java#L44-L47) | **PASS** | — |
| 8 | CREDIT — vượt hạn mức, không có override | reject 409 | đúng | [CreditPolicyService.java:49-59](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/receivable/CreditPolicyService.java#L49-L59), test `creditSale_shopManager_overCreditLimit_returns409` | **PASS** | — |
| 9 | CREDIT — vượt hạn mức, có `receivables.override_limit` | allow + audit | allow OK; audit hiện chỉ ghi action `POS_CREDIT_ORDER_CREATED` chung — **không có cờ riêng đánh dấu đã override hạn mức** | [AdminPosController.java:76-77](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminPosController.java#L76-L77), [CreditPolicyService.java:53-58](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/receivable/CreditPolicyService.java#L53-L58), test `creditSale_admin_overCreditLimit_withOverridePerm_returns200` | **PARTIAL** | P1 — không truy vết được "ai đã ký vượt hạn mức". Compliance & finance không phân biệt được đơn override với đơn thường |
| 10 | Serial-tracked product (POS sale) | reserve → mark SOLD trong cùng tx, warranty record created, qty_on_hand giảm qua DB trigger, không thiếu serial khi countAvailable < qty | đúng | [PosOrderService.java:215-220, 465-471](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L215-L220), [SerialLifecycleService.java:89-186](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/SerialLifecycleService.java#L89-L186), [Phase2FSerialInventoryTest.java](../../bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase2FSerialInventoryTest.java) | **PASS** | — |
| 11 | Refund full — non-serial CASH | order REFUNDED, payment REFUNDED, qty +N, stock_movement IN, receivable WRITTEN_OFF (nếu credit), refund_transactions row, note, audit, WS | đúng | [RefundService.java:120-218](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/payment/RefundService.java#L120-L218), [OrderStockRestoreService.java:53-114](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/OrderStockRestoreService.java#L53-L114), test `posRefund_cashFullRefund_setsRefundedAndRestoresStock` | **PASS** | — |
| 12 | Refund partial — non-serial CASH | paymentStatus PARTIALLY_REFUNDED, qty KHÔNG restore, có thể refund tiếp lần sau | đúng | [RefundService.java:127-129](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/payment/RefundService.java#L127-L129), test `posRefund_cashPartialRefund_setsPartiallyRefundedAndDoesNotRestoreStock` | **PASS** | — |
| 13 | Refund nhiều lần | tích luỹ vào refundAmount; mỗi lần ghi `refund_transactions`; tổng không vượt paidAmount | đúng (RefundTransactionEntity ledger) | [RefundService.java:162-172](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/payment/RefundService.java#L162-L172), [V101__create_refund_transactions_table.sql](../../bigbike-backend/src/main/resources/db/migration/V101__create_refund_transactions_table.sql) | **PASS** | — |
| 14 | Refund vượt paidAmount | reject 400 | đúng | [RefundService.java:106-109](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/payment/RefundService.java#L106-L109), test `posRefund_exceedsPaidAmount_returns400` | **PASS** | — |
| 15 | Refund CREDIT — UNPAID | reject 409 | đúng (paymentStatus chưa PAID) | [RefundService.java:91-96](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/payment/RefundService.java#L91-L96), test `posRefund_creditUnpaidOrder_returns409` | **PASS** | — |
| 16 | Refund CREDIT — PARTIALLY_PAID (downpayment) | BE: allow refund đến mức paidAmount, fullRefund→cancel receivable; FE: phải hiện nút refund | BE đúng; **FE ẩn nút** (`isPaid = paymentStatus === 'PAID'`) | [PosScreen.jsx:569, 653-664](../../bigbike-admin/src/screens/PosScreen.jsx#L569), [RefundService.java:91-96](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/payment/RefundService.java#L91-L96) | **PARTIAL** `FE_BE_GAP` | P1 — downpayment của khách không thể hoàn qua UI POS. Phải vào AdminOrderScreen — operations sẽ rối |
| 17 | **Refund đơn POS có serial** | serial chuyển SOLD → IN_STOCK (hoặc INSPECTION), warranty record huỷ/đóng, qty_on_hand đồng bộ qua trigger | **SAI** — `OrderStockRestoreService.restoreForRefund()` skip line item nào có bridge `order_line_item_serials`; **không có code path nào gọi SerialLifecycleService.releaseReservationForOrder hoặc tương đương cho refund**. Serial kẹt SOLD vĩnh viễn, warranty vẫn ACTIVE | [OrderStockRestoreService.java:67-69](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/OrderStockRestoreService.java#L67-L69), [RefundService.java:133-135](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/payment/RefundService.java#L133-L135), [SerialLifecycleService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/SerialLifecycleService.java) (không có method refundForOrder) | **FAIL** `P0` | P0 — Inventory drift, không bán lại được serial, customer warranty zombie |
| 18 | Insufficient stock (non-serial) | reject 409 với message thân thiện | đúng | [PosOrderService.java:221-224](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L221-L224), test `createPosOrder_exceedsStock_returns409` | **PASS** | — |
| 19 | Insufficient serial | reject 409 | đúng | [PosOrderService.java:215-220](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L215-L220) | **PASS** | — |
| 20 | Duplicate submit (idempotency) | retry với cùng `posIdempotencyKey` không tạo đơn mới, không trừ kho 2 lần, không tạo receivable thứ 2 | đúng (orderKey unique + catch DataIntegrityViolationException) | [PosOrderService.java:156-167, 319-338](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L156-L167), [V7__create_order_tables.sql:5](../../bigbike-backend/src/main/resources/db/migration/V7__create_order_tables.sql#L5), test `createPosOrder_idempotencyRetry_doesNotDecrementStockTwice` + `createPosCreditOrder_idempotency_doesNotCreateDuplicateReceivable` | **PASS** | — |
| 21 | Variant không thuộc product | reject 409 | đúng | [PosOrderService.java:207-210](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L207-L210), test `createPosOrder_variantNotBelongingToProduct_returns409` | **PASS** | — |
| 22 | Product không PUBLISHED | reject 409 | đúng (re-check ở line 199-201) | [PosOrderService.java:199-201](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L199-L201) | **PASS** | — |
| 23 | Price override không có `pos.price_override` | reject 409 | đúng | [PosOrderService.java:186-193](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L186-L193), test `createPosOrder_priceOverride_withoutPermission_returns409` | **PASS** | — |
| 24 | Price override với `pos.price_override` | allow + audit | allow OK; **audit không có field `priceOverridden` để truy vết** (giống case 9) | [PosOrderService.java:393-399](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L393-L399) | **PARTIAL** | P2 — không truy vết được "ai đã sửa giá đơn nào" trong audit JSON (chỉ thấy được khi so sánh `lineSubtotal` với `regularPrice`) |
| 25 | Search POS không auth | 401 | đúng | [AdminPosController.java:61](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminPosController.java#L61), test `posSearch_noAuth_returns401` | **PASS** | — |
| 26 | Create POS không auth | 401 | đúng | [AdminPosController.java:72](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminPosController.java#L72), test `createPosOrder_noAuth_returns401` | **PASS** | — |
| 27 | Refund không auth | 401 | đúng | [AdminPosController.java:93](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminPosController.java#L93), test `posRefund_noAuth_returns401` | **PASS** | — |
| 28 | Receipt print | popup window in được hoá đơn nhiệt | hoạt động khi browser cho phép popup; nếu popup blocked → silently fail | [PosScreen.jsx:380-433](../../bigbike-admin/src/screens/PosScreen.jsx#L380-L433) | **PARTIAL** | P2 — UX edge case |
| 29 | Doanh thu / dashboard hiển thị đơn POS | đơn `IN_STORE` được đếm vào doanh thu, phân biệt được với đơn web | order.channel=IN_STORE, source=pos được set đúng → có thể query/group được. Cần verify dashboard query có dùng channel hay không | [PosOrderService.java:286-308](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L286-L308) | **NEEDS_RUNTIME_VERIFICATION** | P2 — chưa kiểm tra dashboard query |
| 30 | Concurrent POS sale cùng variant non-serial | findByIdForUpdate (FOR UPDATE) blocks → tuần tự | đúng | [PosOrderService.java:203-204, 461-463](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L203) | **PASS** | — |
| 31 | Concurrent POS sale cùng serial-tracked variant | FOR UPDATE SKIP LOCKED chia serial khác nhau | đúng | [SerialLifecycleService.java:102-104](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/SerialLifecycleService.java#L102-L104) | **PASS** | — |

---

## 4. Backend Findings

### 4.1. `RefundService.applyRefund` không xử lý serial khi refund — `P0`

[OrderStockRestoreService.java:67-69](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/OrderStockRestoreService.java#L67-L69):

```java
// Serial-tracked line items: stock is restored by SerialLifecycleService (DB trigger syncs qty).
// This service only handles non-serial (legacy) quantity restore.
if (!olisRepo.findByOrderLineItemId(item.getId()).isEmpty()) continue;
```

Comment nói "stock is restored by SerialLifecycleService" nhưng **không có call site nào** gọi `SerialLifecycleService` từ refund flow. `SerialLifecycleService` chỉ có method `releaseReservationForOrder` (cho cancel order) và `receiveReturnForReturn` (cho return flow). Không có `unmarkSoldForOrder` hay tương đương cho refund flow.

**Hậu quả khi POS refund đơn có serial**:
- `order.status = REFUNDED`, `payment.status = REFUNDED` — sạch sẽ về tiền.
- `product_serials.status` của serial đó vẫn = `SOLD`, `sold_at` không null.
- `warranty_records` của serial vẫn `ACTIVE`, không bị huỷ.
- `product_variants.quantity_on_hand` không thay đổi (vì DB trigger chỉ sync khi serial status đổi).
- Serial đó **không xuất hiện trong `findAvailableForVariantWithLock`** → không bán lại được.
- Customer hoàn hàng nhưng hệ thống vẫn coi serial đã có chủ → warranty claim sau này sẽ nhập nhằng.

Cần thêm path `unmarkSoldForRefund(orderId, items)` trong `SerialLifecycleService` + huỷ warranty record + ghi `stock_movements` cho từng serial. Path đúng có thể là:
- **Refund toàn bộ + không có physical return**: serial → `RETURNED` (giữ ngoài stock cho đến khi inspection); HOẶC
- **Refund toàn bộ + admin xác nhận đã nhận lại hàng**: serial → `INSPECTION` rồi `IN_STOCK`.

Đây là quyết định business cần chốt với operations trước khi fix.

### 4.2. Refund endpoint chỉ check `pos.write` — `P1`

[AdminPosController.java:93](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminPosController.java#L93):

```java
devAdminAuthService.requirePermission(request, "pos.write");
```

Permission seed [V79__backfill_pos_receivables_permissions.sql:24-26](../../bigbike-backend/src/main/resources/db/migration/V79__backfill_pos_receivables_permissions.sql#L24-L26) cho `SHOP_MANAGER` có `pos.write` → mọi nhân viên bán hàng đều refund được. Không có permission tách riêng `pos.refund` hay `orders.refund`. Trong khi `receivables.write_off` lại được tách riêng cho ADMIN. Bất đối xứng.

Risk: nhân viên thông đồng tự refund đơn rồi lấy tiền. Cần permission gate riêng + có thể giới hạn số tiền tối đa per refund.

### 4.3. Audit log thiếu cờ override — `P1`

Khi `pos.price_override` hoặc `receivables.override_limit` được dùng, audit JSON [PosOrderService.java:393-399](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L393-L399) không bao gồm cờ nào để đánh dấu "đơn này có override". Compliance và finance không lọc nhanh được. Hiện chỉ có thể suy ra bằng cách so `lineItem.unitPrice` với `lineItem.regularPrice` hoặc so `receivable.outstandingAmount` với `customer.creditLimit`.

### 4.4. CARD_TERMINAL — `cardReferenceNumber` không vào `payment.transactionId` — `P2`

[PosOrderService.java:380-382](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L380-L382): chỉ append vào order note. Đáng lẽ phải gán `payment.setTransactionId(cardReferenceNumber)` để reconciliation đối soát với máy POS bank về sau.

### 4.5. WebSocket event field `customerName` có thể là null — `P2`

[PosOrderService.java:416](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L416): `req.customerName() != null ? req.customerName() : req.customerPhone()` — cả hai có thể null cho walk-in customer chưa cho thông tin. Cần fallback "Khách vãng lai" hoặc orderNumber.

### 4.6. POS search dùng `AdminCatalogReadService` chung — `INFO`

[AdminPosController.java:62](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminPosController.java#L62): filter `publishStatus = "PUBLISHED"` đúng. Nhưng tham số `q` được forward thẳng → cần verify rằng search index không trả product OUT_OF_STOCK lên đầu list (UX).

### 4.7. POS-specific: không có hỗ trợ multi-payment (tách bill) — `P2`

Một đơn chỉ có 1 `paymentMethod`. Khách bán đồ bảo hộ thường trả 1 phần tiền mặt + 1 phần thẻ → BE hiện chưa hỗ trợ. UI cũng radio single-choice.

### 4.8. Reservation TTL 60 giây trong POS — `INFO`

[PosOrderService.java:467](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L467): `Instant reservedUntil = now.plusSeconds(60)`. Có comment "very short TTL; markSold follows immediately" — đúng vì cùng transaction. Nhưng nếu tx fail và rollback, serial đã setReservedUntil chưa được lưu (rollback). OK.

---

## 5. Admin Frontend Findings

### 5.1. `hasSerial` không bao giờ set trên cart item — `P0` (`FE_BE_GAP`)

`PosScreen.jsx` define dead-code path:
- [PosScreen.jsx:568](../../bigbike-admin/src/screens/PosScreen.jsx#L568): `const hasSerialItems = items.some((it) => it.hasSerial === true)`
- [PosScreen.jsx:755-775 (addToCart)](../../bigbike-admin/src/screens/PosScreen.jsx#L755-L775): không gán `hasSerial` từ variant.

Nguyên nhân: [contracts.js:189-215 (normalizeVariant)](../../bigbike-admin/src/lib/contracts.js#L189-L215) không expose `trackSerials` từ backend payload. Hậu quả: warning trong RefundDialog (`pos.refundSerialWarning`) **không bao giờ hiện** — admin tưởng refund OK mà thực tế đang để lại serial zombie.

### 5.2. FE ẩn refund button cho CREDIT có downpayment — `P1` (`FE_BE_GAP`)

[PosScreen.jsx:569, 653](../../bigbike-admin/src/screens/PosScreen.jsx#L569):

```js
const isPaid = order?.paymentStatus === 'PAID'
...
{isPaid && (
  <Button variant="destructive" ... onClick={() => setShowRefund(true)}>
```

Đơn CREDIT có downpayment 300k của total 1M có `paymentStatus = PARTIALLY_PAID` → nút Refund bị ẩn. Trong khi BE [RefundService.java:91-96](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/payment/RefundService.java#L91-L96) cho phép refund với `PARTIALLY_PAID`. Operations không refund được downpayment qua POS UI — phải vào AdminOrderScreen riêng.

Đề xuất: cho phép refund khi `paidAmount > refundAmount`.

### 5.3. Receipt phụ thuộc state FE — `P1`

[PosScreen.jsx:563-696 (ReceiptModal)](../../bigbike-admin/src/screens/PosScreen.jsx#L563-L696) dùng `cartSnapshot` lưu trong `lastOrder` state. Nếu user F5 hoặc đóng tab trước khi xem hoá đơn, không có cách nào in lại từ POS screen — phải vào AdminOrders detail (nếu screen đó có nút in).

Response API `posCreateOrder` [PosOrderService.java:425-430](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L425-L430) không trả về line items → FE phải snapshot.

Đề xuất: BE trả `items[]` trong response để FE có thể re-render hoá đơn từ orderId bất kỳ lúc nào.

### 5.4. Popup print có thể bị chặn — `P2`

[PosScreen.jsx:395-396](../../bigbike-admin/src/screens/PosScreen.jsx#L395-L396): `window.open('', '_blank', ...)`. Browser chặn popup → silently return. Không có fallback. Đề xuất: dùng hidden iframe hoặc data-URL download.

### 5.5. Stock label dùng `variant.stockQuantity` chứ không `availableSerials` — `P2`

[PosScreen.jsx:870-873](../../bigbike-admin/src/screens/PosScreen.jsx#L870-L873): hiển thị `Kho: ${variant.stockQuantity}`. Với serial-tracked variant, `quantity_on_hand` đã được trigger sync, OK. Nhưng nếu trigger không chạy đúng, FE sẽ hiển thị sai. Đây là dependency, không phải bug.

### 5.6. Không có search customer khi không CREDIT — `P2`

Nếu khách walk-in chỉ muốn lưu tên+phone vào đơn để tra sau (gọi tên), không có cách search customer hiện có ngoài CREDIT branch. Phải gõ tay → snapshot không link tới `customer.id`. Operations không link được đơn với customer profile.

### 5.7. Cart localStorage TTL 8h, scope theo userId — `OK`

[PosScreen.jsx:698-717](../../bigbike-admin/src/screens/PosScreen.jsx#L698-L717): hợp lý, không phải vấn đề.

---

## 6. Database & Migration Findings

| Table / change | Trạng thái | Note |
|---|---|---|
| `orders.channel`, `payment_method` | V46 thêm. POS dùng `IN_STORE` / `CASH|CARD_TERMINAL|CREDIT`. | OK |
| `orders.order_key` UNIQUE | V7 created. PosOrderService dựa vào unique violation để xử lý idempotency race. | OK |
| `orders.created_by_admin_id`, `customer_name` | V71. | OK |
| `accounts_receivable` | V75 — đầy đủ outstanding / written_off / due_date. | OK |
| `refund_transactions` | V101 — ledger; có index theo order_id. | OK |
| `product_serials` lifecycle + `order_line_item_serials` bridge | V89-V90. | OK |
| `permission` seed (`pos.read/write/price_override`, `receivables.override_limit`) | V79. | OK |
| `accounts_receivable.version` (optimistic lock) | V83. | OK — đảm bảo record payment race-safe |

**Thiếu / drift**:
- Không có constraint `CHECK` trên `orders.channel IN ('WEB','IN_STORE','MOBILE','...')` (không tìm thấy trong tổng quan — `NEEDS_VERIFICATION` qua `\d+ orders`).
- Không có index trên `orders.created_by_admin_id` — báo cáo doanh thu theo nhân viên sẽ scan toàn bảng (`P2`).
- Không có index trên `orders (channel, placed_at)` — query "doanh thu POS theo ngày" có thể chậm khi data lớn (`P2`).

---

## 7. Security & Permission Findings

| Check | Hiện trạng | Evidence | Verdict |
|---|---|---|---|
| `pos.read` cho search | enforced | [AdminPosController.java:61](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminPosController.java#L61) | **PASS** |
| `pos.write` cho create | enforced | [AdminPosController.java:72](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminPosController.java#L72) | **PASS** |
| `pos.price_override` | enforced ở service layer | [PosOrderService.java:186-193](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L186-L193) | **PASS** |
| `receivables.override_limit` | enforced ở service layer | [CreditPolicyService.java:53-58](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/receivable/CreditPolicyService.java#L53-L58) | **PASS** |
| Refund — permission gate riêng | **không có** — dùng chung `pos.write` | [AdminPosController.java:93](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminPosController.java#L93) | **P1 SECURITY_RISK** |
| BE re-validate giá khi không có override | đúng (BE lấy giá từ DB) | [PosOrderService.java:226-234](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L226-L234) | **PASS** |
| BE re-validate stock | đúng | [PosOrderService.java:215-224](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L215-L224) | **PASS** |
| User thường (customer) tạo POS order | không có endpoint customer-facing cho POS | — | **PASS** |
| Audit ghi IP + UA | đúng cả ở create + refund | [PosOrderService.java:409-411](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L409-L411), [RefundService.java:197-198](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/payment/RefundService.java#L197-L198) | **PASS** |
| Dev header bypass (`bigbike.auth.dev-header-enabled`) | default false; check prod profile | [DevAdminAuthService.java:95-113](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/DevAdminAuthService.java#L95-L113) | **PASS** — nhưng tiềm ẩn: bất kỳ ai bật prop này trong prod là mở cổng. Cần có alert/banner khi prop bật. |
| JSON injection trong audit payload | safe (payloadString hard-coded fields, không escape user input vào JSON) | [PosOrderService.java:393-399](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L393-L399) | **PASS** |

---

## 8. Inventory / Serial / Warranty Findings

| Check | Verdict | Note |
|---|---|---|
| Non-serial: stock trừ 1 lần, ghi stock_movements | **PASS** | test cover |
| Serial: reserve→SOLD trong cùng tx | **PASS** | test cover (`Phase2FSerialInventoryTest`) |
| Serial: warranty_records auto-create | **PASS** | [SerialLifecycleService.java:163-183](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/SerialLifecycleService.java#L163-L183) |
| Idempotent serial reserve | **PASS** | line 96-98 |
| **Refund serial: SOLD → IN_STOCK** | **FAIL P0** | Không có code path. Serial kẹt SOLD. |
| **Refund serial: huỷ warranty** | **FAIL P0** | Không có. Warranty record vẫn ACTIVE sau refund. |
| Stock state recompute sau giảm | **PASS** | `inventoryPolicyService.recomputeStockState(v)` |
| Trigger DB sync qty cho serial | **PASS** | `fn_sync_qty_from_serial_lifecycle` |
| Refund partial → không restore stock | **PASS** | đúng nghiệp vụ — phải refund full mới hoàn kho |

---

## 9. Payment / Receivable / Refund Findings

| Check | Verdict | Note |
|---|---|---|
| CASH payment record (provider=POS, status=PAID) | **PASS** | line 352-364 |
| CARD_TERMINAL payment record | **PASS** | giống CASH; `cardReferenceNumber` chưa gán vào `payment.transactionId` (P2) |
| CREDIT không downpayment: 0 payment record | **PASS** | line 350 guard |
| CREDIT có downpayment: 1 payment record `downPaymentMethod` | **PASS** | line 354-356 |
| Receivable outstanding khớp order.totalAmount - downpayment | **PASS** | [ReceivableService.java:68-77](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/receivable/ReceivableService.java#L68-L77) |
| Receivable idempotency (retry không tạo 2 receivable) | **PASS** | controller short-circuits trước khi gọi createReceivable; test cover |
| Refund full → cancel receivable (WRITTEN_OFF, reason ORDER_REFUNDED) | **PASS** | [RefundService.java:139-151](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/payment/RefundService.java#L139-L151) |
| Refund partial → KHÔNG đụng receivable | **PASS** | đúng nghiệp vụ |
| Refund partial CREDIT: BE allow, FE ẩn nút | **PARTIAL** | P1 (case 16) |
| Payment.refundAmount tích luỹ | **PASS** | line 153-160 |
| Refund_transactions ledger | **PASS** | V101 |
| Tendered amount validation (CASH) | **PASS** | line 267-273 |
| Down payment range (0..total) | **PASS BE** + **PASS FE** | BE validate gián tiếp qua receivable creation; FE validate `0 <= downPayment <= total` |
| ChangeAmount cho retry idempotent CASH dùng tendered mới | **PARTIAL** | Idempotent retry trả lại order cũ nhưng dùng `req.tenderedAmount` mới để tính change — UX confusing nếu retry với số tiền khác (P2) |
| Receivable record_payment sau khi đơn refund full | **NEEDS_VERIFICATION** | sau refund full, status receivable đã WRITTEN_OFF — record_payment block đúng; chưa có test cụ thể |

---

## 10. Test Coverage

### Hiện có ([Phase1MPosApiTest.java](../../bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1MPosApiTest.java))

Cover được:
- Auth (search/create/refund không token → 401).
- CASH happy path: COMPLETED, PAID, qty giảm đúng.
- Validation: qty=0, exceedStock, variant không thuộc product, missing variantId, paymentMethod invalid, insufficient tendered.
- Idempotency: retry không double-decrement.
- Snapshot fields: createdByAdminId, customerName.
- Price override: with / without permission.
- Side effects: payment record, stock movement, audit log với paymentMethod.
- CREDIT: without/with downpayment, missing customerId, creditEnabled=false, over credit limit (with/without override), stock decrement, idempotency không double-create receivable, audit paymentMethod=CREDIT.
- Refund: full (qty restore), partial (no restore + chain to full), UNPAID credit reject, exceeds paidAmount, no-auth.

### Thiếu — phải bổ sung trước khi launch

| Test cần thêm | Lý do | Priority |
|---|---|---|
| Refund full đơn serial-tracked → assert serial về IN_STOCK + warranty CLOSED | Cover P0-1 sau khi fix | P0 |
| Refund partial đơn serial-tracked → assert serial state | Cover edge case | P0 |
| Refund đơn CREDIT PARTIALLY_PAID → assert paymentStatus, refundAmount, receivable | Cover case 16 | P1 |
| FE: cart `hasSerial` được set khi variant trackSerials | Cover FE warning | P0 |
| Concurrent POS sale cùng variant (load test 50 concurrent) | Verify FOR UPDATE đủ | P1 |
| Permission `pos.refund` (sau khi thêm) | Refund permission split | P1 |
| Audit log có cờ `priceOverridden`/`creditLimitOverridden` (sau fix) | Compliance | P1 |
| Dashboard/report query group by channel=IN_STORE | Doanh thu POS hiển thị đúng | P2 |
| POS order list trong AdminOrders detail có đầy đủ context (payment method, staffId, serial bridge) | Operations visibility | P2 |
| Receipt re-print từ AdminOrderDetail | FE alternative cho lost cart snapshot | P2 |

---

## 11. Production Readiness Verdict

| Module | Verdict | Lý do |
|---|---|---|
| POS core CASH sale (non-serial) | **PASS** | Đủ test, đủ idempotency, đủ audit. |
| POS CARD_TERMINAL sale (non-serial) | **PASS** | Chỉ thiếu `transactionId` mapping (P2). |
| POS CREDIT sale | **PASS** | Đủ test; thiếu cờ override-audit (P1). |
| POS Serial-tracked sale | **PASS** | Có lifecycle, idempotent. |
| POS Refund non-serial full + partial | **PASS** | Đủ test, đủ ledger. |
| **POS Refund serial-tracked** | **FAIL** | **P0** — serial state không revert, warranty zombie. |
| **POS Refund CREDIT PARTIALLY_PAID** | **PARTIAL** | BE OK, FE ẩn nút (P1). |
| Permission isolation | **PARTIAL** | Refund không có permission riêng (P1). |
| Receipt UX | **PARTIAL** | Popup blocker / lost snapshot (P1-P2). |
| Dashboard/report visibility | **NEEDS_RUNTIME_VERIFICATION** | Channel set đúng, chưa test query. |

### Có thể launch shop bán trực tiếp chưa?

- **Nếu shop chỉ bán hàng non-serial** (găng tay, áo gió, phụ kiện không cần seri): **CÓ THỂ LAUNCH** sau khi fix P1 refund-permission và FE refund button cho CREDIT PARTIALLY_PAID. Operations chấp nhận được rủi ro audit chưa tối ưu.
- **Nếu shop bán hàng track-serials** (mũ Arai/Shoei/HJC có seri, áo giáp có seri): **CHƯA THỂ LAUNCH** — P0-1 (refund serial leak) phải fix trước, nếu không sẽ phát sinh inventory drift ngay trong tuần đầu vận hành.

---

## 12. Fix Plan

### P0 — Must fix before launch (nếu launch với hàng serial)

1. **Thêm path refund serial trong `SerialLifecycleService`** + tích hợp vào `RefundService.applyRefund`:
   - Khi `fullRefund && wasCompleted` và line item có bridge `order_line_item_serials`: chuyển serial `SOLD` → một trạng thái phù hợp (`RETURNED` chờ inspection HOẶC `IN_STOCK` trực tiếp — cần chốt nghiệp vụ với shop).
   - Huỷ/đóng `warranty_records` của serial đó (`status = 'CANCELLED'` + `cancelled_reason = 'ORDER_REFUNDED'`).
   - Ghi `stock_movements` với `referenceType=ORDER_REFUND` cho từng serial.
   - DB trigger sẽ tự sync `quantity_on_hand`.
   - Idempotent (re-run không double-restore).
   - Cover test: `posRefund_fullRefund_serialTrackedItem_restoresSerialAndClosesWarranty`.

2. **FE pass `trackSerials` qua cart**:
   - `contracts.js` `normalizeVariant`: thêm `trackSerials: Boolean(input.trackSerials)`.
   - `PosScreen.jsx` `addToCart`: copy `hasSerial: variant.trackSerials === true` vào cart item.
   - Verify warning `pos.refundSerialWarning` hiện đúng khi item có serial.

### P1 — Should fix soon

3. **FE: hiện refund button khi `paidAmount > refundAmount`** (cho phép refund đơn CREDIT PARTIALLY_PAID):
   - `PosScreen.jsx`: thay `isPaid = paymentStatus === 'PAID'` bằng `canRefund = (paidAmount > 0) && (paymentStatus !== 'REFUNDED')`. Render maxRefundable = paidAmount - refundedAmount.
   - BE đã hỗ trợ — không cần đổi.

4. **Tách permission `pos.refund`** (hoặc `orders.refund`):
   - Migration mới: insert permission `pos.refund` cho `ADMIN` role (không cấp SHOP_MANAGER).
   - `AdminPosController.posRefund` đổi sang `requirePermission(request, "pos.refund")`.
   - Update `RolesScreen.jsx`, i18n.

5. **Audit log thêm cờ override**:
   - Trong `PosOrderService.createOrder` build audit JSON: thêm `"priceOverridden": <boolean>`, `"creditLimitOverridden": <boolean>`.
   - Trong `RefundService` audit: thêm `"refundType": "FULL"|"PARTIAL"`.

6. **BE response trả line items + summary** cho POS create:
   - `PosOrderResponse` thêm `items[]` (productName, variantName, qty, unitPrice, lineTotal) để FE re-print từ orderId mà không phụ thuộc local snapshot.

7. **CARD_TERMINAL: gán `cardReferenceNumber` vào `payment.transactionId`** cho reconciliation.

### P2 — Improvement

8. Receipt fallback khi popup bị chặn: dùng iframe hidden + `window.print()` (Chrome cho phép) hoặc data-URL download.
9. Search customer khi không CREDIT — cho phép link đơn POS với `customer_id` hiện có thay vì chỉ name+phone snapshot.
10. Multi-payment (split tender): cho phép 1 đơn có nhiều payment record (mặt tiền + thẻ). Cần đổi schema response và FE.
11. Index `orders (channel, placed_at)` + `orders (created_by_admin_id, placed_at)` cho dashboard.
12. UI cảnh báo / disable khi `bigbike.auth.dev-header-enabled=true` đang chạy ở prod profile.
13. POS order list / detail trong AdminOrders cần highlight `channel=IN_STORE`, hiển thị staffId, payment provider POS.

---

## Phụ lục — Files đã đọc làm bằng chứng

**Backend (service + repo + entity)**:
- [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminPosController.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminPosController.java)
- [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java)
- [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/payment/RefundService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/payment/RefundService.java)
- [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/SerialLifecycleService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/SerialLifecycleService.java)
- [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/OrderStockRestoreService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/OrderStockRestoreService.java)
- [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/receivable/CreditPolicyService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/receivable/CreditPolicyService.java)
- [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/receivable/ReceivableService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/receivable/ReceivableService.java)
- [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/DevAdminAuthService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/DevAdminAuthService.java)

**Frontend**:
- [bigbike-admin/src/screens/PosScreen.jsx](../../bigbike-admin/src/screens/PosScreen.jsx)
- [bigbike-admin/src/lib/adminApi.js (POS section line 2267-2295)](../../bigbike-admin/src/lib/adminApi.js#L2267-L2295)
- [bigbike-admin/src/lib/contracts.js (normalizeVariant line 189-215)](../../bigbike-admin/src/lib/contracts.js#L189-L215)
- [bigbike-admin/src/App.jsx (route + permissions line 50, 222, 416)](../../bigbike-admin/src/App.jsx)
- [bigbike-admin/src/screens/RolesScreen.jsx (line 25-26, 90-91)](../../bigbike-admin/src/screens/RolesScreen.jsx#L25-L91)

**Migrations**:
- [V7__create_order_tables.sql](../../bigbike-backend/src/main/resources/db/migration/V7__create_order_tables.sql)
- [V46__add_order_channel_and_payment_method.sql](../../bigbike-backend/src/main/resources/db/migration/V46__add_order_channel_and_payment_method.sql)
- [V71__add_pos_staff_and_customer_name_to_orders.sql](../../bigbike-backend/src/main/resources/db/migration/V71__add_pos_staff_and_customer_name_to_orders.sql)
- [V75__add_credit_and_receivables.sql](../../bigbike-backend/src/main/resources/db/migration/V75__add_credit_and_receivables.sql)
- [V79__backfill_pos_receivables_permissions.sql](../../bigbike-backend/src/main/resources/db/migration/V79__backfill_pos_receivables_permissions.sql)
- [V83__add_version_to_accounts_receivable.sql](../../bigbike-backend/src/main/resources/db/migration/V83__add_version_to_accounts_receivable.sql)
- [V89__add_product_serial_lifecycle.sql](../../bigbike-backend/src/main/resources/db/migration/V89__add_product_serial_lifecycle.sql)
- [V90__add_serial_bridge_tables_and_warranty.sql](../../bigbike-backend/src/main/resources/db/migration/V90__add_serial_bridge_tables_and_warranty.sql)
- [V101__create_refund_transactions_table.sql](../../bigbike-backend/src/main/resources/db/migration/V101__create_refund_transactions_table.sql)

**Docs**:
- [docs/business/WORKFLOW_OVERVIEW.md (POS Workflow line 15-24)](../../docs/business/WORKFLOW_OVERVIEW.md#L15-L24)
- [docs/business/BUSINESS_RULES.md (POS Rules line 54-60, AR_RULE line 144-150)](../../docs/business/BUSINESS_RULES.md#L54-L60)
- [docs/business/ACCEPTANCE_CRITERIA.md (POS line 12)](../../docs/business/ACCEPTANCE_CRITERIA.md#L12)
- [docs/engineering/API_FLOW_MAP.md (POS line 15, 30-38)](../../docs/engineering/API_FLOW_MAP.md#L15-L38)
- [docs/engineering/SERIAL_INVENTORY_FLOW.md (POS Flow line 127-147)](../../docs/engineering/SERIAL_INVENTORY_FLOW.md#L127-L147)

**Tests**:
- [bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1MPosApiTest.java](../../bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1MPosApiTest.java)
- [bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase2FSerialInventoryTest.java](../../bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase2FSerialInventoryTest.java)
