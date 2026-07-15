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
| Product | `publishStatus` | `DRAFT`, `PUBLISHED`, `TRASH` | Controlled publish transitions (DRAFT ↔ PUBLISHED allowed both directions); soft-delete sequences `PUBLISHED → DRAFT → TRASH` in one request; restore `TRASH -> DRAFT`. Legacy values `HIDDEN`, `ARCHIVED`, `PENDING`, `PRIVATE` all migrated to `DRAFT` (V324). | Backend validator | `CONFIRMED_BACKEND_ENFORCED` | `PublishStatus.java`, `AdminMutationValidators.java`, `ProductMutationService.java`, `CatalogReadService.java` |
| Category | `visible` | `true`, `false` | Soft-delete/hide sets visible false; public only visible; cannot hide parent with visible children. | Backend service | `CONFIRMED_BACKEND_ENFORCED` for visibility rules; no enum state machine | `CategoryMutationService.java`, `CatalogReadService.java` |
| Brand | `visible` | `true`, `false` | Delete sets visible false; public only visible. | Backend service | `CONFIRMED_BACKEND_ENFORCED` for visibility; no full transition map | `BrandMutationService.java`, `CatalogReadService.java` |
| Order | `status` | `PENDING`, `PROCESSING`, `ON_HOLD`, `COMPLETED`, `CANCELLED`, `FAILED` | Explicit allowed transition map in service. (`REFUNDED` removed 2026-06-23 — old refunded orders migrated to `CANCELLED`.) | Backend service | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java`, `CheckoutService.java` |
| Payment | `paymentStatus` on Order, `status` on Payment | Order payment: `UNPAID`, `PAID`, `CANCELLED`. Payment record includes `PENDING`, `SUCCEEDED` in observed service code. (`REFUNDED` removed 2026-06-23.) | Explicit order payment transition map; payment record status is updated as side effect. | Backend service | `CONFIRMED_BACKEND_ENFORCED` for order payment status; payment entity full lifecycle `STATUS_ONLY` | `AdminOrderService.java`, `CheckoutService.java` |
| Fulfillment | `fulfillmentStatus` | `UNFULFILLED`, `PROCESSING`, `SHIPPED`, `DELIVERED`, `CANCELLED` | Explicit transition map: `UNFULFILLED → PROCESSING → SHIPPED → DELIVERED`, with cancellation before shipping; `trackingNumber` required for SHIPPED. Shipping-method state was removed (`SHIP_RULE_001`). | Backend service | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java`, `CheckoutService.java`, `Phase1HAdminOrderApiTest.java` |
| Inventory / Stock | `stockState`, availability flag | `IN_STOCK`, `OUT_OF_STOCK` | `stockState` mirrors the boolean availability toggle (V261). New variants default available; a new no-variant product defaults `IN_STOCK` unless admin marks it Hết. Selling/cancelling does not change availability. | Backend policy/service | `CONFIRMED_BACKEND_ENFORCED` | `ProductStockState.java`, `InventoryPolicyService.java`, `ProductMutationService.java`, `CheckoutService.java`, `BUSINESS_RULES.md` STOCK_RULE_001–009 |
| Admin User | `status`, `role` | Status: `INVITED`, `ACTIVE`, `DISABLED`, `SUSPENDED`; Roles: `SUPER_ADMIN`, `ADMIN`, `EDITOR`, `SHOP_MANAGER` (built-in, V211) + custom roles. New users start `INVITED` (no password) and become `ACTIVE` on accepting an email invite. | Status/role update validation; self-deactivation and Super Admin demotion guardrails; invite token lifecycle. | Backend service | `CONFIRMED_BACKEND_ENFORCED` | `AdminAdminUsersService.java`, `AdminInviteService.java`, `SecurityConfig.java` |
| Content Article | `publishStatus` | Same `PublishStatus` enum; active values: `DRAFT`, `PUBLISHED`, `TRASH`; legacy `HIDDEN`/`ARCHIVED`/`PENDING`/`PRIVATE` all migrated to `DRAFT` (V324). | Publish transitions enforced on update (DRAFT ↔ PUBLISHED both directions); delete sequences `PUBLISHED → DRAFT → TRASH` in one request (soft-delete, restore `TRASH` → `DRAFT`). | Backend service | `CONFIRMED_BACKEND_ENFORCED`; public filtering `NEEDS_VERIFICATION` | `AdminContentController.java`, `AdminContentMutationService.java`, `AdminMutationValidators.java` |
| Media | `status` | `ACTIVE`, `INACTIVE`, `DELETED` | Upload creates `ACTIVE`; update validates allowed statuses; soft-delete sets `DELETED`; restore sets `ACTIVE`; hard-delete removes row/object. | Backend service | `CONFIRMED_BACKEND_ENFORCED` | `AdminMediaService.java` |
| Notification | `admin_notification_reads.lastReadAt` per admin | Shared notification backlog + per-admin read/unread state. Response `isRead` is derived for the caller; legacy shared `admin_notifications.is_read` is unused. | `mark-all-read` advances only the caller's high-water mark; no shared row is mutated and no backlog is removed. | Backend service | `CONFIRMED_FROM_CODE` | `AdminNotificationService.java`, `AdminNotificationController.java`, `V339__admin_notification_per_admin_read_state.sql`, `AdminNotificationServiceTest.java` |
| Settings | No lifecycle state confirmed | Public/private behavior exists in docs/controllers; no state machine confirmed. | N/A | `STATUS_ONLY` / `NEEDS_VERIFICATION` | `AdminSettingsController`, `PublicSettingsController`, `PHASE_1J...` |

## 4. Product State Machine

### Purpose

Product state machine kiểm soát vòng đời public/internal của sản phẩm: từ draft, publish, hide/archive/trash và khả năng hiển thị ngoài public web.

### State Field

`publishStatus`

### States

Active states (dùng trong admin):

- `DRAFT`
- `PUBLISHED`
- `TRASH`

Legacy values (còn trong enum cho backward compat với dữ liệu cũ, không được phép set qua admin API — bị chặn với `RESERVED_PUBLISH_STATUS` khi dùng làm transition target):

- `HIDDEN` → đã migrate sang `DRAFT` (V324, 2026-07-07). Trước đó `HIDDEN` từng là active state, và trước nữa là đích migrate của `ARCHIVED` (V87) — nay đơn giản hoá về đúng 1 đích.
- `ARCHIVED` → đã migrate sang `DRAFT` (trước V324 từng migrate sang `HIDDEN`)
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
| `DRAFT` | `PUBLISHED` | Admin / role có `products.update` | Product exists; transition request valid. | Product có thể public nếu public read filter trả `PUBLISHED`. | `CONFIRMED_BACKEND_ENFORCED` | `AdminMutationValidators.java`, `ProductMutationService.java` |
| `DRAFT` | `TRASH` | Admin / role có `products.update` | Product exists. | Soft-delete. | `CONFIRMED_BACKEND_ENFORCED` | `AdminMutationValidators.java`, `ProductMutationService.java` |
| `PUBLISHED` | `DRAFT` | Admin / role có `products.update` | Product exists. | Product bị loại khỏi public vì public chỉ trả `PUBLISHED`. Cho phép trực tiếp từ 2026-07-07 (trước đó phải qua `HIDDEN`). | `CONFIRMED_BACKEND_ENFORCED` | `AdminMutationValidators.java`, `CatalogReadService.java` |
| `PUBLISHED` | `TRASH` | Admin / role có `products.update` | Product exists. | Soft-delete: service tự sequence `PUBLISHED → DRAFT → TRASH` trong cùng transaction/request — admin chỉ thấy 1 click, không có bước trung gian hiển thị. | `CONFIRMED_BACKEND_ENFORCED` | `AdminMutationValidators.java`, `ProductMutationService.java` |
| `TRASH` | `DRAFT` | Admin / role có `products.update` | Product in trash. | Restore into draft. | `CONFIRMED_BACKEND_ENFORCED` | `AdminMutationValidators.java` |
| `HIDDEN` / `ARCHIVED` / `PENDING` / `PRIVATE` (legacy source) | `DRAFT` | Admin / role có `products.update` | Product exists (residual pre-migration record). | Escape path duy nhất về active state. | `CONFIRMED_BACKEND_ENFORCED` | `AdminMutationValidators.java` |
| `HIDDEN` / `ARCHIVED` / `PENDING` / `PRIVATE` (legacy source) | `TRASH` | Admin / role có `products.update` | Product exists (residual pre-migration record). | Soft-delete vẫn hoạt động bất kể trạng thái legacy hiện tại. | `CONFIRMED_BACKEND_ENFORCED` | `AdminMutationValidators.java` |

### Forbidden Transitions

| From | To | Reason | Enforcement | Evidence |
|---|---|---|---|---|
| `DRAFT` | `PUBLISHED` (skip) | Không đi thẳng DRAFT→PUBLISHED nếu muốn review trước; nhưng hiện tại business cho phép. | Không bị block. | `AdminMutationValidators.java` |
| any | `HIDDEN` / `ARCHIVED` / `PENDING` / `PRIVATE` | Legacy values, không được set qua admin API (kể cả `HIDDEN`, từ 2026-07-07). | Backend rejects với `RESERVED_PUBLISH_STATUS`. | `AdminMutationValidators.java` |
| `TRASH` | anything except `DRAFT` | Restore từ trash chỉ được về DRAFT. | Backend rejects. | `AdminMutationValidators.java` |
| any state | same state | No-op; không phải transition. | Backend không báo lỗi. | `AdminMutationValidators.java` |

### Frontend Behavior

- Admin routes/actions exist for products in `bigbike-admin/README.md` and `bigbike-admin/src/lib/adminApi.js`.
- Specific UI button visibility by `publishStatus` needs dedicated UI audit.
- Public web visibility is backend-enforced by `CatalogReadService`, not just UI.

### Backend Enforcement

- Transition validation is centralized in `AdminMutationValidators.validatePublishTransition`.
- Product create/update/publish-status methods call the validator through `ProductMutationService`.
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

Category and Brand control their visibility and deletion lifecycles via boolean state flags: `deleted` (Category) and `isVisible` (Brand). Both support a soft-delete (Trash) mechanism, restore capability, and permanent hard-deletion.

### State Field

- Category: `deleted` (boolean, `true` is in Trash) and `isVisible` (boolean, controls storefront display)
- Brand: `isVisible` (boolean, `false` means in Trash)

### States

Category:
- `deleted = false` (Active/Normal)
- `deleted = true` (Trash)

Brand:
- `isVisible = true` (Active/Normal)
- `isVisible = false` (Trash / Hidden)

### Initial State

- Category: `deleted = false`
- Brand: `isVisible = true`

### Allowed Transitions

| Entity | From | To | Actor / Role | Preconditions | Side Effects | Enforcement | Evidence |
|---|---|---|---|---|---|---|---|
| Category | `deleted = false` | `deleted = true` | Admin / role có `catalog.update` | Category exists; is not "Chưa phân loại" system category. | Category and all its descendants are marked `deleted = true` (Trash). Products in it are NOT reassigned yet. | `CONFIRMED_BACKEND_ENFORCED` | `CategoryMutationService.java` |
| Category | `deleted = true` | `deleted = false` | Admin / role có `catalog.update` | Category exists. | Category and all its descendants are restored to `deleted = false` (Active). | `CONFIRMED_BACKEND_ENFORCED` | `CategoryMutationService.java` |
| Category | `deleted = true` | `DELETED` (physical) | Admin / role có `catalog.update` | Category is in Trash (`deleted = true`); is not "Chưa phân loại". | Category and its descendants are physically deleted. All products in the subtree are reassigned to "Chưa phân loại" (`uncategorized`). | `CONFIRMED_BACKEND_ENFORCED` | `CategoryMutationService.java` |
| Brand | `isVisible = true` | `isVisible = false` | Admin / role có `catalog.update` | Brand exists. | Brand is soft-deleted (sent to Trash). Storefront hides it. | `CONFIRMED_BACKEND_ENFORCED` | `BrandMutationService.java` |
| Brand | `isVisible = false` | `isVisible = true` | Admin / role có `catalog.update` | Brand exists. | Brand is restored. Storefront shows it. | `CONFIRMED_BACKEND_ENFORCED` | `BrandMutationService.java` |
| Brand | `isVisible = false` | `DELETED` (physical) | Admin / role có `catalog.update` | Brand is in Trash (`isVisible = false`). | Brand is physically deleted. Product references are set to NULL. | `CONFIRMED_BACKEND_ENFORCED` | `BrandMutationService.java` |

### Forbidden Transitions

| From | To | Reason | Enforcement | Evidence |
|---|---|---|---|---|
| Category parentId | self/circular parent | Would corrupt tree. | Backend validation rejects. | `CategoryMutationService.java` |
| "Chưa phân loại" | `deleted = true` | System category cannot be soft-deleted. | Backend rejects (409). | `CategoryMutationService.java` |
| "Chưa phân loại" | `DELETED` (physical) | System category cannot be physically deleted. | Backend rejects (409). | `CategoryMutationService.java` |
| Category `deleted = false` | `DELETED` (physical) | Cannot permanently delete active category; must soft-delete first. | Backend rejects (409). | `CategoryMutationService.java` |
| Brand `isVisible = true` | `DELETED` (physical) | Cannot permanently delete active brand; must soft-delete first. | Backend rejects (409). | `BrandMutationService.java` |

### Frontend Behavior

- Admin UI list views support a "Thùng rác" filter and present appropriate soft-delete, restore, and permanent delete buttons based on active tab state.

### Backend Enforcement

- Public reads in `CatalogReadService` filter out `deleted = true` categories and `isVisible = false` brands.
- Mutation service validates system locks and trash states before allowing mutations.

### Test Coverage

- Status: `MISSING_TEST_COVERAGE`.

### Needs Verification

- Automated tests coverage of the new soft-delete/restore/hard-delete lifecycle transitions.

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

- New checkout orders always use `paymentMethod = COD`, start at `PROCESSING`, and have `paymentStatus = UNPAID` (owner decision 2026-07-15, `PAY_RULE_001`). The customer sees COD as a fixed method with no selection step; an omitted request value is normalised to COD and every other explicit code is rejected.
- Legacy orders may still carry `BACS`/`null` and remain readable. A legacy BACS order may already be `ON_HOLD`, but no new storefront request can create that combination.
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

`UNFULFILLED` → `PROCESSING` → `SHIPPED` → `DELIVERED`  
`UNFULFILLED` / `PROCESSING` → `CANCELLED`

`RETURNED` was removed as a fulfillment status (owner decision 2026-07-06, `V323__remove_returned_fulfillment_status.sql`) — it was a dead branch (no admin UI ever triggered it, 0 orders ever used it) left over from the return/refund feature already removed in V261.

### Allowed Transitions

| From | To | Actor / Role | Preconditions | Side Effects | Enforcement | Evidence |
|---|---|---|---|---|---|---|
| `UNFULFILLED` | `PROCESSING` | Admin / `orders.write` | Order is DELIVERY type. | Audit, WS event. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java` |
| `UNFULFILLED` | `CANCELLED` | Admin / `orders.write` | Order is DELIVERY type. | Audit, WS event. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java` |
| `PROCESSING` | `SHIPPED` | Admin / `orders.write` | `trackingNumber` required (non-blank). Sets `shippedAt`. | Stores `trackingNumber`, `shippingCarrier`; sends shipped notification. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java#updateFulfillmentStatus` |
| `PROCESSING` | `CANCELLED` | Admin / `orders.write` | Order is DELIVERY type. | Audit, WS event. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java` |
| `SHIPPED` | `DELIVERED` | Admin / `orders.write` | Order is DELIVERY type. | Audit, WS event. | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService.java` |

### Forbidden Transitions

| From | To | Reason | Enforcement | Evidence |
|---|---|---|---|---|
| `UNFULFILLED` (including legacy orders with `fulfillmentStatus = null`, treated as the `UNFULFILLED` baseline) | `DELIVERED` | Must go through PROCESSING → SHIPPED first so tracking data is captured. | Backend rejects (409). Fixed 2026-07-06: previously a `null` `fulfillmentStatus` (1,657 legacy orders) skipped this check entirely and could jump straight to `DELIVERED`. | `AdminOrderService.java#updateFulfillmentStatus` |
| `SHIPPED` | any without `trackingNumber` | `trackingNumber` is required when transitioning to SHIPPED. | Backend rejects (400). | `AdminOrderService.java#updateFulfillmentStatus` |
| `DELIVERED` | `CANCELLED` / `PROCESSING` / `SHIPPED` | No back-transition from DELIVERED — terminal state. | Backend rejects (409). | `AdminOrderService.java` |
| `CANCELLED` | any | Terminal state. | Backend rejects (409). | `AdminOrderService.java` |
| any | `RETURNED` | Status no longer exists (removed 2026-07-06). | Backend rejects (400) — not in `ALLOWED_FULFILLMENT_STATUSES`. | `AdminOrderService.java` |
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
> **Inventory is a BOOLEAN availability toggle (2026-06-23, V261).** There is no tracked quantity. `stockState` is a two-state badge (`IN_STOCK` / `OUT_OF_STOCK`) that mirrors a per-variant / per-product availability flag the admin sets by hand. `LOW_STOCK` was removed from the enum (V279).

### Purpose

Availability is a boolean the admin sets by hand in the **product form**: a per-variant Còn/Hết switch (`product_variants.is_available`) and, for a no-variant product, a per-product Còn/Hết switch (persisted via `products.force_out_of_stock`). `products.stock_state` / `product_variants.stock_state` are **derived** badges, re-computed on every save (`InventoryPolicyService.recomputeProductState`): a variant mirrors its own `is_available`; a product-with-variants is `IN_STOCK` when ANY variant is available; a no-variant product mirrors its product-level switch. No on-hand count is kept.

### State Field

- `stockState` (`IN_STOCK` / `OUT_OF_STOCK`).
- `product_variants.is_available` — the per-variant gate.
- Quantity columns (`quantity_on_hand` / `stock_quantity`) are **dormant** — not read for availability. The `stock_movements` ledger is no longer written for sales/restores.

### States

From `ProductStockState.java`:

- `IN_STOCK`
- `OUT_OF_STOCK`

### Initial State

- A new variant defaults to `is_available = true` (Còn hàng) in the product form; a new no-variant product defaults to `IN_STOCK` unless the admin flips its product-level switch to Hết. `stockState` is re-derived to match on save.
- The **product form** is the writer (`ProductMutationService` → `InventoryPolicyService.recomputeProductState`): per-variant switch for products with variants, per-product switch for no-variant products. The form never sends a `stockState` picker — the badge is always derived. (The standalone `AdminInventoryController` availability endpoints still exist in the backend but are no longer wired to any admin screen.)

### Allowed Transitions

| From | To | Actor / Role | Preconditions | Side Effects | Enforcement | Evidence |
|---|---|---|---|---|---|---|
| `OUT_OF_STOCK` | `IN_STOCK` | Admin / `products.update` | Save product form with the Còn/Hết switch ON (variant `is_available = true`, or no-variant product not forced out). | `stock_state` re-derived to `IN_STOCK`; product-with-variants re-aggregates from variants. | `CONFIRMED_BACKEND_ENFORCED` | `ProductMutationService.java`, `InventoryPolicyService.java` |
| `IN_STOCK` | `OUT_OF_STOCK` | Admin / `products.update` | Save product form with the Còn/Hết switch OFF (variant `is_available = false`, or no-variant product forced out). | `stock_state` re-derived to `OUT_OF_STOCK`; product-with-variants re-aggregates. | `CONFIRMED_BACKEND_ENFORCED` | `ProductMutationService.java`, `InventoryPolicyService.java` |

**No automatic transitions:** a sale or cancel does **not** change availability. There is no quantity decrement or restore.

### Forbidden Transitions / States

| From | To | Reason | Enforcement | Evidence |
|---|---|---|---|---|
| `OUT_OF_STOCK` variant | add-to-cart / checkout | Cannot buy an unavailable variant. | Backend rejects checkout (`isAvailable` gate). | `CheckoutService.java` |

> **No oversell guard by quantity.** Because availability is boolean and selling never decrements anything, the storefront keeps accepting orders for an available item even after it physically sells out. The admin must manually toggle it to "Hết hàng".

### Frontend Behavior

- The admin product form shows a "Còn hàng / Hết hàng" switch per variant, and a single product-level switch for no-variant products; the public buy-box badge shows the two states only.

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
>
> **`RETURNED` fulfillment status also removed (2026-07-06).** Separately from the RMA feature above, `OrderEntity.fulfillmentStatus` used to also allow a `RETURNED` value ("parcel returned to sender") — this was a distinct, dead code path with no admin UI trigger and 0 orders ever in that state. It has been fully removed (see §8 above, `V323__remove_returned_fulfillment_status.sql`) so this section and §8 are no longer ambiguous about whether any RETURNED-shaped state still exists anywhere in the system: it does not.

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

Built-in roles (4, after `V211__reduce_default_roles.sql`):

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

Content state machine quản lý publish lifecycle của articles (bài viết / Tin tức) và ảnh hưởng public content/SEO. (Trước 2026-06-24 áp dụng cho cả static CMS pages — module pages đã gỡ, trang thông tin nay tĩnh ở web nên chỉ còn bài viết có lifecycle này.)

### State Field

`publishStatus`

### States

- Shared `PublishStatus` enum giữ nguyên 7 values cho backward compat với dữ liệu cũ, nhưng admin API chỉ chấp nhận: `DRAFT`, `PUBLISHED`, `TRASH`.
- Legacy values `HIDDEN`, `ARCHIVED`, `PENDING`, `PRIVATE` đều bị block bởi `AdminMutationValidators` khi dùng làm transition target (`RESERVED_PUBLISH_STATUS`).
- Content delete (article) sequences `PUBLISHED → DRAFT → TRASH` trong cùng 1 request khi bài đang `PUBLISHED`; nếu không thì set thẳng `TRASH` — nhất quán với product soft-delete.

### Initial State

- Create article requires `publishStatus` in request.
- Patch logic fallback is `DRAFT` when create and request is null, but create validation requires publishStatus.

### Terminal States

- `TRASH` is the delete target for content delete (soft-delete).
- Not strictly terminal because the validator allows `TRASH -> DRAFT` (restore). Legacy `HIDDEN`/`ARCHIVED`/`PENDING`/`PRIVATE` -> `DRAFT` còn được giữ như escape path duy nhất cho dữ liệu cũ còn sót (V324 đã backfill hết `HIDDEN` sang `DRAFT` — không còn bản ghi sống ở trạng thái này).

### Live preview (không đổi state)

Admin live preview bài viết (`POST /api/v1/admin/content/articles/preview`) render nội dung nháp bằng template blog detail thật, nhưng **không** đổi `publishStatus`, **không** lưu, và **không** expose bài viết ra public. Preview đi qua phiên admin (`content.update`) — không qua public read path; public vẫn chỉ trả `PUBLISHED`. Song song với product preview (xem §4).

### Allowed Transitions

Same as Product publish transition validator for update operations:

| From | To | Actor / Role | Preconditions | Side Effects | Enforcement | Evidence |
|---|---|---|---|---|---|---|
| `DRAFT` | `PUBLISHED` | Admin / Editor / Author with `content.update` | Content exists. | Set `publishedAt`; revalidate web tags. | `CONFIRMED_BACKEND_ENFORCED` | `AdminContentMutationService.java`, `AdminMutationValidators.java` |
| `DRAFT` | `TRASH` | Admin / Editor / Author with `content.update` | Content exists. | Soft-delete. | `CONFIRMED_BACKEND_ENFORCED` | `AdminContentMutationService.java`, `AdminMutationValidators.java` |
| `PUBLISHED` | `DRAFT` | Admin / Editor / Author with `content.update` | Content exists. | Clear `publishedAt`; revalidate. Direct từ 2026-07-07 (trước đó phải qua `HIDDEN`). | `CONFIRMED_BACKEND_ENFORCED` | `AdminContentMutationService.java`, `AdminMutationValidators.java` |
| `PUBLISHED` | `TRASH` | Admin / Editor / Author with `content.update` | Content exists. | Soft-delete: service tự sequence `PUBLISHED → DRAFT → TRASH` trong cùng request. | `CONFIRMED_BACKEND_ENFORCED` | `AdminContentMutationService.java`, `AdminMutationValidators.java` |
| `TRASH` | `DRAFT` | Admin / Editor / Author with `content.update` | Content exists. | Restore to draft. | `CONFIRMED_BACKEND_ENFORCED` | `AdminMutationValidators.java`, `AdminContentMutationService.java` |
| `HIDDEN` / `ARCHIVED` / `PENDING` / `PRIVATE` (legacy source) | `DRAFT` / `TRASH` | Admin / Editor / Author with `content.update` | Content exists (residual pre-migration record); status accepted by DTO. | Escape path duy nhất (`DRAFT`) hoặc soft-delete (`TRASH`). | `CONFIRMED_BACKEND_ENFORCED` trong shared validator | `AdminMutationValidators.java` |

### Forbidden Transitions

Same forbidden publish transition rules as product, enforced by shared validator.

### Frontend Behavior

- Admin content routes and API client exist.
- Specific status action visibility needs UI audit.

### Backend Enforcement

- Update article calls `validatePublishTransition`.
- Delete article sequences `PUBLISHED → DRAFT → TRASH` in one request when currently `PUBLISHED`, else sets `publishStatus = TRASH` directly (nhất quán với product soft-delete).
- Public content visibility filtering needs deeper audit.

### Test Coverage

- Direct tests not found by targeted search.
- Status: `MISSING_TEST_COVERAGE`.

### Needs Verification

- DTO enum acceptance for `PENDING`, `PRIVATE`, `TRASH` on content.
- Public read filtering of non-published content.
- SEO route behavior for archived/hidden content.
- `HIDDEN` as a mutation target is now uniformly rejected (`RESERVED_PUBLISH_STATUS`) regardless of DTO-level acceptance — no longer needs verification for that question specifically; whether the DTO layer itself still deserializes the legacy enum values (vs rejecting at JSON-parse time) remains `NEEDS_VERIFICATION`.

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

Order events are persisted in a shared admin notification backlog so staff who were offline can catch up. Read/unread is resolved **per admin**; one admin opening the bell must not clear another admin's unread state.

### State Field

`admin_notification_reads.last_read_at` high-water mark keyed by `admin_id` (V339). `admin_notifications.is_read` is a legacy shared column kept for compatibility but no longer read or written.

### States

| State | Description |
|---|---|
| Unread for admin A | Notification `createdAt` is later than A's `lastReadAt`, or A has no marker yet. |
| Read for admin A | Notification `createdAt` is at/before A's `lastReadAt`. API returns this derived value as `isRead`. |

### Transition

`POST /api/v1/admin/notifications/mark-all-read` advances only the caller's `lastReadAt` to the current time. Shared `admin_notifications` rows are not mutated or deleted, so the recent backlog (up to 50 items) remains visible and every other admin keeps their own unread count. The old mark-by-IDs endpoint was removed because it had no caller.

### Status

`CONFIRMED_FROM_CODE`

### Evidence

- `V102__create_admin_notifications_table.sql` — persistent shared `admin_notifications` backlog.
- `V339__admin_notification_per_admin_read_state.sql` — per-admin high-water mark; legacy shared flag is unused.
- `AdminNotificationController.java` — `GET /api/v1/admin/notifications`, `POST /mark-all-read` (both require `orders.read`).
- `AdminNotificationService.java` — `inboxFor(adminId)`, `markAllReadFor(adminId)`.
- `AdminNotificationServiceTest.java` — per-admin isolation, backlog retention, and payload coverage.
- WS push via `AdminOrderWsService` supplements persistent store; admin offline will not miss events.

### Notes

- Archive/delete state is not part of the current notification contract.
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
| Admin User | `DISABLED` / `SUSPENDED` | Auth/API | Blocks login (`AdminAuthService.login`) **and every subsequent authenticated request**, not just login. | Security — fixed 2026-07-06: `JwtAuthFilter` now re-checks the admin's current status/role from DB (cached, evicted on write) on every request instead of trusting the JWT claims alone, so a lock/suspend/demote takes effect on the admin's very next request instead of surviving up to the ~15min access-token TTL. | `CONFIRMED_BACKEND_ENFORCED` — `JwtAuthFilter.java`, `AdminAccountStatusService.java`, `AdminAdminUsersService.java` (evicts cache on status/role change) |
| ~~Shipping Method~~ | — | — | **REMOVED 2026-06-23** (`SHIP_RULE_001`): shipping-method management dropped (V264); no shipping choice or fee at checkout. | — | `REMOVED` |

## 16. Invalid Transition Policy

- Transition không nằm trong allowed transition map phải bị backend reject.
- Unknown status phải bị backend reject với validation error.
- Same-state update có thể là no-op nếu service code explicitly cho phép.
- Frontend chỉ được hide/disable action để UX tốt hơn, không thay thế backend validation.
- Negative tests nên cover transition bị cấm.
- API không được update status trực tiếp nếu thiếu service/domain validation.
- Durable side effects such as notifications/audit records must remain in the transactional service flow when they affect persisted data. Inventory has no sale/cancel restore side effect under the manual boolean model.
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
| Fulfillment | `UNFULFILLED → PROCESSING → SHIPPED → DELIVERED`; terminal/shortcut guards | `markDelivered` helper exercises the full happy path | `updateFulfillment_unfulfilledToDelivered_isRejected`, `updateFulfillment_shippedWithoutTrackingNumber_isRejected`, RETURNED rejection tests | `CONFIRMED_TEST_COVERAGE` (`Phase1HAdminOrderApiTest`) |
| Inventory | Availability boolean toggle | Per-variant `isAvailable` checkout gate covered by checkout API tests | Availability-toggle endpoint tests still needed (V261) | `PARTIAL_TEST_COVERAGE` |
| Admin User | `ACTIVE -> DISABLED/SUSPENDED`, restore to active | Needed | Needed for self-deactivation/Super Admin demotion | `MISSING_TEST_COVERAGE` |
| Content | Publish transitions and delete to archive | Needed | Needed for forbidden transitions | `MISSING_TEST_COVERAGE` |
| Media | Upload active, update inactive/deleted, restore active, hard delete | Needed | Needed for invalid status/MIME/size | `MISSING_TEST_COVERAGE` |
| Notification | Per-admin read/unread high-water mark | `markAllRead_isPerAdmin_doesNotClearUnreadForOtherAdmins`, `inbox_keepsBacklogVisibleAfterMarkAllRead` | Cross-admin isolation assertions in the same suite | `CONFIRMED_TEST_COVERAGE` (`AdminNotificationServiceTest`) |

Notes:

- Targeted tests are cited above for fulfillment and per-admin notification state. This file is not evidence that the full backend suite is green; full-suite stale failures are tracked separately at AUD-046.
- Existing phase reports remain historical context, not a substitute for current targeted tests.

## 19. Missing / Not Confirmed State Machines

| Entity / State Machine | Status | Gap |
|---|---|---|
| Payment Provider/Webhook lifecycle | `NOT_FOUND_IN_REPO` | No automatic payment gateway. New storefront orders use fixed COD and are reconciled manually by admin. BACS is legacy-order compatibility only. No payment redirect or provider webhook; the Alepay/ZaloPay plan was dropped. |
| Shipping Provider/Tracking lifecycle | `NOT_FOUND_IN_REPO` | No carrier waybill/tracking/status state machine found. |
| Serial lifecycle | `REMOVED` | Serial-number tracking was removed platform-wide (2026-06-23, V259). There is no serial lifecycle. Inventory is manual boolean availability only. |
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
| Product mutation | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/ProductMutationService.java` | Product create/update/publish/soft-delete uses transition validation. | High |
| Public product/category/brand visibility | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/catalog/CatalogReadService.java` | Product `PUBLISHED` and category/brand visible filters. | High |
| Order/payment transitions | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java` | Order/payment allowed transition maps, timestamps, audit, notification/websocket side effects. (No stock restore — availability is a manual boolean, V261.) | High |
| Checkout initial state | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java` | Fixed-COD initial order/payment state, per-variant `isAvailable` gate, order creation. Legacy BACS/null remains read-compatible only. (No quantity decrement — V261.) | High |
| Inventory states | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/domain/catalog/ProductStockState.java` | Product stock states. | High |
| Inventory availability | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminInventoryController.java` | Per-variant / per-product boolean availability toggle (V261); `stockState` mirrors it. | High |
| Content state | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminContentController.java` | Admin content accepted status filters and permission boundary. | Medium-High |
| Content transitions | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminContentMutationService.java` | Article create/update/delete, shared publish validator, publishedAt/revalidation side effects. | High |
| Media states | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java` | Media `ACTIVE/INACTIVE/DELETED`, upload active, delete/restore/hard delete behavior. | High |
| Admin user states | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminAdminUsersService.java` | Admin status values, user creation active, self-deactivation and Super Admin demotion guardrails. | High |
| Security/permissions | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java`, admin controllers | Admin/customer/public access boundary and role protection. | High |
| Existing business rules | `docs/business/BUSINESS_RULES.md` | Rule baseline for state-machine extraction. | High |
| Existing workflow overview | `docs/business/WORKFLOW_OVERVIEW.md` | Workflow context and cross-entity side effects. | High |
| Existing role doc | `docs/business/USER_ROLES.md` | Actor/role context for transitions. | High |

## 21. Known Ambiguities / Needs Verification

1. Product/content both use shared `PublishStatus`; content admin controller status regex now exposes only `DRAFT`, `PUBLISHED`, `TRASH` for filters (`HIDDEN` removed 2026-07-07 — legacy-only, no live rows after V324). DTO acceptance for legacy `PENDING`, `PRIVATE`, `HIDDEN` as mutation targets is confirmed rejected via `RESERVED_PUBLISH_STATUS`.
2. Product public visibility is confirmed in `CatalogReadService`, but cache/revalidation/public UI behavior should be verified.
3. Content public visibility filtering needs deeper audit of public content read service.
4. Order/fulfillment/payment transitions are backend-enforced. Targeted fulfillment tests are confirmed; exhaustive positive/negative coverage for every order/payment edge is still tracked separately.
5. `PaymentEntity.status` full lifecycle is only partially observed through order service side effects; full enum/status source should be audited.
6. Inventory availability is a per-variant / per-product boolean toggle (V261); `stockState` mirrors it. Selling does not change availability — admin marks items "Hết hàng" by hand (oversell not auto-prevented). Serial tracking removed in V259.
7. Fulfillment lifecycle is backend-enforced and target-tested: `UNFULFILLED → PROCESSING → SHIPPED → DELIVERED`, with cancellation before shipping and terminal-state guards. External carrier automation remains absent.
8. Admin user `DISABLED`/`SUSPENDED` status updates are backend-enforced, but login/API blocking behavior for those statuses needs auth-service audit.
9. Media `INACTIVE` status exists, but whether inactive media can be rendered by product/content public pages needs verification.
10. Notification read/unread is confirmed per admin via the V339 high-water mark and target tests. Archive/delete is intentionally outside the current notification contract.
11. Payment/shipping external provider state machines are not found.
12. Frontend hide/disable action behavior by status was not deeply audited in this task.
13. Targeted fulfillment and notification tests were run for the documented fixes; do not treat this file as full-suite green-build evidence (see AUD-046).

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
