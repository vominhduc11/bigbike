# BigBike Business Rules

## 1. Document Purpose

File này mô tả các luật nghiệp vụ bắt buộc của BigBike. Mục tiêu là giúp business user, PM, BA, tester, developer mới và AI agent hiểu hệ thống phải tuân thủ những quy tắc nào khi xử lý product, category/brand, cart, checkout, order, payment, shipping, inventory, return/refund, media, content/SEO, user/role/permission, settings và các workflow liên quan.

File này trả lời:

- Điều gì được phép?
- Điều gì bị cấm?
- Điều kiện nào phải đúng trước khi thực hiện action?
- Entity/status nào được chuyển trạng thái?
- Backend có enforce rule không?
- Rule nào đã có evidence trong code?
- Rule nào chỉ mới suy luận hoặc cần verify?

Nguyên tắc quan trọng: business rule ảnh hưởng dữ liệu, trạng thái, payment, inventory, permission hoặc security phải được enforce ở backend. Frontend validation/disable/hide chỉ là UX, không phải nguồn bảo vệ cuối cùng. Tin frontend để bảo vệ rule nghiệp vụ là kiểu khóa két sắt bằng CSS `display: none`.

Giới hạn:

- Không phải API contract.
- Không phải database schema.
- Không phải full state machine document.
- Không phải permission matrix chi tiết.
- Không nhồi request/response API.
- Không nhồi full entity/schema fields.
- Không chứa secret, token, password, private key hoặc env value nhạy cảm.
- Không khẳng định rule production-ready nếu chưa có build/test/runtime evidence hiện tại.

File này dùng làm nền cho:

- `STATE_MACHINES.md`
- `ACCEPTANCE_CRITERIA.md`
- `TESTING_GUIDE.md`
- `PERMISSION_MATRIX.md`
- `TRACEABILITY_MATRIX.md`

## 2. Business Rule Status Labels

| Label | Meaning |
|---|---|
| `CONFIRMED_BACKEND_ENFORCED` | Đã thấy backend/service/validation enforce rõ. |
| `CONFIRMED_BY_TEST` | Đã thấy test kiểm tra rule. |
| `FRONTEND_ONLY` | Chỉ thấy frontend validate/disable/hide, chưa thấy backend enforce. |
| `DOCUMENTED_NOT_ENFORCED` | Docs có nói rule nhưng code chưa thấy enforce. |
| `INFERRED_FROM_STRUCTURE` | Suy luận từ route/folder/API/status enum nhưng chưa đủ evidence. |
| `NEEDS_VERIFICATION` | Cần kiểm tra thêm bằng code review sâu hơn, build/test/runtime hoặc business confirmation. |
| `NOT_FOUND_IN_REPO` | Chưa thấy trong repo hiện tại. |
| `CONFLICTING_EVIDENCE` | Code/docs có dấu hiệu mâu thuẫn. |
| `MISSING_TEST_COVERAGE` | Rule có evidence code nhưng chưa thấy test trực tiếp qua audit này. |

## 3. Rule Summary Map

| Rule ID | Domain | Rule | Enforcement Layer | Status | Evidence | Test Coverage |
|---|---|---|---|---|---|---|
| PRODUCT_RULE_001 | Product | Public catalog chỉ trả product `PUBLISHED`. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `CatalogReadService` | `MISSING_TEST_COVERAGE` |
| PRODUCT_RULE_002 | Product | Quick-buy chỉ cho product `PUBLISHED`. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `CheckoutService` | `MISSING_TEST_COVERAGE` |
| PRODUCT_RULE_003 | Product | Product create bắt buộc có slug, name, retailPrice, stockState, publishStatus và categoryId. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `AdminCatalogMutationService` | `MISSING_TEST_COVERAGE` |
| PRODUCT_RULE_004 | Product | Product/category/brand slug không được trùng. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `AdminCatalogMutationService` | `MISSING_TEST_COVERAGE` |
| PRODUCT_RULE_005 | Product | Product price fields phải không âm; sale price phải hợp lệ theo retail/compare-at rule. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `AdminCatalogMutationService` | `MISSING_TEST_COVERAGE` |
| PRODUCT_RULE_006 | Product | Product soft-delete chuyển publishStatus sang `TRASH`; restore từ `TRASH` về `DRAFT`; re-delete `TRASH` là no-op. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `AdminCatalogMutationService` | `MISSING_TEST_COVERAGE` |
| CATEGORY_RULE_001 | Category/Brand | Public category/brand chỉ trả visible item. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `CatalogReadService` | `MISSING_TEST_COVERAGE` |
| CATEGORY_RULE_002 | Category | Không được ẩn category nếu còn visible child categories. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `AdminCatalogMutationService` | `MISSING_TEST_COVERAGE` |
| CATEGORY_RULE_003 | Category | Category không được là parent của chính nó hoặc tạo vòng lặp parent-child. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `AdminCatalogMutationService` | `MISSING_TEST_COVERAGE` |
| ORDER_RULE_001 | Order | Checkout từ cart không được tạo order nếu cart rỗng. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `CheckoutService` | Phase report exists; fresh test not run |
| ORDER_RULE_002 | Order | Checkout phải validate address, phone, email. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `CheckoutService` | Phase report exists; fresh test not run |
| ORDER_RULE_003 | Order | Order status transition phải hợp lệ, không chuyển tùy tiện. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService` | `MISSING_TEST_COVERAGE` |
| ORDER_RULE_004 | Order | Admin action order cần permission phù hợp. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderController`, `DevAdminAuthService` | `MISSING_TEST_COVERAGE` |
| PAYMENT_RULE_001 | Payment | Checkout chỉ hỗ trợ payment method `COD` hoặc `BACS`. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `CheckoutService` | Phase report exists; fresh test not run |
| PAYMENT_RULE_002 | Payment | Refund chỉ được tạo khi order đã `PAID` hoặc `PARTIALLY_PAID`. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService` | `MISSING_TEST_COVERAGE` |
| PAYMENT_RULE_003 | Payment | Refund amount không được vượt refundable amount. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService` | `MISSING_TEST_COVERAGE` |
| PAYMENT_RULE_004 | Payment | Payment webhook/provider idempotency/signature không được xác nhận. | Unknown | `NOT_FOUND_IN_REPO` | No webhook evidence found | N/A |
| SHIPPING_RULE_001 | Shipping | Checkout shipping method phải tồn tại và enabled. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `CheckoutService` | `MISSING_TEST_COVERAGE` |
| SHIPPING_RULE_002 | Shipping | Nếu nhiều shipping methods enabled thì checkout phải có shippingMethodId. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `CheckoutService` | `MISSING_TEST_COVERAGE` |
| SHIPPING_RULE_003 | Shipping | External carrier tracking/waybill rule chưa thấy. | Unknown | `NOT_FOUND_IN_REPO` | No carrier integration evidence | N/A |
| INVENTORY_RULE_001 | Inventory | Không được checkout vượt tồn kho hoặc khi sản phẩm out-of-stock/unavailable. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `CheckoutService` | `MISSING_TEST_COVERAGE` |
| INVENTORY_RULE_002 | Inventory | Checkout/quick-buy phải trừ stock sau khi order được tạo. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `CheckoutService` | `MISSING_TEST_COVERAGE` |
| INVENTORY_RULE_003 | Inventory | Variant stock movement phải ghi nhận khi trừ stock. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `CheckoutService` | `MISSING_TEST_COVERAGE` |
| INVENTORY_RULE_004 | Inventory | Cancel/refund/return completed phải restore stock nếu rule flow gọi restore. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `AdminOrderService`, `AdminReturnService` | `MISSING_TEST_COVERAGE` |
| RETURN_RULE_001 | Return | Customer return chỉ được tạo bởi authenticated customer cho order của chính họ. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `CustomerOrderController` | `MISSING_TEST_COVERAGE` |
| RETURN_RULE_002 | Return | Return status transition phải hợp lệ. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `AdminReturnService` | `MISSING_TEST_COVERAGE` |
| MEDIA_RULE_001 | Media | Upload media chỉ cho phép MIME type whitelist. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `AdminMediaService` | `MISSING_TEST_COVERAGE` |
| MEDIA_RULE_002 | Media | Upload media bị giới hạn 50 MB. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `AdminMediaService` | `MISSING_TEST_COVERAGE` |
| MEDIA_RULE_003 | Media | Deleted media mặc định bị loại khỏi media list nếu không request status. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `AdminMediaService` | `MISSING_TEST_COVERAGE` |
| CONTENT_RULE_001 | Content/SEO | Admin content type/status/id phải hợp lệ. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `AdminContentController` | `MISSING_TEST_COVERAGE` |
| CONTENT_RULE_002 | Content/SEO | Public content visibility/publish rules cần verify sâu trong read service. | Backend/Unknown | `NEEDS_VERIFICATION` | `ContentController`, `AdminContentController` | `MISSING_TEST_COVERAGE` |
| RBAC_RULE_001 | RBAC | Guest/customer không được gọi admin APIs. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `SecurityConfig` | `MISSING_TEST_COVERAGE` |
| RBAC_RULE_002 | RBAC | Admin mutation/read action phải qua backend permission check. | Backend | `CONFIRMED_BACKEND_ENFORCED` | Admin controllers, `DevAdminAuthService` | `MISSING_TEST_COVERAGE` |
| RBAC_RULE_003 | RBAC | `SUPER_ADMIN` có wildcard permission `*`. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `AdminRolePermissions` | `MISSING_TEST_COVERAGE` |
| RBAC_RULE_004 | RBAC | Admin không được tự deactivate account. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `AdminAdminUsersService` | `MISSING_TEST_COVERAGE` |
| RBAC_RULE_005 | RBAC | Super Admin không được tự demote và không được demote Super Admin cuối cùng. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `AdminAdminUsersService` | `MISSING_TEST_COVERAGE` |
| SETTINGS_RULE_001 | Settings | Public settings không được expose sensitive keys theo phase docs. | Backend/docs | `NEEDS_VERIFICATION` | `PHASE_1J...`, `PublicSettingsController` | Phase report only |
| SETTINGS_RULE_002 | Settings/Menu/Coupon | Settings/menu/coupon write cần permission. | Backend | `CONFIRMED_BACKEND_ENFORCED` | Admin settings/menu/coupon controllers | Phase report exists; fresh test not run |
| INTEGRATION_RULE_001 | Integration | Email notification được trigger khi order/return events xảy ra, nhưng delivery runtime chưa verify. | Backend/service call | `NEEDS_VERIFICATION` | `CheckoutService`, `AdminOrderService`, `AdminReturnService`, `OrderNotificationService` | `MISSING_TEST_COVERAGE` |
| INTEGRATION_RULE_002 | Integration | Media storage dùng MinIO/S3-compatible config; public/CDN behavior cần verify. | Backend/config | `NEEDS_VERIFICATION` | `AdminMediaService`, `MinioConfig`, `docker-compose.yaml` | `MISSING_TEST_COVERAGE` |
| REPORT_RULE_001 | Reporting | Report/export yêu cầu read permission tương ứng. | Backend | `CONFIRMED_BACKEND_ENFORCED` | `AdminReportController`, `AdminInventoryController` | `MISSING_TEST_COVERAGE` |

## 4. Product Rules

### PRODUCT_RULE_001: Public catalog chỉ trả product PUBLISHED

| Field | Value |
|---|---|
| Rule | Public product list/detail/snapshot chỉ trả product có `publishStatus == PUBLISHED`. |
| Domain | Product |
| Applies To | Public Web, Mobile, Backend, Catalog DB/read model |
| Trigger / Action | Guest/customer browse product listing, product detail, product snapshot. |
| Preconditions | Product tồn tại trong catalog. |
| Expected Behavior | Backend lọc product public theo `PUBLISHED`; non-published product không trả public. |
| Forbidden Behavior | Public web/mobile nhìn thấy DRAFT/HIDDEN/ARCHIVED/TRASH product. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/catalog/CatalogReadService.java` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Verify UI and integration tests for product visibility. |

### PRODUCT_RULE_002: Quick-buy chỉ cho product PUBLISHED

| Field | Value |
|---|---|
| Rule | Quick-buy không được tạo order cho product chưa `PUBLISHED`. |
| Domain | Product / Checkout |
| Applies To | Backend checkout, Public Web/Mobile quick-buy |
| Trigger / Action | Customer/guest gọi quick-buy. |
| Preconditions | ProductId hợp lệ. |
| Expected Behavior | Nếu product không `PUBLISHED`, backend reject với conflict. |
| Forbidden Behavior | Order được tạo cho draft/hidden/unpublished product. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Add negative test: quick-buy draft product must fail. |

### PRODUCT_RULE_003: Product create required fields

| Field | Value |
|---|---|
| Rule | Khi tạo product, backend yêu cầu slug, name, retailPrice, stockState, publishStatus và categoryId. |
| Domain | Product |
| Applies To | Admin product create |
| Trigger / Action | Admin creates product. |
| Preconditions | JPA persistence enabled; admin has permission. |
| Expected Behavior | Missing required fields produce validation errors. |
| Forbidden Behavior | Product created with missing core fields. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCatalogMutationService.java` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Confirm UI form mirrors backend-required fields. |

### PRODUCT_RULE_004: Product/category/brand slug uniqueness

| Field | Value |
|---|---|
| Rule | Product, category và brand slug không được trùng với record khác. |
| Domain | Product / Category / Brand |
| Applies To | Admin create/update product/category/brand |
| Trigger / Action | Admin creates/updates slug. |
| Preconditions | Slug provided. |
| Expected Behavior | Backend checks existing entity by slug and rejects duplicate. |
| Forbidden Behavior | Two public entities share same slug causing SEO/routing collision. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCatalogMutationService.java` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | DB unique constraints should be verified in migrations/schema. |

### PRODUCT_RULE_005: Product prices must be valid

| Field | Value |
|---|---|
| Rule | Retail/compare-at/sale prices phải không âm; sale price phải tuân thủ rule so với retail/compare-at. |
| Domain | Product / Price |
| Applies To | Product and variants |
| Trigger / Action | Admin creates/updates product/variant price. |
| Preconditions | Price fields provided. |
| Expected Behavior | Backend validates non-negative decimal and sale price relation. |
| Forbidden Behavior | Negative price hoặc sale price invalid được lưu. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCatalogMutationService.java`, `AdminMutationValidators` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Exact sale-price invariant should be documented in `STATE_MACHINES.md` or `DATA_CONTRACT.md` if needed. |

### PRODUCT_RULE_006: Product soft-delete moves to TRASH

| Field | Value |
|---|---|
| Rule | Xóa product trong admin là soft-delete bằng cách chuyển publishStatus sang `TRASH`; re-delete `TRASH` là no-op. |
| Domain | Product |
| Applies To | Admin product delete |
| Trigger / Action | Admin deletes product. |
| Preconditions | Product exists. |
| Expected Behavior | Product publishStatus becomes `TRASH`; public catalog excludes it via `PUBLISHED` filter. |
| Forbidden Behavior | Hard-delete product accidentally or public still shows TRASH product. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCatalogMutationService.java`, `CatalogReadService` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Confirm admin UI labels this as soft delete/trash, not permanent delete. |

### PRODUCT_RULE_007: Variant gallery requires color option

| Field | Value |
|---|---|
| Rule | Variant gallery chỉ hợp lệ khi variant có Color/Màu option; nếu không có color option thì dùng product gallery. |
| Domain | Product / Variant / Media |
| Applies To | Admin product variant gallery |
| Trigger / Action | Admin creates/updates variants with gallery. |
| Preconditions | Variant gallery contains image URLs. |
| Expected Behavior | Backend rejects variant gallery without color option. |
| Forbidden Behavior | Variant gallery exists without color discriminator, causing ambiguous storefront rendering. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCatalogMutationService.java` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Product UI behavior for color-based gallery switching. |

## 5. Category / Brand Rules

### CATEGORY_RULE_001: Public category/brand only visible

| Field | Value |
|---|---|
| Rule | Public category/brand list/detail chỉ trả item có `visible == true`. |
| Domain | Category / Brand |
| Applies To | Public catalog |
| Trigger / Action | Guest/customer browse categories/brands. |
| Preconditions | Category/brand exists. |
| Expected Behavior | Invisible category/brand returns not found or is excluded. |
| Forbidden Behavior | Hidden category/brand appears public. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/catalog/CatalogReadService.java` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Admin UI behavior for visible flag. |

### CATEGORY_RULE_002: Cannot hide category with visible children

| Field | Value |
|---|---|
| Rule | Không được hide category nếu còn visible child categories. |
| Domain | Category |
| Applies To | Admin category delete/hide |
| Trigger / Action | Admin soft-deletes category. |
| Preconditions | Category exists and may have child categories. |
| Expected Behavior | Backend rejects hide when visible children exist. |
| Forbidden Behavior | Parent category hidden while children remain public/orphaned. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCatalogMutationService.java` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | UI should guide admin to hide/re-parent children first. |

### CATEGORY_RULE_003: Category parent cannot create self/circular reference

| Field | Value |
|---|---|
| Rule | Category không được là parent của chính nó và không được tạo circular parent chain. |
| Domain | Category |
| Applies To | Admin category create/update |
| Trigger / Action | Admin sets parentId. |
| Preconditions | parentId provided. |
| Expected Behavior | Backend rejects self-parent and circular chain. |
| Forbidden Behavior | Category tree cycle corrupts navigation. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCatalogMutationService.java` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Add tests for circular category tree. |

## 6. Order Rules

### ORDER_RULE_001: Cart checkout requires non-empty cart

| Field | Value |
|---|---|
| Rule | Không được tạo order từ cart rỗng. |
| Domain | Order / Checkout |
| Applies To | Guest/customer checkout from cart |
| Trigger / Action | Checkout from cart. |
| Preconditions | Cart and items resolved. |
| Expected Behavior | Empty cart returns validation error. |
| Forbidden Behavior | Empty order is created. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java` |
| Test Coverage | Phase report exists; fresh code test not found in audit |
| Needs Verification | Fresh test run and direct test file discovery. |

### ORDER_RULE_002: Checkout address/contact validation

| Field | Value |
|---|---|
| Rule | Checkout billing/shipping address phải có fullName, valid VN phone, valid email if provided, addressLine1. |
| Domain | Order / Checkout / Customer Info |
| Applies To | Guest/customer checkout and quick-buy |
| Trigger / Action | Checkout submission. |
| Preconditions | Checkout request submitted. |
| Expected Behavior | Backend rejects invalid/missing contact/address fields. |
| Forbidden Behavior | Order created with invalid phone/email/missing address. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java` |
| Test Coverage | Phase report exists; fresh code test not found in audit |
| Needs Verification | Frontend validation parity. |

### ORDER_RULE_003: Order status transition must be valid

| Field | Value |
|---|---|
| Rule | Admin không được chuyển order sang status bất hợp lệ hoặc transition không được phép. |
| Domain | Order |
| Applies To | Admin order processing |
| Trigger / Action | Admin updates order status. |
| Preconditions | Order exists; admin has permission. |
| Expected Behavior | Backend validates known status and allowed transition before update. |
| Forbidden Behavior | Completed/cancelled/refunded order bị chuyển lung tung trái state rule. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Exact transition table should be extracted into `STATE_MACHINES.md`. |

### ORDER_RULE_004: Admin order mutations require permission

| Field | Value |
|---|---|
| Rule | Admin chỉ được update order/payment/refund/note khi có permission backend tương ứng. |
| Domain | Order / RBAC |
| Applies To | Admin order APIs |
| Trigger / Action | List/detail/status/payment/refund/note actions. |
| Preconditions | Admin principal or dev/mock admin context. |
| Expected Behavior | Backend calls permission service before action. |
| Forbidden Behavior | Frontend-only guard; unauthorized admin mutates order. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminOrderController.java`, `DevAdminAuthService` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Full permission matrix and negative permission tests. |

## 7. Payment Rules

### PAYMENT_RULE_001: Checkout supports only COD and BACS

| Field | Value |
|---|---|
| Rule | Payment method phải là `COD` hoặc `BACS`. |
| Domain | Payment / Checkout |
| Applies To | Checkout from cart, quick-buy |
| Trigger / Action | Checkout request submitted. |
| Preconditions | paymentMethod provided. |
| Expected Behavior | Backend rejects unsupported payment method. |
| Forbidden Behavior | Unknown method creates payment/order state. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java` |
| Test Coverage | Phase report exists; fresh code test not found in audit |
| Needs Verification | Payment method UI/config alignment. |

### PAYMENT_RULE_002: Initial order status depends on payment method

| Field | Value |
|---|---|
| Rule | COD order starts `PROCESSING`; BACS order starts `ON_HOLD`; payment status starts `UNPAID`; payment record starts `PENDING`. |
| Domain | Payment / Order |
| Applies To | Checkout order creation |
| Trigger / Action | Order build during checkout/quick-buy. |
| Preconditions | Valid payment method. |
| Expected Behavior | Backend initializes order/payment state consistently. |
| Forbidden Behavior | Payment/order status mismatch after checkout. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java`, `PHASE_1F_CHECKOUT_API_REPORT.md` |
| Test Coverage | Phase report exists; fresh code test not found in audit |
| Needs Verification | Document exact status transitions in `STATE_MACHINES.md`. |

### PAYMENT_RULE_003: Refund requires paid/partially paid order

| Field | Value |
|---|---|
| Rule | Refund chỉ được tạo khi order payment status là `PAID` hoặc `PARTIALLY_PAID`. |
| Domain | Payment / Refund |
| Applies To | Admin refund action |
| Trigger / Action | Admin creates refund. |
| Preconditions | Order exists and admin has permission. |
| Expected Behavior | Backend rejects refund for unpaid/pending/cancelled/etc. |
| Forbidden Behavior | Refund issued against unpaid order. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Refund UI should hide/disable when not eligible, but backend remains authority. |

### PAYMENT_RULE_004: Refund amount cannot exceed refundable amount

| Field | Value |
|---|---|
| Rule | Refund amount phải > 0 và không vượt paid/refundable amount còn lại. |
| Domain | Payment / Refund |
| Applies To | Admin refund action |
| Trigger / Action | Admin enters refund amount. |
| Preconditions | Order has paid amount. |
| Expected Behavior | Backend rejects invalid amount. |
| Forbidden Behavior | Refund vượt số đã thanh toán. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Report/revenue impact rules. |

### PAYMENT_RULE_005: Payment webhook rule not found

| Field | Value |
|---|---|
| Rule | Payment webhook should verify authenticity and be idempotent if external provider exists. |
| Domain | Payment Integration |
| Applies To | External payment provider callbacks. |
| Trigger / Action | Provider callback/webhook. |
| Preconditions | External provider integration exists. |
| Expected Behavior | Verify signature/secret, handle duplicate callbacks idempotently. |
| Forbidden Behavior | Blindly trust unverified payment callbacks. |
| Enforcement Layer | Unknown |
| Status | `NOT_FOUND_IN_REPO` |
| Evidence | No payment webhook/provider evidence found in audited files. |
| Test Coverage | N/A |
| Needs Verification | Confirm whether SePay/bank webhook/QR is planned outside current repo. |

## 8. Shipping / Fulfillment Rules

### SHIPPING_RULE_001: Shipping method must exist and be enabled

| Field | Value |
|---|---|
| Rule | Checkout shippingMethodId phải là valid UUID, tồn tại và enabled. |
| Domain | Shipping / Checkout |
| Applies To | Checkout order creation |
| Trigger / Action | Checkout resolves shipping method. |
| Preconditions | shippingMethodId provided. |
| Expected Behavior | Invalid/not found/disabled method is rejected. |
| Forbidden Behavior | Order created with disabled or non-existent shipping method. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Shipping methods admin UI validation. |

### SHIPPING_RULE_002: Shipping method required when multiple methods exist

| Field | Value |
|---|---|
| Rule | Nếu có nhiều enabled shipping methods, checkout phải cung cấp shippingMethodId; nếu chỉ có một enabled method, backend auto-select. |
| Domain | Shipping / Checkout |
| Applies To | Checkout order creation |
| Trigger / Action | Checkout without shippingMethodId. |
| Preconditions | Enabled shipping methods exist. |
| Expected Behavior | Auto-select only when exactly one enabled method; otherwise reject. |
| Forbidden Behavior | System silently chooses arbitrary shipping method when many options exist. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Frontend checkout selection UX. |

### SHIPPING_RULE_003: Carrier/tracking rule not confirmed

| Field | Value |
|---|---|
| Rule | Carrier tracking/waybill updates should follow provider rules if integration exists. |
| Domain | Shipping / Fulfillment |
| Applies To | External shipping provider. |
| Trigger / Action | Create shipment / receive tracking update. |
| Preconditions | Carrier integration exists. |
| Expected Behavior | Verify provider response and update fulfillment state. |
| Forbidden Behavior | Fake/unverified tracking status updates. |
| Enforcement Layer | Unknown |
| Status | `NOT_FOUND_IN_REPO` |
| Evidence | No provider-specific shipping integration found; `AdminShippingController` confirms internal zones/methods only. |
| Test Coverage | N/A |
| Needs Verification | Confirm GHN/GHTK/ViettelPost scope. |

## 9. Inventory Rules

### INVENTORY_RULE_001: Do not sell beyond stock

| Field | Value |
|---|---|
| Rule | Checkout/quick-buy phải reject khi product/variant unavailable, out-of-stock hoặc quantity không đủ. |
| Domain | Inventory / Checkout |
| Applies To | Cart checkout and quick-buy |
| Trigger / Action | Customer attempts order creation. |
| Preconditions | Product/variant exists. |
| Expected Behavior | Backend validates stock before creating order. |
| Forbidden Behavior | Order created beyond available stock. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Race-condition tests/concurrency tests. |

### INVENTORY_RULE_002: Stock decremented after order creation

| Field | Value |
|---|---|
| Rule | Sau khi order được lưu, backend trừ stock product/variant. |
| Domain | Inventory / Order |
| Applies To | Checkout and quick-buy |
| Trigger / Action | Order saved. |
| Preconditions | Valid order and stock available. |
| Expected Behavior | Product/variant stock quantity decreases. |
| Forbidden Behavior | Order created without stock change. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Product-level stock movement symmetry. |

### INVENTORY_RULE_003: Stock movement recorded for variant stock changes

| Field | Value |
|---|---|
| Rule | Variant decrement writes stock movement with reference type `ORDER`. |
| Domain | Inventory |
| Applies To | Variant-based checkout/quick-buy |
| Trigger / Action | Decrement variant stock. |
| Preconditions | Variant exists and manage stock flow applies. |
| Expected Behavior | StockMovement record captures quantity before/after and order reference. |
| Forbidden Behavior | Stock changes without movement/audit trail. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Product-level non-variant stock movement behavior. |

### INVENTORY_RULE_004: Cancel/refund/return restores stock

| Field | Value |
|---|---|
| Rule | Khi order bị cancel/refund hoặc return completed, backend restore stock theo service flow. |
| Domain | Inventory / Order / Return |
| Applies To | Admin order status update, refund, return status update. |
| Trigger / Action | Cancel/refund/return completed. |
| Preconditions | Order/return exists with line items. |
| Expected Behavior | Stock restored and stock movement recorded where implemented. |
| Forbidden Behavior | Hủy/hoàn/trả hàng nhưng tồn kho không phản ánh. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminOrderService.java`, `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminReturnService.java` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Exact restore conditions and duplicate-restore prevention. |

## 10. Return / Refund Rules

### RETURN_RULE_001: Customer return requires authenticated customer context

| Field | Value |
|---|---|
| Rule | Customer return/list/detail order actions require authenticated customer and use customerId from security context. |
| Domain | Return / Customer Order |
| Applies To | Customer order/return APIs |
| Trigger / Action | Customer lists orders/returns or creates return. |
| Preconditions | `CustomerPrincipal` exists in security context. |
| Expected Behavior | Backend rejects unauthenticated access and scopes to own customerId. |
| Forbidden Behavior | Customer reads/returns another customer's order. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/order/CustomerOrderController.java` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Eligibility rules inside `CustomerReturnService`. |

### RETURN_RULE_002: Return status transition must be valid

| Field | Value |
|---|---|
| Rule | Admin return status update phải theo allowed transition map. |
| Domain | Return |
| Applies To | Admin return processing |
| Trigger / Action | Admin updates return status. |
| Preconditions | Return exists and admin has permission. |
| Expected Behavior | Backend rejects invalid transition and triggers notification/stock restore for valid events. |
| Forbidden Behavior | Return status jumps to arbitrary state. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminReturnService.java` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Move full transition table to `STATE_MACHINES.md`. |

## 11. Media Rules

### MEDIA_RULE_001: Media upload MIME whitelist

| Field | Value |
|---|---|
| Rule | Media upload chỉ cho phép MIME types trong whitelist. |
| Domain | Media |
| Applies To | Admin media upload |
| Trigger / Action | Admin uploads media. |
| Preconditions | Multipart file provided. |
| Expected Behavior | Unsupported MIME type is rejected. |
| Forbidden Behavior | Upload arbitrary/dangerous file type. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Magic-byte/content sniffing; MIME header alone is not enough for high-security upload. |

### MEDIA_RULE_002: Media upload size limit

| Field | Value |
|---|---|
| Rule | Media upload không được vượt 50 MB. |
| Domain | Media |
| Applies To | Admin media upload |
| Trigger / Action | Admin uploads media. |
| Preconditions | Multipart file provided. |
| Expected Behavior | File > 50 MB is rejected. |
| Forbidden Behavior | Oversized media uploaded and stored. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Reverse proxy/server upload size limit alignment. |

### MEDIA_RULE_003: Deleted media excluded by default

| Field | Value |
|---|---|
| Rule | Media list mặc định exclude `DELETED`; chỉ include khi status filter yêu cầu. |
| Domain | Media |
| Applies To | Admin media list |
| Trigger / Action | Admin lists media. |
| Preconditions | Media records exist. |
| Expected Behavior | Deleted media not shown by default. |
| Forbidden Behavior | Deleted media appears as active library item. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Public rendering should not use deleted media references; not fully confirmed. |

### MEDIA_RULE_004: Media status must be allowed value

| Field | Value |
|---|---|
| Rule | Media status update chỉ nhận `ACTIVE`, `INACTIVE`, `DELETED`. |
| Domain | Media |
| Applies To | Admin media update |
| Trigger / Action | Admin updates media status. |
| Preconditions | Media exists. |
| Expected Behavior | Unknown status is rejected. |
| Forbidden Behavior | Arbitrary media status corrupts UI/query logic. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminMediaService.java` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Public visibility rule for `INACTIVE`. |

## 12. Content / SEO Rules

### CONTENT_RULE_001: Admin content type/status/id validation

| Field | Value |
|---|---|
| Rule | Admin content APIs validate content type, path type, ID format and publish status. |
| Domain | Content / SEO |
| Applies To | Admin article/page CRUD |
| Trigger / Action | Admin lists/reads/creates/updates/deletes content. |
| Preconditions | Request contains type/id/status fields. |
| Expected Behavior | Invalid type/status/id is rejected by validation annotations. |
| Forbidden Behavior | Arbitrary content type/status enters system. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminContentController.java` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Mutation service business validations and public filtering. |

### CONTENT_RULE_002: Public content visibility requires verification

| Field | Value |
|---|---|
| Rule | Draft/hidden/archived content should not be public unless business explicitly allows it. |
| Domain | Content / SEO |
| Applies To | Public content pages/articles. |
| Trigger / Action | Guest/customer requests article/page. |
| Preconditions | Content exists with publish status. |
| Expected Behavior | Public API only returns public-eligible content. |
| Forbidden Behavior | Draft or hidden content leaks public. |
| Enforcement Layer | Unknown until public read service audit. |
| Status | `NEEDS_VERIFICATION` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/content/ContentController.java`, `AdminContentController` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Audit public content read service and tests. |

### SEO_RULE_001: Homepage metadata and JSON-LD exist, full SEO coverage needs verification

| Field | Value |
|---|---|
| Rule | Public SEO metadata/canonical/JSON-LD should be correct for SEO-critical pages. |
| Domain | SEO |
| Applies To | Homepage, product/category/content pages. |
| Trigger / Action | Public page render. |
| Preconditions | Public page data/settings exist. |
| Expected Behavior | SEO metadata renders consistently. |
| Forbidden Behavior | Missing/incorrect canonical/meta causes SEO regression. |
| Enforcement Layer | Frontend/server render for homepage; unknown for all pages. |
| Status | `NEEDS_VERIFICATION` |
| Evidence | `bigbike-web/app/page.tsx`, `bigbike-web/lib/utils/routes.ts` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Sitemap/robots/per-page SEO audit. |

## 13. User / Role / Permission Rules

### RBAC_RULE_001: Admin APIs require admin role

| Field | Value |
|---|---|
| Rule | Guest/customer không được gọi `/api/v1/admin/**`; admin APIs require `ROLE_ADMIN`. |
| Domain | RBAC / Security |
| Applies To | All admin APIs |
| Trigger / Action | Any admin API request. |
| Preconditions | Request reaches backend. |
| Expected Behavior | Backend blocks non-admin principal. |
| Forbidden Behavior | Guest/customer/adminless request mutates admin resources. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/config/SecurityConfig.java` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Security integration tests. |

### RBAC_RULE_002: Admin actions require business permission

| Field | Value |
|---|---|
| Rule | Admin read/write/mutation actions must pass `requirePermission`. |
| Domain | RBAC / Permission |
| Applies To | Admin controllers/modules |
| Trigger / Action | Admin executes module action. |
| Preconditions | Admin authenticated. |
| Expected Behavior | Backend checks permission string; missing permission throws forbidden. |
| Forbidden Behavior | UI-hiding-only permission model. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | Admin controllers, `DevAdminAuthService`, `AdminRolePermissions` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Complete `PERMISSION_MATRIX.md`. |

### RBAC_RULE_003: Super Admin wildcard permission

| Field | Value |
|---|---|
| Rule | `SUPER_ADMIN` has wildcard permission `*`. |
| Domain | RBAC |
| Applies To | Admin permission checks |
| Trigger / Action | Permission resolution. |
| Preconditions | Admin principal role is `SUPER_ADMIN`. |
| Expected Behavior | Super Admin can pass all permission checks. |
| Forbidden Behavior | Super Admin unexpectedly blocked from core admin actions. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/auth/AdminRolePermissions.java`, `DevAdminAuthService` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | UI parity for Super Admin. |

### RBAC_RULE_004: Admin cannot deactivate self

| Field | Value |
|---|---|
| Rule | Admin không được deactivate/suspend chính tài khoản đang thao tác. |
| Domain | RBAC / Admin User |
| Applies To | Admin user update |
| Trigger / Action | Admin updates own status. |
| Preconditions | Target user ID equals actor ID. |
| Expected Behavior | Backend rejects non-ACTIVE self-status update. |
| Forbidden Behavior | Admin khóa chính mình và gây lockout. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminAdminUsersService.java` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | UI should hide/disable self-deactivation. |

### RBAC_RULE_005: Super Admin protection

| Field | Value |
|---|---|
| Rule | Super Admin không được tự demote; không được demote Super Admin active cuối cùng. |
| Domain | RBAC / Admin User |
| Applies To | Admin user role update |
| Trigger / Action | Admin updates role from `SUPER_ADMIN` to another role. |
| Preconditions | Target user is Super Admin. |
| Expected Behavior | Backend rejects self-demotion and last-active-Super-Admin demotion. |
| Forbidden Behavior | Hệ thống mất Super Admin cuối cùng. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminAdminUsersService.java` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Role management UI confirmation and tests. |

### RBAC_RULE_006: Admin user creation validates email/role/password

| Field | Value |
|---|---|
| Rule | Admin user creation requires valid unique email, displayName, valid role, password >= 8 chars. |
| Domain | RBAC / Admin User |
| Applies To | Admin user create |
| Trigger / Action | Admin creates internal user. |
| Preconditions | Actor has admin-users write permission. |
| Expected Behavior | Backend rejects missing/invalid/duplicate email, invalid role, weak password. |
| Forbidden Behavior | Invalid admin account created. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminAdminUsersService.java` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Password policy may need stronger business/security requirements. |

## 14. Settings / Configuration Rules

### SETTINGS_RULE_001: Settings/menu/coupon writes require permission

| Field | Value |
|---|---|
| Rule | Admin settings/menu/coupon write actions require backend permission. |
| Domain | Settings / Menu / Coupon / RBAC |
| Applies To | Admin settings, menu and coupon modules. |
| Trigger / Action | Admin reads/writes config. |
| Preconditions | Admin principal exists. |
| Expected Behavior | Backend rejects missing permission. |
| Forbidden Behavior | Unauthorized staff changes site config/promotion. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `AdminSettingsController`, `AdminMenuController`, `AdminCouponController`, `PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md` |
| Test Coverage | Phase report exists; fresh code test not found in audit |
| Needs Verification | Full permission matrix and UI guard. |

### SETTINGS_RULE_002: Public settings must not expose sensitive values

| Field | Value |
|---|---|
| Rule | Public settings endpoint must not expose sensitive/private settings. |
| Domain | Settings / Security |
| Applies To | Public settings API consumed by public web. |
| Trigger / Action | Guest/public web reads settings. |
| Preconditions | Settings exist. |
| Expected Behavior | Only public-safe keys are returned. |
| Forbidden Behavior | Secrets/env/private settings leak to frontend. |
| Enforcement Layer | Backend/docs evidence, needs deeper source verification. |
| Status | `NEEDS_VERIFICATION` |
| Evidence | `PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md`, `PublicSettingsController` |
| Test Coverage | Phase report exists; fresh code test not found in audit |
| Needs Verification | Audit PublicSettingsController/service exact whitelist/blacklist. |

## 15. Reporting / Dashboard Rules

### REPORT_RULE_001: Reports/export require read permissions

| Field | Value |
|---|---|
| Rule | Report/export endpoints require read permission for the relevant domain. |
| Domain | Reporting / RBAC |
| Applies To | Analytics/export orders/customers/products/inventory. |
| Trigger / Action | Admin opens report/export. |
| Preconditions | Admin principal exists. |
| Expected Behavior | Backend checks permission before returning report/export. |
| Forbidden Behavior | Unauthorized user exports business data. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` |
| Evidence | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/admin/AdminReportController.java`, `AdminInventoryController` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Metric correctness and revenue/refund calculation rules. |

### REPORT_RULE_002: Revenue/report semantics need verification

| Field | Value |
|---|---|
| Rule | Cancelled/refunded/partially-paid orders should affect revenue metrics according to business definition. |
| Domain | Reporting / Payment / Order |
| Applies To | Dashboard/report analytics. |
| Trigger / Action | Admin views analytics/export. |
| Preconditions | Orders/payments/refunds exist. |
| Expected Behavior | Metrics should reflect business-approved revenue logic. |
| Forbidden Behavior | Report counts cancelled/refunded/unpaid orders incorrectly. |
| Enforcement Layer | Unknown until report service audit. |
| Status | `NEEDS_VERIFICATION` |
| Evidence | `AdminReportController`, `AdminReportService` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | Audit report service and define finance metric rules. |

## 16. Integration Rules

### INTEGRATION_RULE_001: Email notification is event-triggered but delivery needs verification

| Field | Value |
|---|---|
| Rule | Order/return events call notification service; production delivery must be verified. |
| Domain | Notification / Integration |
| Applies To | Checkout, order status/payment/refund/note, return status. |
| Trigger / Action | Business event occurs. |
| Preconditions | Notification service and mail config available. |
| Expected Behavior | Service calls happen on relevant events. |
| Forbidden Behavior | Critical customer/admin notifications silently missing in production. |
| Enforcement Layer | Backend service calls; runtime external service unknown. |
| Status | `NEEDS_VERIFICATION` |
| Evidence | `CheckoutService`, `AdminOrderService`, `AdminReturnService`, `OrderNotificationService`, `bigbike-backend/pom.xml`, `docker-compose.yaml` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | SMTP credentials/config, templates, retry/failure handling. |

### INTEGRATION_RULE_002: Media storage writes to MinIO, public delivery needs verification

| Field | Value |
|---|---|
| Rule | Media upload writes object to MinIO/S3-compatible storage and stores relative public URL. |
| Domain | Media / Storage Integration |
| Applies To | Admin media upload. |
| Trigger / Action | Upload media. |
| Preconditions | MinIO config/bucket available. |
| Expected Behavior | Object stored and MediaEntity created. |
| Forbidden Behavior | DB says media exists while object upload failed. |
| Enforcement Layer | Backend |
| Status | `CONFIRMED_BACKEND_ENFORCED` for upload/storage attempt; public/CDN runtime `NEEDS_VERIFICATION` |
| Evidence | `AdminMediaService`, `MinioConfig`, `MinioProperties`, `docker-compose.yaml` |
| Test Coverage | `MISSING_TEST_COVERAGE` |
| Needs Verification | CDN/proxy `/media/*`, bucket policy, fallback/error handling. |

### INTEGRATION_RULE_003: External payment/shipping providers not confirmed

| Field | Value |
|---|---|
| Rule | External payment/shipping integrations must verify callbacks and avoid duplicate side effects if implemented. |
| Domain | Integration / Payment / Shipping |
| Applies To | Future provider workflows. |
| Trigger / Action | Webhook/callback/provider event. |
| Preconditions | Provider integration exists. |
| Expected Behavior | Verify signature/auth, idempotent processing, failure retry/logging. |
| Forbidden Behavior | Blindly trust provider callback or duplicate transaction/shipment updates. |
| Enforcement Layer | Unknown |
| Status | `NOT_FOUND_IN_REPO` |
| Evidence | No payment webhook/shipping provider evidence found in audited files. |
| Test Coverage | N/A |
| Needs Verification | Confirm integration roadmap/scope. |

## 17. Cross-Domain Rules

| Rule | Affected Domains | Reason | Status |
|---|---|---|---|
| Product visibility depends on publish status and category/brand visibility. | Product, Category, Brand, Public Web, SEO | Public pages must not leak draft/hidden records. | `CONFIRMED_BACKEND_ENFORCED` for product/category/brand public filters |
| Checkout affects order, payment, inventory, notification and cart status. | Checkout, Cart, Order, Payment, Inventory, Notification | One customer action creates several durable side effects. | `CONFIRMED_BACKEND_ENFORCED` |
| Payment/refund affects order state and reporting. | Payment, Order, Reports | Payment status/refund changes business totals. | `CONFIRMED_BACKEND_ENFORCED`; reporting semantics `NEEDS_VERIFICATION` |
| Cancel/refund/return affects inventory. | Order, Return, Inventory | Stock must reflect business reversals. | `CONFIRMED_BACKEND_ENFORCED`; duplicate restore prevention `NEEDS_VERIFICATION` |
| Permission affects all admin actions. | RBAC, Admin modules, Audit | Backend must reject unauthorized changes. | `CONFIRMED_BACKEND_ENFORCED` |
| Media affects product/content display and SEO quality. | Media, Product, Content, SEO | Invalid/deleted media can break public UI. | `CONFIRMED_BACKEND_ENFORCED` for upload validation; public deleted-media behavior `NEEDS_VERIFICATION` |
| Settings/menu affect public web behavior. | Settings, Menu, Public Web, SEO | Public web consumes public settings/menu. | `CONFIRMED_BACKEND_ENFORCED` for APIs; sanitization `NEEDS_VERIFICATION` |
| External payment/shipping providers affect money/order/fulfillment if implemented. | Payment, Shipping, Order, Audit | Provider events are high-risk integration points. | `NOT_FOUND_IN_REPO` |

## 18. Backend Enforcement Requirements

Rules that affect data, money, inventory, permission, state transition or security must be enforced in backend. Frontend validation is allowed for UX only.

Minimum backend requirements:

- Validate every mutation request server-side.
- Reject invalid state transitions server-side.
- Enforce permission server-side for every admin/internal action.
- Validate payment/refund amounts server-side.
- Validate stock availability server-side.
- Validate media file type/size server-side.
- Never expose sensitive settings to public endpoints.
- Ensure external webhooks, if implemented later, use signature/auth verification and idempotency.
- Add negative tests for critical business rules.

Current audit result:

- Many core rules are backend-enforced.
- Direct test code discovery returned no obvious matches for key service test names during this task.
- Some phase reports document test coverage, but fresh build/test/runtime was not run here.

## 19. Missing / Not Confirmed Rules

| Rule / Area | Status | Gap |
|---|---|---|
| Payment webhook signature/idempotency | `NOT_FOUND_IN_REPO` | No payment webhook/provider flow found. |
| Shipping provider tracking/waybill validation | `NOT_FOUND_IN_REPO` | No carrier-specific integration found. |
| Public settings sensitive-key whitelist | `NEEDS_VERIFICATION` | Phase docs mention guard; source/service needs deeper audit. |
| Public content publish filtering | `NEEDS_VERIFICATION` | Admin content validation confirmed; public read filter needs audit. |
| Full SEO canonical/sitemap/robots rules | `NEEDS_VERIFICATION` | Homepage SEO exists; full SEO scope not confirmed. |
| Revenue/report calculation rules | `NEEDS_VERIFICATION` | Report endpoints exist; business metric semantics need audit. |
| Stock cannot go negative as invariant after all flows | `NEEDS_VERIFICATION` | Checkout validates; admin adjust and restore edge cases need tests. |
| Duplicate stock restore prevention | `NEEDS_VERIFICATION` | Restore flows exist; idempotency needs audit. |
| Frontend-only rules | `NEEDS_VERIFICATION` | This task prioritized backend; UI validation/guards need dedicated audit. |
| Backup/restore operational rules | `NOT_FOUND_IN_REPO` | No backup/restore process evidence found. |
| POS business rules | `NEEDS_VERIFICATION` | POS controller exists in prior module docs, but rule set not audited here. |
| Customer return eligibility details | `NEEDS_VERIFICATION` | Customer return controller confirmed; service business rules need deeper audit. |

## 20. Evidence Summary

| Rule ID | Evidence Path | What It Proves | Confidence |
|---|---|---|---|
| PRODUCT_RULE_001 | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/catalog/CatalogReadService.java` | Public product list/detail/snapshot filter `PUBLISHED`. | High |
| PRODUCT_RULE_002 | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/checkout/CheckoutService.java` | Quick-buy rejects non-published products. | High |
| PRODUCT_RULE_003 | `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminCatalogMutationService.java` | Product create required fields. | High |
| PRODUCT_RULE_004 | `AdminCatalogMutationService.java` | Product/category/brand slug duplicate checks. | High |
| PRODUCT_RULE_005 | `AdminCatalogMutationService.java`, `AdminMutationValidators` | Price validation. | Medium-High |
| PRODUCT_RULE_006 | `AdminCatalogMutationService.java`, `CatalogReadService.java` | Product soft-delete to `TRASH` and public filter. | High |
| CATEGORY_RULE_001 | `CatalogReadService.java` | Visible category/brand public filter. | High |
| CATEGORY_RULE_002 | `AdminCatalogMutationService.java` | Cannot hide category with visible children. | High |
| CATEGORY_RULE_003 | `AdminCatalogMutationService.java` | Prevent self-parent/circular category tree. | High |
| ORDER_RULE_001 | `CheckoutService.java` | Empty cart rejected. | High |
| ORDER_RULE_002 | `CheckoutService.java` | Checkout address/contact validation. | High |
| ORDER_RULE_003 | `AdminOrderService.java` | Order status transition validation. | High |
| ORDER_RULE_004 | `AdminOrderController.java`, `DevAdminAuthService.java` | Order action permission enforcement. | High |
| PAYMENT_RULE_001 | `CheckoutService.java` | Only COD/BACS allowed. | High |
| PAYMENT_RULE_002 | `CheckoutService.java`, `PHASE_1F_CHECKOUT_API_REPORT.md` | Initial payment/order status mapping. | High |
| PAYMENT_RULE_003 | `AdminOrderService.java` | Refund eligibility. | High |
| PAYMENT_RULE_004 | `AdminOrderService.java` | Refund limit validation. | High |
| PAYMENT_RULE_005 | Audited payment/checkout/order files | No payment webhook/provider evidence. | High for not found in audited scope |
| SHIPPING_RULE_001 | `CheckoutService.java` | Shipping method validation. | High |
| SHIPPING_RULE_002 | `CheckoutService.java` | Auto-select only one enabled method; require choice if multiple. | High |
| SHIPPING_RULE_003 | Audited shipping files | No external carrier flow found. | High for not found in audited scope |
| INVENTORY_RULE_001 | `CheckoutService.java` | Stock validation before order. | High |
| INVENTORY_RULE_002 | `CheckoutService.java` | Stock decrement after order save. | High |
| INVENTORY_RULE_003 | `CheckoutService.java` | Variant stock movement recorded. | High |
| INVENTORY_RULE_004 | `AdminOrderService.java`, `AdminReturnService.java` | Stock restore on cancel/refund/return. | Medium-High |
| RETURN_RULE_001 | `CustomerOrderController.java` | Customer order/return scoped by authenticated customer. | High |
| RETURN_RULE_002 | `AdminReturnService.java` | Return transition validation. | High |
| MEDIA_RULE_001 | `AdminMediaService.java` | MIME whitelist. | High |
| MEDIA_RULE_002 | `AdminMediaService.java` | 50MB upload limit. | High |
| MEDIA_RULE_003 | `AdminMediaService.java` | Deleted media excluded by default. | High |
| MEDIA_RULE_004 | `AdminMediaService.java` | Allowed media status values. | High |
| CONTENT_RULE_001 | `AdminContentController.java` | Admin content type/status/id validation. | High |
| CONTENT_RULE_002 | `ContentController.java`, `AdminContentController.java` | Content module exists; public visibility rule needs deeper audit. | Medium |
| RBAC_RULE_001 | `SecurityConfig.java` | Admin/customer/public access boundaries. | High |
| RBAC_RULE_002 | Admin controllers, `DevAdminAuthService.java` | Permission checks enforced in backend controllers. | High |
| RBAC_RULE_003 | `AdminRolePermissions.java`, `DevAdminAuthService.java` | Super Admin wildcard permission. | High |
| RBAC_RULE_004 | `AdminAdminUsersService.java` | Self-deactivation blocked. | High |
| RBAC_RULE_005 | `AdminAdminUsersService.java` | Super Admin demotion guardrails. | High |
| RBAC_RULE_006 | `AdminAdminUsersService.java` | Admin user validation. | High |
| SETTINGS_RULE_001 | `AdminSettingsController`, `AdminMenuController`, `AdminCouponController`, `PHASE_1J...` | Permission-enforced config modules. | Medium-High |
| SETTINGS_RULE_002 | `PublicSettingsController`, `PHASE_1J...` | Public/private settings rule needs source confirmation. | Medium |
| REPORT_RULE_001 | `AdminReportController.java`, `AdminInventoryController.java` | Report/export permission checks. | High |
| REPORT_RULE_002 | `AdminReportService` | Report semantics need deeper audit. | Medium |
| INTEGRATION_RULE_001 | `CheckoutService`, `AdminOrderService`, `AdminReturnService`, `OrderNotificationService` | Notification calls triggered by events. | Medium-High |
| INTEGRATION_RULE_002 | `AdminMediaService`, `MinioConfig`, `docker-compose.yaml` | Media storage integration. | High |
| INTEGRATION_RULE_003 | Audited integration files | External payment/shipping provider rules not found. | High for not found in audited scope |

## 21. Test Coverage Summary

| Rule ID | Test Evidence | Positive Test | Negative Test | Status |
|---|---|---|---|---|
| PRODUCT_RULE_001-007 | No direct test files found by targeted GitHub search in this task. | Unknown | Unknown | `MISSING_TEST_COVERAGE` |
| CATEGORY_RULE_001-003 | No direct test files found by targeted GitHub search in this task. | Unknown | Unknown | `MISSING_TEST_COVERAGE` |
| ORDER_RULE_001-002 | `PHASE_1F_CHECKOUT_API_REPORT.md` documents phase tests; direct test files not found in targeted search. | Documented in report | Documented in report but not fresh-run | `NEEDS_VERIFICATION` |
| ORDER_RULE_003-004 | No direct test files found by targeted GitHub search in this task. | Unknown | Unknown | `MISSING_TEST_COVERAGE` |
| PAYMENT_RULE_001-002 | `PHASE_1F_CHECKOUT_API_REPORT.md` documents phase behavior/tests; direct test files not found in targeted search. | Documented in report | Documented in report but not fresh-run | `NEEDS_VERIFICATION` |
| PAYMENT_RULE_003-005 | No direct test files found by targeted GitHub search in this task. | Unknown | Unknown | `MISSING_TEST_COVERAGE` |
| SHIPPING_RULE_001-003 | No direct test files found by targeted GitHub search in this task. | Unknown | Unknown | `MISSING_TEST_COVERAGE` / N/A for not found provider |
| INVENTORY_RULE_001-004 | No direct test files found by targeted GitHub search in this task. | Unknown | Unknown | `MISSING_TEST_COVERAGE` |
| RETURN_RULE_001-002 | No direct test files found by targeted GitHub search in this task. | Unknown | Unknown | `MISSING_TEST_COVERAGE` |
| MEDIA_RULE_001-004 | No direct test files found by targeted GitHub search in this task. | Unknown | Unknown | `MISSING_TEST_COVERAGE` |
| CONTENT_RULE_001-002 | No direct test files found by targeted GitHub search in this task. | Unknown | Unknown | `MISSING_TEST_COVERAGE` |
| RBAC_RULE_001-006 | No direct test files found by targeted GitHub search in this task. | Unknown | Unknown | `MISSING_TEST_COVERAGE` |
| SETTINGS_RULE_001-002 | `PHASE_1J_ADMIN_SETTINGS_MENU_COUPON_API_REPORT.md` documents phase tests; direct test files not found in targeted search. | Documented in report | Documented in report but not fresh-run | `NEEDS_VERIFICATION` |
| REPORT_RULE_001-002 | No direct test files found by targeted GitHub search in this task. | Unknown | Unknown | `MISSING_TEST_COVERAGE` |
| INTEGRATION_RULE_001-003 | No direct test files found by targeted GitHub search in this task. | Unknown | Unknown | `MISSING_TEST_COVERAGE` / N/A for not found providers |

Notes:

- This task did not run build/test/runtime.
- Targeted GitHub search did not find obvious service test files for the queried names.
- Existing phase reports are useful evidence but are not the same as a fresh CI run.

## 22. Known Ambiguities / Needs Verification

1. Coupon rule has docs/code drift: Phase 1J says coupon-cart integration was deferred, while current `CheckoutService` records cart coupons into orders and increments coupon usage.
2. Public settings sensitive-key protection is documented in phase report, but exact service whitelist/blacklist should be source-audited.
3. Public content visibility/publish filtering needs deeper audit of public content read service.
4. Product/category/brand public visibility is confirmed in `CatalogReadService`, but UI/cache/revalidation behavior should be verified.
5. Order/payment/return status transitions are backend-enforced, but full transition tables belong in `STATE_MACHINES.md`.
6. Refund rules are backend-enforced, but report/revenue impact rules need finance/business confirmation.
7. Stock decrement/restore rules are present, but concurrency and duplicate-restore negative tests are not confirmed.
8. Media MIME validation uses `MultipartFile.getContentType()`. For stronger security, content sniffing/magic-byte validation should be considered.
9. Email notification calls exist, but SMTP delivery/retry/failure handling was not runtime-tested.
10. Payment webhook/signature/idempotency rules are not found because payment provider workflow is not found.
11. Shipping provider/tracking rules are not found because carrier integration is not found.
12. Admin RBAC backend enforcement is clear, but admin UI route/action guard behavior needs dedicated audit.
13. Production admin auth readiness needs verification because prior docs/source show dev/mock auth caveat.
14. Direct test files for many rules were not found by targeted search in this task.
15. Build/test/runtime were not run during this documentation task. Do not treat this file as green-build evidence.

## 23. Relationship With Other Docs

| Document | Relationship |
|---|---|
| `PROJECT_OVERVIEW.md` | Tổng quan dự án: BigBike là gì. |
| `BUSINESS_PROCESS.md` | Process nghiệp vụ: doanh nghiệp vận hành như thế nào. |
| `MODULE_CATALOG.md` | Module và feature chịu ảnh hưởng bởi rule. |
| `USER_ROLES.md` | Actor/role chịu rule và restriction. |
| `WORKFLOW_OVERVIEW.md` | Workflow end-to-end bị rule chi phối. |
| `BUSINESS_RULES.md` | File hiện tại: luật nghiệp vụ bắt buộc. |
| `STATE_MACHINES.md` | Nên mô tả trạng thái và transition chi tiết cho product/order/payment/return/content/media. |
| `ACCEPTANCE_CRITERIA.md` | Nên biến rule thành pass/fail criteria. |
| `API_CONTRACT.md` | API phải phản ánh rule qua status/error shape. |
| `DATA_CONTRACT.md` | Data shape/enums liên quan rule. |
| `PERMISSION_MATRIX.md` | Mapping quyền chi tiết theo role/action/API. |
| `TRACEABILITY_MATRIX.md` | Nối rule với module/feature/workflow/API/DB/test. |

## Audit Notes

Documentation này được tạo bằng thao tác đọc/inspect repository qua GitHub connector. Không chạy migration, seed, deploy, refactor hoặc command có side effect. Không sửa business logic hoặc source code ứng dụng.
