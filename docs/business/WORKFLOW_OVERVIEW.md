# Workflow Overview

## Customer Commerce Flow

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 1 | Guest/Customer | Browse products, content, search, and suggestions | `CONFIRMED_FROM_CODE` | public controllers, web/mobile clients |
| 2 | Guest/Customer | Build cart with cookie or customer session | `CONFIRMED_FROM_CODE` | `CartController.java`, `CartService.java` |
| 3 | Guest/Customer | Optionally apply coupon to cart | `CONFIRMED_FROM_CODE` | `CartService.applyCoupon` |
| 4 | Guest/Customer | Submit checkout with CSRF token | `CONFIRMED_FROM_CODE` | `CustomerCsrfFilter.java`, `CheckoutService.java` |
| 5 | System | Revalidate price, stock, coupon, shipping method | `CONFIRMED_FROM_CODE` | `CheckoutService.java` |
| 6 | System | Create order, payment, notes, shipping, order-applied coupons | `CONFIRMED_FROM_CODE` | `CheckoutService.java` |
| 7 | System | Decrement stock and push admin order event | `CONFIRMED_FROM_CODE` | `CheckoutService.java`, `AdminOrderWsService.java` |

## Product Comparison Workflow

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 1 | Guest/Customer | Add a product to the comparison list via the compare button on a product card or the product detail page | `CONFIRMED_FROM_CODE` | `CompareButton.tsx`, `compare-context.tsx` |
| 2 | System | Enforce max 3 products and a same-category rule; a rejected add raises a toast. The list persists in the browser (`localStorage`) — no login required | `CONFIRMED_FROM_CODE` | `compare-context.tsx`, `compare-storage.ts` |
| 3 | Guest/Customer | Open `/so-sanh` from the floating compare bar to view a side-by-side table of specifications, price, rating, stock and variant options | `CONFIRMED_FROM_CODE` | `CompareBar.tsx`, `ComparisonTable.tsx` |
| 4 | System | Fetch each compared product via `GET /api/v1/products/{slug}` to obtain specifications (omitted from list responses) | `CONFIRMED_FROM_CODE` | `client-api.ts` `fetchPublicProduct`, `CompareClient.tsx` |

## Account Login Workflow

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 1 | Guest | Open `/dang-nhap` or `/dang-ky` as separate legacy-parity pages; registration remains a separate route, not an in-place auth tab | `CONFIRMED_FROM_CODE` | `bigbike_vn__2026_04_17/sqldump.sql`, live legacy pages `/dang-nhap.html`, `/dang-ky.html`, `page.tsx`, `LoginForm.tsx`, `RegisterForm.tsx` |
| 2a | Guest | Sign in with email/phone + password; "Ghi nhớ" keeps the session for 30 days (vs 1 day when unchecked) | `CONFIRMED_FROM_CODE` | `CustomerAuthService.login`, `CustomerSessionService` |
| 2b | Guest | Or sign in with the legacy-visible Facebook social link; the backend OAuth service still supports Google/Facebook provider callbacks | `CONFIRMED_FROM_CODE` | `SocialLoginButtons.tsx`, `CustomerOAuthService.linkOrCreate` |
| 3 | System | Issue `bb_session` / `bb_refresh` / `bb_csrf` cookies and return the customer to the page they came from | `CONFIRMED_FROM_CODE` | `CustomerAuthController`, `CustomerOAuthController` |

## POS Workflow

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 1 | Admin / Shop manager | Search POS products | `CONFIRMED_FROM_CODE` | `AdminPosController.java` |
| 2 | Admin / Shop manager | Submit POS order with payment method, **required customer phone**, and idempotency key | `CONFIRMED_FROM_CODE` + `INTENDED` (phone required, this PR) | `AdminPosController.java`, `PosOrderService.java` |
| 3 | System | Validate stock, publish status, tendered amount, and override permission | `CONFIRMED_FROM_CODE` | `PosOrderService.java` |
| 4 | System | **Resolve customer by normalized phone — link existing profile or auto-create a new one** | `INTENDED` (this PR) | `PosOrderService.java`, `PhoneNumbers.java` |
| 5 | System | Create order as completed/paid, linked to the resolved customer | `CONFIRMED_FROM_CODE` | `PosOrderService.java` |
| 6 | System | Persist payment, audit log, system note, customer/staff snapshot, stock movement | `CONFIRMED_FROM_CODE` | `PosOrderService.java`, `Phase1MPosApiTest.java` |
| 7 | System | Push `NEW_ORDER` WebSocket event | `CONFIRMED_FROM_CODE` | `PosOrderService.java`, `AdminOrderWsService.java` |

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
| 4 | Admin | Lưu nháp hoặc Đăng (`DRAFT→PUBLISHED`) khi ưng — preview không đụng luồng publish/cache | `CONFIRMED_FROM_CODE` | `AdminCatalogMutationService.updateProductPublishStatus`, `STATE_MACHINES.md` §4 |

Preview **không** đổi `publishStatus`, không lưu, và không expose draft ra public (đi qua phiên admin, không qua public read path).

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

**Giới hạn đã biết (2026-06-16):** Trang category của nhóm L2 cha chỉ hiển thị sản phẩm gắn **trực tiếp** vào category đó — catalog hiện tại mỗi product chỉ thuộc 1 category, chưa có cơ chế "trang cha gồm sản phẩm của category con" (evidence: `CatalogReadService` lọc theo `matchesCategory` đúng slug, không union subcategory). Nếu category cha không có sản phẩm trực tiếp, trang sẽ hiện rỗng — đây là giới hạn dữ liệu/catalog, không phải lỗi link.

## Address Workflow

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 1 | Web/Mobile | Load provinces | `CONFIRMED_FROM_CODE` | `VnAddressController.java`, clients |
| 2 | Web/Mobile | Load districts by province code | `CONFIRMED_FROM_CODE` | `VnAddressController.java` |
| 3 | Web/Mobile | Load wards by district code | `CONFIRMED_FROM_CODE` | `VnAddressController.java` |

## Return Workflow

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 0 | Customer | Pre-check eligibility via `GET /api/v1/customer/orders/{orderId}/return-eligibility` — frontend uses this to decide whether to show the return form and which items are still returnable. | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java`, `CustomerReturnService.getReturnEligibility` |
| 1 | Customer | Submit return from own order | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java`, `Phase1LReturnsApiTest.java` |
| 2 | Customer | View own returns | `CONFIRMED_FROM_CODE` | `CustomerOrderController.java` |
| 3 | Admin | Review return list/detail | `CONFIRMED_FROM_CODE` | `AdminReturnController.java` |
| 4 | Admin | Update return status: `PENDING → APPROVED/REJECTED → RECEIVED → INSPECTING (optional) → COMPLETED/REFUNDED` | `CONFIRMED_FROM_CODE` | `AdminReturnController.java`, `AdminReturnService.java` |
| 4a | Admin | (Optional QC) After `RECEIVED → INSPECTING`, mark each ReturnItem PASS/FAIL via `PATCH /returns/{id}/items/{itemId}/inspect`. Mandatory for safety equipment (helmet, body armour). | `CONFIRMED_FROM_CODE` | `AdminReturnService.inspectItem` (V104) |
| 5 | System | Stock restore on `COMPLETED/REFUNDED`. Items with `inspection_result = 'FAIL'` are **skipped** so customer-damaged goods don't re-enter inventory. | `CONFIRMED_FROM_CODE` | `AdminReturnService.restoreStockForReturn` |
