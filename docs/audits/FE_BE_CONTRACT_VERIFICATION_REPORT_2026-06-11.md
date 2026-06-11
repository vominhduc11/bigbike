# Báo cáo kiểm tra hợp đồng FE ↔ BE & độ hoàn thiện — BigBike

- **Ngày:** 2026-06-11
- **Phạm vi:** `bigbike-web`, `bigbike-admin`, `bigbike-backend` (bỏ qua `bigbike_mobile`).
- **Phương pháp:** tĩnh (đọc code + grep + đối chiếu docs) **và** runtime (gọi API thật trên stack Docker đang chạy). Đối chiếu BE theo thứ tự `controller/DTO/test` → `docs/engineering/API_CONTRACT.md` → OpenAPI.
- **Tính chất:** báo cáo **chỉ audit, không sửa code**. Mọi phát hiện kèm evidence path thật.

> Phần dữ liệu thô của lần chạy này (inventory endpoint, JSON runtime, danh sách finding) lưu ngoài repo tại `s:/tmp/bigbike-audit/` để truy vết; báo cáo này là bản kết luận.

---

## 0. Cập nhật — đã sửa (2026-06-11)

Sau khi audit, user phê duyệt sửa **4 lỗi High (P1) + 3 mục đã xác nhận (P2-A/B/C)**. Trạng thái:

| Task | Nội dung | Trạng thái | Verify |
|---|---|---|---|
| **P1-1** | `GlobalExceptionHandler` xử lý `MissingServletRequestParameterException`/`MissingServletRequestPartException` → 400 `VALIDATION_ERROR` (field=tên param, code=`REQUIRED`) | ✅ Đã sửa | `Phase1K1ContractHardeningTest` thêm 2 test (missing→400, present→2xx) — **PASS** |
| **P1-2** | `adminApi.updateOrderStatus` gửi key `note` (đúng `UpdateOrderStatusRequest`) thay vì `reason` | ✅ Đã sửa | lý do huỷ/thất bại nay lưu thành note đơn |
| **P1-3** | `normalizeShippingMethod` thêm `freeShippingThreshold` + `titleEn` | ✅ Đã sửa | form sửa method không còn wipe dữ liệu |
| **P1-4** | `CustomerDetailScreen` đọc `discountValue`/`maxUsage` (đồng bộ `normalizeCoupon`) | ✅ Đã sửa | coupon hết "undefined%" |
| **P2-A** | `NotificationBell` hydrate từ REST `/admin/notifications` lúc mount + sync `mark-all-read`; giữ WS realtime làm bổ sung | ✅ Đã sửa | admin máy mới/sau offline thấy thông báo lưu bền; +3 hàm `adminApi` |
| **P2-B** | CRUD danh mục bài viết: `createContentCategory`/`updateContentCategory` + modal `ContentCategoryManagerModal` mở từ Content list (+i18n vi/en) | ✅ Đã thêm | admin tạo/sửa được danh mục; docs cập nhật ở `API_CONTRACT.md` §Content Categories |
| **P2-C** | `Phase1K1ContractHardeningTest` seed role `SUPER_ADMIN` + permissions `["*"]` (test profile tắt Flyway → bảng role rỗng → mọi quyền 403) | ✅ Đã sửa | 4 test cũ + 2 test mới — **PASS (exit 0)** |

**Verify tổng:** backend hardening test PASS · `bigbike-admin` `vite build` PASS (10.4s) · file sửa/tạo lint-clean.

### Đợt 2 — Medium/Low (2026-06-11)

| Task | Nội dung | Trạng thái |
|---|---|---|
| **M1** | `ProductDetailScreen` đọc spec `s.group \|\| s.groupName` (response record dùng `group`) → nhóm thông số nạp lại đúng, lưu không mất nhóm | ✅ Đã sửa |
| **M4** | Bộ đếm thư viện ảnh đọc `pagination.totalItems` (không phải `total`) → hiện đúng tổng (vd 12.069) thay vì 0 | ✅ Đã sửa |
| **M12** | `normalizeOrder` đọc `appliedCoupons`; trang chi tiết đơn hiện từng mã giảm giá + số tiền giảm | ✅ Đã sửa |
| **M14** | Bỏ field thừa `sortOrder` trong option của variant (BE `VariantOptionRequest` không nhận) | ✅ Đã sửa |
| **M20** + Import-CSV catalog | Gỡ 2 nút CSV `disabled` cứng (placeholder) ở màn Nội dung + Sản phẩm | ✅ Đã gỡ |
| **L27** | `ReviewsSection` xử lý `isError` + nút "Thử lại" (+key i18n `retry`) → lỗi tải đánh giá không còn hiện thành "chưa có đánh giá" | ✅ Đã sửa |
| **M8** | Banner "Email chưa xác minh" + nút gửi lại (`resendEmailVerification`) trên dashboard tài khoản (+i18n vi/en) | ✅ Đã thêm |
| ~~L23~~ | **Không sửa — false finding:** `contentBottom` là field form thật (validate ở `schemas.js`, BE `CatalogReadService` có), không phải ghost field | ⏭️ Bỏ qua |

**Verify đợt 2:** `bigbike-admin` build PASS (12.5s) · `bigbike-web` `tsc --noEmit` 0 lỗi + eslint 2 file sạch.

### Đợt 3 — backend + render lớn (2026-06-11)

| Task | Nội dung | Trạng thái |
|---|---|---|
| **M2** | BE thêm `source` vào `AdminOrderListItemResponse` + `OrderMapper.toAdminListItem` → badge POS hiện ở **danh sách** đơn (FE `normalizeOrder` đã đọc sẵn `source`) | ✅ Đã sửa (BE) |
| **M3** | BE thêm `customerName`/`customerPhone` vào `PosOrderResponse` (3 site build) → **hoá đơn POS in được tên/SĐT khách** (FE receipt đã đọc sẵn) | ✅ Đã sửa (BE) |
| **M7** | Order list khách (`/customer/orders`) **đã** trả `productNames` (MapStruct) → render tên SP trong lịch sử đơn (bảng + card mobile) — FE-only | ✅ Đã sửa |
| **M11** | Thêm field **"Nội dung khuyến mãi"** (RichText song ngữ) vào form sản phẩm admin: buildForm/toPayload/section/render + i18n vi/en — mirror `installationGuide`; BE `UpsertProductRequest` đã nhận `promotionContent` | ✅ Đã thêm |

**Verify đợt 3:** backend `mvnw compile` PASS (M2/M3 + MapStruct OK) · `bigbike-admin` build PASS (M11) · `bigbike-web` `tsc` 0 lỗi (M7).

> ⚠️ **Pre-existing phát hiện khi verify:** `Phase1HAdminOrderApiTest` + `Phase1MPosApiTest` FAIL ở `BEFORE_TEST_CLASS` do `db/test-seed.sql` INSERT vào `products` **thiếu cột `version`** (`@Version` NOT NULL) → `NULL not allowed for column "version"`. Cả 2 file (test-seed.sql + ProductEntity) **không** bị đụng trong đợt này; lỗi xảy ra trước khi code M2/M3 chạy → **không phải regression**. M2/M3 verify bằng compile + code review (runtime cần rebuild container backend — chưa thực hiện vì là shared infra). → task riêng: cập nhật `test-seed.sql` thêm `version`.

### Đợt 4 — render FE còn lại (2026-06-11)

| Task | Nội dung | Trạng thái |
|---|---|---|
| **M9** | Trang chi tiết đơn của khách (`tai-khoan/don-hang/[id]/OrderDetailContent.tsx`) render `fulfillmentStatus` — thêm helper `fulfillmentStatusLabelWithT` + i18n vi/en cho 6 enum (UNFULFILLED…CANCELLED) + nhãn "Trạng thái giao hàng"; BE `OrderDetailResponse` đã trả sẵn field | ✅ Đã sửa |
| **M10** | Slider trang chủ dùng ảnh mobile riêng: `toHeroSlide` (`app/page.tsx`) map thêm `mobileSrc` từ `slider.mobileImage`; banner WP đã tách desktop (`<a>` background) ↔ mobile (`<span>` ≤767px) nên gán `<span>` ảnh mobile, fallback ảnh desktop | ✅ Đã sửa |
| **L25** | Thẻ slider admin (`SliderListScreen.jsx`) hiện **tên SP** thay vì mã `wp-prod-…`: `normalizeSlider` (`adminApi.js`) thêm `productName` từ `s.product.name` (BE `Slider` domain đã populate `product` qua `SliderReadService.toDomain`), screen ưu tiên `productName` fallback `productId` | ✅ Đã sửa |

**Verify đợt 4:** `bigbike-web` `tsc --noEmit` 0 lỗi + eslint sạch (chỉ warning CSS-link WP pre-existing) · `bigbike-admin` `vite build` PASS (10s) + eslint sạch. Cả 3 đều **FE-only** — field đã có sẵn ở BE, không đổi API/data contract. *(M10 hero nổi bật — nên verify visual khi chạy app.)*

**Còn lại (chưa xử lý):**
- **Thấp/cần BE field:** M13 (`featured` BE chưa hỗ trợ), L21 (`seo.noIndex` BE chưa có), L22 (attribute `kind=color` — đã có fallback theo tên).
- **Chờ quyết định:** Q3 (M15/M16 địa chỉ VN tĩnh), Q4 (severity H4). **Task riêng:** M17/L26 (WpFooter hardcode — port WP); test-seed.sql thiếu `version`.

> ⚠️ Pre-existing (không thuộc đợt sửa này): `CustomerDetailScreen.jsx:110` có lint error `react-hooks/set-state-in-effect` (do bump `eslint-plugin-react-hooks` 7.1.1) ở effect fetch coupon — **không phải** dòng đã sửa; nên xử lý ở task lint riêng.

---

## 1. Tóm tắt điều hành

### Trạng thái stack runtime đã test

| Service | Trạng thái | Ghi chú |
|---|---|---|
| bigbike-backend | Up (healthy) `:8080` | `GET /actuator/health` → 200 |
| bigbike-postgres | Up (healthy) `:5432` | data thật (sản phẩm/đơn/khách WP-import) |
| bigbike-minio | Up (healthy) `:9000` | |
| bigbike-web | Up (healthy) `:3000` | |
| bigbike-admin | Up (healthy) `:4000` | |
| redis | **không có trong compose** | backend không phụ thuộc; health vẫn 200 |

Đăng nhập admin runtime: `POST /api/v1/auth/login` với `admin@bigbike.vn` (seed `SUPER_ADMIN`). Customer-session **không** test runtime (không có credential khách seed; đăng ký mới sẽ tạo dữ liệu thật + gửi email) — các endpoint khách được verify **tĩnh theo DTO**.

### Bảng K1–K8

| Hạng mục | Kết quả | Blocker | High | Medium | Low |
|---|---|---|---|---|---|
| **K1** — API parity 2 chiều | ✅ PASS (có ghi chú) | 0 | 0 | 2¹ | 0 |
| **K2** — Mọi API trả 2xx (runtime) | ❌ FAIL | 0 | 1 | 0 | 0 |
| **K3** — FE đọc đúng tên field | ❌ FAIL | 0 | 2 | 6 | 3 |
| **K4** — FE gửi đúng tên field | ❌ FAIL | 0 | 1 | 0 | 0 |
| **K5** — FE nhận đủ field để render | ❌ FAIL | 0 | 0 | 6 | 2 |
| **K6** — FE không gửi field thừa | ❌ FAIL | 0 | 0 | 2 | 0 |
| **K7** — Không mock/hardcode | ❌ FAIL (chỉ web) | 0 | 0 | 3 | 1 |
| **K8** — Product-ready từng module | ❌ FAIL | 0 | 0 | 4 | 1 |
| **Tổng (đã loại trùng)** | | **0** | **4** | **~21** | **7** |

¹ 2 gap K1 (notification REST, content-categories CRUD) được tính trong K8 (M18, M19) để tránh đếm trùng.

**Kết luận nhanh:** **Không có Blocker.** Không endpoint nào FE gọi mà BE thiếu (3 nghi vấn ban đầu đều là false-positive). Luồng chính (catalog, giỏ, checkout, đơn, đăng nhập) chạy được. Vấn đề tập trung ở **sai tên field FE↔BE** (admin nặng hơn web) gây mất/sai dữ liệu âm thầm, và **một lỗi backend hệ thống** trả 500 thay vì 400 khi thiếu tham số bắt buộc.

### 4 phát hiện High

| ID | K | Vị trí | Tóm tắt |
|---|---|---|---|
| **H1** | K4 | `adminApi.js:713` | Đổi trạng thái đơn gửi key `reason`, DTO chỉ nhận `note` → **lý do huỷ/thất bại admin gõ bị mất** |
| **H2** | K3 | `adminApi.js:1289` | `normalizeShippingMethod` bỏ `freeShippingThreshold` + `titleEn` → mở form sửa ra trống → **lưu lại xoá mất ngưỡng free-ship & tên EN** |
| **H3** | K3 | `CustomerDetailScreen.jsx:499` | Đọc `c.amount` nhưng normalizer đổi tên thành `discountValue` → coupon của khách hiện **"undefined%"** |
| **H4** | K2 | `GlobalExceptionHandler` | Thiếu handler `MissingServletRequestParameterException` → **500 thay vì 400** khi thiếu `@RequestParam` bắt buộc (3 endpoint xác nhận) |

---

## 2. Ma trận API parity (K1)

**Quy mô:** 251 endpoint BE (unique) · 84 lời gọi từ `bigbike-web` (lib + BFF route + sweep trực tiếp) · 168 lời gọi từ `bigbike-admin` · 1 kênh WebSocket · 102 endpoint trong `API_CONTRACT.md`.

**Đối chiếu (chuẩn hoá path-param về wildcard):**
- **K1(a) — FE gọi mà BE thiếu:** **0 thật**. 3 nghi vấn đều false-positive (xem §3-K1).
- **K1(b) — BE mồ côi:** 28 endpoint không FE nào gọi → phân loại bên dưới; chỉ **2 là gap thật** (M18, M19).
- **BFF web:** 100% route `/api/...` của Next resolve (0 bff-client thiếu route).
- **WebSocket:** `bigbike-admin` subscribe `/ws` (STOMP) → khớp `WebSocketConfig` BE. OK.
- **Runtime resolve:** 61 endpoint GET test thật, 60 trả 200 (1 lỗi — xem K2).

### Bảng endpoint BE "mồ côi" (28) — phân loại

| Method | Path | Phân loại | Lý do |
|---|---|---|---|
| POST | /api/v1/admin/content/content-categories | **GAP (M19)** | admin không có UI tạo/sửa danh mục bài viết |
| PATCH | /api/v1/admin/content/content-categories/{id} | **GAP (M19)** | nt |
| GET | /api/v1/admin/notifications | **GAP (M18)** | NotificationBell chỉ WS+localStorage |
| POST | /api/v1/admin/notifications/mark-read | **GAP (M18)** | REST không có caller |
| POST | /api/v1/admin/notifications/mark-all-read | **GAP (M18)** | REST không có caller |
| POST | /api/v1/admin/content/articles | false-orphan | tiêu thụ qua path generic `/content/{type}` của adminApi |
| PATCH | /api/v1/admin/content/articles/{id} | false-orphan | nt |
| POST | /api/v1/admin/content/pages | false-orphan | nt |
| PATCH | /api/v1/admin/content/pages/{id} | false-orphan | nt |
| GET | /api/v1/admin/settings/{settingKey} | false-orphan | tiêu thụ qua `fetchSerialInventoryOnly('serial_inventory_only')` |
| DELETE | /api/v1/cart | valid-alias | BE `@DeleteMapping({"","/clear"})`; FE dùng `/cart/clear` |
| POST | /api/v1/admin/menus | valid-by-design | menu container system-defined; admin chỉ CRUD menu-item |
| PATCH | /api/v1/admin/menus/{menuId} | valid-by-design | nt |
| DELETE | /api/v1/admin/menus/{menuId} | valid-by-design | nt |
| GET | /api/v1/address/provinces | valid-web-static/mobile | web dùng dữ liệu tĩnh (M15/M16); mobile dùng BE |
| GET | /api/v1/address/provinces/{provinceCode}/districts | valid-web-static/mobile | nt |
| GET | /api/v1/address/districts/{districtCode}/wards | valid-web-static/mobile | nt |
| GET | /api/v1/customer/auth/oauth/{provider}/callback | valid-oauth-redirect | browser redirect 302, không phải fetch |
| POST | /api/v1/customer/auth/refresh | valid-mobile/session | web dùng cookie session; refresh có thể mobile |
| GET | /api/v1/admin/orders/{orderId}/notes | valid-embedded | notes nhúng trong order detail |
| GET | /api/v1/admin/admin-users/{id} | valid-list-driven | GET-detail; admin dùng data từ list |
| GET | /api/v1/admin/coupons/{couponId} | valid-list-driven | nt |
| GET | /api/v1/admin/inventory/serials/{serialId} | valid-list-driven | nt |
| GET | /api/v1/admin/media/{mediaId} | valid-list-driven | nt |
| GET | /api/v1/admin/shipping/zones/{id} | valid-list-driven | nt |
| GET | /api/internal/redirects/active | valid-internal | `proxy.ts` tiêu thụ server-side |
| GET | /actuator/health | valid-infra | health |
| GET | /v3/api-docs | valid-infra | OpenAPI |

### Runtime status (mẫu — đầy đủ ở Phụ lục §7)

| Nhóm | Số endpoint | Kết quả |
|---|---|---|
| GET admin (no-param, bearer) | 45 | 45 × 200 |
| GET public (no-param) | 16 | 16 × 200 |
| GET detail (param, ID thật) | 9 | 9 × 200 (product theo slug, reviews theo id, order/customer/coupon/media detail) |
| **GET thiếu required-param** | 3 | **3 × 500** (xem K2/H4) |

---

## 3. Chi tiết vi phạm (K1 → K8)

### K1 — Parity

**Không có vi phạm Blocker.** 3 nghi vấn "FE gọi endpoint BE không có" đã verify là false-positive:

| FE call | Sự thật BE | Evidence |
|---|---|---|
| `POST /admin/content/{contentType}` | runtime → `/content/articles` hoặc `/content/pages`, BE **có** | `adminApi.js:610` `normalizeContentMutationPath` chỉ sinh `articles`/`pages`; `AdminContentController.java:113,132` |
| `PATCH /admin/content/{contentType}/{id}` | nt, BE **có** typed PATCH | `adminApi.js:619`; `AdminContentController.java:122,141` |
| `GET /admin/settings/serial_inventory_only` | = `settings/{settingKey}`, BE **có** | `adminApi.js:1028`; `AdminSettingsController.java:51` |

Gap thật: **M18** (notification REST), **M19** (content-categories CRUD) — chi tiết ở K8.

### K2 — Runtime 2xx

**H4 — `GlobalExceptionHandler` không xử lý thiếu tham số bắt buộc → 500** · **High** *(theo nghĩa chặt của K2: 5xx = Blocker; hạ xuống High vì FE hiện guard nên không gãy UI)*
- **Endpoint xác nhận trả 500 (đáng lẽ 400):**
  - `GET /api/v1/admin/pos/products/search` (thiếu `q`) — `AdminPosController.java:55` `@RequestParam @Size(max=100) String q`
  - `GET /api/v1/search` (thiếu `q`) — `PublicSearchController`
  - `GET /api/v1/warranties/lookup` (thiếu `serial`) — `PublicWarrantyController`
- **Đối chứng:** `GET /api/v1/orders/lookup` thiếu `orderNumber` trả **400** đúng (controller validate thủ công).
- **Root cause:** log backend `ERROR ... Unhandled exception: MissingServletRequestParameterException: Required request parameter 'q' ... is not present` → rơi vào nhánh 500 `SERVER_ERROR` của `GlobalExceptionHandler`.
- **Tái hiện:** `curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080/api/v1/admin/pos/products/search" -H "Authorization: Bearer <token>"` → `500`. Thêm `?q=mu` → `200`.
- **Vì sao chưa gãy UI:** `PosScreen.jsx` có guard `if (!dq.trim()) return`; `adminApi.toQueryString` bỏ param rỗng nhưng UI không gọi khi rỗng; web search luôn set `q=` (chuỗi rỗng vẫn "present"). **Rủi ro:** bất kỳ client không guard (mobile, gọi API trực tiếp, code mới) đều kích hoạt 500.
- **Đề xuất:** thêm `@ExceptionHandler(MissingServletRequestParameterException.class)` (và `MethodArgumentTypeMismatchException`, `MissingServletRequestPartException`) trả 400 `VALIDATION_ERROR` trong `GlobalExceptionHandler`.

### K3 — FE đọc sai tên field

| ID | Sev | Vị trí FE | Endpoint | Mô tả | Evidence |
|---|---|---|---|---|---|
| **H2** | High | `adminApi.js:1289-1302` + `ShippingScreen.jsx:316,349` | GET `/admin/shipping/zones/{zoneId}/methods` | `normalizeShippingMethod` bỏ `freeShippingThreshold` và `titleEn`; form sửa đọc `m.freeShippingThreshold`/`m.titleEn` → luôn trống → **lưu lại ghi đè null, mất ngưỡng free-ship & tên EN** | BE trả field: `AdminShippingService.java:136,264`; normalizer thiếu 2 field |
| **H3** | High | `CustomerDetailScreen.jsx:499-500` | GET `/admin/customers/{id}/coupons` | Đọc `c.amount` nhưng `normalizeCoupon` xuất `discountValue` → PERCENT hiện `undefined%`, FIXED sai tiền | `contracts.js:776` `discountValue: toIntegerLocal(s.amount,0)`; đối chứng `CustomerPickerModal.jsx:223` dùng đúng `c.discountValue` |
| M1 | Medium | `ProductDetailScreen.jsx:306` | GET `/admin/products/{id}` | Đọc `groupName` của spec nhưng normalizer đặt tên `group` → nhóm thông số luôn trống; lưu lại có thể mất nhóm | normalizer spec dùng `group` |
| M2 | Medium | `OrderListScreen.jsx:251,288` | GET `/admin/orders` | Badge "POS" theo `order.source` nhưng list response không có `source` (chỉ có ở detail) → badge không bao giờ hiện ở danh sách | `contracts.js:649` đọc `s.source` |
| M3 | Medium | `PosScreen.jsx:442-443` | POST `/admin/pos/orders` | Hoá đơn in đọc `order.customerName/customerPhone` nhưng `PosOrderResponse` không trả 2 field này → dòng "Khách: ..." luôn trống | so `PosOrderResponse` |
| M4 | Medium | `MediaLibraryScreen.jsx:498` | GET `/admin/media` | Bộ đếm "Tìm thấy: N" đọc `pagination.total` nhưng envelope là `totalItems` → luôn hiện **0** dù có hàng nghìn ảnh | envelope `{data,pagination,meta}`, pagination dùng `totalItems` |
| M6 | Medium | `CustomerDetailScreen.jsx:507` | GET `/admin/customers/{id}/coupons` | Cột "số lần dùng" đọc `c.usageLimit` nhưng normalizer đổi thành `maxUsage` → luôn hiện "∞" | `normalizeCoupon` |
| L21 | Low | `app/tin-tuc/[slug]/page.tsx:79` | GET `/articles/{slug}` | Đọc `article.seo.noIndex` nhưng `SeoMeta` BE không có → luôn false (không đặt noindex được) | `SeoMeta` record |
| L22 | Low | `ProductDetailScreen.jsx:1177` | GET `/admin/attributes` | So `kind === 'color'` nhưng BE luôn trả `kind='select'`; còn chạy nhờ fallback theo tên | enum kind |
| L23 | Low | `contracts.js:333` | GET `/admin/products` | Đọc `contentBottom` — ghost field, BE không có; không nơi nào dùng | Product record |

### K4 — FE gửi sai tên field

**H1 — Đổi trạng thái đơn gửi `reason`, DTO nhận `note`** · **High**
- **FE:** `adminApi.js:713` `updateOrderStatus` → `body = { status }; if (reason) body.reason = reason`. `OrderDetailScreen.jsx:271-286` thu "lý do" qua `ReasonConfirmModal` khi chuyển `CANCELLED`/`FAILED`.
- **BE:** `UpdateOrderStatusRequest(@NotBlank String status, String note, Boolean customerVisible)` — **không có `reason`**. `AdminOrderService` lưu `req.note()`.
- **Hệ quả:** Jackson bỏ key lạ `reason` → **lý do huỷ/thất bại không được lưu thành ghi chú đơn**; mất truy vết nghiệp vụ.
- **Đề xuất:** đổi FE gửi `note` (hoặc thêm field `reason` vào DTO + map sang note). Đối chiếu `docs/business/STATE_MACHINES.md` (lý do chuyển trạng thái) và `API_CONTRACT.md` mục order status.

### K5 — FE thiếu render field nghiệp vụ

| ID | Sev | Vị trí FE | Endpoint | Field BE bị bỏ |
|---|---|---|---|---|
| M7 | Medium | `OrderHistoryContent.tsx:80-135` | GET `/customer/orders` | tên sản phẩm trong đơn — chỉ hiện `itemCount`, khách không thấy mua gì |
| M8 | Medium | `WpAccountNav.tsx`/`DashboardContent.tsx` | GET `/customer/me` | `emailVerified` — không có banner nhắc xác minh email |
| M9 | Medium | `OrderDetailContent.tsx:44-152` | GET `/customer/orders/{id}` | `fulfillmentStatus` — khách không thấy tiến trình giao hàng |
| M10 | Medium | `app/page.tsx:81-94` | GET `/sliders?location=home` | `mobileImage` — mobile vẫn dùng ảnh ngang desktop |
| M11 | Medium | `ProductDetailScreen.jsx` | GET `/admin/products/{id}` | `promotionContent` — admin không quản lý được nội dung Khuyến mãi (PDP web có hiển thị) |
| M12 | Medium | `contracts.js:604` + `OrderDetailScreen.jsx:554` | GET `/admin/orders/{id}` | `appliedCoupons` — admin chỉ thấy tổng giảm, không thấy mã nào đã áp |
| L24 | Low | `app/product/[slug]/page.tsx:102` | GET `/products/{slug}` | `promotionContent` + `installationGuide` không có tab/section trên PDP |
| L25 | Low | `SliderListScreen.jsx:89` | GET `/admin/sliders` | `product`/`productLink` — thẻ slider hiện `wp-prod-38469` thay vì tên SP |

### K6 — FE gửi field thừa

| ID | Sev | Vị trí FE | Endpoint | Field thừa |
|---|---|---|---|---|
| M13 | Medium | `public-api.ts:352-367` | GET `/articles` | `featured` — BE không định nghĩa → widget "Tin nổi bật" thực chất = "Tin mới nhất" |
| M14 | Medium | `ProductDetailScreen.jsx:492` | POST/PATCH `/admin/products` | option `sortOrder` — `VariantOptionRequest` không có → thứ tự option bị mất khi lưu |

*Cả hai vô hại về bảo mật (không phải role/price/status), nhưng sai chức năng.*

### K7 — Mock / hardcode (chỉ `bigbike-web`; `bigbike-admin` sạch — 0 finding)

| ID | Sev | Vị trí | Mô tả |
|---|---|---|---|
| M15 | Medium | `lib/vn-address-data.ts:4` | `VN_PROVINCES` hardcode (~500 dòng) thay cho `GET /address/provinces` — BE có endpoint nhưng web không gọi |
| M16 | Medium | `lib/vn-wards-static.ts:6` | `VN_WARDS` hardcode (~23KB) thay cho `GET /address/districts/{code}/wards` |
| M17 | Medium | `components/wp/WpFooter.tsx:152` | MST/GPKDKD `"41K8017383"` + ngày/nơi cấp viết cứng; BE có setting `tax_registration_number`; `SiteFooter.tsx:375` đã dùng i18n nhưng WpFooter (đang chạy thật) hardcode |
| L26 | Low | `components/wp/WpFooter.tsx:147` | Link giấy phép Bộ Công Thương + "Copyright © 2020" cố định |

> Lưu ý: dữ liệu địa chỉ tĩnh là **reference data**, không phải "fake business data" thuần — nhưng vì BE đã có API tương ứng, đây là lệch nguồn dữ liệu đáng hợp nhất. WpHeader/WpFooter hardcode business-data đã được biết là **task riêng** của đợt port theme WP.

### K8 — Product-ready theo module (chi tiết §4)

| ID | Sev | Module | Tiêu chí thiếu |
|---|---|---|---|
| H4→M | Medium | Catalog admin | Nút "Import CSV" (`ProductListScreen.jsx:276`) `disabled` cứng, không onClick — placeholder *(agent chấm High; hạ Medium: không hại dữ liệu, chỉ là tính năng chưa có)* |
| M18 | Medium | Notification center admin | `NotificationBell.jsx:35` chỉ WS+localStorage; REST `/admin/notifications` (V102, lưu bền) **0 caller** → admin offline/máy mới mất thông báo |
| M19 | Medium | Content admin | Không có UI tạo/sửa **danh mục bài viết**; `createCategory` trỏ `/admin/categories` (danh mục SP); POST/PATCH `content-categories` không caller |
| M20 | Medium | Content admin | Nút "Xuất CSV" (`ContentListScreen.jsx:82`) `disabled` cứng — placeholder |
| L27 | Low | Catalog (reviews web) | `ReviewsSection.tsx:453` `useQuery` không xử lý `isError` → lỗi tải đánh giá hiện thành "Chưa có đánh giá" |

---

## 4. Bảng product-ready theo module

Mock?: web có 4 điểm hardcode (M15–M17, L26); admin **sạch**. ✅ = đạt, ⚠️ = thiếu, — = không áp dụng.

### bigbike-web

| Module | Mock-free | Loading/Empty/Error | TODO/Placeholder | Action wired | Verdict |
|---|---|---|---|---|---|
| Catalog browse | ✅ | ⚠️ reviews thiếu error (L27) | ✅ | ✅ | gần đạt |
| Page hero banners | ✅ | ✅ | ✅ | — | ✅ |
| Search | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cart | ✅ | ✅ | ✅ | ✅ | ✅ |
| Checkout | ✅ | ✅ | ✅ | ✅ | ✅ |
| Customer account | ✅ | ✅ | ✅ | ✅ (thiếu render M7–M9) | gần đạt |
| Wishlist | ✅ | ✅ | ✅ | ✅ | ✅ |
| Product comparison | ✅ (localStorage by design) | ✅ | ✅ | ✅ | ✅ |
| Vietnam address lookup | ⚠️ tĩnh (M15/M16) | ✅ | ✅ | ✅ | gần đạt |

### bigbike-admin

| Module | Mock-free | Loading/Empty/Error | TODO/Placeholder | Action wired | Verdict |
|---|---|---|---|---|---|
| Catalog admin | ✅ | ✅ | ⚠️ Import CSV disabled | ⚠️ H2 ship?/M1 spec/M14 sortOrder | gần đạt |
| Order admin | ✅ | ✅ | ✅ | ⚠️ H1 reason mất / M2 badge / M12 coupon | gần đạt |
| Customer admin | ✅ | ✅ | ✅ | ⚠️ H3/M6 coupon hiển thị sai | gần đạt |
| Media admin | ✅ | ✅ | ✅ | ⚠️ M4 counter = 0 | gần đạt |
| Settings / Menu / Coupon / Inventory | ✅ | ✅ | ✅ | ✅ | ✅ |
| Returns / Redirect / Receivables / Audit | ✅ | ✅ | ✅ | ✅ | ✅ |
| POS | ✅ | ✅ | ✅ | ⚠️ M3 hoá đơn thiếu tên khách | gần đạt |
| Shipping admin | ✅ | ✅ | ✅ | ❌ H2 mất threshold/titleEn khi sửa | chưa đạt |
| Notification center | ✅ | ✅ | ✅ | ❌ M18 không dùng REST lưu bền | chưa đạt |
| Content admin | ✅ | ✅ | ⚠️ Export CSV disabled (M20) | ⚠️ M19 thiếu CRUD danh mục | chưa đạt |
| Admin order WebSocket | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 5. Danh sách task ưu tiên khắc phục

### P0 — Blocker
*Không có.*

### P1 — High

| # | Việc cần làm | File/Endpoint | Tiêu chí "done" |
|---|---|---|---|
| P1-1 | Thêm `@ExceptionHandler(MissingServletRequestParameterException)` (+ type-mismatch, missing-part) trả 400 `VALIDATION_ERROR` | `GlobalExceptionHandler` (BE) | `GET /admin/pos/products/search`, `/search`, `/warranties/lookup` thiếu param → **400** không phải 500; thêm test |
| P1-2 | Sửa FE đổi trạng thái đơn gửi `note` thay vì `reason` (hoặc thêm `reason` vào DTO map→note) | `adminApi.js:713`, `UpdateOrderStatusRequest` | Lý do huỷ/thất bại admin gõ được lưu thành ghi chú đơn; cập nhật `API_CONTRACT.md` mục order status nếu đổi DTO |
| P1-3 | Bổ sung `freeShippingThreshold` + `titleEn` vào `normalizeShippingMethod` | `adminApi.js:1289` | Mở form sửa phương thức ship hiện đúng ngưỡng & tên EN; lưu không xoá mất |
| P1-4 | Sửa `CustomerDetailScreen` đọc `discountValue`/`maxUsage` (đồng bộ `normalizeCoupon`) | `CustomerDetailScreen.jsx:499,507` | Coupon của khách hiện đúng % / số tiền / số lần dùng |

### P2 — Medium / Low

| # | Nhóm | Việc |
|---|---|---|
| P2-1 | K3 admin | Sửa tên field: spec `groupName`↔`group` (M1), order `source` ở list (M2), POS receipt `customerName/phone` (M3), media `total`↔`totalItems` (M4) |
| P2-2 | K5 web account | Render `emailVerified` banner (M8), `fulfillmentStatus` (M9), tên SP trong lịch sử đơn (M7), `mobileImage` slider (M10) |
| P2-3 | K5 admin | Hiện `promotionContent` form SP (M11), `appliedCoupons` order detail (M12), tên SP thẻ slider (L25) |
| P2-4 | K6 | Bỏ/triển khai `featured` articles (M13), thêm `sortOrder` vào `VariantOptionRequest` hoặc bỏ gửi (M14) |
| P2-5 | K7 web | Cân nhắc gọi `/address/*` thay dữ liệu tĩnh (M15/M16); chuyển MST/giấy phép footer sang Settings (M17/L26) |
| P2-6 | K8 admin | Bỏ/triển khai nút Import-CSV (catalog `ProductListScreen.jsx:276`) & Export-CSV (content `ContentListScreen.jsx:82`) đang disabled |
| P2-7 | K8 web | `ReviewsSection` xử lý `isError` (L27) |
| P2-8 | K3 low | Gỡ ghost field `contentBottom` (L23); xử lý `kind` color (L22); `seo.noIndex` (L21) |
| **P2-A** | K8 admin (✅ user xác nhận) | **Nối `NotificationBell` vào REST `/admin/notifications`** — `GET` lúc mount để nạp thông báo lưu bền, `mark-read`/`mark-all-read` khi đọc; giữ feed WS realtime bổ sung. Done: admin máy mới / sau offline thấy đủ thông báo backend đã lưu (M18) |
| **P2-B** | K8 admin (✅ user xác nhận) | **Thêm CRUD danh mục bài viết** — `createContentCategory`/`updateContentCategory` trong `adminApi.js` (đã có `POST/PATCH /admin/content/content-categories` ở BE) + UI quản lý. Done: admin tạo/sửa được danh mục bài viết, không chỉ chọn cái seed sẵn (M19) |
| **P2-C** | Test (✅ user xác nhận test cũ) | **Cập nhật `Phase1K1ContractHardeningTest`** — seed user `SUPER_ADMIN` hoặc cấp quyền `settings.write`/`menus.write` cho user test. Done: 4 test pass; không phải lỗi sản phẩm |

---

## 6. Cần xác nhận từ user

### Đã xác nhận (2026-06-11)

1. **Notification center (M18) → ✅ CẦN NỐI LẠI.** User xác nhận đây là **gap thật**, không phải thiết kế cố ý. Mục tiêu V102 ("admin offline không bỏ lỡ sự kiện") vẫn còn hiệu lực → phải nối `NotificationBell` vào REST `/admin/notifications` (list + mark-read + mark-all-read), kết hợp với feed WebSocket sẵn có. → **chuyển thành task P2-A (xem §5).**
2. **Danh mục bài viết (M19) → ✅ CÓ CẦN.** Admin **cần** tự tạo/sửa danh mục bài viết. → thiếu UI + thiếu hàm `createContentCategory`/`updateContentCategory` trong `adminApi.js`; endpoint BE `POST/PATCH /admin/content/content-categories` đã sẵn sàng. → **task P2-B (xem §5).**
3. **Contract-test hardening (§7.3) → ✅ TEST CŨ.** User xác nhận 4 test fail là **test lỗi thời** (seed user role `ADMIN` thiếu quyền granular), **KHÔNG phải regression phân quyền**. Sản phẩm không có lỗi ở đây. → **task bảo trì test P2-C** (cập nhật test seed `SUPER_ADMIN` hoặc cấp quyền), tách riêng, ưu tiên thấp.

### Còn mở (chưa quyết định)

4. **Địa chỉ VN tĩnh (M15/M16):** Giữ dữ liệu tỉnh/phường tĩnh ở web (nhanh, nhưng lệch khi sáp nhập hành chính) hay chuyển sang gọi `/address/*` của BE như mobile? *(mặc định hiện tại: giữ tĩnh — không chặn product-ready)*
5. **Severity H4 (500):** Theo nghĩa chặt của prompt (5xx = Blocker) nên xếp Blocker; báo cáo để **High** vì FE hiện guard. Xác nhận mức ưu tiên mong muốn cho P1-1.

---

## 7. Phụ lục

### 7.1 Cách lấy token & lệnh đã chạy (để user verify lại)

```bash
# Admin JWT (SUPER_ADMIN seed)
curl -s -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@bigbike.vn","password":"admin123"}'   # -> data.accessToken

# Health
curl -s http://localhost:8080/actuator/health                 # 200

# Lỗi 500 hệ thống (H4) — tái hiện
curl -s -o /dev/null -w "%{http_code}\n" \
  "http://localhost:8080/api/v1/admin/pos/products/search" \
  -H "Authorization: Bearer <token>"                          # 500 (thiếu q)
curl -s -o /dev/null -w "%{http_code}\n" \
  "http://localhost:8080/api/v1/admin/pos/products/search?q=mu" \
  -H "Authorization: Bearer <token>"                          # 200

# Container đã dùng (chỉ đọc): bigbike-backend, bigbike-postgres (psql SELECT), bigbike-minio
docker compose ps
docker logs bigbike-backend --since 5m   # đọc stacktrace MissingServletRequestParameterException
```

### 7.2 Endpoint đã test runtime (GET, read-only)

- **Admin (bearer), no-param — 45 endpoint, tất cả 200:** admin-users, attributes, audit-logs, products, categories(+tree), brands, content(+reference/categories,pages), coupons, customers(+summary), dashboard, home/category-highlights, home-videos, inventory(+grouped,summary,movements,export.csv,serials), media(+stats,tags), media-folders, menus, notifications, orders, permissions, product-assignment, receivables(+summary,aging), redirects, reports/analytics, returns, reviews, roles, settings, shipping/zones, sliders, warranties, auth/me.
- **Public, no-param — 16 endpoint, tất cả 200:** checkout/options, products, categories, catalog/facets, brands, articles, content-categories, pages, sliders, address/provinces, search?q=, search-suggest?q=, home/category-highlights, home-videos, settings/public, actuator/health.
- **Detail (param, ID thật) — 9 endpoint, tất cả 200:** admin products/{id}, orders/{id}, orders/{id}/notes, customers/{id}, customers/{id}/credit, coupons/{id}, media/{id}; public products/{slug}, products/{id}/reviews.
- **500 (thiếu required-param):** admin pos/products/search, public search, public warranties/lookup.
- **Không test runtime:** mọi mutation (POST/PUT/PATCH/DELETE) và endpoint customer-session — lý do: tránh phá dữ liệu thật / thiếu credential khách. Verify tĩnh theo DTO.

### 7.3 Trạng thái contract-test sẵn có

| Test | Kết quả | Ghi chú |
|---|---|---|
| `Phase1KOpenApiContractTest` | ✅ 12/12 PASS | OpenAPI doc, security scheme, envelope khớp |
| `Phase1K1ContractHardeningTest` | ❌ 4 FAIL (403) | seed user role `ADMIN` bị từ chối `settings.write`/`menus.write`/reorder → 403 thay vì 400/200 mong đợi. **✅ User xác nhận là TEST CŨ** (không phải regression phân quyền). Sản phẩm OK; cần cập nhật test (task P2-C). |

### 7.4 Đối chiếu tài liệu nguồn

- Endpoint chuẩn: `docs/engineering/API_CONTRACT.md` (Governance §, các bảng endpoint).
- Module: `docs/business/MODULE_CATALOG.md` (16 admin + 9 public module).
- Data shape envelope: list = `{data, pagination, meta}`, detail/error = `{data|error, meta}`; pagination dùng `totalItems` (liên quan M4).
- Đã tham chiếu (không xử lý lại): `docs/audits/PRODUCT_DATA_COMPLETENESS_AUDIT.md`, `price-zero-products.csv` (sản phẩm WP-import giá 0 / out-of-stock — là data completeness, không phải contract bug).

---

*Hết báo cáo. Tổng: 0 Blocker · 4 High · ~21 Medium · 7 Low. Khuyến nghị xử lý P1-1…P1-4 trước khi coi 2 FE là product-ready.*
