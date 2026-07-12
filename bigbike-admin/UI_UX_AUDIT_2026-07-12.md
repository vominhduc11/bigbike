# Audit UI/UX `bigbike-admin` — 2026-07-12

## 1. Trạng thái và phạm vi

- Giai đoạn: **AUDIT hoàn tất; chưa sửa source code**.
- Đối tượng audit: working tree hiện tại, gồm **78 file trong `src/screens/`** và **80 file trong `src/components/`**. File con không được nêu trong đề bài nhưng nằm trong các thư mục này cũng đã được kiểm.
- Working tree đã có nhiều thay đổi chưa commit từ trước khi audit. Báo cáo đánh giá đúng trạng thái hiện tại và không quy các thay đổi đó cho đợt audit này.
- Runtime được kiểm tra đọc-only trên Docker đang chạy. Bản Docker không mount source nên phần nhìn trực tiếp chỉ là bằng chứng bổ sung; kết luận chính dựa trên working tree hiện tại.
- Không thêm dependency, không sửa backend/web/docs canonical, không đổi API, query key, quyền hay state machine.

Đã đọc và áp dụng:

- `AGENTS.md`, `CLAUDE.md`.
- `docs/business/BUSINESS_RULES.md`: `TRANSLATION_RULE_001–003`, `PRODUCT_RULE_001–013`, `PAY_RULE_002`, `REPORT_RULE_008`.
- `docs/business/STATE_MACHINES.md`: order/payment/content/customer lifecycle và mục `NEEDS_VERIFICATION`.
- `docs/engineering/DATA_CONTRACT.md`: SKU, pricing, media/alt, inventory.
- `docs/engineering/PERMISSION_MATRIX.md`: dashboard, report và export.

## 2. Cách chấm

| Ký hiệu | Ý nghĩa |
|---|---|
| C1 | Giao diện rõ ràng, phân cấp và khoảng thở |
| C2 | Trải nghiệm, phản hồi, accessibility và responsive |
| C3 | Chống cảm giác “phải điền quá nhiều” |
| C4 | Tốc độ thao tác nhưng không mất năng lực |
| ✅ | Đạt |
| △ | Đạt một phần |
| ❌ | Chưa đạt |
| — | Không áp dụng trực tiếp |
| P0 | Có nguy cơ mất/sai dữ liệu, sai quyền, sai nghiệp vụ hoặc mất hẳn năng lực |
| P1 | Ảnh hưởng đáng kể tới thao tác, khả năng hiểu hoặc accessibility |
| P2 | Tinh chỉnh tính nhất quán, polish hoặc clean code |

## 3. Kết luận điều hành

| Tiêu chí | Kết luận | Bằng chứng chính |
|---|---|---|
| C1 — rõ, không rối | **Chưa đạt** | Product/Category/Banner/Settings còn dồn nhiều nhóm mở cùng lúc; variant 9 cột; nhiều control dày và hardcode style |
| C2 — dễ thao tác | **Chưa đạt** | Có lỗi ngôn ngữ ghi đè dữ liệu, trạng thái lỗi bị hiểu thành rỗng, modal/menu/table sai focus/keyboard, target chạm nhỏ |
| C3 — chống ngợp | **Chưa đạt** | Product đã có collapsible nhưng nhóm “bắt buộc” vẫn hơn 20 control; Category/Banner/Settings/Role còn form dài mở toàn bộ |
| C4 — đơn giản nhưng đủ năng lực | **Chưa đạt** | Mobile mất bulk selection/inline action/global search; một số thao tác 1 click nhưng kiểm điều kiện sai; một số CTA dẫn vòng 3–4 bước |

Điểm tốt cần giữ:

- Nền tảng loading/error/empty, recent items, URL-persisted filters, optimistic update và mobile-card đã có ở nhiều list.
- Product có local draft, autosave, restore draft, unsaved guard, Ctrl/Cmd+Enter, variant matrix và publish checklist.
- Content Detail có tab, autosave, slug/blur validation, SEO thu gọn.
- Media đi qua MinIO picker; video ngoài chỉ dùng đúng nhóm YouTube/TikTok/Facebook.
- Order Detail lấy allowed transitions từ backend; thao tác nguy hiểm phần lớn có confirm.
- `vi.json` và `en.json` có cùng 2.573 key; không thấy mojibake trong source đã đọc.

## 4. P0 và blocker phải xử lý trước

### 4.1 P0 có thể sửa trong UI, không đổi contract

1. **Product có thể ghi đè nội dung VI sang EN**: `ProductDetailScreen.jsx` không đưa `contentLang` vào key của Suitability/SizeGuide, trong khi editor chỉ seed state một lần. Đổi ngôn ngữ rồi sửa có thể ghi sai cột. Trái `TRANSLATION_RULE_003`.
2. **`AdminTable` làm mất bulk action trên mobile**: khi dùng `mobileCard`, checkbox chọn dòng biến mất. Brand, Content, Order và Redirect mất hẳn năng lực bulk trên màn hẹp.
3. **Keyboard của `AdminTable` kích hoạt hai hành động**: Enter/Space từ button/select/checkbox con bubble lên row, có thể vừa đổi trạng thái vừa mở chi tiết.
4. **Assignment Roles kẹt loading khi API lỗi**: nhánh `!baseline` chạy trước `isError`, nên error state không thể tới.
5. **Audit diff có thể báo sai “không thay đổi”**: object lồng nhau bị ép thành `[object Object]` ở cả hai phía.
6. **Role permission draft bị mất không cảnh báo** khi chọn role khác hoặc bấm Back trên mobile.
7. **BlockEditor render fallback HTML chưa sanitize**, tạo rủi ro chèn nội dung không an toàn trong admin.
8. **Ảnh media có thể bị thay thế ngay trên mọi nơi đang dùng** mà không có bước review/xác nhận trước.

### 4.2 Blocker canonical/contract — không được tự sửa

1. **Tên tiếng Anh bắt buộc hay tùy chọn**:
   - `BUSINESS_RULES.md` `TRANSLATION_RULE_002` và `PRODUCT_RULE_001` yêu cầu tên Product/Category/Brand cả VI lẫn EN.
   - Cùng file, `PRODUCT_RULE_005` lại nói mọi bản dịch tiếng Anh không bao giờ bắt buộc.
   - UI/schema hiện cũng tự mâu thuẫn: schema chặn thiếu EN, giao diện ghi “tùy chọn”, progress không tính EN và lỗi nằm trong tab ẩn.

2. **Alt text đang bị loại khỏi payload**:
   - Form cho nhập alt nhưng `product-detail/constants.js`, Category và Brand bỏ nhiều alt khi serialize.
   - `DATA_CONTRACT.md` và `API_CONTRACT.md` có hỗ trợ alt cho gallery/block/variant ở nhiều vị trí.
   - Khôi phục alt sẽ thay đổi dữ liệu gửi lên, trong khi đề bài cấm đổi payload nếu chưa được duyệt.

3. **Content `UNKNOWN → DRAFT`**: `content-detail/constants.js` tự map status lạ thành DRAFT; lưu lại có thể đổi trạng thái thật. Đây là vấn đề state/data contract.

4. **BACS tự chuyển PAID**:
   - UI/backend coi `ON_HOLD → PROCESSING` là đã nhận chuyển khoản và tự PAID.
   - `PAY_RULE_002` nói payment được cập nhật riêng; state machine không ghi side effect này.

5. **Lý do CANCELLED/FAILED**: UI bắt buộc `note`, nhưng request/docs đang nói tùy chọn. Copy còn nói FAILED “giải phóng tồn kho”, trái mô hình availability boolean V261/V262.

6. **Customer `DISABLED/BLOCKED`**: UI khẳng định chặn đăng nhập/mua hàng, nhưng `STATE_MACHINES.md` đánh dấu lifecycle này `NEEDS_VERIFICATION`.

7. **Category reorder không atomic**: frontend gửi từng request tuần tự; lỗi giữa chừng để lại thứ tự lưu dở. Muốn bảo đảm cần API batch/transaction.

8. **Permission export/dashboard**:
   - Order/Customer/Reports hiện có thể hiện export cho người không có `reports.export`, dẫn tới 403.
   - Frontend cho vào Dashboard bằng `orders.read`, trong khi backend còn giới hạn role.

9. **Report timezone**: kỳ trước và preset “hôm nay” dùng `toISOString()` từ local midnight, có thể lệch ngày, trái `REPORT_RULE_008` (`Asia/Ho_Chi_Minh`). Việc sửa tham số ngày cần giữ nguyên API nhưng phải xác nhận phạm vi regression.

10. **Review aggregate và workflow**: KPI đang tính theo page hiện tại nhưng trông như số toàn hệ thống; reply chưa tồn tại; lifecycle review còn `NEEDS_VERIFICATION`. Aggregate toàn cục hoặc reply cần backend.

## 5. Audit screens — auth, dashboard, reports, order, customer, review

| File | C1 | C2 | C3 | C4 | Mức | Kết luận |
|---|---:|---:|---:|---:|---|---|
| `LoginScreen.jsx` | △ | ❌ | △ | ✅ | P1 | Form gọn nhưng `noValidate` không có validate tương ứng; email sai/rỗng vẫn gọi API; lỗi mạng đánh dấu cả hai field; raw error; thiếu focus field lỗi và 2 key i18n |
| `AcceptInviteScreen.jsx` | ✅ | ❌ | △ | ✅ | P1 | Đủ validating/invalid/network/done; mọi API error bị gọi là token sai; lỗi field rỗng không inline; link raw `<a>`; thiếu focus/helper sớm |
| `DashboardScreen.jsx` | △ | ❌ | ✅ | △ | P1 | KPI/attention rõ; partial data có thể crash; lỗi inventory đồng thời hiện empty; KPI chưa drill-down với filter; số luôn `vi-VN`; mobile có thể hiện `undefined` |
| `dashboard/charts.jsx` | △ | ✅ | — | ✅ | P2 | Có summary/legend; ngày malformed thành `NaN/NaN`, format không theo locale; tooltip thiên về hover |
| `ReportsScreen.jsx` | △ | ❌ | — | ❌ | P0 | Lệch ngày do timezone; giới hạn 90 ngày không có trong backend làm mất năng lực; export được khi range chưa đủ; tab/date control và ranking chưa đúng; raw error |
| `OrderListScreen.jsx` | △ | ❌ | — | △ | P0/P1 | Fallback khách hàng sai; export bỏ payment filter; thiếu read-only warning; refetch vẫn cho action; mobile mất inline state/bulk; row keyboard bubbling |
| `OrderDetailScreen.jsx` | ✅ | ❌ | △ | △ | P0/P1 | BACS blocker; transition loading/stale; PAID→UNPAID một click không confirm; shipping thiếu label/expanded/dirty guard đầy đủ; note metadata bị loại |
| `order-detail/ReasonConfirmModal.jsx` | ✅ | ❌ | ❌ | △ | P0 | UX modal khá tốt nhưng tự bắt buộc lý do chưa canonical; loading vẫn trông đóng được; async confirm chưa guard nội bộ |
| `order-detail/constants.js` | ✅ | ❌ | — | △ | P0 | `REASON_REQUIRED` và BACS label thêm rule ngoài docs; unknown transition trả raw enum |
| `CustomerListScreen.jsx` | △ | ❌ | — | △ | P0/P1 | Customer lifecycle blocker; summary error thành skeleton vô hạn; fallback/avatar sai; mobile mất inline edit; export permission/filter sai; thiếu i18n/a11y |
| `CustomerDetailScreen.jsx` | ❌ | ❌ | △ | △ | P0 | Nhiều text hardcode; lifecycle chưa verified; thiếu read-only banner; field không phân biệt tùy chọn; thiếu limit/ARIA; recent order không click được; cache không invalidate đủ |
| `ReviewListScreen.jsx` | ❌ | ❌ | — | △ | P0/P1 | “Tổng quan” chỉ tính page hiện tại nhưng không ghi rõ; 1 sao không có reply; custom checkbox; spam/bulk spam thiếu confirm; filter stale; mobile/header dễ vỡ |
| `ReviewDetailScreen.jsx` | △ | ❌ | — | △ | P1 | Retry có thể bấm lặp; thiếu read-only feedback; spam từ APPROVED không confirm; không invalidate list; mất filter sau delete; fallback/hình/text dài chưa an toàn |

### Bước thao tác mục tiêu

| Tác vụ | Hiện tại | Sau sửa UI-only |
|---|---:|---:|
| Mở đơn chờ từ Dashboard | 2 bước | 1 bước bằng deep-link có filter |
| Đổi trạng thái đơn desktop | 1 bước | Giữ 1; thêm guard đúng |
| Đổi trạng thái đơn mobile | 2+ bước | 1 bước trong card |
| Mở đơn gần đây của khách | Khoảng 4 bước | 1 click |
| Approve review cần xử lý | 2 bước | 1 bước từ attention/filter |
| Bulk review | 3 bước | 2–3 bước, giữ confirm cho nguy hiểm |

## 6. Audit screens — sản phẩm và catalog

| File | C1 | C2 | C3 | C4 | Mức | Kết luận |
|---|---:|---:|---:|---:|---|---|
| `ProductListScreen.jsx` | △ | ❌ | — | △ | P0 | Quick publish kiểm sai giá/ảnh/EN; desktop dễ bấm nhầm, mobile thiếu action; read-only vẫn chọn row; native control/inline px |
| `product-list/cells.jsx` | ✅ | ✅ | — | ✅ | — | Cell rõ và dùng lại tốt; giữ nguyên |
| `product-list/constants.js` | ✅ | ✅ | — | ✅ | P2 | Có filter `homepageBlock` nhưng không có control/chip tương ứng |
| `ProductDetailScreen.jsx` | ❌ | ❌ | ❌ | △ | P0 | Nhóm bắt buộc vẫn quá dài; lỗi EN ẩn; key editor gây ghi đè ngôn ngữ; SKU/image badge sai; query phụ có lỗi bị hiểu là rỗng; SEO preview sai ngôn ngữ |
| `product-detail/Layout.jsx` | △ | △ | △ | △ | P1 | Collapsible trùng component chung, native button, unmount children nên editor local-state có thể reset |
| `product-detail/VariantEditors.jsx` | △ | ❌ | ✅ | △ | P1 | Bảng 9 cột không dùng được tốt trên mobile; query thuộc tính lỗi im lặng; input thiếu label; bulk không clear được sale price |
| `product-detail/ContentEditors.jsx` | △ | ❌ | ✅ | △ | P1 | Đổi provider xóa URL ngay; field dựa placeholder; alt gallery bị payload bỏ; native button |
| `product-detail/RowEditors.jsx` | △ | △ | ✅ | ✅ | P2 | Thiếu accessible label; tên icon hardcode; chạm giới hạn không giải thích |
| `product-detail/Modals.jsx` | ✅ | ✅ | ✅ | ✅ | P0 tích hợp | Checklist tốt nhưng dữ liệu readiness đầu vào đang sai/mâu thuẫn |
| `product-detail/constants.js` | — | ❌ | — | ❌ | P0 | Serializer làm mất alt; map lỗi thiếu `translations.*`; comment EN optional mâu thuẫn schema/docs |
| `product-detail/constants.test.js` | — | — | — | ❌ | P1 | Thiếu roundtrip test bảo toàn field/alt và test hai ngôn ngữ |
| `product-detail/variantOptionReselect.test.jsx` | — | — | — | ❌ | P1 | Test copy handler thay vì render component thật, có thể xanh giả |
| `FeaturedProductsScreen.jsx` | ✅ | △ | — | ✅ | P1 | Race khi đổi content language; Save bật khi không có thay đổi |
| `CategoryListScreen.jsx` | △ | △ | — | ✅ | P1/P0 contract | Loading/empty branch tree sai; row action dày; reorder không atomic; native table/button |
| `category-list/constants.js` | ✅ | ✅ | — | ✅ | P2 | Đệ quy breadcrumb không có cycle guard |
| `category-list/CategoryTableHead.jsx` | ✅ | ✅ | — | △ | P2 | Không sort; table riêng thay vì primitive chung |
| `category-list/CategoryEmptyState.jsx` | ✅ | ✅ | — | ✅ | P1 tích hợp | Component tốt nhưng parent mode khiến state ít khi hiện đúng |
| `CategoryDetailScreen.jsx` | ❌ | ❌ | ❌ | △ | P0 | Intro + bốn ảnh mở cùng lúc; lỗi EN ẩn; thiếu sticky save; `description` có trong payload nhưng không có UI |
| `category-detail/IntroContentField.jsx` | △ | ❌ | ❌ | △ | P0 | Legacy HTML có thể bị serialize mất phần không nhận diện; form dài; delete FAQ không confirm/undo; thiếu label |
| `category-detail/ProductsInCategoryCard.jsx` | ✅ | ❌ | — | △ | P1 | Query error hiện như empty; CTA thêm sản phẩm dẫn vòng khoảng 4 bước |
| `category-detail/DangerZoneCard.jsx` | ✅ | ✅ | — | ✅ | P2 | Chỉ còn inline token cần dọn |
| `category-detail/constants.js` | — | ❌ | — | ❌ | P0 | Bỏ alt ảnh/OG khi lưu |
| `category-detail/SeoCard.jsx` | — | — | — | — | — | File đã bị xóa trong working tree; component chung thay thế được audit ở phần component |
| `BrandListScreen.jsx` | △ | ❌ | — | ✅ | P1 | Hide không confirm/undo nhưng delete có; hidden/trash nhập nhằng; raw English error; native action |
| `BrandDetailScreen.jsx` | △ | ❌ | △ | △ | P0/P1 | Lỗi EN ẩn; mất alt; optional description/media luôn mở; clear SEO chưa chắc chắn; save chỉ ở đầu trang |

### Thiết kế lại Product Detail đề xuất

1. **Bước 1 — Nhận diện:** tên VI/EN, slug, SKU, danh mục, thương hiệu, giới tính.
2. **Bước 2 — Bán hàng:** ảnh chính, giá chung hoặc giá biến thể, availability/status.
3. **Bước 3 — Nội dung tùy chọn:** mô tả, gallery, trust, thông số, size, video.
4. **Bước 4 — SEO và kiểm tra đăng:** tách “đủ để lưu nháp” khỏi “còn thiếu trước khi đăng”.

Form đơn giản hiện cần khoảng 8–10 lần nhập/chuyển và buộc quét hơn 20 control cùng lúc. Thiết kế mới **không giảm dữ liệu** nhưng mỗi bước chỉ 5–7 control; lưu nháp vẫn 1 action, đăng tối đa 2–3 bước ngắn. Variant matrix, bulk, media picker và draft vẫn giữ nguyên. Mobile chuyển mỗi variant thành card, không loại SKU/giá/status/media/options.

## 7. Audit screens — nội dung, marketing, media, cài đặt, quyền, audit log

| File | C1 | C2 | C3 | C4 | Mức | Kết luận |
|---|---:|---:|---:|---:|---|---|
| `ContentListScreen.jsx` | △ | △ | — | ✅ | P1 | `/null` có thể xuất hiện; native controls; thiếu key; nền tảng list/filter/bulk tốt |
| `ContentDetailScreen.jsx` | ✅ | △ | ✅ | ✅ | P2/P1 | Tab/autosave/slug/SEO tốt; còn native control, missing key và vài raw error |
| `content-detail/ContentAssignmentBanner.jsx` | △ | ❌ | — | △ | P1 | Query loading/error im lặng, dễ hiểu nhầm chưa có assignment |
| `content-detail/constants.js` | — | ❌ | — | ❌ | P0 contract | Map UNKNOWN→DRAFT có thể đổi trạng thái khi lưu |
| `SliderListScreen.jsx` | △ | △ | ❌ | ✅ | P1 | Bảy group đều mở; sort default tốt nhưng vẫn chiếm chỗ; thiếu read-only feedback |
| `BannerScreen.jsx` | ❌ | △ | ❌ | △ | P1 | Ba page + default, VI/EN đều mở; cần tab page/language và collapse optional; hardcode text |
| `HomeVideoListScreen.jsx` | △ | ❌ | △ | △ | P1 | Cancel mất draft; `Promise.all` có thể lưu một phần; custom modal/radio wrap kém |
| `HomeHighlightsScreen.jsx` | △ | △ | △ | ✅ | P1 | Ba slot là mô hình tốt; còn hardcode, native buttons và missing key không fallback |
| `RedirectListScreen.jsx` | △ | ❌ | △ | △ | P1 | Advanced fields luôn mở; cancel mất draft; batch có thể thành partial save |
| `MenuScreen.jsx` | △ | ❌ | △ | △ | P1 | Hardcode/null `.toLowerCase` crash risk; query error bị nuốt; tree ngang khó dùng mobile |
| `menu/ItemForm.jsx` | △ | △ | ❌ | △ | P1 | Sáu field cùng hiện; nên giữ label/URL cốt lõi và collapse bốn field tùy chọn |
| `menu/Modal.jsx` | △ | △ | △ | ✅ | P1 | Custom modal; cần Radix focus/description/dirty guard |
| `menu/SortableMenuItem.jsx` | △ | △ | — | ✅ | P2 | Native action, arbitrary style, target nhỏ |
| `menu/constants.js` | — | △ | — | ✅ | P2 | Hardcoded label/fallback cần i18n |
| `MediaLibraryScreen.jsx` | ✅ | △ | — | △ | P1 | Filter tốt; page-size lặp; view toggle thiếu tab semantics; hard delete chưa guard lỗi reference đầy đủ |
| `media-library/UploadQueue.jsx` | ✅ | △ | — | △ | P2 | Thiếu progressbar ARIA; có thể dismiss item còn pending |
| `media-library/constants.js` | ✅ | ✅ | — | ✅ | — | Mapping/filter ổn; giữ nguyên |
| `SettingsScreen.jsx` | △ | △ | ❌ | △ | P1 | Tab tốt nhưng tab Hero/Banner cao >3.100px và nhiều section mở; cancel/draft/read-only chưa rõ |
| `settings/SettingField.jsx` | △ | △ | △ | ✅ | P1 | Metadata/label kỹ thuật; helper chưa chuyển sang ngôn ngữ nghiệp vụ |
| `settings/SettingTabPanel.jsx` | △ | △ | ❌ | △ | P1 | Các section đều mở; thiếu sticky action; cần summary và collapse optional |
| `settings/constants.js` | — | △ | — | ✅ | P1/P2 | Metadata hardcode, cần đưa đủ vào VI/EN |
| `AdminUsersScreen.jsx` | △ | ❌ | △ | △ | P1 | Role fetch error bị nuốt; raw role code; modal close mất draft; toggle double-submit; sort chỉ page hiện tại |
| `AssignmentRolesScreen.jsx` | △ | ❌ | ❌ | △ | P0 | Error branch unreachable; sáu card cùng mở; thiếu inline validation/cancel; sticky style inline |
| `RolesScreen.jsx` | △ | ❌ | △ | △ | P0 | Draft permission mất khi đổi role/back; catalog load `Promise.all` không chịu lỗi từng phần |
| `roles/Badge.jsx` | ✅ | ✅ | — | ✅ | — | Nhỏ, rõ, giữ nguyên |
| `roles/ConfirmSensitiveDialog.jsx` | ✅ | ✅ | ✅ | ✅ | — | Confirm nhạy cảm và copy tốt |
| `roles/CreateRoleDialog.jsx` | △ | ❌ | △ | △ | P1 | Slug tiếng Việt có thể tạo ID xấu; đóng modal mất draft |
| `roles/DeleteRoleDialog.jsx` | ✅ | ✅ | ✅ | ✅ | — | Guard và confirm tốt |
| `roles/PermGroup.jsx` | △ | △ | △ | ✅ | P1 | Nhóm permission nên thu gọn/summary; target chạm và copy còn kỹ thuật |
| `roles/RoleDetail.jsx` | △ | ❌ | ❌ | △ | P1/P0 tích hợp | Tất cả group mở; cancel/đổi role làm mất draft; cần dirty guard |
| `roles/RoleSidebar.jsx` | △ | △ | — | ✅ | P2 | Native action/arbitrary style; mobile selection cần focus rõ |
| `roles/RoleSummaryCard.jsx` | ✅ | ✅ | — | ✅ | — | Summary hữu ích, giữ nguyên |
| `roles/SaveSummaryDialog.jsx` | ✅ | ✅ | ✅ | ✅ | — | Review trước save tốt |
| `roles/Toast.jsx` | ❌ | △ | — | ✅ | P1 | Tone info đang render đỏ; hardcoded/native control |
| `roles/constants.js` | ✅ | △ | — | ✅ | P2 | Mapping giữ được; cần loại fallback kỹ thuật/hardcode |
| `AuditLogListScreen.jsx` | △ | △ | — | △ | P1 | Sort/export chỉ page hiện tại; deep link chỉ tìm page hiện tại; locale cố định; native control |
| `audit-log-list/AuditCard.jsx` | △ | ✅ | — | ✅ | P2 | Tone không đồng nhất shared status |
| `audit-log-list/AuditDetailDrawer.jsx` | △ | ❌ | — | ❌ | P0 | Nested diff thành `[object Object]`, có thể báo sai không thay đổi |
| `audit-log-list/MobileFilterDrawer.jsx` | △ | ❌ | — | △ | P1 | Không dùng Dialog; thiếu trap focus/Escape/body lock và date validation |
| `audit-log-list/cells.jsx` | ✅ | △ | — | ✅ | P2 | Trùng tone mapping thay vì dùng nguồn chung |
| `audit-log-list/constants.js` | ✅ | △ | — | ✅ | P2 | Fallback/locale cần thống nhất |

## 8. Audit shared components — shell, layout, table, status, primitives

### 8.1 Shell và điều hướng

| File | C1 | C2 | C3 | C4 | Mức | Kết luận |
|---|---:|---:|---:|---:|---|---|
| `AdminShell.jsx` | △ | ❌ | — | △ | P1 | Drawer đóng vẫn tabbable; menu semantics/focus sai; partial user roles có thể crash; 4 key i18n thiếu; focus mode chỉ Product/Content |
| `GlobalSearch.jsx` | ❌ | ❌ | — | ❌ | P1 | Bị ẩn hoàn toàn trên mobile; lỗi API thành empty; Ctrl+K không reset/restore focus; custom dialog; `SKU TBD` hardcode |
| `NotificationBell.jsx` | △ | ❌ | — | △ | P1 | Menu keyboard/focus sai; “Xóa tất cả” chỉ local rồi server nạp lại; lỗi bị nuốt; date/event unknown không fallback tốt |
| `LanguageSwitcher.jsx` | ✅ | △ | — | ✅ | P1/P2 | Native button, aria hardcode, target nhỏ |
| `ThemeToggle.jsx` | ✅ | △ | — | ✅ | P2 | Semantics tốt, target 32px dưới 44px |
| `RecentItemsChips.jsx` | △ | △ | — | ✅ | P1 | Một click hữu ích; native target nhỏ, thiếu group label, text dài không giới hạn |

### 8.2 `layout/*`

| File | C1 | C2 | C3 | C4 | Mức | Kết luận |
|---|---:|---:|---:|---:|---|---|
| `layout/FilterBar.jsx` | ✅ | △ | — | ✅ | P2 | Hiện không có consumer; `FilterField` chưa nối label rõ với trigger |
| `layout/FormField.jsx` | ✅ | △ | ✅ | ✅ | P2 | Hỗ trợ helper/error/count tốt; child tự có ID có thể lệch `htmlFor` auto-ID |
| `layout/index.js` | — | — | — | — | P2 | Export `FilterBar/FilterField/SummaryCard/Grid` không có consumer |
| `layout/MobileCardList.jsx` | ✅ | △ | — | △ | P1 | Thiếu list semantics/selection slot; native/inline style; subtitle có thể bị mất |
| `layout/Modal.jsx` | △ | △ | ✅ | ✅ | P1 | Close label hardcode; description import nhưng không nối; footer chưa wrap/full-width mobile |
| `layout/Screen.jsx` | △ | ✅ | — | ✅ | P2 | `maxWidth` inline hardcode thay semantic layout token |
| `layout/ScreenHeader.jsx` | ✅ | ✅ | — | ✅ | — | H1/action wrap rõ, giữ nguyên |
| `layout/StickyActionBar.jsx` | ❌ | △ | ✅ | ✅ | P1 | Rule full-width mobile chỉ target `.btn`, không áp cho shadcn Button; toolbar/live status chưa đúng |
| `layout/SummaryCard.jsx` | ✅ | △ | — | △ | P2 | Không có consumer; `0` trend/hint bị ẩn; mọi clickable đều bị coi toggle |
| `layout/Tabs.jsx` | ✅ | ❌ | ✅ | △ | P1 | Tự dựng tab thiếu roving/Arrow/Home/End/aria-controls; nên bọc Radix và giữ API |

### 8.3 Table, filter, status

| File | C1 | C2 | C3 | C4 | Mức | Kết luận |
|---|---:|---:|---:|---:|---|---|
| `AdminTable.jsx` | ✅ | ❌ | — | ❌ | P0 | Mobile mất selection; `<th>/<tr role=button>` phá semantics; nested interactive; row keyboard bubbling; hardcode aria |
| `BulkActionBar.jsx` | △ | △ | — | ✅ | P1 | Nút bị ép 26px/radius hardcode; nhiều action làm thanh mobile quá cao |
| `ColumnVisibilityToggle.jsx` | ✅ | △ | — | △ | P1/P2 | Cho ẩn toàn bộ cột, không có reset default |
| `FilterChips.jsx` | △ | ❌ | — | ✅ | P1 | Hardcode/native; remove target 16px; aria không nói chip nào |
| `FilterSearchInput.jsx` | △ | ❌ | — | ✅ | P1 | 9/10 caller thiếu accessible name; cao 30px và dùng radius thumb |
| `FilterSelect.jsx` | △ | △ | — | ✅ | P1 | Cao 30px/radius xs; aria optional |
| `PageSizeSelect.jsx` | △ | ✅ | — | ✅ | P2 | Logic tốt; kế thừa target nhỏ |
| `PaginationControls.jsx` | △ | △ | — | ✅ | P1/P2 | Dày trên mobile; nút 28px; jump sai bị xóa im lặng; hardcode kích thước |
| `ExportButton.jsx` | ✅ | △ | — | ✅ | P2 | Busy tốt; raw error message; thiếu success pattern chung |
| `StatePanel.jsx` | ✅ | ✅ | — | ✅ | P2 | Designed states tốt; radius chưa dùng card token |
| `StatusBadge.jsx` | △ | △ | — | ✅ | P1 | Một số unknown/null render raw enum; publish/stock fallback đã tốt |
| `ScreenSkeleton.jsx` | △ | ❌ | — | ✅ | P1 | `aria-hidden` toàn bộ, screen reader không biết đang tải; skeleton list dùng cho form gây layout shift |

### 8.4 Banner, toast, preview

| File | C1 | C2 | C3 | C4 | Mức | Kết luận |
|---|---:|---:|---:|---:|---|---|
| `ReadOnlyBanner.jsx` | ✅ | ✅ | — | ✅ | — | Localized/status tốt, giữ nguyên |
| `AssignmentBanner.jsx` | △ | ✅ | — | ✅ | P2 | Màu vai trò phụ thuộc vị trí, dễ bị hiểu là success/danger; arbitrary/inline style |
| `OrderNotificationToast.jsx` | △ | ❌ | — | ✅ | P1 | Tối đa 5 assertive alerts; timer không pause/cleanup đầy đủ; partial data hiện undefined; có thể che sticky action |
| `LivePreview.jsx` | ❌ | ❌ | ✅ | △ | P1 | Non-modal nhưng trap focus, keyboard không quay lại form; header tràn mobile; raw error; aside thiếu name |
| `ErrorBoundary.jsx` | ✅ | ❌ | — | △ | P1 | Toàn bộ text hardcode; Retry dễ lặp lại cùng lỗi; thiếu đường về trang an toàn |

### 8.5 `components/ui/*`

| File | C1 | C2 | C3 | C4 | Mức | Kết luận |
|---|---:|---:|---:|---:|---|---|
| `ui/alert.jsx` | ✅ | △ | — | ✅ | P1 | Mọi tone dùng `role=alert`; dismiss target nhỏ |
| `ui/badge.jsx` | ✅ | ✅ | — | ✅ | — | Token/tone/radius tốt |
| `ui/button.jsx` | △ | △ | — | ✅ | P1 hệ thống | Size 28/36/40px đều dưới touch target 44px |
| `ui/checkbox.jsx` | △ | △ | — | ✅ | P1 | Root 16×16, standalone hit area quá nhỏ |
| `ui/dialog.jsx` | ✅ | △ | ✅ | ✅ | P1 | Close hardcode và target nhỏ; radius chưa semantic card |
| `ui/dropdown-menu.jsx` | ✅ | △ | — | ✅ | P2 | Radix tốt; item thấp và radius chưa semantic control |
| `ui/input.jsx` | △ | ✅ | — | ✅ | P2 | Semantics tốt; 36px hơi nhỏ trên mobile |
| `ui/label.jsx` | ✅ | ✅ | — | ✅ | — | Đạt |
| `ui/popover.jsx` | ✅ | ✅ | — | ✅ | — | Đạt |
| `ui/radio-group.jsx` | △ | △ | — | ✅ | P2 | Item 16px; phụ thuộc caller mở hit area |
| `ui/select.jsx` | △ | △ | — | ✅ | P1/P2 | Radix tốt; trigger/item dưới 44px |
| `ui/switch.jsx` | △ | △ | — | ✅ | P2 | Root nhỏ, phụ thuộc label |
| `ui/table.jsx` | ✅ | ✅ | — | ✅ | P2 | Semantics tốt; còn arbitrary translate/z-index |
| `ui/tabs.jsx` | △ | ✅ | ✅ | ✅ | P1 mobile | Radix đúng; list không overflow-x với nhãn dài |
| `ui/textarea.jsx` | ✅ | ✅ | — | ✅ | P2 | Còn arbitrary `min-h` |
| `ui/tooltip.jsx` | ✅ | ✅ | — | ✅ | — | Đạt |

## 9. Audit shared components — form, editor và media

| File | C1 | C2 | C3 | C4 | Mức | Kết luận |
|---|---:|---:|---:|---:|---|---|
| `AiHtmlBrief.jsx` | ✅ | △ | ✅ | ✅ | P2 | Brief/copy hữu ích; collapse thiếu controls ID; target 28px; radius chưa card token |
| `BlockEditor.jsx` | △ | ❌ | ✅ | △ | P0/P1 | Fallback HTML chưa sanitize; legacy fallback biến mất khi thêm block; unknown block thành card trống |
| `block-editor/blocks.jsx` | △ | ❌ | △ | △ | P0/P1 | Language local-state corruption ở Suitability/SizeGuide; field dựa placeholder; provider đổi xóa URL; size cells thiếu header; unknown/readonly chưa rõ |
| `block-editor/constants.js` | ✅ | ✅ | ✅ | ✅ | — | Vocabulary/factory rõ; giữ nguyên |
| `CollapsibleSection.jsx` | ✅ | △ | ✅ | △ | P1 | Native button; unmount children có thể reset editor/ẩn validation; hint mobile biến mất |
| `ConfirmDialog.jsx` | ✅ | ✅ | ✅ | ✅ | — | Radix, focus nguy hiểm và localized tốt |
| `DetailSection.jsx` | △ | ✅ | ✅ | ✅ | P2 | Legacy CSS class thay inline Tailwind; thiếu API heading level linh hoạt |
| `DropdownPopover.jsx` | ✅ | ✅ | — | ✅ | P2 | Collision handling tốt; inline width/maxHeight nên cân nhắc token/CSS variable wrapper |
| `ImageUrlInput.jsx` | △ | ❌ | ✅ | ✅ | P0 | `ImagePreview` gọi `url.trim()` không guard; partial data `undefined` làm crash; error chưa nối ARIA |
| `ImportProductsDialog.jsx` | ✅ | △ | ✅ | ✅ | P1 | Step flow tốt; thiếu progress indicator; raw errors; có thể close khi commit; preview table thiếu caption/live state |
| `PasswordInput.jsx` | ✅ | △ | ✅ | ✅ | P1 | Native button, inline padding; target/primitive chưa thống nhất |
| `RichTextEditor.jsx` | △ | ❌ | △ | △ | P1 | Toolbar icon thiếu aria-label/group; link dialog thiếu validation/focus; error/placeholder chưa nối ARIA; control nhỏ |
| `RichTextEditorWithSource.jsx` | ✅ | ❌ | ✅ | △ | P0/P1 | Mode chỉ seed lần đầu; chuyển source→visual có thể strip HTML nâng cao; disabled không cho inspect source; thiếu label/error/count |
| `SectionCard.jsx` | ✅ | △ | ✅ | ✅ | P1 | Cố định h3 gây hierarchy H1→H3; cần heading level hợp ngữ cảnh |
| `SeoCard.jsx` | △ | ❌ | ✅ | ✅ | P0/P1 | Gọi `.trim/.length` trên value có thể undefined; validation chưa ARIA; native collapse; placeholder canonical hardcode |
| `Sortable.jsx` | ✅ | △ | — | ✅ | P1 | Keyboard DnD có nhưng handle native; thiếu dragCancel; screen-reader instructions mặc định có thể English |
| `TagInput.jsx` | △ | ❌ | ✅ | ✅ | P1 | Suggestion không có combobox/listbox/arrow navigation; fetch error biến thành empty; target chip rất nhỏ |
| `MediaCard.jsx` | △ | ❌ | — | △ | P0/P1 | `role=button` card chứa nested buttons; selection label chung; copy URL có thể nối origin vào URL tuyệt đối |
| `MediaCardSkeleton.jsx` | △ | △ | — | ✅ | P2 | Inline grid/radius; thiếu trạng thái loading cho screen reader |
| `MediaDetailModal.jsx` | △ | ❌ | △ | △ | P1 | Trùng logic panel; close mất dirty state; save luôn enabled; custom dialog |
| `MediaDetailPanel.jsx` | △ | ❌ | △ | △ | P0/P1 | Replace file có hiệu lực ngay chưa review; route navigation chưa dirty guard; copy URL sai với URL tuyệt đối; raw errors |
| `MediaFolderSidebar.jsx` | △ | ❌ | — | △ | P1 | Load/error/pending chưa rõ; label checkbox lặp; tag thiếu aria-pressed; folder input thiếu accessible label |
| `MediaListRow.jsx` | △ | ❌ | — | △ | P1 | Trùng action logic card; icon chỉ title; copy URL tương tự; nested interaction/selection chưa sạch |
| `media-picker/pickerIcons.jsx` | ✅ | ✅ | — | ✅ | — | Icon decorative đúng `aria-hidden` |
| `media-picker/pickerUtils.js` | ✅ | ✅ | — | ✅ | P2 | Helper tốt; fallback `—` hardcode nhỏ |
| `media-picker/useModalBehavior.js` | △ | ❌ | — | △ | P1 | Effect phụ thuộc `onClose`; callback inline làm trap tái khởi tạo/cướp focus; nên giữ callback trong ref |
| `MediaPickerModal.jsx` | △ | ❌ | △ | △ | P1/P0 | Custom modal; close/backdrop khi upload/selection không guard; raw errors; selection thiếu aria-pressed; filename trùng làm sai progress; fetch phụ lỗi im lặng |
| `MediaPreviewLightbox.jsx` | △ | ❌ | — | △ | P1 | Thiếu body lock; native/arbitrary overlay; video/audio có thể autoplay; focus semantics chưa hoàn chỉnh |
| `MediaRequirementHint.jsx` | ✅ | ✅ | ✅ | ✅ | — | Gợi ý kích thước/rule rõ, giữ nguyên |
| `VideoPickerModal.jsx` | △ | ❌ | △ | △ | P1/P0 | Các lỗi dialog/upload/selection tương tự MediaPicker; validation loading chưa giải thích; offscreen selection sau filter/page |
| `ProductPickerCombobox.jsx` | △ | ❌ | — | △ | P1 | Không có combobox/listbox/arrow navigation; native item; image resolver/radius chưa thống nhất |

## 10. i18n, CSS, accessibility và responsive

### i18n

- Hai locale có cùng tập 2.573 key, nhưng static scan thấy **223 literal key được gọi mà không tồn tại trong cả hai file**. Nhiều chỗ dựa `defaultValue`, vẫn vi phạm yêu cầu cập nhật song song và có thể làm English UI hiện tiếng Việt.
- Nhóm catalog có khoảng 90 key thiếu; content/admin/shared/operations có thêm nhiều key thiếu, gồm `AdminShell`, Login, Reports, Order, Customer, Review và HomeHighlights.
- Hardcode đáng chú ý: Customer Detail, Banner, HomeHighlights, Menu, Settings constants, Roles Toast, ErrorBoundary, placeholder/canonical URL, `SKU TBD`, fallback `Unknown`.

### CSS và design system

- Static scan trong screen/component tìm thấy **144 native `<button>`** và **123 inline `style={{...}}`**. Primitive nội bộ được phép dùng native element, nhưng nhiều consumer lẽ ra phải dùng shadcn `Button`, Dialog, Tabs hoặc token.
- Ngoài token file có khoảng **77 hardcoded hex/rgba**, **46 hardcoded numeric radius** và 8 `!important`; cần phân loại overlay/preview thực sự cần trước khi dọn.
- Comment trong token còn ghi “orange” trong khi primary canonical là đỏ.
- Dead CSS đã grep không có source ref trực tiếp: `.bb-btn-danger`, `.bb-btn-danger-ghost`, `.bb-label`, `.sort-ind`, `.bb-stack-sm`, `.bb-detail-actions`, `.menu-slot-missing`, `.menu-search-box`, `.menu-search-icon`, `.menu-search-clear`, `.audit-danger-banner`. Chỉ xóa sau khi kiểm dynamic/runtime selector lần cuối.
- `FilterBar`, `FilterField`, `SummaryCard`, `SummaryCardGrid` hiện không có consumer; cần quyết định xóa hay dùng lại, không giữ export chết.

### Accessibility/responsive

- Hệ control 16–40px chưa đạt touch target 44px trên mobile.
- Các lỗi hệ thống ưu tiên: AdminTable semantics/nested interactive, tabs tự dựng, menu/drawer focus, custom media dialogs, search mobile bị ẩn, mobile bulk bị mất, sticky action không full-width đúng.
- Product mobile không overflow ngang nhưng assignment banner chiếm gần trọn viewport đầu; field đầu tiên nằm dưới fold. Variant 9 cột cần card mobile.
- Media card hiện là “button chứa nhiều button”, cần tách navigation và action regions.

## 11. Kiểm tra runtime và quality gate nền

Runtime read-only đã kiểm:

- Docker stack đang healthy; không start/restart service.
- Login, Dashboard, Product list, Product create, Settings/Hero-Banner và Media Library.
- Product create desktop: khoảng 14 input và 52 control đang nhìn thấy, document cao khoảng 2.541px.
- Product create mobile 390px: document khoảng 3.173px, không overflow ngang; assignment banner đẩy field đầu khỏi viewport đầu.
- Settings Hero/Banner: document khoảng 3.128px; sáu section mở, khoảng 24 button, nhiều input không có accessible label.
- Media Library: 12.388 item; DOM xác nhận card có nested buttons và page-size lặp.

Quality gate nền trên working tree hiện tại, **trước khi sửa**:

- `npm run lint`: pass.
- `npm run test`: pass — 11 file, 114 test.
- `npm run build`: pass — Vite build 2.812 modules.
- Đây chưa phải kiểm chứng sau sửa. Mỗi nhóm sửa sau này phải chạy lại lint/test/build và smoke tương ứng.

## 12. Kế hoạch sửa sau khi blocker được chốt

1. P0 bảo toàn dữ liệu: content-language editor, BlockEditor sanitize, undefined guards, audit diff, role/assignment dirty/error states.
2. Product Detail: stepper/progressive disclosure, draft-vs-publish readiness, mobile variants, lỗi EN hiện đúng nơi.
3. Category/Brand/Content/Settings/Order Detail: collapse, sticky action, inline validation, dirty guard, designed query errors.
4. AdminTable + shared primitives: mobile selection/action, row semantics, tabs/dialog/menu/focus, 44px touch targets.
5. Lists: quick action đúng, filter drill-down, read-only, stale-fetch guard, mobile parity.
6. Media: dialog/selection/replace confirmation, keyboard, URL handling, upload progress/error.
7. i18n VI/EN, token/CSS hygiene, dead code và tests regression.
8. Chạy lint/test/build, kiểm missingKey/mojibake/dead CSS, smoke desktop/mobile/loading/empty/error/read-only/permission/long data.

## 13. Những gì cố tình giữ nguyên

- Endpoint, request/response shape, react-query keys, permission gate, state transition, server autosave và backend behavior.
- Product local draft/autosave, variant matrix, bulk helpers, publish checklist, media picker và filter persistence.
- Order allowed transitions từ backend; không tự chế transition mới.
- Category tree implementation riêng trong đợt ngắn hạn; thay hoàn toàn bằng `AdminTable` là refactor rủi ro cao.
- Không thêm inline price/stock writer nếu chưa có API được duyệt.
- Không tự sửa các blocker contract ở mục 4.2.

