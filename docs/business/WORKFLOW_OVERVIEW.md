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

## Account Login Workflow

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 1 | Guest | Open `/dang-nhap` or `/dang-ky` as separate legacy-parity pages; registration remains a separate route, not an in-place auth tab | `CONFIRMED_FROM_CODE` | `bigbike_vn__2026_04_17/sqldump.sql`, live legacy pages `/dang-nhap.html`, `/dang-ky.html`, `page.tsx`, `LoginForm.tsx`, `RegisterForm.tsx` |
| 2a | Guest | Sign in with email/phone + password; "Ghi nhớ" keeps the session for 30 days (vs 1 day when unchecked) | `CONFIRMED_FROM_CODE` | `CustomerAuthService.login`, `CustomerSessionService` |
| 2b | Guest | Or sign in with the legacy-visible Facebook social link; the backend OAuth service still supports Google/Facebook provider callbacks | `CONFIRMED_FROM_CODE` | `SocialLoginButtons.tsx`, `CustomerOAuthService.linkOrCreate` |
| 3 | System | Issue `bb_session` / `bb_refresh` / `bb_csrf` cookies and return the customer to the page they came from | `CONFIRMED_FROM_CODE` | `CustomerAuthController`, `CustomerOAuthController` |

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
| 1 | Admin / Editor (`products.update`) | Mở editor tạo/sửa sản phẩm và nhập nội dung (tên, ảnh, giá, mô tả, biến thể, SEO) | `CONFIRMED_FROM_CODE` | `ProductDetailScreen.jsx` |
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

**Layout mới (desktop ≥1261px):**
- Hover "Tất cả sản phẩm" → mega panel rộng container (75rem) hiện ngay dưới header.
- **Sidebar trái:** 9 nhóm L2 dạng danh sách dọc. Nhóm có con → hover/focus đổi nội dung panel phải, **và bấm vào tên nhóm cũng điều hướng tới trang category của chính nhóm đó** (cập nhật 2026-06-16 — trước đó nhóm có con render bằng `<button>` không có `href`/`onClick`, bấm vào không có gì xảy ra, user phản ánh nhầm là lỗi). Nhóm leaf → link điều hướng trực tiếp.
- **Panel phải:** L3 dạng grid nhiều cột. L4 hiện dạng sub-list thụt lề dưới L3 cha (không dùng flyout thêm cấp).
- Default-active: nhóm L2 đầu tiên có con.

**Mobile (≤1260px):** Giữ nguyên accordion (`MobileHeaderMenu`), không thay đổi.

**Lý do khác WP gốc (WP dùng flyout dọc):** UX > bám WP khi menu sâu 4 cấp. Quyết định này do chủ dự án xác nhận ngày 2026-05-27.

**Giới hạn cũ đã được sửa (ghi nhận 2026-06-16, gỡ note 2026-07-15 — AUD-076):** trang category cha nay hiển thị cả sản phẩm của mọi category con (`CATEGORY_RULE_006` — `CatalogReadService.resolveCategorySlugsWithDescendants` + `matchesCategoryOrDescendants`), không còn tình trạng trang cha rỗng khi sản phẩm chỉ gắn vào category con.

## Address Workflow

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 1 | Web | Đọc danh sách 34 tỉnh/thành từ dữ liệu tích hợp sẵn `VN_PROVINCES` | `CONFIRMED_FROM_CODE` | `vn-address-data.ts`, `VnAddressFields.tsx` |
| 2 | Web | Khi chọn tỉnh/thành, hiển thị trực tiếp phường/xã thuộc tỉnh; không có bước quận/huyện | `CONFIRMED_FROM_CODE` | `VnAddressFields.tsx` |

API địa chỉ backend (`GET /api/v1/address/provinces[...]`) đã gỡ 2026-07-15 (AUD-056, owner decision #8 — web/admin không gọi, không có client ngoài); nguồn dữ liệu duy nhất là `VN_PROVINCES` tích hợp trong web. Field `district` chỉ là dữ liệu lịch sử, không được thu thập cho địa chỉ mới — xem `DATA_CONTRACT.md` §Address fields.
