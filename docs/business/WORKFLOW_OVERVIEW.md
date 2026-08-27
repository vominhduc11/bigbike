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

## Trợ lý BigBike — Sales And Staff Handoff Flow

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 1 | Guest/Customer | Trợ lý giữ cơ chế hỏi rõ giai đoạn 1 rồi đổi cách nói theo `BROWSING|CHOOSING|DECIDING|POST_PURCHASE`; mỗi lượt có một bước tiếp theo | `OWNER_CONFIRMED_2026-08-24` | `CHAT_RULE_034`–`038` |
| 2 | System | Nỗi lo dùng catalog/policy thật; bán kèm chỉ từ accessory relation, tối đa hai món còn hàng; thiếu dữ liệu thì nói thiếu | `OWNER_CONFIRMED_2026-08-24` | `CHAT_RULE_038`–`039` |
| 3 | Guest/Customer | Lời mời liên hệ chỉ hiện đúng thời điểm/lý do, tối đa hai; khách đăng nhập xác nhận số đã che thay vì nhập lại | `OWNER_CONFIRMED_2026-08-24` | `CHAT_RULE_012`, `CHAT_RULE_025` |
| 4 | Guest/Customer | Bấm/nói Gặp nhân viên → `WAITING`; trong giờ trợ lý tiếp tục cho đến khi có người nhận, ngoài giờ báo lần mở cửa kế tiếp và mời để lại liên hệ | `OWNER_CONFIRMED_2026-08-25` | `CHAT_RULE_040`, `CHAT_RULE_046` |
| 5 | System/Admin | Realtime + email báo staff; hàng chờ lâu nhất ở trên. Người có `chat.reply` bấm Tiếp nhận nguyên tử → `ACTIVE`, nhắn trực tiếp; trợ lý lùi | `OWNER_CONFIRMED_2026-08-25` | `CHAT_RULE_040`, `CHAT_RULE_045`, `PERMISSION_MATRIX.md` |
| 6 | Admin/System | Nhân viên bàn giao → `RETURNED_TO_AI` và trợ lý tiếp tục, hoặc đóng lịch sự → `CLOSED`; mọi đổi trạng thái hiện ngay cho khách | `OWNER_CONFIRMED_2026-08-25` | `CHAT_RULE_040`, `STATE_MACHINES.md` §15C |
| 7 | Guest/Customer | Click sản phẩm từ chat → chọn đúng biến thể còn hàng → add cart đã hậu kiểm → đi checkout; proof 168 giờ giữ attribution | `OWNER_CONFIRMED_2026-08-25` | `CHAT_RULE_041`, `CHAT_RULE_052` |
| 8 | Guest/Customer | Cùng thiết bị được nối ngữ cảnh 30 ngày; khách thấy/tắt/xóa được. Đăng nhập chỉ gộp lịch sử thiết bị hiện tại | `OWNER_CONFIRMED_2026-08-25` | `CHAT_RULE_049` |
| 9 | Owner | Xem feedback/trend/unanswered/data gap và mở thẳng editor câu chuẩn; preview/cảnh báo trước khi bật | `OWNER_CONFIRMED_2026-08-25` | `CHAT_RULE_048`, `CHAT_RULE_050` |
| 10 | Owner/System | Mở Cài đặt, tải danh sách model Gemini thật sự dùng được với tài khoản hiện tại, xem nhãn nhanh/chậm và rẻ/đắt, rồi đổi model trả lời; model kiểm duyệt đánh giá giữ độc lập | `OWNER_CONFIRMED_2026-08-26` | `CHAT_RULE_053` |
| 11 | Owner/System | Chạy bộ đề offline đã phiên bản hoá ngoài luồng khách thật, với trần chi phí 2 USD/lần; hệ thống lưu kết quả đúng số liệu/hiểu ý/không bịa/chịu thua/tốc độ/chi phí để so cạnh nhau, không chia đôi khách thật | `OWNER_CONFIRMED_2026-08-26` | `CHAT_RULE_054` |
| 12 | System | Mỗi lượt dùng model owner chọn trong giới hạn 35 giây cho model chính và 65 giây cho toàn lượt; lỗi/quá hạn thì lùi một lần sang model nhanh, vẫn trả lời và ghi telemetry/fallback để owner theo dõi | `OWNER_CONFIRMED_2026-08-26` | `CHAT_RULE_055`, `CHAT_RULE_056` |
| 13 | Owner | Sau khi chọn model tốt hơn, bật cho toàn bộ khách và theo dõi 14 ngày; so tỷ lệ chịu thua với mốc thật `5/58 ≈ 9%`, độ trễ và chi phí, rồi đổi ngược bằng Cài đặt nếu tệ hơn | `OWNER_CONFIRMED_2026-08-26` | `CHAT_RULE_056` |
| 14 | Guest/Customer | Khi owner đã bật đọc ảnh, khách thấy thông báo ảnh được gửi tới dịch vụ AI, chọn tối đa một JPG/PNG/WebP không quá 8 MB mỗi lượt, xem preview và gửi cùng câu hỏi | `OWNER_CONFIRMED_2026-08-26` | `CHAT_RULE_057`, `CHAT_RULE_059` |
| 15 | System | Backend kiểm MIME/nội dung, re-encode bỏ metadata, lưu kho MinIO riêng tư, áp trần 3 ảnh/hội thoại và 20 ảnh/ngày; ảnh không phù hợp hoặc vượt trần bị từ chối nhưng chat chữ vẫn dùng được | `OWNER_CONFIRMED_2026-08-26` | `CHAT_RULE_057`, `CHAT_RULE_059` |
| 16 | System/Guest | Hệ thống phân biệt tìm sản phẩm, hàng hỏng, hoá đơn/đơn hàng, hỏi size và ảnh ngoài phạm vi. Chỉ tìm trong hàng thật đang bán, chỉ nói “trông giống”, không đoán size/bảo hành/OCR/giá hay khẳng định cùng sản phẩm | `OWNER_CONFIRMED_2026-08-26` | `CHAT_RULE_058` |
| 17 | Admin/System | Người có `chat.read` xem được ảnh trong đúng hội thoại; xoá lịch sử hoặc hết 90 ngày sẽ xoá object riêng tư trước khi xoá metadata hội thoại. Người thiếu quyền không lấy được URL công khai hay nội dung ảnh | `OWNER_CONFIRMED_2026-08-26` | `CHAT_RULE_059`, `STATE_MACHINES.md` §15D |

### Admin chat reporting layout (owner decision 2026-08-26)

Màn `/admin/chat` hiển thị theo một mạch cuộn: tiêu đề/Cài đặt, cảnh báo chi phí tháng, hàng chờ nhân viên, bộ lọc ngày, hàng Hôm nay, danh sách hội thoại, Việc cần làm và các nhóm phân tích theo khoảng đã chọn. Hàng Hôm nay không đổi khi đổi bộ lọc. Danh sách hội thoại còn bảy cột; chi tiết hội thoại còn bảy dòng tóm tắt và bỏ telemetry số dưới từng câu trả lời nhưng giữ nguồn câu trả lời và toàn bộ thao tác nhân viên.

Các số kỹ thuật được xem ở Cài đặt → Trợ lý BigBike: token/request trong ngày, model thực tế trong tháng, latency trung bình và p50/p95 14 ngày, số/lý do fallback gần nhất, chi phí lập chỉ mục/chấm điểm. Câu hỏi bó tay, dữ liệu sản phẩm thiếu và feedback vẫn là nhóm Việc cần làm; dữ liệu sản phẩm thiếu giữ bảng từng sản phẩm và chỉ bỏ bốn ô đếm tổng.

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
| 1 | Dev | Mở màn Bảo trì hệ thống, ghi lời nhắn cho nhân viên. Nếu cần báo giờ, ghi giờ đó trong lời nhắn; không còn ô giờ dự kiến riêng | `CONFIRMED_FROM_OWNER_DECISION_2026-08-24` | `API_CONTRACT.md` §Maintenance API |
| 2 | Dev | Bật công tắc khoá → hộp xác nhận hiện số tệp đang tải lên dở dang; xác nhận thì chuyển `ACTIVE` | `CONFIRMED_FROM_OWNER_DECISION_2026-08-24` | `BUSINESS_RULES.md` `MAINTENANCE_RULE_007` |
| 3 | Hệ thống | Mọi thao tác ghi admin bị từ chối `423 MAINTENANCE_ACTIVE`; nhân viên (không phải dev) thấy hộp thông báo **che kín toàn màn** nên không thao tác được gì, kể cả tra cứu. Lời nhắn được hiển thị rõ trên màn hình khoá | `CONFIRMED_FROM_OWNER_DECISION_2026-08-24` | `BUSINESS_RULES.md` `MAINTENANCE_RULE_004`, `MAINTENANCE_RULE_007` |
| 4 | Khách hàng | **Không bị ảnh hưởng gì** — duyệt web, thêm giỏ và đặt hàng bình thường suốt thời gian khoá | `CONFIRMED_FROM_OWNER_DECISION_2026-08-24` | `BUSINESS_RULES.md` `MAINTENANCE_RULE_002` |
| 5 | Dev | Tắt công tắc khoá → `NORMAL`; phiên admin của nhân viên tự hồi phục trong tối đa một chu kỳ (STOMP tức thì, poll 60 giây dự phòng) | `CONFIRMED_FROM_OWNER_DECISION_2026-08-24` | `DEPLOYMENT_GUIDE.md` §Maintenance runbook |
