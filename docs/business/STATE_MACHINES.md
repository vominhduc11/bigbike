# BigBike State Machines

## 1. Document Purpose

File này mô tả vòng đời trạng thái của các entity quan trọng trong BigBike. Mục tiêu là giúp business user, PM, BA, tester, developer mới và AI agent hiểu entity nào có trạng thái, trạng thái nào được phép chuyển, transition nào bị cấm, actor nào được chuyển, side effect sau transition là gì, và backend có enforce hay chưa.

File này dùng để tránh các lỗi kiểu:

- Product `DRAFT` hiển thị public.
- Order `COMPLETED` quay lại `PENDING` như chưa có chuyện gì xảy ra.
- Payment `REFUNDED` được chuyển lại `PAID` tùy hứng.
- Return `REJECTED` tự nhiên được `COMPLETED` như thể logic nghiệp vụ là trò tung xúc xắc.
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
| Order | `status` | `PENDING`, `PROCESSING`, `ON_HOLD`, `COMPLETED`, `CANCELLED`, `FAILED`, `REFUNDED` | Explicit allowed transition map in service. | Backend service | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java`, `CheckoutService.java` |
| Payment | `paymentStatus` on Order, `status` on Payment | Order payment: `UNPAID`, `PAID`, `REFUNDED`, `CANCELLED`. Payment record includes `PENDING`, `SUCCEEDED`, `REFUNDED` in observed service code. | Explicit order payment transition map; payment record status is updated as side effect. | Backend service | `CONFIRMED_BACKEND_ENFORCED` for order payment status; payment entity full lifecycle `STATUS_ONLY` | `AdminOrderService.java`, `CheckoutService.java` |
| Shipping / Fulfillment | `fulfillmentStatus`, shipping method enabled flag | `fulfillmentStatus` field observed in order detail; shipping method enabled/disabled inferred from checkout resolver. | Shipping method selection enforced; fulfillment state transitions not confirmed. | Partial backend | `STATUS_ONLY` / `NEEDS_VERIFICATION` | `AdminOrderService.java`, `CheckoutService.java`, `AdminShippingController.java` |
| Inventory / Stock | `stockState`, quantity fields | `IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK` | `stockState` là **derived field** — luôn tính tự động từ `quantityOnHand`. Admin không được set thủ công qua catalog API. Sản phẩm mới tạo luôn bắt đầu `OUT_OF_STOCK` (qty=0). Mọi thay đổi qty (nhập hàng, bán, huỷ, đổi trả) → recompute ngay. | Backend policy/service | `CONFIRMED_BACKEND_ENFORCED` | `ProductStockState.java`, `InventoryPolicyService.java`, `AdminCatalogMutationService.java`, `CheckoutService.java`, `AdminReturnService.java`, `OrderStockRestoreService.java`, `BUSINESS_RULES.md` STOCK_RULE_001–007 |
| Return | `status` | `PENDING`, `APPROVED`, `REJECTED`, `RECEIVED`, `COMPLETED`, `REFUNDED` | Explicit transition map. | Backend service | `CONFIRMED_BACKEND_ENFORCED` | `AdminReturnService.java`, `CustomerOrderController.java` |
| Admin User | `status`, `role` | Status: `ACTIVE`, `DISABLED`, `SUSPENDED`; Roles include `SUPER_ADMIN`, `ADMIN`, `EDITOR`, `SHOP_MANAGER`, `AUTHOR`, `CONTRIBUTOR`, `SEO_EDITOR`, custom roles. | Status/role update validation; self-deactivation and Super Admin demotion guardrails. | Backend service | `CONFIRMED_BACKEND_ENFORCED` for update guards; login-block behavior `NEEDS_VERIFICATION` | `AdminAdminUsersService.java`, `AdminRolePermissions.java`, `SecurityConfig.java` |
| Content Article/Page | `publishStatus` | Same `PublishStatus` enum; active values: `DRAFT`, `PUBLISHED`, `HIDDEN`, `TRASH`; legacy `ARCHIVED` migrated sang `HIDDEN`. | Publish transitions enforced on update; delete sets `ARCHIVED` (sẽ migrate sang `HIDDEN`). | Backend service | `CONFIRMED_BACKEND_ENFORCED`; public filtering `NEEDS_VERIFICATION` | `AdminContentController.java`, `AdminContentMutationService.java`, `AdminMutationValidators.java` |
| Media | `status` | `ACTIVE`, `INACTIVE`, `DELETED` | Upload creates `ACTIVE`; update validates allowed statuses; soft-delete sets `DELETED`; restore sets `ACTIVE`; hard-delete removes row/object. | Backend service | `CONFIRMED_BACKEND_ENFORCED` | `AdminMediaService.java` |
| Notification | Not confirmed as persisted status | Email/websocket events observed, no read/unread/archive state found. | No state machine found. | Unknown | `NOT_FOUND_IN_REPO` | `OrderNotificationService`, `AdminOrderWsService` usage only |
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

### Test Coverage

- Direct tests not found in targeted search.
- Status: `MISSING_TEST_COVERAGE`.

### Needs Verification

- Default visibility on create.
- Whether hidden category can still be assigned to products.
- Brand delete is visibility false; hard-delete not confirmed.

## 6. Order State Machine

### Purpose

Order state machine kiểm soát vòng đời xử lý đơn hàng sau checkout: pending/on-hold/processing/completed/cancelled/failed/refunded.

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
- `REFUNDED`

### Initial State

From checkout behavior:

- `COD` creates order with `PROCESSING`.
- `BACS` creates order with `ON_HOLD`.
- `PENDING` exists as allowed order status, but checkout initial use needs deeper audit outside COD/BACS creation.

### Terminal States

- `CANCELLED`
- `FAILED`
- `REFUNDED`

`COMPLETED` is terminal in `ALLOWED_TRANSITIONS` — direct status patch to `REFUNDED` is blocked. Refund must go through `POST /admin/orders/{id}/refund` → `RefundService.applyRefund`.

### Allowed Transitions

| From | To | Actor / Role | Preconditions | Side Effects | Enforcement | Evidence |
|---|---|---|---|---|---|---|
| `PENDING` | `PROCESSING` | Admin / `orders.write` | Order exists. | Audit log, status email, websocket event. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java` |
| `PENDING` | `ON_HOLD` | Admin / `orders.write` | Order exists. | Audit log, notification, websocket. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java` |
| `PENDING` | `CANCELLED` | Admin / `orders.write` | Order exists; `paymentStatus` is NOT `PAID` (see ORDER_RULE_004 in `BUSINESS_RULES.md`). (`PARTIALLY_PAID` removed in V114.) | Set `cancelledAt`, restore stock, audit, notification, websocket. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java#validateBeforeCancel` |
| `PENDING` | `FAILED` | Admin / `orders.write` | Order exists. | Release serial reservations, restore stock, audit, notification, websocket. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java` |
| `ON_HOLD` | `PROCESSING` | Admin / `orders.write` | Order exists. | Audit, notification, websocket. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java` |
| `ON_HOLD` | `CANCELLED` | Admin / `orders.write` | Order exists; `paymentStatus` is NOT `PAID`. (`PARTIALLY_PAID` removed in V114.) | Set `cancelledAt`, restore stock, audit, notification, websocket. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java#validateBeforeCancel` |
| `ON_HOLD` | `FAILED` | Admin / `orders.write` | Order exists. | Release serial reservations, restore stock, audit, notification, websocket. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java` |
| `PROCESSING` | `COMPLETED` | Admin / `orders.write` | For `DELIVERY`: `fulfillmentStatus = DELIVERED`. For `COD`: `paymentStatus = PAID`. `UNPAID` only allowed for `CREDIT` orders with a customer (see ORDER_RULE_002/003 and AR_RULE_001 in `BUSINESS_RULES.md`). (`PARTIALLY_PAID` removed in V114.) | Set `completedAt`, audit, notification, websocket. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java#validateBeforeComplete` |
| `PROCESSING` | `CANCELLED` | Admin / `orders.write` | `paymentStatus` is NOT `PAID`. (`PARTIALLY_PAID` removed in V114.) PAID must go through `POST /admin/orders/{id}/refund`. | Set `cancelledAt`, release serials, restore non-serial stock, audit, notification, websocket. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java#validateBeforeCancel` |
| `PROCESSING` | `FAILED` | Admin / `orders.write` | Order exists. | Release serial reservations, restore stock, audit, notification, websocket. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java` |
| `COMPLETED` | `REFUNDED` | n/a — direct status patch is rejected | Must go through `POST /admin/orders/{id}/refund` → `RefundService.applyRefund`. Direct patch is blocked by the empty allowed-transition set. | RefundService writes refund_transaction, payment.refundAmount, voids warranty, restores SOLD serials, writes off open receivable, and flips status to `REFUNDED` atomically. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java` (terminal map), `RefundService.java` |

### Forbidden Transitions

| From | To | Reason | Enforcement | Evidence |
|---|---|---|---|---|
| `COMPLETED` | `PENDING` / `PROCESSING` / `ON_HOLD` / `CANCELLED` / `FAILED` / `REFUNDED` | `COMPLETED` is terminal in `ALLOWED_TRANSITIONS`. REFUNDED specifically must go through `RefundService` so refund_transaction, payment.refundAmount, warranty void, SOLD serial restore, and receivable write-off stay atomic. | Backend throws conflict. | `AdminOrderService.java`, `RefundService.java` |
| `PROCESSING` / `PENDING` / `ON_HOLD` | `COMPLETED` (when `DELIVERY` + `fulfillmentStatus != DELIVERED`) | Rule 3: cannot complete a delivery order before goods are delivered. | Backend throws conflict with message `Chỉ được hoàn thành đơn giao hàng sau khi đã giao thành công.` | `AdminOrderService.java#validateBeforeComplete` |
| `PROCESSING` | `COMPLETED` (when `paymentMethod = COD` + `paymentStatus != PAID`) | Rule 2: COD must collect cash before completion. | Backend throws conflict with message `Đơn COD phải được thu tiền trước khi hoàn thành.` | `AdminOrderService.java#validateBeforeComplete` |
| `PROCESSING` | `COMPLETED` (when `UNPAID` and NOT a CREDIT order with customer) | Rule 1: only credit/receivable orders may be COMPLETED unpaid. (`PARTIALLY_PAID` removed in V114.) | Backend throws conflict with message `Đơn chưa thanh toán chỉ được hoàn thành khi là đơn công nợ có khách hàng hợp lệ.` | `AdminOrderService.java#validateBeforeComplete` |
| `PROCESSING` / `PENDING` / `ON_HOLD` | `CANCELLED` (when `paymentStatus = PAID`) | Rule 4: money has already changed hands; must go through refund/void flow so payment record, receivable, audit log, and stock/serial lifecycle stay consistent. (`PARTIALLY_PAID` removed in V114.) | Backend throws conflict with message `Đơn đã có thanh toán, cần xử lý hoàn tiền/void trước khi hủy.` Stock is NOT restored. | `AdminOrderService.java#validateBeforeCancel` |
| `CANCELLED` | any other status | Terminal state, no outgoing transitions. | Backend throws conflict. | `AdminOrderService.java` |
| `FAILED` | any other order status | Terminal state, no outgoing transitions. | Backend throws conflict. | `AdminOrderService.java` |
| `REFUNDED` | any other order status | Terminal state, no outgoing transitions. | Backend throws conflict. | `AdminOrderService.java` |
| any status | unknown status | Not in `ALLOWED_ORDER_STATUSES`. | Backend validation error. | `AdminOrderService.java` |
| same status | same status | Idempotent no-op; returns current detail. | Backend no write. | `AdminOrderService.java` |

### Related Payment / Inventory / Shipping Impact

| Impact | Evidence | Status |
|---|---|---|
| `CANCELLED`, `FAILED`, or `REFUNDED` triggers `restoreStockForOrder` + `releaseReservationForOrder`. `FAILED` was a gap prior to the E2E audit fix — added in same commit. | `AdminOrderService.java`, `OrderStockRestoreService.java` | `CONFIRMED_BACKEND_ENFORCED` |
| `COMPLETED` sets `completedAt` if missing. | `AdminOrderService.java` | `CONFIRMED_BACKEND_ENFORCED` |
| `CANCELLED` sets `cancelledAt` if missing. | `AdminOrderService.java` | `CONFIRMED_BACKEND_ENFORCED` |
| Full refund via `RefundService` flips order status to `REFUNDED` for any non-terminal order (PENDING, ON_HOLD, PROCESSING, COMPLETED). CANCELLED/FAILED/REFUNDED orders are not touched. | `RefundService.java` | `CONFIRMED_BACKEND_ENFORCED` |
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
- Status: `MISSING_TEST_COVERAGE`.

### Needs Verification

- Fresh tests for every allowed and forbidden transition.
- Whether order `PENDING` is used by any checkout/POS flow.
- Fulfillment status relation.

## 7. Payment State Machine

### Purpose

Payment state machine quản lý trạng thái thanh toán trên order và side effects lên payment record/refund.

### State Field

- `OrderEntity.paymentStatus`
- `PaymentEntity.status` observed through service side effects.

### States

From `AdminOrderService.ALLOWED_PAYMENT_STATUSES` (simplified V114):

- `UNPAID`
- `PAID`
- `REFUNDED`
- `CANCELLED`

Payment record statuses observed:

- `PENDING`
- `SUCCEEDED`
- `REFUNDED`

Full `PaymentEntity.status` enum/lifecycle was not fully audited. Treat payment entity lifecycle as `STATUS_ONLY` beyond observed service writes.

### Initial State

Checkout creates:

- `Order.paymentStatus = UNPAID`
- `Payment.status = PENDING`

### Terminal States

For order payment status map:

- `REFUNDED`
- `CANCELLED`

### Allowed Transitions (simplified V114)

| From | To | Actor / Role | Preconditions | Side Effects | Enforcement | Evidence |
|---|---|---|---|---|---|---|
| `UNPAID` | `PAID` | Admin / `orders.write` | Order exists; paidAmount default total or provided. | Set paidAmount, paidAt; payment record `SUCCEEDED`. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java` |
| `UNPAID` | `CANCELLED` | Admin / `orders.write` | Order exists. | paymentStatus updated. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java` |
| `PAID` | `REFUNDED` | Admin via `POST /admin/orders/{id}/refund` | Full refund only — refundAmount must equal paidAmount. `PAID→REFUNDED` via direct `PATCH /payment-status` is blocked (returns 409). | refundAmount/refundedAt; payment record `REFUNDED`; order status → `REFUNDED` for any non-terminal order (PENDING/ON_HOLD/PROCESSING/COMPLETED). | `CONFIRMED_BACKEND_ENFORCED` | `RefundService.java` |
| `PAID` | `UNPAID` | Admin / `orders.write` | paidAmount must be 0 if provided; `refundAmount` must be 0 (cannot revert after refund applied). | Reset paidAmount and paidAt. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java` |

### Forbidden Transitions

| From | To | Reason | Enforcement | Evidence |
|---|---|---|---|---|
| `REFUNDED` | any other payment status | Terminal, no outgoing transitions. | Backend rejects. | `AdminOrderService.java` |
| `CANCELLED` | any other payment status | Terminal, no outgoing transitions. | Backend rejects. | `AdminOrderService.java` |
| any status | unknown payment status | Not in allowed payment statuses. | Backend validation error. | `AdminOrderService.java` |
| `PAID` | `REFUNDED` via direct status patch | Must go through RefundService to keep audit/stock/serial lifecycle consistent. | Backend rejects direct patch. | `AdminOrderService.java` |

### Webhook / Callback

- No payment webhook/provider transition was found.
- Signature verification/idempotency state handling is `NOT_FOUND_IN_REPO`.

### Frontend Behavior

- Admin API client supports payment status updates in prior docs, but UI state behavior was not audited here.

### Backend Enforcement

- `ALLOWED_PAYMENT_TRANSITIONS` map enforces order payment status transitions.
- Partial paid amount must be `> 0` and `< totalAmount`.
- Unpaid paidAmount must be zero if provided.
- Refund requires `paymentStatus = PAID` order and refund amount equal to the full paidAmount (partial refunds not supported — `RefundService` enforces full-only since V114). (`PARTIALLY_PAID` removed in V114.)

### Test Coverage

- Direct tests not found by targeted search.
- Phase 1F report documents checkout behavior but fresh tests were not run.
- Status: `MISSING_TEST_COVERAGE` / `NEEDS_VERIFICATION`.

### Needs Verification

- Full `PaymentEntity.status` enum/lifecycle.
- External gateway/webhook lifecycle.
- Revenue/report impact of partial/full refund.

## 8. Shipping / Fulfillment State Machine

### Purpose

Tracks the physical delivery lifecycle of `DELIVERY` orders. `IN_STORE` (POS) orders do not enter this state machine — goods change hands at the counter when the order is created.

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
| `UNFULFILLED` | `DELIVERED` | Must go through PROCESSING → SHIPPED first so tracking data is captured. Walk-in/POS use `IN_STORE` fulfillment type and bypass this machine entirely. | Backend rejects (409). | `AdminOrderService.java` |
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

## 9. Inventory / Stock / Serial State Machine

### Purpose

Inventory state machine in current evidence is not a full serial lifecycle. It is mainly stock quantity + stockState recomputation for product/variant availability.

### State Field

- `stockState`
- Quantity fields such as stock quantity / variant quantity on hand.
- Stock movement records (`IN`, `OUT`) for audit trail.

### States

From `ProductStockState.java`:

- `IN_STOCK`
- `LOW_STOCK`
- `OUT_OF_STOCK`

### Initial State

- Product create forces `stockState = OUT_OF_STOCK` regardless of request payload — `stockState` is a derived field, computed from `quantityOnHand` once stock is recorded via the Inventory module.
- The admin product form does not expose a stockState picker (removed 2026-05-14). Inventory module (`AdminInventoryController`) and `InventoryPolicyService` are the only writers.
- Variants inherit the same rule via `applyVariants` in `AdminCatalogMutationService`.

### Allowed Transitions

| From | To | Actor / Role | Preconditions | Side Effects | Enforcement | Evidence |
|---|---|---|---|---|---|---|
| quantity `> threshold` | `IN_STOCK` | System | Tự động recompute sau mọi thay đổi số lượng. | Variant stockState updated. | `CONFIRMED_BACKEND_ENFORCED` | `InventoryPolicyService.java` |
| quantity `1..threshold` | `LOW_STOCK` | System | Tự động recompute. | Variant stockState updated. | `CONFIRMED_BACKEND_ENFORCED` | `InventoryPolicyService.java` |
| quantity `<= 0` | `OUT_OF_STOCK` | System | Tự động recompute. | Variant stockState updated. | `CONFIRMED_BACKEND_ENFORCED` | `InventoryPolicyService.java` |
| stock quantity | decrement | System | Checkout/quick-buy order created and stock available. | Stock movement `OUT` for variant; stock state recompute. | `CONFIRMED_BACKEND_ENFORCED` | `CheckoutService.java` |
| stock quantity | increment | System | Order cancelled/refunded or return completed. | Stock movement `IN` for variant restore flow; stock state recompute. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java`, `AdminReturnService.java` |

### Forbidden Transitions / States

| From | To | Reason | Enforcement | Evidence |
|---|---|---|---|---|
| available stock insufficient | order-created stock decrement | Cannot sell beyond stock. | Backend rejects checkout. | `CheckoutService.java` |
| serial lifecycle states | any | Serial lifecycle not fully confirmed. | `NEEDS_VERIFICATION` | `StockMovementSerialEntity` referenced in prior docs only |

### Frontend Behavior

- Inventory admin module exists; UI transitions/badges need audit.

### Backend Enforcement

- Stock state recomputation is backend service policy.
- Checkout validates stock before decrement.
- Cancel/refund/return restore stock where service paths apply.

### Test Coverage

- Direct tests not found by targeted search.
- Status: `MISSING_TEST_COVERAGE`.

### Needs Verification

- Serial-level lifecycle.
- Product-level stock movement symmetry.
- Concurrency/oversell tests.
- Admin manual stock adjust state recompute details.

## 10. Return / Refund State Machine

### Purpose

Return state machine kiểm soát quy trình đổi/trả sau khi customer tạo return và admin xử lý.

### State Field

`ReturnEntity.status`

### States

From `AdminReturnService.TRANSITIONS` and notification logic:

- `PENDING`
- `APPROVED`
- `REJECTED`
- `RECEIVED`
- `INSPECTING` *(added V104 — optional QC step for safety-equipment domain)*
- `COMPLETED`
- `REFUNDED`

### Initial State

- `PENDING` inferred as initial state because transition map starts at `PENDING` and customer return creation exists; exact creation service should be audited.

### Terminal States

- `REJECTED`
- `COMPLETED`
- `REFUNDED`

### Allowed Transitions

| From | To | Actor / Role | Preconditions | Side Effects | Enforcement | Evidence |
|---|---|---|---|---|---|---|
| `PENDING` | `APPROVED` | Admin / return write permission | Return exists. | History record; customer notification. | `CONFIRMED_BACKEND_ENFORCED` | `AdminReturnService.java` |
| `PENDING` | `REJECTED` | Admin / return write permission | Return exists. | History record; customer notification. | `CONFIRMED_BACKEND_ENFORCED` | `AdminReturnService.java` |
| `APPROVED` | `RECEIVED` | Admin / return write permission | Return exists and approved. | History record; goods received notification; serial-tracked items marked `RETURNED`. | `CONFIRMED_BACKEND_ENFORCED` | `AdminReturnService.java` |
| `RECEIVED` | `INSPECTING` | Admin / return write permission | Goods received. | History record; no customer email. Enables per-item PASS/FAIL via `PATCH /returns/{id}/items/{itemId}/inspect`. | `CONFIRMED_BACKEND_ENFORCED` | `AdminReturnService.java` (V104) |
| `RECEIVED` | `COMPLETED` | Admin / return write permission | Goods received. | Restore stock for return items (variant-based); history record. No refund issued. | `CONFIRMED_BACKEND_ENFORCED` | `AdminReturnService.java` |
| `RECEIVED` | `REFUNDED` | Admin / return write permission | Goods received; `refundAmount` required (`> 0`, `≤ paidAmount − alreadyRefunded`). | Restore stock for return items (same as COMPLETED — goods physically returned); sync `orders.refundAmount`/`paymentStatus`/`refundedAt`; update `PaymentEntity`; audit log; order note; WS event; refunded notification. | `CONFIRMED_BACKEND_ENFORCED` | `AdminReturnService.java`, `RefundService.java` |
| `INSPECTING` | `COMPLETED` | Admin / return write permission | Every `ReturnItem` has `inspection_result` set (PASS or FAIL). | Restore stock **only for items marked PASS**; FAIL items kept out of inventory (defective / customer-damaged). History record. | `CONFIRMED_BACKEND_ENFORCED` | `AdminReturnService.java` (V104) |
| `INSPECTING` | `REFUNDED` | Admin / return write permission | Every `ReturnItem` has `inspection_result` set; `refundAmount` required. | Same as `RECEIVED → REFUNDED` but stock restore skips FAIL items. | `CONFIRMED_BACKEND_ENFORCED` | `AdminReturnService.java` (V104), `RefundService.java` |

### Forbidden Transitions

| From | To | Reason | Enforcement | Evidence |
|---|---|---|---|---|
| `PENDING` | `RECEIVED` / `COMPLETED` / `REFUNDED` | Must approve first. | Backend rejects. | `AdminReturnService.java` |
| `APPROVED` | `COMPLETED` / `REFUNDED` / `REJECTED` | Must mark received first. | Backend rejects. | `AdminReturnService.java` |
| `RECEIVED` | `PENDING` / `APPROVED` / `REJECTED` | Not in transition map. | Backend rejects. | `AdminReturnService.java` |
| `REJECTED` | any state | No outgoing transitions. | Backend rejects via default empty set. | `AdminReturnService.java` |
| `COMPLETED` | any state | No outgoing transitions. | Backend rejects via default empty set. | `AdminReturnService.java` |
| `REFUNDED` | any state | No outgoing transitions. | Backend rejects via default empty set. | `AdminReturnService.java` |

### Related Refund / Inventory Impact

| Transition | Side Effect | Evidence | Status |
|---|---|---|---|
| `RECEIVED -> COMPLETED` | Restore stock for return items with variant. | `AdminReturnService.java` | `CONFIRMED_BACKEND_ENFORCED` |
| `INSPECTING -> COMPLETED` | Restore stock **only for items with `inspection_result = 'PASS'`**; FAIL items skipped. | `AdminReturnService.java` (V104) | `CONFIRMED_BACKEND_ENFORCED` |
| `INSPECTING -> REFUNDED` | Same as `RECEIVED -> REFUNDED` but skips FAIL items during stock restore. | `AdminReturnService.java` (V104) | `CONFIRMED_BACKEND_ENFORCED` |
| any valid transition | Save return history. | `AdminReturnService.java` | `CONFIRMED_BACKEND_ENFORCED` |
| `PENDING -> APPROVED` | Send approved notification. | `AdminReturnService.java` | `CONFIRMED_BACKEND_ENFORCED` for service call; delivery runtime `NEEDS_VERIFICATION` |
| `PENDING -> REJECTED` | Send rejected notification. | `AdminReturnService.java` | same |
| `APPROVED -> RECEIVED` | Send goods received notification. | `AdminReturnService.java` | same |
| `RECEIVED -> REFUNDED` | Sync order refundAmount if provided; send refunded notification. | `AdminReturnService.java` | `CONFIRMED_BACKEND_ENFORCED`; payment record impact `NEEDS_VERIFICATION` |
| `RECEIVED -> INSPECTING` | No customer email. Items remain in QC; admin must call `PATCH /items/{itemId}/inspect` for each before closing. | `AdminReturnService.java` (V104) | `CONFIRMED_BACKEND_ENFORCED` |

### Inspection Sub-Workflow (V104)

For BigBike, every return item touching safety gear (mũ bảo hiểm, áo giáp) should pass through `INSPECTING` before COMPLETED/REFUNDED so admins can confirm goods are sellable. INSPECTING is **optional** for backward compatibility — direct `RECEIVED -> COMPLETED/REFUNDED` is still accepted, in which case all received items are treated as PASS.

Per-item inspection rules:

- Endpoint: `PATCH /api/v1/admin/returns/{returnId}/items/{itemId}/inspect`
- Body: `{ "result": "PASS"|"FAIL", "note": "..." }`
- Allowed only when parent return status is `INSPECTING`.
- Idempotent: calling again overwrites the previous decision and refreshes `inspected_at` / `inspected_by_admin_id`.
- `INSPECTING -> COMPLETED/REFUNDED` is blocked until **every** ReturnItem has an inspection result.
- Items marked `FAIL` are **excluded from stock restore** so customer-damaged goods cannot re-enter inventory.

### Frontend Behavior

- Admin returns module exists; UI transition actions by status need audit.
- Customer return create/list/detail exists; eligibility rules need deeper audit.

### Backend Enforcement

- `TRANSITIONS` map enforces return transition.
- Invalid transition throws validation error.

### Test Coverage

- Direct tests not found by targeted search.
- Status: `MISSING_TEST_COVERAGE`.

### Needs Verification

- Customer-created return initial status and eligibility rules.
- Payment/order/report impact of return `REFUNDED` vs order refund flow.

## 11. User / Admin User State Machine

### Purpose

Admin user state machine kiểm soát internal account lifecycle và role safety guardrails.

### State Fields

- `AdminUserEntity.status`
- `AdminUserEntity.role`

### States

From `AdminAdminUsersService.VALID_STATUSES`:

- `ACTIVE`
- `DISABLED`
- `SUSPENDED`

Built-in roles:

- `SUPER_ADMIN`
- `ADMIN`
- `EDITOR`
- `SHOP_MANAGER`
- `AUTHOR`
- `CONTRIBUTOR`
- `SEO_EDITOR`

Custom role support exists through role repository/controller.

### Initial State

- New admin user is created with `status = ACTIVE`.

### Terminal States

- No terminal status confirmed. `DISABLED` and `SUSPENDED` can likely be changed back through update if allowed, but exact transition restrictions are minimal.

### Allowed Transitions

| From | To | Actor / Role | Preconditions | Side Effects | Enforcement | Evidence |
|---|---|---|---|---|---|---|
| N/A | `ACTIVE` | Admin / `admin-users.write` | Valid email, displayName, role, password >= 8. | Admin user created; audit log. | `CONFIRMED_BACKEND_ENFORCED` | `AdminAdminUsersService.java` |
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
| any status | unknown status | Must be `ACTIVE`, `DISABLED`, or `SUSPENDED`. | Backend rejects. | `AdminAdminUsersService.java` |
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

- `ARCHIVED` is delete target for content delete.
- Not strictly terminal because shared validator allows `ARCHIVED -> DRAFT`.

### Allowed Transitions

Same as Product publish transition validator for update operations:

| From | To | Actor / Role | Preconditions | Side Effects | Enforcement | Evidence |
|---|---|---|---|---|---|---|
| `DRAFT` | `PUBLISHED` / `ARCHIVED` / `TRASH` | Admin / Editor / Author with `content.update` | Content exists. | If `PUBLISHED`, set `publishedAt`; revalidate web tags. | `CONFIRMED_BACKEND_ENFORCED` | `AdminContentMutationService.java`, `AdminMutationValidators.java` |
| `PUBLISHED` | `HIDDEN` / `ARCHIVED` / `TRASH` | Admin / Editor / Author with `content.update` | Content exists. | If not `PUBLISHED`, clear `publishedAt`; revalidate. | `CONFIRMED_BACKEND_ENFORCED` | `AdminContentMutationService.java`, `AdminMutationValidators.java` |
| `HIDDEN` | `PUBLISHED` / `ARCHIVED` / `TRASH` | Admin / Editor / Author with `content.update` | Content exists. | Publish/clear publishedAt accordingly; revalidate. | `CONFIRMED_BACKEND_ENFORCED` | `AdminContentMutationService.java`, `AdminMutationValidators.java` |
| `ARCHIVED` | `DRAFT` / `TRASH` | Admin / Editor / Author with `content.update` | Content exists. | Re-open draft or trash. | `CONFIRMED_BACKEND_ENFORCED` | `AdminMutationValidators.java` |
| `PENDING` | `PUBLISHED` / `DRAFT` / `TRASH` | Admin / Editor / Author with `content.update` | Content exists; status accepted by DTO. | Review/import flow. | `CONFIRMED_BACKEND_ENFORCED` in shared validator; DTO acceptance `NEEDS_VERIFICATION` | `AdminMutationValidators.java` |
| `PRIVATE` | `PUBLISHED` / `DRAFT` / `HIDDEN` / `TRASH` | Admin / Editor / Author with `content.update` | Content exists; status accepted by DTO. | Private/import flow. | `CONFIRMED_BACKEND_ENFORCED` in shared validator; DTO acceptance `NEEDS_VERIFICATION` | `AdminMutationValidators.java` |
| `TRASH` | `DRAFT` | Admin / Editor / Author with `content.update` | Content exists. | Restore to draft. | `CONFIRMED_BACKEND_ENFORCED` in shared validator; content delete uses `ARCHIVED`, not `TRASH` | `AdminMutationValidators.java`, `AdminContentMutationService.java` |

### Forbidden Transitions

Same forbidden publish transition rules as product, enforced by shared validator.

### Frontend Behavior

- Admin content routes and API client exist.
- Specific status action visibility needs UI audit.

### Backend Enforcement

- Update article/page calls `validatePublishTransition`.
- Delete article/page sets `publishStatus = ARCHIVED` directly, not `TRASH`.
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
| upload | unsupported MIME | Only MIME whitelist accepted. | Backend validation error. | `AdminMediaService.java` |
| upload | > 50 MB | Upload limit. | Backend validation error. | `AdminMediaService.java` |

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

Not found.

### States

Not found.

### Status

`NOT_FOUND_IN_REPO`

### Evidence

- `CheckoutService`, `AdminOrderService`, `AdminReturnService` call notification/websocket services.
- No confirmed `UNREAD`, `READ`, `ARCHIVED` notification lifecycle found in audited evidence.

### Needs Verification

- Whether notification inbox is planned.
- Whether email delivery status is tracked.

## 15. Cross-Entity State Dependencies

| Source Entity | Source State | Affected Entity | Required / Resulting State | Reason | Status |
|---|---|---|---|---|---|
| Product | `PUBLISHED` | Public Web | Product can be returned by public catalog. | Public catalog filters only `PUBLISHED`. | `CONFIRMED_BACKEND_ENFORCED` |
| Product | non-`PUBLISHED` | Checkout / Quick-buy | Quick-buy rejects product. | Prevent ordering unavailable product. | `CONFIRMED_BACKEND_ENFORCED` |
| Category | `visible = false` | Public Web | Category excluded or not found. | Public category read filters visible. | `CONFIRMED_BACKEND_ENFORCED` |
| Brand | `visible = false` | Public Web | Brand excluded or not found. | Public brand read filters visible. | `CONFIRMED_BACKEND_ENFORCED` |
| Order | `CANCELLED` | Inventory | Stock restored. | Cancelled order returns inventory. | `CONFIRMED_BACKEND_ENFORCED` |
| Order | `REFUNDED` | Inventory | Stock restored when order status becomes `REFUNDED`. | Refunded order returns inventory. | `CONFIRMED_BACKEND_ENFORCED` |
| Order | `COMPLETED` | Order timestamps | `completedAt` set if null. | Record completion time. | `CONFIRMED_BACKEND_ENFORCED` |
| Order | `CANCELLED` | Order timestamps | `cancelledAt` set if null. | Record cancellation time. | `CONFIRMED_BACKEND_ENFORCED` |
| Payment | `PAID` | Payment record | Payment record can be set `SUCCEEDED`; paidAt set. | Reflect successful payment. | `CONFIRMED_BACKEND_ENFORCED` |
| Payment | full refund | Order | Payment status `REFUNDED`; order status may become `REFUNDED` only if allowed from current order status. | Keep order/payment consistent. | `CONFIRMED_BACKEND_ENFORCED` |
| Return | `COMPLETED` | Inventory | Return stock restored (variant-based). | Goods received back into warehouse, no refund. | `CONFIRMED_BACKEND_ENFORCED` |
| Return | `REFUNDED` | Inventory | Return stock restored (same as COMPLETED — goods physically returned). | Goods received + money refunded; stock must also return. | `CONFIRMED_BACKEND_ENFORCED` |
| Return | `REFUNDED` | Order / Payment | `orders.refundAmount` incremented; `paymentStatus` → `PARTIALLY_REFUNDED`/`REFUNDED`; `refundedAt` set; `PaymentEntity` synced; audit log; order note; WS event. | Unified via `RefundService.applyRefund`. | `CONFIRMED_BACKEND_ENFORCED` |
| Content | `PUBLISHED` | Public Web / SEO | `publishedAt` set; web revalidation triggered. | Public content lifecycle. | `CONFIRMED_BACKEND_ENFORCED`; public filtering `NEEDS_VERIFICATION` |
| Media | `DELETED` | Media Library | Excluded by default from admin media list. | Avoid showing deleted media. | `CONFIRMED_BACKEND_ENFORCED` |
| Admin User | `DISABLED` / `SUSPENDED` | Auth/API | Should block login/API use. | Security. | `NEEDS_VERIFICATION` |
| Shipping Method | disabled | Checkout | Cannot be selected. | Avoid invalid shipping method. | `CONFIRMED_BACKEND_ENFORCED` |

## 16. Invalid Transition Policy

- Transition không nằm trong allowed transition map phải bị backend reject.
- Unknown status phải bị backend reject với validation error.
- Same-state update có thể là no-op nếu service code explicitly cho phép.
- Frontend chỉ được hide/disable action để UX tốt hơn, không thay thế backend validation.
- Negative tests nên cover transition bị cấm.
- API không được update status trực tiếp nếu thiếu service/domain validation.
- Side effects như stock restore, audit log, notification phải nằm trong transactional service flow nếu ảnh hưởng dữ liệu bền vững.

## 17. Backend Enforcement Requirements

| Requirement | Applies To | Current Evidence | Status |
|---|---|---|---|
| Transition validation nằm ở service/domain layer. | Product, content, order, payment, return, media, admin user. | Validators/services contain maps/guards. | `CONFIRMED_BACKEND_ENFORCED` |
| Controller/API không update status tùy ý nếu thiếu validation. | Admin mutation APIs. | Controllers delegate to services. | `CONFIRMED_BACKEND_ENFORCED` for audited controllers |
| Permission checked before transition. | Admin product/order/return/content/media/settings/users. | Controllers call `requirePermission` in audited modules. | `CONFIRMED_BACKEND_ENFORCED`; full matrix separate |
| Preconditions checked before transition. | Product/category/order/payment/return/media/admin user. | Validations and conflicts present. | `CONFIRMED_BACKEND_ENFORCED` for audited flows |
| Side effects atomic. | Order/payment/return/inventory/content/media. | Transactional annotations present on mutation methods. | `CONFIRMED_BACKEND_ENFORCED`; runtime DB transaction tests missing |
| Invalid transition error clear. | Product/order/payment/return/admin user/media. | Validation/conflict messages present. | `CONFIRMED_BACKEND_ENFORCED` |
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
| Inventory | Stock decrement/restore/recompute | Needed | Needed for oversell/concurrency | `MISSING_TEST_COVERAGE` |
| Return | `PENDING -> APPROVED/REJECTED`, `APPROVED -> RECEIVED`, `RECEIVED -> COMPLETED/REFUNDED` | Needed | Needed for invalid jumps | `MISSING_TEST_COVERAGE` |
| Admin User | `ACTIVE -> DISABLED/SUSPENDED`, restore to active | Needed | Needed for self-deactivation/Super Admin demotion | `MISSING_TEST_COVERAGE` |
| Content | Publish transitions and delete to archive | Needed | Needed for forbidden transitions | `MISSING_TEST_COVERAGE` |
| Media | Upload active, update inactive/deleted, restore active, hard delete | Needed | Needed for invalid status/MIME/size | `MISSING_TEST_COVERAGE` |
| Notification | Read/unread/archive | N/A | N/A | `NOT_FOUND_IN_REPO` |

Notes:

- This task did not run build/test/runtime.
- Targeted repository search did not reveal obvious direct test files for key transition services.
- Existing phase reports are useful historical evidence but not a fresh CI proof.

## 19. Missing / Not Confirmed State Machines

| Entity / State Machine | Status | Gap |
|---|---|---|
| Payment Provider/Webhook lifecycle | `NOT_FOUND_IN_REPO` | No provider callback/webhook/idempotency state found. |
| Shipping Provider/Tracking lifecycle | `NOT_FOUND_IN_REPO` | No carrier waybill/tracking/status state machine found. |
| Fulfillment status lifecycle | `STATUS_ONLY` / `NEEDS_VERIFICATION` | `fulfillmentStatus` exposed in order detail, no transition map found. |
| Serial lifecycle | `NEEDS_VERIFICATION` | Stock movement serial entity referenced in prior docs, but serial states/transitions not audited as confirmed. |
| Notification read/unread/archive lifecycle | `NOT_FOUND_IN_REPO` | No persisted notification status found. |
| Settings lifecycle | `STATUS_ONLY` / `NEEDS_VERIFICATION` | Settings APIs exist; no state machine confirmed. |
| Coupon lifecycle | `NEEDS_VERIFICATION` | Coupon status APIs exist from prior docs, but detailed state transition not audited here. |
| Review moderation lifecycle | `NEEDS_VERIFICATION` | Review controllers exist in prior docs, but review status transitions not audited here. |
| Customer account status lifecycle | `NEEDS_VERIFICATION` | Customer auth exists, but customer status/disable lifecycle not confirmed. |
| Admin role lifecycle | `STATUS_ONLY` / `NEEDS_VERIFICATION` | Custom role CRUD exists, but role active/inactive lifecycle not confirmed. |
| POS order lifecycle | `PARTIAL` / `NEEDS_VERIFICATION` | POS auto-complete condition exists in payment update; full POS flow not documented here. |

## 20. Evidence Summary

| Entity | Evidence Path | What It Proves | Confidence |
|---|---|---|---|
| Product publish | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/domain/catalog/PublishStatus.java` | Actual publish statuses. | High |
| Product/content publish transitions | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMutationValidators.java` | Allowed/forbidden publish transitions. | High |
| Product mutation | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCatalogMutationService.java` | Product create/update/publish/soft-delete uses transition validation. | High |
| Public product/category/brand visibility | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/catalog/CatalogReadService.java` | Product `PUBLISHED` and category/brand visible filters. | High |
| Order/payment transitions | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java` | Order/payment allowed transition maps, timestamps, stock restore, audit, notification/websocket side effects. | High |
| Checkout initial state | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java` | COD/BACS initial order/payment state, stock decrement, order creation. | High |
| Return transitions | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminReturnService.java` | Return transition map, history, notification, stock restore, refund sync. | High |
| Inventory states | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/domain/catalog/ProductStockState.java` | Product stock states. | High |
| Inventory policy | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/inventory/InventoryPolicyService.java` | Quantity-based recompute and admin-controlled states not overwritten. | High |
| Content state | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminContentController.java` | Admin content accepted status filters and permission boundary. | Medium-High |
| Content transitions | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminContentMutationService.java` | Article/page create/update/delete, shared publish validator, publishedAt/revalidation side effects. | High |
| Media states | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java` | Media `ACTIVE/INACTIVE/DELETED`, upload active, delete/restore/hard delete behavior. | High |
| Admin user states | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminAdminUsersService.java` | Admin status values, user creation active, self-deactivation and Super Admin demotion guardrails. | High |
| Security/permissions | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java`, admin controllers | Admin/customer/public access boundary and role protection. | High |
| Existing business rules | `docs/business/BUSINESS_RULES.md` | Rule baseline for state-machine extraction. | High |
| Existing workflow overview | `docs/business/WORKFLOW_OVERVIEW.md` | Workflow context and cross-entity side effects. | High |
| Existing role doc | `docs/business/USER_ROLES.md` | Actor/role context for transitions. | High |

## 21. Known Ambiguities / Needs Verification

1. Product/content both use shared `PublishStatus`, but content admin controller status regex only exposes `DRAFT`, `PUBLISHED`, `HIDDEN`, `ARCHIVED` for filters. DTO acceptance for `PENDING`, `PRIVATE`, `TRASH` should be verified.
2. Product public visibility is confirmed in `CatalogReadService`, but cache/revalidation/public UI behavior should be verified.
3. Content public visibility filtering needs deeper audit of public content read service.
4. Order and payment transitions are backend-enforced, but direct tests were not found by targeted search.
5. `PaymentEntity.status` full lifecycle is only partially observed through order service side effects; full enum/status source should be audited.
6. Full refund can update order status to `REFUNDED` only when current order status allows it. Report/revenue side effects need finance/business confirmation.
7. Return `REFUNDED` syncs order refundAmount if provided, but payment record/order payment status impact may differ from order refund flow and needs verification.
8. Inventory stock state is recomputed for variants and some product restore paths, but serial lifecycle and product-level movement symmetry need deeper audit.
9. `fulfillmentStatus` exists in order detail, but no transition map was found. Shipping/fulfillment lifecycle remains incomplete.
10. Admin user `DISABLED`/`SUSPENDED` status updates are backend-enforced, but login/API blocking behavior for those statuses needs auth-service audit.
11. Media `INACTIVE` status exists, but whether inactive media can be rendered by product/content public pages needs verification.
12. Notification read/unread/archive state machine was not found. Only email/websocket side effects are confirmed.
13. Payment/shipping external provider state machines are not found.
14. Frontend hide/disable action behavior by status was not deeply audited in this task.
15. Build/test/runtime were not run during this documentation task. Do not treat this file as green-build evidence.

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
