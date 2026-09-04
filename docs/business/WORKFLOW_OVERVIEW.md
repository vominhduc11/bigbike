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

## Post-purchase Review Invitation Workflow

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 1 | System | Ở callback scheduler đầu tiên sau khi bản mới triển khai, tự mở campaign/cutoff; tính năng mặc định bật. Công tắc khẩn duy nhất là `BIGBIKE_REVIEW_INVITATION_ENABLED`; khi tắt, campaign đóng và thư đang chờ bị bỏ qua, bật lại mở campaign mới không gửi bù. Delay cố định 7 ngày, trần cố định 20 lượt/ngày. | `OWNER_CONFIRMED_2026-09-01` | `REVIEW_RULE_014`, `REVIEW_RULE_016` |
| 2 | System, 04:30 giờ Việt Nam | Xếp lịch một lần cho mỗi đơn mới `COMPLETED` sau cutoff, không lấy đơn nhập cũ, đơn thiếu email, đơn hủy, email đã từ chối hoặc sản phẩm đã đánh giá. Đơn hoàn tiền không có nhánh loại trừ riêng. | `OWNER_CONFIRMED_2026-09-01` | `REVIEW_RULE_014`–`015` |
| 3 | System, 09:00–20:50 giờ Việt Nam | Mỗi 10 phút thử tối đa một thư, không vượt trần ngày; mọi lần thử đều lưu kết quả và không tự thử lại để không tạo thư trùng. Thư giao dịch tiếp tục dùng đường gửi hiện có và luôn được ưu tiên. | `OWNER_CONFIRMED_2026-08-31` | `REVIEW_RULE_016` |
| 4 | Guest/Customer | Nhận thư theo ngôn ngữ đã dùng lúc đặt, bấm đúng sản phẩm và hộp thoại đánh giá hiện có mở ngay; không cần đăng nhập. Review vẫn vào `PENDING` chờ duyệt như trước. | `OWNER_CONFIRMED_2026-08-31` | `REVIEW_RULE_009`, `REVIEW_RULE_015` |
| 5 | Guest/Customer | Bấm link từ chối trong thư, xác nhận không đăng nhập; email đó vĩnh viễn không nhận thêm thư mời đánh giá. | `OWNER_CONFIRMED_2026-08-31` | `REVIEW_RULE_016` |
| 6 | System | Không có màn hình quản trị cho thư mời hoặc danh sách từ chối. Ledger campaign/delivery/opt-out/quota vẫn lưu đầy đủ để hệ thống thực thi và chẩn đoán sự cố. | `OWNER_CONFIRMED_2026-09-01` | `REVIEW_RULE_014`–`016`, `DATA_CONTRACT.md` |

## Historical-order classification and daily operations

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 1 | Owner | Chạy dry-run trên máy chủ; lệnh chỉ tiếp tục khi dấu vết `legacy_id` khớp đúng 1.660 đơn, gồm 388 PENDING và 508 PROCESSING | `OWNER_CONFIRMED_2026-09-02` | `ORDER_RULE_013`, ops script |
| 2 | Owner | Chạy execute một lần để ghi đợt + thành viên vào sổ phân loại; chạy lại không nhân đôi và không sửa dòng `orders` | `OWNER_CONFIRMED_2026-08-31` | `ORDER_RULE_013`, `ORDER_RULE_014` |
| 3 | Sales staff | Mở Đơn hàng ở phạm vi Đơn vận hành mặc định; đổi sang Đơn lịch sử hoặc Tất cả khi tra cứu khách cũ. Đơn lịch sử có nhãn/lý do và chỉ đọc | `OWNER_CONFIRMED_2026-08-31` | `ORDER_RULE_014`, `ORDER_RULE_015` |
| 4 | System, 04:20 giờ Việt Nam | Tìm đơn vận hành vẫn PENDING cũ hơn ngưỡng owner đặt; không có đợt lịch sử active, setting lỗi hoặc danh sách rỗng thì no-op | `OWNER_CONFIRMED_2026-08-31` | `ORDER_RULE_015`, `NOTIFICATION_RULE_002` |
| 5 | System | Nếu có đơn đủ điều kiện, tạo đúng một bản tin trong chuông, ghi ngày chạy + từng đơn đã nhắc; không thông báo lẻ và không lặp đơn ở ngày sau | `OWNER_CONFIRMED_2026-08-31` | `NOTIFICATION_RULE_002` |
| 6 | Owner | Khi cần hoàn tác, tắt đợt phân loại bằng batch key; membership/audit giữ nguyên, toàn bộ đơn hàng tiếp tục không bị sửa | `OWNER_CONFIRMED_2026-08-31` | `ORDER_RULE_013`, `ORDER_RULE_014` |

## Trợ lý BigBike — tư vấn và tự liên hệ shop (owner decision 2026-08-30)

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 1 | Guest/Customer | Trợ lý tư vấn hàng thật theo giai đoạn nhu cầu: chọn/so sánh sản phẩm, size, giá, còn hàng, chính sách, thông tin shop và đơn của chính khách đăng nhập. | `OWNER_CONFIRMED_2026-08-30` | `CHAT_RULE_001`–`020`, `034`–`039` |
| 2 | System | Mỗi lượt cần AI dùng duy nhất Gemini 3.7 Flash, trong trần 400 lượt/ngày và 40 lượt/hội thoại cố định. Fast-path không dùng AI; chạm trần thì mở hội thoại nối tiếp. | `OWNER_CONFIRMED_2026-08-30` | `CHAT_RULE_006`, `009`, `010`, `019` |
| 3 | System | Nếu Gemini lỗi/quá tải, hệ thống thử lại chính model trong deadline 65 giây và tối đa bốn lần gọi. Vẫn lỗi thì trả lời xin lỗi kèm các kênh liên hệ trực tiếp; không đổi model và không tạo yêu cầu người thật. | `OWNER_CONFIRMED_2026-08-30` | `CHAT_RULE_011`, `019` |
| 4 | Guest/Customer | Khách gặp giới hạn, thiếu dữ liệu hoặc cần trao đổi ngoài phạm vi được mời tự liên hệ qua Hotline, Zalo hoặc Messenger. Bấm liên hệ chỉ mở thẻ/kênh shop, không tạo hàng chờ. | `OWNER_CONFIRMED_2026-08-30` | `CHAT_RULE_008`, `011`, `034`–`039` |
| 5 | Guest/Customer | Khách có thể gửi tối đa một ảnh/lượt, ba ảnh/hội thoại, 20 ảnh/ngày, tối đa 8MB và chỉ JPG/PNG/WebP. Khi dịch vụ AI chưa khai báo, nút ảnh tự ẩn. | `OWNER_CONFIRMED_2026-08-30` | `CHAT_RULE_057`–`059` |
| 6 | Guest/Customer | Khách bấm thẻ sản phẩm, chọn biến thể còn hàng và thêm vào giỏ; backend hậu kiểm giá, tồn và biến thể trước khi thêm. | `OWNER_CONFIRMED_2026-08-30` | `CHAT_RULE_014`, `052` |
| 7 | Guest/Customer | Cùng thiết bị được nối ngữ cảnh 30 ngày; khách thấy, tắt hoặc xóa được. | `OWNER_CONFIRMED_2026-08-30` | `CHAT_RULE_049` |

### Màn quản trị chat

Màn `/admin/chat` chỉ giữ danh sách, chi tiết transcript chỉ đọc, xem ảnh, bộ đếm “hôm nay đã dùng bao nhiêu lượt AI trên trần” và các chỉ số chất lượng còn phục vụ trực tiếp việc tư vấn. Không còn hàng chờ, nhận việc, trả lời khách, trả lại AI, email/chuông handoff, khu vực chọn/so sánh model, chấm model, chi phí/độ trễ/fallback theo model, phễu liên hệ, gắn đơn, phản hồi câu trả lời, câu bó tay hoặc dữ liệu sản phẩm thiếu.
## Account Login Workflow

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 1 | Guest | Open `/dang-nhap` or `/dang-ky` as separate legacy-parity pages; registration remains a separate route, not an in-place auth tab | `CONFIRMED_FROM_CODE` | live legacy URLs `/dang-nhap.html`, `/dang-ky.html`, current `page.tsx`, `LoginForm.tsx`, `RegisterForm.tsx`; raw local export permanently unavailable |
| 1a | Guest | All four authentication routes (login, registration, password reset and email confirmation) use the same white, full-screen shell without storefront navigation, logo, language switch or policy footer. They share title placement, form width, spacing, error treatment and the guest exit. On wide screens the existing account-benefits panel remains and its content is vertically centred; below that breakpoint only the form is shown and is vertically centred on tablet. Registration is a single, scrollable column on phones; no label or action may be clipped to force it into one viewport. | `OWNER_CONFIRMED_2026-09-01` | Owner decision 2026-09-01; `AuthPageFrame` and auth route layout |
| 1b | Guest | Every authentication route provides a clearly separated “continue as guest” exit. It returns to the approved public page in `tiep` when one exists; a missing, authentication, customer-account or unsafe/external destination returns to the localized home page. This exit does not authenticate the guest or call the server. | `OWNER_CONFIRMED_2026-08-30` | Owner decision 2026-08-30; public guest browsing/checkout remains available |
| 2a | Guest | Sign in with email/phone + password; "Ghi nhớ" keeps the session for 30 days (vs 1 day when unchecked). Incorrect credentials clear and refocus the password field and appear as a prominent warning. A `429` login response tells the guest to wait for the server-supplied retry period; network and system failures use distinct wording. | `OWNER_CONFIRMED_2026-09-01` | Owner decision 2026-09-01; `CustomerAuthService.login`, `CustomerSessionService` |
| 2b | Guest | Create a password account only after explicitly agreeing to the localized Privacy Policy. The server records policy version `2026-08-27`, acceptance time and UI locale with the new account; no Terms page is implied by this checkbox. | `OWNER_CONFIRMED_2026-08-27` | `CUSTOMER_RULE_011`, `CustomerAuthService.register`, `customer_privacy_consents` |
| 2c | Guest | Or continue with **Google or Facebook**. Both buttons remain on login and registration pages. A new account may be created only from the registration path after the same Privacy Policy agreement; an existing linked identity signs in normally. | `OWNER_CONFIRMED_2026-08-27` | `SocialLoginButtons.tsx`, `CustomerOAuthService.linkOrCreate`, `CUSTOMER_RULE_011` |
| 2d | System | A social failure returns to the localized login page with a readable reason; the specific no-consent/new-account case returns to localized registration so the customer can agree and retry. No blank page, customer, or session is created for that case. | `OWNER_CONFIRMED_2026-08-27` | `OAuthError.java`, `lib/auth/oauth-error.ts`, `CustomerOAuthController` |
| 2e | Guest | The storefront registration form requires a full name, email, Vietnamese mobile phone, password confirmation and Privacy Policy agreement. It accepts the approved phone display separators and country prefixes, then shows the canonical local number only to the system. Field errors appear after leaving a field; submit focuses the first remaining invalid field and announces a form summary. | `OWNER_CONFIRMED_2026-09-01` | Owner decision 2026-09-01; `CUSTOMER_RULE_012` |
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
| 5 | System | Media mới gắn vào Product/Content/Brand/Category/Slider/Settings tự vào thư mục nếu chưa được chủ động xếp trước; không đoán từ tên tệp và không ghi đè lựa chọn thủ công | `OWNER_CONFIRMED_2026-08-30` | `MEDIA_RULE_014`, `MediaAutoFolderService` |

## Homepage YouTube Video Workflow

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 1 | Owner (`settings.read`/`settings.write`) | Xem hoặc đổi “Kênh YouTube chính thức” ngay trên màn Video trang chủ; giá trị lưu ở `youtube_url` | `OWNER_CONFIRMED_2026-08-31` | `HOME_VIDEO_RULE_001`, `HomeVideoListScreen.jsx` |
| 2 | System, 04:10 giờ Việt Nam | Đọc trang kênh/feed công khai, xác minh đúng kênh và tối đa 15 video mới nhất; mọi lỗi hoặc dữ liệu không chắc chắn kết thúc bằng no-op | `OWNER_CONFIRMED_2026-08-31` | `YouTubeHomeVideoClient`, `HomeVideoSyncScheduler` |
| 3 | System | Bỏ qua mọi mã YouTube đã có trong kho, không bật lại bản ghi đã tắt; tạo video mới với tiêu đề YouTube, EN/thumbnail riêng để trống và chèn mới nhất lên đầu | `OWNER_CONFIRMED_2026-08-31` | `HOME_VIDEO_RULE_002`, sync tests |
| 4 | System | Kiểm tra đủ các ứng viên có thể lên 10 vị trí; video chắc chắn đã xoá/ẩn chuyển sang tắt, không xoá; public trả tối đa 10 video hợp lệ | `OWNER_CONFIRMED_2026-08-31` | `HOME_VIDEO_RULE_003`, API tests |
| 5 | Admin (`home_videos.write`) | Tiếp tục thêm/sửa/tắt/xếp tay; kéo video đang bật vào 10 vị trí đầu để đưa lên trang chủ, tắt để gỡ và lần chạy sau không tự bật lại | `OWNER_CONFIRMED_2026-08-31` | `HomeVideoListScreen.jsx` |

## Product Authoring & Live Preview Workflow

## Daily Out-of-stock Digest Workflow

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 1 | Owner (`settings.read`/`settings.write`) | Bật/tắt và chọn giờ bản tin tại Cài đặt › Cảnh báo hết hàng; mặc định bật lúc 08:00 giờ Việt Nam | `OWNER_CONFIRMED_2026-08-31` | `STOCK_ALERT_RULE_002` |
| 2 | System | Đến giờ, lấy một ảnh chụp chỉ gồm sản phẩm đang bán; loại nháp/ẩn/thùng rác/ngừng kinh doanh và không thay đổi trạng thái món nào | `OWNER_CONFIRMED_2026-08-31` | `STOCK_ALERT_RULE_001`, `STOCK_ALERT_RULE_003` |
| 3 | System | Nếu danh sách trống thì im lặng. Nếu có, tạo đúng một bản tin chia “Hết sạch” và “Thiếu cỡ hoặc màu”, xếp lâu nhất trước và lưu mốc ngày đã chạy để không lặp | `OWNER_CONFIRMED_2026-08-31` | `STOCK_ALERT_RULE_002`, `STOCK_ALERT_RULE_005` |
| 4 | System | Đưa cùng ảnh chụp vào chuông quản trị và gửi một email song ngữ đến hộp thư nội bộ hiện có; không fan-out và không tự thử gửi lại trong ngày | `OWNER_CONFIRMED_2026-08-31` | `STOCK_ALERT_RULE_003`, `STOCK_ALERT_RULE_006` |
| 5 | Sales staff (`inventory.read`) | Mở từng dòng để đi thẳng tới màn sửa sản phẩm, tự quyết định nhập hàng/đổi trạng thái/ẩn; hệ thống không làm thay | `OWNER_CONFIRMED_2026-08-31` | `STOCK_ALERT_RULE_003`, `STOCK_ALERT_RULE_005` |


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

**Biểu tượng danh mục trong header (owner decision 2026-08-29):** chỉ 10 mục danh mục cấp 1 dưới
“Tất cả sản phẩm” được hiển thị biểu tượng. Biểu tượng lấy từ `category.image`, tô theo màu chữ và
hiển thị trong khung 24×24px ở cả máy tính lẫn điện thoại; không làm dòng menu cao thêm. Danh mục cấp
2/cấp 3 không hiện biểu tượng. Danh mục cấp 1 chưa có ảnh vẫn giữ tên và đường dẫn trong menu.

**Mobile/tablet/desktop hẹp (<1280px):** Giữ nguyên accordion (`MobileHeaderMenu`) qua nút hamburger; quy tắc nguồn và khung 24×24px của biểu tượng nêu trên cũng áp dụng trong ngăn kéo. Khối thông tin liên hệ đi cùng ngăn kéo này; trên desktop rộng không có ngăn kéo thông tin liên hệ riêng.

**Lý do khác WP gốc (WP dùng flyout dọc):** UX > bám WP khi menu sâu 4 cấp. Quyết định này do chủ dự án xác nhận ngày 2026-05-27.

**Giới hạn cũ đã được sửa (ghi nhận 2026-06-16, gỡ note 2026-07-15 — AUD-076):** trang category cha nay hiển thị cả sản phẩm của mọi category con (`CATEGORY_RULE_006` — `CatalogReadService.resolveCategorySlugsWithDescendants` + `matchesCategoryOrDescendants`), không còn tình trạng trang cha rỗng khi sản phẩm chỉ gắn vào category con.

## Address Workflow

| Step | Actor | Current flow | Status | Evidence |
|---|---|---|---|---|
| 1 | Web | Đọc danh sách 34 tỉnh/thành từ dữ liệu tích hợp sẵn `VN_PROVINCES` | `CONFIRMED_FROM_CODE` | `vn-address-data.ts`, `VnAddressFields.tsx` |
| 2 | Web | Khi chọn tỉnh/thành, hiển thị trực tiếp phường/xã thuộc tỉnh; không có bước quận/huyện | `CONFIRMED_FROM_CODE` | `VnAddressFields.tsx` |

API địa chỉ backend (`GET /api/v1/address/provinces[...]`) đã gỡ 2026-07-15 (AUD-056, owner decision #8 — web/admin không gọi, không có client ngoài); nguồn dữ liệu duy nhất là `VN_PROVINCES` tích hợp trong web. Field `district` chỉ là dữ liệu lịch sử, không được thu thập cho địa chỉ mới — xem `DATA_CONTRACT.md` §Address fields.

## Manual Maintenance Workflow — removed 2026-08-30

Không còn workflow bật/tắt hoặc khóa trang quản trị thủ công. Từ 30/08/2026, nhân viên dùng admin bình thường; tài khoản kỹ thuật `vominhduc760@gmail.com` mang vai trò `ADMIN` sau migration `V1071`.

Khách hàng không bị ảnh hưởng: duyệt web, thêm giỏ và đặt hàng vẫn đi qua workflow thương mại hiện hành. Khi upstream thật sự không phản hồi, Nginx vẫn tự phục vụ trang lỗi tĩnh trong `deploy/maintenance/`; đây là fallback hạ tầng độc lập, không phải workflow nghiệp vụ.
