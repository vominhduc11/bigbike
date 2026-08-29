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

## Trợ lý BigBike — tư vấn và Gặp nhân viên (owner decision 2026-08-29)

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 1 | Guest/Customer | Trợ lý tư vấn hàng thật theo giai đoạn nhu cầu: chọn/so sánh sản phẩm, size, giá, còn hàng, chính sách, thông tin shop và đơn của chính khách đăng nhập. | `OWNER_CONFIRMED_2026-08-29` | `CHAT_RULE_001`–`020`, `034`–`039` |
| 2 | System | Mỗi lượt cần AI dùng duy nhất Gemini 3.7 Flash, trong trần 400 lượt/ngày và 40 lượt/hội thoại mặc định. Fast-path không dùng AI. | `OWNER_CONFIRMED_2026-08-29` | `CHAT_RULE_006`, `009`, `010`, `019` |
| 3 | System | Nếu Gemini lỗi/quá tải, hệ thống thử lại chính model trong deadline 65 giây và tối đa bốn lần gọi. Vẫn lỗi thì trả lời xin lỗi kèm nút Gặp nhân viên; không đổi model và không tự tạo yêu cầu. | `OWNER_CONFIRMED_2026-08-29` | `CHAT_RULE_011`, `019` |
| 4 | Guest/Customer | Bấm/nói Gặp nhân viên tạo `WAITING`; trong giờ trợ lý tiếp tục cho đến khi có người nhận, ngoài giờ khách được báo lần mở cửa kế tiếp. | `OWNER_CONFIRMED_2026-08-29` | `CHAT_RULE_040`, `046` |
| 5 | Admin/System | Realtime + email báo nhân viên; người có `chat.reply` nhận nguyên tử → `ACTIVE`, nhắn trực tiếp; trợ lý lùi. | `OWNER_CONFIRMED_2026-08-29` | `CHAT_RULE_040`, `045`, `047` |
| 6 | Admin/System | Nhân viên trả lại AI → `RETURNED_TO_AI`, hoặc kết thúc → `CLOSED`; trạng thái đồng bộ ngay cho khách. | `OWNER_CONFIRMED_2026-08-29` | `CHAT_RULE_040`, `045` |
| 7 | Guest/Customer | Khách bấm thẻ sản phẩm, chọn biến thể còn hàng và thêm vào giỏ; backend hậu kiểm giá, tồn và biến thể trước khi thêm. | `OWNER_CONFIRMED_2026-08-29` | `CHAT_RULE_014`, `052` |
| 8 | Guest/Customer | Cùng thiết bị được nối ngữ cảnh 30 ngày; khách thấy, tắt hoặc xóa được. | `OWNER_CONFIRMED_2026-08-29` | `CHAT_RULE_049` |
| 9 | Guest/Customer/Admin | Đọc ảnh mặc định tắt; khi bật, khách gửi tối đa một ảnh/lượt, ba ảnh/hội thoại, 20 ảnh/ngày. Ảnh được bảo vệ riêng tư; admin có `chat.read` xem trong đúng hội thoại. | `OWNER_CONFIRMED_2026-08-29` | `CHAT_RULE_057`–`059` |

### Màn quản trị chat

Màn `/admin/chat` giữ hàng chờ Gặp nhân viên, danh sách hội thoại, chi tiết hội thoại, bộ đếm “hôm nay đã dùng bao nhiêu lượt AI trên trần” và các chỉ số chất lượng còn phục vụ trực tiếp việc tư vấn. Không còn khu vực chọn/so sánh model, chấm model, chi phí/độ trễ/fallback theo model, phễu liên hệ, gắn đơn, phản hồi câu trả lời, câu bó tay hoặc dữ liệu sản phẩm thiếu.
## Account Login Workflow

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 1 | Guest | Open `/dang-nhap` or `/dang-ky` as separate legacy-parity pages; registration remains a separate route, not an in-place auth tab | `CONFIRMED_FROM_CODE` | live legacy URLs `/dang-nhap.html`, `/dang-ky.html`, current `page.tsx`, `LoginForm.tsx`, `RegisterForm.tsx`; raw local export permanently unavailable |
| 2a | Guest | Sign in with email/phone + password; "Ghi nhớ" keeps the session for 30 days (vs 1 day when unchecked) | `CONFIRMED_FROM_CODE` | `CustomerAuthService.login`, `CustomerSessionService` |
| 2b | Guest | Create a password account only after explicitly agreeing to the localized Privacy Policy. The server records policy version `2026-08-27`, acceptance time and UI locale with the new account; no Terms page is implied by this checkbox. | `OWNER_CONFIRMED_2026-08-27` | `CUSTOMER_RULE_011`, `CustomerAuthService.register`, `customer_privacy_consents` |
| 2c | Guest | Or continue with **Google or Facebook**. Both buttons remain on login and registration pages. A new account may be created only from the registration path after the same Privacy Policy agreement; an existing linked identity signs in normally. | `OWNER_CONFIRMED_2026-08-27` | `SocialLoginButtons.tsx`, `CustomerOAuthService.linkOrCreate`, `CUSTOMER_RULE_011` |
| 2d | System | A social failure returns to the localized login page with a readable reason; the specific no-consent/new-account case returns to localized registration so the customer can agree and retry. No blank page, customer, or session is created for that case. | `OWNER_CONFIRMED_2026-08-27` | `OAuthError.java`, `lib/auth/oauth-error.ts`, `CustomerOAuthController` |
| 3 | System | Issue `bb_session` / `bb_refresh` / `bb_csrf` cookies and return the customer to the page they came from | `CONFIRMED_FROM_CODE` | `CustomerAuthController`, `CustomerOAuthController` |
| 4 | Customer | A social account's profile (name, avatar) is provider-managed — the storefront profile form is read-only when signed in via Google/Facebook, and syncs from the provider on every login instead of self-editing (CUSTOMER_RULE_010, 2026-08-07). The former "Tài khoản liên kết" link/unlink panel was removed the same day: since a password account can no longer pick up a new social link, there is nothing left for a self-service screen to manage | `CONFIRMED_FROM_CODE` | `CustomerOAuthService.linkOrCreate`/`syncProfileFromProvider`, `CustomerAuthService.requireNotOauthManaged`, `EditAccountContent.tsx` |

## POS Workflow — REMOVED (owner decision 2026-06-23, online-only)

The point-of-sale / walk-in ("bán tại quầy") workflow was removed entirely. BigBike no longer records in-store sales — every order goes through the online checkout flow above. The POS product search and POS order-creation endpoints, the POS admin screen, and the `pos.*` permissions no longer exist. Customers who buy in person at the shop are not entered into the system.

## Media Workflow

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 1 | Admin | Upload file to admin media endpoint | `CONFIRMED_FROM_CODE` | `AdminMediaController.java` |
| 2 | System | Detect MIME from content with Apache Tika | `CONFIRMED_FROM_CODE` | `AdminMediaService.java` |
| 3 | System | Reject empty files, unsupported types and declared/content MIME mismatches. Admin image uploads accept only JPEG/JPG, PNG and WebP; MP4 video remains accepted. | `OWNER_CONFIRMED_2026-08-28` | `AdminMediaP0Test.java`, `AdminMediaService.java` |
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

### Admin AI content brief workflow

Trong editor danh mục và editor sản phẩm, nút **Chép hướng dẫn AI** chỉ tạo một bản hướng dẫn để
admin dán sang ChatGPT/Claude; nút này không gọi AI và không ghi dữ liệu. Mỗi lần bấm, admin nhận
kèm hồ sơ mới đọc từ hệ thống của đúng danh mục/sản phẩm, ngôn ngữ đang chọn, số liệu catalog,
giá, biến thể và nội dung hiện có của khối đang sửa. Dữ liệu chưa có phải được ghi rõ là chưa có;
không dùng số liệu cố định trong mã giao diện.

Khi admin mở bảng xem trước của nút này, hệ thống đọc hồ sơ một lần để hiển thị đúng nội dung sẽ
được chép; đóng rồi mở lại không đọc lặp. Lần bấm **Chép hướng dẫn AI** luôn đọc lại hồ sơ mới nhất
trước khi đưa vào bộ nhớ tạm. Nếu lần đọc xem trước lỗi, hướng dẫn nền vẫn hiện kèm thông báo nhẹ;
không có thao tác nào trong luồng này ghi dữ liệu danh mục hoặc sản phẩm.

Với `Category.introContent`, HTML là bản gốc. Biểu mẫu chỉ vá phần được nhận diện, giữ nguyên các
block tự do và thứ tự cũ; chuyển qua lại giữa thẻ **Biểu mẫu** và **HTML** không tự ghi và không
cảnh báo mất nội dung. Bản hướng dẫn danh mục phân biệt sáu phần do biểu mẫu quản lý với bảng,
bảng cỡ và layout tự do được phép chèn độc lập.

Khung xem trước chỉ để **xem giao diện**, nên các thao tác/điều hướng không liên quan bị **khóa** để admin không đi lạc: mọi link điều hướng + ô tìm kiếm vô hiệu (`PreviewGuard`), nút mua/thêm giỏ vô hiệu (`canBuy=false`), và các nút hành động ngoài luồng — Tư vấn Zalo, Viết/Xem đánh giá, Chia sẻ Facebook/X, thanh mua dính đáy mobile — render **mờ + khóa bấm** khi `previewMode`. Vẫn giữ tương tác tại chỗ để kiểm tra hiển thị: chọn biến thể (màu/size), xem ảnh phóng to gallery. Khối đánh giá của khách + "sản phẩm đã xem" bị ẩn trong preview (draft chưa có id).

**Bài viết tin tức** dùng cùng cơ chế: editor `ContentDetailScreen` → `POST /api/v1/admin/content/articles/preview` (dry-run `content.update`, không lưu) → iframe `/preview/article` render bằng `ArticleView` — đúng template blog detail. Cùng tính chất: không đổi `publishStatus`, không lưu, không expose draft.

## Header Navigation — Desktop Mega Menu (2026-05-27)

**Quyết định:** Header desktop "Tất cả sản phẩm" chuyển từ flyout dọc nhiều cấp sang **mega menu sidebar + panel** từ phiên bản 2026-05-27.

**Lý do:** Menu thực tế sâu 4 cấp (L1 → 9 nhóm L2 → 17 danh mục L3 → 4 mục L4). Flyout dọc cho cấu trúc này đẩy cột cấp 4 ra ~1200px chiều ngang, gây overflow viewport, scrollbar ngang, và mất hover khi rê chéo — không khắc phục được triệt để bằng collision detection.

**Layout mới (desktop ≥1280px):**
- Hover "Tất cả sản phẩm" → mega panel rộng container (75rem) hiện ngay dưới header.
- **Sidebar trái:** 9 nhóm L2 dạng danh sách dọc. Nhóm có con → hover/focus đổi nội dung panel phải, **và bấm vào tên nhóm cũng điều hướng tới trang category của chính nhóm đó** (cập nhật 2026-06-16 — trước đó nhóm có con render bằng `<button>` không có `href`/`onClick`, bấm vào không có gì xảy ra, user phản ánh nhầm là lỗi). Nhóm leaf → link điều hướng trực tiếp.
- **Panel phải:** L3 dạng grid nhiều cột. L4 hiện dạng sub-list thụt lề dưới L3 cha (không dùng flyout thêm cấp).
- Default-active: nhóm L2 đầu tiên có con.

**Mobile/tablet/desktop hẹp (<1280px):** Giữ nguyên accordion (`MobileHeaderMenu`) qua nút hamburger, không thay đổi. Khối thông tin liên hệ đi cùng ngăn kéo này; trên desktop rộng không có ngăn kéo thông tin liên hệ riêng.

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
| 1 | Dev | Mở màn Bảo trì hệ thống, ghi lời nhắn cho nhân viên. Nếu cần báo giờ, ghi giờ đó trong lời nhắn; không còn ô giờ dự kiến riêng | `CONFIRMED_FROM_OWNER_DECISION_2026-08-24` | `API_CONTRACT.md` §Maintenance API |
| 2 | Dev | Bật công tắc khoá → hộp xác nhận hiện số tệp đang tải lên dở dang; xác nhận thì chuyển `ACTIVE` | `CONFIRMED_FROM_OWNER_DECISION_2026-08-24` | `BUSINESS_RULES.md` `MAINTENANCE_RULE_007` |
| 3 | Hệ thống | Mọi thao tác ghi admin bị từ chối `423 MAINTENANCE_ACTIVE`; nhân viên (không phải dev) thấy hộp thông báo **che kín toàn màn** nên không thao tác được gì, kể cả tra cứu. Lời nhắn được hiển thị rõ trên màn hình khoá | `CONFIRMED_FROM_OWNER_DECISION_2026-08-24` | `BUSINESS_RULES.md` `MAINTENANCE_RULE_004`, `MAINTENANCE_RULE_007` |
| 4 | Khách hàng | **Không bị ảnh hưởng gì** — duyệt web, thêm giỏ và đặt hàng bình thường suốt thời gian khoá | `CONFIRMED_FROM_OWNER_DECISION_2026-08-24` | `BUSINESS_RULES.md` `MAINTENANCE_RULE_002` |
| 5 | Dev | Tắt công tắc khoá → `NORMAL`; phiên admin của nhân viên tự hồi phục trong tối đa một chu kỳ (STOMP tức thì, poll 60 giây dự phòng) | `CONFIRMED_FROM_OWNER_DECISION_2026-08-24` | `DEPLOYMENT_GUIDE.md` §Maintenance runbook |
