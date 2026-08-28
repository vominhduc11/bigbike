# Audit giao diện bigbike-admin — nhất quán, khoảng thở, chữ chú thích

**Ngày:** 2026-08-28
**Phạm vi:** toàn bộ `bigbike-admin` — 35 màn, 154 file component (kể cả component con lồng trong), 4 tệp CSS (5.326 dòng)
**Cách làm:** đo bằng máy trên toàn bộ mã nguồn + chụp 28 ảnh thật từ khu quản trị đang chạy ở 2 khổ màn (1440×900, 390×844)
**Trạng thái:** CHƯA sửa dòng mã nào — đây là bản đánh giá để owner quyết ưu tiên

> **Đối chiếu với `ADMIN_AUDIT_BOARD.md`:** mục "Việc xuyên module" ghi *"✅ Đã chuẩn hoá toàn bộ giao diện admin (2026-08-23)"*.
> Audit này xác nhận đợt chuẩn hoá đó **áp dụng chưa hết**: `SectionCard`/`.mono`/skeleton tự chế đã xoá đúng như ghi nhận,
> nhưng **hệ `bb-card` / `bb-filter-bar` cũ vẫn còn sống ở 13 file** và 17/35 màn chưa bọc `Screen`.
> Đề nghị cập nhật lại dòng đó thành "áp dụng một phần" sau khi đọc mục 1 dưới đây.

---

## 0. Kết luận cho owner

| Câu hỏi owner đặt ra | Kết luận | Mức đạt |
|---|---|---|
| Khoảng thở / khoảng trống / khoảng cách giữa các thẻ đã chuyên nghiệp chưa? | **Chưa** | ~38% |
| Chữ chú thích đã hạn chế tối đa chưa? | **Chưa** | ~30% |
| Style tổng thể đã chuyên nghiệp và hiện đại chưa? | **Gần đạt** | ~68% |
| Mỗi trang có giống nhau không? | **Mỗi trang mỗi kiểu** | ~34% |

**Chẩn đoán gốc:** bản thiết kế (`STYLEGUIDE.md` + `admin-tokens.css`) tốt và đạt chuẩn tiếp cận.
Vấn đề nằm ở **khâu thi hành**: hai bộ khung giao diện chạy song song trong cùng một dự án,
và phần lớn số đo được viết cứng thay vì lấy từ token.

**Điều owner muốn đạt được sau khi sửa:**
1. Mở bất kỳ trang nào trong admin cũng thấy cùng một ngôn ngữ hình ảnh — cùng kiểu thẻ, cùng kiểu bảng, cùng kiểu thanh lọc, cùng khoảng cách.
2. Nhìn vào màn hình không thấy "chật" cũng không thấy "rời rạc"; khoảng cách có nhịp.
3. Chữ chú thích chỉ còn ở chỗ thật sự cần; không có câu nào chép lại đúng cái nhãn ngay trên nó.
4. Trên laptop 900px và trên điện thoại đều dùng được, không bị giấu mục và không phải cuộn qua bộ lọc mới thấy dữ liệu.

---

## 1. Số liệu đo được

| Chỉ số | Con số | Ghi chú |
|---|---:|---|
| Màn không bọc `Screen` (mất nhịp dọc chuẩn) | **17 / 35** | xem danh sách §2.1 |
| Mức khoảng cách khác nhau trong CSS | **25** | `STYLEGUIDE.md` §4 chỉ cho 9 |
| Chiều cao nút & ô nhập | **7** | 26·28·30·32·34·36·40px |
| Chuỗi mang tính chú thích trong `vi.json` | **471 / 3.985** | 11,8% toàn bộ chuỗi |
| — trong đó dài > 60 ký tự | 187 | |
| — trong đó dài > 100 ký tự | 68 | dài nhất 301 ký tự |
| — hiện thẳng ra màn, không thu gọn | 137 | |
| Khai báo khoảng cách viết cứng px | **286** | index.css 142 + admin-prototype.css 144 |
| Khai báo khoảng cách qua token `--admin-space-*` | 63 | tỉ lệ 18% |
| Thang cỡ chữ cùng tồn tại | **3** | chữ nhỏ: 12,5 / 13 / 14px |
| Cỡ chữ px cứng trong `admin-prototype.css` | 14 giá trị | 10 · 10,5 · 11 · 11,5 · 12 · 12,5 · 13 · 14 · 15 · 18 · 22 · 23 · 26 · 28 |
| Cỡ icon khác nhau | **7** | 11 · 12 · 13 · 14 · 15 · 16 · 18 |
| Màn tự dựng bảng riêng | **4** | 12 màn dùng `AdminTable` |
| Token khai báo nhưng không ai dùng (dead) | **16** | `--bb-text-*` ×8, `--bb-s-*` ×8 |
| ✅ Màn dùng chung `StatePanel` (báo rỗng/lỗi) | 36 | làm rất tốt |
| ✅ Màn dùng chung `ScreenSkeleton` (khung chờ tải) | 19 | làm rất tốt |

---

## 2. Tám phát hiện, xếp theo mức độ

### 🔴 F1 — Hai bộ khung thẻ chạy song song *(gốc rễ của "mỗi trang mỗi kiểu")*

`STYLEGUIDE.md` §5 ghi `DetailSection` là **khối nội dung cấp màn duy nhất**. Thực tế còn bộ `bb-card` song song
với số đo khác hẳn, nên cùng một khái niệm "thẻ có tiêu đề + nội dung" ra hai diện mạo.

| | `DetailSection` (82 chỗ dùng) | `bb-card` (35 chỗ dùng) |
|---|---|---|
| Nền tiêu đề | `surface-muted` (xám) | `surface` (trắng) |
| Đệm tiêu đề | 16px / 20px | 14px / 16px |
| Phông tiêu đề | Oswald (`font-display`) 15px | Inter (`font-body`) 14px |
| Viền ngăn | 1,5px `border-subtle` | 1px `border-faint` |
| Đệm thân | 20px | 16px |
| Cỡ chữ mô tả | 13px, cách 4px | 12px, cách 2px |

**13 file còn dùng `bb-card`:**
```
src/components/SeoCard.jsx          src/screens/OrderListScreen.jsx
src/screens/CategoryListScreen.jsx  src/screens/ProductListScreen.jsx
src/screens/ContentListScreen.jsx   src/screens/SettingsScreen.jsx
src/screens/CustomerListScreen.jsx  src/screens/SliderListScreen.jsx
src/screens/AdminUsersScreen.jsx    src/screens/AuditLogListScreen.jsx
src/screens/HomeVideoListScreen.jsx src/screens/OrderDetailScreen.jsx
```

**Chuyện tương tự ở thanh lọc** — `FilterBar` (10 màn) vs `.bb-filter-bar` (2 màn + `FilterSelect.jsx`):

| | `FilterBar` | `.bb-filter-bar` |
|---|---|---|
| Đệm | 16px | 12px |
| Khoảng cách trong | 12px | 10px |
| Canh | `items-end` | `items-center` |
| Chiều cao ô nhập | 36px | 30px |
| Cỡ chữ ô nhập | 14px | 12,5px |

Màn lệch: `AdminUsersScreen`, `CustomerListScreen` (+ `components/FilterSelect.jsx` gắn cứng class cũ).

**Bảng dữ liệu** — `AdminTable` (12 màn, dùng shadcn `Table`) vs bảng tự dựng (4 màn):

| | `AdminTable` | Bảng tự dựng (`.bb-table` / `.menu-table` / `.cat-tree-table`) |
|---|---|---|
| Cỡ chữ thân | `text-sm` = 14px | 13px |
| Chiều cao dòng | `py-3` → ~44px | `height: 48px` |
| Tiêu đề cột | chữ thường, 12px | CHỮ HOA + giãn 0,04–0,05em, 11,5px |
| Chiều cao dòng tiêu đề | `h-11` = 44px | ~35px |
| Màu hover | `surface-hover` #f3f4f6 | `surface-muted` #f8f9fa |

Màn tự dựng: `CategoryListScreen`, `DashboardScreen`, `MenuScreen`, `OrderDetailScreen`.
Riêng `category-list/CategoryTableHead.jsx` gắn cứng `'uppercase tracking-wide'`.

**Kết quả mong muốn:** một hệ duy nhất — mọi thẻ, mọi thanh lọc, mọi bảng trong admin trông và cư xử như nhau.
Sau khi chuyển hết, xoá phần định nghĩa cũ khỏi `admin-prototype.css` để không dùng lại được.

---

### 🔴 F2 — Nút và ô nhập có 7 chiều cao khác nhau

| Nguồn | Chiều cao | Số lần dùng |
|---|---:|---:|
| `.bb-btn-sm` | 26px | |
| `Button size="sm"` | 28px | **195** |
| `.bb-filter-bar` input/select | 30px | |
| `.bb-btn` / `.bb-icon-btn` | 32px | |
| `.bb-input` / `.bb-select` | 34px | |
| `Button size="md"` · `Input` · `Select` | 36px | |
| `Button size="icon"` | 36px | **85** |
| `Button size="lg"` | 40px | |

**Kèm một lỗi tiếp cận thật.** `STYLEGUIDE.md` §8 ghi *"vùng bấm tối thiểu 44×44px trên thao tác chính và mobile"*.
`Checkbox`, `RadioGroup`, `Switch` đã làm đúng (vùng chạm 44px qua pseudo-element `before:h-11 before:w-11`).
**`Button` thì chưa** — không có size nào đạt 44px, trong khi 280 nút đang ở 28px và 36px.

**Kết quả mong muốn:** còn 3 mức (phụ 28 · thường 36 · chính 44); trên điện thoại mọi nút tự nâng lên 44px;
ô nhập và nút đứng cùng hàng thì cùng chiều cao.

---

### 🔴 F3 — Khoảng cách không theo thang nào

`STYLEGUIDE.md` §4 chốt thang 4px: `4·8·12·16·20·24·32·40·48`. Thực tế trong CSS có **25 giá trị**.

Các mức lệch chuẩn và tần suất:

| px | Lần | | px | Lần |
|---:|---:|---|---:|---:|
| 6 | 31 | | 5 | 5 |
| 10 | 31 | | 7 | 4 |
| 2 | 22 | | 9 | 3 |
| 14 | 14 | | 3 | 5 |
| 1 | 8 | | 11·13·15·18·28 | 1–2 mỗi loại |

Cộng thêm **248 lớp Tailwind nửa nấc** trong JSX (`gap-1.5` ×94, `mt-0.5` ×47, `gap-2.5` ×16, `py-0.5` ×15…).
Tập trung nhiều nhất ở `ProductDetailScreen` (19), `roles/RoleDetail` (16), `HomeVideoListScreen` (11), `GlobalSearch` (11).

**Hệ quả nhìn thấy được — khoảng cách giữa các thẻ có 2 giá trị:**

| Khoảng cách | Màn |
|---|---|
| **24px** (`gap-6`) | CategoryDetail · CustomerDetail · ReviewDetail · ProductDetail · ContentDetail |
| **16px** (`gap-4`) | `Screen` mặc định (mọi màn danh sách) · ChatDetail · ReviewList · Maintenance · `.bb-stack` (OrderDetail) |

**Tình trạng token:** `admin-prototype.css` — file mà `CLAUDE.md` gọi là *"hệ bb-* canonical đang sống, chassis chính"* —
có **144 khai báo khoảng cách px cứng và 0 khai báo qua token**. `index.css`: 142 cứng / 63 token.
Đồng thời 16 token đã khai báo nhưng **không ai dùng**: `--bb-text-{xs,sm,base,md,lg,xl,2xl,3xl}` và `--bb-s-{1..10}`
(vi phạm luật CSS Hygiene trong `CLAUDE.md`).

**Kết quả mong muốn:** một khoảng cách duy nhất giữa các thẻ trong toàn admin; mọi số đo lấy từ token;
có kiểm tra tự động chặn giá trị ngoài thang 4px.

---

### 🔴 F4 — Chữ chú thích quá nhiều *(điểm owner nêu đích danh)*

**a) Chú thích chép lại đúng cái nhãn ngay trên nó.** Rõ nhất ở `SettingsScreen`:

```
Nhãn      : "Tên shop (SEO trang chủ/bài viết, khối liên hệ trang sản phẩm)"
Chú thích : "tên hiển thị — SEO trang chủ/bài viết + khối liên hệ trang sản phẩm"
             ↑ không thêm bất kỳ thông tin nào

Nhãn      : "Mô tả ngắn (panel thông tin shop trên header mobile)"
Chú thích : "đoạn mô tả — panel thông tin shop trên header mobile"
             ↑ tương tự
```

**b) Ba lớp tiêu đề nói cùng một chuyện.** `ScreenHeader` có eyebrow + title + description; 3 màn có eyebrow trùng title:

| Màn | Eyebrow | Title | Description |
|---|---|---|---|
| Tin tức | `Tin tức` | `Tin tức` | `Quản lý bài viết, tin tức.` |
| Tổng quan | `Tổng quan` | `Bảng điều khiển` | — |
| Thư viện ảnh | `Thư viện ảnh/video` | `Thư viện ảnh` | `Quản lý ảnh và video đã tải lên thư viện.` |

**28/35 màn** có dòng description dưới H1; phần lớn chỉ diễn giải lại tên màn
(`Sản phẩm` → *"Quản lý danh mục sản phẩm."*, `Thương hiệu` → *"Quản lý thương hiệu sản phẩm."*).

**c) Chú thích quá dài.** 68 khoá vượt 100 ký tự. 10 khoá dài nhất:

```
301  products.detail.specStats.hint
234  products.detail.commitments.hint
216  products.detail.highlights.htmlHint
201  products.detail.variantPricingHint
194  content.detail.homeExperienceHint
191  products.detail.faqs.htmlHint
191  categories.detail.menuNoticeDesc
188  categories.introContentHint
182  products.detail.sizeGuide.htmlHint
181  guideBuilder.description
```

**d) Công cụ đã có nhưng không dùng.** `src/components/ui/tooltip.jsx` tồn tại, mới dùng ở 3 màn
(`AdminShell`, `ReportsScreen`, `dashboard/charts`). 137 chú thích vẫn render thẳng thành `<p>`.

**Kết quả mong muốn:**
- Bỏ description dưới H1 ở màn mà tên màn đã tự nói rõ — giữ lại khoảng 8/35 màn.
- Bỏ eyebrow khi trùng title.
- Chú thích trên ~80 ký tự chuyển sang tooltip (dấu "?" rê chuột mới hiện).
- Nguyên tắc: mỗi ô nhập tối đa **một dòng ngắn**, và chỉ khi dòng đó nói được điều nhãn chưa nói.

---

### 🔴 F5 — Bảng dữ liệu: 2 quy ước tiêu đề, 4 bộ nút thao tác, dòng cao 48–131px

**a) Tiêu đề cột — hai quy ước**

| Quy ước | Màn |
|---|---|
| CHỮ HOA + giãn ký tự | CategoryList · Menu · Roles · OrderDetail · Dashboard |
| Chữ thường | 12 màn còn lại (qua `AdminTable`) |

**b) Cột thao tác — bốn bộ nút khác nhau**

| Màn | Nút |
|---|---|
| Sản phẩm | sửa · ẩn · "…" |
| Thương hiệu | sửa · ẩn |
| Bài viết | sửa · xoá (đỏ) |
| Menu | sửa · xoá (đỏ) |

**c) Chiều cao dòng thật (đo trên ảnh chụp 1440px)**

| Màn | Chiều cao dòng |
|---|---:|
| *Chuẩn `STYLEGUIDE.md`* | *48px* |
| Đơn hàng | ~61px |
| Nhật ký | ~63px |
| Danh mục · Bài viết | ~69px |
| Sản phẩm | ~100px |
| **Thương hiệu** | **~131px** |

**d) Vấn đề nặng nhất — `BrandListScreen`.**
`BrandLogoQualityNotice` render một `<Alert>` đầy đủ **bên trong từng dòng bảng** (`BrandListScreen.jsx:281`).
Cả 25 thương hiệu đều dính cùng một lỗi legacy nên cùng hiện đúng một câu:

> ⚠ *"Logo cũ cần được kiểm tra: không đọc được tệp media, chưa kiểm tra được nền trong suốt — nên thay khi thuận tiện."*

→ chỉ xem được **5 thương hiệu mỗi màn hình** thay vì ~15.
Nên gom thành 1 dải cảnh báo trên đầu bảng + 1 badge ngắn trong dòng.

**e) Hai lỗi có ở *mọi* màn danh sách**
- `AdminTable.jsx:71` đặt `containerClassName="max-h-[calc(100vh-13rem)]"` → vùng bảng bị khoá chiều cao cứng,
  **dòng cuối luôn bị cắt đôi** ở mọi màn (thấy rõ trên ảnh Sản phẩm, Danh mục, Menu, Nhật ký, Đơn hàng).
- Độ rộng cột không cân: Sản phẩm bóp cột tên xuống 4 dòng chữ trong khi Đơn hàng bỏ trống ~90px bên phải.

**Kết quả mong muốn:** một quy ước tiêu đề cột, một bộ nút thao tác, không còn dòng cuối bị cắt,
cảnh báo lặp gom lên đầu bảng, độ rộng cột theo nội dung.

---

### 🟠 F6 — Eyebrow nói ngược với nhóm trong sidebar

Sidebar có **5 nhóm** (`App.jsx:102–144`): Bán hàng · Sản phẩm · Nội dung và tiếp thị · Báo cáo · Hệ thống.
Eyebrow dùng **11 nhãn khác nhau**, phần lớn không khớp nhóm thật:

| Màn | Eyebrow hiện tại | Nhóm thật trong sidebar |
|---|---|---|
| **Sản phẩm** | `Danh mục` ❌ | Sản phẩm |
| **Danh mục sản phẩm** | `Sản phẩm` ❌ | Sản phẩm |
| Đánh giá | `Danh mục` ❌ | Bán hàng |
| Đơn hàng · Khách hàng | `Thương mại` ❌ | Bán hàng |
| Menu | `Cài đặt` ❌ | Nội dung và tiếp thị |
| Banner | `Giao diện` ❌ | Nội dung và tiếp thị |
| Báo cáo | `Phân tích` ❌ | Báo cáo |
| Hội thoại | `Trợ lý bán hàng` ❌ | Bán hàng |

Hai màn quan trọng nhất (Sản phẩm / Danh mục) bị **gán ngược nhau**.

**Kết quả mong muốn:** eyebrow lấy đúng tên nhóm sidebar (5 tên); màn nào eyebrow trùng title thì bỏ eyebrow.

---

### 🟠 F7 — Khoảng trống chết, và menu Hệ thống bị khuất trên laptop

**⚠ Điểm cần sửa sớm nhất trong mục này.**
`.bb-sidebar-nav` có `overflow-y: auto`, nhưng thanh cuộn đặt `scrollbar-color: var(--bb-sidebar-border) transparent`
= `#1c2230` trên nền `#0d1117` → **tương phản ~1,3:1, gần như vô hình**.
Trên laptop cao 900px (khổ phổ biến nhất), nhóm **Hệ thống** bị đẩy khuất hoàn toàn:
Cài đặt · Phân quyền · Tài khoản quản trị · Nhật ký hoạt động · Bảo trì — **5 mục người dùng mới sẽ tưởng là không có**.
Đã xác nhận trên ảnh chụp thật 1440×900.

**Ba chỗ trống sai:**

| Ở đâu | Hiện trạng | Nên làm |
|---|---|---|
| Cột phải các màn chi tiết | 5 màn dùng `lg:grid-cols-3` + `lg:col-span-2` nhưng **không màn nào cho cột phải `sticky`**. Trên CategoryDetail (cao 5.972px) nội dung cột phải hết ở ~400px, còn lại trống ~5.500px | Cho cột phải `position: sticky` |
| `SettingsScreen` | Hơn nửa dưới màn trắng trơn; một ô nhập bị bọc trong **3 lớp viền lồng nhau** (panel → card → field card → input) | Bỏ 1 lớp bọc, biểu mẫu chia 2 cột |
| `MediaLibraryScreen` | Cột thư mục trống >1.500px; lưới ảnh chỉ 4 cột ở màn 1440px; filter/grid/pagination nằm trần trên nền, không có card như mọi màn khác | Lưới 6 cột, cột thư mục `sticky`, bọc card cho nhất quán |

Ghi chú thêm: `gap-6` giữa 2 cột nhưng ChatDetail và ReviewList dùng `gap-4` — lệch ngay trong cùng một pattern.

---

### 🟠 F8 — Điện thoại: bộ lọc chiếm 82% màn hình đầu

Đo thật trên `/admin/products` ở 390×844:

```
Tiêu đề + eyebrow + description      ~85px
3 nút header xếp dọc                ~130px
Chip lọc nhanh                       ~55px
Bộ lọc 8 ô xếp dọc                  ~320px
─────────────────────────────────────────
Chiếm chỗ                           ~690px  (82%)
Còn lại để nhìn dữ liệu             ~154px  (18%)
```

**Công cụ đã có nhưng chưa nhân rộng:**
- `screens/audit-log-list/MobileFilterDrawer.jsx` — ngăn lọc kéo ra cho điện thoại, **mới dùng ở đúng 1 màn** (Nhật ký).
  9 màn danh sách còn lại chưa có.
- `mobileCard` (`MobileCardList`) — đã có ở 9 màn; **4 màn còn thiếu**, vẫn phải kéo ngang để đọc bảng:
  `CategoryListScreen` · `AuditLogListScreen` · `LegacyDiscontinuedProductsScreen` · `MenuScreen`.

Thêm: `bb-screen-actions` dùng `flex-wrap` nên 3 nút header xếp thành 3 dòng trên điện thoại — nên gộp vào menu "…".

---

## 3. Đối chiếu với admin ngoài

| Nguồn | Họ làm gì | Áp vào BigBike |
|---|---|---|
| Linear | Dòng bảng 36px, gần như không có khung viền thừa | Bỏ lớp bọc lồng nhau ở Settings; giữ dòng bảng gọn thay vì nở ra 131px |
| Stripe | Đúng 4 ô KPI trên đầu, không có gì khác tranh sự chú ý | Dashboard đang đúng hướng — giữ 4 ô, bỏ dòng mô tả thừa dưới mỗi ô |
| Shopify Polaris | Save bar dính đáy màn; một khung trang duy nhất cho mọi màn | `StickyActionBar` đã có, dùng ở **16/35** màn — áp cho mọi form cấp trang |
| Carbon (IBM) | Mật độ bảng là **tuỳ chọn của người dùng**: gọn · vừa · thoáng | Thêm nút đổi mật độ bảng — xem đơn muốn gọn, xem sản phẩm muốn thoáng |
| Grafana | Cho phép siết dòng khi cần nhìn nhiều dữ liệu | Cùng hướng trên; ưu tiên thấp hơn |
| WCAG 2.1/2.2 | Vùng bấm tối thiểu; thao tác chỉ hiện khi hover là lỗi tiếp cận | Nâng nút lên 44px (F2). Nút thao tác trong bảng hiện đã luôn hiện — **đúng rồi, giữ nguyên** |

### Những thứ đang làm tốt hơn mặt bằng chung — không được phá

- Màu đã đo tương phản đạt WCAG AA ở **cả light và dark**, có kiểm tự động 22 cặp (`admin-tokens.test.js`).
- `StatePanel` dùng chung cho 36 màn (rỗng/lỗi/không có quyền).
- `ScreenSkeleton` dùng chung cho 19 màn.
- `Checkbox` / `RadioGroup` / `Switch` đã có vùng chạm 44px.
- Tiếng Việt có dấu đầy đủ, không mojibake.
- `prefers-reduced-motion` đã xử lý.
- Inline `style={{}}` chỉ còn 29 chỗ, hầu hết là giá trị động hợp lệ — sạch.

---

## 4. Lộ trình đề xuất

### Đợt 1 — Gom về một hệ *(ảnh hưởng lớn nhất, rủi ro thấp)*
1. Chuyển 13 file `bb-card` → `DetailSection`; 2 màn + `FilterSelect` → `FilterBar`; 4 bảng tự dựng → `AdminTable`. Xoá định nghĩa cũ. **(F1)**
2. Rút 7 chiều cao control xuống 3; thêm quy tắc 44px trên mobile cho `Button`. **(F2)**
3. Chốt một khoảng cách giữa các thẻ; bọc 17 màn còn thiếu vào `Screen`; thay px cứng bằng token; xoá 16 token chết. **(F3)**

### Đợt 2 — Dọn chữ và dọn bảng
4. Cắt chú thích: bỏ description trùng tên màn, bỏ eyebrow trùng title, đưa 68 chuỗi >100 ký tự vào tooltip. **(F4)**
5. Thống nhất tiêu đề cột + bộ nút thao tác; bỏ `max-h` cứng của `AdminTable`; đặt độ rộng cột theo nội dung. **(F5)**
6. Gom cảnh báo logo ở `BrandListScreen` lên đầu bảng. **(F5d)**
7. Sửa eyebrow khớp 5 nhóm sidebar. **(F6)**

### Đợt 3 — Lấp khoảng trống và lo cho điện thoại
8. **Ưu tiên nhấc lên sớm:** menu Hệ thống hiện đủ trên laptop 900px + thanh cuộn sidebar nhìn thấy được. **(F7)**
9. Cột phải `sticky` ở 5 màn chi tiết; gọn lại Settings và MediaLibrary. **(F7)**
10. `MobileFilterDrawer` cho 9 màn danh sách; `mobileCard` cho 4 màn còn thiếu; gộp nút header vào menu "…". **(F8)**
11. Nút đổi mật độ bảng (gọn · vừa · thoáng) theo cách Carbon/Grafana làm.

---

## 5. Ràng buộc khi sửa

- **Không đổi** bảng màu, phông, token trạng thái, hay ngưỡng tương phản — phần đó đã đạt chuẩn.
- **Không khôi phục** `SectionCard`, `MediaCardSkeleton`, `.mono`, skeleton tự chế, header dựng tay
  (`STYLEGUIDE.md` §5 cấm; đợt 2026-08-23 đã xoá đúng).
- Mọi thay đổi số đo phải đi qua token trong `admin-tokens.css`, không viết cứng px.
- Cập nhật `STYLEGUIDE.md` nếu chốt lại khoảng cách giữa thẻ hoặc thang chiều cao control — docs đi trước code, cùng một PR.
- Sau mỗi đợt chạy: `node scripts/check-i18n.js`, `npm run lint`, `npm test -- --run`, `npm run build`.
- Cập nhật `ADMIN_AUDIT_BOARD.md` mục "Việc xuyên module" khi đóng từng đợt.

---

## 6. Cách tái lập số liệu

```bash
cd bigbike-admin

# Màn không bọc <Screen>
for f in src/screens/*Screen.jsx; do grep -q '<Screen[ >]' $f || echo $f; done

# File còn dùng hệ cũ
grep -rln 'bb-card'       src --include=*.jsx | grep -v '\.test\.'
grep -rln 'bb-filter-bar' src --include=*.jsx | grep -v '\.test\.'

# Màn tự dựng bảng
for f in src/screens/*Screen.jsx; do grep -q '<AdminTable' $f || \
  { grep -qE '<table|bb-table|menu-table|cat-tree-table' $f && echo $f; }; done

# Các mức khoảng cách px đang dùng
grep -rhoE '(padding|margin|gap)[a-z-]*:\s*[^;]+;' src/index.css src/styles/*.css \
  | grep -oE '\b[0-9]+px' | sort -u

# Lớp Tailwind nửa nấc
grep -rnoE '\b(gap|space-[xy]|p|px|py|m|mt|mb)-[0-9]+\.5\b' src --include=*.jsx \
  | grep -v '\.test\.' | wc -l

# Token khai báo nhưng không dùng
for t in xs sm base md lg xl 2xl 3xl; do echo -n "--bb-text-$t: "; \
  grep -rho "var(--bb-text-$t)" src | wc -l; done
```

Ảnh chụp thật dùng cho audit này: chạy driver trong `.claude/skills/run-bigbike-admin/`.
Lưu ý CORS — backend đang chạy với origin production, phải drive qua `https://admin.bigbike.vn`
kèm `--host-resolver-rules=MAP admin.bigbike.vn 127.0.0.1`, không dùng `localhost:4000` (403 Invalid CORS request).
