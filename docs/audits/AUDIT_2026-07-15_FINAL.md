# Báo cáo Audit cuối cùng toàn hệ thống BigBike — 2026-07-15

> **Trạng thái:** Bản hợp nhất chính thức từ `AUDIT_2026-07-15.md` và `AUDIT_2026-07-15_v2.md`.
>
> **Phạm vi:** `bigbike-web` + `bigbike-admin` + `bigbike-backend`, đối chiếu code, tài liệu chuẩn trong `docs/business/` và `docs/engineering/`, OpenAPI, migration và cấu hình triển khai.
>
> **Mốc audit:** commit `251b1ca67` trên nhánh `main`, có tính cả các thay đổi chưa commit đã tồn tại trong worktree lúc audit. Đây là audit tĩnh; không ghi DB, không chạy migration và không khởi động/dừng/restart Docker.
>
> **Cách dùng:** file này là nguồn tổng hợp để ưu tiên xử lý. Hai báo cáo gốc được giữ làm bằng chứng lịch sử và chi tiết tái hiện; không cộng số liệu từ chúng thêm lần nữa.

---

## Executive Summary

- **Hệ thống chưa đủ điều kiện để coi là an toàn hoàn toàn cho production.** Sau khi khử trùng giữa hai báo cáo, có **77 finding còn mở**: **1 Blocker, 22 High, 30 Medium và 24 Low**.
- **Rủi ro phải xử lý đầu tiên là rò rỉ dữ liệu đơn hàng khách vãng lai (AUD-001).** Một tài khoản có thể đổi sang email khác nhưng vẫn giữ trạng thái đã xác minh, sau đó nhận đơn và dữ liệu cá nhân gắn với email mới.
- **Pass 2 bổ sung 15 finding duy nhất**, không phải 25 finding cộng thẳng vào bản đầu. Mười finding còn lại đã trùng toàn phần hoặc một phần với mã AUD có sẵn. Tổng đúng là `62 + 15 = 77`.
- **Kết quả audit cũ được chốt lại:** 11 lỗi kỹ thuật Critical/Major của đợt 2026-07-05 đã được xác nhận sửa; mục thứ 12 về hóa đơn điện tử chưa phải lỗi code đã sửa mà vẫn là quyết định phạm vi/nhà cung cấp, được tài liệu xem là blocker trước production.

### Cơ cấu finding sau khử trùng

| Mức độ | Số lượng | Ý nghĩa vận hành |
|---|---:|---|
| **Blocker** | **1** | Có nguy cơ lộ/chiếm quyền xem đơn hàng và dữ liệu khách |
| **High** | **22** | Có thể làm sai đơn, giá, tồn kho, mất media, gãy luồng bán hàng/xác thực/thông báo hoặc tạo rủi ro bảo mật đáng kể |
| **Medium** | **30** | Sai trạng thái/dữ liệu, song ngữ/SEO chưa đúng, rule và tài liệu mâu thuẫn hoặc trải nghiệm vận hành thiếu an toàn |
| **Low** | **24** | Nợ cấu hình, endpoint/code dư, lỗi dữ liệu nhỏ, encoding và design system |
| **Tổng** | **77** | Mỗi vấn đề chỉ được tính một lần |

### Những rủi ro cần ưu tiên nhất

1. **Dữ liệu khách hàng:** AUD-001 có thể gắn guest order của email mới vào sai tài khoản.
2. **Đơn hàng, giá và tồn kho:** AUD-002/AUD-003 cho phép ghép sai sản phẩm–biến thể hoặc bỏ qua cờ hết hàng; AUD-007 nhận địa chỉ chưa đủ; AUD-023/AUD-024 làm sai trạng thái thanh toán.
3. **Mất dữ liệu media:** AUD-004 có thể xóa object MinIO vẫn đang được nơi khác sử dụng.
4. **Cam kết tài chính và tự động hóa chưa được chốt:** AUD-005 tự hủy BACS sau 72 giờ không có rule chuẩn; AUD-006 hứa hoàn tiền 3–5 ngày dù luồng refund đã gỡ.
5. **Thông báo quản trị:** AUD-017–AUD-019 có thể lộ cache giữa tài khoản, dùng chung trạng thái đã đọc và làm mất backlog khỏi UI.
6. **Song ngữ/SEO:** AUD-013–AUD-015 và AUD-027 làm nội dung EN không độc lập hoặc tiếp tục trả dữ liệu VI.
7. **Cấu hình triển khai:** AUD-009, AUD-061 và AUD-062 có thể cho phép bypass nginx, gửi link mời sai host và làm social login không hoạt động qua Compose.
8. **Nội dung admin không bao giờ xuất hiện:** AUD-063 cho phép quản trị tạo slider ở ba vị trí mà website không render.

---

## 1. Quyết định hợp nhất và xử lý mâu thuẫn

### 1.1 Số lượng chính thức là 77

- `AUDIT_2026-07-15.md` hiện có **62 finding**. Câu trong pass 2 gọi đây là “báo cáo 60-finding” phản ánh thời điểm hai pass chạy song song, trước khi AUD-061/AUD-062 được thêm vào bản đầu.
- `AUDIT_2026-07-15_v2.md` có 25 dòng finding, nhưng chỉ **15 nội dung mới** sau khi đối chiếu mã và phạm vi.
- 15 nội dung mới được cấp mã **AUD-063 đến AUD-077** trong báo cáo này.

### 1.2 Các finding của pass 2 đã được gộp vào mã cũ

| Mã pass 2 | Mã cuối cùng | Cách xử lý |
|---|---|---|
| F-02 | AUD-027 | Trùng lỗi search suggest bỏ qua ngôn ngữ |
| F-05 | AUD-039 | Trùng tài liệu còn mô tả tính năng so sánh đã gỡ |
| F-06 | AUD-040 | Trùng tài liệu địa chỉ ba cấp |
| F-07 | AUD-030 | Gộp tàn dư `REFUNDED` ở web; không nhầm với bộ lọc admin cũ đã sửa |
| F-08, F-09 | AUD-055 | Gộp tàn dư coupon và DTO serial mồ côi |
| F-11, F-12, F-15, F-16 | AUD-056 | Gộp nhóm endpoint không có consumer nội bộ |
| F-10 (hai dead export) | AUD-060 | Phần endpoint `/api/v1/search` chưa có trong bản đầu được tách thành AUD-066 |

### 1.3 Những câu kết luận mâu thuẫn được chốt như sau

- **Slider:** câu “slider core không lộ lỗi” ở bản đầu bị thay thế bởi AUD-063. Bằng chứng trực tiếp cho thấy admin có `home`, `category`, `category_sidebar`, `promotion`, còn website chỉ gọi `listHomeSliders()`.
- **12 lỗi Critical/Major cũ:** không ghi “đã sửa hết 12”. Kết luận đúng là **11 lỗi kỹ thuật đã sửa; hóa đơn điện tử vẫn mở và cần chủ shop chốt**.
- **Design system:** pass 2 xác nhận không còn màu/size cấm trong `className`, nhưng điều đó không phủ định AUD-057/AUD-058 và AUD-075 về raw controls, named CSS và token hardcode ở stylesheet/cấu hình.
- **REFUNDED:** bộ lọc admin cũ đã sửa, nhưng tàn dư live ở web vẫn còn và được giữ tại AUD-030.
- **Kiểm thử:** bản đầu đã chạy build/test frontend; pass 2 chỉ rà tĩnh và không chạy lại. Kết quả kiểm thử dùng trong báo cáo cuối lấy từ bản đầu.

---

## 2. Kế hoạch xử lý được đề xuất

### P0 — Khóa rủi ro dữ liệu ngay

1. **AUD-001:** khi đổi email phải hủy trạng thái xác minh email cũ và không được tự liên kết guest order cho tới khi email mới được xác minh lại.
2. Rà dữ liệu/log để xác định đã có tài khoản nào đổi email rồi nhận guest order hay chưa. Đây là kiểm tra runtime có thể chứa PII, chỉ thực hiện theo quy trình vận hành được duyệt.

### P1 — Hoàn thành trước khi coi production an toàn

- **Đơn hàng/tồn kho/giá:** AUD-002, AUD-003, AUD-007, AUD-010, AUD-011, AUD-016.
- **Media và nội dung:** AUD-004, AUD-012, AUD-013, AUD-014, AUD-015, AUD-063.
- **Đơn hàng và cam kết tài chính:** AUD-005, AUD-006; owner phải chốt rule 72 giờ trước khi sửa.
- **Bảo mật/hạ tầng:** AUD-009, AUD-017, AUD-020, AUD-061, AUD-062; AUD-009 cần kiểm tra firewall/bind port runtime.
- **Thông báo admin:** AUD-018, AUD-019 nên xử lý cùng AUD-017 vì cùng mô hình dữ liệu và UX chuông thông báo.
- **SEO/redirect:** AUD-008.

### P2 — Ổn định dữ liệu, song ngữ và tài liệu chuẩn

- Xử lý 30 finding Medium, ưu tiên AUD-021–AUD-038, AUD-064, AUD-065 vì ảnh hưởng trực tiếp khách hàng/vận hành.
- Chốt và cập nhật canonical docs cho AUD-039–AUD-045/AUD-048 trước khi sửa code phụ thuộc các rule đó.
- Dọn stale test/OpenAPI tại AUD-046/AUD-047 sau khi canonical docs đã được chốt.

### P3 — Dọn nợ và giảm bề mặt bảo trì

- Xử lý 24 finding Low theo module.
- Với endpoint không có caller, phải xác minh app mobile hoặc client ngoài repo trước khi xóa.
- Gộp việc dọn code dư, design token và env mẫu vào những PR đang chạm đúng module để giảm rủi ro.

---

## 3. Danh mục 77 finding chính thức

### Blocker

| ID | Module | Vấn đề và ảnh hưởng | Bằng chứng chính | Verdict |
|---|---|---|---|---|
| AUD-001 | Customer auth / Orders | Đổi email vẫn giữ “đã xác minh”, sau đó có thể nhận guest order và PII của email mới | `CustomerAuthService.java:113-117,160-185`; `GuestOrderLinkingService.java:14-20,44-53` | Code bug bảo mật |

### High

| ID | Module | Vấn đề và ảnh hưởng | Bằng chứng chính | Verdict |
|---|---|---|---|---|
| AUD-002 | Quick-buy | Ghép sản phẩm A với biến thể B, có thể sai SKU/giá | `CheckoutService.java:216-225` | Code bug |
| AUD-003 | Cart / Checkout | `forceOutOfStock` không chặn mua biến thể | `CartService.java:98-112`; `CheckoutService.java:223-233,515-530` | Code bug |
| AUD-004 | Content / Media | Xóa vĩnh viễn bài viết có thể xóa object MinIO còn được nơi khác dùng | `AdminContentMutationService.java:275-334` | Code bug, nguy cơ mất dữ liệu |
| AUD-005 | Order automation | Tự hủy BACS sau 72 giờ nhưng canonical docs không có rule này | `OrderAutoCancelService.java:68-132`; `OrderAutoCancelScheduler.java:18-30` | Cần owner quyết |
| AUD-006 | Order email | Email hủy hứa hoàn tiền 3–5 ngày dù refund đã gỡ | `OrderNotificationService.java:197-223` | Code bug |
| AUD-007 | Checkout / Address | API nhận đơn thiếu tỉnh/phường hoặc địa chỉ giao rỗng | `CheckoutAddressRequest.java:18-25`; `CheckoutSupport.java:41-58,111-128` | Code bug |
| AUD-008 | Redirect / SEO | Auto slug redirect bỏ qua loop check và cache invalidation | `SlugRedirectHelper.java:32-46` | Code bug |
| AUD-009 | Deployment / Security | Backend và MinIO bind mọi interface, có thể bypass nginx | `docker-compose.yaml:56-58,83-84` | Code/config bug; cần runtime verification |
| AUD-010 | Storefront checkout | Không có điểm vào “Mua nhanh” dù backend và docs yêu cầu | `BuyButtons.tsx:24-80` | Code bug |
| AUD-011 | Storefront checkout | UI khẳng định COD được chọn nhưng payload không gửi payment method | `CheckoutClient.tsx:187-196`; `useCheckout.ts:178-203` | Code bug |
| AUD-012 | Static content | Hai route hướng dẫn bắt buộc trả 404 | `static-pages.ts:68-90`; `huong-dan/[...sub]/page.tsx:11-15` | Code bug |
| AUD-013 | Static content / i18n | Chuyển EN không kích hoạt nội dung EN của trang tĩnh | `i18n/request.ts:4-18`; `ClientIntlProvider.tsx:74-95` | Code bug |
| AUD-014 | Catalog / i18n | List sản phẩm, thương hiệu, tin tức EN bị giữ dữ liệu VI và không refetch | `CatalogClient.tsx:78-135` | Code bug |
| AUD-015 | SEO / i18n | Sitemap phát URL EN nhưng không tạo trang EN crawl độc lập | `sitemap.ts:91-158`; `routes.ts:292-313` | Code bug |
| AUD-016 | Admin orders | List đơn hiển thị mọi đơn là chưa fulfil vì DTO thiếu field | `OrderListScreen.jsx:240-246`; `AdminOrderListItemResponse.java:7-20` | Code bug |
| AUD-017 | Admin notifications | Cache thông báo có thể lộ chéo giữa tài khoản trên cùng trình duyệt | `NotificationBell.jsx:17,26-38,82-110` | Code bug bảo mật |
| AUD-018 | Admin notifications | Một admin mở chuông làm mọi admin mất trạng thái chưa đọc | `V102__create_admin_notifications_table.sql:3-10`; `NotificationBell.jsx:116-143` | Code bug |
| AUD-019 | Admin notifications | Backend trả 50, UI giữ 30 nhưng mở chuông mark-all-read toàn DB, làm mất backlog khỏi UI | `AdminNotificationService.java:18,33-52`; `NotificationBell.jsx:18,84-101,133-143` | Code bug |
| AUD-020 | Web dependencies | Production tree có 3 advisory High và 10 mức thấp hơn theo `npm audit` lúc audit | `bigbike-web/package.json:37,44,46`; các package tương ứng trong `package-lock.json` | Dependency risk |
| AUD-061 | Admin invite / Env | Compose bỏ biến invite URL, email mời admin trỏ localhost | `docker-compose.yaml:121-131`; `.env.example:95-96`; `application.properties:101` | Code/config bug |
| AUD-062 | Customer OAuth / Env | Compose không truyền sáu biến Google/Facebook OAuth vào backend | `docker-compose.yaml:89-131`; `.env.example:108-119`; `application.properties:111-117` | Code/config bug |
| AUD-063 | Slider/Banner | Admin cho tạo slider ở bốn vị trí nhưng website chỉ render `home`; ba vị trí còn lại lưu được nhưng không xuất hiện | `SliderListScreen.jsx:31-36`; `public-api.ts` chỉ có caller `listHomeSliders()`; `app/page.tsx:155` | Cần owner quyết: gỡ ba vị trí hoặc xây chỗ render |

### Medium

| ID | Module | Vấn đề và ảnh hưởng | Bằng chứng chính | Verdict |
|---|---|---|---|---|
| AUD-021 | Cart | Giỏ báo “Tính khi đặt hàng” thay vì “Miễn phí vận chuyển” | `CartSummary.tsx:41-49` | Code bug |
| AUD-022 | Checkout / CSRF | Checkout và quick-buy được miễn CSRF trái docs và test | `CustomerCsrfFilter.java:35-45,66-68` | Code bug, docs/test drift |
| AUD-023 | Order payment | Mark PAID rồi UNPAID để lại payment row `SUCCEEDED` | `AdminOrderService.java:421-450` | Code bug |
| AUD-024 | Order state | `ON_HOLD → PROCESSING` tự đánh dấu BACS là PAID | `AdminOrderService.java:325-345` | Code bug |
| AUD-025 | Customer cancel / Realtime | Khách hủy đơn không phát WS, inbox, audit hoặc email | `CustomerOrderCancelService.java:24-55` | Cần owner quyết |
| AUD-026 | Notifications | Bản ghi offline thiếu tên khách và giá trị đơn | `AdminNotificationService.java:55-59` | Code bug |
| AUD-027 | Search / i18n | Search suggest bỏ qua `lang`; link EN vẫn dùng slug/route VI | `GlobalSearchService.java:30-53`; `SuggestionResults.tsx:40-76` | Code bug |
| AUD-028 | PDP / i18n | Nhiều field EN biến mất thay vì fallback VI khi tải/lỗi | `PurchaseSection.tsx:172-213` | Code bug |
| AUD-029 | PDP variants | Option không bán bị disable nên khách không xem được ảnh | `VariantPicker.tsx:53-87` | Code bug |
| AUD-030 | Customer orders | `REFUNDED` còn là filter live ở web; copy hủy đơn nói hoàn tồn sai | `OrderHistoryContent.tsx:20-56`; `OrderDetailContent.tsx:182-195` | Code bug/dead behavior |
| AUD-031 | Policy SEO | Canonical bảo hành/đổi trả trỏ route có thể không được build | `chinh-sach/[slug]/page.tsx:18-25,101-123`; `static-pages.json:28,42` | Code bug; cần runtime verification |
| AUD-032 | Reviews | Form thu email nhưng request bỏ dữ liệu | `WriteReviewForm.tsx:31-35,121-130,204-217` | Code bug |
| AUD-033 | Checkout / Account i18n | Chuỗi VI và hotline/địa chỉ hardcode, không theo locale/settings | `CheckoutClient.tsx:203-207`; `checkout/parts/atoms.tsx:85-106` | Code bug |
| AUD-034 | Categories | Xóa vĩnh viễn không cho thấy đủ số sản phẩm và danh mục con bị ảnh hưởng | `CategoryListScreen.jsx:348-355,529-545` | Code bug |
| AUD-035 | Home highlights | Đổi VI/EN làm mất draft chưa lưu | `HomeHighlightsScreen.jsx:128-180` | Code bug |
| AUD-036 | Settings / Media | HTML setting nhận ảnh ngoài/track pixel, bypass rule media chỉ dùng MinIO | `SettingField.jsx:80-88`; `SettingValueValidator.java:77-94` | Code bug/policy gap |
| AUD-037 | Reviews / Storage | Upload ảnh review public tạo orphan MinIO không cleanup | `ReviewPhotoStorageService.java:45-71` | Code bug |
| AUD-038 | Order snapshot | Ảnh line item lấy live từ catalog nên lịch sử đơn có thể đổi/mất ảnh | `OrderReadService.java:165-194` | Code bug |
| AUD-039 | Canonical docs | Docs còn mô tả wishlist/comparison đã gỡ | `API_CONTRACT.md:106-109`; `WORKFLOW_OVERVIEW.md:14-21`; `API_FLOW_MAP.md:10,29-33` | Docs sai |
| AUD-040 | Canonical docs / Address | Docs còn mô hình địa chỉ ba cấp, trong khi code mới dùng tỉnh/thành → phường/xã | `MODULE_CATALOG.md:15`; `WORKFLOW_OVERVIEW.md:76-82` | Docs sai |
| AUD-041 | Canonical docs / Static content | Policy menu và số trang tĩnh tự mâu thuẫn | `BUSINESS_RULES.md:294-335`; `API_CONTRACT.md:178,1122-1132` | Cần owner quyết |
| AUD-042 | Canonical docs / RBAC | Quyền sửa tồn kho mâu thuẫn giữa `products.update` và `inventory.write` | `MODULE_CATALOG.md:29`; `API_CONTRACT.md:604-623` | Docs sai |
| AUD-043 | Canonical docs / WebSocket | Có nơi giới hạn ADMIN/SUPER_ADMIN, nơi khác dùng `orders.read` | `BUSINESS_RULES.md:337-342`; `PERMISSION_MATRIX.md:125-130` | Code/docs boundary bug |
| AUD-044 | Canonical docs / Commerce | Docs mâu thuẫn về hoàn tồn, payment và phí ship | `BUSINESS_RULES.md:42-57,94-107,360-363`; `API_CONTRACT.md:103,391-392,631` | Cần owner quyết |
| AUD-045 | Canonical docs / State & deploy | State machine và migration/version notes tự mâu thuẫn hoặc stale | `STATE_MACHINES.md:58-64,392-429,841-849`; `DEPLOYMENT_GUIDE.md:64-66` | Docs sai |
| AUD-046 | Backend tests | Test còn khóa quantity/refund/CSRF/auto-paid của contract cũ | `Phase1FCheckoutApiTest.java:108-125,421-505` | Stale tests |
| AUD-047 | OpenAPI | Raw OpenAPI còn quảng bá coupon/POS/returns/shipping/pages đã gỡ | `bigbike-openapi.json` tại các vùng nêu trong báo cáo gốc | Docs/dead contract |
| AUD-048 | Render policy docs | Architecture còn wishlist và mô tả account pages dynamic, trái build hiện tại | `ARCHITECTURE.md:51-59` | Docs sai |
| AUD-064 | Video bài viết/mô tả sản phẩm | Backend/editor chỉ nhận YouTube hoặc upload, trái rule cho phép YouTube/TikTok/Facebook và khả năng render hiện có của web | `DescriptionBlock.java:236`; `block-editor/constants.js:36`; `description-blocks/blocks.tsx:44-46`; `AGENTS.md` §14.3 | Code chưa theo rule đã chốt |
| AUD-065 | Cart availability | Sản phẩm không biến thể đã hết hàng nằm sẵn trong giỏ không được đánh dấu không khả dụng; checkout vẫn chặn nhưng báo quá muộn | `CartService.java:233-267`; đối chiếu `CheckoutService.java:521-529` | Code bug UX; khác AUD-003 |

### Low

| ID | Module | Vấn đề và ảnh hưởng | Bằng chứng chính | Verdict |
|---|---|---|---|---|
| AUD-049 | Env / Mail | Mẫu env local tạo link reset/verify về production | `.env.example:17-22,93-94` | Config bug |
| AUD-050 | Admin env / Media | Biến extra MinIO origin không đi qua Docker và có default IP cũ | `contracts.js:77-94`; `bigbike-admin/Dockerfile:10-17` | Config bug |
| AUD-051 | API envelope | Một số filter trả error envelope lệch chuẩn | `RateLimitingFilter.java:296-306`; `CustomerCsrfFilter.java:77-79` | Code bug |
| AUD-052 | Order email | Email chào bằng email/số điện thoại dù order có tên khách | `OrderNotificationService.java:169-176` | Code bug |
| AUD-053 | Payment data model | Entity nói `paymentMethod` NOT NULL nhưng DB/checkout cho null | `PaymentEntity.java:34-35`; `V284__allow_null_payment_method.sql:1-5` | Model/schema drift |
| AUD-054 | Encoding | Comment importer có ký tự gạch ngang bị chuyển mã sai | `ProductVariationImporter.java:30-34` | Encoding bug |
| AUD-055 | Removed features | Còn field/DTO/locale/comment/CSS cho quantity, serial, wishlist, coupon, comparison, refund, shipping và POS | Các evidence chi tiết trong bản audit gốc; gồm `SerialImportRowRequest.java` và `contracts.js:752-759` | Dead code/residue |
| AUD-056 | Dead endpoints | Inventory/content/options/address/translation endpoints không thấy consumer nội bộ | Các controller tương ứng; `API_CONTRACT.md:172` | Candidate dead code; phải kiểm tra client ngoài repo |
| AUD-057 | Web design system | Raw controls và arbitrary values còn trong active UI/CSS | `VariantPicker.tsx:73-95`; `BuyButtons.tsx`; `globals.css`; `static-pages.json` | Design debt |
| AUD-058 | Admin design system | Named CSS/hardcode/raw buttons còn phổ biến | `admin-prototype.css`; `index.css`; các media/product/user screen nêu trong bản gốc | Design debt |
| AUD-059 | Checkout note | Ghi chú hệ thống có thể thành “Đơn hàng được tạo..” | `CheckoutService.java:173-176` | Code bug nhỏ |
| AUD-060 | Dead web exports | Hai helper search trong public API không có caller | `public-api.ts` tại hai export search | Dead code |
| AUD-066 | Search endpoint/docs | `GET /api/v1/search` không có client trong repo; trang tìm kiếm dùng products, dropdown dùng search-suggest; docs vẫn nói web dùng endpoint này | `public-api.ts:492,512`; `API_FLOW_MAP.md:7` | Cần owner quyết trước khi gỡ |
| AUD-067 | Notification endpoint | `POST /api/v1/admin/notifications/mark-read` không có UI caller; chuông chỉ dùng mark-all-read | `AdminNotificationController.java`; `NotificationBell.jsx:116-143`; `API_CONTRACT.md:1318` | Candidate dead endpoint |
| AUD-068 | Settings endpoint | `GET /api/v1/admin/settings/{settingKey}` không có UI caller; màn cài đặt tải cả bộ | `AdminSettingsController.java`; không có caller trong `adminApi.js` | Candidate dead endpoint |
| AUD-069 | Admin customer | Xóa trắng hoặc nhập số điện thoại không chuẩn hóa được bị bỏ qua nhưng UI vẫn báo lưu thành công | `AdminCustomerService.java:185-195` | Code bug nhỏ |
| AUD-070 | Product import | Hai dòng trùng SKU dùng chung `rowKey`, có thể làm chọn/bỏ dòng hoặc React key trỏ nhầm | `ProductImportService.java:728` | Code bug nhỏ |
| AUD-071 | Brand SEO | Xóa hết ô SEO rồi lưu vẫn giữ SEO cũ | `BrandDetailScreen.jsx:102-116`; `BrandMutationService.java:270-274` | Code bug nhỏ |
| AUD-072 | API 404 | Đường dẫn API không tồn tại có thể trả 500 thay vì 404 do thiếu handler chuyên biệt | `GlobalExceptionHandler.java`; quan sát live từ audit 2026-07-05 | Code bug nhỏ; cần runtime reverify |
| AUD-073 | Admin reviews / i18n | Tham số `lang` của list đánh giá bị bỏ qua, nút VI/EN không đổi dữ liệu | `AdminReviewService.java:74-96` | Code bug nhỏ |
| AUD-074 | Admin media | UI có lọc/đếm Audio, frontend không upload audio nhưng backend nhận audio | `MediaLibraryScreen.jsx:498`; `media-library/constants.js:4-7`; `AdminMediaService.java:63-66` | Cần owner chốt nghiệp vụ audio |
| AUD-075 | Admin design token | Toaster hardcode font; nút nguy hiểm dùng token đỏ thương hiệu thay token danger | `main.jsx:36`; `index.css:2908-2925` | Vi phạm token cụ thể; bổ sung AUD-058 |
| AUD-076 | Canonical docs | Thiếu `orders/lookup`, quyền reviews, module Reviews; còn ghi giới hạn category đã được sửa | `API_CONTRACT.md`; `PERMISSION_MATRIX.md`; `MODULE_CATALOG.md`; `WORKFLOW_OVERVIEW.md:74` | Docs sai/thiếu |
| AUD-077 | Env | `.env.example` còn `REDIRECT_HIT_TRACKING` nhưng không có code đọc | `.env.example`; grep toàn repo không có reader | Stale config example |

---

## 4. Tình trạng các lỗi Critical/Major của audit 2026-07-05

### Đã xác nhận sửa trong code hiện tại

1. Giỏ hàng không còn cộng dồn vô hạn khi gộp giỏ.
2. Danh mục/thương hiệu không còn bắt buộc tên EN sai ngữ cảnh khi ẩn/hiện hoặc sắp xếp.
3. Thùng rác Tin tức dùng đúng đường dẫn số nhiều.
4. Lọc màu danh mục cha đã tính sản phẩm ở danh mục con.
5. Video TikTok/Facebook trang chủ đã được web render.
6. Home Highlights đã chặn sản phẩm chưa đăng bán.
7. Xuất bản/ẩn hàng loạt bài viết không còn đòi EN title sai ngữ cảnh.
8. Toggle Redirect không còn xóa trắng notes/legacyId.
9. Video sản phẩm đã được kiểm tra whitelist media.
10. Gallery sản phẩm đã được kiểm tra whitelist media.
11. Khối mô tả sản phẩm đã được kiểm tra whitelist ảnh/media.

### Chưa đóng

- **Hóa đơn điện tử theo NĐ 123/2020:** chưa có implementation/nhà cung cấp trong repo. Đây là quyết định phạm vi của chủ shop và vẫn được tài liệu xem là blocker trước production; không được tính là “lỗi code đã sửa”.

---

## 5. Các quyết định owner còn thiếu

| Chủ đề | Mã liên quan | Quyết định cần chốt |
|---|---|---|
| Tự hủy đơn BACS sau 72 giờ | AUD-005 | Giữ rule 72 giờ và bổ sung docs, hay gỡ scheduler |
| Khách hủy đơn cần thông báo gì | AUD-025 | Có phát WebSocket, inbox, audit log và email hay không |
| Ba vị trí slider ngoài trang chủ | AUD-063 | Xây chỗ render hay gỡ khỏi admin/backend |
| Menu policy và số trang tĩnh | AUD-041 | Chốt danh sách/slot chính thức rồi cập nhật docs trước code |
| Hoàn tồn, payment và phí ship | AUD-044 | Chốt rule commerce duy nhất |
| Audio trong Media Library | AUD-074 | Có nghiệp vụ audio hay gỡ filter/backend support |
| Endpoint không có caller | AUD-056, AUD-066–AUD-068 | Giữ cho mobile/roadmap/client ngoài repo hay gỡ |
| Hóa đơn điện tử | Mục 4 | Chọn nhà cung cấp/phạm vi trước production |

---

## 6. Các khoảng trống cần runtime verification

- SMTP và link thật trong email xác minh/reset/mời admin.
- Google/Facebook OAuth qua đường Docker Compose chuẩn.
- Firewall/VPS và khả năng truy cập trực tiếp port backend/MinIO ngoài nginx.
- Xóa object MinIO dùng chung và orphan ảnh review trên dữ liệu thật.
- WebSocket qua reverse proxy, permission khi SUBSCRIBE và inbox notification nhiều admin.
- Scheduler tự hủy đơn, dữ liệu payment/order production và lịch sử đổi trạng thái.
- Redirect loop/cache trên DB thật.
- Sitemap/robots, canonical policy URL và nội dung EN trên môi trường deploy.
- Backup/restore, staging, CDN và audit-log completeness được docs gắn `NOT_FOUND_IN_REPO` hoặc `NEEDS_VERIFICATION`.

Các kiểm tra runtime phải bắt đầu bằng `docker ps`/`docker compose ps`; không tự ý start/restart/down service và không ghi DB nếu chưa được user duyệt.

---

## 7. Bằng chứng kiểm thử và giới hạn

### Đã có bằng chứng từ bản audit đầu

- Web: `npm test` — **208/208** test qua; lint 0 error/6 warning; build thành công với 39 static pages.
- Admin: `npm test -- --run` — **114/114** test qua; lint qua.
- Dependency: admin không có vulnerability tại thời điểm audit; web có 13 advisory, được ghi tại AUD-020.
- Locale parity: web VI/EN cùng 1.163 leaf key; admin VI/EN cùng 2.929 leaf key.
- Không phát hiện admin API caller trỏ tới endpoint backend không tồn tại.

### Chưa được kiểm tra

- Không chạy backend test suite; chỉ đọc tĩnh và phát hiện stale expectations tại AUD-046.
- Không kiểm thử live SMTP, OAuth, MinIO, WebSocket, reverse proxy, firewall/VPS, scheduler hoặc dữ liệu production.
- Không chạy migration, không ghi DB và không thao tác vòng đời Docker.
- Không audit app mobile ở repo khác; vì vậy endpoint “không có caller nội bộ” chưa được phép coi là chắc chắn không có consumer.
- Báo cáo này hợp nhất và xử lý mâu thuẫn từ hai audit; không thay thế một đợt retest sau khi sửa code.

---

## 8. Nguồn báo cáo

1. [`AUDIT_2026-07-15.md`](./AUDIT_2026-07-15.md) — bản audit chính, 62 finding, có build/test frontend và chi tiết tái hiện.
2. [`AUDIT_2026-07-15_v2.md`](./AUDIT_2026-07-15_v2.md) — pass độc lập, kiểm lại audit 2026-07-05 và bổ sung 15 finding duy nhất sau khử trùng.
3. Canonical docs trong [`docs/business/`](../business/) và [`docs/engineering/`](../engineering/) — source of truth khi code/docs mâu thuẫn, theo Docs-First Contract.
4. `AGENTS.md` §14.3 — căn cứ giữ AUD-064: video nhúng do admin quản lý được phép dùng YouTube, TikTok hoặc Facebook.

---

*Báo cáo cuối cùng được hợp nhất ngày 2026-07-15. Hai file audit gốc được giữ nguyên để bảo toàn bằng chứng; mọi kế hoạch sửa lỗi và kiểm tra lại nên tham chiếu mã AUD trong file này.*
