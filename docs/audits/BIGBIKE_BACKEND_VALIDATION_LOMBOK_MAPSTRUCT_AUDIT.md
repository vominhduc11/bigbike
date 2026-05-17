# BigBike Backend Validation, Lombok, MapStruct Audit

Ngày thực hiện: 2026-05-17

Phạm vi: `bigbike-backend/src/main/java`, các controller/DTO/service/mapper/entity liên quan, global error handling, cấu hình Maven hiện có và test backend.

## 1. Căn cứ tài liệu

Đã đọc các phần liên quan trước khi sửa code theo docs-first contract:

- `docs/engineering/API_CONTRACT.md`: governance, response shape caveats, auth/customer/public/admin endpoint contracts, settings, warranty, contact message APIs.
- `docs/engineering/DATA_CONTRACT.md`: money shape, address data, coupon channel/status, return data, product stock state, customer/status data.
- `docs/engineering/PERMISSION_MATRIX.md`: permission runtime source, admin permissions, POS, warranty, inventory, media, settings.
- `docs/business/BUSINESS_RULES.md`: coupon, inventory/serial, POS/order, media, contact inbox rules.
- `docs/business/STATE_MACHINES.md`: product/category/order/payment/return/media/admin user state rules and backend enforcement notes.

Kết luận áp dụng: validation annotation chỉ dùng cho shape/syntax/size đơn giản. Rule cần DB, quyền, trạng thái, tồn kho, coupon policy, state machine hoặc audit tiếp tục nằm ở service/policy layer.

## 2. Tổng quan hiện trạng trước refactor

### Validation

- `spring-boot-starter-validation` đã có trong `pom.xml`.
- Nhiều DTO quan trọng đã có Bean Validation, nhưng còn các request dạng update/bulk/nested thiếu constraint hoặc thiếu cascade `@Valid`.
- Một số controller có constraint trên query/path param nhưng chưa bật method validation bằng `@Validated`.
- Global exception handler đã xử lý `MethodArgumentNotValidException`, `ConstraintViolationException`, `BindException`, `HttpMessageNotReadableException`, nhưng chưa xử lý `HandlerMethodValidationException` của Spring 7.

### Lombok

- Lombok đã được cấu hình đúng trong Maven cùng annotation processor.
- Audit không thấy `@Data`, `@SneakyThrows`, `@EqualsAndHashCode`, `@ToString` nguy hiểm trong `src/main/java`.
- Controller/service đang dùng constructor injection với `@RequiredArgsConstructor` khá nhất quán.
- Entity đã tránh `@Data`; không refactor entity hàng loạt vì worktree đang có nhiều thay đổi sẵn và rủi ro JPA/Jackson/MapStruct cao.

### MapStruct

- MapStruct `1.6.3` và `lombok-mapstruct-binding` đã có trong Maven.
- Mapper hiện có trước refactor: audit log, coupon, customer/address, order/address/item/note/payment/receivable/return/shipping/warranty.
- Còn mapping thủ công lặp lại ở contact inbox service, phù hợp để chuyển sang mapper thuần.

## 3. File đã refactor

### Global validation error handling

- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/error/GlobalExceptionHandler.java`
- `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/api/error/ValidationErrorMapper.java`

Thay đổi:

- Bổ sung `HandlerMethodValidationException` vào nhóm validation error.
- Chuẩn hóa mapping lỗi method-level validation thành `ApiErrorDetail` cùng format hiện tại.
- Không trả stack trace hoặc internal exception detail ra client.

### Controller validation

- `api/admin/AdminContactController.java`
- `api/admin/AdminCouponController.java`
- `api/admin/AdminMediaController.java`
- `api/admin/AdminMenuController.java`
- `api/admin/AdminNotificationController.java`
- `api/admin/AdminPosController.java`
- `api/admin/AdminRedirectController.java`
- `api/admin/AdminSettingsController.java`
- `api/admin/AdminWarrantyController.java`
- `api/customer/CustomerWishlistController.java`
- `api/order/CustomerOrderController.java`
- `api/public_/ContactController.java`
- `api/public_/PublicReviewController.java`
- `api/public_/PublicWarrantyController.java`

Thay đổi:

- Thêm `@Valid` cho request body update/bulk khi DTO có constraint.
- Thêm `@Validated` cho controller có query/path constraint.
- Thêm giới hạn pagination `page >= 1`, `size <= 100` ở các endpoint list/search đã chạm.
- Thêm validation size cho query/path param như status, paymentStatus, productId, serial, search query.
- Giữ POS mutation permission-first behavior: rule `items` rỗng vẫn do service trả `409`, không bị Bean Validation trả `400` trước permission check.

### Request DTO validation

- `api/admin/dto/contact/UpdateContactMessageRequest.java`
- `api/admin/dto/coupon/CreateCouponRequest.java`
- `api/admin/dto/coupon/UpdateCouponRequest.java`
- `api/admin/dto/inventory/AddSerialsRequest.java`
- `api/admin/dto/inventory/AdjustStockRequest.java`
- `api/admin/dto/inventory/SerialImportRowRequest.java`
- `api/admin/dto/media/UpdateMediaRequest.java`
- `api/admin/dto/menu/CreateMenuRequest.java`
- `api/admin/dto/menu/CreateMenuItemRequest.java`
- `api/admin/dto/menu/UpdateMenuRequest.java`
- `api/admin/dto/menu/UpdateMenuItemRequest.java`
- `api/admin/dto/menu/ReorderMenuItemsRequest.java`
- `api/admin/dto/menu/ReorderMenuItemRequest.java`
- `api/admin/dto/settings/BatchUpdateSettingsRequest.java`
- `api/admin/dto/settings/UpdateSiteSettingRequest.java`
- `api/checkout/dto/CheckoutAddressRequest.java`
- `api/checkout/dto/CheckoutShippingAddressRequest.java`
- `api/checkout/dto/CheckoutRequest.java`
- `api/checkout/dto/QuickBuyRequest.java`
- `api/order/dto/CreateReturnRequest.java`
- `api/public_/dto/ContactRequest.java`
- `service/pos/PosOrderService.java` nested POS request records

Thay đổi:

- Thêm `@NotBlank`, `@NotNull`, `@NotEmpty`, `@Size`, `@Email`, `@Pattern`, `@Min`, `@Max`, `@DecimalMin`, `@PositiveOrZero` ở các field shape/syntax phù hợp.
- Thêm `@Valid` cho nested object/list item: checkout shipping address, return items, menu reorder items, media/notification bulk IDs, POS line items.
- Giới hạn bulk list size để tránh request quá lớn.
- Với public contact phone, chỉ giữ `@NotBlank` và `@Size(max = 50)` vì API/test hiện tại đang chấp nhận chuỗi phone rộng hơn pattern số thuần. Đây là điểm cần xác nhận nếu muốn siết format.

### MapStruct

- Thêm `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/mapper/ContactMessageMapper.java`
- Sửa `bigbike-backend/src/main/java/com/bigbike/bigbike_backend/service/admin/AdminContactService.java`

Thay đổi:

- Chuyển mapping `ContactMessageEntity -> AdminContactMessageListItem`.
- Chuyển mapping `ContactMessageEntity + assignedAdminName -> AdminContactMessageDetail`.
- Giữ logic truy vấn `assignedAdminName` ở service vì mapper không gọi repository.
- Giữ preview content là mapping thuần, không đụng business rule hay audit masking.

### Lombok

- Không thêm Lombok hàng loạt.
- Tận dụng `@RequiredArgsConstructor` hiện có ở service/controller khi inject mapper mới.
- Không đổi entity sang `@Data`, không thêm `@Builder` vào entity, không đổi constructor/visibility JPA.

## 4. Mapping thủ công đã thay bằng MapStruct

- `AdminContactService#toListItem`
- `AdminContactService#toDetail`

Lý do an toàn:

- Mapping thuần từ entity sang DTO.
- Không cần repository trong mapper.
- Không chứa permission/state transition/business calculation.
- Response shape giữ nguyên DTO hiện tại.

## 5. Mapping thủ công giữ lại

- Catalog/product/category mapping trong admin/public catalog services: giữ lại vì đang gắn với derived field như `stockState`, media/spec/SEO shape, variant stock và logic contract trong `DATA_CONTRACT.md`.
- Checkout/order/POS mapping: giữ lại vì có tổng tiền, tồn kho, coupon, payment, serial, idempotency, audit và permission, thuộc business/service layer.
- Review submit mapping/validation: giữ lại manual vì endpoint có honeypot/anti-spam behavior và validation response hiện tại đã được test.
- Settings/menu dynamic data: chỉ thêm validation DTO, chưa tạo mapper mới vì mapping hiện tại ngắn và không lặp đủ để đáng đổi.
- Mapper cho product/category/media rộng hơn: không làm trong lượt này để tránh đổi JSON field/derived field hoặc lộ field nội bộ.

## 6. Điểm rủi ro và `NEEDS_CONFIRMATION`

- `NEEDS_CONFIRMATION`: Chưa có canonical phone format chung cho public contact, checkout, customer address. Public contact hiện giữ format rộng để không phá API/test cũ; nếu muốn siết số điện thoại Việt Nam, cần cập nhật docs + frontend/mobile trước.
- `NEEDS_CONFIRMATION`: Một số admin mutation yêu cầu permission-first (`403`) trước validation body (`400`). POS là ví dụ đã giữ service validation để không phá `PERMISSION_MATRIX.md` và test RBAC. Nếu muốn toàn hệ thống body validation chạy trước permission, cần quyết định lại contract lỗi.
- `NEEDS_CONFIRMATION`: Product/category/media mapper MapStruct ở quy mô lớn cần một contract DTO rõ hơn cho derived fields và field private/public. Không nên refactor máy móc khi `DATA_CONTRACT.md` còn nhiều field derived/read-only.
- `NEEDS_CONFIRMATION`: Validation message hiện có cả tiếng Anh kỹ thuật và tiếng Việt ở service. Nếu frontend cần hiển thị trực tiếp, nên chuẩn hóa message key/i18n thay vì hardcode message rải rác.
- `NEEDS_CONFIRMATION`: Worktree có nhiều thay đổi backend/entity/config đã tồn tại ngoài phạm vi audit này. Lượt refactor này không revert hoặc normalize các thay đổi đó.

## 7. Test đã chạy

- Baseline trước refactor: `.\mvnw.cmd -q -DskipTests compile` - pass.
- Sau refactor: `.\mvnw.cmd -q -DskipTests compile` - pass.
- Targeted regression:
  - `ContactPublicFormTest`
  - `AdminContactInboxApiTest`
  - `AdminCouponGiftApiTest`
  - `Phase1JAdminSettingsMenuCouponApiTest`
  - `Phase1FCheckoutApiTest`
  - `Phase1GOrderReadApiTest`
  - `Phase1LReturnsApiTest`
  - `Phase1MPosApiTest`
  - `WarrantyApiTest`
  - `CustomerWishlistApiTest`
  - `PublicReviewApiTest`
  - `AdminMediaP0Test`
  - `Phase1KInventorySerialApiTest`
  - `Phase1KInventoryP0FixApiTest`
  - Kết quả: pass.
- Full backend suite: `.\mvnw.cmd -q test`
  - Test suites: 75
  - Tests: 1176
  - Failures: 0
  - Errors: 0
  - Skipped: 1

## 8. Khuyến nghị tiếp theo

1. Bổ sung docs cho format phone/email/name/message nếu frontend muốn hiển thị validation message ổn định.
2. Ưu tiên tạo MapStruct mapper theo module nhỏ có response shape đã ổn định: media folder/list, redirect, settings nếu mapping bắt đầu lặp.
3. Không MapStruct hóa catalog/order/POS cho đến khi có test snapshot response mạnh hơn và field derived/private được khóa trong API contract.
4. Thêm unit test riêng cho `ValidationErrorMapper` để khóa format error của `HandlerMethodValidationException`.
5. Tách rõ permission-first endpoints trong API contract để các lần thêm Bean Validation không vô tình đổi `403` thành `400`.
