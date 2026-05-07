HISTORICAL_REPORT_ONLY - Not canonical. Validate against current code and canonical docs.

# Inventory Module Audit

> Audit date: 2026-05-06
> Auditor: Claude (Opus 4.7) — Senior Software Architect + QA Lead
> Scope: BigBike Inventory module — backend, admin frontend, DB migrations, business flow, tests
> Method: Source-of-truth code review (no inferred behavior). Every finding cites file:line.

---

## 1. Executive Summary

**Verdict: `NOT_READY_NEEDS_FIXES` — module chứa P0 concurrency bug và P0 audit-trail gap, không thể release lên production thật.**

Module Inventory là module "trông đủ" — UI có, API có, migration đầy đủ, nhưng audit code-level phát lộ những lỗi nguy hiểm với tiền và kho:

| Mức | Số issues | Tóm tắt |
|---|---:|---|
| **P0 — Blocker** | 5 | Lost-update race trên `adjustStock`; refund-flow không restore stock; product-level decrement không ghi `stock_movements`; CSV export broken trong production; orphan schema `stock_receipts*` không có code Java |
| **P1 — High** | 6 | Movement type không thống nhất (POS dùng `SALE`, checkout dùng `OUT`); FE render `m.productName`/`m.variantName` nhưng DTO không có; `RETURN` reference không có unique guard; data drift giữa `products.stock_quantity` và `product_variants.quantity_on_hand`; serial cross-table không unique; test coverage rất mỏng |
| **P2 — Medium/Low** | 6 | Per-variant movement detail không có UI; FE filter dropdown thiếu type; CSV export không có ORDER BY stable; PREORDER enum còn dù dữ liệu đã migrate; note length không validate; FE picker page-size 8 hard-coded |

Tổng điểm trung bình các area: **~62/100**. Verdict cuối: xem Section 15.

---

## 2. Evidence Map

| Area | File | Function/Class | Evidence |
|---|---|---|---|
| Controller | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminInventoryController.java` | toàn bộ | 6 endpoints, dùng `devAdminAuthService.requirePermission(...)` |
| Service | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminInventoryService.java` | `listStock`, `listMovements`, `listAllMovements`, `getSummary`, `exportCsv`, `adjustStock`, `parseSerials` | DB-side filter; serial validation; movement persist |
| Policy | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/InventoryPolicyService.java` | `lowStockThreshold`, `computeStockState`, `recomputeStockState` | LOW_STOCK threshold = `low_stock_threshold` setting hoặc 5 |
| Entity | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/catalog/ProductVariantEntity.java` | `quantity_on_hand`, `stockState` | Không có `@Version` |
| Entity | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/catalog/StockMovementEntity.java` | toàn bộ | `movement_type`, `quantity_before/after/delta`, `reference_type`, `reference_id`, `admin_id` |
| Entity | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/catalog/StockMovementSerialEntity.java` | toàn bộ | `serial_number`, FK `stock_movement_id` |
| Repo | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/catalog/ProductVariantJpaRepository.java` | `findByIdForUpdate`, `searchStock`, `countByStockState` | Có pessimistic lock available — nhưng adjustStock không dùng |
| Repo | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/catalog/StockMovementJpaRepository.java` | `searchMovements`, `existsByReferenceTypeAndReferenceId` | JOIN FETCH variant + product chống N+1 |
| Repo | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/catalog/StockMovementSerialJpaRepository.java` | `findExistingSerialNumbers`, `countByMovementId` | Cross-table check |
| DTO | `.../dto/inventory/AdminStockItemResponse.java`, `AdjustStockRequest.java`, `InventorySummaryResponse.java`, `StockMovementResponse.java` | record types | Movement DTO **không có** productName/variantName |
| Cross — Checkout | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java:152-267, 794-887` | `checkoutFromCart`, `quickBuy`, `decrementStockForCartItems`, `decrementVariantStock` | Pessimistic lock variant + product; movementType=`OUT`; product-fallback **không** ghi movement |
| Cross — POS | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java:114-354, 356-384` | `createOrder`, `decrementStock` | Pessimistic lock variant; **movementType=`SALE`** |
| Cross — Order | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java:231-291, 549-592` | `updateOrderStatus`, `restoreStockForOrder` | Restore khi `CANCELLED`/`REFUNDED`; movement reference_type=`ORDER_CANCEL` |
| Cross — Refund | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/payment/RefundService.java:64-167` | `applyRefund` | **Không** call restoreStockForOrder |
| Cross — Return | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminReturnService.java:131-189, 213-239` | `updateStatus`, `restoreStockForReturn` | Restore khi `COMPLETED`/`REFUNDED`; movement reference_type=`RETURN` |
| Migration | `V30__add_inventory_tracking.sql` | tạo `stock_movements`, thêm `quantity_on_hand` | Có index `variant_id`, `created_at desc` |
| Migration | `V50__inventory_integrity_guards.sql` | unique index `ORDER_CANCEL`; CHECK `quantity_on_hand >= 0` | Chỉ guard ORDER_CANCEL, **không** RETURN |
| Migration | `V51__add_serial_tracking.sql` | tạo `product_serials` lifecycle + trigger | Bị V54 xóa hoàn toàn |
| Migration | `V52__add_stock_receipts.sql` | tạo `stock_receipts` | **Không có** entity Java |
| Migration | `V53__add_stock_receipt_lines.sql` | tạo `stock_receipt_lines` | **Không có** entity Java |
| Migration | `V54__remove_serial_tracking.sql` | drop `product_serials`, view, trigger | OK |
| Migration | `V55__add_receipt_serials.sql` | tạo `stock_receipt_serials` UNIQUE(serial_number) | **Không có** entity Java |
| Migration | `V56__migrate_preorder_stock_state.sql` | UPDATE PREORDER → OUT_OF_STOCK | Một lần; enum vẫn còn |
| Migration | `V57__add_stock_movement_serials.sql` | tạo `stock_movement_serials` UNIQUE(serial_number) | OK; là bảng entity hiện đang dùng |
| FE App | `bigbike-admin/src/App.jsx:71-73, 164, 204, 386-388` | nav + route + permission | route `/admin/inventory`, perm `products.read`, screen lazy |
| FE Screen | `bigbike-admin/src/screens/InventoryScreen.jsx` | toàn bộ | List + summary + movements tab + stock-in modal + serial input |
| FE API | `bigbike-admin/src/lib/adminApi.js:1621-1719` | `fetchInventory`, `adjustStock`, `fetchInventorySummary`, `fetchAllMovements`, `fetchVariantMovements`, `inventoryExportCsvUrl` | normalizeMovement **thiếu** productName/variantName |
| Test | `bigbike-backend/src/test/java/.../Phase1KInventorySerialApiTest.java` | 8 test cases serial-only | Không cover list/summary/CSV/permission/concurrent |
| Docs | `docs/business/BUSINESS_RULES.md:482-547` | INVENTORY_RULE_001..004 | Tất cả MISSING_TEST_COVERAGE |
| Docs | `docs/business/STATE_MACHINES.md:480-547` | Stock state machine | Confirm recompute; serial lifecycle `NEEDS_VERIFICATION` |
| Docs | `docs/engineering/PERMISSION_MATRIX.md:302-311` | Inventory endpoint perms | products.read / products.update |

---

## 3. Route & Screen Coverage

### Admin Route

| Route | File | Permission FE | Screen | Sub-routes |
|---|---|---|---|---|
| `/admin/inventory` | [App.jsx:164,204,386-388](bigbike-admin/src/App.jsx#L164) | `products.read` | `InventoryScreen` | Không có sub-route (dùng tab nội bộ) |

Permission guard ở [App.jsx:314-322](bigbike-admin/src/App.jsx#L314) — `routePermission('inventory') = 'products.read'`. Nếu FE thiếu permission → chặn ở route level. Adjust button render conditional theo `canUpdate = hasPermission('products.update')` ([InventoryScreen.jsx:1009-1021](bigbike-admin/src/screens/InventoryScreen.jsx#L1009)).

### Screen states

| State | Implemented? | Evidence |
|---|---|---|
| loading | ✅ | `state.status === 'loading'` skeleton table; `pickerState.status === 'loading'` |
| empty | ✅ | `StatePanel tone="neutral"` khi `items.length === 0` |
| error | ✅ | `StatePanel tone="danger"` với retry |
| success | ✅ | `AdminTable` + `PaginationControls` |
| submitting | ✅ | `submitting` state trên StockInModal |
| permission/read-only | ✅ | `ReadOnlyBanner` + conditional adjust button |

### UI features

| Feature | Implemented? | Evidence/Gap |
|---|---|---|
| List tồn kho | ✅ | AdminTable với product/variant/qty/state |
| Search (q) | ✅ | debounced 250ms |
| Filter stockState | ✅ | dropdown ALL / IN_STOCK / OUT_OF_STOCK / LOW_STOCK |
| Summary banner | ✅ | total / out-of-stock / low-stock |
| Movement timeline (all) | ✅ | tab "Lịch sử biến động" |
| Movement timeline per variant | ⚠️ | API có (`fetchVariantMovements`) nhưng **UI không gọi** — mở row chi tiết không tồn tại |
| Stock-in/adjust modal | ✅ | `StockInModal` — chỉ hỗ trợ `IN`, không có OUT/ADJUSTMENT/RETURN |
| Export CSV | ⚠️ | Anchor download → **broken trong production** vì không gửi Authorization header (xem P0 #4) |
| Serial input | ✅ | textarea + paste + per-row remove |
| Serial file import | ✅ | xlsx/xls/csv/txt 5MB limit |
| Serial dedupe client | ✅ | `parseSerialBatch` |
| Validate serial count = qty | ✅ | exceeds + underfill warnings |
| Reload sau mutation | ✅ | `inventoryRefreshKey` + `movementsRefreshKey` |
| Responsive | NOT_VERIFIED | không kiểm thử trực tiếp |

### Gap

- **Không có UI cho OUT / ADJUSTMENT / RETURN movements thủ công.** UI chỉ stock-in. BE chấp nhận cả 4 type. Admin muốn ghi giảm kho thủ công hay điều chỉnh không có nút bấm.
- **Không có per-variant timeline drill-down**. API tồn tại không bị dùng — dead code FE side.
- **Không có "serial detail" view**. UI hiển thị "X S/N" nhưng click không show được serials.

---

## 4. Backend API Coverage

| # | Method | Endpoint | Controller | Service | Permission | Request | Response | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/v1/admin/inventory` | [AdminInventoryController.java:43-53](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminInventoryController.java#L43) | `listStock` | `products.read` | page/size/q/stockState | `PageResult<AdminStockItemResponse>` | ✅ confirmed |
| 2 | GET | `/api/v1/admin/inventory/summary` | line 55-59 | `getSummary` | `products.read` | — | `InventorySummaryResponse` | ✅ confirmed |
| 3 | GET | `/api/v1/admin/inventory/movements` | line 61-71 | `listAllMovements` | `products.read` | page/size/movementType/referenceType | `PageResult<StockMovementResponse>` | ✅ confirmed |
| 4 | GET | `/api/v1/admin/inventory/export.csv` | line 73-77 | `exportCsv` | `products.read` | — | `text/csv` | ⚠️ download via FE broken (P0 #4) |
| 5 | GET | `/api/v1/admin/inventory/variants/{variantId}/movements` | line 79-88 | `listMovements` | `products.read` | page/size | `PageResult<StockMovementResponse>` | ✅ confirmed; FE chưa dùng |
| 6 | POST | `/api/v1/admin/inventory/variants/{variantId}/adjust` | line 90-98 | `adjustStock` | `products.update` | `AdjustStockRequest` | `AdminStockItemResponse` | ⚠️ thiếu pessimistic lock (P0 #1) |

### Pagination + size limit

| Endpoint | Default size | Max size | Confirmed |
|---|---:|---:|---|
| `listStock` | 20 | 100 | [AdminInventoryService.java:37-38, 67](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminInventoryService.java#L37) |
| `listAllMovements` | 20 | 100 | line 108 |
| `listMovements` (variant) | 20 | 100 | line 92 |

### Filter chạy DB-side?

- ✅ `searchStock`: `LOWER(...) LIKE` trên sku/name + JOIN FETCH product → DB-side, có chống N+1.
- ✅ `searchMovements`: WHERE movementType + referenceType + JOIN FETCH variant + product.
- ⚠️ `exportCsv`: chunk 500, dùng `searchStock("", null, ...)` — ORDER BY là `p.name ASC, v.name ASC`. **Không** stable nếu trùng tên. Edge case có thể bỏ sót/duplicate khi chunk paginate. Khả năng thấp nhưng có (P2).

### Response field FE cần

- `AdminStockItemResponse` ↔ `normalizeStockItem` ([adminApi.js:1639-1654](bigbike-admin/src/lib/adminApi.js#L1639)): productId/productName/productSku/productImage/variantId/variantName/variantSku/stockState/quantityOnHand/retailPrice — **đầy đủ**.
- `StockMovementResponse` ↔ `normalizeMovement` ([adminApi.js:1702-1715](bigbike-admin/src/lib/adminApi.js#L1702)): id/movementType/quantityDelta/before/after/referenceType/note/createdAt/serialCount — đầy đủ. NHƯNG FE UI render `m.productName` và `m.variantName` ở [InventoryScreen.jsx:883-884](bigbike-admin/src/screens/InventoryScreen.jsx#L883), mà **DTO không có 2 field này** → luôn empty. P1 contract bug.

### Validation format

`ValidationException.fromField(field, code, message)` — chuẩn dùng trong toàn module, response shape `{ "error": { "code": "VALIDATION_ERROR", "details": [{ field, code, message }] } }` — confirmed by `Phase1KInventorySerialApiTest.java:113`.

### Permission backend

✅ Mọi endpoint đều gọi `devAdminAuthService.requirePermission(request, ...)` đầu tiên.

### N+1

- ✅ `searchStock`: JOIN FETCH `v.product`.
- ✅ `searchMovements`: JOIN FETCH `m.variant` + `v.product`.
- ⚠️ `toMovementResponse` gọi `serialRepo.countByMovementId(m.getId())` cho **mỗi** movement → N+1 trên endpoint movements khi list 20+ rows. Không trầm trọng nhưng nên batch.

### Invalid input

- ✅ Variant ID không tồn tại → `NotFoundException` ([AdminInventoryService.java:88-90, 165](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminInventoryService.java#L88)).
- ✅ stockState không hợp lệ → silently ignored (`stateParam = null`) — nhẹ, không reject. Có thể là bug UX nhưng không phá data.
- ✅ movementType không hợp lệ → ValidationException `INVALID`.

---

## 5. Permission Matrix

| Action | FE permission | BE permission | Match? | Risk |
|---|---|---|---|---|
| View `/admin/inventory` | `products.read` ([App.jsx:204](bigbike-admin/src/App.jsx#L204)) | `products.read` ([AdminInventoryController.java:51](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminInventoryController.java#L51)) | ✅ | OK |
| List inventory | n/a (route guard) | `products.read` | ✅ | OK |
| Get summary | n/a | `products.read` | ✅ | OK |
| List movements | n/a | `products.read` | ✅ | OK |
| Export CSV | n/a | `products.read` | ✅ | Anchor download không có Bearer (P0 #4) |
| Adjust stock | `products.update` ([App.jsx:387](bigbike-admin/src/App.jsx#L387)) | `products.update` ([AdminInventoryController.java:96](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminInventoryController.java#L96)) | ✅ | OK |

### Đánh giá `products.*` vs riêng `inventory.*`

Hiện tại Inventory dùng chung `products.read/update`. **Hợp lý cho MVP** vì kho phụ thuộc vào product+variant catalog. Nhưng nếu sau này muốn cho `WAREHOUSE_OPERATOR` chỉ kho không catalog, sẽ phải refactor sang `inventory.read/inventory.write`. Hiện chưa cần — ghi nhận làm tech-debt.

---

## 6. Validation Audit

### Backend — `AdminInventoryService.adjustStock`

| Validation | Implemented? | Evidence | Gap |
|---|---|---|---|
| `quantityDelta` required | ✅ | line 167-169 + `@NotNull` DTO | OK |
| `movementType` ∈ {IN,OUT,ADJUSTMENT,RETURN} | ✅ | line 173-176 | Không cho phép `SALE` (correct — admin shouldn't write SALE) |
| Resulting quantity ≥ 0 | ✅ | line 180-183 | Field-level error code `BELOW_ZERO` |
| IN: serials required | ✅ | line 188-193 | `REQUIRED_FOR_STOCK_IN` |
| IN: serial count == quantity | ✅ | line 194-198 | `COUNT_MISMATCH` |
| Other type: serial count ≤ quantity | ✅ | line 199-206 | `COUNT_EXCEEDS_QUANTITY` |
| Duplicate in request | ✅ | line 270-273 | `DUPLICATE_IN_REQUEST` |
| Duplicate in DB | ✅ | line 209-215 | `ALREADY_EXISTS` |
| Variant tồn tại | ✅ | line 164-165 | NotFoundException |
| **Note length** | ❌ | không validate độ dài note | P2 — note là `text` DB không giới hạn → DOS payload bomb risk theo lý thuyết |
| **quantityDelta quá lớn (overflow)** | ❌ | int overflow nếu admin gửi `Integer.MAX_VALUE - 1` lúc qty hiện tại = 100 | P2 |
| **Cross-table serial uniqueness** | ❌ | `findExistingSerialNumbers` chỉ check `stock_movement_serials` (xem [StockMovementSerialJpaRepository.java:14](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/catalog/StockMovementSerialJpaRepository.java#L14)) — **không** check `stock_receipt_serials` | P1 — cùng một serial có thể tồn tại cả 2 bảng |
| **Movement type alignment với system types** | n/a | `SALE` (POS), `OUT` (web checkout), `IN` (return/cancel), `RETURN`/`ADJUSTMENT` (admin) — **không phải union** | P1 inconsistency |

### Frontend — `StockInModal.validate()` ([InventoryScreen.jsx:567-582](bigbike-admin/src/screens/InventoryScreen.jsx#L567))

| Validation | Implemented? |
|---|---|
| Quantity ≥ 1 | ✅ `qty < 1` → error |
| Serial count == qty | ✅ |
| File size limit | ✅ 5MB |
| File type | ✅ csv/xlsx/xls/txt |
| CSV delimiter detection | ✅ tab/semicolon/comma |
| Duplicate client-side | ✅ `parseSerialBatch.dupes` |
| Hiển thị lỗi rõ | ✅ field-error + role="alert" |
| Empty serial filter | ✅ |

UI validation chặt và UX tốt cho stock-in. Nhưng UI **không có form** cho movement types khác (OUT/ADJUSTMENT/RETURN) — backend support nhưng UI chỉ làm IN.

---

## 7. DB & Migration Audit

### Tables

| Table | Created | Used by Java? | Notes |
|---|---|---|---|
| `product_variants` (column `quantity_on_hand`) | V30 | ✅ entity | CHECK ≥ 0 added in V50; **không có** `@Version` |
| `stock_movements` | V30 | ✅ entity | unique partial index `ORDER_CANCEL` only |
| `product_serials` | V51 | ❌ | **DROPPED in V54** — gone |
| `stock_receipts` | V52 | ❌ orphan | **không có entity/repo/service/controller Java** |
| `stock_receipt_lines` | V53 | ❌ orphan | **không có entity Java** |
| `stock_receipt_serials` | V55 | ❌ orphan | **không có entity Java** — UNIQUE(serial_number) |
| `stock_movement_serials` | V57 | ✅ entity | UNIQUE(serial_number) |

### Indexes / Constraints

| Object | Migration | Purpose | Issue |
|---|---|---|---|
| `idx_stock_movements_variant_id` | V30 | per-variant timeline | OK |
| `idx_stock_movements_created_at desc` | V30 | global timeline | OK |
| `chk_qty_on_hand_non_negative` | V50 | block negative qty | ✅ DB-level safety net — chặn khi service code có bug |
| `idx_stock_movements_order_cancel_unique` | V50 | chống double restore khi cancel | ✅ partial unique on `(variant, reference_id) WHERE reference_type='ORDER_CANCEL'` |
| `idx_stock_movements_receipt` | V52 | partial idx WHERE `reference_type='RECEIPT'` | dead — chưa có code nào ghi RECEIPT |
| `idx_receipt_lines_receipt` | V53 | n/a | dead — orphan |
| `uq_stock_receipt_serial` | V55 | per-table serial unique | dead |
| `idx_receipt_serials_line_id` | V55 | n/a | dead |
| `idx_movement_serials_movement` | V57 | per-movement serial lookup | OK |
| `uq_movement_serial` | V57 | per-table serial unique | OK — within stock_movement_serials only |

### Critical findings

1. **`product_variants.quantity_on_hand` là source of truth** ✅ confirmed.
2. **stock_movements ledger** đầy đủ delta/before/after (xem [V30:24-32](bigbike-backend/src/main/resources/db/migration/V30__add_inventory_tracking.sql#L24)) ✅.
3. **DB CHECK chặn âm** ✅.
4. **Index đủ cho list/search/timeline** ✅.
5. **Unique chống double restore CHỈ cho ORDER_CANCEL** ⚠️ — không có guard cho `RETURN`. AdminReturnService phụ thuộc state machine + V67 `@Version` trên returns để tránh duplicate, không có DB safety net.
6. **Serial unique constraint** ⚠️ — chỉ within `stock_movement_serials` (V57) hoặc within `stock_receipt_serials` (V55). **Không cross-table.** Một số khung xe có thể tồn tại cả 2 bảng.
7. **Migration mâu thuẫn** ⚠️:
   - V51 tạo `product_serials` (lifecycle table với status RESERVED/SOLD/RETURNED…) + trigger sync `quantity_on_hand` từ count(IN_STOCK).
   - V54 xóa toàn bộ `product_serials`, trigger, view, `track_serials` cột.
   - V55 thêm `stock_receipt_serials` (per-line snapshot).
   - V57 thêm `stock_movement_serials` (per-movement snapshot, hiện đang dùng).
   - **Net result**: Hệ thống không có serial lifecycle. Serial chỉ là "log đính kèm movement", không track unit physical. Không thể trả lời "serial X hiện thuộc ai? đang ở đâu?".
8. **Orphan schema** ⚠️ — `stock_receipts`, `stock_receipt_lines`, `stock_receipt_serials` tồn tại trong DB nhưng **không có 1 dòng code Java nào** đọc/ghi. Nếu chưa từng deploy bản có entity → schema dead. Nguy cơ data drift, confusion cho dev mới.
9. **Data drift `products.stock_quantity` vs `product_variants.quantity_on_hand`** ⚠️ — checkout fallback decrement product.stock_quantity (cho product không variant) nhưng inventory module chỉ đọc/ghi variant. Nếu product không variant tồn tại trong DB, kho của nó **không hiện trong** Inventory screen.
10. **PREORDER stock_state đã migrate** (V56) nhưng enum `ProductStockState` vẫn còn 5 giá trị bao gồm `PREORDER`/`CONTACT_FOR_STOCK` (xem [ProductStockState.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/domain/catalog/ProductStockState.java)). Nếu admin set product/variant về PREORDER qua admin catalog, `recomputeStockState` sẽ skip — bug data có thể quay lại sau migration.

---

## 8. Inventory Business Flow Audit

| Flow | Expected | Actual | Gap |
|---|---|---|---|
| Admin nhập kho thủ công | Tăng tồn, ghi movement, serial bắt buộc cho IN | ✅ ([AdminInventoryService.adjustStock:163-244](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminInventoryService.java#L163)) | OK — nhưng **race condition** với findById không lock (P0 #1) |
| Admin xuất/điều chỉnh kho | Giảm/tăng, không âm | ✅ logic; UI chưa expose | OUT/ADJUSTMENT/RETURN type backend OK nhưng FE không có form |
| Web checkout COD | Trừ kho khi tạo order | ✅ ([CheckoutService.checkoutFromCart:213](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java#L213)) — pessimistic lock | Variant: ghi `OUT`/`ORDER`. **Product fallback: KHÔNG ghi movement** (P0 #3) |
| Web checkout BACS | Reserve/trừ kho | Trừ kho ngay (giống COD), order ON_HOLD | NEEDS_BUSINESS_DECISION: BACS có nên reserve không, hay khoá lại như hiện tại (đã trừ stock dù chưa nhận tiền)? Code hiện trừ ngay. |
| POS sale | Trừ kho ngay | ✅ ([PosOrderService.decrementStock:356-384](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L356)) | **movementType=`SALE`** ≠ web `OUT` (P1 #1) |
| Order CANCEL | Cộng kho lại 1 lần | ✅ via `updateOrderStatus`+`restoreStockForOrder` ([AdminOrderService.java:269-271, 549-592](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java#L269)). Unique idx `ORDER_CANCEL` chống double-restore | OK |
| Order REFUND (qua `updateOrderStatus`) | Cộng kho lại | ✅ logic giống cancel; reference_type=`ORDER_CANCEL` cho tất cả các trường hợp khôi phục từ order | OK với guard ORDER_CANCEL |
| Order REFUND (qua POST `/admin/orders/{id}/refund` → RefundService) | Cộng kho lại | ❌ — `RefundService.applyRefund` chỉ set status, không call `restoreStockForOrder` ([RefundService.java:99-115](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/payment/RefundService.java#L99)) | **P0 #2 — bypass restore stock** |
| Return COMPLETED | Cộng kho lại 1 lần | ✅ ([AdminReturnService.java:182-184, 213-239](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminReturnService.java#L182)) | OK theo state machine, **không** có DB unique guard cho RETURN (P1 #3) |
| Return REFUNDED | Cộng kho + refund tiền | ✅ — gọi cả `refundService.applyRefund` + `restoreStockForReturn` | OK |
| Product unpublish / variant unavailable | Không cho bán | ✅ — checkout/POS/quickBuy đều check `isAvailable` + `publishStatus` | OK |
| Variant `quantity_on_hand` âm | DB CHECK chặn | ✅ V50 | **Service-level check chỉ chặn negative result, không chặn lost-update** — race vẫn có thể overwrite với giá trị hợp lệ (P0 #1) |

---

## 9. Concurrency & Transaction Audit

| Flow | `@Transactional` | Pessimistic lock | `@Version` | Idempotency | Verdict |
|---|---|---|---|---|---|
| `AdminInventoryService.adjustStock` | ✅ ([line 162](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminInventoryService.java#L162)) | ❌ **dùng `findById` không lock** | ❌ Variant không có `@Version` | ❌ | **P0 — Lost update race confirmed** |
| `CheckoutService.checkoutFromCart` | ✅ ([line 152](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java#L152)) | ✅ `findByIdForUpdate` cho variant + product (line 798, 805, 852, 855) | n/a | ✅ `Idempotency-Key` table-backed (line 448-495) | OK |
| `CheckoutService.quickBuy` | ✅ | ✅ (line 288, 296) | n/a | ✅ | OK |
| `PosOrderService.createOrder` | ✅ | ✅ (line 161, 169, 363) | n/a | ✅ `posIdempotencyKey` + flush + DataIntegrityViolation handling | OK |
| `AdminOrderService.updateOrderStatus` | ✅ ([line 231](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java#L231)) | ✅ trong restoreStockForOrder dùng `findByIdForUpdate` (line 556, 574) | ✅ V67 trên `orders` | unique idx ORDER_CANCEL | OK |
| `AdminOrderService.createRefund` → `RefundService.applyRefund` | ✅ | ❌ không lock variant — không restore stock luôn | ✅ V67 trên `orders` | n/a | **P0 #2 — không restore** |
| `AdminReturnService.updateStatus` → `restoreStockForReturn` | ✅ ([line 133](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminReturnService.java#L133)) | ✅ findByIdForUpdate (line 220) | ✅ V67 trên `returns` | n/a (state machine + version) | OK — nhưng không có DB unique guard cho RETURN reference (P1 #3) |

### Specific scenario: 2 admin đồng thời stock-in cùng variant

1. Cả 2 transactions: `findById(variant)` → cùng `quantityOnHand = 10`.
2. T1: `setQuantityOnHand(15)` (+5).
3. T2: `setQuantityOnHand(15)` (+5) — đáng ra phải là 20.
4. Cả 2 commit → DB còn `15`.
5. Movement records: 2 rows ghi `before=10, after=15` cho 2 transactions khác nhau — ledger inconsistent.

DB CHECK `quantity_on_hand >= 0` không cứu được vì không phải case âm.

JPA optimistic lock không có vì entity thiếu `@Version`. Pessimistic lock có sẵn (`findByIdForUpdate`) nhưng service không dùng.

→ **P0 confirmed**.

### Restore double-call scenarios

- **Order CANCEL → CANCELLED → CANCELLED race**: state machine `CANCELLED → {}` block; nếu race trước khi commit, V67 `@Version` block; thêm unique idx `ORDER_CANCEL` block ở DB. ✅ 3-tầng bảo vệ.
- **Order COMPLETED → REFUNDED qua `updateOrderStatus`**: tương tự, dùng `ORDER_CANCEL` reference type. ✅
- **Order COMPLETED → REFUNDED qua `applyRefund`**: KHÔNG restore stock. ❌ P0 #2.
- **Return RECEIVED → COMPLETED → restore lần 1; sau đó RECEIVED → REFUNDED không thể vì đang ở COMPLETED**. Transition `COMPLETED → x` không có. ✅ state machine bảo vệ.
- **Return RECEIVED → COMPLETED và RECEIVED → REFUNDED race**: V67 `@Version` block một trong hai. ✅ nhưng chỉ 1 tầng (không có DB unique guard cho RETURN).

### Oversell

- Web checkout: pessimistic lock variant + product, kiểm `quantityOnHand < req.quantity` trong cùng transaction → ✅ không oversell.
- POS: tương tự.
- Manual adjust OUT: lock thiếu (P0 #1) — race với checkout có thể oversell? Service-level check `after < 0` block. DB CHECK block. Nhưng race với checkout có thể có:
  - Admin adjust OUT -3 và checkout -2 cùng lúc, qty trước = 4.
  - Admin: lock variant qua `findById` không có lock → đọc qty=4, trừ 3 = 1.
  - Checkout: `findByIdForUpdate` lock — sẽ wait nếu admin transaction đang giữ row.
  - Vì admin không lock, checkout vẫn lock được → checkout đọc qty=4, trừ 2=2. Hoặc tuỳ thứ tự commit, qty cuối là 1 hoặc 2 (tùy ai commit sau).
  - Lost update tiềm tàng giữa admin OUT và checkout OUT.

---

## 10. Serial Tracking Audit

### Trạng thái hiện tại

Serial trong BigBike **không phải** lifecycle unit. Đây chỉ là **log đính kèm vào stock_movement** ghi nhận "tại thời điểm IN này có những serial này".

### Bằng chứng

- `stock_movement_serials` ([V57](bigbike-backend/src/main/resources/db/migration/V57__add_stock_movement_serials.sql)) chỉ có 4 column: `id`, `stock_movement_id` (FK), `serial_number`, `created_at`. Không có `status`, không có `current_owner`, không có `sold_at`/`returned_at`.
- `StockMovementSerialEntity` ([file](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/entity/catalog/StockMovementSerialEntity.java)) phản ánh y nguyên schema — không có lifecycle fields.
- `AdminInventoryService.adjustStock` chỉ lưu serial khi tạo movement IN. Không có code nào "mark serial as SOLD" khi checkout/POS bán hàng.
- Khi cancel order hoặc return → `restoreStockForOrder/restoreStockForReturn` ghi 1 movement IN với reference_type=`ORDER_CANCEL` hoặc `RETURN` — **không** đính serial nào (logic không yêu cầu).
- `product_serials` — bảng lifecycle thực sự — đã bị V54 xóa.

### Khả năng truy vấn hiện tại

| Câu hỏi | Trả lời được? |
|---|---|
| Lô hàng nhập ngày X có những serial nào? | ✅ — query `stock_movement_serials` join `stock_movements` |
| Serial XYZ đã được nhập bao giờ chưa? | ✅ — UNIQUE(serial_number) trong stock_movement_serials |
| Serial XYZ hiện đang còn trong kho hay đã bán? | ❌ — không có lifecycle |
| Khách hàng A đã mua serial nào? | ❌ — không có link order_line_item ↔ serial |
| Serial XYZ có bị return không? | ❌ — không có |
| Tồn kho thực tế N có khớp với count IN_STOCK serials không? | ❌ — không thể compute count vì không có status |

### Cross-table không unique

- `stock_movement_serials.serial_number` UNIQUE (V57)
- `stock_receipt_serials.serial_number` UNIQUE (V55) — bảng orphan, hiện không có code ghi
- **Không có constraint cross-table** → một serial có thể tồn tại cả 2 bảng nếu sau này ai đó implement stock-receipt path

### Gap nếu BigBike cần track số khung/số máy/số serial thực tế

Theo nghiệp vụ xe máy, mỗi xe phải có:
- Số khung (chassis number)
- Số máy (engine number)
- Có thể thêm IMEI/VIN cho phụ kiện điện tử

Nếu cần:
1. Một xe = 1 unit physical = phải có lifecycle (RESERVED/SOLD/RETURNED).
2. Khi customer mua xe, cần biết "xe này serial nào".
3. Khi bảo hành, cần lookup "khách hàng nào đang sở hữu serial X".
4. Khi return, cần verify serial trả về có khớp serial bán đi không.

→ Hiện **không có tính năng nào** trong số trên. Module Inventory phù hợp với case "đếm số lượng kho generic" (helmet, áo giáp), KHÔNG phù hợp với xe máy nguyên chiếc.

→ NEEDS_BUSINESS_DECISION: BigBike có cần serial lifecycle cho xe máy không? Nếu có, đây là project nhiều man-week để khôi phục lại logic V51 đã bị xóa.

---

## 11. FE-BE Contract Audit

| Endpoint | FE call | BE method | Query/body | Response | Mismatch |
|---|---|---|---|---|---|
| `GET /admin/inventory` | `fetchInventory({page, pageSize, q, stockState})` | `listStock(page, size, q, stockState)` | `pageSize` mapped → `size` | `PageResult` → `parseListPayload` | OK; `stockState='ALL'` chuyển thành undefined |
| `GET /admin/inventory/summary` | `fetchInventorySummary()` | `getSummary()` | — | `InventorySummaryResponse` | OK; FE catch any error → defaults |
| `GET /admin/inventory/movements` | `fetchAllMovements({page, pageSize, movementType, referenceType})` | `listAllMovements` | OK | `PageResult<StockMovementResponse>` | ⚠️ FE UI render `m.productName`/`m.variantName` (line 883-884 InventoryScreen) — **DTO không có** → empty cell |
| `GET /admin/inventory/export.csv` | `inventoryExportCsvUrl()` (anchor) | `exportCsv` | — | text/csv | ⚠️ Anchor download không gửi Bearer token → 401 trong production (P0 #4) |
| `GET /admin/inventory/variants/{id}/movements` | `fetchVariantMovements` | `listMovements` | OK | OK | FE unused — dead client code |
| `POST /admin/inventory/variants/{id}/adjust` | `adjustStock(variantId, qty, type, note, serials)` | `adjustStock` | body OK | `AdminStockItemResponse` | OK; FE chỉ dùng type `'IN'` |

### Locale keys

[InventoryScreen.jsx](bigbike-admin/src/screens/InventoryScreen.jsx) sử dụng nhiều `t('inventory.stockIn.*')` và `t('inventory.*')` keys. Không kiểm tra hết toàn bộ locale file ở đây (nằm ngoài scope strict). Một số keys có `defaultValue` fallback — phòng thiếu locale.

---

## 12. Test Coverage Audit

| Test file | Scenarios covered | Missing |
|---|---|---|
| `Phase1KInventorySerialApiTest.java` (8 cases) | IN with valid serials; serial count > qty; duplicate in request; serial in DB; rollback; missing serials; too few serials; serialCount in movement list | List inventory; summary; movement timeline filters; CSV export; permission denied; variant not found; OUT/ADJUSTMENT/RETURN cases; concurrent adjust; stock state recompute LOW_STOCK boundary |
| `Phase1FCheckoutApiTest.java` | Checkout flow (orders, prices) — chỉ tham chiếu `setStockQuantity` qua helper | **Không assert** stock decremented; không assert stock_movement record cho variant; không assert oversell rejected |
| `Phase1MPosApiTest.java` | POS create — assert decremented; oversell 409; idempotency; **stock_movement created** (line 367-381) | Không test movementType là `SALE`; không test concurrent POS |
| `Phase1HAdminOrderApiTest.java` | Cancel restore variant qty; cancel writes `ORDER_CANCEL` movement; product-level restore | **Không** test refund-via-`createRefund` restore stock (sẽ fail vì P0 #2); không test double-cancel race |
| `Phase1LReturnsApiTest.java` | Return RECEIVED → COMPLETED restore qty; RECEIVED → REFUNDED restore + refund | Không test concurrent updateStatus race; không test serial linkage (n/a vì không có) |

### Missing tests, phân loại

| Severity | Test gap |
|---|---|
| **P0** | Concurrent `adjustStock` lost-update test (sẽ fail); refund-via-`createRefund` không restore stock test (sẽ fail) |
| **P1** | Movement type alignment: assert checkout writes `OUT`, POS writes `SALE`, return writes `IN`/`RETURN`, cancel writes `IN`/`ORDER_CANCEL`; CSV export auth test (sẽ fail từ FE); cross-table serial uniqueness; Refund applyRefund vs updateOrderStatus consistency |
| **P1** | List inventory pagination/filter; summary count accuracy; movement timeline filter; permission denied (403 cho user không có `products.read`/`products.update`); variant not found (404) |
| **P2** | UI E2E inventory; CSV export download in browser; serial file import edge cases; Excel parsing |

### Test coverage estimate

- Inventory module-internal logic: ~30% (chỉ adjust+serial)
- Cross-module side effects: ~50% (cancel/return restore có; checkout không assert)
- E2E (UI → API → DB): 0%

---

## 13. Findings

### P0 — Blocker

#### P0 #1 — `AdminInventoryService.adjustStock` không pessimistic-lock variant → lost update race

- **Title**: Manual stock adjust race condition (lost update)
- **Evidence**: [AdminInventoryService.java:163-244](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminInventoryService.java#L163) — dùng `variantRepo.findById(variantId)` (line 164) thay vì `findByIdForUpdate`. `ProductVariantEntity` không có `@Version`. `ProductVariantJpaRepository.findByIdForUpdate` đã được implement (line 23-25) nhưng không được service này gọi.
- **Impact**: Hai admin đồng thời nhập kho cùng variant → một bên ghi mất. Stock inventory đếm sai. Ledger `stock_movements` ghi 2 dòng mâu thuẫn: cả 2 dòng đều `before=X`, `after=X+delta`, mà thực tế cả 2 đã commit → variant bị "ăn cắp" stock. Đặc biệt nguy hiểm cho OUT (xuất kho gấp) gây oversell ngầm.
- **Recommended fix**: Thay `findById` → `findByIdForUpdate` trong `adjustStock`. Hoặc thêm `@Version` cho `ProductVariantEntity` để JPA optimistic lock + retry.
- **Files to change**: `AdminInventoryService.java:164`; (option 2) `ProductVariantEntity.java` thêm `@Version private long version;`.
- **Suggested tests**: Concurrent test 2 thread cùng adjust +5 trên cùng variant (qty trước = 0). Sau commit, expect qty = 10, expect 2 movement rows hợp lệ. Hiện tại sẽ fail (qty = 5).

#### P0 #2 — `RefundService.applyRefund` không restore stock khi full refund

- **Title**: Refund-flow inconsistency — stock không được khôi phục khi admin gọi `POST /admin/orders/{id}/refund`
- **Evidence**: [RefundService.java:99-115](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/payment/RefundService.java#L99) — set `paymentStatus = REFUNDED` và `status = REFUNDED` (nếu full refund) nhưng **không** call `restoreStockForOrder`. So sánh với [AdminOrderService.updateOrderStatus:269-271](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java#L269) — path này có gọi restore.
- **Impact**: Tùy admin chọn flow nào để refund:
  - PATCH `/admin/orders/{id}/status` body `{status: REFUNDED}` → stock được khôi phục.
  - POST `/admin/orders/{id}/refund` body `{refundAmount: X}` → stock **KHÔNG** khôi phục.
  Kết quả là kho ảo trở thành 0 dù hàng đã trả về.
- **Recommended fix**: Trong `RefundService.applyRefund`, khi `fullRefund == true` và `order.status` chuyển sang `REFUNDED`, gọi callback restore stock (DI một `OrderStockRestorer` interface, hoặc move logic restore vào RefundService chia sẻ). Phải dùng partial unique index `ORDER_CANCEL` để tránh double-restore nếu admin xài cả 2 path.
- **Files to change**: `RefundService.java`; có thể tách `restoreStockForOrder` từ `AdminOrderService` thành service riêng để RefundService dùng chung. Đảm bảo ORDER_CANCEL unique index không bị vi phạm.
- **Suggested tests**: Tạo order COMPLETED, gọi POST `/admin/orders/{id}/refund` full amount, assert variant `quantity_on_hand` tăng và movement `ORDER_CANCEL` ghi 1 row.

#### P0 #3 — Product-level decrement không ghi `stock_movements` → mất audit trail

- **Title**: Stock movement ledger gap cho product không variant
- **Evidence**: 
  - [CheckoutService.decrementStockForCartItems:847-868](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java#L847) — fallback path khi `productVariantId == null` chỉ update `product.stockQuantity`, không insert `stock_movements`.
  - [CheckoutService.quickBuy:349-359](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java#L349) — tương tự cho quick-buy.
  - [AdminOrderService.restoreStockForOrder:573-590](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java#L573) — fallback restore product-level cũng không ghi movement.
- **Impact**: Nếu DB tồn tại product không variant (qua import WordPress, qua admin tạo product trong tương lai), kho của product đó:
  - không hiển thị trong Inventory screen (chỉ list variant).
  - thay đổi không có audit trail.
  - Không tracking được ai bán, ai cancel, ai return.
- **Recommended fix**:
  - Option A (quy chuẩn): bắt buộc product phải có variant. Migration backfill: tạo "default variant" cho mọi product không variant. Sau đó remove fallback path.
  - Option B (tạm): mở rộng `StockMovementEntity` thêm column `product_id` (nullable) song song với `product_variant_id`, ghi movement cho product-level decrement với reference_type=`ORDER` cùng cách variant. Inventory screen UI cũng phải show product-only rows.
- **Files to change**: Migration mới + `CheckoutService.java:856-866` + `AdminOrderService.java:574-590`.
- **Suggested tests**: Test product không variant, checkout, assert `stock_movements` có row.

#### P0 #4 — CSV export endpoint broken trong production

- **Title**: `inventoryExportCsvUrl()` dùng anchor download không gửi Authorization header
- **Evidence**: 
  - [InventoryScreen.jsx:1038-1040](bigbike-admin/src/screens/InventoryScreen.jsx#L1038) — `<a href={inventoryExportCsvUrl()} className="btn btn-secondary" download>`.
  - [adminApi.js:1717-1719](bigbike-admin/src/lib/adminApi.js#L1717) — return `${API_BASE}/admin/inventory/export.csv`.
  - [AdminInventoryController.java:75](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminInventoryController.java#L75) — `requirePermission(request, "products.read")` — đọc JWT từ SecurityContext. Browser anchor request **không** gửi `Authorization: Bearer ...` header.
- **Impact**: Click "Xuất CSV" trong production:
  - Nếu BE auth thuần JWT (không session cookie) → 401 / redirect login.
  - Trong dev/mock có thể chạy được nếu profile cho phép bypass.
- **Recommended fix**:
  - Option A: BE expose endpoint trả về signed URL hoặc one-time token; FE GET URL đó.
  - Option B: FE fetch CSV qua `requestJson` (đã có Bearer), chuyển response thành Blob rồi trigger download.
  - Option C: BE chấp nhận JWT qua query param `?token=...` cho endpoint này (kém security — trừ khi short-lived token).
- **Files to change**: `adminApi.js` thêm `downloadInventoryCsv()` — fetch + Blob; `InventoryScreen.jsx:1038-1041` thay anchor → button onClick.
- **Suggested tests**: Manual test trong production-like env. Unit test FE: gọi `downloadInventoryCsv` không lỗi 401.

#### P0 #5 — Orphan schema: `stock_receipts*` không có code Java

- **Title**: V52/V53/V55 tạo 3 bảng nhưng không có entity/repo/service/controller — dead schema
- **Evidence**:
  - Migrations: [V52](bigbike-backend/src/main/resources/db/migration/V52__add_stock_receipts.sql), [V53](bigbike-backend/src/main/resources/db/migration/V53__add_stock_receipt_lines.sql), [V55](bigbike-backend/src/main/resources/db/migration/V55__add_receipt_serials.sql).
  - Glob `bigbike-backend/src/main/java/**/StockReceipt*.java` → không kết quả.
  - `grep StockReceipt` trong toàn bộ source Java → không kết quả.
- **Impact**:
  - Dev mới sẽ confused vì nghĩ feature đã được làm, nhưng thực ra chỉ có schema.
  - Postgres maintenance overhead (index, vacuum) cho 3 bảng không dùng.
  - Có thể là chuẩn bị cho feature "Phiếu nhập kho" sắp có nhưng chưa hoàn thành — nếu vậy phải hoặc finish hoặc rollback schema.
  - DB schema không phản ánh thực tế của hệ thống — **vi phạm Docs-First Contract** (CLAUDE.md / AGENTS.md).
- **Recommended fix**:
  - Option A (làm tiếp): Implement `StockReceiptEntity`, repository, `StockReceiptService`, `AdminStockReceiptController`, FE screen "Phiếu nhập kho". Phải migrate `stock_movement_serials` flow để khi nhập kho ghi cả receipt + lines + serials. Đây là module "Goods Receiving" thực thụ — vài tuần work.
  - Option B (rollback): Tạo migration mới drop 3 bảng + indexes. An toàn vì không có code dùng.
  - Option C (tạm): Để nguyên nhưng document rõ trong `docs/engineering/DATA_CONTRACT.md` rằng đây là "reserved schema, not yet wired".
- **Files to change**: Quyết định business-decision; viết migration drop hoặc implement đầy đủ.
- **Suggested tests**: n/a (rollback) hoặc full E2E (implement).

### P1 — High

#### P1 #1 — Movement type không thống nhất (POS=`SALE` vs Web=`OUT`)

- **Title**: POS dùng movementType `SALE`, Web checkout dùng `OUT` → không thể aggregate đồng nhất
- **Evidence**: 
  - [PosOrderService.decrementStock:374](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/pos/PosOrderService.java#L374) — `mv.setMovementType("SALE")`.
  - [CheckoutService.decrementVariantStock:879](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java#L879) — `movement.setMovementType("OUT")`.
  - [AdminInventoryService.ALLOWED_TYPES:39](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminInventoryService.java#L39) — chỉ có `IN/OUT/ADJUSTMENT/RETURN`.
  - [InventoryScreen.jsx:832](bigbike-admin/src/screens/InventoryScreen.jsx#L832) — FE filter dropdown chỉ có `[IN, OUT, RETURN]`.
- **Impact**: Báo cáo "tổng xuất bán" phải union 2 type. Filter FE không thấy POS sales. Mâu thuẫn ngầm giữa 2 channel sales.
- **Recommended fix**: Chuẩn hoá type. Hoặc:
  - Đổi POS dùng `OUT` cho consistency, dùng `referenceType` để phân biệt (POS đã có `note=POS_SALE`).
  - Hoặc thêm `SALE` vào FE dropdown + ALLOWED_TYPES + viết migration backfill.
- **Files to change**: `PosOrderService.java:374` (đổi sang OUT) hoặc `AdminInventoryService.ALLOWED_TYPES` + FE dropdown.
- **Suggested tests**: Assert checkout vs POS movement type bằng nhau.

#### P1 #2 — FE render `m.productName`/`m.variantName` nhưng DTO không có

- **Title**: Movement timeline luôn hiển thị product/variant trống
- **Evidence**:
  - [InventoryScreen.jsx:883-884](bigbike-admin/src/screens/InventoryScreen.jsx#L883) — `{m.productName || '—'}` + `{m.variantName && ...}`.
  - [adminApi.js:1702-1715](bigbike-admin/src/lib/adminApi.js#L1702) — `normalizeMovement` không pass through productName/variantName.
  - [StockMovementResponse.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/inventory/StockMovementResponse.java) — record chỉ có 9 fields, **không có** product/variant name.
  - Service [searchMovements](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/catalog/StockMovementJpaRepository.java#L20) JOIN FETCH variant + product nhưng `toMovementResponse` không map.
- **Impact**: User mở tab "Lịch sử biến động" thấy cột "Sản phẩm / Variant" luôn trống `—` → tab vô dụng.
- **Recommended fix**: 
  1. Thêm `productName`, `productSku`, `variantName`, `variantSku` vào `StockMovementResponse`.
  2. `toMovementResponse` map từ `m.getVariant().getProduct().getName()` etc.
  3. `normalizeMovement` pass through.
- **Files to change**: `StockMovementResponse.java`, `AdminInventoryService.toMovementResponse`, `adminApi.js:normalizeMovement`.
- **Suggested tests**: GET `/admin/inventory/movements` assert response có productName/variantName.

#### P1 #3 — Không có DB unique guard cho `RETURN` reference_type

- **Title**: Double-restore từ Returns chỉ phụ thuộc state machine + V67 `@Version`, không có DB safety net
- **Evidence**: V50 chỉ tạo unique partial index `WHERE reference_type='ORDER_CANCEL'`. RETURN không có.
- **Impact**: Nếu state machine ở Service-level có bug (ví dụ ai đó thêm transition COMPLETED → REFUNDED cho returns trong tương lai) → có thể double-restore. Defense in depth thiếu.
- **Recommended fix**: Thêm migration `V68__return_unique_index.sql` tạo `CREATE UNIQUE INDEX idx_stock_movements_return_unique ON stock_movements (product_variant_id, reference_id) WHERE reference_type='RETURN';`
- **Files to change**: migration mới.
- **Suggested tests**: Test attempt insert 2 movement RETURN với cùng variant + return_id → DB raise constraint violation.

#### P1 #4 — Data drift `products.stock_quantity` ↔ `product_variants.quantity_on_hand`

- **Title**: Hai source of truth cho stock — Inventory module chỉ thấy variant
- **Evidence**: 
  - [V10:6](bigbike-backend/src/main/resources/db/migration/V10__add_product_legacy_inventory_columns.sql#L6) — `products.stock_quantity` integer.
  - [V30:11-19](bigbike-backend/src/main/resources/db/migration/V30__add_inventory_tracking.sql#L11) — backfill variants từ products.stock_quantity.
  - [CheckoutService.java:855-866, 313-316, 824-829](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java#L855) — vẫn fallback decrement product nếu không có variant.
  - [AdminInventoryService.searchStock](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/catalog/ProductVariantJpaRepository.java#L29) — chỉ list variants.
- **Impact**: Stock thực sự là tổng của (variants) + (product không variant). Inventory screen thiếu phần thứ 2. Báo cáo sai.
- **Recommended fix**: Như P0 #3 — bắt buộc mỗi product phải có ít nhất 1 variant. Migration backfill variant default cho product không variant. Bỏ fallback path.
- **Files to change**: migration backfill; xóa fallback trong CheckoutService + AdminOrderService; depercate `products.stock_quantity` (giữ column nhưng read-only / drop sau).
- **Suggested tests**: Migration test verify mọi product có ≥1 variant.

#### P1 #5 — Cross-table serial uniqueness chưa enforce

- **Title**: Cùng serial có thể tồn tại cả `stock_movement_serials` và `stock_receipt_serials`
- **Evidence**: 
  - V55 UNIQUE chỉ trong `stock_receipt_serials`.
  - V57 UNIQUE chỉ trong `stock_movement_serials`.
  - Không có constraint chéo bảng.
  - `findExistingSerialNumbers` ([StockMovementSerialJpaRepository.java:14](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/persistence/repository/catalog/StockMovementSerialJpaRepository.java#L14)) chỉ query 1 bảng.
- **Impact**: Hiện tại chỉ `stock_movement_serials` có code dùng → không gặp issue ngay. Nhưng nếu sau này wire `stock_receipts*` (xem P0 #5) thì cùng 1 số khung có thể nhập 2 lần. Vi phạm bất biến nghiệp vụ "1 serial = 1 unit physical".
- **Recommended fix**: Cùng với P0 #5, gộp logic về 1 bảng serial canonical hoặc add cross-table check trong service layer.
- **Files to change**: tùy hướng giải pháp P0 #5.
- **Suggested tests**: n/a until P0 #5 resolved.

#### P1 #6 — Test coverage rất mỏng cho Inventory module

- **Title**: Chỉ 8 test cases (toàn bộ là serial-only). Thiếu test cho list/summary/CSV/permission/concurrent
- **Evidence**: `Phase1KInventorySerialApiTest.java` 8 cases. Không có file test khác cho inventory.
- **Impact**: Regression risk cao. Nếu refactor `searchStock` hoặc `listAllMovements` sẽ không phát hiện bug.
- **Recommended fix**: Thêm `Phase1KInventoryListApiTest.java`:
  - List inventory: page/size/q/stockState filter
  - Summary count accuracy
  - Movement timeline filter movementType + referenceType
  - CSV export response (Content-Disposition, content)
  - 403 cho user không có `products.read`/`products.update`
  - 404 variant không tồn tại
  - OUT/ADJUSTMENT/RETURN bằng adjust + assertion BELOW_ZERO
  - LOW_STOCK boundary recompute
- **Files to change**: tạo test mới.

### P2 — Medium/Low

#### P2 #1 — Per-variant movement detail UI không tồn tại

- **Title**: API `GET /admin/inventory/variants/{id}/movements` không được FE dùng
- **Evidence**: [adminApi.js:1695-1700](bigbike-admin/src/lib/adminApi.js#L1695) — `fetchVariantMovements` defined nhưng không được import/dùng ở `InventoryScreen.jsx`.
- **Impact**: Admin muốn xem lịch sử của 1 variant cụ thể không có UI.
- **Fix**: Thêm row click → modal/drawer hiển thị `fetchVariantMovements`.

#### P2 #2 — FE filter dropdown thiếu type

- **Title**: `MV_TYPE_OPTIONS = ['', 'IN', 'OUT', 'RETURN']` thiếu `ADJUSTMENT`, `SALE`. `REF_TYPE_OPTIONS = ['', 'ORDER', 'ORDER_CANCEL', 'RETURN', 'MANUAL']` thiếu `RECEIPT` (nhưng RECEIPT chưa dùng).
- **Evidence**: [InventoryScreen.jsx:832-833](bigbike-admin/src/screens/InventoryScreen.jsx#L832).
- **Impact**: Filter không thấy POS sales (`SALE`) và admin adjustments.
- **Fix**: Cùng với P1 #1 chuẩn hoá movement types, đồng bộ lại dropdown.

#### P2 #3 — `exportCsv` không có ORDER BY id stable

- **Title**: Pagination trên CSV chunk dùng order `p.name ASC, v.name ASC` — không guarantee stable
- **Evidence**: [AdminInventoryService.exportCsv:144](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminInventoryService.java#L144) — `searchStock("", null, PageRequest.of(page, CSV_CHUNK_SIZE))` dùng order trong query là `p.name ASC, v.name ASC`. Nếu tên trùng, thứ tự rows có thể khác giữa 2 page → có thể bỏ sót/duplicate.
- **Impact**: Edge case rare nhưng có (nhiều product tên giống y hệt).
- **Fix**: Thêm tie-breaker `p.id ASC, v.id ASC` trong searchStock query.

#### P2 #4 — `PREORDER`/`CONTACT_FOR_STOCK` enum vẫn còn

- **Title**: V56 đã migrate dữ liệu PREORDER → OUT_OF_STOCK, nhưng enum Java vẫn còn 5 giá trị
- **Evidence**: [ProductStockState.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/domain/catalog/ProductStockState.java) có `PREORDER`, `CONTACT_FOR_STOCK`. [InventoryPolicyService.java:39-41](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/InventoryPolicyService.java#L39) skip recompute khi state là 2 giá trị này.
- **Impact**: Admin có thể tạo product/variant với stockState PREORDER lần nữa qua admin catalog. Recompute sẽ skip → bug logic kho có thể quay lại.
- **Fix**: Hoặc remove khỏi enum + DB CHECK constraint, hoặc support đầy đủ feature PREORDER với UI.

#### P2 #5 — `note` length không validate

- **Title**: `AdjustStockRequest.note` không có giới hạn độ dài
- **Evidence**: [AdjustStockRequest.java](bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/dto/inventory/AdjustStockRequest.java) — `String note` không có `@Size`. DB column `note` là `text` không giới hạn.
- **Impact**: Admin gửi 100MB note → DB nuốt + slow response.
- **Fix**: `@Size(max=2000)` hoặc tương tự.

#### P2 #6 — FE picker pageSize hard-coded 8

- **Title**: `StockInModal` variant picker chỉ load 8 items
- **Evidence**: [InventoryScreen.jsx:539](bigbike-admin/src/screens/InventoryScreen.jsx#L539) — `pageSize: 8`.
- **Impact**: Admin có 1000+ variants không thể scroll list. Phải gõ search. UX kém.
- **Fix**: Tăng pageSize hoặc paginate trong picker.

---

## 14. Recommended Implementation Plan

### Phase 1 — Fix P0 (Bắt buộc trước production)

- [ ] **Fix #1**: `AdminInventoryService.adjustStock` chuyển `findById` → `findByIdForUpdate`. Thêm test concurrent adjust 2 thread.
- [ ] **Fix #2**: `RefundService.applyRefund` gọi restore stock khi full refund. Tách `OrderStockRestorerService` để 2 service dùng chung. Add test refund-via-createRefund restore stock.
- [ ] **Fix #3**: Quyết định Option A (bắt buộc variant) hoặc Option B (track product-level movement). Migration backfill default variant + remove fallback path nếu A; Mở rộng `stock_movements` schema nếu B.
- [ ] **Fix #4**: FE `downloadInventoryCsv()` dùng fetch + Blob thay vì anchor. Verify trong production-like env.
- [ ] **Fix #5**: Quyết định business: implement đầy đủ "Phiếu nhập kho" hoặc rollback schema. Document trong DATA_CONTRACT.md.

### Phase 2 — Complete missing behavior (P1)

- [ ] **#1**: Chuẩn hoá movementType giữa POS và Web. Thêm migration backfill nếu cần.
- [ ] **#2**: Mở rộng `StockMovementResponse` thêm productName/variantName/sku, cập nhật `normalizeMovement` FE.
- [ ] **#3**: Migration thêm unique partial index cho `RETURN` reference_type.
- [ ] **#4**: Bắt buộc mọi product có variant (cùng với #3 phase 1).
- [ ] **#5**: Cross-table serial uniqueness (cùng với #5 phase 1).
- [ ] **#6**: Tạo `Phase1KInventoryListApiTest`, `Phase1KInventoryPermissionTest`, `Phase1KInventoryConcurrentTest`.

### Phase 3 — Improve test coverage

- [ ] Backend integration tests cho mọi inventory endpoint (≥30 cases).
- [ ] Cross-module assertions: checkout/POS/cancel/return write đúng movement type.
- [ ] FE component tests cho `StockInModal` (validate, serial parse, file import).
- [ ] FE E2E (Playwright/Cypress): tab switch, filter, adjust submit, CSV download.

### Phase 4 — Refactor / cleanup

- [ ] **P2 #1**: FE per-variant movement timeline drill-down.
- [ ] **P2 #2**: FE filter dropdown chuẩn hoá.
- [ ] **P2 #3**: `exportCsv` add `id ASC` tie-breaker.
- [ ] **P2 #4**: Remove `PREORDER/CONTACT_FOR_STOCK` enum hoặc implement đầy đủ.
- [ ] **P2 #5**: `@Size(max=2000)` cho `note`.
- [ ] **P2 #6**: Picker pagination trong `StockInModal`.
- [ ] Add OUT/ADJUSTMENT/RETURN movement form trong UI.
- [ ] Cập nhật `docs/business/BUSINESS_RULES.md` với INVENTORY_RULE_005..N (refund restore, manual adjust race protection).
- [ ] Cập nhật `docs/engineering/DATA_CONTRACT.md` với serial tracking model rõ ràng (per-movement log, không phải lifecycle).

---

## 15. Final Verdict

### Module đã hoàn thiện chưa?

**Chưa.** Có 5 P0 issues đang gây nguy hiểm trực tiếp đến tiền/kho:
1. Manual adjust race lost-update.
2. Refund flow inconsistency (stock không restore).
3. Product-level decrement không có audit trail.
4. CSV export broken trong production.
5. Orphan schema dead.

### Có được phép cho AI agent implement tiếp module khác chưa?

**Không khuyến nghị.** Inventory là module foundation cho hầu hết flow tiền/kho (checkout, POS, return, refund). Nếu để P0 lại, mọi module phụ thuộc sẽ kế thừa risk.

Đặc biệt:
- Implement module Reports trên kho hiện tại sẽ ra số sai (vì lost-update, vì product-only invisible, vì refund không restore).
- Implement module Receipts sắp tới sẽ chạm phải orphan schema.

### Có cần fix Inventory trước không?

**Bắt buộc fix tối thiểu P0 #1, #2, #4 trước.** P0 #3 và #5 có thể chấp nhận tạm nếu:
- Confirm DB hiện tại không có product nào không có variant (run query verify).
- Confirm nghiệp vụ không xài "Phiếu nhập kho" trong sprint hiện tại.

### Demo / Internal use

**Chấp nhận được**, với caveat:
- Không cho 2 admin cùng làm việc đồng thời trên cùng 1 variant.
- Không dùng POST `/admin/orders/{id}/refund` full-amount — chỉ dùng PATCH `/admin/orders/{id}/status`.
- Không export CSV qua UI (gọi trực tiếp endpoint với cURL + Bearer).
- Document những hạn chế này trong README của bản demo.

### Production thật

**KHÔNG release** trừ khi đã fix toàn bộ P0 + ít nhất P1 #1, #2, #6.

Sau khi fix P0:
- Score Concurrency: 40 → 80
- Score Business logic: 60 → 85
- Score DB integrity: 75 → 85
- Score FE-BE contract: 60 → 80
- Score Test coverage: 40 → 65
- Tổng: 62 → ~80 → tiến gần `READY_WITH_MINOR_FIXES`

### Score per area

| Area | Score 0-100 | Lý do |
|---|---:|---|
| Backend API completeness | 80 | 6 endpoints đủ; pagination/filter chuẩn; nhưng N+1 trên `serialCount`, `movementType` không thống nhất |
| Business logic correctness | 60 | Lost update P0 + refund không restore P0 + product-fallback không ghi movement P0 |
| DB integrity | 75 | CHECK ≥0 OK; ORDER_CANCEL unique OK; thiếu RETURN unique; orphan schema; serial cross-table không unique |
| Concurrency safety | 40 | adjustStock không lock — P0; những flow khác có lock |
| Permission/RBAC | 90 | FE/BE đồng bộ products.read/update; chỉ thiếu inventory-specific permission (tech debt) |
| FE screen completeness | 65 | List/summary/movements/stock-in OK; thiếu OUT/ADJUSTMENT UI; thiếu per-variant drill; CSV broken trong prod |
| FE-BE contract consistency | 60 | productName/variantName mismatch + CSV anchor; còn lại OK |
| Validation | 75 | Serial flow chặt; thiếu length validate; thiếu cross-table |
| Test coverage | 40 | Chỉ 8 test cho serial; không có test cho list/summary/CSV/concurrent/permission |
| Documentation consistency | 70 | Docs cite rule rõ; thiếu mention orphan schema; serial lifecycle marked NEEDS_VERIFICATION từ trước |

**Tổng trung bình: ~62/100 — `NOT_READY_NEEDS_FIXES`.**

---

> **Quan trọng**: Audit này chỉ đọc code, không sửa. Mọi finding cần verify với business stakeholder trước khi fix — đặc biệt P0 #5 (Phiếu nhập kho) và P1 #4 (data drift product/variant) là quyết định nghiệp vụ, không chỉ technical.
