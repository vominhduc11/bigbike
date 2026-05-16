# BigBike — Full E2E Workflow Audit

> **Ngày audit:** 2026-05-16
> **Phạm vi:** Toàn bộ workflow end-to-end của hệ thống BigBike — `bigbike-web`, `bigbike-admin`, `bigbike-backend`, database/Flyway migrations, `bigbike_mobile`.
> **Phương pháp:** Đọc docs canonical → trace source code thật (UI → API client → controller → service → repository/entity → migration → side effect → test). Đối chiếu code với 8 docs canonical.
> **Mode:** AUDIT + TRACE + REPORT. Không sửa code hàng loạt — phase này chỉ báo cáo.
> **Reviewer:** Claude (Opus 4.7), audit-only.

---

## 1. Executive Summary

BigBike là nền tảng TMĐT + bán tại quầy cho đồ bảo hộ mô tô. Hệ thống có **~50 backend controller, 252 Flyway migration**, 4 surface (web/admin/backend/mobile). Audit này trace **37 workflow** end-to-end.

**Tình trạng tổng thể:** Phần lõi thương mại (catalog → cart → checkout → order → admin xử lý → return/refund → POS → serial → công nợ) **đã vững và đã qua audit chuyên sâu riêng** — 3 audit trước (`BIGBIKE_ORDER_E2E_WORKFLOW_AUDIT.md`, `POS_IN_STORE_WORKFLOW_RECHECK_AUDIT.md`, `BIGBIKE_SERIAL_MODULE_PRODUCTION_READY_AUDIT.md`) đã tìm và **đã fix** toàn bộ blocker P0/P1 của các luồng đó. Audit này **verify lại = các fix đã áp dụng đúng**.

Audit này tìm thấy **14 finding mới** (chủ yếu ở các workflow chưa được audit trước đây) + **3 docs mismatch**. **Không có finding nào gây mất tiền, bán âm kho, hay lỗ hổng bảo mật nghiêm trọng.** Hai finding P1 — **cả hai đã được fix (2026-05-16):**

- **FULL-01 (P1) — ✅ Fixed:** `PermissionCatalog.java` thiếu 3 permission đã được migration seed thật (`pos.refund`, `inventory.read`, `inventory.write`) → các quyền này **không gán được cho custom role** qua Roles UI. Đã thêm 3 key vào catalog.
- **FULL-02 (P1) — ✅ Fixed:** App mobile **thiếu màn xác nhận email** — backend endpoint đã có nhưng không có UI Flutter. Đã thêm màn `VerifyEmailScreen` + route + điều hướng sau đăng ký.

**Verdict:** Xem [Section 13](#13-kết-luận). Hệ thống **READY WITH CONDITIONS** — không có blocker chặn launch; 2 finding P1 đã xử lý xong, còn lại P2/P3 + bộ test còn thiếu nên hoàn thiện trước/ngay sau launch.

---

## 2. Phương pháp & Phạm vi

### Docs canonical đã đối chiếu
`WORKFLOW_OVERVIEW.md`, `BUSINESS_RULES.md`, `STATE_MACHINES.md`, `ACCEPTANCE_CRITERIA.md`, `BUSINESS_PROCESS.md`, `MODULE_CATALOG.md`, `PERMISSION_MATRIX.md`, `API_FLOW_MAP.md`.

### Audit trước đã được hợp nhất (không trace lại sâu)
| Audit | Ngày | Verdict | Trạng thái fix |
|---|---|---|---|
| `BIGBIKE_ORDER_E2E_WORKFLOW_AUDIT.md` | 2026-05-15 | Ready | 9/10 fix, ORDER-E2E-07 defer |
| `POS_IN_STORE_WORKFLOW_RECHECK_AUDIT.md` | 2026-05-15 | Ready w/ conditions | R-01→R-06 đã fix 2026-05-16 |
| `BIGBIKE_SERIAL_MODULE_PRODUCTION_READY_AUDIT.md` | 2026-05-14 | Conditionally ready | P0-1/P0-2/P0-3/P1-8 verify = đã fix |

### Verify fix của Serial audit (kiểm chứng bằng code trong audit này)
- **P0-1 (inspection wiring):** ✅ Đã fix — `AdminReturnService.java:206` gọi `serialLifecycleService.moveReturnedToInspection(...)`; `:288` gọi `markInspectionResult(...)`.
- **P0-2 (import payload limit):** ✅ Đã fix — `SerialImportRequest.java:10` có `@Size(min=1, max=5000)`.
- **P0-3 (inventory permission):** ✅ Đã fix — `V109__add_inventory_serial_permissions.sql` seed `inventory.read/write` cho ADMIN + SHOP_MANAGER.
- **P1-8 (seed reservation TTL):** ✅ Đã fix — V109 seed `reservation_ttl_minutes=15`.
- **P0-4 / P0-5 / P1-1 / P1-3:** ✅ đã verify (2026-05-16) — tất cả đã fixed. Xem [FULL-15](#full-15-p2--serial-audit-p0-4p0-5p1-1p1-3--đã-verify-tất-cả-fixed-2026-05-16).

---

## 3. Bảng tổng hợp Workflow

> Cột **Status**: `CONFIRMED_E2E` = trace đủ UI→API→BE→DB; `PARTIAL` = thiếu một mảnh; `SCHEMA_ONLY` = chỉ có DB; `NEEDS_BIZ` = cần xác nhận nghiệp vụ.

| # | Workflow | Actor | Surface | Entry point | Backend path | DB/Entity | State machine | Side effects | Test | Status | Finding |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Catalog browse (product/category/brand) | Guest/Customer | web, mobile, BE | catalog pages / `api_endpoints.dart` | `CatalogController`→`CatalogReadService` | V1 catalog | Product publishStatus, Category/Brand visible | — | `PublicReadApiTest` | CONFIRMED_E2E | FULL-08 |
| 2 | Search + suggest | Guest/Customer | web, mobile, BE | search box | `PublicSearchController`→`GlobalSearchService` | V1 | — | — | — | CONFIRMED_E2E | — |
| 3 | Content/blog (article/page) | Guest/Customer | web, BE | `/tin-tuc`, `/chinh-sach` | `ContentController`→`ContentReadService` | V1, V21, V93 | publishStatus | — | `ContentPublicApiTest` | CONFIRMED_E2E | — |
| 4 | Product reviews | Customer/Admin | web, admin, BE | `ReviewsSection` / admin reviews | `PublicReviewController`,`AdminReviewController` | V14, V60 | review status | revalidate web | `Phase1NReviewsApiTest`, `PublicReviewApiTest` (9 cases) | CONFIRMED_E2E | FULL-04 |
| 5 | Cart + coupon apply | Guest/Customer | web, mobile, BE | `/gio-hang` | `CartController`→`CartService` | carts/cart_items, V73 | coupon | CSRF guard | `Phase1ECartApiTest` | CONFIRMED_E2E | (ORDER-E2E-07 defer) |
| 6 | Checkout + quick-buy | Guest/Customer | web, mobile, BE | `/thanh-toan` | `CheckoutController`→`CheckoutService` | V7, V62 | Order/Payment/Fulfillment | stock−, email, WS, coupon redeem | `Phase1FCheckoutApiTest` | CONFIRMED_E2E | (audit Order — fixed) |
| 7 | Customer wishlist | Customer | web, mobile, BE | `/tai-khoan/yeu-thich` | `CustomerWishlistController` | V5 wishlist_items | — | — | `CustomerWishlistApiTest` (11 cases) | PARTIAL (mobile UI thiếu) | FULL-05, ~~FULL-07~~ (fixed), FULL-09 |
| 8 | VN address lookup | Guest/Customer | web, mobile, BE | address form | `VnAddressController` | VN address tables | — | — | — | CONFIRMED_E2E | — |
| 9 | Customer auth (register/verify/login/reset/refresh) | Customer | web, mobile, BE | auth pages | `CustomerAuthController` | V9 | email verified | verify email, guest order link | `Phase1DCustomerAuthTest`,`Phase1I1...` | CONFIRMED_E2E | FULL-02 (đã fix) |
| 10 | Customer profile + addresses CRUD | Customer | web, mobile, BE | `/tai-khoan` | `CustomerController`,`CustomerAddressController` | customers, addresses | — | — | `CustomerAddressApiTest` (10 cases) | CONFIRMED_E2E | FULL-12 |
| 11 | Customer order list/detail + guest lookup | Customer/Guest | web, mobile, BE | `/tai-khoan/don-hang`, lookup | `CustomerOrderController`,`OrderLookupController` | V7 | Order | — | `Phase1GOrderReadApiTest`,`GuestOrderLinkingTest` | CONFIRMED_E2E | FULL-10 |
| 12 | Customer tự huỷ đơn | Customer | web, BE | order detail | `CustomerOrderCancelService` | V7 | Order | restore stock | `Phase1H...` | CONFIRMED_E2E | (ORDER-E2E-01 fixed) |
| 13 | Customer return + eligibility | Customer | web, mobile, BE | order detail | `CustomerOrderController`→`CustomerReturnService` | returns, V65, V104 | Return | — | `Phase1LReturnsApiTest` | CONFIRMED_E2E | — |
| 14 | Public warranty lookup | Guest | web, BE | warranty page | `PublicWarrantyController` | V90 warranties | warranty status | — | `WarrantyApiTest` (6 cases) | CONFIRMED_E2E | FULL-10, FULL-12 batch 3 |
| 15 | Admin order management (status/payment/fulfillment/refund) | Admin | admin, BE | `OrderDetailScreen` | `AdminOrderController`→`AdminOrderService`,`RefundService` | V7, V8, V114, V116 | Order/Payment/Fulfillment | audit, email, WS, stock, serial, refund ledger | `Phase1HAdminOrderApiTest` | CONFIRMED_E2E | (audit Order — fixed) |
| 16 | Admin return processing + inspection | Admin | admin, BE | returns screen | `AdminReturnController`→`AdminReturnService` | V65, V104 | Return | stock restore, serial inspect, refund, notify | `Phase1LReturnsApiTest` | CONFIRMED_E2E | — |
| 17 | POS sale (CASH/CARD/CREDIT) | Admin/Manager | admin, BE | `PosScreen` | `AdminPosController`→`PosOrderService` | V71, V75, V114 | Order/Payment | stock−, payment, audit, WS, receivable | `Phase1MPosApiTest` | CONFIRMED_E2E | (audit POS — fixed) |
| 18 | POS refund | Admin | admin, BE | `RefundDialog` | `AdminPosController`→`RefundService` | refund_transactions | Order/Payment | serial restore, warranty void, receivable write-off | `Phase1MPosApiTest` | CONFIRMED_E2E | (audit POS — fixed) |
| 19 | Inventory management + manual adjustment | Admin | admin, BE | `InventoryScreen` | `AdminInventoryController`→`AdminInventoryService` | stock_movements, V57 | stockState (derived) | stock movement, recompute | `Phase1KInventory*Test` | CONFIRMED_E2E | FULL-15 |
| 20 | Serial management + lifecycle | Admin | admin, BE | `SerialListScreen`,`InventoryScreen` | `AdminInventoryController`→`AdminSerialService`,`SerialLifecycleService` | V51,V89,V90,V99 | ProductSerial 7-state | warranty create, audit | `Phase2FSerialInventoryTest`,`Phase1K...` | CONFIRMED_E2E | FULL-15 |
| 21 | Stock receiving (nhập kho theo phiếu) | Admin | — | — | — (không có service/controller) | V52,V53,V55 | — | — | — | **SCHEMA_ONLY** | FULL-13 |
| 22 | Warranty admin (void) | Admin | admin, BE | warranty screen | `AdminWarrantyController` | V90 | warranty status | audit | (qua serial test) | CONFIRMED_E2E | FULL-01 |
| 23 | Admin catalog management (product/category/brand) | Admin/Editor | admin, BE | catalog screens | `AdminCatalogController`→`AdminCatalogMutationService` | V1 | publishStatus, visible | revalidate web, audit | `AdminMutationApiTest` | CONFIRMED_E2E | — |
| 24 | Media library + folders | Admin/Editor | admin, BE | media screen | `AdminMediaController`,`AdminMediaFolderController` | V85 | Media ACTIVE/INACTIVE/DELETED | MinIO, audit | `AdminMediaP0Test` | CONFIRMED_E2E | FULL-11 |
| 25 | Content management (article/page) | Admin/Editor/Author | admin, BE | content screens | `AdminContentController`→`AdminContentMutationService` | V1,V21 | publishStatus | revalidate web, audit | `AdminContentApiTest`,`ContentP1ApiTest` | CONFIRMED_E2E | — |
| 26 | Settings / menus / sliders / home videos | Admin/Editor | admin, BE | CMS screens | `AdminSettings/Menu/Slider/HomeVideoController` | V84,V92,etc | — | revalidate, audit | `Phase1JAdmin...`,`SliderApiTest`,`HomeVideoApiTest` | CONFIRMED_E2E | — |
| 27 | Coupon lifecycle + expiry | Admin/Manager | admin, BE | `CouponListScreen` | `AdminCouponController`,`CouponExpiryScheduler` | V73,V118,V119 | coupon status | audit | `Phase1JAdmin...` | CONFIRMED_E2E | FULL-06 (stale), FULL-14 |
| 28 | Coupon gift (single/bulk) | Admin | admin, BE | customer/coupon screens | `AdminCouponGiftController`,`AdminCustomerController` | coupons (customer_id) | — | email (async) | `AdminCouponGiftApiTest` (7 cases) | CONFIRMED_E2E | FULL-12 batch 3 |
| 29 | Admin customer management + credit profile | Admin/Manager | admin, BE | customer screens | `AdminCustomerController` | customers, V75 | credit status | audit | `Phase1IAdmin...` | CONFIRMED_E2E | — |
| 30 | Accounts receivable (payment/write-off/aging) | Admin/Manager | admin, BE | receivables screens | `AdminReceivableController`→`ReceivableService` | V75,V83 | AR status | audit, payment record | `AdminReceivableApiTest` | CONFIRMED_E2E | (audit POS R-01 — fixed) |
| 31 | Reports & analytics + CSV export | Admin/Manager | admin, BE | reports screen | `AdminReportController`→`AdminReportService` | — (read-only) | — | audit on export | `AdminReportApiTest`,`...CsvHardeningTest` | CONFIRMED_E2E | — |
| 32 | Admin dashboard | Admin/Manager | admin, BE | dashboard | `AdminDashboardController` | — | — | — | `AdminDashboardApiTest` | CONFIRMED_E2E | FULL-14 |
| 33 | Audit logs | Admin | admin, BE | audit screen | `AdminAuditLogController` | audit_logs | — | — | `AdminAuditLogApiTest` | CONFIRMED_E2E | — |
| 34 | Admin users / roles / permissions | Admin/Super Admin | admin, BE | users/roles screens | `AdminAdminUsers/Roles/PermissionsController` | role_permissions, V49,V109,V112 | AdminUser status, role guards | audit | `AdminUsersApiTest`,`AdminRolesApiTest` | CONFIRMED_E2E | FULL-01 |
| 35 | Redirects (admin + internal) | Admin/SEO | admin, BE | redirect screen | `AdminRedirectController`,`InternalRedirectController` | redirects | — | hit counter | `AdminRedirectApiTest` | CONFIRMED_E2E | — |
| 36 | Admin notifications + WebSocket order feed | Admin | admin, BE | `NotificationBell` | `AdminNotificationController`,`AdminOrderWsService` | notifications table | read/unread | WS push | `RbacUrlGate...` | CONFIRMED_E2E | FULL-03(doc), FULL-16 |
| 37 | Contact form + admin inbox | Guest/Admin | web, mobile, admin, BE | `/lien-he` / admin inbox | `ContactController`,`AdminContactController` | V105 contact_messages | OPEN→IN_PROGRESS→RESOLVED/CLOSED | email best-effort, audit log | `AdminContactApiTest` (3), `AdminContactInboxApiTest` (8), `ContactPublicFormTest` (6) | CONFIRMED_E2E | FULL-03 (đã fix), FULL-12 batch 2 |

---

## 4. Findings — chi tiết

> Mã `FULL-xx`. `ORDER-E2E-xx`, `R-xx`, `P0-x` là finding của 3 audit trước (đã fix, không lặp lại đây).

### FULL-01 (P1) — `PermissionCatalog` thiếu `pos.refund`, `inventory.read`, `inventory.write`

- **Type:** bug
- **Evidence:** `service/auth/PermissionCatalog.java` (GROUPS — `roles.groupSales` không có `pos.refund`; không có group nào chứa `inventory.read`/`inventory.write`). Trong khi `V112__add_pos_refund_permission.sql` seed `pos.refund` và `V109__add_inventory_serial_permissions.sql` seed `inventory.read/write` vào `role_permissions`. `AdminWarrantyController.java:36,48,57` yêu cầu `inventory.read/write`; `AdminPosController` yêu cầu `pos.refund`.
- **Impact:** `PermissionCatalog.ALL_KEYS` là tập key hợp lệ dùng để **validate khi admin gán quyền cho custom role**. Vì 3 quyền này không có trong catalog: (1) màn Roles UI (`GET /api/v1/admin/permissions`) không hiển thị chúng; (2) admin **không thể gán** `pos.refund`/`inventory.read`/`inventory.write` cho bất kỳ custom role nào — gán sẽ bị reject là key không hợp lệ. Hệ quả: 3 quyền này chỉ tồn tại nhờ migration hard-seed cho ADMIN/SHOP_MANAGER; không role mới nào nhận được, kể cả khi shop muốn tạo role "thủ kho" chỉ có `inventory.*`.
- **Recommended fix:** Thêm `Entry("pos.refund", true)` vào group `roles.groupSales`; thêm `inventory.read`/`inventory.write` vào group `roles.groupProducts` (group này đã có nhãn i18n "Sản phẩm & Kho" / "Products & Inventory" — không cần group/i18n key mới).
- **Fix status:** **Fixed (2026-05-16).** `PermissionCatalog.java` — thêm `pos.refund` (sensitive=true) vào `roles.groupSales`, thêm `inventory.read`/`inventory.write` (sensitive=false) vào `roles.groupProducts`. Vì `ALL_KEYS` được derive từ `GROUPS`, cả validate (`AdminRoleService.validatePermissionKeys`) lẫn endpoint `GET /api/v1/admin/permissions` tự động nhận 3 key này → custom role gán được, Roles UI hiển thị được. Reference class `AdminRolePermissions.java` cũng được cập nhật cho khớp (ADMIN +`pos.refund`/`inventory.*`; SHOP_MANAGER +`inventory.*`). Test mới trong `AdminRolesApiTest`: `listPermissions_includesPosRefundAndInventoryKeys`, `createRole_withPosRefundAndInventoryPermissions_returns201`. Không tự thêm permission mới ngoài 3 key; không đổi business rule/contract.

### FULL-02 (P1) — App mobile thiếu màn xác nhận email

- **Type:** gap
- **Evidence:** Backend `CustomerAuthController.java` có `POST /api/v1/customer/auth/verify-email`; `bigbike_mobile/lib/core/api/api_endpoints.dart` đã khai báo hằng số `verifyEmail`; nhưng **không có màn Flutter nào gọi** — `register_screen.dart` không điều hướng tới màn verify. Web có đủ (`bigbike-web/app/xac-nhan-email/page.tsx`). `MODULE_CATALOG.md` đã ghi nhận "Verify-email wrapper missing — `CODE_ONLY_NOT_DOCUMENTED`".
- **Impact:** Khách đăng ký bằng app mobile không xác nhận được email trong app. Liên kết đơn guest theo email (`EmailVerificationService` guest order linking) không chạy được trên mobile. Khách phải mở web để verify.
- **Recommended fix:** Thêm màn verify-email trong Flutter gọi `ApiEndpoints.verifyEmail`, theo UX của web. Là gap UI mobile, không đổi contract.
- **Fix status:** ✅ **Fixed (2026-05-16).** Thêm màn `VerifyEmailScreen` (`bigbike_mobile/lib/features/auth/verify_email_screen.dart`) + route `/xac-nhan-email`. Sau khi đăng ký, app điều hướng tới màn này (mirror web flow). Màn có 4 trạng thái: (1) **info** — báo "đã gửi email xác minh tới {email}", nút **Gửi lại** gọi `POST /api/v1/customer/auth/resend-verification`, nút "Để sau"; (2) **verifying** — khi mở route kèm `?token=` (parity với web, sẵn sàng cho deep-link), tự gọi `POST /verify-email?token=`; (3) **success**; (4) **error** — hiện lỗi backend + nút gửi lại. Không đổi backend API contract; chỉ thêm hằng số `resendVerification` và tham số `queryParams` cho `ApiClient.post`. Files: `verify_email_screen.dart` (mới), `app_router.dart`, `register_screen.dart`, `api_endpoints.dart`, `api_client.dart`.
  - **Lưu ý còn lại (không phải gap workflow):** link xác minh trong email trỏ về web (`BIGBIKE_MAIL_VERIFY_BASE_URL`). Khách mobile bấm link sẽ mở web để verify, hoặc dùng nút "Gửi lại" + verify qua web. Để link mở thẳng app cần cấu hình **deep link** — là enhancement hạ tầng riêng, ngoài phạm vi FULL-02. Màn đã sẵn sàng nhận `token` nếu deep-link được thêm sau.

### FULL-03 (P2) — Cập nhật contact inbox không ghi audit log — **Fixed (2026-05-16)**

- **Type:** gap (đã verify = đúng, đã fix)
- **Evidence (ban đầu):** `AdminContactService.update()` không inject/gọi service audit nào. Mọi mutation admin khác (settings, media, coupon, order, customer…) đều ghi `audit_logs`. PATCH `/contact-messages/{id}` gác `contact.write` đúng nhưng đổi status/assignee/note không để lại vết.
- **Impact:** Không truy được ai resolve/đóng/gán một liên hệ khách hàng và lúc nào — rủi ro compliance cho xử lý khiếu nại B2C.
- **Fix status:** ✅ **Fixed (2026-05-16).**
  - `AdminContactService` inject `AuditLogJpaRepository`; `update()` nhận thêm tham số `adminId` và sau khi lưu thay đổi (`if (changed)`) ghi 1 `AuditLogEntity`: `actorType=ADMIN`, `actorId`, `action=CONTACT_MESSAGE_UPDATED`, `resourceType=CONTACT_MESSAGE`, `resourceId`, `beforeData`/`afterData`, `createdAt`. Theo đúng convention `buildAudit` của `AdminCouponService`/`AdminSerialService`.
  - `AdminContactController.update()` thêm `resolveAdminId()` (mirror `AdminCouponController`) để lấy actor id; **không đổi API contract** (signature endpoint, request/response giữ nguyên).
  - **Privacy:** `beforeData`/`afterData` chỉ ghi `status`, `assignedAdminId` và cờ `adminNoteChanged` (true/false). **Không** ghi nội dung message khách, email, phone, hay nội dung note — đúng ràng buộc privacy.
  - **Test seed drift phát hiện kèm theo:** `src/test/resources/db/test-seed.sql` (test DB tắt Flyway) thiếu `contact.read`/`contact.write` cho ADMIN + SHOP_MANAGER — do seed cũ hơn migration `V105`. Đã bổ sung 4 dòng INSERT vào seed cho khớp V105 (production không đổi — V105 đã grant sẵn). Ghi chú: seed cũng thiếu `inventory.read`/`inventory.write` (V109) — **không sửa ở task này** (ngoài phạm vi FULL-03), xem [DOC-04](#doc-04--test-seed-thiếu-vài-permission-so-với-migration).
  - Files: `AdminContactService.java`, `AdminContactController.java`, `test-seed.sql`, `AdminContactApiTest.java` (mới).
- **Test:** `AdminContactApiTest` (mới) 3/3 PASS — 401 không token, 403 EDITOR thiếu `contact.write`, 200 + ghi audit log đúng (`CONTACT_MESSAGE_UPDATED`, before `status=OPEN` / after `status=IN_PROGRESS` + `adminNoteChanged=true`, và xác nhận message body khách KHÔNG lọt vào audit). `AdminAuditLogApiTest` 11/11 PASS (không hồi quy).

### FULL-04 (P2) — Review được duyệt không thông báo cho người viết — NEEDS_CONFIRMATION

- **Type:** business decision
- **Evidence:** `AdminReviewService.updateStatus()` — khi đổi review sang `APPROVED` có gọi revalidate web (trang sản phẩm cập nhật) nhưng **không gửi thông báo** cho customer đã viết review.
- **Impact:** Khách không biết review của mình đã được đăng. Ảnh hưởng nhẹ tới UX/engagement, không ảnh hưởng dữ liệu/tiền.
- **Recommended fix:** Quyết định nghiệp vụ — (a) gửi email "review của bạn đã được đăng", hoặc (b) chấp nhận im lặng (đa số shop nhỏ chọn b). `NEEDS_BUSINESS_CONFIRMATION`.
- **Fix status:** Not fixed — cần xác nhận.

### FULL-05 (P2) — Wishlist không có trên app mobile — NEEDS_CONFIRMATION

- **Type:** business decision / gap
- **Evidence:** Backend `CustomerWishlistController` đầy đủ (add/remove/list, đã auth). `bigbike_mobile` không có endpoint/UI wishlist (chỉ có search). Web có đủ.
- **Impact:** App mobile thiếu tính năng "yêu thích". Không lỗi dữ liệu — chỉ là feature parity gap giữa web và mobile.
- **Recommended fix:** Xác nhận mobile có cần wishlist không. Nếu có → thêm UI Flutter + wrapper API.
- **Fix status:** Not fixed — cần xác nhận.

### FULL-06 (P2) — `updateCoupon` re-validate khoảng ngày — **STALE FINDING (đã verify 2026-05-16)**

- **Type:** validation gap (đã bác bỏ sau khi verify code)
- **Kết luận:** ✅ **Stale finding / code đã đúng sẵn.** Trace trực tiếp `AdminCouponService.java`:
  - `createCoupon` (line 104) gọi `validateDates(req.startsAt(), req.expiresAt())`.
  - `updateCoupon` (lines 200-207) merge patch vào entity **trước** (`if (req.startsAt()!=null) entity.setStartsAt(...)`, tương tự `expiresAt`), **rồi** gọi `validateDates(entity.getStartsAt(), entity.getExpiresAt())` trên giá trị đã merge. Vì validate trên state đã merge của entity (không phải chỉ trên request), trường hợp chỉ patch một field (chỉ `startsAt` hoặc chỉ `expiresAt`) vẫn được bắt đúng.
  - `validateDates` (line 308): `if (startsAt != null && expiresAt != null && !expiresAt.isAfter(startsAt)) throw`. Dùng `Instant` (mốc UTC tuyệt đối) → không có false positive/negative do timezone. `!isAfter` → cũng chặn `expiresAt == startsAt`.
- **Impact:** Không có — không thể PATCH coupon thành `expiresAt < startsAt`.
- **Fix status:** ✅ **Closed — không cần sửa code.** Phát hiện FULL-06 ban đầu (từ agent trace) là **sai**: `updateCoupon` đã re-validate. Đã bổ sung 4 test regression vào `Phase1JAdminSettingsMenuCouponApiTest` (create bad range → 400; update chỉ `expiresAt` về trước `startsAt` → 400; update chỉ `startsAt` về sau `expiresAt` → 400; update range hợp lệ → 200) — tất cả PASS, xác nhận hành vi đúng.
- **Follow-up (không bắt buộc):** Coupon dùng `Instant` (UTC) nên không có vấn đề timezone ở tầng so sánh ngày. Không phát hiện bug timezone — không có follow-up cần thiết.

### FULL-07 (P3) — Trang wishlist web tải toàn bộ sản phẩm rồi lọc client-side — **Fixed (2026-05-16)**

- **Type:** UX risk / scalability
- **Evidence:** `bigbike-web/app/tai-khoan/yeu-thich/page.tsx` fetch `productList(page=1, size=100)` rồi lọc theo tập ID. Không có endpoint trả thẳng sản phẩm wishlist phân trang.
- **Impact:** Khi catalog > ~1000 sản phẩm, wishlist hiển thị sai/thiếu (chỉ lọc trong 100 sản phẩm đầu) và tải nặng. Hiện catalog nhỏ nên rủi ro thấp.
- **Fix status:** ✅ **Fixed (2026-05-16).**
  - **Backend:** Thêm `GET /api/v1/customer/wishlist/products?page=&size=` vào `CustomerWishlistController`. Endpoint lấy danh sách product ID từ wishlist của customer (theo `addedAt desc`), tra cứu từng sản phẩm qua `CatalogReadService.getWishlistProducts()`, lọc chỉ PUBLISHED, trả `ApiListResponse<Product>` phân trang. Thêm method `getWishlistProducts(List<String>, int, int)` vào `CatalogReadService` (không đổi các method hiện có).
  - **Web:** `bigbike-web/app/tai-khoan/yeu-thich/page.tsx` — bỏ `fetchWishlist()` + `listProducts(size=100)` + client-side filter. Thay bằng `fetchWishlistProducts()` gọi trực tiếp endpoint mới (credentials included). Thêm `fetchWishlistProducts()` vào `bigbike-web/lib/api/client-api.ts`.
  - Endpoint `GET /api/v1/customer/wishlist` (trả `List<String>` ID) giữ nguyên — mobile vẫn dùng.
  - **Tests mới** (thêm vào `CustomerWishlistApiTest`): `getWishlistProducts_unauthenticated_returns401`; `getWishlistProducts_returnsWishlistedPublishedProducts` (seed product, add to wishlist → xuất hiện trong `/wishlist/products`); `getWishlistProducts_excludesDraftProducts` (draft product trong wishlist không xuất hiện). Cả 3 PASS.

### FULL-08 (P3) — Endpoint product snapshot từ chối ID dạng UUID — **Fixed (2026-05-16)**

- **Type:** bug (tiềm ẩn)
- **Evidence:** `CatalogController` — endpoint snapshot dùng `@Pattern(regexp = SLUG_REGEX)` chỉ chấp `^[a-z0-9]+(?:-[a-z0-9]+)*$`; service `getProductByIdOrSlug` xử lý được cả ID nhưng controller chặn trước. `AdminCatalogMutationService.generateId("prod")` → `prod_` + UUID-without-hyphens (e.g. `prod_a1b2c3...`) — underscore bị slug regex từ chối. Mobile dùng `ApiEndpoints.productSnapshot(id)` với product ID → 400 cho mọi sản phẩm tạo qua admin.
- **Impact:** Mọi sản phẩm được tạo qua admin UI có ID format `prod_xxx` đều không gọi được snapshot endpoint từ mobile (bị 400 trước khi vào service). Web dùng slug nên không ảnh hưởng.
- **Fix status:** ✅ **Fixed (2026-05-16).**
  - `CatalogController.java`: Thêm hằng số `ID_OR_SLUG_REGEX = "^[a-z0-9][a-z0-9_-]*$"` (cho phép underscore và hyphen làm separator). Đổi `@Pattern` trên snapshot path var từ `SLUG_REGEX` sang `ID_OR_SLUG_REGEX`. Endpoint `getProductBySlug` giữ nguyên `SLUG_REGEX` (chỉ chấp slug thuần, đúng cho SEO URL).
  - Không đổi endpoint path, không đổi response shape, không đổi service logic.
  - **Test mới** (thêm vào `PublicReadApiTest`): `publicProductSnapshot_byProductId_returns200` (tạo sản phẩm với ID `prod_test_xxx`, gọi snapshot → 200 + pricing/stock); `publicProductSnapshot_byProductId_unknownId_returns404` (ID `prod_unknown_id_xyz` → 404, không phải 400). Cả 2 PASS. Các test snapshot slug cũ vẫn PASS.

### FULL-09 (P3) — `CustomerWishlistController` DELETE thiếu tham số `HttpServletRequest`

- **Type:** code consistency
- **Evidence:** `CustomerWishlistController.java:81` — endpoint xoá không nhận `HttpServletRequest` như các endpoint khác.
- **Impact:** An toàn về chức năng (auth lấy từ SecurityContext). Chỉ là không nhất quán pattern, ảnh hưởng nếu sau này thêm audit/log theo request.
- **Recommended fix:** Thêm tham số cho nhất quán. Không gấp.
- **Fix status:** Not fixed — ghi nhận.

### FULL-10 (P3) — `PublicWarrantyController` trả `Map` thô thay vì DTO — **Fixed (2026-05-16)**

- **Type:** data contract
- **Evidence:** `PublicWarrantyController.lookup()` trả `Map<String,Object>` với 6 key: `serialNumber`, `productName`, `startDate`, `endDate`, `status`, `daysLeft`. Không có kiểu tường minh cho contract.
- **Impact:** Hợp đồng API khó bảo trì, client phải tự parse key. Không lỗi runtime.
- **Fix status:** ✅ **Fixed (2026-05-16).**
  - Tạo `WarrantyLookupResponse` record trong `api/public_/dto/`: `(String serialNumber, String productName, String startDate, String endDate, String status, long daysLeft)`. Field names giữ nguyên — backward-compatible với mọi client đang dùng.
  - `PublicWarrantyController`: đổi return type từ `ApiDataResponse<Map<String,Object>>` sang `ApiDataResponse<WarrantyLookupResponse>`, thay `Map.of(...)` bằng `new WarrantyLookupResponse(...)`. Xoá `import java.util.Map`.
  - Không đổi business logic, không đổi status code, không đổi JSON field names.
  - `WarrantyApiTest` (6/6 PASS) xác nhận JSON shape giữ nguyên sau refactor.

### FULL-11 (P3) — Hard-delete media yêu cầu quyền wildcard `*`, không có test

- **Type:** test coverage / design note
- **Evidence:** `AdminMediaController.java` — endpoint hard-delete gác `requirePermission(request, "*")` (chỉ SUPER_ADMIN). Các thao tác media khác gác `media.write`. Không có test verify.
- **Impact:** Thao tác không thể đảo ngược được gác đúng (chặt), nhưng quyền `*` là cách gác thiếu tường minh và không có test bảo vệ.
- **Recommended fix:** Cân nhắc permission tường minh (`media.hard_delete`) hoặc ít nhất thêm test. Không gấp.
- **Fix status:** Not fixed — ghi nhận.

### FULL-12 (P2) — Thiếu test cho nhiều workflow quan trọng — **Batch 1 Fixed (2026-05-16)**

- **Type:** test coverage
- **Evidence:** Không tìm thấy test file cho: wishlist (`CustomerWishlistController`), customer addresses CRUD, contact form + contact inbox (`ContactController`/`AdminContactController` — không có trong `Phase1J...`), coupon gift (`AdminCouponGiftController`), public review controller, warranty lookup/void.
- **Impact:** Các workflow này hoạt động đúng theo trace code nhưng không có lưới an toàn hồi quy. Đặc biệt permission `contact.read`/`contact.write` chưa được test (401/403/200).
- **Recommended fix:** Bổ sung test API — xem [Section 11](#11-danh-sách-test-còn-thiếu).
- **Fix status — Batch 1 (2026-05-16):** Đã bổ sung test cho wishlist và customer addresses:
  - `CustomerWishlistApiTest` (mới) — **8/8 PASS**: GET 401 no-session, POST 401 guest-session, add 201 + added=true, list chứa item đã add, duplicate idempotent (added=false), remove 204 + item gone, isolation A không thấy B, remove scoped (B's item survives A's delete).
  - `CustomerAddressApiTest` (mới) — **10/10 PASS**: GET 401 no-session, create 201 + data, list own addresses, list không chứa address của customer khác, update own 200, update other→404, delete own 204 + gone, delete other→404, missing fullName→400, invalid phone→400.
  - Không phát hiện bug trong batch này.
- **Fix status — Batch 2 (2026-05-16):** Đã bổ sung test cho public contact form và admin contact inbox:
  - `ContactPublicFormTest` (mới) — **6/6 PASS**: submit 201 + persisted OPEN, optional email persisted, no auth/cookie required, missing fullName→400, missing phone→400, missing content→400.
  - `AdminContactInboxApiTest` (mới) — **8/8 PASS**: list 401/403/200, filter by status (RESOLVED vs OPEN isolation), detail 200 (full content) + 403 editor, update→RESOLVED stamps resolvedAt, reopen→IN_PROGRESS clears resolvedAt.
  - `AdminContactApiTest` (FULL-03, 3/3 PASS, không hồi quy).
  - Không phát hiện bug trong batch này. Email skip đúng khi không cấu hình mail.
- **Fix status — Batch 3 (2026-05-16):** Đã bổ sung test cho coupon gift, public review, warranty:
  - `AdminCouponGiftApiTest` (mới) — **7/7 PASS**: single gift 201+detail, no-email→409, amount=0→400, PERCENT>100→400, editor→403, no-token→401, bulk 200+{sent,skipped}≥1.
  - `PublicReviewApiTest` (mới) — **9/9 PASS**: valid 201+success:true, honeypot stealth drop, missingAuthorName/ratingNull/ratingZero/ratingTooHigh/commentTooLong→400, duplicate 24h→409.
  - `WarrantyApiTest` (mới) — **6/6 PASS**: lookup 200+details, unknown serial→404, void 200+VOIDED, double-void→409, no-token→401, editor→403.
  - **Bug fix phát hiện kèm test:** `PublicWarrantyController.lookup()` gọi `serialEntity.getProduct().getName()` (lazy `@ManyToOne`) ngoài transaction → `LazyInitializationException` → 500. Đã thêm `@Transactional(readOnly = true)` vào method `lookup()`. Không đổi API contract/response.
  - Phase1NReviewsApiTest 57/57 PASS, tất cả regression PASS.
- **FULL-12 hoàn toàn đóng.** Tất cả workflow trong finding đã có test coverage đầy đủ.

### FULL-13 (P2) — Stock receiving (nhập kho theo phiếu) chỉ có schema, không có flow

- **Type:** gap (đã biết) / business decision
- **Evidence:** `V52/V53/V55` tạo bảng `stock_receipts`, `stock_receipt_lines`, `receipt_serials` nhưng không có service/controller/UI. `BUSINESS_PROCESS.md` & `MODULE_CATALOG.md` đã ghi `SCHEMA_ONLY`/`NOT_FOUND_IN_REPO`.
- **Impact:** Nhập kho hiện đi qua "manual adjustment" của Inventory module (`IN` movement) — vẫn dùng được. Workflow phiếu nhập chính thức (PO, đối chiếu nhà cung cấp) chưa có.
- **Recommended fix:** Quyết định nghiệp vụ — implement đầy đủ hay bỏ schema. `NEEDS_BUSINESS_CONFIRMATION`.
- **Fix status:** Not fixed — đã được docs ghi nhận.

### FULL-14 (P3) — Dashboard gác bằng `orders.read`; coupon scheduler phụ thuộc timezone DB

- **Type:** design note
- **Evidence:** `AdminDashboardController` gác `orders.read` (không có `dashboard.read` riêng). `CouponExpiryScheduler` dùng `Instant.now()` so với `expiresAt`.
- **Impact:** Role cần xem dashboard buộc phải có `orders.read`. Coupon expiry có thể lệch nếu DB không UTC. Cả hai rủi ro thấp.
- **Recommended fix:** Ghi chú thiết kế; đảm bảo DB chạy UTC. Không cần code.
- **Fix status:** Not fixed — ghi nhận.

### FULL-15 (P2) — Serial audit P0-4/P0-5/P1-1/P1-3 — **đã verify, tất cả Fixed (2026-05-16)**

- **Type:** gap (đã verify)
- **Kết quả verify từng mục (trace code thật):**

  | Mục | Kết luận | Bằng chứng |
  |---|---|---|
  | **P0-4** — `adjustStock` check duplicate sai bảng → 500 | ✅ **Already fixed** | `AdminInventoryService.java:292` (`adjustStock`) và `:393` (`adjustProductStock`) đều gọi `productSerialRepo.findExistingSerialNumbers(serials)` và throw `ValidationException.fromField("serialNumbers", "ALREADY_EXISTS", …)` → trả 400, không phải 500. Test `Phase1KInventorySerialApiTest.stockIn_serialAlreadyInDb_returns400` cover path `ALREADY_EXISTS`. |
  | **P0-5** — thiếu `DataIntegrityViolationException` handler → 500 | ✅ **Already fixed** | `GlobalExceptionHandler.java:73-80` có `@ExceptionHandler(DataIntegrityViolationException.class)` → trả `409 CONFLICT`, code `DATA_CONFLICT`, log mức `warn` (không lộ stacktrace). |
  | **P1-1** — state machine serial drift FE/BE | ✅ **Already fixed** | `bigbike-admin/src/lib/serialStateMachine.js` là module dùng chung (`SERIAL_STATUS_LABELS`, `SERIAL_STATUS_CLASSES`, `SERIAL_ALLOWED_TRANSITIONS`, `NOTE_REQUIRED_STATUSES`), được import bởi **cả** `InventoryScreen.jsx` và `SerialListScreen.jsx`. Transition FE khớp backend `AdminSerialService.validateTransition` (FE chỉ bỏ `RESERVED`/`SOLD` vì là transition do hệ thống/checkout điều khiển — có comment ghi rõ). |
  | **P1-3** — thiếu audit log enableTracking/import | ✅ **Fixed / Not applicable** | `importSerials`: `AdminSerialImportService.java:164` ghi audit `SERIALS_BULK_IMPORTED` (kèm requested count). `enableTracking`: **không còn endpoint toggle độc lập** — bật serial tracking là side effect ngầm trong `adjustStock`/`adjustProductStock`/`addToVariant`/`addToProduct` (`setTrackSerials(true)` khi serial lần đầu được thêm), và các operation này đều đã ghi audit (`INVENTORY_STOCK_ADJUSTED`, `INVENTORY_PRODUCT_STOCK_ADJUSTED`, `SERIALS_ADDED`). Không còn đường bật tracking không-audit. |

- **Impact:** Không còn — 4 mục đều đã được xử lý trong code hiện tại.
- **Fix status:** ✅ **Closed.** Không cần thay đổi code. Đã verify bằng trace code + chạy test (xem dưới). Lưu ý: Serial audit còn các mục khác **ngoài phạm vi FULL-15** (P0-2 import limit, P1-2 mã lỗi test, P1-4 permission split serial, P1-5/P1-6 perf, P1-7 FE note) — không verify trong mục này; P0-2 đã được verify fixed ở [Section 2](#2-phương-pháp--phạm-vi).
- **Test verify (2026-05-16):** `Phase1KInventoryP0FixApiTest` 15/15 PASS · `Phase1KInventorySerialApiTest` 8/8 PASS · `Phase2FSerialInventoryTest` 16/16 PASS.

### FULL-16 (P3) — `AdminOrderWsService` lưu notification kiểu best-effort, nuốt lỗi

- **Type:** error handling
- **Evidence:** `AdminOrderWsService.persistAndSend()` — catch mọi exception khi persist notification, vẫn push WS. Nếu persist DB fail, admin thấy toast nhưng notification không vào bảng.
- **Impact:** Mất notification thầm lặng khi DB lỗi (hiếm). Rủi ro thấp.
- **Recommended fix:** Cân nhắc log mức error + metric, hoặc chấp nhận best-effort có chủ đích (ghi chú rõ).
- **Fix status:** Not fixed — ghi nhận.

---

## 5. Docs Mismatch

### DOC-01 — `PERMISSION_MATRIX.md` chỉ sai source of truth của permission — **Fixed (2026-05-16)**
`PERMISSION_MATRIX.md` từng ghi "Admin role-to-permission mapping is defined in `AdminRolePermissions.java`". Nhưng class này **tự ghi rõ** "This class is NOT the runtime source of truth … retained as a human-readable reference. Do not call it". Runtime thật là bảng DB `role_permissions` + `AdminPermissionService`.
**Đã sửa:** Section "Role And Permission Source" của `PERMISSION_MATRIX.md` được viết lại — nêu rõ runtime source of truth là `role_permissions` + `AdminPermissionService`; `PermissionCatalog.java` là catalog key hợp lệ; `AdminRolePermissions.java` chỉ là reference snapshot. Bổ sung bảng `inventory.read`/`inventory.write`/`pos.refund` (role được seed + endpoint + evidence migration). Reference class `AdminRolePermissions.java` cũng được cập nhật cho khỏi stale.

### DOC-02 — Tham chiếu audit không tồn tại — **Fixed (2026-05-16)**
`ACCEPTANCE_CRITERIA.md` trỏ `docs/audits/BUSINESS_PROCESS_RULE_PRODUCTION_READINESS_AUDIT.md` (Section 7, 15-blocker) — **file không có** trong `docs/audits/`. `BUSINESS_PROCESS.md` trỏ `ORDER_PAYMENT_REFUND_WS_AUDIT.md` (ORD-007) — cũng không có.
**Đã sửa:** Gỡ tham chiếu đến cả hai file không tồn tại. `ACCEPTANCE_CRITERIA.md` giữ nguyên nội dung 15-blocker nhưng xoá dòng trỏ file; `BUSINESS_PROCESS.md` ORD-007 row xoá link file; `PROJECT_OVERVIEW.md` dòng trỏ file thay bằng link `ACCEPTANCE_CRITERIA.md`. Không tạo file audit giả.

### DOC-03 — Notification center đã được implement nhưng docs vẫn ghi `NOT_FOUND_IN_REPO` — **Fixed (2026-05-16)**
`BUSINESS_PROCESS.md`, `ACCEPTANCE_CRITERIA.md`, `STATE_MACHINES.md` §14 đều ghi notification center (read/unread, bảng `notifications`) là `NOT_FOUND_IN_REPO`. Trace code cho thấy đã có `AdminNotificationController` + bảng `notifications` được persist + endpoint mark-read + `NotificationBell`.
**Đã sửa:** Cập nhật 4 vị trí (`BUSINESS_PROCESS.md`, `ACCEPTANCE_CRITERIA.md`, `PROJECT_OVERVIEW.md`, `STATE_MACHINES.md` §14 + summary table + gaps table) từ `NOT_FOUND_IN_REPO` → `CONFIRMED_FROM_CODE`. §14 viết lại đầy đủ: state field `isRead`, evidence `V102__create_admin_notifications_table.sql` + `AdminNotificationController.java` + `AdminNotificationService.java`.

### DOC-04 — Test seed thiếu vài permission so với migration — **Fixed (2026-05-16)**
`src/test/resources/db/test-seed.sql` (test DB tắt Flyway — `spring.flyway.enabled=false`, Hibernate `create-drop` + seed thủ công) seed `role_permissions` cho ADMIN/SHOP_MANAGER nhưng **thiếu** các quyền được thêm bởi migration mới hơn: `contact.read`/`contact.write` (V105) và `inventory.read`/`inventory.write` (V109). Hệ quả: test dùng role ADMIN/SHOP_MANAGER không gọi được các endpoint contact/warranty. → `contact.*` đã được bổ sung vào seed trong fix FULL-03.
**Đã sửa:** Bổ sung `inventory.read` + `inventory.write` cho ADMIN và SHOP_MANAGER vào `test-seed.sql`. Seed nay đầy đủ V105 + V109.

---

## 6. Lỗi quan trọng — kết quả kiểm tra theo từng loại

| Loại lỗi cần soi | Kết quả |
|---|---|
| UI có nút nhưng backend không hỗ trợ | Không tìm thấy mới (ORDER-E2E-01 đã fix; R-03 POS đã fix). |
| Backend có API nhưng UI không dùng | Wishlist mobile (FULL-05), verify-email mobile (FULL-02). |
| Lệch data contract web/admin/mobile/BE | FULL-08 ✅ fixed (snapshot ID regex), FULL-10 ✅ fixed (warranty DTO), FULL-13 nhẹ. Không có lệch gây vỡ runtime. |
| Trạng thái hiển thị sai vs state machine | ORDER-E2E-06 (timeline ON_HOLD) — đã fix. Không thấy mới. |
| Workflow đứt giữa chừng | Serial inspection wiring (P0-1) — **đã fix**. Stock receiving (FULL-13) — schema-only. |
| Permission thiếu/sai | FULL-01 (catalog thiếu 3 key). Endpoint admin khác đều gác `requirePermission` đúng. |
| BE thiếu validation / chỉ validate FE | FULL-06 (coupon date) đã verify = **stale, code đúng sẵn**. Checkout/cart/order validate đủ ở BE. |
| Thiếu side effect (stock/serial/payment/refund/audit/notify/WS/receivable) | FULL-03 (contact không audit) — **đã fix**; FULL-04 (review không notify). Các side effect tiền/kho/serial đều đủ. |
| DB schema/migration không enforce rule | ORDER-E2E-08 (thiếu CHECK) — đã fix bằng V116. SKU không unique (BUSINESS_RULES ghi nhận có chủ đích). |
| Thiếu test cho workflow quan trọng | FULL-12 — wishlist ✅, address ✅ (batch 1); contact form + inbox ✅ (batch 2); coupon gift ✅, public review ✅, warranty ✅ (batch 3, 2026-05-16). Tất cả đã có test. |

---

## 7. Danh sách P0/P1 cần xử lý trước launch

| Mã | Severity | Vấn đề | Trạng thái |
|---|---|---|---|
| FULL-01 | P1 | `PermissionCatalog` thiếu `pos.refund`/`inventory.read`/`inventory.write` → không gán được cho custom role | ✅ **Fixed (2026-05-16)** — xem chi tiết FULL-01 |
| FULL-02 | P1 | Mobile thiếu màn xác nhận email | ✅ **Fixed (2026-05-16)** — xem chi tiết FULL-02 |

> **Không có P0.** Các P0 của 3 audit trước đều đã fix và verify. Cả 2 finding P1 (FULL-01, FULL-02) đã được fix 2026-05-16 → **không còn P0/P1 nào treo trước launch.**

---

## 8. Workflow đã CONFIRMED end-to-end

Catalog browse · Search+suggest · Content/blog · Reviews · Cart+coupon · Checkout+quick-buy · VN address · Customer order list/detail+guest lookup · Customer tự huỷ đơn · Customer return+inspection · Public warranty lookup · Admin order management · Admin return processing · POS sale CASH/CARD/CREDIT · POS refund · Inventory management · Serial management · Warranty admin · Admin catalog management · Media library+folders · Content management · Settings/menus/sliders/home-videos · Coupon lifecycle · Coupon gift · Admin customer+credit · Accounts receivable · Reports+CSV · Dashboard · Audit logs · Admin users/roles/permissions · Redirects · Notifications+WebSocket · Contact form+inbox.

→ **33/37 workflow** trace đủ UI→API→BE→DB và hoạt động đúng.

## 9. Workflow PARTIAL / SCHEMA_ONLY

| Workflow | Trạng thái | Lý do |
|---|---|---|
| Customer wishlist | PARTIAL | Backend + web đủ; **mobile thiếu UI** (FULL-05) |
| Stock receiving theo phiếu | SCHEMA_ONLY | Có bảng V52/V53/V55, không có service/controller/UI (FULL-13) |

> Customer auth trước ở PARTIAL vì mobile thiếu màn verify-email — **đã fix (FULL-02, 2026-05-16)**, nay là `CONFIRMED_E2E`.

> Không có workflow `BROKEN_FLOW` — luồng serial inspection từng đứt (Serial P0-1) đã được nối lại.

## 10. Workflow cần BUSINESS CONFIRMATION

| Mục | Câu hỏi nghiệp vụ | Hướng xử lý đề xuất |
|---|---|---|
| FULL-04 | Khi duyệt review có gửi thông báo cho người viết không? | (a) gửi email; (b) im lặng — đa số shop nhỏ chọn (b) |
| FULL-05 | Mobile có cần tính năng wishlist không? | (a) implement UI Flutter; (b) chấp nhận web-only |
| FULL-13 | Có cần workflow nhập kho theo phiếu (PO) không? | (a) implement trên schema sẵn có; (b) bỏ schema, dùng manual adjustment |
| Invoice / hoá đơn điện tử | Có tích hợp nhà cung cấp e-invoice không? | Theo `BUSINESS_PROCESS.md` — Nghị định 123/2020. NEEDS_BUSINESS_CONFIRMATION |
| Customer data export/delete | Có làm endpoint xuất/xoá dữ liệu cá nhân không? | Nghị định 13/2023 — NEEDS_BUSINESS_CONFIRMATION |
| Shipping carrier (GHN/GHTK) | Có tích hợp đơn vị vận chuyển không? | `fulfillmentStatus` có sẵn nhưng không có tracking entity |

## 11. Danh sách test còn thiếu nên bổ sung

| Workflow | Test đề xuất |
|---|---|
| Customer wishlist | ✅ **Đã có** (`CustomerWishlistApiTest` 8/8 PASS, 2026-05-16) — add/remove/list, idempotent, isolation, scoped delete. |
| Customer addresses | ✅ **Đã có** (`CustomerAddressApiTest` 10/10 PASS, 2026-05-16) — CRUD, ownership 404, validation. |
| Contact form + inbox | ✅ **Đã có** (`AdminContactApiTest` 3/3, `ContactPublicFormTest` 6/6, `AdminContactInboxApiTest` 8/8, 2026-05-16) — public submit, no-auth, validation 400, admin list 200/401/403, filter by status, detail 200/403, update status + resolvedAt stamp/clear. |
| Coupon gift | ✅ **Đã có** (`AdminCouponGiftApiTest` 7/7, 2026-05-16) — single gift 201 + detail, no-email → 409, amount=0 → 400, PERCENT>100 → 400, editor→403, no-token→401, bulk 200 + {sent, skipped}. |
| Public review | ✅ **Đã có** (`PublicReviewApiTest` 9/9, 2026-05-16) — valid 201, honeypot silently drops, missingAuthorName/ratingNull/ratingZero/ratingTooHigh/commentTooLong → 400, duplicate 24h → 409. |
| Warranty | ✅ **Đã có** (`WarrantyApiTest` 6/6, 2026-05-16) — lookup public 200 + details, unknown serial → 404, void 200 + VOIDED, double-void → 409, no-token → 401, editor → 403. |
| Permission catalog | sau fix FULL-01: gán `pos.refund`/`inventory.*` cho custom role thành công |
| Serial state machine | (Serial audit P1-9) wiring `moveReturnedToInspection` qua return RECEIVED→INSPECTING |
| Order/Payment/Return/Product state transition | `STATE_MACHINES.md` §18 — toàn bộ đang `MISSING_TEST_COVERAGE` |
| Write-off công nợ trên Postgres | (POS R-01) chạy Testcontainers, không H2 |

## 12. Điểm tốt đã xác nhận

- **Tiền & kho an toàn:** checkout pessimistic lock chống bán âm kho; backend tự tính toàn bộ tiền (không tin FE); idempotency chống đơn trùng; restore kho idempotent.
- **State machine enforce ở backend:** Order/Payment/Fulfillment/Return/Product/Media đều có map transition tường minh + guard; FE chỉ hide/disable.
- **RBAC DB-backed:** `AdminPermissionService` đọc `role_permissions` từ DB; migration là source of truth; mọi endpoint admin trace được đều gác `requirePermission`.
- **Audit log rộng:** mọi mutation admin trace được đều ghi before/after vào `audit_logs` (gồm cả contact inbox sau fix FULL-03).
- **WebSocket transaction-aware:** push `/topic/admin/orders` sau commit DB.
- **Refund hợp nhất:** mọi hoàn tiền (order/POS/return) đi qua `RefundService` — refund ledger + serial restore + warranty void + receivable write-off atomic.
- **3 audit chuyên sâu trước** (Order/POS/Serial) đã fix sạch blocker P0/P1.

## 13. Kết luận

**Hệ thống workflow BigBike: READY WITH CONDITIONS — chưa hoàn toàn production-ready nhưng không có blocker tuyệt đối.**

- **Luồng thương mại lõi** (catalog → cart → checkout → order → return/refund → POS → serial → công nợ): **production-ready** — đã qua 3 audit chuyên sâu, blocker P0/P1 đã fix và verify.
- **Các workflow phụ trợ** (CMS, coupon, customer admin, reports, dashboard, audit, redirect, contact, notification): **hoạt động đúng end-to-end**, chỉ còn finding P2/P3 không chặn launch.
- **2 finding P1** (FULL-01 permission catalog, FULL-02 mobile verify-email) — ✅ **cả hai đã được fix 2026-05-16**; không còn P1 treo.
- **Khoảng trống còn lại** chủ yếu là **quyết định nghiệp vụ** (invoice, shipping carrier, stock receiving, data export) và **test coverage** — không phải lỗi code.

**Khuyến nghị trước launch:**
1. ✅ **FULL-01 đã fix (2026-05-16)** — đã thêm 3 permission vào `PermissionCatalog`, cập nhật docs + test.
2. ✅ **FULL-02 đã fix (2026-05-16)** — thêm màn verify-email Flutter + route + điều hướng sau đăng ký. (Tuỳ chọn về sau: cấu hình deep link để email link mở thẳng app.)
3. ✅ **FULL-15 đã verify (2026-05-16)** — Serial P0-4/P0-5/P1-1/P1-3 đều đã fixed; test inventory/serial PASS.
4. ✅ **FULL-12 test coverage hoàn chỉnh (2026-05-16)** — Batch 1: `CustomerWishlistApiTest` (8/8) + `CustomerAddressApiTest` (10/10). Batch 2: `ContactPublicFormTest` (6/6) + `AdminContactInboxApiTest` (8/8). Batch 3: `AdminCouponGiftApiTest` (7/7) + `PublicReviewApiTest` (9/9) + `WarrantyApiTest` (6/6). Tổng 54 test mới, tất cả PASS. Bug fix kèm theo: `PublicWarrantyController.lookup()` thêm `@Transactional(readOnly = true)` — lazy load `product` gây 500 đã được fix.
5. Dọn 3 **docs mismatch** (DOC-01/02/03).
6. Chốt các mục **NEEDS_BUSINESS_CONFIRMATION** ở Section 10 với chủ shop.

**Tổng finding:** 16 mới (`FULL-01`→`FULL-16`) — P0: 0 · P1: 2 (cả hai đã fixed) · P2: 7 · P3: 7 — cộng 3 docs mismatch. Không có finding gây mất tiền / bán âm kho / lỗ hổng bảo mật.

---

## Phụ lục — Files & docs đã trace

**Docs canonical:** `WORKFLOW_OVERVIEW.md`, `BUSINESS_RULES.md`, `STATE_MACHINES.md`, `ACCEPTANCE_CRITERIA.md`, `BUSINESS_PROCESS.md`, `MODULE_CATALOG.md`, `PERMISSION_MATRIX.md`, `API_FLOW_MAP.md`.
**Audit trước:** `BIGBIKE_ORDER_E2E_WORKFLOW_AUDIT.md`, `POS_IN_STORE_WORKFLOW_RECHECK_AUDIT.md`, `BIGBIKE_SERIAL_MODULE_PRODUCTION_READY_AUDIT.md`.
**Backend:** ~50 controller (`api/admin`, `api/customer`, `api/public_`, `api/catalog`, `api/order`), `service/auth/PermissionCatalog.java`, `AdminRolePermissions.java`, `AdminReturnService.java`, `SerialLifecycleService.java`, `AdminContactService.java`, `AdminReviewService.java`, `AdminCouponService.java`, `AdminWarrantyController.java`, `PublicWarrantyController.java`, `CustomerWishlistController.java`, `CustomerAuthController.java`, `AdminOrderWsService.java`.
**Migration:** V1, V7, V8, V49, V52/53/55, V57, V73, V75, V84, V85, V89/90, V104, V105, V108, V109, V112, V114, V116, V118, V119.
**Web:** `app/tai-khoan/yeu-thich/page.tsx`, `app/xac-nhan-email/page.tsx`, catalog/content pages, `components/catalog/ReviewsSection.tsx`.
**Admin:** `PosScreen.jsx`, `InventoryScreen.jsx`, `SerialListScreen.jsx`, `CouponListScreen.jsx`, `OrderDetailScreen.jsx`, `App.jsx`.
**Mobile:** `bigbike_mobile/lib/core/api/api_endpoints.dart`, `register_screen.dart`.
**Test:** 60+ file test (`Phase1B`→`Phase2F`, `Admin*ApiTest`, …).
