# Phase 2 (Fix) — Tiếp tục sửa UIUX audit bigbike-admin

> File này là **hand-off** giữa chừng Phase 2. Đọc [PROMPT_UIUX_AUDIT_bigbike-admin-v7.md](PROMPT_UIUX_AUDIT_bigbike-admin-v7.md) trước để hiểu 62 tiêu chí gốc, và `docs/audits/UIUX_AUDIT_REPORT_bigbike-admin.md` để xem đầy đủ 85 finding gốc (mô tả/kịch bản lỗi/đề xuất/ghi chú kiểm chứng chi tiết hơn bản tóm tắt dưới đây).

## Bối cảnh

Báo cáo audit gốc liệt kê **85 finding** (7 Blocker / 45 Major / 33 Minor) trên 11 module của bigbike-admin. Việc sửa (Phase 2) đã chạy qua nhiều session, commit message chỉ ghi "update" nên **không track được trạng thái từng finding** — phải cross-check lại toàn bộ source code so với report để biết cái nào đã sửa. Đã làm xong việc cross-check này (dùng 4 agent đọc song song), sau đó sửa tiếp 3 Blocker cuối cùng + 4 module đầu tiên. Session này dừng giữa chừng module thứ 5.

**Không cần đọc `docs/` (business/engineering) cho các thay đổi trong file này** — toàn bộ là UI/UX polish thuần (spacing, confirm dialog, optimistic update, skeleton, label...), không đổi API contract/data shape/permission/state machine.

---

## ĐÃ XONG (không cần làm lại)

### 7/7 Blocker — hoàn tất, tiêu chí "0 Blocker tồn đọng" đã đạt
1. F2 `ReasonConfirmModal.jsx` + `OrderDetailScreen.jsx` — required-legend
2. A2 `index.css` (CategoryListScreen contrast) — dùng `--admin-color-text-muted` thay opacity
3. A1 `index.css` `.mediafolder-item:focus-visible`
4. F5 `ConfirmDialog.jsx` — bỏ `autoFocus` khỏi nút xác nhận nguy hiểm
5. A2 `ProductDetailScreen.jsx` nút "Bỏ qua" — bỏ opacity-70, dùng underline thay
6. F5 `ContentEditors.jsx` `SpecificationsEditor.removeRow` — thêm `showConfirm`
7. F5 `BlockEditor.jsx` + `block-editor/blocks.jsx` — thêm `showConfirm` cho `removeBlock`, `ListBlockEditor.removeItem`, `StringListEditor.removeItem`, `SuitabilityBlockEditor.removeCard`, `SizeGuideBlockEditor.removeColumn/removeRow`. Thêm key `products.detail.blocks.removeConfirmTitle/removeConfirmMessage` vào vi.json/en.json.

### Shared component fix (tự động resolve finding ở NHIỀU module)
- **N4** `components/StatePanel.jsx` — đã thêm `TONE_ICONS` map + render icon theo tone. Resolve N4 ở mọi module dùng StatePanel (Product Detail, Content List, Auth...).
- **N6** `components/ExportButton.jsx` — đã thêm `t('export.exporting')` thay text khi đang xuất file (session này). Resolve N6 ở Dashboard/Orders, Product List, Customer, Reports.
- **V5** `vi.json:733` "Xoá mục" (Product Detail), `MenuScreen.jsx` aria-label "Xoá tìm kiếm" (Menu&Media), `vi.json` `content.detail.eyebrow`="Tin tức" (Block Editor), `BrandDetailScreen.jsx` `hideConfirmTitle`/`hideBtn`="Ẩn thương hiệu" (Category/Brand Detail) — đều đã fix từ trước.

### Module đã fix xong hoàn toàn (session này)

**1. Bán hàng — Dashboard & Đơn hàng** (N6, T5, V2, V5):
- `OrderListScreen.jsx` — `runBulkProcessing()` giờ toast lỗi khi `ids.length===0` thay vì return câm lặng (key `orders.bulkNoEligible`).
- `OrderDetailScreen.jsx` — `marginBottom:6→8`, `marginTop:2→4`; thay `t('orders.detail.eyebrow')` (bị tái dùng sai ngữ cảnh) bằng key mới `orders.detail.selectActionHint`.

**2. Bán hàng — Khách hàng & Đánh giá** (F1, N5, V2, N7):
- `CustomerDetailScreen.jsx` — thêm `fieldErrors` state + `FieldError` component, wire `mapValidationErrors(err)` (đã có sẵn trong `adminApi.js`) vào `handleEditSave`; đồng bộ `mb-0.5`→`mb-1` cho 6 label trong `sectionStats`.
- `ReviewListScreen.jsx` — skeleton height `72→200`.
- `CustomerListScreen.jsx` — `handleStatusChange` chuyển sang optimistic update (cancelQueries/setQueryData/rollback), theo pattern `ReviewListScreen`.

**3. Sản phẩm — Danh sách SP/Danh mục/Thương hiệu (list)** (F11, N2, O4, N7, V5):
- Thêm nút "Sao chép" (duplicate) cho `CategoryListScreen.jsx` + `BrandListScreen.jsx` — dùng sessionStorage key `DUPLICATE_SESSION_KEY` (khai báo ở `category-list/constants.js` cho Category, literal string `'brand-duplicate-payload'` trong `BrandListScreen.jsx` cho Brand). `CategoryDetailScreen.jsx`/`BrandDetailScreen.jsx` đọc draft này khi mount ở chế độ tạo mới (giống cơ chế `ProductDetailScreen.jsx` đã có).
- `CategoryListScreen.jsx` — tree query giờ destructure `isError/error/refetch`, hiện Alert + nút "Thử lại" khi lỗi.
- `BrandListScreen.jsx` — thêm `toggleVisibilityMutation` optimistic (Eye/EyeOff icon) giữa Edit/Delete.
- `ProductListScreen.jsx` — `handleTogglePublish` chuyển sang `useMutation` optimistic.
- `BrandListScreen.jsx` — filter "Thùng rác" dùng key riêng `brands.filterTrash` thay vì tái dùng `common.hidden`.

**4. Sản phẩm — Chi tiết sản phẩm (tạo/sửa)** (A7, N5):
- `product-detail/VariantEditors.jsx` + `constants.js` — cap render 50 dòng đầu (`VARIANTS_RENDER_CAP`), nút "Hiện thêm" tăng dần theo batch 50 (KHÔNG thêm dependency virtualization).
- `ProductDetailScreen.jsx` — thay `StatePanel` loading bằng skeleton inline (`animate-pulse`, khớp khung header+tabs+3 card thật).

**⚠️ Lưu ý quan trọng — lỗi đã tránh được:** Lúc chuẩn bị sang module 5 (Category/Brand Detail), tôi đã SAI khi định giao lại finding V5 (`brands.detail.hideConfirmTitle/hideBtn` = "Ẩn brand") cho agent — finding này **đã fix từ trước session này**, không nằm trong danh sách còn lại bên dưới. Đừng lặp lại nhầm lẫn này: trước khi giao việc cho agent, luôn grep lại đúng vị trí trong source để xác nhận finding còn tồn tại thật.

---

## CÒN LẠI — 53 finding, 7 module

Sửa theo đúng nguyên tắc Phase 2 gốc: chỉ sửa đúng phạm vi mô tả, tái dùng pattern có sẵn trong codebase (không tạo abstraction mới ngoài yêu cầu, không thêm dependency mới trừ khi thật cần). Sau mỗi module, chạy `npx eslint <file đã sửa>` từ `bigbike-admin/` và sửa hết lỗi trước khi coi là xong. Đề xuất: giao mỗi module cho 1 agent riêng, chạy **tuần tự** (không song song) vì nhiều module cùng đụng `locales/vi.json`/`en.json`/`index.css` — chạy song song dễ mất edit của nhau.

### Module 5 — Sản phẩm: Chi tiết Danh mục & Thương hiệu (9 việc)
File chính: `CategoryDetailScreen.jsx`, `BrandDetailScreen.jsx`, `category-detail/ProductsInCategoryCard.jsx`, `category-detail/SeoCard.jsx`.

1. **F3 (Major)** — `CategoryDetailScreen.jsx` field "Tên" (`<Input name="name">`, ~dòng 624-630) không có `onBlur`, trong khi slug (~762) và SEO fields (`SeoCard.jsx`) đều có `onBlur={() => validateFieldOnBlur(...)}`. `BrandDetailScreen.jsx` field "Tên" (~474) đã có. Thêm `onBlur={() => validateFieldOnBlur('name')}`.
2. **F6 (Major)** — `CategoryDetailScreen.jsx` chỉ có `beforeunload` thủ công (~212-217) + Esc handler riêng (~407-426), KHÔNG gọi `useUnsavedChanges` (`lib/useUnsavedChanges.js`) như `BrandDetailScreen.jsx` (~207) đã làm → điều hướng nội bộ (sidebar/breadcrumb/"← Quay lại") không bị chặn khi có thay đổi chưa lưu. Thêm `useUnsavedChanges(isDirty)`, xoá effect `beforeunload` thủ công trùng lặp (hook đã tự cài).
3. **F7 (Major)** — `BrandDetailScreen.jsx` nút Lưu (~397-406) chỉ đổi text `t('common.saving')`, không spinner/`aria-busy`. `Loader2` đã import (~dòng 18) nhưng KHÔNG dùng. `CategoryDetailScreen.jsx` nút Lưu tương đương (~536-541) đã có `<Loader2 className="animate-spin">` + `aria-busy`. Copy pattern đó sang Brand.
4. **N5 (Major)** — Cả `CategoryDetailScreen.jsx` (~428-436) và `BrandDetailScreen.jsx` (~325-333) khi loading chỉ trả về `<StatePanel>` nhỏ căn giữa, gây CLS lớn. Thay bằng skeleton inline (đúng pattern vừa áp dụng cho `ProductDetailScreen.jsx` — xem file đó để copy style) cho CẢ HAI file.
5. **T1 (Major)** — `CategoryDetailScreen.jsx` (~89-96) query `productsInCat` không truyền `isLoading` xuống `<ProductsInCategoryCard>`. `ProductsInCategoryCard.jsx` (~26-27) render nhánh rỗng ngay cả khi đang tải → flash sai. Truyền `isLoading`, hiện skeleton 2-3 dòng khi loading, chỉ hiện text rỗng khi loading xong VÀ thật sự rỗng.
6. **F13 (Minor)** — Không có chỉ báo tiến độ điền form ở cả 2 màn. Thêm `<span className="bb-muted text-xs">` nhỏ cạnh nút Lưu kiểu "X/Y mục đã điền" (Y = số field bắt buộc, X = số field đã có giá trị).
7. **F9 (Minor)** — Không có autosave/draft cho form dài (name, intro content, FAQ, ảnh, SEO). `ProductDetailScreen.jsx`/`ContentDetailScreen.jsx` đã có sẵn cơ chế autosave→localStorage + banner khôi phục draft (tìm `getAutosaveKey`/`saveFormToStorage`/`loadFormFromStorage`). Port CÙNG helper dùng chung đó vào Category + Brand Detail, đừng viết lại logic mới.
8. **T2 (Minor)** — `ProductsInCategoryCard.jsx` (~26-27) nhánh rỗng thật (0 sản phẩm) chỉ có text tĩnh. Thêm link "Thêm sản phẩm vào danh mục này →" → `navigate('/admin/products?categoryId=' + item.id)` (theo đúng pattern nút "Xem tất cả" cùng file, ~15-23).
9. **V2 (Minor)** — `marginLeft: 6` lặp lại ở `CategoryDetailScreen.jsx` (~622, ~756), `SeoCard.jsx` (~41, ~63), `BrandDetailScreen.jsx` (~449, ~466, ~578, ~594) → đổi thành `8`. `gap-2.5 p-2.5` (10px) ở `CategoryDetailScreen.jsx` (~711, ~726-727) và `BrandDetailScreen.jsx` (~479-480) → đổi thành `gap-2 p-2`.

*(F11 duplicate và V5 hideConfirmTitle của module này ĐÃ XONG — xem phần trên, đừng làm lại. N4 StatePanel cũng đã xong.)*

### Module 6 — Nội dung: Danh sách bài viết, Slider, Video, Highlight, Redirect (13 việc)
File: `SliderListScreen.jsx`, `HomeVideoListScreen.jsx`, `RedirectListScreen.jsx`, `ContentListScreen.jsx`.

1. **F10 (Major)** — `SliderListScreen.jsx` form thêm/sửa (~510-601) dồn 9 field vào 1 `bb-grid-2` phẳng, không heading/section. Nhóm lại theo section có tiêu đề nhỏ (vd "Vị trí & thứ tự", "Ảnh desktop", "Ảnh mobile", "Liên kết") bằng divider/heading trong cùng card.
2. **F5 (Major)** — `HomeVideoListScreen.jsx` `handleBulkSetActive` (~489-507) ẩn/hiện hàng loạt KHÔNG qua `showConfirm`, trong khi `handleBulkDelete` (~509-525) có. Thêm `showConfirm(...)` trước `Promise.all(...updateHomeVideo)`.
3. **F6 (Major)** — `HomeVideoListScreen.jsx` (~676, form title/videoUrl/thumbnail) không có `useUnsavedChanges`. `SliderListScreen.jsx` (~283) và `HomeHighlightsScreen.jsx` (~181) cùng module đã có. Thêm baseline/isDirty + `useUnsavedChanges(isDirty)`.
4. **F6 (Major)** — `RedirectListScreen.jsx` form (~381-457) cũng không có `useUnsavedChanges`. Thêm tương tự (mirror SliderListScreen).
5. **O4 (Major)** — `RedirectListScreen.jsx` `rowActions()` (~266-287) chỉ có Sửa/Xoá, không có nút Bật/Tắt trực tiếp như SliderCard/HomeVideoCard. Thêm icon-button toggle gọi `updateRedirect(id, { enabled: !enabled })` (optimistic).
6. **O6 (Major)** — `RedirectListScreen.jsx` `AdminTable` (~526-532) không có `selectable`/`BulkActionBar`, trong khi ContentListScreen/HomeVideoListScreen cùng module có. Thêm selectable + BulkActionBar (Bật/Tắt/Xoá hàng loạt, kèm confirm cho Xoá).
7. **O3 (Minor)** — Không form nào trong module (Slider ~603, HomeVideo, Redirect, HomeHighlights) bắt Ctrl/Cmd+S để lưu. *(Nếu Module 11 — Hạ tầng — đã tách hook `useSaveShortcut` dùng chung, wire hook đó vào 4 form này; nếu chưa, có thể bỏ qua/làm sau khi Module 11 xong vì phụ thuộc hook đó.)*
8. **O9 (Minor)** — `ContentListScreen.jsx` (~429) không dùng `RecentItemsChips`/`useRecentItems` (đã có sẵn, đang dùng ở ProductListScreen/CategoryList/CustomerList/BrandList/ReviewList). Thêm khối "Vừa xem/sửa" dưới screen-header.
9. **T7 (Minor)** — `RedirectListScreen.jsx` bảng 8 cột (~289-337) không có `ColumnVisibilityToggle` (đã dùng ở Brand/Product/Customer/Order/Category List). Thêm.
10. **V2 (Minor)** — `SliderListScreen.jsx` (~532) checkbox `isActive` dùng `style={{ marginTop: 22 }}` — lệch thang 4px. Đổi sang class Tailwind `mt-6` hoặc bỏ marginTop dùng `items-end` trên grid cha.
11. **V2 (Minor)** — `RedirectListScreen.jsx` (~437) checkbox `enabled` cùng lỗi `marginTop: 22`. Sửa tương tự.
12. **V5 (Minor)** — `SliderListScreen.jsx` (~131) nút bật/tắt dùng `t('common.disable')/t('common.enable')` ("Tắt"/"Bật"), khác `HomeVideoListScreen.jsx` (~199-201) dùng `homeVideos.hideAction/showAction` ("Ẩn"/"Hiện") cho cùng khái niệm. Thêm key `sliders.hideAction/showAction` = "Ẩn"/"Hiện", dùng thay `common.enable/disable` trong SliderCard.
13. **V5 (Minor)** — `RedirectListScreen.jsx` field "enabled" gọi là "Bật" trong label checkbox form (~440, `redirects.formEnabled`) nhưng "ON"/"OFF" tiếng Anh ở badge/filter (~260-264, ~472-475, `common.on/off`). Thêm key riêng `redirects.statusOn/statusOff` = "Bật"/"Tắt", thay `common.on/off` ở 2 chỗ đó.

*(N4 StatePanel của module này đã xong.)*

### Module 7 — Nội dung: Trình soạn bài viết (Block Editor) (5 việc)
File: `ContentDetailScreen.jsx`, `components/RichTextEditor.jsx`.

1. **F3 (Major)** — `ContentDetailScreen.jsx` field "URL canonical" (`seoCanonicalUrl`, ~734-741) chỉ có `onChange`, không `onBlur`. title (~557)/slug (~586) đều có `onBlur={() => validateFieldOnBlur(...)}`. Thêm tương tự cho seoCanonicalUrl.
2. **F6 (Major)** — `ContentDetailScreen.jsx` (~147-152) chỉ tự cài `beforeunload` thủ công + confirm khi bấm X đóng (~416-425), KHÔNG gọi `useUnsavedChanges` dùng chung (9 screen khác trong app đã dùng: Banner/FeaturedProducts/SliderList/CustomerDetail/BrandDetail/OrderDetail/HomeHighlights/ProductDetail/Settings). Thêm `useUnsavedChanges(isDirty, ...)`, xoá effect `beforeunload` thủ công trùng lặp.
3. **N5 (Major)** — `ContentDetailScreen.jsx` (~323-331) loading trả về `StatePanel` nhỏ căn giữa, gây CLS. Thay bằng skeleton inline (đúng pattern đã áp dụng cho ProductDetailScreen/CategoryDetail/BrandDetail — copy style).
4. **V2 (Major)** — `components/RichTextEditor.jsx` nút toolbar dùng `w-[30px] h-[30px]` (dòng ~32, lặp ở ~245/~256) và divider `h-[18px]` (~47) — arbitrary value lệch thang 4px. Đổi `w-[30px] h-[30px]` → `h-8 w-8` (32px), `h-[18px]` → `h-4` hoặc `h-5`.
5. **F12 (Minor)** — `ContentDetailScreen.jsx` title tiếng Anh tự sinh slug EN qua `toSlug()` (`handleEnTitleChange`, ~304-310), nhưng title tiếng Việt (~556, `updateField('title', ...)`) không tự gợi ý slug VI. Áp dụng cùng pattern `toSlug(title)` + cờ "đã sửa tay" cho slug VI khi tạo bài viết mới (isCreate) và slug chưa bị sửa tay.

*(F5 Blocker và V5 eyebrow của module này ĐÃ XONG session này/trước đó.)*

### Module 8 — Nội dung: Menu điều hướng & Thư viện Media (11 việc)
File: `MenuScreen.jsx`, `menu/SortableMenuItem.jsx`, `MediaDetailPanel.jsx`, `MediaLibraryScreen.jsx`, `components/BulkActionBar.jsx`, `MediaCardSkeleton.jsx`.

1. **F6 (Major)** — `MenuScreen.jsx` modal Thêm/Sửa mục menu, `onClose` (~570 thêm, ~607 sửa) đóng ngay không kiểm tra dữ liệu chưa lưu (Radix Dialog nên Esc/click-outside cũng trigger). So sánh state hiện tại với `EMPTY_ITEM`/snapshot lúc mở sửa; nếu khác, `showConfirm(...)` (đã dùng sẵn trong file) trước khi đóng.
2. **F6 (Major)** — `MediaDetailPanel.jsx` biến `dirty` (~131-135) chỉ gate nút Lưu, nút Đóng header (~141) và Hủy footer (~310) đóng ngay không check `dirty`. Thêm check `dirty` → `showConfirm` trước khi `onClose()`.
3. **F7 (Major)** — `components/BulkActionBar.jsx` nút `.bulk-btn` (~45-53) chỉ nhận `disabled`, không spinner/loading state; CSS `.bulk-btn` (`admin-prototype.css` ~763-779) không có rule `:disabled`. Đổi sang dùng chung component `Button` (đã hỗ trợ `loading`, xem `components/ui/button.jsx`) truyền `loading={bulkBusy}`; hoặc tối thiểu thêm CSS rule `.bulk-btn:disabled { opacity: .5; cursor: not-allowed; }`.
4. **O4 (Major)** — `menu/SortableMenuItem.jsx` trạng thái Active/Inactive chỉ hiện badge tĩnh (~36), phải mở modal Sửa mới đổi được. Thêm toggle/switch nhỏ ngay trên dòng bảng gọi thẳng `updateMenuItem`.
5. **T2 (Major)** — `MediaLibraryScreen.jsx` khi rỗng (~602-605) luôn hiện CTA "Xoá bộ lọc" kể cả khi kho THẬT SỰ trống (không filter nào active). Phân biệt: nếu không filter active → CTA "Tải file lên" (`fileInputRef.current?.click()`); chỉ hiện "Xoá bộ lọc" khi có filter.
6. **F8 (Minor)** — `MenuScreen.jsx` `deleteItemMutation.onSuccess` (~198-204) không có `toast.success`, khác add/update (~160, ~193) đều có. Thêm `toast.success(...)`.
7. **N5 (Minor)** — `components/MediaCardSkeleton.jsx` (~dòng 4) dùng `h-[120px]` cố định, thật ra `.medialib-thumb-wrap` (index.css ~3155-3160) dùng `aspect-ratio: 4/3` co giãn theo cột grid → lệch/CLS. Đổi `h-[120px]` → `aspect-[4/3]`.
8. **O3 (Minor)** — `MenuScreen.jsx` modal + `MediaDetailPanel.jsx` không có Ctrl/Cmd+S. *(Phụ thuộc hook `useSaveShortcut` — làm sau Module 11 nếu hook đó được tách ra, hoặc bind trực tiếp theo pattern CustomerDetailScreen.jsx nếu làm độc lập trước.)*
9. **O6 (Minor)** — `MenuScreen.jsx` bảng mục menu (~543-556) không có checkbox/bulk action, trong khi `MediaLibraryScreen` cùng module đã có `BulkActionBar` đầy đủ. Thêm checkbox chọn dòng + tái dùng `BulkActionBar`.
10. **O9 (Minor)** — `MediaLibraryScreen.jsx` không dùng `RecentItemsChips` (đã dùng ở 6 screen khác). Thêm.
11. **V2 (Minor)** — `menu/SortableMenuItem.jsx` (~dòng 30) `paddingLeft: \`${8 + item.depth * 18}px\`` — hệ số 18 lệch thang 4px. Đổi 18 → 16 hoặc 20.

*(A1 Blocker và V5 aria-label của module này ĐÃ XONG.)*

### Module 9 — Hệ thống: Cài đặt, Người dùng quản trị, Vai trò, Nhật ký, Báo cáo (8 việc)
File: `AdminUsersScreen.jsx`, `SettingsScreen.jsx`, `App.jsx`, `settings/SettingTabPanel.jsx`, `BannerScreen.jsx`, `settings/SettingField.jsx`, `roles/CreateRoleDialog.jsx`, `AuditLogListScreen.jsx`.

1. **A4 (Major)** — `AdminUsersScreen.jsx` nút đóng banner mời (~554, `×`) chỉ có `title`, không `aria-label` — khác các nút icon khác cùng file (~473/477/506/510) có cả 2. Thêm `aria-label={t('common.close')}`.
2. **F9 (Major)** — `SettingsScreen.jsx` (nhiều tab, field HTML dài như `about_content_html`) chỉ có `useUnsavedChanges` (~186), không autosave draft. `ProductDetailScreen.jsx`/`ContentDetailScreen.jsx` ĐÃ có sẵn cơ chế autosave→localStorage dùng chung (tìm `getAutosaveKey`/`saveFormToStorage`/`loadFormFromStorage`). Port helper đó vào SettingsScreen.
3. **L3 (Major)** — `App.jsx` (~160) route `/admin/banners` map sang screen 'settings' nhưng `NAV_GROUP_DEFS` (~92-101, nhóm 'system') không có item path đó → vào thẳng URL này mất active-state sidebar + breadcrumb. Cách đơn giản: khi `module === 'banners'`, gọi `navigate('/admin/settings', { replace: true })` ngay khi vào app để URL đổi thật, sidebar/breadcrumb tự khớp.
4. **O3 (Major)** — `SettingsScreen.jsx` (~123) không có Ctrl/Cmd+S. Đây là màn hình chính nên bind trực tiếp (theo pattern `CustomerDetailScreen.jsx` ~184) — **nếu Module 11 làm trước và tách được hook `useSaveShortcut` dùng chung, ưu tiên dùng hook đó thay vì lặp code**.
5. **V2 (Major)** — `settings/SettingTabPanel.jsx` (~dòng 27) `margin: '18px 0 12px', paddingBottom: 6`; `BannerScreen.jsx` (`gap: 10` ~259/271, `marginTop: 2` ~260/272); `settings/SettingField.jsx` (`gap: 6` ~38) — đều lệch thang 4px. Đổi: 18→16 hoặc 20, 6→8, 10→8 hoặc 12, 2→4. Ưu tiên dùng biến `--admin-space-*` nếu tiện.
6. **F11 (Minor)** — `roles/CreateRoleDialog.jsx` (~39) tạo vai trò mới luôn `permissions: []`, không có tuỳ chọn nhân bản quyền từ vai trò có sẵn. Thêm dropdown "Nhân bản quyền từ vai trò có sẵn" (tuỳ chọn) — khi chọn, set permissions ban đầu = permissions vai trò nguồn.
7. **T10 (Minor)** — `AdminUsersScreen.jsx` thanh lọc (~558-586) không có nút "Xoá bộ lọc" rõ ràng khi có filter active mà vẫn còn kết quả (chỉ có gián tiếp qua StatePanel khi rỗng, ~602-614). `AuditLogListScreen.jsx` cùng module đã có (~345-349, `isFiltered` + FilterChips). Thêm tương tự vào AdminUsersScreen.
8. **T7 (Minor)** — `AdminUsersScreen.jsx` (cột ~416-484) và `AuditLogListScreen.jsx` không có `ColumnVisibilityToggle` (đã dùng ở Brand/Category/Customer/Order/Product List). Thêm vào cả 2.

### Module 10 — Xác thực: Đăng nhập & Nhận lời mời (5 việc)
File: `App.jsx`, `AcceptInviteScreen.jsx`, `lib/adminApi.js`, `LoginScreen.jsx`.

1. **A6 (Major)** — `App.jsx` (~dòng 20) `AcceptInviteScreen` import tĩnh, mọi screen khác dùng `lazyScreen()`. Bọc bằng `lazyScreen()`, giữ `LoginScreen` tĩnh (cần ngay khi chưa xác định auth).
2. **L6 (Major)** — `AcceptInviteScreen.jsx` phase `'valid'` (form đặt mật khẩu, ~121-199) không có link quay lại đăng nhập, khác phase `'invalid'` (~106-108) và `'done'` (~115-117) đều có `<a href="/">`. Thêm link/nút phụ "Về trang đăng nhập" dưới nút submit.
3. **N2 (Major)** — `lib/adminApi.js` `loginAdmin()` (~157-182) tự fetch riêng, không qua `requestJson()` chung (có fallback tiếng Việt). Fallback tiếng Anh cứng ở dòng ~170 (`Login failed with status ...`) và ~177 (`Login response missing access token.`). Đổi sang dùng `requestJson()`/`dispatch()` như hàm khác, hoặc đổi 2 fallback sang tiếng Việt.
4. **N2 (Major)** — `AcceptInviteScreen.jsx` khi `validateAdminInvite(token)` lỗi mạng thật (TypeError trước khi có response, ~41-53), hiện `err.message` tiếng Anh của trình duyệt và set `phase='invalid'` — không phân biệt được với "token hỏng thật", không có nút Thử lại. Phân biệt lỗi mạng (không phải `ApiClientError`) với lỗi token 4xx; lỗi mạng → hiện thông báo riêng + nút "Thử lại" gọi lại `validateAdminInvite(token)`.
5. **V2 (Minor)** — `gap: 6` lặp ở `LoginScreen.jsx` (~90, ~111) và `AcceptInviteScreen.jsx` (~130, ~157) — lệch thang 4px. Đổi thành `gap: 8`.

*(N4 StatePanel của module này đã xong.)*

### Module 11 — Hạ tầng dùng chung (2 việc — làm module này SỚM vì 2 module khác phụ thuộc vào nó)
File: `components/AdminShell.jsx`, `screens/CustomerDetailScreen.jsx`, thêm mới trong `lib/`.

1. **A3 (Major)** — `components/AdminShell.jsx` menu người dùng (`bb-user-dropdown`, ~169-177) chỉ đóng bằng click-outside (`mousedown`), không có Escape — trong khi drawer sidebar mobile ngay phía trên (~137-147) trong CÙNG FILE đã có đúng mẫu Escape + trả focus. Thêm effect Escape tương tự cho `userMenuOpen`, trả focus về `.bb-user-chip`. *(Cân nhắc lâu dài: thay bằng `DropdownMenu` Radix có sẵn ở `components/ui/dropdown-menu.jsx` — nhưng tối thiểu chỉ cần thêm Escape handler là đủ pass tiêu chí.)*
2. **O3 (Major)** — Ctrl/Cmd+S hiện chỉ cài thủ công, cục bộ trong `CustomerDetailScreen.jsx` (~181-191), không tách hook dùng chung. Trích logic đó thành hook `useSaveShortcut(enabled, onSave)` đặt cạnh `useUnsavedChanges` trong `lib/` (file mới `lib/useSaveShortcut.js`), rồi **wire hook đó vào chính `CustomerDetailScreen.jsx`** (thay code cũ) làm ví dụ đầu tiên. *(Việc wire thêm vào SettingsScreen/MenuScreen/MediaDetailPanel/4 form ở Module 6 — các O3 Minor ở module 6/8/9 — có thể làm ngay sau đó bằng cách import hook này, không cần viết lại logic.)*

---

## SAU KHI XONG TẤT CẢ 7 MODULE TRÊN

1. **Cập nhật `docs/audits/UIUX_AUDIT_REPORT_bigbike-admin.md`** — với MỌI finding trong 85 finding gốc, đổi trạng thái thành `Fixed` (nêu rõ commit/thay đổi) hoặc `Deferred (lý do)` nếu cố tình bỏ qua. Đổi dòng trạng thái ở đầu file (dòng 5) từ "dừng ở CHECKPOINT, chưa sang Phase 2" thành đã hoàn tất Phase 2, và bỏ/update dòng cuối "554: dừng lại ở đây — chưa sang Phase 2".
2. **Chạy lint toàn bộ**: `cd bigbike-admin && npx eslint src` — phải 0 lỗi.
3. **Build thử**: `cd bigbike-admin && npm run build` (hoặc lệnh build đang dùng trong CI) — xác nhận không lỗi.
4. **Kiểm tra lại tiêu chí hoàn thành Phase 2** (theo PROMPT gốc):
   - 0 Blocker tồn đọng — ✅ đã đạt (7/7 Blocker fixed).
   - Major < 10% tổng số tiêu chí áp dụng (62 tiêu chí) — đếm lại số Major còn `Deferred` sau khi xong, phải < 6.
   - A1–A4 (WCAG AA) đều pass.
   - Không còn item `[chưa kiểm]` nào trong bảng coverage Phase 0.
5. Nếu có UI thay đổi đáng kể (skeleton mới, nút mới, modal mới), cân nhắc dùng skill `run-bigbike-admin` để chạy thử + chụp màn hình xác nhận trước khi báo hoàn tất.
