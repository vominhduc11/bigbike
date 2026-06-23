# BigBike State Machines

## 1. Document Purpose

File này mô tả vòng đời trạng thái của các entity quan trọng trong BigBike. Mục tiêu là giúp business user, PM, BA, tester, developer mới và AI agent hiểu entity nào có trạng thái, trạng thái nào được phép chuyển, transition nào bị cấm, actor nào được chuyển, side effect sau transition là gì, và backend có enforce hay chưa.

File này dùng để tránh các lỗi kiểu:

- Product `DRAFT` hiển thị public.
- Order `COMPLETED` quay lại `PENDING` như chưa có chuyện gì xảy ra.
- Payment `PAID` được chuyển lại `UNPAID` tùy hứng.
- Admin tự deactivate hoặc tự hạ quyền Super Admin cuối cùng.

State transition ảnh hưởng dữ liệu, trạng thái, inventory, payment, permission hoặc public visibility phải được backend enforce. Frontend chỉ được hỗ trợ UX bằng badge/button/hide/disable action, không được là nguồn enforce cuối cùng.

Giới hạn:

- Không phải API contract.
- Không phải database schema.
- Không phải permission matrix chi tiết.
- Không nhồi request/response API.
- Không nhồi full entity/model fields.
- Không chứa secret, token, password, private key hoặc env value nhạy cảm.
- Không khẳng định production-ready nếu chưa có build/test/runtime evidence hiện tại.

File này liên quan trực tiếp đến:

- `BUSINESS_RULES.md`
- `ACCEPTANCE_CRITERIA.md`
- `TESTING_GUIDE.md`
- `TRACEABILITY_MATRIX.md`
- `PERMISSION_MATRIX.md`

## 2. State Machine Status Labels

| Label | Meaning |
|---|---|
| `CONFIRMED_BACKEND_ENFORCED` | Backend/service/validation enforce transition rõ. |
| `CONFIRMED_BY_TEST` | Có test kiểm tra transition. |
| `STATUS_ONLY` | Chỉ thấy status/enum/schema, chưa thấy transition logic rõ. |
| `FRONTEND_ONLY` | Chỉ thấy UI hide/disable/action theo status, chưa thấy backend enforce. |
| `DOCUMENTED_NOT_ENFORCED` | Docs có nói nhưng code chưa thấy enforce. |
| `INFERRED_FROM_STRUCTURE` | Suy luận từ route/folder/API/status enum nhưng chưa đủ evidence. |
| `NEEDS_VERIFICATION` | Cần kiểm tra thêm bằng code review sâu hơn, build/test/runtime hoặc business confirmation. |
| `NOT_FOUND_IN_REPO` | Chưa thấy trong repo hiện tại. |
| `CONFLICTING_EVIDENCE` | Code/docs có dấu hiệu mâu thuẫn. |
| `MISSING_TEST_COVERAGE` | Có transition/rule code evidence nhưng chưa thấy test trực tiếp trong audit này. |

## 3. Entity State Machine Summary

| Entity | State Field | States Found | Main Transitions | Enforcement | Status | Evidence |
|---|---|---|---|---|---|---|
| Product | `publishStatus` | `DRAFT`, `PUBLISHED`, `HIDDEN`, `TRASH` | Controlled publish transitions; soft-delete to `TRASH`; restore `TRASH -> DRAFT`. Legacy values `ARCHIVED`, `PENDING`, `PRIVATE` migrated away. | Backend validator | `CONFIRMED_BACKEND_ENFORCED` | `PublishStatus.java`, `AdminMutationValidators.java`, `AdminCatalogMutationService.java`, `CatalogReadService.java` |
| Category | `visible` | `true`, `false` | Soft-delete/hide sets visible false; public only visible; cannot hide parent with visible children. | Backend service | `CONFIRMED_BACKEND_ENFORCED` for visibility rules; no enum state machine | `AdminCatalogMutationService.java`, `CatalogReadService.java` |
| Brand | `visible` | `true`, `false` | Delete sets visible false; public only visible. | Backend service | `CONFIRMED_BACKEND_ENFORCED` for visibility; no full transition map | `AdminCatalogMutationService.java`, `CatalogReadService.java` |
| Order | `status` | `PENDING`, `PROCESSING`, `ON_HOLD`, `COMPLETED`, `CANCELLED`, `FAILED` | Explicit allowed transition map in service. (`REFUNDED` removed 2026-06-23 — old refunded orders migrated to `CANCELLED`.) | Backend service | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java`, `CheckoutService.java` |
| Payment | `paymentStatus` on Order, `status` on Payment | Order payment: `UNPAID`, `PAID`, `CANCELLED`. Payment record includes `PENDING`, `SUCCEEDED` in observed service code. (`REFUNDED` removed 2026-06-23.) | Explicit order payment transition map; payment record status is updated as side effect. | Backend service | `CONFIRMED_BACKEND_ENFORCED` for order payment status; payment entity full lifecycle `STATUS_ONLY` | `AdminOrderService.java`, `CheckoutService.java` |
| Fulfillment | `fulfillmentStatus` | `fulfillmentStatus` field observed in order detail. (Shipping-method state removed 2026-06-23 — `SHIP_RULE_001`.) | Fulfillment state transitions not confirmed. | Partial backend | `STATUS_ONLY` / `NEEDS_VERIFICATION` | `AdminOrderService.java`, `CheckoutService.java` |
| Inventory / Stock | `stockState`, availability flag | `IN_STOCK`, `OUT_OF_STOCK` | `stockState` mirrors the boolean availability toggle (V261). Admin không set thủ công qua catalog API. Sản phẩm/biến thể mới luôn bắt đầu `OUT_OF_STOCK`. Bán/huỷ không tự đổi availability. | Backend policy/service | `CONFIRMED_BACKEND_ENFORCED` | `ProductStockState.java`, `AdminInventoryService.java`, `AdminCatalogMutationService.java`, `CheckoutService.java`, `BUSINESS_RULES.md` STOCK_RULE_001–009 |
| Admin User | `status`, `role` | Status: `INVITED`, `ACTIVE`, `DISABLED`, `SUSPENDED`; Roles: `SUPER_ADMIN`, `ADMIN`, `EDITOR`, `SHOP_MANAGER` (built-in, V200) + custom roles. New users start `INVITED` (no password) and become `ACTIVE` on accepting an email invite. | Status/role update validation; self-deactivation and Super Admin demotion guardrails; invite token lifecycle. | Backend service | `CONFIRMED_BACKEND_ENFORCED` | `AdminAdminUsersService.java`, `AdminInviteService.java`, `SecurityConfig.java` |
| Content Article/Page | `publishStatus` | Same `PublishStatus` enum; active values: `DRAFT`, `PUBLISHED`, `HIDDEN`, `TRASH`; legacy `ARCHIVED` migrated sang `HIDDEN`. | Publish transitions enforced on update; delete sets `TRASH` (soft-delete, restore `TRASH` → `DRAFT`). | Backend service | `CONFIRMED_BACKEND_ENFORCED`; public filtering `NEEDS_VERIFICATION` | `AdminContentController.java`, `AdminContentMutationService.java`, `AdminMutationValidators.java` |
| Media | `status` | `ACTIVE`, `INACTIVE`, `DELETED` | Upload creates `ACTIVE`; update validates allowed statuses; soft-delete sets `DELETED`; restore sets `ACTIVE`; hard-delete removes row/object. | Backend service | `CONFIRMED_BACKEND_ENFORCED` | `AdminMediaService.java` |
| Notification | `isRead` (boolean) | Email/websocket events + persistent table. `isRead` toggled by mark-read endpoints. | `false` → `true` via mark-read / mark-all-read. | Backend service | `CONFIRMED_FROM_CODE` | `AdminNotificationController.java`, `V102__create_admin_notifications_table.sql` |
| Settings | No lifecycle state confirmed | Public/private behavior exists in docs/controllers; no state machine confirmed. | N/A | `STATUS_ONLY` / `NEEDS_VERIFICATION` | `AdminSettingsController`, `PublicSettingsController`, `PHASE_1J...` |

## 4. Product State Machine

### Purpose

Product state machine kiểm soát vòng đời public/internal của sản phẩm: từ draft, publish, hide/archive/trash và khả năng hiển thị ngoài public web/mobile.

### State Field

`publishStatus`

### States

Active states (dùng trong admin):

- `DRAFT`
- `PUBLISHED`
- `HIDDEN`
- `TRASH`

Legacy values (còn trong enum cho backward compat với dữ liệu cũ, không được phép set qua admin API):

- `ARCHIVED` → đã migrate sang `HIDDEN`
- `PENDING` → đã migrate sang `DRAFT`
- `PRIVATE` → đã migrate sang `DRAFT`

### Initial State

- Create product yêu cầu `publishStatus` trong request.
- Trong patch logic, nếu create mà request không có publishStatus thì fallback `DRAFT`, nhưng validate create yêu cầu publishStatus nên fallback chủ yếu là safety fallback.

### Terminal States

- `TRASH`: soft-delete state.

Không khẳng định terminal tuyệt đối vì code cho phép `TRASH -> DRAFT`.

### Live preview (không đổi state)

Admin live preview (`POST /api/v1/admin/products/preview`) render nội dung nháp đang nhập bằng template storefront thật, nhưng **không** đổi `publishStatus`, **không** lưu, và **không** expose sản phẩm ra public. Preview đi qua phiên đăng nhập admin (`products.update`) — không qua public read path; public vẫn chỉ trả `PUBLISHED`. Đây là cách hợp lệ để xem một bản `DRAFT` mà vẫn giữ đúng anti-goal "Product `DRAFT` hiển thị public" ở đầu file.

### Allowed Transitions

| From | To | Actor / Role | Preconditions | Side Effects | Enforcement | Evidence |
|---|---|---|---|---|---|---|
| `DRAFT` | `PUBLISHED` | Admin / role có `products.update` | Product exists; transition request valid. | Product có thể public nếu public read filter trả `PUBLISHED`. | `CONFIRMED_BACKEND_ENFORCED` | `AdminMutationValidators.java`, `AdminCatalogMutationService.java` |
| `DRAFT` | `HIDDEN` | Admin / role có `products.update` | Product exists. | Product không public. | `CONFIRMED_BACKEND_ENFORCED` | `AdminMutationValidators.java` |
| `DRAFT` | `TRASH` | Admin / role có `products.update` | Product exists. | Soft-delete. | `CONFIRMED_BACKEND_ENFORCED` | `AdminMutationValidators.java`, `AdminCatalogMutationService.java` |
| `PUBLISHED` | `HIDDEN` | Admin / role có `products.update` | Product exists. | Product bị loại khỏi public vì public chỉ trả `PUBLISHED`. | `CONFIRMED_BACKEND_ENFORCED` | `AdminMutationValidators.java`, `CatalogReadService.java` |
| `PUBLISHED` | `TRASH` | Admin / role có `products.update` | Product exists. | Soft-delete and public hidden. | `CONFIRMED_BACKEND_ENFORCED` | `AdminMutationValidators.java`, `AdminCatalogMutationService.java` |
| `HIDDEN` | `PUBLISHED` | Admin / role có `products.update` | Product exists. | Product quay lại public. | `CONFIRMED_BACKEND_ENFORCED` | `AdminMutationValidators.java` |
| `HIDDEN` | `DRAFT` | Admin / role có `products.update` | Product exists. | Product thành draft để chỉnh sửa lại. | `CONFIRMED_BACKEND_ENFORCED` | `AdminMutationValidators.java` |
| `HIDDEN` | `TRASH` | Admin / role có `products.update` | Product exists. | Soft-delete. | `CONFIRMED_BACKEND_ENFORCED` | `AdminMutationValidators.java` |
| `TRASH` | `DRAFT` | Admin / role có `products.update` | Product in trash. | Restore into draft. | `CONFIRMED_BACKEND_ENFORCED` | `AdminMutationValidators.java` |

### Forbidden Transitions

| From | To | Reason | Enforcement | Evidence |
|---|---|---|---|---|
| `DRAFT` | `PUBLISHED` (skip) | Không đi thẳng DRAFT→PUBLISHED nếu muốn review trước; nhưng hiện tại business cho phép. | Không bị block. | `AdminMutationValidators.java` |
| `PUBLISHED` | `DRAFT` | Không cho phép trực tiếp; phải qua HIDDEN trước. | Backend rejects. | `AdminMutationValidators.java` |
| any | `ARCHIVED` / `PENDING` / `PRIVATE` | Legacy values, không được set qua admin API. | Backend rejects với `RESERVED_PUBLISH_STATUS`. | `AdminMutationValidators.java` |
| `TRASH` | anything except `DRAFT` | Restore từ trash chỉ được về DRAFT. | Backend rejects. | `AdminMutationValidators.java` |
| any state | same state | No-op; không phải transition. | Backend không báo lỗi. | `AdminMutationValidators.java` |

### Frontend Behavior

- Admin routes/actions exist for products in `bigbike-admin/README.md` and `bigbike-admin/src/lib/adminApi.js`.
- Specific UI button visibility by `publishStatus` needs dedicated UI audit.
- Public web visibility is backend-enforced by `CatalogReadService`, not just UI.

### Backend Enforcement

- Transition validation is centralized in `AdminMutationValidators.validatePublishTransition`.
- Product create/update/publish-status methods call the validator through `AdminCatalogMutationService`.
- Public product read filters `PUBLISHED` in `CatalogReadService`.

### Test Coverage

- Direct transition test files were not found by targeted search in this task.
- Status: `MISSING_TEST_COVERAGE`.

### Needs Verification

- Admin UI behavior by status.
- Whether `PENDING`/`PRIVATE` are only WordPress-import states or can be created manually.
- DB enum/schema constraints.

## 5. Category / Brand State Machine

### Purpose

Category/Brand does not have a full enum state machine in audited evidence. They use visibility boolean to control public display.

### State Field

- Category: `visible` / `isVisible`
- Brand: `visible` / `isVisible`

### States

- `visible = true`
- `visible = false`

### Initial State

- Depends on create payload/default behavior; needs deeper DTO/entity audit.

### Allowed Transitions

| Entity | From | To | Actor / Role | Preconditions | Side Effects | Enforcement | Evidence |
|---|---|---|---|---|---|---|---|
| Category | `true` | `false` | Admin / role có `catalog.update` | Category exists; no visible child categories. | Category hidden from public category list/detail. | `CONFIRMED_BACKEND_ENFORCED` | `AdminCatalogMutationService.java`, `CatalogReadService.java` |
| Category | `false` | `true` | Admin / role có `catalog.update` | Category exists; normal PATCH flips visible back. | Category public-visible if read service returns it. | `INFERRED_FROM_STRUCTURE` | `AdminCatalogMutationService.java` comment and update path |
| Brand | `true` | `false` | Admin / role có `catalog.update` | Brand exists. | Brand hidden from public brand list/detail. | `CONFIRMED_BACKEND_ENFORCED` | `AdminCatalogMutationService.java`, `CatalogReadService.java` |
| Brand | `false` | `true` | Admin / role có `catalog.update` | Brand exists; normal update can set visible. | Brand public-visible. | `INFERRED_FROM_STRUCTURE` | `AdminCatalogMutationService.java` |

### Forbidden Transitions

| From | To | Reason | Enforcement | Evidence |
|---|---|---|---|---|
| Category `true` | `false` | Category has visible children. | Backend throws conflict. | `AdminCatalogMutationService.java` |
| Category parentId | self/circular parent | Would corrupt tree. | Backend validation rejects. | `AdminCatalogMutationService.java` |

### Frontend Behavior

- Admin category/brand module exists.
- UI behavior for disabled/hidden category/brand needs verification.

### Backend Enforcement

- Public category/brand list/detail filters `visible` in `CatalogReadService`.
- Category hide with visible children is blocked in `AdminCatalogMutationService`.
- Category **hard-delete** (`DELETE /admin/categories/{id}`) xoá danh mục **cùng toàn bộ cây con** (cascade). Chặn (409) nếu bất kỳ danh mục nào trong cây còn sản phẩm xếp làm danh mục chính; không xoá sản phẩm. Xem `BUSINESS_RULES.md` `CATEGORY_RULE_004`. `CONFIRMED_BACKEND_ENFORCED` — `AdminCatalogMutationService.hardDeleteCategory`.

### Test Coverage

- Direct tests not found in targeted search.
- Status: `MISSING_TEST_COVERAGE`.

### Needs Verification

- Default visibility on create.
- Whether hidden category can still be assigned to products.
- Brand delete is visibility false; hard-delete not confirmed.

## 6. Order State Machine

### Purpose

Order state machine kiểm soát vòng đời xử lý đơn hàng sau checkout: pending/on-hold/processing/completed/cancelled/failed.

### State Field

`OrderEntity.status`

### States

From `AdminOrderService.ALLOWED_ORDER_STATUSES`:

- `PENDING`
- `PROCESSING`
- `ON_HOLD`
- `COMPLETED`
- `CANCELLED`
- `FAILED`

(`REFUNDED` was removed 2026-06-23 together with the refund feature; old refunded orders were migrated to `CANCELLED`.)

### Initial State

From checkout behavior:

- Online orders default to `PROCESSING` (owner decision 2026-06-23): the customer no longer chooses a payment method, so there is no "awaiting transfer" hold. `paymentMethod` is stored `null` and `paymentStatus = UNPAID`.
- Legacy/explicit `BACS` (if a caller still sends it) creates the order with `ON_HOLD`; explicit `COD` creates `PROCESSING`.
- `PENDING` exists as allowed order status, but checkout initial use needs deeper audit outside the default creation path.

### Terminal States

- `CANCELLED`
- `FAILED`

`COMPLETED` is terminal in `ALLOWED_TRANSITIONS`.

### Allowed Transitions

| From | To | Actor / Role | Preconditions | Side Effects | Enforcement | Evidence |
|---|---|---|---|---|---|---|
| `PENDING` | `PROCESSING` | Admin / `orders.write` | Order exists. | Audit log, status email, websocket event. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java` |
| `PENDING` | `ON_HOLD` | Admin / `orders.write` | Order exists. | Audit log, notification, websocket. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java` |
| `PENDING` | `CANCELLED` | Admin / `orders.write` | Order exists. `PAID` orders can be cancelled directly (see ORDER_RULE_004 in `BUSINESS_RULES.md`; refund removed 2026-06-23). | Set `cancelledAt`, audit, notification, websocket. (No stock restore — availability is a manual boolean, V261.) | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java#validateBeforeCancel` |
| `PENDING` | `FAILED` | Admin / `orders.write` | Order exists. | Audit, notification, websocket. (No stock restore — availability is a manual boolean, V261.) | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java` |
| `ON_HOLD` | `PROCESSING` | Admin / `orders.write` | Order exists. | Audit, notification, websocket. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java` |
| `ON_HOLD` | `CANCELLED` | Admin / `orders.write` | Order exists. `PAID` orders can be cancelled directly (refund removed 2026-06-23). | Set `cancelledAt`, audit, notification, websocket. (No stock restore — availability is a manual boolean, V261.) | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java#validateBeforeCancel` |
| `ON_HOLD` | `FAILED` | Admin / `orders.write` | Order exists. | Audit, notification, websocket. (No stock restore — availability is a manual boolean, V261.) | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java` |
| `PROCESSING` | `COMPLETED` | Admin / `orders.write` | For `DELIVERY`: `fulfillmentStatus = DELIVERED`. Payment status no longer gates completion (owner decision 2026-06-23) — an `UNPAID` order **can** be completed; the admin reconciles money offline (see ORDER_RULE_001/002/003 in `BUSINESS_RULES.md`). | Set `completedAt`, audit, notification, websocket. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java#validateBeforeComplete` |
| `PROCESSING` | `CANCELLED` | Admin / `orders.write` | Order exists. `PAID` orders can now be cancelled directly (refund removed 2026-06-23; admin reconciles money manually). | Set `cancelledAt`, audit, notification, websocket. (No stock restore — availability is a manual boolean, V261.) | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java#validateBeforeCancel` |
| `PROCESSING` | `FAILED` | Admin / `orders.write` | Order exists. | Audit, notification, websocket. (No stock restore — availability is a manual boolean, V261.) | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java` |

### Forbidden Transitions

| From | To | Reason | Enforcement | Evidence |
|---|---|---|---|---|
| `COMPLETED` | `PENDING` / `PROCESSING` / `ON_HOLD` / `CANCELLED` / `FAILED` | `COMPLETED` is terminal in `ALLOWED_TRANSITIONS`. | Backend throws conflict. | `AdminOrderService.java` |
| `PROCESSING` / `PENDING` / `ON_HOLD` | `COMPLETED` (when `DELIVERY` + `fulfillmentStatus != DELIVERED`) | Rule 3: cannot complete a delivery order before goods are delivered. | Backend throws conflict with message `Chỉ được hoàn thành đơn giao hàng sau khi đã giao thành công.` | `AdminOrderService.java#validateBeforeComplete` |
| ~~`PROCESSING` → `COMPLETED` (when `paymentMethod = COD` + `paymentStatus != PAID`)~~ | **Removed 2026-06-23.** Payment no longer blocks completion; this transition is now allowed regardless of payment status. See `ORDER_RULE_001/002`. | n/a | `AdminOrderService.java#validateBeforeComplete` |
| `PROCESSING` | `COMPLETED` (when `paymentStatus = UNPAID`) | Rule 1: an order cannot be completed while unpaid — there is no receivable/collection process to chase the money. (`PARTIALLY_PAID` removed in V114.) | Backend throws conflict with message `Đơn chưa thanh toán không thể hoàn thành.` | `AdminOrderService.java#validateBeforeComplete` |
| `CANCELLED` | any other status | Terminal state, no outgoing transitions. | Backend throws conflict. | `AdminOrderService.java` |
| `FAILED` | any other order status | Terminal state, no outgoing transitions. | Backend throws conflict. | `AdminOrderService.java` |
| any status | unknown status | Not in `ALLOWED_ORDER_STATUSES`. | Backend validation error. | `AdminOrderService.java` |
| same status | same status | Idempotent no-op; returns current detail. | Backend no write. | `AdminOrderService.java` |

### Related Payment / Inventory / Shipping Impact

| Impact | Evidence | Status |
|---|---|---|
| ~~`CANCELLED` / `FAILED` triggers stock restore.~~ **Removed (V261):** availability is a manual boolean, so cancelling/failing an order no longer restores any quantity. Other side-effects (audit, notification, websocket) are unchanged. | `AdminOrderService.java` | `CONFIRMED_FROM_CODE` |
| `COMPLETED` sets `completedAt` if missing. | `AdminOrderService.java` | `CONFIRMED_BACKEND_ENFORCED` |
| `CANCELLED` sets `cancelledAt` if missing. | `AdminOrderService.java` | `CONFIRMED_BACKEND_ENFORCED` |
| `DELIVERY` orders cannot be COMPLETED until `fulfillmentStatus = DELIVERED`. | `AdminOrderService.java#validateBeforeComplete` | `CONFIRMED_BACKEND_ENFORCED` |
| `listAllowedTransitions` filters `COMPLETED` and `CANCELLED` based on business preconditions (payment/fulfillment state) so the UI only shows actionable buttons. | `AdminOrderService.java#canComplete`, `#canCancel` | `CONFIRMED_BACKEND_ENFORCED` |

### Frontend Behavior

- Admin service has `listAllowedTransitions` for UI to hide invalid transition buttons.
- Admin UI display/action behavior needs dedicated UI audit.

### Backend Enforcement

- `ALLOWED_TRANSITIONS` map enforces transitions in `updateOrderStatus`.
- Unknown status is rejected.
- Same status is idempotent no-op.

### Test Coverage

- Direct tests not found by targeted search in this task.
- ~~Stock restore on cancel / FAILED.~~ No longer applicable (V261) — availability is a manual boolean; cancel/FAILED does not touch inventory.
- Status: `MISSING_TEST_COVERAGE` for transition-map coverage; restore-impact covered by `QaBug2StockRestoreTest`.

### Needs Verification

- Fresh tests for every allowed and forbidden transition.
- Whether order `PENDING` is used by any checkout flow.
- Fulfillment status relation.

## 7. Payment State Machine

### Purpose

Payment state machine quản lý trạng thái thanh toán trên order và side effects lên payment record.

### State Field

- `OrderEntity.paymentStatus`
- `PaymentEntity.status` observed through service side effects.

### States

From `AdminOrderService.ALLOWED_PAYMENT_STATUSES` (simplified V114; `REFUNDED` removed 2026-06-23):

- `UNPAID`
- `PAID`
- `CANCELLED`

Payment record statuses observed:

- `PENDING`
- `SUCCEEDED`

Full `PaymentEntity.status` enum/lifecycle was not fully audited. Treat payment entity lifecycle as `STATUS_ONLY` beyond observed service writes.

### Initial State

Checkout creates:

- `Order.paymentStatus = UNPAID`
- `Payment.status = PENDING`

### Terminal States

For order payment status map:

- `CANCELLED`

### Allowed Transitions (simplified V114)

| From | To | Actor / Role | Preconditions | Side Effects | Enforcement | Evidence |
|---|---|---|---|---|---|---|
| `UNPAID` | `PAID` | Admin / `orders.write` | Order exists; paidAmount default total or provided. | Set paidAmount, paidAt; payment record `SUCCEEDED`. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java` |
| `UNPAID` | `CANCELLED` | Admin / `orders.write` | Order exists. | paymentStatus updated. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java` |
| `PAID` | `UNPAID` | Admin / `orders.write` | paidAmount must be 0 if provided. | Reset paidAmount and paidAt. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java` |

### Forbidden Transitions

| From | To | Reason | Enforcement | Evidence |
|---|---|---|---|---|
| `CANCELLED` | any other payment status | Terminal, no outgoing transitions. | Backend rejects. | `AdminOrderService.java` |
| any status | unknown payment status | Not in allowed payment statuses. | Backend validation error. | `AdminOrderService.java` |

### Webhook / Callback

- No payment webhook/provider transition was found.
- Signature verification/idempotency state handling is `NOT_FOUND_IN_REPO`.

### Frontend Behavior

- Admin API client supports payment status updates in prior docs, but UI state behavior was not audited here.

### Backend Enforcement

- `ALLOWED_PAYMENT_TRANSITIONS` map enforces order payment status transitions.
- Unpaid paidAmount must be zero if provided.
- (`PARTIALLY_PAID` removed in V114; `REFUNDED` removed 2026-06-23.)

### Test Coverage

- Direct tests not found by targeted search.
- Phase 1F report documents checkout behavior but fresh tests were not run.
- Status: `MISSING_TEST_COVERAGE` / `NEEDS_VERIFICATION`.

### Needs Verification

- Full `PaymentEntity.status` enum/lifecycle.
- External gateway/webhook lifecycle.

## 8. Shipping / Fulfillment State Machine

### Purpose

Tracks the physical delivery lifecycle of `DELIVERY` orders. Since the platform is now online-only (POS / `IN_STORE` removed 2026-06-23), **every** order is a `DELIVERY` order and enters this state machine.

### State Field

- `OrderEntity.fulfillmentStatus` — set to `UNFULFILLED` by `CheckoutService` at order creation for all DELIVERY orders.
- Transitions driven by admin via `PATCH /admin/orders/{id}/fulfillment`.

### States

`UNFULFILLED` → `PROCESSING` → `SHIPPED` → `DELIVERED` → `RETURNED`  
`UNFULFILLED` / `PROCESSING` → `CANCELLED`  
`SHIPPED` → `RETURNED`

### Allowed Transitions

| From | To | Actor / Role | Preconditions | Side Effects | Enforcement | Evidence |
|---|---|---|---|---|---|---|
| `UNFULFILLED` | `PROCESSING` | Admin / `orders.write` | Order is DELIVERY type. | Audit, WS event. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java` |
| `UNFULFILLED` | `CANCELLED` | Admin / `orders.write` | Order is DELIVERY type. | Audit, WS event. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java` |
| `PROCESSING` | `SHIPPED` | Admin / `orders.write` | `trackingNumber` required (non-blank). Sets `shippedAt`. | Stores `trackingNumber`, `shippingCarrier`; sends shipped notification. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java#updateFulfillmentStatus` |
| `PROCESSING` | `CANCELLED` | Admin / `orders.write` | Order is DELIVERY type. | Audit, WS event. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java` |
| `SHIPPED` | `DELIVERED` | Admin / `orders.write` | Order is DELIVERY type. | Audit, WS event. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java` |
| `SHIPPED` | `RETURNED` | Admin / `orders.write` | Order is DELIVERY type. | Audit, WS event. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java` |
| `DELIVERED` | `RETURNED` | Admin / `orders.write` | Order is DELIVERY type. | Audit, WS event. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java` |

### Forbidden Transitions

| From | To | Reason | Enforcement | Evidence |
|---|---|---|---|---|
| `UNFULFILLED` | `DELIVERED` | Must go through PROCESSING → SHIPPED first so tracking data is captured. | Backend rejects (409). | `AdminOrderService.java` |
| `SHIPPED` | any without `trackingNumber` | `trackingNumber` is required when transitioning to SHIPPED. | Backend rejects (400). | `AdminOrderService.java#updateFulfillmentStatus` |
| `DELIVERED` | `CANCELLED` / `PROCESSING` / `SHIPPED` | No back-transition from DELIVERED except RETURNED. | Backend rejects (409). | `AdminOrderService.java` |
| `CANCELLED` | any | Terminal state. | Backend rejects (409). | `AdminOrderService.java` |
| `RETURNED` | any | Terminal state. | Backend rejects (409). | `AdminOrderService.java` |
| any | `DELIVERED` or `SHIPPED` (for non-DELIVERY orders) | `fulfillmentStatus` only applies to DELIVERY orders. | Backend rejects (409). | `AdminOrderService.java#updateFulfillmentStatus` |

### Impact on Order Completion

- `PROCESSING → COMPLETED` is blocked until `fulfillmentStatus = DELIVERED` for DELIVERY orders.
- `listAllowedTransitions` reflects this: COMPLETED only appears once DELIVERED.

### Frontend Behavior

- Admin `OrderDetailScreen` drives fulfillment via step-by-step buttons: UNFULFILLED→PROCESSING → form for trackingNumber → SHIPPED → DELIVERED.
- Direct UNFULFILLED→DELIVERED shortcut removed from UI.

### Backend Enforcement

- `CONFIRMED_BACKEND_ENFORCED` — explicit `ALLOWED_FULFILLMENT_TRANSITIONS` map in `AdminOrderService.java`.
- `trackingNumber` validated required at SHIPPED transition.

### Test Coverage

- `CONFIRMED_TEST_COVERAGE` — `Phase1HAdminOrderApiTest.java`:
  - `updateFulfillment_unfulfilledToDelivered_isRejected`
  - `updateFulfillment_shippedWithoutTrackingNumber_isRejected`
  - `markDelivered` helper walks full UNFULFILLED→PROCESSING→SHIPPED→DELIVERED path.

## 9. Inventory / Stock State Machine

> **Serial-number tracking was removed (2026-06-23, V259).** There is no serial lifecycle state machine.
>
> **Inventory is a BOOLEAN availability toggle (2026-06-23, V261).** There is no tracked quantity. `stockState` is a two-state badge (`IN_STOCK` / `OUT_OF_STOCK`) that mirrors a per-variant / per-product availability flag the admin sets by hand. `LOW_STOCK` is no longer produced.

### Purpose

Availability is a boolean: per variant `product_variants.is_available`; per no-variant product `products.stock_state` set directly by the admin toggle. `stockState` mirrors that flag for product/variant availability. No on-hand count is kept.

### State Field

- `stockState` (`IN_STOCK` / `OUT_OF_STOCK`).
- `product_variants.is_available` — the per-variant gate.
- Quantity columns (`quantity_on_hand` / `stock_quantity`) are **dormant** — not read for availability. The `stock_movements` ledger is no longer written for sales/restores.

### States

From `ProductStockState.java`:

- `IN_STOCK`
- `OUT_OF_STOCK`
- `LOW_STOCK` — **enum value kept for compat but never produced** (no low-stock tier, V261).

### Initial State

- New product / variant starts `OUT_OF_STOCK` (`is_available = false`); the admin must toggle it to "Còn hàng" before it can sell.
- The admin product form does not expose a stockState picker. The Inventory module (`AdminInventoryController` availability endpoints) is the writer.

### Allowed Transitions

| From | To | Actor / Role | Preconditions | Side Effects | Enforcement | Evidence |
|---|---|---|---|---|---|---|
| `OUT_OF_STOCK` | `IN_STOCK` | Admin / `inventory.write` | `PATCH .../availability` with `{ available: true }`. | Variant `is_available = true` (or no-variant `stock_state = IN_STOCK`); product-level re-aggregates from variants. | `CONFIRMED_BACKEND_ENFORCED` | `AdminInventoryController.java`, `AdminInventoryService.java` |
| `IN_STOCK` | `OUT_OF_STOCK` | Admin / `inventory.write` | `PATCH .../availability` with `{ available: false }`. | Variant `is_available = false` (or no-variant `stock_state = OUT_OF_STOCK`); product-level re-aggregates. | `CONFIRMED_BACKEND_ENFORCED` | `AdminInventoryController.java`, `AdminInventoryService.java` |

**No automatic transitions:** a sale or cancel does **not** change availability. There is no quantity decrement or restore.

### Forbidden Transitions / States

| From | To | Reason | Enforcement | Evidence |
|---|---|---|---|---|
| `OUT_OF_STOCK` variant | add-to-cart / checkout | Cannot buy an unavailable variant. | Backend rejects checkout (`isAvailable` gate). | `CheckoutService.java` |

> **No oversell guard by quantity.** Because availability is boolean and selling never decrements anything, the storefront keeps accepting orders for an available item even after it physically sells out. The admin must manually toggle it to "Hết hàng".

### Frontend Behavior

- Admin Inventory screen shows a "Còn hàng / Hết hàng" toggle per row; the public buy-box badge shows the two states only.

### Backend Enforcement

- Availability flag is the gate; checkout validates `isAvailable` per variant before order creation.
- No stock recompute from quantity; no restore on cancel.

### Test Coverage

- Per-variant `isAvailable` checkout gate covered by checkout API tests.
- Availability-toggle transitions: `MISSING_TEST_COVERAGE` (targeted search).

### Needs Verification

- Admin availability-toggle endpoint tests.

## 10. Return / Refund State Machine

> **REMOVED (2026-06-23).** The Return (RMA) and Refund feature was deleted platform-wide: customer returns, the admin returns module, per-item inspection (V104), RMA stock-restore, and every refund flow no longer exist. The `returns` / `return_items` / `return_history` tables and the `REFUNDED` order/payment status were dropped; old `REFUNDED` orders were migrated to `CANCELLED`. There is no system-tracked return lifecycle. (Customer-facing return/exchange **policy text** is kept as a manual commitment — see `BUSINESS_RULES.md` "Returns And Refunds".)

## 11. User / Admin User State Machine

### Purpose

Admin user state machine kiểm soát internal account lifecycle và role safety guardrails.

### State Fields

- `AdminUserEntity.status`
- `AdminUserEntity.role`

### States

From `AdminAdminUsersService.VALID_STATUSES`:

- `INVITED` — created via email invite, no password set yet, **cannot log in** until the invite is accepted.
- `ACTIVE`
- `DISABLED`
- `SUSPENDED`

Built-in roles (4, after `V200__reduce_default_roles.sql`):

- `SUPER_ADMIN`
- `ADMIN`
- `EDITOR`
- `SHOP_MANAGER`

Custom role support exists through role repository/controller.

### Initial State

- New admin user is created with `status = INVITED` and **no password** (an email invite with a set-password link is sent). Accepting the invite (setting a password) transitions the account to `ACTIVE`. Login is blocked for any non-`ACTIVE` account and for any account without a password hash.

### Terminal States

- No terminal status confirmed. `DISABLED` and `SUSPENDED` can likely be changed back through update if allowed, but exact transition restrictions are minimal.

### Allowed Transitions

| From | To | Actor / Role | Preconditions | Side Effects | Enforcement | Evidence |
|---|---|---|---|---|---|---|
| N/A | `INVITED` | Admin / `admin-users.write` | Valid email, displayName, role. No password supplied. | Admin user created without password; invite token generated; invite email sent. | `CONFIRMED_BACKEND_ENFORCED` | `AdminAdminUsersService.java`, `AdminInviteService.java` |
| `INVITED` | `ACTIVE` | Invitee (public, token-gated) | Valid non-expired, unused invite token; password >= 8. | Password set; status → `ACTIVE`; invite token consumed. | `CONFIRMED_BACKEND_ENFORCED` | `AdminInviteService.acceptInvite` |
| `ACTIVE` | `DISABLED` | Admin / `admin-users.write` | Target is not actor themself. | Status updated; audit log. | `CONFIRMED_BACKEND_ENFORCED` | `AdminAdminUsersService.java` |
| `ACTIVE` | `SUSPENDED` | Admin / `admin-users.write` | Target is not actor themself. | Status updated; audit log. | `CONFIRMED_BACKEND_ENFORCED` | `AdminAdminUsersService.java` |
| `DISABLED` | `ACTIVE` | Admin / `admin-users.write` | Valid target user. | Status updated; audit log. | `CONFIRMED_BACKEND_ENFORCED` | `AdminAdminUsersService.java` |
| `SUSPENDED` | `ACTIVE` | Admin / `admin-users.write` | Valid target user. | Status updated; audit log. | `CONFIRMED_BACKEND_ENFORCED` | `AdminAdminUsersService.java` |
| any valid role | another valid role | Admin / `admin-users.write` | New role built-in or custom; Super Admin guardrails pass. | Role updated; audit log. | `CONFIRMED_BACKEND_ENFORCED` | `AdminAdminUsersService.java` |

### Forbidden Transitions

| From | To | Reason | Enforcement | Evidence |
|---|---|---|---|---|
| actor own account | `DISABLED` / `SUSPENDED` | Prevent self-lockout. | Backend rejects. | `AdminAdminUsersService.java` |
| `SUPER_ADMIN` self role | not `SUPER_ADMIN` | Prevent self-demotion. | Backend rejects. | `AdminAdminUsersService.java` |
| last active `SUPER_ADMIN` | not `SUPER_ADMIN` | Prevent losing final Super Admin. | Backend rejects. | `AdminAdminUsersService.java` |
| any status | unknown status | Must be `INVITED`, `ACTIVE`, `DISABLED`, or `SUSPENDED`. | Backend rejects. | `AdminAdminUsersService.java` |
| `INVITED` | login | Account has no password until invite accepted. | Login rejected (no password hash). | `AdminAuthService.login` |
| any role | invalid role | Must be built-in or custom role existing in role repository. | Backend rejects. | `AdminAdminUsersService.java` |

### Frontend Behavior

- Admin users/roles modules exist; UI guard and confirmation behavior need audit.

### Backend Enforcement

- Admin user service validates statuses/roles and guardrails.
- Permission controller/service access belongs in `PERMISSION_MATRIX.md`.

### Test Coverage

- Direct tests not found by targeted search.
- Status: `MISSING_TEST_COVERAGE`.

### Needs Verification

- Login behavior for `DISABLED`/`SUSPENDED` users.
- Production admin auth readiness.
- UI confirmation for dangerous role/status actions.

## 12. Content / SEO State Machine

### Purpose

Content state machine quản lý publish lifecycle của articles/pages và ảnh hưởng public content/SEO.

### State Field

`publishStatus`

### States

- Shared `PublishStatus` enum giữ nguyên 7 values cho backward compat với dữ liệu cũ, nhưng admin API chỉ chấp nhận: `DRAFT`, `PUBLISHED`, `HIDDEN`, `TRASH`.
- Legacy values `ARCHIVED`, `PENDING`, `PRIVATE` bị block bởi `AdminMutationValidators` khi dùng làm transition target.
- Content delete (article/page) set `TRASH` — nhất quán với product soft-delete.

### Initial State

- Create article/page requires `publishStatus` in request.
- Patch logic fallback is `DRAFT` when create and request is null, but create validation requires publishStatus.

### Terminal States

- `TRASH` is the delete target for content delete (soft-delete).
- Not strictly terminal because the validator allows `TRASH -> DRAFT` (restore). Legacy `ARCHIVED -> DRAFT` còn được giữ như escape path cho dữ liệu cũ còn sót.

### Live preview (không đổi state)

Admin live preview bài viết (`POST /api/v1/admin/content/articles/preview`) render nội dung nháp bằng template blog detail thật, nhưng **không** đổi `publishStatus`, **không** lưu, và **không** expose bài viết ra public. Preview đi qua phiên admin (`content.update`) — không qua public read path; public vẫn chỉ trả `PUBLISHED`. Song song với product preview (xem §4).

### Allowed Transitions

Same as Product publish transition validator for update operations:

| From | To | Actor / Role | Preconditions | Side Effects | Enforcement | Evidence |
|---|---|---|---|---|---|---|
| `DRAFT` | `PUBLISHED` / `HIDDEN` / `TRASH` | Admin / Editor / Author with `content.update` | Content exists. | If `PUBLISHED`, set `publishedAt`; revalidate web tags. | `CONFIRMED_BACKEND_ENFORCED` | `AdminContentMutationService.java`, `AdminMutationValidators.java` |
| `PUBLISHED` | `HIDDEN` / `TRASH` | Admin / Editor / Author with `content.update` | Content exists. | If not `PUBLISHED`, clear `publishedAt`; revalidate. | `CONFIRMED_BACKEND_ENFORCED` | `AdminContentMutationService.java`, `AdminMutationValidators.java` |
| `HIDDEN` | `PUBLISHED` / `DRAFT` / `TRASH` | Admin / Editor / Author with `content.update` | Content exists. | Publish/clear publishedAt accordingly; revalidate. | `CONFIRMED_BACKEND_ENFORCED` | `AdminContentMutationService.java`, `AdminMutationValidators.java` |
| `ARCHIVED` | `DRAFT` / `TRASH` | Admin / Editor / Author with `content.update` | Content exists. | Re-open draft or trash. | `CONFIRMED_BACKEND_ENFORCED` | `AdminMutationValidators.java` |
| `PENDING` | `PUBLISHED` / `DRAFT` / `TRASH` | Admin / Editor / Author with `content.update` | Content exists; status accepted by DTO. | Review/import flow. | `CONFIRMED_BACKEND_ENFORCED` in shared validator; DTO acceptance `NEEDS_VERIFICATION` | `AdminMutationValidators.java` |
| `PRIVATE` | `PUBLISHED` / `DRAFT` / `HIDDEN` / `TRASH` | Admin / Editor / Author with `content.update` | Content exists; status accepted by DTO. | Private/import flow. | `CONFIRMED_BACKEND_ENFORCED` in shared validator; DTO acceptance `NEEDS_VERIFICATION` | `AdminMutationValidators.java` |
| `TRASH` | `DRAFT` | Admin / Editor / Author with `content.update` | Content exists. | Restore to draft. | `CONFIRMED_BACKEND_ENFORCED` in shared validator; content delete uses `TRASH` (nhất quán với product) | `AdminMutationValidators.java`, `AdminContentMutationService.java` |

### Forbidden Transitions

Same forbidden publish transition rules as product, enforced by shared validator.

### Frontend Behavior

- Admin content routes and API client exist.
- Specific status action visibility needs UI audit.

### Backend Enforcement

- Update article/page calls `validatePublishTransition`.
- Delete article/page sets `publishStatus = TRASH` directly (nhất quán với product soft-delete).
- Public content visibility filtering needs deeper audit.

### Test Coverage

- Direct tests not found by targeted search.
- Status: `MISSING_TEST_COVERAGE`.

### Needs Verification

- DTO enum acceptance for `PENDING`, `PRIVATE`, `TRASH` on content.
- Public read filtering of non-published content.
- SEO route behavior for archived/hidden content.

## 13. Media State Machine

### Purpose

Media state machine quản lý lifecycle của uploaded assets trong media library.

### State Field

`MediaEntity.status`

### States

From `AdminMediaService.ALLOWED_STATUSES`:

- `ACTIVE`
- `INACTIVE`
- `DELETED`

### Initial State

- Upload creates media with `status = ACTIVE`.

### Terminal States

- `DELETED` is soft-delete state, not terminal because restore is allowed.
- Hard-delete removes object/row and exits state machine.

### Allowed Transitions

| From | To | Actor / Role | Preconditions | Side Effects | Enforcement | Evidence |
|---|---|---|---|---|---|---|
| N/A | `ACTIVE` | Admin / role có `media.write` | MIME allowed; size <= 50 MB; storage upload succeeds. | Object uploaded to MinIO; media record created; audit log. | `CONFIRMED_BACKEND_ENFORCED` | `AdminMediaService.java` |
| any existing status | `ACTIVE` | Admin / role có `media.write` | Media exists; update or restore action. | Metadata/status updated; audit log. | `CONFIRMED_BACKEND_ENFORCED` | `AdminMediaService.java` |
| any existing status | `INACTIVE` | Admin / role có `media.write` | Media exists. | Metadata/status updated; audit log. | `CONFIRMED_BACKEND_ENFORCED` | `AdminMediaService.java` |
| any existing status | `DELETED` | Admin / role có `media.write` | Media exists; soft-delete action or update status. | Media excluded by default from list; audit log. | `CONFIRMED_BACKEND_ENFORCED` | `AdminMediaService.java` |
| `DELETED` | `ACTIVE` | Admin / role có `media.write` | Media exists. | Restored; audit log. | `CONFIRMED_BACKEND_ENFORCED` | `AdminMediaService.java` |
| any existing status | hard-deleted / removed | Admin / role có `media.write` | Media exists. | Try remove object from MinIO; audit log; DB row deleted. | `CONFIRMED_BACKEND_ENFORCED` | `AdminMediaService.java` |

### Forbidden Transitions

| From | To | Reason | Enforcement | Evidence |
|---|---|---|---|---|
| any | unknown status | Only `ACTIVE`, `INACTIVE`, `DELETED` allowed. | Backend validation error. | `AdminMediaService.java` |
| upload | unsupported MIME | Only MIME whitelist accepted (incl. `image/svg+xml`). | Backend validation error. | `AdminMediaService.java` |
| upload | SVG without `<svg>` root | SVG content gate (sanitizer parse). | Backend validation error. | `SvgSanitizer.java` |
| upload | > 50 MB | Upload limit. | Backend validation error. | `AdminMediaService.java` |

> SVG uploads are accepted but rewritten by `SvgSanitizer` (scripts, `on*` handlers, `javascript:`/external refs, `<foreignObject>`/`<image>`/`<style>` stripped) before storage.

### Frontend Behavior

- Admin media module exists, but UI action visibility by media status needs audit.

### Backend Enforcement

- Upload status and status updates are backend-enforced.
- Default media list excludes `DELETED` unless explicit status filter.

### Test Coverage

- Direct tests not found by targeted search.
- Status: `MISSING_TEST_COVERAGE`.

### Needs Verification

- Whether `INACTIVE` media is prevented from public rendering.
- Whether product/content references to deleted media are blocked.
- Magic-byte validation, because MIME header alone is weak.

## 14. Notification State Machine

### Purpose

Notification/email/websocket events exist as side effects, but no persisted notification inbox/read-unread/archive state machine was found.

### State Field

`isRead` (boolean) on `admin_notifications` table (V102).

### States

| State | Description |
|---|---|
| `isRead = false` | Unread — default on creation |
| `isRead = true` | Read — set by mark-read or mark-all-read |

### Status

`CONFIRMED_FROM_CODE`

### Evidence

- `V102__create_admin_notifications_table.sql` — persistent `admin_notifications` table with `is_read` column.
- `AdminNotificationController.java` — `GET /api/v1/admin/notifications` (list unread + count), `POST /mark-read`, `POST /mark-all-read`.
- `AdminNotificationService.java` — `listUnread()`, `countUnread()`, `markRead()`, `markAllRead()`.
- WS push via `AdminOrderWsService` supplements persistent store; admin offline will not miss events.

### Notes

- Archive/delete state not implemented.
- Email delivery status not tracked in repo.

## 15. Cross-Entity State Dependencies

| Source Entity | Source State | Affected Entity | Required / Resulting State | Reason | Status |
|---|---|---|---|---|---|
| Product | `PUBLISHED` | Public Web | Product can be returned by public catalog. | Public catalog filters only `PUBLISHED`. | `CONFIRMED_BACKEND_ENFORCED` |
| Product | non-`PUBLISHED` | Checkout / Quick-buy | Quick-buy rejects product. | Prevent ordering unavailable product. | `CONFIRMED_BACKEND_ENFORCED` |
| Category | `visible = false` | Public Web | Category excluded or not found. | Public category read filters visible. | `CONFIRMED_BACKEND_ENFORCED` |
| Brand | `visible = false` | Public Web | Brand excluded or not found. | Public brand read filters visible. | `CONFIRMED_BACKEND_ENFORCED` |
| Order | `CANCELLED` | Inventory | No stock change (V261). | Availability is a manual boolean — cancelling does not restore quantity. | `CONFIRMED_FROM_CODE` |
| Order | `COMPLETED` | Order timestamps | `completedAt` set if null. | Record completion time. | `CONFIRMED_BACKEND_ENFORCED` |
| Order | `CANCELLED` | Order timestamps | `cancelledAt` set if null. | Record cancellation time. | `CONFIRMED_BACKEND_ENFORCED` |
| Payment | `PAID` | Payment record | Payment record can be set `SUCCEEDED`; paidAt set. | Reflect successful payment. | `CONFIRMED_BACKEND_ENFORCED` |
| Content | `PUBLISHED` | Public Web / SEO | `publishedAt` set; web revalidation triggered. | Public content lifecycle. | `CONFIRMED_BACKEND_ENFORCED`; public filtering `NEEDS_VERIFICATION` |
| Media | `DELETED` | Media Library | Excluded by default from admin media list. | Avoid showing deleted media. | `CONFIRMED_BACKEND_ENFORCED` |
| Admin User | `DISABLED` / `SUSPENDED` | Auth/API | Should block login/API use. | Security. | `NEEDS_VERIFICATION` |
| ~~Shipping Method~~ | — | — | **REMOVED 2026-06-23** (`SHIP_RULE_001`): shipping-method management dropped (V264); no shipping choice or fee at checkout. | — | `REMOVED` |

## 16. Invalid Transition Policy

- Transition không nằm trong allowed transition map phải bị backend reject.
- Unknown status phải bị backend reject với validation error.
- Same-state update có thể là no-op nếu service code explicitly cho phép.
- Frontend chỉ được hide/disable action để UX tốt hơn, không thay thế backend validation.
- Negative tests nên cover transition bị cấm.
- API không được update status trực tiếp nếu thiếu service/domain validation.
- Side effects như stock restore, notification phải nằm trong transactional service flow nếu ảnh hưởng dữ liệu bền vững.
- **Audit log là best-effort, non-blocking:** ghi qua `AuditLogWriter` trong một giao dịch RIÊNG (`REQUIRES_NEW`) có bọc try/catch. Lỗi ghi nhật ký KHÔNG được rollback hay làm hỏng thao tác nghiệp vụ chính (`AuditLogWriter.java`, `AuditLogPersister.java`).

## 17. Backend Enforcement Requirements

| Requirement | Applies To | Current Evidence | Status |
|---|---|---|---|
| Transition validation nằm ở service/domain layer. | Product, content, order, payment, media, admin user. | Validators/services contain maps/guards. | `CONFIRMED_BACKEND_ENFORCED` |
| Controller/API không update status tùy ý nếu thiếu validation. | Admin mutation APIs. | Controllers delegate to services. | `CONFIRMED_BACKEND_ENFORCED` for audited controllers |
| Permission checked before transition. | Admin product/order/content/media/settings/users. | Controllers call `requirePermission` in audited modules. | `CONFIRMED_BACKEND_ENFORCED`; full matrix separate |
| Preconditions checked before transition. | Product/category/order/payment/media/admin user. | Validations and conflicts present. | `CONFIRMED_BACKEND_ENFORCED` for audited flows |
| Side effects atomic. | Order/payment/inventory/content/media. | Transactional annotations present on mutation methods. | `CONFIRMED_BACKEND_ENFORCED`; runtime DB transaction tests missing |
| Invalid transition error clear. | Product/order/payment/admin user/media. | Validation/conflict messages present. | `CONFIRMED_BACKEND_ENFORCED` |
| Positive/negative tests cover transitions. | All critical state machines. | Direct tests not found by targeted search. | `MISSING_TEST_COVERAGE` |

## 18. Test Coverage Requirements

| Entity | Transition | Positive Test | Negative Test | Status |
|---|---|---|---|---|
| Product | All `PublishStatus` allowed transitions | Needed | Needed | `MISSING_TEST_COVERAGE` |
| Product | Forbidden transitions such as `PUBLISHED -> DRAFT`, `TRASH -> PUBLISHED` | Needed | Needed | `MISSING_TEST_COVERAGE` |
| Category | Hide category without visible children | Needed | Needed for visible child conflict | `MISSING_TEST_COVERAGE` |
| Brand | Visible true/false public filtering | Needed | Needed | `MISSING_TEST_COVERAGE` |
| Order | Allowed order transitions map | Needed | Needed for terminal state invalid transitions | `MISSING_TEST_COVERAGE` |
| Payment | Allowed payment transitions map | Needed | Needed for terminal/invalid transitions and invalid partial amount | `MISSING_TEST_COVERAGE` |
| Shipping | Enabled/disabled/multiple methods checkout selection | Needed | Needed | `MISSING_TEST_COVERAGE` |
| Inventory | Availability boolean toggle | Per-variant `isAvailable` checkout gate covered by checkout API tests | Availability-toggle endpoint tests still needed (V261) | `PARTIAL_TEST_COVERAGE` |
| Admin User | `ACTIVE -> DISABLED/SUSPENDED`, restore to active | Needed | Needed for self-deactivation/Super Admin demotion | `MISSING_TEST_COVERAGE` |
| Content | Publish transitions and delete to archive | Needed | Needed for forbidden transitions | `MISSING_TEST_COVERAGE` |
| Media | Upload active, update inactive/deleted, restore active, hard delete | Needed | Needed for invalid status/MIME/size | `MISSING_TEST_COVERAGE` |
| Notification | Read/unread (`isRead`) | `CONFIRMED_FROM_CODE` | `AdminNotificationController` covers mark-read; archive not implemented. |

Notes:

- This task did not run build/test/runtime.
- Targeted repository search did not reveal obvious direct test files for key transition services.
- Existing phase reports are useful historical evidence but not a fresh CI proof.

## 19. Missing / Not Confirmed State Machines

| Entity / State Machine | Status | Gap |
|---|---|---|
| Payment Provider/Webhook lifecycle | `NOT_FOUND_IN_REPO` | No automatic payment gateway. Online checkout accepts only `COD`/`BACS`, both reconciled manually by admin. No payment redirect, no provider webhook. The Alepay/ZaloPay gateway plan was dropped. |
| Shipping Provider/Tracking lifecycle | `NOT_FOUND_IN_REPO` | No carrier waybill/tracking/status state machine found. |
| Fulfillment status lifecycle | `STATUS_ONLY` / `NEEDS_VERIFICATION` | `fulfillmentStatus` exposed in order detail, no transition map found. |
| Serial lifecycle | `REMOVED` | Serial-number tracking was removed platform-wide (2026-06-23, V259). There is no serial lifecycle. Inventory is manual quantity only. |
| Notification read/unread lifecycle | `CONFIRMED_FROM_CODE` | `admin_notifications` table (V102) + `AdminNotificationController` mark-read/mark-all-read. Archive not implemented. |
| Settings lifecycle | `STATUS_ONLY` / `NEEDS_VERIFICATION` | Settings APIs exist; no state machine confirmed. |
| Review moderation lifecycle | `NEEDS_VERIFICATION` | Review controllers exist in prior docs, but review status transitions not audited here. |
| Customer account status lifecycle | `NEEDS_VERIFICATION` | Customer auth exists, but customer status/disable lifecycle not confirmed. |
| Admin role lifecycle | `STATUS_ONLY` / `NEEDS_VERIFICATION` | Custom role CRUD exists, but role active/inactive lifecycle not confirmed. |
| POS order lifecycle | `REMOVED` | POS (point of sale / walk-in / `IN_STORE`) was removed platform-wide (owner decision 2026-06-23, online-only). There is no longer a POS create-order path, no auto-complete-at-counter order, and no `IN_STORE` fulfillment branch. Every order now flows through the online order + delivery state machines above. |

## 20. Evidence Summary

| Entity | Evidence Path | What It Proves | Confidence |
|---|---|---|---|
| Product publish | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/domain/catalog/PublishStatus.java` | Actual publish statuses. | High |
| Product/content publish transitions | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMutationValidators.java` | Allowed/forbidden publish transitions. | High |
| Product mutation | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCatalogMutationService.java` | Product create/update/publish/soft-delete uses transition validation. | High |
| Public product/category/brand visibility | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/catalog/CatalogReadService.java` | Product `PUBLISHED` and category/brand visible filters. | High |
| Order/payment transitions | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java` | Order/payment allowed transition maps, timestamps, audit, notification/websocket side effects. (No stock restore — availability is a manual boolean, V261.) | High |
| Checkout initial state | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java` | COD/BACS initial order/payment state, per-variant `isAvailable` gate, order creation. (No quantity decrement — V261.) | High |
| Inventory states | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/domain/catalog/ProductStockState.java` | Product stock states. | High |
| Inventory availability | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminInventoryController.java` | Per-variant / per-product boolean availability toggle (V261); `stockState` mirrors it. | High |
| Content state | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminContentController.java` | Admin content accepted status filters and permission boundary. | Medium-High |
| Content transitions | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminContentMutationService.java` | Article/page create/update/delete, shared publish validator, publishedAt/revalidation side effects. | High |
| Media states | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java` | Media `ACTIVE/INACTIVE/DELETED`, upload active, delete/restore/hard delete behavior. | High |
| Admin user states | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminAdminUsersService.java` | Admin status values, user creation active, self-deactivation and Super Admin demotion guardrails. | High |
| Security/permissions | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java`, admin controllers | Admin/customer/public access boundary and role protection. | High |
| Existing business rules | `docs/business/BUSINESS_RULES.md` | Rule baseline for state-machine extraction. | High |
| Existing workflow overview | `docs/business/WORKFLOW_OVERVIEW.md` | Workflow context and cross-entity side effects. | High |
| Existing role doc | `docs/business/USER_ROLES.md` | Actor/role context for transitions. | High |

## 21. Known Ambiguities / Needs Verification

1. Product/content both use shared `PublishStatus`, but content admin controller status regex only exposes `DRAFT`, `PUBLISHED`, `HIDDEN`, `TRASH` for filters. DTO acceptance for legacy `PENDING`, `PRIVATE` should be verified.
2. Product public visibility is confirmed in `CatalogReadService`, but cache/revalidation/public UI behavior should be verified.
3. Content public visibility filtering needs deeper audit of public content read service.
4. Order and payment transitions are backend-enforced, but direct tests were not found by targeted search.
5. `PaymentEntity.status` full lifecycle is only partially observed through order service side effects; full enum/status source should be audited.
6. Inventory availability is a per-variant / per-product boolean toggle (V261); `stockState` mirrors it. Selling does not change availability — admin marks items "Hết hàng" by hand (oversell not auto-prevented). Serial tracking removed in V259.
7. `fulfillmentStatus` exists in order detail, but no transition map was found. Shipping/fulfillment lifecycle remains incomplete.
8. Admin user `DISABLED`/`SUSPENDED` status updates are backend-enforced, but login/API blocking behavior for those statuses needs auth-service audit.
9. Media `INACTIVE` status exists, but whether inactive media can be rendered by product/content public pages needs verification.
10. Notification read/unread/archive state machine was not found. Only email/websocket side effects are confirmed.
11. Payment/shipping external provider state machines are not found.
12. Frontend hide/disable action behavior by status was not deeply audited in this task.
13. Build/test/runtime were not run during this documentation task. Do not treat this file as green-build evidence.

## 22. Relationship With Other Docs

| Document | Relationship |
|---|---|
| `PROJECT_OVERVIEW.md` | Tổng quan dự án: BigBike là gì. |
| `BUSINESS_PROCESS.md` | Process nghiệp vụ sử dụng state machines. |
| `MODULE_CATALOG.md` | Module và feature chứa entity/status. |
| `USER_ROLES.md` | Actor/role thực hiện transition. |
| `WORKFLOW_OVERVIEW.md` | Workflow end-to-end dùng state machine. |
| `BUSINESS_RULES.md` | Business rule chi phối transition. |
| `STATE_MACHINES.md` | File hiện tại: entity được phép chuyển trạng thái như thế nào. |
| `ACCEPTANCE_CRITERIA.md` | Nên định nghĩa pass/fail theo state/transition. |
| `API_CONTRACT.md` | API cập nhật state và error response chi tiết. |
| `DATA_CONTRACT.md` | Enum/status data shape. |
| `PERMISSION_MATRIX.md` | Role/permission được phép transition. |
| `TRACEABILITY_MATRIX.md` | Nối state machine với module/feature/API/DB/test. |

## Audit Notes

Documentation này được tạo bằng thao tác đọc/inspect repository qua GitHub connector. Không chạy migration, seed, deploy, refactor hoặc command có side effect. Không sửa business logic hoặc source code ứng dụng.
