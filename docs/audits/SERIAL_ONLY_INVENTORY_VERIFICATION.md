# SERIAL_ONLY_INVENTORY_VERIFICATION

> **Phạm vi:** xác minh xem hệ thống BigBike đã sẵn sàng để **bỏ hoàn toàn “nhập tay số lượng tồn kho”** và chuyển sang **serial là nguồn dữ liệu duy nhất** chưa.
> **Phương pháp:** đọc trực tiếp code Java, SQL migration, React admin UI. Không sửa code. Mọi kết luận đều có file + dòng.
> **Ngày audit:** 2026-05-10
> **Auditor:** Senior Backend Engineer + System Auditor

---

## 1. Executive Summary

### Verdict: **NOT_READY (BLOCKED)**

Hệ thống hiện đang chạy **hai mô hình tồn kho chạy song song và không đồng bộ với nhau**:

1. **Mô hình "số lượng" cũ** — `product_variants.quantity_on_hand` / `products.stock_quantity` — được TẤT CẢ các luồng bán hàng, huỷ đơn, hoàn tiền, trả hàng đọc và sửa trực tiếp.
2. **Mô hình "serial" mới** — bảng `product_serials` (tái lập ở V89) với 7-state lifecycle — chỉ được admin UI (`AdminSerialService`) ghi vào. Một DB trigger (`fn_sync_qty_from_serial_lifecycle`) cố gắng đồng bộ ngược `quantity_on_hand` từ count `status='IN_STOCK'`, nhưng **chỉ trigger khi bảng `product_serials` bị động chạm** (INSERT/UPDATE OF status/DELETE).

Hậu quả nghiêm trọng nhất: **mọi đơn bán đều decrement `quantity_on_hand` trực tiếp mà không hề chuyển serial sang `RESERVED`/`SOLD`**. Điều đó làm 2 nguồn dữ liệu lệch ngay sau lần bán đầu tiên, và lần sau admin chạm serial bất kỳ, trigger sẽ **ghi đè `quantity_on_hand` bằng count IN_STOCK cũ**, tức là tồn kho có thể "hồi sinh" sai. Refund/return cũng không trả serial về IN_STOCK.

### Rủi ro lớn nhất nếu chuyển serial-only ngay (mà không fix gì):

| # | Rủi ro | Mức |
|---|--------|-----|
| 1 | **Bán quá số serial thật** — hệ thống vẫn chỉ chặn theo `quantity_on_hand`, không kiểm tra số lượng serial IN_STOCK | P0 |
| 2 | **Trùng / mất dấu serial** giữa 3 bảng (`product_serials`, `stock_movement_serials`, `stock_receipt_serials`) | P0 |
| 3 | **Tồn kho rollback ngược về count cũ** mỗi khi admin thao tác serial (do trigger overwrites) | P0 |
| 4 | **Sold serial không được trace tới khách hàng** (OrderLineItem không lưu serialId) → bảo hành không truy được | P0 |
| 5 | **Cancel/refund/return không trả serial về kho** → kho ảo lệch lớn dần | P0 |
| 6 | **Dữ liệu cũ chưa có serial** — sản phẩm đã có `quantity_on_hand > 0` nhưng `product_serials` rỗng → bật serial-only sẽ ra OUT_OF_STOCK ngay | P0 |
| 7 | DB schema còn 2 bảng serial orphan (`stock_receipt_serials`, `stock_movement_serials`) chưa có code Java map vào | P1 |

**Kết luận business:** Không được tắt nhập tay số lượng cho đến khi hoàn thành ít nhất Migration Plan ở Section 8 và các fix P0 ở Section 10.

---

## 2. Evidence Table

| ID | Vấn đề | Kết luận | Mức | File | Function/Class | Dòng | Bằng chứng |
|----|--------|---------|-----|------|---------------|------|------------|
| **#1** | Tồn kho hiện chưa lấy serial làm nguồn dữ liệu duy nhất | **TRUE** | P0 | [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java) | `syncPricesAndValidateStock`, `decrementVariantStock` | 822-869, 895-912 | Validate stock dùng `variant.getQuantityOnHand()`, decrement bằng setter trực tiếp; không truy `product_serials` |
| **#2** | Hệ thống vẫn còn cho nhập/sửa số lượng tồn kho trực tiếp | **TRUE** | P0 | [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminInventoryService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminInventoryService.java) | `adjustStock`, `adjustProductStock` | 173-283, 287-355 | Block nếu `isTrackSerials()` (lines 187-192, 298-302); KHI false vẫn cho nhập tay `quantityDelta` |
| **#3** | Thêm serial chưa chắc làm tồn kho tăng | **PARTIAL** | P1 | [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSerialService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSerialService.java) | `persistSerials` | 197-228 | Java code không setQuantityOnHand. **Chỉ DB trigger V89 (`fn_sync_qty_from_serial_lifecycle`) tự sync** — phụ thuộc trigger còn tồn tại trên DB. Nếu chạy clean migrations thì có; nếu rollback V89 thì mất sync |
| **#4** | Đổi trạng thái serial chưa chắc làm tồn kho thay đổi | **PARTIAL** | P1 | [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSerialService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSerialService.java) | `updateStatus` | 137-173 | Java setStatus rồi save → trigger AFTER UPDATE OF status mới sync. **Không ghi `stock_movements`** → lịch sử biến động bị mất |
| **#5** | Product có biến thể chưa chắc tổng hợp tồn kho từ các biến thể | **TRUE** | P1 | [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/catalog/ProductEntity.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/catalog/ProductEntity.java) | `stockQuantity`, `stockState` | 96-99 | ProductEntity có column `stock_quantity` riêng, không tự sum từ variants. Trigger V89 chỉ cập nhật khi serial gắn trực tiếp vào product (không variant) |
| **#6** | Product không biến thể chưa chắc tính tồn kho từ serial | **PARTIAL** | P0 | [bigbike-backend/src/main/resources/db/migration/V89__add_product_serial_lifecycle.sql](bigbike-backend/src/main/resources/db/migration/V89__add_product_serial_lifecycle.sql) | `fn_sync_qty_from_serial_lifecycle` | 121-149 | Trigger có nhánh xử lý product không variant nhưng phụ thuộc `track_serials = true`. Nếu admin chưa enable thì product vẫn dùng `stock_quantity` nhập tay. AdminInventoryService.adjustProductStock cho phép nhập tay (line 287-355) |
| **#7** | Bán hàng hiện còn trừ số lượng trực tiếp thay vì giữ/bán serial | **TRUE** | P0 | [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java), [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java) | `decrementVariantStock`, `decrementStock` (POS) | Checkout 895-912; POS 432-460 | Cả 2 luồng: `setQuantityOnHand(after)` + `stockMovementRepo.save(...)`. **Không tham chiếu `ProductSerialEntity` ở bất kỳ đâu** trong cả 2 service |
| **#8** | Huỷ đơn chưa chắc trả serial về kho | **TRUE** | P0 | [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/OrderStockRestoreService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/OrderStockRestoreService.java) | `restoreForCancel`, `doRestore` | 43-105 | Increment qty và ghi stock_movement; **Không update bất kỳ ProductSerialEntity nào** |
| **#9** | Hoàn tất đơn chưa chắc chuyển serial sang đã bán | **TRUE** | P0 | [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java) | `updateOrderStatus` | 217-279 | Khi chuyển sang COMPLETED chỉ set `completedAt`, không động vào serial. Không có lookup serial gắn với order line |
| **#10** | Trả hàng chưa chắc đưa serial vào trạng thái kiểm tra trước khi cộng kho | **TRUE** | P0 | [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminReturnService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminReturnService.java) | `restoreStockForReturn` | 218-273 | Increment qty trực tiếp về IN_STOCK; bỏ qua bước INSPECTION mà state machine thiết kế đã định nghĩa (RETURNED → INSPECTION → IN_STOCK/DAMAGED/SCRAPPED). Không có code update ProductSerialEntity.status |
| **#11** | Bảo hành chưa chắc gắn với serial | **NOT_FOUND** (=feature missing) | P0 | n/a | n/a | n/a | Search `Warranty*.java`, `warrant` trong `bigbike-backend`: 0 service / 0 controller / 0 entity. Toàn dự án backend **không có module warranty**. |
| **#12** | Có nguy cơ serial trùng hoặc serial nằm ở nhiều bảng khác nhau | **TRUE** | P0 | DB schema | 3 bảng | n/a | (a) `product_serials` (V89) — có chassis/engine + status. (b) `stock_movement_serials` (V57) — chỉ `serial_number` string. (c) `stock_receipt_serials` (V55) — chỉ `serial_number` string. Cả (b) và (c) không tham chiếu chéo (a). Một serial vật lý có thể tồn tại ở (a) nhưng không ở (b)/(c) hoặc ngược lại |
| **#13** | DB migration có dấu hiệu mâu thuẫn giữa product_serials, stock_receipt_serials, stock_movement_serials | **TRUE** | P0 | [V51](bigbike-backend/src/main/resources/db/migration/V51__add_serial_tracking.sql), [V54](bigbike-backend/src/main/resources/db/migration/V54__remove_serial_tracking.sql), [V55](bigbike-backend/src/main/resources/db/migration/V55__add_receipt_serials.sql), [V57](bigbike-backend/src/main/resources/db/migration/V57__add_stock_movement_serials.sql), [V89](bigbike-backend/src/main/resources/db/migration/V89__add_product_serial_lifecycle.sql) | n/a | n/a | V51 tạo product_serials → V54 DROP TABLE → V55 tạo stock_receipt_serials → V57 tạo stock_movement_serials → V89 RECREATE product_serials. Bất kỳ data product_serials nào tạo ở V51-V53 đã bị DROP ở V54. V89 bắt đầu rỗng |
| **#14** | Admin UI chưa phù hợp với mô hình serial-only | **PARTIAL** | P1 | [bigbike-admin/src/screens/InventoryScreen.jsx](bigbike-admin/src/screens/InventoryScreen.jsx) | `StockInModal`, `SerialManageModal`, `columns.actions` | 510-818, 1112-1203, 1425-1446 | UI ẩn nút "Nhập kho" cho variant đã `trackSerials`, hiện "Quản lý serial". Nhưng nút "Nhập kho" trên header (line 1459) vẫn mở modal nhập số lượng/serial vào BẢNG `stock_movement_serials`, không phải `product_serials`. Hai luồng vẫn coexists trong UI |
| **#15** | Báo cáo/export chưa phù hợp với mô hình serial-only | **TRUE** | P1 | [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminInventoryService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminInventoryService.java) | `exportCsv` | 145-169 | CSV header chỉ có `quantityOnHand`, không export serial detail (chassis, engine, status). Không có endpoint export serial list theo trạng thái |
| **#16** | Quyền quản lý serial chưa được tách rõ | **TRUE** | P1 | [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminInventoryController.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminInventoryController.java) | (mọi serial endpoint) | 121-202 | Tất cả endpoint serial dùng chung permission `products.read` / `products.update`. Không có permission riêng `inventory.serial.add` / `inventory.serial.transition` / `inventory.serial.scrap` |
| **#17** | Audit log serial chưa đủ để truy vết | **PARTIAL** | P1 | [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSerialService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSerialService.java) | `addToVariant`, `updateStatus` | 222-225, 166-170 | Có audit `SERIALS_ADDED` (count + ids) và `SERIAL_STATUS_CHANGED` (from/to). KHÔNG ghi note/lý do bắt buộc khi đổi trạng thái (note là optional). Không có audit cho INSPECTION result. Không có audit khi serial bị `DELETE` (entity không có cơ chế xoá nhưng schema cho phép) |
| **#18** | Dữ liệu cũ chưa có kế hoạch chuyển sang serial-only | **TRUE** | P0 | [V89](bigbike-backend/src/main/resources/db/migration/V89__add_product_serial_lifecycle.sql), [V30](bigbike-backend/src/main/resources/db/migration/V30__add_inventory_tracking.sql) | n/a | n/a | V30 backfill `quantity_on_hand` từ `products.stock_quantity` cho variant. V89 tạo bảng product_serials RỖNG, không có script backfill từ qty cũ. Không có data migration script nào tạo serial từ qty hiện tại |
| **#19** | Web/mobile/admin có thể đang hiển thị tồn kho từ field cũ | **TRUE** | P1 | [bigbike-web/components/catalog/StockStatus.tsx](bigbike-web/components/catalog/StockStatus.tsx), [bigbike-web/components/catalog/PurchaseSectionClient.tsx](bigbike-web/components/catalog/PurchaseSectionClient.tsx), [bigbike-web/app/api/products/[id]/stock/route.ts](bigbike-web/app/api/products/[id]/stock/route.ts) | n/a | n/a | Web đọc `stockState`, `stockQuantity`, `quantityOnHand` từ public API — đó chính là field cũ. Nếu trigger V89 có chạy thì giá trị sẽ đúng, nhưng vẫn là **derived field**, không phải đếm trực tiếp serial |
| **#20** | Có nguy cơ bán hàng khi không còn serial khả dụng | **TRUE** | P0 | [bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java) | `syncPricesAndValidateStock` | 822-869 | Validate dùng `variant.getQuantityOnHand() < cartItem.getQuantity()`. Vì `quantity_on_hand` lệch với serial count (xem #7), khả năng cao bán được đơn dù `product_serials` IN_STOCK = 0 |

---

## 3. Current Inventory Flow (As-Is)

### 3.1 Sản phẩm có biến thể (Variant)

```
ADMIN tạo product + variants
   └─> AdminCatalogController (UpsertProductRequest, VariantRequest)
       - Không expose quantityOnHand / trackSerials trong DTO
       - Variant lưu DB với quantity_on_hand = 0, track_serials = false (default)

ADMIN bật quản lý serial (UI: "Bật quản lý serial")
   └─> POST /admin/inventory/variants/{id}/enable-tracking?enabled=true
       └─> AdminSerialService.enableVariantTracking
           - Set track_serials = true
           - quantity_on_hand vẫn còn nguyên giá trị cũ (KHÔNG bị reset về 0)

ADMIN nhập serial qua "Quản lý serial"
   └─> POST /admin/inventory/variants/{id}/serials
       └─> AdminSerialService.addToVariant → persistSerials
           - INSERT product_serials (status=IN_STOCK)
           - DB trigger fn_sync_qty_from_serial_lifecycle (V89)
             → UPDATE product_variants SET quantity_on_hand = COUNT(IN_STOCK)
                                       SET stock_state = …
           - Audit: SERIALS_ADDED
           - KHÔNG ghi stock_movements row → lịch sử biến động không hiện thị

ADMIN nhập số lượng tay (variant chưa trackSerials)
   └─> POST /admin/inventory/variants/{id}/adjust
       └─> AdminInventoryService.adjustStock
           - Block nếu trackSerials=true (line 187-192)
           - INSERT stock_movements + stock_movement_serials (chỉ chứa string)
           - SET variant.quantity_on_hand += delta
           - SET variant.stockState recompute
           - Audit: INVENTORY_STOCK_ADJUSTED
           - KHÔNG INSERT product_serials (lifecycle table) → orphan serial number
```

### 3.2 Sản phẩm không biến thể

```
ADMIN bật quản lý serial cho product
   └─> POST /admin/inventory/products/{id}/enable-tracking?enabled=true
       └─> AdminSerialService.enableProductTracking → product.track_serials=true

ADMIN nhập serial
   └─> POST /admin/inventory/products/{id}/serials
       - Bắt buộc product.variants phải rỗng (line 127-130)
       - INSERT product_serials với product_variant_id = NULL
       - DB trigger sync products.stock_quantity = COUNT(IN_STOCK no-variant)

ADMIN nhập số lượng tay
   └─> POST /admin/inventory/products/{id}/adjust
       - Block nếu trackSerials (line 298-302)
       - SET product.stock_quantity, recompute stockState
       - INSERT stock_movements (referenceType=MANUAL)
       - **KHÔNG hỗ trợ serialNumbers** (line 315 comment xác nhận)
```

### 3.3 Đặt hàng (cart checkout / quick buy / POS)

```
CUSTOMER checkout
   └─> CheckoutService.syncPricesAndValidateStock
       - LOCK ProductVariantEntity FOR UPDATE
       - Compare variant.quantityOnHand vs cart qty
       - **KHÔNG truy product_serials**
   └─> CheckoutService.decrementStockForCartItems
       - variant.setQuantityOnHand(before - qty)
       - INSERT stock_movements (referenceType=ORDER, movementType=OUT)
       - **KHÔNG SELECT product_serials WHERE status=IN_STOCK LIMIT qty FOR UPDATE**
       - **KHÔNG UPDATE product_serials SET status=RESERVED|SOLD**
   └─> Order saved, status=PROCESSING (COD) hoặc ON_HOLD (BACS)

POS bán tại cửa hàng
   └─> PosOrderService.createOrder → decrementStock
       - Cùng pattern: set quantity_on_hand, ghi stock_movements
       - Order status = COMPLETED ngay
       - **KHÔNG đụng serial table** ⇒ kho IN_STOCK của serial vẫn nguyên,
         qty_on_hand đã giảm → 2 nguồn lệch
```

### 3.4 Huỷ / Hoàn tiền / Trả hàng

```
ADMIN cancel order (PROCESSING/ON_HOLD → CANCELLED)
   └─> AdminOrderService.updateOrderStatus
   └─> OrderStockRestoreService.restoreForCancel
       - Idempotency check: stock_movements có ref ORDER_CANCEL chưa?
       - LOCK variant FOR UPDATE
       - quantity_on_hand += item.qty
       - INSERT stock_movements (referenceType=ORDER_CANCEL)
       - **KHÔNG UPDATE product_serials SET status=IN_STOCK WHERE order_line_item_id=...**

ADMIN refund order (full)
   └─> RefundService.applyRefund
   └─> Nếu fullRefund && wasCompleted: OrderStockRestoreService.restoreForRefund
       - **KHÔNG đụng serial table**
   └─> Nếu chỉ partial refund: KHÔNG restore stock luôn

ADMIN nhận hàng trả (RECEIVED → COMPLETED hoặc REFUNDED)
   └─> AdminReturnService.updateStatus
   └─> restoreStockForReturn
       - Idempotency: stock_movements có ref RETURN chưa?
       - quantity_on_hand += ri.qty
       - INSERT stock_movements (referenceType=RETURN, movementType=IN)
       - **Bỏ qua INSPECTION step** — đáng lẽ:
            SOLD → RETURNED → INSPECTION → (IN_STOCK | DAMAGED | SCRAPPED)
         nhưng code "cộng thẳng vào IN_STOCK qty"
       - **KHÔNG UPDATE product_serials.status**
```

---

## 4. Target Serial-only Flow (To-Be)

### 4.1 Add serial (admin nhập kho)

```
POST /admin/inventory/[variants|products]/{id}/serials
  Service.addSerials:
    BEGIN TX
      validate dedup (chassis+engine across product_serials globally unique)
      FOR each serial:
        INSERT product_serials (status=IN_STOCK, received_at=now, admin_id=actor)
      INSERT stock_movements (movementType=IN, qtyDelta=+N, refType=SERIAL_RECEIVE,
                              note=…, referenceId=audit_log.id)
      INSERT audit_log (SERIALS_ADDED, before=null, after={ids,count})
    COMMIT
  → Hibernate flush → trigger sync qty_on_hand & stock_state
  → Optional: WS event INVENTORY_UPDATED
```

### 4.2 Reserve serial (checkout: order PROCESSING)

```
CheckoutService.checkoutFromCart:
  BEGIN TX
    SELECT … FROM product_serials
      WHERE product_id=? AND (variant_id=? OR null)
        AND status='IN_STOCK'
      ORDER BY received_at ASC
      LIMIT cartItem.qty
      FOR UPDATE SKIP LOCKED   -- chống tranh chấp
    nếu found.size < qty → ConflictException("hết hàng theo serial")
    UPDATE product_serials
      SET status='RESERVED',
          reserved_until = now() + interval '15 min',
          order_line_item_id = ?,
          updated_at=now()
    INSERT stock_movements (movementType=OUT_RESERVE, ...)
  COMMIT

Background job (cron 1m): UPDATE product_serials SET status='IN_STOCK', reserved_until=null
  WHERE status='RESERVED' AND reserved_until < now()
  AND order_line_item_id IN (SELECT id FROM order_line_items
                              WHERE order.status IN ('CANCELLED','FAILED'))
```

### 4.3 Sell serial (order COMPLETED)

```
AdminOrderService.updateOrderStatus(... → COMPLETED):
  ...
  SerialLifecycleService.markSold(orderId):
    UPDATE product_serials
      SET status='SOLD', sold_at=now()
      WHERE order_line_item_id IN (SELECT id FROM order_line_items WHERE order_id=?)
        AND status='RESERVED'
    INSERT stock_movements (movementType=OUT_SOLD)
```

### 4.4 Cancel order

```
OrderStockRestoreService.restoreForCancel:
  FOR each serial trong order:
    UPDATE product_serials
      SET status='IN_STOCK', reserved_until=null,
          order_line_item_id=null
      WHERE order_line_item_id=? AND status='RESERVED'
  Bỏ phần SET quantity_on_hand += qty
   (trigger sync sẽ tự cập nhật)
```

### 4.5 Refund order (full / partial)

- Chỉ chuyển trạng thái thanh toán + paymentStatus.
- KHÔNG tự động đưa serial về IN_STOCK (vì chưa có hàng vật lý back).
- Khi customer thực sự trả hàng → flow Return.

### 4.6 Return → Inspect → Reshelve / Damage / Scrap

```
RECEIVED:
  UPDATE product_serials SET status='RETURNED', returned_at=now()
  WHERE id IN (SELECT serial_id FROM return_item_serials WHERE return_id=?)

INSPECTION (admin manually):
  PATCH /admin/inventory/serials/{id}/status
    body: { status: 'INSPECTION', note: 'pending QC' }
  service.updateStatus(...) — đã có

POST INSPECTION:
  status='INSPECTION' → ('IN_STOCK' | 'DAMAGED' | 'SCRAPPED')
  Bắt buộc note + reason code (kê quyền inventory.serial.inspect.decide)

quantity_on_hand recompute via trigger (chỉ count IN_STOCK).
```

### 4.7 Warranty by serial

```
NEW: warranty_records table
  id, product_serial_id (unique), customer_id, order_line_item_id,
  start_date, end_date, claim_count, status (ACTIVE/EXPIRED/VOIDED), …

NEW: WarrantyService
  - On serial.status → 'SOLD': tự tạo warranty_record
  - On warranty claim: log + tracking
  - On serial.status → 'SCRAPPED': void warranty
```

### 4.8 Scrap / damage

```
Allowed transitions hiện tại trong ProductSerialStatus enum:
  IN_STOCK → DAMAGED | INSPECTION | SCRAPPED
  INSPECTION → IN_STOCK | DAMAGED | SCRAPPED
  DAMAGED → SCRAPPED
  SCRAPPED → (terminal)

Yêu cầu thêm:
  - Bắt buộc note ≠ blank khi DAMAGED/SCRAPPED
  - Audit log đầy đủ trước/sau
  - Permission inventory.serial.scrap riêng
```

---

## 5. Data Model Gap

### 5.1 Bảng / cột cần GIỮ

- `products` — vẫn cần (catalog), nhưng `stock_quantity`, `manage_stock` chuyển thành **derived/read-only** (cập nhật qua trigger).
- `product_variants` — vẫn cần, `quantity_on_hand` chuyển thành **derived**.
- `product_serials` (V89) — **canonical source of truth**, đầy đủ.
- `stock_movements` — vẫn cần làm event log; mở rộng `movement_type` để thêm `OUT_RESERVE`, `OUT_SOLD`, `IN_RETURN`, `SCRAP`.
- `track_serials` (cả ở products và product_variants) — vẫn cần, nhưng **target = TRUE cho TOÀN BỘ sản phẩm** sau migration.

### 5.2 Bảng / cột cần BỎ (sau migration thành công)

- `stock_movement_serials` ([V57](bigbike-backend/src/main/resources/db/migration/V57__add_stock_movement_serials.sql)) — **trùng chức năng với `product_serials`** mà chỉ là string serial. Nguy cơ data drift.
  - **Bằng chứng**: `AdminInventoryService.adjustStock` line 266-275 lưu vào bảng này; serial này KHÔNG liên kết với `product_serials`.
- `stock_receipt_serials` ([V55](bigbike-backend/src/main/resources/db/migration/V55__add_receipt_serials.sql)) — **orphan**, không có Java code map.
- `stock_receipts`, `stock_receipt_lines` ([V52](bigbike-backend/src/main/resources/db/migration/V52__add_stock_receipts.sql), [V53](bigbike-backend/src/main/resources/db/migration/V53__add_stock_receipt_lines.sql)) — **orphan**, không có service.
- `products.stock_quantity` (column) — chuyển sang `GENERATED ALWAYS AS … STORED` từ count IN_STOCK serials, hoặc bỏ và replace bằng view.
- `products.manage_stock` (column) — không còn ý nghĩa nếu serial-only.
- `product_variants.quantity_on_hand` — tương tự, nên chuyển GENERATED ALWAYS AS … hoặc làm derived view.

### 5.3 Bảng / cột cần MIGRATE

| From | To | Logic |
|------|-----|-------|
| `stock_movement_serials.serial_number` | `product_serials.chassis_number` (hoặc engine_number) | Snapshot tại nhập kho, chuyển 1-1 nếu chưa có trong `product_serials` |
| `product_variants.quantity_on_hand > 0` (chưa có serial) | Tạo placeholder `product_serials` với `chassis_number = "AUTO-{variantId}-{seq}"` | Cần admin xác nhận lại bằng số khung thật (data quality issue) |
| Old WP `stock_quantity` | Tương tự | Cần stocktake vật lý |

### 5.4 Quan hệ chuẩn hoá cần thêm

```
product_serials.id ─┐
                    ├── 1:1 ── order_line_item_serials (NEW BRIDGE TABLE)
                    │              order_line_item_id (FK)
                    │              serial_id (FK)
                    │              quantity_per_serial = 1
                    │
                    ├── 1:1 ── return_item_serials (NEW BRIDGE TABLE)
                    │              return_item_id (FK)
                    │              serial_id (FK)
                    │
                    └── 1:1 ── warranty_records (NEW)
                                   serial_id (UNIQUE)
                                   …
```

> Hiện tại `product_serials.order_line_item_id` (UNIQUE INDEX) chỉ cho phép 1 serial/1 dòng, không phù hợp khi line.qty > 1. Cần bridge table.

---

## 6. API Gap

### 6.1 Inventory

| Endpoint | Hiện trạng | Đề xuất |
|----------|------------|---------|
| `POST /admin/inventory/variants/{id}/adjust` | Cho nhập tay qty + serial number string | **REMOVE hoặc DEPRECATE** sau khi migrate xong |
| `POST /admin/inventory/products/{id}/adjust` | Cho nhập tay qty | **REMOVE** |
| `GET /admin/inventory` | Trả `quantityOnHand` từ field | OK (vì trigger sync), nhưng nên đổi nguồn sang COUNT product_serials WHERE IN_STOCK |
| `GET /admin/inventory/export.csv` | Chỉ qty | **THÊM** export serial detail (chassis, engine, status, sold_at, customer) |

### 6.2 Serial

| Endpoint | Hiện trạng | Đề xuất |
|----------|------------|---------|
| `POST /admin/inventory/variants/{id}/serials` | OK | Giữ. Bổ sung `requireReason` nếu nhiều hơn N |
| `POST /admin/inventory/products/{id}/serials` | OK | Giữ |
| `PATCH /admin/inventory/serials/{id}/status` | Cho đổi trạng thái free | **Thêm** validation: bắt buộc note khi → DAMAGED/SCRAPPED |
| `GET /admin/inventory/serials/{id}` | Trả entity | **Thêm** serial history (ai bán cho ai, return status, warranty) — tận dụng view `v_serial_history` (V51 từng có nhưng đã DROP V54, V89 không recreate) |
| **MISSING** | — | `GET /admin/inventory/serials?status=IN_STOCK&q=…` — list cross-product |
| **MISSING** | — | `POST /admin/inventory/serials/import` (CSV bulk) |
| **MISSING** | — | `GET /admin/inventory/serials/export?status=…` |
| **MISSING** | — | `POST /admin/inventory/serials/{id}/inspect` — endpoint INSPECTION với reason codes |

### 6.3 Checkout

| Endpoint | Hiện trạng | Đề xuất |
|----------|------------|---------|
| `POST /v1/checkout` | Validate qty → decrement qty | **REWRITE**: pick FIFO IN_STOCK serials → mark RESERVED, gắn vào order_line_item_serials |
| `POST /v1/checkout/quick-buy` | Same | Same |
| `POST /v1/pos/orders` | Same | Same — POS thậm chí phải để staff CHỌN serial cụ thể nếu showroom có nhiều xe cùng SKU |

### 6.4 Order

| Endpoint | Hiện trạng | Đề xuất |
|----------|------------|---------|
| `PATCH /admin/orders/{id}` (status) | Chỉ đổi status | **Thêm** call SerialLifecycleService.markSold/markCancelled tương ứng |
| `GET /admin/orders/{id}` | Trả line items không kèm serial | **Thêm** `serials: [{chassis, engine, status, soldAt}]` per line |

### 6.5 Return

| Endpoint | Hiện trạng | Đề xuất |
|----------|------------|---------|
| `POST /v1/returns` (customer initiate) | Tạo return_items với qty | **Thêm** field `serialIds: [...]` — bắt buộc khách chọn cụ thể serial nào trả |
| `PATCH /admin/returns/{id}` (status) | Cộng qty về kho | **REWRITE**: status RECEIVED → serial.status = RETURNED → admin INSPECTION |

### 6.6 Warranty

- **Toàn bộ module chưa tồn tại**. Cần build từ đầu.

### 6.7 Report/export

| Endpoint | Hiện trạng | Đề xuất |
|----------|------------|---------|
| `GET /admin/inventory/movements` | OK, nhưng dựa trên qty | Thêm filter theo `serial_id` |
| **MISSING** | — | `GET /admin/inventory/serials/aging-report` — bao lâu một serial đứng IN_STOCK |
| **MISSING** | — | `GET /admin/inventory/serials/by-status-summary` — count theo status, breakdown theo product/category |

---

## 7. UI Gap

| Màn | Hiện trạng | Cần sửa |
|-----|------------|---------|
| **Inventory list** ([InventoryScreen.jsx](bigbike-admin/src/screens/InventoryScreen.jsx)) | Có cột "Serial" badge cho variant đã trackSerials. Vẫn còn nút "Nhập kho" header global mở qty form | Bỏ nút "Nhập kho" global; thay bằng "Quản lý serial" picker. Hoặc gating sau khi serial-only mode bật |
| **Product detail admin** | Không expose trackSerials trong VariantRequest/UpsertProductRequest DTO | Thêm checkbox "Quản lý theo serial" + nút "Đi tới quản lý serial" |
| **Serial list** | Có trong SerialManageModal, nhưng nested trong inventory row | Cần **screen riêng** `Quản lý serial` cross-product, có filter status/product/from-to |
| **Serial detail** | Chỉ có status + receivedAt | Thêm: lịch sử transition, đơn hàng liên quan, customer, warranty status |
| **Order detail** | Line items không kèm serial info | Hiển thị serial(s) đã giao kèm chassis/engine |
| **Return detail** | Không có UI chọn serial | Cần customer chọn serial khi tạo yêu cầu trả; admin xem được |
| **Warranty detail** | Chưa có | Build mới |
| **Export/report** | Chỉ CSV qty | Thêm export serial CSV/Excel với filter status; báo cáo aging |
| **POS** | Chỉ chọn product+variant+qty | Phải cho staff scan/chọn serial cụ thể (ít nhất khi qty > 1 hoặc bắt buộc cho moto) |

---

## 8. Migration Plan (đề xuất)

### Phase 0 — Backup & Audit (1-2 ngày)

1. Backup PostgreSQL full (đã có sẵn trong `backups/`).
2. Snapshot count: tổng `quantity_on_hand` của tất cả variants + tổng `product_serials.IN_STOCK` hiện tại.
3. Inventory hiện tại có bao nhiêu sản phẩm → variant → tồn kho > 0 mà chưa có serial?
   ```sql
   SELECT pv.id, pv.sku, pv.quantity_on_hand,
          (SELECT COUNT(*) FROM product_serials ps
           WHERE ps.product_variant_id=pv.id AND ps.status='IN_STOCK') AS serial_count
   FROM product_variants pv
   WHERE pv.quantity_on_hand > 0;
   ```

### Phase 1 — Stocktake vật lý (1-2 tuần, tuỳ kho)

1. In list từ Phase 0 → cho admin showroom đối chiếu thực tế từng xe.
2. Nhập serial (chassis + engine) vào form import CSV mới (chưa có — cần build trước, xem Section 6.2).

### Phase 2 — Backfill serial từ stocktake

1. Build endpoint `POST /admin/inventory/serials/import` (CSV bulk).
2. Cho mỗi variant đã stocktake → bulk insert `product_serials` với status=IN_STOCK.
3. Set `track_serials=true` cho variant/product tương ứng.
4. Verify: COUNT IN_STOCK serial == quantity_on_hand đã ghi nhận.

### Phase 3 — Khoá nhập tay số lượng

1. Disable endpoint `POST /admin/inventory/variants/{id}/adjust` (return 410 Gone) cho admin.
2. Disable endpoint `POST /admin/inventory/products/{id}/adjust`.
3. UI: ẩn nút "Nhập kho" global trên `InventoryScreen`.
4. Backend giữ trigger V89 nhưng đảm bảo TRACK_SERIALS đã enable hết → mọi qty đều derived.

### Phase 4 — Rewrite checkout/POS/cancel/refund/return

(Xem Section 4.2-4.6.)

1. Implement `SerialLifecycleService` (new) — mọi mutation serial đi qua đây.
2. Refactor `CheckoutService`, `PosOrderService`: pick + reserve serial, không decrement qty.
3. Refactor `OrderStockRestoreService`: chuyển serial RESERVED → IN_STOCK thay vì increment qty.
4. Refactor `AdminOrderService`: COMPLETED → mark serial SOLD; CANCELLED → release reserve; REFUNDED (full) → ?  cần policy.
5. Refactor `AdminReturnService`: RECEIVED → serial RETURNED, chỉ vào IN_STOCK qua bước INSPECTION.

### Phase 5 — Bật serial-only

1. Set DB constraint: `track_serials=true` mặc định cho mọi product/variant mới.
2. Remove cột `quantity_on_hand`/`stock_quantity` (hoặc generated stored).
3. Drop bảng `stock_movement_serials`, `stock_receipt_serials`, `stock_receipts`, `stock_receipt_lines`.

### Phase 6 — Verify

```sql
-- Tất cả variants phải có quantity_on_hand = COUNT IN_STOCK serials
SELECT pv.id,
       pv.quantity_on_hand,
       (SELECT COUNT(*) FROM product_serials ps
        WHERE ps.product_variant_id=pv.id AND ps.status='IN_STOCK') AS sc
FROM product_variants pv
WHERE pv.quantity_on_hand <> (SELECT COUNT(*) FROM product_serials ps
                              WHERE ps.product_variant_id=pv.id
                              AND ps.status='IN_STOCK');
-- → empty = OK
```

```sql
-- Mọi order COMPLETED phải có serial SOLD tương ứng
SELECT o.id, o.order_number, oli.id, oli.quantity,
       (SELECT COUNT(*) FROM product_serials ps
        WHERE ps.order_line_item_id=oli.id AND ps.status='SOLD') AS sold
FROM orders o
JOIN order_line_items oli ON oli.order_id=o.id
WHERE o.status='COMPLETED'
  AND oli.product_variant_id IS NOT NULL
  AND (SELECT COUNT(*) FROM product_serials ps
       WHERE ps.order_line_item_id=oli.id AND ps.status='SOLD') <> oli.quantity;
-- → empty = OK
```

---

## 9. Test Plan

### 9.1 Unit test

- `SerialLifecycleService.reserve()` — không reserve nếu IN_STOCK = 0.
- `SerialLifecycleService.markSold()` — chỉ chuyển RESERVED → SOLD, không từ IN_STOCK trực tiếp (race condition với checkout).
- Allowed transitions matrix (xem `AdminSerialService.validateTransition` line 276-300).
- Trigger `fn_sync_qty_from_serial_lifecycle` — qty = COUNT(IN_STOCK).

### 9.2 Integration test

- Checkout 1 variant qty=2 → 2 serial chuyển RESERVED, qty còn lại = previous - 2.
- Checkout cùng variant đồng thời 2 client (race) → chỉ 1 thành công khi serial chỉ còn 1.
- Cancel order → serial về IN_STOCK, qty đúng.
- Refund full → serial KHÔNG tự về IN_STOCK (chỉ Return + Inspection làm điều đó).
- Return → INSPECTION → IN_STOCK; qty đúng. Return → INSPECTION → DAMAGED → SCRAPPED; qty không tăng.

### 9.3 API test (Postman/REST)

- `POST /admin/inventory/variants/{id}/serials` với 5 chassis trùng → 422.
- `PATCH /serials/{id}/status` chuyển IN_STOCK → SOLD trực tiếp → 422 (không có RESERVED middle state).
- Tất cả serial endpoint phải kiểm tra permission khác nhau.

### 9.4 E2E admin test

- Stocktake: import CSV 1000 serial → list serial chính xác.
- Inventory list: variant có 50 serial IN_STOCK + 30 SOLD → qty hiển thị 50.
- Admin chuyển 1 serial INSPECTION → qty hiển thị giảm 1, real-time.
- Sold serial UI hiện tên customer + order number.

### 9.5 Data migration test

- DB clean → run all migrations V1..V89 → schema OK.
- Old DB có data ở stock_movement_serials → backfill script tạo product_serials đúng count.
- Roundtrip: count IN_STOCK == sum(qty_on_hand) trước & sau migration.

### 9.6 Concurrent order test

- 5 client cùng checkout cùng variant chỉ còn 3 serial → 3 thành công, 2 fail với code `STOCK_INSUFFICIENT`.
- Reservation TTL 15 phút expired → background job giải phóng → client khác đặt được.

---

## 10. Final Recommendation

### Có nên bỏ hoàn toàn nhập tay số lượng không?

**Có, nhưng KHÔNG ngay lập tức.** Hệ thống hiện tại không sẵn sàng. Nếu bật serial-only mà không fix các P0 bên dưới, kho sẽ:

- Hiển thị 0 cho tất cả product/variant chưa có serial (toàn bộ catalog hiện tại).
- Bán hàng sẽ failed validation hoặc cho phép bán âm tuỳ implementation.
- Tracker sẽ mất đồng bộ với reality vì các luồng cancel/refund/return không update serial.

### Điều kiện để bỏ an toàn (DoD)

1. ✅ Mọi product/variant đang có `quantity_on_hand > 0` đều có đủ `product_serials` IN_STOCK tương ứng.
2. ✅ Mọi luồng bán (checkout, quick-buy, POS) reserve và mark sold serial atomically.
3. ✅ Mọi luồng cancel/refund/return update lifecycle serial đúng state machine.
4. ✅ Order detail và Return detail có thể hiển thị serial cụ thể đã bán/trả.
5. ✅ Warranty module gắn 1-1 với serial.
6. ✅ Admin UI có screen riêng quản lý serial cross-product.
7. ✅ Permission `inventory.serial.*` được tách riêng và assign theo role.
8. ✅ Audit log đầy đủ: mọi transition có actor, before/after, reason (DAMAGED/SCRAPPED bắt buộc).
9. ✅ Background job giải phóng RESERVED serial expired.
10. ✅ Test plan ở Section 9 pass.

### Các P0 phải fix trước khi chuyển mô hình (priority order)

| # | Item | File | Effort |
|---|------|------|--------|
| **P0-1** | Build `SerialLifecycleService` mới (reserve / markSold / release / receiveReturn / scrap) | NEW | 3-5 ngày |
| **P0-2** | Refactor `CheckoutService.decrementVariantStock` & `decrementStockForCartItems` → reserve serial thay vì decrement qty | [CheckoutService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java):875-912 | 2-3 ngày |
| **P0-3** | Refactor `PosOrderService.decrementStock` tương tự | [PosOrderService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java):432-460 | 1-2 ngày |
| **P0-4** | Refactor `OrderStockRestoreService.doRestore` → release/restore serial | [OrderStockRestoreService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/OrderStockRestoreService.java):55-106 | 1 ngày |
| **P0-5** | Refactor `AdminReturnService.restoreStockForReturn` → INSPECTION step | [AdminReturnService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminReturnService.java):218-273 | 1-2 ngày |
| **P0-6** | Add `AdminOrderService.markCompleted` → call markSold serial | [AdminOrderService.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java):217-279 | 1 ngày |
| **P0-7** | Build endpoint `POST /admin/inventory/serials/import` (CSV bulk) | NEW | 1 ngày |
| **P0-8** | Stocktake script + data migration: backfill `product_serials` từ `quantity_on_hand` | NEW | 1 ngày |
| **P0-9** | Build Warranty module sơ bộ (record per serial) | NEW | 3-5 ngày |
| **P0-10** | Background job release expired RESERVED serial | NEW | 0.5 ngày |
| **P0-11** | Bridge tables `order_line_item_serials`, `return_item_serials` (line.qty > 1 hỗ trợ) | NEW migration | 1 ngày |
| **P0-12** | DROP / DEPRECATE `stock_movement_serials`, `stock_receipt_serials` (sau khi backfill xong) | NEW migration | 0.5 ngày |

**Tổng effort dự kiến: 17-25 ngày dev (3-5 tuần) + 1-2 tuần stocktake vật lý + 1 tuần regression test.**

### P1 follow-up (sau khi P0 xong)

- UI screen "Quản lý serial" cross-product.
- Permission tách riêng `inventory.serial.*`.
- Export CSV/Excel theo trạng thái serial.
- Aging report.
- Mobile app (warranty lookup by serial cho khách).

---

## Additional Findings (ngoài 20 vấn đề ban đầu)

### A1. `ProductSerialEntity.orderLineItemId` UNIQUE → không hỗ trợ qty > 1 mỗi line

[V89](bigbike-backend/src/main/resources/db/migration/V89__add_product_serial_lifecycle.sql) line 64-66:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_ps_order_line
    ON product_serials (order_line_item_id)
    WHERE order_line_item_id IS NOT NULL;
```

Nhưng OrderLineItem có `quantity` field. Nếu khách mua 2 cùng variant trong 1 line → không thể link 2 serial vào cùng `orderLineItemId` (vi phạm unique). Hiện tại code không sử dụng field này nên chưa nổ lỗi, nhưng khi rewrite checkout sẽ vướng.

**Fix:** thay bằng bridge table `order_line_item_serials(serial_id PK, order_line_item_id, qty=1)` — Section 5.4.

### A2. State machine RESERVED không đi DAMAGED được

[AdminSerialService.java:276-300](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSerialService.java#L276-L300):

```java
case RESERVED   -> to == ProductSerialStatus.IN_STOCK
                || to == ProductSerialStatus.SOLD;
```

Nếu serial đang RESERVED (trong giỏ hàng) mà admin phát hiện hỏng → phải force về IN_STOCK trước rồi mới DAMAGED → 2-step không cần thiết, mất audit.

**Fix:** thêm `RESERVED → DAMAGED` (release reservation đồng thời).

### A3. State machine RETURNED → INSPECTION nhưng AdminReturnService bypass

State machine ở enum và `validateTransition` đã thiết kế: `RETURNED → INSPECTION`. Nhưng `AdminReturnService.restoreStockForReturn` (line 218-273) cộng thẳng qty vào IN_STOCK mà không qua bước này → mâu thuẫn giữa thiết kế domain và implementation.

### A4. `StockMovementEntity.variant` nullable nhưng code chưa luôn check

[V82](bigbike-backend/src/main/resources/db/migration/V82__relax_stock_movement_variant_nullable.sql) đã relax NOT NULL cho stock_movements.product_variant_id để hỗ trợ product-level no-variant. Nhưng [StockMovementJpaRepository.findByVariantIdOrderByCreatedAtDesc](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/catalog/StockMovementJpaRepository.java) (UI dùng) chỉ filter theo variantId — movements của product-level no-variant **không hiện** trong UI per-variant.

### A5. `AdminInventoryService.adjustProductStock` không hỗ trợ serial dù product có thể trackSerials

Line 315 (file `AdminInventoryService.java`):
```java
// Serials not supported for product-level non-tracking adjustments.
```

Nhưng nếu product có trackSerials → block (đúng). Nếu không trackSerials → cho nhập qty (đúng). Vấn đề: không có path "product-level + serial-aware adjustment" — toàn bộ phải qua `addToProduct`. Điều đó OK nhưng cần document rõ trong API contract.

### A6. Duplicate identifier check trong `AdminSerialService.validateEntries` chỉ check chassis + engine riêng

Line 230-274. Nếu một admin nhập 2 dòng: dòng 1 chassis="A1" engine="E1", dòng 2 chassis="A1" engine="E2" → `seenChassis.add("A1")` báo dup. OK. Nhưng cross-table với `stock_movement_serials.serial_number = "A1"` (đã được nhập qua adjustStock cũ) → không kiểm tra → có thể conflict sau migration.

### A7. `StockMovement.note` không bắt buộc cho ADJUSTMENT/SCRAPPED

[AdminInventoryService.adjustStock](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminInventoryService.java) line 256: `movement.setNote(req.note())` — note là optional. Best practice: ADJUSTMENT/SCRAP phải có lý do.

### A8. CheckoutService quick-buy có "force-out-of-stock" check nhưng cart checkout không check force-out-of-stock cho variant

Line 327-336 quickBuy có nhánh check `Boolean.TRUE.equals(product.getForceOutOfStock())`. Line 822-869 cart checkout có check tương tự cho product không variant nhưng KHÔNG check force-out-of-stock cho variant. Bug nhỏ nhưng liên quan tồn kho.

### A9. Missing serial fixed test setup in integration tests

(Verify từ Section 9): Tests hiện chưa có cho serial-only. Phải build test infrastructure mới.

### A10. Audit log không có resourceId cho SERIAL

[AdminSerialService.persistSerials](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSerialService.java) line 222-225 ghi `auditLog.afterData = "{count, productId, variantId}"` nhưng `resourceId` không được set (entity has setResourceId nhưng method không gọi). Khó truy ngược audit theo serialId.

---

## Build / test status

Không chạy build/test ở bước audit này (theo yêu cầu "không sửa code"). Việc build/test xác minh sẽ thực hiện ở giai đoạn implement P0.

---

## File generated

- **Path:** `docs/audits/SERIAL_ONLY_INVENTORY_VERIFICATION.md`
- **Verdict:** NOT_READY (BLOCKED)
- **Auditor:** Senior Backend Engineer + System Auditor
- **Date:** 2026-05-10
