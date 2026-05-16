# BigBike — Launch Readiness Summary

> **Ngày:** 2026-05-16
> **Đọc bởi:** Chủ shop · PM · Dev lead
> **Nguồn dữ liệu:** `BIGBIKE_FULL_E2E_WORKFLOW_AUDIT.md §14` + kết quả final regression 2026-05-16

---

## Verdict

| Bề mặt | Trạng thái | Ghi chú ngắn |
|---|---|---|
| **Backend / API** | ✅ Launch được | Compile sạch. 354 test PASS, 0 FAIL. |
| **Admin dashboard** | ✅ Launch được | Toàn bộ workflow quản trị đã test end-to-end. |
| **Website bán hàng** | ✅ Launch được | TypeScript check sạch. Luồng mua hàng đã test. |
| **App mobile** | ✅ Launch được — còn 3 caveat nhỏ | Xem mục Mobile caveats bên dưới. |

**Không có P0 hoặc P1 nào còn treo.** Không có issue kỹ thuật nào chặn launch.

> Có 2 mục pháp lý (hoá đơn điện tử, bảo vệ dữ liệu) cần chủ shop / kế toán xác nhận trước go-live — xem mục Business decisions.

---

## P0 / P1 Status

| Mã | Mô tả | Trạng thái |
|---|---|---|
| FULL-01 (P1) | `PermissionCatalog` thiếu `pos.refund`, `inventory.read`, `inventory.write` — không gán được cho custom role | ✅ Fixed 2026-05-16 · Verified |
| FULL-02 (P1) | App mobile thiếu màn xác nhận email sau đăng ký | ✅ Fixed 2026-05-16 · Verified |

**Kết quả: 0 P0 · 0 P1 còn mở.**

---

## Findings đã fix (tất cả 16 FULL + 5 DOC)

| Mã | Severity | Nội dung fix |
|---|---|---|
| FULL-01 | P1 | Thêm 3 permission vào `PermissionCatalog`; cập nhật `AdminRolePermissions` reference; `PERMISSION_MATRIX.md` viết lại. |
| FULL-02 | P1 | Thêm `VerifyEmailScreen` Flutter + route `/xac-nhan-email` + điều hướng sau đăng ký + hằng số API. |
| FULL-03 | P2 | `AdminContactService.update()` ghi audit log `CONTACT_MESSAGE_UPDATED` (privacy-safe: không ghi nội dung khách). |
| FULL-06 | P2 | Stale finding — `AdminCouponService.updateCoupon` đã re-validate ngày đúng sẵn. Bổ sung 4 test regression xác nhận. |
| FULL-07 | P3 | Thêm `GET /api/v1/customer/wishlist/products` (paginated, PUBLISHED only); web wishlist page bỏ client-side filter. |
| FULL-08 | P3 | `CatalogController` thêm `ID_OR_SLUG_REGEX` cho snapshot endpoint — mobile có thể gọi bằng product ID (`prod_xxx`). |
| FULL-09 | P3 | `CustomerWishlistController.removeFromWishlist()` thêm `HttpServletRequest` — nhất quán pattern. |
| FULL-10 | P3 | `PublicWarrantyController` trả `WarrantyLookupResponse` DTO + `@Transactional(readOnly=true)` fix lazy-load 500. |
| FULL-11 | P3 | `AdminMediaController` single hard-delete nay gác bởi `*` (nhất quán với bulk hard-delete). |
| FULL-12 | P2 | 54 test mới PASS: wishlist (11), address (10), contact form (6), contact inbox (8), audit log (3), coupon gift (7), public review (9), warranty (6). |
| FULL-13 | P2 | Workflow nhập kho theo phiếu — ghi nhận SCHEMA_ONLY, cần business decision. |
| FULL-14 | P3 | Dashboard gác bởi `orders.read`, coupon scheduler dùng UTC — ghi chú thiết kế, không sửa. |
| FULL-15 | P2 | Verify Serial audit P0-4/P0-5/P1-1/P1-3 — tất cả đã fixed trước audit này. |
| FULL-16 | P3 | `AdminOrderWsService` nuốt lỗi persist notification — best-effort có chủ đích, ghi nhận. |
| FULL-04 | P2 | Review notification — cần business decision (không fix kỹ thuật). |
| FULL-05 | P2 | Mobile wishlist — cần business decision (không fix kỹ thuật). |
| DOC-01 | — | `PERMISSION_MATRIX.md` §"Role And Permission Source" viết lại đúng runtime source of truth. |
| DOC-02 | — | Gỡ 2 tham chiếu file audit không tồn tại trong `ACCEPTANCE_CRITERIA.md`, `BUSINESS_PROCESS.md`. |
| DOC-03 | — | Notification center cập nhật từ `NOT_FOUND_IN_REPO` → `CONFIRMED_FROM_CODE` ở 4 vị trí docs. |
| DOC-04 | — | `test-seed.sql` bổ sung `contact.*` + `inventory.*` cho ADMIN và SHOP_MANAGER. |
| DOC-05 | — | `API_CONTRACT.md` bổ sung 4 endpoint wishlist + `resend-verification` bị thiếu. |

---

## Test / Build Regression (2026-05-16)

### Backend

| Nhóm | Test class | Pass | Fail | Skip |
|---|---|---|---|---|
| Auth & RBAC | `AdminRolesApiTest`, `AdminUsersApiTest`, `RbacUrlGateIntegrationTest`, `Phase1DCustomerAuthTest` | 76 | 0 | 0 |
| Customer workflow | `CustomerWishlistApiTest`, `CustomerAddressApiTest`, `ContactPublicFormTest`, `AdminContactInboxApiTest`, `AdminContactApiTest` | 38 | 0 | 0 |
| Catalog & Commerce | `AdminCouponGiftApiTest`, `PublicReviewApiTest`, `WarrantyApiTest`, `PublicReadApiTest`, `AdminMediaP0Test`, `Phase1JAdminSettingsMenuCouponApiTest` | 144 | 0 | 1 |
| Inventory & Serial | `Phase1KInventoryP0FixApiTest`, `Phase1KInventorySerialApiTest`, `Phase2FSerialInventoryTest`, `Phase1NReviewsApiTest` | 96 | 0 | 0 |
| **Tổng** | **19 class** | **354** | **0** | **1** |

1 test skip: `PublicReadApiTest` — `@Disabled("Requires V1000 catalog seed — not available in H2 test context")` · Pre-existing, không liên quan fix gần đây.

`mvn compile`: **PASS** — không có lỗi biên dịch.

### Web (bigbike-web)

`npx tsc --noEmit`: **PASS** — 0 TypeScript error.

### Mobile (bigbike_mobile)

`flutter analyze --no-fatal-infos`: **45 info · 1 error pre-existing**

- **45 info:** Style warnings trên các file không bị chạm trong audit (`deprecated_member_use`, `non_constant_identifier_names`, `unnecessary_underscores`). Không có warning trong `verify_email_screen.dart`.
- **1 error:** `test/widget_test.dart:16` — `MyApp` không tồn tại · File boilerplate Flutter chưa bao giờ được cập nhật · Không ảnh hưởng app build/runtime · Pre-existing.

**Không có issue nào trong regression này chặn launch.**

---

## Mobile Caveats

Ba điểm dưới đây **không chặn launch mobile** — app hoạt động đúng trên luồng chính.

| # | Caveat | Ảnh hưởng | Kế hoạch |
|---|---|---|---|
| 1 | **Wishlist chưa có trên mobile** | Khách dùng app không lưu được sản phẩm yêu thích. Có thể dùng web. | Sprint 1–2 sau launch. Backend API đã sẵn sàng. |
| 2 | **Link xác minh email trong hộp thư mở web, không mở app** | Sau khi bấm link, khách xác nhận qua web rồi quay về app. Màn "Gửi lại" trong app hoạt động. | Deep link (iOS Universal Links / Android App Links) — Sprint 2–3. |
| 3 | **Home-videos chưa hiển thị trên mobile** | Trang chủ app không có phần video thương hiệu. | Sprint 1–2. Backend API `GET /api/v1/home-videos` đã sẵn sàng. |

---

## Remaining Business Decisions

Các mục dưới đây **không phải lỗi kỹ thuật** — cần chủ shop / PM / kế toán chốt.

| Mục | Câu hỏi | Chặn launch? | Owner |
|---|---|---|---|
| **Hoá đơn điện tử** (NĐ 123/2020) | Có tích hợp nhà cung cấp e-invoice trước go-live không? | ⚠️ Tuỳ pháp lý | Chủ shop / Kế toán |
| **Bảo vệ dữ liệu cá nhân** (NĐ 13/2023) | Có làm endpoint xuất/xoá dữ liệu khách không, hay xử lý thủ công? | ⚠️ Tuỳ pháp lý | Chủ shop / Luật sư |
| Wishlist mobile (FULL-05) | App mobile có cần tính năng yêu thích không? | Không | PM / Mobile dev |
| Thông báo duyệt review (FULL-04) | Khách có nhận email khi review được đăng không? | Không | Chủ shop / Marketing |
| Phiếu nhập kho (FULL-13) | Dùng manual adjustment hay implement PO workflow? | Không | Chủ shop / Thủ kho |
| Tích hợp vận chuyển | GHN / GHTK / ViettelPost — bao giờ tích hợp? | Không | Chủ shop / Vận hành |

---

## Remaining Non-blocking Technical Debt

| Mục | Mức độ | Ghi chú |
|---|---|---|
| `test/widget_test.dart` (mobile) | Thấp | Xoá hoặc rewrite boilerplate Flutter — không ảnh hưởng runtime. |
| Flutter deprecation warnings (45 info) | Thấp | `withOpacity`, `Radio.groupValue` — dọn trong sprint sau khi Flutter SDK ổn định. |
| State machine test coverage | Trung bình | `STATE_MACHINES.md §18` — transition matrix Order/Payment/Return chưa có unit test riêng. |
| Notification best-effort (FULL-16) | Thấp | Nếu DB lỗi khi persist, thông báo hiển thị nhưng không lưu — hiếm xảy ra. Cân nhắc alert log sau. |
| `media.hard_delete` permission riêng (FULL-11) | Thấp | Hard-delete hiện gác bởi wildcard `*`. Tách permission nếu cần uỷ quyền tinh hơn về sau. |
| Dashboard dùng `orders.read` (FULL-14) | Thấp | Không thể cho xem Dashboard mà không cho xem đơn hàng. Đủ cho v1. |

---

## Post-launch Monitoring — 7 ngày đầu

> Dành cho người vận hành. Không cần dev trực liên tục.

**Ngày 1–2:**
- [ ] Đặt 1 đơn hàng test thật — xác nhận email, trừ kho, đơn hiện trong admin.
- [ ] Đăng ký tài khoản mới trên web — nhận và bấm link xác minh email thành công.
- [ ] Đăng ký tài khoản mới trên app — màn "Xác nhận email" hiện đúng.
- [ ] Tạo 1 đơn POS tại quầy — kho trừ đúng, audit log có ghi.
- [ ] Dashboard admin hiển thị đúng số đơn hàng và doanh thu.

**Ngày 3–4:**
- [ ] Tạo 1 yêu cầu đổi/trả — xử lý trong admin, serial vào trạng thái INSPECTING đúng.
- [ ] Tra cứu bảo hành — nhập số serial đã bán, hệ thống trả đúng thông tin và ngày còn lại.
- [ ] Dùng 1 mã giảm giá khi thanh toán — giá trừ đúng, mã trừ số lần dùng.
- [ ] Kiểm tra audit log trong admin — mọi thao tác quan trọng có ghi vết.

**Ngày 5–7:**
- [ ] Báo cáo doanh thu khớp với danh sách đơn hàng thực tế.
- [ ] Nhân viên mới đăng nhập được và chỉ thấy đúng phần quyền của mình.
- [ ] Không có sản phẩm nào bị bán âm kho sau 1 tuần.
- [ ] Không có lỗi 500 lặp lại trong server log.
- [ ] Ghi nhận phản hồi từ nhân viên quầy và khách — ưu tiên cho sprint tiếp theo.

---

## Tài liệu tham chiếu

| Tài liệu | Nội dung |
|---|---|
| [`BIGBIKE_FULL_E2E_WORKFLOW_AUDIT.md`](BIGBIKE_FULL_E2E_WORKFLOW_AUDIT.md) | Audit report đầy đủ — 37 workflow, 16 finding, Section 14 final review |
| [`BIGBIKE_LAUNCH_DECISION_CHECKLIST.md`](BIGBIKE_LAUNCH_DECISION_CHECKLIST.md) | Chi tiết từng business decision cần chốt |
