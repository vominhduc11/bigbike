# Tiến độ sửa lỗi theo AUDIT_2026-07-15_FINAL — 77 mục

> **Session sửa lỗi cập nhật file này ngay sau khi xong TỪNG mục** (không dồn về cuối). Session tiếp nối đọc file này trước và làm tiếp từ mục ⬜ kế tiếp theo thứ tự phase.
>
> Ký hiệu trạng thái: ⬜ chưa làm · 🔧 đang làm · ✅ xong (ghi commit hash) · ⏭ bỏ qua (ghi lý do) · ❓ chờ user quyết/kiểm tra.
>
> Nguồn finding: [`AUDIT_2026-07-15_FINAL.md`](./AUDIT_2026-07-15_FINAL.md) · Quyết định owner: [`FIX_PROMPT_2026-07-15.md`](./FIX_PROMPT_2026-07-15.md) §2.

## Phase 0 — Blocker

| AUD | Việc | Trạng thái | Ghi chú |
|---|---|---|---|
| AUD-001 | Đổi email phải hủy trạng thái xác minh; không tự liên kết guest order tới khi xác minh lại; sau đó rà dữ liệu read-only | ✅ `4aef1f7f` | Vá `CustomerAuthService.updateProfile` (reset `emailVerifiedAt` + gửi lại email xác minh) và `AdminCustomerService.updateCustomer` (reset khi admin đổi email hộ). Thêm TC10 vào `GuestOrderLinkingTest` — 10/10 pass. Docs: API_CONTRACT thêm `GET/PATCH /customer/me` + rule reset. **Rà dữ liệu (SELECT read-only, container `bigbike-postgres`):** 0 audit log đổi email bởi admin; 131 đơn linked lệch email đều là import WordPress (`legacy_id NOT NULL`), không phải do bug; chỉ 1 khách có 7 đơn linked native — email khớp, đã xác minh, không có dấu hiệu bị khai thác. Lưu ý: đây là DB local đang chạy; nếu DB production trên VPS khác bản này thì cần chạy lại cùng bộ SELECT ở đó. |

## Phase 1A — High: Đơn hàng, giá, tồn kho

| AUD | Việc | Trạng thái | Ghi chú |
|---|---|---|---|
| AUD-002 | Quick-buy không được ghép sản phẩm A với biến thể B | ✅ `c1a1b862` | `CheckoutService.quickBuy` kiểm tra variant thuộc đúng product (404 nếu lệch) + test `quickBuy_variantOfAnotherProduct_returns404` |
| AUD-003 | `forceOutOfStock` phải chặn mua ở cart + checkout (cả biến thể) | ✅ `c1a1b862` | Check cấp product trước nhánh variant ở `CartService.addItem`/`validateQuantityAgainstStock`, `CheckoutService.quickBuy`/`validateCartAgainstStock` (STOCK_RULE_004) + 3 test mới |
| AUD-007 | Checkout từ chối đơn thiếu tỉnh/phường hoặc địa chỉ giao rỗng | ✅ `c1a1b862` | `@NotBlank` province/ward trên DTO + `validateAddress` (cả shipping đã resolve); fallback shipping coi chuỗi rỗng như null; test missingProvince/missingWard/blankShipping |
| AUD-010 | Bổ sung điểm vào "Mua nhanh" trên web theo docs | ✅ `c1a1b862` | Nút MUA NHANH trên PDP (`BuyButtons`) mở `QuickBuyDialog.tsx` mới — tái dùng `CheckoutAddressFields`+`CodPaymentBlock`, gửi `submitQuickBuy` với COD + idempotency key; xóa schema quick-buy mồ côi |
| AUD-011 | Trang đặt hàng hiển thị cố định 1 phương thức COD + gửi/lưu `COD` | ✅ `c1a1b862` | Quyết định #10: web gửi `paymentMethod:"COD"`; backend normalize null→COD, reject BACS, options chỉ COD, bỏ nhánh BACS→ON_HOLD; docs PAY_RULE_001/002 + ORDER_RULE_002 + API_CONTRACT + MODULE_CATALOG cập nhật cùng commit |
| AUD-016 | Admin list đơn hiển thị đúng trạng thái fulfil (bổ sung field DTO) | ✅ `c1a1b862` | `AdminOrderListItemResponse` thêm `fulfillmentStatus`+`fulfillmentType` (MapStruct tự map); admin contracts.js đã normalize sẵn |

## Phase 1B — High: Nội dung, media, song ngữ, SEO

| AUD | Việc | Trạng thái | Ghi chú |
|---|---|---|---|
| AUD-004 | Xóa vĩnh viễn bài viết không được xóa object MinIO còn nơi khác dùng | ✅ `6d12c864` | `MediaReferenceService.isObjectKeyReferencedOutsideArticle` quét media/products (image+gallery+blocks)/variants/categories/brands/home_videos/sliders/reviews/settings + articles khác; `hardDeleteArticle` chỉ xóa object không còn ai tham chiếu; object thuộc Media Library (còn dòng `media`) không bao giờ xóa qua đường này |
| AUD-008 | Auto slug redirect phải có loop check + cache invalidation | ✅ `6d12c864` | `SlugRedirectHelper`: guard self-loop, xóa redirect FROM URL mới sống lại (chặn A→B→A), canonicalize path, gọi `revalidateRedirects()` như luồng admin |
| AUD-012 | Sửa 2 route hướng dẫn đang trả 404 | ✅ `6d12c864` | Không bịa nội dung: 301 `/huong-dan/mua-hang/`(+biến thể legacy)→`/huong-dan/`; `/huong-dan/size-gang-tay/`→`/huong-dan/size-trang-phuc/` (đã gồm găng tay). Docs BUSINESS_RULES ghi bộ 2 trang con hiện hành |
| AUD-013 | Trang tĩnh kích hoạt đúng nội dung EN khi chuyển ngôn ngữ | ✅ `6d12c864` | Component mới `LocaleSwitch` (server render sẵn 2 nhánh VI/EN, client chọn theo locale — giữ ISR); áp cho GuidePage + PolicyPage. Lưu ý: `bodyEn` của cả 5 trang tĩnh đang RỖNG → EN fallback VI theo thiết kế; muốn EN thật phải soạn nội dung (việc owner) |
| AUD-014 | List sản phẩm/thương hiệu/tin tức EN refetch đúng ngôn ngữ | ✅ `6d12c864` | Chỉ seed initialData cho key `vi` (pattern ProductView) ở CatalogClient/BrandListClient/ArticleListClient — key `en` luôn fetch tươi |
| AUD-015 | Sitemap/route EN nhất quán (trang EN crawl được độc lập) | ✅ `6d12c864` | Sitemap chỉ khai URL VI canonical, bỏ toàn bộ entry/alternates EN (EN là trải nghiệm client-side, alias EN bị proxy 307 với crawler — khai lên chỉ tạo redirect/duplicate). Nếu sau này dựng routing EN độc lập thì thêm lại |
| AUD-063 | Gỡ 3 vị trí slider khỏi admin, chỉ giữ `home`; không xóa data cũ | ✅ `6d12c864` | Quyết định #4: admin bỏ filter + Select vị trí (màn chỉ còn home); backend reject vị trí ≠ home cho create/patch-đổi-vị-trí (data cũ giữ nguyên); dọn locale keys + preset `sliderMobile`; docs API_CONTRACT/DATA_CONTRACT cập nhật; test `createSlider_rejectsNonHomeLocation` |

## Phase 1C — High: Bảo mật, cấu hình hạ tầng

| AUD | Việc | Trạng thái | Ghi chú |
|---|---|---|---|
| AUD-009 | Compose bind 127.0.0.1 cho backend/MinIO; KHÔNG tự restart | ✅ `d4847b9e` | Bind `127.0.0.1` cho backend:8080, MinIO:9000 (+9001), và luôn cả web:3000/admin:4000 (comment sẵn ghi loopback-only nhưng thực tế bind mọi interface — cùng lỗ hổng bypass nginx). `docker compose config` pass. **CHƯA restart** — user tự áp dụng; lưu ý nginx trên VPS phải proxy qua 127.0.0.1 (không qua IP bridge) |
| AUD-020 | Nâng dependency web có advisory (3 High + 10 thấp hơn) | ✅ `d4847b9e` | `npm audit fix` + next 16.2.4→16.2.10 (cùng major) + esbuild 0.27.7→0.28.1, undici/vite vá theo range. Từ 16 advisory (4 High) còn **2 moderate upstream-only** (postcss đóng gói bên trong next — "fix" của npm là downgrade next về 9.x, không hợp lệ; chờ bản next mới). Test 208/208 + lint + build pass |
| AUD-061 | Thêm biến invite URL admin vào compose + `.env.example` | ✅ `d4847b9e` | Compose forward `BIGBIKE_MAIL_ADMIN_INVITE_BASE_URL` (+ `BIGBIKE_MAIL_FROM_NAME` cũng bị sót) vào backend; `.env.example` đã có sẵn biến này từ trước |
| AUD-062 | Truyền 6 biến OAuth Google/Facebook qua compose + `.env.example` | ✅ `d4847b9e` | Compose forward đủ 6 biến `OAUTH_*` vào backend; `.env.example` đã có sẵn. User cần điền `.env` thật rồi khởi động lại stack |

## Phase 1D — High: Email đơn & thông báo admin

| AUD | Việc | Trạng thái | Ghi chú |
|---|---|---|---|
| AUD-005 | GỠ scheduler tự hủy BACS 72h + cập nhật docs | ✅ `7e96af4d` | Quyết định #2: xóa `OrderAutoCancelService`+`OrderAutoCancelScheduler` + query `findBacsUnpaidOnHoldOlderThan`; xóa 4 test auto-cancel + field autowire; docs thêm `ORDER_RULE_009` (không auto-cancel, admin tự xử lý) |
| AUD-006 | Email hủy đơn bỏ lời hứa "hoàn tiền 3–5 ngày" | ✅ `7e96af4d` | `OrderNotificationService` CANCELLED: bỏ "hoàn tiền trong 3–5 ngày làm việc", đổi thành "BigBike sẽ chủ động liên hệ để hoàn lại tiền" + hotline |
| AUD-017 | Cache thông báo không lộ chéo giữa tài khoản trên cùng trình duyệt | ✅ `7e96af4d` | localStorage namespace theo email (`bb-admin-notifications:{email}`); chuông chỉ render/fetch khi có `orders.read`; reset-state khi đổi tài khoản (render-phase) |
| AUD-018 | Trạng thái đã-đọc thông báo tách riêng từng admin | ✅ `7e96af4d` | Bảng mới `admin_notification_reads` (V339, high-water mark per admin); service tính `isRead`/`unreadCount` theo `last_read_at` của riêng admin; cột `is_read` cũ giữ lại không dùng |
| AUD-019 | Mở chuông không mark-all-read toàn DB / không mất backlog | ✅ `7e96af4d` | `markAllReadFor(adminId)` chỉ dời mốc của admin đó, không sửa bản ghi chung; GET trả backlog gần nhất (≤50) kèm `isRead` per-admin — không mất lịch sử. Test `AdminNotificationServiceTest` 3/3. **Gỡ luôn** endpoint `mark-read` (AUD-067) không caller |

## Phase 2A — Medium: khách hàng & vận hành

| AUD | Việc | Trạng thái | Ghi chú |
|---|---|---|---|
| AUD-021 | Giỏ hàng hiển thị "Miễn phí vận chuyển" theo SHIP_RULE_001 | ✅ `080c5ac4` | Đã hết từ trước: `CartSummary` dùng `CartPage.shippingPending` = "Miễn phí vận chuyển toàn quốc" (shippingAmount luôn 0). Verify tại `CartSummary.tsx:41-50` |
| AUD-022 | Bỏ miễn CSRF cho checkout/quick-buy theo docs | ✅ `c1a1b862` | Làm sớm cùng nhóm 1A (chung file test): gỡ 2 exemption khỏi `CustomerCsrfFilter`; guest luôn có `bb_csrf` từ GET /cart app-wide; test CSRF Phase1F pass lại |
| AUD-023 | Mark PAID→UNPAID không để lại payment row `SUCCEEDED` | ✅ `080c5ac4` | `updatePaymentStatus` nhánh UNPAID reset payment record về `PENDING`+`paidAt=null`; test `updatePaymentStatus_paidToUnpaid_resetsPaymentRecord` |
| AUD-024 | `ON_HOLD → PROCESSING` không tự đánh dấu BACS là PAID | ✅ `080c5ac4` | Gỡ khối auto-mark PAID + constant `MANUAL_CONFIRM_PAYMENT_METHODS`; đơn giữ UNPAID, admin đối soát riêng (PAY_RULE_002); test `order_onHoldToProcessing_doesNotAutoMarkPaid` |
| AUD-025 | Khách hủy đơn: WS + inbox admin + audit log + email cho khách | ✅ `c058c226` | Quyết định #3: `CustomerOrderCancelService.cancel` phát `ORDER_STATUS_CHANGED` qua `AdminOrderWsService` (WS + persist inbox), ghi audit `ORDER_CANCELLED_BY_CUSTOMER` (actor CUSTOMER), gửi email hủy (`sendOrderStatusUpdate` after-commit). Test audit-log trong Phase1G; docs API_CONTRACT customer-cancel |
| AUD-026 | Bản ghi thông báo offline đủ tên khách + giá trị đơn | ✅ `7e96af4d` | Làm sớm cùng 1D (chung file): `buildPayload` thêm `customerName`+`total`; admin `normalizeAdminNotification` đọc ra để hiển thị |
| AUD-027 | Search suggest tôn trọng `lang`; link EN đúng slug/route | ✅ `a169635a` | Backend tìm + localize sản phẩm/bài viết theo `lang` (fallback từng field về VI); web dùng `slugEn` cho URL EN và fallback slug VI. Test liên quan 8/8; toàn web 210/210, lint 0 lỗi/6 warning cũ, build 37 trang. Backend test mới pass; full suite chạy 1.037 test còn 38 lỗi stale/không liên quan, tiếp tục xử lý ở AUD-046. Docs: API_CONTRACT cập nhật contract `search-suggest`. |
| AUD-028 | PDP tiếng Anh fallback về VI thay vì mất field | ⬜ | |
| AUD-029 | Option hết hàng vẫn xem được (không disable chọn để xem ảnh) | ✅ `080c5ac4` | `VariantPicker` bỏ `disabled`/`optSelectable` — mọi option chọn được để xem ảnh; chỉ làm mờ báo hết hàng; chặn mua ở nút mua (canBuy) |
| AUD-030 | Gỡ filter `REFUNDED` ở web + sửa copy hủy đơn (không nói hoàn tồn) | ✅ `080c5ac4` | Bỏ `REFUNDED` khỏi `STATUS_FILTERS` (OrderHistoryContent); copy `cancelDescription` VI/EN bỏ "tồn kho hoàn lại" → "BigBike liên hệ hoàn tiền"; docs API_CONTRACT customer-cancel + ORDER_RULE_004 bỏ "restores stock" (quyết định #7) |
| AUD-031 | Canonical trang chính sách trỏ route thực sự được build | ✅ `6d12c864` | Làm sớm cùng 1B (chung file với AUD-013): sửa 4 `seoCanonicalUrl` trong static-pages.json về route thực; `/chinh-sach` chỉ build đúng 3 slug chính sách (quyết định #6); 301 các canonical cũ chưa từng build về route thực |
| AUD-032 | Form đánh giá gửi email khách đã nhập | ✅ `d7fefc10` | `SubmitReviewRequest` thêm `authorEmail` (@Email); controller+service lưu vào `reviews.author_email`; web `WriteReviewForm` gửi `authorEmail` trong payload |
| AUD-033 | Checkout/account: chuỗi + hotline/địa chỉ theo locale/settings | ⬜ | |
| AUD-034 | Xóa vĩnh viễn danh mục: cảnh báo đủ số sản phẩm + danh mục con | ⬜ | |
| AUD-035 | Đổi VI/EN không làm mất draft Home Highlights | ⬜ | |
| AUD-036 | HTML setting chặn ảnh ngoài/track pixel theo rule MinIO | ✅ `67f1e606` | `SettingValueValidator` type HTML thêm `validateHtmlImageSources`: quét `<img src>`/`srcset`/CSS `url()` — mọi ảnh phải qua `isAllowedImageUrl` (MinIO/media nội bộ); reject host ngoài + `data:` URI (chặn hotlink/pixel). 4 test mới |
| AUD-037 | Upload ảnh review không tạo orphan MinIO (cleanup) | ✅ `d7fefc10` | `ReviewPhotoStorageService.deletePhotos` (best-effort, chỉ đụng object dưới `reviews/`); `AdminReviewService.deleteReview` gọi xóa ảnh MinIO của review bị xóa → hết orphan theo vòng đời review. Ghi chú: orphan do khách upload rồi bỏ dở (chưa submit) cần một đợt quét định kỳ — để lại follow-up (không thêm scheduler mới trái hướng dự án) |
| AUD-038 | Ảnh line item snapshot theo đơn, không lấy live từ catalog | ✅ `67f1e606` | Thêm cột `order_line_items.image_url` (V340) + field entity; snapshot ảnh lúc checkout (cart: `productImageUrl`; quick-buy: ảnh variant→product); `OrderReadService` đọc snapshot, chỉ fallback live cho đơn cũ (null). Đơn giữ đúng ảnh đã mua kể cả khi SP đổi/xóa |
| AUD-064 | Video mô tả/bài viết nhận YouTube/TikTok/Facebook theo AGENTS §14.3 | ⬜ | Reject link rút gọn |
| AUD-065 | Giỏ đánh dấu "không khả dụng" cho sản phẩm no-variant hết hàng | ✅ `c1a1b862` | Làm sớm cùng AUD-003 (cùng file, audit khuyến nghị): `findUnavailableItemIds` mirror đúng điều kiện checkout (published + !forceOutOfStock + stockState với SP không biến thể) |

## Phase 2B — Medium: tài liệu chuẩn

| AUD | Việc | Trạng thái | Ghi chú |
|---|---|---|---|
| AUD-039 | Gỡ wishlist/comparison đã bỏ khỏi docs | ⬜ | |
| AUD-040 | Docs address theo mô hình 2 cấp tỉnh/thành → phường/xã | ⬜ | |
| AUD-041 | Chốt 3 trang chính sách tĩnh, admin không quản lý — sửa docs | ⬜ | Quyết định #6 |
| AUD-042 | Thống nhất quyền sửa tồn kho (`products.update` vs `inventory.write`) | ⬜ | |
| AUD-043 | Thống nhất rule WebSocket (role vs `orders.read`) theo code thực tế | ⬜ | |
| AUD-044 | Dọn docs theo mô hình Còn/Hết thủ công + COD duy nhất | ⬜ | Quyết định #7, #10 |
| AUD-045 | State machine + migration/version notes hết mâu thuẫn/stale | ⬜ | |
| AUD-046 | Sửa test backend khóa contract cũ (quantity/refund/CSRF/auto-paid) | 🔧 `c1a1b862` | Đã sửa cùng nhóm 1A: quantity-decrement (Phase1F/1H), refund (Phase1H — xóa toàn bộ test POST /refund + REFUNDED status), CSRF (đi cùng AUD-022), shippingItems (Phase1G), địa chỉ 2 cấp trong template. Còn lại: test auto-cancel BACS (xóa cùng AUD-005), test auto-paid ON_HOLD→PROCESSING (sửa cùng AUD-024) |
| AUD-048 | ARCHITECTURE bỏ wishlist + mô tả account pages đúng build | ⬜ | |

## Phase 3A — Low: lỗi nhỏ rõ ràng

| AUD | Việc | Trạng thái | Ghi chú |
|---|---|---|---|
| AUD-049 | `.env.example` link reset/verify về localhost | ⬜ | |
| AUD-050 | Biến extra MinIO origin đi qua Docker; bỏ default IP cũ | ⬜ | |
| AUD-051 | Filter trả đúng chuẩn error envelope | ⬜ | |
| AUD-052 | Email chào bằng tên khách khi đơn có tên | ✅ `7e96af4d` | Làm sớm cùng AUD-006 (cùng file `OrderNotificationService`): `safeCustomerName` ưu tiên `customerName` trước email/SĐT |
| AUD-053 | Đồng bộ model/schema `paymentMethod` nullable | ⬜ | Lưu ý quyết định #10 |
| AUD-054 | Sửa encoding comment importer | ⬜ | |
| AUD-059 | Ghi chú hệ thống checkout không thành "Đơn hàng được tạo.." | ✅ `c1a1b862` | Làm sớm cùng AUD-011 (cùng đoạn code): note luôn "Đơn hàng được tạo. Phương thức thanh toán: COD." — hết dấu chấm kép |
| AUD-069 | Sửa/xóa SĐT khách không hợp lệ: báo lỗi thay vì im lặng bỏ qua | ⬜ | |
| AUD-070 | `rowKey` import không trùng khi 2 dòng cùng SKU | ⬜ | |
| AUD-071 | Xóa trắng ô SEO thương hiệu phải được lưu | ⬜ | |
| AUD-072 | API path không tồn tại trả 404 thay 500 | ⬜ | |
| AUD-073 | Admin reviews tôn trọng tham số `lang` | ✅ `d7fefc10` | Hành vi hiển thị đã đúng: admin đổi cột tên SP theo `productNameEn`/`productName` (client, PRODUCT_RULE_004 — hiện đủ bản ghi, không ẩn SP chưa dịch); review là nội dung khách nhập nên đơn ngữ. Dọn dead `strictEnglish` + comment stale (backend/admin); `lang` giữ cho tương thích API, no-op theo thiết kế |
| AUD-075 | Toaster dùng token font; nút nguy hiểm dùng token danger | ⬜ | |

## Phase 3B — Low: dọn dead code / API thừa

| AUD | Việc | Trạng thái | Ghi chú |
|---|---|---|---|
| AUD-055 | Dọn tàn dư quantity/serial/wishlist/coupon/comparison/refund/shipping/POS | ⬜ | |
| AUD-056 | Gỡ endpoint không consumer (grep 0 caller từng cái trước khi xóa) | ⬜ | Quyết định #8 |
| AUD-057 | Web: dọn raw controls / arbitrary values trong active UI/CSS | ⬜ | |
| AUD-058 | Admin: dọn named CSS / hardcode / raw buttons | ⬜ | |
| AUD-060 | Gỡ 2 dead search export trong `public-api.ts` | ⬜ | |
| AUD-066 | Gỡ `GET /api/v1/search` + sửa docs API_FLOW_MAP | ⬜ | Quyết định #8 |
| AUD-067 | Gỡ `POST .../notifications/mark-read` không caller | ✅ `7e96af4d` | Làm sớm cùng 1D: gỡ endpoint + `markReadByIds` khi rework mô hình đã-đọc per-admin (endpoint chưa từng có caller); docs API_CONTRACT ghi Removed |
| AUD-068 | Gỡ `GET .../settings/{settingKey}` không caller | ⬜ | Quyết định #8 |
| AUD-074 | Gỡ audio khỏi Media Library (filter admin + backend reject) | ⬜ | Quyết định #5 |
| AUD-076 | Docs bổ sung `orders/lookup`, quyền reviews, module Reviews; gỡ ghi chú stale | ⬜ | |
| AUD-077 | Gỡ `REDIRECT_HIT_TRACKING` khỏi `.env.example` | ⬜ | |

## Phase 3C — Chốt sổ

| AUD | Việc | Trạng thái | Ghi chú |
|---|---|---|---|
| AUD-047 | Regen/dọn OpenAPI sau khi đã gỡ toàn bộ endpoint ở 3B | ⬜ | Làm cuối cùng |
| — | Ghi chú docs: hóa đơn điện tử chưa triển khai, blocker trước bán thật | ⬜ | Quyết định #9 |

## Việc user cần tự làm sau đợt sửa (session sửa lỗi bổ sung vào đây)

- [ ] Điền `.env` thật theo `.env.example` mới (invite URL, OAuth) rồi khởi động lại stack để áp dụng AUD-009/061/062.
- [ ] Duyệt lại các mục runtime verification ở §6 của audit (SMTP, OAuth, firewall, WebSocket, backup…).
