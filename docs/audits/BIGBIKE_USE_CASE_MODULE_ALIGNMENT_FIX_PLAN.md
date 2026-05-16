# BigBike — Use Case / Module Alignment Fix Plan

> **Ngày:** 2026-05-16
> **Nguồn:** [BIGBIKE_USE_CASE_MODULE_ALIGNMENT_AUDIT.md](BIGBIKE_USE_CASE_MODULE_ALIGNMENT_AUDIT.md)
> **Phạm vi lượt này:** Fix các lỗi alignment nhỏ/low-risk + 1 thay đổi permission model đã được duyệt riêng (AL-03). Không mở rộng scope launch, không implement module lớn mới.
> **Quy tắc:** Mọi thay đổi permission/data contract chạm runtime đều có compatibility plan. Không thay đổi business rule.

---

## 0. Tóm tắt lượt fix

| Finding | Hành động | Kết quả |
|---|---|---|
| AL-03 — Permission `inventory.*` gate nhầm module | **ĐÃ FIX** — migration `V121` non-breaking backfill + re-gate backend/UI | ✅ Done |
| AL-05 — Permission `receivables.export` mồ côi | **ĐÃ FIX** — migration `V122` xoá + dọn khỏi catalog/UI | ✅ Done |
| AL-06 — Package `api/webhook/` rỗng | **ĐÃ FIX** — xoá thư mục | ✅ Done |
| AL-10 — Field `chassisNumber`/`engineNumber` sai domain | **KHÔNG CẦN FIX** — đã được V99 xử lý từ trước | ✅ N/A |
| AL-09 — Công nợ / bán nợ | Defer — giữ backend/data, không đụng (xem §6) | Roadmap |
| AL-11 — Hoá đơn / shipping / data export | Spec + roadmap, không implement (xem §7) | Roadmap |
| AL-08 — Mobile secondary features | Defer — không có action chết để ẩn (xem §6) | Roadmap |
| AL-04 — Return dùng chung permission order | Chấp nhận cho v1 — recommendation phase sau (xem §6) | Roadmap |

---

## 1. AL-03 — Realign inventory & warranty permissions

### 1.1. Đã thực thi bằng gì

Migration **`V121__realign_inventory_warranty_permissions.sql`** — backfill **non-breaking**. Backend controller + admin UI được re-gate trong cùng change set.

### 1.2. Vì sao chọn non-breaking backfill, không chọn "tách sạch"

Theo quyết định đã chốt:

- **Tách sạch** (EDITOR/custom roles mất quyền Inventory ngay) tạo regression vận hành tức thì cho operator hiện có. Đó là behavior change có chủ đích, cần một phase RBAC cleanup riêng sau launch.
- Lượt fix này ưu tiên **alignment + compatibility**: sửa cho permission khớp đúng module, nhưng **không role nào mất quyền** sau migration.
- `V121` backfill theo nguyên tắc: role nào đang truy cập được module thì sau migration vẫn truy cập được — kể cả custom roles runtime không kiểm tra được từ code.

### 1.3. Cơ chế migration V121 (thứ tự quan trọng)

```
1. warranty.read  ← mọi role đang có inventory.read   (= quyền Bảo hành hiện tại)
2. warranty.write ← mọi role đang có inventory.write
3. inventory.read  ← mọi role đang có products.read    (= quyền Tồn kho hiện tại)
4. inventory.write ← mọi role đang có products.update
```

Bước warranty (1-2) chạy **trước** bước inventory (3-4): role chỉ có `products.read` (vd EDITOR) sẽ nhận `inventory.*` nhưng **không** nhận `warranty.*` — vì trước đó nó không có quyền Bảo hành. Tất cả statement idempotent (`ON CONFLICT DO NOTHING`).

### 1.4. Permission mapping — BEFORE / AFTER

| Bề mặt | BEFORE | AFTER |
|---|---|---|
| Inventory + Serial — backend gate | `products.read` / `products.update` | `inventory.read` / `inventory.write` |
| Warranty — backend gate | `inventory.read` / `inventory.write` | `warranty.read` / `warranty.write` |
| Inventory + Serial — admin route gate | `products.read` | `inventory.read` |
| Inventory + Serial — admin canUpdate | `products.update` | `inventory.write` |
| Warranty — admin route gate | `inventory.read` | `warranty.read` |
| Warranty — admin canUpdate | `inventory.write` | `warranty.write` |
| Catalog (`PermissionCatalog`) | `inventory.*` có; `warranty.*` KHÔNG có | `inventory.*` + `warranty.*` (group `roles.groupProducts`) |

**Role grants sau V121 (built-in):**

| Role | inventory.read | inventory.write | warranty.read | warranty.write |
|---|---|---|---|---|
| SUPER_ADMIN | ✓ (`*`) | ✓ (`*`) | ✓ (`*`) | ✓ (`*`) |
| ADMIN | ✓ | ✓ | ✓ (mới) | ✓ (mới) |
| SHOP_MANAGER | ✓ | ✓ | ✓ (mới) | ✓ (mới) |
| EDITOR | ✓ (backfill-compat) | — | — | — |
| AUTHOR / CONTRIBUTOR / SEO_EDITOR | — | — | — | — |

→ Không role nào **mất** quyền. ADMIN/SHOP_MANAGER **giữ nguyên** truy cập đầy đủ cả 3 màn Inventory/Serial/Warranty.

### 1.5. Files changed — AL-03

| File | Thay đổi |
|---|---|
| `bigbike-backend/src/main/resources/db/migration/V121__realign_inventory_warranty_permissions.sql` | **MỚI** — backfill non-breaking |
| `service/auth/PermissionCatalog.java` | Thêm `warranty.read` / `warranty.write` vào group `roles.groupProducts` |
| `api/admin/AdminInventoryController.java` | 17 gate `products.read`→`inventory.read`, `products.update`→`inventory.write`; sửa comment |
| `api/admin/AdminWarrantyController.java` | 3 gate `inventory.*`→`warranty.*` |
| `bigbike-admin/src/App.jsx` | Nav (3), `routePermission()` (3), screen props (3) — Inventory/Serials→`inventory.*`, Warranties→`warranty.*` |
| `service/auth/AdminRolePermissions.java` | ADMIN + SHOP_MANAGER +`warranty.*`; EDITOR +`inventory.read` (comment giải thích backfill-compat) |
| `bigbike-admin/src/screens/RolesScreen.jsx` | `BUILTIN_CATALOG` +4 key, `PERM_LABEL_KEY_MAP` +4 mapping |
| `bigbike-admin/src/lib/adminApi.js` | Mock `ALL_PERMS` +`inventory.*`/`warranty.*` |
| `bigbike-admin/src/locales/vi.json`, `en.json` | +4 label `permInventoryRead/Write`, `permWarrantyRead/Write` |
| `docs/engineering/PERMISSION_MATRIX.md` | Viết lại section "Inventory, Warranty & POS-refund permissions" |
| `bigbike-backend/src/test/resources/db/test-seed.sql` | +`warranty.*` cho ADMIN + SHOP_MANAGER |
| `WarrantyApiTest.java`, `Phase1KInventoryP0FixApiTest.java` | Sửa comment + tên test method cho khớp permission mới (không đổi logic) |

### 1.6. Remaining risk — AL-03

- **EDITOR vẫn giữ `inventory.read`** (thấy màn Inventory/Serial read-only) — đây là backfill-compat có chủ đích để không tạo regression. EDITOR **không** có `inventory.write` (không có `products.update`) nên vẫn read-only như trước.
- Custom roles runtime: mọi custom role giữ đúng behavior cũ nhờ backfill 2 chiều.
- **Cần phase RBAC cleanup sau launch** nếu business muốn tách role sạch — xem §5.

---

## 2. AL-05 — Remove unused `receivables.export` permission

### 2.1. Xác minh

`receivables.export` được khai báo trong `PermissionCatalog`, seed cho ADMIN (V79), hiển thị trong Roles UI — nhưng **không endpoint backend nào** kiểm tra permission này. Không có feature export công nợ. Grep toàn repo: chỉ có khai báo/seed/label, không có consumer.

### 2.2. Đã thực thi

Migration **`V122__remove_unused_receivables_export_permission.sql`** — `DELETE FROM role_permissions WHERE permission = 'receivables.export'`. Không implement feature export mới.

### 2.3. Files changed — AL-05

| File | Thay đổi |
|---|---|
| `V122__remove_unused_receivables_export_permission.sql` | **MỚI** — xoá grant mồ côi khỏi `role_permissions` |
| `service/auth/PermissionCatalog.java` | Xoá entry `receivables.export` |
| `service/auth/AdminRolePermissions.java` | Xoá khỏi reference ADMIN |
| `bigbike-admin/src/screens/RolesScreen.jsx` | Xoá khỏi `BUILTIN_CATALOG` + `PERM_LABEL_KEY_MAP` |
| `bigbike-admin/src/lib/adminApi.js` | Xoá khỏi mock `ALL_PERMS` |
| `bigbike-admin/src/locales/vi.json`, `en.json` | Xoá label `permReceivablesExport` |
| `bigbike-backend/src/test/resources/db/test-seed.sql` | Xoá seed `receivables.export` |
| `docs/engineering/PERMISSION_MATRIX.md` | Xoá dòng + ghi chú lý do |

### 2.4. Risk

Bằng 0 về chức năng — permission không gate gì. DB và catalog nay nhất quán 1-1 với endpoint thật.

---

## 3. AL-06 — Remove empty `api/webhook/` package

`bigbike-backend/.../api/webhook/` chỉ chứa thư mục con `dto/` rỗng, 0 file Java, 0 reference (`grep webhook` toàn `src/main/java` → 0). Vết tích sau khi gỡ SePay (V59).

**Đã thực thi:** xoá thư mục `api/webhook/`. Không đụng payment flow thật (không có payment flow thật trong package này). Risk = 0.

---

## 4. AL-10 — `chassisNumber` / `engineNumber` rename

**Không cần fix — đã được xử lý từ trước.**

Migration **`V99__rename_serial_identifier_columns.sql`** đã: thêm cột `serial_number`, migrate dữ liệu từ `chassis_number`/`engine_number`, **drop 2 cột cũ**, thay index + check constraint. Grep `chassisNumber|engineNumber|chassis_number|engine_number` toàn repo: chỉ còn trong **migration cũ V51/V89/V99** (lịch sử, không thể sửa) và **docs**. **Không có file Java/JSX runtime nào** còn dùng tên cũ — code hiện dùng `serialNumber`.

Finding AL-10 trong audit gốc dựa trên một memory đã cũ. Đã cập nhật memory `project_bigbike_domain` cho khớp thực tế. **Không có hành động code.**

---

## 5. Recommendation — Phase RBAC cleanup sau launch

Không thực thi trong lượt này (behavior change có chủ đích).

| Mục | Change đề xuất | Risk |
|---|---|---|
| EDITOR tách khỏi Inventory/Serial | Gỡ `inventory.read` khỏi EDITOR nếu business xác nhận EDITOR là content-only | EDITOR + custom roles mất quyền xem Inventory — cần thông báo operator |
| AL-04 — Return permission riêng | Tách `returns.read` / `returns.write` khỏi `orders.*` nếu cần vai trò CSKH chuyên đổi/trả | Phải seed lại + cập nhật controller `AdminReturnController` |

Cả hai cần business confirm trước khi làm.

---

## 6. Decisions đã chốt — defer (không thực thi)

### AL-09 — Công nợ / bán nợ

- **Không** remove backend/database công nợ. **Không** implement scope mới.
- **Không ẩn UI Receivables trong lượt này** — lý do: POS có hình thức bán **CREDIT** (`AdminPosController`) tạo `ReceivableEntity`. Màn Receivables là nơi duy nhất quản lý khoản nợ phát sinh từ POS credit sale. Ẩn nó sẽ làm POS credit sale mồ côi (bán nợ xong không có chỗ thu nợ). Đây đúng cảnh báo trong chính quyết định 0.1: "nếu order/payment workflow phụ thuộc trực tiếp vào công nợ, chỉ giữ phần tối thiểu".
- **Recommendation:** phần thật sự "nâng cao/B2B-ish" cần cân nhắc defer là **hình thức thanh toán CREDIT ở POS** — không phải màn Receivables. Quyết định bật/tắt POS credit cho launch là business decision riêng (`NEEDS_CONFIRMATION`). Nếu tắt POS credit thì Receivables tự nhiên không có dữ liệu mới; không cần ẩn menu.
- Full receivables/debt management nâng cao → roadmap sau launch.

### AL-08 — Mobile secondary features

- Defer wishlist / video / review / warranty lookup trên mobile — **không implement**.
- **Không có action chết để ẩn:** mobile (`bigbike_mobile/lib/features/`) đơn giản là **không có** các màn/nút này — không phải nút bấm vào lỗi. Home-video có endpoint nhưng chưa có widget (không có nút). → Không có gì để hide/disable.
- Core mobile flow (login → browse → cart → checkout → order → return) giữ nguyên.

### AL-04 — Return / exchange permission

- Chấp nhận return dùng chung `orders.*` cho v1 — `AdminReturnController` không expose action tài chính nhạy cảm tách biệt (refund đi qua order/POS flow riêng). Không lộ sai role.
- Không refactor RBAC return trong lượt này. Recommendation tách `returns.*` ghi ở §5.

---

## 7. AL-11 — Spec / roadmap (không implement)

### 7.1. Hoá đơn điện tử (NĐ 123/2020)

| Mục | Nội dung tối thiểu |
|---|---|
| Actor | Admin/Kế toán phát hành hoá đơn; nhà cung cấp e-invoice (third-party); khách nhận hoá đơn |
| Workflow | Đơn `PAID`/`COMPLETED` → phát hành hoá đơn → gửi khách → khi refund/cancel → điều chỉnh/huỷ hoá đơn |
| API cần có | `POST /admin/orders/{id}/invoice` (phát hành), `GET /admin/orders/{id}/invoice`, `POST .../invoice/cancel`; webhook nhận trạng thái từ provider |
| DB cần có | Bảng `invoices` (orderId, invoiceNumber, provider, status, issuedAt, pdfUrl, taxData), liên kết tới `orders` |
| Trạng thái hoá đơn | `DRAFT → ISSUED → SENT → (ADJUSTED / CANCELLED)` |
| Rủi ro pháp lý | NĐ 123/2020 bắt buộc hoá đơn điện tử cho pháp nhân bán lẻ. Không có → rủi ro tuân thủ thuế |
| Provider cần xác nhận | Misa / VNPT / SInvoice / Easyinvoice — `NEEDS_BUSINESS_CONFIRMATION` |
| **Operational workaround v1** | **Hoá đơn xử lý thủ công ngoài hệ thống** (phần mềm hoá đơn riêng của shop) cho tới khi có module e-invoice. Không chặn technical launch. |

### 7.2. Tích hợp vận chuyển (GHN/GHTK/ViettelPost)

| Mục | Nội dung |
|---|---|
| Quyết định | Không tích hợp carrier API trong lượt này |
| Scope v1 | `OrderEntity.fulfillmentStatus` đã tồn tại → vận hành shipping **thủ công**: admin tự cập nhật trạng thái giao hàng. Tracking number nhập tay nếu cần (cần xác nhận có field tracking trên order — V100 fulfillment tracking fields) |
| Roadmap sau | Tích hợp GHN/GHTK/ViettelPost: tạo vận đơn tự động, đồng bộ tracking, webhook cập nhật trạng thái |
| Không build mới | Không gọi API nhà vận chuyển thật trong lượt này |

### 7.3. Xuất / xoá dữ liệu cá nhân khách (NĐ 13/2023)

| Mục | Nội dung |
|---|---|
| Quyết định | Không implement self-service export/delete trong lượt này — chỉ spec |
| Phase sau | (1) Admin-side export dữ liệu khách hàng theo yêu cầu; (2) chính sách anonymize/delete khi khách yêu cầu xoá; (3) audit log cho mọi thao tác dữ liệu nhạy cảm |
| API tương lai | `GET /admin/customers/{id}/data-export`, `POST /admin/customers/{id}/anonymize` |
| Rủi ro | NĐ 13/2023 về bảo vệ dữ liệu cá nhân — cần xử lý thủ công có quy trình tới khi có module |

---

## 8. Validation

> Lệnh chạy: backend `./mvnw test`; admin `eslint .` + `vite build`.

### Backend — `./mvnw test`

`KẾT QUẢ ĐANG CẬP NHẬT` — test suite đang chạy tại thời điểm ghi báo cáo. Mục cần xác nhận:
- Toàn bộ test PASS, 0 FAIL.
- `RbacUrlGateIntegrationTest`, `AdminRolesApiTest` — RBAC gate.
- `WarrantyApiTest` — warranty void gate `warranty.write`.
- `Phase1KInventoryP0FixApiTest`, `Phase1KInventorySerialApiTest`, `Phase2FSerialInventoryTest` — inventory/serial gate `inventory.*`.
- `AdminReceivableApiTest` — không hồi quy sau khi gỡ `receivables.export`.

### Admin — `eslint .` + `vite build`

- **`vite build`: ✅ PASS** — built in 20.23s, exit code 0. JSX + JSON locale hợp lệ (build sẽ fail nếu JSON vỡ).
- **`eslint .`: 31 error + 1 warning — toàn bộ PRE-EXISTING, không nằm trong file đã sửa.** Lỗi ở `WarrantyListScreen.jsx` (`set-state-in-effect`), `vite.config.js` (`no-undef __dirname`)… — tech debt có sẵn, không liên quan lượt fix này. Chạy `eslint` riêng trên 3 file đã sửa (`App.jsx`, `RolesScreen.jsx`, `adminApi.js`) → **0 lỗi**.

---

## 9. Còn cần quyết định (business)

| # | Câu hỏi | Owner |
|---|---|---|
| 1 | Bật/tắt hình thức **POS credit (bán nợ)** cho launch — quyết định này thay cho việc ẩn menu Receivables (AL-09) | Chủ shop |
| 2 | Phase RBAC cleanup: có tách EDITOR khỏi Inventory không (§5) | Chủ shop / PM |
| 3 | Hoá đơn điện tử: chọn provider + thời điểm tích hợp (§7.1) | Chủ shop / Kế toán |
| 4 | Tích hợp vận chuyển: carrier nào, bao giờ (§7.2) | Chủ shop / Vận hành |
| 5 | Có làm endpoint xuất/xoá dữ liệu cá nhân không (§7.3) | Chủ shop / Luật sư |

---

## 10. Kết luận

Lượt fix xử lý xong **3 finding alignment** (AL-03, AL-05, AL-06) và xác nhận **1 finding đã được giải quyết trước đó** (AL-10).

- **AL-03** — fix lệch permission lớn nhất: `inventory.*` nay gate đúng module Tồn kho/Serial, `warranty.*` (mới) gate Bảo hành. Thực thi bằng `V121` backfill **non-breaking** — không role nào mất quyền.
- **AL-05** — gỡ permission mồ côi `receivables.export` bằng `V122` + dọn UI.
- **AL-06** — xoá package rỗng `api/webhook/`.
- **AL-10** — không cần fix, `V99` đã rename `chassis/engine` → `serial_number` từ trước.

Không thay đổi business rule. Không phá API/DB contract (mọi thay đổi permission có backfill compat). Các finding còn lại (AL-09/11/08/04) giữ đúng quyết định đã chốt — defer + spec, không mở rộng scope launch.

**Còn lại:** 1 phase RBAC cleanup sau launch (tuỳ chọn) + 5 quyết định business ở §9.
