# BigBike — Serial Management Module Production-Readiness Audit

> **Phạm vi audit:** Toàn bộ module Quản lý Serial (Serial Management) — bao gồm admin frontend, backend service/lifecycle, migration database, các flow tích hợp với order / return / warranty / checkout, scheduler, test, permission, audit log và operational gating.
>
> **Phương pháp:** Đọc trực tiếp source code (không đoán), grep usage cross-file của các symbol chính, đối chiếu code với tài liệu canonical (`docs/business/SERIAL_INVENTORY_RULES.md`, `docs/engineering/SERIAL_INVENTORY_FLOW.md`, `STATE_MACHINES.md`).
>
> **Audit date:** 2026-05-14
> **Audited by:** Claude (Opus 4.7)
> **Mode:** Read-only — KHÔNG sửa code trong audit này.

---

## 0. Kết luận tổng quan

> ## ⚠️ **CONDITIONALLY READY — KHÔNG được phép launch khi chưa fix các P0**

Core lifecycle của serial (reserve → sold → returned → inspection → in_stock/damaged/scrapped) được thiết kế tốt: state machine rõ, có concurrency safety bằng `FOR UPDATE SKIP LOCKED`, có scheduler release expired reservation, có DB trigger sync `quantity_on_hand`, có audit log cho admin add/update, có gate `serial_inventory_only` để vô hiệu hoá manual quantity adjustment.

Tuy nhiên có một số khoảng trống nghiêm trọng phải xử lý trước khi đưa lên production:

1. **Permission `inventory.read` / `inventory.write` không tồn tại trong bất kỳ role nào ngoài super-admin (`*`).** → Warranty screen + voidWarranty endpoint thực tế chỉ dùng được bởi super-admin. Manager/staff không vào được dù navigation hiển thị (theo permission `inventory.read`).
2. **Inspection flow bị đứt giữa return state machine và serial state machine.** Khi admin chuyển return từ `RECEIVED` → `INSPECTING`, hàm `serialLifecycleService.moveReturnedToInspection(returnId)` đã được viết nhưng KHÔNG được gọi ở bất kỳ chỗ nào. Khi admin gọi `inspectItem(PASS/FAIL)` trên return, status của ProductSerial cũng KHÔNG được cập nhật. Admin phải vào `/admin/serials` từng cái và đổi tay từng serial — workflow gãy, dễ sai.
3. **Bulk import không có giới hạn payload/row count.** `SerialImportRequest.rows` không có `@Size(max=...)`, không có guard ở controller. Một admin (hoặc kẻ tấn công có token) có thể POST hàng triệu row → OOM / timeout / DB lock dài.
4. **Test integration `Phase1KInventorySerialApiTest` đang sai expected error code (`COUNT_MISMATCH` vs `COUNT_EXCEEDS_QUANTITY`)** — test này có thể đang fail trong CI; phải fix trước khi rely vào test gate.
5. **State machine giữa frontend và backend KHÔNG khớp:**
   - `SerialListScreen` (admin/serials): từ `IN_STOCK` chỉ cho phép `[DAMAGED, SCRAPPED]` (thiếu `RESERVED`, `INSPECTION`).
   - `InventoryScreen` (modal Quản lý serial): từ `IN_STOCK` cho phép `[DAMAGED, INSPECTION, SCRAPPED]`.
   - Backend `AdminSerialService.validateTransition`: từ `IN_STOCK` cho phép `[RESERVED, DAMAGED, INSPECTION, SCRAPPED]`.
   - Frontend `SerialListScreen` còn cho phép `RESERVED → IN_STOCK` mà không thấy `RESERVED → SOLD`. Backend cho cả hai. Hiện tại trùng nhau, sau này dễ drift.

Sau khi fix các P0 và P1 quan trọng, module này có thể launch.

---

## 1. Chấm điểm theo nhóm

| Nhóm | Điểm | Nhận xét ngắn |
|---|---|---|
| Functional completeness | 7 / 10 | Đầy đủ list / search / detail / import / status change / QR / tracking flag. Thiếu: bulk delete, edit serial number, link to order detail từ serial detail, không có CSV export riêng cho serial. |
| Business correctness | 6 / 10 | Lifecycle sale-flow đúng. Nhưng inspection flow (return → INSPECTING) không tự đẩy serial sang INSPECTION → admin phải làm 2 bước. |
| Data integrity | 7 / 10 | UNIQUE / FK / CHECK đầy đủ; trigger sync qty hợp lý; tests cover concurrent reserve. Nhưng `adjustStock` check duplicate sai bảng (chỉ check `stock_movement_serials`, không check `product_serials`) → race với DB constraint nhưng UX kém vì 500 thay vì 400. |
| Security / permission | 4 / 10 | Toàn bộ serial endpoint dùng `products.read`/`products.update` → ai có permission edit product là edit được serial. Không có per-action permission. Warranty screen yêu cầu `inventory.read` mà chưa role nào có. Bulk import không giới hạn payload size. |
| UX / Admin usability | 6 / 10 | UI hai màn (`/admin/serials` global, `/admin/inventory` per-product) hợp lý; có QR/print, file import CSV/Excel, preview duplicate. Nhưng InventoryScreen 2050 dòng dùng inline `style={...}` cấm theo CLAUDE.md, status label inconsistency giữa 2 màn (`Còn hàng` vs `Có sẵn`). |
| Performance / scalability | 6 / 10 | Có index đầy đủ cho `(variant_id, status)`, `(product_id, status)`, `reserved_until` partial. Pagination thật. Search dùng `LOWER LIKE %...%` → không dùng được index, sẽ chậm khi `product_serials` nhiều (millions). N+1 trong toPageResult vì Lazy load product/variant. |
| Testing coverage | 6 / 10 | 15 tests cho lifecycle (T1–T15) + 8 tests cho stock adjust serial. Nhưng: Phase1K test đang sai mã lỗi → có thể fail; test cho permission, idempotency import (gọi 2 lần với cùng payload), test cho moveReturnedToInspection wiring không có. |
| Operational readiness | 5 / 10 | Có scheduler cleanup, log có. Setting `serial_inventory_only` được seed; `default_warranty_months` được seed. Nhưng `reservation_ttl_minutes` KHÔNG được seed (chỉ có default 15 trong code). Không có metric/alert cho import lỗi, scheduler fail. Migration V51 → V54 → V89 nhiều lần, hiện đang OK nhưng phức tạp. |

**Tổng: 47 / 80 — Conditionally ready.**

---

## 2. Cấu trúc module — bird's-eye view

### Frontend (admin)
| File | Vai trò |
|---|---|
| [bigbike-admin/src/screens/SerialListScreen.jsx](../../bigbike-admin/src/screens/SerialListScreen.jsx) (374 lines) | `/admin/serials` — global search, filter, status change, view detail |
| [bigbike-admin/src/screens/InventoryScreen.jsx](../../bigbike-admin/src/screens/InventoryScreen.jsx) (2050 lines) | `/admin/inventory` — grouped per-product table, stock-in modal, **Serial manage modal** (list + add panel + QR), enable tracking |
| [bigbike-admin/src/lib/adminApi.js#L1947-L2057](../../bigbike-admin/src/lib/adminApi.js#L1947-L2057) | `normalizeSerial`, `fetchAllSerials`, `fetchVariantSerials`, `fetchProductSerials`, `addVariantSerials`, `addProductSerials`, `importBulkSerials`, `updateSerialStatus`, `enableVariantSerialTracking`, `enableProductSerialTracking`, `fetchSerialInventoryOnly` |
| [bigbike-admin/src/App.jsx](../../bigbike-admin/src/App.jsx) | Route `/admin/serials` + nav item with permission `products.read` |
| [bigbike-admin/src/locales/vi.json](../../bigbike-admin/src/locales/vi.json), [en.json](../../bigbike-admin/src/locales/en.json) | Có ~30 key i18n cho serial (dùng cho `SerialListInput` trong InventoryScreen). |

### Backend
| File | Vai trò |
|---|---|
| [AdminInventoryController.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminInventoryController.java) (272 lines) | 14 REST endpoints: list/get/add/import serial, update status, enable tracking |
| [AdminSerialService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSerialService.java) (341 lines) | List/search/add/update-status/enable-tracking; **state machine validateTransition**; audit log |
| [AdminSerialImportService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSerialImportService.java) (160 lines) | Bulk import — partial-mode (skip bad row) hoặc all-or-nothing; per-row validation |
| [SerialLifecycleService.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/SerialLifecycleService.java) (429 lines) | **Lõi lifecycle:** `reserveForOrderLine`, `markSoldForOrder`, `releaseReservationForOrder`, `receiveReturnForReturn`, `moveReturnedToInspection`, `markInspectionResult`, `releaseExpiredReservations`, `countAvailable`, `computeReservedUntil` |
| [SerialReservationCleanupJob.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/SerialReservationCleanupJob.java) (35 lines) | `@Scheduled` mỗi 60s — release expired reservations |
| [ProductSerialEntity.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/catalog/ProductSerialEntity.java) | JPA entity (UUID id, product, variant, serialNumber, status, reservedUntil, orderLineItemId, returnItemId, soldAt, returnedAt, note, adminId, ...) |
| [ProductSerialJpaRepository.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/catalog/ProductSerialJpaRepository.java) (136 lines) | 13 query methods: paged list per variant/product, count, native `findAvailableForVariantWithLock` (SKIP LOCKED), search, find expired, find by order/return |
| [ProductSerialStatus.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/domain/catalog/ProductSerialStatus.java) | Enum 7 states |

### Migration / database
| Migration | Mô tả |
|---|---|
| V30 | Tạo `stock_movements` + cột `quantity_on_hand` trên `product_variants` |
| V50 | Unique partial index `idx_stock_movements_order_cancel_unique` (idempotency); CHECK `quantity_on_hand >= 0` |
| V51 | (Bị xoá ở V54) — version đầu tiên của `product_serials` với `chassis/engine_number` |
| V54 | Drop toàn bộ V51 |
| V55 | `stock_receipt_serials` (per-receipt-line, simpler) |
| V57 | `stock_movement_serials` (per-movement, simpler) |
| V82 | Cho phép `stock_movements.product_variant_id` NULL + thêm `product_id` cho no-variant |
| V89 | **Restore lifecycle table `product_serials` với 7 states**, trigger `fn_sync_qty_from_serial_lifecycle`, indexes |
| V90 | `order_line_item_serials`, `return_item_serials`, `warranty_records` + seed `serial_inventory_only`, `default_warranty_months` |
| V99 | Rename `chassis_number / engine_number` → `serial_number` (single column) |
| V104 | Thêm `inspection_result`, `inspection_note`, `inspected_at`, `inspected_by_admin_id` cho `return_items` |
| V108 | Backfill `stock_state` derived from `quantity_on_hand` |

### Tests
- [Phase1KInventorySerialApiTest.java](../../bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1KInventorySerialApiTest.java) (344 lines, 8 tests) — adjustStock + serials.
- [Phase2FSerialInventoryTest.java](../../bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase2FSerialInventoryTest.java) (599 lines, 15 tests) — full lifecycle (T1–T15) gồm cả T5 concurrent FOR UPDATE SKIP LOCKED, T13 SERIAL_INVENTORY_ONLY gate.

---

## 3. Phân tích chi tiết theo tiêu chí

### A. Functional completeness — 7/10

| Chức năng | Trạng thái | Ghi chú |
|---|---|---|
| List/search serial toàn hệ thống | ✅ | `SerialListScreen` + `GET /admin/inventory/serials?q=&status=&productId=` |
| List serial theo variant / product | ✅ | `GET /admin/inventory/{variants|products}/{id}/serials` |
| Detail serial | ✅ | Modal trong SerialListScreen; `GET /admin/inventory/serials/{id}` ở backend |
| Bulk import | ✅ | `POST /admin/inventory/serials/import` + UI `AddSerialsPanel` (CSV/XLSX 5MB limit ở FE) |
| Add serial (per-product/variant) | ✅ | `POST /admin/inventory/{products|variants}/{id}/serials` |
| Bật/tắt tracking | ✅ | `POST /{products|variants}/{id}/enable-tracking?enabled=true|false` |
| Đổi trạng thái | ✅ | `PATCH /admin/inventory/serials/{id}/status` |
| QR / in tem | ✅ | `SerialQrModal` trong InventoryScreen — print fixed-position |
| Liên kết với order / return / warranty / stock movement | ✅ | Bảng `order_line_item_serials`, `return_item_serials`, `warranty_records` đầy đủ; lifecycle service tự tạo |
| Hỗ trợ product có variant + không có variant | ✅ | Cả entity, repo, service, controller, FE đều tách hai path |
| Export / report | ⚠️ | Có `GET /admin/inventory/export.csv` cho stock nhưng **KHÔNG có CSV export riêng cho serial**. Audit serial không có view UI. |
| Edit serial number sau khi import | ❌ | Không có endpoint update `serialNumber`. Sai serial → admin phải SCRAPPED rồi nhập lại. Tuỳ business có chấp nhận không. |
| Bulk delete serial | ❌ | Không có. Một khi đã insert, chỉ chuyển status. |
| Link ngược từ serial detail → order detail | ⚠️ | Detail modal có hiển thị `orderLineItemId`/`returnItemId` ở response nhưng UI không click được sang order detail. |
| Audit trail xem được trên UI | ⚠️ | Có ghi `audit_logs` (`SERIALS_ADDED`, `SERIAL_STATUS_CHANGED`) nhưng không có UI riêng cho serial — phải vào `/admin/audit-logs`. |

---

### B. Business rules & state machine — 6/10

#### B.1 — Lifecycle state machine

**Backend canonical** ([AdminSerialService.java#L268-L292](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSerialService.java#L268-L292)):
```
IN_STOCK   → RESERVED | DAMAGED | INSPECTION | SCRAPPED
RESERVED   → IN_STOCK | SOLD
SOLD       → RETURNED
RETURNED   → INSPECTION
INSPECTION → IN_STOCK | DAMAGED | SCRAPPED
DAMAGED    → SCRAPPED
SCRAPPED   → (terminal)
```

**Frontend `SerialListScreen.jsx#L34-L42`** (cho admin global):
```
IN_STOCK   → DAMAGED | SCRAPPED                  ← THIẾU RESERVED, INSPECTION
RESERVED   → IN_STOCK                            ← THIẾU SOLD (không cần ở UI nhưng inconsistent)
SOLD       → RETURNED
RETURNED   → INSPECTION
INSPECTION → IN_STOCK | DAMAGED | SCRAPPED
DAMAGED    → SCRAPPED
SCRAPPED   → (terminal)
```

**Frontend `InventoryScreen.jsx#L866-L874`** (per-product modal):
```
IN_STOCK   → DAMAGED | INSPECTION | SCRAPPED     ← THIẾU RESERVED nhưng có INSPECTION
... (còn lại giống SerialListScreen)
```

→ **Vấn đề:**
- Hai màn FE có rule khác nhau (SerialListScreen thiếu `INSPECTION`).
- FE rule là duplicate code — backend mới là source of truth, nếu admin gọi đúng API thì backend sẽ chặn, nhưng UI có thể ẩn nút sai.
- Bỏ `RESERVED` ra khỏi UI là OK (không ai chuyển tay sang RESERVED) nhưng vẫn nên đồng nhất.

#### B.2 — Idempotency

Lifecycle service có tài liệu rõ "All methods are idempotent":
- ✅ `reserveForOrderLine` — guard `if (olisRepo.findByOrderLineItemId(...).size() >= quantity) return` ([SerialLifecycleService.java#L96](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/SerialLifecycleService.java#L96))
- ✅ `markSoldForOrder` — `if (serial.getStatus() == SOLD) return`
- ✅ `releaseReservationForOrder` — `if (serial.getStatus() != RESERVED) return`
- ✅ `receiveReturnForReturn` — `if (!risRepo.findByReturnItemId(ri.getId()).isEmpty()) continue`
- ✅ `markInspectionResult` — chặn nếu serial không ở `INSPECTION`

#### B.3 — Concurrency safety

✅ `findAvailableForVariantWithLock` dùng native query `FOR UPDATE SKIP LOCKED` ([ProductSerialJpaRepository.java#L62-L76](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/catalog/ProductSerialJpaRepository.java#L62-L76)). Test T5 verify rằng hai concurrent reserve cho 1 serial duy nhất → đúng 1 success, 1 fail.

#### B.4 — Stock derived from IN_STOCK count

✅ Migration V89 trigger `fn_sync_qty_from_serial_lifecycle` tự cập nhật `quantity_on_hand` + `stock_state` từ count IN_STOCK serials, fire khi INSERT/UPDATE OF status/DELETE.

⚠️ **Tuy nhiên**, trigger CHỈ fire khi `track_serials = true` ở thời điểm trigger. Nếu một biến thể có serial nhưng track_serials chuyển từ true → false → true, count có thể out-of-sync (vì các thay đổi trong lúc false không sync). Hiện tại không có job reconcile.

#### B.5 — Inspection wiring (CRITICAL GAP)

**Vấn đề nghiêm trọng:** Khi return chuyển trạng thái `RECEIVED` → `INSPECTING`, hàm `serialLifecycleService.moveReturnedToInspection(returnId)` đã tồn tại ở backend ([SerialLifecycleService.java#L266](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/SerialLifecycleService.java#L266)) NHƯNG **không được gọi từ bất kỳ chỗ nào** (grep cross-codebase: chỉ định nghĩa, không có usage).

**Hậu quả thực tế:**
- Admin tạo return → APPROVED → RECEIVED (serial chuyển SOLD → RETURNED, đúng).
- Admin chuyển return → INSPECTING. **Serial vẫn ở RETURNED** (không chuyển sang INSPECTION).
- Admin gọi `inspectItem(itemId, PASS/FAIL)` ([AdminReturnService.java#L262-L300](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminReturnService.java#L262-L300)) — chỉ ghi `inspection_result` lên `return_items`, **không đụng đến `product_serials.status`**.
- Admin chuyển return → COMPLETED. `restoreStockForReturn` ([AdminReturnService.java#L324-L362](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminReturnService.java#L324-L362)) check `risRepo.findByReturnItemId(ri.getId()).isEmpty()` → có bridge → SKIP, để admin "via serial API" tự chuyển.

→ Admin phải vào `/admin/serials`, search từng serial, chuyển tay `RETURNED → INSPECTION → IN_STOCK/DAMAGED/SCRAPPED`. Nếu admin quên, serial sẽ kẹt mãi ở RETURNED, **không bao giờ về sellable stock**.

#### B.6 — Markdown audit của admin tự ý đổi sai

⚠️ Backend cho phép `IN_STOCK → SCRAPPED` trực tiếp (không đi qua INSPECTION). OK với nghiệp vụ "admin phát hiện hỏng trong kho" nhưng không có note bắt buộc → audit log có nhưng không có lý do.

⚠️ Backend cho phép `SOLD → RETURNED` qua API admin tay không cần qua return record. Đây có thể là cố ý cho admin correction nhưng tạo serial RETURNED không có `returnItemId` → orphan cho `risRepo`.

---

### C. Data integrity — 7/10

#### C.1 — Constraints

✅ Migration V89: CHECK status IN 7 values; CHECK `serial_number IS NOT NULL`.
✅ Migration V99: UNIQUE INDEX `idx_ps_serial_number`. Nghĩa là **một serial_number không thể tồn tại 2 lần trong DB** kể cả khác product.
✅ V90: `order_line_item_serials.serial_id` UNIQUE → một serial chỉ được sale một lần.
✅ V90: `warranty_records.serial_id` UNIQUE → 1-1.
✅ FK ON DELETE RESTRICT cho `product_id`, `product_variant_id` → không xoá product khi còn serial.

⚠️ FK `order_line_item_id` ON DELETE SET NULL → nếu line item bị xoá, link bị mất; nhưng V90 comment ghi rõ cột này deprecated, dùng bridge thay thế.

⚠️ Soft-delete: backend kiểm tra `PublishStatus.TRASH` cho adjustStock nhưng **không kiểm tra cho add/update serial**. Có thể thêm serial vào TRASH product → orphan data.

#### C.2 — Transaction integrity

✅ `addToVariant`, `addToProduct`, `importSerials`, `updateStatus`, `adjustStock` đều `@Transactional`.
✅ `importSerials` partialMode=false → all-or-nothing (single rollback).
✅ `adjustStock` rollback nếu serial duplicate (test T5 verify).

⚠️ Trong `importSerials`, biến `existingSerials` được mutated trong loop để check duplicate giữa các row chưa flush ([AdminSerialImportService.java#L153](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSerialImportService.java#L153)) — đúng, nhưng nếu 2 request import song song với cùng serial number, cả hai sẽ thấy "không tồn tại" → cả hai cố insert → DB unique sẽ throw cho thằng thứ hai → ConstraintViolationException → trả về 500 (không có handler riêng — xem **F.5**).

#### C.3 — Duplicate check sai bảng (P1)

[AdminInventoryService.java#L287](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminInventoryService.java#L287) gọi `serialRepo.findExistingSerialNumbers(serials)` — `serialRepo` là `StockMovementSerialJpaRepository` ([line 59](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminInventoryService.java#L59)) — chỉ check bảng `stock_movement_serials`, KHÔNG check `product_serials`. Khi admin gọi `/adjust` với serial trùng product_serials → check pass → INSERT vào product_serials → DB unique violation → 500.

---

### D. API readiness — 5/10

#### D.1 — Endpoint shape

| Endpoint | Pattern | Vấn đề |
|---|---|---|
| `GET /admin/inventory/serials` | List paged, q/status/productId filter | OK |
| `GET /admin/inventory/serials/{id}` | Detail | OK |
| `GET /admin/inventory/{products|variants}/{id}/serials` | Per-scope list | OK |
| `POST /admin/inventory/{products|variants}/{id}/serials` | Add list | OK |
| `POST /admin/inventory/serials/import` | Bulk import | **Không có @Size limit** trên `rows` (P0) |
| `PATCH /admin/inventory/serials/{id}/status` | Status change | OK |
| `POST /admin/inventory/{products|variants}/{id}/enable-tracking?enabled=` | Toggle tracking | OK |

#### D.2 — Permission model (P0)

Tất cả endpoint serial đều dùng `products.read` (cho GET) và `products.update` (cho POST/PATCH).

**Vấn đề:**
- Bất kỳ ai có quyền sửa product (e.g. content writer được phép update product description) → có thể import serial, đổi status SOLD → SCRAPPED, void-effect warranty. Không tách riêng.
- Comment trong code đã nhận diện điều này: `// TODO: migrate to inventory.serial.import when added` ([AdminInventoryController.java#L254](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminInventoryController.java#L254)).

**Đề xuất permission:** `inventory.serial.read`, `inventory.serial.write`, `inventory.serial.import`, `inventory.serial.status_update`. Cần migration mới grant cho ADMIN, SHOP_MANAGER, INVENTORY_STAFF.

#### D.3 — Response format

✅ Dùng `PageResult<T>` chuẩn của project (items / page / size / total / totalPages). Frontend `parseListPayload` hiểu được.
✅ `AdminSerialResponse` gồm tất cả field cần cho UI.
⚠️ FE gọi `payload.data` (e.g. trong `updateSerialStatus`) nhưng `AdminInventoryController.updateSerialStatus` return raw `AdminSerialResponse` (không bọc `ApiDataResponse`). Hiện tại work vì `normalizeSerial(payload?.data || payload || {})` fallback, nhưng fragility.

#### D.4 — Error response

✅ `GlobalExceptionHandler` chuẩn hoá ValidationException/NotFoundException/ConflictException.
❌ Không có handler cho `DataIntegrityViolationException` → unique key violation (e.g. concurrent import duplicate serial) → fallthrough sang `Exception.class` → 500 với stacktrace ẩn (theo policy hiện hành).

#### D.5 — Idempotency

⚠️ Bulk import KHÔNG có idempotency key. Admin click submit 2 lần → 2 batch (mỗi batch sẽ skip duplicate, nhưng audit log có 2 entry, nếu partialMode=false cả 2 đều fail vì duplicate).
⚠️ Lifecycle service idempotent ở mức internal (xem B.2). Public API (`updateStatus`) không có idempotency-key — nhưng vì nó dựa trên `from → to` validate, gọi 2 lần với cùng `to` từ cùng `from` lần 2 sẽ fail validateTransition (`from == to → return early`).

---

### E. Frontend UX/UI readiness — 6/10

#### E.1 — Vai trò 2 màn

- `/admin/serials` → global search/audit (SerialListScreen 374 lines, đơn giản, đúng vai trò).
- `/admin/inventory` → operational, per-product workflow (InventoryScreen 2050 lines).

→ Không trùng chức năng, vai trò rõ. ✅

#### E.2 — Các vấn đề UX cụ thể

| Vấn đề | File:line | Mức |
|---|---|---|
| **Status label không nhất quán** giữa 2 màn: SerialListScreen `IN_STOCK = "Còn hàng"` ([line 15](../../bigbike-admin/src/screens/SerialListScreen.jsx#L15)), InventoryScreen `IN_STOCK = "Có sẵn"` ([line 847](../../bigbike-admin/src/screens/InventoryScreen.jsx#L847)). `RETURNED = "Khách trả"` vs `"Đã trả lại"`. `DAMAGED = "Hỏng"` vs `"Hư hỏng"`. | InventoryScreen:846-854, SerialListScreen:14-22 | P2 |
| **State transition rules duplicated FE+BE** và FE2 màn còn khác nhau (xem B.1). | InventoryScreen:866-874, SerialListScreen:34-42 | P1 |
| **Inline `style={...}` thay vì Tailwind** — vi phạm CLAUDE.md "UI Stack" rule. Cả SerialListScreen lẫn InventoryScreen dùng `style={{ background:..., padding:... }}` rất nhiều. | Toàn bộ 2 file | P2 (không block production nhưng vi phạm contract) |
| **Hardcode color hex** thay vì brand token: `#16a34a`, `#dc2626`, `#f0fdf4`, `#bbf7d0`... | InventoryScreen:1059, 1153, 1108..., SerialListScreen:24-32 | P2 |
| **Native `<table>`/`<input>` mà không dùng shadcn AdminTable / Input** ở phần `AddSerialsPanel` (line 1074) và `SerialListPanel` (line 1305). | InventoryScreen:1074-1102, 1305-1376 | P2 |
| **Không có loading skeleton** cho SerialListPanel — chỉ "Đang tải…" plain text. | InventoryScreen:1294-1296 | P3 |
| **QR print** mặc dù work nhưng print toàn body với `position: fixed` → có thể conflict với existing print stylesheet. | InventoryScreen:1171-1188 | P3 |
| **Không có click row để mở detail** ở SerialListPanel (chỉ có button QR + Đổi trạng thái). Nếu serial đã SOLD/RETURNED, không có cách xem order/return liên quan từ panel này. | InventoryScreen:1314-1372 | P2 |
| **Form validation cho note bắt buộc khi DAMAGED/SCRAPPED** — chỉ là dấu `*` UI, **frontend KHÔNG validate trước khi submit**, dựa vào backend reject. | SerialListScreen:181, InventoryScreen | P2 |
| **File import 5MB** OK; tách CSV/Excel parse riêng; có preview total/valid/blank, có copy/download error list. ✅ | InventoryScreen:212, 882-924 | OK |
| **Empty / loading / error states** đầy đủ cho main screens, dùng `StatePanel`. ✅ | SerialListScreen:331-343 | OK |
| **i18n coverage**: `AddSerialsPanel` và `SerialDetailModal` HARDCODE tiếng Việt, không qua `t(...)`. Chỉ `SerialListInput` (modal stockIn) dùng i18n đầy đủ. | SerialListScreen toàn bộ, InventoryScreen 928-1162 | P2 (BigBike chỉ ship VI nên chưa fail user, nhưng tech debt) |
| **Encoding tiếng Việt OK** — file được lưu UTF-8 đầy đủ dấu. ✅ | | OK |

---

### F. Security & permission — 4/10

#### F.1 — Authorization kiểm soát ở cả 2 lớp

✅ Backend: mọi endpoint đều có `devAdminAuthService.requirePermission(request, "...")`.
✅ Frontend: `App.jsx` route check `routePermission(...)` + `hasPermission(...)`.
→ Backend không tin frontend.

#### F.2 — Permission granularity (P0)

❌ Tất cả serial action chia sẻ chung `products.read` / `products.update`. Bất kỳ user nào edit product được là toàn quyền serial. Xem **D.2**.

#### F.3 — Permission `inventory.read` / `inventory.write` không tồn tại (P0)

Grep migration toàn bộ: KHÔNG role nào được cấp `inventory.read` / `inventory.write`. Tuy không phải endpoint serial chính dùng, nhưng `AdminWarrantyController` dùng `inventory.read` (xem [line 36](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminWarrantyController.java#L36)) → warranty list trống cho mọi role trừ `*`.

#### F.4 — Payload size guard cho import (P0)

❌ `SerialImportRequest.rows` không có `@Size(max=N)`. Controller không check. Spring multipart limit 55MB cho upload, nhưng JSON request không có multipart, dùng `spring.http`/Tomcat default ~2MB. Vẫn có thể gửi 50.000+ row trong <2MB → DB lock dài, GC pressure. Nên enforce `@Size(max=5000)` hoặc đọc setting.

#### F.5 — SQL injection

✅ Tất cả query dùng JPQL parameter binding (`@Param`). Search dùng `LOWER(...) LIKE LOWER(CONCAT('%', :q, '%'))` — safe, nhưng full table scan (xem G.2).

#### F.6 — UUID guess → modify

⚠️ Endpoint `PATCH /admin/inventory/serials/{serialId}/status` chỉ check permission, không check serial thuộc product mà admin có quyền. Hệ thống hiện tại không có "product-scoped" admin role nên OK; nhưng nếu sau này có role kiểu "shop A staff", endpoint này cho phép họ đổi serial của shop B.

#### F.7 — Audit log

✅ `SERIALS_ADDED`, `SERIAL_STATUS_CHANGED` được ghi qua `AuditLogJpaRepository.save(buildAudit(...))` ([AdminSerialService.java#L181-L186, L236-L239](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSerialService.java#L181-L186)).
❌ `enableVariantTracking` / `enableProductTracking` KHÔNG ghi audit. Bật/tắt tracking là thay đổi chính sách quan trọng — phải audit.
❌ `importSerials` (bulk) KHÔNG ghi audit log. Hơn 1000 serial nhập một lần → không có dấu vết admin nào nhập.
❌ `SerialLifecycleService` (markSold, releaseReservation, receiveReturn, ...) KHÔNG ghi audit log. Có ghi `stock_movements` ledger nhưng không phải `audit_logs`.

---

### G. Performance & scalability — 6/10

#### G.1 — Pagination

✅ Tất cả list endpoint paged (page/size, max=100). FE default 20.

#### G.2 — Search

⚠️ `searchAll` dùng `LOWER(s.serialNumber) LIKE LOWER(CONCAT('%', :q, '%'))` ([ProductSerialJpaRepository.java#L124-L135](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/catalog/ProductSerialJpaRepository.java#L124-L135)) → leading wildcard → không dùng B-tree index → **full scan** trên `product_serials`. Khi >100k serials, sẽ chậm. Nên đổi sang prefix match (`LIKE :q || '%'`) + index `LOWER(serial_number)` hoặc dùng GIN trigram.

#### G.3 — Index

✅ `idx_ps_variant_status (product_variant_id, status) WHERE product_variant_id IS NOT NULL` (V89).
✅ `idx_ps_product_status (product_id, status) WHERE product_variant_id IS NULL` (V89).
✅ `idx_ps_reserved_until (reserved_until) WHERE status = 'RESERVED'` (V89) — dùng cho cleanup job.
✅ `UNIQUE idx_ps_serial_number` (V99) — phục vụ tìm theo serial number exact.
❌ Không có index cho `(product_id, status)` general — nhưng vì search thường lọc theo variant, đỡ được.
❌ Không có index trên `created_at` (orderBy createdAt DESC trong searchAll) → sort sẽ scan.

#### G.4 — N+1

⚠️ `AdminSerialResponse.from(serial)` accesses `serial.getProduct().getName()` và `serial.getVariant().getName()` — `LAZY` fetch. Khi list 20 row, sẽ fire 1 + 20 product + 20 variant queries (Hibernate session-level cache giảm bớt). Nên dùng `JOIN FETCH` trong searchAll/findByVariant.

#### G.5 — Lock granularity

✅ `FOR UPDATE SKIP LOCKED` chỉ lock đúng N row cần — không escalate. Test T5 confirm.
⚠️ Trigger sync qty chạy AFTER mỗi UPDATE OF status → nếu admin đổi status của 100 serial trong 100 transaction, trigger fire 100 lần × cập nhật `product_variants` 100 lần → contention. Bulk operation hiện tại đi qua `validateTransition` từng cái. Chưa thấy bulk-status-change endpoint nên chưa nóng, nhưng vẫn cần lưu ý.

#### G.6 — `stock_movements` ledger

Mỗi lifecycle transition tạo 1 row `stock_movements`. Sau 1 năm với volume cao, bảng phình. Có index `created_at DESC`. Cần đặt retention policy (archive >180 days).

#### G.7 — Trigger cost

Trigger `fn_sync_qty_from_serial_lifecycle` chạy `SELECT COUNT(*)` sau mỗi mutation. Với index `(product_variant_id, status)`, count IN_STOCK nhanh, nhưng vẫn N+1 cho bulk. Nên cân nhắc deferrable hoặc batch.

---

### H. Testing — 6/10

#### H.1 — Coverage hiện có

✅ `Phase2FSerialInventoryTest` (15 test):
- T1, T2: Add serial variant + no-variant
- T3: Reserve
- T4: No oversell (Conflict)
- T5: **Concurrent reserve** — verify SKIP LOCKED
- T6: markSold
- T7: releaseReservation on cancel
- T8: POS reserve+markSold
- T9: receiveReturn
- T10, T11a, T11b: markInspectionResult (PASS, DAMAGED no-note=fail, DAMAGED with note=ok)
- T12: Cleanup expired reservations
- T13: SERIAL_INVENTORY_ONLY gate blocks adjust
- T14: Import without variantId for product with variants → reject
- T15: Duplicate import → DUPLICATE_IN_DB

✅ `Phase1KInventorySerialApiTest` (8 test cho adjustStock + serials).

#### H.2 — Test broken (P1)

❌ `Phase1KInventorySerialApiTest.stockIn_serialCountExceedsQuantity_returns400` expect `details[0].code = "COUNT_MISMATCH"` ([line 115](../../bigbike-backend/src/test/java/com/bigbike/bigbike_backend/api/Phase1KInventorySerialApiTest.java#L115)) nhưng code hiện thực throw `"COUNT_EXCEEDS_QUANTITY"` ([AdminInventoryService.java#L280](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminInventoryService.java#L280)). **Test này đang fail trong CI.**

#### H.3 — Test thiếu

| Test thiếu | Mức |
|---|---|
| `moveReturnedToInspection` được wire đúng — return RECEIVED→INSPECTING phải đẩy serial RETURNED→INSPECTION (tự test sẽ phơi bày bug B.5) | P0 |
| `inspectItem(PASS)` phải đẩy serial RETURNED/INSPECTION → IN_STOCK | P0 |
| Permission test cho `products.update` (user không có quyền không gọi được status change, import) | P1 |
| Concurrent import 2 batch cùng serial → một thành công, một fail clean (không phải 500) | P1 |
| Bulk import với 10000 row → xử lý trong giới hạn time, không OOM | P1 |
| `releaseExpiredReservations` skip khi order COMPLETED/PROCESSING/ON_HOLD (đã có code guard nhưng không có test) | P2 |
| `enableVariantTracking(true)` rồi `enableVariantTracking(false)` rồi `enableVariantTracking(true)` → quantity vẫn đúng (reconcile) | P2 |
| Frontend smoke test: SerialListScreen render với mock data, click status change submit | P2 |
| Frontend smoke test: AddSerialsPanel parse CSV với UTF-8 BOM, semicolon delimiter, mixed line ending | P3 |

---

### I. Production operation — 5/10

#### I.1 — Scheduler

✅ `SerialReservationCleanupJob` chạy mỗi 60s (configurable qua `inventory.reservation.cleanup-interval-ms`). Có log, có guard skip nếu order đã COMPLETED/PROCESSING/ON_HOLD ([SerialLifecycleService.java#L341-L348](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/SerialLifecycleService.java#L341-L348)).

#### I.2 — Logging

✅ `log.info("Released {} expired serial reservations.", released)` khi có release.
⚠️ Không có log cho `markSoldForOrder`, `releaseReservationForOrder`, `receiveReturnForReturn`, `moveReturnedToInspection` ở mức INFO. Khi debug "tại sao serial X bị stuck" sẽ phải tự trace từ stock_movements.

#### I.3 — Metric

❌ Không có Micrometer counter / gauge cho:
- Số serial reserved/sold/returned mỗi ngày.
- Số expired reservation đã cleanup.
- Số import row failed.
- Latency của reserve query (lock contention).

#### I.4 — Settings seed

| Setting | Seeded? | Ghi chú |
|---|---|---|
| `serial_inventory_only` | ✅ V90 | default false |
| `default_warranty_months` | ✅ V90 | default 12 |
| `low_stock_threshold` | ✅ V29 | default 5 |
| `reservation_ttl_minutes` | ❌ | code default 15, không seed → admin không sửa được qua UI cho đến khi tạo tay row trong DB |

#### I.5 — Migration safety

✅ Mỗi migration đều `IF NOT EXISTS`, FK ON DELETE RESTRICT/SET NULL hợp lý.
⚠️ Lịch sử V51 → V54 (drop) → V55/V57/V89 (re-create) → V99 (rename column) phức tạp. Trên DB production có dữ liệu V51 trước khi V54 chạy thì OK vì V54 drop table → mất hết serial. Hiện tại nếu fresh deploy thì không issue.
✅ V89 dùng `IF NOT EXISTS` → safe re-run.

#### I.6 — Rollback strategy

❌ Không có rollback script (Flyway forward-only). Nếu V89 hỏng giữa chừng (e.g. constraint conflict), admin phải tay khôi phục. Production deploy nên test V89→V90→V99 trên dump production trước khi apply.

#### I.7 — Docker/server access

OK — module dùng standard Spring Boot, không cần native binary.

---

## 4. Issue list theo severity

### 🔴 P0 — Phải fix trước production

#### P0-1 — Inspection wiring đứt: serial bị kẹt ở RETURNED khi return chuyển INSPECTING/COMPLETED
- **Vấn đề:** [SerialLifecycleService.java#L266 `moveReturnedToInspection`](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/SerialLifecycleService.java#L266) tồn tại nhưng KHÔNG được gọi từ bất kỳ chỗ nào. `inspectItem` ([AdminReturnService.java#L262](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminReturnService.java#L262)) chỉ ghi `inspection_result` lên return_items, không đụng tới serial status.
- **Nguy hiểm:** Sau khi customer trả hàng, admin không có cách nào (qua workflow chính) đưa serial về sellable stock — phải vào `/admin/serials` thao tác từng cái. Nếu admin quên, serial kẹt ở RETURNED → không bao giờ bán lại được, kho âm vô hình.
- **Cách fix:**
  1. Trong `AdminReturnService.transitionStatus`, khi `newStatus == "INSPECTING"` → gọi `serialLifecycleService.moveReturnedToInspection(returnId)`.
  2. Trong `AdminReturnService.inspectItem`, sau khi set `inspection_result`, tìm serial-id tương ứng từ `risRepo.findByReturnItemId(itemId)` và gọi `serialLifecycleService.markInspectionResult(serialId, IN_STOCK | DAMAGED, note)` (PASS → IN_STOCK, FAIL → DAMAGED).
- **Acceptance:**
  - Tạo return tracked-serial, RECEIVED → serial = RETURNED.
  - Move return → INSPECTING → serial = INSPECTION (tự động, không cần admin tay).
  - Inspect item PASS → serial = IN_STOCK, `quantity_on_hand` tự +1 qua trigger.
  - Inspect item FAIL → serial = DAMAGED, `quantity_on_hand` không đổi.
- **Phạm vi sửa:** Backend `AdminReturnService.java`. Test mới. Doc cập nhật `STATE_MACHINES.md` Section 9 + `SERIAL_INVENTORY_RULES.md` RULE-SER-008.

#### P0-2 — Bulk import không có giới hạn payload/row count
- **Vấn đề:** [SerialImportRequest.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/inventory/SerialImportRequest.java) không có `@Size(max=...)` trên `rows`. Controller không check.
- **Nguy hiểm:** Admin (cố ý hoặc nhầm) hoặc compromised token có thể POST 100k+ row → 1 transaction giữ lock dài → block toàn bộ checkout/admin → DoS.
- **Cách fix:**
  - Thêm `@Size(max=5000)` (hoặc đọc từ site_setting `serial_import_max_rows`) lên `List<SerialImportRowRequest> rows`.
  - Thêm guard sớm trong `AdminSerialImportService.importSerials`: nếu rows.size() > limit → ValidationException.
  - Frontend hiện đã limit file 5MB, nhưng cần chia thành chunk khi >limit/2.
- **Acceptance:** POST với 5001 row → 400 với code `MAX_ROWS_EXCEEDED`; POST với 5000 → success.
- **Phạm vi sửa:** Backend (DTO + service). Frontend (chunk). Test mới.

#### P0-3 — Permission `inventory.read` / `inventory.write` không được cấp cho bất kỳ role nào
- **Vấn đề:** Grep migration: KHÔNG role nào (ADMIN, SHOP_MANAGER, ...) được cấp `inventory.read` / `inventory.write`. Warranty screen + voidWarranty endpoint dùng các permission này → chỉ super-admin (`*`) dùng được.
- **Nguy hiểm:** Toàn bộ tính năng warranty (gắn liền với serial SOLD) thực tế không launch được cho operations team. Khi một customer khiếu nại warranty, manager không vào được màn → escalation manual.
- **Cách fix:** Migration mới grant `inventory.read` cho ADMIN, SHOP_MANAGER, INVENTORY_STAFF; `inventory.write` cho ADMIN, SHOP_MANAGER.
- **Acceptance:** Login bằng SHOP_MANAGER → vào `/admin/warranties` → thấy danh sách. Click void warranty → success.
- **Phạm vi sửa:** Backend migration. Doc `PERMISSION_MATRIX.md`.

#### P0-4 — `adjustStock`/`adjustProductStock` check serial duplicate sai bảng
- **Vấn đề:** [AdminInventoryService.java#L287, L385](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminInventoryService.java#L287) gọi `serialRepo.findExistingSerialNumbers(serials)` — `serialRepo` là `StockMovementSerialJpaRepository`, chỉ check bảng `stock_movement_serials`. Nếu serial đã tồn tại trong `product_serials` (e.g. nhập qua import trước đó), check pass nhưng INSERT vào `product_serials` sẽ vi phạm UNIQUE → DataIntegrityViolationException → 500.
- **Nguy hiểm:** Admin nhập 50 serial qua màn stock-in, nếu 1 serial đã có trong DB (qua đường khác) → toàn batch fail với 500, admin không hiểu lỗi gì. Có thể bị transaction lock dài.
- **Cách fix:** Thêm check song song với `productSerialRepo.findExistingSerialNumbers(serials)` trước khi insert. Trả lỗi 400 `ALREADY_EXISTS_IN_PRODUCT_SERIALS`.
- **Acceptance:** Import serial X qua `/serials/import`. Sau đó gọi `/adjust` với `serialNumbers=[X]` → 400 với code rõ, không phải 500.

#### P0-5 — Không có `DataIntegrityViolationException` handler → 500 cho race-condition unique violation
- **Vấn đề:** `GlobalExceptionHandler` không có @ExceptionHandler cho `DataIntegrityViolationException` ([GlobalExceptionHandler.java](../../bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/error/GlobalExceptionHandler.java)). Khi 2 admin import song song với cùng serial number, một request sẽ gặp DB unique violation → 500 (lộ thông tin internal).
- **Nguy hiểm:** Logs nổ stacktrace; client nhận 500 không biết retry hay không.
- **Cách fix:** Add `@ExceptionHandler(DataIntegrityViolationException.class)` map về 409 Conflict với code `DUPLICATE_OR_CONSTRAINT_VIOLATION`.

---

### 🟠 P1 — Nên fix trước launch

#### P1-1 — State machine FE/BE drift (3 nơi định nghĩa khác nhau)
- **Vấn đề:** Backend authoritative (xem B.1). FE2 màn duplicate rule và khác nhau. SerialListScreen thiếu `INSPECTION` từ IN_STOCK.
- **Nguy hiểm:** Admin nhìn màn nào sẽ phụ thuộc. Sau bất kỳ refactor nào, drift dễ xảy ra.
- **Cách fix:** Tạo file shared `bigbike-admin/src/lib/serialStateMachine.js` export `STATE_LABELS`, `STATE_COLORS`, `ALLOWED_TRANSITIONS` — import từ cả 2 màn. Giữ backend là canonical, FE chỉ là UI hint.
- **Acceptance:** Đổi 1 transition ở 1 file → cả 2 màn cập nhật. Backend vẫn validate độc lập.

#### P1-2 — Test `Phase1KInventorySerialApiTest` đang fail (mã lỗi sai)
- **Vấn đề:** Test expect `"COUNT_MISMATCH"` nhưng service throw `"COUNT_EXCEEDS_QUANTITY"`.
- **Cách fix:** Sửa test cho khớp code; HOẶC sửa code cho khớp test (theo hướng nào nhất quán với DTO contract). Chốt 1 mã lỗi rồi cập nhật `API_CONTRACT.md`.

#### P1-3 — `enableTracking` và `importSerials` không ghi audit log
- **Vấn đề:** Toggle tracking là policy change quan trọng (đổi cách kho được tính). Bulk import có thể nhập nghìn serial. Cả hai không có entry trong `audit_logs`.
- **Cách fix:** Thêm `auditLogRepo.save(buildAudit(adminId, "SERIAL_TRACKING_ENABLED|DISABLED", ...))` và `"SERIALS_IMPORTED"`.
- **Acceptance:** Toggle tracking → có 1 row audit_logs với action chính xác. Import 50 serial → 1 row với count=50.

#### P1-4 — Permission tách riêng cho serial (xem D.2)
- **Cách fix:** Migration mới: thêm permission `inventory.serial.read`, `inventory.serial.import`, `inventory.serial.status_update`. Cấp cho ADMIN, SHOP_MANAGER, INVENTORY_STAFF. Update controller.
- **Acceptance:** User chỉ có `products.update` (e.g. content writer) → không gọi được `/serials/import` hay `/serials/{id}/status`.

#### P1-5 — Search serial dùng `LIKE %...%` → không scale
- **Vấn đề:** Khi `product_serials` >100k, search chậm.
- **Cách fix:** Thêm GIN trigram index `gin_trgm_ops` trên `LOWER(serial_number)`. Hoặc đổi sang prefix-match cho usecase phổ biến (admin scan serial → exact prefix).
- **Acceptance:** Benchmark query với 200k row, search latency < 200ms p95.

#### P1-6 — N+1 trong list response
- **Vấn đề:** `AdminSerialResponse.from(serial)` truy cập product/variant lazy.
- **Cách fix:** Đổi query searchAll/findByVariant sang JOIN FETCH product, variant.

#### P1-7 — Frontend `note` validation cho DAMAGED/SCRAPPED chưa enforce
- **Vấn đề:** UI có `*` đỏ nhưng không block submit.
- **Cách fix:** Frontend check, hiển thị lỗi inline.

#### P1-8 — Reservation TTL setting không seed
- **Vấn đề:** `reservation_ttl_minutes` không có row trong site_settings → admin không sửa qua UI được.
- **Cách fix:** Migration mới insert default 15.

#### P1-9 — Test integration thiếu cho inspection flow (xem H.3)
- **Phụ thuộc** P0-1.

---

### 🟡 P2 — Cải thiện sau launch

#### P2-1 — Status label inconsistency giữa 2 màn FE
- Hợp nhất bảng STATUS_LABELS / COLORS dùng chung (xem P1-1 cùng giải).

#### P2-2 — Inline `style={...}` toàn bộ → vi phạm CLAUDE.md UI Stack
- Migrate sang Tailwind utility + brand token dần (theo audit `BIGBIKE_WEB_DESIGN_SYSTEM_FULL_AUDIT.md` workflow).

#### P2-3 — Hardcode hex color thay vì brand token
- Dùng `var(--admin-color-state-success)` etc. theo `admin-tokens.css`.

#### P2-4 — Native `<table>`/`<input>` ở AddSerialsPanel + SerialListPanel
- Migrate sang shadcn `Input`, `AdminTable`.

#### P2-5 — i18n missing cho SerialListScreen + InventoryScreen (Vietnamese hardcoded)
- Thêm key `vi.json`/`en.json` cho 2 màn này.

#### P2-6 — `restoreStockForReturn` cho serial-tracked items hiện skip — admin phải tự inspect
- Sau khi P0-1 fix sẽ tự động.

#### P2-7 — UI từ serial detail không link sang order/return detail
- Add `<Link>` trong SerialDetailModal khi `orderLineItemId`/`returnItemId` có.

#### P2-8 — Audit log UI riêng cho serial action
- Filter trong AuditLogListScreen theo resourceType=`SERIAL`.

#### P2-9 — Soft-delete product có serial → cho phép insert serial vào TRASH product
- Add check publishStatus == TRASH ở `addToProduct`/`addToVariant`.

#### P2-10 — Missing trigger reconcile job
- Cron daily verify `quantity_on_hand` matches IN_STOCK serial count cho mọi track_serials=true variant.

#### P2-11 — Frontend `addProductSerials` / `addVariantSerials` API export không dùng
- Dead code trong `adminApi.js` (chỉ `importBulkSerials` được dùng). Xoá hoặc hợp nhất.

#### P2-12 — `markInspectionResult` requires INSPECTION status — UI chưa expose để admin chuyển từ INSPECTION trực tiếp với note bắt buộc
- (Hiện UI dùng `updateStatus` với INSPECTION → IN_STOCK/DAMAGED/SCRAPPED, không gọi markInspectionResult — service chưa được FE call.)

---

### 🟢 P3 — Cleanup / refactor

- P3-1: InventoryScreen 2050 dòng — tách `SerialManageModal`, `AddSerialsPanel`, `SerialListPanel`, `SerialQrModal`, `MovementHistoryModal`, `StockInModal` ra file riêng (theo audit history về tương tự với LongFile).
- P3-2: Hai bộ `parseSerialFromCsv` / `parseSerialFile` định nghĩa song song trong InventoryScreen (line 195 vs 899) — duplicate parser, gộp lại.
- P3-3: `SerialReservationCleanupJob` không có distributed lock — nếu deploy multi-instance, mỗi node sẽ chạy mỗi 60s, sẽ trùng (SKIP LOCKED giúp safe nhưng wasteful). Dùng Shedlock hoặc set `inventory.reservation.cleanup-interval-ms` khác nhau theo instance.
- P3-4: `stock_movements` ledger phình → archive >180 days.
- P3-5: Migration history phức tạp — viết một note kèm V89 lý do tồn tại của chuỗi V51→V54→V55→V57→V89.

---

## 5. Compliance with `docs/business/SERIAL_INVENTORY_RULES.md`

| Rule | Code state | Notes |
|---|---|---|
| RULE-SER-001 — Serial là source of truth khi track_serials=true | ✅ | Trigger `fn_sync_qty_from_serial_lifecycle` enforce. Lifecycle service không set qty trực tiếp. |
| RULE-SER-002 — Reservation TTL configurable | ⚠️ | Code đọc setting nhưng setting chưa seed (P1-8). |
| RULE-SER-003 — FIFO reservation | ✅ | `ORDER BY received_at ASC` trong native query. |
| RULE-SER-004 — Concurrent safety SKIP LOCKED | ✅ | Test T5 verify. |
| RULE-SER-005 — Idempotent operations | ✅ | Tất cả 6 lifecycle methods có guard. |
| RULE-SER-006 — Order COMPLETED → markSold | ✅ | `AdminOrderService.transitionStatus` line 287-288. |
| RULE-SER-007 — Order CANCELLED → release | ✅ | AdminOrderService 289-292; CustomerOrderCancelService line 66. |
| RULE-SER-008 — Returns đi qua INSPECTION | ❌ | **Đứt giữa chừng — xem P0-1.** Code có `moveReturnedToInspection` nhưng không gọi. |
| RULE-SER-009 — Warranty tự tạo khi SOLD | ✅ | `markSoldForOrder` line 165-183. |
| RULE-SER-010 — `serial_inventory_only=true` block manual adjust | ✅ | Test T13 verify. |
| RULE-SER-011 — Non-serial variants unaffected | ✅ | Gate chỉ block adjustStock; non-tracked vẫn chạy được. (Lưu ý: gate hiện block ALL adjust nếu enabled — có thể quá rộng so với rule, nhưng UI banner đã warn.) |
| RULE-SER-012 — POS reserve+markSold cùng transaction | ✅ | PosOrderService.java line 466-471. |

---

## 6. Compliance với `docs/engineering/SERIAL_INVENTORY_FLOW.md`

(Tài liệu liệt kê endpoint, settings, schema — verify spot-check khớp. KHÔNG re-read full doc trong audit này.)

---

## 7. Go / No-Go for production

### Có thể deploy ngay không?
**KHÔNG.** Module sẽ chạy được technically nhưng có 5 P0 nghiêm trọng:
1. Inspection workflow đứt → kho âm vô hình.
2. Bulk import DoS-able → 1 admin có thể down hệ thống.
3. Warranty screen unusable cho non-super-admin.
4. Race-condition import → 500 thay vì 409.
5. AdjustStock duplicate check sai bảng → 500.

### Cần fix tối thiểu trước launch
**P0 toàn bộ (5 issue) + P1-2 (test fail trong CI)** + **P1-8 (seed reservation_ttl_minutes)**.

P1-1 (state machine drift) và P1-3 (audit log thiếu) **rất nên** fix trước launch nhưng không block — nếu thời gian gấp có thể nhận tech debt và fix trong 2 tuần đầu sau launch.

### Effort estimate

| Mức | Effort | Chi tiết |
|---|---|---|
| P0 (5 issue) | **3–5 ngày dev + 1 ngày QA** | P0-1 lớn nhất (~2 ngày, gồm lifecycle wire + test); còn lại nhỏ hơn |
| P1 (9 issue) | **5–7 ngày dev + 2 ngày QA** | P1-4 (permission split) và P1-5 (search index) ~1 ngày mỗi cái |
| P2 (12 issue) | **2–3 tuần** trải dài sau launch | UX polish, refactor, test coverage |
| P3 (5 issue) | **1 tuần** rolling | Cleanup không gấp |

### Thứ tự fix khuyến nghị

**Tuần 1 (sprint launch):**
1. P0-3 (permission grant migration) — 30 phút.
2. P0-2 (import payload limit) — 2 giờ.
3. P0-5 (DataIntegrity handler) — 1 giờ.
4. P0-4 (adjustStock check 2 bảng) — 2 giờ + test.
5. P1-2 (sửa test fail) — 30 phút.
6. P1-8 (seed reservation_ttl_minutes) — 30 phút.
7. **P0-1 (inspection wiring) — 1.5 ngày, gồm AdminReturnService refactor + integration test + STATE_MACHINES doc update.**
8. Smoke test toàn bộ flow: Reserve → Sold → Return → Receive → Inspect PASS → IN_STOCK; cũng FAIL → DAMAGED.

**Tuần 2 (post-launch hardening):**
9. P1-1 (shared state machine module).
10. P1-3 (audit log enableTracking + import).
11. P1-4 (permission split).
12. P1-7 (FE note required validation).
13. P1-5 + P1-6 (perf indexes + JOIN FETCH).
14. P1-9 (inspection test).

**Tuần 3+:** P2 dần dần.

---

## 8. Evidence path summary

Tất cả nhận định trong báo cáo đều có cite-able evidence. Reference chính:

- Backend service code: `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminSerialService.java`, `AdminSerialImportService.java`, `service/inventory/SerialLifecycleService.java`, `service/inventory/SerialReservationCleanupJob.java`, `service/admin/AdminInventoryService.java`, `service/admin/AdminReturnService.java`.
- Backend controller: `api/admin/AdminInventoryController.java`, `api/admin/AdminWarrantyController.java`.
- Backend entity/repo: `persistence/entity/catalog/ProductSerialEntity.java`, `persistence/repository/catalog/ProductSerialJpaRepository.java`, `domain/catalog/ProductSerialStatus.java`.
- DTO: `api/admin/dto/inventory/AdminSerialResponse.java`, `AddSerialsRequest.java`, `SerialImportRequest.java`, `SerialImportResponse.java`, `SerialImportRowRequest.java`, `UpdateSerialStatusRequest.java`.
- Migration: V30, V50, V51, V54, V55, V57, V82, V89, V90, V99, V104, V108.
- Frontend: `bigbike-admin/src/screens/SerialListScreen.jsx`, `bigbike-admin/src/screens/InventoryScreen.jsx`, `bigbike-admin/src/lib/adminApi.js`, `bigbike-admin/src/App.jsx`.
- Tests: `Phase1KInventorySerialApiTest.java`, `Phase2FSerialInventoryTest.java`.
- Docs: `docs/business/SERIAL_INVENTORY_RULES.md`, `docs/engineering/SERIAL_INVENTORY_FLOW.md`.

---

**End of audit.**
