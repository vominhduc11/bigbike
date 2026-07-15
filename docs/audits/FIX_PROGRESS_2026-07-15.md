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
| AUD-002 | Quick-buy không được ghép sản phẩm A với biến thể B | ✅ | `CheckoutService.quickBuy` kiểm tra variant thuộc đúng product (404 nếu lệch) + test `quickBuy_variantOfAnotherProduct_returns404` |
| AUD-003 | `forceOutOfStock` phải chặn mua ở cart + checkout (cả biến thể) | ✅ | Check cấp product trước nhánh variant ở `CartService.addItem`/`validateQuantityAgainstStock`, `CheckoutService.quickBuy`/`validateCartAgainstStock` (STOCK_RULE_004) + 3 test mới |
| AUD-007 | Checkout từ chối đơn thiếu tỉnh/phường hoặc địa chỉ giao rỗng | ✅ | `@NotBlank` province/ward trên DTO + `validateAddress` (cả shipping đã resolve); fallback shipping coi chuỗi rỗng như null; test missingProvince/missingWard/blankShipping |
| AUD-010 | Bổ sung điểm vào "Mua nhanh" trên web theo docs | ✅ | Nút MUA NHANH trên PDP (`BuyButtons`) mở `QuickBuyDialog.tsx` mới — tái dùng `CheckoutAddressFields`+`CodPaymentBlock`, gửi `submitQuickBuy` với COD + idempotency key; xóa schema quick-buy mồ côi |
| AUD-011 | Trang đặt hàng hiển thị cố định 1 phương thức COD + gửi/lưu `COD` | ✅ | Quyết định #10: web gửi `paymentMethod:"COD"`; backend normalize null→COD, reject BACS, options chỉ COD, bỏ nhánh BACS→ON_HOLD; docs PAY_RULE_001/002 + ORDER_RULE_002 + API_CONTRACT + MODULE_CATALOG cập nhật cùng commit |
| AUD-016 | Admin list đơn hiển thị đúng trạng thái fulfil (bổ sung field DTO) | ✅ | `AdminOrderListItemResponse` thêm `fulfillmentStatus`+`fulfillmentType` (MapStruct tự map); admin contracts.js đã normalize sẵn |

## Phase 1B — High: Nội dung, media, song ngữ, SEO

| AUD | Việc | Trạng thái | Ghi chú |
|---|---|---|---|
| AUD-004 | Xóa vĩnh viễn bài viết không được xóa object MinIO còn nơi khác dùng | ⬜ | |
| AUD-008 | Auto slug redirect phải có loop check + cache invalidation | ⬜ | |
| AUD-012 | Sửa 2 route hướng dẫn đang trả 404 | ⬜ | |
| AUD-013 | Trang tĩnh kích hoạt đúng nội dung EN khi chuyển ngôn ngữ | ⬜ | |
| AUD-014 | List sản phẩm/thương hiệu/tin tức EN refetch đúng ngôn ngữ | ⬜ | |
| AUD-015 | Sitemap/route EN nhất quán (trang EN crawl được độc lập) | ⬜ | |
| AUD-063 | Gỡ 3 vị trí slider khỏi admin, chỉ giữ `home`; không xóa data cũ | ⬜ | Quyết định #4 |

## Phase 1C — High: Bảo mật, cấu hình hạ tầng

| AUD | Việc | Trạng thái | Ghi chú |
|---|---|---|---|
| AUD-009 | Compose bind 127.0.0.1 cho backend/MinIO; KHÔNG tự restart | ⬜ | User áp dụng sau |
| AUD-020 | Nâng dependency web có advisory (3 High + 10 thấp hơn) | ⬜ | Không major-bump phá build |
| AUD-061 | Thêm biến invite URL admin vào compose + `.env.example` | ⬜ | |
| AUD-062 | Truyền 6 biến OAuth Google/Facebook qua compose + `.env.example` | ⬜ | |

## Phase 1D — High: Email đơn & thông báo admin

| AUD | Việc | Trạng thái | Ghi chú |
|---|---|---|---|
| AUD-005 | GỠ scheduler tự hủy BACS 72h + cập nhật docs | ⬜ | Quyết định #2 |
| AUD-006 | Email hủy đơn bỏ lời hứa "hoàn tiền 3–5 ngày" | ⬜ | |
| AUD-017 | Cache thông báo không lộ chéo giữa tài khoản trên cùng trình duyệt | ⬜ | Sửa cùng 018/019 |
| AUD-018 | Trạng thái đã-đọc thông báo tách riêng từng admin | ⬜ | |
| AUD-019 | Mở chuông không mark-all-read toàn DB / không mất backlog | ⬜ | |

## Phase 2A — Medium: khách hàng & vận hành

| AUD | Việc | Trạng thái | Ghi chú |
|---|---|---|---|
| AUD-021 | Giỏ hàng hiển thị "Miễn phí vận chuyển" theo SHIP_RULE_001 | ⬜ | |
| AUD-022 | Bỏ miễn CSRF cho checkout/quick-buy theo docs | ✅ | Làm sớm cùng nhóm 1A (chung file test): gỡ 2 exemption khỏi `CustomerCsrfFilter`; guest luôn có `bb_csrf` từ GET /cart app-wide; test CSRF Phase1F pass lại |
| AUD-023 | Mark PAID→UNPAID không để lại payment row `SUCCEEDED` | ⬜ | |
| AUD-024 | `ON_HOLD → PROCESSING` không tự đánh dấu BACS là PAID | ⬜ | |
| AUD-025 | Khách hủy đơn: WS + inbox admin + audit log + email cho khách | ⬜ | Quyết định #3 |
| AUD-026 | Bản ghi thông báo offline đủ tên khách + giá trị đơn | ⬜ | |
| AUD-027 | Search suggest tôn trọng `lang`; link EN đúng slug/route | ⬜ | |
| AUD-028 | PDP tiếng Anh fallback về VI thay vì mất field | ⬜ | |
| AUD-029 | Option hết hàng vẫn xem được (không disable chọn để xem ảnh) | ⬜ | |
| AUD-030 | Gỡ filter `REFUNDED` ở web + sửa copy hủy đơn (không nói hoàn tồn) | ⬜ | Theo quyết định #7 |
| AUD-031 | Canonical trang chính sách trỏ route thực sự được build | ⬜ | Cùng quyết định #6 |
| AUD-032 | Form đánh giá gửi email khách đã nhập | ⬜ | |
| AUD-033 | Checkout/account: chuỗi + hotline/địa chỉ theo locale/settings | ⬜ | |
| AUD-034 | Xóa vĩnh viễn danh mục: cảnh báo đủ số sản phẩm + danh mục con | ⬜ | |
| AUD-035 | Đổi VI/EN không làm mất draft Home Highlights | ⬜ | |
| AUD-036 | HTML setting chặn ảnh ngoài/track pixel theo rule MinIO | ⬜ | |
| AUD-037 | Upload ảnh review không tạo orphan MinIO (cleanup) | ⬜ | |
| AUD-038 | Ảnh line item snapshot theo đơn, không lấy live từ catalog | ⬜ | |
| AUD-064 | Video mô tả/bài viết nhận YouTube/TikTok/Facebook theo AGENTS §14.3 | ⬜ | Reject link rút gọn |
| AUD-065 | Giỏ đánh dấu "không khả dụng" cho sản phẩm no-variant hết hàng | ✅ | Làm sớm cùng AUD-003 (cùng file, audit khuyến nghị): `findUnavailableItemIds` mirror đúng điều kiện checkout (published + !forceOutOfStock + stockState với SP không biến thể) |

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
| AUD-046 | Sửa test backend khóa contract cũ (quantity/refund/CSRF/auto-paid) | 🔧 | Đã sửa cùng nhóm 1A: quantity-decrement (Phase1F/1H), refund (Phase1H — xóa toàn bộ test POST /refund + REFUNDED status), CSRF (đi cùng AUD-022), shippingItems (Phase1G), địa chỉ 2 cấp trong template. Còn lại: test auto-cancel BACS (xóa cùng AUD-005), test auto-paid ON_HOLD→PROCESSING (sửa cùng AUD-024) |
| AUD-048 | ARCHITECTURE bỏ wishlist + mô tả account pages đúng build | ⬜ | |

## Phase 3A — Low: lỗi nhỏ rõ ràng

| AUD | Việc | Trạng thái | Ghi chú |
|---|---|---|---|
| AUD-049 | `.env.example` link reset/verify về localhost | ⬜ | |
| AUD-050 | Biến extra MinIO origin đi qua Docker; bỏ default IP cũ | ⬜ | |
| AUD-051 | Filter trả đúng chuẩn error envelope | ⬜ | |
| AUD-052 | Email chào bằng tên khách khi đơn có tên | ⬜ | |
| AUD-053 | Đồng bộ model/schema `paymentMethod` nullable | ⬜ | Lưu ý quyết định #10 |
| AUD-054 | Sửa encoding comment importer | ⬜ | |
| AUD-059 | Ghi chú hệ thống checkout không thành "Đơn hàng được tạo.." | ✅ | Làm sớm cùng AUD-011 (cùng đoạn code): note luôn "Đơn hàng được tạo. Phương thức thanh toán: COD." — hết dấu chấm kép |
| AUD-069 | Sửa/xóa SĐT khách không hợp lệ: báo lỗi thay vì im lặng bỏ qua | ⬜ | |
| AUD-070 | `rowKey` import không trùng khi 2 dòng cùng SKU | ⬜ | |
| AUD-071 | Xóa trắng ô SEO thương hiệu phải được lưu | ⬜ | |
| AUD-072 | API path không tồn tại trả 404 thay 500 | ⬜ | |
| AUD-073 | Admin reviews tôn trọng tham số `lang` | ⬜ | |
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
| AUD-067 | Gỡ `POST .../notifications/mark-read` không caller | ⬜ | Quyết định #8 |
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
