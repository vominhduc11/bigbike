# Workflow Overview

## Customer Commerce Flow

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 1 | Guest/Customer | Browse products, content, search, and suggestions | `CONFIRMED_FROM_CODE` | public controllers, web clients |
| 2 | Guest/Customer | Build cart with cookie or customer session | `CONFIRMED_FROM_CODE` | `CartController.java`, `CartService.java` |
| 3 | Guest/Customer | Submit checkout with CSRF token | `CONFIRMED_FROM_CODE` | `CustomerCsrfFilter.java`, `CheckoutService.java` |
| 4 | System | Revalidate price, stock (no shipping-method step — `SHIP_RULE_001`) | `CONFIRMED_FROM_CODE` | `CheckoutService.java` |
| 5 | System | Create order, payment, notes (no shipping fee — `SHIP_RULE_001`) | `CONFIRMED_FROM_CODE` | `CheckoutService.java` |
| 6 | System | Push admin order event (no quantity decrement — boolean availability, V261) | `CONFIRMED_FROM_CODE` | `CheckoutService.java`, `AdminOrderWsService.java` |
| 7 | Customer/Guest | Track the order from the signed-in order detail or confirmation link: refresh the existing order read every 15 seconds while visible, refresh on tab focus, and stop at `COMPLETED` or `CANCELLED`; no customer WebSocket is used | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java`, `OrderLookupController.java`, `bigbike-web` order query hooks and confirmation client |

## Account Login Workflow

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 1 | Guest | Open `/dang-nhap` or `/dang-ky` as separate legacy-parity pages; registration remains a separate route, not an in-place auth tab | `CONFIRMED_FROM_CODE` | live legacy URLs `/dang-nhap.html`, `/dang-ky.html`, current `page.tsx`, `LoginForm.tsx`, `RegisterForm.tsx`; raw local export permanently unavailable |
| 2a | Guest | Sign in with email/phone + password; "Ghi nhớ" keeps the session for 30 days (vs 1 day when unchecked) | `CONFIRMED_FROM_CODE` | `CustomerAuthService.login`, `CustomerSessionService` |
| 2b | Guest | Or sign in with **Google or Facebook** — both buttons appear on the login and register pages and hand off to the backend OAuth service | `CONFIRMED_FROM_CODE` | `SocialLoginButtons.tsx`, `CustomerOAuthService.linkOrCreate` |
| 2c | System | A social sign-in that fails returns the customer to the login page **for their locale** with a reason they can read (declined / unavailable / account blocked / try again) rather than a blank page | `CONFIRMED_FROM_CODE` | `OAuthError.java`, `lib/auth/oauth-error.ts`, `LoginForm.tsx` |
| 3 | System | Issue `bb_session` / `bb_refresh` / `bb_csrf` cookies and return the customer to the page they came from | `CONFIRMED_FROM_CODE` | `CustomerAuthController`, `CustomerOAuthController` |
| 4 | Customer | A social account's profile (name, avatar) is provider-managed — the storefront profile form is read-only when signed in via Google/Facebook, and syncs from the provider on every login instead of self-editing (CUSTOMER_RULE_010, 2026-08-07). The former "Tài khoản liên kết" link/unlink panel was removed the same day: since a password account can no longer pick up a new social link, there is nothing left for a self-service screen to manage | `CONFIRMED_FROM_CODE` | `CustomerOAuthService.linkOrCreate`/`syncProfileFromProvider`, `CustomerAuthService.requireNotOauthManaged`, `EditAccountContent.tsx` |

## POS Workflow — REMOVED (owner decision 2026-06-23, online-only)

The point-of-sale / walk-in ("bán tại quầy") workflow was removed entirely. BigBike no longer records in-store sales — every order goes through the online checkout flow above. The POS product search and POS order-creation endpoints, the POS admin screen, and the `pos.*` permissions no longer exist. Customers who buy in person at the shop are not entered into the system.

## Media Workflow

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 1 | Admin | Upload file to admin media endpoint | `CONFIRMED_FROM_CODE` | `AdminMediaController.java` |
| 2 | System | Detect MIME from content with Apache Tika | `CONFIRMED_FROM_CODE` | `AdminMediaService.java` |
| 3 | System | Reject unsupported/empty/fake MIME uploads; accept SVG but sanitize it (strip scripts/handlers/external refs) | `CONFIRMED_FROM_CODE` | `AdminMediaP0Test.java`, `SvgSanitizer.java` |
| 4 | System | Persist media metadata and storage reference | `CONFIRMED_FROM_CODE` | `AdminMediaService.java` |

## Product Authoring & Live Preview Workflow

| Step | Actor | Action | Status | Evidence |
|---|---|---|---|---|
| 1 | Admin / Editor (`products.update`) | Mở editor tạo/sửa sản phẩm, chọn một hoặc nhiều danh mục theo thứ tự (mục đầu là danh mục chính), rồi nhập nội dung (tên, ảnh, giá, mô tả, biến thể, SEO) | `CONFIRMED_FROM_CODE` | `ProductDetailScreen.jsx`, `PRODUCT_RULE_010` |
| 2 | System | Debounce form → `POST /api/v1/admin/products/preview` (dry-run, không lưu) → trả public `Product` | `CONFIRMED_FROM_CODE` | `AdminCatalogController.previewProduct`, `AdminCatalogMutationService.previewProduct` |
| 3 | Admin | Xem preview "sống" trong khung nhúng — đúng template storefront, cập nhật theo từng thay đổi; chuyển vi/en và desktop/mobile | `CONFIRMED_FROM_CODE` | bigbike-web iframe `/preview/product`, `ProductView.tsx` |
| 4 | Admin | Lưu khi ưng — editor **luôn lưu về Nháp** (sản phẩm mới/đang Nháp), hoặc lưu giữ nguyên nếu đang Đã xuất bản; không có nút đăng trực tiếp trong editor nữa (đổi 2026-07-19) | `CONFIRMED_FROM_CODE` | `ProductDetailScreen.jsx` (1 nút Lưu duy nhất), `BUSINESS_RULES.md` `PRODUCT_RULE_005` |
| 5 | Admin | Đăng (`DRAFT→PUBLISHED`) sau khi đã lưu nháp — thao tác riêng, làm ở màn danh sách sản phẩm, chạy bảng kiểm chất lượng trước khi đăng — preview không đụng luồng publish/cache | `CONFIRMED_FROM_CODE` | `ProductListScreen.jsx` (`handleTogglePublish`), `AdminCatalogMutationService.updateProductPublishStatus`, `STATE_MACHINES.md` §4 |

Preview **không** đổi `publishStatus`, không lưu, và không expose draft ra public (đi qua phiên admin, không qua public read path).

Khung xem trước chỉ để **xem giao diện**, nên các thao tác/điều hướng không liên quan bị **khóa** để admin không đi lạc: mọi link điều hướng + ô tìm kiếm vô hiệu (`PreviewGuard`), nút mua/thêm giỏ vô hiệu (`canBuy=false`), và các nút hành động ngoài luồng — Tư vấn Zalo, Viết/Xem đánh giá, Chia sẻ Facebook/X, thanh mua dính đáy mobile — render **mờ + khóa bấm** khi `previewMode`. Vẫn giữ tương tác tại chỗ để kiểm tra hiển thị: chọn biến thể (màu/size), xem ảnh phóng to gallery. Khối đánh giá của khách + "sản phẩm đã xem" bị ẩn trong preview (draft chưa có id).

**Bài viết tin tức** dùng cùng cơ chế: editor `ContentDetailScreen` → `POST /api/v1/admin/content/articles/preview` (dry-run `content.update`, không lưu) → iframe `/preview/article` render bằng `ArticleView` — đúng template blog detail. Cùng tính chất: không đổi `publishStatus`, không lưu, không expose draft.

## Header Navigation — Desktop Mega Menu (2026-05-27)

**Quyết định:** Header desktop "Tất cả sản phẩm" chuyển từ flyout dọc nhiều cấp sang **mega menu sidebar + panel** từ phiên bản 2026-05-27.

**Lý do:** Menu thực tế sâu 4 cấp (L1 → 9 nhóm L2 → 17 danh mục L3 → 4 mục L4). Flyout dọc cho cấu trúc này đẩy cột cấp 4 ra ~1200px chiều ngang, gây overflow viewport, scrollbar ngang, và mất hover khi rê chéo — không khắc phục được triệt để bằng collision detection.

**Layout mới (desktop ≥1440px):**
- Hover "Tất cả sản phẩm" → mega panel rộng container (75rem) hiện ngay dưới header.
- **Sidebar trái:** 9 nhóm L2 dạng danh sách dọc. Nhóm có con → hover/focus đổi nội dung panel phải, **và bấm vào tên nhóm cũng điều hướng tới trang category của chính nhóm đó** (cập nhật 2026-06-16 — trước đó nhóm có con render bằng `<button>` không có `href`/`onClick`, bấm vào không có gì xảy ra, user phản ánh nhầm là lỗi). Nhóm leaf → link điều hướng trực tiếp.
- **Panel phải:** L3 dạng grid nhiều cột. L4 hiện dạng sub-list thụt lề dưới L3 cha (không dùng flyout thêm cấp).
- Default-active: nhóm L2 đầu tiên có con.

**Mobile/tablet/desktop hẹp (<1440px):** Giữ nguyên accordion (`MobileHeaderMenu`) qua nút hamburger, không thay đổi.

**Lý do khác WP gốc (WP dùng flyout dọc):** UX > bám WP khi menu sâu 4 cấp. Quyết định này do chủ dự án xác nhận ngày 2026-05-27.

**Giới hạn cũ đã được sửa (ghi nhận 2026-06-16, gỡ note 2026-07-15 — AUD-076):** trang category cha nay hiển thị cả sản phẩm của mọi category con (`CATEGORY_RULE_006` — `CatalogReadService.resolveCategorySlugsWithDescendants` + `matchesCategoryOrDescendants`), không còn tình trạng trang cha rỗng khi sản phẩm chỉ gắn vào category con.

## Address Workflow

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 1 | Web | Đọc danh sách 34 tỉnh/thành từ dữ liệu tích hợp sẵn `VN_PROVINCES` | `CONFIRMED_FROM_CODE` | `vn-address-data.ts`, `VnAddressFields.tsx` |
| 2 | Web | Khi chọn tỉnh/thành, hiển thị trực tiếp phường/xã thuộc tỉnh; không có bước quận/huyện | `CONFIRMED_FROM_CODE` | `VnAddressFields.tsx` |

API địa chỉ backend (`GET /api/v1/address/provinces[...]`) đã gỡ 2026-07-15 (AUD-056, owner decision #8 — web/admin không gọi, không có client ngoài); nguồn dữ liệu duy nhất là `VN_PROVINCES` tích hợp trong web. Field `district` chỉ là dữ liệu lịch sử, không được thu thập cho địa chỉ mới — xem `DATA_CONTRACT.md` §Address fields.

## Maintenance Workflow (owner-confirmed 2026-08-06, thu gọn phạm vi cùng ngày)

Không còn script trên máy chủ: toàn bộ luồng nằm trong màn **Bảo trì hệ thống** của trang quản trị, chỉ vai trò `DEVELOPER` nhìn thấy.

| Bước | Người thực hiện | Luồng | Trạng thái | Căn cứ |
|---|---|---|---|---|
| 1 | Dev | Mở màn Bảo trì hệ thống, ghi lời nhắn cho nhân viên và giờ dự kiến xong | `CONFIRMED_FROM_OWNER_DECISION` | `API_CONTRACT.md` §Maintenance API |
| 2 | Dev | Bấm "Báo trước cho nhân viên" → `UPCOMING`; mọi phiên admin đang mở nhận cảnh báo realtime qua STOMP | `CONFIRMED_FROM_OWNER_DECISION` | `BUSINESS_RULES.md` `MAINTENANCE_RULE_003` |
| 3 | Nhân viên | Vẫn lưu được bình thường ở `UPCOMING`; tranh thủ hoàn tất việc đang làm dở | `CONFIRMED_FROM_OWNER_DECISION` | `BUSINESS_RULES.md` `MAINTENANCE_RULE_003` |
| 4 | Dev | Bấm "Khoá ngay" → hộp xác nhận hiện số tệp đang tải lên dở dang; xác nhận thì chuyển `ACTIVE` | `CONFIRMED_FROM_OWNER_DECISION` | `BUSINESS_RULES.md` `MAINTENANCE_RULE_007` |
| 5 | Hệ thống | Mọi thao tác ghi admin bị từ chối `423 MAINTENANCE_ACTIVE`; nhân viên (không phải dev) thấy hộp thông báo **che kín toàn màn** nên không thao tác được gì, kể cả tra cứu | `CONFIRMED_FROM_OWNER_DECISION` | `BUSINESS_RULES.md` `MAINTENANCE_RULE_004` |
| 6 | Khách hàng | **Không bị ảnh hưởng gì** — duyệt web, thêm giỏ và đặt hàng bình thường suốt thời gian khoá | `CONFIRMED_FROM_OWNER_DECISION` | `BUSINESS_RULES.md` `MAINTENANCE_RULE_002` |
| 7 | Dev | Bấm "Mở lại" → `NORMAL`; phiên admin của nhân viên tự hồi phục trong tối đa một chu kỳ (STOMP tức thì, poll 60 giây dự phòng) | `CONFIRMED_FROM_OWNER_DECISION` | `DEPLOYMENT_GUIDE.md` §Maintenance runbook |
