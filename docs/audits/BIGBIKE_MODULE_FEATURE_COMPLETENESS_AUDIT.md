# BigBike — Module / Feature Completeness Audit

> **Ngày audit:** 2026-05-16
> **Phạm vi:** Kiểm tra từng module/feature độc lập có đầy đủ, nhất quán giữa web / admin / backend / database / mobile / docs / test hay không.
> **KHÔNG nằm trong phạm vi:** Workflow end-to-end (đã audit tại [BIGBIKE_FULL_E2E_WORKFLOW_AUDIT.md](BIGBIKE_FULL_E2E_WORKFLOW_AUDIT.md)).
> **Phương pháp:** Đối chiếu docs với source code thật — controllers, services, entities, Flyway migrations, admin screens (`App.jsx`), web routes, `api_endpoints.dart`, test suite.

---

## 0. Cách đọc báo cáo

- **Status** mỗi module: `COMPLETE` / `MOSTLY_COMPLETE` / `PARTIAL` / `UI_ONLY` / `BACKEND_ONLY` / `SCHEMA_ONLY` / `DOCS_ONLY` / `DEAD_FEATURE` / `DUPLICATED_FEATURE` / `NEEDS_BUSINESS_CONFIRMATION`.
- **Severity** finding: `P0` (chặn launch) / `P1` (phải xử lý trước launch) / `P2` (nên xử lý sớm) / `P3` (cosmetic / post-launch).
- **Fix status:** `NOT_FIXED` (chưa động vào — phần lớn là quyết định business hoặc cập nhật docs có chủ đích) / `FIXED`.
- Audit này **không sửa code hàng loạt**. Không có thay đổi business rule / API contract / data contract / permission / state machine.

---

## 1. Tổng quan inventory hệ thống

| Lớp | Đếm được | Nguồn |
|---|---|---|
| Backend controllers | 50 (`api/admin` 28, `api/public_` 9, còn lại auth/cart/checkout/customer/order/content) | `find *Controller.java` |
| Backend services | 88 | `find *Service.java` |
| Backend entities | 64 | `entity/` |
| Flyway migrations | V1 → V119 | `db/migration/` |
| Admin screens | 33 (`App.jsx` lazy imports) | `bigbike-admin/src/App.jsx` |
| Web routes | 33 page routes | `bigbike-web/app/**/page.tsx` |
| Mobile features | 13 feature folders | `bigbike_mobile/lib/features/` |
| Backend test classes | 78 | `src/test/.../*.java` |

---

## 2. Module-by-module audit

### MOD-01 — Catalog browse

- **Surfaces:** web, admin, backend, mobile, database, docs
- **Status:** `COMPLETE`
- **Features found:** Listing sản phẩm/danh mục/thương hiệu/bài viết/trang/menu/slider/home-video qua `CatalogController` + `ContentController` + `PublicMenuController/PublicSliderController/PublicHomeVideoController/PublicSettingsController`.
- **Alignment:** Web routes `/san-pham`, `/danh-muc-san-pham`, `/brands`, `/tin-tuc`; mobile `api_endpoints.dart` wrap đủ `products/categories/brands/articles`. `MODULE_CATALOG.md` đánh dấu `CONFIRMED_FROM_CODE`.
- **Findings:** Không có lệch.
- **Severity:** —  **Fix status:** N/A  **Business confirmation:** Không.

### MOD-02 — Product

- **Surfaces:** web, admin, backend, mobile, database, docs
- **Status:** `COMPLETE`
- **Features found:** CRUD admin (`AdminCatalogController` + `AdminCatalogMutationService/ReadService`), variant + variant option + variant gallery (color-scoped), specification, tag, video, gallery image, homepage block ordering (V95/V111), single-category lock (V110). Public detail/snapshot/reviews.
- **Alignment:** Entities `ProductEntity`, `ProductVariantEntity`, `ProductVariantOptionEntity`, `ProductVariantGalleryImageEntity`, `ProductSpecificationEntity`, `ProductTagEntity`, `ProductVideoEntity`, `ProductGalleryImageEntity`. Test: `VariantGalleryRoundtripTest`, `Phase2D*` importer tests.
- **Findings:** Field `chassisNumber` / `engineNumber` trong code đặt sai tên domain (BigBike bán đồ bảo hộ, không phải xe máy) — đã ghi nhận ở memory, không phải lỗi completeness.
- **Severity:** P3  **Fix status:** NOT_FIXED  **Business confirmation:** Không (đổi tên field = data contract, để task riêng).

### MOD-03 — Category

- **Surfaces:** web, admin, backend, mobile, database, docs
- **Status:** `COMPLETE`
- **Features found:** CRUD, parent_id (cây danh mục, index V86), single-category-per-product sau khi V110 drop `product_category_map`.
- **Findings:** Không có lệch. Form admin đã bỏ multi-category (audit product module 2026-05-14).
- **Severity:** —  **Fix status:** N/A  **Business confirmation:** Không.

### MOD-04 — Brand

- **Surfaces:** web, admin, backend, mobile, database, docs
- **Status:** `COMPLETE`
- **Features found:** CRUD, banner image (V91), trang `/brands` + `/brands/[slug]`, `PageHero` cho listing.
- **Findings:** Không có lệch.
- **Severity:** —  **Fix status:** N/A  **Business confirmation:** Không.

### MOD-05 — Search

- **Surfaces:** web, backend, mobile, docs
- **Status:** `COMPLETE`
- **Features found:** `GET /api/v1/search`, `GET /api/v1/search-suggest` (`PublicSearchController` + `GlobalSearchService`). Web `/tim-kiem`, mobile `search` feature.
- **Findings:** Không có admin surface (đúng thiết kế — search là public-only). Không có test riêng cho search controller — coverage gián tiếp qua `PublicReadApiTest`.
- **Severity:** P3  **Fix status:** NOT_FIXED  **Business confirmation:** Không.

### MOD-06 — Cart

- **Surfaces:** web, backend, mobile, database, docs
- **Status:** `COMPLETE`
- **Features found:** Guest/customer cart, CSRF-protected mutations, item image snapshot (V26), unique active cart per customer (V115), one-coupon-per-cart (V73). `CartController` + `CartService`.
- **Alignment:** Mobile wrap đủ `cart/items/clear/coupons`. Test `Phase1ECartApiTest`.
- **Findings:** Không có admin surface (đúng thiết kế).
- **Severity:** —  **Fix status:** N/A  **Business confirmation:** Không.

### MOD-07 — Checkout

- **Surfaces:** web, backend, mobile, database, docs
- **Status:** `COMPLETE`
- **Features found:** Cart checkout + quick-buy, idempotency keys (V62), shipping/payment validation, order lookup. `CheckoutController` + `CheckoutService`.
- **Alignment:** Mobile wrap `checkout/checkout-options/quick-buy/order-lookup`. Test `Phase1FCheckoutApiTest`, `Phase1K1ContractHardeningTest`.
- **Findings:** Không có lệch.
- **Severity:** —  **Fix status:** N/A  **Business confirmation:** Không.

### MOD-08 — Coupon (+ Coupon gift sub-feature)

- **Surfaces:** web, admin, backend, mobile, database, docs
- **Status:** `COMPLETE`
- **Features found:** CRUD + lifecycle (`AdminCouponController`), apply ở cart, channel restriction (V118), customer restriction (V119), cart/gender/shipping-threshold (V20). **Coupon gift bulk:** `AdminCouponGiftController` (`POST /api/v1/admin/coupon-gifts/bulk`) + `AdminCouponGiftService` + `CouponGiftEmailService`, gọi từ `CouponListScreen.jsx` (`sendBulkCouponGift`). Test `AdminCouponGiftApiTest`.
- **Alignment:** Coupon gift được docs hoá ở `BUSINESS_RULES.md` + `API_CONTRACT.md`. UI có (nút trong CouponListScreen). Mobile wrap cart coupon endpoints.
- **Findings:** Coupon gift **không liệt kê riêng trong `MODULE_CATALOG.md`** — chỉ ghi ở BUSINESS_RULES/API_CONTRACT. Docs mismatch nhẹ.
- **Severity:** P3  **Fix status:** NOT_FIXED  **Business confirmation:** Không.  **Recommended fix:** Thêm dòng "Coupon gift" vào MODULE_CATALOG.md.

### MOD-09 — Order

- **Surfaces:** web, admin, backend, mobile, database, docs
- **Status:** `COMPLETE`
- **Features found:** List/detail/status/payment/note (`AdminOrderController`), customer order read (`CustomerOrderController`), guest order linking (`GuestOrderLinkingService`, V64), auto-cancel (`OrderAutoCancelService`), stock restore (`OrderStockRestoreService`), status check constraints (V116), line item product PK (V74), POS staff + customer name (V71).
- **Alignment:** Web `/tai-khoan/don-hang`, mobile `myOrders`. Test `Phase1G/Phase1H`, `GuestOrderLinkingTest`.
- **Findings:** Workflow đã audit ở E2E audit — không lặp lại.
- **Severity:** —  **Fix status:** N/A  **Business confirmation:** Không.

### MOD-10 — Payment

- **Surfaces:** admin, backend, database, docs
- **Status:** `COMPLETE` (mô hình manual reconciliation)
- **Features found:** `PaymentEntity` + `PaymentEventEntity`, payment status simplified (V114). Admin đối soát chuyển khoản thủ công — **không tích hợp cổng thanh toán tự động** (SePay đã bị gỡ ở V59).
- **Alignment:** V59 đã drop `unmatched_payments` table + xoá `payment_sepay.*` settings + `pending_payment_expires_at` column → **không còn schema mồ côi SePay**. Sạch.
- **Findings:** Không có UI thanh toán online ở web/mobile — đúng thiết kế (xem memory `project_bigbike_no_auto_payment`). Không phải lỗi.
- **Severity:** —  **Fix status:** N/A  **Business confirmation:** Không.

### MOD-11 — Fulfillment / Shipping

- **Surfaces:** admin, backend, web (checkout), database, docs (một phần)
- **Status:** `MOSTLY_COMPLETE`
- **Features found:** `AdminShippingController` — CRUD shipping zone + shipping method (`/zones`, `/zones/{id}/methods`). Entities `ShippingZoneEntity`, `ShippingMethodEntity`. Fulfillment tracking fields (V100). Shipping check constraints (V68). Admin screen `ShippingScreen`. Test `AdminShippingApiTest`.
- **Findings:** Module **Shipping không được liệt kê trong `MODULE_CATALOG.md`** dù có controller + entity + admin screen + test đầy đủ. Code có feature, docs (MODULE_CATALOG) không ghi.
- **Severity:** P2  **Fix status:** NOT_FIXED  **Business confirmation:** Không.  **Recommended fix:** Thêm "Shipping admin" vào MODULE_CATALOG.md (Admin Platform Modules).

### MOD-12 — Return

- **Surfaces:** web, admin, backend, mobile, database, docs
- **Status:** `COMPLETE`
- **Features found:** Customer tạo return (`CustomerReturnService`), admin list/detail/status (`AdminReturnController`), item inspection (V104), return item serial (`ReturnItemSerialEntity`), return history, race guard + sequence (V39), check constraints (V66), active index fix (V65). Tables V31.
- **Alignment:** Web `/tai-khoan/doi-tra`, mobile `myReturns`/`createReturn`. Test `Phase1LReturnsApiTest`.
- **Findings:** Không có lệch.
- **Severity:** —  **Fix status:** N/A  **Business confirmation:** Không.

### MOD-13 — Refund

- **Surfaces:** admin, backend, database, docs
- **Status:** `MOSTLY_COMPLETE`
- **Features found:** `RefundTransactionEntity` (V101) + `RefundService`, refund fields trên order (V28). POS refund permission (V112) + `AdminPosController` refund endpoint.
- **Findings:** Refund là admin-side, không có customer UI — đúng thiết kế. Không có admin screen độc lập "Refunds" — refund được thao tác trong Order detail / POS. Không có test riêng cho `RefundService` (coverage gián tiếp qua POS/Returns test).
- **Severity:** P3  **Fix status:** NOT_FIXED  **Business confirmation:** Không.  **Recommended fix:** Thêm unit test cho `RefundService` (refund amount tính toán, idempotency).

### MOD-14 — Inventory

- **Surfaces:** admin, backend, database, docs
- **Status:** `COMPLETE`
- **Features found:** List/summary/movement/manual adjustment/CSV export (`AdminInventoryController` + `AdminInventoryService`). `StockMovementEntity` (`IN/OUT/ADJUSTMENT/RETURN`), inventory tracking (V30), integrity guards (V50), legacy inventory columns (V10), backfill stock state (V108), auto-enable serial tracking (V117), variant nullable relax (V82). Admin screen `InventoryScreen`. Test `Phase1KInventoryP0FixApiTest`.
- **Findings:** Không có web/mobile surface — đúng thiết kế (internal ops).
- **Severity:** —  **Fix status:** N/A  **Business confirmation:** Không.

### MOD-15 — Serial

- **Surfaces:** admin, backend, database, docs
- **Status:** `COMPLETE`
- **Features found:** `ProductSerialEntity`, `StockMovementSerialEntity` (V57), `OrderLineItemSerialEntity`, `ReturnItemSerialEntity`. Serial lifecycle (V89) + bridge tables (V90), rename identifier columns (V99). `AdminSerialService` + `AdminSerialImportService` + `SerialLifecycleService`. Admin screen `SerialListScreen`. Test `Phase1KInventorySerialApiTest`, `Phase2FSerialInventoryTest`.
- **Findings:** **Migration churn lịch sử:** V51 add serial tracking → V54 remove serial tracking → V57/V89/V90 re-add. Trạng thái cuối nhất quán nhưng chuỗi migration có "add/remove/re-add" — chỉ là noise lịch sử, không ảnh hưởng runtime. Đã có audit riêng `BIGBIKE_SERIAL_MODULE_PRODUCTION_READY_AUDIT.md`.
- **Severity:** P3 (informational)  **Fix status:** NOT_FIXED  **Business confirmation:** Không.

### MOD-16 — Warranty

- **Surfaces:** web, admin, backend, database, docs
- **Status:** `MOSTLY_COMPLETE`
- **Features found:** `PublicWarrantyController` (`GET /api/v1/warranties/lookup`), `AdminWarrantyController` (list + void, permission `inventory.read/write` V109), `WarrantyRecordEntity` (V90). Web `/bao-hanh`. Admin screen `WarrantyListScreen`. Test `WarrantyApiTest`.
- **Findings:** **Không có mobile surface** — `api_endpoints.dart` không có warranty endpoint, không có warranty screen trong `bigbike_mobile/lib/features/`. Web có lookup, mobile thiếu.
- **Severity:** P2  **Fix status:** NOT_FIXED  **Business confirmation:** Có — quyết định có đưa warranty lookup lên mobile trước launch hay không là product decision.

### MOD-17 — POS

- **Surfaces:** admin, backend, database, docs
- **Status:** `COMPLETE`
- **Features found:** Product search, immediate sale (CASH/CARD_TERMINAL), credit sale (CREDIT) tạo receivable. `AdminPosController` + `PosOrderService`. Price override (`pos.price_override`), refund (`pos.refund` V112), POS report indexes (V113). Admin screen `PosScreen`. Test `Phase1MPosApiTest`. Đã có 3 audit riêng (`POS_IN_STORE_WORKFLOW_*`).
- **Findings:** Không có lệch. POS là feature cần thiết (bán walk-in tại shop — memory `project_bigbike_sales_channels`).
- **Severity:** —  **Fix status:** N/A  **Business confirmation:** Không.

### MOD-18 — Accounts Receivable

- **Surfaces:** admin, backend, database, docs
- **Status:** `COMPLETE`
- **Features found:** List/detail, record payment, write-off, aging report, credit profile (`AdminReceivableController` + `ReceivableService` + `ReceivableQueryService` + `CreditPolicyService` + `ReceivableNotificationService`). `ReceivableEntity`, credit & receivables (V75), version (V83), permission backfill (V79). Admin screens `ReceivablesListScreen` + `ReceivableDetailScreen`. Test `AdminReceivableApiTest`.
- **Findings:** Permission `receivables.export` có trong `PermissionCatalog` nhưng **không endpoint nào dùng** — PERMISSION_MATRIX tự ghi "Reserved for future CSV/PDF export". Permission có nhưng không endpoint sử dụng.
- **Severity:** P3  **Fix status:** NOT_FIXED  **Business confirmation:** Có — giữ làm reserved hay gỡ khỏi catalog là product decision.

### MOD-19 — Customer account

- **Surfaces:** web, admin, backend, mobile, database, docs
- **Status:** `COMPLETE`
- **Features found:** Profile/addresses/orders/returns. `CustomerController`, `CustomerAuthController` (login/register/logout/forgot/reset/verify-email/resend-verification), `CustomerAdminController` (admin xem). Email verification token (V9), password reset token, session. Web `/tai-khoan/*`, mobile `account`/`auth`. Test `Phase1DCustomerAuthTest`, `Phase1I1CustomerStatusLoginTest`, `AuthProfileGuardTest`.
- **Findings:** Verify-email đã có trên mobile (`VerifyEmailScreen`). Không có lệch.
- **Severity:** —  **Fix status:** N/A  **Business confirmation:** Không.

### MOD-20 — Customer address

- **Surfaces:** web, backend, mobile, database, docs
- **Status:** `COMPLETE`
- **Features found:** `CustomerAddressController` CRUD, `CustomerAddressEntity`. Web `/tai-khoan/edit-address/[type]`, mobile `addresses`. Test `CustomerAddressApiTest`.
- **Findings:** Không có admin surface (admin xem địa chỉ qua customer detail) — đúng thiết kế.
- **Severity:** —  **Fix status:** N/A  **Business confirmation:** Không.

### MOD-21 — Wishlist

- **Surfaces:** web, backend, database
- **Status:** `PARTIAL`
- **Features found:** `CustomerWishlistController` (`/api/v1/customer/wishlist`, GET `/products`, POST add, DELETE `/{productId}`), `WishlistItemEntity` (V103). Web `/tai-khoan/yeu-thich`. Test `CustomerWishlistApiTest`.
- **Findings:** **Mobile không hỗ trợ** — `api_endpoints.dart` không có wishlist endpoint, không có wishlist screen trong mobile. **Docs:** wishlist không liệt kê trong `MODULE_CATALOG.md`. Web có UI + backend đầy đủ, mobile + docs catalog thiếu.
- **Severity:** P2  **Fix status:** NOT_FIXED  **Business confirmation:** Có — đưa wishlist lên mobile là product decision; nếu mobile là parity với web thì nên làm.
- **Recommended fix:** (1) Thêm wishlist vào MODULE_CATALOG.md; (2) quyết định mobile parity.

### MOD-22 — Review

- **Surfaces:** web, admin, backend, mobile (read-only), database, docs
- **Status:** `MOSTLY_COMPLETE`
- **Features found:** Public `PublicReviewController` (`/api/v1/products/{productId}/reviews` — GET list + POST create), admin moderation `AdminReviewController` (list/detail, status check V60, public review indexes V61). `ReviewEntity`, rating cache sync (V63), rating count (V43). Admin screens `ReviewListScreen` + `ReviewDetailScreen`. Test `PublicReviewApiTest`, `Phase1NReviewsApiTest`.
- **Findings:** Mobile có endpoint `productReviews(id)` để **đọc** reviews nhưng **không có endpoint/UI submit review** trên mobile — web submit được, mobile chỉ xem.
- **Severity:** P3  **Fix status:** NOT_FIXED  **Business confirmation:** Có — mobile submit review là product decision (post-launch khả thi).

### MOD-23 — Contact form

- **Surfaces:** web, backend, mobile, database, docs
- **Status:** `COMPLETE`
- **Features found:** `POST /api/v1/contact` (`ContactController` + `ContactService`) — persist vào `contact_messages` (V105) + email admin best-effort. Web `/lien-he`, mobile `contact`. Test `ContactPublicFormTest`.
- **Findings:** Không có lệch.
- **Severity:** —  **Fix status:** N/A  **Business confirmation:** Không.

### MOD-24 — Contact inbox (admin)

- **Surfaces:** admin, backend, database, docs
- **Status:** `COMPLETE` (sau fix 2026-05-16)
- **Features found:** `AdminContactController` (list/detail/update, permission `contact.read/write` V105), `AdminContactService`, status workflow `OPEN → IN_PROGRESS → RESOLVED/CLOSED`, note + assignee. Test `AdminContactApiTest`, `AdminContactInboxApiTest`.
- **Findings:** Trước fix: backend + API + permission + test đầy đủ nhưng **không có admin screen** trong `App.jsx` để xem inbox (BACKEND_ONLY ở lớp surface admin UI).
- **Severity:** P1  **Fix status:** ✅ **FIXED (2026-05-16)** — Đã thêm `ContactInboxScreen.jsx` (list + filter trạng thái + tìm kiếm + modal chi tiết, cập nhật trạng thái/ghi chú, nút "Nhận xử lý") + 3 hàm API client (`fetchContactMessages` / `fetchContactMessageDetail` / `updateContactMessage`) + route `/admin/contact-messages` + nav item (nhóm Bán hàng, permission `contact.read`) + i18n key `nav.contactInbox`. Admin build pass.  **Business confirmation:** Không.

### MOD-25 — Media library

- **Surfaces:** admin, backend, database, docs
- **Status:** `COMPLETE`
- **Features found:** Upload/list/detail/update/delete/restore (`AdminMediaController` + `AdminMediaService`), media folders + tags (`AdminMediaFolderController`, V85), checksum (`MediaChecksumService`), copy (`MediaCopyService`), image variants (`ImageVariantService`), reference tracking (`MediaReferenceService`). `MediaEntity`, `MediaFolderEntity`. Admin screen `MediaLibraryScreen`. Test `AdminMediaP0Test`.
- **Findings:** Không có lệch.
- **Severity:** —  **Fix status:** N/A  **Business confirmation:** Không.

### MOD-26 — Content / Article / Page

- **Surfaces:** web, admin, backend, mobile, database, docs
- **Status:** `COMPLETE`
- **Features found:** `AdminContentController` + `AdminContentMutationService/ReadService/ReferenceService` (article + page CRUD), public `ContentController` + `ContentReadService`. Entities `ArticleEntity`, `PageEntity`, `ContentCategoryEntity`, `ContentAuthorEntity`, `BlogTagEntity`. Static pages seed (V21/V96/V97), WP blog import (V93 — 167 bài), content indexes (V69), canonical URL fix (V70), legacy publish status migrate (V87), page hero fields (V98). Admin screens `ContentListScreen` + `ContentDetailScreen`. Web `/tin-tuc`, `/[slug]`, `/chinh-sach/[slug]`, `/huong-dan`. Mobile `articles`/`content`. Test `AdminContentApiTest`, `ContentP1ApiTest`, `ContentPublicApiTest`.
- **Findings:** Không có lệch. (Có bug backend articles list query đã được ghi nhận ở memory `project_blog_import` — task riêng, không xử lý ở đây.)
- **Severity:** —  **Fix status:** N/A  **Business confirmation:** Không.

### MOD-27 — Settings

- **Surfaces:** admin, backend, web (public read), mobile, docs
- **Status:** `COMPLETE`
- **Features found:** `AdminSettingsController` (read/update), `PublicSettingsController` (`/settings/public`), `SettingDefinitionRegistry`. Seed nhiều nhóm (footer/contact/SEO/tax/inventory/messenger/facebook…), diacritics fix (V107). Admin screen `SettingsScreen`. Test `Phase1JAdminSettingsMenuCouponApiTest`.
- **Findings:** Không có lệch.
- **Severity:** —  **Fix status:** N/A  **Business confirmation:** Không.

### MOD-28 — Menu

- **Surfaces:** admin, backend, web, mobile, database, docs
- **Status:** `COMPLETE`
- **Features found:** `AdminMenuController` + `AdminMenuService` (CRUD + reorder menu-item trong 3 system slot `primary/footer/guide`), `PublicMenuController`. System slot seed (V84). Admin screen `MenuScreen`. Test `Phase1JAdminSettingsMenuCouponApiTest`.
- **Findings:** Không có lệch. Slot là system-defined (đúng thiết kế).
- **Severity:** —  **Fix status:** N/A  **Business confirmation:** Không.

### MOD-29 — Slider

- **Surfaces:** admin, backend, web, mobile, database, docs
- **Status:** `COMPLETE`
- **Features found:** `AdminSliderController` + `AdminSliderService`, `PublicSliderController` + `SliderReadService`. `SliderEntity` (V17), is_active (V34), link/image fixes (V27/V33), reseed (V92). Admin screen `SliderListScreen`. Test `SliderApiTest`, `SliderRepositoryTest`, `SliderReadServiceTest`.
- **Findings:** Không có lệch.
- **Severity:** —  **Fix status:** N/A  **Business confirmation:** Không.

### MOD-30 — Home video

- **Surfaces:** admin, backend, web, mobile (endpoint-only), database, docs
- **Status:** `MOSTLY_COMPLETE`
- **Features found:** `AdminHomeVideoController` + `AdminHomeVideoService`, `PublicHomeVideoController` + `HomeVideoReadService`. `HomeVideoEntity` (V35), youtube id (V36), sort order uniqueness (V72). Admin screen `HomeVideoListScreen`. Test `HomeVideoApiTest`, `HomeVideoRepositoryTest`, `YouTubeUrlParserTest`, `PublicHomeVideoResponseTest`.
- **Findings:** Mobile có endpoint `homeVideos` trong `api_endpoints.dart` nhưng **comment trong code xác nhận "UI integration pending — widget not yet implemented"**. Endpoint có, mobile UI không dùng. `MODULE_CATALOG.md` đã ghi nhận đây là gap (`Home-videos wrapper missing → CODE_ONLY_NOT_DOCUMENTED`).
- **Severity:** P3  **Fix status:** NOT_FIXED  **Business confirmation:** Có — home-video trên mobile là product decision (post-launch).

### MOD-31 — Page hero

- **Surfaces:** web, admin, backend, database, docs
- **Status:** `MOSTLY_COMPLETE`
- **Features found:** Hero (image + title + description + kicker) cho content page (`PageEntity` hero fields V98) và listing page (`public_hero` settings group). Web `PageHero.tsx`.
- **Findings:** **Không có mobile surface** — mobile không render page hero. Đối với app mobile native điều này thường chấp nhận được, nhưng tạo lệch web/mobile.
- **Severity:** P3  **Fix status:** NOT_FIXED  **Business confirmation:** Có — page hero trên mobile là product/UX decision.

### MOD-32 — Redirect

- **Surfaces:** admin, backend, database, docs
- **Status:** `COMPLETE`
- **Features found:** `AdminRedirectController` + `AdminRedirectService`, `InternalRedirectController` + `RedirectResolverService`. `RedirectEntity`, permissions (V58), source pattern unique (V80), legacy WP redirects import (V106). Admin screen `RedirectListScreen`. Test `AdminRedirectApiTest`, `Phase2D4RedirectMappingTest`.
- **Findings:** `InternalRedirectController` là `permitAll` — PERMISSION_MATRIX ghi rõ kỳ vọng infra hạn chế ở production. Cần xác nhận hạ tầng prod.
- **Severity:** P2  **Fix status:** NOT_FIXED  **Business confirmation:** Có — xác nhận chính sách bảo vệ internal redirect endpoint ở production (infra).

### MOD-33 — Admin users

- **Surfaces:** admin, backend, database, docs
- **Status:** `COMPLETE`
- **Features found:** `AdminAdminUsersController` + `AdminAdminUsersService`, `AdminUserEntity` + `AdminRoleEntity` + `AdminUserRoles` (V12), `AdminRefreshTokenEntity`. Admin screen `AdminUsersScreen`. Test `AdminUsersApiTest`, `Phase1IAdminManagementApiTest`.
- **Findings:** Không có lệch.
- **Severity:** —  **Fix status:** N/A  **Business confirmation:** Không.

### MOD-34 — Roles / Permissions

- **Surfaces:** admin, backend, database, docs
- **Status:** `COMPLETE`
- **Features found:** `AdminRolesController` + `AdminRoleService`, `AdminPermissionsController` + `AdminPermissionService`, `PermissionCatalog` (canonical). Roles/permissions tables (V49), seed (V81), inventory+serial perms (V109), POS refund (V112), reports perms (V78), redirect perms (V58). Admin screen `RolesScreen`. Test `AdminRolesApiTest`, `RbacUrlGateIntegrationTest`.
- **Findings:** Đối chiếu permission keys: tất cả 46 key trong `PermissionCatalog` khớp với key dùng trong controller, **trừ `receivables.export`** (xem MOD-18 — reserved, không endpoint nào dùng). Không phát hiện endpoint nào thiếu permission hoặc permission orphan ngoài `receivables.export`.
- **Severity:** P3 (do `receivables.export`)  **Fix status:** NOT_FIXED  **Business confirmation:** Có (xem MOD-18).

### MOD-35 — Audit logs

- **Surfaces:** admin, backend, database, docs
- **Status:** `COMPLETE`
- **Features found:** `AdminAuditLogController` + `AdminAuditLogService` (read-only, filter actorType/resourceType/action/date, enrich actor name + resource label, permission `audit-logs.read`). `AuditLogEntity`, resource type fix (V76). Admin screen `AuditLogListScreen`. Test `AdminAuditLogApiTest`.
- **Findings:** Không có lệch.
- **Severity:** —  **Fix status:** N/A  **Business confirmation:** Không.

### MOD-36 — Reports / Dashboard

- **Surfaces:** admin, backend, database, docs
- **Status:** `COMPLETE`
- **Features found:** `AdminReportController` (analytics + CSV export orders/customers/products, permission `reports.read/export`), `AdminDashboardController` + `AdminDashboardService`. Reports indexes (V77), permissions (V78). Admin screens `ReportsScreen` + `DashboardScreen`. Test `AdminReportApiTest`, `AdminReportRepositoryQueryTest`, `AdminReportCsvHardeningTest`, `AdminDashboardApiTest`.
- **Findings:** Không có lệch.
- **Severity:** —  **Fix status:** N/A  **Business confirmation:** Không.

### MOD-37 — Notification center

- **Surfaces:** admin, backend, database
- **Status:** `MOSTLY_COMPLETE`
- **Features found:** `AdminNotificationController` (`/api/v1/admin/notifications`, GET list, `POST /mark-read`, `POST /mark-all-read`) + `AdminNotificationService`, `AdminNotificationEntity` (V102). WebSocket `/topic/admin/orders` (`AdminOrderWsService`, `WebSocketConfig`). Admin UI `NotificationBell.jsx` + `OrderNotificationToast.jsx` + `adminWebSocket.js`.
- **Findings:** **`MODULE_CATALOG.md` và `API_CONTRACT.md` không liệt kê module Notification center** (chỉ ghi "Admin order WebSocket"). Notification REST endpoints + entity (V102) tồn tại trong code nhưng không có trong MODULE_CATALOG/API_CONTRACT. Code có feature, docs không ghi đủ. **Không có test riêng** cho `AdminNotificationController`.
- **Severity:** P2  **Fix status:** NOT_FIXED  **Business confirmation:** Không.
- **Recommended fix:** (1) Thêm "Notification center" vào MODULE_CATALOG.md + endpoints vào API_CONTRACT.md; (2) thêm test cho notification mark-read/list.

### MOD-38 — Vietnam address lookup

- **Surfaces:** web, backend, mobile, docs
- **Status:** `COMPLETE`
- **Features found:** `VnAddressController` + `VnAddressService` (province → district → ward). Web `VnAddressFields`, mobile `provinces/districts/wards`.
- **Findings:** Không có lệch.
- **Severity:** —  **Fix status:** N/A  **Business confirmation:** Không.

### MOD-39 — Mobile API coverage

- **Surfaces:** mobile
- **Status:** `PARTIAL` (so với web parity)
- **Features wrapped:** products/categories/brands/articles/pages/menus/settings/sliders/home-videos/search/cart/checkout/auth/customer/orders/returns/contact/vn-address.
- **Features KHÔNG có trên mobile:** Wishlist (MOD-21), Warranty lookup (MOD-16), submit Review (MOD-22), Home-video UI widget (MOD-30), Page hero (MOD-31).
- **Findings:** Mobile bám sát web ở core commerce flow (browse → cart → checkout → account → order → return) nhưng thiếu các feature phụ trợ. Không có feature nào mobile có mà backend không hỗ trợ.
- **Severity:** P2 (tổng hợp)  **Fix status:** NOT_FIXED  **Business confirmation:** Có — phạm vi parity mobile vs web là product decision.

---

## 3. Orphan schema / dead schema

### ORPHAN-01 — Stock receipt tables (`stock_receipts`, `stock_receipt_lines`, `receipt_serials`)

- **Surfaces:** database only
- **Status:** `SCHEMA_ONLY`
- **Evidence:** V52 (`add_stock_receipts`), V53 (`add_stock_receipt_lines`), V55 (`add_receipt_serials`) tạo bảng. Grep toàn bộ `bigbike-backend/src/main/java` — **không có entity, repository, service hay controller nào tham chiếu `stock_receipt` / `StockReceipt` / `receipt_serial`**. `MODULE_CATALOG.md` cũng tự ghi nhận: "Stock receipt schema — Receipt tables exist in DB schema only — `NOT_FOUND_IN_REPO`".
- **Findings:** Nghiệp vụ nhập kho thực tế đang chạy qua `StockMovementEntity` (`IN`) + `StockMovementSerialEntity`, không qua receipt tables. 3 bảng receipt là **schema mồ côi** — DB có schema nhưng không service/controller/UI.
- **Severity:** P1  **Fix status:** ✅ **FIXED (2026-05-16)** — Business chốt **bỏ hẳn phiếu nhập kho**. Migration `V120__drop_stock_receipt_tables.sql` drop 3 bảng (`stock_receipt_serials`, `stock_receipt_lines`, `stock_receipts`) + index `idx_stock_movements_receipt`. Docs đã đồng bộ: MODULE_CATALOG, DATA_CONTRACT, BUSINESS_RULES, BUSINESS_PROCESS, ACCEPTANCE_CRITERIA, PROJECT_OVERVIEW, API_FLOW_MAP, TRACEABILITY_MATRIX → status `REMOVED`.  **Business confirmation:** Đã xác nhận.

### ORPHAN-02 — SePay payment artifacts → đã dọn sạch

- **Status:** `CLEANED` (không còn orphan)
- **Evidence:** V44 từng tạo `unmatched_payments`; V59 đã `drop table unmatched_payments cascade` + xoá `payment_sepay.*` settings + drop `pending_payment_expires_at`. Grep xác nhận không còn java ref. **Không phải finding** — ghi lại để loại trừ.

---

## 4. Kiểm tra các loại lỗi module/feature

| Loại lỗi | Kết quả |
|---|---|
| Admin có feature nhưng web/mobile không dùng | Không có lỗi nghiêm trọng; các module admin-only (Inventory, Serial, Receivable, Reports, Audit log, Notification) là đúng thiết kế. |
| Web/mobile có UI nhưng backend không hỗ trợ | **Không phát hiện.** Mọi UI web/mobile đều có endpoint backend tương ứng. |
| Backend có API nhưng không có UI | **MOD-24 Contact inbox** — đã ✅ FIXED (2026-05-16): thêm `ContactInboxScreen` + route + nav. |
| DB có schema nhưng không có service/controller/UI | **ORPHAN-01** — `stock_receipts/stock_receipt_lines/receipt_serials` (P1). |
| Docs ghi có feature nhưng code không có | Không phát hiện — các mục `NOT_FOUND_IN_REPO` trong docs đã được docs tự đánh dấu trung thực. |
| Code có feature nhưng docs không ghi | **MOD-11 Shipping**, **MOD-21 Wishlist**, **MOD-37 Notification center**, **MOD-08 Coupon gift** — đã ✅ FIXED (2026-05-16): bổ sung vào `MODULE_CATALOG.md` + `API_CONTRACT.md`. |
| Permission có nhưng không endpoint nào dùng | **`receivables.export`** — reserved, chưa endpoint (P3). |
| Endpoint có nhưng permission thiếu/sai | Không phát hiện — 45/46 permission key khớp endpoint. |
| Data field lệch admin form / DTO / DB / public render | Không phát hiện lệch trong audit này (product module đã audit riêng 2026-05-14). |
| Feature duplicate / legacy chưa dọn | Không có `DUPLICATED_FEATURE`. Legacy: migration churn serial V51→V54→V57+ (vô hại), SePay đã dọn (V59). |
| Test thiếu cho module quan trọng | Notification center, RefundService, Search controller — thiếu test trực tiếp (xem mục 9). |
| Feature gây hiểu nhầm vận hành | **ORPHAN-01** stock receipt tables — schema gợi ý module "phiếu nhập kho" không tồn tại. |

---

## 5. Tổng kết phân loại module

### 5.1. Module COMPLETE (24)

Catalog browse, Product, Category, Brand, Search, Cart, Checkout, Coupon (+ Coupon gift), Order, Payment, Return, Inventory, Serial, POS, Accounts Receivable, Customer account, Customer address, Media library, Content/Article/Page, Settings, Menu, Slider, Redirect, Admin users, Roles/Permissions, Audit logs, Reports/Dashboard, Vietnam address lookup.

### 5.2. Module MOSTLY_COMPLETE (7)

| Module | Thiếu gì |
|---|---|
| Fulfillment/Shipping | Không có trong MODULE_CATALOG.md |
| Refund | Không có test riêng cho RefundService |
| Warranty | Không có mobile surface |
| Home video | Mobile endpoint có nhưng không có UI widget |
| Page hero | Không có mobile surface |
| Notification center | Không trong MODULE_CATALOG/API_CONTRACT, không có test |

### 5.3. Module PARTIAL / BACKEND_ONLY / SCHEMA_ONLY

| Module | Phân loại | Lý do |
|---|---|---|
| Wishlist | `PARTIAL` | Web + backend đủ; mobile thiếu; không trong MODULE_CATALOG |
| Contact inbox (lớp UI admin) | `BACKEND_ONLY` ở surface admin | Backend + API + test đủ, không có screen |
| Stock receipt (V52/53/55) | `SCHEMA_ONLY` | DB schema, không code |
| Mobile API coverage | `PARTIAL` | Thiếu wishlist/warranty/review-submit/home-video/page-hero so với web |

### 5.4. Không có module nào `UI_ONLY`, `DOCS_ONLY`, `DEAD_FEATURE`, `DUPLICATED_FEATURE`.

---

## 6. Feature có thể bỏ

| Feature | Khuyến nghị |
|---|---|
| `stock_receipts` / `stock_receipt_lines` / `receipt_serials` (V52/53/55) | **Bỏ** nếu xác nhận không làm module phiếu nhập kho — tạo migration drop. Hoặc giữ + ghi docs rõ ràng là planned. **Cần business confirmation.** |
| Permission `receivables.export` | Giữ nếu sắp làm export receivable; nếu không, gỡ khỏi `PermissionCatalog`. **Cần business confirmation.** |

Không có feature nào khác đề xuất bỏ — toàn bộ còn lại đang được sử dụng.

---

## 7. Feature nên làm TRƯỚC launch

| # | Việc | Module | Severity |
|---|---|---|---|
| 1 | ✅ ĐÃ XỬ LÝ — admin UI Contact inbox đã được thêm (`ContactInboxScreen` + route + nav) | MOD-24 | P1 |
| 2 | ✅ ĐÃ XỬ LÝ — stock receipt tables đã drop hẳn (V120) | ORPHAN-01 | P1 |
| 3 | Xác nhận **bảo vệ internal redirect endpoint** ở production (infra) | MOD-32 | P2 |
| 4 | Cập nhật `MODULE_CATALOG.md`: thêm Shipping, Wishlist, Notification center, Coupon gift | MOD-11/21/37/08 | P2 |

## 8. Feature để POST-LAUNCH

| Việc | Module |
|---|---|
| Wishlist trên mobile | MOD-21 |
| Warranty lookup trên mobile | MOD-16 |
| Submit review trên mobile | MOD-22 |
| Home-video UI widget trên mobile | MOD-30 |
| Page hero trên mobile | MOD-31 |
| Receivable CSV/PDF export (`receivables.export`) | MOD-18 |

---

## 9. Test coverage còn thiếu

| Module | Trạng thái test | Khuyến nghị |
|---|---|---|
| Notification center | **Không có test** cho `AdminNotificationController` (list / mark-read / mark-all-read) | Thêm `AdminNotificationApiTest` |
| Refund | Không có test riêng `RefundService` (chỉ gián tiếp qua POS/Returns) | Thêm unit test tính refund amount + idempotency |
| Search | Không có test riêng `PublicSearchController` (gián tiếp qua `PublicReadApiTest`) | Thêm test search + search-suggest |
| Media folders | `AdminMediaFolderController` — không thấy test riêng (chỉ `AdminMediaP0Test` cho media) | Cân nhắc thêm test folder CRUD |

Các module commerce lõi (cart/checkout/order/return/POS/coupon/inventory/serial/receivable/auth) có test rõ ràng — coverage tốt.

---

## 10. Docs mismatch

| Docs | Vấn đề |
|---|---|
| `MODULE_CATALOG.md` | ✅ FIXED (2026-05-16) — đã thêm Shipping admin, Wishlist, Notification center; ghi chú Coupon gift. Stock receipt đổi sang `REMOVED` (V120). |
| `API_CONTRACT.md` | ✅ FIXED (2026-05-16) — đã thêm section "Admin Notification Center Contract" (`/api/v1/admin/notifications/*`). Wishlist + Coupon gift bulk vốn đã có sẵn. |
| `PERMISSION_MATRIX.md` | Chính xác — đã tự ghi `receivables.export` là "reserved for future". |
| `DATA_CONTRACT.md` | Cần xác nhận stock receipt tables có/không nằm trong data contract — nếu có thì lệch với code. |

Không phát hiện docs ghi feature mà code hoàn toàn không có (docs trung thực với các nhãn `NOT_FOUND_IN_REPO`).

---

## 11. Kết luận — Hệ thống module-complete tới mức nào

**BigBike đã module-complete ở mức cao.** Toàn bộ 39 module được kiểm tra đều có hiện diện code thật; không có module nào chỉ tồn tại trên docs (`DOCS_ONLY`), không có feature duplicate, không có UI web/mobile bị "treo" thiếu backend.

**Định lượng:**
- 24/39 module `COMPLETE`.
- 7/39 `MOSTLY_COMPLETE` (gap chủ yếu là docs hoặc mobile parity, không phải lỗi chức năng).
- 2 vấn đề `P1` cần xử lý trước launch: **Contact inbox không có admin UI** và **stock receipt schema mồ côi**.
- 0 vấn đề `P0`.

**Đánh giá:** Hệ thống **đủ điều kiện hoàn thiện module** cho launch sau khi xử lý 2 mục P1. Các gap còn lại là (a) thiếu docs catalog cho 4 feature đã có code, (b) mobile thiếu 5 feature phụ trợ so với web — đều là quyết định product/post-launch, không chặn vận hành lõi.

**Lưu ý quan trọng:** Audit này kiểm tra completeness từng module độc lập. Tính đúng đắn của luồng end-to-end (đặt hàng → thanh toán → fulfillment → return) được audit riêng tại [BIGBIKE_FULL_E2E_WORKFLOW_AUDIT.md](BIGBIKE_FULL_E2E_WORKFLOW_AUDIT.md) và không lặp lại ở đây.

---

## 12. Bảng hành động tổng hợp

| ID | Việc | Module | Severity | Loại | Business confirm |
|---|---|---|---|---|---|
| ACT-01 | ~~Thêm admin UI Contact inbox~~ → ✅ ĐÃ XỬ LÝ (2026-05-16) | MOD-24 | P1 | Code (UI) | Không |
| ACT-02 | ~~Quyết định stock receipt tables~~ → ✅ ĐÃ XỬ LÝ: drop hẳn (V120) | ORPHAN-01 | P1 | Business | Đã xác nhận |
| ACT-03 | Xác nhận bảo vệ internal redirect prod | MOD-32 | P2 | Infra | **Có** |
| ACT-04 | ~~Cập nhật MODULE_CATALOG.md~~ → ✅ ĐÃ XỬ LÝ (2026-05-16): thêm Shipping admin, Wishlist, Notification center; ghi chú Coupon gift | nhiều | P2 | Docs | Không |
| ACT-05 | ~~Cập nhật API_CONTRACT.md~~ → ✅ ĐÃ XỬ LÝ (2026-05-16): thêm section "Admin Notification Center Contract" | MOD-37 | P2 | Docs | Không |
| ACT-06 | Thêm test Notification / Refund / Search | MOD-37/13/05 | P2 | Test | Không |
| ACT-07 | Quyết định mobile parity (wishlist/warranty/review/home-video/hero) | MOD-39 | P2 | Business | **Có** |
| ACT-08 | Quyết định `receivables.export` (giữ reserved / gỡ) | MOD-18 | P3 | Business | **Có** |

**Fix status toàn bộ:** `NOT_FIXED` — audit này chỉ báo cáo, không sửa code (theo yêu cầu task: không sửa hàng loạt, các finding đều là quyết định business hoặc cập nhật docs/UI có chủ đích, không phải bug nhỏ chắc chắn).
</content>
</invoke>
