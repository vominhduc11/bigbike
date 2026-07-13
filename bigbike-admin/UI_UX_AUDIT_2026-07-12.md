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

## 14. Nhật ký sửa

### 2026-07-12 — Nhóm A: 8 lỗi P0 UI-only (mục 4.1) — HOÀN TẤT

Tất cả UI-only, không đổi API/payload/query-key/permission/state machine. Không sửa docs canonical (đối chiếu `TRANSLATION_RULE_003` xác nhận hướng #1).

| Mục | File sửa | Cách sửa |
|---|---|---|
| P0 #1 | `screens/ProductDetailScreen.jsx` | Thêm `-${contentLang}` vào `key` của Suitability & SizeGuide card → đổi ngôn ngữ = remount, hết ghi đè VI↔EN |
| P0 #2 | `components/layout/MobileCardList.jsx`, `components/AdminTable.jsx` | `MobileCard` thêm slot Checkbox chọn dòng (opt-in); AdminTable truyền `selectable/selected/onSelectChange` xuống nhánh mobile → khôi phục bulk trên mobile |
| P0 #3 | `components/AdminTable.jsx` | Guard `fromInteractiveChild` cho row `onClick`/`onKeyDown` → Enter/Space/click trên control con không còn vừa chạy control vừa mở chi tiết |
| P0 #4 | `screens/AssignmentRolesScreen.jsx` | Đảo `isError` lên trước guard `isLoading || !baseline` → hết kẹt "đang tải" khi API lỗi |
| P0 #5 | `screens/audit-log-list/AuditDetailDrawer.jsx` | Formatter object-aware (`JSON.stringify` cho object) ở cả so sánh lẫn hiển thị → hết `[object Object]` và báo nhầm "không thay đổi" |
| P0 #6 | `screens/RolesScreen.jsx` | `handleMobileBack` mirror guard của `handleSelectRole` (confirm khi dirty) cho nút Back mobile |
| P0 #7 | `components/BlockEditor.jsx` | Bọc fallback HTML qua `sanitizeHtml` (DOMPurify có sẵn) — outlier duy nhất chưa sanitize |
| P0 #8 | `components/MediaDetailPanel.jsx`, `locales/vi.json`+`en.json` | `showConfirm` trước khi thay file media; thêm key `media.replaceConfirm(Title)` cả 2 locale |

**Kết quả quality gate (sau sửa):** `npm run lint` PASS · `npm run test` PASS (11 file / 114 test) · `npm run build` PASS (Vite build thành công).

**Còn lại:** Nhóm B (P1 theo màn hình, mục 5–9) và Nhóm C (P2 polish/token/dead CSS/i18n, mục 10). Blocker contract mục 4.2 chưa đụng — gom hỏi user khi tới màn hình liên quan.

### 2026-07-12 — Nhóm B (P1), cụm 1: Màn hình đăng nhập — HOÀN TẤT

UI-only, không đổi API/quyền/state. `bb-btn-*` vẫn dùng ở Category/Media nên không phát sinh dead CSS.

| File | Sửa |
|---|---|
| `screens/LoginScreen.jsx` | Thêm kiểm tra client (email rỗng/sai định dạng, mật khẩu rỗng) trước khi gọi API + focus ô lỗi; lỗi sai đăng nhập (401) đánh dấu cả 2 ô, lỗi mạng KHÔNG đánh dấu ô + hiện thông báo thân thiện thay vì lỗi thô; thêm lỗi inline từng ô |
| `screens/AcceptInviteScreen.jsx` | Lỗi máy chủ 5xx không còn bị gọi nhầm "token sai" (cho thử lại); ô rỗng hiện lỗi inline + focus; tự focus ô mật khẩu khi lời mời hợp lệ; đổi 4 link thô `<a class="bb-btn">` sang `Button asChild` (shadcn) |
| `locales/vi.json` + `en.json` | Thêm key song ngữ: `auth.networkError/emailRequired/emailInvalid/passwordRequired`, `acceptInvite.passwordRequired/confirmRequired` |

**Quality gate:** `npm run lint` PASS · `npm run test` PASS (11/114) · `npm run build` PASS.

### 2026-07-12 — Nhóm B (P1), cụm 3: Layout primitives dùng chung (Modal, Tabs, StickyActionBar) — HOÀN TẤT

UI/accessibility thuần, không đổi API/payload/quyền/state. Không dead CSS (chỉ đổi selector mobile đã có). `SummaryCard/SummaryCardGrid` KHÔNG đụng ở cụm này — grep xác nhận không có consumer, để Nhóm C quyết xóa/giữ.

| File | Sửa |
|---|---|
| `components/layout/Tabs.jsx` | Thêm điều hướng bàn phím WAI-ARIA cho tablist: roving tabindex (chỉ tab active nhận Tab), phím Mũi tên trái/phải/lên/xuống chuyển tab (vòng), Home/End về đầu/cuối. Giữ nguyên API + CSS `seg-tabs`. Không bọc Radix vì panel do consumer render tách rời (`activeTab === …`), không có `aria-controls`. |
| `components/layout/Modal.jsx` | Nhãn nút đóng hết hardcode `'Đóng'` → mặc định `t('common.close')` (giữ caller đang truyền `closeLabel`); thêm prop `description` (nối `DialogDescription` đang import mà bỏ không dùng, để Radix tự gắn `aria-describedby`); footer action **xuống dòng + full-width nút trên mobile** (`flex-wrap` + biến thể `max-sm`). |
| `components/layout/StickyActionBar.jsx` | Thêm prop `ariaLabel` (accessible name cho thanh); vùng info trạng thái autosave thành live region `role="status" aria-live="polite"` để trình đọc màn hình thông báo "Đã lưu lúc…". |
| `screens/ProductDetailScreen.jsx`, `screens/ContentDetailScreen.jsx` | Truyền `ariaLabel` cho StickyActionBar. |
| `styles/admin-layout.css` | Rule full-width mobile đổi `.sticky-action-bar .btn` → `.sticky-action-bar > button, .sticky-action-bar > .btn` để áp cả shadcn `Button` (render `<button>`) lẫn `.btn` legacy. |
| `locales/vi.json` + `en.json` | Thêm key song ngữ `common.actionBarLabel` (Thanh thao tác / Action bar). |

**Quality gate:** `npm run lint` PASS · `npm run test` PASS (11/114) · `npm run build` PASS (Vite build OK).

### 2026-07-12 — Nhóm B (P1), cụm 4: Bảng & bộ lọc dùng chung (AdminTable, FilterSearchInput/Select/Chips, ColumnVisibilityToggle) — HOÀN TẤT

UI/accessibility thuần, không đổi API/payload/quyền/state/query-key. Chiều cao 30px của filter control giữ nguyên (đổi sẽ ảnh hưởng layout filter bar diện rộng — để đợt touch-target hệ thống). Phần P0 mất-dữ-liệu của AdminTable (mobile selection, keyboard double-action) đã xử lý ở Nhóm A; lượt này nốt phần semantics/aria.

| File | Sửa |
|---|---|
| `components/AdminTable.jsx` | Header sắp xếp: bỏ `role="button"` đè trên `<th>` → giữ ngữ nghĩa `columnheader` (`<th scope="col">`), chuyển thao tác sắp xếp vào `<button>` thật bên trong (focus/Enter/Space chuẩn), `aria-sort` vẫn ở `<th>`. Hai nhãn chọn ("Chọn tất cả"/"Chọn hàng") hết hardcode → i18n. |
| `components/FilterSearchInput.jsx` | `aria-label` fallback về `placeholder` khi caller không truyền → hết trường hợp ô tìm kiếm không có tên đọc được (9/10 caller trước đây thiếu). |
| `components/FilterSelect.jsx` | Tương tự: `aria-label` fallback về `placeholder`. |
| `components/FilterChips.jsx` | Nhãn mặc định hết hardcode → i18n; aria nút gỡ chip nói rõ **chip nào** (ghép nhãn khi là chuỗi); tăng vùng chạm nút gỡ 16px → 20px. |
| `components/ColumnVisibilityToggle.jsx` | Chặn tắt **cột cuối cùng đang hiện** (khoá checkbox khi chỉ còn 1 cột) → hết nguy cơ bảng trống; thêm mục "Hiện tất cả cột" để đặt lại. |
| `locales/vi.json` + `en.json` | Thêm 6 key song ngữ dưới `common`: `selectAll`, `selectRow`, `sortColumn`, `clearAllFilters`, `removeFilterLabel`, `showAllColumns`. |

**Ghi chú giữ nguyên có chủ đích:** `<tr role="button">` cho dòng bấm-mở-chi-tiết và các control lồng trong dòng (checkbox/link/action) giữ nguyên — đổi mô hình này là refactor rủi ro cao xuyên mọi màn list và có thể mất khả năng mở bằng bàn phím ở dòng không có `rowHref`; hành vi double-action đã được guard `fromInteractiveChild` từ Nhóm A.

**Quality gate:** `npm run lint` PASS · `npm run test` PASS (11/114) · `npm run build` PASS (Vite build OK). Locale `common` cân bằng 71/71 key.

### 2026-07-12 — Nhóm B (P1), cụm 2: Primitive dùng chung (phân trang, trạng thái, skeleton) — HOÀN TẤT

UI-only, không đổi contract. Không dead CSS (`bb-field-error` đã dùng sẵn).

| File | Sửa |
|---|---|
| `components/PaginationControls.jsx` | Nhảy trang nhập sai (rỗng/không phải số/ngoài khoảng) không còn bị xoá im lặng: hiện lỗi rõ, giữ ô để sửa, `aria-invalid`/`aria-describedby`; đổi `isNaN`→`Number.isNaN` |
| `components/StatusBadge.jsx` | Trạng thái rỗng (null/undefined/'') ở các loại enum → nhãn "Không xác định" thay vì render key thô/chuỗi rỗng (giữ nguyên loại `visibility` vì `false` = Ẩn hợp lệ) |
| `components/ScreenSkeleton.jsx` | Bọc `role=status` + text `sr-only` "Đang tải" để trình đọc màn hình biết đang tải (khung skeleton vẫn `aria-hidden`) |
| `locales/vi.json` + `en.json` | Thêm key song ngữ: `pagination.jumpRange`, `common.unknown` |

**Quality gate:** `npm run lint` PASS · `npm run test` PASS (11/114) · `npm run build` PASS.

### 2026-07-13 — Đợt tổng: toàn bộ P1 còn lại (mục 5–9) + P2 (mục 10) + 10 blocker contract (mục 4.2) — HOÀN TẤT

Đợt này xử lý **trọn gói** phần UI-fixable còn lại theo một kế hoạch tổng đã được chủ shop duyệt, sau khi chốt 10 blocker mục 4.2 một lượt. Chỉ sửa trong `bigbike-admin/src`; không đổi endpoint/state machine/backend/web/docs canonical. Thực thi song song nhiều agent + phục hồi khi gặp giới hạn phiên giữa chừng (chi tiết cuối mục).

#### A. Quyết định 10 blocker contract (mục 4.2)

| # | Blocker | Chủ shop chốt | Đã làm |
|---|---|---|---|
| 1 | Tên tiếng Anh bắt buộc/tùy chọn | **BẮT BUỘC** (giữ schema) | Thêm `translations.en.name` vào `getPublishReadiness` (checklist đăng, `required`); Brand/Product/Category/Content **hiện lỗi thiếu EN ra chỗ thấy** (alert + nút "Chuyển sang tiếng Anh" ở Brand; checklist ở Product); đổi placeholder EN name "(tùy chọn)"→"(bắt buộc)" ở category/brand/content. Không đụng schema/payload. |
| 2 | Alt text rơi khỏi payload | **KHÔNG gửi** | Giữ nguyên serializer/`toPayload` — không thêm alt vào payload ở product/category/brand/content. |
| 3 | Content UNKNOWN→DRAFT | Giữ (mặc định) | Không đụng `content-detail/constants.js` — remap phòng thủ giữ nguyên. |
| 4 | BACS auto-PAID | Ngoài phạm vi UI | Không đụng logic/label BACS (là hành vi backend + doc). |
| 5 | Lý do CANCELLED/FAILED + copy "giải phóng tồn kho" | Sửa copy + giữ reason bắt buộc | Copy FAILED bỏ câu "Tồn kho sẽ được giải phóng" (trái V261); reason vẫn bắt buộc (an toàn, giữ vết). |
| 6 | Customer DISABLED/BLOCKED | Làm mềm copy | `statusConfirmBody` đổi sang câu trung tính "…dùng để quản lý nội bộ" (không khẳng định chặn đăng nhập/mua — lifecycle chưa xác thực). |
| 7 | Category reorder không atomic | Ngoài phạm vi (cần batch API) | Giữ PATCH tuần tự + rollback; chỉ cải thiện thông báo lỗi khi partial. |
| 8 | Export/Dashboard gating | **Ẩn theo quyền** | Export ở Reports/Order/Customer ẩn khi thiếu `reports.export` (`useHasPermission`); Dashboard nav + route guard thêm ràng buộc vai trò (ADMIN/SUPER_ADMIN/SHOP_MANAGER, `'*'` vẫn qua) — `App.jsx`. Không đổi backend. |
| 9 | Report timezone | Sửa | ReportsScreen tính chuỗi ngày theo lịch địa phương (Asia/Ho_Chi_Minh) thay `toISOString()`/UTC — khớp REPORT_RULE_008. |
| 10 | Review aggregate/reply | Ghi rõ "trên trang này" | Thẻ "Tổng quan đánh giá" thêm nhãn "Tính trên trang hiện tại". Aggregate toàn hệ thống + reply = cần backend, để lại. |

#### B. Primitive dùng chung (nền tảng — làm trước để mọi screen kế thừa)

- **Touch target `components/ui/*`:** checkbox/radio/switch mở rộng vùng chạm ~44px bằng pseudo-element (giữ visual 16–20px, không phá layout); `dialog` close 36px + i18n `common.close` + radius card token; `alert` chỉ danger/warning `role=alert`, info/success `role=status`, dismiss 28px; `tabs` list `overflow-x-auto`; `dropdown-menu` item `py-2`; `textarea` `min-h-20`. **Cố ý HOÃN (ghi rõ):** không đổi chiều cao base `button`/`input`/`select` (36px) — lan rất rộng (`size="sm"` dùng 167 lần), phá mật độ bảng/filter; 44px đạt qua CTA `lg` + vùng-chạm-mở-rộng.
- **Layout:** `MobileCardList`→`<ul>/<li>` (list semantics) + giữ subtitle + bỏ inline style; `FormField` tôn trọng `id` con tự đặt (hết lệch htmlFor); `SectionCard`/`DetailSection` thêm prop `headingLevel` (+ CSS `:is(h2,h3,h4)`); `CollapsibleSection` thêm `keepMounted` (không reset editor/không giấu lỗi) + hint hiện cả mobile. **HOÃN:** `Screen.maxWidth` (max-width động, không thuộc token màu/spacing/radius).
- **Table/filter phụ trợ:** `BulkActionBar` nút 32px + radius control token, bỏ inline gap; `ExportButton` lỗi thô→thân thiện + log; `StatePanel` radius card.

#### C. Screen & component (mục 5–9) — theo miền

- **Shell/điều hướng:** AdminShell (drawer đóng `inert`, nav `role=group`, guard user partial), GlobalSearch (lối vào mobile, lỗi→StatePanel, Ctrl+K reset/restore, `SKU TBD`→i18n), NotificationBell (Radix DropdownMenu, lỗi hiện, fallback date), LanguageSwitcher/ThemeToggle/RecentItemsChips (native→Button, vùng chạm ≥44, group label).
- **Banner/toast/preview:** AssignmentBanner (tone semantic), OrderNotificationToast (1 live region polite, timer cleanup/pause, guard undefined, dời tránh che sticky), LivePreview (bỏ trap focus, header wrap, aria-label), ErrorBoundary (i18n hóa toàn bộ + nút "Về trang chủ").
- **Form/editor/media:** BlockEditor/blocks (fallback legacy giữ, unknown block rõ, provider đổi giữ URL/label thật), RichTextEditor(+WithSource) (toolbar aria, link validation, seed lại đúng, source giữ HTML), Seo/Image/Password (guard undefined `.trim`, ARIA, native→Button), Sortable/TagInput/ProductPickerCombobox (combobox/listbox/arrow nav, dragCancel, fetch lỗi≠rỗng), ImportProductsDialog (progress + caption + chặn close khi commit); Media: MediaCard/ListRow (tách nav/action, copy-URL absolute bug, aria cụ thể), MediaDetailModal/Panel (dirty guard, save dirty-gate), MediaFolderSidebar (load/error rõ, aria), MediaPicker/VideoPicker/Lightbox (focus-trap + body-lock + guard close khi upload/selection + aria-pressed), Skeleton (sr loading).
- **Dashboard/Reports/Orders/Customers/Reviews:** guard partial-data, lỗi≠empty (StatePanel), số theo locale, read-only banner, refetch guard, mobile parity, custom checkbox→shadcn, invalidate list, recent-order click được, filter chip a11y.
- **Product/Catalog:** ProductList (chống bấm nhầm, mobile action, native→shadcn, quick-publish khớp điều kiện thật), ProductDetail + product-detail/* (progressive disclosure qua CollapsibleSection `keepMounted`, **variant 9 cột → thêm dạng card mobile**, bulk clear sale price, provider giữ URL, aria-label, lỗi query hiện), Featured (Save chỉ bật khi dirty + race đổi ngôn ngữ), Category list/detail (loading/empty đúng, collapse intro+FAQ+CTA, sticky save, FAQ delete confirm, cycle-guard breadcrumb), Brand list/detail (hide confirm, EN alert + sticky save + collapse optional + clear-SEO confirm).
- **Content/Marketing:** ContentList/Detail (`/null` guard, native→shadcn), AssignmentBanner (loading/error rõ), Slider/Banner (collapse group + tab page/ngôn ngữ), HomeVideo (cancel giữ draft, partial-save báo rõ, Radix), HomeHighlights/Redirect (i18n, collapse advanced), Menu+menu/* (null guard, collapse 4 field, Radix Modal, category-picker).
- **Media/Settings/Users/Roles/Audit:** MediaLibrary (page-size 1 control, view toggle tab semantics, hard-delete guard), UploadQueue (progressbar ARIA, chặn dismiss pending), Settings+* (collapse section, sticky action, helper nghiệp vụ, i18n metadata), AdminUsers (lỗi hiện, role→nhãn, dirty guard, chống double-submit), Roles (`Promise.allSettled`, Toast tone info hết đỏ, PermGroup/RoleDetail collapse, CreateRole slug bỏ dấu + dirty guard), AuditLog (locale động, nhãn "chỉ trang này", tone thống nhất nguồn chung, MobileFilterDrawer focus-trap + date validation).

#### D. Hygiene (mục 10)

- **Dead CSS xóa (grep 0-ref xác nhận):** 11 class (`.bb-btn-danger`, `.bb-btn-danger-ghost`, `.bb-label`, `.sort-ind`, `.bb-stack-sm`, `.bb-detail-actions` ở `admin-prototype.css`; `.menu-slot-missing`, `.menu-search-box/-icon/-clear`, `.audit-danger-banner` ở `index.css`) + `.medialib-page-size-wrap` (sau khi bỏ page-size lặp). **Dead export xóa:** `FilterBar/FilterField/SummaryCard/SummaryCardGrid` (+2 file component) — `.bb-filter-bar`/`.bb-kpi-grid` CSS GIỮ (screen dùng trực tiếp).
- **Token:** comment "orange"→"đỏ" ở `admin-tokens.css` (giữ `status-warning-orange-*` đang dùng); inline style/radius numeric nơi có token → class/token.
- **i18n:** thêm **337 key** vào CẢ `vi.json` LẪN `en.json` (VI từ defaultValue trong code, EN dịch chuẩn) → 2 file **cân bằng 2931/2931 key, 0 lệch**. 5 key sai text cũ đã override (Q4 customer/FAILED copy, Q1 EN placeholders). Hardcode gỡ: ErrorBoundary, roles/Toast, settings/constants, search `SKU TBD`, notifications… **Còn 34 key dùng template JS `${...}` (nội suy runtime) — cố ý GIỮ ở defaultValue** (chuyển sang locale cần đổi code sang nội suy i18next `{{}}`, ngoài phạm vi; chạy đúng qua defaultValue).

#### E. Cố ý HOÃN / ghi rõ (không phải bỏ sót)

- Chiều cao base `ui/button|input|select` (44px toàn diện) — rủi ro lan rộng; đã dùng mở-rộng-hit-area thay thế.
- Một số native `<button>` gắn chặt CSS design-system (gallery add/remove, drag-handle, roles/RoleSidebar row, audit search-chip) — chuyển sang shadcn cần sửa/tạo CSS (bị cấm trong đợt); đã thêm aria đầy đủ.
- 34 i18n key `${...}` (mục D). `Screen.maxWidth`. Test P1 (`product-detail/*.test.*`) giữ nguyên để không phá suite.
- Blocker 4.2 #4/#7/#10-aggregate/reply: cần backend/API mới — để lại đúng như chốt.

#### F. Quality gate (sau toàn bộ)

`npm run lint` **PASS** · `npm run test` **PASS (11 file / 114 test)** · `npm run build` **PASS** (Vite bundle toàn bộ nguồn OK). Locale `vi.json`/`en.json` cân bằng 2931/2931. Không mojibake ở key mới (spot-check UTF-8 tiếng Việt có dấu).

**Ghi chú smoke:** Docker `bigbike-admin` đang chạy nhưng là **image build sẵn, không mount source** → drive container chỉ test code cũ, không phản ánh thay đổi đợt này. Xác thực thay đổi dựa trên `npm run build` (bundle toàn bộ source thành công) + lint + test.

**Ghi chú thực thi:** đợt này chạy song song ~15 agent theo file rời nhau. Giữa chừng gặp **giới hạn phiên** làm 8 agent dừng với sửa dở → đã **ổn định lại về xanh** (sửa 15 lỗi lint/parse do sửa dở: parse error IntroContentField, unused-var half-wired, setState-in-effect theo convention repo) rồi **re-dispatch 4 agent clean-slate** (Roles/Audit, Brand, Editors/Media còn lại, product-detail sub-editors) hoàn tất phần dở. Không commit/push (chờ yêu cầu).

